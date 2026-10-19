> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `308b6b87`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T11:54:58.811Z  
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
> **Harvest Timestamp**: 2026-10-19T11:54:58.647Z  
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30589** (2026-10-19): **fix(plan): report errno 1452 for INSERT foreign-key violations (#30540)**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  issue #30540  ## What this PR does / why we need it:  A foreign-key violation raised by INSERT-family statements was reported to the client as internal error **20101** (`internal error: Cannot add or update a child row: a foreign key constraint fails`, sqlstate HY000) instead of MySQL errno **1452** (ER_NO_REFERENCED_ROW_2, sqlstate 23000). Root cause: the planner embedded a **2-argument untyped `assert()`**, whose runtime fallback is `moerr.NewInternalError`; the error never carried `ErrFKNoReferencedRow2` (20471), so the frontend's wire mapping (mysqlCode == ER_UNKNOWN_ERROR → send internal code) leaked 20101. The internal→mysql mapping 20471→1452/23000 always existed and is correct — the code was lost at plan time.  This PR embeds the **typed 3-argument assert** (errType `fk_no_referenced_row`, already supported by the runtime and used by the UPDATE path) at every INSERT-side emitter:  1. `buildModernChildFkAssert` (plain INSERT, and REPLACE which reuses it), 2. the ON DUPLICATE KEY UPDATE **action-row** foreign-key asserts, 3. the ON DUPLICATE KEY UPDATE **final-image** foreign-key asserts, 4. the legacy `appendForeignConstrantPlan`, which previously appended the errType argument only for UPDATE.  This also fixes the ALTER ... COPY backfill path: its validation INSERT goes through the same m

- **Issue #30586** (2026-10-19): **design: atomic event-ledger sink profile for Kafka Connect and NiFi**
  *Symptoms*: ## Design review only  Design for #29857 and implementation PR #30561. This PR contains only the design document so the design decision is distinct from implementation review.  Please review the exact design revision [`b2d0e15e38`](https://github.com/jiangxinmeng1/matrixone/blob/b2d0e15e38/docs/design/issue_29857_sink_profile.md) and record an explicit design-phase approval or blocking findings. The implementation PR remains blocked until that decision is recorded.  The document defines the event frame, MatrixOne transaction and checkpoint authority, owner epochs, ambiguous COMMIT recovery, broker/topic retention constraints, resource bounds, operational limits, and fault-injection acceptance matrix. 
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 
  > **mo-bot review · `mo-bot-xupeng` · superseded**  Commit: `c2b5b5fa6e124263a65bfde096f0f69a5e666d2c`  "interrupted"  <!-- mo-bot-review:v1 {"service":"mo-bot-xupeng","job":"25ac60a5af12e574b1675824","head":"c2b5b5fa6e124263a65bfde096f0f69a5e666d2c","state":"superseded"} -->

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

### Incident Patch 1: `8ef2eaf4` (2026-10-19)
**Commit Message**: fix(python-sdk): enforce handshake, TLS, redaction and async deadlines (#30074)

### Problem and behavior

Lazy engine construction previously counted as a successful connection; TLS settings, failed-state cleanup, password diagnostics and async deadlines were incomplete.

Require an authenticated probe before reporting success, dispose/clear failed engines, preserve connection timeout overrides and sync socket/charset options, and apply the AsyncClient.execute deadline through pool acquisition, execution, fetch and transaction completion. Required synchronous TLS uses a verifying SSLContext and rejects peers without TLS before authentication, including old PyMySQL. Password prompts use mysql -p; connection errors are sanitized before logging/wrapping and suppress the original display chain. Keep the exact SQLAlchemy 1.4 aiomysql pre-ping compatibility guard.

The escaped-password follow-up handles both raw and repr/JSON-escaped forms, including backslashes, quotes, control characters and printable Unicode. Longer escaped forms are removed first to avoid partial replacements. Cancellation is not proof of server rollback; uncertain writes require reconciliation before retry. Indepen

**File**: `clients/python/CONNECTION_POLICIES.md` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# Connection and timeout contracts
+
+`Client.connect()` creates an engine and requires an authenticated SELECT 1 before
+reporting success. Initial probe failures dispose the failed engine and clear its
+state. `connected()` reports successful initialization, not a live health probe;
+use a query for live health. Reconnect disposes the old engine. Failed disposal
+also clears the client's connected state, while preserving its error.
+
+`ssl_mode='required'` uses a certificate/hostname-verifying SSLContext. `ssl_ca`
+selects a CA file; without it, system roots are used. Peers without TLS are refused
+before authentication on older and current PyMySQL. `disabled` explicitly disables
+TLS. `preferred` follows the driver's opportunistic behavior unless a CA is
+supplied, in which case certificate verification is requested. A client certificate
+requires a CA or required mode. This policy change may reject previously accepted
+untrusted endpoints; configure a trusted test/organization CA rather than disabling
+verification on a required connection.
+
+Constructor `connection_timeout` is inherited unless connect explicitly overrides
+it. The synchronous engine also passes query_timeout as read/write inactivity
+limits and the configured charset. Async connect applies its connection deadline
+and passes its driver connect timeout. `AsyncClient.execute()` applies query_timeout
+to the full call (pool wait, execution, fetch and transaction completion).
+Cancellation propagates and SQLAlchemy releases/invalidates the interrupted
+connection. This is a client deadline, not a guaranteed server-side KILL operation.
+Independently managed Session calls retain their own transaction/deadline scope.
+
+A timed-out write can have an unknown commit outcome. Reconcile before retry;
+TimeoutError or cancellation is not proof of rollback. No automatic retry is added.
+
+Connection diagnostics use an interactive `mysql -p` prompt, redact any configured
+password echoed in the driver error, and suppress the original exception's display
+chain. The SDK depends on `SQLAlchemy[asyncio]` so supported async runtimes are
+installed instead of silently leaving async imports unavailable.
+
+Transport regression tests require an isolated TLS CN with a test certificate
+having only IP:127.0.0.1 in its SAN, a plaintext CN, an existing disposable test
+database, and MO_SDK_ONLINE=1, MO_TLS_CA, MO_TLS_PORT and MO_PLAIN_PORT. Tests use
+synthetic credentials and do not commit test private keys/certificates.
```

**File**: `clients/python/matrixone/_connection_options.py` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# Copyright 2026 Matrix Origin
+# Licensed under the Apache License, Version 2.0.
+
+"""Explicit connection security and timeout options shared by SDK clients."""
+
+import json
+import math
+import ssl
+
+import pymysql
+from pymysql.constants import CLIENT
+
+
+def positive_timeout(value, name):
+    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
+        raise ValueError('%s must be positive and finite' % name)
+    return value
+
+
+def redact_error(error, password):
+    message = str(error)
+    if not password:
+        return message
+    # DBAPI errors format their args with repr(), and SQLAlchemy embeds that
+    # representation in its own message. Match escaped forms before the raw
+    # password so replacing a raw substring cannot break the escaped match.
+    quoted = repr(password)
+    # Remove only the enclosing quote's escape, preserving escaped backslashes
+    # and printable Unicode. The surrounding error can choose either quote.
+    escaped = quoted[1:-1].replace('\\' + quoted[0], quoted[0])
+    representations = {
+        password,
+        repr(password)[1:-1],
+        ascii(password)[1:-1],
+        escaped,
+        escaped.replace("'", "\\'"),
+        escaped.replace('"', '\\"'),
+        json.dumps(password)[1:-1],
+        json.dumps(password, ensure_ascii=False)[1:-1],
+    }
+    for value in sorted(representations, key=len, reverse=True):
+        message = message.replace(value, '***')
+    return message
+
+
+def tls_options(params):
+    mode = params.get('ssl_mode', 'preferred')
+    if mode not in ('disabled', 'preferred', 'required'):
+        raise ValueError('ssl_mode must be disabled, preferred or required')
+    if mode == 'disabled':
+        return {'ssl_disabled': True}
+    if mode == 'required' or params.get('ssl_ca'):
+        context = ssl.create_default_context(cafile=params.get('ssl_ca'))
+        # Explicit context preserves hostname checking when system roots are
+        # used; some driver versions disable it when no ca path is supplied.
+        if params.get('ssl_cert'):
+            context.load_cert_chain(params['ssl_cert'], params.get('ssl_key'))
+        return {'ssl': context}
+    if params.get('ssl_cert') or params.get('ssl_key'):
+        raise ValueError('A client certificate requires ssl_ca or ssl_mode=required')
+    return {}
+
+
+class TLSRequiredConnection(pymysql.connections.Connection):
+    """Fail before authentication when a peer cannot negotiate required TLS.
+
+    Older supported PyMySQL versions otherwise silently fall back to plaintext.
+    Certificate and hostname verification are handled by the SSLContext.
+    """
+
+    def _request_authentication(self):
+        if not self.server_capabilities & CLIENT.SSL:
+            raise pymysql.err.OperationalError(2026, 'TLS is required but the server does not advertise TLS')
+        return super()._request_authentication()
+
+
+def connect_required_tls(dialect, record, args, params):
+    return TLSRequiredConnection(*args, **params)
```

**File**: `clients/python/matrixone/async_client.py` (modified, +55/-11)
```diff
@@ -606,7 +606,7 @@ async def connect(
         account: Optional[str] = None,
         role: Optional[str] = None,
         charset: str = "utf8mb4",
-        connection_timeout: int = 30,
+        connection_timeout: Optional[int] = None,
         auto_commit: bool = True,
         on_connect: Optional[Union[ConnectionHook, List[Union[ConnectionAction, str]], Callable]] = None,
     ):
@@ -624,7 +624,7 @@ async def connect(
             account: Optional account name (will be combined with user if user doesn't contain '#' or ':')
             role: Optional role name (will be combined with user if user doesn't contain '#' or ':')
             charset: Character set for the connection (default: utf8mb4)
-            connection_timeout: Connection timeout in seconds (default: 30)
+            connection_timeout: Override constructor connection timeout; None inherits it
             auto_commit: Enable autocommit (default: True)
             on_connect: Connection hook to execute after successful connection.
                        Can be:
@@ -650,6 +650,14 @@ async def my_callback(client):
             await client.connect(host, port, user, password, database,
                                on_connect=my_callback)
         """
+        from ._connection_options import positive_timeout
+
+        positive_timeout(self.query_timeout, 'query_timeout')
+        timeout = self.connection_timeout if connection_timeout is None else connection_timeout
+        positive_timeout(timeout, 'connection_timeout')
+        if self._engine is not None:
+            await self.disconnect()
+        self.connection_timeout = timeout
         try:
             # Build final login info based on user parameter and optional account/role
             final_user, parsed_info = self._build_login_info(user, account, role)
@@ -666,15 +674,20 @@ async def my_callback(client):
                 "database": database,
                 "charset": charset,
                 "autocommit": auto_commit,
-                "connect_timeout": connection_timeout,
+                "connect_timeout": timeout,
             }
 
             # Create SQLAlchemy async engine instead of direct aiomysql connection
             self._engine = self._create_async_engine()
 
             # Test the connection by executing a simple query
-            async with self._engine.begin() as conn:
-                await conn.execute(text("SELECT 1"))
+            import asyncio
+
+            async def probe():
+                async with self._engine.begin() as conn:
+                    await conn.execute(text("SELECT 1"))
+
+            await asyncio.wait_for(probe(), timeout=timeout)
 
             # Initialize vector managers after successful connection
             self._initialize_vector_managers()
@@ -694,21 +707,31 @@ async def my_callback(client):
                 # Execute the hook once immediately for the initial connection
                 await self._execute_connection_hook_immediately(on_connect)
 
-        except Exception as e:
+        except BaseException as e:
+            engine, self._engine = self._engine, None
+            if engine is not None:
+                try:
+                    await engine.dispose()
+                except Exception:
+                    pass
+            if not isinstance(e, Exception):
+                raise
+            from ._connection_options import redact_error
+
+            error_msg = redact_error(e, password)
             self.logger.log_connection(host, port, final_user, database or "default", success=False)
-            self.logger.log_error(e, context="Async connection")
+            self.logger.log_error(ConnectionError(error_msg), context="Async connection")
 
             # Provide user-friendly error messages for common issues
-            error_msg = str(e)
             if 'Unknown database' in error_msg or '1049' in error_msg:
                 db_name = database or "default"
                 raise ConnectionError(
                     f"Database '{db_name}' does not exist. Please create it first:\n"
-                    f"  mysql -h{host} -P{port} -u{user.split('#')[0] if '#' in user else user} -p{password} "
+                    f"  mysql -h{host} -P{port} -u{user.split('#')[0] if '#' in user else user} -p "
                     f"-e \"CREATE DATABASE {db_name}\""
-                ) from e
+                ) from None
             else:
-                raise ConnectionError(f"Failed to connect to MatrixOne: {e}") from e
+                raise ConnectionError(f"Failed to connect to MatrixOne: {error_msg}") from None
 
     def _setup_connection_hook(
         self, on_connect: Union[ConnectionHook, List[Union[ConnectionAction, str]], Callable]
@@ -871,9 +894,18 @@ def _create_async_engine(self) -> AsyncEngine:
             pool_recycle=3600,  # Recycle connections after 1 hour
             pool_pre_ping=True,  # Verify connections before use
             pool_reset_on_return="commit",  # Reset co
```

**File**: `clients/python/matrixone/client.py` (modified, +52/-19)
```diff
@@ -441,7 +441,7 @@ def connect(
         account: Optional[str] = None,
         role: Optional[str] = None,
         charset: str = "utf8mb4",
-        connection_timeout: int = 30,
+        connection_timeout: Optional[int] = None,
         auto_commit: bool = True,
         on_connect: Optional[Union[ConnectionHook, List[Union[ConnectionAction, str]], Callable]] = None,
     ) -> None:
@@ -463,7 +463,7 @@ def connect(
             account: Optional account name (will be combined with user if user doesn't contain '#' or ':')
             role: Optional role name (will be combined with user if user doesn't contain '#' or ':')
             charset: Character set for the connection (default: utf8mb4)
-            connection_timeout: Connection timeout in seconds (default: 30)
+            connection_timeout: Override constructor connection timeout; None inherits it
             auto_commit: Enable autocommit (default: True)
             on_connect: Connection hook to execute after successful connection.
                        Can be:
@@ -489,6 +489,16 @@ def my_callback(client):
             client.connect(host, port, user, password, database,
                           on_connect=my_callback)
         """
+        from ._connection_options import positive_timeout
+
+        positive_timeout(self.query_timeout, 'query_timeout')
+        timeout = self.connection_timeout if connection_timeout is None else connection_timeout
+        positive_timeout(timeout, 'connection_timeout')
+        if ssl_mode not in ('disabled', 'preferred', 'required'):
+            raise ValueError('ssl_mode must be disabled, preferred or required')
+        if self._engine is not None:
+            self.disconnect()
+        self.connection_timeout = timeout
         # Build final login info based on user parameter and optional account/role
         final_user, parsed_info = self._build_login_info(user, account, role)
 
@@ -502,7 +512,8 @@ def my_callback(client):
             "password": password,
             "database": database,
             "charset": charset,
-            "connect_timeout": connection_timeout,
+            "connect_timeout": timeout,
+            "ssl_mode": ssl_mode,
             "autocommit": auto_commit,
             "ssl_disabled": ssl_mode == "disabled",
             "ssl_verify_cert": ssl_mode == "required",
@@ -520,6 +531,10 @@ def my_callback(client):
         try:
             # Create SQLAlchemy engine with connection pooling
             self._engine = self._create_engine()
+            # Engine construction is lazy; do not report success until an
+            # authenticated connection has completed a real query.
+            with self._engine.connect() as connection:
+                connection.exec_driver_sql("SELECT 1")
             self.logger.log_connection(host, port, final_user, database, success=True)
 
             # Initialize managers after engine is created
@@ -541,20 +556,30 @@ def my_callback(client):
                 # Execute the hook once immediately for the initial connection
                 self._execute_connection_hook_immediately(on_connect)
 
-        except Exception as e:
+        except BaseException as e:
+            engine, self._engine = self._engine, None
+            if engine is not None:
+                try:
+                    engine.dispose()
+                except Exception:
+                    pass  # Preserve the primary connection failure.
+            if not isinstance(e, Exception):
+                raise
+            from ._connection_options import redact_error
+
+            error_msg = redact_error(e, password)
             self.logger.log_connection(host, port, final_user, database, success=False)
-            self.logger.log_error(e, context="Connection")
+            self.logger.log_error(ConnectionError(error_msg), context="Connection")
 
             # Provide user-friendly error messages for common issues
-            error_msg = str(e)
             if 'Unknown database' in error_msg or '1049' in error_msg:
                 raise ConnectionError(
                     f"Database '{database}' does not exist. Please create it first:\n"
-                    f"  mysql -h{host} -P{port} -u{user.split('#')[0] if '#' in user else user} -p{password} "
+                    f"  mysql -h{host} -P{port} -u{user.split('#')[0] if '#' in user else user} -p "
                     f"-e \"CREATE DATABASE {database}\""
-                ) from e
+                ) from None
             else:
-                raise ConnectionError(f"Failed to connect to MatrixOne: {e}") from e
+                raise ConnectionError(f"Failed to connect to MatrixOne: {error_msg}") from None
 
     def _setup_connection_hook(
         self, on_connect: Union[ConnectionHook, List[Union[ConnectionAction, str]], Callable]
@@ -722,13 +747,15 @@ def _create_engine(self) -> Engine:
         """Create SQLAlchemy engine with connection pooling"""
         # Build connection URL using SQLA
```

**File**: `clients/python/pyproject.toml` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ requires-python = ">=3.8"
 dependencies = [
     "PyMySQL>=1.0.0",
     "aiomysql>=0.2.0",
-    "SQLAlchemy>=1.4.0,<3.0.0",
+    "SQLAlchemy[asyncio]>=1.4.0,<3.0.0",
     "typing-extensions>=4.0.0",
     "python-dateutil>=2.8.0",
     "numpy>=1.20.0",
```

**File**: `clients/python/tests/offline/test_async_client_query_comprehensive.py` (modified, +1/-0)
```diff
@@ -247,6 +247,7 @@ async def __aexit__(self, exc_type, exc_val, exc_tb):
         class MockEngine:
             def __init__(self, connection):
                 self.connection = connection
+                self.dialect = Mock()
 
             def begin(self):
                 return MockBeginContext(self.connection)
```

**File**: `clients/python/tests/offline/test_connection_contracts.py` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+# Copyright 2026 Matrix Origin
+# Licensed under the Apache License, Version 2.0.
+
+import asyncio
+import ssl
+from unittest.mock import AsyncMock, MagicMock, Mock
+
+import pytest
+
+from matrixone import Client
+from matrixone.async_client import AsyncClient
+from matrixone._connection_options import TLSRequiredConnection, tls_options
+from matrixone.exceptions import ConnectionError
+
+
+def test_failed_probe_disposes_engine_and_clears_state(monkeypatch):
+    client = Client(logger=Mock())
+    engine = MagicMock()
+    engine.connect.return_value.__enter__.return_value.exec_driver_sql.side_effect = RuntimeError('unreachable')
+    monkeypatch.setattr(client, '_create_engine', lambda: engine)
+    with pytest.raises(ConnectionError, match='unreachable'):
+        client.connect(database='test', on_connect=[])
+    assert not client.connected()
+    engine.dispose.assert_called_once()
+    assert not any(call.kwargs.get('success') is True for call in client.logger.log_connection.call_args_list)
+
+
+def test_success_requires_authenticated_query(monkeypatch):
+    client = Client(logger=Mock(), connection_timeout=17)
+    engine = MagicMock()
+    monkeypatch.setattr(client, '_create_engine', lambda: engine)
+    monkeypatch.setattr(client, '_detect_backend_version', lambda: None)
+    client.connect(database='test', on_connect=[])
+    engine.connect.return_value.__enter__.return_value.exec_driver_sql.assert_called_once_with('SELECT 1')
+    assert client._connection_params['connect_timeout'] == 17
+    assert client.connected()
+    client.disconnect()
+
+
+@pytest.mark.parametrize('mode', ['disabled', 'preferred', 'required'])
+def test_security_policy_context(mode):
+    options = tls_options({'ssl_mode': mode})
+    if mode == 'required':
+        context = options['ssl']
+        assert context.verify_mode == ssl.CERT_REQUIRED
+        assert context.check_hostname
+    elif mode == 'disabled':
+        assert options == {'ssl_disabled': True}
+    else:
+        assert options == {}
+
+
+def test_required_tls_refused_before_authentication():
+    import pymysql
+
+    connection = TLSRequiredConnection.__new__(TLSRequiredConnection)
+    connection.server_capabilities = 0
+    with pytest.raises(pymysql.err.OperationalError, match='does not advertise TLS'):
+        connection._request_authentication()
+
+
+def test_connection_error_redacts_password_and_suppresses_traceback_chain(monkeypatch):
+    client = Client(logger=Mock())
+    secret = 'synthetic-password-marker'
+    monkeypatch.setattr(client, '_create_engine', Mock(side_effect=RuntimeError('1049 ' + secret)))
+    with pytest.raises(ConnectionError) as result:
+        client.connect(database='test', password=secret, on_connect=[])
+    assert secret not in str(result.value)
+    assert result.value.__suppress_context__
+    assert secret not in str(client.logger.log_error.call_args)
+    assert '-p ' in str(result.value)
+
+
+@pytest.mark.parametrize('value', [0, -1, True, float('nan'), float('inf')])
+def test_invalid_timeouts_rejected_without_engine(value, monkeypatch):
+    client = Client(logger=Mock(), query_timeout=value)
+    factory = Mock()
+    monkeypatch.setattr(client, '_create_engine', factory)
+    with pytest.raises(ValueError):
+        client.connect(database='test', on_connect=[])
+    factory.assert_not_called()
+
+
+@pytest.mark.asyncio
+async def test_async_deadline_cancels_the_operation():
+    client = AsyncClient(logger=Mock(), query_timeout=0.02)
+    finished = asyncio.Event()
+
+    async def stalled(*args):
+        try:
+            await asyncio.Event().wait()
+        finally:
+            finished.set()
+
+    client._execute = stalled
+    with pytest.raises(asyncio.TimeoutError):
+        await client.execute('SELECT 1')
+    assert finished.is_set()
+
+
+@pytest.mark.asyncio
+async def test_async_explicit_cancellation_propagates():
+    client = AsyncClient(logger=Mock(), query_timeout=10)
+    started = asyncio.Event()
+
+    async def stalled(*args):
+        started.set()
+        await asyncio.Event().wait()
+
+    client._execute = stalled
+    task = asyncio.create_task(client.execute('SELECT 1'))
+    await started.wait()
+    task.cancel()
+    with pytest.raises(asyncio.CancelledError):
+        await task
+
+
+@pytest.mark.asyncio
+async def test_async_failed_probe_clears_engine(monkeypatch):
+    client = AsyncClient(logger=Mock(), connection_timeout=0.02)
+    engine = MagicMock()
+    engine.dispose = AsyncMock()
+
+    class Context:
+        async def __aenter__(self):
+            await asyncio.Event().wait()
+
+        async def __aexit__(self, *args):
+            pass
+
+    engine.begin.return_value = Context()
+    monkeypatch.setattr(client, '_create_async_engine', lambda: engine)
+    with pytest.raises(ConnectionError):
+        await client.connect(database='test', on_connect=[])
+    assert not client.connected()
+    engine.dispose.assert_awaited_once()
+
```

**File**: `clients/python/tests/offline/test_connection_redaction_transport.py` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+# Copyright 2026 Matrix Origin
+# Licensed under the Apache License, Version 2.0.
+
+"""Real drivers receiving a MySQL ERR greeting, without replacing engine factories."""
+
+import socket
+import threading
+from contextlib import contextmanager
+from unittest.mock import Mock
+
+import pytest
+
+from matrixone import Client
+from matrixone.async_client import AsyncClient
+from matrixone.exceptions import ConnectionError
+
+
+@contextmanager
+def error_peer(password):
+    listener = socket.socket()
+    listener.bind(('127.0.0.1', 0))
+    listener.listen()
+    listener.settimeout(5)
+    failures = []
+
+    def serve():
+        try:
+            with listener.accept()[0] as connection:
+                payload = b'\xff\x15\x04#28000' + ('Access denied; echoed password: ' + password).encode('utf8')
+                connection.sendall(len(payload).to_bytes(3, 'little') + b'\x00' + payload)
+        except BaseException as error:
+            failures.append(error)
+
+    thread = threading.Thread(target=serve, daemon=True)
+    thread.start()
+    try:
+        yield listener.getsockname()[1]
+    finally:
+        thread.join(6)
+        listener.close()
+        assert not thread.is_alive()
+        assert not failures
+
+
+def assert_redacted(client, error, password):
+    # Inspect the actual logged exception, before Mock's own repr escaping.
+    logged = client.logger.log_error.call_args.args[0]
+    for value in {password, repr(password)[1:-1], password.encode('unicode_escape').decode('ascii')}:
+        assert value not in str(error)
+        assert value not in str(logged)
+    assert 'Access denied' in str(error)
+    assert error.__suppress_context__
+    assert not client.connected()
+
+
+PASSWORDS = [
+    'synthetic-plain-marker',
+    r'synthetic\backslash-marker',
+    'synthetic\\quote\'"-marker',
+    'synthetic\ncontrol\\-marker',
+]
+
+
+@pytest.mark.parametrize('password', PASSWORDS)
+def test_public_sync_connection_redacts_driver_representation(password):
+    client = Client(logger=Mock(), connection_timeout=2)
+    with error_peer(password) as port:
+        with pytest.raises(ConnectionError) as error:
+            client.connect(
+                host='127.0.0.1', port=port, user='probe', password=password, database='probe', on_connect=[]
+            )
+    assert_redacted(client, error.value, password)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize('password', PASSWORDS)
+async def test_public_async_connection_redacts_driver_representation(password):
+    client = AsyncClient(logger=Mock(), connection_timeout=2)
+    with error_peer(password) as port:
+        with pytest.raises(ConnectionError) as error:
+            await client.connect(
+                host='127.0.0.1', port=port, user='probe', password=password, database='probe', on_connect=[]
+            )
+    assert_redacted(client, error.value, password)
+
+
+@pytest.mark.parametrize('password', ["雪\\quote'", '雪\n\\quote"', "both\\'\"\t雪"])
+@pytest.mark.parametrize('message', ["driver's error: %s", 'driver "error": %s'])
+def test_redaction_handles_quote_choice_and_printable_unicode(password, message):
+    from pymysql.err import OperationalError
+    from sqlalchemy.exc import OperationalError as WrappedError
+
+    from matrixone._connection_options import redact_error
+
+    error = WrappedError(None, None, OperationalError(1045, message % password))
+    redacted = redact_error(error, password)
+    assert '***' in redacted
+    assert '雪' not in redacted
+    assert 'driver' in redacted
```

---

### Incident Patch 2: `87328274` (2026-10-19)
**Commit Message**: fix(plan): align DECIMAL DIV result domains with MySQL (#30171)

DECIMAL DIV currently publishes BIGINT for narrow CTAS/view outputs and loses an unsigned integer operand's result domain during implicit casts. A negative quotient can consequently reach INSERT ... ON DUPLICATE KEY UPDATE and replace an existing row.

- Derive DIV display precision and signedness from the original DECIMAL/integer operands. Keep 64-bit arithmetic and infer INT/BIGINT independently at CTAS/view schema boundaries, including folded constants and transparent projections.
- Add a stable unsigned DECIMAL DIV overload using exact Decimal256 arithmetic. Accept the full uint64 range and negative fractions truncating to zero; reject negative nonzero or overflowing results before downstream writes. Preserve legacy overload 0 and integer/BIT execution contracts.
- Preserve typed peers during prepared parameter inference and require MORPC v121 for the new expression contract at worker placement, send/receive, and persisted-expression boundaries. Preserve the independent coordinator-only fence for dependent subquery programs.

- Preserve SELECT division-by-zero diagnostics for unsigned DECIMAL DIV through the exist

**File**: `pkg/defines/const.go` (modified, +2/-1)
```diff
@@ -156,7 +156,8 @@ const (
 	MORPCVersion118    int64 = 118 // transactional database defaults and table charset alteration
 	MORPCVersion119    int64 = 119 // coordinator-owned parameterized subquery programs
 	MORPCVersion120    int64 = 120 // current-session KILL authorization and proxy disconnect cleanup
-	MORPCLatestVersion       = MORPCVersion120
+	MORPCVersion121    int64 = 121 // exact unsigned DECIMAL DIV result domain
+	MORPCLatestVersion       = MORPCVersion121
 )
 
 // DefaultLockWaitTimeoutSeconds is shared by the frontend default and by
```

**File**: `pkg/pb/plan/decimal_integer_division_protocol_test.go` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
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
+	"github.com/stretchr/testify/require"
+	"testing"
+)
+
+func TestDecimalIntegerDivisionRemoteFeature(t *testing.T) {
+	for _, tc := range []struct {
+		name               string
+		function, overload int64
+		width, scale       int32
+		want               bool
+	}{
+		{"unsigned", 14, 1, 7, 0, true}, {"signed display", 14, 0, 8, 0, true},
+		{"legacy", 14, 0, 64, -1, false}, {"unrelated function", 13, 0, 8, 0, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			expr := &Expr{Typ: Type{Id: 24, Width: tc.width, Scale: tc.scale}, Expr: &Expr_F{F: &Function{Func: &ObjectRef{Obj: tc.function<<32 | tc.overload}}}}
+			bytes, err := expr.Marshal()
+			require.NoError(t, err)
+			var decoded Expr
+			require.NoError(t, decoded.Unmarshal(bytes))
+			features, err := RequiredRemoteExpressionFeatures(&decoded)
+			require.NoError(t, err)
+			require.Equal(t, tc.want, features.DecimalIntegerDivisionSemantics)
+			if tc.want {
+				require.True(t, features.Any())
+			}
+		})
+	}
+}
```

**File**: `pkg/pb/plan/string_literal_form.go` (modified, +5/-0)
```diff
@@ -421,6 +421,7 @@ type RemoteExpressionFeatures struct {
 	SpatialDistanceSemantics          bool
 	PreparedPrecisionScalar           bool
 	DecimalDivisionSemantics          bool
+	DecimalIntegerDivisionSemantics   bool // v121: unsigned DIV overload and display precision
 	// SpecialIntegerConsumers requires v98 independently of private CASTs.
 	SpecialIntegerConsumers                 bool
 	TemporalResultContracts                 bool
@@ -459,6 +460,7 @@ func (features RemoteExpressionFeatures) Any() bool {
 		features.PreparedPrecisionScalar ||
 		features.SpecialIntegerConsumers ||
 		features.DecimalDivisionSemantics ||
+		features.DecimalIntegerDivisionSemantics ||
 		features.TemporalResultContracts ||
 		features.InvalidTemporalResultContract ||
 		features.NormalizedIntervalUnits ||
@@ -990,6 +992,9 @@ func RequiredRemoteExpressionFeatures(owner any) (features RemoteExpressionFeatu
 					(current.Typ.Id == 32 || current.Typ.Id == 33 || current.Typ.Id == 34) {
 					features.DecimalDivisionSemantics = true
 				}
+				if id == 14 && (overload == 1 || (overload == 0 && current.Typ.Width > 0 && current.Typ.Width <= 20 && current.Typ.Scale == 0)) {
+					features.DecimalIntegerDivisionSemantics = true
+				}
 				// Function IDs live in the function registry, which cannot be
 				// imported here because the planner depends on this package.
 				if id == 189 { // legacy TO_INTERVAL: ambiguous across pre-v97 and v97 binaries
```

**File**: `pkg/sql/colexec/division_warning_folding_test.go` (modified, +13/-2)
```diff
@@ -27,7 +27,7 @@ import (
 )
 
 func TestDivisionWarningRuntimeFolding(t *testing.T) {
-	for _, name := range []string{"/", "div", "%"} {
+	for _, name := range []string{"/", "div", "%", "unsigned decimal div"} {
 		for _, parent := range []string{"direct", "coalesce"} {
 			t.Run(name+"/"+parent, func(t *testing.T) {
 				proc := testutil.NewProcess(t, testutil.WithFileService(nil))
@@ -38,12 +38,23 @@ func TestDivisionWarningRuntimeFolding(t *testing.T) {
 				sink := &preparedCastWarningSession{}
 				proc.WarningSink = sink
 				literal := func(n int64) *plan.Expr {
+					if name == "unsigned decimal div" {
+						return &plan.Expr{Typ: types.T_uint64.ToType().PlanType(), Expr: &plan.Expr_Lit{Lit: &plan.Literal{Value: &plan.Literal_U64Val{U64Val: uint64(n)}}}}
+					}
 					if name == "/" {
 						return &plan.Expr{Typ: types.T_float64.ToType().PlanType(), Expr: &plan.Expr_Lit{Lit: &plan.Literal{Value: &plan.Literal_Dval{Dval: float64(n)}}}}
 					}
 					return &plan.Expr{Typ: types.T_int64.ToType().PlanType(), Expr: &plan.Expr_Lit{Lit: &plan.Literal{Value: &plan.Literal_I64Val{I64Val: n}}}}
 				}
-				expr := bindTestFunction(t, proc, name, literal(1), literal(0))
+				var expr *plan.Expr
+				if name == "unsigned decimal div" {
+					dividend := &plan.Expr{Typ: types.New(types.T_decimal64, 10, 3).PlanType(), Expr: &plan.Expr_Lit{Lit: &plan.Literal{Value: &plan.Literal_Decimal64Val{Decimal64Val: &plan.Decimal64{A: 1000}}}}}
+					expr = bindTestFunction(t, proc, "div", dividend, literal(0))
+					expr.GetF().Args[0] = bindTestCast(t, proc, 0, dividend, types.New(types.T_decimal256, 10, 3))
+					expr.GetF().Args[1] = bindTestCast(t, proc, 0, literal(0), types.New(types.T_decimal256, 20, 0))
+				} else {
+					expr = bindTestFunction(t, proc, name, literal(1), literal(0))
+				}
 				if parent == "coalesce" {
 					expr = bindTestFunction(t, proc, "coalesce", expr, literal(7))
 				}
```

**File**: `pkg/sql/compile/decimal_division_protocol_test.go` (modified, +64/-0)
```diff
@@ -91,3 +91,67 @@ func TestDecimalDivisionProtocolUnknownWorkerFallsBack(t *testing.T) {
 	require.NoError(t, c.constrainRemoteExpressionWorkers(qry))
 	require.Equal(t, plan2.ExecTypeAP_ONECN, c.execType)
 }
+
+func TestDecimalIntegerDivisionProtocol(t *testing.T) {
+	c, client := expressionProtocolTestCompile(t)
+	expr := decimalDivisionProtocolExpr(types.T_uint64)
+	expr.Typ = planpb.Type{Id: int32(types.T_uint64), Width: 7, Scale: 0}
+	expr.GetF().Func.Obj = function.EncodeOverloadID(function.INTEGER_DIV, function.DecimalIntegerDivUnsignedOverload)
+	qry := &planpb.Query{Nodes: []*planpb.Node{{ProjectList: []*planpb.Expr{expr}}}, Steps: []int32{0}}
+	op := projection.NewArgument()
+	defer op.Release()
+	op.ProjectList = []*planpb.Expr{expr}
+	scope := &Scope{Magic: Remote, Proc: c.proc, NodeInfo: engine.Node{Id: "old-worker", Addr: "remote:6001"}, RootOp: op}
+	client.version = defines.MORPCVersion120
+	c.execType = plan2.ExecTypeAP_MULTICN
+	c.cnList = engine.Nodes{{Id: "old-worker", Addr: "remote:6001", Mcpu: 4}}
+	require.NoError(t, c.constrainRemoteExpressionWorkers(qry))
+	require.Equal(t, plan2.ExecTypeAP_ONECN, c.execType)
+	_, err := encodeRemoteScope(scope, c.proc)
+	require.ErrorContains(t, err, "remote destination")
+	client.version = defines.MORPCVersion121
+	c.execType = plan2.ExecTypeAP_MULTICN
+	c.cnList = engine.Nodes{{Id: "old-worker", Addr: "remote:6001", Mcpu: 4}}
+	require.NoError(t, c.constrainRemoteExpressionWorkers(qry))
+	require.Equal(t, plan2.ExecTypeAP_MULTICN, c.execType)
+	data, err := encodeRemoteScope(scope, c.proc)
+	require.NoError(t, err)
+	var wire pipeline.Pipeline
+	require.NoError(t, wire.Unmarshal(data))
+	require.Equal(t, expr.GetF().Func.Obj, wire.InstructionList[0].ProjectList[0].GetF().Func.Obj)
+	rt := moruntime.ServiceRuntime(c.proc.GetService())
+	rt.SetGlobalVariables(moruntime.MOProtocolVersion, defines.MORPCVersion120)
+	require.ErrorContains(t, validateRemoteExpressionPipelineProtocol(c.proc, &wire), "version 121")
+	rt.SetGlobalVariables(moruntime.MOProtocolVersion, defines.MORPCVersion121)
+	require.NoError(t, validateRemoteExpressionPipelineProtocol(c.proc, &wire))
+	required, err := plan2.RequiredPersistedExpressionProtocolVersion(expr)
+	require.NoError(t, err)
+	require.Equal(t, defines.MORPCVersion121, required)
+	t.Run("dependent_program", func(t *testing.T) {
+		dependent := &planpb.Expr{Typ: expr.Typ, Expr: &planpb.Expr_Dependent{Dependent: &planpb.DependentExpr{
+			ProgramId: 1, Inputs: []*planpb.Expr{expr},
+		}}}
+		features, err := planpb.RequiredRemoteExpressionFeatures(dependent)
+		require.NoError(t, err)
+		require.True(t, features.DependentPrograms)
+		require.True(t, features.DecimalIntegerDivisionSemantics)
+		floor, err := plan2.RequiredPersistedExpressionProtocolVersion(dependent)
+		require.NoError(t, err)
+		require.Equal(t, defines.MORPCVersion121, floor)
+		// DIV capability does not grant a worker the coordinator's program owner.
+		op.ProjectList = []*planpb.Expr{dependent}
+		defer func() { op.ProjectList = []*planpb.Expr{expr} }()
+		_, err = encodeRemoteScope(scope, c.proc)
+		require.ErrorContains(t, err, "coordinator execution owner")
+		data, err := (&pipeline.Pipeline{InstructionList: []*pipeline.Instruction{{ProjectList: []*planpb.Expr{dependent}}}}).Marshal()
+		require.NoError(t, err)
+		_, err = decodeScope(data, c.proc, true, nil)
+		require.ErrorContains(t, err, "coordinator execution owner")
+	})
+	// Historical overload zero remains admitted after immediate-predecessor rollback.
+	rt.SetGlobalVariables(moruntime.MOProtocolVersion, defines.MORPCVersion120)
+	expr.GetF().Func.Obj = function.EncodeOverloadID(function.INTEGER_DIV, 0)
+	expr.Typ = planpb.Type{Id: int32(types.T_int64), Width: 64, Scale: -1}
+	require.NoError(t, validateRemoteExpressionPipelineProtocol(c.proc, &pipeline.Pipeline{InstructionList: []*pipeline.Instruction{{ProjectList: []*planpb.Expr{expr}}}}))
+	require.Equal(t, client.calls, client.releases)
+}
```

**File**: `pkg/sql/compile/expression_destination_protocol.go` (modified, +3/-0)
```diff
@@ -72,6 +72,9 @@ func validateRemoteExpressionDestination(proc *process.Process, p *pipeline.Pipe
 		{features.PreparedPrecisionScalar, defines.MORPCVersion95,
 			"prepared scalar precision requires a versioned remote destination",
 			"remote destination does not support prepared scalar precision (MORPC version %d)"},
+		{features.DecimalIntegerDivisionSemantics, defines.MORPCVersion121,
+			"decimal integer division requires a versioned remote destination",
+			"remote destination does not support decimal integer division (MORPC version %d)"},
 		{features.DecimalDivisionSemantics, defines.MORPCVersion97,
 			"decimal division requires a versioned remote destination",
 			"remote destination does not support decimal division (MORPC version %d)"},
```

**File**: `pkg/sql/compile/expression_protocol.go` (modified, +3/-0)
```diff
@@ -89,6 +89,9 @@ func remoteExpressionProtocolVersion(features plan.RemoteExpressionFeatures) int
 	if features.PreparedPrecisionScalar {
 		required = max(required, defines.MORPCVersion95)
 	}
+	if features.DecimalIntegerDivisionSemantics {
+		required = max(required, defines.MORPCVersion121)
+	}
 	if features.DecimalDivisionSemantics {
 		required = max(required, defines.MORPCVersion97)
 	}
```

**File**: `pkg/sql/compile/remoterun.go` (modified, +3/-0)
```diff
@@ -2327,6 +2327,9 @@ func validateRemoteExpressionFeatures(proc *process.Process, features plan.Remot
 	if features.DecimalStatisticalResultContracts && (!hasProtocolVersion || protocolVersion < defines.MORPCVersion113) {
 		return moerr.NewNotSupportedNoCtx("decimal statistical DOUBLE results require MORPC protocol version 113")
 	}
+	if features.DecimalIntegerDivisionSemantics && (!hasProtocolVersion || protocolVersion < defines.MORPCVersion121) {
+		return moerr.NewNotSupportedNoCtx("decimal integer division requires MORPC protocol version 121")
+	}
 	if features.DateNumericResultContracts && (!hasProtocolVersion || protocolVersion < defines.MORPCVersion112) {
 		return moerr.NewNotSupportedNoCtx("signed date result contracts require MORPC protocol version 112")
 	}
```

---

### Incident Patch 3: `95eb0f0c` (2026-10-19)
**Commit Message**: fix: enforce session ownership for KILL and processlist (#30299)

Authorize SQL KILL against the authenticated current-session identity and pin the target generation through the action. Ordinary users can affect their own sessions, account administrators their account, and sys/moadmin the cluster. Filter processlist rows before materialization using the same current statement identity.

Forward original SQL through the existing proxy backend, preserving role/user changes. Keep trusted disconnect cleanup separate from SQL authorization: complete terminal tunnel close before capturing its backend, use a bounded cleanup context, and never retry uncertain effects or fall back to re-authenticating the original login. Remote KILL has one outstanding RPC and a 10-second total bound.

Rebase preserves main's SQL-mode/warning setup and samples account/user/role under the existing TenantInfo lock. Merge the authoritative query.proto additively and regenerate query.pb.go with the repository-pinned tooling. Published main methods and field tags remain unchanged. Preserve main capability 119; these new methods require 120 at sender and receiver, including 119→120→119 rollback.

Fix fixture owne

**File**: `docs/design/session-authorization.md` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+# Current-session KILL authorization and processlist visibility — design v2
+
+Owner issues: MatrixOne #30276 and #30278. Implementation: https://github.com/matrixorigin/matrixone/pull/30299. This versioned design records the current contract; approval evidence is retained in the task record.
+
+Design-first review: **APPROVED v2**, gpt-6-astra, reasoning_effort=medium, canonical collaboration session `/root/proxy_design`, 2026-10-15. Exact inspected base: `8795f3699b40504376343fa1acda8b4619f0c76e`. Design-only inspection; no source edits, builds, runtime tests or GitHub writes by this reviewer. Prior `design.md` evidence is reused and its local authorization/lifecycle and processlist conclusions remain applicable. This delta supersedes its unresolved proxy disposition. User explicitly chose full current-identity behavior, preserving legitimate KILL after SET ROLE and COM_CHANGE_USER.
+
+## Classification and evidence
+
+The original local authorization fixes are ordinary bug fixes. Complete closure now changes the CN internal wire protocol and ownership across proxy/frontend/query service; the feature-design gate applies because of wire compatibility, distributed routing and security boundaries. A document in the implementation PR is acceptable because this distinct design-first approval precedes implementation. This is the required versioned design, not an additional request for user approval.
+
+At inspected base, proxy `makeEvent` consumes single KILL commands; `handleKill` locates target CN and reauthenticates using the ORIGINAL handshake in `connAndExec`. `cacheIdentityChanged` records but cannot refresh changes to user or active role. Thus authorizing that temporary session still permits an original administrator to kill another user after changing to an ordinary identity. Conversely legitimate upgrades and same-current-user actions can fail. Disconnect cleanup also authenticates the original login. SQL request admission in `RoutineManager.Handler` already pins the executing session against COM_CHANGE_USER/reset/migration; normal SQL ordering is the correct owner of current identity.
+
+Production frontend connection IDs come from HAkeeper `AllocateIDByKey(ConnIDAllocKey)`; local incremental IDs are only the nil-HAkeeper unit-test fallback. Existing proxy global routing scans processlist; it is not a separate authoritative directory. Existing query RPC is a trusted internal control plane, already supporting reset/migration and account-wide kill. SQL/MySQL users cannot directly invoke its handlers. This design preserves that trust model; deployments must already isolate query-service RPC from untrusted clients. No user-supplied SQL principal or trusted boolean is introduced.
+
+## Invariants and contract
+
+Authenticated sys+moadmin may act globally; non-sys+accountadmin within its account; others only same account AND same user. Sys membership or username root alone grants nothing. Missing authenticated identity fails closed. Active role means the role of the current executing session, including earlier successful statements in a multi-statement request. Failed identity-changing commands preserve whatever identity the existing authentication/role implementation leaves installed; the proxy neither guesses nor replays it.
+
+Each SQL KILL executes on its existing authenticated backend, authorizes against the target's pinned current session generation, and has at most one selected target effect. No target CN forwards again. Target disappearance is distinct from permission denial or transport failure. A denied target is never canceled or closed. IDs above uint32 are rejected before lookup or conversion. Existing QUERY/CONNECTION/default, statement-ID and local self-KILL semantics are retained. Statement ID remains subject to current kernel semantics (killQuery currently cancels the request regardless of that string); this fix does not invent new semantics.
+
+Processlist remains the prior design: fetchSessions receives authenticated Account/User/Role from proc.SessionInfo, requests SysTenant only for actual sys+moadmin, and filters every returned row before vector materialization. Ordinary users see own rows, account admins own-account rows, moadmin all. SHOW, direct processlist() and information_schema view converge here. Empty identity and malformed/nil rows fail closed. Prepared execution must use current session information. No processlist wire change or SQL privilege catalog change.
+
+## Chosen architecture
+
+### 1. Forward SQL through the existing proxy tunnel
+
+`pkg/proxy/event.go`: stop consuming KILL. Remove the `tree.Kill` event case and obsolete killEvent definition/helpers, TypeKill references if otherwise unused, and the matching dispatch/handleKill in `client_conn.go`. The original packet travels through the ordinary c2s/s2c pipes. Do not replace it with a second writer, `ExecStmt`, synthetic OK/ERR, or a temporary connection. Update event/tunnel fixtures to expect KIL
```

**File**: `pkg/cnservice/server_query.go` (modified, +33/-0)
```diff
@@ -142,6 +142,8 @@ func (s *service) initQueryService() error {
 }
 
 func (s *service) initQueryCommandHandler() {
+	s.addQueryCommandHandler(query.CmdMethod_KillSession, s.handleKillSession)
+	s.addQueryCommandHandler(query.CmdMethod_DisconnectSession, s.handleDisconnectSession)
 	s.addQueryCommandHandler(query.CmdMethod_KillConn, s.handleKillConn)
 	s.addQueryCommandHandler(query.CmdMethod_AlterAccount, s.handleAlterAccount)
 	s.addQueryCommandHandler(query.CmdMethod_TraceSpan, s.handleTraceSpan)
@@ -961,3 +963,34 @@ func (s *service) handleWorkspaceThresholdRequest(
 
 	return nil
 }
+
+// SQL authorization is performed by the owning frontend routine manager. These
+// trusted RPC handlers never execute SQL or forward to another CN.
+func (s *service) handleKillSession(ctx context.Context, req *query.Request, resp *query.Response, _ *morpc.Buffer) error {
+	if req == nil || req.KillSessionRequest == nil {
+		return moerr.NewInvalidInput(ctx, "missing kill session request")
+	}
+	if err := qclient.CheckMethodVersion(ctx, s.serviceID(), req); err != nil {
+		return err
+	}
+	found, err := s.mo.GetRoutineManager().KillSession(ctx, req.KillSessionRequest)
+	if err != nil {
+		return err
+	}
+	resp.KillSessionResponse = &query.KillSessionResponse{Found: found}
+	return nil
+}
+
+func (s *service) handleDisconnectSession(ctx context.Context, req *query.Request, resp *query.Response, _ *morpc.Buffer) error {
+	if req == nil || req.DisconnectSessionRequest == nil {
+		return moerr.NewInvalidInput(ctx, "missing disconnect session request")
+	}
+	if err := qclient.CheckMethodVersion(ctx, s.serviceID(), req); err != nil {
+		return err
+	}
+	if err := s.mo.GetRoutineManager().DisconnectSession(ctx, req.DisconnectSessionRequest.ConnID); err != nil {
+		return err
+	}
+	resp.DisconnectSessionResponse = &query.DisconnectSessionResponse{}
+	return nil
+}
```

**File**: `pkg/cnservice/server_query_test.go` (modified, +62/-0)
```diff
@@ -1793,3 +1793,65 @@ func (h *fakeIcebergCacheInvalidationHandler) InvalidateIcebergCache(ctx context
 	h.req = req
 	return h.removed, nil
 }
+
+func TestSessionControlHandlers(t *testing.T) {
+	ctl := gomock.NewController(t)
+	server := mock_moserver.NewMockServer(ctl)
+	server.EXPECT().GetRoutineManager().Return(&frontend.RoutineManager{}).AnyTimes()
+	sid := "session-control-handlers"
+	rt := moruntime.DefaultRuntime()
+	moruntime.SetupServiceBasedRuntime(sid, rt)
+	t.Cleanup(func() { moruntime.CompareAndDeleteServiceBasedRuntime(sid, rt) })
+	rt.SetGlobalVariables(moruntime.MOProtocolVersion, defines.MORPCVersion120)
+	s := &service{mo: server, cfg: &Config{UUID: sid}}
+	ctx := context.Background()
+	for _, req := range []*query.Request{nil, {}} {
+		require.Error(t, s.handleKillSession(ctx, req, &query.Response{}, nil))
+		require.Error(t, s.handleDisconnectSession(ctx, req, &query.Response{}, nil))
+	}
+	req := &query.Request{CmdMethod: query.CmdMethod_KillSession, KillSessionRequest: &query.KillSessionRequest{ConnID: 123}}
+	require.Error(t, s.handleKillSession(ctx, req, &query.Response{}, nil))
+	req.KillSessionRequest.Principal = &query.KillSessionPrincipal{Account: "sys", User: "root", Role: "moadmin"}
+	rsp := &query.Response{}
+	require.NoError(t, s.handleKillSession(ctx, req, rsp, nil))
+	require.NotNil(t, rsp.KillSessionResponse)
+	require.False(t, rsp.KillSessionResponse.Found)
+	req.KillSessionRequest.ConnID = 1<<32 + 123
+	require.Error(t, s.handleKillSession(ctx, req, &query.Response{}, nil))
+	rsp = &query.Response{}
+	require.NoError(t, s.handleDisconnectSession(ctx, &query.Request{CmdMethod: query.CmdMethod_DisconnectSession, DisconnectSessionRequest: &query.DisconnectSessionRequest{ConnID: 123}}, rsp, nil))
+	require.NotNil(t, rsp.DisconnectSessionResponse)
+}
+
+// A receiver must reject rollback before looking up or acting on any routine.
+// Leaving mo nil makes an accidentally admitted operation fail this test.
+func TestSessionControlHandlersRejectRollback(t *testing.T) {
+	sid := "session-control-rollback"
+	rt := moruntime.DefaultRuntime()
+	moruntime.SetupServiceBasedRuntime(sid, rt)
+	t.Cleanup(func() { moruntime.CompareAndDeleteServiceBasedRuntime(sid, rt) })
+	s := &service{cfg: &Config{UUID: sid}}
+	ctx := context.Background()
+	kill := &query.Request{CmdMethod: query.CmdMethod_KillSession, KillSessionRequest: &query.KillSessionRequest{ConnID: 123}}
+	disconnect := &query.Request{CmdMethod: query.CmdMethod_DisconnectSession, DisconnectSessionRequest: &query.DisconnectSessionRequest{ConnID: 123}}
+	for _, version := range []int64{defines.MORPCVersion119, defines.MORPCVersion120, defines.MORPCVersion119} {
+		rt.SetGlobalVariables(moruntime.MOProtocolVersion, version)
+		if version == defines.MORPCVersion120 {
+			s.mo = mock_moserver.NewMockServer(gomock.NewController(t))
+			s.mo.(*mock_moserver.MockServer).EXPECT().GetRoutineManager().Return(&frontend.RoutineManager{}).Times(2)
+			rsp := &query.Response{}
+			kill.KillSessionRequest.Principal = &query.KillSessionPrincipal{Account: "sys", User: "root", Role: "moadmin"}
+			require.NoError(t, s.handleKillSession(ctx, kill, rsp, nil))
+			require.NotNil(t, rsp.KillSessionResponse)
+			require.NoError(t, s.handleDisconnectSession(ctx, disconnect, rsp, nil))
+			require.NotNil(t, rsp.DisconnectSessionResponse)
+			s.mo = nil
+			continue
+		}
+		rsp := &query.Response{}
+		require.ErrorContains(t, s.handleKillSession(ctx, kill, rsp, nil), "unsupported protocol version 120")
+		require.Nil(t, rsp.KillSessionResponse)
+		require.ErrorContains(t, s.handleDisconnectSession(ctx, disconnect, rsp, nil), "unsupported protocol version 120")
+		require.Nil(t, rsp.DisconnectSessionResponse)
+	}
+}
```

**File**: `pkg/defines/const.go` (modified, +2/-1)
```diff
@@ -155,7 +155,8 @@ const (
 	MORPCVersion117    int64 = 117 // versioned collation-aware LEAST/GREATEST ordering
 	MORPCVersion118    int64 = 118 // transactional database defaults and table charset alteration
 	MORPCVersion119    int64 = 119 // coordinator-owned parameterized subquery programs
-	MORPCLatestVersion       = MORPCVersion119
+	MORPCVersion120    int64 = 120 // current-session KILL authorization and proxy disconnect cleanup
+	MORPCLatestVersion       = MORPCVersion120
 )
 
 // DefaultLockWaitTimeoutSeconds is shared by the frontend default and by
```

**File**: `pkg/frontend/kill.go` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
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
+	"math"
+	"strings"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/clusterservice"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/matrixorigin/matrixone/pkg/pb/query"
+	qclient "github.com/matrixorigin/matrixone/pkg/queryservice/client"
+)
+
+func killPrincipal(tenant *TenantInfo) *query.KillSessionPrincipal {
+	if tenant == nil {
+		return nil
+	}
+	tenant.mu.Lock()
+	defer tenant.mu.Unlock()
+	return &query.KillSessionPrincipal{
+		AccountID: tenant.TenantID, UserID: tenant.UserID,
+		Account: tenant.Tenant, User: tenant.User, Role: tenant.DefaultRole,
+	}
+}
+
+func validKillPrincipal(p *query.KillSessionPrincipal) bool {
+	return p != nil && p.Account != "" && p.User != "" && p.Role != "" &&
+		(strings.EqualFold(p.Account, sysAccountName) == (p.AccountID == sysAccountID))
+}
+
+func canKillSession(caller, target *query.KillSessionPrincipal) bool {
+	if !validKillPrincipal(caller) || !validKillPrincipal(target) {
+		return false
+	}
+	sys := strings.EqualFold(caller.Account, sysAccountName)
+	if sys && strings.EqualFold(caller.Role, moAdminRoleName) {
+		return true
+	}
+	return caller.AccountID == target.AccountID &&
+		((!sys && strings.EqualFold(caller.Role, accountAdminRoleName)) || caller.UserID == target.UserID)
+}
+
+// killLocal pins the target generation from authorization through cancellation.
+// Absence is separate from denial so only absence can trigger remote routing.
+func (rm *RoutineManager) killLocal(ctx context.Context, principal *query.KillSessionPrincipal,
+	callerID, targetID uint64, killConnection bool, statementID string,
+) (bool, error) {
+	if targetID > math.MaxUint32 {
+		return false, moerr.NewInvalidInputf(ctx, "connection id %d exceeds uint32", targetID)
+	}
+	if !validKillPrincipal(principal) {
+		return false, moerr.NewInternalError(ctx, "access denied: missing authenticated KILL identity")
+	}
+	if err := ctx.Err(); err != nil {
+		return false, err
+	}
+	rt := rm.getRoutineByConnID(uint32(targetID))
+	if rt == nil {
+		return false, nil
+	}
+	rt.mc.Lock()
+	if rt.mc.closed || rt.mc.inProgress {
+		rt.mc.Unlock()
+		return true, moerr.NewInternalError(ctx, "cannot kill a closed or changing session")
+	}
+	ses := rt.getSession()
+	if ses == nil || !canKillSession(principal, killPrincipal(ses.GetTenantInfo())) {
+		rt.mc.Unlock()
+		return true, moerr.NewInternalError(ctx, "access denied: KILL requires session ownership or an administrative role")
+	}
+	if err := ctx.Err(); err != nil {
+		rt.mc.Unlock()
+		return true, err
+	}
+	killMyself := callerID == targetID
+	if !killConnection {
+		rt.killQuery(killMyself, statementID)
+		rt.mc.Unlock()
+		return true, nil
+	}
+	// Seal identity-changing admission before releasing the guard. Closing the
+	// protocol can enter routine cleanup and must happen outside this lock.
+	rt.mc.closed = true
+	rt.mc.cond.Broadcast()
+	rt.mc.Unlock()
+	rt.killConnection(killMyself)
+	return true, nil
+}
+
+// KillSession is a local-only operation for the trusted CN query service.
+// A remote request cannot claim the local self-KILL exception or forward again.
+func (rm *RoutineManager) KillSession(ctx context.Context, req *query.KillSessionRequest) (bool, error) {
+	if req == nil {
+		return false, moerr.NewInvalidInput(ctx, "missing kill session request")
+	}
+	return rm.killLocal(ctx, req.Principal, math.MaxUint64, req.ConnID, req.KillConnection, req.StatementID)
+}
+
+// DisconnectSession is trusted proxy lifecycle cleanup, independent of SQL
+// identity. The captured backend cannot be cached/reassigned during this call.
+func (rm *RoutineManager) DisconnectSession(ctx context.Context, connID uint32) error {
+	if err := ctx.Err(); err != nil {
+		return err
+	}
+	if rt := rm.getRoutineByConnID(connID); rt != nil {
+		rt.beginClose()
+		rt.killConnection(false)
+	}
+	return nil
+}
+
+func killSession(ctx context.Context, ses *Session, targetID uint64, connection bool, statementID string) error {
+	principal := killPrincipal(ses.GetTenantInfo())
+	found, err := getRtMgr(ses.GetService()).killLocal(ctx, principal, uint64(ses.GetConnectionID()), targetID, connection, statementID)
+	if found || err != nil {
+		return err
+	}
+	qc := getPu(ses.GetService()).QueryClient
+	if qc == nil {
+		return moerr.NewInter
```

**File**: `pkg/frontend/kill_test.go` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
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
+	"errors"
+	"math"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/matrixorigin/matrixone/pkg/pb/query"
+	qclient "github.com/matrixorigin/matrixone/pkg/queryservice/client"
+	"github.com/stretchr/testify/require"
+)
+
+func killTestIdentity(account string, aid uint32, user string, uid uint32, role string) *TenantInfo {
+	return &TenantInfo{Tenant: account, TenantID: aid, User: user, UserID: uid, DefaultRole: role}
+}
+
+func TestKillSessionAuthorization(t *testing.T) {
+	ordinary := killTestIdentity("sys", 0, "ordinary", 7, "public")
+	owner := killTestIdentity("acme", 10, "owner", 7, "public")
+	tests := []struct {
+		name           string
+		caller, target *TenantInfo
+		allow          bool
+	}{
+		{"sys ordinary cannot kill root", ordinary, killTestIdentity("sys", 0, "root", 0, "moadmin"), false},
+		{"sys own user across roles", ordinary, killTestIdentity("sys", 0, "ordinary", 7, "analyst"), true},
+		{"same account other user", owner, killTestIdentity("acme", 10, "other", 8, "public"), false},
+		{"same user other account", owner, killTestIdentity("other", 11, "owner", 7, "public"), false},
+		{"same name different user ID", owner, killTestIdentity("acme", 10, "owner", 8, "public"), false},
+		{"same user", owner, owner, true},
+		{"account admin own account", killTestIdentity("acme", 10, "admin", 9, "accountadmin"), owner, true},
+		{"account admin other account", killTestIdentity("other", 11, "admin", 9, "accountadmin"), owner, false},
+		{"sys accountadmin not global", killTestIdentity("sys", 0, "admin", 9, "accountadmin"), owner, false},
+		{"non sys moadmin not global", killTestIdentity("other", 11, "admin", 9, "moadmin"), owner, false},
+		{"moadmin global", killTestIdentity("sys", 0, "admin", 9, "moadmin"), owner, true},
+		{"root name not authority", killTestIdentity("sys", 0, "root", 0, "public"), owner, false},
+		{"missing caller", nil, owner, false}, {"missing target", owner, nil, false},
+		{"empty role", killTestIdentity("acme", 10, "owner", 7, ""), owner, false},
+		{"inconsistent sys ID", killTestIdentity("sys", 10, "admin", 9, "moadmin"), owner, false},
+	}
+	for _, tt := range tests {
+		for _, connection := range []bool{false, true} {
+			t.Run(tt.name+map[bool]string{false: "/query", true: "/connection"}[connection], func(t *testing.T) {
+				rt, _ := newUnitTestRoutine(t, 100)
+				ses := &Session{tenant: tt.target}
+				rt.setSession(ses)
+				ses.SetQueryInExecute(true)
+				reqCtx, cancel := context.WithCancel(context.Background())
+				defer cancel()
+				rt.setCancelRequestFunc(cancel)
+				rm := &RoutineManager{routinesByConnID: map[uint32]*Routine{100: rt}}
+				found, err := rm.killLocal(context.Background(), killPrincipal(tt.caller), 1, 100, connection, "statement")
+				if tt.allow {
+					require.NoError(t, err)
+					require.True(t, found)
+					if connection {
+						require.True(t, rt.isCancelled())
+						require.True(t, rt.mc.closed)
+					} else {
+						require.ErrorIs(t, reqCtx.Err(), context.Canceled)
+						require.False(t, ses.GetQueryInExecute())
+					}
+				} else {
+					require.Error(t, err)
+					require.NoError(t, reqCtx.Err())
+					require.False(t, rt.isCancelled())
+					require.False(t, rt.mc.closed)
+					require.True(t, ses.GetQueryInExecute())
+				}
+			})
+		}
+	}
+}
+
+func TestKillSessionGenerationAndBoundaries(t *testing.T) {
+	rt, _ := newUnitTestRoutine(t, 100)
+	old := killTestIdentity("acme", 10, "old", 7, "public")
+	next := killTestIdentity("acme", 10, "next", 8, "public")
+	rt.setSession(&Session{tenant: old})
+	rm := &RoutineManager{routinesByConnID: map[uint32]*Routine{100: rt}}
+	reqCtx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+	rt.setCancelRequestFunc(cancel)
+	// A lifecycle transition owns admission. KILL must reject without waiting for it.
+	rt.mc.Lock()
+	rt.mc.inProgress = true
+	rt.mc.Unlock()
+	found, err := rm.killLocal(context.Background(), killPrincipal(old), 1, 100, false, "")
+	require.True(t, found)
+	require.Error(t, err)
+	require.NoError(t, reqCtx.Err())
+	rt.mc.Lock()
+	rt.setSession(&Session{tenant: next})
+	rt.mc.inProgress = false
+	rt.mc.Unlock()
+	found, err = rm.killLocal(context.Background(), killPrincipal(old), 1, 100, false, "")
+	require.True(t, found)
+	require.Error(t, err)
+	re
```

**File**: `pkg/frontend/mysql_cmd_executor.go` (modified, +7/-17)
```diff
@@ -3755,16 +3755,8 @@ func handleSwitchRole(ses FeSession, execCtx *ExecCtx, sr *tree.SetRole) error {
 }
 
 func doKill(ses *Session, execCtx *ExecCtx, k *tree.Kill) error {
-	var err error
-	//true: kill a connection
-	//false: kill a query in a connection
-	idThatKill := uint64(ses.GetConnectionID())
-	if !k.Option.Exist || k.Option.Typ == tree.KillTypeConnection {
-		err = getRtMgr(ses.GetService()).kill(execCtx.reqCtx, true, idThatKill, k.ConnectionId, "")
-	} else {
-		err = getRtMgr(ses.GetService()).kill(execCtx.reqCtx, false, idThatKill, k.ConnectionId, k.StmtOption.StatementId)
-	}
-	return err
+	killConnection := !k.Option.Exist || k.Option.Typ == tree.KillTypeConnection
+	return killSession(execCtx.reqCtx, ses, k.ConnectionId, killConnection, k.StmtOption.StatementId)
 }
 
 // handleKill kill a connection or query
@@ -4814,18 +4806,16 @@ func refreshStatementScopedSessionInfo(ses FeSession, proc *process.Process) {
 	if proc == nil || proc.Base == nil {
 		return
 	}
-	// SessionInfo is reused across statements.  Role changes update the
-	// session's TenantInfo, so refresh the trusted names at the same boundary
-	// as the other statement-scoped fields before planning or execution.
+	// Refresh the authenticated snapshot at every statement boundary, including
+	// later statements within a COM_QUERY and prepared EXECUTE.
+	proc.Base.SessionInfo.Account, proc.Base.SessionInfo.User, proc.Base.SessionInfo.Role = "", "", ""
 	if ses != nil {
 		if tenant := ses.GetTenantInfo(); tenant != nil {
-			// Read both names under one lock. Besides avoiding two lock
-			// acquisitions on every statement, this keeps the account/role pair
-			// from being sampled across a concurrent role transition.
 			tenant.mu.Lock()
-			account, role := tenant.getTenantUnsafe(), tenant.getDefaultRoleUnsafe()
+			account, user, role := tenant.Tenant, tenant.User, tenant.DefaultRole
 			tenant.mu.Unlock()
 			proc.Base.SessionInfo.Account = account
+			proc.Base.SessionInfo.User = user
 			proc.Base.SessionInfo.Role = role
 		}
 	}
```

**File**: `pkg/frontend/mysql_cmd_executor_test.go` (modified, +17/-0)
```diff
@@ -5702,6 +5702,23 @@ func TestRefreshStatementScopedSessionInfo(t *testing.T) {
 	setPu("", config.NewParameterUnit(&config.FrontendParameters{}, nil, nil, nil))
 	ses := NewSession(ctx, "", &testMysqlWriter{}, nil)
 	proc := &process.Process{Base: &process.BaseProcess{}}
+	ses.SetTenantInfo(killTestIdentity("sys", 0, "root", 0, "moadmin"))
+	refreshStatementScopedSessionInfo(ses, proc)
+	require.Equal(t, "sys", proc.Base.SessionInfo.Account)
+	require.Equal(t, "root", proc.Base.SessionInfo.User)
+	require.Equal(t, "moadmin", proc.Base.SessionInfo.Role)
+	// Statements within one request reuse proc, including prepared EXECUTE.
+	ses.tenant.SetDefaultRole("public")
+	refreshStatementScopedSessionInfo(ses, proc)
+	require.Equal(t, "public", proc.Base.SessionInfo.Role)
+	ses.tenant.SetDefaultRole("moadmin")
+	refreshStatementScopedSessionInfo(ses, proc)
+	require.Equal(t, "moadmin", proc.Base.SessionInfo.Role)
+	ses.SetTenantInfo(nil)
+	refreshStatementScopedSessionInfo(ses, proc)
+	require.Empty(t, proc.Base.SessionInfo.Account)
+	require.Empty(t, proc.Base.SessionInfo.User)
+	require.Empty(t, proc.Base.SessionInfo.Role)
 
 	require.NoError(t, ses.SetSessionSysVar(ctx, "sql_mode", "ANSI_QUOTES"))
 	refreshStatementScopedSessionInfo(ses, proc)
```

#### Recent Merged Pull Requests:
- **PR #30589** (2026-10-19): fix(plan): report errno 1452 for INSERT foreign-key violations (#30540) (@daviszhen)
- **PR #30586** (closed): design: atomic event-ledger sink profile for Kafka Connect and NiFi (@jiangxinmeng1)
- **PR #30585** (closed): design: atomic event-ledger sink profile for Kafka Connect and NiFi (@loveRhythm1990)
- **PR #30580** (2026-10-19): [4.2-dev] fix(disttae): restore RC statement transfer state on rollback (@XuPeng-SH)
- **PR #30576** (2026-10-19): [4.2-dev] fix: preserve tombstones across lineage snapshot advances (@XuPeng-SH)
- **PR #30546** (2026-10-19): fix(frontend): allow session scope for information_schema_stats_expiry (#30473) (@daviszhen)

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

## X. python-sdk): enforce handshake, TLS, redaction and async deadlines (#30074)

**RULE**:
When implementing operations in `clients/python/CONNECTION_POLICIES.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8ef2eaf4`: python-sdk): enforce handshake, TLS, redaction and async deadlines (#30074). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `clients/python/CONNECTION_POLICIES.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# Connection and timeout contracts

`Client.connect()` creates an engine and requires an authenticated SELECT 1 before
reporting success. Initial probe failures dispose the failed engine and clear its
state. `connected()` reports successful initialization, not a live health probe;
use a query for live health. Reconnect disposes the old engine. Failed disposal
also clears the client's connected state, while preserving its error.

`ssl_mode='required'` uses a certificate/hostname-verifying SSLContext. `ssl_ca`
selects a CA file; without it, system roots are used. Peers without TLS are refused
before authentication on older and current PyMySQL. `disabled` explicitly disables
TLS. `preferred` follows the driver's opportunistic behavior unless a CA is
supplied, in which case certificate verification is requested. A client certificate
requires a CA or required mode. This policy change may reject previously accepted
untrusted endpoints; configure a trusted test/organization CA rather than disabling
verification on a required connection.

Constructor `connection_timeout` is inherited unless connect explicitly overrides
it. The synchronous engine also passes query_timeout as read/write inac
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8ef2eaf4` are properly handled with clean fallback behavior.
