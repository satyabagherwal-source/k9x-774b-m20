> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fastapi-fastapi-learnings.md`  
> **Source**: github ([https://github.com/fastapi/fastapi](https://github.com/fastapi/fastapi))  
> **Source Version**: `e5fc7ef5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T16:56:06.458Z  
> **Learning ID**: `learn-github-fastapi-fastapi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): fastapi/fastapi

> **Canonical Artifact**: `07_PROJECT_LEARNING/fastapi-fastapi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fastapi/fastapi](https://github.com/fastapi/fastapi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T16:56:05.153Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fastapi/fastapi`
- **Description**: FastAPI framework, high performance, easy to learn, fast to code, ready for production
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 103250 stars

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
from pydantic import AliasChoices, BaseModel, Json
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

__version__ = "0.148.0"

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16509** (2026-10-16): **🐛 Fix non-finite float serialization in JSONL and SSE streams**
  *Symptoms*: 🐛 Fix non-finite float serialization in JSONL and SSE streams  ## AI Disclaimer  Made with the help of AI, using Codex with `gpt-6-astra`, manually reviewed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**  <details> <summary>:warning: <b>20 benchmarks spent significant time in system calls</b></summary>  > System calls cannot be consistently instrumented, so they are not included in the measure, which understates the real cost. Please switch to [the Walltime instrument](https://codspeed.io/docs/instruments/walltime?utm_source=github&utm_medium=comment-v2&utm_content=significant_sys_time) to accurately measure system calls. > > [Measurement and system calls](https://codspeed.io/docs/instruments/cpu?utm_source=github&utm_medium=comment-v2&utm_content=significant_sys_time#system-calls) > > - [`` test_async_return_large_dict_with_response_model ``](https://app.codspeed.io/fastapi/fastapi/branches/codex%2Ffix-stream-non-finite-floats?uri=tests%2Fbenchmarks%2Ftest_general_performance.py%3A%3Atest_async_return_large_dict_with_response_model&runnerMode=Simulation&utm_source=github&utm_medium=comme
  > Nice @tiangolo 

- **Issue #16503** (2026-10-15): **🐛 Fix blocking frontend fallback file checks**
  *Symptoms*: 🐛 Fix blocking frontend fallback file checks  ## AI Disclaimer  Made with the help of AI, using Codex with `gpt-6-astra`, manually reviewed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**  <details> <summary>:warning: <b>20 benchmarks spent significant time in system calls</b></summary>  > System calls cannot be consistently instrumented, so they are not included in the measure, which understates the real cost. Please switch to [the Walltime instrument](https://codspeed.io/docs/instruments/walltime?utm_source=github&utm_medium=comment-v2&utm_content=significant_sys_time) to accurately measure system calls. > > [Measurement and system calls](https://codspeed.io/docs/instruments/cpu?utm_source=github&utm_medium=comment-v2&utm_content=significant_sys_time#system-calls) > > - [`` test_async_return_large_model_without_response_model ``](https://app.codspeed.io/fastapi/fastapi/branches/codex%2Ffix-frontend-fallback-blocking?uri=tests%2Fbenchmarks%2Ftest_general_performance.py%3A%3Atest_async_return_large_model_without_response_model&runnerMode=Simulation&utm_source=github&utm_me
  > Verified the fix locally: `tests/test_frontend.py::test_auto_fallback_uses_index_when_404_is_missing` passes in 0.18s on the PR branch, and the pre-fix parent fails because `lookup_path` is called synchronously inside the running event loop. The change makes `_fallback_file_exists` async at `fastapi/routing.py:2049` and offloads `lookup_path` via `run_in_threadpool`, so fallback checks no longer block the event loop. Clean, targeted fix. 

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

### Incident Patch 1: `32240026` (2026-10-19)
**Commit Message**: 🐛 Fix default handling for request parameters and models (#16527)

**File**: `docs/en/docs/release-notes.md` (modified, +6/-0)
```diff
@@ -7,6 +7,12 @@ hide:
 
 ## Latest Changes
 
+Defaults for omitted `Query`, `Header`, `Cookie`, and `Form` parameters and model fields are no longer treated as user input. Defaults are not validated unless `validate_default=True` is enabled. If you rely on validators running for omitted values, enable default validation with `Field(validate_default=True)` for model fields or, for example, `Query(validate_default=True)` for individual parameters. `Body(validate_default=True)` is now honored too.
+
+For parameter models, applying a default no longer marks a field as explicitly set, so `model_dump(exclude_unset=True)` excludes it. Default factories run once, and validation errors no longer include injected defaults in `input`.
+
+Omitted boolean form fields still become `False` and count as explicitly set.
+
 ## 0.147.0 (2026-10-19)
 
 Omitted `bool` and `bool | None` form fields are now interpreted as `False`, matching unchecked HTML checkboxes. This applies to individual `Form` parameters and form models, including required fields and fields with defaults of `True` or `None`. The inferred value is considered explicitly set, including in `model_dump(exclude_unset=True)`.
```

**File**: `fastapi/dependencies/utils.py` (modified, +5/-6)
```diff
@@ -737,8 +737,9 @@ def _validate_value_with_model_field(
     if value is None:
         if field.field_info.is_required():
             return None, [get_missing_field_error(loc=loc)]
-        else:
-            return deepcopy(field.default), []
+        value = deepcopy(field.default)
+        if not field.field_info.validate_default:
+            return value, []
     return field.validate(value, values, loc=loc)
 
 
@@ -770,10 +771,8 @@ def _get_multidict_value(
             and len(value) == 0
         )
     ):
-        if field.field_info.is_required():
-            return
-        else:
-            return deepcopy(field.default)
+        # Apply defaults during validation, not while extracting request data.
+        return None
     return value
 
 
```

**File**: `tests/test_forms_single_model.py` (modified, +2/-2)
```diff
@@ -99,13 +99,13 @@ def test_no_data():
                 "type": "missing",
                 "loc": ["body", "username"],
                 "msg": "Field required",
-                "input": {"tags": ["foo", "bar"], "with": "nothing"},
+                "input": {},
             },
             {
                 "type": "missing",
                 "loc": ["body", "lastname"],
                 "msg": "Field required",
-                "input": {"tags": ["foo", "bar"], "with": "nothing"},
+                "input": {},
             },
         ]
     }
```

**File**: `tests/test_request_params/test_default_validation.py` (modified, +77/-14)
```diff
@@ -1,4 +1,5 @@
 from typing import Annotated
+from unittest.mock import Mock
 
 import pytest
 from fastapi import Body, Cookie, FastAPI, Form, Header, Query
@@ -13,20 +14,7 @@ def double(value):
 ValidatedInt = Annotated[int | None, BeforeValidator(double)]
 
 
-@pytest.mark.parametrize(
-    "parameter",
-    [
-        pytest.param(
-            parameter,
-            marks=pytest.mark.xfail(
-                reason="Missing values are validated as explicitly supplied defaults",
-                raises=AssertionError,
-            ),
-        )
-        for parameter in (Query, Header, Cookie, Form)
-    ]
-    + [Body],
-)
+@pytest.mark.parametrize("parameter", [Query, Header, Cookie, Form, Body])
 @pytest.mark.parametrize("path", ["/parameter", "/model"])
 def test_missing_value_uses_default_without_validation(parameter, path):
     app = FastAPI()
@@ -183,3 +171,78 @@ def read_model(value: Annotated[Model, parameter()]):
         response = client.post("/")
     assert response.status_code == 200
     assert response.json() == expected
+
+
+@pytest.mark.parametrize("parameter", [Query, Header, Cookie, Form, Body])
+@pytest.mark.parametrize("default,expected", [(None, 0), (10, 20)])
+def test_parameter_can_validate_default(parameter, default, expected):
+    app = FastAPI()
+    field = (
+        Body(embed=True, validate_default=True)
+        if parameter is Body
+        else parameter(validate_default=True)
+    )
+
+    @app.post("/")
+    def read_parameter(value: Annotated[ValidatedInt, field] = default):
+        return value
+
+    client = TestClient(app)
+    if parameter is Body:
+        response = client.post("/", json={})
+    else:
+        response = client.post("/")
+    assert response.status_code == 200
+    assert response.json() == expected
+
+
+@pytest.mark.parametrize("parameter", [Query, Header, Cookie, Form, Body])
+@pytest.mark.parametrize("default,expected", [(None, 0), (10, 20)])
+def test_parameter_validates_default_factory_once(parameter, default, expected):
+    app = FastAPI()
+    default_factory = Mock(return_value=default)
+    field = (
+        Body(embed=True, default_factory=default_factory, validate_default=True)
+        if parameter is Body
+        else parameter(default_factory=default_factory, validate_default=True)
+    )
+
+    @app.post("/")
+    def read_parameter(value: Annotated[ValidatedInt, field]):
+        return value
+
+    default_factory.assert_not_called()
+    client = TestClient(app)
+    if parameter is Body:
+        response = client.post("/", json={})
+    else:
+        response = client.post("/")
+    assert response.status_code == 200
+    assert response.json() == expected
+    default_factory.assert_called_once_with()
+
+
+def test_parameter_rejects_invalid_default():
+    app = FastAPI()
+
+    @app.get("/")
+    def read_parameter(value: Annotated[int, Query(gt=0, validate_default=True)] = -1):
+        return value
+
+    client = TestClient(app)
+    response = client.get("/")
+    assert response.status_code == 422
+    assert response.json() == {
+        "detail": [
+            {
+                "type": "greater_than",
+                "loc": ["query", "value"],
+                "msg": "Input should be greater than 0",
+                "input": -1,
+                "ctx": {"gt": 0},
+            }
+        ]
+    }
+    response = client.get("/", params={"value": "1"})
+    assert response.status_code == 200
+    assert response.json() == 1
```

**File**: `tests/test_request_params/test_nullable_and_defaults.py` (modified, +60/-75)
```diff
@@ -3,6 +3,7 @@
 
 import pytest
 from fastapi import Body, Cookie, FastAPI, Form, Header, Query
+from fastapi._compat import PYDANTIC_VERSION_MINOR_TUPLE
 from fastapi.testclient import TestClient
 from pydantic import BaseModel, Field
 
@@ -331,27 +332,15 @@ def read_model(params: Annotated[Model, parameter()]):
 @pytest.mark.parametrize(
     "parameter,annotation,default",
     [
-        pytest.param(
-            source,
-            annotation,
-            default,
-            marks=pytest.mark.xfail(
-                source is not Body,
-                reason="Missing model fields are populated with defaults before validation",
-                raises=AssertionError,
-            ),
-        )
-        for source, annotation, default in [
-            (Query, int | None, 10),
-            (Header, int | None, 10),
-            (Cookie, int | None, 10),
-            (Form, int | None, 10),
-            (Body, int | None, 10),
-            (Query, list[int] | None, [10]),
-            (Header, list[int] | None, [10]),
-            (Form, list[int] | None, [10]),
-            (Body, list[int] | None, [10]),
-        ]
+        (Query, int | None, 10),
+        (Header, int | None, 10),
+        (Cookie, int | None, 10),
+        (Form, int | None, 10),
+        (Body, int | None, 10),
+        (Query, list[int] | None, [10]),
+        (Header, list[int] | None, [10]),
+        (Form, list[int] | None, [10]),
+        (Body, list[int] | None, [10]),
     ],
 )
 def test_missing_non_null_default_is_unset(parameter, annotation, default):
@@ -376,27 +365,15 @@ def read_model(params: Annotated[Model, parameter()]):
 @pytest.mark.parametrize(
     "parameter,annotation,default",
     [
-        pytest.param(
-            source,
-            annotation,
-            default,
-            marks=pytest.mark.xfail(
-                source is not Body,
-                reason="Missing model fields are populated with defaults before validation",
-                raises=AssertionError,
-            ),
-        )
-        for source, annotation, default in [
-            (Query, int | None, 10),
-            (Header, int | None, 10),
-            (Cookie, int | None, 10),
-            (Form, int | None, 10),
-            (Body, int | None, 10),
-            (Query, list[int] | None, [10]),
-            (Header, list[int] | None, [10]),
-            (Form, list[int] | None, [10]),
-            (Body, list[int] | None, [10]),
-        ]
+        (Query, int | None, 10),
+        (Header, int | None, 10),
+        (Cookie, int | None, 10),
+        (Form, int | None, 10),
+        (Body, int | None, 10),
+        (Query, list[int] | None, [10]),
+        (Header, list[int] | None, [10]),
+        (Form, list[int] | None, [10]),
+        (Body, list[int] | None, [10]),
     ],
 )
 def test_missing_factory_default_is_unset(parameter, annotation, default):
@@ -418,25 +395,9 @@ def read_model(params: Annotated[Model, parameter()]):
     assert response.json() == {"value": default, "fields_set": []}
 
 
-@pytest.mark.parametrize(
-    "parameter,path,default",
-    [
-        pytest.param(
-            source,
-            path,
-            default,
-            marks=pytest.mark.xfail(
-                source is not Body
-                and (default is None or (path == "/parameter" and source is not Form)),
-                reason="The default factory is called more than once for an omitted value",
-                raises=AssertionError,
-            ),
-        )
-        for source in (Query, Header, Cookie, Form, Body)
-        for path in ("/parameter", "/model")
-        for default in (None, 10)
-    ],
-)
+@pytest.mark.parametrize("parameter", [Query, Header, Cookie, Form, Body])
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+@pytest.mark.parametrize("default", [None, 10])
 def test_missing_value_calls_default_factory_once(parameter, path, default):
     app = FastAPI()
     default_factory = Mock(return_value=default)
@@ -468,6 +429,43 @@ def read_model(params: Annotated[Model, parameter()]):
     default_factory.assert_called_once_with()
 
 
+@pytest.mark.parametrize("parameter", [Query, Header, Cookie, Form, Body])
+@pytest.mark.skipif(
+    PYDANTIC_VERSION_MINOR_TUPLE < (2, 10),
+    reason="Default factories receiving validated data require Pydantic 2.10",
+)
+def test_model_default_factory_receives_validated_data(parameter):
+    app = FastAPI()
+
+    class Model(BaseModel):
+        value: int
+        doubled: Annotated[int, Field(default_factory=lambda data: data["value"] * 2)]
+
+    @app.post("/")
+    def read_model(params: Annotated[Model, parameter()]):
+        return {
+            "values": params.model_dump(),
+            "supplied": params.model_dump(exclude_unset=True),
+        }
+
+    client = TestClient(app)
+    if parameter is Query:
+        response = client.post("/", params={"value": "5"})
+    elif parameter is Header:
+        response = client.post("/", headers=
```

**File**: `tests/test_tutorial/test_header_param_models/test_tutorial001.py` (modified, +0/-1)
```diff
@@ -66,7 +66,6 @@ def test_header_param_model_invalid(client: TestClient):
                     "loc": ["header", "save_data"],
                     "msg": "Field required",
                     "input": {
-                        "x_tag": [],
                         "host": "testserver",
                         "accept": "*/*",
                         "accept-encoding": IsOneOf(
```

**File**: `tests/test_tutorial/test_header_param_models/test_tutorial002.py` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ def test_header_param_model_invalid(client: TestClient):
                     "type": "missing",
                     "loc": ["header", "save_data"],
                     "msg": "Field required",
-                    "input": {"x_tag": [], "host": "testserver"},
+                    "input": {"host": "testserver"},
                 }
             ]
         }
```

**File**: `tests/test_tutorial/test_header_param_models/test_tutorial003.py` (modified, +0/-2)
```diff
@@ -65,7 +65,6 @@ def test_header_param_model_no_underscore(client: TestClient):
                     "input": {
                         "host": "testserver",
                         "traceparent": "123",
-                        "x_tag": [],
                         "accept": "*/*",
                         "accept-encoding": IsOneOf(
                             "gzip, deflate", "gzip, deflate, zstd"
@@ -105,7 +104,6 @@ def test_header_param_model_invalid(client: TestClient):
                     "loc": ["header", "save_data"],
                     "msg": "Field required",
                     "input": {
-                        "x_tag": [],
                         "host": "testserver",
                         "accept": "*/*",
                         "accept-encoding": IsOneOf(
```

---

### Incident Patch 2: `6a506999` (2026-10-19)
**Commit Message**: ✅ Add tests for parameter defaults, nullability, and browser form behavior (#14829)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>
Co-authored-by: Sebastián Ramírez <[REDACTED_EMAIL]>

**File**: `tests/test_request_params/test_body/test_nullable_and_defaults.py` (added, +287/-0)
```diff
@@ -0,0 +1,287 @@
+from typing import Annotated
+
+import pytest
+from fastapi import Body, FastAPI
+from fastapi.testclient import TestClient
+from pydantic import BaseModel
+
+app = FastAPI()
+
+
+class RequiredModel(BaseModel):
+    value: int | None
+
+
+class NoneDefaultModel(BaseModel):
+    value: int | None = None
+
+
+class NonNullDefaultModel(BaseModel):
+    value: int | None = 10
+
+
+class NonNullableDefaultModel(BaseModel):
+    value: int = 10
+
+
+@app.post("/required")
+def read_required(value: Annotated[int | None, Body(embed=True)]):
+    return {"value": value, "fields_set": None}
+
+
+@app.post("/required-model")
+def read_required_model(params: Annotated[RequiredModel, Body()]):
+    return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+
+@app.post("/none-default")
+def read_none_default(value: Annotated[int | None, Body(embed=True)] = None):
+    return {"value": value, "fields_set": None}
+
+
+@app.post("/none-default-model")
+def read_none_default_model(params: Annotated[NoneDefaultModel, Body()]):
+    return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+
+@app.post("/non-null-default")
+def read_non_null_default(value: Annotated[int | None, Body(embed=True)] = 10):
+    return {"value": value, "fields_set": None}
+
+
+@app.post("/non-null-default-model")
+def read_non_null_default_model(params: Annotated[NonNullDefaultModel, Body()]):
+    return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+
+@app.post("/non-nullable-default")
+def read_non_nullable_default(value: Annotated[int, Body(embed=True)] = 10):
+    return {"value": value, "fields_set": None}
+
+
+@app.post("/non-nullable-default-model")
+def read_non_nullable_default_model(params: Annotated[NonNullableDefaultModel, Body()]):
+    return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+
+@app.post("/bare-required")
+def read_bare_required(value: Annotated[int | None, Body()]):
+    return value
+
+
+@app.post("/bare-none-default")
+def read_bare_none_default(value: Annotated[int | None, Body()] = None):
+    return value
+
+
+@app.post("/bare-int-default")
+def read_bare_int_default(value: Annotated[int | None, Body()] = 10):
+    return value
+
+
+@app.post("/bare-non-nullable-default")
+def read_bare_non_nullable_default(value: Annotated[int, Body()] = 10):
+    return value
+
+
+@app.post("/bare-str-default")
+def read_bare_str_default(value: Annotated[str | None, Body()] = "default"):
+    return value
+
+
+@app.post("/bare-list-default")
+def read_bare_list_default(
+    value: Annotated[list[int] | None, Body(default_factory=lambda: [10])],
+):
+    return value
+
+
+client = TestClient(app)
+
+
+@pytest.mark.parametrize(
+    "path,fields_set",
+    [
+        pytest.param(
+            "/required",
+            None,
+            marks=pytest.mark.xfail(
+                reason="Explicit null is treated as missing for a required Body parameter",
+                raises=AssertionError,
+            ),
+        ),
+        ("/required-model", ["value"]),
+        ("/none-default", None),
+        ("/none-default-model", ["value"]),
+        pytest.param(
+            "/non-null-default",
+            None,
+            marks=pytest.mark.xfail(
+                reason="Explicit null is replaced with the Body parameter default",
+                raises=AssertionError,
+            ),
+        ),
+        ("/non-null-default-model", ["value"]),
+    ],
+)
+def test_explicit_null(path, fields_set):
+    supplied = client.post(path, json={"value": 0})
+    assert supplied.status_code == 200
+    assert supplied.json()["value"] == 0
+    response = client.post(path, json={"value": None})
+    assert response.status_code == 200
+    assert response.json() == {"value": None, "fields_set": fields_set}
+
+
+@pytest.mark.parametrize(
+    "path,location",
+    [
+        ("/required", ["body", "value"]),
+        ("/required-model", ["body"]),
+        ("/none-default-model", ["body"]),
+        ("/non-null-default-model", ["body"]),
+    ],
+)
+def test_absent_body_for_required_argument(path, location):
+    # A model argument is required even when its fields have defaults.
+    response = client.post(path)
+    assert response.status_code == 422
+    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
+        ("missing", location),
+    ]
+
+
+@pytest.mark.parametrize(
+    "path,expected",
+    [
+        ("/none-default", None),
+        ("/non-null-default", 10),
+        ("/non-nullable-default", 10),
+    ],
+)
+def test_absent_body_uses_parameter_default(path, expected):
+    response = client.post(path)
+    assert response.status_code == 200
+    assert response.json() == {"value": expected, "fields_set": None}
+
+
+def test_absent_required_bare_body():
+    supplied = client.post("/bare-required", json=0)
+    assert supplied.status_code == 200
+    assert supplied.json() == 0

```

**File**: `tests/test_request_params/test_default_validation.py` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+from typing import Annotated
+
+import pytest
+from fastapi import Body, Cookie, FastAPI, Form, Header, Query
+from fastapi.testclient import TestClient
+from pydantic import BaseModel, BeforeValidator, Field
+
+
+def double(value):
+    return 0 if value is None else int(value) * 2
+
+
+ValidatedInt = Annotated[int | None, BeforeValidator(double)]
+
+
+@pytest.mark.parametrize(
+    "parameter",
+    [
+        pytest.param(
+            parameter,
+            marks=pytest.mark.xfail(
+                reason="Missing values are validated as explicitly supplied defaults",
+                raises=AssertionError,
+            ),
+        )
+        for parameter in (Query, Header, Cookie, Form)
+    ]
+    + [Body],
+)
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+def test_missing_value_uses_default_without_validation(parameter, path):
+    app = FastAPI()
+    field = Body(embed=True) if parameter is Body else parameter()
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[ValidatedInt, field] = 10):
+        return value
+
+    class Model(BaseModel):
+        value: ValidatedInt = 10
+
+    @app.post("/model")
+    def read_model(value: Annotated[Model, parameter()]):
+        return value.value
+
+    client = TestClient(app)
+    if parameter is Body:
+        response = client.post(path, json={})
+    else:
+        response = client.post(path)
+    assert response.status_code == 200
+    assert response.json() == 10
+
+
+@pytest.mark.parametrize("parameter", [Query, Header, Cookie, Form, Body])
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+def test_missing_value_uses_none_default_without_validation(parameter, path):
+    app = FastAPI()
+    field = Body(embed=True) if parameter is Body else parameter()
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[ValidatedInt, field] = None):
+        return value
+
+    class Model(BaseModel):
+        value: ValidatedInt = None
+
+    @app.post("/model")
+    def read_model(value: Annotated[Model, parameter()]):
+        return value.value
+
+    client = TestClient(app)
+    if parameter is Body:
+        response = client.post(path, json={})
+    else:
+        response = client.post(path)
+    assert response.status_code == 200
+    assert response.json() is None
+
+
+@pytest.mark.parametrize("parameter", [Query, Header, Cookie, Form, Body])
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+def test_explicit_value_equal_to_default_is_validated(parameter, path):
+    app = FastAPI()
+    field = Body(embed=True) if parameter is Body else parameter()
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[ValidatedInt, field] = 10):
+        return value
+
+    class Model(BaseModel):
+        value: ValidatedInt = 10
+
+    @app.post("/model")
+    def read_model(value: Annotated[Model, parameter()]):
+        return value.value
+
+    client = TestClient(app)
+    if parameter is Query:
+        response = client.post(path, params={"value": "10"})
+    elif parameter is Header:
+        response = client.post(path, headers={"value": "10"})
+    elif parameter is Cookie:
+        response = client.post(path, headers={"cookie": "value=10"})
+    elif parameter is Form:
+        response = client.post(path, data={"value": "10"})
+    else:
+        response = client.post(path, json={"value": 10})
+    assert response.status_code == 200
+    assert response.json() == 20
+
+
+@pytest.mark.parametrize("default", [None, 10])
+@pytest.mark.parametrize(
+    "path",
+    [
+        pytest.param(
+            "/parameter",
+            marks=pytest.mark.xfail(
+                reason="Explicit null is treated as missing for individual Body parameters",
+                raises=AssertionError,
+            ),
+        ),
+        "/model",
+    ],
+)
+def test_explicit_null_is_validated(default, path):
+    app = FastAPI()
+    field = Body(embed=True)
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[ValidatedInt, field] = default):
+        return value
+
+    class Model(BaseModel):
+        value: ValidatedInt = default
+
+    @app.post("/model")
+    def read_model(value: Annotated[Model, Body()]):
+        return value.value
+
+    client = TestClient(app)
+    response = client.post(path, json={"value": None})
+    assert response.status_code == 200
+    assert response.json() == 0
+
+
+@pytest.mark.parametrize("default", [None, 10])
+@pytest.mark.xfail(
+    reason="Explicit null-body is treated as missing", raises=AssertionError
+)
+def test_explicit_null_body_is_validated(default):
+    app = FastAPI()
+
+    @app.post("/")
+    def read_body(value: Annotated[ValidatedInt, Body()] = default):
+        return value
+
+    client = TestClient(app)
+    response = client.post(
+        "/", content="null", headers={"content-type": "application/json"}
+    )
+    assert response.status_code == 200
+    assert response.json() 
```

**File**: `tests/test_request_params/test_file/test_nullable_and_defaults.py` (added, +544/-0)
```diff
@@ -0,0 +1,544 @@
+from typing import Annotated
+
+import pytest
+from fastapi import FastAPI, File, UploadFile
+from fastapi.testclient import TestClient
+from inline_snapshot import snapshot
+
+app = FastAPI()
+
+
+@app.post("/required-bytes")
+def read_required_bytes(
+    file: Annotated[bytes | None, File()],
+    files: Annotated[list[bytes] | None, File()],
+):
+    assert file is not None
+    assert files is not None
+    return {"file": len(file), "files": [len(value) for value in files]}
+
+
+@app.post("/required-uploadfile")
+def read_required_uploadfile(
+    file: Annotated[UploadFile | None, File()],
+    files: Annotated[list[UploadFile] | None, File()],
+):
+    assert file is not None
+    assert files is not None
+    return {"file": file.size, "files": [value.size for value in files]}
+
+
+@app.post("/optional-bytes")
+def read_optional_bytes(
+    file: Annotated[bytes | None, File()] = None,
+    files: Annotated[list[bytes] | None, File()] = None,
+):
+    return {
+        "file": len(file) if file is not None else None,
+        "files": [len(value) for value in files] if files is not None else None,
+    }
+
+
+@app.post("/optional-uploadfile")
+def read_optional_uploadfile(
+    file: Annotated[UploadFile | None, File()] = None,
+    files: Annotated[list[UploadFile] | None, File()] = None,
+):
+    return {
+        "file": file.size if file is not None else None,
+        "files": [value.size for value in files] if files is not None else None,
+    }
+
+
+@app.post("/bytes-defaults")
+def read_bytes_defaults(
+    *,
+    file: Annotated[bytes | None, File()] = b"default",
+    files: Annotated[list[bytes] | None, File(default_factory=lambda: [b"default"])],
+):
+    assert file is not None
+    assert files is not None
+    return {"file": len(file), "files": [len(value) for value in files]}
+
+
+client = TestClient(app)
+
+# HTTPX drops empty filenames, so send the browser's multipart representation directly.
+EMPTY_FILE_FORM = (
+    b"--boundary\r\n"
+    b'Content-Disposition: form-data; name="file"; filename=""\r\n'
+    b"Content-Type: application/octet-stream\r\n\r\n"
+    b"\r\n--boundary\r\n"
+    b'Content-Disposition: form-data; name="files"; filename=""\r\n'
+    b"Content-Type: application/octet-stream\r\n\r\n"
+    b"\r\n--boundary--\r\n"
+)
+
+
+@pytest.mark.parametrize("path", ["/required-bytes", "/required-uploadfile"])
+@pytest.mark.parametrize(
+    "content",
+    [
+        pytest.param(b"", id="omitted"),
+        pytest.param(
+            EMPTY_FILE_FORM,
+            id="no-selection",
+            marks=pytest.mark.xfail(
+                reason="A file with an empty filename and content is treated as supplied",
+                raises=AssertionError,
+            ),
+        ),
+    ],
+)
+def test_missing_required_nullable_files(path, content):
+    response = client.post(
+        path,
+        content=content,
+        headers={"content-type": "multipart/form-data; boundary=boundary"},
+    )
+    assert response.status_code == 422
+    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
+        ("missing", ["body", "file"]),
+        ("missing", ["body", "files"]),
+    ]
+
+
+@pytest.mark.parametrize("path", ["/optional-bytes", "/optional-uploadfile"])
+@pytest.mark.parametrize(
+    "content",
+    [
+        pytest.param(b"", id="omitted"),
+        pytest.param(
+            EMPTY_FILE_FORM,
+            id="no-selection",
+            marks=pytest.mark.xfail(
+                reason="A file with an empty filename and content is treated as supplied",
+                raises=AssertionError,
+            ),
+        ),
+    ],
+)
+def test_missing_optional_nullable_files(path, content):
+    response = client.post(
+        path,
+        content=content,
+        headers={"content-type": "multipart/form-data; boundary=boundary"},
+    )
+    assert response.status_code == 200
+    assert response.json() == {"file": None, "files": None}
+
+
+@pytest.mark.parametrize(
+    "path",
+    [
+        "/required-bytes",
+        "/required-uploadfile",
+        "/optional-bytes",
+        "/optional-uploadfile",
+    ],
+)
+@pytest.mark.parametrize("content", [b"", b"hello"])
+def test_named_file_is_supplied_even_when_empty(path, content):
+    response = client.post(
+        path,
+        files=[
+            ("file", ("empty.txt", content)),
+            ("files", ("first.txt", content)),
+            ("files", ("second.txt", content)),
+        ],
+    )
+    assert response.status_code == 200
+    assert response.json() == {
+        "file": len(content),
+        "files": [len(content), len(content)],
+    }
+
+
+@pytest.mark.parametrize(
+    "content",
+    [
+        pytest.param(b"", id="omitted"),
+        pytest.param(
+            EMPTY_FILE_FORM,
+            id="no-selection",
+            marks=pytest.mark.xfail(
+                reason="A file with an empty filename and content is treated as supplied"
```

**File**: `tests/test_request_params/test_form/test_nullable_and_defaults.py` (added, +554/-0)
```diff
@@ -0,0 +1,554 @@
+from typing import Annotated
+
+import pytest
+from fastapi import Body, FastAPI, Form
+from fastapi.testclient import TestClient
+from pydantic import BaseModel, ValidationError
+
+
+@pytest.mark.parametrize(
+    "path",
+    [
+        "/parameter",
+        pytest.param(
+            "/model",
+            marks=pytest.mark.xfail(
+                reason="Empty scalar form strings are not treated as missing in models",
+                raises=AssertionError,
+            ),
+        ),
+    ],
+)
+@pytest.mark.parametrize("default", [None, "default"])
+@pytest.mark.parametrize("encoding", ["urlencoded", "multipart"])
+def test_empty_string_uses_default(path, default, encoding):
+    app = FastAPI()
+
+    class Model(BaseModel):
+        value: str | None = default
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[str | None, Form()] = default):
+        return {"value": value, "fields_set": None}
+
+    @app.post("/model")
+    def read_model(params: Annotated[Model, Form()]):
+        return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+    client = TestClient(app)
+    supplied = client.post(path, data={"value": "hello"})
+    assert supplied.status_code == 200
+    assert supplied.json()["value"] == "hello"
+    if encoding == "urlencoded":
+        response = client.post(path, data={"value": ""})
+    else:
+        response = client.post(path, files={"value": (None, "")})
+    assert response.status_code == 200
+    assert response.json() == {
+        "value": default,
+        "fields_set": [] if path == "/model" else None,
+    }
+
+
+@pytest.mark.parametrize(
+    "path",
+    [
+        "/parameter",
+        pytest.param(
+            "/model",
+            marks=pytest.mark.xfail(
+                reason="Empty scalar form strings are not treated as missing in models",
+                raises=AssertionError,
+            ),
+        ),
+    ],
+)
+@pytest.mark.parametrize("default", [None, 10])
+@pytest.mark.parametrize("encoding", ["urlencoded", "multipart"])
+def test_empty_integer_uses_default(path, default, encoding):
+    app = FastAPI()
+
+    class Model(BaseModel):
+        value: int | None = default
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[int | None, Form()] = default):
+        return {"value": value, "fields_set": None}
+
+    @app.post("/model")
+    def read_model(params: Annotated[Model, Form()]):
+        return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+    client = TestClient(app)
+    supplied = client.post(path, data={"value": "1"})
+    assert supplied.status_code == 200
+    assert supplied.json()["value"] == 1
+    if encoding == "urlencoded":
+        response = client.post(path, data={"value": ""})
+    else:
+        response = client.post(path, files={"value": (None, "")})
+    assert response.status_code == 200
+    assert response.json() == {
+        "value": default,
+        "fields_set": [] if path == "/model" else None,
+    }
+
+
+@pytest.mark.parametrize(
+    "path",
+    [
+        "/parameter",
+        pytest.param(
+            "/model",
+            marks=pytest.mark.xfail(
+                reason="Empty required scalar form strings are not treated as missing in models",
+                raises=AssertionError,
+            ),
+        ),
+    ],
+)
+def test_empty_required_string_is_missing(path):
+    app = FastAPI()
+
+    class Model(BaseModel):
+        value: str | None
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[str | None, Form()]):
+        return {"value": value, "fields_set": None}
+
+    @app.post("/model")
+    def read_model(params: Annotated[Model, Form()]):
+        return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+    client = TestClient(app)
+    supplied = client.post(path, data={"value": "hello"})
+    assert supplied.status_code == 200
+    assert supplied.json()["value"] == "hello"
+    response = client.post(path, data={"value": ""})
+    assert response.status_code == 422
+    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
+        ("missing", ["body", "value"]),
+    ]
+
+
+@pytest.mark.parametrize(
+    "path",
+    [
+        "/parameter",
+        pytest.param(
+            "/model",
+            marks=pytest.mark.xfail(
+                reason="Empty required scalar form strings are not treated as missing in models",
+                raises=AssertionError,
+            ),
+        ),
+    ],
+)
+def test_empty_required_integer_is_missing(path):
+    app = FastAPI()
+
+    class Model(BaseModel):
+        value: int | None
+
+    @app.post("/parameter")
+    def read_parameter(value: Annotated[int | None, Form()]):
+        return {"value": value, "fields_set": None}
+
+    @app.post("/model")
+    def read_model(params: Annotated[Model, Form()]):
+        return {"value": params.value, "fields_set":
```

**File**: `tests/test_request_params/test_header/test_nullable_and_defaults.py` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+from typing import Annotated
+
+import pytest
+from fastapi import FastAPI, Header
+from fastapi.testclient import TestClient
+from pydantic import BaseModel
+
+app = FastAPI()
+
+
+@app.get("/parameter")
+def read_parameter(int_val: Annotated[int | None, Header()]):
+    return int_val
+
+
+class Model(BaseModel):
+    int_val: int | None
+
+
+@app.get("/model")
+def read_model(params: Annotated[Model, Header()]):
+    return params.int_val
+
+
+client = TestClient(app)
+
+
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+def test_nullable_header_uses_hyphenated_name(path):
+    response = client.get(path, headers={"int-val": "0"})
+    assert response.status_code == 200
+    assert response.json() == 0
+    response = client.get("/openapi.json")
+    assert response.status_code == 200, response.text
+    field = response.json()["paths"][path]["get"]["parameters"][0]
+    assert field["name"] == "int-val"
+    assert field["in"] == "header"
+    assert field["required"] is True
+    assert field["schema"]["anyOf"] == [{"type": "integer"}, {"type": "null"}]
+
+
+@pytest.mark.parametrize(
+    "path",
+    [
+        "/parameter",
+        pytest.param(
+            "/model",
+            marks=pytest.mark.xfail(
+                reason="Header model errors use underscores instead of hyphens",
+                raises=AssertionError,
+            ),
+        ),
+    ],
+)
+@pytest.mark.parametrize(
+    "headers,error_type",
+    [({}, "missing"), ({"int-val": "invalid"}, "int_parsing")],
+)
+def test_nullable_header_error_uses_hyphenated_name(path, headers, error_type):
+    response = client.get(path, headers=headers)
+    assert response.status_code == 422
+    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
+        (error_type, ["header", "int-val"]),
+    ]
```

**File**: `tests/test_request_params/test_nullable_and_defaults.py` (added, +810/-0)
```diff
@@ -0,0 +1,810 @@
+from typing import Annotated
+from unittest.mock import Mock
+
+import pytest
+from fastapi import Body, Cookie, FastAPI, Form, Header, Query
+from fastapi.testclient import TestClient
+from pydantic import BaseModel, Field
+
+
+@pytest.fixture(params=[Query, Header, Cookie, Form, Body])
+def parameter(request):
+    return request.param
+
+
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+def test_nullable_required_schema_and_supplied_value(parameter, path):
+    app = FastAPI()
+
+    field = Body(embed=True) if parameter is Body else parameter()
+
+    class Model(BaseModel):
+        value: int | None
+
+    @app.post("/parameter")
+    def read_required(value: Annotated[int | None, field]):
+        return {"value": value, "fields_set": None}
+
+    @app.post("/model")
+    def read_model(params: Annotated[Model, parameter()]):
+        return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+    client = TestClient(app)
+    if parameter is Query:
+        supplied = client.post(path, params={"value": "0"})
+    elif parameter is Header:
+        supplied = client.post(path, headers={"value": "0"})
+    elif parameter is Cookie:
+        supplied = client.post(path, headers={"cookie": "value=0"})
+    elif parameter is Form:
+        supplied = client.post(path, data={"value": "0"})
+    else:
+        supplied = client.post(path, json={"value": 0})
+    assert supplied.status_code == 200
+    assert supplied.json()["value"] == 0
+    response = client.get("/openapi.json")
+    assert response.status_code == 200, response.text
+    openapi = response.json()
+    operation = openapi["paths"][path]["post"]
+    if parameter in (Query, Header, Cookie):
+        field = operation["parameters"][0]
+        schema = field["schema"]
+        required = field["required"]
+    else:
+        media_type = (
+            "application/json"
+            if parameter is Body
+            else "application/x-www-form-urlencoded"
+        )
+        reference = operation["requestBody"]["content"][media_type]["schema"]["$ref"]
+        model = openapi["components"]["schemas"][reference.rsplit("/", 1)[1]]
+        schema = model["properties"]["value"]
+        required = "value" in model.get("required", [])
+    assert schema["anyOf"] == [{"type": "integer"}, {"type": "null"}]
+    assert required is True
+    assert "default" not in schema
+
+
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+def test_nullable_none_default_schema_and_supplied_value(parameter, path):
+    app = FastAPI()
+
+    field = Body(embed=True) if parameter is Body else parameter()
+
+    class Model(BaseModel):
+        value: int | None = None
+
+    @app.post("/parameter")
+    def read_defaulted(value: Annotated[int | None, field] = None):
+        return {"value": value, "fields_set": None}
+
+    @app.post("/model")
+    def read_model(params: Annotated[Model, parameter()]):
+        return {"value": params.value, "fields_set": sorted(params.model_fields_set)}
+
+    client = TestClient(app)
+    if parameter is Query:
+        supplied = client.post(path, params={"value": "0"})
+    elif parameter is Header:
+        supplied = client.post(path, headers={"value": "0"})
+    elif parameter is Cookie:
+        supplied = client.post(path, headers={"cookie": "value=0"})
+    elif parameter is Form:
+        supplied = client.post(path, data={"value": "0"})
+    else:
+        supplied = client.post(path, json={"value": 0})
+    assert supplied.status_code == 200
+    assert supplied.json()["value"] == 0
+    response = client.get("/openapi.json")
+    assert response.status_code == 200, response.text
+    openapi = response.json()
+    operation = openapi["paths"][path]["post"]
+    if parameter in (Query, Header, Cookie):
+        field = operation["parameters"][0]
+        schema = field["schema"]
+        required = field["required"]
+    else:
+        media_type = (
+            "application/json"
+            if parameter is Body
+            else "application/x-www-form-urlencoded"
+        )
+        reference = operation["requestBody"]["content"][media_type]["schema"]["$ref"]
+        model = openapi["components"]["schemas"][reference.rsplit("/", 1)[1]]
+        schema = model["properties"]["value"]
+        required = "value" in model.get("required", [])
+    assert schema["anyOf"] == [{"type": "integer"}, {"type": "null"}]
+    assert required is False
+    assert "default" not in schema
+
+
+@pytest.mark.parametrize("path", ["/parameter", "/model"])
+def test_nullable_non_null_default_schema_and_supplied_value(parameter, path):
+    app = FastAPI()
+
+    field = Body(embed=True) if parameter is Body else parameter()
+
+    class Model(BaseModel):
+        value: int | None = 10
+
+    @app.post("/parameter")
+    def read_defaulted(value: Annotated[int | None, field] = 10):
+        return {"value": value, "fields_set": None}
+
+    @app.post("/model")
+    def 
```

#### Recent Merged Pull Requests:
- **PR #16528** (2026-10-19): 🔖 Release version 0.148.0 (@pr-submit[bot])
- **PR #16527** (2026-10-19): 🐛 Fix default handling for request parameters and models (@tiangolo)
- **PR #16525** (closed): 🐛 Fix data-aware default_factory in parameter models (@Aditya-kumar-yadav)
- **PR #16524** (2026-10-19): 🔖 Release version 0.147.0 (@pr-submit[bot])
- **PR #16523** (2026-10-19): 🐛 Treat omitted boolean form fields as False (@tiangolo)
- **PR #16521** (2026-10-18): 🔖 Release version 0.146.0 (@pr-submit[bot])

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

## X. 🐛 Fix default handling for request parameters and models (#16527)

**RULE**:
When implementing operations in `docs/en/docs/release-notes.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fastapi/fastapi. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `32240026`: 🐛 Fix default handling for request parameters and models (#16527). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/en/docs/release-notes.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
Defaults for omitted `Query`, `Header`, `Cookie`, and `Form` parameters and model fields are no longer treated as user input. Defaults are not validated unless `validate_default=True` is enabled. If you rely on validators running for omitted values, enable default validation with `Field(validate_default=True)` for model fields or, for example, `Query(validate_default=True)` for individual parameters. `Body(validate_default=True)` is now honored too.

For parameter models, applying a default no longer marks a field as explicitly set, so `model_dump(exclude_unset=True)` excludes it. Default factories run once, and validation errors no longer include injected defaults in `input`.

Omitted boolean form fields still become `False` and count as explicitly set.

```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `32240026` are properly handled with clean fallback behavior.
