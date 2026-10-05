# Forensic Learning Record (Deep Inspection): chroma-core/chroma

> **Canonical Artifact**: `07_PROJECT_LEARNING/chroma-core-chroma-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chroma-core/chroma](https://github.com/chroma-core/chroma))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:32:10.941Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chroma-core/chroma`
- **Description**: Search infrastructure for AI
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 29444 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `chromadb/auth/utils/__init__.py`
```
from typing import Optional, Tuple

from chromadb.auth import UserIdentity
from chromadb.config import DEFAULT_DATABASE, DEFAULT_TENANT
from chromadb.errors import ChromaAuthError


def _singleton_tenant_database_if_applicable(
    user_identity: UserIdentity,
    overwrite_singleton_tenant_database_access_from_auth: bool,
) -> Tuple[Optional[str], Optional[str]]:
    """
    If settings.chroma_overwrite_singleton_tenant_database_access_from_auth
    is False, this function always returns (None, None).

    If settings.chroma_overwrite_singleton_tenant_database_access_from_auth
    is True, follows the following logic:
    - If the user only has access to a single tenant, this function will
        return that tenant as its first return value.
    - If the user only has access to a single database, this function will
        return that database as its second return value. If the user has
        access to multiple tenants and/or databases, including "*", this
        function will return None for the corresponding value(s).
    - If the user has access to multiple tenants and/or databases this
        function will return None for the corresponding value(s).
    """
    if not overwrite_singleton_tenant_database_access_from_auth:
        return None, None
    tenant = None
    database = None
    user_tenant = user_identity.tenant
    user_databases = user_identity.databases
    if user_tenant and user_tenant != "*":
        tenant = user_tenant
    if user_databases:
        user_databases_set = set(user_databases)
        if len(user_databases_set) == 1 and "*" not in user_databases_set:
            database = list(user_databases_set)[0]
    return tenant, database


def maybe_set_tenant_and_database(
    user_identity: UserIdentity,
    overwrite_singleton_tenant_database_access_from_auth: bool,
    user_provided_tenant: Optional[str] = None,
    user_provided_database: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    (
        new_tenant,
        new_database,
    ) = _singleton_tenant_database_if_applicable(
        user_identity=user_identity,
        overwrite_singleton_tenant_database_access_from_auth=overwrite_singleton_tenant_database_access_from_auth,
    )

    # The only error case is if the user provides a tenant and database that
    # don't match what we resolved from auth. This can incorrectly happen when
    # there is no auth provider set, but overwrite_singleton_tenant_database_access_from_auth
    # is set to True. In this case, we'll resolve tenant/database to the default
    # values, which might not match the provided values. Thus, it's important
    # to ensure that the flag is set to True only when there is an auth provider.
    if (
        user_provided_tenant
        and user_provided_tenant != DEFAULT_TENANT
        and new_tenant
        and new_tenant != user_provided_tenant
    ):
        raise ChromaAuthError(f"Tenant {user_provided_tenant} does not match {new_tenant} from the server. Are you sure the tenant is correct?")
    if (
        user_provided_database
        and user_provided_database != DEFAULT_DATABASE
        and new_database
        and new_database != user_provided_database
    ):
        raise ChromaAuthError(f"Database {user_provided_database} does not match {new_database} from the server. Are you sure the database is correct?")

    if (
        not user_provided_tenant or user_provided_tenant == DEFAULT_TENANT
    ) and new_tenant:
        user_provided_tenant = new_tenant
    if (
        not user_provided_database or user_provided_database == DEFAULT_DATABASE
    ) and new_database:
        user_provided_database = new_database

    return user_provided_tenant, user_provided_database

```

### Core Architecture Module: `chromadb/cli/utils.py`
```
from typing import Any, Dict

import os
import yaml


def set_log_file_path(
    log_config_path: str, new_filename: str = "chroma.log"
) -> Dict[str, Any]:
    """This works with the standard log_config.yml file.
    It will not work with custom log configs that may use different handlers"""
    with open(f"{log_config_path}", "r") as file:
        log_config = yaml.safe_load(file)
    for handler in log_config["handlers"].values():
        if handler.get("class") == "logging.handlers.RotatingFileHandler":
            handler["filename"] = new_filename

    return log_config


def get_directory_size(directory: str) -> int:
    """Get the size of a directory in bytes"""
    total = 0
    with os.scandir(directory) as it:
        for entry in it:
            if entry.is_file():
                total += entry.stat().st_size
            elif entry.is_dir():
                total += get_directory_size(entry.path)
    return total


# https://stackoverflow.com/a/1094933
def sizeof_fmt(num: int, suffix: str = "B") -> str:
    n: float = float(num)
    for unit in ("", "Ki", "Mi", "Gi", "Ti", "Pi", "Ei", "Zi"):
        if abs(n) < 1024.0:
            return f"{n:3.1f}{unit}{suffix}"
        n /= 1024.0
    return f"{n:.1f}Yi{suffix}"

```

### Core Architecture Module: `chromadb/db/mixins/embeddings_queue.py`
```
from functools import cached_property
import json
from chromadb.api.configuration import (
    ConfigurationParameter,
    EmbeddingsQueueConfigurationInternal,
)
from chromadb.db.base import SqlDB, ParameterValue, get_sql
from chromadb.errors import BatchSizeExceededError
from chromadb.ingest import (
    Producer,
    Consumer,
    ConsumerCallbackFn,
    decode_vector,
    encode_vector,
)
from chromadb.types import (
    OperationRecord,
    LogRecord,
    ScalarEncoding,
    SeqId,
    Operation,
)
from chromadb.config import System
from chromadb.telemetry.opentelemetry import (
    OpenTelemetryClient,
    OpenTelemetryGranularity,
    trace_method,
)
from overrides import override
from collections import defaultdict
from typing import Sequence, Optional, Dict, Set, Tuple, cast
from uuid import UUID
from pypika import Table, functions
import uuid
import logging
from chromadb.ingest.impl.utils import create_topic_name


logger = logging.getLogger(__name__)

_operation_codes = {
    Operation.ADD: 0,
    Operation.UPDATE: 1,
    Operation.UPSERT: 2,
    Operation.DELETE: 3,
}
_operation_codes_inv = {v: k for k, v in _operation_codes.items()}

# Set in conftest.py to rethrow errors in the "async" path during testing
# https://doc.pytest.org/en/latest/example/simple.html#detect-if-running-from-within-a-pytest-run
_called_from_test = False


class SqlEmbeddingsQueue(SqlDB, Producer, Consumer):
    """A SQL database that stores embeddings, allowing a traditional RDBMS to be used as
    the primary ingest queue and satisfying the top level Producer/Consumer interfaces.

    Note that this class is only suitable for use cases where the producer and consumer
    are in the same process.

    This is because notification of new embeddings happens solely in-process: this
    implementation does not actively listen to the the database for new records added by
    other processes.
    """

    class Subscription:
        id: UUID
        topic_name: str
        start: int
        end: int
        callback: ConsumerCallbackFn

        def __init__(
            self,
            id: UUID,
            topic_name: str,
            start: int,
            end: int,
            callback: ConsumerCallbackFn,
        ):
            self.id = id
            self.topic_name = topic_name
            self.start = start
            self.end = end
            self.callback = callback

    _subscriptions: Dict[str, Set[Subscription]]
    _max_batch_size: Optional[int]
    _tenant: str
    _topic_namespace: str
    # How many variables are in the insert statement for a single record
    VARIABLES_PER_RECORD = 6

    def __init__(self, system: System):
        self._subscriptions = defaultdict(set)
        self._max_batch_size = None
        self._opentelemetry_client = system.require(OpenTelemetryClient)
        self._tenant = system.settings.require("tenant_id")
        self._topic_namespace = system.settings.require("topic_namespace")
        super().__init__(system)

    @trace_method("SqlEmbeddingsQueue.reset_state", OpenTelemetryGranularity.ALL)
    @override
    def reset_state(self) -> None:
        super().reset_state()
        self._subscriptions = defaultdict(set)

        # Invalidate the cached property
        try:
            del self.config
        except AttributeError:
            # Cached property hasn't been accessed yet
            pass

    @trace_method("SqlEmbeddingsQueue.delete_topic", OpenTelemetryGranularity.ALL)
    @override
    def delete_log(self, collection_id: UUID) -> None:
        topic_name = create_topic_name(
            self._tenant, self._topic_namespace, collection_id
        )
        t = Table("embeddings_queue")
        q = (
            self.querybuilder()
            .from_(t)
            .where(t.topic == ParameterValue(topic_name))
            .delete()
        )
        with self.tx() as cur:
            sql, params = get_sql(q, self.parameter_format())
            cur.execute(sql, params)

    @trace_method("SqlEmbeddingsQueue.purge_log", OpenTelemetryGranularity.ALL)
    @override
    def purge_log(self, collection_id: UUID) -> None:
        # (We need to purge on a per topic/collection basis, because the maximum sequence ID is tracked on a per topic/collection basis.)

        segments_t = Table("segments")
        segment_ids_q = (
            self.querybuilder()
            .from_(segments_t)
            # This coalesce prevents a correctness bug when > 1 segments exist and:
            # - > 1 has written to the max_seq_id table
            # - > 1 has not never written to the max_seq_id table
            # In that case, we should not delete any WAL entries as we can't be sure that the all segments are caught up.
            .select(functions.Coalesce(Table("max_seq_id").seq_id, -1))
            .where(
                segments_t.collection == ParameterValue(self.uuid_to_db(collection_id))
            )
            .left_join(Table("max_seq_id"))
            .on(segments_t.id == Table("max_seq_id").segment_id)
        )

        topic_name = create_topic_name(
            self._tenant, self._topic_namespace, collection_id
        )
        with self.tx() as cur:
            sql, params = get_sql(segment_ids_q, self.parameter_format())
            cur.execute(sql, params)
            results = cur.fetchall()
            if results:
                min_seq_id = min(row[0] for row in results)
            else:
                return

            t = Table("embeddings_queue")
            q = (
                self.querybuilder()
                .from_(t)
                .where(t.seq_id < ParameterValue(min_seq_id))
                .where(t.topic == ParameterValue(topic_name))
                .delete()
            )

            sql, params = get_sql(q, self.parameter_format())
            cur.execute(sql, params)

    @trace_method("SqlEmbeddingsQueue.submit_embedding", OpenTelemetryGranularity.ALL)
    @override
    def submit_embedding(
        self, collection_id: UUID, embedding: OperationRecord
    ) -> SeqId:
        if not self._running:
            raise RuntimeError("Component not running")

        return self.submit_embeddings(collection_id, [embedding])[0]

    @trace_method("SqlEmbeddingsQueue.submit_embeddings", OpenTelemetryGranularity.ALL)
    @override
    def submit_embeddings(
        self, collection_id: UUID, embeddings: Sequence[OperationRecord]
    ) -> Sequence[SeqId]:
        if not self._running:
            raise RuntimeError("Component not running")

        if len(embeddings) == 0:
            return []

        if len(embeddings) > self.max_batch_size:
            raise BatchSizeExceededError(
                f"""
                Cannot submit more than {self.max_batch_size:,} embeddings at once.
                Please submit your embeddings in batches of size
                {self.max_batch_size:,} or less.
                """
            )

        # This creates the persisted configuration if it doesn't exist.
        # It should be run as soon as possible (before any WAL mutations) since the default configuration depends on the WAL size.
        # (We can't run this in __init__()/start() because the migrations have not been run at that point and the table may not be available.)
        _ = self.config

        topic_name = create_topic_name(
            self._tenant, self._topic_namespace, collection_id
        )

        t = Table("embeddings_queue")
        insert = (
            self.querybuilder()
            .into(t)
            .columns(t.operation, t.topic, t.id, t.vector, t.encoding, t.metadata)
        )
        id_to_idx: Dict[str, int] = {}
        for embedding in embeddings:
            (
                embedding_bytes,
                encoding,
                metadata,
            ) = self._prepare_vector_encoding_metadata(embedding)
            insert = insert.insert(
                ParameterValue(_operation_codes[embedding["operation"]]),
                ParameterValue(topic_name),
                ParameterValue(embedding["id"]),
                ParameterValue(embedding_bytes),
                ParameterValue(encoding),
                ParameterValue(metadata),
            )
            id_to_idx[embedding["id"]] = len(id_to_idx)
        with self.tx() as cur:
            sql, params = get_sql(insert, self.parameter_format())
            # The returning clause does not guarantee order, so we need to do reorder
            # the results. https://www.sqlite.org/lang_returning.html
            sql = f"{sql} RETURNING seq_id, id"  # Pypika doesn't support RETURNING
            results = cur.execute(sql, params).fetchall()
            # Reorder the results
            seq_ids = [cast(SeqId, None)] * len(
                results
            )  # Lie to mypy: https://stackoverflow.com/questions/76694215/python-type-casting-when-preallocating-list
            embedding_records = []
            for seq_id, id in results:
                seq_ids[id_to_idx[id]] = seq_id
                submit_embedding_record = embeddings[id_to_idx[id]]
                # We allow notifying consumers out of order relative to one call to
                # submit_embeddings so we do not reorder the records before submitting them
                embedding_record = LogRecord(
                    log_offset=seq_id,
                    record=OperationRecord(
                        id=id,
                        embedding=submit_embedding_record["embedding"],
                        encoding=submit_embedding_record["encoding"],
                        metadata=submit_embedding_record["metadata"],
                        operation=submit_embedding_record["operation"],
                    ),
                )
                embedding_records.append(embedding_record)
            self._notify_all(topic_name, embedding_records)

            if self.config.get_parameter("automatically_purge").value:
                self.purge_log(collection_id)

            return seq_i
```

### Core Architecture Module: `chromadb/ingest/impl/utils.py`
```
import re
from typing import Tuple
from uuid import UUID

from chromadb.db.base import SqlDB
from chromadb.segment import SegmentManager, VectorReader

topic_regex = r"persistent:\/\/(?P<tenant>.+)\/(?P<namespace>.+)\/(?P<topic>.+)"


def parse_topic_name(topic_name: str) -> Tuple[str, str, str]:
    """Parse the topic name into the tenant, namespace and topic name"""
    match = re.match(topic_regex, topic_name)
    if not match:
        raise ValueError(f"Invalid topic name: {topic_name}")
    return match.group("tenant"), match.group("namespace"), match.group("topic")


def create_topic_name(tenant: str, namespace: str, collection_id: UUID) -> str:
    return f"persistent://{tenant}/{namespace}/{str(collection_id)}"


def trigger_vector_segments_max_seq_id_migration(
    db: SqlDB, segment_manager: SegmentManager
) -> None:
    """
    Trigger the migration of vector segments' max_seq_id from the pickled metadata file to SQLite.

    Vector segments migrate this field automatically on init—so this should be used when we know segments are likely unmigrated and unloaded.

    This is a no-op if all vector segments have already migrated their max_seq_id.
    """
    with db.tx() as cur:
        cur.execute(
            """
            SELECT collection
            FROM "segments"
            WHERE "id" NOT IN (SELECT "segment_id" FROM "max_seq_id") AND
                  "type" = 'urn:chroma:segment/vector/hnsw-local-persisted'
        """
        )
        collection_ids_with_unmigrated_segments = [row[0] for row in cur.fetchall()]

    if len(collection_ids_with_unmigrated_segments) == 0:
        return

    for collection_id in collection_ids_with_unmigrated_segments:
        # Loading the segment triggers the migration on init
        segment_manager.get_segment(UUID(collection_id), VectorReader)

```

### Core Architecture Module: `chromadb/proto/utils.py`
```
from typing import Optional, Set
import grpc
from tenacity import retry, stop_after_attempt, wait_exponential_jitter, retry_if_result
from opentelemetry.trace import Span


class RetryOnRpcErrorClientInterceptor(
    grpc.UnaryUnaryClientInterceptor, grpc.UnaryStreamClientInterceptor
):
    """
    A gRPC client interceptor that retries RPCs on specific status codes. By default, it retries on UNAVAILABLE and UNKNOWN status codes.

    This interceptor should be placed after the OpenTelemetry interceptor in the interceptor list.
    """

    max_attempts: int
    retryable_status_codes: Set[grpc.StatusCode]

    def __init__(
        self,
        max_attempts: int = 5,
        retryable_status_codes: Set[grpc.StatusCode] = set(
            [grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.UNKNOWN]
        ),
    ) -> None:
        self.max_attempts = max_attempts
        self.retryable_status_codes = retryable_status_codes

    def _intercept_call(self, continuation, client_call_details, request_or_iterator):
        sleep_span: Optional[Span] = None

        def before_sleep(_):
            from chromadb.telemetry.opentelemetry import tracer

            nonlocal sleep_span
            if tracer is not None:
                sleep_span = tracer.start_span("Waiting to retry RPC")

        @retry(
            wait=wait_exponential_jitter(0.1, jitter=0.1),
            stop=stop_after_attempt(self.max_attempts),
            retry=retry_if_result(lambda x: x.code() in self.retryable_status_codes),
            before_sleep=before_sleep,
        )
        def wrapped(*args, **kwargs):
            nonlocal sleep_span
            if sleep_span is not None:
                sleep_span.end()
                sleep_span = None
            return continuation(*args, **kwargs)

        return wrapped(client_call_details, request_or_iterator)

    def intercept_unary_unary(self, continuation, client_call_details, request):
        return self._intercept_call(continuation, client_call_details, request)

    def intercept_unary_stream(self, continuation, client_call_details, request):
        return self._intercept_call(continuation, client_call_details, request)

    def intercept_stream_unary(
        self, continuation, client_call_details, request_iterator
    ):
        return self._intercept_call(continuation, client_call_details, request_iterator)

    def intercept_stream_stream(
        self, continuation, client_call_details, request_iterator
    ):
        return self._intercept_call(continuation, client_call_details, request_iterator)

```

### Core Architecture Module: `chromadb/utils/__init__.py`
```
import importlib
from typing import Type, TypeVar, cast

C = TypeVar("C")


def get_class(fqn: str, type: Type[C]) -> Type[C]:
    """Given a fully qualifed class name, import the module and return the class"""
    module_name, class_name = fqn.rsplit(".", 1)
    module = importlib.import_module(module_name)
    cls = getattr(module, class_name)
    return cast(Type[C], cls)

```

### Core Architecture Module: `chromadb/utils/async_to_sync.py`
```
import inspect
import asyncio
from typing import Any, Callable, Coroutine, TypeVar
from typing_extensions import ParamSpec


P = ParamSpec("P")
R = TypeVar("R")


def async_to_sync(func: Callable[P, Coroutine[Any, Any, R]]) -> Callable[P, R]:
    """A function decorator that converts an async function to a sync function.

    This should generally not be used in production code paths.
    """

    def sync_wrapper(*args, **kwargs):  # type: ignore
        loop = None
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            return func(*args, **kwargs)

        result = loop.run_until_complete(func(*args, **kwargs))

        def convert_result(result: Any) -> Any:
            if isinstance(result, list):
                return [convert_result(r) for r in result]

            if isinstance(result, object):
                return async_class_to_sync(result)

            if callable(result):
                return async_to_sync(result)

            return result

        return convert_result(result)

    return sync_wrapper


T = TypeVar("T")


def async_class_to_sync(cls: T) -> T:
    """A decorator that converts a class with async methods to a class with sync methods.

    This should generally not be used in production code paths.
    """
    for attr, value in inspect.getmembers(cls):
        if (
            callable(value)
            and inspect.iscoroutinefunction(value)
            and not attr.startswith("__")
        ):
            setattr(cls, attr, async_to_sync(value))

    return cls

```

### Core Architecture Module: `chromadb/utils/batch_utils.py`
```
from typing import Optional, Tuple, List
from chromadb.api import BaseAPI
from chromadb.api.types import (
    Documents,
    Embeddings,
    IDs,
    Metadatas,
)


def create_batches(
    api: BaseAPI,
    ids: IDs,
    embeddings: Optional[Embeddings] = None,
    metadatas: Optional[Metadatas] = None,
    documents: Optional[Documents] = None,
) -> List[Tuple[IDs, Optional[Embeddings], Optional[Metadatas], Optional[Documents]]]:
    _batches: List[
        Tuple[IDs, Optional[Embeddings], Optional[Metadatas], Optional[Documents]]
    ] = []
    if len(ids) > api.get_max_batch_size():
        # create split batches
        for i in range(0, len(ids), api.get_max_batch_size()):
            _batches.append(
                (
                    ids[i : i + api.get_max_batch_size()],
                    embeddings[i : i + api.get_max_batch_size()]
                    if embeddings is not None
                    else None,
                    metadatas[i : i + api.get_max_batch_size()] if metadatas else None,
                    documents[i : i + api.get_max_batch_size()] if documents else None,
                )
            )
    else:
        _batches.append((ids, embeddings, metadatas, documents))
    return _batches

```

### Core Architecture Module: `chromadb/utils/data_loaders.py`
```
import importlib
import multiprocessing
from typing import Optional, Sequence, List, Tuple
import numpy as np
from chromadb.api.types import URI, DataLoader, Image, URIs
from concurrent.futures import ThreadPoolExecutor


class ImageLoader(DataLoader[List[Optional[Image]]]):
    def __init__(self, max_workers: int = multiprocessing.cpu_count()) -> None:
        try:
            self._PILImage = importlib.import_module("PIL.Image")
            self._max_workers = max_workers
        except ImportError:
            raise ValueError(
                "The PIL python package is not installed. Please install it with `pip install pillow`"
            )

    def _load_image(self, uri: Optional[URI]) -> Optional[Image]:
        return np.array(self._PILImage.open(uri)) if uri is not None else None

    def __call__(self, uris: Sequence[Optional[URI]]) -> List[Optional[Image]]:
        with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            return list(executor.map(self._load_image, uris))


class ChromaLangchainPassthroughDataLoader(DataLoader[List[Optional[Image]]]):
    # This is a simple pass through data loader that just returns the input data with "images"
    # flag which lets the langchain embedding function know that the data is image uris
    def __call__(self, uris: URIs) -> Tuple[str, URIs]:  # type: ignore
        return ("images", uris)

```

### Core Architecture Module: `chromadb/utils/delete_file.py`
```
import os
import random
import gc
import time


# Borrowed from https://github.com/rogerbinns/apsw/blob/master/apsw/tests.py#L224
# Used to delete sqlite files on Windows, since Windows file locking
# behaves differently to other operating systems
# This should only be used for test or non-production code, such as in reset_state.
def delete_file(name: str) -> None:
    try:
        os.remove(name)
    except Exception:
        pass

    chars = list("abcdefghijklmn")
    random.shuffle(chars)
    newname = name + "-n-" + "".join(chars)
    count = 0
    while os.path.exists(name):
        count += 1
        try:
            os.rename(name, newname)
        except Exception:
            if count > 30:
                n = list("abcdefghijklmnopqrstuvwxyz")
                random.shuffle(n)
                final_name = "".join(n)
                try:
                    os.rename(
                        name, "chroma-to-clean" + final_name + ".deletememanually"
                    )
                except Exception:
                    pass
                break
            time.sleep(0.1)
            gc.collect()

```

### Core Architecture Module: `chromadb/utils/directory.py`
```
import os


def get_directory_size(directory: str) -> int:
    """
    Calculate the total size of the directory by walking through each file.

    Parameters:
    directory (str): The path of the directory for which to calculate the size.

    Returns:
    total_size (int): The total size of the directory in bytes.
    """
    total_size = 0
    for dirpath, _, filenames in os.walk(directory):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            # skip if it is symbolic link
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)

    return total_size

```

### Core Architecture Module: `chromadb/utils/embedding_functions/__init__.py`
```
from typing import Dict, Any, Type, Set
from chromadb.api.types import (
    EmbeddingFunction,
    DefaultEmbeddingFunction,
    SparseEmbeddingFunction,
)
from chromadb.utils.embedding_functions.config_validation import (
    validate_embedding_function_config_is_safe,
)

# Import all embedding functions
from chromadb.utils.embedding_functions.cohere_embedding_function import (
    CohereEmbeddingFunction,
)
from chromadb.utils.embedding_functions.openai_embedding_function import (
    OpenAIEmbeddingFunction,
)
from chromadb.utils.embedding_functions.huggingface_embedding_function import (
    HuggingFaceEmbeddingFunction,
    HuggingFaceEmbeddingServer,
)
from chromadb.utils.embedding_functions.sentence_transformer_embedding_function import (
    SentenceTransformerEmbeddingFunction,
)
from chromadb.utils.embedding_functions.google_embedding_function import (
    GooglePalmEmbeddingFunction,
    GoogleGenerativeAiEmbeddingFunction,
    GoogleVertexEmbeddingFunction,
    GoogleGeminiEmbeddingFunction,
    GoogleGenaiEmbeddingFunction,  # Backward compatibility alias
)
from chromadb.utils.embedding_functions.ollama_embedding_function import (
    OllamaEmbeddingFunction,
)
from chromadb.utils.embedding_functions.instructor_embedding_function import (
    InstructorEmbeddingFunction,
)
from chromadb.utils.embedding_functions.jina_embedding_function import (
    JinaEmbeddingFunction,
    JinaQueryConfig,
)
from chromadb.utils.embedding_functions.voyageai_embedding_function import (
    VoyageAIEmbeddingFunction,
)
from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2
from chromadb.utils.embedding_functions.open_clip_embedding_function import (
    OpenCLIPEmbeddingFunction,
)
from chromadb.utils.embedding_functions.roboflow_embedding_function import (
    RoboflowEmbeddingFunction,
)
from chromadb.utils.embedding_functions.text2vec_embedding_function import (
    Text2VecEmbeddingFunction,
)
from chromadb.utils.embedding_functions.amazon_bedrock_embedding_function import (
    AmazonBedrockEmbeddingFunction,
)
from chromadb.utils.embedding_functions.chroma_langchain_embedding_function import (
    ChromaLangchainEmbeddingFunction,
)
from chromadb.utils.embedding_functions.baseten_embedding_function import (
    BasetenEmbeddingFunction,
)
from chromadb.utils.embedding_functions.cloudflare_workers_ai_embedding_function import (
    CloudflareWorkersAIEmbeddingFunction,
)
from chromadb.utils.embedding_functions.together_ai_embedding_function import (
    TogetherAIEmbeddingFunction,
)
from chromadb.utils.embedding_functions.mistral_embedding_function import (
    MistralEmbeddingFunction,
)
from chromadb.utils.embedding_functions.morph_embedding_function import (
    MorphEmbeddingFunction,
)
from chromadb.utils.embedding_functions.nomic_embedding_function import (
    NomicEmbeddingFunction,
    NomicQueryConfig,
)
from chromadb.utils.embedding_functions.huggingface_sparse_embedding_function import (
    HuggingFaceSparseEmbeddingFunction,
)
from chromadb.utils.embedding_functions.fastembed_sparse_embedding_function import (
    FastembedSparseEmbeddingFunction,
)
from chromadb.utils.embedding_functions.bm25_embedding_function import (
    Bm25EmbeddingFunction,
)
from chromadb.utils.embedding_functions.chroma_cloud_qwen_embedding_function import (
    ChromaCloudQwenEmbeddingFunction,
)
from chromadb.utils.embedding_functions.chroma_cloud_splade_embedding_function import (
    ChromaCloudSpladeEmbeddingFunction,
)
from chromadb.utils.embedding_functions.chroma_bm25_embedding_function import (
    ChromaBm25EmbeddingFunction,
)
from chromadb.utils.embedding_functions.perplexity_embedding_function import (
    PerplexityEmbeddingFunction,
)


# Get all the class names for backward compatibility
_all_classes: Set[str] = {
    "CohereEmbeddingFunction",
    "OpenAIEmbeddingFunction",
    "HuggingFaceEmbeddingFunction",
    "HuggingFaceEmbeddingServer",
    "SentenceTransformerEmbeddingFunction",
    "GooglePalmEmbeddingFunction",
    "GoogleGenerativeAiEmbeddingFunction",
    "GoogleVertexEmbeddingFunction",
    "GoogleGeminiEmbeddingFunction",
    "GoogleGenaiEmbeddingFunction",  # Backward compatibility alias
    "OllamaEmbeddingFunction",
    "InstructorEmbeddingFunction",
    "JinaEmbeddingFunction",
    "MistralEmbeddingFunction",
    "MorphEmbeddingFunction",
    "NomicEmbeddingFunction",
    "VoyageAIEmbeddingFunction",
    "ONNXMiniLM_L6_V2",
    "OpenCLIPEmbeddingFunction",
    "RoboflowEmbeddingFunction",
    "Text2VecEmbeddingFunction",
    "AmazonBedrockEmbeddingFunction",
    "ChromaLangchainEmbeddingFunction",
    "BasetenEmbeddingFunction",
    "CloudflareWorkersAIEmbeddingFunction",
    "TogetherAIEmbeddingFunction",
    "DefaultEmbeddingFunction",
    "HuggingFaceSparseEmbeddingFunction",
    "FastembedSparseEmbeddingFunction",
    "Bm25EmbeddingFunction",
    "ChromaCloudQwenEmbeddingFunction",
    "ChromaCloudSpladeEmbeddingFunction",
    "ChromaBm25EmbeddingFunction",
    "PerplexityEmbeddingFunction"
}


def get_builtins() -> Set[str]:
    return _all_classes


# Dictionary of supported embedding functions
known_embedding_functions: Dict[str, Type[EmbeddingFunction]] = {  # type: ignore
    "cohere": CohereEmbeddingFunction,
    "openai": OpenAIEmbeddingFunction,
    "huggingface": HuggingFaceEmbeddingFunction,
    "huggingface_server": HuggingFaceEmbeddingServer,
    "sentence_transformer": SentenceTransformerEmbeddingFunction,
    "google_palm": GooglePalmEmbeddingFunction,
    "google_generative_ai": GoogleGenerativeAiEmbeddingFunction,
    "google_vertex": GoogleVertexEmbeddingFunction,
    "google_gemini": GoogleGeminiEmbeddingFunction,
    "google_genai": GoogleGeminiEmbeddingFunction,  # Backward compatibility alias
    "ollama": OllamaEmbeddingFunction,
    "instructor": InstructorEmbeddingFunction,
    "jina": JinaEmbeddingFunction,
    "mistral": MistralEmbeddingFunction,
    "morph": MorphEmbeddingFunction,
    "nomic": NomicEmbeddingFunction,
    "voyageai": VoyageAIEmbeddingFunction,
    "onnx_mini_lm_l6_v2": ONNXMiniLM_L6_V2,
    "open_clip": OpenCLIPEmbeddingFunction,
    "roboflow": RoboflowEmbeddingFunction,
    "text2vec": Text2VecEmbeddingFunction,
    "amazon_bedrock": AmazonBedrockEmbeddingFunction,
    "chroma_langchain": ChromaLangchainEmbeddingFunction,
    "baseten": BasetenEmbeddingFunction,
    "default": DefaultEmbeddingFunction,
    "cloudflare_workers_ai": CloudflareWorkersAIEmbeddingFunction,
    "together_ai": TogetherAIEmbeddingFunction,
    "chroma-cloud-qwen": ChromaCloudQwenEmbeddingFunction,
    "perplexity": PerplexityEmbeddingFunction,
}

sparse_known_embedding_functions: Dict[str, Type[SparseEmbeddingFunction]] = {  # type: ignore
    "huggingface_sparse": HuggingFaceSparseEmbeddingFunction,
    "fastembed_sparse": FastembedSparseEmbeddingFunction,
    "bm25": Bm25EmbeddingFunction,
    "chroma-cloud-splade": ChromaCloudSpladeEmbeddingFunction,
    "chroma_bm25": ChromaBm25EmbeddingFunction,
}


def register_embedding_function(ef_class=None):  # type: ignore
    """Register a custom embedding function.

    Can be used as a decorator:
        @register_embedding_function
        class MyEmbedding(EmbeddingFunction):
            @classmethod
            def name(cls): return "my_embedding"

    Or directly:
        register_embedding_function(MyEmbedding)

    Args:
        ef_class: The embedding function class to register.
    """

    def _register(cls):  # type: ignore
        try:
            name = cls.name()
            known_embedding_functions[name] = cls
        except Exception as e:
            raise ValueError(f"Failed to register embedding function: {e}")
        return cls  # Return the class unchanged

    # If called with a class, register it immediately
    if ef_class is not None:
        return _register(ef_class)  # type: ignore

    # If called without arguments, return a decorator
    return _register


def register_sparse_embedding_function(ef_class=None):  # type: ignore
    """Register a custom sparse embedding function.

    Can be used as a decorator:
        @register_sparse_embedding_function
        class MySparseEmbeddingFunction(SparseEmbeddingFunction):
            @classmethod
            def name(cls): return "my_sparse_embedding"
    """

    def _register(cls):  # type: ignore
        try:
            name = cls.name()
            sparse_known_embedding_functions[name] = cls
        except Exception as e:
            raise ValueError(f"Failed to register sparse embedding function: {e}")
        return cls  # Return the class unchanged

    if ef_class is not None:
        return _register(ef_class)  # type: ignore

    return _register


# Function to convert config to embedding function
def config_to_embedding_function(config: Dict[str, Any]) -> EmbeddingFunction:  # type: ignore
    """Convert a config dictionary to an embedding function.

    Args:
        config: The config dictionary.

    Returns:
        The embedding function.
    """
    if "name" not in config:
        raise ValueError("Config must contain a 'name' field.")

    name = config["name"]
    if name not in known_embedding_functions:
        raise ValueError(f"Unsupported embedding function: {name}")

    ef_config = config.get("config", {})

    if known_embedding_functions[name] is None:
        raise ValueError(f"Unsupported embedding function: {name}")

    validate_embedding_function_config_is_safe(name, ef_config)
    return known_embedding_functions[name].build_from_config(ef_config)


__all__ = [
    "EmbeddingFunction",
    "DefaultEmbeddingFunction",
    "CohereEmbeddingFunction",
    "OpenAIEmbeddingFunction",
    "BasetenEmbeddingFunction",
    "CloudflareWorkersAIEmbeddingFunction",
    "HuggingFaceEmbeddingFunction",
    "HuggingFaceEmbeddingServer",
    "SentenceTransformerEmbeddingFunction",
    "GooglePalmEmbeddingFunction",
    "GoogleGenerativeAiEmbeddingFunction",
    "GoogleVertexEmbeddingFuncti
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7278** (2026-06-18): **[Bug]: GoogleGeminiEmbeddingFunction does not find the GEMINI_API_KEY when vertexai is not enabled**
  *Symptoms*: ### What happened?  Here is my sample code: ```python import os import chromadb from chromadb.utils import embedding_functions from dotenv import load_dotenv  load_dotenv() GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")  client = chromadb.PersistentClient(path="./chroma_db")  gemini_embedding = embedding_functions.GoogleGeminiEmbeddingFunction(     model_name = "gemini-embedding-001",     api_key_env_var=GEMINI_API_KEY )  collection = client.get_or_create_collection(     name = "arxiv_papers",     embedding_function=gemini_embedding # type: ignore )  documents = [     "Some text" ]  ids = ["1"]  collection.add(ids=ids, documents=documents) ``` It does not work and a `ValueError` is raised: ``` ValueError: The <GOOGLE_API_KEY> environment variable must be set if vertexai is not enabled. ``` It outputs my API key directly...  It works when I add the following line and remove the line `api_key_env_var=GEMINI_API_KEY`.  ```python os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY ``` The screen output is also interesting: ``` Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY. Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY. Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY. Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY. ``` But it actually does not use GOOGLE_API_KEY. When I only set the `GOOGLE_API_KEY` and remove the `api_key_env_var`, the output is  ``` ValueError: The GEMINI_API_KEY environment variabl
  **Post-Mortem & Fix Analysis**:
  > Sorry, I just misunderstand the `api_key_env_var` variable.

- **Issue #7226** (2026-07-07): **[SECURITY]: ChromaDB Python project has a pre-authentication code injection vulnerability**
  *Symptoms*: ### What happened?  **Getting alert from Git:** A pre-authentication, code injection vulnerability in version 1.0.0 or later of the ChromaDB Python project allows an unauthenticated attacker to run arbitrary code on the server by sending a malicious model repository and trust_remote_code set to true in the /api/v2/tenants/{tenant}/databases/{db}/collections endpoint.  How to address this issue? Are you publishing newer version by fixing this?  ### Versions  >= 1.0.0, <= 1.5.9  ### Relevant log output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Worth adding:  This issue is surely about CVE-2026-45829, https://avd.aquasec.com/nvd/cve-2026-45829       
  > See also https://github.com/advisories/GHSA-f4j7-r4q5-qw2c
  > @tanujnay112 , i saw that you've been making commits into this repo. Could you please help us get this issue assigned and resolved? it's an important issue to resolve soon. 

- **Issue #6972** (2026-08-17): **[Bug]: npm package @chroma-core/ollama depends on unused "testcontainers"**
  *Symptoms*: ### What happened?  Noticed this while creating a PR to the [testcontainers](https://github.com/testcontainers/testcontainers-node) repository.  That repo both defines the `testcontainers` npm package AND depends on `@chroma-core/ollama` in one of its in-repo packages. Now, `@chroma-core/ollama` itself depends on the `testcontainers` package, so an extra copy gets installed by npm.  I believe this to be a mistake, as `testcontainers` is not used anywhere within `@chroma-core/ollama`, so thought I'd report it to you guys. Would appreciate if you could remove that unused dependency and release a new `@chroma-core/ollama` version.  ### Versions  @chroma-core/ollama@0.1.8
  **Post-Mortem & Fix Analysis**:
  > Looking into this — I’m checking the package manifest and release wiring to remove the unused dependency without affecting the ollama package tests.
  > For the unused testcontainers dependency:  The `@chroma-core/ollama` package lists `testcontainers` as a dependency but never uses it. This adds unnecessary weight and potential security surface.  Fix: Remove `testcontainers` from `package.json` dependencies.  ```diff -  "testcontainers": "^4.x" +  // removed - not used in code ```

- **Issue #6837** (2026-04-06): **[Bug]: Python client throwing error when using Chroma Cloud Qwen**
  *Symptoms*: ### What happened?  Using the chroma cloud qwen embedding function as described in [this page on the docs](https://docs.trychroma.com/integrations/embedding-models/chroma-cloud-qwen) throws an error.  See full examples below. As a counter example I've shown the same code with an openai dense embedding funciton.  ```python import os from dotenv import load_dotenv import chromadb from chromadb import (     Schema, VectorIndexConfig, SparseVectorIndexConfig,     Search, K, Knn, Rrf ) from chromadb.utils.embedding_functions import (     ChromaCloudQwenEmbeddingFunction,     ChromaBm25EmbeddingFunction, ) from chromadb.utils.embedding_functions.chroma_cloud_qwen_embedding_function import (ChromaCloudQwenEmbeddingModel)  load_dotenv()  # 3. Create client and collection (no embedding_function arg) client = chromadb.CloudClient(     tenant=os.getenv("CHROMA_TENANT"),     database=os.getenv("CHROMA_DATABASE"),     api_key=os.getenv("CHROMA_API_KEY") )  # 1. Set up embedding functions qwen_ef = ChromaCloudQwenEmbeddingFunction(     model=ChromaCloudQwenEmbeddingModel.QWEN3_EMBEDDING_0p6B,     task="document_search" )  bm25_ef = ChromaBm25EmbeddingFunction(     k=1.2, b=0.75, avg_doc_length=256.0, token_max_length=40 )  # 2. Create schema with both dense and sparse indexes schema = Schema()  # Dense vector index (Qwen) schema.create_index(config=VectorIndexConfig(     space="cosine",     embedding_function=qwen_ef ))  # Sparse vector index (BM25) schema.create_index(     config=SparseVe
  **Post-Mortem & Fix Analysis**:
  > Also, rather than import `ChromaCloudEmbeddingModel` enum from `chromadb.utils.embedding_functions` as shown in the docs, I have to import it from `chromadb.utils.embedding_functions.chroma_cloud_qwen_embedding_function`.  If I import as shown in the docs I get:  ``` Traceback (most recent call last):   File "/Users/tjkrusinski/Software/context-1-example-harness/foo.py", line 8, in <module>     from chromadb.utils.embedding_functions import (     ...<3 lines>...     ) ImportError: cannot import name 'ChromaCloudQwenEmbeddingModel' from 'chromadb.utils.embedding_functions' (/Users/tjkrusinski/Software/context-1-example-harness/.venv/lib/python3.14/site-packages/chromadb/utils/embedding_functions/__init__.py) ```

- **Issue #6787** (2026-04-04): **[Bug]: In TypeScript I cannot remove the process from `chroma run --path /db_path`**
  *Symptoms*: ### What happened?  nothing happens when Crt+c or Crt+d   ### Versions  latest  ### Relevant log output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks we will take a look!
  > Should be fixed by #6808 

- **Issue #6723** (2026-03-31): **[Docs]: Missing prerequisite: `protoc` required for `uv sync` on macOS**
  *Symptoms*: ### What happened?  ## Problem Running `uv sync` fails with the following error: > Could not find `protoc`  The documentation does not mention that `protoc` is a required dependency.  ## Steps to Reproduce 1. Clone the repo 2. Run `uv sync`  ## Expected Behavior Either the docs mention `brew install protobuf` as a prerequisite, or the build handles `protoc` automatically.  ### Versions  ## Environment - OS: macOS - Python: 3.13 - uv version: 0.6.16 - chroma: main branch (commit: 1e76db4c)  ### Relevant log output  ```shell ❯ uv sync Using CPython 3.13.5 Creating virtual environment at: .venv Resolved 113 packages in 1m 52s   × Failed to build `chromadb @ file:///Users/lai/chroma`   ├─▶ The build backend returned an error   ╰─▶ Call to `maturin.build_editable` failed (exit status: 1)        [stdout]       Running `maturin pep517 build-wheel -i /Users/lai/.cache/uv/builds-v0/.tmp8RLq19/bin/python --compatibility off --editable`        [stderr]       📦 Including license file `LICENSE`       🔗 Found pyo3 bindings with abi3 support       🐍 Found CPython 3.13 at /Users/lai/.cache/uv/builds-v0/.tmp8RLq19/bin/python       📡 Using build options features from pyproject.toml          Compiling proc-macro2 v1.0.95          ...        error: failed to run custom build command for `chroma-types v0.13.2 (/Users/lai/chroma/rust/types)`        Caused by:         process didn't exit successfully: `/Users/lai/chroma/target/release/build/chroma-types-3027833f329dc971/build-script-build` (exi
  **Post-Mortem & Fix Analysis**:
  > hey @s20055232  [DEVELOP.md](https://github.com/chroma-core/chroma/blob/main/DEVELOP.md) tells you how to set up your local dev environment and tells you to `brew install protobuf`. Can I ask where you tried looking? The real issue here is likely that these instructions are not discoverable enough.
  > Sor. I missed that. 

- **Issue #6681** (2026-03-18): **[Bug]: Knn(query="string") raises ValueError with Cloud embedding functions**
  *Symptoms*: ### What happened?  **Summary:**  In CollectionCommon._embed_knn_string_queries (line 839), the check if not embedding fails when the embedding function returns a numpy array, because not numpy_array is ambiguous for arrays with more than one element. This affects all Cloud EFs (ChromaCloudQwenEmbeddingFunction, ChromaCloudSpladeEmbeddingFunction) but not the default local EF, which returns plain lists._  Fix: Replace if not embedding with if embedding is None (or len(embedding) != 1 only).  Repro: Use Knn(query="frustrated users") in a hybrid search with any Cloud EF.  Workaround: Pre-compute embeddings and pass vectors directly instead of strings.  Repro python script ```py """ Bug report: Knn(query="string") throws ValueError with Chroma Cloud embedding functions chromadb==1.5.5, Python 3.13  The hybrid search docs show Knn(query="string") working with string queries:   https://docs.trychroma.com/cloud/search-api/hybrid-search  This works with the default local EF (all-MiniLM-L6-v2) but fails with Cloud EFs (ChromaCloudQwenEmbeddingFunction, ChromaCloudSpladeEmbeddingFunction).  Root cause: CollectionCommon._embed_knn_string_queries line 839 does:     if not embedding or len(embedding) != 1: Cloud EFs return numpy arrays, and `not numpy_array` raises ValueError.  Traceback:     File ".../chromadb/api/models/Collection.py", line 413, in search         self._embed_search_string_queries(search) for search in searches_list     File ".../chromadb/api/models/CollectionCommon.py"

- **Issue #6546** (2026-03-05): **[Bug]: chromadb 1.5.2 fails with Pydantic v.1 error in conftest.py**
  *Symptoms*: ### What happened?  While building chromadb 1.5.2 for nixpkgs using Python 3.14 (linux and Darwin): > E   pydantic.v1.errors.ConfigError: unable to infer type for attribute "chroma_server_nofile"  See also: #5996  ### Versions  Chromadb 1.5.2, nixpkgs-unstable   ### Relevant log output  ```shell ImportError while loading conftest '/build/source/chromadb/test/conftest.py'. chromadb/__init__.py:3: in <module>     from chromadb.api.client import Client as ClientCreator chromadb/api/__init__.py:51: in <module>     from chromadb.config import DEFAULT_DATABASE, DEFAULT_TENANT chromadb/config.py:120: in <module>     class Settings(BaseSettings):  # type: ignore /nix/store/k58qxcll13r724x4pb2fs40bj8rwz6sq-python3.14-pydantic-2.12.5/lib/python3.14/site-packages/pydantic/v1/main.py:221: in __new__     inferred = ModelField.infer( /nix/store/k58qxcll13r724x4pb2fs40bj8rwz6sq-python3.14-pydantic-2.12.5/lib/python3.14/site-packages/pydantic/v1/fields.py:504: in infer     return cls( /nix/store/k58qxcll13r724x4pb2fs40bj8rwz6sq-python3.14-pydantic-2.12.5/lib/python3.14/site-packages/pydantic/v1/fields.py:434: in __init__     self.prepare() /nix/store/k58qxcll13r724x4pb2fs40bj8rwz6sq-python3.14-pydantic-2.12.5/lib/python3.14/site-packages/pydantic/v1/fields.py:544: in prepare     self._set_default_and_type() /nix/store/k58qxcll13r724x4pb2fs40bj8rwz6sq-python3.14-pydantic-2.12.5/lib/python3.14/site-packages/pydantic/v1/fields.py:576: in _set_default_and_type     raise errors_.ConfigError(f'una
  **Post-Mortem & Fix Analysis**:
  > Hi, Chroma is currently broken on 3.14 due to issues with pydantic breaking backwards compatibility. We're working to quickly release a new update where we will be dropping support for pydantic v1, and Chroma on Python 3.14 will be fixed. Sorry about this.

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

### Incident Patch 1: `848cf58d` (2026-09-30)
**Commit Message**: [BUG](sysdb): Bound merged database list reads (#7826)

Forward limit and offset to the single-region SysDB even when a
secondary SysDB is configured. Return full pages directly; use a count
lookup when needed to continue pagination into the secondary results.

Validation:
- Reproduced the oversized gRPC response with 50,001 databases on the
old code; the regression test passes with the fix.
- Tested pagination across both sources, empty results, zero limits, and
unbounded requests.
- All 28 non-Kubernetes SysDB tests, Clippy, and formatting checks pass.

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2153,6 +2153,7 @@ dependencies = [
  "thiserror 1.0.69",
  "tokio",
  "tonic 0.14.5",
+ "tonic-prost",
  "tower 0.5.3",
  "tracing",
  "uuid",
```

**File**: `rust/sysdb/Cargo.toml` (modified, +3/-0)
```diff
@@ -33,3 +33,6 @@ chroma-types = { workspace = true }
 chroma-tracing = { workspace = true, features = ["grpc"] }
 chroma-sqlite = { workspace = true }
 chroma-storage = { workspace = true }
+
+[dev-dependencies]
+tonic-prost = "0.14"
```

**File**: `rust/sysdb/src/database_pagination_tests.rs` (added, +237/-0)
```diff
@@ -0,0 +1,237 @@
+//! Exercise the actual gRPC client with a secondary SysDB configured.
+use super::*;
+use parking_lot::Mutex;
+use std::{
+    convert::Infallible,
+    sync::Arc,
+    task::{Context, Poll},
+};
+use tonic::{
+    body::Body,
+    codegen::{http, BoxFuture},
+    server::{NamedService, UnaryService},
+};
+
+#[derive(Clone)]
+struct MockSysDb {
+    rows: Arc<Vec<chroma_proto::Database>>,
+    requests: Arc<Mutex<Vec<chroma_proto::ListDatabasesRequest>>>,
+    counts: Arc<Mutex<usize>>,
+    paginate: bool,
+}
+
+impl MockSysDb {
+    fn new(names: impl Iterator<Item = String>, paginate: bool) -> Self {
+        Self {
+            rows: Arc::new(
+                names
+                    .map(|name| chroma_proto::Database {
+                        id: Uuid::new_v4().to_string(),
+                        name,
+                        tenant: "47cf80f0-3906-4c59-98ef-6d817ad4397c".into(),
+                    })
+                    .collect(),
+            ),
+            requests: Default::default(),
+            counts: Default::default(),
+            paginate,
+        }
+    }
+
+    async fn start(
+        &self,
+    ) -> (
+        SysDbClient<chroma_tracing::GrpcClientTraceService<Channel>>,
+        tokio::task::JoinHandle<()>,
+    ) {
+        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+        let addr = listener.local_addr().unwrap();
+        let incoming = futures::stream::unfold(listener, |listener| async {
+            Some((listener.accept().await.map(|(stream, _)| stream), listener))
+        });
+        let service = self.clone();
+        let task = tokio::spawn(async move {
+            tonic::transport::Server::builder()
+                .add_service(service)
+                .serve_with_incoming(incoming)
+                .await
+                .unwrap();
+        });
+        let channel = Endpoint::from_shared(format!("http://{addr}"))
+            .unwrap()
+            .connect()
+            .await
+            .unwrap();
+        (
+            SysDbClient::new(
+                ServiceBuilder::new()
+                    .layer(chroma_tracing::GrpcClientTraceLayer)
+                    .service(channel),
+            ),
+            task,
+        )
+    }
+}
+
+impl UnaryService<chroma_proto::ListDatabasesRequest> for MockSysDb {
+    type Response = chroma_proto::ListDatabasesResponse;
+    type Future = BoxFuture<tonic::Response<Self::Response>, tonic::Status>;
+    fn call(&mut self, req: tonic::Request<chroma_proto::ListDatabasesRequest>) -> Self::Future {
+        let req = req.into_inner();
+        self.requests.lock().push(req.clone());
+        let offset = if self.paginate {
+            req.offset.unwrap_or(0) as usize
+        } else {
+            0
+        };
+        let limit = if self.paginate {
+            req.limit.map(|v| v as usize).unwrap_or(usize::MAX)
+        } else {
+            usize::MAX
+        };
+        let databases = self.rows.iter().skip(offset).take(limit).cloned().collect();
+        Box::pin(async {
+            Ok(tonic::Response::new(chroma_proto::ListDatabasesResponse {
+                databases,
+            }))
+        })
+    }
+}
+
+impl UnaryService<chroma_proto::CountDatabasesRequest> for MockSysDb {
+    type Response = chroma_proto::CountDatabasesResponse;
+    type Future = BoxFuture<tonic::Response<Self::Response>, tonic::Status>;
+    fn call(&mut self, _: tonic::Request<chroma_proto::CountDatabasesRequest>) -> Self::Future {
+        *self.counts.lock() += 1;
+        let count = self.rows.len() as u64;
+        Box::pin(async move {
+            Ok(tonic::Response::new(chroma_proto::CountDatabasesResponse {
+                count,
+            }))
+        })
+    }
+}
+
+impl NamedService for MockSysDb {
+    const NAME: &'static str = "chroma.SysDB";
+}
+impl tower::Service<http::Request<Body>> for MockSysDb {
+    type Response = http::Response<Body>;
+    type Error = Infallible;
+    type Future = BoxFuture<Self::Response, Self::Error>;
+    fn poll_ready(&mut self, _: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
+        Poll::Ready(Ok(()))
+    }
+    fn call(&mut self, req: http::Request<Body>) -> Self::Future {
+        let service = self.clone();
+        Box::pin(async move {
+            match req.uri().path() {
+                "/chroma.SysDB/ListDatabases" => {
+                    Ok(tonic::server::Grpc::new(tonic_prost::ProstCodec::<
+                        chroma_proto::ListDatabasesResponse,
+                        chroma_proto::ListDatabasesRequest,
+                    >::default())
+                    .unary(service, req)
+                    .await)
+                }
+                "/chroma.SysDB/CountDatabases" => {
+                    Ok(tonic::server::Grpc::new(tonic_prost::ProstCodec::<
+                        chroma_proto::CountDatabasesResponse,
+                        chroma_proto::CountDatabasesRequest,
+       
```

**File**: `rust/sysdb/src/sysdb.rs` (modified, +49/-56)
```diff
@@ -844,23 +844,17 @@ fn single_region_list_databases_request(
     tenant: String,
     limit: Option<u32>,
     offset: u32,
-    merge_mcmr_results: bool,
 ) -> Result<chroma_proto::ListDatabasesRequest, ListDatabasesError> {
-    let (limit, offset) = if merge_mcmr_results {
-        (None, 0)
-    } else {
-        let limit = limit.map(i32::try_from).transpose().map_err(|_| {
-            ListDatabasesError::InvalidPagination(
-                "limit exceeds the maximum supported value".to_string(),
-            )
-        })?;
-        let offset = i32::try_from(offset).map_err(|_| {
-            ListDatabasesError::InvalidPagination(
-                "offset exceeds the maximum supported value".to_string(),
-            )
-        })?;
-        (limit, offset)
-    };
+    let limit = limit.map(i32::try_from).transpose().map_err(|_| {
+        ListDatabasesError::InvalidPagination(
+            "limit exceeds the maximum supported value".to_string(),
+        )
+    })?;
+    let offset = i32::try_from(offset).map_err(|_| {
+        ListDatabasesError::InvalidPagination(
+            "offset exceeds the maximum supported value".to_string(),
+        )
+    })?;
 
     Ok(chroma_proto::ListDatabasesRequest {
         tenant,
@@ -1134,12 +1128,8 @@ impl GrpcSysDb {
         offset: u32,
     ) -> Result<ListDatabasesResponse, ListDatabasesError> {
         let merge_mcmr_results = self._mcmr_client.is_some();
-        let single_region_req = single_region_list_databases_request(
-            tenant.clone(),
-            limit,
-            offset,
-            merge_mcmr_results,
-        )?;
+        let single_region_req =
+            single_region_list_databases_request(tenant.clone(), limit, offset)?;
         let single_region_dbs: Vec<Database> =
             match self.client.list_databases(single_region_req).await {
                 Ok(resp) => resp
@@ -1159,21 +1149,29 @@ impl GrpcSysDb {
                 Err(err) => return Err(ListDatabasesError::Internal(err.into())),
             };
 
-        // The Go SysDB applies limit and offset in SQL. Return its bounded
-        // result directly when there is no second source to merge.
-        if !merge_mcmr_results {
+        // Always paginate in Go SysDB, including when a secondary SysDB is
+        // configured. A full page needs neither a count nor a secondary read.
+        if !merge_mcmr_results || limit == Some(single_region_dbs.len() as u32) {
             return Ok(single_region_dbs);
         }
 
-        // Early bail-out: if single-region has enough results to satisfy offset + limit
-        if let Some(lim) = limit {
-            let total_needed = offset.saturating_add(lim);
-            if single_region_dbs.len() as u32 >= total_needed {
-                let start = (offset as usize).min(single_region_dbs.len());
-                let end = (start.saturating_add(lim as usize)).min(single_region_dbs.len());
-                return Ok(single_region_dbs[start..end].to_vec());
-            }
-        }
+        // A nonempty partial page reaches the end of the single-region rows,
+        // so continue at the first MCMR row. An empty page may start past that
+        // boundary; count rows instead of transferring them to find its offset.
+        let mcmr_offset = if single_region_dbs.is_empty() && offset > 0 {
+            let count = self
+                .client
+                .count_databases(chroma_proto::CountDatabasesRequest {
+                    tenant: tenant.clone(),
+                })
+                .await
+                .map_err(|err| ListDatabasesError::Internal(err.into()))?
+                .into_inner()
+                .count;
+            u64::from(offset).saturating_sub(count) as usize
+        } else {
+            0
+        };
 
         // Collect databases from MCMR client if available
         // MCMR returns databases with topology prefixes (e.g., "topology+db_name")
@@ -1215,19 +1213,14 @@ impl GrpcSysDb {
                 .unwrap_or("".to_string())
         });
 
-        // Merge results: single-region databases first, then MCMR databases
-        let mut all_dbs = single_region_dbs;
-        all_dbs.extend(mcmr_dbs);
-
-        // Apply offset and limit to the combined results manually
-        let start = (offset as usize).min(all_dbs.len());
-        let end = if let Some(lim) = limit {
-            (start + lim as usize).min(all_dbs.len())
-        } else {
-            all_dbs.len()
-        };
-
-        Ok(all_dbs[start..end].to_vec())
+        // The single-region page already has the caller's offset applied.
+        // Fill its remaining slots from the residual offset in MCMR.
+        let remaining = limit
+            .map(|limit| (limit as usize).saturating_sub(single_region_dbs.len()))
+            .unwrap_or(usize::MAX);
+        let mut page = single_region_dbs;
+        page.extend(mcmr_dbs.into_iter().skip(mcmr_offset).take(remaining));
+        Ok(page)
     }
 
     pub async
```

---

### Incident Patch 2: `bc7a3146` (2026-09-30)
**Commit Message**: [BUG](sysdb): Initialize dimensions atomically (#7764)

## Description of changes

Let SQLite choose the first dimension and reject conflicting writers
within the same transaction. Return the winning dimension through the
frontend without introducing collection or database mutexes.

Test concurrent initialization at the sysdb and frontend boundaries.

## Test plan

CI

## Migration plan

N/A

## Observability plan

N/A

## Documentation Changes

N/A

Co-authored-by: AI

---------

Co-authored-by: dbeglord <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `rust/frontend/src/impls/service_based_frontend.rs` (modified, +86/-3)
```diff
@@ -1216,7 +1216,7 @@ impl ServiceBasedFrontend {
         database_name: DatabaseName,
         collection_id: CollectionUuid,
         dimension: u32,
-    ) -> Result<UpdateCollectionResponse, UpdateCollectionError> {
+    ) -> Result<UpdateCollectionResponse, ValidationError> {
         self.sysdb_client
             .update_collection(
                 Some(database_name),
@@ -1227,7 +1227,12 @@ impl ServiceBasedFrontend {
                 None,
             )
             .await
-            .map_err(|err| Box::new(err) as Box<dyn ChromaError>)?;
+            .map_err(|err| match err {
+                UpdateCollectionError::DimensionMismatch(expected, actual) => {
+                    ValidationError::DimensionMismatch(expected, actual)
+                }
+                err => ValidationError::UpdateCollection(err),
+            })?;
         // Invalidate the cache.
         self.collections_with_segments_provider
             .collections_with_segments_cache
@@ -1248,7 +1253,7 @@ impl ServiceBasedFrontend {
     where
         F: Fn(&Embedding) -> Option<usize>,
     {
-        let collection = self
+        let mut collection = self
             .get_cached_collection_for_tenant(database_name.clone(), collection_id, tenant_id)
             .await?;
         if let Some(embeddings) = option_embeddings {
@@ -1283,6 +1288,7 @@ impl ServiceBasedFrontend {
                             })?;
                         self.set_collection_dimension(database_name, collection_id, emb_dim)
                             .await?;
+                        collection.dimension = Some(emb_dim as i32);
                     }
                 }
             };
@@ -3738,6 +3744,83 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn concurrent_dimension_initialization_rejects_loser_dimension() {
+        let registry = Registry::new();
+        let system = System::new();
+        let config = FrontendConfig::sqlite_in_memory();
+        let mut frontend = ServiceBasedFrontend::try_from_config(&(config, system), &registry)
+            .await
+            .unwrap();
+
+        let database_name =
+            DatabaseName::new("default_database").expect("database name should be valid");
+        let collection = frontend
+            .create_collection(
+                CreateCollectionRequest::try_new(
+                    "default_tenant".to_string(),
+                    database_name.clone(),
+                    "concurrent_dimension".to_string(),
+                    None,
+                    None,
+                    None,
+                    false,
+                )
+                .unwrap(),
+            )
+            .await
+            .unwrap();
+
+        let barrier = Arc::new(tokio::sync::Barrier::new(2));
+        let mut first_frontend = frontend.clone();
+        let mut second_frontend = frontend.clone();
+        let first_barrier = barrier.clone();
+        let second_barrier = barrier.clone();
+        let collection_id = collection.collection_id;
+
+        let first = tokio::spawn(async move {
+            let embeddings = vec![vec![1.0, 2.0]];
+            first_barrier.wait().await;
+            first_frontend
+                .validate_embedding(
+                    "default_tenant",
+                    database_name,
+                    collection_id,
+                    Some(&embeddings),
+                    true,
+                    |embedding: &Vec<f32>| Some(embedding.len()),
+                )
+                .await
+        });
+        let second = tokio::spawn(async move {
+            let embeddings = vec![vec![1.0, 2.0, 3.0]];
+            second_barrier.wait().await;
+            second_frontend
+                .validate_embedding(
+                    "default_tenant",
+                    DatabaseName::new("default_database").expect("database name should be valid"),
+                    collection_id,
+                    Some(&embeddings),
+                    true,
+                    |embedding: &Vec<f32>| Some(embedding.len()),
+                )
+                .await
+        });
+
+        let first = first.await.unwrap();
+        let second = second.await.unwrap();
+        let results = [&first, &second];
+
+        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
+        assert_eq!(
+            results
+                .iter()
+                .filter(|result| matches!(result, Err(ValidationError::DimensionMismatch(_, _))))
+                .count(),
+            1
+        );
+    }
+
     #[tokio::test]
     async fn conditional_commit_disabled_returns_transactions_disabled() {
         let registry = Registry::new();
```

**File**: `rust/sysdb/src/sqlite.rs` (modified, +68/-5)
```diff
@@ -481,6 +481,29 @@ impl SqliteSysDb {
             .await
             .map_err(|e| UpdateCollectionError::Internal(e.into()))?;
 
+        if let Some(dimension) = dimension {
+            // The first writer initializes dimension; later writers must agree.
+            // This statement acquires SQLite's write transaction before reading
+            // the winning dimension, including across frontend instances.
+            let actual: Option<i64> = sqlx::query_scalar(
+                "UPDATE collections SET dimension = COALESCE(dimension, ?)
+                 WHERE id = ? RETURNING dimension",
+            )
+            .bind(i64::from(dimension))
+            .bind(collection_id.to_string())
+            .fetch_optional(&mut *tx)
+            .await
+            .map_err(|e| UpdateCollectionError::Internal(e.into()))?;
+            let actual =
+                actual.ok_or_else(|| UpdateCollectionError::NotFound(collection_id.to_string()))?;
+            if actual != i64::from(dimension) {
+                return Err(UpdateCollectionError::DimensionMismatch(
+                    actual as u32,
+                    dimension,
+                ));
+            }
+        }
+
         let mut configuration_json_str = None;
         let mut schema_str = None;
         if let Some(configuration) = configuration {
@@ -506,7 +529,7 @@ impl SqliteSysDb {
             }
         }
 
-        if name.is_some() || dimension.is_some() {
+        if name.is_some() {
             let mut query = sea_query::Query::update();
             let mut query = query.table(table::Collections::Table).cond_where(
                 sea_query::Expr::col((table::Collections::Table, table::Collections::Id))
@@ -517,10 +540,6 @@ impl SqliteSysDb {
                 query = query.value(table::Collections::Name, name.to_string());
             }
 
-            if let Some(dimension) = dimension {
-                query = query.value(table::Collections::Dimension, dimension);
-            }
-
             let (sql, values) = query.build_sqlx(sea_query::SqliteQueryBuilder);
 
             let result = sqlx::query_with(&sql, values)
@@ -1599,6 +1618,50 @@ mod tests {
         assert_eq!(result.collection_id, collection_id);
     }
 
+    #[tokio::test]
+    async fn dimension_initialization_is_atomic() {
+        let db = get_new_sqlite_db().await;
+        let sysdb = SqliteSysDb::new(db, "default".to_string(), "default".to_string());
+        let id = CollectionUuid::new();
+        sysdb
+            .create_collection(
+                "default_tenant".into(),
+                "default_database".into(),
+                id,
+                "dimension_race".into(),
+                vec![],
+                Some(InternalCollectionConfiguration::default_hnsw()),
+                None,
+                None,
+                None,
+                false,
+            )
+            .await
+            .unwrap();
+        let other = sysdb.clone();
+        let (first, second) = tokio::join!(
+            sysdb.update_collection(id, None, None, Some(2), None),
+            other.update_collection(id, None, None, Some(3), None),
+        );
+        let winner = match (first, second) {
+            (Ok(()), Err(UpdateCollectionError::DimensionMismatch(2, 3))) => 2,
+            (Err(UpdateCollectionError::DimensionMismatch(3, 2)), Ok(())) => 3,
+            results => panic!("expected exactly one winning dimension: {results:?}"),
+        };
+        sysdb
+            .update_collection(id, None, None, Some(winner), None)
+            .await
+            .unwrap();
+        let collections = sysdb
+            .get_collections(GetCollectionsOptions {
+                collection_id: Some(id),
+                ..Default::default()
+            })
+            .await
+            .unwrap();
+        assert_eq!(collections[0].dimension, Some(winner as i32));
+    }
+
     #[tokio::test]
     async fn test_update_collection() {
         let db = get_new_sqlite_db().await;
```

**File**: `rust/types/src/api_types.rs` (modified, +3/-0)
```diff
@@ -1030,6 +1030,8 @@ pub struct UpdateCollectionResponse {}
 pub enum UpdateCollectionError {
     #[error("Collection [{0}] does not exist")]
     NotFound(String),
+    #[error("Collection expecting embedding with dimension of {0}, got {1}")]
+    DimensionMismatch(u32, u32),
     #[error("Metadata reset unsupported")]
     MetadataResetUnsupported,
     #[error("Could not serialize configuration")]
@@ -1048,6 +1050,7 @@ impl ChromaError for UpdateCollectionError {
     fn code(&self) -> ErrorCodes {
         match self {
             UpdateCollectionError::NotFound(_) => ErrorCodes::NotFound,
+            UpdateCollectionError::DimensionMismatch(_, _) => ErrorCodes::InvalidArgument,
             UpdateCollectionError::MetadataResetUnsupported => ErrorCodes::InvalidArgument,
             UpdateCollectionError::Configuration(_) => ErrorCodes::Internal,
             UpdateCollectionError::Internal(err) => err.code(),
```

---

### Incident Patch 3: `8fded366` (2026-09-30)
**Commit Message**: [BUG](segment): Validate HNSW dimensions (#7763)

## Description of changes

Check persisted native dimensions before loading and reject mismatched
queries. Validate complete write batches before mutating the ID map,
tracking only touched IDs instead of cloning the entire collection.

Preserve the legacy sequence migration already present on main.

## Test plan

CI

## Migration plan

N/A

## Observability plan

N/A

## Documentation Changes

N/A

Co-authored-by: AI

---------

Co-authored-by: dbeglord <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `rust/index/src/hnsw.rs` (modified, +129/-1)
```diff
@@ -1,7 +1,7 @@
 use super::{IndexConfig, IndexUuid};
 use chroma_distance::DistanceFunction;
 use chroma_error::{ChromaError, ErrorCodes};
-use std::path::Path;
+use std::{io::Read, mem::size_of, path::Path};
 use thiserror::Error;
 use tracing::instrument;
 
@@ -77,12 +77,70 @@ impl HnswIndexConfig {
     }
 }
 
+fn read_i32(buf: &[u8], offset: &mut usize) -> Option<i32> {
+    let end = offset.checked_add(size_of::<i32>())?;
+    let bytes = buf.get(*offset..end)?;
+    let mut array = [0; size_of::<i32>()];
+    array.copy_from_slice(bytes);
+    *offset = end;
+    Some(i32::from_ne_bytes(array))
+}
+
+fn read_usize(buf: &[u8], offset: &mut usize) -> Option<usize> {
+    let end = offset.checked_add(size_of::<usize>())?;
+    let bytes = buf.get(*offset..end)?;
+    let mut array = [0; size_of::<usize>()];
+    array.copy_from_slice(bytes);
+    *offset = end;
+    Some(usize::from_ne_bytes(array))
+}
+
+pub fn parse_persisted_hnsw_dim(header: &[u8]) -> Option<usize> {
+    let mut offset = 0;
+    let version = read_i32(header, &mut offset)?;
+    if version != 1 {
+        return None;
+    }
+
+    // hnswlib persists native POD fields in order. The vector byte width is
+    // not stored directly, but is exactly the gap between the vector payload
+    // offset and the label offset.
+    let _offset_level0 = read_usize(header, &mut offset)?;
+    let _max_elements = read_usize(header, &mut offset)?;
+    let _cur_element_count = read_usize(header, &mut offset)?;
+    let size_data_per_element = read_usize(header, &mut offset)?;
+    let label_offset = read_usize(header, &mut offset)?;
+    let offset_data = read_usize(header, &mut offset)?;
+
+    let data_size = label_offset.checked_sub(offset_data)?;
+    if data_size == 0 || data_size % size_of::<f32>() != 0 {
+        return None;
+    }
+    if label_offset.checked_add(size_of::<usize>())? > size_data_per_element {
+        return None;
+    }
+    Some(data_size / size_of::<f32>())
+}
+
 pub struct HnswIndex {
     index: hnswlib::HnswIndex,
     pub id: IndexUuid,
     pub distance_function: DistanceFunction,
 }
 
+#[derive(Error, Debug)]
+#[error("Embedding dimensionality {actual} does not match index dimensionality {expected}")]
+struct HnswDimensionMismatch {
+    expected: usize,
+    actual: usize,
+}
+
+impl ChromaError for HnswDimensionMismatch {
+    fn code(&self) -> ErrorCodes {
+        ErrorCodes::InvalidArgument
+    }
+}
+
 #[derive(Error, Debug)]
 #[error(transparent)]
 pub struct WrappedHnswError(#[from] hnswlib::HnswError);
@@ -95,6 +153,10 @@ impl ChromaError for WrappedHnswError {
 
 #[derive(Error, Debug)]
 pub enum WrappedHnswInitError {
+    #[error("Invalid persisted HNSW header")]
+    InvalidHeader,
+    #[error("Could not read persisted HNSW header: {0}")]
+    HeaderIo(#[source] std::io::Error),
     #[error("No config provided")]
     NoConfigProvided,
     #[error(transparent)]
@@ -104,6 +166,9 @@ pub enum WrappedHnswInitError {
 impl ChromaError for WrappedHnswInitError {
     fn code(&self) -> ErrorCodes {
         match self {
+            WrappedHnswInitError::InvalidHeader | WrappedHnswInitError::HeaderIo(_) => {
+                ErrorCodes::DataLoss
+            }
             WrappedHnswInitError::NoConfigProvided => ErrorCodes::InvalidArgument,
             WrappedHnswInitError::Other(_) => ErrorCodes::Internal,
         }
@@ -175,7 +240,20 @@ impl HnswIndex {
         }
     }
 
+    fn validate_vector(&self, vector: &[f32]) -> Result<(), Box<dyn ChromaError>> {
+        let expected = self.dimensionality() as usize;
+        if vector.len() != expected {
+            return Err(HnswDimensionMismatch {
+                expected,
+                actual: vector.len(),
+            }
+            .boxed());
+        }
+        Ok(())
+    }
+
     pub fn add(&self, id: usize, vector: &[f32]) -> Result<(), Box<dyn ChromaError>> {
+        self.validate_vector(vector)?;
         self.index
             .add(id, vector)
             .map_err(|e| WrappedHnswError(e).boxed())
@@ -194,6 +272,7 @@ impl HnswIndex {
         allowed_ids: &[usize],
         disallowed_ids: &[usize],
     ) -> Result<(Vec<usize>, Vec<f32>), Box<dyn ChromaError>> {
+        self.validate_vector(vector)?;
         self.index
             .query(vector, k, allowed_ids, disallowed_ids)
             .map_err(|e| WrappedHnswError(e).boxed())
@@ -219,13 +298,31 @@ impl HnswIndex {
         self.index.save().map_err(|e| WrappedHnswError(e).boxed())
     }
 
+    fn validate_header_dimension(header: &[u8], expected: i32) -> Result<(), Box<dyn ChromaError>> {
+        let actual = parse_persisted_hnsw_dim(header)
+            .ok_or_else(|| WrappedHnswInitError::InvalidHeader.boxed())?;
+        if actual != expected as usize {
+            return Err(HnswDimensionMismatch {
+                expected: expected as usize,
+                actual,
+            }
+            .boxed());
+        }
+        Ok(())
+    }
+
     #[instrument(name = 
```

**File**: `rust/segment/src/local_hnsw.rs` (modified, +378/-9)
```diff
@@ -1,6 +1,7 @@
 use std::{
     collections::{BinaryHeap, HashMap},
     io::Write,
+    mem::size_of,
     path::Path,
     sync::Arc,
 };
@@ -23,6 +24,8 @@ use thiserror::Error;
 
 #[allow(dead_code)]
 const METADATA_FILE: &str = "index_metadata.pickle";
+const HNSW_HEADER_FILE: &str = "header.bin";
+const HNSW_PERSISTENCE_VERSION: i32 = 1;
 
 #[allow(dead_code)]
 #[derive(Clone)]
@@ -52,6 +55,8 @@ pub enum LocalHnswSegmentReaderError {
     GetEmbeddingError,
     #[error("Error querying knn")]
     QueryError,
+    #[error("Persisted HNSW dimensionality {actual} does not match collection dimensionality {expected}")]
+    DimensionalityMismatch { expected: usize, actual: usize },
     #[error("Error reading from sqlite: {0}")]
     SqliteError(#[from] sqlx::error::Error),
     #[error("Error building max sequence id migration query")]
@@ -71,6 +76,7 @@ impl ChromaError for LocalHnswSegmentReaderError {
             LocalHnswSegmentReaderError::IdNotFound => ErrorCodes::Internal,
             LocalHnswSegmentReaderError::GetEmbeddingError => ErrorCodes::Internal,
             LocalHnswSegmentReaderError::QueryError => ErrorCodes::Internal,
+            LocalHnswSegmentReaderError::DimensionalityMismatch { .. } => ErrorCodes::DataLoss,
             LocalHnswSegmentReaderError::SqliteError(_) => ErrorCodes::Internal,
             LocalHnswSegmentReaderError::QueryBuilderError(_) => ErrorCodes::Internal,
         }
@@ -96,6 +102,64 @@ async fn get_current_seq_id(
     Ok(seq_id)
 }
 
+fn read_i32(buf: &[u8], offset: &mut usize) -> Option<i32> {
+    let end = offset.checked_add(size_of::<i32>())?;
+    let bytes = buf.get(*offset..end)?;
+    let mut array = [0; size_of::<i32>()];
+    array.copy_from_slice(bytes);
+    *offset = end;
+    Some(i32::from_ne_bytes(array))
+}
+
+fn read_usize(buf: &[u8], offset: &mut usize) -> Option<usize> {
+    let end = offset.checked_add(size_of::<usize>())?;
+    let bytes = buf.get(*offset..end)?;
+    let mut array = [0; size_of::<usize>()];
+    array.copy_from_slice(bytes);
+    *offset = end;
+    Some(usize::from_ne_bytes(array))
+}
+
+fn parse_persisted_hnsw_dim(header: &[u8]) -> Option<usize> {
+    let mut offset = 0;
+    let version = read_i32(header, &mut offset)?;
+    if version != HNSW_PERSISTENCE_VERSION {
+        return None;
+    }
+
+    // hnswlib persists native POD fields in order. The vector byte width is
+    // not stored directly, but is exactly the gap between the vector payload
+    // offset and the label offset.
+    let _offset_level0 = read_usize(header, &mut offset)?;
+    let _max_elements = read_usize(header, &mut offset)?;
+    let _cur_element_count = read_usize(header, &mut offset)?;
+    let size_data_per_element = read_usize(header, &mut offset)?;
+    let label_offset = read_usize(header, &mut offset)?;
+    let offset_data = read_usize(header, &mut offset)?;
+
+    let data_size = label_offset.checked_sub(offset_data)?;
+    if data_size == 0 || data_size % size_of::<f32>() != 0 {
+        return None;
+    }
+    if label_offset.checked_add(size_of::<usize>())? > size_data_per_element {
+        return None;
+    }
+    Some(data_size / size_of::<f32>())
+}
+
+async fn persisted_hnsw_dim(index_folder: &Path) -> Result<usize, std::io::Error> {
+    use tokio::io::AsyncReadExt;
+    let mut file = tokio::fs::File::open(index_folder.join(HNSW_HEADER_FILE)).await?;
+    let mut header = [0; size_of::<i32>() + 6 * size_of::<usize>()];
+    file.read_exact(&mut header).await?;
+    parse_persisted_hnsw_dim(&header).ok_or_else(|| {
+        std::io::Error::new(
+            std::io::ErrorKind::InvalidData,
+            "invalid persisted HNSW header",
+        )
+    })
+}
+
 impl LocalHnswSegmentReader {
     pub fn from_index(hnsw_index: LocalHnswIndex) -> Self {
         Self { index: hnsw_index }
@@ -134,8 +198,26 @@ impl LocalHnswSegmentReader {
                         .await?
                         .into_std()
                         .await;
-                    let id_map: IdMap = serde_pickle::from_reader(file, DeOptions::new())?;
+                    let mut id_map: IdMap = serde_pickle::from_reader(file, DeOptions::new())?;
                     if !id_map.id_to_label.is_empty() {
+                        if let Some(actual) = id_map.dimensionality {
+                            if actual != dimensionality {
+                                return Err(LocalHnswSegmentReaderError::DimensionalityMismatch {
+                                    expected: dimensionality,
+                                    actual,
+                                });
+                            }
+                        }
+                        let actual = persisted_hnsw_dim(&index_folder)
+                            .await
+                            .map_err(|_| LocalHnswSegmentReaderError::HnswIndexLoadError)?;
+                        if actual != dimensionality {
+                            return Err(LocalHnswSegmentReaderError
```

**File**: `rust/segment/src/test.rs` (modified, +16/-1)
```diff
@@ -46,6 +46,9 @@ pub struct TestDistributedSegment {
     pub metadata_segment: Segment,
     pub record_segment: Segment,
     pub vector_segment: Segment,
+    /// When set, the first compaction that carries an embedding sets the
+    /// collection dimension, as the first write to a real collection does.
+    pub infer_dimension: bool,
 }
 
 impl TestDistributedSegment {
@@ -98,11 +101,21 @@ impl TestDistributedSegment {
             metadata_segment: test_segment(collection_uuid, SegmentScope::METADATA),
             record_segment: test_segment(collection_uuid, SegmentScope::RECORD),
             vector_segment: test_segment(collection_uuid, SegmentScope::VECTOR),
+            infer_dimension: false,
         }
     }
 
     // WARN: The size of the log chunk should not be too large
     pub async fn compact_log(&mut self, logs: Chunk<LogRecord>, next_offset: usize) {
+        if self.infer_dimension {
+            if let Some(embedding) = logs
+                .iter()
+                .find_map(|(log, _)| log.record.embedding.as_ref())
+            {
+                self.collection.dimension = Some(embedding.len() as i32);
+                self.infer_dimension = false;
+            }
+        }
         let materialized_logs = materialize_logs(
             &None,
             logs,
@@ -207,7 +220,9 @@ impl From<&TestDistributedSegment> for CollectionAndSegments {
 
 impl TestDistributedSegment {
     pub async fn new() -> Self {
-        Self::new_with_dimension(128).await
+        let mut segment = Self::new_with_dimension(128).await;
+        segment.infer_dimension = true;
+        segment
     }
 }
 
```

**File**: `rust/worker/src/compactor/compaction_manager.rs` (modified, +2/-2)
```diff
@@ -1121,7 +1121,7 @@ mod tests {
         let tenant_1 = "tenant_1".to_string();
         let collection_1 = Collection {
             name: "collection_1".to_string(),
-            dimension: Some(1),
+            dimension: Some(3),
             tenant: tenant_1.clone(),
             database: "database_1".to_string(),
             log_position: -1,
@@ -1153,7 +1153,7 @@ mod tests {
         let tenant_2 = "tenant_2".to_string();
         let collection_2 = Collection {
             name: "collection_2".to_string(),
-            dimension: Some(1),
+            dimension: Some(3),
             tenant: tenant_2.clone(),
             database: "database_2".to_string(),
             log_position: -1,
```

**File**: `rust/worker/src/execution/orchestration/compact.rs` (modified, +6/-3)
```diff
@@ -1346,7 +1346,8 @@ mod tests {
             .expect("Should be able to initialize dispatcher");
         let dispatcher_handle = system.start_component(dispatcher);
         let mut sysdb = SysDb::Test(TestSysDb::new());
-        let test_segments = TestDistributedSegment::new().await;
+        let test_segments =
+            TestDistributedSegment::new_with_dimension(TEST_EMBEDDING_DIMENSION).await;
         let collection_id = test_segments.collection.collection_id;
         let database_name =
             chroma_types::DatabaseName::new(test_segments.collection.database.clone())
@@ -1639,7 +1640,8 @@ mod tests {
             .expect("Should be able to initialize dispatcher");
         let dispatcher_handle = system.start_component(dispatcher);
         let mut sysdb = SysDb::Test(TestSysDb::new());
-        let test_segments = TestDistributedSegment::new().await;
+        let test_segments =
+            TestDistributedSegment::new_with_dimension(TEST_EMBEDDING_DIMENSION).await;
         let collection_id = test_segments.collection.collection_id;
         let database_name =
             chroma_types::DatabaseName::new(test_segments.collection.database.clone())
@@ -1873,7 +1875,8 @@ mod tests {
             .expect("Should be able to initialize dispatcher");
         let dispatcher_handle = system.start_component(dispatcher);
         let mut sysdb = SysDb::Test(TestSysDb::new());
-        let test_segments = TestDistributedSegment::new().await;
+        let test_segments =
+            TestDistributedSegment::new_with_dimension(TEST_EMBEDDING_DIMENSION).await;
         let collection_id = test_segments.collection.collection_id;
         let collection_for_reader = test_segments.collection.clone();
         let database_name =
```

---

### Incident Patch 4: `fd5a216a` (2026-09-30)
**Commit Message**: [BUG](types): Validate HNSW resource bounds (re-land #7762) (#7825)

## Description of changes

This PR lands the HNSW resource-bounds validation from #7762 on `main`.
#7762 was reviewed and approved, but it merged into its stacked base
branch (`rescrv/security-fixes1`) instead of `main`, so its change is
not on `main` yet. #7761, the branch below it, had already merged to
`main`.

The change is Robert's, unchanged apart from a rebase onto current
`main`:

- **Validate HNSW resource bounds:** creation, updates, schemas and
legacy configuration loading all check index bounds before an index is
built. Invalid persisted data stays recoverable, and its pending vector
log is kept.
- **Bound generated HNSW settings:** the Python property tests generate
HNSW settings within those bounds.

The rest of Robert's security-fixes stack (#7763 and up) is based on
this branch.

## Test plan

CI. Both commits passed review in #7762.

## Migration plan

N/A

## Observability plan

N/A

## Documentation Changes

N/A

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---------

Co-authored-by: Robert Escriva <[REDACTED_EMAIL]>

**File**: `chromadb/test/property/strategies.py` (modified, +33/-12)
```diff
@@ -73,6 +73,11 @@
     "hnsw:M": 128,
 }
 
+HNSW_MAX_EF_CONSTRUCTION = 4096
+HNSW_MAX_EF_SEARCH = 4096
+HNSW_MAX_NEIGHBORS = 128
+HNSW_MAX_SYNC_THRESHOLD = 4096
+
 
 class _TruncatedReprDict(dict):  # type: ignore[type-arg]
     """Dict subclass that truncates its repr to avoid overwhelming output in hypothesis error messages."""
@@ -330,16 +335,20 @@ def vector_index_config_strategy(draw: st.DrawFn) -> VectorIndexConfig:
 
     if index_choice == "hnsw":
         hnsw = HnswIndexConfig(
-            ef_construction=draw(st.integers(min_value=1, max_value=1000))
+            ef_construction=draw(
+                st.integers(min_value=1, max_value=HNSW_MAX_EF_CONSTRUCTION)
+            )
             if draw(st.booleans())
             else None,
-            max_neighbors=draw(st.integers(min_value=1, max_value=1000))
+            max_neighbors=draw(st.integers(min_value=1, max_value=HNSW_MAX_NEIGHBORS))
             if draw(st.booleans())
             else None,
-            ef_search=draw(st.integers(min_value=1, max_value=1000))
+            ef_search=draw(st.integers(min_value=1, max_value=HNSW_MAX_EF_SEARCH))
             if draw(st.booleans())
             else None,
-            sync_threshold=draw(st.integers(min_value=2, max_value=10000))
+            sync_threshold=draw(
+                st.integers(min_value=2, max_value=HNSW_MAX_SYNC_THRESHOLD)
+            )
             if draw(st.booleans())
             else None,
             resize_factor=draw(st.floats(min_value=1.0, max_value=5.0))
@@ -485,17 +494,21 @@ def metadata_with_hnsw_strategy(draw: st.DrawFn) -> Optional[CollectionMetadata]
         metadata["hnsw:space"] = draw(st.sampled_from(["cosine", "l2", "ip"]))
     if draw(st.booleans()):
         metadata["hnsw:construction_ef"] = draw(
-            st.integers(min_value=1, max_value=1000)
+            st.integers(min_value=1, max_value=HNSW_MAX_EF_CONSTRUCTION)
         )
     if draw(st.booleans()):
-        metadata["hnsw:search_ef"] = draw(st.integers(min_value=1, max_value=1000))
+        metadata["hnsw:search_ef"] = draw(
+            st.integers(min_value=1, max_value=HNSW_MAX_EF_SEARCH)
+        )
     if draw(st.booleans()):
-        metadata["hnsw:M"] = draw(st.integers(min_value=1, max_value=1000))
+        metadata["hnsw:M"] = draw(
+            st.integers(min_value=1, max_value=HNSW_MAX_NEIGHBORS)
+        )
     if draw(st.booleans()):
         metadata["hnsw:resize_factor"] = draw(st.floats(min_value=1.0, max_value=5.0))
     if draw(st.booleans()):
         metadata["hnsw:sync_threshold"] = draw(
-            st.integers(min_value=2, max_value=10000)
+            st.integers(min_value=2, max_value=HNSW_MAX_SYNC_THRESHOLD)
         )
 
     return metadata if metadata else None
@@ -534,10 +547,18 @@ def create_configuration_strategy(
         hnsw_config: CreateHNSWConfiguration = {}
         if draw(st.booleans()):
             hnsw_config["space"] = draw(st.sampled_from(["cosine", "l2", "ip"]))
-        hnsw_config["ef_construction"] = draw(st.integers(min_value=1, max_value=1000))
-        hnsw_config["ef_search"] = draw(st.integers(min_value=1, max_value=1000))
-        hnsw_config["max_neighbors"] = draw(st.integers(min_value=1, max_value=1000))
-        hnsw_config["sync_threshold"] = draw(st.integers(min_value=2, max_value=10000))
+        hnsw_config["ef_construction"] = draw(
+            st.integers(min_value=1, max_value=HNSW_MAX_EF_CONSTRUCTION)
+        )
+        hnsw_config["ef_search"] = draw(
+            st.integers(min_value=1, max_value=HNSW_MAX_EF_SEARCH)
+        )
+        hnsw_config["max_neighbors"] = draw(
+            st.integers(min_value=1, max_value=HNSW_MAX_NEIGHBORS)
+        )
+        hnsw_config["sync_threshold"] = draw(
+            st.integers(min_value=2, max_value=HNSW_MAX_SYNC_THRESHOLD)
+        )
         hnsw_config["resize_factor"] = draw(st.floats(min_value=1.0, max_value=5.0))
         configuration["hnsw"] = hnsw_config
     elif config_choice == "spann":
```

**File**: `rust/types/src/collection_configuration.rs` (modified, +39/-4)
```diff
@@ -16,6 +16,7 @@ use crate::{
 use chroma_error::{ChromaError, ErrorCodes};
 use serde::{Deserialize, Serialize};
 use thiserror::Error;
+use validator::Validate;
 
 #[derive(Deserialize, Serialize, Clone, Debug, Copy)]
 pub enum KnnIndex {
@@ -291,6 +292,11 @@ impl InternalCollectionConfiguration {
         match (hnsw, spann) {
             (Some(_), Some(_)) => Err(CollectionConfigurationToInternalConfigurationError::MultipleVectorIndexConfigurations),
             (Some(hnsw), None) => {
+                hnsw.validate().map_err(|err| {
+                    CollectionConfigurationToInternalConfigurationError::HnswParametersFromSegmentError(
+                        HnswParametersFromSegmentError::InvalidParameters(err),
+                    )
+                })?;
                 match default_knn_index {
                     // Create a spann index. Only inherit the space if it exists in the hnsw config or legacy metadata.
                     // This is for backwards compatibility so that users who migrate to distributed
@@ -378,6 +384,11 @@ impl TryFrom<CollectionConfiguration> for InternalCollectionConfiguration {
         match (value.hnsw, value.spann) {
             (Some(_), Some(_)) => Err(Self::Error::MultipleVectorIndexConfigurations),
             (Some(hnsw), None) => {
+                hnsw.validate().map_err(|err| {
+                    CollectionConfigurationToInternalConfigurationError::HnswParametersFromSegmentError(
+                        HnswParametersFromSegmentError::InvalidParameters(err),
+                    )
+                })?;
                 let hnsw: InternalHnswConfiguration = hnsw.into();
                 Ok(InternalCollectionConfiguration {
                     vector_index: hnsw.into(),
@@ -433,6 +444,9 @@ impl TryFrom<&Schema> for InternalCollectionConfiguration {
                     .to_string(),
             ),
             (Some(hnsw_config), None) => {
+                hnsw_config
+                    .validate()
+                    .map_err(|err| format!("Invalid HNSW configuration: {err}"))?;
                 let internal_hnsw = (space.as_ref(), Some(&hnsw_config)).into();
                 Ok(InternalCollectionConfiguration {
                     vector_index: VectorIndexConfiguration::Hnsw(internal_hnsw),
@@ -553,12 +567,15 @@ pub struct InternalUpdateCollectionConfiguration {
 pub enum UpdateCollectionConfigurationToInternalUpdateConfigurationError {
     #[error("Multiple vector index configurations provided")]
     MultipleVectorIndexConfigurations,
+    #[error("Invalid HNSW configuration: {0}")]
+    InvalidHnswParameters(#[from] validator::ValidationErrors),
 }
 
 impl ChromaError for UpdateCollectionConfigurationToInternalUpdateConfigurationError {
     fn code(&self) -> ErrorCodes {
         match self {
             Self::MultipleVectorIndexConfigurations => ErrorCodes::InvalidArgument,
+            Self::InvalidHnswParameters(_) => ErrorCodes::InvalidArgument,
         }
     }
 }
@@ -569,10 +586,13 @@ impl TryFrom<UpdateCollectionConfiguration> for InternalUpdateCollectionConfigur
     fn try_from(value: UpdateCollectionConfiguration) -> Result<Self, Self::Error> {
         match (value.hnsw, value.spann) {
             (Some(_), Some(_)) => Err(Self::Error::MultipleVectorIndexConfigurations),
-            (Some(hnsw), None) => Ok(InternalUpdateCollectionConfiguration {
-                vector_index: Some(UpdateVectorIndexConfiguration::Hnsw(Some(hnsw))),
-                embedding_function: value.embedding_function,
-            }),
+            (Some(hnsw), None) => {
+                hnsw.validate()?;
+                Ok(InternalUpdateCollectionConfiguration {
+                    vector_index: Some(UpdateVectorIndexConfiguration::Hnsw(Some(hnsw))),
+                    embedding_function: value.embedding_function,
+                })
+            }
             (None, Some(spann)) => Ok(InternalUpdateCollectionConfiguration {
                 vector_index: Some(UpdateVectorIndexConfiguration::Spann(Some(spann))),
                 embedding_function: value.embedding_function,
@@ -1080,6 +1100,21 @@ mod tests {
         );
     }
 
+    #[test]
+    fn schema_to_internal_rejects_invalid_hnsw_config() {
+        let mut schema = Schema::new_default(KnnIndex::Hnsw);
+        let hnsw = schema
+            .keys
+            .get_mut(EMBEDDING_KEY)
+            .and_then(|value_types| value_types.float_list.as_mut())
+            .and_then(|float_list| float_list.vector_index.as_mut())
+            .and_then(|vector_index| vector_index.config.hnsw.as_mut())
+            .expect("default HNSW schema should have HNSW config");
+        hnsw.max_neighbors = Some(129);
+
+        assert!(InternalCollectionConfiguration::try_from(&schema).is_err());
+    }
+
     #[cfg(feature = "testing")]
     mod proptests {
         use super::*;
```

**File**: `rust/types/src/collection_schema.rs` (modified, +30/-3)
```diff
@@ -1320,6 +1320,7 @@ impl Schema {
         segment: &Segment,
     ) -> Result<Option<InternalHnswConfiguration>, HnswParametersFromSegmentError> {
         if let Some(config) = self.get_internal_hnsw_config() {
+            config.validate()?;
             let config_from_metadata =
                 InternalHnswConfiguration::from_legacy_segment_metadata(&segment.metadata)?;
 
@@ -2971,20 +2972,24 @@ pub struct VectorIndexConfig {
 #[serde(deny_unknown_fields)]
 pub struct HnswIndexConfig {
     #[serde(skip_serializing_if = "Option::is_none")]
+    #[validate(range(min = 1, max = 4096))]
     pub ef_construction: Option<usize>,
     #[serde(skip_serializing_if = "Option::is_none")]
+    #[validate(range(min = 1, max = 128))]
     pub max_neighbors: Option<usize>,
     #[serde(skip_serializing_if = "Option::is_none")]
+    #[validate(range(min = 1, max = 4096))]
     pub ef_search: Option<usize>,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub num_threads: Option<usize>,
     #[serde(skip_serializing_if = "Option::is_none")]
     #[validate(range(min = 2))]
     pub batch_size: Option<usize>,
     #[serde(skip_serializing_if = "Option::is_none")]
-    #[validate(range(min = 2))]
+    #[validate(range(min = 2, max = 4096))]
     pub sync_threshold: Option<usize>,
     #[serde(skip_serializing_if = "Option::is_none")]
+    #[validate(range(min = 1.0, max = 10.0))]
     pub resize_factor: Option<f64>,
 }
 
@@ -6007,6 +6012,13 @@ mod tests {
         };
         assert!(invalid_sync_threshold.validate().is_err());
 
+        // Invalid: sync_threshold too large (max 4096)
+        let excessive_sync_threshold = HnswIndexConfig {
+            sync_threshold: Some(4097),
+            ..Default::default()
+        };
+        assert!(excessive_sync_threshold.validate().is_err());
+
         // Valid: boundary values (exactly 2) should pass
         let boundary_config = HnswIndexConfig {
             batch_size: Some(2),
@@ -6015,22 +6027,37 @@ mod tests {
         };
         assert!(boundary_config.validate().is_ok());
 
+        let upper_boundary_config = HnswIndexConfig {
+            sync_threshold: Some(4096),
+            ..Default::default()
+        };
+        assert!(upper_boundary_config.validate().is_ok());
+
         // Valid: None values should pass validation
         let all_none_config = HnswIndexConfig {
             ..Default::default()
         };
         assert!(all_none_config.validate().is_ok());
 
-        // Valid: fields without validation can be any value
+        // Valid: bounded HNSW fields accept values inside their resource limits
         let other_fields_config = HnswIndexConfig {
             ef_construction: Some(1),
             max_neighbors: Some(1),
             ef_search: Some(1),
             num_threads: Some(1),
-            resize_factor: Some(0.1),
+            resize_factor: Some(1.0),
             ..Default::default()
         };
         assert!(other_fields_config.validate().is_ok());
+
+        let excessive_config = HnswIndexConfig {
+            ef_construction: Some(4097),
+            max_neighbors: Some(129),
+            ef_search: Some(4097),
+            resize_factor: Some(10.1),
+            ..Default::default()
+        };
+        assert!(excessive_config.validate().is_err());
     }
 
     #[test]
```

**File**: `rust/types/src/hnsw_configuration.rs` (modified, +14/-3)
```diff
@@ -79,18 +79,22 @@ pub fn default_space() -> Space {
 pub struct InternalHnswConfiguration {
     #[serde(default = "default_space")]
     pub space: Space,
+    #[validate(range(min = 1, max = 4096))]
     #[serde(default = "default_construction_ef")]
     pub ef_construction: usize,
+    #[validate(range(min = 1, max = 4096))]
     #[serde(default = "default_search_ef")]
     pub ef_search: usize,
+    #[validate(range(min = 1, max = 128))]
     #[serde(default = "default_m")]
     pub max_neighbors: usize,
     #[serde(default = "default_num_threads")]
     #[serde(skip_serializing)]
     pub num_threads: usize,
+    #[validate(range(min = 1.0, max = 10.0))]
     #[serde(default = "default_resize_factor")]
     pub resize_factor: f64,
-    #[validate(range(min = 2))]
+    #[validate(range(min = 2, max = 4096))]
     #[serde(default = "default_sync_threshold")]
     pub sync_threshold: usize,
     #[validate(range(min = 2))]
@@ -147,13 +151,17 @@ impl From<(Option<&Space>, Option<&HnswIndexConfig>)> for InternalHnswConfigurat
 #[cfg_attr(feature = "pyo3", pyo3::pyclass)]
 pub struct HnswConfiguration {
     pub space: Option<Space>,
+    #[validate(range(min = 1, max = 4096))]
     pub ef_construction: Option<usize>,
+    #[validate(range(min = 1, max = 4096))]
     pub ef_search: Option<usize>,
+    #[validate(range(min = 1, max = 128))]
     pub max_neighbors: Option<usize>,
     #[serde(skip_serializing)]
     pub num_threads: Option<usize>,
+    #[validate(range(min = 1.0, max = 10.0))]
     pub resize_factor: Option<f64>,
-    #[validate(range(min = 2))]
+    #[validate(range(min = 2, max = 4096))]
     pub sync_threshold: Option<usize>,
     #[validate(range(min = 2))]
     #[serde(skip_serializing)]
@@ -253,11 +261,14 @@ impl InternalHnswConfiguration {
 #[serde(deny_unknown_fields)]
 #[cfg_attr(feature = "pyo3", pyo3::pyclass)]
 pub struct UpdateHnswConfiguration {
+    #[validate(range(min = 1, max = 4096))]
     pub ef_search: Option<usize>,
+    #[validate(range(min = 1, max = 128))]
     pub max_neighbors: Option<usize>,
     pub num_threads: Option<usize>,
+    #[validate(range(min = 1.0, max = 10.0))]
     pub resize_factor: Option<f64>,
-    #[validate(range(min = 2))]
+    #[validate(range(min = 2, max = 4096))]
     pub sync_threshold: Option<usize>,
     #[validate(range(min = 2))]
     pub batch_size: Option<usize>,
```

**File**: `rust/types/src/strategies.rs` (modified, +1/-1)
```diff
@@ -589,7 +589,7 @@ pub fn internal_hnsw_configuration_strategy() -> impl Strategy<Value = InternalH
         1usize..=256,
         1usize..=64,
         1usize..=32,
-        prop_oneof![Just(0.5f64), Just(1.0f64), Just(1.5f64), Just(2.0f64)],
+        prop_oneof![Just(1.0f64), Just(1.5f64), Just(2.0f64)],
         2usize..=4096,
         2usize..=4096,
     )
```

**File**: `rust/types/src/validators.rs` (modified, +38/-1)
```diff
@@ -8,7 +8,7 @@ use regex::Regex;
 use std::collections::HashMap;
 use std::str::FromStr;
 use std::{net::IpAddr, sync::LazyLock};
-use validator::ValidationError;
+use validator::{Validate, ValidationError};
 
 static ALNUM_RE: LazyLock<Regex> = LazyLock::new(|| {
     Regex::new(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{1, 510}[a-zA-Z0-9]$")
@@ -278,6 +278,28 @@ pub fn validate_schema(schema: &Schema) -> Result<(), ValidationError> {
     {
         return Err(ValidationError::new("schema").with_message("Full text search / regular expression index cannot be enabled by default. It can only be enabled on #document field.".into()));
     }
+
+    for value_types in std::iter::once(&schema.defaults).chain(schema.keys.values()) {
+        if let Some(vector_index) = value_types
+            .float_list
+            .as_ref()
+            .and_then(|vt| vt.vector_index.as_ref())
+        {
+            if let Some(hnsw) = &vector_index.config.hnsw {
+                hnsw.validate().map_err(|err| {
+                    ValidationError::new("schema")
+                        .with_message(format!("Invalid HNSW configuration: {err}").into())
+                })?;
+            }
+            if let Some(spann) = &vector_index.config.spann {
+                spann.validate().map_err(|err| {
+                    ValidationError::new("schema")
+                        .with_message(format!("Invalid SPANN configuration: {err}").into())
+                })?;
+            }
+        }
+    }
+
     for (key, config) in &schema.keys {
         // Validate that keys cannot start with # (except system keys)
         if key.starts_with('#') && key != DOCUMENT_KEY && key != EMBEDDING_KEY {
@@ -403,6 +425,21 @@ mod tests {
         assert!(validate_name("").is_err());
     }
 
+    #[test]
+    fn invalid_hnsw_schema_config_is_rejected() {
+        let mut schema = crate::Schema::new_default(crate::KnnIndex::Hnsw);
+        let hnsw = schema
+            .keys
+            .get_mut(EMBEDDING_KEY)
+            .and_then(|value_types| value_types.float_list.as_mut())
+            .and_then(|float_list| float_list.vector_index.as_mut())
+            .and_then(|vector_index| vector_index.config.hnsw.as_mut())
+            .expect("default HNSW schema should have HNSW config");
+        hnsw.max_neighbors = Some(129);
+
+        assert!(validate_schema(&schema).is_err());
+    }
+
     #[test]
     fn invalid_simple_name_bad_start_or_end() {
         assert!(validate_name("_abc").is_err());
```

---

### Incident Patch 5: `9974adf4` (2026-09-30)
**Commit Message**: [BUG](types): Bound filter nesting depth (#7761)

## Description of changes

Reject filters deeper than 64 levels before recursive parsing can
exhaust the stack. Cover the accepted boundary and rejection for both
metadata and document filters.

## Test plan

CI

## Migration plan

N/A

## Observability plan

N/A

## Documentation Changes

N/A

Co-authored-by: AI

**File**: `rust/types/src/where_parsing.rs` (modified, +56/-4)
```diff
@@ -9,6 +9,8 @@ use serde::Serialize;
 use serde_json::Value;
 use thiserror::Error;
 
+const MAX_WHERE_RECURSION_DEPTH: usize = 64;
+
 #[derive(Default, Deserialize, Debug, Clone, Serialize)]
 #[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
 pub struct RawWhereFields {
@@ -96,6 +98,16 @@ impl RawWhereFields {
 }
 
 pub fn parse_where_document(json_payload: &Value) -> Result<Where, WhereValidationError> {
+    parse_where_document_with_depth(json_payload, 0)
+}
+
+fn parse_where_document_with_depth(
+    json_payload: &Value,
+    depth: usize,
+) -> Result<Where, WhereValidationError> {
+    if depth > MAX_WHERE_RECURSION_DEPTH {
+        return Err(WhereValidationError::WhereDocumentClause);
+    }
     let where_doc_payload = json_payload
         .as_object()
         .ok_or(WhereValidationError::WhereDocumentClause)?;
@@ -113,7 +125,7 @@ pub fn parse_where_document(json_payload: &Value) -> Result<Where, WhereValidati
         let mut predicate_list = vec![];
         // Recursively parse the children.
         for child in children {
-            predicate_list.push(parse_where_document(child)?);
+            predicate_list.push(parse_where_document_with_depth(child, depth + 1)?);
         }
         return Ok(Where::Composite(CompositeExpression {
             operator: logical_operator,
@@ -129,7 +141,7 @@ pub fn parse_where_document(json_payload: &Value) -> Result<Where, WhereValidati
         let mut predicate_list = vec![];
         // Recursively parse the children.
         for child in children {
-            predicate_list.push(parse_where_document(child)?);
+            predicate_list.push(parse_where_document_with_depth(child, depth + 1)?);
         }
         return Ok(Where::Composite(CompositeExpression {
             operator: logical_operator,
@@ -170,6 +182,16 @@ fn parse_contains_operator(operator: &str) -> Option<ContainsOperator> {
 }
 
 pub fn parse_where(json_payload: &Value) -> Result<Where, WhereValidationError> {
+    parse_where_with_depth(json_payload, 0)
+}
+
+fn parse_where_with_depth(
+    json_payload: &Value,
+    depth: usize,
+) -> Result<Where, WhereValidationError> {
+    if depth > MAX_WHERE_RECURSION_DEPTH {
+        return Err(WhereValidationError::WhereClause);
+    }
     let where_payload = json_payload
         .as_object()
         .ok_or(WhereValidationError::WhereClause)?;
@@ -185,7 +207,7 @@ pub fn parse_where(json_payload: &Value) -> Result<Where, WhereValidationError>
         let mut predicate_list = vec![];
         // Recursively parse the children.
         for child in children {
-            predicate_list.push(parse_where(child)?);
+            predicate_list.push(parse_where_with_depth(child, depth + 1)?);
         }
         return Ok(Where::Composite(CompositeExpression {
             operator: logical_operator,
@@ -199,7 +221,7 @@ pub fn parse_where(json_payload: &Value) -> Result<Where, WhereValidationError>
         let mut predicate_list = vec![];
         // Recursively parse the children.
         for child in children {
-            predicate_list.push(parse_where(child)?);
+            predicate_list.push(parse_where_with_depth(child, depth + 1)?);
         }
         return Ok(Where::Composite(CompositeExpression {
             operator: logical_operator,
@@ -937,4 +959,34 @@ mod tests {
             );
         }
     }
+
+    #[test]
+    fn test_parse_where_rejects_excessive_depth() {
+        let mut payload = json!({"key": "value"});
+        for _ in 0..MAX_WHERE_RECURSION_DEPTH {
+            payload = json!({"$or": [payload]});
+        }
+
+        assert!(parse_where(&payload).is_ok());
+        payload = json!({"$and": [payload]});
+        assert!(matches!(
+            parse_where(&payload),
+            Err(WhereValidationError::WhereClause)
+        ));
+    }
+
+    #[test]
+    fn test_parse_where_document_rejects_excessive_depth() {
+        let mut payload = json!({"$contains": "value"});
+        for _ in 0..MAX_WHERE_RECURSION_DEPTH {
+            payload = json!({"$and": [payload]});
+        }
+
+        assert!(parse_where_document(&payload).is_ok());
+        payload = json!({"$or": [payload]});
+        assert!(matches!(
+            parse_where_document(&payload),
+            Err(WhereValidationError::WhereDocumentClause)
+        ));
+    }
 }
```

---

### Incident Patch 6: `e063772b` (2026-09-30)
**Commit Message**: [BUG](gc): Discover RLS nodes from memberlist (#7823)

Dirty-log GC now discovers RLS nodes from the existing RLS memberlist
instead of scanning persisted dirty-log manifests. Manifests can outlive
their pods after a scale-down, causing GC to try nonexistent nodes such
as `rust-log-service-16`.

GC defers when the memberlist is empty. Cleanup is limited to 10
concurrent members, and a member failure no longer cancels cleanup for
other members. Failures are logged per member with a summary of the run.
Retired nodes’ stored logs remain untouched.

Validation: seven dirty-log GC tests (including MinIO-backed tests), six
memberlist tests, formatting, and commit hooks passed.

Safety follow-up: a separate overlapping-run test reproduced a
pre-existing WAL GC race in which phase three can reload a newer garbage
generation before its phase two completes. This PR does not fix that
race; the passing tests above do not establish safety against
overlapping runs.

**File**: `rust/garbage_collector/src/operators/truncate_dirty_log.rs` (modified, +272/-103)
```diff
@@ -1,31 +1,32 @@
-use std::sync::Arc;
+use std::{future::Future, sync::Arc};
 
 use async_trait::async_trait;
 use chroma_error::{ChromaError, ErrorCodes};
 use chroma_log::Log;
 use chroma_storage::Storage;
 use chroma_system::{Operator, OperatorType};
-use futures::future::try_join_all;
+use futures::{stream, StreamExt};
 use thiserror::Error;
 use wal3::{
     create_s3_factories, FragmentSeqNo, GarbageCollectionOptions, GarbageCollector, LogPosition,
     LogReaderOptions, LogWriterOptions, S3FragmentManagerFactory, S3ManifestManagerFactory,
 };
 
+const DIRTY_LOG_GC_CONCURRENCY: usize = 10;
+
 #[derive(Clone, Debug)]
 pub struct TruncateDirtyLogOperator {
     pub storage: Storage,
     pub logs: Log,
 }
 
 pub type TruncateDirtyLogInput = ();
-
 pub type TruncateDirtyLogOutput = ();
 
 #[derive(Debug, Error)]
 pub enum TruncateDirtyLogError {
-    #[error("No log service found")]
-    NoLogServiceFound,
+    #[error("Dirty log GC failed for {failed} of {total} members")]
+    PartialFailure { failed: usize, total: usize },
     #[error(transparent)]
     Wal3(#[from] wal3::Error),
     #[error(transparent)]
@@ -38,6 +39,110 @@ impl ChromaError for TruncateDirtyLogError {
     }
 }
 
+#[derive(Debug, PartialEq)]
+enum DirtyLogGcOutcome {
+    Collected,
+    Skipped,
+}
+
+// Drain every result before reporting failure so one unavailable member cannot
+// cancel another member's in-flight GC. Bound storage work as well as RPCs.
+async fn collect_dirty_logs<F, Fut>(
+    members: Vec<String>,
+    collect: F,
+) -> Result<(), TruncateDirtyLogError>
+where
+    F: Fn(String) -> Fut,
+    Fut: Future<Output = Result<DirtyLogGcOutcome, TruncateDirtyLogError>>,
+{
+    if members.is_empty() {
+        tracing::info!("No log service members available; deferring dirty log GC");
+        return Ok(());
+    }
+    let total = members.len();
+    let mut results = stream::iter(members.into_iter().map(|member_id| {
+        let future = collect(member_id.clone());
+        async move { (member_id, future.await) }
+    }))
+    .buffer_unordered(DIRTY_LOG_GC_CONCURRENCY);
+    let (mut succeeded, mut skipped, mut failed) = (0, 0, 0);
+    while let Some((member_id, result)) = results.next().await {
+        match result {
+            Ok(DirtyLogGcOutcome::Collected) => succeeded += 1,
+            Ok(DirtyLogGcOutcome::Skipped) => skipped += 1,
+            Err(error) => {
+                failed += 1;
+                tracing::error!(%member_id, %error, "Unable to garbage collect dirty log");
+            }
+        }
+    }
+    tracing::info!(total, succeeded, skipped, failed, "Finished dirty log GC");
+    if failed > 0 {
+        return Err(TruncateDirtyLogError::PartialFailure { failed, total });
+    }
+    Ok(())
+}
+
+impl TruncateDirtyLogOperator {
+    async fn collect_member<Fut>(
+        &self,
+        member_id: &str,
+        phase2: Fut,
+    ) -> Result<DirtyLogGcOutcome, TruncateDirtyLogError>
+    where
+        Fut: Future<Output = Result<(), chroma_log::GarbageCollectError>>,
+    {
+        let options = LogWriterOptions::default();
+        let (fragment_factory, manifest_factory) = create_s3_factories(
+            options.clone(),
+            LogReaderOptions::default(),
+            Arc::new(self.storage.clone()),
+            format!("dirty-{member_id}"),
+            "garbage collection service".to_string(),
+            Arc::new(()),
+            Arc::new(()),
+        );
+        let writer = match GarbageCollector::<
+            (FragmentSeqNo, LogPosition),
+            S3FragmentManagerFactory,
+            S3ManifestManagerFactory,
+        >::open(options, fragment_factory, manifest_factory)
+        .await
+        {
+            Ok(writer) => writer,
+            // A newly joined member may not have initialized its dirty log yet.
+            Err(wal3::Error::UninitializedLog) => return Ok(DirtyLogGcOutcome::Skipped),
+            Err(error) => return Err(error.into()),
+        };
+        let options = GarbageCollectionOptions::default();
+        let gc_state = match writer
+            .garbage_collect_phase1_compute_garbage(&options, None)
+            .await
+        {
+            Ok(Some(state)) => state,
+            Ok(None) => return Ok(DirtyLogGcOutcome::Skipped),
+            Err(wal3::Error::NoSuchCursor(_)) => {
+                tracing::warn!(%member_id, "Dirty log has no cursor; skipping GC");
+                return Ok(DirtyLogGcOutcome::Skipped);
+            }
+            Err(error) => return Err(error.into()),
+        };
+        // Never delete fragments unless the owner successfully updates its manifest.
+        phase2.await?;
+        match writer
+            .garbage_collect_phase3_delete_garbage(&options, &gc_state)
+            .await
+        {
+            Ok(()) => Ok(DirtyLogGcOutcome::Collected),
+            Err(wal3::Error::NoSuchCursor(_)) => {
+                tracing::warn!(%member_id, "Dirty log has no cursor; skipping GC");
+  
```

**File**: `rust/log/src/grpc_log.rs` (modified, +21/-17)
```diff
@@ -781,29 +781,33 @@ impl GrpcLog {
         Ok(())
     }
 
+    /// Dirty logs belong to member IDs, not Kubernetes nodes or collection assignments.
+    pub fn dirty_log_members(&self) -> Vec<String> {
+        self.client_assigner.member_ids()
+    }
+
     pub async fn garbage_collect_phase2_for_dirty_log(
         &mut self,
-        ordinal: u64,
+        member_id: &str,
     ) -> Result<(), GarbageCollectError> {
-        // NOTE(rescrv): Use a raw LogServiceClient so we can open by stateful set ordinal.
+        // NOTE(rescrv): Use a raw LogServiceClient so we can open by StatefulSet member ID.
         let port = self.config.port;
-        let endpoint_res = match Endpoint::from_shared(format!(
-            "grpc://rust-log-service-{ordinal}.rust-log-service:{port}"
-        )) {
-            Ok(endpoint) => endpoint,
-            Err(e) => {
-                return Err(GarbageCollectError::Resolution(format!(
-                    "could not connect to rust-log-service-{ordinal}:{port}: {}",
-                    e
-                )));
-            }
-        };
+        let endpoint_res =
+            match Endpoint::from_shared(format!("grpc://{member_id}.rust-log-service:{port}")) {
+                Ok(endpoint) => endpoint,
+                Err(e) => {
+                    return Err(GarbageCollectError::Resolution(format!(
+                        "could not connect to {member_id}:{port}: {}",
+                        e
+                    )));
+                }
+            };
         let endpoint_res = endpoint_res
             .connect_timeout(Duration::from_millis(self.config.connect_timeout_ms))
             .timeout(Duration::from_millis(self.config.request_timeout_ms));
         let channel = endpoint_res.connect().await.map_err(|err| {
             GarbageCollectError::Resolution(format!(
-                "could not connect to rust-log-service-{ordinal}:{port}: {}",
+                "could not connect to {member_id}:{port}: {}",
                 err
             ))
         })?;
@@ -813,9 +817,9 @@ impl GrpcLog {
         let mut log = LogServiceClient::new(channel);
         log.garbage_collect_phase2(chroma_proto::GarbageCollectPhase2Request {
             log_to_collect: Some(
-                chroma_proto::garbage_collect_phase2_request::LogToCollect::DirtyLog(format!(
-                    "rust-log-service-{ordinal}"
-                )),
+                chroma_proto::garbage_collect_phase2_request::LogToCollect::DirtyLog(
+                    member_id.to_string(),
+                ),
             ),
             database_name: "ignored".to_string(),
         })
```

**File**: `rust/log/src/log.rs` (modified, +10/-2)
```diff
@@ -441,12 +441,20 @@ impl Log {
         }
     }
 
+    /// Current dirty-log owners. An empty snapshot means GC should defer this run.
+    pub fn dirty_log_members(&self) -> Vec<String> {
+        match self {
+            Log::Grpc(log) => log.dirty_log_members(),
+            Log::Sqlite(_) | Log::InMemory(_) => Vec::new(),
+        }
+    }
+
     pub async fn garbage_collect_phase2_for_dirty_log(
         &mut self,
-        ordinal: u64,
+        member_id: &str,
     ) -> Result<(), GarbageCollectError> {
         match self {
-            Log::Grpc(log) => log.garbage_collect_phase2_for_dirty_log(ordinal).await,
+            Log::Grpc(log) => log.garbage_collect_phase2_for_dirty_log(member_id).await,
             Log::Sqlite(_) => Err(GarbageCollectError::Unimplemented),
             Log::InMemory(_) => Ok(()),
         }
```

**File**: `rust/memberlist/src/client_manager.rs` (modified, +28/-0)
```diff
@@ -201,6 +201,11 @@ where
         self.node_name_to_client.read().is_empty()
     }
 
+    /// Snapshot the member IDs from the latest memberlist, independent of node names.
+    pub fn member_ids(&self) -> Vec<String> {
+        self.member_id_to_node_name.read().keys().cloned().collect()
+    }
+
     pub fn node_name_for_member_id(&self, member_id: &str) -> Option<String> {
         self.member_id_to_node_name.read().get(member_id).cloned()
     }
@@ -716,6 +721,29 @@ mod test {
         assert!(assigner.client_for_node("missing").is_none());
     }
 
+    #[test]
+    fn member_ids_follow_membership_instead_of_node_names() {
+        let assigner: ClientAssigner<String> = ClientAssigner::new(
+            Box::new(chroma_config::assignment::assignment_policy::RendezvousHashingAssignmentPolicy::default()),
+            1,
+            vec![],
+        );
+        assert!(assigner.member_ids().is_empty());
+        {
+            let mut members = assigner.member_id_to_node_name.write();
+            members.insert("rust-log-service-0".into(), "node-a".into());
+            members.insert("rust-log-service-16".into(), "node-b".into());
+        }
+        let mut members = assigner.member_ids();
+        members.sort();
+        assert_eq!(members, vec!["rust-log-service-0", "rust-log-service-16"]);
+        assigner
+            .member_id_to_node_name
+            .write()
+            .remove("rust-log-service-16");
+        assert_eq!(assigner.member_ids(), vec!["rust-log-service-0"]);
+    }
+
     #[test]
     fn test_members_for_tier() {
         let assigner: ClientAssigner<String> = ClientAssigner::new(
```

---

### Incident Patch 7: `677019a1` (2026-09-30)
**Commit Message**: [BUG](gc): Find soft-deleted manual GC targets (#7822)

## Description of changes

Manual GC of a soft-deleted collection accepts the request but can leave
the collection and its versions behind. The initial lookup includes
soft-deleted collections, while `get_collection_to_gc` hides them. The
scheduler interprets that empty result as `NoSuchCollection` and selects
the log-only cleanup fallback.

Include soft-deleted collections in the GC lookup so they reach the
normal collection/version cleanup path. Truly absent collections retain
the existing fallback behavior. Grace-period checks remain in the normal
GC path.

Reproduced against a production collection: the manual request completed
log-only cleanup, while a subsequent read-only SysDB query still showed
the soft-deleted row with two versions. Read-only GetCollections calls
returned an empty response with `include_soft_deleted=false` and the
collection with `true`.

This fix is independent of the scheduling reservation in #7821.

## Test plan

- Added a local SysDB gRPC integration regression covering live lookup,
database soft deletion, ordinary lookup hiding the collection, GC lookup
finding it, and missing/hard-deleted target

**File**: `rust/sysdb/src/sysdb.rs` (modified, +98/-0)
```diff
@@ -1882,6 +1882,9 @@ impl GrpcSysDb {
         let mut collections = self
             .get_collections(GetCollectionsOptions {
                 collection_id: Some(collection_id),
+                // Soft-deleted collections still need full GC. Hiding them here
+                // incorrectly sends manual requests to the log-only fallback.
+                include_soft_deleted: true,
                 ..Default::default()
             })
             .await
@@ -3262,6 +3265,101 @@ mod tests {
 
     use super::*;
 
+    #[tokio::test]
+    async fn test_k8s_integration_gc_lookup_soft_deleted_collection() {
+        let mut sysdb = GrpcSysDb::try_from_config(
+            &(
+                GrpcSysDbConfig {
+                    host: "localhost".to_string(),
+                    port: 50051,
+                    connect_timeout_ms: 5000,
+                    request_timeout_ms: 10000,
+                    num_channels: 1,
+                },
+                None,
+            ),
+            &Registry::new(),
+        )
+        .await
+        .unwrap();
+        let tenant = format!("gc-lookup-{}", Uuid::new_v4());
+        let database = "gc-lookup".to_string();
+        let id = CollectionUuid::new();
+        sysdb
+            .client
+            .create_tenant(chroma_proto::CreateTenantRequest {
+                name: tenant.clone(),
+            })
+            .await
+            .unwrap();
+        sysdb
+            .client
+            .create_database(chroma_proto::CreateDatabaseRequest {
+                id: Uuid::new_v4().to_string(),
+                name: database.clone(),
+                tenant: tenant.clone(),
+            })
+            .await
+            .unwrap();
+        sysdb
+            .client
+            .create_collection(chroma_proto::CreateCollectionRequest {
+                id: id.to_string(),
+                name: "gc-lookup".to_string(),
+                configuration_json_str: "{}".to_string(),
+                tenant: tenant.clone(),
+                database: database.clone(),
+                ..Default::default()
+            })
+            .await
+            .unwrap();
+
+        assert_eq!(sysdb.get_collection_to_gc(id).await.unwrap().id, id);
+        assert!(matches!(
+            sysdb.get_collection_to_gc(CollectionUuid::new()).await,
+            Err(GetCollectionsToGcError::NoSuchCollection)
+        ));
+
+        // Reproduce manual GC on a collection inside a soft-deleted database.
+        sysdb
+            .client
+            .delete_database(chroma_proto::DeleteDatabaseRequest {
+                name: database.clone(),
+                tenant: tenant.clone(),
+            })
+            .await
+            .unwrap();
+        let ordinary_lookup = sysdb
+            .get_collections(GetCollectionsOptions {
+                collection_id: Some(id),
+                ..Default::default()
+            })
+            .await
+            .unwrap();
+        assert!(ordinary_lookup.is_empty());
+
+        let candidate = sysdb
+            .get_collection_to_gc(id)
+            .await
+            .expect("soft-deleted collections must reach full GC, not log-only cleanup");
+        assert_eq!(candidate.id, id);
+        assert_eq!(candidate.tenant, tenant);
+
+        sysdb
+            .client
+            .finish_collection_deletion(chroma_proto::FinishCollectionDeletionRequest {
+                id: id.to_string(),
+                tenant,
+                database: candidate.database.into_string(),
+            })
+            .await
+            .unwrap();
+        assert!(matches!(
+            sysdb.get_collection_to_gc(id).await,
+            Err(GetCollectionsToGcError::NoSuchCollection)
+        ));
+    }
+
     #[test]
     fn flush_compaction_error() {
         let fce = FlushCompactionError::FailedToFlushCompaction(Status::failed_precondition(
```

---

### Incident Patch 8: `da4f68be` (2026-09-24)
**Commit Message**: [BUG](sysdb): Return segment row read errors (#7785)

A failed metadata read must fail its request without crashing the
database metadata service. In staging, the compactor has a one-second
metadata request timeout. A matching request runs for 1,001.65 ms and
fails at the same instant the server logs a canceled first-row scan. The
canceled read leaves the first segment unset; continuing after that
error dereferences a nil pointer and terminates the Go sysdb process.
Other requests then fail while the service restarts.

Return immediately when scanning a segment row fails, and check for
errors after row iteration. Both paths return no partial results. This
prevents the crash; it does not change request timeouts or resolve the
source of the cancellation.

Validation: four regression cases cover first-row and later-row scan and
iteration failures. The first-row scan case reproduces the panic before
the fix. The regression tests and existing PostgreSQL-backed segment
tests pass with race detection.

**File**: `go/go.mod` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ toolchain go1.23.10
 
 require (
 	ariga.io/atlas-provider-gorm v0.3.1
+	github.com/DATA-DOG/go-sqlmock v1.5.2
 	github.com/aws/aws-sdk-go-v2 v1.36.3
 	github.com/aws/aws-sdk-go-v2/config v1.28.6
 	github.com/aws/aws-sdk-go-v2/credentials v1.17.47
```

**File**: `go/go.sum` (modified, +3/-0)
```diff
@@ -27,6 +27,8 @@ github.com/AzureAD/microsoft-authentication-library-for-go v1.0.0/go.mod h1:kgDm
 github.com/AzureAD/microsoft-authentication-library-for-go v1.1.0 h1:HCc0+LpPfpCKs6LGGLAhwBARt9632unrVcI6i8s/8os=
 github.com/AzureAD/microsoft-authentication-library-for-go v1.1.0/go.mod h1:wP83P5OoQ5p6ip3ScPr0BAq0BvuPAvacpEuSzyouqAI=
 github.com/BurntSushi/toml v0.3.1/go.mod h1:xHWCNGjB5oqiDr8zfno3MHue2Ht5sIBksp03qcyfWMU=
+github.com/DATA-DOG/go-sqlmock v1.5.2 h1:OcvFkGmslmlZibjAjaHm3L//6LiuBgolP7OputlJIzU=
+github.com/DATA-DOG/go-sqlmock v1.5.2/go.mod h1:88MAG/4G7SMwSE3CeA0ZKzrT5CiOU3OJ+JlNzwDqpNU=
 github.com/Microsoft/go-winio v0.6.1 h1:9/kr64B9VUZrLm5YYwbGtUJnMgqWVOdUAXu6Migciow=
 github.com/Microsoft/go-winio v0.6.1/go.mod h1:LRdKpFKfdobln8UmuiYcKPot9D2v6svN5+sAH+4kjUM=
 github.com/Microsoft/hcsshim v0.11.4 h1:68vKo2VN8DE9AdN4tnkWnmdhqdbpUFM8OF3Airm7fz8=
@@ -189,6 +191,7 @@ github.com/json-iterator/go v1.1.12 h1:PV8peI4a0ysnczrg+LtxykD8LfKY9ML6u2jnxaEnr
 github.com/json-iterator/go v1.1.12/go.mod h1:e30LSqwooZae/UwlEbR2852Gd8hjQvJoHmT4TnhNGBo=
 github.com/kisielk/errcheck v1.5.0/go.mod h1:pFxgyoBC7bSaBwPgfKdkLd5X25qrDl4LWUI2bnpBCr8=
 github.com/kisielk/gotool v1.0.0/go.mod h1:XhKaO+MFFWcvkIS/tQcRk01m1F5IRFswLeQ+oQHNcck=
+github.com/kisielk/sqlstruct v0.0.0-20201105191214-5f3e10d3ab46/go.mod h1:yyMNCyc/Ib3bDTKd379tNMpB/7/H5TjM2Y9QJ5THLbE=
 github.com/klauspost/compress v1.16.0 h1:iULayQNOReoYUe+1qtKOqw9CwJv3aNQu8ivo7lw1HU4=
 github.com/klauspost/compress v1.16.0/go.mod h1:ntbaceVETuRiXiv4DpjP66DpAtAGkEQskQzEyD//IeE=
 github.com/kr/pretty v0.1.0/go.mod h1:dAy3ld7l9f0ibDNOQOHHMYYIIbhfbHSm3C4ZsoJORNo=
```

**File**: `go/pkg/sysdb/metastore/db/dao/segment.go` (modified, +5/-0)
```diff
@@ -116,6 +116,7 @@ func (s *segmentDb) GetSegments(id types.UniqueID, segmentType *string, scope *s
 		err := rows.Scan(&segmentID, &collectionID, &segmentType, &scope, &filePathsJson, &key, &strValue, &intValue, &floatValue, &boolValue)
 		if err != nil {
 			log.Error("scan segment failed", zap.Error(err))
+			return nil, err
 		}
 		if segmentID != currentSegmentID {
 			currentSegmentID = segmentID
@@ -182,6 +183,10 @@ func (s *segmentDb) GetSegments(id types.UniqueID, segmentType *string, scope *s
 		metadata = append(metadata, segmentMetadata)
 		currentSegment.SegmentMetadata = metadata
 	}
+	if err := rows.Err(); err != nil {
+		log.Error("iterate segments failed", zap.Error(err))
+		return nil, err
+	}
 	return segments, nil
 }
 
```

**File**: `go/pkg/sysdb/metastore/db/dao/segment_errors_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+package dao
+
+import (
+	"context"
+	"testing"
+
+	"github.com/DATA-DOG/go-sqlmock"
+	"github.com/chroma-core/chroma/go/pkg/types"
+	"github.com/stretchr/testify/require"
+	"gorm.io/driver/postgres"
+	"gorm.io/gorm"
+)
+
+func TestGetSegmentsRowFailures(t *testing.T) {
+	columns := []string{"id", "collection_id", "type", "scope", "file_paths", "key", "str_value", "int_value", "float_value", "bool_value"}
+	collectionID := types.NewUniqueID()
+	segmentID := types.NewUniqueID().String()
+	for _, tc := range []struct {
+		name       string
+		validFirst bool
+		iteration  bool
+	}{
+		{name: "first row scan fails"},
+		{name: "later row scan fails", validFirst: true},
+		{name: "first row iteration fails", iteration: true},
+		{name: "later row iteration fails", validFirst: true, iteration: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			sqlDB, mock, err := sqlmock.New()
+			require.NoError(t, err)
+			t.Cleanup(func() { _ = sqlDB.Close() })
+			db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{})
+			require.NoError(t, err)
+			rows := sqlmock.NewRows(columns)
+			if tc.validFirst {
+				rows.AddRow(segmentID, collectionID.String(), "test", "VECTOR", "{}", nil, nil, nil, nil, nil)
+			}
+			// NULL cannot scan into the ID string. A failed first scan leaves
+			// the current segment unset, as a canceled database read can do.
+			if tc.validFirst && !tc.iteration {
+				rows.AddRow(segmentID, collectionID.String(), "test", "VECTOR", "{}", "count", nil, "invalid integer", nil, nil)
+			} else {
+				rows.AddRow(nil, collectionID.String(), "test", "VECTOR", "{}", nil, nil, nil, nil, nil)
+			}
+			if tc.iteration {
+				index := 0
+				if tc.validFirst {
+					index = 1
+				}
+				rows.RowError(index, context.Canceled)
+			}
+			mock.ExpectQuery("SELECT .* FROM \"segments\"").WithArgs(collectionID.String()).WillReturnRows(rows).RowsWillBeClosed()
+			require.NotPanics(t, func() {
+				segments, err := (&segmentDb{db: db}).GetSegments(types.NilUniqueID(), nil, nil, collectionID)
+				require.Error(t, err)
+				require.Nil(t, segments, "failed reads must not return partial segment metadata")
+				if tc.iteration {
+					require.ErrorIs(t, err, context.Canceled)
+				} else if tc.validFirst {
+					require.ErrorContains(t, err, "invalid syntax")
+				} else {
+					require.ErrorContains(t, err, "converting NULL to string")
+				}
+			})
+			require.NoError(t, mock.ExpectationsWereMet())
+		})
+	}
+}
```

---

### Incident Patch 9: `e6eca82e` (2026-09-24)
**Commit Message**: [BUG](agent): Drop unpriced Opus from models (#7793)

## Description of changes

`/api/agent` accepted `claude-opus-4-5-20251101`, but no Orb metric and
no Foundation price-card rate matches that id: such a run bills $0 in
Orb and debits the internal budget at the Sonnet planner rate while
costing 5x per token (CHR-768). No Opus event has ever been sent
(verified in Orb 2026-09-23), so this closes the hole before anyone hits
it.

- Improvements & Bug fixes
- Drop `Opus4_5` from `AnthropicModel`: the enum now carries only priced
snapshots, and the route's existing parse turns any other id into a 400.
- The route test that used Opus as the explicit non-default model now
passes an upcased Sonnet id instead; the config test asserts the Opus
wire id is rejected.

**Product question this PR surfaces but does not decide:** should Opus
be offered on `/api/agent` at all? If yes, it needs Orb metrics + prices
+ a price-card rate first — that rides the CHR-769 version cut, and the
variant comes back with it.

## Test plan

- [x] `cargo test -p chroma-agent --lib` (30 passed)
- [x] `cargo test -p foundation-api --lib agent` (40 passed)
- [x] `cargo clippy -p chroma-agent -p foundation-api --li

**File**: `rust/agent/src/inference/anthropic/config.rs` (modified, +14/-7)
```diff
@@ -62,24 +62,23 @@ impl From<Vec<AnthropicBeta>> for AnthropicBetas {
     }
 }
 
-/// Known Anthropic model snapshots.
+/// Anthropic model snapshots offered to callers. Every variant must have a
+/// billing rate: the Orb metrics and the Foundation price card match on these
+/// exact wire ids, so an unpriced variant here bills its runs at $0.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum AnthropicModel {
-    /// `claude-opus-4-5-20251101`
-    Opus4_5,
     /// `claude-sonnet-4-5-20250929`
     Sonnet4_5,
 }
 
 impl AnthropicModel {
     /// Every known model. Keep in sync with the enum variants; this backs
     /// [`from_str`](Self::from_str) so parsing stays a single source of truth.
-    pub const ALL: [AnthropicModel; 2] = [AnthropicModel::Opus4_5, AnthropicModel::Sonnet4_5];
+    pub const ALL: [AnthropicModel; 1] = [AnthropicModel::Sonnet4_5];
 
     /// The API model identifier sent on the wire.
     pub fn id(self) -> &'static str {
         match self {
-            AnthropicModel::Opus4_5 => "claude-opus-4-5-20251101",
             AnthropicModel::Sonnet4_5 => "claude-sonnet-4-5-20250929",
         }
     }
@@ -146,8 +145,16 @@ mod tests {
                 Ok(model)
             );
         }
-        // Ambiguous family shorthands and unknown ids are rejected.
-        for s in ["opus", "opus-4.5", "sonnet", "haiku", ""] {
+        // Ambiguous family shorthands and unknown ids are rejected — including
+        // full snapshot ids of models that carry no billing rate.
+        for s in [
+            "opus",
+            "opus-4.5",
+            "sonnet",
+            "haiku",
+            "",
+            "claude-opus-4-5-20251101",
+        ] {
             assert!(s.parse::<AnthropicModel>().is_err());
         }
     }
```

**File**: `rust/agent/src/inference/anthropic/mod.rs` (modified, +2/-2)
```diff
@@ -146,7 +146,7 @@ mod tests {
     #[test]
     fn with_client_yields_a_usable_model() {
         let shared = reqwest::Client::new();
-        let model = AnthropicAgentInferenceModel::new("test-key", AnthropicModel::Opus4_5)
+        let model = AnthropicAgentInferenceModel::new("test-key", AnthropicModel::Sonnet4_5)
             .with_client(shared.clone());
         let toolset = weather_toolset();
         let ctx = InferenceContext {
@@ -157,7 +157,7 @@ mod tests {
         };
         assert_eq!(
             model.request_body(&ctx)["model"],
-            json!("claude-opus-4-5-20251101")
+            json!("claude-sonnet-4-5-20250929")
         );
     }
 
```

**File**: `rust/foundation-api/src/routes/agent/tests/00_unit.rs` (modified, +10/-6)
```diff
@@ -21,12 +21,16 @@ fn request_defaults_model_and_omits_system_prompt() {
     // model-omitting request would 400.
     assert!(default_model().parse::<AnthropicModel>().is_ok());
 
-    // A seeded system prompt + explicit model round-trips through the body.
-    let seeded: AgentRequest = serde_json::from_value(
-        json!({ "input": "hi", "model": AnthropicModel::Opus4_5.id(), "system": "be terse" }),
-    )
-    .expect("deserialize");
-    assert_eq!(seeded.model, AnthropicModel::Opus4_5.id());
+    // A seeded system prompt + explicit model round-trips through the body
+    // verbatim (an upcased id differs from the default string but still parses,
+    // since the handler matches ids case-insensitively).
+    let upcased = AnthropicModel::Sonnet4_5.id().to_ascii_uppercase();
+    let seeded: AgentRequest =
+        serde_json::from_value(json!({ "input": "hi", "model": upcased, "system": "be terse" }))
+            .expect("deserialize");
+    assert_eq!(seeded.model, upcased);
+    assert_ne!(seeded.model, default_model());
+    assert!(seeded.model.parse::<AnthropicModel>().is_ok());
     assert_eq!(seeded.system, "be terse");
 }
 
```

---

### Incident Patch 10: `839d7152` (2026-09-21)
**Commit Message**: [BUG](benchmark): Flush a cached dataset file before renaming it into place (#7717)

A benchmark dataset file is built once and cached: a callback writes the contents to a temporary file, that file is renamed to the cached path, and every later run reads the path instead of rebuilding.

## The defect

The callback was handed a file handle and trusted to have finished with it when it returned. A handle does not finish its pending writes just because it goes out of scope. Tokio's own documentation says so directly: a file is not closed immediately while it has operations that have not completed, and you should flush it before dropping it.

So the rename could publish a file whose tail had not been written. The next reader gets a short file rather than an error, which surfaces later as a deserialization failure with no obvious connection to the cause.

It depends on a write still being in flight when the handle is dropped, so it appears under load and not on an idle machine.

## Why it is worth fixing now

It is the cause of a `Rust tests` failure seen on several open pull requests, in `test_frozen_query_subset`, which writes a cache file and immediately reads it back and reports `une

**File**: `rust/benchmark/src/datasets/gist.rs` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ impl RecordDataset for GistDataset {
             |mut writer| async move {
                 let mut file = tokio::fs::File::open(current_path).await?;
                 tokio::io::copy(&mut file, &mut writer).await?;
-                Ok(())
+                Ok(writer)
             },
         )
         .await?;
```

**File**: `rust/benchmark/src/datasets/ms_marco_queries.rs` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ impl RecordDataset for MicrosoftMarcoQueriesDataset {
                 );
                 tokio::io::copy(&mut stream_reader, &mut writer).await?;
 
-                Ok(())
+                Ok(writer)
             }
             .boxed()
         })
```

**File**: `rust/benchmark/src/datasets/scidocs.rs` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ impl RecordDataset for SciDocsDataset {
                     let mut decoder = GzipDecoder::new(stream_reader);
                     tokio::io::copy(&mut decoder, &mut writer).await?;
 
-                    Ok(())
+                    Ok(writer)
                 }
                 .boxed()
             })
```

**File**: `rust/benchmark/src/datasets/sift.rs` (modified, +3/-3)
```diff
@@ -41,7 +41,7 @@ impl Sift1MData {
 
                 writer.write_all(&response.bytes().await?).await?;
 
-                Ok(())
+                Ok(writer)
             },
         ).await?;
         let query = get_or_populate_cached_dataset_file(
@@ -66,7 +66,7 @@ impl Sift1MData {
 
                 writer.write_all(&response.bytes().await?).await?;
 
-                Ok(())
+                Ok(writer)
             },
         ).await?;
         let ground = get_or_populate_cached_dataset_file(
@@ -91,7 +91,7 @@ impl Sift1MData {
 
                 writer.write_all(&response.bytes().await?).await?;
 
-                Ok(())
+                Ok(writer)
             },
         ).await?;
         Ok(Self {
```

**File**: `rust/benchmark/src/datasets/types.rs` (modified, +1/-1)
```diff
@@ -176,7 +176,7 @@ where
                     let serialized = bincode::serialize(&frozen_query_subset)?;
                     file.write_all(&serialized).await?;
 
-                    Ok(())
+                    Ok(file)
                 },
             )
             .await?;
```

**File**: `rust/benchmark/src/datasets/util.rs` (modified, +81/-3)
```diff
@@ -1,7 +1,7 @@
 use anyhow::Result;
 use async_tempfile::TempFile;
 use std::{future::Future, path::PathBuf};
-use tokio::io::AsyncWrite;
+use tokio::io::{AsyncWrite, AsyncWriteExt};
 
 pub(crate) fn get_dir_for_persistent_dataset_files() -> PathBuf {
     PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("dataset_files")
@@ -24,6 +24,18 @@ async fn get_dataset_cache_path(
 }
 
 /// Calls the populate callback to create a cached dataset file if it doesn't exist, and returns the path to the cached file.
+///
+/// The callback returns the writer it was given so that this function can flush
+/// it. Two properties depend on that, and both break silently without it:
+///
+/// 1. The bytes the callback wrote are in the file before it is renamed into
+///    place. A file handle does not finish its pending writes just because it
+///    goes out of scope, and its own documentation requires a flush before it
+///    is dropped for that reason. Without one the rename can publish a short
+///    file, and the next reader gets a truncated one rather than an error.
+/// 2. A caller cannot forget. Taking the writer back is what makes the flush
+///    this function's responsibility instead of every callback's, which is why
+///    the callback returns it rather than being trusted to flush it.
 pub(crate) async fn get_or_populate_cached_dataset_file<F, Fut>(
     dataset_name: impl AsRef<str>,
     file_name: impl AsRef<str>,
@@ -32,20 +44,86 @@ pub(crate) async fn get_or_populate_cached_dataset_file<F, Fut>(
 ) -> Result<PathBuf>
 where
     F: FnOnce(Box<dyn AsyncWrite + Unpin + Send>) -> Fut,
-    Fut: Future<Output = Result<()>>,
+    Fut: Future<Output = Result<Box<dyn AsyncWrite + Unpin + Send>>>,
 {
     let dataset_dir = get_dataset_cache_path(dataset_name.as_ref(), cache_dir).await?;
     let file_path = dataset_dir.join(file_name.as_ref());
 
     if !file_path.exists() {
         // We assume that dataset creation was successful if the file exists, so we use a temporary file to avoid scenarios where the file is partially written and then the callback fails.
         let temp = TempFile::new().await?;
-        populate(Box::new(
+        let mut writer = populate(Box::new(
             temp.try_clone().await.expect("Failed to clone file handle"),
         ))
         .await?;
+        writer.flush().await?;
+        drop(writer);
         tokio::fs::rename(temp.file_path(), &file_path).await?;
     }
 
     Ok(file_path)
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use async_tempfile::TempDir;
+
+    /// A cached file holds every byte the callback wrote.
+    ///
+    /// This covers the round trip, not the race it guards against. Losing the
+    /// tail of a write depends on a pending operation still being in flight
+    /// when the handle is dropped, which a test cannot force: on an idle
+    /// machine the write lands first and the assertion passes either way. The
+    /// flush is required by the file handle's own contract rather than by this
+    /// test.
+    #[tokio::test]
+    async fn a_cached_file_holds_every_byte_the_callback_wrote() {
+        let dir = TempDir::new().await.unwrap();
+        let payload = vec![7u8; 1 << 20];
+        let expected = payload.clone();
+
+        let path = get_or_populate_cached_dataset_file(
+            "flush_test",
+            "payload.bin",
+            Some(dir.to_path_buf()),
+            |mut writer| async move {
+                writer.write_all(&payload).await?;
+                Ok(writer)
+            },
+        )
+        .await
+        .unwrap();
+
+        assert_eq!(tokio::fs::read(&path).await.unwrap(), expected);
+    }
+
+    /// A second call returns the first call's file rather than repopulating it.
+    #[tokio::test]
+    async fn an_existing_cached_file_is_not_repopulated() {
+        let dir = TempDir::new().await.unwrap();
+
+        let write = |bytes: Vec<u8>| {
+            let dir = dir.to_path_buf();
+            async move {
+                get_or_populate_cached_dataset_file(
+                    "flush_test",
+                    "once.bin",
+                    Some(dir),
+                    |mut writer| async move {
+                        writer.write_all(&bytes).await?;
+                        Ok(writer)
+                    },
+                )
+                .await
+                .unwrap()
+            }
+        };
+
+        let first = write(b"first".to_vec()).await;
+        let second = write(b"second".to_vec()).await;
+
+        assert_eq!(first, second);
+        assert_eq!(tokio::fs::read(&second).await.unwrap(), b"first");
+    }
+}
```

**File**: `rust/benchmark/src/datasets/wikipedia.rs` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ impl RecordDataset for WikipediaDataset {
                     let mut decoder = BzDecoder::new(stream_reader);
                     tokio::io::copy(&mut decoder, &mut writer).await?;
 
-                    Ok(())
+                    Ok(writer)
                 }
                 .boxed()
             },
```

---

### Incident Patch 11: `b287a24b` (2026-09-21)
**Commit Message**: [BUG](wal3): Bound the backoff test by elapsed time, not a fixed duration (#7718)

`ExponentialBackoff::next` backs off over the time since the backoff was
constructed. It scales that elapsed time by the ratio of throughput to
reserve capacity, then by a random fraction below one.

## The defect

The test asserted that the first three values were each under one
second. That holds only while construction and the calls stay within a
few milliseconds of each other, because the elapsed time is itself the
quantity being scaled. A machine that schedules the test slowly raises
the value the assertion is made about, so the test fails for a reason
unrelated to the code it covers.

It failed that way on the `Rust tests` job of an unrelated pull request,
with `assertion failed: exp_backoff.next() < Duration::from_secs(1)`.

## The change

Assert the bound the implementation actually guarantees: a returned
value never exceeds the scaled elapsed time. The bound is sampled after
the call so it stays an upper bound, since elapsed time only grows.

The second half of the test, which sleeps and then checks the mean of a
hundred samples, is untouched. Its elapsed time is dominated by the
sleep, so i

**File**: `rust/wal3/src/backoff.rs` (modified, +29/-7)
```diff
@@ -10,10 +10,10 @@
 //! │                            HHHHHHHHHHHHHHHHHHHHH
 //! │                            HHHHHHHHHHHHHHHHHHHHH
 //! ├────────────┐              ┌─────────────────────
-//! │            │DDDDDDDDDDDDDD│          
-//! │            │DDDDDDDDDDDDDD│          
-//! │            │DDDDDDDDDDDDDD│          
-//! │            └──────────────┘          
+//! │            │DDDDDDDDDDDDDD│
+//! │            │DDDDDDDDDDDDDD│
+//! │            │DDDDDDDDDDDDDD│
+//! │            └──────────────┘
 //! └────────────────────────────────────────────────
 //! ```
 //!
@@ -101,12 +101,34 @@ impl ExponentialBackoff {
 mod tests {
     use super::*;
 
+    /// The upper bound `next` can return at this instant.
+    ///
+    /// `next` scales the time since construction by the ratio of throughput to
+    /// reserve capacity, then by a random fraction below one, so the scaled
+    /// elapsed time is the bound that holds on any machine. Sampling it after
+    /// the call keeps it an upper bound, since elapsed time only grows.
+    fn ceiling(backoff: &ExponentialBackoff) -> Duration {
+        backoff
+            .start
+            .elapsed()
+            .mul_f64(backoff.throughput_ops_sec / backoff.reserve_capacity)
+    }
+
     #[test]
     fn test_with_exponential_backoff() {
         let exp_backoff = ExponentialBackoff::new(1_000.0, 100.0);
-        assert!(exp_backoff.next() < Duration::from_secs(1));
-        assert!(exp_backoff.next() < Duration::from_secs(1));
-        assert!(exp_backoff.next() < Duration::from_secs(1));
+        // A fixed bound here would hold only while construction and these calls
+        // stay within a few milliseconds of each other, which a loaded machine
+        // does not promise: the window this backs off over is the elapsed time
+        // itself, so a slow scheduler raises the value being asserted about.
+        for _ in 0..3 {
+            let backoff = exp_backoff.next();
+            let ceiling = ceiling(&exp_backoff);
+            assert!(
+                backoff <= ceiling,
+                "backoff {backoff:?} exceeded the scaled recovery window {ceiling:?}"
+            );
+        }
         std::thread::sleep(Duration::from_secs(10));
         let mut durations = (0..100).map(|_| exp_backoff.next()).collect::<Vec<_>>();
         durations.sort();
```

---

### Incident Patch 12: `0dad2c71` (2026-09-18)
**Commit Message**: [BUG](log): Preserve float metadata precision (#7755)

## Description of changes

Enable serde_json's float_roundtrip feature in the log crate so
metadata float values survive the SQLite log JSON round trip
exactly. The default parser drops a bit of precision, which
causes equality filters to miss records after log replay.

Add a regression test and a proptest regression case covering the
exact-float round trip.

## Test plan

CI

## Migration plan

N/A

## Observability plan

N/A

## Documentation Changes

N/A

Co-authored-by: AI

**File**: `rust/frontend/tests/test_collection.proptest-regressions` (modified, +3/-0)
```diff
@@ -7,3 +7,6 @@
 cc de39a462b6b402ee55528f5874f16b0e3c49250f0c648029d24903501589af5b
 cc 29dfdbf2f2070f828764b4027f529a8293c20fd0ab35b084b93b34e26d8524c1 # shrinks to (initial_state, transitions, seen_counter) = (FrontendReferenceState { collection: None }, [Init { dimension: 3 }, Add(AddCollectionRecordsRequest { tenant_id: "default_tenant", database_name: "default_database", collection_id: CollectionUuid(978fd1b7-cf39-4af7-8db8-f7ef3fdefde5), ids: ["A", "a", "A", "ந", "t🩭ૡȺ𑋌𞸃*xΊ᎘K=¡\u{9be}\\", "0", "a"], embeddings: Some([[0.9419389, 0.4602584, 0.07824011, 0.5889557, 0.17198403, 0.89739597, 0.3266826, 0.038708102, 0.75370795, 0.6888255, 0.8859157, 0.5818375, 0.97137, 0.32879475, 0.51470524, 0.14532271, 0.5698166, 0.2910892, 0.76641595, 0.5901827, 0.57709724, 0.25610164, 0.13000308, 0.29484266, 0.6152801, 0.009103108, 0.03653251, 0.98815155, 0.26016104, 0.78515166, 0.7493071, 0.5319673, 0.73632467, 0.63511175, 0.6431028, 0.27108678, 0.9518717, 0.12441054, 0.4082028, 0.53161836, 0.13045806, 0.77258396, 0.83038086, 0.35770762, 0.36965308, 0.75105625, 0.48947215, 0.72478086, 0.9329755, 0.33998078, 0.08779139, 0.33840328, 0.35633045, 0.84425503, 0.14424622, 0.059397947, 0.29397634, 0.38632107, 0.31289262, 0.93886685, 0.6610227, 0.9371907, 0.9432761, 0.1281798, 0.56193465, 0.22891387, 0.7460721, 0.28438044, 0.69089985, 0.1382049, 0.69488937, 0.6027255, 0.6839867, 0.18903792, 0.12784643, 0.23886614, 0.27574354, 0.92513376, 0.82460356, 0.5491815, 0.7418622, 0.49083224, 0.49678004, 0.4205895, 0.8283009, 0.89433753, 0.93693614, 0.55350566, 0.6925697, 0.40945655, 0.10461675, 0.856968, 0.12611459, 0.19399445], [0.5298844, 0.9299878, 0.8777732, 0.7027985, 0.95964146, 0.8627177, 0.044852376, 0.9717915, 0.11005503, 0.9801311, 0.71752024, 0.8945862, 0.543993, 0.35980105, 0.88160455, 0.7463823, 0.544612, 0.8895713, 0.3139788, 0.21027362, 0.7378829, 0.23632546, 0.31895652, 0.7332872, 0.72177935, 0.23737685, 0.07018188, 0.19905359, 0.13558298, 0.45697483, 0.06922117, 0.19820586, 0.95076543, 0.1427481, 0.65870106, 0.011751545, 0.62935054, 0.016244749, 0.4034736, 0.21122259, 0.9456274, 0.20671266, 0.5883566, 0.38402665, 0.8336776, 0.51541334, 0.28295, 0.69363123, 0.59917873, 0.123639494, 0.9031437, 0.7109203, 0.7329434, 0.044602722, 0.77145797, 0.39132416, 0.88076526, 0.9316342, 0.928713, 0.2838632, 0.1766825, 0.34628776, 0.53948164, 0.8913063, 0.574219, 0.77694476, 0.4060059, 0.22836803, 0.04334457, 0.9859376, 0.7023495, 0.8323059, 0.1209127, 0.49981353, 0.27002555, 0.7975547, 0.26886064, 0.1563288, 0.41714224, 0.29666588, 0.9515937, 0.19633216, 0.7527049, 0.27561066, 0.24333389, 0.42574835, 0.2775597, 0.52653134, 0.264695, 0.397567, 0.74519074, 0.8354492, 0.45879108, 0.4518133], [0.19114599, 0.14300765, 0.7008385, 0.6812034, 0.17124294, 0.28142288, 0.68913823, 0.2241288, 0.11190939, 0.41569385, 0.16850829, 0.47891366, 0.14979453, 0.8347131, 0.23160721, 0.85447776, 0.13979456, 0.25294387, 0.066886745, 0.1594409, 0.45970175, 0.4419383, 0.07497088, 0.98767716, 0.942067, 0.78918207, 0.27676252, 0.2135528, 0.90247077, 0.28515357, 0.5359466, 0.009600512, 0.30750486, 0.46602142, 0.07465778, 0.081172235, 0.44353834, 0.6889137, 0.68368053, 0.21098572, 0.59198254, 0.3936238, 0.6080994, 0.64308655, 0.81539875, 0.3612643, 0.9902388, 0.64862436, 0.64180195, 0.51065046, 0.19506639, 0.22927073, 0.40036297, 0.41055465, 0.19760314, 0.5938965, 0.34109247, 0.10689101, 0.6068052, 0.01556441, 0.87375927, 0.7138416, 0.7692153, 0.42696273, 0.96456456, 0.99014384, 0.7974448, 0.120117515, 0.57995594, 0.60178304, 0.94248587, 0.90007013, 0.7940307, 0.5695495, 0.20955785, 0.9178899, 0.4475578, 0.11686285, 0.8848066, 0.9874595, 0.8346507, 0.6381617, 0.17455289, 0.4884202, 0.17543408, 0.20913783, 0.30622292, 0.1584411, 0.48347726, 0.60950047, 0.9925419, 0.8787525, 0.9229145, 0.6323841], [0.70988023, 0.43080327, 0.865296, 0.98309696, 0.15244026, 0.46659556, 0.49413306, 0.5906787, 0.29745355, 0.097229585, 0.1321213, 0.72594404, 0.9324311, 0.28659454, 0.34871227, 0.36774066, 0.098965116, 0.02812259, 0.5030498, 0.09655718, 0.8777633, 0.9246418, 0.18004079, 0.13604547, 0.24743661, 0.6976615, 0.1936879, 0.3912625, 0.3587046, 0.0070184073, 0.7065907, 0.62980324, 0.5298528, 0.3134179, 0.92194885, 0.93319803, 0.033487335, 0.20382178, 0.11236378, 0.12200209, 0.33240014, 0.09656158, 0.673395, 0.5085828, 0.5681691, 0.79544646, 0.08773462, 0.14452712, 0.36947745, 0.99994296, 0.13325907, 0.67467046, 0.11179738, 0.077857085, 0.7222556, 0.64191526, 0.8577736, 0.7563854, 0.25619105, 0.7705136, 0.5778143, 0.17505045, 0.24817242, 0.5362134, 0.6199248, 0.6813148, 0.28469017, 0.38462216, 0.6569774, 0.766871, 0.19773252, 0.44006613, 0.48821718, 0.415305, 0.23932035, 0.95238507, 0.3962576, 0.4339959, 0.7461445, 0.8643024, 0.82243186, 0.21226327, 0.05232873, 0.22958863, 0.8146227, 0.9056546, 0.15673883, 0.05624135, 0.41610566, 0.56219894, 0.20867379, 0.31745195, 0.6926092, 0.898287], [0.40302703, 0.9436987, 0.96101606, 0.2848156, 0.73858047, 0.8119943, 0.8858694, 0.55515814
```

**File**: `rust/log/Cargo.toml` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@ uuid = { workspace = true }
 tower = { workspace = true }
 sqlx = { workspace = true }
 tokio = { workspace = true }
-serde_json = { workspace = true }
+# Metadata must retain exact float values for equality filters after log replay.
+serde_json = { workspace = true, features = ["float_roundtrip"] }
 bytemuck = { workspace = true }
 futures = { workspace = true }
 opentelemetry = { workspace = true }
```

**File**: `rust/log/src/sqlite_log.rs` (modified, +28/-0)
```diff
@@ -727,6 +727,34 @@ mod tests {
         assert_eq!(collections_with_data.len(), 0);
     }
 
+    #[tokio::test]
+    async fn test_float_metadata_roundtrip() {
+        let mut log = setup_sqlite_log().await;
+        let collection_id = CollectionUuid::new();
+        // This value loses one bit with serde_json's default float parser,
+        // which causes equality filters to miss the stored record.
+        let value = -1004.1783447265625;
+        let metadata =
+            UpdateMetadata::from([("value".to_string(), UpdateMetadataValue::Float(value))]);
+        log.push_logs(
+            collection_id,
+            vec![OperationRecord {
+                id: "id".to_string(),
+                embedding: Some(vec![1.0, 2.0, 3.0]),
+                encoding: Some(ScalarEncoding::FLOAT32),
+                metadata: Some(metadata.clone()),
+                document: None,
+                operation: Operation::Add,
+            }],
+        )
+        .await
+        .unwrap();
+
+        let records = log.read(collection_id, 0, 1, None).await.unwrap();
+        assert_eq!(records.len(), 1);
+        assert_eq!(records[0].record.metadata.as_ref(), Some(&metadata));
+    }
+
     proptest! {
         #[test]
          fn test_push_pull_logs(
```

---

### Incident Patch 13: `7edf9b45` (2026-09-15)
**Commit Message**: [BLD](tilt): Remove log build override (#7749)

**File**: `Tiltfile` (modified, +1/-2)
```diff
@@ -30,8 +30,7 @@ else:
     '.',
     only=["rust/", "idl/", "Cargo.toml", "Cargo.lock"],
     dockerfile='./rust/Dockerfile',
-    target='log_service',
-    build_args={'LOG_SERVICE_CARGO_FEATURES': 'faults'}
+    target='log_service'
   )
 
 if config.tilt_subcommand == "ci":
```

---

### Incident Patch 14: `9e623fe5` (2026-09-15)
**Commit Message**: [PERF](agent): Cache the Anthropic request prefix (#7744)

## Description of changes

The agent loop re-sends the whole conversation on every planner
iteration, and nothing in the request path ever asked for caching.
`parse_anthropic_usage` reads `cache_read_input_tokens` off the
response, so the `search_agent_usage` meter events have been honestly
reporting zeros — every iteration re-paid full input price for context
the previous iteration had already sent.

This sets
[`cache_control`](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#automatic-caching)
at the **request root**. Anthropic places the breakpoint on the last
cacheable block and advances it as the conversation grows, which is
exactly the shape of an agent loop.

I first wrote this as two hand-placed block-level breakpoints — one
closing the static prefix, one rolling with the conversation. The
request-level marker is strictly better:

- no bookkeeping as the trajectory grows, so nothing to get wrong when
the message shape changes
- leaves all four block-level breakpoint slots free rather than spending
two
- handles blocks that cannot carry a marker on their own (it walks back
past `thinking` rather t

**File**: `rust/agent/src/inference/anthropic/diagnostics.rs` (modified, +3/-0)
```diff
@@ -32,6 +32,7 @@ pub(super) fn request_diagnostics(body: &Value, beta_header: Option<&str>) -> Va
             "max_tokens": body.get("max_tokens"),
             "temperature": body.get("temperature"),
             "thinking": body.get("thinking"),
+            "cache_control": body.get("cache_control"),
             "system": body.get("system").map(text_diagnostics),
             "tools": tools,
             "messages": messages,
@@ -116,6 +117,7 @@ mod tests {
             "max_tokens": 4096,
             "temperature": 1.0,
             "thinking": { "type": "enabled", "budget_tokens": 6000 },
+            "cache_control": { "type": "ephemeral" },
             "system": "private system prompt",
             "tools": [{
                 "name": "search",
@@ -150,6 +152,7 @@ mod tests {
                     "max_tokens": 4096,
                     "temperature": 1.0,
                     "thinking": { "type": "enabled", "budget_tokens": 6000 },
+                    "cache_control": { "type": "ephemeral" },
                     "system": { "redacted": true, "chars": 21, "bytes": 21 },
                     "tools": [{
                         "name": "search",
```

**File**: `rust/agent/src/inference/anthropic/request.rs` (modified, +69/-7)
```diff
@@ -13,6 +13,20 @@ impl AnthropicAgentInferenceModel {
             "max_tokens": ctx.max_tokens.unwrap_or(self.config.max_tokens),
             "temperature": self.config.temperature,
             "thinking": { "type": "enabled", "budget_tokens": self.config.thinking_budget },
+            // Automatic prompt caching. Anthropic puts the breakpoint on the
+            // last cacheable block and advances it as the conversation grows,
+            // so each iteration reads the previous iteration's context back at
+            // cache-read price instead of re-paying full input price for it.
+            //
+            // The agent re-sends the whole conversation every iteration, which
+            // is exactly the shape this is for: a request-level marker leaves
+            // all four block-level breakpoints free, needs no bookkeeping as
+            // the trajectory grows, and skips blocks that cannot carry a
+            // marker (`thinking`) on its own.
+            //
+            // `ephemeral` is the 5-minute TTL, so the tool execution between
+            // two iterations has to finish inside it to hit the cache.
+            "cache_control": { "type": "ephemeral" },
             "tools": ctx.toolset.get_formats(ProviderFormat::Anthropic),
             "messages": ctx.trajectory.to_provider_format(ProviderFormat::Anthropic),
         });
@@ -34,17 +48,19 @@ mod tests {
     use crate::inference::anthropic::AnthropicModel;
     use crate::trajectory::{ObservationBuilder, TrajectoryBuilder};
 
+    fn context_trajectory() -> crate::trajectory::Trajectory {
+        let mut builder = TrajectoryBuilder::new();
+        let mut obs = ObservationBuilder::new();
+        obs.push_user("hi");
+        builder.push_observation(obs.build());
+        builder.build()
+    }
+
     #[test]
     fn request_body_includes_system_only_when_set() {
         let model = AnthropicAgentInferenceModel::new("test-key", AnthropicModel::Sonnet4_5);
         let toolset = weather_toolset();
-        let trajectory = {
-            let mut builder = TrajectoryBuilder::new();
-            let mut obs = ObservationBuilder::new();
-            obs.push_user("hi");
-            builder.push_observation(obs.build());
-            builder.build()
-        };
+        let trajectory = context_trajectory();
 
         let ctx = InferenceContext {
             trajectory: trajectory.clone(),
@@ -62,4 +78,50 @@ mod tests {
         };
         assert_eq!(model.request_body(&ctx)["system"], json!("Be terse."));
     }
+
+    /// The breakpoint is requested once at the top level; no content block
+    /// carries one, which is what leaves all four block-level slots free.
+    #[test]
+    fn request_body_requests_automatic_caching() {
+        let model = AnthropicAgentInferenceModel::new("test-key", AnthropicModel::Sonnet4_5);
+        let toolset = weather_toolset();
+        let ctx = InferenceContext {
+            trajectory: context_trajectory(),
+            toolset: &toolset,
+            max_tokens: None,
+            system: Some("Be terse.".to_string()),
+        };
+
+        let body = model.request_body(&ctx);
+
+        assert_eq!(body["cache_control"], json!({ "type": "ephemeral" }));
+
+        let tools = body["tools"].as_array().expect("tools array");
+        assert!(tools.iter().all(|tool| tool.get("cache_control").is_none()));
+
+        let messages = body["messages"].as_array().expect("messages array");
+        for message in messages {
+            let content = message["content"].as_array().expect("content array");
+            assert!(content.iter().all(|b| b.get("cache_control").is_none()));
+        }
+    }
+
+    /// An empty trajectory still asks for caching; Anthropic skips it when no
+    /// block is eligible rather than rejecting the request.
+    #[test]
+    fn request_body_requests_caching_on_an_empty_trajectory() {
+        let model = AnthropicAgentInferenceModel::new("test-key", AnthropicModel::Sonnet4_5);
+        let toolset = weather_toolset();
+        let ctx = InferenceContext {
+            trajectory: TrajectoryBuilder::new().build(),
+            toolset: &toolset,
+            max_tokens: None,
+            system: Some("Be terse.".to_string()),
+        };
+
+        let body = model.request_body(&ctx);
+
+        assert_eq!(body["messages"], json!([]));
+        assert_eq!(body["cache_control"], json!({ "type": "ephemeral" }));
+    }
 }
```

---

### Incident Patch 15: `da60f682` (2026-09-14)
**Commit Message**: [BUG](sysdb): Honor database pagination (#7710)

## Summary

- forward `limit` and `offset` to the Go SysDB when no MCMR client is
configured
- return the already-paginated Go SysDB response without client-side
slicing
- add stable `created_at, id` ordering and a matching Postgres list
index
- preserve the existing MCMR merge behavior

## Why

The Rust SysDB client currently requests every database from the Go
SysDB and paginates in memory. That makes a bounded `ListDatabases` call
transfer all tenant database rows. The Postgres query also lacks an
index matching its tenant/deletion filters and ordering.

## Validation

- `cargo test -p chroma-sysdb list_databases_`
- `cargo check -p chroma-sysdb`
- `go test ./pkg/sysdb/metastore/db/dao -run ^'$'` (compile-only)
- `atlas migrate validate --dir file://migrations`

The focused database-backed Go test was added but could not run locally
because Docker is unavailable.

**File**: `go/pkg/sysdb/metastore/db/dao/database.go` (modified, +2/-1)
```diff
@@ -35,7 +35,8 @@ func (s *databaseDb) ListDatabases(limit *int32, offset *int32, tenantID string)
 		Select("databases.id, databases.name, databases.tenant_id").
 		Where("databases.tenant_id = ?", tenantID).
 		Where("databases.is_deleted = ?", false).
-		Order("databases.created_at ASC")
+		Order("databases.created_at ASC").
+		Order("databases.id ASC")
 
 	if limit != nil {
 		query = query.Limit(int(*limit))
```

**File**: `go/pkg/sysdb/metastore/db/dao/database_test.go` (modified, +33/-0)
```diff
@@ -2,7 +2,9 @@ package dao
 
 import (
 	"fmt"
+	"sort"
 	"testing"
+	"time"
 
 	"github.com/chroma-core/chroma/go/pkg/sysdb/metastore/db/dbcore"
 	"github.com/chroma-core/chroma/go/pkg/sysdb/metastore/db/dbmodel"
@@ -27,6 +29,37 @@ func (suite *DatabaseDbTestSuite) SetupSuite() {
 	suite.TenantDb = &tenantDb{db: suite.db}
 }
 
+func (suite *DatabaseDbTestSuite) TestListDatabasesStablePagination() {
+	tenantID := "testListDatabasesStablePagination_tenant"
+	suite.Require().NoError(suite.TenantDb.Insert(&dbmodel.Tenant{ID: tenantID}))
+	defer suite.db.Delete(&dbmodel.Tenant{}, "id = ?", tenantID)
+
+	createdAt := time.Now().UTC().Truncate(time.Second)
+	databaseIDs := []string{
+		types.NewUniqueID().String(),
+		types.NewUniqueID().String(),
+		types.NewUniqueID().String(),
+	}
+	for index, databaseID := range databaseIDs {
+		suite.Require().NoError(suite.Db.Insert(&dbmodel.Database{
+			ID:        databaseID,
+			Name:      fmt.Sprintf("database_%d", index),
+			TenantID:  tenantID,
+			CreatedAt: createdAt,
+		}))
+		defer suite.db.Unscoped().Delete(&dbmodel.Database{}, "id = ?", databaseID)
+	}
+
+	sort.Strings(databaseIDs)
+	limit := int32(2)
+	offset := int32(1)
+	databases, err := suite.Db.ListDatabases(&limit, &offset, tenantID)
+	suite.Require().NoError(err)
+	suite.Require().Len(databases, 2)
+	suite.Equal(databaseIDs[1], databases[0].ID)
+	suite.Equal(databaseIDs[2], databases[1].ID)
+}
+
 // TestDatabaseDb_SoftDeleteRenamesRow verifies that SoftDelete renames the
 // database row to "_deleted_<name>_<id>" and flips is_deleted, mirroring the
 // collection soft-delete pattern. This frees the original name for reuse.
```

**File**: `go/pkg/sysdb/metastore/db/dbmodel/database.go` (modified, +4/-4)
```diff
@@ -7,12 +7,12 @@ import (
 )
 
 type Database struct {
-	ID        string          `gorm:"id;primaryKey;unique"`
+	ID        string          `gorm:"id;primaryKey;unique;index:idx_databases_list,priority:4"`
 	Name      string          `gorm:"name;type:varchar(128);not null;uniqueIndex:idx_tenantid_name"`
-	TenantID  string          `gorm:"tenant_id;type:varchar(128);not null;uniqueIndex:idx_tenantid_name"`
+	TenantID  string          `gorm:"tenant_id;type:varchar(128);not null;uniqueIndex:idx_tenantid_name;index:idx_databases_list,priority:1"`
 	Ts        types.Timestamp `gorm:"ts;type:bigint;default:0"`
-	IsDeleted bool            `gorm:"is_deleted;type:bool;default:false"`
-	CreatedAt time.Time       `gorm:"created_at;type:timestamp;not null;default:current_timestamp"`
+	IsDeleted bool            `gorm:"is_deleted;type:bool;default:false;index:idx_databases_list,priority:2"`
+	CreatedAt time.Time       `gorm:"created_at;type:timestamp;not null;default:current_timestamp;index:idx_databases_list,priority:3"`
 	UpdatedAt time.Time       `gorm:"updated_at;type:timestamp;not null;default:current_timestamp"`
 }
 
```

**File**: `go/pkg/sysdb/metastore/db/migrations/20260910120000.sql` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+-- Add an index for stable, tenant-scoped database pagination.
+CREATE INDEX "idx_databases_list" ON "public"."databases" ("tenant_id", "is_deleted", "created_at", "id");
```

**File**: `go/pkg/sysdb/metastore/db/migrations/atlas.sum` (modified, +2/-1)
```diff
@@ -1,4 +1,4 @@
-h1:F09mgFdSPvcRbA08WvlpgeZktZEeUbmkSGc9UWiSp8k=
+h1:g54e9AxAw+QN/P+kVqQM+fqtD+ksQ/L4STFmnjECj8A=
 20240313233558.sql h1:Gv0TiSYsqGoOZ2T2IWvX4BOasauxool8PrBOIjmmIdg=
 20240321194713.sql h1:kVkNpqSFhrXGVGFFvL7JdK3Bw31twFcEhI6A0oCFCkg=
 20240327075032.sql h1:nlr2J74XRU8erzHnKJgMr/tKqJxw9+R6RiiEBuvuzgo=
@@ -35,3 +35,4 @@ h1:F09mgFdSPvcRbA08WvlpgeZktZEeUbmkSGc9UWiSp8k=
 20260617150000.sql h1:DPilfCw6AkmDYUB4MB65b3ot5fQXk1entTlTOmiSsS4=
 20260619150000.sql h1:YGixjF/DcHlzNu7DPm4SIvZMWKw/ctwpHXVabrIKSdY=
 20260810120000.sql h1:vINcyM4xwGFbToMm69jgsHGBxHs6vJSTCP2gH9K7Lt4=
+20260910120000.sql h1:M6W5jx4bYm4ugCpuAAgNZRJDD1Qxrz6szpz3nYhJjd4=
```

**File**: `rust/sysdb/src/sysdb.rs` (modified, +92/-7)
```diff
@@ -813,6 +813,35 @@ impl ChromaError for GrpcSysDbError {
     }
 }
 
+fn single_region_list_databases_request(
+    tenant: String,
+    limit: Option<u32>,
+    offset: u32,
+    merge_mcmr_results: bool,
+) -> Result<chroma_proto::ListDatabasesRequest, ListDatabasesError> {
+    let (limit, offset) = if merge_mcmr_results {
+        (None, 0)
+    } else {
+        let limit = limit.map(i32::try_from).transpose().map_err(|_| {
+            ListDatabasesError::InvalidPagination(
+                "limit exceeds the maximum supported value".to_string(),
+            )
+        })?;
+        let offset = i32::try_from(offset).map_err(|_| {
+            ListDatabasesError::InvalidPagination(
+                "offset exceeds the maximum supported value".to_string(),
+            )
+        })?;
+        (limit, offset)
+    };
+
+    Ok(chroma_proto::ListDatabasesRequest {
+        tenant,
+        limit,
+        offset: Some(offset),
+    })
+}
+
 #[async_trait]
 impl Configurable<(GrpcSysDbConfig, Option<GrpcSysDbConfig>)> for GrpcSysDb {
     async fn try_from_config(
@@ -1064,13 +1093,13 @@ impl GrpcSysDb {
         limit: Option<u32>,
         offset: u32,
     ) -> Result<ListDatabasesResponse, ListDatabasesError> {
-        // Collect databases from single-region client
-        // We request all databases (offset=0) and handle pagination manually
-        let single_region_req = chroma_proto::ListDatabasesRequest {
-            tenant: tenant.clone(),
-            limit: None,
-            offset: Some(0),
-        };
+        let merge_mcmr_results = self._mcmr_client.is_some();
+        let single_region_req = single_region_list_databases_request(
+            tenant.clone(),
+            limit,
+            offset,
+            merge_mcmr_results,
+        )?;
         let single_region_dbs: Vec<Database> =
             match self.client.list_databases(single_region_req).await {
                 Ok(resp) => resp
@@ -1090,6 +1119,12 @@ impl GrpcSysDb {
                 Err(err) => return Err(ListDatabasesError::Internal(err.into())),
             };
 
+        // The Go SysDB applies limit and offset in SQL. Return its bounded
+        // result directly when there is no second source to merge.
+        if !merge_mcmr_results {
+            return Ok(single_region_dbs);
+        }
+
         // Early bail-out: if single-region has enough results to satisfy offset + limit
         if let Some(lim) = limit {
             let total_needed = offset.saturating_add(lim);
@@ -3181,6 +3216,56 @@ mod tests {
         assert!(!fce.should_trace_error());
     }
 
+    #[test]
+    fn single_region_list_databases_preserves_pagination() {
+        let request =
+            single_region_list_databases_request("tenant".to_string(), Some(25), 50, false)
+                .unwrap();
+
+        assert_eq!(request.tenant, "tenant");
+        assert_eq!(request.limit, Some(25));
+        assert_eq!(request.offset, Some(50));
+    }
+
+    #[test]
+    fn merged_list_databases_fetches_all_single_region_rows() {
+        let request =
+            single_region_list_databases_request("tenant".to_string(), Some(25), 50, true).unwrap();
+
+        assert_eq!(request.tenant, "tenant");
+        assert_eq!(request.limit, None);
+        assert_eq!(request.offset, Some(0));
+    }
+
+    #[test]
+    fn single_region_list_databases_rejects_wire_overflow() {
+        let too_large = i32::MAX as u32 + 1;
+        let maximum = single_region_list_databases_request(
+            "tenant".to_string(),
+            Some(i32::MAX as u32),
+            i32::MAX as u32,
+            false,
+        )
+        .unwrap();
+
+        assert_eq!(maximum.limit, Some(i32::MAX));
+        assert_eq!(maximum.offset, Some(i32::MAX));
+
+        assert!(matches!(
+            single_region_list_databases_request("tenant".to_string(), Some(too_large), 0, false),
+            Err(ListDatabasesError::InvalidPagination(_))
+        ));
+        assert!(matches!(
+            single_region_list_databases_request(
+                "tenant".to_string(),
+                Some(i32::MAX as u32),
+                too_large,
+                false
+            ),
+            Err(ListDatabasesError::InvalidPagination(_))
+        ));
+    }
+
     #[test]
     fn get_collections_to_gc_error_internal_propagation() {
         // Test that Internal errors are properly propagated with their original error code
```

**File**: `rust/types/src/api_types.rs` (modified, +5/-1)
```diff
@@ -497,13 +497,17 @@ pub enum ListDatabasesError {
     Internal(#[from] Box<dyn ChromaError>),
     #[error("Invalid database id [{0}]")]
     InvalidID(String),
+    #[error("Invalid database pagination [{0}]")]
+    InvalidPagination(String),
 }
 
 impl ChromaError for ListDatabasesError {
     fn code(&self) -> ErrorCodes {
         match self {
             ListDatabasesError::Internal(status) => status.code(),
-            ListDatabasesError::InvalidID(_) => ErrorCodes::InvalidArgument,
+            ListDatabasesError::InvalidID(_) | ListDatabasesError::InvalidPagination(_) => {
+                ErrorCodes::InvalidArgument
+            }
         }
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #7842** (2026-10-02): [PERF](index): Retain checkpoint versions in compact pages (@dbeglord)
- **PR #7841** (2026-10-02): [PERF](index): Buffer worker postings by leaf before flush (@dbeglord)
- **PR #7838** (2026-10-02): [PERF](index): Keep packed writer navigation on live parents (@dbeglord)
- **PR #7837** (2026-10-02): [ENH](sysdb): Add tenant-scoped bulk database lookup (#7818) (@tanujnay112)
- **PR #7836** (closed): [PERF](index): Separate writer navigation from mutable postings (@dbeglord)
- **PR #7829** (closed): [PERF](index): Pack writer navigation for stable add batches (@dbeglord)
- **PR #7828** (2026-10-02): [ENH] Borrow neighboring leaves during reassignment scans (@dbeglord)
- **PR #7827** (2026-10-01): [PERF](index): Filter recall diagnostics before version lookup (@dbeglord)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
