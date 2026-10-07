# Forensic Learning Record (Deep Inspection): fastapi/fastapi

> **Canonical Artifact**: `07_PROJECT_LEARNING/fastapi-fastapi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fastapi/fastapi](https://github.com/fastapi/fastapi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:30.785Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fastapi/fastapi`
- **Description**: FastAPI framework, high performance, easy to learn, fast to code, ready for production
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 102863 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fastapi/concurrency.py`
```
from collections.abc import AsyncGenerator
from contextlib import AbstractContextManager
from contextlib import asynccontextmanager as asynccontextmanager
from typing import TypeVar

import anyio.to_thread
from anyio import CapacityLimiter
from starlette.concurrency import iterate_in_threadpool as iterate_in_threadpool  # noqa
from starlette.concurrency import run_in_threadpool as run_in_threadpool  # noqa
from starlette.concurrency import (  # noqa
    run_until_first_complete as run_until_first_complete,
)

_T = TypeVar("_T")


@asynccontextmanager
async def contextmanager_in_threadpool(
    cm: AbstractContextManager[_T],
) -> AsyncGenerator[_T, None]:
    # blocking __exit__ from running waiting on a free thread
    # can create race conditions/deadlocks if the context manager itself
    # has its own internal pool (e.g. a database connection pool)
    # to avoid this we let __exit__ run without a capacity limit
    # since we're creating a new limiter for each call, any non-zero limit
    # works (1 is arbitrary)
    exit_limiter = CapacityLimiter(1)
    try:
        yield await run_in_threadpool(cm.__enter__)
    except Exception as e:
        ok = bool(
            await anyio.to_thread.run_sync(
                cm.__exit__, type(e), e, e.__traceback__, limiter=exit_limiter
            )
        )
        if not ok:
            raise e
    else:
        await anyio.to_thread.run_sync(
            cm.__exit__, None, None, None, limiter=exit_limiter
        )

```

### Core Architecture Module: `fastapi/dependencies/utils.py`
```
import dataclasses
import inspect
import sys
from collections.abc import (
    AsyncGenerator,
    AsyncIterable,
    AsyncIterator,
    Callable,
    Generator,
    Iterable,
    Iterator,
    Mapping,
    Sequence,
)
from contextlib import AsyncExitStack, contextmanager
from copy import copy, deepcopy
from dataclasses import dataclass
from typing import (
    Annotated,
    Any,
    ForwardRef,
    Literal,
    Union,
    cast,
    get_args,
    get_origin,
)

from fastapi import params
from fastapi._compat import (
    ModelField,
    RequiredParam,
    Undefined,
    copy_field_info,
    create_body_model,
    evaluate_forwardref,
    field_annotation_is_scalar,
    field_annotation_is_scalar_sequence,
    field_annotation_is_sequence,
    get_cached_model_fields,
    get_missing_field_error,
    is_bytes_or_nonable_bytes_annotation,
    is_bytes_sequence_annotation,
    is_scalar_field,
    is_uploadfile_or_nonable_uploadfile_annotation,
    is_uploadfile_sequence_annotation,
    lenient_issubclass,
    sequence_types,
    serialize_sequence_value,
    value_is_sequence,
)
from fastapi.background import BackgroundTasks
from fastapi.concurrency import (
    asynccontextmanager,
    contextmanager_in_threadpool,
)
from fastapi.dependencies.models import (
    Dependant,
    _get_cache_key,
    _get_computed_scope,
    _get_oauth_scopes,
    _is_async_gen_callable,
    _is_coroutine_callable,
    _is_gen_callable,
    _UsesScopesCache,
)
from fastapi.exceptions import DependencyScopeError
from fastapi.logger import logger
from fastapi.security.oauth2 import SecurityScopes
from fastapi.types import DependencyCacheKey
from fastapi.utils import create_model_field, get_path_param_names
from pydantic import BaseModel, Json
from pydantic.fields import FieldInfo
from starlette.background import BackgroundTasks as StarletteBackgroundTasks
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import (
    FormData,
    Headers,
    ImmutableMultiDict,
    QueryParams,
    UploadFile,
)
from starlette.requests import HTTPConnection, Request
from starlette.responses import Response
from starlette.websockets import WebSocket
from typing_inspection.typing_objects import is_typealiastype

multipart_not_installed_error = (
    'Form data requires "python-multipart" to be installed. \n'
    'You can install "python-multipart" with: \n\n'
    "pip install python-multipart\n"
)
multipart_incorrect_install_error = (
    'Form data requires "python-multipart" to be installed. '
    'It seems you installed "multipart" instead. \n'
    'You can remove "multipart" with: \n\n'
    "pip uninstall multipart\n\n"
    'And then install "python-multipart" with: \n\n'
    "pip install python-multipart\n"
)


def ensure_multipart_is_installed() -> None:
    try:
        from python_multipart import __version__

        # Import an attribute that can be mocked/deleted in testing
        assert __version__ > "0.0.12"
    except (ImportError, AssertionError):
        try:
            # __version__ is available in both multiparts, and can be mocked
            from multipart import (  # type: ignore[no-redef,import-untyped]
                __version__,
            )

            assert __version__
            try:
                # parse_options_header is only available in the right multipart
                from multipart.multipart import (  # type: ignore[import-untyped]
                    parse_options_header,
                )

                assert parse_options_header
            except ImportError:
                logger.error(multipart_incorrect_install_error)
                raise RuntimeError(multipart_incorrect_install_error) from None
        except ImportError:
            logger.error(multipart_not_installed_error)
            raise RuntimeError(multipart_not_installed_error) from None


def get_parameterless_sub_dependant(*, depends: params.Depends, path: str) -> Dependant:
    assert callable(depends.dependency), (
        "A parameter-less dependency must have a callable dependency"
    )
    own_oauth_scopes: list[str] = []
    if isinstance(depends, params.Security) and depends.scopes:
        own_oauth_scopes.extend(depends.scopes)
    return get_dependant(
        path=path,
        call=depends.dependency,
        scope=depends.scope,
        own_oauth_scopes=own_oauth_scopes,
    )


def _get_flat_body_params(dependant: Dependant) -> list[ModelField]:
    body_params: list[ModelField] = []
    dependants = [dependant]
    while dependants:
        current_dependant = dependants.pop()
        body_params.extend(current_dependant.body_params)
        dependants.extend(reversed(current_dependant.dependencies))
    return body_params


def _get_flat_fields_from_params(fields: list[ModelField]) -> list[ModelField]:
    if not fields:
        return fields
    first_field = fields[0]
    if len(fields) == 1 and lenient_issubclass(
        first_field.field_info.annotation, BaseModel
    ):
        fields_to_extract = get_cached_model_fields(first_field.field_info.annotation)
        return fields_to_extract
    return fields


def get_flat_params(dependant: Dependant) -> list[ModelField]:
    path_params: list[ModelField] = []
    query_params: list[ModelField] = []
    header_params: list[ModelField] = []
    cookie_params: list[ModelField] = []
    visited: list[DependencyCacheKey] = []
    uses_scopes_cache: _UsesScopesCache = {}
    dependants = [dependant]
    while dependants:
        current_dependant = dependants.pop()
        cache_key = _get_cache_key(
            dependant=current_dependant,
            uses_scopes_cache=uses_scopes_cache,
        )
        if cache_key in visited:
            continue
        visited.append(cache_key)
        path_params.extend(current_dependant.path_params)
        query_params.extend(current_dependant.query_params)
        header_params.extend(current_dependant.header_params)
        cookie_params.extend(current_dependant.cookie_params)
        dependants.extend(reversed(current_dependant.dependencies))
    path_params = _get_flat_fields_from_params(path_params)
    query_params = _get_flat_fields_from_params(query_params)
    header_params = _get_flat_fields_from_params(header_params)
    cookie_params = _get_flat_fields_from_params(cookie_params)
    return path_params + query_params + header_params + cookie_params


def _get_signature(call: Callable[..., Any]) -> inspect.Signature:
    try:
        signature = inspect.signature(call, eval_str=True)
    except NameError:
        # Handle type annotations with if TYPE_CHECKING, not used by FastAPI
        # e.g. dependency return types
        if sys.version_info >= (3, 14):
            from annotationlib import Format

            signature = inspect.signature(call, annotation_format=Format.FORWARDREF)
        else:
            signature = inspect.signature(call)
    return signature


def get_typed_signature(call: Callable[..., Any]) -> inspect.Signature:
    signature = _get_signature(call)
    unwrapped = inspect.unwrap(call)
    globalns = getattr(unwrapped, "__globals__", {})
    typed_params = [
        inspect.Parameter(
            name=param.name,
            kind=param.kind,
            default=param.default,
            annotation=get_typed_annotation(param.annotation, globalns),
        )
        for param in signature.parameters.values()
    ]
    typed_signature = inspect.Signature(typed_params)
    return typed_signature


def get_typed_annotation(annotation: Any, globalns: dict[str, Any]) -> Any:
    if isinstance(annotation, str):
        annotation = ForwardRef(annotation)
        annotation = evaluate_forwardref(annotation, globalns, globalns)
        if annotation is type(None):
            return None
    return annotation


def get_typed_return_annotation(call: Callable[..., Any]) -> Any:
    signature = _get_signature(call)
    unwrapped = inspect.unwrap(call)
    annotation = signature.return_annotation

    if annotation is inspect.Signature.empty:
        return None

    globalns = getattr(unwrapped, "__globals__", {})
    return get_typed_annotation(annotation, globalns)


_STREAM_ORIGINS = {
    AsyncIterable,
    AsyncIterator,
    AsyncGenerator,
    Iterable,
    Iterator,
    Generator,
}


def get_stream_item_type(annotation: Any) -> Any | None:
    origin = get_origin(annotation)
    if origin is not None and origin in _STREAM_ORIGINS:
        type_args = get_args(annotation)
        if type_args:
            return type_args[0]
        return Any
    return None


def get_dependant(
    *,
    path: str,
    call: Callable[..., Any],
    name: str | None = None,
    own_oauth_scopes: list[str] | None = None,
    parent_oauth_scopes: list[str] | None = None,
    use_cache: bool = True,
    scope: Literal["function", "request"] | None = None,
) -> Dependant:
    dependant = Dependant(
        call=call,
        name=name,
        path=path,
        use_cache=use_cache,
        scope=scope,
        own_oauth_scopes=own_oauth_scopes,
        parent_oauth_scopes=parent_oauth_scopes,
    )
    current_scopes = (parent_oauth_scopes or []) + (own_oauth_scopes or [])
    path_param_names = get_path_param_names(path)
    endpoint_signature = get_typed_signature(call)
    signature_params = endpoint_signature.parameters
    for param_name, param in signature_params.items():
        is_path_param = param_name in path_param_names
        param_details = analyze_param(
            param_name=param_name,
            annotation=param.annotation,
            value=param.default,
            is_path_param=is_path_param,
        )
        if param_details.depends is not None:
            assert param_details.depends.dependency
            if (
                (
                    _is_gen_callable(dependant.call)
                    or _is_async_gen_callable(dependant.call)
                )
                and _get_computed_scope(dependant=dependant) == "request"
               
```

### Core Architecture Module: `fastapi/openapi/utils.py`
```
import copy
import http.client
import inspect
import warnings
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Literal, cast

from fastapi import routing
from fastapi._compat import (
    ModelField,
    get_definitions,
    get_flat_models_from_fields,
    get_model_name_map,
    get_schema_from_model_field,
    lenient_issubclass,
)
from fastapi.datastructures import DefaultPlaceholder, _Unset
from fastapi.dependencies.models import (
    Dependant,
    _get_cache_key,
    _get_oauth_scopes,
    _get_security_scheme,
    _is_security_scheme,
    _UsesScopesCache,
)
from fastapi.dependencies.utils import (
    _get_flat_fields_from_params,
    get_flat_params,
    get_validation_alias,
)
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import FastAPIDeprecationWarning
from fastapi.openapi.constants import METHODS_WITH_BODY, REF_PREFIX
from fastapi.openapi.models import OpenAPI
from fastapi.params import Body, ParamTypes
from fastapi.responses import Response
from fastapi.sse import _SSE_EVENT_SCHEMA
from fastapi.types import DependencyCacheKey, ModelNameMap
from fastapi.utils import (
    deep_dict_update,
    generate_operation_id_for_path,
    is_body_allowed_for_status_code,
)
from pydantic import BaseModel
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute

validation_error_definition = {
    "title": "ValidationError",
    "type": "object",
    "properties": {
        "loc": {
            "title": "Location",
            "type": "array",
            "items": {"anyOf": [{"type": "string"}, {"type": "integer"}]},
        },
        "msg": {"title": "Message", "type": "string"},
        "type": {"title": "Error Type", "type": "string"},
        "input": {"title": "Input"},
        "ctx": {"title": "Context", "type": "object"},
    },
    "required": ["loc", "msg", "type"],
}

validation_error_response_definition = {
    "title": "HTTPValidationError",
    "type": "object",
    "properties": {
        "detail": {
            "title": "Detail",
            "type": "array",
            "items": {"$ref": REF_PREFIX + "ValidationError"},
        }
    },
}

status_code_ranges: dict[str, str] = {
    "1XX": "Information",
    "2XX": "Success",
    "3XX": "Redirection",
    "4XX": "Client Error",
    "5XX": "Server Error",
    "DEFAULT": "Default Response",
}


@dataclass
class _OpenAPIDependencyData:
    path_params: list[ModelField] = field(default_factory=list)
    query_params: list[ModelField] = field(default_factory=list)
    header_params: list[ModelField] = field(default_factory=list)
    cookie_params: list[ModelField] = field(default_factory=list)
    security_dependencies: list[tuple[Dependant, list[str]]] = field(
        default_factory=list
    )


def _get_openapi_dependency_data(dependant: Dependant) -> _OpenAPIDependencyData:
    dependency_data = _OpenAPIDependencyData()
    visited: list[DependencyCacheKey] = []
    uses_scopes_cache: _UsesScopesCache = {}
    dependants: list[tuple[Dependant, list[str], bool]] = [(dependant, [], True)]
    while dependants:
        current_dependant, parent_oauth_scopes, is_root = dependants.pop()
        cache_key = _get_cache_key(
            dependant=current_dependant,
            uses_scopes_cache=uses_scopes_cache,
        )
        if cache_key in visited:
            continue
        visited.append(cache_key)
        dependency_data.path_params.extend(current_dependant.path_params)
        dependency_data.query_params.extend(current_dependant.query_params)
        dependency_data.header_params.extend(current_dependant.header_params)
        dependency_data.cookie_params.extend(current_dependant.cookie_params)
        oauth_scopes = parent_oauth_scopes.copy()
        for scope in _get_oauth_scopes(dependant=current_dependant):
            if scope not in oauth_scopes:
                oauth_scopes.append(scope)
        if not is_root and _is_security_scheme(dependant=current_dependant):
            dependency_data.security_dependencies.append(
                (current_dependant, oauth_scopes)
            )
        dependants.extend(
            (sub_dependant, oauth_scopes, False)
            for sub_dependant in reversed(current_dependant.dependencies)
        )
    return dependency_data


def _get_openapi_security_definitions(
    security_dependencies: list[tuple[Dependant, list[str]]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    security_definitions = {}
    # Use a dict to merge scopes for same security scheme
    operation_security_dict: dict[str, list[str]] = {}
    for security_dependency, oauth_scopes in security_dependencies:
        security_scheme = _get_security_scheme(dependant=security_dependency)
        security_definition = jsonable_encoder(
            security_scheme.model,
            by_alias=True,
            exclude_none=True,
        )
        security_name = security_scheme.scheme_name
        security_definitions[security_name] = security_definition
        # Merge scopes for the same security scheme
        if security_name not in operation_security_dict:
            operation_security_dict[security_name] = []
        for scope in oauth_scopes:
            if scope not in operation_security_dict[security_name]:
                operation_security_dict[security_name].append(scope)
    operation_security = [
        {name: scopes} for name, scopes in operation_security_dict.items()
    ]
    return security_definitions, operation_security


def _get_openapi_operation_parameters(
    *,
    dependency_data: _OpenAPIDependencyData,
    model_name_map: ModelNameMap,
    field_mapping: dict[
        tuple[ModelField, Literal["validation", "serialization"]], dict[str, Any]
    ],
    separate_input_output_schemas: bool = True,
) -> list[dict[str, Any]]:
    parameters = []
    path_params = _get_flat_fields_from_params(dependency_data.path_params)
    query_params = _get_flat_fields_from_params(dependency_data.query_params)
    header_params = _get_flat_fields_from_params(dependency_data.header_params)
    cookie_params = _get_flat_fields_from_params(dependency_data.cookie_params)
    parameter_groups = [
        (ParamTypes.path, path_params),
        (ParamTypes.query, query_params),
        (ParamTypes.header, header_params),
        (ParamTypes.cookie, cookie_params),
    ]
    default_convert_underscores = True
    if len(dependency_data.header_params) == 1:
        first_field = dependency_data.header_params[0]
        if lenient_issubclass(first_field.field_info.annotation, BaseModel):
            default_convert_underscores = getattr(
                first_field.field_info, "convert_underscores", True
            )
    for param_type, param_group in parameter_groups:
        for param in param_group:
            field_info = param.field_info
            # field_info = cast(Param, field_info)
            if not getattr(field_info, "include_in_schema", True):
                continue
            param_schema = get_schema_from_model_field(
                field=param,
                model_name_map=model_name_map,
                field_mapping=field_mapping,
                separate_input_output_schemas=separate_input_output_schemas,
            )
            name = get_validation_alias(param)
            convert_underscores = getattr(
                param.field_info,
                "convert_underscores",
                default_convert_underscores,
            )
            if (
                param_type == ParamTypes.header
                and name == param.name
                and convert_underscores
            ):
                name = param.name.replace("_", "-")

            parameter = {
                "name": name,
                "in": param_type.value,
                "required": param.field_info.is_required(),
                "schema": param_schema,
            }
            if field_info.description:
                parameter["description"] = field_info.description
            openapi_examples = getattr(field_info, "openapi_examples", None)
            example = getattr(field_info, "example", None)
            if openapi_examples:
                parameter["examples"] = jsonable_encoder(openapi_examples)
            elif example is not _Unset:
                parameter["example"] = jsonable_encoder(example)
            if getattr(field_info, "deprecated", None):
                parameter["deprecated"] = True
            parameters.append(parameter)
    return parameters


def get_openapi_operation_request_body(
    *,
    body_field: ModelField | None,
    model_name_map: ModelNameMap,
    field_mapping: dict[
        tuple[ModelField, Literal["validation", "serialization"]], dict[str, Any]
    ],
    separate_input_output_schemas: bool = True,
) -> dict[str, Any] | None:
    if not body_field:
        return None
    assert isinstance(body_field, ModelField)
    body_schema = get_schema_from_model_field(
        field=body_field,
        model_name_map=model_name_map,
        field_mapping=field_mapping,
        separate_input_output_schemas=separate_input_output_schemas,
    )
    field_info = cast(Body, body_field.field_info)
    request_media_type = field_info.media_type
    required = body_field.field_info.is_required()
    request_body_oai: dict[str, Any] = {}
    if required:
        request_body_oai["required"] = required
    request_media_content: dict[str, Any] = {"schema": body_schema}
    if field_info.openapi_examples:
        request_media_content["examples"] = jsonable_encoder(
            field_info.openapi_examples
        )
    elif field_info.example is not _Unset:
        request_media_content["example"] = jsonable_encoder(field_info.example)
    request_body_oai["content"] = {request_media_type: request_media_content}
    return request_body_oai


def generate_operation_id(
    *, route: routing._APIRouteLike, method: str
) -> str:  # pragma: nocover
    warnings.warn(
      
```

### Core Architecture Module: `fastapi/security/utils.py`
```
def get_authorization_scheme_param(
    authorization_header_value: str | None,
) -> tuple[str, str]:
    if not authorization_header_value:
        return "", ""
    scheme, _, param = authorization_header_value.partition(" ")
    return scheme, param.strip()

```

### Core Architecture Module: `fastapi/utils.py`
```
import re
import warnings
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
)

import fastapi
from fastapi._compat import (
    ModelField,
    PydanticSchemaGenerationError,
    Undefined,
    annotation_is_pydantic_v1,
)
from fastapi.datastructures import DefaultPlaceholder, DefaultType
from fastapi.exceptions import FastAPIDeprecationWarning, PydanticV1NotSupportedError
from pydantic.fields import FieldInfo

from ._compat import v2

if TYPE_CHECKING:  # pragma: nocover
    from .routing import APIRoute


def is_body_allowed_for_status_code(status_code: int | str | None) -> bool:
    if status_code is None:
        return True
    # Ref: https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#patterned-fields-1
    if status_code in {
        "default",
        "1XX",
        "2XX",
        "3XX",
        "4XX",
        "5XX",
    }:
        return True
    current_status_code = int(status_code)
    return not (current_status_code < 200 or current_status_code in {204, 205, 304})


def get_path_param_names(path: str) -> set[str]:
    return set(re.findall("{(.*?)}", path))


_invalid_args_message = (
    "Invalid args for response field! Hint: "
    "check that {type_} is a valid Pydantic field type. "
    "If you are using a return type annotation that is not a valid Pydantic "
    "field (e.g. Union[Response, dict, None]) you can disable generating the "
    "response model from the type annotation with the path operation decorator "
    "parameter response_model=None. Read more: "
    "https://fastapi.tiangolo.com/tutorial/response-model/"
)


def create_model_field(
    name: str,
    type_: Any,
    default: Any | None = Undefined,
    field_info: FieldInfo | None = None,
    alias: str | None = None,
    mode: Literal["validation", "serialization"] = "validation",
) -> ModelField:
    if annotation_is_pydantic_v1(type_):
        raise PydanticV1NotSupportedError(
            "pydantic.v1 models are no longer supported by FastAPI."
            f" Please update the response model {type_!r}."
        )
    field_info = field_info or FieldInfo(annotation=type_, default=default, alias=alias)
    try:
        return v2.ModelField(mode=mode, name=name, field_info=field_info)
    except PydanticSchemaGenerationError:
        raise fastapi.exceptions.FastAPIError(
            _invalid_args_message.format(type_=type_)
        ) from None


def generate_operation_id_for_path(
    *, name: str, path: str, method: str
) -> str:  # pragma: nocover
    warnings.warn(
        message="fastapi.utils.generate_operation_id_for_path() was deprecated, "
        "it is not used internally, and will be removed soon",
        category=FastAPIDeprecationWarning,
        stacklevel=2,
    )
    operation_id = f"{name}{path}"
    operation_id = re.sub(r"\W", "_", operation_id)
    operation_id = f"{operation_id}_{method.lower()}"
    return operation_id


def generate_unique_id(route: "APIRoute") -> str:
    operation_id = f"{route.name}{route.path_format}"
    operation_id = re.sub(r"\W", "_", operation_id)
    assert route.methods
    operation_id = f"{operation_id}_{list(route.methods)[0].lower()}"
    return operation_id


def deep_dict_update(main_dict: dict[Any, Any], update_dict: dict[Any, Any]) -> None:
    for key, value in update_dict.items():
        if (
            key in main_dict
            and isinstance(main_dict[key], dict)
            and isinstance(value, dict)
        ):
            deep_dict_update(main_dict[key], value)
        elif (
            key in main_dict
            and isinstance(main_dict[key], list)
            and isinstance(update_dict[key], list)
        ):
            main_dict[key] = main_dict[key] + update_dict[key]
        else:
            main_dict[key] = value


def get_value_or_default(
    first_item: DefaultPlaceholder | DefaultType,
    *extra_items: DefaultPlaceholder | DefaultType,
) -> DefaultPlaceholder | DefaultType:
    """
    Pass items or `DefaultPlaceholder`s by descending priority.

    The first one to _not_ be a `DefaultPlaceholder` will be returned.

    Otherwise, the first item (a `DefaultPlaceholder`) will be returned.
    """
    items = (first_item,) + extra_items
    for item in items:
        if not isinstance(item, DefaultPlaceholder):
            return item
    return first_item

```

### Core Architecture Module: `scripts/doc_parsing_utils.py`
```
import re
from typing import TypedDict

CODE_INCLUDE_RE = re.compile(r"^\{\*\s*(\S+)\s*(.*)\*\}$")
CODE_INCLUDE_PLACEHOLDER = "<CODE_INCLUDE>"

HEADER_WITH_PERMALINK_RE = re.compile(r"^(#{1,6}) (.+?)(\s*\{\s*#.*\s*\})?\s*$")
HEADER_LINE_RE = re.compile(r"^(#{1,6}) (.+?)(?:\s*\{\s*(#.*)\s*\})?\s*$")

TIANGOLO_COM = "https://fastapi.tiangolo.com"
ASSETS_URL_PREFIXES = ("/img/", "/css/", "/js/")

MARKDOWN_LINK_RE = re.compile(
    r"(?<!\\)(?<!\!)"  # not an image ![...] and not escaped \[...]
    r"\[(?P<text>.*?)\]"  # link text (non-greedy)
    r"\("
    r"(?P<url>[^)\s]+)"  # url (no spaces and `)`)
    r'(?:\s+["\'](?P<title>.*?)["\'])?'  # optional title in "" or ''
    r"\)"
    r"(?:\{(?P<attrs>[^}]*)\})?"  # optional attributes in {}
)

HTML_LINK_RE = re.compile(r"<a\s+[^>]*>.*?</a>")
HTML_LINK_TEXT_RE = re.compile(r"<a\b([^>]*)>(.*?)</a>")
HTML_LINK_OPEN_TAG_RE = re.compile(r"<a\b([^>]*)>")
HTML_ATTR_RE = re.compile(r'(\w+)\s*=\s*([\'"])(.*?)\2')

CODE_BLOCK_LANG_RE = re.compile(r"^`{3,4}([\w-]*)", re.MULTILINE)

SLASHES_COMMENT_RE = re.compile(
    r"^(?P<code>.*?)(?P<comment>(?:(?<= )// .*)|(?:^// .*))?$"
)

HASH_COMMENT_RE = re.compile(r"^(?P<code>.*?)(?P<comment>(?:(?<= )# .*)|(?:^# .*))?$")


class CodeIncludeInfo(TypedDict):
    line_no: int
    line: str


class HeaderPermalinkInfo(TypedDict):
    line_no: int
    hashes: str
    title: str
    permalink: str


class MarkdownLinkInfo(TypedDict):
    line_no: int
    url: str
    text: str
    title: str | None
    attributes: str | None
    full_match: str


class HTMLLinkAttribute(TypedDict):
    name: str
    quote: str
    value: str


class HtmlLinkInfo(TypedDict):
    line_no: int
    full_tag: str
    attributes: list[HTMLLinkAttribute]
    text: str


class MultilineCodeBlockInfo(TypedDict):
    lang: str
    start_line_no: int
    content: list[str]


# Code includes
# --------------------------------------------------------------------------------------


def extract_code_includes(lines: list[str]) -> list[CodeIncludeInfo]:
    """
    Extract lines that contain code includes.

    Return list of CodeIncludeInfo, where each dict contains:
    - `line_no` - line number (1-based)
    - `line` - text of the line
    """

    includes: list[CodeIncludeInfo] = []
    for line_no, line in enumerate(lines, start=1):
        if CODE_INCLUDE_RE.match(line):
            includes.append(CodeIncludeInfo(line_no=line_no, line=line))
    return includes


def replace_code_includes_with_placeholders(text: list[str]) -> list[str]:
    """
    Replace code includes with placeholders.
    """

    modified_text = text.copy()
    includes = extract_code_includes(text)
    for include in includes:
        modified_text[include["line_no"] - 1] = CODE_INCLUDE_PLACEHOLDER
    return modified_text


def replace_placeholders_with_code_includes(
    text: list[str], original_includes: list[CodeIncludeInfo]
) -> list[str]:
    """
    Replace code includes placeholders with actual code includes from the original (English) document.
    Fail if the number of placeholders does not match the number of original includes.
    """

    code_include_lines = [
        line_no
        for line_no, line in enumerate(text)
        if line.strip() == CODE_INCLUDE_PLACEHOLDER
    ]

    if len(code_include_lines) != len(original_includes):
        raise ValueError(
            "Number of code include placeholders does not match the number of code includes "
            "in the original document "
            f"({len(code_include_lines)} vs {len(original_includes)})"
        )

    modified_text = text.copy()
    for i, line_no in enumerate(code_include_lines):
        modified_text[line_no] = original_includes[i]["line"]

    return modified_text


# Header permalinks
# --------------------------------------------------------------------------------------


def extract_header_permalinks(lines: list[str]) -> list[HeaderPermalinkInfo]:
    """
    Extract list of header permalinks from the given lines.

    Return list of HeaderPermalinkInfo, where each dict contains:
    - `line_no` - line number (1-based)
    - `hashes` - string of hashes representing header level (e.g., "###")
    - `permalink` - permalink string (e.g., "{#permalink}")
    """

    headers: list[HeaderPermalinkInfo] = []
    in_code_block3 = False
    in_code_block4 = False

    for line_no, line in enumerate(lines, start=1):
        if not (in_code_block3 or in_code_block4):
            if line.startswith("```"):
                count = len(line) - len(line.lstrip("`"))
                if count == 3:
                    in_code_block3 = True
                    continue
                elif count >= 4:
                    in_code_block4 = True
                    continue

            header_match = HEADER_WITH_PERMALINK_RE.match(line)
            if header_match:
                hashes, title, permalink = header_match.groups()
                headers.append(
                    HeaderPermalinkInfo(
                        hashes=hashes, line_no=line_no, permalink=permalink, title=title
                    )
                )

        elif in_code_block3:
            if line.startswith("```"):
                count = len(line) - len(line.lstrip("`"))
                if count == 3:
                    in_code_block3 = False
                    continue

        elif in_code_block4:
            if line.startswith("````"):
                count = len(line) - len(line.lstrip("`"))
                if count >= 4:
                    in_code_block4 = False
                    continue

    return headers


def remove_header_permalinks(lines: list[str]) -> list[str]:
    """
    Remove permalinks from headers in the given lines.
    """

    modified_lines: list[str] = []
    for line in lines:
        header_match = HEADER_WITH_PERMALINK_RE.match(line)
        if header_match:
            hashes, title, _permalink = header_match.groups()
            modified_line = f"{hashes} {title}"
            modified_lines.append(modified_line)
        else:
            modified_lines.append(line)
    return modified_lines


def replace_header_permalinks(
    text: list[str],
    header_permalinks: list[HeaderPermalinkInfo],
    original_header_permalinks: list[HeaderPermalinkInfo],
) -> list[str]:
    """
    Replace permalinks in the given text with the permalinks from the original document.

    Fail if the number or level of headers does not match the original.
    """

    modified_text: list[str] = text.copy()

    if len(header_permalinks) != len(original_header_permalinks):
        raise ValueError(
            "Number of headers with permalinks does not match the number in the "
            "original document "
            f"({len(header_permalinks)} vs {len(original_header_permalinks)})"
        )

    for header_no in range(len(header_permalinks)):
        header_info = header_permalinks[header_no]
        original_header_info = original_header_permalinks[header_no]

        if header_info["hashes"] != original_header_info["hashes"]:
            raise ValueError(
                "Header levels do not match between document and original document"
                f" (found {header_info['hashes']}, expected {original_header_info['hashes']})"
                f" for header №{header_no + 1} in line {header_info['line_no']}"
            )
        line_no = header_info["line_no"] - 1
        hashes = header_info["hashes"]
        title = header_info["title"]
        permalink = original_header_info["permalink"]
        modified_text[line_no] = f"{hashes} {title}{permalink}"

    return modified_text


# Markdown links
# --------------------------------------------------------------------------------------


def extract_markdown_links(lines: list[str]) -> list[MarkdownLinkInfo]:
    """
    Extract all markdown links from the given lines.

    Return list of MarkdownLinkInfo, where each dict contains:
    - `line_no` - line number (1-based)
    - `url` - link URL
    - `text` - link text
    - `title` - link title (if any)
    """

    links: list[MarkdownLinkInfo] = []
    for line_no, line in enumerate(lines, start=1):
        for m in MARKDOWN_LINK_RE.finditer(line):
            links.append(
                MarkdownLinkInfo(
                    line_no=line_no,
                    url=m.group("url"),
                    text=m.group("text"),
                    title=m.group("title"),
                    attributes=m.group("attrs"),
                    full_match=m.group(0),
                )
            )
    return links


def _add_lang_code_to_url(url: str, lang_code: str) -> str:
    if url.startswith(TIANGOLO_COM):
        rel_url = url[len(TIANGOLO_COM) :]
        if not rel_url.startswith(ASSETS_URL_PREFIXES):
            url = url.replace(TIANGOLO_COM, f"{TIANGOLO_COM}/{lang_code}")
    return url


def _construct_markdown_link(
    url: str,
    text: str,
    title: str | None,
    attributes: str | None,
    lang_code: str,
) -> str:
    """
    Construct a markdown link, adjusting the URL for the given language code if needed.
    """
    url = _add_lang_code_to_url(url, lang_code)

    if title:
        link = f'[{text}]({url} "{title}")'
    else:
        link = f"[{text}]({url})"

    if attributes:
        link += f"{{{attributes}}}"

    return link


def replace_markdown_links(
    text: list[str],
    links: list[MarkdownLinkInfo],
    original_links: list[MarkdownLinkInfo],
    lang_code: str,
) -> list[str]:
    """
    Replace markdown links in the given text with the original links.

    Fail if the number of links does not match the original.
    """

    if len(links) != len(original_links):
        raise ValueError(
            "Number of markdown links does not match the number in the "
            "original document "
            f"({len(links)} vs {len(original_links)})"
        )

    modified_text = text.copy()
    for i, link_info in enumerate(links):
        link_text = link_info["text"]
```

### Core Architecture Module: `fastapi/__init__.py`
```
"""FastAPI framework, high performance, easy to learn, fast to code, ready for production"""

__version__ = "0.142.4"

from starlette import status as status

from .applications import FastAPI as FastAPI
from .background import BackgroundTasks as BackgroundTasks
from .datastructures import UploadFile as UploadFile
from .exceptions import HTTPException as HTTPException
from .exceptions import WebSocketException as WebSocketException
from .param_functions import Body as Body
from .param_functions import Cookie as Cookie
from .param_functions import Depends as Depends
from .param_functions import File as File
from .param_functions import Form as Form
from .param_functions import Header as Header
from .param_functions import Path as Path
from .param_functions import Query as Query
from .param_functions import Security as Security
from .requests import Request as Request
from .responses import Response as Response
from .routing import APIRouter as APIRouter
from .websockets import WebSocket as WebSocket
from .websockets import WebSocketDisconnect as WebSocketDisconnect

```

### Core Architecture Module: `fastapi/__main__.py`
```
from fastapi.cli import main

main()

```

### Core Architecture Module: `fastapi/_compat/__init__.py`
```
from .shared import PYDANTIC_VERSION_MINOR_TUPLE as PYDANTIC_VERSION_MINOR_TUPLE
from .shared import annotation_is_pydantic_v1 as annotation_is_pydantic_v1
from .shared import field_annotation_is_scalar as field_annotation_is_scalar
from .shared import (
    field_annotation_is_scalar_sequence as field_annotation_is_scalar_sequence,
)
from .shared import field_annotation_is_sequence as field_annotation_is_sequence
from .shared import (
    is_bytes_or_nonable_bytes_annotation as is_bytes_or_nonable_bytes_annotation,
)
from .shared import is_bytes_sequence_annotation as is_bytes_sequence_annotation
from .shared import is_pydantic_v1_model_instance as is_pydantic_v1_model_instance
from .shared import (
    is_uploadfile_or_nonable_uploadfile_annotation as is_uploadfile_or_nonable_uploadfile_annotation,
)
from .shared import (
    is_uploadfile_sequence_annotation as is_uploadfile_sequence_annotation,
)
from .shared import lenient_issubclass as lenient_issubclass
from .shared import sequence_types as sequence_types
from .shared import value_is_sequence as value_is_sequence
from .v2 import ModelField as ModelField
from .v2 import PydanticSchemaGenerationError as PydanticSchemaGenerationError
from .v2 import RequiredParam as RequiredParam
from .v2 import Undefined as Undefined
from .v2 import Url as Url
from .v2 import copy_field_info as copy_field_info
from .v2 import create_body_model as create_body_model
from .v2 import evaluate_forwardref as evaluate_forwardref
from .v2 import get_cached_model_fields as get_cached_model_fields
from .v2 import get_definitions as get_definitions
from .v2 import get_flat_models_from_fields as get_flat_models_from_fields
from .v2 import get_missing_field_error as get_missing_field_error
from .v2 import get_model_name_map as get_model_name_map
from .v2 import get_schema_from_model_field as get_schema_from_model_field
from .v2 import is_scalar_field as is_scalar_field
from .v2 import serialize_sequence_value as serialize_sequence_value
from .v2 import (
    with_info_plain_validator_function as with_info_plain_validator_function,
)

```

### Core Architecture Module: `fastapi/_compat/shared.py`
```
import types
import typing
import warnings
from collections import deque
from collections.abc import Mapping, Sequence
from dataclasses import is_dataclass
from typing import (
    Annotated,
    Any,
    TypeGuard,
    TypeVar,
    Union,
    get_args,
    get_origin,
)

from fastapi.types import UnionType
from pydantic import BaseModel
from pydantic.version import VERSION as PYDANTIC_VERSION
from starlette.datastructures import UploadFile

_T = TypeVar("_T")

# Copy from Pydantic: pydantic/_internal/_typing_extra.py
WithArgsTypes: tuple[Any, ...] = (
    typing._GenericAlias,  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
    types.GenericAlias,
    types.UnionType,
)  # pyright: ignore[reportAttributeAccessIssue]

PYDANTIC_VERSION_MINOR_TUPLE = tuple(int(x) for x in PYDANTIC_VERSION.split(".")[:2])


sequence_annotation_to_type = {
    Sequence: list,
    list: list,
    tuple: tuple,
    set: set,
    frozenset: frozenset,
    deque: deque,
}

sequence_types: tuple[type[Any], ...] = tuple(sequence_annotation_to_type.keys())


# Copy of Pydantic: pydantic/_internal/_utils.py with added TypeGuard
def lenient_issubclass(
    cls: Any, class_or_tuple: type[_T] | tuple[type[_T], ...] | None
) -> TypeGuard[type[_T]]:
    try:
        return isinstance(cls, type) and issubclass(cls, class_or_tuple)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    except TypeError:  # pragma: no cover
        if isinstance(cls, WithArgsTypes):
            return False
        raise  # pragma: no cover


def _annotation_is_sequence(annotation: type[Any] | None) -> bool:
    if lenient_issubclass(annotation, (str, bytes)):
        return False
    return lenient_issubclass(annotation, sequence_types)


def field_annotation_is_sequence(annotation: type[Any] | None) -> bool:
    origin = get_origin(annotation)

    if origin is Annotated:
        return field_annotation_is_sequence(get_args(annotation)[0])

    if origin is Union or origin is UnionType:
        for arg in get_args(annotation):
            if field_annotation_is_sequence(arg):
                return True
        return False
    return _annotation_is_sequence(annotation) or _annotation_is_sequence(
        get_origin(annotation)
    )


def value_is_sequence(value: Any) -> bool:
    return isinstance(value, sequence_types) and not isinstance(value, (str, bytes))


def _annotation_is_complex(annotation: type[Any] | None) -> bool:
    return (
        lenient_issubclass(annotation, (BaseModel, Mapping, UploadFile))
        or _annotation_is_sequence(annotation)
        or is_dataclass(annotation)
    )


def field_annotation_is_complex(annotation: type[Any] | None) -> bool:
    origin = get_origin(annotation)
    if origin is Union or origin is UnionType:
        return any(field_annotation_is_complex(arg) for arg in get_args(annotation))

    if origin is Annotated:
        return field_annotation_is_complex(get_args(annotation)[0])

    return (
        _annotation_is_complex(annotation)
        or _annotation_is_complex(origin)
        or hasattr(origin, "__pydantic_core_schema__")
        or hasattr(origin, "__get_pydantic_core_schema__")
    )


def field_annotation_is_scalar(annotation: Any) -> bool:
    # handle Ellipsis here to make tuple[int, ...] work nicely
    return annotation is Ellipsis or not field_annotation_is_complex(annotation)


def field_annotation_is_scalar_sequence(annotation: type[Any] | None) -> bool:
    origin = get_origin(annotation)

    if origin is Annotated:
        return field_annotation_is_scalar_sequence(get_args(annotation)[0])

    if origin is Union or origin is UnionType:
        at_least_one_scalar_sequence = False
        for arg in get_args(annotation):
            if field_annotation_is_scalar_sequence(arg):
                at_least_one_scalar_sequence = True
                continue
            elif not field_annotation_is_scalar(arg):
                return False
        return at_least_one_scalar_sequence
    return field_annotation_is_sequence(annotation) and all(
        field_annotation_is_scalar(sub_annotation)
        for sub_annotation in get_args(annotation)
    )


def is_bytes_or_nonable_bytes_annotation(annotation: Any) -> bool:
    if lenient_issubclass(annotation, bytes):
        return True
    origin = get_origin(annotation)
    if origin is Union or origin is UnionType:
        for arg in get_args(annotation):
            if lenient_issubclass(arg, bytes):
                return True
    return False


def is_uploadfile_or_nonable_uploadfile_annotation(annotation: Any) -> bool:
    if lenient_issubclass(annotation, UploadFile):
        return True
    origin = get_origin(annotation)
    if origin is Union or origin is UnionType:
        for arg in get_args(annotation):
            if lenient_issubclass(arg, UploadFile):
                return True
    return False


def is_bytes_sequence_annotation(annotation: Any) -> bool:
    origin = get_origin(annotation)
    if origin is Union or origin is UnionType:
        at_least_one = False
        for arg in get_args(annotation):
            if is_bytes_sequence_annotation(arg):
                at_least_one = True
                continue
        return at_least_one
    return field_annotation_is_sequence(annotation) and all(
        is_bytes_or_nonable_bytes_annotation(sub_annotation)
        for sub_annotation in get_args(annotation)
    )


def is_uploadfile_sequence_annotation(annotation: Any) -> bool:
    origin = get_origin(annotation)
    if origin is Union or origin is UnionType:
        at_least_one = False
        for arg in get_args(annotation):
            if is_uploadfile_sequence_annotation(arg):
                at_least_one = True
                continue
        return at_least_one
    return field_annotation_is_sequence(annotation) and all(
        is_uploadfile_or_nonable_uploadfile_annotation(sub_annotation)
        for sub_annotation in get_args(annotation)
    )


def is_pydantic_v1_model_instance(obj: Any) -> bool:
    # TODO: remove this function once the required version of Pydantic fully
    # removes pydantic.v1
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            from pydantic import v1
    except ImportError:  # pragma: no cover
        return False
    return isinstance(obj, v1.BaseModel)


def is_pydantic_v1_model_class(cls: Any) -> bool:
    # TODO: remove this function once the required version of Pydantic fully
    # removes pydantic.v1
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            from pydantic import v1
    except ImportError:  # pragma: no cover
        return False
    return lenient_issubclass(cls, v1.BaseModel)


def annotation_is_pydantic_v1(annotation: Any) -> bool:
    if is_pydantic_v1_model_class(annotation):
        return True
    origin = get_origin(annotation)
    if origin is Union or origin is UnionType:
        for arg in get_args(annotation):
            if is_pydantic_v1_model_class(arg):
                return True
    if field_annotation_is_sequence(annotation):
        for sub_annotation in get_args(annotation):
            if annotation_is_pydantic_v1(sub_annotation):
                return True
    return False

```

### Core Architecture Module: `fastapi/_compat/v2.py`
```
import re
import warnings
from collections.abc import Sequence
from copy import copy
from dataclasses import dataclass, is_dataclass
from enum import Enum
from functools import lru_cache
from typing import (
    Annotated,
    Any,
    Literal,
    Union,
    cast,
    get_args,
    get_origin,
)

from fastapi._compat import lenient_issubclass, shared
from fastapi.openapi.constants import REF_TEMPLATE
from fastapi.types import IncEx, ModelNameMap, UnionType
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, create_model
from pydantic import PydanticSchemaGenerationError as PydanticSchemaGenerationError
from pydantic import PydanticUndefinedAnnotation as PydanticUndefinedAnnotation
from pydantic import ValidationError as ValidationError
from pydantic._internal import _typing_extra as _pydantic_typing_extra
from pydantic._internal._schema_generation_shared import (  # type: ignore[attr-defined]
    GetJsonSchemaHandler as GetJsonSchemaHandler,
)
from pydantic.fields import FieldInfo as FieldInfo
from pydantic.json_schema import GenerateJsonSchema as _GenerateJsonSchema
from pydantic.json_schema import JsonSchemaValue as JsonSchemaValue
from pydantic_core import CoreSchema as CoreSchema
from pydantic_core import PydanticUndefined
from pydantic_core import Url as Url
from pydantic_core.core_schema import (
    with_info_plain_validator_function as with_info_plain_validator_function,
)

RequiredParam = PydanticUndefined
Undefined = PydanticUndefined


def evaluate_forwardref(
    value: Any,
    globalns: dict[str, Any] | None = None,
    localns: dict[str, Any] | None = None,
) -> Any:
    # eval_type_lenient has been deprecated since Pydantic v2.10.0b1 (PR #10530)
    try_eval_type = getattr(_pydantic_typing_extra, "try_eval_type", None)
    if try_eval_type is not None:
        return try_eval_type(value, globalns, localns)[0]
    return _pydantic_typing_extra.eval_type_lenient(  # ty: ignore[deprecated]
        value, globalns, localns
    )


class GenerateJsonSchema(_GenerateJsonSchema):
    # TODO: remove when this is merged (or equivalent): https://github.com/pydantic/pydantic/pull/12841
    # and dropping support for any version of Pydantic before that one (so, in a very long time)
    def bytes_schema(self, schema: CoreSchema) -> JsonSchemaValue:
        json_schema = {"type": "string", "contentMediaType": "application/octet-stream"}
        bytes_mode = (
            self._config.ser_json_bytes
            if self.mode == "serialization"
            else self._config.val_json_bytes
        )
        if bytes_mode == "base64":
            json_schema["contentEncoding"] = "base64"
        self.update_with_validations(json_schema, schema, self.ValidationsMapping.bytes)
        return json_schema


# TODO: remove when dropping support for Pydantic < v2.12.3
_Attrs = {
    "default": ...,
    "default_factory": None,
    "alias": None,
    "alias_priority": None,
    "validation_alias": None,
    "serialization_alias": None,
    "title": None,
    "field_title_generator": None,
    "description": None,
    "examples": None,
    "exclude": None,
    "exclude_if": None,
    "discriminator": None,
    "deprecated": None,
    "json_schema_extra": None,
    "frozen": None,
    "validate_default": None,
    "repr": True,
    "init": None,
    "init_var": None,
    "kw_only": None,
}


# TODO: remove when dropping support for Pydantic < v2.12.3
def asdict(field_info: FieldInfo) -> dict[str, Any]:
    attributes = {}
    for attr in _Attrs:
        value = getattr(field_info, attr, Undefined)
        if value is not Undefined:
            attributes[attr] = value
    return {
        "annotation": field_info.annotation,
        "metadata": field_info.metadata,
        "attributes": attributes,
    }


@dataclass
class ModelField:
    field_info: FieldInfo
    name: str
    mode: Literal["validation", "serialization"] = "validation"
    config: ConfigDict | None = None

    @property
    def alias(self) -> str:
        a = self.field_info.alias
        return a if a is not None else self.name

    @property
    def validation_alias(self) -> str | None:
        va = self.field_info.validation_alias
        if isinstance(va, str) and va:
            return va
        return None

    @property
    def serialization_alias(self) -> str | None:
        sa = self.field_info.serialization_alias
        return sa or None

    @property
    def default(self) -> Any:
        return self.get_default()

    def __post_init__(self) -> None:
        with warnings.catch_warnings():
            # Pydantic >= 2.12.0 warns about field specific metadata that is unused
            # (e.g. `TypeAdapter(Annotated[int, Field(alias='b')])`). In some cases, we
            # end up building the type adapter from a model field annotation so we
            # need to ignore the warning:
            if shared.PYDANTIC_VERSION_MINOR_TUPLE >= (2, 12):
                from pydantic.warnings import UnsupportedFieldAttributeWarning

                warnings.simplefilter(
                    "ignore", category=UnsupportedFieldAttributeWarning
                )
            # TODO: remove after setting the min Pydantic to v2.12.3
            # that adds asdict(), and use self.field_info.asdict() instead
            field_dict = asdict(self.field_info)
            annotated_args = (
                field_dict["annotation"],
                *field_dict["metadata"],
                # this FieldInfo needs to be created again so that it doesn't include
                # the old field info metadata and only the rest of the attributes
                Field(**field_dict["attributes"]),
            )
            self._type_adapter: TypeAdapter[Any] = TypeAdapter(
                Annotated[annotated_args],  # ty: ignore[invalid-type-form]
                config=self.config,
            )

    def get_default(self) -> Any:
        if self.field_info.is_required():
            return Undefined
        return self.field_info.get_default(call_default_factory=True)

    def validate(
        self,
        value: Any,
        values: dict[str, Any] = {},  # noqa: B006
        *,
        loc: tuple[int | str, ...] = (),
    ) -> tuple[Any, list[dict[str, Any]]]:
        try:
            return (
                self._type_adapter.validate_python(value, from_attributes=True),
                [],
            )
        except ValidationError as exc:
            return None, _regenerate_error_with_loc(
                errors=exc.errors(include_url=False), loc_prefix=loc
            )

    def serialize(
        self,
        value: Any,
        *,
        mode: Literal["json", "python"] = "json",
        include: IncEx | None = None,
        exclude: IncEx | None = None,
        by_alias: bool = True,
        exclude_unset: bool = False,
        exclude_defaults: bool = False,
        exclude_none: bool = False,
    ) -> Any:
        # What calls this code passes a value that already called
        # self._type_adapter.validate_python(value)
        return self._type_adapter.dump_python(
            value,
            mode=mode,
            include=include,
            exclude=exclude,
            by_alias=by_alias,
            exclude_unset=exclude_unset,
            exclude_defaults=exclude_defaults,
            exclude_none=exclude_none,
        )

    def serialize_json(
        self,
        value: Any,
        *,
        include: IncEx | None = None,
        exclude: IncEx | None = None,
        by_alias: bool = True,
        exclude_unset: bool = False,
        exclude_defaults: bool = False,
        exclude_none: bool = False,
    ) -> bytes:
        # What calls this code passes a value that already called
        # self._type_adapter.validate_python(value)
        # This uses Pydantic's dump_json() which serializes directly to JSON
        # bytes in one pass (via Rust), avoiding the intermediate Python dict
        # step of dump_python(mode="json") + json.dumps().
        return self._type_adapter.dump_json(
            value,
            include=include,
            exclude=exclude,
            by_alias=by_alias,
            exclude_unset=exclude_unset,
            exclude_defaults=exclude_defaults,
            exclude_none=exclude_none,
        )

    def __hash__(self) -> int:
        # Each ModelField is unique for our purposes, to allow making a dict from
        # ModelField to its JSON Schema.
        return id(self)


def _has_computed_fields(field: ModelField) -> bool:
    computed_fields = field._type_adapter.core_schema.get("schema", {}).get(
        "computed_fields", []
    )
    return len(computed_fields) > 0


def get_schema_from_model_field(
    *,
    field: ModelField,
    model_name_map: ModelNameMap,
    field_mapping: dict[
        tuple[ModelField, Literal["validation", "serialization"]], JsonSchemaValue
    ],
    separate_input_output_schemas: bool = True,
) -> dict[str, Any]:
    override_mode: Literal["validation"] | None = (
        None
        if (separate_input_output_schemas or _has_computed_fields(field))
        else "validation"
    )
    field_alias = (
        (field.validation_alias or field.alias)
        if field.mode == "validation"
        else (field.serialization_alias or field.alias)
    )

    # This expects that GenerateJsonSchema was already used to generate the definitions
    json_schema = field_mapping[(field, override_mode or field.mode)]
    if "$ref" not in json_schema:
        # TODO remove when deprecating Pydantic v1
        # Ref: https://github.com/pydantic/pydantic/blob/d61792cc42c80b13b23e3ffa74bc37ec7c77f7d1/pydantic/schema.py#L207
        json_schema["title"] = field.field_info.title or field_alias.title().replace(
            "_", " "
        )
    return json_schema


def get_definitions(
    *,
    fields: Sequence[ModelField],
    model_name_map: ModelNameMap,
    separate_input_output_schemas: bool = True,
) -> tuple[
    dict[tuple[ModelField, Literal["validation", "serialization"]]
```

### Core Architecture Module: `fastapi/applications.py`
```
import os
from collections.abc import Awaitable, Callable, Coroutine, Sequence
from enum import Enum
from typing import Annotated, Any, Literal, TypeVar

from annotated_doc import Doc
from fastapi import routing
from fastapi.datastructures import Default, DefaultPlaceholder
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
    websocket_request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError, WebSocketRequestValidationError
from fastapi.logger import logger
from fastapi.middleware.asyncexitstack import AsyncExitStackMiddleware
from fastapi.openapi.docs import (
    get_redoc_html,
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.openapi.utils import get_openapi
from fastapi.params import Depends
from fastapi.telemetry import TelemetryConfig
from fastapi.telemetry._asgi import (
    ExceptionTelemetryMiddleware,
    NativeTelemetry,
    _legacy_otel,
)
from fastapi.types import DecoratedCallable, IncEx
from fastapi.utils import generate_unique_id
from starlette.applications import Starlette
from starlette.datastructures import State
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.errors import ServerErrorMiddleware
from starlette.middleware.exceptions import ExceptionMiddleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, Response
from starlette.routing import BaseRoute
from starlette.types import ASGIApp, ExceptionHandler, Lifespan, Receive, Scope, Send
from typing_extensions import deprecated

AppType = TypeVar("AppType", bound="FastAPI")


class FastAPI(Starlette):
    """
    `FastAPI` app class, the main entrypoint to use FastAPI.

    Read more in the
    [FastAPI docs for First Steps](https://fastapi.tiangolo.com/tutorial/first-steps/).

    ## Example

    ```python
    from fastapi import FastAPI

    app = FastAPI()
    ```
    """

    def __init__(
        self: AppType,
        *,
        telemetry: Annotated[
            TelemetryConfig | None,
            Doc(
                """
                Native OpenTelemetry configuration as a dictionary. Uses global
                providers by default. Omitted options keep their defaults.

                ```python
                app = FastAPI(telemetry={"tracing": False})
                ```
                """
            ),
        ] = None,
        debug: Annotated[
            bool,
            Doc(
                """
                Boolean indicating if debug tracebacks should be returned on server
                errors.

                Read more in the
                [Starlette docs for Applications](https://starlette.dev/applications/#starlette.applications.Starlette).
                """
            ),
        ] = False,
        routes: Annotated[
            list[BaseRoute] | None,
            Doc(
                """
                **Note**: you probably shouldn't use this parameter, it is inherited
                from Starlette and supported for compatibility.

                ---

                A list of routes to serve incoming HTTP and WebSocket requests.
                """
            ),
            deprecated(
                """
                You normally wouldn't use this parameter with FastAPI, it is inherited
                from Starlette and supported for compatibility.

                In FastAPI, you normally would use the *path operation methods*,
                like `app.get()`, `app.post()`, etc.
                """
            ),
        ] = None,
        title: Annotated[
            str,
            Doc(
                """
                The title of the API.

                It will be added to the generated OpenAPI (e.g. visible at `/docs`).

                Read more in the
                [FastAPI docs for Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/#metadata-for-api).

                **Example**

                ```python
                from fastapi import FastAPI

                app = FastAPI(title="ChimichangApp")
                ```
                """
            ),
        ] = "FastAPI",
        summary: Annotated[
            str | None,
            Doc(
                """
                A short summary of the API.

                It will be added to the generated OpenAPI (e.g. visible at `/docs`).

                Read more in the
                [FastAPI docs for Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/#metadata-for-api).

                **Example**

                ```python
                from fastapi import FastAPI

                app = FastAPI(summary="Deadpond's favorite app. Nuff said.")
                ```
                """
            ),
        ] = None,
        description: Annotated[
            str,
            Doc(
                '''
                A description of the API. Supports Markdown (using
                [CommonMark syntax](https://commonmark.org/)).

                It will be added to the generated OpenAPI (e.g. visible at `/docs`).

                Read more in the
                [FastAPI docs for Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/#metadata-for-api).

                **Example**

                ```python
                from fastapi import FastAPI

                app = FastAPI(
                    description="""
                                ChimichangApp API helps you do awesome stuff. 🚀

                                ## Items

                                You can **read items**.

                                ## Users

                                You will be able to:

                                * **Create users** (_not implemented_).
                                * **Read users** (_not implemented_).

                                """
                )
                ```
                '''
            ),
        ] = "",
        version: Annotated[
            str,
            Doc(
                """
                The version of the API.

                **Note** This is the version of your application, not the version of
                the OpenAPI specification nor the version of FastAPI being used.

                It will be added to the generated OpenAPI (e.g. visible at `/docs`).

                Read more in the
                [FastAPI docs for Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/#metadata-for-api).

                **Example**

                ```python
                from fastapi import FastAPI

                app = FastAPI(version="0.0.1")
                ```
                """
            ),
        ] = "0.1.0",
        openapi_url: Annotated[
            str | None,
            Doc(
                """
                The URL where the OpenAPI schema will be served from.

                If you set it to `None`, no OpenAPI schema will be served publicly, and
                the default automatic endpoints `/docs` and `/redoc` will also be
                disabled.

                Read more in the
                [FastAPI docs for Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/#openapi-url).

                **Example**

                ```python
                from fastapi import FastAPI

                app = FastAPI(openapi_url="/api/v1/openapi.json")
                ```
                """
            ),
        ] = "/openapi.json",
        openapi_tags: Annotated[
            list[dict[str, Any]] | None,
            Doc(
                """
                A list of tags used by OpenAPI, these are the same `tags` you can set
                in the *path operations*, like:

                * `@app.get("/users/", tags=["users"])`
                * `@app.get("/items/", tags=["items"])`

                The order of the tags can be used to specify the order shown in
                tools like Swagger UI, used in the automatic path `/docs`.

                It's not required to specify all the tags used.

                The tags that are not declared MAY be organized randomly or based
                on the tools' logic. Each tag name in the list MUST be unique.

                The value of each item is a `dict` containing:

                * `name`: The name of the tag.
                * `description`: A short description of the tag.
                    [CommonMark syntax](https://commonmark.org/) MAY be used for rich
                    text representation.
                * `externalDocs`: Additional external documentation for this tag. If
                    provided, it would contain a `dict` with:
                    * `description`: A short description of the target documentation.
                        [CommonMark syntax](https://commonmark.org/) MAY be used for
                        rich text representation.
                    * `url`: The URL for the target documentation. Value MUST be in
                        the form of a URL.

                Read more in the
                [FastAPI docs for Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/#metadata-for-tags).

                **Example**

                ```python
                from fastapi import FastAPI

                tags_metadata = [
                    {
                        "name": "users",
                        "description": "Operations with users. The **login** logic is also here.",
                    },
                    {
                        "name": "items",
                        "description": "Manage items. So _fancy_ they have their own docs.",
                        "externalDocs": {
                            "description": "Items external docs",
                            "url": "https://fastapi.tiangolo.com/",
       
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16470** (2026-10-07): **🐛 Isolate FastAPI telemetry for excluded requests**
  *Symptoms*: 🐛 Isolate FastAPI telemetry for excluded requests  ## AI Disclaimer  Made with the help of AI, using Codex with `gpt-6-astra`, manually reviewed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 24` untouched benchmarks        ---  <sub>Comparing <code>codex/isolate-excluded-request-telemetry</code> (b08ada9) with <code>master</code> (cb8dabc)</sub>  <a href="https://app.codspeed.io/fastapi/fastapi/branches/codex%2Fisolate-excluded-request-telemetry?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  

- **Issue #16468** (2026-10-07): **🐛 Cache OpenTelemetry tracers to preserve warning deduplication**
  *Symptoms*: 🐛 Cache OpenTelemetry tracers to preserve warning deduplication  ## AI Disclaimer  Made with the help of AI, using Codex with `gpt-6-astra`, manually reviewed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 24` untouched benchmarks        ---  <sub>Comparing <code>codex/cache-native-telemetry-tracer</code> (25b257b) with <code>master</code> (e74b6e0)[^unexpected-base]</sub>  <a href="https://app.codspeed.io/fastapi/fastapi/branches/codex%2Fcache-native-telemetry-tracer?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  [^unexpected-base]: No successful run was found on <code>master</code> (94918c1) during the generation of this report, so e74b6e0 was used instead as the comparison base. There might be

- **Issue #16418** (2026-09-30): **🐛 Allow startup when automatic OpenTelemetry configuration fails**
  *Symptoms*: 🐛 Allow startup when automatic OpenTelemetry configuration fails  Related to https://github.com/fastapi/fastapi/issues/16417  ## AI Disclaimer  Made with the help of AI, using Codex with `gpt-6-astra`, manually reviewed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 24` untouched benchmarks        ---  <sub>Comparing <code>codex/otel-startup-warning</code> (73c4915) with <code>master</code> (3e33a03)</sub>  <a href="https://app.codspeed.io/fastapi/fastapi/branches/codex%2Fotel-startup-warning?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  

- **Issue #16417** (2026-09-30): **0.142.0: app fails to start when OTEL_EXPORTER_OTLP_ENDPOINT is set but the opentelemetry extra isn't installed**
  *Symptoms*:  ### Discussed in https://github.com/fastapi/fastapi/discussions/16413  <div type='discussions-op-text'>  <sup>Originally posted by **kareem-modal** September 29, 2026</sup> ### First Check  - [X] I added a very descriptive title here. - [X] I used the GitHub search to find a similar question and didn't find it. - [X] I searched the FastAPI documentation, with the integrated search. - [X] I already searched in Google "How to X in FastAPI" and didn't find any information. - [X] I already read and followed all the tutorial in the docs and didn't find an answer. - [X] I already checked if it is not related to FastAPI but to [Pydantic](https://github.com/pydantic/pydantic). - [X] I already checked if it is not related to FastAPI but to [Swagger UI](https://github.com/swagger-api/swagger-ui). - [X] I already checked if it is not related to FastAPI but to [ReDoc](https://github.com/Redocly/redoc).  ### Commit to Help  - [X] I commit to help with one of those options 👆  ### Example Code  ```python export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318    uv run --with fastapi==0.142.0 --with uvicorn \     python -c 'import uvicorn; from fastapi import FastAPI; uvicorn.run(FastAPI(), port=8000)' ```   ### Description  Run the code snippet above and observe  > ERROR:    Automatic OpenTelemetry export requires fastapi[opentelemetry] or fastapi[standard]. Install the extra, configure providers yourself, or pass telemetry={'auto_configure': False} to FastAPI(). ERROR:    Applicat
  **Post-Mortem & Fix Analysis**:
  > This should be fixed by https://github.com/fastapi/fastapi/pull/16418, available in FastAPI 0.142.2, just released. 🎉 

- **Issue #16414** (2026-09-29): **🐛 Fix repeated endpoint wrapping in included routers**
  *Symptoms*: 🐛 Fix repeated endpoint wrapping in included routers  This would handle a recursion issue with older versions of Sentry (the latest one handles it).  ## AI Disclaimer  Made with the help of AI, using Codex with `gpt-6-astra`, manually reviewed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 24` untouched benchmarks        ---  <sub>Comparing <code>codex/cache-included-route-handlers</code> (983433b) with <code>master</code> (bd41128)</sub>  <a href="https://app.codspeed.io/fastapi/fastapi/branches/codex%2Fcache-included-route-handlers?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  

- **Issue #16105** (2026-07-29): **🐛 Fix support for background tasks and headers from dependencies in `app.frontend()`**
  *Symptoms*: 🐛 Fix support for background tasks and headers from dependencies in `app.frontend()`  ## Pull Request  <!-- Please start with a GitHub Discussion.  Once a team member asks you to open a PR, create it and link the discussion here.  Typos, grammar issues, broken links and other small docs improvements should be reported in the pinned Discussion thread "✏️ Report small docs improvements, including typos or broken links". Please do not open a PR for these yourself. -->  Discussion: <!-- Link to the GitHub Discussion -->  ## Description  <!-- Write the description of your PR here -->  ## AI Disclaimer  Codex with GPT 5.6-sol. Several iterations and lots of steering because the thingy wanted to do weird things, one after the other.  <!-- If using AI, write here the prompt and model used -->  <details> <summary>AI transcript</summary>  <!-- Paste here the entire AI transcript -->  </details>  ## Checklist  - [ ] This PR links to a GitHub Discussion for the proposed code change. - [ ] I added tests for the change. - [ ] The new or updated tests fail on the main branch and pass on this PR. - [ ] Coverage stays at 100%. - [ ] The documentation explains the change if needed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 24` untouched benchmarks        ---  <sub>Comparing <code>frontend-deps-bg-headers</code> (4cc3286) with <code>master</code> (8a1f876)[^unexpected-base]</sub>  <a href="https://app.codspeed.io/fastapi/fastapi/branches/frontend-deps-bg-headers?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  [^unexpected-base]: No successful run was found on <code>master</code> (1d211b9) during the generation of this report, so 8a1f876 was used instead as the comparison base. There might be some changes unrelated 
  > ## 📝 Docs preview  Last commit 4cc32869cd52574eeb631cf4c257822ce6b0be8f at: https://23434056.fastapitiangolo.pages.dev  ### Modified Pages  * https://23434056.fastapitiangolo.pages.dev/tutorial/frontend/ - ([before](https://fastapi.tiangolo.com/tutorial/frontend/)) 

- **Issue #16043** (2026-07-28): **🐛 Fix `exclude_defaults` not propagated to dict keys and values in `jsonable_encoder`**
  *Symptoms*: ## Problem  `jsonable_encoder` forwards `exclude_defaults` when recursing into list/tuple/set items, but drops it when recursing into dict keys and values — while the sibling flags `exclude_unset` and `exclude_none` *are* forwarded in that same dict branch. The same model with the same flag encodes differently depending on its container:  ```python from pydantic import BaseModel from fastapi.encoders import jsonable_encoder  class M(BaseModel):     a: int = 5  jsonable_encoder([M()], exclude_defaults=True)       # [{}] jsonable_encoder({"k": M()}, exclude_defaults=True)  # {"k": {"a": 5}}  <- flag silently ignored ```  Reproduced on 0.139.2.  ## Fix  Forward `exclude_defaults` in the dict branch's key and value recursion, matching the list branch and the two sibling flags already passed there.  This deliberately does **not** change `include`/`exclude` propagation for dict values — that's the broader design question tracked in discussion #15961; this PR only removes the inconsistency between the two container branches for a flag that is already documented as recursive.  ## Tests  Added `test_encode_model_with_default_in_dict_and_list` covering list, dict, and dict-of-list nesting plus a guard that `exclude_unset`/`exclude_none` behaviour is unchanged.  `pytest tests/test_jsonable_encoder.py tests/test_serialize_response.py tests/test_serialize_response_model.py tests/test_serialize_response_dataclass.py tests/test_skip_defaults.py tests/test_response_by_alias.py` → 59 passed, 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 24` untouched benchmarks        ---  <sub>Comparing <code>MBGrao:fix/jsonable-encoder-dict-exclude-defaults</code> (cc0fe85) with <code>master</code> (5e8b7f1)</sub>  <a href="https://app.codspeed.io/fastapi/fastapi/branches/MBGrao%3Afix%2Fjsonable-encoder-dict-exclude-defaults?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  

- **Issue #16013** (2026-07-16): **🐛 Refactor router route building to make it thread-safe, mainly relevant for tests running in parallel threads (uncommon)**
  *Symptoms*: ## Pull Request  🐛 Refactor router route building to make it thread-safe, mainly relevant for tests running in parallel threads (uncommon)  This should solve what's described in https://github.com/fastapi/fastapi/discussions/15914  <!-- Please start with a GitHub Discussion.  Once a team member asks you to open a PR, create it and link the discussion here.  Typos, grammar issues, broken links and other small docs improvements should be reported in the pinned Discussion thread "✏️ Report small docs improvements, including typos or broken links". Please do not open a PR for these yourself. -->  Discussion: <!-- Link to the GitHub Discussion -->  ## Description  <!-- Write the description of your PR here -->  ## AI Disclaimer  Codex with GPT-5.6-sol  <!-- If using AI, write here the prompt and model used -->  <details> <summary>AI transcript</summary>  <!-- Paste here the entire AI transcript -->  </details>  ## Checklist  - [ ] This PR links to a GitHub Discussion for the proposed code change. - [ ] I added tests for the change. - [ ] The new or updated tests fail on the main branch and pass on this PR. - [ ] Coverage stays at 100%. - [ ] The documentation explains the change if needed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**     `✅ 20` untouched benchmarks        ---  <sub>Comparing <code>thread-routes-cache</code> (9f919ff) with <code>master</code> (c48e67b)</sub>  <a href="https://app.codspeed.io/fastapi/fastapi/branches/thread-routes-cache?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  

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

### Incident Patch 1: `6eae2f34` (2026-10-07)
**Commit Message**: 🐛 Cache OpenTelemetry tracers to preserve warning deduplication (#16468)

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ jobs:
       - changes
     if: needs.changes.outputs.src == 'true' || github.ref == 'refs/heads/master'
     runs-on: ubuntu-latest
-    timeout-minutes: 5
+    timeout-minutes: 10
     env:
       UV_PYTHON: "3.13"
       UV_RESOLUTION: highest
```

**File**: `fastapi/telemetry/_asgi.py` (modified, +12/-6)
```diff
@@ -168,6 +168,8 @@ def __init__(self, config: TelemetryConfig) -> None:
         self._provider: metrics.MeterProvider | None = None
         self._duration: Histogram | None = None
         self._active: UpDownCounter | None = None
+        self._tracer_provider: trace.TracerProvider | None = None
+        self._tracer: trace.Tracer | None = None
 
     def enabled(self) -> bool:
         config = self.config
@@ -214,6 +216,15 @@ def _instruments(self) -> tuple[Histogram, UpDownCounter]:
         assert self._duration is not None and self._active is not None
         return self._duration, self._active
 
+    def _get_tracer(self, *, provider: trace.TracerProvider) -> trace.Tracer:
+        if provider is not self._tracer_provider:
+            self._tracer = provider.get_tracer(
+                "fastapi", __version__, schema_url=_SCHEMA_URL
+            )
+            self._tracer_provider = provider
+        assert self._tracer is not None
+        return self._tracer
+
     async def __call__(
         self,
         *,
@@ -282,12 +293,7 @@ async def __call__(
         if tracing:
             parent = propagate.extract(Headers(scope=scope), getter=_HEADERS_GETTER)
             parent_token = otel_context.attach(parent)
-            tracer = trace.get_tracer(
-                "fastapi",
-                __version__,
-                config["tracer_provider"],
-                schema_url=_SCHEMA_URL,
-            )
+            tracer = self._get_tracer(provider=provider)
             span_attributes = {**attributes, **_server_attributes(scope)}
             if not is_websocket:
                 span_attributes["url.path"] = scope["path"]
```

**File**: `tests/test_telemetry/test_tracer.py` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+import warnings
+from unittest.mock import Mock
+
+import pytest
+from fastapi import FastAPI, WebSocket
+from fastapi.testclient import TestClient
+from opentelemetry import trace
+from opentelemetry.sdk.trace import TracerProvider
+from opentelemetry.sdk.trace.export import SimpleSpanProcessor
+from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
+
+from .conftest import server_spans
+
+
+@pytest.mark.parametrize("global_provider", [False, True])
+@pytest.mark.parametrize("protocol", ["http", "websocket"])
+def test_tracer_lookup_preserves_warning_deduplication(
+    telemetry, monkeypatch, global_provider, protocol
+):
+    config, exporter, _ = telemetry
+    provider = config["tracer_provider"]
+    get_tracer = Mock(wraps=provider.get_tracer)
+    monkeypatch.setattr(provider, "get_tracer", get_tracer)
+    if global_provider:
+        monkeypatch.setattr(trace, "get_tracer_provider", lambda: provider)
+        config["tracer_provider"] = None
+    app = FastAPI(telemetry=config)
+
+    @app.get("/")
+    def endpoint():
+        warnings.warn("Repeated endpoint warning", UserWarning, stacklevel=1)
+        return "ok"
+
+    @app.websocket("/ws")
+    async def websocket_endpoint(websocket: WebSocket):
+        await websocket.accept()
+        warnings.warn("Repeated endpoint warning", UserWarning, stacklevel=1)
+        await websocket.close()
+
+    get_tracer.assert_not_called()
+    with warnings.catch_warnings(record=True) as caught:
+        warnings.simplefilter("default")
+        with TestClient(app) as client:
+            for _ in range(5):
+                if protocol == "http":
+                    assert client.get("/").json() == "ok"
+                else:
+                    with client.websocket_connect("/ws") as websocket:
+                        assert websocket.receive()["type"] == "websocket.close"
+    assert [str(warning.message) for warning in caught] == ["Repeated endpoint warning"]
+    get_tracer.assert_called_once()
+    spans = server_spans(exporter)
+    assert len(spans) == 5
+    assert len({span.context.trace_id for span in spans}) == 5
+
+
+def test_cached_tracer_follows_provider_changes(telemetry, monkeypatch):
+    config, exporter, _ = telemetry
+    provider = config["tracer_provider"]
+    monkeypatch.setattr(trace, "get_tracer_provider", lambda: provider)
+    app = FastAPI()
+    client = TestClient(app)
+    for _ in range(2):
+        assert client.get("/").status_code == 404
+    assert len(server_spans(exporter)) == 2
+
+    other_exporter = InMemorySpanExporter()
+    other_provider = TracerProvider(shutdown_on_exit=False)
+    other_provider.add_span_processor(SimpleSpanProcessor(other_exporter))
+    monkeypatch.setattr(trace, "get_tracer_provider", lambda: other_provider)
+    try:
+        for _ in range(2):
+            assert client.get("/").status_code == 404
+        assert len(server_spans(other_exporter)) == 2
+        assert len(server_spans(exporter)) == 2
+    finally:
+        other_provider.shutdown()
```

---

### Incident Patch 2: `e74b6e09` (2026-10-06)
**Commit Message**: 👷 Fix deprecated command in `bump-pre-commit-hooks` workflow (#16463)

**File**: `.github/workflows/bump-pre-commit-hooks.yml` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ jobs:
             pyproject.toml
             uv.lock
       - name: Bump pre-commit hooks
-        run: uv run prek auto-update --freeze --cooldown-days 7
+        run: uv run prek update --freeze --cooldown-days 7
       - name: Get PR Submit token
         id: pr-submit
         uses: tiangolo/pr-submit@d802fdf59bde80bc3eb8bd3259f4cbeec63de4aa # 0.0.1
@@ -62,7 +62,7 @@ jobs:
               --base "$BASE_BRANCH" \
               --head "$branch" \
               --title "⬆ Bump pre-commit hooks" \
-              --body "Bump pre-commit hook versions via \`prek auto-update --freeze --cooldown-days 7\`." \
+              --body "Bump pre-commit hook versions via \`prek update --freeze --cooldown-days 7\`." \
               --label internal \
               --label dependencies \
               --label pre-commit
```

---

### Incident Patch 3: `4713a344` (2026-10-05)
**Commit Message**: 🔧 Update sponsors: remove Render (#16457)

**File**: `README.md` (modified, +0/-1)
```diff
@@ -53,7 +53,6 @@ The key features are:
 
 <a href="https://blockbee.io?ref=fastapi" target="_blank" title="BlockBee Cryptocurrency Payment Gateway"><img src="https://fastapi.tiangolo.com/img/sponsors/blockbee.png"></a>
 <a href="https://www.propelauth.com/?utm_source=fastapi&utm_campaign=1223&utm_medium=mainbadge" target="_blank" title="Auth, user management and more for your B2B product"><img src="https://fastapi.tiangolo.com/img/sponsors/propelauth.png"></a>
-<a href="https://docs.render.com/deploy-fastapi?utm_source=deploydoc&utm_medium=referral&utm_campaign=fastapi" target="_blank" title="Deploy & scale any full-stack web app on Render. Focus on building apps, not infra."><img src="https://fastapi.tiangolo.com/img/sponsors/render.svg"></a>
 <a href="https://www.coderabbit.ai/?utm_source=fastapi&utm_medium=badge&utm_campaign=fastapi" target="_blank" title="Cut Code Review Time & Bugs in Half with CodeRabbit"><img src="https://fastapi.tiangolo.com/img/sponsors/coderabbit.png"></a>
 <a href="https://subtotal.com/?utm_source=fastapi&utm_medium=sponsorship&utm_campaign=open-source" target="_blank" title="The Gold Standard in Retail Account Linking"><img src="https://fastapi.tiangolo.com/img/sponsors/subtotal.svg"></a>
 <a href="https://docs.railway.com/guides/fastapi?utm_medium=integration&utm_source=docs&utm_campaign=fastapi" target="_blank" title="Deploy enterprise applications at startup speed"><img src="https://fastapi.tiangolo.com/img/sponsors/railway.png"></a>
```

**File**: `docs/en/data/sponsors.yml` (modified, +0/-4)
```diff
@@ -12,10 +12,6 @@ gold:
     img: /img/sponsors/propelauth.png
     banner_url: https://www.propelauth.com/?utm_source=fastapi&utm_campaign=1223&utm_medium=topbanner
     banner_img: /img/sponsors/propelauth-banner.png
-  - url: https://docs.render.com/deploy-fastapi?utm_source=deploydoc&utm_medium=referral&utm_campaign=fastapi
-    title: Deploy & scale any full-stack web app on Render. Focus on building apps, not infra.
-    img: /img/sponsors/render.svg
-    banner_img: /img/sponsors/render-banner.svg
   - url: https://www.coderabbit.ai/?utm_source=fastapi&utm_medium=badge&utm_campaign=fastapi
     title: Cut Code Review Time & Bugs in Half with CodeRabbit
     img: /img/sponsors/coderabbit.png
```

**File**: `docs/en/docs/deployment/cloud.md` (modified, +0/-1)
```diff
@@ -20,5 +20,4 @@ Some other cloud providers ✨ [**sponsor FastAPI**](https://github.com/sponsors
 
 You might also want to consider them to follow their guides and try their services:
 
-* [Render](https://docs.render.com/deploy-fastapi?utm_source=deploydoc&utm_medium=referral&utm_campaign=fastapi)
 * [Railway](https://docs.railway.com/guides/fastapi?utm_medium=integration&utm_source=docs&utm_campaign=fastapi)
```

**File**: `docs/en/overrides/partials/banner-sponsors.html` (modified, +0/-6)
```diff
@@ -10,12 +10,6 @@
     <img class="sponsor-image" src="/img/sponsors/propelauth-banner.png" alt="Auth, user management and more for your B2B product" />
   </a>
 </div>
-<div class="item">
-  <a title="Deploy & scale any full-stack web app on Render. Focus on building apps, not infra." style="display: block; position: relative;" href="https://docs.render.com/deploy-fastapi?utm_source=deploydoc&utm_medium=referral&utm_campaign=fastapi" target="_blank">
-    <span class="sponsor-badge">sponsor</span>
-    <img class="sponsor-image" src="/img/sponsors/render-banner.svg" alt="Deploy & scale any full-stack web app on Render. Focus on building apps, not infra." />
-  </a>
-</div>
 <div class="item">
   <a title="Cut Code Review Time & Bugs in Half with CodeRabbit" style="display: block; position: relative;" href="https://www.coderabbit.ai/?utm_source=fastapi&utm_medium=banner&utm_campaign=fastapi" target="_blank">
     <span class="sponsor-badge">sponsor</span>
```

---

### Incident Patch 4: `ac88f563` (2026-09-29)
**Commit Message**: 🐛 Fix repeated endpoint wrapping in included routers (#16414)

**File**: `fastapi/routing.py` (modified, +10/-6)
```diff
@@ -1304,12 +1304,8 @@ async def handle(self, scope: Scope, receive: Receive, send: Send) -> None:
                 )
                 await response(scope, receive, send)
                 return
-            token = _effective_route_context_var.set(effective_context)
-            try:
-                app = request_response(self.get_route_handler())
-            finally:
-                _effective_route_context_var.reset(token)
-            await app(scope, receive, send)
+            assert effective_context.app is not None
+            await effective_context.app(scope, receive, send)
             return
         await super().handle(scope, receive, send)
 
@@ -1407,6 +1403,7 @@ def path_for(self, route: _RouteWithPath) -> str:
 class _EffectiveRouteContext:
     original_route: BaseRoute
     starlette_route: BaseRoute | None = None
+    app: ASGIApp | None = field(default=None, repr=False, compare=False)
     frontend_prefix: str = ""
     path: str = ""
     endpoint: Callable[..., Any] | None = None
@@ -1508,6 +1505,13 @@ def from_api_route(
             ),
             stream_item_type=route.stream_item_type,
         )
+        # Build once per inclusion context, just as APIRoute does for direct routes.
+        # Integrations may wrap dependant.call while constructing the handler.
+        token = _effective_route_context_var.set(context)
+        try:
+            context.app = request_response(original_route.get_route_handler())
+        finally:
+            _effective_route_context_var.reset(token)
         return context
 
     @classmethod
```

**File**: `tests/test_route_handler_wrapping.py` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+from functools import wraps
+
+import pytest
+from fastapi import APIRouter, Depends, FastAPI, routing
+from fastapi.responses import PlainTextResponse
+from fastapi.testclient import TestClient
+
+
+@pytest.mark.parametrize("include_router", [False, True], ids=["direct", "included"])
+def test_endpoint_wrapper_does_not_accumulate_across_requests(
+    monkeypatch, include_router
+):
+    original_get_request_handler = routing.get_request_handler
+    wrapper_calls = 0
+
+    def get_request_handler_with_endpoint_wrapper(*args, **kwargs):
+        # Older Sentry SDKs wrap dependant.call each time a handler is built.
+        # Accumulating these wrappers eventually exhausts the recursion limit.
+        dependant = kwargs["dependant"]
+        original_call = dependant.call
+
+        @wraps(original_call)
+        def wrapped_endpoint(*args, **kwargs):
+            nonlocal wrapper_calls
+            wrapper_calls += 1
+            return original_call(*args, **kwargs)
+
+        dependant.call = wrapped_endpoint
+        return original_get_request_handler(*args, **kwargs)
+
+    monkeypatch.setattr(
+        routing, "get_request_handler", get_request_handler_with_endpoint_wrapper
+    )
+
+    app = FastAPI()
+    router = APIRouter() if include_router else app.router
+
+    @router.get("/items/{item_id}")
+    def read_item(item_id: str):
+        return {"item_id": item_id}
+
+    if include_router:
+        app.include_router(router)
+
+    calls_per_request = []
+    with TestClient(app) as client:
+        for item_id in ("first", "second", "third"):
+            wrapper_calls = 0
+            response = client.get(f"/items/{item_id}")
+            assert response.status_code == 200
+            assert response.json() == {"item_id": item_id}
+            calls_per_request.append(wrapper_calls)
+
+    assert calls_per_request == [1, 1, 1]
+
+
+def test_custom_handlers_are_cached_separately_for_nested_inclusions():
+    built_handlers = []
+
+    class CustomRoute(routing.APIRoute):
+        def get_route_handler(self):
+            handler = super().get_route_handler()
+            built_handlers.append(handler)
+            handler_id = str(len(built_handlers))
+
+            async def custom_handler(request):
+                response = await handler(request)
+                response.headers["x-handler-id"] = handler_id
+                return response
+
+            return custom_handler
+
+    router = APIRouter(route_class=CustomRoute)
+
+    @router.get("/{item_id}")
+    def read_item(item_id: str):
+        return item_id
+
+    parent = APIRouter()
+    parent.include_router(router, prefix="/json")
+    parent.include_router(
+        router, prefix="/text", default_response_class=PlainTextResponse
+    )
+    app = FastAPI()
+    app.include_router(parent, prefix="/api")
+
+    with TestClient(app) as client:
+        first_json = client.get("/api/json/first")
+        first_text = client.get("/api/text/first")
+        json_handler_id = first_json.headers["x-handler-id"]
+        text_handler_id = first_text.headers["x-handler-id"]
+        assert json_handler_id != text_handler_id
+        built_count = len(built_handlers)
+
+        for item_id in ("second", "third"):
+            json_response = client.get(f"/api/json/{item_id}")
+            assert json_response.status_code == 200
+            assert json_response.json() == item_id
+            assert json_response.headers["x-handler-id"] == json_handler_id
+            text_response = client.get(f"/api/text/{item_id}")
+            assert text_response.status_code == 200
+            assert text_response.text == item_id
+            assert text_response.headers["x-handler-id"] == text_handler_id
+
+    assert len(built_handlers) == built_count
+
+
+def test_cached_handler_uses_live_dependency_overrides_and_route_additions():
+    router = APIRouter()
+
+    def dependency():
+        return "original"
+
+    @router.get("/items")
+    def read_items(value: str = Depends(dependency)):
+        return value
+
+    app = FastAPI()
+    app.include_router(router, prefix="/api")
+
+    with TestClient(app) as client:
+        assert client.get("/api/items").json() == "original"
+        app.dependency_overrides[dependency] = lambda: "overridden"
+        assert client.get("/api/items").json() == "overridden"
+
+        @router.get("/later")
+        def read_later(value: str = Depends(dependency)):
+            return value
+
+        assert client.get("/api/items").json() == "overridden"
+        assert client.get("/api/later").json() == "overridden"
+        app.dependency_overrides.clear()
+        assert client.get("/api/items").json() == "original"
+        assert client.get("/api/later").json() == "original"
+
+
+def test_failed_handler_construction_restores_context_and_can_retry():
+    fail = False
+
+    class CustomRoute(routing.APIRoute):
+        def get_route_handler(self):
+            if fail:
+         
```

---

### Incident Patch 5: `79d42b21` (2026-09-29)
**Commit Message**: ✅ Fix frontend test timeout with Starlette Git (#16408)

**File**: `tests/test_frontend.py` (modified, +2/-5)
```diff
@@ -578,11 +578,8 @@ def frontend_dependency() -> None:
     messages = []
 
     async def receive():
-        return {  # pragma: no cover
-            "type": "http.request",
-            "body": b"",
-            "more_body": False,
-        }
+        # Keep the connection open until the response finishes.
+        await anyio.sleep_forever()
 
     async def send(message):
         messages.append(message)
```

#### Recent Merged Pull Requests:
- **PR #16471** (2026-10-07): 🔖 Release version 0.142.4 (@pr-submit[bot])
- **PR #16470** (2026-10-07): 🐛 Isolate FastAPI telemetry for excluded requests (@tiangolo)
- **PR #16469** (2026-10-07): 🔖 Release version 0.142.3 (@pr-submit[bot])
- **PR #16468** (2026-10-07): 🐛 Cache OpenTelemetry tracers to preserve warning deduplication (@tiangolo)
- **PR #16465** (closed): Support SkipJsonSchema in Query() (@eltoder)
- **PR #16463** (2026-10-06): 👷 Fix deprecated command in `bump-pre-commit-hooks` workflow (@YuriiMotov)
- **PR #16462** (closed): test: cover 205 responses without a body (@madhavanms2803-ui)
- **PR #16461** (2026-10-06): 📝 Remove HTML title from newsletter to avoid the tooltip (@tiangolo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
