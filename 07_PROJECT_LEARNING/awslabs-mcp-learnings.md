# Forensic Learning Record (Deep Inspection): awslabs/mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/awslabs-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/awslabs/mcp](https://github.com/awslabs/mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:20.822Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `awslabs/mcp`
- **Description**: Open source MCP Servers for AWS
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9756 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `samples/stepfunctions-tool-mcp-server/sample_state_machines/customer-create/app.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
def lambda_handler(event: dict, context: dict) -> dict:
    """AWS Lambda function to create a new customer.

    Args:
        event (dict): The Lambda event object containing customer information
                      Expected format: {
                          "name": "John Doe",
                          "email": "john@example.com",
                          "phone": "+1-555-123-4567",
                          "address": {  # Optional
                              "street": "123 Main St",
                              "city": "Anytown",
                              "state": "CA",
                              "zipCode": "12345"
                          }
                      }
        context (dict): AWS Lambda context object

    Returns:
        dict: Created customer information if successful, otherwise an error message
              Success format: {"customerId": "123", "name": "John Doe", ...}
              Error format: {"error": "Error message"}
    """
    try:
        # Extract customer information from the event
        name = event.get('name')
        email = event.get('email')
        phone = event.get('phone')
        address = event.get('address')

        # Validate required fields
        if not all([name, email, phone]):
            return {'error': 'Missing required customer information (name, email, phone)'}

        # Validate address fields if address is provided
        if address:
            required_address_fields = ['street', 'city', 'state', 'zipCode']
            if not all(field in address for field in required_address_fields):
                return {
                    'error': 'Address provided is missing required fields (street, city, state, zipCode)'
                }

        # This would normally create a record in a database
        # For demo purposes, we'll return mock data with a generated ID

        # Create response with required fields
        response = {
            'customerId': '98765',  # In real implementation, this would be generated
            'name': name,
            'email': email,
            'phone': phone,
            'accountCreated': '2025-05-06',  # In real implementation, this would be current date
        }

        # Add address if provided
        if address:
            response['address'] = address

        return response

    except Exception as e:
        return {'error': str(e)}

```

### Core Architecture Module: `samples/stepfunctions-tool-mcp-server/sample_state_machines/customer-id-from-email/app.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


def lambda_handler(event: dict, context: dict) -> dict:
    """AWS Lambda function to retrieve customer ID based on customer email address.

    Args:
        event (dict): The Lambda event object containing the customer email
                      Expected format: {"email": "example@domain.com"}
        context (dict): AWS Lambda context object

    Returns:
        dict: Customer ID if found, otherwise an error message
              Success format: {"customerId": "123"}
              Error format: {"error": "Customer not found"}
    """
    try:
        # Extract email from the event
        email = event.get('email')

        if not email:
            return {'error': 'Missing email parameter'}

        # This would normally query a database
        # For demo purposes, we'll return mock data

        # Simulate database lookup
        if email == 'john.doe@example.com':
            return {'customerId': '12345'}
        else:
            return {'customerId': '54321'}

    except Exception as e:
        return {'error': str(e)}

```

### Core Architecture Module: `samples/stepfunctions-tool-mcp-server/sample_state_machines/customer-info-from-id/app.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


def lambda_handler(event: dict, context: dict) -> dict:
    """AWS Lambda function to retrieve customer information based on customer ID.

    Args:
        event (dict): The Lambda event object containing the customer ID
                      Expected format: {"customerId": "123"}
        context (dict): AWS Lambda context object

    Returns:
        dict: Customer information if found, otherwise an error message
              Success format: {"customerId": "123", "name": "John Doe", "email": "john@example.com", ...}
              Error format: {"error": "Customer not found"}
    """
    try:
        # Extract customer ID from the event
        customer_id = event.get('customerId')

        if not customer_id:
            return {'error': 'Missing customerId parameter'}

        # This would normally query a database
        # For demo purposes, we'll return mock data

        # Simulate database lookup
        match customer_id:
            case '12345':
                return {
                    'customerId': '12345',
                    'name': 'John Doe',
                    'email': 'john.doe@example.com',
                    'phone': '+1-555-123-4567',
                    'address': {
                        'street': '123 Main St',
                        'city': 'Anytown',
                        'state': 'CA',
                        'zipCode': '12345',
                    },
                    'accountCreated': '2022-01-15',
                }
            case '54321':
                return {
                    'customerId': '54321',
                    'name': 'Jane Smith',
                    'email': 'jane.smith@example.com',
                    'phone': '+1-555-987-6543',
                    'address': {
                        'street': '456 Oak Ave',
                        'city': 'Othertown',
                        'state': 'NY',
                        'zipCode': '67890',
                    },
                    'accountCreated': '2022-02-20',
                }
            case _:
                return {'error': 'Customer not found'}

    except Exception as e:
        return {'error': str(e)}

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/__init__.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This file is part of the awslabs namespace.
# It is intentionally minimal to support PEP 420 namespace packages.
__path__ = __import__('pkgutil').extend_path(__path__, __name__)

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/__init__.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""awslabs.amazon-bedrock-agentcore-mcp-server"""

__version__ = '0.2.1'

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/config.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from .utils.url_validator import URLValidationError, validate_urls
from pydantic import BaseModel, Field, field_validator
from typing import List


class Config(BaseModel):
    """Configuration settings for the MCP server.

    Attributes:
        llm_texts_url: List of llms.txt URLs to index for documentation
        timeout: HTTP request timeout in seconds
        user_agent: User agent string for HTTP requests
    """

    llm_texts_url: List[str] = Field(
        default_factory=lambda: [
            'https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/llms.txt'
        ]
    )  # Curated list of llms.txt files to index at startup
    timeout: float = Field(default=30.0)  # HTTP request timeout in seconds
    user_agent: str = Field(default='agentcore-mcp-docs/1.0')  # User agent for HTTP requests

    @field_validator('llm_texts_url')
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        """Validate URLs after initialization."""
        try:
            return validate_urls(v)
        except URLValidationError as e:
            raise ValueError(f'Invalid URLs in configuration: {e}') from e


# Global configuration instance
doc_config = Config()

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/server.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""awslabs AWS Bedrock AgentCore MCP Server implementation."""

import asyncio
import os
from .tools import docs
from .utils import cache
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from loguru import logger
from mcp.server.mcpserver import MCPServer


APP_NAME = 'amazon-bedrock-agentcore-mcp-server'

AGENTCORE_MCP_INSTRUCTIONS = (
    'Use this MCP server to access Amazon Bedrock AgentCore services — '
    'agent runtime, code interpreter sandboxes, cloud browser sessions, '
    'memory, gateway, identity, policy, evaluations, and documentation.\n\n'
    '## Code Interpreter Tools\n'
    'Use start_code_interpreter_session to create a sandbox, then execute_code, '
    'execute_command, or install_packages to run code. Use upload_file and '
    'download_file to transfer data. Use list_files to see files in the sandbox. '
    'Stop sessions when done to release resources.\n\n'
    '## Browser Tools\n'
    'Start a browser session with start_browser_session, then use browser '
    'interaction tools (browser_navigate, browser_snapshot, browser_click, '
    'browser_type, etc.) to interact with web pages. Each session runs in an '
    'isolated cloud environment — no local browser installation is required. '
    'Call stop_browser_session when done.\n\n'
    'Tips:\n'
    '- Use DuckDuckGo or Bing instead of Google — Google blocks cloud browser '
    'IPs with CAPTCHAs.\n'
    '- For content-heavy pages, use browser_evaluate with JavaScript to extract '
    'specific data instead of relying solely on the accessibility snapshot, '
    'which can be very large.\n'
    '- For data extraction, prefer browser_evaluate over browser_snapshot. '
    'Use querySelectorAll to extract structured JSON (e.g., '
    '`[...document.querySelectorAll("tr")].map(r => r.innerText)`). '
    'Snapshots are best for understanding page structure and finding element '
    'refs; evaluate is best for extracting actual text and data.\n'
    '- To set long text in form fields, use browser_evaluate with '
    '`document.querySelector("selector").value = "text"` instead of '
    'browser_type or browser_fill_form, which type character-by-character '
    'and may timeout on long inputs.\n'
    '- The timeout_seconds parameter on start_browser_session is an idle '
    'timeout measured from the last activity, not an absolute session '
    'duration. Active sessions persist as long as there is interaction '
    'within the timeout window.'
)


def _is_service_enabled(name: str) -> bool:
    """Check if a service should be registered based on env vars."""
    disable = os.getenv('AGENTCORE_DISABLE_TOOLS', '')
    enable = os.getenv('AGENTCORE_ENABLE_TOOLS', '')

    if enable and disable:
        logger.warning(
            'Both AGENTCORE_ENABLE_TOOLS and AGENTCORE_DISABLE_TOOLS are set.'
            ' AGENTCORE_ENABLE_TOOLS takes precedence;'
            ' AGENTCORE_DISABLE_TOOLS is ignored.'
        )

    if enable:
        allowed = {t.strip().lower() for t in enable.split(',') if t.strip()}
        if not allowed:
            logger.warning(
                'AGENTCORE_ENABLE_TOOLS is set but contains no valid '
                'entries. All services enabled.'
            )
            return True
        return name.lower() in allowed
    if disable:
        blocked = {t.strip().lower() for t in disable.split(',') if t.strip()}
        return name.lower() not in blocked
    return True


# Browser managers — set during registration, used by lifespan
_browser_cm = None
_browser_sm = None

# Code interpreter cleanup function
_code_interpreter_cleanup = None


@asynccontextmanager
async def server_lifespan(server: MCPServer) -> AsyncIterator[None]:
    """Manage server lifecycle.

    Handles browser cleanup task, code interpreter cleanup, and
    graceful shutdown.
    """
    if _browser_cm is not None and _browser_sm is not None:
        from .tools.browser import cleanup_stale_sessions

        task = asyncio.create_task(cleanup_stale_sessions(_browser_cm, _browser_sm))
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            await _browser_cm.cleanup()
            if _code_interpreter_cleanup is not None:
                await _code_interpreter_cleanup()
    else:
        try:
            yield
        finally:
            if _code_interpreter_cleanup is not None:
                await _code_interpreter_cleanup()


mcp = MCPServer(
    APP_NAME,
    instructions=AGENTCORE_MCP_INSTRUCTIONS,
    lifespan=server_lifespan,
)

# Docs tools are always registered (no opt-out)
mcp.tool()(docs.search_agentcore_docs)
mcp.tool()(docs.fetch_agentcore_doc)

if _is_service_enabled('runtime'):
    try:
        from .tools.runtime import register_runtime_tools

        register_runtime_tools(mcp)
        logger.info('Runtime tools registered')
    except ImportError as e:
        logger.error(f'Runtime tools disabled — failed to import dependencies: {e}.')
    except Exception as e:
        logger.error(
            f'Runtime tools disabled — initialization failed: {e}. '
            f'Set AGENTCORE_DISABLE_TOOLS=runtime to suppress.'
        )

if _is_service_enabled('memory'):
    try:
        from .tools.memory import register_memory_tools

        register_memory_tools(mcp)
        logger.info('Memory tools registered (21 tools)')
    except ImportError as e:
        logger.error(
            f'Memory tools disabled — failed to import dependencies: {e}.'
            f' Ensure boto3 and botocore are installed.'
        )
    except Exception as e:
        logger.error(
            f'Memory tools disabled — initialization failed: {e}. '
            f'Set AGENTCORE_DISABLE_TOOLS=memory to suppress.'
        )

if _is_service_enabled('identity'):  # pragma: no cover
    try:
        from .tools.identity import register_identity_tools  # type: ignore

        register_identity_tools(mcp)
        logger.info('Identity tools registered (21 tools)')
    except ImportError as e:
        logger.error(f'Identity tools disabled — failed to import: {e}.')
    except Exception as e:
        logger.error(
            f'Identity tools disabled — initialization failed: {e}. '
            f'Set AGENTCORE_DISABLE_TOOLS=identity to suppress.'
        )

if _is_service_enabled('gateway'):  # pragma: no cover
    try:
        from .tools.gateway import register_gateway_tools  # type: ignore

        register_gateway_tools(mcp)
        logger.info('Gateway tools registered (15 tools)')
    except ImportError as e:
        logger.error(f'Gateway tools disabled — failed to import: {e}.')
    except Exception as e:
        logger.error(
            f'Gateway tools disabled — initialization failed: {e}. '
            f'Set AGENTCORE_DISABLE_TOOLS=gateway to suppress.'
        )

if _is_service_enabled('policy'):  # pragma: no cover
    try:
        from .tools.policy import register_policy_tools  # type: ignore

        register_policy_tools(mcp)
        logger.info('Policy tools registered (15 tools)')
    except ImportError as e:
        logger.error(f'Policy tools disabled — failed to import: {e}.')
    except Exception as e:
        logger.error(
            f'Policy tools disabled — initialization failed: {e}. '
            f'Set AGENTCORE_DISABLE_TOOLS=policy to suppress.'
        )

if _is_service_enabled('browser'):
    try:
        from .tools.browser import register_browser_tools

        _browser_cm, _browser_sm = register_browser_tools(mcp)
        logger.info('Browser tools registered (25 tools)')
    except ImportError as e:
        logger.error(
            f'Browser tools disabled — failed to import dependencies: '
            f'{e}. Ensure playwright and bedrock-agentcore are installed.'
        )
    except Exception as e:
        logger.error(
            f'Browser tools disabled — initialization failed: {e}. '
            f'Set AGENTCORE_DISABLE_TOOLS=browser to suppress.'
        )

if _is_service_enabled('code_interpreter'):
    try:
        from .tools.code_interpreter import (
            cleanup_code_interpreter,
            register_code_interpreter_tools,
        )

        register_code_interpreter_tools(mcp)
        _code_interpreter_cleanup = cleanup_code_interpreter
        logger.info('Code interpreter tools registered (10 tools)')
    except ImportError as e:
        logger.error(
            f'Code interpreter tools disabled — failed to import '
            f'dependencies: {e}. Ensure bedrock-agentcore is installed.'
        )
    except Exception as e:
        logger.error(
            f'Code interpreter tools disabled — initialization failed: '
            f'{e}. Set AGENTCORE_DISABLE_TOOLS=code_interpreter '
            f'to suppress.'
        )


def main() -> None:
    """Main entry point for the MCP server.

    Initializes the document cache and starts the MCPServer server.
    The cache is loaded with document titles only for fast startup,
    with full content fetched on-demand.
    """
    cache.ensure_ready()
    mcp.run()


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/tools/__init__.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""AgentCore MCP tools package."""

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/tools/browser/__init__.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Browser tools sub-package for the unified AgentCore MCP server.

Provides 25 browser automation tools via Amazon Bedrock AgentCore.
"""

import asyncio
from .connection_manager import BrowserConnectionManager
from .interaction import InteractionTools
from .management import ManagementTools
from .navigation import NavigationTools
from .observation import ObservationTools
from .session import BrowserSessionTools
from .snapshot_manager import SnapshotManager
from loguru import logger


STALE_SESSION_CHECK_INTERVAL_S = 60


async def cleanup_stale_sessions(
    connection_manager: BrowserConnectionManager,
    snapshot_manager: SnapshotManager,
) -> None:
    """Periodically check for stale Playwright connections and prune them."""
    while True:
        await asyncio.sleep(STALE_SESSION_CHECK_INTERVAL_S)
        try:
            for sid in connection_manager.get_session_ids():
                try:
                    browser = connection_manager.get_browser(sid)
                    if not browser.is_connected():
                        logger.info(f'Pruning stale session {sid} (browser disconnected)')
                        await connection_manager.disconnect(sid)
                        snapshot_manager.cleanup_session(sid)
                except ValueError:
                    logger.debug(f'Session {sid} already removed during stale cleanup')
                except Exception as e:
                    logger.warning(f'Error checking session {sid} liveness: {e}')
        except Exception as e:
            logger.warning(f'Stale session cleanup sweep error: {e}')


def register_browser_tools(mcp):
    """Create managers, register all 25 browser tools, return managers for lifecycle use."""
    connection_manager = BrowserConnectionManager()
    snapshot_manager = SnapshotManager()
    groups = [
        ('session', BrowserSessionTools),
        ('navigation', NavigationTools),
        ('interaction', InteractionTools),
        ('observation', ObservationTools),
        ('management', ManagementTools),
    ]
    for name, cls in groups:
        try:
            cls(connection_manager, snapshot_manager).register(mcp)
        except Exception as e:
            raise RuntimeError(f'Failed to register browser {name} tools: {e}') from e
    logger.info('All browser tool groups registered successfully')
    return connection_manager, snapshot_manager

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/tools/browser/browser_client.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""AWS client utilities via bedrock-agentcore SDK."""

from bedrock_agentcore.tools import BrowserClient
from loguru import logger
from os import getenv


_browser_clients: dict[str, BrowserClient] = {}

MCP_INTEGRATION_SOURCE = 'awslabs-agentcore-mcp-server'


def get_browser_client(
    region_name: str | None = None,
) -> BrowserClient:
    """Get a cached BrowserClient for the specified region.

    Uses the bedrock-agentcore SDK to manage boto3 clients, endpoint
    resolution, and user-agent tagging. Credentials are resolved from
    the environment (AWS_PROFILE, AWS_ACCESS_KEY_ID, IAM role, etc.).

    Args:
        region_name: AWS region. Defaults to AWS_REGION env var or us-east-1.

    Returns:
        Cached BrowserClient instance.
    """
    region = region_name or getenv('AWS_REGION') or 'us-east-1'

    if region in _browser_clients:
        return _browser_clients[region]

    client = BrowserClient(region=region, integration_source=MCP_INTEGRATION_SOURCE)
    _browser_clients[region] = client

    logger.info(f'Created BrowserClient for region={region}')
    return client

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/tools/browser/connection_manager.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Manages Playwright CDP connections to AgentCore browser sessions."""

import asyncio
from .browser_client import (
    get_browser_client,
)
from collections.abc import Callable
from loguru import logger
from playwright.async_api import Browser, Dialog, Page, Playwright, async_playwright


class BrowserConnectionManager:
    """Manages Playwright CDP connections to remote browser sessions.

    Maintains a mapping of session_id to Playwright Browser instances.
    Each browser is connected via CDP to an AgentCore automation stream
    using SigV4-signed WebSocket connections via the bedrock-agentcore SDK.
    """

    def __init__(self):
        """Initialize the connection manager."""
        self._connections: dict[str, Browser] = {}
        self._playwright: Playwright | None = None
        self._dialog_handlers: dict[str, Callable] = {}
        self._active_pages: dict[str, Page] = {}
        self._cleaned_up = False

    async def _ensure_playwright(self) -> Playwright:
        """Start Playwright if not already running."""
        if self._playwright is None:
            self._playwright = await async_playwright().start()
            logger.info('Playwright instance started')
        return self._playwright

    async def connect(
        self,
        session_id: str,
        browser_identifier: str,
        region: str = 'us-east-1',
    ) -> Browser:
        """Connect Playwright to a remote browser via CDP.

        Uses the bedrock-agentcore SDK to generate SigV4-signed WebSocket
        headers and the automation stream URL, then establishes a CDP
        connection.

        Args:
            session_id: AgentCore browser session identifier.
            browser_identifier: AgentCore browser resource identifier.
            region: AWS region for SigV4 signing.

        Returns:
            Connected Playwright Browser instance.
        """
        if session_id in self._connections:
            logger.warning(f'Session {session_id} already connected, disconnecting first')
            await self.disconnect(session_id)

        pw = await self._ensure_playwright()

        # Use the SDK to generate the signed WebSocket URL and headers
        client = get_browser_client(region)
        client.identifier = browser_identifier
        client.session_id = session_id
        ws_url, headers = client.generate_ws_headers()

        browser = await pw.chromium.connect_over_cdp(
            ws_url,
            headers=headers,
        )
        self._connections[session_id] = browser
        logger.info(f'Connected to browser session {session_id}')
        return browser

    def get_browser(self, session_id: str) -> Browser:
        """Get the Browser instance for a session.

        Args:
            session_id: AgentCore browser session identifier.

        Returns:
            The Playwright Browser instance for the session.

        Raises:
            ValueError: If no connection exists for the session.
        """
        browser = self._connections.get(session_id)
        if not browser:
            raise ValueError(
                f'No connection for session {session_id}. Call start_browser_session first.'
            )
        return browser

    def get_context(self, session_id: str):
        """Get the first browser context for a session.

        Args:
            session_id: AgentCore browser session identifier.

        Returns:
            The first BrowserContext for the session.

        Raises:
            ValueError: If no connection or context exists for the session.
        """
        browser = self.get_browser(session_id)
        contexts = browser.contexts
        if not contexts:
            raise ValueError(f'No browser context available for session {session_id}')
        return contexts[0]

    async def get_page(self, session_id: str) -> Page:
        """Get the active page for a session.

        Returns the explicitly set active page if one exists and is still open,
        otherwise falls back to the last page in the browser context.

        Args:
            session_id: AgentCore browser session identifier.

        Returns:
            The active page for the session.

        Raises:
            ValueError: If no connection or page exists for the session.
        """
        browser = self._connections.get(session_id)
        if not browser:
            raise ValueError(
                f'No connection for session {session_id}. Call start_browser_session first.'
            )
        contexts = browser.contexts
        if not contexts or not contexts[0].pages:
            raise ValueError(f'No page available for session {session_id}')

        active = self._active_pages.get(session_id)
        if active and active in contexts[0].pages:
            return active
        return contexts[0].pages[-1]

    def set_active_page(self, session_id: str, page: Page) -> None:
        """Set the active page for a session.

        Called by tab management to track which page subsequent tools should use.

        Args:
            session_id: AgentCore browser session identifier.
            page: The Playwright Page to make active.
        """
        self._active_pages[session_id] = page

    def is_connected(self, session_id: str) -> bool:
        """Check if a session has an active Playwright connection."""
        return session_id in self._connections

    def get_session_ids(self) -> list[str]:
        """Return all tracked session IDs."""
        return list(self._connections.keys())

    async def set_dialog_handler(
        self,
        session_id: str,
        action: str = 'accept',
        prompt_text: str | None = None,
    ) -> None:
        """Set a persistent dialog handler for a session.

        Registers a page event listener that automatically handles
        JavaScript dialogs (alert, confirm, prompt, beforeunload).

        Args:
            session_id: Browser session identifier.
            action: "accept" or "dismiss".
            prompt_text: Text to enter for prompt dialogs (only used with accept).
        """
        page = await self.get_page(session_id)

        # Remove any existing handler first
        await self.remove_dialog_handler(session_id)

        async def handler(dialog: Dialog) -> None:
            logger.info(
                f'Handling {dialog.type} dialog in session {session_id}: "{dialog.message}"'
            )
            if action == 'accept':
                await dialog.accept(prompt_text or '')
            else:
                await dialog.dismiss()

        page.on('dialog', handler)
        self._dialog_handlers[session_id] = handler
        logger.info(f'Dialog handler set for session {session_id}: action={action}')

    async def remove_dialog_handler(self, session_id: str) -> None:
        """Remove the dialog handler for a session if one exists."""
        handler = self._dialog_handlers.pop(session_id, None)
        if handler:
            try:
                page = await self.get_page(session_id)
                page.remove_listener('dialog', handler)
            except ValueError:
                logger.debug(
                    f'Could not remove dialog handler for session {session_id} (likely disconnected)'
                )

    async def disconnect(self, session_id: str) -> None:
        """Disconnect Playwright from a browser session.

        Args:
            session_id: AgentCore browser session identifier.
        """
        await self.remove_dialog_handler(session_id)
        self._active_pages.pop(session_id, None)
        browser = self._connections.pop(session_id, None)
        if browser:
            try:
                await browser.close()
                logger.info(f'Disconnected from browser session {session_id}')
            except Exception as e:
                logger.warning(f'Error closing browser for session {session_id}: {e}')

    async def cleanup(self) -> None:
        """Disconnect all sessions and stop Playwright.

        Idempotent — safe to call multiple times (e.g. from both a signal
        handler and the lifespan finally block).
        """
        if self._cleaned_up:
            return
        self._cleaned_up = True
        for session_id in list(self._connections):
            try:
                await self.disconnect(session_id)
            except Exception as e:
                logger.error(f'Error disconnecting session {session_id} during cleanup: {e}')
        if self._playwright:
            try:
                await asyncio.wait_for(self._playwright.stop(), timeout=5.0)
                logger.info('Playwright instance stopped')
            except asyncio.TimeoutError:
                logger.warning('Playwright stop timed out after 5s, forcing cleanup')
            except Exception as e:
                logger.error(f'Error stopping Playwright: {e}')
            finally:
                self._playwright = None

```

### Core Architecture Module: `src/amazon-bedrock-agentcore-mcp-server/awslabs/amazon_bedrock_agentcore_mcp_server/tools/browser/error_handler.py`
```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Shared error handling for browser tools.

Most browser tools follow the same error recovery pattern: on failure,
capture a snapshot of the current page state so the caller can see
what went wrong and retry with correct refs. These helpers deduplicate
that pattern across tool modules.
"""

from .snapshot_manager import (
    SnapshotManager,
)
from loguru import logger
from playwright.async_api import Page


async def error_with_snapshot(
    error_msg: str,
    page: Page | None,
    session_id: str,
    snapshot_manager: SnapshotManager,
) -> str:
    """Log an error and return it with a snapshot of the current page.

    If page is None (e.g. get_page() itself failed) or the snapshot capture
    fails, returns just the error message.
    """
    logger.error(error_msg)
    if page is None:
        return error_msg
    try:
        snapshot = await snapshot_manager.capture(page, session_id)
        return f'{error_msg}\n\nCurrent page:\n{snapshot}'
    except Exception as snapshot_err:
        logger.warning(
            f'Failed to capture error snapshot for session {session_id}: {snapshot_err}'
        )
        return error_msg


async def safe_capture(
    page: Page | None,
    session_id: str,
    snapshot_manager: SnapshotManager,
) -> str:
    """Capture a snapshot, returning a fallback message if capture fails.

    Use this on the happy path after a successful interaction so that a
    snapshot failure does not mask the fact that the action succeeded.
    """
    if page is None:
        return '[Snapshot unavailable]'
    try:
        return await snapshot_manager.capture(page, session_id)
    except Exception as e:
        logger.warning(f'Snapshot unavailable for session {session_id}: {e}')
        return '[Snapshot unavailable — take a new snapshot to see current page state]'


def ref_not_found_msg(ref: str) -> str:
    """Format a user-friendly error for a missing element ref."""
    return (
        f'Error: ref "{ref}" not found in current page. '
        f'Take a new snapshot or use a ref from below.'
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4586** (2026-09-08): **aws-api-mcp-server: ImportError - McpError not found in mcp.shared.exceptions (MCP v2 compatibility)**
  *Symptoms*: ### Describe the bug  The aws-api-mcp-server package fails to import due to incorrect class name. The code imports `McpError` but MCP v2.x renamed it to `MCPError` (capital letters).   ### Expected Behavior  The server should start without import errors when running: uvx awslabs.aws-api-mcp-server   ### Current Behavior  ImportError: cannot import name 'McpError' from 'mcp.shared.exceptions' (C:\Users\...\mcp\shared\exceptions.py). Did you mean: 'MCPError'?  File location: awslabs/aws_api_mcp_server/core/aws/service.py line 47   ### Reproduction Steps  # Install uv if not installed pip install uv  # Run the MCP server uvx awslabs.aws-api-mcp-server@latest  # Result: ImportError on startup   ### Possible Solution  Change line 47 in awslabs/aws_api_mcp_server/core/aws/service.py  From: from mcp.shared.exceptions import McpError To:   from mcp.shared.exceptions import MCPError  The MCP v2.x library uses MCPError (capital letters), not McpError.   ### Additional Information/Context  Tested versions: 1.0.0, 1.3.47, 1.5.4 (all affected) The package requires mcp>=2.1.1 which uses the new class name MCPError.   ### OS  Windows 11  ### Server  aws-api-mcp-server  ### Server Version  1.5.4 (latest), also affects 1.0.0, 1.3.47  ### Region experiencing the issue  N/A - local execution issue  ### Other information  Python: 3.12 uv: latest mcp dependency resolved: 2.1.1   ### Service quota  - [x] I have reviewed the service quotas for this construct
  **Post-Mortem & Fix Analysis**:
  > Seeing this too, via a different install path — worth recording since the symptom looks different.  **Claude Desktop extension**, not `uvx`: `aws-api-mcp-server` 1.3.3 (`ant.dir.gh.awslabs.aws-api-mcp-server`) on Linux, uv 0.9.7, Python 3.12, resolved `mcp` 2.1.1. Same `ImportError` in `core/aws/service.py`. The user-visible symptom is just "Failed / Server disconnected" in the extension list — the traceback is only in the MCP log, so it isn't obvious where to look.  The root cause is the unbounded constraint rather than the import spelling alone: `pyproject.toml` declares `mcp>=1.23.0` with no upper bound, so a fresh resolve lands on 2.x. That means it breaks on a clean install with no user action.  Pinning below the rename works:  ```toml "mcp>=1.23.0,<2", ```  That resolves to mcp 1.29.1 / fastmcp 3.4.7, and the server starts and completes an MCP `initialize` handshake normally. As a workaround it's lost on the next extension update, though.  One note on the suggested fix in the des

- **Issue #4567** (2026-09-01): **aws-iac-mcp-server: crashes on startup with fastmcp 4.0.0 — No module named 'fastmcp.server.proxy' (repo-wide fastmcp cap audit)**
  *Symptoms*: > **Update (repo-wide audit):** I audited all 62 servers for uncapped `fastmcp` deps. **`aws-iac-mcp-server` is the only server that actually crashes on FastMCP 4.0.0** — it is the sole uncapped server that imports a module 4.0 removed (`fastmcp.server.proxy`). 11 other servers are uncapped but use import paths that still exist in 4.0.0, so they don't crash from *this* issue (though an explicit `<4` cap is still advisable). `openapi-mcp-server` is already capped `<4`. Full listing, methodology, and per-server results are in [this comment](https://github.com/awslabs/mcp/issues/4567#issuecomment-5500359528).  ---  ### Describe the bug  `awslabs.aws-iac-mcp-server` fails to start (crashes at import) when installed via `uvx ...@latest`, because it resolves **FastMCP 4.0.0**. The server imports `ProxyClient` from `fastmcp.server.proxy`, a module that was **removed** in FastMCP 4.0 (it moved to `fastmcp.server.providers.proxy`).  The package's `pyproject.toml` declares `fastmcp>=3.2.0` with **no upper bound**, so any fresh install now pulls FastMCP 4.0.0 and the server never comes up.  - Package version: `awslabs.aws-iac-mcp-server` 1.0.24 - Offending import: `src/awslabs/aws_iac_mcp_server/client/mcp_proxy.py:18` and `.../server.py:34` → `from fastmcp.server.proxy import ProxyClient` - Dependency declaration: `pyproject.toml` → `"fastmcp>=3.2.0"`  ### Expected Behavior  `uvx awslabs.aws-iac-mcp-server@latest` starts the MCP server successfully with the default (latest) dependency 
  **Post-Mortem & Fix Analysis**:
  > ## Repo-wide audit: which servers are actually affected  I cloned `awslabs/mcp@main` and audited **all 62 servers** for uncapped `fastmcp` dependencies that could crash on FastMCP 4.0.0. Summary: **13 servers declare a standalone `fastmcp` dependency; 12 are uncapped; but only `aws-iac-mcp-server` actually crashes** on 4.0.0.  The distinction matters: *uncapped ≠ vulnerable*. The crash only happens when a server **imports a module that FastMCP 4.0 removed/relocated**. Almost every server imports `fastmcp` symbols that still exist in 4.0.0.  ### How I tested 1. Extracted the `fastmcp` constraint from every `src/*/pyproject.toml`. 2. Collected every distinct `fastmcp` import used across those servers. 3. Ran each import against a real `fastmcp==4.0.0` to see which raise `ModuleNotFoundError`. 4. Booted representative servers over stdio under `fastmcp==4.0.0` and under `fastmcp<4`.  ### Only two import paths break under FastMCP 4.0.0 | Import | Status in 4.0.0 | Used by | |---|---|---| | 
  > The repo-wide audit table lists `aws-api-mcp-server` as **Crashes on 4.0.0? no**. It does crash — through a second path the audit didn't cover.  The audit asked "does the server import a module FastMCP 4.0 removed?", and for this server that answer is correctly **no**. But FastMCP 4.0 also bumps a *transitive* dependency: `fastmcp-slim 4.0.0` requires `mcp>=2.0.0,<3.0.0`. `aws-api-mcp-server` declares `mcp>=1.23.0` with no upper bound, so a fresh resolve lands on mcp 2.1.1 — and SDK v2 renamed `McpError` to `MCPError` with no alias for the old spelling.  Repro (`awslabs.aws-api-mcp-server` 1.5.4, resolves fastmcp 4.0.0 + mcp 2.1.1):  ``` $ uvx awslabs.aws-api-mcp-server@latest   File ".../aws_api_mcp_server/core/aws/service.py", line 47, in <module>     from mcp.shared.exceptions import McpError ImportError: cannot import name 'McpError' from 'mcp.shared.exceptions'. Did you mean: 'MCPError'? ```  `uv.lock` still pins mcp 1.29.0, so CI and local dev never hit this — only installs that 

- **Issue #4535** (2026-08-25): **aws-api-mcp-server: InvalidClientTokenId persists after full uninstall/reinstall of connector**
  *Symptoms*: ### Describe the bug  The aws-api-mcp-server connector (Claude/claude.ai connector integration) returns `InvalidClientTokenId` on every AWS CLI call, including basic read-only calls like `aws sts get-caller-identity`. This started mid-session without any credential/config change on my end.  Troubleshooting already tried: - Toggled the connector off/on in Connectors settings — no change - Fully uninstalled and reinstalled the connector — same InvalidClientTokenId error persists - Confirmed the error is not command-specific (fails even on a trivial `sts get-caller-identity` call)  This suggests the underlying credentials/session token backing the connector are invalid or expired at the integration level, and neither a toggle nor a full reinstall regenerates them.  ### Expected Behavior  Either the connector should refresh/regenerate valid credentials automatically on reinstall, or there should be a clear way for the user to re-authenticate / see why the token is invalid, instead of silently failing with InvalidClientTokenId indefinitely.  ### Current Behavior  Every call through the connector fails with:  An error occurred (InvalidClientTokenId) when calling the [operation] operation: The security token included in the request is invalid.  This happens even on the simplest possible call:  aws sts get-caller-identity --region us-east-2  Same InvalidClientTokenId error is returned before and after: (1) toggling the connector Enabled/Disabled, (2) fully uninstalling and reinstalli
  **Post-Mortem & Fix Analysis**:
  > resolved

- **Issue #4366** (2026-08-04): **aurora-dsql-mcp-server: flaky timing test test_dollar_quote_scan_is_linear (2.04s vs 2.0s threshold)**
  *Symptoms*: ### Describe the bug  `tests/test_readonly_enforcement.py::TestReadonlyEnforcement::test_dollar_quote_scan_is_linear` is a **flaky wall-clock timing test**. It feeds a 500k-`$` payload through `detect_mutating_keywords` / `check_sql_injection_risk` and asserts the run finishes in under 2 seconds:  ```python # src/aurora-dsql-mcp-server/tests/test_readonly_enforcement.py:399 assert elapsed < 2.0, f'dollar-heavy input too slow ({elapsed:.2f}s) — possible O(n^2)' ```  On a loaded CI runner the absolute wall-clock time occasionally creeps just over the threshold and fails the whole `Build aurora-dsql-mcp-server` job, even though the code is correct.  ### Observed failure  From the `main` post-merge run of #4360 ([job log](https://github.com/awslabs/mcp/actions/runs/30384985162/job/90361979166)):  ``` AssertionError: dollar-heavy input too slow (2.04s) — possible O(n^2) assert 2.042716128000002 < 2.0 tests/test_readonly_enforcement.py:399: AssertionError 1 failed, 237 passed in 7.03s ```  The failure (2.04s vs. a 2.0s threshold — ~2% over) is unrelated to that PR's dependency change; it is pure timing sensitivity. This is at least the second sighting of this same test tripping right at ~2.04s.  ### Why it's a false positive  The regression this test guards against — the old O(n²) `sql[i:]` slicing in `_end_of_dollar_quote` — takes *tens of seconds* on a 500k-`$` string. The linear implementation runs in well under a second, so a 2.0s bar leaves almost no headroom against runner ji

- **Issue #4356** (2026-07-28): **No module named 'mcp.server.fastmcp'**
  *Symptoms*: ### Describe the bug  Currently there is no upper bound for the `mcp[cli]` requirement on a number of the MCP servers as can be seen by their pyproject.toml files e.g. `mcp[cli]>=1.23.0` v2 of `mcp` is now available as of this afternoon which no longer requires the `fastmcp` library that was previously installed as a dependency of `mcp`. However, many of the MCP servers in this repo still require `fastmcp`. The only MCP servers in this repo that are protected from this issue are the ones that explicitly state `fastmcp` as one of the dependencies here e.g. aws-iac-mcp-server  Here's a list of the affected MCPs: - aws-documentation-mcp-server - eks-mcp-server - aws-serverless-mcp-server - bedrock-kb-retrieval-mcp-server - lambda-tool-mcp-server - cloudwatch-mcp-server - iam-mcp-server - aws-pricing-mcp-server - amazon-sns-sqs-mcp-server - finch-mcp-server - stepfunctions-tool-mcp-server - cloudtrail-mcp-server - well-architected-security-mcp-server - amazon-mq-mcp-server - sagemaker-ai-mcp-server - aws-location-mcp-server - cloudwatch-applicationsignals-mcp-server - amazon-kendra-index-mcp-server - prometheus-mcp-server    ### Expected Behavior  MCP servers are able to start which requires fastmcp to be installed.  ### Current Behavior  fastmcp is not being installed for 19 of the MCP servers in this repo because of the lack of an upper bound on the mcp version means that mcp v2 is being installed which doesn't use fastmcp  ### Reproduction Steps   Try installing any of the MCP
  **Post-Mortem & Fix Analysis**:
  > This appears to be caused by `mcp==2.0.0`, which was released recently: https://pypi.org/project/mcp/  `awslabs.cloudwatch-mcp-server==0.1.5` imports:  ```python from mcp.server.fastmcp import Context ```  With `mcp==2.0.0`, that import fails:  ```text ModuleNotFoundError: No module named 'mcp.server.fastmcp' ```  Temporary workaround:  ```bash uv pip install --force-reinstall "mcp==1.29.0" "awslabs.cloudwatch-mcp-server==0.1.5" ```  After pinning `mcp==1.29.0`, the import works again.  It looks like the package dependency range may allow `mcp>=2`, but the code is still using the pre-2.0 SDK module layout. The package should probably pin `mcp<2` or update the imports/API usage for `mcp==2.x`. 

- **Issue #4340** (2026-10-01): **aws-iac-mcp-server: search_cdk_documentation raises KeyError 'url' when a result item omits the url field**
  *Symptoms*: ### Describe the bug  Every call to the `search_cdk_documentation` tool (aws-iac-mcp-server) fails with a bare `KeyError: 'url'`, surfaced to the MCP client as:  ``` Error calling tool 'search_cdk_documentation': 'url' ```  The search-result parser in `aws_knowledge_client.py` subscripts each result item directly (`item['url']`, plus `item['rank_order']`, `item['title']`, `item['context']`). When the AWS Knowledge search backend returns a result item that does not include a `url` key, the whole call raises `KeyError('url')` and returns no documentation at all — including the items that were well-formed. The tool wrapper does not catch the exception, so the raw `KeyError` propagates and its string form (`"'url'"`) becomes the client-facing error message.  Reproduces on 1.0.20 and 1.0.21 (latest). The affected code is byte-identical across at least 1.0.10 → 1.0.21, so the trigger is the backend response shape, not a code change in any release.  ### Expected Behavior  `search_cdk_documentation` should return the documentation excerpts for the query. Result items missing an optional field such as `url` should be handled gracefully (default/empty value, or the field treated as optional) so that a single incomplete item does not discard the entire result set.  ### Current Behavior  The tool returns `isError=True` with content `Error calling tool 'search_cdk_documentation': 'url'` for queries whose backend response contains any item without a `url` key. No results are returned — one
  **Post-Mortem & Fix Analysis**:
  > Opened a fix in #4346 -- switches dictionary key access to `.get()` with safe defaults in `_parse_search_documentation_result`, makes `url` optional (defaulting to `None`) in the `KnowledgeResult` dataclass, and updates/adds pytest tests to verify that items missing the `url` field are returned gracefully instead of raising a `KeyError`.
  > This issue is now marked as stale because it hasn't seen activity for a while. Add a comment or it will be closed soon. If you wish to exclude this issue from being marked as stale, add the "backlog" label.
  > Closing this issue as it hasn't seen activity for a while. Please add a comment @mentioning a maintainer to reopen. If you wish to exclude this issue from being marked as stale, add the "backlog" label.

- **Issue #4318** (2026-09-28): **awslabs.ec2-mcp-server fails to start — TypeError: FastMCP.__init__() got an unexpected keyword argument 'description'**
  *Symptoms*: ### Describe the bug  The awslabs.ec2-mcp-server MCP server fails to start immediately after installation with the following traceback:  Traceback (most recent call last):   File "<frozen runpy>", line 198, in _run_module_as_main   File "<frozen runpy>", line 88, in _run_code   File "...\Scripts\awslabs.ec2-mcp-server.exe\__main__.py", line 4, in <module>     from awslabs.ec2_mcp_server.server import main   File "...\Lib\site-packages\awslabs\ec2_mcp_server\server.py", line 74, in <module>     mcp = FastMCP(         name="AWS EC2 MCP Server",     ...     ) TypeError: FastMCP.__init__() got an unexpected keyword argument 'description' Steps to reproduce:    Impact:  The server is completely non-functional for all users on the current release.  ### Expected Behavior  It should have started with Claude code ok.  ### Current Behavior  This log error: Traceback (most recent call last):   File "<frozen runpy>", line 198, in _run_module_as_main   File "<frozen runpy>", line 88, in _run_code   File "...\Scripts\awslabs.ec2-mcp-server.exe\__main__.py", line 4, in <module>     from awslabs.ec2_mcp_server.server import main   File "...\Lib\site-packages\awslabs\ec2_mcp_server\server.py", line 74, in <module>     mcp = FastMCP(         name="AWS EC2 MCP Server",     ...     ) TypeError: FastMCP.__init__() got an unexpected keyword argument 'description'  ### Reproduction Steps  Add awslabs.ec2-mcp-server@latest to your MCP client config using uvx Start the MCP client The server installs 
  **Post-Mortem & Fix Analysis**:
  > Opened a fix in #4320 -- adds the missing `src/ec2-mcp-server/` source tree (the package was on PyPI but absent from `main`) and removes the `description`/`version` kwargs from the `FastMCP()` constructor call, which are no longer accepted in `mcp>=1.28.0`.
  > This issue is now marked as stale because it hasn't seen activity for a while. Add a comment or it will be closed soon. If you wish to exclude this issue from being marked as stale, add the "backlog" label.
  > Closing this issue as it hasn't seen activity for a while. Please add a comment @mentioning a maintainer to reopen. If you wish to exclude this issue from being marked as stale, add the "backlog" label.

- **Issue #4317** (2026-10-02): **[Bug] aws-documentation-mcp-server python processes take up 47% CPU per process while idle**
  *Symptoms*: ### Describe the bug  When nothing is using the MCP server, its processes churn at 47% CPU, raising laptop power usage unnecessarily. Attached are screenshots of top and ps. Nothing is using the MCP server, it's just sitting there spinning CPU  <img width="1743" height="486" alt="Image" src="https://github.com/user-attachments/assets/8dcdb456-a417-479e-9467-8e47cd86b9a2" /> <img width="1735" height="707" alt="Image" src="https://github.com/user-attachments/assets/bf03b147-21a6-4f5c-89b7-1cfbac67b98d" />  ### Expected Behavior  Idle cpu usage (0%)  ### Current Behavior  The CPU is churning at 47% per process  ### Reproduction Steps  1. Install mcp server as an MCP in opencode  ```     "aws-docs": {       "type": "local",       "command": ["uvx", "awslabs.aws-documentation-mcp-server@latest"],       "enabled": true     }, ```  2. Run opencode  3. List running processes  ### Possible Solution  _No response_  ### Additional Information/Context  _No response_  ### OS  MacOS 26.4.1  ### Server  aws-documentation-mcp-server  ### Server Version  1.1.26  ### Region experiencing the issue  us-east-1  ### Other information  _No response_  ### Service quota  - [x] I have reviewed the service quotas for this construct
  **Post-Mortem & Fix Analysis**:
  > Your own output splits these processes into two populations, and the split says the spin is not the idle path.  Eleven instances are burning CPU. Ten have a fully visible `ps` row (`STAT` `R`/`S`, no `+`, all on `TT s003`); the eleventh, `95076`, is cut off at the top of that screenshot but appears in `top` at 42.0% with `37:29:25`.  | PID | %CPU | STARTED | TIME | uv archive prefix | |---|---|---|---|---| | 42772 | 31.7 | 7Jul26 | 2330:57 | `2xFEz0Aw6k8…` | | 94825 | 31.7 | 9Jun26 | 2234:06 | `AvMrwZN8Bhp…` | | 41943 | 30.4 | 7Jul26 | 2231:11 | `2xFEz0Aw6k8…` | | 46097 | 31.5 | 1Jun26 | 2216:56 | `wKu5TO5qf6h…` | | 81316 | 22.2 | 2Jul26 | 2214:33 | `wKu5TO5qf6h…` | | 48591 | 23.6 | 11Jun26 | 2201:48 | `7HJDsgtIbQ8…` | | 60285 | 29.8 | 12Jun26 | 2197:40 | `cb2NReH9WIB…` | | 18958 | 28.6 | 10Jun26 | 2171:15 | `AvMrwZN8Bhp…` | | 11508 | 28.5 | 8Jul26 | 2160:09 | `jN38vm4TiYk…` | | 45937 | 21.3 | 1Jul26 | 2132:58 | `wKu5TO5qf6h…` |  Seven more are the same server and cost nothing: six in 
  > This issue is now marked as stale because it hasn't seen activity for a while. Add a comment or it will be closed soon. If you wish to exclude this issue from being marked as stale, add the "backlog" label.
  > Closing this issue as it hasn't seen activity for a while. Please add a comment @mentioning a maintainer to reopen. If you wish to exclude this issue from being marked as stale, add the "backlog" label.

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

### Incident Patch 1: `5abe7e82` (2026-10-05)
**Commit Message**: fix(aws-healthomics): write WDL and CWL lint input as UTF-8 (#4728)

**File**: `src/aws-healthomics-mcp-server/awslabs/aws_healthomics_mcp_server/tools/workflow_linting.py` (modified, +8/-4)
```diff
@@ -134,7 +134,9 @@ async def lint_workflow(
         tmp_path = None
         try:
             # Create temporary file for the WDL content
-            with tempfile.NamedTemporaryFile(mode='w', suffix='.wdl', delete=False) as tmp_file:
+            with tempfile.NamedTemporaryFile(
+                mode='w', suffix='.wdl', delete=False, encoding='utf-8'
+            ) as tmp_file:
                 tmp_file.write(workflow_content)
                 tmp_path = Path(tmp_file.name)
 
@@ -197,7 +199,7 @@ async def lint_workflow_bundle(
                         )
 
                     full_path.parent.mkdir(parents=True, exist_ok=True)
-                    full_path.write_text(content)
+                    full_path.write_text(content, encoding='utf-8')
 
                 # Validate main_workflow_file path stays within temp directory
                 main_file_path = (tmp_path / main_workflow_file).resolve()
@@ -253,7 +255,9 @@ async def lint_workflow(
         tmp_path = None
         try:
             # Create temporary file for the CWL content
-            with tempfile.NamedTemporaryFile(mode='w', suffix='.cwl', delete=False) as tmp_file:
+            with tempfile.NamedTemporaryFile(
+                mode='w', suffix='.cwl', delete=False, encoding='utf-8'
+            ) as tmp_file:
                 tmp_file.write(workflow_content)
                 tmp_path = Path(tmp_file.name)
 
@@ -316,7 +320,7 @@ async def lint_workflow_bundle(
                         )
 
                     full_path.parent.mkdir(parents=True, exist_ok=True)
-                    full_path.write_text(content)
+                    full_path.write_text(content, encoding='utf-8')
 
                 # Validate main_workflow_file path stays within temp directory
                 main_file_path = (tmp_path / main_workflow_file).resolve()
```

---

### Incident Patch 2: `2463d3df` (2026-10-05)
**Commit Message**: fix(billing-cost-management): classify invoicing list_invoice_summaries validation failures (#4731)

list_invoice_summaries' ten local parameter-validation returns call
format_response('error', ...) with no classification, so failures land
in UNKNOWN/UNKNOWN telemetry buckets and cannot be told apart from
service-side failures. Route each through a new _validation_error
helper that sets top-level error_type='validation_error', operation,
and service, matching what handle_aws_error already attaches to
AWS-side errors in the same tool. operation and service are now shared
constants used by both the validation helper and handle_aws_error so
local and AWS-side errors always report the same values.

Tests extend each validation case with a shared _assert_validation_error
check and add a non-numeric billing_period case that no test covered
before. The AWS ClientError test now asserts the operation and service
too, so the shared constants cannot drift.

The legacy data payload is preserved for backward compatibility.

Co-authored-by: Vijay Nattanmai Viswanathan <[REDACTED_EMAIL]>

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
 - Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
 - Fixed `session-sql` tool error responses omitting a structured error type. `execute_session_sql` caught every failure and returned a bare `{'status': 'error', 'message': ...}` with no `error_type`/`operation`, so failures surfaced without a classifiable type. Error responses now carry top-level `error_type`, `operation` (`session_sql`), and `service` (`SQL`). The `error_type` is the exception class name (e.g. `OperationalError`, `IntegrityError`, `ValueError`) -- a fixed identifier that never contains the query text or bound values, so no query content is exposed. The legacy `status='error'` and `message` payload is preserved for backward compatibility.
+- Fixed `invoicing` tool `list_invoice_summaries` validation-error responses missing a structured error type. Its ten local parameter checks (selector, time-filter presence, `billing_period` format and month range, date parsing, reversed/empty range, over-one-month range) returned `format_response('error', ...)` with no top-level classification, so failures surfaced as `UNKNOWN`/`UNKNOWN` in telemetry and could not be told apart from service-side failures. Error responses now carry top-level `error_type='validation_error'`, `operation='ListInvoiceSummaries'`, and `service='Invoicing'`, matching what `handle_aws_error` already attaches to AWS-side errors in the same tool. The legacy `data` payload and messages are preserved for backward compatibility.
 - Fixed `bcm-pricing-calc`, `cost-anomaly`, and `cost-explorer` error responses missing a structured error type. `bcm-pricing-calc` read the AWS message from a non-existent `data.error` key and reported every `get_preferences` failure (including `AccessDenied`) only as `PREFERENCES_NOT_CONFIGURED`; error responses now carry top-level `error_type`, `operation`, and `service`. `cost-anomaly` local input validation (bad date format, `start_date` after `end_date`, a future `end_date`, unknown `feedback`/`total_impact_operator`, missing `total_impact_end`) now carries top-level `error_type='validation_error'`, `operation`, and `service`. `cost-explorer` client-creation failures now carry top-level `error_type='client_creation_error'`, `operation`, and `service`. The legacy `data` payload is preserved for backward compatibility.
 - Fixed the AWS Compute Optimizer `get_idle_recommendations` operation rejecting `ResourceType` and `Finding` filter values whose casing differs from the idle enums (e.g. `EbsVolume` instead of `EBSVolume`, `idle` instead of `Idle`). Passed values are now normalized case-insensitively against the idle enums read from the installed botocore service model, and the response echoes the normalized filters as `applied_filters`. An `InvalidParameterValueException` now returns a structured error listing `valid_resource_type_values` and `valid_finding_values` so callers can self-correct instead of retrying the same request.
 
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/invoicing_operations.py` (modified, +30/-20)
```diff
@@ -42,6 +42,23 @@
 
 _SECONDS_PER_DAY = 86400
 
+# Classification for local parameter-validation failures, mirroring the
+# top-level fields handle_aws_error sets on AWS-side errors so callers can
+# tell a bad parameter apart from a service failure without parsing messages.
+_LIST_INVOICE_SUMMARIES_OPERATION = 'ListInvoiceSummaries'
+INVOICING_SERVICE_NAME = 'Invoicing'
+
+
+def _validation_error(data: Dict[str, Any]) -> Dict[str, Any]:
+    """Return an error response for a list_invoice_summaries validation failure."""
+    return format_response(
+        'error',
+        data,
+        error_type='validation_error',
+        operation=_LIST_INVOICE_SUMMARIES_OPERATION,
+        service=INVOICING_SERVICE_NAME,
+    )
+
 
 def _max_time_interval_days(start_epoch: int) -> int:
     """Widest ``TimeInterval`` span, in whole days, accepted for a given start.
@@ -200,15 +217,13 @@ async def list_invoice_summaries(
     try:
         # --- Selector: ACCOUNT_ID or INVOICE_ID, not both ---
         if account_id and invoice_id:
-            return format_response(
-                'error',
+            return _validation_error(
                 {'message': 'Provide either account_id or invoice_id, not both.'},
             )
 
         # --- Time filter: billing_period XOR start_date/end_date ---
         if billing_period and (start_date or end_date):
-            return format_response(
-                'error',
+            return _validation_error(
                 {
                     'message': (
                         'billing_period and start_date/end_date are mutually '
@@ -217,8 +232,7 @@ async def list_invoice_summaries(
                 },
             )
         if bool(start_date) != bool(end_date):
-            return format_response(
-                'error',
+            return _validation_error(
                 {'message': 'start_date and end_date must be provided together.'},
             )
 
@@ -227,8 +241,7 @@ async def list_invoice_summaries(
         # TimeInterval are absent. The INVOICE_ID flow takes a different path
         # and needs no filter, so only guard the account case.
         if not invoice_id and not billing_period and not start_date and not end_date:
-            return format_response(
-                'error',
+            return _validation_error(
                 {
                     'message': (
                         'A time filter is required when listing invoice summaries for an '
@@ -245,21 +258,18 @@ async def list_invoice_summaries(
         if billing_period:
             parts = billing_period.split('-')
             if len(parts) != 2:
-                return format_response(
-                    'error',
+                return _validation_error(
                     {'message': 'billing_period must be in YYYY-MM format (e.g. "2026-05").'},
                 )
             try:
                 year = int(parts[0])
                 month = int(parts[1])
             except ValueError:
-                return format_response(
-                    'error',
+                return _validation_error(
                     {'message': 'billing_period must be in YYYY-MM format (e.g. "2026-05").'},
                 )
             if month < 1 or month > 12:
-                return format_response(
-                    'error',
+                return _validation_error(
                     {'message': 'billing_period month must be between 1 and 12.'},
                 )
 
@@ -284,11 +294,10 @@ async def list_invoice_summaries(
                 start_epoch = utc_datetime_string_to_epoch_seconds(start_date)
                 end_epoch = utc_datetime_string_to_epoch_seconds(end_date)
             except ValueError as parse_error:
-                return format_response('error', {'message': str(parse_error)})
+                return _validation_error({'message': str(parse_error)})
 
             if end_epoch <= start_epoch:
-                return format_response(
-                    'error',
+                return _validation_error(
                     {
                         'message': (
                             'end_date must be later than start_date. The Invoicing service '
@@ -303,8 +312,7 @@ async def list_invoice_summaries(
             span_days = (end_epoch - start_epoch) // _SECONDS_PER_DAY
             max_days = _max_time_interval_days(start_epoch)
             if span_days > max_days:
-                return format_response(
-                    'error',
+                return _validation_error(
                     {
                         'message': (
                             f'start_date to end_date spans {span_days} days. The Invoicing '
@@ -355,4 +363,6 @@ async def list_invoice_summaries(
         return format_response('success', response_data)
 
     except Exception as e:
-        return await handle_aws_error(ctx, e, 'ListInvoiceSummaries', 'Invoicing')
+        return await handle_aws_error(
+            ctx, e, _LIST_IN
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_invoicing_tools.py` (modified, +29/-0)
```diff
@@ -67,6 +67,13 @@ def _factory(service_name, **kwargs):
     return _factory
 
 
+def _assert_validation_error(result):
+    """Local validation failures carry the same top-level classification as AWS errors."""
+    assert result['error_type'] == 'validation_error'
+    assert result['operation'] == 'ListInvoiceSummaries'
+    assert result['service'] == 'Invoicing'
+
+
 class TestListInvoiceSummariesSelector:
     """Selector resolution and account auto-detection."""
 
@@ -131,6 +138,7 @@ async def test_account_and_invoice_both_provided(self, mock_context):
 
         assert result['status'] == 'error'
         assert 'not both' in result['data']['message']
+        _assert_validation_error(result)
 
     @pytest.mark.asyncio
     async def test_sts_exception_returns_error(self, mock_context):
@@ -203,6 +211,7 @@ async def test_billing_period_and_dates_mutually_exclusive(self, mock_context):
 
         assert result['status'] == 'error'
         assert 'mutually' in result['data']['message'].lower()
+        _assert_validation_error(result)
 
     @pytest.mark.asyncio
     async def test_start_date_without_end_date(self, mock_context):
@@ -213,6 +222,7 @@ async def test_start_date_without_end_date(self, mock_context):
 
         assert result['status'] == 'error'
         assert 'together' in result['data']['message'].lower()
+        _assert_validation_error(result)
 
     @pytest.mark.asyncio
     async def test_invalid_billing_period_format(self, mock_context):
@@ -221,6 +231,16 @@ async def test_invalid_billing_period_format(self, mock_context):
 
         assert result['status'] == 'error'
         assert 'YYYY-MM' in result['data']['message']
+        _assert_validation_error(result)
+
+    @pytest.mark.asyncio
+    async def test_non_numeric_billing_period(self, mock_context):
+        """A billing_period with non-numeric parts returns a YYYY-MM error."""
+        result = await list_invoice_summaries(mock_context, billing_period='2026-ab')
+
+        assert result['status'] == 'error'
+        assert 'YYYY-MM' in result['data']['message']
+        _assert_validation_error(result)
 
     @pytest.mark.asyncio
     async def test_invalid_billing_period_month(self, mock_context):
@@ -229,6 +249,7 @@ async def test_invalid_billing_period_month(self, mock_context):
 
         assert result['status'] == 'error'
         assert 'month' in result['data']['message'].lower()
+        _assert_validation_error(result)
 
     @pytest.mark.asyncio
     async def test_invalid_date_format(self, mock_context):
@@ -242,6 +263,7 @@ async def test_invalid_date_format(self, mock_context):
 
         assert result['status'] == 'error'
         assert 'YYYY-MM-DD' in result['data']['message']
+        _assert_validation_error(result)
 
     @pytest.mark.asyncio
     async def test_account_selector_requires_time_filter(self, mock_context):
@@ -256,6 +278,7 @@ async def test_account_selector_requires_time_filter(self, mock_context):
         assert result['status'] == 'error'
         assert 'time filter is required' in result['data']['message']
         assert 'one call per month' in result['data']['message']
+        _assert_validation_error(result)
         mock_create.assert_not_called()
 
     @pytest.mark.asyncio
@@ -288,6 +311,7 @@ async def test_range_longer_than_a_month_is_rejected(self, mock_context):
 
         assert result['status'] == 'error'
         assert 'at most one month' in result['data']['message']
+        _assert_validation_error(result)
         assert result['data']['suggested_date_ranges'] == [
             {'start_date': '2026-05-14', 'end_date': '2026-06-01'},
             {'start_date': '2026-06-01', 'end_date': '2026-07-01'},
@@ -357,6 +381,7 @@ async def test_span_limit_follows_the_start_months_length(self, mock_context, sa
         assert allowed['status'] == 'success'
         assert rejected['status'] == 'error'
         assert '28 here' in rejected['data']['message']
+        _assert_validation_error(rejected)
 
     @pytest.mark.asyncio
     async def test_long_start_month_allows_a_31_day_span(self, mock_context, sample_summary):
@@ -426,6 +451,7 @@ async def test_reversed_range_is_rejected(self, mock_context):
         for result in (reversed_range, empty_range):
             assert result['status'] == 'error'
             assert 'later than start_date' in result['data']['message']
+            _assert_validation_error(result)
         mock_create.assert_not_called()
 
     @pytest.mark.asyncio
@@ -608,6 +634,9 @@ async def test_api_client_error(self, mock_context):
             )
 
         assert result['status'] == 'error'
+        assert result['error_type'] == 'AccessDeniedException'
+        assert result['operation'] == 'ListInvoiceSummaries'
+        assert result['service'] == 'Invoicing'
 
 
 class TestInvoicingServer:
```

---

### Incident Patch 3: `b7d641a7` (2026-10-03)
**Commit Message**: fix(billing-cost-management): add structured error_type to bcm-pricing-calc, cost-anomaly, and cost-explorer failures (#4716)

* fix(billing-cost-management): classify ClientError failures in bcm-pricing-calc, cost-anomaly, and cost-explorer

bcm-pricing-calc: the top-level handler and get_preferences read the AWS
message from a non-existent data.error key, always falling back to str(e)
and dropping handle_aws_error's classification. A failed preferences
check (including AccessDenied) was reported only as
PREFERENCES_NOT_CONFIGURED. Error responses now carry top-level
error_type, operation, and service; the four duplicated preference
short-circuit blocks share _preferences_error_response.

cost-anomaly: the bare `raise` for non-validation ClientErrors escaped
the tool, since the sibling `except Exception` does not catch exceptions
raised from another handler, and a missing AWS message crashed the
'2024' check. All ClientErrors now route through handle_aws_error;
ValidationException keeps its tailored message and data.error_code.

cost-explorer: collapse the identical ClientError/Exception handlers and
surface error_type='client_creation_error', operation, and service at the
top lev

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
 - Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
 - Fixed `session-sql` tool error responses omitting a structured error type. `execute_session_sql` caught every failure and returned a bare `{'status': 'error', 'message': ...}` with no `error_type`/`operation`, so failures surfaced without a classifiable type. Error responses now carry top-level `error_type`, `operation` (`session_sql`), and `service` (`SQL`). The `error_type` is the exception class name (e.g. `OperationalError`, `IntegrityError`, `ValueError`) -- a fixed identifier that never contains the query text or bound values, so no query content is exposed. The legacy `status='error'` and `message` payload is preserved for backward compatibility.
+- Fixed `bcm-pricing-calc`, `cost-anomaly`, and `cost-explorer` error responses missing a structured error type. `bcm-pricing-calc` read the AWS message from a non-existent `data.error` key and reported every `get_preferences` failure (including `AccessDenied`) only as `PREFERENCES_NOT_CONFIGURED`; error responses now carry top-level `error_type`, `operation`, and `service`. `cost-anomaly` local input validation (bad date format, `start_date` after `end_date`, a future `end_date`, unknown `feedback`/`total_impact_operator`, missing `total_impact_end`) now carries top-level `error_type='validation_error'`, `operation`, and `service`. `cost-explorer` client-creation failures now carry top-level `error_type='client_creation_error'`, `operation`, and `service`. The legacy `data` payload is preserved for backward compatibility.
 - Fixed the AWS Compute Optimizer `get_idle_recommendations` operation rejecting `ResourceType` and `Finding` filter values whose casing differs from the idle enums (e.g. `EbsVolume` instead of `EBSVolume`, `idle` instead of `Idle`). Passed values are now normalized case-insensitively against the idle enums read from the installed botocore service model, and the response echoes the normalized filters as `applied_filters`. An `InvalidParameterValueException` now returns a structured error listing `valid_resource_type_values` and `valid_finding_values` so callers can self-correct instead of retrying the same request.
 
 ## [0.0.4] - 2025-10-27
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/bcm_pricing_calculator_tools.py` (modified, +42/-34)
```diff
@@ -41,6 +41,29 @@
 )
 
 
+def _preferences_error_response(preferences_result: Dict[str, Any]) -> Dict[str, Any]:
+    """Build the error response for a failed get_preferences check.
+
+    Keeps the legacy data payload and adds top-level error_type, operation, and
+    service, so an AWS failure (e.g. AccessDenied) is not reported only as
+    PREFERENCES_NOT_CONFIGURED.
+
+    Args:
+        preferences_result: The dict returned by get_preferences on failure.
+
+    Returns:
+        Dict containing the error response
+    """
+    return format_response(
+        'error',
+        {'error': preferences_result['error'], 'error_code': 'PREFERENCES_NOT_CONFIGURED'},
+        preferences_result['error'],
+        error_type=preferences_result.get('error_type', 'PREFERENCES_NOT_CONFIGURED'),
+        operation='get_preferences',
+        service=BCM_PRICING_CALCULATOR_SERVICE_NAME,
+    )
+
+
 async def bcm_pricing_calc_core(
     ctx: Context,
     operation: str,
@@ -139,11 +162,7 @@ async def bcm_pricing_calc_core(
         elif operation == 'get_preferences':
             preferences_result = await get_preferences(ctx)
             if 'error' in preferences_result:
-                return format_response(
-                    'error',
-                    {'error': preferences_result['error']},
-                    preferences_result['error'],
-                )
+                return _preferences_error_response(preferences_result)
             else:
                 return format_response(
                     'success',
@@ -158,15 +177,19 @@ async def bcm_pricing_calc_core(
     except Exception as e:
         # Use shared error handler for consistent error handling
         error_response = await handle_aws_error(
-            ctx, e, operation, 'AWS Billing and Cost Management Pricing Calculator'
-        )
-        await ctx.error(
-            f'Failed to process AWS Billing and Cost Management Pricing Calculator request: {error_response.get("data", {}).get("error", str(e))}'
+            ctx, e, operation, BCM_PRICING_CALCULATOR_SERVICE_NAME
         )
+        # handle_aws_error puts the message and classification at the top level.
+        error_message = error_response.get('message', str(e))
+        full_message = f'Failed to process AWS Billing and Cost Management Pricing Calculator request: {error_message}'
+        await ctx.error(full_message)
         return format_response(
             'error',
-            {'error': error_response.get('data', {}).get('error', str(e))},
-            f'Failed to process AWS Billing and Cost Management Pricing Calculator request: {error_response.get("data", {}).get("error", str(e))}',
+            {'error': error_message},
+            full_message,
+            error_type=error_response.get('error_type', 'unknown_error'),
+            operation=operation,
+            service=BCM_PRICING_CALCULATOR_SERVICE_NAME,
         )
 
 
@@ -331,9 +354,12 @@ async def get_preferences(ctx: Context) -> dict:
         error_response = await handle_aws_error(
             ctx, e, 'get_preferences', BCM_PRICING_CALCULATOR_SERVICE_NAME
         )
-        error_msg = f'Failed to check BCM Pricing Calculator preferences: {error_response.get("data", {}).get("error", str(e))}'
+        error_msg = f'Failed to check BCM Pricing Calculator preferences: {error_response.get("message", str(e))}'
         await ctx.error(error_msg)
-        return {'error': error_msg}
+        return {
+            'error': error_msg,
+            'error_type': error_response.get('error_type', 'unknown_error'),
+        }
 
 
 async def list_workload_estimates(
@@ -383,13 +409,7 @@ async def list_workload_estimates(
         # Check preferences before proceeding
         preferences_result = await get_preferences(ctx)
         if 'error' in preferences_result:
-            return format_response(
-                'error',
-                {
-                    'error': preferences_result['error'],
-                    'error_code': 'PREFERENCES_NOT_CONFIGURED',
-                },
-            )
+            return _preferences_error_response(preferences_result)
 
         request_params: Dict[str, Any] = {}
         # Build request parameters
@@ -553,13 +573,7 @@ async def get_workload_estimate(
         # Check preferences before proceeding
         preferences_result = await get_preferences(ctx)
         if 'error' in preferences_result:
-            return format_response(
-                'error',
-                {
-                    'error': preferences_result['error'],
-                    'error_code': 'PREFERENCES_NOT_CONFIGURED',
-                },
-            )
+            return _preferences_error_response(preferences_result)
 
         # Build request parameters
         request_params: Dict[str, Any] = {'identifier': identifier}
@@ -653,13 +667,7 @@ async def list_workload_estimate_usage(
         # Check preferences before proceeding
         preferences_result = await get_p
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/cost_anomaly_tools.py` (modified, +27/-1)
```diff
@@ -92,13 +92,19 @@ async def cost_anomaly(
                 'error',
                 {'invalid_parameter': 'start_date'},
                 f'Invalid start_date format: {start_date}. Date must be in YYYY-MM-DD format.',
+                error_type='validation_error',
+                operation='cost_anomaly',
+                service='Cost Explorer',
             )
 
         if not validate_date_format(end_date):
             return format_response(
                 'error',
                 {'invalid_parameter': 'end_date'},
                 f'Invalid end_date format: {end_date}. Date must be in YYYY-MM-DD format.',
+                error_type='validation_error',
+                operation='cost_anomaly',
+                service='Cost Explorer',
             )
 
         # Parse dates for validation
@@ -115,6 +121,9 @@ async def cost_anomaly(
                 'error',
                 {'start_date': start_date, 'end_date': end_date},
                 'Invalid date range: start_date must be before or equal to end_date.',
+                error_type='validation_error',
+                operation='cost_anomaly',
+                service='Cost Explorer',
             )
 
         # Check if dates are in the future
@@ -123,6 +132,9 @@ async def cost_anomaly(
                 'error',
                 {'end_date': end_date},
                 'Invalid end_date: Cannot request anomalies for future dates.',
+                error_type='validation_error',
+                operation='cost_anomaly',
+                service='Cost Explorer',
             )
 
         # Check if dates are beyond the 90-day lookback period
@@ -149,6 +161,9 @@ async def cost_anomaly(
                 'error',
                 {'invalid_parameter': 'feedback', 'value': feedback},
                 f'Invalid feedback value: {feedback}. Must be one of: YES, NO, PLANNED_ACTIVITY.',
+                error_type='validation_error',
+                operation='cost_anomaly',
+                service='Cost Explorer',
             )
 
         # Validate total impact operator if provided
@@ -165,6 +180,9 @@ async def cost_anomaly(
                 'error',
                 {'invalid_parameter': 'total_impact_operator', 'value': total_impact_operator},
                 f'Invalid total_impact_operator: {total_impact_operator}. Must be one of: {", ".join(valid_operators)}',
+                error_type='validation_error',
+                operation='cost_anomaly',
+                service='Cost Explorer',
             )
 
         # Validate total_impact_end is provided when using BETWEEN operator
@@ -173,6 +191,9 @@ async def cost_anomaly(
                 'error',
                 {'missing_parameter': 'total_impact_end'},
                 'When using BETWEEN operator for total_impact, both total_impact_start and total_impact_end must be provided.',
+                error_type='validation_error',
+                operation='cost_anomaly',
+                service='Cost Explorer',
             )
 
         await ctx_logger.info(f'Retrieving cost anomalies from {start_date} to {end_date}')
@@ -196,7 +217,12 @@ async def cost_anomaly(
     except ValueError as e:
         # Handle date parsing errors
         return format_response(
-            'error', {'error_type': 'validation_error'}, f'Date validation error: {str(e)}'
+            'error',
+            {'error_type': 'validation_error'},
+            f'Date validation error: {str(e)}',
+            error_type='validation_error',
+            operation='cost_anomaly',
+            service='Cost Explorer',
         )
     except ClientError as e:
         # Handle AWS service-specific errors
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/cost_explorer_tools.py` (modified, +7/-6)
```diff
@@ -28,7 +28,6 @@
     get_tags,
     get_usage_forecast,
 )
-from botocore.exceptions import ClientError
 from fastmcp import Context, FastMCP
 from typing import Any, Dict, Optional
 
@@ -209,13 +208,18 @@ async def cost_explorer(
         ce_client = create_aws_client('ce')
     except Exception as client_error:
         await ctx.error(f'Failed to create AWS client: {str(client_error)}')
+        error_message = f'Failed to create AWS client: {str(client_error)}'
         return format_response(
             'error',
             {
                 'error_type': 'client_creation_error',
-                'message': f'Failed to create AWS client: {str(client_error)}',
+                'message': error_message,
                 'details': repr(client_error),
             },
+            error_message,
+            error_type='client_creation_error',
+            operation=operation,
+            service='Cost Explorer',
         )
 
     # Route to the appropriate operation handler
@@ -346,9 +350,6 @@ async def cost_explorer(
         else:
             return format_response('error', {'message': f'Unknown operation: {operation}'})
 
-    except ClientError as e:
-        # Let the shared handler take care of this
-        return await handle_aws_error(ctx, e, operation, 'Cost Explorer')
     except Exception as e:
-        # For all other exceptions, use the shared error handler
+        # The shared handler classifies ClientError and all other exceptions
         return await handle_aws_error(ctx, e, operation, 'Cost Explorer')
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/utilities/aws_service_base.py` (modified, +20/-1)
```diff
@@ -381,13 +381,24 @@ async def paginate_aws_response(
     return all_results, pagination_metadata
 
 
-def format_response(status: str, data: Any, message: Optional[str] = None) -> Dict[str, Any]:
+def format_response(
+    status: str,
+    data: Any,
+    message: Optional[str] = None,
+    *,
+    error_type: Optional[str] = None,
+    operation: Optional[str] = None,
+    service: Optional[str] = None,
+) -> Dict[str, Any]:
     """Format a standard API response.
 
     Args:
         status: Response status ("success" or "error")
         data: Response data payload
         message: Optional message to include
+        error_type: Optional error classification, set at the top level like handle_aws_error
+        operation: Optional name of the operation that produced the response
+        service: Optional AWS service name
 
     Returns:
         Dict containing a standardized response format
@@ -397,4 +408,12 @@ def format_response(status: str, data: Any, message: Optional[str] = None) -> Di
     if message:
         response['message'] = message
 
+    # Only added when supplied, so existing callers keep the same shape
+    if error_type is not None:
+        response['error_type'] = error_type
+    if operation is not None:
+        response['operation'] = operation
+    if service is not None:
+        response['service'] = service
+
     return response
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_aws_bcm_pricing_calculator_tools.py` (modified, +41/-6)
```diff
@@ -222,7 +222,11 @@ async def test_get_preferences_exception(
             {'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}}, 'GetPreferences'
         )
         mock_create_client.side_effect = error
-        mock_handle_error.return_value = {'data': {'error': 'Access denied'}}
+        mock_handle_error.return_value = {
+            'status': 'error',
+            'error_type': 'AccessDenied',
+            'message': 'Access denied',
+        }
 
         # Execute
         result = await get_preferences(mock_context)
@@ -235,6 +239,8 @@ async def test_get_preferences_exception(
         assert (
             'Failed to check BCM Pricing Calculator preferences: Access denied' in result['error']
         )
+        # The AWS classification is kept, not collapsed into "not configured"
+        assert result['error_type'] == 'AccessDenied'
         mock_context.error.assert_called()
 
 
@@ -341,6 +347,29 @@ async def test_list_workload_estimates_preferences_not_configured(
         assert result['status'] == 'error'
         assert result['data']['error_code'] == 'PREFERENCES_NOT_CONFIGURED'
 
+    @patch(
+        'awslabs.billing_cost_management_mcp_server.tools.bcm_pricing_calculator_tools.get_preferences'
+    )
+    async def test_list_workload_estimates_preferences_access_denied(
+        self, mock_get_preferences, mock_context
+    ):
+        """An AWS error from the preferences check keeps its error_type."""
+        # Setup
+        mock_get_preferences.return_value = {
+            'error': 'Failed to check BCM Pricing Calculator preferences: Access denied',
+            'error_type': 'AccessDenied',
+        }
+
+        # Execute
+        result = await list_workload_estimates(mock_context)
+
+        # Assert
+        assert result['status'] == 'error'
+        assert result['data']['error_code'] == 'PREFERENCES_NOT_CONFIGURED'
+        assert result['error_type'] == 'AccessDenied'
+        assert result['operation'] == 'get_preferences'
+        assert result['service'] == 'BCM Pricing Calculator'
+
     @patch(
         'awslabs.billing_cost_management_mcp_server.tools.bcm_pricing_calculator_tools.get_preferences'
     )
@@ -1802,6 +1831,9 @@ async def test_bcm_pricing_calc_core_get_preferences_operation_not_configured(
         assert result['status'] == 'error'
         assert result['data']['error'] == PREFERENCES_NOT_CONFIGURED_ERROR
         assert result['message'] == PREFERENCES_NOT_CONFIGURED_ERROR
+        assert result['error_type'] == 'PREFERENCES_NOT_CONFIGURED'
+        assert result['operation'] == 'get_preferences'
+        assert result['service'] == 'BCM Pricing Calculator'
         mock_context.info.assert_called_with(
             'Received BCM Pricing Calculator operation: get_preferences'
         )
@@ -1820,8 +1852,9 @@ async def test_bcm_pricing_calc_core_exception_handling(
         test_error = Exception('Test error')
         mock_get_workload_estimate.side_effect = test_error
         mock_handle_error.return_value = {
-            'data': {'error': 'Test error message'},
             'status': 'error',
+            'error_type': 'ValidationException',
+            'message': 'Test error message',
         }
 
         # Execute - call the core function directly
@@ -1834,7 +1867,7 @@ async def test_bcm_pricing_calc_core_exception_handling(
             mock_context,
             test_error,
             'get_workload_estimate',
-            'AWS Billing and Cost Management Pricing Calculator',
+            'BCM Pricing Calculator',
         )
         mock_context.error.assert_called_once()
         error_call_args = mock_context.error.call_args[0][0]
@@ -1850,6 +1883,9 @@ async def test_bcm_pricing_calc_core_exception_handling(
             'Failed to process AWS Billing and Cost Management Pricing Calculator request'
             in result['message']
         )
+        assert result['error_type'] == 'ValidationException'
+        assert result['operation'] == 'get_workload_estimate'
+        assert result['service'] == 'BCM Pricing Calculator'
 
     @patch(
         'awslabs.billing_cost_management_mcp_server.tools.bcm_pricing_calculator_tools.list_workload_estimates'
@@ -1865,8 +1901,7 @@ async def test_bcm_pricing_calc_core_exception_handling_no_error_in_response(
         test_error = Exception('Direct error message')
         mock_list_estimates.side_effect = test_error
         mock_handle_error.return_value = {
-            'data': {},  # No error field in data
-            'status': 'error',
+            'status': 'error',  # No message field
         }
 
         # Execute - call the core function directly
@@ -1877,7 +1912,7 @@ async def test_bcm_pricing_calc_core_exception_handling_no_error_in_response(
             mock_context,
             test_error,
             'list_workload_estimates',
-            'AWS Billing and Cost Management Pricing Calculator',
+            'BCM Pricing Calculator',
         )
         mock_context.error.
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_cost_anomaly_tools.py` (modified, +15/-0)
```diff
@@ -388,6 +388,13 @@ def test_cost_anomaly_server_initialization():
     )
 
 
+def _assert_validation_error(res):
+    """Local validation failures carry a top-level classification."""
+    assert res['error_type'] == 'validation_error'
+    assert res['operation'] == 'cost_anomaly'
+    assert res['service'] == 'Cost Explorer'
+
+
 def _reload_cost_anomaly_with_identity_decorator():
     """Reload cost_anomaly_tools with FastMCP.tool patched to return the original function unchanged (identity decorator).
 
@@ -423,6 +430,7 @@ async def test_ca_real_invalid_start_date_format(self, mock_context):
             assert res['status'] == 'error'
             assert 'Invalid start_date format' in res['message']
             assert res['data']['invalid_parameter'] == 'start_date'
+            _assert_validation_error(res)
 
     async def test_ca_real_invalid_end_date_format(self, mock_context):
         """Test cost_anomaly with invalid end_date format."""
@@ -437,6 +445,7 @@ async def test_ca_real_invalid_end_date_format(self, mock_context):
             assert res['status'] == 'error'
             assert 'Invalid end_date format' in res['message']
             assert res['data']['invalid_parameter'] == 'end_date'
+            _assert_validation_error(res)
 
     async def test_ca_real_start_date_after_end_date(self, mock_context):
         """Test cost_anomaly with start_date after end_date."""
@@ -450,6 +459,7 @@ async def test_ca_real_start_date_after_end_date(self, mock_context):
             res = await real_fn(mock_context, start_date='2023-01-31', end_date='2023-01-01')  # type: ignore[reportCallIssue]
             assert res['status'] == 'error'
             assert 'start_date must be before or equal to end_date' in res['message']
+            _assert_validation_error(res)
 
     async def test_ca_real_future_end_date(self, mock_context):
         """Test cost_anomaly with future end_date."""
@@ -467,6 +477,7 @@ async def test_ca_real_future_end_date(self, mock_context):
             res = await real_fn(mock_context, start_date='2023-01-01', end_date=future_date)  # type: ignore[reportCallIssue]
             assert res['status'] == 'error'
             assert 'Cannot request anomalies for future dates' in res['message']
+            _assert_validation_error(res)
 
     async def test_ca_real_old_start_date_warning(self, mock_context):
         """Test cost_anomaly with start_date more than 90 days old triggers warning."""
@@ -558,6 +569,7 @@ async def test_ca_real_invalid_feedback(self, mock_context):
             assert res['status'] == 'error'
             assert 'Invalid feedback value' in res['message']
             assert res['data']['invalid_parameter'] == 'feedback'
+            _assert_validation_error(res)
 
     async def test_ca_real_invalid_total_impact_operator(self, mock_context):
         """Test cost_anomaly with invalid total_impact_operator."""
@@ -576,6 +588,7 @@ async def test_ca_real_invalid_total_impact_operator(self, mock_context):
             )
             assert res['status'] == 'error'
             assert 'Invalid total_impact_operator' in res['message']
+            _assert_validation_error(res)
 
     async def test_ca_real_between_operator_missing_end_value(self, mock_context):
         """Test cost_anomaly with BETWEEN operator missing total_impact_end."""
@@ -598,6 +611,7 @@ async def test_ca_real_between_operator_missing_end_value(self, mock_context):
             assert (
                 'both total_impact_start and total_impact_end must be provided' in res['message']
             )
+            _assert_validation_error(res)
 
     async def test_ca_real_value_error_handling(self, mock_context):
         """Test cost_anomaly ValueError handling."""
@@ -618,6 +632,7 @@ async def test_ca_real_value_error_handling(self, mock_context):
             res = await real_fn(mock_context, start_date='2023-01-01', end_date='2023-01-31')  # type: ignore[reportCallIssue]
             assert res['status'] == 'error'
             assert 'Date validation error' in res['message']
+            _assert_validation_error(res)
 
     async def test_ca_real_client_error_2024_data(self, mock_context):
         """Test cost_anomaly ClientError with 2024 data issue."""
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_cost_explorer_tools.py` (modified, +19/-0)
```diff
@@ -1588,3 +1588,22 @@ async def test_ce_real_exception_flow_calls_handle_error_reload_identity_decorat
         assert res['status'] == 'error'
         assert 'boom' in res.get('message', '')
         mock_handle.assert_awaited_once()
+
+
+@pytest.mark.asyncio
+async def test_ce_real_client_creation_error_is_classified(mock_context):
+    """A client-creation failure carries top-level error_type/operation/service."""
+    ce_mod = _reload_ce_with_identity_decorator()
+    real_fn = ce_mod.cost_explorer  # type: ignore
+
+    with patch.object(ce_mod, 'create_aws_client') as mock_create_client:
+        mock_create_client.side_effect = Exception('no credentials')
+        res = await real_fn(mock_context, operation='getCostAndUsage')  # type: ignore
+
+    assert res['status'] == 'error'
+    assert res['error_type'] == 'client_creation_error'
+    assert res['operation'] == 'getCostAndUsage'
+    assert res['service'] == 'Cost Explorer'
+    assert res['message'] == 'Failed to create AWS client: no credentials'
+    # Legacy nested payload is preserved
+    assert res['data']['error_type'] == 'client_creation_error'
```

---

### Incident Patch 4: `93991b85` (2026-10-02)
**Commit Message**: fix(iam-mcp-server): treat NotAction/NotResource as broad and reject named IAM privesc actions on broad resources (#4701)

* fix(iam-mcp-server): harden inline-policy guard against NotAction/NotResource and named privesc actions

_check_wildcard_policy only inspected Action/Resource and only recognized
'*' and 'service:*' as broad actions, so two classes of equivalent grants
bypassed it on put_user_policy/put_role_policy:

- NotAction/NotResource: inverse matches such as NotAction 'iam:*' with
  Resource '*', or Action '*' with a NotResource, grant an unbounded set.
  They are now treated as a broad Action/Resource respectively, rejected
  only when paired with the other broad half.
- Named IAM privilege-escalation actions (iam:CreateAccessKey,
  iam:AttachUserPolicy, iam:PutRolePolicy, iam:PassRole, ...) on a broad
  Resource. Matching is case-insensitive, expands wildcards such as
  'iam:Put*', and accounts for NotAction. Resource-type-wide IAM ARNs such
  as 'role/*' also count as broad for these actions.

Escalation actions scoped to specific principal ARNs, read-only IAM
wildcards, and Deny statements remain allowed.

* test(iam-mcp-server): cover list form of NotAction in pri

**File**: `src/iam-mcp-server/awslabs/iam_mcp_server/server.py` (modified, +88/-10)
```diff
@@ -15,6 +15,7 @@
 """AWS IAM MCP Server implementation."""
 
 import argparse
+import fnmatch
 import json
 import re
 from awslabs.iam_mcp_server.aws_client import get_iam_client
@@ -78,6 +79,54 @@ def _check_denied_policy_arn(policy_arn: str) -> None:
 # Matches a service-scoped action wildcard such as 'iam:*' or 's3:*'.
 _SERVICE_WILDCARD_RE = re.compile(r'^[a-zA-Z0-9\-]+:\*$')
 
+# Matches an IAM resource-type-wide wildcard such as 'arn:aws:iam::123456789012:role/*'
+# or 'arn:aws-us-gov:iam::*:user/*', which covers every principal of that type.
+_IAM_RESOURCE_TYPE_WILDCARD_RE = re.compile(r'^arn:[^:]+:iam::[^:]*:[a-z-]+/\*$')
+
+# Named IAM actions that let the grantee escalate their own privileges without any
+# other permission (Rhino Security Labs / Cloudsplaining single-action methods), plus
+# iam:PassRole, which escalates when paired with any compute service, and the
+# permissions-boundary actions, which can lift a principal's own permission cap.
+# Stored lowercased because IAM action names are case-insensitive.
+PRIVILEGE_ESCALATION_ACTIONS = frozenset(
+    {
+        'iam:addusertogroup',
+        'iam:attachgrouppolicy',
+        'iam:attachrolepolicy',
+        'iam:attachuserpolicy',
+        'iam:createaccesskey',
+        'iam:createloginprofile',
+        'iam:createpolicyversion',
+        'iam:deleterolepermissionsboundary',
+        'iam:deleteuserpermissionsboundary',
+        'iam:passrole',
+        'iam:putgrouppolicy',
+        'iam:putrolepermissionsboundary',
+        'iam:putrolepolicy',
+        'iam:putuserpermissionsboundary',
+        'iam:putuserpolicy',
+        'iam:setdefaultpolicyversion',
+        'iam:updateassumerolepolicy',
+        'iam:updateloginprofile',
+    }
+)
+
+
+def _as_list(value: Any) -> Any:
+    """Normalize a policy element that may be a single string or a list of strings."""
+    return [value] if isinstance(value, str) else value
+
+
+def _matching_privilege_escalation_actions(patterns: List[str]) -> set:
+    """Return the privilege-escalation actions matched by the given action patterns.
+
+    Patterns may contain IAM wildcards ('*', '?'), e.g. 'iam:Put*' or 'iam:*Policy'.
+    """
+    lowered = [p.strip().lower() for p in patterns]
+    return {
+        a for a in PRIVILEGE_ESCALATION_ACTIONS if any(fnmatch.fnmatchcase(a, p) for p in lowered)
+    }
+
 
 def _check_wildcard_policy(policy_document: str) -> None:
     """Reject policy documents that grant overly broad access.
@@ -87,6 +136,19 @@ def _check_wildcard_policy(policy_document: str) -> None:
     ARN ending in ':*'). Checking only the literal '*'/'*' pair let equivalent grants
     such as Action 'iam:*' with Resource '*' through, which is still a full
     privilege-escalation primitive.
+
+    NotAction and NotResource are inverse matches ("everything except ..."), so they
+    count as a broad Action and a broad Resource respectively, whatever they list. A
+    finite exclusion list still leaves an unbounded grant, including actions and
+    resources that don't exist yet. They are rejected only when paired with the other
+    broad half: NotAction scoped to a specific resource ARN is still allowed, as is a
+    specific action with NotResource (no broader than that action on Resource '*').
+
+    Named IAM privilege-escalation actions (see PRIVILEGE_ESCALATION_ACTIONS), including
+    those reached through partial wildcards such as 'iam:Put*' or through NotAction, are
+    functionally equivalent to 'iam:*' for identity management. They are rejected on a
+    broad Resource or on every principal of a type (e.g. 'role/*'), and remain allowed
+    when scoped to specific principal ARNs.
     """
     doc = json.loads(policy_document)
     statements = doc.get('Statement', [])
@@ -95,25 +157,41 @@ def _check_wildcard_policy(policy_document: str) -> None:
     for stmt in statements:
         if stmt.get('Effect') != 'Allow':
             continue
-        actions = stmt.get('Action', [])
-        resources = stmt.get('Resource', [])
-        if isinstance(actions, str):
-            actions = [actions]
-        if isinstance(resources, str):
-            resources = [resources]
-
-        has_broad_action = any(a == '*' or _SERVICE_WILDCARD_RE.match(a) for a in actions)
-        has_broad_resource = any(
+        actions = _as_list(stmt.get('Action', []))
+        resources = _as_list(stmt.get('Resource', []))
+
+        has_broad_action = 'NotAction' in stmt or any(
+            a == '*' or _SERVICE_WILDCARD_RE.match(a) for a in actions
+        )
+        has_broad_resource = 'NotResource' in stmt or any(
             r == '*' or r == 'arn:*' or (r.startswith('arn:') and r.endswith(':*'))
             for r in resources
         )
 
         if has_broad_action and has_broad_resource:
             raise IamValidationError(
-                'Policy contains overly broad Action (wildcard or service:*) with broad Resource. '
+                'Policy contains overly broad Action 
```

**File**: `src/iam-mcp-server/tests/test_server.py` (modified, +192/-0)
```diff
@@ -1736,6 +1736,198 @@ async def test_put_user_policy_allows_service_wildcard_with_scoped_resource():
         assert 'Successfully' in result.message
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize('tool_name', ['put_user_policy', 'put_role_policy'])
+@pytest.mark.parametrize(
+    'stmt',
+    [
+        {'Effect': 'Allow', 'NotAction': 'iam:*', 'Resource': '*'},
+        {'Effect': 'Allow', 'NotAction': ['iam:*', 'sts:*', 'organizations:*'], 'Resource': '*'},
+        {'Effect': 'Allow', 'NotAction': 's3:DeleteBucket', 'Resource': 'arn:*'},
+        {'Effect': 'Allow', 'NotAction': 'iam:*', 'Resource': ['arn:aws:s3:::a', '*']},
+        {'Effect': 'Allow', 'Action': '*', 'NotResource': 'arn:aws:s3:::protected-bucket'},
+        {'Effect': 'Allow', 'Action': 'iam:*', 'NotResource': ['arn:aws:iam::123:role/a']},
+        {'Effect': 'Allow', 'NotAction': 'iam:*', 'NotResource': 'arn:aws:s3:::a'},
+    ],
+)
+async def test_inline_policy_rejects_not_action_not_resource(tool_name, stmt):
+    """NotAction/NotResource are inverse matches and must be treated as broad.
+
+    Inspecting only Action/Resource let statements such as NotAction 'iam:*' with
+    Resource '*' (every non-IAM action, account-wide) or Action '*' with a NotResource
+    (every action on everything but one resource) bypass the guard.
+    """
+    from awslabs.iam_mcp_server import server
+
+    Context.initialize(readonly=False, require_confirmation=False)
+    target = 'role_name' if tool_name == 'put_role_policy' else 'user_name'
+
+    with patch('awslabs.iam_mcp_server.server.get_iam_client') as mock_get_client:
+        mock_client = Mock()
+        mock_get_client.return_value = mock_client
+
+        with pytest.raises(IamValidationError) as exc_info:
+            await getattr(server, tool_name)(
+                **{target: 'test-principal'},
+                policy_name='bad-policy',
+                policy_document={'Version': '2012-10-17', 'Statement': [stmt]},
+                confirmed=True,
+            )
+        assert 'overly broad Action' in str(exc_info.value)
+        getattr(mock_client, tool_name).assert_not_called()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    'stmt',
+    [
+        {'Effect': 'Allow', 'NotAction': 's3:DeleteObject', 'Resource': 'arn:aws:s3:::b/*'},
+        {'Effect': 'Allow', 'Action': 's3:GetObject', 'NotResource': 'arn:aws:s3:::secret/*'},
+        {'Effect': 'Deny', 'NotAction': 'iam:*', 'Resource': '*'},
+        {'Effect': 'Deny', 'Action': '*', 'NotResource': 'arn:aws:s3:::a'},
+    ],
+)
+async def test_inline_policy_allows_scoped_not_action_not_resource(stmt):
+    """NotAction/NotResource are allowed when the other half is scoped, or in Deny statements."""
+    from awslabs.iam_mcp_server.server import put_user_policy
+
+    Context.initialize(readonly=False, require_confirmation=False)
+
+    with patch('awslabs.iam_mcp_server.server.get_iam_client') as mock_get_client:
+        mock_get_client.return_value = Mock()
+
+        result = await put_user_policy(
+            user_name='test-user',
+            policy_name='scoped-policy',
+            policy_document={'Version': '2012-10-17', 'Statement': [stmt]},
+            confirmed=True,
+        )
+        assert 'Successfully' in result.message
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize('tool_name', ['put_user_policy', 'put_role_policy'])
+@pytest.mark.parametrize(
+    'stmt',
+    [
+        # Exact reproduction from the report.
+        {
+            'Effect': 'Allow',
+            'Action': ['iam:CreateAccessKey', 'iam:AttachUserPolicy', 'iam:PutUserPolicy'],
+            'Resource': '*',
+        },
+        {'Effect': 'Allow', 'Action': 'iam:PutRolePolicy', 'Resource': '*'},
+        {'Effect': 'Allow', 'Action': 'iam:AddUserToGroup', 'Resource': '*'},
+        {'Effect': 'Allow', 'Action': 'iam:CreateLoginProfile', 'Resource': '*'},
+        {'Effect': 'Allow', 'Action': 'iam:PassRole', 'Resource': '*'},
+        # IAM action names are case-insensitive.
+        {'Effect': 'Allow', 'Action': 'IAM:createAccessKey', 'Resource': '*'},
+        # Partial wildcards that expand to escalation actions.
+        {'Effect': 'Allow', 'Action': 'iam:Put*', 'Resource': '*'},
+        {'Effect': 'Allow', 'Action': 'iam:*Policy', 'Resource': 'arn:aws:iam::*:*'},
+        {'Effect': 'Allow', 'Action': 'iam:Create?ccessKey', 'Resource': '*'},
+        # Mixed with benign actions/resources in the same statement.
+        {
+            'Effect': 'Allow',
+            'Action': ['s3:GetObject', 'iam:CreatePolicyVersion'],
+            'Resource': ['arn:aws:s3:::bucket/*', '*'],
+        },
+        # Every principal of a type is as broad as '*' for escalation.
+        {
+            'Effect': 'Allow',
+            'Action': 'iam:CreateAccessKey',
+            'Resource': 'arn:aws:iam::123456789012:user/*',
+        },
+        {'Effect': 'Allow', 'Action': 'iam:*', 'Resource': 'arn:aws-us-gov:iam::*:role/*'},
+      
```

---

### Incident Patch 5: `f280c32a` (2026-10-02)
**Commit Message**: fix(billing-cost-management): rename enterprise_support to enterprise-support (#4712)

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Added
 - Added `list-billing-view-segments` tool wrapping the read-only `billing:ListBillingViewSegments` API, which lists billing view segments over a time period — each segment identifies the billing domain (BILLABLE or PRO_FORMA) and the account relationships (management account, billing group, billing transfer) that applied during its time range
 - Added AWS Billing preferences support via a read-only `get-billing-preferences` tool (`GetBillingPreferences`) reporting which member accounts participate in the Reserved Instance / Savings Plans discount pool and in credit sharing, whether newly created accounts join automatically, whether sharing is open, whether billing alerts are enabled, and the per-billing-period history of those settings. This is the only source for an account's discount-sharing state
-- Added AWS Billing Enterprise Support data via an `enterprise_support` tool (`GetEnterpriseSupportChargeSummary`, `GetEnterpriseSupportContractDetails`, `ListEnterpriseSupportLinkedAccountCharges`) covering a billing period's Enterprise Support charge and the Support-eligible spend it was calculated from, the contract terms that govern how the charge is allocated, and the per-linked-account charge breakdown
+- Added AWS Billing Enterprise Support data via an `enterprise-support` tool (`GetEnterpriseSupportChargeSummary`, `GetEnterpriseSupportContractDetails`, `ListEnterpriseSupportLinkedAccountCharges`) covering a billing period's Enterprise Support charge and the Support-eligible spend it was calculated from, the contract terms that govern how the charge is allocated, and the per-linked-account charge breakdown
 - Added additional reservation cost and savings metrics to `get_reservation_utilization`: `on_demand_cost_of_ri_hours_used`, `net_ri_savings`, `total_potential_ri_savings`, `amortized_upfront_fee`, `amortized_recurring_fee`, `total_amortized_fee`, `ri_cost_for_unused_hours`, `realized_savings` and `unrealized_savings`.
 - Added AWS Billing credits support via a `credits` tool (`GetCredits`, `GetCreditAllocationHistory`) covering credit balance, expiration, product applicability, sharing configuration, and the per-service allocation ledger
 - Added AWS Compute Optimizer Automation support via a `compute-optimizer-automation` tool (`GetAutomationEvent`, `GetAutomationRule`, `GetEnrollmentConfiguration`, `ListAccounts`, `ListAutomationEvents`, `ListAutomationEventSteps`, `ListAutomationEventSummaries`, `ListAutomationRules`, `ListRecommendedActions`, `ListRecommendedActionSummaries`, `ListAutomationRulePreview`, `ListAutomationRulePreviewSummaries`, `ListTagsForResource`)
```

**File**: `src/billing-cost-management-mcp-server/README.md` (modified, +1/-1)
```diff
@@ -488,7 +488,7 @@ The server currently supports the following AWS services
     - get-billing-preferences
 
 16. **AWS Enterprise Support**
-    - `enterprise_support` tool: get_charge_summary, get_contract_details, list_linked_account_charges
+    - `enterprise-support` tool: get_charge_summary, get_contract_details, list_linked_account_charges
 
 17. **AWS Billing Views**
     - `get-billing-view`: retrieve metadata for a specific billing view
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/server.py` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@ async def on_call_tool(self, context, call_next):
 - cost-category: Describe and list cost category definitions (describe-cost-category-definition, list-cost-category-definitions)
 - invoicing: AWS Invoicing data — invoice summaries with amounts, tax, discounts/fees, currency/FX, due dates, PO numbers, and credit memos (operation: list_invoice_summaries)
 - credits: AWS Billing credits — credit balance, expiration, product applicability, sharing configuration, and the per-service allocation ledger (operations: get_credits, get_credit_allocation_history)
-- enterprise_support: AWS Enterprise Support charge data for a closed billing period — the Support charge and the Support-eligible spend it was calculated from, the contract terms that govern how the charge is allocated, and the per-linked-account breakdown (operations: get_charge_summary, get_contract_details, list_linked_account_charges)
+- enterprise-support: AWS Enterprise Support charge data for a closed billing period — the Support charge and the Support-eligible spend it was calculated from, the contract terms that govern how the charge is allocated, and the per-linked-account breakdown (operations: get_charge_summary, get_contract_details, list_linked_account_charges)
 
 PROMPTS:
 - savings_plans: Analyzes AWS usage and identifies opportunities for Savings Plans purchases
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/enterprise_support_operations.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 """Enterprise Support operations for the AWS Billing and Cost Management MCP server.
 
-This module contains the operation handlers for the ``enterprise_support`` tool.
+This module contains the operation handlers for the ``enterprise-support`` tool.
 Each operation validates the requested billing month, performs the AWS API call,
 normalizes timestamps for the agent, and returns a standardized response
 envelope. Every other field is passed through exactly as the API returned it so
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/enterprise_support_tools.py` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@
 
 """Enterprise Support tools for the AWS Billing and Cost Management MCP server.
 
-Exposes a single ``enterprise_support`` tool that routes by ``operation`` across
+Exposes a single ``enterprise-support`` tool that routes by ``operation`` across
 the Enterprise Support APIs, so the charge summary, the contract details
 and the per-linked-account charge breakdown are reached through one tool rather
 than three (mirroring the credits and cost-explorer tools). The rich tool
@@ -96,7 +96,7 @@ async def _enterprise_support(
 
 
 @enterprise_support_server.tool(
-    name='enterprise_support',
+    name='enterprise-support',
     description="""Access AWS Enterprise Support charge data: the Support charge for a billing period, the Support-eligible spend it was calculated from, the effective pricing plan, the contract terms that govern how the charge is allocated, and the per-linked-account breakdown. Choose an action with the required `operation` parameter.
 
 ## OPERATIONS
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_enterprise_support_tools.py` (modified, +3/-3)
```diff
@@ -58,12 +58,12 @@ def mock_context():
 
 
 async def _registered_tool():
-    """Return the registered enterprise_support tool, asserting it exists.
+    """Return the registered enterprise-support tool, asserting it exists.
 
     Returns:
         The registered FastMCP tool.
     """
-    tool = await enterprise_support_server.get_tool('enterprise_support')
+    tool = await enterprise_support_server.get_tool('enterprise-support')
     assert tool is not None
     return tool
 
@@ -104,7 +104,7 @@ class TestToolRegistration:
 
     @pytest.mark.asyncio
     async def test_tool_is_registered(self):
-        """The enterprise_support tool exists on the server."""
+        """The enterprise-support tool exists on the server."""
         tool = await _registered_tool()
 
         assert tool is not None
```

---

### Incident Patch 6: `8d8dec11` (2026-10-02)
**Commit Message**: fix(billing-cost-management-mcp-server)!: rename COH summaries field to estimated_total_deduped_savings (#4709)

Rename the Cost Optimization Hub list_recommendation_summaries response field
estimated_total_savings to estimated_total_deduped_savings, matching the API's
estimatedTotalDedupedSavings and making clear the total is de-duplicated.

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Added `material_spend` and `material_spend_fraction` to the Cost Optimization Hub `list_efficiency_metrics` `ranking_focus` disclosure (`ranking_mode='performance'`), reporting the kept groups' combined spend and their actual cumulative share of total spend so callers state the real share instead of the ~80% selection cutoff. The fraction is `null` when the fetch hits its page cap (total spend then covers only the fetched top spenders, not the whole org).
 
 ### Changed
+- Renamed the Cost Optimization Hub `list_recommendation_summaries` response field `estimated_total_savings` to `estimated_total_deduped_savings`, matching the API's `estimatedTotalDedupedSavings` and making clear the total is de-duplicated.
 - Clarified the AWS Invoicing `list_invoice_summaries` time-filter documentation to match service behavior: the one-month maximum on `start_date`/`end_date` ranges (and that calendar alignment is not required), that a date-only bound is 00:00:00 UTC so a full June is `2026-06-01` to `2026-07-01`, that a time filter is mandatory for the account selector but optional for `invoice_id`, and that `billing_period` and `start_date`/`end_date` are not interchangeable because they filter on billing month and issued date respectively.
 - Added read-only budget actions and notifications support to the `budget` tool: `budget-actions` and `budget-notifications`. Each routes by `budget_name` — a single-budget read (`DescribeBudgetActionsForBudget` / `DescribeNotificationsForBudget`) when a name is given, or an account-wide audit (`DescribeBudgetActionsForAccount` / `DescribeBudgetNotificationsForAccount`) when omitted. Both support pagination (`max_results`, `next_token`, `max_pages`) and offload large responses to session SQL
 - Added AWS Savings Plans support via three tools. `sp-explorer` (`DescribeSavingsPlans`, `DescribeSavingsPlanRates`, `DescribeSavingsPlansOfferings`, `DescribeSavingsPlansOfferingRates`) describes the plans an account owns, including the queued, returned, and payment-failed plans Cost Explorer does not report, along with the rates on owned plans and the offerings available to purchase. `sp-recommendation` (`GetSavingsPlansPurchaseRecommendation`, `GetSavingsPlanPurchaseRecommendationDetails`, `StartSavingsPlansPurchaseRecommendationGeneration`, `ListSavingsPlansPurchaseRecommendationGeneration`) returns the recommended commitment, the hourly data-points behind it, an on-demand refresh, and the generation history; `GetSavingsPlansPurchaseRecommendation` pages over the details nested inside its response and merges them, reporting completeness through `pagination`. `sp-purchase-analyzer` (`StartCommitmentPurchaseAnalysis`, `GetCommitmentPurchaseAnalysis`, `ListCommitmentPurchaseAnalyses`) runs Purchase Analyzer what-if analyses for maximum savings, a specific commitment, or a target average coverage
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/cost_optimization_hub_helpers.py` (modified, +1/-1)
```diff
@@ -419,7 +419,7 @@ def api_call(**params: Any) -> Dict[str, Any]:
         formatted_response: Dict[str, Any] = {
             'group_by': first_response.get('groupBy', group_by),
             'currency_code': first_response.get('currencyCode', 'USD'),
-            'estimated_total_savings': first_response.get('estimatedTotalDedupedSavings'),
+            'estimated_total_deduped_savings': first_response.get('estimatedTotalDedupedSavings'),
             'summaries': formatted_summaries,
         }
         if 'metrics' in first_response:
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_cost_optimization_hub_helpers.py` (modified, +1/-1)
```diff
@@ -756,7 +756,7 @@ async def test_pagination_with_max_pages(self, mock_context, mock_coh_client):
         # Boto3 was called exactly twice — max_pages stopped further fetches.
         assert mock_coh_client.list_recommendation_summaries.call_count == 2
         # Aggregate header comes from the FIRST response, not the last.
-        assert result['data']['estimated_total_savings'] == 600.0
+        assert result['data']['estimated_total_deduped_savings'] == 600.0
         # Resumption state is plumbed through under ``Pagination`` so the
         # caller can continue from page 3.
         pagination = result['data'].get('Pagination', {})
```

---

### Incident Patch 7: `6864d7bd` (2026-10-01)
**Commit Message**: fix(billing-cost-management): ES allocation needs contract details (#4699)

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/enterprise_support_tools.py` (modified, +3/-0)
```diff
@@ -165,6 +165,9 @@ async def _enterprise_support(
 
 This tool reports what Enterprise Support was charged and the spend it was derived from. It does not explain Enterprise Support pricing policy. For questions about why Support is priced a particular way, or why a specific charge type behaves as it does, point the customer to the public AWS Support plan FAQ at https://aws.amazon.com/premiumsupport/faqs/ rather than speculating. Questions about the overall bill, general discounts, or credits belong to the cost-explorer, invoicing and credits tools respectively.
 
+QUESTIONS THAT NEED MORE THAN ONE OPERATION:
+- "What is my support charge percentage across my accounts?", and any paraphrase asking how the charge is split, shared, distributed, or allocated, or asking for a per-account percentage. Call get_contract_details FIRST, because supportAllocationMethod decides what answers the question. Fixed_Percentage: the split is chargedPayerAccountIds[].chargePercentage and is already complete. Proportional: chargePercentage is 0.0 by definition and the split follows per-account spend, which only list_linked_account_charges carries, so call it too. Never present a split, computed or otherwise, before the method is known. chargedPayerAccountIds is payer-level while list_linked_account_charges is linked-account-level, so say which level you are reporting.
+
 EXAMPLES
 - {"operation": "get_charge_summary", "billing_month": "2026-06"}
 - {"operation": "get_contract_details", "billing_month": "2026-06"}
```

---

### Incident Patch 8: `4b9401bc` (2026-09-30)
**Commit Message**: fix: service name interpreation in policy (#4693)

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/aws/service.py` (modified, +2/-1)
```diff
@@ -112,7 +112,8 @@ def is_read_only_func(service: str, operation: str) -> bool:
     ):
         return PolicyDecision.ELICIT if policy.supports_elicitation else PolicyDecision.DENY
 
-    service_name = ir.command_metadata.service_sdk_name
+    # Policy entries use the CLI service name (e.g. s3api), which can differ from the SDK name (s3)
+    service_name = ir.command_metadata.service_cli_name or ir.command_metadata.service_sdk_name
     operation_name = ir.command_metadata.operation_sdk_name
     is_read_only = is_operation_read_only(ir, read_only_operations)
 
```

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/common/command_metadata.py` (modified, +1/-0)
```diff
@@ -23,3 +23,4 @@ class CommandMetadata:
     service_full_sdk_name: str | None
     operation_sdk_name: str
     has_streaming_output: bool = False
+    service_cli_name: str | None = None
```

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/parser/parser.py` (modified, +1/-0)
```diff
@@ -431,6 +431,7 @@ def _handle_service_command(
         service_full_sdk_name=_service_full_name(service_command.service_model),
         operation_sdk_name=operation_command._operation_model.name,
         has_streaming_output=operation_command._operation_model.has_streaming_output,
+        service_cli_name=service,
     )
     _validate_global_args(service, global_args)
     region = getattr(global_args, 'region', None)
```

**File**: `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/core/security/aws_api_customization.json` (modified, +3/-3)
```diff
@@ -267,7 +267,7 @@
         "aws emr wait"
       ]
     },
-    "emr terminate-cluster": {
+    "emr terminate-clusters": {
       "api_calls": [
         "aws emr terminate-job-flows"
       ]
@@ -279,12 +279,12 @@
         "aws iam update-assume-role-policy"
       ]
     },
-    "gamelist get-game-session-log": {
+    "gamelift get-game-session-log": {
       "api_calls": [
         "aws gamelift get-game-session-log-url"
       ]
     },
-    "gamelist upload-build": {
+    "gamelift upload-build": {
       "api_calls": [
         "aws gamelift create-build",
         "aws gamelift request-upload-credentials",
```

**File**: `src/aws-api-mcp-server/tests/aws/test_driver.py` (modified, +25/-5)
```diff
@@ -91,7 +91,10 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
             S3_CLI_NO_REGION,
             IRTranslation(
                 command_metadata=CommandMetadata(
-                    's3', 'Amazon Simple Storage Service', 'ListBuckets'
+                    's3',
+                    'Amazon Simple Storage Service',
+                    'ListBuckets',
+                    service_cli_name='s3api',
                 ),
             ),
         ),
@@ -142,7 +145,10 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
                     ).as_failure()
                 ],
                 command_metadata=CommandMetadata(
-                    'cloud9', 'AWS Cloud9', 'DescribeEnvironmentStatus'
+                    'cloud9',
+                    'AWS Cloud9',
+                    'DescribeEnvironmentStatus',
+                    service_cli_name='cloud9',
                 ),
             ),
         ),
@@ -156,7 +162,12 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
                         CommandMetadata('kinesis', 'Amazon Kinesis', 'GetRecords'),
                     ).as_failure()
                 ],
-                command_metadata=CommandMetadata('kinesis', 'Amazon Kinesis', 'GetRecords'),
+                command_metadata=CommandMetadata(
+                    'kinesis',
+                    'Amazon Kinesis',
+                    'GetRecords',
+                    service_cli_name='kinesis',
+                ),
             ),
         ),
         (
@@ -206,6 +217,7 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
                     's3',
                     'Amazon Simple Storage Service',
                     'GetBucketIntelligentTieringConfiguration',
+                    service_cli_name='s3api',
                 ),
             ),
         ),
@@ -267,13 +279,21 @@ def test_get_local_credentials_raises_no_credentials_error(mock_session_class):
             IRTranslation(
                 command=IRCommand(
                     command_metadata=CommandMetadata(
-                        'kinesis', 'Amazon Kinesis', 'DescribeStream'
+                        'kinesis',
+                        'Amazon Kinesis',
+                        'DescribeStream',
+                        service_cli_name='kinesis',
                     ),
                     region='us-east-1',
                     parameters={},
                     is_awscli_customization=False,
                 ),
-                command_metadata=CommandMetadata('kinesis', 'Amazon Kinesis', 'DescribeStream'),
+                command_metadata=CommandMetadata(
+                    'kinesis',
+                    'Amazon Kinesis',
+                    'DescribeStream',
+                    service_cli_name='kinesis',
+                ),
             ),
         ),
     ],
```

**File**: `src/aws-api-mcp-server/tests/test_security_policy.py` (modified, +63/-0)
```diff
@@ -1,5 +1,6 @@
 import json
 import pytest
+from awslabs.aws_api_mcp_server.core.aws.driver import translate_cli_to_ir
 from awslabs.aws_api_mcp_server.core.aws.service import (
     check_security_policy,
 )
@@ -822,3 +823,65 @@ def test_determine_policy_effect_require_mutation_consent():
         # Non-read-only operation should require elicitation
         decision = policy.determine_policy_effect('ec2', 'terminate_instances', False)
         assert decision == PolicyDecision.ELICIT
+
+
+@pytest.mark.parametrize(
+    'cli_command,policy_entry',
+    [
+        ('aws s3api delete-object --bucket b --key k', 'aws s3api delete-object'),
+        ('aws deploy delete-application --application-name a', 'aws deploy delete-application'),
+        (
+            'aws configservice delete-config-rule --config-rule-name r',
+            'aws configservice delete-config-rule',
+        ),
+    ],
+)
+@pytest.mark.parametrize(
+    'list_name,supports_elicitation,expected',
+    [
+        ('denyList', True, PolicyDecision.DENY),
+        ('elicitList', True, PolicyDecision.ELICIT),
+        ('elicitList', False, PolicyDecision.DENY),
+    ],
+)
+def test_check_security_policy_matches_cli_service_name(
+    tmp_path, cli_command, policy_entry, list_name, supports_elicitation, expected
+):
+    """Policy entries use the CLI service name, which differs from the SDK name for these services."""
+    policy_dir = tmp_path / '.aws' / 'aws-api-mcp'
+    policy_dir.mkdir(parents=True)
+    (policy_dir / 'mcp-security-policy.json').write_text(
+        json.dumps({'policy': {list_name: [policy_entry]}})
+    )
+    ir = translate_cli_to_ir(cli_command)
+
+    with patch.object(Path, 'home', return_value=tmp_path):
+        decision = check_security_policy(
+            ir, Mock(has=Mock(return_value=False)), create_mock_ctx(supports_elicitation)
+        )
+
+    assert decision == expected
+
+
+def test_customization_keys_are_valid_cli_commands():
+    """Each customization key must name a real CLI command, otherwise its rules never apply."""
+    from awslabs.aws_api_mcp_server.core.parser.parser import command_table
+    from awslabs.aws_api_mcp_server.core.security import policy
+
+    path = Path(policy.__file__).parent / 'aws_api_customization.json'
+    customizations = json.loads(path.read_text())['customizations']
+
+    def operations(service):
+        cmd = command_table.get(service)
+        if cmd is None:
+            return {}
+        # Service commands expose a command table; customizations like `s3` a subcommand table
+        return (
+            cmd._get_command_table()
+            if hasattr(cmd, '_get_command_table')
+            else cmd.subcommand_table
+        )
+
+    invalid = [key for key in customizations if key.split()[1] not in operations(key.split()[0])]
+
+    assert invalid == []
```

---

### Incident Patch 9: `32f2aea6` (2026-09-29)
**Commit Message**: fix(billing-cost-management-mcp-server): normalize ResourceType and Finding casing in get_idle_recommendations (#4682)

Case-fold ResourceType and Finding filter values onto the idle enums read
from the installed botocore service model, echo the normalized filters as
applied_filters, and return the valid enums on InvalidParameterValueException.

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
 - Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
 - Fixed `session-sql` tool error responses omitting a structured error type. `execute_session_sql` caught every failure and returned a bare `{'status': 'error', 'message': ...}` with no `error_type`/`operation`, so failures surfaced without a classifiable type. Error responses now carry top-level `error_type`, `operation` (`session_sql`), and `service` (`SQL`). The `error_type` is the exception class name (e.g. `OperationalError`, `IntegrityError`, `ValueError`) -- a fixed identifier that never contains the query text or bound values, so no query content is exposed. The legacy `status='error'` and `message` payload is preserved for backward compatibility.
+- Fixed the AWS Compute Optimizer `get_idle_recommendations` operation rejecting `ResourceType` and `Finding` filter values whose casing differs from the idle enums (e.g. `EbsVolume` instead of `EBSVolume`, `idle` instead of `Idle`). Passed values are now normalized case-insensitively against the idle enums read from the installed botocore service model, and the response echoes the normalized filters as `applied_filters`. An `InvalidParameterValueException` now returns a structured error listing `valid_resource_type_values` and `valid_finding_values` so callers can self-correct instead of retrying the same request.
 
 ## [0.0.4] - 2025-10-27
 ### Added
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/compute_optimizer_tools.py` (modified, +90/-4)
```diff
@@ -17,6 +17,7 @@
 Updated to use shared utility functions.
 """
 
+import botocore.session
 import os
 from ..utilities.aws_service_base import (
     create_aws_client,
@@ -28,7 +29,8 @@
 from ..utilities.time_utils import timestamp_to_utc_iso_string
 from botocore.exceptions import ClientError
 from fastmcp import Context, FastMCP
-from typing import Any, Dict, Optional
+from functools import lru_cache
+from typing import Any, Dict, List, Optional
 
 
 compute_optimizer_server = FastMCP(
@@ -75,7 +77,8 @@
 - Unattached: Resource exists but isn't connected to anything
 - Unused: Resource is provisioned but sees no meaningful activity
 Its `filters` accept the filter names `Finding` (values: Idle, Unattached, Unused) and
-`ResourceType`.""",
+`ResourceType`. Finding and ResourceType values are matched case-insensitively and
+normalized to the idle enum spelling (e.g. ebsvolume is sent as EBSVolume, idle as Idle).""",
 )
 async def compute_optimizer(
     ctx: Context,
@@ -809,6 +812,59 @@ async def get_ecs_service_recommendations(
     return format_response('success', formatted_response)
 
 
+# Idle filter name -> botocore enum shape that holds its valid values.
+_IDLE_FILTER_ENUM_SHAPES = {
+    'ResourceType': 'IdleRecommendationResourceType',
+    'Finding': 'IdleFinding',
+}
+
+
+@lru_cache(maxsize=None)
+def _idle_enum_canonical_map(shape_name: str) -> Dict[str, str]:
+    """Build a casefolded -> canonical map of an idle filter enum from the boto model.
+
+    Used to normalize passed `ResourceType` and `Finding` values onto the exact spelling
+    the idle API expects (e.g. `EbsVolume` -> `EBSVolume`, `idle` -> `Idle`); every valid
+    value is recoverable by case-folding alone. The enum is read from the installed
+    botocore service model rather than hardcoded, so new values are supported
+    automatically whenever boto3 is upgraded. The model is loaded offline (no AWS call).
+
+    Returns:
+        Mapping of casefolded value to canonical value. Returns an empty map if the
+        service model or shape cannot be loaded (normalization is then skipped).
+    """
+    try:
+        service_model: Any = botocore.session.get_session().get_service_model('compute-optimizer')
+        enum_values = service_model.shape_for(shape_name).enum
+    except Exception:
+        # Older boto3 without this shape, or model load failure: skip normalization.
+        return {}
+    return {value.casefold(): value for value in enum_values or []}
+
+
+def _normalize_idle_filters(filters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
+    """Fold `ResourceType` and `Finding` filter values onto the canonical idle enum spelling.
+
+    Unrecognized values are passed through unchanged: the installed botocore model is a
+    floor, so the service stays the authority on which values are valid.
+    """
+    normalized = []
+    for f in filters:
+        name = f.get('name') if isinstance(f, dict) else None
+        shape_name = _IDLE_FILTER_ENUM_SHAPES.get(name) if isinstance(name, str) else None
+        canonical = _idle_enum_canonical_map(shape_name) if shape_name else {}
+        if canonical:
+            values = f.get('values') or []
+            f = {
+                **f,
+                'values': [
+                    canonical.get(v.casefold(), v) if isinstance(v, str) else v for v in values
+                ],
+            }
+        normalized.append(f)
+    return normalized
+
+
 async def get_idle_recommendations(ctx, co_client, max_results, filters, account_ids, next_token):
     """Get idle resource recommendations.
 
@@ -828,7 +884,7 @@ async def get_idle_recommendations(ctx, co_client, max_results, filters, account
 
     # Parse the filters if provided
     if filters:
-        request_params['filters'] = parse_json(filters, 'filters')
+        request_params['filters'] = _normalize_idle_filters(parse_json(filters, 'filters'))
 
     # Parse the account IDs if provided
     if account_ids:
@@ -840,13 +896,43 @@ async def get_idle_recommendations(ctx, co_client, max_results, filters, account
 
     # Make the API call
     await ctx_logger.info(f'Calling get_idle_recommendations with parameters: {request_params}')
-    response = co_client.get_idle_recommendations(**request_params)
+    try:
+        response = co_client.get_idle_recommendations(**request_params)
+    except ClientError as e:
+        # The service's "Invalid filter value" names neither the rejected value nor the
+        # valid set, so surface the model's enum to let the caller self-correct instead
+        # of retrying the same call. Values that case-folding can't rescue (e.g. a resource
+        # type idle recommendations don't support) end up here.
+        if e.response.get('Error', {}).get('Code') != 'InvalidParameterValueException':
+            raise
+        return format_response(
+            'error',
+            {
+                'error_type': 'invalid_parameter_value',
+                'operation': 'get_idle_re
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_compute_optimizer_tools.py` (modified, +159/-0)
```diff
@@ -763,6 +763,165 @@ async def test_with_filters(self, mock_context, mock_co_client):
             assert call_kwargs['accountIds'] == ['123456789012']
             assert call_kwargs['nextToken'] == 'next-page-idle'
 
+    async def test_resource_type_filter_normalized_to_idle_casing(
+        self, mock_context, mock_co_client
+    ):
+        """Passed ResourceType and Finding values are normalized to the idle enum spelling."""
+        filters = json.dumps(
+            [
+                {'name': 'ResourceType', 'values': ['EbsVolume', 'ec2instance', 'NatGateway']},
+                {'name': 'Finding', 'values': ['unattached', 'IDLE', 'Unused']},
+            ]
+        )
+
+        result = await get_idle_recommendations(
+            mock_context,
+            mock_co_client,
+            max_results=None,
+            filters=filters,
+            account_ids=None,
+            next_token=None,
+        )
+
+        expected = [
+            {'name': 'ResourceType', 'values': ['EBSVolume', 'EC2Instance', 'NatGateway']},
+            {'name': 'Finding', 'values': ['Unattached', 'Idle', 'Unused']},
+        ]
+        call_kwargs = mock_co_client.get_idle_recommendations.call_args[1]
+        assert call_kwargs['filters'] == expected
+        assert result['status'] == 'success'
+        assert result['data']['applied_filters'] == expected
+
+    async def test_unknown_resource_type_passed_through(self, mock_context, mock_co_client):
+        """Values the installed model doesn't know (or non-strings) are forwarded unchanged."""
+        filters = json.dumps([{'name': 'ResourceType', 'values': ['SomeFutureType', 42]}])
+
+        await get_idle_recommendations(mock_context, mock_co_client, None, filters, None, None)
+
+        call_kwargs = mock_co_client.get_idle_recommendations.call_args[1]
+        assert call_kwargs['filters'] == [
+            {'name': 'ResourceType', 'values': ['SomeFutureType', 42]}
+        ]
+
+    async def test_unrelated_filter_names_passed_through(self, mock_context, mock_co_client):
+        """Filters without a known enum (other names, non-dict entries) are left untouched."""
+        filters = json.dumps([{'name': 'SomethingElse', 'values': ['ebsvolume']}, 'raw'])
+
+        await get_idle_recommendations(mock_context, mock_co_client, None, filters, None, None)
+
+        call_kwargs = mock_co_client.get_idle_recommendations.call_args[1]
+        assert call_kwargs['filters'] == [
+            {'name': 'SomethingElse', 'values': ['ebsvolume']},
+            'raw',
+        ]
+
+    async def test_invalid_parameter_value_returns_valid_enum(self, mock_context, mock_co_client):
+        """InvalidParameterValueException is returned with the valid ResourceType/Finding sets."""
+        from botocore.exceptions import ClientError
+
+        mock_co_client.get_idle_recommendations.side_effect = ClientError(
+            {
+                'Error': {
+                    'Code': 'InvalidParameterValueException',
+                    'Message': 'Invalid filter value',
+                }
+            },
+            'GetIdleRecommendations',
+        )
+        filters = json.dumps([{'name': 'ResourceType', 'values': ['LambdaFunction']}])
+
+        result = await get_idle_recommendations(
+            mock_context, mock_co_client, None, filters, None, None
+        )
+
+        assert result['status'] == 'error'
+        assert result['data']['error_type'] == 'invalid_parameter_value'
+        assert result['data']['filters'] == [
+            {'name': 'ResourceType', 'values': ['LambdaFunction']}
+        ]
+        valid = result['data']['valid_resource_type_values']
+        assert 'EBSVolume' in valid
+        assert 'LambdaFunction' not in valid
+        assert result['data']['valid_finding_values'] == ['Idle', 'Unattached', 'Unused']
+
+    async def test_other_client_errors_propagate(self, mock_context, mock_co_client):
+        """Non-InvalidParameterValue errors still reach the dispatcher's error ladder."""
+        from botocore.exceptions import ClientError
+
+        mock_co_client.get_idle_recommendations.side_effect = ClientError(
+            {'Error': {'Code': 'ThrottlingException', 'Message': 'slow down'}},
+            'GetIdleRecommendations',
+        )
+
+        with pytest.raises(ClientError):
+            await get_idle_recommendations(mock_context, mock_co_client, None, None, None, None)
+
+
+class TestIdleEnumCanonicalMap:
+    """Tests for the model-driven idle ResourceType/Finding normalization maps."""
+
+    def test_values_come_from_service_model(self):
+        """Canonical values are read from the installed botocore model, not a literal."""
+        import botocore.session
+
+        mod = importlib.import_module(
+            'awslabs.billing_cost_management_mcp_server.tools.compute_optimizer_tools'
+        )
+        model_enum = (
+            botocore.session.get_session()
+            .get_service_model('compute-optimizer')
+            .
```

---

### Incident Patch 10: `69a3cb03` (2026-09-29)
**Commit Message**: fix(billing-cost-management): add structured error_type to session-sql failures (#4680)

`execute_session_sql` caught every failure and returned a bare
`{'status': 'error', 'message': ...}` with no error_type, operation, or
service, so callers could not categorize session-sql tool failures and every
one surfaced as an unclassifiable error.

Error responses now carry a top-level `error_type`, `operation`
('session_sql'), and `service` ('SQL') alongside the existing status/message.
The `error_type` is the exception class name (e.g. 'OperationalError',
'IntegrityError', 'ValueError') -- a fixed Python identifier that never
contains the query text or any bound values, so no customer data is exposed.

The legacy `status='error'` and `message` payload is preserved unchanged for
backward compatibility. Adds unit tests for the SQLite and validation error
paths.

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Corrected AWS Compute Optimizer recommendation response field names so EC2, Auto Scaling group, Lambda, and RDS tools return actual values instead of null. Fixed the shared savings-opportunity parser (`savingsOpportunityPercentage`), projected utilization metrics, EC2/RDS idle flags, nested ASG instance types, and the RDS instance/storage recommendation schema.
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
 - Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
+- Fixed `session-sql` tool error responses omitting a structured error type. `execute_session_sql` caught every failure and returned a bare `{'status': 'error', 'message': ...}` with no `error_type`/`operation`, so failures surfaced without a classifiable type. Error responses now carry top-level `error_type`, `operation` (`session_sql`), and `service` (`SQL`). The `error_type` is the exception class name (e.g. `OperationalError`, `IntegrityError`, `ValueError`) -- a fixed identifier that never contains the query text or bound values, so no query content is exposed. The legacy `status='error'` and `message` payload is preserved for backward compatibility.
 
 ## [0.0.4] - 2025-10-27
 ### Added
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/utilities/sql_utils.py` (modified, +11/-1)
```diff
@@ -1495,7 +1495,17 @@ async def execute_session_sql(
         # Use context logger for consistent error reporting
         ctx_logger = get_context_logger(ctx, __name__)
         await ctx_logger.error(error_message, exc_info=True)
-        return {'status': 'error', 'message': error_message}
+
+        # Add a structured error_type/operation/service so failures are
+        # classifiable. error_type is the exception class name only (e.g.
+        # 'OperationalError').
+        return {
+            'status': 'error',
+            'service': 'SQL',
+            'operation': 'session_sql',
+            'error_type': type(e).__name__,
+            'message': error_message,
+        }
 
     finally:
         # Close connection only if it was successfully opened
```

**File**: `src/billing-cost-management-mcp-server/tests/utilities/test_sql_utils.py` (modified, +44/-0)
```diff
@@ -497,6 +497,50 @@ async def test_execute_with_error(self, mock_get_path, mock_connect, mock_contex
         assert 'Error executing SQL query' in result['message']
         assert 'SQL syntax error' in result['message']
 
+        # The error envelope carries a structured, query-content-free error_type
+        # plus operation/service so failures are classifiable. This exception is
+        # a manually constructed sqlite3.Error (no sqlite_errorname), so it falls
+        # back to the exception-class name ('Error').
+        assert result['error_type'] == 'Error'
+        assert result['operation'] == 'session_sql'
+        assert result['service'] == 'SQL'
+
+    @patch('awslabs.billing_cost_management_mcp_server.utilities.sql_utils.get_session_db_path')
+    async def test_execute_error_classified_by_exception_class(self, mock_get_path, mock_context):
+        """A real SQLite failure classifies by its exception class name."""
+        # Use a real in-memory connection (no sqlite3.connect mock) so a genuine
+        # sqlite3.OperationalError is raised.
+        mock_get_path.return_value = ':memory:'
+
+        # Query a table that does not exist -> real sqlite3.OperationalError.
+        result = await execute_session_sql(mock_context, 'SELECT * FROM missing_table')
+
+        assert result['status'] == 'error'
+        assert 'Error executing SQL query' in result['message']
+        assert result['error_type'] == 'OperationalError'
+        assert result['operation'] == 'session_sql'
+        assert result['service'] == 'SQL'
+
+    @patch('sqlite3.connect')
+    @patch('awslabs.billing_cost_management_mcp_server.utilities.sql_utils.get_session_db_path')
+    async def test_execute_validation_error_classified(
+        self, mock_get_path, mock_connect, mock_context
+    ):
+        """A blocked/harmful query classifies by its exception class ('ValueError')."""
+        mock_get_path.return_value = '/mock/path/session.db'
+        mock_connection = MagicMock()
+        mock_connection.cursor.return_value = MagicMock()
+        mock_connect.return_value = mock_connection
+
+        # validate_sql_query raises ValueError before execute is reached.
+        result = await execute_session_sql(mock_context, 'DROP TABLE users')
+
+        assert result['status'] == 'error'
+        assert 'Error executing SQL query' in result['message']
+        assert result['error_type'] == 'ValueError'
+        assert result['operation'] == 'session_sql'
+        assert result['service'] == 'SQL'
+
     @patch('sqlite3.connect')
     @patch('awslabs.billing_cost_management_mcp_server.utilities.sql_utils.get_session_db_path')
     async def test_execute_query_write_operation(self, mock_get_path, mock_connect, mock_context):
```

---

### Incident Patch 11: `1941e37b` (2026-09-25)
**Commit Message**: fix(billing-cost-management): route aws-pricing errors through handle_aws_error (#4676)

Each aws-pricing operation wrapped its body in a broad `except Exception`
that returned `format_response('error', ...)` — nesting everything under
`data` with no top-level `error_type`/`operation`. As a result the
`handle_aws_error` call in the tool wrapper was effectively dead code and
every aws-pricing failure surfaced without a classifiable error type.

Route each operation's except block through the shared `handle_aws_error`
so responses carry top-level `error_type` and `operation`, and give the two
non-exception "no results" cases (`get_service_attributes` service-not-found
and `get_pricing_from_api` empty price list) `error_type='no_results'` plus
`operation`. The legacy `data` payload is preserved for backward
compatibility. Adds unit tests covering each operation's error path.

**File**: `src/billing-cost-management-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Fixed `get_savings_plans_utilization_details` reporting every plan's utilization and savings as zero, from the same two causes. Rows now pass through as the API sends them, including the previously discarded `AmortizedCommitment` block and the whole of `Attributes` -- superseding the `summary` block, which read lowercase keys the API does not send, and exposing the owning `AccountId`
 - Corrected AWS Compute Optimizer recommendation response field names so EC2, Auto Scaling group, Lambda, and RDS tools return actual values instead of null. Fixed the shared savings-opportunity parser (`savingsOpportunityPercentage`), projected utilization metrics, EC2/RDS idle flags, nested ASG instance types, and the RDS instance/storage recommendation schema.
 - Corrected AWS Compute Optimizer ECS and Lambda recommendation response field names that read non-existent SDK fields and returned null. ECS now reads `currentPerformanceRisk`, `autoScalingConfiguration`, and `projectedUtilizationMetrics` (previously the non-existent `currentPerformance`, `autoScalingGroupArn`, and `projectedPerformance`), and Lambda derives the function name from the ARN (there is no `functionName` field).
+- Fixed `aws-pricing` tool error responses omitting a structured error type. Each `aws-pricing` operation caught exceptions and returned `format_response('error', ...)` (everything nested under `data`, no top-level `error_type`/`operation`), so the `handle_aws_error` call in the tool wrapper was never reached and failures surfaced without a classifiable type. Operation error paths now route through `handle_aws_error` so responses carry top-level `error_type` and `operation`, and the two non-exception "no results" cases (`get_service_attributes` service-not-found, `get_pricing_from_api` empty price list) carry `error_type='no_results'` plus `operation`. The legacy `data` payload is preserved for backward compatibility.
 
 ## [0.0.4] - 2025-10-27
 ### Added
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/aws_pricing_operations.py` (modified, +68/-36)
```diff
@@ -23,6 +23,7 @@
 from ..utilities.aws_service_base import (
     create_aws_client,
     format_response,
+    handle_aws_error,
     parse_json,
 )
 from ..utilities.logging_utils import get_context_logger
@@ -31,6 +32,8 @@
 from typing import Any, Dict, Optional
 
 
+AWS_PRICING_SERVICE_NAME = 'AWS Pricing'
+
 PRICING_API_REGIONS = {
     'classic': ['us-east-1', 'eu-central-1', 'ap-south-1'],
     'china': ['cn-northwest-1'],
@@ -140,8 +143,12 @@ async def get_service_codes(ctx: Context, max_results: Optional[int] = None) ->
         )
 
     except Exception as e:
-        # Use standard error format
-        return format_response('error', {'message': f'Error retrieving service codes: {str(e)}'})
+        # Route through the shared handler so the response carries a top-level
+        # error_type + operation (consistent structured error shape), while
+        # keeping the legacy `data.message` payload for backward compatibility.
+        classified = await handle_aws_error(ctx, e, 'get_service_codes', AWS_PRICING_SERVICE_NAME)
+        classified['data'] = {'message': f'Error retrieving service codes: {str(e)}'}
+        return classified
 
 
 async def get_service_attributes(ctx: Context, service_code: str) -> Dict[str, Any]:
@@ -165,9 +172,17 @@ async def get_service_attributes(ctx: Context, service_code: str) -> Dict[str, A
 
         # Check if service exists
         if not response.get('Services'):
-            return format_response(
-                'error', {'message': f'No service found with code: {service_code}'}
-            )
+            # Not an exception, but still an error response. Emit a top-level
+            # error_type + operation (consistent structured error shape) while
+            # keeping the legacy `data.message` payload for compatibility.
+            message = f'No service found with code: {service_code}'
+            return {
+                **format_response('error', {'message': message}),
+                'service': AWS_PRICING_SERVICE_NAME,
+                'operation': 'get_service_attributes',
+                'error_type': 'no_results',
+                'message': message,
+            }
 
         # Extract attributes
         attributes = []
@@ -189,11 +204,16 @@ async def get_service_attributes(ctx: Context, service_code: str) -> Dict[str, A
         )
 
     except Exception as e:
-        # Use standard error format
-        return format_response(
-            'error',
-            {'message': f'Failed to retrieve attributes for service {service_code}: {str(e)}'},
+        # Route through the shared handler so the response carries a top-level
+        # error_type + operation (consistent structured error shape), while
+        # keeping the legacy `data.message` payload for backward compatibility.
+        classified = await handle_aws_error(
+            ctx, e, 'get_service_attributes', AWS_PRICING_SERVICE_NAME
         )
+        classified['data'] = {
+            'message': f'Failed to retrieve attributes for service {service_code}: {str(e)}'
+        }
+        return classified
 
 
 async def get_attribute_values(
@@ -272,13 +292,16 @@ async def get_attribute_values(
         )
 
     except Exception as e:
-        # Use standard error format
-        return format_response(
-            'error',
-            {
-                'message': f'Failed to retrieve values for attribute {attribute_name} of service {service_code}: {str(e)}'
-            },
+        # Route through the shared handler so the response carries a top-level
+        # error_type + operation (consistent structured error shape), while
+        # keeping the legacy `data.message` payload for backward compatibility.
+        classified = await handle_aws_error(
+            ctx, e, 'get_attribute_values', AWS_PRICING_SERVICE_NAME
         )
+        classified['data'] = {
+            'message': f'Failed to retrieve values for attribute {attribute_name} of service {service_code}: {str(e)}'
+        }
+        return classified
 
 
 async def get_pricing_from_api(
@@ -354,20 +377,26 @@ async def get_pricing_from_api(
                 await ctx.info(f'Reached maximum results limit: {max_results}')
                 break
 
-        # Handle no results
+        # Handle no results. This is a genuine "no data" case rather than an
+        # exception, but it is still an error response: emit a top-level
+        # error_type + operation (consistent structured error shape) while
+        # keeping the legacy `data` payload (message + examples) for
+        # backward compatibility.
         if not all_price_list:
-            return format_response(
-                'error',
-                {
-                    'message': f'The service code "{service_code}" did not return any pricing data. AWS service codes typically follow patterns like "AmazonS3", "AmazonEC2", "AmazonES", etc. Please check the exact service code and try again.',
-                    'examples': {
-                  
```

**File**: `src/billing-cost-management-mcp-server/awslabs/billing_cost_management_mcp_server/tools/aws_pricing_tools.py` (modified, +2/-1)
```diff
@@ -21,6 +21,7 @@
 
 # Import operation handlers from local module
 from .aws_pricing_operations import (
+    AWS_PRICING_SERVICE_NAME,
     get_attribute_values,
     get_pricing_from_api,
     get_service_attributes,
@@ -134,4 +135,4 @@ async def aws_pricing(
 
     except Exception as e:
         # Use shared error handler for consistent error reporting
-        return await handle_aws_error(ctx, e, operation, 'AWS Pricing')
+        return await handle_aws_error(ctx, e, operation, AWS_PRICING_SERVICE_NAME)
```

**File**: `src/billing-cost-management-mcp-server/tests/tools/test_aws_pricing_tools.py` (modified, +100/-0)
```diff
@@ -737,6 +737,101 @@ async def test_ap_real_get_service_attributes_reload_identity_decorator(mock_con
     assert 'service_code is required' in res2.get('data', {}).get('message', '')
 
 
+# ---------------------------------------------------------------------------
+# Every aws-pricing error response must carry a top-level error_type +
+# operation so error metrics have a structured type to classify. The legacy
+# `data.*` payload is preserved for backward compatibility.
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_service_codes_error_carries_classifier_fields(mock_create_client):
+    """get_service_codes exception path: top-level error_type + operation, legacy data kept."""
+    mock_context = AsyncMock()
+    mock_create_client.side_effect = Exception('boom')
+
+    result = await get_service_codes(mock_context)
+
+    assert result['status'] == 'error'
+    assert 'error_type' in result
+    assert result['operation'] == 'get_service_codes'
+    # Backward-compatible legacy payload preserved.
+    assert 'Error retrieving service codes' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_service_attributes_error_carries_classifier_fields(mock_create_client):
+    """get_service_attributes exception path: top-level error_type + operation, legacy data kept."""
+    mock_context = AsyncMock()
+    mock_client = MagicMock()
+    mock_create_client.return_value = mock_client
+    mock_client.describe_services.side_effect = Exception('boom')
+
+    result = await get_service_attributes(mock_context, 'AmazonEC2')
+
+    assert result['status'] == 'error'
+    assert 'error_type' in result
+    assert result['operation'] == 'get_service_attributes'
+    assert 'Failed to retrieve attributes' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_service_attributes_no_results_carries_classifier_fields(mock_create_client):
+    """get_service_attributes 'no service found': error_type=no_results, legacy data.message kept."""
+    mock_context = AsyncMock()
+    mock_client = MagicMock()
+    mock_create_client.return_value = mock_client
+    mock_client.describe_services.return_value = {'Services': []}
+
+    result = await get_service_attributes(mock_context, 'NonExistentService')
+
+    assert result['status'] == 'error'
+    assert result['error_type'] == 'no_results'
+    assert result['operation'] == 'get_service_attributes'
+    assert 'NonExistentService' in result['message']
+    assert 'NonExistentService' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_attribute_values_error_carries_classifier_fields(mock_create_client):
+    """get_attribute_values exception path: top-level error_type + operation, legacy data kept."""
+    mock_context = AsyncMock()
+    mock_client = MagicMock()
+    mock_create_client.return_value = mock_client
+    mock_client.get_attribute_values.side_effect = Exception('boom')
+
+    result = await get_attribute_values(mock_context, 'AmazonEC2', 'instanceType')
+
+    assert result['status'] == 'error'
+    assert 'error_type' in result
+    assert result['operation'] == 'get_attribute_values'
+    assert 'Failed to retrieve values' in result['data']['message']
+
+
+@pytest.mark.asyncio
+@patch('awslabs.billing_cost_management_mcp_server.tools.aws_pricing_operations.create_aws_client')
+async def test_get_pricing_from_api_error_carries_classifier_fields(mock_create_client):
+    """get_pricing_from_api exception path: top-level error_type + operation, legacy data kept."""
+    mock_context = AsyncMock()
+    mock_client = MagicMock()
+    mock_create_client.return_value = mock_client
+    mock_client.get_products.side_effect = Exception('boom')
+
+    result = await get_pricing_from_api(mock_context, 'AmazonEC2')
+
+    assert result['status'] == 'error'
+    assert 'error_type' in result
+    assert result['operation'] == 'get_pricing_from_api'
+    # Legacy fields preserved for backward compatibility.
+    assert 'Pricing API request failed' in result['data']['message']
+    assert result['data']['service_code'] == 'AmazonEC2'
+    assert 'note' in result['data']
+
+
 @pytest.mark.asyncio
 async def test_ap_real_get_attribute_values_reload_identity_decorator(mock_context):
     """Test real aws_pricing get_attribute_values with identity decorator."""
@@ -1010,7 +1105,12 @@ async def test_get_pricing_from_api_no_results(
 
         result = await get_pricing_from_api(mock_context, 'InvalidService')
 
+        # No-results now carries t
```

---

### Incident Patch 12: `3e0418ff` (2026-09-23)
**Commit Message**: fix(aws-documentation-mcp-server)!: correct read-path output and make failures raise (#4650)

Correctness fixes in the HTML-to-markdown read path, plus a deliberate change to how the
read tools signal failure. All of it was found by reading real docs.aws.amazon.com pages
through the server and comparing the output to the rendered page.

Text was fused where markup separated it
- get_text(strip=True) strips each text node and joins them with nothing, so two
  endpoints came back as 'sts.a.amazonaws.comsts.a.api.aws' and the protocol cell as
  'HTTPSHTTPS'. Values now join with '; ', which keeps the Nth value in one column
  aligned with the Nth in the next.
- The same strip deleted the spaces around inline tags, so 'use the <code>Switch
  Role</code> feature' became 'use theSwitch Rolefeature'. Cells holding a link took a
  separate path that spaced correctly, so identical prose rendered two ways depending on
  whether an anchor happened to be present.
- Both section-title matches were affected, which is not cosmetic: a heading of
  'Using the <code>Switch Role</code> API' normalized to 'UsingtheSwitchRoleAPI', so a
  caller passing the heading as rendered got no match, and the erro

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/models.py` (modified, +0/-1)
```diff
@@ -129,5 +129,4 @@ class SearchTableResponse(BaseModel):
     tables_searched: int
     tables_with_matches: int
     results: List[TableResult]
-    error: Optional[str] = None
     hint: Optional[str] = None
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/server_aws.py` (modified, +0/-1)
```diff
@@ -338,7 +338,6 @@ async def search_table(
     - tables_searched: Number of tables searched
     - tables_with_matches: Number of tables containing matching rows
     - hint: Guidance message when no matches found, section not found, or no tables on page
-    - error: Error message on HTTP/transport failures only
     - results: Array of table result objects, each with:
         - table_heading: The sub-heading above the table (if any)
         - columns: Column headers for that table
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/server_aws_cn.py` (modified, +7/-1)
```diff
@@ -22,6 +22,7 @@
 
 # Import utility functions
 from awslabs.aws_documentation_mcp_server.util import (
+    UnreadablePageError,
     enforce_redirect_allowlist,
     extract_content_from_html,
     format_documentation_result,
@@ -234,7 +235,12 @@ async def get_available_services(
         )
 
     if is_html_content(page_raw, content_type):
-        content = extract_content_from_html(page_raw)
+        try:
+            content = extract_content_from_html(page_raw)
+        except UnreadablePageError as e:
+            logger.error(f'Failed to read {url_str}: {e}')
+            await ctx.error(f'Failed to read {url_str}: {e}')
+            content = f'Note: {e}'
     else:
         content = page_raw
 
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/server_utils.py` (modified, +122/-54)
```diff
@@ -13,12 +13,14 @@
 # limitations under the License.
 import httpx
 import os
+import posixpath
 from awslabs.aws_documentation_mcp_server.models import (
     SearchResponse,
     SearchTableResponse,
     TableResult,
 )
 from awslabs.aws_documentation_mcp_server.util import (
+    UnreadablePageError,
     enforce_redirect_allowlist,
     extract_content_from_html,
     extract_sections_from_html,
@@ -27,6 +29,7 @@
     truncate_large_tables,
 )
 from collections import deque
+from dataclasses import dataclass
 from importlib.metadata import version
 from loguru import logger
 from mcp.server.mcpserver import Context
@@ -64,6 +67,53 @@ def _docs_client(allowed_domain_regexes: Sequence[str]) -> httpx.AsyncClient:
 )
 
 
+# - '/a/index.html' 301s to '/a/' everywhere on the site
+# - a missing page gets a 302 to '/a/' instead
+_DIRECTORY_INDEX_FILENAME = 'index.html'
+
+
+def _normalize_path(path: str) -> str:
+    """Reduce a URL path to the page it addresses, so cosmetic rewrites compare equal."""
+    # normpath collapses interior '//' but keeps a leading one, so strip it.
+    resolved = posixpath.normpath(path or '/').replace('//', '/', 1)
+    if posixpath.basename(resolved).lower() == _DIRECTORY_INDEX_FILENAME:
+        resolved = posixpath.dirname(resolved)
+    return resolved.rstrip('/') or '/'
+
+
+def _page_identity(url: str) -> str:
+    """Reduce a URL to host and path, so scheme, query, fragment and path spelling do not differ."""
+    parsed = httpx.URL(url)
+    return f'{parsed.host}{_normalize_path(parsed.path)}'
+
+
+def _without_query(url: str) -> str:
+    """Drop the session and query parameters, so URLs compare and display cleanly."""
+    return url.split('?', 1)[0]
+
+
+@dataclass(frozen=True)
+class Page:
+    """The page asked for and the page that answered."""
+
+    requested: str
+    served: str
+
+    @classmethod
+    def of(cls, url_str: str, response: httpx.Response) -> 'Page':
+        """Build from a completed response, stripping query parameters from both URLs."""
+        return cls(_without_query(url_str), _without_query(str(response.url)))
+
+    def message(self, *parts: str) -> str:
+        """Join a substitution note and any reasons into one sentence run."""
+        note = (
+            f'Requested {self.requested}; served {self.served}.'
+            if _page_identity(self.served) != _page_identity(self.requested)
+            else ''
+        )
+        return ' '.join(part for part in (note, *parts) if part)
+
+
 async def read_documentation_impl(
     ctx: Context,
     url_str: str,
@@ -97,24 +147,36 @@ async def read_documentation_impl(
             error_msg = f'Failed to fetch {url_str}: {str(e)}'
             logger.error(error_msg)
             await ctx.error(error_msg)
-            return error_msg
+            raise ValueError(error_msg) from e
+
+        page = Page.of(url_str, response)
 
         if response.status_code >= 400:
-            error_msg = f'Failed to fetch {url_str} - status code {response.status_code}'
+            error_msg = page.message(
+                f'Failed to fetch {page.served} - status code {response.status_code}'
+            )
             logger.error(error_msg)
             await ctx.error(error_msg)
-            return error_msg
+            raise ValueError(error_msg)
 
         page_raw = response.text
         content_type = response.headers.get('content-type', '')
 
     if is_html_content(page_raw, content_type):
-        content = extract_content_from_html(page_raw)
-        content = truncate_large_tables(content, url=url_str)
+        try:
+            content = extract_content_from_html(page_raw)
+        except UnreadablePageError as e:
+            error_msg = page.message(f'{page.served} could not be read: {e}')
+            logger.error(error_msg)
+            await ctx.error(error_msg)
+            raise ValueError(error_msg) from e
+        content = truncate_large_tables(content, url=page.served)
     else:
         content = page_raw
 
-    result = format_documentation_result(url_str, content, start_index, max_length)
+    result = format_documentation_result(page.served, content, start_index, max_length)
+    if note := page.message():
+        result = f'<e>{note}</e>\n\n{result}'
 
     # Log if content was truncated
     if len(content) > start_index + max_length:
@@ -201,44 +263,59 @@ async def read_sections_impl(
             error_msg = f'Failed to fetch {url_str}: {str(e)}'
             logger.error(error_msg)
             await ctx.error(error_msg)
-            return error_msg
+            raise ValueError(error_msg) from e
+
+        page = Page.of(url_str, response)
 
         if response.status_code >= 400:
-            error_msg = f'Failed to fetch {url_str} - status code {response.status_code}'
+            error_msg = page.message(
+                f'Failed to fetch {page.served} - status code {response.status_code}'
+            )
             logger.error(error_msg)
          
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/table_utils.py` (modified, +135/-15)
```diff
@@ -14,11 +14,119 @@
 """Table parsing and filtering utilities for AWS Documentation MCP Server."""
 
 import re
+from awslabs.aws_documentation_mcp_server.util import (
+    UnreadablePageError,
+    has_empty_link_target,
+    has_readable_text,
+)
 from bs4 import BeautifulSoup, Tag
 from bs4.element import NavigableString
 from typing import Optional
 
 
+# callout markup: block gets 'awsdocs-note', title gets 'awsdocs-note-title'
+_CALLOUT_CLASSES = ('awsdocs-note-title', 'awsdocs-note')
+_CALLOUT_TITLE_CLASS = 'awsdocs-note-title'
+_HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
+
+
+def _in_callout(element: Tag) -> bool:
+    """Report whether an element belongs to a callout rather than to content."""
+    for candidate in (element, *element.parents):
+        classes = candidate.get('class') or [] if isinstance(candidate, Tag) else []
+        if any(cls in _CALLOUT_CLASSES for cls in classes):
+            return True
+    return False
+
+
+# '; ' keeps the Nth value in one column aligned with the Nth in the next
+# without it two endpoints fuse: 'sts.a.amazonaws.comsts.a.api.aws'
+_VALUE_DELIMITER = '; '
+_BREAK_MARKER = '\x00'  # boundary marker; whitespace would be stripped, this survives
+# - callout prose is not a value, it modifies one
+# - so its boundary collapses to a space
+_SOFT_MARKER = '\x01'
+_BREAK_TAGS = ['br', 'p', 'div', 'li', 'dt', 'dd', 'tr']
+
+
+# - 'a | callout | b' -> 'a callout; b'
+# - absorb before, keep after
+_ADJACENT_MARKERS = re.compile(f'[{_BREAK_MARKER}\\s]*{_SOFT_MARKER}[{_SOFT_MARKER}\\s]*')
+# - a leading callout has no value before it, so it qualifies the one after
+# - 'callout | a | b' -> 'callout a; b'
+_LEADING_CALLOUT = re.compile(
+    f'^([{_BREAK_MARKER}\\s]*{_SOFT_MARKER}[^{_BREAK_MARKER}]*){_BREAK_MARKER}+'
+)
+
+
+def _join_values(text: str) -> str:
+    """Join marker-separated values with '; ', dropping empty segments."""
+    absorbed = _ADJACENT_MARKERS.sub(_SOFT_MARKER, text)
+    absorbed = _LEADING_CALLOUT.sub(f'\\1{_SOFT_MARKER}', absorbed)
+    segments = (_collapse_soft_breaks(segment) for segment in absorbed.split(_BREAK_MARKER))
+    return _VALUE_DELIMITER.join(segment for segment in segments if segment)
+
+
+def _collapse_soft_breaks(segment: str) -> str:
+    """Reduce soft boundaries and surrounding whitespace to single spaces."""
+    return ' '.join(segment.replace(_SOFT_MARKER, ' ').split())
+
+
+def _mark_breaks(cell: Tag) -> None:
+    """Insert boundary markers at <br /> and block-element edges inside a cell."""
+    for tag in (t for t in cell.find_all(_BREAK_TAGS) if isinstance(t, Tag)):
+        marker = _SOFT_MARKER if _in_callout(tag) else _BREAK_MARKER
+        if tag.name == 'br':
+            tag.replace_with(NavigableString(marker))
+        else:
+            tag.insert_before(NavigableString(marker))
+            tag.insert_after(NavigableString(marker))
+
+
+def _mark_preformatted_lines(cell: Tag) -> None:
+    """Treat newlines inside <pre> as value boundaries, where they are significant markup."""
+    for pre in (p for p in cell.find_all('pre') if isinstance(p, Tag)):
+        for text in list(pre.find_all(string=True)):
+            raw = str(text)
+            if '\n' in raw:
+                text.replace_with(NavigableString(re.sub(r'\n+', _BREAK_MARKER, raw)))
+
+
+def _strip_callout_titles(cell: Tag) -> None:
+    """Remove 'Note' and 'Important' labels, which are chrome rather than cell content."""
+    for title in (t for t in cell.find_all(class_=_CALLOUT_TITLE_CLASS) if isinstance(t, Tag)):
+        title.decompose()
+
+
+def _replace_images_with_alt(cell: Tag) -> None:
+    """Replace each image with its alt text; an icon's meaning is written only there."""
+    for img in (i for i in cell.find_all('img') if isinstance(i, Tag)):
+        alt = str(img.get('alt', '')).strip()
+        img.replace_with(NavigableString(f' {alt} ' if alt else ''))
+
+
+def _cell_text(cell: Tag) -> str:
+    """Extract cell text, joining multi-value cells with '; '."""
+    _strip_callout_titles(cell)
+    _replace_images_with_alt(cell)
+    _mark_preformatted_lines(cell)
+    _mark_breaks(cell)
+    return _join_values(cell.get_text())
+
+
+def _heading_text(heading: Tag) -> str:
+    """Extract heading text, dropping markers left behind by cell processing."""
+    return _join_values(heading.get_text())
+
+
+def _nearest_heading(table: Tag) -> Optional[Tag]:
+    """Find the heading a table sits under, skipping callout titles."""
+    heading = table.find_previous(_HEADING_TAGS)
+    while isinstance(heading, Tag) and _in_callout(heading):
+        heading = heading.find_previous(_HEADING_TAGS)
+    return heading if isinstance(heading, Tag) else None
+
+
 def _safe_span(cell: Tag, attr: str) -> int:
     """Safely parse a colspan/rowspan attribute, returning at least 1."""
     try:
@@ -47,6 +155,9 @@ def parse_html_tables(html: str, section_title: Optional[str] = None) -> Optiona
     """
     soup = BeautifulSoup(ht
```

**File**: `src/aws-documentation-mcp-server/awslabs/aws_documentation_mcp_server/util.py` (modified, +61/-8)
```diff
@@ -21,6 +21,44 @@
 from urllib.parse import quote_plus, urljoin
 
 
+# An unresolved cross-reference leaves an href with no filename, e.g. './.html#anchor'.
+_EMPTY_TARGET_FILENAMES = frozenset({'.html', '.htm'})
+
+
+def has_empty_link_target(href: str) -> bool:
+    """Report whether an href points at a path with no filename."""
+    path = href.split('#', 1)[0].split('?', 1)[0].strip()
+    if not path:
+        return False  # fragment-only link; resolves to the current page
+    return path.rsplit('/', 1)[-1].casefold() in _EMPTY_TARGET_FILENAMES
+
+
+def _unwrap_broken_links(root) -> None:
+    """Replace links whose target has no filename with their own text."""
+    for anchor in root.find_all('a'):
+        href = anchor.get('href')
+        if isinstance(href, str) and has_empty_link_target(href):
+            anchor.unwrap()
+
+
+class UnreadablePageError(ValueError):
+    """Raised when a page carries no extractable content, only markup."""
+
+
+def has_readable_text(soup) -> bool:
+    """Report whether a parsed document has body text outside scripts and styles."""
+    from bs4 import Comment
+
+    body = soup.body or soup
+    return any(
+        text.strip()
+        for text in body.find_all(string=True)
+        # comments are markup; <noscript> prose can be nested several levels down
+        if not isinstance(text, Comment)
+        and text.find_parent(['script', 'style', 'noscript']) is None
+    )
+
+
 def extract_content_from_html(html: str) -> str:
     """Extract and convert HTML content to Markdown format.
 
@@ -29,9 +67,12 @@ def extract_content_from_html(html: str) -> str:
 
     Returns:
         Simplified markdown version of the content
+
+    Raises:
+        UnreadablePageError: the page carries no extractable content
     """
     if not html:
-        return '<e>Empty HTML content</e>'
+        raise UnreadablePageError('Empty HTML content')
 
     try:
         # First use BeautifulSoup to clean up the HTML
@@ -86,6 +127,13 @@ def extract_content_from_html(html: str) -> str:
             for element in main_content.select(selector):
                 element.decompose()
 
+        # strip= keeps a tag's text, so remove these outright
+        for selector in ('script', 'style'):
+            for element in main_content.select(selector):
+                element.decompose()
+
+        _unwrap_broken_links(main_content)
+
         # Define tags to strip - these are elements we don't want in the output
         tags_to_strip = [
             'script',
@@ -128,20 +176,22 @@ def extract_content_from_html(html: str) -> str:
         content = markdownify.markdownify(
             str(main_content),
             heading_style=markdownify.ATX,
-            autolinks=True,
-            default_title=True,
+            autolinks=False,  # markdownify gates this on default_title; keep [url](url)
+            default_title=False,  # would repeat the href as the title: [text](url "url")
             escape_asterisks=True,
             escape_underscores=True,
             newline_style='SPACES',
             strip=tags_to_strip,
         )
 
-        if not content:
-            return '<e>Page failed to be simplified from HTML</e>'
+        if not content.strip():
+            raise UnreadablePageError('Page failed to be simplified from HTML')
 
         return content
+    except UnreadablePageError:
+        raise
     except Exception as e:
-        return f'<e>Error converting HTML to Markdown: {str(e)}</e>'
+        raise UnreadablePageError(f'Error converting HTML to Markdown: {str(e)}') from e
 
 
 def is_html_content(page_raw: str, content_type: str) -> bool:
@@ -240,6 +290,9 @@ def extract_sections_from_html(html: str, section_titles: List[str]) -> str:
 
     soup = BeautifulSoup(html, 'html.parser')
 
+    if not has_readable_text(soup):
+        raise UnreadablePageError('The page carries no readable content.')
+
     normalized_titles = {}
     for title in section_titles:
         normalized_key = ' '.join(title.strip().lower().split())
@@ -251,10 +304,10 @@ def extract_sections_from_html(html: str, section_titles: List[str]) -> str:
     found_sections = set()
 
     for h2 in h2_tags:
-        h2_text = h2.get_text(strip=True)
+        h2_text = ' '.join(h2.get_text().split())
         available_level2_sections.append(h2_text)
 
-        normalized_h2 = ' '.join(h2_text.lower().split())
+        normalized_h2 = h2_text.lower()
 
         if normalized_h2 in normalized_titles:
             section_content = [h2]
```

**File**: `src/aws-documentation-mcp-server/tests/test_aws_cn_get_available_services_live.py` (modified, +11/-8)
```diff
@@ -11,6 +11,7 @@
 """Live test for the get_available_services tool in the AWS Documentation MCP server."""
 
 import pytest
+import re
 from awslabs.aws_documentation_mcp_server.server_aws_cn import get_available_services
 from mcp.server.mcpserver import Context
 from tests.constants import TEST_USER_AGENT
@@ -72,17 +73,19 @@ async def test_get_available_services_live():
             assert indicator not in result, f"Found error indicator '{indicator}' in the result"
 
         # Check for specific AWS services that should be available in China regions
-        common_services = [
-            'Amazon EC2',
-            'Simple Storage Service',
-            'Lambda',
-        ]
+        common_service_slugs = ['ec2', 's3', 'lambda']
 
-        for service in common_services:
-            assert service.lower() in result.lower(), (
-                f"Expected to find '{service}' in the available services"
+        for slug in common_service_slugs:
+            assert f'userguide/{slug}.html' in result, (
+                f"Expected to find a link to '{slug}' in the available services"
             )
 
+        # The list should be a substantial catalogue, not a stub or a partial render.
+        service_links = re.findall(r'\[[^\]]+\]\([^)]*userguide/[^)]+\)', result)
+        assert len(service_links) > 50, (
+            f'Expected a full service catalogue, found only {len(service_links)} links'
+        )
+
         # Print a sample of the result for debugging (will show in pytest output with -v flag)
         print('\nReceived AWS China available services content (first 300 chars):')
         print(f'{result[:300]}...')
```

**File**: `src/aws-documentation-mcp-server/tests/test_aws_search_table_live.py` (modified, +47/-0)
```diff
@@ -150,3 +150,50 @@ async def test_search_table_multi_table_section():
         assert result.tables_with_matches >= 1
         # ImportImage is in the VM Import/Export table, not the main EC2 table
         assert any('ImportImage' in str(r.rows) for r in result.results)
+
+
+@pytest.mark.asyncio
+@pytest.mark.live
+async def test_no_header_row_is_returned_as_data():
+    """Live AWS tables carry a <thead> and no <tbody>, so the header must not parse as a row."""
+    url = 'https://docs.aws.amazon.com/general/latest/gr/sts.html'
+    ctx = MockContext()
+
+    with patch(
+        'awslabs.aws_documentation_mcp_server.server_aws.DEFAULT_USER_AGENT',
+        TEST_USER_AGENT,
+    ):
+        # every word here is a column name, so a match can only be the header row
+        result = await search_table_global(
+            ctx, url=url, section_title=None, query='Region Name Endpoint Protocol', max_rows=20
+        )
+
+        assert result.tables_searched >= 1, 'the endpoint table should have been read'
+        assert result.tables_with_matches == 0, f'header row leaked as data: {result.results}'
+
+
+@pytest.mark.asyncio
+@pytest.mark.live
+async def test_endpoint_rows_are_real_data():
+    """A real query returns a data row, and the multi-value delimiter is applied."""
+    url = 'https://docs.aws.amazon.com/general/latest/gr/sts.html'
+    ctx = MockContext()
+
+    with patch(
+        'awslabs.aws_documentation_mcp_server.server_aws.DEFAULT_USER_AGENT',
+        TEST_USER_AGENT,
+    ):
+        result = await search_table_global(
+            ctx, url=url, section_title=None, query='us-east-2', max_rows=5
+        )
+
+        assert result.tables_with_matches == 1
+        rows = result.results[0].rows
+        assert rows, 'us-east-2 should be present in the STS endpoint table'
+        row = rows[0]
+        assert row['Region'] == 'us-east-2'
+        assert row['Region Name'] != 'Region Name'
+        # fused values would be one element, so a split of 2+ is the delimiter working
+        endpoints = row['Endpoint'].split('; ')
+        assert len(endpoints) >= 2, f'endpoints did not split: {endpoints}'
+        assert all('us-east-2' in e for e in endpoints), endpoints
```

---

### Incident Patch 13: `2fec2904` (2026-09-22)
**Commit Message**: fix(aws-healthomics-mcp-server): report truthful pagination state for date-filtered ListRuns (#4639)

* fix(aws-healthomics-mcp-server): emit nextToken on truncated date-filtered list_runs results

When created_after/created_before is supplied, list_runs filters runs
client-side after fetching raw batches from the HealthOmics API. If the
filtered set exceeded max_results, the response was truncated and
nextToken was always omitted, so callers had no signal that more
matching runs existed and would treat a partial page as complete.

Re-emit the upstream nextToken on this path when one is available,
populating the same optional response key already used on the
unfiltered path with the same kind of value (the raw upstream
continuation token). This does not change what nextToken means for
existing callers.

Known residual limitation, documented in code: resuming with this
token can skip matches that were already fetched into the truncated
batch but excluded by the max_results slice, since continuation only
resumes from unfetched upstream pages. This is a strict improvement
over the prior behavior (which always silently claimed completeness)
and is called out for follow-up rather than s

**File**: `src/aws-healthomics-mcp-server/awslabs/aws_healthomics_mcp_server/tools/workflow_execution.py` (modified, +26/-8)
```diff
@@ -548,14 +548,32 @@ async def list_runs(
 
             result = {'runs': result_runs}
 
-            # If we have more filtered results than max_results, we could implement
-            # a custom pagination token, but for simplicity we'll omit nextToken
-            # when client-side filtering is applied
-            if len(filtered_runs) > max_results:
-                logger.info(
-                    f'Client-side filtering returned {len(filtered_runs)} results, '
-                    f'truncated to {max_results}. Pagination not supported with date filters.'
-                )
+            # If the filtered set was truncated to max_results, signal that more
+            # matching runs may exist rather than silently returning a short page.
+            # The upstream token (if any) is a best-effort resume point, not a fully
+            # correct cursor: resuming with it fetches upstream pages after the
+            # batches already scanned, so it skips the excess matches that were
+            # already fetched into this batch but discarded here by truncation.
+            if len(filtered_runs) >= max_results:
+                if current_token:
+                    result['nextToken'] = current_token
+                    logger.info(
+                        f'Client-side filtering returned {len(filtered_runs)} results, '
+                        f'truncated to {max_results}. Returning upstream nextToken so '
+                        'the caller can continue pagination.'
+                    )
+                elif len(filtered_runs) > max_results:
+                    # Matching runs were discarded by the max_results slice above and
+                    # upstream is exhausted, so there is no token to hand back at all.
+                    # Raise the pagination.has_more flag the wrapper's nested-pagination
+                    # idiom already recognizes, so it reports this page as incomplete
+                    # instead of fabricating a COMPLETE result.
+                    result['pagination'] = {'has_more': True}
+                    logger.info(
+                        f'Client-side filtering returned {len(filtered_runs)} results, '
+                        f'truncated to {max_results}. No further upstream pages are '
+                        'available, so no nextToken can be issued for the remaining matches.'
+                    )
 
             return result
         else:
```

**File**: `src/aws-healthomics-mcp-server/awslabs/aws_healthomics_mcp_server/utils/pagination.py` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ async def wrapper(*args: Any, **kwargs: Any) -> Any:
         if isinstance(nested, dict) and 'has_more' in nested:
             token = nested.get('continuation_token')
             is_complete = not bool(nested['has_more'])
-            returned_count = len(result.get('results', []))
+            returned_count = _first_list_length(result.values())
             nested.update(
                 _pagination_block(is_complete, returned_count, tool_name, param_name, token)
             )
```

**File**: `src/aws-healthomics-mcp-server/tests/test_pagination_hints_real_shapes.py` (modified, +159/-5)
```diff
@@ -41,8 +41,10 @@
 import pytest
 from awslabs.aws_healthomics_mcp_server.tools.ecr_tools import list_ecr_repositories
 from awslabs.aws_healthomics_mcp_server.tools.genomics_file_search import search_genomics_files
+from awslabs.aws_healthomics_mcp_server.tools.workflow_execution import list_runs
 from awslabs.aws_healthomics_mcp_server.tools.workflow_management import list_workflows
 from awslabs.aws_healthomics_mcp_server.utils.pagination import paginating
+from datetime import datetime, timedelta, timezone
 
 # Reusing test_ecr_tools.py's private mock-building helpers deliberately, per
 # this task's brief, rather than duplicating a second copy of the ECR client
@@ -61,11 +63,9 @@
 # ---------------------------------------------------------------------------
 # Dict + nextToken idiom: ListAHOWorkflows.
 #
-# list_runs (workflow_execution.py) uses this idiom's response shape too, but
-# is deliberately NOT pinned here: it has a separate, already-tracked
-# false-completeness bug (client-side date filtering can truncate results
-# without ever setting nextToken), and a guard test would either bake that
-# bug in as "correct" or assert a fix that doesn't exist yet. list_workflows
+# list_runs (workflow_execution.py) uses this idiom's response shape too;
+# its own date-filter truncation cases are pinned separately below in
+# TestDictNextTokenIdiomAgainstRealListRunsDateFilterTruncation. list_workflows
 # builds its response the same way (a single transformed list plus a
 # conditionally-present nextToken key) without that complication, so it pins
 # the idiom's shape invariant on its own.
@@ -147,6 +147,160 @@ async def test_complete_page_pagination_block_matches_real_response(self):
         assert 'no further calls are needed' in pagination['instruction'].lower()
 
 
+class TestDictNextTokenIdiomAgainstRealListRunsDateFilterTruncation:
+    """Wraps the real ``list_runs`` with a mocked ``get_omics_client``.
+
+    Pins the two false-completeness cases in ListAHORuns' client-side
+    date-filter truncation path: the ``== max_results`` boundary, and the
+    falsy-token case where upstream is exhausted at the moment of
+    truncation.
+    """
+
+    def _run_items(self, count: int):
+        base_time = datetime(2023, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
+        return [
+            {
+                'id': f'run-{i}',
+                'name': f'run-{i}',
+                'status': 'COMPLETED',
+                'workflowId': f'wfl-{i}',
+                'workflowType': 'WDL',
+                'creationTime': base_time + timedelta(days=i),
+            }
+            for i in range(count)
+        ]
+
+    @pytest.mark.asyncio
+    async def test_boundary_exact_max_results_with_upstream_token_is_incomplete(self):
+        """Filtered set == max_results and an upstream current_token exists.
+
+        Before the fix, the truncation check was strictly
+        ``len(filtered_runs) > max_results``, so an exact match emitted no
+        nextToken even though more matching runs might exist upstream, and
+        the wrapper reported this page as COMPLETE.
+        """
+        mock_response = {
+            'items': self._run_items(10),  # exactly max_results
+            'nextToken': 'upstream-token-boundary',
+        }
+
+        mock_ctx = AsyncMock()
+        mock_client = MagicMock()
+        mock_client.list_runs.return_value = mock_response
+
+        wrapped = paginating('ListAHORuns', list_runs)
+
+        with patch(
+            'awslabs.aws_healthomics_mcp_server.tools.workflow_execution.get_omics_client',
+            return_value=mock_client,
+        ):
+            result = await wrapped(
+                ctx=mock_ctx,
+                max_results=10,
+                next_token=None,
+                status=None,
+                created_after='2023-06-10T00:00:00Z',
+                created_before=None,
+                run_group_id=None,
+            )
+
+        assert len(result['runs']) == 10
+        assert result.get('nextToken') == 'upstream-token-boundary'
+
+        pagination = result['pagination']
+        assert pagination['isComplete'] is False
+        assert pagination['nextToken'] == 'upstream-token-boundary'
+        assert 'no further calls are needed' not in pagination['instruction'].lower()
+
+    @pytest.mark.asyncio
+    async def test_truncation_with_no_upstream_token_reports_partial_not_complete(self):
+        """Filtered set > max_results but upstream is exhausted (no current_token).
+
+        Matching runs were discarded by the max_results slice and there is no
+        token to hand back. Before the fix, list_runs emitted nothing extra,
+        so the wrapper's dict/nextToken branch saw no token key and reported
+        the page as COMPLETE -- fabricating certainty that no runs were
+        dropped. The fix raises the pagination.has_more flag pagination.py's
+        nested idiom already recognizes, routing into its honest
+        is_complete=False / to
```

**File**: `src/aws-healthomics-mcp-server/tests/test_workflow_execution.py` (modified, +104/-0)
```diff
@@ -810,6 +810,110 @@ async def test_list_runs_with_both_date_filters():
     assert result['runs'][0]['id'] == 'run-2'
 
 
+@pytest.mark.asyncio
+async def test_list_runs_date_filter_truncation_emits_next_token():
+    """Test that truncating date-filtered results still signals continuation.
+
+    When client-side date filtering leaves more matching runs than max_results,
+    and the upstream API still has more pages available, the response must
+    include a nextToken so callers know the page is not the complete result set.
+    """
+    base_time = datetime(2023, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
+
+    # 15 runs all created after the created_after filter, fetched in a single
+    # upstream batch that itself still has more pages (nextToken present).
+    items = []
+    for i in range(15):
+        items.append(
+            {
+                'id': f'run-{i}',
+                'name': f'run-{i}',
+                'status': 'COMPLETED',
+                'workflowId': f'wfl-{i}',
+                'workflowType': 'WDL',
+                'creationTime': base_time + timedelta(days=i),
+            }
+        )
+
+    mock_response = {
+        'items': items,
+        'nextToken': 'upstream-token-abc',
+    }
+
+    mock_ctx = AsyncMock()
+    mock_client = MagicMock()
+    mock_client.list_runs.return_value = mock_response
+
+    with patch(
+        'awslabs.aws_healthomics_mcp_server.tools.workflow_execution.get_omics_client',
+        return_value=mock_client,
+    ):
+        result = await list_runs(
+            ctx=mock_ctx,
+            max_results=10,
+            next_token=None,
+            status=None,
+            created_after='2023-06-10T00:00:00Z',
+            created_before=None,
+            run_group_id=None,
+        )
+
+    # Truncated to max_results, but more matching runs exist upstream.
+    assert len(result['runs']) == 10
+    assert 'nextToken' in result, (
+        'truncated date-filtered page must carry a continuation token so the '
+        'caller does not treat a partial result as complete'
+    )
+    assert result['nextToken'] == 'upstream-token-abc'
+
+
+@pytest.mark.asyncio
+async def test_list_runs_date_filter_truncation_no_upstream_token():
+    """Test truncated date-filtered results with no further upstream pages.
+
+    When the upstream API has no more pages (no nextToken), there is no valid
+    resume point to hand back even though the filtered set was truncated. The
+    response must omit nextToken rather than fabricate one.
+    """
+    base_time = datetime(2023, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
+
+    items = [
+        {
+            'id': f'run-{i}',
+            'name': f'run-{i}',
+            'status': 'COMPLETED',
+            'workflowId': f'wfl-{i}',
+            'workflowType': 'WDL',
+            'creationTime': base_time + timedelta(days=i),
+        }
+        for i in range(15)
+    ]
+
+    # No nextToken: this is the final upstream page.
+    mock_response = {'items': items}
+
+    mock_ctx = AsyncMock()
+    mock_client = MagicMock()
+    mock_client.list_runs.return_value = mock_response
+
+    with patch(
+        'awslabs.aws_healthomics_mcp_server.tools.workflow_execution.get_omics_client',
+        return_value=mock_client,
+    ):
+        result = await list_runs(
+            ctx=mock_ctx,
+            max_results=10,
+            next_token=None,
+            status=None,
+            created_after='2023-06-10T00:00:00Z',
+            created_before=None,
+            run_group_id=None,
+        )
+
+    assert len(result['runs']) == 10
+    assert 'nextToken' not in result
+
+
 @pytest.mark.asyncio
 async def test_list_runs_invalid_created_after():
     """Test list_runs with invalid created_after datetime."""
```

---

### Incident Patch 14: `92067994` (2026-09-21)
**Commit Message**: fix(aurora-dsql): use parser-based SQL policy guard (#4653)

* fix(aurora-dsql): use parser-based SQL policy guard

* fix(aurora-dsql): address SQL guard review findings

* chore(aurora-dsql): avoid empty exception handler

* fix(aurora-dsql): match psycopg placeholder scanning

* fix(aurora-dsql): preserve unmatched percent markers

* fix(aurora-dsql): handle repeated explain analyze options

---------

Co-authored-by: Spencer Corwin <[REDACTED_EMAIL]>

**File**: `src/aurora-dsql-mcp-server/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Security
 
+- Add a subsequent `pglast` policy layer after the existing SQL heuristics, so function and read-only checks use PostgreSQL-decoded quoted and Unicode-escaped identifiers. The parser guard matches psycopg parameter handling and supports Aurora DSQL asynchronous DDL and AWS IAM syntax during validation.
 - Close read-only bypasses in `readonly_query` / `transact` (read-only mode), aligning the SQL classifier with the `postgres-mcp-server` sibling:
   - Detect Postgres session-state mutation that a `BEGIN TRANSACTION READ ONLY` does not block, using a broad keyword approach matched at statement start (mirroring the sibling) rather than an assignment-shape regex: assignment `SET <name> = ...` / `... TO ...`, keyword-syntax `SET ROLE` / `SET SESSION AUTHORIZATION` / `SET SCHEMA` / `SET NAMES`, the session commands `RESET` / `DISCARD` / `LISTEN` / `NOTIFY` / `UNLISTEN` / `LOCK` / `EXECUTE`, prepared-statement / cursor commands `PREPARE` / `DEALLOCATE` / `DECLARE ... CURSOR` (session-scoped, not cleared by `RESET ALL`), and the `set_config(...)` function form (including when embedded as a `SELECT` subquery). `SET TRANSACTION READ ONLY` / isolation-only remains allowed so read-only mode can be asserted, but `SET TRANSACTION ... READ WRITE` (an escalation) is blocked, including when split across a newline.
   - Normalize SQL (strip comments, unwrap double-quoted identifiers) before matching so comment-injection payloads like `SET/**/search_path = ...` can no longer slip past the classifier. This replaces the earlier `sqlparse`-based comment stripping with a self-contained, literal- and dollar-quote-aware normalizer (matching the `postgres-mcp-server` sibling), removing the `sqlparse` dependency.
```

**File**: `src/aurora-dsql-mcp-server/awslabs/aurora_dsql_mcp_server/server.py` (modified, +29/-2)
```diff
@@ -59,6 +59,7 @@
     detect_mutating_keywords,
     detect_transaction_bypass_attempt,
 )
+from awslabs.aurora_dsql_mcp_server.sql_guard import SqlPolicyError, assert_executable
 from botocore.config import Config
 from loguru import logger
 from mcp.server.mcpserver import Context, MCPServer
@@ -221,6 +222,20 @@ async def readonly_query(
         await ctx.error(ERROR_TRANSACTION_BYPASS_ATTEMPT)
         raise Exception(ERROR_TRANSACTION_BYPASS_ATTEMPT)
 
+    # Parse with PostgreSQL's own grammar after the legacy heuristic checks.
+    # This closes lexical differentials such as U&-escaped identifiers while
+    # preserving the existing, more specific user-facing errors above.
+    try:
+        assert_executable(
+            sql,
+            allow_write_query=False,
+            parameter_count=len(params) if params is not None else None,
+        )
+    except SqlPolicyError as error:
+        logger.warning(f'readonly_query rejected by SQL policy guard: {error}')
+        await ctx.error(f'{ERROR_QUERY_INJECTION_RISK}: {error}')
+        raise Exception(f'{ERROR_QUERY_INJECTION_RISK}: {error}') from error
+
     try:
         conn = await get_connection(ctx)
 
@@ -361,7 +376,7 @@ async def transact(
     # detection only run in read-only mode where those operations are
     # prohibited. Callers that need stacked statements should split them
     # into separate sql_list items.
-    for sql in sql_list:
+    for index, sql in enumerate(sql_list):
         if read_only:
             mutating_matches = detect_mutating_keywords(sql)
             if mutating_matches:
@@ -384,6 +399,18 @@ async def transact(
             await ctx.error(ERROR_TRANSACTION_BYPASS_ATTEMPT)
             raise Exception(ERROR_TRANSACTION_BYPASS_ATTEMPT)
 
+        try:
+            parameters = params_list[index] if params_list is not None else None
+            assert_executable(
+                sql,
+                allow_write_query=not read_only,
+                parameter_count=len(parameters) if parameters is not None else None,
+            )
+        except SqlPolicyError as error:
+            logger.warning(f'transact rejected by SQL policy guard: {error}')
+            await ctx.error(f'{ERROR_QUERY_INJECTION_RISK}: {error}')
+            raise Exception(f'{ERROR_QUERY_INJECTION_RISK}: {error}') from error
+
     try:
         conn = await get_connection(ctx)
 
@@ -401,7 +428,7 @@ async def transact(
         try:
             rows = []
             for idx, query in enumerate(sql_list):
-                p = params_list[idx] if params_list else None
+                p = params_list[idx] if params_list is not None else None
                 rows = await execute_query(ctx, conn, query, p)
             await execute_query(ctx, conn, COMMIT_TRANSACTION_SQL)
             return rows
```

**File**: `src/aurora-dsql-mcp-server/awslabs/aurora_dsql_mcp_server/sql_guard.py` (added, +520/-0)
```diff
@@ -0,0 +1,520 @@
+# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+r"""Parser-based SQL policy for the Aurora DSQL MCP Server.
+
+The policy uses PostgreSQL's parser through pglast. PostgreSQL escape syntax,
+including Unicode-escaped identifiers such as ``U&"pg_sl\\0065ep"``, is decoded
+before names are checked. The guard and Aurora DSQL therefore interpret
+identifiers with the same PostgreSQL lexical rules.
+
+This is defense in depth. Database permissions and read-only transactions remain
+the authoritative controls for function semantics that cannot be inferred from
+syntax, such as user-defined wrapper functions.
+"""
+
+from loguru import logger
+from pglast import ast, parse_sql, scan
+from pglast.enums import DiscardMode, VariableSetKind
+from typing import NoReturn
+
+
+READ_ONLY_ALLOWED_ROOT = frozenset(
+    {'SelectStmt', 'VariableShowStmt', 'ExplainStmt', 'VariableSetStmt'}
+)
+READ_ONLY_ALLOWED_STMT_NODES = frozenset(
+    {
+        'RawStmt',
+        'SelectStmt',
+        'VariableShowStmt',
+        'ExplainStmt',
+        'ExecuteStmt',
+        'VariableSetStmt',
+    }
+)
+
+READ_ONLY_PROHIBITED_FUNCTIONS = frozenset({'set_config'})
+
+READ_ONLY_PROHIBITED_MUTATING_FUNCTIONS = frozenset(
+    {
+        'nextval',
+        'setval',
+        'pg_stat_force_next_flush',
+        'pg_stat_reset',
+        'pg_stat_reset_backend_stats',
+        'pg_stat_reset_shared',
+        'pg_stat_reset_single_table_counters',
+        'pg_stat_reset_single_function_counters',
+        'pg_stat_reset_slru',
+        'pg_stat_reset_replication_slot',
+        'pg_stat_reset_subscription_stats',
+        'pg_restore_relation_stats',
+        'pg_clear_relation_stats',
+        'pg_restore_attribute_stats',
+        'pg_clear_attribute_stats',
+        'pg_stat_statements_reset',
+        'pg_stat_monitor_reset',
+        'pg_start_backup',
+        'pg_stop_backup',
+        'pg_backup_start',
+        'pg_backup_stop',
+        'pg_switch_wal',
+        'pg_create_restore_point',
+        'pg_log_standby_snapshot',
+        'pg_logical_emit_message',
+        'pg_create_physical_replication_slot',
+        'pg_create_logical_replication_slot',
+        'pg_copy_physical_replication_slot',
+        'pg_copy_logical_replication_slot',
+        'pg_drop_replication_slot',
+        'pg_replication_slot_advance',
+        'pg_sync_replication_slots',
+        'pg_logical_slot_get_changes',
+        'pg_logical_slot_get_binary_changes',
+        'pg_replication_origin_create',
+        'pg_replication_origin_drop',
+        'pg_replication_origin_advance',
+        'pg_replication_origin_session_setup',
+        'pg_replication_origin_session_reset',
+        'pg_replication_origin_xact_setup',
+        'pg_replication_origin_xact_reset',
+        'brin_summarize_new_values',
+        'brin_summarize_range',
+        'brin_desummarize_range',
+        'gin_clean_pending_list',
+        'lo_creat',
+        'lo_create',
+        'lo_from_bytea',
+        'lo_put',
+        'lo_truncate',
+        'lo_truncate64',
+        'lo_unlink',
+        'lowrite',
+        'pg_import_system_collations',
+        'setseed',
+        'pg_advisory_unlock',
+        'pg_advisory_unlock_shared',
+        'pg_advisory_unlock_all',
+        'autoprewarm_dump_now',
+        'pg_truncate_visibility_map',
+        'postgres_fdw_disconnect',
+        'postgres_fdw_disconnect_all',
+    }
+)
+
+READ_ONLY_PROHIBITED_QUALIFIED_FUNCTIONS = frozenset(
+    {
+        ('cron', 'schedule'),
+        ('cron', 'schedule_in_database'),
+        ('cron', 'alter_job'),
+        ('cron', 'unschedule'),
+    }
+)
+
+DANGEROUS_FUNCTIONS = frozenset(
+    {
+        'pg_cancel_backend',
+        'pg_terminate_backend',
+        'pg_sleep',
+        'pg_sleep_for',
+        'pg_sleep_until',
+        'pg_read_file',
+        'pg_read_binary_file',
+        'pg_stat_file',
+        'lo_import',
+        'lo_export',
+        'pg_ls_dir',
+        'pg_ls_logdir',
+        'pg_ls_waldir',
+        'pg_ls_tmpdir',
+        'pg_ls_archive_statusdir',
+        'pg_ls_logicalmapdir',
+        'pg_ls_logicalsnapdir',
+        'pg_ls_replslotdir',
+        'pg_ls_summariesdir',
+        'pg_file_write',
+        'pg_file_sync',
+        'pg_file_rename',
+        'pg_file_unlink',
+        'pg_logdir_ls',
+        'pg_reload_conf',
+        'pg_rotate_logfile',
+        'pg_promot
```

**File**: `src/aurora-dsql-mcp-server/pyproject.toml` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ dependencies = [
     "boto3>=1.38.5",
     "botocore>=1.38.5",
     "psycopg[binary]>=3.0",
+    "pglast>=8.4,<9",
     "httpx>=0.27.0",
     "dsql-lint>=0.2.17,<0.3",
 ]
```

**File**: `src/aurora-dsql-mcp-server/tests/test_sql_guard.py` (added, +413/-0)
```diff
@@ -0,0 +1,413 @@
+# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Regression tests for the parser-based Aurora DSQL SQL guard."""
+
+import pytest
+from awslabs.aurora_dsql_mcp_server import sql_guard
+from awslabs.aurora_dsql_mcp_server.sql_guard import (
+    SqlPolicyError,
+    _normalize_dsql_syntax,
+    _normalize_placeholders,
+    assert_executable,
+)
+
+
+@pytest.mark.parametrize(
+    'sql',
+    [
+        r'''SELECT U&"pg_read_fil\0065"('/etc/passwd')''',
+        r'''SELECT U&"lo_impor\0074"(0, '/etc/passwd')''',
+        r'''SELECT U&"pg_sl\0065ep"(10)''',
+        r'''SELECT U&"dblin\006b"('host=169.254.169.254', 'SELECT 1')''',
+    ],
+)
+@pytest.mark.parametrize('allow_write_query', [False, True])
+def test_unicode_escaped_dangerous_functions_are_rejected(sql, allow_write_query):
+    """PostgreSQL-decoded function names cannot bypass the denylist."""
+    with pytest.raises(SqlPolicyError, match='Dangerous function'):
+        assert_executable(sql, allow_write_query=allow_write_query)
+
+
+@pytest.mark.parametrize(
+    'sql',
+    [
+        'SELECT 1',
+        "SELECT '%s is data', $tagé$%s is also data$tagé$",
+        'EXPLAIN ANALYZE SELECT * FROM t',
+        'SELECT 10 % sqrt(4)',
+    ],
+)
+def test_unparameterized_read_queries_are_allowed(sql):
+    """Valid reads preserve PostgreSQL percent operators and quoted data."""
+    assert_executable(sql)
+
+
+@pytest.mark.parametrize(
+    ('sql', 'parameter_count'),
+    [
+        ('SELECT * FROM t WHERE tenant_id = %s', 1),
+        ('SELECT * FROM t WHERE a = %b AND b = %t', 2),
+        ('SELECT 10 %% 3', 0),
+        ('SELECT %s -- progress 100%', 1),
+        ('SELECT %s -- progress 100%\n', 1),
+    ],
+)
+def test_bound_psycopg_placeholders_are_allowed(sql, parameter_count):
+    """Psycopg placeholders are normalized only when parameters are supplied."""
+    assert_executable(sql, parameter_count=parameter_count)
+
+
+def test_placeholder_normalization_matches_psycopg_raw_query_scanning():
+    """Placeholders are converted across the raw text exactly as psycopg does."""
+    sql = (
+        """SELECT '%s', "%s", U&"%s", $tagé$%s$tagé$, value FROM t -- %s\r"""
+        'WHERE id = %s AND payload = %b AND label = %t AND ratio = 10 %% 3'
+    )
+    assert _normalize_placeholders(sql, parameter_count=8) == (
+        """SELECT '$1', "$2", U&"$3", $tagé$$4$tagé$, value FROM t -- $5\r"""
+        'WHERE id = $6 AND payload = $7 AND label = $8 AND ratio = 10 % 3'
+    )
+
+
+def test_placeholder_normalization_matches_reported_driver_differential():
+    """Markers inside strings and comments contribute to psycopg numbering."""
+    sql = "SELECT '%s', id FROM t WHERE id = %s -- %s"
+    assert _normalize_placeholders(sql, parameter_count=3) == (
+        "SELECT '$1', id FROM t WHERE id = $2 -- $3"
+    )
+
+
+@pytest.mark.parametrize(
+    'sql',
+    [
+        'SELECT %s -- progress 100%',
+        'SELECT %s -- progress 100%\n',
+    ],
+)
+def test_placeholder_normalization_preserves_psycopg_unmatched_percent(sql):
+    """Terminal percent and percent before a line feed remain unchanged."""
+    assert _normalize_placeholders(sql, parameter_count=1) == sql.replace('%s', '$1')
+
+
+@pytest.mark.parametrize(
+    ('sql', 'parameter_count'),
+    [
+        ('SELECT %s', 0),
+        ('SELECT 1', 1),
+        ("SELECT '%s', id FROM t WHERE id = %s -- %s", 1),
+    ],
+)
+def test_placeholder_count_must_match_bound_parameters(sql, parameter_count):
+    """The policy rejects the same positional parameter-count mismatches as psycopg."""
+    with pytest.raises(SqlPolicyError, match='placeholders'):
+        assert_executable(sql, parameter_count=parameter_count)
+
+
+def test_unbound_percent_does_not_hide_mutating_function():
+    """An unbound modulo operator must remain visible to the parser."""
+    with pytest.raises(SqlPolicyError, match='setseed'):
+        assert_executable('SELECT 1%setseed(0.5)')
+
+
+@pytest.mark.parametrize('sql', ['SELECT 1 % q', 'SELECT %s -- progress 100%\r\n'])
+def test_invalid_bound_placeholder_syntax_is_rejected(sql):
+    """A parameters object makes unescaped percent operators invalid to psycopg."""
+    with pytest.raises(SqlPolicyError, match='placeholder'):
+        assert_executable(sql, parameter_count=0)
+
+
+def test_malformed_normalized_sql_is_rejected():
+    """Malformed parameterized SQL still fails cl
```

**File**: `src/aurora-dsql-mcp-server/tests/test_sql_guard_wiring.py` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Verify that parser rejections stop before the database connection."""
+
+import pytest
+from unittest.mock import AsyncMock, patch
+
+from awslabs.aurora_dsql_mcp_server.consts import ERROR_QUERY_INJECTION_RISK
+from awslabs.aurora_dsql_mcp_server.server import readonly_query, transact
+
+
+ESCAPED_SLEEP = r'''SELECT U&"pg_sl\0065ep"(10)'''
+UNBOUND_PERCENT_BYPASS = 'SELECT 1%setseed(0.5)'
+
+
+@pytest.mark.asyncio
+async def test_readonly_query_stops_unicode_escape_before_connection():
+    """The escaped function must not reach the read-only transaction."""
+    ctx = AsyncMock()
+    with (
+        patch('awslabs.aurora_dsql_mcp_server.server.cluster_endpoint', 'example.dsql'),
+        patch(
+            'awslabs.aurora_dsql_mcp_server.server.get_connection', new_callable=AsyncMock
+        ) as get_connection,
+    ):
+        with pytest.raises(Exception, match=ERROR_QUERY_INJECTION_RISK):
+            await readonly_query(ESCAPED_SLEEP, ctx)
+
+    get_connection.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_write_mode_transact_stops_unicode_escape_before_connection():
+    """Dangerous functions remain blocked when ordinary writes are enabled."""
+    ctx = AsyncMock()
+    with (
+        patch('awslabs.aurora_dsql_mcp_server.server.cluster_endpoint', 'example.dsql'),
+        patch('awslabs.aurora_dsql_mcp_server.server.read_only', False),
+        patch(
+            'awslabs.aurora_dsql_mcp_server.server.get_connection', new_callable=AsyncMock
+        ) as get_connection,
+    ):
+        with pytest.raises(Exception, match=ERROR_QUERY_INJECTION_RISK):
+            await transact([ESCAPED_SLEEP], ctx)
+
+    get_connection.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_write_mode_transact_stops_transaction_control_before_connection():
+    """Caller SQL cannot commit the transaction managed by the tool."""
+    ctx = AsyncMock()
+    with (
+        patch('awslabs.aurora_dsql_mcp_server.server.cluster_endpoint', 'example.dsql'),
+        patch('awslabs.aurora_dsql_mcp_server.server.read_only', False),
+        patch(
+            'awslabs.aurora_dsql_mcp_server.server.get_connection', new_callable=AsyncMock
+        ) as get_connection,
+    ):
+        with pytest.raises(Exception, match=ERROR_QUERY_INJECTION_RISK):
+            await transact(['COMMIT', 'UPDATE t SET value = 1'], ctx)
+
+    get_connection.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_readonly_query_uses_unbound_percent_semantics():
+    """Without params, modulo syntax cannot be mistaken for a placeholder."""
+    ctx = AsyncMock()
+    with (
+        patch('awslabs.aurora_dsql_mcp_server.server.cluster_endpoint', 'example.dsql'),
+        patch(
+            'awslabs.aurora_dsql_mcp_server.server.get_connection', new_callable=AsyncMock
+        ) as get_connection,
+    ):
+        with pytest.raises(Exception, match=ERROR_QUERY_INJECTION_RISK):
+            await readonly_query(UNBOUND_PERCENT_BYPASS, ctx)
+
+    get_connection.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_readonly_query_passes_parameter_binding_context_to_guard():
+    """A supplied params list enables psycopg placeholder parsing."""
+    ctx = AsyncMock()
+    with (
+        patch('awslabs.aurora_dsql_mcp_server.server.cluster_endpoint', 'example.dsql'),
+        patch(
+            'awslabs.aurora_dsql_mcp_server.server.get_connection', new_callable=AsyncMock
+        ) as get_connection,
+        patch(
+            'awslabs.aurora_dsql_mcp_server.server.execute_query', new_callable=AsyncMock
+        ) as execute_query,
+    ):
+        get_connection.return_value = AsyncMock()
+        execute_query.side_effect = [None, [{'value': 1}], None, None, None]
+        result = await readonly_query('SELECT %s AS value', ctx, params=[1])
+
+    assert result == [{'value': 1}]
+    assert execute_query.await_args_list[1].args[3] == [1]
+
+
+@pytest.mark.asyncio
+async def test_readonly_query_stops_raw_placeholder_count_mismatch_before_connection():
+    """Quoted and commented markers count as psycopg placeholders."""
+    ctx = AsyncMock()
+    sql = "SELECT '%s', id FROM t WHERE id = %s -- %s"
+    with (
+        patch('awslabs.aurora_dsql_mcp_server.server.cluster_endpoint', 'example.dsql'),
+        patch(
+            'awslabs.aurora_dsql_mcp_s
```

**File**: `src/aurora-dsql-mcp-server/uv.lock` (modified, +74/-0)
```diff
@@ -83,6 +83,7 @@ dependencies = [
     { name = "httpx" },
     { name = "loguru" },
     { name = "mcp", extra = ["cli"] },
+    { name = "pglast" },
     { name = "psycopg", extra = ["binary"] },
     { name = "pydantic" },
 ]
@@ -107,6 +108,7 @@ requires-dist = [
     { name = "httpx", specifier = ">=0.27.0" },
     { name = "loguru", specifier = ">=0.7.0" },
     { name = "mcp", extras = ["cli"], specifier = ">=2.0.0,<3.0.0" },
+    { name = "pglast", specifier = ">=8.4,<9" },
     { name = "psycopg", extras = ["binary"], specifier = ">=3.0" },
     { name = "pydantic", specifier = ">=2.10.6" },
 ]
@@ -891,6 +893,78 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/20/12/38679034af332785aac8774540895e234f4d07f7545804097de4b666afd8/packaging-25.0-py3-none-any.whl", hash = "sha256:29572ef2b1f17581046b3a2227d5c611fb25ec70ca1ba8554b24b0e69331a484", size = 66469, upload-time = "2025-04-19T11:48:57.875Z" },
 ]
 
+[[package]]
+name = "pglast"
+version = "8.4"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/ae/e3/e7dbccbac32ba8d6ea4f55aaf14ebd794bf0b8a05561af72284efe38b1b8/pglast-8.4.tar.gz", hash = "sha256:ebc804351aab9c1bac395611758883cd17d4198f4704224bb6f9f1dd1f3c513d", size = 3790693, upload-time = "2026-07-22T14:46:58.692Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/52/31/251719cd5842d278fc96ddac61de2771a408cf1cc9b218bfc087297cb207/pglast-8.4-cp310-cp310-macosx_10_9_x86_64.whl", hash = "sha256:9a7b8c39f64d81d0923d0d1c0136804c80c9ad621fdd88970df07d3301366a6f", size = 1537047, upload-time = "2026-07-22T15:12:42.133Z" },
+    { url = "https://files.pythonhosted.org/packages/58/9f/992fa94d5bf9b74e4a3d5890f484012667bad12fb7b773c558ac98f4dfca/pglast-8.4-cp310-cp310-macosx_11_0_arm64.whl", hash = "sha256:cd1e18027489d87f7f930e47819c86dc5f7637826250686f8f7266dd9edbeb06", size = 1449182, upload-time = "2026-07-22T15:12:43.265Z" },
+    { url = "https://files.pythonhosted.org/packages/c2/6b/e539f0976d1b979d3852de303c5d0fd6fa204ad044daed9e314157d12410/pglast-8.4-cp310-cp310-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:877b3df0bc1c19c2ed3bbe94dd1b0c6d1dce9ed7381c990e8ecc2437e17ff591", size = 6112122, upload-time = "2026-07-22T15:12:44.557Z" },
+    { url = "https://files.pythonhosted.org/packages/84/d2/bd6a02c66569423e285db9acabfbe5d278f0281ace48ab5b4782676dd523/pglast-8.4-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:a0e43ff6ae4c4d272c8e702689cd973fc995d6e449057f54081f5e3637754921", size = 6201615, upload-time = "2026-07-22T15:12:46.618Z" },
+    { url = "https://files.pythonhosted.org/packages/81/ab/18202db15e29b550cf3be2bbd913e6fc09200570ead22355e9dbd0f3171d/pglast-8.4-cp310-cp310-musllinux_1_2_aarch64.whl", hash = "sha256:be163e1f746ac972a7327076ccb1e584fb43e4fe6fd20930b6c281b35f3fc947", size = 5939838, upload-time = "2026-07-22T15:12:47.895Z" },
+    { url = "https://files.pythonhosted.org/packages/63/02/0ddec9a74555568b5eda0ff48d16e07169f4099aa1705a6269fd2e3a99d9/pglast-8.4-cp310-cp310-musllinux_1_2_x86_64.whl", hash = "sha256:83316be7363b278421e8e395fd634760232455dd402e8bb95c098eeabfa8eaeb", size = 6022163, upload-time = "2026-07-22T15:12:49.317Z" },
+    { url = "https://files.pythonhosted.org/packages/90/30/ec758526b32d95e274b2b0d94fa985673ad4faf986d8dbc50b8b2a04d45b/pglast-8.4-cp310-cp310-win32.whl", hash = "sha256:4c25d1a8675365d01e607b5d7ec398a653bfc4b40f6acc4b016b40ffe543f156", size = 1379878, upload-time = "2026-07-22T15:12:50.682Z" },
+    { url = "https://files.pythonhosted.org/packages/80/f0/2c07326080308f6f6eb9bf342851f026f6b5c79b3f749180f3100ef580bd/pglast-8.4-cp310-cp310-win_amd64.whl", hash = "sha256:95059e4f3e44b74d414dac30bcb5c43da0f26c9d39edb727a14b8b4196291eaa", size = 1457146, upload-time = "2026-07-22T15:12:51.829Z" },
+    { url = "https://files.pythonhosted.org/packages/6d/87/9ab443d34770a297b35cb36de739925c957e157c938dc5a76918912ebdc6/pglast-8.4-cp311-cp311-macosx_10_9_x86_64.whl", hash = "sha256:e82173c1a687ab1599649b8f2079c8c9f0346aeab24550f831e2edb8ed0a2dfd", size = 1535747, upload-time = "2026-07-22T15:12:53.03Z" },
+    { url = "https://files.pythonhosted.org/packages/6f/96/0bdb771e068e1b09d84716eae9494acd14dcb85bb6376962c0e33468275f/pglast-8.4-cp311-cp311-macosx_11_0_arm64.whl", hash = "sha256:3318cf126eab9a61e001c359fdab817e9b9293fc89c3acf1acf69aa34ca5102f", size = 1449128, upload-time = "2026-07-22T15:12:54.27Z" },
+    { url = "https://files.pythonhosted.org/packages/44/e1/b3646585de2a26ebadd935a830c3e3e87a15d51c8eb2370cef6f4786a4e7/pglast-8.4-cp311-cp311-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:3f357cca18c406110d8e778742602255c5231ab7997921dff8ef05f1456d0dd3", size = 6164304, upload-time = "2026-07-22T15:12:55.623Z" },
+    { url = "https://files.pythonhosted.org/packages/dc/83/de8c502b7e01033b528c4e8a88200fa4c627700253239365a57d770ed
```

---

### Incident Patch 15: `2773b69a` (2026-09-21)
**Commit Message**: test(document-loader-mcp-server): write-path CI-env sandbox regression test + changelog 1.0.21 heading (#4611)

Co-authored-by: Andy Widjaja <[REDACTED_EMAIL]>

**File**: `src/document-loader-mcp-server/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [1.0.21] - 2026-09-01
+
 ### Security
 - Fixed a path containment bypass in the `DOCUMENT_BASE_DIR` sandbox (CVE pending).
   `_get_base_directory()` previously returned the filesystem root (`/`) whenever
```

**File**: `src/document-loader-mcp-server/tests/test_server.py` (modified, +49/-0)
```diff
@@ -1276,6 +1276,55 @@ async def test_extract_slides_general_exception():
                     print('✓ extract_slides_as_images general exception covered')
 
 
+def test_output_dir_containment_enforced_under_ci_env(tmp_path):
+    """Regression: the write path (output_dir) stays sandboxed under ambient CI env.
+
+    Companion to ``test_sandbox_enforced_under_ci_env_end_to_end`` (read path).
+    ``extract_slides_as_images`` validates ``output_dir`` via
+    ``validate_output_dir`` -> ``_is_within_base_directory`` -> ``_get_base_directory``,
+    the same helper the ``CI`` / ``GITHUB_ACTIONS`` / ``PYTEST_CURRENT_TEST`` bypass
+    affected. Pre-fix, the bypass widened the base to ``/`` so any ``output_dir``
+    was accepted (arbitrary-directory write). This asserts write-path containment
+    holds regardless of ambient CI signals.
+    """
+    from pathlib import Path
+
+    base_dir = tmp_path / 'sandbox'
+    base_dir.mkdir()
+
+    env = {
+        'DOCUMENT_BASE_DIR': str(base_dir),
+        'CI': 'true',
+        'GITHUB_ACTIONS': 'true',
+        'PYTEST_CURRENT_TEST': 'x',
+    }
+    with patch.dict(os.environ, env, clear=True):
+        # An output_dir OUTSIDE the sandbox is denied even with CI env present.
+        outside = tmp_path / 'evil_output'
+        error = validate_output_dir(str(outside))
+        assert error is not None
+        assert 'Access denied' in error
+
+        # An output_dir INSIDE the sandbox is allowed.
+        inside = base_dir / 'slides_out'
+        assert validate_output_dir(str(inside)) is None
+
+    # With no base configured, the default is the resolved cwd even under CI.
+    # Use a controlled cwd (not '/') so the check is platform-neutral and not
+    # dependent on where the suite runs.
+    with patch.dict(os.environ, {'CI': 'true'}, clear=True):
+        original_cwd = Path.cwd()
+        cwd_dir = tmp_path / 'cwd'
+        cwd_dir.mkdir()
+        os.chdir(cwd_dir)
+        try:
+            outside = tmp_path / 'evil_output'  # sibling of cwd, outside it
+            assert validate_output_dir(str(outside)) is not None
+        finally:
+            os.chdir(original_cwd)
+    print('✓ output_dir containment enforced under ambient CI env')
+
+
 if __name__ == '__main__':
     asyncio.run(test_server())
     asyncio.run(test_mcp_tool_functions())
```

#### Recent Merged Pull Requests:
- **PR #4731** (2026-10-05): fix(billing-cost-management): classify invoicing list_invoice_summaries validation failures (@nvvijayatwork)
- **PR #4728** (2026-10-05): fix(aws-healthomics): write WDL and CWL lint input as UTF-8 (@PerryLink)
- **PR #4716** (2026-10-03): fix(billing-cost-management): add structured error_type to bcm-pricing-calc, cost-anomaly, and cost-explorer failures (@bhatia-di)
- **PR #4713** (2026-10-02): feat(billing-cost-management-mcp-server): offload large sp-explorer offering results to session SQL (@Comusus)
- **PR #4712** (2026-10-02): fix(billing-cost-management): rename enterprise_support to enterprise-support (@frankolas)
- **PR #4710** (2026-10-02): chore: release/2026.10.20261002180809 (@awslabs-mcp)
- **PR #4709** (2026-10-02): fix(billing-cost-management-mcp-server)!: rename COH summaries field … (@pputra)
- **PR #4708** (2026-10-02): feat(documentdb-mcp-server)!: harden connection handling; configure the cluster at startup (@laithalsaadoon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
