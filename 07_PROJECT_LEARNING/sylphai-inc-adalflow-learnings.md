# Forensic Learning Record (Deep Inspection): SylphAI-Inc/AdalFlow

> **Canonical Artifact**: `07_PROJECT_LEARNING/sylphai-inc-adalflow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SylphAI-Inc/AdalFlow](https://github.com/SylphAI-Inc/AdalFlow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:11:03.197Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SylphAI-Inc/AdalFlow`
- **Description**: AdalFlow: The library to build & auto-optimize LLM applications.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4223 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `adalflow/adalflow/components/model_client/utils.py`
```
"Helpers for model client for integrating models and parsing the output."

from typing import Union, List, Dict, Any, Optional
import os
from adalflow.core.types import EmbedderOutput, Embedding, Usage
from adalflow.core.functional import encode_image


def parse_embedding_response(
    api_response,
) -> EmbedderOutput:
    r"""Parse embedding model output from the API response to EmbedderOutput.

    Follows the OpenAI API response pattern.
    """
    # Assuming `api_response` has `.embeddings` and `.usage` attributes
    # and that `embeddings` is a list of objects that can be converted to `Embedding` dataclass
    # TODO: check if any embedding is missing
    embeddings = [
        Embedding(embedding=e.embedding, index=e.index) for e in api_response.data
    ]
    usage = Usage(
        prompt_tokens=api_response.usage.prompt_tokens,
        total_tokens=api_response.usage.total_tokens,
    )  # Assuming `usage` is an object with a `count` attribute

    # Assuming the model name is part of the response or set statically here
    model = api_response.model

    return EmbedderOutput(data=embeddings, model=model, usage=usage)


def process_images_for_response_api(
    images: Union[str, Dict, List[Union[str, Dict]]],
    encode_local_images: bool = True
) -> List[Dict[str, Any]]:
    """Process and validate images for OpenAI's responses.create API.
    
    This function handles various image input formats and converts them to the
    expected format for the responses.create API.
    
    Args:
        images: Can be:
            - A single image URL (str)
            - A single local file path (str)
            - A pre-formatted image dict with type='input_image'
            - A list containing any combination of the above
        encode_local_images: Whether to encode local image files to base64
        
    Returns:
        List of formatted image dicts ready for the API, each containing:
        - type: "input_image"
        - image_url: Either a URL or base64-encoded data URI
        
    Raises:
        ValueError: If image dict format is invalid
        FileNotFoundError: If local image file doesn't exist
        
    Examples:
        >>> # Single URL
        >>> process_images_for_response_api("https://example.com/image.jpg")
        [{"type": "input_image", "image_url": "https://example.com/image.jpg"}]
        
        >>> # Local file
        >>> process_images_for_response_api("/path/to/image.jpg")
        [{"type": "input_image", "image_url": "data:image/jpeg;base64,..."}]
        
        >>> # Multiple mixed sources
        >>> process_images_for_response_api([
        ...     "https://example.com/img.jpg",
        ...     "/local/img.png",
        ...     {"type": "input_image", "image_url": "..."}
        ... ])
        [...]
    """
    # Normalize input to list for uniform processing
    if not isinstance(images, list):
        images = [images]
    
    processed_images = []
    
    for img in images:
        if isinstance(img, str):
            if img.startswith(("http://", "https://")):
                # URL image
                processed_images.append({
                    "type": "input_image",
                    "image_url": img
                })
            elif img.startswith("data:"):
                # Data URI (already base64 encoded)
                processed_images.append({
                    "type": "input_image",
                    "image_url": img
                })
            else:
                # Local file path
                if encode_local_images:
                    if not os.path.isfile(img):
                        raise FileNotFoundError(f"Image file not found: {img}")
                    
                    # Encode to base64
                    base64_image = encode_image(img)
                    
                    # Determine MIME type from extension
                    ext = os.path.splitext(img)[1].lower()
                    mime_type = {
                        '.jpg': 'jpeg',
                        '.jpeg': 'jpeg',
                        '.png': 'png',
                        '.gif': 'gif',
                        '.webp': 'webp'
                    }.get(ext, 'jpeg')  # Default to jpeg
                    
                    processed_images.append({
                        "type": "input_image",
                        "image_url": f"data:image/{mime_type};base64,{base64_image}"
                    })
                else:
                    # Just pass the file path (for cases where encoding is handled elsewhere)
                    processed_images.append({
                        "type": "input_image",
                        "image_url": img
                    })
                    
        elif isinstance(img, dict):
            # Validate pre-formatted image dict
            if "type" not in img:
                raise ValueError(
                    f"Image dict must have 'type' field. Got: {img}"
                )
            if img["type"] != "input_image":
                raise ValueError(
                    f"Image dict must have type='input_image'. Got type='{img['type']}'"
                )
            if "image_url" not in img:
                raise ValueError(
                    f"Image dict must have 'image_url' field. Got: {img}"
                )
            
            # Valid format, add as-is
            processed_images.append(img)
            
        else:
            raise TypeError(
                f"Invalid image type: {type(img)}. "
                "Expected str (URL/path) or dict with type='input_image'"
            )
    
    return processed_images


def format_content_for_response_api(
    text: str,
    images: Optional[Union[str, Dict, List[Union[str, Dict]]]] = None
) -> List[Dict[str, Any]]:
    """Format text and optional images into content array for responses.create API.
    
    Args:
        text: The text prompt/question
        images: Optional images in various formats (see process_images_for_response_api)
        
    Returns:
        List of content items formatted for the API
        
    Examples:
        >>> # Text only
        >>> format_content_for_response_api("What is this?")
        [{"type": "input_text", "text": "What is this?"}]
        
        >>> # Text with image
        >>> format_content_for_response_api(
        ...     "What's in this image?",
        ...     "https://example.com/img.jpg"
        ... )
        [
            {"type": "input_text", "text": "What's in this image?"},
            {"type": "input_image", "image_url": "https://example.com/img.jpg"}
        ]
    """
    content = []
    
    # Add text content
    content.append({
        "type": "input_text",
        "text": text
    })
    
    # Add images if provided
    if images:
        image_content = process_images_for_response_api(images)
        content.extend(image_content)
    
    return content


def extract_text_from_response_stream(event) -> Optional[str]:
    """Extract text content from OpenAI Response API streaming events.
    
    The Response API generates various event types during streaming:
    - ResponseCreatedEvent: Initial event when response starts
    - ResponseInProgressEvent: Status updates
    - ResponseOutputItemAddedEvent: When new output items are added
    - ResponseContentPartAddedEvent: When content parts are added
    - ResponseTextDeltaEvent: Contains actual text chunks
    - ResponseTextDoneEvent: When text generation completes
    - ResponseDoneEvent: Final event when response completes
    
    This function extracts text only from ResponseTextDeltaEvent types.
    
    Args:
        event: A streaming event from OpenAI's Response API
        
    Returns:
        str: The text delta if this is a text delta event, None otherwise
        
    Examples:
        >>> # In a streaming response handler
        >>> async for event in stream:
        ...     text = extract_text_from_response_stream(event)
        ...     if text:
        ...         print(text, end="", flush=True)
    """
    # Check if the event has a type attribute indicating it's a text delta
    if hasattr(event, 'type') and event.type == 'response.output_text.delta':
        # ResponseTextDeltaEvent has a 'delta' field with the text chunk
        if hasattr(event, 'delta'):
            return event.delta
    
    return None


def extract_complete_text_from_response_stream(event) -> Optional[str]:
    """Extract complete text from response completion events.
    
    Some events contain the complete text rather than deltas:
    - ResponseTextDoneEvent: Contains the complete text when done
    - Response objects with output_text property
    
    Args:
        event: A streaming event from OpenAI's Response API
        
    Returns:
        str: The complete text if available, None otherwise
    """
    # Check for done events with complete text
    if hasattr(event, 'type') and event.type == 'response.output_text.done':
        if hasattr(event, 'text'):
            return event.text
    
    # Check for Response objects with output_text
    if hasattr(event, 'output_text') and not hasattr(event, 'delta'):
        return event.output_text
    
    return None


def is_response_complete(event) -> bool:
    """Check if a streaming event indicates the response is complete.
    
    Args:
        event: A streaming event from OpenAI's Response API
        
    Returns:
        bool: True if this event indicates completion, False otherwise
    """
    if hasattr(event, 'type'):
        return event.type in [
            'response.done',
            'response.output_text.done',
            'response.complete'
        ]
    
    if hasattr(event, 'status'):
        return event.status == 'completed'
    
    return False

```

### Core Architecture Module: `adalflow/adalflow/core/__init__.py`
```
from .base_data_class import DataClass, required_field, DataClassFormatType

from .component import Component, DataComponent, func_to_data_component
from .container import Sequential, ComponentList
from .db import LocalDB
from .default_prompt_template import DEFAULT_ADALFLOW_SYSTEM_PROMPT
from .embedder import Embedder, BatchEmbedder
from .generator import Generator, BackwardEngine
from .model_client import ModelClient
from .string_parser import (
    YamlParser,
    JsonParser,
    IntParser,
    FloatParser,
    ListParser,
    BooleanParser,
)


# from .multirunner import MultiRunner

from .prompt_builder import Prompt

from .retriever import Retriever
from .tokenizer import Tokenizer


from .types import (
    ModelType,
    ModelClientType,
    get_model_args,
    Embedding,
    Usage,
    TokenLogProb,
    EmbedderOutput,
    EmbedderInputType,
    EmbedderOutputType,
    BatchEmbedderInputType,
    BatchEmbedderOutputType,
    GeneratorOutput,
    GeneratorOutputType,
    Document,
    RetrieverQueryType,
    RetrieverStrQueryType,
    RetrieverQueriesType,
    RetrieverStrQueriesType,
    RetrieverDocumentType,
    RetrieverStrDocumentType,
    RetrieverDocumentsType,
    RetrieverOutput,
    RetrieverOutputType,
    UserQuery,
    AssistantResponse,
    DialogTurn,
    Conversation,
)

# Conditional import for MCP tools (requires Python >= 3.10)
try:
    from .mcp_tool import MCPFunctionTool, MCPToolManager
    _MCP_AVAILABLE = True
except ImportError:
    MCPFunctionTool = None
    MCPToolManager = None
    _MCP_AVAILABLE = False

from adalflow.utils.registry import EntityMapping

__all__ = [
    "LocalDB",
    "Component",
    "DataComponent",
    "func_to_data_component",
    "Sequential",
    "ComponentList",
    "DataClass",
    "DataClassFormatType",
    "required_field",
    "Generator",
    "BackwardEngine",
    "Prompt",
    "DEFAULT_ADALFLOW_SYSTEM_PROMPT",
    # "Parameter",
    "required_field",
    "ModelClient",
    "Embedder",
    "BatchEmbedder",
    "Retriever",
    "GeneratorOutput",
    "GeneratorOutputType",
    "ModelType",
    "ModelClientType",
    "get_model_args",
    "Embedding",
    "Usage",
    "TokenLogProb",
    "EmbedderOutput",
    "EmbedderInputType",
    "EmbedderOutputType",
    "BatchEmbedderInputType",
    "BatchEmbedderOutputType",
    "Document",
    "RetrieverQueryType",
    "RetrieverStrQueryType",
    "RetrieverQueriesType",
    "RetrieverStrQueriesType",
    "RetrieverDocumentType",
    "RetrieverStrDocumentType",
    "RetrieverDocumentsType",
    "RetrieverOutput",
    "RetrieverOutputType",
    "UserQuery",
    "AssistantResponse",
    "DialogTurn",
    "Conversation",
    "Tokenizer",
    # Parsers
    "YamlParser",
    "JsonParser",
    "IntParser",
    "FloatParser",
    "ListParser",
    "BooleanParser",
]

# Add MCP tools to __all__ only if available
if _MCP_AVAILABLE:
    __all__.extend(["MCPFunctionTool", "MCPToolManager"])

for name in __all__:
    entity = globals().get(name)
    if entity is not None:
        EntityMapping.register(name, entity)

```

### Core Architecture Module: `adalflow/adalflow/core/base_data_class.py`
```
"""A base class that provides an easy way for data to interact with LLMs."""

from typing import List, Dict, Any, Optional, Union, Callable, Type
import collections
from collections import OrderedDict


import enum
from copy import deepcopy
from dataclasses import (
    field,
    fields,
    make_dataclass,
    is_dataclass,
)

import json
import yaml
import logging

from adalflow.core.functional import (
    # dataclass_obj_to_dict,
    custom_asdict,
    dataclass_obj_from_dict,
    get_dataclass_schema,
    convert_schema_to_signature,
    represent_ordereddict,
)

__all__ = [
    "DataClass",
    "DataClassFormatType",
    "required_field",
    "ExcludeType",
    "IncludeType",
    "check_adal_dataclass",
    "DynamicDataClassFactory",
]
logger = logging.getLogger(__name__)


class DataClassFormatType(enum.Enum):
    r"""The format type for the DataClass schema."""

    # for class
    SCHEMA = "schema"
    SIGNATURE_YAML = "signature_yaml"
    SIGNATURE_JSON = "signature_json"
    # for instance
    EXAMPLE_YAML = "example_yaml"
    EXAMPLE_JSON = "example_json"


# Register the custom representer
yaml.add_representer(collections.OrderedDict, represent_ordereddict)


def required_field() -> Callable[[], Any]:
    """
    A factory function to create a required field in a dataclass.
    The returned callable raises a TypeError when invoked, indicating a required field was not provided.

    Args:
        name (Optional[str], optional): The name of the required field. Defaults to None

    Returns:
        Callable[[], Any]: A callable that raises TypeError when called, indicating a missing required field.

    Example:

    .. code-block:: python

        from dataclasses import dataclass
        from adalflow.core.base_data_class import required_field, DataClass

        @dataclass
        class Person(DataClass):
            name: str = field(default=None)
            age: int = field(default_factory=required_field())# allow required field after optional field
    """

    def required_field_error():
        """This function is returned by required_field and raises an error indicating the field is required."""
        raise TypeError("This field is required and was not provided.")

    required_field_error.__name__ = (
        "required_field"  # Set the function's name explicitly
    )
    return required_field_error


# Dict is for the nested dataclasses, e.g. {"Person": ["name", "age"], "Address": ["city"]}
ExcludeType = Optional[Union[List[str], Dict[str, List[str]]]]
IncludeType = Optional[Union[List[str], Dict[str, List[str]]]]


class DataClass:
    __doc__ = r"""The base data class for all data types that interact with LLMs.

    Please only exclude optional fields in the exclude dictionary.

    Designed to streamline the handling, serialization, and description of data within our applications, especially for LLM prompts.
    We explicitly handle this instead of relying on 3rd party libraries such as pydantic or marshmallow to have better
    transparency and to keep the order of the fields when they're serialized.

    How to create your own dataclass?

    1. Subclass DataClass and define the fields with the `field` decorator.
    2. Use the `medata` argument and a `desc` key to describe the field.
    3. Keep the order of the fields as how you want them to be serialized and described to LLMs.
    4. A field with a default value is considered optional. Fields without a default value and fields with default_factory=required_field is considered required.

    How to use it?

    Describing:

    We defined :class:`DataClassFormatType<core.types.DataClassFormatType>` to categorize DataClass formats
    as LLM inputs or outputs. This can be broken down into:
    (1) schema (class description)
    (2) signatures (class description)
    (3) examples (instance description)

    (1) `DataClassFormatType.SCHEMA`
    - Standard JSON-based desription, via: :meth:`to_schema` as string and :meth:`to_schema` as dict.

    (2) `DataClassFormatType.SIGNATURE_JSON` / `DataClassFormatType.SIGNATURE_YAML`
    - More token-efficient than SCHEMA. Since SCHEMA is always represented as a JSON string, describing the data structure in JSON may be misleading when you want LLMS to output YAML.

    - DataClassFormatType.SIGNATURE_JSON: imitating a json object with field name as key and description as value, :meth:`to_json_signature` as string.
    - DataClassFormatType.SIGNATURE_YAML: imitating a yaml object with field name as key and description as value, :meth:`to_yaml_signature` as string.

    (3) `DataClassFormatType.EXAMPLE_JSON` / `DataClassFormatType.EXAMPLE_YAML`
    - Helpful to do few-shot examples in LLM prompts.

    - DataClassFormatType.EXAMPLE_JSON: the json representation of the instance, :meth:`to_json` as string.
    - DataClassFormatType.EXAMPLE_YAML: the yaml representation of the instance, :meth:`to_yaml` as string.

    note::
        1. Avoid using Optional[Type] for the type of fields, as dataclass already distingushes between optional and required fields using default value.
        2. If you need to customize, you can subclass and overwrite any method to fit your needs.

    Loading data:

    - :meth:`from_dict` is used to create a dataclass instance from a dictionary.


    Refer :ref:`DataClass<core-base_data_class_note>` for more detailed instructions.

    Examples:

    .. code-block:: python

        # Define a dataclass
        from adalflow.core import DataClass
        from dataclasses import dataclass, field

        @dataclass
        class MyOutputs(DataClass):
            age: int = field(metadata={"desc": "The age of the person", "prefix": "Age:"})
            name: str = field(metadata={"desc": "The name of the person", "prefix": "Name:"})

        # Create json signature
        print(MyOutputs.to_json_signature())
        # Output:
        # {
        #     "age": "The age of the person",
        #     "name": "The name of the person"
        # }
        # Create yaml signature
        print(MyOutputs.to_yaml_signature())
        # Output:
        # age: The age of the person
        # name: The name of the person

        # Create a dataclass instance
        my_instance = MyOutputs(age=25, name="John Doe")
        # Create json example
        print(my_instance.to_json_example())
        # Output:
        # {
        #     "age": 25,
        #     "name": "John Doe"
        # }
        # Create yaml signature
        print(my_instance.to_yaml_example())
        # Output:
        # age: 25
        # name: John Doe

    """
    __input_fields__: List[str] = []
    __output_fields__: List[str] = []

    def __post_init__(self):

        for f in fields(self):
            if "desc" not in f.metadata and "description" not in f.metadata:

                logger.debug(
                    f"Class {  self.__class__.__name__} Field {f.name} is missing 'desc' in metadata"
                )

    @classmethod
    def get_task_desc(cls) -> str:
        """Get the task description for the dataclass.

        Returns:
            str: The task description for the dataclass.
        """
        return cls.__doc__

    @classmethod
    def set_task_desc(cls, task_desc: str) -> None:
        """Set the task description for the dataclass.

        Args:
            task_desc (str): The task description to set.
        """
        cls.__doc__ = task_desc

    @classmethod
    def get_input_fields(cls):
        """Return a list of all input fields."""
        return cls.__input_fields__

    @classmethod
    def set_input_fields(cls, input_fields: List[str]):
        """Set the input fields for the dataclass.
          When creating schema or instance, it will follow the input field and output field order

        Args:
            input_fields (List[str]): The input fields to set.
        """
        cls.__input_fields__ = input_fields

    @classmethod
    def get_output_fields(cls):
        """Return a list of all output fields."""
        return cls.__output_fields__

    @classmethod
    def set_output_fields(cls, output_fields: List[str]):
        """Set the output fields for the dataclass.
          When creating schema or instance, it will follow the input field and output field order

        Args:
            output_fields (List[str]): The output fields to set.
        """
        cls.__output_fields__ = output_fields

    def to_dict(
        self,
        *,
        exclude: ExcludeType = None,
        include: IncludeType = None,
    ) -> Dict[str, Any]:
        """Convert a dataclass object to a dictionary.

        Supports nested dataclasses, lists, and dictionaries.
        Allow exclude keys for each dataclass object.

        Use cases:
        - Decide what information will be included to be serialized to JSON or YAML that can be used in LLM prompt.
        - Exclude sensitive information from the serialized output.
        - Serialize the dataclass instance to a dictionary for saving states.

        Args:
            exclude (Optional[Dict[str, List[str]]], optional): A dictionary of fields to exclude for each dataclass object. Defaults to None.


        Example:

        .. code-block:: python

            from dataclasses import dataclass
            from typing import List

            @dataclass
            class TrecData:
                question: str
                label: int

            @dataclass
            class TrecDataList(DataClass):

                data: List[TrecData]
                name: str

            trec_data = TrecData(question="What is the capital of France?", label=0)
            trec_data_list = TrecDataList(data=[trec_data], name="trec_data_list")

            trec_data_list.to_dict(exclude={"TrecData": ["label"], "TrecDataList": ["name"]})

            # Output:
            # {'data': [{'question': 'What is the capital of France?'}]}
        """
        if not is_dataclass(self):
            raise ValueError(
                f"to_dict() is
```

### Core Architecture Module: `adalflow/adalflow/core/component.py`
```
"""Base building block for building LLM task pipelines.
It handles states recursively, such as training, components, parameters recursively along with serialization and deserialization.
"""

from collections import OrderedDict, namedtuple
from typing import (
    Dict,
    Any,
    Optional,
    List,
    Tuple,
    Iterable,
    Set,
    Mapping,
    TypeVar,
    Type,
    TYPE_CHECKING,
    Callable,
)

import logging
import pickle
import inspect

if TYPE_CHECKING:
    from adalflow.optim.parameter import Parameter
    from adalflow.optim.grad_component import GradComponent
from adalflow.utils.serialization import default
from adalflow.utils.config import new_component

from adalflow.utils.registry import EntityMapping


log = logging.getLogger(__name__)

T = TypeVar("T")


def _addindent(s_, numSpaces):
    s = s_.split("\n")
    # don't do anything for single-line stuff
    if len(s) == 1:
        return s_
    first = s.pop(0)
    s = [(numSpaces * " ") + line for line in s]
    s = "\n".join(s)
    s = first + "\n" + s
    return s


class Component:
    r"""
    Base class for all LLM task pipeline components.

    Such as ``Prompt``, ``ModelClient``, ``Embedder``, ``Retriever``, ``Generator``, etc.
    Your task pipeline should subclass this.

    Components can also contain other Components, allowing to nest them in
    a tree structure. You can assign the subcomponents as regular attributes::

    Component supports three modes:
    - Training mode: ``train()`` When turned on, any component __call__ will use forward and backward for in-context training.
      When turned off, the __call__ should only use `call` and `acall` for inference.
    - Tracing mode: ``trace()`` When turned on, the component will accumulate input, output, and backpropagate the eval score to Parameter of Demo type.
    - Teacher mode: ``use_teacher()`` When turned on, the component will accumulates the demos to the `_trace`s, otherwise, it will be saved in `_student_traces`.

    Example:

    .. code-block:: python

        from adalflow.core import Component, Generator
        from adalflow.components.model_client import OpenAIClient

        template_doc = r"<SYS> You are a doctor </SYS> User: {{input_str}}"

        class DocQA(Component):
            def __init__(self):
                super(DocQA, self).__init__()
                self.doc = Generator(
                    template=template_doc,
                    model_client=OpenAIClient(),
                    model_kwargs={"model": "gpt-3.5-turbo"},
                )

            def call(self, query: str) -> str:
                return self.doc(query).data

        # instantiate the component
        doc_qa = DocQA()
        print(doc_qa)

    The print will be:

    .. code-block::

        DocQA(
        (doc): Generator(
            model_kwargs={'model': 'gpt-3.5-turbo'}, model_type=ModelType.LLM
            (system_prompt): Prompt(template: <SYS> You are a doctor </SYS> User: {{input_str}}, prompt_variables: ['input_str'])
            (model_client): OpenAIClient()
        )
        )

    We follow the same design pattern as PyTorch's ``nn.Module.``
    Instead of working with ``Tensor`` and ``Parameter`` to train models with weights and biases,
    our component works with any data, ``Parameter`` that can be any data type for LLM in-context learning, from manual to auto prompt engineering.
    Besides, (1) instead of `forward` and `backward` functions, we have `call` and `acall` functions for sync and async calls.
    (2) we provide `to_dict` to handle serialization of the whole component states on top of `state_dict`.

    We purposely avoid using the name "Module" to avoid confusion with PyTorch's nn.Module.
    As we consider 'Component' to be an extension to 'Module' as if you use a local llm model
    for the Generator, you might need the 'Module' within the 'Component'.
    """

    _version: int = 1  # Version of the component
    _components: Dict[str, Optional["Component"]]
    _init_args: Dict[str, Any] = {}  # Store the init arguments

    _parameters: Dict[str, Optional["Parameter"]]
    training: bool
    teacher_mode: bool
    tracing: bool
    name: str = (
        "Component"  # name will help with GradComponent output naming as "{name}_output"
    )

    _component_type = "base"

    def __init__(self, name: Optional[str] = None, *args, **kwargs) -> None:
        super().__setattr__("_components", OrderedDict())
        super().__setattr__("_parameters", OrderedDict())
        super().__setattr__("training", False)
        super().__setattr__("teacher_mode", False)
        super().__setattr__("tracing", False)
        if name is not None:
            super().__setattr__("name", name)
        else:
            super().__setattr__("name", self.__class__.__name__)
        # only for tracking the init args
        super().__setattr__("_init_args", self._get_init_args(*args, **kwargs))

        # save this class to the registry
        EntityMapping.register(self.__class__.__name__, self.__class__)

    def use_teacher(self, mode: bool = True):
        r"""Sets the component in teacher mode."""
        if not isinstance(mode, bool):
            raise ValueError("mode should be a boolean")
        self.teacher_mode = mode
        for component in self.children():
            component.use_teacher(mode)
        return self

    # TODO: reassese trace, it should be turned on maybe all the time
    def trace(self, mode: bool = True):
        r"""Sets the component in tracing mode.This signal will be used in forward and backward to accumulate input and output."""
        if not isinstance(mode, bool):
            raise ValueError("mode should be a boolean")
        self.tracing = mode
        for component in self.children():
            component.trace(mode)
        return self

    def train(self, mode: bool = True):
        r"""Sets the component in training mode."""
        if not isinstance(mode, bool):
            raise ValueError("mode should be a boolean")
        self.training = mode
        for component in self.children():
            component.train(mode)
        return self

    def eval(self):
        r"""Sets the component in evaluation mode."""
        return self.train(False)

    def __dir__(self):
        r"""Useful to handle json serialization.

        Use dir() to get the list of attributes of the component.
        """
        component_attrs = dir(self.__class__)
        attrs = list(self.__dict__.keys())
        parameters = list(self._parameters.keys())
        components = list(self._components.keys())
        keys = component_attrs + attrs + parameters + components

        # Elimiate attrs that are not legal python variable names
        keys = [key for key in keys if not key[0].isdigit()]
        return sorted(keys)

    def is_picklable(self) -> bool:
        """
        Test if the given object is picklable.

        Args:
            obj: The object to test.

        Returns:
            bool: True if the object is picklable, False otherwise.
        """
        try:
            import io

            # Create a BytesIO buffer to simulate file I/O
            buffer = io.BytesIO()
            target = self.to_dict()
            # Try to serialize the object to the buffer
            pickle.dump(target, buffer)
            # Reset the buffer's position to the beginning
            buffer.seek(0)
            # Try to deserialize the object from the buffer
            pickle.load(buffer)
            return True
        except (pickle.PicklingError, TypeError, AttributeError) as e:
            log.info(f"Object is not picklable: {e}")
            return False

    def pickle_to_file(self, filepath: str) -> None:
        """Pickle the component to a file."""
        with open(filepath, "wb") as file:
            pickle.dump(self.to_dict(), file)

    @classmethod
    def load_from_pickle(cls, filepath: str) -> None:
        """Load the component from a file."""
        with open(filepath, "rb") as file:
            return cls.from_dict(pickle.load(file))

    def to_dict(self, exclude: Optional[List[str]] = None) -> Dict[str, Any]:
        """Converts the component to a dictionary object for serialization, including more states of the component than state_dict.

        Each data if of format: {"type": type, "data": data}
        """
        exclude = exclude or []
        exclude = set(exclude)
        result: Dict[str, Any] = {
            "type": type(self).__name__,
            "data": {},
        }  # Add the type of the component
        data_dict = result["data"]
        for key, value in self.__dict__.items():
            key = str(key)
            if key in exclude:
                continue

            try:
                data_dict[key] = self._process_value(value)
            except TypeError:
                # Handle unserializable objects by pickling them
                data_dict[key] = {"_pickle_data": pickle.dumps(value).hex()}
        return result

    def _process_value(self, value):
        """Process values recursively for serialization."""
        # if isinstance(value, dict):
        #     # Recurse into dictionaries
        #     return {k: self._process_value(v) for k, v in sorted(value.items())}

        if isinstance(value, dict):
            if isinstance(value, OrderedDict):
                return {
                    "_ordered_dict": True,
                    "data": [(k, self._process_value(v)) for k, v in value.items()],
                }
            # return {k: self._process_value(v) for k, v in sorted(value.items())}
            # no sorting
            return {k: self._process_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            # Recursively process list items
            try:
                # return sorted(self._process_value(v) for v in value)
                return [self._process_value(v) for v in value]
            except TypeError:
                # 
```

### Core Architecture Module: `adalflow/adalflow/core/container.py`
```
"""
Container component for composing multiple components, such as Sequential
and ComponentList.

This design draws inspiration from PyTorch’s modular
container patterns, including `nn.Sequential` and `nn.ModuleList`. The
`Container` component allows for grouping several components into one, enabling
flexible and reusable model architectures.

Design Motivation:
-------------------
This implementation follows the same principles as PyTorch’s component-based
design, encouraging modularity, reusability, and extensibility. The `Container`
component provides an easy way to manage multiple layers or other components,
while ensuring that their parameters are properly registered and updated during
training.

Credits:
---------
The design of this component takes inspiration from the PyTorch project
(https://pytorch.org). PyTorch is an open-source deep learning framework,
licensed under a BSD-style license. Although this code is not part of the
official PyTorch library, it mirrors the same design principles.

For more details on PyTorch’s licensing, refer to:
https://github.com/pytorch/pytorch/blob/main/LICENSE

Usage Example:
--------------
    class MyModule(nn.Module):
        def __init__(self):
            super().__init__()

            self.model = nn.Sequential(
                  nn.Conv2d(1,20,5),
                  nn.ReLU(),
                  nn.Conv2d(20,64,5),
                  nn.ReLU()
                )
            self.linears = nn.ModuleList([nn.Linear(10, 10) for i in range(10)])

        def forward(self, x):
            # ModuleList can act as an iterable, or be indexed using ints
            for i, l in enumerate(self.linears):
                x = self.linears[i // 2](x) + l(x)
            return x

"""

from collections import OrderedDict, abc as container_abcs
import operator
from itertools import islice, chain
from typing import TypeVar, Dict, Union, Iterable, Iterator, Any, overload, Optional

from adalflow.core.component import Component

T = TypeVar("T", bound=Component)

__all__ = ["Sequential", "ComponentList"]


class Sequential(Component):
    __doc__ = r"""A sequential container.

    Adapted from PyTorch's ``nn.Sequential``.

    Components will be added to it in the order they are passed to the constructor.
    Alternatively, an ``OrderedDict`` of components can be passed in.
    It "chains" outputs of the previous component to the input of the next component sequentially.
    Output of the previous component is input to the next component as positional argument.

    Benefits of using Sequential:
    1. Convenient for data pipeline that often consists of multiple components. This allow users to encapsulate the pipeline in a single component.
    Examples:

    Without Sequential:

    .. code-block:: python

        class AddAB(Component):
            def call(self, a: int, b: int) -> int:
                return a + b


        class MultiplyByTwo(Component):
            def call(self, input: int) -> int:
                return input * 2

        class DivideByThree(Component):
            def call(self, input: int) -> int:
                return input / 3

        # Manually chaining the components
        add_a_b = AddAB()
        multiply_by_two = MultiplyByTwo()
        divide_by_three = DivideByThree()

        result = divide_by_three(multiply_by_two(add_a_b(2, 3)))



    With Sequential:

    .. code-block:: python

        seq = Sequential(AddAB(), MultiplyByTwo(), DivideByThree())
        result = seq(2, 3)

    .. note::
        Only the first component can receive arbitrary positional and keyword arguments.
        The rest of the components should have a single positional argument as input and have it to be exactly the same type as the output of the previous component.

    2. Apply a transformation or operation (like training, evaluation, or serialization) to the Sequential object, it automatically applies that operation to each component it contains.
    This can be useful for In-context learning training.


    Examples:

    1. Use positional arguments:
        >>> seq = Sequential(component1, component2)
    2. Add components:
        >>> seq.append(component4)
    3. Get a component:
        >>> seq[0]
    4. Delete a component:
        >>> del seq[0]
    5. Iterate over components:
        >>> for component in seq:
        >>>     print(component)
    6. Add two Sequentials:
        >>> seq1 = Sequential(component1, component2)
        >>> seq2 = Sequential(component3, component4)
        >>> seq3 = seq1 + seq2
    7. Use OrderedDict:
        >>> seq = Sequential(OrderedDict({"component1": component1, "component2": component2}))
    8. Index OrderDict:
        >>> seq = Sequential(OrderedDict({"component1": component1, "component2": component2}))
        >>> seq["component1"]
        # or
        >>> seq[0]
    9. Call with a single argument as input:
        >>> seq = Sequential(component1, component2)
        >>> result = seq.call(2)
    10. Call with multiple arguments as input:
        >>> seq = Sequential(component1, component2)
        >>> result = seq.call(2, 3)
    """

    _components: Dict[str, Component] = OrderedDict()  # type: ignore[assignment]

    @overload
    def __init__(self, *args: Component) -> None: ...

    @overload
    def __init__(self, arg: "OrderedDict[str, Component]") -> None: ...

    def __init__(self, *args):
        super().__init__()
        if len(args) == 1 and isinstance(args[0], OrderedDict):
            for key, component in args[0].items():
                self.add_component(key, component)
        else:
            for idx, component in enumerate(args):
                self.add_component(str(idx), component)

    def _get_item_by_idx(self, iterator: Iterator[Component], idx: int) -> Component:
        """Get the idx-th item of the iterator."""
        size = len(self)
        idx = operator.index(idx)
        if not -size <= idx < size:
            raise IndexError(f"index {idx} is out of range")
        idx %= size
        return next(islice(iterator, idx, None))

    def __getitem__(
        self, idx: Union[slice, int, str]
    ) -> Union["Sequential", Component]:
        """Get the idx-th and by-key component of the Sequential."""
        if isinstance(idx, slice):
            return self.__class__(OrderedDict(list(self._components.items())[idx]))
        elif isinstance(idx, str):
            return self._components[idx]
        else:
            return self._get_item_by_idx(iter(self._components.values()), idx)

    def __setitem__(self, idx: Union[int, str], component: Component) -> None:
        """Set the idx-th component of the Sequential."""
        if isinstance(idx, str):
            self._components[idx] = component
        else:
            # key: str = self._get_item_by_idx(iter(self._components.keys()), idx)
            # self._components[key] = component
            key_list = list(self._components.keys())
            key = key_list[idx]
            self._components[key] = component

    def __delitem__(self, idx: Union[slice, int, str]) -> None:
        """Delete the idx-th component of the Sequential."""
        if isinstance(idx, slice):
            for key in list(self._components.keys())[idx]:
                delattr(self, key)
        elif isinstance(idx, str):
            del self._components[idx]
        else:
            # key = self._get_item_by_idx(iter(self._components.keys()), idx)
            key_list = list(self._components.keys())
            key = key_list[idx]

            delattr(self, key)

        # Reordering is needed if numerical keys are used to keep the sequence
        self._components = OrderedDict(
            (str(i), comp) for i, comp in enumerate(self._components.values())
        )

    def __iter__(self) -> Iterator[Component]:
        r"""Iterates over the components of the Sequential.

        Examples:
        1. Iterate over the components:

        .. code-block:: python

            for component in seq:
                print(component)
        """
        return iter(self._components.values())

    def __len__(self) -> int:
        return len(self._components)

    def __add__(self, other) -> "Sequential":
        r"""Adds two Sequentials.

        Creating a new Sequential with components of both the Sequentials.

        Examples:
        1. Add two Sequentials:

        .. code-block:: python

            seq1 = Sequential(component1, component2)
            seq2 = Sequential(component3, component4)
            seq3 = seq1 + seq2
        """
        if isinstance(other, Sequential):
            ret = Sequential()
            for layer in self:
                ret.append(layer)
            for layer in other:
                ret.append(layer)
            return ret
        else:
            raise ValueError(
                "add operator supports only objects "
                f"of Sequential class, but {str(type(other))} is given."
            )

    def __iadd__(self, other) -> "Sequential":
        r"""Inplace add two Sequentials.

        Adding components of the other Sequential to the current Sequential.

        Examples:
        1. Inplace add two Sequentials:

        .. code-block:: python

            seq1 = Sequential(component1, component2)
            seq2 = Sequential(component3, component4)
            seq1 += seq2
        """
        if not isinstance(other, Sequential):
            raise ValueError(
                "add operator supports only objects "
                f"of Sequential class, but {str(type(other))} is given."
            )
        for layer in other:
            self.append(layer)
        return self

    @overload
    def call(self, input: Any) -> object: ...

    @overload
    def call(self, *args: Any, **kwargs: Any) -> object: ...

    def call(self, *args: Any, **kwargs: Any) -> object:
        if len(args) == 1 and not kwargs:
            input = args[0]
            for component in self._components.values():
               
```

### Core Architecture Module: `adalflow/adalflow/core/db.py`
```
"""LocalDB to perform in-memory storage and data persistence(pickle or any filesystem) for data models like documents and dialogturn."""

from typing import List, Optional, Callable, Dict, Any, TypeVar, overload
import logging
import os
from dataclasses import field, dataclass
import pickle


from adalflow.core.component import Component
from adalflow.utils.registry import EntityMapping
from adalflow.utils.global_config import get_adalflow_default_root_path


log = logging.getLogger(__name__)

T = TypeVar("T")  # Allow any type as items

U = TypeVar("U")  # U will be the type after transformation


# TODO: localDB does not need to be a component
# TODO: DB clarity can be further improved
@dataclass
class LocalDB(Component):
    __doc__ = """LocalDB with in-memory CRUD operations, data transformation/processing pipelines, and persistence.

    LocalDB is highly flexible.
    1. It can store any type of data items in the `items` attribute.
    2. You can register and apply multiple transformers, and save the transformed data in the `transformed_items` attribute.
       This is highly useful to manage experiments with different data transformations.
    3. You can save the state of the LocalDB to a pickle file and load it back later. All states are restored.
        str(local_db.__dict__) == str(local_db_loaded.__dict__) should be True.

    .. note::
        The transformer should be of type Component. We made the effort in the library to make every component picklable.

    CRUD operations:
    1. Create a new db: ``db = LocalDB(name="my_db")``
    2. load: Load the db with data. ``db.load([{"text": "hello world"}, {"text": "hello world2"}])``
    3. extend: Extend the db with data. ``db.extend([{"text": "hello world3"}])``.
       In default, the transformer is applied and the transformed data is extended.
    4. add: Add a single item to the db. ``db.add({"text": "hello world4"})``.
       In default, the transformer is applied and the transformed data is added.
       Unless the transformed data keeps the same length as the original data, the insert operation does not mean insert after the last item.
    5. delete: Remove items by index. ``db.delete([0])``.
    6. reset: Remove all items. ``db.reset()``, including transformed_items and transformer_setups,and mapper_setups.

    Data transformation:
    1. Register a transformer first and apply it later

    .. code-block:: python

            db.register_transformer(transformer, key="test", map_fn=map_fn)
            # load data
            db.load([{"text": "hello world"}, {"text": "hello world2"}], apply_transformer=True)

            # or load data first and apply transformer by key
            db.load([{"text": "hello world"}, {"text": "hello world2"}], apply_transformer=False)
            db.apply_transformer("test")

    2. Add a version of transformed data to the db along with the transformer.

    .. code-block:: python

            db.transform(transformer, key="test", map_fn=map_fn)

    Data persistence:
    1. Save the state of the db to a pickle file.

    .. code-block:: python

            db.save_state("storage/local_item_db.pkl")

    2. Load the state of the db from a pickle file.

    .. code-block:: python

            db2 = LocalDB.load_state("storage/local_item_db.pkl")

    3. Check if the loaded and original db are the same.

    .. code-block:: python

                str(db.__dict__) == str(db2.__dict__) # expect True

    Args:

        items (List[T], optional): The original data items. Defaults to []. Can be any type such as Document, DialogTurn, dict, text, etc.
            The only requirement is that they should be picklable/serializable.
        transformed_items (Dict[str, List [U]], optional): Transformed data items by key. Defaults to {}.
             Transformer must be of type Component.
        transformer_setups (Dict[str, Component], optional): Transformer setup by key. Defaults to {}.
          It is used to save the transformer setup for later use.
        mapper_setups (Dict[str, Callable[[T], Any]], optional): Map function setup by key. Defaults to {}.
    """

    name: Optional[str] = field(
        default="LocalDB", metadata={"description": "Name of the DB"}
    )
    items: List[object] = field(
        default_factory=list, metadata={"description": "The original data items"}
    )

    transformed_items: Dict[str, List[U]] = field(
        default_factory=dict, metadata={"description": "Transformed data items by key"}
    )

    transformer_setups: Dict[str, Component] = field(
        default_factory=dict, metadata={"description": "Transformer setup by key"}
    )
    mapper_setups: Dict[str, Callable[[T], Any]] = field(
        default_factory=dict, metadata={"description": "Map function setup by key"}
    )
    index_path: Optional[str] = field(
        default="index.faiss", metadata={"description": "Path to the index file"}
    )

    def __post_init__(self):
        super().__init__(name=self.name)

    @property
    def length(self):
        return len(self.items)

    def get_transformer_keys(self) -> List[str]:
        return list(self.transformed_items.keys())

    # TODO: combine this to fetch_transformed_items
    def get_transformed_data(
        self, *, key: str, filter_fn: Callable[[Any], bool] = lambda x: True
    ) -> List[U]:
        """
        Get the transformed items by key after applying a filter on metadata.

        Args:
            key (str): The key to identify which transformed items to retrieve.
            filter_fn (Callable[[Any], bool], optional): The filter function to apply on the metadata. Defaults to lambda x: True.

        Returns:
            List[U]: The filtered and transformed items.
        """
        if key not in self.transformed_items:
            raise ValueError(f"Key {key} not found in transformed items.")
        # Apply filter function on the transformed items
        return list(filter(filter_fn, self.transformed_items[key]))

    def _get_transformer_name(self, *, transformer: Component) -> str:
        name = f"{transformer.__class__.__name__}_"
        print(f"transformer: {transformer}")
        for n, _ in transformer.named_components():
            name += n + "_"
        return name

    def register_transformer(
        self,
        *,
        transformer: Component,
        key: Optional[str] = None,
        map_fn: Optional[Callable[[T], Any]] = None,
    ) -> str:
        """Register a transformer to be used later for transforming the data."""
        if key is None:
            key = self._get_transformer_name(transformer=transformer)
            log.info(f"Generated key for transformer: {key}")
        self.transformer_setups[key] = transformer
        if map_fn is not None:
            self.mapper_setups[key] = map_fn
        self.transformed_items[key] = []
        return key

    @overload
    def transform(self, key: str) -> str:
        """Apply the transformer by key to the data."""
        ...

    @overload
    def transform(
        self,
        *,
        transformer: Component,
        key: Optional[str] = None,
        map_fn: Optional[Callable[[T], Any]] = None,
    ) -> str:
        """Register and apply the transformer to the data."""
        ...

    def transform(
        self,
        *,
        transformer: Optional[Component] = None,
        key: Optional[str] = None,
        map_fn: Optional[Callable[[T], Any]] = None,
    ) -> str:
        """The main method to apply the transformer to the data in two ways:
        1. Apply the transformer by key to the data using ``transform(key="test")``.
        2. Register and apply the transformer to the data using ``transform(transformer, key="test")``.

        Args:
            transformer (Optional[Component], optional): The transformer to use. Defaults to None.
            key (Optional[str], optional): The key to use for the transformer. Defaults to None.
            map_fn (Optional[Callable[[T], Any]], optional): The map function to use. Defaults to None.

        Returns:
            str: The key used for the transformation, from which the transformed data can be accessed.
        """
        key_to_use = key
        if transformer:
            key = self.register_transformer(
                transformer=transformer, key=key, map_fn=map_fn
            )
            key_to_use = key
        if key_to_use is None:
            raise ValueError("Key must be provided.")

        if map_fn is not None:
            items_to_use = [map_fn(item) for item in self.items]
        else:
            items_to_use = self.items.copy()

        transformer_to_use = self.transformer_setups[key_to_use]
        self.transformed_items[key_to_use] = transformer_to_use(items_to_use)
        return key_to_use

    def load(self, items: List[Any]):
        """Load the db with new items.

        Args:
            items (List[Any]): The items to load.

        Examples:

        .. code-block:: python

            db = LocalDB()
            db.load([{"text": "hello world"}, {"text": "hello world2"}])
        """
        try:
            self.items = items.copy()
        except Exception as e:
            log.error(f"Error loading the items: {e}")

    def extend(
        self,
        items: List[Any],
        apply_transformer: bool = True,
    ):
        """Extend the db with new items."""

        self.items = self.items + items

        if apply_transformer:
            for key, transformer in self.transformer_setups.items():
                # check if there was a map function registered
                transformed_items = []
                if key in self.mapper_setups:
                    map_fn = self.mapper_setups[key]
                    transformed_items = transformer([map_fn(doc) for doc in items])
                else:
                    transformed_items = transformer(items)
                self.transformed_items[key] = (
                    self.transformed_items[key] + transforme
```

### Core Architecture Module: `adalflow/adalflow/core/default_prompt_template.py`
```
"""This is the default system prompt template used in the AdalFlow.

Use :ref:`Prompt <core-prompt_builder>` class  to manage it.
"""

__all__ = [
    "ADALFLOW_DEFAULT_PROMPT_ARGS",
    "ADALFLOW_DEFAULT_PROMPT_TRAINABLE_PARAMS",
    "SIMPLE_DEFAULT_ADALFLOW_SYSTEM_PROMPT",
    "DEFAULT_ADALFLOW_SYSTEM_PROMPT",
]
# TODO: potentially make a data class for this
ADALFLOW_DEFAULT_PROMPT_ARGS = [
    "task_desc_str",  # task description
    "output_format_str",  # output format of the task
    "tools_str",  # tools used in the task
    "examples_str",  # examples of the task
    "chat_history_str",  # chat history of the user
    "context_str",  # context of the user query
    "steps_str",  # used in agent steps
    "input_str",  # user query or input
]

ADALFLOW_DEFAULT_PROMPT_TRAINABLE_PARAMS = [
    "task_desc_str",
    # "output_format_str",
    "examples_str",
]

SIMPLE_DEFAULT_ADALFLOW_SYSTEM_PROMPT = r"""<SYS>{{task_desc_str}}</SYS>
User: {{input_str}}
You:"""

DEFAULT_ADALFLOW_SYSTEM_PROMPT = r"""<START_OF_SYSTEM_PROMPT>
{# task desc #}
{% if task_desc_str %}
{{task_desc_str}}
{% else %}
You are a helpful assistant.
{% endif %}
{#input format#}
{% if input_format_str %}
<INPUT_FORMAT>
{{input_format_str}}
</INPUT_FORMAT>
{% endif %}
{# output format #}
{% if output_format_str %}
<OUTPUT_FORMAT>
{{output_format_str}}
</OUTPUT_FORMAT>
{% endif %}
{# tools #}
{% if tools_str %}
<TOOLS>
{{tools_str}}
</TOOLS>
{% endif %}
{# example #}
{% if examples_str %}
<EXAMPLES>
{{examples_str}}
</EXAMPLES>
{% endif %}
{# chat history #}
{% if chat_history_str %}
<CHAT_HISTORY>
{{chat_history_str}}
</CHAT_HISTORY>
{% endif %}
{#contex#}
{% if context_str %}
<CONTEXT>
{{context_str}}
</CONTEXT>
{% endif %}
<END_OF_SYSTEM_PROMPT>
<START_OF_USER_PROMPT>
{% if input_str %}
{{input_str}}
{% endif %}
{# steps #}
{% if steps_str %}
<START_OF_ASSISTANT_STEPS>
{{steps_str}}
<END_OF_ASSISTANT_STEPS>
{% endif %}
<END_OF_USER_PROMPT>
"""
# 1. use steps_str for agentic with multiple loop
# 2. use context_str for RAG's contex
# 3. use chat_history_str for chat history
# 4. use examples_str for examples
# 5. use tools_str for tools definition (or you can directly pass in model_kwargs as "tools")
# 6. use output_format_str for output format
# 7. use input_format_str for input format
# 8. use task_desc_str for task description

"""This is the default system prompt template used in the AdalFlow.

Use :ref:`Prompt <core-prompt_builder>` class  to manage it.
"""

```

### Core Architecture Module: `adalflow/adalflow/core/embedder.py`
```
r"""The component that orchestrates model client (Embedding models in particular) and output processors."""

from typing import Optional, Any, Dict, List
import logging
from tqdm import tqdm

from adalflow.core.types import ModelType, EmbedderOutput
from adalflow.core.model_client import ModelClient
from adalflow.core.types import (
    EmbedderOutputType,
    EmbedderInputType,
    BatchEmbedderInputType,
    BatchEmbedderOutputType,
)
from adalflow.core.component import DataComponent
import adalflow.core.functional as F

__all__ = ["Embedder", "BatchEmbedder"]

log = logging.getLogger(__name__)


class Embedder(DataComponent):
    r"""
    A user-facing component that orchestrates an embedder model via the model client and output processors.

    Args:
        model_client (ModelClient): The model client to use for the embedder.
        model_kwargs (Dict[str, Any], optional): The model kwargs to pass to the model client. Defaults to {}.
        output_processors (Optional[Component], optional): The output processors after model call. Defaults to None.
            If you want to add further processing, it should operate on the ``EmbedderOutput`` data type.

    input: a single str or a list of str. When a list is used, the list is processed as a batch of inputs in the model client.

    Note:
        - The ``output_processors`` will be applied only on the data field of ``EmbedderOutput``, which is a list of ``Embedding``.
        - Use ``BatchEmbedder`` for automatically batching input of large size, larger than 100.
    """

    model_type: ModelType = ModelType.EMBEDDER
    model_client: ModelClient
    output_processors: Optional[DataComponent]

    def __init__(
        self,
        *,
        model_client: ModelClient,
        model_kwargs: Dict[str, Any] = {},
        output_processors: Optional[DataComponent] = None,
    ) -> None:

        super().__init__(model_kwargs=model_kwargs)
        if not isinstance(model_kwargs, Dict):
            raise TypeError(
                f"{type(self).__name__} requires a dictionary for model_kwargs, not a string"
            )
        self.model_kwargs = model_kwargs.copy()

        if not isinstance(model_client, ModelClient):
            raise TypeError(
                f"{type(self).__name__} requires a ModelClient instance for model_client, please pass it as OpenAIClient() or GroqAPIClient() for example."
            )
        self.model_client = model_client
        self.output_processors = output_processors

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "Embedder":
        """Create an Embedder from a configuration dictionary.

        Example:

        .. code-block:: python

            embedder_config =  {
                "model_client": {
                    "component_name": "OpenAIClient",
                    "component_config": {}
                },
                "model_kwargs": {
                    "model": "text-embedding-3-small",
                    "dimensions": 256,
                    "encoding_format": "float"
                }
            }

            embedder = Embedder.from_config(embedder_config)
        """
        if "model_client" not in config:
            raise ValueError("model_client is required in the config")
        return super().from_config(config)

    def _compose_model_kwargs(self, **model_kwargs) -> Dict[str, object]:
        r"""Add new arguments or overwrite existing arguments in the model_kwargs."""
        return F.compose_model_kwargs(self.model_kwargs, model_kwargs)

    def _pre_call(
        self, input: EmbedderInputType, model_kwargs: Optional[Dict] = {}
    ) -> Dict:
        # step 1: combine the model_kwargs with the default model_kwargs
        composed_model_kwargs = self._compose_model_kwargs(**model_kwargs)
        # step 2: convert the input to the api_kwargs
        api_kwargs = self.model_client.convert_inputs_to_api_kwargs(
            input=input,
            model_kwargs=composed_model_kwargs,
            model_type=self.model_type,
        )
        log.debug(f"api_kwargs: {api_kwargs}")
        return api_kwargs

    def _post_call(self, response: Any) -> EmbedderOutputType:
        r"""Get float list response and process it with output_processor"""
        try:
            embedding_output: EmbedderOutputType = (
                self.model_client.parse_embedding_response(response)
            )
        except Exception as e:
            log.error(f"Error parsing the embedding {e} : {response}")
            return EmbedderOutput(raw_response=str(response), error=str(e))
        output: EmbedderOutputType = EmbedderOutputType(raw_response=embedding_output)
        # data = embedding_output.data
        if self.output_processors:
            try:
                embedding_output = self.output_processors(embedding_output)
                output.data = embedding_output
            except Exception as e:
                log.error(f"Error processing the output: {e}")
                output.error = str(e)
        else:
            output.data = embedding_output.data

        return output

    def call(
        self,
        input: EmbedderInputType,
        model_kwargs: Optional[Dict] = {},
    ) -> EmbedderOutputType:
        log.debug(f"Calling {self.__class__.__name__} with input: {input}")
        api_kwargs = self._pre_call(input=input, model_kwargs=model_kwargs)
        output: EmbedderOutputType = None
        response = None
        try:
            response = self.model_client.call(
                api_kwargs=api_kwargs, model_type=self.model_type
            )
        except Exception as e:
            log.error(f"Error calling the model: {e}")
            output = EmbedderOutput(error=str(e))

        if response:
            try:
                output = self._post_call(response)
            except Exception as e:
                log.error(f"Error processing output: {e}")
                output = EmbedderOutput(raw_response=str(response), error=str(e))

        # add back the input
        output.input = [input] if isinstance(input, str) else input
        log.debug(f"Output from {self.__class__.__name__}: {output}")
        return output

    async def acall(
        self,
        input: EmbedderInputType,
        model_kwargs: Optional[Dict] = {},
    ) -> EmbedderOutputType:
        log.debug(f"Calling {self.__class__.__name__} with input: {input}")
        api_kwargs = self._pre_call(input=input, model_kwargs=model_kwargs)
        output: EmbedderOutputType = None
        response = None
        try:
            response = await self.model_client.acall(
                api_kwargs=api_kwargs, model_type=self.model_type
            )
        except Exception as e:
            log.error(f"Error calling the model: {e}")
            output = EmbedderOutput(error=str(e))

        if response:
            try:
                output = self._post_call(response)
            except Exception as e:
                log.error(f"Error processing output: {e}")
                output = EmbedderOutput(raw_response=str(response), error=str(e))
        # add back the input
        output.input = [input] if isinstance(input, str) else input
        log.debug(f"Output from {self.__class__.__name__}: {output}")
        return output

    def _extra_repr(self) -> str:
        s = f"model_kwargs={self.model_kwargs}, "
        return s


class BatchEmbedder(DataComponent):
    __doc__ = r"""Adds batching to the embedder component.

    Args:
        embedder (Embedder): The embedder to use for batching.
        batch_size (int, optional): The batch size to use for batching. Defaults to 100.
    """

    def __init__(self, embedder: Embedder, batch_size: int = 100) -> None:
        super().__init__(batch_size=batch_size)
        self.embedder = embedder
        self.batch_size = batch_size

    def call(
        self, input: BatchEmbedderInputType, model_kwargs: Optional[Dict] = {}
    ) -> BatchEmbedderOutputType:
        r"""Call the embedder with batching.

        Args:
            input (BatchEmbedderInputType): The input to the embedder. Use this when you have a large input that needs to be batched. Also ensure
            the output can fit into memory.
            model_kwargs (Optional[Dict], optional): The model kwargs to pass to the embedder. Defaults to {}.

        Returns:
            BatchEmbedderOutputType: The output from the embedder.
        """

        if isinstance(input, str):
            input = [input]
        n = len(input)
        embeddings: List[EmbedderOutputType] = []
        for i in tqdm(
            range(0, n, self.batch_size),
            desc="Batch embedding documents",
        ):
            batch_input = input[i : i + self.batch_size]
            batch_output = self.embedder.call(
                input=batch_input, model_kwargs=model_kwargs
            )
            embeddings.append(batch_output)
        return embeddings

```

### Core Architecture Module: `adalflow/adalflow/core/func_tool.py`
```
"""
Tool is LLM's extended capability which is one of the core design pattern of Agent. All tools can be wrapped in a FunctionTool class.
This helps to standardize the tool interface and metadata to communicate with the Agent.
"""

from typing import Any, Optional, Callable, Awaitable, Union
from inspect import ismethod
import inspect
import logging
import asyncio
import nest_asyncio
from enum import Enum, auto


from adalflow.core.types import (
    FunctionDefinition,
    FunctionOutput,
    Function,
)
from adalflow.core import Component
from adalflow.optim.parameter import Parameter
from adalflow.optim.grad_component import FunGradComponent
from adalflow.core.functional import (
    get_fun_schema,
)
from adalflow.utils import printc
from inspect import signature

AsyncCallable = Callable[..., Awaitable[Any]]

log = logging.getLogger(__name__)


def is_running_in_event_loop() -> bool:
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            return True
        else:
            return False
    except RuntimeError:
        return False


def find_instance_name_from_self(instance):
    """
    Attempt to find the variable name of the instance in the calling context.

    :param instance: The instance to find the name for.
    :return: The variable name of the instance, if found; otherwise, None.
    """
    # Inspect the calling stack frame
    frame = inspect.stack()[2].frame
    for var_name, var_obj in frame.f_locals.items():
        if var_obj is instance:
            return var_name
    return None


# Specific function types supported by FunctionTool:
# - Regular functions (sync/async)
# - Generator functions (sync/async)
# - Bound methods (class methods)
# - FunGradComponent instances (trainable components)


class FunctionType(Enum):
    """Enumeration of the 4 core function types supported by FunctionTool."""

    SYNC = auto()  # Regular sync function: def func(): return value
    ASYNC = auto()  # Async function: async def func(): return value
    SYNC_GENERATOR = auto()  # Sync generator: def func(): yield value
    ASYNC_GENERATOR = auto()  # Async generator: async def func(): yield value


# TODO: Add a wrapper to add **kwargs at the end of each function
class FunctionTool(Component):
    __doc__ = r"""Describing and Parsing(to LLM) and executing a function.

    Supports both normal callable functions and class methods.
    When component is used, we support both the training and eval mode.

    Note:

        When the eval mode, it outputs FunctionOutput, and when the training mode, it outputs Parameter with data as FunctionOutput.

    Args:
        fn (Callable): The function to be executed.
        definition (FunctionDefinition, optional): The definition of the function. Defaults to None.


    Function be used by LLM as a tool to achieve a specific task.

    What function can you pass as a tool?
    1. Any unbound function you wrote outside of a class.
    2. Any class method you wrote in your component. It can call `self` and other methods inside of your component.
    3. When the function is using a trainable component, and you can directly use the component's method as a tool or wrap it in a function. But you need to make sure to pass the component to the tool.

    Here are some examples:

    .. code-block:: python

        from adalflow.core.func_tool import FunctionTool
        class AgenticRAG(Component):
            def __init__(self, ...):
                super().__init__()
                self.retriever = Retriever()
                self.llm = Generator()

                def retriever_as_tool(input: str) -> str:
                    r"Used as a retriever tool."
                    return self.retriever(input)

                tools = [FunctionTool(retriever_as_tool, component=self.retriever),
                            FunctionTool(self.llm.__call__, component=self.llm)]
                # if you have trainable component, this will ensure it can be trained together with your whole task pipeline
                # if you dont want to train them and simply treating them as a tool, you can call like this
                # tools = [FunctionTool(retriever_as_tool), FunctionTool(self.llm.__call__, component=self.llm)]

    Features:

    - Supports both synchronous and asynchronous functions via `call` and `acall`.
    - Creates a `FunctionDefinition` from the function using `get_fun_schema`.
    - Executes the function with arguments.
        - Parses the function call expression (`FunctionExpression`) into `Function` (name, args, kwargs).
        - Executes the function using one of the following methods:
            - Via `call` with args and kwargs.
            - Via `eval`, without any context or sandboxing.
            - Via sandboxed execution directly using `sandbox_exec`.

    A FunctionTool allows other GradComponent(as a tool) to pass through correctly.
    """

    # key attributes:
    fn: Callable
    definition: FunctionDefinition
    function_type: FunctionType

    # it inherits the training attribute from Component
    def __init__(
        self,
        fn: Union[Callable, FunGradComponent],
        definition: Optional[FunctionDefinition] = None,
        require_approval: bool = False,
        pre_execute_callback: Optional[Callable] = None,
    ):
        super().__init__(
            name="FunctionTool", desc="A component calls and executes a function."
        )
        nest_asyncio.apply()
        assert fn is not None, "fn must be provided"

        # TODO: support FunGradComponent later.

        self.fn = fn
        self.require_approval = require_approval
        self.pre_execute_callback = pre_execute_callback # executed before the function is called, often useful for generating confirmation logics to the user
        self.function_type = self.detect_function_type(fn)
        self._is_async = self.function_type in [
            FunctionType.ASYNC,
            FunctionType.ASYNC_GENERATOR,
        ]
        self.class_instance = self._autodetect_class_instance(fn)
        if isinstance(fn, FunGradComponent):
            print(f"FunctionTool: {fn} is a component")
            self.definition = (
                definition or self._create_fn_definition_for_grad_component(fn)
            )
        else:
            self.definition = definition or self._create_fn_definition()
        if self._is_async:
            log.info(f"FunctionTool: {fn} is async: {self._is_async}")

    @classmethod
    def detect_function_type(cls, fn: Callable) -> FunctionType:
        """
        Detect the function type of a given callable.

        Args:
            fn: The callable to analyze

        Returns:
            FunctionType: The detected function type

        Raises:
            ValueError: If the function type cannot be determined or is not supported
        """
        if fn is None:
            raise ValueError("Function cannot be None")

        # Check for async generator functions
        if inspect.isasyncgenfunction(fn):
            return FunctionType.ASYNC_GENERATOR

        # Check for sync generator functions
        if inspect.isgeneratorfunction(fn):
            return FunctionType.SYNC_GENERATOR

        # Check for async functions (coroutines)
        if inspect.iscoroutinefunction(fn):
            return FunctionType.ASYNC

        # Check for regular functions
        if inspect.isfunction(fn) or inspect.ismethod(fn):
            return FunctionType.SYNC

        # Check for callable objects (like classes with __call__)
        if callable(fn):
            # For callable objects, we need to check their __call__ method
            if hasattr(fn, "__call__"):
                call_method = fn.__call__
                if inspect.ismethod(call_method):
                    # It's a bound method, check the underlying function
                    if inspect.isasyncgenfunction(call_method.__func__):
                        return FunctionType.ASYNC_GENERATOR
                    elif inspect.isgeneratorfunction(call_method.__func__):
                        return FunctionType.SYNC_GENERATOR
                    elif inspect.iscoroutinefunction(call_method.__func__):
                        return FunctionType.ASYNC
                    else:
                        return FunctionType.SYNC
                else:
                    # It's a function, check directly
                    if inspect.isasyncgenfunction(call_method):
                        return FunctionType.ASYNC_GENERATOR
                    elif inspect.isgeneratorfunction(call_method):
                        return FunctionType.SYNC_GENERATOR
                    elif inspect.iscoroutinefunction(call_method):
                        return FunctionType.ASYNC
                    else:
                        return FunctionType.SYNC

        raise ValueError(f"Cannot determine function type for {fn}")

    def _create_fn_definition_for_grad_component(
        self, fn: FunGradComponent
    ) -> FunctionDefinition:
        name = fn.fun_name
        docstring = fn.doc_string
        signature_str = str(signature(fn.fun))
        cls_name = None
        if ismethod(fn.fun):
            cls_name = fn.fun.__self__.__class__.__name__

        name = cls_name + "_" + name if cls_name else name
        return FunctionDefinition(
            func_name=name,
            func_desc=(
                f"{name}{signature_str}\nDocstring:{docstring}"
                if isinstance(docstring, str)
                else f"{name}{signature_str}\nDocstring:{docstring.data}"
            ),
            func_parameters=get_fun_schema(name, fn.fun),
        )

    def _autodetect_class_instance(self, fn: Callable) -> Optional[Any]:
        if ismethod(fn):
            return fn.__self__
        return None

    def _create_fn_definition(self) -> FunctionDefinition:

        name = self.fn.__name__
        docstring = self.fn.__doc__
        signature_str = str(signature(self.fn))

  
```

### Core Architecture Module: `adalflow/adalflow/core/functional.py`
```
"""Functional interface.
Core functions we use to build across the components.
Users can leverage these functions to customize their own components."""

from typing import (
    Dict,
    Any,
    Callable,
    Union,
    List,
    Tuple,
    Optional,
    Type,
    get_type_hints,
    get_origin,
    get_args,
    Set,
    Sequence,
    TypeVar,
)
import logging
import numpy as np
from enum import Enum
import re
import json
import yaml
import ast
import threading
import base64

from inspect import signature, Parameter
from dataclasses import fields, is_dataclass, MISSING, Field

from pydantic import BaseModel
from pydantic.dataclasses import is_pydantic_dataclass

log = logging.getLogger(__name__)

ExcludeType = Optional[Dict[str, List[str]]]
T_co = TypeVar("T_co", covariant=True)


########################################################################################
# For Dataclass base class and all schema related functions
########################################################################################


def custom_asdict(
    obj, *, dict_factory=dict, exclude: ExcludeType = None
) -> Dict[str, Any]:
    """Equivalent to asdict() from dataclasses module but with exclude fields.

    Return the fields of a dataclass instance as a new dictionary mapping
    field names to field values, while allowing certain fields to be excluded.

    If given, 'dict_factory' will be used instead of built-in dict.
    The function applies recursively to field values that are
    dataclass instances. This will also look into built-in containers:
    tuples, lists, and dicts.
    """
    if not is_dataclass_instance(obj):
        raise TypeError("custom_asdict() should be called on dataclass instances")
    return _asdict_inner(obj, dict_factory, exclude or {})


def _asdict_inner(obj, dict_factory, exclude):
    if is_dataclass_instance(obj):
        result = []
        for f in fields(obj):
            if f.name in exclude.get(obj.__class__.__name__, []):
                continue
            value = _asdict_inner(getattr(obj, f.name), dict_factory, exclude)
            result.append((f.name, value))
        return dict_factory(result)
    elif isinstance(obj, tuple) and hasattr(obj, "_fields"):
        return type(obj)(*[_asdict_inner(v, dict_factory, exclude) for v in obj])
    elif isinstance(obj, (list, tuple)):
        return type(obj)(_asdict_inner(v, dict_factory, exclude) for v in obj)
    elif isinstance(obj, dict):
        return type(obj)(
            (
                _asdict_inner(k, dict_factory, exclude),
                _asdict_inner(v, dict_factory, exclude),
            )
            for k, v in obj.items()
        )
    else:
        return obj
        # return deepcopy(obj)


# def dataclass_obj_to_dict(
#     obj: Any, exclude: ExcludeType = None, parent_key: str = ""
# ) -> Dict[str, Any]:
#     r"""Convert a dataclass object to a dictionary With exclude fields.

#     Equivalent to asdict() from dataclasses module but with exclude fields.

#     Supports nested dataclasses, lists, and dictionaries.
#     Allow exclude keys for each dataclass object.
#     Example:

#     .. code-block:: python

#        from dataclasses import dataclass
#        from typing import List

#        @dataclass
#        class TrecData:
#            question: str
#            label: int

#        @dataclass
#        class TrecDataList:

#            data: List[TrecData]
#            name: str

#        trec_data = TrecData(question="What is the capital of France?", label=0)
#        trec_data_list = TrecDataList(data=[trec_data], name="trec_data_list")

#        dataclass_obj_to_dict(trec_data_list, exclude={"TrecData": ["label"], "TrecDataList": ["name"]})

#        # Output:
#        # {'data': [{'question': 'What is the capital of France?'}]}

#     """
#     if not is_dataclass_instance(obj):
#         raise ValueError(
#             f"dataclass_obj_to_dict() should be called with a dataclass instance."
#         )
#     if exclude is None:
#         exclude = {}

#     obj_class_name = obj.__class__.__name__
#     current_exclude = exclude.get(obj_class_name, [])

#     if hasattr(obj, "__dataclass_fields__"):
#         return {
#             key: dataclass_obj_to_dict(value, exclude, parent_key=key)
#             for key, value in obj.__dict__.items()
#             if key not in current_exclude
#         }
#     elif isinstance(obj, list):


#         return [dataclass_obj_to_dict(item, exclude, parent_key) for item in obj]
#     elif isinstance(obj, set):
#         return {dataclass_obj_to_dict(item, exclude, parent_key) for item in obj}
#     elif isinstance(obj, tuple):
#         return (dataclass_obj_to_dict(item, exclude, parent_key) for item in obj)
#     elif isinstance(obj, dict):
#         return {
#             key: dataclass_obj_to_dict(value, exclude, parent_key)
#             for key, value in obj.items()
#         }
#     else:
#         return deepcopy(obj)
def validate_data(data: Dict[str, Any], fieldtypes: Dict[str, Any]) -> bool:
    required_fields = {
        name for name, type in fieldtypes.items() if _is_required_field(type)
    }
    return required_fields <= data.keys()


def is_potential_dataclass(t):
    """Check if the type is directly a dataclass or potentially a wrapped dataclass like Optional."""
    origin = get_origin(t)
    if origin is Union:
        # This checks if any of the arguments in a Union (which is what Optional is) is a dataclass
        return any(is_dataclass(arg) for arg in get_args(t) if arg is not type(None))
    return is_dataclass(t)


def extract_dataclass_type(type_hint):
    """Extract the actual dataclass type from a type hint that could be Optional or other generic."""
    origin = get_origin(type_hint)
    if origin in (Union, Optional):
        # Unpack Optional[SomeClass] or Union[SomeClass, None]
        args = get_args(type_hint)
        for arg in args:
            if arg is not type(None) and is_dataclass(arg):
                return arg
    return type_hint if is_dataclass(type_hint) else None


def check_data_class_field_args_zero(cls):
    """Check if the field is a dataclass."""
    return (
        hasattr(cls, "__args__")
        and len(cls.__args__) > 0
        and cls.__args__[0]
        and hasattr(cls.__args__[0], "__dataclass_fields__")
    )


def check_if_class_field_args_zero_exists(cls):
    """Check if the field is a dataclass."""
    return hasattr(cls, "__args__") and len(cls.__args__) > 0 and cls.__args__[0]


def check_data_class_field_args_one(cls):
    """Check if the field is a dataclass."""
    return (
        hasattr(cls, "__args__")
        and len(cls.__args__) > 1
        and cls.__args__[1]
        and hasattr(cls.__args__[1], "__dataclass_fields__")
    )


def check_if_class_field_args_one_exists(cls):
    """Check if the field is a dataclass."""
    return hasattr(cls, "__args__") and len(cls.__args__) > 1 and cls.__args__[1]


def dataclass_obj_from_dict(cls: Type[object], data: Dict[str, object]) -> Any:
    r"""Convert a dictionary to a dataclass object.

    Supports nested dataclasses, lists, and dictionaries.

    .. note::
        If any required field is missing, it will raise an error.
        Do not use the dict that has excluded required fields.

    Example:

    .. code-block:: python

       from dataclasses import dataclass
       from typing import List

       @dataclass
       class TrecData:
           question: str
           label: int

       @dataclass
       class TrecDataList:

           data: List[TrecData]
           name: str

       trec_data_dict = {"data": [{"question": "What is the capital of France?", "label": 0}], "name": "trec_data_list"}

       dataclass_obj_from_dict(TrecDataList, trec_data_dict)

       # Output:
       # TrecDataList(data=[TrecData(question='What is the capital of France?', label=0)], name='trec_data_list')

    """
    log.debug(f"Dataclass: {cls}, Data: {data}")
    if data is None:
        return None

    if is_dataclass(cls) or is_potential_dataclass(
        cls
    ):  # Optional[Address] will be false, and true for each check

        log.debug(
            f"{is_dataclass(cls)} of {cls}, {is_potential_dataclass(cls)} of {cls}"
        )
        # Ensure the data is a dictionary
        if not isinstance(data, dict):
            raise ValueError(
                f"Expected data of type dict for {cls}, but got {type(data).__name__}"
            )
        cls_type = extract_dataclass_type(cls)
        fieldtypes = {f.name: f.type for f in cls_type.__dataclass_fields__.values()}

        restored_data = cls_type(
            **{
                key: dataclass_obj_from_dict(fieldtypes[key], value)
                for key, value in data.items()
            }
        )
        return restored_data
    elif isinstance(data, (list, tuple)):
        log.debug(f"List or Tuple: {cls}, {data}")
        restored_data = []
        for item in data:
            if check_data_class_field_args_zero(cls):
                # restore the value to its dataclass type
                restored_data.append(dataclass_obj_from_dict(cls.__args__[0], item))

            elif check_if_class_field_args_zero_exists(cls):
                # Use the original data [Any]
                restored_data.append(dataclass_obj_from_dict(cls.__args__[0], item))

            else:
                restored_data.append(item)
        return restored_data

    elif isinstance(data, set):
        log.debug(f"Set: {cls}, {data}")
        restored_data = set()
        for item in data:
            if check_data_class_field_args_zero(cls):
                # restore the value to its dataclass type
                restored_data.add(dataclass_obj_from_dict(cls.__args__[0], item))
            elif check_if_class_field_args_zero_exists(cls):
                # Use the original data [Any]
                restored_data.add(dataclass_obj_from_dict(cls.__args__[0], item))

            else:
                
```

### Core Architecture Module: `adalflow/adalflow/core/generator.py`
```
"""Generator is a user-facing orchestration component with a simple and unified interface for LLM prediction.

It is a pipeline that consists of three subcomponents."""

import json
import re
import time
from pathlib import Path

from typing import Any, Dict, Optional, Union, Callable, Tuple, List, AsyncGenerator
from collections.abc import AsyncIterable
import logging
from dataclasses import dataclass, field

from openai.types.responses import ResponseCompletedEvent
from adalflow.core.tokenizer import Tokenizer


from adalflow.core.types import (
    ModelType,
    GeneratorOutput,
    GeneratorOutputType,
)
from adalflow.core.component import Component, DataComponent
from adalflow.optim.grad_component import GradComponent
from adalflow.core.base_data_class import DataClass


from adalflow.optim.parameter import (
    Parameter,
    OutputParameter,
)
from adalflow.optim.gradient import GradientContext, Gradient
from adalflow.optim.types import ParameterType

from adalflow.core.prompt_builder import Prompt
from adalflow.core.functional import compose_model_kwargs
from adalflow.core.model_client import ModelClient
from adalflow.core.default_prompt_template import DEFAULT_ADALFLOW_SYSTEM_PROMPT
from adalflow.optim.function import BackwardContext
from adalflow.utils.cache import CachedEngine
from adalflow.tracing.callback_manager import CallbackManager
from adalflow.tracing import generator_span
from adalflow.utils.global_config import get_adalflow_default_root_path
from adalflow.core.string_parser import JsonParser

from adalflow.optim.text_grad.backend_engine_prompt import (
    FEEDBACK_ENGINE_TEMPLATE,
    LLM_CONVERSATION_TEMPLATE,
    ALL_PRED_INFO,
    OUTPUT_INSTRUCTION,
    VARIABLE_AND_PEERS_INFO,
    CONVERSATION_START_INSTRUCTION_CHAIN,
    OBJECTIVE_INSTRUCTION_BASE,
    OBJECTIVE_INSTRUCTION_CHAIN,
)

__all__ = ["Generator", "BackwardEngine", "create_teacher_generator"]


log = logging.getLogger(__name__)


PromptArgType = Dict[str, Union[str, Parameter]]


@dataclass
class BackwardPassSetup(DataClass):
    all_pred_at_once: bool = field(
        default=False, metadata={"desc": "Backward all predecessors at once."}
    )
    threshold_score_to_compute_grad_for_errors: float = field(
        default=0.9,
        metadata={"desc": "Threshold score to compute gradient for errors."},
    )
    compute_grad_for_errors_only: bool = field(
        default=True, metadata={"desc": "Compute gradient for errors only."}
    )


# TODO: better debug mode
class Generator(GradComponent, CachedEngine, CallbackManager):
    __doc__ = """An user-facing orchestration component for LLM prediction.

    It is also a GradComponent that can be used for backpropagation through the LLM model.

    By orchestrating the following three components along with their required arguments,
    it enables any LLM prediction with required task output format.
    - Prompt
    - Model client
    - Output processors

    Args:
        model_client (ModelClient): The model client to use for the generator.
        model_kwargs (Dict[str, Any], optional): The model kwargs to pass to the model client. Defaults to {}. Please refer to :ref:`ModelClient<components-model_client>` for the details on how to set the model_kwargs for your specific model if it is from our library.
        model_type (ModelType, optional): The type of the model. Defaults to ModelType.LLM. When using reasoning models which calls different api, you should set it to ModelType.LLM_REASONING.
        template (Optional[str], optional): The template for the prompt.  Defaults to :ref:`DEFAULT_ADALFLOW_SYSTEM_PROMPT<core-default_prompt_template>`.
        prompt_kwargs (Optional[Dict], optional): The preset prompt kwargs to fill in the variables in the prompt. Defaults to None.
        output_processors (Optional[Component], optional):  The output processors after model call. It can be a single component or a chained component via ``Sequential``. Defaults to None.
        trainable_params (Optional[List[str]], optional): The list of trainable parameters. Defaults to [].

    Note:
        1. The output_processors will be applied to the string output of the model completion. And the result will be stored in the data field of the output.
        And we encourage you to only use it to parse the response to data format you will use later.
        2. For structured output, you should avoid using `stream` as the output_processors can only be run after all the data is available.
    """

    model_type: ModelType = ModelType.LLM
    model_client: ModelClient  # for better type checking

    _use_cache: bool = False
    _kwargs: Dict[str, Any] = (
        {}
    )  # to create teacher generator from student TODO: might reaccess this

    backward_pass_setup: BackwardPassSetup = (
        BackwardPassSetup()
    )  # default setup for the backward pass

    def __init__(
        self,
        *,
        # args for the model
        model_client: ModelClient,  # will be intialized in the main script
        model_kwargs: PromptArgType = {},
        model_type: Optional[ModelType] = ModelType.LLM,
        # args for the prompt
        template: Optional[str] = None,
        prompt_kwargs: Optional[Dict] = {},
        # args for the output processing
        output_processors: Optional[DataComponent] = None,
        name: Optional[str] = None,
        # args for the cache
        cache_path: Optional[str] = None,
        use_cache: bool = True,
    ) -> None:
        r"""The default prompt is set to the DEFAULT_ADALFLOW_SYSTEM_PROMPT. It has the following variables:
        - task_desc_str
        - tools_str
        - example_str
        - chat_history_str
        - context_str
        - steps_str
        You can preset the prompt kwargs to fill in the variables in the prompt using prompt_kwargs.
        But you can replace the prompt and set any variables you want and use the prompt_kwargs to fill in the variables.
        """

        if not isinstance(model_client, ModelClient):
            raise TypeError(
                f"{type(self).__name__} requires a ModelClient instance for model_client, please pass it as OpenAIClient() or GroqAPIClient() for example.\
                    Got {model_client} instead."
            )

        template = template or DEFAULT_ADALFLOW_SYSTEM_PROMPT

        # create the cache path and initialize the cache engine

        self.set_cache_path(
            cache_path, model_client, model_kwargs.get("model", "default")
        )

        CachedEngine.__init__(self, cache_path=self.cache_path)

        Component.__init__(self)
        GradComponent.__init__(self, desc="Generate a response using LLM model.")
        CallbackManager.__init__(self)

        self.name = name or self.__class__.__name__
        self.template = template
        self.prompt_kwargs = prompt_kwargs.copy()

        self.model_kwargs = model_kwargs.copy()
        # init the model client
        self.model_client = model_client
        self.model_type = model_type

        self.output_processors = output_processors

        if output_processors and (not isinstance(output_processors, DataComponent)):
            raise ValueError(
                f"output_processors should be a DataComponent instance, got {type(output_processors)}"
            )

        self.set_parameters(prompt_kwargs)

        # end of trainable parameters
        self.backward_engine: "BackwardEngine" = None
        log.info(f"Generator {self.name} initialized.")
        #  to support better testing on the parts beside of the model call
        self.mock_output: bool = False
        self.mock_output_data: str = "mock data"

        self._use_cache = use_cache

        self._kwargs = {
            "model_client": model_client,
            "model_kwargs": model_kwargs,
            "template": template,
            "prompt_kwargs": prompt_kwargs,
            "output_processors": output_processors,
            "name": name,
            "cache_path": cache_path,
            "use_cache": use_cache,
        }
        self._teacher: Optional["Generator"] = None
        self._trace_api_kwargs: Dict[str, Any] = (
            {}
        )  # used by dynamic computation graph and backpropagation

        self._tokenizer: Tokenizer = Tokenizer()
        self._estimated_token_count: int = 0

    @property
    def use_cache(self):
        return self._use_cache

    
    @property
    def estimated_token_count(self) -> int:
        """Property to access the estimated token count from the last prompt.
        
        Returns:
            int: The estimated token count from the last processed prompt.
                 Returns 0 if no prompt has been processed yet.
        """
        return self._estimated_token_count

    def update_default_backward_pass_setup(self, setup: BackwardPassSetup):
        self.backward_pass_setup = setup

    def set_cache_path(self, cache_path: str, model_client: object, model: str):
        """Set the cache path for the generator."""

        # Construct a valid model string using the client class name and model
        self.model_str = f"{model_client.__class__.__name__}_{model}"

        # Remove any characters that are not allowed in file names (cross-platform)
        # On Windows, characters like `:<>?/\|*` are prohibited.
        self.model_str = re.sub(r"[^a-zA-Z0-9_\-]", "_", self.model_str)

        _cache_path = (
            get_adalflow_default_root_path() if cache_path is None else cache_path
        )

        # Use pathlib to handle paths more safely across OS
        self.cache_path = Path(_cache_path) / f"cache_{self.model_str}.db"

        log.debug(f"Cache path set to: {self.cache_path}")

    def get_cache_path(self) -> str:
        r"""Get the cache path for the generator."""
        return self.cache_path

    @staticmethod
    def _get_default_mapping(
        output: "GeneratorOutput" = None,
    ) -> Tuple[Dict[str, Callable], List[str]]:

        if (
            output
```

### Core Architecture Module: `adalflow/adalflow/core/mcp_tool.py`
```
"""
MCP (Modular Command Protocol) Tools are function tools defined in a unified standard sharing with different models and services. They are served by an MCP server.

Features:
- The MCPFunctionTool class, which wraps MCP tools as FunctionTool instances for use in agent workflows.
- The MCPToolManager class, which manages multiple MCP server connections, loads server configurations from JSON, lists available resources/tools/prompts, and provides all tools as FunctionTool instances.

The module enables dynamic discovery and invocation of MCP tools for agent-based workflows.
"""

import os
import json
import asyncio
from datetime import timedelta
from pathlib import Path
from typing import Optional, Union
from adalflow.core.func_tool import FunctionTool
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client
from contextlib import asynccontextmanager
import logging
from typing import List, Any, Literal
from dataclasses import dataclass, field

from adalflow.core.component import Component
from adalflow.utils.logger import printc
from adalflow.core.types import FunctionDefinition, FunctionOutput, Function

log = logging.getLogger(__name__)


@dataclass
class MCPServerStdioParams:
    r"""Mirrors `mcp.client.stdio.StdioServerParameters`, but lets you pass params without another import."""

    command: str = field(
        metadata={
            "desc": "The executable to run to start the server. For example, `python` or `node`."
        }
    )
    args: Optional[list[str]] = field(
        default=None,
        metadata={
            "desc": "Command line args to pass to the `command` executable. For example, `['foo.py']` or `['server.js', '--port', '8080']`."
        },
    )
    env: Optional[dict[str, str]] = field(
        default=None,
        metadata={"desc": "The environment variables to set for the server."},
    )
    cwd: Optional[Union[str, Path]] = field(
        default=None,
        metadata={"desc": "The working directory to use when spawning the process."},
    )
    encoding: Optional[str] = field(
        default="utf-8",
        metadata={
            "desc": "The text encoding used when sending/receiving messages to the server. Defaults to `utf-8`."
        },
    )
    encoding_error_handler: Optional[Literal["strict", "ignore", "replace"]] = field(
        default="strict",
        metadata={
            "desc": "The text encoding error handler. Defaults to `strict`. See https://docs.python.org/3/library/codecs.html#codec-base-classes for explanations of possible values."
        },
    )


@dataclass
class MCPServerSseParams:
    """
    Mirrors the params in `mcp.client.sse.sse_client`.
    """

    url: str = field(metadata={"desc": "The URL of the server."})
    headers: Optional[dict[str, str]] = field(
        default=None, metadata={"desc": "The headers to send to the server."}
    )
    timeout: Optional[float] = field(
        default=5,
        metadata={"desc": "The timeout for the HTTP request. Defaults to 5 seconds."},
    )
    sse_read_timeout: Optional[float] = field(
        default=60 * 5,
        metadata={
            "desc": "The timeout for the SSE connection, in seconds. Defaults to 5 minutes."
        },
    )


@dataclass
class MCPServerStreamableHttpParams:
    """
    Mirrors the params in `mcp.client.streamable_http.streamablehttp_client`.
    """

    url: str = field(metadata={"desc": "The URL of the server."})
    headers: Optional[dict[str, str]] = field(
        default=None, metadata={"desc": "The headers to send to the server."}
    )
    timeout: Optional[timedelta] = field(
        default=timedelta(seconds=30),
        metadata={"desc": "The timeout for the HTTP request. Defaults to 30 seconds."},
    )
    sse_read_timeout: Optional[timedelta] = field(
        default=timedelta(seconds=60 * 5),
        metadata={
            "desc": "The timeout for the SSE connection, in seconds. Defaults to 5 minutes."
        },
    )
    terminate_on_close: Optional[bool] = field(
        default=True, metadata={"desc": "Terminate on close"}
    )


MCPServerParameters = Union[
    MCPServerStdioParams, MCPServerSseParams, MCPServerStreamableHttpParams
]


# NOTE: mcp_session_context only works with one server at a time.
@asynccontextmanager
async def mcp_session_context(
    server_params: MCPServerParameters,
    name: Optional[str] = None,
):
    """
    Asynchronous context manager for establishing an MCP (Modular Communication Protocol) session.

    Depending on the type of `server_params`, this function initializes a connection to an MCP server
    either via standard I/O or HTTP streaming, and yields an initialized `ClientSession` object.

    Args:
        server_params (MCPServerParameters): Parameters for connecting to the MCP server.
            - If an instance of `StdioServerParameters`, connects via standard I/O.
            - If a string (interpreted as a URL), connects via HTTP streaming.

    Yields:
        ClientSession: An initialized client session for communicating with the MCP server.

    Raises:
        ValueError: If `server_params` is not a supported type.
    """
    msg = (
        f"📡 Initializing connection to {name}..."
        if name
        else "📡 Initializing connection..."
    )

    if isinstance(server_params, MCPServerStdioParams):
        async with stdio_client(
            StdioServerParameters(
                command=server_params.command,
                args=server_params.args,
                env=server_params.env,
                cwd=server_params.cwd,
                encoding=server_params.encoding,
                encoding_error_handler=server_params.encoding_error_handler,
            )
        ) as (read, write):
            async with ClientSession(read, write) as session:
                printc(msg, color="magenta")
                await session.initialize()
                printc("✅ Connection established!", color="magenta")
                yield session
    elif isinstance(server_params, MCPServerStreamableHttpParams):  # URL
        async with streamablehttp_client(
            url=server_params.url,
            headers=server_params.headers,
            timeout=server_params.timeout,
            sse_read_timeout=server_params.sse_read_timeout,
            terminate_on_close=server_params.terminate_on_close,
        ) as (read, write, _):
            async with ClientSession(read, write) as session:

                printc(msg, color="magenta")
                await session.initialize()
                printc("✅ Connection established!", color="magenta")
                yield session
    elif isinstance(server_params, MCPServerSseParams):  # URL
        async with sse_client(
            url=server_params.url,
            headers=server_params.headers,
            timeout=server_params.timeout,
            sse_read_timeout=server_params.sse_read_timeout,
        ) as (read, write, _):
            async with ClientSession(read, write) as session:
                printc(msg, color="magenta")
                await session.initialize()
                printc("✅ Connection established!", color="magenta")
                yield session
    else:
        raise ValueError(
            f"Unsupported server parameters type. Must be one of MCPServerStdioParams, MCPServerSseParams, MCPServerStreamableHttpParams. But got {type(server_params)}"
        )


async def execute_mcp_op(
    server_params: MCPServerParameters, tool_name: str, id=None, **params: dict
) -> str:
    """
    Executes an operation using a specified MCP tool within a new client session.

    Args:
        server_params (MCPServerParameters): Parameters required to connect to the MCP server.
        tool_name (str): The name of the tool to execute.
        id (optional): An optional identifier for the operation.
        **params (dict): Additional parameters to pass to the tool.

    Returns:
        str: The textual result of the tool operation, or None if the operation failed.

    Raises:
        Exception: If an error occurs during the tool execution, it is caught and logged, but not re-raised.

    Side Effects:
        Prints the result of the tool operation or an error message to the console, with colored output for emphasis.

    Notes:
        - The function uses an asynchronous context manager to handle the MCP session lifecycle.
        - The result is expected to be accessible via `result.content[0].text`.
    """
    async with mcp_session_context(server_params) as session:
        try:
            result = await session.call_tool(tool_name, params)
            printc(f"{tool_name} {params} = {result.content[0].text}", color="magenta")
        except Exception as e:
            printc(f"❌ Error calling {tool_name} tool: {e}", color="magenta")
    return result.content[0].text if result else None


class MCPFunctionTool(FunctionTool):
    __doc__ = r"""A FunctionTool wrapper for MCP (Modular Command Protocol) tools.

    MCPFunctionTool enables seamless integration of MCP tools into agent workflows by exposing them as FunctionTool instances.
    It automatically translates the `mcp.types.Tool` into a `FunctionTool`.
    It allows dynamic discovery, description, and invocation of MCP tools, making them accessible to LLM-based agents or pipelines.

    Note:

        Different from FunctionTool, MCPFunctionTool only supports `acall` since all
        tools are executed asynchronously in the MCP protocol.

    Args:
        server_params (MCPServerParameters): The parameters required to connect to the MCP server. Could be a mcp.StdioServerParameters instance or a URL string.
        mcp_tool (mcp.types.Tool): The MCP tool instance to be used by this function tool.

    Usage Example:

    .. code-block:: python

        from adalflow.core.mcp_tool import MCPFunctionTool, mcp_session_context, S
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #461** (2026-02-02): **Breaking change in tutorials/evaluation/eval_retriever.py**
  *Symptoms*: ### Bug description  ``` (base) zkw@MSI:/mnt/c/Side_Projects/AdalFlow$ python tutorials/evaluation/eval_retriever.py  MLflow not available. Install with: pip install mlflow Traceback (most recent call last):   File "/mnt/c/Side_Projects/AdalFlow/tutorials/evaluation/eval_retriever.py", line 1, in <module>     from adalflow.eval import RetrieverRecall ImportError: cannot import name 'RetrieverRecall' from 'adalflow.eval' (/home/zkw/miniconda3/lib/python3.13/site-packages/adalflow/eval/__init__.py) (base) zkw@MSI:/mnt/c/Side_Projects/AdalFlow$ ```  ### What version are you seeing the problem on?  ```python 1.1.3 ```  ### How to reproduce the bug  ```python (base) zkw@MSI:/mnt/c/Side_Projects/AdalFlow$ python tutorials/evaluation/eval_retriever.py ```  ### Error messages and logs  ``` (base) zkw@MSI:/mnt/c/Side_Projects/AdalFlow$ python tutorials/evaluation/eval_retriever.py  MLflow not available. Install with: pip install mlflow Traceback (most recent call last):   File "/mnt/c/Side_Projects/AdalFlow/tutorials/evaluation/eval_retriever.py", line 1, in <module>     from adalflow.eval import RetrieverRecall ImportError: cannot import name 'RetrieverRecall' from 'adalflow.eval' (/home/zkw/miniconda3/lib/python3.13/site-packages/adalflow/eval/__init__.py) (base) zkw@MSI:/mnt/c/Side_Projects/AdalFlow$ ```  ### Environment  - OS: [e.g., Linux, Windows, macOS]   ### More info  I've already fixed it, will create a PR
  **Post-Mortem & Fix Analysis**:
  > Fixed [Fix breaking change in tutorials/evaluation/eval_retriever.py #462](https://github.com/SylphAI-Inc/AdalFlow/pull/462)

- **Issue #381** (2025-03-08): **rag notebook bug**
  *Symptoms*: ### Bug description  im using https://github.com/SylphAI-Inc/AdalFlow/blob/main/notebooks/tutorials/adalflow_rag_playbook.ipynb this notebook n getting the error  ### What version are you seeing the problem on?  ```python latest version ```  ### How to reproduce the bug  ```python simply run the the above .ipynbfile ```  ### Error messages and logs  ``` --------------------------------------------------------------------------- TypeError                                 Traceback (most recent call last) [<ipython-input-14-042938033f5a>](https://localhost:8080/#) in <cell line: 0>()     179      180 # Prepare the database (only runs once) --> 181 prepare_database_with_index([doc1, doc2], index_file="index.faiss")     182      183 # Initialize RAG  1 frames [<ipython-input-14-042938033f5a>](https://localhost:8080/#) in prepare_database_with_index(docs, index_file, index_path)      53     db.load(docs)      54     data_transformer = prepare_data_pipeline() ---> 55     db.transform(transformer=data_transformer, key="data_transformer")      56     db.save_state(index_path)      57   [/usr/local/lib/python3.11/dist-packages/adalflow/core/db.py](https://localhost:8080/#) in transform(self, transformer, key, map_fn)     207         key_to_use = key     208         if transformer: --> 209             key = self.register_transformer(transformer, key, map_fn)     210             key_to_use = key     211         if key_to_use is None:  TypeError: LocalDB.register_transformer() takes 1 pos
  **Post-Mortem & Fix Analysis**:
  > Also if i wanted to change the retirver?  to pass any other retriver do we need to change this retriver part only? ```          self.retriever = FAISSRetriever(             **configs["retriever"],             embedder=embedder,             documents=self.transformed_docs,             document_map_func=lambda doc: doc.vector,         ) ```  any other changes need to do in the template? also give or provide a general RAG template which is real use case. n works for all . there is no any single real prodcution ready rag usecase in adaflow     
  > let me fix this issue 
  > I believe the pull request of https://github.com/SylphAI-Inc/AdalFlow/pull/376 resolves the first issue and the keyword-only argument enforcement has been removed. I believe self.retriever is the only one that needs to be modified before being passed into self.retriever_output_processors.   I could also help work on the real production usecase! Have you been making a PR? 

- **Issue #375** (2025-02-16): **RAG example shown in tutorial not wokring**
  *Symptoms*: ### Bug description  im getting this error as im trying to reprdcue the example which shown here   https://github.com/SylphAI-Inc/AdalFlow/blob/main/notebooks/tutorials/adalflow_rag_playbook.ipynb  ``` LocalDB.transform() takes 1 positional argument but 2 positional arguments   ```   ### What version are you seeing the problem on?  ```python Name: adalflow Version: 1.0.4 Summary: The Library to Build and Auto-optimize LLM Applications ```  ### How to reproduce the bug  ```python just run this notebook one by one  https://github.com/SylphAI-Inc/AdalFlow/blob/main/notebooks/tutorials/adalflow_rag_playbook.ipynb ```  ### Error messages and logs  ``` ```   ### Environment  - OS: [e.g., Linux, Windows, macOS]   ### More info  LocalDB.transform() takes 1 positional argument but 2 positional arguments  
  **Post-Mortem & Fix Analysis**:
  > also i wanted to implemet Lancedb as a rag .tool & build chatbot so how should i do it?  also whats use of local db? some vectordb dont need localdb right.then how that is handled? can you give me example for prodcutonal ready rag ? not a single showcase example in docs.so hard to reprdce this things . 
  > It seems that in version 1.0.4, LocalDB is not working due to enforcing of keyword-only arguments using asterisks. The following internal methods will lead to error: - `_get_transformer_name` - `register_transformer`  As for the `transform` method, @akashAD98 you will need to modify the notebook to specify the exact parameters like so:  ```python LocalDB().transform(transformer=<some transformer>, key=<some_key>, map_fn=<some_map_fn>) ```  However as stated above, you will still encounter similar errors anyways due to the other internal methods having keyword-only arguments.
  > @liyin2015 can you upload RAG example which will work for all v ectordb .not only faiss. as its saving the index . also when to use the localdb ?

- **Issue #358** (2025-02-06): **Examples and tutorials raise Subclasses must implement `forward` or `bicall` error**
  *Symptoms*: ### Bug description  Hi!  I'd really like to use the query optimizer, as seen mentioned on hacker news a few days ago.  The "[learn Adalflow in 15 minutes](https://adalflow.sylph.ai/get_started/adalflow_in_15mins.html)" raises an error, as does running this example: https://github.com/SylphAI-Inc/AdalFlow/blob/main/tutorials/task_pipeline.py  I'd highly recommend that you write some mocking tests to let you test your pipelines so that you avoid this. Happy to help.  ```python python .\ada.py GeneratorOutput(id='1', data=9, error=None, usage=CompletionUsage(completion_tokens=30, prompt_tokens=89, total_tokens=119), raw_response='You have a total of 9 musical instruments: flute, piano, trombone, violin, accordion, clarinet, drum, and trumpet.', metadata=None) Traceback (most recent call last):   File "C:\Users\thaarholt\repos\fastml\sources\dev\shared\pythonpackages\llms\ada.py", line 171, in <module>     output = task_pipeline(question, id="1")              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\Users\thaarholt\repos\fastml\sources\dev\shared\pythonpackages\llms\.venv\Lib\site-packages\adalflow\core\component.py", line 536, in __call__     output = self.forward(*args, **kwargs)              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\Users\thaarholt\repos\fastml\sources\dev\shared\pythonpackages\llms\.venv\Lib\site-packages\adalflow\core\component.py", line 483, in forward     raise NotImplementedError( NotImplementedError: Subclasses must implement `forward` or `bicall`. ```
  **Post-Mortem & Fix Analysis**:
  > @thomasaarholt This is due to api change, please refresh the new notebook. Changing call to bicall (used for both forward and call) would work.
  > Thanks. Replacing all `call` entries with `bicall` works.

- **Issue #357** (2025-02-10): **ValueError: output_processors should be a DataComponent instance, got <class 'adalflow.core.component.ParseIntegerAnswerComponent'>**
  *Symptoms*: ### Bug description  I am following the use cases for Question answering and got the above error.   ### What version are you seeing the problem on?  ```python I use adalflow '1.0.3' ```  ### How to reproduce the bug  ```python import re from adalflow.eval.answer_match_acc import AnswerMatchAcc from transformers import pipeline from adalflow.core.component import DataComponent from adalflow.optim.types import ParameterType  from adalflow.datasets.big_bench_hard import BigBenchHard from adalflow.utils.data import subset_dataset  def load_datasets(max_samples: int = None):     """Load the dataset"""     train_data = BigBenchHard(split="train")     val_data = BigBenchHard(split="val")     test_data = BigBenchHard(split="test")      # Limit the number of samples     if max_samples:         train_data = subset_dataset(train_data, max_samples)         val_data = subset_dataset(val_data, max_samples)         test_data = subset_dataset(test_data, max_samples)      return train_data, val_data, test_data  train_data, val_data, test_data = load_datasets(100)  # Wrap the function as a DataComponent @adal.func_to_component def parse_integer_answer(answer: str):     """Parses the last integer from a string using regular expressions."""     try:         # Use regular expression to find all sequences of digits         numbers = re.findall(r"\d+", answer)         if numbers:             # Get the last number found             answer = int(numbers[-1])         else:             answer = -1     
  **Post-Mortem & Fix Analysis**:
  > @Nuna7 Thanks for reporting.  Please refresh the notebook. We changed the api from @adal.fun_to_component to @adal.func_to_data_component 

- **Issue #325** (2025-02-06): **Cosine Similiarity To Probability Overflow problem**
  *Symptoms*: ### Bug description  For very large or small values outside the [-1, 1] expected range of values for the FAISS index function, there are overflow problems. They're best described here https://docs.google.com/document/d/1ILCbNgrD6ILjHDHZV1rh7eKa-QPIHQYujoDj7q3nQ7E/edit?tab=t.0   ### What version are you seeing the problem on?  ```python The current version ```  ### How to reproduce the bug  ```python Don't have concrete steps to reproduce at the moment, but you can simply hard code in D, ind = ...  such that you have very small values on the order of -1e+38 for the entries in D. Its more clear at the outlined process here, where it was originally discovered.  https://docs.google.com/document/d/1ILCbNgrD6ILjHDHZV1rh7eKa-QPIHQYujoDj7q3nQ7E/edit?tab=t.0#heading=h.5jxfwxowrs70 ```  ### Error messages and logs  Logs are in the attached images within this doc  https://docs.google.com/document/d/1ILCbNgrD6ILjHDHZV1rh7eKa-QPIHQYujoDj7q3nQ7E/edit?tab=t.0#heading=h.5jxfwxowrs70  ### Environment  - OS: [e.g., Linux, Windows, macOS]   ### More info  See https://docs.google.com/document/d/1ILCbNgrD6ILjHDHZV1rh7eKa-QPIHQYujoDj7q3nQ7E/edit?tab=t.0#heading=h.5jxfwxowrs70 for the more clear breakdown.
  **Post-Mortem & Fix Analysis**:
  > addressed

- **Issue #320** (2025-01-28): **Got SSLCertVerificationError when import GeneratorOutput**
  *Symptoms*: ### Bug description  When I import `GeneratorOutput`, I got the following error. This might due to my system environment, but import `GeneratorOutput` should not lead such kind of issue as I don't need to call `Tokenizer` in my code.   ``` Traceback (most recent call last):   File "/Users/jianfezhang/github/metadata-repo/data-discovery-exp/dde/llm/knowledge/glossary_term_extractor.py", line 4, in <module>     from adalflow import DataClassParser, GeneratorOutput   File "/Users/jianfezhang/github/metadata-repo/data-discovery-exp/.venv/lib/python3.11/site-packages/adalflow/__init__.py", line 67, in <module>     from adalflow.components.data_process.text_splitter import TextSplitter   File "/Users/jianfezhang/github/metadata-repo/data-discovery-exp/.venv/lib/python3.11/site-packages/adalflow/components/data_process/__init__.py", line 3, in <module>     from .text_splitter import TextSplitter   File "/Users/jianfezhang/github/metadata-repo/data-discovery-exp/.venv/lib/python3.11/site-packages/adalflow/components/data_process/text_splitter.py", line 46, in <module>     tokenizer = Tokenizer()                 ^^^^^^^^^^^   File "/Users/jianfezhang/github/metadata-repo/data-discovery-exp/.venv/lib/python3.11/site-packages/adalflow/core/tokenizer.py", line 25, in __init__     self.tokenizer = tiktoken.get_encoding(name)                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/jianfezhang/github/metadata-repo/data-discovery-exp/.venv/lib/python3.11/site-packages/tiktoken/regist

- **Issue #294** (2024-12-17): **TypeError: Client.__init__() got an unexpected keyword argument 'proxies' [Google Colab]**
  *Symptoms*: ### Bug description  `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`  In colab notebooks adalflow library's OpenAIClient still attempting to pass the proxies keyword argument during the initialization of the OpenAI client from the openai library. Newer versions of the openai library have removed the proxies argument from their Client.__init__ method. The problem is with the new version of the httpx library which openai and other clients use  **The solution** is downgrading httpx but doing just that causes dependency conflicts so what we need to do is update multiple packages and versions.   ### **Bug Hypothesis: Dependency Conflict Resolution in Different Environments**  **Observed Behavior:** - Local environment: Code works fine with:   - anyio 4.4.0   - httpx 0.27.0   - httpx-sse 0.4.0   - jupyter-server 2.14.2   - jupyter-server-terminals 0.5.2  - Colab environment: Code fails with dependency conflict requiring manual downgrade   - Error indicates jupyter-server 1.24.0 requiring anyio < 4.0  **Root Cause Analysis:** The core issue appears to be version mismatching between environments. While the local setup uses a newer jupyter-server (2.14.2) that's compatible with anyio 4.x, Colab is locked to an older jupyter-server version (1.24.0) that explicitly requires anyio < 4.0.  **Supporting Evidence:** 1. Local environment shows newer versions working harmoniously (jupyter-server 2.14.2) 2. Colab environment errors specific
  **Post-Mortem & Fix Analysis**:
  > Will start working on a PR for this 
  > fixed in https://github.com/SylphAI-Inc/AdalFlow/pull/308

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

### Incident Patch 1: `d8cfc093` (2026-05-27)
**Commit Message**: feat(benchmarks): add OpenEvolve-style research loop smoke benchmark

- Add ARC-Bench-style 5-topic smoke benchmark harness
- Add deterministic OpenEvolve-style research loop demo with optional LLM-backed seed/mutation/reflection/report components
- Add benchmark metrics/report generation and documentation
- Add simple AutoResearchClaw-style linear demo for comparison of control-flow shapes

Co-Authored-By: AdaL <[REDACTED_EMAIL]>

**File**: `benchmarks/README.md` (modified, +64/-1)
```diff
@@ -1,3 +1,66 @@
+# Benchmarks
+
 Benchmarking is an integral development part of the project.
 
-Contributors are encouraged to write benchmarks for their code, besides of the unit tests in `tests/` directory.
+Contributors are encouraged to write benchmarks for their code, in addition to unit tests in the `tests/` directory.
+
+## Available benchmark areas
+
+- `optimize_anything/` — GEPA / optimize-anything style benchmark scaffolds.
+- `arc_bench/` — ARC-Bench-style smoke benchmark harness for autonomous research-agent prototypes.
+
+## ARC-Bench-style smoke benchmark
+
+The `arc_bench/` benchmark is a lightweight, local smoke benchmark for testing AdalFlow research-agent orchestration patterns. It currently supports:
+
+1. A simple linear autonomous-research demo.
+2. An OpenEvolve-style evolutionary research loop demo.
+
+The evolutionary loop models:
+
+```text
+seed candidate
+→ mutate
+→ execute / repair
+→ evaluate
+→ reflect
+→ archive
+→ select best
+→ repeat
+→ final report
+```
+
+Run the deterministic evolution smoke benchmark:
+
+```bash
+python benchmarks/arc_bench/run_adalflow_smoke.py \
+  --mode evolution \
+  --max-iterations 5 \
+  --topics benchmarks/arc_bench/topics_smoke.jsonl \
+  --output artifacts/arc_bench/adalflow_evolution_smoke
+```
+
+Generate a Markdown report:
+
+```bash
+python benchmarks/arc_bench/report.py \
+  --input artifacts/arc_bench/adalflow_evolution_smoke \
+  --output artifacts/arc_bench/adalflow_evolution_smoke_report.md
+```
+
+Optional LLM-backed mode replaces the seed, mutation, reflection, and final report-writing components with AdalFlow `Generator` components while keeping execution and evaluation deterministic:
+
+```bash
+export OPENAI_API_KEY="..."
+
+python benchmarks/arc_bench/run_adalflow_smoke.py \
+  --mode evolution \
+  --use-llm \
+  --provider openai \
+  --model gpt-4o-mini \
+  --max-iterations 5 \
+  --topics benchmarks/arc_bench/topics_smoke.jsonl \
+  --output artifacts/arc_bench/adalflow_evolution_llm_smoke
+```
+
+> Note: this benchmark is not a verified comparison against AutoResearchClaw. A valid comparison requires running both systems on the same topics, model, hardware, timeout, budget, and scoring rubric.
```

**File**: `benchmarks/arc_bench/README.md` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+# ARC-Bench-style Smoke Benchmark
+
+This directory contains a lightweight ARC-Bench-style smoke benchmark for AdalFlow autonomous research-agent prototypes.
+
+It is designed to validate **agent control-flow shape** rather than claim external benchmark superiority. The current benchmark is local, deterministic by default, and safe to run without API keys.
+
+## Files
+
+- `topics_smoke.jsonl` — 5 ARC-Bench-style smoke topics:
+  - 2 machine learning topics
+  - 1 statistics topic
+  - 1 biology topic
+  - 1 quantum topic
+- `run_adalflow_smoke.py` — benchmark runner for AdalFlow research demos.
+- `metrics.py` — normalized per-topic metrics.
+- `report.py` — Markdown report generator.
+
+## Supported modes
+
+### 1. Simple mode
+
+Runs the original linear autonomous-research prototype:
+
+```text
+topic → literature → hypothesis → HITL gate → code repair → report status
+```
+
+Command:
+
+```bash
+python benchmarks/arc_bench/run_adalflow_smoke.py \
+  --mode simple \
+  --topics benchmarks/arc_bench/topics_smoke.jsonl \
+  --output artifacts/arc_bench/adalflow_simple_smoke
+```
+
+### 2. Evolution mode
+
+Runs the OpenEvolve-style research loop:
+
+```text
+seed candidate
+→ mutate
+→ execute / repair
+→ evaluate
+→ reflect
+→ archive
+→ select best
+→ repeat
+→ final report
+```
+
+Command:
+
+```bash
+python benchmarks/arc_bench/run_adalflow_smoke.py \
+  --mode evolution \
+  --max-iterations 5 \
+  --topics benchmarks/arc_bench/topics_smoke.jsonl \
+  --output artifacts/arc_bench/adalflow_evolution_smoke
+```
+
+Generate a report:
+
+```bash
+python benchmarks/arc_bench/report.py \
+  --input artifacts/arc_bench/adalflow_evolution_smoke \
+  --output artifacts/arc_bench/adalflow_evolution_smoke_report.md
+```
+
+## Optional LLM-backed mode
+
+Evolution mode can optionally replace the seed, mutation, reflection, and final report-writing steps with AdalFlow `Generator` components:
+
+```bash
+export OPENAI_API_KEY="..."
+
+python benchmarks/arc_bench/run_adalflow_smoke.py \
+  --mode evolution \
+  --use-llm \
+  --provider openai \
+  --model gpt-4o-mini \
+  --max-iterations 5 \
+  --topics benchmarks/arc_bench/topics_smoke.jsonl \
+  --output artifacts/arc_bench/adalflow_evolution_llm_smoke
+```
+
+Supported providers:
+
+- `openai`
+- `groq`
+- `anthropic`
+
+The executor and evaluator remain deterministic in this phase so that smoke benchmark metrics stay reproducible and safe.
+
+## Metrics
+
+The benchmark records one `metrics.json` per topic and one aggregate `summary.json`.
+
+For evolution mode, key metrics include:
+
+- `initial_score`
+- `best_score`
+- `score_improvement`
+- `num_candidates`
+- `retry_count`
+- `convergence_iteration`
+- `archive_size`
+- `artifact_completeness`
+
+Example output structure:
+
+```text
+artifacts/arc_bench/
+├── adalflow_evolution_smoke/
+│   ├── ml_001/
+│   │   ├── metrics.json
+│   │   └── result.json
+│   ├── ...
+│   └── summary.json
+└── adalflow_evolution_smoke_report.md
+```
+
+## Important limitation
+
+This is not a verified AdalFlow-vs-AutoResearchClaw benchmark.
+
+A fair external comparison requires:
+
+1. The same topic set.
+2. The same LLM model and decoding configuration.
+3. The same hardware and sandbox policy.
+4. The same timeout and cost budget.
+5. The same scoring rubric.
+6. Raw artifacts for both systems.
+
+The next step is to add an AutoResearchClaw runner that executes the same `topics_smoke.jsonl` file and emits the same normalized `metrics.json` schema.
```

**File**: `benchmarks/arc_bench/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""ARC-Bench smoke benchmark utilities for autonomous research agents."""
```

**File**: `benchmarks/arc_bench/metrics.py` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+"""Shared metrics for ARC-Bench smoke benchmark runs."""
+
+from __future__ import annotations
+
+from dataclasses import dataclass, asdict
+from typing import Any, Dict, Optional
+
+
+@dataclass
+class SmokeMetrics:
+    """Normalized per-topic benchmark metrics.
+
+    These metrics intentionally measure only the local smoke benchmark behavior.
+    They are not comparable to AutoResearchClaw's published ARC-Bench results
+    until both systems are run under the same environment and scoring rubric.
+    """
+
+    system: str
+    topic_id: str
+    domain: str
+    topic: str
+    completed: bool
+    stages_total: int
+    stages_completed: int
+    stage_completion_rate: float
+    retry_count: int
+    wall_time_sec: float
+    experiment_success: bool
+    paper_generated: bool
+    artifact_completeness: float
+    best_score: Optional[float] = None
+    initial_score: Optional[float] = None
+    score_improvement: Optional[float] = None
+    num_candidates: Optional[int] = None
+    convergence_iteration: Optional[int] = None
+    archive_size: Optional[int] = None
+    error: Optional[str] = None
+
+    def to_dict(self) -> Dict[str, Any]:
+        return asdict(self)
+
+
+def build_smoke_metrics(
+    *,
+    system: str,
+    topic_record: Dict[str, str],
+    result: Optional[Dict[str, Any]],
+    wall_time_sec: float,
+    error: Optional[str] = None,
+) -> SmokeMetrics:
+    """Convert a pipeline result into normalized smoke benchmark metrics."""
+
+    completed = error is None and bool(result)
+    experiment_metrics = result.get("experiment_metrics", {}) if result else {}
+    output_status = result.get("output_status", "") if result else ""
+
+    experiment_success = bool(experiment_metrics)
+    paper_generated = output_status.startswith("Successfully")
+
+    is_evolution_loop = "best_score" in experiment_metrics
+    if is_evolution_loop:
+        stages_total = 6
+        stages_completed = sum(
+            [
+                completed,
+                bool(result and result.get("hypothesis")),
+                bool(result and result.get("evolution_history")),
+                experiment_success,
+                bool(experiment_metrics.get("num_candidates", 0)),
+                paper_generated,
+            ]
+        )
+        retry_count = int(experiment_metrics.get("retry_count", 0))
+        artifacts = [
+            bool(result and result.get("hypothesis")),
+            bool(result and result.get("best_candidate")),
+            bool(result and result.get("evolution_history")),
+            experiment_success,
+            paper_generated,
+        ]
+    else:
+        # The simple demo models four coarse stage groups:
+        # literature, hypothesis/HITL, code execution/repair, paper status.
+        stages_total = 4
+        stages_completed = sum(
+            [
+                completed,
+                bool(result and result.get("hypothesis")),
+                experiment_success,
+                paper_generated,
+            ]
+        )
+        # The simple demo intentionally triggers one failed sandbox attempt and repairs it.
+        retry_count = 1 if experiment_success else 0
+        artifacts = [
+            bool(result and result.get("hypothesis")),
+            experiment_success,
+            paper_generated,
+        ]
+
+    artifact_completeness = sum(artifacts) / len(artifacts)
+
+    return SmokeMetrics(
+        system=system,
+        topic_id=topic_record["topic_id"],
+        domain=topic_record["domain"],
+        topic=topic_record["topic"],
+        completed=completed and stages_completed == stages_total,
+        stages_total=stages_total,
+        stages_completed=stages_completed,
+        stage_completion_rate=stages_completed / stages_total,
+        retry_count=retry_count,
+        wall_time_sec=wall_time_sec,
+        experiment_success=experiment_success,
+        paper_generated=paper_generated,
+        artifact_completeness=artifact_completeness,
+        best_score=experiment_metrics.get("best_score"),
+        initial_score=experiment_metrics.get("initial_score"),
+        score_improvement=experiment_metrics.get("score_improvement"),
+        num_candidates=experiment_metrics.get("num_candidates"),
+        convergence_iteration=experiment_metrics.get("convergence_iteration"),
+        archive_size=experiment_metrics.get("archive_size"),
+        error=error,
+    )
```

**File**: `benchmarks/arc_bench/report.py` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+"""Generate a Markdown report for ARC-Bench smoke benchmark outputs."""
+
+from __future__ import annotations
+
+import argparse
+import json
+from pathlib import Path
+from typing import Dict, List
+
+
+def load_json(path: Path) -> Dict:
+    return json.loads(path.read_text(encoding="utf-8"))
+
+
+def collect_metrics(input_dir: Path) -> List[Dict]:
+    return [load_json(path) for path in sorted(input_dir.glob("*/metrics.json"))]
+
+
+def _format_optional(value, fmt: str = ".4f") -> str:
+    if value is None:
+        return "-"
+    if isinstance(value, (int, float)):
+        return f"{value:{fmt}}"
+    return str(value)
+
+
+def render_report(input_dir: Path) -> str:
+    summary = load_json(input_dir / "summary.json")
+    rows = collect_metrics(input_dir)
+    has_evolution_metrics = any(row.get("best_score") is not None for row in rows)
+
+    lines = [
+        "# AdalFlow ARC-Bench Smoke Benchmark Report",
+        "",
+        "> This is a 5-topic smoke benchmark for the AdalFlow autonomous research demo only. "
+        "It is not a verified comparison against AutoResearchClaw until both systems are run "
+        "under the same model, hardware, timeout, budget, and scoring rubric.",
+        "",
+        "## Summary",
+        "",
+        f"- System: `{summary.get('system', 'unknown')}`",
+        f"- Mode: `{summary.get('mode', 'unknown')}`",
+        f"- Topics: {summary.get('topics', 0)}",
+        f"- Completed: {summary.get('completed', 0)}",
+        f"- Completion rate: {summary.get('completion_rate', 0):.2%}",
+        f"- Mean stage completion rate: {summary.get('mean_stage_completion_rate', 0):.2%}",
+        f"- Mean retry count: {summary.get('mean_retry_count', 0):.2f}",
+        f"- Mean wall time: {summary.get('mean_wall_time_sec', 0):.4f}s",
+        f"- Experiment success rate: {summary.get('experiment_success_rate', 0):.2%}",
+        f"- Paper generated rate: {summary.get('paper_generated_rate', 0):.2%}",
+        f"- Mean artifact completeness: {summary.get('mean_artifact_completeness', 0):.2%}",
+    ]
+
+    if has_evolution_metrics:
+        lines.extend(
+            [
+                f"- Mean initial score: {summary.get('mean_initial_score', 0):.4f}",
+                f"- Mean best score: {summary.get('mean_best_score', 0):.4f}",
+                f"- Mean score improvement: {summary.get('mean_score_improvement', 0):.4f}",
+                f"- Mean candidates explored: {summary.get('mean_num_candidates', 0):.2f}",
+                f"- Mean convergence iteration: {summary.get('mean_convergence_iteration', 0):.2f}",
+                f"- Mean archive size: {summary.get('mean_archive_size', 0):.2f}",
+            ]
+        )
+
+    lines.extend(["", "## Per-topic Results", ""])
+
+    if has_evolution_metrics:
+        lines.extend(
+            [
+                "| Topic ID | Domain | Completed | Best Score | Improvement | Candidates | Retries | Converged At | Wall Time (s) |",
+                "|---|---|---:|---:|---:|---:|---:|---:|---:|",
+            ]
+        )
+        for row in rows:
+            lines.append(
+                "| {topic_id} | {domain} | {completed} | {best_score} | {improvement} | "
+                "{candidates} | {retry_count} | {converged} | {wall_time_sec:.4f} |".format(
+                    topic_id=row["topic_id"],
+                    domain=row["domain"],
+                    completed=row["completed"],
+                    best_score=_format_optional(row.get("best_score")),
+                    improvement=_format_optional(row.get("score_improvement")),
+                    candidates=_format_optional(row.get("num_candidates"), ".0f"),
+                    retry_count=row["retry_count"],
+                    converged=_format_optional(row.get("convergence_iteration"), ".0f"),
+                    wall_time_sec=row["wall_time_sec"],
+                )
+            )
+    else:
+        lines.extend(
+            [
+                "| Topic ID | Domain | Completed | Stage Completion | Retries | Wall Time (s) | Experiment | Paper |",
+                "|---|---|---:|---:|---:|---:|---:|---:|",
+            ]
+        )
+        for row in rows:
+            lines.append(
+                "| {topic_id} | {domain} | {completed} | {stage_completion_rate:.2%} | "
+                "{retry_count} | {wall_time_sec:.4f} | {experiment_success} | {paper_generated} |".format(**row)
+            )
+
+    lines.extend(
+        [
+            "",
+            "## Next Step",
+            "",
+            "Add a second runner for AutoResearchClaw and execute both systems over the same topic file "
+            "to produce a real baseline-vs-candidate comparison.",
+            "",
+        ]
+    )
+    return "\n".join(lines)
+
+
+def main() -> None:
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("--input", type=Path, default=Path("artifacts/arc_bench/adalflow_evolution_smoke"))
+    parser.add_
```

**File**: `benchmarks/arc_bench/run_adalflow_smoke.py` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+"""Run a 5-topic ARC-Bench-style smoke benchmark for AdalFlow research demos."""
+
+from __future__ import annotations
+
+import argparse
+import json
+import sys
+import time
+from pathlib import Path
+from typing import Dict, Iterable, List, Literal
+
+PROJECT_ROOT = Path(__file__).resolve().parents[2]
+if str(PROJECT_ROOT) not in sys.path:
+    sys.path.insert(0, str(PROJECT_ROOT))
+
+from benchmarks.arc_bench.metrics import build_smoke_metrics
+from use_cases.multi_agent_dag.auto_research_claw_demo import AutoResearchPipeline
+from use_cases.multi_agent_dag.open_evolve_research_demo import OpenEvolveResearchLoop
+
+
+PipelineMode = Literal["simple", "evolution"]
+
+
+def load_topics(path: Path) -> List[Dict[str, str]]:
+    topics: List[Dict[str, str]] = []
+    with path.open("r", encoding="utf-8") as f:
+        for line in f:
+            line = line.strip()
+            if not line:
+                continue
+            topics.append(json.loads(line))
+    return topics
+
+
+def write_json(path: Path, payload: Dict) -> None:
+    path.parent.mkdir(parents=True, exist_ok=True)
+    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
+
+
+def build_pipeline(
+    mode: PipelineMode,
+    max_iterations: int,
+    *,
+    use_llm: bool,
+    provider: str,
+    model_kwargs: Dict,
+):
+    if mode == "simple":
+        return "adalflow-auto-research-demo", AutoResearchPipeline(hitl_mode="auto")
+    if mode == "evolution":
+        system = (
+            "adalflow-open-evolve-research-demo-llm"
+            if use_llm
+            else "adalflow-open-evolve-research-demo"
+        )
+        return system, OpenEvolveResearchLoop(
+            max_iterations=max_iterations,
+            use_llm=use_llm,
+            provider=provider,
+            model_kwargs=model_kwargs,
+        )
+    raise ValueError(f"Unsupported mode: {mode}")
+
+
+def summarize(metrics: Iterable[Dict], *, system: str, mode: PipelineMode, use_llm: bool) -> Dict:
+    rows = list(metrics)
+    count = len(rows)
+    if count == 0:
+        return {"system": system, "mode": mode, "use_llm": use_llm, "topics": 0}
+
+    summary = {
+        "system": system,
+        "mode": mode,
+        "use_llm": use_llm,
+        "topics": count,
+        "completed": sum(1 for row in rows if row["completed"]),
+        "completion_rate": sum(1 for row in rows if row["completed"]) / count,
+        "mean_stage_completion_rate": sum(row["stage_completion_rate"] for row in rows) / count,
+        "mean_retry_count": sum(row["retry_count"] for row in rows) / count,
+        "mean_wall_time_sec": sum(row["wall_time_sec"] for row in rows) / count,
+        "experiment_success_rate": sum(1 for row in rows if row["experiment_success"]) / count,
+        "paper_generated_rate": sum(1 for row in rows if row["paper_generated"]) / count,
+        "mean_artifact_completeness": sum(row["artifact_completeness"] for row in rows) / count,
+    }
+
+    if any(row.get("best_score") is not None for row in rows):
+        summary.update(
+            {
+                "mean_best_score": sum(row.get("best_score") or 0 for row in rows) / count,
+                "mean_initial_score": sum(row.get("initial_score") or 0 for row in rows) / count,
+                "mean_score_improvement": sum(row.get("score_improvement") or 0 for row in rows) / count,
+                "mean_num_candidates": sum(row.get("num_candidates") or 0 for row in rows) / count,
+                "mean_convergence_iteration": sum(
+                    row.get("convergence_iteration") or 0 for row in rows
+                )
+                / count,
+                "mean_archive_size": sum(row.get("archive_size") or 0 for row in rows) / count,
+            }
+        )
+
+    return summary
+
+
+def run(
+    topics_path: Path,
+    output_dir: Path,
+    *,
+    mode: PipelineMode = "evolution",
+    max_iterations: int = 5,
+    use_llm: bool = False,
+    provider: str = "openai",
+    model_kwargs: Dict | None = None,
+) -> Dict:
+    topics = load_topics(topics_path)
+    model_kwargs = model_kwargs or {"model": "gpt-4o-mini", "temperature": 0.3}
+    system, pipeline = build_pipeline(
+        mode,
+        max_iterations,
+        use_llm=use_llm,
+        provider=provider,
+        model_kwargs=model_kwargs,
+    )
+    all_metrics: List[Dict] = []
+
+    for topic_record in topics:
+        topic_dir = output_dir / topic_record["topic_id"]
+        start = time.perf_counter()
+        result = None
+        error = None
+
+        try:
+            result = pipeline(topic_record["topic"])
+        except Exception as exc:  # pragma: no cover - benchmark safety path
+            error = f"{type(exc).__name__}: {exc}"
+
+        wall_time_sec = time.perf_counter() - start
+        metrics = build_smoke_metrics(
+            system=system,
+            topic_record=topic_record,
+            result=result,
+            wall_time_sec=
```

**File**: `benchmarks/arc_bench/topics_smoke.jsonl` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+{"topic_id": "ml_001", "domain": "ml", "topic": "Investigate whether prompt self-reflection improves parameter-efficient tuning stability on small reasoning tasks."}
+{"topic_id": "ml_002", "domain": "ml", "topic": "Evaluate self-healing code generation loops for automatically repairing failed ML experiment scripts."}
+{"topic_id": "stats_001", "domain": "statistics", "topic": "Compare bootstrap confidence intervals with Bayesian credible intervals for small-sample simulation studies."}
+{"topic_id": "bio_001", "domain": "biology", "topic": "Design a computational experiment to test whether pathway-level summaries improve gene expression classification robustness."}
+{"topic_id": "quantum_001", "domain": "quantum", "topic": "Explore whether noise-aware variational circuit ansatz selection improves robustness under simulated depolarizing noise."}
```

**File**: `use_cases/multi_agent_dag/auto_research_claw_demo.py` (added, +206/-0)
```diff
@@ -0,0 +1,206 @@
+"""
+AdalFlow Implementation of an Autonomous Research Agent (AutoResearchClaw-style).
+This demo showcases how AdalFlow's Component architecture, Prompt Parameters, and Custom Evaluators 
+can model a multi-stage autonomous research pipeline with Human-in-the-Loop (HITL) gates, 
+Self-Healing code sandboxes, and run-to-run Optimization.
+"""
+
+import sys
+import time
+from typing import Dict, Any, List, Optional
+from adalflow.core.component import Component
+from adalflow.optim.parameter import Parameter, ParameterType
+
+# =====================================================================
+# 1. Pipeline Building Blocks: AdalFlow Stages and Components
+# =====================================================================
+
+class LiteratureAgent(Component):
+    """
+    Search and analyze relevant literature using scholarly APIs.
+    """
+    def __init__(self):
+        super().__init__()
+        self.system_prompt = Parameter(
+            data="You are an expert literature surveyor. Identify key research papers, extract findings, and isolate open research gaps.",
+            requires_opt=True,
+            role_desc="Instructions for LiteratureAgent to maximize relevance and coverage of references.",
+            param_type=ParameterType.PROMPT
+        )
+
+    def call(self, topic: str) -> List[Dict[str, str]]:
+        print(f"\n[LiteratureAgent] Searching real & virtual databases for topic: '{topic}'")
+        # In a real environment, we would call OpenAlex or Semantic Scholar APIs here.
+        # Returning mock reference results.
+        return [
+            {"title": "AdalFlow: Auto-optimizing LLM pipelines", "authors": "Yang et al.", "year": "2024"},
+            {"title": "AutoResearchClaw: Autonomous Research Agents", "authors": "Liu et al.", "year": "2026"}
+        ]
+
+
+class HypothesisAgent(Component):
+    """
+    Synthesize literature findings and design testable hypotheses.
+    """
+    def __init__(self):
+        super().__init__()
+        self.system_prompt = Parameter(
+            data="Formulate highly novel, testable machine learning hypotheses. Focus on parameter-efficient tuning.",
+            requires_opt=True,
+            role_desc="Synthesizing instructions to generate high-novelty hypotheses.",
+            param_type=ParameterType.PROMPT
+        )
+
+    def call(self, literature_findings: List[Dict[str, str]]) -> str:
+        print("[HypothesisAgent] Analyzing findings to generate a novel research hypothesis...")
+        return "Hypothesis: AdalFlow's Textual Gradient Descent (TGD) is more sample-efficient than standard RLHF on reasoning tasks."
+
+
+class SecureSandboxExecutor(Component):
+    """
+    Secure executor which runs the generated code in a sandbox, catches errors, 
+    and returns traceback feedback for self-healing.
+    """
+    def call(self, code: str) -> Dict[str, Any]:
+        print("[Sandbox] Executing candidate experiment code in isolated sandbox...")
+        # Simulated run with error tracing
+        if "eval_accuracy" in code:
+            return {"status": "success", "metrics": {"eval_accuracy": 0.885}, "logs": "All checks passed."}
+        else:
+            return {"status": "failed", "traceback": "NameError: name 'eval_accuracy' is not defined", "logs": "Runtime execution failed."}
+
+
+class SelfHealingCoder(Component):
+    """
+    Self-healing execution module that writes code and iteratively repairs tracebacks.
+    """
+    def __init__(self):
+        super().__init__()
+        self.system_prompt = Parameter(
+            data="Write clean, modular, runnable training scripts. Ensure metrics like 'eval_accuracy' are tracked.",
+            requires_opt=True,
+            role_desc="System guidelines for compiling bug-free code.",
+            param_type=ParameterType.PROMPT
+        )
+        self.sandbox = SecureSandboxExecutor()
+
+    def call(self, hypothesis: str) -> Dict[str, Any]:
+        print("[Self-Healing Coder] Generating initial code based on hypothesis...")
+        code = "import torch\n# Running standard training sequence\nval_loss = 0.1"
+        
+        # Iteration 1: Sandbox run fails (simulated)
+        result = self.sandbox(code)
+        if result["status"] == "failed":
+            print(f"[Self-Healing Coder] Caught Error: {result['traceback']}. Initiating LLM self-healing repair loop...")
+            # Repairing code
+            code += "\neval_accuracy = 0.89"
+            result = self.sandbox(code)
+            
+        print(f"[Self-Healing Coder] Code execution finalized. Status: {result['status']}")
+        return result
+
+
+class HumanInTheLoopGate:
+    """
+    A lightweight HITL gate to pause execution, solicit user feedback, 
+    or auto-approve in head-less mode.
+    """
+    @staticmethod
+    def approve(stage_name: str, candidate_output: Any, mode: str = "co-pilot") -> Any:
+        print(f"\n--- [HITL Gate: {stage_name}] Mode: {mode} ---")
```

---

### Incident Patch 2: `efce33f9` (2026-05-26)
**Commit Message**: Merge pull request #490 from shangliy/feat/intuitive-evolution-api

feat(optim): add intuitive evolution API design doc and runnable prototype

**File**: `docs/design/intuitive_evolution_api.md` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+# High-Level API Design: Intuitive Program & Agent Evolution in AdalFlow
+
+**Date:** 2026-05-25  
+**POC:** AdaL & Engineering Team  
+**Status:** Draft / Proposal  
+
+---
+
+## 1. Design Goal
+To provide developers with a simple, high-level, and intuitive interface to define LLM components, agents, and pipelines, and automatically optimize/evolve them (using text gradients, few-shot generation, or genetic algorithms/GEPA) with minimal script-level scaffolding—similar to `openevolve` but deeply integrated with AdalFlow's performance-oriented engine.
+
+---
+
+## 2. API Showcase
+
+Here is how a developer would use this new abstraction to define a multi-agent system, artifacts, evaluators, and run an evolutionary loop in a single, clean script:
+
+```python
+import adalflow as adal
+from adalflow.optim.evolution import run_evolution, evolve_function
+
+# 1. Define Agent Profiles and Artifact relations as modular units
+@adal.agent(name="planner", model="gpt-4o")
+class PlannerAgent:
+    """You are a precise task planner. Break the request into 3 clear steps."""
+    def __call__(self, task: str) -> str:
+        return self.generate(task)
+
+@adal.agent(name="coder", model="claude-3-5-sonnet")
+class CodingAgent:
+    """You are an advanced Python coding agent. Implement clean, tested functions."""
+    def __call__(self, plan: str) -> str:
+        return self.generate(plan)
+
+# 2. Wire them up in an intuitive pipeline DAG (ADAG)
+class CodingPipeline(adal.Pipeline):
+    def __init__(self):
+        super().__init__()
+        self.planner = PlannerAgent()
+        self.coder = CodingAgent()
+
+    def call(self, user_query: str) -> str:
+        # Define flow and sequential artifact passing simply
+        plan = self.planner(user_query)
+        code = self.coder(plan)
+        return code
+
+# 3. Instantiate the pipeline
+pipeline = CodingPipeline()
+
+# 4. Define your evaluator (can be unit tests or programmatic metrics)
+def evaluate_pipeline(pipeline_instance) -> float:
+    # Run the pipeline on a small test benchmark
+    sample_task = "Write a fast fibonacci function"
+    generated_code = pipeline_instance(sample_task)
+    
+    # Run tests on generated_code
+    try:
+        exec(generated_code)
+        # Test assertion check
+        assert fib(5) == 5
+        return 1.0
+    except Exception:
+        return 0.0
+
+# 5. One-line Evolution run!
+# AdalFlow automatically discovers all prompt parameters in PlannerAgent and CodingAgent,
+# mutates/crosses-over their profiles, runs evaluations, and converges on the optimal prompts.
+best_pipeline = run_evolution(
+    pipeline,
+    evaluator=evaluate_pipeline,
+    iterations=20,
+    strategy="gepa" # or "text-grad"
+)
+
+# Print out the evolved optimal system prompts
+print("Optimized Planner Profile:", best_pipeline.planner.profile)
+print("Optimized Coder Profile:", best_pipeline.coder.profile)
+```
+
+---
+
+## 3. Underlying Mechanics
+
+### 3.1 Class Decorators & Dynamic Parameters
+The `@adal.agent` decorator dynamically converts the docstring and system instructions into an AdalFlow `Parameter(requires_grad=True)`. This keeps the definition extremely elegant and visually clean while fully preserving the PyTorch-style computational graph underneath.
+
+```python
+def agent(name: str, model: str):
+    def decorator(cls):
+        # Dynamically inject AdalFlow Component properties
+        class WrappedAgent(Component):
+            def __init__(self, *args, **kwargs):
+                super().__init__()
+                self.profile = Parameter(
+                    data=cls.__doc__,
+                    requires_grad=True,
+                    role_desc=f"Profile instructions for {name}",
+                    param_type=ParameterType.PROMPT
+                )
+                self.generator = Generator(
+                    model_client=get_default_client(),
+                    model_kwargs={"model": model}
+                )
+            
+            def generate(self, input_text: str) -> str:
+                return self.generator(
+                    prompt_kwargs={"system_prompt": self.profile.data, "input": input_text}
+                ).data
+                
+        return WrappedAgent
+    return decorator
+```
+
+### 3.2 High-Level `run_evolution` Entrypoint
+The `run_evolution` function wraps AdalFlow's optimizer suite:
+- Analyzes the provided `Pipeline` or `Component` to extract all parameters.
+- Wraps the custom `evaluator` function as an AdalFlow metric tracker.
+- Instantiates either `GEPA` (for evolutionary mutation/crossover of prompts/code) or `TGDOptimizer` (for text-gradient feedback iterations).
+- Manages the mutation selection of parameters behind the scenes and returns the optimized component state.
+
+---
+
+## 4. Why This is Perfect for AdalFlow
+- **Developer Delight:** Hides the boilerplate of dataset loaders, trainers, and optimizer parameter registration, making simple experimen
```

**File**: `use_cases/multi_agent_dag/intuitive_evolution_prototype.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+"""
+Prototype: Intuitive Agent and Program Evolution API on top of AdalFlow.
+This prototype showcases the decorator @agent, the Pipeline class, and run_evolution
+using a mock/simplified evolutionary mutator.
+"""
+
+from typing import Dict, Any, Callable
+from adalflow.core.component import Component
+from adalflow.optim.parameter import Parameter, ParameterType
+
+# 1. High-Level Abstractions
+
+def agent(name: str, model: str):
+    """
+    A decorator that transforms a user-defined class into an AdalFlow Component,
+    converting its docstring into an optimizable Parameter.
+    """
+    def decorator(cls):
+        class WrappedAgent(Component):
+            def __init__(self, *args, **kwargs):
+                super().__init__()
+                # Convert the docstring of the class into an optimizable Prompt Parameter
+                self.profile = Parameter(
+                    data=cls.__doc__.strip() if cls.__doc__ else "You are a helpful assistant.",
+                    requires_opt=True,
+                    role_desc=f"Profile instructions for agent: {name}",
+                    param_type=ParameterType.PROMPT
+                )
+                self.name = name
+                self.model = model
+                # Instantiating original class to bind methods
+                self._user_inst = cls(*args, **kwargs)
+
+            def generate(self, input_text: str) -> str:
+                # Simulating dynamic LLM generation using the current system profile state
+                print(f"[{self.name} ({self.model})] Running generation with profile: '{self.profile.data}'")
+                # In real life, this hooks into: return self.generator(...)
+                return f"Result of processing '{input_text}' using persona '{self.profile.data}'"
+
+            def __call__(self, *args, **kwargs) -> Any:
+                # Direct calls to __call__ on the instance are forwarded
+                # We dynamically bind the generate helper so user functions can use it easily
+                self._user_inst.generate = self.generate
+                return self._user_inst.__call__(*args, **kwargs)
+
+        return WrappedAgent
+    return decorator
+
+
+class Pipeline(Component):
+    """Base class for wiring up pipelines."""
+    def __init__(self):
+        super().__init__()
+
+
+def run_evolution(
+    pipeline: Component,
+    evaluator: Callable[[Component], float],
+    iterations: int = 5,
+    strategy: str = "gepa"
+) -> Component:
+    """
+    A simplified evolutionary mutator running directly on the AdalFlow Component.
+    In production, this translates to the full GEPA / TGDOptimizer engine.
+    """
+    print(f"\n--- Starting Evolution Loop (Strategy: {strategy}, Iterations: {iterations}) ---")
+    
+    # Locate all trainable parameters in the pipeline
+    trainable_params = [p for p in pipeline.parameters() if p.requires_opt]
+    print(f"Discovered {len(trainable_params)} trainable agent profiles:")
+    for p in trainable_params:
+        print(f" - {p.role_desc}: '{p.data}'")
+
+    best_score = evaluator(pipeline)
+    print(f"Initial Baseline Score: {best_score}")
+
+    # Simulated evolution steps
+    for step in range(1, iterations + 1):
+        print(f"\n[Step {step}/{iterations}] Mutating profiles...")
+        
+        # 1. Mutate: In production, we send the prompt + current score + critique to LLM
+        # For this prototype, we mock mutation by appending dynamic guidance hints
+        original_states = []
+        for param in trainable_params:
+            original_states.append((param, param.data))
+            param.data += f" (Optimized Guidance Step {step})"
+
+        # 2. Evaluate candidate mutations
+        score = evaluator(pipeline)
+        print(f"Candidate Score: {score}")
+
+        # 3. Selection
+        if score >= best_score:
+            best_score = score
+            print(f"New Best State Found! Keeping mutations.")
+        else:
+            # Revert mutations
+            print(f"Score dropped. Reverting mutations.")
+            for param, orig_val in original_states:
+                param.data = orig_val
+
+    print(f"\n--- Evolution Complete. Best Final Score: {best_score} ---")
+    return pipeline
+
+
+# 2. Showcase Usage
+
+if __name__ == "__main__":
+    # Define Agents using standard Docstrings as system instructions
+    @agent(name="planner", model="gpt-4o")
+    class PlannerAgent:
+        """You are a precise task planner. Break the request into 3 clear steps."""
+        def __call__(self, task: str) -> str:
+            # self.generate is dynamically supplied by the decorator
+            return self.generate(task)
+
+    @agent(name="coder", model="claude-3-5-sonnet")
+    class CodingAgent:
+        """You are an advanced Python coding agent. Implement clean, tested functions."""
+        def __call__(self, plan: str) -> str:
+            return self.generate(plan)
+
+    # Wire them up as a s
```

---

### Incident Patch 3: `2414052f` (2026-05-25)
**Commit Message**: feat(optim): add intuitive evolution API design doc and runnable prototype

- Add docs/design/intuitive_evolution_api.md outlining simplified @agent and run_evolution API spec
- Add runnable use_cases/multi_agent_dag/intuitive_evolution_prototype.py demonstrating dynamic parameter extraction

Co-authored-by: AdaL <[REDACTED_EMAIL]>

**File**: `docs/design/intuitive_evolution_api.md` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+# High-Level API Design: Intuitive Program & Agent Evolution in AdalFlow
+
+**Date:** 2026-05-25  
+**POC:** AdaL & Engineering Team  
+**Status:** Draft / Proposal  
+
+---
+
+## 1. Design Goal
+To provide developers with a simple, high-level, and intuitive interface to define LLM components, agents, and pipelines, and automatically optimize/evolve them (using text gradients, few-shot generation, or genetic algorithms/GEPA) with minimal script-level scaffolding—similar to `openevolve` but deeply integrated with AdalFlow's performance-oriented engine.
+
+---
+
+## 2. API Showcase
+
+Here is how a developer would use this new abstraction to define a multi-agent system, artifacts, evaluators, and run an evolutionary loop in a single, clean script:
+
+```python
+import adalflow as adal
+from adalflow.optim.evolution import run_evolution, evolve_function
+
+# 1. Define Agent Profiles and Artifact relations as modular units
+@adal.agent(name="planner", model="gpt-4o")
+class PlannerAgent:
+    """You are a precise task planner. Break the request into 3 clear steps."""
+    def __call__(self, task: str) -> str:
+        return self.generate(task)
+
+@adal.agent(name="coder", model="claude-3-5-sonnet")
+class CodingAgent:
+    """You are an advanced Python coding agent. Implement clean, tested functions."""
+    def __call__(self, plan: str) -> str:
+        return self.generate(plan)
+
+# 2. Wire them up in an intuitive pipeline DAG (ADAG)
+class CodingPipeline(adal.Pipeline):
+    def __init__(self):
+        super().__init__()
+        self.planner = PlannerAgent()
+        self.coder = CodingAgent()
+
+    def call(self, user_query: str) -> str:
+        # Define flow and sequential artifact passing simply
+        plan = self.planner(user_query)
+        code = self.coder(plan)
+        return code
+
+# 3. Instantiate the pipeline
+pipeline = CodingPipeline()
+
+# 4. Define your evaluator (can be unit tests or programmatic metrics)
+def evaluate_pipeline(pipeline_instance) -> float:
+    # Run the pipeline on a small test benchmark
+    sample_task = "Write a fast fibonacci function"
+    generated_code = pipeline_instance(sample_task)
+    
+    # Run tests on generated_code
+    try:
+        exec(generated_code)
+        # Test assertion check
+        assert fib(5) == 5
+        return 1.0
+    except Exception:
+        return 0.0
+
+# 5. One-line Evolution run!
+# AdalFlow automatically discovers all prompt parameters in PlannerAgent and CodingAgent,
+# mutates/crosses-over their profiles, runs evaluations, and converges on the optimal prompts.
+best_pipeline = run_evolution(
+    pipeline,
+    evaluator=evaluate_pipeline,
+    iterations=20,
+    strategy="gepa" # or "text-grad"
+)
+
+# Print out the evolved optimal system prompts
+print("Optimized Planner Profile:", best_pipeline.planner.profile)
+print("Optimized Coder Profile:", best_pipeline.coder.profile)
+```
+
+---
+
+## 3. Underlying Mechanics
+
+### 3.1 Class Decorators & Dynamic Parameters
+The `@adal.agent` decorator dynamically converts the docstring and system instructions into an AdalFlow `Parameter(requires_grad=True)`. This keeps the definition extremely elegant and visually clean while fully preserving the PyTorch-style computational graph underneath.
+
+```python
+def agent(name: str, model: str):
+    def decorator(cls):
+        # Dynamically inject AdalFlow Component properties
+        class WrappedAgent(Component):
+            def __init__(self, *args, **kwargs):
+                super().__init__()
+                self.profile = Parameter(
+                    data=cls.__doc__,
+                    requires_grad=True,
+                    role_desc=f"Profile instructions for {name}",
+                    param_type=ParameterType.PROMPT
+                )
+                self.generator = Generator(
+                    model_client=get_default_client(),
+                    model_kwargs={"model": model}
+                )
+            
+            def generate(self, input_text: str) -> str:
+                return self.generator(
+                    prompt_kwargs={"system_prompt": self.profile.data, "input": input_text}
+                ).data
+                
+        return WrappedAgent
+    return decorator
+```
+
+### 3.2 High-Level `run_evolution` Entrypoint
+The `run_evolution` function wraps AdalFlow's optimizer suite:
+- Analyzes the provided `Pipeline` or `Component` to extract all parameters.
+- Wraps the custom `evaluator` function as an AdalFlow metric tracker.
+- Instantiates either `GEPA` (for evolutionary mutation/crossover of prompts/code) or `TGDOptimizer` (for text-gradient feedback iterations).
+- Manages the mutation selection of parameters behind the scenes and returns the optimized component state.
+
+---
+
+## 4. Why This is Perfect for AdalFlow
+- **Developer Delight:** Hides the boilerplate of dataset loaders, trainers, and optimizer parameter registration, making simple experimen
```

**File**: `use_cases/multi_agent_dag/intuitive_evolution_prototype.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+"""
+Prototype: Intuitive Agent and Program Evolution API on top of AdalFlow.
+This prototype showcases the decorator @agent, the Pipeline class, and run_evolution
+using a mock/simplified evolutionary mutator.
+"""
+
+from typing import Dict, Any, Callable
+from adalflow.core.component import Component
+from adalflow.optim.parameter import Parameter, ParameterType
+
+# 1. High-Level Abstractions
+
+def agent(name: str, model: str):
+    """
+    A decorator that transforms a user-defined class into an AdalFlow Component,
+    converting its docstring into an optimizable Parameter.
+    """
+    def decorator(cls):
+        class WrappedAgent(Component):
+            def __init__(self, *args, **kwargs):
+                super().__init__()
+                # Convert the docstring of the class into an optimizable Prompt Parameter
+                self.profile = Parameter(
+                    data=cls.__doc__.strip() if cls.__doc__ else "You are a helpful assistant.",
+                    requires_opt=True,
+                    role_desc=f"Profile instructions for agent: {name}",
+                    param_type=ParameterType.PROMPT
+                )
+                self.name = name
+                self.model = model
+                # Instantiating original class to bind methods
+                self._user_inst = cls(*args, **kwargs)
+
+            def generate(self, input_text: str) -> str:
+                # Simulating dynamic LLM generation using the current system profile state
+                print(f"[{self.name} ({self.model})] Running generation with profile: '{self.profile.data}'")
+                # In real life, this hooks into: return self.generator(...)
+                return f"Result of processing '{input_text}' using persona '{self.profile.data}'"
+
+            def __call__(self, *args, **kwargs) -> Any:
+                # Direct calls to __call__ on the instance are forwarded
+                # We dynamically bind the generate helper so user functions can use it easily
+                self._user_inst.generate = self.generate
+                return self._user_inst.__call__(*args, **kwargs)
+
+        return WrappedAgent
+    return decorator
+
+
+class Pipeline(Component):
+    """Base class for wiring up pipelines."""
+    def __init__(self):
+        super().__init__()
+
+
+def run_evolution(
+    pipeline: Component,
+    evaluator: Callable[[Component], float],
+    iterations: int = 5,
+    strategy: str = "gepa"
+) -> Component:
+    """
+    A simplified evolutionary mutator running directly on the AdalFlow Component.
+    In production, this translates to the full GEPA / TGDOptimizer engine.
+    """
+    print(f"\n--- Starting Evolution Loop (Strategy: {strategy}, Iterations: {iterations}) ---")
+    
+    # Locate all trainable parameters in the pipeline
+    trainable_params = [p for p in pipeline.parameters() if p.requires_opt]
+    print(f"Discovered {len(trainable_params)} trainable agent profiles:")
+    for p in trainable_params:
+        print(f" - {p.role_desc}: '{p.data}'")
+
+    best_score = evaluator(pipeline)
+    print(f"Initial Baseline Score: {best_score}")
+
+    # Simulated evolution steps
+    for step in range(1, iterations + 1):
+        print(f"\n[Step {step}/{iterations}] Mutating profiles...")
+        
+        # 1. Mutate: In production, we send the prompt + current score + critique to LLM
+        # For this prototype, we mock mutation by appending dynamic guidance hints
+        original_states = []
+        for param in trainable_params:
+            original_states.append((param, param.data))
+            param.data += f" (Optimized Guidance Step {step})"
+
+        # 2. Evaluate candidate mutations
+        score = evaluator(pipeline)
+        print(f"Candidate Score: {score}")
+
+        # 3. Selection
+        if score >= best_score:
+            best_score = score
+            print(f"New Best State Found! Keeping mutations.")
+        else:
+            # Revert mutations
+            print(f"Score dropped. Reverting mutations.")
+            for param, orig_val in original_states:
+                param.data = orig_val
+
+    print(f"\n--- Evolution Complete. Best Final Score: {best_score} ---")
+    return pipeline
+
+
+# 2. Showcase Usage
+
+if __name__ == "__main__":
+    # Define Agents using standard Docstrings as system instructions
+    @agent(name="planner", model="gpt-4o")
+    class PlannerAgent:
+        """You are a precise task planner. Break the request into 3 clear steps."""
+        def __call__(self, task: str) -> str:
+            # self.generate is dynamically supplied by the decorator
+            return self.generate(task)
+
+    @agent(name="coder", model="claude-3-5-sonnet")
+    class CodingAgent:
+        """You are an advanced Python coding agent. Implement clean, tested functions."""
+        def __call__(self, plan: str) -> str:
+            return self.generate(plan)
+
+    # Wire them up as a s
```

---

### Incident Patch 4: `0637773b` (2026-05-25)
**Commit Message**: Merge pull request #487 from shangliy/revert-486-feat/optimize-anything-gepa-parity

Revert "feat(optim): add GEPA-style optimize_anything API and benchmark scaffold"

**File**: `adalflow/adalflow/__init__.py` (modified, +0/-10)
```diff
@@ -52,11 +52,6 @@
     TGDOptimizer,
     EvalFnToTextLoss,
     LLMAsTextLoss,
-    optimize_anything,
-    log,
-    EngineConfig,
-    GEPAConfig,
-    OptimizeAnythingResult,
 )
 
 from adalflow.optim.types import ParameterType
@@ -108,11 +103,6 @@
     "TGDOptimizer",
     "EvalFnToTextLoss",
     "LLMAsTextLoss",
-    "optimize_anything",
-    "log",
-    "EngineConfig",
-    "GEPAConfig",
-    "OptimizeAnythingResult",
     "setup_env",
     "get_logger",
     "Prompt",
```

**File**: `adalflow/adalflow/optim/__init__.py` (modified, +0/-12)
```diff
@@ -11,13 +11,6 @@
 from adalflow.utils.registry import EntityMapping
 from .optimizer import DemoOptimizer, TextOptimizer
 from .gradient import Gradient, GradientContext
-from .optimize_anything import (
-    optimize_anything,
-    log,
-    EngineConfig,
-    GEPAConfig,
-    OptimizeAnythingResult,
-)
 
 
 __all__ = [
@@ -39,11 +32,6 @@
     "TextOptimizer",
     "Gradient",
     "GradientContext",
-    "optimize_anything",
-    "log",
-    "EngineConfig",
-    "GEPAConfig",
-    "OptimizeAnythingResult",
 ]
 
 for name in __all__:
```

**File**: `adalflow/adalflow/optim/optimize_anything.py` (removed, +0/-269)
```diff
@@ -1,269 +0,0 @@
-"""GEPA-style optimize_anything API for arbitrary text artifacts."""
-
-from __future__ import annotations
-
-from contextvars import ContextVar
-from dataclasses import dataclass, field
-from random import Random
-from time import perf_counter
-from typing import Any, Callable, Dict, List, Optional, Sequence, Union
-
-from adalflow.core.base_data_class import DataClass
-
-
-_EVAL_LOG_BUFFER: ContextVar[Optional[List[str]]] = ContextVar(
-    "optimize_anything_eval_log_buffer", default=None
-)
-
-
-def log(message: str) -> None:
-    """Log actionable side information during evaluator execution."""
-    buffer = _EVAL_LOG_BUFFER.get()
-    if buffer is None:
-        return
-    buffer.append(str(message))
-
-
-@dataclass
-class EngineConfig(DataClass):
-    """Execution budget and runtime controls."""
-
-    max_metric_calls: int = field(default=100)
-    max_parallel: int = field(default=1)
-    random_seed: int = field(default=0)
-
-
-@dataclass
-class GEPAConfig(DataClass):
-    """Optimization controls for evolutionary + Pareto search."""
-
-    engine: EngineConfig = field(default_factory=EngineConfig)
-    population_size: int = field(default=8)
-    elite_size: int = field(default=3)
-    mutation_rate: float = field(default=0.7)
-    crossover_rate: float = field(default=0.2)
-    stop_score: Optional[float] = field(default=None)
-
-
-@dataclass
-class CandidateEvaluation(DataClass):
-    candidate: str = field(default="")
-    score: float = field(default=0.0)
-    token_cost: int = field(default=0)
-    latency_ms: float = field(default=0.0)
-    side_info: List[str] = field(default_factory=list)
-
-
-@dataclass
-class OptimizeAnythingResult(DataClass):
-    best_candidate: str = field(default="")
-    best_score: float = field(default=0.0)
-    metric_calls: int = field(default=0)
-    history: List[CandidateEvaluation] = field(default_factory=list)
-    pareto_frontier: List[CandidateEvaluation] = field(default_factory=list)
-    objective: str = field(default="")
-
-
-def _extract_eval_output(result: Union[float, int, Dict[str, Any]]) -> Dict[str, float]:
-    if isinstance(result, (float, int)):
-        return {"score": float(result)}
-    if isinstance(result, dict):
-        if "score" not in result:
-            raise ValueError("evaluator dict output must include 'score'")
-        output = {"score": float(result["score"])}
-        if "token_cost" in result and result["token_cost"] is not None:
-            output["token_cost"] = float(result["token_cost"])
-        if "latency_ms" in result and result["latency_ms"] is not None:
-            output["latency_ms"] = float(result["latency_ms"])
-        return output
-    raise TypeError("evaluator must return float/int or dict containing 'score'")
-
-
-def _estimate_token_cost(candidate: str) -> int:
-    stripped = candidate.strip()
-    if not stripped:
-        return 0
-    return len(stripped.split())
-
-
-def _dominates(a: CandidateEvaluation, b: CandidateEvaluation) -> bool:
-    not_worse = (
-        a.score >= b.score
-        and a.token_cost <= b.token_cost
-        and a.latency_ms <= b.latency_ms
-    )
-    strictly_better = (
-        a.score > b.score
-        or a.token_cost < b.token_cost
-        or a.latency_ms < b.latency_ms
-    )
-    return not_worse and strictly_better
-
-
-def _compute_pareto_frontier(
-    records: Sequence[CandidateEvaluation],
-) -> List[CandidateEvaluation]:
-    frontier: List[CandidateEvaluation] = []
-    for candidate in records:
-        dominated = False
-        for other in records:
-            if other is candidate:
-                continue
-            if _dominates(other, candidate):
-                dominated = True
-                break
-        if not dominated:
-            frontier.append(candidate)
-    frontier.sort(key=lambda item: (-item.score, item.token_cost, item.latency_ms))
-    return frontier
-
-
-def _mutate(candidate: str, objective: str, side_info: Sequence[str], rng: Random) -> str:
-    lines = candidate.splitlines()
-    hints = [item for item in side_info if item]
-    hint = hints[-1][:180] if hints else f"Objective: {objective[:120]}"
-
-    operation = rng.choice(["append_hint", "prepend_hint", "line_swap", "dedupe_spaces"])
-
-    if operation == "append_hint":
-        return f"{candidate}\n# Hint: {hint}".strip()
-    if operation == "prepend_hint":
-        return f"# Objective: {objective}\n{candidate}".strip()
-    if operation == "line_swap" and len(lines) >= 2:
-        idx_a = rng.randrange(len(lines))
-        idx_b = rng.randrange(len(lines))
-        lines[idx_a], lines[idx_b] = lines[idx_b], lines[idx_a]
-        return "\n".join(lines)
-    return " ".join(candidate.split())
-
-
-def _crossover(left: str, right: str, rng: Random) -> str:
-    left_lines = left.splitlines()
-    right_lines = right.splitlines()
-    if not left_lines or not right_lines:
-        return left if left else right
-    left_cut = rng.randran
```

**File**: `adalflow/tests/test_optimize_anything.py` (removed, +0/-75)
```diff
@@ -1,75 +0,0 @@
-from adalflow.optim.optimize_anything import (
-    EngineConfig,
-    GEPAConfig,
-    optimize_anything,
-    log,
-)
-
-
-def test_optimize_anything_respects_max_metric_calls():
-    calls = {"count": 0}
-
-    def evaluator(candidate: str) -> float:
-        calls["count"] += 1
-        log(f"len={len(candidate)}")
-        return float(candidate.count("good"))
-
-    result = optimize_anything(
-        seed_candidate="good",
-        evaluator=evaluator,
-        objective="increase 'good' count",
-        config=GEPAConfig(engine=EngineConfig(max_metric_calls=5, random_seed=1)),
-    )
-
-    assert result.metric_calls == 5
-    assert calls["count"] == 5
-    assert len(result.history) == 5
-
-
-def test_optimize_anything_returns_seed_when_no_improvement():
-    def evaluator(candidate: str) -> float:
-        log("constant score")
-        return 0.5
-
-    seed = "artifact"
-    result = optimize_anything(
-        seed_candidate=seed,
-        evaluator=evaluator,
-        objective="no-op",
-        config=GEPAConfig(engine=EngineConfig(max_metric_calls=4, random_seed=2)),
-    )
-
-    assert result.best_candidate == seed
-    assert result.best_score == 0.5
-
-
-def test_optimize_anything_improves_on_toy_objective():
-    def evaluator(candidate: str):
-        # shorter candidate is better, but still uses score max convention
-        score = 1.0 / (1 + len(candidate))
-        log(f"candidate={candidate[:20]}")
-        return {"score": score}
-
-    result = optimize_anything(
-        seed_candidate="this is a very long seed candidate",
-        evaluator=evaluator,
-        objective="minimize length",
-        config=GEPAConfig(
-            engine=EngineConfig(max_metric_calls=12, random_seed=7),
-            population_size=6,
-            elite_size=2,
-            mutation_rate=0.9,
-            crossover_rate=0.0,
-        ),
-    )
-
-    assert result.best_score >= result.history[0].score
-    assert result.pareto_frontier
-
-
-def test_optimize_anything_is_exported_from_top_level():
-    import adalflow as adal
-
-    assert hasattr(adal, "optimize_anything")
-    assert hasattr(adal, "GEPAConfig")
-    assert hasattr(adal, "EngineConfig")
\ No newline at end of file
```

**File**: `benchmarks/optimize_anything/README.md` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-# optimize_anything benchmark (GEPA-style scaffold)
-
-This benchmark provides a reproducible scaffold for `adalflow.optim.optimize_anything` across
-three artifact categories:
-
-1. text/prompt artifact
-2. code artifact
-3. config/SVG-like artifact
-
-Each run reports:
-- quality score (maximize)
-- token_cost (minimize)
-- latency_ms (minimize)
-
-## Run
-
-```bash
-python benchmarks/optimize_anything/gepa_parity_benchmark.py
-```
-
-The script prints JSON containing baseline (seed) and optimized metrics for each case.
\ No newline at end of file
```

**File**: `benchmarks/optimize_anything/gepa_parity_benchmark.py` (removed, +0/-82)
```diff
@@ -1,82 +0,0 @@
-"""GEPA-style benchmark scaffold for optimize_anything.
-
-Tracks:
-1) prompt/text artifact
-2) code artifact
-3) config/svg-like artifact
-
-Metrics:
-- quality score (maximize)
-- token_cost (minimize)
-- latency_ms (minimize)
-"""
-
-from __future__ import annotations
-
-from pathlib import Path
-import sys
-from typing import Dict
-
-# Ensure benchmark resolves local source package from this repository.
-sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "adalflow"))
-
-from adalflow import EngineConfig, GEPAConfig, optimize_anything, log
-
-
-def _run_case(name: str, seed_candidate: str, target_keyword: str) -> Dict[str, float]:
-    def evaluator(candidate: str):
-        quality = 1.0 if target_keyword in candidate else 0.2
-        quality += min(candidate.count(target_keyword), 3) * 0.1
-        quality -= 0.01 * len(candidate.split())
-        log(f"target={target_keyword}, contains={target_keyword in candidate}")
-        return {"score": quality}
-
-    result = optimize_anything(
-        seed_candidate=seed_candidate,
-        evaluator=evaluator,
-        objective=f"Increase quality for {name} while reducing verbosity.",
-        config=GEPAConfig(
-            engine=EngineConfig(max_metric_calls=30, random_seed=42),
-            population_size=10,
-            elite_size=3,
-            mutation_rate=0.8,
-            crossover_rate=0.2,
-        ),
-    )
-
-    baseline = result.history[0]
-    return {
-        "baseline_score": baseline.score,
-        "best_score": result.best_score,
-        "baseline_token_cost": baseline.token_cost,
-        "best_token_cost": min(item.token_cost for item in result.pareto_frontier),
-        "baseline_latency_ms": baseline.latency_ms,
-        "best_latency_ms": min(item.latency_ms for item in result.pareto_frontier),
-    }
-
-
-def run_benchmark() -> Dict[str, Dict[str, float]]:
-    return {
-        "text_artifact": _run_case(
-            "text_artifact",
-            "You are an assistant. Provide detailed answer.",
-            "concise",
-        ),
-        "code_artifact": _run_case(
-            "code_artifact",
-            "def add(a,b): return a+b",
-            "type hints",
-        ),
-        "config_svg_artifact": _run_case(
-            "config_svg_artifact",
-            "<svg><circle r='5'/></svg>",
-            "viewBox",
-        ),
-    }
-
-
-if __name__ == "__main__":
-    import json
-
-    results = run_benchmark()
-    print(json.dumps(results, indent=2))
\ No newline at end of file
```

---

### Incident Patch 5: `118b8adc` (2026-05-25)
**Commit Message**: Revert "feat(optim): add GEPA-style optimize_anything API and benchmark scaffold"

**File**: `adalflow/adalflow/__init__.py` (modified, +0/-10)
```diff
@@ -52,11 +52,6 @@
     TGDOptimizer,
     EvalFnToTextLoss,
     LLMAsTextLoss,
-    optimize_anything,
-    log,
-    EngineConfig,
-    GEPAConfig,
-    OptimizeAnythingResult,
 )
 
 from adalflow.optim.types import ParameterType
@@ -108,11 +103,6 @@
     "TGDOptimizer",
     "EvalFnToTextLoss",
     "LLMAsTextLoss",
-    "optimize_anything",
-    "log",
-    "EngineConfig",
-    "GEPAConfig",
-    "OptimizeAnythingResult",
     "setup_env",
     "get_logger",
     "Prompt",
```

**File**: `adalflow/adalflow/optim/__init__.py` (modified, +0/-12)
```diff
@@ -11,13 +11,6 @@
 from adalflow.utils.registry import EntityMapping
 from .optimizer import DemoOptimizer, TextOptimizer
 from .gradient import Gradient, GradientContext
-from .optimize_anything import (
-    optimize_anything,
-    log,
-    EngineConfig,
-    GEPAConfig,
-    OptimizeAnythingResult,
-)
 
 
 __all__ = [
@@ -39,11 +32,6 @@
     "TextOptimizer",
     "Gradient",
     "GradientContext",
-    "optimize_anything",
-    "log",
-    "EngineConfig",
-    "GEPAConfig",
-    "OptimizeAnythingResult",
 ]
 
 for name in __all__:
```

**File**: `adalflow/adalflow/optim/optimize_anything.py` (removed, +0/-269)
```diff
@@ -1,269 +0,0 @@
-"""GEPA-style optimize_anything API for arbitrary text artifacts."""
-
-from __future__ import annotations
-
-from contextvars import ContextVar
-from dataclasses import dataclass, field
-from random import Random
-from time import perf_counter
-from typing import Any, Callable, Dict, List, Optional, Sequence, Union
-
-from adalflow.core.base_data_class import DataClass
-
-
-_EVAL_LOG_BUFFER: ContextVar[Optional[List[str]]] = ContextVar(
-    "optimize_anything_eval_log_buffer", default=None
-)
-
-
-def log(message: str) -> None:
-    """Log actionable side information during evaluator execution."""
-    buffer = _EVAL_LOG_BUFFER.get()
-    if buffer is None:
-        return
-    buffer.append(str(message))
-
-
-@dataclass
-class EngineConfig(DataClass):
-    """Execution budget and runtime controls."""
-
-    max_metric_calls: int = field(default=100)
-    max_parallel: int = field(default=1)
-    random_seed: int = field(default=0)
-
-
-@dataclass
-class GEPAConfig(DataClass):
-    """Optimization controls for evolutionary + Pareto search."""
-
-    engine: EngineConfig = field(default_factory=EngineConfig)
-    population_size: int = field(default=8)
-    elite_size: int = field(default=3)
-    mutation_rate: float = field(default=0.7)
-    crossover_rate: float = field(default=0.2)
-    stop_score: Optional[float] = field(default=None)
-
-
-@dataclass
-class CandidateEvaluation(DataClass):
-    candidate: str = field(default="")
-    score: float = field(default=0.0)
-    token_cost: int = field(default=0)
-    latency_ms: float = field(default=0.0)
-    side_info: List[str] = field(default_factory=list)
-
-
-@dataclass
-class OptimizeAnythingResult(DataClass):
-    best_candidate: str = field(default="")
-    best_score: float = field(default=0.0)
-    metric_calls: int = field(default=0)
-    history: List[CandidateEvaluation] = field(default_factory=list)
-    pareto_frontier: List[CandidateEvaluation] = field(default_factory=list)
-    objective: str = field(default="")
-
-
-def _extract_eval_output(result: Union[float, int, Dict[str, Any]]) -> Dict[str, float]:
-    if isinstance(result, (float, int)):
-        return {"score": float(result)}
-    if isinstance(result, dict):
-        if "score" not in result:
-            raise ValueError("evaluator dict output must include 'score'")
-        output = {"score": float(result["score"])}
-        if "token_cost" in result and result["token_cost"] is not None:
-            output["token_cost"] = float(result["token_cost"])
-        if "latency_ms" in result and result["latency_ms"] is not None:
-            output["latency_ms"] = float(result["latency_ms"])
-        return output
-    raise TypeError("evaluator must return float/int or dict containing 'score'")
-
-
-def _estimate_token_cost(candidate: str) -> int:
-    stripped = candidate.strip()
-    if not stripped:
-        return 0
-    return len(stripped.split())
-
-
-def _dominates(a: CandidateEvaluation, b: CandidateEvaluation) -> bool:
-    not_worse = (
-        a.score >= b.score
-        and a.token_cost <= b.token_cost
-        and a.latency_ms <= b.latency_ms
-    )
-    strictly_better = (
-        a.score > b.score
-        or a.token_cost < b.token_cost
-        or a.latency_ms < b.latency_ms
-    )
-    return not_worse and strictly_better
-
-
-def _compute_pareto_frontier(
-    records: Sequence[CandidateEvaluation],
-) -> List[CandidateEvaluation]:
-    frontier: List[CandidateEvaluation] = []
-    for candidate in records:
-        dominated = False
-        for other in records:
-            if other is candidate:
-                continue
-            if _dominates(other, candidate):
-                dominated = True
-                break
-        if not dominated:
-            frontier.append(candidate)
-    frontier.sort(key=lambda item: (-item.score, item.token_cost, item.latency_ms))
-    return frontier
-
-
-def _mutate(candidate: str, objective: str, side_info: Sequence[str], rng: Random) -> str:
-    lines = candidate.splitlines()
-    hints = [item for item in side_info if item]
-    hint = hints[-1][:180] if hints else f"Objective: {objective[:120]}"
-
-    operation = rng.choice(["append_hint", "prepend_hint", "line_swap", "dedupe_spaces"])
-
-    if operation == "append_hint":
-        return f"{candidate}\n# Hint: {hint}".strip()
-    if operation == "prepend_hint":
-        return f"# Objective: {objective}\n{candidate}".strip()
-    if operation == "line_swap" and len(lines) >= 2:
-        idx_a = rng.randrange(len(lines))
-        idx_b = rng.randrange(len(lines))
-        lines[idx_a], lines[idx_b] = lines[idx_b], lines[idx_a]
-        return "\n".join(lines)
-    return " ".join(candidate.split())
-
-
-def _crossover(left: str, right: str, rng: Random) -> str:
-    left_lines = left.splitlines()
-    right_lines = right.splitlines()
-    if not left_lines or not right_lines:
-        return left if left else right
-    left_cut = rng.randran
```

**File**: `adalflow/tests/test_optimize_anything.py` (removed, +0/-75)
```diff
@@ -1,75 +0,0 @@
-from adalflow.optim.optimize_anything import (
-    EngineConfig,
-    GEPAConfig,
-    optimize_anything,
-    log,
-)
-
-
-def test_optimize_anything_respects_max_metric_calls():
-    calls = {"count": 0}
-
-    def evaluator(candidate: str) -> float:
-        calls["count"] += 1
-        log(f"len={len(candidate)}")
-        return float(candidate.count("good"))
-
-    result = optimize_anything(
-        seed_candidate="good",
-        evaluator=evaluator,
-        objective="increase 'good' count",
-        config=GEPAConfig(engine=EngineConfig(max_metric_calls=5, random_seed=1)),
-    )
-
-    assert result.metric_calls == 5
-    assert calls["count"] == 5
-    assert len(result.history) == 5
-
-
-def test_optimize_anything_returns_seed_when_no_improvement():
-    def evaluator(candidate: str) -> float:
-        log("constant score")
-        return 0.5
-
-    seed = "artifact"
-    result = optimize_anything(
-        seed_candidate=seed,
-        evaluator=evaluator,
-        objective="no-op",
-        config=GEPAConfig(engine=EngineConfig(max_metric_calls=4, random_seed=2)),
-    )
-
-    assert result.best_candidate == seed
-    assert result.best_score == 0.5
-
-
-def test_optimize_anything_improves_on_toy_objective():
-    def evaluator(candidate: str):
-        # shorter candidate is better, but still uses score max convention
-        score = 1.0 / (1 + len(candidate))
-        log(f"candidate={candidate[:20]}")
-        return {"score": score}
-
-    result = optimize_anything(
-        seed_candidate="this is a very long seed candidate",
-        evaluator=evaluator,
-        objective="minimize length",
-        config=GEPAConfig(
-            engine=EngineConfig(max_metric_calls=12, random_seed=7),
-            population_size=6,
-            elite_size=2,
-            mutation_rate=0.9,
-            crossover_rate=0.0,
-        ),
-    )
-
-    assert result.best_score >= result.history[0].score
-    assert result.pareto_frontier
-
-
-def test_optimize_anything_is_exported_from_top_level():
-    import adalflow as adal
-
-    assert hasattr(adal, "optimize_anything")
-    assert hasattr(adal, "GEPAConfig")
-    assert hasattr(adal, "EngineConfig")
\ No newline at end of file
```

**File**: `benchmarks/optimize_anything/README.md` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-# optimize_anything benchmark (GEPA-style scaffold)
-
-This benchmark provides a reproducible scaffold for `adalflow.optim.optimize_anything` across
-three artifact categories:
-
-1. text/prompt artifact
-2. code artifact
-3. config/SVG-like artifact
-
-Each run reports:
-- quality score (maximize)
-- token_cost (minimize)
-- latency_ms (minimize)
-
-## Run
-
-```bash
-python benchmarks/optimize_anything/gepa_parity_benchmark.py
-```
-
-The script prints JSON containing baseline (seed) and optimized metrics for each case.
\ No newline at end of file
```

**File**: `benchmarks/optimize_anything/gepa_parity_benchmark.py` (removed, +0/-82)
```diff
@@ -1,82 +0,0 @@
-"""GEPA-style benchmark scaffold for optimize_anything.
-
-Tracks:
-1) prompt/text artifact
-2) code artifact
-3) config/svg-like artifact
-
-Metrics:
-- quality score (maximize)
-- token_cost (minimize)
-- latency_ms (minimize)
-"""
-
-from __future__ import annotations
-
-from pathlib import Path
-import sys
-from typing import Dict
-
-# Ensure benchmark resolves local source package from this repository.
-sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "adalflow"))
-
-from adalflow import EngineConfig, GEPAConfig, optimize_anything, log
-
-
-def _run_case(name: str, seed_candidate: str, target_keyword: str) -> Dict[str, float]:
-    def evaluator(candidate: str):
-        quality = 1.0 if target_keyword in candidate else 0.2
-        quality += min(candidate.count(target_keyword), 3) * 0.1
-        quality -= 0.01 * len(candidate.split())
-        log(f"target={target_keyword}, contains={target_keyword in candidate}")
-        return {"score": quality}
-
-    result = optimize_anything(
-        seed_candidate=seed_candidate,
-        evaluator=evaluator,
-        objective=f"Increase quality for {name} while reducing verbosity.",
-        config=GEPAConfig(
-            engine=EngineConfig(max_metric_calls=30, random_seed=42),
-            population_size=10,
-            elite_size=3,
-            mutation_rate=0.8,
-            crossover_rate=0.2,
-        ),
-    )
-
-    baseline = result.history[0]
-    return {
-        "baseline_score": baseline.score,
-        "best_score": result.best_score,
-        "baseline_token_cost": baseline.token_cost,
-        "best_token_cost": min(item.token_cost for item in result.pareto_frontier),
-        "baseline_latency_ms": baseline.latency_ms,
-        "best_latency_ms": min(item.latency_ms for item in result.pareto_frontier),
-    }
-
-
-def run_benchmark() -> Dict[str, Dict[str, float]]:
-    return {
-        "text_artifact": _run_case(
-            "text_artifact",
-            "You are an assistant. Provide detailed answer.",
-            "concise",
-        ),
-        "code_artifact": _run_case(
-            "code_artifact",
-            "def add(a,b): return a+b",
-            "type hints",
-        ),
-        "config_svg_artifact": _run_case(
-            "config_svg_artifact",
-            "<svg><circle r='5'/></svg>",
-            "viewBox",
-        ),
-    }
-
-
-if __name__ == "__main__":
-    import json
-
-    results = run_benchmark()
-    print(json.dumps(results, indent=2))
\ No newline at end of file
```

---

### Incident Patch 6: `8211f5c8` (2026-01-27)
**Commit Message**: Merge pull request #462 from stevezkw1998/stevezkw-fix/eval_retriever.py

Fix breaking change in tutorials/evaluation/eval_retriever.py

**File**: `adalflow/adalflow/eval/retriever_recall.py` (modified, +1/-3)
```diff
@@ -92,9 +92,7 @@ def compute(
             gt_contexts ( List[List[str]]): List of ground truth context strings.
 
         Returns:
-            tuple:
-                - float: Average recall value.
-                - List[float]: Recall values for each query.
+            EvaluationResult: Evaluation result containing the average recall and precision, and the recall and precision list for each query.
         """
         if len(retrieved_contexts) != len(gt_contexts):
             raise ValueError(
```

**File**: `tutorials/evaluation/eval_retriever.py` (modified, +10/-8)
```diff
@@ -1,8 +1,10 @@
-from adalflow.eval import RetrieverRecall
+import json
+
+from adalflow.eval import RetrieverEvaluator
 
 retrieved_contexts = [
-    "Apple is founded before Google.",
-    "Feburary has 28 days in common years. Feburary has 29 days in leap years. Feburary is the second month of the year.",
+    ["Apple is founded before Google."],
+    ["Feburary has 28 days in common years. Feburary has 29 days in leap years. Feburary is the second month of the year."],
 ]
 gt_contexts = [
     [
@@ -15,11 +17,11 @@
 
 
 def evaluate_retriever(retrieved_contexts, gt_contexts):
-    retriever_recall = RetrieverRecall()
-    avg_recall, recall_list = retriever_recall.compute(retrieved_contexts, gt_contexts)
-    return avg_recall, recall_list
+    retriever_recall = RetrieverEvaluator()
+    eval_result = retriever_recall.compute(retrieved_contexts, gt_contexts)
+    return eval_result
 
 
 if __name__ == "__main__":
-    avg_recall, recall_list = evaluate_retriever(retrieved_contexts, gt_contexts)
-    print(f"avg_recall: {avg_recall}, recall_list: {recall_list}")
+    eval_result = evaluate_retriever(retrieved_contexts, gt_contexts)
+    print(f"eval_result: {json.dumps(eval_result, indent=4)}")
```

---

### Incident Patch 7: `d39d4f59` (2026-01-27)
**Commit Message**: fix: double logo sizes and match heights (100px)

**File**: `README.md` (modified, +2/-4)
```diff
@@ -16,10 +16,8 @@
 </h2>
 
 <p align="center">
-    <a href="https://sylph.ai">
-        <img src="docs/source/_static/images/adal-face-logo.svg" alt="AdaL" height="70" style="vertical-align: middle;">&nbsp;&nbsp;
-        <img src="docs/source/_static/images/adal-text-logo.svg" alt="AdaL CLI" height="55" style="vertical-align: middle;">
-    </a>
+    <a href="https://sylph.ai"><img src="docs/source/_static/images/adal-face-logo.svg" alt="AdaL" height="100"></a>&nbsp;
+    <a href="https://sylph.ai"><img src="docs/source/_static/images/adal-text-logo.svg" alt="AdaL CLI" height="100"></a>
     <br><br>
     <strong>AdalFlow proudly powers <a href="https://sylph.ai">AdaL CLI</a></strong> — The AI coding agent
 </p>
```

---

### Incident Patch 8: `ce03af5a` (2025-12-13)
**Commit Message**: fix tutorials/evaluation/eval_retriever.py breaking change

**File**: `tutorials/evaluation/eval_retriever.py` (modified, +10/-8)
```diff
@@ -1,8 +1,10 @@
-from adalflow.eval import RetrieverRecall
+import json
+
+from adalflow.eval import RetrieverEvaluator
 
 retrieved_contexts = [
-    "Apple is founded before Google.",
-    "Feburary has 28 days in common years. Feburary has 29 days in leap years. Feburary is the second month of the year.",
+    ["Apple is founded before Google."],
+    ["Feburary has 28 days in common years. Feburary has 29 days in leap years. Feburary is the second month of the year."],
 ]
 gt_contexts = [
     [
@@ -15,11 +17,11 @@
 
 
 def evaluate_retriever(retrieved_contexts, gt_contexts):
-    retriever_recall = RetrieverRecall()
-    avg_recall, recall_list = retriever_recall.compute(retrieved_contexts, gt_contexts)
-    return avg_recall, recall_list
+    retriever_recall = RetrieverEvaluator()
+    eval_result = retriever_recall.compute(retrieved_contexts, gt_contexts)
+    return eval_result
 
 
 if __name__ == "__main__":
-    avg_recall, recall_list = evaluate_retriever(retrieved_contexts, gt_contexts)
-    print(f"avg_recall: {avg_recall}, recall_list: {recall_list}")
+    eval_result = evaluate_retriever(retrieved_contexts, gt_contexts)
+    print(f"eval_result: {json.dumps(eval_result, indent=4)}")
```

---

### Incident Patch 9: `a23a7e2d` (2025-12-13)
**Commit Message**: fix: Add comment regarding mlflow 3.7.0 import issue in tracing integration

**File**: `adalflow/adalflow/tracing/mlflow_integration.py` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@
 try:
     # Do NOT set ADALFLOW_DISABLE_TRACING here - it should be set before imports
     import mlflow
+    # BUG: This import is not working for mlflow 3.7.0
     from mlflow.openai._agent_tracer import MlflowOpenAgentTracingProcessor
 
     MLFLOW_AVAILABLE = True
```

---

### Incident Patch 10: `8439ce31` (2025-11-25)
**Commit Message**: Fix typo in progress bar description

**File**: `adalflow/adalflow/optim/trainer/adal.py` (modified, +1/-1)
```diff
@@ -430,7 +430,7 @@ def pred_step(
             tqdm_loader = tqdm(
                 total=len(futures),
                 position=0,
-                desc=f"Prediting step: {batch_idx}",
+                desc=f"Predicting step: {batch_idx}",
             )
             for future, i, sample in futures:
                 y_pred = future.result()
```

---

### Incident Patch 11: `2cb9c777` (2025-09-22)
**Commit Message**: Merge pull request #450 from shangliy/feat/memory_colab

feat: add tutorial notebook using adalflow to build agent with memory

**File**: `notebooks/tutorials/adalflow_agent_memory.ipynb` (added, +811/-0)
```diff
@@ -0,0 +1,811 @@
+{
+  "nbformat": 4,
+  "nbformat_minor": 0,
+  "metadata": {
+    "colab": {
+      "provenance": []
+    },
+    "kernelspec": {
+      "name": "python3",
+      "display_name": "Python 3"
+    },
+    "language_info": {
+      "name": "python"
+    }
+  },
+  "cells": [
+    {
+      "cell_type": "markdown",
+      "source": [
+        "# 🧠 Persistent Memory Agent + AdalFlow (Colab Tutorial)\n",
+        "\n",
+        "This Colab walks you through building a **memory-aware AI agent** using **AdalFlow** with:\n",
+        "- **Persistent memory** across multiple sessions (file-backed)\n",
+        "- **Short-term vs long-term** knowledge\n",
+        "- **History compaction** (auto-summarization to avoid prompt bloat)\n",
+        "- **Memory tools** (`remember`, `recall`, `jot`, `counter`) the agent can call\n",
+        "- **Design principles** for agent knowledge & architecture"
+      ],
+      "metadata": {
+        "id": "8BVYEBB33cLz"
+      }
+    },
+    {
+      "cell_type": "code",
+      "source": [
+        "from IPython.display import clear_output\n",
+        "\n",
+        "\n",
+        "!pip install adalflow pydantic openai\n",
+        "\n",
+        "# Set OpenAI API key (replace with your actual key)\n",
+        "import os\n",
+        "os.environ[\"OPENAI_API_KEY\"] = \"\"\n",
+        "# Optional: Set Anthropic API key for Anthropic examples\n",
+        "# os.environ[\"ANTHROPIC_API_KEY\"] = \"your-anthropic-api-key-here\"\n",
+        "clear_output()"
+      ],
+      "metadata": {
+        "id": "nFrfHjtv3d8X"
+      },
+      "execution_count": null,
+      "outputs": []
+    },
+    {
+      "cell_type": "markdown",
+      "source": [
+        "## Setup and Imports"
+      ],
+      "metadata": {
+        "id": "_FsTzCDA4V_C"
+      }
+    },
+    {
+      "cell_type": "code",
+      "source": [
+        "import json\n",
+        "import os\n",
+        "import threading\n",
+        "from datetime import datetime\n",
+        "from typing import Any, Dict, List, Optional\n",
+        "\n",
+        "from adalflow.components.agent.agent import Agent\n",
+        "from adalflow.components.agent.runner import Runner\n",
+        "from adalflow.components.model_client import OpenAIClient\n",
+        "from adalflow.components.model_client.anthropic_client import AnthropicAPIClient\n",
+        "from adalflow.core.func_tool import FunctionTool"
+      ],
+      "metadata": {
+        "id": "N6Lf6LfU38nz",
+        "colab": {
+          "base_uri": "https://localhost:8080/"
+        },
+        "outputId": "4292a767-abc5-4ed8-ec0f-1133ef8a21ce"
+      },
+      "execution_count": null,
+      "outputs": [
+        {
+          "output_type": "stream",
+          "name": "stderr",
+          "text": [
+            "WARNING:adalflow.tracing.mlflow_integration:MLflow not available. Install with: pip install mlflow\n"
+          ]
+        }
+      ]
+    },
+    {
+      "cell_type": "markdown",
+      "source": [
+        "# JSONMemoryStore (persistent, thread-safe)\n",
+        "\n",
+        "You want agent knowledge to outlive the Python process and be safe under concurrent access.\n",
+        "\n",
+        "**Key ideas**\n",
+        "\n",
+        "- short_term: injected verbatim into the prompt (fast recall, higher token cost).\n",
+        "\n",
+        "- long_term: durable facts + an evolving summary created from older history (compact).\n",
+        "\n",
+        "- global: rare, cross-session settings (e.g., shared counters, feature flags).\n",
+        "\n",
+        "**Important methods**\n",
+        "\n",
+        "- ensure_session(session_id): lazily creates session buckets.\n",
+        "\n",
+        "- append_history(session_id, role, content): adds turns.\n",
+        "\n",
+        "- remember_fact(session_id, key, value, scope): writes to short_term or long_term.\n",
+        "\n",
+        "- recall_fact(session_id, key): reads (prefers short_term, falls back to long_term).\n",
+        "\n",
+        "- set_summary(session_id, summary): saves a long-term compressed summary.\n",
+        "\n",
+        "Swap JSON for SQLite/Postgres/Redis later; keep the same method signatures so the rest of the code doesn't change."
+      ],
+      "metadata": {
+        "id": "C0ihKNIs5Dop"
+      }
+    },
+    {
+      "cell_type": "code",
+      "source": [
+        "# ========= Persistent Memory Layer =========\n",
+        "class JSONMemoryStore:\n",
+        "    \"\"\"\n",
+        "    Thread-safe, file-backed memory store.\n",
+        "    Structure:\n",
+        "    {\n",
+        "      \"global\": {...},                       # global facts/counters\n",
+        "      \"sessions\": {\n",
+        "        \"<session_id>\": {\n",
+        "          \"created_at\": \"...\",\n",
+        "          \"short_term\": { \"notes\": [...], \"facts\": {...} },\n",
+        "          \"long_term\": { \"summary\": \"...\", \"facts\": {...} },\n",
```

---

### Incident Patch 12: `fc039a06` (2025-09-21)
**Commit Message**: feat: add tutorial notebook using adalflow to build agent with memory

**File**: `notebooks/tutorials/adalflow_agent_memory.ipynb` (added, +811/-0)
```diff
@@ -0,0 +1,811 @@
+{
+  "nbformat": 4,
+  "nbformat_minor": 0,
+  "metadata": {
+    "colab": {
+      "provenance": []
+    },
+    "kernelspec": {
+      "name": "python3",
+      "display_name": "Python 3"
+    },
+    "language_info": {
+      "name": "python"
+    }
+  },
+  "cells": [
+    {
+      "cell_type": "markdown",
+      "source": [
+        "# 🧠 Persistent Memory Agent + AdalFlow (Colab Tutorial)\n",
+        "\n",
+        "This Colab walks you through building a **memory-aware AI agent** using **AdalFlow** with:\n",
+        "- **Persistent memory** across multiple sessions (file-backed)\n",
+        "- **Short-term vs long-term** knowledge\n",
+        "- **History compaction** (auto-summarization to avoid prompt bloat)\n",
+        "- **Memory tools** (`remember`, `recall`, `jot`, `counter`) the agent can call\n",
+        "- **Design principles** for agent knowledge & architecture"
+      ],
+      "metadata": {
+        "id": "8BVYEBB33cLz"
+      }
+    },
+    {
+      "cell_type": "code",
+      "source": [
+        "from IPython.display import clear_output\n",
+        "\n",
+        "\n",
+        "!pip install adalflow pydantic openai\n",
+        "\n",
+        "# Set OpenAI API key (replace with your actual key)\n",
+        "import os\n",
+        "os.environ[\"OPENAI_API_KEY\"] = \"\"\n",
+        "# Optional: Set Anthropic API key for Anthropic examples\n",
+        "# os.environ[\"ANTHROPIC_API_KEY\"] = \"your-anthropic-api-key-here\"\n",
+        "clear_output()"
+      ],
+      "metadata": {
+        "id": "nFrfHjtv3d8X"
+      },
+      "execution_count": null,
+      "outputs": []
+    },
+    {
+      "cell_type": "markdown",
+      "source": [
+        "## Setup and Imports"
+      ],
+      "metadata": {
+        "id": "_FsTzCDA4V_C"
+      }
+    },
+    {
+      "cell_type": "code",
+      "source": [
+        "import json\n",
+        "import os\n",
+        "import threading\n",
+        "from datetime import datetime\n",
+        "from typing import Any, Dict, List, Optional\n",
+        "\n",
+        "from adalflow.components.agent.agent import Agent\n",
+        "from adalflow.components.agent.runner import Runner\n",
+        "from adalflow.components.model_client import OpenAIClient\n",
+        "from adalflow.components.model_client.anthropic_client import AnthropicAPIClient\n",
+        "from adalflow.core.func_tool import FunctionTool"
+      ],
+      "metadata": {
+        "id": "N6Lf6LfU38nz",
+        "colab": {
+          "base_uri": "https://localhost:8080/"
+        },
+        "outputId": "4292a767-abc5-4ed8-ec0f-1133ef8a21ce"
+      },
+      "execution_count": null,
+      "outputs": [
+        {
+          "output_type": "stream",
+          "name": "stderr",
+          "text": [
+            "WARNING:adalflow.tracing.mlflow_integration:MLflow not available. Install with: pip install mlflow\n"
+          ]
+        }
+      ]
+    },
+    {
+      "cell_type": "markdown",
+      "source": [
+        "# JSONMemoryStore (persistent, thread-safe)\n",
+        "\n",
+        "You want agent knowledge to outlive the Python process and be safe under concurrent access.\n",
+        "\n",
+        "**Key ideas**\n",
+        "\n",
+        "- short_term: injected verbatim into the prompt (fast recall, higher token cost).\n",
+        "\n",
+        "- long_term: durable facts + an evolving summary created from older history (compact).\n",
+        "\n",
+        "- global: rare, cross-session settings (e.g., shared counters, feature flags).\n",
+        "\n",
+        "**Important methods**\n",
+        "\n",
+        "- ensure_session(session_id): lazily creates session buckets.\n",
+        "\n",
+        "- append_history(session_id, role, content): adds turns.\n",
+        "\n",
+        "- remember_fact(session_id, key, value, scope): writes to short_term or long_term.\n",
+        "\n",
+        "- recall_fact(session_id, key): reads (prefers short_term, falls back to long_term).\n",
+        "\n",
+        "- set_summary(session_id, summary): saves a long-term compressed summary.\n",
+        "\n",
+        "Swap JSON for SQLite/Postgres/Redis later; keep the same method signatures so the rest of the code doesn't change."
+      ],
+      "metadata": {
+        "id": "C0ihKNIs5Dop"
+      }
+    },
+    {
+      "cell_type": "code",
+      "source": [
+        "# ========= Persistent Memory Layer =========\n",
+        "class JSONMemoryStore:\n",
+        "    \"\"\"\n",
+        "    Thread-safe, file-backed memory store.\n",
+        "    Structure:\n",
+        "    {\n",
+        "      \"global\": {...},                       # global facts/counters\n",
+        "      \"sessions\": {\n",
+        "        \"<session_id>\": {\n",
+        "          \"created_at\": \"...\",\n",
+        "          \"short_term\": { \"notes\": [...], \"facts\": {...} },\n",
+        "          \"long_term\": { \"summary\": \"...\", \"facts\": {...} },\n",
```

---

### Incident Patch 13: `699bb020` (2025-09-18)
**Commit Message**: Merge pull request #444 from simarjeetss/dev/rag-eval-fix

fixed wrong import, method call signature, empty list checks

**File**: `adalflow/adalflow/components/retriever/faiss_retriever.py` (modified, +7/-0)
```diff
@@ -164,6 +164,13 @@ def build_index_from_documents(
         if document_map_func:
             assert callable(document_map_func), "document_map_func should be callable"
             documents = [document_map_func(doc) for doc in documents]
+        
+        # check if documents list is empty to prevent IndexError
+        if len(documents) == 0:
+            log.warning("empty documents list provided to build_index_from_documents")
+            self.reset_index()
+            return
+            
         try:
             self.documents = documents
 
```

**File**: `use_cases/rag/build/rag.py` (modified, +13/-1)
```diff
@@ -1,5 +1,6 @@
 from typing import Any, List, Optional
 import os
+import logging
 from adalflow.core import Component, Generator, Embedder, Sequential
 from adalflow.core.types import Document, ModelClientType
 from adalflow.core.string_parser import JsonParser
@@ -18,6 +19,8 @@
 setup_env()
 # TODO: RAG can potentially be a component itsefl and be provided to the users
 
+log = logging.getLogger(__name__)
+
 configs = {
     "embedder": {
         "batch_size": 100,
@@ -156,10 +159,19 @@ def add_documents(self, docs: List[Document]):
         self.db.save_state(self.index_path)
 
     def get_transformed_docs(self, filter_func=None):
-        return self.db.get_transformed_data("data_transformer", filter_func)
+        # fix: use keyword arguments to match the expected method signature
+        return self.db.get_transformed_data(key="data_transformer", filter_fn=filter_func)
 
     def prepare_retriever(self, filter_func=None):
+        # get filtered documents for this specific query
         self.transformed_docs = self.get_transformed_docs(filter_func)
+        
+        # handle case where no documents match the filter
+        if not self.transformed_docs:
+            log.warning("no documents found matching the filter criteria")
+            return
+            
+        # build the retriever index from the filtered documents
         self.retriever.build_index_from_documents(
             self.transformed_docs, document_map_func=lambda doc: doc.vector
         )
```

**File**: `use_cases/rag/rag_with_eval.py` (modified, +46/-24)
```diff
@@ -5,7 +5,7 @@
 from use_cases.rag.build.rag import (
     RAG,
 )
-from adalflow.eval.retriever_recall import RetrieverRecall
+from adalflow.eval.retriever_recall import RetrieverEvaluator
 from adalflow.eval.answer_match_acc import AnswerMatchAcc
 from adalflow.eval.llm_as_judge import LLMasJudge
 
@@ -22,7 +22,7 @@ def get_supporting_sentences(
     supporting_facts: dict[str, list[Union[str, int]]], context: dict[str, list[str]]
 ) -> List[str]:
     """
-    Extract the supporting sentences from the context based on the supporting facts.
+    extract the supporting sentences from the context based on the supporting facts.
     """
     extracted_sentences = []
     for title, sent_id in zip(supporting_facts["title"], supporting_facts["sent_id"]):
@@ -34,7 +34,7 @@ def get_supporting_sentences(
 
 
 def prepare_documents(dataset):
-    # For production use cases, you might consider batching the documents using a data loader
+    # for production use cases, you might consider batching the documents using a data loader
     docs = []
     for data in dataset:
         num_docs = len(data["context"]["title"])
@@ -62,9 +62,19 @@ def add_all_documents_to_rag_db(rag):
 if __name__ == "__main__":
 
     rag = RAG(index_file="hotpot_qa_index.faiss")
-    # add_all_documents_to_rag_db(rag)
-    print(rag.transformed_docs)
-
+    
+    # debug: check if documents are loaded and show sample data
+    print(f"number of transformed docs: {len(rag.transformed_docs)}")
+    if rag.transformed_docs:
+        print(f"sample transformed doc: {rag.transformed_docs[0]}")
+        print(f"sample parent_doc_id: {rag.transformed_docs[0].parent_doc_id}")
+    else:
+        print("warning: no documents found in the rag system")
+        print("uncomment the line below to add documents if they don't exist")
+        # add_all_documents_to_rag_db(rag)
+        # exit early if no documents are available
+        exit(1)
+    
     dataset = load_hotpot_qa()
     questions, retrieved_contexts, gt_contexts, pred_answers, gt_answers = (
         [],
@@ -76,13 +86,21 @@ def add_all_documents_to_rag_db(rag):
     for item in dataset:
         id = item["id"]
         doc_ids = [f"doc_{id}_{i}" for i in range(len(item["context"]["title"]))]
-        # transformed_docs = rag.get_transformed_docs(
-        #     filter_func=lambda x: id in x.parent_doc_id
-        # )
-        # print(f"id: {id}")
-        # print(f"transformed_docs: {[ (doc.id, doc.order, doc.parent_doc_id)
-        #                              for doc in transformed_docs]}")
+        print(f"looking for doc_ids: {doc_ids}")
+        
+        # debug: check what documents match the filter before processing
+        all_transformed_docs = rag.get_transformed_docs(filter_func=None)
+        matching_docs = [doc for doc in all_transformed_docs if doc.parent_doc_id in doc_ids]
+        print(f"found {len(matching_docs)} matching documents")
+        
+        # prepare retriever with filtered documents for this specific item
         rag.prepare_retriever(filter_func=lambda x: x.parent_doc_id in doc_ids)
+        
+        # handle case where no documents are found for this item
+        if not rag.transformed_docs:
+            print(f"warning: no documents found for item {id}. skipping...")
+            continue
+            
         response, context_str = rag.call(item["question"])
         gt_context_sentence_list = get_supporting_sentences(
             item["supporting_facts"], item["context"]
@@ -99,15 +117,19 @@ def add_all_documents_to_rag_db(rag):
         print(f"predicted answer: {response.data['answer']}")
         print(f"ground truth answer: {item['answer']}")
 
-    avg_recall = RetrieverRecall().compute(retrieved_contexts, gt_contexts)
-    answer_match_acc = AnswerMatchAcc(type="fuzzy_match")
-    acc_rslt = answer_match_acc.compute(
-        pred_answers=pred_answers, gt_answers=gt_answers
-    )
-    llm_judge = LLMasJudge()
-    judge_acc_rslt = llm_judge.compute(
-        questions=questions, gt_answers=gt_answers, pred_answers=pred_answers
-    )
-    print(f"judge_acc_rslt: {judge_acc_rslt}")
-    print(f"avg_recall: {avg_recall}")
-    print(f"avg_acc: {acc_rslt}")
+    # only compute metrics if we have results to evaluate
+    if questions:
+        avg_recall = RetrieverEvaluator().compute(retrieved_contexts, gt_contexts)
+        answer_match_acc = AnswerMatchAcc(type="fuzzy_match")
+        acc_rslt = answer_match_acc.compute(
+            pred_answers=pred_answers, gt_answers=gt_answers
+        )
+        llm_judge = LLMasJudge()
+        judge_acc_rslt = llm_judge.compute(
+            questions=questions, gt_answers=gt_answers, pred_answers=pred_answers
+        )
+        print(f"judge_acc_rslt: {judge_acc_rslt}")
+        print(f"avg_recall: {avg_recall}")
+        print(f"avg_acc: {acc_rslt}")
+    else:
+        print("no questions were processed. please check if documents were loaded correctly.")
```

---

### Incident Patch 14: `5654cebf` (2025-09-16)
**Commit Message**: Merge pull request #445 from pxkundu/fix-issue-292-replace-wget-with-urllib

Fix #292: Replace wget with urllib.request for cross-platform compatibility

**File**: `adalflow/adalflow/datasets/big_bench_hard.py` (modified, +27/-20)
```diff
@@ -3,7 +3,8 @@
 import os
 import uuid
 from typing import Literal
-import subprocess
+import urllib.request
+import urllib.error
 from adalflow.utils.data import Dataset
 from adalflow.datasets.types import Example
 
@@ -75,34 +76,40 @@ def _check_or_download_dataset(self, data_path: str = None, split: str = "train"
 
         print(f"Downloading dataset to {json_path}")
         try:
-            # Use subprocess and capture the return code
-            result = subprocess.call(
-                [
-                    "wget",
-                    f"https://raw.githubusercontent.com/suzgunmirac/BIG-Bench-Hard/main/bbh/{self.task_name}.json",
-                    "-O",
-                    json_path,
-                ]
-            )
-
-            # Check if wget failed (non-zero exit code)
-            if result != 0:
-                raise ValueError(
-                    f"Failed to download dataset for task '{self.task_name}'.\n"
-                    "Please verify the task name (the JSON file name) by checking the following link:\n"
-                    "https://github.com/suzgunmirac/BIG-Bench-Hard/tree/main/bbh"
-                )
+            # Ensure the directory exists
+            os.makedirs(os.path.dirname(json_path), exist_ok=True)
+
+            # Use urllib.request instead of wget for cross-platform compatibility
+            url = f"https://raw.githubusercontent.com/suzgunmirac/BIG-Bench-Hard/main/bbh/{self.task_name}.json"
+            urllib.request.urlretrieve(url, json_path)
 
             # Check if the file is non-empty
             if not os.path.exists(json_path) or os.path.getsize(json_path) == 0:
                 raise ValueError(
                     f"Downloaded file is empty. Please check the task name '{self.task_name}' or network issues."
                 )
 
+        except urllib.error.HTTPError as e:
+            if e.code == 404:
+                raise ValueError(
+                    f"Task name '{self.task_name}' not found (HTTP 404).\n"
+                    "Please verify the task name (the JSON file name) by checking the following link:\n"
+                    "https://github.com/suzgunmirac/BIG-Bench-Hard/tree/main/bbh"
+                ) from e
+            else:
+                raise ValueError(
+                    f"Failed to download dataset for task '{self.task_name}' (HTTP {e.code}).\n"
+                    "Please check your internet connection or try again later."
+                ) from e
+        except urllib.error.URLError as e:
+            raise ValueError(
+                f"Network error while downloading dataset for task '{self.task_name}'.\n"
+                "Please check your internet connection and try again."
+            ) from e
         except Exception as e:
             raise ValueError(
-                f"Either network issues or an incorrect task name: '{self.task_name}'.\n"
-                "Please verify the task name (the JSON file name) by checking the following link:\n"
+                f"Unexpected error while downloading dataset for task '{self.task_name}': {str(e)}\n"
+                "Please verify the task name by checking the following link:\n"
                 "https://github.com/suzgunmirac/BIG-Bench-Hard/tree/main/bbh"
             ) from e
 
```

---

### Incident Patch 15: `840c24d6` (2025-09-13)
**Commit Message**: Fix #292: Replace wget with urllib.request for cross-platform compatibility

- Replace subprocess.call(['wget', ...]) with urllib.request.urlretrieve()
- Fix dataset download failure on Windows and minimal Docker images
- Add improved error handling with specific HTTP status codes
- Ensure directory creation before download
- Maintain backward compatibility and all existing functionality

Resolves: 'FileNotFoundError: The system cannot find the file specified'
on Windows when downloading BigBenchHard datasets.

**File**: `adalflow/adalflow/datasets/big_bench_hard.py` (modified, +27/-20)
```diff
@@ -3,7 +3,8 @@
 import os
 import uuid
 from typing import Literal
-import subprocess
+import urllib.request
+import urllib.error
 from adalflow.utils.data import Dataset
 from adalflow.datasets.types import Example
 
@@ -75,34 +76,40 @@ def _check_or_download_dataset(self, data_path: str = None, split: str = "train"
 
         print(f"Downloading dataset to {json_path}")
         try:
-            # Use subprocess and capture the return code
-            result = subprocess.call(
-                [
-                    "wget",
-                    f"https://raw.githubusercontent.com/suzgunmirac/BIG-Bench-Hard/main/bbh/{self.task_name}.json",
-                    "-O",
-                    json_path,
-                ]
-            )
-
-            # Check if wget failed (non-zero exit code)
-            if result != 0:
-                raise ValueError(
-                    f"Failed to download dataset for task '{self.task_name}'.\n"
-                    "Please verify the task name (the JSON file name) by checking the following link:\n"
-                    "https://github.com/suzgunmirac/BIG-Bench-Hard/tree/main/bbh"
-                )
+            # Ensure the directory exists
+            os.makedirs(os.path.dirname(json_path), exist_ok=True)
+
+            # Use urllib.request instead of wget for cross-platform compatibility
+            url = f"https://raw.githubusercontent.com/suzgunmirac/BIG-Bench-Hard/main/bbh/{self.task_name}.json"
+            urllib.request.urlretrieve(url, json_path)
 
             # Check if the file is non-empty
             if not os.path.exists(json_path) or os.path.getsize(json_path) == 0:
                 raise ValueError(
                     f"Downloaded file is empty. Please check the task name '{self.task_name}' or network issues."
                 )
 
+        except urllib.error.HTTPError as e:
+            if e.code == 404:
+                raise ValueError(
+                    f"Task name '{self.task_name}' not found (HTTP 404).\n"
+                    "Please verify the task name (the JSON file name) by checking the following link:\n"
+                    "https://github.com/suzgunmirac/BIG-Bench-Hard/tree/main/bbh"
+                ) from e
+            else:
+                raise ValueError(
+                    f"Failed to download dataset for task '{self.task_name}' (HTTP {e.code}).\n"
+                    "Please check your internet connection or try again later."
+                ) from e
+        except urllib.error.URLError as e:
+            raise ValueError(
+                f"Network error while downloading dataset for task '{self.task_name}'.\n"
+                "Please check your internet connection and try again."
+            ) from e
         except Exception as e:
             raise ValueError(
-                f"Either network issues or an incorrect task name: '{self.task_name}'.\n"
-                "Please verify the task name (the JSON file name) by checking the following link:\n"
+                f"Unexpected error while downloading dataset for task '{self.task_name}': {str(e)}\n"
+                "Please verify the task name by checking the following link:\n"
                 "https://github.com/suzgunmirac/BIG-Bench-Hard/tree/main/bbh"
             ) from e
 
```

#### Recent Merged Pull Requests:
- **PR #495** (closed): docs: add Tesla T4 (Turing) hardware notes for local model clients (@moduvoice)
- **PR #491** (2026-05-29): feat(benchmarks): add OpenEvolve-style research loop smoke benchmark (@shangliy)
- **PR #490** (2026-05-26): feat(optim): add intuitive evolution API design doc and runnable prototype (@shangliy)
- **PR #488** (2026-05-25): feat(optim): resubmit GEPA-style optimize_anything API and benchmark scaffold (@shangliy)
- **PR #487** (2026-05-25): Revert "feat(optim): add GEPA-style optimize_anything API and benchmark scaffold" (@shangliy)
- **PR #486** (2026-05-25): feat(optim): add GEPA-style optimize_anything API and benchmark scaffold (@shangliy)
- **PR #483** (closed): docs: add FAQ section for common questions (@meichuanyi)
- **PR #477** (closed): docs: Add community growth guide (@Gingiris)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
