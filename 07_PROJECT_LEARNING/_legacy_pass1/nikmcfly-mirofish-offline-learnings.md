# Forensic Learning Record (Deep Inspection): nikmcfly/MiroFish-Offline

> **Canonical Artifact**: `07_PROJECT_LEARNING/nikmcfly-mirofish-offline-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nikmcfly/MiroFish-Offline](https://github.com/nikmcfly/MiroFish-Offline))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:17:59.199Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nikmcfly/MiroFish-Offline`
- **Description**: Offline multi-agent simulation & prediction engine. English fork of MiroFish with Neo4j + Ollama local stack.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2566 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/app/__init__.py`
```
"""
MiroFish Backend - Flask Application Factory
"""

import os
import warnings

# Suppress multiprocessing resource_tracker warnings (from third-party libraries like transformers)
# Must be set before all other imports
warnings.filterwarnings("ignore", message=".*resource_tracker.*")

from flask import Flask, request
from flask_cors import CORS

from .config import Config
from .utils.logger import setup_logger, get_logger


def create_app(config_class=Config):
    """Flask application factory function"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Configure JSON encoding: ensure Chinese displays directly (not as \uXXXX)
    # Flask >= 2.3 uses app.json.ensure_ascii, older versions use JSON_AS_ASCII config
    if hasattr(app, 'json') and hasattr(app.json, 'ensure_ascii'):
        app.json.ensure_ascii = False

    # Setup logging
    logger = setup_logger('mirofish')

    # Only print startup info in reloader subprocess (avoid printing twice in debug mode)
    is_reloader_process = os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
    debug_mode = app.config.get('DEBUG', False)
    should_log_startup = not debug_mode or is_reloader_process

    if should_log_startup:
        logger.info("=" * 50)
        logger.info("MiroFish-Offline Backend starting...")
        logger.info("=" * 50)

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # --- Initialize Neo4jStorage singleton (DI via app.extensions) ---
    from .storage import Neo4jStorage
    try:
        neo4j_storage = Neo4jStorage()
        app.extensions['neo4j_storage'] = neo4j_storage
        if should_log_startup:
            logger.info("Neo4jStorage initialized (connected to %s)", Config.NEO4J_URI)
    except Exception as e:
        logger.error("Neo4jStorage initialization failed: %s", e)
        # Store None so endpoints can return 503 gracefully
        app.extensions['neo4j_storage'] = None

    # Register simulation process cleanup function (ensure all simulation processes terminate on server shutdown)
    from .services.simulation_runner import SimulationRunner
    SimulationRunner.register_cleanup()
    if should_log_startup:
        logger.info("Simulation process cleanup function registered")

    # Request logging middleware
    @app.before_request
    def log_request():
        logger = get_logger('mirofish.request')
        logger.debug(f"Request: {request.method} {request.path}")
        if request.content_type and 'json' in request.content_type:
            logger.debug(f"Request body: {request.get_json(silent=True)}")

    @app.after_request
    def log_response(response):
        logger = get_logger('mirofish.request')
        logger.debug(f"Response: {response.status_code}")
        return response

    # Register blueprints
    from .api import graph_bp, simulation_bp, report_bp
    app.register_blueprint(graph_bp, url_prefix='/api/graph')
    app.register_blueprint(simulation_bp, url_prefix='/api/simulation')
    app.register_blueprint(report_bp, url_prefix='/api/report')

    # Health check
    @app.route('/health')
    def health():
        return {'status': 'ok', 'service': 'MiroFish-Offline Backend'}

    if should_log_startup:
        logger.info("MiroFish-Offline Backend startup complete")

    return app


```

### Core Architecture Module: `backend/app/api/__init__.py`
```
"""
API Routes Module
"""

from flask import Blueprint

graph_bp = Blueprint('graph', __name__)
simulation_bp = Blueprint('simulation', __name__)
report_bp = Blueprint('report', __name__)

from . import graph  # noqa: E402, F401
from . import simulation  # noqa: E402, F401
from . import report  # noqa: E402, F401


```

### Core Architecture Module: `backend/app/api/graph.py`
```
"""
Graph-related API Routes
Uses project context mechanism with server-side state persistence
"""

import os
import traceback
import threading
from flask import request, jsonify, current_app

from . import graph_bp
from ..config import Config
from ..services.ontology_generator import OntologyGenerator
from ..services.graph_builder import GraphBuilderService
from ..services.text_processor import TextProcessor
from ..utils.file_parser import FileParser
from ..utils.logger import get_logger
from ..models.task import TaskManager, TaskStatus
from ..models.project import ProjectManager, ProjectStatus

# Get logger
logger = get_logger('mirofish.api')


def _get_storage():
    """Get Neo4jStorage from Flask app extensions."""
    storage = current_app.extensions.get('neo4j_storage')
    if not storage:
        raise ValueError("GraphStorage not initialized — check Neo4j connection")
    return storage


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    if not filename or '.' not in filename:
        return False
    ext = os.path.splitext(filename)[1].lower().lstrip('.')
    return ext in Config.ALLOWED_EXTENSIONS


# ============== Project Management Interface ==============

@graph_bp.route('/project/<project_id>', methods=['GET'])
def get_project(project_id: str):
    """
    Get project details
    """
    project = ProjectManager.get_project(project_id)
    
    if not project:
        return jsonify({
            "success": False,
            "error": f"Project does not exist: {project_id}"
        }), 404
    
    return jsonify({
        "success": True,
        "data": project.to_dict()
    })


@graph_bp.route('/project/list', methods=['GET'])
def list_projects():
    """
    List all projects
    """
    limit = request.args.get('limit', 50, type=int)
    projects = ProjectManager.list_projects(limit=limit)
    
    return jsonify({
        "success": True,
        "data": [p.to_dict() for p in projects],
        "count": len(projects)
    })


@graph_bp.route('/project/<project_id>', methods=['DELETE'])
def delete_project(project_id: str):
    """
    Delete project
    """
    success = ProjectManager.delete_project(project_id)

    if not success:
        return jsonify({
            "success": False,
            "error": f"Project does not exist or deletion failed: {project_id}"
        }), 404

    return jsonify({
        "success": True,
        "message": f"Project deleted: {project_id}"
    })


@graph_bp.route('/project/<project_id>/reset', methods=['POST'])
def reset_project(project_id: str):
    """
    Reset project status (for rebuilding graph)
    """
    project = ProjectManager.get_project(project_id)

    if not project:
        return jsonify({
            "success": False,
            "error": f"Project does not exist: {project_id}"
        }), 404

    # Reset to ontology generated state
    if project.ontology:
        project.status = ProjectStatus.ONTOLOGY_GENERATED
    else:
        project.status = ProjectStatus.CREATED

    project.graph_id = None
    project.graph_build_task_id = None
    project.error = None
    ProjectManager.save_project(project)

    return jsonify({
        "success": True,
        "message": f"Project reset: {project_id}",
        "data": project.to_dict()
    })


# ============== Interface 1: Upload Files and Generate Ontology ==============

@graph_bp.route('/ontology/generate', methods=['POST'])
def generate_ontology():
    """
    Interface 1: Upload files and analyze to generate ontology definition

    Request method: multipart/form-data

    Parameters:
        files: Uploaded files (PDF/MD/TXT), multiple allowed
        simulation_requirement: Simulation requirement description (required)
        project_name: Project name (optional)
        additional_context: Additional notes (optional)

    Response:
        {
            "success": true,
            "data": {
                "project_id": "proj_xxxx",
                "ontology": {
                    "entity_types": [...],
                    "edge_types": [...],
                    "analysis_summary": "..."
                },
                "files": [...],
                "total_text_length": 12345
            }
        }
    """
    try:
        logger.info("=== Starting ontology generation ===")

        # Get parameters
        simulation_requirement = request.form.get('simulation_requirement', '')
        project_name = request.form.get('project_name', 'Unnamed Project')
        additional_context = request.form.get('additional_context', '')

        logger.debug(f"Project name: {project_name}")
        logger.debug(f"Simulation requirement: {simulation_requirement[:100]}...")

        if not simulation_requirement:
            return jsonify({
                "success": False,
                "error": "Please provide simulation requirement description (simulation_requirement)"
            }), 400

        # Get uploaded files
        uploaded_files = request.files.getlist('files')
        if not uploaded_files or all(not f.filename for f in uploaded_files):
            return jsonify({
                "success": False,
                "error": "Please upload at least one document file"
            }), 400

        # Create project
        project = ProjectManager.create_project(name=project_name)
        project.simulation_requirement = simulation_requirement
        logger.info(f"Project created: {project.project_id}")
        
        # Save files and extract text
        document_texts = []
        all_text = ""

        for file in uploaded_files:
            if file and file.filename and allowed_file(file.filename):
                # Save file to project directory
                file_info = ProjectManager.save_file_to_project(
                    project.project_id,
                    file,
                    file.filename
                )
                project.files.append({
                    "filename": file_info["original_filename"],
                    "size": file_info["size"]
                })

                # Extract text
                text = FileParser.extract_text(file_info["path"])
                text = TextProcessor.preprocess_text(text)
                document_texts.append(text)
                all_text += f"\n\n=== {file_info['original_filename']} ===\n{text}"

        if not document_texts:
            ProjectManager.delete_project(project.project_id)
            return jsonify({
                "success": False,
                "error": "No documents successfully processed. Please check file format"
            }), 400

        # Save extracted text
        project.total_text_length = len(all_text)
        ProjectManager.save_extracted_text(project.project_id, all_text)
        logger.info(f"Text extraction completed, total {len(all_text)} characters")

        # Generate ontology
        logger.info("Calling LLM to generate ontology definition...")
        generator = OntologyGenerator()
        ontology = generator.generate(
            document_texts=document_texts,
            simulation_requirement=simulation_requirement,
            additional_context=additional_context if additional_context else None
        )

        # Save ontology to project
        entity_count = len(ontology.get("entity_types", []))
        edge_count = len(ontology.get("edge_types", []))
        logger.info(f"Ontology generation completed: {entity_count} entity types, {edge_count} relation types")
        
        project.ontology = {
            "entity_types": ontology.get("entity_types", []),
            "edge_types": ontology.get("edge_types", [])
        }
        project.analysis_summary = ontology.get("analysis_summary", "")
        project.status = ProjectStatus.ONTOLOGY_GENERATED
        ProjectManager.save_project(project)
        logger.info(f"=== Ontology generation completed === Project ID: {project.project_id}")
        
        return jsonify({
           
```

### Core Architecture Module: `backend/app/api/report.py`
```
"""
Report API Routes
Provides interfaces for simulation report generation, retrieval, and conversation
"""

import os
import traceback
import threading
from flask import request, jsonify, send_file, current_app

from . import report_bp
from ..config import Config
from ..services.report_agent import ReportAgent, ReportManager, ReportStatus
from ..services.simulation_manager import SimulationManager
from ..models.project import ProjectManager
from ..models.task import TaskManager, TaskStatus
from ..services.graph_tools import GraphToolsService
from ..utils.logger import get_logger

logger = get_logger('mirofish.api.report')


# ============== Report Generation Interface ==============

@report_bp.route('/generate', methods=['POST'])
def generate_report():
    try:
        data = request.get_json() or {}
        simulation_id = data.get('simulation_id')
        if not simulation_id:
            return jsonify({"success": False, "error": "Please provide simulation_id"}), 400

        force_regenerate = data.get('force_regenerate', False)
        manager = SimulationManager()
        state = manager.get_simulation(simulation_id)
        if not state:
            return jsonify({"success": False, "error": f"Simulation does not exist: {simulation_id}"}), 404

        if not force_regenerate:
            existing_report = ReportManager.get_report_by_simulation(simulation_id)
            if existing_report and existing_report.status == ReportStatus.COMPLETED:
                return jsonify({"success": True, "data": {
                    "simulation_id": simulation_id,
                    "report_id": existing_report.report_id,
                    "status": "completed",
                    "message": "Report already exists",
                    "already_generated": True
                }})

        project = ProjectManager.get_project(state.project_id)
        if not project:
            return jsonify({"success": False, "error": f"Project does not exist: {state.project_id}"}), 404

        graph_id = state.graph_id or project.graph_id
        if not graph_id:
            return jsonify({"success": False, "error": "Missing graph ID, please ensure graph is built"}), 400

        simulation_requirement = project.simulation_requirement
        if not simulation_requirement:
            return jsonify({"success": False, "error": "Missing simulation requirement description"}), 400

        import uuid
        report_id = f"report_{uuid.uuid4().hex[:12]}"

        task_manager = TaskManager()
        task_id = task_manager.create_task(
            task_type="report_generate",
            metadata={"simulation_id": simulation_id, "graph_id": graph_id, "report_id": report_id}
        )

        # Initialize graph_tools in Flask context BEFORE spawning thread
        # (current_app is not available inside background threads)
        storage = current_app.extensions.get('neo4j_storage')
        if not storage:
            return jsonify({"success": False, "error": "GraphStorage not initialized — check Neo4j connection"}), 500
        graph_tools = GraphToolsService(storage=storage)

        def run_generate():
            try:
                task_manager.update_task(task_id, status=TaskStatus.PROCESSING, progress=0, message="Initializing Report Agent...")
                agent = ReportAgent(
                    graph_id=graph_id,
                    simulation_id=simulation_id,
                    simulation_requirement=simulation_requirement,
                    graph_tools=graph_tools
                )
                def progress_callback(stage, progress, message):
                    task_manager.update_task(task_id, progress=progress, message=f"[{stage}] {message}")
                report = agent.generate_report(progress_callback=progress_callback, report_id=report_id)
                ReportManager.save_report(report)
                if report.status == ReportStatus.COMPLETED:
                    task_manager.complete_task(task_id, result={"report_id": report.report_id, "simulation_id": simulation_id, "status": "completed"})
                else:
                    task_manager.fail_task(task_id, report.error or "Report generation failed")
            except Exception as e:
                logger.error(f"Report generation failed: {str(e)}")
                task_manager.fail_task(task_id, str(e))

        thread = threading.Thread(target=run_generate, daemon=True)
        thread.start()

        return jsonify({"success": True, "data": {
            "simulation_id": simulation_id,
            "report_id": report_id,
            "task_id": task_id,
            "status": "generating",
            "message": "Report generation task started. Query progress via /api/report/generate/status",
            "already_generated": False
        }})

    except Exception as e:
        logger.error(f"Failed to start report generation task: {str(e)}")
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc()}), 500


@report_bp.route('/generate/status', methods=['POST'])
def get_generate_status():
    try:
        data = request.get_json() or {}
        task_id = data.get('task_id')
        simulation_id = data.get('simulation_id')

        if simulation_id:
            existing_report = ReportManager.get_report_by_simulation(simulation_id)
            if existing_report and existing_report.status == ReportStatus.COMPLETED:
                return jsonify({"success": True, "data": {
                    "simulation_id": simulation_id,
                    "report_id": existing_report.report_id,
                    "status": "completed",
                    "progress": 100,
                    "message": "Report generated",
                    "already_completed": True
                }})

        if not task_id:
            return jsonify({"success": False, "error": "Please provide task_id or simulation_id"}), 400

        task_manager = TaskManager()
        task = task_manager.get_task(task_id)
        if not task:
            return jsonify({"success": False, "error": f"Task does not exist: {task_id}"}), 404

        return jsonify({"success": True, "data": task.to_dict()})

    except Exception as e:
        logger.error(f"Failed to query task status: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============== Report Retrieval Interface ==============

@report_bp.route('/<report_id>', methods=['GET'])
def get_report(report_id: str):
    try:
        report = ReportManager.get_report(report_id)
        if not report:
            return jsonify({"success": False, "error": f"Report does not exist: {report_id}"}), 404
        return jsonify({"success": True, "data": report.to_dict()})
    except Exception as e:
        logger.error(f"Failed to get report: {str(e)}")
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc()}), 500


@report_bp.route('/by-simulation/<simulation_id>', methods=['GET'])
def get_report_by_simulation(simulation_id: str):
    try:
        report = ReportManager.get_report_by_simulation(simulation_id)
        if not report:
            return jsonify({"success": False, "error": f"No report available for this simulation: {simulation_id}", "has_report": False}), 404
        return jsonify({"success": True, "data": report.to_dict()})
    except Exception as e:
        logger.error(f"Failed to get report: {str(e)}")
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc()}), 500


@report_bp.route('/list', methods=['GET'])
def list_reports():
    try:
        simulation_id = request.args.get('simulation_id')
        limit = request.args.get('limit', 50, type=int)
        reports = ReportManager.list_reports(simulation_id=simulation_id, limit=limit)
        return jsonify({"success": True, "data": [r.to_dict() for r in reports], "count": len(reports)})
    except Exception as e:
        logger.error(f"Failed to list
```

### Core Architecture Module: `backend/app/api/simulation.py`
```
"""
Simulation-related API routes
Step2: Entity reading and filtering, OASIS simulation preparation and execution (fully automated)
"""

import os
import traceback
from flask import request, jsonify, send_file, current_app

from . import simulation_bp
from ..config import Config
from ..services.entity_reader import EntityReader
from ..services.oasis_profile_generator import OasisProfileGenerator
from ..services.simulation_manager import SimulationManager, SimulationStatus
from ..services.simulation_runner import SimulationRunner, RunnerStatus
from ..utils.logger import get_logger
from ..models.project import ProjectManager

logger = get_logger('mirofish.api.simulation')


# Interview prompt optimization prefix
# Adding this prefix can prevent agents from calling tools and reply directly with text
INTERVIEW_PROMPT_PREFIX = "Based on your persona, all your past memories and actions, reply directly to me with text without calling any tools:"


def optimize_interview_prompt(prompt: str) -> str:
    """
    Optimize Interview questions, add prefix to avoid agent calling tools
    
    Args:
        prompt: Original question
        
    Returns:
        Optimized question
    """
    if not prompt:
        return prompt
    # Avoid adding prefix repeatedly
    if prompt.startswith(INTERVIEW_PROMPT_PREFIX):
        return prompt
    return f"{INTERVIEW_PROMPT_PREFIX}{prompt}"


# ============== Entity reading interface ==============

@simulation_bp.route('/entities/<graph_id>', methods=['GET'])
def get_graph_entities(graph_id: str):
    """
    Get all entities from the knowledge graph (filtered)
    
    Only return nodes that match predefined entity types (nodes whose Labels are not just Entity)
    
    Query parameters:
        entity_types: comma-separated list of entity types (optional, for further filtering)
        enrich: whether to get related edge information (default true)
    """
    try:
        entity_types_str = request.args.get('entity_types', '')
        entity_types = [t.strip() for t in entity_types_str.split(',') if t.strip()] if entity_types_str else None
        enrich = request.args.get('enrich', 'true').lower() == 'true'
        
        logger.info(f"Get knowledge graph entities: graph_id={graph_id}, entity_types={entity_types}, enrich={enrich}")
        
        storage = current_app.extensions.get('neo4j_storage')
        if not storage:
            raise ValueError("GraphStorage not initialized")
        reader = EntityReader(storage)
        result = reader.filter_defined_entities(
            graph_id=graph_id,
            defined_entity_types=entity_types,
            enrich_with_edges=enrich
        )
        
        return jsonify({
            "success": True,
            "data": result.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Failed to get knowledge graph entities: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


@simulation_bp.route('/entities/<graph_id>/<entity_uuid>', methods=['GET'])
def get_entity_detail(graph_id: str, entity_uuid: str):
    """Get detailed information of a single entity"""
    try:
        storage = current_app.extensions.get('neo4j_storage')
        if not storage:
            raise ValueError("GraphStorage not initialized")
        reader = EntityReader(storage)
        entity = reader.get_entity_with_context(graph_id, entity_uuid)
        
        if not entity:
            return jsonify({
                "success": False,
                "error": f"Entity does not exist: {entity_uuid}"
            }), 404
        
        return jsonify({
            "success": True,
            "data": entity.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Failed to get entity details: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


@simulation_bp.route('/entities/<graph_id>/by-type/<entity_type>', methods=['GET'])
def get_entities_by_type(graph_id: str, entity_type: str):
    """Get all entities of specified type"""
    try:
        enrich = request.args.get('enrich', 'true').lower() == 'true'
        
        storage = current_app.extensions.get('neo4j_storage')
        if not storage:
            raise ValueError("GraphStorage not initialized")
        reader = EntityReader(storage)
        entities = reader.get_entities_by_type(
            graph_id=graph_id,
            entity_type=entity_type,
            enrich_with_edges=enrich
        )
        
        return jsonify({
            "success": True,
            "data": {
                "entity_type": entity_type,
                "count": len(entities),
                "entities": [e.to_dict() for e in entities]
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to get entities: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


# ============== Simulation management interface ==============

@simulation_bp.route('/create', methods=['POST'])
def create_simulation():
    """
    Create new simulation
    
    Note: parameters like max_rounds are intelligently generated by LLM, no manual setting needed
    
    Request (JSON):
        {
            "project_id": "proj_xxxx",      // Required
            "graph_id": "mirofish_xxxx",    // Optional, if not provided, get from project
            "enable_twitter": true,          // Optional, default true
            "enable_reddit": true            // Optional, default true
        }
    
    Returns:
        {
            "success": true,
            "data": {
                "simulation_id": "sim_xxxx",
                "project_id": "proj_xxxx",
                "graph_id": "mirofish_xxxx",
                "status": "created",
                "enable_twitter": true,
                "enable_reddit": true,
                "created_at": "2025-12-01T10:00:00"
            }
        }
    """
    try:
        data = request.get_json() or {}
        
        project_id = data.get('project_id')
        if not project_id:
            return jsonify({
                "success": False,
                "error": "Please provide project_id"
            }), 400
        
        project = ProjectManager.get_project(project_id)
        if not project:
            return jsonify({
                "success": False,
                "error": f"Project does not exist: {project_id}"
            }), 404
        
        graph_id = data.get('graph_id') or project.graph_id
        if not graph_id:
            return jsonify({
                "success": False,
                "error": "Project has not built knowledge graph yet, please call /api/graph/build first"
            }), 400
        
        manager = SimulationManager()
        state = manager.create_simulation(
            project_id=project_id,
            graph_id=graph_id,
            enable_twitter=data.get('enable_twitter', True),
            enable_reddit=data.get('enable_reddit', True),
        )
        
        return jsonify({
            "success": True,
            "data": state.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Failed to create simulation: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


def _check_simulation_prepared(simulation_id: str) -> tuple:
    """
    Check if simulation is ready
    
    Check conditions:
    1. state.json exists and status is "ready"
    2. Required files exist: reddit_profiles.json, twitter_profiles.csv, simulation_config.json
    
    Note: run scripts (run_*.py) remain in backend/scripts/ directory, no longer copied to simulation dire
```

### Core Architecture Module: `backend/app/config.py`
```
"""
Configuration Management
Loads configuration from .env file in project root directory
"""

import os
from dotenv import load_dotenv

# Load .env file from project root
# Path: MiroFish/.env (relative to backend/app/config.py)
project_root_env = os.path.join(os.path.dirname(__file__), '../../.env')

if os.path.exists(project_root_env):
    load_dotenv(project_root_env, override=True)
else:
    # If no .env in root, try to load environment variables (for production)
    load_dotenv(override=True)


class Config:
    """Flask configuration class"""

    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY', 'mirofish-secret-key')
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'

    # JSON configuration - disable ASCII escaping to display Chinese directly (not as \uXXXX)
    JSON_AS_ASCII = False

    # LLM configuration (unified OpenAI format)
    LLM_API_KEY = os.environ.get('LLM_API_KEY')
    LLM_BASE_URL = os.environ.get('LLM_BASE_URL', 'http://localhost:11434/v1')
    LLM_MODEL_NAME = os.environ.get('LLM_MODEL_NAME', 'qwen2.5:32b')

    # Neo4j configuration
    NEO4J_URI = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
    NEO4J_USER = os.environ.get('NEO4J_USER', 'neo4j')
    NEO4J_PASSWORD = os.environ.get('NEO4J_PASSWORD', 'mirofish')

    # Embedding configuration
    EMBEDDING_MODEL = os.environ.get('EMBEDDING_MODEL', 'nomic-embed-text')
    EMBEDDING_BASE_URL = os.environ.get('EMBEDDING_BASE_URL', 'http://localhost:11434')

    # File upload configuration
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../uploads')
    ALLOWED_EXTENSIONS = {'pdf', 'md', 'txt', 'markdown'}

    # Text processing configuration
    DEFAULT_CHUNK_SIZE = 500  # Default chunk size
    DEFAULT_CHUNK_OVERLAP = 50  # Default overlap size

    # OASIS simulation configuration
    OASIS_DEFAULT_MAX_ROUNDS = int(os.environ.get('OASIS_DEFAULT_MAX_ROUNDS', '10'))
    OASIS_SIMULATION_DATA_DIR = os.path.join(os.path.dirname(__file__), '../uploads/simulations')

    # OASIS platform available actions configuration
    OASIS_TWITTER_ACTIONS = [
        'CREATE_POST', 'LIKE_POST', 'REPOST', 'FOLLOW', 'DO_NOTHING', 'QUOTE_POST'
    ]
    OASIS_REDDIT_ACTIONS = [
        'LIKE_POST', 'DISLIKE_POST', 'CREATE_POST', 'CREATE_COMMENT',
        'LIKE_COMMENT', 'DISLIKE_COMMENT', 'SEARCH_POSTS', 'SEARCH_USER',
        'TREND', 'REFRESH', 'DO_NOTHING', 'FOLLOW', 'MUTE'
    ]

    # Report Agent configuration
    REPORT_AGENT_MAX_TOOL_CALLS = int(os.environ.get('REPORT_AGENT_MAX_TOOL_CALLS', '5'))
    REPORT_AGENT_MAX_REFLECTION_ROUNDS = int(os.environ.get('REPORT_AGENT_MAX_REFLECTION_ROUNDS', '2'))
    REPORT_AGENT_TEMPERATURE = float(os.environ.get('REPORT_AGENT_TEMPERATURE', '0.5'))

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        errors = []
        if not cls.LLM_API_KEY:
            errors.append("LLM_API_KEY not configured (set to any non-empty value, e.g. 'ollama')")
        if not cls.NEO4J_URI:
            errors.append("NEO4J_URI not configured")
        if not cls.NEO4J_PASSWORD:
            errors.append("NEO4J_PASSWORD not configured")
        return errors

```

### Core Architecture Module: `backend/app/models/__init__.py`
```
"""
Data Models Module
"""

from .task import TaskManager, TaskStatus
from .project import Project, ProjectStatus, ProjectManager

__all__ = ['TaskManager', 'TaskStatus', 'Project', 'ProjectStatus', 'ProjectManager']


```

### Core Architecture Module: `backend/app/models/project.py`
```
"""
Project Context Management
Persists project state on server to avoid frontend passing large data between interfaces
"""

import os
import json
import uuid
import shutil
from datetime import datetime
from typing import Dict, Any, List, Optional
from enum import Enum
from dataclasses import dataclass, field, asdict
from ..config import Config


class ProjectStatus(str, Enum):
    """Project status"""
    CREATED = "created"              # Just created, files uploaded
    ONTOLOGY_GENERATED = "ontology_generated"  # Ontology generated
    GRAPH_BUILDING = "graph_building"    # Graph building in progress
    GRAPH_COMPLETED = "graph_completed"  # Graph build completed
    FAILED = "failed"                # Failed


@dataclass
class Project:
    """Project data model"""
    project_id: str
    name: str
    status: ProjectStatus
    created_at: str
    updated_at: str

    # File information
    files: List[Dict[str, str]] = field(default_factory=list)  # [{filename, path, size}]
    total_text_length: int = 0

    # Ontology information (populated after interface 1 generates)
    ontology: Optional[Dict[str, Any]] = None
    analysis_summary: Optional[str] = None

    # Graph information (populated after interface 2 completes)
    graph_id: Optional[str] = None
    graph_build_task_id: Optional[str] = None

    # Configuration
    simulation_requirement: Optional[str] = None
    chunk_size: int = 500
    chunk_overlap: int = 50

    # Error information
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "project_id": self.project_id,
            "name": self.name,
            "status": self.status.value if isinstance(self.status, ProjectStatus) else self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "files": self.files,
            "total_text_length": self.total_text_length,
            "ontology": self.ontology,
            "analysis_summary": self.analysis_summary,
            "graph_id": self.graph_id,
            "graph_build_task_id": self.graph_build_task_id,
            "simulation_requirement": self.simulation_requirement,
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
            "error": self.error
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Project':
        """Create from dictionary"""
        status = data.get('status', 'created')
        if isinstance(status, str):
            status = ProjectStatus(status)
        
        return cls(
            project_id=data['project_id'],
            name=data.get('name', 'Unnamed Project'),
            status=status,
            created_at=data.get('created_at', ''),
            updated_at=data.get('updated_at', ''),
            files=data.get('files', []),
            total_text_length=data.get('total_text_length', 0),
            ontology=data.get('ontology'),
            analysis_summary=data.get('analysis_summary'),
            graph_id=data.get('graph_id'),
            graph_build_task_id=data.get('graph_build_task_id'),
            simulation_requirement=data.get('simulation_requirement'),
            chunk_size=data.get('chunk_size', 500),
            chunk_overlap=data.get('chunk_overlap', 50),
            error=data.get('error')
        )


class ProjectManager:
    """Project Manager - handles project persistence and retrieval"""

    # Project storage root directory
    PROJECTS_DIR = os.path.join(Config.UPLOAD_FOLDER, 'projects')

    @classmethod
    def _ensure_projects_dir(cls):
        """Ensure project directory exists"""
        os.makedirs(cls.PROJECTS_DIR, exist_ok=True)

    @classmethod
    def _get_project_dir(cls, project_id: str) -> str:
        """Get project directory path"""
        return os.path.join(cls.PROJECTS_DIR, project_id)

    @classmethod
    def _get_project_meta_path(cls, project_id: str) -> str:
        """Get project metadata file path"""
        return os.path.join(cls._get_project_dir(project_id), 'project.json')

    @classmethod
    def _get_project_files_dir(cls, project_id: str) -> str:
        """Get project file storage directory"""
        return os.path.join(cls._get_project_dir(project_id), 'files')

    @classmethod
    def _get_project_text_path(cls, project_id: str) -> str:
        """Get project extracted text storage path"""
        return os.path.join(cls._get_project_dir(project_id), 'extracted_text.txt')

    @classmethod
    def create_project(cls, name: str = "Unnamed Project") -> Project:
        """
        Create new project

        Args:
            name: Project name

        Returns:
            Newly created Project object
        """
        cls._ensure_projects_dir()

        project_id = f"proj_{uuid.uuid4().hex[:12]}"
        now = datetime.now().isoformat()

        project = Project(
            project_id=project_id,
            name=name,
            status=ProjectStatus.CREATED,
            created_at=now,
            updated_at=now
        )

        # Create project directory structure
        project_dir = cls._get_project_dir(project_id)
        files_dir = cls._get_project_files_dir(project_id)
        os.makedirs(project_dir, exist_ok=True)
        os.makedirs(files_dir, exist_ok=True)

        # Save project metadata
        cls.save_project(project)

        return project

    @classmethod
    def save_project(cls, project: Project) -> None:
        """Save project metadata"""
        project.updated_at = datetime.now().isoformat()
        meta_path = cls._get_project_meta_path(project.project_id)

        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(project.to_dict(), f, ensure_ascii=False, indent=2)

    @classmethod
    def get_project(cls, project_id: str) -> Optional[Project]:
        """
        Get project

        Args:
            project_id: Project ID

        Returns:
            Project object, or None if not found
        """
        meta_path = cls._get_project_meta_path(project_id)

        if not os.path.exists(meta_path):
            return None

        with open(meta_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return Project.from_dict(data)

    @classmethod
    def list_projects(cls, limit: int = 50) -> List[Project]:
        """
        List all projects

        Args:
            limit: Result count limit

        Returns:
            Project list, sorted by creation time (descending)
        """
        cls._ensure_projects_dir()

        projects = []
        for project_id in os.listdir(cls.PROJECTS_DIR):
            project = cls.get_project(project_id)
            if project:
                projects.append(project)

        # Sort by creation time (descending)
        projects.sort(key=lambda p: p.created_at, reverse=True)

        return projects[:limit]

    @classmethod
    def delete_project(cls, project_id: str) -> bool:
        """
        Delete project and all its files

        Args:
            project_id: Project ID

        Returns:
            Whether deletion succeeded
        """
        project_dir = cls._get_project_dir(project_id)

        if not os.path.exists(project_dir):
            return False

        shutil.rmtree(project_dir)
        return True

    @classmethod
    def save_file_to_project(cls, project_id: str, file_storage, original_filename: str) -> Dict[str, str]:
        """
        Save uploaded file to project directory

        Args:
            project_id: Project ID
            file_storage: Flask FileStorage object
            original_filename: Original filename

        Returns:
            File information dictionary {filename, path, size}
        """
        files_dir = cls._get_project_files_dir(project_id)
        os.makedirs(files_dir, exist_ok=True)

        # Generate safe filename
        ext = os.path.splitext(original_filename)[1].lower()
     
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #49** (2026-06-17): **fix: increase live audience json budget**
  *Symptoms*: ## Summary - increase live persona JSON completion budget from 450 to 900 tokens - keep the same DeepSeek Flash/Pro path and retry behavior - add a regression test for truncated invalid JSON repair calls  ## Why Recent production quality-turn runs failed with invalid_json while provider metadata showed completions hitting the previous 450-token ceiling. This keeps the rollout small and reversible before rerunning the batch.  ## Checks - UV_CACHE_DIR=/Users/pd/Developer/mirofish-online/.uv-cache uv run pytest tests/test_audience_graph.py -q - UV_CACHE_DIR=/Users/pd/Developer/mirofish-online/.uv-cache npm run check  ## Rollback Revert this PR and redeploy app-only; no schema or persistent-data migration. 
  **Post-Mortem & Fix Analysis**:
  > Closing: this PR was opened against the wrong base repository by mistake. The intended PR is for pdurlej/mirofish-online.

- **Issue #47** (2026-06-04): **feat: add structured audience panel smoke**
  *Symptoms*: ## Summary  Adds a tiny structured-output audience panel smoke path for MiroFish Online. This proves the product-value path without Neo4j graph build, NER/RE extraction, OASIS/CAMEL simulation, or the current ReACT ReportAgent.  ## What changed  - Added task-aware LLM model aliases:   - `MIROFISH_JSON_MODEL`   - `MIROFISH_NER_MODEL`   - `MIROFISH_REPORT_MODEL`   - `MIROFISH_REPAIR_MODEL` - Added `LLMClient.chat_schema(...)` with:   - `json_schema` first   - fallback to schema-in-prompt + `json_object` when schema support is rejected or ignored   - local schema validation for the smoke subset   - sanitized errors without raw model output - Added `scripts/audience_panel_smoke.py`:   - `--backend openai|antigravity`   - writes `report.md` and sanitized `receipt.json`   - enforces 8+ personas, 8+ objections, 3+ non-generic insights, 5+ decision tests, and a bounded final recommendation - Added focused tests for schema handling, fallback behavior, Antigravity parsing, sanitized failures, and bypassing the heavy MiroFish pipeline.  ## Validation  - `cd backend && uv run pytest tests/test_llm_client.py tests/test_audience_panel_smoke.py` — passed, 11 tests. - `cd backend && uv run python -m compileall app scripts run.py && uv run pytest` — passed, 12 tests. - `npm run check` — passed. - Antigravity reference smoke:   - backend: `antigravity`   - model: `Gemini 3.1 Pro (High)`   - result: passed   - acceptance: 8 personas, 8 objections, 3 insights, 5 decision tests, `final_recommenda
  **Post-Mortem & Fix Analysis**:
  > Opened against upstream by mistake; closing. The branch targets pdurlej/mirofish-online.

- **Issue #46** (2026-06-04): **docs: add RS2000 cloud smoke profile**
  *Symptoms*: ## Summary  Prepare this fork for Piotr's RS2000 smoke path:  - add a private cloud-LLM + Neo4j smoke compose profile - add secret-free RS2000 env example - document Tailnet-only exposure, Neo4j limits, and local embedding sidecar - keep Postgres adapter and platform canonical module out of scope until product value is proven  ## Validation  - docker compose --env-file deploy/rs2000/.env.example -f deploy/rs2000/docker-compose.cloud-smoke.yml config --quiet  ## Non-goals  - no runtime start - no secrets - no platform repo changes - no public exposure - no Postgres graph adapter yet
  **Post-Mortem & Fix Analysis**:
  > Closed: opened against upstream by mistake. This RS2000-specific smoke profile belongs in the pdurlej/mirofish-online fork first.

- **Issue #44** (2026-05-16): **Feat/czech nlp extraction**
  *Symptoms*: Originally wanted to use NameTag3 for NER and then RobeCzech for RE. NER wasn't providing great results and RobeCzech didn't have a freely available head on HuggingFace for RE so I swapped to an entirely cloud approach that uses a generalized gemini 3.1 flash lite model to do these tasks. In the future when I implement LLM as a judge I will test out various models.

- **Issue #43** (2026-05-06): **refactor: rename project from MiroFish-Offline to SignalQuay, update …**
  *Symptoms*: accidental PR while forking repo, please delete

- **Issue #38** (2026-08-21): **fix: fall back to Ollama native /api/chat for thinking-mode models (fixes #26)**
  *Symptoms*: ## Problem  Thinking-mode models (e.g. `gemma4:26b`) generate internal `<|think|>` reasoning tokens that exhaust `max_tokens` before producing visible content. Ollama's OpenAI-compatible `/v1/chat/completions` endpoint strips those tokens and returns empty `content`, causing 500 errors when starting simulations.  ## Fix  In `LLMClient.chat()`, after calling the OpenAI-compat endpoint, check if `content` is empty. If it is and we're talking to an Ollama server, retry via the native `/api/chat` endpoint, which surfaces the visible response correctly.  Changes in `backend/app/utils/llm_client.py`: - Added `_ollama_native_base()` — strips `/v1` suffix to get the Ollama host URL - Added `_chat_via_ollama_native()` — POSTs to `/api/chat` with stream=false, carries over `temperature` and `num_ctx` - In `chat()`: triggers the fallback only when `content` is falsy **and** `_is_ollama()` is true — fully backwards-compatible, zero impact on non-Ollama or non-thinking-mode models - Fixed a latent `NoneType` crash: `re.sub(…, content or '')` guards against `None` content even without the fallback  ## Test plan  - [ ] Run a simulation with a standard model (e.g. `qwen2.5:32b`) — behaviour unchanged - [ ] Run a simulation with `gemma4:26b` — should now return visible response instead of 500 - [ ] Verify `_ollama_native_base()` strips `/v1` from `http://localhost:11434/v1` correctly - [ ] Non-Ollama endpoints (OpenAI, etc.) are unaffected — fallback never fires  Fixes #26

- **Issue #35** (2026-04-08): **Exception in handleNewProject: Request failed with status code 500**
  *Symptoms*: Been trying to run this but no success, tried to use the qwen32b and switched to the 14b model still not able to get past here  INFO: Calling LLM to generate ontology definition... [backend] 172.18.0.1 - - [07/Apr/2026 16:12:24] "POST /api/graph/ontology/generate HTTP/1.1" 500 - [backend] [16:12:26] INFO: === Starting ontology generation === [backend] [16:12:26] INFO: Project created: proj_fce167f17c91 [backend] [16:12:27] INFO: Text extraction completed, total 79423 characters [backend] [16:12:27] INFO: Calling LLM to generate ontology definition... [backend] 172.18.0.1 - - [07/Apr/2026 16:12:28] "POST /api/graph/ontology/generate HTTP/1.1" 500 -
  **Post-Mortem & Fix Analysis**:
  > I had similar error when running docker. I changed .env variable from default `LLM_BASE_URL=http://localhost:11434/v1` to `LLM_BASE_URL=http://ollama:11434/v1`
  > > I had similar error when running docker. I changed .env variable from default `LLM_BASE_URL=http://localhost:11434/v1` to `LLM_BASE_URL=http://ollama:11434/v1`  Thanks for the assist @japkettu really appreciate it. Its working now

- **Issue #25** (2026-08-15): **feat: Add Digital Twin simulation platform for manufacturing scenarios**
  *Symptoms*: ## Overview  Transforms MiroFish from social media simulation into a universal agent-based simulation platform for manufacturing disruption prediction and proactive scheduling optimization.  ## What's Included  ### Core Platform (Phase 1-4)  1. **Entity Mapper** ()    - Maps scheduling entities (machines, operators, jobs) to OASIS agent profiles    - Domain-specific personas with realistic behaviors    - Configurable activity levels and influence weights  2. **State Manager** ()    - Real-time factory state tracking    - Thread-safe concurrent updates    - Event subscription system    - Database polling integration  3. **Disruption Engine** ()    - Agent-based simulation of disruptions:      - Machine breakdowns (MTBF-based)      - Operator absenteeism (shift patterns)      - Rush order arrivals    - Scenario configuration (default, high-stress, optimistic)    - Confidence-scored predictions  4. **Prediction Bridge** ()    - Transforms simulation results to scheduler feedback    - Intelligent reschedule triggering    - Constraint updates for OR-Tools solver    - Multiple strategies (fast, optimal, adaptive)  ### Database Integration  - **PostgreSQL adapters** for ERP/MES/SCADA connectivity - **Table mapping** system for any schema - **Polling service** for live data ingestion - **Repository pattern** for persistence  ### REST API  Shop system integration endpoints: -  - Push live machine data -  - Push operator status -  - Push job progress -  - Run disruption simulation -  -

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

### Incident Patch 1: `313fe642` (2026-03-24)
**Commit Message**: fix: force English-only output in report agent — remove Chinese language fallback and examples

**File**: `backend/app/services/report_agent.py` (modified, +19/-16)
```diff
@@ -585,7 +585,8 @@ def to_dict(self) -> Dict[str, Any]:
     ]
 }
 
-Note: sections array must have at least 2 and at most 5 elements!"""
+Note: sections array must have at least 2 and at most 5 elements!
+IMPORTANT: The entire report outline (title, summary, section titles and descriptions) MUST be in English. Never use Chinese or other languages."""
 
 PLAN_USER_PROMPT_TEMPLATE = """\
 [Prediction Scenario Settings]
@@ -651,12 +652,13 @@ def to_dict(self) -> Dict[str, Any]:
      > "Certain groups will state: original content..."
    - These quotes are core evidence of simulation predictions
 
-3. [Language Consistency - Quoted Content Must Be Translated to Report Language]
-   - Tool returned content may contain English or mixed Chinese-English expressions
-   - If the simulation requirement and source material are in Chinese, the report must be entirely in Chinese
-   - When you quote English or mixed Chinese-English content from tools, you must translate it to fluent Chinese before including it in the report
-   - When translating, preserve the original meaning and ensure natural expression
-   - This rule applies to both regular text and quoted blocks (> format)
+3. [Language Consistency - ALWAYS Write in English]
+   - The entire report MUST be written in English, regardless of source material language
+   - Tool-returned content may contain Chinese, mixed Chinese-English, or other languages
+   - When quoting tool-returned non-English content, ALWAYS translate it to fluent English before writing to report
+   - Keep original meaning unchanged during translation, ensure natural expression
+   - This rule applies to both body text and quoted content (> format)
+   - NEVER switch to Chinese or any other language mid-report
 
 4. [Faithfully Present Prediction Results]
    - Report content must reflect simulation results that represent the future in the simulated world
@@ -676,20 +678,20 @@ def to_dict(self) -> Dict[str, Any]:
 
 [Correct Example]
 ```
-This section analyzes the public sentiment propagation of the event. Through in-depth analysis of simulation data, we found...
+This section analyzes how the regulatory shift reshaped corporate strategy. Through in-depth analysis of simulation data, we found...
 
-**Initial Explosion Phase**
+**Initial Industry Response**
 
-Weibo, as the first scene of public sentiment, undertook the core function of initial information dissemination:
+Major tech companies moved quickly to reassess their compliance posture:
 
-> "Weibo contributed 68% of initial voice..."
+> "OpenAI and Anthropic scrambled to meet the new transparency requirements..."
 
-**Emotion Amplification Phase**
+**Emerging Strategic Divergence**
 
-The TikTok platform further amplified the impact of the event:
+A clear split emerged between companies embracing regulation and those resisting it:
 
-- Strong visual impact
-- High emotional resonance
+- Proactive compliance as competitive advantage
+- Lobbying efforts to soften enforcement
 ```
 
 [Incorrect Example]
@@ -851,7 +853,8 @@ def to_dict(self) -> Dict[str, Any]:
 [Answer Style]
 - Concise and direct, don't write lengthy passages
 - Use > format to quote key content
-- Give conclusions first, then explain reasons"""
+- Give conclusions first, then explain reasons
+- ALWAYS respond in English, regardless of the language used in source material or report content"""
 
 CHAT_OBSERVATION_SUFFIX = "\n\nPlease answer the question concisely."
 
```

---

### Incident Patch 2: `f47fa5c9` (2026-03-18)
**Commit Message**: Merge PR #10: fix Neo4j version to 5.18 for relationship vector search

**File**: `docker-compose.yml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ services:
         condition: service_started
 
   neo4j:
-    image: neo4j:5.15-community
+    image: neo4j:5.18-community
     container_name: mirofish-neo4j
     ports:
       - "7474:7474"   # Neo4j Browser
```

---

### Incident Patch 3: `b372c408` (2026-03-18)
**Commit Message**: Fix Neo4j version to support relationship vector search (>=5.18)

**File**: `docker-compose.yml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ services:
         condition: service_started
 
   neo4j:
-    image: neo4j:5.15-community
+    image: neo4j:5.18-community
     container_name: mirofish-neo4j
     ports:
       - "7474:7474"   # Neo4j Browser
```

---

### Incident Patch 4: `60a574fe` (2026-03-18)
**Commit Message**: Merge PR #5: fix GraphToolsService injection into ReportAgent before background thread

**File**: `backend/app/api/report.py` (modified, +119/-717)
```diff
@@ -6,14 +6,15 @@
 import os
 import traceback
 import threading
-from flask import request, jsonify, send_file
+from flask import request, jsonify, send_file, current_app
 
 from . import report_bp
 from ..config import Config
 from ..services.report_agent import ReportAgent, ReportManager, ReportStatus
 from ..services.simulation_manager import SimulationManager
 from ..models.project import ProjectManager
 from ..models.task import TaskManager, TaskStatus
+from ..services.graph_tools import GraphToolsService
 from ..utils.logger import get_logger
 
 logger = get_logger('mirofish.api.report')
@@ -23,998 +24,399 @@
 
 @report_bp.route('/generate', methods=['POST'])
 def generate_report():
-    """
-    Generate simulation analysis report (async task)
-
-    This is a time-consuming operation. The interface returns task_id immediately.
-    Use GET /api/report/generate/status to query progress.
-
-    Request (JSON):
-        {
-            "simulation_id": "sim_xxxx",    // Required: simulation ID
-            "force_regenerate": false        // Optional: force regeneration
-        }
-
-    Response:
-        {
-            "success": true,
-            "data": {
-                "simulation_id": "sim_xxxx",
-                "task_id": "task_xxxx",
-                "status": "generating",
-                "message": "Report generation task started"
-            }
-        }
-    """
     try:
         data = request.get_json() or {}
-        
         simulation_id = data.get('simulation_id')
         if not simulation_id:
-            return jsonify({
-                "success": False,
-                "error": "Please provide simulation_id"
-            }), 400
+            return jsonify({"success": False, "error": "Please provide simulation_id"}), 400
 
         force_regenerate = data.get('force_regenerate', False)
-
-        # Get simulation info
         manager = SimulationManager()
         state = manager.get_simulation(simulation_id)
-
         if not state:
-            return jsonify({
-                "success": False,
-                "error": f"Simulation does not exist: {simulation_id}"
-            }), 404
+            return jsonify({"success": False, "error": f"Simulation does not exist: {simulation_id}"}), 404
 
-        # Check if report already exists
         if not force_regenerate:
             existing_report = ReportManager.get_report_by_simulation(simulation_id)
             if existing_report and existing_report.status == ReportStatus.COMPLETED:
-                return jsonify({
-                    "success": True,
-                    "data": {
-                        "simulation_id": simulation_id,
-                        "report_id": existing_report.report_id,
-                        "status": "completed",
-                        "message": "Report already exists",
-                        "already_generated": True
-                    }
-                })
-
-        # Get project info
+                return jsonify({"success": True, "data": {
+                    "simulation_id": simulation_id,
+                    "report_id": existing_report.report_id,
+                    "status": "completed",
+                    "message": "Report already exists",
+                    "already_generated": True
+                }})
+
         project = ProjectManager.get_project(state.project_id)
         if not project:
-            return jsonify({
-                "success": False,
-                "error": f"Project does not exist: {state.project_id}"
-            }), 404
+            return jsonify({"success": False, "error": f"Project does not exist: {state.project_id}"}), 404
 
         graph_id = state.graph_id or project.graph_id
         if not graph_id:
-            return jsonify({
-                "success": False,
-                "error": "Missing graph ID, please ensure graph is built"
-            }), 400
+            return jsonify({"success": False, "error": "Missing graph ID, 
```

---

### Incident Patch 5: `65d0ea29` (2026-03-18)
**Commit Message**: Merge branch 'main' into fix/report-agent-graph-tools-injection

**File**: `backend/app/__init__.py` (modified, +34/-34)
```diff
@@ -1,12 +1,12 @@
 """
-MiroFish Backend - Flask应用工厂
+MiroFish Backend - Flask Application Factory
 """
 
 import os
 import warnings
 
-# 抑制 multiprocessing resource_tracker 的警告（来自第三方库如 transformers）
-# 需要在所有其他导入之前设置
+# Suppress multiprocessing resource_tracker warnings (from third-party libraries like transformers)
+# Must be set before all other imports
 warnings.filterwarnings("ignore", message=".*resource_tracker.*")
 
 from flask import Flask, request
@@ -17,76 +17,76 @@
 
 
 def create_app(config_class=Config):
-    """Flask应用工厂函数"""
+    """Flask application factory function"""
     app = Flask(__name__)
     app.config.from_object(config_class)
-    
-    # 设置JSON编码：确保中文直接显示（而不是 \uXXXX 格式）
-    # Flask >= 2.3 使用 app.json.ensure_ascii，旧版本使用 JSON_AS_ASCII 配置
+
+    # Configure JSON encoding: ensure Chinese displays directly (not as \uXXXX)
+    # Flask >= 2.3 uses app.json.ensure_ascii, older versions use JSON_AS_ASCII config
     if hasattr(app, 'json') and hasattr(app.json, 'ensure_ascii'):
         app.json.ensure_ascii = False
-    
-    # 设置日志
+
+    # Setup logging
     logger = setup_logger('mirofish')
-    
-    # 只在 reloader 子进程中打印启动信息（避免 debug 模式下打印两次）
+
+    # Only print startup info in reloader subprocess (avoid printing twice in debug mode)
     is_reloader_process = os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
     debug_mode = app.config.get('DEBUG', False)
     should_log_startup = not debug_mode or is_reloader_process
-    
+
     if should_log_startup:
         logger.info("=" * 50)
-        logger.info("MiroFish-Offline Backend 启动中...")
+        logger.info("MiroFish-Offline Backend starting...")
         logger.info("=" * 50)
-    
-    # 启用CORS
+
+    # Enable CORS
     CORS(app, resources={r"/api/*": {"origins": "*"}})
 
-    # --- 初始化 Neo4jStorage 单例（DI via app.extensions） ---
+    # --- Initialize Neo4jStorage singleton (DI via app.extensions) ---
     from .storage import Neo4jStorage
     try:
         neo4j_storage = Neo4jStorage()
         app.extensions['neo4j_storage'] = neo4j_storage
         if should_log_startup:
-            logger.info("Neo4jStorage 已初始化（连接 %s）", Config.NEO4J_URI)
+            logger.info("Neo4jStorage initialized (connected to %s)", Config.NEO4J_URI)
     except Exception as e:
-        logger.error("Neo4jStorage 初始化失败: %s", e)
+        logger.error("Neo4jStorage initialization failed: %s", e)
         # Store None so endpoints can return 503 gracefully
         app.extensions['neo4j_storage'] = None
-    
-    # 注册模拟进程清理函数（确保服务器关闭时终止所有模拟进程）
+
+    # Register simulation process cleanup function (ensure all simulation processes terminate on server shutdown)
     from .services.simulation_runner import SimulationRunner
     SimulationRunner.register_cleanup()
     if should_log_startup:
-        logger.info("已注册模拟进程清理函数")
-    
-    # 请求日志中间件
+        logger.info("Simulation process cleanup function registered")
+
+    # Request logging middleware
     @app.before_request
     def log_request():
         logger = get_logger('mirofish.request')
-        logger.debug(f"请求: {request.method} {request.path}")
+        logger.debug(f"Request: {request.method} {request.path}")
         if request.content_type and 'json' in request.content_type:
-            logger.debug(f"请求体: {request.get_json(silent=True)}")
-    
+            logger.debug(f"Request body: {request.get_json(silent=True)}")
+
     @app.after_request
     def log_response(response):
         logger = get_logger('mirofish.request')
-        logger.debug(f"响应: {response.status_code}")
+        logger.debug(f"Response: {response.status_code}")
         return response
-    
-    # 注册蓝图
+
+    # Register blueprints
     from .api import graph_bp, simulation_bp, report_bp
     app.register_blueprint(graph_bp, url_prefix='/api/graph')
     app.register_blueprint(simulation_bp, url_prefix='/api/simulation')
     app.register_blueprint(report_bp, url_prefix='/api/report')
-    
-    # 健康检查
+
+    # Health check
     @
```

**File**: `backend/app/api/__init__.py` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 """
-API路由模块
+API Routes Module
 """
 
 from flask import Blueprint
```

**File**: `backend/app/api/graph.py` (modified, +172/-172)
```diff
@@ -1,6 +1,6 @@
 """
-图谱相关API路由
-采用项目上下文机制，服务端持久化状态
+Graph-related API Routes
+Uses project context mechanism with server-side state persistence
 """
 
 import os
@@ -18,7 +18,7 @@
 from ..models.task import TaskManager, TaskStatus
 from ..models.project import ProjectManager, ProjectStatus
 
-# 获取日志器
+# Get logger
 logger = get_logger('mirofish.api')
 
 
@@ -31,26 +31,26 @@ def _get_storage():
 
 
 def allowed_file(filename: str) -> bool:
-    """检查文件扩展名是否允许"""
+    """Check if file extension is allowed"""
     if not filename or '.' not in filename:
         return False
     ext = os.path.splitext(filename)[1].lower().lstrip('.')
     return ext in Config.ALLOWED_EXTENSIONS
 
 
-# ============== 项目管理接口 ==============
+# ============== Project Management Interface ==============
 
 @graph_bp.route('/project/<project_id>', methods=['GET'])
 def get_project(project_id: str):
     """
-    获取项目详情
+    Get project details
     """
     project = ProjectManager.get_project(project_id)
     
     if not project:
         return jsonify({
             "success": False,
-            "error": f"项目不存在: {project_id}"
+            "error": f"Project does not exist: {project_id}"
         }), 404
     
     return jsonify({
@@ -62,7 +62,7 @@ def get_project(project_id: str):
 @graph_bp.route('/project/list', methods=['GET'])
 def list_projects():
     """
-    列出所有项目
+    List all projects
     """
     limit = request.args.get('limit', 50, type=int)
     projects = ProjectManager.list_projects(limit=limit)
@@ -77,69 +77,69 @@ def list_projects():
 @graph_bp.route('/project/<project_id>', methods=['DELETE'])
 def delete_project(project_id: str):
     """
-    删除项目
+    Delete project
     """
     success = ProjectManager.delete_project(project_id)
-    
+
     if not success:
         return jsonify({
             "success": False,
-            "error": f"项目不存在或删除失败: {project_id}"
+            "error": f"Project does not exist or deletion failed: {project_id}"
         }), 404
-    
+
     return jsonify({
         "success": True,
-        "message": f"项目已删除: {project_id}"
+        "message": f"Project deleted: {project_id}"
     })
 
 
 @graph_bp.route('/project/<project_id>/reset', methods=['POST'])
 def reset_project(project_id: str):
     """
-    重置项目状态（用于重新构建图谱）
+    Reset project status (for rebuilding graph)
     """
     project = ProjectManager.get_project(project_id)
-    
+
     if not project:
         return jsonify({
             "success": False,
-            "error": f"项目不存在: {project_id}"
+            "error": f"Project does not exist: {project_id}"
         }), 404
-    
-    # 重置到本体已生成状态
+
+    # Reset to ontology generated state
     if project.ontology:
         project.status = ProjectStatus.ONTOLOGY_GENERATED
     else:
         project.status = ProjectStatus.CREATED
-    
+
     project.graph_id = None
     project.graph_build_task_id = None
     project.error = None
     ProjectManager.save_project(project)
-    
+
     return jsonify({
         "success": True,
-        "message": f"项目已重置: {project_id}",
+        "message": f"Project reset: {project_id}",
         "data": project.to_dict()
     })
 
 
-# ============== 接口1：上传文件并生成本体 ==============
+# ============== Interface 1: Upload Files and Generate Ontology ==============
 
 @graph_bp.route('/ontology/generate', methods=['POST'])
 def generate_ontology():
     """
-    接口1：上传文件，分析生成本体定义
-    
-    请求方式：multipart/form-data
-    
-    参数：
-        files: 上传的文件（PDF/MD/TXT），可多个
-        simulation_requirement: 模拟需求描述（必填）
-        project_name: 项目名称（可选）
-        additional_context: 额外说明（可选）
-        
-    返回：
+    Interface 1: Upload files and analyze to generate ontology definition
+
+    Request method: multipart/form-data
+
+    Parameters:
+        files: Uploaded files (PDF/MD/TXT), multiple allowed
+        simulation_requirement: Simulation requirement description (required)
+        project_name: Project name (optional)
+        additional_context: Ad
```

**File**: `backend/app/api/report.py` (modified, +189/-469)
```diff
@@ -1,6 +1,6 @@
 """
-Report API路由
-提供模拟报告生成、获取、对话等接口
+Report API Routes
+Provides interfaces for simulation report generation, retrieval, and conversation
 """
 
 import os
@@ -20,621 +20,369 @@
 logger = get_logger('mirofish.api.report')
 
 
-# ============== 报告生成接口 ==============
+# ============== Report Generation Interface ==============
 
 @report_bp.route('/generate', methods=['POST'])
 def generate_report():
-    """
-    生成模拟分析报告（异步任务）
-    
-    这是一个耗时操作，接口会立即返回task_id，
-    使用 GET /api/report/generate/status 查询进度
-    
-    请求（JSON）：
-        {
-            "simulation_id": "sim_xxxx",    // 必填，模拟ID
-            "force_regenerate": false        // 可选，强制重新生成
-        }
-    
-    返回：
-        {
-            "success": true,
-            "data": {
-                "simulation_id": "sim_xxxx",
-                "task_id": "task_xxxx",
-                "status": "generating",
-                "message": "报告生成任务已启动"
-            }
-        }
-    """
     try:
         data = request.get_json() or {}
-        
         simulation_id = data.get('simulation_id')
         if not simulation_id:
-            return jsonify({
-                "success": False,
-                "error": "请提供 simulation_id"
-            }), 400
-        
+            return jsonify({"success": False, "error": "Please provide simulation_id"}), 400
+
         force_regenerate = data.get('force_regenerate', False)
-        
-        # 获取模拟信息
         manager = SimulationManager()
         state = manager.get_simulation(simulation_id)
-        
         if not state:
-            return jsonify({
-                "success": False,
-                "error": f"模拟不存在: {simulation_id}"
-            }), 404
-        
-        # 检查是否已有报告
+            return jsonify({"success": False, "error": f"Simulation does not exist: {simulation_id}"}), 404
+
         if not force_regenerate:
             existing_report = ReportManager.get_report_by_simulation(simulation_id)
             if existing_report and existing_report.status == ReportStatus.COMPLETED:
-                return jsonify({
-                    "success": True,
-                    "data": {
-                        "simulation_id": simulation_id,
-                        "report_id": existing_report.report_id,
-                        "status": "completed",
-                        "message": "报告已存在",
-                        "already_generated": True
-                    }
-                })
-        
-        # 获取项目信息
+                return jsonify({"success": True, "data": {
+                    "simulation_id": simulation_id,
+                    "report_id": existing_report.report_id,
+                    "status": "completed",
+                    "message": "Report already exists",
+                    "already_generated": True
+                }})
+
         project = ProjectManager.get_project(state.project_id)
         if not project:
-            return jsonify({
-                "success": False,
-                "error": f"项目不存在: {state.project_id}"
-            }), 404
-        
+            return jsonify({"success": False, "error": f"Project does not exist: {state.project_id}"}), 404
+
         graph_id = state.graph_id or project.graph_id
         if not graph_id:
-            return jsonify({
-                "success": False,
-                "error": "缺少图谱ID，请确保已构建图谱"
-            }), 400
-        
+            return jsonify({"success": False, "error": "Missing graph ID, please ensure graph is built"}), 400
+
         simulation_requirement = project.simulation_requirement
         if not simulation_requirement:
-            return jsonify({
-                "success": False,
-                "error": "缺少模拟需求描述"
-            }), 400
-        
-        # 提前生成 report_id，以便立即返回给前端
+            return jsonify({"success": False, "error": "Missing simulation requirement description"}), 400
+
         import uuid
         report_id = f"report_{uuid.uuid4().hex[:12]}"
-        
-    
```

**File**: `backend/app/config.py` (modified, +22/-22)
```diff
@@ -1,60 +1,60 @@
 """
-配置管理
-统一从项目根目录的 .env 文件加载配置
+Configuration Management
+Loads configuration from .env file in project root directory
 """
 
 import os
 from dotenv import load_dotenv
 
-# 加载项目根目录的 .env 文件
-# 路径: MiroFish/.env (相对于 backend/app/config.py)
+# Load .env file from project root
+# Path: MiroFish/.env (relative to backend/app/config.py)
 project_root_env = os.path.join(os.path.dirname(__file__), '../../.env')
 
 if os.path.exists(project_root_env):
     load_dotenv(project_root_env, override=True)
 else:
-    # 如果根目录没有 .env，尝试加载环境变量（用于生产环境）
+    # If no .env in root, try to load environment variables (for production)
     load_dotenv(override=True)
 
 
 class Config:
-    """Flask配置类"""
+    """Flask configuration class"""
 
-    # Flask配置
+    # Flask configuration
     SECRET_KEY = os.environ.get('SECRET_KEY', 'mirofish-secret-key')
     DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
 
-    # JSON配置 - 禁用ASCII转义，让中文直接显示（而不是 \uXXXX 格式）
+    # JSON configuration - disable ASCII escaping to display Chinese directly (not as \uXXXX)
     JSON_AS_ASCII = False
 
-    # LLM配置（统一使用OpenAI格式）
+    # LLM configuration (unified OpenAI format)
     LLM_API_KEY = os.environ.get('LLM_API_KEY')
     LLM_BASE_URL = os.environ.get('LLM_BASE_URL', 'http://localhost:11434/v1')
     LLM_MODEL_NAME = os.environ.get('LLM_MODEL_NAME', 'qwen2.5:32b')
 
-    # Neo4j配置
+    # Neo4j configuration
     NEO4J_URI = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
     NEO4J_USER = os.environ.get('NEO4J_USER', 'neo4j')
     NEO4J_PASSWORD = os.environ.get('NEO4J_PASSWORD', 'mirofish')
 
-    # Embedding配置
+    # Embedding configuration
     EMBEDDING_MODEL = os.environ.get('EMBEDDING_MODEL', 'nomic-embed-text')
     EMBEDDING_BASE_URL = os.environ.get('EMBEDDING_BASE_URL', 'http://localhost:11434')
 
-    # 文件上传配置
+    # File upload configuration
     MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
     UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../uploads')
     ALLOWED_EXTENSIONS = {'pdf', 'md', 'txt', 'markdown'}
 
-    # 文本处理配置
-    DEFAULT_CHUNK_SIZE = 500  # 默认切块大小
-    DEFAULT_CHUNK_OVERLAP = 50  # 默认重叠大小
+    # Text processing configuration
+    DEFAULT_CHUNK_SIZE = 500  # Default chunk size
+    DEFAULT_CHUNK_OVERLAP = 50  # Default overlap size
 
-    # OASIS模拟配置
+    # OASIS simulation configuration
     OASIS_DEFAULT_MAX_ROUNDS = int(os.environ.get('OASIS_DEFAULT_MAX_ROUNDS', '10'))
     OASIS_SIMULATION_DATA_DIR = os.path.join(os.path.dirname(__file__), '../uploads/simulations')
 
-    # OASIS平台可用动作配置
+    # OASIS platform available actions configuration
     OASIS_TWITTER_ACTIONS = [
         'CREATE_POST', 'LIKE_POST', 'REPOST', 'FOLLOW', 'DO_NOTHING', 'QUOTE_POST'
     ]
@@ -64,19 +64,19 @@ class Config:
         'TREND', 'REFRESH', 'DO_NOTHING', 'FOLLOW', 'MUTE'
     ]
 
-    # Report Agent配置
+    # Report Agent configuration
     REPORT_AGENT_MAX_TOOL_CALLS = int(os.environ.get('REPORT_AGENT_MAX_TOOL_CALLS', '5'))
     REPORT_AGENT_MAX_REFLECTION_ROUNDS = int(os.environ.get('REPORT_AGENT_MAX_REFLECTION_ROUNDS', '2'))
     REPORT_AGENT_TEMPERATURE = float(os.environ.get('REPORT_AGENT_TEMPERATURE', '0.5'))
 
     @classmethod
     def validate(cls):
-        """验证必要配置"""
+        """Validate required configuration"""
         errors = []
         if not cls.LLM_API_KEY:
-            errors.append("LLM_API_KEY 未配置 (设置为任意非空值, 例如 'ollama')")
+            errors.append("LLM_API_KEY not configured (set to any non-empty value, e.g. 'ollama')")
         if not cls.NEO4J_URI:
-            errors.append("NEO4J_URI 未配置")
+            errors.append("NEO4J_URI not configured")
         if not cls.NEO4J_PASSWORD:
-            errors.append("NEO4J_PASSWORD 未配置")
+            errors.append("NEO4J_PASSWORD not configured")
         return errors
```

---

### Incident Patch 6: `f2e8e201` (2026-03-18)
**Commit Message**: fix: inject GraphToolsService into ReportAgent before background thread

ReportAgent requires graph_tools but it was not being passed at instantiation.
Additionally, current_app context is not available inside background threads,
so GraphToolsService must be initialized in the Flask request context before
spawning the thread.

Fixes:
- Add GraphToolsService and current_app to top-level imports
- Initialize graph_tools in Flask context before def run_generate()
- Pass graph_tools to ReportAgent constructor
- Remove duplicate inline imports inside thread and route handlers

**File**: `backend/app/api/report.py` (modified, +104/-423)
```diff
@@ -6,14 +6,15 @@
 import os
 import traceback
 import threading
-from flask import request, jsonify, send_file
+from flask import request, jsonify, send_file, current_app
 
 from . import report_bp
 from ..config import Config
 from ..services.report_agent import ReportAgent, ReportManager, ReportStatus
 from ..services.simulation_manager import SimulationManager
 from ..models.project import ProjectManager
 from ..models.task import TaskManager, TaskStatus
+from ..services.graph_tools import GraphToolsService
 from ..utils.logger import get_logger
 
 logger = get_logger('mirofish.api.report')
@@ -119,6 +120,15 @@ def generate_report():
                 "report_id": report_id
             }
         )
+
+        # Inizializza graph_tools nel contesto Flask PRIMA del thread
+        storage = current_app.extensions.get('neo4j_storage')
+        if not storage:
+            return jsonify({
+                "success": False,
+                "error": "GraphStorage not initialized — check Neo4j connection"
+            }), 500
+        graph_tools = GraphToolsService(storage=storage)
         
         # 定义后台任务
         def run_generate():
@@ -134,7 +144,8 @@ def run_generate():
                 agent = ReportAgent(
                     graph_id=graph_id,
                     simulation_id=simulation_id,
-                    simulation_requirement=simulation_requirement
+                    simulation_requirement=simulation_requirement,
+                    graph_tools=graph_tools
                 )
                 
                 # 进度回调
@@ -271,37 +282,17 @@ def get_generate_status():
 
 @report_bp.route('/<report_id>', methods=['GET'])
 def get_report(report_id: str):
-    """
-    获取报告详情
-    
-    返回：
-        {
-            "success": true,
-            "data": {
-                "report_id": "report_xxxx",
-                "simulation_id": "sim_xxxx",
-                "status": "completed",
-                "outline": {...},
-                "markdown_content": "...",
-                "created_at": "...",
-                "completed_at": "..."
-            }
-        }
-    """
     try:
         report = ReportManager.get_report(report_id)
-        
         if not report:
             return jsonify({
                 "success": False,
                 "error": f"报告不存在: {report_id}"
             }), 404
-        
         return jsonify({
             "success": True,
             "data": report.to_dict()
         })
-        
     except Exception as e:
         logger.error(f"获取报告失败: {str(e)}")
         return jsonify({
@@ -313,34 +304,17 @@ def get_report(report_id: str):
 
 @report_bp.route('/by-simulation/<simulation_id>', methods=['GET'])
 def get_report_by_simulation(simulation_id: str):
-    """
-    根据模拟ID获取报告
-    
-    返回：
-        {
-            "success": true,
-            "data": {
-                "report_id": "report_xxxx",
-                ...
-            }
-        }
-    """
     try:
         report = ReportManager.get_report_by_simulation(simulation_id)
-        
         if not report:
             return jsonify({
                 "success": False,
-                "error": f"该模拟暂无报告: {simulation_id}",
-                "has_report": False
+                "error": f"未找到模拟 {simulation_id} 的报告"
             }), 404
-        
         return jsonify({
             "success": True,
-            "data": report.to_dict(),
-            "has_report": True
+            "data": report.to_dict()
         })
-        
     except Exception as e:
         logger.error(f"获取报告失败: {str(e)}")
         return jsonify({
@@ -352,37 +326,15 @@ def get_report_by_simulation(simulation_id: str):
 
 @report_bp.route('/list', methods=['GET'])
 def list_reports():
-    """
-    列出所有报告
-    
-    Query参数：
-        simulation_id: 按模拟ID过滤（可选）
-        limit: 返回数量限制（默认50）
-    
-    返回：
-        {
-            "success": true,
-            "data": [...],
-            "count": 10
-        }
-    """
     try:
-        simula
```

---

### Incident Patch 7: `0eb8083f` (2026-03-17)
**Commit Message**: i18n: fix garbled word-soup docstrings from machine translation

Fixed concatenated-word gibberish in entity_reader.py, graph_builder.py,
graph_memory_updater.py, simulation_ipc.py, and simulation.py. Rewrote
all affected docstrings and comments as clean, natural English.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

**File**: `backend/app/api/simulation.py` (modified, +110/-110)
```diff
@@ -292,12 +292,12 @@ def _check_simulation_prepared(simulation_id: str) -> tuple:
         
         # If config_generated=True and files exist, consider preparation complete
         # The following statuses indicate preparation is complete：
-        # - ready: Preparation complete，Can run
-        # - preparing: If config_generated=True DescriptionCompleted
-        # - running: Running，DescriptionPrepare[x][x][x][x][x]
-        # - completed: Execution complete，DescriptionPrepare[x][x][x][x][x]
-        # - stopped: Stopped，DescriptionPrepare[x][x][x][x][x]
-        # - failed: Execution failed（ButPrepareIs[x][x][x]）
+        # - ready: Preparation complete, can run
+        # - preparing: If config_generated=True, description shows completed
+        # - running: Running, preparation already completed
+        # - completed: Execution complete, preparation already completed
+        # - stopped: Stopped, preparation already completed
+        # - failed: Execution failed (but preparation is not completed)
         prepared_statuses = ["ready", "preparing", "running", "completed", "stopped", "failed"]
         if status in prepared_statuses and config_generated:
             # Get file statistics
@@ -310,7 +310,7 @@ def _check_simulation_prepared(simulation_id: str) -> tuple:
                     profiles_data = json.load(f)
                     profiles_count = len(profiles_data) if isinstance(profiles_data, list) else 0
             
-            # IfStatusIspreparingButFileCompleted，[x][x][update][new]Status[x]ready
+            # If status is "preparing" but files are completed, update status to "ready"
             if status == "preparing":
                 try:
                     state_data["status"] = "ready"
@@ -337,7 +337,7 @@ def _check_simulation_prepared(simulation_id: str) -> tuple:
         else:
             logger.warning(f"Simulation {simulation_id} Detection result: Has notPreparation complete (status={status}, config_generated={config_generated})")
             return False, {
-                "reason": f"Status not in prepared listOrconfig_generated[x]false: status={status}, config_generated={config_generated}",
+                "reason": f"Status not in prepared list or config_generated is false: status={status}, config_generated={config_generated}",
                 "status": status,
                 "config_generated": config_generated
             }
@@ -349,29 +349,29 @@ def _check_simulation_prepared(simulation_id: str) -> tuple:
 @simulation_bp.route('/prepare', methods=['POST'])
 def prepare_simulation():
     """
-    Prepare simulation environment（Async task，LLMIntelligentGenerate[x]HasParameters）
-    
-    This is a time-consuming operation，The interface returns immediatelytask_id，
-    Use GET /api/simulation/prepare/status Query progress
-    
-    Features：
-    - Automatically detect completed preparations，Avoid duplicatesGenerate
-    - If already prepared，Return existing results directly
-    - Support forced regeneration（force_regenerate=true）
-    
-    Steps：
+    Prepare simulation environment (async task with LLM intelligent configuration generation).
+
+    This is a time-consuming operation. The interface returns immediately with a task_id.
+    Use GET /api/simulation/prepare/status to query progress.
+
+    Features:
+    - Automatically detect completed preparations to avoid duplicate generation
+    - If already prepared, return existing results directly
+    - Support forced regeneration (force_regenerate=true)
+
+    Steps:
     1. Check if preparation is already complete
     2. Read and filter entities from knowledge graph
-    3. Generate OASIS Agent Profile for each entity（With retry mechanism）
-    4. LLMIntelligently generate simulation configuration（With retry mechanism）
+    3. Generate OASIS Agent Profile for each entity (with retry mechanism)
+    4. LLM intelligently generates simulation configuration (with retry mechanism)
     5. Save configuration files and 
```

**File**: `backend/app/services/entity_reader.py` (modified, +35/-35)
```diff
@@ -1,6 +1,6 @@
 """
-EntityReadandFilterserveservice
-from Neo4j GraphinReadNode，FilteroutputcharactermergepresetmeaningEntityTypesNode
+Entity reading and filtering service.
+Reads nodes from Neo4j graph, filters out meaningful entity type nodes.
 
 Replaces zep_entity_reader.py — all Zep Cloud calls replaced by GraphStorage.
 """
@@ -67,24 +67,24 @@ class EntityReader:
     """
     Entity reading and filtering service (via GraphStorage / Neo4j)
 
-    mainneedsuccesscan：
-    1. fromGraphReadallhaveNode
-    2. FilteroutputcharactermergepresetmeaningEntityTypesNode（LabelsnotonlyisEntitysNode）
-    3. GeteachEntitysrelatedrelatedEdgeandrelatedlinkNodeInformation
+    Main capabilities:
+    1. Read all nodes from the graph
+    2. Filter out meaningful entity type nodes (nodes whose labels are not just "Entity")
+    3. Get related edges and linked node information for each entity
     """
 
     def __init__(self, storage: GraphStorage):
         self.storage = storage
 
     def get_all_nodes(self, graph_id: str) -> List[Dict[str, Any]]:
         """
-        GetGraphsallhaveNode
+        Get all nodes from the graph.
 
         Args:
-            graph_id: GraphID
+            graph_id: Graph ID
 
         Returns:
-            Nodelisttable
+            List of nodes.
         """
         logger.info(f"Getting all nodes in graph {graph_id}...")
         nodes = self.storage.get_all_nodes(graph_id)
@@ -93,13 +93,13 @@ def get_all_nodes(self, graph_id: str) -> List[Dict[str, Any]]:
 
     def get_all_edges(self, graph_id: str) -> List[Dict[str, Any]]:
         """
-        GetGraphsallhaveEdge
+        Get all edges from the graph.
 
         Args:
-            graph_id: GraphID
+            graph_id: Graph ID
 
         Returns:
-            Edgelisttable
+            List of edges.
         """
         logger.info(f"Getting all edges in graph {graph_id}...")
         edges = self.storage.get_all_edges(graph_id)
@@ -108,13 +108,13 @@ def get_all_edges(self, graph_id: str) -> List[Dict[str, Any]]:
 
     def get_node_edges(self, node_uuid: str) -> List[Dict[str, Any]]:
         """
-        GetspecifysetNodesallhaverelatedrelatedEdge
+        Get all related edges for a specified node.
 
         Args:
-            node_uuid: NodeUUID
+            node_uuid: Node UUID
 
         Returns:
-            Edgelisttable
+            List of edges.
         """
         try:
             return self.storage.get_node_edges(node_uuid)
@@ -129,19 +129,19 @@ def filter_defined_entities(
         enrich_with_edges: bool = True
     ) -> FilteredEntities:
         """
-        FilteroutputcharactermergepresetmeaningEntityTypesNode
+        Filter and extract nodes with meaningful entity types.
 
-        Filterlogiclogic：
-        - suchresultNodesLabelsonlyhavea"Entity"，speakbrightthisEntitynotcharactermergewespresetmeaningsType，skipthrough
-        - suchresultNodesLabelsincludecontainexcept"Entity"and"Node"ofexceptsmarktag，speakbrightcharactermergepresetmeaningType，keepkeep
+        Filtering logic:
+        - If a node's labels only include "Entity", it has no meaningful type and is skipped.
+        - If a node's labels include labels other than "Entity" and "Node", it has a meaningful type and is kept.
 
         Args:
-            graph_id: GraphID
-            defined_entity_types: presetmeaningsEntityTypelisttable（canselect，suchresultprovideprovidethenonlykeepkeepthissomeType）
-            enrich_with_edges: isnoGeteachEntitysrelatedrelatedEdgeInformation
+            graph_id: Graph ID
+            defined_entity_types: Optional list of entity types to filter for. If provided, only entities matching one of these types are kept.
+            enrich_with_edges: Whether to fetch each entity's related edge information.
 
         Returns:
-            FilteredEntities: FilteraftersEntitycollectmerge
+            FilteredEntities: Filtered entity collection.
         """
         logger.info(f"Starting to filter entities in gra
```

**File**: `backend/app/services/graph_builder.py` (modified, +9/-9)
```diff
@@ -1,6 +1,6 @@
 """
-Graphconstructbuildserveservice
-makeuse GraphStorage (Neo4j) replacereplace Zep Cloud API
+Graph building service.
+Uses GraphStorage (Neo4j) to replace Zep Cloud API.
 """
 
 import time
@@ -57,15 +57,15 @@ def build_graph_async(
         Build graph asynchronously
 
         Args:
-            text: outputinputText
-            ontology: Ontologysetmeaning（comeselfconnectmouth1soutputoutput）
-            graph_name: Graphnamecall
-            chunk_size: TextChunklargesmall
-            chunk_overlap: Chunkheavyoverlaplargesmall
-            batch_size: eachbatchSendsChunknumberquantity
+            text: Input text to process
+            ontology: Ontology definition (from ontology generator output)
+            graph_name: Name for the graph
+            chunk_size: Text chunk size
+            chunk_overlap: Chunk overlap size
+            batch_size: Number of chunks to send per batch
 
         Returns:
-            anyserviceID
+            Task ID
         """
         # Create task
         task_id = self.task_manager.create_task(
```

**File**: `backend/app/services/graph_memory_updater.py` (modified, +10/-11)
```diff
@@ -1,6 +1,5 @@
 """
-GraphrecordmemoryUpdateserveservice
-willSimulationinsAgentActivityactionstateUpdateto Neo4j Graphin
+Graph memory update service that processes agent activities and updates them to Neo4j Graph.
 
 Replaces zep_graph_memory_updater.py — Zep client replaced by GraphStorage.
 """
@@ -176,10 +175,10 @@ def _describe_generic(self) -> str:
 
 class GraphMemoryUpdater:
     """
-    GraphrecordmemoryUpdatedevice (via GraphStorage / Neo4j)
+    Graph memory update service (via GraphStorage / Neo4j)
 
-    monitorcontrolSimulationsactionsLogFile，willnewsagentActivityrealwhenUpdatetoGraphin。
-    byPlatformpartgroup，eachaccumulateaccumulateBATCH_SIZEActivityafterBatchSendtoGraph。
+    Monitors simulation action logs and sends agent activities to the graph in real-time.
+    Batches activities by platform, accumulating BATCH_SIZE activities before sending each batch.
     """
 
     BATCH_SIZE = 5
@@ -311,7 +310,7 @@ def _worker_loop(self):
 
     def _send_batch_activities(self, activities: List[AgentActivity], platform: str):
         """
-        BatchSendActivitytoGraph（mergeandasaText，passthrough add_text triggersend NER）
+        Send batched activities to the graph by merging them as text and using add_text to trigger NER.
         """
         if not activities:
             return
@@ -381,9 +380,9 @@ def get_stats(self) -> Dict[str, Any]:
 
 class GraphMemoryManager:
     """
-    managemanagemanySimulationsGraphrecordmemoryUpdatedevice
+    Manages graph memory updaters for multiple simulations.
 
-    eachSimulationcanwithhaveselfselfsUpdatedevicerealexample。
+    Each simulation can have its own independent updater instance.
     NOTE: create_updater() requires a GraphStorage instance — must be passed in.
     """
 
@@ -395,11 +394,11 @@ def create_updater(
         cls, simulation_id: str, graph_id: str, storage: GraphStorage
     ) -> GraphMemoryUpdater:
         """
-        asSimulationCreateGraphrecordmemoryUpdatedevice
+        Create a graph memory updater for a simulation.
 
         Args:
-            simulation_id: SimulationID
-            graph_id: GraphID
+            simulation_id: Simulation ID
+            graph_id: Graph ID
             storage: GraphStorage instance
         """
         with cls._lock:
```

**File**: `backend/app/services/simulation_ipc.py` (modified, +13/-14)
```diff
@@ -1,11 +1,10 @@
 """
-SimulationIPCpassbelievemodelChunk
-useinFlaskafterendandSimulationscriptoriginalofbetweensProcessbetweenpassbelieve
+Simulation inter-process communication module for Flask and simulation script communication.
 
-passthroughFilesystemstatisticsrealappearsimplesinglesCommand/Responsemodelformat：
-1. FlaskWriteCommandto commands/ Directory
-2. SimulationscriptoriginalroundqueryCommandDirectory，ExecuteCommandandWriteResponseto responses/ Directory
-3. FlaskroundqueryResponseDirectoryGetResult
+Communication uses a simple filesystem-based command/response model:
+1. Flask writes commands to the commands/ directory.
+2. The simulation script polls the commands directory, executes the command, and writes the response to the responses/ directory.
+3. Flask polls the responses directory and retrieves the result.
 """
 
 import os
@@ -94,9 +93,9 @@ def from_dict(cls, data: Dict[str, Any]) -> 'IPCResponse':
 
 class SimulationIPCClient:
     """
-    SimulationIPCclientuserend（Flaskendmakeuse）
-    
-    useintoSimulationProcessSendCommandandWaitResponse
+    Simulation IPC client for Flask side.
+
+    Used to send commands to the simulation process and wait for responses.
     """
     
     def __init__(self, simulation_dir: str):
@@ -160,8 +159,8 @@ def send_command(
                     with open(response_file, 'r', encoding='utf-8') as f:
                         response_data = json.load(f)
                     response = IPCResponse.from_dict(response_data)
-                    
-                    # CleanCommandandResponseFile
+
+                    # Clean up command and response files
                     try:
                         os.remove(command_file)
                         os.remove(response_file)
@@ -287,9 +286,9 @@ def check_env_alive(self) -> bool:
 
 class SimulationIPCServer:
     """
-    SimulationIPCserveservicedevice（Simulationscriptoriginalendmakeuse）
-    
-    roundqueryCommandDirectory，ExecuteCommandandReturnResponse
+    Simulation IPC server for the simulation script side.
+
+    Polls the command directory, executes commands, and returns responses.
     """
     
     def __init__(self, simulation_dir: str):
```

---

### Incident Patch 8: `70410590` (2026-03-15)
**Commit Message**: fix: resolve CSS rendering bug, update GitHub link to fork repo

Vite SFC compiler was truncating CSS rules in <style> blocks.
Moved all Home page styles to reactive JS objects with :style
bindings. Updated GitHub link to nikmcfly/MiroFish-Offline.
Fixed Neo4j password in .env.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `frontend/src/views/Home.vue` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
     <nav class="navbar" :style="s.navbar">
       <div class="nav-brand" :style="s.navBrand">MIROFISH OFFLINE</div>
       <div class="nav-links" :style="s.navLinks">
-        <a href="https://github.com/666ghj/MiroFish" target="_blank" class="github-link" :style="s.githubLink">
+        <a href="https://github.com/nikmcfly/MiroFish-Offline" target="_blank" class="github-link" :style="s.githubLink">
           Visit our Github <span>↗</span>
         </a>
       </div>
```

---

### Incident Patch 9: `3187c575` (2026-03-15)
**Commit Message**: fix: resolve CSS rendering bug — move all styles to JS reactive objects

Vite SFC compiler was truncating CSS rules after the first selector
in <style> blocks (both scoped and unscoped). Moved all Home page
styles to reactive JS objects with :style bindings, bypassing CSS
compilation entirely. Also fixed Neo4j password in .env.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `frontend/index.html` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <meta name="description" content="MiroFish Offline - Multi-Agent Social Simulation Engine" />
     <title>MiroFish Offline - Predict Everything</title>
+    <link rel="stylesheet" href="/home-styles.css">
   </head>
   <body>
     <div id="app"></div>
```

**File**: `frontend/src/App.vue` (modified, +554/-2)
```diff
@@ -22,7 +22,6 @@
   background-color: #ffffff;
 }
 
-/* Scrollbar style */
 ::-webkit-scrollbar {
   width: 8px;
   height: 8px;
@@ -40,8 +39,561 @@
   background: #333333;
 }
 
-/* Global button style */
 button {
   font-family: inherit;
 }
+
+/* ========== HOME PAGE STYLES ========== */
+
+.home-container {
+  min-height: 100vh;
+  background: #FFFFFF;
+  font-family: 'Space Grotesk', 'Noto Sans SC', system-ui, sans-serif;
+  color: #000000;
+}
+
+.navbar {
+  height: 60px;
+  background: #000000;
+  color: #FFFFFF;
+  display: flex;
+  justify-content: space-between;
+  align-items: center;
+  padding: 0 40px;
+}
+
+.nav-brand {
+  font-family: 'JetBrains Mono', monospace;
+  font-weight: 800;
+  letter-spacing: 1px;
+  font-size: 1.2rem;
+}
+
+.nav-links {
+  display: flex;
+  align-items: center;
+}
+
+.github-link {
+  color: #FFFFFF;
+  text-decoration: none;
+  font-family: 'JetBrains Mono', monospace;
+  font-size: 0.9rem;
+  font-weight: 500;
+  display: flex;
+  align-items: center;
+  gap: 8px;
+  transition: opacity 0.2s;
+}
+
+.github-link:hover {
+  opacity: 0.8;
+}
+
+.arrow {
+  font-family: sans-serif;
+}
+
+.main-content {
+  max-width: 1400px;
+  margin: 0 auto;
+  padding: 60px 40px;
+}
+
+.hero-section {
+  display: flex;
+  justify-content: space-between;
+  margin-bottom: 80px;
+  position: relative;
+}
+
+.hero-left {
+  flex: 1;
+  padding-right: 60px;
+}
+
+.tag-row {
+  display: flex;
+  align-items: center;
+  gap: 15px;
+  margin-bottom: 25px;
+  font-family: 'JetBrains Mono', monospace;
+  font-size: 0.8rem;
+}
+
+.orange-tag {
+  background: #FF4500;
+  color: #FFFFFF;
+  padding: 4px 10px;
+  font-weight: 700;
+  letter-spacing: 1px;
+  font-size: 0.75rem;
+}
+
+.version-text {
+  color: #999;
+  font-weight: 500;
+  letter-spacing: 0.5px;
+}
+
+.main-title {
+  font-size: 4.5rem;
+  line-height: 1.2;
+  font-weight: 500;
+  margin: 0 0 40px 0;
+  letter-spacing: -2px;
+  color: #000000;
+}
+
+.gradient-text {
+  background: linear-gradient(90deg, #000000 0%, #444444 100%);
+  -webkit-background-clip: text;
+  -webkit-text-fill-color: transparent;
+  display: inline-block;
+}
+
+.hero-desc {
+  font-size: 1.05rem;
+  line-height: 1.8;
+  color: #666666;
+  max-width: 640px;
+  margin-bottom: 50px;
+  font-weight: 400;
+  text-align: justify;
+}
+
+.hero-desc p {
+  margin-bottom: 1.5rem;
+}
+
+.highlight-bold {
+  color: #000000;
+  font-weight: 700;
+}
+
+.highlight-orange {
+  color: #FF4500;
+  font-weight: 700;
+  font-family: 'JetBrains Mono', monospace;
+}
+
+.highlight-code {
+  background: rgba(0, 0, 0, 0.05);
+  padding: 2px 6px;
+  border-radius: 2px;
+  font-family: 'JetBrains Mono', monospace;
+  font-size: 0.9em;
+  color: #000000;
+  font-weight: 600;
+}
+
+.slogan-text {
+  font-size: 1.2rem;
+  font-weight: 520;
+  color: #000000;
+  letter-spacing: 1px;
+  border-left: 3px solid #FF4500;
+  padding-left: 15px;
+  margin-top: 20px;
+}
+
+.blinking-cursor {
+  color: #FF4500;
+  animation: blink 1s step-end infinite;
+  font-weight: 700;
+}
+
+@keyframes blink {
+  0%, 100% { opacity: 1; }
+  50% { opacity: 0; }
+}
+
+.decoration-square {
+  width: 16px;
+  height: 16px;
+  background: #FF4500;
+}
+
+.hero-right {
+  flex: 0.8;
+  display: flex;
+  flex-direction: column;
+  justify-content: space-between;
+  align-items: flex-end;
+}
+
+.logo-container {
+  width: 100%;
+  display: flex;
+  justify-content: flex-end;
+  padding-right: 40px;
+}
+
+.hero-logo {
+  max-width: 500px;
+  width: 100%;
+}
+
+.scroll-down-btn {
+  width: 40px;
+  height: 40px;
+  border: 1px solid #E5E5E5;
+  background: transparent;
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  cursor: pointer;
+  color: #FF4500;
+  font-size: 1.2rem;
+  transition: all 0.2s;
+}
+
+.scroll-down-btn:hover {
+  border-color: #FF4500;
+}
+
+.dashboard-section {
+  display: flex;
+  gap: 60px;
+  border-top: 1px solid #E5E5E5;
+  padding-top: 60px;
+  align-items: flex-start;
+}
+
+.dashboard-s
```

**File**: `frontend/src/views/Home.vue` (modified, +166/-787)
```diff
@@ -1,887 +1,266 @@
 <template>
   <div class="home-container">
     <!-- Top Navigation Bar -->
-    <nav class=”navbar”>
-      <div class=”nav-brand”>MIROFISH OFFLINE</div>
-      <div class=”nav-links”>
-        <a href=”https://github.com/666ghj/MiroFish” target=”_blank” class=”github-link”>
-          Visit our Github <span class=”arrow”>↗</span>
+    <nav class="navbar" :style="s.navbar">
+      <div class="nav-brand" :style="s.navBrand">MIROFISH OFFLINE</div>
+      <div class="nav-links" :style="s.navLinks">
+        <a href="https://github.com/666ghj/MiroFish" target="_blank" class="github-link" :style="s.githubLink">
+          Visit our Github <span>↗</span>
         </a>
       </div>
     </nav>
 
-    <div class=”main-content”>
+    <div class="main-content" :style="s.mainContent">
       <!-- Hero Section -->
-      <section class=”hero-section”>
-        <div class=”hero-left”>
-          <div class=”tag-row”>
-            <span class=”orange-tag”>Universal Swarm Intelligence Engine</span>
-            <span class=”version-text”>/ v0.1-preview</span>
+      <section class="hero-section" :style="s.heroSection">
+        <div class="hero-left" :style="s.heroLeft">
+          <div class="tag-row" :style="s.tagRow">
+            <span class="orange-tag" :style="s.orangeTag">Universal Swarm Intelligence Engine</span>
+            <span class="version-text" :style="s.versionText">/ v0.1-preview</span>
           </div>
 
-          <h1 class=”main-title”>
+          <h1 class="main-title" :style="s.mainTitle">
             Upload Any Report<br>
-            <span class=”gradient-text”>Simulate the Future</span>
+            <span class="gradient-text" :style="s.gradientText">Simulate the Future</span>
           </h1>
 
-          <div class=”hero-desc”>
-            <p>
-              Even from a single document, <span class=”highlight-bold”>MiroFish</span> can extract reality seeds and auto-generate a parallel world with up to <span class=”highlight-orange”>millions of Agents</span>. Inject variables from a god's-eye view and find <span class=”highlight-code”>”local optima”</span> in complex group interactions under dynamic environments.
+          <div class="hero-desc" :style="s.heroDesc">
+            <p :style="s.heroDescP">
+              Even from a single document, <span :style="s.highlightBold">MiroFish</span> can extract reality seeds and auto-generate a parallel world with up to <span :style="s.highlightOrange">millions of Agents</span>. Inject variables from a god's-eye view and find <span :style="s.highlightCode">"local optima"</span> in complex group interactions under dynamic environments.
             </p>
-            <p class=”slogan-text”>
-              Let the future rehearse among Agents, let decisions win after a hundred battles<span class=”blinking-cursor”>_</span>
+            <p class="slogan-text" :style="s.sloganText">
+              Let the future rehearse among Agents, let decisions win after a hundred battles<span :style="s.blinkingCursor">_</span>
             </p>
           </div>
-           
-          <div class="decoration-square"></div>
+
+          <div class="decoration-square" :style="s.decorationSquare"></div>
         </div>
-        
-        <div class="hero-right">
-          <!-- Logo Section -->
-          <div class="logo-container">
-            <img src="../assets/logo/MiroFish_logo_left.jpeg" alt="MiroFish Logo" class="hero-logo" />
+
+        <div class="hero-right" :style="s.heroRight">
+          <div class="logo-container" :style="s.logoContainer">
+            <img src="../assets/logo/MiroFish_logo_left.jpeg" alt="MiroFish Logo" :style="s.heroLogo" />
           </div>
-          
-          <button class="scroll-down-btn" @click="scrollToBottom">
-            ↓
-          </button>
+          <button :style="s.scrollDownBtn" @click="scrollToBottom">↓</button>
         </div>
       </section>
 
       <!-- Dashboard: Two-Column Layout -->
-      <section cl
```

**File**: `frontend/src/views/Process.vue` (modified, +1/-9)
```diff
@@ -1091,15 +1091,7 @@ onUnmounted(() => {
 </script>
 
 <style scoped>
-/* Variables */
-:root {
-  --black: #000000;
-  --white: #FFFFFF;
-  --orange: #FF6B35;
-  --gray-light: #F5F5F5;
-  --gray-border: #E0E0E0;
-  --gray-text: #666666;
-}
+/* CSS variables are defined globally in App.vue :root */
 
 .process-page {
   min-height: 100vh;
```

---

### Incident Patch 10: `b80a548b` (2026-03-15)
**Commit Message**: fix: complete backend migration to Neo4j + Ollama local stack

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `backend/app/__init__.py` (modified, +0/-7)
```diff
@@ -80,13 +80,6 @@ def log_response(response):
     app.register_blueprint(simulation_bp, url_prefix='/api/simulation')
     app.register_blueprint(report_bp, url_prefix='/api/report')
     
-    # 关闭 Neo4j 连接
-    @app.teardown_appcontext
-    def close_neo4j(exception=None):
-        storage = app.extensions.get('neo4j_storage')
-        if storage and hasattr(storage, 'close'):
-            storage.close()
-
     # 健康检查
     @app.route('/health')
     def health():
```

**File**: `backend/app/api/graph.py` (modified, +7/-15)
```diff
@@ -357,6 +357,9 @@ def build_graph():
                 "error": "未找到本体定义"
             }), 400
         
+        # 获取 storage 在请求上下文中（后台线程无法访问 current_app）
+        storage = _get_storage()
+
         # 创建异步任务
         task_manager = TaskManager()
         task_id = task_manager.create_task(f"构建图谱: {graph_name}")
@@ -378,8 +381,7 @@ def build_task():
                     message="初始化图谱构建服务..."
                 )
                 
-                # 创建图谱构建服务
-                storage = _get_storage()
+                # 创建图谱构建服务（storage 从外部闭包传入）
                 builder = GraphBuilderService(storage=storage)
                 
                 # 分块
@@ -437,23 +439,13 @@ def add_progress_callback(msg, progress_ratio):
                     progress_callback=add_progress_callback
                 )
                 
-                # 等待Zep处理完成（查询每个episode的processed状态）
+                # Neo4j处理是同步的，无需等待
                 task_manager.update_task(
                     task_id,
-                    message="等待Zep处理数据...",
-                    progress=55
+                    message="文本处理完成，生成图谱数据...",
+                    progress=90
                 )
                 
-                def wait_progress_callback(msg, progress_ratio):
-                    progress = 55 + int(progress_ratio * 35)  # 55% - 90%
-                    task_manager.update_task(
-                        task_id,
-                        message=msg,
-                        progress=progress
-                    )
-                
-                builder._wait_for_episodes(episode_uuids, wait_progress_callback)
-                
                 # 获取图谱数据
                 task_manager.update_task(
                     task_id,
```

**File**: `backend/app/api/simulation.py` (modified, +7/-4)
```diff
@@ -458,13 +458,15 @@ def prepare_simulation():
         use_llm_for_profiles = data.get('use_llm_for_profiles', True)
         parallel_profile_count = data.get('parallel_profile_count', 5)
         
+        # ========== 获取 GraphStorage（在后台任务启动前捕获引用） ==========
+        storage = current_app.extensions.get('neo4j_storage')
+        if not storage:
+            raise ValueError("GraphStorage not initialized — check Neo4j connection")
+
         # ========== 同步获取实体数量（在后台任务启动前） ==========
         # 这样前端在调用prepare后立即就能获取到预期Agent总数
         try:
             logger.info(f"同步获取实体数量: graph_id={state.graph_id}")
-            storage = current_app.extensions.get('neo4j_storage')
-            if not storage:
-                raise ValueError("GraphStorage not initialized")
             reader = EntityReader(storage)
             # 快速读取实体（不需要边信息，只统计数量）
             filtered_preview = reader.filter_defined_entities(
@@ -576,7 +578,8 @@ def progress_callback(stage, progress, message, **kwargs):
                     defined_entity_types=entity_types_list,
                     use_llm_for_profiles=use_llm_for_profiles,
                     progress_callback=progress_callback,
-                    parallel_profile_count=parallel_profile_count
+                    parallel_profile_count=parallel_profile_count,
+                    storage=storage,
                 )
                 
                 # 任务完成
```

**File**: `backend/app/services/graph_builder.py` (modified, +25/-2)
```diff
@@ -3,6 +3,8 @@
 使用 GraphStorage (Neo4j) 替代 Zep Cloud API
 """
 
+import time
+import logging
 import threading
 from typing import Dict, Any, List, Optional, Callable
 from dataclasses import dataclass
@@ -12,6 +14,8 @@
 from ..storage import GraphStorage
 from .text_processor import TextProcessor
 
+logger = logging.getLogger('mirofish.graph_builder')
+
 
 @dataclass
 class GraphInfo:
@@ -188,11 +192,13 @@ def add_text_batches(
         """分批添加文本到图谱，返回所有 episode 的 uuid 列表"""
         episode_uuids = []
         total_chunks = len(chunks)
+        total_batches = (total_chunks + batch_size - 1) // batch_size
+
+        logger.info(f"[graph_build] Starting: {total_chunks} chunks, {total_batches} batches (batch_size={batch_size})")
 
         for i in range(0, total_chunks, batch_size):
             batch_chunks = chunks[i:i + batch_size]
             batch_num = i // batch_size + 1
-            total_batches = (total_chunks + batch_size - 1) // batch_size
 
             if progress_callback:
                 progress = (i + len(batch_chunks)) / total_chunks
@@ -201,15 +207,32 @@ def add_text_batches(
                     progress
                 )
 
-            for chunk in batch_chunks:
+            for j, chunk in enumerate(batch_chunks):
+                chunk_idx = i + j + 1
+                chunk_preview = chunk[:80].replace('\n', ' ')
+                logger.info(
+                    f"[graph_build] Chunk {chunk_idx}/{total_chunks} "
+                    f"({len(chunk)} chars): \"{chunk_preview}...\""
+                )
+                t0 = time.time()
                 try:
                     episode_id = self.storage.add_text(graph_id, chunk)
                     episode_uuids.append(episode_id)
+                    elapsed = time.time() - t0
+                    logger.info(
+                        f"[graph_build] Chunk {chunk_idx}/{total_chunks} done in {elapsed:.1f}s"
+                    )
                 except Exception as e:
+                    elapsed = time.time() - t0
+                    logger.error(
+                        f"[graph_build] Chunk {chunk_idx}/{total_chunks} FAILED "
+                        f"after {elapsed:.1f}s: {e}"
+                    )
                     if progress_callback:
                         progress_callback(f"批次 {batch_num} 处理失败: {str(e)}", 0)
                     raise
 
+        logger.info(f"[graph_build] All {total_chunks} chunks processed successfully")
         return episode_uuids
 
     def _get_graph_info(self, graph_id: str) -> GraphInfo:
```

**File**: `backend/app/storage/neo4j_storage.py` (modified, +28/-21)
```diff
@@ -174,23 +174,41 @@ def get_ontology(self, graph_id: str) -> Dict[str, Any]:
     # ----------------------------------------------------------------
 
     def add_text(self, graph_id: str, text: str) -> str:
-        """Process text: NER/RE → create nodes/edges → return episode_id."""
+        """Process text: NER/RE → batch embed → create nodes/edges → return episode_id."""
         episode_id = str(uuid.uuid4())
         now = datetime.now(timezone.utc).isoformat()
 
         # Get ontology for NER guidance
         ontology = self.get_ontology(graph_id)
 
         # Extract entities and relations
+        logger.info(f"[add_text] Starting NER extraction for chunk ({len(text)} chars)...")
         extraction = self._ner.extract(text, ontology)
         entities = extraction.get("entities", [])
         relations = extraction.get("relations", [])
 
         logger.info(
-            f"NER extracted {len(entities)} entities, {len(relations)} relations "
-            f"from text ({len(text)} chars)"
+            f"[add_text] NER done: {len(entities)} entities, {len(relations)} relations"
         )
 
+        # --- Batch embed all texts at once ---
+        entity_summaries = [f"{e['name']} ({e['type']})" for e in entities]
+        fact_texts = [r.get("fact", f"{r['source']} {r['type']} {r['target']}") for r in relations]
+        all_texts_to_embed = entity_summaries + fact_texts
+
+        all_embeddings: list = []
+        if all_texts_to_embed:
+            logger.info(f"[add_text] Batch-embedding {len(all_texts_to_embed)} texts...")
+            try:
+                all_embeddings = self._embedding.embed_batch(all_texts_to_embed)
+            except Exception as e:
+                logger.warning(f"[add_text] Batch embedding failed, falling back to empty: {e}")
+                all_embeddings = [[] for _ in all_texts_to_embed]
+
+        entity_embeddings = all_embeddings[:len(entities)]
+        relation_embeddings = all_embeddings[len(entities):]
+        logger.info(f"[add_text] Embedding done, writing to Neo4j...")
+
         with self._driver.session() as session:
             # Create episode node
             def _create_episode(tx):
@@ -214,18 +232,12 @@ def _create_episode(tx):
 
             # MERGE entities (upsert by graph_id + name + primary label)
             entity_uuid_map: Dict[str, str] = {}  # name_lower -> uuid
-            for entity in entities:
+            for idx, entity in enumerate(entities):
                 ename = entity["name"]
                 etype = entity["type"]
                 attrs = entity.get("attributes", {})
-
-                # Generate embedding for entity summary
-                summary_text = f"{ename} ({etype})"
-                try:
-                    embedding = self._embedding.embed(summary_text)
-                except Exception as e:
-                    logger.warning(f"Embedding failed for entity '{ename}': {e}")
-                    embedding = []
+                summary_text = entity_summaries[idx]
+                embedding = entity_embeddings[idx] if idx < len(entity_embeddings) else []
 
                 e_uuid = str(uuid.uuid4())
                 entity_uuid_map[ename.lower()] = e_uuid
@@ -266,7 +278,7 @@ def _merge_entity(tx, _uuid=e_uuid, _name=ename, _type=etype,
                 actual_uuid = self._call_with_retry(session.execute_write, _merge_entity)
                 entity_uuid_map[ename.lower()] = actual_uuid
 
-                # Add entity type label using APOC (or fallback to string query)
+                # Add entity type label
                 if etype and etype != "Entity":
                     try:
                         def _add_label(tx, _name_lower=ename.lower()):
@@ -280,7 +292,7 @@ def _add_label(tx, _name_lower=ename.lower()):
                         logger.warning(f"Failed to add label '{etype}' to '{ename}': {e}")
 
             # Create relations
-            for relation in relations:
+            for idx, relation in enumerat
```

#### Recent Merged Pull Requests:
- **PR #49** (closed): fix: increase live audience json budget (@pdurlej)
- **PR #47** (closed): feat: add structured audience panel smoke (@pdurlej)
- **PR #46** (closed): docs: add RS2000 cloud smoke profile (@pdurlej)
- **PR #44** (closed): Feat/czech nlp extraction (@reevesprojects)
- **PR #43** (closed): refactor: rename project from MiroFish-Offline to SignalQuay, update … (@JamesMoneyV1)
- **PR #38** (closed): fix: fall back to Ollama native /api/chat for thinking-mode models (fixes #26) (@nandanadileep)
- **PR #25** (closed): feat: Add Digital Twin simulation platform for manufacturing scenarios (@lilubot)
- **PR #12** (closed): feat: Signal Scanner — batch-scan markets, rank by edge (@Barac9492)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
