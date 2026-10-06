# Forensic Learning Record (Deep Inspection): trustgraph-ai/trustgraph

> **Canonical Artifact**: `07_PROJECT_LEARNING/trustgraph-ai-trustgraph-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trustgraph-ai/trustgraph](https://github.com/trustgraph-ai/trustgraph))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:40.821Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trustgraph-ai/trustgraph`
- **Description**: The Semantic Intelligence Layer for Ontologies
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2776 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `trustgraph-base/trustgraph/schema/core/__init__.py`
```
from .primitives import *
from .metadata import *
from .topic import *
```

### Core Architecture Module: `trustgraph-base/trustgraph/schema/core/metadata.py`
```
from dataclasses import dataclass

@dataclass
class Metadata:
    # Source identifier
    id: str = ""

    # Root document identifier (set by librarian, preserved through pipeline)
    root: str = ""

    # Collection the message belongs to.
    collection: str = ""

```

### Core Architecture Module: `trustgraph-base/trustgraph/schema/core/primitives.py`
```
from dataclasses import dataclass, field

# Term type constants
IRI = "i"      # IRI/URI node
BLANK = "b"    # Blank node
LITERAL = "l"  # Literal value
TRIPLE = "t"   # Quoted triple (RDF-star)


@dataclass
class Error:
    type: str = ""
    message: str = ""


@dataclass
class Term:
    """
    RDF Term - can represent an IRI, blank node, literal, or quoted triple.

    The 'type' field determines which other fields are relevant:
    - IRI: use 'iri' field
    - BLANK: use 'id' field
    - LITERAL: use 'value', 'datatype', 'language' fields
    - TRIPLE: use 'triple' field
    """
    type: str = ""  # One of: IRI, BLANK, LITERAL, TRIPLE

    # For IRI terms (type == IRI)
    iri: str = ""

    # For blank nodes (type == BLANK)
    id: str = ""

    # For literals (type == LITERAL)
    value: str = ""
    datatype: str = ""   # XSD datatype URI (mutually exclusive with language)
    language: str = ""   # Language tag (mutually exclusive with datatype)

    # For quoted triples (type == TRIPLE)
    triple: "Triple | None" = None


@dataclass
class Triple:
    """
    RDF Triple / Quad.

    The optional 'g' field specifies the named graph (None = default graph).
    """
    s: Term | None = None    # Subject
    p: Term | None = None    # Predicate
    o: Term | None = None    # Object
    g: str | None = None     # Graph name (IRI), None = default graph

@dataclass
class Field:
    name: str = ""
    # int, string, long, bool, float, double, timestamp
    type: str = ""
    size: int = 0
    primary: bool = False
    description: str = ""
    # NEW FIELDS for structured data:
    required: bool = False  # Whether field is required
    enum_values: list[str] = field(default_factory=list)  # For enum type fields
    indexed: bool = False  # Whether field should be indexed

@dataclass
class RowSchema:
    name: str = ""
    description: str = ""
    fields: list[Field] = field(default_factory=list)


```

### Core Architecture Module: `trustgraph-base/trustgraph/schema/core/topic.py`
```

def queue(topic, cls='flow', topicspace='tg'):
    """
    Create a queue identifier in CLASS:TOPICSPACE:TOPIC format.

    Args:
        topic: The logical queue name (e.g. 'config', 'librarian')
        cls: Queue class determining operational characteristics:
             - 'flow' = persistent shared work queue (competing consumers)
             - 'request' = non-persistent RPC request queue (shared)
             - 'response' = non-persistent RPC response queue (per-subscriber)
             - 'notify' = ephemeral broadcast (per-subscriber, auto-delete)
        topicspace: Deployment isolation prefix (default: 'tg')

    Returns:
        Queue identifier string: cls:topicspace:topic

    Examples:
        queue('text-completion-request')
            # flow:tg:text-completion-request
        queue('config', cls='request')
            # request:tg:config
        queue('config', cls='notify')
            # notify:tg:config
    """
    return f"{cls}:{topicspace}:{topic}"

```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/delete_kg_core.py`
```
"""
Deletes a knowledge core
"""

import argparse
import os
from trustgraph.api import Api

default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")

def delete_kg_core(url, id, token=None, workspace="default"):

    api = Api(url, token=token, workspace=workspace).knowledge()

    api.delete_kg_core(id=id)

def main():

    parser = argparse.ArgumentParser(
        prog='tg-delete-kg-core',
        description=__doc__,
    )

    parser.add_argument(
        '-u', '--api-url',
        default=default_url,
        help=f'API URL (default: {default_url})',
    )

    parser.add_argument(
        '--id', '--identifier',
        required=True,
        help=f'Knowledge core ID',
    )

    parser.add_argument(
        '-t', '--token',
        default=default_token,
        help='Authentication token (default: $TRUSTGRAPH_TOKEN)',
    )

    parser.add_argument(
        '-w', '--workspace',
        default=default_workspace,
        help=f'Workspace (default: {default_workspace})',
    )

    args = parser.parse_args()

    try:

        delete_kg_core(
            url=args.api_url,
            id=args.id,
            token=args.token,
            workspace=args.workspace,
        )

    except Exception as e:

        print("Exception:", e, flush=True)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/dump_queues.py`
```
"""
Multi-queue message dumper for debugging TrustGraph message flows.

This utility monitors multiple queues simultaneously and logs all messages
to a file with timestamps and pretty-printed formatting. Useful for debugging
message flows, diagnosing stuck services, and understanding system behavior.

Uses TrustGraph's async pub/sub backend for future-proof compatibility.
"""

import sys
import json
import asyncio
from datetime import datetime
import argparse

from trustgraph.base.pubsub import get_async_pubsub, add_pubsub_args

def decode_json_strings(obj):
    """Recursively decode JSON-encoded string values within a dict/list."""
    if isinstance(obj, dict):
        return {k: decode_json_strings(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [decode_json_strings(v) for v in obj]
    if isinstance(obj, str):
        try:
            parsed = json.loads(obj)
            if isinstance(parsed, (dict, list)):
                return decode_json_strings(parsed)
        except (json.JSONDecodeError, TypeError):
            pass
    return obj


def to_dict(value):
    """Recursively convert a value to a JSON-serialisable structure."""

    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, bytes):
        value = value.decode('utf-8')

    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value

    if isinstance(value, dict):
        return {k: to_dict(v) for k, v in value.items()}

    if isinstance(value, (list, tuple)):
        return [to_dict(v) for v in value]

    # Schema objects expose fields via __dict__
    if hasattr(value, '__dict__'):
        return {
            k: to_dict(v) for k, v in value.__dict__.items()
            if not k.startswith('_')
        }

    return str(value)


def format_message(queue_name, msg):
    """Format a message with timestamp and queue name."""
    timestamp = datetime.now().isoformat()

    try:
        value = msg.value() if hasattr(msg, 'value') else msg
        parsed = to_dict(value)

        # Unwrap nested JSON strings (e.g. terms values)
        if isinstance(parsed, (dict, list)):
            parsed = decode_json_strings(parsed)
            body = json.dumps(parsed, indent=2, default=str)
        else:
            body = str(parsed)

    except Exception as e:
        body = f"<Error formatting message: {e}>\n{str(msg)}"

    # Format the output
    header = f"\n{'='*80}\n[{timestamp}] Queue: {queue_name}\n{'='*80}\n"
    return header + body + "\n"


async def monitor_queue(consumer, queue_name, central_queue, shutdown_event):
    """
    Monitor a single queue via async consumer and forward messages to central queue.

    Args:
        consumer: Async consumer instance for this queue
        queue_name: Name of the queue (for logging)
        central_queue: asyncio.Queue to forward messages to
        shutdown_event: asyncio.Event to signal shutdown
    """
    try:
        while not shutdown_event.is_set():
            try:
                receive_task = asyncio.ensure_future(consumer.receive())
                shutdown_task = asyncio.ensure_future(shutdown_event.wait())

                done, pending = await asyncio.wait(
                    [receive_task, shutdown_task],
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if shutdown_task in done:
                    receive_task.cancel()
                    break

                if receive_task in done:
                    shutdown_task.cancel()
                    msg = receive_task.result()
                    timestamp = datetime.now()
                    formatted = format_message(queue_name, msg)
                    await central_queue.put((timestamp, queue_name, formatted))
                    await consumer.acknowledge(msg)

            except asyncio.CancelledError:
                break

    except Exception as e:
        if not shutdown_event.is_set():
            error_msg = f"\n{'='*80}\n[{datetime.now().isoformat()}] ERROR in monitor for {queue_name}\n{'='*80}\n{e}\n"
            await central_queue.put((datetime.now(), queue_name, error_msg))


async def log_writer(central_queue, file_handle, shutdown_event, console_output=True):
    """
    Write messages from central queue to file.

    Args:
        central_queue: asyncio.Queue containing (timestamp, queue_name, formatted_msg) tuples
        file_handle: Open file handle to write to
        shutdown_event: asyncio.Event to signal shutdown
        console_output: Whether to print abbreviated messages to console
    """
    try:
        while not shutdown_event.is_set():
            try:
                # Wait for messages with timeout to check shutdown flag
                timestamp, queue_name, formatted_msg = await asyncio.wait_for(
                    central_queue.get(), timeout=0.5
                )

                # Write to file
                file_handle.write(formatted_msg)
                file_handle.flush()

                # Print abbreviated message to console
                if console_output:
                    time_str = timestamp.strftime('%H:%M:%S')
                    print(f"[{time_str}] {queue_name}: Message received")
            except asyncio.TimeoutError:
                # No message, check shutdown flag again
                continue

    finally:
        # Flush remaining messages after shutdown
        while not central_queue.empty():
            try:
                timestamp, queue_name, formatted_msg = central_queue.get_nowait()
                file_handle.write(formatted_msg)
                file_handle.flush()
            except asyncio.QueueEmpty:
                break


async def async_main(queues, output_file, subscriber_name, append_mode, **pubsub_config):
    """
    Main async function to monitor multiple queues concurrently.

    Args:
        queues: List of queue names to monitor
        output_file: Path to output file
        subscriber_name: Base name for subscribers
        append_mode: Whether to append to existing file
    """
    print(f"TrustGraph Queue Dumper")
    print(f"Monitoring {len(queues)} queue(s):")
    for q in queues:
        print(f"  - {q}")
    print(f"Output file: {output_file}")
    print(f"Mode: {'append' if append_mode else 'overwrite'}")
    print(f"Press Ctrl+C to stop\n")

    # Create backend connection
    try:
        backend = get_async_pubsub(**pubsub_config)
    except Exception as e:
        print(f"Error connecting to backend: {e}", file=sys.stderr)
        sys.exit(1)

    # Create consumers and central queue
    central_queue = asyncio.Queue()
    consumers = []

    for queue_name in queues:
        try:
            consumer = await backend.create_consumer(
                topic=queue_name,
                subscription=subscriber_name,
                schema=None,
                initial_position='latest',
            )
            consumers.append((queue_name, consumer))
            print(f"  Subscribed to: {queue_name}")
        except Exception as e:
            print(f"  Error subscribing to {queue_name}: {e}", file=sys.stderr)

    if not consumers:
        print("\nNo consumers created. Exiting.", file=sys.stderr)
        await backend.close()
        sys.exit(1)

    print(f"\nListening for messages...\n")

    # Open output file
    mode = 'a' if append_mode else 'w'
    try:
        with open(output_file, mode) as f:
            f.write(f"\n{'#'*80}\n")
            f.write(f"# Session started: {datetime.now().isoformat()}\n")
            f.write(f"# Monitoring queues: {', '.join(queues)}\n")
            f.write(f"{'#'*80}\n")
            f.flush()

            # Create shutdown event for clean coordination
            shutdown_event = asyncio.Event()

            # Start monitoring tasks
            tasks = []
            try:
                # Create one monitor task per consumer
                for queue_name, consumer in consumers:
                    task = asyncio.create_task(
                        monitor_queue(consumer, queue_name, central_queue, shutdown_event)
                    )
                    tasks.append(task)

                # Create single writer task
                writer_task = asyncio.create_task(
                    log_writer(central_queue, f, shutdown_event)
                )
                tasks.append(writer_task)

                # Wait for all tasks (they check shutdown_event)
                await asyncio.gather(*tasks)

            except KeyboardInterrupt:
                print("\n\nStopping...")
            finally:
                # Signal shutdown to all tasks
                shutdown_event.set()

                # Wait for tasks to finish cleanly (with timeout)
                try:
                    await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=2.0)
                except asyncio.TimeoutError:
                    print("Warning: Shutdown timeout", file=sys.stderr)

                # Write session end marker
                f.write(f"\n{'#'*80}\n")
                f.write(f"# Session ended: {datetime.now().isoformat()}\n")
                f.write(f"{'#'*80}\n")

    except IOError as e:
        print(f"Error writing to {output_file}: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean shutdown of consumers
        for _, consumer in consumers:
            try:
                await consumer.close()
            except Exception:
                pass
        await backend.close()

    print(f"\nMessages logged to: {output_file}")

def main():
    parser = argparse.ArgumentParser(
        prog='tg-dump-queues',
        description='Monitor and dump messages from multiple queues',
        epilog="""
Examples:
  # Monitor agent and prompt flow queues
  tg-dump-queues flow:tg:agent-request:default \\
                 flow:tg:prompt-request:
```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/get_de_core.py`
```
"""
Uses the knowledge service to fetch a document embeddings core which is
saved to a local file in msgpack format.
"""

import argparse
import os
import msgpack

from trustgraph.api import Api

default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")

def write_de(f, data):
    msg = (
        "de",
        {
            "m": {
                "i": data["metadata"]["id"],
                "m": data["metadata"]["root"],
                "c": data["metadata"]["collection"],
            },
            "c": [
                {
                    "i": ch["chunk_id"],
                    "v": ch["vector"],
                }
                for ch in data["chunks"]
            ]
        }
    )
    f.write(msgpack.packb(msg, use_bin_type=True))

def fetch(url, workspace, id, output, token=None):

    api = Api(url=url, token=token, workspace=workspace)
    socket = api.socket()

    try:
        de = 0

        with open(output, "wb") as f:

            for response in socket.get_de_core(id):

                if "document-embeddings" in response:
                    de += 1
                    write_de(f, response["document-embeddings"])

        print(f"Got: {de} document embeddings messages.")

    finally:
        socket.close()

def main():

    parser = argparse.ArgumentParser(
        prog='tg-get-de-core',
        description=__doc__,
    )

    parser.add_argument(
        '-u', '--url',
        default=default_url,
        help=f'API URL (default: {default_url})',
    )

    parser.add_argument(
        '-w', '--workspace',
        default=default_workspace,
        help=f'Workspace (default: {default_workspace})',
    )

    parser.add_argument(
        '--id', '--identifier',
        required=True,
        help=f'Document embeddings core ID',
    )

    parser.add_argument(
        '-o', '--output',
        required=True,
        help=f'Output file'
    )

    parser.add_argument(
        '-t', '--token',
        default=default_token,
        help='Authentication token (default: $TRUSTGRAPH_TOKEN)',
    )

    args = parser.parse_args()

    try:

        fetch(
            url=args.url,
            workspace=args.workspace,
            id=args.id,
            output=args.output,
            token=args.token,
        )

    except Exception as e:

        print("Exception:", e, flush=True)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/get_kg_core.py`
```
"""
Uses the knowledge service to fetch a knowledge core which is saved
to a local file in msgpack format.
"""

import argparse
import os
import msgpack

from trustgraph.api import Api

default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")

def write_triple(f, data):
    msg = (
        "t",
        {
            "m": {
                "i": data["metadata"]["id"],
                "m": data["metadata"]["root"],
                "c": data["metadata"]["collection"],
            },
            "t": data["triples"],
        }
    )
    f.write(msgpack.packb(msg, use_bin_type=True))

def write_ge(f, data):
    msg = (
        "ge",
        {
            "m": {
                "i": data["metadata"]["id"],
                "m": data["metadata"]["root"],
                "c": data["metadata"]["collection"],
            },
            "e": [
                {
                    "e": ent["entity"],
                    "v": ent["vector"],
                }
                for ent in data["entities"]
            ]
        }
    )
    f.write(msgpack.packb(msg, use_bin_type=True))

def write_library_metadata(f, data):
    msg = (
        "lm",
        {
            "i": data["id"],
            "k": data.get("kind", ""),
            "t": data.get("title", ""),
            "p": data.get("parent-id", ""),
            "d": data.get("document-type", ""),
            "c": data.get("comments", ""),
            "g": data.get("tags", []),
        }
    )
    f.write(msgpack.packb(msg, use_bin_type=True))

def write_library_blob(f, data):
    msg = (
        "lb",
        {
            "i": data["id"],
            "d": data.get("data", b""),
        }
    )
    f.write(msgpack.packb(msg, use_bin_type=True))

def fetch(url, workspace, id, output, token=None):

    api = Api(url=url, token=token, workspace=workspace)
    socket = api.socket()

    try:
        ge = 0
        t = 0
        lm = 0
        lb = 0

        with open(output, "wb") as f:

            for response in socket.get_kg_core(id):

                if response.get("error"):
                    err = response["error"]
                    print(
                        f"Error: {err.get('type', 'unknown')}: "
                        f"{err.get('message', 'Unknown error')}"
                    )

                if "triples" in response:
                    t += 1
                    write_triple(f, response["triples"])

                if "graph-embeddings" in response:
                    ge += 1
                    write_ge(f, response["graph-embeddings"])

                if "library-metadata" in response:
                    lm += 1
                    write_library_metadata(f, response["library-metadata"])

                if "library-blob" in response:
                    lb += 1
                    write_library_blob(f, response["library-blob"])

        print(f"Got: {t} triple, {ge} GE, {lm} library metadata, {lb} library blob messages.")

    finally:
        socket.close()

def main():

    parser = argparse.ArgumentParser(
        prog='tg-get-kg-core',
        description=__doc__,
    )

    parser.add_argument(
        '-u', '--url',
        default=default_url,
        help=f'API URL (default: {default_url})',
    )

    parser.add_argument(
        '-w', '--workspace',
        default=default_workspace,
        help=f'Workspace (default: {default_workspace})',
    )

    parser.add_argument(
        '--id', '--identifier',
        required=True,
        help=f'Knowledge core ID',
    )

    parser.add_argument(
        '-o', '--output',
        required=True,
        help=f'Output file'
    )

    parser.add_argument(
        '-t', '--token',
        default=default_token,
        help='Authentication token (default: $TRUSTGRAPH_TOKEN)',
    )

    args = parser.parse_args()

    try:

        fetch(
            url=args.url,
            workspace=args.workspace,
            id=args.id,
            output=args.output,
            token=args.token,
        )

    except Exception as e:

        print("Exception:", e, flush=True)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/load_kg_core.py`
```
"""
Starts a load operation on a knowledge core which is already stored by
the knowledge manager.  You could load a core with tg-put-kg-core and then
run this utility.
"""

import argparse
import os
from trustgraph.api import Api

default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")
default_flow = "default"
default_collection = "default"

def load_kg_core(url, id, flow, collection, token=None, workspace="default"):

    api = Api(url, token=token, workspace=workspace).knowledge()

    api.load_kg_core(id=id, flow=flow, collection=collection)

def main():

    parser = argparse.ArgumentParser(
        prog='tg-load-kg-core',
        description=__doc__,
    )

    parser.add_argument(
        '-u', '--api-url',
        default=default_url,
        help=f'API URL (default: {default_url})',
    )

    parser.add_argument(
        '--id', '--identifier',
        required=True,
        help=f'Knowledge core ID',
    )

    parser.add_argument(
        '-f', '--flow-id',
        default=default_flow,
        help=f'Flow ID (default: {default_flow})',
    )

    parser.add_argument(
        '-C', '--collection',
        default=default_collection,
        help=f'Collection ID (default: {default_collection})',
    )

    parser.add_argument(
        '-t', '--token',
        default=default_token,
        help='Authentication token (default: $TRUSTGRAPH_TOKEN)',
    )

    parser.add_argument(
        '-w', '--workspace',
        default=default_workspace,
        help=f'Workspace (default: {default_workspace})',
    )

    args = parser.parse_args()

    try:

        load_kg_core(
            url=args.api_url,
            id=args.id,
            flow=args.flow_id,
            collection=args.collection,
            token=args.token,
            workspace=args.workspace,
        )

    except Exception as e:

        print("Exception:", e, flush=True)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/put_de_core.py`
```
"""
Puts a document embeddings core into the knowledge manager via the API
socket.
"""

import argparse
import os
import msgpack

from trustgraph.api import Api

default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")

def read_message(unpacked, id):

    if unpacked[0] == "de":
        msg = unpacked[1]
        return {
            "metadata": {
                "id": id,
                "root": msg["m"]["m"],
                "collection": "default",
            },
            "chunks": [
                {
                    "chunk_id": ch["i"],
                    "vector": ch["v"],
                }
                for ch in msg["c"]
            ],
        }
    else:
        raise RuntimeError("Unexpected message type", unpacked[0])

def put(url, workspace, id, input, token=None):

    api = Api(url=url, token=token, workspace=workspace)
    socket = api.socket()

    try:
        de = 0

        with open(input, "rb") as f:

            unpacker = msgpack.Unpacker(f, raw=False)

            while True:

                try:
                    unpacked = unpacker.unpack()
                except msgpack.OutOfData:
                    break

                msg = read_message(unpacked, id)
                de += 1
                socket.put_de_core(id, document_embeddings=msg)

        print(f"Put: {de} document embeddings messages.")

    finally:
        socket.close()

def main():

    parser = argparse.ArgumentParser(
        prog='tg-put-de-core',
        description=__doc__,
    )

    parser.add_argument(
        '-u', '--url',
        default=default_url,
        help=f'API URL (default: {default_url})',
    )

    parser.add_argument(
        '-w', '--workspace',
        default=default_workspace,
        help=f'Workspace (default: {default_workspace})',
    )

    parser.add_argument(
        '--id', '--identifier',
        required=True,
        help=f'Document embeddings core ID',
    )

    parser.add_argument(
        '-i', '--input',
        required=True,
        help=f'Input file'
    )

    parser.add_argument(
        '-t', '--token',
        default=default_token,
        help='Authentication token (default: $TRUSTGRAPH_TOKEN)',
    )

    args = parser.parse_args()

    try:

        put(
            url=args.url,
            workspace=args.workspace,
            id=args.id,
            input=args.input,
            token=args.token,
        )

    except Exception as e:

        print("Exception:", e, flush=True)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/put_kg_core.py`
```
"""
Puts a knowledge core into the knowledge manager via the API socket.
"""

import argparse
import os
import msgpack

from trustgraph.api import Api

default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")

def read_message(unpacked, id):

    if unpacked[0] == "ge":
        msg = unpacked[1]
        return "ge", {
            "metadata": {
                "id": id,
                "root": msg["m"]["m"],
                "collection": "default",
            },
            "entities": [
                {
                    "entity": ent["e"],
                    "vector": ent["v"],
                }
                for ent in msg["e"]
            ],
        }
    elif unpacked[0] == "t":
        msg = unpacked[1]
        return "t", {
            "metadata": {
                "id": id,
                "root": msg["m"]["m"],
                "collection": "default",
            },
            "triples": msg["t"],
        }
    elif unpacked[0] == "lm":
        msg = unpacked[1]
        return "lm", {
            "id": msg["i"],
            "kind": msg.get("k", ""),
            "title": msg.get("t", ""),
            "parent-id": msg.get("p", ""),
            "document-type": msg.get("d", ""),
            "comments": msg.get("c", ""),
            "tags": msg.get("g", []),
        }
    elif unpacked[0] == "lb":
        msg = unpacked[1]
        return "lb", {
            "id": msg["i"],
            "data": msg.get("d", b""),
        }
    else:
        raise RuntimeError("Unpacked unexpected messsage type", unpacked[0])

def put(url, workspace, id, input, token=None):

    api = Api(url=url, token=token, workspace=workspace)
    socket = api.socket()

    try:
        ge = 0
        t = 0
        lm = 0
        lb = 0

        with open(input, "rb") as f:

            unpacker = msgpack.Unpacker(f, raw=False)

            while True:

                try:
                    unpacked = unpacker.unpack()
                except msgpack.OutOfData:
                    break

                kind, msg = read_message(unpacked, id)

                if kind == "ge":
                    ge += 1
                    socket.put_kg_core(id, graph_embeddings=msg)

                elif kind == "t":
                    t += 1
                    socket.put_kg_core(id, triples=msg)

                elif kind == "lm":
                    lm += 1
                    socket.put_kg_core(id, library_metadata=msg)

                elif kind == "lb":
                    lb += 1
                    socket.put_kg_core(id, library_blob=msg)

                else:
                    raise RuntimeError("Unexpected message kind", kind)

        print(f"Put: {t} triple, {ge} GE, {lm} library metadata, {lb} library blob messages.")

    finally:
        socket.close()

def main():

    parser = argparse.ArgumentParser(
        prog='tg-put-kg-core',
        description=__doc__,
    )

    parser.add_argument(
        '-u', '--url',
        default=default_url,
        help=f'API URL (default: {default_url})',
    )

    parser.add_argument(
        '-w', '--workspace',
        default=default_workspace,
        help=f'Workspace (default: {default_workspace})',
    )

    parser.add_argument(
        '--id', '--identifier',
        required=True,
        help=f'Knowledge core ID',
    )

    parser.add_argument(
        '-i', '--input',
        required=True,
        help=f'Input file'
    )

    parser.add_argument(
        '-t', '--token',
        default=default_token,
        help='Authentication token (default: $TRUSTGRAPH_TOKEN)',
    )

    args = parser.parse_args()

    try:

        put(
            url=args.url,
            workspace=args.workspace,
            id=args.id,
            input=args.input,
            token=args.token,
        )

    except Exception as e:

        print("Exception:", e, flush=True)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `trustgraph-cli/trustgraph/cli/show_flow_state.py`
```
"""
Dump out a flow's processor states
"""

import requests
import argparse
from trustgraph.api import Api
import os

default_metrics_url = "http://localhost:8888/api/metrics"
default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")

def dump_status(metrics_url, api_url, flow_id, token=None,
                workspace="default"):

    api = Api(api_url, token=token, workspace=workspace).flow()

    flow = api.get(flow_id)
    blueprint_name = flow["blueprint-name"]

    print()
    print(f"Flow {flow_id}")
    show_processors(metrics_url, flow_id, token=token)

    print()
    print(f"Blueprint {blueprint_name}")
    show_processors(metrics_url, blueprint_name, token=token)

    print()

def show_processors(metrics_url, flow_label, token=None):

    url = f"{metrics_url}/query"

    expr = f"consumer_state=\"running\",flow=\"{flow_label}\""

    params = {
        "query": "consumer_state{" + expr + "}"
    }

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    resp = requests.get(url, params=params, headers=headers)

    obj = resp.json()

    # consumer_state is one sample per consumer (queue); a processor
    # with N subscriptions shows up N times.  Aggregate to one row per
    # processor: green only if every consumer is running.
    by_proc = {}
    for m in obj["data"]["result"]:
        name = m["metric"].get("processor", m["metric"]["job"])
        running = int(m["value"][1]) > 0
        by_proc[name] = by_proc.get(name, True) and running

    for name in sorted(by_proc):
        icon = "\U0001f49a" if by_proc[name] else "\U0000274c"
        print(f"- {name:30} {icon}")

def main():

    parser = argparse.ArgumentParser(
        prog='tg-show-flow-state',
        description=__doc__,
    )

    parser.add_argument(
        '-f', '--flow-id',
        default="default",
        help=f'Flow ID (default: default)'
    )

    parser.add_argument(
        '-u', '--api-url',
        default=default_url,
        help=f'API URL (default: {default_url})',
    )

    parser.add_argument(
        '-m', '--metrics-url',
        default=default_metrics_url,
        help=f'Metrics URL (default: {default_metrics_url})',
    )

    parser.add_argument(
        '-t', '--token',
        default=default_token,
        help='Authentication token (default: $TRUSTGRAPH_TOKEN)',
    )

    parser.add_argument(
        '-w', '--workspace',
        default=default_workspace,
        help=f'Workspace (default: {default_workspace})',
    )

    args = parser.parse_args()

    try:

        dump_status(
            args.metrics_url, args.api_url, args.flow_id,
            token=args.token, workspace=args.workspace,
        )

    except Exception as e:

        print("Exception:", e, flush=True)

if __name__ == "__main__":
    main()
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #949** (2026-06-09): **Crash in `document-decoder`**
  *Symptoms*: 2.4.29. Suddenly started appearing on a standard test doc?  ``` 2026-05-26 11:23:58,061 - document-decoder - ERROR - Message processing exception: module 'matplotlib.ft2font' has no attribute '__path__' Traceback (most recent call last):   File "/usr/local/lib/python3.13/site-packages/trustgraph/base/consumer.py", line 239, in handle_one_from_queue     await self.handler(msg, self, self.flow)   File "/usr/local/lib/python3.13/site-packages/trustgraph/decoding/universal/processor.py", line 421, in on_message     elements = self.extract_elements(blob, mime_type)   File "/usr/local/lib/python3.13/site-packages/trustgraph/decoding/universal/processor.py", line 200, in extract_elements     elements = partition(**kwargs)   File "/usr/local/lib/python3.13/site-packages/unstructured/partition/auto.py", line 215, in partition     partition_pdf = partitioner_loader.get(file_type)   File "/usr/local/lib/python3.13/site-packages/unstructured/partition/auto.py", line 371, in get     self._partitioners[file_type] = self._load_partitioner(file_type)                                     ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^   File "/usr/local/lib/python3.13/site-packages/unstructured/partition/auto.py", line 389, in _load_partitioner     partitioner_module = importlib.import_module(file_type.partitioner_module_qname)   File "/usr/lib64/python3.13/importlib/__init__.py", line 88, in import_module     return _bootstrap._gcd_import(name[level:], package, level)            ~~~~~~~~~~~~~~~~~~~~~~^^^^^
  **Post-Mortem & Fix Analysis**:
  > Turns out the cause was an HTML doc fed in as a PDF doc. The test data doc was removed and so URL just returns an HTML error page
  > Maybe the real problem is that some validation should have taken place.
  > Opened PR #977 to handle this: https://github.com/trustgraph-ai/trustgraph/pull/977  The patch validates decoded PDF bytes before invoking the PDF loader, so HTML error pages or other non-PDF content are ignored without emitting page documents. Added unit coverage for librarian-backed content that is labeled as a PDF but contains HTML.

- **Issue #902** (2026-05-18): **fix: guard against empty query in SPARQL generator (#870)**
  *Symptoms*: Fixes #870.  Guard `query.split()[0]` so a future refactor that loosens or removes the `startswith` check cannot turn an empty/whitespace response into an unhandled IndexError. The new condition uses the already-split list, so the public behavior on valid queries is unchanged.
  **Post-Mortem & Fix Analysis**:
  > ## Contributor License Agreement  Thank you for your contribution! Before we can accept it, the following contributor(s) must sign our CLA:  **@SAY-5**  Please read the appropriate agreement: - Contributing as an **individual**? Read the [Individual CLA](https://github.com/trustgraph-ai/contributor-license-agreement/blob/main/Fiduciary-Contributor-License-Agreement.md) - Contributing on behalf of a **company or organisation**? Read the [Entity CLA](https://github.com/trustgraph-ai/contributor-license-agreement/blob/main/Entity-Fiduciary-Contributor-License-Agreement.md)  Once you have read the appropriate agreement, **post the following as a comment on this PR** (copy and paste exactly):  ``` I have read the CLA Document and I hereby sign the CLA ```  The bot will record your signature and update this PR automatically.
  > @SAY-5 can you please take a look at the Contributor License Agreement notice above?
  > Apologies for the delay. I'm not able to sign the CLA at this time, so feel free to close this if that's a blocker. The fix itself is small and the diff stands on its own if a maintainer wants to pick it up.

- **Issue #901** (2026-05-22): **text-completion worker treats OpenAI insufficient_quota as retryable (should fail fast)**
  *Symptoms*: **Version:** trustgraph-flow 2.3.21 **File:** `trustgraph/model/text_completion/openai/llm.py`  ## Repro  1. Use an OpenAI key whose account is out of credit (`insufficient_quota`). 2. Issue any TG call that goes through `text-completion-rag` (e.g. `tg-invoke-document-rag ...`).  ## Observed  ``` 2026-05-11 18:55:17,188 - text-completion-rag - HTTP/1.1 429 Too Many Requests 2026-05-11 18:55:17,789 - text-completion-rag - HTTP/1.1 429 Too Many Requests 2026-05-11 18:55:18,772 - text-completion-rag - HTTP/1.1 429 Too Many Requests ... 15 retries in 60s ```  15× retries with exponential backoff = ~20s of wall-clock latency before giving up. The user sees "TG is slow" rather than a clear billing error.  ## Root cause  The 429 retry path treats all 429 responses identically. The OpenAI response body distinguishes:  - `code: rate_limit_exceeded` — transient, retry-with-backoff is correct - `code: insufficient_quota` — billing exhausted, retry is futile - `code: invalid_api_key` / `account_deactivated` — terminal, retry is futile  ## Suggested fix  Parse the 429 body, branch on `error.code`:  ```python if response.status_code == 429:     try:         body = response.json()         code = body.get('error', {}).get('code')         if code in ('insufficient_quota', 'invalid_api_key', 'account_deactivated'):             raise PermanentError(f"OpenAI: {code} - {body['error']['message']}")     except (ValueError, KeyError):         pass     # otherwise: existing retry-with-backoff ```  I 
  **Post-Mortem & Fix Analysis**:
  > ## Root cause + proposed patch  `openai.RateLimitError` is a single class for **two semantically different conditions**:  | `e.body["error"]["code"]` | Meaning | Right action | |---|---|---| | `rate_limit_exceeded` | TPM/RPM ceiling hit | retry with backoff | | `insufficient_quota` | account out of credits / wrong project / hard cap | **fail fast** |  Current code in `trustgraph/model/text_completion/openai/llm.py:108-110`:  ```python except RateLimitError:     # Leave rate limit retries to the base handler     raise TooManyRequests() ```  Both raise `TooManyRequests`, which `base/consumer.py` retries forever with exponential backoff. On an exhausted account this melts a worker into an infinite retry loop and looks externally identical to "LLM slow" — which is what initially put me down the wrong rabbit hole for our graph-rag stall.  ### Proposed patch  Discriminate on `e.body`:  ```python # trustgraph/model/text_completion/openai/llm.py except RateLimitError as e:     # OpenAI uses Ra
  > #904 merged, this is closed.

- **Issue #900** (2026-07-07): **prompt-rag JSONL parser fails on Claude/non-OpenAI providers (document-rag times out)**
  *Symptoms*: **Version:** trustgraph-flow 2.3.21 (Docker image `docker.io/trustgraph/trustgraph-flow:2.3.21`)  ## Repro  1. Configure `text-completion` + `text-completion-rag` processors with `trustgraph.model.text_completion.claude.Processor` instead of `openai.Processor`. 2. Set `CLAUDE_KEY` env, restart workers, restart flow with `--param llm-model=claude-haiku-4-5-20251001 --param llm-rag-model=claude-haiku-4-5-20251001`. 3. Verify bare LLM works:    ```    tg-invoke-llm -f sizzl-ontology "" "Say PONG"    # -> "PONG" in ~2s, HTTP 200 from api.anthropic.com    ``` 4. Try `tg-invoke-document-rag`:    ```    tg-invoke-document-rag -u http://api-gateway:8088/ -f sizzl-ontology -C sizzl-market -d 2 -q "What does X sell?"    # -> Exception (empty body) at ~33s    ```  ## Observed logs (`docker logs deploy-rag-1`)  ``` prompt-rag - WARNING - JSONL parse error on line 1: Expecting value: line 1 column 1 (char 0) prompt-rag - WARNING - JSONL parse error on line 3: Expecting value: line 1 column 1 (char 0) prompt-rag - WARNING - JSONL parse error on line 5: Expecting value: line 1 column 1 (char 0) prompt-rag - WARNING - JSONL parse returned no valid objects ... (repeats)  document-rag - ERROR - Exception processing response: asyncio.exceptions.CancelledError ... TimeoutError ```  text-completion-rag DID get HTTP 200 from Anthropic with token counts logged. The response is plain prose. prompt-rag's parser expects JSONL, gets nothing parseable, returns empty, document-rag times out at 30s.  ## R
  **Post-Mortem & Fix Analysis**:
  > ## Root cause + proposed patch  Reproduced live in TG 2.3.21 against Claude (`claude-3-5-sonnet-20241022`) on flow `sizzl-everything`. `prompt-rag` (document-rag step) hangs ~60s then times out. Log shows the LLM responded fine — parser drops everything.  The bug is in `trustgraph/template/prompt_manager.py::parse_jsonl()`. It splits on `\n` and `json.loads()` each line. That only works for true JSONL (one object per line). Claude — and any model not specifically prompted with "respond as JSONL" — returns a JSON **array** instead:  ``` [   {"question": "..."},   {"question": "..."} ] ```  Every line is invalid JSON in isolation (`[`, `{...},`, `]`), each `json.loads` raises, and the warning loop swallows them silently. The function returns `[]`. Downstream `document-rag` gets an empty question list and the chain stalls.  ### Proposed patch  Add a JSON-array fallback before the line-by-line loop. Keep JSONL behavior as the second-chance path so existing OpenAI-tuned prompts don't regres
  > @beca-oc  thanks for the detailed report.  I can't reproduce this at the moment.  I've tested with claude-haiku-4-5-20251001.  You reported that the issue occurs when using `tg-invoke-document-rag`, which uses two prompts, `extract-concepts` following by `document-synthesis`.  In default configuration, neither of these prompts uses JSONL output.  Perhaps you could check the prompts you are using, did they get re-configured to use JSONL, output?  Both should be `text`.  ``` document-prompt: +----------+-----------------------------------------------------------------------+ | prompt   | Study the following context. Use only the information provided in the | |          | context in your response. Do not speculate if the answer is not found | |          | in the provided set of knowledge statements.                          | |          | Here is the context:                                                  | |          | {{documents}}                                                      
  > Using the `document-synthesis` prompt with Claude 4.5 Haiku...  <img width="1669" height="1198" alt="Image" src="https://github.com/user-attachments/assets/ef004988-7330-4ad0-b067-49446c55acc6" />

- **Issue #894** (2026-05-18): **api-gateway --timeout flag silently ignored by all per-service dispatchers (manager.py:239, 396)**
  *Symptoms*: **Repo:** `trustgraph-ai/trustgraph` **Suggested title:** `api-gateway --timeout flag silently ignored by all per-service dispatchers (manager.py:239, 396)` **Suggested labels:** `bug`, `good first issue`, `gateway`  ---  ## Summary  The `api-gateway` accepts a `--timeout` flag (default `600`, [`gateway/service.py:36`](https://github.com/trustgraph-ai/trustgraph/blob/main/trustgraph-flow/trustgraph/gateway/service.py#L36)) and stores it on `Service.timeout`. The flag is documented as *"API request timeout in seconds"*, and the value is wired correctly into the WebSocket endpoint manager.  However, the value is **not** propagated into `DispatcherManager`, which constructs every per-service dispatcher (graph-rag, document-rag, text-completion, embeddings, librarian, …) with a **hardcoded `timeout = 120`**. So `--timeout 600` (or any other value) has no effect on actual request paths.  The practical effect: any synchronous request that takes more than two minutes returns `{"error": {"type": "gateway-error", "message": "Timeout"}}` exactly at the 120 s mark, regardless of the gateway flag. This is easy to hit on graph-rag with default parameters (`entity_limit=50, max_path_length=2`) on a single-node Cassandra triples-store, which fans out to ~300 SPARQL streaming queries.  ## Reproduction  Stack: `trustgraph/trustgraph-flow:2.3.21`, default docker-compose deploy with `--timeout 600` on `api-gateway`.  ```bash # A request whose server-side processing takes ~150 s time curl -sS -X

- **Issue #873** (2026-05-26): **Unsafe string split when parsing Prometheus metric labels in ontology monitoring**
  *Symptoms*: ## Description  In `trustgraph-flow/trustgraph/query/ontology/monitoring.py` (line 478):  ```python cache_type = metric_name.split('cache_type=')[1].split(',')[0].split('}')[0] ```  ## Problem  If a metric name in the counters dict doesn't contain the substring \`cache_type=\`, the \`split()\` returns a single-element list and \`[1]\` raises \`IndexError\`.  The guard on line 477 (\`if 'cache_type=' in metric_name\`) currently prevents this, but the parsing itself is fragile — any refactoring that moves or removes the guard exposes the crash.  The chained-split approach is also hard to read.  ## Suggested fix  Please PR against the latest `release/vX.Y` branch.  Use a small helper or regex to extract label values safely:  ```python def _extract_label(metric_name, label):     """Extract a Prometheus-style label value from a metric name, or None."""     prefix = f'{label}="'     if prefix not in metric_name:         return None     return metric_name.split(prefix)[1].split('"')[0] ```  Or keep inline but add a guard:  ```python parts = metric_name.split('cache_type=') if len(parts) < 2:     continue cache_type = parts[1].split(',')[0].split('}')[0] ```  ## What you'll learn  How TrustGraph's ontology query engine collects and reports internal performance metrics, and safe patterns for parsing structured strings.
  **Post-Mortem & Fix Analysis**:
  > I can take this.  I’ll replace the chained split with a safe label extractor and add coverage for metrics with and without `cache_type`.
  > Fixed by #948 

- **Issue #871** (2026-05-08): **Publisher not cleaned up on error in librarian submit_document**
  *Symptoms*: ## Description  In `trustgraph-flow/trustgraph/librarian/service.py` (lines 449–460):  ```python pub = Publisher(     self.pubsub, q, schema=schema )  await pub.start()  # FIXME: Time wait kludge? await asyncio.sleep(1)  await pub.send(None, doc)  await pub.stop() ```  ## Problem  If `pub.send()` raises an exception, `pub.stop()` is never called and the publisher (and its underlying connection) leaks.  Other code in the same file already handles this correctly — see lines 374–394 which use `try / finally` around the same pattern.  There is also a `FIXME` comment on the `asyncio.sleep(1)` that should be investigated.  ## Suggested fix  Please PR against the latest `release/vX.Y` branch.  Wrap in try/finally, matching the existing pattern at line 378:  ```python pub = Publisher(self.pubsub, q, schema=schema) try:     await pub.start()     await pub.send(None, doc) finally:     await pub.stop() ```  Also investigate whether the `asyncio.sleep(1)` is still necessary and either remove it or document why it's needed.  ## What you'll learn  How the librarian service submits documents to processing queues, async resource management patterns in Python, and how to spot inconsistencies by reading surrounding code.

- **Issue #870** (2026-05-19): **IndexError on empty query string in SPARQL generator**
  *Symptoms*: ## Description  In `trustgraph-flow/trustgraph/query/ontology/sparql_generator.py` (line 209):  ```python query_type=query.split()[0].upper(), ```  ## Problem  If the LLM returns an empty or whitespace-only string that passes the `startswith` check on line 205 (it won't in practice, but the guard is incomplete), `query.split()` returns an empty list and `[0]` raises `IndexError`.  More realistically, if the code is refactored and the `startswith` guard on line 205 is changed or removed, this line becomes an unguarded crash point.  ## Suggested fix  Please PR against the latest `release/vX.Y` branch.  Add a guard before indexing:  ```python parts = query.split() if not parts:     # handle empty query — skip or use a default     ... query_type = parts[0].upper() ```  ## What you'll learn  How TrustGraph's SPARQL generation pipeline processes LLM output, and defensive coding practices for parsing untrusted text.

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

### Incident Patch 1: `dd96de4d` (2026-09-30)
**Commit Message**: Fix Discord badge link in README.md (#1146)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 [![Docker Pulls](https://github.com/trustgraph-ai/badges/blob/master/docker-pulls.svg)](https://hub.docker.com/u/trustgraph) [![PyPI version](https://img.shields.io/pypi/v/trustgraph.svg)](https://pypi.org/project/trustgraph/) ![License](https://img.shields.io/badge/license-Apache%202.0-blue) ![E2E Tests](https://github.com/trustgraph-ai/trustgraph/actions/workflows/release.yaml/badge.svg)
 [![Discord](https://img.shields.io/discord/1251652173201149994
-)](https://discord.gg/kT5dAsaj8v) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/trustgraph-ai/trustgraph)
+)](https://discord.gg/kT5dAsaj8v)
 
 [**Playground**](https://docs.google.com/forms/d/e/1FAIpQLSeTnF22ZjUP20FWV--VvS5606x-5cOvnKty6AqcPdtlnPuqbQ/viewform) | [**Self-Host**](https://config-ui.demo.trustgraph.ai/) | [**Docs**](https://docs.trustgraph.ai) | [**YouTube**](https://www.youtube.com/@TrustGraphAI?sub_confirmation=1) | [**Discord**](https://discord.gg/sQMwkRz5GX) | [**Website**](https://trustgraph.ai) 
 
```

---

### Incident Patch 2: `181223e8` (2026-09-22)
**Commit Message**: fix: parse ontology definitions without eval (#1128)

**File**: `trustgraph-flow/trustgraph/extract/kg/ontology/ontology_selector.py` (modified, +11/-4)
```diff
@@ -3,6 +3,7 @@
 Selects relevant ontology subsets based on text similarity.
 """
 
+import ast
 import logging
 from typing import List, Dict, Any, Set, Optional, Tuple
 from dataclasses import dataclass
@@ -186,11 +187,17 @@ def _build_ontology_subsets(self, relevant_elements: Set[Tuple[str, str, str, Di
         for ont_id, elem_type, elem_id, definition in relevant_elements:
             # Parse definition back from string if needed
             if isinstance(definition, str):
-                import json
+                # These strings come from str(dict) above, which is a Python
+                # repr and not JSON. Swapping quotes breaks on any value
+                # containing an apostrophe, and the old fallback ran eval on
+                # metadata that arrives from the vector store.
                 try:
-                    definition = json.loads(definition.replace("'", '"'))
-                except:
-                    definition = eval(definition)  # Fallback for dict-like strings
+                    definition = ast.literal_eval(definition)
+                except (ValueError, SyntaxError):
+                    logger.warning(
+                        f"Could not parse definition for {ont_id}/{elem_id}, skipping"
+                    )
+                    continue
 
             # Get the actual ontology and element
             ontology = self.loader.get_ontology(ont_id)
```

---

### Incident Patch 3: `9215897a` (2026-09-20)
**Commit Message**: fix(api): send graph URI as plain string in bulk triple import (#1127)

_string_to_term() was converting the graph URI into a Term dict
(e.g. {"t": "i", "i": "urn:graph:source"}) but Triple.g is str,
not Term. The deserializer passed the dict through to Cassandra
which failed with 'dict' object has no attribute 'encode'.

**File**: `trustgraph-base/trustgraph/api/async_bulk_client.py` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ async def import_triples(self, flow: str, triples: AsyncIterator[Triple], **kwar
                     ),
                 }
                 if triple.g:
-                    t["g"] = _string_to_term(triple.g)
+                    t["g"] = triple.g
                 await websocket.send(json.dumps(t))
 
     async def export_triples(self, flow: str, **kwargs: Any) -> AsyncIterator[Triple]:
```

**File**: `trustgraph-base/trustgraph/api/bulk_client.py` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ async def _import_triples_async(
                     ),
                 }
                 if triple.g:
-                    t["g"] = _string_to_term(triple.g)
+                    t["g"] = triple.g
                 batch.append(t)
                 if len(batch) >= batch_size:
                     message = {
```

---

### Incident Patch 4: `5755c6f9` (2026-09-20)
**Commit Message**: fix(sparql): check bool before int/float in BIND evaluation (#1126)

Python bool is a subclass of int, so the (int, float) branch was
catching booleans first, producing untyped literals like "True" instead
of xsd:boolean "true". This caused FILTER on bound boolean variables
to always evaluate to true since _effective_boolean treats non-empty
untyped strings as truthy.

**File**: `trustgraph-flow/trustgraph/query/sparql/algebra.py` (modified, +4/-4)
```diff
@@ -461,15 +461,15 @@ def exists_cb(graph_node, sol):
         new_sol = dict(sol)
         if isinstance(val, Term):
             new_sol[var_name] = val
-        elif isinstance(val, (int, float)):
-            new_sol[var_name] = Term(type=LITERAL, value=str(val))
-        elif isinstance(val, str):
-            new_sol[var_name] = Term(type=LITERAL, value=val)
         elif isinstance(val, bool):
             new_sol[var_name] = Term(
                 type=LITERAL, value=str(val).lower(),
                 datatype="http://www.w3.org/2001/XMLSchema#boolean"
             )
+        elif isinstance(val, (int, float)):
+            new_sol[var_name] = Term(type=LITERAL, value=str(val))
+        elif isinstance(val, str):
+            new_sol[var_name] = Term(type=LITERAL, value=val)
         elif val is not None:
             new_sol[var_name] = Term(type=LITERAL, value=str(val))
         yield new_sol
```

---

### Incident Patch 5: `bb3632ec` (2026-09-16)
**Commit Message**: fix(test): update pdf decoder tests for pypdf migration (#1124)

Replace PyPDFLoader mocks with PdfReader mocks to match the langchain
removal in trustgraph-flow. Tests now mock pypdf.PdfReader with .pages
and .extract_text() instead of langchain's .load() and .page_content.

**File**: `tests/unit/test_decoding/test_pdf_decoder.py` (modified, +25/-22)
```diff
@@ -40,20 +40,22 @@ async def test_processor_initialization(self):
         assert consumer_specs[0].name == "input"
         assert consumer_specs[0].schema == Document
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_message_success(self, mock_pdf_loader_class):
+    async def test_on_message_success(self, mock_pdf_reader_class):
         """Test successful PDF processing"""
         # Mock PDF content
         pdf_content = b"%PDF-1.7\nfake pdf content"
         pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
 
-        # Mock PyPDFLoader
-        mock_loader = MagicMock()
-        mock_page1 = MagicMock(page_content="Page 1 content")
-        mock_page2 = MagicMock(page_content="Page 2 content")
-        mock_loader.load.return_value = [mock_page1, mock_page2]
-        mock_pdf_loader_class.return_value = mock_loader
+        # Mock PdfReader
+        mock_reader = MagicMock()
+        mock_page1 = MagicMock()
+        mock_page1.extract_text.return_value = "Page 1 content"
+        mock_page2 = MagicMock()
+        mock_page2.extract_text.return_value = "Page 2 content"
+        mock_reader.pages = [mock_page1, mock_page2]
+        mock_pdf_reader_class.return_value = mock_reader
 
         # Mock message
         mock_metadata = Metadata(id="test-doc")
@@ -84,9 +86,9 @@ async def test_on_message_success(self, mock_pdf_loader_class):
         # Verify triples were sent for each page (provenance)
         assert mock_triples_flow.send.call_count == 2
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_message_rejects_librarian_content_that_is_not_pdf(self, mock_pdf_loader_class):
+    async def test_on_message_rejects_librarian_content_that_is_not_pdf(self, mock_pdf_reader_class):
         """Test rejecting non-PDF content before invoking the PDF loader"""
         html_content = b"<html><body>Not found</body></html>"
         html_base64 = base64.b64encode(html_content)
@@ -119,21 +121,21 @@ async def test_on_message_rejects_librarian_content_that_is_not_pdf(self, mock_p
 
         await processor.on_message(mock_msg, None, mock_flow)
 
-        mock_pdf_loader_class.assert_not_called()
+        mock_pdf_reader_class.assert_not_called()
         mock_output_flow.send.assert_not_called()
         mock_triples_flow.send.assert_not_called()
         mock_flow.librarian.save_child_document.assert_not_called()
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_message_empty_pdf(self, mock_pdf_loader_class):
+    async def test_on_message_empty_pdf(self, mock_pdf_reader_class):
         """Test handling of empty PDF"""
         pdf_content = b"%PDF-1.7\nfake pdf content"
         pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
 
-        mock_loader = MagicMock()
-        mock_loader.load.return_value = []
-        mock_pdf_loader_class.return_value = mock_loader
+        mock_reader = MagicMock()
+        mock_reader.pages = []
+        mock_pdf_reader_class.return_value = mock_reader
 
         mock_metadata = Metadata(id="test-doc")
         mock_document = Document(metadata=mock_metadata, data=pdf_base64)
@@ -154,17 +156,18 @@ async def test_on_message_empty_pdf(self, mock_pdf_loader_class):
 
         mock_output_flow.send.assert_not_called()
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_message_unicode_content(self, mock_pdf_loader_class):
+    async def test_on_message_unicode_content(self, mock_pdf_reader_class):
         """Test handling of unicode content in PDF"""
         pdf_content = b"%PDF-1.7\nfake pdf content"
         pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
 
-        mock_loader = MagicMock()
-        mock_page = MagicMock(page_content="Page with unicode: 你好世界 🌍")
-        mock_loader.load.return_value = [mock_page]
-        mock_pdf_loader_class.return_value = mock_loader
+        mock_reader = MagicMock()
+        mock_page = MagicMock()
+        mock_page.extract_text.return_value = "Page with unicode: 你好世界 🌍"
+        mock_reader.pages = [mock_page]
+        mock_pdf_reader_class.return_value = mock_reader
 
         mock_metadata = Metadata(id="test-doc")
         mock_document = Document(metadata=mock_metadata, data=pdf_base64)
```

---

### Incident Patch 6: `5348d9f3` (2026-09-16)
**Commit Message**: fix(ci): widen top-level permissions so reusable workflow inherits them (#1121)

Reusable workflow jobs inherit permissions from the caller. The
top-level permissions were contents:read which blocked the nested
jobs from requesting contents:write + id-token:write.

**File**: `.github/workflows/build-container.yaml` (modified, +0/-6)
```diff
@@ -19,9 +19,6 @@ jobs:
   build-platform:
 
     name: Build ${{ inputs.container }} (${{ matrix.platform }})
-    permissions:
-      contents: write
-      id-token: write
     environment:
       name: release
     strategy:
@@ -66,9 +63,6 @@ jobs:
     name: Combine manifest ${{ inputs.container }}
     runs-on: ubuntu-24.04
     needs: build-platform
-    permissions:
-      contents: write
-      id-token: write
     environment:
       name: release
 
```

**File**: `.github/workflows/release.yaml` (modified, +2/-1)
```diff
@@ -8,7 +8,8 @@ on:
       - v*
 
 permissions:
-  contents: read
+  contents: write
+  id-token: write
 
 jobs:
 
```

---

### Incident Patch 7: `a3803890` (2026-09-16)
**Commit Message**: ci: combine manifests per-container instead of waiting for all builds (#1120)

Extract container build+combine into a reusable workflow
(build-container.yaml) so each container's manifest is created as
soon as its amd64 and arm64 images are ready, rather than waiting
for every container to finish building.

**File**: `.github/workflows/build-container.yaml` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+
+name: Build and publish container
+
+on:
+  workflow_call:
+    inputs:
+      container:
+        required: true
+        type: string
+      version:
+        required: true
+        type: string
+    secrets:
+      DOCKER_SECRET:
+        required: true
+
+jobs:
+
+  build-platform:
+
+    name: Build ${{ inputs.container }} (${{ matrix.platform }})
+    permissions:
+      contents: write
+      id-token: write
+    environment:
+      name: release
+    strategy:
+      matrix:
+        platform:
+          - amd64
+          - arm64
+        include:
+          - platform: amd64
+            runner: ubuntu-24.04
+          - platform: arm64
+            runner: ubuntu-24.04-arm
+
+    runs-on: ${{ matrix.runner }}
+
+    steps:
+
+      - name: Checkout
+        uses: actions/checkout@v4
+
+      - name: "Free up some disk space"
+        run: |
+          sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc
+          sudo rm -rf /opt/hostedtoolcache/CodeQL
+          podman image prune --all --force
+          podman builder prune -a -f
+
+      - name: Docker Hub token
+        run: echo ${{ secrets.DOCKER_SECRET }} > docker-token.txt
+
+      - name: Authenticate with Docker hub
+        run: make docker-hub-login
+
+      - name: Build container
+        run: make platform-${{ inputs.container }}-${{ matrix.platform }} VERSION=${{ inputs.version }}
+
+      - name: Push container
+        run: make push-platform-${{ inputs.container }}-${{ matrix.platform }} VERSION=${{ inputs.version }}
+
+  combine-manifest:
+
+    name: Combine manifest ${{ inputs.container }}
+    runs-on: ubuntu-24.04
+    needs: build-platform
+    permissions:
+      contents: write
+      id-token: write
+    environment:
+      name: release
+
+    steps:
+
+      - name: Checkout
+        uses: actions/checkout@v4
+
+      - name: Docker Hub token
+        run: echo ${{ secrets.DOCKER_SECRET }} > docker-token.txt
+
+      - name: Authenticate with Docker hub
+        run: make docker-hub-login
+
+      - name: Combine and push manifest
+        run: make combine-manifest-${{ inputs.container }} VERSION=${{ inputs.version }}
```

**File**: `.github/workflows/release.yaml` (modified, +92/-97)
```diff
@@ -12,128 +12,123 @@ permissions:
 
 jobs:
 
-  python-packages:
+  get-version:
 
-    name: Release Python packages
+    name: Determine version
     runs-on: ubuntu-24.04
-    permissions:
-      contents: write
-      id-token: write
-    environment:
-      name: release
-
-    steps:
-
-      - name: Checkout
-        uses: actions/checkout@v4
-
-      - name: Get version
-        id: version
-        run: echo VERSION=$(git describe --exact-match --tags | sed 's/^v//') >> $GITHUB_OUTPUT
-
-      - name: Install dependencies
-        run: pip install build wheel
-
-      - name: Build packages
-        run: make packages VERSION=${{ steps.version.outputs.VERSION }}
-
-      - name: Publish release distributions to PyPI
-        uses: pypa/gh-action-pypi-publish@release/v1
-
-  build-platform-image:
-
-    name: Build ${{ matrix.container }} (${{ matrix.platform }})
-    permissions:
-      contents: write
-      id-token: write
-    environment:
-      name: release
-    strategy:
-      matrix:
-        container:
-          - base
-          - flow
-          - bedrock
-          - vertexai
-          - hf
-          - ocr
-          - docling
-          - mcp
-        platform:
-          - amd64
-          - arm64
-        include:
-          - platform: amd64
-            runner: ubuntu-24.04
-          - platform: arm64
-            runner: ubuntu-24.04-arm
-
-    runs-on: ${{ matrix.runner }}
+    outputs:
+      version: ${{ steps.version.outputs.VERSION }}
 
     steps:
 
       - name: Checkout
         uses: actions/checkout@v4
 
-      - name: "Free up some disk space"
-        run: |
-          sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc
-          sudo rm -rf /opt/hostedtoolcache/CodeQL
-          podman image prune --all --force
-          podman builder prune -a -f
-
-      - name: Docker Hub token
-        run: echo ${{ secrets.DOCKER_SECRET }} > docker-token.txt
-
-      - name: Authenticate with Docker hub
-        run: make docker-hub-login
-
       - name: Get version
         id: version
         run: echo VERSION=$(git describe --exact-match --tags | sed 's/^v//') >> $GITHUB_OUTPUT
 
-      - name: Build container
-        run: make platform-${{ matrix.container }}-${{ matrix.platform }} VERSION=${{ steps.version.outputs.VERSION }}
-
-      - name: Push container
-        run: make push-platform-${{ matrix.container }}-${{ matrix.platform }} VERSION=${{ steps.version.outputs.VERSION }}
-
-  combine-manifests:
+  python-packages:
 
-    name: Combine manifest ${{ matrix.container }}
+    name: Release Python packages
     runs-on: ubuntu-24.04
-    needs: build-platform-image
+    needs: get-version
     permissions:
       contents: write
       id-token: write
     environment:
       name: release
-    strategy:
-      matrix:
-        container:
-          - base
-          - flow
-          - bedrock
-          - vertexai
-          - hf
-          - ocr
-          - docling
-          - mcp
 
     steps:
 
       - name: Checkout
         uses: actions/checkout@v4
 
-      - name: Docker Hub token
-        run: echo ${{ secrets.DOCKER_SECRET }} > docker-token.txt
+      - name: Install dependencies
+        run: pip install build wheel
 
-      - name: Authenticate with Docker hub
-        run: make docker-hub-login
+      - name: Build packages
+        run: make packages VERSION=${{ needs.get-version.outputs.version }}
 
-      - name: Get version
-        id: version
-        run: echo VERSION=$(git describe --exact-match --tags | sed 's/^v//') >> $GITHUB_OUTPUT
+      - name: Publish release distributions to PyPI
+        uses: pypa/gh-action-pypi-publish@release/v1
 
-      - name: Combine and push manifest
-        run: make combine-manifest-${{ matrix.container }} VERSION=${{ steps.version.outputs.VERSION }}
+  container-base:
+    name: base
+    needs: get-version
+    uses: ./.github/workflows/build-container.yaml
+    with:
+      container: base
+      version: ${{ needs.get-version.outputs.version }}
+    secrets:
+      DOCKER_SECRET: ${{ secrets.DOCKER_SECRET }}
+
+  container-flow:
+    name: flow
+    needs: get-version
+    uses: ./.github/workflows/build-container.yaml
+    with:
+      container: flow
+      version: ${{ needs.get-version.outputs.version }}
+    secrets:
+      DOCKER_SECRET: ${{ secrets.DOCKER_SECRET }}
+
+  container-bedrock:
+    name: bedrock
+    needs: get-version
+    uses: ./.github/workflows/build-container.yaml
+    with:
+      container: bedrock
+      version: ${{ needs.get-version.outputs.version }}
+    secrets:
+      DOCKER_SECRET: ${{ secrets.DOCKER_SECRET }}
+
+  container-vertexai:
+    name: vertexai
+    needs: get-version
+    uses: ./.github/workflows/build-container.yaml
+    with:
+      container: vertexai
+      version: ${{ needs.get-version.outputs.version }}
+    secrets:
+      DOCKER_SECRET: ${{ secrets.DOCKER_SECRET }}
+
+  container-hf:
+    name: hf
+    needs: get-version
+    uses:
```

---

### Incident Patch 8: `a6c2b022` (2026-09-16)
**Commit Message**: fix(test): remove MCP SDK internal assertions from transport compat test (#1118)

The follow_redirects and timeout assertions tested MCP SDK internals
rather than TrustGraph behaviour. A newer MCP SDK release stopped
passing follow_redirects as a constructor kwarg, breaking CI.

**File**: `tests/unit/test_agent/test_mcp_tool_transport_compat.py` (modified, +0/-2)
```diff
@@ -122,8 +122,6 @@ def create_in_process_client(*args, **kwargs):
         isinstance(result, str) and "hello" in result
     )
     assert len(client_options) == 1
-    assert client_options[0]["follow_redirects"] is True
-    assert isinstance(client_options[0]["timeout"], http_module.Timeout)
     assert captured_app.requests
 
     for headers in captured_app.requests:
```

---

### Incident Patch 9: `952d5259` (2026-09-16)
**Commit Message**: fix(cli): catch the real exceptions in the doc-embeds tools (#1115)

**File**: `tests/unit/test_cli/test_doc_embeds_errors.py` (added, +301/-0)
```diff
@@ -0,0 +1,301 @@
+"""
+Unit tests for error handling in the doc-embeds CLI tools.
+
+Both modules run their argument parser at import time, so they cannot be
+imported directly.  _load_module() executes everything up to that point and
+hands back the module namespace.
+"""
+
+import ast
+import asyncio
+import io
+import types
+from pathlib import Path
+
+import msgpack
+import pytest
+
+CLI = Path(__file__).parents[3] / "trustgraph-cli" / "trustgraph" / "cli"
+
+
+def _load_module(name):
+    """Execute a doc-embeds CLI module without its top-level entry point."""
+    source = (CLI / f"{name}.py").read_text()
+    tree = ast.parse(source)
+    body = [
+        node for node in tree.body
+        if isinstance(node, (ast.Import, ast.ImportFrom, ast.ClassDef,
+                             ast.FunctionDef, ast.AsyncFunctionDef, ast.Assign))
+    ]
+    module = types.ModuleType(name)
+    exec(compile(ast.Module(body=body, type_ignores=[]), name, "exec"),
+         module.__dict__)
+    return module
+
+
+@pytest.fixture
+def load_de_mod():
+    return _load_module("load_doc_embeds")
+
+
+@pytest.fixture
+def save_de_mod():
+    return _load_module("save_doc_embeds")
+
+
+def _core(tmp_path, messages):
+    path = tmp_path / "core.msgpack"
+    with open(path, "wb") as f:
+        for msg in messages:
+            f.write(msgpack.packb(msg, use_bin_type=True))
+    return path
+
+
+def _entry(doc_id="doc-1"):
+    return ["de", {"m": {"i": doc_id, "m": [], "c": "default"},
+                   "c": [{"c": "chunk", "v": [[0.1, 0.2]]}]}]
+
+
+class TestLoader:
+    """loader() reads the core file and feeds the queue."""
+
+    async def test_corrupt_message_is_reported(self, load_de_mod, tmp_path):
+        """A body that is not valid msgpack must not look like end of file."""
+        path = tmp_path / "core.msgpack"
+        path.write_bytes(msgpack.packb(_entry()) + b"\xc1\xc1\xc1")
+
+        running = load_de_mod.Running()
+        queue = asyncio.Queue(maxsize=10)
+
+        with pytest.raises(Exception) as excinfo:
+            await load_de_mod.loader(running, queue, str(path), "msgpack", None)
+
+        assert not isinstance(excinfo.value, msgpack.exceptions.OutOfData)
+
+    async def test_end_of_stream_stops_the_loader(self, load_de_mod, tmp_path):
+        """Regression guard: passes with and without the fix."""
+        path = _core(tmp_path, [_entry("a"), _entry("b")])
+
+        running = load_de_mod.Running()
+        queue = asyncio.Queue(maxsize=10)
+
+        await asyncio.wait_for(
+            load_de_mod.loader(running, queue, str(path), "msgpack", None), 5
+        )
+
+        assert queue.qsize() == 3
+        assert queue.get_nowait()["m"]["i"] == "a"
+        assert queue.get_nowait()["m"]["i"] == "b"
+        assert queue.get_nowait() is None
+
+    async def test_a_full_queue_does_not_lose_messages(self, load_de_mod,
+                                                       tmp_path):
+        """Regression guard: the put retry loop still waits for room."""
+        path = _core(tmp_path, [_entry("a")])
+
+        running = load_de_mod.Running()
+        queue = asyncio.Queue(maxsize=1)
+        filler = object()
+        queue.put_nowait(filler)
+        drained = []
+
+        async def consumer():
+            await asyncio.sleep(1.2)
+            while True:
+                item = await queue.get()
+                drained.append(item)
+                if item is None:
+                    return
+
+        await asyncio.wait_for(
+            asyncio.gather(
+                load_de_mod.loader(running, queue, str(path), "msgpack", None),
+                consumer(),
+            ),
+            10,
+        )
+
+        assert drained[0] is filler
+        assert drained[1]["m"]["i"] == "a"
+        assert drained[2] is None
+
+    async def test_a_put_failure_is_not_retried_forever(self, load_de_mod,
+                                                        tmp_path, monkeypatch):
+        """Anything other than a timeout on put() must surface."""
+        path = _core(tmp_path, [_entry("a")])
+        real_wait_for = asyncio.wait_for
+        calls = []
+
+        async def failing_wait_for(aw, timeout):
+            calls.append(timeout)
+            aw.close()
+            await asyncio.sleep(0)
+            if len(calls) > 3:
+                return await real_wait_for(asyncio.sleep(0), timeout)
+            raise RuntimeError("queue is broken")
+
+        monkeypatch.setattr(load_de_mod.asyncio, "wait_for", failing_wait_for)
+
+        running = load_de_mod.Running()
+        with pytest.raises(RuntimeError, match="queue is broken"):
+            await real_wait_for(
+                load_de_mod.loader(
+                    running, asyncio.Queue(maxsize=10), str(path), "msgpack",
+                    None,
+                ),
+                5,
+            )
+        assert len(calls) == 1
+
+
+class TestLoadDe:
+    """load_de() drains the queue onto the websocket.""
```

**File**: `trustgraph-cli/trustgraph/cli/load_doc_embeds.py` (modified, +5/-10)
```diff
@@ -37,9 +37,7 @@ async def load_de(running, queue, url):
                     if msg is None:
                         break
 
-                except:
-                    # Hopefully it's TimeoutError.  Annoying to match since
-                    # it changed in 3.11.
+                except asyncio.TimeoutError:
                     continue
 
                 msg = {
@@ -92,7 +90,8 @@ async def loader(running, de_queue, path, format, collection):
 
                 try:
                     unpacked = unpacker.unpack()
-                except:
+                except msgpack.exceptions.OutOfData:
+                    # No more complete messages in the file.
                     break
 
                 if collection:
@@ -109,9 +108,7 @@ async def loader(running, de_queue, path, format, collection):
                         # Successful put message, move on
                         break
 
-                    except:
-                        # Hopefully it's TimeoutError.  Annoying to match since
-                        # it changed in 3.11.
+                    except asyncio.TimeoutError:
                         continue
 
                 if not running.get(): break
@@ -125,9 +122,7 @@ async def loader(running, de_queue, path, format, collection):
                 # Successful put message, move on
                 break
 
-            except:
-                # Hopefully it's TimeoutError.  Annoying to match since
-                # it changed in 3.11.
+            except asyncio.TimeoutError:
                 continue
 
 async def run(running, **args):
```

**File**: `trustgraph-cli/trustgraph/cli/save_doc_embeds.py` (modified, +2/-4)
```diff
@@ -31,7 +31,7 @@ async def fetch_de(running, queue, collection, url):
 
                 try:
                     msg = await asyncio.wait_for(ws.receive(), 1)
-                except:
+                except asyncio.TimeoutError:
                     continue
 
                 if msg.type == aiohttp.WSMsgType.TEXT:
@@ -89,9 +89,7 @@ async def output(running, queue, path, format):
 
             try:
                 msg = await asyncio.wait_for(queue.get(), 0.5)
-            except:
-                # Hopefully it's TimeoutError.  Annoying to match since
-                # it changed in 3.11.
+            except asyncio.TimeoutError:
                 continue
 
             if format == "msgpack":
```

---

### Incident Patch 10: `c82a1f50` (2026-09-03)
**Commit Message**: fix(cli): preserve datatype and language tag in parse_nquads (#1095) (#1111)

parse_nquads was using str() on rdflib terms, discarding datatype,
language tag, and IRI-vs-literal distinctions on import. Populate
Triple.o_datatype and Triple.o_language from the rdflib term so
workspace bundle round-trips are lossless.

**File**: `tests/unit/test_cli/test_nquads.py` (modified, +41/-1)
```diff
@@ -9,7 +9,7 @@
 
 import rdflib
 
-from trustgraph.cli.nquads import serialize_nquads, triple_to_nquad, encode_term
+from trustgraph.cli.nquads import serialize_nquads, parse_nquads, triple_to_nquad, encode_term
 
 from tests.unit.test_cli.conftest import iri, lit
 
@@ -122,6 +122,46 @@ def test_unusable_language_tags_are_skipped_not_emitted(self):
             obj = next(iter(ds.quads((None, None, None, None))))[2]
             assert obj == rdflib.Literal("bonjour", lang=ok)
 
+    def test_parse_nquads_preserves_term_types(self):
+        """parse_nquads must preserve datatype, language and IRI-vs-literal."""
+        batches = [[
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/typed"),
+             "o": lit("42", d="http://www.w3.org/2001/XMLSchema#integer")},
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/tagged"),
+             "o": lit("bonjour", lang="fr")},
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/ref"),
+             "o": iri("http://example.com/o")},
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/str"),
+             "o": lit("http://example.com/o")},
+        ]]
+        out = io.StringIO()
+        serialize_nquads(batches, GRAPH, out)
+        triples = parse_nquads(out.getvalue().encode())
+
+        by_pred = {t.p: t for t in triples}
+
+        typed = by_pred["http://example.com/typed"]
+        assert typed.o == "42"
+        assert typed.o_datatype == "http://www.w3.org/2001/XMLSchema#integer"
+        assert typed.o_language == ""
+
+        tagged = by_pred["http://example.com/tagged"]
+        assert tagged.o == "bonjour"
+        assert tagged.o_language == "fr"
+        assert tagged.o_datatype == ""
+
+        ref = by_pred["http://example.com/ref"]
+        assert ref.o == "http://example.com/o"
+        assert ref.o_datatype == ""
+        assert ref.o_language == ""
+
+        string_lit = by_pred["http://example.com/str"]
+        assert string_lit.o == "http://example.com/o"
+        assert string_lit.o_datatype == ""
+
+        # IRI and literal with the same lexical form must remain distinguishable
+        assert ref.o == string_lit.o
+
     def test_streaming_shape_one_line_per_triple(self):
         line = triple_to_nquad(
             {"s": iri("http://example.com/s"), "p": iri("http://example.com/p"),
```

**File**: `tests/unit/test_cli/test_workspace_bundle_commands.py` (modified, +2/-1)
```diff
@@ -324,7 +324,8 @@ def test_roundtrip_imports_triples_and_documents(self, knowledge_bundle):
         assert call.args[0] == "default"  # flow id
         triples = sorted(list(call.args[1]), key=lambda t: t.p)
         assert triples == [
-            Triple(s="http://ex.com/s", p="http://ex.com/count", o="42"),
+            Triple(s="http://ex.com/s", p="http://ex.com/count", o="42",
+                   o_datatype="http://www.w3.org/2001/XMLSchema#integer"),
             Triple(s="http://ex.com/s", p="http://ex.com/p",
                    o="http://ex.com/o"),
         ]
```

**File**: `trustgraph-cli/trustgraph/cli/nquads.py` (modified, +19/-6)
```diff
@@ -135,11 +135,20 @@ def serialize_nquads(batches, graph_iri, out):
     return written, skipped
 
 
+def _term_to_triple_field(term):
+    """Convert an rdflib term to (str_value, datatype, language)."""
+    if isinstance(term, rdflib.Literal):
+        dt = str(term.datatype) if term.datatype else ""
+        lang = str(term.language) if term.language else ""
+        return str(term), dt, lang
+    return str(term), "", ""
+
+
 def parse_nquads(data):
     """Parse N-Quads bytes back into api Triple values.
 
-    Terms are stringified with str(), the same convention tg-load-knowledge
-    uses, so values survive the store round trip unchanged. The whole
+    Preserves datatype, language tag and IRI-vs-literal distinctions
+    via the Triple.o_datatype and Triple.o_language fields. The whole
     member is materialized in memory (bundles are bounded by
     --triples-limit at export); line-streaming is a possible follow-up.
 
@@ -148,7 +157,11 @@ def parse_nquads(data):
     """
     ds = rdflib.Dataset()
     ds.parse(data=data.decode("utf-8"), format="nquads")
-    return [
-        Triple(s=str(s), p=str(p), o=str(o))
-        for s, p, o, _g in ds.quads((None, None, None, None))
-    ]
+    result = []
+    for s, p, o, _g in ds.quads((None, None, None, None)):
+        o_val, o_dt, o_lang = _term_to_triple_field(o)
+        result.append(Triple(
+            s=str(s), p=str(p), o=o_val,
+            o_datatype=o_dt, o_language=o_lang,
+        ))
+    return result
```

---

### Incident Patch 11: `7971afcc` (2026-09-03)
**Commit Message**: fix: align requires-python with MCP SDK dependency (#1106) (#1110)

The MCP SDK requires Python >=3.10. All packages declared >=3.8,
making the metadata unsatisfiable on Python 3.8/3.9. Bump all 11
packages to >=3.10 for consistency.

**File**: `trustgraph-base/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "pulsar-client",
     "prometheus-client",
```

**File**: `trustgraph-bedrock/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "pulsar-client",
```

**File**: `trustgraph-cli/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "requests",
```

**File**: `trustgraph-docling/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph document decoder powered by Docling — lightweight alternative to the unstructured-based decoder."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "pulsar-client",
```

**File**: `trustgraph-embeddings-hf/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "HuggingFace embeddings support for TrustGraph."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "trustgraph-flow>=2.9,<2.10",
```

**File**: `trustgraph-flow/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "aiohttp",
```

**File**: `trustgraph-mcp/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "mcp",
     "websockets",
```

**File**: `trustgraph-ocr/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "pulsar-client",
```

---

### Incident Patch 12: `a55bff0a` (2026-09-03)
**Commit Message**: fix(mcp): support streamable HTTP client contracts (#1105)

**File**: `tests/unit/test_agent/test_mcp_tool_transport_compat.py` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+"""MCP transport contract tests for the outbound tool service."""
+
+import pytest
+from pydantic import BaseModel
+
+from trustgraph.agent.mcp_tool import service as mcp_tool_service
+
+try:
+    from mcp.server import MCPServer
+except ImportError:
+    from mcp.server.fastmcp import FastMCP
+
+    MCPServer = None
+
+
+class EchoResult(BaseModel):
+    echo: str
+
+
+class HeaderCapture:
+    """ASGI wrapper that records the HTTP headers seen by the MCP server."""
+
+    def __init__(self, app):
+        self.app = app
+        self.requests = []
+
+    async def __call__(self, scope, receive, send):
+        if scope["type"] == "http":
+            self.requests.append({
+                name.decode("latin-1").lower(): value.decode("latin-1")
+                for name, value in scope["headers"]
+            })
+        await self.app(scope, receive, send)
+
+
+def create_test_server():
+    """Create the native server for the installed MCP major version."""
+    if MCPServer is not None:
+        server = MCPServer("test-mcp-server")
+
+        def app_factory():
+            return server.streamable_http_app(
+                json_response=True,
+                stateless_http=True,
+                host="testserver",
+            )
+    else:
+        server = FastMCP(
+            "test-mcp-server",
+            json_response=True,
+            stateless_http=True,
+            host="testserver",
+        )
+        app_factory = server.streamable_http_app
+
+    return server, app_factory
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ("auth_token", "expected_authorization"),
+    [
+        ("test-token", "Bearer test-token"),
+        ("", None),
+        (None, None),
+    ],
+)
+async def test_invoke_tool_uses_supported_streamable_http_contract(
+        monkeypatch,
+        auth_token,
+        expected_authorization,
+):
+    """Exercise the real MCP transport and session over an in-process server."""
+    server, app_factory = create_test_server()
+
+    @server.tool()
+    def echo(value: str) -> EchoResult:
+        return EchoResult(echo=value)
+
+    app = app_factory()
+    captured_app = HeaderCapture(app)
+
+    http_module = (
+        mcp_tool_service.create_mcp_http_client.__globals__.get("httpx2")
+        or mcp_tool_service.create_mcp_http_client.__globals__["httpx"]
+    )
+    real_async_client = http_module.AsyncClient
+    client_options = []
+
+    def create_in_process_client(*args, **kwargs):
+        client_options.append(kwargs.copy())
+        kwargs["transport"] = http_module.ASGITransport(app=captured_app)
+        kwargs["base_url"] = "http://testserver"
+        return real_async_client(*args, **kwargs)
+
+    monkeypatch.setattr(
+        http_module,
+        "AsyncClient",
+        create_in_process_client,
+    )
+
+    tool_config = {
+        "url": "http://testserver/mcp",
+        "remote-name": "echo",
+    }
+    if auth_token is not None:
+        tool_config["auth-token"] = auth_token
+
+    service = object.__new__(mcp_tool_service.Service)
+    service.mcp_services = {
+        "test-workspace": {"local-echo": tool_config},
+    }
+
+    async with app.router.lifespan_context(app):
+        result = await service.invoke_tool(
+            "test-workspace",
+            "local-echo",
+            {"value": "hello"},
+        )
+
+    assert result == {"echo": "hello"} or (
+        isinstance(result, str) and "hello" in result
+    )
+    assert len(client_options) == 1
+    assert client_options[0]["follow_redirects"] is True
+    assert isinstance(client_options[0]["timeout"], http_module.Timeout)
+    assert captured_app.requests
+
+    for headers in captured_app.requests:
+        assert headers.get("authorization") == expected_authorization
```

**File**: `trustgraph-flow/pyproject.toml` (modified, +2/-2)
```diff
@@ -26,7 +26,7 @@ dependencies = [
     "langchain-community",
     "langchain-core",
     "langchain-text-splitters",
-    "mcp",
+    "mcp>=1.8,<3",
     "minio",
     "mistralai<2.0.0",
     "neo4j",
@@ -137,4 +137,4 @@ joke-service = "trustgraph.tool_service.joke:run"
 include = ["trustgraph*"]
 
 [tool.setuptools.dynamic]
-version = {attr = "trustgraph.flow_version.__version__"}
\ No newline at end of file
+version = {attr = "trustgraph.flow_version.__version__"}
```

**File**: `trustgraph-flow/trustgraph/agent/mcp_tool/service.py` (modified, +59/-16)
```diff
@@ -6,16 +6,46 @@
 
 import json
 import logging
-from mcp.client.streamable_http import streamable_http_client
+from contextlib import asynccontextmanager
+
 from mcp import ClientSession
+from mcp.shared._httpx_utils import create_mcp_http_client
 
 from ... base import ToolService
 
+try:
+    from mcp.client.streamable_http import streamable_http_client
+    _MCP_USES_CALLER_HTTP_CLIENT = True
+except ImportError:
+    from mcp.client.streamable_http import (
+        streamablehttp_client as streamable_http_client,
+    )
+    _MCP_USES_CALLER_HTTP_CLIENT = False
+
 # Module logger
 logger = logging.getLogger(__name__)
 
 default_ident = "mcp-tool"
 
+
+@asynccontextmanager
+async def connect_streamable_http(url, headers):
+    """Yield the read/write streams across MCP's two HTTP client APIs."""
+    if _MCP_USES_CALLER_HTTP_CLIENT:
+        async with create_mcp_http_client(headers=headers) as http_client:
+            async with streamable_http_client(
+                url,
+                http_client=http_client,
+            ) as streams:
+                yield streams[:2]
+    else:
+        async with streamable_http_client(
+            url,
+            headers=headers,
+        ) as streams:
+            yield streams[:2]
+
+
 class Service(ToolService):
 
     def __init__(self, **params):
@@ -68,21 +98,22 @@ async def invoke_tool(self, workspace, name, parameters):
 
             # Build headers with optional bearer token
             headers = {}
-            if "auth-token" in ws_services[name]:
-                token = ws_services[name]["auth-token"]
+            token = ws_services[name].get("auth-token")
+            if token:
                 headers["Authorization"] = f"Bearer {token}"
 
             logger.info(f"Invoking {remote_name} at {url}")
 
-            # Connect to a streamable HTTP server with headers
-            async with streamable_http_client(url, headers=headers) as (
-                    read_stream,
-                    write_stream,
-                    _,
-            ):
+            async with connect_streamable_http(
+                url,
+                headers,
+            ) as (read_stream, write_stream):
 
                 # Create a session using the client streams
-                async with ClientSession(read_stream, write_stream) as session:
+                async with ClientSession(
+                    read_stream,
+                    write_stream,
+                ) as session:
 
                     # Initialize the connection
                     await session.initialize()
@@ -93,13 +124,25 @@ async def invoke_tool(self, workspace, name, parameters):
                         parameters
                     )
 
-                    if result.structured_content:
-                        return result.structured_content
+                    structured_content = getattr(
+                        result,
+                        "structured_content",
+                        None,
+                    )
+                    if structured_content is None:
+                        structured_content = getattr(
+                            result,
+                            "structuredContent",
+                            None,
+                        )
+
+                    if structured_content:
+                        return structured_content
                     elif hasattr(result, "content"):
-                            return "".join([
-                                x.text
-                                for x in result.content
-                            ])
+                        return "".join([
+                            x.text
+                            for x in result.content
+                        ])
                     else:
                         return "No content"
 
```

---

### Incident Patch 13: `73790551` (2026-09-03)
**Commit Message**: fix(cli): validate language tags before emitting them (#1107)

encode_term interpolated the wire term's "l" field straight into
'"{value}"@{language}' while every other term in nquads.py is checked
first. A tag outside the LANGTAG production - a space, an underscore, a
newline, a '>' - produced a line rdflib's N-Quads parser rejects, and
serialize_nquads still reported it as written with skipped=0. Since
parse_nquads feeds the whole bundle member to rdflib at once, one bad
tag made the entire member unimportable.

graph_to_turtle.term_to_rdflib has the same hole with the opposite
symptom: rdflib.term.Literal(value, lang=...) raises instead of
returning None, and show_graph only serializes after the stream is
consumed, so tg-graph-to-turtle aborted with a traceback and wrote
nothing at all.

Adds valid_language_tag() next to _encode_iri, matching what rdflib
itself enforces, and skips unusable tags in both exporters - the
"return None to skip" convention both files already follow, counted by
the skipped total serialize_nquads reports.

**File**: `tests/unit/test_cli/test_graph_to_turtle.py` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+"""
+Term-conversion tests for the Turtle dumper: term_to_rdflib follows the same
+"return None to skip" contract as the N-Quads encoder, and show_graph only
+serializes once the whole stream has been consumed, so a term that raises
+instead of returning None loses the entire dump.
+"""
+
+import rdflib
+
+from trustgraph.cli.graph_to_turtle import term_to_rdflib
+
+from tests.unit.test_cli.conftest import iri, lit
+
+
+class TestTermToRdflib:
+
+    def test_iri_and_literal_flavours_convert(self):
+        assert term_to_rdflib(iri("http://example.com/s")) == \
+            rdflib.term.URIRef("http://example.com/s")
+        assert term_to_rdflib(lit("plain value")) == rdflib.term.Literal("plain value")
+        assert term_to_rdflib(lit("bonjour", lang="fr")) == \
+            rdflib.term.Literal("bonjour", lang="fr")
+        assert term_to_rdflib(lit("bonjour", lang="fr-CA")) == \
+            rdflib.term.Literal("bonjour", lang="fr-CA")
+
+    def test_malformed_iri_is_skipped(self):
+        assert term_to_rdflib(iri("http://example.com/bad iri")) is None
+
+    def test_unusable_language_tag_is_skipped_not_raised(self):
+        for bad in ["fr CA", "en_US", "en\n", 'en> "x" <urn:evil', 7]:
+            assert term_to_rdflib(lit("bonjour", lang=bad)) is None, \
+                f"tag {bad!r} was not skipped"
```

**File**: `tests/unit/test_cli/test_nquads.py` (modified, +35/-31)
```diff
@@ -78,45 +78,49 @@ def test_malformed_and_unrepresentable_terms_are_skipped_not_emitted(self):
             # literal in predicate position: invalid RDF
             {"s": iri("http://example.com/s"), "p": lit("not-a-predicate"),
              "o": lit("x")},
+            # language tag outside the LANGTAG production: emitting it raw
+            # would break the line and make the whole member unparseable
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/label"),
+             "o": lit("bonjour", lang="fr CA")},
             # one good triple to prove the stream continues past skips
             {"s": iri("http://example.com/s"), "p": iri("http://example.com/p"),
              "o": lit("good")},
         ]]
         ds, written, skipped = roundtrip(batches)
 
-        assert (written, skipped) == (1, 3)
+        assert (written, skipped) == (1, 4)
         assert len(list(ds.quads((None, None, None, None)))) == 1
 
-    def test_newline_in_language_tag_is_rejected(self):
-        """GHSA-2jrc-mr3c-ch6g: language tag injection via newline."""
-        injected_tag = (
-            'en <http://example.org/g> .\n'
-            '<http://example.org/injected> <http://example.org/is> '
-            '<http://example.org/real>'
-        )
-        batches = [[{
-            "s": iri("http://example.com/s"),
-            "p": iri("http://example.com/p"),
-            "o": lit("x", lang=injected_tag),
-        }]]
-        ds, written, skipped = roundtrip(batches)
-
-        assert written == 0
-        assert skipped == 1
-        assert len(list(ds.quads((None, None, None, None)))) == 0
-
-    def test_malformed_language_tags_are_rejected(self):
-        invalid_tags = ["en_US", "123", "en US", "en\ttab", "en<x>"]
-        for tag in invalid_tags:
-            result = encode_term(lit("value", lang=tag), is_object=True)
-            assert result is None, f"expected rejection for tag {tag!r}"
-
-    def test_valid_language_tags_are_accepted(self):
-        valid_tags = ["en", "fr", "en-US", "zh-Hant-TW", "x-custom"]
-        for tag in valid_tags:
-            result = encode_term(lit("value", lang=tag), is_object=True)
-            assert result is not None, f"expected acceptance for tag {tag!r}"
-            assert f"@{tag}" in result
+    def test_unusable_language_tags_are_skipped_not_emitted(self):
+        """One bad tag must not cost the whole member.
+
+        parse_nquads hands the entire member to rdflib at once, and its
+        N-Quads parser aborts on the first malformed line, so a tag emitted
+        raw takes every other triple in the bundle down with it.
+        """
+        good = {"s": iri("http://example.com/s"), "p": iri("http://example.com/p"),
+                "o": lit("good")}
+
+        for bad in ["fr CA", "en_US", "en\n", 'en> "x" <urn:evil', 7]:
+            batches = [[
+                {"s": iri("http://example.com/s"),
+                 "p": iri("http://example.com/label"),
+                 "o": lit("bonjour", lang=bad)},
+                good,
+            ]]
+            ds, written, skipped = roundtrip(batches)
+            assert (written, skipped) == (1, 1), f"tag {bad!r} was not skipped"
+            assert len(list(ds.quads((None, None, None, None)))) == 1
+
+        # subtags are part of the production and must still survive
+        for ok in ["fr", "fr-CA", "de-DE-1996"]:
+            batches = [[{"s": iri("http://example.com/s"),
+                         "p": iri("http://example.com/label"),
+                         "o": lit("bonjour", lang=ok)}]]
+            ds, written, skipped = roundtrip(batches)
+            assert (written, skipped) == (1, 0), f"tag {ok!r} was wrongly skipped"
+            obj = next(iter(ds.quads((None, None, None, None))))[2]
+            assert obj == rdflib.Literal("bonjour", lang=ok)
 
     def test_streaming_shape_one_line_per_triple(self):
         line = triple_to_nquad(
```

**File**: `trustgraph-cli/trustgraph/cli/graph_to_turtle.py` (modified, +7/-0)
```diff
@@ -12,6 +12,8 @@
 
 from trustgraph.api import Api
 
+from . nquads import valid_language_tag
+
 default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
 default_collection = 'default'
 default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
@@ -36,6 +38,11 @@ def term_to_rdflib(term):
         datatype = term.get("d")
         language = term.get("l")
         if language:
+            # Skip malformed tags: Literal(lang=...) raises on them, and
+            # the graph is only serialized once the whole stream has been
+            # consumed, so an escaping exception loses the entire dump.
+            if not valid_language_tag(language):
+                return None
             return rdflib.term.Literal(value, lang=language)
         elif datatype:
             return rdflib.term.Literal(value, datatype=rdflib.term.URIRef(datatype))
```

**File**: `trustgraph-cli/trustgraph/cli/nquads.py` (modified, +15/-3)
```diff
@@ -32,8 +32,20 @@
 # for large exports (it runs per term).
 _BAD_IRI = re.compile(r'[\x00-\x20<>"{}|^\x60\\]')
 
-# BCP47 / LANGTAG: [a-zA-Z]+ ('-' [a-zA-Z0-9]+)*
-_LANGTAG = re.compile(r'^[a-zA-Z]+(-[a-zA-Z0-9]+)*$')
+# The body of the LANGTAG production, [a-zA-Z]+ ('-' [a-zA-Z0-9]+)*, which
+# Turtle shares and which is the shape rdflib's Literal(lang=...) accepts.
+# fullmatch, not a trailing $: $ also matches before a trailing newline, so
+# "en\n" would pass and split the quad across two lines.
+_LANGTAG = re.compile(r"[a-zA-Z]+(?:-[a-zA-Z0-9]+)*")
+
+
+def valid_language_tag(language):
+    """True when language can be emitted after the '@' of a LANGTAG.
+
+    The wire schema types the language field as a free-form str, so an
+    unusable tag arrives here as data, not as a bug.
+    """
+    return isinstance(language, str) and _LANGTAG.fullmatch(language) is not None
 
 
 def _escape_literal(value):
@@ -70,7 +82,7 @@ def encode_term(term, is_object=False):
         language = term.get("l")
         datatype = term.get("d")
         if language:
-            if not _LANGTAG.match(language):
+            if not valid_language_tag(language):
                 return None
             return f'"{value}"@{language}'
         if datatype:
```

---

### Incident Patch 14: `f8477187` (2026-09-03)
**Commit Message**: fix(cli): validate language tags before emitting them (#1107)

encode_term interpolated the wire term's "l" field straight into
'"{value}"@{language}' while every other term in nquads.py is checked
first. A tag outside the LANGTAG production - a space, an underscore, a
newline, a '>' - produced a line rdflib's N-Quads parser rejects, and
serialize_nquads still reported it as written with skipped=0. Since
parse_nquads feeds the whole bundle member to rdflib at once, one bad
tag made the entire member unimportable.

graph_to_turtle.term_to_rdflib has the same hole with the opposite
symptom: rdflib.term.Literal(value, lang=...) raises instead of
returning None, and show_graph only serializes after the stream is
consumed, so tg-graph-to-turtle aborted with a traceback and wrote
nothing at all.

Adds valid_language_tag() next to _encode_iri, matching what rdflib
itself enforces, and skips unusable tags in both exporters - the
"return None to skip" convention both files already follow, counted by
the skipped total serialize_nquads reports.

**File**: `tests/unit/test_cli/test_graph_to_turtle.py` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+"""
+Term-conversion tests for the Turtle dumper: term_to_rdflib follows the same
+"return None to skip" contract as the N-Quads encoder, and show_graph only
+serializes once the whole stream has been consumed, so a term that raises
+instead of returning None loses the entire dump.
+"""
+
+import rdflib
+
+from trustgraph.cli.graph_to_turtle import term_to_rdflib
+
+from tests.unit.test_cli.conftest import iri, lit
+
+
+class TestTermToRdflib:
+
+    def test_iri_and_literal_flavours_convert(self):
+        assert term_to_rdflib(iri("http://example.com/s")) == \
+            rdflib.term.URIRef("http://example.com/s")
+        assert term_to_rdflib(lit("plain value")) == rdflib.term.Literal("plain value")
+        assert term_to_rdflib(lit("bonjour", lang="fr")) == \
+            rdflib.term.Literal("bonjour", lang="fr")
+        assert term_to_rdflib(lit("bonjour", lang="fr-CA")) == \
+            rdflib.term.Literal("bonjour", lang="fr-CA")
+
+    def test_malformed_iri_is_skipped(self):
+        assert term_to_rdflib(iri("http://example.com/bad iri")) is None
+
+    def test_unusable_language_tag_is_skipped_not_raised(self):
+        for bad in ["fr CA", "en_US", "en\n", 'en> "x" <urn:evil', 7]:
+            assert term_to_rdflib(lit("bonjour", lang=bad)) is None, \
+                f"tag {bad!r} was not skipped"
```

**File**: `tests/unit/test_cli/test_nquads.py` (modified, +36/-1)
```diff
@@ -78,15 +78,50 @@ def test_malformed_and_unrepresentable_terms_are_skipped_not_emitted(self):
             # literal in predicate position: invalid RDF
             {"s": iri("http://example.com/s"), "p": lit("not-a-predicate"),
              "o": lit("x")},
+            # language tag outside the LANGTAG production: emitting it raw
+            # would break the line and make the whole member unparseable
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/label"),
+             "o": lit("bonjour", lang="fr CA")},
             # one good triple to prove the stream continues past skips
             {"s": iri("http://example.com/s"), "p": iri("http://example.com/p"),
              "o": lit("good")},
         ]]
         ds, written, skipped = roundtrip(batches)
 
-        assert (written, skipped) == (1, 3)
+        assert (written, skipped) == (1, 4)
         assert len(list(ds.quads((None, None, None, None)))) == 1
 
+    def test_unusable_language_tags_are_skipped_not_emitted(self):
+        """One bad tag must not cost the whole member.
+
+        parse_nquads hands the entire member to rdflib at once, and its
+        N-Quads parser aborts on the first malformed line, so a tag emitted
+        raw takes every other triple in the bundle down with it.
+        """
+        good = {"s": iri("http://example.com/s"), "p": iri("http://example.com/p"),
+                "o": lit("good")}
+
+        for bad in ["fr CA", "en_US", "en\n", 'en> "x" <urn:evil', 7]:
+            batches = [[
+                {"s": iri("http://example.com/s"),
+                 "p": iri("http://example.com/label"),
+                 "o": lit("bonjour", lang=bad)},
+                good,
+            ]]
+            ds, written, skipped = roundtrip(batches)
+            assert (written, skipped) == (1, 1), f"tag {bad!r} was not skipped"
+            assert len(list(ds.quads((None, None, None, None)))) == 1
+
+        # subtags are part of the production and must still survive
+        for ok in ["fr", "fr-CA", "de-DE-1996"]:
+            batches = [[{"s": iri("http://example.com/s"),
+                         "p": iri("http://example.com/label"),
+                         "o": lit("bonjour", lang=ok)}]]
+            ds, written, skipped = roundtrip(batches)
+            assert (written, skipped) == (1, 0), f"tag {ok!r} was wrongly skipped"
+            obj = next(iter(ds.quads((None, None, None, None))))[2]
+            assert obj == rdflib.Literal("bonjour", lang=ok)
+
     def test_streaming_shape_one_line_per_triple(self):
         line = triple_to_nquad(
             {"s": iri("http://example.com/s"), "p": iri("http://example.com/p"),
```

**File**: `trustgraph-cli/trustgraph/cli/graph_to_turtle.py` (modified, +7/-0)
```diff
@@ -12,6 +12,8 @@
 
 from trustgraph.api import Api
 
+from . nquads import valid_language_tag
+
 default_url = os.getenv("TRUSTGRAPH_URL", 'http://localhost:8888/')
 default_collection = 'default'
 default_token = os.getenv("TRUSTGRAPH_TOKEN", None)
@@ -36,6 +38,11 @@ def term_to_rdflib(term):
         datatype = term.get("d")
         language = term.get("l")
         if language:
+            # Skip malformed tags: Literal(lang=...) raises on them, and
+            # the graph is only serialized once the whole stream has been
+            # consumed, so an escaping exception loses the entire dump.
+            if not valid_language_tag(language):
+                return None
             return rdflib.term.Literal(value, lang=language)
         elif datatype:
             return rdflib.term.Literal(value, datatype=rdflib.term.URIRef(datatype))
```

**File**: `trustgraph-cli/trustgraph/cli/nquads.py` (modified, +17/-0)
```diff
@@ -32,6 +32,21 @@
 # for large exports (it runs per term).
 _BAD_IRI = re.compile(r'[\x00-\x20<>"{}|^\x60]')
 
+# The body of the LANGTAG production, [a-zA-Z]+ ('-' [a-zA-Z0-9]+)*, which
+# Turtle shares and which is the shape rdflib's Literal(lang=...) accepts.
+# fullmatch, not a trailing $: $ also matches before a trailing newline, so
+# "en\n" would pass and split the quad across two lines.
+_LANGTAG = re.compile(r"[a-zA-Z]+(?:-[a-zA-Z0-9]+)*")
+
+
+def valid_language_tag(language):
+    """True when language can be emitted after the '@' of a LANGTAG.
+
+    The wire schema types the language field as a free-form str, so an
+    unusable tag arrives here as data, not as a bug.
+    """
+    return isinstance(language, str) and _LANGTAG.fullmatch(language) is not None
+
 
 def _escape_literal(value):
     for raw, esc in _ESCAPES:
@@ -67,6 +82,8 @@ def encode_term(term, is_object=False):
         language = term.get("l")
         datatype = term.get("d")
         if language:
+            if not valid_language_tag(language):
+                return None
             return f'"{value}"@{language}'
         if datatype:
             dt = _encode_iri(datatype)
```

---

### Incident Patch 15: `55c1658e` (2026-09-03)
**Commit Message**: feat: make prompt and librarian client timeouts configurable (#1108)

Second slice of #874. A spec that creates a client resolves its timeout
as: explicit constructor value, else the processor attribute the spec
names, else the class default (TimeoutSpec mixin). RequestResponseSpec
and LibrarianSpec thread the result into the client they create.
PromptClient and AsyncLibrarianClient methods default to None and fall
back to it, per-call timeouts still override. --prompt-timeout (600)
on FlowProcessor. --librarian-timeout (120) via
WorkspaceProcessor.add_librarian_args, called by FlowProcessor and the
cores service, which also passes it to its direct AsyncLibrarianClient.

1 default moves: a bare prompt-request wrapper call with no timeout
goes from the generic wrapper's 300 to the prompt default 600 (4
in-tree sites in nlp_query and structured_diag). ConfigClientSpec now
follows --config-timeout with the same 60 it resolved to before.

**File**: `tests/unit/test_base/test_client_timeouts.py` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+"""
+Prompt and librarian client timeouts (#874 slice 2): a spec resolves its
+timeout from an explicit constructor value, then the processor's CLI
+attribute, then the class default, and threads it into the client it creates.
+"""
+
+import argparse
+import asyncio
+from types import SimpleNamespace
+
+import pytest
+from unittest.mock import AsyncMock, MagicMock, patch
+
+from trustgraph.base.request_response_spec import (
+    RequestResponseSpec, _make_impl_wrapper,
+)
+from trustgraph.base.prompt_client import PromptClientSpec, PromptClient
+from trustgraph.base.config_client import ConfigClientSpec
+from trustgraph.base.librarian_spec import LibrarianSpec
+from trustgraph.base.async_librarian_client import AsyncLibrarianClient
+from trustgraph.base.request_response_client import RequestResponseClient
+from trustgraph.schema import LibrarianRequest, PromptResponse
+
+
+REAL_WAIT_FOR = asyncio.wait_for
+
+RR_CREATE = "trustgraph.base.request_response_client.RequestResponseClient.create"
+LIB_CREATE = "trustgraph.base.async_librarian_client.AsyncLibrarianClient.create"
+
+TOPICS = {
+    "topics": {
+        "prompt-request": "q:prompt:req",
+        "prompt-response": "q:prompt:resp",
+        "config-request": "q:config:req",
+        "config-response": "q:config:resp",
+        "librarian-request": "q:lib:req",
+        "librarian-response": "q:lib:resp",
+    }
+}
+
+
+def make_processor(**attrs):
+    # SimpleNamespace, not MagicMock: a missing attribute must be missing.
+    return SimpleNamespace(async_backend=AsyncMock(), id="proc1", **attrs)
+
+
+def make_flow():
+    flow = MagicMock()
+    flow.workspace = "ws"
+    flow.name = "f"
+    flow.consumer = {}
+    return flow
+
+
+def generic_spec(**kwargs):
+    return RequestResponseSpec(
+        request_name="prompt-request",
+        request_schema=object,
+        response_name="prompt-response",
+        response_schema=object,
+        impl=None,
+        **kwargs,
+    )
+
+
+def prompt_spec(**kwargs):
+    return PromptClientSpec(
+        request_name="prompt-request", response_name="prompt-response", **kwargs,
+    )
+
+
+def config_spec(**kwargs):
+    return ConfigClientSpec(
+        request_name="config-request", response_name="config-response", **kwargs,
+    )
+
+
+class TestResolveTimeout:
+
+    def test_generic_default_matches_previous_wrapper_literal(self):
+        assert generic_spec().resolve_timeout(make_processor()) == 300
+
+    def test_base_spec_ignores_processor_attributes(self):
+        proc = make_processor(prompt_timeout=45, librarian_timeout=30)
+        assert generic_spec().resolve_timeout(proc) == 300
+
+    @pytest.mark.parametrize("make, attr, default", [
+        (prompt_spec, "prompt_timeout", 600),
+        (config_spec, "config_timeout", 60),
+        (LibrarianSpec, "librarian_timeout", 120),
+    ])
+    def test_class_default_then_processor_then_explicit(self, make, attr, default):
+        assert make().resolve_timeout(make_processor()) == default
+        assert make().resolve_timeout(make_processor(**{attr: 45})) == 45
+        assert make(timeout=9).resolve_timeout(make_processor(**{attr: 45})) == 9
+
+    @pytest.mark.asyncio
+    @pytest.mark.parametrize("make, attrs, target, expected", [
+        (lambda: generic_spec(timeout=42), {}, RR_CREATE, 42),
+        (prompt_spec, {"prompt_timeout": 45}, RR_CREATE, 45),
+        (LibrarianSpec, {"librarian_timeout": 30}, LIB_CREATE, 30),
+    ])
+    async def test_register_threads_timeout_into_client(
+            self, make, attrs, target, expected):
+        create = AsyncMock(return_value=MagicMock())
+        with patch(target, new=create):
+            await make().register(make_flow(), make_processor(**attrs), TOPICS)
+        assert create.call_args.kwargs["default_timeout"] == expected
+
+
+class TestImplWrapperTimeout:
+
+    @pytest.mark.asyncio
+    @pytest.mark.parametrize("kwargs, forwarded", [({}, None), ({"timeout": 7}, 7)])
+    async def test_request_forwards_timeout(self, kwargs, forwarded):
+        rr = MagicMock()
+        rr.request = AsyncMock(return_value="ok")
+        wrapper = _make_impl_wrapper(rr, None)
+
+        assert await wrapper.request("req", **kwargs) == "ok"
+        assert rr.request.call_args.kwargs["timeout"] == forwarded
+
+
+class TestRegisteredPromptWrapper:
+
+    @pytest.mark.asyncio
+    async def test_bare_request_reaches_client_with_prompt_default(self):
+        # A real RequestResponseClient (no pub/sub), so the number that
+        # reaches wait_for is the effective default, not a forwarded None.
+        async def create(**kwargs):
+            client = RequestResponseClient(
+                default_timeout=kwargs["default_timeout"],
+            )
+            client.producer = AsyncMock()
+            return client
+
+        wait_for = AsyncMock(return_value="resp")
+        with patch(RR_CREATE, new=create), patch(
+            "trustgraph.base.request_response_client.async
```

**File**: `trustgraph-base/trustgraph/base/async_librarian_client.py` (modified, +18/-10)
```diff
@@ -15,10 +15,13 @@
 
 logger = logging.getLogger(__name__)
 
+default_librarian_timeout = 120
+
 
 class AsyncLibrarianClient:
 
-    def __init__(self):
+    def __init__(self, default_timeout=default_librarian_timeout):
+        self.default_timeout = default_timeout
         self._producer = None
         self._consumer = None
         self._receiver_task = None
@@ -29,9 +32,9 @@ def __init__(self):
     @classmethod
     async def create(
         cls, backend, request_topic, response_topic,
-        subscription=None,
+        subscription=None, default_timeout=default_librarian_timeout,
     ):
-        client = cls()
+        client = cls(default_timeout=default_timeout)
 
         client._producer = await backend.create_producer(
             topic=request_topic,
@@ -63,6 +66,9 @@ async def create(
     async def start(self):
         pass
 
+    def _timeout(self, timeout):
+        return self.default_timeout if timeout is None else timeout
+
     async def _response_loop(self):
         try:
             while self.running:
@@ -87,7 +93,8 @@ async def _response_loop(self):
                 f"Librarian response loop error: {e}", exc_info=True,
             )
 
-    async def request(self, request, timeout=120):
+    async def request(self, request, timeout=None):
+        timeout = self._timeout(timeout)
         request_id = str(uuid.uuid4())
 
         future = asyncio.get_event_loop().create_future()
@@ -111,7 +118,8 @@ async def request(self, request, timeout=120):
             self._pending.pop(request_id, None)
             raise RuntimeError("Timeout waiting for librarian response")
 
-    async def stream(self, request, timeout=120):
+    async def stream(self, request, timeout=None):
+        timeout = self._timeout(timeout)
         request_id = str(uuid.uuid4())
 
         q = asyncio.Queue()
@@ -180,7 +188,7 @@ async def stop(self):
 
         logger.info("AsyncLibrarianClient closed")
 
-    async def fetch_document_content(self, document_id, timeout=120):
+    async def fetch_document_content(self, document_id, timeout=None):
         req = LibrarianRequest(
             operation="stream-document",
             document_id=document_id,
@@ -199,13 +207,13 @@ async def fetch_document_content(self, document_id, timeout=120):
 
         return base64.b64encode(raw)
 
-    async def fetch_document_text(self, document_id, timeout=120):
+    async def fetch_document_text(self, document_id, timeout=None):
         content = await self.fetch_document_content(
             document_id, timeout=timeout,
         )
         return base64.b64decode(content).decode("utf-8")
 
-    async def fetch_document_metadata(self, document_id, timeout=120):
+    async def fetch_document_metadata(self, document_id, timeout=None):
         req = LibrarianRequest(
             operation="get-document-metadata",
             document_id=document_id,
@@ -215,7 +223,7 @@ async def fetch_document_metadata(self, document_id, timeout=120):
 
     async def save_child_document(self, doc_id, parent_id, content,
                                   document_type="chunk", title=None,
-                                  kind="text/plain", timeout=120):
+                                  kind="text/plain", timeout=None):
         if isinstance(content, str):
             content = content.encode("utf-8")
 
@@ -238,7 +246,7 @@ async def save_child_document(self, doc_id, parent_id, content,
 
     async def save_document(self, doc_id, content, title=None,
                             document_type="answer", kind="text/plain",
-                            timeout=120):
+                            timeout=None):
         if isinstance(content, str):
             content = content.encode("utf-8")
 
```

**File**: `trustgraph-base/trustgraph/base/config_client.py` (modified, +7/-1)
```diff
@@ -1,5 +1,6 @@
 
 from . request_response_spec import RequestResponseSpec
+from . async_processor import default_config_timeout
 from .. schema import ConfigRequest, ConfigResponse, ConfigKey, ConfigValue
 
 CONFIG_TIMEOUT = 10
@@ -108,13 +109,18 @@ async def workspaces_for_type(self, type, timeout=None):
 
 
 class ConfigClientSpec(RequestResponseSpec):
+
+    timeout_param = "config_timeout"
+    default_timeout = default_config_timeout
+
     def __init__(
-            self, request_name, response_name,
+            self, request_name, response_name, timeout=None,
     ):
         super(ConfigClientSpec, self).__init__(
             request_name=request_name,
             request_schema=ConfigRequest,
             response_name=response_name,
             response_schema=ConfigResponse,
             impl=ConfigClient,
+            timeout=timeout,
         )
```

**File**: `trustgraph-base/trustgraph/base/flow_processor.py` (modified, +14/-0)
```diff
@@ -16,6 +16,7 @@
 from .. log_level import LogLevel
 from . workspace_processor import WorkspaceProcessor
 from . flow import Flow
+from . prompt_client import default_prompt_timeout
 
 # Module logger
 logger = logging.getLogger(__name__)
@@ -29,6 +30,10 @@ def __init__(self, **params):
         # Initialise base class
         super(FlowProcessor, self).__init__(**params)
 
+        self.prompt_timeout = int(params.get(
+            "prompt_timeout", default_prompt_timeout
+        ))
+
         # Register configuration handler for this processor's config type
         self.register_config_handler(
             self.on_configure_flows, types=[f"processor:{self.id}"]
@@ -114,6 +119,15 @@ async def start(self):
     def add_args(parser: ArgumentParser) -> None:
 
         WorkspaceProcessor.add_args(parser)
+        WorkspaceProcessor.add_librarian_args(parser)
+
+        parser.add_argument(
+            '--prompt-timeout',
+            type=int,
+            default=default_prompt_timeout,
+            help=f'Prompt request timeout in seconds '
+                 f'(default: {default_prompt_timeout})',
+        )
 
         # parser.add_argument(
         #     '--rate-limit-retry',
```

**File**: `trustgraph-base/trustgraph/base/librarian_spec.py` (modified, +10/-5)
```diff
@@ -3,19 +3,23 @@
 import uuid
 from typing import Any
 
-from . spec import Spec
+from . spec import Spec, TimeoutSpec
+from . async_librarian_client import AsyncLibrarianClient, default_librarian_timeout
 
 
-class LibrarianSpec(Spec):
+class LibrarianSpec(TimeoutSpec, Spec):
+
+    timeout_param = "librarian_timeout"
+    default_timeout = default_librarian_timeout
+
     def __init__(self, request_name="librarian-request",
-                 response_name="librarian-response"):
+                 response_name="librarian-response", timeout=None):
         self.request_name = request_name
         self.response_name = response_name
+        self.timeout = timeout
 
     async def register(self, flow: Any, processor: Any, definition: dict[str, Any]) -> Any:
 
-        from .async_librarian_client import AsyncLibrarianClient
-
         subscription = (
             processor.id + "--" + flow.workspace + "--" +
             flow.name + "--librarian--" + str(uuid.uuid4())
@@ -26,6 +30,7 @@ async def register(self, flow: Any, processor: Any, definition: dict[str, Any])
             request_topic=definition["topics"][self.request_name],
             response_topic=definition["topics"][self.response_name],
             subscription=subscription,
+            default_timeout=self.resolve_timeout(processor),
         )
 
         flow.librarian = client
```

**File**: `trustgraph-base/trustgraph/base/prompt_client.py` (modified, +15/-8)
```diff
@@ -8,6 +8,8 @@
 from . request_response_spec import RequestResponseSpec
 from .. schema import PromptRequest, PromptResponse
 
+default_prompt_timeout = 600
+
 @dataclass
 class PromptResult:
     response_type: str              # "text", "json", or "jsonl"
@@ -20,7 +22,7 @@ class PromptResult:
 
 class PromptClient:
 
-    async def prompt(self, id, variables, timeout=600, streaming=False, chunk_callback=None):
+    async def prompt(self, id, variables, timeout=None, streaming=False, chunk_callback=None):
 
         if not streaming:
 
@@ -136,28 +138,28 @@ async def forward_chunks(resp):
                 model=last_resp.model,
             )
 
-    async def extract_definitions(self, text, timeout=600):
+    async def extract_definitions(self, text, timeout=None):
         return await self.prompt(
             id = "extract-definitions",
             variables = { "text": text },
             timeout = timeout,
         )
 
-    async def extract_relationships(self, text, timeout=600):
+    async def extract_relationships(self, text, timeout=None):
         return await self.prompt(
             id = "extract-relationships",
             variables = { "text": text },
             timeout = timeout,
         )
 
-    async def extract_objects(self, text, schema, timeout=600):
+    async def extract_objects(self, text, schema, timeout=None):
         return await self.prompt(
             id = "extract-rows",
             variables = { "text": text, "schema": schema, },
             timeout = timeout,
         )
 
-    async def document_prompt(self, query, documents, timeout=600, streaming=False, chunk_callback=None):
+    async def document_prompt(self, query, documents, timeout=None, streaming=False, chunk_callback=None):
         return await self.prompt(
             id = "document-prompt",
             variables = {
@@ -169,7 +171,7 @@ async def document_prompt(self, query, documents, timeout=600, streaming=False,
             chunk_callback = chunk_callback,
         )
 
-    async def agent_react(self, variables, timeout=600, streaming=False, chunk_callback=None):
+    async def agent_react(self, variables, timeout=None, streaming=False, chunk_callback=None):
         return await self.prompt(
             id = "agent-react",
             variables = variables,
@@ -178,7 +180,7 @@ async def agent_react(self, variables, timeout=600, streaming=False, chunk_callb
             chunk_callback = chunk_callback,
         )
 
-    async def question(self, question, timeout=600):
+    async def question(self, question, timeout=None):
         return await self.prompt(
             id = "question",
             variables = {
@@ -188,13 +190,18 @@ async def question(self, question, timeout=600):
         )
 
 class PromptClientSpec(RequestResponseSpec):
+
+    timeout_param = "prompt_timeout"
+    default_timeout = default_prompt_timeout
+
     def __init__(
-            self, request_name, response_name,
+            self, request_name, response_name, timeout=None,
     ):
         super(PromptClientSpec, self).__init__(
             request_name = request_name,
             request_schema = PromptRequest,
             response_name = response_name,
             response_schema = PromptResponse,
             impl = PromptClient,
+            timeout = timeout,
         )
```

**File**: `trustgraph-base/trustgraph/base/request_response_spec.py` (modified, +9/-4)
```diff
@@ -3,7 +3,7 @@
 import logging
 from typing import Any
 
-from . spec import Spec
+from . spec import Spec, TimeoutSpec
 
 # Module logger
 logger = logging.getLogger(__name__)
@@ -12,17 +12,21 @@
 # use another service in request/response mode.  Uses two topics:
 # - we send on the request topic as a producer
 # - we receive on the response topic as a subscriber
-class RequestResponseSpec(Spec):
+class RequestResponseSpec(TimeoutSpec, Spec):
+
+    default_timeout = 300
+
     def __init__(
             self, request_name, request_schema, response_name,
-            response_schema, impl=None, optional=False
+            response_schema, impl=None, optional=False, timeout=None,
     ):
         self.request_name = request_name
         self.request_schema = request_schema
         self.response_name = response_name
         self.response_schema = response_schema
         self.impl = impl
         self.optional = optional
+        self.timeout = timeout
 
     async def register(self, flow: Any, processor: Any, definition: dict[str, Any]) -> Any:
 
@@ -42,6 +46,7 @@ async def register(self, flow: Any, processor: Any, definition: dict[str, Any])
             response_schema=self.response_schema,
             processor_id=getattr(processor, 'id', None),
             target_service=self.request_name,
+            default_timeout=self.resolve_timeout(processor),
         )
 
         wrapper = _make_impl_wrapper(rr_client, self.impl)
@@ -59,7 +64,7 @@ class Wrapper(*bases):
         def __init__(self):
             self._rr_client = rr_client
 
-        async def request(self, req, timeout=300, recipient=None):
+        async def request(self, req, timeout=None, recipient=None):
             if recipient is None:
                 return await self._rr_client.request(req, timeout=timeout)
 
```

**File**: `trustgraph-base/trustgraph/base/spec.py` (modified, +19/-0)
```diff
@@ -7,3 +7,22 @@ async def register(self, flow, processor, definition):
 
     def add(self, flow, processor, definition):
         pass
+
+
+class TimeoutSpec:
+    # Mixin for specs that create a client. An explicit constructor value
+    # wins over the processor attribute named by timeout_param, which wins
+    # over the class default.
+    timeout_param = None
+    default_timeout = None
+    timeout = None
+
+    def resolve_timeout(self, processor):
+        # Reads a plain attribute: a Mock processor yields a Mock, not None.
+        if self.timeout is not None:
+            return self.timeout
+        if self.timeout_param is not None:
+            value = getattr(processor, self.timeout_param, None)
+            if value is not None:
+                return value
+        return self.default_timeout
```

#### Recent Merged Pull Requests:
- **PR #1156** (2026-10-05): fix: policy error propagation, response translator, and cache reuse (@cybermaggedon)
- **PR #1155** (2026-10-05): fix: add rdfs:label and rdfs:comment to ontology types and properties (@cybermaggedon)
- **PR #1154** (2026-10-05): fix: propagate user_context from SPARQL service to triples queries (@cybermaggedon)
- **PR #1153** (2026-10-05): feat: add TriG format support to tg-load-knowledge (@cybermaggedon)
- **PR #1152** (2026-10-05): fix: mint-token routing, user resolution, and WS context key (@cybermaggedon)
- **PR #1151** (2026-10-05): feat: admin-minted user context tokens (Phase 1) (@cybermaggedon)
- **PR #1150** (2026-10-05): feat: guided graph traversal for GraphRAG (@cybermaggedon)
- **PR #1149** (2026-10-02): feat: SHACL-AF CONSTRUCT rule execution, generic determinations, and enforcement mode (@cybermaggedon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
