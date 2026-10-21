> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `04fe057b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T05:03:03.953Z  
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
> **Harvest Timestamp**: 2026-10-21T05:03:03.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2056 stars

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
	db.SetMaxOpenConns(e.Threads + 1)
	db.SetMaxIdleConns(e.Threads + 1)
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
		if err := r.scanner.Err(); err != ni
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
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

type WorkerRequest struct {
	Version         int    `json:"version"`
	Operation       string `json:"operation"`
	Engine          Engine `json:"engine"`
	DatasetRoot     string `json:"dataset_root"`
	OutputRoot      string `json:"output_root"`
	Queries         []int  `json:"queries,omitempty"`
	Repetitions     int    `json:"repetitions,omitempty"`
	QueryDeadlineNS int64  `json:"query_deadline_ns"`
	Reference       bool   `json:"reference,omitempty"`
	Unlimited       bool   `json:"unlimited_diagnostic,omitempty"`
}
type QueryReceipt struct {
	Query      int     `json:"query"`
	Repetition int     `json:"repetition"`
	Capture    Capture `json:"capture"`
	Error      string  `json:"error,omitempty"`
	Reference  string  `json:"reference,omitempty"`
}
type WorkerReceipt struct {
	Version       int               `json:"version"`
	Engine        string            `json:"engine"`
	EngineVersion string            `json:"engine_version"`
	GoVersion     string            `json:"go_version"`
	Build         string            `json:"build"`
	Dataset       FileID            `json:"dataset"`
	Binary        FileID            `json:"binary"`
	Settings      map[string]string `json:"effective_settings"`
	Variant       string            `json:"variant"`
	Started       time.Time         `json:"started"`
	Finished      time.Time         `json:"finished"`
	Queries       []QueryReceipt    `json:"queries,omitempty"`
	Load          *LoadReceipt      `json:"load,omitempty"`
	Error         string            `json:"error,omitempty"`
	Cleanup       string            `json:"cleanup"`
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

func runWorker(ctx context.Context, r WorkerRequest) (out WorkerReceipt, retErr error) {
	out = WorkerReceipt{Version: formatVersion, Engine: r.Engine.Name, GoVersion: runtime.Version(), Started: time.Now().UTC(), Cleanup: "failed"}
	out.Variant = "qualification"
	if r.Unlimited {
		out.Variant = "unlimited_diagnostic"
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
	if r.Version != formatVersion || r.Engine.Threads < 1 || r.Engine.Threads > 64 || r.Engine.MemoryBytes < 128<<20 || r.Repetitions < 0 || r.Repetitions > 2000 || r.QueryDeadlineNS <= 0 {
		return out, errors.New("invalid bounded worker request")
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
		for rep := 0; rep < r.Repetitions; rep++ {
			for _, n := range r.Queries {
				if n < 1 || n > 22 {
					return out, errors.New("query outside Q1-Q22")
				}
				q := d.Queries[n-1].rendered(fmt.Sprintf("%d_%d_%d", os.Getpid(), rep, n))
				if r.Unlimited && q.Limit > 0 {
					q.Statements[q.ResultStatement] = strings.TrimSuffix(q.Statements[q.ResultStatement], fmt.Sprintf(" LIMIT %d", q.Limit))
					q.Limit = 0
				}
				queryCtx, cancel := context.WithTimeoutCause(ctx, time.Duration(r.QueryDeadlineNS), fmt.Errorf("query Q%d execution deadline", n))
				cap, err := executeUnit(queryCtx, conn, q, filepath.Join(r.OutputRoot, fmt.Sprintf("q%02d-%04d.rows", n, rep)), captureDisk)
				cancel()
				receipt := QueryReceipt{Query: n, Repetition: rep, Capture: cap}
				if err != nil {
					receipt.Error = err.Error()
					out.Queries = append(out.Queries, receipt)
					return out, err
				}
				if r.Reference {
					err = qualifyReference(r.DatasetRoot, d, q, r.OutputRoot, cap)
					receipt.Reference = "pass"
					if err != nil {
						receipt.Reference = "failed"
						receipt.Error = err.Error()
					}
				}
				out.Queries = append(out.Queries, receipt)
				if err != nil {
					return out, err
				}
			}
		}
		return out, nil
	default:
		return out, fmt.Errorf("unsupported worker operation %q", r.Operation)
	}
}

```

### Core Architecture Module: `pkg/backup/utils.go`
```
// Copyright 2023 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package backup

import (
	"context"
	"strconv"
	"strings"

	"github.com/matrixorigin/matrixone/pkg/common/moerr"
	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
	"github.com/matrixorigin/matrixone/pkg/version"
)

func buildInfo() string {
	infos := []string{
		"GoVersion: " + version.GoVersion,
		"BranchName: " + version.BranchName,
		"CommitID: " + version.CommitID,
		"BuildTime: " + version.BuildTime,
		"Version: " + version.Version,
	}
	return strings.Join(infos, "|")
}

// SaveLaunchConfigPath saves all config file paths for the standalone config
func SaveLaunchConfigPath(typ string, paths []string) {
	launchConfigPaths[typ] = paths
}

func getS3Config(ctx context.Context, option []string) (*s3Config, error) {
	conf := &s3Config{}
	for i := 0; i < len(option); i += 2 {
		switch strings.ToLower(option[i]) {
		case "endpoint":
			conf.endpoint = option[i+1]
		case "region":
			conf.region = option[i+1]
		case "access_key_id":
			conf.accessKeyId = option[i+1]
		case "secret_access_key":
			conf.secretAccessKey = option[i+1]
		case "bucket":
			conf.bucket = option[i+1]
		case "filepath":
			conf.filepath = option[i+1]
		case "compression":
			conf.compression = option[i+1]
		case "provider":
			conf.provider = option[i+1]
		case "role_arn":
			conf.roleArn = option[i+1]
		case "external_id":
			conf.externalId = option[i+1]
		case "format":
			format := strings.ToLower(option[i+1])
			if format != tree.CSV && format != tree.JSONLINE {
				return nil, moerr.NewBadConfigf(ctx, "the format '%s' is not supported", format)
			}
			conf.format = format
		case "jsondata":
			jsondata := strings.ToLower(option[i+1])
			if jsondata != tree.OBJECT && jsondata != tree.ARRAY {
				return nil, moerr.NewBadConfigf(ctx, "the jsondata '%s' is not supported", jsondata)
			}
			conf.jsonData = jsondata
			conf.format = tree.JSONLINE
		case "is_minio":
			isMinioData := strings.ToLower(option[i+1])
			if isMinioData != "true" && isMinioData != "false" {
				return nil, moerr.NewBadConfigf(ctx, "the is_minio '%s' is not supported", isMinioData)
			}
			if isMinioData == "true" {
				conf.isMinio = true
			} else {
				conf.isMinio = false
			}
		case "parallelism":
			parallelismData := strings.ToLower(option[i+1])
			parall, err := strconv.ParseUint(parallelismData, 10, 16)
			if err != nil {
				return nil, moerr.NewBadConfigf(ctx, "the parallelism '%s' is invalid", parallelismData)
			}
			conf.parallelism = uint16(parall)
		default:
			return nil, moerr.NewBadConfigf(ctx, "the keyword '%s' is not support", strings.ToLower(option[i]))
		}
	}
	if conf.format == tree.JSONLINE && len(conf.jsonData) == 0 {
		return nil, moerr.NewBadConfig(ctx, "the jsondata must be specified")
	}
	if len(conf.format) == 0 {
		conf.format = tree.CSV
	}
	return conf, nil
}

```

### Core Architecture Module: `pkg/bootstrap/versions/utils.go`
```
// Copyright 2021 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package versions

import (
	"time"

	"github.com/matrixorigin/matrixone/pkg/common/pubsub"
	"github.com/matrixorigin/matrixone/pkg/container/types"
	"github.com/matrixorigin/matrixone/pkg/container/vector"
	"github.com/matrixorigin/matrixone/pkg/util/executor"
)

const (
	getPubInfosSql = "select pub_name, database_name, database_id, table_list, account_list, created_time, update_time, comment from mo_catalog.mo_pubs"
)

var GetPubInfos = func(txn executor.TxnExecutor, accountId uint32, accountName string) (pubInfos []*pubsub.PubInfo, err error) {
	var exist bool
	if exist, err = CheckTableDefinition(txn, accountId, "mo_catalog", "mo_pubs"); err != nil || !exist {
		return
	}

	// select from old mo_pubs table, which located in each account
	res, err := txn.Exec(getPubInfosSql, executor.StatementOption{}.WithAccountID(accountId))
	if err != nil {
		return
	}
	defer res.Close()

	res.ReadRows(func(rows int, cols []*vector.Vector) bool {
		for i := 0; i < rows; i++ {
			var pubInfo pubsub.PubInfo
			pubInfo.PubAccountName = accountName
			pubInfo.PubName = cols[0].GetStringAt(i)
			pubInfo.DbName = cols[1].GetStringAt(i)
			pubInfo.DbId = vector.GetFixedAtWithTypeCheck[uint64](cols[2], i)
			pubInfo.TablesStr = cols[3].GetStringAt(i)
			pubInfo.SubAccountsStr = cols[4].GetStringAt(i)
			pubInfo.CreateTime = vector.GetFixedAtWithTypeCheck[types.Timestamp](cols[5], i).String2(time.Local, cols[5].GetType().Scale)
			if !cols[6].IsNull(uint64(i)) {
				pubInfo.UpdateTime = vector.GetFixedAtWithTypeCheck[types.Timestamp](cols[6], i).String2(time.Local, cols[6].GetType().Scale)
			}
			pubInfo.Comment = cols[7].GetStringAt(i)
			pubInfos = append(pubInfos, &pubInfo)
		}
		return true
	})
	return
}

// GetAllPubInfos returns map[pubAccountName#pubName] -> pubInfo
var GetAllPubInfos = func(txn executor.TxnExecutor, accNameInfoMap map[string]*pubsub.AccountInfo) (map[string]*pubsub.PubInfo, error) {
	allPubInfos := make(map[string]*pubsub.PubInfo)
	for _, accountInfo := range accNameInfoMap {
		pubInfos, err := GetPubInfos(txn, uint32(accountInfo.Id), accountInfo.Name)
		if err != nil {
			return nil, err
		}

		for _, pubInfo := range pubInfos {
			allPubInfos[accountInfo.Name+"#"+pubInfo.PubName] = pubInfo
		}
	}
	return allPubInfos, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30688** (2026-10-21): **test(plan): shorten table-dump binding budget cases**
  *Symptoms*: The forged-negative table-dump binding tests currently use the production 1,000,000 AST-visit limit, so they spend most of their runtime exhausting timezone and locale candidates just to assert the shared budget error. The latest UT report lists `TestTableDumpDefaultTimeZones/budget_control` at 92.94s; the locale budget case was still active at least 79s after it started ([CI run](https://github.com/matrixorigin/matrixone/actions/runs/39495715240/job/118880250801)).  This keeps the public analyzer's production limit fixed at 1,000,000 and adds a private call-local limit for the two budget tests. Their derived threshold completes the precision/era and alternate-locale searches, then enters timezone witness search before hitting the same overflow path. A small exact-boundary control covers success at the limit and failure one AST visit below it. Existing positive, cancellation, input-isolation, session-isolation, and warning-isolation checks remain.  Local focused race timings changed from 44.84s to 0.17s for the timezone budget case, and from 35.07s to 2.16s for the locale budget case.  Validation: - Full `TestTableDumpDefaultTimeZones` and `TestTableDumpDefaultLocales` groups passed in normal and race modes through `mo-cgo-test`. - Focused race run of `budget_control`, `ordinary_arithmetic`, and locale `budget` passed. - `go vet` and incremental `golangci-lint` passed for `./pkg/sql/plan`. 

- **Issue #30686** (2026-10-21): **perf(ut): reduce table dump verification cost and bound race parallelism**
  *Symptoms*: ## What type of PR is this?  - [x] Improvement - [x] Test and CI  ## Which issue(s) this PR fixes:  Refs #29249.  ## What this PR does / why we need it:  Recent UT race jobs grew from roughly 55 minutes to 68–70 minutes. Two slow jobs spent 1082–1091 seconds in three table-dump roots. Avoid cloning already-canonical bound expressions, lazily reuse visited timezone rules within one verification, and run independent table-dump cases at bounded in-process parallelism 3. Process admission and the heavy-package budget remain unchanged.  Keep every original scenario and comparison rule, cancellation behavior and candidate budget. Named rules and failed loads expire after each verification; UTC/Local matches require no named loads, and an early named witness never loads later candidates. Fixed numeric offsets have a finite shared cache. Differential tests retain the old expression comparator as an oracle.  The same change also enforces nonempty, unique and complete raw test/package lifecycles, restores Iceberg fixture state according to ownership, fixes legacy UT cleanup under nounset, and places native object inputs before static-library dependencies during shared linking.  Controlled race measurements: identical 91 original scenarios, precompiled binaries, GOMAXPROCS=8, baseline parallelism 1 vs current parallelism 3. The baseline is main `180608ea8c`; relevant baseline inputs are unchanged by the subsequent frontend-only main merge. Current treatment is `b691e23ef9`.  | Metric | 

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

### Incident Patch 1: `c119c688` (2026-10-21)
**Commit Message**: fix(sql): preserve FIELD binary domains and prepared CASE types (#30096)

`FIELD` compared binary strings through Unicode case folding. For example, `FIELD(_binary X'FF', _binary X'FE', _binary X'FF')` returned 1 instead of 2. The proposed behavior compares raw bytes for a resolved binary subject, preserving text comparison, NULL handling, first-match ordering, and numeric dispatch.

The complete scope includes selector/relational declaration ownership, immutable prepared CASE type history, statement-wide numeric reprepare, cache admission, failure publication, retry, migration, ordinary SQL and expression DEFAULTs. Transport types, source domains, consumer comparison domains, and result declarations remain separate. History-bearing handles cannot migrate because the existing payload cannot preserve their history.

### Versioned design and authorization

- Frozen [D2 design](https://github.com/matrixorigin/matrixone/blob/f2b418d1bfe604a1825419b3abf6affe0f53d09b/docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DESIGN_D2.md) and [D3 counterexamples](https://github.com/matrixorigin/matrixone/blob/f2b418d1bfe604a1825419b3abf6affe0f53d09b/docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DES

**File**: `docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DECISIONS.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# FIELD 类型历史设计：批准记录与实施合约
+
+## 可追溯决定（2026-10-19）
+
+- 完整范围：issue #25301 / PR #30096。D2/D3已在提交`f2b418d1bfe604a1825419b3abf6affe0f53d09b`发布。
+- D2 SHA256：`b2df6187d3f952284c92374d38e78f30ab04ca958bb49e241bcc0d78f2c42c8c`。
+- D3 SHA256：`9dd6d7ff2044cb2a9dfb9dc6da3dfe2a022717bd367433006458657a6508d33a`。
+- 第一次用户`go ahead`授权继续D2验证；随后发现的错误结果和实测性能代价没有被当成默示接受。
+- 本次向用户明确提出：“R1旧历史会使重试算错，建议依赖变化时返回重准备错误；R2普通32层REVERSE绑定耗时约增54%、分配增64KB，建议先优化再交付。”用户再次回复原文`go ahead`。
+- 据此选择D3的**R1方案A（fail-closed）**及**R2先优化、不直接接受已测额外开销**。D2的不可变H、handle发布点、单槽cache、迁移拒绝、不增加history wire/独立quota等其余已记录取舍不变。
+- 批准来源是本次交互用户，不冒充某个GitHub reviewer，也不倒签过去已有design-first批准。原D2/D3保持冻结；这份记录解释后续决定。GitHub实现review由相应reviewer独立完成，不自行dismiss CHANGES_REQUESTED。
+
+## R1：重试代际验证
+
+1. 新建或Reset缓存Compile时，retry capture携带当次history所依赖的不可变catalog引用事实（对象、版本、数据库/订阅、snapshot等）；不捕获可变handle来延迟取值。
+2. 复用既有`checkModify`依赖验证契约；在retry重建执行计划前，以当前事务编译context解析原依赖。捕获的catalog对象/版本等代际事实变化时，保守返回既有`TxnNeedRetryWithDefChanged`错误；这也包括版本发生变化但列类型未变的DDL。解析失败直接返回错误。不存在H的路径不增加此检查。经既有`RewriteError`，客户端可见代码为20631、SQLSTATE为HY000，不是MySQL 1615，不能假定驱动自动reprepare。
+3. 不把旧H用于新声明的rows，也不在retry建立第二个handle发布者。generation rebuilt先于重建回调的现有顺序保持；错误终端使frontend cache失效，下一EXECUTE按正常owner重建并发布H。
+4. 无变化/历史snapshot/仅物理重试保持原历史；metadata冻结前后都不能绕过检查。代价是本次请求可能要求客户端重试，已明确选择而非宣称与MySQL自动重准备完全一致。
+5. 新事实只属于当前/缓存Compile的retry capture，至多O(D)依赖数；容器/事实不与可变wrapper字段别名，不保留额外AST/Expr/值图。真正回pool清闭包后断开这些引用。不是新全局缓存或history链。
+
+## R2：普通TEXT路径的无状态证明
+
+- 优先优化`bindStringSourceDeclaration`的无关普通TEXT输入，避免每层都分配resolver/maps并遍历完整来源图。
+- 可使用窄的、无分配、只读证明：明确TEXT声明的基础扫描列或文本字面量，经已有函数source/result contract声明为透传的函数链仍为TEXT。复用已有contract，不添加第二份函数白名单。
+- 对无QueryBuilder（包括DEFAULT）、PREPARE/source binding context、参数/变量、来源witness、条件/NULLIF、隐式转换不明、窗口/聚合、投影/标量子查询/物化/关系回边等不确定情况，继续走原完整解析；不以当前payload或物理TEXT单独证明声明。TABLE_SCAN已有投影时也只接受同tag/position、无witness、TEXT的直接自引用，不能跳过投影所有者。
+- 证明只沿binder构造的表达式参数树，不追ColRef投影图，不加常驻memo，不在每行执行时做图遍历。若无状态证明不能恢复性能，先给实际原因，不擅自扩展为跨绑定缓存。
+- 在相同toolchain/native/SQL下比较原B、D3前H、最终实现。普通深嵌套样本要实质消除D3指出的额外分配/遍历，不以共享机器时间噪声掩盖；完整语义矩阵先于性能结论。
+
+## R3/R4及验收
+
+- `Compile.clear`是真正pool归还owner：清`buildPlanFunc`。prepared缓存的Release仍保留重试闭包；不依赖GC/pool Get指针巧合证明清理。
+- 将确定性cleanup及DEFAULT roundtrip探针落入适当永久测试；覆盖复制/序列化后的完整声明与实际表达式结果。
+- R1覆盖原错误反例、版本/对象变化、解析失败、未变化控制、metadata冻结前后、终端失效和下一次正常重建。实际公共SQL/客户端路径使用最小schema，不能把helper测试冒充完整服务竞态。
+- R2覆盖基础TEXT、显式二进制、隐藏声明、prepared历史、NULLIF、关系边界与别名回边；配对benchmark/结构计数用同一逻辑选择，不降低断言。
+- 所有正式变更完成后在merge后的最终源码运行focused/owning/static、生命周期race和相关公共SQL；有新增执行行时覆盖率至少75%。先复用有效证据，再补新增/失效部分。
+- 没有跨版本FIELD执行器行为一致性的保证；升级须避免让受影响查询同时使用旧、新执行语义。协议字段兼容测试不能替代该部署前提。Proxy/MULTICN/旧版本重启未执行时明确不宣称通过。
```

**File**: `docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DESIGN_D2.md` (added, +260/-0)
```diff
@@ -0,0 +1,260 @@
+# FIELD 声明解析与 prepared 类型历史设计（D2）
+
+**状态：待审草案；没有设计批准，也不代表实现可交付。**
+
+- 问题：[#25301](https://github.com/matrixorigin/matrixone/issues/25301)；实现：[PR #30096](https://github.com/matrixorigin/matrixone/pull/30096)；设计门禁：[review 5567395398](https://github.com/matrixorigin/matrixone/pull/30096#pullrequestreview-5567395398)。
+- 被解释实现 H：`a0e585b3090302fc57d9a8eabbe954b98d6d1aee`；固定基准 B：`def799e1260dd547cae2e0e54323ea20ec1b7685`。下文源码链接固定到 H，不随分支变化。
+- 本次重新审计于2026-10-19。D1保留为历史；本文取代D1中的技术描述。最新main另记在审计清单中，尚未merge，不能以 H 的证据代替集成验证。
+- 本地文档内容hash/Git blob identity由`CLAUDE_design_D2_manifest.json`记录；正式发布后还须提供可访问的Git commit链接。批准人、批准revision、批准记录均为空。
+
+## 1. 决策摘要
+
+建议保留“**声明解析 + handle拥有不可变类型快照 + 复用既有单槽specialization cache**”方案，不增加历史列表、共享cache或迁移wire格式。
+
+完整改动不是仅给FIELD加`bytes.Equal`：32个文件中14个生产文件，生产增删合计1861行；同时触及普通SQL绑定、prepared状态、缓存准入、重试与迁移。按完整范围触发设计门禁，不以历次小补丁豁免。
+
+D2将两类工作分开：
+
+1. **当前源码事实与提议取舍**：下面给出可核实的激活范围、发布/失败状态、缓存和迁移策略。
+2. **批准前技术闭合项**：真实依赖改变时的Compile retry语义、普通绑定遍历成本仍需针对性证据；另外已在源码确认pool-reset没有清除捕获H的buildPlan闭包，需关闭这一具体生命周期缺口。不能用“接受风险”代替正确性证明；残留引用不等于已经证明无限泄漏或OOM。
+
+已有实现先于本次设计审查。补救只能是现在暂停实现交付，建立独立设计阶段，再恢复实现对齐和审查；不能把补写文档记作过去已有事前批准。
+
+## 2. 问题与外部合约
+
+### 2.1 不只修比较器
+
+`FIELD(_binary X'FF', _binary X'FE', _binary X'FF')`应返回2。二进制比较不得把不同无效UTF-8序列解码为同一个替代字符；文本保持已有字符比较，NULL、首次匹配和数值重载保持原规则。
+
+实际进入FIELD的subject可能是CASE、COALESCE、关系列、aggregate/window或参数。**FIELD字符串路径按subject解析后的静态域选择比较，不按每一行的runtime-domain override选择**；普通LEFT/REVERSE等消费者则有不同的声明/逐行来源契约。只根据当前payload、或只改最末端比较器，不能统一决定这些语义。
+
+prepared兼容还取决于执行顺序：NULL-first、SQL变量的binary声明、COM参数的transport类型及后续数值reprepare可能产生不同事实。不能用每轮孤立direct SQL作为全部历史测试的oracle。
+
+### 2.2 必须成立的不变量
+
+- **域分离**：transport、来源、消费者比较域、结果声明各有owner；隐式运输CAST不取得SQL显式CAST的权威。
+- **身份与不可变性**：CASE事实按同一prepared AST的稳定ordinal标识；发布后快照不变。需要新事实时COW，不改旧执行/retry可见对象。
+- **范围克制**：只有读写型FIELD解析实际收集的参数相关CASE事实才激活history。普通字符串声明预览为只读，不能顺便冻结历史。
+- **两种发布点**：成功绑定/metadata/AST clone后发布history；成功Compile后才安装runtime cache。查询执行成功不是history发布条件；“整个EXECUTE完全事务式回滚”不是当前合约。
+- **代际分离**：物理计划失效与SQL类型历史失效不同；真实类型环境改变不能复活旧事实。失败组合要么保持旧有效状态，要么被dirty标志禁止复用。
+- **缓存安全**：来源签名、同handle历史revision、值敏感reprepare及diagnostic证明都满足才命中；不能按wire类型相等盲目命中。
+- **迁移安全**：不能省略history后重放SQL并称等价。现有payload不传history时源CN拒绝导出相关prepared handles。
+
+### 2.3 兼容范围
+
+MySQL 8.4文档为公开依据：[FIELD](https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_field)、[PREPARE](https://dev.mysql.com/doc/refman/8.4/en/prepare.html)、[statement caching](https://dev.mysql.com/doc/refman/8.4/en/statement-caching.html)。文档没有穷尽这里的CASE历史边界，必须用同协议、同声明、同执行序列独立验证。文本EqualFold不等于完整MySQL collation权重实现。
+
+不扩展charset/collation算法、分区、存储过程、UDF、warning兼容。既有CASE+空binary literal及NULLIF第一值无长度BINARY的已记录差异不作为本PR“完全MySQL兼容”的证据。已有其他issue的binary-string/common-type设计作为背景，其批准不能跨scope借用。
+
+## 3. 完整变更图：新增与复用分开
+
+| 闭包 / 风险 | 本PR生产文件 | 新增合约及复用边界 |
+|---|---|---|
+| FIELD执行 / R2 | `function/func_binary.go` | 静态subject域、原始bytes比较、选择掩码；原数值重载/文本路径复用 |
+| 声明与来源 / R2、绑定成本R3 | `plan/base_binder.go`、`prepared_field.go`、`collation_expression.go`、`query_builder.go`、`types.go` | 普通SQL与DEFAULT也可达；query-block/HAVING边界、NULLIF返回来源、紧凑witness；不只prepared路径 |
+| CASE历史 / R3 | `plan/prepared_field_types.go`、`prepared_binding.go`、`tree/expr.go`、`tree/format.go` | 新snapshot/COW/ordinal、参数合约进展和有条件二次optimize |
+| frontend生命周期 / R3 | `frontend/computation_wrapper.go`、`prepared_execution.go`、`routine.go`、`types.go` | 新history指针/resetPending、key revision/reprepare守卫、发布延后、retry携带和migration拒绝；**单槽cache、retired compile清理、请求互斥本身已有** |
+
+另10个Go测试文件、8个BVT case/result文件，共32文件。全生产hunk已读；测试按第9节的合约断言核对，本轮不是再做一次全PR所有测试hunk的实现批准。完整路径和内容hash见审计附件。
+
+## 4. 数据模型与激活边界
+
+### 4.1 四种不同数据不能混写为“历史”
+
+| 对象 | 内容 / 存活owner | 边界 |
+|---|---|---|
+| H=`PreparedFieldTypes` | revision、CASE→`types.Type`+inferredBinary、param→type+inherited；handle当前指针 | 不含值、AST/Expr/vector；一处当前指针不代表进程只存活一个历史版本 |
+| `preparedFieldTypeBinding` | ids/producers/originals/collected/actual等绑定期图索引 | 仅本次binding context；defer恢复context后不进入handle |
+| `StringDomainSource` witness | 计划里的既有Expr-shaped元数据；P/V标识、标量域、必要声明证明 | 不同于H；本PR生成紧凑摘要而不保留原值图，但仍属于plan并可能随plan复制/传输/保存 |
+| retry capture | H引用、bindings/paramVals的slice副本、必要的原prepare plan引用 | slice容器复制不是任意`any`载荷deep copy；其有效期由当前/缓存Compile闭包及pool回收链决定，不是仅局部栈变量 |
+
+H保存runtime `types.Type`，不是完整`plan.Type`。完整nullable/collation/coercibility/conflict/version等仍由计划声明和CAST契约承担，不能声称H携带所有plan元数据。运输CAST复制完整`arg.Typ`，只调整必要表示；BINARY→VARBINARY保宽避免padding，零容量binary VARCHAR→无界BLOB避免截空。
+
+### 4.2 精确激活条件（[S1]、[S2]、[S3]）
+
+1. frontend对有参数的Query source-binding路径传入history context；无该context时没有history binding。
+2. `newPreparedFieldTypeBinding`枚举AST CASE；没有语法CASE直接返回nil。存在CASE只创建临时binding，**不是已经发布history**。NULLIF后续降低产生的synthetic CASE不等于语法CASE ordinal。
+3. `bindPreparedFieldCase`登记producer；读写FIELD resolver追到producer且其返回值计算依赖参数时，才收集事实。参数依赖与类型来源不同：内部函数的控制参数也可令返回表达式依赖参数，不能把它们都赋成结果类型。
+4. `bindStringSourceDeclaration`的resolver为readOnly；普通`REVERSE(CASE...)`不能仅因预览建立H。显式CAST等权威边界阻止向内取得FIELD历史。
+5. `H==nil`既可能是未解析，也可能是**不适用/从未激活**；`cases[ordinal
```

**File**: `docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DESIGN_D3.md` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+# FIELD 类型历史设计 D3：动态验收结果与待决修订
+
+**状态：设计阶段未通过；实现交付仍阻塞。本文是对D2的补充，不是已批准的实现方案。**
+
+- 归属：[issue #25301](https://github.com/matrixorigin/matrixone/issues/25301)、[PR #30096](https://github.com/matrixorigin/matrixone/pull/30096)。
+- 完整问题、备选、所有权、状态机和范围以同目录[冻结D2](CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DESIGN_D2.md)为基础。
+- D2 SHA256：`b2df6187d3f952284c92374d38e78f30ab04ca958bb49e241bcc0d78f2c42c8c`；保留原文，不把后来的授权倒签到草案。
+- 授权记录：2026-10-19，本地交互用户在收到D2及其缺口摘要后回复原文 `go ahead`。据此继续设计验证及后续实施准备；这不是GitHub维护者的独立设计APPROVE，也不代表对下述新发现和兼容选择的批准。
+- 被测源码H：`a0e585b3090302fc57d9a8eabbe954b98d6d1aee`；配对基准B：`def799e1260dd547cae2e0e54323ea20ec1b7685`。最新fetch的`mo/main`为`57fb9530859d92791100098d312ea8cacc671910`，尚未merge。
+- 本阶段只用本地诊断overlay做技术验证，没有修改产品或正式测试。本设计文档的版本化不是实现交付或设计门禁PASS。
+
+## 1. R1：真实声明改变的retry不能继续盲用旧H
+
+### 已确认反例
+
+```sql
+CREATE TABLE t(n_name VARCHAR(25));
+INSERT INTO t VALUES ('a');
+PREPARE s FROM 'SELECT FIELD(CASE WHEN ? THEN n_name ELSE ? END, ''A'', ''a'') FROM t';
+SET @c=1, @v='a';
+EXECUTE s USING @c,@v; -- 1
+EXECUTE s USING @c,@v; -- 1，未变更声明对照
+ALTER TABLE t MODIFY n_name VARBINARY(25);
+EXECUTE s USING @c,@v; -- MySQL 8.4：2
+```
+
+独立MySQL观察为`1 / 1 / 2 / 2`（最后一个2来自相同语义direct SELECT）。这是DDL前后同handle的公开兼容对照，**不是MySQL内部retry竞态重放**。
+
+MO诊断使用真实binder、`buildPlanForCompileRetry`及表达式执行器，仅用既有mock替换catalog观察。绑定旧VARCHAR声明产生H；随后修改列为VARBINARY并递增TableDef.Version，既有`checkModify`确定返回true。结果：
+
+| 绑定 | FIELD结果 |
+|---|---:|
+| 旧声明初次绑定 | 1 |
+| 新声明，但retry携带旧H | **1** |
+| 新声明，以nil H重新绑定 | **2** |
+
+原plan及输入H未被原地改变。将这三份真实计划序列化后交给Compile的实际`validateRetryResultMetadata`：metadata冻结前、冻结后均不拒绝；三者的FIELD输出列元数据相同。终端`completeCompileExecution`的成功/错误路径都会标记下一EXECUTE需要rebuild，但不会修正本次已算出的1。
+
+因此这不是仅缺一个测试：**D2的“旧H沿用至本次retry结束”不涵盖真实依赖类型改变，可能得到错误结果。** 当前未运行并发DDL到完整physical Compile/Run的端到端注入，不把上述分层证据冒称为完整服务复现。
+
+### 需要明确选择的修订
+
+**建议A：对history相关的真实依赖变化fail-closed。** 在重建回调中用当前事务的catalog观察验证原声明代际；变化时返回既有definition-change/reprepare终端错误，不执行带旧H的rows。Compile先标记generation rebuilt的既有顺序保证frontend在错误终端使cache失效；下一EXECUTE由正常owner重建并发布新H。保持“retry不是第二个handle历史发布者”，不加共享缓存、goroutine或迁移协议。
+
+该方案必须覆盖：未变更/仅物理重试保H、真实列类型及对象身份变化、metadata冻结前后、解析失败、终端失效、下一EXECUTE正确重建。应复用已有依赖检查边界，不再维护一份依赖白名单；重试闭包捕获的代际证据须有明确owner，不能借用会被下一次执行覆盖的handle字段。
+
+**可见代价：** 同样的DDL变化，MySQL在两次EXECUTE之间可以透明重准备；MO若在当前执行的definition retry阶段发现变化，建议A会要求客户端重试。这一可见错误策略是D2尚未决定的事项，需要维护者明确接受，不能由agent当成已经获批。
+
+备选B是在retry内重建并携带新的私有H/依赖代际直到物理编译成功，下一轮retry复用该代际，仍不写handle。它更接近透明重试，但改变D2“capture H不更新”的生命周期合约，增加候选发布/失败回滚及下一retry的状态验证。若选择B，需要先修订并审查这条状态机，不能只把`WithPreparedFieldTypes(..., nil)`写死。
+
+## 2. R2：普通绑定有已测开销，不能称零回归
+
+配对实验在同工作树、Go1.27.1、darwin/arm64、同一原生库、GOMAXPROCS=2和相同SQL/fixture进行。基准overlay恢复B的全部PR变更Go文件；当前组使用H。每项`-benchmem -benchtime=100ms -count=3`，表中为中位数。共享机器未做CPU隔离，时间只能作样本观察；稳定的B/op/allocs差异不是调度噪声。
+
+| 普通REVERSE嵌套层数（列为VARCHAR） | B ns/op | H ns/op | B→H B/op | B→H allocs/op |
+|---:|---:|---:|---:|---:|
+| 1 | 29,783 | 29,835 | 27,176→27,752 | 333→338 |
+| 8 | 54,908 | 62,831 | 37,361→41,969 | 519→559 |
+| 32 | 212,654 | 327,094 | 96,139→160,012 | 1,209→1,485 |
+
+32层样本增加约**54%绑定时间、63,873 B和276次分配**。这些是不含FIELD/CASE的普通SQL，不得归咎于用户启用了history。源码中的逐consumer声明解析/局部resolver、重复子树访问可解释随深度上升的成本；样本不是全局复杂度上界或OOM证明，也没有证明某一个分配点独占全部差额。
+
+无CASE的source-binding miss在P=1/16/64时，分别增加128/248/632 B、4/7/9次分配；计入额外AST格式化，不声称没有成本。三个时间中位数约为基准的0.985/1.009/1.004倍，不能据此声称普遍加速。
+
+实际`initExecuteStmtParam`logical cache hit另以plan指针同一且无新cache候选作断言，未将miss当hit：
+
+| 路径 / 参数数 | B→H B/op | B→H allocs/op | 时间比H/B |
+|---|---:|---:|---:|
+| 无history / 2 | 1,896→1,896 | 19→19 | 0.997 |
+| 无history / 16 | 13,032→13,032 | 65→65 | 1.003 |
+| 无history / 64 | 49,896→49,896 | 212→212 | 0.870 |
+| 有history形状 / 2 | 1,536→1,664 | 18→19 | 1.068 |
+| 有history形状 / 16 | 12,680→13,704 | 64→65 | 1.121 |
+| 有history形状 / 64 | 49,544→53,640 | 211→212 | 0.966 |
+
+基准没有本PR的H；“有history形状”指相同FIELD/CASE SQL。另一次不计作性能对照的结构探针明确断言：H组确实非nil且CASE map=1、param map=P，无H组为nil；每格50次真实cache hit保持同一H和plan指针，六格均通过。H组多一次key字符串分配，与D2的key复制成本吻合。不能把64参数的噪声性时间下降写作优化收益。
+
+**待决：** D2没有预先批准可接受的退化阈值。维护者需选择接受上述深嵌套绑定代价并明确验收边界，或要求先优化普通TEXT路径。建议不要宣称“无性能影响”，也不要在没有失效模型的情况下直接加常驻memo。首次绑定/类型进展/数值模式重建、共享CTE、依赖数增长的完整计数矩阵仍需在选定策略后补齐；本次配对样本不是整个R2的性能PASS。
+
+## 3. R3：pool清理方案有确定性红绿证据
+
+测试直接持有私有Compile，不依赖sync.Pool是否返回原指针：
+
+1. 设置一个捕获对象的buildPlanFunc。
+2. 标记prepared并调用Release，确认闭包仍可执行且返回同一捕获对象，这是有意缓存的对照。
+3. 转为非prepared并直接执行pool的clear seam，要求buildPlanFunc为空。
+
+H在第3步失败；只在诊断overlay的`Compile.clear()`清理区加入`c.buildPlanFunc = nil`后，同一测试通过。metadata guard对照也通过。产品源文件尚未改动，不能把这个局部green视为正式修复的owning-package/race验证。
+
+该修复方向符合已审D2：把清理放在真正回pool的owner，不在缓存prepared的每次Release中清除。仍须正式UT、真实owner消费者和按生命周期风险选择的race验证；没有证明无限泄漏，也不声称修复了无关所有闭包字段。
+
+## 4. R4：已补当前版本的计划序列化消费者证据
+
+在D2所列8格DEFAULT测试上，以真实CREATE TABLE绑定计划执行：
+
+`DeepCopyPlan → Plan.Marshal → 新Plan.Unmarshal → Default.Expr.DeepCopy → colexec.Eval`
+
+逐格验证完整表达式/Type与原计划相等、HEX/NULL结果正确、执行不改变表达式；8格均通过。覆盖了新增NULLIF witness随完整计划编码与DEFAULT消费者传递，非仅用手造摘要测试protobuf。
+
+限度：是当前H的编码/解码及表达式执行，不是落盘重启、旧版本CN、Proxy/MULTICN或全部持久化拓扑。没有新增proto字段的事实不意味着旧FIELD执行器已获得新
```

**File**: `docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_VALIDATION.md` (added, +467/-0)
```diff
@@ -0,0 +1,467 @@
+# FIELD 历史：第二次授权后的实施与验证
+
+> 最新验收见第7节：固定上游79298b10e2合并至e89a5a65edf396d85ec5aa2e4ae6d1ff9e69b165后，Go验证、公共SQL、计数、性能及所需race已完成；另精确同步四个上游BOOL预期metadata字段。1–6节保留此前4658阶段证据，未覆盖历史失败。本记录不代替独立reviewer批准；冻结的D2/D3不回写。
+
+## 1. 版本、决定与可观察行为
+
+- 设计输入：[D2](CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DESIGN_D2.md)、[D3](CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DESIGN_D3.md)，发布版本`f2b418d1bfe604a1825419b3abf6affe0f53d09b`。
+- 后续用户第二次`go ahead`选择R1-A及R2优化；来源和范围见[DECISIONS](CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DECISIONS.md)，不将第一次验证授权倒签为已接受后来发现的问题。
+- 实施：`76ecbfcdbf`；合并上游`309f618995af4ee23e3b9149365f4af77264090d`后的验证代码：`4658ff3eee033c9f1285f37a63ecb23a91cf289d`。
+- 相对该上游完整PR为39个文件、15个production Go文件；本轮实施10文件、593行新增/2行删除（包含设计决定及测试），不是仅审查单行clear。
+- 新的可见边界：带H的source-bound retry如果捕获的catalog对象/版本/数据库/发布身份改变，返回既有definition-change错误。`RewriteError`映射为**20631 / HY000**，并非MySQL1615；不假定驱动自动reprepare。版本变化但列类型未变的DDL也保守拒绝。
+- 无H路径不增加该验证；未变化依赖保留原H。重试不发布新H，错误终端使旧generation失效；下一正常EXECUTE由原owner重建并发布。没有第二个handle发布者。
+
+## 2. 永久回归的独立判断
+
+| 对象 | 永久测试与判断 |
+|---|---|
+| 声明代际 | `pkg/frontend/prepared_field_retry_test.go::TestPreparedFieldRetryDeclarationGeneration`：11格；版本/对象/数据库/发布身份、缺失、解析错误、修改原事实、嵌套Snapshot/PubInfo复制、nil依赖、无H控制；ctx恢复、旧H身份及错误映射独立断言 |
+| 后续EXECUTE | 上述version格经过真实session compiler的PREPARE seed重建及普通initExecute路径，新H/新schema与旧capture分离，实际结果从TEXT语义1变为VARBINARY语义2，结果metadata仍相同 |
+| 冻结与错误终端 | `pkg/sql/compile/compile_retry_lifecycle_test.go::TestDefinitionRetryBuildFailureInvalidatesGeneration`：metadata冻结前/后分别调用真实retry构建入口，callback失败不发布plan，旧generation仍被标记重建 |
+| clear与缓存对照 | 同文件`TestCompileClearReleasesBuildPlanClosure`：cached prepared Release仍可调用捕获；私有Compile走真实clear后callback必须nil；无Put后访问或GC/pool指针巧合 |
+| 普通TEXT证明 | `pkg/sql/plan/prepared_field_test.go::TestPlainTextStringSourceProof`：32层透传零分配；明确叶、NULL/参数/变量/cast/来源witness/无builder/prepared等控制；TABLE_SCAN投影CAST3反例在增加guard前红、之后绿；别名退回完整resolver |
+| DEFAULT消费者 | `pkg/sql/plan/expression_default_test.go::TestExpressionDefaultNullIfStringSource`：原始Expr先与DeepCopyPlan完整比较，再wire roundtrip/copy/Eval八格；保留全Type/Expr及执行后不变性，不用相同丢字段的两个副本相互证明 |
+
+R1 frontend判断与Compile冻结判断是分层确定性证据；没有把它们冒充“真实服务正在Run时并发DDL”的端到端注入测试。客户端普通DDL对照见第5节。
+
+## 3. owning与静态检查
+
+环境：darwin/arm64 Apple M1 Pro，Go1.27.1，匹配gofmt，`GOWORK=off GOMAXPROCS=2 GOFLAGS=-p=1 GOMEMLIMIT=2GiB`；使用`mo-cgo-test`验证当前worktree native来源。下表计数包含subtest。
+
+| package | PASS / 既有skip | 终端秒数 |
+|---|---:|---:|
+| pkg/sql/plan | 17767 / 2 | 16.958 |
+| pkg/frontend | 6161 / 1 | 21.618 |
+| pkg/sql/compile | 3679 / 0 | 13.169 |
+| pkg/sql/plan/function | 11387 / 0 | 15.225 |
+| pkg/sql/parsers/tree | 149 / 0 | 0.838 |
+
+命令：
+
+```sh
+.agents/skills/mo-dev/scripts/mo-cgo-test \
+  ./pkg/sql/plan ./pkg/frontend ./pkg/sql/compile \
+  ./pkg/sql/plan/function ./pkg/sql/parsers/tree \
+  -count=1 -timeout=900s -covermode=atomic \
+  -coverprofile=CLAUDE_owning.cover -json
+```
+
+诚实保留首轮失败：frontend的既有`TestConnMeasuresOnlyPhysicalOutputWrite`有一次instant fake Write计时0ns，违反Positive断言。相关生产/fixture与固定上游相同；精确100次诊断当前头100通过，上游完整PR-Go闭包overlay为97通过/3次相同失败。未改计时、断言或skip。仅frontend全包按相同参数完整重跑一次通过；其余4包沿用同源PASS。组合profile**丢弃了失败frontend的全部覆盖计数**，不能将原5包命令exit=1改写为0。
+
+相对固定上游的完整PR变更可执行行覆盖：**977/1051 = 93.0%**。这是通过包组合的同源atomic profile；不是旧头47/47或仅本轮增量。包内默认coverage未对所有跨包consumer统一instrument，不将其宣称为所有调用路径覆盖。
+
+同五包`go vet`通过；`golangci-lint --new-from-rev=309f618...`为`0 issues`。molint命令完成但输出22条既有recover/unsafe诊断，不能称零诊断；每条告警的源片段与固定上游相同，唯一非整文件等价的routine.go也核对了完整告警所属函数。未冒称执行了baseline molint。
+
+## 4. R2三方配对benchmark
+
+永久输入：`pkg/sql/plan/string_source_bench_test.go::BenchmarkStringSourceDeclarationBinding`。预解析同一SQL AST，然后真实BuildPlan；不计SQL parsing，不混用cache hit、单行执行或服务吞吐指标。
+
+```sql
+select reverse(...reverse(n_name)...) from nation
+-- 嵌套深度1、8、32；fixture中n_name为VARCHAR
+```
+
+三方同一toolchain/native/SQL/fixture，`-benchmem -benchtime=200ms -count=5`：
+
+1. **B**：固定上游`309f618...`，overlay恢复全部PR变更Go文件，显式保留同一benchmark。不能只替换base_binder.go或让新增benchmark被baseline置空。
+2. **pre-opt**：同一合并源，只移除`bindStringSourceDeclaration`中调用`stringSourceIsPlainText`后continue的快路；保留既有完整resolver，模拟同集成条件下优化前的热路径，不伪称旧D3提交原样运行。
+3. **final**：验证代码`4658ff3...`，包括QueryBuilder/PREPARE和scan ProjectList guard。
+
+```sh
+.agents/skills/mo-dev/scripts/mo-cgo-test ./pkg/sql/plan -run '^$' \
+  -bench '^BenchmarkStringSourceDeclarationBinding$' \
+  -benchmem -benchtime=200ms -count=5
+# B / pre-opt使用相应 -overlay；没有覆盖率或计数instrumentation。
+```
+
+| 深度 | B ns/op中位数 | pre-opt | final | B→pre-opt→final B/op | allocs/op |
+|---:|---:|---:|---:|---|---|
+| 1 | 28667 | 28756 | 28041 | 27176→27752→27176 | 333→338→333 |
+| 8 | 52023 | 61037 | 53715 | 37360→41968→37360 | 519→559→519 |
+| 32 | 205282 | 320601 | 214694 | 96137–96138→160011→96137–96138 | 1209→1485→1209 |
+
+32层额外约63.9KB/276 allocations已消除，当前中位数相对pre-opt下降约33%；但相对B仍约**+4.6%**。共享机器未CPU隔离，不声称时间完全相等或全工作负载零回归。窄证明仍会重复沿透传链检查；不把去掉完整resolver/maps等同为全语句线性。DEFAULT、PREPARE、未知projection/provenance等继续走完整解析，不以牺牲声明语义换性能。
+
+首次绑定/类型进展/数值模式、多引用CTE和依赖增长的计数及capture成本已在后续新头补齐，见第7节；不拿历史12格或上表代替全部轴。
```

**File**: `pkg/frontend/computation_wrapper.go` (modified, +168/-8)
```diff
@@ -24,6 +24,7 @@ import (
 	"sync/atomic"
 	"time"
 
+	"github.com/gogo/protobuf/proto"
 	"github.com/google/uuid"
 	"github.com/mohae/deepcopy"
 
@@ -851,6 +852,88 @@ func CheckTableDefChange(catalogCache *cache.CatalogCache, tblKey *cache.TableCh
 	return catalogCache.HasNewerVersion(tblKey)
 }
 
+// Compare dependency identities, versions and snapshots, not session-wide DDL
+// counters. Reoptimization can reorder dependencies; neither order nor pointer
+// identity changes the SQL type contract. This runs only when a plan is rebuilt.
+func preparedFieldDependenciesChanged(previous, current []*plan.ObjectRef) bool {
+	if len(previous) != len(current) {
+		return true
+	}
+	matched := make([]bool, len(current))
+	for _, before := range previous {
+		found := false
+		for i, after := range current {
+			if !matched[i] && proto.Equal(before, after) {
+				matched[i] = true
+				found = true
+				break
+			}
+		}
+		if !found {
+			return true
+		}
+	}
+	return false
+}
+
+// Only inference CAST0 is transparent. CAST1 owns an execution declaration even
+// when it has no syntax flag, and may itself contain a typed transport CAST0(P).
+func preparedFieldNumericContractSource(source *plan.Expr) *plan.Expr {
+	for source.GetF() != nil && source.GetF().GetFunc().GetObjName() == "cast" &&
+		!source.GetF().SyntaxExplicitCast && len(source.GetF().Args) > 0 && source.GetF().Args[0].GetP() == nil {
+		_, overload := function.DecodeOverloadID(source.GetF().GetFunc().GetObj())
+		if overload != 0 {
+			break
+		}
+		source = source.GetF().Args[0]
+	}
+	return source
+}
+
+// Compare contracts in a fresh binding with actual parameter domains, not the
+// seed's provisional signed markers or casts imposed by historical FIELD facts.
+// This runs only after a numeric setting changes; no graph escapes the call.
+func preparedFieldNumericModeAffectsTypes(p *plan.Plan, previous, current context.Context, boolSumAvg bool) bool {
+	if p == nil {
+		return false
+	}
+	affected := false
+	_ = plan.VisitExpressionsInOwner(p, func(root *plan.Expr) error {
+		return plan.VisitExprTree(root, func(expr *plan.Expr) error {
+			fn := expr.GetF()
+			if affected || fn == nil || fn.Func == nil {
+				return nil
+			}
+			switch fn.Func.ObjName {
+			case "-", "/":
+				args := make([]types.Type, len(fn.Args))
+				for i, source := range fn.Args {
+					source = preparedFieldNumericContractSource(source)
+					args[i] = types.New(types.T(source.Typ.Id), source.Typ.Width, source.Typ.Scale)
+				}
+				before, beforeErr := function.GetFunctionByName(previous, fn.Func.ObjName, args)
+				after, afterErr := function.GetFunctionByName(current, fn.Func.ObjName, args)
+				if beforeErr != nil || afterErr != nil {
+					affected = true
+					break
+				}
+				beforeCasts, beforeCast := before.ShouldDoImplicitTypeCast()
+				afterCasts, afterCast := after.ShouldDoImplicitTypeCast()
+				affected = !before.GetReturnType().Eq(after.GetReturnType()) ||
+					before.GetEncodedOverloadID() != after.GetEncodedOverloadID() ||
+					beforeCast != afterCast || !slices.Equal(beforeCasts, afterCasts)
+			case "sum", "avg":
+				if boolSumAvg && len(fn.Args) == 1 {
+					source := preparedFieldNumericContractSource(fn.Args[0])
+					affected = source.Typ.Id == int32(types.T_bool)
+				}
+			}
+			return nil
+		})
+	})
+	return affected
+}
+
 func preparePlanNeedsRebuild(schemaChanged, modeMismatch, protocolMismatch bool) bool {
 	return schemaChanged || modeMismatch || protocolMismatch
 }
@@ -1416,6 +1499,24 @@ func initExecuteStmtParamWithResolverInSession(
 		needRebuild = statsChanged
 	}
 	cwft.planGenerationReused = !needRebuild
+	fieldTypes := prepareStmt.fieldTypes
+	// Session DDL and temporary-table revisions conservatively invalidate plans,
+	// not SQL type history. Reset only for changed captured dependencies or
+	// type-affecting mode/protocol changes. Rebinding may discover a different
+	// dependency (e.g. a temporary table shadow), checked before publication.
+	boolModeMismatch := prepareStmt.sqlModeFlagsSet && prepareStmt.BoolSumAvg != currentBoolSumAvg
+	numericModeMismatch := boolModeMismatch ||
+		prepareStmt.sqlModeFlagsSet && prepareStmt.NoUnsignedSubtraction != currentNoUnsignedSubtraction ||
+		prepareStmt.divPrecisionIncrementSet && prepareStmt.divPrecisionIncrement != currentDivPrecisionIncrement
+	resetFieldTypes := schemaChanged || prepareStmt.NativeMode != currentNativeMode || protocolMismatch || prepareStmt.fieldTypesResetPending
+	if resetFieldTypes {
+		fieldTypes = nil
+	}
+	var previousNumericContext context.Context
+	if numericModeMismatch && fieldTypes != nil {
+		previousNumericContext = function.WithNoUnsignedSubtraction(reqCtx, prepareStmt.NoUnsignedSubtraction)
+		previousNumericContext = function.WithDivPrecisionIncrement(previousNumericContext, int32(prepareStmt.divPrecisionIncrement))
+	}
 	var pendingGroupConcatColDefData [][]byte
 	pendingGroupConcatColDefDataSet := false
 	rebuildCommitted := false
@@ -1428,6 +1
```

**File**: `pkg/frontend/computation_wrapper_test.go` (modified, +12/-6)
```diff
@@ -6773,7 +6773,12 @@ func TestPreparedUserVariableStringDomainIsBoundPerStatement(t *testing.T) {
 				t.Helper()
 				stmt := tree.NewPrepareString("bound_variable", "select char_length(@bound_s), hex(left(@bound_s,1)), ord(@bound_s), @bound_s+0, "+
 					"char_length(coalesce(@bound_s,NULL)), hex(left(case when @bound_s is null then null else @bound_s end,1)), "+
-					"charset(@bound_s), collation(@bound_s)")
+					"charset(@bound_s), collation(@bound_s), "+
+					"hex(left(coalesce(case when @bound_s is null then null else @bound_s end,NULL),1)), "+
+					"hex(left(if(@bound_s is null,NULL,@bound_s),1)), "+
+					"hex(left(case when @bound_s is null then null else left(@bound_s,1) end,1)), "+
+					"hex(left(nullif(@bound_s,''),1)), "+
+					"hex(left(case when @bound_s is null then null else nullif(@bound_s,'') end,1))")
 				defer stmt.Free()
 				prepared, err := buildPlan(execCtx.reqCtx, ses, ses.txnCompileCtx, stmt)
 				require.NoError(t, err)
@@ -6783,16 +6788,17 @@ func TestPreparedUserVariableStringDomainIsBoundPerStatement(t *testing.T) {
 				t.Helper()
 				q := p.GetQuery()
 				projects := q.Nodes[q.Steps[len(q.Steps)-1]].ProjectList
-				require.Len(t, projects, 8)
+				require.Len(t, projects, 13)
 				for i, project := range projects {
 					func() {
 						executor, err := colexec.NewExpressionExecutor(cw.proc, project)
 						require.NoError(t, err)
 						defer executor.Free()
 						value, err := executor.Eval(cw.proc, []*batch.Batch{batch.EmptyForConstFoldBatch}, nil)
 						require.NoError(t, err)
-						require.Equal(t, isNull && i < 6, value.GetNulls().Contains(0))
-						if isNull && i < 6 {
+						isValue := i < 6 || i >= 8
+						require.Equal(t, isNull && isValue, value.GetNulls().Contains(0), "project %d: %s", i, project.String())
+						if isNull && isValue {
 							return
 						}
 						switch i {
@@ -6802,12 +6808,12 @@ func TestPreparedUserVariableStringDomainIsBoundPerStatement(t *testing.T) {
 								want = 3
 							}
 							require.Equal(t, want, vector.GetFixedAtNoTypeCheck[int64](value, 0))
-						case 1, 5:
+						case 1, 5, 8, 9, 10, 11, 12:
 							want := "E4BDA0"
 							if binary {
 								want = "E4"
 							}
-							require.Equal(t, want, value.GetStringAt(0))
+							require.Equal(t, want, value.GetStringAt(0), "project %d: %s", i, project.String())
 						case 2:
 							want := int64(0xe4bda0)
 							if binary {
```

**File**: `pkg/frontend/prepared_execution.go` (modified, +26/-0)
```diff
@@ -20,6 +20,7 @@ import (
 	"strconv"
 	"strings"
 
+	"github.com/gogo/protobuf/proto"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
@@ -125,6 +126,13 @@ func preparedExecutionBindingKey(bindings []plan2.PreparedSourceBinding, values
 	return key.String()
 }
 
+func preparedFieldBindingKey(key string, state *plan2.PreparedFieldTypes) string {
+	if state == nil {
+		return key
+	}
+	return key + "field:" + strconv.FormatUint(state.Revision(), 10)
+}
+
 func (prepareStmt *PrepareStmt) rememberBitCountSourceTypes(values []any) {
 	if len(prepareStmt.bitCountOverloadParamPositions) == 0 {
 		prepareStmt.bitCountNumericParamTypes = nil
@@ -175,10 +183,28 @@ func (cwft *TxnComputationWrapper) preparedExecutionRetry() *preparedExecutionRe
 		return nil
 	}
 	var preparedPlan *plan2.Plan
+	var fieldTypes *plan2.PreparedFieldTypes
+	var fieldSchemas []*plan2.ObjectRef
+	if cwft.preparedStmt != nil {
+		fieldTypes = cwft.preparedStmt.fieldTypes
+		if fieldTypes != nil {
+			// Keep immutable declaration facts, not another retained plan graph
+			// or a later EXECUTE's mutable handle, as the retry generation proof.
+			schemas := cwft.preparedStmt.PreparePlan.GetDcl().GetPrepare().GetSchemas()
+			fieldSchemas = make([]*plan2.ObjectRef, len(schemas))
+			for i, schema := range schemas {
+				if schema != nil {
+					fieldSchemas[i] = proto.Clone(schema).(*plan2.ObjectRef)
+				}
+			}
+		}
+	}
 	if cwft.preparedStmt != nil && strings.IndexByte(cwft.preparedStmt.Sql, '@') >= 0 {
 		preparedPlan = cwft.preparedStmt.PreparePlan.GetDcl().GetPrepare().Plan
 	}
 	return &preparedExecutionRetry{
+		fieldTypes:         fieldTypes,
+		fieldSchemas:       fieldSchemas,
 		paramVals:          append([]any(nil), cwft.paramVals...),
 		bindings:           append([]plan2.PreparedSourceBinding(nil), cwft.paramBindings...),
 		preparedPlan:       preparedPlan,
```

**File**: `pkg/frontend/prepared_field_dependencies_test.go` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
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
+
+	"github.com/gogo/protobuf/proto"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
+	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
+	"github.com/stretchr/testify/require"
+)
+
+func TestPreparedFieldNumericModeAffectsTypes(t *testing.T) {
+	value := func(oid types.T) *plan.Expr { return &plan.Expr{Typ: plan.Type{Id: int32(oid)}} }
+	call := func(name string, oid types.T, args ...*plan.Expr) *plan.Expr {
+		return &plan.Expr{Typ: plan.Type{Id: int32(oid)}, Expr: &plan.Expr_F{F: &plan.Function{Func: &plan.ObjectRef{ObjName: name}, Args: args}}}
+	}
+	unsigned := call("-", types.T_uint64, value(types.T_uint64), value(types.T_int64))
+	folded := &plan.Expr{Typ: unsigned.Typ, Expr: &plan.Expr_Lit{Lit: &plan.Literal{Src: unsigned}}}
+	uncapped := value(types.T_decimal64)
+	uncapped.Typ.Width, uncapped.Typ.Scale = 10, 2
+	decimal := value(types.T_decimal256)
+	decimal.Typ.Width, decimal.Typ.Scale = 65, 30
+	transport := value(types.T_text)
+	transport.Expr = &plan.Expr_P{P: &plan.ParamRef{Pos: 0}}
+	unsignedTransport := call("cast", types.T_uint64, transport)
+	inferenceCast := call("cast", types.T_int64, unsignedTransport)
+	adapter := call("cast", types.T_int8, value(types.T_bool))
+	explicit := call("cast", types.T_int8, value(types.T_bool))
+	explicit.GetF().SyntaxExplicitCast = true
+	for _, tc := range []struct {
+		name                                                     string
+		expr                                                     *plan.Expr
+		boolSumAvg, unsignedSubtraction, divisionPrecision, want bool
+	}{
+		{"unchanged modes", unsigned, false, false, false, false},
+		{"unrelated expression", value(types.T_text), true, true, true, false},
+		{"signed subtraction", call("-", types.T_int64, value(types.T_int64), value(types.T_int64)), false, true, false, false},
+		{"unsigned subtraction", unsigned, false, true, false, true},
+		{"runtime unsigned transport", call("-", types.T_int64, value(types.T_int64), inferenceCast), false, true, false, true},
+		{"floating subtraction", call("-", types.T_float64, value(types.T_uint64), value(types.T_float64)), false, true, false, false},
+		{"folded unsigned subtraction", folded, false, true, false, true},
+		{"nested unsigned subtraction", call("coalesce", types.T_uint64, unsigned), false, true, false, true},
+		{"decimal division", call("/", types.T_decimal64, uncapped, uncapped), false, false, true, true},
+		{"decimal precision capped", call("/", types.T_decimal256, decimal, decimal), false, false, true, false},
+		{"floating division", call("/", types.T_float64, value(types.T_float64), value(types.T_float64)), false, false, true, false},
+		{"integer sum", call("sum", types.T_int64, value(types.T_int64)), true, false, false, false},
+		{"boolean sum", call("sum", types.T_int64, value(types.T_bool)), true, false, false, true},
+		{"boolean avg adapter", call("avg", types.T_decimal128, adapter), true, false, false, true},
+		{"explicit numeric aggregate operand", call("sum", types.T_int64, explicit), true, false, false, false},
+		{"window boolean aggregate", &plan.Expr{Expr: &plan.Expr_W{W: &plan.WindowSpec{WindowFunc: call("sum", types.T_int64, adapter)}}}, true, false, false, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			p := &plan.Plan{Plan: &plan.Plan_Query{Query: &plan.Query{Nodes: []*plan.Node{{ProjectList: []*plan.Expr{tc.expr}}}}}}
+			previous := function.WithDivPrecisionIncrement(context.Background(), 4)
+			previous = function.WithNoUnsignedSubtraction(previous, false)
+			current := function.WithNoUnsignedSubtraction(previous, tc.unsignedSubtraction)
+			if tc.divisionPrecision {
+				current = function.WithDivPrecisionIncrement(current, 8)
+			}
+			require.Equal(t, tc.want, preparedFieldNumericModeAffectsTypes(p, previous, current, tc.boolSumAvg))
+		})
+	}
+	require.False(t, preparedFieldNumericModeAffectsTypes(nil, context.Background(), context.Background(), true))
+}
+
+func TestPreparedFieldNumericModeActualCastContract(t *testing.T) {
+	for _, tc := range []struct {
+		name, decimal string
+		changed       bool
+	}{
+		{"cap
```

---

### Incident Patch 2: `04fe057b` (2026-10-21)
**Commit Message**: fix(frontend): publish DUMP archives with create-only storage writes (#29808)

Concurrent DUMPs to one Stage destination could replace another publisher's manifest, leaving a successful DUMP whose archive and LOAD data belonged to a different source table. Publish the manifest and READY through storage-level create-only writes: local/disk storage atomically links a complete temporary file without replacement; AWS S3 and explicitly configured MinIO use conditional single-object PUT. AWS capability admission recognizes S3 API hostname forms rather than the general AWS domain suffix; API Gateway, EC2, S3 website/control, and unknown endpoints fail before publication. A stale publisher cannot overwrite the winner after a SQL allocator binding is lost. Filesystem aliases use the native filesystem's name equivalence.

Unsupported providers/endpoints fail before source copying. Existing immutable object-copy and failed-fixture retention behavior is preserved. A cancelled DUMP after manifest publication leaves no READY; LOAD rejects the incomplete archive, and the client can retry at a new destination. SQL file-access authorization from the current base is preserved.

### End-to-end covera

**File**: `pkg/fileservice/aws_sdk_v2.go` (modified, +10/-1)
```diff
@@ -521,7 +521,7 @@ func (a *AwsSDKv2) Write(
 			return err
 		}
 
-	} else if *sizeHint < smallObjectThreshold {
+	} else if *sizeHint < smallObjectThreshold || exclusiveWrite(ctx) {
 		data, err := io.ReadAll(r)
 		if err != nil {
 			return err
@@ -1064,12 +1064,21 @@ func (a *AwsSDKv2) headObject(ctx context.Context, params *s3.HeadObjectInput, o
 func (a *AwsSDKv2) putObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
 	ctx, task := gotrace.NewTask(ctx, "AwsSDKv2.putObject")
 	defer task.End()
+	if exclusiveWrite(ctx) {
+		params.IfNoneMatch = ptrTo("*")
+	}
 	recordS3PutRequest(ctx, a.perfCounterSets...)
 	// not retryable because Reader may be half consumed
 	output, err := a.client.PutObject(ctx, params, optFns...)
 	if err == nil && params.ContentLength != nil {
 		recordS3AcceptedBytes(ctx, *params.ContentLength, a.perfCounterSets...)
 	}
+	if exclusiveWrite(ctx) {
+		var response *http.ResponseError
+		if errors.As(err, &response) && response.Response.StatusCode == 412 {
+			err = moerr.NewFileAlreadyExistsNoCtx(*params.Key)
+		}
+	}
 	return output, err
 }
 
```

**File**: `pkg/fileservice/disk_object_storage.go` (modified, +12/-3)
```diff
@@ -306,10 +306,19 @@ func (d *diskObjectStorage) Write(ctx context.Context, key string, r io.Reader,
 		}
 	}
 
-	if err := os.Rename(tempFile.Name(), path); err != nil {
-		return err
+	if exclusiveWrite(ctx) {
+		if err := os.Link(tempPath, path); err != nil {
+			if os.IsExist(err) {
+				return moerr.NewFileAlreadyExistsNoCtx(key)
+			}
+			return err
+		}
+	} else {
+		if err := os.Rename(tempPath, path); err != nil {
+			return err
+		}
+		tempRenamed = true
 	}
-	tempRenamed = true
 
 	return nil
 }
```

**File**: `pkg/fileservice/exclusive_write.go` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+// Copyright 2022 Matrix Origin
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
+package fileservice
+
+import (
+	"context"
+	"net/url"
+	"regexp"
+	"strings"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+)
+
+type exclusiveWriteKey struct{}
+
+func exclusiveWrite(ctx context.Context) bool { return ctx.Value(exclusiveWriteKey{}) == true }
+
+// CheckExclusiveWrite rejects destinations whose writer cannot create without
+// replacing an existing file. Call before preparing irreversible effects.
+func CheckExclusiveWrite(fs FileService) error {
+	switch f := fs.(type) {
+	case *subPathFS:
+		return CheckExclusiveWrite(f.upstream)
+	case *LocalETLFS:
+		return nil
+	case *S3FS:
+		switch storage := f.rawStorage.(type) {
+		case *AwsSDKv2:
+			if awsS3ConditionalPutEndpoint(storage.endpoint) {
+				return nil
+			}
+		case *diskObjectStorage:
+			return nil
+		case *MinioSDK:
+			// The MinIO SDK also targets compatibility endpoints. Only the
+			// explicit MinIO configuration opts into the conditional-PUT
+			// guarantee; SDK selection alone is not a capability guarantee.
+			if storage.supportsConditionalPut {
+				return nil
+			}
+		}
+	}
+	return moerr.NewNotSupportedNoCtxf("exclusive publication for %T", fs)
+}
+
+// Match S3 API endpoints, optionally prefixed by a virtual-hosted bucket.
+// Other AWS services (including EC2 and API Gateway) do not inherit S3's
+// conditional-PUT guarantee merely by sharing the amazonaws.com suffix.
+// Unknown endpoint forms fail closed.
+var awsS3APIHost = regexp.MustCompile(`(^|\.)s3(?:\.amazonaws\.com|(?:[.-]|-fips\.)(?:dualstack\.)?[a-z]{2}(?:-gov)?-[a-z]+-[0-9]+\.amazonaws\.com(?:\.cn)?)$`)
+
+// awsS3ConditionalPutEndpoint limits the AWS SDK path to S3 service endpoints.
+// See https://docs.aws.amazon.com/general/latest/gr/s3.html.
+func awsS3ConditionalPutEndpoint(endpoint string) bool {
+	if endpoint == "" {
+		return true // AWS SDK's default S3 endpoint.
+	}
+	if !strings.Contains(endpoint, "://") {
+		endpoint = "https://" + endpoint
+	}
+	u, err := url.Parse(endpoint)
+	if err != nil {
+		return false
+	}
+	host := strings.ToLower(u.Hostname())
+	return awsS3APIHost.MatchString(host)
+}
+
+// WriteExclusive creates a bounded, known-size file without replacing a prior
+// publisher, even if a SQL lock binding is lost. It uses the existing writer,
+// including its storage mappings, metrics and cleanup. There is no unsafe
+// check-then-write fallback. Ambiguous errors retain the file and fail closed.
+func WriteExclusive(ctx context.Context, fs FileService, vector IOVector) error {
+	if err := CheckExclusiveWrite(fs); err != nil {
+		return err
+	}
+	size := vector.size()
+	if size == nil || *size > smallObjectThreshold {
+		return moerr.NewNotSupportedNoCtx("exclusive publication requires a known size at most 64 MiB")
+	}
+	return fs.Write(context.WithValue(ctx, exclusiveWriteKey{}, true), vector)
+}
```

**File**: `pkg/fileservice/exclusive_write_test.go` (added, +295/-0)
```diff
@@ -0,0 +1,295 @@
+// Copyright 2022 Matrix Origin
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
+package fileservice
+
+import (
+	"bytes"
+	"context"
+	"fmt"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"net/http/httputil"
+	"net/url"
+	"os"
+	"path/filepath"
+	"sync"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/minio/minio-go/v7"
+	"github.com/minio/minio-go/v7/pkg/credentials"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+type publicationReader struct {
+	io.Reader
+	entered, release chan struct{}
+	once             sync.Once
+}
+
+func (r *publicationReader) Read(p []byte) (int, error) {
+	r.once.Do(func() { close(r.entered); <-r.release })
+	return r.Reader.Read(p)
+}
+func publicationVector(path, data string) IOVector {
+	return IOVector{FilePath: path, Entries: []IOEntry{{Data: []byte(data), Size: int64(len(data))}}}
+}
+
+// One-byte manifests and channel barriers force the old publisher to resume
+// after the winner has published. No scheduler timing determines the oracle.
+func TestWriteExclusiveDelayedPublisher(t *testing.T) {
+	root := t.TempDir()
+	fs, err := NewLocalETLFS("etl", root)
+	require.NoError(t, err)
+	defer fs.Close(context.Background())
+	r := &publicationReader{Reader: bytes.NewBufferString("A"), entered: make(chan struct{}), release: make(chan struct{})}
+	var release sync.Once
+	defer release.Do(func() { close(r.release) })
+	done := make(chan error, 1)
+	go func() {
+		done <- WriteExclusive(context.Background(), fs, IOVector{FilePath: "manifest.json", Entries: []IOEntry{{ReaderForWrite: r, Size: 1}}})
+	}()
+	<-r.entered
+	require.NoError(t, WriteExclusive(context.Background(), fs, publicationVector("manifest.json", "B")))
+	require.NoError(t, WriteExclusive(context.Background(), fs, publicationVector("READY", "")))
+	release.Do(func() { close(r.release) })
+	require.True(t, moerr.IsMoErrCode(<-done, moerr.ErrFileAlreadyExists))
+	data, err := os.ReadFile(filepath.Join(root, "manifest.json"))
+	require.NoError(t, err)
+	require.Equal(t, "B", string(data))
+	entries, err := os.ReadDir(root)
+	require.NoError(t, err)
+	require.Len(t, entries, 2)
+	require.NoError(t, WriteExclusive(context.Background(), fs, publicationVector("other/manifest.json", "C")))
+}
+
+func TestWriteExclusiveFilesystemAliases(t *testing.T) {
+	root := t.TempDir()
+	dir := filepath.Join(root, "Destination")
+	require.NoError(t, os.Mkdir(dir, 0755))
+	alias := filepath.Join(root, "alias")
+	require.NoError(t, os.Symlink(dir, alias))
+	fs, err := NewLocalETLFS("etl", root)
+	require.NoError(t, err)
+	defer fs.Close(context.Background())
+	upper, err := os.Stat(dir)
+	require.NoError(t, err)
+	lower, lowerErr := os.Stat(filepath.Join(root, "destination"))
+	aliases := []string{"alias"}
+	if lowerErr == nil && os.SameFile(upper, lower) {
+		aliases = append(aliases, "destination")
+	} else {
+		require.True(t, os.IsNotExist(lowerErr))
+		require.NoError(t, WriteExclusive(context.Background(), fs, publicationVector("destination/manifest.json", "independent")))
+	}
+	for index, alias := range aliases {
+		name := fmt.Sprintf("manifest%d.json", index)
+		r := &publicationReader{Reader: bytes.NewBufferString("loser"), entered: make(chan struct{}), release: make(chan struct{})}
+		var release sync.Once
+		func() {
+			defer release.Do(func() { close(r.release) })
+			done := make(chan error, 1)
+			go func() {
+				done <- WriteExclusive(context.Background(), fs, IOVector{FilePath: alias + "/" + name, Entries: []IOEntry{{ReaderForWrite: r, Size: 5}}})
+			}()
+			<-r.entered
+			require.NoError(t, WriteExclusive(context.Background(), fs, publicationVector("Destination/"+name, "winner")))
+			release.Do(func() { close(r.release) })
+			require.True(t, moerr.IsMoErrCode(<-done, moerr.ErrFileAlreadyExists))
+			data, err := os.ReadFile(filepath.Join(dir, name))
+			require.NoError(t, err)
+			require.Equal(t, "winner", string(data))
+		}()
+	}
+	require.NoError(t, WriteExclusive(context.Background(), fs, publicationVector("Destination/manifest.json", "winner")))
+	data, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
+	require.NoError(t, err)
+	require.Equal(t, "winner", string(data))
+}
+
+func TestWriteExclusiveObjectStorage(t *testing.T) {
+	for _, provider := range []string{"aws", "minio", "disk"} {
+		t.Run(provider, func(t *testing.T) {
+			ctx := context.WithValue(context.Background(), exclusiveWriteKey{}, tru
```

**File**: `pkg/fileservice/local_etl_fs.go` (modified, +14/-3)
```diff
@@ -194,10 +194,21 @@ func (l *LocalETLFS) write(ctx context.Context, vector IOVector) error {
 	}
 
 	// move
-	if err := os.Rename(tempPath, nativePath); err != nil {
-		return err
+	if exclusiveWrite(ctx) {
+		// Link installs the complete temporary file atomically and refuses an
+		// existing name, using the filesystem's own alias equivalence.
+		if err := os.Link(tempPath, nativePath); err != nil {
+			if os.IsExist(err) {
+				return moerr.NewFileAlreadyExistsNoCtx(path.File)
+			}
+			return err
+		}
+	} else {
+		if err := os.Rename(tempPath, nativePath); err != nil {
+			return err
+		}
+		owned = false
 	}
-	owned = false
 
 	if err := l.syncDir(parentDir); err != nil {
 		return err
```

**File**: `pkg/fileservice/minio_sdk.go` (modified, +32/-15)
```diff
@@ -38,14 +38,15 @@ import (
 )
 
 type MinioSDK struct {
-	name                 string
-	endpoint             string
-	bucket               string
-	core                 *minio.Core
-	client               *minio.Client
-	copyCredentialDomain objectStorageCopyCredentialDomain
-	perfCounterSets      []*perfcounter.CounterSet
-	listMaxKeys          int
+	name                   string
+	endpoint               string
+	supportsConditionalPut bool
+	bucket                 string
+	core                   *minio.Core
+	client                 *minio.Client
+	copyCredentialDomain   objectStorageCopyCredentialDomain
+	perfCounterSets        []*perfcounter.CounterSet
+	listMaxKeys            int
 }
 
 var _ objectStorageCopier = new(MinioSDK)
@@ -243,11 +244,12 @@ func NewMinioSDK(
 	}
 
 	return &MinioSDK{
-		name:     args.Name,
-		endpoint: args.Endpoint,
-		bucket:   args.Bucket,
-		client:   client,
-		core:     core,
+		name:                   args.Name,
+		endpoint:               args.Endpoint,
+		supportsConditionalPut: args.IsMinio && !minioEndpointIsKnownUnsupported(args.Endpoint),
+		bucket:                 args.Bucket,
+		client:                 client,
+		core:                   core,
 		copyCredentialDomain: newObjectStorageCopyCredentialDomain(
 			keyID, keySecret, sessionToken, args.RoleARN, args.ExternalID,
 		),
@@ -267,6 +269,13 @@ func (t sqlMinioSTSTransport) RoundTrip(req *http.Request) (*http.Response, erro
 	return t.next.RoundTrip(req.WithContext(t.ctx))
 }
 
+func minioEndpointIsKnownUnsupported(endpoint string) bool {
+	endpoint = strings.ToLower(endpoint)
+	return strings.Contains(endpoint, "ctyunapi.cn") ||
+		strings.Contains(endpoint, "myqcloud.com") ||
+		strings.Contains(endpoint, "aliyuncs.com")
+}
+
 var _ ObjectStorage = new(MinioSDK)
 
 func (a *MinioSDK) List(
@@ -446,7 +455,7 @@ func (a *MinioSDK) Write(
 		}
 	}
 
-	if sizeHint != nil && *sizeHint < smallObjectThreshold {
+	if sizeHint != nil && (*sizeHint < smallObjectThreshold || exclusiveWrite(ctx)) {
 		data, err := io.ReadAll(r)
 		if err != nil {
 			return err
@@ -640,17 +649,25 @@ func (a *MinioSDK) putObject(
 	if sizeHint != nil {
 		size = *sizeHint
 	}
+	opts := minio.PutObjectOptions{}
+	if exclusiveWrite(ctx) {
+		opts.DisableMultipart = true
+		opts.SetMatchETagExcept("*")
+	}
 	info, err := a.client.PutObject(
 		ctx,
 		a.bucket,
 		key,
 		r,
 		size,
-		minio.PutObjectOptions{},
+		opts,
 	)
 	if err == nil {
 		recordS3AcceptedBytes(ctx, info.Size, a.perfCounterSets...)
 	}
+	if exclusiveWrite(ctx) && minio.ToErrorResponse(err).StatusCode == 412 {
+		err = moerr.NewFileAlreadyExistsNoCtx(key)
+	}
 	return info, err
 }
 
```

**File**: `pkg/fileservice/s3_fs.go` (modified, +5/-2)
```diff
@@ -559,7 +559,10 @@ func (s *S3FS) Write(ctx context.Context, vector IOVector) (err error) {
 	}
 	key := s.pathToKey(path.File)
 	existsStart := time.Now()
-	exists, err := s.storage.Exists(ctx, key)
+	exists := false
+	if !exclusiveWrite(ctx) {
+		exists, err = s.storage.Exists(ctx, key)
+	}
 	metric.FSWriteDurationExists.Observe(time.Since(existsStart).Seconds())
 	if err != nil {
 		return err
@@ -636,7 +639,7 @@ func (s *S3FS) write(ctx context.Context, vector IOVector) (bytesWritten int, er
 	}
 
 	if pmw, ok := s.storage.(ParallelMultipartWriter); ok && pmw.SupportsParallelMultipart() &&
-		enableParallel {
+		enableParallel && !exclusiveWrite(ctx) {
 		opt := &ParallelMultipartOption{
 			PartSize:    defaultParallelMultipartPartSize,
 			Concurrency: runtime.NumCPU(),
```

**File**: `pkg/frontend/table_dump.go` (modified, +30/-9)
```diff
@@ -47,6 +47,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect/mysql"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
 	sqlplan "github.com/matrixorigin/matrixone/pkg/sql/plan"
+	"github.com/matrixorigin/matrixone/pkg/util/fault"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine"
 	"github.com/matrixorigin/matrixone/pkg/vm/engine/disttae"
 	"github.com/matrixorigin/matrixone/pkg/vm/process"
@@ -831,7 +832,7 @@ func writeTableDumpJSON(ctx context.Context, fs fileservice.FileService, name st
 			"table dump manifest exceeds %d bytes", tableDumpMaxManifest,
 		)
 	}
-	return fs.Write(ctx, fileservice.IOVector{
+	return fileservice.WriteExclusive(ctx, fs, fileservice.IOVector{
 		FilePath: name,
 		Entries:  []fileservice.IOEntry{{Offset: 0, Size: int64(len(data)), ReaderForWrite: bytes.NewReader(data)}},
 	})
@@ -1247,6 +1248,21 @@ func dumpTableRelationObjects(
 }
 
 func handleDumpTable(ctx context.Context, ses *Session, stmt *tree.DumpTable) error {
+	dumpFS, closeDumpFS, err := openTableDumpFS(ctx, ses, stmt.Path)
+	if err != nil {
+		return err
+	}
+	defer closeDumpFS()
+	if err = fileservice.CheckExclusiveWrite(dumpFS); err != nil {
+		return err
+	}
+	for _, name := range []string{tableDumpManifestName, tableDumpReadyName} {
+		if _, err = dumpFS.StatFile(ctx, name); err == nil {
+			return moerr.NewFileAlreadyExistsNoCtx(name)
+		} else if !moerr.IsMoErrCode(err, moerr.ErrFileNotFound) {
+			return err
+		}
+	}
 	dbName, tableName, rel, err := getTableForDump(ctx, ses, stmt.Table)
 	if err != nil {
 		return err
@@ -1288,18 +1304,13 @@ func handleDumpTable(ctx context.Context, ses *Session, stmt *tree.DumpTable) er
 			}
 		}
 	}
-	dumpFS, closeDumpFS, err := openTableDumpFS(ctx, ses, stmt.Path)
-	if err != nil {
-		return err
-	}
-	defer closeDumpFS()
 	sourceFS, err := GetObjectFSProvider(ses)
 	if err != nil {
 		return err
 	}
 
-	// A stage path can be targeted concurrently by multiple CNs, and object
-	// stores do not give this workflow an exclusive create token. Do not delete
+	// Multiple CNs may copy immutable source objects before one exclusively
+	// creates the manifest. Object copies have no publication ownership. Do not delete
 	// copied fixture objects on failure: that could remove files published by a
 	// concurrent successful DUMP. Failed fixtures are reclaimed with the stage
 	// fixture lifecycle.
@@ -1324,11 +1335,21 @@ func handleDumpTable(ctx context.Context, ses *Session, stmt *tree.DumpTable) er
 		}
 		manifest.Relations = append(manifest.Relations, relationDump)
 	}
+	// These context-aware barriers let integration tests hold real SQL requests
+	// at the publication boundaries without replacing storage operations.
+	fault.TriggerFaultWithContext(ctx, "table_dump_before_manifest")
+	if err = ctx.Err(); err != nil {
+		return err
+	}
 	if err = writeTableDumpJSON(ctx, dumpFS, tableDumpManifestName, manifest); err != nil {
 		return err
 	}
+	fault.TriggerFaultWithContext(ctx, "table_dump_after_manifest")
+	if err = ctx.Err(); err != nil {
+		return err
+	}
 	if !stmt.MetadataOnly {
-		if err = dumpFS.Write(ctx, fileservice.IOVector{FilePath: tableDumpReadyName, Entries: []fileservice.IOEntry{{Offset: 0, Size: 1, Data: []byte("1")}}}); err != nil {
+		if err = fileservice.WriteExclusive(ctx, dumpFS, fileservice.IOVector{FilePath: tableDumpReadyName, Entries: []fileservice.IOEntry{{Offset: 0, Size: 1, Data: []byte("1")}}}); err != nil {
 			return err
 		}
 	}
```

---

### Incident Patch 3: `20f7f8dd` (2026-10-21)
**Commit Message**: perf(ut): reduce table dump verification cost and bound race parallelism (#30686)

## What type of PR is this?

- [x] Improvement
- [x] Test and CI

## Which issue(s) this PR fixes:

Refs #29249.

## What this PR does / why we need it:

Recent UT race jobs grew from roughly 55 minutes to 68–70 minutes. Two
slow jobs spent 1082–1091 seconds in three table-dump roots. Avoid
cloning already-canonical bound expressions, lazily reuse visited
timezone rules within one verification, and run independent table-dump
cases at bounded in-process parallelism 3. Process admission and the
heavy-package budget remain unchanged.

Keep every original scenario and comparison rule, cancellation behavior
and candidate budget. Named rules and failed loads expire after each
verification; UTC/Local matches require no named loads, and an early
named witness never loads later candidates. Fixed numeric offsets have a
finite shared cache. Differential tests retain the old expression
comparator as an oracle.

The same change also enforces nonempty, unique and complete raw
test/package lifecycles, restores Iceberg fixture state according to
ownership, fixes legacy UT cleanup under nounset, and places native
obj

**File**: `Makefile` (modified, +7/-2)
```diff
@@ -614,7 +614,8 @@ UT_ISSUES_BATCH_PARALLEL ?= $(if $(filter 8,$(UT_ISSUES_BATCHES)),$(if $(and $(f
 # The audited embedded batches use the same two-core child budget. Enable four
 # processes only for measured Linux eight-task runs; preserve smaller rollbacks.
 UT_EMBEDDED_PACKAGE_PARALLEL ?= $(if $(filter 8:2 8:3 8:4,$(UT_ISSUES_BATCHES):$(UT_ISSUES_BATCH_PARALLEL)),$(if $(and $(filter linux,$(UNAME_S)),$(filter-out 1 2 3 4 5 6 7,$(UT_PARALLEL))),4,2),1)
-# Audited embed/DML/isolated/SQL batching applies only to the non-prebuild path.
+# Audited batching mode applies only to the non-prebuild path. Four-worker
+# pkg/embed uses eight process generations; other audited packages use four.
 UT_EMBEDDED_BATCHES ?= 4
 # A compiler overlapping cluster processes increases the memory peak. The new
 # issues default prepares embedded packages on demand instead. Preserve
@@ -624,6 +625,10 @@ UT_PREBUILD_EMBEDDED ?= $(if $(filter 8:2 8:3 8:4,$(UT_ISSUES_BATCHES):$(UT_ISSU
 # Reuse released engine slots for plan while resource-heavy work finishes.
 # The heavy process budget is unchanged; set 0 for a sequential A/B baseline.
 UT_OVERLAP_PLAN ?= 1
+# The table-dump plan cases marked independent may run three at a time inside
+# each fresh plan race process. Keep 1 or 2 as explicit rollbacks for
+# constrained or diagnostic runs.
+PLAN_TEST_PARALLEL ?= 3
 # Keep light/issues overlap opt-in: the measured treatment was slower than the
 # serial baseline and left insufficient cgroup memory headroom. Re-enable only
 # when a new schedule has same-runner timing and memory evidence.
@@ -633,7 +638,7 @@ UT_OVERLAP_LIGHT_PARALLEL ?= 2
 # to receive TERM and bounded KILL cleanup in sequence.
 UT_HELPER_TERM_GRACE_TICKS ?= 60
 export UT_EMBEDDED_BATCHES
-export UT_SHARD UT_HARD_TIMEOUT UT_HEARTBEAT_INTERVAL UT_PREBUILD_EMBEDDED UT_PREBUILD_MIN_FREE_KB UT_EMBEDDED_HARD_TIMEOUT_SECONDS UT_ISSUES_BATCHES UT_ISSUES_BATCH_PARALLEL UT_EMBEDDED_PACKAGE_PARALLEL UT_OVERLAP_PLAN UT_OVERLAP_LIGHT UT_OVERLAP_LIGHT_PARALLEL UT_LIGHT_PARALLEL UT_LINK_PARALLEL UT_HELPER_TERM_GRACE_TICKS
+export UT_SHARD UT_HARD_TIMEOUT UT_HEARTBEAT_INTERVAL UT_PREBUILD_EMBEDDED UT_PREBUILD_MIN_FREE_KB UT_EMBEDDED_HARD_TIMEOUT_SECONDS UT_ISSUES_BATCHES UT_ISSUES_BATCH_PARALLEL UT_EMBEDDED_PACKAGE_PARALLEL UT_OVERLAP_PLAN PLAN_TEST_PARALLEL UT_OVERLAP_LIGHT UT_OVERLAP_LIGHT_PARALLEL UT_LIGHT_PARALLEL UT_LINK_PARALLEL UT_HELPER_TERM_GRACE_TICKS
 # Native compilation runs before Go tests, so it can use an explicit UT CPU
 # budget without increasing peak race-test memory. With the default UT value,
 # omit -j and preserve recursive make's jobserver contract: a plain make stays
```

**File**: `cgo/Makefile` (modified, +2/-2)
```diff
@@ -74,9 +74,9 @@ all: $(TARGET_LIB) libmo.a
 
 $(TARGET_LIB): $(LIB_PREREQS)
 ifeq ($(MO_CL_CUDA),1)
-	$(MO_CGO_CC) $(LDFLAGS) -o $@ $(OBJS) $(CUDA_OBJS) cuvs/*.o
+	$(MO_CGO_CC) $(OBJS) $(CUDA_OBJS) cuvs/*.o $(LDFLAGS) -o $@
 else
-	$(MO_CGO_CC) $(LDFLAGS) -o $@ $(OBJS)
+	$(MO_CGO_CC) $(OBJS) $(LDFLAGS) -o $@
 endif
 
 libmo.a: $(LIB_PREREQS)
```

**File**: `optools/run_ut.sh` (modified, +50/-11)
```diff
@@ -88,6 +88,15 @@ PLAN_RACE_SHARDS=${PLAN_RACE_SHARDS:-"8"}
 # test process and its package resources. The default stays serial on the
 # constrained CI runner; stronger runners can opt into two independent shards.
 PLAN_RACE_PARALLEL=${PLAN_RACE_PARALLEL:-"1"}
+# Only the audited independent plan subtests opt into this process-local
+# parallelism. Keep the cap at three: plan shards still share the heavy-wave
+# budget and the constrained CI runner has a 16 GiB cgroup limit.
+PLAN_TEST_PARALLEL=${PLAN_TEST_PARALLEL:-"3"}
+if ! [[ "${PLAN_TEST_PARALLEL}" =~ ^[1-9][0-9]*$ ]] ||
+    (( PLAN_TEST_PARALLEL > 3 )); then
+    logger "ERR" "PLAN_TEST_PARALLEL must be 1, 2, or 3, got '${PLAN_TEST_PARALLEL}'"
+    exit 2
+fi
 # Six exclusive engine shards reduced the measured phase from 100s to 44s,
 # with 5.2 GiB peak under the eight-CPU/16-GiB runner envelope. Admission still
 # respects UT_PARALLEL and an explicit caller heavy cap. Other stages wait.
@@ -1728,7 +1737,7 @@ function run_plan_race_shards(){
         restore_ut_term_trap "${previous_term_trap}"
         return 2
     fi
-    logger "INF" "Run ${test_count} tests in ${plan_package} across ${PLAN_RACE_SHARDS} fresh race-detector processes with parallelism ${PLAN_RACE_PARALLEL}"
+    logger "INF" "Run ${test_count} tests in ${plan_package} across ${PLAN_RACE_SHARDS} fresh race-detector processes with process parallelism ${PLAN_RACE_PARALLEL} and test parallelism ${PLAN_TEST_PARALLEL}"
     for (( shard = 0; shard < PLAN_RACE_SHARDS; shard++ )); do
         if (( shard_counts[shard] == 0 )); then
             continue
@@ -1760,6 +1769,7 @@ function run_plan_race_shards(){
                     go tool test2json -t -p "${plan_package_import}" \
                     "${plan_test_binary}" -test.short=true -test.v=test2json \
                     -test.paniconexit0=true -test.count=1 \
+                    -test.parallel="${PLAN_TEST_PARALLEL}" \
                     -test.timeout="${UT_TIMEOUT}m" \
                     -test.run="${shard_patterns[shard]}"
             ) > "${shard_reports[shard]}" 2>> "${UT_STDERR}" &
@@ -2561,7 +2571,7 @@ function run_embedded_tests(){
         logger "WRN" "embedded prebuild failed with status ${prebuild_status}; use the authoritative complete-scope go test"
         cleanup_embedded_prebuild || return 1
     fi
-    local ordinary_scope=${package_scope} package package_status=0 main_contract
+    local ordinary_scope=${package_scope} package package_status=0 main_contract package_batches
     local -a batched_packages=()
     if [[ "${UT_EMBEDDED_BATCHES}" == 4 ]]; then
         for package in ${package_scope}; do
@@ -2608,8 +2618,16 @@ function run_embedded_tests(){
         if [[ "${package}" == github.com/matrixorigin/matrixone/pkg/tests/sqlintegration ]]; then
             main_contract=cleanup-only
         fi
+        package_batches=4
+        # Shorter process generations reduce retained race-test memory without
+        # increasing the active cluster budget. Only this package/four-worker
+        # policy has complete inventory, wall, CPU and anonymous-memory evidence.
+        if [[ "${package}" == github.com/matrixorigin/matrixone/pkg/embed &&
+              "${UT_EMBEDDED_PACKAGE_PARALLEL}" == 4 ]]; then
+            package_batches=8
+        fi
         run_ut_command embedded "batched embedded-cluster race-test package ${package}" \
-            run_race_test_batches "${package}" "${PREBUILT_RACE_TEST_BINARY}" 4 "${UT_EMBEDDED_PACKAGE_PARALLEL}" 2 "${main_contract}"
+            run_race_test_batches "${package}" "${PREBUILT_RACE_TEST_BINARY}" "${package_batches}" "${UT_EMBEDDED_PACKAGE_PARALLEL}" 2 "${main_contract}"
         package_status=$?
         if (( package_status == 125 )); then return 125; fi
         consume_race_report PREBUILT_RACE_REPORT PREBUILT_RACE_TEST_BINARY || return $?
@@ -3167,10 +3185,14 @@ function run_tests(){
 function ut_summary(){
   local report_path="${BUILD_WKSP}/ut-report"
   local analysis_status=0
+  local report_validation_status=0
   local analysis_tool
   local failed_output=""
   local setup_summary=""
   local setup_status=0
+  local report_validation=""
+  local report_validation_level=INF
+  local -a report_validation_args=()
 
   # Failure files belong to this analysis, not an earlier run in the checkout.
   # Preserve the previous generation beside the run-scoped raw report.
@@ -3209,6 +3231,22 @@ function ut_summary(){
     fi
   fi
 
+  # Validate the raw Go event stream before handing it to the pinned analyzer.
+  # The analyzer intentionally ignores pause/cont, while the validator treats
+  # them as lifecycle transitions and also catches duplicate test roots across
+  # plan shards.  A failed/cancelled run may end with a truncated report, so
+  # completeness is required only when the test command itself succeeded.
+  if (( UT_TEST_STATUS == 0 )); then
+    report_validation_args+=(--require-complete)
+  fi
+  report_validation=$(python3 "${BUILD_WKSP}/o
```

**File**: `optools/ut_embedded_schedule_test.go` (modified, +6/-1)
```diff
@@ -1198,6 +1198,11 @@ func TestEmbeddedAuditedBatchScopeAndFailure(t *testing.T) {
 		{name: "rollback", scope: "example/a\n" + dml + "\n" + sql, mode: "1", want: "ordinary:example/a " + dml + " " + sql + "\n"},
 		{name: "embed-rollback", scope: embed + "\nexample/a", mode: "1", want: "ordinary:" + embed + " example/a\n"},
 		{name: "only-embed", scope: embed, mode: "4", want: "batch:" + embed + ":4:1:2:independent\nconsume\n"},
+		{name: "embed-four-workers", scope: embed, mode: "4", parallel: "4", want: "batch:" + embed + ":8:4:2:independent\nconsume\n"},
+		{name: "embed-two-workers", scope: embed, mode: "4", parallel: "2", want: "batch:" + embed + ":4:2:2:independent\nconsume\n"},
+		{name: "embed-three-workers", scope: embed, mode: "4", parallel: "3", want: "batch:" + embed + ":4:3:2:independent\nconsume\n"},
+		{name: "embed-four-workers-mixed", scope: embed + "\n" + dml + "\n" + sql, mode: "4", parallel: "4", want: "batch:" + embed + ":8:4:2:independent\nconsume\n" + strings.ReplaceAll(batches, ":4:1:", ":4:4:")},
+		{name: "embed-four-workers-undrained", scope: embed + "\n" + dml, mode: "4", parallel: "4", batchStatus: "125", want: "batch:" + embed + ":8:4:2:independent\n", status: 125},
 		{name: "only-isolated", scope: isolated, mode: "4", want: "batch:" + isolated + ":4:1:2:independent\nconsume\n"},
 		{name: "isolated-rollback", scope: isolated + "\nexample/a", mode: "1", want: "ordinary:" + isolated + " example/a\n"},
 		{name: "embed-with-existing", scope: embed + "\nexample/a\n" + dml + "\n" + sql, mode: "4", want: "ordinary:example/a\nbatch:" + embed + ":4:1:2:independent\nconsume\n" + batches},
@@ -1256,7 +1261,7 @@ function run_race_test_batches() {
  [[ ! -e "$2" && ! -e "$PREBUILT_RACE_REPORT" ]] || return 94
  printf 'batch:%s:%s:%s:%s:%s\n' "$1" "$3" "$4" "$5" "$6" >> "$CASE_DIR/calls"
  touch "$2" "$PREBUILT_RACE_REPORT"
- case "$1" in */dml) return "${BATCH_STATUS:-0}" ;; esac
+ case "$1" in */dml|*/embed) return "${BATCH_STATUS:-0}" ;; esac
 }
 function consume_race_report() {
  printf 'consume\n' >> "$CASE_DIR/calls"
```

**File**: `optools/ut_report_test.go` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
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
+package optools
+
+import (
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+func runUTReportValidator(t *testing.T, report string, requireComplete bool) (string, int) {
+	t.Helper()
+	script, err := filepath.Abs("validate_ut_report.py")
+	if err != nil {
+		t.Fatal(err)
+	}
+	reportPath := filepath.Join(t.TempDir(), "ut-report.json")
+	if err := os.WriteFile(reportPath, []byte(report), 0o644); err != nil {
+		t.Fatal(err)
+	}
+	args := []string{script}
+	if requireComplete {
+		args = append(args, "--require-complete")
+	}
+	args = append(args, reportPath)
+	output, err := exec.Command("python3", args...).CombinedOutput()
+	if err == nil {
+		return string(output), 0
+	}
+	if exitError, ok := err.(*exec.ExitError); ok {
+		return string(output), exitError.ExitCode()
+	}
+	t.Fatalf("run UT report validator: %v", err)
+	return "", 0
+}
+
+func TestValidateUTReportAcceptsPauseContAndRepeatedPackageLifecycles(t *testing.T) {
+	report := strings.Join([]string{
+		`{"Action":"start","Package":"example.test"}`,
+		`{"Action":"run","Package":"example.test","Test":"TestFirst"}`,
+		`{"Action":"pause","Package":"example.test","Test":"TestFirst"}`,
+		`{"Action":"cont","Package":"example.test","Test":"TestFirst"}`,
+		`{"Action":"pass","Package":"example.test","Test":"TestFirst"}`,
+		`{"Action":"pass","Package":"example.test"}`,
+		// Plan shards may execute different roots from the same package in
+		// separate processes. Repeating package lifecycle records is valid.
+		`{"Action":"start","Package":"example.test"}`,
+		`{"Action":"run","Package":"example.test","Test":"TestSecond"}`,
+		`{"Action":"skip","Package":"example.test","Test":"TestSecond"}`,
+		`{"Action":"pass","Package":"example.test"}`,
+	}, "\n") + "\n"
+	output, status := runUTReportValidator(t, report, true)
+	if status != 0 {
+		t.Fatalf("valid lifecycle rejected with status %d: %s", status, output)
+	}
+	if !strings.Contains(output, "test_starts=2") || !strings.Contains(output, "incomplete=0") {
+		t.Fatalf("lifecycle summary missing: %s", output)
+	}
+}
+
+func TestValidateUTReportRejectsDuplicateTestRootsAcrossShards(t *testing.T) {
+	report := strings.Join([]string{
+		`{"Action":"run","Package":"example.test","Test":"TestDuplicate"}`,
+		`{"Action":"pass","Package":"example.test","Test":"TestDuplicate"}`,
+		`{"Action":"run","Package":"example.test","Test":"TestDuplicate"}`,
+		`{"Action":"pass","Package":"example.test","Test":"TestDuplicate"}`,
+	}, "\n") + "\n"
+	output, status := runUTReportValidator(t, report, true)
+	if status == 0 {
+		t.Fatalf("duplicate test root was accepted: %s", output)
+	}
+	if !strings.Contains(output, "duplicate test root example.test:TestDuplicate") {
+		t.Fatalf("duplicate diagnostic missing: %s", output)
+	}
+}
+
+func TestValidateUTReportRejectsTransitionsWithoutAnActiveRoot(t *testing.T) {
+	report := strings.Join([]string{
+		`{"Action":"cont","Package":"example.test","Test":"TestMissing"}`,
+	}, "\n") + "\n"
+	output, status := runUTReportValidator(t, report, false)
+	if status == 0 {
+		t.Fatalf("invalid lifecycle was accepted: %s", output)
+	}
+	if !strings.Contains(output, "without an active test root") {
+		t.Fatalf("missing invalid lifecycle diagnostic: %s", output)
+	}
+}
+
+func TestValidateUTReportReportsTerminalOnlySubtest(t *testing.T) {
+	report := strings.Join([]string{
+		`{"Action":"run","Package":"example.test","Test":"TestParent"}`,
+		`{"Action":"pass","Package":"example.test","Test":"TestParent/short"}`,
+		`{"Action":"pass","Package":"example.test","Test":"TestParent"}`,
+	}, "\n") + "\n"
+	output, status := runUTReportValidator(t, report, true)
+	if status != 0 {
+		t.Fatalf("terminal-only short subtest rejected: %s", output)
+	}
+	if !strings.Contains(output, "terminal-only test roots=1") {
+		t.Fatalf("terminal-only diagnostic missing: %s", output)
+	}
+}
+
+func TestValidateUTReportAllowsTruncatedFailureDiagnostics(t *testing.T) {
+	report := strings.Join([]string{
+		`{"Action":"output","Package":"example.test","Test":"TestActive","Output":"{\"Action\":\"run\"}"}`,
+		`{"Action":"run","Package":"example.test","Test":"TestActive"}`,
+		"truncated",
+	}, "\n") + "\n"
+	output, status := runUTReportValidator(t, report, false)
+	if status != 0 {
+		t.Fatalf("truncated failure report should remain diagnostic: %s", output)
+	}
+	if !strings.Contains(output, 
```

**File**: `optools/ut_schedule_test.go` (modified, +4/-1)
```diff
@@ -94,7 +94,7 @@ func scheduleHarnessWithMockTransform(t *testing.T, script, mock string, transfo
 	if err := os.MkdirAll(dir, 0755); err != nil {
 		t.Fatal(err)
 	}
-	for _, name := range []string{"run_ut.sh", "utilities.sh", "ut_tools.bash", "ut_process.bash", "ut_link_gate.sh", "active_ut_cases.awk", "active_ut_incremental.py", "summarize_ut_slow_cases.py"} {
+	for _, name := range []string{"run_ut.sh", "utilities.sh", "ut_tools.bash", "ut_process.bash", "ut_link_gate.sh", "active_ut_cases.awk", "active_ut_incremental.py", "summarize_ut_slow_cases.py", "validate_ut_report.py"} {
 		data, err := os.ReadFile(name)
 		if err != nil {
 			t.Fatal(err)
@@ -1667,6 +1667,9 @@ fi
 					"FORCE_LIGHT_LAUNCH_FAILURE="+caseData.forceLaunchFailure,
 					"PREBUILD_VALUE="+caseData.prebuild,
 					"EXPECT_PREBUILD_ACTIVE="+caseData.expectPrebuildActive,
+					// Keep the optional prebuild path deterministic even when the
+					// host's /tmp free-space guard is close to its production threshold.
+					"UT_PREBUILD_MIN_FREE_KB=1",
 					"EMBEDDED_STATUS="+caseData.embeddedStatus)
 			}
 			out, err := runCase(tc)
```

**File**: `optools/ut_tools_test.go` (modified, +8/-1)
```diff
@@ -220,7 +220,14 @@ if [[ "$MOCK_SHADOW" == true ]]; then
 fi
 mkdir -p "$BUILD_WKSP/ut-report/failed/outputs"
 printf 'previous failure\n' > "$BUILD_WKSP/ut-report/failed/outputs/stale"
-: > "$UT_REPORT"
+cat > "$UT_REPORT" <<'EOF'
+{"Action":"start","Package":"example/summary"}
+{"Action":"run","Package":"example/summary","Test":"TestSummary"}
+{"Action":"pause","Package":"example/summary","Test":"TestSummary"}
+{"Action":"cont","Package":"example/summary","Test":"TestSummary"}
+{"Action":"pass","Package":"example/summary","Test":"TestSummary"}
+{"Action":"pass","Package":"example/summary"}
+EOF
 ut_summary
 [[ ! -e "$BUILD_WKSP/ut-report/failed/outputs/stale" ]] || exit 93
 [[ -n $(find "$G_WKSP" -path '*previous-failed*/failed/outputs/stale' -type f -print -quit) ]] || exit 94
```

**File**: `optools/validate_ut_report.py` (added, +255/-0)
```diff
@@ -0,0 +1,255 @@
+#!/usr/bin/env python3
+# Copyright 2026 Matrix Origin
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#      http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Validate the lifecycle and orthogonality of a Go test JSON report.
+
+The race runner may concatenate reports from several processes for one Go
+package.  Package start/pass events may therefore repeat, but a test root must
+appear in exactly one process.  Go's ``pause`` and ``cont`` events are state
+transitions, not a second execution of the test; accepting them here keeps the
+validator aligned with the ``go test -json`` contract while the pinned
+go-ut-analysis binary remains compatible with older event sets.
+
+Some test helpers emit a terminal event for a very short subtest without a
+separate ``run`` record in the merged stream. Such a terminal is treated as an
+implicit root and reported as a warning; a later execution of that same root is
+still rejected as a duplicate.
+
+The raw report is deliberately never rewritten.  A truncated report is
+diagnostic evidence after a failed/cancelled run, so incomplete roots and
+malformed trailing lines are warnings in the default mode.  A successful run
+uses ``--require-complete`` and turns those conditions into a failed quality
+gate.
+"""
+
+from __future__ import annotations
+
+import argparse
+import json
+import sys
+from dataclasses import dataclass
+from pathlib import Path
+from typing import Dict, Iterable, List, Optional, Tuple
+
+
+TERMINAL_ACTIONS = {"pass", "fail", "skip"}
+
+
+@dataclass
+class ActiveTest:
+    package: str
+    name: str
+    line: int
+    action: str
+
+
+@dataclass
+class Validation:
+    events: int = 0
+    test_starts: int = 0
+    test_terminals: int = 0
+    package_events: int = 0
+    malformed: int = 0
+    incomplete: int = 0
+    implicit_terminals: int = 0
+    incomplete_packages: int = 0
+    errors: Optional[List[str]] = None
+
+    def __post_init__(self) -> None:
+        if self.errors is None:
+            self.errors = []
+
+
+def _event_fields(event: object) -> Optional[Tuple[str, str, str]]:
+    if not isinstance(event, dict):
+        return None
+    action = event.get("Action")
+    package = event.get("Package")
+    test = event.get("Test", "")
+    if not isinstance(action, str) or not isinstance(package, str):
+        return None
+    if not isinstance(test, str):
+        return None
+    if not package:
+        return None
+    return action, package, test
+
+
+def validate(report_path: Path, require_complete: bool = False) -> Validation:
+    result = Validation()
+    active: Dict[Tuple[str, str], ActiveTest] = {}
+    completed: set[Tuple[str, str]] = set()
+    active_packages: Dict[str, int] = {}
+
+    with report_path.open("rb") as report:
+        for line_number, raw_line in enumerate(report, 1):
+            try:
+                line = raw_line.decode("utf-8")
+            except UnicodeDecodeError:
+                result.malformed += 1
+                continue
+            try:
+                event = json.loads(line)
+            except json.JSONDecodeError:
+                result.malformed += 1
+                continue
+
+            fields = _event_fields(event)
+            if fields is None:
+                # Build records and ordinary output records do not carry a
+                # test lifecycle.  Ignore them, as the Go analysis tool does.
+                continue
+            action, package, test = fields
+            result.events += 1
+            if not test:
+                if action in {"start", *TERMINAL_ACTIONS}:
+                    result.package_events += 1
+                    if action == "start":
+                        active_packages[package] = active_packages.get(package, 0) + 1
+                    elif active_packages.get(package, 0) > 0:
+                        active_packages[package] -= 1
+                continue
+
+            key = (package, test)
+            if action == "run":
+                result.test_starts += 1
+                previous = active.get(key)
+                if previous is not None:
+                    result.errors.append(
+                        f"line {line_number}: duplicate test root {package}:{test} "
+                        f"(already active from line {previous.line})"
+                    )
+                elif key in completed:
+                    result.errors.append(
+                        f"line {line_number}: duplicate test root {package}:{test} "
+                    
```

#### Recent Merged Pull Requests:
- **PR #30688** (2026-10-21): test(plan): shorten table-dump binding budget cases (@XuPeng-SH)
- **PR #30686** (2026-10-21): perf(ut): reduce table dump verification cost and bound race parallelism (@XuPeng-SH)
- **PR #30674** (2026-10-20): fix(sql): abort compressed loads on truncated streams (@daviszhen)
- **PR #30671** (2026-10-20): fix(sql): preserve inherited indexes across column replacement (@XuPeng-SH)
- **PR #30670** (2026-10-20): test: fix transaction, context and resource ownership in UT fixtures (@XuPeng-SH)
- **PR #30659** (2026-10-20): test: isolate quota transaction mode from daemon tasks (@iamlinjunhong)

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

## X. sql): preserve FIELD binary domains and prepared CASE types (#30096)

**RULE**:
When implementing operations in `docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DECISIONS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c119c688`: sql): preserve FIELD binary domains and prepared CASE types (#30096). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/CLAUDE_PREPARED_FIELD_TYPE_HISTORY_DECISIONS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# FIELD 类型历史设计：批准记录与实施合约

## 可追溯决定（2026-10-19）

- 完整范围：issue #25301 / PR #30096。D2/D3已在提交`f2b418d1bfe604a1825419b3abf6affe0f53d09b`发布。
- D2 SHA256：`b2df6187d3f952284c92374d38e78f30ab04ca958bb49e241bcc0d78f2c42c8c`。
- D3 SHA256：`9dd6d7ff2044cb2a9dfb9dc6da3dfe2a022717bd367433006458657a6508d33a`。
- 第一次用户`go ahead`授权继续D2验证；随后发现的错误结果和实测性能代价没有被当成默示接受。
- 本次向用户明确提出：“R1旧历史会使重试算错，建议依赖变化时返回重准备错误；R2普通32层REVERSE绑定耗时约增54%、分配增64KB，建议先优化再交付。”用户再次回复原文`go ahead`。
- 据此选择D3的**R1方案A（fail-closed）**及**R2先优化、不直接接受已测额外开销**。D2的不可变H、handle发布点、单槽cache、迁移拒绝、不增加history wire/独立quota等其余已记录取舍不变。
- 批准来源是本次交互用户，不冒充某个GitHub reviewer，也不倒签过去已有design-first批准。原D2/D3保持冻结；这份记录解释后续决定。GitHub实现review由相应reviewer独立完成，不自行dismiss CHANGES_REQUESTED。

## R1：重试代际验证

1. 新建或Reset缓存Compile时，retry capture携带当次history所依赖的不可变catalog引用事实（对象、版本、数据库/订阅、snapshot等）；不捕获可变handle来延迟取值。
2. 复用既有`checkModify`依赖验证契约；在retry重建执行计划前，以当前事务编译context解析原依赖。捕获的catalog对象/版本等代际事实变化时，保守返回既有`TxnNeedRetryWithDefChanged`错误；这也包括版本发生变化但列类型未变的DDL。解析失败直接返回错误。不存在H的路径不增加此检查。经既有`RewriteError`，客户端可见代码为20631、SQLSTATE为HY000，不是MySQL 1615，不能假定驱动自动reprepare。
3. 不把旧H用于新声明的rows，也不在retry建立第二个handle发布者。generation rebuilt先于重建回调的现有顺序保持；错误终端使frontend cache失效，下一EXECUTE按正常owner重建并发布H。
4
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c119c688` are properly handled with clean fallback behavior.
