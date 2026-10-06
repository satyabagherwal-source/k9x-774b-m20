# Forensic Learning Record (Deep Inspection): PySpur-Dev/pyspur

> **Canonical Artifact**: `07_PROJECT_LEARNING/pyspur-dev-pyspur-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PySpur-Dev/pyspur](https://github.com/PySpur-Dev/pyspur))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:31:10.275Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PySpur-Dev/pyspur`
- **Description**: A visual playground for agentic workflows: Iterate over your agents 10x faster
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5794 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/pyspur/cli/utils.py`
```
"""Utility functions for the PySpur CLI."""

import shutil
import tempfile
from importlib import resources
from pathlib import Path

import typer
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from dotenv import load_dotenv
from rich import print
from sqlalchemy import text


def copy_template_file(template_name: str, dest_path: Path) -> None:
    """Copy a template file from the package templates directory to the destination."""
    with resources.files("pyspur.templates").joinpath(template_name).open("rb") as src:
        with open(dest_path, "wb") as dst:
            shutil.copyfileobj(src, dst)


def load_environment() -> None:
    """Load environment variables from .env file with fallback to .env.example."""
    env_path = Path.cwd() / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print("[green]✓[/green] Loaded configuration from .env")
    else:
        with resources.files("pyspur.templates").joinpath(".env.example").open() as f:
            load_dotenv(stream=f)
            print(
                "[yellow]![/yellow] No .env file found,"
                " using default configuration from .env.example"
            )
            print("[yellow]![/yellow] Run 'pyspur init' to create a customizable .env file")


def run_migrations() -> None:
    """Run database migrations using SQLAlchemy."""
    try:
        # ruff: noqa: F401
        from ..database import database_url, engine
        from ..models.base_model import BaseModel

        # Import models
        from ..models.dataset_model import DatasetModel  # type: ignore
        from ..models.dc_and_vi_model import (
            DocumentCollectionModel,  # type: ignore
            VectorIndexModel,  # type: ignore
        )
        from ..models.eval_run_model import EvalRunModel  # type: ignore
        from ..models.output_file_model import OutputFileModel  # type: ignore
        from ..models.run_model import RunModel  # type: ignore
        from ..models.slack_agent_model import SlackAgentModel  # type: ignore
        from ..models.task_model import TaskModel  # type: ignore
        from ..models.user_session_model import (
            MessageModel,  # type: ignore
            SessionModel,  # type: ignore
            UserModel,  # type: ignore
        )
        from ..models.workflow_model import WorkflowModel  # type: ignore
        from ..models.workflow_version_model import WorkflowVersionModel  # type: ignore
        # Import all models to ensure they're registered with SQLAlchemy

        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            print("[green]✓[/green] Connected to database")

            # If using SQLite, create the database file if it doesn't exist
            if database_url.startswith("sqlite"):
                try:
                    BaseModel.metadata.create_all(engine)
                    print("[green]✓[/green] Created SQLite database")
                    print(f"[green]✓[/green] Database URL: {database_url}")
                    # Print all tables in the database
                    tables = BaseModel.metadata.tables
                    if tables:
                        print("\n[green]✓[/green] Successfully initialized SQLite database")
                    else:
                        print("[red]![/red] SQLite database is empty")
                        raise typer.Exit(1)
                    print("[yellow]![/yellow] SQLite database is not recommended for production")
                    print("[yellow]![/yellow] Please use a postgres instance instead")
                    return
                except Exception:
                    print("[yellow]![/yellow] SQLite database out of sync, recreating from scratch")
                    # Ask for confirmation before dropping all tables
                    confirm = input(
                        "This will delete all data in the SQLite database. Are you sure? (y/N): "
                    )
                    if confirm.lower() != "y":
                        print("[yellow]![/yellow] Database recreation cancelled")
                        print(
                            "[yellow]![/yellow] Please revert pyspur to the original"
                            " version that was used to create the database"
                        )
                        print("[yellow]![/yellow] OR use a postgres instance to support migrations")
                        return
                    BaseModel.metadata.drop_all(engine)
                    BaseModel.metadata.create_all(engine)
                    print("[green]✓[/green] Created SQLite database from scratch")
                    return

            # For other databases, use Alembic migrations
            # Get migration context
            context = MigrationContext.configure(conn)

            # Get current revision
            current_rev = context.get_current_revision()

            if current_rev is None:
                print("[yellow]![/yellow] No previous migrations found, initializing database")
            else:
                print(f"[green]✓[/green] Current database version: {current_rev}")

            # Get migration scripts directory using importlib.resources
            script_location = resources.files("pyspur.models.management.alembic")
            if not script_location.is_dir():
                raise FileNotFoundError("Migration scripts not found in package")

            # extract migration scripts directory to a temporary location
            with (
                tempfile.TemporaryDirectory() as script_temp_dir,
                resources.as_file(script_location) as script_location_path,
            ):
                shutil.copytree(script_location_path, Path(script_temp_dir), dirs_exist_ok=True)
                # Create Alembic config programmatically
                config = Config()
                config.set_main_option("script_location", str(script_temp_dir))
                config.set_main_option("sqlalchemy.url", database_url)

                # Run upgrade to head
                command.upgrade(config, "head")
                print("[green]✓[/green] Database schema is up to date")

    except Exception as e:
        print(f"[red]Error running migrations: {str(e)}[/red]")
        raise typer.Exit(1) from e

```

### Core Architecture Module: `backend/pyspur/dataset/ds_util.py`
```
from typing import Any, Dict, Iterator, Set

import pandas as pd


def get_ds_column_names(
    file_path: str,
) -> Set[str]:
    """
    Returns the column names of a pandas compatible dataset file.
    """
    if file_path.endswith(".csv"):
        df: pd.DataFrame = pd.read_csv(file_path)  # type: ignore
    elif file_path.endswith(".parquet"):
        df: pd.DataFrame = pd.read_parquet(file_path)
    elif file_path.endswith(".jsonl"):
        df: pd.DataFrame = pd.read_json(file_path, lines=True)  # type: ignore
    else:
        raise ValueError(f"Unsupported file format: {file_path}")

    # make sure each column name is a string
    df.columns = [str(col) for col in df.columns]

    return set(df.columns)


def get_ds_iterator(
    file_path: str,
) -> Iterator[Dict[str, Any]]:
    """
    Returns an iterator over the rows of a pandas compatible dataset file.
    """
    if file_path.endswith(".csv"):
        df: pd.DataFrame = pd.read_csv(file_path)  # type: ignore
    elif file_path.endswith(".parquet"):
        df: pd.DataFrame = pd.read_parquet(file_path)
    elif file_path.endswith(".jsonl"):
        df: pd.DataFrame = pd.read_json(file_path, lines=True)  # type: ignore
    else:
        raise ValueError(f"Unsupported file format: {file_path}")

    # make sure each column name is a string
    df.columns = [str(col) for col in df.columns]

    for _, row in df.iterrows():  # type: ignore
        yield row.to_dict()  # type: ignore

```

### Core Architecture Module: `backend/pyspur/integrations/slack/socket_worker.py`
```
#!/usr/bin/env python
"""Worker process for handling a single Slack Socket Mode connection.

This runs in a separate process managed by the SocketManager.
"""

import asyncio
import logging
import os
import signal
import sys
import types
from datetime import datetime
from typing import Optional

from loguru import logger
from sqlalchemy.orm import Session

from ...api.slack_management import handle_socket_mode_event_sync
from ...database import get_db
from ...models.slack_agent_model import SlackAgentModel
from .socket_client import SocketModeClient, get_socket_mode_client

# Configure logging
logging.basicConfig(level=logging.INFO)


def get_active_agents(db: Session) -> list[SlackAgentModel]:
    """Get all active agents that have socket mode enabled."""
    agents = (
        db.query(SlackAgentModel)
        .filter_by(
            is_active=True, trigger_enabled=True, has_bot_token=True, socket_mode_enabled=True
        )
        .filter(SlackAgentModel.workflow_id.isnot(None))
        .all()
    )
    return agents


def setup_shutdown_handler(socket_client: SocketModeClient, agent_id: int):
    """Set up signal handlers for graceful shutdown."""

    def handle_shutdown(signum: int, frame: Optional[types.FrameType]) -> None:
        logger.info(f"Worker {agent_id} received signal {signum}, shutting down")
        socket_client.stop_socket_mode(agent_id)
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)


async def check_agent_status(db: Session, agent_id: int) -> bool:
    """Check if the agent is still active and should be running.

    Args:
        db: Database session
        agent_id: The agent ID to check

    Returns:
        bool: True if the agent should be running, False otherwise

    """
    try:
        agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
        if not agent:
            logger.warning(f"Agent {agent_id} no longer exists")
            return False

        return (
            bool(agent.is_active)
            and bool(agent.trigger_enabled)
            and bool(agent.has_bot_token)
            and bool(agent.workflow_id)
            and bool(agent.socket_mode_enabled)
        )
    except Exception as e:
        logger.error(f"Error checking agent {agent_id} status: {e}")
        return False


async def run_worker(agent_id: int):
    """Run the worker process for a specific agent

    Args:
        agent_id: The ID of the Slack agent to handle

    """
    # Initialize the socket client
    socket_client = get_socket_mode_client()
    socket_client.set_workflow_trigger_callback(handle_socket_mode_event_sync)

    # Set up shutdown handlers
    setup_shutdown_handler(socket_client, agent_id)

    # Print worker info
    worker_id = os.environ.get("HOSTNAME", "unknown")
    logger.info(f"Socket worker {worker_id} started for agent {agent_id}")

    # Create a marker file to indicate this worker is running
    # This helps with tracking workers even if the API restarts
    marker_dir = "/tmp/pyspur_socket_workers"
    os.makedirs(marker_dir, exist_ok=True)
    marker_file = f"{marker_dir}/agent_{agent_id}.pid"
    with open(marker_file, "w") as f:
        f.write(str(os.getpid()))

    status_file = f"{marker_dir}/agent_{agent_id}.status"

    # Register a cleanup function to remove the marker file when the process exits
    import atexit

    def cleanup_marker():
        try:
            if os.path.exists(marker_file):
                os.remove(marker_file)
                logger.info(f"Removed marker file {marker_file}")
        except Exception as e:
            logger.error(f"Error removing marker file: {e}")

    atexit.register(cleanup_marker)

    # Add a brief delay to ensure database is ready
    await asyncio.sleep(5)

    try:
        # Start socket mode for this agent
        success = socket_client.start_socket_mode(agent_id)
        if not success:
            logger.error(f"Failed to start socket mode for agent {agent_id}")
            return

        logger.info(f"Socket mode started for agent {agent_id}")

        # Write status information to a status file
        try:
            with open(status_file, "w") as f:
                import json

                status_info = {
                    "agent_id": agent_id,
                    "started_at": datetime.now().isoformat(),
                    "pid": os.getpid(),
                    "hostname": worker_id,
                    "status": "running",
                }
                f.write(json.dumps(status_info))
        except Exception as status_err:
            logger.error(f"Error writing status file: {status_err}")

        # Keep checking the agent's status and be resilient to database connection issues
        max_retries = 3
        retry_count = 0
        while True:
            try:
                db = next(get_db())
                try:
                    # Check if we should still be running
                    should_run = await check_agent_status(db, agent_id)
                    # Reset retry counter on successful check
                    retry_count = 0

                    if not should_run:
                        logger.info(f"Agent {agent_id} is no longer active, shutting down")
                        break

                    # Check if socket is still running
                    if not socket_client.is_running(agent_id):
                        logger.warning(
                            f"Socket for agent {agent_id} is not running, attempting restart"
                        )
                        success = socket_client.start_socket_mode(agent_id)
                        if not success:
                            logger.error(f"Failed to restart socket for agent {agent_id}")
                            retry_count += 1
                            if retry_count >= max_retries:
                                logger.error(
                                    f"Reached max retries ({max_retries}) for agent {agent_id}, shutting down"
                                )
                                break
                finally:
                    db.close()
            except asyncio.CancelledError:
                logger.info(f"Worker {agent_id} received cancellation, shutting down gracefully")
                break
            except Exception as e:
                logger.error(f"Error in worker loop for agent {agent_id}: {e}")
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(
                        f"Reached max retries ({max_retries}) for agent {agent_id}, shutting down"
                    )
                    break
                await asyncio.sleep(5)

    except Exception as e:
        logger.error(f"Critical error in worker for agent {agent_id}: {e}")
    finally:
        # Ensure socket is stopped and cleanup is performed
        try:
            socket_client.stop_socket_mode(agent_id)
        except Exception as stop_err:
            logger.error(f"Error stopping socket mode: {stop_err}")

        # Update status file to indicate shutdown
        try:
            with open(status_file, "w") as f:
                import json

                status_info = {
                    "agent_id": agent_id,
                    "shutdown_at": datetime.now().isoformat(),
                    "pid": os.getpid(),
                    "hostname": worker_id,
                    "status": "stopped",
                }
                f.write(json.dumps(status_info))
        except Exception as status_err:
            logger.error(f"Error updating status file on shutdown: {status_err}")

        # Try to clean up marker files
        cleanup_marker()


def main(agent_id: Optional[int] = None):
    """Main entry point for the worker

    Args:
        agent_id: Optional agent ID to handle. If not provided, will handle all active agents.

    """
    if agent_id is None:
        logger.error("No agent ID provided")
        sys.exit(1)

    try:
        asyncio.run(run_worker(agent_id))
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down")
    except Exception as e:
        logger.error(f"Error in worker main: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # If running directly, get agent ID from environment
    agent_id_str = os.environ.get("SLACK_AGENT_ID")
    if not agent_id_str:
        logger.error("No agent ID provided")
        sys.exit(1)
    try:
        agent_id = int(agent_id_str)
    except ValueError:
        logger.error(f"Invalid agent ID: {agent_id_str}")
        sys.exit(1)
    main(agent_id)

```

### Core Architecture Module: `backend/pyspur/integrations/slack/worker_status.py`
```
"""Module for checking the status of Slack socket mode workers.

This provides utilities for identifying running workers from marker files
and status files, which helps maintain state between API restarts.
"""

import json
import os
from typing import Any, Dict, List, Optional, Tuple, TypedDict

import psutil
from loguru import logger

# Base directory for worker marker files
MARKER_DIR = "/tmp/pyspur_socket_workers"


class WorkerStatus(TypedDict):
    agent_id: int
    marker_exists: bool
    process_running: bool
    pid: Optional[int]
    status_file_exists: bool
    status: str
    details: Dict[str, Any]


def get_worker_status(agent_id: int) -> WorkerStatus:
    """Get the status of a worker for a specific agent.

    Args:
        agent_id: The ID of the agent to check

    Returns:
        Dict: A dictionary with status information

    """
    result = WorkerStatus(
        agent_id=agent_id,
        marker_exists=False,
        process_running=False,
        pid=None,
        status_file_exists=False,
        status="unknown",
        details={},
    )

    # Ensure the marker directory exists
    if not os.path.exists(MARKER_DIR):
        return result

    # Check for marker file
    marker_file = f"{MARKER_DIR}/agent_{agent_id}.pid"
    if os.path.exists(marker_file):
        result["marker_exists"] = True

        # Read the PID
        try:
            with open(marker_file, "r") as f:
                pid = int(f.read().strip())
                result["pid"] = pid

            # Check if process is running
            try:
                process = psutil.Process(pid)
                cmdline = process.cmdline()
                cmdline_str = " ".join(cmdline)
                if (
                    "socket_worker.py" in cmdline_str
                    and f"SLACK_AGENT_ID={agent_id}" in cmdline_str
                ):
                    result["process_running"] = True
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        except Exception as e:
            logger.error(f"Error reading PID from marker file for agent {agent_id}: {e}")

    # Check for status file
    status_file = f"{MARKER_DIR}/agent_{agent_id}.status"
    if os.path.exists(status_file):
        result["status_file_exists"] = True

        # Read the status
        try:
            with open(status_file, "r") as f:
                status_data = json.load(f)
                result["status"] = status_data.get("status", "unknown")
                result["details"] = status_data
        except Exception as e:
            logger.error(f"Error reading status file for agent {agent_id}: {e}")

    return result


def list_workers() -> List[Dict[str, Any]]:
    """List all workers based on marker files.

    Returns:
        List[Dict[str, Any]]: A list of worker status dictionaries

    """
    results: List[Dict[str, Any]] = []

    # Ensure the marker directory exists
    if not os.path.exists(MARKER_DIR):
        return results

    # Find all marker files
    for filename in os.listdir(MARKER_DIR):
        if filename.startswith("agent_") and filename.endswith(".pid"):
            try:
                # Extract agent ID
                agent_id_str = filename[6:-4]  # Remove "agent_" prefix and ".pid" suffix
                agent_id = int(agent_id_str)

                # Get status for this agent
                status = get_worker_status(agent_id)
                results.append(dict(status))
            except Exception as e:
                logger.error(f"Error processing marker file {filename}: {e}")

    return results


def find_running_worker_process(agent_id: int) -> Tuple[bool, Optional[int]]:
    """Find a running worker process for the given agent ID.

    Args:
        agent_id: The agent ID to look for

    Returns:
        Tuple[bool, Optional[int]]: A tuple of (is_running, pid)

    """
    for proc in psutil.process_iter(["pid", "cmdline"]):
        try:
            cmdline = proc.info["cmdline"]
            if cmdline:
                cmdline_str = " ".join(cmdline)
                if "socket_worker.py" in cmdline_str and (
                    f"SLACK_AGENT_ID={agent_id}" in cmdline_str
                    or f"--agent-id={agent_id}" in cmdline_str
                ):
                    return True, proc.info["pid"]
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    return False, None

```

### Core Architecture Module: `backend/pyspur/nodes/llm/_utils.py`
```
# type: ignore
import base64
import json
import logging
import os
import re
from typing import Any, Callable, Dict, List, Optional

import litellm
from docx2python import docx2python
from dotenv import load_dotenv
from litellm import acompletion
from litellm.types.utils import Message
from ollama import AsyncClient
from pydantic import BaseModel, Field
from tenacity import AsyncRetrying, stop_after_attempt, wait_random_exponential

from ...utils.file_utils import encode_file_to_base64_data_url
from ...utils.mime_types_utils import get_mime_type_for_url
from ...utils.path_utils import is_external_url, resolve_file_path
from ._model_info import LLMModels
from ._providers import OllamaOptions, setup_azure_configuration

# uncomment for debugging litellm issues
# litellm.set_verbose=True
load_dotenv()

# Enable parameter dropping for unsupported parameters
litellm.drop_params = True

# Clean up Azure API base URL if needed
azure_api_base = os.getenv("AZURE_OPENAI_API_BASE", "").rstrip("/")
if azure_api_base.endswith("/openai"):
    azure_api_base = azure_api_base.rstrip("/openai")
os.environ["AZURE_OPENAI_API_BASE"] = azure_api_base

# Set OpenAI base URL if provided
openai_base_url = os.getenv("OPENAI_API_BASE")
if openai_base_url:
    litellm.api_base = openai_base_url

# If Azure OpenAi is configured, set it as the default provider
if os.getenv("AZURE_OPENAI_API_KEY"):
    litellm.api_key = os.getenv("AZURE_OPENAI_API_KEY")


class ModelInfo(BaseModel):
    model: LLMModels = Field(LLMModels.GPT_4O, description="The LLM model to use for completion")
    max_tokens: Optional[int] = Field(
        ...,
        ge=1,
        le=65536,
        description="Maximum number of tokens the model can generate",
    )
    temperature: Optional[float] = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Temperature for randomness, between 0.0 and 1.0",
    )
    top_p: Optional[float] = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
        description="Top-p sampling value, between 0.0 and 1.0",
    )


def create_messages(
    system_message: str,
    user_message: str,
    few_shot_examples: Optional[List[Dict[str, str]]] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict[str, str]]:
    messages = [{"role": "system", "content": system_message}]
    if few_shot_examples:
        for example in few_shot_examples:
            messages.append({"role": "user", "content": example["input"]})
            messages.append({"role": "assistant", "content": example["output"]})
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    return messages


def create_messages_with_images(
    system_message: str,
    base64_image: str,
    user_message: str = "",
    few_shot_examples: Optional[List[Dict]] = None,
    history: Optional[List[Dict]] = None,
) -> List[Dict[str, str]]:
    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": system_message}],
        }
    ]
    if few_shot_examples:
        for example in few_shot_examples:
            messages.append(
                {
                    "role": "user",
                    "content": [{"type": "text", "text": example["input"]}],
                }
            )
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": example["img"]},
                        }
                    ],
                }
            )
            messages.append(
                {
                    "role": "assistant",
                    "content": [{"type": "text", "text": example["output"]}],
                }
            )
    if history:
        messages.extend(history)
    messages.append(
        {
            "role": "user",
            "content": [{"type": "image_url", "image_url": {"url": base64_image}}],
        }
    )
    if user_message:
        messages[-1]["content"].append({"type": "text", "text": user_message})
    return messages


def async_retry(*dargs, **dkwargs):
    def decorator(f: Callable) -> Callable:
        r = AsyncRetrying(*dargs, **dkwargs)

        async def wrapped_f(*args, **kwargs):
            async for attempt in r:
                with attempt:
                    return await f(*args, **kwargs)

        return wrapped_f

    return decorator


@async_retry(
    wait=wait_random_exponential(min=30, max=120),
    stop=stop_after_attempt(3),
    retry=lambda e: not isinstance(
        e,
        (
            litellm.exceptions.AuthenticationError,
            ValueError,
            litellm.exceptions.RateLimitError,
        ),
    ),
)
async def completion_with_backoff(**kwargs) -> Message:
    """Call the LLM completion endpoint with backoff.

    Supports Azure OpenAI, standard OpenAI, or Ollama based on the model name.
    """
    try:
        model = kwargs.get("model", "")
        logging.info("=== LLM Request Configuration ===")
        logging.info(f"Requested Model: {model}")

        # Use Azure if either 'azure/' is prefixed or if an Azure API key
        # is provided and not using Ollama
        if model.startswith("azure/") or (
            os.getenv("AZURE_OPENAI_API_KEY") and not model.startswith("ollama/")
        ):
            azure_kwargs = setup_azure_configuration(kwargs)
            logging.info(f"Using Azure config for model: {azure_kwargs['model']}")
            try:
                response = await acompletion(**azure_kwargs, drop_params=True)
                return response.choices[0].message.content
            except Exception as e:
                logging.error(f"Error calling Azure OpenAI: {e}")
                raise

        elif model.startswith("ollama/"):
            logging.info("=== Ollama Configuration ===")
            response = await acompletion(**kwargs, drop_params=True)
            return response.choices[0].message
        else:
            logging.info("=== Standard Configuration ===")
            response = await acompletion(**kwargs, drop_params=True)
            return response.choices[0].message

    except Exception as e:
        logging.error("=== LLM Request Error ===")
        # Create a save copy of kwargs without sensitive information
        save_config = kwargs.copy()
        save_config["api_key"] = "********" if "api_key" in save_config else None
        logging.error(f"Error occurred with configuration: {save_config}")
        logging.error(f"Error type: {type(e).__name__}")
        logging.error(f"Error message: {str(e)}")
        if hasattr(e, "response"):
            logging.error(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
            logging.error(f"Response body: {getattr(e.response, 'text', 'N/A')}")
        raise e


def sanitize_json_schema(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Make a JSON schema compatible with the LLM providers.

    * sets "additionalProperties" to False
    * adds all properties to the "required" list recursively
    """
    if "additionalProperties" not in schema:
        schema["additionalProperties"] = False
    if "properties" in schema:
        for key, value in schema["properties"].items():
            if "required" not in schema:
                schema["required"] = []
            if key not in schema["required"]:
                schema["required"].append(key)
            sanitize_json_schema(value)
    if "$defs" in schema:
        for key in schema["$defs"]:
            schema["$defs"][key] = sanitize_json_schema(schema["$defs"][key])
    return schema


async def generate_text(
    messages: List[Dict[str, str]],
    model_name: str,
    temperature: float = 0.5,
    json_mode: bool = False,
    max_tokens: int = 16384,
    api_base: Optional[str] = None,
    url_variables: Optional[Dict[str, str]] = None,
    output_json_schema: Optional[str] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
    tool_choice: Optional[str] = "auto",
    thinking: Optional[Dict[str, Any]] = None,
) -> Message:
    """Generate text using the specified LLM model.

    Args:
        messages: List of message dictionaries with 'role' and 'content'
        model_name: Name of the LLM model to use
        temperature: Temperature for randomness, between 0.0 and 1.0
        json_mode: Flag to indicate if JSON output is required
        max_tokens: Maximum number of tokens the model can generate
        api_base: Base URL for the API
        url_variables: Dictionary of URL variables for file inputs
        output_json_schema: JSON schema for the output format
        tools: List of function schemas for function calling
        tool_choice: By default the model will determine when and how many tools to use. You can
            force specific behavior with the tool_choice parameter.
            auto: (Default) Call zero, one, or multiple functions. tool_choice: "auto"
            required: Call one or more functions. tool_choice: "required"
            Forced Function: Call exactly one specific function.
                tool_choice: {"type": "function", "function": {"name": "get_weather"}}

        thinking: Thinking parameters for the model

    """
    kwargs = {
        "model": model_name,
        "max_tokens": max_tokens,
        "messages": messages,
        "temperature": temperature,
    }

    # Add function calling parameters if provided
    if tools:
        kwargs["tools"] = tools
        if tool_choice:
            kwargs["tool_choice"] = tool_choice

    # Get model info to check capabilities
    model_info = LLMModels.get_model_info(model_name)

    # Only add thinking parameters if explicitly requested and supported by the model
    if thinking and model_info and model_info.constraints.supports_thinking:
        kwargs["thinking"] = thinking

    if model_name == "deepseek/
```

### Core Architecture Module: `backend/pyspur/nodes/loops/base_loop_subworkflow_node.py`
```
from abc import abstractmethod
from typing import Any, Dict, List

from pydantic import BaseModel, create_model

from ...execution.workflow_executor import WorkflowExecutor
from ...schemas.workflow_schemas import WorkflowDefinitionSchema
from ..base import BaseNodeInput, BaseNodeOutput
from ..primitives.output import OutputNode
from ..subworkflow.base_subworkflow_node import (
    BaseSubworkflowNode,
    BaseSubworkflowNodeConfig,
)


class BaseLoopSubworkflowNodeConfig(BaseSubworkflowNodeConfig):
    subworkflow: WorkflowDefinitionSchema


class BaseLoopSubworkflowNodeInput(BaseNodeInput):
    pass


class BaseLoopSubworkflowNodeOutput(BaseNodeOutput):
    pass


class BaseLoopSubworkflowNode(BaseSubworkflowNode):
    name = "loop_subworkflow_node"
    config_model = BaseLoopSubworkflowNodeConfig
    iteration: int
    loop_outputs: Dict[str, List[Dict[str, Any]]]

    def setup(self) -> None:
        super().setup()
        self.loop_outputs = {}
        self.iteration = 0

    def _update_loop_outputs(self, iteration_output: Dict[str, Dict[str, Any]]) -> None:
        """Update the loop_outputs dictionary with the current iteration's output"""
        for node_id, node_outputs in iteration_output.items():
            # Skip storing the special loop_history field
            if "loop_history" in node_outputs:
                node_outputs = {k: v for k, v in node_outputs.items() if k != "loop_history"}

            if node_id not in self.loop_outputs:
                self.loop_outputs[node_id] = [node_outputs]
            else:
                self.loop_outputs[node_id].append(node_outputs)

    @abstractmethod
    async def stopping_condition(self, input: Dict[str, Any]) -> bool:
        """Determine whether to stop the loop based on the current input"""
        pass

    async def run_iteration(self, input: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single iteration of the loop subworkflow"""
        self.subworkflow = self.config.subworkflow
        assert self.subworkflow is not None

        # Inject loop outputs into the input
        iteration_input = {**input, "loop_history": self.loop_outputs}

        # Execute the subworkflow
        self._executor = WorkflowExecutor(workflow=self.config.subworkflow, context=self.context)
        workflow_executor = self._executor
        outputs = await workflow_executor.run(iteration_input)

        # Convert outputs to dict format
        iteration_outputs = {node_id: output.model_dump() for node_id, output in outputs.items()}

        # Update loop outputs with this iteration's results
        self._update_loop_outputs(iteration_outputs)

        # Get the output node's results
        output_node = next(
            node for node in self.subworkflow.nodes if node.node_type == "OutputNode"
        )
        return iteration_outputs[output_node.id]

    async def run(self, input: BaseModel) -> BaseModel:
        """Execute the loop subworkflow until stopping condition is met"""
        current_input = self._map_input(input)

        # Run iterations until stopping condition is met
        while not await self.stopping_condition(current_input):
            iteration_output = await self.run_iteration(current_input)
            current_input.update(iteration_output)
            self.iteration += 1

        self.subworkflow_output = self.loop_outputs

        # create output model for the loop from the subworkflow output node's output_model
        output_node = next(
            node
            for _id, node in self._executor.node_instances.items()
            if issubclass(node.__class__, OutputNode)
        )
        self.output_model = create_model(
            f"{self.name}",
            **{name: (field, ...) for name, field in output_node.output_model.model_fields.items()},
            __base__=BaseLoopSubworkflowNodeOutput,
            __config__=None,
            __module__=self.__module__,
            __cls_kwargs__={"arbitrary_types_allowed": True},
            __doc__=None,
            __validators__=None,
        )

        # Return final state as BaseModel
        return self.output_model.model_validate(current_input)  # type: ignore

```

### Core Architecture Module: `backend/pyspur/nodes/loops/for_loop_node.py`
```
from typing import Any, Dict

from pydantic import Field

from ...schemas.workflow_schemas import WorkflowDefinitionSchema
from .base_loop_subworkflow_node import (
    BaseLoopSubworkflowNode,
    BaseLoopSubworkflowNodeConfig,
    BaseLoopSubworkflowNodeInput,
)


class ForLoopNodeConfig(BaseLoopSubworkflowNodeConfig):
    num_iterations: int = Field(
        default=1,
        title="Number of iterations",
        description="Number of times to execute the loop",
    )


class ForLoopNodeInput(BaseLoopSubworkflowNodeInput):
    pass


class ForLoopNode(BaseLoopSubworkflowNode):
    name = "for_loop"
    config_model = ForLoopNodeConfig
    input_model = ForLoopNodeInput

    async def stopping_condition(self, input: Dict[str, Any]) -> bool:
        """Stop when we've reached the configured number of iterations"""
        return self.iteration >= self.config.num_iterations


if __name__ == "__main__":
    import asyncio
    from pprint import pprint

    from ...schemas.workflow_schemas import (
        WorkflowLinkSchema,
        WorkflowNodeSchema,
    )

    async def main():
        node = ForLoopNode(
            name="test_loop",
            config=ForLoopNodeConfig(
                subworkflow=WorkflowDefinitionSchema(
                    nodes=[
                        WorkflowNodeSchema(
                            id="loop_input",
                            node_type="InputNode",
                            config={
                                "output_schema": {
                                    "count": "int",
                                    "loop_history": "dict",
                                },
                                "enforce_schema": False,
                            },
                        ),
                        WorkflowNodeSchema(
                            id="increment",
                            node_type="PythonFuncNode",
                            config={
                                "code": """
previous_outputs = input_model.loop_input.loop_history.get('increment', [])
running_total = sum(output['count'] for output in previous_outputs) if previous_outputs else 0  
running_total += input_model.loop_input.count + 1
return {
    'count': input_model.loop_input.count + 1,
    'running_total': running_total
}
""",
                                "output_schema": {
                                    "count": "int",
                                    "running_total": "int",
                                },
                            },
                        ),
                        WorkflowNodeSchema(
                            id="loop_output",
                            node_type="OutputNode",
                            config={
                                "output_map": {
                                    "count": "increment.count",
                                    "running_total": "increment.running_total",
                                },
                                "output_schema": {
                                    "count": "int",
                                    "running_total": "int",
                                },
                            },
                        ),
                    ],
                    links=[
                        WorkflowLinkSchema(
                            source_id="loop_input",
                            target_id="increment",
                        ),
                        WorkflowLinkSchema(
                            source_id="increment",
                            target_id="loop_output",
                        ),
                    ],
                ),
                num_iterations=5,
            ),
        )

        class TestInput(ForLoopNodeInput):
            count: int = 0

        input_data = TestInput()
        output = await node(input_data)
        pprint(output)
        pprint(node.subworkflow_output)

    asyncio.run(main())

```

### Core Architecture Module: `backend/pyspur/nodes/utils/template_utils.py`
```
import logging
from typing import Any, Dict

from jinja2 import Template


def render_template_or_get_first_string(
    template_str: str, input_dict: Dict[Any, Any], node_name: str
) -> str:
    """
    Renders a template string with the given input dictionary.
    If template is empty, returns the first string value found in the input dictionary.

    Args:
        template_str: The template string to render
        input_dict: Dictionary containing values for template rendering
        node_name: Name of the node (for error logging)

    Returns:
        Rendered template string or first string value from input

    Raises:
        ValueError: If no string value is found in input when template is empty
    """
    try:
        # Render template
        rendered = Template(template_str).render(**input_dict)

        # If template is empty, find first string value
        if not template_str.strip():
            for _, value in input_dict.items():
                if isinstance(value, str):
                    return value
            raise ValueError(f"No string type found in the input dictionary: {input_dict}")

        return rendered

    except Exception as e:
        logging.error(f"Failed to render template in {node_name}")
        logging.error(f"template: {template_str} with input: {input_dict}")
        raise e

```

### Core Architecture Module: `backend/pyspur/utils/file_utils.py`
```
import base64
import mimetypes
from pathlib import Path


def encode_file_to_base64_data_url(file_path: str) -> str:
    """
    Read a file and encode it as a base64 data URL with the appropriate MIME type.
    """
    path = Path(file_path)
    mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"

    with open(path, "rb") as f:
        file_content = f.read()
        base64_data = base64.b64encode(file_content).decode("utf-8")
        return f"data:{mime_type};base64,{base64_data}"


def get_file_mime_type(file_path: str) -> str:
    """
    Get the MIME type for a file based on its extension.
    """
    mime_type = mimetypes.guess_type(file_path)[0]
    if mime_type is None:
        # Default MIME types for common file types
        ext = Path(file_path).suffix.lower()
        mime_map = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".mp3": "audio/mpeg",
            ".mp4": "video/mp4",
        }
        mime_type = mime_map.get(ext, "application/octet-stream")
    return mime_type

```

### Core Architecture Module: `backend/pyspur/utils/mime_types_utils.py`
```
import mimetypes
from enum import Enum
from typing import Dict, List


class RecognisedMimeType(str, Enum):
    """Recognized MIME types that LLMs may support."""

    # Images
    JPEG = "image/jpeg"
    PNG = "image/png"
    GIF = "image/gif"
    WEBP = "image/webp"
    SVG = "image/svg+xml"

    # Audio
    MP3 = "audio/mpeg"
    WAV = "audio/wav"
    OGG_AUDIO = "audio/ogg"
    WEBM_AUDIO = "audio/webm"

    # Video
    MP4 = "video/mp4"
    WEBM_VIDEO = "video/webm"
    OGG_VIDEO = "video/ogg"

    # Documents
    PDF = "application/pdf"
    DOC = "application/msword"
    DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    XLS = "application/vnd.ms-excel"
    XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    PPT = "application/vnd.ms-powerpoint"
    PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

    # Text
    PLAIN = "text/plain"
    HTML = "text/html"
    MARKDOWN = "text/markdown"
    CSV = "text/csv"
    XML = "text/xml"
    JSON = "application/json"


class MimeCategory(str, Enum):
    """Categories of MIME types that LLMs may support."""

    IMAGES = "images"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENTS = "documents"
    TEXT = "text"


# Common MIME types by category
MIME_TYPES_BY_CATEGORY: Dict[MimeCategory, List[RecognisedMimeType]] = {
    MimeCategory.IMAGES: [
        RecognisedMimeType.JPEG,
        RecognisedMimeType.PNG,
        RecognisedMimeType.GIF,
        RecognisedMimeType.WEBP,
        RecognisedMimeType.SVG,
    ],
    MimeCategory.AUDIO: [
        RecognisedMimeType.MP3,
        RecognisedMimeType.WAV,
        RecognisedMimeType.OGG_AUDIO,
        RecognisedMimeType.WEBM_AUDIO,
    ],
    MimeCategory.VIDEO: [
        RecognisedMimeType.MP4,
        RecognisedMimeType.WEBM_VIDEO,
        RecognisedMimeType.OGG_VIDEO,
    ],
    MimeCategory.DOCUMENTS: [
        RecognisedMimeType.PDF,
        RecognisedMimeType.DOC,
        RecognisedMimeType.DOCX,
        RecognisedMimeType.XLS,
        RecognisedMimeType.XLSX,
        RecognisedMimeType.PPT,
        RecognisedMimeType.PPTX,
    ],
    MimeCategory.TEXT: [
        RecognisedMimeType.PLAIN,
        RecognisedMimeType.HTML,
        RecognisedMimeType.MARKDOWN,
        RecognisedMimeType.CSV,
        RecognisedMimeType.XML,
        RecognisedMimeType.JSON,
    ],
}


class UnsupportedFileTypeError(Exception):
    """Exception raised when a file type is not supported."""

    pass


def get_mime_type_for_url(url: str) -> RecognisedMimeType:
    """
    Get the MIME type for a given URL.

    Args:
        url (str): The URL to get the MIME type for. This can be a file path, a URL, or a data URI.

    Returns:
        RecognisedMimeType: The MIME type for the URL.
    """
    # Data URI
    if url.startswith("data:"):
        # Data URI
        mime_type = url.split(";")[0].split(":")[1]
        try:
            return RecognisedMimeType(mime_type)
        except ValueError:
            raise UnsupportedFileTypeError(f"Unsupported data URI: {url.split(';')[0]}")

    # File path or URL
    mime_type, _ = mimetypes.guess_type(url)
    if mime_type:
        return RecognisedMimeType(mime_type)
    else:
        raise UnsupportedFileTypeError(f"Unsupported file type: {url}")

```

### Core Architecture Module: `backend/pyspur/utils/path_utils.py`
```
from pathlib import Path

PROJECT_ROOT = Path.cwd()


def is_external_url(url: str) -> bool:
    return url.startswith(("http://", "https://", "gs://"))


def get_test_files_dir() -> Path:
    """Get the directory for test file uploads."""
    test_files_dir = Path.joinpath(PROJECT_ROOT, "data", "test_files")
    test_files_dir.mkdir(parents=True, exist_ok=True)
    return test_files_dir


def resolve_file_path(file_path: str) -> Path | str:
    """
    Resolve a file path relative to the project root.
    Expects paths in format 'data/test_files/S9/20250120_121759_aialy.pdf' and resolves them to
    'data/test_files/S9/20250120_121759_aialy.pdf'
    If the path is an external URL (starts with http:// or https://), returns it as is.
    """
    # Handle external URLs
    if is_external_url(file_path):
        return file_path

    path = Path.joinpath(PROJECT_ROOT, "data", Path(file_path))
    if not path.exists():
        raise FileNotFoundError(f"File not found at expected location: {file_path}")
    return path

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #52** (2024-12-24): **Unhandled Runtime Error  AxiosError: Request failed with status code 502**
  *Symptoms*: after composed and opening the host the runtime error occurs  ![Screenshot 2024-12-18 095410](https://github.com/user-attachments/assets/2f408c64-1fd6-4dd8-9cb6-1f133cb5bc31) 
  **Post-Mortem & Fix Analysis**:
  > Hey @Rishikeswaran-17 thank you for reporting this issue. Can you share the docker logs here as well?
  >  @srijanpatel Im getting the same error here are the on pyspur-nginx-1 logs.   2024-12-18 11:32:10 nginx-1     | 172.20.0.1 - pyspur [18/Dec/2024:17:32:10 +0000] "GET /__nextjs_original-stack-frame?isServer=false&isEdgeServer=false&isAppDirectory=false&errorMessage=AxiosError%3A+Request+failed+with+status+code+422&file=webpack-internal%3A%2F%2F%2F.%2Fnode_modules%2Faxios%2Flib%2Fcore%2Fsettle.js&methodName=settle&arguments=&lineNumber=24&column=12 HTTP/1.1" 200 474 "http://localhost:6080/workflows/S2" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" "-" 2024-12-18 11:32:10 nginx-1     | 172.20.0.1 - pyspur [18/Dec/2024:17:32:10 +0000] "GET /__nextjs_original-stack-frame?isServer=false&isEdgeServer=false&isAppDirectory=false&errorMessage=AxiosError%3A+Request+failed+with+status+code+422&file=webpack-internal%3A%2F%2F%2F.%2Fnode_modules%2Faxios%2Flib%2Fcore%2FAxios.js&methodName=Axios.request&arguments=&lineNumber=
  > @Shubham-Khichi could you also share `pyspur-backend-1` container's logs along with the steps to reproduce this?  Here's what I tried on an ubuntu instance that worked for me: 1. clone the repo to `~/pyspur` 2. run `sudo docker compose up --build` 3. open `http://localhost:6080` in my browser, and enter the username/password given in the README 4. add my `OPENAI_API_KEY` key using the settings modal on the top right corner of the home/dashboard page 5. create a new spur with one `SingleLLMCallNode` node that uses `GPT-4o` 6. run it  It would help me a lot in resolving this issue for you if you could share details like above along with the workflow (you can download this from the header in the workflow view, or from the dashboard as well)  Here's the workflow that i just ran successfully [New_Spur_18_12_2024,_13_12_15.json](https://github.com/user-attachments/files/18187312/New_Spur_18_12_2024._13_12_15.json)  

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

### Incident Patch 1: `94cfba7a` (2025-07-06)
**Commit Message**: fix the error message in SlackSetupGuide.tsx

**File**: `frontend/src/components/slack/SlackSetupGuide.tsx` (modified, +47/-22)
```diff
@@ -1,35 +1,34 @@
 import {
     Accordion,
     AccordionItem,
-    Badge,
     Button,
     Input,
     Modal,
     ModalBody,
     ModalContent,
     ModalFooter,
     ModalHeader,
-    Textarea
 } from '@heroui/react'
 import { Icon as IconifyIcon } from '@iconify/react'
 import { useRouter } from 'next/router'
 import React, { useState } from 'react'
+
 import { setApiKey } from '../../utils/api'
 
 interface SlackSetupGuideProps {
-    onClose: () => void;
-    onConnectClick: () => void;
-    setupInfo?: any;
-    onGoToSettings?: () => void;
-    onTokenConfigured?: () => void;
+    onClose: () => void
+    onConnectClick: () => void
+    setupInfo?: any
+    onGoToSettings?: () => void
+    onTokenConfigured?: () => void
 }
 
 const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
     onClose,
     onConnectClick,
     setupInfo,
     onGoToSettings,
-    onTokenConfigured
+    onTokenConfigured,
 }) => {
     const router = useRouter()
     const [botToken, setBotToken] = useState('')
@@ -77,7 +76,8 @@ const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
                 </ModalHeader>
                 <ModalBody>
                     <p className="mb-4">
-                        Set up Slack integration by providing your Bot Token directly. After configuration, you'll create your first Slack agent.
+                        Set up Slack integration by providing your Bot Token directly. After configuration, you&apos;ll
+                        create your first Slack agent.
                     </p>
 
                     <Accordion>
@@ -96,8 +96,20 @@ const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
                             <div className="pl-8 text-sm space-y-2">
                                 <p>To create a new Slack app:</p>
                                 <ol className="list-decimal list-inside space-y-1 pl-2">
-                                    <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">Slack API Apps page</a></li>
-                                    <li>Click <strong>Create New App</strong> → <strong>From scratch</strong></li>
+                                    <li>
+                                        Go to{' '}
+                                        <a
+                                            href="https://api.slack.com/apps"
+                                            target="_blank"
+                                            rel="noopener noreferrer"
+                                            className="text-primary underline"
+                                        >
+                                            Slack API Apps page
+                                        </a>
+                                    </li>
+                                    <li>
+                                        Click <strong>Create New App</strong> → <strong>From scratch</strong>
+                                    </li>
                                     <li>Name your app (e.g., &quot;PySpur Bot&quot;)</li>
                                     <li>Select the workspace where you want to install the app</li>
                                 </ol>
@@ -119,14 +131,22 @@ const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
                             <div className="pl-8 text-sm space-y-2">
                                 <p>Configure the bot permissions for your app:</p>
                                 <ol className="list-decimal list-inside space-y-1 pl-2">
-                                    <li>In your app settings, go to <strong>OAuth & Permissions</strong></li>
-                                    <li>Under <strong>Bot Token Scopes</strong>, add the following scopes:
+                                    <li>
+                                        In your app settings, go to <strong>OAuth & Permissions</strong>
+                                    </li>
+                                    <li>
+                                        Under <strong>Bot Token Scopes</strong>, add the following scopes:
                                         <div className="bg-default-100 p-2 rounded mt-1 font-mono text-xs">
                                             channels:read, chat:write, team:read, app_mentions:read, im:read, im:history
                                         </div>
                                     </li>
-                                    <li>Click <strong>Install to Workspace</strong> at the top of the page</li>
-                                    <li>After installation, find your <strong>Bot User OAuth Token</strong> (starts with xoxb-)</li>
+                                    <li>
+                                        Click <strong>Install to Workspace</strong> at the top of the page
+                                    </li>
+                                    <li>
+                                        After installation, find y
```

---

### Incident Patch 2: `17c4a9f8` (2025-03-30)
**Commit Message**: Merge pull request #271 from PySpur-Dev/fix/migration-order-010-011

Fix migration orders for slack_agents table

**File**: `backend/pyspur/models/management/alembic/versions/010_add_idx_to_time_cols.py` (renamed, +88/-20)
```diff
@@ -11,68 +11,136 @@
 from alembic import op
 
 # revision identifiers, used by Alembic.
-revision: str = "011"
-down_revision: Union[str, None] = "010"
+revision: str = "010"
+down_revision: Union[str, None] = "009"
 branch_labels: Union[str, Sequence[str], None] = None
 depends_on: Union[str, Sequence[str], None] = None
 
 
 def upgrade() -> None:
     # ### commands auto generated by Alembic - please adjust! ###
-    op.create_index(op.f("ix_datasets_uploaded_at"), "datasets", ["uploaded_at"], unique=False)
+    op.create_index(
+        op.f("ix_datasets_uploaded_at"),
+        "datasets",
+        ["uploaded_at"],
+        unique=False,
+        if_not_exists=True,
+    )
     op.create_index(
         op.f("ix_document_collections_created_at"),
         "document_collections",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_collections_updated_at"),
         "document_collections",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_created_at"),
         "document_processing_progress",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_updated_at"),
         "document_processing_progress",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_eval_runs_start_time"),
+        "eval_runs",
+        ["start_time"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_output_files_created_at"),
+        "output_files",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_output_files_updated_at"),
+        "output_files",
+        ["updated_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False)
-    op.create_index(op.f("ix_eval_runs_start_time"), "eval_runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False)
-    op.create_index(op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_output_files_created_at"), "output_files", ["created_at"], unique=False
+        op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False, if_not_exists=True
     )
     op.create_index(
-        op.f("ix_output_files_updated_at"), "output_files", ["updated_at"], unique=False
+        op.f("ix_users_created_at"), "users", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False)
-    op.create_index(op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False)
-    op.create_index(op.f("ix_users_created_at"), "users", ["created_at"], unique=False)
-    op.create_index(op.f("ix_users_updated_at"), "users", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_vector_indices_created_at"), "vector_indices", ["created_at"], unique=False
+        op.f("ix_users_updated_at"), "users", ["updated_at"], unique=False, if_not_exists=True
     )
     op.create_index(
-        op.f("ix_vector_indices_updated_at"), "vector_indices", ["updated_at"], unique=False
+        op.f("ix_vector_indices_created_at"),
+        "vector_indices",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
     )
     op.create_index(
-        op.f("ix_workflow_versions_created_at"), "workflow_versions", ["created_at"], unique=False
+        op.f("ix_vector_indices_updated_at"),
+        "vector_indices",
+        ["updated_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_workflow_versions_created_at"),
+        "workflow_versions",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
     )
     op.create_index(
-        op.f("ix_workflow_versions_updated_at"), "workflow_versions", ["updated_at"], unique=F
```

**File**: `backend/pyspur/models/management/alembic/versions/010_slack_agent.py` (removed, +0/-52)
```diff
@@ -1,52 +0,0 @@
-"""slack_agent
-
-Revision ID: 010
-Revises: 009
-Create Date: 2025-03-16 15:09:40.938378
-
-"""
-from typing import Sequence, Union
-
-from alembic import op
-import sqlalchemy as sa
-
-
-# revision identifiers, used by Alembic.
-revision: str = '010'
-down_revision: Union[str, None] = '009'
-branch_labels: Union[str, Sequence[str], None] = None
-depends_on: Union[str, Sequence[str], None] = None
-
-
-def upgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.create_table('slack_agents',
-    sa.Column('id', sa.Integer(), nullable=False),
-    sa.Column('name', sa.String(), nullable=True),
-    sa.Column('slack_team_id', sa.String(), nullable=True),
-    sa.Column('slack_team_name', sa.String(), nullable=True),
-    sa.Column('slack_channel_id', sa.String(), nullable=True),
-    sa.Column('slack_channel_name', sa.String(), nullable=True),
-    sa.Column('is_active', sa.Boolean(), nullable=True),
-    sa.Column('workflow_id', sa.String(), nullable=True),
-    sa.Column('trigger_on_mention', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_direct_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_channel_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_keywords', sa.JSON(), nullable=True),
-    sa.Column('trigger_enabled', sa.Boolean(), nullable=True),
-    sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ),
-    sa.PrimaryKeyConstraint('id')
-    )
-    op.create_index(op.f('ix_slack_agents_id'), 'slack_agents', ['id'], unique=False)
-    op.create_index(op.f('ix_slack_agents_name'), 'slack_agents', ['name'], unique=False)
-    op.create_index(op.f('ix_slack_agents_slack_team_id'), 'slack_agents', ['slack_team_id'], unique=False)
-    # ### end Alembic commands ###
-
-
-def downgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.drop_index(op.f('ix_slack_agents_slack_team_id'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_name'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_id'), table_name='slack_agents')
-    op.drop_table('slack_agents')
-    # ### end Alembic commands ###
```

**File**: `backend/pyspur/models/management/alembic/versions/011_slack_agent.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""slack_agent.
+
+Revision ID: 010
+Revises: 009
+Create Date: 2025-03-16 15:09:40.938378
+
+"""
+
+from typing import Sequence, Union
+
+import sqlalchemy as sa
+from alembic import op
+
+# revision identifiers, used by Alembic.
+revision: str = "011"
+down_revision: Union[str, None] = "010"
+branch_labels: Union[str, Sequence[str], None] = None
+depends_on: Union[str, Sequence[str], None] = None
+
+
+def upgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.create_table(
+        "slack_agents",
+        sa.Column("id", sa.Integer(), nullable=False),
+        sa.Column("name", sa.String(), nullable=True),
+        sa.Column("slack_team_id", sa.String(), nullable=True),
+        sa.Column("slack_team_name", sa.String(), nullable=True),
+        sa.Column("slack_channel_id", sa.String(), nullable=True),
+        sa.Column("slack_channel_name", sa.String(), nullable=True),
+        sa.Column("is_active", sa.Boolean(), nullable=True),
+        sa.Column("workflow_id", sa.String(), nullable=True),
+        sa.Column("trigger_on_mention", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_direct_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_channel_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_keywords", sa.JSON(), nullable=True),
+        sa.Column("trigger_enabled", sa.Boolean(), nullable=True),
+        sa.ForeignKeyConstraint(
+            ["workflow_id"],
+            ["workflows.id"],
+        ),
+        sa.PrimaryKeyConstraint("id"),
+    )
+    op.create_index(op.f("ix_slack_agents_id"), "slack_agents", ["id"], unique=False)
+    op.create_index(op.f("ix_slack_agents_name"), "slack_agents", ["name"], unique=False)
+    op.create_index(
+        op.f("ix_slack_agents_slack_team_id"), "slack_agents", ["slack_team_id"], unique=False
+    )
+    # ### end Alembic commands ###
+
+
+def downgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.drop_index(op.f("ix_slack_agents_slack_team_id"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_name"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_id"), table_name="slack_agents")
+    op.drop_table("slack_agents")
+    # ### end Alembic commands ###
```

---

### Incident Patch 3: `4fc5374f` (2025-03-30)
**Commit Message**: fix: 010 & 011 migration orders

**File**: `backend/pyspur/models/management/alembic/versions/010_add_idx_to_time_cols.py` (renamed, +88/-20)
```diff
@@ -11,68 +11,136 @@
 from alembic import op
 
 # revision identifiers, used by Alembic.
-revision: str = "011"
-down_revision: Union[str, None] = "010"
+revision: str = "010"
+down_revision: Union[str, None] = "009"
 branch_labels: Union[str, Sequence[str], None] = None
 depends_on: Union[str, Sequence[str], None] = None
 
 
 def upgrade() -> None:
     # ### commands auto generated by Alembic - please adjust! ###
-    op.create_index(op.f("ix_datasets_uploaded_at"), "datasets", ["uploaded_at"], unique=False)
+    op.create_index(
+        op.f("ix_datasets_uploaded_at"),
+        "datasets",
+        ["uploaded_at"],
+        unique=False,
+        if_not_exists=True,
+    )
     op.create_index(
         op.f("ix_document_collections_created_at"),
         "document_collections",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_collections_updated_at"),
         "document_collections",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_created_at"),
         "document_processing_progress",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_updated_at"),
         "document_processing_progress",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_eval_runs_start_time"),
+        "eval_runs",
+        ["start_time"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_output_files_created_at"),
+        "output_files",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_output_files_updated_at"),
+        "output_files",
+        ["updated_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False)
-    op.create_index(op.f("ix_eval_runs_start_time"), "eval_runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False)
-    op.create_index(op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_output_files_created_at"), "output_files", ["created_at"], unique=False
+        op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False, if_not_exists=True
     )
     op.create_index(
-        op.f("ix_output_files_updated_at"), "output_files", ["updated_at"], unique=False
+        op.f("ix_users_created_at"), "users", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False)
-    op.create_index(op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False)
-    op.create_index(op.f("ix_users_created_at"), "users", ["created_at"], unique=False)
-    op.create_index(op.f("ix_users_updated_at"), "users", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_vector_indices_created_at"), "vector_indices", ["created_at"], unique=False
+        op.f("ix_users_updated_at"), "users", ["updated_at"], unique=False, if_not_exists=True
     )
     op.create_index(
-        op.f("ix_vector_indices_updated_at"), "vector_indices", ["updated_at"], unique=False
+        op.f("ix_vector_indices_created_at"),
+        "vector_indices",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
     )
     op.create_index(
-        op.f("ix_workflow_versions_created_at"), "workflow_versions", ["created_at"], unique=False
+        op.f("ix_vector_indices_updated_at"),
+        "vector_indices",
+        ["updated_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_workflow_versions_created_at"),
+        "workflow_versions",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
     )
     op.create_index(
-        op.f("ix_workflow_versions_updated_at"), "workflow_versions", ["updated_at"], unique=F
```

**File**: `backend/pyspur/models/management/alembic/versions/010_slack_agent.py` (removed, +0/-52)
```diff
@@ -1,52 +0,0 @@
-"""slack_agent
-
-Revision ID: 010
-Revises: 009
-Create Date: 2025-03-16 15:09:40.938378
-
-"""
-from typing import Sequence, Union
-
-from alembic import op
-import sqlalchemy as sa
-
-
-# revision identifiers, used by Alembic.
-revision: str = '010'
-down_revision: Union[str, None] = '009'
-branch_labels: Union[str, Sequence[str], None] = None
-depends_on: Union[str, Sequence[str], None] = None
-
-
-def upgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.create_table('slack_agents',
-    sa.Column('id', sa.Integer(), nullable=False),
-    sa.Column('name', sa.String(), nullable=True),
-    sa.Column('slack_team_id', sa.String(), nullable=True),
-    sa.Column('slack_team_name', sa.String(), nullable=True),
-    sa.Column('slack_channel_id', sa.String(), nullable=True),
-    sa.Column('slack_channel_name', sa.String(), nullable=True),
-    sa.Column('is_active', sa.Boolean(), nullable=True),
-    sa.Column('workflow_id', sa.String(), nullable=True),
-    sa.Column('trigger_on_mention', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_direct_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_channel_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_keywords', sa.JSON(), nullable=True),
-    sa.Column('trigger_enabled', sa.Boolean(), nullable=True),
-    sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ),
-    sa.PrimaryKeyConstraint('id')
-    )
-    op.create_index(op.f('ix_slack_agents_id'), 'slack_agents', ['id'], unique=False)
-    op.create_index(op.f('ix_slack_agents_name'), 'slack_agents', ['name'], unique=False)
-    op.create_index(op.f('ix_slack_agents_slack_team_id'), 'slack_agents', ['slack_team_id'], unique=False)
-    # ### end Alembic commands ###
-
-
-def downgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.drop_index(op.f('ix_slack_agents_slack_team_id'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_name'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_id'), table_name='slack_agents')
-    op.drop_table('slack_agents')
-    # ### end Alembic commands ###
```

**File**: `backend/pyspur/models/management/alembic/versions/011_slack_agent.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""slack_agent.
+
+Revision ID: 010
+Revises: 009
+Create Date: 2025-03-16 15:09:40.938378
+
+"""
+
+from typing import Sequence, Union
+
+import sqlalchemy as sa
+from alembic import op
+
+# revision identifiers, used by Alembic.
+revision: str = "011"
+down_revision: Union[str, None] = "010"
+branch_labels: Union[str, Sequence[str], None] = None
+depends_on: Union[str, Sequence[str], None] = None
+
+
+def upgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.create_table(
+        "slack_agents",
+        sa.Column("id", sa.Integer(), nullable=False),
+        sa.Column("name", sa.String(), nullable=True),
+        sa.Column("slack_team_id", sa.String(), nullable=True),
+        sa.Column("slack_team_name", sa.String(), nullable=True),
+        sa.Column("slack_channel_id", sa.String(), nullable=True),
+        sa.Column("slack_channel_name", sa.String(), nullable=True),
+        sa.Column("is_active", sa.Boolean(), nullable=True),
+        sa.Column("workflow_id", sa.String(), nullable=True),
+        sa.Column("trigger_on_mention", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_direct_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_channel_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_keywords", sa.JSON(), nullable=True),
+        sa.Column("trigger_enabled", sa.Boolean(), nullable=True),
+        sa.ForeignKeyConstraint(
+            ["workflow_id"],
+            ["workflows.id"],
+        ),
+        sa.PrimaryKeyConstraint("id"),
+    )
+    op.create_index(op.f("ix_slack_agents_id"), "slack_agents", ["id"], unique=False)
+    op.create_index(op.f("ix_slack_agents_name"), "slack_agents", ["name"], unique=False)
+    op.create_index(
+        op.f("ix_slack_agents_slack_team_id"), "slack_agents", ["slack_team_id"], unique=False
+    )
+    # ### end Alembic commands ###
+
+
+def downgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.drop_index(op.f("ix_slack_agents_slack_team_id"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_name"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_id"), table_name="slack_agents")
+    op.drop_table("slack_agents")
+    # ### end Alembic commands ###
```

---

### Incident Patch 4: `3d5dbe63` (2025-03-26)
**Commit Message**: refactor: comment out MCP Tools tab in ToolsPage component to prevent rendering

**File**: `frontend/src/pages/tools.tsx` (modified, +2/-3)
```diff
@@ -3,7 +3,6 @@ import React, { useEffect } from 'react'
 import { useDispatch, useSelector } from 'react-redux'
 
 import Header from '../components/Header'
-import MCPTools from '../components/MCPTools'
 import SpecTools from '../components/SpecTools'
 import StockTools from '../components/StockTools'
 import { fetchNodeTypes } from '../store/nodeTypesSlice'
@@ -89,11 +88,11 @@ const ToolsPage: React.FC = () => {
                             <SpecTools />
                         </div>
                     </Tab>
-                    <Tab key="mcp" title="MCP Tools">
+                    {/* <Tab key="mcp" title="MCP Tools">
                         <div className="py-4">
                             <MCPTools />
                         </div>
-                    </Tab>
+                    </Tab> */}
                 </Tabs>
             </div>
         </div>
```

---

### Incident Patch 5: `529aa22a` (2025-03-26)
**Commit Message**: fix: linter errors

**File**: `backend/pyspur/api/slack_management.py` (modified, +1/-1)
```diff
@@ -626,7 +626,7 @@ async def send_message(
                 "message": f"Error sending message to Slack: {str(e)}",
                 "success": False,
             },
-        )
+        ) from e
 
 
 @router.post("/test-message", response_model=SlackMessageResponse)
```

**File**: `backend/pyspur/integrations/slack/socket_client.py` (modified, +14/-12)
```diff
@@ -1,3 +1,4 @@
+# type: ignore
 import asyncio
 import logging
 import os
@@ -22,6 +23,7 @@
 
 class SocketModeClient:
     """Client for handling Slack Socket Mode connections.
+
     This manages real-time event processing from Slack.
     """
 
@@ -57,7 +59,7 @@ def __init__(self):
         logger.info("SocketModeClient initialized")
 
     def set_workflow_trigger_callback(self, callback: Callable[..., Any]):
-        """Set the callback function to be called when a workflow should be triggered
+        """Set the callback function to be called when a workflow should be triggered.
 
         The callback can be either a regular function or an async coroutine function.
         If it's a coroutine function, it will be properly awaited when called.
@@ -68,7 +70,7 @@ def set_workflow_trigger_callback(self, callback: Callable[..., Any]):
         logger.info(f"Setting workflow trigger callback. Is async: {is_async}")
 
     def _register_event_handlers(self, app: App, agent_id: int):
-        """Register event handlers for the Slack app"""
+        """Register event handlers for the Slack app."""
 
         @app.event("app_mention")
         def handle_app_mention(
@@ -116,7 +118,7 @@ def _process_event(
         say: Callable,
         client=None,
     ):
-        """Process a Slack event and trigger workflows if appropriate"""
+        """Process a Slack event and trigger workflows if appropriate."""
         # Add diagnostics about the event
         logger.info(f"Received {event_type} event for agent {agent_id}")
         logger.info(f"Current blacklist: {self._blacklisted_agents}")
@@ -217,7 +219,7 @@ def _process_event(
             db.close()
 
     def start_socket_mode(self, agent_id: int) -> bool:
-        """Start socket mode for a Slack agent"""
+        """Start socket mode for a Slack agent."""
         logger.info(f"Starting socket mode for agent {agent_id}")
 
         # First make sure any existing socket is stopped
@@ -296,13 +298,13 @@ def start_socket_mode(self, agent_id: int) -> bool:
 
                 # Manually store the installation data for this workspace
                 # Get bot info to retrieve the bot_id, bot_user_id, and team_id
-                bot_info_response = app.client.auth_test()
+                bot_info_response = app.client.auth_test()  # type: ignore
                 if not bot_info_response["ok"]:
                     logger.error(f"Failed to get bot info: {bot_info_response['error']}")
                     return False
 
-                team_id = bot_info_response["team_id"]
-                bot_user_id = bot_info_response["user_id"]
+                team_id = str(bot_info_response["team_id"])  # type: ignore
+                bot_user_id = str(bot_info_response["user_id"])  # type: ignore
 
                 # Create and store installation data
                 installation = Installation(
@@ -359,7 +361,7 @@ def start_socket_mode(self, agent_id: int) -> bool:
             db.close()
 
     def stop_socket_mode(self, agent_id: int) -> bool:
-        """Stop Socket Mode for a specific agent"""
+        """Stop Socket Mode for a specific agent."""
         logger.info(f"Stopping Socket Mode for agent {agent_id}")
 
         # Add agent to blacklist to reject any incoming events
@@ -544,7 +546,7 @@ def stop_socket_mode(self, agent_id: int) -> bool:
             return False
 
     def _try_aggressive_thread_termination(self, agent_id: int, handler: Any) -> None:
-        """Attempt to aggressively terminate any threads or tasks associated with the socket handler"""
+        """Attempt to aggressively terminate any threads or tasks associated with the socket handler."""
         try:
             # See if the socket handler has a thread running and try to terminate it
             if hasattr(handler, "thread") and handler.thread:
@@ -591,11 +593,11 @@ def _try_aggressive_thread_termination(self, agent_id: int, handler: Any) -> Non
             logger.error(f"Error with aggressive thread termination for agent {agent_id}: {e}")
 
     def is_running(self, agent_id: int) -> bool:
-        """Check if Socket Mode is running for a specific agent"""
+        """Check if Socket Mode is running for a specific agent."""
         return agent_id in self._socket_mode_handlers
 
     def stop_all(self):
-        """Stop all Socket Mode handlers"""
+        """Stop all Socket Mode handlers."""
         logger.info("Stopping all Socket Mode handlers")
 
         agent_ids = list(self._socket_mode_handlers.keys())
@@ -695,5 +697,5 @@ def _forcibly_disconnect_slack_sessions(self, agent_id: int) -> None:
 
 # Singleton instance accessor
 def get_socket_mode_client() -> SocketModeClient:
-    """Get the singleton SocketModeClient instance"""
+    """Get the singleton SocketModeClient instance."""
     return SocketModeClient()
```

**File**: `backend/pyspur/integrations/slack/socket_worker.py` (modified, +4/-3)
```diff
@@ -1,5 +1,6 @@
 #!/usr/bin/env python
 """Worker process for handling a single Slack Socket Mode connection.
+
 This runs in a separate process managed by the SocketManager.
 """
 
@@ -25,7 +26,7 @@
 
 
 def get_active_agents(db: Session) -> list[SlackAgentModel]:
-    """Get all active agents that have socket mode enabled"""
+    """Get all active agents that have socket mode enabled."""
     agents = (
         db.query(SlackAgentModel)
         .filter_by(
@@ -38,7 +39,7 @@ def get_active_agents(db: Session) -> list[SlackAgentModel]:
 
 
 def setup_shutdown_handler(socket_client: SocketModeClient, agent_id: int):
-    """Set up signal handlers for graceful shutdown"""
+    """Set up signal handlers for graceful shutdown."""
 
     def handle_shutdown(signum: int, frame: Optional[types.FrameType]) -> None:
         logger.info(f"Worker {agent_id} received signal {signum}, shutting down")
@@ -50,7 +51,7 @@ def handle_shutdown(signum: int, frame: Optional[types.FrameType]) -> None:
 
 
 async def check_agent_status(db: Session, agent_id: int) -> bool:
-    """Check if the agent is still active and should be running
+    """Check if the agent is still active and should be running.
 
     Args:
         db: Database session
```

**File**: `backend/pyspur/models/slack_agent_model.py` (modified, +0/-2)
```diff
@@ -6,8 +6,6 @@
 from sqlalchemy.orm import relationship
 
 from .base_model import BaseModel
-from .workflow_model import WorkflowModel  # noqa: F401
-from .workflow_version_model import WorkflowVersionModel  # noqa: F401
 
 
 class SlackAgentModel(BaseModel):
```

---

### Incident Patch 6: `a8155267` (2025-03-26)
**Commit Message**: fix: comment out MCP Tools tab in ToolsPage component to prevent rendering

**File**: `frontend/src/pages/tools.tsx` (modified, +2/-2)
```diff
@@ -89,11 +89,11 @@ const ToolsPage: React.FC = () => {
                             <SpecTools onSpecCreated={handleEndpointsSelected} />
                         </div>
                     </Tab>
-                    <Tab key="mcp" title="MCP Tools">
+                    {/* <Tab key="mcp" title="MCP Tools">
                         <div className="py-4">
                             <MCPTools />
                         </div>
-                    </Tab>
+                    </Tab> */}
                 </Tabs>
             </div>
         </div>
```

---

### Incident Patch 7: `4860a453` (2025-03-26)
**Commit Message**: fix: more linter errors

**File**: `backend/pyspur/api/slack_management.py` (modified, +25/-25)
```diff
@@ -129,14 +129,14 @@ def handle_socket_mode_event_sync(
     say: Callable[..., Any],
     client: Optional[WebClient] = None,
 ):
-    """Synchronous wrapper for handle_socket_mode_event to be used in threaded contexts"""
+    """Synchronous wrapper for handle_socket_mode_event to be used in threaded contexts."""
     # Return the coroutine object without awaiting it
     # The socket client will handle awaiting it appropriately
     return handle_socket_mode_event(trigger_request, agent_id, say, client)
 
 
 async def _get_active_agent(db: Session, agent_id: int) -> Optional[SlackAgentModel]:
-    """Get an active agent with workflow configured"""
+    """Get an active agent with workflow configured."""
     agent = (
         db.query(SlackAgentModel)
         .filter(
@@ -400,7 +400,7 @@ async def _send_workflow_results_to_slack(
 
 @router.get("/agents", response_model=List[SlackAgentResponse])
 async def get_agents(db: Session = Depends(get_db)) -> List[SlackAgentResponse]:
-    """Get all configured Slack agents"""
+    """Get all configured Slack agents."""
     agents = db.query(SlackAgentModel).all()
     agent_responses: List[SlackAgentResponse] = []
 
@@ -413,7 +413,7 @@ async def get_agents(db: Session = Depends(get_db)) -> List[SlackAgentResponse]:
 
 
 def _get_nullable_str(value: Any) -> Optional[str]:
-    """Helper to safely convert nullable SQLAlchemy column to string"""
+    """Helper to safely convert nullable SQLAlchemy column to string."""
     return str(value) if value is not None else None
 
 
@@ -452,7 +452,7 @@ def _agent_to_response_model(agent: SlackAgentModel) -> SlackAgentResponse:
 
 @router.post("/agents", response_model=SlackAgentResponse)
 async def create_agent(agent_create: SlackAgentCreate, db: Session = Depends(get_db)):
-    """Create a new Slack agent configuration"""
+    """Create a new Slack agent configuration."""
     # Ensure workflow_id is provided
     if not agent_create.workflow_id:
         raise HTTPException(
@@ -491,7 +491,7 @@ async def create_agent(agent_create: SlackAgentCreate, db: Session = Depends(get
 
 @router.get("/agents/{agent_id}", response_model=SlackAgentResponse)
 async def get_agent(agent_id: int, db: Session = Depends(get_db)):
-    """Get a Slack agent configuration"""
+    """Get a Slack agent configuration."""
     agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
     if agent is None:
         raise HTTPException(status_code=404, detail="Agent not found")
@@ -502,7 +502,7 @@ async def get_agent(agent_id: int, db: Session = Depends(get_db)):
 
 @router.post("/agents/{agent_id}/send-message", response_model=SlackMessageResponse)
 async def send_agent_message(agent_id: int, message: SlackMessage, db: Session = Depends(get_db)):
-    """Send a message to a channel using the Slack agent"""
+    """Send a message to a channel using the Slack agent."""
     agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
     if agent is None:
         raise HTTPException(status_code=404, detail="Agent not found")
@@ -550,7 +550,7 @@ async def send_agent_message(agent_id: int, message: SlackMessage, db: Session =
                 "message": f"Error sending message to Slack: {str(e)}",
                 "success": False,
             },
-        )
+        ) from e
 
 
 @router.post("/send-message", response_model=SlackMessageResponse)
@@ -636,7 +636,7 @@ async def test_message(
     agent_id: Optional[int] = None,
     db: Session = Depends(get_db),
 ) -> Dict[str, Any]:
-    """Test sending a message to a Slack channel"""
+    """Test sending a message to a Slack channel."""
     try:
         # Attempt to send the test message using the Slack client
         response = await send_message(channel=channel, text=text, agent_id=agent_id, db=db)
@@ -650,7 +650,7 @@ async def test_message(
 async def associate_workflow(
     agent_id: int, association: WorkflowAssociation, db: Session = Depends(get_db)
 ):
-    """Associate a workflow with a Slack agent"""
+    """Associate a workflow with a Slack agent."""
     agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
     if agent is None:
         raise HTTPException(status_code=404, detail="Agent not found")
@@ -667,7 +667,7 @@ async def associate_workflow(
 async def update_trigger_config(
     agent_id: int, config: SlackTriggerConfig, db: Session = Depends(get_db)
 ):
-    """Update the trigger configuration for a Slack agent"""
+    """Update the trigger configuration for a Slack agent."""
     agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
     if agent is None:
         raise HTTPException(status_code=404, detail="Agent not found")
@@ -751,7 +751,7 @@ async def trigger_workflow(
     background_tasks: BackgroundTasks,
     db: Session = Depends(get_db),
 ):
-    """Trigger workflows based on a Slack event"""
+    """Trigger workflows based on a Slack event."""
     result = Workf
```

---

### Incident Patch 8: `0e521b72` (2025-03-26)
**Commit Message**: fix:  remaining  linter errors

**File**: `backend/pyspur/api/slack_management.py` (modified, +9/-5)
```diff
@@ -916,8 +916,8 @@ async def set_agent_token(
         # Try to get team information when setting a bot token
         try:
             client = AsyncWebClient(token=token_request.token)
-            response: AsyncSlackResponse = await client.auth_test()
-            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}
+            response: AsyncSlackResponse = await client.auth_test()  # type: ignore
+            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}  # type: ignore
             if response_data.get("ok"):
                 team_id = str(response_data.get("team_id", ""))
                 team_name = str(response_data.get("team", ""))
@@ -1391,9 +1391,10 @@ async def test_connection(agent_id: int, db: Session = Depends(get_db)):
 
         # Test the token by calling auth.test
         client = AsyncWebClient(token=bot_token)
+
         try:
-            response: AsyncSlackResponse = await client.auth_test()
-            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}
+            response: AsyncSlackResponse = await client.auth_test()  # type: ignore
+            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}  # type: ignore
             if response_data.get("ok"):
                 team = str(response_data.get("team", "Unknown workspace"))
                 team_id = str(response_data.get("team_id", ""))
@@ -1418,7 +1419,10 @@ async def test_connection(agent_id: int, db: Session = Depends(get_db)):
             else:
                 return {
                     "success": False,
-                    "message": f"API call succeeded but returned not OK: {response_data.get('error', 'Unknown error')}",
+                    "message": (
+                        f"API call succeeded but returned not OK: "
+                        f"{response_data.get('error', 'Unknown error')}"
+                    ),
                 }
         except SlackApiError as e:
             error_response = cast(Dict[str, Any], getattr(e, "response", {}))
```

---

### Incident Patch 9: `fd469ed2` (2025-03-25)
**Commit Message**: Merge pull request #267 from PySpur-Dev/fix/ollama-models

v0.1.17

**File**: `backend/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "pyspur"
-version = "0.1.16"
+version = "0.1.17"
 description = "PySpur is a Graph UI for building AI Agents in Python"
 requires-python = ">=3.11"
 license = "Apache-2.0"
```

**File**: `backend/pyspur/nodes/llm/_utils.py` (modified, +0/-8)
```diff
@@ -558,21 +558,13 @@ async def ollama_with_backoff(
 
     """
     client = AsyncClient(host=api_base)
-    print("=== Ollama Configuration ===")
-    print(f"Model: '{model}' '{model.replace('ollama/', '')}'")
-    print(f"API Base: {api_base}")
-    print(f"Messages: {messages}")
-    print(f"Format: {format}")
-    print(f"Options: {options}")
     try:
         response = await client.chat(
             model=model.replace("ollama/", ""),
             messages=messages,
             format=format,
             options=(options or OllamaOptions()).to_dict(),
         )
-        print("=== Ollama Response ===")
-        print(f"Response: {response}")
         return response.message.content
     except Exception as e:
         logging.error(f"Error calling Ollama API: {e}")
```

---

### Incident Patch 10: `999da197` (2025-03-25)
**Commit Message**: refactor: remove debug print statements from ollama_with_backoff function

**File**: `backend/pyspur/nodes/llm/_utils.py` (modified, +0/-8)
```diff
@@ -558,21 +558,13 @@ async def ollama_with_backoff(
 
     """
     client = AsyncClient(host=api_base)
-    print("=== Ollama Configuration ===")
-    print(f"Model: '{model}' '{model.replace('ollama/', '')}'")
-    print(f"API Base: {api_base}")
-    print(f"Messages: {messages}")
-    print(f"Format: {format}")
-    print(f"Options: {options}")
     try:
         response = await client.chat(
             model=model.replace("ollama/", ""),
             messages=messages,
             format=format,
             options=(options or OllamaOptions()).to_dict(),
         )
-        print("=== Ollama Response ===")
-        print(f"Response: {response}")
         return response.message.content
     except Exception as e:
         logging.error(f"Error calling Ollama API: {e}")
```

---

### Incident Patch 11: `2ca3a2bc` (2025-03-25)
**Commit Message**: Merge pull request #266 from PySpur-Dev/fix/ollama-models

Fix/ollama models

**File**: `backend/pyspur/nodes/llm/_model_info.py` (modified, +64/-22)
```diff
@@ -122,10 +122,16 @@ class LLMModels(str, Enum):
     OLLAMA_DEEPSEEK_R1 = "ollama/deepseek-r1"
     OLLAMA_PHI4 = "ollama/phi4"
     OLLAMA_LLAMA3_3_70B = "ollama/llama3.3:70b"
-    OLLAMA_LLAMA3_3_8B = "ollama/llama3.3:8b"
-    OLLAMA_LLAMA3_2_8B = "ollama/llama3.2:8b"
+    OLLAMA_LLAMA3_2_3B = "ollama/llama3.2:3b"
     OLLAMA_LLAMA3_2_1B = "ollama/llama3.2:1b"
-    OLLAMA_LLAMA3_8B = "ollama/llama3"
+    OLLAMA_LLAMA3_1_8B = "ollama/llama3.1:8b"
+    OLLAMA_LLAMA3_1_70B = "ollama/llama3.1:70b"
+    OLLAMA_LLAMA3_8B = "ollama/llama3:8b"
+    OLLAMA_LLAMA3_70B = "ollama/llama3:70b"
+    OLLAMA_GEMMA_3_1B = "ollama/gemma3:1b"
+    OLLAMA_GEMMA_3_4B = "ollama/gemma3:4b"
+    OLLAMA_GEMMA_3_12B = "ollama/gemma3:12b"
+    OLLAMA_GEMMA_3_27B = "ollama/gemma3:27b"
     OLLAMA_GEMMA_2 = "ollama/gemma2"
     OLLAMA_GEMMA_2_2B = "ollama/gemma2:2b"
     OLLAMA_MISTRAL = "ollama/mistral"
@@ -429,67 +435,103 @@ def get_model_info(cls, model_id: str) -> LLMModel | None:
                 id=cls.OLLAMA_PHI4.value,
                 provider=LLMProvider.OLLAMA,
                 name="Phi 4",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
             ),
             cls.OLLAMA_LLAMA3_3_70B.value: LLMModel(
                 id=cls.OLLAMA_LLAMA3_3_70B.value,
                 provider=LLMProvider.OLLAMA,
                 name="Llama 3.3 (70B)",
                 constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
             ),
-            cls.OLLAMA_LLAMA3_3_8B.value: LLMModel(
-                id=cls.OLLAMA_LLAMA3_3_8B.value,
+            cls.OLLAMA_LLAMA3_2_3B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_2_3B.value,
                 provider=LLMProvider.OLLAMA,
-                name="Llama 3.3 (8B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
-            ),
-            cls.OLLAMA_LLAMA3_2_8B.value: LLMModel(
-                id=cls.OLLAMA_LLAMA3_2_8B.value,
-                provider=LLMProvider.OLLAMA,
-                name="Llama 3.2 (8B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                name="Llama 3.2 (3B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
             ),
             cls.OLLAMA_LLAMA3_2_1B.value: LLMModel(
                 id=cls.OLLAMA_LLAMA3_2_1B.value,
                 provider=LLMProvider.OLLAMA,
                 name="Llama 3.2 (1B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_LLAMA3_1_8B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_1_8B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Llama 3.1 (8B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_LLAMA3_1_70B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_1_70B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Llama 3.1 (70B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
             ),
             cls.OLLAMA_LLAMA3_8B.value: LLMModel(
                 id=cls.OLLAMA_LLAMA3_8B.value,
                 provider=LLMProvider.OLLAMA,
                 name="Llama 3 (8B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_LLAMA3_70B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_70B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Llama 3 (70B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_GEMMA_3_1B.value: LLMModel(
+                id=cls.OLLAMA_GEMMA_3_1B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Gemma 3 (1B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_GEMMA_3_4B.value: LLMModel(
+                id=cls.OLLAMA_GEMMA_3_4B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Gemma 3 (4B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_GEMMA_3_12B.value: LLMModel(
+                id=cls.OLLAMA_GEMMA_3_12B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Gemma 3 (
```

**File**: `backend/pyspur/nodes/llm/_utils.py` (modified, +35/-10)
```diff
@@ -422,9 +422,22 @@ async def generate_text(
         if model_name.startswith("ollama"):
             if api_base is None:
                 api_base = os.getenv("OLLAMA_BASE_URL")
-            kwargs["api_base"] = api_base
-        message_response: Message = await completion_with_backoff(**kwargs)
-        response = message_response.content
+            options = OllamaOptions(temperature=temperature, max_tokens=max_tokens)
+            raw_response = await ollama_with_backoff(
+                model=model_name,
+                options=options,
+                messages=messages,
+                format="json",
+                api_base=api_base,
+            )
+            response = raw_response
+            message_response = Message(
+                content=json.dumps(raw_response),
+                tool_calls=[],
+            )
+        else:
+            message_response: Message = await completion_with_backoff(**kwargs)
+            response = message_response.content
 
     # For models that don't support JSON output, wrap the response in a JSON structure
     if not supports_json:
@@ -545,13 +558,25 @@ async def ollama_with_backoff(
 
     """
     client = AsyncClient(host=api_base)
-    response = await client.chat(
-        model=model.replace("ollama/", ""),
-        messages=messages,
-        format=format,
-        options=(options or OllamaOptions()).to_dict(),
-    )
-    return response.message.content
+    print("=== Ollama Configuration ===")
+    print(f"Model: '{model}' '{model.replace('ollama/', '')}'")
+    print(f"API Base: {api_base}")
+    print(f"Messages: {messages}")
+    print(f"Format: {format}")
+    print(f"Options: {options}")
+    try:
+        response = await client.chat(
+            model=model.replace("ollama/", ""),
+            messages=messages,
+            format=format,
+            options=(options or OllamaOptions()).to_dict(),
+        )
+        print("=== Ollama Response ===")
+        print(f"Response: {response}")
+        return response.message.content
+    except Exception as e:
+        logging.error(f"Error calling Ollama API: {e}")
+        raise e
 
 
 def convert_docx_to_xml(file_path: str) -> str:
```

---

### Incident Patch 12: `7fe5c86d` (2025-03-25)
**Commit Message**: fix: use ollama even when json mode isn't supported

**File**: `backend/pyspur/nodes/llm/_utils.py` (modified, +35/-10)
```diff
@@ -422,9 +422,22 @@ async def generate_text(
         if model_name.startswith("ollama"):
             if api_base is None:
                 api_base = os.getenv("OLLAMA_BASE_URL")
-            kwargs["api_base"] = api_base
-        message_response: Message = await completion_with_backoff(**kwargs)
-        response = message_response.content
+            options = OllamaOptions(temperature=temperature, max_tokens=max_tokens)
+            raw_response = await ollama_with_backoff(
+                model=model_name,
+                options=options,
+                messages=messages,
+                format="json",
+                api_base=api_base,
+            )
+            response = raw_response
+            message_response = Message(
+                content=json.dumps(raw_response),
+                tool_calls=[],
+            )
+        else:
+            message_response: Message = await completion_with_backoff(**kwargs)
+            response = message_response.content
 
     # For models that don't support JSON output, wrap the response in a JSON structure
     if not supports_json:
@@ -545,13 +558,25 @@ async def ollama_with_backoff(
 
     """
     client = AsyncClient(host=api_base)
-    response = await client.chat(
-        model=model.replace("ollama/", ""),
-        messages=messages,
-        format=format,
-        options=(options or OllamaOptions()).to_dict(),
-    )
-    return response.message.content
+    print("=== Ollama Configuration ===")
+    print(f"Model: '{model}' '{model.replace('ollama/', '')}'")
+    print(f"API Base: {api_base}")
+    print(f"Messages: {messages}")
+    print(f"Format: {format}")
+    print(f"Options: {options}")
+    try:
+        response = await client.chat(
+            model=model.replace("ollama/", ""),
+            messages=messages,
+            format=format,
+            options=(options or OllamaOptions()).to_dict(),
+        )
+        print("=== Ollama Response ===")
+        print(f"Response: {response}")
+        return response.message.content
+    except Exception as e:
+        logging.error(f"Error calling Ollama API: {e}")
+        raise e
 
 
 def convert_docx_to_xml(file_path: str) -> str:
```

---

### Incident Patch 13: `6db05553` (2025-03-25)
**Commit Message**: fix: linter errors

**File**: `backend/pyspur/api/slack_management.py` (modified, +74/-102)
```diff
@@ -4,8 +4,9 @@
 import traceback
 from contextlib import asynccontextmanager
 from datetime import UTC, datetime
-from typing import Any, Callable, Dict, List, Optional, TypeVar, cast
+from typing import Any, Callable, Dict, List, Optional, TypeVar, Union, cast
 
+import psutil
 from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, HTTPException, Request
 from loguru import logger
 from slack_sdk import WebClient
@@ -56,6 +57,9 @@
 # Add these type annotations to better handle slack_sdk method calls
 from slack_sdk.web.client import WebClient
 
+# Define auth test response type
+AuthTestResponse = Dict[str, str]
+
 
 def _validate_agent_socket_mode(
     db: Session, agent_id: int, say_callback: Optional[Callable[..., Any]] = None
@@ -183,10 +187,10 @@ async def _should_trigger_workflow(
             and trigger_request.event_data.get("channel_type") != "im"
         ):
             # For channel messages, we need to check for keywords
-            keywords = agent.trigger_keywords
+            keywords = getattr(agent, "trigger_keywords", []) or []
             if isinstance(keywords, list):
                 str_keywords: List[str] = []
-                for item in keywords:
+                for item in cast(List[Union[str, None]], keywords):
                     if item is not None:
                         str_keywords.append(str(item))
                 if str_keywords:
@@ -227,7 +231,7 @@ async def _trigger_workflow(
         background_tasks = BackgroundTasks()
         run = await start_workflow_run(
             db=db,
-            workflow_id=cast(str, agent.workflow_id),
+            workflow_id=str(getattr(agent, "workflow_id", "") or ""),
             run_input=run_input,
             background_tasks=background_tasks,
         )
@@ -410,10 +414,14 @@ async def get_agents(db: Session = Depends(get_db)) -> List[SlackAgentResponse]:
     return agent_responses
 
 
+def _get_nullable_str(value: Any) -> Optional[str]:
+    """Helper to safely convert nullable SQLAlchemy column to string"""
+    return str(value) if value is not None else None
+
+
 # Helper function to convert a SlackAgentModel to a SlackAgentResponse
 def _agent_to_response_model(agent: SlackAgentModel) -> SlackAgentResponse:
     """Convert a SlackAgentModel to a SlackAgentResponse with proper type handling."""
-    # Safe conversion for SQLAlchemy Column types
     try:
         agent_id = int(str(agent.id))
     except (TypeError, ValueError):
@@ -423,31 +431,21 @@ def _agent_to_response_model(agent: SlackAgentModel) -> SlackAgentResponse:
     agent_dict = {
         "id": agent_id,
         "name": str(agent.name),
-        "slack_team_id": str(agent.slack_team_id) if agent.slack_team_id is not None else None,
-        "slack_team_name": str(agent.slack_team_name)
-        if agent.slack_team_name is not None
-        else None,
-        "slack_channel_id": str(agent.slack_channel_id)
-        if agent.slack_channel_id is not None
-        else None,
-        "slack_channel_name": str(agent.slack_channel_name)
-        if agent.slack_channel_name is not None
-        else None,
+        "slack_team_id": _get_nullable_str(agent.slack_team_id),
+        "slack_team_name": _get_nullable_str(agent.slack_team_name),
+        "slack_channel_id": _get_nullable_str(agent.slack_channel_id),
+        "slack_channel_name": _get_nullable_str(agent.slack_channel_name),
         "is_active": bool(agent.is_active),
-        "workflow_id": str(agent.workflow_id) if agent.workflow_id is not None else None,
+        "workflow_id": _get_nullable_str(agent.workflow_id),
         "trigger_on_mention": bool(agent.trigger_on_mention),
         "trigger_on_direct_message": bool(agent.trigger_on_direct_message),
         "trigger_on_channel_message": bool(agent.trigger_on_channel_message),
-        "trigger_keywords": [str(k) for k in agent.trigger_keywords]
-        if agent.trigger_keywords is not None
-        else None,
+        "trigger_keywords": [str(k) for k in getattr(agent, "trigger_keywords", []) or []],
         "trigger_enabled": bool(agent.trigger_enabled),
         "has_bot_token": bool(agent.has_bot_token),
         "has_user_token": bool(agent.has_user_token),
         "has_app_token": bool(agent.has_app_token),
-        "last_token_update": str(agent.last_token_update)
-        if agent.last_token_update is not None
-        else None,
+        "last_token_update": _get_nullable_str(agent.last_token_update),
         "spur_type": str(getattr(agent, "spur_type", "workflow") or "workflow"),
         "created_at": str(getattr(agent, "created_at", "") or ""),
     }
@@ -659,7 +657,7 @@ async def associate_workflow(
     if agent is None:
         raise HTTPException(status_code=404, detail="Agent not found")
 
-    agent.workflow_id = association.workflow_id
+    agent.set_field("workflow_id", association.workflow_id)
     db.commit()
     db.refresh(agent)
 
@@ -676,12 +674,12 @@ async def update_trigger_config(
     if agent
```

**File**: `backend/pyspur/models/slack_agent_model.py` (modified, +43/-4)
```diff
@@ -1,5 +1,6 @@
 import os
 from datetime import UTC, datetime
+from typing import Any
 
 from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
 from sqlalchemy.orm import relationship
@@ -10,7 +11,7 @@
 
 
 class SlackAgentModel(BaseModel):
-    """Model for storing Slack agent configurations"""
+    """Model for storing Slack agent configurations."""
 
     __tablename__ = "slack_agents"
 
@@ -50,22 +51,60 @@ class SlackAgentModel(BaseModel):
 
     @property
     def has_required_tokens(self) -> bool:
-        """Check if the agent has the required tokens for basic operation"""
+        """Check if the agent has the required tokens for basic operation."""
         return bool(getattr(self, "has_bot_token", False))
 
     @property
     def has_socket_mode_tokens(self) -> bool:
-        """Check if the agent has the tokens required for Socket Mode"""
+        """Check if the agent has the tokens required for Socket Mode."""
         return bool(getattr(self, "has_bot_token", False)) and (
             bool(getattr(self, "has_app_token", False)) or bool(os.getenv("SLACK_APP_TOKEN"))
         )
 
     def update_token_flags(self, token_type: str, has_token: bool) -> None:
-        """Update token flags based on token type"""
+        """Update token flags based on token type."""
         if token_type == "bot_token":
             self.has_bot_token = has_token
         elif token_type == "user_token":
             self.has_user_token = has_token
         elif token_type == "app_token":
             self.has_app_token = has_token
         self.last_token_update = datetime.now(UTC).isoformat()
+
+    def set_field(self, field: str, value: Any) -> None:
+        """Set a field value in a type-safe way.
+
+        Args:
+            field: The name of the field to set
+            value: The value to set the field to
+
+        """
+        if not hasattr(self, field):
+            raise ValueError(f"Invalid field name: {field}")
+
+        # Get the SQLAlchemy Column type
+        column = self.__table__.columns.get(field)
+        if column is None:
+            raise ValueError(f"Field {field} is not a database column")
+
+        # Convert the value to the correct type based on the column type
+        if isinstance(column.type, Boolean):
+            value = bool(value)
+        elif isinstance(column.type, String):
+            value = str(value) if value is not None else None
+        elif isinstance(column.type, Integer):
+            value = int(value) if value is not None else None
+        elif isinstance(column.type, JSON):
+            # JSON fields can accept any JSON-serializable value
+            pass
+
+        # Use the internal SQLAlchemy setter
+        setattr(self, field, value)
+
+    def get_id(self) -> int:
+        """Get the agent ID as a Python int."""
+        return 0 if getattr(self, "id", None) is None else int(str(self.id))
+
+    def get_workflow_id(self) -> str:
+        """Get the workflow ID as a Python string."""
+        return "" if getattr(self, "workflow_id", None) is None else str(self.workflow_id)
```

---

### Incident Patch 14: `21c20d0d` (2025-03-25)
**Commit Message**: fix: some more linter issues

**File**: `backend/pyspur/api/slack_management.py` (modified, +18/-8)
```diff
@@ -423,23 +423,31 @@ def _agent_to_response_model(agent: SlackAgentModel) -> SlackAgentResponse:
     agent_dict = {
         "id": agent_id,
         "name": str(agent.name),
-        "slack_team_id": str(agent.slack_team_id) if agent.slack_team_id else None,
-        "slack_team_name": str(agent.slack_team_name) if agent.slack_team_name else None,
-        "slack_channel_id": str(agent.slack_channel_id) if agent.slack_channel_id else None,
-        "slack_channel_name": str(agent.slack_channel_name) if agent.slack_channel_name else None,
+        "slack_team_id": str(agent.slack_team_id) if agent.slack_team_id is not None else None,
+        "slack_team_name": str(agent.slack_team_name)
+        if agent.slack_team_name is not None
+        else None,
+        "slack_channel_id": str(agent.slack_channel_id)
+        if agent.slack_channel_id is not None
+        else None,
+        "slack_channel_name": str(agent.slack_channel_name)
+        if agent.slack_channel_name is not None
+        else None,
         "is_active": bool(agent.is_active),
-        "workflow_id": str(agent.workflow_id) if agent.workflow_id else None,
+        "workflow_id": str(agent.workflow_id) if agent.workflow_id is not None else None,
         "trigger_on_mention": bool(agent.trigger_on_mention),
         "trigger_on_direct_message": bool(agent.trigger_on_direct_message),
         "trigger_on_channel_message": bool(agent.trigger_on_channel_message),
         "trigger_keywords": [str(k) for k in agent.trigger_keywords]
-        if agent.trigger_keywords
+        if agent.trigger_keywords is not None
         else None,
         "trigger_enabled": bool(agent.trigger_enabled),
         "has_bot_token": bool(agent.has_bot_token),
         "has_user_token": bool(agent.has_user_token),
         "has_app_token": bool(agent.has_app_token),
-        "last_token_update": str(agent.last_token_update) if agent.last_token_update else None,
+        "last_token_update": str(agent.last_token_update)
+        if agent.last_token_update is not None
+        else None,
         "spur_type": str(getattr(agent, "spur_type", "workflow") or "workflow"),
         "created_at": str(getattr(agent, "created_at", "") or ""),
     }
@@ -976,7 +984,9 @@ async def get_agent_token(agent_id: int, token_type: str, db: Session = Depends(
     masked_token = mask_token(token)
 
     # Get the last update timestamp - handle the value directly
-    last_token_update = str(agent.last_token_update) if agent.last_token_update else None
+    last_token_update = (
+        str(agent.last_token_update) if agent.last_token_update is not None else None
+    )
 
     return AgentTokenResponse(
         agent_id=agent_id,
```

---

### Incident Patch 15: `f267c9ea` (2025-03-24)
**Commit Message**: fix: more linter errors

**File**: `backend/pyproject.toml` (modified, +1/-2)
```diff
@@ -78,8 +78,7 @@ dependencies = [
     "sendgrid==6.11.0",
     "resend==2.6.0",
     "typer[all]==0.9.0",
-    "psutil>=5.9.5",
-    "docker>=7.0.0",
+    "psutil>=7.0.0",
 ]
 
 [project.urls]
```

**File**: `backend/pyspur/api/slack_management.py` (modified, +319/-105)
```diff
@@ -2,10 +2,11 @@
 import json
 import os
 import traceback
+from contextlib import asynccontextmanager
 from datetime import UTC, datetime
-from typing import Any, Callable, Dict, List, Optional, cast
+from typing import Any, Callable, Dict, List, Optional, TypeVar, cast
 
-from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
+from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, HTTPException, Request
 from loguru import logger
 from slack_sdk import WebClient
 from slack_sdk.errors import SlackApiError
@@ -49,11 +50,11 @@
 # Initialize the socket mode client and set up the workflow trigger callback
 socket_mode_client = get_socket_mode_client()
 
-# NOTE: Some type checking issues remain in this file related to:
-# 1. SQLAlchemy Column types and boolean operations
-# 2. slack_sdk.WebClient.chat_postMessage return types
-# 3. Type annotations for list elements in trigger_keywords
-# These are being suppressed with type: ignore where needed or using safe patterns.
+# Define a type variable for the response objects
+T = TypeVar("T")
+
+# Add these type annotations to better handle slack_sdk method calls
+from slack_sdk.web.client import WebClient
 
 
 def _validate_agent_socket_mode(
@@ -72,7 +73,7 @@ def _validate_agent_socket_mode(
     """
     agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
 
-    if not agent or not agent.socket_mode_enabled:
+    if agent is None or not bool(agent.socket_mode_enabled):
         logger.warning(f"Rejecting event for agent {agent_id} - socket_mode_enabled=False")
 
         # Send response to avoid hanging the client
@@ -150,69 +151,51 @@ async def _get_active_agent(db: Session, agent_id: int) -> Optional[SlackAgentMo
     return agent
 
 
-# Function to convert keywords list items to strings
-def _convert_keywords_to_strings(keywords: List[str]) -> List[str]:
-    """Convert all items in a keywords list to strings, filtering out None values."""
-    return [str(k) for k in keywords if k is not None]
-
-
-# Utility function to check for keyword matches in the message
+# Handle the item typing issues in the keywords list
 async def _should_trigger_workflow(
     agent: SlackAgentModel, trigger_request: WorkflowTriggerRequest
 ) -> bool:
     """Determine if a Slack message should trigger a workflow."""
     # Only proceed if triggering is enabled for this agent
     try:
         # Use explicit conversion for all SQLAlchemy Column boolean fields
-        trigger_enabled = (
-            bool(agent.trigger_enabled) if agent.trigger_enabled is not None else False
-        )
+        trigger_enabled = bool(agent.trigger_enabled)
         if not trigger_enabled:
             return False
 
         should_trigger = False
 
         # Check mention trigger - convert SQLAlchemy Column to bool for comparison
-        trigger_on_mention = (
-            bool(agent.trigger_on_mention) if agent.trigger_on_mention is not None else False
-        )
+        trigger_on_mention = bool(agent.trigger_on_mention)
         if trigger_on_mention and trigger_request.event_type == "app_mention":
             should_trigger = True
         # Check direct message trigger
         elif (
-            (
-                bool(agent.trigger_on_direct_message)
-                if agent.trigger_on_direct_message is not None
-                else False
-            )
+            bool(agent.trigger_on_direct_message)
             and trigger_request.event_type == "message"
             and trigger_request.event_data.get("channel_type") == "im"
         ):
             should_trigger = True
         # Check channel message trigger
         elif (
-            (
-                bool(agent.trigger_on_channel_message)
-                if agent.trigger_on_channel_message is not None
-                else False
-            )
+            bool(agent.trigger_on_channel_message)
             and trigger_request.event_type == "message"
             and trigger_request.event_data.get("channel_type") != "im"
         ):
             # For channel messages, we need to check for keywords
             keywords = agent.trigger_keywords
-            if keywords and isinstance(keywords, list):
-                # Convert keywords to list of strings
+            if isinstance(keywords, list):
                 str_keywords: List[str] = []
-                for item in keywords:  # type: ignore  # SQLAlchemy JSON type is hard to properly type
+                for item in keywords:
                     if item is not None:
                         str_keywords.append(str(item))
-
                 if str_keywords:
                     message_text = trigger_request.text.lower()
-                    return any(keyword.lower() in message_text for keyword in str_keywords)
+                    for keyword in str_keywords:
+                        if keyword.lower() in message_text:
+                            return True
+                    return False
 
```

**File**: `backend/pyspur/integrations/slack/socket_manager.py` (modified, +160/-13)
```diff
@@ -1,16 +1,20 @@
 import logging
 import multiprocessing
+import os
 import signal
-import sys
 import time
-from typing import Dict
+from types import FrameType
+from typing import Any, Dict, Optional, cast
 
+import psutil
 from loguru import logger
 from sqlalchemy.orm import Session
 
 from ...database import get_db
+from ...models.slack_agent_model import SlackAgentModel
 from .socket_worker import get_active_agents
 from .socket_worker import main as worker_main
+from .worker_status import MARKER_DIR, find_running_worker_process
 
 # Configure logging
 logging.basicConfig(level=logging.INFO)
@@ -19,26 +23,37 @@
 
 class SocketManager:
     """Manager for Slack Socket Mode workers using multiprocessing.
+
     This manages multiple worker processes, each handling a specific Slack agent.
     """
 
+    _instance: Optional["SocketManager"] = None
+
+    def __new__(cls, *args: Any, **kwargs: Any) -> "SocketManager":
+        if cls._instance is None:
+            cls._instance = super(SocketManager, cls).__new__(cls)
+        return cls._instance
+
     def __init__(self):
-        """Initialize the socket manager."""
-        self.workers: Dict[int, multiprocessing.Process] = {}
+        # Prevent reinitializing on subsequent instantiations
+        if hasattr(self, "_initialized") and self._initialized:
+            return
+        # ProcessLike is anything with pid and is_alive() attributes
+        self.workers: Dict[int, Any] = {}
         self.stopping = False
         self.setup_signal_handlers()
+        self._initialized = True
 
     def setup_signal_handlers(self):
         """Set up signal handlers for graceful shutdown."""
-        signal.signal(signal.SIGTERM, self.handle_shutdown)
-        signal.signal(signal.SIGINT, self.handle_shutdown)
+        signal.signal(signal.SIGTERM, lambda signum, frame: self.handle_shutdown(signum, frame))
+        signal.signal(signal.SIGINT, lambda signum, frame: self.handle_shutdown(signum, frame))
 
-    def handle_shutdown(self, signum: int, frame) -> None:
+    def handle_shutdown(self, signum: int, frame: Optional[FrameType] = None) -> None:
         """Handle shutdown signals by stopping all workers gracefully."""
         logger.info(f"Received signal {signum}, shutting down all workers...")
         self.stopping = True
         self.stop_all_workers()
-        sys.exit(0)
 
     def start_worker(self, agent_id: int) -> bool:
         """Start a new worker process for a specific agent.
@@ -50,19 +65,134 @@ def start_worker(self, agent_id: int) -> bool:
             bool: True if worker started successfully, False otherwise
 
         """
-        if agent_id in self.workers and self.workers[agent_id].is_alive():
-            logger.warning(f"Worker for agent {agent_id} is already running")
-            return False
-
+        agent_id = int(agent_id)
+        # First check if there's an existing worker that's actually running
+        if agent_id in self.workers:
+            existing_worker = self.workers[agent_id]
+            if existing_worker.is_alive():
+                logger.info(
+                    f"Worker for agent {agent_id} is already running (PID: {existing_worker.pid if hasattr(existing_worker, 'pid') else 'unknown'})"
+                )
+                return True
+            else:
+                # Worker exists but isn't running - clean it up
+                logger.warning(f"Found non-running worker for agent {agent_id} - cleaning up")
+                try:
+                    if hasattr(existing_worker, "terminate"):
+                        existing_worker.terminate()
+                    del self.workers[agent_id]
+                except Exception as e:
+                    logger.error(f"Error cleaning up dead worker for agent {agent_id}: {e}")
+
+        # Check for existing marker files and running processes even if not tracked in our workers dictionary
+        marker_file = f"{MARKER_DIR}/agent_{agent_id}.pid"
+        pid = None
+        is_running = False
+
+        # First check if a marker file exists and get the PID from it
+        if os.path.exists(marker_file):
+            try:
+                with open(marker_file, "r") as f:
+                    pid_str = f.read().strip()
+                    if pid_str:
+                        pid = int(pid_str)
+                        logger.info(
+                            f"Found existing marker file for agent {agent_id} with PID {pid}"
+                        )
+            except Exception as e:
+                logger.error(f"Error reading PID from marker file for agent {agent_id}: {e}")
+
+        # Check if the process is running
+        if pid is not None:
+            try:
+                if psutil.pid_exists(pid):
+                    # Verify this is actually a socket worker for this agent
+                    proc = psutil.Process(pid)
+                    cmdline = " ".join(proc.cmdline())
+                    if "socket_worker.py" in cmdline and f"
```

**File**: `backend/pyspur/integrations/slack/socket_worker.py` (modified, +106/-29)
```diff
@@ -8,6 +8,8 @@
 import os
 import signal
 import sys
+import types
+from datetime import datetime
 from typing import Optional
 
 from loguru import logger
@@ -26,13 +28,10 @@ def get_active_agents(db: Session) -> list[SlackAgentModel]:
     """Get all active agents that have socket mode enabled"""
     agents = (
         db.query(SlackAgentModel)
-        .filter(
-            SlackAgentModel.is_active,
-            SlackAgentModel.trigger_enabled,
-            SlackAgentModel.has_bot_token,
-            SlackAgentModel.workflow_id.isnot(None),
-            SlackAgentModel.socket_mode_enabled.is_(True),
+        .filter_by(
+            is_active=True, trigger_enabled=True, has_bot_token=True, socket_mode_enabled=True
         )
+        .filter(SlackAgentModel.workflow_id.isnot(None))
         .all()
     )
     return agents
@@ -41,7 +40,7 @@ def get_active_agents(db: Session) -> list[SlackAgentModel]:
 def setup_shutdown_handler(socket_client: SocketModeClient, agent_id: int):
     """Set up signal handlers for graceful shutdown"""
 
-    def handle_shutdown(signum: int, frame) -> None:
+    def handle_shutdown(signum: int, frame: Optional[types.FrameType]) -> None:
         logger.info(f"Worker {agent_id} received signal {signum}, shutting down")
         socket_client.stop_socket_mode(agent_id)
         sys.exit(0)
@@ -67,12 +66,12 @@ async def check_agent_status(db: Session, agent_id: int) -> bool:
             logger.warning(f"Agent {agent_id} no longer exists")
             return False
 
-        return bool(
-            agent.is_active
-            and agent.trigger_enabled
-            and agent.has_bot_token
-            and agent.workflow_id is not None
-            and agent.socket_mode_enabled
+        return (
+            bool(agent.is_active)
+            and bool(agent.trigger_enabled)
+            and bool(agent.has_bot_token)
+            and bool(agent.workflow_id)
+            and bool(agent.socket_mode_enabled)
         )
     except Exception as e:
         logger.error(f"Error checking agent {agent_id} status: {e}")
@@ -97,6 +96,29 @@ async def run_worker(agent_id: int):
     worker_id = os.environ.get("HOSTNAME", "unknown")
     logger.info(f"Socket worker {worker_id} started for agent {agent_id}")
 
+    # Create a marker file to indicate this worker is running
+    # This helps with tracking workers even if the API restarts
+    marker_dir = "/tmp/pyspur_socket_workers"
+    os.makedirs(marker_dir, exist_ok=True)
+    marker_file = f"{marker_dir}/agent_{agent_id}.pid"
+    with open(marker_file, "w") as f:
+        f.write(str(os.getpid()))
+
+    status_file = f"{marker_dir}/agent_{agent_id}.status"
+
+    # Register a cleanup function to remove the marker file when the process exits
+    import atexit
+
+    def cleanup_marker():
+        try:
+            if os.path.exists(marker_file):
+                os.remove(marker_file)
+                logger.info(f"Removed marker file {marker_file}")
+        except Exception as e:
+            logger.error(f"Error removing marker file: {e}")
+
+    atexit.register(cleanup_marker)
+
     # Add a brief delay to ensure database is ready
     await asyncio.sleep(5)
 
@@ -109,13 +131,34 @@ async def run_worker(agent_id: int):
 
         logger.info(f"Socket mode started for agent {agent_id}")
 
-        # Keep checking the agent's status
+        # Write status information to a status file
+        try:
+            with open(status_file, "w") as f:
+                import json
+
+                status_info = {
+                    "agent_id": agent_id,
+                    "started_at": datetime.now().isoformat(),
+                    "pid": os.getpid(),
+                    "hostname": worker_id,
+                    "status": "running",
+                }
+                f.write(json.dumps(status_info))
+        except Exception as status_err:
+            logger.error(f"Error writing status file: {status_err}")
+
+        # Keep checking the agent's status and be resilient to database connection issues
+        max_retries = 3
+        retry_count = 0
         while True:
             try:
                 db = next(get_db())
                 try:
                     # Check if we should still be running
                     should_run = await check_agent_status(db, agent_id)
+                    # Reset retry counter on successful check
+                    retry_count = 0
+
                     if not should_run:
                         logger.info(f"Agent {agent_id} is no longer active, shutting down")
                         break
@@ -128,22 +171,54 @@ async def run_worker(agent_id: int):
                         success = socket_client.start_socket_mode(agent_id)
                         if not success:
                             logger.error(f"Failed to restart socket for agent {agent_id}")
-                            break
+                            retry_count += 1
+                            if retry_count >= m
```

**File**: `backend/pyspur/integrations/slack/worker_status.py` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+"""Module for checking the status of Slack socket mode workers.
+
+This provides utilities for identifying running workers from marker files
+and status files, which helps maintain state between API restarts.
+"""
+
+import json
+import os
+from typing import Any, Dict, List, Optional, Tuple, TypedDict
+
+import psutil
+from loguru import logger
+
+# Base directory for worker marker files
+MARKER_DIR = "/tmp/pyspur_socket_workers"
+
+
+class WorkerStatus(TypedDict):
+    agent_id: int
+    marker_exists: bool
+    process_running: bool
+    pid: Optional[int]
+    status_file_exists: bool
+    status: str
+    details: Dict[str, Any]
+
+
+def get_worker_status(agent_id: int) -> WorkerStatus:
+    """Get the status of a worker for a specific agent.
+
+    Args:
+        agent_id: The ID of the agent to check
+
+    Returns:
+        Dict: A dictionary with status information
+
+    """
+    result = WorkerStatus(
+        agent_id=agent_id,
+        marker_exists=False,
+        process_running=False,
+        pid=None,
+        status_file_exists=False,
+        status="unknown",
+        details={},
+    )
+
+    # Ensure the marker directory exists
+    if not os.path.exists(MARKER_DIR):
+        return result
+
+    # Check for marker file
+    marker_file = f"{MARKER_DIR}/agent_{agent_id}.pid"
+    if os.path.exists(marker_file):
+        result["marker_exists"] = True
+
+        # Read the PID
+        try:
+            with open(marker_file, "r") as f:
+                pid = int(f.read().strip())
+                result["pid"] = pid
+
+            # Check if process is running
+            try:
+                process = psutil.Process(pid)
+                cmdline = process.cmdline()
+                cmdline_str = " ".join(cmdline)
+                if (
+                    "socket_worker.py" in cmdline_str
+                    and f"SLACK_AGENT_ID={agent_id}" in cmdline_str
+                ):
+                    result["process_running"] = True
+            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
+                pass
+        except Exception as e:
+            logger.error(f"Error reading PID from marker file for agent {agent_id}: {e}")
+
+    # Check for status file
+    status_file = f"{MARKER_DIR}/agent_{agent_id}.status"
+    if os.path.exists(status_file):
+        result["status_file_exists"] = True
+
+        # Read the status
+        try:
+            with open(status_file, "r") as f:
+                status_data = json.load(f)
+                result["status"] = status_data.get("status", "unknown")
+                result["details"] = status_data
+        except Exception as e:
+            logger.error(f"Error reading status file for agent {agent_id}: {e}")
+
+    return result
+
+
+def list_workers() -> List[Dict[str, Any]]:
+    """List all workers based on marker files.
+
+    Returns:
+        List[Dict[str, Any]]: A list of worker status dictionaries
+
+    """
+    results: List[Dict[str, Any]] = []
+
+    # Ensure the marker directory exists
+    if not os.path.exists(MARKER_DIR):
+        return results
+
+    # Find all marker files
+    for filename in os.listdir(MARKER_DIR):
+        if filename.startswith("agent_") and filename.endswith(".pid"):
+            try:
+                # Extract agent ID
+                agent_id_str = filename[6:-4]  # Remove "agent_" prefix and ".pid" suffix
+                agent_id = int(agent_id_str)
+
+                # Get status for this agent
+                status = get_worker_status(agent_id)
+                results.append(dict(status))
+            except Exception as e:
+                logger.error(f"Error processing marker file {filename}: {e}")
+
+    return results
+
+
+def find_running_worker_process(agent_id: int) -> Tuple[bool, Optional[int]]:
+    """Find a running worker process for the given agent ID.
+
+    Args:
+        agent_id: The agent ID to look for
+
+    Returns:
+        Tuple[bool, Optional[int]]: A tuple of (is_running, pid)
+
+    """
+    for proc in psutil.process_iter(["pid", "cmdline"]):
+        try:
+            cmdline = proc.info["cmdline"]
+            if cmdline:
+                cmdline_str = " ".join(cmdline)
+                if "socket_worker.py" in cmdline_str and (
+                    f"SLACK_AGENT_ID={agent_id}" in cmdline_str
+                    or f"--agent-id={agent_id}" in cmdline_str
+                ):
+                    return True, proc.info["pid"]
+        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
+            continue
+    return False, None
```

**File**: `backend/scripts/repair_socket_workers.py` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+#!/usr/bin/env python
+
+"""Repair Socket Mode Workers
+
+This script helps diagnose and repair socket mode worker issues.
+It can:
+1. List all socket mode workers
+2. Clean up stale marker files
+3. Restart workers
+4. Fix database state to match reality
+
+Usage:
+python repair_socket_workers.py [--clean] [--restart] [--fix-db]
+
+"""
+
+import argparse
+import os
+import sys
+from pathlib import Path
+
+# Add the parent directory to sys.path
+sys.path.append(str(Path(__file__).resolve().parent.parent))
+
+try:
+    from pyspur.api.slack_management import recover_orphaned_workers
+    from pyspur.database import get_db
+    from pyspur.integrations.slack.worker_status import (
+        MARKER_DIR,
+        find_running_worker_process,
+        get_worker_status,
+        list_workers,
+    )
+    from pyspur.models.slack_agent_model import SlackAgentModel
+
+    # Try to import psutil
+    try:
+        import psutil
+
+        PSUTIL_AVAILABLE = True
+    except ImportError:
+        PSUTIL_AVAILABLE = False
+        print("Warning: psutil not available, some features will be limited")
+except ImportError as e:
+    print(f"Error importing required modules: {e}")
+    print(
+        "Make sure to run this script from the project root or add the project root to PYTHONPATH"
+    )
+    sys.exit(1)
+
+
+def list_all_workers() -> None:
+    """List all socket mode workers."""
+    try:
+        # List all workers in the marker directory
+        print(f"Checking marker directory: {MARKER_DIR}")
+        if not os.path.exists(MARKER_DIR):
+            print("Marker directory does not exist. No workers found.")
+            return
+
+        # Get all worker status
+        workers = list_workers()
+
+        if not workers:
+            print("No worker marker files found.")
+            return
+
+        print(f"Found {len(workers)} worker marker files:")
+        for worker in workers:
+            # Print key information about each worker
+            print(f"Agent ID: {worker['agent_id']}")
+            print(f"  PID: {worker['pid']}")
+            print(f"  Running: {worker['process_running']}")
+            print(f"  Status: {worker['status']}")
+            if worker["details"]:
+                started_at = worker["details"].get("started_at", "unknown")
+                last_check = worker["details"].get("last_check", "unknown")
+                print(f"  Started: {started_at}")
+                print(f"  Last check: {last_check}")
+            print("")
+
+    except Exception as e:
+        print(f"Error listing workers: {e}")
+
+
+def clean_stale_markers() -> None:
+    """Clean up stale worker marker files."""
+    try:
+        # Check if the marker directory exists
+        if not os.path.exists(MARKER_DIR):
+            print("Marker directory does not exist. Nothing to clean.")
+            return
+
+        # Get all worker status
+        workers = list_workers()
+
+        if not workers:
+            print("No worker marker files found.")
+            return
+
+        # Count of cleaned files
+        cleaned = 0
+
+        # Check each worker
+        for worker in workers:
+            agent_id = worker["agent_id"]
+            pid = worker["pid"]
+
+            # Check if the process is running
+            if not worker["process_running"]:
+                # Process is not running, clean up the marker files
+                print(f"Cleaning up marker files for agent {agent_id} (pid {pid})")
+
+                # Remove pid file
+                pid_file = f"{MARKER_DIR}/agent_{agent_id}.pid"
+                if os.path.exists(pid_file):
+                    os.remove(pid_file)
+                    cleaned += 1
+                    print(f"  Removed pid file: {pid_file}")
+
+                # Remove status file
+                status_file = f"{MARKER_DIR}/agent_{agent_id}.status"
+                if os.path.exists(status_file):
+                    os.remove(status_file)
+                    cleaned += 1
+                    print(f"  Removed status file: {status_file}")
+
+        print(f"Cleaned up {cleaned} stale marker files.")
+
+    except Exception as e:
+        print(f"Error cleaning markers: {e}")
+
+
+def restart_workers() -> None:
+    """Restart socket mode workers."""
+    try:
+        # First, get a database session
+        db = next(get_db())
+
+        # Get all agents with socket mode enabled
+        agents = (
+            db.query(SlackAgentModel).filter(SlackAgentModel.socket_mode_enabled.is_(True)).all()
+        )
+
+        if not agents:
+            print("No agents with socket_mode_enabled=True found in the database.")
+            return
+
+        print(f"Found {len(agents)} agents with socket_mode_enabled=True in the database:")
+        for agent in agents:
+            agent_id = agent.id
+            print(f"Agent ID: {agent_id}, Name: {agent.name}")
+
+            # Check if a worker is already running for this agent
+          
```

**File**: `frontend/src/components/Dashboard.tsx` (modified, +138/-6)
```diff
@@ -62,6 +62,7 @@ import {
     deleteSlackAgent,
     startSocketMode,
     stopSocketMode,
+    getSocketModeStatus,
 } from '../utils/api'
 import TemplateCard from './cards/TemplateCard'
 import SpurTypeChip from './chips/SpurTypeChip'
@@ -177,6 +178,8 @@ const Dashboard: React.FC = () => {
     const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
     const [showSlackAgentWizard, setShowSlackAgentWizard] = useState(false);
     const [showAgentEditorModal, setShowAgentEditorModal] = useState(false);
+    // Create a ref to track current agents without causing re-renders
+    const currentAgentsRef = React.useRef<SlackAgent[]>(slackAgents);
 
     // Function to show alerts
     const onAlert = (message: string, color: 'success' | 'danger' | 'warning' | 'default' = 'default') => {
@@ -281,17 +284,41 @@ const Dashboard: React.FC = () => {
             try {
                 const agents = await getSlackAgents(true) // Force refresh to get latest data
 
+                // For each agent, check the actual socket mode status
+                for (const agent of agents) {
+                    try {
+                        // Only check status for agents with bot token and app token
+                        if (agent.has_bot_token && agent.has_app_token) {
+                            console.log(`Checking socket mode status for agent ${agent.id}`)
+                            const statusResponse = await getSocketModeStatus(agent.id)
+
+                            // Only update if we got a successful response
+                            if (!('error' in statusResponse)) {
+                                agent.socket_mode_enabled = statusResponse.socket_mode_active
+                                console.log(`Updated socket_mode_enabled for agent ${agent.id} to ${agent.socket_mode_enabled}`)
+                            }
+                        }
+                    } catch (statusError) {
+                        console.error(`Error checking socket mode status for agent ${agent.id}:`, statusError)
+                    }
+                }
+
                 // Log agent data for debugging
-                console.log('Refreshed agents:', agents.map(a => ({
+                console.log('Refreshed agents with socket status:', agents.map(a => ({
                     id: a.id,
                     name: a.name,
                     workflow_id: a.workflow_id,
                     type: typeof a.workflow_id,
                     spur_type: a.spur_type,
                     has_bot_token: a.has_bot_token,
-                    has_user_token: a.has_user_token
+                    has_user_token: a.has_user_token,
+                    socket_mode_enabled: a.socket_mode_enabled
                 })))
 
+                // Update our ref to track current state without triggering a re-render cycle
+                currentAgentsRef.current = agents;
+
+                // Update state
                 setSlackAgents(agents)
                 setSlackConfigured(agents.length > 0)
 
@@ -312,6 +339,71 @@ const Dashboard: React.FC = () => {
         // Initial fetch of agents
         refreshSlackAgents()
 
+        // Set up a refresh interval to periodically check socket mode status
+        // Only check status every 30 seconds to avoid excessive API calls
+        const statusRefreshInterval = setInterval(() => {
+            // Only refresh when the page is visible
+            if (document.visibilityState === 'visible') {
+                console.log('Running periodic socket mode status refresh')
+                // Use a "light" refresh that only checks the status of active agents
+                const checkSocketStatus = async () => {
+                    try {
+                        // Get current agents from our ref to avoid dependency on state
+                        const currentAgents = currentAgentsRef.current;
+
+                        // Only check agents that should be active (have both tokens)
+                        const agentsToCheck = currentAgents.filter(a => a.has_bot_token && a.has_app_token)
+
+                        // Get fresh status for each agent
+                        const updatedAgents = [...currentAgents]
+                        let hasChanges = false
+
+                        for (const agent of agentsToCheck) {
+                            try {
+                                const statusResponse = await getSocketModeStatus(agent.id)
+                                if (!('error' in statusResponse)) {
+                                    // Find the agent in our current list
+                                    const agentIndex = updatedAgents.findIndex(a => a.id === agent.id)
+                                    if (agentIndex >= 0) {
+                                        // Only update if the status changed
+                                        if (updatedAgents[agentIndex].socket_mode_enabled !== statusResponse.socket_mode_active) {
+ 
```

#### Recent Merged Pull Requests:
- **PR #310** (closed): chore(deps): bump ghcr.io/devcontainers/features/docker-in-docker from 2.17.0 to 3.1.0 (@dependabot[bot])
- **PR #309** (closed): fix(files): prevent path traversal in file management endpoints (@andesyteoss)
- **PR #308** (closed): chore(deps): bump ghcr.io/devcontainers/features/docker-in-docker from 2.17.0 to 3.0.1 (@dependabot[bot])
- **PR #306** (closed): chore(deps): bump ghcr.io/devcontainers/features/docker-in-docker from 2.17.0 to 3.0.0 (@dependabot[bot])
- **PR #293** (2025-07-20): Update tiktoken to support MacOS (@yeger00)
- **PR #292** (2025-07-06): fix the error message in SlackSetupGuide.tsx (@Geraldf)
- **PR #286** (2025-05-12): Update README.md (@JeanKaddour)
- **PR #278** (2025-04-07): add xAI as a provider and Grok to the models (@rajeev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
