# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:30.441Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2038 stars

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

### Core Architecture Module: `pkg/catalog/secondary_index_utils.go`
```
// Copyright 2023 Matrix Origin
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

package catalog

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/bytedance/sonic"
	"github.com/matrixorigin/matrixone/pkg/common/moerr"
	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
	"github.com/matrixorigin/matrixone/pkg/vectorindex/metric"
)

// Index Algorithm names
const (
	MoIndexDefaultAlgo   = tree.INDEX_TYPE_INVALID   // used by UniqueIndex or default SecondaryIndex
	MoIndexBTreeAlgo     = tree.INDEX_TYPE_BTREE     // used for Mocking MySQL behaviour.
	MoIndexRTreeAlgo     = tree.INDEX_TYPE_RTREE     // used for Spatial Index on GEOMETRY columns
	MoIndexIvfFlatAlgo   = tree.INDEX_TYPE_IVFFLAT   // used for IVF flat index on Vector/Array columns
	MOIndexMasterAlgo    = tree.INDEX_TYPE_MASTER    // used for Master Index on VARCHAR columns
	MOIndexFullTextAlgo  = tree.INDEX_TYPE_FULLTEXT  // used for Fulltext Index on VARCHAR columns
	MoIndexHnswAlgo      = tree.INDEX_TYPE_HNSW      // used for HNSW Index on Vector/Array columns
	MoIndexCagraAlgo     = tree.INDEX_TYPE_CAGRA     // used for CAGRA Index on Vector/Array columns
	MoIndexIvfpqAlgo     = tree.INDEX_TYPE_IVFPQ     // used for IVFPQ Index on Vector/Array columns
	MoIndexFullText2Algo = tree.INDEX_TYPE_FULLTEXT2 // CREATE FULLTEXT2 INDEX: WAND positional engine on TEXT/VARCHAR columns
)

// ToLower is used for before comparing AlgoType and IndexAlgoParamOpType. Reason why they are strings
//  1. Changing AlgoType from string to Enum will break the backward compatibility.
//     "panic: Unable to find target column from predefined table columns"
//  2. IndexAlgoParamOpType is serialized and stored in the mo_indexes as JSON string.
func ToLower(str string) string {
	return strings.ToLower(strings.TrimSpace(str))
}

// IsNullIndexAlgo is used to skip printing the default "" index algo in the restoreDDL and buildShowCreateTable
func IsNullIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexDefaultAlgo.ToString()
}

// IsRegularIndexAlgo are indexes which will be handled by regular index flow, ie the one where
// we have one hidden table.
func IsRegularIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexDefaultAlgo.ToString() || _algo == MoIndexBTreeAlgo.ToString() || _algo == MoIndexRTreeAlgo.ToString()
}

func IsRTreeIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexRTreeAlgo.ToString()
}

func IsIvfIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexIvfFlatAlgo.ToString()
}

func IsMasterIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MOIndexMasterAlgo.ToString()
}

func IsFullTextIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MOIndexFullTextAlgo.ToString()
}

// IsFullText2IndexAlgo reports the distinct WAND positional fulltext engine
// (CREATE FULLTEXT2 INDEX). It is a separate algo from classic fulltext so its
// plugin hooks stay static; query routing / MATCH detection treat both.
func IsFullText2IndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexFullText2Algo.ToString()
}

func IsHnswIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexHnswAlgo.ToString()
}

func IsCagraIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexCagraAlgo.ToString()
}

func IsIvfpqIndexAlgo(algo string) bool {
	_algo := ToLower(algo)
	return _algo == MoIndexIvfpqAlgo.ToString()
}

// ------------------------[START] IndexAlgoParams------------------------
const (
	IndexAlgoParamLists     = "lists"
	IndexAlgoParamOpType    = "op_type"
	HnswM                   = "m"
	HnswEfConstruction      = "ef_construction"
	HnswEfSearch            = "ef_search"
	Async                   = "async"
	AutoUpdate              = "auto_update"
	Day                     = "day"
	Hour                    = "hour"
	Second                  = "second"
	DistributionMode        = "distribution_mode"
	Quantization            = "quantization"
	BitsPerCode             = "bits_per_code"
	IntermediateGraphDegree = "intermediate_graph_degree"
	GraphDegree             = "graph_degree"
	ITopkSize               = "itopk_size"
	// IncludedColumns persists INCLUDE metadata inside algo_params. Consumers
	// prefer plan.IndexDef.IncludedColumns when present and fall back to this key
	// for catalog-loaded definitions.
	IncludedColumns = "included_columns"

	// Index-defining build params, settable as CREATE INDEX options (parsed by
	// each plugin's ParamsFromTree). Written into flat algo_params only when
	// explicitly specified, read back by the build path (table functions /
	// sync), and rendered by IndexParamsToStringList for SHOW CREATE.
	IndexAlgoParamKmeansTrainPercent  = "kmeans_train_percent"
	IndexAlgoParamKmeansMaxIteration  = "kmeans_max_iteration"
	IndexAlgoParamMaxIndexCapacity    = "max_index_capacity"
	IndexAlgoParamQuantizerTrainLimit = "quantizer_train_limit"

	// IndexAlgoParamMaxPostingsCapacity (fulltext2): max postings (term occurrences)
	// per built segment. Bounds per-segment build memory regardless of doc size —
	// max_index_capacity (docs) is a poor memory proxy since a doc can hold one token
	// or tens of thousands. A segment seals on whichever cap (docs OR postings) is hit
	// first. Recorded only when explicitly specified; absence ⇒ DefaultPostingCapacity.
	IndexAlgoParamMaxPostingsCapacity = "max_postings_capacity"

	// IndexAlgoParamJSONIncludeKeys (fulltext2, parser=json): "false" ⇒ index leaf
	// VALUES only, the pre-tuple behaviour. Absent ⇒ "true": the json word breaker
	// indexes each leaf as a (tag, value) tuple so a key/value association is one
	// searchable term.
	IndexAlgoParamJSONIncludeKeys = "include_keys"

	// IndexAlgoParamPositionFree (fulltext2): "true" ⇒ build a position-free index
	// (bag-of-words retrieval only, ~half the footprint; the FST term dict is kept).
	// Recorded only when POSITION_FREE=TRUE; absence ⇒ positional (phrase-capable).
	IndexAlgoParamPositionFree = "position_free"

	// IndexAlgoParamPrefixLengths is the legacy, delimiter-separated encoding.
	// It remains readable for metadata written by older versions.
	IndexAlgoParamPrefixLengths = "prefix_lengths"
	// IndexAlgoParamPrefixLengthsV2 stores a JSON object in a string value.
	// Unlike the legacy colon/comma-separated value, it can represent every
	// legal quoted column name without ambiguity.
	IndexAlgoParamPrefixLengthsV2 = "prefix_lengths_v2"

	// IndexAlgoParamVersion selects the index engine version. Currently fulltext
	// only: unset/1 = classic SQL engine, 2 = WAND-based fulltext v2. The fulltext
	// plugin routes each hook to the matching engine by this value.
	IndexAlgoParamVersion = "version"
)

func ParseIncludeColumnsValue(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	if strings.HasPrefix(raw, "[") {
		var cols []string
		if err := json.Unmarshal([]byte(raw), &cols); err == nil {
			return cols, nil
		}
	}

	parts := strings.Split(raw, ",")
	cols := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		cols = append(cols, part)
	}
	if len(cols) == 0 {
		return nil, nil
	}
	return cols, nil
}

// MarshalIncludeColumnsValue encodes INCLUDE column names without losing
// commas or leading/trailing whitespace that are valid inside quoted SQL
// identifiers. ParseIncludeColumnsValue retains support for the historical
// comma-separated representation when catalog metadata is reloaded.
func MarshalIncludeColumnsValue(cols []string) (string, error) {
	if len(cols) == 0 {
		return "", nil
	}
	encoded, err := json.Marshal(cols)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

/* 1. ToString Functions */

// IndexParamsToStringList used by buildShowCreateTable and restoreDDL
// Eg:- "LIST = 10 op_type 'vector_l2_ops'"
// NOTE: don't set default values here as it is used by SHOW and RESTORE DDL.
func IndexParamsToStringList(indexParams string) (string, error) {
	result, err := IndexParamsStringToMap(indexParams)
	if err != nil {
		return "", err
	}

	res := ""
	if val, ok := result[IndexAlgoParamLists]; ok {
		res += fmt.Sprintf(" %s = %s ", IndexAlgoParamLists, val)
	}

	if val, ok := result[HnswM]; ok {
		res += fmt.Sprintf(" %s = %s ", HnswM, val)
	}

	if val, ok := result[HnswEfConstruction]; ok {
		res += fmt.Sprintf(" %s = %s ", HnswEfConstruction, val)
	}

	if val, ok := result[HnswEfSearch]; ok {
		res += fmt.Sprintf(" %s = %s ", HnswEfSearch, val)
	}

	if opType, ok := result[IndexAlgoParamOpType]; ok {
		opType = ToLower(opType)
		if _, ok := metric.OpTypeToIvfMetric[opType]; !ok {
			return "", moerr.NewInternalErrorNoCtxf("invalid op_type: '%s'", opType)
		}

		res += fmt.Sprintf(" %s '%s' ", IndexAlgoParamOpType, opType)
	}

	if val, ok := result[Async]; ok {
		if val == "true" {
			res += fmt.Sprintf(" %s ", Async)
		}
	}

	if val, ok := result[AutoUpdate]; ok {
		if val == "true" {
			res += fmt.Sprintf(" %s = %s ", AutoUpdate, val)
		}
	}

	if val, ok := result[Day]; ok {
		res += fmt.Sprintf(" %s = %s ", Day, val)
	}

	if val, ok := result[Hour]; ok {
		res += fmt.Sprintf(" %s = %s ", Hour, val)
	}

	// SECOND is the async-index AUTO_UPDATE compaction cadence (idxcron reads it as the
	// explicit interval). Like DAY/HOUR it must round-trip through SHOW CREATE / checkpoint
	
```

### Core Architecture Module: `pkg/cdc/reader_v2_state.go`
```
// Copyright 2024 Matrix Origin
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

package cdc

import (
	"context"
	"sync"
	"sync/atomic"

	"github.com/matrixorigin/matrixone/pkg/container/types"
	"github.com/matrixorigin/matrixone/pkg/txn/client"
)

// ReaderState represents the state of a table reader
type ReaderState int32

const (
	// ReaderStateIdle - Reader is idle, no active transaction
	ReaderStateIdle ReaderState = iota
	// ReaderStateReading - Reader is actively reading changes
	ReaderStateReading
	// ReaderStateProcessing - Reader is processing and sending data to sinker
	ReaderStateProcessing
	// ReaderStateCommitting - Reader is committing transaction
	ReaderStateCommitting
	// ReaderStateError - Reader encountered an error
	ReaderStateError
)

func (s ReaderState) String() string {
	switch s {
	case ReaderStateIdle:
		return "Idle"
	case ReaderStateReading:
		return "Reading"
	case ReaderStateProcessing:
		return "Processing"
	case ReaderStateCommitting:
		return "Committing"
	case ReaderStateError:
		return "Error"
	default:
		return "Unknown"
	}
}

// TransactionTracker tracks the lifecycle of a transaction
// This is a key improvement: explicit transaction state tracking
// instead of relying on implicit hasBegin flag
type TransactionTracker struct {
	mu sync.Mutex

	// Transaction boundaries
	fromTs types.TS
	toTs   types.TS

	// Transaction state
	hasBegin      bool // Whether BEGIN has been sent to sinker
	hasCommitted  bool // Whether COMMIT has been sent to sinker
	hasRolledBack bool // Whether ROLLBACK has been sent to sinker

	// Watermark tracking
	// The watermark we expect to update to after successful commit
	expectedWatermark types.TS
	// Whether watermark has been updated
	watermarkUpdated bool
}

// NewTransactionTracker creates a new transaction tracker
func NewTransactionTracker(fromTs, toTs types.TS) *TransactionTracker {
	return &TransactionTracker{
		fromTs:            fromTs,
		toTs:              toTs,
		expectedWatermark: toTs,
	}
}

// MarkBegin marks that BEGIN has been sent to sinker
func (t *TransactionTracker) MarkBegin() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.hasBegin = true
}

// MarkCommit marks that COMMIT has been sent to sinker
func (t *TransactionTracker) MarkCommit() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.hasCommitted = true
}

// MarkRollback marks that ROLLBACK has been sent to sinker
func (t *TransactionTracker) MarkRollback() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.hasRolledBack = true
}

// MarkWatermarkUpdated marks that watermark has been updated
func (t *TransactionTracker) MarkWatermarkUpdated() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.watermarkUpdated = true
}

// NeedsRollback returns true if transaction needs to be rolled back
// This is the key improvement: explicit check instead of relying on watermark
func (t *TransactionTracker) NeedsRollback() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	// If BEGIN was sent but not committed and not rolled back, need rollback
	return t.hasBegin && !t.hasCommitted && !t.hasRolledBack
}

// IsCompleted returns true if transaction is fully completed (committed or rolled back)
func (t *TransactionTracker) IsCompleted() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.hasCommitted || t.hasRolledBack
}

// GetFromTs returns the fromTs of this transaction
func (t *TransactionTracker) GetFromTs() types.TS {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.fromTs
}

// GetToTs returns the toTs of this transaction
func (t *TransactionTracker) GetToTs() types.TS {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.toTs
}

// UpdateToTs updates the transaction end timestamp
// This is used when multiple batches are processed in one transaction
// and we need to track the latest toTs
func (t *TransactionTracker) UpdateToTs(toTs types.TS) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.toTs = toTs
	t.expectedWatermark = toTs
}

// GetExpectedWatermark returns the expected watermark after commit
func (t *TransactionTracker) GetExpectedWatermark() types.TS {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.expectedWatermark
}

// IsWatermarkUpdated returns whether watermark has been updated
func (t *TransactionTracker) IsWatermarkUpdated() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.watermarkUpdated
}

// Reset resets the tracker for a new transaction
func (t *TransactionTracker) Reset(fromTs, toTs types.TS) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.fromTs = fromTs
	t.toTs = toTs
	t.expectedWatermark = toTs
	t.hasBegin = false
	t.hasCommitted = false
	t.hasRolledBack = false
	t.watermarkUpdated = false
}

// StateManager manages the reader state atomically
type StateManager struct {
	state atomic.Int32
}

// NewStateManager creates a new state manager
func NewStateManager() *StateManager {
	return &StateManager{}
}

// SetState sets the reader state
func (sm *StateManager) SetState(state ReaderState) {
	sm.state.Store(int32(state))
}

// GetState returns the current reader state
func (sm *StateManager) GetState() ReaderState {
	return ReaderState(sm.state.Load())
}

// CompareAndSwapState atomically compares and swaps the state
func (sm *StateManager) CompareAndSwapState(old, new ReaderState) bool {
	return sm.state.CompareAndSwap(int32(old), int32(new))
}

// ReadContext holds the context for a read operation
type ReadContext struct {
	ctx    context.Context
	txnOp  client.TxnOperator
	packer *types.Packer

	// Current transaction tracker
	tracker *TransactionTracker
}

// NewReadContext creates a new read context
func NewReadContext(ctx context.Context, txnOp client.TxnOperator, packer *types.Packer) *ReadContext {
	return &ReadContext{
		ctx:    ctx,
		txnOp:  txnOp,
		packer: packer,
	}
}

// SetTracker sets the transaction tracker
func (rc *ReadContext) SetTracker(tracker *TransactionTracker) {
	rc.tracker = tracker
}

// GetTracker returns the transaction tracker
func (rc *ReadContext) GetTracker() *TransactionTracker {
	return rc.tracker
}

```

### Core Architecture Module: `pkg/cdc/util.go`
```
// Copyright 2024 Matrix Origin
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

package cdc

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	cryptorand "crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math"
	"math/rand"
	"net"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/matrixorigin/matrixone/pkg/catalog"
	"github.com/matrixorigin/matrixone/pkg/common/moerr"
	"github.com/matrixorigin/matrixone/pkg/common/mpool"
	"github.com/matrixorigin/matrixone/pkg/container/batch"
	"github.com/matrixorigin/matrixone/pkg/container/bytejson"
	"github.com/matrixorigin/matrixone/pkg/container/types"
	"github.com/matrixorigin/matrixone/pkg/container/vector"
	"github.com/matrixorigin/matrixone/pkg/logutil"
	"github.com/matrixorigin/matrixone/pkg/pb/plan"
	"github.com/matrixorigin/matrixone/pkg/pb/timestamp"
	"github.com/matrixorigin/matrixone/pkg/txn/client"
	v2 "github.com/matrixorigin/matrixone/pkg/util/metric/v2"
	"github.com/matrixorigin/matrixone/pkg/vm/engine"
	"github.com/matrixorigin/mysql"
)

// escapeSQLString escapes special characters in SQL string literals to prevent SQL injection.
//
// It follows the SQL standard escaping rules:
//  1. Single quotes (') are escaped as double single quotes (”)
//  2. Backslashes (\) are escaped as double backslashes (\\)
//
// This function is critical for security: it prevents SQL injection attacks by ensuring
// that user-provided strings (TaskId, DBName, TableName, ErrMsg) cannot break out of
// string literals and execute arbitrary SQL commands.
//
// Example:
//
//	Input:  "task'; DROP TABLE users; --"
//	Output: "task''; DROP TABLE users; --"
//	Result: The SQL will treat this as a literal string value, not as SQL commands
func escapeSQLString(s string) string {
	// Replace backslash first (before replacing quotes) to avoid double-escaping
	s = strings.ReplaceAll(s, `\`, `\\`)
	// Replace single quotes with double single quotes (SQL standard escaping)
	s = strings.ReplaceAll(s, "'", "''")
	return s
}

// extractRowFromEveryVector gets the j row from the every vector and outputs the row
// bat columns layout:
// 1. data: user defined cols | cpk (if needed) | commit-ts
// 2. tombstone: pk/cpk | commit-ts
// return user defined cols for data or only one cpk column for tombstone
func extractRowFromEveryVector(
	ctx context.Context,
	dataSet *batch.Batch,
	rowIndex int,
	row []any,
) error {
	for i := 0; i < len(row); i++ {
		vec := dataSet.Vecs[i]
		rowIndexBackup := rowIndex
		if vec.IsConstNull() {
			row[i] = nil
			continue
		}
		if vec.IsConst() {
			rowIndex = 0
		}

		if err := extractRowFromVector(ctx, vec, i, row, rowIndex); err != nil {
			return err
		}
		rowIndex = rowIndexBackup
	}
	return nil
}

//func extractRowFromWantedVecs(
//	ctx context.Context,
//	dataSet *batch.Batch,
//	rowIndex int,
//	wantedVecIdxes []int,
//	row []any,
//) error {
//	for i := 0; i < len(row); i++ {
//		vec := dataSet.Vecs[wantedVecIdxes[i]]
//		rowIndexBackup := rowIndex
//		if vec.IsConstNull() {
//			row[i] = nil
//			continue
//		}
//		if vec.IsConst() {
//			rowIndex = 0
//		}
//
//		err := extractRowFromVector(ctx, vec, i, row, rowIndex)
//		if err != nil {
//			return err
//		}
//		rowIndex = rowIndexBackup
//	}
//	return nil
//}

// extractRowFromVector gets the rowIndex row from the i vector
func extractRowFromVector(ctx context.Context, vec *vector.Vector, i int, row []any, rowIndex int) error {
	if vec.IsConstNull() || vec.GetNulls().Contains(uint64(rowIndex)) {
		row[i] = nil
		return nil
	}

	switch vec.GetType().Oid { //get col
	case types.T_json:
		row[i] = types.DecodeJson(vec.CloneBytesAt(rowIndex))
	case types.T_bool:
		row[i] = vector.GetFixedAtWithTypeCheck[bool](vec, rowIndex)
	case types.T_bit:
		row[i] = vector.GetFixedAtWithTypeCheck[uint64](vec, rowIndex)
	case types.T_int8:
		row[i] = vector.GetFixedAtWithTypeCheck[int8](vec, rowIndex)
	case types.T_uint8:
		row[i] = vector.GetFixedAtWithTypeCheck[uint8](vec, rowIndex)
	case types.T_int16:
		row[i] = vector.GetFixedAtWithTypeCheck[int16](vec, rowIndex)
	case types.T_uint16:
		row[i] = vector.GetFixedAtWithTypeCheck[uint16](vec, rowIndex)
	case types.T_int32:
		row[i] = vector.GetFixedAtWithTypeCheck[int32](vec, rowIndex)
	case types.T_uint32:
		row[i] = vector.GetFixedAtWithTypeCheck[uint32](vec, rowIndex)
	case types.T_int64:
		row[i] = vector.GetFixedAtWithTypeCheck[int64](vec, rowIndex)
	case types.T_uint64:
		row[i] = vector.GetFixedAtWithTypeCheck[uint64](vec, rowIndex)
	case types.T_float32:
		row[i] = vector.GetFixedAtWithTypeCheck[float32](vec, rowIndex)
	case types.T_float64:
		row[i] = vector.GetFixedAtWithTypeCheck[float64](vec, rowIndex)
	case types.T_char, types.T_varchar, types.T_blob, types.T_text, types.T_binary, types.T_varbinary, types.T_datalink:
		row[i] = vec.CloneBytesAt(rowIndex)
	case types.T_array_float32:
		// NOTE: Don't merge it with T_varchar. You will get raw binary in the SQL output
		//+------------------------------+
		//| abs(cast([1,2,3] as vecf32)) |
		//+------------------------------+
		//|   �?   @  @@                  |
		//+------------------------------+
		row[i] = vector.GetArrayAt[float32](vec, rowIndex)
	// Narrow vector element types — kept separate from T_varchar for the same
	// raw-binary reason noted above. Without these, CDC on a table with a
	// bf16/f16/int8/uint8 vector column fails permanently on the first row.
	case types.T_array_bf16:
		row[i] = vector.GetArrayAt[types.BF16](vec, rowIndex)
	case types.T_array_float16:
		row[i] = vector.GetArrayAt[types.Float16](vec, rowIndex)
	case types.T_array_int8:
		row[i] = vector.GetArrayAt[int8](vec, rowIndex)
	case types.T_array_uint8:
		row[i] = vector.GetArrayAt[uint8](vec, rowIndex)
	case types.T_array_float64:
		row[i] = vector.GetArrayAt[float64](vec, rowIndex)
	case types.T_date:
		row[i] = vector.GetFixedAtWithTypeCheck[types.Date](vec, rowIndex)
	case types.T_datetime:
		scale := vec.GetType().Scale
		row[i] = vector.GetFixedAtWithTypeCheck[types.Datetime](vec, rowIndex).String2(scale)
	case types.T_time:
		scale := vec.GetType().Scale
		row[i] = vector.GetFixedAtWithTypeCheck[types.Time](vec, rowIndex).String2(scale)
	case types.T_timestamp:
		scale := vec.GetType().Scale
		//TODO:get the right timezone
		//timeZone := ses.GetTimeZone()
		timeZone := time.UTC
		row[i] = vector.GetFixedAtWithTypeCheck[types.Timestamp](vec, rowIndex).String2(timeZone, scale)
	case types.T_decimal64:
		scale := vec.GetType().Scale
		row[i] = vector.GetFixedAtWithTypeCheck[types.Decimal64](vec, rowIndex).Format(scale)
	case types.T_decimal128:
		scale := vec.GetType().Scale
		row[i] = vector.GetFixedAtWithTypeCheck[types.Decimal128](vec, rowIndex).Format(scale)
	case types.T_uuid:
		row[i] = vector.GetFixedAtWithTypeCheck[types.Uuid](vec, rowIndex).String()
	case types.T_Rowid:
		row[i] = vector.GetFixedAtWithTypeCheck[types.Rowid](vec, rowIndex)
	case types.T_Blockid:
		row[i] = vector.GetFixedAtWithTypeCheck[types.Blockid](vec, rowIndex)
	case types.T_TS:
		row[i] = vector.GetFixedAtWithTypeCheck[types.TS](vec, rowIndex)
	case types.T_enum:
		row[i] = vector.GetFixedAtWithTypeCheck[types.Enum](vec, rowIndex)
	default:
		logutil.Error(
			"Failed to extract row from vector, unsupported type",
			zap.Int("typeID", int(vec.GetType().Oid)))
		return moerr.NewInternalErrorf(ctx, "extractRowFromVector : unsupported type %d", vec.GetType().Oid)
	}
	return nil
}

func convertColIntoSql(
	ctx context.Context,
	data any,
	typ *types.Type,
	sqlBuff []byte) ([]byte, error) {
	if data == nil {
		sqlBuff = appendString(sqlBuff, "NULL")
		return sqlBuff, nil
	}
	var temp string
	switch typ.Oid { //get col
	case types.T_json:
		sqlBuff = appendByte(sqlBuff, '\'')
		temp = data.(bytejson.ByteJson).String()
		temp = strings.Replace(temp, "\\", "\\\\", -1)
		temp = strings.Replace(temp, "'", "\\'", -1)
		sqlBuff = appendString(sqlBuff, temp)
		sqlBuff = appendByte(sqlBuff, '\'')
	case types.T_bool:
		b := data.(bool)
		if b {
			temp = "true"
		} else {
			temp = "false"
		}
		sqlBuff = appendString(sqlBuff, temp)
	case types.T_bit:
		value := data.(uint64)
		bitLength := typ.Width
		byteLength := (bitLength + 7) / 8
		b := types.EncodeUint64(&value)[:byteLength]
		slices.Reverse(b)
		sqlBuff = appendByte(sqlBuff, '\'')
		sqlBuff = appendBytes(sqlBuff, b)
		sqlBuff = appendByte(sqlBuff, '\'')
	case types.T_int8:
		value := data.(int8)
		sqlBuff = appendInt64(sqlBuff, int64(value))
	case types.T_uint8:
		value := data.(uint8)
		sqlBuff = appendUint64(sqlBuff, uint64(value))
	case types.T_int16:
		value := data.(int16)
		sqlBuff = appendInt64(sqlBuff, int64(value))
	case types.T_uint16:
		value := data.(uint16)
		sqlBuff = appendUint64(sqlBuff, uint64(value))
	case types.T_int32:
		value := data.(int32)
		sqlBuff = appendInt64(sqlBuff, int64(value))
	case types.T_uint32:
		value := data.(uint32)
		sqlBuff = appendUint64(sqlBuff, uint64(value))
	case types.T_int64:
		value := data.(int64)
		sqlBuff = appendInt64(sqlBuff, value)
	case types.T_uint64:
		value := data.(uint64)
		sqlBuff = appendUint64(sqlBuff, value)
	case types.T_float32:
		value := data.(float32)
		sqlBuff = appendFloat64(sqlBuff, float64(value), 32)
	case types.T_float64:
		value := data.(float64)
		sqlBuff = appendFloat64(sqlBuff, value, 64)
	case types.T_binary, types.T_varbinary, types.T_blob:
		sqlBuff = appendHex(sqlBuff, data.([]byte))
	case types.T_char,
		types.T_varchar,
		types.T_text,
		types.T_datalink:
		val
```

### Core Architecture Module: `pkg/common/bloomfilter/util.go`
```
// Copyright 2021 - 2023 Matrix Origin
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

package bloomfilter

import (
	"math"

	"github.com/matrixorigin/matrixone/pkg/container/hashtable"
	"github.com/matrixorigin/matrixone/pkg/container/types"
	"github.com/matrixorigin/matrixone/pkg/container/vector"
)

func fillStringGroupStr(keys [][]byte, vec *vector.Vector, n int, start int) {
	area := vec.GetArea()
	vs := vector.MustFixedColWithTypeCheck[types.Varlena](vec)
	if !vec.GetNulls().Any() {
		for i := 0; i < n; i++ {
			keys[i] = append(keys[i], byte(0))
			keys[i] = append(keys[i], vs[i+start].GetByteSlice(area)...)
		}
	} else {
		nsp := vec.GetNulls()
		for i := 0; i < n; i++ {
			hasNull := nsp.Contains(uint64(i + start))
			if hasNull {
				keys[i] = append(keys[i], byte(1))
			} else {
				keys[i] = append(keys[i], byte(0))
				keys[i] = append(keys[i], vs[i+start].GetByteSlice(area)...)
			}
		}
	}
}

func fillGroupStr(keys [][]byte, vec *vector.Vector, n int, sz int, start int) {
	data := vec.GetData()[:(n+start)*sz]
	if !vec.GetNulls().Any() {
		for i := 0; i < n; i++ {
			keys[i] = append(keys[i], byte(0))
			keys[i] = append(keys[i], data[(i+start)*sz:(i+start+1)*sz]...)
		}
	} else {
		nsp := vec.GetNulls()
		for i := 0; i < n; i++ {
			isNull := nsp.Contains(uint64(i + start))
			if isNull {
				keys[i] = append(keys[i], byte(1))
			} else {
				keys[i] = append(keys[i], byte(0))
				keys[i] = append(keys[i], data[(i+start)*sz:(i+start+1)*sz]...)
			}
		}
	}
}

func encodeHashKeys(keys [][]byte, vec *vector.Vector, start, count int) {
	if vec.GetType().IsFixedLen() {
		fillGroupStr(keys, vec, count, vec.GetType().TypeSize(), start)
	} else {
		fillStringGroupStr(keys, vec, count, start)
	}

	for i := 0; i < count; i++ {
		if l := len(keys[i]); l < 16 {
			keys[i] = append(keys[i], hashtable.StrKeyPadding[l:]...)
		}
	}
}

func computeMemAndHashCount(rowCount int64, probability float64) (int64, int) {
	k := 1
	if rowCount < 10001 {
		k = 1
	} else if rowCount < 10_0001 {
		k = 1
	} else if rowCount < 100_0001 {
		k = 1
	} else if rowCount < 1000_0001 {
		k = 2
	} else if rowCount < 1_0000_0001 {
		k = 3
	} else if rowCount < 10_0000_0001 {
		k = 3
	} else if rowCount < 100_0000_0001 {
		k = 3
	} else {
		panic("unsupport rowCount")
	}
	hashCount := k * 3
	m := -float64(hashCount) * float64(rowCount) / math.Log(1-math.Pow(probability, 1.0/float64(hashCount)))
	return int64(m), k
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29635** (2026-10-05): **fix(cdc): repair default internal principal without relaxing authorization**
  *Symptoms*: ## Summary  Fixes #29634.  Repair the unnamed system principal produced by `frontend.InternalExecutor` on **4.2-dev**, without weakening the current-principal authorization introduced in #29431.  CDC constructs an executor with empty session overrides and the sys account. It previously supplied numeric `(account,user,role)=(0,0,0)` but the synthetic username `internal`; the catalog's reserved user 0 is `root`. The new strict authorization therefore rejected both the task-definition SELECT and its failed-state UPDATE, leaving an apparently running task with no downstream data.  ## Change and security boundaries  - After both override layers, normalize **only** unnamed sys/root/moadmin `(0,0,0)` to the real catalog principal. - Preserve explicit usernames/SQL-task definers, non-system tenants, nonzero users and nonzero selected roles. They do not borrow the default system administrator's name or privileges. - Leave current-user matching, account-generation/retirement checks, selected-role membership and all external authorization unchanged. Do not set `Session.isInternal` or bypass checks for the literal username `internal`. - Preserve default internal SQL provenance with a source-only `UserInput` flag. Keep `isInternalInput` unchanged, so SQL-mode staging, diagnostics and query-ID semantics are not altered. Carry the provenance through the existing statement copies and ANALYZE's derived query. - No new catalog lookup, background worker, timer, cache or retained state on the de
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29632** (2026-10-05): **fix(plan): retain prepared NTILE integer context for text parameters**
  *Symptoms*: ## Summary  Fixes #29631.  Restore the integer consumer context for prepared `NTILE(?)` when execution-time source rebinding supplies a MySQL string type. Use the existing **strict implicit INT64 cast**, retaining the original string ParamRef; do not change the NTILE overload checker, bucket algorithm, ordinary string-column behavior, or cache policy.  This closes the numeric-string portion of the [accepted #26867 contract](https://github.com/matrixorigin/matrixone/issues/26867#issuecomment-5266007198). Current Main still accepts integer 1/2/5 but rejects text `"2"` during planning, so this is not a blanket claim that the original integer bug returned.  ## Root cause and scope  `BuildPreparedExecutionPlan` rebuilds the query using the current parameter source domain. The PREPARE-only numeric binder does not install NTILE's INT64 context in this path; its consumer handling restores ANY/NULL but missed text. An unconverted TEXT/VARCHAR marker therefore reaches the integer-only window type checker and fails before NTILE bucket execution.  The only production change extends that existing NTILE consumer case to MySQL string source types. The cast is implicit, not explicit/numeric-prefix coercion: `"2"` works, while `"2.5"`, `"bad"`, `"2tail"`, overflow, non-positive integers, and NULL remain errors. The marker remains value-independent and reads the current EXECUTE parameter on every invocation. This does not add a Window diagnostic probe or cache state.  ## Regression coverage  -
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 
  > This pull request does not currently match the merge queue conditions, so it cannot be queued from here. The box comes back if it matches again. <!-- mergify:queue-control-withdrawn:queue -->
  > > `queue`  #### ⚠️ Invalid commit message  <details>  section not found  </details>   

- **Issue #29630** (2026-10-05): **[Bug]: ParseOne does not release parsed statements when rejecting multiple statements**
  *Symptoms*: ### Is there an existing issue for the same bug?  Checked the repository issue search for ParseOne/Free; no existing matching issue found. Discovered during #29249 / #29627 resource ownership QA.  ### Branch Name  main  ### Commit ID  ce2a22aa5a521d59ff7bb60e7e84d34cb2c93f81. The affected mysql_lexer.go is byte-identical at follow-up checkpoint 1f547a59b686e38c2a26f052191ad1460bce367c.  ### Other Environment Information  Local Go 1.26.4; GOMAXPROCS=2, package/test parallelism 1. Minimum two DDL statements; no database or large dataset is needed.  ### Actual Behavior  ParseOneWithSQLMode parses multiple statements into lexer.stmts, then returns nil plus a parse error when len != 1 without calling Free on those statements. Error/SELECT-INTO validation rejection paths already free their parsed statements. For pooled DDL nodes, the count-rejection path loses the opportunity to reset and return objects (and owned children) to their pools. This is a lifecycle/pooling defect; no SQL result corruption or quantified RSS/throughput regression is claimed.  ### Expected Behavior  The parser remains owner of every statement on rejection and frees all of them before returning nil/error. On success, the caller remains owner of the single returned statement.  ### Steps to Reproduce  Call mysql.ParseOne(context.Background(), "create database a; create database b", 1). It returns nil/error as expected. Observe the two pooled CreateDatabase nodes at the count-rejection boundary: both still reta

- **Issue #29629** (2026-10-05): **test: make process fixture resource ownership explicit**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [x] Code Refactoring  ## Which issue(s) this PR fixes:  Fixes #29630. Refs #29249 and #29627. This is the constructor ownership and immediate consumer stage of #29627; the issue remains open for the nil-fixture/planner/remaining-owner migration.  ## What this PR does / why we need it:  Process fixtures previously registered a default pool before applying options, leaving an unreachable registered pool when the caller supplied its own. File-service options similarly constructed and discarded three unnecessary services and could close an earlier supplied dependency. Partial construction could retain pool registrations even with zero byte usage.  Resolve options before acquiring defaults, preserve explicit nil and last-option semantics, and borrow supplied pools/services/clients. A single constructor now owns default resources for the actual TB lifetime, captures the acquired resources independently of later process-field replacements, and unwinds partial acquisition on panic or Goexit. A nil TB keeps explicit manual ownership without allocating duplicate-cleanup callback state.  Reuse testing cleanup, existing Process.Free, and bounded OnceFunc guards only when both registered cleanup and rollback can reach the same resource. Keep runtime-owned auto-increment services and production Process.Free ownership unchanged.  Remove 87 immediately adjacent dupl
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29628** (2026-10-05): **test(function): consolidate string clock grammar coverage**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [x] Code Refactoring  ## Which issue(s) this PR fixes:  Refs #29249 and #29627. Both broader tracking issues remain open; this stage consolidates one complete class of string-clock consumer tests and closes its owned fixtures.  ## What this PR does / why we need it:  ### Existing owner and scope  String HOUR/MINUTE/SECOND share `timeStringToFixedWithNullOnError`, followed by the zero-calendar and ordered clock parsers. Fourteen tests repeatedly construct the same lightweight process/vector fixture for separate grammar matrices. Consolidate that class into one literal row table and three typed consumers using the existing `FunctionTestCase` comparison and `RunAndFree` cleanup. No new runner, execution path, production hook, state or fallback.  Production, registration, parser, SQL BVT and documentation are unchanged. This is test maintenance; the production architectural design gate does not apply. Design revision 2 and final review use gpt-6.1-sol with xhigh reasoning. Private review/probe artifacts are excluded from Git.  ### Preserved coverage and fixture ownership  - All 191 original row records map to 181 distinct strings with identical literal HOUR/MINUTE/SECOND values and NULL expectations. Only identical records are deduplicated; original varchar/char/text coverage is unioned. There are 127 rows for all three text types and 54 additional varch
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29626** (2026-10-05): **refactor(function): retire duplicate unary execution paths**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [x] Code Refactoring  ## Which issue(s) this PR fixes:  Refs #29249. This is a stage of the ongoing engineering-quality cleanup; keep the tracking issue open.  ## What this PR does / why we need it:  ### Owner and reviewed design (revision 4)  VARCHAR callbacks shared the same physical vectors while maintaining copied constant, NULL, selection and append loops. Route Length/BitLength directly through `opUnaryBytesToFixed` and HexString through `opUnaryBytesToBytes`; retire `opUnaryStrToFixed`, `opUnaryBytesToStr`, test-only `opUnaryStrToStr`, unused `opNoneParamToBytesWithErrorCheck`, its artificial SCA reference, two unnecessary references to live generic helpers, and uncalled `strLength`.  The Hex callback keeps the existing encoding expression and returns its borrowed bytes to the existing synchronous result-copy owner. Registration, coercion, output domains, error and NULL-on-error contracts remain unchanged. Existing byte owners retain their complete bodies. Production use does not exempt a copied implementation from review.  A typed callback adapter proposal added per-row calls and failed the declared cost budget. A direct migration of the string error owner also remained 9.1% slower in a controlled paired flat-batch measurement. Preserve that efficient error owner and its nine original callers, with both owners' admission checks. This is a mea
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29625** (2026-10-05): **fix: preserve prepared ROUND/TRUNCATE input before output CAST**
  *Symptoms*: ## Summary  Fixes #29623.  Keep a prepared ROUND/TRUNCATE value in its own input domain. A surrounding output CAST must execute **after** the precision function, not implicitly round/narrow the parameter before the function sees it.  The latest verified main base is `43c37847b16d37cfa8b9eef4235ba4388b5e25ce`. It contains #29508 and still reproduces the outer-DECIMAL wrong result found in nightly run [37215929355](https://github.com/matrixorigin/mo-nightly-regression/actions/runs/37215929355/job/111539319830).  ```sql SELECT CAST(ROUND(?,1) AS DECIMAL(20,1)),        CAST(TRUNCATE(?,1) AS DECIMAL(20,1)); ```  | Text parameter | Before | After / expected | |---|---|---| | `1.46` | `1.5 / 1.5` | `1.5 / 1.4` | | `-1.46` | `-1.5 / -1.5` | `-1.5 / -1.4` |  The defect also affects fresh text-first executions and SQL PREPARE; it is not dependent on a previous integer binding or a binary-only cache issue. #29508 fixed another input-domain variant, but its tests did not cover this outer DECIMAL composition. This PR does not claim #29508 was the original introducing change.  ## Minimal change and invariants  - Production change: 12 lines in the existing prepared ROUND/TRUNCATE binder. Save, clear and restore its three inherited numeric-context fields using a local defer. - Preserve explicit input CAST semantics: `TRUNCATE(CAST(? AS DECIMAL(20,1)),1)` still returns `1.5` for text `1.46`. - Preserve source-dependent cache admission and restore parent context after success, NULL fallback, b
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 
  > This pull request does not currently match the merge queue conditions, so it cannot be queued from here. The box comes back if it matches again. <!-- mergify:queue-control-withdrawn:queue -->

- **Issue #29624** (2026-10-05): **refactor(function): consolidate strict binary execution and retire XOR factory**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [x] Code Refactoring  ## Which issue(s) this PR fixes:  Refs #29249. This is one stage of the ongoing cleanup; the tracking issue remains open.  ## What this PR does / why we need it:  ### Existing owner and design  Route registered strict boolean XOR through the existing `opBinaryFixedFixedToFixed` execution owner and retire its single-caller generic factory and unused modes/constraints. Preserve registration, coercion, constant folding and SQL NULL semantics. Production use is not a reason to retain duplicate execution paths.  Reuse the existing selection publisher for unary and binary execution. Reject empty and fully masked work before evaluation; skip merged source/mask NULL rows before callbacks in single-constant paths. Keep the existing unmasked fast paths and constant evaluation behavior. No additional state machine or XOR compatibility execution path is introduced.  The old direct-call selection discrepancy is not claimed to be a demonstrated SQL wrong-result bug: the expression executor already compacts selected inputs. Both the shared owner and real registered consumer are validated here.  ### Coverage and independent QA  Retain the existing nine-cell XOR truth table and existing unary tests. Add exact value/type/length/NULL and callback-count checks for empty input, constant broadcasts, source NULLs, left/right constants, partial/short/t
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

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

### Incident Patch 1: `614ab464` (2026-10-05)
**Commit Message**: fix: preserve execution failures across pipeline cancellation (#29619)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Addresses #29588's confirmed execution-layer failure-to-success defect.
Attribution of the historical Chaos incident remains unverified.

## What this PR does / why we need it:

A producer failure after partial input could be normalized into success
when sibling cleanup canceled its pipeline. Preserve the producer's
frozen failure through terminal publication, nested scopes, remote
notifications and statement settlement, while retaining Compile's RC/SI
retry policy and concrete public error codes.

Successful consumer retirement also needs to stay control flow. The
PROXY BVT metadata query in `prepare_ddl_schema_change.sql:112` expected
count 0 but returned `internal error: pipeline consumer finished`: the
join-map error snapshot converted the new successful-stop sentinel to a
substantive internal error. Snapshot its immutable structural control
marker using the existing cancellation representation. The scope still
decides success

**File**: `pkg/sql/colexec/dispatch/dispatch_test.go` (modified, +61/-185)
```diff
@@ -345,8 +345,9 @@ func TestPrepareRemote(t *testing.T) {
 	// uuid map should have this pipeline information after prepare remote.
 	require.NoError(t, d.prepareRemote(proc))
 
-	p, c, b := colexec.GetServer("").GetProcByUuid(uid, false)
-	require.True(t, b)
+	p, c, attachState, lookupWaiter, _ := colexec.GetServer("").AttachProcByUuidOrWait(uid)
+	lookupWaiter.Close()
+	require.Equal(t, colexec.RemoteReceiverAttachedNow, attachState)
 	require.Equal(t, proc, p)
 	require.Equal(t, d.ctr.remoteInfo, c)
 }
@@ -377,40 +378,13 @@ func TestRegisterRemoteReceiversBeforePrepare(t *testing.T) {
 	require.NoError(t, d.Prepare(proc))
 	require.Equal(t, earlyNotifyCh, d.ctr.remoteInfo)
 
-	p, notifyCh, ok := colexec.GetServer("").GetProcByUuid(uid, false)
-	require.True(t, ok)
+	p, notifyCh, attachState, lookupWaiter, _ := colexec.GetServer("").AttachProcByUuidOrWait(uid)
+	lookupWaiter.Close()
+	require.Equal(t, colexec.RemoteReceiverAttachedNow, attachState)
 	require.Same(t, proc, p)
 	require.Equal(t, earlyNotifyCh, notifyCh)
 
-	colexec.GetServer("").DeleteUuids([]uuid.UUID{uid})
-}
-
-func TestRegisterRemoteReceiversRollbackOnPartialFailure(t *testing.T) {
-	_ = colexec.NewServer("")
-
-	proc := testutil.NewProcess(t)
-
-	uid1, err := uuid.NewV7()
-	require.NoError(t, err)
-	uid2, err := uuid.NewV7()
-	require.NoError(t, err)
-
-	colexec.GetServer("").GetProcByUuid(uid2, true)
-	d := Dispatch{
-		FuncId: SendToAllFunc,
-		RemoteRegs: []colexec.ReceiveInfo{
-			{Uuid: uid1},
-			{Uuid: uid2},
-		},
-	}
-
-	require.Error(t, d.RegisterRemoteReceivers(proc))
-	require.Nil(t, d.ctr.remoteInfo)
-
-	p, notifyCh, ok := colexec.GetServer("").GetProcByUuid(uid1, false)
-	require.False(t, ok)
-	require.Nil(t, p)
-	require.Nil(t, notifyCh)
+	registration.Cleanup()
 }
 
 func TestRegisterRemoteReceiversRollbackPreservesConflictingLiveOwner(t *testing.T) {
@@ -424,7 +398,7 @@ func TestRegisterRemoteReceiversRollbackPreservesConflictingLiveOwner(t *testing
 		server.RemoveUuidsOwned([]uuid.UUID{uid2}, ownerCh)
 	})
 
-	require.NoError(t, server.PutProcIntoUuidMap(uid2, ownerProc, ownerCh))
+	require.NoError(t, server.PutProcIntoUuidMapWithTerminal(uid2, ownerProc, ownerCh, colexec.NewRemoteReceiverTerminal(nil)))
 	d := Dispatch{
 		FuncId: SendToAllFunc,
 		RemoteRegs: []colexec.ReceiveInfo{
@@ -436,13 +410,15 @@ func TestRegisterRemoteReceiversRollbackPreservesConflictingLiveOwner(t *testing
 	require.Error(t, d.RegisterRemoteReceivers(proc))
 	require.Nil(t, d.ctr.remoteInfo)
 
-	registeredProc, notifyCh, ok := server.GetProcByUuid(uid1, false)
-	require.False(t, ok)
+	registeredProc, notifyCh, attachState, lookupWaiter, _ := server.AttachProcByUuidOrWait(uid1)
+	lookupWaiter.Close()
+	require.Equal(t, colexec.RemoteReceiverMissing, attachState)
 	require.Nil(t, registeredProc)
 	require.Nil(t, notifyCh)
 
-	registeredProc, notifyCh, ok = server.GetProcByUuid(uid2, false)
-	require.True(t, ok)
+	registeredProc, notifyCh, attachState, lookupWaiter, _ = server.AttachProcByUuidOrWait(uid2)
+	lookupWaiter.Close()
+	require.Equal(t, colexec.RemoteReceiverAttachedNow, attachState)
 	require.Same(t, ownerProc, registeredProc)
 	require.Equal(t, ownerCh, notifyCh)
 }
@@ -460,9 +436,10 @@ func TestRegisterRemoteReceiversRollbackPreservesConflictingAttachedOwner(t *tes
 		server.RemoveUuidsOwned([]uuid.UUID{uid2}, probeCh)
 	})
 
-	require.NoError(t, server.PutProcIntoUuidMap(uid2, ownerProc, ownerCh))
-	registeredProc, notifyCh, ok := server.GetProcByUuid(uid2, false)
-	require.True(t, ok)
+	require.NoError(t, server.PutProcIntoUuidMapWithTerminal(uid2, ownerProc, ownerCh, colexec.NewRemoteReceiverTerminal(nil)))
+	registeredProc, notifyCh, attachState, lookupWaiter, _ := server.AttachProcByUuidOrWait(uid2)
+	lookupWaiter.Close()
+	require.Equal(t, colexec.RemoteReceiverAttachedNow, attachState)
 	require.Same(t, ownerProc, registeredProc)
 	require.Equal(t, ownerCh, notifyCh)
 
@@ -477,14 +454,14 @@ func TestRegisterRemoteReceiversRollbackPreservesConflictingAttachedOwner(t *tes
 	require.Error(t, d.RegisterRemoteReceivers(proc))
 	require.Nil(t, d.ctr.remoteInfo)
 
-	registeredProc, notifyCh, ok = server.GetProcByUuid(uid1, false)
-	require.False(t, ok)
+	registeredProc, notifyCh, attachState, lookupWaiter, _ = server.AttachProcByUuidOrWait(uid1)
+	lookupWaiter.Close()
+	require.Equal(t, colexec.RemoteReceiverMissing, attachState)
 	require.Nil(t, registeredProc)
 	require.Nil(t, notifyCh)
 
-	// A second non-destructive conflict proves the attached owner survived;
-	// calling GetProcByUuid again would consume the attached entry.
-	err := server.PutProcIntoUuidMap(uid2, &process.Process{}, probeCh)
+	// A second conflict proves the attached owner survived rollback.
+	err := server.PutProcIntoUuidMapWithTerminal(uid2, &process.Process{}, probeCh, colexec.NewRemoteReceiverTerminal(nil))
 	require.Error(t, err)
 	require.Contains(t, err.Error(), "state: attached")
 }
@@ -514,8 +491,9 @@ func TestRemoteReceiverRegistrationCleanupCh
```

**File**: `pkg/sql/colexec/dispatch/sendfunc.go` (modified, +1/-20)
```diff
@@ -544,16 +544,6 @@ func sendBatchToClientSessionOutcome(
 		} else {
 			// Tolerant mode: acceptable for SendToAny scenarios
 			// We can try other receivers
-			// Use non-blocking send to avoid potential deadlock
-			if !wcs.TerminalBacked {
-				select {
-				case wcs.Err <- nil:
-					// Error notification sent successfully
-				default:
-					// Channel full or no receiver, that's acceptable
-					// Receiver will eventually timeout or get canceled via context
-				}
-			}
 			return sendBatchOutcome{receiverDone: true}, nil
 		}
 	}
@@ -563,7 +553,7 @@ func sendBatchToClientSessionOutcome(
 	if wcs.ReserveBatch != nil {
 		batchSequence, err = wcs.ReserveBatch(ctx, uint64(len(encodeBatData)))
 		if err != nil {
-			if (errors.Is(err, context.Canceled) || moerr.IsMoErrCode(err, moerr.ErrQueryInterrupted)) &&
+			if (errors.Is(err, context.Canceled) || errors.Is(err, process.ErrPipelineStopped)) &&
 				retireStoppedReceiver(ctx, wcs) {
 				return sendBatchOutcome{
 					receiverDone:      true,
@@ -635,14 +625,5 @@ func retireStoppedReceiver(ctx context.Context, wcs *process.WrapCs) bool {
 	if ctx.Err() != nil || wcs.ReceiverStopped == nil || !wcs.ReceiverStopped() {
 		return false
 	}
-	// The caller removes this receiver, so Reset will no longer notify its
-	// registration handler. Legacy registrations need a completion signal;
-	// terminal-backed registrations wait on their immutable generation result.
-	if !wcs.TerminalBacked {
-		select {
-		case wcs.Err <- nil:
-		default:
-		}
-	}
 	return true
 }
```

**File**: `pkg/sql/colexec/dispatch/types.go` (modified, +0/-29)
```diff
@@ -228,35 +228,6 @@ func (dispatch *Dispatch) Reset(proc *process.Process, pipelineFailed bool, err
 			if dispatch.ctr.remoteTerminal != nil {
 				dispatch.ctr.remoteTerminal.Finish(terminalErr)
 			}
-			for _, r := range dispatch.ctr.remoteReceivers {
-				if r != nil && r.TerminalBacked {
-					// The generation terminal above is the only terminal owner.
-					// A legacy Err write here would race the immutable result and
-					// can fill the compatibility channel during cleanup.
-					continue
-				}
-				if r == nil || r.Err == nil {
-					process.WarnPipelineCleanupf(
-						proc,
-						"dispatch_cleanup_remote_receiver_nil",
-						"dispatch cleanup skipped remote receiver error notification because receiver is nil: pipeline_failed=%t err=%v",
-						pipelineFailed,
-						terminalErr)
-					continue
-				}
-				select {
-				case r.Err <- terminalErr:
-				default:
-					process.WarnPipelineCleanupf(
-						proc,
-						"dispatch_cleanup_remote_err_channel_full",
-						"dispatch cleanup skipped remote receiver error notification because channel is full: receiver_uuid=%s msg_id=%d pipeline_failed=%t err=%v",
-						r.Uid.String(),
-						r.MsgId,
-						pipelineFailed,
-						terminalErr)
-				}
-			}
 
 			uuids := make([]uuid.UUID, 0, len(dispatch.RemoteRegs))
 			for i := range dispatch.RemoteRegs {
```

**File**: `pkg/sql/colexec/hashbuild/build.go` (modified, +6/-0)
```diff
@@ -175,6 +175,9 @@ func (hashBuild *HashBuild) sendJoinMap(proc *process.Process) error {
 		)
 	}
 	if atomic.LoadUint32(&ctr.terminalPublished) != 0 {
+		if proc.Ctx.Err() != nil {
+			return proc.Ctx.Err()
+		}
 		return moerr.NewQueryInterrupted(proc.Ctx)
 	}
 
@@ -222,6 +225,9 @@ func (hashBuild *HashBuild) sendJoinMap(proc *process.Process) error {
 	}
 
 	if !hashBuild.publishJoinMap(proc, jm) {
+		if proc.Ctx.Err() != nil {
+			return proc.Ctx.Err()
+		}
 		return moerr.NewQueryInterrupted(proc.Ctx)
 	}
 	joinMapOwned = false
```

**File**: `pkg/sql/colexec/server.go` (modified, +7/-55)
```diff
@@ -72,41 +72,6 @@ func MustGetServer(serviceID string) *Server {
 	return s
 }
 
-// GetProcByUuid used the uuid to get a process from the srv.
-// if the process is nil, it means the process has done.
-// if forcedDelete, do an action to avoid another routine to put a new item.
-func (srv *Server) GetProcByUuid(u uuid.UUID, forcedDelete bool) (*process.Process, process.RemotePipelineInformationChannel, bool) {
-	srv.uuidCsChanMap.Lock()
-	defer srv.uuidCsChanMap.Unlock()
-	return srv.getProcByUuidLocked(u, forcedDelete)
-}
-
-func (srv *Server) getProcByUuidLocked(u uuid.UUID, forcedDelete bool) (*process.Process, process.RemotePipelineInformationChannel, bool) {
-	p, ok := srv.uuidCsChanMap.mp[u]
-	if !ok {
-		if forcedDelete {
-			srv.uuidCsChanMap.mp[u] = uuidProcMapItem{
-				state: remoteReceiverTombstone,
-			}
-		}
-		return nil, nil, false
-	}
-
-	if p.state != remoteReceiverReady {
-		if !srv.retainClosedReceiverForWaitersLocked(u, p) {
-			delete(srv.uuidCsChanMap.mp, u)
-		}
-		return nil, nil, true
-	}
-	resultProc := p.proc
-	resultCh := p.ch
-	p.proc = nil
-	p.ch = nil
-	p.state = remoteReceiverAttached
-	srv.uuidCsChanMap.mp[u] = p
-	return resultProc, resultCh, true
-}
-
 // AttachProcByUuidOrWait atomically attaches one notify stream to a ready
 // receiver. Missing receivers return a generation-scoped wait handle.
 // Attached and closed receivers are terminal states and are not consumed or
@@ -157,7 +122,7 @@ func (srv *Server) AttachProcByUuidOrWait(
 			delete(srv.uuidCsChanMap.mp, u)
 		}
 		return nil, nil, RemoteReceiverFinished, nil, item.terminal
-	case remoteReceiverClosed, remoteReceiverTombstone:
+	case remoteReceiverClosed:
 		if !srv.retainClosedReceiverForWaitersLocked(u, item) {
 			delete(srv.uuidCsChanMap.mp, u)
 		}
@@ -200,10 +165,8 @@ func (w *RemoteReceiverWaiter) Close() {
 	})
 }
 
-func (srv *Server) PutProcIntoUuidMap(u uuid.UUID, p *process.Process, ch process.RemotePipelineInformationChannel) error {
-	return srv.PutProcIntoUuidMapWithTerminal(u, p, ch, nil)
-}
-
+// PutProcIntoUuidMapWithTerminal publishes one complete registration generation.
+// Its terminal remains the outcome owner after the Process has been recycled.
 func (srv *Server) PutProcIntoUuidMapWithTerminal(u uuid.UUID, p *process.Process, ch process.RemotePipelineInformationChannel, terminal *RemoteReceiverTerminal) error {
 	srv.uuidCsChanMap.Lock()
 	if item, ok := srv.uuidCsChanMap.mp[u]; ok {
@@ -215,18 +178,15 @@ func (srv *Server) PutProcIntoUuidMapWithTerminal(u uuid.UUID, p *process.Proces
 			oldState = "closed"
 		case remoteReceiverFinished:
 			oldState = "finished"
-		case remoteReceiverTombstone:
-			oldState = "tombstone"
-			delete(srv.uuidCsChanMap.mp, u)
 		}
 		srv.uuidCsChanMap.Unlock()
 		return moerr.NewInternalErrorNoCtxf(
 			"remote receiver %s already done (existing registry state: %s)", u.String(), oldState)
 	}
-	if p == nil || ch == nil {
+	if p == nil || ch == nil || terminal == nil {
 		srv.uuidCsChanMap.Unlock()
 		return moerr.NewInvalidStateNoCtxf(
-			"remote receiver %s requires a non-nil process and notification channel",
+			"remote receiver %s requires a non-nil process, notification channel, and terminal",
 			u.String(),
 		)
 	}
@@ -243,22 +203,14 @@ func (srv *Server) PutProcIntoUuidMapWithTerminal(u uuid.UUID, p *process.Proces
 	return nil
 }
 
-func (srv *Server) DeleteUuids(uuids []uuid.UUID) {
-	srv.closeRemoteReceivers(uuids, nil)
-}
-
 // CloseRemoteReceivers retains the terminal result only for this owner. A
 // delayed Reset must not close a replacement registration using the same UUID.
 func (srv *Server) CloseRemoteReceivers(uuids []uuid.UUID, ownerCh process.RemotePipelineInformationChannel) {
-	srv.closeRemoteReceivers(uuids, ownerCh)
-}
-
-func (srv *Server) closeRemoteReceivers(uuids []uuid.UUID, ownerCh process.RemotePipelineInformationChannel) {
 	srv.uuidCsChanMap.Lock()
 	defer srv.uuidCsChanMap.Unlock()
 	for i := range uuids {
 		p, ok := srv.uuidCsChanMap.mp[uuids[i]]
-		if !ok || (ownerCh != nil && p.ownerCh != ownerCh) {
+		if !ok || p.ownerCh != ownerCh {
 			continue
 		}
 
@@ -268,7 +220,7 @@ func (srv *Server) closeRemoteReceivers(uuids []uuid.UUID, ownerCh process.Remot
 		} else {
 			p.proc = nil
 			p.ch = nil
-			if (p.state == remoteReceiverReady || p.state == remoteReceiverFinished) && p.terminal != nil {
+			if p.state == remoteReceiverReady || p.state == remoteReceiverFinished {
 				p.state = remoteReceiverFinished
 			} else {
 				p.state = remoteReceiverClosed
```

**File**: `pkg/sql/colexec/server_test.go` (modified, +37/-43)
```diff
@@ -46,12 +46,13 @@ func TestServerIsIsolatedByCNService(t *testing.T) {
 	proc1 := &process.Process{}
 	ch0 := make(process.RemotePipelineInformationChannel)
 	ch1 := make(process.RemotePipelineInformationChannel)
-	require.NoError(t, server0.PutProcIntoUuidMap(uid, proc0, ch0))
-	require.NoError(t, server1.PutProcIntoUuidMap(uid, proc1, ch1))
+	require.NoError(t, server0.PutProcIntoUuidMapWithTerminal(uid, proc0, ch0, NewRemoteReceiverTerminal(nil)))
+	require.NoError(t, server1.PutProcIntoUuidMapWithTerminal(uid, proc1, ch1, NewRemoteReceiverTerminal(nil)))
 
 	server1.RemoveUuidsOwned([]uuid.UUID{uid}, ch1)
-	gotProc, gotCh, ok := server0.GetProcByUuid(uid, false)
-	require.True(t, ok)
+	gotProc, gotCh, attachState, lookupWaiter, _ := server0.AttachProcByUuidOrWait(uid)
+	lookupWaiter.Close()
+	require.Equal(t, RemoteReceiverAttachedNow, attachState)
 	require.Same(t, proc0, gotProc)
 	require.Equal(t, ch0, gotCh)
 }
@@ -69,14 +70,15 @@ func TestPutProcIntoUuidMapConflictIncludesUuidAndState(t *testing.T) {
 			srv.RemoveUuidsOwned([]uuid.UUID{uid}, conflictingCh)
 		})
 
-		require.NoError(t, srv.PutProcIntoUuidMap(uid, ownerProc, ownerCh))
-		err := srv.PutProcIntoUuidMap(uid, &process.Process{}, conflictingCh)
+		require.NoError(t, srv.PutProcIntoUuidMapWithTerminal(uid, ownerProc, ownerCh, NewRemoteReceiverTerminal(nil)))
+		err := srv.PutProcIntoUuidMapWithTerminal(uid, &process.Process{}, conflictingCh, NewRemoteReceiverTerminal(nil))
 		require.Error(t, err)
 		require.Contains(t, err.Error(), uid.String())
 		require.Contains(t, err.Error(), "state: ready")
 
-		gotProc, gotCh, ok := srv.GetProcByUuid(uid, false)
-		require.True(t, ok)
+		gotProc, gotCh, attachState, lookupWaiter, _ := srv.AttachProcByUuidOrWait(uid)
+		lookupWaiter.Close()
+		require.Equal(t, RemoteReceiverAttachedNow, attachState)
 		require.Same(t, ownerProc, gotProc)
 		require.Equal(t, ownerCh, gotCh)
 	})
@@ -91,13 +93,14 @@ func TestPutProcIntoUuidMapConflictIncludesUuidAndState(t *testing.T) {
 			srv.RemoveUuidsOwned([]uuid.UUID{uid}, conflictingCh)
 		})
 
-		require.NoError(t, srv.PutProcIntoUuidMap(uid, ownerProc, ownerCh))
-		gotProc, gotCh, ok := srv.GetProcByUuid(uid, false)
-		require.True(t, ok)
+		require.NoError(t, srv.PutProcIntoUuidMapWithTerminal(uid, ownerProc, ownerCh, NewRemoteReceiverTerminal(nil)))
+		gotProc, gotCh, attachState, lookupWaiter, _ := srv.AttachProcByUuidOrWait(uid)
+		lookupWaiter.Close()
+		require.Equal(t, RemoteReceiverAttachedNow, attachState)
 		require.Same(t, ownerProc, gotProc)
 		require.Equal(t, ownerCh, gotCh)
 
-		err := srv.PutProcIntoUuidMap(uid, &process.Process{}, conflictingCh)
+		err := srv.PutProcIntoUuidMapWithTerminal(uid, &process.Process{}, conflictingCh, NewRemoteReceiverTerminal(nil))
 		require.Error(t, err)
 		require.Contains(t, err.Error(), uid.String())
 		require.Contains(t, err.Error(), "state: attached")
@@ -113,39 +116,24 @@ func TestPutProcIntoUuidMapConflictIncludesUuidAndState(t *testing.T) {
 		require.Equal(t, ownerCh, item.ownerCh)
 	})
 
-	t.Run("tombstone", func(t *testing.T) {
-		uid := uuid.Must(uuid.NewV7())
-		srv.GetProcByUuid(uid, true)
-		conflictingCh := make(process.RemotePipelineInformationChannel)
-		t.Cleanup(func() {
-			srv.RemoveUuidsOwned([]uuid.UUID{uid}, conflictingCh)
-		})
-
-		err := srv.PutProcIntoUuidMap(uid, &process.Process{}, conflictingCh)
-		require.Error(t, err)
-		require.Contains(t, err.Error(), uid.String())
-		require.Contains(t, err.Error(), "state: tombstone")
-
-		srv.uuidCsChanMap.Lock()
-		_, exists := srv.uuidCsChanMap.mp[uid]
-		srv.uuidCsChanMap.Unlock()
-		require.False(t, exists)
-	})
 }
 
 func TestPutProcIntoUuidMapRejectsIncompleteRegistration(t *testing.T) {
 	srv := NewServer("")
 
 	uid := uuid.Must(uuid.NewV7())
-	err := srv.PutProcIntoUuidMap(
+	err := srv.PutProcIntoUuidMapWithTerminal(
 		uid,
 		nil,
 		make(process.RemotePipelineInformationChannel),
+		NewRemoteReceiverTerminal(nil),
 	)
 	require.ErrorContains(t, err, "requires a non-nil process")
 
-	err = srv.PutProcIntoUuidMap(uid, &process.Process{}, nil)
+	err = srv.PutProcIntoUuidMapWithTerminal(uid, &process.Process{}, nil, NewRemoteReceiverTerminal(nil))
 	require.ErrorContains(t, err, "requires a non-nil process")
+	err = srv.PutProcIntoUuidMapWithTerminal(uid, &process.Process{}, make(process.RemotePipelineInformationChannel), nil)
+	require.ErrorContains(t, err, "terminal")
 
 	srv.uuidCsChanMap.Lock()
 	_, exists := srv.uuidCsChanMap.mp[uid]
@@ -209,11 +197,13 @@ func TestAttachProcByUuidOrWaitPreservesTerminalOwner(t *testing.T) {
 		uid := uuid.Must(uuid.NewV7())
 		ownerProc := &process.Process{}
 		ownerCh := make(process.RemotePipelineInformationChannel)
-		require.NoError(t, srv.PutProcIntoUuidMap(uid, ownerProc, ownerCh))
+		require.NoError(t, srv.PutProcIntoUuidMapWithTerminal(uid, ownerProc, ownerCh, NewRemoteReceiverTerminal(nil)))
 		t.Cleanup(func() {
 			srv.RemoveUuidsOwned([]uuid.UUID{uid}, ownerCh)
 		})
 
+		srv.
```

**File**: `pkg/sql/colexec/types.go` (modified, +4/-5)
```diff
@@ -76,15 +76,15 @@ type rpcClientItem struct {
 
 type runningPipelineInfo struct {
 	alreadyDone bool
-	// StopSending is a downstream early-stop signal. It owns this remote
-	// pipeline tree, not the query that may still have other active pipelines.
+	// StopSending owns one remote pipeline tree or an unconsumed notify
+	// wait, not the query that may still have other active pipelines.
 	pipelineCancel context.CancelCauseFunc
 
 	isDispatch bool
 	receiver   *process.WrapCs
 }
 
-func (info *runningPipelineInfo) cancelPipeline() {
+func (info *runningPipelineInfo) cancelPipeline(cause error) {
 	// If this was a pipeline responsible for distributing data, we cannot end this
 	// because we are just one of the receivers.
 	if info.isDispatch {
@@ -94,7 +94,7 @@ func (info *runningPipelineInfo) cancelPipeline() {
 
 	} else {
 		if info.pipelineCancel != nil {
-			info.pipelineCancel(nil)
+			info.pipelineCancel(cause)
 		}
 	}
 }
@@ -113,7 +113,6 @@ const (
 	remoteReceiverReady remoteReceiverRegistryState = iota
 	remoteReceiverAttached
 	remoteReceiverClosed
-	remoteReceiverTombstone
 	remoteReceiverFinished
 )
 
```

**File**: `pkg/sql/colexec/types2.go` (modified, +23/-14)
```diff
@@ -15,6 +15,9 @@
 package colexec
 
 import (
+	"context"
+
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/morpc"
 	"github.com/matrixorigin/matrixone/pkg/logutil"
 	"github.com/matrixorigin/matrixone/pkg/vm/process"
@@ -33,8 +36,11 @@ func (srv *Server) RecordDispatchPipeline(
 	srv.receivedRunningPipeline.Lock()
 	defer srv.receivedRunningPipeline.Unlock()
 
+	// Carry the stream-local wait owner through attachment. Ordinary dispatch
+	// registrations have no such callback and retain their shared ownership.
+	previous, registered := srv.receivedRunningPipeline.fromRpcClientToRelatedPipeline[key]
 	// check if sender has sent a stop running message.
-	if v, ok := srv.receivedRunningPipeline.fromRpcClientToRelatedPipeline[key]; ok && v.alreadyDone {
+	if v := previous; registered && v.alreadyDone {
 		// Fix: Check if this is a stale record created by CancelPipelineSending
 		// before RecordDispatchPipeline was called (race condition).
 		// If receiver is nil, it means CancelPipelineSending created this record
@@ -63,7 +69,7 @@ func (srv *Server) RecordDispatchPipeline(
 	value := runningPipelineInfo{
 		alreadyDone:    false,
 		isDispatch:     true,
-		pipelineCancel: nil,
+		pipelineCancel: previous.pipelineCancel,
 		receiver:       dispatchReceiver,
 	}
 
@@ -77,20 +83,22 @@ func (srv *Server) RecordDispatchPipeline(
 func (srv *Server) RecordBuiltPipeline(
 	session morpc.ClientSession, streamID uint64, proc *process.Process) {
 
-	key := generateRecordKey(session, streamID)
-
-	// The compile process context is the parent of every scope in this remote
-	// pipeline tree. Cancel that tree on StopSending without canceling the query
-	// context, whose lifetime is owned by the query/client cancellation path.
-	pipelineCancel := proc.Cancel
+	// StopSending owns the remote pipeline tree, not its query context.
+	srv.RecordPipelineCancellation(session, streamID, proc.Cancel)
+}
 
+// RecordPipelineCancellation also owns a notify's wait before its Dispatch
+// exists. Reuse the stream tombstone and session cleanup for both owners.
+func (srv *Server) RecordPipelineCancellation(
+	session morpc.ClientSession, streamID uint64, pipelineCancel context.CancelCauseFunc) {
+	key := generateRecordKey(session, streamID)
 	srv.receivedRunningPipeline.Lock()
 	defer srv.receivedRunningPipeline.Unlock()
 
 	// check if sender has sent a stop running message.
 	if v, ok := srv.receivedRunningPipeline.fromRpcClientToRelatedPipeline[key]; ok && v.alreadyDone {
 		if pipelineCancel != nil {
-			pipelineCancel(nil)
+			pipelineCancel(process.ErrPipelineStopped)
 		}
 		return
 	}
@@ -123,11 +131,12 @@ func (srv *Server) CancelPipelineSending(
 			zap.Bool("hasReceiver", v.receiver != nil),
 			zap.Bool("isDispatch", v.isDispatch))
 
-		if !v.isDispatch {
-			// Only cancel non-dispatch pipelines (query execution pipelines)
-			logutil.Debug("CancelPipelineSending canceling non-dispatch pipeline",
+		if v.pipelineCancel != nil {
+			// A notify's callback retires only its subscription after the
+			// handoff; it never cancels the shared Dispatch producer.
+			logutil.Debug("CancelPipelineSending canceling stream owner",
 				zap.Uint64("streamID", streamID))
-			v.cancelPipeline()
+			v.pipelineCancel(process.ErrPipelineStopped)
 		}
 		return
 	}
@@ -192,6 +201,6 @@ func (srv *Server) cleanupPipelinesForSession(session morpc.ClientSession) {
 	srv.receivedRunningPipeline.Unlock()
 
 	for i := range infos {
-		infos[i].cancelPipeline()
+		infos[i].cancelPipeline(moerr.NewStreamClosedNoCtx())
 	}
 }
```

---

### Incident Patch 2: `a2673829` (2026-10-05)
**Commit Message**: test: make process fixture resource ownership explicit (#29629)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29630. Refs #29249 and #29627. This is the constructor ownership
and immediate consumer stage of #29627; the issue remains open for the
nil-fixture/planner/remaining-owner migration.

## What this PR does / why we need it:

Process fixtures previously registered a default pool before applying
options, leaving an unreachable registered pool when the caller supplied
its own. File-service options similarly constructed and discarded three
unnecessary services and could close an earlier supplied dependency.
Partial construction could retain pool registrations even with zero byte
usage.

Resolve options before acquiring defaults, preserve explicit nil and
last-option semantics, and borrow supplied pools/services/clients. A
single constructor now owns default resources for the actual TB
lifetime, captures the acquired resources independently of later
process-field replacements, and unwinds partial acquisition on panic or
Goexit. A nil TB

**File**: `cmd/mo-service/debug_test.go` (modified, +7/-1)
```diff
@@ -68,6 +68,12 @@ func Test_saveProfile4(t *testing.T) {
 }
 
 func Test_saveMallocProfile5(t *testing.T) {
-	globalEtlFS = testutil.NewFS(t)
+	previous := globalEtlFS
+	fs := testutil.NewFS(t)
+	t.Cleanup(func() {
+		globalEtlFS = previous
+		fs.Close(context.Background())
+	})
+	globalEtlFS = fs
 	saveMallocProfile()
 }
```

**File**: `pkg/cnservice/sirius_embedded_test.go` (modified, +0/-1)
```diff
@@ -219,7 +219,6 @@ func TestEmbeddedSiriusExecutionOutputAndTerminalCleanup(t *testing.T) {
 	for _, outcome := range []string{"success", "output error", "invalid output", "cleanup error", "fatal", "not terminal", "zero first-row latency", "empty result"} {
 		t.Run(outcome, func(t *testing.T) {
 			proc := testutil.NewProcess(t)
-			t.Cleanup(proc.Free)
 			data := make([]byte, 8)
 			binary.LittleEndian.PutUint64(data, 42)
 			q := &embeddedPreparedRecorder{results: []siriusbridge.Result{{Rows: 1, Backing: data, Vectors: []siriusbridge.Vector{{Data: data}}}}, ready: outcome != "not terminal", stats: siriusbridge.ExecutionStats{Terminal: true, SourceMask: 1, Fatal: outcome == "fatal"}}
```

**File**: `pkg/cnservice/sirius_result_test.go` (modified, +0/-2)
```diff
@@ -29,7 +29,6 @@ import (
 
 func TestEmbeddedSiriusResultBorrowsCheckedFixedAndVarlena(t *testing.T) {
 	proc := testutil.NewProcess(t)
-	t.Cleanup(proc.Free)
 	data := make([]byte, 16+2*types.VarlenaSize+25)
 	binary.LittleEndian.PutUint64(data, 42)
 	strings := data[16 : 16+2*types.VarlenaSize]
@@ -56,7 +55,6 @@ func TestEmbeddedSiriusResultBorrowsCheckedFixedAndVarlena(t *testing.T) {
 
 func TestEmbeddedSiriusResultRejectsMalformedLayoutBeforeBorrowing(t *testing.T) {
 	proc := testutil.NewProcess(t)
-	t.Cleanup(proc.Free)
 	request := compile.SiriusPrepareRequest{Headings: []string{"s"}, OutputTypes: []planpb.Type{{Id: int32(types.T_varchar), NotNullable: true}}}
 	for _, mutate := range []func(*siriusbridge.Vector){
 		func(v *siriusbridge.Vector) { v.Class = 1 },
```

**File**: `pkg/frontend/computation_wrapper_test.go` (modified, +0/-2)
```diff
@@ -6572,7 +6572,6 @@ func TestBuildExecuteUserParamsPreservesExplicitTextOverride(t *testing.T) {
 
 func TestPreparedBinaryIntegerCastDiagnosticProofBoundary(t *testing.T) {
 	proc := testutil.NewProcess(t)
-	t.Cleanup(proc.Free)
 	for _, tc := range []struct {
 		name      string
 		value     string
@@ -6646,7 +6645,6 @@ func TestPreparedBinaryIntegerCastDiagnosticProofBoundary(t *testing.T) {
 
 func TestPreparedBinaryIntegerSerialDiagnosticProofBoundary(t *testing.T) {
 	proc := testutil.NewProcess(t)
-	t.Cleanup(proc.Free)
 	params := vector.NewVec(types.T_text.ToType())
 	require.NoError(t, vector.AppendBytes(params, []byte("1"), false, proc.Mp()))
 	require.NoError(t, vector.AppendBytes(params, []byte("2"), false, proc.Mp()))
```

**File**: `pkg/fulltext2/plugin/plan/plan_cover_test.go` (modified, +2/-4)
```diff
@@ -34,7 +34,6 @@ import (
 	planplugin "github.com/matrixorigin/matrixone/pkg/indexplugin/plan"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
-	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/matrixorigin/matrixone/pkg/vm/process"
 )
 
@@ -93,9 +92,8 @@ type stubCompilerContext struct{ ctx context.Context }
 
 func (c stubCompilerContext) GetContext() context.Context { return c.ctx }
 
-// GetProcess hands back a test process on the default service runtime, which carries
-// MORPCLatestVersion -- so these tests plan as a fully activated deployment.
-func (c stubCompilerContext) GetProcess() *process.Process { return testutil.NewProcess(nil) }
+// These tested paths do not require a process or service runtime.
+func (c stubCompilerContext) GetProcess() *process.Process { return nil }
 
 func (c stubCompilerContext) ResolveVariable(string, bool, bool) (interface{}, error) {
 	return nil, nil
```

**File**: `pkg/sql/colexec/dedupjoin/join_test.go` (modified, +0/-8)
```diff
@@ -344,7 +344,6 @@ func TestDedupResetNotifiesOnlySharedBuildMerger(t *testing.T) {
 
 func TestDedupResetReportsWorkerFailure(t *testing.T) {
 	proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-	t.Cleanup(proc.Free)
 	mailbox := NewWorkerJoinMailbox(2)
 	arg := &DedupJoin{
 		NumCPU:   2,
@@ -1184,7 +1183,6 @@ func TestReceiveWorkerMsg_RejectsMissingMailboxAndNilStatus(t *testing.T) {
 func TestDedupFinalizeWorkerPublicationBoundaries(t *testing.T) {
 	t.Run("missing mailbox", func(t *testing.T) {
 		proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-		t.Cleanup(proc.Free)
 		worker := &DedupJoin{
 			NumCPU:   2,
 			IsMerger: false,
@@ -1196,7 +1194,6 @@ func TestDedupFinalizeWorkerPublicationBoundaries(t *testing.T) {
 
 	t.Run("canceled before publication", func(t *testing.T) {
 		proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-		t.Cleanup(proc.Free)
 		ctx, cancel := context.WithCancel(proc.Ctx)
 		cancel()
 		proc.Ctx = ctx
@@ -1213,7 +1210,6 @@ func TestDedupFinalizeWorkerPublicationBoundaries(t *testing.T) {
 
 	t.Run("merger already stopped", func(t *testing.T) {
 		proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-		t.Cleanup(proc.Free)
 		mailbox := NewWorkerJoinMailbox(2)
 		mailbox.stopAndDrain(proc)
 		worker := &DedupJoin{
@@ -1229,7 +1225,6 @@ func TestDedupFinalizeWorkerPublicationBoundaries(t *testing.T) {
 
 	t.Run("full mailbox", func(t *testing.T) {
 		proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-		t.Cleanup(proc.Free)
 		mailbox := NewWorkerJoinMailbox(1)
 		sent, stopped, _ := mailbox.trySend(&WorkerJoinMsg{})
 		require.True(t, sent)
@@ -1289,7 +1284,6 @@ func TestWorkerJoinMailboxStopAndSendHaveSingleCaptureOwner(t *testing.T) {
 
 func TestWorkerJoinMailboxReopensAfterCompleteResetGeneration(t *testing.T) {
 	proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-	t.Cleanup(proc.Free)
 	mailbox := NewWorkerJoinMailbox(2)
 
 	mailbox.stopAndDrain(proc)
@@ -1496,7 +1490,6 @@ func TestDedupFinalizeNormalAbortDoesNotHideCancellation(t *testing.T) {
 
 func TestDedupFinalizeMailboxSupportsMultipleSpillBuckets(t *testing.T) {
 	proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-	t.Cleanup(proc.Free)
 	mailbox := NewWorkerJoinMailbox(3)
 	workers := []*DedupJoin{
 		{
@@ -1558,7 +1551,6 @@ func TestDedupFinalizeMailboxSupportsMultipleSpillBuckets(t *testing.T) {
 
 func TestDedupFinalizeResetPublishesAbortForNextSpillBucket(t *testing.T) {
 	proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-	t.Cleanup(proc.Free)
 
 	mailbox := NewWorkerJoinMailbox(2)
 	worker := &DedupJoin{
```

**File**: `pkg/sql/colexec/evalExpressionAllocation_test.go` (modified, +0/-1)
```diff
@@ -190,7 +190,6 @@ func TestAccountedFixedCrossDomainConstBroadcastUsesPhysicalMetadata(t *testing.
 
 func TestAccountedLiteralConstructorReleasesPayloadOnDomainDenial(t *testing.T) {
 	proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
-	t.Cleanup(proc.Free)
 	registry, err := mpool.NewAllocationAccountRegistry(1, 16)
 	require.NoError(t, err)
 	// One inline varlen cell and its NULL bitmap fit; the text-domain bitmap does not.
```

**File**: `pkg/sql/colexec/evalExpression_test.go` (modified, +7/-4)
```diff
@@ -15,6 +15,7 @@
 package colexec
 
 import (
+	"context"
 	"fmt"
 	"math"
 	"testing"
@@ -3992,9 +3993,10 @@ func TestLastDayPersistedVarcharABI(t *testing.T) {
 }
 
 func TestDecimalCastSelectionAndErrorReuse(t *testing.T) {
-	proc := testutil.NewProcess(nil)
+	fs := testutil.NewFS(nil)
+	t.Cleanup(func() { fs.Close(context.Background()) })
+	proc := testutil.NewProcess(t, testutil.WithFileService(fs))
 	t.Cleanup(func() {
-		proc.Base.FileService.Close(proc.Ctx)
 		proc.Free()
 		require.Zero(t, proc.Mp().CurrNB())
 	})
@@ -4052,9 +4054,10 @@ func TestDecimalCastSelectionAndErrorReuse(t *testing.T) {
 }
 
 func TestDecimalWideningEmptyBatchReuse(t *testing.T) {
-	proc := testutil.NewProcess(nil)
+	fs := testutil.NewFS(nil)
+	t.Cleanup(func() { fs.Close(context.Background()) })
+	proc := testutil.NewProcess(t, testutil.WithFileService(fs))
 	t.Cleanup(func() {
-		proc.Base.FileService.Close(proc.Ctx)
 		proc.Free()
 		require.Zero(t, proc.Mp().CurrNB())
 	})
```

---

### Incident Patch 3: `35e750e7` (2026-10-05)
**Commit Message**: fix(plan): retain prepared NTILE integer context for text parameters (#29632)

## Summary

Fixes #29631.

Restore the integer consumer context for prepared `NTILE(?)` when
execution-time source rebinding supplies a MySQL string type. Use the
existing **strict implicit INT64 cast**, retaining the original string
ParamRef; do not change the NTILE overload checker, bucket algorithm,
ordinary string-column behavior, or cache policy.

This closes the numeric-string portion of the [accepted #26867
contract](https://github.com/matrixorigin/matrixone/issues/26867#issuecomment-5266007198).
Current Main still accepts integer 1/2/5 but rejects text `"2"` during
planning, so this is not a blanket claim that the original integer bug
returned.

## Root cause and scope

`BuildPreparedExecutionPlan` rebuilds the query using the current
parameter source domain. The PREPARE-only numeric binder does not
install NTILE's INT64 context in this path; its consumer handling
restores ANY/NULL but missed text. An unconverted TEXT/VARCHAR marker
therefore reaches the integer-only window type checker and fails before
NTILE bucket execution.

The only production change extends that existing NTILE consumer case 

**File**: `pkg/embed/prepared_specialized_domains_test.go` (modified, +115/-11)
```diff
@@ -24,6 +24,7 @@ import (
 	"time"
 
 	"github.com/RoaringBitmap/roaring/v2"
+	"github.com/go-sql-driver/mysql"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/stretchr/testify/require"
 )
@@ -302,22 +303,125 @@ func TestPreparedSpecializedDomains(t *testing.T) {
 			require.Equal(t, want, query(t, "select id from floating_filters where cast(v+1e0 as double)=1e0 or v=2e0 order by id"))
 			require.Equal(t, want, query(t, "select id from floating_filters where v+1e0=1e0 or v=2e0 order by id"))
 		})
-		t.Run("ntile_null_runtime_error", func(t *testing.T) {
+		t.Run("ntile_prepared_bucket_domains", func(t *testing.T) {
+			cleanupSQL := func(t *testing.T, statement string) {
+				t.Helper()
+				cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
+				defer cleanupCancel()
+				_, cleanupErr := conn.ExecContext(cleanupCtx, statement)
+				require.NoError(t, cleanupErr, statement)
+			}
 			exec(t, "create table ntile_source(id int)")
+			defer cleanupSQL(t, "drop table ntile_source")
 			exec(t, "insert into ntile_source values (1),(2)")
-			exec(t, "prepare ntile_buckets from 'select ntile(?) over (order by id) from ntile_source'")
-			defer conn.ExecContext(ctx, "deallocate prepare ntile_buckets")
-			exec(t, "set @buckets = 2")
-			require.Equal(t, [][]string{{"1"}, {"2"}}, query(t, "execute ntile_buckets using @buckets"))
-			exec(t, "set @buckets = null")
-			rows, err := conn.QueryContext(ctx, "execute ntile_buckets using @buckets")
-			if rows != nil {
-				defer rows.Close()
+			readBuckets := func(rows *sql.Rows) ([][2]int64, error) {
+				var got [][2]int64
 				for rows.Next() {
+					var row [2]int64
+					if err := rows.Scan(&row[0], &row[1]); err != nil {
+						return nil, err
+					}
+					got = append(got, row)
 				}
-				err = rows.Err()
+				return got, nil
+			}
+			const statement = "select id,ntile(?) over (order by id) from ntile_source order by id"
+			oneBucket := [][2]int64{{1, 1}, {2, 1}}
+			twoBuckets := [][2]int64{{1, 1}, {2, 2}}
+			for _, protocol := range []string{"binary_protocol", "sql_execute"} {
+				t.Run(protocol, func(t *testing.T) {
+					var run func(any, string) ([][2]int64, error)
+					if protocol == "binary_protocol" {
+						stmt, err := conn.PrepareContext(ctx, statement)
+						require.NoError(t, err)
+						defer stmt.Close()
+						run = func(input any, _ string) ([][2]int64, error) {
+							rows, err := stmt.QueryContext(ctx, input)
+							if rows != nil {
+								defer rows.Close()
+							}
+							if err != nil {
+								return nil, err
+							}
+							got, err := readBuckets(rows)
+							if err != nil {
+								return nil, err
+							}
+							return got, rows.Err()
+						}
+					} else {
+						exec(t, "prepare ntile_buckets from '"+statement+"'")
+						defer cleanupSQL(t, "deallocate prepare ntile_buckets")
+						defer cleanupSQL(t, "set @buckets = null")
+						run = func(_ any, assignment string) ([][2]int64, error) {
+							if _, err := conn.ExecContext(ctx, "set @buckets = "+assignment); err != nil {
+								return nil, err
+							}
+							rows, err := conn.QueryContext(ctx, "execute ntile_buckets using @buckets")
+							if rows != nil {
+								defer rows.Close()
+							}
+							if err != nil {
+								return nil, err
+							}
+							got, err := readBuckets(rows)
+							if err != nil {
+								return nil, err
+							}
+							return got, rows.Err()
+						}
+					}
+					// Fixed answers for the same two input rows, not results of
+					// a second server query. Each protocol reuses one handle.
+					for _, tc := range []struct {
+						name, assignment string
+						input            any
+						want             [][2]int64
+					}{
+						{"integer_one", "1", int64(1), oneBucket},
+						{"integer_two", "2", int64(2), twoBuckets},
+						{"more_buckets_than_rows", "5", int64(5), twoBuckets},
+						{"text_two", "'2'", "2", twoBuckets},
+						{"text_one", "'1'", "1", oneBucket},
+						{"text_five", "'5'", "5", twoBuckets},
+						{"integer_recovery", "2", int64(2), twoBuckets},
+					} {
+						t.Run(tc.name, func(t *testing.T) {
+							got, err := run(tc.input, tc.assignment)
+							require.NoError(t, err)
+							require.Equal(t, tc.want, got)
+						})
+					}
+					for _, tc := range []struct {
+						name, assignment, cause string
+						input                   any
+					}{
+						{"zero", "0", "ntile bucket count must be positive", int64(0)},
+						{"negative", "-1", "ntile bucket count must be positive", int64(-1)},
+						{"null", "null", "ntile bucket count cannot be NULL", nil},
+						{"fractional", "cast(2.5 as double)", "invalid argument function ntile", float64(2.5)},
+						{"fractional_text", "'2.5'", "invalid argument cast to int", "2.5"},
+						{"invalid_text", "'bad'", "invalid argument cast to int", "bad"},
+						{"numeric_prefix", "'2tail'", "invalid argument cast to int", "2tail"},
+						{"integer_overflow", "'9223372036854775808'", "o
```

**File**: `pkg/sql/plan/prepared_aggregate_params_test.go` (modified, +49/-2)
```diff
@@ -24,6 +24,8 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
 	"github.com/stretchr/testify/require"
 )
@@ -852,8 +854,8 @@ func TestPreparedDMLRuntimeSpecializationPreservesWriteParameters(t *testing.T)
 }
 
 func TestPreparedNtileParameter(t *testing.T) {
-	prepare := buildPreparedAggregatePlan(t,
-		"select n_nationkey, ntile(?) over (partition by n_regionkey order by n_nationkey) from nation")
+	const sql = "select n_nationkey, ntile(?) over (partition by n_regionkey order by n_nationkey) from nation"
+	prepare := buildPreparedAggregatePlan(t, sql)
 	require.Equal(t, []int32{int32(types.T_any)}, prepare.ParamTypes)
 	require.Equal(t, []int32{0}, preparedParamPositions(prepare))
 
@@ -867,6 +869,51 @@ func TestPreparedNtileParameter(t *testing.T) {
 	require.NotSame(t, first, second)
 	require.Equal(t, []int32{0}, preparedParamPositions(prepare))
 	require.Equal(t, originalTypes, preparedEffectiveParamTypes(t, prepare))
+
+	// EXECUTE now binds the current source type before optimization instead
+	// of merely filling the PREPARE template. Its integer consumer must keep
+	// the string ParamRef and perform a strict conversion at execution time.
+	template := prepare.Plan.String()
+	for _, source := range []types.T{types.T_text, types.T_varchar} {
+		t.Run("runtime_source/"+source.String(), func(t *testing.T) {
+			stmt, err := parsers.ParseOne(context.Background(), dialect.MYSQL, sql, 1)
+			require.NoError(t, err)
+			t.Cleanup(stmt.Free)
+			mock := NewMockOptimizer(false)
+			proc := mock.ctxt.GetProcess()
+			params := vector.NewVec(types.T_text.ToType())
+			t.Cleanup(func() { proc.SetPrepareParams(nil); params.Free(proc.Mp()) })
+			require.NoError(t, vector.AppendBytes(params, []byte("2"), false, proc.Mp()))
+			proc.SetPrepareParams(params)
+			sourceType := source.ToType()
+			bound, err := BuildPreparedExecutionPlan(&mock.ctxt, stmt,
+				[]PreparedSourceBinding{{Position: 0, Type: sourceType}},
+				[]any{ParamValue{Value: "2", SourceType: sourceType, HasSourceType: true, IsBinaryProtocol: true}})
+			require.NoError(t, err)
+			var argument *planpb.Expr
+			require.NoError(t, planpb.VisitExpressionsInOwner(bound.Plan, func(root *planpb.Expr) error {
+				return planpb.VisitExprTree(root, func(expr *planpb.Expr) error {
+					if fn := expr.GetF(); fn != nil && fn.Func.GetObjName() == "ntile" {
+						require.Len(t, fn.Args, 1)
+						argument = fn.Args[0]
+					}
+					return nil
+				})
+			}))
+			require.NotNil(t, argument, "execution plan must contain NTILE")
+			require.Equal(t, int32(types.T_int64), argument.Typ.Id)
+			cast := argument.GetF()
+			require.NotNil(t, cast)
+			require.Equal(t, "cast", cast.Func.GetObjName())
+			require.False(t, cast.GetSyntaxExplicitCast(), "implicit bucket conversion must not use explicit CAST prefix semantics")
+			require.Len(t, cast.Args, 2)
+			require.Equal(t, int32(source), cast.Args[0].Typ.Id)
+			require.NotNil(t, cast.Args[0].GetP(), "a cached plan must read each EXECUTE's current parameter")
+			require.Zero(t, cast.Args[0].GetP().Pos)
+			require.False(t, bound.ValueDependent, "bucket conversion must not depend on the current string value")
+			require.Equal(t, template, prepare.Plan.String(), "EXECUTE must not mutate the PREPARE template")
+		})
+	}
 }
 
 func TestPreparedLagLeadOffsetParameter(t *testing.T) {
```

**File**: `pkg/sql/plan/prepared_binding.go` (modified, +6/-3)
```diff
@@ -617,9 +617,12 @@ func bindPreparedConsumerArguments(ctx context.Context, name string, args []*Exp
 			if target.Oid == types.T_any && (binding.Type.Oid.IsMySQLString() || binding.Type.Oid == types.T_any) {
 				target = types.T_varbinary.ToType()
 			}
-		case name == "ntile" && len(args) == 1 && binding.Type.Oid == types.T_any:
-			// Keep a NULL bucket count executable so NTILE reports its
-			// runtime argument error instead of a binder ANY overload error.
+		case name == "ntile" && len(args) == 1 &&
+			(binding.Type.Oid == types.T_any || binding.Type.Oid.IsMySQLString()):
+			// Rebinding must retain NTILE's prepared integer consumer for
+			// numeric text, without changing the marker's source domain.
+			// The implicit cast rejects fractional/invalid text; NULL still
+			// reaches NTILE's runtime argument check.
 			target = types.T_int64.ToType()
 		case len(args) == 1 && binding.Type.Oid.IsMySQLString() &&
 			(name == "sum" || name == "avg"):
```

**File**: `test/distributed/cases/prepare/prepared_numeric_aggregate.result` (modified, +31/-0)
```diff
@@ -45,9 +45,40 @@ EXECUTE p_ntile USING @value;
 2  ¦  1  𝄀
 3  ¦  2  𝄀
 4  ¦  1
+SET @value = '2';
+EXECUTE p_ntile USING @value;
+➤ id[4,32,0]  ¦  bucket[-5,64,0]  𝄀
+1  ¦  1  𝄀
+2  ¦  1  𝄀
+3  ¦  2  𝄀
+4  ¦  1
+SET @value = '5';
+EXECUTE p_ntile USING @value;
+➤ id[4,32,0]  ¦  bucket[-5,64,0]  𝄀
+1  ¦  1  𝄀
+2  ¦  2  𝄀
+3  ¦  3  𝄀
+4  ¦  1
+SET @value = '2.5';
+EXECUTE p_ntile USING @value;
+invalid argument cast to int, bad value 2.5
+SET @value = '2';
+EXECUTE p_ntile USING @value;
+➤ id[4,32,0]  ¦  bucket[-5,64,0]  𝄀
+1  ¦  1  𝄀
+2  ¦  1  𝄀
+3  ¦  2  𝄀
+4  ¦  1
 SET @value = NULL;
 EXECUTE p_ntile USING @value;
 invalid input: ntile bucket count cannot be NULL
+SET @value = 2;
+EXECUTE p_ntile USING @value;
+➤ id[4,32,0]  ¦  bucket[-5,64,0]  𝄀
+1  ¦  1  𝄀
+2  ¦  1  𝄀
+3  ¦  2  𝄀
+4  ¦  1
 DEALLOCATE PREPARE p_ntile;
 CREATE TABLE lag_lead_input(id INT PRIMARY KEY, g INT, v INT);
 INSERT INTO lag_lead_input VALUES (1, 1, 10), (2, 1, 20), (3, 1, 30), (4, 2, 40);
```

**File**: `test/distributed/cases/prepare/prepared_numeric_aggregate.sql` (modified, +10/-0)
```diff
@@ -34,8 +34,18 @@ INSERT INTO ntile_input VALUES (1, 1), (2, 1), (3, 1), (4, 2);
 PREPARE p_ntile FROM 'SELECT id, NTILE(?) OVER (PARTITION BY g ORDER BY id) AS bucket FROM ntile_input ORDER BY id';
 SET @value = 2;
 EXECUTE p_ntile USING @value;
+SET @value = '2';
+EXECUTE p_ntile USING @value;
+SET @value = '5';
+EXECUTE p_ntile USING @value;
+SET @value = '2.5';
+EXECUTE p_ntile USING @value;
+SET @value = '2';
+EXECUTE p_ntile USING @value;
 SET @value = NULL;
 EXECUTE p_ntile USING @value;
+SET @value = 2;
+EXECUTE p_ntile USING @value;
 DEALLOCATE PREPARE p_ntile;
 
 CREATE TABLE lag_lead_input(id INT PRIMARY KEY, g INT, v INT);
```

---

### Incident Patch 4: `ce2a22aa` (2026-10-05)
**Commit Message**: fix: preserve prepared ROUND/TRUNCATE input before output CAST (#29625)

## Summary

Fixes #29623.

Keep a prepared ROUND/TRUNCATE value in its own input domain. A
surrounding output CAST must execute **after** the precision function,
not implicitly round/narrow the parameter before the function sees it.

The latest verified main base is
`43c37847b16d37cfa8b9eef4235ba4388b5e25ce`. It contains #29508 and still
reproduces the outer-DECIMAL wrong result found in nightly run
[37215929355](https://github.com/matrixorigin/mo-nightly-regression/actions/runs/37215929355/job/111539319830).

```sql
SELECT CAST(ROUND(?,1) AS DECIMAL(20,1)),
       CAST(TRUNCATE(?,1) AS DECIMAL(20,1));
```

| Text parameter | Before | After / expected |
|---|---|---|
| `1.46` | `1.5 / 1.5` | `1.5 / 1.4` |
| `-1.46` | `-1.5 / -1.5` | `-1.5 / -1.4` |

The defect also affects fresh text-first executions and SQL PREPARE; it
is not dependent on a previous integer binding or a binary-only cache
issue. #29508 fixed another input-domain variant, but its tests did not
cover this outer DECIMAL composition. This PR does not claim #29508 was
the original introducing change.

## Minimal change and invariants

- Production 

**File**: `pkg/sql/plan/base_binder.go` (modified, +12/-0)
```diff
@@ -3304,6 +3304,18 @@ func (b *baseBinder) bindPreparedNumericPrecisionFuncExpr(
 		return b.bindFuncExprImplByAstExpr(name, astArgs, depth)
 	}
 
+	// A surrounding result cast must not round the source before this function
+	// applies its own precision. Bind in the value consumer's domain, including
+	// scalar subqueries, while preserving explicit casts within the argument.
+	parentParamType, parentSubqueryTarget := b.numericParamType, b.numericSubqueryTarget
+	parentFunctionTarget := b.numericFunctionTarget
+	b.numericParamType, b.numericSubqueryTarget = nil, nil
+	b.numericFunctionTarget = false
+	defer func() {
+		b.numericParamType, b.numericSubqueryTarget = parentParamType, parentSubqueryTarget
+		b.numericFunctionTarget = parentFunctionTarget
+	}()
+
 	doubleType := types.T_float64.ToType()
 	target := makePlan2Type(&doubleType)
 	hasExplicitFloatCast := containsExplicitFloatCast(astArgs[0])
```

**File**: `pkg/sql/plan/issue_29317_29318_test.go` (modified, +92/-0)
```diff
@@ -21,8 +21,10 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
 	"github.com/stretchr/testify/require"
 )
 
@@ -523,6 +525,96 @@ func TestPreparedRoundAndTruncateKeepRuntimeValueDomain(t *testing.T) {
 					"an explicit numeric cast fixes the overload without inspecting text: %s", valueExpr)
 				stmt.Free()
 			}
+
+			// A result cast may narrow the function's answer, not its input.
+			// Inspect source casts instead of snapshotting a complete plan: a
+			// premature scale=1 conversion destroys 1.46 before TRUNCATE sees it.
+			for _, tc := range []struct {
+				name, sql      string
+				explicitNarrow bool
+			}{
+				{"outer_cast", "select cast(" + name + "(?,1) as decimal(20,1))", false},
+				{"scalar_input", "select cast(" + name + "((select ?),1) as decimal(20,1))", false},
+				{"scalar_result", "select cast((select " + name + "(?,1)) as decimal(20,1))", false},
+				{"derived_input", "select cast(" + name + "(v,1) as decimal(20,1)) from (select ? as v) s", false},
+				{"explicit_decimal_input", "select cast(" + name + "(cast(? as decimal(20,1)),1) as decimal(20,2))", true},
+				{"explicit_double_input", "select cast(" + name + "(cast(? as double),1) as decimal(20,1))", false},
+			} {
+				t.Run(tc.name, func(t *testing.T) {
+					stmt, err := parsers.ParseOne(context.Background(), dialect.MYSQL, tc.sql, 1)
+					require.NoError(t, err)
+					t.Cleanup(stmt.Free)
+					mock := NewMockOptimizer(false)
+					proc := mock.ctxt.GetProcess()
+					params := vector.NewVec(types.T_text.ToType())
+					t.Cleanup(func() { proc.SetPrepareParams(nil); params.Free(proc.Mp()) })
+					require.NoError(t, vector.AppendBytes(params, []byte("1.46"), false, proc.Mp()))
+					proc.SetPrepareParams(params)
+					source := types.T_varchar.ToType()
+					bound, err := BuildPreparedExecutionPlan(&mock.ctxt, stmt,
+						[]PreparedSourceBinding{{Position: 0, Type: source}},
+						[]any{ParamValue{Value: "1.46", SourceType: source, HasSourceType: true, IsBinaryProtocol: true}})
+					require.NoError(t, err)
+					require.NotNil(t, findPlanFunctionExpr(bound.Plan, name))
+					narrowSourceCast := false
+					require.NoError(t, planpb.VisitExpressionsInOwner(bound.Plan, func(root *Expr) error {
+						return planpb.VisitExprTree(root, func(expr *Expr) error {
+							fn := expr.GetF()
+							if fn != nil && fn.Func.GetObjName() == "cast" && len(fn.Args) > 0 &&
+								fn.Args[0].GetP() != nil && types.T(expr.Typ.Id).IsDecimal() && expr.Typ.Scale < 2 {
+								narrowSourceCast = true
+							}
+							return nil
+						})
+					}))
+					require.Equal(t, tc.explicitNarrow, narrowSourceCast,
+						"only an explicit input cast may narrow the original decimal spelling: %s\n%s", tc.sql, bound.Plan.String())
+				})
+			}
+
+			for _, tc := range []struct {
+				name, precision string
+				value           any
+				wantErr         bool
+			}{
+				{"value", "1", "1.46", false},
+				{"null", "1", nil, false},
+				{"precision_error", "missing_precision_column", "1.46", true},
+			} {
+				t.Run("context_restored/"+tc.name, func(t *testing.T) {
+					mock := NewMockOptimizer(false)
+					source := types.T_varchar.ToType()
+					ctx := withPreparedSourceBindings(context.Background(),
+						[]PreparedSourceBinding{{Position: 0, Type: source}},
+						[]any{ParamValue{Value: tc.value, SourceType: source, HasSourceType: true, IsBinaryProtocol: true}})
+					mock.ctxt.SetContext(ctx)
+					builder := NewQueryBuilder(planpb.Query_SELECT, &mock.ctxt, false, true)
+					binder := NewDefaultBinder(ctx, builder, NewBindContext(builder, nil), Type{}, nil)
+					outer := Type{Id: int32(types.T_decimal128), Width: 20, Scale: 1}
+					subquery := Type{Id: int32(types.T_decimal128), Width: 22, Scale: 1}
+					binder.numericParamType, binder.numericSubqueryTarget = &outer, &subquery
+					binder.numericFunctionTarget = true
+					stmt, err := parsers.ParseOne(ctx, dialect.MYSQL, "select "+name+"(?,"+tc.precision+")", 1)
+					require.NoError(t, err)
+					t.Cleanup(stmt.Free)
+					ast := stmt.(*tree.Select).Select.(*tree.SelectClause).Exprs[0].Expr.(*tree.FuncExpr)
+					_, err = binder.bindPreparedNumericPrecisionFuncExpr(name, ast.Exprs, 0, nil, -1)
+					if tc.wantErr {
+						require.Error(t, err)
+					} else {
+						require.NoError(t, err)
+					}
+					require.Same(t, &outer, binder.numericParamType)
+					require.Same(t, &subquery, binder.numericSubqueryTarget)
+					require.True(t, binder.numericFunctionTarget)
+					// The next arithmetic sibling must still see its own outer
+					// target after success, NULL fallback, or a precision error.
+					sibling, err := binder.BindExpr(ast.Exprs[0], 0, false)
+					requir
```

**File**: `pkg/sql/plan/prepared_binding_test.go` (modified, +16/-1)
```diff
@@ -108,7 +108,9 @@ func TestPreparedNumericPredicateFiltering(t *testing.T) {
 		{"round nonzero precision", "c=round(?,?)", []string{"54321.0", "1"}, true, true},
 		{"round negative precision", "c=round(?,?)", []string{"54321.0", "-1"}, true, true},
 		{"explicit column cast", "cast(c as decimal(5,0))=round(?,0)", []string{"54321.0"}, false, true},
-		{"explicit value cast", "c=cast(round(?,0) as decimal(4,0))", []string{"54321.0"}, false, true},
+		// ROUND sees the source before the explicit result cast clamps it to
+		// 9999. The full expression is safe to lower, but the cast must remain.
+		{"explicit value cast", "c=cast(round(?,0) as decimal(4,0))", []string{"54321.0"}, true, true},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
 			mock := NewMockOptimizer(false)
@@ -173,6 +175,7 @@ func TestPreparedNumericPredicateFiltering(t *testing.T) {
 			require.NoError(t, err)
 			require.True(t, bound.ValueDependent, "runtime value proof must not enter the type-only cache")
 			foundScan, columnCast, executableParam := false, false, false
+			explicitResultCast := false
 			for _, node := range bound.Plan.GetQuery().Nodes {
 				if node.NodeType != planpb.Node_TABLE_SCAN || node.TableDef.Name != table.Name {
 					continue
@@ -190,13 +193,25 @@ func TestPreparedNumericPredicateFiltering(t *testing.T) {
 							fn.Args[0].GetCol() != nil && fn.Args[0].Typ.Id == table.Cols[2].Typ.Id {
 							columnCast = true
 						}
+						if tc.name == "explicit value cast" && types.T(expr.Typ.Id).IsDecimal() &&
+							expr.Typ.Width == 4 && expr.Typ.Scale == 0 {
+							if fn := expr.GetF(); fn != nil && fn.Func.ObjName == "cast" {
+								_, overload := function.DecodeOverloadID(fn.Func.Obj)
+								require.EqualValues(t, 1, overload, "retain the explicit, not implicit, cast")
+								require.True(t, function.ContainsParameter(expr))
+								explicitResultCast = true
+							}
+						}
 						return nil
 					}))
 				}
 			}
 			require.True(t, foundScan)
 			require.Equal(t, !tc.native, columnCast, bound.Plan.String())
 			require.True(t, executableParam, "proof witnesses must not replace executable parameters")
+			if tc.name == "explicit value cast" {
+				require.True(t, explicitResultCast, "safe key lowering must still execute the user's narrowing cast")
+			}
 		})
 	}
 }
```

**File**: `pkg/tests/sqlintegration/prepared_numeric_temporal_contract_test.go` (modified, +142/-0)
```diff
@@ -310,6 +310,148 @@ func TestPreparedNumericTemporalContracts(t *testing.T) {
 				})
 			}
 		})
+		t.Run("ROUND TRUNCATE output cast", func(t *testing.T) {
+			type binding struct {
+				name, sqlValue string
+				value          any
+				want           [2]string
+			}
+			text := binding{"text", "'1.46'", "1.46", [2]string{"1.5", "1.4"}}
+			negative := binding{"negative text", "'-1.46'", "-1.46", [2]string{"-1.5", "-1.4"}}
+			exec(t, "create table output_cast_keys(c bigint primary key)")
+			exec(t, "insert into output_cast_keys values(-9999),(9999),(54321)")
+			typedReuse := []binding{
+				{"integer", "3", int64(3), [2]string{"3.0", "3.0"}},
+				text,
+				{"double", "cast(1.46 as double)", float64(1.46), [2]string{"1.5", "1.4"}},
+				negative,
+				{"NULL", "NULL", nil, [2]string{"NULL", "NULL"}},
+				{"text recovery", "'1.46'", "1.46", [2]string{"1.5", "1.4"}},
+			}
+			// Output scale must not be pushed through TRUNCATE into its input.
+			// Conversely an explicit input scale is part of the user's semantics:
+			// rounding 1.46 to DECIMAL(20,1) before TRUNCATE legitimately yields 1.5.
+			for _, protocol := range []string{"binary", "SQL"} {
+				t.Run(protocol, func(t *testing.T) {
+					for _, tc := range []struct {
+						name, input, output string
+						precision           int
+						bindings            []binding
+					}{
+						{"text first", "?", "decimal(20,1)", 1, []binding{text}},
+						{"typed reuse", "?", "decimal(20,1)", 1, typedReuse},
+						{"scalar input", "(select ?)", "decimal(20,1)", 1, []binding{text, negative}},
+						{"outer double", "?", "double", 1, []binding{text, negative}},
+						{"outer scale 2", "?", "decimal(20,2)", 1, []binding{
+							{"text", "'1.46'", "1.46", [2]string{"1.50", "1.40"}},
+							{"negative text", "'-1.46'", "-1.46", [2]string{"-1.50", "-1.40"}},
+						}},
+						{"explicit input scale 1", "cast(? as decimal(20,1))", "decimal(20,1)", 1, []binding{
+							{"text", "'1.46'", "1.46", [2]string{"1.5", "1.5"}},
+							{"negative text", "'-1.46'", "-1.46", [2]string{"-1.5", "-1.5"}},
+						}},
+						{"explicit input scale 2", "cast(? as decimal(20,2))", "decimal(20,1)", 1, []binding{text}},
+						{"explicit input double", "cast(? as double)", "decimal(20,1)", 1, []binding{text}},
+						{"double rounding", "?", "decimal(20,1)", 2, []binding{
+							{"text", "'1.449'", "1.449", [2]string{"1.5", "1.4"}},
+							{"negative text", "'-1.449'", "-1.449", [2]string{"-1.5", "-1.4"}},
+						}},
+					} {
+						t.Run(tc.name, func(t *testing.T) {
+							q := fmt.Sprintf("select cast(round(%s,%d) as %s),cast(truncate(%s,%d) as %s)", tc.input, tc.precision, tc.output, tc.input, tc.precision, tc.output)
+							var queryRow func(*testing.T, binding) *sql.Row
+							if protocol == "binary" {
+								stmt, err := conn.PrepareContext(ctx, q)
+								require.NoError(t, err)
+								defer stmt.Close()
+								queryRow = func(_ *testing.T, b binding) *sql.Row {
+									return stmt.QueryRowContext(ctx, b.value, b.value)
+								}
+							} else {
+								exec(t, "prepare output_cast_contract from '"+q+"'")
+								defer func() {
+									cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
+									defer stop()
+									_, err := conn.ExecContext(cleanup, "deallocate prepare output_cast_contract")
+									require.NoError(t, err)
+									_, err = conn.ExecContext(cleanup, "set @output_cast_value=NULL")
+									require.NoError(t, err)
+								}()
+								queryRow = func(t *testing.T, b binding) *sql.Row {
+									exec(t, "set @output_cast_value="+b.sqlValue)
+									return conn.QueryRowContext(ctx, "execute output_cast_contract using @output_cast_value,@output_cast_value")
+								}
+							}
+							for _, b := range tc.bindings {
+								t.Run(b.name, func(t *testing.T) {
+									// QueryRow.Scan closes its rows on both success and failure;
+									// no result can outlive the next binding on this connection.
+									var round, truncate sql.NullString
+									require.NoError(t, queryRow(t, b).Scan(&round, &truncate))
+									got := [2]string{"NULL", "NULL"}
+									for i, value := range []sql.NullString{round, truncate} {
+										if value.Valid {
+											got[i] = value.String
+										}
+									}
+									require.Equal(t, b.want, got, q)
+								})
+							}
+							if tc.name == "typed reuse" {
+								t.Run("recovery after invalid text", func(t *testing.T) {
+									invalid := binding{sqlValue: "'not-a-number'", value: "not-a-number"}
+									var round, truncate sql.NullString
+									err := queryRow(t, invalid).Scan(&round, &truncate)
+									var sqlErr *mysql.MySQLError
+									require.ErrorAs(t, err, &sqlErr, "invalid numeric text must be rejected by the server")
+									// Reuse the same handle after the server error; neither the
+									// failed value nor its conversion may poison the next execution.
+									require.NoError(t, queryRow(t, text).Scan(&roun
```

**File**: `test/distributed/cases/prepare/issue_29505_round_truncate.result` (modified, +28/-0)
```diff
@@ -23,3 +23,31 @@ execute truncate_derived using @v;
 ➤ v[8,53,31]  𝄀
 1.4
 deallocate prepare truncate_derived;
+prepare round_truncate_output_cast from 'select cast(round(?,1) as decimal(20,1)) as rounded,cast(truncate(?,1) as decimal(20,1)) as truncated';
+set @v = '1.46';
+execute round_truncate_output_cast using @v,@v;
+➤ rounded[3,20,1]  ¦  truncated[3,20,1]  𝄀
+1.5  ¦  1.4
+set @v = '-1.46';
+execute round_truncate_output_cast using @v,@v;
+➤ rounded[3,20,1]  ¦  truncated[3,20,1]  𝄀
+-1.5  ¦  -1.4
+set @v = 3;
+execute round_truncate_output_cast using @v,@v;
+➤ rounded[3,20,1]  ¦  truncated[3,20,1]  𝄀
+3.0  ¦  3.0
+set @v = null;
+execute round_truncate_output_cast using @v,@v;
+➤ rounded[3,20,1]  ¦  truncated[3,20,1]  𝄀
+null  ¦  null
+set @v = '1.46';
+execute round_truncate_output_cast using @v,@v;
+➤ rounded[3,20,1]  ¦  truncated[3,20,1]  𝄀
+1.5  ¦  1.4
+deallocate prepare round_truncate_output_cast;
+prepare truncate_input_cast from 'select cast(truncate(cast(? as decimal(20,1)),1) as decimal(20,1)) as truncated';
+execute truncate_input_cast using @v;
+➤ truncated[3,20,1]  𝄀
+1.5
+deallocate prepare truncate_input_cast;
+set @v = null;
```

**File**: `test/distributed/cases/prepare/issue_29505_round_truncate.sql` (modified, +20/-0)
```diff
@@ -19,3 +19,23 @@ prepare truncate_derived from 'select cast(truncate(x,1) as double) as v from (s
 set @v = '1.46';
 execute truncate_derived using @v;
 deallocate prepare truncate_derived;
+
+-- An output DECIMAL cast must not round a text parameter before TRUNCATE.
+prepare round_truncate_output_cast from 'select cast(round(?,1) as decimal(20,1)) as rounded,cast(truncate(?,1) as decimal(20,1)) as truncated';
+set @v = '1.46';
+execute round_truncate_output_cast using @v,@v;
+set @v = '-1.46';
+execute round_truncate_output_cast using @v,@v;
+set @v = 3;
+execute round_truncate_output_cast using @v,@v;
+set @v = null;
+execute round_truncate_output_cast using @v,@v;
+set @v = '1.46';
+execute round_truncate_output_cast using @v,@v;
+deallocate prepare round_truncate_output_cast;
+
+-- A user-written input DECIMAL cast intentionally rounds before TRUNCATE.
+prepare truncate_input_cast from 'select cast(truncate(cast(? as decimal(20,1)),1) as decimal(20,1)) as truncated';
+execute truncate_input_cast using @v;
+deallocate prepare truncate_input_cast;
+set @v = null;
```

---

### Incident Patch 5: `43c37847` (2026-10-05)
**Commit Message**: fix: enforce view authorization after scan elimination (#29617)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29572

## What this PR does / why we need it:

Constant or optimized-away views could remain readable after access was
revoked because authorization collected only physical scans. Preserve
bound logical view paths through optimization, plan copies,
serialization and prepared reuse. Authorize uncovered paths through the
existing view-security resolver; physical scan coverage avoids duplicate
checks. Remove the replaced string lineage and whole-chain snapshot
inference.

Each view step retains its own database/name, catalog tenant, complete
snapshot timestamp and subscription grant namespace. Read historical
definitions but check current grants. DEFINER advances the complete
account/role principal; INVOKER retains it. Subscriber grants use the
subscription alias, publisher grants the physical database. Foreign
principals cannot consume or populate the caller's cache, including when
numeric role IDs collide. Admin-role exceptions are

**File**: `docs/rfcs/view_grant_support_design.md` (modified, +25/-9)
```diff
@@ -14,20 +14,28 @@ Provide `GRANT/REVOKE ... ON VIEW` with correct authorization semantics so users
 - View object id is `mo_catalog.mo_tables.rel_logical_id` with `relkind='v'`.
 - Store privileges in `mo_catalog.mo_role_privs` with `obj_type="view"` and `obj_id=rel_logical_id`.
 - View privileges are read and checked through the same pipeline as table privileges, but with `obj_type` distinguishing view vs table.
+- A table wildcard grant does not grant access to views; use `GRANT ... ON VIEW db.*` for view wildcard access.
 
 ### 4. Plan-Time View Lineage
-Compiler records view lineage into plan nodes:
-- `origin_views`: the view chain in `db#view` format, ordered from the outermost view to the innermost view.
-- `direct_view`: the outermost view referenced by the user (optional, mostly for diagnostics).
+The binder records typed `ViewStep` paths, ordered outermost to innermost. Each
+step preserves its catalog tenant, complete snapshot timestamp, database/view
+name and subscriber grant namespace. Query-level `ViewReferences` retain
+authorization obligations for constant views and optimized-away scans; physical
+node `ViewPath` checks cover matching logical prefixes without duplicate work.
 
 ### 5. Runtime Authorization Flow
 For each plan node:
-1. If `origin_views` is present, verify view privileges in chain order (outermost to innermost).
+1. Verify every logical/physical view path in chain order (outermost to innermost).
 2. For each view in the chain, apply its `SQL SECURITY` to decide the effective role for the next hop:
-   - `DEFINER`: switch to the view definer role for the next hop.
-   - `INVOKER`: keep the current role for the next hop.
-3. After the chain, check base-table privileges using the effective role.
-4. If `origin_views` is empty, fall back to standard table privilege checks.
+   - `DEFINER`: switch to the view catalog account and its definer role for the next hop.
+   - `INVOKER`: keep the current account and role for the next hop.
+3. After the chain, check base-table privileges using that effective principal.
+   Subscriber grants use the subscription alias; publisher principals use the
+   physical publisher database. Foreign-principal checks never use or populate
+   the caller's privilege cache, even when numeric role IDs coincide.
+4. Without a view path, use standard table privilege checks. Every object must
+   pass independently; SELECT/ALL/OWNERSHIP alternatives apply to that object,
+   never to the entire statement.
 
 ### 6. SQL SECURITY Semantics
 - Session variable `view_security_type` controls `DEFINER` or `INVOKER` (default `DEFINER`).
@@ -37,6 +45,13 @@ For each plan node:
 ### 7. Special Cases and Compatibility
 - System view databases (`information_schema`, `mysql`) skip view privilege checks and remain read-only.
 - Fully qualified `db.view` queries can run without `USE <db>` if view privilege passes.
+- Role IDs are account-local: moadmin is role 0 in sys, accountadmin is role 2
+  in a non-sys account.
+- Cross-account CLONE assigns newly created objects to the target administrator;
+  same-account CLONE keeps the caller's ownership. RESTORE retains its separate
+  historical ownership policy. Invalid owners already persisted by older clones
+  are not guessed or remapped at read time; an authorized owner must repair those
+  definitions explicitly.
 
 ### 8. Testable Behaviors
 - `GRANT/REVOKE ... ON VIEW` syntax and `SHOW GRANTS` output.
@@ -52,7 +67,8 @@ For each plan node:
 
 ### 2. Metadata and Plan Structures
 - Extend plan proto and generated code to carry view lineage fields.
-- Record `origin_views` and `direct_view` during view binding and plan construction.
+- Record per-hop `ViewPath` and query-level `ViewReferences` during binding and
+  preserve them through plan copies and prepared execution.
 
 ### 3. Authorization Logic
 - Extract view privilege tips from plan nodes and check them before table privileges.
```

**File**: `pkg/frontend/authenticate.go` (modified, +197/-179)
```diff
@@ -1407,7 +1407,7 @@ const (
 	checkDatabaseViewFormat = `select rel_logical_id from mo_catalog.mo_tables where relname = %s and reldatabase = %s and relkind = "v" and account_id = %d;`
 
 	getViewMetaFormat             = `select viewdef, owner from mo_catalog.mo_tables where relname = %s and reldatabase = %s and relkind = "v" and account_id = %d;`
-	getViewMetaWithSnapshotFormat = `select viewdef, owner from mo_catalog.mo_tables {MO_TS = %d} where relname = %s and reldatabase = %s and relkind = "v" and account_id = %d;`
+	getViewMetaWithSnapshotFormat = `select viewdef, owner from mo_catalog.mo_tables {MO_TS = %s} where relname = %s and reldatabase = %s and relkind = "v" and account_id = %d;`
 
 	// TODO:fix privilege_level string and obj_type string
 	// For object_type : table, privilege_level : *.*
@@ -2206,7 +2206,7 @@ func getSqlForCheckViewMetaWithSnapshot(
 	ctx context.Context,
 	dbName string,
 	viewName string,
-	snapshotTs int64,
+	snapshotTs timestamp.Timestamp,
 ) (string, error) {
 
 	var (
@@ -2219,7 +2219,7 @@ func getSqlForCheckViewMetaWithSnapshot(
 		return "", moerr.NewInternalErrorNoCtx("no account id found in the ctx")
 	}
 
-	return fmt.Sprintf(getViewMetaWithSnapshotFormat, snapshotTs,
+	return fmt.Sprintf(getViewMetaWithSnapshotFormat, escapeSQLString(snapshotTs.DebugString()),
 		escapeSQLString(viewName), escapeSQLString(dbName), account), nil
 }
 
@@ -2461,9 +2461,8 @@ const (
 type privilegeItem struct {
 	privilegeTyp          PrivilegeType
 	objType               objectType
-	originViews           []string
-	directView            string
-	scanSnapshot          *plan.Snapshot
+	viewPath              []*plan.ViewStep
+	objectRef             *plan.ObjectRef
 	role                  *tree.Role
 	users                 []*tree.User
 	dbName                string
@@ -5507,38 +5506,6 @@ func normalizeViewSecurityType(securityType string) string {
 	return viewSecurityDefiner
 }
 
-func parseViewKey(key string) (string, string) {
-	if key == "" {
-		return "", ""
-	}
-	if baseKey, _, ok := splitViewSnapshotSuffix(key); ok {
-		key = baseKey
-	}
-	if strings.Contains(key, KeySep) {
-		return splitKey(key)
-	}
-	if dotIdx := strings.LastIndex(key, "."); dotIdx != -1 {
-		return key[:dotIdx], key[dotIdx+1:]
-	}
-	return "", key
-}
-
-func splitViewSnapshotSuffix(key string) (string, int64, bool) {
-	if key == "" {
-		return key, 0, false
-	}
-	idx := strings.LastIndex(key, plan2.ViewSnapshotKeySuffix)
-	if idx == -1 {
-		return key, 0, false
-	}
-	tsStr := key[idx+len(plan2.ViewSnapshotKeySuffix):]
-	ts, err := strconv.ParseInt(tsStr, 10, 64)
-	if err != nil {
-		return key, 0, false
-	}
-	return key[:idx], ts, true
-}
-
 func getViewSecurityInfoWithSnapshot(ctx context.Context, bh BackgroundExec, dbName, viewName string, snapshot *plan.Snapshot) (viewSecurityInfo, bool, error) {
 	var (
 		sql string
@@ -5549,7 +5516,7 @@ func getViewSecurityInfoWithSnapshot(ctx context.Context, bh BackgroundExec, dbN
 		ctxForSql = defines.AttachAccountId(ctxForSql, snapshot.Tenant.TenantID)
 	}
 	if snapshot != nil && snapshot.TS != nil {
-		sql, err = getSqlForCheckViewMetaWithSnapshot(ctxForSql, dbName, viewName, snapshot.TS.PhysicalTime)
+		sql, err = getSqlForCheckViewMetaWithSnapshot(ctxForSql, dbName, viewName, *snapshot.TS)
 	} else {
 		sql, err = getSqlForCheckViewMeta(ctxForSql, dbName, viewName)
 	}
@@ -5594,85 +5561,84 @@ func getViewSecurityInfoWithSnapshot(ctx context.Context, bh BackgroundExec, dbN
 	}, true, nil
 }
 
+// Role IDs are account-local. A DEFINER transition must change both parts of
+// the principal, including the namespace used for grants and cache eligibility.
+type viewPrivilegePrincipal struct {
+	accountID uint32
+	roleID    int64
+}
+
 // resolveViewChainPrivilegeContext verifies view privileges in order and returns
-// the effective role to use for underlying object checks.
+// the effective principal to use for underlying object checks.
 func resolveViewChainPrivilegeContext(
 	ctx context.Context,
 	bh BackgroundExec,
 	ses *Session,
 	cache *privilegeCache,
 	roleId int64,
 	privType PrivilegeType,
-	viewChain []string,
-	fallbackDb string,
-	snapshot *plan.Snapshot,
+	viewPath []*plan.ViewStep,
 	enableCache bool,
-) (int64, bool, bool, error) {
-	if len(viewChain) == 0 {
-		return roleId, true, false, nil
+) (viewPrivilegePrincipal, bool, bool, error) {
+	accountID, err := defines.GetAccountId(ctx)
+	if err != nil {
+		return viewPrivilegePrincipal{}, false, false, err
 	}
-	rootDb, rootView := parseViewKey(viewChain[0])
-	if rootView == "" {
-		return 0, false, false, moerr.NewInternalErrorf(ctx, "invalid view key %q", viewChain[0])
+	caller := viewPrivilegePrincipal{accountID: accountID, roleID: roleId}
+	if len(viewPath) == 0 {
+		return caller, true, false, nil
 	}
-	if rootDb == "" {
-		rootDb = fallbackDb
-		if rootDb == "" {
-			rootDb = ses.GetDatabaseName()
-		}
+	if err := validateViewPath(viewPath); err != nil {
+		return caller, false, false, err
 	
```

**File**: `pkg/frontend/authenticate2.go` (modified, +18/-4)
```diff
@@ -150,6 +150,7 @@ var checkPrivilegeInCache = func(ctx context.Context, ses *Session, priv *privil
 					allTrue := true
 					//multi privileges take effect together
 					for _, mi := range entry.compound.items {
+						yes = false
 						if mi.privilegeTyp == PrivilegeTypeCanGrantRoleToOthersInCreateUser {
 							//TODO: normalize the name
 							//TODO: simplify the logic
@@ -175,11 +176,14 @@ var checkPrivilegeInCache = func(ctx context.Context, ses *Session, priv *privil
 							// }
 							yes = false
 						} else {
-							if len(mi.originViews) > 0 || mi.directView != "" {
+							if len(mi.viewPath) > 0 {
 								// View chains require metadata checks; skip cache-only evaluation.
 								return false, nil
 							}
 							tempEntry := privilegeEntriesMap[mi.privilegeTyp]
+							if mi.objType == objectTypeTable || mi.objType == objectTypeView {
+								tempEntry.objType = mi.objType
+							}
 							tempEntry.databaseName = mi.dbName
 							tempEntry.tableName = mi.tableName
 							tempEntry.privilegeEntryTyp = privilegeEntryTypeGeneral
@@ -201,9 +205,19 @@ var checkPrivilegeInCache = func(ctx context.Context, ses *Session, priv *privil
 
 							if yes2 {
 								//At least there is one success
-								yes, err = verifyPrivilegeEntryInMultiPrivilegeLevelsInCache(ses, cache, tempEntry, pls)
-								if err != nil {
-									return false, err
+								yes = false
+								for i, typ := range [3]PrivilegeType{mi.privilegeTyp, PrivilegeTypeTableAll, PrivilegeTypeTableOwnership} {
+									if i > 0 && mi.objType != objectTypeTable {
+										break
+									}
+									tempEntry.privilegeId = typ
+									yes, err = verifyPrivilegeEntryInMultiPrivilegeLevelsInCache(ses, cache, tempEntry, pls)
+									if err != nil {
+										return false, err
+									}
+									if yes {
+										break
+									}
 								}
 							}
 						}
```

**File**: `pkg/frontend/authenticate_test.go` (modified, +127/-26)
```diff
@@ -273,8 +273,9 @@ func TestViewMetadataSQLAcceptsQuotedIdentifiers(t *testing.T) {
 	require.Contains(t, metaSQL, "relname = "+escapeSQLString(viewName))
 	require.Contains(t, metaSQL, "reldatabase = "+escapeSQLString(dbName))
 
-	snapshotSQL, err := getSqlForCheckViewMetaWithSnapshot(ctx, dbName, viewName, 123)
+	snapshotSQL, err := getSqlForCheckViewMetaWithSnapshot(ctx, dbName, viewName, timestamp.Timestamp{PhysicalTime: 123, LogicalTime: 7})
 	require.NoError(t, err)
+	require.Contains(t, snapshotSQL, "MO_TS = '123-7'")
 	require.Contains(t, snapshotSQL, "relname = "+escapeSQLString(viewName))
 	require.Contains(t, snapshotSQL, "reldatabase = "+escapeSQLString(dbName))
 
@@ -6215,7 +6216,9 @@ func TestExtractPrivilegeTipsFromPlanInsertDedupTargetScan(t *testing.T) {
 			}}}
 
 			got := make([]tipKey, 0, len(p.GetQuery().GetNodes()))
-			for _, tip := range extractPrivilegeTipsFromPlan(p) {
+			tips, err := extractPrivilegeTipsFromPlan(p)
+			require.NoError(t, err)
+			for _, tip := range tips {
 				got = append(got, tipKey{tip.typ, tip.databaseName, tip.tableName})
 			}
 			require.ElementsMatch(t, tc.want, got)
@@ -6259,7 +6262,9 @@ func TestExtractPrivilegeTipsFromPlanKeepsUserDedupJoinSources(t *testing.T) {
 		table string
 	}
 	got := make([]tipKey, 0)
-	for _, tip := range extractPrivilegeTipsFromPlan(p) {
+	tips, err := extractPrivilegeTipsFromPlan(p)
+	require.NoError(t, err)
+	for _, tip := range tips {
 		got = append(got, tipKey{typ: tip.typ, table: tip.tableName})
 	}
 	require.ElementsMatch(t, []tipKey{
@@ -6363,7 +6368,8 @@ func Test_extractPrivilegeTipsFromPlan_Subscription(t *testing.T) {
 			},
 		},
 	}
-	arr := extractPrivilegeTipsFromPlan(p)
+	arr, err := extractPrivilegeTipsFromPlan(p)
+	require.NoError(t, err)
 	assert.Equal(t, 1, len(arr))
 	assert.Equal(t, "sub2", arr[0].databaseName)
 	assert.Equal(t, "t1", arr[0].tableName)
@@ -6377,15 +6383,13 @@ func TestExtractPrivilegeTipsFromPlanIncludesMongoDBExternalScan(t *testing.T) {
 	)
 
 	for _, tc := range []struct {
-		name        string
-		originViews []string
-		directView  string
+		name     string
+		viewPath []*plan.ViewStep
 	}{
 		{name: "direct table"},
 		{
-			name:        "view",
-			originViews: []string{dbName + "." + viewName},
-			directView:  dbName + "." + viewName,
+			name:     "view",
+			viewPath: []*plan.ViewStep{{DatabaseName: dbName, ViewName: viewName, Snapshot: &plan.Snapshot{Tenant: &plan.SnapshotTenant{}}}},
 		},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
@@ -6407,22 +6411,22 @@ func TestExtractPrivilegeTipsFromPlanIncludesMongoDBExternalScan(t *testing.T) {
 										Collection: "events",
 									},
 								},
-								OriginViews: tc.originViews,
-								DirectView:  tc.directView,
+								ViewPath: tc.viewPath,
 							},
 						},
 					},
 				},
 			}
 
-			arr := extractPrivilegeTipsFromPlan(p)
+			arr, err := extractPrivilegeTipsFromPlan(p)
+
+			require.NoError(t, err)
 			require.Len(t, arr, 1)
 			require.Equal(t, PrivilegeTypeSelect, arr[0].typ)
 			require.Equal(t, objectTypeTable, arr[0].objType)
 			require.Equal(t, dbName, arr[0].databaseName)
 			require.Equal(t, tableName, arr[0].tableName)
-			require.Equal(t, tc.originViews, arr[0].originViews)
-			require.Equal(t, tc.directView, arr[0].directView)
+			require.Equal(t, tc.viewPath, arr[0].viewPath)
 		})
 	}
 }
@@ -6456,8 +6460,7 @@ func TestAuthenticateMongoDBExternalScanSelectPrivilege(t *testing.T) {
 
 	for _, tc := range []struct {
 		name           string
-		originViews    []string
-		directView     string
+		viewPath       []*plan.ViewStep
 		tableSelect    bool
 		addRevokedView bool
 		want           bool
@@ -6466,8 +6469,7 @@ func TestAuthenticateMongoDBExternalScanSelectPrivilege(t *testing.T) {
 		{name: "table select granted", tableSelect: true, want: true},
 		{
 			name:           "view select revoked",
-			originViews:    []string{dbName + "." + viewName},
-			directView:     dbName + "." + viewName,
+			viewPath:       []*plan.ViewStep{{DatabaseName: dbName, ViewName: viewName, Snapshot: &plan.Snapshot{Tenant: &plan.SnapshotTenant{}}}},
 			tableSelect:    true,
 			addRevokedView: true,
 		},
@@ -6515,8 +6517,7 @@ func TestAuthenticateMongoDBExternalScanSelectPrivilege(t *testing.T) {
 							Type:        int32(plan.ExternType_MONGODB_TB),
 							MongodbScan: &plan.MongoScan{},
 						},
-						OriginViews: tc.originViews,
-						DirectView:  tc.directView,
+						ViewPath: tc.viewPath,
 					},
 				},
 			}}}
@@ -6549,7 +6550,8 @@ func TestExtractPrivilegeTipsFromTableChanges(t *testing.T) {
 					TableDef: &plan2.TableDef{TableType: "func_table", TblFunc: &plan.TableFunction{Name: "table_changes"}},
 				}},
 			}}}
-			arr := extractPrivilegeTipsFromPlan(p)
+			arr, err := extractPrivilegeTipsFromPlan(p)
+			require.NoError(t, err)
 			require.Len(t, arr, 1)
 			assert.Equal(t, PrivilegeTypeSelect, arr[0].typ)
 			assert.Equal(t, tt.databaseName, arr[0].databaseName)
@@ -6649,7 +6651,9 @@ func T
```

**File**: `pkg/frontend/clone.go` (modified, +3/-3)
```diff
@@ -1008,7 +1008,7 @@ func handleCloneTable(
 		}
 	}
 
-	ctx = defines.AttachAccountId(reqCtx, toAccountId)
+	ctx = cloneTargetContext(reqCtx, ses.GetTenantInfo().GetTenantID(), toAccountId)
 
 	var sql string
 	var dstTableExistedBeforeRestore bool
@@ -1297,7 +1297,7 @@ func handleCloneDatabaseWithSource(
 		}()
 	}
 
-	ctx1 = defines.AttachAccountId(reqCtx, source.toAccountId)
+	ctx1 = cloneTargetContext(reqCtx, ses.GetTenantInfo().GetTenantID(), source.toAccountId)
 	if err = bh.Exec(ctx1,
 		fmt.Sprintf("create database %s", quoteIdentifierForSQL(stmt.DstDatabase.String())),
 	); err != nil {
@@ -1524,7 +1524,7 @@ func handleCloneDatabaseWithSource(
 		// The function metadata above is intentionally still uncommitted: the
 		// clone must remain atomic. Mark view restoration so ResolveUdf uses the
 		// same clone transaction and can bind newly restored functions.
-		if err = restoreViews(withResolveUdfInCallerTxn(reqCtx), ses, bh, "", rewrittenViewMap, source.toAccountId, rewrittenViews, true); err != nil {
+		if err = restoreViews(withResolveUdfInCallerTxn(ctx1), ses, bh, "", rewrittenViewMap, source.toAccountId, rewrittenViews, true); err != nil {
 			return
 		}
 	}
```

**File**: `pkg/frontend/clone_database_source.go` (modified, +21/-2)
```diff
@@ -785,6 +785,24 @@ func restoreCloneDatabaseUserDefinedFunctions(
 	return nil
 }
 
+// cloneTargetContext keeps same-account ownership and assigns cross-account
+// creations to the target administrator. Override DDL ownership as well as the
+// execution role: the request may carry a source-account DDL-owner provider.
+// RESTORE uses its separate historical ownership contract, not this policy.
+func cloneTargetContext(ctx context.Context, callerAccount, targetAccount uint32) context.Context {
+	ctx = defines.AttachAccountId(ctx, targetAccount)
+	if callerAccount == targetAccount {
+		return ctx
+	}
+	userID, roleID := uint32(GetAdminUserId()), uint32(accountAdminRoleID)
+	if targetAccount == sysAccountID {
+		admin := getDefaultAccount()
+		userID, roleID = admin.GetUserID(), admin.GetDefaultRoleID()
+	}
+	ctx = defines.AttachAccount(ctx, targetAccount, userID, roleID)
+	return defines.AttachDDLOwnerRoleId(ctx, roleID)
+}
+
 // resolveCloneDatabaseRoutineTenant preserves the caller identity for a
 // same-account clone and uses the target account's administrator identity for
 // a cross-account clone. Routine metadata must not pair a target account with
@@ -813,13 +831,14 @@ func resolveCloneDatabaseRoutineTenant(
 	if len(rows) != 1 {
 		return nil, moerr.NewInternalErrorNoCtxf("target account %d has no administrator metadata", targetAccountID)
 	}
+	targetCtx := cloneTargetContext(ctx, caller.GetTenantID(), targetAccountID)
 	return &TenantInfo{
 		Tenant:        rows[0][0],
 		User:          rows[0][1],
 		DefaultRole:   accountAdminRoleName,
 		TenantID:      targetAccountID,
-		UserID:        GetAdminUserId(),
-		DefaultRoleID: accountAdminRoleID,
+		UserID:        defines.GetUserId(targetCtx),
+		DefaultRoleID: defines.GetRoleId(targetCtx),
 	}, nil
 }
 
```

**File**: `pkg/frontend/computation_wrapper_test.go` (modified, +1/-1)
```diff
@@ -4842,7 +4842,7 @@ func TestValidateCapturedPrepareSchemasSkipsPlansRebuiltEveryExecute(t *testing.
 		PubInfo:          &plan.PubInfo{TenantId: 11},
 	}}
 	metadataPlan := &plan.Plan{Plan: &plan.Plan_Query{Query: &plan.Query{Nodes: []*plan.Node{{
-		OriginViews: []string{"information_schema#statistics"},
+		ViewPath: []*plan.ViewStep{{DatabaseName: "information_schema", ViewName: "statistics", Snapshot: &plan.Snapshot{Tenant: &plan.SnapshotTenant{}}}},
 	}}}}}
 	rebuildEveryExecute := shouldRebuildPreparePlan(false, metadataPlan)
 	require.True(t, rebuildEveryExecute)
```

**File**: `pkg/frontend/prepared_fk_cache_test.go` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ func TestShouldCachePrepareCompileForeignKeyActions(t *testing.T) {
 
 	subscriptionMetadataPlan := makePlan(plan.Query_SELECT, false)
 	subscriptionMetadataPlan.GetQuery().Nodes = []*plan.Node{{
-		OriginViews: []string{"information_schema#statistics"},
+		ViewPath: []*plan.ViewStep{{DatabaseName: "information_schema", ViewName: "statistics", Snapshot: &plan.Snapshot{Tenant: &plan.SnapshotTenant{}}}},
 	}}
 	require.True(t, shouldRebuildPreparePlan(false, subscriptionMetadataPlan))
 	require.False(t, checkNodeCanCache(subscriptionMetadataPlan))
```

---

### Incident Patch 6: `856e9ddb` (2026-10-05)
**Commit Message**: fix: consolidate decimal expression contracts and historical bug regressions (#29618)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29614
Fixes #29615
Related to #29249

## What this PR does / why we need it:

### Ownership and fixes

- Reuse existing unsigned decimal arithmetic and rescale owners. Fix
full-width rounded division and declared precision checks at minimum
signed magnitude.
- Close empty widening-batch and parameter-conversion reuse contracts.
Admit the cached parameter type and shape before decoding; NULL→value
transitions reuse the existing conversion owner and leave rejected
wrappers unchanged.
- Share unary selection admission across 18 existing owners: inactive
rows must not invoke conversion callbacks; preserve NULL, row-error and
historical binary-prefix behavior.
- Consolidate division/modulo/CAST regression families with independent
literal values, exact errors, full type metadata, masks, reuse and
cleanup assertions.
- Replace unnecessary disk fixtures with existing MemoryFS fixtures,
remove expected-vector allocat

**File**: `docs/design/20261003-expression-quality-consolidation.md` (modified, +174/-0)
```diff
@@ -478,3 +478,177 @@ establish whole-query, complete-package CPU or whole-CI improvements. Earlier
 failed race evidence is retained as historical evidence; its gate is closed by
 validation of the corrected dependency, rather than by repeating the old code.
 The wider #29249 task remains ongoing.
+
+
+## Final decimal and expression contracts (PR #29618)
+
+This section consolidates the PR's added design and evidence. Earlier sections
+are the inherited design record. The delivery fixes #29614 and #29615 and relates
+to #29249. Validation claims below identify their scope; internal API probes do
+not establish SQL reachability or workload throughput.
+
+### Production responsibilities
+
+| Contract | Existing owner and correction | Boundaries retained |
+| --- | --- | --- |
+| Unsigned rounded division (#29614) | `Div256` reuses `div256TruncQuoRem`, compares the unsigned remainder against the parity-aware half divisor, and propagates quotient carry | Signed callers restore sign; SQL adapters check signed range and retain BigInt only for scale overflow. Ordinary SQL already protected this primitive failure. |
+| Declared precision (#29615) | `decimal256BatchArith` rejects a remaining magnitude sign bit after absolute-value normalization, before its precision comparison | Common add/sub/mul/div publication owner; constrained widths 1..75; internal width-76 carrier bypass preserved. No per-kernel precision checks. |
+| Bounded rescaling | `ScaleInplace` reuses `Div128`; `ScaleInplace`/`ScaleTruncate` return immediately for zero coefficients | Remove unused `Div128InPlace`; nonzero rounding and error-state semantics retained. Unknown external Go API consumers are outside the compatibility claim. |
+| Decimal CAST reduction | Six D128/D256 adapters reuse source `Scale`, then existing target parser at scale zero | Remove six-caller BigInt helper and discarded formatting; growth, explicit CAST clamping, target precision and executor-owned selection retained. |
+| Empty widening | `decimal64ToDecimal128Array` returns for zero logical rows | Existing result reset owns length/NULL cleanup; positive-length BCE and constant replication retained. |
+| Parameter acquisition | Fixed/string reuse requires complete Type equality; fixed reuse also admits wrapper shape before decoding | Rejected reuse does not decode or mutate. `GenerateFunctionFixedTypeParameter` remains the conversion owner; no new cache, state or buffer. |
+| Unary and decimal-prefix admission | Shared bounded mask publication and existing string conversion templates | Preserve row indexes, NULL/error policy and historical binary-input distinction. See [unary design](20261004-unary-selection-execution.md). |
+
+The #29614 primitive regression includes seven independent rounding boundaries,
+exact zero errors, half parity and quotient carry. A scan-expression row retains
+operand/result metadata and NULL checks. Existing AVG, interpolation and CU
+accounting consumers remain covered. The former alternative division algorithm
+was retired when main supplied the canonical quotient/remainder owner.
+
+For #29615, legal SQL inputs can produce coefficient -2^255 while carrying
+DECIMAL(65,12), which cannot represent it. The shared 11-cell arithmetic precision
+holder preserves the old 65-digit product/66-digit overflow cases and adds
+minimum-output VV/SV/VS, selection, NULL and width-76 controls. Four distinct
+rounded-division precision cases remain separate. The existing planner/executor
+root and service BVT check the exact SQL; BVT also checks the last valid and first
+invalid declared coefficients, recovery after errors and a typed NULL.
+
+Converted parameter tests exercise D64/F32/F64 constant and flat inputs through
+NULL, values, changed payload, nullable flat values and recovery in one frame
+slot. Native D128 is the successful-reuse control. Direct rejected reuse leaves
+the cached wrapper intact; acquisition replaces it via the existing conversion
+owner. The real `plusFn` consumer checks left/right NULL recovery, complete result
+type and exact coefficients. D64+F64 ordinary SQL binds to F64: the panic evidence
+is at the function API, not a claimed SQL crash.
+
+### Test ownership and retirement
+
+Expected coefficients use literal limbs or an independent integer oracle.
+Masks assert exact membership/cardinality and untouched initially masked scratch
+outputs. Strict errors assert their category; scratch rollback is not promised.
+VV/SV/VS denote the actual physical loops. Scale-route witnesses use real source
+scales and distinguish inline success from checked fallback. Pure helpers retain
+separate argument/status assertions rather than being replaced by batch success.
+
+The following complete maps retain the old modulo and D64/D128 IntDiv contracts.
+In modulo names S/X/Y mean equal/dividend/divisor scaling, 64/W distinguish D128
+small/wide divisors, and N/M/P/E/Z mean ordinary, initial mask, permissive zero,
+strict error and scalar zero.
```

**File**: `docs/design/20261004-unary-selection-execution.md` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+# Unary selection execution consolidation
+
+Owner issue: #29249. Local implementation series:
+`codex/quality-29249-20261003`, based on main `37ba071297`.
+Status: design approved before implementation; implementation and local validation
+approved by independent gpt-6.1-sol xhigh review.
+
+## Evidence and gate
+
+At `16722dd388`, a private native probe selected all 21 unary template entries,
+including three forwarding entries, across six constant-input states. Of 126
+cells, 36 fail callback-count assertions in 19 entries; active, partial, NULL and
+AllNull controls pass everywhere. The recently repaired two string/bytes-to-fixed
+error templates pass all cells. Evidence: `29249-unary-inactive-family-20261004`.
+A second probe selected all 294 constant/flat cells across seven states and
+confirmed those 36 failures plus one flat flag/bitmap interpretation mismatch.
+Failures are execution admission defects, not claimed SQL reproductions.
+
+The design gate applies because this consolidates a hot execution responsibility
+across the complete unary family. Production functions remain in one package;
+there is no new worker, state machine, cache, protocol or external interface.
+
+## Contract and owners
+
+Within a nonnegative logical row domain, an empty input or a domain with no active
+row must not invoke the scalar conversion. Source NULL also suppresses conversion.
+An active constant invokes it once; a flat vector invokes it once per active,
+non-NULL row. Partial masks preserve the row positions and NULLs. Short masks leave
+unlisted rows active; masks beyond the logical length cannot affect the result.
+Existing error propagation, NULL-on-error and result-NULL policies remain owned by
+the current typed templates and callbacks.
+
+FunctionSelectList owns the mask representation and its Contains/AnyNull/AllNull
+semantics. The execution templates own publication to result NULLs and values.
+Reuse these responsibilities. One package-private mask application helper belongs
+in baseTemplate.go beside existing result-publication helpers; it accepts the
+existing select list, result null bitmap and logical length. It applies bounded
+partial mask NULLs and returns any-masked/all-masked observations. AllNull admission
+returns immediately without a scan; callers retain their existing fixed/null-range
+or variable/SetNullResult publication when every row is inactive.
+
+The helper has no retained state, allocations or callbacks. It replaces existing
+mask scans rather than adding a pre-scan. Unmasked admission is constant time.
+Every actual unary owner returns for length zero before acquiring a parameter.
+Forwarding entries inherit their owner's behavior and retain real call sites.
+The special fixed-to-string NULL-on-error implementation keeps its existing flat
+per-row loop: use the shared helper only for its constant branch, avoiding an
+extra scan on its flat path. Its flat row admission reuses the existing
+functionRowSkipped contract, which ignores stale bitmap contents when AnyNull
+is false. Its constant result uses appendRepeatedBytesResult after common mask
+publication; preserve the WithSelection helper for its four other consumers while avoiding
+a second partial-mask pass in this constant branch. The retirement scope is
+17 repeated common mask blocks and the special constant admission checks. No broader binary/ternary migration is authorized by
+this stage. Other arities require independent inventory and evidence.
+
+## Integration and retirement
+
+Replace the repeated mask-publication blocks in the actual unary owners, including
+the two recently repaired count loops. Retire their per-owner skip counters and
+mask flag plumbing where replaced. Keep typed scalar evaluation, cached parameter
+acquisition, result preallocation and error policy in their current owners.
+Do not add a generic execution framework or adapt all callbacks through another
+callback. Existing byte/string conversions and decimal prefix/binary admission
+remain unchanged. Inspect all direct callers and the special row-index callbacks. Constant row-error
+callbacks retain row zero; flat callbacks retain the actual row index, including
+JSON binary provenance. OctString can publish NULLs in its callback, so common
+mask application occurs before callbacks and never clears their NULL side effects.
+
+## Validation and cost
+
+Before implementation, extend the orthogonal probe to flat inputs and distinguish
+healthy values, errors, NULL-on-error, source NULL, mask flags, long/short masks and
+same-wrapper reuse. Consolidate permanent coverage into existing shared template
+regressions; preserve an explicit old-to-new map. Avoid one fixture per template
+or a large data cross-product. Use failing scalar callbacks to prove error
+suppression and literal expectations to prove results and metadata.
+
+Run focused native proof before complete function normal/race and incremental
+static checks. Use the old ow
```

**File**: `pkg/container/types/decimal.go` (modified, +75/-123)
```diff
@@ -390,7 +390,7 @@ func (x Decimal64) Scale(n int32) (Decimal64, error) {
 }
 
 func (x *Decimal128) ScaleInplace(n int32) error {
-	if n == 0 {
+	if n == 0 || (x.B0_63 == 0 && x.B64_127 == 0) {
 		return nil
 	}
 	if n < -38 {
@@ -425,7 +425,7 @@ func (x *Decimal128) ScaleInplace(n int32) error {
 	if n-m > 0 {
 		err = x.Mul64InPlace(Decimal64(Pow10[n-m]))
 	} else {
-		err = x.Div128InPlace(&Decimal128{Pow10[m-n], 0})
+		*x, err = x.Div128(Decimal128{Pow10[m-n], 0})
 	}
 	if err != nil {
 		err = moerr.NewInvalidInputNoCtxf("Decimal128 scale overflow: coefficient %s, target scale=%d", x.Format(0), n)
@@ -486,7 +486,7 @@ func (x Decimal128) Scale(n int32) (Decimal128, error) {
 }
 
 func (x Decimal128) ScaleTruncate(n int32) (Decimal128, error) {
-	if n == 0 {
+	if n == 0 || (x.B0_63 == 0 && x.B64_127 == 0) {
 		return x, nil
 	}
 	if n < -38 {
@@ -599,7 +599,7 @@ func (x Decimal256) Scale(n int32) (Decimal256, error) {
 }
 
 func (x Decimal256) ScaleTruncate(n int32) (Decimal256, error) {
-	if n == 0 {
+	if n == 0 || (x.B0_63 == 0 && x.B64_127 == 0 && x.B128_191 == 0 && x.B192_255 == 0) {
 		return x, nil
 	}
 	if n < -77 {
@@ -1046,43 +1046,6 @@ func (x Decimal64) Div64(y Decimal64) (Decimal64, error) {
 	return z, nil
 }
 
-func (x *Decimal128) Div128InPlace(y *Decimal128) error {
-	if y.B0_63 == 0 && y.B64_127 == 0 {
-		return moerr.NewInvalidInputNoCtxf("Decimal128 Div by Zero: %s/%s", x.Format(0), y.Format(0))
-	}
-	if y.B64_127 == 0 {
-		x.B64_127, y.B64_127 = bits.Div64(0, x.B64_127, y.B0_63)
-		x.B0_63, y.B64_127 = bits.Div64(y.B64_127, x.B0_63, y.B0_63)
-		if y.B64_127*2 >= y.B0_63 || y.B64_127>>63 != 0 {
-			x.B0_63++
-			if x.B0_63 == 0 {
-				x.B64_127++
-			}
-		}
-	} else {
-		if x.Less(*y) {
-			x.B64_127 = 0
-			x.B0_63 = 0
-		} else {
-			n := bits.LeadingZeros64(y.B64_127)
-			v, _ := bits.Div64(x.B64_127, x.B0_63, y.Right(64-n).B0_63)
-			v >>= 63 - n
-			if v&1 == 0 {
-				x.B0_63 = v >> 1
-			} else {
-				z, _ := y.Mul128(Decimal128{v, 0})
-				if x.Left(1).Less(z) {
-					x.B0_63 = v >> 1
-				} else {
-					x.B0_63 = (v >> 1) + 1
-				}
-			}
-			x.B64_127 = 0
-		}
-	}
-	return nil
-}
-
 func (x Decimal128) Div128(y Decimal128) (Decimal128, error) {
 	if y.B0_63 == 0 && y.B64_127 == 0 {
 		return x, moerr.NewInvalidInputNoCtxf("Decimal128 Div by Zero: %s/%s", x.Format(0), y.Format(0))
@@ -1105,15 +1068,16 @@ func (x Decimal128) Div128(y Decimal128) (Decimal128, error) {
 		}
 
 		// Round half-up iff remainder >= ceil(y/2), without forming 2*remainder.
-		threshold := y.Right(1)
+		threshold := Decimal128{B0_63: y.B0_63>>1 | y.B64_127<<63, B64_127: y.B64_127 >> 1}
 		if y.B0_63&1 != 0 {
 			var carry uint64
 			threshold.B0_63, carry = bits.Add64(threshold.B0_63, 1, 0)
 			threshold.B64_127 += carry
 		}
-		if remainder.Compare(threshold) >= 0 {
-			// Here y >= 2^64 and x < 2^127, so the rounded quotient fits in B0_63.
-			q.B0_63++
+		if remainder.B64_127 > threshold.B64_127 || remainder.B64_127 == threshold.B64_127 && remainder.B0_63 >= threshold.B0_63 {
+			var carry uint64
+			q.B0_63, carry = bits.Add64(q.B0_63, 1, 0)
+			q.B64_127 += carry
 		}
 		return q, nil
 	}
@@ -1125,10 +1089,9 @@ func (x Decimal128) div128Trunc(y Decimal128) (Decimal128, error) {
 	return q, err
 }
 
-// div128TruncQuoRem returns an exact quotient and remainder for positive
-// operands. The normalized high-limb estimate can be one too large because
-// normalization discards low divisor bits; correct it before multiplying so
-// an otherwise representable quotient is not mistaken for overflow.
+// div128TruncQuoRem operates on unsigned magnitudes, including the absolute
+// value of the signed minimum. Its normalized quotient estimate can exceed the
+// exact quotient by one because normalization discards low divisor bits.
 func (x Decimal128) div128TruncQuoRem(y Decimal128) (Decimal128, Decimal128, error) {
 	if y.B0_63 == 0 && y.B64_127 == 0 {
 		return x, Decimal128{}, moerr.NewInvalidInputNoCtxf("Decimal128 Div by Zero: %s/%s", x.Format(0), y.Format(0))
@@ -1138,37 +1101,39 @@ func (x Decimal128) div128TruncQuoRem(y Decimal128) (Decimal128, Decimal128, err
 		qLo, remainder := bits.Div64(remainderHi, x.B0_63, y.B0_63)
 		return Decimal128{B0_63: qLo, B64_127: qHi}, Decimal128{B0_63: remainder}, nil
 	}
-	if x.Less(y) {
+	if x.B64_127 < y.B64_127 || x.B64_127 == y.B64_127 && x.B0_63 < y.B0_63 {
 		return Decimal128{}, x, nil
 	}
 
 	n := bits.LeadingZeros64(y.B64_127)
-	v, _ := bits.Div64(x.B64_127, x.B0_63, y.Right(64-n).B0_63)
-	v >>= 63 - n
-	q := Decimal128{B0_63: v >> 1}
-	product, mulErr := y.Mul128(q)
-	if mulErr != nil || product.Compare(x) > 0 {
-		var err error
-		q, err = q.Sub128(Decimal128{B0_63: 1})
-		if err != nil {
-			return Decimal128{}, Decimal128{}, err
-		}
-		product, err = y.Mul128(q)
-		if err != nil {
-			return Decimal128{}, Decimal128{}, err
-		}
-		if product.Compare(x) > 0 {
+	// Halve the dividend logically before estimation so bits.Div64's high
+	// limb is below
```

**File**: `pkg/container/types/decimal_test.go` (modified, +78/-2)
```diff
@@ -352,6 +352,20 @@ func TestDecimal128ScaleMinimumAndExtremeNegativeScale(t *testing.T) {
 	inplace := Decimal128Min
 	require.NoError(t, inplace.ScaleInplace(math.MinInt32))
 	require.Equal(t, Decimal128{}, inplace)
+	for _, n := range []int32{math.MinInt32, math.MaxInt32} {
+		t.Run(fmt.Sprintf("zero/%d", n), func(t *testing.T) {
+			inplace := Decimal128{}
+			require.NoError(t, inplace.ScaleInplace(n))
+			require.Equal(t, Decimal128{}, inplace)
+			truncated, err := (Decimal128{}).ScaleTruncate(n)
+			require.NoError(t, err)
+			require.Equal(t, Decimal128{}, truncated)
+			wide, err := (Decimal256{}).ScaleTruncate(n)
+			require.NoError(t, err)
+			require.Equal(t, Decimal256{}, wide)
+		})
+	}
+
 }
 
 func TestDecimal256ScaleMultiStepRoundingAndMinimum(t *testing.T) {
@@ -904,8 +918,8 @@ func TestDecimal128OverDiv(t *testing.T) {
 func TestDecimal128Div128HalfUpLargeDivisor(t *testing.T) {
 	fromBig := func(value *big.Int) Decimal128 {
 		t.Helper()
-		if value.Sign() < 0 || value.BitLen() > 127 {
-			t.Fatalf("value does not fit a positive Decimal128: %s", value)
+		if value.Sign() < 0 || value.BitLen() > 128 {
+			t.Fatalf("value does not fit an unsigned Decimal128 magnitude: %s", value)
 		}
 		hi := new(big.Int).Rsh(new(big.Int).Set(value), 64).Uint64()
 		return Decimal128{B0_63: value.Uint64(), B64_127: hi}
@@ -949,6 +963,34 @@ func TestDecimal128Div128HalfUpLargeDivisor(t *testing.T) {
 		}
 	}
 
+	magnitudeLimit := new(big.Int).Lsh(big.NewInt(1), 127)
+	for _, tc := range []struct {
+		name string
+		x, y *big.Int
+	}{
+		{"minimum_magnitudes_equal", magnitudeLimit, magnitudeLimit},
+		{"below_minimum_divisor", new(big.Int).Sub(new(big.Int).Set(magnitudeLimit), big.NewInt(1)), magnitudeLimit},
+		{"minimum_dividend_wide_divisor", magnitudeLimit, new(big.Int).Add(new(big.Int).Lsh(big.NewInt(1), 64), big.NewInt(3))},
+		{"unsigned_rounded_quotient_carry", new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 128), big.NewInt(1)), new(big.Int).Lsh(big.NewInt(1), 64)},
+		{"minimum_divisor_below_half", new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 126), big.NewInt(1)), magnitudeLimit},
+		{"minimum_divisor_at_half", new(big.Int).Lsh(big.NewInt(1), 126), magnitudeLimit},
+		{"minimum_divisor_above_half", new(big.Int).Add(new(big.Int).Lsh(big.NewInt(1), 126), big.NewInt(1)), magnitudeLimit},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			want, remainder := new(big.Int), new(big.Int)
+			want.QuoRem(tc.x, tc.y, remainder)
+			got, err := fromBig(tc.x).Div128Trunc(fromBig(tc.y))
+			require.NoError(t, err)
+			require.Equal(t, want, toBig(got))
+			if new(big.Int).Lsh(remainder, 1).Cmp(tc.y) >= 0 {
+				want.Add(want, big.NewInt(1))
+			}
+			got, err = fromBig(tc.x).Div128(fromBig(tc.y))
+			require.NoError(t, err)
+			require.Equal(t, want, toBig(got))
+		})
+	}
+
 	t.Run("odd half threshold carries into high limb", func(t *testing.T) {
 		x := new(big.Int).Lsh(big.NewInt(1), 64)
 		y := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 65), big.NewInt(1))
@@ -1055,6 +1097,40 @@ func TestDecimal256UnsignedDivision(t *testing.T) {
 	for range 200 {
 		check(new(big.Int).Rand(rng, limit), new(big.Int).Rand(rng, limit))
 	}
+
+	// Rounding has a distinct consumer contract; avoid repeating the floor matrix.
+	top := new(big.Int).Lsh(big.NewInt(1), 255)
+	half := new(big.Int).Rsh(new(big.Int).Set(top), 1)
+	for _, tc := range []struct {
+		name string
+		x, y *big.Int
+	}{
+		{"rounded_scaled_boundary", new(big.Int).Mul(big.NewInt(3), new(big.Int).Exp(big.NewInt(10), big.NewInt(76), nil)), new(big.Int).Exp(big.NewInt(10), big.NewInt(64), nil)},
+		{"rounded_full_magnitude", top, big.NewInt(1)},
+		{"rounded_quotient_carry", new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)), big.NewInt(2)},
+		{"rounded_even_below_half", new(big.Int).Sub(new(big.Int).Set(half), big.NewInt(1)), top},
+		{"rounded_even_at_half", half, top},
+		{"rounded_odd_below_half", half, new(big.Int).Add(new(big.Int).Set(top), big.NewInt(1))},
+		{"rounded_odd_above_half", new(big.Int).Add(new(big.Int).Set(half), big.NewInt(1)), new(big.Int).Add(new(big.Int).Set(top), big.NewInt(1))},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			want, rem := new(big.Int), new(big.Int)
+			want.QuoRem(tc.x, tc.y, rem)
+			if new(big.Int).Lsh(rem, 1).Cmp(tc.y) >= 0 {
+				want.Add(want, big.NewInt(1))
+			}
+			got, err := fromBig(tc.x).Div256(fromBig(tc.y))
+			require.NoError(t, err)
+			require.Zero(t, want.Cmp(toBig(got)))
+		})
+	}
+	t.Run("rounded_zero_error", func(t *testing.T) {
+		x := Decimal256{B0_63: 7}
+		got, err := x.Div256(Decimal256{})
+		require.True(t, moerr.IsMoErrCode(err, moerr.ErrInvalidInput))
+		require.Equal(t, "invalid input: Decimal256 Div by Zero", err.Error())
+		require.Equal(t, x, got)
+	})
 }
 
 func TestDecimal256ModHighMagnitude(t *testing.T) {
```

**File**: `pkg/container/vector/functionTool_test.go` (modified, +117/-70)
```diff
@@ -488,76 +488,123 @@ func TestAppendByteJsonEncodedConstResult(t *testing.T) {
 	require.Equal(t, int64(0), mp.CurrNB())
 }
 
-func TestReuseFunctionParameterStr(t *testing.T) {
-	mp := mpool.MustNewZeroNoFixed()
-	vec := NewVec(types.T_varchar.ToType())
-	for i := uint64(0); i < 10; i++ {
-		err := appendOneBytes(vec, []byte("x"), false, mp)
-		require.NoError(t, err)
-	}
-	g1 := GenerateFunctionStrParameter(vec)
-	ok := ReuseFunctionStrParameter(vec, g1)
-	require.Equal(t, true, ok)
-
-	err := appendOneBytes(vec, []byte("x"), true, mp)
-	require.NoError(t, err)
-	ok = ReuseFunctionStrParameter(vec, g1)
-	require.Equal(t, false, ok)
-	g1 = GenerateFunctionStrParameter(vec)
-	ok = ReuseFunctionStrParameter(vec, g1)
-	require.Equal(t, true, ok)
-
-	vec = NewConstNull(types.T_varchar.ToType(), 0, mp)
-	ok = ReuseFunctionStrParameter(vec, g1)
-	require.Equal(t, false, ok)
-	g1 = GenerateFunctionStrParameter(vec)
-	ok = ReuseFunctionStrParameter(vec, g1)
-	require.Equal(t, true, ok)
-
-	err = appendOneBytes(vec, []byte("x"), false, mp)
-	require.Error(t, err)
-
-	ok = ReuseFunctionStrParameter(vec, g1)
-	require.Equal(t, true, ok)
-
-	g1 = GenerateFunctionStrParameter(vec)
-	ok = ReuseFunctionStrParameter(vec, g1)
-	require.Equal(t, true, ok)
+func TestFunctionParameterReuseTransitions(t *testing.T) {
+	t.Run("fixed", func(t *testing.T) {
+		exerciseParameterReuse(t, types.T_int32.ToType(), 1, GenerateFunctionFixedTypeParameter[int32], ReuseFunctionFixedTypeParameter[int32], OptGetParamFromWrapper[int32],
+			func(v *Vector, n, changed bool, mp *mpool.MPool) error {
+				value := int32(7)
+				if changed {
+					value = 9
+				}
+				return appendOneFixed(v, value, n, mp)
+			},
+			func(p FunctionParameterWrapper[int32], i uint64, n, changed bool) {
+				value, isNull := p.GetValue(i)
+				want := int32(7)
+				if changed {
+					want = 9
+				}
+				if n {
+					want = 0
+				}
+				if value != want || isNull != n {
+					t.Fatalf("value=%d null=%v; want=%d null=%v", value, isNull, want, n)
+				}
+			})
+	})
+	t.Run("string", func(t *testing.T) {
+		exerciseParameterReuse(t, types.T_varchar.ToType(), 0, GenerateFunctionStrParameter, ReuseFunctionStrParameter, OptGetBytesParamFromWrapper,
+			func(v *Vector, n, changed bool, mp *mpool.MPool) error {
+				value := "x"
+				if changed {
+					value = "y"
+				}
+				return appendOneBytes(v, []byte(value), n, mp)
+			},
+			func(p FunctionParameterWrapper[types.Varlena], i uint64, n, changed bool) {
+				value, isNull := p.GetStrValue(i)
+				want := "x"
+				if changed {
+					want = "y"
+				}
+				if n {
+					want = ""
+				}
+				if string(value) != want || isNull != n {
+					t.Fatalf("value=%q null=%v; want=%q null=%v", value, isNull, want, n)
+				}
+			})
+	})
 }
 
-func TestReuseFunctionParameterFixed(t *testing.T) {
-	mp := mpool.MustNewZero()
-	var err error
-	vec1 := NewVec(types.T_int32.ToType())
-	for i := uint64(0); i < 10; i++ {
-		err = appendOneFixed(vec1, int32(i), false, mp)
-		require.NoError(t, err)
-	}
-	g2 := GenerateFunctionFixedTypeParameter[int32](vec1)
-	ok := ReuseFunctionFixedTypeParameter(vec1, g2)
-	require.Equal(t, true, ok)
-
-	err = appendOneFixed(vec1, 0, true, mp)
-	require.NoError(t, err)
-	ok = ReuseFunctionFixedTypeParameter(vec1, g2)
-	require.Equal(t, false, ok)
-	g2 = GenerateFunctionFixedTypeParameter[int32](vec1)
-	ok = ReuseFunctionFixedTypeParameter(vec1, g2)
-	require.Equal(t, true, ok)
-
-	vec1 = NewConstNull(types.T_int32.ToType(), 1, mp)
-	ok = ReuseFunctionFixedTypeParameter(vec1, g2)
-	require.Equal(t, false, ok)
-	g2 = GenerateFunctionFixedTypeParameter[int32](vec1)
-	ok = ReuseFunctionFixedTypeParameter(vec1, g2)
-	require.Equal(t, true, ok)
-
-	err = appendOneFixed(vec1, int32(0), false, mp)
-	require.Error(t, err)
-
-	ok = ReuseFunctionFixedTypeParameter(vec1, g2)
-	require.Equal(t, true, ok)
-	g2 = GenerateFunctionFixedTypeParameter[int32](vec1)
-	ok = ReuseFunctionFixedTypeParameter(vec1, g2)
-	require.Equal(t, true, ok)
+func exerciseParameterReuse[T types.FixedSizeT](t *testing.T, typ types.Type, scalarLength int,
+	generate func(*Vector) FunctionParameterWrapper[T], reuse func(*Vector, FunctionParameterWrapper[T]) bool,
+	acquire func(FunctionResultWrapper, int, *Vector) FunctionParameterWrapper[T],
+	appendValue func(*Vector, bool, bool, *mpool.MPool) error, checkValue func(FunctionParameterWrapper[T], uint64, bool, bool)) {
+	t.Helper()
+	mp := mpool.MustNewZeroNoFixed()
+	func() {
+		v := NewVec(typ)
+		defer v.Free(mp)
+		require.NoError(t, appendValue(v, false, false, mp))
+		parameter := generate(v)
+		check := func(p FunctionParameterWrapper[T], source *Vector, index uint64, isNull, changed bool) {
+			t.Helper()
+			if p.GetSourceVector() != source || p.GetType() != *source.GetType() {
+				t.Fatal("parameter source or complete type changed")
+			}
+			checkValue(p, index, isNull, changed)
+		}
+		require.True(t, reuse(v, parameter))
+		check(parameter, v, 0, false, false)
+		require.NoErro
```

**File**: `pkg/container/vector/functionTools.go` (modified, +15/-1)
```diff
@@ -173,6 +173,13 @@ func GenerateFunctionFixedTypeParameter[T types.FixedSizeTExceptStrType](v *Vect
 }
 
 func ReuseFunctionFixedTypeParameter[T types.FixedSizeTExceptStrType](v *Vector, f FunctionParameterWrapper[T]) bool {
+	// A different effective type must be rebuilt by the parameter conversion owner.
+	if f.GetType() != *v.GetType() {
+		return false
+	}
+
+	// Admit the cached shape before decoding: a NULL wrapper may retain a
+	// source type that requires conversion when values become available.
 	if v.IsConstNull() {
 		r, ok := f.(*FunctionParameterScalarNull[T])
 		if !ok {
@@ -181,12 +188,12 @@ func ReuseFunctionFixedTypeParameter[T types.FixedSizeTExceptStrType](v *Vector,
 		r.sourceVector = v
 		return true
 	}
-	cols := MustFixedColWithTypeCheck[T](v)
 	if v.IsConst() {
 		r, ok := f.(*FunctionParameterScalar[T])
 		if !ok {
 			return false
 		}
+		cols := MustFixedColWithTypeCheck[T](v)
 		r.sourceVector = v
 		r.scalarValue = cols[0]
 		return true
@@ -196,6 +203,7 @@ func ReuseFunctionFixedTypeParameter[T types.FixedSizeTExceptStrType](v *Vector,
 		if !ok {
 			return false
 		}
+		cols := MustFixedColWithTypeCheck[T](v)
 		r.sourceVector = v
 		r.values = cols
 		r.nullMap = v.GetNulls().GetBitmap()
@@ -205,6 +213,7 @@ func ReuseFunctionFixedTypeParameter[T types.FixedSizeTExceptStrType](v *Vector,
 	if !ok {
 		return false
 	}
+	cols := MustFixedColWithTypeCheck[T](v)
 	r.sourceVector = v
 	r.values = cols
 	return true
@@ -262,6 +271,11 @@ func GenerateFunctionStrParameter(v *Vector) FunctionParameterWrapper[types.Varl
 }
 
 func ReuseFunctionStrParameter(v *Vector, f FunctionParameterWrapper[types.Varlena]) bool {
+	// A different effective type must be rebuilt by the parameter conversion owner.
+	if f.GetType() != *v.GetType() {
+		return false
+	}
+
 	if v.IsConstNull() {
 		r, ok := f.(*FunctionParameterScalarNull[types.Varlena])
 		if !ok {
```

**File**: `pkg/container/vector/function_parameter_conversion_test.go` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+// Copyright 2021 Matrix Origin
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
+package vector
+
+import (
+	"fmt"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/container/nulls"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/stretchr/testify/require"
+)
+
+func TestConvertedParameterReuse(t *testing.T) {
+	for _, tc := range []struct {
+		name                 string
+		oid                  types.T
+		scale                int32
+		coefficient, changed uint64
+	}{
+		{"decimal64", types.T_decimal64, 2, 123, 250},
+		{"float32", types.T_float32, 7, 12500000, 25000000},
+		{"float64", types.T_float64, 16, 12500000000000000, 25000000000000000},
+		{"native_decimal128", types.T_decimal128, 2, 123, 250},
+	} {
+		for _, constant := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s/constant=%v", tc.name, constant), func(t *testing.T) {
+				mp := mpool.MustNewZeroNoFixed()
+				t.Cleanup(func() { require.Zero(t, mp.CurrNB()) })
+				typ := tc.oid.ToType()
+				if tc.oid == types.T_decimal64 || tc.oid == types.T_decimal128 {
+					typ.Scale = 2
+				}
+				input := NewVec(typ)
+				defer input.Free(mp)
+				for i := 0; i < 2; i++ {
+					switch tc.oid {
+					case types.T_decimal64:
+						require.NoError(t, AppendFixed(input, types.Decimal64(123), false, mp))
+					case types.T_float32:
+						require.NoError(t, AppendFixed(input, float32(1.25), false, mp))
+					case types.T_float64:
+						require.NoError(t, AppendFixed(input, float64(1.25), false, mp))
+					case types.T_decimal128:
+						require.NoError(t, AppendFixed(input, types.Decimal128{B0_63: 123}, false, mp))
+					}
+					if constant {
+						input.SetClass(CONSTANT)
+						input.SetLength(2)
+						break
+					}
+				}
+				nilInput := NewConstNull(typ, 2, mp)
+				defer nilInput.Free(mp)
+				result := NewFunctionResultWrapper(types.T_decimal128.ToType(), mp)
+				defer result.Free()
+				result.UseOptFunctionParamFrame(1)
+				wantType := types.T_decimal128.ToType()
+				wantType.Width, wantType.Scale = 38, tc.scale
+				check := func(want uint64, nullable bool) {
+					t.Helper()
+					parameter := OptGetParamFromWrapper[types.Decimal128](result, 0, input)
+					require.Equal(t, wantType, parameter.GetType())
+					require.Same(t, input, parameter.GetSourceVector())
+					require.Equal(t, typ, *input.GetType())
+					for row := uint64(0); row < 2; row++ {
+						value, isNull := parameter.GetValue(row)
+						require.Equal(t, nullable && row == 1, isNull)
+						if !isNull {
+							require.Equal(t, types.Decimal128{B0_63: want}, value)
+						}
+					}
+					// Native D128 controls must retain the successful, allocation-free reuse path.
+					require.Equal(t, tc.oid == types.T_decimal128, ReuseFunctionFixedTypeParameter(input, parameter))
+				}
+				nullToValue := func() {
+					t.Helper()
+					old := OptGetParamFromWrapper[types.Decimal128](result, 0, nilInput)
+					require.True(t, ReuseFunctionFixedTypeParameter(nilInput, old))
+					require.False(t, ReuseFunctionFixedTypeParameter(input, old))
+					_, isNull := old.GetValue(0)
+					require.True(t, isNull)
+					require.Equal(t, typ, old.GetType())
+					require.Same(t, nilInput, old.GetSourceVector())
+					fresh := OptGetParamFromWrapper[types.Decimal128](result, 0, input)
+					require.NotSame(t, old, fresh)
+					require.Same(t, nilInput, old.GetSourceVector())
+					_, isNull = old.GetValue(0)
+					require.True(t, isNull)
+				}
+				nullToValue()
+				check(tc.coefficient, false)
+				check(tc.coefficient, false)
+				switch tc.oid {
+				case types.T_decimal64:
+					MustFixedColWithTypeCheck[types.Decimal64](input)[0] = 250
+				case types.T_float32:
+					MustFixedColWithTypeCheck[float32](input)[0] = 2.5
+				case types.T_float64:
+					MustFixedColWithTypeCheck[float64](input)[0] = 2.5
+				case types.T_decimal128:
+					MustFixedColWithTypeCheck[types.Decimal128](input)[0] = types.Decimal128{B0_63: 250}
+				}
+				if !constant {
+					nulls.Add(input.GetNulls(), 1)
+				}
+				check(tc.changed, !constant)
+				nullToValue()
+				check(tc.changed, !constant)
+			})
+		}
+	}
+}
```

**File**: `pkg/container/vector/vector_test.go` (modified, +10/-17)
```diff
@@ -4339,23 +4339,16 @@ func TestRowToString(t *testing.T) {
 		require.Equal(t, int64(0), mp.CurrNB())
 	}
 	{ // timestamp
-		v := NewVec(types.T_timestamp.ToType())
-		// Use FromClockZone with UTC to create timestamp that will display correctly
-		// RowToString uses time.Local, so we need to create timestamp that accounts for local timezone
-		// If we want to display "1970-01-01 00:00:00" in local time, we need to create timestamp
-		// that represents that time in local timezone
-		utc := time.UTC
-		ts := types.FromClockZone(utc, 1970, 1, 1, 0, 0, 0, 0)
-		err := AppendFixedList(v, []types.Timestamp{1, ts, 3, 4}, nil, mp)
-		require.NoError(t, err)
-		// RowToString uses time.Local, so the displayed time will be in local timezone
-		// If local timezone is UTC+8, UTC time 1970-01-01 00:00:00 will display as 1970-01-01 08:00:00
-		// So we need to adjust the expected value based on local timezone offset
-		_, offset := time.Now().In(time.Local).Zone()
-		expectedHour := offset / 3600
-		expectedStr := fmt.Sprintf("1970-01-01 %02d:00:00", expectedHour)
-		require.Equal(t, expectedStr, v.RowToString(1))
-		v.Free(mp)
+		func() {
+			v := NewVec(types.T_timestamp.ToType())
+			defer v.Free(mp)
+			ts := types.FromClockZone(time.UTC, 1970, 1, 1, 0, 0, 0, 0)
+			err := AppendFixedList(v, []types.Timestamp{1, ts, 3, 4}, nil, mp)
+			require.NoError(t, err)
+			// Use the instant's historical offset, including date and minute changes.
+			want := time.Unix(0, 0).In(time.Local).Format("2006-01-02 15:04:05")
+			require.Equal(t, want, v.RowToString(1))
+		}()
 		require.Equal(t, int64(0), mp.CurrNB())
 	}
 	{ // decimal64
```

---

### Incident Patch 7: `37ba0712` (2026-10-04)
**Commit Message**: fix(hakeeper): preserve lock owner discovery during admission reset (#29611)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29609

## What this PR does / why we need it:

Admission revalidation resets a CN's capability acknowledgement before
its next heartbeat. HAKeeper previously omitted a not-yet-ready CN even
though its registered generation and lock endpoint remained present. An
internal KeepRemoteLock request could interpret this discovery omission
as owner loss, fence the transaction, and make startup lock retries
unrecoverable.

Keep registered nonzero-generation CNs in internal discovery across
capability revalidation. Public SQL selection still requires admission
readiness: the direct background SQL-address selector applies that rule
before label preference or fallback. Unknown zero-generation CNs retain
their fail-closed boundary. Actual membership deletion, owner
replacement and exact-bind fencing remain unchanged.

The shared embedded-cluster fixture also needs a real task-storage
prerequisite. Its existing pointer-only check a

**File**: `pkg/embed/testing.go` (modified, +15/-3)
```diff
@@ -615,8 +615,8 @@ func waitBasicClusterTaskServices(ctx context.Context, c Cluster, cnCount int) e
 				"CN %s does not expose its task service", svc.ServiceID())
 		}
 		if err := waitTaskServiceReady(ctx, getter, basicClusterServiceStartupRetryInterval); err != nil {
-			return moerr.NewInternalErrorf(
-				ctx, "CN %s task service did not become ready: %v", svc.ServiceID(), err)
+			return errors.Join(moerr.NewInternalErrorNoCtxf(
+				"CN %s task service did not become ready", svc.ServiceID()), err)
 		}
 	}
 	return nil
@@ -628,8 +628,20 @@ func waitTaskServiceReady(
 	retryInterval time.Duration,
 ) error {
 	for {
+		if err := ctx.Err(); err != nil {
+			return err
+		}
 		if service, ok := getter.GetTaskService(); ok && service != nil {
-			return nil
+			// Holder publication does not imply backing storage availability.
+			// Ping also succeeds with no store; a bounded read observes the real
+			// boundary and requests refresh without retrying any business write.
+			_, err := service.QueryDaemonTask(ctx, taskservice.WithTaskIDCond(taskservice.EQ, 0))
+			if ctx.Err() != nil {
+				return ctx.Err()
+			}
+			if err == nil || !errors.Is(err, taskservice.ErrNotReady) {
+				return err
+			}
 		}
 		if err := waitStartupRetry(ctx, retryInterval); err != nil {
 			return err
```

**File**: `pkg/embed/testing_test.go` (modified, +105/-0)
```diff
@@ -26,6 +26,7 @@ import (
 
 	mruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/matrixorigin/matrixone/pkg/pb/task"
 	"github.com/matrixorigin/matrixone/pkg/taskservice"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
@@ -87,6 +88,109 @@ func TestWaitTaskServiceReadyHonorsCancellation(t *testing.T) {
 	require.ErrorIs(t, <-done, context.Canceled)
 }
 
+type readinessTaskStorage struct {
+	taskservice.TaskStorage
+	query func(context.Context) error
+}
+
+func (s *readinessTaskStorage) QueryDaemonTask(ctx context.Context, _ ...taskservice.Condition) ([]task.DaemonTask, error) {
+	return nil, s.query(ctx)
+}
+
+func TestWaitTaskServiceReadyObservesStorage(t *testing.T) {
+	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
+	defer cancel()
+	queried, release := make(chan struct{}), make(chan struct{})
+	store := taskservice.NewMemTaskStorage()
+	calls := 0
+	service := taskservice.NewTaskService(mruntime.DefaultRuntime(), &readinessTaskStorage{
+		TaskStorage: store,
+		query: func(ctx context.Context) error {
+			calls++
+			if calls == 1 {
+				return fmt.Errorf("initial refresh: %w", taskservice.ErrNotReady)
+			}
+			close(queried)
+			select {
+			case <-release:
+				return nil
+			case <-ctx.Done():
+				return ctx.Err()
+			}
+		},
+	})
+	defer func() { require.NoError(t, service.Close()) }()
+	getter := newDelayedTaskServiceGetter()
+	getter.set(service)
+	done := make(chan error, 1)
+	go func() {
+		err := waitTaskServiceReady(ctx, getter, 0)
+		if err == nil {
+			_, err = store.AddDaemonTask(ctx, task.DaemonTask{Metadata: task.TaskMetadata{ID: "once"}})
+		}
+		done <- err
+	}()
+	joined := false
+	defer func() {
+		cancel()
+		if !joined {
+			<-done
+		}
+	}()
+	select {
+	case <-queried:
+	case err := <-done:
+		joined = true
+		t.Fatalf("fixture admitted before storage observation: %v", err)
+	case <-ctx.Done():
+		t.Fatal("storage observation did not start")
+	}
+	rows, err := store.QueryDaemonTask(ctx)
+	require.NoError(t, err)
+	require.Empty(t, rows, "no business write before readiness")
+	close(release)
+	err = <-done
+	joined = true
+	require.NoError(t, err)
+	require.Equal(t, 2, calls)
+	rows, err = store.QueryDaemonTask(ctx)
+	require.NoError(t, err)
+	require.Len(t, rows, 1, "one business write after readiness")
+}
+
+func TestWaitTaskServiceReadyStorageErrors(t *testing.T) {
+	for _, name := range []string{"fatal", "cancel during read", "cancel while not ready"} {
+		t.Run(name, func(t *testing.T) {
+			ctx, cancel := context.WithCancel(t.Context())
+			defer cancel()
+			want := errors.New("storage failure")
+			calls := 0
+			service := taskservice.NewTaskService(mruntime.DefaultRuntime(), &readinessTaskStorage{
+				TaskStorage: taskservice.NewMemTaskStorage(),
+				query: func(context.Context) error {
+					calls++
+					if name == "fatal" {
+						return want
+					}
+					cancel()
+					if name == "cancel while not ready" {
+						return taskservice.ErrNotReady
+					}
+					return nil
+				},
+			})
+			defer func() { require.NoError(t, service.Close()) }()
+			getter := newDelayedTaskServiceGetter()
+			getter.set(service)
+			if name != "fatal" {
+				want = context.Canceled
+			}
+			require.ErrorIs(t, waitTaskServiceReady(ctx, getter, time.Hour), want)
+			require.Equal(t, 1, calls, "fatal errors and cancellation must not be retried")
+		})
+	}
+}
+
 func TestWaitBasicClusterTaskServicesRejectsMissingCN(t *testing.T) {
 	err := waitBasicClusterTaskServices(context.Background(), &cluster{}, 1)
 	require.ErrorContains(t, err, "service not found")
@@ -126,6 +230,7 @@ func TestWaitBasicClusterTaskServicesReportsReadinessCancellation(t *testing.T)
 
 	err := waitBasicClusterTaskServices(ctx, c, 1)
 	require.ErrorContains(t, err, "task service did not become ready")
+	require.ErrorIs(t, err, context.Canceled)
 }
 
 func TestBasicClusterUsesShortStartupRetryIntervals(t *testing.T) {
```

**File**: `pkg/hakeeper/rsm.go` (modified, +4/-2)
```diff
@@ -1797,10 +1797,12 @@ func (s *stateMachine) handleClusterDetailsQuery(cfg Config) *pb.ClusterDetails
 		}
 	}
 	for uuid, info := range s.state.CNState.Stores {
+		// Capability acknowledgements are reset by an admission barrier, not
+		// the registered CN generation. Keep that internal owner
+		// discoverable while public SQL routing remains gated by readiness.
 		if s.viewMetadataAdmissionActive() &&
 			!info.ViewMetadataAdmissionReady &&
-			(!info.ViewMetadataAdmissionSupported ||
-				info.ViewMetadataAdmissionGeneration == 0) {
+			info.ViewMetadataAdmissionGeneration == 0 {
 			continue
 		}
 		state := pb.NormalState
```

**File**: `pkg/hakeeper/view_metadata_admission_test.go` (modified, +64/-6)
```diff
@@ -16,15 +16,19 @@ package hakeeper
 
 import (
 	"bytes"
+	"context"
 	"fmt"
 	"testing"
 	"time"
 
 	sm "github.com/lni/dragonboat/v4/statemachine"
 	"github.com/stretchr/testify/require"
 
+	"github.com/matrixorigin/matrixone/pkg/clusterservice"
+	"github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/defines"
 	pb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
+	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
 )
 
 func updateViewMetadataCN(
@@ -484,9 +488,11 @@ func TestPersistedExpressionProtocolActivationRevokesStaleLowerCN(t *testing.T)
 	require.True(t, rsm.state.ViewMetadataAdmissionPreparing)
 	require.False(t, rsm.state.CNState.Stores["stale-cn"].ViewMetadataAdmissionReady)
 	details := rsm.handleClusterDetailsQuery(cfg)
-	for _, store := range details.CNStores {
-		require.NotEqual(t, "stale-cn", store.UUID)
-	}
+	require.Len(t, details.CNStores, 1)
+	require.Equal(t, "stale-cn", details.CNStores[0].UUID)
+	require.Equal(t, pb.TimeoutState, details.CNStores[0].State)
+	require.False(t, details.CNStores[0].ViewMetadataAdmissionReady,
+		"internal discovery must not grant public routing admission")
 }
 
 func TestPersistedExpressionProtocolRaiseKeepsOldGenerationDrainTarget(t *testing.T) {
@@ -537,7 +543,15 @@ func TestPersistedExpressionProtocolRaiseKeepsOldGenerationDrainTarget(t *testin
 	require.False(t, rsm.state.CNState.Stores["cn-1"].ViewMetadataAdmissionReady)
 }
 
-func TestViewMetadataAdmissionPreparingKeepsLegacyAndHidesPendingCN(t *testing.T) {
+type admissionInventoryClient struct {
+	details pb.ClusterDetails // Immutable snapshot; cluster refresh may read it concurrently.
+}
+
+func (c *admissionInventoryClient) GetClusterDetails(ctx context.Context) (pb.ClusterDetails, error) {
+	return c.details, ctx.Err()
+}
+
+func TestViewMetadataAdmissionPreparingKeepsRegisteredOwners(t *testing.T) {
 	rsm := NewStateMachine(0, 1).(*stateMachine)
 	rsm.state.LogState.Shards[DefaultHAKeeperShardID] = pb.LogShardInfo{
 		Replicas: map[uint64]string{1: "log-1"},
@@ -550,6 +564,7 @@ func TestViewMetadataAdmissionPreparingKeepsLegacyAndHidesPendingCN(t *testing.T
 	updateViewMetadataCN(t, rsm, pb.CNStoreHeartbeat{
 		UUID:                            "pending-cn",
 		ServiceAddress:                  "pending-pipeline",
+		LockServiceAddress:              "pending-lock",
 		ViewMetadataAdmissionSupported:  true,
 		ViewMetadataAdmissionGeneration: 2,
 	})
@@ -564,8 +579,50 @@ func TestViewMetadataAdmissionPreparingKeepsLegacyAndHidesPendingCN(t *testing.T
 	require.False(t, rsm.state.CNState.Stores["pending-cn"].ViewMetadataAdmissionReady)
 
 	details := rsm.handleClusterDetailsQuery(Config{})
+	require.Len(t, details.CNStores, 2)
+	require.False(t, rsm.state.CNState.Stores["pending-cn"].ViewMetadataAdmissionSupported)
+	runtime.SetupServiceBasedRuntime(t.Name(), runtime.DefaultRuntime())
+	cluster := clusterservice.NewMOCluster(t.Name(), &admissionInventoryClient{details: *details}, time.Hour)
+	t.Cleanup(cluster.Close)
+	require.NoError(t, cluster.(clusterservice.AuthoritativeRefresher).Refresh(context.Background()))
+	var raw []string
+	require.NoError(t, clusterservice.GetCNServiceRawWithContext(context.Background(), cluster,
+		clusterservice.NewSelectAll(), func(cn metadata.CNService) bool {
+			raw = append(raw, cn.ServiceID)
+			if cn.ServiceID == "pending-cn" {
+				require.Equal(t, "pending-lock", cn.LockServiceAddress)
+				require.Equal(t, uint64(2), cn.ViewMetadataAdmissionGeneration)
+			}
+			return true
+		}))
+	require.ElementsMatch(t, []string{"legacy-cn", "pending-cn"}, raw)
+	var public []string
+	collectPublic := func(cn metadata.CNService) bool {
+		public = append(public, cn.ServiceID)
+		return true
+	}
+	cluster.GetCNService(clusterservice.NewSelectAll(), collectPublic)
+	require.Equal(t, []string{"legacy-cn"}, public)
+	public = nil
+	cluster.GetCNServiceWithoutWorkingState(clusterservice.NewSelectAll(), collectPublic)
+	require.Equal(t, []string{"legacy-cn"}, public)
+	public = nil
+	require.NoError(t, clusterservice.GetCNServiceWithoutWorkingStateWithContext(context.Background(),
+		cluster, clusterservice.NewSelectAll(), collectPublic))
+	require.Equal(t, []string{"legacy-cn"}, public)
+
+	updateViewMetadataCN(t, rsm, pb.CNStoreHeartbeat{
+		UUID: "pending-cn", LockServiceAddress: "pending-lock",
+		ViewMetadataAdmissionSupported: true, ViewMetadataAdmissionGeneration: 2,
+	})
+	require.Len(t, rsm.handleClusterDetailsQuery(Config{}).CNStores, 2)
+	require.False(t, rsm.state.CNState.Stores["pending-cn"].ViewMetadataAdmissionReady)
+	_, err = rsm.Update(sm.Entry{Index: rsm.state.Index + 1,
+		Cmd: GetDeleteCNStoreCmd(pb.DeleteCNStore{StoreID: "pending-cn"})})
+	require.NoError(t, err)
+	details = rsm.handleClusterDetailsQuery(Config{})
 	require.Len(t, details.CNStores, 1)
-	require.Equal(t, "legacy-cn", details.CNStores[0].UUID)
+	require.Equal(t, "legacy-cn", details.CNStores[0].UUID, "real deletion must still remove t
```

**File**: `pkg/lockservice/rpc_test.go` (modified, +4/-7)
```diff
@@ -1426,13 +1426,9 @@ func TestLockServiceDiscoveryUsesPendingCNInventory(t *testing.T) {
 	cluster := clusterservice.NewMOCluster(
 		service,
 		&fixedClusterClient{details: logpb.ClusterDetails{
-			ViewMetadataAdmission: &logpb.ViewMetadataAdmission{
-				Enabled: true,
-				Epoch:   4,
-			},
+			ViewMetadataAdmission: &logpb.ViewMetadataAdmission{Preparing: true, Epoch: 4},
 			CNStores: []logpb.CNStore{{
-				UUID:                            "cn-id",
-				LockServiceAddress:              "cn.example:18101",
+				UUID: "cn-id", LockServiceAddress: "cn.example:18101",
 				WorkState:                       metadata.WorkState_Working,
 				ViewMetadataAdmissionGeneration: 11,
 			}},
@@ -1463,6 +1459,7 @@ func TestLockServiceDiscoveryUsesPendingCNInventory(t *testing.T) {
 		service:          service,
 		cluster:          cluster,
 		client:           normalRPCClient,
+		keeperClient:     normalRPCClient,
 		activeTxnClient:  activeTxnRPCClient,
 		validationClient: validationRPCClient,
 		logger:           getLogger(service),
@@ -1477,7 +1474,7 @@ func TestLockServiceDiscoveryUsesPendingCNInventory(t *testing.T) {
 	require.True(t, present, "pending public admission must not suppress active-txn recovery")
 
 	_, err = c.AsyncSend(context.Background(), &lock.Request{
-		Method:    lock.Method_Unlock,
+		Method:    lock.Method_KeepRemoteLock,
 		LockTable: lock.LockTable{ServiceID: serviceID},
 	})
 	require.NoError(t, err)
```

**File**: `pkg/util/cn_address_func.go` (modified, +4/-0)
```diff
@@ -56,6 +56,10 @@ func AddressFunc(
 		cns := make([]pb.CNStore, 0, len(details.CNStores))
 		labeled_cns := make([]pb.CNStore, 0, len(details.CNStores))
 		for _, cn := range details.CNStores {
+			if admission := details.ViewMetadataAdmission; admission != nil &&
+				(admission.Preparing || admission.Enabled) && !cn.ViewMetadataAdmissionReady {
+				continue
+			}
 			if cn.WorkState == metadata.WorkState_Working {
 				cns = append(cns, cn)
 				// get logging cn label name
```

**File**: `pkg/util/cn_address_func_test.go` (modified, +38/-0)
```diff
@@ -20,7 +20,9 @@ import (
 	"testing"
 
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 
+	"github.com/matrixorigin/matrixone/pkg/clusterservice"
 	"github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/logutil"
 	log "github.com/matrixorigin/matrixone/pkg/pb/logservice"
@@ -106,4 +108,40 @@ func TestAddressFunc(t *testing.T) {
 		_, err := fn(ctx, true)
 		assert.NoError(t, err)
 	})
+
+	for _, phase := range []string{"preparing", "enabled", "disabled"} {
+		t.Run(phase, func(t *testing.T) {
+			sid := t.Name()
+			runtime.SetupServiceBasedRuntime(sid, runtime.DefaultRuntime())
+			runtime.ServiceRuntime(sid).SetGlobalVariables(runtime.BackgroundCNSelector,
+				clusterservice.NewSelector().SelectByLabel(map[string]string{"role": "background"}, clusterservice.EQ))
+			client := &testHAKeeperClient{value: log.ClusterDetails{
+				ViewMetadataAdmission: &log.ViewMetadataAdmission{
+					Preparing: phase == "preparing", Enabled: phase == "enabled",
+				},
+				CNStores: []log.CNStore{
+					{UUID: "ready", SQLAddress: "ready", WorkState: metadata.WorkState_Working, ViewMetadataAdmissionReady: true},
+					{UUID: "pending", SQLAddress: "pending", WorkState: metadata.WorkState_Working,
+						Labels: map[string]metadata.LabelList{"role": {Labels: []string{"background"}}}},
+				},
+			}}
+			fn := AddressFunc(sid, func() HAKeeperClient { return client })
+			for _, random := range []bool{false, true} {
+				address, err := fn(context.Background(), random)
+				require.NoError(t, err)
+				want := "ready"
+				if phase == "disabled" {
+					want = "pending"
+				}
+				require.Equal(t, want, address, "labels must not override SQL admission")
+			}
+			client.value.CNStores = client.value.CNStores[1:]
+			_, err := fn(context.Background(), false)
+			if phase == "disabled" {
+				require.NoError(t, err)
+			} else {
+				require.Error(t, err, "no admitted CN must return an error, not a pending SQL endpoint")
+			}
+		})
+	}
 }
```

---

### Incident Patch 8: `e4184cdd` (2026-10-04)
**Commit Message**: fix(txn): snapshot zombie transaction age under context lock (#29599)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29598

## What this PR does / why we need it:

Zombie GC previously copied transaction metadata under the context read
lock, released that lock, and then read `createAt`. Concurrent rollback
and pooled-context reuse can write `createAt` during this unlocked read,
causing a data race and pairing metadata and age from different context
initializations.

Replace the GC-only accessor with a metadata/creation-time snapshot
under the same existing read lock. Preserve coordinator filtering, the
strict timeout comparison, and rollback/error handling. Rollback
executes after the snapshot lock is released. No additional production
state, lock acquisition, persisted format, or execution path is
introduced; the extra work is copying `time.Time` inside the existing
critical section.

Tests cover retained snapshots across reset/reinitialization, bounded
concurrent reuse, and real Write → GC/Rollback effects in both service
and storage. Th

**File**: `pkg/txn/service/service.go` (modified, +5/-5)
```diff
@@ -131,15 +131,15 @@ func (s *service) gcZombieTxn(ctx context.Context) {
 		case <-timer.C:
 			s.transactions.Range(func(_, value any) bool {
 				txnCtx := value.(*txnContext)
-				txnMeta := txnCtx.getTxn()
+				txnMeta, createdAt := txnCtx.getTxnSnapshot()
 				// if a txn is not a distributed txn coordinator, wait coordinator dnshard.
 				if len(txnMeta.TNShards) == 0 ||
 					(len(txnMeta.TNShards) > 0 && s.shard.ShardID != txnMeta.TNShards[0].ShardID) {
 					return true
 				}
 
 				now := time.Now()
-				if now.Sub(txnCtx.createAt) > s.zombieTimeout {
+				if now.Sub(createdAt) > s.zombieTimeout {
 					cleanTxns = append(cleanTxns, txnMeta)
 				}
 				return true
@@ -235,7 +235,7 @@ func (s *service) releaseTxnContextLocked(txnCtx *txnContext) {
 type txnContext struct {
 	logger   *log.MOLogger
 	nt       *notifier
-	createAt time.Time
+	createAt time.Time // protected by mu, together with txn metadata
 
 	mu struct {
 		sync.RWMutex
@@ -263,10 +263,10 @@ func (c *txnContext) initLocked(txn txn.TxnMeta, nt *notifier) {
 	c.createAt = time.Now()
 }
 
-func (c *txnContext) getTxn() txn.TxnMeta {
+func (c *txnContext) getTxnSnapshot() (txn.TxnMeta, time.Time) {
 	c.mu.RLock()
 	defer c.mu.RUnlock()
-	return c.getTxnLocked()
+	return c.getTxnLocked(), c.createAt
 }
 
 func (c *txnContext) getTxnLocked() txn.TxnMeta {
```

**File**: `pkg/txn/service/service_cn_handler_test.go` (modified, +5/-3)
```diff
@@ -143,7 +143,8 @@ func TestSingleTNRollback(t *testing.T) {
 	s := txnService.(*service)
 	c := s.getTxnContext(meta.ID)
 	require.NotNil(t, c)
-	require.Equal(t, meta.ID, c.getTxn().ID)
+	current, _ := c.getTxnSnapshot()
+	require.Equal(t, meta.ID, current.ID)
 	w := acquireWaiter()
 	t.Cleanup(w.close)
 	require.True(t, c.addWaiter(meta.ID, w, txn.TxnStatus_Aborted))
@@ -205,11 +206,12 @@ func TestRollbackRejectsStaleContext(t *testing.T) {
 			require.NotNil(t, response.TxnError)
 			require.True(t, moerr.IsMoErrCode(response.TxnError.UnwrapError(), moerr.ErrTxnNotFound))
 			require.Same(t, nt, c.nt)
+			observed, _ := c.getTxnSnapshot()
 			if reused {
-				require.Equal(t, current.ID, c.getTxn().ID)
+				require.Equal(t, current.ID, observed.ID)
 				require.Same(t, c, s.getTxnContext(current.ID))
 			} else {
-				require.Empty(t, c.getTxn().ID)
+				require.Empty(t, observed.ID)
 			}
 			select {
 			case <-w.c:
```

**File**: `pkg/txn/service/service_test.go` (modified, +181/-3)
```diff
@@ -21,9 +21,12 @@ import (
 	"testing"
 	"time"
 
+	"github.com/matrixorigin/matrixone/pkg/common/stopper"
 	"github.com/matrixorigin/matrixone/pkg/pb/txn"
 	"github.com/matrixorigin/matrixone/pkg/txn/rpc"
+	"github.com/matrixorigin/matrixone/pkg/txn/storage/mem"
 	"github.com/matrixorigin/matrixone/pkg/txn/util"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 )
 
@@ -51,6 +54,70 @@ func TestTxnServiceDoesNotCloseBorrowedSender(t *testing.T) {
 	require.Zero(t, sender.closed.Load())
 }
 
+func TestZombieGCUsesTransactionCreationSnapshot(t *testing.T) {
+	sender := NewTestSender()
+	t.Cleanup(func() { assert.NoError(t, sender.Close()) })
+	txnService := NewTestTxnServiceWithLogAndZombie(t, 1, sender, NewTestClock(0), nil, 10*time.Millisecond)
+	s := txnService.(*service)
+	expired := NewTestTxn(1, 1, 1)
+	current := NewTestTxn(2, 2, 1)
+	t.Cleanup(func() {
+		s.stopper.Stop()
+		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+		defer cancel()
+		for _, meta := range []txn.TxnMeta{expired, current} {
+			if s.getTxnContext(meta.ID) != nil {
+				request := NewTestRollbackRequest(meta)
+				response := txn.TxnResponse{}
+				assert.NoError(t, s.Rollback(ctx, &request, &response))
+				assert.Nil(t, response.TxnError)
+			}
+		}
+		assert.NoError(t, txnService.Close(false))
+	})
+	// The constructor starts GC; join it before admitting fixture writes.
+	s.stopper.Stop()
+	require.NoError(t, txnService.Start())
+	sender.AddTxnService(txnService)
+	for _, meta := range []txn.TxnMeta{expired, current} {
+		result, err := sender.Send(t.Context(), []txn.TxnRequest{NewTestWriteRequest(meta.ID[0], meta, 1)})
+		require.NoError(t, err)
+		require.Len(t, result.Responses, 1)
+		require.Nil(t, result.Responses[0].TxnError)
+	}
+
+	storage := s.storage.(*mem.KVTxnStorage)
+	for _, tc := range []struct {
+		meta      txn.TxnMeta
+		createdAt time.Time
+	}{
+		{expired, time.Now().Add(-time.Hour)},
+		{current, time.Now().Add(time.Hour)},
+	} {
+		ctx := s.getTxnContext(tc.meta.ID)
+		require.NotNil(t, ctx)
+		require.NotNil(t, storage.GetUncommittedTxn(tc.meta.ID))
+		ctx.mu.Lock()
+		ctx.createAt = tc.createdAt
+		ctx.mu.Unlock()
+	}
+	// Start the real collector only after both transaction ages are prepared.
+	s.stopper = stopper.NewStopper(t.Name(), stopper.WithLogger(s.logger.RawLogger()))
+	require.NoError(t, s.stopper.RunTask(s.gcZombieTxn))
+
+	require.Eventually(t, func() bool {
+		return s.getTxnContext(expired.ID) == nil
+	}, 5*time.Second, 5*time.Millisecond, "GC must roll back the expired coordinator")
+	require.Nil(t, storage.GetUncommittedTxn(expired.ID))
+	require.NotNil(t, s.getTxnContext(current.ID))
+	require.NotNil(t, storage.GetUncommittedTxn(current.ID))
+
+	result, err := sender.Send(t.Context(), []txn.TxnRequest{NewTestRollbackRequest(current)})
+	require.NoError(t, err)
+	require.Len(t, result.Responses, 1)
+	require.Nil(t, result.Responses[0].TxnError)
+}
+
 func TestMaybeAddTxnPublishesInitializedContext(t *testing.T) {
 	t.Run("fresh_competitors", func(t *testing.T) {
 		s := &service{logger: util.GetLogger("")}
@@ -218,11 +285,13 @@ func TestMaybeAddTxnPublishesInitializedContext(t *testing.T) {
 			}
 			require.Same(t, winner, result)
 			require.Same(t, winner, s.getTxnContext(meta.ID))
-			require.Equal(t, meta.ID, winner.getTxn().ID)
+			winnerMeta, _ := winner.getTxnSnapshot()
+			require.Equal(t, meta.ID, winnerMeta.ID)
 			require.NotNil(t, winner.nt)
 			require.False(t, winner.createAt.IsZero())
 			if !tc.win {
-				require.Empty(t, recycled.getTxn().ID)
+				recycledMeta, _ := recycled.getTxnSnapshot()
+				require.Empty(t, recycledMeta.ID)
 				require.Nil(t, recycled.nt)
 				w := acquireWaiter()
 				t.Cleanup(w.close)
@@ -318,11 +387,120 @@ func TestTxnContextOwnershipExcludesStaleRequests(t *testing.T) {
 			case <-ctx.Done():
 				t.Fatal("context release did not finish")
 			}
-			require.Empty(t, oldReference.getTxn().ID)
+			retiredMeta, _ := oldReference.getTxnSnapshot()
+			require.Empty(t, retiredMeta.ID)
 			require.Nil(t, oldReference.nt)
 			status, err = last.wait(ctx)
 			require.NoError(t, err)
 			require.Equal(t, txn.TxnStatus_Active, status)
 		})
 	}
 }
+
+func TestTxnContextSnapshotAcrossReuse(t *testing.T) {
+	c := &txnContext{}
+	first, second := NewTestTxn(1, 1, 1), NewTestTxn(2, 2, 1)
+	c.mu.Lock()
+	c.initLocked(first, acquireNotifier())
+	c.mu.Unlock()
+	t.Cleanup(func() {
+		c.mu.Lock()
+		defer c.mu.Unlock()
+		if c.nt != nil {
+			c.resetLocked()
+		}
+	})
+	created := time.Unix(100, 0)
+	c.mu.Lock()
+	c.createAt = created
+	c.mu.Unlock()
+	meta, createdAt := c.getTxnSnapshot()
+	require.Equal(t, first, meta)
+	require.Equal(t, created, createdAt)
+
+	c.mu.Lock()
+	c.resetLocked()
+	c.mu.Unlock()
+	resetMeta, resetAt := c.getTxnSnapshot()
+	// Reset metadata makes the GC coordinator filter skip this context;
+	// the old timestamp alone must not identify an active transaction.
+	require.Equal(t, 
```

---

### Incident Patch 9: `a3aece18` (2026-10-04)
**Commit Message**: fix(plan): preserve guarded prepared integer range access (#29612)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Refs #29606

## What this PR does / why we need it:

The real sysbench random_ranges client sends BIGINT parameters for INT
columns. Prepared binding promoted the column or lowered BETWEEN into
OR-connected AND pairs, losing usable index ranges. Conservative
diagnostic classification then prevented storage pruning. Ordinary
bindings could also be marked value-dependent by a discarded dynamic
bound-order check.

Share the existing guarded signed-integer admission across comparisons,
IN and BETWEEN. Admit a closed range atomically, retain immutable full
semantic cast guards for every EXECUTE, and use the existing
index/storage range path and type-keyed Plan/Compile cache. Trusted
decoded binary integer consumers perform one transport conversion;
unsafe or unsupported values retain the existing semantic path. Only
static bounds need the existing BETWEEN order-folding check. No storage
diagnostic gate is relaxed and no cache, state machin

**File**: `pkg/frontend/computation_wrapper.go` (modified, +17/-2)
```diff
@@ -19,6 +19,7 @@ import (
 	"context"
 	"maps"
 	"slices"
+	"strconv"
 	"strings"
 	"sync/atomic"
 	"time"
@@ -970,7 +971,8 @@ func preparedBinaryIntegerCastDiagnosticFree(
 
 // ParseExecuteData has already decoded the integer packet and normalized its
 // bytes. Long data is excluded because it bypasses that decoder. Width and sign
-// therefore suffice to prove this widening conversion, including typed NULL.
+// suffice for widening; signed narrowing also checks the current decoded value.
+// Unsupported provenance or a range miss stays with the isolated probe.
 func preparedDirectBinaryIntegerCastDiagnosticFree(
 	prepareStmt *PrepareStmt, expr *plan.Expr, binaryExecute bool,
 ) bool {
@@ -996,7 +998,20 @@ func preparedDirectBinaryIntegerCastDiagnosticFree(
 		return false
 	}
 	sourceUnsigned := prepareStmt.ParamTypes[int(position)*2+1]&0x80 != 0
-	return target.IsInteger() && sourceUnsigned == target.IsUnsignedInt() && target.TypeLen() >= sourceBytes
+	if !target.IsInteger() || sourceUnsigned != target.IsUnsignedInt() {
+		return false
+	}
+	if target.TypeLen() >= sourceBytes {
+		return true
+	}
+	if !target.IsSignedInt() {
+		return false
+	}
+	if prepareStmt.params.GetNulls().Contains(uint64(position)) {
+		return true
+	}
+	_, err := strconv.ParseInt(string(prepareStmt.params.GetBytesAt(int(position))), 10, target.TypeLen()*8)
+	return err == nil
 }
 
 // binaryProtocolPrepareParamConcreteType retains the protocol's SQL domain
```

**File**: `pkg/frontend/computation_wrapper_test.go` (modified, +30/-2)
```diff
@@ -3575,6 +3575,9 @@ func TestPreparedSignedNarrowingCacheGuard(t *testing.T) {
 		{"update", "update nation set n_regionkey = ? where n_nationkey = ?", []string{"1", "7"}, []int{1}},
 		{"delete", "delete from nation where n_nationkey = ?", []string{"7"}, []int{0}},
 		{"multiple predicates", "update nation set n_name = 'updated' where n_nationkey = ? and n_regionkey = ?", []string{"7", "1"}, []int{0, 1}},
+		{"SELECT comparison", "select n_name from nation where n_nationkey=?", []string{"7"}, []int{0}},
+		{"BETWEEN", "select n_name from nation where n_nationkey between ? and ?", []string{"1", "127"}, []int{0, 1}},
+		{"OR BETWEEN", "select n_name from nation where n_nationkey between ? and ? or n_nationkey between ? and ?", []string{"1", "127", "8", "9"}, []int{0, 1, 2, 3}},
 		{"IN", "select n_name from nation where n_nationkey in (?,?)", []string{"127", "1"}, []int{0, 1}},
 		{"NOT IN", "select n_name from nation where n_nationkey not in (?,?)", []string{"127", "1"}, []int{0, 1}},
 		{"no narrowing", "select ?", []string{"127"}, nil},
@@ -3825,6 +3828,7 @@ func BenchmarkPreparedNarrowingCacheAdmission(b *testing.B) {
 		{"guarded_narrowing", "update nation set n_regionkey=1 where n_nationkey=?", defines.MYSQL_TYPE_LONGLONG},
 		{"IN_same_width", "select n_name from nation where n_nationkey in (?,?)", defines.MYSQL_TYPE_LONG},
 		{"IN_guarded_narrowing", "select n_name from nation where n_nationkey in (?,?)", defines.MYSQL_TYPE_LONGLONG},
+		{"ranges_guarded_narrowing", "select count(n_nationkey) from nation where " + strings.TrimSuffix(strings.Repeat("n_nationkey between ? and ? or ", 10), " or "), defines.MYSQL_TYPE_LONGLONG},
 	} {
 		b.Run(tc.name, func(b *testing.B) {
 			optimizer := plan2.NewMockOptimizer(false)
@@ -6587,7 +6591,15 @@ func TestPreparedBinaryIntegerCastDiagnosticProofBoundary(t *testing.T) {
 		{"unsigned long widening", "4294967295", defines.MYSQL_TYPE_LONG, true, types.T_uint64, false, false, true, true},
 		{"unsigned long long max", "18446744073709551615", defines.MYSQL_TYPE_LONGLONG, true, types.T_uint64, false, false, true, true},
 		{"sign mismatch", "1", defines.MYSQL_TYPE_LONG, false, types.T_uint32, false, false, true, false},
-		{"narrowing", "1", defines.MYSQL_TYPE_LONG, false, types.T_int16, false, false, true, false},
+		{"narrowing", "1", defines.MYSQL_TYPE_LONG, false, types.T_int16, false, false, true, true},
+		{"narrow min", "-2147483648", defines.MYSQL_TYPE_LONGLONG, false, types.T_int32, false, false, true, true},
+		{"narrow max", "2147483647", defines.MYSQL_TYPE_LONGLONG, false, types.T_int32, false, false, true, true},
+		{"narrow underflow", "-2147483649", defines.MYSQL_TYPE_LONGLONG, false, types.T_int32, false, false, true, false},
+		{"narrow overflow", "2147483648", defines.MYSQL_TYPE_LONGLONG, false, types.T_int32, false, false, true, false},
+		{"narrow invalid bytes", "invalid", defines.MYSQL_TYPE_LONGLONG, false, types.T_int32, false, false, true, false},
+		{"narrow NULL", "", defines.MYSQL_TYPE_LONGLONG, false, types.T_int32, true, false, true, true},
+		{"narrow long data", "1", defines.MYSQL_TYPE_LONGLONG, false, types.T_int32, false, true, true, false},
+		{"unsigned narrow stays probed", "1", defines.MYSQL_TYPE_LONGLONG, true, types.T_uint32, false, false, true, false},
 		{"tiny bool heuristic", "1", defines.MYSQL_TYPE_TINY, false, types.T_int32, false, false, true, false},
 		{"long data", "1", defines.MYSQL_TYPE_LONG, false, types.T_int32, false, true, true, false},
 		{"sql prepare", "1", defines.MYSQL_TYPE_LONG, false, types.T_int32, false, false, false, false},
@@ -6612,6 +6624,22 @@ func TestPreparedBinaryIntegerCastDiagnosticProofBoundary(t *testing.T) {
 				prepared.getFromSendLongData = map[int]struct{}{0: {}}
 			}
 			require.Equal(t, tc.want, preparedBinaryIntegerCastDiagnosticFree(prepared, cast, tc.binary))
+			if tc.mysqlType == defines.MYSQL_TYPE_LONGLONG && !tc.unsigned && tc.target == types.T_int32 {
+				// This is the actual signed admission shape: a semantic BIGINT
+				// marker cast to INT, not just the text transport conversion.
+				param.Typ.Id = int32(types.T_int64)
+				typed, err := plan2.BindFuncExprImplByPlanExpr(context.Background(), "cast", []*plan.Expr{param, target})
+				require.NoError(t, err)
+				require.Equal(t, tc.want, preparedBinaryIntegerCastDiagnosticFree(prepared, typed, tc.binary))
+				typed.GetF().SyntaxExplicitCast = true
+				require.False(t, preparedBinaryIntegerCastDiagnosticFree(prepared, typed, tc.binary))
+				// Certifying the outer INT must never hide an inner TINYINT
+				// conversion: its smaller source domain remains independently probed.
+				param.Typ.Id = int32(types.T_int8)
+				inner, err := plan2.BindFuncExprImplByPlanExpr(context.Background(), "cast", []*plan.Expr{param, target})
+				require.NoError(t, err)
+				require.False(t, preparedBinaryIntegerCastDiagnosticFree(prepared, inner, tc.binary))
+			}
 		})
 	}
 }
@@ -6674,7 +6702,7 @@ func TestPreparedBinaryIntegerSeri
```

**File**: `pkg/sql/plan/base_binder.go` (modified, +13/-8)
```diff
@@ -5478,11 +5478,14 @@ func bindFuncExprAndConstFoldInternal(
 			}
 		}
 
-		rangeCheckFn, _ := BindFuncExprImplByPlanExpr(ctx, "<=", []*plan.Expr{arg1, arg2})
-		rangeCheckRes, _ := ConstantFold(batch.EmptyForConstFoldBatch, rangeCheckFn, proc, false, true)
-		rangeCheckVal := rangeCheckRes.GetLit()
-		if rangeCheckVal == nil || !rangeCheckVal.GetBval() {
-			if !containsDynamicParam(arg1) && !containsDynamicParam(arg2) {
+		// Only static bounds can establish their order at bind time. A
+		// throwaway comparison of markers cannot fold and must not add a
+		// value dependency to an otherwise reusable closed range.
+		if !containsDynamicParam(arg1) && !containsDynamicParam(arg2) {
+			rangeCheckFn, _ := BindFuncExprImplByPlanExpr(ctx, "<=", []*plan.Expr{arg1, arg2})
+			rangeCheckRes, _ := ConstantFold(batch.EmptyForConstFoldBatch, rangeCheckFn, proc, false, true)
+			rangeCheckVal := rangeCheckRes.GetLit()
+			if rangeCheckVal == nil || !rangeCheckVal.GetBval() {
 				goto between_fallback
 			}
 		}
@@ -7192,9 +7195,11 @@ func bindFuncExprImplByPlanExpr(
 				inExpr, guardedInteger := rightVal, false
 				if !partitionIn && len(rightList.List) > 1 && !exactIntegerList &&
 					!checkNoNeedCast(ctx, makeTypeByPlan2Expr(rightVal), typLeft, rightVal) {
-					inExpr, guardedInteger, err = bindPreparedIntegerInValue(ctx, args[0], rightVal)
-					if err != nil {
-						return nil, err
+					if state := preparedBindingState(ctx); state != nil && state.selectStatement {
+						inExpr, guardedInteger, err = bindPreparedIntegerValue(ctx, args[0], rightVal)
+						if err != nil {
+							return nil, err
+						}
 					}
 				}
 				if partitionIn || exactIntegerList || guardedInteger || checkNoNeedCast(ctx, makeTypeByPlan2Expr(rightVal), typLeft, rightVal) {
```

**File**: `pkg/sql/plan/constant_filter_diagnostic.go` (modified, +5/-1)
```diff
@@ -325,7 +325,11 @@ func PreparedDirectImplicitIntegerCastParam(expr *plan.Expr) (int32, types.T, bo
 		return 0, types.T_any, false
 	}
 	id, _ := function.DecodeOverloadID(fn.Func.Obj)
-	if id != function.CAST || !types.T(fn.Args[0].Typ.Id).IsMySQLString() {
+	source, target := types.T(fn.Args[0].Typ.Id), types.T(expr.Typ.Id)
+	// A target-domain proof must also certify the inner semantic parameter
+	// conversion. Only a strictly narrower signed domain implies that proof.
+	typedNarrowing := source.IsSignedInt() && target.IsSignedInt() && target.TypeLen() < source.TypeLen()
+	if id != function.CAST || (!source.IsMySQLString() && !typedNarrowing) {
 		return 0, types.T_any, false
 	}
 	param := fn.Args[0].GetP()
```

**File**: `pkg/sql/plan/prepared_binding.go` (modified, +104/-23)
```diff
@@ -22,6 +22,7 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
 	planfunction "github.com/matrixorigin/matrixone/pkg/sql/plan/function"
@@ -218,12 +219,12 @@ func integerDomainFits(source, target types.T) bool {
 	return source.IsUnsignedInt() && !target.IsUnsignedInt() && source.TypeLen() < target.TypeLen()
 }
 
-// IN owns this admission; scalar comparisons and DML keep their source-domain
-// rules. Save the full cast before rewrites can remove the consumer, including
-// an IN used only in a projection. The existing per-EXECUTE probe owns reuse.
-func bindPreparedIntegerInValue(ctx context.Context, column, source *Expr) (*Expr, bool, error) {
+// Direct signed integer consumers share this admission. Keep the full cast
+// before rewrites can remove the consumer; the existing per-EXECUTE diagnostic
+// probe guards reuse while the executable expression retains its ParamRef.
+func bindPreparedIntegerValue(ctx context.Context, column, source *Expr) (*Expr, bool, error) {
 	state := preparedBindingState(ctx)
-	if state == nil || !state.selectStatement || column.GetCol() == nil || source.GetP() == nil {
+	if state == nil || column.GetCol() == nil || source.GetP() == nil {
 		return source, false, nil
 	}
 	target := types.T(column.Typ.Id)
@@ -252,6 +253,77 @@ func bindPreparedIntegerInValue(ctx context.Context, column, source *Expr) (*Exp
 	}
 	state.diagnosticCandidates = append(state.diagnosticCandidates, DeepCopyExpr(converted))
 	state.valueDependent = wasValueDependent
+	// A decoded binary signed integer that fits the target has identical
+	// text→source→target and text→target results. Lower only this consumer's
+	// copy to one transport conversion; retain the original full guard above,
+	// source marker, sibling consumers and source-domain cache key.
+	if binding.Type.Oid == types.T(source.Typ.Id) {
+		if value, ok := state.values[source.GetP().Pos].(ParamValue); ok &&
+			value.IsBinaryProtocol && !value.IsBin && !value.IsBinaryString &&
+			value.PrepareParamKind == vector.PrepareParamInteger {
+			narrowed := DeepCopyExpr(source)
+			narrowed.Typ = converted.Typ
+			return narrowed, true, nil
+		}
+	}
+	return converted, true, nil
+}
+
+// A closed range is published only after both bounds preserve the column's
+// domain. A failed bound discards this attempt's guards and leaves the original
+// expression for normal comparison binding; its value dependency stays live.
+func bindPreparedIntegerBetween(ctx context.Context, args []*Expr) ([]*Expr, bool, error) {
+	state := preparedBindingState(ctx)
+	if state == nil || !state.selectStatement || len(args) != 3 || args[0] == nil || args[0].GetCol() == nil {
+		return args, false, nil
+	}
+	column := args[0]
+	target := types.T(column.Typ.Id)
+	if !target.IsSignedInt() || target.TypeLen() > 4 {
+		return args, false, nil
+	}
+	// Reject derived/mixed domains before inspecting any current values.
+	for _, source := range args[1:] {
+		if source == nil || !types.T(source.Typ.Id).IsSignedInt() || (source.GetP() == nil && source.GetLit() == nil) {
+			return args, false, nil
+		}
+		if param := source.GetP(); param != nil {
+			binding, ok := state.bindingForPosition(param.Pos)
+			if !ok || binding.Type.Oid != types.T(source.Typ.Id) {
+				return args, false, nil
+			}
+		}
+	}
+	guardCount, wasValueDependent := len(state.diagnosticCandidates), state.valueDependent
+	published := false
+	defer func() {
+		if !published {
+			if len(state.diagnosticCandidates) > guardCount {
+				state.valueDependent = true
+				clear(state.diagnosticCandidates[guardCount:])
+			}
+			state.diagnosticCandidates = state.diagnosticCandidates[:guardCount]
+		}
+	}()
+	converted := append([]*Expr(nil), args...)
+	for i, source := range args[1:] {
+		var err error
+		if integerDomainFits(types.T(source.Typ.Id), target) || source.GetLit() != nil &&
+			checkNoNeedCast(ctx, makeTypeByPlan2Expr(source), makeTypeByPlan2Expr(column), source) {
+			converted[i+1], err = makePlan2CastExpr(ctx, source, column.Typ)
+		} else {
+			var admitted bool
+			converted[i+1], admitted, err = bindPreparedIntegerValue(ctx, column, source)
+			if !admitted || err != nil {
+				return args, false, err
+			}
+		}
+		if err != nil {
+			return args, false, err
+		}
+	}
+	state.valueDependent = wasValueDependent
+	published = true
 	return converted, true, nil
 }
 
@@ -365,6 +437,17 @@ func bindPreparedConsumerArguments(ctx context.Context, name string, args []*Exp
 		return args, nil
 	}
 	name = strings.ToLower(name)
+	if name == "between" {
+		converted, admitted, err := bindPreparedIntegerBetween(ctx, args)
+		if err != nil {
+			return nil, err
+		}
+		if admitted {
+			// This whole native range already owns its conversion and guards.
+			// Generic n
```

**File**: `pkg/sql/plan/prepared_binding_test.go` (modified, +82/-6)
```diff
@@ -639,7 +639,7 @@ func TestPreparedSignedKeyGuardPreservesOtherDependencies(t *testing.T) {
 		for _, dependent := range []bool{false, true} {
 			ctx := withPreparedSourceBindings(context.Background(),
 				[]PreparedSourceBinding{{Position: 0, Type: types.T_int64.ToType()}},
-				[]any{ParamValue{Value: "7", IsBinaryProtocol: true}})
+				[]any{ParamValue{Value: "7", IsBinaryProtocol: true, PrepareParamKind: vector.PrepareParamInteger}})
 			state := preparedBindingState(ctx)
 			state.valueDependent = dependent
 			state.selectStatement = selectStatement
@@ -652,7 +652,7 @@ func TestPreparedSignedKeyGuardPreservesOtherDependencies(t *testing.T) {
 				if selectStatement {
 					var admitted bool
 					var err error
-					converted, admitted, err = bindPreparedIntegerInValue(ctx, column, param)
+					converted, admitted, err = bindPreparedIntegerValue(ctx, column, param)
 					require.NoError(t, err)
 					require.True(t, admitted)
 				} else {
@@ -661,10 +661,26 @@ func TestPreparedSignedKeyGuardPreservesOtherDependencies(t *testing.T) {
 					converted = args[1]
 				}
 				require.Equal(t, int32(target), converted.Typ.Id)
+				require.NotNil(t, converted.GetP(), "admitted consumer uses one transport conversion")
+				require.Equal(t, int32(types.T_int64), param.Typ.Id, "source/sibling domain stays unchanged")
+				require.Equal(t, types.T_int64, state.bindings[0].Type.Oid)
+				require.NotSame(t, param, converted, "sibling source occurrence remains immutable")
+				guard := state.diagnosticCandidates[len(state.diagnosticCandidates)-1]
+				require.Equal(t, int32(types.T_int64), guard.GetF().Args[0].Typ.Id)
 				require.Equal(t, dependent, state.valueDependent)
 				require.NotSame(t, converted, state.diagnosticCandidates[len(state.diagnosticCandidates)-1])
 			}
 			require.Len(t, state.diagnosticCandidates, 3)
+			// Revisiting a consumer-local marker must retain the full original
+			// source proof as well as another consumer's narrower domain.
+			firstGuard := state.diagnosticCandidates[0]
+			native := DeepCopyExpr(param)
+			native.Typ = makeSimplePlan2Type(types.T_int32)
+			column := &Expr{Typ: native.Typ, Expr: &planpb.Expr_Col{Col: &planpb.ColRef{}}}
+			_, _, err := bindPreparedIntegerValue(ctx, column, native)
+			require.NoError(t, err)
+			require.Same(t, firstGuard, state.diagnosticCandidates[0])
+			require.Equal(t, int32(types.T_int64), firstGuard.GetF().Args[0].Typ.Id)
 			proc := testutil.NewProcess(t)
 			params := vector.NewVec(types.T_text.ToType())
 			t.Cleanup(func() { proc.SetPrepareParams(nil); params.Free(proc.Mp()); proc.Free() })
@@ -683,7 +699,64 @@ func TestPreparedSignedKeyGuardPreservesOtherDependencies(t *testing.T) {
 	}
 }
 
-func TestPreparedIntegerInAdmissionRejectsUnsupportedDomains(t *testing.T) {
+func TestPreparedIntegerConsumerLoweringProvenance(t *testing.T) {
+	for _, value := range []ParamValue{
+		{Value: "7", PrepareParamKind: vector.PrepareParamInteger},
+		{Value: "7", IsBinaryProtocol: true},
+		{Value: "7", IsBinaryProtocol: true, IsBin: true, PrepareParamKind: vector.PrepareParamInteger},
+		{Value: "7", IsBinaryProtocol: true, IsBinaryString: true, PrepareParamKind: vector.PrepareParamInteger},
+	} {
+		ctx := withPreparedSourceBindings(context.Background(), []PreparedSourceBinding{{Position: 0, Type: types.T_int64.ToType()}}, []any{value})
+		param := &Expr{Typ: makeSimplePlan2Type(types.T_int64), Expr: &planpb.Expr_P{P: &planpb.ParamRef{Pos: 0}}}
+		column := &Expr{Typ: makeSimplePlan2Type(types.T_int32), Expr: &planpb.Expr_Col{Col: &planpb.ColRef{}}}
+		converted, admitted, err := bindPreparedIntegerValue(ctx, column, param)
+		require.NoError(t, err)
+		require.True(t, admitted)
+		require.NotNil(t, converted.GetF(), "SQL/opaque/unclassified transport retains the source conversion")
+		require.Equal(t, int32(types.T_int64), converted.GetF().Args[0].Typ.Id)
+	}
+}
+
+// Failure on either side must not publish half a narrow range or discard a
+// diagnostic/dependency owned by a different consumer in the same statement.
+func TestPreparedIntegerBetweenAtomicAdmission(t *testing.T) {
+	for _, bounds := range [][]any{{int64(7), int64(2147483648)}, {int64(-2147483649), int64(7)}, {int64(7), int64(8)}} {
+		for _, dependent := range []bool{false, true} {
+			ctx := withPreparedSourceBindings(context.Background(), []PreparedSourceBinding{
+				{Position: 0, Type: types.T_int64.ToType()}, {Position: 1, Type: types.T_int64.ToType()},
+			}, bounds)
+			state := preparedBindingState(ctx)
+			state.selectStatement, state.valueDependent = true, dependent
+			prior := &Expr{Typ: makeSimplePlan2Type(types.T_int64), Expr: &planpb.Expr_P{P: &planpb.ParamRef{Pos: 0}}}
+			state.diagnosticCandidates = []*Expr{prior}
+			lower, err := bindPreparedSource(ctx, 1)
+			require.NoError(t, err)
+			upper, err := bindPreparedSource(ctx, 2)
+			require.NoError(t, err)
+			column := &Expr{Typ: makeSimplePlan2Type(types.T_int32), Expr: &planpb.Expr_Col{Col: &planpb.Col
```

**File**: `pkg/tests/sqlintegration/prepared_numeric_temporal_contract_test.go` (modified, +90/-0)
```diff
@@ -60,6 +60,96 @@ func TestPreparedNumericTemporalContracts(t *testing.T) {
 			require.NoError(t, conn.QueryRowContext(ctx, q, args...).Scan(&s), q)
 			return s
 		}
+		t.Run("guarded integer ranges", func(t *testing.T) {
+			exec(t, "create table range_keys(id int primary key,k int,v int,key k_1(k),key kv_1(k,v))")
+			exec(t, "insert into range_keys values(1,-2147483648,0),(2,-1,0),(3,null,0),(4,0,0),(5,1,0),(6,1,0),(7,8,0),(8,2147483647,0)")
+			for _, path := range []struct{ name, projection, table, column string }{
+				{"covering", "id", "range_keys force index(k_1)", "k"},
+				{"backfill", "id+v", "range_keys force index(k_1)", "k"},
+				{"composite", "id", "range_keys force index(kv_1)", "k"},
+				{"explicit cast", "id", "range_keys", "cast(k as signed)"},
+				{"base scan", "id", "range_keys ignore index(k_1,kv_1)", "k"},
+			} {
+				t.Run(path.name, func(t *testing.T) {
+					q := fmt.Sprintf("select %s from %s where %s between ? and ? or %s between ? and ? order by id", path.projection, path.table, path.column, path.column)
+					explained, err := conn.QueryContext(ctx, "explain "+q, int64(0), int64(1), int64(8), int64(8))
+					require.NoError(t, err)
+					defer explained.Close()
+					var planText strings.Builder
+					for explained.Next() {
+						var line string
+						require.NoError(t, explained.Scan(&line))
+						planText.WriteString(line)
+						planText.WriteByte('\n')
+					}
+					require.NoError(t, explained.Err())
+					if strings.Contains(path.table, "force index") {
+						require.Contains(t, planText.String(), "Index Table Scan")
+						if path.name == "backfill" {
+							require.Contains(t, planText.String(), "Join Type: INDEX")
+							require.Contains(t, planText.String(), "Table Scan on "+schema+".range_keys")
+						}
+					} else {
+						require.NotContains(t, planText.String(), "Index Table Scan")
+					}
+					p, err := conn.PrepareContext(ctx, q)
+					require.NoError(t, err)
+					defer p.Close()
+					for _, tc := range []struct {
+						name   string
+						bounds []any
+						want   []int64
+					}{
+						{"closed endpoints", []any{int64(-2147483648), int64(-2147483648), int64(2147483647), int64(2147483647)}, []int64{1, 8}},
+						{"overlap and duplicate keys", []any{int64(0), int64(1), int64(1), int64(8)}, []int64{4, 5, 6, 7}},
+						{"reversed", []any{int64(8), int64(1), int64(9), int64(10)}, []int64{}},
+						{"lower outside domain", []any{int64(-2147483649), int64(-1), int64(2147483648), int64(2147483650)}, []int64{1, 2}},
+						{"upper outside domain", []any{int64(0), int64(2147483648), int64(1), int64(1)}, []int64{4, 5, 6, 7, 8}},
+						{"safe recovery", []any{int64(1), int64(1), int64(8), int64(8)}, []int64{5, 6, 7}},
+						{"NULL bound", []any{nil, int64(1), int64(8), int64(8)}, []int64{7}},
+						{"unsigned", []any{uint64(1), ^uint64(0), ^uint64(0), ^uint64(0)}, []int64{5, 6, 7, 8}},
+						{"fractional", []any{float64(0.5), float64(1.5), float64(8), float64(8)}, []int64{5, 6, 7}},
+						{"text fractions", []any{"0.5", "1.5", int64(8), int64(8)}, []int64{5, 6, 7}},
+						{"recovery after category changes", []any{int64(0), int64(0), int64(8), int64(8)}, []int64{4, 7}},
+					} {
+						got, err := readPreparedContractIDs(p.QueryContext(ctx, tc.bounds...))
+						if tc.name == "unsigned" && path.name != "explicit cast" {
+							// The existing unsigned comparison domain rejects negative
+							// column values. Signed admission must not hide that error.
+							require.ErrorContains(t, err, "data out of range")
+							continue
+						}
+						require.NoError(t, err, tc.name)
+						require.Equal(t, tc.want, got, tc.name)
+					}
+				})
+			}
+			for _, tc := range []struct {
+				name, predicate string
+				want            []int64
+				warn            bool
+			}{
+				{"active warning", "k between ? and ?", []int64{5, 6}, true},
+				{"inactive warning", "case when false then k between ? and ? else false end", []int64{}, false},
+				{"empty warning", "id<0 and k between ? and ?", []int64{}, false},
+			} {
+				t.Run(tc.name, func(t *testing.T) {
+					p, err := conn.PrepareContext(ctx, "select id from range_keys where "+tc.predicate+" order by id")
+					require.NoError(t, err)
+					defer p.Close()
+					got, err := readPreparedContractIDs(p.QueryContext(ctx, "1tail", int64(2)))
+					require.NoError(t, err, tc.name)
+					require.Equal(t, tc.want, got, tc.name)
+					count, err := strconv.Atoi(scalar(t, "select @@warning_count"))
+					require.NoError(t, err)
+					wantWarnings := 0
+					if tc.warn {
+						wantWarnings = 1
+					}
+					require.Equal(t, wantWarnings, count, tc.name)
+				})
+			}
+		})
 		t.Run("persisted signed DML read budget", func(t *testing.T) {
 			// Same fixture, connection and tiny layout for public results and
 			// fresh-execution work. EXPLAIN does not prove cached reader work.
```

---

### Incident Patch 10: `c3fbe9ce` (2026-10-04)
**Commit Message**: test(function): consolidate decimal contracts and fix full-scale alignment (#29608)

## What type of PR is this?

- [x] BUG
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Closes #29607. Refs #29249; the wider test-quality task remains ongoing.

## What this PR does / why we need it:

Decimal256 arithmetic could fail when operand scales differed by more
than38. Fix all eight fused Add/Sub vector preparations through their
existing checked scaling owner, and guard modulo narrowing by its actual
scale domain. Preserve representable remainders when intermediate scale
alignment overflows.

Successful alignment also exposed an existing high-bit modulo defect:
`2e18 % (2^126 × 10^-58)` could loop forever, while the `4e18` variant
returned the dividend. Replace the shared truncating Decimal256 division
with exact unsigned quotient/remainder arithmetic. One-limb divisors
reuse the existing native helper; wide division processes at most192
bits without signed comparisons, dividend doubling, or modulo's
overflow-prone `q*y` reconstruction. Formatting uses the same exact
native small-divisor helper, including MinInt256. Existing rounded
division and scale-overflow 

**File**: `docs/design/20261003-expression-quality-consolidation.md` (modified, +290/-0)
```diff
@@ -188,3 +188,293 @@ cache completed the same checks in 68s. MO-specific lint has no incremental
 finding: its two unsafe diagnostics exactly match prior accepted evidence in
 unchanged files. Formatting and patch checks pass. No new BVT is required for
 this fixture-only change; existing production/public-path evidence is unchanged.
+
+## Decimal256 scalar cast oracle consolidation (Refs #29249)
+
+The dispatcher test now owns 21 original numeric/string destination routes and
+five rejection cases. Eight former NULL-only evaluations share the corresponding
+positive evaluations, with exact NULL publication assertions. Seven helper smoke
+calls are absorbed into these real dispatch routes; a separate `(76,0) → (65,0)`
+case preserves the helper parsing path, distinct from `(76,0) → (76,0)` copying.
+Thus 41 evaluations become 27; no measured speedup is claimed for this closure.
+
+Independent typed coefficient/value literals replace ignored errors and unchecked
+results. Binary padding is checked byte for byte. Successful results retain full
+destination metadata and source metadata; rejected casts assert error classes,
+diagnostics and no NULL publication; binary width rejection also checks empty
+variable output. Fixed result length is preallocated, so it is not an error
+publication oracle. Both pool accounts must return to baseline after
+each child, including early assertion failure. Existing FunctionTestCase owns
+construction, result comparison and cleanup; one existing Process constructor
+supplies context and memory without unnecessary file or SQL services.
+
+Public CAST scale normalization, fractional assignment, precision rejection,
+rounding, YEAR SQL modes and Datalink validation remain in their existing tests.
+The bare numeric Datalink route is not a public validation claim. The current YEAR
+route was absent from the old matrix and is outside this bounded consolidation.
+Production code, shared framework and dependencies are unchanged; BVT is not
+applicable to this test-only scalar fixture closure. Focused normal/race runs
+pass all 27 children; 11 related public CAST tests pass. Vet and configured
+incremental lint pass; two unchanged baseline MO lint diagnostics remain.
+Six task-private producer mutations survive the old tests and are rejected by
+the strengthened assertions, with both accounts restored. A forced FailNow
+restores both accounts; omitting cleanup retains 32 heap bytes and is detected.
+The initial diagnostic classifier incorrectly demanded simultaneous native and
+heap leakage; the existing runtime logs were reclassified without rerunning.
+Full function race remains failed under #29592 and unwaived; #29593 and #29594
+remain unresolved. This local checkpoint cannot clear those gates; #29249 stays
+open.
+
+## Decimal multiplication/modulo kernel consolidation (Refs #29249)
+
+Baseline: `83b47281b875a549eb21460282c920273109ffe4`. One connected test file
+consolidates 15 overlapping wrappers into existing kernel owners. Production,
+shared framework, dependencies and public BVT are unchanged. There are 101 kernel
+calls and 205 logical positions, formerly 110 and 8,366, excluding unchanged
+exceptional owners. Single-purpose batches stay direct; tables contain only
+varying policy fields. `d256MulRef` remains the existing benchmark baseline.
+
+| Retired responsibilities | Retained owners and independent witnesses |
+| --- | --- |
+| D128 multiplication, scales, constants and NULLs | `TestD128Mul`: int64/inline routes, both broadcast orientations, four separate signed-admission boundary identities, rounding and typed overflow |
+| D256 multiplication tiers and large operands | `TestD256Mul`: actual int32/int64/generic routes, MaxInt64 squared, full-width carry, NULL-first mixed batches and scaled generic overflow suppression |
+| Misnamed high-scale/int64 smokes | Reduction 8 is `TestD256Mul_Int32ScaleDown`; the former int64 fixture actually sampled int32. Actual high-scale, declared-width and raw-overflow recovery owners remain in `arith_decimal_wide_test.go` |
+| Modulo helper argument matrices | `TestD256Mod`: caller-derived admission/length/bitmap, both scale directions/chunks, narrowing fallback, dividend sign and full-width remainders |
+| Modulo zero/NULL policies | `TestD256Mod_DivByZeroPaths`: strict typed errors, permissive NULL publication followed by a live row, pre-existing NULL followed by a live row, all-NULL vector-divisor control |
+
+All 105 former named children have concrete retained destinations in the local
+review evidence. Original large-modulo operands, carry and alignment-overflow
+owners remain. The original multi-step helper rounding oracles remain, with four
+caller batches added. Inline adjustments retain their operands but use reachable
+scales `(8,8)` and `(12,12)`. NULL payloads are undefined: compare every live
+coefficient and the complete bitmap. Public wholly-NULL/constant-zero bypass
+remains in its existing public owner. No scratch-
```

**File**: `docs/design/20261003-function-test-fixture-ownership.md` (modified, +39/-8)
```diff
@@ -47,8 +47,8 @@ production compilation with verified native artifacts. No new SQL behavior or
 BVT is introduced. Measure cost with frozen alternating runs before claiming it.
 
 Known independent boundaries remain: weak wantErr oracles, DebugRun selection
-and double execution, detached-worker shutdown, formal clock publication, the
-342-file audit, and benchmark iteration accounting.
+and double execution, detached-worker shutdown, formal clock publication, and
+the 342-file audit.
 
 ## Consumer coverage and ownership map
 
@@ -63,7 +63,7 @@ and double execution, detached-worker shutdown, formal clock publication, the
 | SERIAL/SERIAL_FULL | Per-scenario case Free before operator Close | Exact decoded tuple/UUID/NULL/geometry plus explicit execution, cardinality and type assertions |
 | NOW/SYSDATE precision | One execution per existing boundary, child-test Free | All 18 boundaries; exact type/scale, NULL, precision quantum and typed errors |
 | UTC timestamp precision | Existing registered UTC tests, immediate input/output cleanup | All nine retired cases mapped to exact values/metadata and typed errors; existing non-constant admission tests retained |
-| Benchmarks | Canonical release outside timed work or per existing iteration | Original work/count and result controls retained; compile alone is not performance evidence |
+| Benchmarks | B.Loop owns timing/count; child case Free precedes parent process Free | All 169 Cast cases (two expected errors), 13-row Abs and six 8192-row DateFormat batches; untimed literal checks and per-iteration error polarity |
 
 Geodetic geometry32 cases now select encoded inputs and result type before their
 sole construction. The discarded construction was never evaluated; invalid-unit
@@ -78,9 +78,10 @@ fail exact account baselines. Fatal JSON probes are expected failures, not green
 tests. Forcing NOW/SYSDATE precision to zero fails all twelve positive-precision
 cases while retaining zero/invalid-precision controls.
 
-Final owning-package normal (6.327s), race (11.071s), vet and incremental lint
-passed with all 221 Go source hashes unchanged. Actual gpt-6.1-sol/xhigh
-implementation review approved; equality and NULL-skip mutations were rejected.
+At the reviewed ownership/comparison checkpoint, normal (6.327s), race
+(11.071s), vet and incremental lint passed with all 221 Go source hashes
+unchanged. Actual gpt-6.1-sol/xhigh review approved; equality and NULL-skip
+mutations were rejected.
 Production-only compilation remains valid from the ownership checkpoint.
 Rebase or subsequent edits require evidence reconciliation before delivery.
 The seven no-marker candidates were inspected: one missing destructor was fixed;
@@ -93,6 +94,33 @@ batches. XML still reaches the exact work limit; LIKE retains forced budget
 exhaustion, an NTT block boundary, and positive/negative search offsets. Private
 production mutations are rejected by each corresponding oracle.
 
+The old Abs benchmark panics at its first evaluation because the lazy result
+vector was not admitted. Benchmark now reuses Run for untimed admission and
+PreExtendAndReset before each real evaluation. B.Loop replaces the fixed 100000
+loop; no error is ignored. DateFormat's 100 identical cases become one batch,
+retaining every value, NULL, constant and expected field. The unused multi-case
+builder and old benchmark helper are retired with their callers.
+DebugRun now admits/reset results through the same vector owner and forwards
+its existing selection. Its 26 callers and the helper's masked execution branch
+no longer prepare or dispatch separately; raw evaluator errors still return the
+borrowed partial vector. The helper alone returns nil on error. Existing reuse
+and quota scenarios prove fresh masked execution, mask reset and rejection
+before evaluator entry. Six decimal benchmarks now check literal coefficient
+123400 and full source/result types, with no unused target-vector payload.
+At the historical DebugRun checkpoint, full-package normal tests, all 29
+affected UTs under race, six decimal benchmarks, vet and incremental lint
+passed. Independent gpt-6.1-sol xhigh review approved this local closure; the
+full-package race gate had failed under #29592 at that stage.
+At the subsequent benchmark checkpoint, normal package tests and all 176
+benchmarks passed at 1x; the four affected UTs
+and all 176 benchmarks passed under race at 2x. Native/heap-baseline and B.N+1
+real-entry probes passed; both post-admission Cast input mutants failed timed
+error guards. Vet and incremental lint passed. Full-package race failed at the
+known regexp2 timeout case before benchmarks ran; that failure was an open
+delivery gate at that stage. Benchmark code/evidence passed independent xhigh
+review; that review did not approve overall delivery or prove that the
+dependency had been repaired.
+
 Twenty-three exact fixed-type comparisons share the existing vector wrapper
 path. Float64 retains epsilon and paired-Na
```

**File**: `pkg/container/types/decimal.go` (modified, +55/-38)
```diff
@@ -1222,36 +1222,63 @@ func (x Decimal256) Div256(y Decimal256) (Decimal256, error) {
 	}
 }
 
-func (x Decimal256) div256Trunc(y Decimal256) (Decimal256, error) {
+// div256TruncQuoRem divides unsigned 256-bit magnitudes. Signed callers
+// normalize operands and restore the sign themselves, including the 2^255
+// magnitude of MinInt256. Neither alignment nor subtraction uses signed math.
+func (x Decimal256) div256TruncQuoRem(y Decimal256) (Decimal256, Decimal256, error) {
 	if y.B128_191 == 0 && y.B192_255 == 0 && y.B64_127 == 0 {
 		if y.B0_63 == 0 {
-			return x, moerr.NewInvalidInputNoCtx("Decimal256 Div by Zero")
+			return x, Decimal256{}, moerr.NewInvalidInputNoCtx("Decimal256 Div by Zero")
 		}
-		x = x.Left(1)
-		z := Decimal256{0, 0, 0, 0}
-		z.B192_255, z.B128_191 = bits.Div64(0, x.B192_255, y.B0_63)
-		z.B128_191, z.B64_127 = bits.Div64(z.B128_191, x.B128_191, y.B0_63)
-		z.B64_127, z.B0_63 = bits.Div64(z.B64_127, x.B64_127, y.B0_63)
-		z.B0_63, _ = bits.Div64(z.B0_63, x.B0_63, y.B0_63)
-		return z.Right(1), nil
+		q, r := div256ByUint64(x, y.B0_63)
+		return q, Decimal256{B0_63: r}, nil
 	}
 
-	x = x.Left(1)
-	w := Decimal256{1, 0, 0, 0}
-	z := Decimal256{0, 0, 0, 0}
-	for y.Compare(x) <= 0 {
-		y = y.Left(1)
-		w = w.Left(1)
-	}
-	for y.B0_63 != 0 || y.B64_127 != 0 || y.B128_191 != 0 || y.B192_255 != 0 {
-		y = y.Right(1)
-		w = w.Right(1)
-		if y.Compare(x) <= 0 {
-			z, _ = z.Add256(w)
-			x, _ = x.Sub256(y)
+	bitLen := func(v Decimal256) int {
+		switch {
+		case v.B192_255 != 0:
+			return 192 + bits.Len64(v.B192_255)
+		case v.B128_191 != 0:
+			return 128 + bits.Len64(v.B128_191)
+		case v.B64_127 != 0:
+			return 64 + bits.Len64(v.B64_127)
+		default:
+			return bits.Len64(v.B0_63)
 		}
 	}
-	return z.Right(1), nil
+	shift := bitLen(x) - bitLen(y)
+	if shift < 0 {
+		return Decimal256{}, x, nil
+	}
+	// The aligned highest bit stays within x's bit length. A wide divisor
+	// has at least 65 bits, so this loop processes at most 192 quotient bits.
+	d := y.Left(shift)
+	q := Decimal256{}
+	for i := shift; i >= 0; i-- {
+		q = q.Left(1)
+		var candidate Decimal256
+		var borrow uint64
+		candidate.B0_63, borrow = bits.Sub64(x.B0_63, d.B0_63, 0)
+		candidate.B64_127, borrow = bits.Sub64(x.B64_127, d.B64_127, borrow)
+		candidate.B128_191, borrow = bits.Sub64(x.B128_191, d.B128_191, borrow)
+		candidate.B192_255, borrow = bits.Sub64(x.B192_255, d.B192_255, borrow)
+		if borrow == 0 {
+			x = candidate
+			q.B0_63 |= 1
+		}
+		d = Decimal256{
+			B0_63:    d.B0_63>>1 | d.B64_127<<63,
+			B64_127:  d.B64_127>>1 | d.B128_191<<63,
+			B128_191: d.B128_191>>1 | d.B192_255<<63,
+			B192_255: d.B192_255 >> 1,
+		}
+	}
+	return q, x, nil
+}
+
+func (x Decimal256) div256Trunc(y Decimal256) (Decimal256, error) {
+	q, _, err := x.div256TruncQuoRem(y)
+	return q, err
 }
 
 // Div256Trunc is the exported version of div256Trunc for integer division (DIV)
@@ -1292,16 +1319,11 @@ func (x Decimal128) Mod128(y Decimal128) (Decimal128, error) {
 }
 
 func (x Decimal256) Mod256(y Decimal256) (Decimal256, error) {
-	z, err := x.div256Trunc(y)
+	_, r, err := x.div256TruncQuoRem(y)
 	if err != nil {
 		return x, err
 	}
-	z, err = z.Mul256(y)
-	if err != nil {
-		return x, err
-	}
-	z, err = x.Sub256(z)
-	return z, err
+	return r, nil
 }
 
 func (x Decimal64) Add(y Decimal64, scale1, scale2 int32) (z Decimal64, scale int32, err error) {
@@ -2716,17 +2738,12 @@ func (x Decimal256) Format(scale int32) string {
 	const decimal256FormatBufSize = 80
 	var buf [decimal256FormatBufSize]byte
 	i := len(buf)
-	one := Decimal256{1, 0, 0, 0}
-	ten := Decimal256{10, 0, 0, 0}
 
 	for x.B0_63 != 0 || x.B64_127 != 0 || x.B128_191 != 0 || x.B192_255 != 0 {
-		y, _ := x.Mod256(ten)
+		var remainder uint64
+		x, remainder = div256ByUint64(x, 10)
 		i--
-		buf[i] = byte(y.B0_63) + '0'
-		x, _ = x.Div256(ten)
-		if y.B0_63 >= 5 {
-			x, _ = x.Sub256(one)
-		}
+		buf[i] = byte(remainder) + '0'
 		scale--
 		if scale == 0 {
 			i--
```

**File**: `pkg/container/types/decimal_test.go` (modified, +379/-254)
```diff
@@ -192,7 +192,28 @@ func TestParse256(t *testing.T) {
 	}
 }
 
-func TestDecimal256ModScaleAlignmentOverflow(t *testing.T) {
+func TestDecimalModScaleAlignmentOverflow(t *testing.T) {
+	max64 := Decimal64(^uint64(0) >> 1)
+	max128 := Decimal128{B0_63: ^uint64(0), B64_127: 0x7FFFFFFFFFFFFFFF}
+	max256 := Decimal256{B0_63: ^uint64(0), B64_127: ^uint64(0), B128_191: ^uint64(0), B192_255: 0x7FFFFFFFFFFFFFFF}
+	// Each signed maximum is 2^odd-1: multiplying by 10^18 leaves remainder 1 modulo 3.
+	for _, tc := range []struct{ divisor, want uint64 }{{1, 0}, {3, 1}} {
+		t.Run(fmt.Sprintf("wide_coefficient_divisor_%d", tc.divisor), func(t *testing.T) {
+			got64, scale, err := max64.Mod(Decimal64(tc.divisor), 0, 18)
+			require.NoError(t, err)
+			require.Equal(t, int32(18), scale)
+			require.Equal(t, Decimal64(tc.want), got64)
+			got128, scale, err := max128.Mod(Decimal128{B0_63: tc.divisor}, 0, 18)
+			require.NoError(t, err)
+			require.Equal(t, int32(18), scale)
+			require.Equal(t, Decimal128{B0_63: tc.want}, got128)
+			got256, scale, err := max256.Mod(Decimal256{B0_63: tc.divisor}, 0, 18)
+			require.NoError(t, err)
+			require.Equal(t, int32(18), scale)
+			require.Equal(t, Decimal256{B0_63: tc.want}, got256)
+		})
+	}
+
 	maxCoefficient := new(big.Int).Sub(
 		new(big.Int).Exp(big.NewInt(10), big.NewInt(65), nil), big.NewInt(1))
 	maximum, err := ParseDecimal256(maxCoefficient.String(), 65, 0)
@@ -552,26 +573,34 @@ func TestCompare256(t *testing.T) {
 	}
 }
 
-func TestDecimal64Float(t *testing.T) {
-	x := Decimal64(rand.Int())
-	y := Decimal64ToFloat64(x, 15)
-	z, _ := Decimal64FromFloat64(y, 18, 5)
-	x, _ = x.Scale(-10)
-	if x != z {
-		panic("DecimalFloat wrong")
-	}
-}
-func TestDecimal128Float(t *testing.T) {
-	// This test is flaky, so skip it for now.
-	t.Skip()
-
-	x := Decimal128{uint64(rand.Int()), uint64(rand.Int())}
-	y := Decimal128ToFloat64(x, 30)
-	z, _ := Decimal128FromFloat64(y, 38, 7)
-	x, _ = x.Scale(-23)
-	if x != z {
-		panic("DecimalFloat wrong")
+func TestDecimalToFloat64(t *testing.T) {
+	// Binary floating point is lossy; forward conversion is not a reversible quantizer.
+	for _, tc := range []struct {
+		name      string
+		value     Decimal128
+		scale     int32
+		want      uint64
+		decimal64 bool
+	}{
+		{"zero", Decimal128{}, 15, 0, true},
+		{"positive fraction", Decimal128{125000000000000, 0}, 15, 0x3fc0000000000000, true},
+		{"negative fraction", Decimal128{18446619073709551616, 0xffffffffffffffff}, 15, 0xbfc0000000000000, true},
+		{"negative scale", Decimal128{125, 0}, -1, 0x4093880000000000, true},
+		{"integer tie", Decimal128{9007199254740993, 0}, 0, 0x4340000000000000, true},
+		{"high word", Decimal128{0, 1}, 0, 0x43f0000000000000, false},
+		{"scale chunk boundary", Decimal128{10000000000000000000, 0}, 19, 0x3ff0000000000000, false},
+		{"scale chunk continuation", Decimal128{7766279631452241920, 5}, 20, 0x3ff0000000000000, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			require.Equal(t, tc.want, math.Float64bits(Decimal128ToFloat64(tc.value, tc.scale)))
+			if tc.decimal64 {
+				require.Equal(t, tc.want, math.Float64bits(Decimal64ToFloat64(Decimal64(tc.value.B0_63), tc.scale)))
+			}
+		})
 	}
+	converted, err := Decimal64FromFloat64(0.125, 18, 5)
+	require.NoError(t, err)
+	require.Equal(t, Decimal64(12500), converted)
 }
 
 func TestDecimal128FromFloat64PreservesScaledIntegerPrecision(t *testing.T) {
@@ -764,57 +793,103 @@ func TestDecimal128FromFloat64RejectsSpecialValuesAndInvalidTypes(t *testing.T)
 }
 
 func TestDecimal64AddSub(t *testing.T) {
-	x := Decimal64(rand.Int() >> 1)
-	z := x
-	err := error(nil)
-	y := Decimal64(rand.Int() >> 1)
-	x, _, err = x.Add(y, 0, 0)
-	if err == nil {
-		x, _, err = x.Sub(y, 0, 0)
+	result, scale, err := Decimal64(2305843009213693952).Add(1152921504606846976, 0, 0)
+	require.NoError(t, err)
+	require.Equal(t, Decimal64(3458764513820540928), result)
+	require.Equal(t, int32(0), scale)
+	result, scale, err = Decimal64(3458764513820540928).Sub(1152921504606846976, 0, 0)
+	require.NoError(t, err)
+	require.Equal(t, Decimal64(2305843009213693952), result)
+	require.Equal(t, int32(0), scale)
+
+	_, _, err = Decimal64(9223372036854775807).Add(1, 0, 0)
+	require.True(t, moerr.IsMoErrCode(err, moerr.ErrInvalidInput))
+	require.EqualError(t, err, "invalid input: Decimal64 Add overflow: 9223372036854775807+1")
+	result, scale, err = Decimal64(0).Sub(9223372036854775807, 0, 10)
+	require.NoError(t, err)
+	require.Equal(t, Decimal64(9223372036854775809), result) // -(2^63-1) in two's complement.
+	require.Equal(t, int32(10), scale)
+
+	tests := []struct {
+		name  string
+		x, y  Decimal64
+		isSub bool
+		want  Decimal64
+	}{
+		{"simple add", Decimal64(100), Decimal64(200), false, Decimal64(300)},
+		{"simple sub", Decimal64(300), Decimal64(100), true, Decimal64(200)},
+		{"add negative", Decimal64(100), Decimal64(^uint64(100) + 1), false, Decimal64(0)},
+		{"sub negative (add)", Decimal64(100), Decimal64(^uint64(100) + 1
```

**File**: `pkg/sql/plan/decimal256_high_scale_mul_test.go` (modified, +64/-0)
```diff
@@ -20,6 +20,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/container/batch"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	pb "github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/stretchr/testify/require"
@@ -44,3 +45,66 @@ func TestDecimal256HighScaleMultiplicationPublicPath(t *testing.T) {
 	require.False(t, result.IsNull(0))
 	require.Equal(t, types.Decimal256{}, vector.GetFixedAtWithTypeCheck[types.Decimal256](result, 0))
 }
+
+// Scan vectors prevent constant folding from bypassing the batch arithmetic owner.
+func TestDecimal256ScaleAlignmentPublicPath(t *testing.T) {
+	for _, tc := range []struct {
+		name, sql                    string
+		scale, leftScale, rightScale int32
+		want                         []types.Decimal256
+	}{
+		{"add_38_left", "select cast(n_nationkey as decimal(20,0)) + cast('3e-38' as decimal(65,38)) from nation", 38, 0, 38, []types.Decimal256{{B0_63: 0x98a224000000003, B64_127: 0x4b3b4ca85a86c47a}, {B0_63: 0x1314448000000003, B64_127: 0x96769950b50d88f4}}},
+		{"add_38_right", "select cast('3e-38' as decimal(65,38)) + cast(n_nationkey as decimal(20,0)) from nation", 38, 38, 0, []types.Decimal256{{B0_63: 0x98a224000000003, B64_127: 0x4b3b4ca85a86c47a}, {B0_63: 0x1314448000000003, B64_127: 0x96769950b50d88f4}}},
+		{"sub_38_left", "select cast(n_nationkey as decimal(20,0)) - cast('3e-38' as decimal(65,38)) from nation", 38, 0, 38, []types.Decimal256{{B0_63: 0x98a223ffffffffd, B64_127: 0x4b3b4ca85a86c47a}, {B0_63: 0x1314447ffffffffd, B64_127: 0x96769950b50d88f4}}},
+		{"sub_38_right", "select cast('3e-38' as decimal(65,38)) - cast(n_nationkey as decimal(20,0)) from nation", 38, 38, 0, []types.Decimal256{{B0_63: 0xf675ddc000000003, B64_127: 0xb4c4b357a5793b85, B128_191: 0xffffffffffffffff, B192_255: 0xffffffffffffffff}, {B0_63: 0xecebbb8000000003, B64_127: 0x698966af4af2770b, B128_191: 0xffffffffffffffff, B192_255: 0xffffffffffffffff}}},
+		{"mod_38_left", "select cast(n_nationkey as decimal(20,0)) % cast('3e-38' as decimal(65,38)) from nation", 38, 0, 38, []types.Decimal256{{B0_63: 0x1}, {B0_63: 0x2}}},
+		{"mod_38_right", "select cast('3e-38' as decimal(65,38)) % cast(n_nationkey as decimal(20,0)) from nation", 38, 38, 0, []types.Decimal256{{B0_63: 0x3}, {B0_63: 0x3}}},
+		{"add_39_left", "select cast(n_nationkey as decimal(20,0)) + cast('3e-39' as decimal(65,39)) from nation", 39, 0, 39, []types.Decimal256{{B0_63: 0x5f65568000000003, B64_127: 0xf050fe938943acc4, B128_191: 0x2}, {B0_63: 0xbecaad0000000003, B64_127: 0xe0a1fd2712875988, B128_191: 0x5}}},
+		{"add_39_right", "select cast('3e-39' as decimal(65,39)) + cast(n_nationkey as decimal(20,0)) from nation", 39, 39, 0, []types.Decimal256{{B0_63: 0x5f65568000000003, B64_127: 0xf050fe938943acc4, B128_191: 0x2}, {B0_63: 0xbecaad0000000003, B64_127: 0xe0a1fd2712875988, B128_191: 0x5}}},
+		{"sub_39_left", "select cast(n_nationkey as decimal(20,0)) - cast('3e-39' as decimal(65,39)) from nation", 39, 0, 39, []types.Decimal256{{B0_63: 0x5f65567ffffffffd, B64_127: 0xf050fe938943acc4, B128_191: 0x2}, {B0_63: 0xbecaacfffffffffd, B64_127: 0xe0a1fd2712875988, B128_191: 0x5}}},
+		{"sub_39_right", "select cast('3e-39' as decimal(65,39)) - cast(n_nationkey as decimal(20,0)) from nation", 39, 39, 0, []types.Decimal256{{B0_63: 0xa09aa98000000003, B64_127: 0xfaf016c76bc533b, B128_191: 0xfffffffffffffffd, B192_255: 0xffffffffffffffff}, {B0_63: 0x4135530000000003, B64_127: 0x1f5e02d8ed78a677, B128_191: 0xfffffffffffffffa, B192_255: 0xffffffffffffffff}}},
+		{"mod_39_left", "select cast(n_nationkey as decimal(20,0)) % cast('3e-39' as decimal(65,39)) from nation", 39, 0, 39, []types.Decimal256{{B0_63: 0x1}, {B0_63: 0x2}}},
+		{"mod_39_right", "select cast('3e-39' as decimal(65,39)) % cast(n_nationkey as decimal(20,0)) from nation", 39, 39, 0, []types.Decimal256{{B0_63: 0x3}, {B0_63: 0x3}}},
+		{"mod_high_bits", "select cast((cast(n_nationkey as decimal(20,0)) * cast('2000000000000000000' as decimal(20,0))) as decimal(65,0)) % cast('85070591730234615865843651857942052864e-58' as decimal(65,58)) from nation", 58, 0, 58, []types.Decimal256{{B64_127: 0x2eeb4be2e32a2000}, {B64_127: 0x1dd697c5c6544000}}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			stmt, err := runOneExprStmt(NewMockOptimizer(false), t, tc.sql)
+			require.NoError(t, err)
+			var expr *pb.Expr
+			for _, node := range stmt.GetQuery().Nodes {
+				if node.NodeType == pb.Node_PROJECT {
+					require.Len(t, node.ProjectList, 1)
+					expr = node.ProjectList[0]
+				}
+			}
+			require.NotNil(t, expr)
+			require.Equal(t, int32(types.T_decimal256), expr.Typ.Id)
+			require.Equal(t, tc.scale, expr.Typ.Scale)
+			args := expr.GetF().Args
+			require.Len(t, args, 2)
+			require.Equal(t, tc.leftScale, args[0].Typ.Scale)
+			require.Equal(t, tc.rightScale, args[1].Typ.Scale)
+			proc := testutil.Ne
```

**File**: `pkg/sql/plan/function/arith_decimal_fast.go` (modified, +68/-114)
```diff
@@ -22,7 +22,7 @@ package function
 // Layout:
 //   - Multiply:    d64Mul, d128Mul, d256Mul
 //   - Add/Sub:     d64Add/d64Sub, d128Add/d128Sub, d256Add/d256Sub
-//   - Division:    d64Div, d128Div, d256Div
+//   - Division:    d64DivAtScale, d128DivAtScale, d256DivAtScale
 //   - Modulo:      d64Mod, d128Mod, d256Mod
 //   - Integer Div: d64IntDiv, d128IntDiv, d256IntDiv (DIV operator)
 
@@ -427,7 +427,7 @@ func d128SubDiffScale(v1, v2, rs []types.Decimal128, scale1, scale2 int32, rsnul
 	return d128SubSameScale(v1, rs[:len2], rs, rsnull), nil
 }
 
-// scalePow10Factors returns pre-computed pow10 factors for scaling by 10^n.
+// scalePow10Factors returns pre-computed factors for 10^n, with 0 <= n <= 38.
 // For n ≤ 19: returns (Pow10[n], false, 0). For n > 19: returns (Pow10[19], true, Pow10[n-19]).
 func scalePow10Factors(n int32) (pow10a uint64, twoStep bool, pow10b uint64) {
 	if n > 19 {
@@ -742,39 +742,16 @@ func d128MulInline(x, y, dst *types.Decimal128, scaleAdj, scale1, scale2 int32)
 
 // ---- Decimal128 division ----
 
-// d128DivKernel returns a batch division kernel for Decimal128 inputs.
+// d128DivKernelAtScale returns a batch division kernel for Decimal128 inputs.
 // The shouldError flag controls division-by-zero behavior:
 //   - false: mark result as NULL (SQL standard / MySQL default)
 //   - true: return error (strict mode)
-func d128DivKernel(shouldError bool) func(v1, v2 []types.Decimal128, rs []types.Decimal128, scale1, scale2 int32, rsnull *nulls.Nulls) error {
-	return func(v1, v2 []types.Decimal128, rs []types.Decimal128, scale1, scale2 int32, rsnull *nulls.Nulls) error {
-		return d128Div(v1, v2, rs, scale1, scale2, rsnull, shouldError)
-	}
-}
-
 func d128DivKernelAtScale(shouldError bool, resultScale int32) func(v1, v2 []types.Decimal128, rs []types.Decimal128, scale1, scale2 int32, rsnull *nulls.Nulls) error {
 	return func(v1, v2 []types.Decimal128, rs []types.Decimal128, scale1, scale2 int32, rsnull *nulls.Nulls) error {
 		return d128DivAtScale(v1, v2, rs, scale1, scale2, resultScale, rsnull, shouldError)
 	}
 }
 
-// d64DivKernel returns a batch division kernel for Decimal64 → Decimal128.
-
-func d128Div(v1, v2 []types.Decimal128, rs []types.Decimal128, scale1, scale2 int32, rsnull *nulls.Nulls, shouldError bool) error {
-	return d128DivAtScale(v1, v2, rs, scale1, scale2, legacyDecimalDivisionScale(scale1), rsnull, shouldError)
-}
-
-func legacyDecimalDivisionScale(scale1 int32) int32 {
-	scale := int32(12)
-	if scale > scale1+6 {
-		scale = scale1 + 6
-	}
-	if scale < scale1 {
-		scale = scale1
-	}
-	return scale
-}
-
 func d128DivAtScale(v1, v2 []types.Decimal128, rs []types.Decimal128, scale1, scale2, resultScale int32, rsnull *nulls.Nulls, shouldError bool) error {
 	bmp := rsnull.GetBitmap()
 	scaleAdj := resultScale - scale1 + scale2
@@ -2021,13 +1998,30 @@ func d256ScaleUp(x *types.Decimal256, n int32) bool {
 	return ok
 }
 
-// d256ScaleUpPow10 scales a signed D256 by pre-computed pow10 factor(s).
-// Eliminates d256ScaleUp→d256MulPow10 wrapper chain; d256Abs/d256Negate inline.
-func d256ScaleUpPow10(x *types.Decimal256, pow10a uint64, twoStep bool, pow10b uint64) bool {
+// d256ScaleUpFactors prepares checked D256 scaling for a non-negative exponent.
+// Up to 38 digits use precomputed factors; larger exponents reuse chunked scaling.
+func d256ScaleUpFactors(n int32) (pow10a uint64, remaining int32, pow10b uint64) {
+	if n <= 19 {
+		return types.Pow10[n], 0, 0
+	}
+	remaining = n - 19
+	if remaining <= 19 {
+		pow10b = types.Pow10[remaining]
+	}
+	return types.Pow10[19], remaining, pow10b
+}
+
+// d256ScaleUpPow10 scales a signed D256 using d256ScaleUpFactors' preparation.
+// Returns false on overflow; callers retain the original coefficient for errors.
+func d256ScaleUpPow10(x *types.Decimal256, pow10a uint64, remaining int32, pow10b uint64) bool {
 	sign := d256Abs(x)
 	ok := d256Mul1Limb(x, pow10a)
-	if ok && twoStep {
-		ok = d256Mul1Limb(x, pow10b)
+	if ok && remaining != 0 {
+		if remaining <= 19 {
+			ok = d256Mul1Limb(x, pow10b)
+		} else {
+			ok = d256MulPow10(x, remaining)
+		}
 	}
 	d256Negate(x, sign)
 	return ok
@@ -2335,8 +2329,8 @@ func d256AddDiffScale(v1, v2, rs []types.Decimal256, scale1, scale2 int32, rsnul
 		a := v1[0]
 		signA := a.B192_255 >> 63
 		scaleDiff := scale1 - scale2
-		pow10a, twoStep, pow10b := scalePow10Factors(scaleDiff)
-		if !twoStep && d256AllFitInt64(v2, len2) {
+		pow10a, remaining, pow10b := d256ScaleUpFactors(scaleDiff)
+		if remaining == 0 && d256AllFitInt64(v2, len2) {
 			for i := 0; i < len2; i++ {
 				if hasNull && bmp.Contains(uint64(i)) {
 					continue
@@ -2364,7 +2358,7 @@ func d256AddDiffScale(v1, v2, rs []types.Decimal256, scale1, scale2 int32, rsnul
 				continue
 			}
 			b := v2[i]
-			if !d256ScaleUpPow10(&b, pow10a, twoStep, pow10b) {
+			if !d256ScaleUpPow10(&b, pow10a, remaining, pow10b) {
 				return -1, moerr.NewInvalidInputNoCtxf("Decimal256 scale overflow: %s", v2[i].Format(0))
 			}
 			signB 
```

**File**: `pkg/sql/plan/function/arithmetic_comprehensive_test.go` (modified, +5/-179)
```diff
@@ -19,7 +19,6 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/container/nulls"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
-	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/stretchr/testify/require"
 )
@@ -28,6 +27,7 @@ import (
 // This test catches the bug where decimal + 0.00 incorrectly returns NULL
 func Test_PlusFn_DecimalZero(t *testing.T) {
 	proc := testutil.NewProcess(t)
+	defer proc.Free()
 
 	// Test decimal64 + zero - use simple values
 	{
@@ -69,6 +69,7 @@ func Test_PlusFn_DecimalZero(t *testing.T) {
 // Test_MinusFn_DecimalZero tests decimal subtraction with zero values
 func Test_MinusFn_DecimalZero(t *testing.T) {
 	proc := testutil.NewProcess(t)
+	defer proc.Free()
 
 	// Test decimal64 - zero
 	{
@@ -107,6 +108,7 @@ func Test_Decimal128ScaleOverflow(t *testing.T) {
 // Test_DivFn_DecimalZero tests that division by zero still returns NULL
 func Test_DivFn_DecimalZero(t *testing.T) {
 	proc := testutil.NewProcess(t)
+	defer proc.Free()
 
 	// Test decimal64 / zero should return NULL
 	{
@@ -134,6 +136,7 @@ func Test_DivFn_DecimalZero(t *testing.T) {
 // This fixes the bug where multiplication by zero incorrectly returned null
 func Test_Decimal64_Multiply_Zero(t *testing.T) {
 	proc := testutil.NewProcess(t)
+	defer proc.Free()
 
 	// Test: decimal64 * 0 should return 0, not null
 	{
@@ -202,6 +205,7 @@ func Test_Decimal64_Multiply_Zero(t *testing.T) {
 // This fixes the bug where CASE returning decimal + float returned null
 func Test_Decimal_Plus_Float(t *testing.T) {
 	proc := testutil.NewProcess(t)
+	defer proc.Free()
 
 	// Test: decimal64 + float64 with original types (before type conversion)
 	{
@@ -251,181 +255,3 @@ func Test_Decimal_Plus_Float(t *testing.T) {
 		require.True(t, succeed, tc.info, info)
 	}
 }
-
-// TestDecimal128AddBug tests decimal128 addition with zero values
-func TestDecimal128AddBug(t *testing.T) {
-	// Test case for the bug: 0.01 + 0.00 should return 0.01, not NULL
-
-	// Create 0.01 (scale 2)
-	d1, err := types.Decimal128FromFloat64(0.01, 38, 2)
-	if err != nil {
-		t.Fatalf("Failed to create 0.01: %v", err)
-	}
-
-	// Create 0.00 (scale 2)
-	d2, err := types.Decimal128FromFloat64(0.00, 38, 2)
-	if err != nil {
-		t.Fatalf("Failed to create 0.00: %v", err)
-	}
-
-	// Test 0.01 + 0.00
-	result1, scale1, err1 := d1.Add(d2, 2, 2)
-	if err1 != nil {
-		t.Errorf("0.01 + 0.00 failed with error: %v", err1)
-	}
-	if scale1 != 2 {
-		t.Errorf("Expected scale 2, got %d", scale1)
-	}
-	expected1, _ := types.Decimal128FromFloat64(0.01, 38, 2)
-	if result1 != expected1 {
-		t.Errorf("0.01 + 0.00: expected %v, got %v", expected1, result1)
-	}
-
-	// Test 0.00 + 0.01 (should also work)
-	result2, scale2, err2 := d2.Add(d1, 2, 2)
-	if err2 != nil {
-		t.Errorf("0.00 + 0.01 failed with error: %v", err2)
-	}
-	if scale2 != 2 {
-		t.Errorf("Expected scale 2, got %d", scale2)
-	}
-	expected2, _ := types.Decimal128FromFloat64(0.01, 38, 2)
-	if result2 != expected2 {
-		t.Errorf("0.00 + 0.01: expected %v, got %v", expected2, result2)
-	}
-
-	// Test with different scales: 0.1 (scale 1) + 0.00 (scale 2)
-	d3, _ := types.Decimal128FromFloat64(0.1, 38, 1)
-	d4, _ := types.Decimal128FromFloat64(0.00, 38, 2)
-
-	result3, scale3, err3 := d3.Add(d4, 1, 2)
-	if err3 != nil {
-		t.Errorf("0.1 + 0.00 failed with error: %v", err3)
-	}
-	if scale3 != 2 {
-		t.Errorf("Expected scale 2, got %d", scale3)
-	}
-	expected3, _ := types.Decimal128FromFloat64(0.10, 38, 2)
-	if result3 != expected3 {
-		t.Errorf("0.1 + 0.00: expected %v, got %v", expected3, result3)
-	}
-}
-
-// TestDecimal128SubBug tests decimal128 subtraction with zero values
-func TestDecimal128SubBug(t *testing.T) {
-	// Test subtraction with the same bug pattern
-
-	// Create 0.01 (scale 2)
-	d1, err := types.Decimal128FromFloat64(0.01, 38, 2)
-	if err != nil {
-		t.Fatalf("Failed to create 0.01: %v", err)
-	}
-
-	// Create 0.00 (scale 2)
-	d2, err := types.Decimal128FromFloat64(0.00, 38, 2)
-	if err != nil {
-		t.Fatalf("Failed to create 0.00: %v", err)
-	}
-
-	// Test 0.01 - 0.00
-	result1, scale1, err1 := d1.Sub(d2, 2, 2)
-	if err1 != nil {
-		t.Errorf("0.01 - 0.00 failed with error: %v", err1)
-	}
-	if scale1 != 2 {
-		t.Errorf("Expected scale 2, got %d", scale1)
-	}
-	expected1, _ := types.Decimal128FromFloat64(0.01, 38, 2)
-	if result1 != expected1 {
-		t.Errorf("0.01 - 0.00: expected %v, got %v", expected1, result1)
-	}
-}
-
-// TestCaseWhenStringComparison tests string comparison in CASE WHEN expressions
-func TestCaseWhenStringComparison(t *testing.T) {
-	// Test: CASE "two" when "one" then 1.00 WHEN "two" then 2.00 END
-	proc := testutil.NewProc(t)
-
-	// Create condition vectors: "two" = "one" and "two" = "two"
-	cond1 := testutil.MakeVarcharVector([]string{"two"}, nil, proc.Mp())
-	val1 := testutil.MakeVarcharVector([]string{"one"}, nil, proc.Mp())
-
-	cond2 := testutil.MakeVarcharVector([]string{"two"}, nil, proc.Mp())
-	va
```

**File**: `pkg/sql/plan/function/arithmetic_float_overflow_test.go` (modified, +10/-15)
```diff
@@ -23,7 +23,6 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
-	"github.com/matrixorigin/matrixone/pkg/vm/process"
 	"github.com/stretchr/testify/require"
 )
 
@@ -105,24 +104,20 @@ func TestDecimalArithmeticErrorMapping(t *testing.T) {
 
 	decimalType := types.T_decimal128.ToType()
 	decimalType.Width = 38
-	inputs := []*vector.Vector{
-		mustNewConstFixed(t, decimalType, types.Decimal128{B0_63: math.MaxUint64, B64_127: math.MaxInt64}, proc),
-		mustNewConstFixed(t, decimalType, types.Decimal128{B0_63: 1}, proc),
-	}
-	defer inputs[0].Free(proc.Mp())
-	defer inputs[1].Free(proc.Mp())
+	baseline := [2]int64{proc.Mp().CurrNB(), proc.Mp().OnHeapCurrNB()}
+	defer func() { require.Equal(t, baseline, [2]int64{proc.Mp().CurrNB(), proc.Mp().OnHeapCurrNB()}) }()
+	left, err := vector.NewConstFixed(decimalType, types.Decimal128{B0_63: math.MaxUint64, B64_127: math.MaxInt64}, 1, proc.Mp())
+	require.NoError(t, err)
+	defer left.Free(proc.Mp())
+	right, err := vector.NewConstFixed(decimalType, types.Decimal128{B0_63: 1}, 1, proc.Mp())
+	require.NoError(t, err)
+	defer right.Free(proc.Mp())
+	inputs := []*vector.Vector{left, right}
 	result := vector.NewFunctionResultWrapper(decimalType, proc.Mp())
 	defer result.Free()
 	require.NoError(t, result.PreExtendAndReset(1))
 
-	err := decimalBatchArith[types.Decimal128, types.Decimal128](inputs, result, proc, 1, d128Add, nil)
+	err = decimalBatchArith[types.Decimal128, types.Decimal128](inputs, result, proc, 1, d128Add, nil)
 	require.Error(t, err)
 	require.True(t, moerr.IsMoErrCode(err, moerr.ErrOutOfRange))
 }
-
-func mustNewConstFixed[T any](t *testing.T, typ types.Type, value T, proc *process.Process) *vector.Vector {
-	t.Helper()
-	vec, err := vector.NewConstFixed(typ, value, 1, proc.Mp())
-	require.NoError(t, err)
-	return vec
-}
```

---

### Incident Patch 11: `c2a9692b` (2026-10-04)
**Commit Message**: fix(sql): preserve CAST target metadata during filter folding (#29613)

`HEX(BIT column)` binds a private integer-argument CAST with an `Expr_T` target descriptor. `ReplaceFoldExpr` treats that descriptor as a foldable scalar when the source column cannot fold, replaces it with `Expr_Fold`, and makes the otherwise valid scan filter fail remote expression validation with `invalid private integer parameter CAST target marker`.

Preserve structural target descriptors in the partial-child folding loop. Whole constant CASTs and ordinary predicate constants still fold. This is a six-line production change at the shared folding owner, not a HEX-specific workaround. It does not relax remote validation or change CAST kernels, wire versions, storage, or scheduling.

### Regression tests

- Real public HEX binding for BIT(8), BIT(64) maximum, BOOL, and ordinary CAST controls; preserve metadata and verify values/NULLs.
- Whole constant CAST folding remains enabled.
- Real scan-filter preparation, remote scope serialization, receiver validation, and decoding.
- Every existing private integer CAST overload retains its descriptor; malformed folded descriptors remain rejected, with existing protoc

**File**: `pkg/sql/compile/integer_argument_protocol_test.go` (modified, +19/-0)
```diff
@@ -24,6 +24,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/defines"
 	"github.com/matrixorigin/matrixone/pkg/pb/pipeline"
 	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
 	"github.com/matrixorigin/matrixone/pkg/sql/colexec/projection"
 	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
 	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
@@ -56,6 +57,17 @@ func TestIntegerArgumentProtocolBoundaries(t *testing.T) {
 	for id := int32(0); id <= function.TemporalIntegerArgumentCastOverload; id++ {
 		t.Run(fmt.Sprint(id), func(t *testing.T) {
 			expr := integerProtocolExpr(id)
+			var executors []colexec.ExpressionExecutor
+			t.Cleanup(func() {
+				for _, executor := range executors {
+					executor.Free()
+				}
+			})
+			canFold, err := plan2.ReplaceFoldExpr(c.proc, expr, &executors)
+			require.NoError(t, err)
+			require.False(t, canFold, "a column-dependent CAST cannot fold as a whole")
+			require.NotNil(t, expr.GetF().Args[1].GetT(), "scan folding must preserve every CAST target")
+			require.Empty(t, executors, "a type marker must not acquire an executor")
 			p := &pipeline.Pipeline{InstructionList: []*pipeline.Instruction{{ProjectList: []*planpb.Expr{expr}}}}
 			features, err := planpb.RequiredRemoteExpressionFeatures(p)
 			require.NoError(t, err)
@@ -130,6 +142,13 @@ func TestIntegerArgumentReceiverRejectsInvalidSignatures(t *testing.T) {
 			},
 			want: "target marker",
 		},
+		{
+			name: "folded target marker",
+			mutate: func(expr *planpb.Expr) {
+				expr.GetF().Args[1].Expr = &planpb.Expr_Fold{Fold: &planpb.FoldVal{IsConst: true}}
+			},
+			want: "target marker",
+		},
 		{
 			name: "target type",
 			mutate: func(expr *planpb.Expr) {
```

**File**: `pkg/sql/compile/prepared_filter_fold_test.go` (modified, +57/-0)
```diff
@@ -21,17 +21,74 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/pipeline"
 	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec/value_scan"
 	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine"
 	"github.com/stretchr/testify/require"
 )
 
 type filterFoldWarningCounter struct{ count int }
 
 func (c *filterFoldWarningCounter) AppendWarningDiagnostic(uint16, string) { c.count++ }
 
+func TestFoldedHexBitFilterRemoteRoundTrip(t *testing.T) {
+	c, client := expressionProtocolTestCompile(t)
+	t.Cleanup(c.proc.Free)
+	client.version = defines.MORPCLatestVersion
+	column := &planpb.Expr{
+		Typ:  planpb.Type{Id: int32(types.T_bit), Width: 8},
+		Expr: &planpb.Expr_Col{Col: &planpb.ColRef{Name: "v"}},
+	}
+	hex, err := plan2.BindFuncExprImplByPlanExpr(c.proc.Ctx, "hex", []*planpb.Expr{column})
+	require.NoError(t, err)
+	filter, err := plan2.BindFuncExprImplByPlanExpr(c.proc.Ctx, "=", []*planpb.Expr{
+		hex, plan2.MakePlan2StringConstExprWithType("AA"),
+	})
+	require.NoError(t, err)
+	_, err = planpb.RequiredRemoteExpressionFeatures(filter)
+	require.NoError(t, err, "the public binder must produce a valid expression")
+
+	var executors []colexec.ExpressionExecutor
+	t.Cleanup(func() {
+		for _, executor := range executors {
+			executor.Free()
+		}
+	})
+	folded, nextExecutors, rebuilt, err := prepareFoldedFilterExprs(
+		c.proc, []*planpb.Expr{filter}, nil, executors, true)
+	executors = nextExecutors
+	require.NoError(t, err)
+	require.True(t, rebuilt)
+	require.False(t, plan2.HasFoldValExpr(filter), "the logical filter must stay unchanged")
+	require.NotNil(t, folded[0].GetF().Args[1].GetFold(), "runtime constants still fold")
+
+	op := value_scan.NewArgument()
+	t.Cleanup(op.Release)
+	scope := &Scope{
+		Magic: Remote, Proc: c.proc, RootOp: op,
+		NodeInfo: engine.Node{Id: "old-worker", Addr: "remote:6001"},
+		DataSource: &Source{
+			node:       &planpb.Node{FilterList: []*planpb.Expr{filter}},
+			FilterExpr: folded[0],
+		},
+	}
+	data, err := encodeRemoteScope(scope, c.proc)
+	require.NoError(t, err, "scan folding must not invalidate private CAST metadata")
+	remote := new(pipeline.Pipeline)
+	require.NoError(t, remote.Unmarshal(data))
+	require.NoError(t, validateRemoteExpressionPipelineProtocol(c.proc, remote))
+	remoteHex := remote.DataSource.Expr.GetF().Args[0].GetF()
+	require.NotNil(t, remoteHex.Args[0].GetF().Args[1].GetT())
+	decoded, err := decodeScope(data, c.proc, true, nil)
+	require.NoError(t, err)
+	t.Cleanup(decoded.release)
+}
+
 func TestDiagnosticFilterClassificationExcludesStorageCopy(t *testing.T) {
 	proc := testutil.NewProcess(t)
 	t.Cleanup(func() { proc.Free() })
```

**File**: `pkg/sql/plan/fold_target_type_test.go` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
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
+package plan
+
+import (
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
+	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/stretchr/testify/require"
+)
+
+func TestReplaceFoldExprPreservesCastTargetMetadata(t *testing.T) {
+	for _, tc := range []struct {
+		name     string
+		source   types.Type
+		value    uint64
+		wantHex  string
+		ordinary bool
+	}{
+		{name: "hex BIT8 unsigned", source: types.New(types.T_bit, 8, 0), value: 170, wantHex: "AA"},
+		{name: "hex BIT64 upper boundary", source: types.New(types.T_bit, 64, 0), value: ^uint64(0), wantHex: "FFFFFFFFFFFFFFFF"},
+		{name: "hex BOOL signed", source: types.T_bool.ToType(), wantHex: "1"},
+		{name: "ordinary CAST column", source: types.New(types.T_bit, 8, 0), value: 170, ordinary: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			proc := testutil.NewProcess(t)
+			t.Cleanup(proc.Free)
+			column := &planpb.Expr{
+				Typ: makePlan2Type(&tc.source),
+				Expr: &planpb.Expr_Col{Col: &planpb.ColRef{
+					Name: "v", ColPos: 0,
+				}},
+			}
+			var left, cast, right *planpb.Expr
+			var err error
+			if tc.ordinary {
+				target := types.T_uint64.ToType()
+				left, err = BindFuncExprImplByPlanExpr(t.Context(), "cast", []*planpb.Expr{
+					column,
+					{Typ: makePlan2Type(&target), Expr: &planpb.Expr_T{T: &planpb.TargetType{}}},
+				})
+				require.NoError(t, err)
+				cast = left
+				right = makePlan2Uint64ConstExprWithType(tc.value)
+			} else {
+				left, err = BindFuncExprImplByPlanExpr(t.Context(), "hex", []*planpb.Expr{column})
+				require.NoError(t, err)
+				cast = left.GetF().Args[0]
+				_, overload := function.DecodeOverloadID(cast.GetF().Func.Obj)
+				require.Equal(t, function.IntegerArgumentCastOverload, overload,
+					"the real binder must reach the private integer CAST")
+				right = makePlan2StringConstExprWithType(tc.wantHex)
+			}
+			require.Equal(t, "cast", cast.GetF().Func.ObjName)
+			targetMarker := cast.GetF().Args[1]
+			require.NotNil(t, targetMarker.GetT())
+			filter, err := BindFuncExprImplByPlanExpr(t.Context(), "=", []*planpb.Expr{left, right})
+			require.NoError(t, err)
+			var executors []colexec.ExpressionExecutor
+			t.Cleanup(func() {
+				for _, executor := range executors {
+					executor.Free()
+				}
+			})
+			canFold, err := ReplaceFoldExpr(proc, filter, &executors)
+			require.NoError(t, err)
+			require.False(t, canFold, "a column-dependent predicate is not a constant")
+			require.Same(t, targetMarker, cast.GetF().Args[1],
+				"a CAST type marker is metadata, not an execution-time scalar")
+			require.NotNil(t, cast.GetF().Args[1].GetT())
+			require.NotNil(t, filter.GetF().Args[1].GetFold(),
+				"preserving metadata must not disable ordinary constant folding")
+			require.Len(t, executors, 1, "only the comparison value needs a fold executor")
+			require.NoError(t, EvalFoldExpr(proc, filter, &executors))
+			foldedValue := filter.GetF().Args[1].GetFold()
+			require.True(t, foldedValue.IsConst)
+			if tc.ordinary {
+				require.Len(t, foldedValue.Data, 8)
+				require.Equal(t, tc.value, types.DecodeUint64(foldedValue.Data))
+			} else {
+				require.Equal(t, tc.wantHex, string(foldedValue.Data))
+			}
+
+			input := batch.NewWithSize(1)
+			t.Cleanup(func() { input.Clean(proc.Mp()) })
+			input.Vecs[0] = vector.NewVec(tc.source)
+			if tc.source.Oid == types.T_bool {
+				require.NoError(t, vector.AppendFixedList(input.Vecs[0], []bool{true, false, false}, []bool{false, false, true}, proc.Mp()))
+			} else {
+				require.NoError(t, vector.AppendFixedList(input.Vecs[0], []uint64{tc.value, 0, 0}, []bool{false, false, true}, proc.Mp()))
+			}
+			input.SetRowCount(3)
+			// Fold nodes belong to the storage-filter consumer, not the generic
+			// expression executor. Check their bytes above and independently run
+			// the preserved row-dependent CAST/HEX with ordinary batch evaluation.
+			result, free, err := colexec.GetReadonlyResultFromExpression(proc, left, []*batch.Batch{input})
+			require.NoError(t, err)
+			t.Cleanup(free)
+			if tc.ordinary {
+				requi
```

**File**: `pkg/sql/plan/utils.go` (modified, +6/-0)
```diff
@@ -8531,6 +8531,12 @@ func ReplaceFoldExpr(proc *process.Process, expr *Expr, exes *[]colexec.Expressi
 	} else {
 		for i, canFold := range argFold {
 			if canFold {
+				// CAST target types are structural metadata, not runtime values.
+				// Keep them intact when only some arguments can fold; a wholly
+				// constant CAST remains foldable through the allCanFold path above.
+				if _, isTargetType := fn.Args[i].Expr.(*plan.Expr_T); isTargetType {
+					continue
+				}
 				folded, foldErr := ConstantFold(batch.EmptyForConstFoldBatch, fn.Args[i], proc, false, true)
 				if foldErr != nil {
 					return false, foldErr
```

**File**: `pkg/tests/dml/hex_bit_filter_test.go` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
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
+package dml
+
+import (
+	"context"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/clusterservice"
+	"github.com/matrixorigin/matrixone/pkg/embed"
+	"github.com/matrixorigin/matrixone/pkg/sql/plan"
+	"github.com/matrixorigin/matrixone/pkg/tests/testutils"
+	"github.com/stretchr/testify/require"
+)
+
+// Issue #29405: HEX(BIT) inserts a private CAST target-type marker. Folding a
+// scan predicate must preserve that marker for the remote expression consumer.
+// Reuse the shared two-CN fixture and persist just five rows (six after reuse).
+func TestHexBitFilterRemote(t *testing.T) {
+	var invalidationErr error
+	defer func() {
+		if invalidationErr != nil {
+			t.Errorf("discarding shared fixture: %v", invalidationErr)
+			if err := embed.CloseBaseClusterTests(); err != nil {
+				t.Errorf("close invalid fixture: %v", err)
+			}
+		}
+	}()
+	embed.RunBaseClusterTests(t, func(c embed.Cluster) {
+		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
+		defer cancel()
+		cn, err := c.GetCNService(0)
+		require.NoError(t, err)
+		peer, err := c.GetCNService(1)
+		require.NoError(t, err)
+		cluster := clusterservice.GetMOCluster(cn.ServiceID())
+		inventory, ok := cluster.(cnWorkStateInventory)
+		require.True(t, ok)
+		refresher, ok := cluster.(clusterservice.AuthoritativeRefresher)
+		require.True(t, ok)
+		readinessCtx, cancelReadiness := context.WithTimeout(ctx, 30*time.Second)
+		defer cancelReadiness()
+		readiness, err := waitForCNReadiness(readinessCtx, cnWorkStatePollInterval, inventory, refresher, cn.ServiceID(), peer.ServiceID())
+		cancelReadiness()
+		require.NoError(t, err)
+
+		db := openRetestSQLDB(t, c)
+		defer db.Close()
+		name := strings.ToLower(testutils.GetDatabaseName(t))
+		defer func() {
+			if invalidationErr == nil {
+				cleanupTestDatabases(t, db, name)
+			}
+		}()
+		execSQLDB(t, ctx, db, "create database "+name)
+		execSQLDB(t, ctx, db, "use "+name)
+		execSQLDB(t, ctx, db, "create table bit_probe(v bit(8))")
+		execSQLDB(t, ctx, db, "insert into bit_probe values(170),(187),(null)")
+		func() {
+			execSQLDB(t, ctx, db, "set @bit_value=b'10101010'")
+			execSQLDB(t, ctx, db, "prepare bit_text from 'insert into bit_probe values (?)'")
+			defer func() {
+				cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 30*time.Second)
+				defer cleanupCancel()
+				if _, err := db.ExecContext(cleanupCtx, "deallocate prepare bit_text"); err != nil {
+					t.Errorf("deallocate text prepared insert: %v", err)
+				}
+			}()
+			execSQLDB(t, ctx, db, "execute bit_text using @bit_value")
+		}()
+		insert, err := db.PrepareContext(ctx, "insert into bit_probe values (?)")
+		require.NoError(t, err)
+		defer insert.Close()
+		_, err = insert.ExecContext(ctx, []byte{170})
+		require.NoError(t, err)
+		predicate, err := db.PrepareContext(ctx, "select count(*) from bit_probe where hex(v)=?")
+		require.NoError(t, err)
+		defer predicate.Close()
+
+		for _, want := range []int{3, 4} {
+			if want == 4 {
+				_, err = insert.ExecContext(ctx, 170)
+				require.NoError(t, err)
+			}
+			execSQLDB(t, ctx, db, "select mo_ctl('dn','flush','"+name+".bit_probe')")
+			stateErr := withCNDraining(ctx, inventory, refresher, cn.ServiceID(),
+				[]string{cn.ServiceID(), peer.ServiceID()},
+				func(err error) { invalidationErr = err }, func() {
+					oldForce := plan.GetForceScanOnMultiCN()
+					plan.SetForceScanOnMultiCN(true)
+					defer plan.SetForceScanOnMultiCN(oldForce)
+					const query = "select count(*) from bit_probe where hex(v)='AA'"
+					var count int
+					require.NoError(t, db.QueryRowContext(ctx, query).Scan(&count))
+					require.Equal(t, want, count, "text, binary byte, and numeric BIT bindings must agree")
+					physical, err := testutils.QueryTextResult(ctx, db, "explain phyplan analyze "+query)
+					require.NoError(t, err)
+					require.NotEmpty(t, readiness.peerAddr)
+					require.Contains(t, physical.Text, readiness.peerAddr, "the predicate must execute through a remote consumer")
+					// Reuse the same prepared statement before and after insertion;
+					// changing the search value must not reuse a folded result.
+					for _, tc := range []struct {
+						value any
+						want  int
+					}{{"AA", want}, {"BB", 1}, {nil, 0}, {"AA", want}} {
+						require.NoError(t, predicate.QueryRowContext(ctx, tc.value).S
```

---

### Incident Patch 12: `21f711a7` (2026-10-04)
**Commit Message**: fix(frontend): preserve SQL source through policy rewrite (#29600)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29597

## What this PR does / why we need it:

SQL provenance was indexed by block-comment position instead of
statement position. A generated policy hint could hide a `save_result`
marker; in multi-statement requests a marker on the second SELECT could
save the unmarked first SELECT instead. Restricted queries returned
correct rows, but result persistence was absent or attached to the wrong
query UUID.

Bind the existing source vector at the computation-wrapper boundary
using the grammar-aligned scheduling fragments. Use the existing
whole-stream lexer when source-tag candidates exist so quoted text,
ordinary comments, compound statements and executable-comment wrappers
retain their real boundaries. Discard blank fragments together with
their source entries. This applies to fresh parsing, cache hits and
SQL-mode staged execution, without another full SQL parse or persistent
state.

Exact tag-text absence is a conservative fast

**File**: `pkg/embed/rewrite_query_result_test.go` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
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
+package embed
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/go-sql-driver/mysql"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestRewritePolicySavedResult(t *testing.T) {
+	RunSingleCNBaseClusterTests(t, func(c Cluster) {
+		cn, err := c.GetCNService(0)
+		require.NoError(t, err)
+		port := cn.GetServiceConfig().CN.Frontend.Port
+		ctx, cancel := context.WithTimeout(t.Context(), 2*time.Minute)
+		defer cancel()
+		adminDB, err := sql.Open("mysql", fmt.Sprintf("dump:111@tcp(127.0.0.1:%d)/", port))
+		require.NoError(t, err)
+		defer adminDB.Close()
+		admin, err := adminDB.Conn(ctx)
+		require.NoError(t, err)
+		defer admin.Close()
+		// Reuse the same names on the same CN: cleanup must work without restart.
+		for round := 0; round < 2; round++ {
+			t.Run(fmt.Sprintf("round_%d", round), func(t *testing.T) {
+				exec := func(query string) {
+					_, err := admin.ExecContext(ctx, query)
+					require.NoError(t, err, query)
+				}
+				cleanup := func(query string) {
+					t.Cleanup(func() {
+						cleanupCtx, done := context.WithTimeout(context.Background(), 10*time.Second)
+						defer done()
+						_, err := admin.ExecContext(cleanupCtx, query)
+						assert.NoError(t, err, query)
+					})
+				}
+				exec("create database rewrite_saved")
+				cleanup("drop database rewrite_saved")
+				exec("create table rewrite_saved.t(id int, secret int)")
+				exec("insert into rewrite_saved.t values (1,10),(2,20)")
+				exec("create role rewrite_saved_reader")
+				cleanup("drop role rewrite_saved_reader")
+				exec("grant connect on account * to rewrite_saved_reader")
+				exec("grant select on table rewrite_saved.t to rewrite_saved_reader")
+				exec("create user rewrite_saved_user identified by '111' default role rewrite_saved_reader")
+				cleanup("drop user rewrite_saved_user")
+				connect := func(t *testing.T) *sql.Conn {
+					db, err := sql.Open("mysql", fmt.Sprintf("rewrite_saved_user:111@tcp(127.0.0.1:%d)/?multiStatements=true", port))
+					require.NoError(t, err)
+					t.Cleanup(func() { assert.NoError(t, db.Close()) })
+					conn, err := db.Conn(ctx)
+					require.NoError(t, err)
+					t.Cleanup(func() { assert.NoError(t, conn.Close()) })
+					_, err = conn.ExecContext(ctx, "set save_query_result=on")
+					require.NoError(t, err)
+					_, err = conn.ExecContext(ctx, "set enable_remap_hint=0")
+					require.NoError(t, err)
+					return conn
+				}
+				readRows := func(t *testing.T, rows *sql.Rows, columns []string, want [][]int) {
+					gotColumns, err := rows.Columns()
+					require.NoError(t, err)
+					require.Equal(t, columns, gotColumns)
+					var got [][]int
+					for rows.Next() {
+						row := make([]int, len(columns))
+						args := make([]any, len(row))
+						for i := range row {
+							args[i] = &row[i]
+						}
+						require.NoError(t, rows.Scan(args...))
+						got = append(got, row)
+					}
+					require.Equal(t, want, got)
+				}
+				read := func(t *testing.T, conn *sql.Conn, query string, columns []string, want [][]int) {
+					rows, err := conn.QueryContext(ctx, query)
+					require.NoError(t, err, query)
+					defer rows.Close()
+					readRows(t, rows, columns, want)
+					require.NoError(t, rows.Err())
+				}
+				var savedID string
+				for i, tc := range []struct {
+					name, rule string
+					columns    []string
+					rows       [][]int
+				}{
+					{"none", "", []string{"id", "secret"}, [][]int{{1, 10}, {2, 20}}},
+					{"row", "select * from rewrite_saved.t where id=1", []string{"id", "secret"}, [][]int{{1, 10}}},
+					{"column", "select id from rewrite_saved.t", []string{"id"}, [][]int{{1}, {2}}},
+					{"combined", "select id from rewrite_saved.t where id=1", []string{"id"}, [][]int{{1}}},
+				} {
+					if i > 1 {
+						exec("alter role rewrite_saved_reader drop rule on table rewrite_saved.t")
+					}
+					if tc.rule != "" {
+						exec(fmt.Sprintf("alter role rewrite_saved_reader add rule %q on table rewrite_saved.t", tc.rule))
+					}
+					t.Run(tc.name, func(t *testing.T) {
+						// Fresh sessions isolate rewrite correctness from policy-cache invalidation.
+						conn := connect(t)
+						markers := []string{"/* save_result */"}
+						if tc.name == "combined" {
+							markers = append(markers, "", "/* cloud_nonuser */", "/* save_result */")
+						}
+						for _, 
```

**File**: `pkg/frontend/mysql_cmd_executor.go` (modified, +59/-25)
```diff
@@ -424,6 +424,7 @@ var RecordParseErrorStatement = func(ctx context.Context, ses *Session, proc *pr
 	}
 	if len(envStmt) > 0 {
 		for i, sql := range envStmt {
+			sqlType = constant.ExternSql
 			if i < len(sqlTypes) {
 				sqlType = sqlTypes[i]
 			}
@@ -2895,6 +2896,8 @@ func doPrepareString(ses *Session, execCtx *ExecCtx, st *tree.PrepareString) (*P
 }
 
 func doPrepareStringInSession(owner *Session, executionSes FeSession, execCtx *ExecCtx, st *tree.PrepareString) (*PrepareStmt, error) {
+	nonuser := executionSes.GetStmtProfile().GetSqlSourceType() == constant.CloudNoUserSql ||
+		statementSQLSource(st.Sql, sessionSQLModeForParser(owner)) == constant.CloudNoUserSql
 	rewritten, innerStmt, remapDb, err := prepareStringStatement(execCtx, owner, st.Sql)
 	if err != nil {
 		return nil, err
@@ -2914,6 +2917,7 @@ func doPrepareStringInSession(owner *Session, executionSes FeSession, execCtx *E
 		innerStmt.Free()
 		return nil, err
 	}
+	prepareStmt.IsCloudNonuser = nonuser
 
 	if err = owner.SetPrepareStmt(execCtx.reqCtx, prepareStmt.Name, prepareStmt); err != nil {
 		prepareStmt.Close()
@@ -2994,6 +2998,9 @@ func createPrepareStmtInSession(
 	originSQL string,
 	stmt tree.Statement,
 	saveStmt tree.Statement) (*PrepareStmt, error) {
+	// Nested planning may change the session's current statement. Capture the
+	// owner statement now; neighboring statements in the request are irrelevant.
+	nonuser := executionSes.GetStmtProfile().GetSqlSourceType() == constant.CloudNoUserSql
 	// A preceding statement may have run nested/background SQL and left the
 	// compiler context pointing at a temporary ExecCtx that has already been
 	// closed. PREPARE plans synchronously against the current request context.
@@ -3125,10 +3132,7 @@ func createPrepareStmtInSession(
 			logutil.Errorf("Error make column def data for prepare statement: %v", err)
 		}
 	}
-	if execCtx.input != nil {
-		sqlSourceTypes := execCtx.input.getSqlSourceTypes()
-		prepareStmt.IsCloudNonuser = slices.Contains(sqlSourceTypes, constant.CloudNoUserSql)
-	}
+	prepareStmt.IsCloudNonuser = nonuser
 	prepareStmt.Ts = prepareTs
 	return prepareStmt, nil
 }
@@ -4382,12 +4386,14 @@ var GetComputationWrapper = func(execCtx *ExecCtx, db string, user string, eng e
 		execCtx.rewriteEnabled = ses.rewriteEnabled.Load()
 	}
 	parserSQLMode := sessionSQLModeForParser(ses)
+	internalSource := execCtx.input.isInternalSQLSource(ses)
 	// Reset the per-statement database remap; it is (re)populated below only when
 	// the rewrite feature is enabled and a remapdb is configured.
 	execCtx.remapDb = nil
 	var cws []ComputationWrapper = nil
 	var statementRemaps []map[string]string
 	if preparePlan := execCtx.input.getPreparePlan(); preparePlan != nil {
+		execCtx.input.genSqlSourceType(ses)
 		tcw := InitTxnComputationWrapper(ses, execCtx.input.stmt, proc)
 		tcw.plan = preparePlan.GetDcl().GetPrepare().Plan
 		tcw.binaryPrepare = execCtx.input.isBinaryProtExecute
@@ -4402,12 +4408,12 @@ var GetComputationWrapper = func(execCtx *ExecCtx, db string, user string, eng e
 		return cws, nil
 	} else if cached := cachedPlanForInput(ses, execCtx.input); cached != nil {
 		var remapErr error
-		statementSchedulingSQL, schedulingErr := schedulingSQLByStatementWithSQLMode(
-			execCtx.reqCtx, execCtx.input.getSql(), parserSQLMode)
+		statementSchedulingSQL, sources, schedulingErr := schedulingSQLByStatementWithSQLMode(
+			execCtx.reqCtx, execCtx.input.getSql(), parserSQLMode, internalSource)
 		if schedulingErr != nil {
 			return nil, schedulingErr
 		}
-		if len(statementSchedulingSQL) != len(cached.stmts) {
+		if len(statementSchedulingSQL) != len(cached.stmts) || len(sources) != len(cached.stmts) {
 			return nil, moerr.NewInternalError(execCtx.reqCtx, "the count of scheduling policies is not equal to cached statements")
 		}
 		statementRemaps, remapErr = extractRemapDbByStatementWithSQLMode(execCtx.reqCtx, execCtx.input.getSql(), parserSQLMode)
@@ -4417,6 +4423,7 @@ var GetComputationWrapper = func(execCtx *ExecCtx, db string, user string, eng e
 		if len(statementRemaps) != len(cached.stmts) {
 			return nil, moerr.NewInternalError(execCtx.reqCtx, "the count of remapdb policies is not equal to cached statements")
 		}
+		execCtx.input.setSqlSourceTypes(ses, sources)
 		for i, stmt := range cached.stmts {
 			tcw := InitTxnComputationWrapper(ses, stmt, proc)
 			// The cache owns its ASTs until eviction. Wrappers only borrow them;
@@ -4547,18 +4554,25 @@ var GetComputationWrapper = func(execCtx *ExecCtx, db string, user string, eng e
 	}
 
 	var statementSchedulingSQL []string
+	var sources []string
 	if execCtx.input.getStmt() != nil {
 		statementSchedulingSQL = []string{execCtx.input.getSql()}
+		source := constant.InternalSql
+		if !internalSource {
+			source = statementSQLSource(execCtx.input.getSql(), parserSQLMode)
+		}
+		sources = []string{source}
 	} else {
-		statementSchedulingSQL, err = schedulingSQLByStatementWithSQLMode(
-			execCtx.reqCtx, execCtx.input
```

**File**: `pkg/frontend/mysql_cmd_executor_test.go` (modified, +172/-18)
```diff
@@ -3932,6 +3932,14 @@ func TestGetComputationWrapperKeepsSchedulingSQLPerStatement(t *testing.T) {
 	require.NotContains(t, first, "query_pool_strict")
 	require.Contains(t, second, "query_pool_strict=on")
 	require.NotContains(t, second, "query_max_workers")
+	require.Equal(t, []string{constant.ExternSql, constant.ExternSql}, execCtx.input.sqlSourceType)
+	execCtx.input.isInternalInput = true
+	internalWrappers, err := GetComputationWrapper(execCtx, "", "root", nil, proc, ses)
+	require.NoError(t, err)
+	for _, cw := range internalWrappers {
+		cw.Free()
+	}
+	require.Equal(t, []string{constant.InternalSql, constant.InternalSql}, execCtx.input.sqlSourceType)
 }
 
 func TestGetComputationWrapperKeepsExecutableCommentStatementWhole(t *testing.T) {
@@ -4152,12 +4160,13 @@ func TestExecRequestStmtPreparePreservesMandatoryRewritePolicy(t *testing.T) {
 			execCtx.ses = ses
 			resp, err := ExecRequest(ses, execCtx, &Request{
 				cmd:  COM_STMT_PREPARE,
-				data: []byte(tt.sql),
+				data: []byte(tt.sql + " /* cloud_nonuser */"),
 			})
 			require.NoError(t, err)
 			require.NotNil(t, resp)
 			require.Equal(t, ErrorResponse, resp.category)
 			require.NotNil(t, observedInput)
+			require.Equal(t, []string{constant.CloudNoUserSql}, observedInput.sqlSourceType)
 			require.NotNil(t, observedInput.rewritePolicy)
 			require.True(t, observedInput.rewritePolicyMaterialized)
 			require.Equal(t, tt.wantPolicyEnabled, observedInput.rewritePolicy.enabled)
@@ -4205,7 +4214,7 @@ func TestGetComputationWrapperRestoresStatementRemapOnPlanCacheHit(t *testing.T)
 	require.NoError(t, ses.SetSessionSysVar(ctx, "enable_remap_hint", int64(1)))
 	proc := testutil.NewProcessWithMPool(t, "", mpool.MustNewZero())
 	sql := `/*+ {"remapdb":{"src":"first_db"}} */ select * from src.t; ` +
-		`/*+ {"remapdb":{"src":"second_db"}} */ select * from src.t`
+		`/*+ {"remapdb":{"src":"second_db"}} */ /* cloud_nonuser */ select * from src.t`
 	input := &UserInput{sql: sql}
 	input.genHash()
 	stmts, err := parsers.Parse(ctx, dialect.MYSQL, sql, 1)
@@ -4219,6 +4228,7 @@ func TestGetComputationWrapperRestoresStatementRemapOnPlanCacheHit(t *testing.T)
 	cws, err := GetComputationWrapper(execCtx, "src", "root", nil, proc, ses)
 	require.NoError(t, err)
 	require.Len(t, cws, 2)
+	require.Equal(t, []string{constant.ExternSql, constant.CloudNoUserSql}, input.sqlSourceType)
 	type remapCarrier interface {
 		GetRemapDb() map[string]string
 	}
@@ -4227,6 +4237,13 @@ func TestGetComputationWrapperRestoresStatementRemapOnPlanCacheHit(t *testing.T)
 		require.True(t, ok)
 		require.Equal(t, want, carrier.GetRemapDb()["src"], "wrapper %d", i)
 	}
+	input.isInternalInput = true
+	internalWrappers, err := GetComputationWrapper(execCtx, "src", "root", nil, proc, ses)
+	require.NoError(t, err)
+	for _, cw := range internalWrappers {
+		cw.Free()
+	}
+	require.Equal(t, []string{constant.InternalSql, constant.InternalSql}, input.sqlSourceType)
 }
 
 func TestRebuildStaleCachedStatementsTransfersOwnership(t *testing.T) {
@@ -4779,20 +4796,42 @@ func runTestHandle(funName string, t *testing.T, handleFun func(ses *Session) er
 
 func Test_HandlePrepareStmt(t *testing.T) {
 	ctx := defines.AttachAccountId(context.TODO(), catalog.System_Account)
-	stmt, err := parsers.ParseOne(ctx, dialect.MYSQL, "Prepare stmt1 from select 1, 2", 1)
-	if err != nil {
-		t.Errorf("parser sql error %v", err)
+	for _, tc := range []struct {
+		name, sql, outer string
+		want             bool
+	}{
+		{"sibling does not taint", "prepare stmt1 from select 1, 2", constant.ExternSql, false},
+		{"outer nonuser", "prepare stmt1 from select 1", constant.CloudNoUserSql, true},
+		{"decoded body nonuser", "prepare stmt1 from '/* cloud_nonuser */ select 1'", constant.ExternSql, true},
+		{"escaped decoded tag", `prepare stmt1 from '/* cloud_non\user */ select 1'`, constant.ExternSql, true},
+		{"literal is data", "prepare stmt1 from select '/* cloud_nonuser */'", constant.ExternSql, false},
+		{"outer protects string", "prepare stmt1 from 'select 1'", constant.CloudNoUserSql, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			stmt, err := parsers.ParseOne(ctx, dialect.MYSQL, tc.sql, 1)
+			require.NoError(t, err)
+			defer stmt.Free()
+			ec := newTestExecCtx(ctx, gomock.NewController(t))
+			ec.input = &UserInput{sqlSourceType: []string{constant.CloudNoUserSql, constant.ExternSql}}
+			runTestHandle("handlePrepareStmt", t, func(ses *Session) error {
+				defer ses.Close()
+				ses.SetSqlSourceType(tc.outer)
+				ec.resper = ses.respr
+				var prepared *PrepareStmt
+				var err error
+				switch st := stmt.(type) {
+				case *tree.PrepareStmt:
+					prepared, err = handlePrepareStmt(ses, ec, st, tc.sql)
+				case *tree.PrepareString:
+					prepared, err = handlePrepareString(ses, ec, st)
+				}
+				if err == nil {
+					require.Equal(t, tc.want, prepared.IsCloudNonuser)
+				}
+				return err
+			})
+		})
 	}
-	ctrl := gomock.NewController(t)
-	defer ctrl.Finish()
-	ec := newTestExecCtx(
```

**File**: `pkg/frontend/rewrite_rule_test.go` (modified, +84/-0)
```diff
@@ -30,6 +30,7 @@ import (
 
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/frontend/constant"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
@@ -547,6 +548,62 @@ func TestRewriteSQLPropagatesRuleCacheLoadError(t *testing.T) {
 	require.Equal(t, sql, rewritten)
 }
 
+func TestRewriteSQLStatementInputPreservesSource(t *testing.T) {
+	ses := newTestSession(t, gomock.NewController(t))
+	defer ses.Close()
+	ctx := context.Background()
+	role := &rewritePolicySnapshot{enabled: true, lowerCaseTableNames: 1,
+		roleRules: map[string]string{"db.t": "select id from db.t where id = 1"}}
+	tests := []struct {
+		name, sql                                  string
+		policy                                     *rewritePolicySnapshot
+		internal, materialized, changed, wantError bool
+	}{
+		{name: "mandatory role", sql: "/* save_result */ select * from db.t", policy: role, changed: true},
+		{name: "cloud user", sql: "/* cloud_user */ select * from db.t", policy: role, changed: true},
+		{name: "cloud nonuser", sql: "/* cloud_nonuser */ select * from db.t", policy: role, changed: true},
+		{name: "external", sql: "select * from db.t", policy: role, changed: true},
+		{name: "internal", sql: "/* save_result */ select * from db.t", policy: role, internal: true, changed: true},
+		{name: "session rule", sql: "/* save_result */ select * from db.t", changed: true,
+			policy: &rewritePolicySnapshot{enabled: true, sessionEnabled: true, lowerCaseTableNames: 1,
+				sessionRules: map[string]string{"db.t": "select * from db.t where id = 1"}}},
+		{name: "remap", sql: "/* save_result */ select * from db.t", changed: true,
+			policy: &rewritePolicySnapshot{enabled: true, sessionEnabled: true, lowerCaseTableNames: 1,
+				sessionRemapDb: map[string]string{"db": "target"}}},
+		{name: "no policy", sql: "/* save_result */ select 1"},
+		{name: "disabled", sql: "/* save_result */ select 1", policy: &rewritePolicySnapshot{}},
+		{name: "empty", sql: "/* save_result */ select 1", policy: &rewritePolicySnapshot{enabled: true}},
+		{name: "materialized", sql: "/* save_result */ select 1", policy: role, materialized: true},
+		{name: "parse error", sql: "/* save_result */ select '", policy: role, wantError: true},
+	}
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			input := &UserInput{sql: tc.sql, rewritePolicy: tc.policy,
+				isInternalInput: tc.internal, rewritePolicyMaterialized: tc.materialized}
+			input.genHash()
+			input.genSqlSourceType(ses)
+			before := *input
+			wantSources := append([]string(nil), input.sqlSourceType...)
+			got, err := rewriteSQLStatementInput(ctx, ses, input)
+			if tc.wantError {
+				require.Error(t, err)
+			} else {
+				require.NoError(t, err)
+			}
+			require.Equal(t, before, *input, "rewriting must not mutate the request")
+			require.Equal(t, wantSources, got.sqlSourceType)
+			if tc.changed {
+				require.NotSame(t, input, got)
+				require.NotEqual(t, input.sql, got.sql)
+				require.Equal(t, hashString(got.sql), got.getHash())
+				require.NotEqual(t, input.getHash(), got.getHash())
+			} else {
+				require.Same(t, input, got)
+			}
+		})
+	}
+}
+
 func TestRewriteSQLMaterializesPolicyPerStatement(t *testing.T) {
 	ctx := context.Background()
 	newSession := func(t *testing.T, roleRule, sessionRule string) *Session {
@@ -572,6 +629,33 @@ func TestRewriteSQLMaterializesPolicyPerStatement(t *testing.T) {
 		require.NoError(t, err)
 		return chains["db.t"]
 	}
+	t.Run("source indexes survive materialization", func(t *testing.T) {
+		ses := newSession(t, "select id from db.t where id = 1", "")
+		defer ses.Close()
+		policy, err := captureRewritePolicy(ctx, ses)
+		require.NoError(t, err)
+		input := &UserInput{sql: "/* save_result */ select * from db.t; /* cloud_nonuser */ select * from db.t", rewritePolicy: policy}
+		input.genHash()
+		got, err := rewriteSQLStatementInput(ctx, ses, input)
+		require.NoError(t, err)
+		ec := newTestExecCtx(ctx, gomock.NewController(t))
+		ec.ses, ec.input = ses, got
+		cws, err := GetComputationWrapper(ec, "db", "dump", nil, ses.GetProc(), ses)
+		require.NoError(t, err)
+		defer func() {
+			for _, cw := range cws {
+				cw.Free()
+			}
+		}()
+		require.Nil(t, input.sqlSourceType)
+		require.Equal(t, constant.CloudUserSql, got.getSqlSourceType(0))
+		require.Equal(t, constant.CloudNoUserSql, got.getSqlSourceType(1))
+		fragments := parsers.SplitSqlBySemicolon(got.sql)
+		require.Len(t, fragments, 2)
+		for _, fragment := range fragments {
+			require.Equal(t, []string{"select id from db.t where id = 1"}, decodeChain(t, fragment))
+		}
+	})
 
 	t.Run("parser boundary errors keep parse classification", func(t *testing.T) {
 		ses := newSession(t, "", "")
```

**File**: `pkg/frontend/sidecar_offload_test.go` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ func TestSidecarSelectorIsScopedToOneStatement(t *testing.T) {
 			stmts, err := parsers.Parse(ctx, dialect.MYSQL, tc.sql, 1)
 			require.NoError(t, err)
 			defer freeStatements(stmts)
-			fragments, err := schedulingSQLByStatementWithSQLMode(ctx, tc.sql, "")
+			fragments, _, err := schedulingSQLByStatementWithSQLMode(ctx, tc.sql, "", false)
 			require.NoError(t, err)
 			require.Len(t, fragments, len(stmts))
 			require.Len(t, stmts, len(tc.want))
```

**File**: `pkg/frontend/util.go` (modified, +144/-31)
```diff
@@ -54,6 +54,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect/mysql"
 	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
 	plan2 "github.com/matrixorigin/matrixone/pkg/sql/plan"
 	planrule "github.com/matrixorigin/matrixone/pkg/sql/plan/rule"
@@ -2388,44 +2389,156 @@ func (ui *UserInput) canUsePlanCache() bool {
 }
 
 func (ui *UserInput) genSqlSourceType(ses FeSession) {
-	sql := ui.getSql()
-	ui.sqlSourceType = nil
-	if ui.isInternal() {
-		ui.sqlSourceType = append(ui.sqlSourceType, constant.InternalSql)
-		return
+	source := constant.InternalSql
+	if !ui.isInternalSQLSource(ses) {
+		source = constant.ExternSql
+		if hasSQLSourceTag(ui.getSql()) {
+			source = statementSQLSource(ui.getSql(), sessionSQLModeForParser(ses))
+		}
 	}
+	ui.setSqlSourceTypes(ses, []string{source})
+}
+
+func (ui *UserInput) isInternalSQLSource(ses FeSession) bool {
 	tenant := ses.GetTenantInfo()
-	if tenant == nil || strings.HasPrefix(sql, cmdFieldListSql) {
-		ui.sqlSourceType = append(ui.sqlSourceType, constant.InternalSql)
-		return
+	internal := ui.isInternal() || tenant == nil || strings.HasPrefix(ui.getSql(), cmdFieldListSql)
+	if tenant != nil {
+		special, _, _ := isSpecialUser(tenant.GetUser())
+		internal = internal || special || tenant.GetTenant() == sysAccountName && tenant.GetUser() == "internal"
 	}
-	flag, _, _ := isSpecialUser(tenant.GetUser())
-	if flag {
-		ui.sqlSourceType = append(ui.sqlSourceType, constant.InternalSql)
-		return
+	return internal
+}
+
+// setSqlSourceTypes publishes a complete statement-aligned vector. Internal
+// provenance is authoritative for every slot, not only the first statement.
+func (ui *UserInput) setSqlSourceTypes(ses FeSession, sources []string) {
+	if ui.isInternalSQLSource(ses) {
+		for i := range sources {
+			sources[i] = constant.InternalSql
+		}
 	}
-	if tenant.GetTenant() == sysAccountName && tenant.GetUser() == "internal" {
-		ui.sqlSourceType = append(ui.sqlSourceType, constant.InternalSql)
-		return
+	ui.sqlSourceType = sources
+}
+
+func sourceWithComment(source, comment string) string {
+	if !strings.HasPrefix(comment, "/*") || !strings.HasSuffix(comment, "*/") {
+		return source
 	}
-	for len(sql) > 0 {
-		p1 := strings.Index(sql, "/*")
-		p2 := strings.Index(sql, "*/")
-		if p1 < 0 || p2 < 0 || p2 <= p1+1 {
-			ui.sqlSourceType = append(ui.sqlSourceType, constant.ExternSql)
-			return
+	switch strings.TrimSpace(comment[2 : len(comment)-2]) {
+	case cloudNoUserTag:
+		return constant.CloudNoUserSql
+	case cloudUserTag, saveResultTag:
+		if source != constant.CloudNoUserSql {
+			return constant.CloudUserSql
 		}
-		source := strings.TrimSpace(sql[p1+2 : p2])
-		if source == cloudUserTag {
-			ui.sqlSourceType = append(ui.sqlSourceType, constant.CloudUserSql)
-		} else if source == cloudNoUserTag {
-			ui.sqlSourceType = append(ui.sqlSourceType, constant.CloudNoUserSql)
-		} else if source == saveResultTag {
-			ui.sqlSourceType = append(ui.sqlSourceType, constant.CloudUserSql)
-		} else {
-			ui.sqlSourceType = append(ui.sqlSourceType, constant.ExternSql)
+	}
+	return source
+}
+
+// Absence excludes source markers; presence still requires lexical validation.
+func hasSQLSourceTag(sql string) bool {
+	return strings.Contains(sql, cloudUserTag) || strings.Contains(sql, cloudNoUserTag) || strings.Contains(sql, saveResultTag)
+}
+
+func statementSQLSource(sql, sqlMode string) string {
+	if !hasSQLSourceTag(sql) {
+		return constant.ExternSql
+	}
+	scanner := mysql.NewScannerWithSQLMode(dialect.MYSQL, sql, mysql.ParseSQLModeFlags(sqlMode))
+	defer mysql.PutScanner(scanner)
+	source := constant.ExternSql
+	for {
+		token, comment := scanner.ScanWithComments()
+		if token == mysql.COMMENT {
+			source = sourceWithComment(source, comment)
+		}
+		if token == 0 || token == mysql.EofChar() || token == mysql.LEX_ERROR {
+			return source
+		}
+	}
+}
+
+// sqlSourcesByFragment scans the whole lexical stream: a grammar fragment can
+// start inside a MySQL executable comment. Unfiltered fragments are ordered
+// trimmed slices of sql, so recovering their ends needs no second SQL parser.
+func sqlSourcesByFragment(ctx context.Context, sql, sqlMode string, fragments []string, internalSource bool) ([]string, error) {
+	scanSources := !internalSource && hasSQLSourceTag(sql)
+	var ends []int
+	if scanSources {
+		ends = make([]int, len(fragments))
+	}
+	sources := make([]string, len(fragments))
+	cursor := 0
+	for i, fragment := range fragments {
+		sources[i] = constant.ExternSql
+		if internalSource {
+			sources[i] = constant.InternalSql
+		}
+		if fragment != "" {
+			offset := strings.Index(sql[cursor:], fragment)
+			if offset < 0 {
+				return nil, moerr.NewInternalError(ctx, "SQL fragment is not in its input")
+			}
+			cursor += offset + len(fragment)
+		}
+		if scanSou
```

**File**: `pkg/sql/parsers/dialect/mysql/scanner.go` (modified, +29/-18)
```diff
@@ -118,9 +118,20 @@ func PutScanner(scanner *Scanner) {
 }
 
 func (s *Scanner) Scan() (int, string) {
+	return s.scan(false)
+}
+
+// ScanWithComments uses the SQL lexer, including its quote and SQLMode rules,
+// but returns ordinary comments instead of skipping them. Executable comments
+// remain SQL lexical space, just as they are for Scan.
+func (s *Scanner) ScanWithComments() (int, string) {
+	return s.scan(true)
+}
+
+func (s *Scanner) scan(comments bool) (int, string) {
 	if s.MysqlSpecialComment != nil {
 		msc := s.MysqlSpecialComment
-		tok, val := msc.Scan()
+		tok, val := msc.scan(comments)
 		if tok != 0 {
 			return tok, val
 		}
@@ -240,10 +251,10 @@ func (s *Scanner) Scan() (int, string) {
 		case '/':
 			s.inc()
 			id, str := s.scanCommentTypeLine(2)
-			if id == LEX_ERROR {
+			if comments || id == LEX_ERROR {
 				return id, str
 			}
-			return s.Scan()
+			return s.scan(comments)
 		case '*':
 			s.inc()
 			switch s.cur() {
@@ -253,20 +264,20 @@ func (s *Scanner) Scan() (int, string) {
 				if !s.readVersion() {
 					return LEX_ERROR, ""
 				}
-				return s.Scan()
+				return s.scan(comments)
 			default:
 				id, str := s.scanCommentTypeBlock()
-				if id == LEX_ERROR {
+				if comments || id == LEX_ERROR {
 					return id, str
 				}
-				return s.Scan()
+				return s.scan(comments)
 			}
 		default:
 			return int(ch), ""
 		}
 	case ch == '*':
 		if !s.CommentFlag {
-			return s.stepBackOneChar(ch)
+			return s.stepBackOneChar(ch, comments)
 		}
 		s.inc()
 		switch s.cur() {
@@ -276,21 +287,21 @@ func (s *Scanner) Scan() (int, string) {
 			if s.executableCommentEnd == 0 {
 				s.executableCommentEnd = s.Pos
 			}
-			return s.Scan()
+			return s.scan(comments)
 		default:
-			return s.stepBackOneChar(ch)
+			return s.stepBackOneChar(ch, comments)
 		}
 	case ch == '\'':
 		if !s.CommentFlag {
-			return s.stepBackOneChar(ch)
+			return s.stepBackOneChar(ch, comments)
 		}
 		s.inc()
 		switch {
 		case s.cur() == '+':
 			s.inc()
 			switch s.cur() {
 			case '\'':
-				return s.Scan()
+				return s.scan(comments)
 			default:
 				return s.scanStringAddPlus(ch, STRING)
 			}
@@ -305,17 +316,17 @@ func (s *Scanner) Scan() (int, string) {
 		case isDigit(s.cur()):
 			return s.scanString(ch, STRING)
 		default:
-			return s.Scan()
+			return s.scan(comments)
 		}
 	case ch == '#':
 		s.inc()
 		id, str := s.scanCommentTypeLine(1)
-		if id == LEX_ERROR {
+		if comments || id == LEX_ERROR {
 			return id, str
 		}
-		return s.Scan()
+		return s.scan(comments)
 	default:
-		return s.stepBackOneChar(ch)
+		return s.stepBackOneChar(ch, comments)
 	}
 }
 
@@ -395,7 +406,7 @@ func (s *Scanner) readVersion() bool {
 	return true
 }
 
-func (s *Scanner) stepBackOneChar(ch uint16) (int, string) {
+func (s *Scanner) stepBackOneChar(ch uint16, comments bool) (int, string) {
 	s.inc()
 	switch ch {
 	case eofChar:
@@ -435,10 +446,10 @@ func (s *Scanner) stepBackOneChar(ch uint16) (int, string) {
 			if nextChar == ' ' || nextChar == '\n' || nextChar == '\t' || nextChar == '\r' || nextChar == eofChar {
 				s.inc()
 				id, str := s.scanCommentTypeLine(2)
-				if id == LEX_ERROR {
+				if comments || id == LEX_ERROR {
 					return id, str
 				}
-				return s.Scan()
+				return s.scan(comments)
 			}
 		case '>':
 			s.inc()
```

**File**: `pkg/sql/parsers/dialect/mysql/scanner_test.go` (modified, +38/-0)
```diff
@@ -16,6 +16,7 @@ package mysql
 
 import (
 	"fmt"
+	"reflect"
 	"testing"
 
 	"github.com/matrixorigin/matrixone/pkg/common/sqlquote"
@@ -483,6 +484,43 @@ func TestBuffer(t *testing.T) {
 }
 
 func TestComment(t *testing.T) {
+	t.Run("SQL_aware_comments", func(t *testing.T) {
+		for _, tc := range []struct {
+			sql, mode string
+			comments  []string
+		}{
+			{"select '/* literal */', `/* identifier */` /* real */", "", []string{"/* real */"}},
+			{"-- /* line */\nselect 1 # second\n// third\n/* block */", "", []string{"-- /* line */\n", "# second\n", "// third\n", "/* block */"}},
+			{"/*! select 1; select 'x/* literal */' */ /* real */", "", []string{"/* real */"}},
+			{"select 'a\\' /* literal */' /* real */", "", []string{"/* real */"}},
+			{"select 'a\\' /* real */", "NO_BACKSLASH_ESCAPES", []string{"/* real */"}},
+			{"select \"/* identifier */\" /* real */", "ANSI_QUOTES", []string{"/* real */"}},
+			{"select 1 /* incomplete", "", nil},
+		} {
+			t.Run(tc.sql+tc.mode, func(t *testing.T) {
+				scanner := NewScannerWithSQLMode(dialect.MYSQL, tc.sql, ParseSQLModeFlags(tc.mode))
+				defer PutScanner(scanner)
+				var got []string
+				for {
+					tok, value := scanner.ScanWithComments()
+					if tok == COMMENT {
+						got = append(got, value)
+					}
+					if tok == 0 || tok == EofChar() || tok == LEX_ERROR {
+						break
+					}
+				}
+				if !reflect.DeepEqual(tc.comments, got) {
+					t.Fatalf("comments: want %q, got %q", tc.comments, got)
+				}
+				// Returning comments is per call, not state retained across reuse.
+				scanner.setSql("/* skipped */ select 1")
+				if tok, _ := scanner.Scan(); tok != SELECT {
+					t.Fatalf("normal scan returned %d", tok)
+				}
+			})
+		}
+	})
 	testcases := []struct {
 		name  string
 		in    string
```

---

### Incident Patch 13: `3eab55f2` (2026-10-04)
**Commit Message**: fix(cdc): fence target resets and reject keyless sources (#28521)

## What type of PR is this?

- [x] BUG
- [x] Improvement
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

- Fixes #29382: diagnose wildcard sources discovered after finite EndTs
before target or epoch effects.
- Addresses the supported source-table and generation-safe recovery
boundaries of #26949; does not resolve all cross-table replication-lag
behavior.

## What this PR does / why we need it:

CDC must not apply an old source's progress to a replacement source or
write into a replacement target merely because the names and schema
match. It also must not permanently fail a task when an identity query
encounters a retryable connection or transaction error.

- Reject keyless sources, including later wildcard discovery and PK
loss. Durable watermark generations own admission and recovery;
replacement stops for explicit recovery unless finite-EndTs historical
completion is proved.
- Persist pending source and target identities before effects. Hold the
source catalog guard through the first synchronous target ACK, and
verify persistent target identity and schema in the same guarded target
tra

**File**: `docs/design/20260925-cdc-target-generation-reset.md` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# CDC generation-safe target admission for PR #28521
+
+Status: proposed rev5, awaiting product/design approval. Date: 2026-09-25. Owner: PR #28521. Rev4 was approved; rev5 raises the task creation gate after independent review found that v48–v57 target metadata cannot prove text collation.
+
+## Problem and scope
+
+At PR head `326eec3f3ed4224e19debc8c5a90bb801aeaee1c`, the detector shares one `IdChanged` marker across CDC tasks. A successful task can acknowledge it, another task can fail, and the first task can receive the same marker on resume. Its sink executes `DROP TABLE IF EXISTS` and resumes from an advanced watermark, losing rows. A deterministic reproduction registers A and B to the same source, lets A acknowledge a source replacement while B fails, then unregisters and re-registers A: A receives `[true,true]` rather than `[true,false]`. A fresh CN can also miss the scanner's process-local transition. Finally, an old reader may advance its watermark beyond the replacement source table's first writes; resetting the target and replaying from that old timestamp also loses rows.
+
+This revision assumes, per the product scope decision, that simultaneous old/new CN binaries and downgrade compatibility are outside this PR's acceptance. Same-version CN takeover, restart, source replacement, retry, and legacy task data safety remain in scope. The design does not close issue #26949's cross-table replication lag or enable CDC on a source without a user primary key.
+
+## Smallest durable state
+
+Reuse the existing per-task/table `mo_cdc_watermark` row and existing source-generation-keyed snapshot epoch row. No new catalog column, task code, MORPC version, ledger, worker, or periodic scan is required. For generation-aware tasks, `source_table_id=g` now means **target initialization for `g` has been durably acknowledged**; subsequent checkpoints continue to carry the same `g`. `watermark` is the replay position for that generation, except that an initial NoFull/start task retains its durable admission boundary after initialization. The target lock serializes target effects; `owner_generation` fences all catalog writes. The scanner's `IdChanged` remains a scheduling hint, never authority for DROP.
+
+New tasks persist a generation-aware option in existing task metadata. **All generation-aware task creation paths require cluster protocol v58** before persisting the task, including atomic full, explicit StartTs, and NoFull. The watermark owner and epoch tables were available at v48, but v48–v57 use an `information_schema.COLUMNS` view that reports the same `utf8_bin` collation for multiple underlying charset modes. That view cannot prove the target's text comparison semantics. v58 installs the corrected view; target verification still fails closed when its reported collation differs from the source's required semantics. Historical `CharsetLegacy` is bytewise; an old target whose view reports `utf8_general_ci` without proof of its underlying charset requires explicit verification or recovery rather than automatic acknowledgement. No new MORPC version is introduced under the same-version rollout scope. Existing fenced stable tasks with `source_table_id>0` may be admitted using their recorded generation after validation. **Every unmarked task with `source_table_id=0` is ambiguous**, even with an empty watermark: an old full sink transaction or partial split snapshot may have reached the target before its checkpoint persisted. Pause it unless durable epoch/target evidence proves a safe recovery. A new marked NoFull task can also have `(source_table_id=0, watermark=admission)` before its first target DDL, so row existence/watermark alone must not classify legacy state. The existing default full task uses split snapshots (the persisted boolean is false with the stable-epoch marker, and the runner restores split); an explicit `InitSnapshotSplitTxn=false` uses an atomic snapshot. Preserve that selected grouping in both modes and cap either first snapshot at the persisted epoch `E`. The current reader caps to `E` only in split mode and must be extended for atomic mode.
+
+## Invariants and transition order
+
+1. For a current claimant and source generation `g`, if durable initialized generation equals `g`, do not DROP due to a repeated detector marker. Verify that the CDC-owned target exists and has the expected structure; fail closed if it was externally removed or altered. External target row mutation is unsupported.
+2. On first admission of a marked task, persist a fixed epoch `E` first if the task needs an initial full snapshot, including the explicitly selected atomic full mode. Initialize the target under its target lock, then synchronously acknowledge `source_table_id=g` under the current owner fence **before** publishing a reader. Preserve the NoFull/explicit-start admission timestamp. A crash before acknowledgement may repeat initialization, but no reader for that generation was published; a 
```

**File**: `docs/design/20260925-cdc-target-identity-rev7.md` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+# CDC target identity and interrupted admission — PR #28521 rev7
+
+Status: proposed; exact-version approval required before protocol implementation. Date: 2026-09-25. This amends the approved [rev5 generation design](20260925-cdc-target-generation-reset.md) and supersedes approved rev6 after an optimistic-DDL lock bypass was found. Rev5's no-new-column claim, automatic destructive reset/replay on source replacement, immediate deletion of every predecessor epoch before first acknowledgement, and schema-only target verification are superseded here. Other rev5 invariants remain where consistent with these explicit changes.
+
+## Why rev5 needed another review
+
+Reviewing individual comments and unit tests established source-generation fencing but did not test the independent *target* generation. A real embedded run dropped and recreated the target with the same columns after a source replacement: three source rows became one target row and schema verification accepted it. The type verifier also rejected real, valid `YEAR`, `FLOAT(5,2)`, and `DOUBLE(6,5)` metadata; its mock covered only simple types. The mode-2 collision guard re-read every watermark for every admitted table. Finally, a generation-zero first attempt could delete its only durable epoch before target acknowledgement, leaving recovery to guess. Several tests called old restart-classification helpers that production no longer calls. The common mistake was treating a local state bit or structural equality as a durable cross-system fact.
+
+The acceptance unit is now the complete transition tuple: durable source generation, target identity, replay boundary, owner claim, and pending attempt. Every crash boundary must either retry from this tuple or stop with a specific recovery action. Real sink metadata and target rows, rather than helper return values, are the oracle. Validation must include a cost bound for every added catalog or target query.
+
+## Product contract
+
+1. Once a target generation is durably acknowledged, the CDC task must detect its replacement by an identically shaped table before publishing a new reader or writing another target transaction. The target's physical identity is persisted. If a MySQL sink cannot expose a trustworthy identity, including missing `PROCESS` privilege for `INFORMATION_SCHEMA.INNODB_TABLES`, the task pauses with a capability diagnostic. An external row edit remains unsupported. Ordinary watermark updates are already buffered for asynchronous batch persistence; per the approved product boundary, identity is checked before every new target transaction and on resume. An already buffered old-target timestamp may flush after external DDL; a stronger atomic exclusion guarantee would require redesigning the checkpoint hot path and is outside this revision. During the first CREATE-to-ACK window, there is no prior acknowledged target identity; an uncoordinated external DROP/CREATE in that window cannot be attributed and is outside this identity guarantee.
+2. If the source changes while any task is awaiting its first target acknowledgement, the task pauses for explicit recovery. First ACK must therefore re-read the live source table ID under a source catalog guard held through the synchronous watermark ACK commit; a stale detector result is insufficient. A NoFull or explicit StartTs target may contain prefilled data, so CDC must not erase it by inference. A same-generation retry uses its original boundary. As approved in the product decision, an already acknowledged source replacement requiring destructive target reset also pauses for explicit rebuild. Automatically clearing a large target row by row would preserve its ID but is an unbounded cost, while compare-then-DROP cannot exclude uncoordinated external DDL.
+3. Existing tasks whose target identity was never persisted cannot be silently assigned the current identity. They pause and require an explicitly rebuilt or recreated task with a clean target. No automatic migration may claim that current schema or row count proves continuity.
+
+## Durable state and ownership
+
+Add two nullable fields to each `mo_cdc_watermark` row: `pending_source_table_id` and `target_identity`. `NULL` pending means no admission attempt; a positive pending value names the source generation selected before *any* target DDL. When `source_table_id>0`, `target_identity` is the acknowledged target ID. When `source_table_id=0` and pending is set, it records the pre-DDL target ID or an explicit `absent` sentinel; no other reuse of a target with a null identity is allowed. At acknowledgement, atomically replace that value with the post-DDL physical ID, and clear pending. The string includes sink kind and an unambiguous backend identifier. For MySQL 8 InnoDB, use `@@server_uuid` plus `INFORMATION_SCHEMA.INNODB_TABLES.TABLE_ID` for the exact escaped schema/table name. For MatrixOne, use the tenant target table's `mo_tables.rel_id` and pin the task to its configured target c
```

**File**: `pkg/bootstrap/service_statistics_upgrade_test.go` (modified, +23/-17)
```diff
@@ -23,6 +23,7 @@ import (
 	"github.com/golang/mock/gomock"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_10"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_11"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_6"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_7"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_8"
@@ -41,7 +42,7 @@ import (
 )
 
 func TestDoCheckUpgradeQueuesStatisticsRefresh(t *testing.T) {
-	final := v4_0_10.Handler.Metadata()
+	final := v4_0_11.Handler.Metadata()
 	require.Greater(t, versions.Compare(final.Version, "4.0.7"), 0)
 	for _, test := range []struct {
 		name    string
@@ -51,16 +52,18 @@ func TestDoCheckUpgradeQueuesStatisticsRefresh(t *testing.T) {
 		via407  bool
 		via408  bool
 		via409  bool
+		via410  bool
 	}{
 		// Released v4.2.4 has four tenant entries and one cluster entry;
 		// later additions to main's 4.0.6 handler must not be assumed to run.
-		{name: "release_4.2.4", version: "4.0.6", offset: 5, upgrade: true, via407: true, via408: true, via409: true},
-		{name: "4.0.6", version: "4.0.6", offset: v4_0_6.Handler.Metadata().VersionOffset, upgrade: true, via407: true, via408: true, via409: true},
-		{name: "old_4.0.7", version: "4.0.7", upgrade: true, via408: true, via409: true},
-		{name: "4.0.7_offset_1", version: "4.0.7", offset: 1, upgrade: true, via408: true, via409: true},
-		{name: "current_4.0.8", version: "4.0.8", offset: v4_0_8.Handler.Metadata().VersionOffset, upgrade: true, via409: true},
-		{name: "current_4.0.9", version: "4.0.9", offset: v4_0_9.Handler.Metadata().VersionOffset, upgrade: true},
-		{name: "current_4.0.10", version: final.Version, offset: final.VersionOffset},
+		{name: "release_4.2.4", version: "4.0.6", offset: 5, upgrade: true, via407: true, via408: true, via409: true, via410: true},
+		{name: "4.0.6", version: "4.0.6", offset: v4_0_6.Handler.Metadata().VersionOffset, upgrade: true, via407: true, via408: true, via409: true, via410: true},
+		{name: "old_4.0.7", version: "4.0.7", upgrade: true, via408: true, via409: true, via410: true},
+		{name: "4.0.7_offset_1", version: "4.0.7", offset: 1, upgrade: true, via408: true, via409: true, via410: true},
+		{name: "current_4.0.8", version: "4.0.8", offset: v4_0_8.Handler.Metadata().VersionOffset, upgrade: true, via409: true, via410: true},
+		{name: "current_4.0.9", version: "4.0.9", offset: v4_0_9.Handler.Metadata().VersionOffset, upgrade: true, via410: true},
+		{name: "current_4.0.10", version: "4.0.10", offset: v4_0_10.Handler.Metadata().VersionOffset, upgrade: true},
+		{name: "current_4.0.11", version: final.Version, offset: final.VersionOffset},
 	} {
 		t.Run(test.name, func(t *testing.T) {
 			runtime.RunTest("", func(runtime.Runtime) {
@@ -95,6 +98,9 @@ func TestDoCheckUpgradeQueuesStatisticsRefresh(t *testing.T) {
 				require.NoError(t, b.doCheckUpgrade(context.Background()))
 				if test.upgrade {
 					hops := []versions.Version{final}
+					if test.via410 {
+						hops = append([]versions.Version{v4_0_10.Handler.Metadata()}, hops...)
+					}
 					if test.via409 {
 						hops = append([]versions.Version{v4_0_9.Handler.Metadata()}, hops...)
 					}
@@ -359,11 +365,11 @@ func TestMaybeUpgradeTenantDoesNotCacheUncommittedOrFailedChecks(t *testing.T) {
 		failUpgrade    bool
 		ownTxn         bool
 	}{
-		{name: "caller_owned_transaction", version: "4.0.10", ownTxn: true},
-		{name: "catalog_read_failure", version: "4.0.10", fail: true},
+		{name: "caller_owned_transaction", version: "4.0.11", ownTxn: true},
+		{name: "catalog_read_failure", version: "4.0.11", fail: true},
 		{name: "migration_failure", version: "4.0.9", failUpgrade: true},
-		{name: "newer_catalog_version", version: "4.0.11"},
-		{name: "different_cluster_version", version: "4.0.9", clusterVersion: "4.0.11"},
+		{name: "newer_catalog_version", version: "4.0.12"},
+		{name: "different_cluster_version", version: "4.0.9", clusterVersion: "4.0.12"},
 	} {
 		t.Run(test.name, func(t *testing.T) {
 			runtime.RunTest("", func(runtime.Runtime) {
@@ -379,7 +385,7 @@ func TestMaybeUpgradeTenantDoesNotCacheUncommittedOrFailedChecks(t *testing.T) {
 						}
 						return newBootstrapStringResult(test.version), nil
 					case strings.HasPrefix(sql, "select version, version_offset, state from mo_version"):
-						latest := v4_0_10.Handler.Metadata()
+						latest := v4_0_11.Handler.Metadata()
 						if test.clusterVersion != "" {
 							latest.Version = test.clusterVersion
 						}
@@ -398,7 +404,7 @@ func TestMaybeUpgradeTenantDoesNotCacheUncommittedOrFailedChecks(t *testing.T) {
 					if test.ownTxn {
 						txnOp = &testTxnOperator{}
 					}
-					fetch := func() (int32, string, error) { return 11, "4.0.10", nil }
+					fetch := func() (int32, string, error) { return 11, "4.0.11", nil }
 					upgraded, err := b.MaybeUpgradeTenant(t.Context(), fetch, txnOp)
 					if test.own
```

**File**: `pkg/bootstrap/upgrade.go` (modified, +2/-0)
```diff
@@ -29,6 +29,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_0"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_1"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_10"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_11"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_2"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_3"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_4"
@@ -67,6 +68,7 @@ func (s *service) initUpgrade() {
 	s.handles = append(s.handles, v4_0_8.Handler)
 	s.handles = append(s.handles, v4_0_9.Handler)
 	s.handles = append(s.handles, v4_0_10.Handler)
+	s.handles = append(s.handles, v4_0_11.Handler)
 }
 
 func (s *service) getFinalVersionHandle() VersionHandle {
```

**File**: `pkg/bootstrap/versions/v4_0_11/cluster_upgrade_list.go` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
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
+package v4_0_11
+
+import (
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/util/executor"
+)
+
+// These columns are deliberately introduced after 4.0.10.  That version is
+// already published as the final upgrade by older clusters, so changing its
+// handler would leave those clusters permanently without the CDC target
+// identity catalog state.
+var clusterUpgEntries = []versions.UpgradeEntry{
+	cdcWatermarkColumn("pending_source_table_id", "bigint unsigned null after owner_generation"),
+	cdcWatermarkColumn("target_identity", "varchar(256) null after pending_source_table_id"),
+}
+
+func cdcWatermarkColumn(name, definition string) versions.UpgradeEntry {
+	return versions.UpgradeEntry{
+		Schema:                  catalog.MO_CATALOG,
+		TableName:               catalog.MO_CDC_WATERMARK,
+		UpgType:                 versions.ADD_COLUMN,
+		UpgSql:                  "alter table mo_catalog.mo_cdc_watermark add column " + name + " " + definition,
+		RequiredProtocolVersion: defines.MORPCVersion106,
+		CheckFunc: func(txn executor.TxnExecutor, accountID uint32) (bool, error) {
+			column, err := versions.CheckTableColumn(txn, accountID, catalog.MO_CATALOG, catalog.MO_CDC_WATERMARK, name)
+			return column.IsExits, err
+		},
+	}
+}
```

**File**: `pkg/bootstrap/versions/v4_0_11/upgrade.go` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
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
+package v4_0_11
+
+import (
+	"context"
+
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/util/executor"
+)
+
+var Handler = &versionHandle{metadata: versions.Version{
+	Version:                 "4.0.11",
+	MinUpgradeVersion:       "4.0.10",
+	UpgradeCluster:          versions.Yes,
+	UpgradeTenant:           versions.No,
+	VersionOffset:           uint32(len(clusterUpgEntries)),
+	RequiredProtocolVersion: defines.MORPCVersion106,
+}}
+
+type versionHandle struct{ metadata versions.Version }
+
+func (v *versionHandle) Metadata() versions.Version { return v.metadata }
+
+func (v *versionHandle) Prepare(_ context.Context, txn executor.TxnExecutor, _ bool) error {
+	txn.Use(catalog.MO_CATALOG)
+	return nil
+}
+
+func (v *versionHandle) HandleTenantUpgrade(_ context.Context, _ int32, _ executor.TxnExecutor) error {
+	return nil
+}
+
+func (v *versionHandle) HandleClusterUpgrade(_ context.Context, txn executor.TxnExecutor) error {
+	for _, entry := range clusterUpgEntries {
+		if err := entry.Upgrade(txn, catalog.System_Account); err != nil {
+			return err
+		}
+	}
+	return nil
+}
+
+func (v *versionHandle) HandleCreateFrameworkDeps(_ executor.TxnExecutor) error {
+	return moerr.NewInternalErrorNoCtxf("Only v1.2.0 can initialize upgrade framework, current version is:%s", v.metadata.Version)
+}
```

**File**: `pkg/bootstrap/versions/v4_0_11/upgrade_test.go` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
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
+package v4_0_11
+
+import (
+	"context"
+	"errors"
+	"github.com/golang/mock/gomock"
+	"github.com/matrixorigin/matrixone/pkg/common/mpool"
+	"github.com/matrixorigin/matrixone/pkg/common/runtime"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
+	pbtxn "github.com/matrixorigin/matrixone/pkg/pb/txn"
+	"github.com/matrixorigin/matrixone/pkg/util/executor"
+	"strings"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/stretchr/testify/require"
+)
+
+func TestCDCWatermarkColumnsUpgradeMetadata(t *testing.T) {
+	m := Handler.Metadata()
+	require.Equal(t, "4.0.11", m.Version)
+	require.Equal(t, "4.0.10", m.MinUpgradeVersion)
+	require.Equal(t, versions.Yes, m.UpgradeCluster)
+	require.Equal(t, versions.No, m.UpgradeTenant)
+	require.Equal(t, defines.MORPCVersion106, m.RequiredProtocolVersion)
+	require.Len(t, clusterUpgEntries, 2)
+	for _, entry := range clusterUpgEntries {
+		require.Equal(t, catalog.MO_CDC_WATERMARK, entry.TableName)
+		require.Equal(t, versions.ADD_COLUMN, entry.UpgType)
+		require.Equal(t, int64(defines.MORPCVersion106), entry.RequiredProtocolVersion)
+	}
+}
+
+// Exercise the upgrade entry point: all CNs must support the new columns
+// before either ALTER, and a failed ALTER must stop the upgrade immediately.
+func TestCDCWatermarkUpgradeAdmission(t *testing.T) {
+	injected := errors.New("catalog DDL failure")
+	for _, tc := range []struct {
+		name, protocol string
+		failDDL        bool
+		wantDDL        int
+		wantErr        bool
+	}{
+		{"old", `{"result":"cn0:105"}`, false, 0, true},
+		{"mixed", `{"result":"cn0:106,cn1:105"}`, false, 0, true},
+		{"ready", `{"result":"cn0:106,cn1:106"}`, false, 2, false},
+		{"DDL failure", `{"result":"cn0:106"}`, true, 1, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			runtime.RunTest("", func(runtime.Runtime) {
+				op := mock_frontend.NewMockTxnOperator(gomock.NewController(t))
+				op.EXPECT().TxnOptions().Return(pbtxn.TxnOptions{}).AnyTimes()
+				mp := mpool.MustNewZero()
+				defer func() { require.Zero(t, mp.CurrNB()) }()
+				var ddl []string
+				txn := executor.NewMemTxnExecutor(func(sql string) (executor.Result, error) {
+					switch {
+					case strings.Contains(sql, "FROM mo_catalog.mo_columns"):
+						return executor.Result{}, nil // columns do not exist yet
+					case sql == "SELECT mo_ctl('cn', 'GetProtocolVersion', '')":
+						r := executor.NewMemResult([]types.Type{types.T_varchar.ToType()}, mp)
+						r.NewBatchWithRowCount(1)
+						require.NoError(t, executor.AppendStringRows(r, 0, []string{tc.protocol}))
+						return r.GetResult(), nil
+					default:
+						ddl = append(ddl, sql)
+						if tc.failDDL {
+							return executor.Result{}, injected
+						}
+						return executor.Result{}, nil
+					}
+				}, op)
+				err := Handler.HandleClusterUpgrade(context.Background(), txn)
+				require.Equal(t, tc.wantErr, err != nil)
+				if tc.failDDL {
+					require.ErrorIs(t, err, injected)
+				}
+				expected := []string{
+					"alter table mo_catalog.mo_cdc_watermark add column pending_source_table_id bigint unsigned null after owner_generation",
+					"alter table mo_catalog.mo_cdc_watermark add column target_identity varchar(256) null after pending_source_table_id",
+				}
+				require.Len(t, ddl, tc.wantDDL)
+				for i := range ddl {
+					require.Equal(t, expected[i], ddl[i])
+				}
+			})
+		})
+	}
+}
```

**File**: `pkg/cdc/error_handler.go` (modified, +54/-0)
```diff
@@ -15,12 +15,66 @@
 package cdc
 
 import (
+	"context"
+	"errors"
 	"fmt"
 	"strconv"
 	"strings"
 	"time"
+
+	gomysql "github.com/go-sql-driver/mysql"
+	"github.com/matrixorigin/matrixone/pkg/cdc/retry"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/common/morpc"
 )
 
+var cdcBackendRetryClassifier = retry.MultiClassifier{
+	retry.DefaultClassifier{}, retry.MySQLErrorClassifier{},
+}
+
+// ClassifyRetryableError shares typed backend and control-error policy between
+// admission and running streams. An unclassified error is not proof of a
+// permanent failure: only runtime has additional, context-specific fallbacks.
+func ClassifyRetryableError(err error) (retryable, classified bool) {
+	if err == nil {
+		return false, true
+	}
+	if errors.Is(err, context.Canceled) || IsOwnerFenceLostError(err) {
+		return false, true
+	}
+	var code uint16
+	var native *moerr.Error
+	var wire *gomysql.MySQLError
+	if errors.As(err, &native) {
+		code = native.ErrorCode()
+	} else if errors.As(err, &wire) {
+		code = wire.Number
+	}
+	// MO preserves these internal codes over the MySQL protocol. Keep one
+	// decision for both transports, including local client shutdown.
+	switch code {
+	case moerr.ErrClientClosed, moerr.ErrStreamClosed,
+		1044, 1045, 1142, 1143, 1227, moerr.ErrNotSupported:
+		return false, true
+	case moerr.ErrTxnNeedRetry, moerr.ErrTxnNeedRetryWithDefChanged,
+		moerr.ErrRPCTimeout, moerr.ErrServiceUnavailable, moerr.ErrConnectionReset,
+		moerr.ErrBackendClosed, moerr.ErrNoAvailableBackend, moerr.ErrBackendCannotConnect,
+		moerr.ErrTNShardNotFound, moerr.ErrRpcError:
+		return true, true
+	}
+	status := morpc.GetStatusCategory(err)
+	if status == morpc.StatusCancelled {
+		return false, true
+	}
+	if IsRetryableSnapshotEpochError(err) || IsRetryableOwnerFenceError(err) ||
+		IsRetryableTargetLockError(err) || IsRetryableConnectionError(err) ||
+		status == morpc.StatusTransient || status == morpc.StatusUnavailable ||
+		cdcBackendRetryClassifier.IsRetryable(err) {
+		return true, true
+	}
+	return false, false
+}
+
 // Error handling constants
 const (
 	MaxRetryCount           = 3
```

---

### Incident Patch 14: `a910a4d1` (2026-10-04)
**Commit Message**: fix: avoid per-batch lock-key preparation for index backfills (#29604)

Large CREATE INDEX backfills on main prepare, encode and sort every batch of lock keys in a serialized row-lock operator. The successful BigData composite-unique backfill in #29602 takes about 548s on main versus 268s on 4.2. Restoring cardinality-based table locks for general DML would undo #26706's disjoint-writer concurrency improvement.

After creating a regular or unique hidden index table, pass its resolved physical ID to the internal backfill statement. For that exact Exclusive INSERT target, acquire the existing full-range lock before any data source starts and omit its row-lock operator. Preserve the original input merge and downstream writer placement/parallelism. Ordinary DML and unrelated targets retain their existing locking; LOAD, Shared, dynamically partitioned and unsupported-range targets are ineligible.

The statement-local option requests actual lock acquisition; it neither asserts an existing grant nor disables locking. Existing binding/snapshot checks and transaction commit/rollback remain authoritative. Acquisition errors and cancellation stop execution. The uniqueness precheck receives no

**File**: `pkg/sql/compile/compile.go` (modified, +36/-5)
```diff
@@ -51,6 +51,7 @@ import (
 	planplugin "github.com/matrixorigin/matrixone/pkg/indexplugin/plan"
 	"github.com/matrixorigin/matrixone/pkg/logutil"
 	"github.com/matrixorigin/matrixone/pkg/objectio"
+	"github.com/matrixorigin/matrixone/pkg/pb/lock"
 	"github.com/matrixorigin/matrixone/pkg/pb/pipeline"
 	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/pb/timestamp"
@@ -557,6 +558,7 @@ func (c *Compile) clear() {
 	c.skipDataBranchReclaim = false
 	c.keepAutoIncrement = 0
 	c.disableLock = false
+	c.prePipelineLockTableID = 0
 	c.icebergScanPlanner = nil
 
 	for _, exe := range c.filterExprExes {
@@ -9232,7 +9234,8 @@ func (c *Compile) compileDelete(node *plan.Node, ss []*Scope) ([]*Scope, error)
 
 func (c *Compile) compileLock(node *plan.Node, ss []*Scope) ([]*Scope, error) {
 	lockRows := make([]*plan.LockTarget, 0, len(node.LockTargets))
-	localizeLoadPlan := c.loadUniqueIndexPromotion != nil
+	localizeLockPlan := c.loadUniqueIndexPromotion != nil || c.prePipelineLockTableID != 0
+	promotedNewTable := false
 	filterPromotedRows := false
 	if state := c.loadUniqueIndexPromotion; state != nil &&
 		state.phase == loadUniqueIndexPromotionFenced {
@@ -9245,8 +9248,20 @@ func (c *Compile) compileLock(node *plan.Node, ss []*Scope) ([]*Scope, error) {
 		if filterPromotedRows && c.loadUniqueIndexPromotion.coversRowTarget(canonicalTarget) {
 			continue
 		}
+		if c.canPrePipelineLockNewTable(canonicalTarget) {
+			// The DDL owner supplied the newly created physical ID. Acquire its
+			// total range through the ordinary pre-pipeline lock path, before any
+			// source starts; failures still abort or retry the complete DDL. The
+			// physical disposition must not modify a reusable logical plan.
+			tableTarget := *canonicalTarget
+			tableTarget.LockTable = true
+			tableTarget.LockTableAtTheEnd = false
+			c.lockTables[tableTarget.TableId] = &tableTarget
+			promotedNewTable = true
+			continue
+		}
 		tbl := canonicalTarget
-		if localizeLoadPlan && (canonicalTarget.LockTable || canonicalTarget.LockTableAtTheEnd) {
+		if localizeLockPlan && (canonicalTarget.LockTable || canonicalTarget.LockTableAtTheEnd) {
 			// Only table-lock disposition is annotated during physical compile. A
 			// shallow value copy keeps the canonical generation immutable without
 			// changing allocation or mutation behavior for non-candidate statements.
@@ -9261,12 +9276,18 @@ func (c *Compile) compileLock(node *plan.Node, ss []*Scope) ([]*Scope, error) {
 			}
 		}
 	}
-	if !localizeLoadPlan {
+	if !localizeLockPlan {
 		// Preserve exact-main compile behavior outside the positively admitted
-		// LOAD path, including its existing canonical-node reuse contract.
+		// internal INSERT and LOAD paths, including canonical-node reuse.
 		node.LockTargets = lockRows
 	}
 	if len(lockRows) == 0 {
+		if promotedNewTable && (!c.IsTpQuery() || len(ss) > 1 || len(c.pn.GetQuery().Steps) > 1) {
+			// Keep the original input merge and downstream writer placement/DOP.
+			// Only remove row-key preparation; attaching writers to reader scopes
+			// would also change object fanout and I/O behavior during backfill.
+			ss = []*Scope{c.newMergeScope(ss)}
+		}
 		return ss, nil
 	}
 
@@ -9291,7 +9312,7 @@ func (c *Compile) compileLock(node *plan.Node, ss []*Scope) ([]*Scope, error) {
 	var err error
 	var lockOpArg *lockop.LockOp
 	lockNode := node
-	if localizeLoadPlan {
+	if localizeLockPlan {
 		localNode := *node
 		localNode.LockTargets = lockRows
 		lockNode = &localNode
@@ -9306,6 +9327,16 @@ func (c *Compile) compileLock(node *plan.Node, ss []*Scope) ([]*Scope, error) {
 	return ss, nil
 }
 
+func (c *Compile) canPrePipelineLockNewTable(target *plan.LockTarget) bool {
+	if c.prePipelineLockTableID == 0 || target.TableId != c.prePipelineLockTableID ||
+		target.Mode != lock.LockMode_Exclusive || target.HasPartitionCol {
+		return false
+	}
+	qry := c.pn.GetQuery()
+	return qry != nil && qry.StmtType == plan.Query_INSERT && !qry.LoadTag &&
+		lockop.SupportsTotalLockTableRange(plan2.MakeTypeByPlan2Type(target.PrimaryColTyp))
+}
+
 func (c *Compile) compileRecursiveCte(node *plan.Node, curNodeIdx int32) ([]*Scope, error) {
 	receivers := make([]*process.WaitRegister, len(node.SourceStep))
 	for i, step := range node.SourceStep {
```

**File**: `pkg/sql/compile/compile_test.go` (modified, +301/-4)
```diff
@@ -149,13 +149,15 @@ func TestCompileClearResetsExecutionType(t *testing.T) {
 	// Exercise the pool reset directly, independent of which object sync.Pool
 	// would choose for the next allocation.
 	c := &Compile{
-		proc:         testutil.NewProcess(t),
-		execType:     plan2.ExecTypeAP_MULTICN,
-		MessageBoard: message.NewMessageBoard(),
-		affectRows:   new(atomic.Uint64),
+		proc:                   testutil.NewProcess(t),
+		execType:               plan2.ExecTypeAP_MULTICN,
+		MessageBoard:           message.NewMessageBoard(),
+		affectRows:             new(atomic.Uint64),
+		prePipelineLockTableID: 42,
 	}
 	c.clear()
 	require.True(t, c.IsTpQuery())
+	require.Zero(t, c.prePipelineLockTableID, "pooled compiles must not retain a backfill lock request")
 }
 
 func TestCompileMongoDBQueryDiagnosticsAreRedacted(t *testing.T) {
@@ -1076,6 +1078,301 @@ func TestCompileLockNonCandidatePreservesExactMainMutation(t *testing.T) {
 	require.Same(t, target, c.lockTables[target.TableId])
 }
 
+func TestCompileLockPrePipelineTargetAdmission(t *testing.T) {
+	for _, tc := range []struct {
+		name      string
+		requestID uint64
+		statement plan.Query_StatementType
+		keyType   types.T
+		mode      lockpb.LockMode
+		partition bool
+		promote   bool
+		load      bool
+	}{
+		{"integer backfill", 42, plan.Query_INSERT, types.T_int64, lockpb.LockMode_Exclusive, false, true, false},
+		{"serialized composite backfill", 42, plan.Query_INSERT, types.T_varchar, lockpb.LockMode_Exclusive, false, true, false},
+		{"ordinary insert", 0, plan.Query_INSERT, types.T_int64, lockpb.LockMode_Exclusive, false, false, false},
+		{"different table", 99, plan.Query_INSERT, types.T_int64, lockpb.LockMode_Exclusive, false, false, false},
+		{"update", 42, plan.Query_UPDATE, types.T_int64, lockpb.LockMode_Exclusive, false, false, false},
+		{"delete", 42, plan.Query_DELETE, types.T_int64, lockpb.LockMode_Exclusive, false, false, false},
+		{"shared ownership", 42, plan.Query_INSERT, types.T_int64, lockpb.LockMode_Shared, false, false, false},
+		{"partitioned target", 42, plan.Query_INSERT, types.T_int64, lockpb.LockMode_Exclusive, true, false, false},
+		{"no total key range", 42, plan.Query_INSERT, types.T_blob, lockpb.LockMode_Exclusive, false, false, false},
+		{"load keeps its own admission", 42, plan.Query_INSERT, types.T_int64, lockpb.LockMode_Exclusive, false, false, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			c := newPrePipelineLockTestCompile(t, tc.statement)
+			c.prePipelineLockTableID = tc.requestID
+			c.pn.GetQuery().LoadTag = tc.load
+			target := &plan.LockTarget{
+				TableId: 42, PrimaryColTyp: plan.Type{Id: int32(tc.keyType)},
+				Mode: tc.mode, HasPartitionCol: tc.partition,
+			}
+			canonical := *target
+			node := &plan.Node{LockTargets: []*plan.LockTarget{target}}
+			scope := &Scope{}
+			got, err := c.compileLock(node, []*Scope{scope})
+			require.NoError(t, err)
+			require.Equal(t, []*Scope{scope}, got)
+			require.Equal(t, []*plan.LockTarget{target}, node.LockTargets)
+			require.Equal(t, canonical, *target, "the request must not rewrite a reusable logical target")
+			if tc.promote {
+				require.Nil(t, scope.RootOp, "no row-key encoder is needed for the pre-locked target")
+				require.Len(t, c.lockTables, 1)
+				physical := c.lockTables[42]
+				require.NotSame(t, target, physical)
+				require.True(t, physical.LockTable)
+				require.False(t, physical.LockTableAtTheEnd)
+				require.Equal(t, tc.mode, physical.Mode)
+			} else {
+				require.Empty(t, c.lockTables)
+				op, ok := scope.RootOp.(*lockop.LockOp)
+				require.True(t, ok, "ineligible targets retain their row lock operator")
+				t.Cleanup(func() { op.Free(c.proc, false, nil); op.Release() })
+				physical := op.CopyToPipelineTarget()
+				require.Len(t, physical, 1)
+				require.Equal(t, uint64(42), physical[0].TableId)
+				require.False(t, physical[0].LockTable)
+				require.False(t, physical[0].LockTableAtTheEnd)
+				require.Equal(t, tc.mode, physical[0].Mode)
+			}
+		})
+	}
+}
+
+func TestCompileLockPrePipelineTargetPreservesOtherRowsAndPlanReuse(t *testing.T) {
+	c := newPrePipelineLockTestCompile(t, plan.Query_INSERT)
+	c.prePipelineLockTableID = 42
+	backfill := &plan.LockTarget{TableId: 42, PrimaryColTyp: plan.Type{Id: int32(types.T_varchar)}}
+	other := &plan.LockTarget{TableId: 43, PrimaryColTyp: plan.Type{Id: int32(types.T_int64)}}
+	node := &plan.Node{LockTargets: []*plan.LockTarget{backfill, other}}
+	canonicalBackfill, canonicalOther := *backfill, *other
+
+	compileRows := func() []*pipeline.LockTarget {
+		t.Helper()
+		scope := &Scope{}
+		_, err := c.compileLock(node, []*Scope{scope})
+		require.NoError(t, err)
+		op, ok := scope.RootOp.(*lockop.LockOp)
+		require.True(t, ok)
+		t.Cleanup(func() { op.Free(c.proc, false, nil); op.Release() })
+		return op.CopyToPipelineTarget()
+	}
+	physical := compileRows()
+	require.Len(t, physical, 1)
+	require.Equal(t, other.TableId, physical[0].TableId)
+	require.False(t, 
```

**File**: `pkg/sql/compile/ddl_index_algo.go` (modified, +10/-3)
```diff
@@ -63,10 +63,16 @@ func (s *Scope) createAndInsertForUniqueOrRegularIndexTable(c *Compile, indexDef
 	if err != nil {
 		return err
 	}
+	// Both callers have just created this hidden target in the current DDL
+	// transaction. indexTableBuild resolves its actual physical ID, so request
+	// one ordinary range lock for that ID rather than preparing every row's
+	// key again during backfill. The base-table lock is not used as proof of
+	// ownership of the new target's keyspace.
+	stmtOpt := executor.StatementOption{}.WithPrePipelineLockTable(indexInfo.GetIndexTables()[0].GetTblId())
 	if indexDef.Unique {
-		return c.precheckAndInsertUniqueIndexTable(qryDatabase, originalTableDef, indexDef, insertSQL)
+		return c.precheckAndInsertUniqueIndexTable(qryDatabase, originalTableDef, indexDef, insertSQL, stmtOpt)
 	}
-	return c.runSql(insertSQL)
+	return c.runSqlWithOptions(insertSQL, stmtOpt)
 }
 
 func buildCreateUniqueIndexDuplicateCheckSQL(dbName string, tableDef *plan.TableDef, indexDef *plan.IndexDef) (string, error) {
@@ -102,6 +108,7 @@ func (c *Compile) precheckAndInsertUniqueIndexTable(
 	tableDef *plan.TableDef,
 	indexDef *plan.IndexDef,
 	insertSQL string,
+	stmtOpt executor.StatementOption,
 ) error {
 	// Unique indexes allow NULL keys, so the check mirrors the hidden-index
 	// backfill filter and only groups non-NULL keys.
@@ -126,7 +133,7 @@ func (c *Compile) precheckAndInsertUniqueIndexTable(
 		TargetTableName: indexDef.IndexTableName,
 		SkipPkDedup:     true,
 	}
-	stmtOpt := executor.StatementOption{}.WithAlterCopyOpt(opt)
+	stmtOpt = stmtOpt.WithAlterCopyOpt(opt)
 
 	restoreCtx := c.proc.Ctx
 	if restoreCtx == nil {
```

**File**: `pkg/sql/compile/sql_executor.go` (modified, +1/-0)
```diff
@@ -578,6 +578,7 @@ func (exec *txnExecutor) Exec(
 	c.ignorePublish = statementOption.IgnorePublish()
 	c.ignoreCheckExperimental = statementOption.IgnoreCheckExperimental()
 	c.disableLock = statementOption.DisableLock()
+	c.prePipelineLockTableID = statementOption.PrePipelineLockTable()
 
 	defer c.Release()
 
```

**File**: `pkg/sql/compile/types.go` (modified, +3/-0)
```diff
@@ -391,6 +391,9 @@ type Compile struct {
 
 	lockMeta   *LockMeta
 	lockTables map[uint64]*plan.LockTarget
+	// prePipelineLockTableID requests normal table-lock admission for one newly
+	// created target of an internal INSERT. It is not a proof of a held lock.
+	prePipelineLockTableID uint64
 	// loadUniqueIndexPromotion is coordinator-local execution state shared only
 	// with physical retry compiles. It is never serialized into a remote scope or
 	// written back into the canonical logical plan.
```

**File**: `pkg/sql/compile/util_index_sql_test.go` (modified, +121/-3)
```diff
@@ -19,12 +19,15 @@ import (
 	"errors"
 	"testing"
 
+	"github.com/golang/mock/gomock"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
 	"github.com/matrixorigin/matrixone/pkg/defines"
+	mock_frontend "github.com/matrixorigin/matrixone/pkg/frontend/test"
 	"github.com/matrixorigin/matrixone/pkg/objectio/ioutil"
+	"github.com/matrixorigin/matrixone/pkg/pb/api"
 	planpb "github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/testutil"
 	"github.com/matrixorigin/matrixone/pkg/util/executor"
@@ -207,7 +210,8 @@ func TestPrecheckAndInsertUniqueIndexTableUsesSkipDedupAndPipelineFlush(t *testi
 		Unique:         true,
 	}
 
-	err := c.precheckAndInsertUniqueIndexTable("test", tableDef, indexDef, insertSQL)
+	err := c.precheckAndInsertUniqueIndexTable("test", tableDef, indexDef, insertSQL,
+		executor.StatementOption{}.WithPrePipelineLockTable(42))
 	require.ErrorIs(t, err, insertErr)
 	require.Equal(t, []string{checkSQL, insertSQL}, spyExec.executedSQLs)
 
@@ -221,6 +225,7 @@ func TestPrecheckAndInsertUniqueIndexTableUsesSkipDedupAndPipelineFlush(t *testi
 	require.NotNil(t, opt)
 	require.True(t, opt.SkipPkDedup)
 	require.Equal(t, indexDef.IndexTableName, opt.TargetTableName)
+	require.Equal(t, uint64(42), spyExec.insertOption.PrePipelineLockTable())
 
 	require.Same(t, topCtx, proc.Ctx)
 	require.NotEqual(t, true, proc.Ctx.Value(ioutil.PipelineFlushKey))
@@ -252,7 +257,8 @@ func TestPrecheckAndInsertUniqueIndexTableRejectsDuplicateBeforeInsert(t *testin
 		Unique:         true,
 	}
 
-	err := c.precheckAndInsertUniqueIndexTable("test", tableDef, indexDef, insertSQL)
+	err := c.precheckAndInsertUniqueIndexTable("test", tableDef, indexDef, insertSQL,
+		executor.StatementOption{}.WithPrePipelineLockTable(42))
 	require.Error(t, err)
 	require.True(t, moerr.IsMoErrCode(err, moerr.ErrDuplicateEntry))
 	require.Contains(t, err.Error(), "Duplicate entry '7' for key '__mo_index_idx_col'")
@@ -290,10 +296,122 @@ func TestPrecheckAndInsertUniqueIndexTableFormatsCompoundDuplicate(t *testing.T)
 		Unique:         true,
 	}
 
-	err := c.precheckAndInsertUniqueIndexTable("test", tableDef, indexDef, insertSQL)
+	err := c.precheckAndInsertUniqueIndexTable("test", tableDef, indexDef, insertSQL,
+		executor.StatementOption{}.WithPrePipelineLockTable(42))
 	require.Error(t, err)
 	require.True(t, moerr.IsMoErrCode(err, moerr.ErrDuplicateEntry))
 	require.Contains(t, err.Error(), "Duplicate entry '(1,2)' for key '__mo_index_idx_col'")
 	require.Equal(t, []string{checkSQL}, spyExec.executedSQLs)
 	require.Nil(t, spyExec.insertCtx)
 }
+
+// Record every substatement, including the duplicate-check SELECT, while
+// reusing the existing executor fixture for errors and duplicate result rows.
+type indexBackfillOptionSpyExecutor struct {
+	*alterCopyInsertSpyExecutor
+	options map[string]executor.StatementOption
+}
+
+func (e *indexBackfillOptionSpyExecutor) Exec(
+	ctx context.Context, sql string, opts executor.Options,
+) (executor.Result, error) {
+	e.options[sql] = opts.StatementOption()
+	return e.alterCopyInsertSpyExecutor.Exec(ctx, sql, opts)
+}
+
+func TestCreateIndexBackfillScopesPrePipelineLockToInsert(t *testing.T) {
+	for _, tc := range []struct {
+		name     string
+		unique   bool
+		targetID uint64
+	}{
+		{"regular", false, 42},
+		{"unique", true, 43},
+		{"unresolved target", false, 0},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			proc := testutil.NewProcess(t)
+			t.Cleanup(proc.Free)
+			c := &Compile{proc: proc, pn: &planpb.Plan{}}
+			tableDef := &planpb.TableDef{
+				Name: "source", TblId: 7,
+				Pkey: &planpb.PrimaryKeyDef{PkeyColName: "id", Names: []string{"id"}},
+			}
+			indexDef := &planpb.IndexDef{
+				IndexName: "ix_value", IndexTableName: "__mo_index_secondary_test",
+				Parts: []string{"value"}, Unique: tc.unique,
+			}
+			indexInfo := &planpb.CreateTable{IndexTables: []*planpb.TableDef{{
+				Name: indexDef.IndexTableName, TblId: tc.targetID,
+			}}}
+			insertSQL, err := genInsertIndexTableSql(tableDef, indexDef, "test", tc.unique)
+			require.NoError(t, err)
+			insertErr := errors.New("injected backfill failure")
+			spy := &indexBackfillOptionSpyExecutor{
+				alterCopyInsertSpyExecutor: &alterCopyInsertSpyExecutor{insertSQL: insertSQL, insertErr: insertErr},
+				options:                    make(map[string]executor.StatementOption),
+			}
+			rt := moruntime.ServiceRuntime(proc.GetService())
+			previous, existed := rt.GetGlobalVariables(moruntime.InternalSQLExecutor)
+			rt.SetGlobalVariables(moruntime.InternalSQLExecutor, spy)
+			t.Cleanup(func() {
+				if existed {
+					rt.SetGlobalVariables(moruntime.InternalSQLExecutor, previous)
+				} else {
+					rt.CompareAndDeleteGlobalVariables(moruntime.InternalSQLExecutor, spy)
+				}
+			})
+			originalCtx := proc.Ctx
+			if tc
```

**File**: `pkg/tests/issues/issue_29602_test.go` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
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
+package issues
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/embed"
+	"github.com/matrixorigin/matrixone/pkg/lockservice"
+	pblock "github.com/matrixorigin/matrixone/pkg/pb/lock"
+	"github.com/matrixorigin/matrixone/pkg/tests/testutils"
+	"github.com/stretchr/testify/require"
+)
+
+func TestIssue29602IndexBackfillLocksStayScopedToPrivateTargets(t *testing.T) {
+	runAuthenticatedClusterTest(t, func(cluster embed.Cluster) {
+		ctx, cancel := context.WithTimeout(t.Context(), 2*time.Minute)
+		defer cancel()
+		open := func(index int) *sql.DB {
+			cn, err := cluster.GetCNService(index)
+			require.NoError(t, err)
+			db, err := sql.Open("mysql", issue27487DSN(cn.GetServiceConfig().CN.Frontend.Port))
+			require.NoError(t, err)
+			t.Cleanup(func() { require.NoError(t, db.Close()) })
+			return db
+		}
+		creatorDB, otherDB := open(0), open(1)
+		database := strings.ToLower(testutils.GetDatabaseName(t))
+		execSQLRequire(t, ctx, creatorDB, "create database `"+database+"`")
+		t.Cleanup(func() {
+			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 20*time.Second)
+			defer cleanupCancel()
+			execSQLRequire(t, cleanupCtx, creatorDB, "drop database if exists `"+database+"`")
+		})
+		creator, err := creatorDB.Conn(ctx)
+		require.NoError(t, err)
+		t.Cleanup(func() { require.NoError(t, creator.Close()) })
+		services := issue27487LockServices(cluster)
+		require.NotEmpty(t, services)
+
+		// All targets use a composite varlen key, including the regular index.
+		// These are the public keyspace endpoints, independent of lockop's fetcher.
+		packer := types.NewPacker()
+		defer packer.Close()
+		packer.EncodeStringType(nil)
+		minKey := packer.Bytes()
+		packer.Reset()
+		packer.EncodeStringTypeMax()
+		maxKey := packer.Bytes()
+
+		for _, tc := range []struct {
+			name       string
+			seed       string
+			unique     bool
+			rollback   bool
+			hiddenRows int
+			matches    int
+		}{
+			{"regular", "(1,10,100),(2,10,100)", false, false, 2, 2},
+			{"composite_unique", "(1,10,100),(2,10,101)", true, false, 2, 1},
+			{"nullable_unique", "(1,10,100),(2,NULL,100),(3,NULL,100)", true, false, 1, 1},
+			{"rollback", "(1,10,100),(2,20,200)", false, true, 2, 1},
+		} {
+			t.Run(tc.name, func(t *testing.T) {
+				table := fmt.Sprintf("`%s`.`%s`", database, tc.name)
+				execSQLRequire(t, ctx, creatorDB, "create table "+table+" (id int primary key, a int, b int)")
+				execSQLRequire(t, ctx, creatorDB, "insert into "+table+" values "+tc.seed)
+				txn, err := creator.BeginTx(ctx, nil)
+				require.NoError(t, err)
+				defer txn.Rollback()
+				kind := ""
+				if tc.unique {
+					kind = "unique "
+				}
+				_, err = txn.ExecContext(ctx, "create "+kind+"index ix_backfill on "+table+" (a,b)")
+				require.NoError(t, err)
+				var hiddenName string
+				var hiddenID uint64
+				require.NoError(t, txn.QueryRowContext(ctx, `select distinct i.index_table_name, h.rel_id
+from mo_catalog.mo_indexes i
+join mo_catalog.mo_tables b on i.table_id = b.rel_id
+join mo_catalog.mo_tables h on h.reldatabase_id = b.reldatabase_id and h.relname = i.index_table_name
+where b.reldatabase = ? and b.relname = ? and i.name = 'ix_backfill'`, database, tc.name).Scan(&hiddenName, &hiddenID))
+				require.NotZero(t, hiddenID)
+				locks := issue29602TargetLocks(services, hiddenID)
+				require.Len(t, locks, 1, "backfill must hold one full target range until transaction completion")
+				require.True(t, locks[0].rangeLock)
+				require.Equal(t, pblock.LockMode_Exclusive, locks[0].mode)
+				require.Equal(t, [][]byte{minKey, maxKey}, locks[0].keys)
+
+				var hiddenRows int
+				require.NoError(t, txn.QueryRowContext(ctx,
+					fmt.Sprintf("select count(*) from `%s`.`%s`", database, hiddenName)).Scan(&hiddenRows))
+				require.Equal(t, tc.hiddenRows, hiddenRows)
+				if tc.rollback {
+					require.NoError(t, txn.Rollback())
+					var published int
+					require.NoError(t, creator.QueryRowContext(ctx,
+						"select count(*) from mo_catalog.mo_tables where rel_id = ?", hiddenID).Scan(&published))
+					require.Zero(t, published, "rollback must remove the private index table")
+					require.NoError(t, creator.QueryRowContext(ctx,
+						"select count(*) from information_schema.s
```

**File**: `pkg/util/executor/options.go` (modified, +13/-0)
```diff
@@ -233,6 +233,19 @@ func (opts StatementOption) AlterCopyDedupOpt() *plan.AlterCopyOpt {
 	return opts.alterCopyOpt
 }
 
+// WithPrePipelineLockTable requests an Exclusive table-range lock before an
+// internal INSERT starts. The caller must own the newly created physical target
+// in the same transaction. This requests normal lock acquisition; it does not
+// assert that the lock is already held or disable locking. Zero means no request.
+func (opts StatementOption) WithPrePipelineLockTable(tableID uint64) StatementOption {
+	opts.prePipelineLockTableID = tableID
+	return opts
+}
+
+func (opts StatementOption) PrePipelineLockTable() uint64 {
+	return opts.prePipelineLockTableID
+}
+
 func (opts StatementOption) AccountID() uint32 {
 	return opts.accountId
 }
```

---

### Incident Patch 15: `fdf96ba0` (2026-10-04)
**Commit Message**: fix(frontend): reuse authorization cache without stale grants (#29596)

## What type of PR is this?

- [x] BUG
- [x] Improvement
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Follow-up to #29532; preserves the authorization and restore fixes
covered by #29399. Rebased onto latest main `ff53ee2eb0c` (includes
#29466).

## What this PR does / why we need it:

#29532 invalidates session privileges at every statement so remote
REVOKE and RESTORE cannot reuse stale grants. That also turns warm TPCC
executions into repeated privilege SQL, planning and compilation. This
change reuses the existing privilege cache only after proving its
authorization catalogs are unchanged at a fresh authorization snapshot.

- Reuse disttae's existing immutable partition watermark, subscription
identity and physical catalog table IDs. No persisted epoch, second
cache, broadcast protocol or worker.
- Reuse existing transaction snapshot/admission rules. Pending
application, reconnect, future/missing catalogs and errors reject cache
reuse. An old user transaction never supplies authorization freshness;
the captured lower bound reaches cache-miss background reads.
- Keep existing authorization/owner

**File**: `docs/design/20261004-authorization-cache-reuse.md` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+# Reuse authorization decisions against current catalog state
+
+Owner: frontend authorization and disttae catalog reads. Follow-up to #29532.
+Initial validation base: `5e965dece9e`; rebased onto `ff53ee2eb0c`.
+
+## Problem and contract
+
+#29532 clears session privileges at every statement to observe remote REVOKE
+and RESTORE. In the TPCC 10/10 comparison of `96196b4a9c` and `ae56c83b62`,
+authorization CPU rises from 23 to 1,025 seconds per five-minute window.
+Repeated catalog SQL adds parsing, planning, compilation and allocation.
+
+Reuse a cached grant only when its catalog dependencies are unchanged at a
+snapshot obtainable by a new authorization transaction. An older data transaction
+snapshot is insufficient. Existing protected-database, view-chain, active-role
+and ownership checks remain the permission decision owners.
+
+## Ownership and validity
+
+Disttae supplies a comparable token for the existing session privilege cache:
+mo_user, mo_role, mo_user_grant, mo_role_grant, mo_role_privs, mo_database and
+mo_tables. The last two cover object ownership and physical catalog table IDs.
+Each entry holds the physical table ID, existing shared-state identity and
+applied logtail watermark. Copies and GC preserve identity; reconstruction does
+not. Tokens retain only tiny identities, never old row/object trees. The applied
+watermark covers row inserts/deletes; the last-flush timestamp does not.
+
+Reject reuse when logtail is not ready. Otherwise acquire a read-only transaction
+through TxnClient.New and close it without workspace, writes or storage commit.
+This reuses existing freshness, admission, cancellation and close ownership;
+it does not claim stronger consistency than current authorization reads.
+Propagate its snapshot lower bound to the session so cache-miss background
+transactions cannot evaluate permissions before the captured token.
+
+Capture only ready subscription states with no pending apply and applied
+watermarks below the exclusive read snapshot. Missing/future catalogs or a
+catalog-generation transition provide no reusable token. Uncertainty clears the
+cache and uses existing authorization SQL; actual snapshot/subscription errors
+propagate. Capture before evaluation: a later commit must invalidate those
+results next time, never stamp them with a newer version.
+
+Role/identity changes, manual clear and cache-mode changes keep their existing
+invalidation. Freshness is checked by the existing privilege and active-role
+consumers, before reading cached decisions. This covers nested SET queries and
+WITH GRANT OPTION without making grant-free controls depend on catalog health.
+Clearing is local; the next authorization revalidates membership in its own RC
+transaction. Ordinary SELECT/UPDATE and bound prepared execution check once;
+transaction controls and Execute shells do not check. Complex multi-object
+operations may require several consuming evaluations.
+
+EXPLAIN authorizes its inner statement. EXPLAIN EXECUTE binding checks the resolved
+AST and plan before releasing the AST. A prepared EXPLAIN EXECUTE rebinds the
+inner mutable handle on execution; its cached query cannot establish that binding.
+Ordinary prepared SELECT/UPDATE retain their plan and compile reuse.
+
+View chains still require metadata checks. Negative lookups allocate nothing;
+positive scopes are capped at 1,024. Table/view scope storage shares one
+implementation; the unused replacement method and unconsumed atomic counters
+are removed.
+
+## Complexity and validation
+
+There is no persistent epoch, wire/config change, broadcaster, worker or second
+permission cache. The hot path exchanges repeated SQL for one read-only snapshot
+and seven catalog lookups. Ordinary data writes preserve the token; unrelated
+metadata changes can conservatively invalidate it. TTL invalidation would permit
+stale grants; an administrator exemption would leave ordinary-user performance
+unfixed and redefine catalog-based authorization.
+
+Main-agent design/self-review: R3 authorization, generation and hot-path changes;
+no subagents. Component tests cover watermark boundaries, pending application,
+reconstruction, failures and scope capacity. Reuse the authenticated two-CN
+fixture for text/SQL-prepared/binary-prepared queries, remote revoke/regrant,
+role switching, old data transactions, DROP/recreate and cancellation. The six
+existing #29399 restore/PITR tests retain their original behavioral oracles.
+
+## Local performance boundary
+
+Same-base one-row workload, three rounds of 1,500 prepared point reads and 300
+BEGIN / SELECT FOR UPDATE / UPDATE / COMMIT transactions. Median microseconds:
+
+| Workload | Per-statement clear | Unsafe reuse control | This change |
+|---|---:|---:|---:|
+| Admin point | 336 | 152 | 149 |
+| Ordinary point | 1,413 | 156 | 173 |
+| Admin transaction | 5,994 | 5,879 | 5,596 |
+| Ordinary transaction | 8,907 | 5,767 | 5,625 |
+
+The unsafe control disables fre
```

**File**: `pkg/frontend/authenticate.go` (modified, +58/-76)
```diff
@@ -74,6 +74,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/util/trace"
 	"github.com/matrixorigin/matrixone/pkg/util/trace/impl/motrace"
 	"github.com/matrixorigin/matrixone/pkg/util/trace/impl/motrace/statistic"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/disttae"
 )
 
 type TenantInfo struct {
@@ -2648,6 +2649,8 @@ const (
 
 // privilegeCache cache privileges on table
 type privilegeCache struct {
+	catalogVersion disttae.PrivilegeCacheVersion
+	cachedScopes   int
 	// For objectType table
 	// For objectType table *, *.*
 	storeForTable [int(privilegeLevelEnd)]btree.Set[PrivilegeType]
@@ -2669,8 +2672,6 @@ type privilegeCache struct {
 	storeForDatabase2 btree.Map[string, *btree.Set[PrivilegeType]]
 	// For objectType account *
 	storeForAccount [int(privilegeLevelEnd)]btree.Set[PrivilegeType]
-	total           atomic.Uint64
-	hit             atomic.Uint64
 
 	// The active primary role is session state, while its grant to the user is
 	// catalog state. Keep the validation in the same cache generation as the
@@ -2738,70 +2739,38 @@ func (pc *privilegeCache) setActiveRoleGrantForGeneration(
 
 // has checks the cache has privilege on a table
 func (pc *privilegeCache) has(objTyp objectType, plt privilegeLevelType, dbName, tableName string, priv PrivilegeType) bool {
-	pc.total.Add(1)
-	privSet := pc.getPrivilegeSet(objTyp, plt, dbName, tableName)
+	privSet := pc.getPrivilegeSet(objTyp, plt, dbName, tableName, false)
 	if privSet != nil {
 		for _, p := range privilegeTypeWithCoveringPrivileges(objTyp, priv) {
 			if privSet.Contains(p) {
-				pc.hit.Add(1)
 				return true
 			}
 		}
 	}
 	return false
 }
 
-func (pc *privilegeCache) getPrivilegeSet(objTyp objectType, plt privilegeLevelType, dbName, tableName string) *btree.Set[PrivilegeType] {
+// Only successful grants allocate a scoped entry. Negative lookups are read-only.
+// Bound the retained scope count independently of catalog/connection lifetime.
+const maxPrivilegeCacheScopes = 1024
+
+func (pc *privilegeCache) getPrivilegeSet(objTyp objectType, plt privilegeLevelType, dbName, tableName string, create bool) *btree.Set[PrivilegeType] {
+	var databases *btree.Map[string, *btree.Set[PrivilegeType]]
+	var relations *btree.Map[string, *btree.Map[string, *btree.Set[PrivilegeType]]]
 	switch objTyp {
-	case objectTypeTable:
-		switch plt {
-		case privilegeLevelStarStar, privilegeLevelStar:
-			return &pc.storeForTable[plt]
-		case privilegeLevelDatabaseStar:
-			dbStore, ok1 := pc.storeForTable2.Get(dbName)
-			if !ok1 {
-				dbStore = &btree.Set[PrivilegeType]{}
-				pc.storeForTable2.Set(dbName, dbStore)
-			}
-			return dbStore
-		case privilegeLevelDatabaseTable, privilegeLevelTable:
-			tableStore, ok1 := pc.storeForTable3.Get(dbName)
-			if !ok1 {
-				tableStore = &btree.Map[string, *btree.Set[PrivilegeType]]{}
-				pc.storeForTable3.Set(dbName, tableStore)
-			}
-			privSet, ok2 := tableStore.Get(tableName)
-			if !ok2 {
-				privSet = &btree.Set[PrivilegeType]{}
-				tableStore.Set(tableName, privSet)
-			}
-			return privSet
-		default:
-			return nil
+	case objectTypeTable, objectTypeView:
+		levels := &pc.storeForTable
+		databases, relations = &pc.storeForTable2, &pc.storeForTable3
+		if objTyp == objectTypeView {
+			levels = &pc.storeForView
+			databases, relations = &pc.storeForView2, &pc.storeForView3
 		}
-	case objectTypeView:
 		switch plt {
 		case privilegeLevelStarStar, privilegeLevelStar:
-			return &pc.storeForView[plt]
+			return &levels[plt]
 		case privilegeLevelDatabaseStar:
-			dbStore, ok1 := pc.storeForView2.Get(dbName)
-			if !ok1 {
-				dbStore = &btree.Set[PrivilegeType]{}
-				pc.storeForView2.Set(dbName, dbStore)
-			}
-			return dbStore
+			relations = nil
 		case privilegeLevelDatabaseTable, privilegeLevelTable:
-			viewStore, ok1 := pc.storeForView3.Get(dbName)
-			if !ok1 {
-				viewStore = &btree.Map[string, *btree.Set[PrivilegeType]]{}
-				pc.storeForView3.Set(dbName, viewStore)
-			}
-			privSet, ok2 := viewStore.Get(tableName)
-			if !ok2 {
-				privSet = &btree.Set[PrivilegeType]{}
-				viewStore.Set(tableName, privSet)
-			}
-			return privSet
 		default:
 			return nil
 		}
@@ -2810,12 +2779,7 @@ func (pc *privilegeCache) getPrivilegeSet(objTyp objectType, plt privilegeLevelT
 		case privilegeLevelStar, privilegeLevelStarStar:
 			return &pc.storeForDatabase[plt]
 		case privilegeLevelDatabase:
-			dbStore, ok1 := pc.storeForDatabase2.Get(dbName)
-			if !ok1 {
-				dbStore = &btree.Set[PrivilegeType]{}
-				pc.storeForDatabase2.Set(dbName, dbStore)
-			}
-			return dbStore
+			databases = &pc.storeForDatabase2
 		default:
 			return nil
 		}
@@ -2824,23 +2788,38 @@ func (pc *privilegeCache) getPrivilegeSet(objTyp objectType, plt privilegeLevelT
 	default:
 		return nil
 	}
-
-}
-
-// set replaces the privileges by new ones
-func (pc *privilegeCache) set(objTyp objectType, plt privilegeLevelType, dbName, tableName string, priv ...PrivilegeType) {
-	privSet := pc.getPrivilegeSet(objTyp
```

**File**: `pkg/frontend/authenticate_test.go` (modified, +62/-119)
```diff
@@ -2678,10 +2678,10 @@ func Test_determineGrantPrivilege(t *testing.T) {
 				UserID:        1001,
 				DefaultRoleID: 1001,
 			}
-			ses.markActiveRoleGrantValid()
 			ses.SetDatabaseName("db")
 			//TODO: make sql2result
 			bh.init()
+			bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 			// Mock getDatabaseOrTableId for scoped levels.
 			if stmt.Level.Level == tree.PRIVILEGE_LEVEL_TYPE_STAR ||
@@ -2856,10 +2856,10 @@ func Test_determineGrantPrivilege(t *testing.T) {
 				UserID:        1001,
 				DefaultRoleID: 1001,
 			}
-			ses.markActiveRoleGrantValid()
 			ses.SetDatabaseName("db")
 			//TODO: make sql2result
 			bh.init()
+			bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 			// Mock getDatabaseOrTableId for scoped levels.
 			if stmt.Level.Level == tree.PRIVILEGE_LEVEL_TYPE_STAR ||
@@ -3007,8 +3007,8 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		checkSql, err := getSqlForCheckDatabase(ses.GetTxnHandler().GetTxnCtx(), "db")
 		convey.So(err, convey.ShouldBeNil)
@@ -3064,9 +3064,9 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		ctx := ses.GetTxnHandler().GetTxnCtx()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		checkTableSql, err := getSqlForCheckDatabaseTable(ctx, "db", "t1")
 		convey.So(err, convey.ShouldBeNil)
@@ -3127,9 +3127,9 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		ctx := ses.GetTxnHandler().GetTxnCtx()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		privType, err := convertAstPrivilegeTypeToPrivilegeType(context.TODO(), stmt.Privileges[0].Type, stmt.ObjType)
 		convey.So(err, convey.ShouldBeNil)
@@ -3182,9 +3182,9 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		ctx := ses.GetTxnHandler().GetTxnCtx()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		privType, err := convertAstPrivilegeTypeToPrivilegeType(context.TODO(), stmt.Privileges[0].Type, stmt.ObjType)
 		convey.So(err, convey.ShouldBeNil)
@@ -3238,8 +3238,8 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		checkSql, err := getSqlForCheckDatabase(ses.GetTxnHandler().GetTxnCtx(), "db1")
 		convey.So(err, convey.ShouldBeNil)
@@ -3299,9 +3299,9 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		ctx := ses.GetTxnHandler().GetTxnCtx()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		checkTableSql, err := getSqlForCheckDatabaseTable(ctx, "db1", "t1")
 		convey.So(err, convey.ShouldBeNil)
@@ -3368,9 +3368,9 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		ctx := ses.GetTxnHandler().GetTxnCtx()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		checkViewSql, err := getSqlForCheckDatabaseView(ctx, "db", "v1")
 		convey.So(err, convey.ShouldBeNil)
@@ -3445,9 +3445,9 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		ctx := ses.GetTxnHandler().GetTxnCtx()
 		bh.init()
+		bh.sql2result[getSqlForCheckUserGrantForAuthorization(1001, 1001)] = newMrsForCheckUserGrant([][]interface{}{{int64(1001), int64(1001), false}})
 
 		checkViewSql, err := getSqlForCheckDatabaseView(ctx, "db", "v2")
 		require.NoError(t, err)
@@ -3522,9 +3522,9 @@ func Test_determineGrantPrivilege(t *testing.T) {
 			UserID:        1001,
 			DefaultRoleID: 1001,
 		}
-		ses.markActiveRoleGrantValid()
 		ctx := ses.GetTxnHandle
```

**File**: `pkg/frontend/compiler_context.go` (modified, +8/-0)
```diff
@@ -188,6 +188,14 @@ func (tcc *TxnCompilerContext) InitExecuteStmtParam(execPlan *plan.Execute) (*pl
 		execPlan,
 		"",
 	)
+	if err == nil && !tcc.execCtx.ses.IsBackgroundSession() {
+		// EXPLAIN delegates EXECUTE binding here rather than through the ordinary
+		// Execute wrapper. Authorize the resolved AST before releasing ownership.
+		authStats, authErr := authenticateUserCanExecutePrepareOrExecute(
+			tcc.execCtx.reqCtx, owner, st, p, tcc.execCtx.effectiveTxnDefaultDatabase)
+		statistic.StatsInfoFromContext(tcc.execCtx.reqCtx).PermissionAuth.Add(&authStats)
+		err = authErr
+	}
 	if owned && st != nil {
 		st.Free()
 		st = nil
```

**File**: `pkg/frontend/computation_wrapper.go` (modified, +7/-0)
```diff
@@ -1331,6 +1331,13 @@ func initExecuteStmtParamWithResolverInSession(
 	if validateNamedSnapshots {
 		change = true
 	}
+	// A prepared EXPLAIN EXECUTE embeds another mutable prepared handle. Its
+	// cached query alone cannot prove the current AST/plan binding or grants.
+	if inner := unwrapExecutableExplainStatement(prepareStmt.PrepareStmt); inner != prepareStmt.PrepareStmt {
+		if _, execute := inner.(*tree.Execute); execute {
+			change = true
+		}
+	}
 	rebuildEveryExecute := shouldRebuildPreparePlan(false, executionPlan)
 	schemaChanged, schemasValidated, err := validateCapturedPrepareSchemas(
 		owner.GetAccountId(), preparePlan.GetSchemas(), resolve, catalogCache,
```

**File**: `pkg/frontend/mysql_cmd_executor.go` (modified, +1/-14)
```diff
@@ -1768,14 +1768,6 @@ func doSetVar(
 					if cache != nil {
 						cache.invalidate()
 					}
-					// Clearing the cache is also the explicit synchronization point
-					// for externally changed role membership. Refresh it now, outside
-					// the caller's transaction snapshot, instead of allowing the next
-					// authorization check to repopulate the cache from stale state.
-					_, _, err = validateActiveRoleGrantForAuthorization(execCtx.reqCtx, ses)
-					if err != nil {
-						return err
-					}
 				}
 				err = setVarFunc(assign.System, assign.Global, name, value, sql)
 				if err != nil {
@@ -4860,12 +4852,6 @@ func authenticateUserCanExecuteStatement(reqCtx context.Context, ses *Session, s
 	var stats statistic.StatsArray
 	stats.Reset()
 
-	// Cache grants only within one statement. A session-local cache cannot
-	// observe REVOKE or RESTORE committed by another connection or another CN.
-	if cache := ses.GetPrivilegeCache(); cache != nil {
-		cache.invalidate()
-	}
-
 	reqCtx, span := trace.Debug(reqCtx, "authenticateUserCanExecuteStatement")
 	defer span.End()
 	if getPu(ses.GetService()).SV.SkipCheckPrivilege {
@@ -4950,6 +4936,7 @@ func authenticateCanExecuteStatementAndPlan(reqCtx context.Context, ses *Session
 	if ses.skipAuthForSpecialUser() {
 		return stats, nil
 	}
+	stmt = unwrapExecutableExplainStatement(stmt)
 	yes, delta, err := authenticateUserCanExecuteStatementWithObjectTypeDatabaseAndTable(reqCtx, ses, stmt, p)
 	if err != nil {
 		return stats, err
```

**File**: `pkg/frontend/privilege_cache.go` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
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
+
+	"github.com/matrixorigin/matrixone/pkg/vm/engine"
+	"github.com/matrixorigin/matrixone/pkg/vm/engine/disttae"
+)
+
+func (ses *Session) refreshPrivilegeCache(ctx context.Context) error {
+	cache := ses.GetPrivilegeCache()
+	if cache == nil {
+		return nil
+	}
+	if enabled, err := privilegeCacheIsEnabled(ctx, ses); err != nil || !enabled {
+		cache.invalidate()
+		return err
+	}
+	pu := getPuIfPresent(ses.GetService())
+	if pu == nil || ses.GetTenantInfo() == nil {
+		cache.invalidate()
+		return nil
+	}
+	storage := pu.StorageEngine
+	if wrapped, ok := storage.(*engine.EntireEngine); ok {
+		storage = wrapped.Engine
+	}
+	eng, ok := storage.(*disttae.Engine)
+	if !ok {
+		// Engines without a catalog-version proof retain statement-local grants.
+		cache.invalidate()
+		return nil
+	}
+	version, minimum, err := eng.GetPrivilegeCacheVersion(
+		ctx, ses.GetTenantInfo().GetTenantID(), ses.getLastCommitTS())
+	if err != nil {
+		cache.invalidate()
+		return err
+	}
+	ses.updateLastCommitTS(minimum)
+	if version == (disttae.PrivilegeCacheVersion{}) || version != cache.catalogVersion {
+		cache.invalidate()
+		// Capture before evaluation. A concurrent later commit must invalidate
+		// the results next time, not be stamped onto an older authorization read.
+		cache.catalogVersion = version
+	}
+	return nil
+}
```

**File**: `pkg/frontend/routine_test.go` (modified, +6/-1)
```diff
@@ -1128,7 +1128,7 @@ func TestMigrateConnectionFromMarksTypedSystemSnapshotTooLargeForLegacyReplay(t
 	require.True(t, resp.SystemVariablesReplayable)
 }
 
-func TestClearPrivilegeCacheRefreshesActiveRoleGrant(t *testing.T) {
+func TestClearPrivilegeCacheDefersActiveRoleValidation(t *testing.T) {
 	for _, tc := range []struct {
 		name       string
 		catalogErr error
@@ -1174,6 +1174,11 @@ func TestClearPrivilegeCacheRefreshesActiveRoleGrant(t *testing.T) {
 			stmt, err := parsers.ParseOne(ctx, dialect.MYSQL, "set session clear_privilege_cache = on", 1)
 			require.NoError(t, err)
 			err = doSetVar(ses, newTestExecCtx(ctx, ctrl), stmt.(*tree.SetVar), "", false)
+			require.NoError(t, err)
+			require.Empty(t, bh.executedSQLs, "clearing must not read the catalog")
+			_, cached := ses.GetPrivilegeCache().getActiveRoleGrant(2, 3)
+			require.False(t, cached)
+			_, _, err = validateActiveRoleGrantForAuthorization(ctx, ses)
 			require.True(t, forcedPessimisticRC)
 			require.Contains(t, bh.executedSQLs, roleGrantSQL)
 			if tc.catalogErr != nil {
```

#### Recent Merged Pull Requests:
- **PR #29635** (2026-10-05): fix(cdc): repair default internal principal without relaxing authorization (@LeftHandCold)
- **PR #29632** (2026-10-05): fix(plan): retain prepared NTILE integer context for text parameters (@LeftHandCold)
- **PR #29629** (2026-10-05): test: make process fixture resource ownership explicit (@XuPeng-SH)
- **PR #29628** (2026-10-05): test(function): consolidate string clock grammar coverage (@XuPeng-SH)
- **PR #29626** (2026-10-05): refactor(function): retire duplicate unary execution paths (@XuPeng-SH)
- **PR #29625** (2026-10-05): fix: preserve prepared ROUND/TRUNCATE input before output CAST (@LeftHandCold)
- **PR #29624** (2026-10-05): refactor(function): consolidate strict binary execution and retire XOR factory (@XuPeng-SH)
- **PR #29622** (2026-10-05): refactor(readutil): retire obsolete PK extraction and conversion paths (@XuPeng-SH)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
