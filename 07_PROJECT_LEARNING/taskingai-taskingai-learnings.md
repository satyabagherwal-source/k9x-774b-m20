# Forensic Learning Record (Deep Inspection): TaskingAI/TaskingAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/taskingai-taskingai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TaskingAI/TaskingAI](https://github.com/TaskingAI/TaskingAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:55:24.617Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TaskingAI/TaskingAI`
- **Description**: The open source platform for AI-native application development.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5409 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/app/database_ops/retrieval/chunk/utils.py`
```
def get_m_ef_construction(capacity: int, embedding_size: int):
    if capacity <= 1000:
        m, ef_construction = 8, 32
    else:
        # todo: support more capacity
        raise Exception("capacity is too large")

    return m, ef_construction


def get_ef_search(capacity: int, num_chunks: int, embedding_size: int):
    m, ef_construction = get_m_ef_construction(capacity=capacity, embedding_size=embedding_size)
    ef_search = round(ef_construction * 0.65)
    return ef_search

```

### Core Architecture Module: `backend/app/database_ops/retrieval/record/utils.py`
```
from typing import List
from app.models import Collection, Chunk
import json
from tkhelper.utils import current_timestamp_int_milliseconds


async def insert_record_chunks(
    conn,
    collection_id: str,
    record_id: str,
    chunk_text_list: List[str],
    chunk_embedding_list: List[List[float]],
    chunk_num_tokens_list: List[int],
):
    """
    Insert record chunks
    :param conn:
    :param collection_id: the collection id
    :param record_id: the record id
    :param chunk_text_list: the text list of the chunks to be created
    :param chunk_embedding_list: the embedding list of the chunks to be created
    :param chunk_num_tokens_list: the num_tokens list of the chunks to be created
    :return:
    """

    # prepare chunk insert sql
    num_chunks = len(chunk_text_list)
    chunk_table_name = Collection.get_chunk_table_name(collection_id)

    # make different timestamps for each chunk
    current_timestamp = current_timestamp_int_milliseconds()
    timestamps = [current_timestamp + i for i in range(len(chunk_text_list))]

    insert_values_sql = ", ".join(
        [
            f"("
            f"${i * 9 + 1}, "
            f"${i * 9 + 2}, "
            f"${i * 9 + 3}, "
            f"${i * 9 + 4}, "
            f"${i * 9 + 5}, "
            f"${i * 9 + 6}, "
            f"${i * 9 + 7}, "
            f"${i * 9 + 8}, "
            f"${i * 9 + 9}"
            f")"
            for i in range(num_chunks)
        ]
    )

    #  prepare chunk insert params
    params = []
    for i in range(num_chunks):
        new_chunk_id = Chunk.generate_random_id()
        params.extend(
            [
                new_chunk_id,
                record_id,
                collection_id,
                json.dumps(chunk_embedding_list[i]),
                chunk_text_list[i],
                "{}",
                timestamps[i],
                timestamps[i],
                chunk_num_tokens_list[i],
            ]
        )

    # make the final insert sql
    insert_chunks_sql = f"""
        INSERT INTO {chunk_table_name}(chunk_id, record_id, collection_id, embedding, content,
         metadata, updated_timestamp, created_timestamp, num_tokens)
        VALUES {insert_values_sql};
    """

    # insert chunks
    await conn.execute(insert_chunks_sql, *params)


async def delete_record_chunks(conn, collection_id: str, record_id: str) -> int:
    """
    Delete record chunks
    :param conn:
    :param collection_id: the collection id
    :param record_id: the record id
    :return: the content_bytes sum of chunks, and the number of chunks
    """

    chunk_table_name = Collection.get_chunk_table_name(collection_id)

    # count chunks and the content_bytes sum of chunks
    result = await conn.fetchrow(
        f"""
        SELECT COUNT(*)
        FROM {chunk_table_name}
        WHERE record_id = $1
    """,
        record_id,
    )
    num_chunks = result[0] or 0

    await conn.execute(
        f"""
        DELETE FROM {chunk_table_name}
        WHERE record_id = $1
    """,
        record_id,
    )

    return num_chunks

```

### Core Architecture Module: `backend/app/database_ops/utils.py`
```
from typing import Dict
from tkhelper.utils import current_timestamp_int_milliseconds
import json
from typing import Any, Optional
from tkhelper.models import SortOrderEnum, ListResult
import logging

logger = logging.getLogger(__name__)


async def update_object(conn, update_dict: Dict, update_time: bool, table_name: str, equal_filters: Dict) -> None:
    # 2. build update dict
    pg_update_dict = update_dict.copy()
    for key, value in update_dict.items():
        if isinstance(value, (dict, list)):
            pg_update_dict[key] = json.dumps(value)

    timestamp_int = current_timestamp_int_milliseconds()

    # 3. Prepare the SET clause for the update query
    updates = ", ".join(
        f"{key} = ${idx}" for idx, key in enumerate(pg_update_dict.keys(), start=len(equal_filters) + 2)
    )
    if update_time:
        updates += ", updated_timestamp = $1"

    # 4. Prepare the WHERE clause for the update query
    conditions = " AND ".join(f"{key} = ${idx}" for idx, key in enumerate(equal_filters.keys(), start=2))

    # 5. Prepare the final query
    query = f"UPDATE {table_name} SET {updates} WHERE {conditions}"

    # 6. Prepare the arguments for the query
    args = [timestamp_int, *equal_filters.values(), *pg_update_dict.values()]

    # 7. Execute the query
    await conn.execute(query, *args)


async def get_object_total(
    conn,
    table_name: str,
    prefix_filters: Optional[Dict] = None,
    equal_filters: Optional[Dict] = None,
) -> int:
    """
    Build sql script for get total count operations
    :param conn: postgres connection
    :param table_name: table name
    :param prefix_filters: the prefix filters, key is the column name, value is the prefix value
    :param equal_filters: the equal filters, key is the column name, value is the equal value
    :return: sql query script and params
    """

    params = []
    where_clauses = []

    # add prefix filters
    if prefix_filters:
        for field, value in prefix_filters.items():
            if value is not None:
                where_clauses.append(f"{field} LIKE ${len(params) + 1}")
                params.append(f"{value}%")

    # add equal filters
    if equal_filters:
        for field, value in equal_filters.items():
            if value is not None:
                where_clauses.append(f"{field} = ${len(params) + 1}")
                params.append(value)

    # build query
    combined_where_clause = " AND ".join(where_clauses)
    combined_where_clause = f"WHERE {combined_where_clause}" if where_clauses else ""

    query = f"""
      SELECT COUNT(*)
      FROM {table_name}
      {combined_where_clause}
      """

    value = await conn.fetchval(query, *params)
    return value


async def list_objects(
    conn,
    object_class,
    table_name: str,
    order: SortOrderEnum,
    sort_field: str,
    object_id_name: Optional[str],
    limit: Optional[int] = None,
    after_id: Optional[str] = None,
    after_value: Optional[Any] = None,
    before_id: Optional[str] = None,
    before_value: Optional[Any] = None,
    offset: Optional[int] = None,
    prefix_filters: Optional[Dict] = None,
    equal_filters: Optional[Dict] = None,
) -> ListResult:
    """
    Build sql script for listing operations
    :param conn: postgres connection
    :param object_class: the class of the object to build
    :param table_name: table name
    :param limit: the maximum number of records to return
    :param order: the order of records to return, desc or asc
    :param sort_field: the field to sort records by
    :param object_id_name: the name of the object id
    :param after_value: the cursor represented by a value to fetch the next page
    :param after_id: the object id of the after cursor
    :param before_value: the cursor represented by a value to fetch the previous page
    :param before_id: the object id of the before cursor
    :param offset: the offset of records to return
    :param prefix_filters: the prefix filters, key is the column name, value is the prefix value
    :param equal_filters: the equal filters, key is the column name, value is the equal value
    :return: a tuple of list of objects, total_count and has_more

    """

    params = []
    where_clauses = []

    # assume all id fields are named as {table_name}_id
    secondary_sort_field = object_id_name
    after_secondary_value = after_id
    before_secondary_value = before_id

    # add prefix filters
    if prefix_filters:
        for field, value in prefix_filters.items():
            if value is not None:
                where_clauses.append(f"{field} LIKE ${len(params) + 1}")
                params.append(f"{value}%")

    # add equal filters
    if equal_filters:
        for field, value in equal_filters.items():
            if value is not None:
                where_clauses.append(f"{field} = ${len(params) + 1}")
                params.append(value)

    # add timestamp condition
    sql_order = "ASC" if order == SortOrderEnum.ASC else "DESC"
    if after_value is not None and after_secondary_value is not None:
        operator = ">" if order == SortOrderEnum.ASC else "<"
        where_clauses.append(
            f"({sort_field}, {secondary_sort_field}) {operator} (${len(params) + 1}, ${len(params) + 2})"
        )
        params.extend([after_value, after_secondary_value])

    # if using before value, we need to reverse the order
    if before_value is not None and before_secondary_value is not None:
        operator = "<" if order == SortOrderEnum.ASC else ">"
        where_clauses.append(
            f"({sort_field}, {secondary_sort_field}) {operator} (${len(params) + 1}, ${len(params) + 2})"
        )
        params.extend([before_value, before_secondary_value])
        sql_order = "DESC" if order == SortOrderEnum.ASC else "ASC"

    # combine where clauses
    combined_where_clause = " AND ".join(where_clauses)
    combined_where_clause = f"WHERE {combined_where_clause}" if where_clauses else ""

    # offset
    sql_offset = f"OFFSET ${len(params) + 1}" if offset is not None else ""
    if offset is not None:
        params.append(offset)

    # fetch one more object than the limit to check for 'has_more'
    limit_clause = ""
    if limit is not None:
        extended_limit = limit + 1
        limit_clause = f"LIMIT ${len(params) + 1}"
        params.append(extended_limit)

    # build query
    query = f"""
    SELECT *
    FROM {table_name}
    {combined_where_clause}
    ORDER BY {sort_field} {sql_order}, {secondary_sort_field} {sql_order}
    {limit_clause}
    {sql_offset}
    """

    # fetch rows
    rows = await conn.fetch(query, *params)

    # build objects
    objs = [object_class.build(row) for row in rows]

    # check if there are more objects than the limit
    has_more = len(objs) > limit if limit else False

    # If using before value, we need to adjust the objs list
    if before_value:
        # Adjust the list to contain only up to 'limit' models
        objs = objs[:limit] if limit else objs
        # Reverse the list to return the correct order
        objs.reverse()

    # If not using before value, adjust normally
    else:
        # Adjust the list to contain only up to 'limit' models
        objs = objs[:limit] if limit else objs

    # get total count
    total = await get_object_total(conn, table_name, prefix_filters, equal_filters)

    return objs, total, has_more

```

### Core Architecture Module: `backend/app/routes/file/utils.py`
```
from enum import Enum
from typing import Dict

from app.models.file import UploadFilePurpose, UploadImagePurpose
from tkhelper.error import raise_request_validation_error


class UploadFileModule(str, Enum):
    ASSISTANT = "assistant"
    RETRIEVAL = "retrieval"


class PurposeInfo:
    def __init__(
        self,
        module: UploadFileModule,
        id_prefix: str,
        service_name: str,
        policy_name: str,
        allow_file_formats: Dict[str, str],
    ):
        self.module = module
        self.id_prefix = id_prefix
        self.service_name = service_name
        self.policy_name = policy_name
        self.allow_file_formats = allow_file_formats


file_purpose_dict = {
    UploadFilePurpose.RECORD_FILE: PurposeInfo(
        UploadFileModule.RETRIEVAL,
        "Jde5",
        "retrieval",
        "record_file_size_limit_mb",
        {
            "pdf": "pdf",
            "docx": "docx",
            "md": "md",
            "txt": "txt",
            "html": "html",
            "htm": "html",
        },
    ),
}


image_purpose_dict = {
    UploadImagePurpose.USER_MESSAGE_IMAGE: PurposeInfo(
        UploadFileModule.ASSISTANT,
        "umIM",
        "assistant",
        "user_message_image_size_limit_mb",
        {"jpg": "jpg", "jpeg": "jpg", "png": "png"},
    ),
}


def check_file_size(limit_mb: int, size: int):
    if size > limit_mb * 1024 * 1024:
        raise_request_validation_error("File size is too large.")


def check_ext(purpose_info: PurposeInfo, ext: str):
    if ext not in purpose_info.allow_file_formats:
        raise_request_validation_error(
            f"File format is not supported, supported formats: {', '.join(purpose_info.allow_file_formats.keys())}"
        )
    return purpose_info.allow_file_formats[ext]

```

### Core Architecture Module: `backend/app/routes/openai/utils/__init__.py`
```
from .adapt_chat_completion import *
from .adapt_text_embedding import *

```

### Core Architecture Module: `backend/app/routes/openai/utils/adapt_chat_completion.py`
```
from typing import Dict
from tkhelper.error import raise_request_validation_error
import json
from ..schemas import OpenaiChatCompletionRequest, OpenaiChatCompletionResponse, OpenaiChoice, OpenaiCompletionUsage
from app.schemas import ChatCompletionRequest
from app.models import (
    ChatCompletionSystemMessage,
    ChatCompletionUserMessage,
    ChatCompletionAssistantMessage,
    ChatCompletionFunctionMessage,
    ChatCompletionFunction,
    ChatCompletionFunctionCall,
    ChatCompletionRole,
    ChatCompletionFunctionParameters,
    ChatCompletionFinishReason,
    ChatCompletion,
)
from ..models import *
from .utils import generate_random_chat_completion_id, generate_random_function_call_id


def adapt_openai_chat_completion_input(data: OpenaiChatCompletionRequest) -> ChatCompletionRequest:
    model_id = data.model
    taskingai_tool_id = generate_random_function_call_id()

    def convert_message(message: Dict):
        role = message.get("role")
        content = message.get("content")
        tool_calls = message.get("tool_calls")
        func_call = message.get("function_call")

        if not role:
            raise_request_validation_error("role is required for each message.")

        if role == "system":
            return ChatCompletionSystemMessage(content=content, role=ChatCompletionRole.SYSTEM)
        elif role == "user":
            return ChatCompletionUserMessage(content=content, role=ChatCompletionRole.USER)
        elif role == "assistant":
            function_calls = []
            if tool_calls:
                if not isinstance(tool_calls, list):
                    raise_request_validation_error("tool_calls must be a list.")
                function_calls.extend(
                    [
                        ChatCompletionFunctionCall(
                            name=tool_call["function"]["name"],
                            arguments=json.loads(tool_call["function"]["arguments"]),
                            id=taskingai_tool_id,
                        )
                        for tool_call in tool_calls
                    ]
                )
            elif func_call:
                if not isinstance(func_call, dict):
                    raise_request_validation_error("function_call must be a dictionary.")
                function_calls.append(
                    ChatCompletionFunctionCall(
                        name=func_call["name"], arguments=json.loads(func_call["arguments"]), id=taskingai_tool_id
                    )
                )
            function_calls = function_calls if function_calls else None
            return ChatCompletionAssistantMessage(
                content=content, role=ChatCompletionRole.ASSISTANT, function_calls=function_calls
            )
        elif role == "function" or role == "tool":
            return ChatCompletionFunctionMessage(
                content=content, role=ChatCompletionRole.FUNCTION, id=taskingai_tool_id
            )
        else:
            raise ValueError(f"Unsupported message type: {type(message)}")

    messages = [convert_message(msg).model_dump() for msg in data.messages]

    if data.function_call in ["none", "auto"]:
        function_call = data.function_call
    elif isinstance(data.function_call, OpenaiChatCompletionFunctionCallOptionParam):
        function_call = data.function_call.name
    else:
        function_call = None

    functions = None
    if data.functions:
        functions = [
            ChatCompletionFunction(
                name=function.name,
                description=function.description,
                parameters=ChatCompletionFunctionParameters(**function.parameters.model_dump()),
            )
            for function in data.functions
        ]
    if data.tools:
        functions = [
            ChatCompletionFunction(
                name=tool.function.name,
                description=tool.function.description,
                parameters=ChatCompletionFunctionParameters(**tool.function.parameters.model_dump()),
            )
            for tool in data.tools
        ]
    return ChatCompletionRequest(
        model_id=model_id, messages=messages, function_call=function_call, functions=functions, stream=data.stream
    )


def adapt_openai_chat_completion_response(
    chat_completion: ChatCompletion, data: OpenaiChatCompletionRequest
) -> OpenaiChatCompletionResponse:
    finish_reason_map = {
        ChatCompletionFinishReason.STOP: "stop",
        ChatCompletionFinishReason.LENGTH: "length",
        ChatCompletionFinishReason.FUNCTION_CALLS: "tool_calls",
        ChatCompletionFinishReason.RECITATION: "stop",
        ChatCompletionFinishReason.ERROR: "content_filter",
        ChatCompletionFinishReason.UNKNOWN: "stop",
    }

    finish_reason = finish_reason_map.get(chat_completion.finish_reason, "stop")
    tool_calls, function_call = None, None
    if data.tools:
        tool_calls = (
            [
                OpenaiChatCompletionMessageToolCallParam(
                    id=fc.id,
                    function=OpenaiFunctionCall(name=fc.name, arguments=json.dumps(fc.arguments)),
                    type="function",
                )
                for fc in chat_completion.message.function_calls
            ]
            if chat_completion.message.function_calls
            else None
        )
    elif data.functions:
        function_call = (
            {
                "name": chat_completion.message.function_calls[0].name,
                "arguments": json.dumps(chat_completion.message.function_calls[0].arguments),
            }
            if chat_completion.message.function_calls
            else None
        )
        finish_reason = "function_call"

    openai_message = OpenaiChatCompletionAssistantMessageParam(
        role="assistant",
        content=chat_completion.message.content if not function_call else None,
        tool_calls=tool_calls,
        function_call=function_call,
        name=None,
    )

    usage = OpenaiCompletionUsage(
        prompt_tokens=chat_completion.usage.input_tokens,
        completion_tokens=chat_completion.usage.output_tokens,
        total_tokens=chat_completion.usage.input_tokens + chat_completion.usage.output_tokens,
    )

    choice = OpenaiChoice(finish_reason=finish_reason, index=0, logprobs=None, message=openai_message)
    openai_response = OpenaiChatCompletionResponse(
        id=generate_random_chat_completion_id(),
        choices=[choice],
        created=chat_completion.created_timestamp // 1000,
        model=data.model,
        object="chat.completion",
        system_fingerprint=None,  # Optional handling
        usage=usage,  # Optional handling
    )
    return openai_response


def adapt_openai_chat_completion_stream_chunk(chunk: Dict, chunk_id: str, data: OpenaiChatCompletionRequest) -> Dict:
    # Basic data extraction from the chunk
    chat_completion_chunk = {
        "id": chunk_id,
        "created": chunk["created_timestamp"] // 1000,  # Convert from ms to s
        "model": data.model,
        "object": "chat.completion.chunk",
        "system_fingerprint": None,  # Optional and static for example
        "choices": [],
    }

    # Assuming the 'delta' field contains serialized JSON (as a string) for the tool_calls
    if "delta" in chunk:
        # Deserialize the delta content
        # Constructing the OpenaiChoiceDelta
        delta = {
            "content": chunk["delta"],
            "role": chunk["role"],
        }

        # Constructing the OpenaiChoice
        chat_completion_chunk["choices"].append(
            {
                "delta": delta,
                "finish_reason": None,  # Example, no data to infer this
                "index": chunk["index"],
                "logprobs": None,
            }
        )

    return chat_completion_chunk


def adapt_openai_chat_completion_stream(
    chat_completion: Dict, chunk_id: str, data: OpenaiChatCompletionRequest
) -> Dict:
    message = chat_completion["message"]
    content = message.get("content")
    role = message["role"]
    created_timestamp_seconds = chat_completion["created_timestamp"] // 1000

    function_calls = message.get("function_calls")
    if not function_calls:
        return None

    if data.tools:
        tool_calls = []
        for call in function_calls:
            tool_call = {
                "index": 0,
                "id": call["id"],
                "function": {"name": call["name"], "arguments": json.dumps(call["arguments"])},
                "type": "function",
            }
            tool_calls.append(tool_call)

        delta = {"content": content, "role": role, "tool_calls": tool_calls}
        finish_reason = "tool_calls"
    else:
        function_call = {
            "name": function_calls[0]["name"],
            "arguments": json.dumps(function_calls[0]["arguments"]),
        }
        delta = {"content": content, "role": role, "function_call": function_call}
        finish_reason = "function_call"

    choice = {"delta": delta, "finish_reason": finish_reason, "index": 0, "logprobs": None}

    openai_chat_completion_chunk = {
        "id": chunk_id,
        "choices": [choice],
        "created": created_timestamp_seconds,
        "model": data.model,
        "object": "chat.completion.chunk",
        "system_fingerprint": None,  # Optional, add if necessary
    }

    return openai_chat_completion_chunk


async def to_openai_chunk(c: Dict, chunk_id: str, data: OpenaiChatCompletionRequest):
    if c.get("object") == "ChatCompletionChunk":
        return adapt_openai_chat_completion_stream_chunk(c, chunk_id, data)
    elif c.get("object") == "ChatCompletion":
        return adapt_openai_chat_completion_stream(c, chunk_id, data)
    return None

```

### Core Architecture Module: `backend/app/routes/openai/utils/adapt_text_embedding.py`
```
from app.schemas.model import TextEmbeddingRequest, TextEmbeddingResponse
from app.routes.openai.schemas import (
    OpenaiTextEmbeddingRequest,
    OpenaiTextEmbeddingResponse,
    OpenaiEmbeddingUsage,
    OpenaiEmbedding,
)
from tkhelper.error import raise_request_validation_error


def adapt_openai_text_embedding_input(data: OpenaiTextEmbeddingRequest) -> TextEmbeddingRequest:
    model_id = data.model

    if isinstance(data.input, str):
        input_data = data.input
    elif isinstance(data.input, list) and all(isinstance(item, str) for item in data.input):
        input_data = data.input
    else:
        raise_request_validation_error("input must be a string or a list of strings.")

    # Construct the new TextEmbeddingRequest
    return TextEmbeddingRequest(model_id=model_id, input=input_data, input_type=None)


def adapt_openai_text_embedding_response(
    response: TextEmbeddingResponse, data: OpenaiTextEmbeddingRequest
) -> OpenaiTextEmbeddingResponse:
    openai_embeddings = [
        OpenaiEmbedding(embedding=embedding.embedding, index=embedding.index, object="embedding")
        for embedding in response.data
    ]

    # Extract the model used from the original request to OpenAI as it's not part of the TextEmbeddingResponse.
    model_used = data.model

    # Map the usage data directly since both usages are expected to be compatible or have the same format.
    # If there are differences in format, appropriate conversions or mappings need to be applied.
    openai_usage = OpenaiEmbeddingUsage(
        prompt_tokens=response.usage.input_tokens, total_tokens=response.usage.input_tokens
    )

    # Construct the new OpenaiTextEmbeddingResponse using the mapped data.
    return OpenaiTextEmbeddingResponse(
        data=openai_embeddings,
        model=model_used,
        object="list",  # This is always 'list' as specified.
        usage=openai_usage,
    )

```

### Core Architecture Module: `backend/app/routes/openai/utils/utils.py`
```
from tkhelper.utils import generate_random_id

__all__ = [
    "generate_random_function_call_id",
    "generate_random_chat_completion_id",
]


def generate_random_function_call_id():
    """
    Generate a random function call ID.
    :return: The random function call ID.
    """
    return "P3lf" + generate_random_id(20)


def generate_random_chat_completion_id():
    """
    Generate a random chat completion ID.
    :return: The random chat completion ID.
    """
    return "chatcmpl-" + generate_random_id(29)

```

### Core Architecture Module: `backend/app/routes/utils.py`
```
from starlette.requests import Request
from fastapi import HTTPException
from typing import Dict, Type, Tuple
from pydantic import ValidationError
import re
import json

from tkhelper.error import raise_http_error, ErrorCode, raise_request_validation_error
from tkhelper.models import ModelOperator, ModelEntity

from app.config import CONFIG
from app.services.auth.admin import verify_admin_token
from app.services.auth.apikey import verify_apikey


__all__ = [
    "check_http_error",
    "app_admin_auth_info_required",
    "api_auth_info_required",
    "auth_info_required",
    "check_path_params",
    "path_params_required",
    "validate_list_filter",
    "is_model_id",
    "is_assistant_id",
]


def check_http_error(response):
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json().get("error", {}))


async def app_admin_auth_info_required(request: Request) -> Dict:
    ret = {}

    # 1. extract token
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        ret["token"] = authorization[7:]

    if not ret.get("token"):
        raise_http_error(ErrorCode.TOKEN_VALIDATION_FAILED, message="Token is missing")

    # 2. verify token
    admin = await verify_admin_token(token=ret["token"])
    ret["admin_id"] = admin.admin_id

    return ret


async def api_auth_info_required(request: Request) -> Dict:
    apikey = None

    # 1. extract apikey
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        apikey = authorization[7:]

    if not apikey:
        raise_http_error(ErrorCode.APIKEY_VALIDATION_FAILED, message="API Key validation failed")

    # 2. verify apikey
    await verify_apikey(apikey=apikey)
    ret = {
        "apikey": apikey,
    }

    return ret


async def auth_info_required(request: Request) -> Dict:
    if CONFIG.WEB:
        return await app_admin_auth_info_required(request)

    elif CONFIG.API:
        return await api_auth_info_required(request)

    raise NotImplementedError("Unknown auth type")


alphanumeric_pattern = re.compile("^[_a-zA-Z0-9]+$")


def check_path_params(
    model_operator: ModelOperator,
    object_id_required: bool,
    path_params: Dict,
):
    """Check if kwargs contains all the primary key fields except the id field."""
    entity_class = model_operator.entity_class
    id_field_name = entity_class.id_field_name()
    primary_key_fields = entity_class.primary_key_fields()

    # Only the id field is required
    required_fields = [field for field in primary_key_fields if "id" in field]

    # If the id field is required, add it to the required fields
    for k in required_fields:
        if k not in path_params and (k != id_field_name or object_id_required):
            raise_request_validation_error(f"Missing path parameter: {k}")

    # check all oath params are alphanumeric
    for k, v in path_params.items():
        if not alphanumeric_pattern.match(v):
            raise_request_validation_error(f"Invalid path parameter: {k}")

    # Check each id field
    try:
        entity_class.validate_path_params(path_params)
    except ValidationError as exc:
        detail = exc.errors()[0]
        raise_request_validation_error(f"{detail['loc'][0]}: {detail['msg']}")

    return


async def path_params_required(request: Request) -> Dict[str, str]:
    if len(request.path_params) > 0:
        return request.path_params
    return {}


async def validate_list_filter(
    model_operator: ModelOperator,
    path_params: Dict,
    prefix_filter: str = "",
    equal_filter: str = "",
) -> Tuple[Dict, Dict]:
    # check parent objects exist
    entity_class = model_operator.entity_class
    for parent_model, parent_operator in zip(entity_class.parent_models(), entity_class.parent_operator()):
        parent_model: Type[ModelEntity]
        parent_operator: ModelOperator
        parent_id = path_params.get(parent_model.id_field_name())
        if not parent_id:
            raise_request_validation_error(f"Missing {parent_model.id_field_name()}")
        parent_entity = await parent_operator.get(**path_params)
        if not parent_entity:
            raise_request_validation_error(f"Parent {parent_model.object_name()} not found")

    prefix_filter_dict = {}
    equal_filter_dict = {}

    if CONFIG.API:
        if prefix_filter:
            raise_request_validation_error("Prefix filter is not supported")
        if equal_filter:
            raise_request_validation_error("Equal filter is not supported")

    # check prefix_filter keys
    if entity_class.list_prefix_filter_fields() and prefix_filter:
        try:
            prefix_filter_dict = json.loads(prefix_filter)
        except json.JSONDecodeError:
            raise_request_validation_error("Invalid prefix filter format")
        for k in prefix_filter_dict:
            if k not in entity_class.list_prefix_filter_fields():
                raise_request_validation_error(f"Invalid prefix filter: {k}")

    # check equal_filter keys
    if entity_class.list_equal_filter_fields() and equal_filter:
        try:
            equal_filter_dict = json.loads(equal_filter)
        except json.JSONDecodeError:
            raise_request_validation_error("Invalid equal filter format")
        for k in equal_filter_dict:
            if k not in entity_class.list_equal_filter_fields():
                raise_request_validation_error(f"Invalid equal filter: {k}")

    return prefix_filter_dict, equal_filter_dict


def is_model_id(model_id: str) -> bool:
    return len(model_id) == 8


def is_assistant_id(assistant_id: str) -> bool:
    return len(assistant_id) == 24

```

### Core Architecture Module: `backend/app/schemas/utils.py`
```
from typing import Dict, List
import re
import json
from tkhelper.error import raise_http_error, ErrorCode

allowed_param_type = ["string", "number", "integer", "boolean"]
MAXIMUM_PARAMETER_DESCRIPTION_LENGTH = 300


def check_update_keys(data: Dict, keys: List[str]):
    if not any([(data.get(key) is not None) for key in keys]):
        raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message="At least one field should be filled")


def validate_non_nested_json(json_dict: Dict):
    for key, value in json_dict.items():
        if isinstance(value, dict):
            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message=f"Nested JSON is not allowed in {key}")


def validate_identifier(identifier: str):
    r = "^[a-zA-Z_][a-zA-Z0-9_]*$"
    if not re.match(r, identifier):
        raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message=f"{identifier} is an invalid identifier.")
    return identifier

    # valid = identifier.isidentifier() and identifier[0].islower() and len(identifier) <= 255
    # if not valid:
    #     raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message='Invalid identifier')


# get params like {{param}} from object
def get_params(string: str = None, string_list: List[str] = None, json_dict: Dict = None, json_list: List[Dict] = None):
    params = set()

    if string:
        params.update(re.findall("{{(.*?)}}", string))

    if string_list:
        for s in string_list:
            params.update(re.findall("{{(.*?)}}", s))

    if json_dict:
        # make json to string
        json_str = json.dumps(json_dict)
        params.update(re.findall("{{(.*?)}}", json_str))

    if json_list:
        for jd in json_list:
            # make json to string
            js = json.dumps(jd)
            params.update(re.findall("{{(.*?)}}", js))

    param_list = list(params)
    return param_list


def validate_prompt_template(prompt_template: List[str]):
    # check every item in prompt_template is string and not empty
    for item in prompt_template:
        if not isinstance(item, str):
            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message="Prompt template should be a list of string.")
        if not item:
            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message="Prompt template should not be empty.")


def validate_metadata(metadata: Dict):
    for k, v in metadata.items():
        if not isinstance(v, str):
            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message=f"Value '{v}' is not a string")
        if not isinstance(k, str):
            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message=f"Key '{k}' is not a string")
        if len(k) > 64:
            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message=f"Key '{k}' exceeds 64 characters")
        if len(v) > 512:
            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, message=f"Value '{v}' exceeds 512 characters")
    return metadata


def validate_list_cursors(data: Dict):
    if data.get("order") and (data["order"] not in ["asc", "desc"]):
        raise ValueError("order should be asc or desc")

    count = sum([1 for attr in ("after", "before", "offset") if data.get(attr) is not None])
    if count > 1:
        raise ValueError("cursor params cannot be used at the same time.")
    return data

```

### Core Architecture Module: `backend/app/services/assistant/generation/stateful_normal_session.py`
```
from fastapi import HTTPException
from typing import Dict
from tkhelper.error import raise_http_error, ErrorCode
from tkhelper.schemas import BaseDataResponse
import logging

from app.models import Assistant, Chat

from .session import Session
from .utils import *
from .log import *

logger = logging.getLogger(__name__)


class StatefulNormalSession(Session):
    def __init__(self, assistant: Assistant, chat: Chat, save_logs: bool):
        super().__init__(assistant, chat, save_logs)

    async def generate(self, system_prompt_variables: Dict):
        try:
            await self.prepare(
                stream=False,
                system_prompt_variables=system_prompt_variables,
                retrieval_log=self.save_logs,
            )
            await self.chat.lock()

            function_calls_round_index = 0

            while True:
                try:
                    chat_completion_event_id = generate_random_event_id()
                    # append chat completion input log
                    if self.save_logs:
                        chat_completion_input_log_dict = build_chat_completion_input_log_dict(
                            session_id=self.session_id,
                            event_id=chat_completion_event_id,
                            model=self.model,
                            messages=self.chat_completion_messages,
                            functions=self.chat_completion_functions,
                        )
                        self.logs.append(chat_completion_input_log_dict)

                    # inference
                    (
                        chat_completion_assistant_message_dict,
                        chat_completion_function_calls_dict_list,
                        usage_dict,
                        _,
                    ) = await self.inference()

                    # append chat completion output log
                    if self.save_logs:
                        chat_completion_output_log_dict = build_chat_completion_output_log_dict(
                            session_id=self.session_id,
                            event_id=chat_completion_event_id,
                            model=self.model,
                            message=chat_completion_assistant_message_dict,
                            usage=usage_dict,
                        )
                        self.logs.append(chat_completion_output_log_dict)

                except HTTPException as e:
                    raise MessageGenerationException(f"Error occurred in chat completion inference. {e.detail}")
                except Exception as e:
                    raise MessageGenerationException(f"Error occurred in chat completion inference")

                logger.debug(f"chat_completion_assistant_message = {chat_completion_assistant_message_dict}")
                logger.debug(f"chat_completion_function_calls_dict_list = {chat_completion_function_calls_dict_list}")

                if chat_completion_function_calls_dict_list:
                    function_calls_round_index += 1
                    try:
                        await self.use_tool(
                            chat_completion_function_calls_dict_list,
                            round_index=function_calls_round_index,
                            log=self.save_logs,
                        )
                        async for _ in self.run_tools(chat_completion_function_calls_dict_list):
                            pass
                    except MessageGenerationException as e:
                        logger.error(f"MessageGenerationException occurred in using the tools: {e}")
                        raise e
                    except Exception as e:
                        logger.error(f"Error occurred in using the tools: {e}")
                        raise MessageGenerationException(f"Error occurred in using the tools")

                else:
                    break

            message = await self.create_assistant_message(
                content_text=chat_completion_assistant_message_dict["content"],
                logs=self.logs if self.save_logs else None,
            )
            return BaseDataResponse(data=message.to_response_dict())

        except MessageGenerationInvalidRequestException as e:
            logger.error(f"StatefulNormalSession.generate: HTTPException error = {e}")
            raise_http_error(ErrorCode.INVALID_REQUEST, message=str(e))

        except MessageGenerationException as e:
            logger.error(f"StatefulNormalSession.generate: MessageGenerationException error = {e}")
            raise_http_error(ErrorCode.GENERATION_ERROR, message=str(e))

        except Exception as e:
            logger.error(f"StatefulNormalSession.generate: Exception error = {e}")
            raise_http_error(
                ErrorCode.INTERNAL_SERVER_ERROR, message=str("Assistant message not generated due to an unknown error.")
            )

        finally:
            await self.chat.unlock()

```

### Core Architecture Module: `backend/app/services/assistant/generation/stateful_stream_session.py`
```
import asyncio
import json
from typing import Dict

from fastapi import HTTPException
from tkhelper.utils import SSE_DONE_MSG
from tkhelper.error import ErrorCode

from app.models import Assistant, Chat
from .session import *
from .log import *
from .utils import *

import logging

logger = logging.getLogger(__name__)


def error_message(code, message: str):
    return {
        "object": "Error",
        "code": code,
        "message": message,
    }


class StatefulStreamSession(Session):
    def __init__(self, assistant: Assistant, chat: Chat, stream: bool, debug: bool, save_logs: bool):
        super().__init__(assistant, chat, save_logs)
        self.stream = stream
        self.debug = debug

    async def stream_generate(self, system_prompt_variables: Dict):
        try:
            await self.prepare(
                stream=self.stream,
                system_prompt_variables=system_prompt_variables,
                retrieval_log=self.debug or self.save_logs,
            )
            await self.chat.lock()

            if self.debug and self.logs:
                for log_dict in self.logs:
                    yield f"data: {json.dumps(log_dict)}\n\n"
                    await asyncio.sleep(0.1)

            function_calls_round_index = 0
            while True:
                chat_completion_function_calls_dict_list = None
                chat_completion_assistant_message_dict = None

                try:
                    chat_completion_event_id = generate_random_event_id()
                    if self.debug or self.save_logs:
                        chat_completion_input_log_dict = build_chat_completion_input_log_dict(
                            session_id=self.session_id,
                            event_id=chat_completion_event_id,
                            model=self.model,
                            messages=self.chat_completion_messages,
                            functions=self.chat_completion_functions,
                        )
                        if self.save_logs:
                            self.logs.append(chat_completion_input_log_dict)
                        if self.debug:
                            yield f"data: {json.dumps(chat_completion_input_log_dict)}\n\n"

                    if self.stream:
                        usage_dict = None
                        logger.debug(f"completion start inference, stream = {self.stream}")
                        async for t, data in self.stream_inference(message_chunk_object_name="MessageChunk"):
                            logger.debug(f"completion streaming, {t}: {data}")
                            if t == MESSAGE_CHUNK:
                                yield f"data: {json.dumps(data)}\n\n"
                            elif t == MESSAGE:
                                chat_completion_assistant_message_dict = data
                                function_calls = data.get("function_calls")
                                if function_calls:
                                    chat_completion_function_calls_dict_list = function_calls
                            elif t == USAGE:
                                usage_dict = data
                            elif t == MESSAGE_RESPONSE:
                                pass
                            else:
                                raise MessageGenerationException("Unknown data type")
                    else:
                        logger.debug(f"completion start inference, stream = {self.stream}")
                        (
                            chat_completion_assistant_message_dict,
                            chat_completion_function_calls_dict_list,
                            usage_dict,
                            _,
                        ) = await self.inference()

                    if self.debug or self.save_logs:
                        chat_completion_output_log_dict = build_chat_completion_output_log_dict(
                            session_id=self.session_id,
                            event_id=chat_completion_event_id,
                            model=self.model,
                            message=chat_completion_assistant_message_dict,
                            usage=usage_dict,
                        )
                        if self.save_logs:
                            self.logs.append(chat_completion_output_log_dict)
                        if self.debug:
                            yield f"data: {json.dumps(chat_completion_output_log_dict)}\n\n"

                except MessageGenerationException as e:
                    raise e
                except HTTPException as e:
                    raise MessageGenerationException(f"Error occurred in chat completion inference. {e.detail}")
                except Exception as e:
                    logger.error(f"Error occurred in chat completion inference: {e}")
                    raise MessageGenerationException(f"Error occurred in chat completion inference")

                if chat_completion_function_calls_dict_list:
                    function_calls_round_index += 1
                    try:
                        logger.debug(f"FUNCTION_CALLS: tool_call = {chat_completion_function_calls_dict_list}")

                        # use and run tool. When debug is True, log the tool action call and result
                        tool_action_call_logs = await self.use_tool(
                            function_calls=chat_completion_function_calls_dict_list,
                            round_index=function_calls_round_index,
                            log=self.debug or self.save_logs,
                        )
                        if self.debug:
                            for tool_action_call_log_dict in tool_action_call_logs:
                                logger.debug(f"tool_action_call_log_dict = {tool_action_call_log_dict}")
                                yield f"data: {json.dumps(tool_action_call_log_dict)}\n\n"

                        # run tools

                        if self.debug:
                            async for tool_action_result_log_dict in self.run_tools(
                                function_calls=chat_completion_function_calls_dict_list, log=True
                            ):
                                logger.debug(f"tool_action_result_log_dict = {tool_action_result_log_dict}")
                                yield f"data: {json.dumps(tool_action_result_log_dict)}\n\n"
                        else:
                            async for _ in self.run_tools(chat_completion_function_calls_dict_list):
                                pass

                    except MessageGenerationException as e:
                        logger.error(f"MessageGenerationException occurred in using the tools: {e}")
                        raise e

                    except Exception as e:
                        logger.error(f"Error occurred in using the tools: {e}")
                        raise MessageGenerationException(f"Error occurred in using the tools")

                else:
                    break

            if not chat_completion_assistant_message_dict:
                raise MessageGenerationException("Assistant message not generated.")

            # raise MessageGenerationException("Manually raise error to test")
            message = await self.create_assistant_message(
                content_text=chat_completion_assistant_message_dict["content"],
                logs=self.logs if self.save_logs else None,
            )
            message_dict = message.to_response_dict()
            yield f"data: {json.dumps(message_dict)}\n\n"
            yield SSE_DONE_MSG

        except MessageGenerationInvalidRequestException as e:
            err_dict = error_message(code=ErrorCode.INVALID_REQUEST, message=str(e))
            yield f"data: {json.dumps(err_dict)}\n\n"
            yield SSE_DONE_MSG

        except MessageGenerationException as e:
            err_dict = error_message(code=ErrorCode.GENERATION_ERROR, message=str(e))
            yield f"data: {json.dumps(err_dict)}\n\n"
            yield SSE_DONE_MSG

        except Exception as e:
            err_dict = error_message(
                code=ErrorCode.UNKNOWN_ERROR,
                message="Assistant message not generated due to an unknown error.",
            )
            logger.error(f"stream_generate: unknown error occurred in stream_generate {e}")
            yield f"data: {json.dumps(err_dict)}\n\n"
            yield SSE_DONE_MSG

        finally:
            await self.chat.unlock()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #262** (2024-07-23): **Bug in Anthropic Stream Mode with Function Call Handling**
  *Symptoms*: **Describe the bug**  The stream_handle_function_calls function in Anthropic's stream mode is currently only passing and not executing the intended functionality. This issue causes function calls within the stream mode to be ineffective.  **To Reproduce** Steps to reproduce the behavior:  1. Set up a request to initialize Anthropic's stream mode. 2. Configure the request to include a function call. 3. Send the request and observe that the stream_handle_function_calls function only passes and does not execute the function call as expected.  **Expected behavior**  The stream_handle_function_calls function should execute the function calls correctly within Anthropic's stream mode, allowing the function to perform its intended operations.  **Desktop (please complete the following information):**  - OS: Windows 
  **Post-Mortem & Fix Analysis**:
  > @LinkW77 Thanks we'll look into it and fix asap

- **Issue #123** (2024-05-29): **chat_completion function don't work properly**
  *Symptoms*: I can create an assistant and chat with it properly, so the model does work well, but can't run the chat_completion function using the example code in the doc: `chat_completion_result = taskingai.inference.chat_completion(     model_id=model_id,     messages=[         {"role": "system", "content": "You are a health advisor providing nutritional advice. You should always reply with a professional, kind, and patient tone."},         {"role": "user", "content": "How much suger can a woman take in a day?"},     ] )` Keep getting this error in the picture. ![微信图片_20240523165900](https://github.com/TaskingAI/TaskingAI/assets/71247215/eed1c9b5-a35b-4cb7-9f46-b1a415b4118f)
  **Post-Mortem & Fix Analysis**:
  > @o3o1 Thanks for your feedback. If the chat completion API works in the playgrorund, It seems to be a client issue. we'll look into it and and provide a quick fix 
  > @jameszyao The UI won't response when confirm model selection in the 'Playground-Chat Completion' interface, but it works fine if you start playground via actions in the 'Models' interface. The function issue seems to occur after I ran a gradio demo, not sure if it's relevant.
  > @o3o1 we have released a new client SDK version v0.2.5. Please upgrade your TaskingAI client version using pip and see if the chat completion works now :-)

- **Issue #110** (2024-07-17): **Model Tpd3Vtx6 is not a text embedding model**
  *Symptoms*: **Describe the bug** This problem arose when using the ollama model  **To Reproduce** Steps to reproduce the behavior:  1.After creating an ollama using gemma, select the console prompt when creating a chat 2.Model Tpd3Vtx6 is not a text embedding model   **Expected behavior** Changing a few versions didn't fix the issue  for 2.0-2.2    **Screenshots** ![1](https://github.com/TaskingAI/TaskingAI/assets/52629438/04d5685c-7dbd-43d2-9c7b-6de51fcfd623) ![2](https://github.com/TaskingAI/TaskingAI/assets/52629438/21ab0566-c065-4f6f-8cda-b2554df3c297) ![3](https://github.com/TaskingAI/TaskingAI/assets/52629438/1e2cb62d-4cc0-4753-9369-e13ff100e3cd)  **Desktop (please complete the following information):**  - OS: [e.g. Windows] - Browser [e.g. chrome,] - Version [e.g. 22]  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > @450220020 Thanks for your feedback. We have made a quick fix and released a beta backend version, v0.2.3-beta-1. You can use the latest Docker Compose file in the master branch to upgrade the pod. We will continue working on an official version release next week. Please stay tuned :-)
  > Great, surprise, I didn't expect it so soon. I tested this version and found that the problem has been resolved. There are a few more sequential questions to follow, which I will send out in the previous format

- **Issue #95** (2024-04-07): **fix: read num_chunk before record update**
  *Symptoms*: # Pull Request  ## PR Description  read num_chunk before record update  ## Type of Change  - [x] Bug fix - [ ] New feature - [x] Performance enhancement - [ ] Code refactor - [ ] Documentation update - [ ] Other, please describe:  ## Checklist  Before submitting this PR, please make sure:  - [x] I have read the [CONTRIBUTING.md](/CONTRIBUTING.md) guidelines. - [x] I have tested my changes locally to ensure they are effective. - [x] I have updated the necessary documentation (if applicable).

- **Issue #90** (2024-04-07): **fix: message generation stability**
  *Symptoms*: # Pull Request  ## PR Description  1. fix: add wildcard in provider model types 2. fix: raise message generation error when model not found 3. fix: remove JSONDecodeError log in chat_completion_stream 4. fix: auto restart redis client  ## Linked Issue  Resolves #82 #80 #41   ## Type of Change  - [x] Bug fix - [ ] New feature - [ ] Performance enhancement - [ ] Code refactor - [ ] Documentation update - [ ] Other, please describe:  ## Checklist  Before submitting this PR, please make sure:  - [x] I have read the [CONTRIBUTING.md](/CONTRIBUTING.md) guidelines. - [x] I have tested my changes locally to ensure they are effective. - [x] I have updated the necessary documentation (if applicable).  

- **Issue #86** (2024-07-16): **StabilityAI has bug**
  *Symptoms*: When the data returned by the image is obtained, an error is reported when passed to the model    async with ClientSession() as session:             async with session.post(url=url, headers=headers, json=data, proxy=CONFIG.PROXY) as response:                 if response.status == 200:                     data = await response.json()                     base64_image = data["artifacts"][0]["base64"]                     return PluginOutput(data={"base64_image": base64_image})                 else:                     data = await response.json()                     print(data)                     raise Exception(f"Error fetching data: {response.status}, {data}")
  **Post-Mortem & Fix Analysis**:
  > <img width="885" alt="image" src="https://github.com/TaskingAI/TaskingAI/assets/105403828/0b217c06-c863-4187-8c96-1db42f3e12c9"> <img width="715" alt="image" src="https://github.com/TaskingAI/TaskingAI/assets/105403828/2c30b1ed-8544-481f-b1cb-00c4cdfe98dd"> 
  > Thanks for the feedback YangZhiBo. This is a known issue to us. The cause of this issue is: the generated image returned from Stability's image generation API is in base64 string format. That base64 string will exceed the input token limit for most of the models.   We plan to introduce integration with image hosting service providers such as cloudfare to solve this issue. Once that is done, the base64 representation of Image will be uploaded to the image hosting service, and return a simple url instead, and eventually accepted by the LLM.  If you have better idea of how to solve this, please let us know. In the meantime, before we launch fix for this, please use dalle 3 instead for image generation.

- **Issue #82** (2024-04-07): **chat completion stream JSONDecodeError**
  *Symptoms*: At the end of the question, you will definitely report this JSONDecodeError
  **Post-Mortem & Fix Analysis**:
  > <img width="601" alt="image" src="https://github.com/TaskingAI/TaskingAI/assets/105403828/1b694569-859e-4a2b-a993-94d6694bdd81"> 
  > Thanks for your feedback. This will be fixed in our next release :-)

- **Issue #80** (2024-07-16): **Concurrent testing，asyncio.exceptions.CancelledError: Cancelled by cancel scope 10abec670**
  *Symptoms*: **Describe the bug** asyncio.exceptions.CancelledError  **To Reproduce** Steps to reproduce the behavior:  1. Concurrent test an assistant, create chat concurrently, create messages, and generate results 2. After the end, the server will report an error  **Expected behavior** A clear and concise description of what you expected to happen. INFO:     127.0.0.1:51131 - "POST /api/v1/assistants/X5lMSQinHLE8beIWz7mjDqxM/chats HTTP/1.1" 200 OK ERROR:    Exception in ASGI application Traceback (most recent call last):   File "/Users/yangzhibo/Projects/TaskingAI/backend/.venv/lib/python3.9/site-packages/aioredis/connection.py", line 860, in send_packed_command     await asyncio.wait_for(   File "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/tasks.py", line 442, in wait_for     return await fut   File "/Users/yangzhibo/Projects/TaskingAI/backend/.venv/lib/python3.9/site-packages/aioredis/connection.py", line 842, in _send_packed_command     await self._writer.drain()   File "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/streams.py", line 387, in drain     await self._protocol._drain_helper()   File "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/streams.py", line 190, in _drain_helper     raise ConnectionResetError('Connection lost') ConnectionResetError: Connection lost  Durin
  **Post-Mortem & Fix Analysis**:
  > Thanks for the feedback yangzhibo. We are aware of this issue, and have already fixed this in an un-released version. That version is estimated to be released in one week, along with several other features and improvements. Please stay tuned.
  > @YangZhiBoGreenHand In the v0.2.2 version, we have enhanced the stability of the redis client to avoid continued client downtime. Please check :-)

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

### Incident Patch 1: `c33aa1df` (2024-09-19)
**Commit Message**: fix: fix error message

**File**: `plugin/app/routes/verify.py` (modified, +2/-4)
```diff
@@ -38,23 +38,21 @@ async def api_verify_credentials(
     bundle_handler: BundleHandler = get_bundle_handler(data.bundle_id)
     if not bundle_handler:
         raise_http_error(ErrorCode.OBJECT_NOT_FOUND, f"Bundle {data.bundle_id} not found.")
-
     try:
-
         await bundle_handler.verify(data.credentials)
 
     except TKHttpException as e:
         if isinstance(getattr(e, "detail"), dict):
             message = e.detail.get("message")
             if message:
                 message = " " + message
-            e.detail["message"] = f"Model credentials validation failed.{message}"
+            e.detail["message"] = f"Plugin credentials validation failed.{message}"
         raise e
 
     except Exception as e:
         raise_http_error(
             ErrorCode.CREDENTIALS_VALIDATION_ERROR,
-            message="Model credentials validation failed, please check if your credentials are correct.",
+            message="Plugin credentials validation failed, please check if your credentials are correct.",
         )
 
     data.credentials.encrypt()
```

---

### Incident Patch 2: `add30eb0` (2024-10-08)
**Commit Message**: feat: add debug-chat-completion-delay30s model

**File**: `inference/providers/debug/chat_completion.py` (modified, +17/-0)
```diff
@@ -53,6 +53,15 @@ async def chat_completion(
     ):
         if provider_model_id == "debug-error" and messages[-1].content != "Only say your name":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
+
+        if provider_model_id == "debug-chat-completion-delay":
+            # content format should be "#number#some other content"
+            message = messages[-1].content
+            second = int(message.split("#")[1]) if message.startswith("#") else 30
+            import asyncio
+
+            await asyncio.sleep(second)
+
         input_tokens = estimate_input_tokens(
             [message.model_dump() for message in messages],
             [function.model_dump() for function in functions] if functions else None,
@@ -99,6 +108,14 @@ async def chat_completion_stream(
         if provider_model_id == "debug-error":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
+        if provider_model_id == "debug-chat-completion-delay":
+            # content format should be "#number#some other content"
+            message = messages[-1].content
+            second = int(message.split("#")[1]) if message.startswith("#") else 30
+            import asyncio
+
+            await asyncio.sleep(second)
+
         if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             output_message = create_tool_call_hallucination_message()
             finish_reason = ChatCompletionFinishReason.function_calls
```

**File**: `inference/providers/debug/resources/i18n/en.yml` (modified, +3/-0)
```diff
@@ -5,6 +5,9 @@ debug_api_key_description: "debug"
 debug_chat_completion_name: "Debug Chat Completion"
 debug_chat_completion_description: "Debug chat completion model for testing purposes."
 
+debug_chat_completion_delay_name: "Debug Chat Completion Delay"
+debug_chat_completion_delay_description: "Chat completion model with a delay for testing response latency and behavior."
+
 debug_error_name: "Debug Error"
 debug_error_description: "Debug error model for testing purposes."
 
```

**File**: `inference/providers/debug/resources/models/debug-chat-completion-delay.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+model_schema_id: debug/debug-chat-completion-delay
+provider_model_id: debug-chat-completion-delay
+type: chat_completion
+name: "i18n:debug_chat_completion_delay_name"
+description: "i18n:debug_chat_completion_delay_description"
+default_endpoint_url:
+
+
+properties:
+  function_call: false
+  streaming: true
+  input_token_limit: 8096
+  output_token_limit: 8096
+
+config_schemas:
+  - config_id: temperature
+  - config_id: top_p
+  - config_id: max_tokens
+  - config_id: stop
+  - config_id: top_k
+
+pricing:
+  input_token: 0
+  output_token: 0
+  unit: 1000
+  currency: USD
```

**File**: `inference/providers/debug/resources/models/debug-error.yml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ default_endpoint_url:
 
 
 properties:
-  function_call: false
+  function_call: true
   streaming: true
   input_token_limit: 8096
   output_token_limit: 8096
```

**File**: `inference/test/test_chat_completion.py` (modified, +4/-3)
```diff
@@ -97,7 +97,7 @@ async def test_chat_completion_by_normal_function_call(self, test_data):
         message = test_data["message"]
         function_call = test_data["function_call"]
 
-        if not function_call or "azure" in model_schema_id or "openrouter" in model_schema_id:
+        if not function_call or "azure" in model_schema_id or "openrouter" or "debug-error" in model_schema_id:
             pytest.skip("Skip the test case without function call.")
         configs = {
             "temperature": 0.5,
@@ -287,6 +287,7 @@ async def test_chat_completion_by_stream_and_function_call(self, test_data):
             or not stream
             or "azure" in model_schema_id
             or "openrouter" in model_schema_id
+            or "debug-error" in model_schema_id
             or "togetherai" in model_schema_id
         ):
             pytest.skip("Skip the test case without function call or stream.")
@@ -384,7 +385,7 @@ async def test_chat_completion_by_function_call_and_length(self, test_data):
         if (
             not function_call
             or "google_gemini" in model_schema_id
-            or "debug-tool-call-hallucinations" in model_schema_id
+            or "debug" in model_schema_id
             or "sensetime" in model_schema_id
             or "openrouter" in model_schema_id
         ):
@@ -445,7 +446,7 @@ async def test_chat_completion_by_stream_and_function_call_and_length(self, test
             not function_call
             or not stream
             or "azure" in model_schema_id
-            or "debug-tool-call-hallucinations" in model_schema_id
+            or "debug" in model_schema_id
             or "mistralai" in model_schema_id
             or "google_gemini" in model_schema_id
             or "sensetime" in model_schema_id
```

---

### Incident Patch 3: `38a9d324` (2024-10-10)
**Commit Message**: fix: fix test-inference ci

**File**: `.github/workflows/test-inference.yml` (modified, +2/-1)
```diff
@@ -96,4 +96,5 @@ jobs:
         run: |
           cd ${{ env.WORKING_DIRECTORY }}
           export PROVIDER_URL_BLACK_LIST="tasking.ai"
-          bash ./test/run_test.sh /tmp/changed_files.txt
\ No newline at end of file
+          export MODE=test
+          bash ./test/run_test.sh /tmp/changed_files.txt
```

**File**: `inference/test/utils/wildcard_test_cases.yml` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ wildcard_test_cases:
   - provider_id: "openrouter"
     cases:
       - model_schema_id: "openrouter/wildcard"
-        provider_model_id: "mattshumer/reflection-70b:free"
+        provider_model_id: "qwen/qwen-2-7b-instruct:free"
         model_type: "chat_completion"
         streaming: True
         function_call: True
```

---

### Incident Patch 4: `078c494d` (2024-09-11)
**Commit Message**: feat: add debug-tool-call-hallucinations

**File**: `inference/providers/debug/chat_completion.py` (modified, +17/-15)
```diff
@@ -15,17 +15,19 @@ def _build_debug_response(message: ChatCompletionMessage):
     return message.content
 
 
-TOOL_CALL_HALLUCINATION_MESSAGE = ChatCompletionAssistantMessage(
-    content=None,
-    role=ChatCompletionRole.assistant,
-    function_calls=[
-        {
-            "id": "P3lffDFvUpOJW3PxfB8ecoqw",
-            "name": "make_scatter_plot",
-            "arguments": {"x_values": [1, 2], "y_values": [3, 4]},
-        }
-    ],
-)
+def create_tool_call_hallucination_message():
+    return ChatCompletionAssistantMessage(
+        content=None,
+        role=ChatCompletionRole.assistant,
+        function_calls=[
+            {
+                "id": generate_random_function_call_id(),
+                "name": "make_scatter_plot",
+                "arguments": {"x_values": [1, 2], "y_values": [3, 4]},
+            }
+        ],
+    )
+
 
 ASSISTANT_CONTENT_DEBUG_MESSAGE = ChatCompletionAssistantMessage(
     content="Test Message",
@@ -58,13 +60,13 @@ async def chat_completion(
         )
         if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             finish_reason = ChatCompletionFinishReason.function_calls
-            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            message = create_tool_call_hallucination_message()
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             finish_reason = ChatCompletionFinishReason.stop
             message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
         elif provider_model_id == "debug-tool-call-hallucinations-2":
             finish_reason = ChatCompletionFinishReason.function_calls
-            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            message = create_tool_call_hallucination_message()
         else:
             finish_reason = ChatCompletionFinishReason.stop
             message_content = _build_debug_response(messages[-1])
@@ -98,13 +100,13 @@ async def chat_completion_stream(
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
         if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
-            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            output_message = create_tool_call_hallucination_message()
             finish_reason = ChatCompletionFinishReason.function_calls
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             output_message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
             finish_reason = ChatCompletionFinishReason.stop
         elif provider_model_id == "debug-tool-call-hallucinations-2":
-            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            output_message = create_tool_call_hallucination_message()
             finish_reason = ChatCompletionFinishReason.function_calls
         else:
             # Extract the last message
```

---

### Incident Patch 5: `93d1eee6` (2024-09-11)
**Commit Message**: feat: add debug-tool-call-hallucinations-2

**File**: `inference/providers/debug/chat_completion.py` (modified, +6/-0)
```diff
@@ -62,6 +62,9 @@ async def chat_completion(
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             finish_reason = ChatCompletionFinishReason.stop
             message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
+        elif provider_model_id == "debug-tool-call-hallucinations-2":
+            finish_reason = ChatCompletionFinishReason.function_calls
+            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
         else:
             finish_reason = ChatCompletionFinishReason.stop
             message_content = _build_debug_response(messages[-1])
@@ -100,6 +103,9 @@ async def chat_completion_stream(
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             output_message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
             finish_reason = ChatCompletionFinishReason.stop
+        elif provider_model_id == "debug-tool-call-hallucinations-2":
+            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            finish_reason = ChatCompletionFinishReason.function_calls
         else:
             # Extract the last message
             message_content = _build_debug_response(messages[-1])
```

**File**: `inference/providers/debug/resources/i18n/en.yml` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@ debug_error_description: "Debug error model for testing purposes."
 debug_tool_call_hallucinations_name: "Debug Tool Call Hallucinations"
 debug_tool_call_hallucinations_description: "Debug chat completion model with tool call hallucinations for testing purposes."
 
+debug_tool_call_hallucinations_2_name: "Debug Tool Call Hallucinations 2"
+debug_tool_call_hallucinations_2_description: "Debug chat completion model with tool call hallucinations 2 for testing purposes."
+
 debug_text_embedding_256_name: "Debug Text Embedding 256"
 debug_text_embedding_256_description: "Debug text embedding model with 256 dimensions for testing purposes."
 
```

**File**: `inference/providers/debug/resources/models/debug-tool-call-hallucinations-2.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+model_schema_id: debug/debug-tool-call-hallucinations-2
+provider_model_id: debug-tool-call-hallucinations-2
+type: chat_completion
+name: "i18n:debug_tool_call_hallucinations_2_name"
+description: "i18n:debug_tool_call_hallucinations_2_description"
+default_endpoint_url:
+
+
+properties:
+  function_call: true
+  streaming: true
+  input_token_limit: 8096
+  output_token_limit: 8096
+
+config_schemas:
+  - config_id: temperature
+  - config_id: top_p
+  - config_id: max_tokens
+  - config_id: stop
+  - config_id: top_k
+
+pricing:
+  input_token: 0
+  output_token: 0
+  unit: 1000
+  currency: USD
```

---

### Incident Patch 6: `3d951e56` (2024-09-11)
**Commit Message**: feat: add debug-tool-call-result

**File**: `inference/providers/debug/chat_completion.py` (modified, +13/-3)
```diff
@@ -27,6 +27,11 @@ def _build_debug_response(message: ChatCompletionMessage):
     ],
 )
 
+ASSISTANT_CONTENT_DEBUG_MESSAGE = ChatCompletionAssistantMessage(
+    content="Test Message",
+    role=ChatCompletionRole.assistant,
+)
+
 
 class DebugChatCompletionModel(BaseChatCompletionModel):
     def __init__(self):
@@ -51,9 +56,12 @@ async def chat_completion(
             [function.model_dump() for function in functions] if functions else None,
             function_call,
         )
-        if provider_model_id == "debug-tool-call-hallucinations":
+        if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             finish_reason = ChatCompletionFinishReason.function_calls
             message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+        elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
+            finish_reason = ChatCompletionFinishReason.stop
+            message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
         else:
             finish_reason = ChatCompletionFinishReason.stop
             message_content = _build_debug_response(messages[-1])
@@ -86,10 +94,12 @@ async def chat_completion_stream(
         if provider_model_id == "debug-error":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
-        if provider_model_id == "debug-tool-call-hallucinations":
+        if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
             finish_reason = ChatCompletionFinishReason.function_calls
-
+        elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
+            output_message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
+            finish_reason = ChatCompletionFinishReason.stop
         else:
             # Extract the last message
             message_content = _build_debug_response(messages[-1])
```

**File**: `inference/test/test_chat_completion.py` (modified, +8/-1)
```diff
@@ -51,7 +51,12 @@ class TestChatCompletion:
     async def test_chat_completion_by_normal(self, test_data):
         model_schema_id = test_data["model_schema_id"]
         message = [{"role": "user", "content": "Hello, nice to meet you, what is your name"}]
-        if "debug-error" in model_schema_id or "azure" in model_schema_id or "hugging_face" in model_schema_id:
+        if (
+            "debug-error" in model_schema_id
+            or "azure" in model_schema_id
+            or "hugging_face" in model_schema_id
+            or "debug-tool-call-hallucinations" in model_schema_id
+        ):
             pytest.skip("Skip the test case with debug-error.")
         configs = {
             "temperature": 0.5,
@@ -379,6 +384,7 @@ async def test_chat_completion_by_function_call_and_length(self, test_data):
         if (
             not function_call
             or "google_gemini" in model_schema_id
+            or "debug-tool-call-hallucinations" in model_schema_id
             or "sensetime" in model_schema_id
             or "openrouter" in model_schema_id
         ):
@@ -439,6 +445,7 @@ async def test_chat_completion_by_stream_and_function_call_and_length(self, test
             not function_call
             or not stream
             or "azure" in model_schema_id
+            or "debug-tool-call-hallucinations" in model_schema_id
             or "mistralai" in model_schema_id
             or "google_gemini" in model_schema_id
             or "sensetime" in model_schema_id
```

---

### Incident Patch 7: `b52d6141` (2024-09-11)
**Commit Message**: fix: fix verify credentials for debug-tool-call

**File**: `inference/app/routes/verify/route.py` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ async def api_verify_credentials(
                     proxy=data.proxy,
                     custom_headers=data.custom_headers,
                 )
-                if response.message.content is None:
+                if not response.message.content and not response.message.function_calls:
                     raise_http_error(ErrorCode.CREDENTIALS_VALIDATION_ERROR, error_message)
         elif model_type == ModelType.TEXT_EMBEDDING:
             from ..text_embedding.route import embed_text
```

---

### Incident Patch 8: `8240f3e5` (2024-09-06)
**Commit Message**: feat: add debug-tool-call-hallucinations

**File**: `inference/providers/debug/chat_completion.py` (modified, +45/-22)
```diff
@@ -1,4 +1,5 @@
 from app.models import ModelSchema
+import copy
 from provider_dependency.chat_completion import *
 from app.models.tokenizer import estimate_input_tokens, estimate_response_tokens
 from typing import List, Dict, Optional
@@ -14,6 +15,19 @@ def _build_debug_response(message: ChatCompletionMessage):
     return message.content
 
 
+TOOL_CALL_HALLUCINATION_MESSAGE = ChatCompletionAssistantMessage(
+    content=None,
+    role=ChatCompletionRole.assistant,
+    function_calls=[
+        {
+            "id": "P3lffDFvUpOJW3PxfB8ecoqw",
+            "name": "make_scatter_plot",
+            "arguments": {"x_values": [1, 2], "y_values": [3, 4]},
+        }
+    ],
+)
+
+
 class DebugChatCompletionModel(BaseChatCompletionModel):
     def __init__(self):
         super().__init__()
@@ -37,11 +51,14 @@ async def chat_completion(
             [function.model_dump() for function in functions] if functions else None,
             function_call,
         )
-
-        finish_reason = ChatCompletionFinishReason.stop
-        message_content = _build_debug_response(messages[-1])
-        message_content = message_content[(len(message_content) // 2) :].strip()
-        message = ChatCompletionAssistantMessage(content=message_content)
+        if provider_model_id == "debug-tool-call-hallucinations":
+            finish_reason = ChatCompletionFinishReason.function_calls
+            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+        else:
+            finish_reason = ChatCompletionFinishReason.stop
+            message_content = _build_debug_response(messages[-1])
+            message_content = message_content[(len(message_content) // 2) :].strip()
+            message = ChatCompletionAssistantMessage(content=message_content)
         output_tokens = estimate_response_tokens(message.model_dump())
         response = ChatCompletion(
             finish_reason=finish_reason,
@@ -69,32 +86,38 @@ async def chat_completion_stream(
         if provider_model_id == "debug-error":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
+        if provider_model_id == "debug-tool-call-hallucinations":
+            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            finish_reason = ChatCompletionFinishReason.function_calls
+
+        else:
+            # Extract the last message
+            message_content = _build_debug_response(messages[-1])
+            message_content = message_content[(len(message_content) // 2) :].strip()
+            # Split the message content into words
+            words = message_content.split()
+
+            # Simulate the streaming response by yielding each word
+            for i, word in enumerate(words):
+                yield ChatCompletionChunk(
+                    created_timestamp=get_current_timestamp_int(),
+                    index=i,
+                    delta=word,
+                )
+            output_message = ChatCompletionAssistantMessage(content=message_content)
+            finish_reason = ChatCompletionFinishReason.stop
+
         input_tokens = estimate_input_tokens(
             [message.model_dump() for message in messages],
             [function.model_dump() for function in functions] if functions else None,
             function_call,
         )
-        # Extract the last message
-        message_content = _build_debug_response(messages[-1])
-        message_content = message_content[(len(message_content) // 2) :].strip()
-        # Split the message content into words
-        words = message_content.split()
-
-        # Simulate the streaming response by yielding each word
-        for i, word in enumerate(words):
-            yield ChatCompletionChunk(
-                created_timestamp=get_current_timestamp_int(),
-                index=i,
-                delta=word,
-            )
-        message = ChatCompletionAssistantMessage(content=message_content)
-        output_tokens = estimate_response_tokens(message.model_dump())
-        finish_reason = ChatCompletionFinishReason.stop
+        output_tokens = estimate_response_tokens(output_message.model_dump())
         usage = ChatCompletionUsage(input_tokens=input_tokens, output_tokens=output_tokens)
         response = ChatCompletion(
             created_timestamp=get_current_timestamp_int(),
             finish_reason=finish_reason,
-            message=message,
+            message=output_message,
             usage=usage,
         )
         yield response
```

**File**: `inference/providers/debug/resources/i18n/en.yml` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ debug_chat_completion_description: "Debug chat completion model for testing purp
 debug_error_name: "Debug Error"
 debug_error_description: "Debug error model for testing purposes."
 
+debug_tool_call_hallucinations_name: "Debug Tool Call Hallucinations"
+debug_tool_call_hallucinations_description: "Debug chat completion model with tool call hallucinations for testing purposes."
+
 debug_text_embedding_256_name: "Debug Text Embedding 256"
 debug_text_embedding_256_description: "Debug text embedding model with 256 dimensions for testing purposes."
 
```

**File**: `inference/providers/debug/resources/models/debug-tool-call-hallucinations.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+model_schema_id: debug/debug-tool-call-hallucinations
+provider_model_id: debug-tool-call-hallucinations
+type: chat_completion
+name: "i18n:debug_tool_call_hallucinations_name"
+description: "i18n:debug_tool_call_hallucinations_description"
+default_endpoint_url:
+
+
+properties:
+  function_call: true
+  streaming: true
+  input_token_limit: 8096
+  output_token_limit: 8096
+
+config_schemas:
+  - config_id: temperature
+  - config_id: top_p
+  - config_id: max_tokens
+  - config_id: stop
+  - config_id: top_k
+
+pricing:
+  input_token: 0
+  output_token: 0
+  unit: 1000
+  currency: USD
```

---

### Incident Patch 9: `98137dc5` (2024-08-23)
**Commit Message**: fix: resolved a bug for the number generator

**File**: `plugin/bundles/random_number_generator/plugins/generate_random_integers/plugin.py` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ class GenerateRandomIntegers(PluginHandler):
     async def execute(self, credentials: BundleCredentials, plugin_input: PluginInput) -> PluginOutput:
         min: int = plugin_input.input_params.get("min")
         max: int = plugin_input.input_params.get("max")
-        number: int = plugin_input.input_params.get("number")
+        number: int = plugin_input.input_params.get("number", 1)
 
         if min >= max:
             raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, "min should be less than max")
```

---

### Incident Patch 10: `74b0e95e` (2024-08-09)
**Commit Message**: fix: handle stream mode for Hugging Face

**File**: `inference/providers/hugging_face/chat_completion.py` (modified, +33/-3)
```diff
@@ -45,6 +45,7 @@ def _build_hugging_face_text_generation_payload(
             "max_new_tokens": configs.max_tokens,
             "top_k": configs.top_k,
         },
+        "stream": stream,
     }
     return payload
 
@@ -70,8 +71,6 @@ async def prepare_request(
         base_url = "https://api-inference.huggingface.co/models/PLACE_HOLDER_MODEL_ID"
         api_url = base_url.replace("PLACE_HOLDER_MODEL_ID", provider_model_id)
         headers = _build_hugging_face_header(credentials)
-        if stream:
-            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, "Hugging Face does not support streaming.")
         if functions:
             raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, "Hugging Face does not support function calls.")
         payload = _build_hugging_face_text_generation_payload(messages, stream, provider_model_id, configs)
@@ -92,4 +91,35 @@ def extract_function_calls(self, data: Dict, **kwargs) -> Optional[List[ChatComp
         pass
 
     def extract_finish_reason(self, data: Dict, **kwargs) -> Optional[ChatCompletionFinishReason]:
-        return ChatCompletionFinishReason.unknown
+        return ChatCompletionFinishReason.stop
+
+    # ------------------- handle stream chat completion response -------------------
+
+    def stream_check_error(self, sse_data: Dict, **kwargs):
+        if sse_data.get("error"):
+            raise_provider_api_error(sse_data["error"])
+
+    def stream_extract_chunk_data(self, sse_data: Dict, **kwargs) -> Optional[Dict]:
+        if not sse_data.get("generated_text"):
+            return None
+        return sse_data
+
+    def stream_extract_chunk(
+        self, index: int, chunk_data: Dict, text_content: str, **kwargs
+    ) -> Tuple[int, Optional[ChatCompletionChunk]]:
+        content = chunk_data.get("generated_text", None)
+        if content:
+            return index + 1, ChatCompletionChunk(
+                created_timestamp=get_current_timestamp_int(),
+                index=index,
+                delta=content,
+            )
+        return index, None
+
+    def stream_extract_finish_reason(self, chunk_data: Dict, **kwargs) -> Optional[ChatCompletionFinishReason]:
+        return ChatCompletionFinishReason.stop
+
+    def stream_handle_function_calls(
+        self, chunk_data: Dict, function_calls_content: ChatCompletionFunctionCallsContent, **kwargs
+    ) -> Optional[ChatCompletionFunctionCallsContent]:
+        pass
```

**File**: `inference/providers/hugging_face/resources/provider.yml` (modified, +3/-0)
```diff
@@ -3,6 +3,9 @@ name: "i18n:hugging_face_name"
 description: "i18n:hugging_face_description"
 updated_timestamp: 1707152831000
 
+return_token_usage: false
+return_stream_token_usage: false
+
 credentials_schema:
   type: object
   properties:
```

---

### Incident Patch 11: `fa91eb1c` (2024-08-09)
**Commit Message**: fix: fix test issues in CI with API keys and gemini 1.0 pro

**File**: `plugin/bundles/gemini_vision_models/resources/i18n/en.yml` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@ chat_completion_by_gemini_1_0_pro_input_prompt_name: "Prompt"
 chat_completion_by_gemini_1_0_pro_input_prompt_description: "The prompt for the model"
 chat_completion_by_gemini_1_0_pro_output_result_name: "Result"
 chat_completion_by_gemini_1_0_pro_output_result_description: "The textual response from the model"
-chat_completion_by_gemini_1_0_pro_name: "Chat completion by gemini 1.0 pro"
-chat_completion_by_gemini_1_0_pro_description: "Get textual responses from Gemini 1.0 Pro Vision model. Input an image url and a textual prompt."
+chat_completion_by_gemini_1_0_pro_name: "(Deprecated) Chat completion by gemini 1.0 pro"
+chat_completion_by_gemini_1_0_pro_description: "This plugin is deprecated by Google since July 12, 2024, and should not be used. Original description: Get textual responses from Gemini 1.0 Pro Vision model. Input an image url and a textual prompt."
 
 chat_completion_by_gemini_1_5_pro_input_image_url_name: "Image Url"
 chat_completion_by_gemini_1_5_pro_input_image_url_description: "The url of the image"
```

**File**: `plugin/bundles/serp_api/plugins/get_flight_information/plugin_schema.yml` (modified, +1/-1)
```diff
@@ -48,6 +48,6 @@ test:
   - input:
       arrival_id: AUS
       departure_id: CDG
-      outbound_date: '2024-07-30'
+      outbound_date: '2025-01-30'
       type: 2
   mode: schema
```

**File**: `plugin/test/utils/utils.py` (modified, +8/-2)
```diff
@@ -41,7 +41,13 @@ def generate_test_cases():
     cases = []
     for bundle_dir_name in bundle_dir_names:
 
-        if bundle_dir_name in ["aftership", "coin_market_cap", "api_ninjas_commodity_price"]:
+        if bundle_dir_name in [
+            "aftership",
+            "coin_market_cap",
+            "api_ninjas_commodity_price",
+            "geospy_api",
+            "weather_bit",
+        ]:
             continue
 
         bundle_dir_path = os.path.join(bundles_path, bundle_dir_name)
@@ -58,7 +64,7 @@ def generate_test_cases():
         plugin_ids = [id for id in plugin_ids if not id.startswith("_")]
 
         for plugin_id in plugin_ids:
-            if plugin_id in ["get_historical_exchange_rate"]:
+            if plugin_id in ["get_historical_exchange_rate", "chat_completion_by_gemini_1_0_pro"]:
                 continue
             plugin_path = os.path.join(bundle_plugins_path, plugin_id)
             plugin_schema_path = os.path.join(plugin_path, "plugin_schema.yml")
```

---

### Incident Patch 12: `8aa30a93` (2024-07-26)
**Commit Message**: fix: deprecate gemini pro

**File**: `inference/config.py` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ class Config:
 
     def __init__(self):
         # version
-        self.VERSION = "v0.2.16"
+        self.VERSION = "v0.2.17"
 
         # mode
         self.MODE = load_str_env("MODE", required=True)
```

**File**: `inference/providers/google_gemini/resources/i18n/en.yml` (modified, +6/-3)
```diff
@@ -4,12 +4,15 @@ google_gemini_description: "Integrate with Google Gemini for cutting-edge langua
 google_gemini_api_key_description: "Your Google Gemini API Key for authentication."
 google_gemini_api_version_description: "The version of the Google Gemini API being used."
 
+gemini_pro_name: "Gemini Pro"
+gemini_pro_description: "The same with Gemini 1.0 Pro. Deprecated."
+
+gemini_pro_vision_name: "Gemini Pro Vision"
+gemini_pro_vision_description: "Currently point to Gemini 1.5 Pro. Deprecated."
+
 gemini_1_0_pro_name: "Gemini 1.0 Pro"
 gemini_1_0_pro_description: "Gemini 1.0 Pro offers advanced chat completion capabilities with extensive input and output token limits for comprehensive interactions."
 
-gemini_1_0_pro_vision_name: "Gemini Pro Vision"
-gemini_1_0_pro_vision_description: "Gemini Pro Vision offers vision-enabled chat completion capabilities with extensive input and output token limits for comprehensive interactions."
-
 gemini_1_5_flash_latest_name: "Gemini 1.5 Flash"
 gemini_1_5_flash_latest_description: "Gemini 1.5 Flash offers 1048576 input tokens and 8192 output tokens for advanced chat completion capabilities."
 
```

**File**: `inference/providers/google_gemini/resources/models/gemini-1.0-pro.yml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 model_schema_id: google_gemini/gemini-1.0-pro
-provider_model_id: gemini-pro
+provider_model_id: gemini-1.0-pro
 type: chat_completion
 name: "i18n:gemini_1_0_pro_name"
 description: "i18n:gemini_1_0_pro_description"
```

**File**: `inference/providers/google_gemini/resources/models/gemini-pro-vision.yml` (renamed, +5/-4)
```diff
@@ -1,8 +1,9 @@
-model_schema_id: google_gemini/gemini-1.0-pro-vision
-provider_model_id: gemini-pro-vision
+model_schema_id: google_gemini/gemini-pro-vision
+provider_model_id: gemini-1.5-pro
 type: chat_completion
-name: "i18n:gemini_1_0_pro_vision_name"
-description: "i18n:gemini_1_0_pro_vision_description"
+name: "i18n:gemini_pro_vision_name"
+description: "i18n:gemini_pro_vision_description"
+deprecated: true
 
 properties:
   vision: true
```

**File**: `inference/providers/google_gemini/resources/models/gemini-pro.yml` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+model_schema_id: google_gemini/gemini-pro
+provider_model_id: gemini-pro
+type: chat_completion
+name: "i18n:gemini_pro_name"
+description: "i18n:gemini_pro_description"
+deprecated: true
+
+properties:
+  function_call: true
+  streaming: true
+  input_token_limit: 30720
+  output_token_limit: 2048
+
+config_schemas:
+  - config_id: temperature
+    type: float
+    default: 0.7
+    min: 0.0
+    max: 2.0
+    step: 0.1
+  - config_id: top_p
+  - config_id: top_k
+  - config_id: max_tokens
+    type: int
+    default: 2048
+    min: 1
+    max: 2048
+    step: 1
+  - config_id: stop
+
+pricing:
+  input_token: 0.0005
+  output_token: 0.0015
+  unit: 1000
+  currency: USD
```

---

### Incident Patch 13: `90eaccbc` (2024-07-25)
**Commit Message**: fix: fix provider test

**File**: `inference/test/utils/utils.py` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
     "minimax",
     "sensetime",
     "leptonai",
+    "volcengine"
 ]
 white_list_models = [
     "google_gemini/gemini-1.0-pro-vision",
```

---

### Incident Patch 14: `cf5afca4` (2024-07-25)
**Commit Message**: fix: add enable_proxy to response

**File**: `inference/app/models/provider.py` (modified, +2/-0)
```diff
@@ -78,6 +78,8 @@ def to_dict(self, lang: str):
             "icon_svg_url": self.icon_svg_url,
             "resources": self.resources.model_dump(),
             "updated_timestamp": self.updated_timestamp,
+            "enable_proxy": self.enable_proxy,
+            "enable_custom_headers": self.enable_custom_headers,
         }
 
     def allowed_credential_names(self):
```

---

### Incident Patch 15: `8c7c5e23` (2024-07-12)
**Commit Message**: fix: correct default value in model config

**File**: `inference/app/models/model_config/resources/configs/frequency_penalty.yml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: "i18n:model_config_frequency_penalty_name"
 description: "i18n:model_config_frequency_penalty_description"
 schema:
   type: float
-  default: 0.0
+  default: 0.3
   min: 0.0
   max: 1.0
   step: 0.01
```

**File**: `inference/app/models/model_config/resources/configs/presence_penalty.yml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: "i18n:model_config_presence_penalty_name"
 description: "i18n:model_config_presence_penalty_description"
 schema:
   type: float
-  default: 0.0
+  default: 0.2
   min: 0.0
   max: 1.0
   step: 0.01
```

**File**: `inference/app/models/model_config/resources/configs/temperature.yml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: "i18n:model_config_temperature_name"
 description: "i18n:model_config_temperature_description"
 schema:
   type: float
-  default: 0.0
+  default: 0.7
   min: 0.0
   max: 1.0
   step: 0.01
```

**File**: `inference/app/models/model_config/resources/configs/top_k.yml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: "i18n:model_config_top_k_name"
 description: "i18n:model_config_top_k_description"
 schema:
   type: int
-  default: 0
+  default: 1
   min: 0
   max: 10
   step: 1
```

**File**: `inference/app/models/model_config/resources/configs/top_p.yml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: "i18n:model_config_top_p_name"
 description: "i18n:model_config_top_p_description"
 schema:
   type: float
-  default: 1.0
+  default: 0.9
   min: 0.0
   max: 1.0
   step: 0.01
```

**File**: `inference/providers/anthropic/resources/models/claude-2.0.yml` (modified, +5/-0)
```diff
@@ -16,6 +16,11 @@ config_schemas:
   - config_id: top_p
   - config_id: top_k
   - config_id: max_tokens
+    type: int
+    default: 4096
+    min: 1
+    max: 4096
+    step: 1
   - config_id: stop
   - config_id: response_format
 
```

**File**: `inference/providers/anthropic/resources/models/claude-2.1.yml` (modified, +5/-0)
```diff
@@ -16,6 +16,11 @@ config_schemas:
   - config_id: top_p
   - config_id: top_k
   - config_id: max_tokens
+    type: int
+    default: 4096
+    min: 1
+    max: 4096
+    step: 1
   - config_id: stop
   - config_id: response_format
 
```

**File**: `inference/providers/anthropic/resources/models/claude-3-haiku.yml` (modified, +5/-0)
```diff
@@ -16,6 +16,11 @@ config_schemas:
   - config_id: top_p
   - config_id: top_k
   - config_id: max_tokens
+    type: int
+    default: 4096
+    min: 1
+    max: 4096
+    step: 1
   - config_id: stop
   - config_id: response_format
 
```

#### Recent Merged Pull Requests:
- **PR #379** (closed): docs(inference): add DaoXE Custom Host OpenAI-compatible example (@seven7763)
- **PR #378** (closed): feat: add DaoXE OpenAI-compatible model provider (@seven7763)
- **PR #369** (closed): done (@darryk10)
- **PR #356** (closed): feat: add a new provider xAI (@LinkW77)
- **PR #355** (2024-10-31): chore: update plugin version (@SimsonW)
- **PR #353** (closed): feat: add a new plugin vectorizer ai (@LinkW77)
- **PR #352** (closed): feat: add a new plugin tavily (@LinkW77)
- **PR #351** (closed): feat: add a new plugin serply (@LinkW77)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
