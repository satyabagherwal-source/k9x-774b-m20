> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `68fe0510`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T10:09:48.160Z  
> **Learning ID**: `learn-github-matrixorigin-matrixone`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-23T10:09:47.836Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2057 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `clients/python/examples/example_20_sqlalchemy_engine_integration.py`
```
#!/usr/bin/env python3

# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Example 20: SQLAlchemy Engine Integration - Comprehensive SQLAlchemy Engine Operations

MatrixOne SQLAlchemy Engine Integration Example

This example demonstrates how to use MatrixOne Client and AsyncClient
with existing SQLAlchemy engines, making it easy to integrate MatrixOne
into existing SQLAlchemy-based projects.
"""

import asyncio
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine
from matrixone import Client, AsyncClient
from matrixone.config import get_connection_params, print_config
from matrixone.logger import create_default_logger

# Create MatrixOne logger for all logging
logger = create_default_logger(sql_log_mode="auto")


class SQLAlchemyEngineIntegrationDemo:
    """Demonstrates SQLAlchemy engine integration capabilities with comprehensive testing."""

    def __init__(self):
        self.logger = create_default_logger(sql_log_mode="auto")
        self.results = {
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'unexpected_results': [],
            'engine_integration_performance': {},
        }

    def test_sync_engine_integration(self):
        """Test sync SQLAlchemy engine integration"""
        print("\n=== Sync SQLAlchemy Engine Integration Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test sync engine integration
            self.logger.info("Test: Sync SQLAlchemy Engine Integration")
            try:
                # Create SQLAlchemy engine
                connection_string = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
                engine = create_engine(connection_string)

                # Create MatrixOne Client from existing SQLAlchemy engine
                client = Client.from_engine(engine)
                self.logger.info("✅ Created MatrixOne Client from SQLAlchemy engine")

                # Test basic functionality
                result = client.execute("SELECT 1 as test_value")
                rows = result.fetchall()
                self.logger.info(f"📊 Test query result: {rows[0][0]}")

                # Test database operations
                test_db = "demo_engine_db"
                client.execute(f"CREATE DATABASE IF NOT EXISTS {test_db}")
                client.execute(f"USE {test_db}")

                # Create test table
                client.execute("DROP TABLE IF EXISTS engine_test")
                client.execute("CREATE TABLE engine_test (id INT PRIMARY KEY, name VARCHAR(100))")

                # Insert test data
                client.execute("INSERT INTO engine_test VALUES (1, 'Test Data 1')")
                client.execute("INSERT INTO engine_test VALUES (2, 'Test Data 2')")

                # Query test data
                result = client.execute("SELECT COUNT(*) FROM engine_test")
                count = result.fetchone()[0]
                self.logger.info(f"📊 Test table has {count} records")

                # Cleanup
                client.execute(f"DROP DATABASE IF EXISTS {test_db}")

                self.results['tests_passed'] += 1

            except Exception as e:
                self.logger.error(f"❌ Sync engine integration test failed: {e}")
                self.results['tests_failed'] += 1
                self.results['unexpected_results'].append({'test': 'Sync SQLAlchemy Engine Integration', 'error': str(e)})

        except Exception as e:
            self.logger.error(f"❌ Sync engine integration test failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append({'test': 'Sync Engine Integration', 'error': str(e)})

    async def test_async_engine_integration(self):
        """Test async SQLAlchemy engine integration"""
        print("\n=== Async SQLAlchemy Engine Integration Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test async engine integration
            self.logger.info("Test: Async SQLAlchemy Engine Integration")
            try:
                # Create async SQLAlchemy engine
                connection_string = f"mysql+aiomysql://{user}:{password}@{host}:{port}/{database}"
                async_engine = create_async_engine(connection_string)

                # Create MatrixOne AsyncClient from existing SQLAlchemy engine
                client = AsyncClient.from_engine(async_engine)
                self.logger.info("✅ Created MatrixOne AsyncClient from SQLAlchemy engine")

                # Test basic functionality
                result = await client.execute("SELECT 1 as async_test_value")
                rows = result.fetchall()
                self.logger.info(f"📊 Async test query result: {rows[0][0]}")

                # Test database operations
                test_db = "demo_async_engine_db"
                await client.execute(f"CREATE DATABASE IF NOT EXISTS {test_db}")
                await client.execute(f"USE {test_db}")

                # Create test table
                await client.execute("DROP TABLE IF EXISTS async_engine_test")
                await client.execute("CREATE TABLE async_engine_test (id INT PRIMARY KEY, name VARCHAR(100))")

                # Insert test data
                await client.execute("INSERT INTO async_engine_test VALUES (1, 'Async Test Data 1')")
                await client.execute("INSERT INTO async_engine_test VALUES (2, 'Async Test Data 2')")

                # Query test data
                result = await client.execute("SELECT COUNT(*) FROM async_engine_test")
                count = result.fetchone()[0]
                self.logger.info(f"📊 Async test table has {count} records")

                # Cleanup
                await client.execute(f"DROP DATABASE IF EXISTS {test_db}")
                await client.disconnect()

                self.results['tests_passed'] += 1

            except Exception as e:
                self.logger.error(f"❌ Async engine integration test failed: {e}")
                self.results['tests_failed'] += 1
                self.results['unexpected_results'].append({'test': 'Async SQLAlchemy Engine Integration', 'error': str(e)})

        except Exception as e:
            self.logger.error(f"❌ Async engine integration test failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append({'test': 'Async Engine Integration', 'error': str(e)})

    def test_engine_reuse(self):
        """Test engine reuse functionality"""
        print("\n=== Engine Reuse Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test engine reuse
            self.logger.info("Test: Engine Reuse")
            try:
                # Create SQLAlchemy engine
                connection_string = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
                engine = create_engine(connection_string)

                # Create multiple clients from the same engine
                client1 = Client.from_engine(engine)
                client2 = Client.from_engine(engine)

                self.logger.info("✅ Created multiple clients from same engine")

                # Test both clients work
                result1 = client1.execute("SELECT 1 as client1_test")
                result2 = client2.execute("SELECT 2 as client2_test")

                self.logger.info(f"📊 Client 1 result: {result1.fetchone()[0]}")
                self.logger.info(f"📊 Client 2 result: {result2.fetchone()[0]}")

                self.results['tests_passed'] += 1

            except Exception as e:
                self.logger.error(f"❌ Engine reuse test failed: {e}")
                self.results['tests_failed'] += 1
                self.results['unexpected_results'].append({'test': 'Engine Reuse', 'error': str(e)})

        except Exception as e:
            self.logger.error(f"❌ Engine reuse test failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append({'test': 'Engine Reuse', 'error': str(e)})

    def test_custom_engine_configuration(self):
        """Test custom engine configuration"""
        print("\n=== Custom Engine Configuration Tests ===")

        self.results['tests_run'] += 1

        try:
            # Get connection parameters from config
            host, port, user, password, database = get_connection_params()

            # Test custom engine configuration
            self.logger.info("Test: Custom Engine Configuration")
            try:
                # Create SQLAlchemy engine with custom configuration
                connection_string = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
                engine = create_engine(connection_string, pool_size=5, max_overflow=10, pool_pre_ping=True, echo=False)

                # Create MatrixOne Client from custom engine
                client = Client.from_engine(engine)
                self.logger.info("✅ Created MatrixOne Client from custom engine
```

### Core Architecture Module: `clients/python/examples/example_connection_hooks.py`
```
#!/usr/bin/env python3

# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Example: Connection Hooks - Automatic Feature Enablement on Connection

This example demonstrates how to use connection hooks to automatically
enable features like IVF, HNSW, and fulltext search after connecting to MatrixOne:

1. Basic connection hooks with predefined actions
2. Custom callback functions
3. Mixed actions and custom callbacks
4. Asynchronous connection hooks
5. String-based action names
6. Practical application examples
7. Error handling and logging

Connection hooks allow you to automatically configure your MatrixOne client
whenever a new connection is established, eliminating the need for manual
feature enablement.
"""

import asyncio
import logging
from matrixone import Client, AsyncClient
from matrixone.connection_hooks import ConnectionAction, create_connection_hook
from matrixone.config import get_connection_kwargs, print_config
from matrixone.logger import create_default_logger


class ConnectionHooksDemo:
    """Demonstrates connection hooks capabilities with comprehensive testing."""

    def __init__(self):
        self.logger = create_default_logger(
            sql_log_mode="auto",
        )
        self.results = {
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'unexpected_results': [],
            'connection_hooks_tested': [],
        }
        # Get connection parameters and filter to only supported ones
        all_params = get_connection_kwargs()
        self.connection_params = {
            'host': all_params['host'],
            'port': all_params['port'],
            'user': all_params['user'],
            'password': all_params['password'],
            'database': all_params['database'],
        }
        # Note: on_connect is available in all_params but we'll set it explicitly in examples

    def sync_connection_hooks_example(self):
        """Demonstrate connection hooks with synchronous client"""
        print("=== Synchronous Connection Hooks Example ===")

        # Example 1: Enable all features
        print("\n1. Enable all features:")
        self.results['tests_run'] += 1
        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_ALL],
            )
            print("✓ Connected with all features enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ENABLE_ALL')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ENABLE_ALL failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 2: Enable only vector operations
        print("\n2. Enable only vector operations:")
        self.results['tests_run'] += 1
        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_VECTOR],
            )
            print("✓ Connected with vector operations enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ENABLE_VECTOR')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ENABLE_VECTOR failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 3: Enable only fulltext search
        print("\n3. Enable only fulltext search:")
        self.results['tests_run'] += 1
        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_FULLTEXT],
            )
            print("✓ Connected with fulltext search enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ENABLE_FULLTEXT')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ENABLE_FULLTEXT failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 4: Custom callback function
        print("\n4. Custom callback function:")
        self.results['tests_run'] += 1

        def my_callback(client):
            print(f"  Custom callback: Connected to {client._connection_params['host']}:{client._connection_params['port']}")
            print(f"  Database: {client._connection_params['database']}")

        client = Client()
        try:
            client.connect(**self.connection_params, on_connect=my_callback)
            print("✓ Connected with custom callback")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('CUSTOM_CALLBACK')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"CUSTOM_CALLBACK failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

        # Example 5: Mixed actions and custom callback
        print("\n5. Mixed actions and custom callback:")
        self.results['tests_run'] += 1

        def setup_callback(client):
            print(f"  Setup callback: Setting up client for {client._connection_params['database']}")
            # You can add custom setup logic here

        client = Client()
        try:
            client.connect(
                **self.connection_params,
                on_connect=create_connection_hook(
                    actions=[ConnectionAction.ENABLE_FULLTEXT, ConnectionAction.ENABLE_IVF], custom_hook=setup_callback
                ),
            )
            print("✓ Connected with mixed actions and custom callback")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('MIXED_ACTIONS')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"MIXED_ACTIONS failed: {e}")
        finally:
            if client.connected():
                client.disconnect()

    async def async_connection_hooks_example(self):
        """Demonstrate connection hooks with asynchronous client"""
        print("\n=== Asynchronous Connection Hooks Example ===")

        # Example 1: Enable all features
        print("\n1. Enable all features:")
        self.results['tests_run'] += 1
        client = AsyncClient()
        try:
            await client.connect(
                **self.connection_params,
                on_connect=[ConnectionAction.ENABLE_ALL],
            )
            print("✓ Connected with all features enabled")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ASYNC_ENABLE_ALL')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ASYNC_ENABLE_ALL failed: {e}")
        finally:
            if client.connected():
                await client.disconnect()

        # Example 2: Custom async callback
        print("\n2. Custom async callback:")
        self.results['tests_run'] += 1

        async def async_callback(client):
            print(f"  Async callback: Connected to {client._connection_params['host']}:{client._connection_params['port']}")
            print(f"  Database: {client._connection_params['database']}")
            # Simulate some async setup
            await asyncio.sleep(0.1)
            print("  Async setup completed")

        client = AsyncClient()
        try:
            await client.connect(**self.connection_params, on_connect=async_callback)
            print("✓ Connected with async callback")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ASYNC_CUSTOM_CALLBACK')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ASYNC_CUSTOM_CALLBACK failed: {e}")
        finally:
            if client.connected():
                await client.disconnect()

        # Example 3: String action names
        print("\n3. Using string action names:")
        self.results['tests_run'] += 1
        client = AsyncClient()
        try:
            await client.connect(
                **self.connection_params,
                on_connect=["enable_fulltext", "enable_ivf"],
            )
            print("✓ Connected with string action names")
            self.results['tests_passed'] += 1
            self.results['connection_hooks_tested'].append('ASYNC_STRING_ACTIONS')
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            self.results['tests_failed'] += 1
            self.results['unexpected_results'].append(f"ASYNC_STRING_ACTIONS failed: {e}")
        finally:
            if client.connected():
         
```

### Core Architecture Module: `clients/python/matrixone/_utils.py`
```
"""Shared internal utilities for MatrixOne SDK modules."""

from typing import Union, Type

try:
    from sqlalchemy.orm import DeclarativeMeta as _unused  # noqa: F401

    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


def get_table_name(table: Union[str, Type]) -> str:
    """Extract table name from string or ORM model.

    Supports:
    - "table_name"
    - "db.table_name"
    - ORM model with optional __table_args__['schema'] for db.table
    """
    if isinstance(table, str):
        return table
    if SQLALCHEMY_AVAILABLE and hasattr(table, '__tablename__'):
        name = table.__tablename__
        if hasattr(table, '__table_args__'):
            args = table.__table_args__
            if isinstance(args, dict) and 'schema' in args:
                return f"{args['schema']}.{name}"
        return name
    raise ValueError(f"Invalid table parameter: {table}. Expected string or ORM model.")


def require_non_empty(value: str, param_name: str) -> str:
    """Validate that a string parameter is non-empty."""
    if not value:
        raise ValueError(f"{param_name} must be a non-empty string")
    return value

```

### Core Architecture Module: `clients/python/matrixone/connection_hooks.py`
```
# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Connection hooks for MatrixOne clients
"""

from enum import Enum
from typing import Callable, List, Optional, Union

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine


class ConnectionAction(Enum):
    """Predefined connection actions that can be executed after connecting"""

    ENABLE_IVF = "enable_ivf"
    ENABLE_HNSW = "enable_hnsw"
    ENABLE_FULLTEXT = "enable_fulltext"
    ENABLE_VECTOR = "enable_vector"  # Enables both IVF and HNSW
    ENABLE_ALL = "enable_all"  # Enables all features


class ConnectionHook:
    """Connection hook that executes actions after successful connection"""

    def __init__(self, actions: Optional[List[Union[ConnectionAction, str]]] = None, custom_hook: Optional[Callable] = None):
        """
        Initialize connection hook

        Args:

            actions: List of predefined actions to execute
            custom_hook: Custom callback function to execute
        """
        self.actions = actions or []
        self.custom_hook = custom_hook
        self._action_handlers = {
            ConnectionAction.ENABLE_IVF: self._enable_ivf_with_connection,
            ConnectionAction.ENABLE_HNSW: self._enable_hnsw_with_connection,
            ConnectionAction.ENABLE_FULLTEXT: self._enable_fulltext_with_connection,
            ConnectionAction.ENABLE_VECTOR: self._enable_vector_with_connection,
            ConnectionAction.ENABLE_ALL: self._enable_all_with_connection,
        }
        self._client_ref = None  # Will be set when hook is attached to a client
        self._executed_connections = set()  # Track which connections have executed the hook

    def set_client(self, client):
        """Set the client reference for this hook"""
        self._client_ref = client

    def attach_to_engine(self, engine: Union[Engine, AsyncEngine]):
        """Attach this hook to a SQLAlchemy engine to listen for connection events"""
        if isinstance(engine, AsyncEngine):
            # For async engines, listen to both connect and before_cursor_execute events
            event.listen(engine.sync_engine, "connect", self._on_connect_sync)
            event.listen(engine.sync_engine, "before_cursor_execute", self._on_before_cursor_execute)
            if hasattr(self._client_ref, 'logger'):
                self._client_ref.logger.debug("Attached connection hook to async engine")
        else:
            # For sync engines, listen to both connect and before_cursor_execute events
            event.listen(engine, "connect", self._on_connect_sync)
            event.listen(engine, "before_cursor_execute", self._on_before_cursor_execute)
            if hasattr(self._client_ref, 'logger'):
                self._client_ref.logger.debug("Attached connection hook to sync engine")

    def _on_connect_sync(self, dbapi_connection, connection_record):
        """SQLAlchemy event handler for new connections (sync)"""
        if self._client_ref:
            # Get connection ID to track which connections have executed the hook
            conn_id = id(dbapi_connection)
            if conn_id not in self._executed_connections:
                try:
                    # Log that the hook is being executed
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.debug(f"Executing connection hook on new connection {conn_id}")
                    # Pass the connection to avoid creating new connections
                    self.execute_sync_with_connection(self._client_ref, dbapi_connection)
                    self._executed_connections.add(conn_id)
                except Exception as e:
                    # Log error but don't fail the connection
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.warning(f"Connection hook execution failed: {e}")

    def _on_before_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """SQLAlchemy event handler for before cursor execute"""
        if self._client_ref:
            # Get connection ID to track which connections have executed the hook
            conn_id = id(conn.connection)
            if conn_id not in self._executed_connections:
                try:
                    # Log that the hook is being executed
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.debug(f"Executing connection hook on connection {conn_id}")
                    # Use the connection to avoid creating new connections
                    self.execute_sync_with_connection(self._client_ref, conn.connection)
                    self._executed_connections.add(conn_id)
                except Exception as e:
                    # Log error but don't fail the query
                    if hasattr(self._client_ref, 'logger'):
                        self._client_ref.logger.warning(f"Connection hook execution failed: {e}")

    async def execute_async(self, client) -> None:
        """Execute hook actions asynchronously (for immediate execution)"""
        try:
            # For immediate execution, we need to get a connection from the client
            # This is a fallback for when we don't have a specific connection
            if hasattr(client, '_engine') and client._engine:
                async with client._engine.connect() as conn:
                    # Execute actions directly on async connection
                    await self.execute_async_on_connection(client, conn)
            else:
                client.logger.warning("No engine available for connection hook execution")

        except Exception as e:
            client.logger.warning(f"Connection hook execution failed: {e}")

    async def execute_async_on_connection(self, client, async_connection) -> None:
        """Execute hook actions on an AsyncConnection (SQLAlchemy async connection)"""
        try:
            # Execute predefined actions
            for action in self.actions:
                if isinstance(action, str):
                    action = ConnectionAction(action)

                # Execute SQL directly on async connection
                if action == ConnectionAction.ENABLE_IVF:
                    await async_connection.execute(text("SET experimental_ivf_index = 1"))
                    client.logger.debug("✓ Enabled IVF vector operations")
                elif action == ConnectionAction.ENABLE_HNSW:
                    await async_connection.execute(text("SET experimental_hnsw_index = 1"))
                    client.logger.debug("✓ Enabled HNSW vector operations")
                elif action == ConnectionAction.ENABLE_FULLTEXT:
                    await async_connection.execute(text("SET experimental_fulltext_index = 1"))
                    client.logger.debug("✓ Enabled fulltext search operations")
                elif action == ConnectionAction.ENABLE_VECTOR:
                    await async_connection.execute(text("SET experimental_ivf_index = 1"))
                    await async_connection.execute(text("SET experimental_hnsw_index = 1"))
                    client.logger.debug("✓ Enabled vector operations")
                elif action == ConnectionAction.ENABLE_ALL:
                    await async_connection.execute(text("SET experimental_ivf_index = 1"))
                    await async_connection.execute(text("SET experimental_hnsw_index = 1"))
                    await async_connection.execute(text("SET experimental_fulltext_index = 1"))
                    client.logger.debug("✓ Enabled all operations")
                else:
                    client.logger.warning(f"Unknown connection action: {action}")

            # Execute custom hook if provided
            if self.custom_hook:
                if hasattr(self.custom_hook, '__call__'):
                    # Check if it's an async function
                    if hasattr(self.custom_hook, '__code__') and self.custom_hook.__code__.co_flags & 0x80:
                        await self.custom_hook(client)
                    else:
                        # Try to call it as sync
                        try:
                            result = self.custom_hook(client)
                            # If it returns a coroutine, await it
                            if hasattr(result, '__await__'):
                                await result
                        except TypeError as e:
                            if "object NoneType can't be used in 'await' expression" in str(e):
                                client.logger.warning("Custom hook appears to be async but was called synchronously")

        except Exception as e:
            client.logger.warning(f"Connection hook execution failed: {e}")

    async def execute_async_with_connection(self, client, dbapi_connection) -> None:
        """Execute hook actions asynchronously using the provided connection"""
        try:
            # Execute predefined actions with connection
            for action in self.actions:
                if isinstance(action, str):
                    action = ConnectionAction(action)

                if action in self._action_handlers:
                    # For async, we still use the sync methods since they work with direct connection
                    self._action_handlers[action](client, dbapi_connection)
                els
```

### Core Architecture Module: `clients/python/matrixone/index_utils.py`
```
# Copyright 2021 - 2022 Matrix Origin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Index utilities - Shared logic for secondary index operations
"""

from typing import List, Tuple


def build_get_index_tables_sql(table_name: str, database: str = None) -> Tuple[str, Tuple]:
    """
    Build SQL to get all secondary index table names for a given table.

    This includes both MULTIPLE (regular secondary indexes) and UNIQUE indexes.

    Args:
        table_name: Name of the table
        database: Name of the database (optional, but recommended to avoid cross-database conflicts)

    Returns:
        Tuple of (sql, params)
    """
    if database:
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND reldatabase = ? AND type IN ('MULTIPLE', 'UNIQUE')
        """
        return sql, (table_name, database)
    else:
        # Fallback to old behavior if database is not provided
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND type IN ('MULTIPLE', 'UNIQUE')
        """
        return sql, (table_name,)


def build_get_index_table_by_name_sql(table_name: str, index_name: str, database: str = None) -> Tuple[str, Tuple]:
    """
    Build SQL to get the physical table name of a secondary index by its index name.

    Args:
        table_name: Name of the table
        index_name: Name of the secondary index
        database: Name of the database (optional, but recommended to avoid cross-database conflicts)

    Returns:
        Tuple of (sql, params)
    """
    if database:
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND name = ? AND reldatabase = ?
        """
        return sql, (table_name, index_name, database)
    else:
        # Fallback to old behavior if database is not provided
        sql = """
            SELECT DISTINCT index_table_name
            FROM mo_catalog.mo_indexes
            JOIN mo_catalog.mo_tables ON mo_indexes.table_id = mo_tables.rel_id
            WHERE relname = ? AND name = ?
        """
        return sql, (table_name, index_name)


def build_verify_counts_sql(table_name: str, index_tables: List[str]) -> str:
    """
    Build SQL to verify counts of main table and all index tables in a single query.

    Args:
        table_name: Name of the main table
        index_tables: List of index table names

    Returns:
        SQL string
    """
    if not index_tables:
        return f"SELECT COUNT(*) FROM `{table_name}`"

    select_parts = [f"(SELECT COUNT(*) FROM `{table_name}`) as main_count"]
    for idx, index_table in enumerate(index_tables):
        select_parts.append(f"(SELECT COUNT(*) FROM `{index_table}`) as idx{idx}_count")

    return "SELECT " + ", ".join(select_parts)


def process_verify_result(table_name: str, index_tables: List[str], row: Tuple) -> int:
    """
    Process the verification result and raise exception if counts don't match.

    Args:
        table_name: Name of the main table
        index_tables: List of index table names
        row: Result row from the verification SQL

    Returns:
        Row count if verification succeeds

    Raises:
        ValueError: If any index table has a different count
    """
    main_count = row[0]

    if not index_tables:
        return main_count

    index_counts = {}
    mismatch = []

    for idx, index_table in enumerate(index_tables):
        index_count = row[idx + 1]
        index_counts[index_table] = index_count
        if index_count != main_count:
            mismatch.append(index_table)

    # If there's a mismatch, raise an exception with details
    if mismatch:
        error_details = [f"Main table '{table_name}': {main_count} rows"]
        for index_table, count in index_counts.items():
            status = "✗ MISMATCH" if index_table in mismatch else "✓"
            error_details.append(f"{status} Index '{index_table}': {count} rows")

        error_msg = "Index count verification failed!\n" + "\n".join(error_details)
        raise ValueError(error_msg)

    return main_count

```

### Core Architecture Module: `cmd/mo-service/lifecycle.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/matrixorigin/matrixone/pkg/logutil"
	"go.uber.org/zap"
)

type serviceRole uint8

const (
	serviceRoleProxy serviceRole = iota
	serviceRoleCN
	serviceRoleTN
	serviceRoleLog
	serviceRolePython
	serviceRoleCount
)

func (r serviceRole) String() string {
	switch r {
	case serviceRoleProxy:
		return "proxy"
	case serviceRoleCN:
		return "cn"
	case serviceRoleTN:
		return "tn"
	case serviceRoleLog:
		return "log"
	case serviceRolePython:
		return "python"
	default:
		return "unknown"
	}
}

type serviceRoleState struct {
	stopOnce sync.Once
	stopC    chan struct{}
	wg       sync.WaitGroup

	errMu sync.Mutex
	err   error
	count int
}

type serviceSupervisor struct {
	roles [serviceRoleCount]serviceRoleState

	shutdownOnce       sync.Once
	shutdownErr        error
	dynamicCleanupOnce sync.Once
	dynamicCleanupErr  error
	fatalC             chan error

	dynamicCNStop func(context.Context) error
}

func newServiceSupervisor() *serviceSupervisor {
	s := &serviceSupervisor{}
	for i := range s.roles {
		s.roles[i].stopC = make(chan struct{})
	}
	s.fatalC = make(chan error, 1)
	return s
}

func (s *serviceSupervisor) failureC() <-chan error {
	if s == nil {
		return nil
	}
	return s.fatalC
}

func (s *serviceSupervisor) notifyFatal(err error) {
	if s == nil || err == nil {
		return
	}
	select {
	case s.fatalC <- err:
	default:
	}
}

// registerTask reserves a role slot before starting its stopper task. Shutdown
// is only invoked after startup has returned, so Add and Wait cannot race.
func (s *serviceSupervisor) registerTask(role serviceRole) func(error) {
	if s == nil {
		return func(error) {}
	}
	state := &s.roles[role]
	state.errMu.Lock()
	state.count++
	state.errMu.Unlock()
	state.wg.Add(1)
	var finishOnce sync.Once
	return func(err error) {
		finishOnce.Do(func() {
			if err != nil {
				state.errMu.Lock()
				state.err = errors.Join(state.err, err)
				state.errMu.Unlock()
			}
			state.wg.Done()
		})
	}
}

// roleContext derives a context that is cancelled when the supervisor reaches
// the role's shutdown phase. Service tasks use it only for their run loops;
// the service Close method still owns its orderly shutdown.
func (s *serviceSupervisor) roleContext(parent context.Context, role serviceRole) (context.Context, context.CancelFunc) {
	if s == nil {
		return parent, func() {}
	}
	ctx, cancel := context.WithCancel(parent)
	go func() {
		select {
		case <-s.roles[role].stopC:
			cancel()
		case <-parent.Done():
			cancel()
		case <-ctx.Done():
		}
	}()
	return ctx, cancel
}

func (s *serviceSupervisor) setDynamicCNStop(stop func(context.Context) error) {
	if s != nil {
		s.dynamicCNStop = stop
	}
}

func (s *serviceSupervisor) cleanupDynamicCN(ctx context.Context) error {
	if s == nil || s.dynamicCNStop == nil {
		return nil
	}
	s.dynamicCleanupOnce.Do(func() {
		cleanupCtx, cancel := context.WithTimeout(ctx, time.Minute)
		defer cancel()
		s.dynamicCleanupErr = s.dynamicCNStop(cleanupCtx)
	})
	return s.dynamicCleanupErr
}

func (s *serviceSupervisor) stopRole(
	ctx context.Context,
	role serviceRole,
) error {
	state := &s.roles[role]
	state.stopOnce.Do(func() { close(state.stopC) })
	done := make(chan struct{})
	go func() {
		state.wg.Wait()
		close(done)
	}()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	start := time.Now()
	for {
		select {
		case <-done:
			state.errMu.Lock()
			err := state.err
			count := state.count
			state.errMu.Unlock()
			logutil.Info("shutdown role drained",
				zap.String("shutdown_phase", role.String()),
				zap.Int("service_count", count),
				zap.Duration("duration", time.Since(start)),
				zap.Bool("clean_handoff", err == nil && role == serviceRoleCN),
				zap.Error(err))
			return err
		case <-ticker.C:
			state.errMu.Lock()
			count := state.count
			state.errMu.Unlock()
			logutil.Warn("shutdown role still draining",
				zap.String("shutdown_phase", role.String()),
				zap.Int("service_count", count),
				zap.Duration("duration", time.Since(start)))
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *serviceSupervisor) shutdown(ctx context.Context) error {
	if s == nil {
		return nil
	}
	s.shutdownOnce.Do(func() {
		defer func() {
			if s.shutdownErr != nil {
				s.shutdownErr = errors.Join(s.shutdownErr, s.cleanupDynamicCN(context.Background()))
			}
		}()

		// The built-in proxy is not a stopper task and must stop accepting
		// external SQL before CN ingress is withdrawn.
		if cnProxy != nil {
			if err := cnProxy.Stop(); err != nil {
				s.shutdownErr = err
				return
			}
		}

		phases := []struct {
			role    serviceRole
			timeout time.Duration
		}{
			{serviceRoleProxy, time.Minute},
			{serviceRoleCN, time.Minute},
			{serviceRolePython, time.Minute},
			{serviceRoleTN, 4 * time.Minute},
			{serviceRoleLog, time.Minute},
		}

		for _, phase := range phases {
			phaseCtx, cancel := context.WithTimeout(ctx, phase.timeout)
			start := time.Now()
			logutil.Info("shutdown phase start",
				zap.String("shutdown_phase", phase.role.String()),
				zap.Duration("timeout", phase.timeout))
			var err error
			if phase.role == serviceRoleCN && s.dynamicCNStop != nil {
				dynamicDone := make(chan error, 1)
				go func() { dynamicDone <- s.cleanupDynamicCN(phaseCtx) }()
				err = errors.Join(err, s.stopRole(phaseCtx, phase.role))
				err = errors.Join(err, <-dynamicDone)
			} else {
				err = errors.Join(err, s.stopRole(phaseCtx, phase.role))
			}
			cancel()
			logutil.Info("shutdown phase done",
				zap.String("shutdown_phase", phase.role.String()),
				zap.Duration("duration", time.Since(start)),
				zap.Bool("clean_handoff", err == nil && phase.role == serviceRoleCN),
				zap.Error(err))
			if err != nil {
				s.shutdownErr = errors.Join(s.shutdownErr, err)
				// Do not tear down a dependency after any role failed to close.
				// The caller must fail-stop and let recovery resolve an unknown
				// commit or an incomplete owner handoff.
				return
			}
		}
	})
	return s.shutdownErr
}

func (s *serviceSupervisor) shutdownAfterFatal(ctx context.Context) error {
	if s == nil {
		return nil
	}
	return s.shutdown(ctx)
}

```

### Core Architecture Module: `optools/tpch_compare/engine.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	_ "github.com/duckdb/duckdb-go/v2"
	"github.com/go-sql-driver/mysql"
)

type Engine struct {
	Name        string `json:"name"`
	Database    string `json:"database"`
	DSNEnv      string `json:"dsn_env,omitempty"`
	Threads     int    `json:"threads"`
	MemoryBytes int64  `json:"memory_bytes"`
}

func quoteSQL(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

func openEngine(ctx context.Context, e Engine) (*sql.DB, error) {
	var db *sql.DB
	var err error
	switch e.Name {
	case "mo":
		if !strings.HasPrefix(e.Database, "tpch_compare_") {
			return nil, errors.New("MO database must use the private tpch_compare_ prefix")
		}
		var cfg *mysql.Config
		cfg, err = mysql.ParseDSN(os.Getenv(e.DSNEnv))
		if err != nil {
			return nil, errors.New("invalid MO DSN")
		}
		if cfg.Net != "tcp" || (!strings.HasPrefix(cfg.Addr, "127.0.0.1:") && !strings.HasPrefix(cfg.Addr, "localhost:")) {
			return nil, errors.New("benchmark MO DSN must address an owned loopback deployment")
		}
		cfg.DBName = e.Database
		cfg.ParseTime = true
		cfg.MultiStatements = false
		cfg.InterpolateParams = false
		cfg.Collation = "utf8mb4_bin"
		cfg.Timeout = 10 * time.Second
		cfg.ReadTimeout = 0
		cfg.WriteTimeout = 0
		db, err = sql.Open("mysql", cfg.FormatDSN())
	case "duckdb":
		db, err = sql.Open("duckdb", e.Database)
	default:
		return nil, fmt.Errorf("unknown engine %q", e.Name)
	}
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(max(e.Threads+1, 9))
	db.SetMaxIdleConns(max(e.Threads+1, 9))
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("%s readiness: %w", e.Name, err)
	}
	return db, nil
}

func configureConn(ctx context.Context, db *sql.DB, e Engine) (*sql.Conn, error) {
	conn, err := db.Conn(ctx)
	if err != nil {
		return nil, err
	}
	settings := []string{"SET time_zone = '+00:00'", "SET sql_mode = 'ANSI,ONLY_FULL_GROUP_BY'", "SET div_precision_increment = 6", "SET save_query_result = off", "SET SESSION agg_spill_mem = 2147483648"}
	if e.Name == "duckdb" {
		settings = []string{"SET TimeZone = 'UTC'", fmt.Sprintf("SET threads = %d", e.Threads), fmt.Sprintf("SET memory_limit = '%dB'", e.MemoryBytes*4/5), "SET enable_progress_bar = false", "SET default_null_order = 'NULLS_FIRST_ON_ASC_LAST_ON_DESC'"}
	}
	for _, s := range settings {
		if _, err := conn.ExecContext(ctx, s); err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("%s session setting %s: %w", e.Name, s, err)
		}
	}
	return conn, nil
}

func effectiveSettings(ctx context.Context, conn *sql.Conn, engine string) (map[string]string, error) {
	out := map[string]string{}
	if engine == "mo" {
		for _, name := range []string{"sql_mode", "time_zone", "div_precision_increment", "save_query_result", "agg_spill_mem"} {
			var v string
			if err := conn.QueryRowContext(ctx, "SELECT @@session."+name).Scan(&v); err != nil {
				return nil, err
			}
			out[name] = v
		}
		return out, nil
	}
	rows, err := conn.QueryContext(ctx, "SELECT name, value FROM duckdb_settings() WHERE name IN ('threads','memory_limit','TimeZone','enable_profiling','profiling_mode','default_collation','default_null_order')")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var value sql.NullString
		if err := rows.Scan(&name, &value); err != nil {
			return nil, err
		}
		out[name] = value.String
		if !value.Valid {
			out[name] = "<SQL NULL>"
		}
	}
	return out, rows.Err()
}

type LoadReceipt struct {
	SchemaNS     int64 `json:"schema_ns"`
	LoadNS       int64 `json:"load_ns"`
	StatisticsNS int64 `json:"statistics_ns"`
	CheckpointNS int64 `json:"checkpoint_ns"`
}

func bulkLoad(ctx context.Context, conn *sql.Conn, e Engine, root string, d Dataset) (receipt LoadReceipt, retErr error) {
	start := time.Now()
	for _, t := range d.Tables {
		if _, err := conn.ExecContext(ctx, t.ddl()); err != nil {
			return receipt, err
		}
	}
	receipt.SchemaNS = time.Since(start).Nanoseconds()
	start = time.Now()
	for _, t := range d.Tables {
		file := d.Inputs[t.Name]
		path := filepath.Join(root, file.Path)
		var s string
		if e.Name == "mo" {
			// The owned server reads the immutable local file, avoiding a second
			// client-side data generator or a row-at-a-time insert path.
			// CSV loads require an explicit opt-in to use the application's cores.
			s = "LOAD DATA INFILE " + quoteSQL(path) + " INTO TABLE " + t.Name + " FIELDS TERMINATED BY '|' LINES TERMINATED BY '\\n' PARALLEL 'true'"
		} else {
			f, err := os.Open(path)
			if err != nil {
				return receipt, err
			}
			scan := bufio.NewScanner(f)
			ok := scan.Scan()
			line := scan.Text()
			scanErr := scan.Err()
			closeErr := f.Close()
			if !ok {
				return receipt, errors.Join(errors.New("empty input"), scanErr, closeErr)
			}
			if closeErr != nil {
				return receipt, closeErr
			}
			var specs, names []string
			for _, c := range t.Columns {
				specs = append(specs, quoteSQL(c.Name)+": "+quoteSQL(c.SQLType))
				names = append(names, c.Name)
			}
			if strings.HasSuffix(line, "|") {
				specs = append(specs, "'_trailing': 'VARCHAR'")
			}
			s = "INSERT INTO " + t.Name + " SELECT " + strings.Join(names, ",") + " FROM read_csv(" + quoteSQL(path) + ", delim='|', header=false, quote='', escape='', parallel=true, columns={" + strings.Join(specs, ",") + "})"
		}
		if _, err := conn.ExecContext(ctx, s); err != nil {
			return receipt, fmt.Errorf("load %s: %w", t.Name, err)
		}
	}
	receipt.LoadNS = time.Since(start).Nanoseconds()
	start = time.Now()
	for _, t := range d.Tables {
		s := "ANALYZE " + t.Name
		if e.Name == "mo" {
			s = "ANALYZE TABLE " + t.Name
		}
		if _, err := conn.ExecContext(ctx, s); err != nil {
			return receipt, fmt.Errorf("statistics %s: %w", t.Name, err)
		}
	}
	receipt.StatisticsNS = time.Since(start).Nanoseconds()
	start = time.Now()
	s := "CHECKPOINT"
	if e.Name == "mo" {
		s = "SELECT mo_ctl('DN', 'Checkpoint', '')"
	}
	if _, err := conn.ExecContext(ctx, s); err != nil {
		return receipt, fmt.Errorf("durable preparation: %w", err)
	}
	receipt.CheckpointNS = time.Since(start).Nanoseconds()
	return receipt, nil
}

// Check catalog domains before content normalization can hide schema drift.
// DuckDB stores both CHAR(n) and VARCHAR(n) as its unbounded VARCHAR domain.
func verifyTableSchema(ctx context.Context, conn *sql.Conn, engine string, t Table) (retErr error) {
	typeColumn, scope := "c.column_type", "c.table_schema=DATABASE()"
	if engine == "duckdb" {
		typeColumn, scope = "c.data_type", "c.table_catalog=current_database() AND c.table_schema=current_schema()"
	} else if engine != "mo" {
		return errors.New("unknown schema verification engine")
	}
	query := "SELECT c.column_name," + typeColumn + ",c.is_nullable,pk.ordinal_position FROM information_schema.columns c LEFT JOIN (" +
		"SELECT k.table_catalog,k.table_schema,k.table_name,k.column_name,k.ordinal_position FROM information_schema.key_column_usage k " +
		"JOIN information_schema.table_constraints tc ON tc.constraint_catalog=k.constraint_catalog AND tc.constraint_schema=k.constraint_schema " +
		"AND tc.constraint_name=k.constraint_name AND tc.table_schema=k.table_schema AND tc.table_name=k.table_name WHERE tc.constraint_type='PRIMARY KEY'" +
		") pk ON pk.table_catalog=c.table_catalog AND pk.table_schema=c.table_schema AND pk.table_name=c.table_name AND pk.column_name=c.column_name " +
		"WHERE " + scope + " AND c.table_name=? ORDER BY c.ordinal_position"
	rows, err := conn.QueryContext(ctx, query, t.Name)
	if err != nil {
		return err
	}
	defer func() { retErr = errors.Join(retErr, rows.Close()) }()
	keyPositions := make([]int64, len(t.Columns))
	for i, k := range t.Key {
		keyPositions[k] = int64(i + 1)
	}
	i := 0
	for rows.Next() {
		var name, typ, nullable string
		var key sql.NullInt64
		if err := rows.Scan(&name, &typ, &nullable, &key); err != nil {
			return err
		}
		if i >= len(t.Columns) {
			return fmt.Errorf("schema has extra columns in %s", t.Name)
		}
		c := t.Columns[i]
		want := c.SQLType
		if engine == "mo" && want == "INTEGER" {
			want = "INT"
		}
		if engine == "duckdb" && c.Kind == "text" {
			want = "VARCHAR"
		}
		typ = strings.ReplaceAll(strings.ToUpper(typ), " ", "")
		if !strings.EqualFold(name, c.Name) || typ != want || nullable != "NO" || key.Int64 != keyPositions[i] {
			return fmt.Errorf("schema differs for %s.%s: column=%s type=%s nullable=%s key_position=%d; want type=%s NOT NULL key_position=%d", t.Name, c.Name, name, typ, nullable, key.Int64, want, keyPositions[i])
		}
		i++
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if i != len(t.Columns) {
		return fmt.Errorf("schema has %d columns in %s; want %d", i, t.Name, len(t.Columns))
	}
	return nil
}

type inputRows struct {
	f        *os.File
	scanner  *bufio.Scanner
	table    Table
	pending  Row
	previous Row
	group    []Row
	at       int
}

func openInput(path string, t Table) (*inputRows, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	s := bufio.NewScanner(f)
	s.Buffer(make([]byte, 64<<10), 1<<20)
	return &inputRows{f: f, scanner: s, table: t}, nil
}
func (r *inputRows) line() (Row, error) {
	if r.pending != nil {
		x := r.pending
		r.pending = nil
		return x, nil
	}
	if !r.scanner.Scan() {
		if err := r.scanner.Err(
```

### Core Architecture Module: `optools/tpch_compare/profile_worker.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"runtime/metrics"
	"runtime/pprof"
	"strconv"
)

type ProfileSpec struct {
	Kind string `json:"kind"`
}
type RuntimeMetric struct {
	Value string `json:"value"`
	Kind  string `json:"kind"`
}

type runtimeEvidence struct{ before, after map[string]RuntimeMetric }

func runtimeSnapshot() map[string]RuntimeMetric {
	names := []string{"/gc/gogc:percent", "/gc/gomemlimit:bytes", "/gc/cycles/total:gc-cycles", "/gc/heap/allocs:bytes", "/gc/heap/allocs:objects", "/memory/classes/heap/objects:bytes", "/cpu/classes/gc/mark/assist:cpu-seconds", "/cpu/classes/gc/total:cpu-seconds"}
	samples := make([]metrics.Sample, len(names))
	for i, name := range names {
		samples[i].Name = name
	}
	metrics.Read(samples)
	out := map[string]RuntimeMetric{}
	for _, sample := range samples {
		switch sample.Value.Kind() {
		case metrics.KindUint64:
			out[sample.Name] = RuntimeMetric{strconv.FormatUint(sample.Value.Uint64(), 10), "uint64"}
		case metrics.KindFloat64:
			out[sample.Name] = RuntimeMetric{strconv.FormatFloat(sample.Value.Float64(), 'g', -1, 64), "float64"}
		}
	}
	return out
}

func goProfileSnapshot(root, prefix, kind string) error {
	names := []string{"allocs", "heap"}
	if kind == "wait" {
		names = []string{"block", "mutex", "goroutine"}
	}
	for _, name := range names {
		p := pprof.Lookup(name)
		if p == nil {
			return fmt.Errorf("go profile %s unavailable", name)
		}
		f, err := os.OpenFile(filepath.Join(root, prefix+"-"+name+".pb.gz"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			return err
		}
		err = p.WriteTo(&limitedWriter{Writer: f, Remaining: 256 << 20}, 0)
		err = errors.Join(err, f.Close())
		if err != nil {
			return err
		}
	}
	return nil
}

func workerProfileStart(r WorkerRequest) (func() error, error) {
	if r.Profile == nil {
		return func() error { return nil }, nil
	}
	if r.Profile.Kind == "wait" {
		runtime.SetBlockProfileRate(1)
		old := runtime.SetMutexProfileFraction(1)
		return func() error { runtime.SetBlockProfileRate(0); runtime.SetMutexProfileFraction(old); return nil }, nil
	}
	return func() error { return nil }, nil
}

func configureNativeProfile(ctx context.Context, conn *sql.Conn, r WorkerRequest) error {
	if r.Profile == nil || r.Profile.Kind != "operator" || r.Engine.Name != "duckdb" {
		return nil
	}
	for _, s := range []string{"SET profiling_mode = 'detailed'", "SET profiling_coverage = 'ALL'", "SET enable_profiling = 'json'"} {
		if _, err := conn.ExecContext(ctx, s); err != nil {
			return err
		}
	}
	return nil
}

type nativeProfile struct {
	engine, root, prefix string
	selectIndex          int
	plainSelect          string
}

func (n *nativeProfile) statement(ctx context.Context, conn *sql.Conn, index int) error {
	if n == nil {
		return nil
	}
	if n.engine == "mo" && index == n.selectIndex {
		rows, err := conn.QueryContext(ctx, "EXPLAIN FORMAT=JSON "+n.plainSelect)
		if err != nil {
			return err
		}
		defer rows.Close()
		var value string
		if !rows.Next() {
			return errors.Join(errors.New("MO structured plan is empty"), rows.Err())
		}
		if err := rows.Scan(&value); err != nil {
			return err
		}
		if rows.Next() {
			return errors.New("MO structured plan has unexpected rows")
		}
		if err := rows.Err(); err != nil {
			return err
		}
		if len(value) > 16<<20 {
			return errors.New("MO structured plan exceeds bound")
		}
		return os.WriteFile(filepath.Join(n.root, n.prefix+"-plan.json"), []byte(value), 0600)
	}
	if n.engine != "duckdb" {
		return nil
	}
	path := filepath.Join(n.root, fmt.Sprintf("%s-statement-%d.json", n.prefix, index))
	_, err := conn.ExecContext(ctx, "SET profiling_output = "+quoteSQL(path))
	return err
}

```

### Core Architecture Module: `optools/tpch_compare/worker.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"runtime/debug"
	"slices"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

type WorkerRequest struct {
	Version         int           `json:"version"`
	Operation       string        `json:"operation"`
	Engine          Engine        `json:"engine"`
	DatasetRoot     string        `json:"dataset_root"`
	OutputRoot      string        `json:"output_root"`
	Queries         []int         `json:"queries,omitempty"`
	Repetitions     int           `json:"repetitions,omitempty"`
	QueryDeadlineNS int64         `json:"query_deadline_ns"`
	Reference       bool          `json:"reference,omitempty"`
	Unlimited       bool          `json:"unlimited_diagnostic,omitempty"`
	Clients         int           `json:"clients,omitempty"`
	Warmup          bool          `json:"warmup,omitempty"`
	Seed            uint64        `json:"seed,omitempty"`
	DeadlinesNS     map[int]int64 `json:"deadlines_ns,omitempty"`
	Profile         *ProfileSpec  `json:"profile,omitempty"`
	WarmupSelected  bool          `json:"warmup_selected_only,omitempty"`
	MaxWindowNS     int64         `json:"max_window_ns,omitempty"`
}
type QueryReceipt struct {
	Query      int     `json:"query"`
	Repetition int     `json:"repetition"`
	Capture    Capture `json:"capture"`
	Error      string  `json:"error,omitempty"`
	Reference  string  `json:"reference,omitempty"`
	Stream     int     `json:"stream,omitempty"`
}
type WorkerReceipt struct {
	Version       int                      `json:"version"`
	Engine        string                   `json:"engine"`
	EngineVersion string                   `json:"engine_version"`
	GoVersion     string                   `json:"go_version"`
	Build         string                   `json:"build"`
	Dataset       FileID                   `json:"dataset"`
	Binary        FileID                   `json:"binary"`
	Settings      map[string]string        `json:"effective_settings"`
	Variant       string                   `json:"variant"`
	Started       time.Time                `json:"started"`
	Finished      time.Time                `json:"finished"`
	Queries       []QueryReceipt           `json:"queries,omitempty"`
	Load          *LoadReceipt             `json:"load,omitempty"`
	Error         string                   `json:"error,omitempty"`
	Cleanup       string                   `json:"cleanup"`
	WaveNS        int64                    `json:"wave_ns,omitempty"`
	Controlled    bool                     `json:"controlled,omitempty"`
	Clients       int                      `json:"clients,omitempty"`
	RuntimeBefore map[string]RuntimeMetric `json:"runtime_before,omitempty"`
	RuntimeAfter  map[string]RuntimeMetric `json:"runtime_after,omitempty"`
}

var identifier = regexp.MustCompile(`^[a-z][a-z0-9_]{0,62}$`)

func createMODatabase(ctx context.Context, e Engine) error {
	if !identifier.MatchString(e.Database) || !strings.HasPrefix(e.Database, "tpch_compare_") {
		return errors.New("invalid private database name")
	}
	cfg, err := mysql.ParseDSN(os.Getenv(e.DSNEnv))
	if err != nil {
		return errors.New("invalid MO DSN")
	}
	if cfg.Net != "tcp" || !strings.HasPrefix(cfg.Addr, "127.0.0.1:") {
		return errors.New("owned MO deployment must use numeric loopback")
	}
	cfg.DBName = ""
	cfg.Timeout = 10 * time.Second
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	defer db.Close()
	_, err = db.ExecContext(ctx, "CREATE DATABASE "+e.Database)
	return err
}

func runWorker(ctx context.Context, r WorkerRequest, control *workerControl) (out WorkerReceipt, retErr error) {
	out = WorkerReceipt{Version: formatVersion, Engine: r.Engine.Name, GoVersion: runtime.Version(), Started: time.Now().UTC(), Cleanup: "failed"}
	out.Variant = "qualification"
	if r.Clients == 0 {
		r.Clients = 1
	}
	out.Clients = r.Clients
	out.Controlled = control != nil
	if r.Unlimited {
		out.Variant = "unlimited_diagnostic"
	}
	if r.Profile != nil {
		if !slices.Contains([]string{"operator", "cpu", "alloc", "wait", "branches", "cache"}, r.Profile.Kind) {
			return out, errors.New("unsupported profile lens")
		}
		out.Variant = "profile_" + r.Profile.Kind
		if r.Profile.Kind == "operator" && r.Clients > 1 {
			return out, errors.New("native operator profiles require one connection")
		}
	}
	if info, ok := debug.ReadBuildInfo(); ok {
		out.Build = info.String()
	}
	defer func() {
		out.Finished = time.Now().UTC()
		if retErr != nil {
			out.Error = retErr.Error()
		}
	}()
	if r.Version != formatVersion || r.Engine.Threads < 1 || r.Engine.Threads > 64 || r.Engine.MemoryBytes < 128<<20 || r.Repetitions < 0 || r.Repetitions > 2000 || r.QueryDeadlineNS <= 0 || r.Clients < 1 || r.Clients > 8 || r.Repetitions*r.Clients*len(r.Queries) > 4000 {
		return out, errors.New("invalid bounded worker request")
	}
	if r.MaxWindowNS < 0 || r.MaxWindowNS > int64(60*time.Second) {
		return out, errors.New("invalid diagnostic window cap")
	}
	if err := os.Mkdir(r.OutputRoot, 0750); err != nil {
		return out, fmt.Errorf("worker output must be a new directory: %w", err)
	}
	if err := publishJSON(filepath.Join(r.OutputRoot, "owner.json"), map[string]any{"purpose": "tpch-compare worker", "version": formatVersion}); err != nil {
		return out, err
	}
	d, err := loadDataset(r.DatasetRoot, r.Operation == "verify")
	if err != nil {
		return out, err
	}
	if r.Operation == "load" {
		if err := evictTree(r.DatasetRoot); err != nil {
			return out, err
		}
	}
	out.Dataset, err = identify(filepath.Join(r.DatasetRoot, "dataset.json"))
	if err != nil {
		return out, err
	}
	exe, err := os.Executable()
	if err != nil {
		return out, err
	}
	out.Binary, err = identify(exe)
	if err != nil {
		return out, err
	}
	if r.Operation == "load" && r.Engine.Name == "mo" {
		if err := createMODatabase(ctx, r.Engine); err != nil {
			return out, err
		}
	}
	db, err := openEngine(ctx, r.Engine)
	if err != nil {
		return out, err
	}
	defer func() {
		err := db.Close()
		retErr = errors.Join(retErr, err)
		if err == nil {
			out.Cleanup = "complete"
		}
	}()
	conn, err := configureConn(ctx, db, r.Engine)
	if err != nil {
		return out, err
	}
	defer func() { retErr = errors.Join(retErr, conn.Close()) }()
	if err := conn.QueryRowContext(ctx, "SELECT version()").Scan(&out.EngineVersion); err != nil {
		return out, err
	}
	out.Settings, err = effectiveSettings(ctx, conn, r.Engine.Name)
	if err != nil {
		return out, err
	}
	switch r.Operation {
	case "fixtures":
		return out, qualifyFixtures(ctx, conn, r.OutputRoot)
	case "load":
		receipt, err := bulkLoad(ctx, conn, r.Engine, r.DatasetRoot, d)
		out.Load = &receipt
		return out, err
	case "verify":
		for _, t := range d.Tables {
			if err := verifyTableSchema(ctx, conn, r.Engine.Name, t); err != nil {
				return out, err
			}
			if err := verifyTable(ctx, conn, r.DatasetRoot, t, d.Inputs[t.Name]); err != nil {
				return out, err
			}
		}
		return out, verifyRelationships(ctx, conn)
	case "queries":
		if r.Repetitions < 1 || len(r.Queries) < 1 || len(r.Queries) > 22 {
			return out, errors.New("nonempty bounded query selection required")
		}
		var evidence *runtimeEvidence
		if r.Profile != nil || r.MaxWindowNS > 0 {
			evidence = &runtimeEvidence{}
		}
		out.Queries, out.WaveNS, err = runQueryStreams(ctx, db, conn, r, d, control, evidence)
		if evidence != nil {
			out.RuntimeBefore, out.RuntimeAfter = evidence.before, evidence.after
		}
		return out, err
	default:
		return out, fmt.Errorf("unsupported worker operation %q", r.Operation)
	}
}

```

### Core Architecture Module: `optools/tpch_compare/worker_stream.go`
```
// Copyright 2026 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
)

type workerControl struct{ gate, events *os.File }

func (c *workerControl) close() { _ = c.gate.Close(); _ = c.events.Close() }
func (c *workerControl) barrier(event string) error {
	if c == nil {
		return nil
	}
	if _, err := fmt.Fprintln(c.events, event); err != nil {
		return err
	}
	var b [1]byte
	_, err := io.ReadFull(c.gate, b[:])
	if err != nil {
		return err
	}
	if b[0] != 'g' {
		return errors.New("invalid controller gate")
	}
	return nil
}

func (c *workerControl) step(start bool, stream, query int, deadline int64) error {
	if c == nil {
		return nil
	}
	state := "end"
	if start {
		state = "start"
	}
	_, err := fmt.Fprintf(c.events, "%s %d %d %d\n", state, stream, query, deadline)
	return err
}

type waveClock struct {
	mu          sync.Mutex
	first, last time.Time
}

func (w *waveClock) start(t time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.first.IsZero() || t.Before(w.first) {
		w.first = t
	}
}
func (w *waveClock) finish(t time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if t.After(w.last) {
		w.last = t
	}
}
func (w *waveClock) elapsed() int64 {
	if w.first.IsZero() || w.last.IsZero() {
		return 0
	}
	return w.last.Sub(w.first).Nanoseconds()
}

func queryPermutation(queries []int, stream int, seed uint64) []int {
	out := slices.Clone(queries)
	if stream > 0 {
		rng := rand.New(rand.NewPCG(seed, uint64(stream)))
		rng.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	}
	return out
}

func runQueryStreams(ctx context.Context, db *sql.DB, first *sql.Conn, r WorkerRequest, d Dataset, control *workerControl, evidence *runtimeEvidence) (out []QueryReceipt, waveNS int64, retErr error) {
	seen := map[int]bool{}
	for _, n := range r.Queries {
		if n < 1 || n > 22 || seen[n] {
			return nil, 0, errors.New("invalid or duplicate query selection")
		}
		seen[n] = true
	}
	conns := []*sql.Conn{first}
	for i := 1; i < r.Clients; i++ {
		conn, err := configureConn(ctx, db, r.Engine)
		if err != nil {
			return nil, 0, err
		}
		defer func() { retErr = errors.Join(retErr, conn.Close()) }()
		conns = append(conns, conn)
	}
	if r.Warmup {
		warmQueries := allQueries()
		if r.WarmupSelected {
			warmQueries = r.Queries
		}
		for _, n := range warmQueries {
			q := d.Queries[n-1].rendered(fmt.Sprintf("warm_%d_%d", os.Getpid(), n))
			path := filepath.Join(r.OutputRoot, fmt.Sprintf("warm-q%02d.rows", n))
			deadline := r.QueryDeadlineNS
			if value := r.DeadlinesNS[n]; value > 0 {
				deadline = value
			}
			qctx, cancel := context.WithTimeoutCause(ctx, time.Duration(deadline), errors.New("warmup deadline"))
			if err := control.step(true, 0, n, deadline); err != nil {
				cancel()
				return nil, 0, err
			}
			_, err := executeUnit(qctx, first, q, path, captureDisk)
			cancel()
			err = errors.Join(err, control.step(false, 0, n, 0))
			if err != nil {
				return nil, 0, fmt.Errorf("warmup: %w", err)
			}
			if err := os.Remove(path); err != nil {
				return nil, 0, err
			}
		}
	}
	if err := configureNativeProfile(ctx, first, r); err != nil {
		return nil, 0, err
	}
	finishProfile, err := workerProfileStart(r)
	if err != nil {
		return nil, 0, err
	}
	defer func() { retErr = errors.Join(retErr, finishProfile()) }()
	if r.Profile != nil && (r.Profile.Kind == "alloc" || r.Profile.Kind == "wait") {
		if err := goProfileSnapshot(r.OutputRoot, "before", r.Profile.Kind); err != nil {
			return nil, 0, err
		}
	}
	if evidence != nil {
		evidence.before = runtimeSnapshot()
	}
	if err := control.barrier("ready"); err != nil {
		return nil, 0, err
	}
	streamsCtx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	type streamResult struct {
		stream  int
		queries []QueryReceipt
		err     error
	}
	results := make(chan streamResult, r.Clients)
	start := make(chan struct{})
	clock := &waveClock{}
	for stream, conn := range conns {
		go func() {
			result := streamResult{stream: stream}
			defer func() { results <- result }()
			<-start
			for rep := 0; rep < r.Repetitions; rep++ {
				for _, n := range queryPermutation(r.Queries, stream, r.Seed) {
					q := d.Queries[n-1].rendered(fmt.Sprintf("%d_%d_%d_%d", os.Getpid(), stream, rep, n))
					var native *nativeProfile
					if r.Profile != nil && r.Profile.Kind == "operator" {
						native = &nativeProfile{engine: r.Engine.Name, root: r.OutputRoot, prefix: fmt.Sprintf("native-q%02d-s%d-r%d", n, stream, rep), selectIndex: q.ResultStatement, plainSelect: q.Statements[q.ResultStatement]}
						if r.Engine.Name == "mo" {
							q.Statements[q.ResultStatement] = "EXPLAIN ANALYZE " + q.Statements[q.ResultStatement]
							q.Columns = []Column{{Kind: "text"}}
						}
					}
					if r.Unlimited && q.Limit > 0 {
						q.Statements[q.ResultStatement] = strings.TrimSuffix(q.Statements[q.ResultStatement], fmt.Sprintf(" LIMIT %d", q.Limit))
						q.Limit = 0
					}
					deadline := r.QueryDeadlineNS
					if limit := r.DeadlinesNS[n]; limit > 0 {
						deadline = limit
					}
					qctx, qcancel := context.WithTimeoutCause(streamsCtx, time.Duration(deadline), fmt.Errorf("query Q%d deadline", n))
					if err := control.step(true, stream, n, deadline); err != nil {
						qcancel()
						result.err = err
						cancel(err)
						return
					}
					cap, err := executeUnitClock(qctx, conn, q, filepath.Join(r.OutputRoot, fmt.Sprintf("q%02d-s%02d-%04d.rows", n, stream, rep)), captureDisk, clock, native)
					qcancel()
					err = errors.Join(err, control.step(false, stream, n, 0))
					receipt := QueryReceipt{Query: n, Repetition: rep, Stream: stream, Capture: cap}
					if err == nil && r.Reference {
						err = qualifyReference(r.DatasetRoot, d, q, r.OutputRoot, cap)
						receipt.Reference = "pass"
						if err != nil {
							receipt.Reference = "failed"
						}
					}
					if err != nil {
						receipt.Error = err.Error()
					}
					result.queries = append(result.queries, receipt)
					if err != nil {
						result.err = err
						cancel(err)
						return
					}
				}
			}
		}()
	}
	close(start)
	ordered := make([]streamResult, r.Clients)
	for range r.Clients {
		res := <-results
		ordered[res.stream] = res
		retErr = errors.Join(retErr, res.err)
	}
	waveNS = clock.elapsed()
	for _, res := range ordered {
		out = append(out, res.queries...)
	}
	if evidence != nil {
		evidence.after = runtimeSnapshot()
	}
	retErr = errors.Join(retErr, control.barrier("done"))
	if r.Profile != nil && (r.Profile.Kind == "alloc" || r.Profile.Kind == "wait") {
		retErr = errors.Join(retErr, goProfileSnapshot(r.OutputRoot, "after", r.Profile.Kind))
	}
	return out, waveNS, retErr
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30952** (2026-10-23): **docs: correct purge_log example in builtin comment**
  *Symptoms*: Fixes #30903  The comment now uses the registered `purge_log` name and a supported single-table argument. No runtime behavior changes. 
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 
  > Closing this source-code PR to move the documentation work to matrixorigin/matrixone-doc, as requested. The MatrixOne code comment itself remains unchanged.

- **Issue #30946** (2026-10-23): **docs(skills): add flexible defect-hunt workflow**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [x] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #25267 as a follow-up to the agent-skills workflow.  ## What this PR does / why we need it:  Add a flexible `defect-hunt` skill for behavioral defect exploration. A focused source trace or SQL probe is sufficient; confirmation, reference comparisons, ledgers, and issue filing are selected only when the task requires them.  The MatrixOne adapter provides source entry points and an optional SQL helper that preserves complete stdout/stderr, exit status, and partial timeout evidence. Explicit TCP and isolated client configuration prevent connection defaults from redirecting probes, and empty passwords do not trigger interactive prompts. Findings distinguish impact from localization confidence and require a verified good/bad version boundary for regression claims. Lifecycle analysis remains available through the existing `unhappy-path-audit` skill.  Validation: both skill validators passed; eight helper behavior checks passed, covering raw-output fidelity, row boundaries, nonzero exits, timeout cleanup, database selection, launch failure, and repeated case names. A real MySQL 9.5.0 client verified empty-password handling and TCP port selection. Local references and `git diff --check` passed. The change comprises four skill Markdown files, including the embedded helper example. 

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

### Incident Patch 1: `68fe0510` (2026-10-23)
**Commit Message**: fix(frontend): persist default role selection (#30709)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #30677

## What this PR does / why we need it:

Implement the missing `SET DEFAULT ROLE` execution path and persist the
selected role in `mo_user.default_role`.

- A user may select only a role directly granted to themselves. Changing
another user's default role retains the existing `ALTER USER` authority.
- `NONE` stores `public`. `ALL` and multi-role lists are explicitly
rejected because MatrixOne stores one default role per user.
- Validate the role, user/host identity, direct grants and every
requested target before writes in one short-lived transaction. Existing
sessions retain their active role; login-time validation and fallback
remain unchanged.
- Extend the existing frontend tests and Issue SQL fixture to cover
parser/dispatch, authorization, transaction failure/rollback, and
multi-target atomicity. The code change is limited to the seven
frontend/SQL files in this PR; it does not modify production lockservice
behavior.

### V

**File**: `pkg/frontend/authenticate.go` (modified, +12/-1)
```diff
@@ -6499,6 +6499,8 @@ func determinePrivilegeSetOfStatement(stmt tree.Statement) *privilege {
 	case *tree.AlterUser:
 		typs = append(typs, PrivilegeTypeAlterUser, PrivilegeTypeAccountAll /*, PrivilegeTypeAccountOwnership, PrivilegeTypeUserOwnership*/)
 		canExecInPasswordExpired = true
+	case *tree.SetDefaultRole:
+		typs = append(typs, PrivilegeTypeAlterUser, PrivilegeTypeAccountAll)
 	case *tree.CreateRole:
 		typs = append(typs, PrivilegeTypeCreateRole, PrivilegeTypeAccountAll /*, PrivilegeTypeAccountOwnership*/)
 	case *tree.DropRole:
@@ -6854,7 +6856,7 @@ func determinePrivilegeSetOfStatement(stmt tree.Statement) *privilege {
 		objType = objectTypeNone
 		kind = privilegeKindNone
 		canExecInRestricted = true
-	case *tree.SetDefaultRole, *tree.SetRole, *tree.SetPassword:
+	case *tree.SetRole, *tree.SetPassword:
 		objType = objectTypeNone
 		kind = privilegeKindNone
 	case *tree.PrepareStmt, *tree.PrepareString, *tree.PrepareVar, *tree.Deallocate, *tree.Reset:
@@ -8858,6 +8860,15 @@ func authenticateUserCanExecuteStatementWithObjectTypeAccountAndDatabase(ctx con
 	if priv.objectType() != objectTypeAccount && priv.objectType() != objectTypeDatabase { // do nothing
 		return true, stats, nil
 	}
+	if st, isSetDefaultRole := stmt.(*tree.SetDefaultRole); isSetDefaultRole && ses.GetFromRealUser() {
+		self, selfErr := setDefaultRoleTargetsAreCurrentUser(ctx, ses, st)
+		if selfErr != nil {
+			return false, stats, selfErr
+		}
+		if self {
+			return true, stats, nil
+		}
+	}
 	if !checkProtectedDatabaseWriteByPrivilege(ctx, ses, priv) {
 		return false, stats, nil
 	}
```

**File**: `pkg/frontend/mysql_cmd_executor.go` (modified, +4/-0)
```diff
@@ -3769,6 +3769,10 @@ func handleSwitchRole(ses FeSession, execCtx *ExecCtx, sr *tree.SetRole) error {
 	return doSwitchRole(execCtx.reqCtx, ses.(*Session), sr)
 }
 
+func handleSetDefaultRole(ses FeSession, execCtx *ExecCtx, sdr *tree.SetDefaultRole) error {
+	return doSetDefaultRole(execCtx.reqCtx, ses.(*Session), sdr)
+}
+
 func doKill(ses *Session, execCtx *ExecCtx, k *tree.Kill) error {
 	killConnection := !k.Option.Exist || k.Option.Typ == tree.KillTypeConnection
 	return killSession(execCtx.reqCtx, ses, k.ConnectionId, killConnection, k.StmtOption.StatementId)
```

**File**: `pkg/frontend/self_handle.go` (modified, +5/-0)
```diff
@@ -50,6 +50,11 @@ func execInFrontend(ses *Session, execCtx *ExecCtx) (stats statistic.StatsArray,
 		if err != nil {
 			return
 		}
+	case *tree.SetDefaultRole:
+		err = handleSetDefaultRole(ses, execCtx, st)
+		if err != nil {
+			return
+		}
 	case *tree.Use:
 		ses.EnterFPrint(FPUse)
 		defer ses.ExitFPrint(FPUse)
```

**File**: `pkg/frontend/set_default_role.go` (added, +371/-0)
```diff
@@ -0,0 +1,371 @@
+// Copyright 2026 Matrix Origin
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
+package frontend
+
+import (
+	"context"
+	"fmt"
+	"sort"
+	"strings"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
+)
+
+type setDefaultRoleUser struct {
+	userName string
+	userHost string
+	userID   int64
+
+	hasSelectedRole bool
+	isAdmin         bool
+}
+
+type setDefaultRoleUserSpec struct {
+	username string
+	hostname string
+}
+
+// setDefaultRoleTargetsAreCurrentUser recognizes only the narrow self-service
+// case. The writer still resolves the names to user IDs and confirms that the
+// authenticated user ID is the target before persisting anything.
+func setDefaultRoleTargetsAreCurrentUser(
+	ctx context.Context,
+	ses *Session,
+	stmt *tree.SetDefaultRole,
+) (bool, error) {
+	if ses == nil || stmt == nil || len(stmt.Users) == 0 || ses.GetTenantInfo() == nil {
+		return false, nil
+	}
+
+	currentUser, err := normalizeName(ctx, ses.GetTenantInfo().GetUser())
+	if err != nil {
+		return false, err
+	}
+	for _, user := range stmt.Users {
+		if user == nil || user.AuthOption != nil {
+			return false, nil
+		}
+		username, err := normalizeName(ctx, user.Username)
+		if err != nil {
+			return false, err
+		}
+		if !strings.EqualFold(username, currentUser) {
+			return false, nil
+		}
+	}
+	return true, nil
+}
+
+func setDefaultRoleName(ctx context.Context, stmt *tree.SetDefaultRole) (string, error) {
+	if stmt == nil {
+		return "", moerr.NewInternalError(ctx, "SET DEFAULT ROLE statement is missing")
+	}
+
+	switch stmt.Type {
+	case tree.SET_DEFAULT_ROLE_TYPE_NONE:
+		if len(stmt.Roles) != 0 {
+			return "", moerr.NewInternalError(ctx, "SET DEFAULT ROLE NONE cannot include a role list")
+		}
+		return publicRoleName, nil
+	case tree.SET_DEFAULT_ROLE_TYPE_ALL:
+		return "", moerr.NewInternalError(ctx, "SET DEFAULT ROLE ALL is not supported; MatrixOne stores one default role per user")
+	case tree.SET_DEFAULT_ROLE_TYPE_NORMAL:
+		if len(stmt.Roles) != 1 || stmt.Roles[0] == nil {
+			return "", moerr.NewInternalError(ctx, "SET DEFAULT ROLE supports exactly one role")
+		}
+		return normalizeName(ctx, stmt.Roles[0].UserName)
+	default:
+		return "", moerr.NewInternalError(ctx, "invalid SET DEFAULT ROLE type")
+	}
+}
+
+func normalizeSetDefaultRoleUsers(ctx context.Context, users []*tree.User) ([]setDefaultRoleUserSpec, error) {
+	if len(users) == 0 {
+		return nil, moerr.NewInternalError(ctx, "SET DEFAULT ROLE requires at least one user")
+	}
+
+	specs := make([]setDefaultRoleUserSpec, 0, len(users))
+	for _, user := range users {
+		if user == nil {
+			return nil, moerr.NewInternalError(ctx, "SET DEFAULT ROLE contains an empty user")
+		}
+		if user.AuthOption != nil {
+			return nil, moerr.NewInternalError(ctx, "SET DEFAULT ROLE does not support user authentication options")
+		}
+		username, err := normalizeName(ctx, user.Username)
+		if err != nil {
+			return nil, err
+		}
+		hostname := strings.TrimSpace(user.Hostname)
+		if hostname == "" {
+			return nil, moerr.NewInternalError(ctx, "SET DEFAULT ROLE requires a user host")
+		}
+		specs = append(specs, setDefaultRoleUserSpec{
+			username: username,
+			hostname: hostname,
+		})
+	}
+	return specs, nil
+}
+
+func setDefaultRoleLookupNames(specs []setDefaultRoleUserSpec, currentUser string) []string {
+	seen := make(map[string]struct{}, len(specs)+1)
+	names := make([]string, 0, len(specs)+1)
+	add := func(name string) {
+		if _, ok := seen[name]; ok {
+			return
+		}
+		seen[name] = struct{}{}
+		names = append(names, name)
+	}
+	for _, spec := range specs {
+		add(spec.username)
+	}
+	add(currentUser)
+	sort.Slice(names, func(i, j int) bool {
+		lowerI, lowerJ := strings.ToLower(names[i]), strings.ToLower(names[j])
+		if lowerI != lowerJ {
+			return lowerI < lowerJ
+		}
+		return names[i] < names[j]
+	})
+	return names
+}
+
+func querySetDefaultRoleResult(ctx context.Context, bh BackgroundExec, sql string) (ExecResult, error) {
+	bh.ClearExecResultSet()
+	if err := bh.Exec(ctx, sql); err != nil {
+		return nil, err
+	}
+	results, err := getResultSet(ctx, bh)
+	if err != nil {
+		return nil, err
+	}
+	if len(results) == 0 {
+		return nil, nil
+	}
+	if len(results) != 1 || results[0] == nil {
+		return nil, moerr.NewInternalError(ctx, "SET DEFAULT ROLE catalog query returned an invalid result")
+	}
+	return results[0], nil
+}
+
+func setDefaultRoleUserLookupSQ
```

**File**: `pkg/frontend/set_default_role_test.go` (added, +573/-0)
```diff
@@ -0,0 +1,573 @@
+// Copyright 2026 Matrix Origin
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
+package frontend
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"sort"
+	"testing"
+
+	"github.com/golang/mock/gomock"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect/mysql"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
+	"github.com/stretchr/testify/require"
+)
+
+func TestSetDefaultRolePrivilegeAndSelfAuthorization(t *testing.T) {
+	stmt := &tree.SetDefaultRole{
+		Type:  tree.SET_DEFAULT_ROLE_TYPE_NORMAL,
+		Roles: []*tree.Role{{UserName: "writer"}},
+		Users: []*tree.User{{Username: "alice", Hostname: "%"}},
+	}
+	priv := determinePrivilegeSetOfStatement(stmt)
+	require.Equal(t, objectTypeAccount, priv.objectType())
+	require.Equal(t, privilegeKindGeneral, priv.kind)
+	require.False(t, priv.canExecInPasswordExpired)
+	require.Len(t, priv.entries, 2)
+
+	ctrl := gomock.NewController(t)
+	ses := newSes(priv, ctrl)
+	t.Cleanup(ses.Close)
+	ses.SetTenantInfo(&TenantInfo{
+		Tenant:        "acme",
+		User:          "alice",
+		DefaultRole:   "public",
+		TenantID:      17,
+		UserID:        7,
+		DefaultRoleID: 1,
+	})
+	ses.SetFromRealUser(true)
+	bh := &backgroundExecTest{}
+	bh.init()
+	created := stubSetDefaultRoleBackgroundExec(t, bh, nil)
+
+	self, err := setDefaultRoleTargetsAreCurrentUser(context.Background(), ses, stmt)
+	require.NoError(t, err)
+	require.True(t, self)
+
+	other := *stmt
+	other.Users = []*tree.User{{Username: "bob", Hostname: "%"}}
+	self, err = setDefaultRoleTargetsAreCurrentUser(context.Background(), ses, &other)
+	require.NoError(t, err)
+	require.False(t, self)
+
+	mixed := *stmt
+	mixed.Users = []*tree.User{{Username: "alice", Hostname: "%"}, {Username: "bob", Hostname: "%"}}
+	self, err = setDefaultRoleTargetsAreCurrentUser(context.Background(), ses, &mixed)
+	require.NoError(t, err)
+	require.False(t, self)
+
+	withAuth := *stmt
+	withAuth.Users = []*tree.User{{Username: "alice", Hostname: "%", AuthOption: &tree.AccountIdentified{}}}
+	self, err = setDefaultRoleTargetsAreCurrentUser(context.Background(), ses, &withAuth)
+	require.NoError(t, err)
+	require.False(t, self)
+
+	ok, _, err := authenticateUserCanExecuteStatementWithObjectTypeAccountAndDatabase(context.Background(), ses, stmt)
+	require.NoError(t, err)
+	require.True(t, ok)
+	for _, tc := range []struct {
+		name, currentUser, targetUser string
+	}{
+		{"invalid authenticated name", "bad:name", "alice"},
+		{"invalid target name", "alice", "bad:name"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			previousUser := ses.GetTenantInfo().User
+			ses.GetTenantInfo().User = tc.currentUser
+			t.Cleanup(func() { ses.GetTenantInfo().User = previousUser })
+			ok, _, err := authenticateUserCanExecuteStatementWithObjectTypeAccountAndDatabase(
+				context.Background(), ses, setDefaultRoleTestStatement("writer", tc.targetUser))
+			require.ErrorContains(t, err, "invalid")
+			require.False(t, ok)
+			require.Zero(t, *created, "invalid identities must not fall through to catalog authorization")
+		})
+	}
+}
+
+func TestSetDefaultRoleNoneThroughFrontendPreservesActiveRole(t *testing.T) {
+	ctx := context.Background()
+	ses := newSetDefaultRoleTestSession(t, "acme", "alice", 7)
+	ses.GetTenantInfo().SetDefaultRole("writer")
+	ses.GetTenantInfo().SetDefaultRoleID(9)
+	bh := &setDefaultRoleLifecycleExec{backgroundExecTest: newSetDefaultRoleTestBackgroundExec(publicRoleName, 1, []setDefaultRoleTestUser{
+		{id: 7, name: "alice", host: "localhost", grants: []int64{1}},
+	})}
+	var opts *BackgroundExecOption
+	stubSetDefaultRoleBackgroundExec(t, bh, &opts)
+	stmt, err := mysql.ParseOne(ctx, "set default role none to 'alice'@'localhost'", 1)
+	require.NoError(t, err)
+	defer stmt.Free()
+
+	_, err = execInFrontend(ses, &ExecCtx{reqCtx: ctx, stmt: stmt})
+	require.NoError(t, err)
+	require.Contains(t, bh.executedSQLs, "update mo_catalog.mo_user set default_role = 1 where user_id = 7;")
+	require.Equal(t, "commit;", bh.executedSQLs[len(bh.executedSQLs)-1])
+	require.NotContains(t, bh.executedSQLs, "rollback;")
+	require.Equal(t, "writer", ses.GetTenantInfo().GetDefaultRole())
+	require.Equal(t, uint32(9), ses.GetTenantInfo().GetDefaultRoleID())
+	require.NotNil(t, opts)
+	require.True(t, opts.forcePessimisticRC)
+	require.True(t, opts.cancelTxnCreateWithRequest)
+	require.Equal(t
```

**File**: `test/distributed/cases/zz_accesscontrol/issue_30677_set_default_role.result` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+drop database if exists issue_30677_db;
+drop user if exists issue_30677_user;
+drop user if exists issue_30677_actor;
+drop user if exists issue_30677_target;
+drop user if exists issue_30677_batch_a;
+drop user if exists issue_30677_batch_b;
+drop role if exists issue_30677_reader;
+drop role if exists issue_30677_ungranted;
+drop role if exists issue_30677_target_reader;
+drop role if exists issue_30677_batch_reader;
+create database issue_30677_db;
+create table issue_30677_db.protected(value int);
+insert into issue_30677_db.protected values (42);
+create role issue_30677_reader;
+create role issue_30677_ungranted;
+create role issue_30677_target_reader;
+create role issue_30677_batch_reader;
+grant connect on account * to issue_30677_reader;
+grant select on table issue_30677_db.protected to issue_30677_reader;
+grant connect on account * to issue_30677_target_reader;
+grant connect on account * to issue_30677_batch_reader;
+create user issue_30677_user identified by 'pw30677';
+create user issue_30677_actor identified by 'actor30677';
+create user issue_30677_target identified by 'target30677';
+create user issue_30677_batch_a identified by 'batch30677';
+create user issue_30677_batch_b identified by 'batch30677';
+grant issue_30677_reader to issue_30677_user;
+grant issue_30677_target_reader to issue_30677_target;
+grant issue_30677_batch_reader to issue_30677_batch_a;
+select current_role();
+➤ current_role()[12,65535,0]  𝄀
+public
+set default role issue_30677_reader to issue_30677_user;
+select current_role();
+➤ current_role()[12,65535,0]  𝄀
+public
+select * from issue_30677_db.protected;
+internal error: do not have privilege to execute the statement
+select current_role();
+➤ current_role()[12,65535,0]  𝄀
+issue_30677_reader
+select * from issue_30677_db.protected;
+➤ value[4,32,0]  𝄀
+42
+set default role none to issue_30677_user;
+select current_role();
+➤ current_role()[12,65535,0]  𝄀
+issue_30677_reader
+select * from issue_30677_db.protected;
+➤ value[4,32,0]  𝄀
+42
+set default role issue_30677_ungranted to issue_30677_user;
+internal error: the role issue_30677_ungranted has not be granted to the user issue_30677_user
+select current_role();
+➤ current_role()[12,65535,0]  𝄀
+public
+select * from issue_30677_db.protected;
+internal error: do not have privilege to execute the statement
+set default role issue_30677_target_reader to issue_30677_target;
+internal error: do not have privilege to execute the statement
+select current_role();
+➤ current_role()[12,65535,0]  𝄀
+public
+select u.user_name, r.role_name from mo_catalog.mo_user u join mo_catalog.mo_role r on u.default_role = r.role_id where u.user_name in ('issue_30677_user', 'issue_30677_target') order by u.user_name;
+➤ user_name[12,300,0]  ¦  role_name[12,300,0]  𝄀
+issue_30677_target  ¦  public  𝄀
+issue_30677_user  ¦  public
+set default role issue_30677_target_reader to issue_30677_target;
+select u.user_name, r.role_name from mo_catalog.mo_user u join mo_catalog.mo_role r on u.default_role = r.role_id where u.user_name = 'issue_30677_target';
+➤ user_name[12,300,0]  ¦  role_name[12,300,0]  𝄀
+issue_30677_target  ¦  issue_30677_target_reader
+set default role all to issue_30677_user;
+internal error: SET DEFAULT ROLE ALL is not supported; MatrixOne stores one default role per user
+set default role issue_30677_reader, issue_30677_batch_reader to issue_30677_user;
+internal error: SET DEFAULT ROLE supports exactly one role
+set default role issue_30677_batch_reader to issue_30677_batch_a, issue_30677_batch_b;
+internal error: the role issue_30677_batch_reader has not be granted to the user issue_30677_batch_b
+select u.user_name, r.role_name from mo_catalog.mo_user u join mo_catalog.mo_role r on u.default_role = r.role_id where u.user_name in ('issue_30677_batch_a', 'issue_30677_batch_b') order by u.user_name;
+➤ user_name[12,300,0]  ¦  role_name[12,300,0]  𝄀
+issue_30677_batch_a  ¦  public  𝄀
+issue_30677_batch_b  ¦  public
+drop user issue_30677_user;
+drop user issue_30677_actor;
+drop user issue_30677_target;
+drop user issue_30677_batch_a;
+drop user issue_30677_batch_b;
+drop role issue_30677_reader;
+drop role issue_30677_ungranted;
+drop role issue_30677_target_reader;
+drop role issue_30677_batch_reader;
+drop database issue_30677_db;
```

**File**: `test/distributed/cases/zz_accesscontrol/issue_30677_set_default_role.sql` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+drop database if exists issue_30677_db;
+drop user if exists issue_30677_user;
+drop user if exists issue_30677_actor;
+drop user if exists issue_30677_target;
+drop user if exists issue_30677_batch_a;
+drop user if exists issue_30677_batch_b;
+drop role if exists issue_30677_reader;
+drop role if exists issue_30677_ungranted;
+drop role if exists issue_30677_target_reader;
+drop role if exists issue_30677_batch_reader;
+
+create database issue_30677_db;
+create table issue_30677_db.protected(value int);
+insert into issue_30677_db.protected values (42);
+create role issue_30677_reader;
+create role issue_30677_ungranted;
+create role issue_30677_target_reader;
+create role issue_30677_batch_reader;
+grant connect on account * to issue_30677_reader;
+grant select on table issue_30677_db.protected to issue_30677_reader;
+grant connect on account * to issue_30677_target_reader;
+grant connect on account * to issue_30677_batch_reader;
+create user issue_30677_user identified by 'pw30677';
+create user issue_30677_actor identified by 'actor30677';
+create user issue_30677_target identified by 'target30677';
+create user issue_30677_batch_a identified by 'batch30677';
+create user issue_30677_batch_b identified by 'batch30677';
+grant issue_30677_reader to issue_30677_user;
+grant issue_30677_target_reader to issue_30677_target;
+grant issue_30677_batch_reader to issue_30677_batch_a;
+
+-- A user without ALTER USER can select their own directly granted role.
+-- The currently open session remains public; a fresh implicit login gets reader.
+-- @session:id=91&user=sys:issue_30677_user&password=pw30677
+select current_role();
+set default role issue_30677_reader to issue_30677_user;
+select current_role();
+select * from issue_30677_db.protected;
+-- @session
+
+-- NONE stores public for future logins without changing the active role here.
+-- @session:id=92&user=sys:issue_30677_user&password=pw30677
+select current_role();
+select * from issue_30677_db.protected;
+set default role none to issue_30677_user;
+select current_role();
+select * from issue_30677_db.protected;
+set default role issue_30677_ungranted to issue_30677_user;
+-- @session
+
+-- The next implicit login uses public again, and unprivileged other-user changes fail.
+-- @session:id=93&user=sys:issue_30677_user&password=pw30677
+select current_role();
+select * from issue_30677_db.protected;
+-- @session
+-- @session:id=94&user=sys:issue_30677_actor&password=actor30677
+set default role issue_30677_target_reader to issue_30677_target;
+select current_role();
+-- @session
+
+select u.user_name, r.role_name from mo_catalog.mo_user u join mo_catalog.mo_role r on u.default_role = r.role_id where u.user_name in ('issue_30677_user', 'issue_30677_target') order by u.user_name;
+
+-- Root can set another user's directly granted role after the unprivileged denial.
+set default role issue_30677_target_reader to issue_30677_target;
+select u.user_name, r.role_name from mo_catalog.mo_user u join mo_catalog.mo_role r on u.default_role = r.role_id where u.user_name = 'issue_30677_target';
+
+-- ALL and multiple defaults are explicitly unsupported. Multi-target writes validate first.
+set default role all to issue_30677_user;
+set default role issue_30677_reader, issue_30677_batch_reader to issue_30677_user;
+set default role issue_30677_batch_reader to issue_30677_batch_a, issue_30677_batch_b;
+select u.user_name, r.role_name from mo_catalog.mo_user u join mo_catalog.mo_role r on u.default_role = r.role_id where u.user_name in ('issue_30677_batch_a', 'issue_30677_batch_b') order by u.user_name;
+
+drop user issue_30677_user;
+drop user issue_30677_actor;
+drop user issue_30677_target;
+drop user issue_30677_batch_a;
+drop user issue_30677_batch_b;
+drop role issue_30677_reader;
+drop role issue_30677_ungranted;
+drop role issue_30677_target_reader;
+drop role issue_30677_batch_reader;
+drop database issue_30677_db;
```

---

### Incident Patch 2: `4ffaa4ce` (2026-10-22)
**Commit Message**: fix: support JSON values in MIN and MAX (#28950)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #28869. This branch includes the JSON
string-consumer/opaque-rendering integration tracked in #28938; that
separate open PR is unchanged, and existing merge-order coordination
still applies.

## What this PR does / why we need it:

### Pinned conflict-integration increment

Published `529abda180ac0312649bbf04d52fe6a1a20f7b88`, tree
`ed070db4dae0746723279ed0de346420f49ffb5a`, normal merge of exact main
`b74ceced223bcf9ae0007445a3dd0f9ddb0cbc48`. The six manual resolutions
retain main's JSON protocol/fixture cleanup coverage and this PR's
warning/lazy-ELT regressions, including all 44 planner mode/scenario
cells. No manual production-code change was added for this conflict
repair.

Local validation on this exact content: six owning packages with vet
passed (37,901 test-node runs; 37,899 passes and two explicitly recorded
planner skips). Configured incremental lint passed after correcting its
CGo include/search environment; the initial preproce

**File**: `pkg/sql/colexec/aggexec/minmax2.go` (modified, +118/-1)
```diff
@@ -20,6 +20,7 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/bytejson"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 )
@@ -36,6 +37,12 @@ type minMaxExecBytes struct {
 	comp     func([]byte, []byte) int
 	hasExtra bool
 	extra    []byte
+	// JSON extras are validated once at the SetExtraInformation boundary and
+	// retained independently of the caller's buffer. When an allocation
+	// account is installed after that boundary, the owned copy is moved into
+	// the account's argument arena before any state is published.
+	isJSONExtra    bool
+	extraAccounted bool
 }
 
 // Merge copies or compares the source state without transferring ownership or
@@ -550,6 +557,43 @@ func (exec *minMaxExecBytes) BatchMerge(next AggFuncExec, offset int, groups []u
 }
 
 func (exec *minMaxExecBytes) SetExtraInformation(partialResult any, _ int) error {
+	if exec.isJSONExtra {
+		raw, ok := partialResult.([]byte)
+		if !ok {
+			return moerr.NewInternalErrorNoCtxf("invalid extra information type %T", partialResult)
+		}
+		if len(raw) == 0 {
+			return moerr.NewInvalidInputNoCtx("invalid JSON extra information")
+		}
+		value := bytejson.ByteJson{Type: bytejson.TpCode(raw[0]), Data: raw[1:]}
+		if !bytejson.IsValidByteJson(value) {
+			return moerr.NewInvalidInputNoCtx("invalid JSON extra information")
+		}
+
+		// Allocate before releasing a previously retained extra so a capacity
+		// failure leaves the old optimizer state unchanged.
+		var retained []byte
+		accounted := false
+		var err error
+		if exec.allocation != nil {
+			retained, err = exec.allocation.allocArgumentArena(exec.mp, len(raw))
+			accounted = err == nil
+		} else {
+			retained = slices.Clone(raw)
+		}
+		if err != nil {
+			return err
+		}
+		if accounted {
+			copy(retained, raw)
+		}
+		exec.releaseJSONExtra()
+		exec.extra = retained
+		exec.extraAccounted = accounted
+		exec.hasExtra = true
+		return nil
+	}
+
 	var ok bool
 	exec.extra, ok = partialResult.([]byte)
 	if !ok {
@@ -559,6 +603,55 @@ func (exec *minMaxExecBytes) SetExtraInformation(partialResult any, _ int) error
 	return nil
 }
 
+func (exec *minMaxExecBytes) SetAllocationAccount(allocation *AllocationAccount) error {
+	if err := exec.aggExec.SetAllocationAccount(allocation); err != nil {
+		return err
+	}
+	if !exec.isJSONExtra || !exec.hasExtra || exec.extraAccounted {
+		return nil
+	}
+	retained, err := allocation.allocArgumentArena(exec.mp, len(exec.extra))
+	if err != nil {
+		// SetAllocationAccount has no externally visible state yet; roll the
+		// base pointer back so callers can safely retry with another account.
+		_ = exec.aggExec.ClearAllocationAccount(allocation)
+		return err
+	}
+	copy(retained, exec.extra)
+	exec.extra = retained
+	exec.extraAccounted = true
+	return nil
+}
+
+func (exec *minMaxExecBytes) ClearAllocationAccount(allocation *AllocationAccount) error {
+	if err := exec.aggExec.ClearAllocationAccount(allocation); err != nil {
+		return err
+	}
+	if exec.isJSONExtra && exec.extraAccounted {
+		retained := slices.Clone(exec.extra)
+		exec.mp.Free(exec.extra)
+		exec.extra = retained
+		exec.extraAccounted = false
+	}
+	return nil
+}
+
+func (exec *minMaxExecBytes) releaseJSONExtra() {
+	if !exec.isJSONExtra {
+		return
+	}
+	if exec.extraAccounted && exec.extra != nil {
+		exec.mp.Free(exec.extra)
+	}
+	exec.extra = nil
+	exec.extraAccounted = false
+}
+
+func (exec *minMaxExecBytes) Free() {
+	exec.releaseJSONExtra()
+	exec.aggExec.Free()
+}
+
 func (exec *minMaxExecBytes) Flush() ([]*vector.Vector, error) {
 	// transfer vector to result
 	vecs := make([]*vector.Vector, len(exec.state))
@@ -693,8 +786,10 @@ func makeMinMaxExecWithLegacyText(
 			return newUTF8mb4BinMinMaxExec(mp, aggID, isMin, param)
 		}
 		return newTextMinMaxExec(mp, aggID, isMin, param)
-	case types.T_blob, types.T_binary, types.T_varbinary, types.T_json, types.T_datalink:
+	case types.T_blob, types.T_binary, types.T_varbinary, types.T_datalink:
 		return newStrMinMaxExec(mp, aggID, isMin, param)
+	case types.T_json:
+		return newJSONMinMaxExec(mp, aggID, isMin, param)
 	case types.T_array_float32, types.T_array_float64:
 		return newArrayMinMaxExec(mp, aggID, isMin, param)
 	}
@@ -797,6 +892,28 @@ func newStrMinMaxExec(mp *mpool.MPool, aggID int64, isMin bool, param types.Type
 	return &exec
 }
 
+func newJSONMinMaxExec(mp *mpool.MPool, aggID int64, isMin bool, param types.Type) AggFuncExec {
+	var exec minMaxExecBytes
+	exec.mp = mp
+	exec.isJSONExtra = true
+	if isMin {
+		exec.comp = compareJSONBytes
+	} else {
+		exec.comp = func(x, y []byte) int { return -compareJSONBytes(x, y) }
+	}
+	setupAggInfo(&exec.aggInfo, aggID, param)
+	return &exec
+}
+
+// compareJSONBytes is used only after vector/extra admission has established
+// complete ByteJSON values. Keeping the hot comparison 
```

**File**: `pkg/sql/colexec/aggexec/minmax2_test.go` (modified, +355/-0)
```diff
@@ -20,11 +20,339 @@ import (
 	"testing"
 
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/bytejson"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/stretchr/testify/require"
 )
 
+func minMaxJSONBytes(t *testing.T, value any) []byte {
+	t.Helper()
+	bj, err := bytejson.CreateByteJSONWithCheck(value)
+	require.NoError(t, err)
+	encoded, err := bj.Marshal()
+	require.NoError(t, err)
+	return encoded
+}
+
+func TestMinMaxJSONUsesTypedComparisonAcrossBatchesAndNulls(t *testing.T) {
+	tests := []struct {
+		name   string
+		values []any
+		min    any
+		max    any
+	}{
+		{name: "numeric little endian", values: []any{int64(256), int64(1)}, min: int64(1), max: int64(256)},
+		{name: "numeric encodings", values: []any{float64(1), int64(256)}, min: float64(1), max: int64(256)},
+		{name: "zero before boolean", values: []any{false, int64(0)}, min: int64(0), max: false},
+		{name: "array element then length", values: []any{[]any{int64(0), int64(0)}, []any{int64(0)}}, min: []any{int64(0)}, max: []any{int64(0), int64(0)}},
+		{name: "json null before number", values: []any{int64(0), nil}, min: nil, max: int64(0)},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			for _, aggID := range []int64{AggIdOfMin, AggIdOfMax} {
+				mp := mpool.MustNewZero()
+				input := vector.NewVec(types.T_json.ToType())
+				first := minMaxJSONBytes(t, tc.values[0])
+				second := minMaxJSONBytes(t, tc.values[1])
+				require.NoError(t, vector.AppendBytes(input, first, false, mp))
+				// A SQL NULL is not a JSON value and must not participate in the
+				// comparison. It is deliberately placed between two batches.
+				require.NoError(t, vector.AppendBytes(input, nil, true, mp))
+				agg := makeMinMaxExec(mp, aggID, aggID == AggIdOfMin, types.T_json.ToType())
+				require.NoError(t, agg.GroupGrow(1))
+				require.NoError(t, agg.BatchFill(0, []uint64{1, 1}, []*vector.Vector{input}))
+
+				secondInput := vector.NewVec(types.T_json.ToType())
+				require.NoError(t, vector.AppendBytes(secondInput, second, false, mp))
+				require.NoError(t, vector.AppendBytes(secondInput, minMaxJSONBytes(t, tc.values[0]), false, mp))
+				require.NoError(t, agg.BatchFill(0, []uint64{1, GroupNotMatched}, []*vector.Vector{secondInput}))
+
+				results, err := agg.Flush()
+				require.NoError(t, err)
+				require.Len(t, results, 1)
+				wantValue := tc.min
+				if aggID == AggIdOfMax {
+					wantValue = tc.max
+				}
+				want := minMaxJSONBytes(t, wantValue)
+				require.Equal(t, want, results[0].GetBytesAt(0))
+				results[0].Free(mp)
+				agg.Free()
+				input.Free(mp)
+				secondInput.Free(mp)
+				require.Zero(t, mp.CurrNB())
+			}
+		})
+	}
+}
+
+func TestMinMaxJSONMergeAndExtraAdmission(t *testing.T) {
+	for _, aggID := range []int64{AggIdOfMin, AggIdOfMax} {
+		t.Run(fmt.Sprint(aggID), func(t *testing.T) {
+			mp := mpool.MustNewZero()
+			typ := types.T_json.ToType()
+			leftInput := vector.NewVec(typ)
+			rightInput := vector.NewVec(typ)
+			require.NoError(t, vector.AppendBytes(leftInput, minMaxJSONBytes(t, int64(256)), false, mp))
+			require.NoError(t, vector.AppendBytes(rightInput, minMaxJSONBytes(t, int64(1)), false, mp))
+			left := makeMinMaxExec(mp, aggID, aggID == AggIdOfMin, typ)
+			right := makeMinMaxExec(mp, aggID, aggID == AggIdOfMin, typ)
+			require.NoError(t, left.GroupGrow(1))
+			require.NoError(t, right.GroupGrow(1))
+			require.NoError(t, left.BulkFill(0, []*vector.Vector{leftInput}))
+			require.NoError(t, right.BulkFill(0, []*vector.Vector{rightInput}))
+			require.NoError(t, left.Merge(right, 0, 0))
+
+			leftResults, err := left.Flush()
+			require.NoError(t, err)
+			rightResults, err := right.Flush()
+			require.NoError(t, err)
+			wantLeft := minMaxJSONBytes(t, int64(1))
+			wantRight := minMaxJSONBytes(t, int64(1))
+			if aggID == AggIdOfMax {
+				wantLeft = minMaxJSONBytes(t, int64(256))
+				wantRight = minMaxJSONBytes(t, int64(1))
+			}
+			require.Equal(t, wantLeft, leftResults[0].GetBytesAt(0))
+			require.Equal(t, wantRight, rightResults[0].GetBytesAt(0))
+			leftResults[0].Free(mp)
+			rightResults[0].Free(mp)
+			left.Free()
+			right.Free()
+			leftInput.Free(mp)
+			rightInput.Free(mp)
+
+			for _, invalid := range [][]byte{nil, {}, {0xff}, {byte(bytejson.TpCodeArray), 1}} {
+				extraExec := makeMinMaxExec(mp, aggID, aggID == AggIdOfMin, typ)
+				require.Error(t, extraExec.SetExtraInformation(invalid, 0))
+				extraExec.Free()
+			}
+			for _, tc := range []struct {
+				name   string
+				mutate func([]byte)
+			}{
+				{name: "valid different payload", mutate: func(raw []byte) {
+					copy(raw, minMaxJSONBytes(t, int64(256)))
+				}},
+				{name: "invalid payload", mutate: func(raw []byte) {
+					raw[0] = 0xff
+				}},
+			} {
+				t.Run(tc.name, func(t *testing.T) {
+					extra := minMaxJSONBytes(t, int64(1))
+					before := bytes.Clone(e
```

**File**: `pkg/sql/colexec/group/group_test.go` (modified, +127/-0)
```diff
@@ -32,6 +32,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/bytejson"
 	"github.com/matrixorigin/matrixone/pkg/container/hashtable"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
@@ -5033,3 +5034,129 @@ func TestGroupConcatSourceRowProtocolGates(t *testing.T) {
 		})
 	}
 }
+
+func TestJSONMinMaxGroupAndMergeGroupPhysicalSpillReload(t *testing.T) {
+	proc := testutil.NewProcess(t)
+	aggs := []aggexec.AggFuncExecExpression{
+		aggexec.MakeAggFunctionExpression(aggexec.AggIdOfMin, false, []*plan.Expr{colExpr(1, types.T_json)}, nil),
+		aggexec.MakeAggFunctionExpression(aggexec.AggIdOfMax, false, []*plan.Expr{colExpr(1, types.T_json)}, nil),
+	}
+	encode := func(value int64) []byte {
+		bj, err := bytejson.CreateByteJSONWithCheck(value)
+		require.NoError(t, err)
+		raw, err := bj.Marshal()
+		require.NoError(t, err)
+		return raw
+	}
+	var partials []*batch.Batch
+	t.Cleanup(func() {
+		for _, partial := range partials {
+			partial.Clean(proc.Mp())
+		}
+		proc.Free()
+		require.Zero(t, proc.Mp().CurrNB())
+	})
+	for _, value := range []int64{1, 256} {
+		input := batch.NewWithSize(2)
+		input.Vecs[0] = vector.NewVec(types.T_int32.ToType())
+		input.Vecs[1] = vector.NewVec(types.T_json.ToType())
+		for key := int32(0); key < 64; key++ {
+			require.NoError(t, vector.AppendFixed(input.Vecs[0], key, false, proc.Mp()))
+			require.NoError(t, vector.AppendBytes(input.Vecs[1], encode(value), false, proc.Mp()))
+		}
+		input.SetRowCount(64)
+		child := colexec.NewMockOperator().WithBatchs([]*batch.Batch{input})
+		g := newGroupOp(proc, []*plan.Expr{colExpr(0, types.T_int32)}, aggs)
+		g.NeedEval = false
+		g.SpillMem = 2
+		g.AppendChild(child)
+		require.NoError(t, g.Prepare(proc))
+		for {
+			result, err := vm.Exec(g, proc)
+			require.NoError(t, err)
+			if result.Status == vm.ExecStop || result.Batch == nil {
+				break
+			}
+			partials = append(partials, cloneBatch(t, proc, result.Batch))
+		}
+		// Partial groups emit encoded states instead of writing finalized spill files.
+		g.Free(proc, false, nil)
+		child.Free(proc, false, nil)
+	}
+	child := colexec.NewMockOperator().WithBatchs(partials)
+	mg := newMergeGroupOp(aggs)
+	mg.SpillMem = 2
+	mg.AppendChild(child)
+	t.Cleanup(func() { mg.Free(proc, false, nil) })
+	require.NoError(t, mg.Prepare(proc))
+	seen := make(map[int32]bool)
+	for {
+		result, err := vm.Exec(mg, proc)
+		require.NoError(t, err)
+		if result.Status == vm.ExecStop || result.Batch == nil {
+			break
+		}
+		for row := 0; row < result.Batch.RowCount(); row++ {
+			key := vector.MustFixedColNoTypeCheck[int32](result.Batch.Vecs[0])[row]
+			require.False(t, seen[key])
+			seen[key] = true
+			require.Equal(t, encode(1), result.Batch.Vecs[1].GetBytesAt(row))
+			require.Equal(t, encode(256), result.Batch.Vecs[2].GetBytesAt(row))
+		}
+	}
+	require.Len(t, seen, 64)
+	require.Positive(t, mg.OpAnalyzer.GetOpStats().SpillRows, "mergegroup must physically spill")
+}
+
+func TestJSONMinMaxFinalGroupPhysicalSpillReload(t *testing.T) {
+	proc := testutil.NewProcess(t)
+	inputs := make([]*batch.Batch, 0, 2)
+	for _, value := range []int64{1, 256} {
+		input := batch.NewWithSize(2)
+		input.Vecs[0] = vector.NewVec(types.T_int32.ToType())
+		input.Vecs[1] = vector.NewVec(types.T_json.ToType())
+		bj, err := bytejson.CreateByteJSONWithCheck(value)
+		require.NoError(t, err)
+		raw, err := bj.Marshal()
+		require.NoError(t, err)
+		for key := int32(0); key < 64; key++ {
+			require.NoError(t, vector.AppendFixed(input.Vecs[0], key, false, proc.Mp()))
+			require.NoError(t, vector.AppendBytes(input.Vecs[1], raw, false, proc.Mp()))
+		}
+		input.SetRowCount(64)
+		inputs = append(inputs, input)
+	}
+	aggs := []aggexec.AggFuncExecExpression{aggexec.MakeAggFunctionExpression(aggexec.AggIdOfMin, false, []*plan.Expr{colExpr(1, types.T_json)}, nil), aggexec.MakeAggFunctionExpression(aggexec.AggIdOfMax, false, []*plan.Expr{colExpr(1, types.T_json)}, nil)}
+	child := colexec.NewMockOperator().WithBatchs(inputs)
+	g := newGroupOp(proc, []*plan.Expr{colExpr(0, types.T_int32)}, aggs)
+	g.SpillMem = 2
+	g.AppendChild(child)
+	t.Cleanup(func() {
+		g.Free(proc, false, nil)
+		child.Free(proc, false, nil)
+		proc.Free()
+		require.Zero(t, proc.Mp().CurrNB())
+	})
+	require.NoError(t, g.Prepare(proc))
+	seen := make(map[int32]bool)
+	for {
+		result, err := vm.Exec(g, proc)
+		require.NoError(t, err)
+		if result.Status == vm.ExecStop || result.Batch == nil {
+			break
+		}
+		for row := 0; row < result.Batch.RowCount(); row++ {
+			key := vector.MustFixedColNoTypeCheck[int32](result.Batch.Vecs[0])[row]
+			require.False(t, seen[key])
+			seen[key] = true
+			minJSON, err := types.DecodeJson(result.Batch.Vecs[1].GetBytesAt(row)).MarshalJSON()
+			require.
```

**File**: `pkg/sql/compile/remoterunClient_test.go` (modified, +37/-18)
```diff
@@ -434,24 +434,43 @@ func TestMessageSenderOnClientNegotiatedStreamTeardown(t *testing.T) {
 	})
 
 	t.Run("FIN ACK timeout poisons backend", func(t *testing.T) {
-		ctrl := gomock.NewController(t)
-		stream := mock_morpc.NewMockStream(ctrl)
-		stream.EXPECT().ID().Return(uint64(10))
-		stream.EXPECT().Send(gomock.Any(), gomock.Any()).Return(nil)
-		stream.EXPECT().Close(true).Return(nil)
-		oldTimeout := pipelineStreamFinishClientTimeout
-		pipelineStreamFinishClientTimeout = 10 * time.Millisecond
-		t.Cleanup(func() { pipelineStreamFinishClientTimeout = oldTimeout })
-		sender := &messageSenderOnClient{
-			ctx:           context.Background(),
-			streamSender:  stream,
-			receiveCh:     make(chan morpc.Message),
-			safeToClose:   true,
-			reuseEligible: true,
-		}
-		cleanupCtx, cancel := newRemoteCleanupContext(nil)
-		defer cancel()
-		sender.close(cleanupCtx)
+		synctest.Test(t, func(t *testing.T) {
+			ctrl := gomock.NewController(t)
+			stream := mock_morpc.NewMockStream(ctrl)
+			cleanupCtx, cancel := newRemoteCleanupContext(nil)
+			defer cancel()
+			started := time.Now()
+			gomock.InOrder(
+				stream.EXPECT().ID().Return(uint64(10)),
+				stream.EXPECT().Send(gomock.Any(), gomock.Any()).DoAndReturn(
+					func(ctx context.Context, request morpc.Message) error {
+						require.Equal(t, cleanupCtx, ctx)
+						require.NoError(t, ctx.Err(), "FIN must be sent before the cleanup deadline")
+						message := request.(*pipeline.Message)
+						require.Equal(t, uint64(10), message.GetID())
+						require.Equal(t, pipeline.Method_PipelineStreamFinish, message.GetCmd())
+						require.Equal(t, pipeline.Status_Last, message.GetSid())
+						require.Equal(t, pipeline.StreamTeardownMode_FinishAck, message.GetRequestedTeardownMode())
+						return nil
+					}),
+				stream.EXPECT().Close(true).DoAndReturn(func(bool) error {
+					require.ErrorIs(t, cleanupCtx.Err(), context.DeadlineExceeded)
+					return nil
+				}),
+			)
+			sender := &messageSenderOnClient{
+				ctx:          context.Background(),
+				streamSender: stream,
+				// No ACK can arrive. Virtual time advances only after FIN has
+				// been sent and the receiver blocks, not during fixture setup.
+				receiveCh:     make(chan morpc.Message),
+				safeToClose:   true,
+				reuseEligible: true,
+			}
+			sender.close(cleanupCtx)
+			require.ErrorIs(t, cleanupCtx.Err(), context.DeadlineExceeded)
+			require.Equal(t, pipelineStreamFinishClientTimeout, time.Since(started))
+		})
 	})
 
 	t.Run("clean StopSending End reuses backend", func(t *testing.T) {
```

**File**: `pkg/sql/plan/constant_fold_serialized_test.go` (modified, +11/-4)
```diff
@@ -43,6 +43,7 @@ func TestConstantFoldBitCountDiagnostics(t *testing.T) {
 		for _, value := range []string{"3 ", "3x"} {
 			t.Run(folder+"/"+value, func(t *testing.T) {
 				proc := testutil.NewProcess(t)
+				t.Cleanup(proc.Free)
 				sink := &process.WarningProbe{}
 				proc.WarningSink = sink
 				expr, err := BindFuncExprImplByPlanExpr(proc.Ctx, "bit_count", []*Expr{makePlan2StringConstExprWithType(value)})
@@ -58,12 +59,18 @@ func TestConstantFoldBitCountDiagnostics(t *testing.T) {
 				}
 				require.False(t, sink.Warned(), "speculation must not publish statement warnings")
 				require.Same(t, sink, proc.WarningSink)
-				if value == "3x" {
-					require.NotNil(t, folded.GetF())
-				} else {
-					require.NotNil(t, folded.GetLit())
+				if value == "3 " {
+					require.NotNil(t, folded.GetLit(), "warning-free constants must remain usable by literal-only consumers")
 					require.Equal(t, uint64(2), folded.GetLit().GetU64Val())
+				} else {
+					require.NotNil(t, folded.GetF(), "warningful expressions must remain runtime-evaluated")
 				}
+
+				result, free, err := colexec.GetReadonlyResultFromExpression(proc, folded, []*batch.Batch{batch.EmptyForConstFoldBatch})
+				require.NoError(t, err)
+				defer free()
+				require.Equal(t, uint64(2), vector.MustFixedColNoTypeCheck[uint64](result)[0])
+				require.Equal(t, value == "3x", sink.Warned(), "runtime diagnostics must be preserved without planning-time warnings")
 			})
 		}
 	}
```

**File**: `pkg/sql/plan/function/function_id_test.go` (modified, +27/-3)
```diff
@@ -82,14 +82,38 @@ func TestAggregateExecutorIDs(t *testing.T) {
 	}
 }
 
-func TestMinMaxRejectJSON(t *testing.T) {
+func TestMinMaxAcceptJSON(t *testing.T) {
 	for _, name := range []string{"min", "max"} {
-		_, err := GetFunctionByName(
+		fn, err := GetFunctionByName(
 			context.Background(),
 			name,
 			[]types.Type{types.T_json.ToType()},
 		)
-		require.Error(t, err, name)
+		require.NoError(t, err, name)
+		require.Equal(t, types.T_json, fn.GetReturnType().Oid, name)
+	}
+}
+
+func TestMaxByJSONTypeBoundary(t *testing.T) {
+	for _, name := range []string{"max_by", "max_by_non_null"} {
+		t.Run(name, func(t *testing.T) {
+			for _, key := range []int{1, 2} {
+				args := []types.Type{types.T_varchar.ToType(), types.T_int64.ToType(), types.T_int64.ToType()}
+				args[key] = types.T_json.ToType()
+				_, err := GetFunctionByName(context.Background(), name, args)
+				badTypes := "[VARCHAR JSON BIGINT]"
+				if key == 2 {
+					badTypes = "[VARCHAR BIGINT JSON]"
+				}
+				require.EqualError(t, err, "invalid argument aggregate function "+name+", bad value "+badTypes)
+			}
+			for _, valueType := range []types.T{types.T_varchar, types.T_json} {
+				fn, err := GetFunctionByName(context.Background(), name,
+					[]types.Type{valueType.ToType(), types.T_int64.ToType(), types.T_int64.ToType()})
+				require.NoError(t, err)
+				require.Equal(t, valueType, fn.GetReturnType().Oid, "return values do not participate in key comparison")
+			}
+		})
 	}
 }
 
```

**File**: `pkg/sql/plan/function/list_agg.go` (modified, +4/-0)
```diff
@@ -730,7 +730,10 @@ func maxByTypeCheck(_ []overload, inputs []types.Type) checkResult {
 			}
 		}
 	}
+	// Only MIN/MAX have typed JSON key comparison. MAX_BY may return JSON,
+	// but its ordering and tie keys must not reach the bytewise fallback.
 	if !typeInList(casts[0].Oid, AnyValueSupportedTypes) ||
+		casts[1].Oid == types.T_json || casts[2].Oid == types.T_json ||
 		!typeInList(casts[1].Oid, MinMaxSupportedTypes) ||
 		!typeInList(casts[2].Oid, MinMaxSupportedTypes) {
 		return newCheckResultWithFailure(failedAggParametersWrong)
@@ -828,6 +831,7 @@ var MinMaxSupportedTypes = []types.T{
 	types.T_varchar, types.T_char, types.T_blob, types.T_text, types.T_datalink,
 	types.T_uuid,
 	types.T_binary, types.T_varbinary,
+	types.T_json,
 }
 
 var AnyValueSupportedTypes = []types.T{
```

**File**: `pkg/sql/plan/json_elt_lazy_fold_test.go` (modified, +15/-4)
```diff
@@ -24,22 +24,27 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
 	planrule "github.com/matrixorigin/matrixone/pkg/sql/plan/rule"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/process"
 	"github.com/stretchr/testify/require"
 	"testing"
 )
 
 func TestJSONStringEltLazyPlannerFolding(t *testing.T) {
-	proc := testutil.NewProcess(t)
-	defer proc.Free()
 	for _, tc := range []struct {
-		sql, want  string
-		null, fail bool
+		sql, want          string
+		null, fail, warned bool
 	}{
 		{sql: "elt(1,'ok',cast('bad' as json))", want: "ok"},
+		{sql: "concat(elt(1,'ok',cast('bad' as json)),'!')", want: "ok!"},
+		{sql: "elt(1,elt(1,'ok',cast('bad' as json)),cast('bad' as json))", want: "ok"},
 		{sql: "elt(null,cast('bad' as json),'ok')", null: true},
 		{sql: "elt(0,cast('bad' as json),'ok')", null: true},
 		{sql: "elt(3,cast('bad' as json),'ok')", null: true},
 		{sql: "elt(1,cast('bad' as json),'ok')", fail: true},
+		{sql: "elt(1,'ok',cast(bit_count('3x') as json))", want: "ok"},
+		{sql: "elt(1,cast(bit_count('3 ') as json),cast('bad' as json))", want: "2"},
+		{sql: "elt(1,cast(bit_count('3x') as json),'ok')", want: "2", warned: true},
+		{sql: "concat(elt(1,cast(bit_count('3x') as json),'ok'),'!')", want: "2!", warned: true},
 	} {
 		t.Run(tc.sql, func(t *testing.T) {
 			stmt, err := parsers.ParseOne(context.Background(), dialect.MYSQL, "select "+tc.sql, 1)
@@ -50,6 +55,10 @@ func TestJSONStringEltLazyPlannerFolding(t *testing.T) {
 			require.NoError(t, err)
 			for _, mode := range []string{"runtime", "api", "optimizer", "prepare"} {
 				t.Run(mode, func(t *testing.T) {
+					proc := testutil.NewProcess(t)
+					t.Cleanup(proc.Free)
+					sink := &process.WarningProbe{}
+					proc.WarningSink = sink
 					expr := DeepCopyExpr(bound)
 					if mode == "api" {
 						expr, err = ConstantFold(batch.EmptyForConstFoldBatch, expr, proc, false, true)
@@ -63,6 +72,7 @@ func TestJSONStringEltLazyPlannerFolding(t *testing.T) {
 					requires, err := planpb.RequiresMORPCVersion129JSONStringConsumerOverload([]*planpb.Expr{expr})
 					require.NoError(t, err)
 					require.True(t, requires, "fold must retain durable/remote ELT identity")
+					require.False(t, sink.Warned(), "speculative folding must not publish selected or unselected warnings")
 					result, free, err := colexec.GetReadonlyResultFromExpression(proc, expr, []*batch.Batch{batch.EmptyForConstFoldBatch})
 					if free != nil {
 						defer free()
@@ -72,6 +82,7 @@ func TestJSONStringEltLazyPlannerFolding(t *testing.T) {
 						return
 					}
 					require.NoError(t, err)
+					require.Equal(t, tc.warned, sink.Warned(), "only the selected subtree may publish runtime warnings")
 					if tc.null {
 						require.True(t, result.IsNull(0))
 						return
```

---

### Incident Patch 3: `ecdeffcf` (2026-10-22)
**Commit Message**: fix(plan): preserve decimal pruning for integer-backed DOUBLE parameters (#30817)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Addresses the remaining explicit DOUBLE / integer-source path of #29661.
Keep the issue open pending merged-nightly confirmation.

## What this PR does / why we need it:

### Summary

Addresses the remaining integer-backed explicit DOUBLE comparison in
#29661. Earlier fixes cover direct integer/TEXT DECIMAL comparisons, but
`d = CAST(? AS DOUBLE)` with an integer source still scans every
persisted block and loses native secondary-index access.

On frozen main `ada0bde326adec3c3906d2f417c266d0ada5b054`, both binary
Prepared and SQL EXECUTE return the correct row for `16001`, but read 4
blocks / 32,768 rows rather than the literal control's 1 block / 8,192
rows. The unchanged Daily MOTR pruning contract fails on precisely this
residual.

### Design

- Admit only SELECT scalar comparisons of a native DECIMAL64/128 column
with a plain DOUBLE cast of a parameter through an injective integer
cast chain.
- Reuse the existing D

**File**: `pkg/frontend/computation_wrapper.go` (modified, +12/-8)
```diff
@@ -93,12 +93,13 @@ type TxnComputationWrapper struct {
 	// specialization outside the live PrepareStmt cache. The candidate is
 	// installed only after its Compile succeeds, so a failed replacement leaves
 	// the preceding category and Compile intact.
-	runtimeCacheTarget          *PrepareStmt
-	runtimeCacheKey             string
-	runtimeCachePlan            *plan.Plan
-	runtimeCacheDiagnostics     []*plan.Expr
-	runtimeCacheColDefData      [][]byte
-	runtimeCacheRetiredCompiles []retiredRuntimeCompile
+	runtimeCacheTarget             *PrepareStmt
+	runtimeCacheKey                string
+	runtimeCachePlan               *plan.Plan
+	runtimeCacheDiagnostics        []*plan.Expr
+	runtimeCacheDecimalFloatProofs []plan2.PreparedDecimalFloatProof
+	runtimeCacheColDefData         [][]byte
+	runtimeCacheRetiredCompiles    []retiredRuntimeCompile
 
 	explainBuffer *bytes.Buffer
 	binaryPrepare bool
@@ -1856,7 +1857,8 @@ func initExecuteStmtParamWithResolverInSession(
 			proof = func(expr *plan.Expr) bool { return preparedBinaryIntegerCastDiagnosticFree(prepareStmt, expr, true) }
 		}
 		if key == prepareStmt.runtimeSpecializationKey && prepareStmt.runtimePlan != nil &&
-			!fieldTypes.NeedsReprepare(cwft.paramBindings, cwft.paramVals) {
+			!fieldTypes.NeedsReprepare(cwft.paramBindings, cwft.paramVals) &&
+			plan2.MatchPreparedDecimalFloatProofs(prepareStmt.runtimeDecimalFloatProofs, cwft.paramBindings, cwft.paramVals) {
 			safe, probeErr := plan2.ProbePreparedDiagnosticCandidatesWithProof(cwft.proc, prepareStmt.runtimeDiagnosticCandidates, proof)
 			if probeErr != nil {
 				return nil, nil, nil, originSQL, false, probeErr
@@ -1920,6 +1922,7 @@ func initExecuteStmtParamWithResolverInSession(
 			if cacheable {
 				cwft.runtimeCacheTarget, cwft.runtimeCacheKey, cwft.runtimeCachePlan = prepareStmt, key, executionPlan
 				cwft.runtimeCacheDiagnostics = bound.DiagnosticCandidates
+				cwft.runtimeCacheDecimalFloatProofs = bound.DecimalFloatProofs
 			}
 		}
 	} else if numParams > 0 && (executionPlan.GetDdl().GetQuery() != nil || executionPlan.GetDcl().GetSetVariables() != nil) {
@@ -2026,6 +2029,7 @@ func (cwft *TxnComputationWrapper) discardRuntimeCacheCandidate() {
 	cwft.runtimeCacheKey = ""
 	cwft.runtimeCachePlan = nil
 	cwft.runtimeCacheDiagnostics = nil
+	cwft.runtimeCacheDecimalFloatProofs = nil
 	cwft.runtimeCacheColDefData = nil
 }
 
@@ -2046,7 +2050,7 @@ func (cwft *TxnComputationWrapper) installRuntimeCacheCandidate(runtimeCompile *
 		return false
 	}
 	retiredCompile := cwft.runtimeCacheTarget.installRuntimeSpecializationCache(
-		cwft.runtimeCacheKey, cwft.runtimeCachePlan, runtimeCompile, cwft.runtimeCacheDiagnostics, cwft.runtimeCacheColDefData)
+		cwft.runtimeCacheKey, cwft.runtimeCachePlan, runtimeCompile, cwft.runtimeCacheDiagnostics, cwft.runtimeCacheDecimalFloatProofs, cwft.runtimeCacheColDefData)
 	if retiredCompile != nil {
 		// NewCompile has already installed runtimeCompile's execution state on the
 		// shared session Process. Releasing the displaced compile here would call
```

**File**: `pkg/frontend/computation_wrapper_test.go` (modified, +2/-2)
```diff
@@ -4475,8 +4475,8 @@ func TestRuntimeSpecializationReplacementCommitsOnlyAfterCompileSuccess(t *testi
 		cw.proc, prepareStmt.PrepareStmt, false, nil, time.Now())
 	oldMetadata := [][]byte{[]byte("old column payload")}
 	oldDiagnostics := []*plan.Expr{{Typ: plan.Type{Id: int32(types.T_int32)}, Expr: &plan.Expr_P{P: &plan.ParamRef{Pos: 0}}}}
-	prepareStmt.installRuntimeSpecializationCache("old", oldPlan, oldCompile, oldDiagnostics, oldMetadata)
-	require.Nil(t, prepareStmt.installRuntimeSpecializationCache("old", oldPlan, oldCompile, oldDiagnostics, oldMetadata),
+	prepareStmt.installRuntimeSpecializationCache("old", oldPlan, oldCompile, oldDiagnostics, nil, oldMetadata)
+	require.Nil(t, prepareStmt.installRuntimeSpecializationCache("old", oldPlan, oldCompile, oldDiagnostics, nil, oldMetadata),
 		"reinstalling the live compile must not retire it")
 
 	for _, compileErr := range []error{assert.AnError, context.Canceled} {
```

**File**: `pkg/frontend/prepared_ap_cache_test.go` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ func TestPreparedRuntimeAPCacheReusesPlanNotTopology(t *testing.T) {
 			oldTP := compile.NewCompile("", "", prepared.Sql, "", "", nil,
 				cw.proc, prepared.PrepareStmt, false, nil, time.Now())
 			prepared.installRuntimeSpecializationCache("previous-category",
-				prepared.PreparePlan.GetDcl().GetPrepare().Plan, oldTP, nil, nil)
+				prepared.PreparePlan.GetDcl().GetPrepare().Plan, oldTP, nil, nil, nil)
 			newCompiler := func() (*compile.Compile, func()) {
 				c := compile.NewCompile("ingress:6001", "", prepared.Sql, "", "",
 					&successfulSchedulingPreviewEngine{}, cw.proc, prepared.PrepareStmt, false, nil, time.Now())
```

**File**: `pkg/frontend/prepared_decimal_float_cache_test.go` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package frontend
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/compile"
+	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
+	"github.com/stretchr/testify/require"
+)
+
+func TestPreparedDecimalFloatSingleSlotCache(t *testing.T) {
+	const wide = "1152921504606846976"
+	for _, first := range []string{"7", wide} {
+		t.Run(first, func(t *testing.T) {
+			base := plan2.NewMockCompilerContext(false, newPlanTestProcess(t))
+			_, table, err := base.Resolve("tpch", "nation", nil)
+			require.NoError(t, err)
+			for _, col := range table.Cols {
+				if col.Name == "n_nationkey" {
+					col.Typ.Id, col.Typ.Width, col.Typ.Scale = int32(types.T_decimal128), 18, 2
+				}
+			}
+			ctx := &preparedStatsTestCompiler{preparedTestCompiler: &preparedTestCompiler{CompilerContext: base, proc: base.GetProcess()}, table: table}
+			ses, prepared, cw, ec := newPreparedExecuteEnvForSQLWithCompilerContext(
+				t, 29661, "select n_name from nation where n_nationkey=cast(? as double)", ctx)
+			ctx.proc = cw.proc
+			closed := false
+			closePrepared := func() {
+				if closed {
+					return
+				}
+				closed = true
+				cw.releaseRuntimeCacheRetiredCompiles()
+				cw.proc.SetPrepareParams(nil)
+				prepared.Close()
+			}
+			t.Cleanup(closePrepared)
+			bind := func(value string, null bool, source defines.MysqlType) {
+				t.Helper()
+				cw.proc.SetPrepareParams(nil)
+				if prepared.params != nil {
+					prepared.params.Free(cw.proc.Mp())
+				}
+				prepared.params = vector.NewVec(types.T_text.ToType())
+				require.NoError(t, vector.AppendBytes(prepared.params, []byte(value), null, cw.proc.Mp()))
+				prepared.ParamTypes = []byte{byte(source), 0}
+			}
+			execute := func() (*compile.Compile, *plan.Plan) {
+				t.Helper()
+				cw.discardRuntimeCacheCandidate()
+				comp, p, stmt, _, owned, err := initExecuteStmtParamWithResolverInSession(ec, ses, ses, cw, nil, prepared.Name, ctx.Resolve, ctx)
+				if owned && stmt != nil {
+					stmt.Free()
+				}
+				require.NoError(t, err)
+				return comp, p
+			}
+			install := func(p *plan.Plan) *compile.Compile {
+				t.Helper()
+				require.Same(t, p, cw.runtimeCachePlan)
+				require.NotEmpty(t, cw.runtimeCacheDecimalFloatProofs)
+				comp := compile.NewCompile("", "", prepared.Sql, "", "", nil, cw.proc, prepared.PrepareStmt, false, nil, time.Now())
+				installed := false
+				t.Cleanup(func() {
+					if !installed {
+						comp.FreeOperator()
+						comp.Release()
+					}
+				})
+				installed = cw.completeRuntimeCacheCandidate(comp, nil)
+				require.True(t, installed)
+				require.NotEmpty(t, prepared.runtimeDecimalFloatProofs)
+				require.Nil(t, cw.runtimeCacheDecimalFloatProofs)
+				return comp
+			}
+			bind(first, false, defines.MYSQL_TYPE_LONGLONG)
+			_, cachedPlan := execute()
+			cached := install(cachedPlan)
+			other := wide
+			if first == wide {
+				other = "7"
+			}
+			firstWide := first == wide
+			cachedWide := firstWide
+			firstSibling, otherSibling := "9", "1152921504606846977"
+			if firstWide {
+				firstSibling, otherSibling = otherSibling, firstSibling
+			}
+			for _, step := range []struct {
+				value string
+				wide  bool
+			}{{firstSibling, firstWide}, {other, !firstWide}, {otherSibling, !firstWide}, {first, firstWide}, {firstSibling, firstWide}} {
+				bind(step.value, false, defines.MYSQL_TYPE_LONGLONG)
+				comp, p := execute()
+				if step.wide == cachedWide {
+					require.Same(t, cachedPlan, p, "same proof class must not replan: %s", step.value)
+					require.Same(t, cached, comp, "repeated values in either class must reuse the compile")
+					require.Nil(t, cw.runtimeCacheTarget)
+					continue
+				}
+				require.Nil(t, comp)
+				require.NotSame(t, cachedPlan, p, "a different proof class needs exactly one new plan")
+				require.NotEmpty(t, cw.runtimeCacheDecimalFloatProofs)
+				oldProofs := prepared.runtimeDecimalFloatProofs
+				require.False(t, cw.completeRuntimeCacheCandidate(nil, context.Canceled))
+				require.Same(t, cachedPlan, prepared.runtimePlan)
+				require.Same(t, cached, prepared.runtimeCompile)
+				require.Equal(t, oldProofs, prepared.runtimeDe
```

**File**: `pkg/frontend/prepared_field_test.go` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ func TestPreparedFieldHistoryCacheAndMigration(t *testing.T) {
 		}()
 		if cw.runtimeCachePlan != nil {
 			cacheHits++
-			prepared.installRuntimeSpecializationCache(cw.runtimeCacheKey, cw.runtimeCachePlan, nil, cw.runtimeCacheDiagnostics, cw.runtimeCacheColDefData)
+			prepared.installRuntimeSpecializationCache(cw.runtimeCacheKey, cw.runtimeCachePlan, nil, cw.runtimeCacheDiagnostics, cw.runtimeCacheDecimalFloatProofs, cw.runtimeCacheColDefData)
 			cw.discardRuntimeCacheCandidate()
 			_, cached, clone, _, owned, err := initExecuteStmtParam(ec, ses, cw, nil, prepared.Name)
 			if owned && clone != nil {
```

**File**: `pkg/frontend/types.go` (modified, +4/-0)
```diff
@@ -432,6 +432,7 @@ type PrepareStmt struct {
 	runtimeSpecializationKey    string
 	runtimePlan                 *plan.Plan
 	runtimeDiagnosticCandidates []*plan.Expr
+	runtimeDecimalFloatProofs   []plan2.PreparedDecimalFloatProof
 	runtimeColDefData           [][]byte
 	runtimeCompile              *compile.Compile
 
@@ -845,6 +846,7 @@ func (prepareStmt *PrepareStmt) installRuntimeSpecializationCache(
 	runtimePlan *plan.Plan,
 	runtimeCompile *compile.Compile,
 	diagnosticCandidates []*plan.Expr,
+	decimalFloatProofs []plan2.PreparedDecimalFloatProof,
 	colDefData [][]byte,
 ) *compile.Compile {
 	oldRuntimeCompile := prepareStmt.runtimeCompile
@@ -859,6 +861,7 @@ func (prepareStmt *PrepareStmt) installRuntimeSpecializationCache(
 	prepareStmt.runtimeSpecializationKey = key
 	prepareStmt.runtimePlan = runtimePlan
 	prepareStmt.runtimeDiagnosticCandidates = diagnosticCandidates
+	prepareStmt.runtimeDecimalFloatProofs = decimalFloatProofs
 	prepareStmt.runtimeColDefData = colDefData
 	prepareStmt.runtimeCompile = runtimeCompile
 	if oldRuntimeCompile == runtimeCompile {
@@ -875,6 +878,7 @@ func (prepareStmt *PrepareStmt) clearRuntimeSpecializationCache() {
 	prepareStmt.runtimeSpecializationKey = ""
 	prepareStmt.runtimePlan = nil
 	prepareStmt.runtimeDiagnosticCandidates = nil
+	prepareStmt.runtimeDecimalFloatProofs = nil
 	prepareStmt.runtimeColDefData = nil
 	prepareStmt.runtimeCompile = nil
 	prepareStmt.releaseRuntimeCompile(oldRuntimeCompile)
```

**File**: `pkg/sql/plan/prepared_binding.go` (modified, +8/-1)
```diff
@@ -96,6 +96,7 @@ type preparedSourceBindingState struct {
 	valueDependent       bool
 	selectStatement      bool
 	diagnosticCandidates []*Expr
+	decimalFloatProofs   []PreparedDecimalFloatProof
 	diagnosticFree       bool
 }
 
@@ -661,6 +662,11 @@ func bindPreparedConsumerArguments(ctx context.Context, name string, args []*Exp
 		return args, nil
 	}
 	name = strings.ToLower(name)
+	if converted, admitted, err := bindPreparedDecimalFloatArguments(ctx, name, args); err != nil {
+		return nil, err
+	} else if admitted {
+		return converted, nil
+	}
 	if converted, admitted, err := bindPreparedDecimalIntegerArguments(ctx, name, args); err != nil {
 		return nil, err
 	} else if admitted {
@@ -987,6 +993,7 @@ type PreparedExecutionPlan struct {
 	Plan                 *Plan
 	FieldTypes           *PreparedFieldTypes
 	DiagnosticCandidates []*Expr
+	DecimalFloatProofs   []PreparedDecimalFloatProof
 	DiagnosticFree       bool
 	ValueDependent       bool
 }
@@ -1049,7 +1056,7 @@ func BuildPreparedExecutionPlan(ctx CompilerContext, stmt tree.Statement,
 		return nil, err
 	}
 	state := preparedBindingState(planning)
-	return &PreparedExecutionPlan{Plan: p, FieldTypes: state.fieldTypes.result(), DiagnosticCandidates: state.diagnosticCandidates,
+	return &PreparedExecutionPlan{Plan: p, FieldTypes: state.fieldTypes.result(), DiagnosticCandidates: state.diagnosticCandidates, DecimalFloatProofs: state.decimalFloatProofs,
 		DiagnosticFree: state.diagnosticFree, ValueDependent: state.valueDependent}, nil
 }
 
```

**File**: `pkg/sql/plan/prepared_binding_test.go` (modified, +12/-1)
```diff
@@ -221,7 +221,13 @@ func TestPreparedDecimalIntegerConsumerPruning(t *testing.T) {
 			{"signed cast integer", "c = cast(? as signed)", types.T_int64, []string{"16001"}, true, true},
 			{"signed cast unsigned control", "c = cast(? as signed)", types.T_uint64, []string{"18446744073709551615"}, false, false},
 			{"signed cast double control", "c = cast(? as signed)", types.T_float64, []string{"16001.75"}, false, false},
-			{"double cast integer control", "c = cast(? as double)", types.T_int64, []string{"16001"}, false, false},
+			{"double cast integer", "c = cast(? as double)", types.T_int64, []string{"16001"}, true, false},
+			{"double cast integer range", "c >= cast(? as double)", types.T_int64, []string{"-16001"}, true, false},
+			{"double cast unsigned commuted", "cast(? as double) <= c", types.T_uint64, []string{"16001"}, true, false},
+			{"double cast injective chain", "c = cast(cast(? as signed) as double)", types.T_int64, []string{"16001"}, true, false},
+			{"double cast wide integer", "c = cast(? as double)", types.T_int64, []string{"1152921504606846976"}, false, false},
+			{"double cast float32 control", "c = cast(cast(? as float) as double)", types.T_int64, []string{"16001"}, false, false},
+			{"double cast rounded control", "c = cast(? as double(5,0))", types.T_int64, []string{"16001"}, false, false},
 			{"abs double cast integer control", "c = abs(cast(? as double))", types.T_int64, []string{"-16001"}, false, false},
 			{"double cast collision", "c = cast(? as double)", types.T_int64, []string{"9007199254740992"}, false, false},
 		} {
@@ -252,6 +258,11 @@ func TestPreparedDecimalIntegerConsumerPruning(t *testing.T) {
 				t.Cleanup(stmt.Free)
 				bound, err := BuildPreparedExecutionPlan(&mock.ctxt, stmt, bindings, values)
 				require.NoError(t, err)
+				if tc.native && strings.Contains(tc.name, "double cast") || tc.name == "double cast wide integer" || tc.name == "double cast collision" {
+					require.NotEmpty(t, bound.DecimalFloatProofs)
+					require.False(t, bound.ValueDependent, "both proved classes can occupy the single cache slot")
+					require.True(t, MatchPreparedDecimalFloatProofs(bound.DecimalFloatProofs, bindings, values))
+				}
 				if tc.guarded {
 					require.False(t, bound.ValueDependent, "safe admitted domains remain reusable")
 					require.NotEmpty(t, bound.DiagnosticCandidates)
```

#### Recent Merged Pull Requests:
- **PR #30952** (closed): docs: correct purge_log example in builtin comment (@jiangxinmeng1)
- **PR #30946** (2026-10-23): docs(skills): add flexible defect-hunt workflow (@XuPeng-SH)
- **PR #30944** (2026-10-23): fix(python-sdk): normalize async PITR wildcard scopes (@MatrixAdventurer)
- **PR #30927** (2026-10-23): [4.2-dev] fix(vectorindex): isolate AVX-512 kernels from CPU dispatch (@LeftHandCold)
- **PR #30901** (2026-10-23): fix(moerr): return MySQL deadlock retry identity (@XuPeng-SH)
- **PR #30895** (2026-10-23): fix(plan): ignore storage-only table options in ALTER TABLE (@MatrixAdventurer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. frontend): persist default role selection (#30709)

**RULE**:
When implementing operations in `pkg/frontend/authenticate.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `68fe0510`: frontend): persist default role selection (#30709). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/frontend/authenticate.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	case *tree.SetDefaultRole:
		typs = append(typs, PrivilegeTypeAlterUser, PrivilegeTypeAccountAll)
	case *tree.SetRole, *tree.SetPassword:
	if st, isSetDefaultRole := stmt.(*tree.SetDefaultRole); isSetDefaultRole && ses.GetFromRealUser() {
		self, selfErr := setDefaultRoleTargetsAreCurrentUser(ctx, ses, st)
		if selfErr != nil {
			return false, stats, selfErr
		}
		if self {
			return true, stats, nil
		}
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	case *tree.SetDefaultRole, *tree.SetRole, *tree.SetPassword:
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `68fe0510` are properly handled with clean fallback behavior.
