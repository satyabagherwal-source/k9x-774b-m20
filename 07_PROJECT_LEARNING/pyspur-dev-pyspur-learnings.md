# Forensic Learning Record (Deep Inspection): PySpur-Dev/pyspur

> **Canonical Artifact**: `07_PROJECT_LEARNING/pyspur-dev-pyspur-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PySpur-Dev/pyspur](https://github.com/PySpur-Dev/pyspur))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:54:33.783Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PySpur-Dev/pyspur`
- **Description**: A visual playground for agentic workflows: Iterate over your agents 10x faster
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5799 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/pyspur/api/ai_management.py`
```
import json
import re
from typing import Any, Dict, List, Literal, Optional, cast

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel

from ..nodes.llm._utils import generate_text

router = APIRouter()


class SchemaGenerationRequest(BaseModel):
    description: str
    existing_schema: Optional[str] = None


class MessageGenerationRequest(BaseModel):
    description: str
    message_type: Literal["system", "user"]  # "system" or "user"
    existing_message: Optional[str] = None
    context: Optional[str] = None
    available_variables: Optional[List[str]] = None


@router.post("/generate_schema/")
async def generate_schema(request: SchemaGenerationRequest) -> Dict[str, Any]:
    response: str = ""
    try:
        # Prepare the system message
        system_message = """You are a JSON Schema expert. Your task is to generate a JSON Schema
        based on a text description.
        The schema should:
        1. Follow JSON Schema standards
        2. Include appropriate types, required fields, and descriptions
        3. Be clear and well-structured
        4. Include type: "object" at the root
        5. Include a properties object
        6. Set appropriate required fields
        7. Include meaningful descriptions for each field
        8. Return ONLY the JSON schema without any markdown formatting or explanation

        Here are some examples:

        <example>
        Input: "Create a schema for a person with name, age and optional email"
        Output: {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The person's full name"
                },
                "age": {
                    "type": "integer",
                    "description": "The person's age in years",
                    "minimum": 0
                },
                "email": {
                    "type": "string",
                    "description": "The person's email address",
                    "format": "email"
                }
            },
            "required": ["name", "age"]
        }
        </example>

        <example>
        Input: "Schema for a blog post with title, content, author details and tags"
        Output: {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "The title of the blog post"
                },
                "content": {
                    "type": "string",
                    "description": "The main content of the blog post"
                },
                "author": {
                    "type": "object",
                    "description": "Details about the post author",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Author's full name"
                        },
                        "bio": {
                            "type": "string",
                            "description": "Short biography of the author"
                        }
                    },
                    "required": ["name"]
                },
                "tags": {
                    "type": "array",
                    "description": "List of tags associated with the post",
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": ["title", "content", "author"]
        }
        </example>
        """

        # Prepare the user message
        user_message = (
            f"Generate a JSON Schema for the following description:\n{request.description}"
        )

        if request.existing_schema:
            user_message += (
                f"\n\nPlease consider this existing schema as context:\n{request.existing_schema}"
            )
            user_message += (
                "\nModify it based on the description while preserving any compatible parts."
            )

        # Call the LLM
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ]

        message_response = await generate_text(
            messages=messages, model_name="openai/o3-mini", json_mode=True
        )
        assert message_response.content, "No response from LLM"
        response = message_response.content

        # Try to parse the response in different ways
        try:
            # First try: direct JSON parse
            schema = json.loads(response)
            if isinstance(schema, dict) and "output" in schema:
                # If we got a wrapper object with an "output" key, extract the schema from it
                schema_str = cast(str, schema["output"])
                # Extract JSON from potential markdown code blocks
                json_match = re.search(r"```json\s*(.*?)\s*```", schema_str, re.DOTALL)
                if json_match:
                    schema_str = json_match.group(1)
                schema = json.loads(schema_str)
        except json.JSONDecodeError as e:
            # Second try: Look for JSON in markdown code blocks
            json_match = re.search(r"```(?:json)?\s*(.*?)\s*```", response, re.DOTALL)
            if json_match:
                schema = json.loads(json_match.group(1))
            else:
                raise ValueError("Could not extract valid JSON schema from response") from e

        # Validate the schema structure
        if not isinstance(schema, dict) or "type" not in schema or "properties" not in schema:
            raise ValueError("Generated schema is not valid - missing required fields")

        return cast(Dict[str, Any], schema)

    except Exception as e:
        # Log the raw response if it exists and is not empty
        if response:
            truncated_response = response[:1000] + "..." if len(response) > 1000 else response
            logger.error(f"Schema generation failed. response (truncated): {truncated_response}.")
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/generate_message/")
async def generate_message(request: MessageGenerationRequest) -> Dict[str, str]:
    response: str = ""
    try:
        # Prepare the system message based on the message type
        if request.message_type == "system":
            system_message = """You are an expert at crafting effective \
system messages for AI assistants.
            Your task is to generate a clear, concise, and effective system message based\
on the provided description.

            # INSTRUCTIONS
            A good system message should:
            1. Clearly define the AI's role and purpose
            2. Set appropriate boundaries and constraints
            3. Provide necessary context and background information
            4. Be concise but comprehensive
            5. Use clear, unambiguous language
            6. Use XML tags when appropriate to structure information:
                e.g., <role>...</role>, <constraints>...</constraints>

            # FORMAT REQUIREMENTS
            Your generated system message MUST include:
            1. An "# Instructions" section with clearly enumerated instructions (1., 2., 3., etc.)
            2. Clear organization with appropriate headings and structure

            # EXAMPLES
            Example 1 (Simple role definition):
            ```
            You are a helpful coding assistant that specializes in Python programming.

            # Instructions
            1. Provide accurate Python code examples when requested
            2. Explain coding concepts clearly and concisely
            3. Suggest best practices for Python development
            ```

            Example 2 (With XML tags):
            ```
            <role>You are a data analysis expert specialized in interpreting finan
```

### Core Architecture Module: `backend/pyspur/api/api_app.py`
```
from fastapi import FastAPI

from ..nodes.registry import NodeRegistry

NodeRegistry.discover_nodes()

from ..integrations.google.auth import router as google_auth_router
from .ai_management import router as ai_management_router
from .dataset_management import router as dataset_management_router
from .evals_management import router as evals_management_router
from .file_management import router as file_management_router
from .key_management import router as key_management_router
from .node_management import router as node_management_router
from .openai_compatible_api import router as openai_compatible_api_router
from .openapi_management import router as openapi_router
from .output_file_management import router as output_file_management_router
from .rag_management import router as rag_management_router
from .run_management import router as run_management_router
from .session_management import router as session_management_router
from .slack_management import router as slack_management_router
from .template_management import router as template_management_router
from .user_management import router as user_management_router
from .workflow_code_convert import router as workflow_code_router
from .workflow_management import router as workflow_management_router
from .workflow_run import router as workflow_run_router

# Create a sub-application for API routes
api_app = FastAPI(
    docs_url="/docs",
    redoc_url="/redoc",
    title="PySpur API",
    version="1.0.0",
)

api_app.include_router(node_management_router, prefix="/node", tags=["nodes"])
api_app.include_router(workflow_management_router, prefix="/wf", tags=["workflows"])
api_app.include_router(workflow_run_router, prefix="/wf", tags=["workflow runs"])
api_app.include_router(workflow_code_router, prefix="/code_convert", tags=["workflow code (beta)"])
api_app.include_router(dataset_management_router, prefix="/ds", tags=["datasets"])
api_app.include_router(run_management_router, prefix="/run", tags=["runs"])
api_app.include_router(output_file_management_router, prefix="/of", tags=["output files"])
api_app.include_router(key_management_router, prefix="/env-mgmt", tags=["environment management"])
api_app.include_router(template_management_router, prefix="/templates", tags=["templates"])
api_app.include_router(openai_compatible_api_router, prefix="/api", tags=["openai compatible"])
api_app.include_router(evals_management_router, prefix="/evals", tags=["evaluations"])
api_app.include_router(google_auth_router, prefix="/google", tags=["google auth"])
api_app.include_router(rag_management_router, prefix="/rag", tags=["rag"])
api_app.include_router(file_management_router, prefix="/files", tags=["files"])
api_app.include_router(ai_management_router, prefix="/ai", tags=["ai"])
api_app.include_router(user_management_router, prefix="/user", tags=["users"])
api_app.include_router(session_management_router, prefix="/session", tags=["sessions"])
api_app.include_router(slack_management_router, prefix="/slack", tags=["slack integration"])
api_app.include_router(openapi_router, prefix="/openapi", tags=["openapi"])

```

### Core Architecture Module: `backend/pyspur/api/dataset_management.py`
```
import os
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.dataset_model import DatasetModel
from ..models.run_model import RunModel
from ..schemas.dataset_schemas import DatasetResponseSchema
from ..schemas.run_schemas import RunResponseSchema

router = APIRouter()


def save_file(file: UploadFile) -> str:
    filename = file.filename
    assert filename is not None
    file_location = os.path.join(os.path.dirname(__file__), "..", "..", "datasets", filename)
    with open(file_location, "wb+") as file_object:
        file_object.write(file.file.read())
    return file_location


@router.post("/", description="Upload a new dataset")
def upload_dataset(
    name: str,
    description: str = "",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DatasetResponseSchema:
    file_location = save_file(file)
    new_dataset = DatasetModel(
        name=name,
        description=description,
        file_path=file_location,
        uploaded_at=datetime.now(timezone.utc),
    )
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    return DatasetResponseSchema(
        id=new_dataset.id,
        name=new_dataset.name,
        description=new_dataset.description,
        filename=new_dataset.file_path,
        created_at=new_dataset.uploaded_at,
        updated_at=new_dataset.uploaded_at,
    )


@router.get(
    "/",
    response_model=List[DatasetResponseSchema],
    description="List all datasets",
)
def list_datasets(db: Session = Depends(get_db)) -> List[DatasetResponseSchema]:
    datasets = db.query(DatasetModel).all()
    dataset_list = [
        DatasetResponseSchema(
            id=ds.id,
            name=ds.name,
            description=ds.description,
            filename=ds.file_path,
            created_at=ds.uploaded_at,
            updated_at=ds.uploaded_at,
        )
        for ds in datasets
    ]
    return dataset_list


@router.get(
    "/{dataset_id}/",
    response_model=DatasetResponseSchema,
    description="Get a dataset by ID",
)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)) -> DatasetResponseSchema:
    dataset = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DatasetResponseSchema(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        filename=dataset.file_path,
        created_at=dataset.uploaded_at,
        updated_at=dataset.uploaded_at,
    )


@router.delete(
    "/{dataset_id}/",
    description="Delete a dataset by ID",
)
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    dataset = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    db.delete(dataset)
    db.commit()
    return {"message": "Dataset deleted"}


@router.get(
    "/{dataset_id}/list_runs/",
    description="List all runs that used this dataset",
    response_model=List[RunResponseSchema],
)
def list_dataset_runs(dataset_id: str, db: Session = Depends(get_db)):
    dataset = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    runs = (
        db.query(RunModel)
        .filter(RunModel.input_dataset_id == dataset_id)
        .order_by(RunModel.created_at.desc())
        .all()
    )
    return runs

```

### Core Architecture Module: `backend/pyspur/api/evals_management.py`
```
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..evals.evaluator import load_yaml_config, prepare_and_evaluate_dataset
from ..models.eval_run_model import EvalRunModel, EvalRunStatus
from ..models.workflow_model import WorkflowModel
from ..schemas.eval_schemas import (
    EvalRunRequest,
    EvalRunResponse,
    EvalRunStatusEnum,
)
from ..schemas.workflow_schemas import WorkflowDefinitionSchema
from .workflow_management import get_workflow_output_variables

router = APIRouter()

EVALS_DIR = Path(__file__).parent.parent / "evals" / "tasks"


@router.get("/", description="List all available evals")
def list_evals() -> List[Dict[str, Any]]:
    """
    List all available evals by scanning the tasks directory for YAML files.
    """
    evals = []
    if not EVALS_DIR.exists():
        raise HTTPException(status_code=500, detail="Evals directory not found")
    for eval_file in EVALS_DIR.glob("*.yaml"):
        try:
            eval_content = load_yaml_config(yaml_path=eval_file)
            metadata = eval_content.get("metadata", {})
            evals.append(
                {
                    "name": metadata.get("name", eval_file.stem),
                    "description": metadata.get("description", ""),
                    "type": metadata.get("type", "Unknown"),
                    "num_samples": metadata.get("num_samples", "N/A"),
                    "paper_link": metadata.get("paper_link", ""),
                    "file_name": eval_file.name,
                }
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error parsing {eval_file.name}: {e}")
    return evals


@router.post(
    "/launch/",
    response_model=EvalRunResponse,
    description="Launch an eval job with detailed validation and workflow integration",
)
async def launch_eval(
    request: EvalRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> EvalRunResponse:
    """
    Launch an eval job by triggering the evaluator with the specified eval configuration.
    """
    # Validate workflow ID
    workflow = db.query(WorkflowModel).filter(WorkflowModel.id == request.workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow_definition = WorkflowDefinitionSchema.model_validate(workflow.definition)

    eval_file = EVALS_DIR / f"{request.eval_name}.yaml"
    if not eval_file.exists():
        raise HTTPException(status_code=404, detail="Eval configuration not found")

    try:
        # Load the eval configuration
        eval_config = load_yaml_config(eval_file)

        # Validate the output variable
        leaf_node_output_variables = get_workflow_output_variables(
            workflow_id=request.workflow_id, db=db
        )

        print(f"Valid output variables: {leaf_node_output_variables}")

        # Extract the list of valid prefixed variables
        valid_prefixed_variables = [var["prefixed_variable"] for var in leaf_node_output_variables]

        if request.output_variable not in valid_prefixed_variables:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid output variable '{request.output_variable}'. "
                    f"Must be one of: {leaf_node_output_variables}"
                ),
            )

        # Create a new EvalRunModel instance
        new_eval_run = EvalRunModel(
            eval_name=request.eval_name,
            workflow_id=request.workflow_id,
            output_variable=request.output_variable,
            num_samples=request.num_samples,
            status=EvalRunStatus.PENDING,
            start_time=datetime.now(timezone.utc),
        )
        db.add(new_eval_run)
        db.commit()
        db.refresh(new_eval_run)

        async def run_eval_task(eval_run_id: str):
            with next(get_db()) as session:
                eval_run = (
                    session.query(EvalRunModel).filter(EvalRunModel.id == eval_run_id).first()
                )
                if not eval_run:
                    session.close()
                    return

                eval_run.status = EvalRunStatus.RUNNING
                session.commit()

                try:
                    # Run the evaluation asynchronously
                    results = await prepare_and_evaluate_dataset(
                        eval_config,
                        workflow_definition=workflow_definition,
                        num_samples=eval_run.num_samples,
                        output_variable=eval_run.output_variable,
                    )
                    eval_run.results = results
                    eval_run.status = EvalRunStatus.COMPLETED
                    eval_run.end_time = datetime.now(timezone.utc)
                except Exception as e:
                    eval_run.status = EvalRunStatus.FAILED
                    eval_run.end_time = datetime.now(timezone.utc)
                    session.commit()
                    raise e
                finally:
                    session.commit()

        background_tasks.add_task(run_eval_task, new_eval_run.id)

        # Return all required parameters
        return EvalRunResponse(
            run_id=new_eval_run.id,
            eval_name=new_eval_run.eval_name,
            workflow_id=new_eval_run.workflow_id,
            status=EvalRunStatusEnum(new_eval_run.status.value),
            start_time=new_eval_run.start_time,
            end_time=new_eval_run.end_time,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error launching eval: {e}")


@router.get(
    "/runs/{eval_run_id}",
    response_model=EvalRunResponse,
    description="Get the status of an eval run",
)
async def get_eval_run_status(eval_run_id: str, db: Session = Depends(get_db)) -> EvalRunResponse:
    eval_run = db.query(EvalRunModel).filter(EvalRunModel.id == eval_run_id).first()
    if not eval_run:
        raise HTTPException(status_code=404, detail="Eval run not found")
    return EvalRunResponse(
        run_id=eval_run.id,
        eval_name=eval_run.eval_name,
        workflow_id=eval_run.workflow_id,
        status=EvalRunStatusEnum(eval_run.status.value),
        start_time=eval_run.start_time,
        end_time=eval_run.end_time,
        results=eval_run.results,
    )


@router.get(
    "/runs/",
    response_model=List[EvalRunResponse],
    description="List all eval runs",
)
async def list_eval_runs(
    db: Session = Depends(get_db),
) -> List[EvalRunResponse]:
    eval_runs = db.query(EvalRunModel).order_by(EvalRunModel.start_time.desc()).all()
    return [
        EvalRunResponse(
            run_id=eval_run.id,
            eval_name=eval_run.eval_name,
            workflow_id=eval_run.workflow_id,
            status=EvalRunStatusEnum(eval_run.status.value),
            start_time=eval_run.start_time,
            end_time=eval_run.end_time,
        )
        for eval_run in eval_runs
    ]

```

### Core Architecture Module: `backend/pyspur/api/file_management.py`
```
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..schemas.file_schemas import FileResponseSchema

router = APIRouter()

# Define base data directory
DATA_DIR = Path("data")


@router.get(
    "/{workflow_id}",
    response_model=List[FileResponseSchema],
    description="List all files for a specific workflow",
)
async def list_workflow_files(workflow_id: str) -> List[FileResponseSchema]:
    """
    List all files in the workflow's directory.
    Returns a list of dictionaries containing file information.
    """
    workflow_dir = DATA_DIR / "run_files" / workflow_id

    if not workflow_dir.exists():
        return []

    files: List[FileResponseSchema] = []
    for file_path in workflow_dir.glob("*"):
        if file_path.is_file():
            files.append(
                FileResponseSchema(
                    name=file_path.name,
                    path=str(file_path.relative_to(DATA_DIR)),
                    size=os.path.getsize(file_path),
                    created=datetime.fromtimestamp(os.path.getctime(file_path), tz=timezone.utc),
                    workflow_id=workflow_id,
                )
            )

    return files


@router.get(
    "/",
    response_model=List[FileResponseSchema],
    description="List all files across all workflows",
)
async def list_all_files() -> List[FileResponseSchema]:
    """
    List all files in the data directory across all workflows.
    Returns a list of dictionaries containing file information.
    """
    test_files_dir = DATA_DIR / "run_files"

    if not test_files_dir.exists():
        return []

    files: List[FileResponseSchema] = []
    for workflow_dir in test_files_dir.glob("*"):
        if workflow_dir.is_dir():
            workflow_id = workflow_dir.name
            for file_path in workflow_dir.glob("*"):
                if file_path.is_file():
                    files.append(
                        FileResponseSchema(
                            name=file_path.name,
                            workflow_id=workflow_id,
                            path=str(file_path.relative_to(DATA_DIR)),
                            size=os.path.getsize(file_path),
                            created=datetime.fromtimestamp(
                                os.path.getctime(file_path), tz=timezone.utc
                            ),
                        )
                    )

    return files


@router.delete("/{workflow_id}/{filename}", description="Delete a specific file")
async def delete_file(workflow_id: str, filename: str):
    """
    Delete a specific file from a workflow's directory.
    """
    file_path = DATA_DIR / "run_files" / workflow_id / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(file_path)
        return {"message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


@router.delete("/{workflow_id}", description="Delete all files for a workflow")
async def delete_workflow_files(workflow_id: str):
    """
    Delete all files in a workflow's directory.
    """
    workflow_dir = DATA_DIR / "run_files" / workflow_id

    if not workflow_dir.exists():
        raise HTTPException(status_code=404, detail="Workflow directory not found")

    try:
        shutil.rmtree(workflow_dir)
        return {"message": "All workflow files deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting workflow files: {str(e)}")


@router.get(
    "/{file_path:path}",
    description="Get a specific file",
    response_class=FileResponse,
)
async def get_file(file_path: str):
    """
    Get a specific file from the data directory.
    Validates file path to prevent path traversal attacks.
    """
    # Validate that file_path doesn't contain path traversal patterns
    if ".." in file_path or "~" in file_path:
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Resolve the full path and ensure it's within DATA_DIR
    try:
        full_path = (DATA_DIR / file_path).resolve()
        if not str(full_path).startswith(str(DATA_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(full_path))

```

### Core Architecture Module: `backend/pyspur/api/key_management.py`
```
import os
from typing import Dict, List, Optional

from dotenv import dotenv_values, load_dotenv, set_key, unset_key
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..rag.datastore.factory import VectorStoreConfig, get_vector_stores
from ..rag.embedder import EmbeddingModelConfig, EmbeddingModels

# Load existing environment variables from the .env file
load_dotenv(".env")

router = APIRouter()


class ProviderParameter(BaseModel):
    name: str
    description: str
    required: bool = True
    type: str = "password"  # password, text, select


class ProviderConfig(BaseModel):
    id: str
    name: str
    description: str
    category: str  # 'llm', 'embedding', 'vectorstore'
    parameters: List[ProviderParameter]
    icon: str = "database"  # Default icon for vector stores


PROVIDER_CONFIGS = [
    # LLM Providers
    ProviderConfig(
        id="openai",
        name="OpenAI",
        description="OpenAI's GPT models",
        category="llm",
        icon="openai",
        parameters=[
            ProviderParameter(name="OPENAI_API_KEY", description="OpenAI API Key"),
        ],
    ),
    ProviderConfig(
        id="azure-openai",
        name="Azure OpenAI",
        description="Azure-hosted OpenAI models",
        category="llm",
        icon="azure",
        parameters=[
            ProviderParameter(name="AZURE_OPENAI_API_KEY", description="Azure OpenAI API Key"),
            ProviderParameter(
                name="AZURE_OPENAI_ENDPOINT",
                description="Azure OpenAI Endpoint URL",
                type="text",
            ),
            ProviderParameter(
                name="AZURE_OPENAI_API_VERSION",
                description="API Version (e.g. 2023-05-15)",
                type="text",
            ),
        ],
    ),
    ProviderConfig(
        id="anthropic",
        name="Anthropic",
        description="Anthropic's Claude models",
        category="llm",
        icon="anthropic",
        parameters=[
            ProviderParameter(name="ANTHROPIC_API_KEY", description="Anthropic API Key"),
        ],
    ),
    ProviderConfig(
        id="gemini",
        name="Google Gemini",
        description="Google's Gemini models",
        category="llm",
        icon="google",
        parameters=[
            ProviderParameter(name="GEMINI_API_KEY", description="Google AI API Key"),
        ],
    ),
    ProviderConfig(
        id="deepseek",
        name="DeepSeek",
        description="DeepSeek's code and chat models",
        category="llm",
        icon="deepseek",
        parameters=[
            ProviderParameter(name="DEEPSEEK_API_KEY", description="DeepSeek API Key"),
        ],
    ),
    ProviderConfig(
        id="cohere",
        name="Cohere",
        description="Cohere's language models",
        category="llm",
        icon="cohere",
        parameters=[
            ProviderParameter(name="COHERE_API_KEY", description="Cohere API Key"),
        ],
    ),
    ProviderConfig(
        id="voyage",
        name="Voyage AI",
        description="Voyage's language models",
        category="llm",
        icon="voyage",
        parameters=[
            ProviderParameter(name="VOYAGE_API_KEY", description="Voyage AI API Key"),
        ],
    ),
    ProviderConfig(
        id="mistral",
        name="Mistral AI",
        description="Mistral's language models",
        category="llm",
        icon="mistral",
        parameters=[
            ProviderParameter(name="MISTRAL_API_KEY", description="Mistral AI API Key"),
        ],
    ),
    # Vector Store Providers
    ProviderConfig(
        id="pinecone",
        name="Pinecone",
        description="Production-ready vector database",
        category="vectorstore",
        icon="pinecone",
        parameters=[
            ProviderParameter(name="PINECONE_API_KEY", description="Pinecone API Key"),
            ProviderParameter(
                name="PINECONE_ENVIRONMENT",
                description="Pinecone Environment",
                type="text",
            ),
            ProviderParameter(
                name="PINECONE_INDEX",
                description="Pinecone Index Name",
                type="text",
            ),
        ],
    ),
    ProviderConfig(
        id="weaviate",
        name="Weaviate",
        description="Multi-modal vector search engine",
        category="vectorstore",
        icon="weaviate",
        parameters=[
            ProviderParameter(name="WEAVIATE_API_KEY", description="Weaviate API Key"),
            ProviderParameter(
                name="WEAVIATE_URL",
                description="Weaviate Instance URL",
                type="text",
            ),
        ],
    ),
    ProviderConfig(
        id="qdrant",
        name="Qdrant",
        description="Vector database for production",
        category="vectorstore",
        icon="qdrant",
        parameters=[
            ProviderParameter(name="QDRANT_API_KEY", description="Qdrant API Key"),
            ProviderParameter(
                name="QDRANT_URL",
                description="Qdrant Instance URL",
                type="text",
            ),
        ],
    ),
    ProviderConfig(
        id="chroma",
        name="Chroma",
        description="Open-source embedding database",
        category="vectorstore",
        icon="chroma",
        parameters=[
            ProviderParameter(
                name="CHROMA_IN_MEMORY",
                description="Run Chroma in memory",
                type="text",
            ),
            ProviderParameter(
                name="CHROMA_PERSISTENCE_DIR",
                description="Directory for Chroma persistence",
                type="text",
            ),
            ProviderParameter(
                name="CHROMA_HOST",
                description="Chroma server host",
                type="text",
            ),
            ProviderParameter(
                name="CHROMA_PORT",
                description="Chroma server port",
                type="text",
            ),
            ProviderParameter(
                name="CHROMA_COLLECTION",
                description="Chroma collection name",
                type="text",
            ),
        ],
    ),
    ProviderConfig(
        id="supabase",
        name="Supabase",
        description="Open-source vector database",
        category="vectorstore",
        icon="supabase",
        parameters=[
            ProviderParameter(
                name="SUPABASE_URL",
                description="Supabase Project URL",
                type="text",
            ),
            ProviderParameter(
                name="SUPABASE_ANON_KEY",
                description="Supabase Anonymous Key",
                type="password",
                required=False,
            ),
            ProviderParameter(
                name="SUPABASE_SERVICE_ROLE_KEY",
                description="Supabase Service Role Key",
                type="password",
                required=False,
            ),
        ],
    ),
    # Add Reddit Provider
    ProviderConfig(
        id="reddit",
        name="Reddit",
        description="Reddit API integration",
        category="social",
        icon="logos:reddit-icon",
        parameters=[
            ProviderParameter(name="REDDIT_CLIENT_ID", description="Reddit API Client ID"),
            ProviderParameter(name="REDDIT_CLIENT_SECRET", description="Reddit API Client Secret"),
            ProviderParameter(
                name="REDDIT_USERNAME", description="Reddit Username", type="text", required=False
            ),
            ProviderParameter(
                name="REDDIT_PASSWORD",
                description="Reddit Password",
                type="password",
                required=False,
            ),
            ProviderParameter(
                name="REDDIT_USER_AGENT",
                description="Reddit API User Agent",
                type="text",
                required=False,
            ),
        ],
    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #52** (2024-12-24): **Unhandled Runtime Error  AxiosError: Request failed with status code 502**
  *Symptoms*: after composed and opening the host the runtime error occurs  ![Screenshot 2024-12-18 095410](https://github.com/user-attachments/assets/2f408c64-1fd6-4dd8-9cb6-1f133cb5bc31) 
  **Post-Mortem & Fix Analysis**:
  > Hey @Rishikeswaran-17 thank you for reporting this issue. Can you share the docker logs here as well?
  >  @srijanpatel Im getting the same error here are the on pyspur-nginx-1 logs.   2024-12-18 11:32:10 nginx-1     | 172.20.0.1 - pyspur [18/Dec/2024:17:32:10 +0000] "GET /__nextjs_original-stack-frame?isServer=false&isEdgeServer=false&isAppDirectory=false&errorMessage=AxiosError%3A+Request+failed+with+status+code+422&file=webpack-internal%3A%2F%2F%2F.%2Fnode_modules%2Faxios%2Flib%2Fcore%2Fsettle.js&methodName=settle&arguments=&lineNumber=24&column=12 HTTP/1.1" 200 474 "http://localhost:6080/workflows/S2" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" "-" 2024-12-18 11:32:10 nginx-1     | 172.20.0.1 - pyspur [18/Dec/2024:17:32:10 +0000] "GET /__nextjs_original-stack-frame?isServer=false&isEdgeServer=false&isAppDirectory=false&errorMessage=AxiosError%3A+Request+failed+with+status+code+422&file=webpack-internal%3A%2F%2F%2F.%2Fnode_modules%2Faxios%2Flib%2Fcore%2FAxios.js&methodName=Axios.request&arguments=&lineNumber=
  > @Shubham-Khichi could you also share `pyspur-backend-1` container's logs along with the steps to reproduce this?  Here's what I tried on an ubuntu instance that worked for me: 1. clone the repo to `~/pyspur` 2. run `sudo docker compose up --build` 3. open `http://localhost:6080` in my browser, and enter the username/password given in the README 4. add my `OPENAI_API_KEY` key using the settings modal on the top right corner of the home/dashboard page 5. create a new spur with one `SingleLLMCallNode` node that uses `GPT-4o` 6. run it  It would help me a lot in resolving this issue for you if you could share details like above along with the workflow (you can download this from the header in the workflow view, or from the dashboard as well)  Here's the workflow that i just ran successfully [New_Spur_18_12_2024,_13_12_15.json](https://github.com/user-attachments/files/18187312/New_Spur_18_12_2024._13_12_15.json)  

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

### Incident Patch 1: `94cfba7a` (2025-07-06)
**Commit Message**: fix the error message in SlackSetupGuide.tsx

**File**: `frontend/src/components/slack/SlackSetupGuide.tsx` (modified, +47/-22)
```diff
@@ -1,35 +1,34 @@
 import {
     Accordion,
     AccordionItem,
-    Badge,
     Button,
     Input,
     Modal,
     ModalBody,
     ModalContent,
     ModalFooter,
     ModalHeader,
-    Textarea
 } from '@heroui/react'
 import { Icon as IconifyIcon } from '@iconify/react'
 import { useRouter } from 'next/router'
 import React, { useState } from 'react'
+
 import { setApiKey } from '../../utils/api'
 
 interface SlackSetupGuideProps {
-    onClose: () => void;
-    onConnectClick: () => void;
-    setupInfo?: any;
-    onGoToSettings?: () => void;
-    onTokenConfigured?: () => void;
+    onClose: () => void
+    onConnectClick: () => void
+    setupInfo?: any
+    onGoToSettings?: () => void
+    onTokenConfigured?: () => void
 }
 
 const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
     onClose,
     onConnectClick,
     setupInfo,
     onGoToSettings,
-    onTokenConfigured
+    onTokenConfigured,
 }) => {
     const router = useRouter()
     const [botToken, setBotToken] = useState('')
@@ -77,7 +76,8 @@ const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
                 </ModalHeader>
                 <ModalBody>
                     <p className="mb-4">
-                        Set up Slack integration by providing your Bot Token directly. After configuration, you'll create your first Slack agent.
+                        Set up Slack integration by providing your Bot Token directly. After configuration, you&apos;ll
+                        create your first Slack agent.
                     </p>
 
                     <Accordion>
@@ -96,8 +96,20 @@ const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
                             <div className="pl-8 text-sm space-y-2">
                                 <p>To create a new Slack app:</p>
                                 <ol className="list-decimal list-inside space-y-1 pl-2">
-                                    <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">Slack API Apps page</a></li>
-                                    <li>Click <strong>Create New App</strong> → <strong>From scratch</strong></li>
+                                    <li>
+                                        Go to{' '}
+                                        <a
+                                            href="https://api.slack.com/apps"
+                                            target="_blank"
+                                            rel="noopener noreferrer"
+                                            className="text-primary underline"
+                                        >
+                                            Slack API Apps page
+                                        </a>
+                                    </li>
+                                    <li>
+                                        Click <strong>Create New App</strong> → <strong>From scratch</strong>
+                                    </li>
                                     <li>Name your app (e.g., &quot;PySpur Bot&quot;)</li>
                                     <li>Select the workspace where you want to install the app</li>
                                 </ol>
@@ -119,14 +131,22 @@ const SlackSetupGuide: React.FC<SlackSetupGuideProps> = ({
                             <div className="pl-8 text-sm space-y-2">
                                 <p>Configure the bot permissions for your app:</p>
                                 <ol className="list-decimal list-inside space-y-1 pl-2">
-                                    <li>In your app settings, go to <strong>OAuth & Permissions</strong></li>
-                                    <li>Under <strong>Bot Token Scopes</strong>, add the following scopes:
+                                    <li>
+                                        In your app settings, go to <strong>OAuth & Permissions</strong>
+                                    </li>
+                    
```

---

### Incident Patch 2: `17c4a9f8` (2025-03-30)
**Commit Message**: Merge pull request #271 from PySpur-Dev/fix/migration-order-010-011

Fix migration orders for slack_agents table

**File**: `backend/pyspur/models/management/alembic/versions/010_add_idx_to_time_cols.py` (renamed, +88/-20)
```diff
@@ -11,68 +11,136 @@
 from alembic import op
 
 # revision identifiers, used by Alembic.
-revision: str = "011"
-down_revision: Union[str, None] = "010"
+revision: str = "010"
+down_revision: Union[str, None] = "009"
 branch_labels: Union[str, Sequence[str], None] = None
 depends_on: Union[str, Sequence[str], None] = None
 
 
 def upgrade() -> None:
     # ### commands auto generated by Alembic - please adjust! ###
-    op.create_index(op.f("ix_datasets_uploaded_at"), "datasets", ["uploaded_at"], unique=False)
+    op.create_index(
+        op.f("ix_datasets_uploaded_at"),
+        "datasets",
+        ["uploaded_at"],
+        unique=False,
+        if_not_exists=True,
+    )
     op.create_index(
         op.f("ix_document_collections_created_at"),
         "document_collections",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_collections_updated_at"),
         "document_collections",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_created_at"),
         "document_processing_progress",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_updated_at"),
         "document_processing_progress",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_eval_runs_start_time"),
+        "eval_runs",
+        ["start_time"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_output_files_created_at"),
+        "output_files",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_output_files_updated_at"),
+        "output_files",
+        ["updated_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False)
-    op.create_index(op.f("ix_eval_runs_start_time"), "eval_runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False)
-    op.create_index(op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_output_files_created_at"), "output_files", ["created_at"], unique=False
+        op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False, if_not_exists=True
     )
     op.create_index(
-        op.f("ix_output_files_updated_at"), "output_files", ["updated_at"], unique=False
+        op.f("ix_users_created_at"), "users", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False)
-    op.create_index(op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False)
-    op.create_index(op.f("ix_users_created_at"), "users", ["created_at"], unique=False)
-    op.create_index(op.f("ix_users_updated_at"), "users", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_vector_indices_created_at"), "vector
```

**File**: `backend/pyspur/models/management/alembic/versions/010_slack_agent.py` (removed, +0/-52)
```diff
@@ -1,52 +0,0 @@
-"""slack_agent
-
-Revision ID: 010
-Revises: 009
-Create Date: 2025-03-16 15:09:40.938378
-
-"""
-from typing import Sequence, Union
-
-from alembic import op
-import sqlalchemy as sa
-
-
-# revision identifiers, used by Alembic.
-revision: str = '010'
-down_revision: Union[str, None] = '009'
-branch_labels: Union[str, Sequence[str], None] = None
-depends_on: Union[str, Sequence[str], None] = None
-
-
-def upgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.create_table('slack_agents',
-    sa.Column('id', sa.Integer(), nullable=False),
-    sa.Column('name', sa.String(), nullable=True),
-    sa.Column('slack_team_id', sa.String(), nullable=True),
-    sa.Column('slack_team_name', sa.String(), nullable=True),
-    sa.Column('slack_channel_id', sa.String(), nullable=True),
-    sa.Column('slack_channel_name', sa.String(), nullable=True),
-    sa.Column('is_active', sa.Boolean(), nullable=True),
-    sa.Column('workflow_id', sa.String(), nullable=True),
-    sa.Column('trigger_on_mention', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_direct_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_channel_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_keywords', sa.JSON(), nullable=True),
-    sa.Column('trigger_enabled', sa.Boolean(), nullable=True),
-    sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ),
-    sa.PrimaryKeyConstraint('id')
-    )
-    op.create_index(op.f('ix_slack_agents_id'), 'slack_agents', ['id'], unique=False)
-    op.create_index(op.f('ix_slack_agents_name'), 'slack_agents', ['name'], unique=False)
-    op.create_index(op.f('ix_slack_agents_slack_team_id'), 'slack_agents', ['slack_team_id'], unique=False)
-    # ### end Alembic commands ###
-
-
-def downgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.drop_index(op.f('ix_slack_agents_slack_team_id'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_name'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_id'), table_name='slack_agents')
-    op.drop_table('slack_agents')
-    # ### end Alembic commands ###
```

**File**: `backend/pyspur/models/management/alembic/versions/011_slack_agent.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""slack_agent.
+
+Revision ID: 010
+Revises: 009
+Create Date: 2025-03-16 15:09:40.938378
+
+"""
+
+from typing import Sequence, Union
+
+import sqlalchemy as sa
+from alembic import op
+
+# revision identifiers, used by Alembic.
+revision: str = "011"
+down_revision: Union[str, None] = "010"
+branch_labels: Union[str, Sequence[str], None] = None
+depends_on: Union[str, Sequence[str], None] = None
+
+
+def upgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.create_table(
+        "slack_agents",
+        sa.Column("id", sa.Integer(), nullable=False),
+        sa.Column("name", sa.String(), nullable=True),
+        sa.Column("slack_team_id", sa.String(), nullable=True),
+        sa.Column("slack_team_name", sa.String(), nullable=True),
+        sa.Column("slack_channel_id", sa.String(), nullable=True),
+        sa.Column("slack_channel_name", sa.String(), nullable=True),
+        sa.Column("is_active", sa.Boolean(), nullable=True),
+        sa.Column("workflow_id", sa.String(), nullable=True),
+        sa.Column("trigger_on_mention", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_direct_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_channel_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_keywords", sa.JSON(), nullable=True),
+        sa.Column("trigger_enabled", sa.Boolean(), nullable=True),
+        sa.ForeignKeyConstraint(
+            ["workflow_id"],
+            ["workflows.id"],
+        ),
+        sa.PrimaryKeyConstraint("id"),
+    )
+    op.create_index(op.f("ix_slack_agents_id"), "slack_agents", ["id"], unique=False)
+    op.create_index(op.f("ix_slack_agents_name"), "slack_agents", ["name"], unique=False)
+    op.create_index(
+        op.f("ix_slack_agents_slack_team_id"), "slack_agents", ["slack_team_id"], unique=False
+    )
+    # ### end Alembic commands ###
+
+
+def downgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.drop_index(op.f("ix_slack_agents_slack_team_id"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_name"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_id"), table_name="slack_agents")
+    op.drop_table("slack_agents")
+    # ### end Alembic commands ###
```

---

### Incident Patch 3: `4fc5374f` (2025-03-30)
**Commit Message**: fix: 010 & 011 migration orders

**File**: `backend/pyspur/models/management/alembic/versions/010_add_idx_to_time_cols.py` (renamed, +88/-20)
```diff
@@ -11,68 +11,136 @@
 from alembic import op
 
 # revision identifiers, used by Alembic.
-revision: str = "011"
-down_revision: Union[str, None] = "010"
+revision: str = "010"
+down_revision: Union[str, None] = "009"
 branch_labels: Union[str, Sequence[str], None] = None
 depends_on: Union[str, Sequence[str], None] = None
 
 
 def upgrade() -> None:
     # ### commands auto generated by Alembic - please adjust! ###
-    op.create_index(op.f("ix_datasets_uploaded_at"), "datasets", ["uploaded_at"], unique=False)
+    op.create_index(
+        op.f("ix_datasets_uploaded_at"),
+        "datasets",
+        ["uploaded_at"],
+        unique=False,
+        if_not_exists=True,
+    )
     op.create_index(
         op.f("ix_document_collections_created_at"),
         "document_collections",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_collections_updated_at"),
         "document_collections",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_created_at"),
         "document_processing_progress",
         ["created_at"],
         unique=False,
+        if_not_exists=True,
     )
     op.create_index(
         op.f("ix_document_processing_progress_updated_at"),
         "document_processing_progress",
         ["updated_at"],
         unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_eval_runs_start_time"),
+        "eval_runs",
+        ["start_time"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_output_files_created_at"),
+        "output_files",
+        ["created_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_output_files_updated_at"),
+        "output_files",
+        ["updated_at"],
+        unique=False,
+        if_not_exists=True,
+    )
+    op.create_index(
+        op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False, if_not_exists=True
+    )
+    op.create_index(
+        op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_eval_runs_end_time"), "eval_runs", ["end_time"], unique=False)
-    op.create_index(op.f("ix_eval_runs_start_time"), "eval_runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False)
-    op.create_index(op.f("ix_messages_updated_at"), "messages", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_output_files_created_at"), "output_files", ["created_at"], unique=False
+        op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False, if_not_exists=True
     )
     op.create_index(
-        op.f("ix_output_files_updated_at"), "output_files", ["updated_at"], unique=False
+        op.f("ix_users_created_at"), "users", ["created_at"], unique=False, if_not_exists=True
     )
-    op.create_index(op.f("ix_runs_start_time"), "runs", ["start_time"], unique=False)
-    op.create_index(op.f("ix_sessions_created_at"), "sessions", ["created_at"], unique=False)
-    op.create_index(op.f("ix_sessions_updated_at"), "sessions", ["updated_at"], unique=False)
-    op.create_index(op.f("ix_users_created_at"), "users", ["created_at"], unique=False)
-    op.create_index(op.f("ix_users_updated_at"), "users", ["updated_at"], unique=False)
     op.create_index(
-        op.f("ix_vector_indices_created_at"), "vector
```

**File**: `backend/pyspur/models/management/alembic/versions/010_slack_agent.py` (removed, +0/-52)
```diff
@@ -1,52 +0,0 @@
-"""slack_agent
-
-Revision ID: 010
-Revises: 009
-Create Date: 2025-03-16 15:09:40.938378
-
-"""
-from typing import Sequence, Union
-
-from alembic import op
-import sqlalchemy as sa
-
-
-# revision identifiers, used by Alembic.
-revision: str = '010'
-down_revision: Union[str, None] = '009'
-branch_labels: Union[str, Sequence[str], None] = None
-depends_on: Union[str, Sequence[str], None] = None
-
-
-def upgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.create_table('slack_agents',
-    sa.Column('id', sa.Integer(), nullable=False),
-    sa.Column('name', sa.String(), nullable=True),
-    sa.Column('slack_team_id', sa.String(), nullable=True),
-    sa.Column('slack_team_name', sa.String(), nullable=True),
-    sa.Column('slack_channel_id', sa.String(), nullable=True),
-    sa.Column('slack_channel_name', sa.String(), nullable=True),
-    sa.Column('is_active', sa.Boolean(), nullable=True),
-    sa.Column('workflow_id', sa.String(), nullable=True),
-    sa.Column('trigger_on_mention', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_direct_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_on_channel_message', sa.Boolean(), nullable=True),
-    sa.Column('trigger_keywords', sa.JSON(), nullable=True),
-    sa.Column('trigger_enabled', sa.Boolean(), nullable=True),
-    sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ),
-    sa.PrimaryKeyConstraint('id')
-    )
-    op.create_index(op.f('ix_slack_agents_id'), 'slack_agents', ['id'], unique=False)
-    op.create_index(op.f('ix_slack_agents_name'), 'slack_agents', ['name'], unique=False)
-    op.create_index(op.f('ix_slack_agents_slack_team_id'), 'slack_agents', ['slack_team_id'], unique=False)
-    # ### end Alembic commands ###
-
-
-def downgrade() -> None:
-    # ### commands auto generated by Alembic - please adjust! ###
-    op.drop_index(op.f('ix_slack_agents_slack_team_id'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_name'), table_name='slack_agents')
-    op.drop_index(op.f('ix_slack_agents_id'), table_name='slack_agents')
-    op.drop_table('slack_agents')
-    # ### end Alembic commands ###
```

**File**: `backend/pyspur/models/management/alembic/versions/011_slack_agent.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""slack_agent.
+
+Revision ID: 010
+Revises: 009
+Create Date: 2025-03-16 15:09:40.938378
+
+"""
+
+from typing import Sequence, Union
+
+import sqlalchemy as sa
+from alembic import op
+
+# revision identifiers, used by Alembic.
+revision: str = "011"
+down_revision: Union[str, None] = "010"
+branch_labels: Union[str, Sequence[str], None] = None
+depends_on: Union[str, Sequence[str], None] = None
+
+
+def upgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.create_table(
+        "slack_agents",
+        sa.Column("id", sa.Integer(), nullable=False),
+        sa.Column("name", sa.String(), nullable=True),
+        sa.Column("slack_team_id", sa.String(), nullable=True),
+        sa.Column("slack_team_name", sa.String(), nullable=True),
+        sa.Column("slack_channel_id", sa.String(), nullable=True),
+        sa.Column("slack_channel_name", sa.String(), nullable=True),
+        sa.Column("is_active", sa.Boolean(), nullable=True),
+        sa.Column("workflow_id", sa.String(), nullable=True),
+        sa.Column("trigger_on_mention", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_direct_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_on_channel_message", sa.Boolean(), nullable=True),
+        sa.Column("trigger_keywords", sa.JSON(), nullable=True),
+        sa.Column("trigger_enabled", sa.Boolean(), nullable=True),
+        sa.ForeignKeyConstraint(
+            ["workflow_id"],
+            ["workflows.id"],
+        ),
+        sa.PrimaryKeyConstraint("id"),
+    )
+    op.create_index(op.f("ix_slack_agents_id"), "slack_agents", ["id"], unique=False)
+    op.create_index(op.f("ix_slack_agents_name"), "slack_agents", ["name"], unique=False)
+    op.create_index(
+        op.f("ix_slack_agents_slack_team_id"), "slack_agents", ["slack_team_id"], unique=False
+    )
+    # ### end Alembic commands ###
+
+
+def downgrade() -> None:
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.drop_index(op.f("ix_slack_agents_slack_team_id"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_name"), table_name="slack_agents")
+    op.drop_index(op.f("ix_slack_agents_id"), table_name="slack_agents")
+    op.drop_table("slack_agents")
+    # ### end Alembic commands ###
```

---

### Incident Patch 4: `529aa22a` (2025-03-26)
**Commit Message**: fix: linter errors

**File**: `backend/pyspur/api/slack_management.py` (modified, +1/-1)
```diff
@@ -626,7 +626,7 @@ async def send_message(
                 "message": f"Error sending message to Slack: {str(e)}",
                 "success": False,
             },
-        )
+        ) from e
 
 
 @router.post("/test-message", response_model=SlackMessageResponse)
```

**File**: `backend/pyspur/integrations/slack/socket_client.py` (modified, +14/-12)
```diff
@@ -1,3 +1,4 @@
+# type: ignore
 import asyncio
 import logging
 import os
@@ -22,6 +23,7 @@
 
 class SocketModeClient:
     """Client for handling Slack Socket Mode connections.
+
     This manages real-time event processing from Slack.
     """
 
@@ -57,7 +59,7 @@ def __init__(self):
         logger.info("SocketModeClient initialized")
 
     def set_workflow_trigger_callback(self, callback: Callable[..., Any]):
-        """Set the callback function to be called when a workflow should be triggered
+        """Set the callback function to be called when a workflow should be triggered.
 
         The callback can be either a regular function or an async coroutine function.
         If it's a coroutine function, it will be properly awaited when called.
@@ -68,7 +70,7 @@ def set_workflow_trigger_callback(self, callback: Callable[..., Any]):
         logger.info(f"Setting workflow trigger callback. Is async: {is_async}")
 
     def _register_event_handlers(self, app: App, agent_id: int):
-        """Register event handlers for the Slack app"""
+        """Register event handlers for the Slack app."""
 
         @app.event("app_mention")
         def handle_app_mention(
@@ -116,7 +118,7 @@ def _process_event(
         say: Callable,
         client=None,
     ):
-        """Process a Slack event and trigger workflows if appropriate"""
+        """Process a Slack event and trigger workflows if appropriate."""
         # Add diagnostics about the event
         logger.info(f"Received {event_type} event for agent {agent_id}")
         logger.info(f"Current blacklist: {self._blacklisted_agents}")
@@ -217,7 +219,7 @@ def _process_event(
             db.close()
 
     def start_socket_mode(self, agent_id: int) -> bool:
-        """Start socket mode for a Slack agent"""
+        """Start socket mode for a Slack agent."""
         logger.info(f"Starting socket mode for agent {agent_id}")
 
         # First make sure any existing socket is stopped
@@ -296,13 +298,13 @@ def start_socket_mode(self, agent_id: int) -> bool:
 
                 # Manually store the installation data for this workspace
                 # Get bot info to retrieve the bot_id, bot_user_id, and team_id
-                bot_info_response = app.client.auth_test()
+                bot_info_response = app.client.auth_test()  # type: ignore
                 if not bot_info_response["ok"]:
                     logger.error(f"Failed to get bot info: {bot_info_response['error']}")
                     return False
 
-                team_id = bot_info_response["team_id"]
-                bot_user_id = bot_info_response["user_id"]
+                team_id = str(bot_info_response["team_id"])  # type: ignore
+                bot_user_id = str(bot_info_response["user_id"])  # type: ignore
 
                 # Create and store installation data
                 installation = Installation(
@@ -359,7 +361,7 @@ def start_socket_mode(self, agent_id: int) -> bool:
             db.close()
 
     def stop_socket_mode(self, agent_id: int) -> bool:
-        """Stop Socket Mode for a specific agent"""
+        """Stop Socket Mode for a specific agent."""
         logger.info(f"Stopping Socket Mode for agent {agent_id}")
 
         # Add agent to blacklist to reject any incoming events
@@ -544,7 +546,7 @@ def stop_socket_mode(self, agent_id: int) -> bool:
             return False
 
     def _try_aggressive_thread_termination(self, agent_id: int, handler: Any) -> None:
-        """Attempt to aggressively terminate any threads or tasks associated with the socket handler"""
+        """Attempt to aggressively terminate any threads or tasks associated with the socket handler."""
         try:
             # See if the socket handler has a thread running and try to terminate it
             if hasattr(handler, "thread") and handler.thread:
@@ -591,11 +593,11 @@ def _try_aggressive_thread_termination(self, agent_id: int, handler: Any) -> Non
             logger.error(f"Error with aggressive thr
```

**File**: `backend/pyspur/integrations/slack/socket_worker.py` (modified, +4/-3)
```diff
@@ -1,5 +1,6 @@
 #!/usr/bin/env python
 """Worker process for handling a single Slack Socket Mode connection.
+
 This runs in a separate process managed by the SocketManager.
 """
 
@@ -25,7 +26,7 @@
 
 
 def get_active_agents(db: Session) -> list[SlackAgentModel]:
-    """Get all active agents that have socket mode enabled"""
+    """Get all active agents that have socket mode enabled."""
     agents = (
         db.query(SlackAgentModel)
         .filter_by(
@@ -38,7 +39,7 @@ def get_active_agents(db: Session) -> list[SlackAgentModel]:
 
 
 def setup_shutdown_handler(socket_client: SocketModeClient, agent_id: int):
-    """Set up signal handlers for graceful shutdown"""
+    """Set up signal handlers for graceful shutdown."""
 
     def handle_shutdown(signum: int, frame: Optional[types.FrameType]) -> None:
         logger.info(f"Worker {agent_id} received signal {signum}, shutting down")
@@ -50,7 +51,7 @@ def handle_shutdown(signum: int, frame: Optional[types.FrameType]) -> None:
 
 
 async def check_agent_status(db: Session, agent_id: int) -> bool:
-    """Check if the agent is still active and should be running
+    """Check if the agent is still active and should be running.
 
     Args:
         db: Database session
```

**File**: `backend/pyspur/models/slack_agent_model.py` (modified, +0/-2)
```diff
@@ -6,8 +6,6 @@
 from sqlalchemy.orm import relationship
 
 from .base_model import BaseModel
-from .workflow_model import WorkflowModel  # noqa: F401
-from .workflow_version_model import WorkflowVersionModel  # noqa: F401
 
 
 class SlackAgentModel(BaseModel):
```

---

### Incident Patch 5: `a8155267` (2025-03-26)
**Commit Message**: fix: comment out MCP Tools tab in ToolsPage component to prevent rendering

**File**: `frontend/src/pages/tools.tsx` (modified, +2/-2)
```diff
@@ -89,11 +89,11 @@ const ToolsPage: React.FC = () => {
                             <SpecTools onSpecCreated={handleEndpointsSelected} />
                         </div>
                     </Tab>
-                    <Tab key="mcp" title="MCP Tools">
+                    {/* <Tab key="mcp" title="MCP Tools">
                         <div className="py-4">
                             <MCPTools />
                         </div>
-                    </Tab>
+                    </Tab> */}
                 </Tabs>
             </div>
         </div>
```

---

### Incident Patch 6: `4860a453` (2025-03-26)
**Commit Message**: fix: more linter errors

**File**: `backend/pyspur/api/slack_management.py` (modified, +25/-25)
```diff
@@ -129,14 +129,14 @@ def handle_socket_mode_event_sync(
     say: Callable[..., Any],
     client: Optional[WebClient] = None,
 ):
-    """Synchronous wrapper for handle_socket_mode_event to be used in threaded contexts"""
+    """Synchronous wrapper for handle_socket_mode_event to be used in threaded contexts."""
     # Return the coroutine object without awaiting it
     # The socket client will handle awaiting it appropriately
     return handle_socket_mode_event(trigger_request, agent_id, say, client)
 
 
 async def _get_active_agent(db: Session, agent_id: int) -> Optional[SlackAgentModel]:
-    """Get an active agent with workflow configured"""
+    """Get an active agent with workflow configured."""
     agent = (
         db.query(SlackAgentModel)
         .filter(
@@ -400,7 +400,7 @@ async def _send_workflow_results_to_slack(
 
 @router.get("/agents", response_model=List[SlackAgentResponse])
 async def get_agents(db: Session = Depends(get_db)) -> List[SlackAgentResponse]:
-    """Get all configured Slack agents"""
+    """Get all configured Slack agents."""
     agents = db.query(SlackAgentModel).all()
     agent_responses: List[SlackAgentResponse] = []
 
@@ -413,7 +413,7 @@ async def get_agents(db: Session = Depends(get_db)) -> List[SlackAgentResponse]:
 
 
 def _get_nullable_str(value: Any) -> Optional[str]:
-    """Helper to safely convert nullable SQLAlchemy column to string"""
+    """Helper to safely convert nullable SQLAlchemy column to string."""
     return str(value) if value is not None else None
 
 
@@ -452,7 +452,7 @@ def _agent_to_response_model(agent: SlackAgentModel) -> SlackAgentResponse:
 
 @router.post("/agents", response_model=SlackAgentResponse)
 async def create_agent(agent_create: SlackAgentCreate, db: Session = Depends(get_db)):
-    """Create a new Slack agent configuration"""
+    """Create a new Slack agent configuration."""
     # Ensure workflow_id is provided
     if not agent_create.workflow_id:
         raise HTTPException(
@@ -491,7 +491,7 @@ async def create_agent(agent_create: SlackAgentCreate, db: Session = Depends(get
 
 @router.get("/agents/{agent_id}", response_model=SlackAgentResponse)
 async def get_agent(agent_id: int, db: Session = Depends(get_db)):
-    """Get a Slack agent configuration"""
+    """Get a Slack agent configuration."""
     agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
     if agent is None:
         raise HTTPException(status_code=404, detail="Agent not found")
@@ -502,7 +502,7 @@ async def get_agent(agent_id: int, db: Session = Depends(get_db)):
 
 @router.post("/agents/{agent_id}/send-message", response_model=SlackMessageResponse)
 async def send_agent_message(agent_id: int, message: SlackMessage, db: Session = Depends(get_db)):
-    """Send a message to a channel using the Slack agent"""
+    """Send a message to a channel using the Slack agent."""
     agent = db.query(SlackAgentModel).filter(SlackAgentModel.id == agent_id).first()
     if agent is None:
         raise HTTPException(status_code=404, detail="Agent not found")
@@ -550,7 +550,7 @@ async def send_agent_message(agent_id: int, message: SlackMessage, db: Session =
                 "message": f"Error sending message to Slack: {str(e)}",
                 "success": False,
             },
-        )
+        ) from e
 
 
 @router.post("/send-message", response_model=SlackMessageResponse)
@@ -636,7 +636,7 @@ async def test_message(
     agent_id: Optional[int] = None,
     db: Session = Depends(get_db),
 ) -> Dict[str, Any]:
-    """Test sending a message to a Slack channel"""
+    """Test sending a message to a Slack channel."""
     try:
         # Attempt to send the test message using the Slack client
         response = await send_message(channel=channel, text=text, agent_id=agent_id, db=db)
@@ -650,7 +650,7 @@ async def test_message(
 async def associate_workflow(
     agent_id: int, association: WorkflowAssociation, db: Session = Depends(get_db)
 ):
-    """
```

---

### Incident Patch 7: `0e521b72` (2025-03-26)
**Commit Message**: fix:  remaining  linter errors

**File**: `backend/pyspur/api/slack_management.py` (modified, +9/-5)
```diff
@@ -916,8 +916,8 @@ async def set_agent_token(
         # Try to get team information when setting a bot token
         try:
             client = AsyncWebClient(token=token_request.token)
-            response: AsyncSlackResponse = await client.auth_test()
-            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}
+            response: AsyncSlackResponse = await client.auth_test()  # type: ignore
+            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}  # type: ignore
             if response_data.get("ok"):
                 team_id = str(response_data.get("team_id", ""))
                 team_name = str(response_data.get("team", ""))
@@ -1391,9 +1391,10 @@ async def test_connection(agent_id: int, db: Session = Depends(get_db)):
 
         # Test the token by calling auth.test
         client = AsyncWebClient(token=bot_token)
+
         try:
-            response: AsyncSlackResponse = await client.auth_test()
-            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}
+            response: AsyncSlackResponse = await client.auth_test()  # type: ignore
+            response_data: Dict[str, Any] = response.data if isinstance(response.data, dict) else {}  # type: ignore
             if response_data.get("ok"):
                 team = str(response_data.get("team", "Unknown workspace"))
                 team_id = str(response_data.get("team_id", ""))
@@ -1418,7 +1419,10 @@ async def test_connection(agent_id: int, db: Session = Depends(get_db)):
             else:
                 return {
                     "success": False,
-                    "message": f"API call succeeded but returned not OK: {response_data.get('error', 'Unknown error')}",
+                    "message": (
+                        f"API call succeeded but returned not OK: "
+                        f"{response_data.get('error', 'Unknown error')}"
+                    ),
                 }
         except SlackApiError as e:
             error_response = cast(Dict[str, Any], getattr(e, "response", {}))
```

---

### Incident Patch 8: `fd469ed2` (2025-03-25)
**Commit Message**: Merge pull request #267 from PySpur-Dev/fix/ollama-models

v0.1.17

**File**: `backend/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "pyspur"
-version = "0.1.16"
+version = "0.1.17"
 description = "PySpur is a Graph UI for building AI Agents in Python"
 requires-python = ">=3.11"
 license = "Apache-2.0"
```

**File**: `backend/pyspur/nodes/llm/_utils.py` (modified, +0/-8)
```diff
@@ -558,21 +558,13 @@ async def ollama_with_backoff(
 
     """
     client = AsyncClient(host=api_base)
-    print("=== Ollama Configuration ===")
-    print(f"Model: '{model}' '{model.replace('ollama/', '')}'")
-    print(f"API Base: {api_base}")
-    print(f"Messages: {messages}")
-    print(f"Format: {format}")
-    print(f"Options: {options}")
     try:
         response = await client.chat(
             model=model.replace("ollama/", ""),
             messages=messages,
             format=format,
             options=(options or OllamaOptions()).to_dict(),
         )
-        print("=== Ollama Response ===")
-        print(f"Response: {response}")
         return response.message.content
     except Exception as e:
         logging.error(f"Error calling Ollama API: {e}")
```

---

### Incident Patch 9: `999da197` (2025-03-25)
**Commit Message**: refactor: remove debug print statements from ollama_with_backoff function

**File**: `backend/pyspur/nodes/llm/_utils.py` (modified, +0/-8)
```diff
@@ -558,21 +558,13 @@ async def ollama_with_backoff(
 
     """
     client = AsyncClient(host=api_base)
-    print("=== Ollama Configuration ===")
-    print(f"Model: '{model}' '{model.replace('ollama/', '')}'")
-    print(f"API Base: {api_base}")
-    print(f"Messages: {messages}")
-    print(f"Format: {format}")
-    print(f"Options: {options}")
     try:
         response = await client.chat(
             model=model.replace("ollama/", ""),
             messages=messages,
             format=format,
             options=(options or OllamaOptions()).to_dict(),
         )
-        print("=== Ollama Response ===")
-        print(f"Response: {response}")
         return response.message.content
     except Exception as e:
         logging.error(f"Error calling Ollama API: {e}")
```

---

### Incident Patch 10: `2ca3a2bc` (2025-03-25)
**Commit Message**: Merge pull request #266 from PySpur-Dev/fix/ollama-models

Fix/ollama models

**File**: `backend/pyspur/nodes/llm/_model_info.py` (modified, +64/-22)
```diff
@@ -122,10 +122,16 @@ class LLMModels(str, Enum):
     OLLAMA_DEEPSEEK_R1 = "ollama/deepseek-r1"
     OLLAMA_PHI4 = "ollama/phi4"
     OLLAMA_LLAMA3_3_70B = "ollama/llama3.3:70b"
-    OLLAMA_LLAMA3_3_8B = "ollama/llama3.3:8b"
-    OLLAMA_LLAMA3_2_8B = "ollama/llama3.2:8b"
+    OLLAMA_LLAMA3_2_3B = "ollama/llama3.2:3b"
     OLLAMA_LLAMA3_2_1B = "ollama/llama3.2:1b"
-    OLLAMA_LLAMA3_8B = "ollama/llama3"
+    OLLAMA_LLAMA3_1_8B = "ollama/llama3.1:8b"
+    OLLAMA_LLAMA3_1_70B = "ollama/llama3.1:70b"
+    OLLAMA_LLAMA3_8B = "ollama/llama3:8b"
+    OLLAMA_LLAMA3_70B = "ollama/llama3:70b"
+    OLLAMA_GEMMA_3_1B = "ollama/gemma3:1b"
+    OLLAMA_GEMMA_3_4B = "ollama/gemma3:4b"
+    OLLAMA_GEMMA_3_12B = "ollama/gemma3:12b"
+    OLLAMA_GEMMA_3_27B = "ollama/gemma3:27b"
     OLLAMA_GEMMA_2 = "ollama/gemma2"
     OLLAMA_GEMMA_2_2B = "ollama/gemma2:2b"
     OLLAMA_MISTRAL = "ollama/mistral"
@@ -429,67 +435,103 @@ def get_model_info(cls, model_id: str) -> LLMModel | None:
                 id=cls.OLLAMA_PHI4.value,
                 provider=LLMProvider.OLLAMA,
                 name="Phi 4",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
             ),
             cls.OLLAMA_LLAMA3_3_70B.value: LLMModel(
                 id=cls.OLLAMA_LLAMA3_3_70B.value,
                 provider=LLMProvider.OLLAMA,
                 name="Llama 3.3 (70B)",
                 constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
             ),
-            cls.OLLAMA_LLAMA3_3_8B.value: LLMModel(
-                id=cls.OLLAMA_LLAMA3_3_8B.value,
+            cls.OLLAMA_LLAMA3_2_3B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_2_3B.value,
                 provider=LLMProvider.OLLAMA,
-                name="Llama 3.3 (8B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
-            ),
-            cls.OLLAMA_LLAMA3_2_8B.value: LLMModel(
-                id=cls.OLLAMA_LLAMA3_2_8B.value,
-                provider=LLMProvider.OLLAMA,
-                name="Llama 3.2 (8B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                name="Llama 3.2 (3B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
             ),
             cls.OLLAMA_LLAMA3_2_1B.value: LLMModel(
                 id=cls.OLLAMA_LLAMA3_2_1B.value,
                 provider=LLMProvider.OLLAMA,
                 name="Llama 3.2 (1B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_LLAMA3_1_8B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_1_8B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Llama 3.1 (8B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_LLAMA3_1_70B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_1_70B.value,
+                provider=LLMProvider.OLLAMA,
+                name="Llama 3.1 (70B)",
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
             ),
             cls.OLLAMA_LLAMA3_8B.value: LLMModel(
                 id=cls.OLLAMA_LLAMA3_8B.value,
                 provider=LLMProvider.OLLAMA,
                 name="Llama 3 (8B)",
-                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0),
+                constraints=ModelConstraints(max_tokens=4096, max_temperature=2.0, supports_JSON_output=False),
+            ),
+            cls.OLLAMA_LLAMA3_70B.value: LLMModel(
+                id=cls.OLLAMA_LLAMA3_70B.value,
+                provid
```

**File**: `backend/pyspur/nodes/llm/_utils.py` (modified, +35/-10)
```diff
@@ -422,9 +422,22 @@ async def generate_text(
         if model_name.startswith("ollama"):
             if api_base is None:
                 api_base = os.getenv("OLLAMA_BASE_URL")
-            kwargs["api_base"] = api_base
-        message_response: Message = await completion_with_backoff(**kwargs)
-        response = message_response.content
+            options = OllamaOptions(temperature=temperature, max_tokens=max_tokens)
+            raw_response = await ollama_with_backoff(
+                model=model_name,
+                options=options,
+                messages=messages,
+                format="json",
+                api_base=api_base,
+            )
+            response = raw_response
+            message_response = Message(
+                content=json.dumps(raw_response),
+                tool_calls=[],
+            )
+        else:
+            message_response: Message = await completion_with_backoff(**kwargs)
+            response = message_response.content
 
     # For models that don't support JSON output, wrap the response in a JSON structure
     if not supports_json:
@@ -545,13 +558,25 @@ async def ollama_with_backoff(
 
     """
     client = AsyncClient(host=api_base)
-    response = await client.chat(
-        model=model.replace("ollama/", ""),
-        messages=messages,
-        format=format,
-        options=(options or OllamaOptions()).to_dict(),
-    )
-    return response.message.content
+    print("=== Ollama Configuration ===")
+    print(f"Model: '{model}' '{model.replace('ollama/', '')}'")
+    print(f"API Base: {api_base}")
+    print(f"Messages: {messages}")
+    print(f"Format: {format}")
+    print(f"Options: {options}")
+    try:
+        response = await client.chat(
+            model=model.replace("ollama/", ""),
+            messages=messages,
+            format=format,
+            options=(options or OllamaOptions()).to_dict(),
+        )
+        print("=== Ollama Response ===")
+        print(f"Response: {response}")
+        return response.message.content
+    except Exception as e:
+        logging.error(f"Error calling Ollama API: {e}")
+        raise e
 
 
 def convert_docx_to_xml(file_path: str) -> str:
```

#### Recent Merged Pull Requests:
- **PR #310** (closed): chore(deps): bump ghcr.io/devcontainers/features/docker-in-docker from 2.17.0 to 3.1.0 (@dependabot[bot])
- **PR #309** (closed): fix(files): prevent path traversal in file management endpoints (@andesyteoss)
- **PR #308** (closed): chore(deps): bump ghcr.io/devcontainers/features/docker-in-docker from 2.17.0 to 3.0.1 (@dependabot[bot])
- **PR #306** (closed): chore(deps): bump ghcr.io/devcontainers/features/docker-in-docker from 2.17.0 to 3.0.0 (@dependabot[bot])
- **PR #293** (2025-07-20): Update tiktoken to support MacOS (@yeger00)
- **PR #292** (2025-07-06): fix the error message in SlackSetupGuide.tsx (@Geraldf)
- **PR #286** (2025-05-12): Update README.md (@JeanKaddour)
- **PR #278** (2025-04-07): add xAI as a provider and Grok to the models (@rajeev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
