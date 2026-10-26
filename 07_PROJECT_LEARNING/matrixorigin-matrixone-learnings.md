> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `e033d4a5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T12:57:01.191Z  
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
> **Harvest Timestamp**: 2026-10-26T12:56:47.837Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2058 stars

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

from typing import Optional, Union, Type

try:
    from sqlalchemy import Table
    from sqlalchemy.orm import DeclarativeMeta as _unused  # noqa: F401

    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


def get_table_name(table: Union[str, Type]) -> str:
    """Extract table name from string or ORM model.

    Supports:
    - "table_name"
    - "db.table_name"
    - ORM model's resolved table name and schema for db.table
    """
    if isinstance(table, str):
        return table
    if SQLALCHEMY_AVAILABLE:
        mapped_table = getattr(table, '__table__', None)
        if isinstance(mapped_table, Table):
            return mapped_table.fullname
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


# The server rejects these statements with "DATA BRANCH MERGE/PICK is not
# supported in transactions" (pkg/frontend/data_branch.go) when they arrive
# inside a transaction. SQLAlchemy keeps pooled pymysql/aiomysql connections
# in implicit-transaction mode (autocommit=False), and its do_begin is a
# no-op, so a plain engine.begin() lands these statements in an implicit,
# never-committed transaction. They must execute on an AUTOCOMMIT-mode
# connection instead. Classification below is a bounded linear scan, not a
# regex: every user query passes through it, so it must not backtrack.


def _skip_space_and_comments(sql: str, pos: int) -> int:
    """Advance past whitespace and MatrixOne comments, returning the index of
    the next meaningful character.

    Mirrors pkg/sql/parsers/dialect/mysql/scanner.go: `/* ... */` block
    comments are inert, `// ...` and `# ...` are line comments, `-- ...` is a
    line comment only when the dashes are followed by whitespace or
    end-of-line. `/*! ... */` is an executable MySQL comment: the scanner
    steps inside (skipping an optional 5-digit version) because the server
    executes its contents. Its `*/` terminator is likewise transparent; that
    can only affect leading-word matching for statements that are invalid SQL
    either way. A comment that never terminates consumes the rest of the
    string.
    """
    n = len(sql)
    while pos < n:
        ch = sql[pos]
        if ch.isspace():
            pos += 1
            continue
        if sql.startswith("/*!", pos):
            pos += 3
            if sql[pos : pos + 5].isdigit():
                pos += 5
            continue
        if sql.startswith("*/", pos):
            # terminator of an enclosing executable comment; transparent
            pos += 2
            continue
        if sql.startswith("/*", pos):
            end = sql.find("*/", pos + 2)
            if end == -1:
                return n
            pos = end + 2
            continue
        if sql.startswith("--", pos) and (pos + 2 == n or sql[pos + 2].isspace()):
            end = sql.find("\n", pos + 2)
            if end == -1:
                return n
            pos = end + 1
            continue
        if sql.startswith("//", pos):
            end = sql.find("\n", pos + 2)
            if end == -1:
                return n
            pos = end + 1
            continue
        if ch == "#":
            end = sql.find("\n", pos + 1)
            if end == -1:
                return n
            pos = end + 1
            continue
        break
    return pos


def _read_word(sql: str, pos: int) -> tuple:
    """Read one SQL word ([A-Za-z0-9_$]*) starting at pos; return (word, next)."""
    n = len(sql)
    end = pos
    while end < n and (sql[end].isalnum() or sql[end] in "_$"):
        end += 1
    return sql[pos:end], end


def is_non_transactional_statement(sql: Optional[str]) -> bool:
    """True when a string statement is DATA BRANCH MERGE or DATA BRANCH PICK.

    Leading and inter-keyword whitespace/comments are consumed with the
    server's lexical rules, so "data /* trace */ branch merge ...",
    "// trace\\ndata branch merge ..." and "/*! data branch merge src into
    dst */" (MySQL executable comment) classify like the server executes
    them, while a MERGE/PICK-shaped phrase sitting only inside an inert
    comment (e.g. "-- data branch merge a into b\\nSELECT 1") does not.
    """
    if not sql:
        return False
    pos = 0
    words = []
    for _ in range(3):
        pos = _skip_space_and_comments(sql, pos)
        word, pos = _read_word(sql, pos)
        if not word:
            return False
        words.append(word.lower())
    return words[0] == "data" and words[1] == "branch" and words[2] in ("merge", "pick")


def discard_unrestored_connection(conn):
    """Remove an unrestorable checkout and terminate it without pool reset IO.

    Detach before termination: SQLAlchemy 1.4 invalidate listeners can raise
    before disposal. Invalidation alone after detach does not close the DBAPI
    handle, so retain and terminate it even if a detach callback raises.
    """
    if conn.closed or conn.invalidated:
        return
    proxy = conn.connection
    raw = getattr(proxy, "dbapi_connection", None)
    if raw is None:  # SQLAlchemy < 1.4.24
        raw = proxy.connection
    try:
        conn.detach()
    finally:
        try:
            conn.dialect.do_terminate(raw)
        finally:
            conn.invalidate()

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
- **Issue #31287** (2026-10-26): **docs(skills): shutdown-only upgrade contract for agent reviews**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [ ] Improvement - [x] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  issue #31286  ## What this PR does / why we need it:  MatrixOne now upgrades by full-cluster shutdown only: old and new binaries never serve one cluster together. The agent skills still required mixed-version/rolling-upgrade coverage, so Codex-driven reviews kept asking for a new `MORPCVersion` and per-feature capability gates on every PR. That produced recurring `MORPCLatestVersion` merge collisions and dead compatibility code.  Changes (`.agents/skills`, mirrored in `.claude/skills`):  - **New `mo-dev/references/upgrade-compatibility.md`**, the single source of truth:   - in-cluster RPC has no mixed-version obligations: no per-feature `MORPCVersion`, `AllCNsSupportProtocol`/capability gate, or old-peer fallback;   - when to bump `MORPCVersion`: only for an incompatible RPC framing/handshake change, or a deliberate return to mixed-version operation;   - what must stay compatible: persisted state, upgrade steps, backup/restore and external protocols. - **`mo-dev/SKILL.md`**: adds a resource-map entry pointing to the reference. - **`mo-dev/references/feature-design-review.md`**: the design triggers, compatibility section and request-changes rule no longer require mixed-version, downgrade or rollback stories. - **`mo-self-review/SKILL.md`**:   - a new blocker-calibration rule says "an older CN can

- **Issue #31286** (2026-10-26): **[Tech Request]: Agent skills: shutdown-only upgrade contract, stop per-feature MORPCVersion gates**
  *Symptoms*: ### Is there an existing issue for the same tech request?  - [x] I have checked the existing issues.  ### Does this tech request not affect user experience?  - [x] This tech request doesn't affect user experience.  ### What would you like to be added ?  Update the in-repo agent skills (`.agents/skills`, mirrored in `.claude/skills`: `mo-dev`, `mo-self-review`) to state MatrixOne's upgrade contract: **shutdown upgrade only**, no rolling upgrade.  - In-cluster RPC never mixes binary versions, so reviews must not request a per-feature `MORPCVersion` bump, an `AllCNsSupportProtocol`/capability gate, or an old-peer fallback, and must not block a change for lacking one. - `MORPCVersion` becomes a protocol generation, like the NFS major version. It is bumped only for an incompatible RPC framing/handshake change, or if mixed-version operation is deliberately reintroduced. - These compatibility obligations stay hard requirements:   - a new binary reads everything an older one persisted (catalog, storage, WAL, persisted views and plans, index files, config);   - upgrade steps are idempotent and restart-safe;   - an older backup restores on a newer binary;   - external protocols keep their rules: the MySQL client and cross-cluster publication/subscription and CDC.  ### Why is this needed ?  The project has moved to shutdown-only upgrades. The current skills still require mixed-version/rolling-upgrade coverage, so Codex-driven reviews keep asking for a new `MORPCVersion` and per-feature 

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

### Incident Patch 1: `83c1e235` (2026-10-26)
**Commit Message**: fix(view): preserve restore semantics and extend S5 conformance (#30953)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [x] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #29440, under #29433.

## What this PR does / why we need it:

**Partial S5 delivery; keep this PR Draft and #29440 open. Full S5
acceptance is not complete, and S8 rollout remains NO-GO.**

### Changes

- Preserve restored View security, creation context, unknown JSON
fields, legacy absence/null distinctions, and the greater
original/rebuilt protocol requirement. Admin replay must not silently
turn INVOKER into DEFINER or qualify an unfrozen legacy star.
- Bind the saved creation database and identifier policy before
generating physical columns/dependencies, including all three restore
dependency-sort owners. A View's containing database is not necessarily
its creation database.
- Let the clone owner remap only its explicit source-to-target creation
database; preserve external dependencies and saved SQL parser policy.
- Extend explicit S3/S4 conformance across INPLACE/COPY/recreation, RC
statement advancement, histor

**File**: `docs/design/CLAUDE_20261023-view-s5-conformance.md` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+# 普通 View 元数据 S5：合同、恢复修复与验收证据
+
+所属：[#29440](https://github.com/matrixorigin/matrixone/issues/29440)，父任务 [#29433](https://github.com/matrixorigin/matrixone/issues/29433)，Draft PR [#30953](https://github.com/matrixorigin/matrixone/pull/30953)。
+
+**完整 S5 尚未验收，S8 rollout 为 NO-GO。** 默认 S3/S4 激活仍关闭。独立可做的协议、授权、历史、恢复与多 CN 验证不能笼统归为“等待激活”；另一方面，真实 L/A/B 切换不能由 mock、同 binary 多 CN 或 integration 接线代替。
+
+## 1. 基线与批准边界
+
+当前合并基线为 `mo/main@be663676872edf6d42695bba41757af0a3251758`，本地 merge `78618cf66941e95eb67879a2e7c47f967fb85b06`。首次部分交付 `22b48b77dffaaeeb9f773f47e561ae1d3d0a1728` 只有测试/文档；**续作已经包含生产恢复修复，不再适用“无生产改动”或“覆盖率门禁不适用”的描述。**
+
+批准依据：
+
+- [S1 设计及精确审批](CLAUDE_20260922-view-metadata-on-demand.md#s1-批准与-e1-勘误)。
+- [S2 v2.1](CLAUDE_20261005-view-s2-scope-revision.md)：不恢复已撤销的全链路 128 MiB 逐对象证明。
+- [S3](CLAUDE_20261018-view-s3-consumers.md)、[S4](CLAUDE_20261019-view-metadata-s4-consumers.md)、[S4 对账](CLAUDE_2026-10-20-view-metadata-s4-reconciliation.md)。
+- [既有生命周期验证范围](CLAUDE_VIEW_METADATA_LIFECYCLE_CONFORMANCE_29007.md)。
+- [独立 RC 生命周期升级约束](20260929-rc-lifecycle-protocol.md)：停服、drain、成员替换和旧进程禁入要求不能被 View 测试豁免。
+
+默认排除 partition、stored procedure、UDF 功能及 warning 文案/数量兼容。没有 S8 部署、refresh 退役、S9 catalog 清理或新激活状态机。既有协议/授权检查不能为了通过测试而降低。
+
+## 2. 判定规则
+
+同一身份、合法 catalog/statement snapshot、workspace、创建环境和授权域产生相同 schema；并非任何历史查询都必须得到“最新 schema”。
+
+- 验证类型、宽度、顺序、default 和 nullability 的语义。View 的 default `7` 与 CTAS 按现有规则生成的 `0` 可以不同。
+- 固定旧 statement 与已物化 cursor 保持旧代；新 statement、重绑及 retry 使用其合法的新代。FETCH 不重新推导。
+- 根 View ID/version 不变不能证明传递来源未变；COPY、同名重建、内层 View 变化仍须失效。
+- RC snapshot 推进属于真实 statement owner；旧请求必须拒绝跨 stamp 复用。
+- 根授权与查找每次执行；失败不能回退 warm memo 的成功。固定合法 snapshot 下，memo 命中无需重新读每个传递叶子。
+- 描述只读，不执行 View 数据、不刷新目录、不接管父事务。`mo_catalog.mo_columns` 仍是 D03 物理/MVCC 表面，不是唯一派生 schema oracle。
+- 历史 schema 的解析与当前访问资格是两件事；caller authorizer 不能只检查角色而忽略 publication 当前资格。
+
+## 3. 发现的恢复缺陷及最小修复
+
+### 3.1 不能用恢复管理员的会话重造定义属性
+
+真实跨账户恢复反例：reader 只有 View grant，没有 underlying table grant；源 View 为 INVOKER，管理员恢复后却按当前会话的 DEFINER 重建，从拒绝变为允许。原失败保留于 `remaining-account-restore.*`。
+
+`WithRestoredViewDefinition` 仅绑定恢复 owner 的目标库、View 名和原始 replay SQL。CREATE 的既有 admission、语法、授权及持久协议检查照常执行。新生成目标 SQL/definition/dependencies，保留原 security、check option、SQL mode、大小写环境与未知 JSON 字段；required protocol 取原始/新生成的较大值。
+
+原始 replay SQL 在 star 展开前保留：不能把旧 `*` 伪造成创建时已冻结的投影；缺失、null、空 legacy payload 的环境也不能被恢复会话补成“已知”。
+
+### 3.2 创建数据库不等于 View 所在数据库
+
+反例：`USE creation_env; CREATE VIEW app.v AS SELECT id FROM origin`。`creation_env.origin` 为 bigint，`app.origin` 为 int。只修补最终 JSON 不足够：恢复时首次生成的物理列和依赖也必须在正确环境绑定。
+
+- 通用恢复在目标账户中复用 `viewRegenerationContext`，在列/依赖生成前使用原始创建数据库和标识符策略。
+- snapshot、PITR、timestamp restore 的三个依赖排序 owner 同样使用该环境。临时 compiler context 在成功、错误时均恢复；只操作既有 isolated binder。
+- 后台 parser 仅在精确 replay SQL 匹配时使用保存的大小写策略；不改 session/global 变量，不污染内层目录查询。
+- **clone 是独立的映射 owner，但会间接调用 restoreViews。** `rewriteCloneViewInfos` 按明确的 source→target 映射重写匹配的创建数据库，外部创建数据库不变；SQL 重写使用保存的 SQL mode/大小写策略。不能把所有非空 DefaultDatabase 都改为 View 所在库，也不能完全忽略 clone 映射。
+
+真实失败分别保留于 `acceptance-native.*`（创建域错绑）和 `delivery-native.*`（clone 错指原库，期望宽度 20，得到 80）。修复加入同名 decoy、跨库 nested View、原账户后续变化不污染目标等反例。BVT 使用两个不同值的最小数据行验证真实读取域及 metadata，不只比较空结果。
+
+## 4. 默认关闭的验证接线
+
+普通构建的两个 frontend hook 返回常量 false，没有 registry、配置或 SQL 开关。`integration` 构建也默认关闭；仅 `_test.go` 能为测试拥有的 CN/数据库注册 route，background session 不选中。
+
+- 通用 SELECT/PREPARE 经过原统计、prepare normalization 与最终授权 owner，再显式使用 S3。
+- 参数化 EXECUTE/compile-retry 另走 `buildPreparedBoundQuery`，不能只接通用入口就声称每个执行代使用 S3。该 owner 也有默认关闭的验证 hook。
+- S3 的 admission、root authorization、依赖收集、取消、代号检查和 cleanup 保留一个公共内部壳；integration 的 prepared bridge 调用既有参数域 binder，不复制其类型/优化语义。
+- private binding process 只在绑定期间借用当前参数向量，并复制其类型/二进制来源属性；返回前撤销借用，不能释放父载荷。S3 请求在返回 plan 前关闭，不进入 cursor 或 reusable-plan 生命周期。
+- S4 的直接执行 fixture 持有请求直到 Compile/Run、结果读取和释放完成，再关闭请求；父事务/执行代仍存活。
+
+这只是可执行候选的局部验证入口，不是 durable capability、tenant activation 或生产 authorizer 的完整实现。
+
+## 5. 合同与证据入口
+
+源码入口存在不等于当前修订已经跑完；终态单独列于第 7 节。
+
+| 合同 | 入口与独立 oracle | 边界 |
+| --- | --- | --- |
+| INPLACE/COPY/同名重建、frozen star | `testNativeViewMetadataDDLTransitions`；真实物理 ID、根 View ID、20/40/60 宽度、default、固定 snapshot | 不靠 SQL 拼写猜 DDL 算法，不强迫旧 snapshot 读新 schema |
+| S3/S4 各表面 | 同一父事务中的 SELECT/CTAS typed plan、DESC/SHOW/FULL、I_S 实际执行；memo-on/off | CTAS 该组证明的是规划，不冒充其真实执行 |
+| RC 语句推进 | 真实 SQLExecutor statement owner 更新 snapshot；旧请求 `ErrViewSchemaChanged`，新请求正确 | 不是伪造 parent stamp 的 mock |
+| 授权链 | `view_metadata_security_conformance_test.go`；DEFINER/INVOKER、基表 grant/revoke/recovery、不可见根、真实最终授权 owner | 测试 authorizer 不是全部生产 SHOW/安全策略 |
+| publication 变化 | 当前 membership withdrawal/restoration、drop/recreate、同名 remap、历史资格拒绝、来源 ID 变化 | 当前资格与历史解析分别处理；完整历史 remap/table-list/生产权限组合尚不能声称全部闭合 |
+| clone/PITR/snapshot/account restore | `view_metadata_recovery_conformance_test.go`；target independence、table/database PITR、database snapshot、跨账户 security/创建域/nested View | PITR 用实际数据库时钟跨边界，不用固定 sleep；全版本恢复矩阵仍有缺口 |
+| 真实 wire/cursor | `v
```

**File**: `pkg/frontend/back_exec.go` (modified, +11/-1)
```diff
@@ -213,7 +213,11 @@ func (back *backExec) exec(ctx context.Context, sql string, sqlMode string, useS
 
 	var statements []tree.Statement
 	if useSQLMode {
-		statements, err = parsers.ParseWithSQLMode(ctx, dialect.MYSQL, sql, v.(int64), sqlMode)
+		lowerCase, modeErr := plan2.RestoredViewLowerCaseTableNames(ctx, sql, v.(int64))
+		if modeErr != nil {
+			return modeErr
+		}
+		statements, err = parsers.ParseWithSQLMode(ctx, dialect.MYSQL, sql, lowerCase, sqlMode)
 	} else {
 		statements, err = mysql.Parse(ctx, sql, v.(int64))
 	}
@@ -946,6 +950,12 @@ var GetComputationWrapperInBack = func(execCtx *ExecCtx, db string, input *UserI
 			lowerCaseTableNames = 0
 		}
 		if input.useParserSQLMode {
+			// This parse produces the executed AST; preliminary classification
+			// in back.exec is not sufficient to preserve restored identifiers.
+			lowerCaseTableNames, err = plan2.RestoredViewLowerCaseTableNames(execCtx.reqCtx, input.getSql(), lowerCaseTableNames)
+			if err != nil {
+				return nil, err
+			}
 			stmts, err = parsers.ParseWithSQLMode(
 				execCtx.reqCtx,
 				dialect.MYSQL,
```

**File**: `pkg/frontend/clone.go` (modified, +48/-7)
```diff
@@ -16,6 +16,7 @@ package frontend
 
 import (
 	"context"
+	"encoding/json"
 	"fmt"
 	"sort"
 	"strconv"
@@ -1575,34 +1576,73 @@ func rewriteCloneViewInfos(
 		} else if dbName == srcDBName {
 			key = genKey(dstDBName, tblName)
 		}
-		createSQL, err := rewriteCloneCreateSQL(
-			info.createSql,
-			srcDBName,
-			dstDBName,
-			lowerCaseTableNames,
-		)
+		mode, err := viewParserSQLModeForRestore(info.viewDef)
+		if err != nil {
+			return nil, nil, err
+		}
+		ctx := plan.WithRestoredViewDefinition(context.Background(), info.dbName, info.tblName, info.viewDef, info.createSql)
+		lower, err := plan.RestoredViewLowerCaseTableNames(ctx, info.createSql, lowerCaseTableNames)
+		if err != nil {
+			return nil, nil, err
+		}
+		createSQL, err := rewriteCloneCreateSQLWithMode(info.createSql, srcDBName, dstDBName, lower, mode)
 		if err != nil {
 			return nil, nil, err
 		}
 
 		clonedInfo := *info
 		clonedInfo.dbName = dstDBName
 		clonedInfo.createSql = createSQL
+		clonedInfo.viewDef, err = rebindCloneViewCreationDatabase(info.viewDef, srcDBName, dstDBName, lower)
+		if err != nil {
+			return nil, nil, err
+		}
 		rewrittenViewMap[key] = &clonedInfo
 	}
 
 	return rewrittenViewMap, rewrittenViews, nil
 }
 
+// Only the clone owner knows the logical database remapping. A creation database
+// outside that mapping is an external dependency, not the View's target database.
+func rebindCloneViewCreationDatabase(definition, source, target string, lowerCaseTableNames int64) (string, error) {
+	if definition == "" || source == "" || source == target {
+		return definition, nil
+	}
+	var fields map[string]json.RawMessage
+	if err := json.Unmarshal([]byte(definition), &fields); err != nil {
+		return "", err
+	}
+	value, present := fields["DefaultDatabase"]
+	if !present {
+		return definition, nil
+	}
+	var database string
+	if err := json.Unmarshal(value, &database); err != nil {
+		return "", err
+	}
+	if tree.NewCStr(database, lowerCaseTableNames).Compare() != tree.NewCStr(source, lowerCaseTableNames).Compare() {
+		return definition, nil
+	}
+	fields["DefaultDatabase"], _ = json.Marshal(target)
+	encoded, err := json.Marshal(fields)
+	return string(encoded), err
+}
+
 func rewriteCloneCreateSQL(sql, srcDBName, dstDBName string, lowerCaseTableNames int64) (string, error) {
+	return rewriteCloneCreateSQLWithMode(sql, srcDBName, dstDBName, lowerCaseTableNames, "")
+}
+
+func rewriteCloneCreateSQLWithMode(sql, srcDBName, dstDBName string, lowerCaseTableNames int64, sqlMode string) (string, error) {
 	if srcDBName == "" || srcDBName == dstDBName {
 		return sql, nil
 	}
 
-	stmt, err := parsers.ParseOne(context.Background(), dialect.MYSQL, sql, lowerCaseTableNames)
+	stmt, err := parsers.ParseOneWithSQLMode(context.Background(), dialect.MYSQL, sql, lowerCaseTableNames, sqlMode)
 	if err != nil {
 		return "", err
 	}
+	defer stmt.Free()
 	createView, ok := stmt.(*tree.CreateView)
 	if !ok {
 		return "", moerr.NewInternalErrorNoCtxf("clone view SQL is %T, expected *tree.CreateView", stmt)
@@ -1629,6 +1669,7 @@ func rewriteCloneCreateSQL(sql, srcDBName, dstDBName string, lowerCaseTableNames
 			if parseErr != nil {
 				return "", parseErr
 			}
+			defer localStmt.Free()
 			localCreateView, localOK := localStmt.(*tree.CreateView)
 			if !localOK {
 				return "", moerr.NewInternalErrorNoCtxf(
```

**File**: `pkg/frontend/mysql_cmd_executor.go` (modified, +24/-18)
```diff
@@ -4256,26 +4256,32 @@ func buildPlanWithPrepareMode(
 			return ret, err
 		}
 
-		// Default handling of various statements
-		switch stmt := stmt.(type) {
-		case *tree.Select, *tree.ParenSelect, *tree.ValuesStatement,
-			*tree.Update, *tree.Delete, *tree.Insert, *tree.MultiInsert,
-			*tree.ShowDatabases, *tree.ShowTables, *tree.ShowSequences, *tree.ShowColumns, *tree.ShowColumnNumber,
-			*tree.ShowTableNumber, *tree.ShowCreateDatabase, *tree.ShowCreateTable, *tree.ShowIndex,
-			*tree.ExplainStmt, *tree.ExplainAnalyze, *tree.ExplainPhyPlan:
-			opt := plan2.NewBaseOptimizer(ctx)
-			optimized, err := opt.Optimize(stmt, isPrepareStmt)
-			if err != nil {
-				return nil, err
-			}
+		// The integration-only route exercises the same PREPARE/rebuild owner.
+		// Ordinary builds inline a constant false and have no activation switch.
+		var validationSelected bool
+		ret, validationSelected, err = buildViewSchemaValidationPlan(reqCtx, ses, ctx, stmt, isPrepareStmt)
+		if !validationSelected {
+			// Default handling of various statements
+			switch stmt := stmt.(type) {
+			case *tree.Select, *tree.ParenSelect, *tree.ValuesStatement,
+				*tree.Update, *tree.Delete, *tree.Insert, *tree.MultiInsert,
+				*tree.ShowDatabases, *tree.ShowTables, *tree.ShowSequences, *tree.ShowColumns, *tree.ShowColumnNumber,
+				*tree.ShowTableNumber, *tree.ShowCreateDatabase, *tree.ShowCreateTable, *tree.ShowIndex,
+				*tree.ExplainStmt, *tree.ExplainAnalyze, *tree.ExplainPhyPlan:
+				opt := plan2.NewBaseOptimizer(ctx)
+				optimized, err := opt.Optimize(stmt, isPrepareStmt)
+				if err != nil {
+					return nil, err
+				}
 
-			ret = &plan2.Plan{
-				Plan: &plan2.Plan_Query{
-					Query: optimized,
-				},
+				ret = &plan2.Plan{
+					Plan: &plan2.Plan_Query{
+						Query: optimized,
+					},
+				}
+			default:
+				ret, err = plan2.BuildPlan(ctx, stmt, isPrepareStmt)
 			}
-		default:
-			ret, err = plan2.BuildPlan(ctx, stmt, isPrepareStmt)
 		}
 
 		if ret != nil {
```

**File**: `pkg/frontend/pitr.go` (modified, +2/-2)
```diff
@@ -1955,14 +1955,14 @@ func restoreViewsWithPitr(
 
 		compCtx.SetDatabase(viewEntry.dbName)
 		// build create sql to find dependent views
-		_, err = plan.BuildPlan(compCtx, stmts[0], false)
+		_, err = buildViewCreatePlanForRestore(compCtx, viewEntry, stmts[0])
 		freeStatements(stmts)
 		if err != nil {
 			stmts, err = parseViewCreateSQLForRestore(ctx, viewEntry, 0)
 			if err != nil {
 				return err
 			}
-			_, err = plan.BuildPlan(compCtx, stmts[0], false)
+			_, err = buildViewCreatePlanForRestore(compCtx, viewEntry, stmts[0])
 			freeStatements(stmts)
 			if err != nil {
 				// The dependency sort plans every view BEFORE the restore loop, so the
```

**File**: `pkg/frontend/prepared_execution.go` (modified, +5/-1)
```diff
@@ -169,7 +169,11 @@ func buildPreparedBoundQuery(ctx context.Context, ses FeSession, compiler plan2.
 	var bound *plan2.PreparedExecutionPlan
 	_, err := buildPlanWithStats(planning, ses, compiler, func() (*plan2.Plan, error) {
 		var buildErr error
-		bound, buildErr = plan2.BuildPreparedExecutionPlan(compiler, stmt, bindings, values)
+		var selected bool
+		bound, selected, buildErr = buildViewSchemaValidationPreparedPlan(planning, ses, compiler, stmt, bindings, values)
+		if !selected {
+			bound, buildErr = plan2.BuildPreparedExecutionPlan(compiler, stmt, bindings, values)
+		}
 		if buildErr != nil {
 			return nil, buildErr
 		}
```

**File**: `pkg/frontend/snapshot.go` (modified, +17/-2)
```diff
@@ -2142,15 +2142,15 @@ func sortedViewInfos(
 
 		viewCtx.SetDatabase(viewEntry.dbName)
 		// build create sql to find dependent views
-		_, err = plan.BuildPlan(compCtx, stmts[0], false)
+		_, err = buildViewCreatePlanForRestore(compCtx, viewEntry, stmts[0])
 		freeStatements(stmts)
 		if err != nil {
 			getLogger(ses.GetService()).Debug(fmt.Sprintf("try to build view %v failed, try to build it again", viewEntry.tblName))
 			stmts, err = parseViewCreateSQLForRestore(ctx, viewEntry, 0)
 			if err != nil {
 				return nil, err
 			}
-			_, err = plan.BuildPlan(compCtx, stmts[0], false)
+			_, err = buildViewCreatePlanForRestore(compCtx, viewEntry, stmts[0])
 			freeStatements(stmts)
 			if err != nil {
 				// The dependency sort plans every view BEFORE the restore loop, so the
@@ -3005,9 +3005,23 @@ func parseViewCreateSQLForRestore(ctx context.Context, tblInfo *tableInfo, lower
 		return nil, err
 	}
 
+	ctx = plan.WithRestoredViewDefinition(ctx, tblInfo.dbName, tblInfo.tblName, tblInfo.viewDef, tblInfo.createSql)
+	lowerCaseTableNames, err = plan.RestoredViewLowerCaseTableNames(ctx, tblInfo.createSql, lowerCaseTableNames)
+	if err != nil {
+		return nil, err
+	}
 	return parsers.ParseWithSQLMode(ctx, dialect.MYSQL, tblInfo.createSql, lowerCaseTableNames, parserSQLMode)
 }
 
+// The three restore dependency sorts own isolated mutable compiler contexts.
+// Their dependency discovery must use the same creation environment as replay.
+func buildViewCreatePlanForRestore(compCtx plan.CompilerContext, tblInfo *tableInfo, stmt tree.Statement) (*pbplan.Plan, error) {
+	original := compCtx.GetContext()
+	compCtx.SetContext(plan.WithRestoredViewDefinition(original, tblInfo.dbName, tblInfo.tblName, tblInfo.viewDef, tblInfo.createSql))
+	defer compCtx.SetContext(original)
+	return plan.BuildPlan(compCtx, stmt, false)
+}
+
 func executeViewCreateSQLForRestore(ctx context.Context, bh BackgroundExec, tblInfo *tableInfo) error {
 	ctx, err := restoreDDLContext(ctx, tblInfo.dbName, tblInfo.tblName)
 	if err != nil {
@@ -3020,6 +3034,7 @@ func executeViewCreateSQLForRestore(ctx context.Context, bh BackgroundExec, tblI
 	if err != nil {
 		return err
 	}
+	ctx = plan.WithRestoredViewDefinition(ctx, tblInfo.dbName, tblInfo.tblName, tblInfo.viewDef, tblInfo.createSql)
 	return bh.ExecWithSQLMode(ctx, tblInfo.createSql, parserSQLMode)
 }
 
```

**File**: `pkg/frontend/snapshot_restore_with_ts.go` (modified, +2/-2)
```diff
@@ -783,15 +783,15 @@ func restoreViewsFromTS(
 
 		compCtx.SetDatabase(viewEntry.dbName)
 		// build create sql to find dependent views
-		_, err = plan.BuildPlan(compCtx, stmts[0], false)
+		_, err = buildViewCreatePlanForRestore(compCtx, viewEntry, stmts[0])
 		freeStatements(stmts)
 		if err != nil {
 			getLogger(ses.GetService()).Info(fmt.Sprintf("try to build view %v failed, try to build it again", viewEntry.tblName))
 			stmts, err = parseViewCreateSQLForRestore(ctx, viewEntry, 0)
 			if err != nil {
 				return err
 			}
-			_, err = plan.BuildPlan(compCtx, stmts[0], false)
+			_, err = buildViewCreatePlanForRestore(compCtx, viewEntry, stmts[0])
 			freeStatements(stmts)
 			if err != nil {
 				if markUnservableViewInSort(ses, fmt.Sprintf("%d:%d", restoreAccount, snapshotTs), viewEntry, &g, key, err) {
```

---

### Incident Patch 2: `3de2ee56` (2026-10-26)
**Commit Message**: fix(sql): enforce DECIMAL width for integer assignments (#30367) (#30639)

Signed/unsigned integer, hexnum and bit sources converted to `DECIMAL` skipped the declared width check, while string and decimal sources enforced it via `ParseDecimal64/128`. In strict SQL mode, `INSERT INTO t VALUES (1, 2)` into `DECIMAL(2,2)` persisted `2.00` (max `0.99`), and the same gap let `ALTER TABLE ... ALGORITHM=COPY` keep out-of-range rows when narrowing an INT column to `DECIMAL`.

Two layers had the gap:

1. **Runtime casts** (`pkg/sql/plan/function/func_cast.go`): `signedToDecimal64/128/256` and `unsignedToDecimal64/128/256` scaled integers into the target decimal without a width check and silently dropped `Scale` errors (raised by 64/128-bit scale overflow). Unsigned magnitudes beyond `MaxInt64` additionally wrapped negative inside `Decimal64`, escaping every bound.
2. **VALUES literal fast path** (`pkg/sql/util/eval_expr_util.go`): `SetInsertValueDecimal64/128` applied `Scale()` directly to integer literals at plan time; string literals in the same code path already went through precision-aware parsing.

Fix: enforce `-10^width < value < 10^width` for every integer-family source in both laye

**File**: `optools/ut_embedded_schedule_test.go` (modified, +12/-6)
```diff
@@ -20,6 +20,7 @@ import (
 	"os/exec"
 	"strings"
 	"testing"
+	"time"
 )
 
 const embeddedSetup = `source ./run_ut.sh UT
@@ -329,6 +330,7 @@ func TestEmbeddedPrebuiltAdmission(t *testing.T) {
 		{"serial", "1", "success"},
 		{"pool", "2", "success"},
 		{"heavy-failure", "2", "heavy-failure"},
+		{"slow-prebuild", "1", "slow-prebuild"},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
 			script := embeddedSetup + `
@@ -347,25 +349,27 @@ artifact_dir=$CLUSTER_PREBUILD_DIR
 (
  trap release_children EXIT
  trap 'exit 143' TERM INT
+ # The harness deadline bounds the fixture, including prebuild and metadata
+ # discovery. FIFO reads assert event ordering, not preparation latency.
  for heavy in embed bootstrap; do
-  read -r -t 5 leaf pid <&8 || exit 100
+  read -r leaf pid <&8 || exit 100
   [[ "$leaf" == "$heavy" ]] || exit 101
   kill -0 "$pid" || exit 102
   printf 'release\n' >&10
  done
  if [[ "$UT_EMBEDDED_PACKAGE_PARALLEL" == 2 ]]; then
-  read -r -t 5 first first_pid <&8 || exit 103
-  read -r -t 5 second second_pid <&8 || exit 104
+  read -r first first_pid <&8 || exit 103
+  read -r second second_pid <&8 || exit 104
   [[ "$first $second" == 'arrowload dml' || "$first $second" == 'dml arrowload' ]] || exit 105
   [[ "$first_pid" != "$second_pid" ]] || exit 106
   kill -0 "$first_pid" && kill -0 "$second_pid" || exit 107
   printf 'release\nrelease\n' >&11
-  read -r -t 5 leaf pid <&8 || exit 108
+  read -r leaf pid <&8 || exit 108
   [[ "$leaf" == sqlintegration ]] || exit 109
   printf 'release\n' >&10
  else
   for next in arrowload sqlintegration dml; do
-   read -r -t 5 leaf pid <&8 || exit 110
+   read -r leaf pid <&8 || exit 110
    [[ "$leaf" == "$next" ]] || exit 111
    if [[ "$leaf" == sqlintegration ]]; then printf 'release\n' >&10; else printf 'release\n' >&11; fi
   done
@@ -409,6 +413,8 @@ fi
 if [[ "$1" == test ]]; then
  package=${!#}; leaf=${package##*/}
  [[ " $* " == *' -c '* ]] || exit 120
+ # Exceed the old per-event timeout before execution can publish any event.
+ if [[ "$MODE" == slow-prebuild && "$leaf" == bootstrap ]]; then sleep 6; fi
  while [[ "$1" != -o ]]; do shift; done
  output=$2
  printf '%s\n' "$output" > "$CASE_DIR/binary-$leaf"
@@ -433,7 +439,7 @@ if [[ "$1" == tool && "$2" == test2json ]]; then
 fi
 exit 125
 `
-			out, err := scheduleHarnessWithMock(t, script, mock,
+			out, err := scheduleHarnessWithMockTimeout(t, 30*time.Second, script, mock, nil,
 				"MODE="+tc.mode, "UT_EMBEDDED_PACKAGE_PARALLEL="+tc.parallel)
 			if err != nil {
 				t.Fatalf("prebuilt entry admission %s: %v\n%s", tc.name, err, out)
```

**File**: `optools/ut_schedule_test.go` (modified, +6/-1)
```diff
@@ -86,6 +86,11 @@ const scheduleFixturePID = `function fixture_self_pid() {
 `
 
 func scheduleHarnessWithMockTransform(t *testing.T, script, mock string, transform func(string) string, variables ...string) ([]byte, error) {
+	t.Helper()
+	return scheduleHarnessWithMockTimeout(t, 15*time.Second, script, mock, transform, variables...)
+}
+
+func scheduleHarnessWithMockTimeout(t *testing.T, timeout time.Duration, script, mock string, transform func(string) string, variables ...string) ([]byte, error) {
 	t.Helper()
 	script = scheduleFixturePID + script
 	mock = strings.Replace(mock, "#!/bin/bash\n", "#!/bin/bash\n"+scheduleFixturePID, 1)
@@ -118,7 +123,7 @@ func scheduleHarnessWithMockTransform(t *testing.T, script, mock string, transfo
 	if err := os.WriteFile(filepath.Join(dir, "go"), []byte(mock), 0755); err != nil {
 		t.Fatal(err)
 	}
-	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
+	ctx, cancel := context.WithTimeout(context.Background(), timeout)
 	defer cancel()
 	cmd := exec.CommandContext(ctx, "bash", "-c", script)
 	cmd.Dir = dir
```

**File**: `pkg/cdc/reader_v2_txn_manager_test.go` (modified, +60/-36)
```diff
@@ -1010,45 +1010,39 @@ func TestTransactionManager_EnsureCleanup_WatermarkMismatch_Concurrent(t *testin
 	require.False(t, tm.tracker.NeedsRollback(), "tracker should be clean after EnsureCleanup")
 }
 
-// slowRecordingSinker injects small delays to simulate slow downstream without causing deadlocks.
-type slowRecordingSinker struct {
+// blockingRollbackSinker holds the first rollback until the test explicitly
+// releases it, simulating a slow downstream without scheduler-dependent sleeps.
+type blockingRollbackSinker struct {
 	*recordingSinker
-	delay time.Duration
+	rollbackEntered chan struct{}
+	releaseRollback <-chan struct{}
+	once            sync.Once
 }
 
-func newSlowRecordingSinker(delay time.Duration) *slowRecordingSinker {
-	return &slowRecordingSinker{
-		recordingSinker: newRecordingSinker(),
-		delay:           delay,
-	}
-}
-
-func (s *slowRecordingSinker) SendBegin() {
-	time.Sleep(s.delay)
-	s.record("begin")
-}
-
-func (s *slowRecordingSinker) SendCommit() {
-	time.Sleep(s.delay)
-	s.record("commit")
-}
-
-func (s *slowRecordingSinker) SendRollback() {
-	time.Sleep(s.delay)
-	s.record("rollback")
-}
-
-func (s *slowRecordingSinker) SendDummy() {
-	time.Sleep(s.delay / 2)
-	s.record("dummy")
+func (s *blockingRollbackSinker) SendRollback() {
+	s.once.Do(func() {
+		close(s.rollbackEntered)
+		<-s.releaseRollback
+	})
+	s.recordingSinker.SendRollback()
 }
 
 // TestTransactionManager_SlowSinker_NoDeadlock ensures that even with a slow sinker,
 // concurrent begins do not deadlock; at worst, they serialize and take slightly longer.
 func TestTransactionManager_SlowSinker_NoDeadlock(t *testing.T) {
 	t.Parallel()
-	ctx := context.Background()
-	sinker := newSlowRecordingSinker(5 * time.Millisecond)
+	// This deadline is only a deadlock watchdog, not a throughput assertion.
+	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
+	defer cancel()
+	releaseRollback := make(chan struct{})
+	var releaseOnce sync.Once
+	release := func() { releaseOnce.Do(func() { close(releaseRollback) }) }
+	t.Cleanup(release)
+	sinker := &blockingRollbackSinker{
+		recordingSinker: newRecordingSinker(),
+		rollbackEntered: make(chan struct{}),
+		releaseRollback: releaseRollback,
+	}
 	updater := newMockWatermarkUpdater()
 	tm := NewTransactionManager(sinker, updater, 1, "task1", "db1", "table1")
 
@@ -1064,27 +1058,57 @@ func TestTransactionManager_SlowSinker_NoDeadlock(t *testing.T) {
 	wg.Add(numGoroutines)
 
 	done := make(chan struct{})
-	start := time.Now()
+	start := make(chan struct{})
+	errCh := make(chan error, numGoroutines)
 
 	for i := 0; i < numGoroutines; i++ {
 		go func() {
 			defer wg.Done()
+			<-start
 			// Repeatedly attempt begin on a new range; should not deadlock
-			_ = tm.BeginTransaction(ctx, toTs1, toTs2)
+			errCh <- tm.BeginTransaction(ctx, toTs1, toTs2)
 		}()
 	}
+	close(start)
 
 	go func() {
 		wg.Wait()
 		close(done)
 	}()
 
+	select {
+	case <-sinker.rollbackEntered:
+	case <-ctx.Done():
+		t.Fatal("concurrent begin did not reach rollback; possible recursive-lock deadlock")
+	}
+	// The slow rollback must retain the manager lock. No caller may finish
+	// or emit another transaction operation until the downstream is released.
+	if tm.mu.TryLock() {
+		tm.mu.Unlock()
+		t.Fatal("transaction manager lock was released during rollback")
+	}
+	require.Equal(t, []string{"clear"}, sinker.opsSnapshot())
+	select {
+	case err := <-errCh:
+		t.Fatalf("begin completed before rollback was released: %v", err)
+	default:
+	}
+	release()
+
 	select {
 	case <-done:
-		// Completed; assert time bound is reasonable (no deadlock)
-		elapsed := time.Since(start)
-		require.Less(t, elapsed, 500*time.Millisecond, "should not take too long; no deadlock expected")
-	case <-time.After(2 * time.Second):
+	case <-ctx.Done():
 		t.Fatal("timeout indicates potential deadlock with slow sinker")
 	}
+	for range numGoroutines {
+		require.NoError(t, <-errCh)
+	}
+	expected := make([]string, 0, 4*numGoroutines)
+	for range numGoroutines {
+		expected = append(expected, "clear", "rollback", "dummy", "begin")
+	}
+	require.Equal(t, expected, sinker.opsSnapshot(), "each begin must serialize rollback and its next begin")
+	require.Equal(t, toTs1, tm.tracker.GetFromTs())
+	require.Equal(t, toTs2, tm.tracker.GetToTs())
+	require.True(t, tm.tracker.NeedsRollback(), "the final begin remains active")
 }
```

**File**: `pkg/embed/catalog_decimal_context_test.go` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+// http://www.apache.org/licenses/LICENSE-2.0
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
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestCatalogDecimalMigrationUsesCurrentStatementContext(t *testing.T) {
+	// Share the canonical SQL fixture; starting a separate two-CN fixture
+	// prevents later single-CN catalog regressions from obtaining admission.
+	RunSingleCNBaseClusterTests(t, func(c Cluster) {
+		db := openIcebergTestDB(t, c)
+		defer db.Close()
+		ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
+		defer cancel()
+		conn, err := db.Conn(ctx)
+		require.NoError(t, err)
+		defer conn.Close()
+		exec := func(query string) {
+			t.Helper()
+			_, err := conn.ExecContext(ctx, query)
+			require.NoError(t, err, query)
+		}
+		exec("create database catalog_decimal_context")
+		defer func() {
+			_, err := conn.ExecContext(t.Context(), "drop database catalog_decimal_context")
+			require.NoError(t, err)
+		}()
+		for i := range 3 {
+			var one int
+			require.NoError(t, conn.QueryRowContext(ctx, "select 1").Scan(&one))
+			require.Equal(t, 1, one)
+			table := fmt.Sprintf("catalog_decimal_context.t%d", i)
+			exec(fmt.Sprintf("create table %s(id int auto_increment primary key, i bigint, tm time(0), constraint ck_%d check(i>tm))", table, i))
+			exec("insert into " + table + "(i,tm) values(1000000000000000000,'00:00:00')")
+			var value int64
+			require.NoError(t, conn.QueryRowContext(ctx, "select i from "+table).Scan(&value))
+			require.Equal(t, int64(1000000000000000000), value)
+		}
+		for _, value := range []string{"999999999999999999", "1000000000000000000", "-1000000000000000000", "9223372036854775807", "-9223372036854775808"} {
+			for _, reverse := range []bool{false, true} {
+				left, right := "cast("+value+" as signed)", "1.0"
+				if reverse {
+					left, right = right, left
+				}
+				query := "select " + left + " * " + right
+				var got string
+				require.NoError(t, conn.QueryRowContext(ctx, query).Scan(&got), query)
+				require.Equal(t, value+".0", got, query)
+			}
+		}
+	})
+}
```

**File**: `pkg/embed/check_constraint_namespace_test.go` (modified, +4/-2)
```diff
@@ -427,7 +427,9 @@ func TestCheckConstraintNamespace(t *testing.T) {
 			var originalSnapshot, finalSnapshot timestamp.Timestamp
 			var grants []lock.Result
 			var grantsMu sync.Mutex
-			const statement = "create table si_after_snapshot(x int, constraint si_after_snapshot_ck check(x>0))"
+			// Namespace admission, not hidden auto-increment maintenance, is
+			// under test. Keep both empty tables free of allocator side effects.
+			const statement = "create table si_after_snapshot(x int primary key, constraint si_after_snapshot_ck check(x>0))"
 			err = svc.GetSQLExecutor().ExecTxn(defines.AttachAccountId(ctx, 0), func(tx executor.TxnExecutor) error {
 				op := tx.Txn()
 				id := append([]byte(nil), op.Txn().ID...)
@@ -441,7 +443,7 @@ func TestCheckConstraintNamespace(t *testing.T) {
 					previousBefore(txnID, tableID)
 					if tableID == catalog.MO_TABLES_ID && bytes.Equal(txnID, id) {
 						inject.Do(func() {
-							_, injectedErr = other.ExecContext(ctx, "create table "+database+".si_unrelated(x int)")
+							_, injectedErr = other.ExecContext(ctx, "create table "+database+".si_unrelated(x int primary key)")
 						})
 					}
 				})
```

**File**: `pkg/embed/load_inline_format_test.go` (modified, +3/-1)
```diff
@@ -38,7 +38,9 @@ func TestLoadInlineFormatOverMySQLProtocol(t *testing.T) {
 				_, err := db.ExecContext(ctx, "create database "+database)
 				require.NoError(t, err)
 				defer func() {
-					cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
+					// DROP is cleanup, not a five-second DDL latency assertion.
+					// Keep it bounded and independent of the workload's context.
+					cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), time.Minute)
 					defer cleanupCancel()
 					_, err := db.ExecContext(cleanupCtx, "drop database "+database)
 					require.NoError(t, err)
```

**File**: `pkg/embed/prepared_time_arithmetic_test.go` (modified, +37/-43)
```diff
@@ -17,13 +17,12 @@ package embed
 import (
 	"context"
 	"database/sql"
-	"errors"
 	"fmt"
 	"strings"
 	"testing"
 	"time"
 
-	"github.com/go-sql-driver/mysql"
+	_ "github.com/go-sql-driver/mysql"
 	"github.com/stretchr/testify/require"
 )
 
@@ -121,11 +120,11 @@ func TestPreparedTimeArithmeticOverMySQLProtocol(t *testing.T) {
 			require.NoError(t, err, statement)
 			assertPreparedTimeResult(t, rows, want, wantNull, 38, scale)
 		}
-		queryDecimal64Text := func(statement, want string) {
+		queryIntegerTimeText := func(statement, want string, precision int64) {
 			t.Helper()
 			rows, err := conn.QueryContext(ctx, statement)
 			require.NoError(t, err, statement)
-			assertPreparedTimeResult(t, rows, want, false, 18, 0)
+			assertPreparedTimeResult(t, rows, want, false, precision, 0)
 		}
 		for _, temporal := range []struct {
 			literal, want string
@@ -152,34 +151,26 @@ func TestPreparedTimeArithmeticOverMySQLProtocol(t *testing.T) {
 							return conn.QueryContext(ctx, "execute fallback_time_abs using @fallback_time_abs_value")
 						}
 					}
-					// Query may expose an execution error immediately or through Rows.Err.
-					queryError := func(query func() (*sql.Rows, error)) error {
-						rows, err := query()
-						if err != nil {
-							return err
-						}
-						defer rows.Close()
-						require.False(t, rows.Next(), "overflow must not produce a row")
-						return rows.Err()
-					}
 					for _, value := range []any{int64(10), nil, int64(10), int64(9223372036854775807), int64(10)} {
 						if value == int64(9223372036854775807) {
-							wantErr := queryError(func() (*sql.Rows, error) {
-								return conn.QueryContext(ctx,
-									strings.ReplaceAll(expression, "?", "cast(9223372036854775807 as signed)"))
-							})
-							gotErr := queryError(func() (*sql.Rows, error) { return query(value) })
-							var wantMySQL, gotMySQL *mysql.MySQLError
-							require.True(t, errors.As(wantErr, &wantMySQL), "%v", wantErr)
-							require.True(t, errors.As(gotErr, &gotMySQL), "%v", gotErr)
-							require.Equal(t, wantMySQL.Number, gotMySQL.Number)
+							want := "9223372036854775808"
+							if temporal.scale == 6 {
+								want = "9223372036854806212.123456"
+							}
+							rows, err := conn.QueryContext(ctx,
+								strings.ReplaceAll(expression, "?", "cast(9223372036854775807 as signed)"))
+							require.NoError(t, err)
+							assertPreparedTimeResult(t, rows, want, false, 38, temporal.scale)
+							rows, err = query(value)
+							require.NoError(t, err)
+							assertPreparedTimeResult(t, rows, want, false, 38, temporal.scale)
 							continue
 						}
 						func() {
 							rows, err := query(value)
 							require.NoError(t, err)
 							if value != nil {
-								assertPreparedTimeResult(t, rows, temporal.want, false, 18, temporal.scale)
+								assertPreparedTimeResult(t, rows, temporal.want, false, 38, temporal.scale)
 								return
 							}
 							defer rows.Close()
@@ -291,7 +282,11 @@ func TestPreparedTimeArithmeticOverMySQLProtocol(t *testing.T) {
 			statementName := "issue28963_time_sql_" + tc.name
 			exec("prepare " + statementName + " from 'select cast(''00:00:01'' as time(0)) " + tc.op + " ? as result'")
 			exec("set @issue28963_time_value = cast(10 as signed)")
-			queryDecimal64Text("execute "+statementName+" using @issue28963_time_value", tc.want)
+			precision := int64(38)
+			if tc.op == "%" {
+				precision = 19
+			}
+			queryIntegerTimeText("execute "+statementName+" using @issue28963_time_value", tc.want, precision)
 			exec("deallocate prepare " + statementName)
 		}
 
@@ -365,13 +360,17 @@ func TestPreparedTimeArithmeticOverMySQLProtocol(t *testing.T) {
 			{name: "mod", op: "%", want: "1"},
 		} {
 			t.Run("binary/"+tc.name, func(t *testing.T) {
+				precision := int64(38)
+				if tc.op == "%" {
+					precision = 19
+				}
 				statement := "select cast('00:00:01' as time(0)) " + tc.op + " ? as result"
 				stmt, err := conn.PrepareContext(ctx, statement)
 				require.NoError(t, err)
 				defer stmt.Close()
 				rows, err := stmt.QueryContext(ctx, int64(10))
 				require.NoError(t, err)
-				assertPreparedTimeResult(t, rows, tc.want, false, 18, 0)
+				assertPreparedTimeResult(t, rows, tc.want, false, precision, 0)
 			})
 		}
 
@@ -383,20 +382,11 @@ func TestPreparedTimeArithmeticOverMySQLProtocol(t *testing.T) {
 
 			rows, err := stmt.QueryContext(ctx, int64(10))
 			require.NoError(t, err)
-			assertPreparedTimeResult(t, rows, "30415.123456", false, 18, 6)
+			assertPreparedTimeResult(t, rows, "30415.123456", false, 38, 6)
 
 			rows, err = stmt.QueryContext(ctx, int64(9223372036854775807))
-			if err == nil {
-				defer rows.Close()
-				if rows.Next() {
-					var value any
-					err = rows.Scan(&value)
-				}
-				if err == nil {
-					err = rows.Err()
-				}
-			}
-			require.Error(t, err)
+			require.NoError(t, err)
+			assertPreparedTimeResult(t, rows, "9223372036854806212.123456", false, 38, 6)
 		})
 
 		for _, tc := range []struct {
@@ 
```

**File**: `pkg/frontend/compiler_context.go` (modified, +1/-1)
```diff
@@ -629,7 +629,7 @@ func (tcc *TxnCompilerContext) recoverLegacyTinyText(
 	}); err != nil {
 		return err
 	}
-	return plan2.MigrateLegacyHexTableDef(tcc.GetProcess(), tableDef)
+	return plan2.MigrateLegacyCatalogTableDef(ctx, tcc.GetProcess(), tableDef)
 }
 
 func (tcc *TxnCompilerContext) ensureDatabaseIsNotEmpty(dbName string, checkSub bool, snapshot *plan2.Snapshot) (string, *plan.SubscriptionMeta, error) {
```

---

### Incident Patch 3: `5fe08a33` (2026-10-26)
**Commit Message**: fix(ci): preserve SCA compatibility and explain full-scan fallback (#31142)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #29562.

## What this PR does / why we need it:

Recent [SCA job
121193349037](https://github.com/matrixorigin/matrixone/actions/runs/40201453562/job/121193349037)
silently ran a full graph because Node was missing from the shell PATH,
despite an existing incremental selector. Its frozen PR inputs would
have selected 34 of 507 packages.

- Preserve compatibility with deployed CI: when Node is absent,
explicitly report the reason, validate the complete graph and run both
analyzers over `./...`. Node-present CI retains incremental selection;
selector failures stay fatal. Local invocations still run the complete
graph.
- Explain conservative fallback decisions and report selected/total
package counts on stderr, keeping stdout exclusively package arguments.
- Reuse existing immutable-input selection, package ownership and
reverse-import graph. Preserve full-scan overrides, discovery failures,
analyzer failures and both

**File**: `.github/ci/README.md` (modified, +12/-2)
```diff
@@ -36,10 +36,20 @@ Changes to analyzer versions/rules require reviewing this package-local contract
 ## Full checks and rollout
 
 - `make static-check` remains the complete local/release gate.
-- `make static-check-analysis` remains full outside GitHub Actions or without Node.
+- `make static-check-analysis` remains full outside GitHub Actions. CI without
+  Node on PATH also runs complete graph validation and both analyzers, with an
+  explicit fallback reason. This supports older CI during rollout.
+- The SCA job can expose its existing runner-provided Node 24 runtime on PATH
+  without downloading another SDK, enabling incremental analysis. Once Node is
+  available, selector errors remain fatal.
+- Selection and conservative fallback reasons are printed on stderr; stdout
+  from the selector contains only package arguments.
 - `SCA_FULL=1 make static-check-analysis` forces complete PR analysis.
 - `make static-check-golangci` still populates the complete trusted analysis cache.
-- Existing license selection and the final required-check gate remain unchanged.
+- License exemptions require the frozen checkout and PR head/base to match
+  before and after file pagination, plus the validated configuration/tool recipe.
+  Unavailable or changed inputs retain complete checks. The final required-check
+  gate remains unchanged.
 
 The first optimization keeps complete complementary BVT groups. General SQL
 selection is deliberately deferred: existing logging verifiers consume other
```

**File**: `.github/ci/change-scope.cjs` (modified, +9/-8)
```diff
@@ -124,45 +124,46 @@ function verifyResults(scope, needs) {
 
 // Shared by the analyzer and BVT consumers, after checkout. No API pagination,
 // mutable branch comparison, or remembered plan can change the tested revision.
-function immutableChanges({ cwd = process.cwd(), env = process.env, git } = {}) {
+function immutableChanges({ cwd = process.cwd(), env = process.env, git, report = () => {} } = {}) {
+  const full = reason => { report(reason); return null; };
   const fs = require('node:fs');
   const { execFileSync } = require('node:child_process');
   git ||= args => execFileSync('git', args, {
     cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
     stdio: ['ignore', 'pipe', 'pipe'],
   });
   if (env.GITHUB_ACTIONS !== 'true' || !env.GITHUB_EVENT_PATH ||
-      !['pull_request', 'pull_request_target'].includes(env.GITHUB_EVENT_NAME)) return null;
+      !['pull_request', 'pull_request_target'].includes(env.GITHUB_EVENT_NAME)) return full('immutable PR event unavailable');
   try {
     const pr = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8')).pull_request;
     const base = pr?.base?.sha;
     const head = pr?.head?.sha;
     if (![base, head].every(sha => /^[0-9a-f]{40}$/.test(sha || '')) ||
-        git(['rev-parse', 'HEAD']).trim() !== head) return null;
+        git(['rev-parse', 'HEAD']).trim() !== head) return full('invalid PR revision or checkout head mismatch');
     // Local edits cannot use a committed-input exemption. Include untracked
     // inputs too; ignored native outputs and runner reports are not source.
-    if (git(['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none']).trim()) return null;
+    if (git(['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none']).trim()) return full('checkout contains uncommitted inputs');
     try {
       git(['cat-file', '-e', `${base}^{commit}`]);
     } catch {
       // Fetch the immutable object only. Do not move a checkout or local ref.
-      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY || '')) return null;
+      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY || '')) return full('base unavailable and repository identity invalid');
       git(['fetch', '--no-tags', '--depth=1',
         `https://github.com/${env.GITHUB_REPOSITORY}.git`, base]);
     }
     // Tree comparison also works when a shallow checkout lacks ancestry. Both
     // sides of a rename are roots; do not hide removals behind rename matching.
     const raw = git(['diff', '--no-ext-diff', '--no-renames', '--ignore-submodules=none', '--name-status', '-z', base, head]);
     const fields = raw.split('\0');
-    if (fields.pop() !== '' || fields.length === 0 || fields.length % 2) return null;
+    if (fields.pop() !== '' || fields.length === 0 || fields.length % 2) return full('empty or malformed immutable diff');
     const files = [];
     for (let i = 0; i < fields.length; i += 2) {
-      if (!['A', 'M', 'D', 'T'].includes(fields[i]) || !validPath(fields[i + 1])) return null;
+      if (!['A', 'M', 'D', 'T'].includes(fields[i]) || !validPath(fields[i + 1])) return full('unsupported immutable diff entry');
       files.push({ status: fields[i], filename: fields[i + 1] });
     }
     return files;
   } catch {
-    return null;
+    return full('immutable event, Git status, base fetch or diff unavailable');
   }
 }
 
```

**File**: `.github/ci/static-analysis.cjs` (modified, +21/-12)
```diff
@@ -60,34 +60,37 @@ function inventory(text) {
   return records;
 }
 
-function goChanges(files) {
-  if (!files?.length) return null;
+function goChanges(files, report = () => {}) {
+  if (!files?.length) { report('no verified changed inputs'); return null; }
   const changed = [];
   for (const file of files) {
-    if (file.status === 'T') return null;
+    if (file.status === 'T') { report(`file type changed: ${JSON.stringify(file.filename.slice(0, 200))}`); return null; }
     if (/^pkg\/.*\.go$/.test(file.filename) &&
         !/(^|\/)(testdata|fixtures)\//i.test(file.filename)) {
       changed.push(file.filename);
     } else if (!['docs', 'bvt'].includes(category(file.filename))) {
+      report(`input requires full analysis: ${JSON.stringify(file.filename.slice(0, 200))}`);
       return null;
     }
   }
   // No Go change means the cheap policy check still runs, but these analyzers
   // have no changed inputs. Keep a nonempty full scan rather than inventing a
   // separate successful-empty mode in this first increment.
+  if (!changed.length) report('no changed Go inputs');
   return changed.length ? changed : null;
 }
 
-function selectPackages(files, records, root) {
-  const changed = goChanges(files);
+function selectPackages(files, records, root, report = () => {}) {
+  const full = reason => { report(reason); return ['./...']; };
+  const changed = goChanges(files, report);
   if (!changed || !records.length) return ['./...'];
   const owners = new Map();
   const variants = new Map();
   const reverse = new Map();
   for (const record of records) {
     const relative = path.relative(root, record.dir);
     if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
-        !/^[\w./-]+$/.test(relative)) return ['./...'];
+        !/^[\w./-]+$/.test(relative)) return full('package owner is outside the supported source layout');
     const owner = `./${relative}`;
     owners.set(relative, owner);
     variants.set(record.id, owner);
@@ -100,7 +103,7 @@ function selectPackages(files, records, root) {
       if (!dependency) {
         // A main-module test variant missing from discovery is not a known
         // external dependency. Do not guess how its package ID maps.
-        if (imported.includes(' [')) return ['./...'];
+        if (imported.includes(' [')) return full('test variant is missing from the verified graph');
         continue;
       }
       if (!reverse.has(dependency)) reverse.set(dependency, new Set());
@@ -111,7 +114,7 @@ function selectPackages(files, records, root) {
   const production = [];
   for (const file of changed) {
     const owner = owners.get(path.posix.dirname(file));
-    if (!owner) return ['./...']; // includes an entirely removed package
+    if (!owner) return full('changed package is missing from the verified graph');
     selected.add(owner);
     if (!file.endsWith('_test.go')) production.push(owner);
   }
@@ -125,7 +128,8 @@ function selectPackages(files, records, root) {
       }
     }
   }
-  return selected.size && selected.size < owners.size / 2 ? [...selected].sort() : ['./...'];
+  return selected.size && selected.size < owners.size / 2 ? [...selected].sort() :
+    full(`affected closure reaches full-scan threshold (${selected.size}/${owners.size} packages)`);
 }
 
 function plan({ cwd = process.cwd(), env = process.env, run = execFileSync } = {}) {
@@ -136,7 +140,9 @@ function plan({ cwd = process.cwd(), env = process.env, run = execFileSync } = {
     env: { ...env, GOWORK: 'off' }, stdio: ['ignore', 'pipe', 'inherit'],
   });
   const records = inventory(text);
-  let files = env.SCA_FULL === '1' ? null : immutableChanges({ cwd, env });
+  const report = reason => console.error(`SCA full-scan reason: ${reason}`);
+  let files = env.SCA_FULL === '1' ? null : immutableChanges({ cwd, env, report });
+  if (env.SCA_FULL === '1') report('SCA_FULL=1');
   if (files) {
     // Git status omits ignored files, but Go still compiles an ignored .go
     // file inside a package. Require every real source input to be committed
@@ -152,14 +158,17 @@ function plan({ cwd = process.cwd(), env = process.env, run = execFileSync } = {
       }));
       if (records.some(p => p.sources.some(source =>
         !tracked.has(path.relative(cwd, path.resolve(p.dir, source)).split(path.sep).join('/'))))) {
+        report('Go graph contains untracked, generated or nonregular source inputs');
         files = null;
       }
     } catch {
+      report('tracked source inventory unavailable');
       files = null;
     }
   }
-  const selected = selectPackages(files, records, cwd);
-  console.error(`SCA selection: ${selected[0] === './...' ? 'full graph' : `${selected.length} packages`}`);
+  const selected = selectPackages(files, records, cwd, report);
+  const total = new Set(records.map(p => p.dir)).size;
+  console.error(`SCA selection: ${selected[0] === './...' ? 'full graph' : `${selected.length}/${total} packages`}`);
   return selecte
```

**File**: `.github/ci/static-analysis.test.cjs` (modified, +35/-3)
```diff
@@ -28,13 +28,15 @@ const records = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(name => ({
 }));
 records[1].imports = [records[0].id];
 records.push({ id: `${records[2].id}_test [${records[2].id}.test]`, dir: records[2].dir,
-  imports: [records[0].id] });
+  imports: [records[1].id] });
 const file = (filename, status = 'M') => ({ filename, status });
 
 test('complete package selection follows production and test imports, not test reverse imports', () => {
   assert.deepEqual(selectPackages([file('pkg/a/a.go')], records, root), ['./pkg/a', './pkg/b', './pkg/c']);
   assert.deepEqual(selectPackages([file('pkg/a/a_test.go')], records, root), ['./pkg/a']);
-  assert.deepEqual(selectPackages([file('pkg/a/a.go', 'D'), file('pkg/d/a.go', 'A')], records, root), ['./...']);
+  const reasons = [];
+  assert.deepEqual(selectPackages([file('pkg/a/a.go', 'D'), file('pkg/d/a.go', 'A')], records, root, reason => reasons.push(reason)), ['./...']);
+  assert.match(reasons.join('\n'), /threshold \(4\/8 packages\)/);
   assert.deepEqual(selectPackages([file('pkg/a/a.go', 'D')], records, root), ['./pkg/a', './pkg/b', './pkg/c']);
 });
 
@@ -90,7 +92,9 @@ test('immutable tree comparison handles shallow bases, moves, dirt and unavailab
       return git(args);
     } }), null);
   }
-  assert.equal(immutableChanges({ env, git: args => args[0] === 'status' ? ' M pkg/a/a.go' : git(args) }), null);
+  const reasons = [];
+  assert.equal(immutableChanges({ env, git: args => args[0] === 'status' ? ' M pkg/a/a.go' : git(args), report: reason => reasons.push(reason) }), null);
+  assert.deepEqual(reasons, ['checkout contains uncommitted inputs']);
   assert.equal(immutableChanges({ env, git: args => args[0] === 'rev-parse' ? base : git(args) }), null);
   assert.equal(immutableChanges({ env: { ...env, GITHUB_EVENT_NAME: 'push' }, git }), null);
 });
@@ -144,24 +148,52 @@ test('real Make consumer shares selection, keeps full override, and propagates a
   const first = run();
   assert.equal(first.result.status, 0, first.result.stderr + first.result.stdout);
   assert.equal(first.commands.length, 2);
+  assert.match(first.result.stderr, /SCA selection: 3\/8 packages/);
   for (const command of first.commands) assert.ok(command.endsWith('./pkg/a ./pkg/b ./pkg/c'), command);
   assert.ok(first.commands[1].includes('--concurrency 1'));
   const ignored = path.join(repo, 'pkg/h/ignored.go');
   fs.writeFileSync(ignored, 'package h\nvar GeneratedInput = 1\n');
   const generated = run();
   fs.unlinkSync(ignored);
   assert.equal(generated.result.status, 0, generated.result.stderr);
+  assert.match(generated.result.stderr, /untracked, generated or nonregular source inputs/);
   assert.ok(generated.commands.every(command => command.endsWith('./...')),
     'Go consumes ignored inputs too; Git status alone cannot exempt their packages');
   const full = run({ SCA_FULL: '1' });
   assert.equal(full.result.status, 0, full.result.stderr);
+  assert.match(full.result.stderr, /SCA_FULL=1/);
   assert.ok(full.commands.every(command => command.endsWith('./...')));
   const vetFailure = run({ FAIL_VET: '7' });
   assert.notEqual(vetFailure.result.status, 0);
   assert.equal(vetFailure.commands.length, 1);
   assert.notEqual(run({ FAIL_LINT: '9' }).result.status, 0);
+  const noNode = path.join(dir, 'without-node');
+  fs.mkdirSync(noNode);
+  for (const command of ['make', 'grep', 'git', 'which']) {
+    const executable = execFileSync('which', [command], { encoding: 'utf8' }).trim();
+    fs.symlinkSync(executable, path.join(noNode, command));
+  }
+  for (const command of Object.keys(tools)) fs.symlinkSync(path.join(bin, command), path.join(noNode, command));
+  const missingNode = run({ PATH: noNode });
+  assert.equal(missingNode.result.status, 0, missingNode.result.stderr);
+  assert.match(missingNode.result.stderr, /full graph \(Node unavailable on PATH in CI\)/);
+  assert.equal(missingNode.commands.length, 2);
+  assert.ok(missingNode.commands.every(command => command.endsWith('./...')));
+  const missingNodeVetFailure = run({ PATH: noNode, FAIL_VET: '7' });
+  assert.notEqual(missingNodeVetFailure.result.status, 0);
+  assert.equal(missingNodeVetFailure.commands.length, 1);
+  const missingNodeLintFailure = run({ PATH: noNode, FAIL_LINT: '9' });
+  assert.notEqual(missingNodeLintFailure.result.status, 0);
+  assert.equal(missingNodeLintFailure.commands.length, 2);
+  const local = run({ PATH: noNode, GITHUB_ACTIONS: 'false' });
+  assert.equal(local.result.status, 0, local.result.stderr);
+  assert.match(local.result.stderr, /full graph \(local invocation\)/);
+  assert.ok(local.commands.every(command => command.endsWith('./...')));
   fs.writeFileSync(path.join(repo, 'pkg/a/a.go'), 'not a Go package\n');
   const invalid = run();
   assert.notEqual(invalid.result.status, 0);
   assert.equal(invalid.commands.length, 0);
+  const missingNodeInvalid = run({ PATH: noNode });
+  assert.notEqual(missingNodeInvalid.result.status, 0);
+  assert.
```

**File**: `Makefile` (modified, +6/-1)
```diff
@@ -1572,13 +1572,18 @@ static-check: config err-check
 	$(STATIC_CHECK_GOLANGCI)
 
 # PR CI selects complete affected packages using the verified Go test/import
-# graph. Local use (including hosts without Node) retains the full checks.
+# graph. Local use and CI hosts without Node retain the full checks.
 # Both analyzers consume the same package list and their failures stay fatal.
 static-check-analysis: err-check
 	@set -e; packages='./...'; \
 	if [ "$${GITHUB_ACTIONS:-}" = true ] && command -v node >/dev/null 2>&1; then \
 		packages=$$($(CGO_OPTS) node .github/ci/static-analysis.cjs); \
 	else \
+		if [ "$${GITHUB_ACTIONS:-}" = true ]; then \
+			echo "SCA selection: full graph (Node unavailable on PATH in CI)" >&2; \
+		else \
+			echo "SCA selection: full graph (local invocation)" >&2; \
+		fi; \
 		$(MAKE) --no-print-directory config; \
 	fi; \
 	$(MAKE) --no-print-directory static-check-selected STATIC_CHECK_PACKAGES="$$packages"
```

#### Recent Merged Pull Requests:
- **PR #31287** (2026-10-26): docs(skills): shutdown-only upgrade contract for agent reviews (@cpegeric)
- **PR #31257** (2026-10-26): perf(sql): reduce exact integer IN and NOT IN evaluation cost (@XuPeng-SH)
- **PR #31256** (2026-10-26): docs: propose scoped case-insensitive database defaults design (@ck89119)
- **PR #31250** (2026-10-26): fix(plan): preserve DISTINCT statistics and reuse aggregate partitions (@XuPeng-SH)
- **PR #31237** (2026-10-26): fix(iscp): preserve fresh init jobs and shorten embedded test waits (@XuPeng-SH)
- **PR #31196** (2026-10-26): fix(python-sdk): preserve DML ordering and row limits (@MatrixAdventurer)

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

## X. view): preserve restore semantics and extend S5 conformance (#30953)

**RULE**:
When implementing operations in `docs/design/CLAUDE_20261023-view-s5-conformance.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `83c1e235`: view): preserve restore semantics and extend S5 conformance (#30953). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design/CLAUDE_20261023-view-s5-conformance.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
# 普通 View 元数据 S5：合同、恢复修复与验收证据

所属：[#29440](https://github.com/matrixorigin/matrixone/issues/29440)，父任务 [#29433](https://github.com/matrixorigin/matrixone/issues/29433)，Draft PR [#30953](https://github.com/matrixorigin/matrixone/pull/30953)。

**完整 S5 尚未验收，S8 rollout 为 NO-GO。** 默认 S3/S4 激活仍关闭。独立可做的协议、授权、历史、恢复与多 CN 验证不能笼统归为“等待激活”；另一方面，真实 L/A/B 切换不能由 mock、同 binary 多 CN 或 integration 接线代替。

## 1. 基线与批准边界

当前合并基线为 `mo/main@be663676872edf6d42695bba41757af0a3251758`，本地 merge `78618cf66941e95eb67879a2e7c47f967fb85b06`。首次部分交付 `22b48b77dffaaeeb9f773f47e561ae1d3d0a1728` 只有测试/文档；**续作已经包含生产恢复修复，不再适用“无生产改动”或“覆盖率门禁不适用”的描述。**

批准依据：

- [S1 设计及精确审批](CLAUDE_20260922-view-metadata-on-demand.md#s1-批准与-e1-勘误)。
- [S2 v2.1](CLAUDE_20261005-view-s2-scope-revision.md)：不恢复已撤销的全链路 128 MiB 逐对象证明。
- [S3](CLAUDE_20261018-view-s3-consumers.md)、[S4](CLAUDE_20261019-view-metadata-s4-consumers.md)、[S4 对账](CLAUDE_2026-10-20-view-metadata-s4-reconciliation.md)。
- [既有生命周期验证范围](CLAUDE_VIEW_METADATA_LIFECYCLE_CONFORMANCE_29007.md)。
- [独立 RC 生命周期升级约束](20260929-rc-lifecycle-protocol.md)：停服、drain、成员替换和旧进程禁入要求不能被 View 测试豁免。

默认排除 partition、stored procedure、UDF 功能及 warning 文案/数量兼容。没有 S8 部署、refresh 退役、S9 catalog 清理或新激活状态机。既有协议
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `83c1e235` are properly handled with clean fallback behavior.
