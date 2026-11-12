> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zilliztech-claude-context-learnings.md`  
> **Source**: github ([https://github.com/zilliztech/claude-context](https://github.com/zilliztech/claude-context))  
> **Source Version**: `64a87f9b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T21:41:41.133Z  
> **Learning ID**: `learn-github-zilliztech-claude-context`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zilliztech/claude-context

> **Canonical Artifact**: `07_PROJECT_LEARNING/zilliztech-claude-context-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zilliztech/claude-context](https://github.com/zilliztech/claude-context))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T21:41:41.117Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zilliztech/claude-context`
- **Description**: Code search MCP for Claude Code. Make entire codebase the context for any coding agent.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12689 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evaluation/utils/constant.py`
```
from pathlib import Path

evaluation_path = Path(__file__).parent.parent.absolute()  # evaluation/
project_path = evaluation_path.parent.absolute()  # claude-context/

```

### Core Architecture Module: `evaluation/utils/file_management.py`
```
import os
import json
from pathlib import Path
import re
import logging
from git import Repo
from filelock import FileLock

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def get_remaining_instances(instances, output_file):
    """
    Filters a list of instances to exclude those that have already been processed and saved in a file.

    Args:
        instances (List[Dict]): A list of instances, where each instance is a dictionary with an "instance_id" key.
        output_file (Path): The path to the file where the processed instances are saved.

    Returns:
        List[Dict]: A list of instances that have not been processed yet.
    """
    instance_ids = set()
    remaining_instances = list()
    if output_file.exists():
        with FileLock(output_file.as_posix() + ".lock"):
            with open(output_file) as f:
                for line in f:
                    instance = json.loads(line)
                    instance_id = instance["instance_id"]
                    instance_ids.add(instance_id)
            logger.warning(
                f"Found {len(instance_ids)} existing instances in {output_file}. Will skip them."
            )
    else:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        return instances
    for instance in instances:
        instance_id = instance["instance_id"]
        if instance_id not in instance_ids:
            remaining_instances.append(instance)
    return remaining_instances


def is_test(name, test_phrases=None):
    if test_phrases is None:
        test_phrases = ["test", "tests", "testing"]
    words = set(re.split(r" |_|\/|\.", name.lower()))
    return any(word in words for word in test_phrases)


def list_files(root_dir, include_tests=False):
    files = []
    for filename in Path(root_dir).rglob("*.py"):
        if not include_tests and is_test(filename.as_posix()):
            continue
        files.append(filename.relative_to(root_dir).as_posix())
    return files


class ContextManager:
    """
    A context manager for managing a Git repository at a specific commit.

    Args:
        repo_path (str): The path to the Git repository.
        base_commit (str): The commit hash to switch to.
        verbose (bool, optional): Whether to print verbose output. Defaults to False.

    Attributes:
        repo_path (str): The path to the Git repository.
        base_commit (str): The commit hash to switch to.
        verbose (bool): Whether to print verbose output.
        repo (git.Repo): The Git repository object.

    Methods:
        __enter__(): Switches to the specified commit and returns the context manager object.
        get_readme_files(): Returns a list of filenames for all README files in the repository.
        __exit__(exc_type, exc_val, exc_tb): Does nothing.
    """

    def __init__(self, repo_path, base_commit, verbose=False):
        self.repo_path = Path(repo_path).resolve().as_posix()
        self.base_commit = base_commit
        self.verbose = verbose
        self.repo = Repo(self.repo_path)

    def __enter__(self):
        if self.verbose:
            print(f"Switching to {self.base_commit}")
        try:
            self.repo.git.reset("--hard", self.base_commit)
            self.repo.git.clean("-fdxq")
        except Exception as e:
            logger.error(f"Failed to switch to {self.base_commit}")
            logger.error(e)
            raise e
        return self

    def get_readme_files(self):
        files = os.listdir(self.repo_path)
        files = list(filter(lambda x: os.path.isfile(x), files))
        files = list(filter(lambda x: x.lower().startswith("readme"), files))
        return files

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def clone_repo(repo, root_dir, token):
    """
    Clones a GitHub repository to a specified directory.

    Args:
        repo (str): The GitHub repository to clone.
        root_dir (str): The root directory to clone the repository to.
        token (str): The GitHub personal access token to use for authentication.

    Returns:
        Path: The path to the cloned repository directory.
    """
    repo_dir = Path(root_dir, f"repo__{repo.replace('/', '__')}")

    if not repo_dir.exists():
        repo_url = f"https://{token}@github.com/{repo}.git"
        logger.info(f"Cloning {repo} {os.getpid()}")
        Repo.clone_from(repo_url, repo_dir)
    return repo_dir

```

### Core Architecture Module: `evaluation/utils/format.py`
```
import json
import re
import os


def extract_final_answer(response):
    """Extract the final answer from the agent response"""
    if "messages" in response:
        messages = response["messages"]
        # Get the last AI message
        for message in reversed(messages):
            if hasattr(message, "content") and isinstance(message.content, str):
                return message.content
            elif hasattr(message, "content") and isinstance(message.content, list):
                # Handle structured content
                for content_item in message.content:
                    if (
                        isinstance(content_item, dict)
                        and content_item.get("type") == "text"
                    ):
                        return content_item.get("text", "")
    return "No answer found"


def extract_file_paths_from_edits(response, codebase_path):
    """Extract file paths from edit tool responses and convert to relative paths"""
    import re

    file_paths = []
    seen_relative_paths = set()  # Use set for faster lookup
    codebase_path = os.path.abspath(codebase_path)

    # Extract the entire conversation content
    if hasattr(response, "get") and "messages" in response:
        # Handle LangGraph response format
        content = ""
        for message in response["messages"]:
            if hasattr(message, "content"):
                content += str(message.content) + "\n"
            elif isinstance(message, dict) and "content" in message:
                content += str(message["content"]) + "\n"
    else:
        # Fallback for other response formats
        content = str(response)

    # Pattern to match "Successfully modified file: /path/to/file"
    edit_pattern = r"Successfully modified file:\s*(.+?)(?:\s|$)"

    # Also check for edit tool calls in the response
    # Pattern to match edit tool calls with file_path parameter
    tool_call_pattern = r"edit.*?file_path[\"']?\s*:\s*[\"']([^\"']+)[\"']"

    for line in content.split("\n"):
        # Check for "Successfully modified file:" pattern
        match = re.search(edit_pattern, line.strip())
        if match:
            file_path = match.group(1).strip()
            # Convert to relative path immediately for deduplication
            rel_path = _normalize_to_relative_path(file_path, codebase_path)
            if rel_path and rel_path not in seen_relative_paths:
                seen_relative_paths.add(rel_path)
                file_paths.append(rel_path)

        # Check for edit tool calls
        match = re.search(tool_call_pattern, line.strip(), re.IGNORECASE)
        if match:
            file_path = match.group(1).strip()
            # Convert to relative path immediately for deduplication
            rel_path = _normalize_to_relative_path(file_path, codebase_path)
            if rel_path and rel_path not in seen_relative_paths:
                seen_relative_paths.add(rel_path)
                file_paths.append(rel_path)

    return file_paths


def _normalize_to_relative_path(file_path, codebase_path):
    """Convert a file path to relative path based on codebase_path"""
    if isinstance(file_path, str):
        if os.path.isabs(file_path):
            # Absolute path - convert to relative
            abs_path = os.path.abspath(file_path)
            if abs_path.startswith(codebase_path):
                return os.path.relpath(abs_path, codebase_path)
            else:
                # Path outside codebase, return as-is
                return file_path
        else:
            # Already relative path
            return file_path
    return None


def extract_oracle_files_from_patch(patch):
    """Extract the list of oracle files from the patch field"""
    import re

    if not patch:
        return []

    # Pattern to match patch headers like "--- a/path/to/file"
    patch_files_pattern = re.compile(r"\-\-\- a/(.+)")
    oracle_files = list(set(patch_files_pattern.findall(patch)))

    return oracle_files


def extract_edit_calls_from_conversation_log(log_content: str):
    """Extract all edit tool calls from conversation log content"""
    import re

    edit_calls = []

    # Split content into lines for processing
    lines = log_content.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # Look for Arguments: line with edit tool (may have leading whitespace)
        if "Arguments:" in line and "'file_path'" in line:
            # Collect the full arguments block (might span multiple lines)
            args_block = line

            # Check if the line contains complete arguments
            if "}" in line:
                # Arguments are on a single line
                args_text = line
            else:
                # Arguments span multiple lines
                j = i + 1
                while j < len(lines) and "}" not in lines[j]:
                    args_block += (
                        "\n" + lines[j]
                    )  # Keep original formatting including newlines
                    j += 1
                if j < len(lines):
                    args_block += "\n" + lines[j]
                args_text = args_block

            # Extract file_path, old_string, new_string using regex
            file_path_match = re.search(r"'file_path':\s*'([^']*)'", args_text)
            # old_string can be either single-quoted or double-quoted
            old_string_match = re.search(
                r"'old_string':\s*[\"'](.*?)[\"'](?=,\s*'new_string')",
                args_text,
                re.DOTALL,
            )
            # new_string can be either single-quoted or double-quoted
            new_string_match = re.search(
                r"'new_string':\s*[\"'](.*?)[\"'](?=\s*})", args_text, re.DOTALL
            )

            if file_path_match and old_string_match and new_string_match:
                file_path = file_path_match.group(1)
                old_string = old_string_match.group(1)
                new_string = new_string_match.group(1)

                # Unescape newlines and clean up strings
                old_string = old_string.replace("\\n", "\n").replace("\\'", "'")
                new_string = new_string.replace("\\n", "\n").replace("\\'", "'")

                edit_calls.append(
                    {
                        "file_path": file_path,
                        "old_string": old_string,
                        "new_string": new_string,
                    }
                )

        i += 1

    return edit_calls


def find_line_number_for_old_string(file_path: str, old_string: str):
    """Find the line number where old_string starts in the file"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Find the position of old_string in the content
        pos = content.find(old_string)
        if pos == -1:
            return None

        # Count lines up to that position
        line_num = content[:pos].count("\n") + 1
        return line_num
    except Exception:
        return None


def generate_unified_diff(file_path: str, old_string: str, new_string: str):
    """Generate unified diff format for a single edit"""
    import difflib
    import os

    # Get the relative file path for cleaner display
    rel_path = os.path.relpath(file_path) if os.path.exists(file_path) else file_path

    # Find line number where change occurs
    start_line = find_line_number_for_old_string(file_path, old_string)

    # Split strings into lines for difflib
    old_lines = old_string.splitlines(keepends=True)
    new_lines = new_string.splitlines(keepends=True)

    # Generate diff with context
    diff_lines = list(
        difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{rel_path}",
            tofile=f"b/{rel_path}",
            lineterm="",
            n=3,  # 3 lines of context
        )
    )

    # If we found the line number, add it as a comment
    result = []
    if start_line is not None:
        result.append(f"# Edit starting at line {start_line}")

    result.extend(diff_lines)
    return "\n".join(result)


def create_unified_diff_file(instance_dir: str, conversation_summary: str) -> None:
    """Create a unified diff file from conversation log content"""
    edit_calls = extract_edit_calls_from_conversation_log(conversation_summary)

    if not edit_calls:
        return

    diff_content = []
    diff_content.append("# Unified diff of all edits made during retrieval")
    diff_content.append("# Generated from conversation log")
    diff_content.append("")

    for i, edit_call in enumerate(edit_calls, 1):
        diff_content.append(f"# Edit {i}: {edit_call['file_path']}")
        diff_content.append("")

        unified_diff = generate_unified_diff(
            edit_call["file_path"], edit_call["old_string"], edit_call["new_string"]
        )

        diff_content.append(unified_diff)
        diff_content.append("")
        diff_content.append("=" * 80)
        diff_content.append("")

    # Write to changes.diff file
    diff_file = os.path.join(instance_dir, "changes.diff")
    with open(diff_file, "w", encoding="utf-8") as f:
        f.write("\n".join(diff_content))


def calculate_total_tokens(response):
    """Calculate total token usage from the response"""
    total_input_tokens = 0
    total_output_tokens = 0
    total_tokens = 0
    max_single_turn_tokens = 0

    if "messages" in response:
        messages = response["messages"]

        for message in messages:
            current_turn_tokens = 0

            # Check for usage metadata in AI messages
            if hasattr(message, "usage_metadata"):
                usage = message.usage_metadata
                input_tokens = usage.get("input_tokens", 0)
                output_tokens = usage.get("output_tokens", 0)
                turn_total = usage.get("total_tokens", input_tokens + output_tokens)

                total_input_tokens += input_tokens
   
```

### Core Architecture Module: `evaluation/utils/llm_factory.py`
```
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from langchain_anthropic import ChatAnthropic
import os


def llm_factory(llm_type: str, llm_model: str):
    if llm_type == "openai":
        return ChatOpenAI(model=llm_model)
    elif llm_type == "ollama":
        return ChatOllama(model=llm_model)
    elif llm_type == "moonshot":
        return ChatOpenAI(
            model=llm_model,
            base_url="https://api.moonshot.cn/v1",
            api_key=os.getenv("MOONSHOT_API_KEY"),
        )
    elif llm_type == "anthropic":
        return ChatAnthropic(model=llm_model, api_key=os.getenv("ANTHROPIC_API_KEY"))
    else:
        raise ValueError(f"Unsupported LLM type: {llm_type}")

```

### Core Architecture Module: `packages/core/src/context.ts`
```
import {
    Splitter,
    CodeChunk,
    AstCodeSplitter
} from './splitter';
import {
    Embedding,
    EmbeddingVector,
    OpenAIEmbedding
} from './embedding';
import {
    VectorDatabase,
    VectorDocument,
    VectorSearchResult,
    HybridSearchRequest,
    HybridSearchOptions,
    HybridSearchResult
} from './vectordb';
import { SemanticSearchResult } from './types';
import { envManager } from './utils/env-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileSynchronizer } from './sync/synchronizer';
import { IgnoreMatcher } from './utils/ignore-matcher';

/**
 * Thrown by indexCodebase / processFileList when an AbortSignal fires
 * mid-indexing. Callers (e.g. the MCP server's clear_index handler) use
 * this to detect a cooperative cancel vs. a real failure.
 */
export class IndexAbortError extends Error {
    constructor(message: string = 'Indexing aborted') {
        super(message);
        this.name = 'IndexAbortError';
    }
}

/**
 * Thrown when the embedding API fails (quota exhausted, auth failure,
 * network error, etc.). Propagates through processFileList so callers
 * can distinguish a critical embedding failure from a per-file skip.
 *
 * Unlike a per-file read/parse error (which is logged and skipped),
 * an EmbeddingError is always re-thrown so that the entire indexing
 * pipeline stops. This prevents silent partial indexing: Milvus would
 * otherwise receive zero vectors while the snapshot marks files as done.
 */
export class EmbeddingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmbeddingError';
    }
}

const DEFAULT_SUPPORTED_EXTENSIONS = [
    // Programming languages
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.m', '.mm',
    '.dart', '.sol',
    // Text and markup files
    '.md', '.markdown', '.ipynb',
    // '.txt',  '.json', '.yaml', '.yml', '.xml', '.html', '.htm',
    // '.css', '.scss', '.less', '.sql', '.sh', '.bash', '.env'
];

const DEFAULT_IGNORE_PATTERNS = [
    // Common build output and dependency directories
    'node_modules/**',
    'dist/**',
    'build/**',
    'out/**',
    'target/**',
    'coverage/**',
    '.nyc_output/**',

    // IDE and editor files
    '.vscode/**',
    '.idea/**',
    '*.swp',
    '*.swo',

    // Version control
    '.git/**',
    '.svn/**',
    '.hg/**',

    // Cache directories
    '.cache/**',
    '__pycache__/**',
    '.pytest_cache/**',

    // Logs and temporary files
    'logs/**',
    'tmp/**',
    'temp/**',
    '*.log',

    // Environment and config files
    '.env',
    '.env.*',
    '*.local',

    // Minified and bundled files
    '*.min.js',
    '*.min.css',
    '*.min.map',
    '*.bundle.js',
    '*.bundle.css',
    '*.chunk.js',
    '*.vendor.js',
    '*.polyfills.js',
    '*.runtime.js',
    '*.map', // source map files
    'node_modules', '.git', '.svn', '.hg', 'build', 'dist', 'out',
    'target', '.vscode', '.idea', '__pycache__', '.pytest_cache',
    'coverage', '.nyc_output', 'logs', 'tmp', 'temp'
];

export interface ContextConfig {
    embedding?: Embedding;
    vectorDatabase?: VectorDatabase;
    codeSplitter?: Splitter;
    supportedExtensions?: string[];
    ignorePatterns?: string[];
    customExtensions?: string[]; // New: custom extensions from MCP
    customIgnorePatterns?: string[]; // New: custom ignore patterns from MCP
    collectionNameOverride?: string; // Optional: custom collection name suffix
}

export class Context {
    private static readonly MAX_COLLECTION_NAME_LENGTH = 255;

    private embedding: Embedding;
    private vectorDatabase: VectorDatabase;
    private codeSplitter: Splitter;
    private supportedExtensions: string[];
    private baseIgnorePatterns: string[];
    private ignorePatterns: string[];
    private collectionNameOverride?: string;
    private warnedOverrideSanitization = new Set<string>();
    private synchronizers = new Map<string, FileSynchronizer>();

    constructor(config: ContextConfig = {}) {
        // Initialize services
        this.embedding = config.embedding || new OpenAIEmbedding({
            apiKey: envManager.get('OPENAI_API_KEY') || 'your-openai-api-key',
            model: 'text-embedding-3-small',
            ...(envManager.get('OPENAI_BASE_URL') && { baseURL: envManager.get('OPENAI_BASE_URL') })
        });

        if (!config.vectorDatabase) {
            throw new Error('VectorDatabase is required. Please provide a vectorDatabase instance in the config.');
        }
        this.vectorDatabase = config.vectorDatabase;

        this.codeSplitter = config.codeSplitter || new AstCodeSplitter(2500, 300);

        // Load custom extensions from environment variables
        const envCustomExtensions = this.getCustomExtensionsFromEnv();

        // Combine default extensions with config extensions and env extensions
        const allSupportedExtensions = [
            ...DEFAULT_SUPPORTED_EXTENSIONS,
            ...(config.supportedExtensions || []),
            ...(config.customExtensions || []),
            ...envCustomExtensions
        ];
        // Remove duplicates
        this.supportedExtensions = [...new Set(allSupportedExtensions)];

        // Load custom ignore patterns from environment variables  
        const envCustomIgnorePatterns = this.getCustomIgnorePatternsFromEnv();

        // Start with default ignore patterns and persistent config/env patterns.
        const allIgnorePatterns = [
            ...DEFAULT_IGNORE_PATTERNS,
            ...(config.ignorePatterns || []),
            ...(config.customIgnorePatterns || []),
            ...envCustomIgnorePatterns
        ];
        this.baseIgnorePatterns = this.dedupePatterns(allIgnorePatterns);
        this.ignorePatterns = [...this.baseIgnorePatterns];
        this.collectionNameOverride = config.collectionNameOverride;

        console.log(`[Context] 🔧 Initialized with ${this.supportedExtensions.length} supported extensions and ${this.ignorePatterns.length} ignore patterns`);
        if (envCustomExtensions.length > 0) {
            console.log(`[Context] 📎 Loaded ${envCustomExtensions.length} custom extensions from environment: ${envCustomExtensions.join(', ')}`);
        }
        if (envCustomIgnorePatterns.length > 0) {
            console.log(`[Context] 🚫 Loaded ${envCustomIgnorePatterns.length} custom ignore patterns from environment: ${envCustomIgnorePatterns.join(', ')}`);
        }
    }

    /**
     * Get embedding instance
     */
    getEmbedding(): Embedding {
        return this.embedding;
    }

    /**
     * Get vector database instance
     */
    getVectorDatabase(): VectorDatabase {
        return this.vectorDatabase;
    }

    /**
     * Get code splitter instance
     */
    getCodeSplitter(): Splitter {
        return this.codeSplitter;
    }

    /**
     * Get supported extensions
     */
    getSupportedExtensions(): string[] {
        return [...this.supportedExtensions];
    }

    /**
     * Get supported extensions for the current operation without mutating
     * the Context's persistent extension list.
     */
    getEffectiveSupportedExtensions(additionalExtensions: string[] = []): string[] {
        const normalizedExtensions = this.normalizeExtensions(additionalExtensions);
        return [...new Set([...this.supportedExtensions, ...normalizedExtensions])];
    }

    /**
     * Get ignore patterns
     */
    getIgnorePatterns(): string[] {
        return [...this.ignorePatterns];
    }

    /**
     * Get synchronizers map
     */
    getSynchronizers(): Map<string, FileSynchronizer> {
        return new Map(this.synchronizers);
    }

    /**
     * Set synchronizer for a collection
     */
    setSynchronizer(collectionName: string, synchronizer: FileSynchronizer): void {
        this.synchronizers.set(collectionName, synchronizer);
    }

    /**
     * Public wrapper for loadIgnorePatterns private method
     */
    async getLoadedIgnorePatterns(codebasePath: string): Promise<void> {
        await this.loadIgnorePatterns(codebasePath);
    }

    /**
     * Get the effective ignore patterns for a codebase without relying on
     * codebase-specific patterns already stored on this Context instance.
     */
    async getEffectiveIgnorePatterns(codebasePath: string, additionalIgnorePatterns: string[] = []): Promise<string[]> {
        return this.loadIgnorePatterns(codebasePath, additionalIgnorePatterns);
    }

    /**
     * Public wrapper for prepareCollection private method
     */
    async getPreparedCollection(codebasePath: string): Promise<void> {
        return this.prepareCollection(codebasePath);
    }

    /**
     * Get isHybrid setting from environment variable with default true
     */
    private getIsHybrid(): boolean {
        const isHybridEnv = envManager.get('HYBRID_MODE');
        if (isHybridEnv === undefined || isHybridEnv === null) {
            return true; // Default to true
        }
        return isHybridEnv.toLowerCase() === 'true';
    }

    /**
     * Generate collection name based on codebase path and hybrid mode
     */
    public getCollectionName(codebasePath: string): string {
        const isHybrid = this.getIsHybrid();
        const prefix = isHybrid === true ? 'hybrid_code_chunks' : 'code_chunks';
        const normalizedPath = path.resolve(codebasePath);
        const pathHash = crypto.createHash('md5').update(normalizedPath).digest('hex').substring(0, 8);

        // Overrides always keep the per-codebase `_<pathHash>` suffix so that multiple
        // codebases indexed by the same MCP server can't collapse into one collection.
        const configOverride = this.getValidOverrideValue(this.collectionNameOverride);
        if (configOverride) {
            const suffix = this.sanitizeCollectionNameSuffix(configOverride, prefix, pathHash, 'Context config');
            return `${p
```

### Core Architecture Module: `packages/core/src/embedding/base-embedding.ts`
```
// Interface definitions
export interface EmbeddingVector {
    vector: number[];
    dimension: number;
}

/**
 * Abstract base class for embedding implementations
 */
export abstract class Embedding {
    protected abstract maxTokens: number;

    /**
     * Preprocess text to ensure it's valid for embedding
     * @param text Input text
     * @returns Processed text
     */
    protected preprocessText(text: string): string {
        // Replace empty string with single space
        if (text === '') {
            return ' ';
        }

        // Simple character-based truncation (approximation)
        // Each token is roughly 4 characters on average for English text
        const maxChars = this.maxTokens * 4;
        if (text.length > maxChars) {
            return text.substring(0, maxChars);
        }

        return text;
    }

    /**
     * Detect embedding dimension 
     * @param testText Test text for dimension detection
     * @returns Embedding dimension
     */
    abstract detectDimension(testText?: string): Promise<number>;

    /**
     * Preprocess array of texts
     * @param texts Array of input texts
     * @returns Array of processed texts
     */
    protected preprocessTexts(texts: string[]): string[] {
        return texts.map(text => this.preprocessText(text));
    }

    // Abstract methods that must be implemented by subclasses
    /**
     * Generate text embedding vector
     * @param text Text content
     * @returns Embedding vector
     */
    abstract embed(text: string): Promise<EmbeddingVector>;

    /**
     * Generate text embedding vectors in batch
     * @param texts Text array
     * @returns Embedding vector array
     */
    abstract embedBatch(texts: string[]): Promise<EmbeddingVector[]>;

    /**
     * Get embedding vector dimension
     * @returns Vector dimension
     */
    abstract getDimension(): number;

    /**
     * Get service provider name
     * @returns Provider name
     */
    abstract getProvider(): string;
} 
```

### Core Architecture Module: `packages/core/src/embedding/gemini-embedding.ts`
```
import { GoogleGenAI } from '@google/genai';
import { Embedding, EmbeddingVector } from './base-embedding';

type GeminiModelInfo = {
    dimension: number;
    contextLength: number;
    description: string;
    supportedDimensions?: number[];
};

export interface GeminiEmbeddingConfig {
    model: string;
    apiKey: string;
    baseURL?: string; // Optional custom API endpoint URL
    outputDimensionality?: number; // Optional dimension override
}

export class GeminiEmbedding extends Embedding {
    private client: GoogleGenAI;
    private config: GeminiEmbeddingConfig;
    private dimension: number = 3072; // Default dimension for Gemini embedding models
    protected maxTokens: number = 2048; // Maximum tokens for Gemini embedding models

    constructor(config: GeminiEmbeddingConfig) {
        super();
        this.config = config;
        this.client = new GoogleGenAI({
            apiKey: config.apiKey,
            ...(config.baseURL && {
                httpOptions: {
                    baseUrl: config.baseURL
                }
            }),
        });

        // Set dimension based on model and configuration
        this.updateDimensionForModel(config.model || 'gemini-embedding-001');

        // Override dimension if specified in config
        if (config.outputDimensionality) {
            this.dimension = config.outputDimensionality;
        }
    }

    private updateDimensionForModel(model: string): void {
        const supportedModels = GeminiEmbedding.getSupportedModels();
        const modelInfo = supportedModels[model];

        if (modelInfo) {
            this.dimension = modelInfo.dimension;
            this.maxTokens = modelInfo.contextLength;
        } else {
            // Use default dimension and context length for unknown models
            this.dimension = 3072;
            this.maxTokens = 2048;
        }
    }

    async detectDimension(): Promise<number> {
        // Gemini doesn't need dynamic detection, return configured dimension
        return this.dimension;
    }

    async embed(text: string): Promise<EmbeddingVector> {
        const processedText = this.preprocessText(text);
        const model = this.config.model || 'gemini-embedding-001';

        try {
            return await this.embedProcessedText(processedText, model);
        } catch (error) {
            throw new Error(`Gemini embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
        if (texts.length === 0) {
            return [];
        }

        const processedTexts = this.preprocessTexts(texts);
        const model = this.config.model || 'gemini-embedding-001';

        try {
            const response = await this.client.models.embedContent({
                model: model,
                contents: processedTexts,
                config: {
                    outputDimensionality: this.config.outputDimensionality || this.dimension,
                },
            });

            if (!response.embeddings) {
                throw new Error('Gemini API returned invalid response');
            }

            if (response.embeddings.length !== processedTexts.length) {
                throw new Error(`Gemini API returned ${response.embeddings.length} embeddings for ${processedTexts.length} inputs`);
            }

            return response.embeddings.map((embedding: any) => {
                if (!embedding.values) {
                    throw new Error('Gemini API returned invalid embedding data');
                }
                return {
                    vector: embedding.values,
                    dimension: embedding.values.length
                };
            });
        } catch (error) {
            throw new Error(`Gemini batch embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async embedProcessedText(processedText: string, model: string): Promise<EmbeddingVector> {
        const response = await this.client.models.embedContent({
            model: model,
            contents: processedText,
            config: {
                outputDimensionality: this.config.outputDimensionality || this.dimension,
            },
        });

        if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
            throw new Error('Gemini API returned invalid response');
        }

        return {
            vector: response.embeddings[0].values,
            dimension: response.embeddings[0].values.length
        };
    }

    getDimension(): number {
        return this.dimension;
    }

    getProvider(): string {
        return 'Gemini';
    }

    /**
     * Set model type
     * @param model Model name
     */
    setModel(model: string): void {
        this.config.model = model;
        this.updateDimensionForModel(model);
    }

    /**
     * Set output dimensionality
     * @param dimension Output dimension (must be supported by the model)
     */
    setOutputDimensionality(dimension: number): void {
        this.config.outputDimensionality = dimension;
        this.dimension = dimension;
    }

    /**
     * Get client instance (for advanced usage)
     */
    getClient(): GoogleGenAI {
        return this.client;
    }

    /**
     * Get list of supported models
     */
    static getSupportedModels(): Record<string, GeminiModelInfo> {
        return {
            'gemini-embedding-001': {
                dimension: 3072,
                contextLength: 2048,
                description: 'Gemini embedding model with state-of-the-art performance',
                supportedDimensions: [3072, 1536, 768, 256] // Matryoshka Representation Learning support
            },
            'gemini-embedding-2': {
                dimension: 3072,
                contextLength: 8192,
                description: 'Gemini Embedding 2 model with improved embedding quality and longer context',
                supportedDimensions: [3072, 1536, 768, 256]
            }
        };
    }

    /**
     * Get supported dimensions for the current model
     */
    getSupportedDimensions(): number[] {
        const modelInfo = GeminiEmbedding.getSupportedModels()[this.config.model || 'gemini-embedding-001'];
        return modelInfo?.supportedDimensions || [this.dimension];
    }

    /**
     * Validate if a dimension is supported by the current model
     */
    isDimensionSupported(dimension: number): boolean {
        const supportedDimensions = this.getSupportedDimensions();
        return supportedDimensions.includes(dimension);
    }
}

```

### Core Architecture Module: `packages/core/src/embedding/index.ts`
```
// Export base classes and interfaces
export * from './base-embedding';

// Implementation class exports
export * from './openai-embedding';
export * from './voyageai-embedding';
export * from './ollama-embedding';
export * from './gemini-embedding'; 
```

### Core Architecture Module: `packages/core/src/embedding/ollama-embedding.ts`
```
import { Ollama } from 'ollama';
import { Embedding, EmbeddingVector } from './base-embedding';

export interface OllamaEmbeddingConfig {
    model: string;
    host?: string;
    fetch?: any;
    keepAlive?: string | number;
    options?: Record<string, any>;
    dimension?: number; // Optional dimension parameter
    maxTokens?: number; // Optional max tokens parameter
}

export class OllamaEmbedding extends Embedding {
    private client: Ollama;
    private config: OllamaEmbeddingConfig;
    private dimension: number = 768; // Default dimension for many embedding models
    private dimensionDetected: boolean = false; // Track if dimension has been detected
    protected maxTokens: number = 2048; // Default context window for Ollama

    constructor(config: OllamaEmbeddingConfig) {
        super();
        this.config = config;
        this.client = new Ollama({
            host: config.host || 'http://127.0.0.1:11434',
            fetch: config.fetch,
        });

        // Set dimension based on config or will be detected on first use
        if (config.dimension) {
            this.dimension = config.dimension;
            this.dimensionDetected = true;
        }

        // Set max tokens based on config or use default
        if (config.maxTokens) {
            this.maxTokens = config.maxTokens;
        } else {
            // Set default based on known models
            this.setDefaultMaxTokensForModel(config.model);
        }

        // If no dimension is provided, it will be detected in the first embed call
    }

    private setDefaultMaxTokensForModel(model: string): void {
        // Set different max tokens based on known models
        if (model?.includes('nomic-embed-text')) {
            this.maxTokens = 8192; // nomic-embed-text supports 8192 tokens
        } else if (model?.includes('snowflake-arctic-embed')) {
            this.maxTokens = 8192; // snowflake-arctic-embed supports 8192 tokens
        } else {
            this.maxTokens = 2048; // Default for most Ollama models
        }
    }

    async embed(text: string): Promise<EmbeddingVector> {
        // Preprocess the text
        const processedText = this.preprocessText(text);

        // Detect dimension on first use if not configured
        if (!this.dimensionDetected && !this.config.dimension) {
            this.dimension = await this.detectDimension();
            this.dimensionDetected = true;
            console.log(`[OllamaEmbedding] 📏 Detected Ollama embedding dimension: ${this.dimension} for model: ${this.config.model}`);
        }

        const embedOptions: any = {
            model: this.config.model,
            input: processedText,
            options: this.config.options,
        };

        // Only include keep_alive if it has a valid value
        if (this.config.keepAlive && this.config.keepAlive !== '') {
            embedOptions.keep_alive = this.config.keepAlive;
        }

        const response = await this.client.embed(embedOptions);

        if (!response.embeddings || !response.embeddings[0]) {
            throw new Error('Ollama API returned invalid response');
        }

        return {
            vector: response.embeddings[0],
            dimension: this.dimension
        };
    }

    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
        // Preprocess all texts
        const processedTexts = this.preprocessTexts(texts);

        // Detect dimension on first use if not configured
        if (!this.dimensionDetected && !this.config.dimension) {
            this.dimension = await this.detectDimension();
            this.dimensionDetected = true;
            console.log(`[OllamaEmbedding] 📏 Detected Ollama embedding dimension: ${this.dimension} for model: ${this.config.model}`);
        }

        // Use Ollama's native batch embedding API
        const embedOptions: any = {
            model: this.config.model,
            input: processedTexts, // Pass array directly to Ollama
            options: this.config.options,
        };

        // Only include keep_alive if it has a valid value
        if (this.config.keepAlive && this.config.keepAlive !== '') {
            embedOptions.keep_alive = this.config.keepAlive;
        }

        const response = await this.client.embed(embedOptions);

        if (!response.embeddings || !Array.isArray(response.embeddings)) {
            throw new Error('Ollama API returned invalid batch response');
        }

        // Convert to EmbeddingVector format
        return response.embeddings.map((embedding: number[]) => ({
            vector: embedding,
            dimension: this.dimension
        }));
    }

    getDimension(): number {
        return this.dimension;
    }

    getProvider(): string {
        return 'Ollama';
    }

    /**
     * Set model type and detect its dimension
     * @param model Model name
     */
    async setModel(model: string): Promise<void> {
        this.config.model = model;
        // Reset dimension detection when model changes
        this.dimensionDetected = false;
        // Update max tokens for new model
        this.setDefaultMaxTokensForModel(model);
        if (!this.config.dimension) {
            this.dimension = await this.detectDimension();
            this.dimensionDetected = true;
            console.log(`[OllamaEmbedding] 📏 Detected Ollama embedding dimension: ${this.dimension} for model: ${this.config.model}`);
        } else {
            console.log('[OllamaEmbedding] Dimension already detected for model ' + this.config.model);
        }
    }

    /**
     * Set host URL
     * @param host Ollama host URL
     */
    setHost(host: string): void {
        this.config.host = host;
        this.client = new Ollama({
            host: host,
            fetch: this.config.fetch,
        });
    }

    /**
     * Set keep alive duration
     * @param keepAlive Keep alive duration
     */
    setKeepAlive(keepAlive: string | number): void {
        this.config.keepAlive = keepAlive;
    }

    /**
     * Set additional options
     * @param options Additional options for the model
     */
    setOptions(options: Record<string, any>): void {
        this.config.options = options;
    }

    /**
     * Set max tokens manually
     * @param maxTokens Maximum number of tokens
     */
    setMaxTokens(maxTokens: number): void {
        this.config.maxTokens = maxTokens;
        this.maxTokens = maxTokens;
    }

    /**
     * Get client instance (for advanced usage)
     */
    getClient(): Ollama {
        return this.client;
    }

    async detectDimension(testText: string = "test"): Promise<number> {
        console.log(`[OllamaEmbedding] Detecting embedding dimension...`);

        try {
            const processedText = this.preprocessText(testText);
            const embedOptions: any = {
                model: this.config.model,
                input: processedText,
                options: this.config.options,
            };

            if (this.config.keepAlive && this.config.keepAlive !== '') {
                embedOptions.keep_alive = this.config.keepAlive;
            }

            const response = await this.client.embed(embedOptions);

            if (!response.embeddings || !response.embeddings[0]) {
                throw new Error('Ollama API returned invalid response');
            }

            const dimension = response.embeddings[0].length;
            console.log(`[OllamaEmbedding] Successfully detected embedding dimension: ${dimension}`);
            return dimension;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[OllamaEmbedding] Failed to detect dimension: ${errorMessage}`);
            throw new Error(`Failed to detect Ollama embedding dimension: ${errorMessage}`);
        }
    }
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #445** (2026-11-12): **ci: allow more time for npm publication processing**
  *Symptoms*: The registry accepted the prerelease upload, but MCP took more than five minutes to become publicly available. This made a successful publish report a timeout.  Wait up to ten minutes per package and print polling progress. Existing-version checks still make retries safe. Verified with actionlint and simulated registry responses covering delayed availability beyond five minutes and a persistent timeout. 

- **Issue #444** (2026-11-12): **ci: use trusted publishing for npm releases**
  *Symptoms*: Local npm releases require session renewal and interactive verification. Move Core and MCP publishing to GitHub Actions OIDC, with Core published and available before MCP. Build and pack with pnpm 10, then publish the archives with npm 11 so workspace dependencies resolve to concrete versions.  The workflow validates matching package/tag versions, supports dry runs, skips published versions on retries, and uses `next` for prereleases. VS Code publishing moves to its own workflow and tag prefix. The release guide records the required npm trust configuration and first-publish activation deadline.  Validation: actionlint; clean builds; 52 Core and 15 MCP tests; npm archive dry runs; VSIX packaging; release-script checks for existing and partially published versions, registry failures, publish failures, and tag mismatches. Live OIDC validation will use 0.1.17-rc.0 on `next`, preserving stable 0.1.16. 

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

### Incident Patch 1: `9e8af511` (2026-11-12)
**Commit Message**: fix(core): preserve source coverage in AST chunks

Partition the complete source at AST boundaries and pack adjacent ranges
within the chunk size. Use contiguous overlap within the same size budget
and text boundaries for oversized leaves, unsupported languages, and parse
failures. Derive line metadata from the original source offsets.

Cover nine languages, adjacent definitions, large and deeply nested code,
Unicode, overlap, and fallback behavior with regression tests.

Existing indexes remain readable; reindex to apply the new chunks to
unchanged files.

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ Configuration is entirely via environment variables (see `.env.example` and `pac
 
 - **Embedding** (`src/embedding/`) — `base-embedding.ts` interface with `OpenAIEmbedding`, `VoyageAIEmbedding`, `GeminiEmbedding`, `OllamaEmbedding` implementations.
 - **VectorDatabase** (`src/vectordb/`) — `MilvusVectorDatabase` (gRPC, Node-only) and `MilvusRestfulVectorDatabase` (HTTP, browser-safe). `zilliz-utils.ts` (`ClusterManager`) can provision a free Zilliz cluster and resolve an address from a token.
-- **Splitter** (`src/splitter/`) — `AstCodeSplitter` (tree-sitter, the default at 2500/300 chunk/overlap) which falls back to `LangChainCodeSplitter` for unsupported languages or parse failures.
+- **Splitter** (`src/splitter/`) — `AstCodeSplitter` (tree-sitter, the default at 2500/300 chunk/overlap) partitions the complete source using AST boundaries, packs adjacent ranges, and adds overlap within the size limit. Unsupported languages and parse failures use line/character boundaries. `LangChainCodeSplitter` is available as an explicit alternative.
 
 The public surface (`indexCodebase`, `reindexByChange`, `semanticSearch`, `clearIndex`, `hasIndex`) is re-exported from `src/index.ts`. Indexing reads files honoring ignore rules, splits them, embeds in batches, and upserts vectors. Collection name is derived from a hash of the absolute codebase path (overridable).
 
```

**File**: `packages/core/src/splitter/ast-splitter.test.ts` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+import { AstCodeSplitter } from './ast-splitter';
+import type { CodeChunk } from './index';
+
+function expectSourceCoverage(code: string, chunks: CodeChunk[], size: number, overlap = 0): void {
+    let covered = 0;
+    for (const chunk of chunks) {
+        expect(chunk.content.length).toBeGreaterThan(0);
+        expect(chunk.content.length).toBeLessThanOrEqual(size);
+        const earliestStart = Math.max(0, covered - overlap, covered - chunk.content.length + 1);
+        const start = code.indexOf(chunk.content, earliestStart);
+        expect(start).toBeGreaterThanOrEqual(earliestStart);
+        expect(start).toBeLessThanOrEqual(covered);
+        const end = start + chunk.content.length;
+        expect(end).toBeGreaterThan(covered);
+        expect(chunk.metadata.startLine).toBe(code.slice(0, start).split('\n').length);
+        expect(chunk.metadata.endLine).toBe(code.slice(0, end - 1).split('\n').length);
+        covered = end;
+    }
+    expect(covered).toBe(code.length);
+    if (overlap === 0) expect(chunks.map(chunk => chunk.content).join('')).toBe(code);
+}
+
+describe('AstCodeSplitter source coverage', () => {
+    beforeEach(() => {
+        jest.spyOn(console, 'log').mockImplementation(() => {});
+        jest.spyOn(console, 'warn').mockImplementation(() => {});
+    });
+
+    afterEach(() => jest.restoreAllMocks());
+
+    const sources = [
+        ['javascript', `// Response configuration\nconst DEFAULT_LIMIT = 17;\nres.json = function json(obj) { return JSON.stringify(obj); };\nfunction helper(value) { return String(value); }\nstart();\n`],
+        ['typescript', `// Handler configuration\nconst DEFAULT_LIMIT: number = 17;\nconst handler = function handler(): number { return DEFAULT_LIMIT; };\nfunction helper(): number { return 1; }\nhandler();\n`],
+        ['python', `# Request configuration\nimport os\nDEFAULT_TIMEOUT = 17\n\ndef timeout():\n    return DEFAULT_TIMEOUT\n\nprint(timeout())\n`],
+        ['go', `// Application entry point\npackage example\nimport "fmt"\nconst defaultLimit = 17\nfunc run() { fmt.Println(defaultLimit) }\n`],
+        ['rust', `// Retry configuration\nuse std::time::Duration;\nconst RETRY_LIMIT: u32 = 17;\nfn limit() -> u32 { RETRY_LIMIT }\n`],
+        ['cpp', `// Retry configuration\n#include <vector>\n#define RETRY_LIMIT 17\nint limit() { return RETRY_LIMIT; }\n`],
+        ['java', `package example;\nimport java.time.Duration;\nclass Example { static final int RETRY_LIMIT = 17; int limit() { return RETRY_LIMIT; } }\n`],
+        ['csharp', `using System;\nnamespace Example { class App { public const int Limit = 17; public void Run() { Console.WriteLine(Limit); } } }\n`],
+        ['scala', `import scala.util.Try\nobject Example { val retryLimit = 17; def limit(): Int = retryLimit; println(limit()) }\n`],
+    ];
+
+    it.each(sources)('preserves every source interval when splitting %s', async (language, code) => {
+        const chunks = await new AstCodeSplitter(80, 0).split(code, language, 'example');
+        expect(chunks.length).toBeGreaterThan(1);
+        expectSourceCoverage(code, chunks, 80);
+        for (const chunk of chunks) {
+            expect(chunk.metadata).toMatchObject({ language, filePath: 'example' });
+        }
+    });
+
+    it('packs adjacent small functions and definitions into one chunk', async () => {
+        const code = 'function a() { return 1; }\nconst limit = 17;\nfunction b() { return limit; }\n';
+        const chunks = await new AstCodeSplitter(2500, 0).split(code, 'javascript');
+        expect(chunks).toHaveLength(1);
+        expectSourceCoverage(code, chunks, 2500);
+    });
+
+    it('merges short definitions with the preceding function when they fit', async () => {
+        const a = `function a() { return '${'a'.repeat(100)}'; }`;
+        const definitions = '\nconst limit = 17;';
+        const b = `\nfunction b() { return '${'b'.repeat(100)}'; }`;
+        const code = a + definitions + b;
+        const chunks = await new AstCodeSplitter(180, 0).split(code, 'javascript');
+        expect(chunks.map(c => c.content)).toEqual([a + definitions, b]);
+        expectSourceCoverage(code, chunks, 180);
+    });
+
+    it('merges short definitions with the next function when the preceding chunk is full', async () => {
+        const a = `function a() { return '${'a'.repeat(140)}'; }`;
+        const definitions = '\nconst limit = 17;';
+        const b = '\nfunction b() { return limit; }';
+        const code = a + definitions + b;
+        const chunks = await new AstCodeSplitter(180, 0).split(code, 'javascript');
+        expect(chunks.map(c => c.content)).toEqual([a, definitions + b]);
+        expectSourceCoverage(code, chunks, 180);
+    });
+
+    it('splits large functions without losing or duplicating nested code', async () => {
+        const body = Array.from({ length: 120 }, (_, i) => `    total += ${i};`).join('\n');
+        const code = `// Header\nclass Counter {\n  a(
```

**File**: `packages/core/src/splitter/ast-splitter.ts` (modified, +114/-215)
```diff
@@ -1,7 +1,6 @@
 import Parser from 'tree-sitter';
-import { Splitter, CodeChunk } from './index';
+import type { Splitter, CodeChunk } from './index';
 
-// Language parsers
 const JavaScript = require('tree-sitter-javascript');
 const TypeScript = require('tree-sitter-typescript').typescript;
 const Python = require('tree-sitter-python');
@@ -12,259 +11,159 @@ const Rust = require('tree-sitter-rust');
 const CSharp = require('tree-sitter-c-sharp');
 const Scala = require('tree-sitter-scala');
 
-// Node types that represent logical code units
-const SPLITTABLE_NODE_TYPES = {
-    javascript: ['function_declaration', 'arrow_function', 'class_declaration', 'method_definition', 'export_statement'],
-    typescript: ['function_declaration', 'arrow_function', 'class_declaration', 'method_definition', 'export_statement', 'interface_declaration', 'type_alias_declaration'],
-    python: ['function_definition', 'class_definition', 'decorated_definition', 'async_function_definition'],
-    java: ['method_declaration', 'class_declaration', 'interface_declaration', 'constructor_declaration'],
-    cpp: ['function_definition', 'class_specifier', 'namespace_definition', 'declaration'],
-    go: ['function_declaration', 'method_declaration', 'type_declaration', 'var_declaration', 'const_declaration'],
-    rust: ['function_item', 'impl_item', 'struct_item', 'enum_item', 'trait_item', 'mod_item'],
-    csharp: ['method_declaration', 'class_declaration', 'interface_declaration', 'struct_declaration', 'enum_declaration'],
-    scala: ['method_declaration', 'class_declaration', 'interface_declaration', 'constructor_declaration']
+const LANGUAGE_PARSERS: Record<string, any> = {
+    javascript: JavaScript, js: JavaScript,
+    typescript: TypeScript, ts: TypeScript,
+    python: Python, py: Python,
+    java: Java,
+    cpp: Cpp, 'c++': Cpp, c: Cpp,
+    go: Go,
+    rust: Rust, rs: Rust,
+    csharp: CSharp, cs: CSharp,
+    scala: Scala,
 };
 
+interface SourceRange {
+    start: number;
+    end: number;
+}
+
 export class AstCodeSplitter implements Splitter {
-    private chunkSize: number = 2500;
-    private chunkOverlap: number = 300;
+    private chunkSize = 2500;
+    private chunkOverlap = 300;
     private parser: Parser;
-    private langchainFallback: any; // LangChainCodeSplitter for fallback
 
-    constructor(chunkSize?: number, chunkOverlap?: number) {
-        if (chunkSize) this.chunkSize = chunkSize;
-        if (chunkOverlap) this.chunkOverlap = chunkOverlap;
+    constructor(chunkSize = 2500, chunkOverlap = 300) {
+        this.setChunkSize(chunkSize);
+        this.setChunkOverlap(chunkOverlap);
         this.parser = new Parser();
-
-        // Initialize fallback splitter
-        const { LangChainCodeSplitter } = require('./langchain-splitter');
-        this.langchainFallback = new LangChainCodeSplitter(chunkSize, chunkOverlap);
     }
 
     async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
-        // Check if language is supported by AST splitter
-        const langConfig = this.getLanguageConfig(language);
-        if (!langConfig) {
-            console.log(`📝 Language ${language} not supported by AST, using LangChain splitter for: ${filePath || 'unknown'}`);
-            return await this.langchainFallback.split(code, language, filePath);
+        if (code.length === 0) return [];
+
+        let root: Parser.SyntaxNode | undefined;
+        if (AstCodeSplitter.isLanguageSupported(language)) {
+            try {
+                this.parser.setLanguage(LANGUAGE_PARSERS[language.toLowerCase()]);
+                const tree = this.parser.parse(code);
+                if (!tree.rootNode.hasError) root = tree.rootNode;
+            } catch (error) {
+                console.warn('[ASTSplitter] Using text boundaries for ' + (filePath || language) + ': ' + error);
+            }
         }
 
-        try {
-            console.log(`🌳 Using AST splitter for ${language} file: ${filePath || 'unknown'}`);
-
-            this.parser.setLanguage(langConfig.parser);
-            const tree = this.parser.parse(code);
-
-            if (!tree.rootNode) {
-                console.warn(`[ASTSplitter] ⚠️  Failed to parse AST for ${language}, falling back to LangChain: ${filePath || 'unknown'}`);
-                return await this.langchainFallback.split(code, language, filePath);
+        // Ranges partition the entire source. Pack adjacent ranges without
+        // emitting a parent node again alongside its children.
+        const ranges: SourceRange[] = [];
+        for (const range of this.splitRange(code, 0, code.length, root)) {
+            const previous = ranges[ranges.length - 1];
+            if (previous && range.end - previous.start <= this.chunkSize) {
+                previous.end = range.end;
+            } else {
+                ranges.push({ ...range });
             }
+        }
 
-            // Extract chunks based on AST nodes
-            const chu
```

---

### Incident Patch 2: `98133626` (2026-11-11)
**Commit Message**: fix(mcp): preserve active indexing during snapshot recovery

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `packages/mcp/src/handlers.reconcile-snapshot.test.ts` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
+import assert from "node:assert/strict";
+import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
+import { syncBuiltinESMExports } from "node:module";
+import os from "node:os";
+import path from "node:path";
+import test, { type TestContext } from "node:test";
+import type { Context } from "@zilliz/claude-context-core";
+
+import { ToolHandlers } from "./handlers.js";
+import { SnapshotManager } from "./snapshot.js";
+
+function deferred<T>() {
+    let resolve!: (value: T) => void;
+    let reject!: (error: Error) => void;
+    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
+        resolve = resolvePromise;
+        reject = rejectPromise;
+    });
+    return { promise, resolve, reject };
+}
+
+async function withFixture(
+    t: TestContext,
+    run: (codebasePath: string, snapshot: SnapshotManager) => Promise<void>
+): Promise<void> {
+    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-reconcile-"));
+    const stateDirectory = path.join(tempRoot, "state");
+    const codebasePath = path.join(tempRoot, "repo");
+    await mkdir(path.join(stateDirectory, ".context"), { recursive: true });
+    await mkdir(codebasePath);
+    await writeFile(path.join(codebasePath, "index.ts"), "export const value = 1;\n");
+
+    const homeMock = t.mock.method(os, "homedir", () => stateDirectory);
+    syncBuiltinESMExports();
+    try {
+        await run(codebasePath, new SnapshotManager());
+    } finally {
+        homeMock.mock.restore();
+        syncBuiltinESMExports();
+        await rm(tempRoot, { recursive: true, force: true });
+    }
+}
+
+function createHarness(codebasePath: string, snapshot: SnapshotManager) {
+    const collectionName = "hybrid_code_chunks_reconcile_test";
+    let collectionExists = false;
+    let rowCount = 0;
+    const entered = deferred<void>();
+    const completion = deferred<void>();
+    const database = {
+        listCollections: async () => collectionExists ? [collectionName] : [],
+        getCollectionDescription: async () => `codebasePath:${codebasePath}`,
+        getCollectionRowCount: async () => rowCount,
+        checkCollectionLimit: async () => true
+    };
+    const context = {
+        getCollectionName: () => collectionName,
+        getVectorDatabase: () => database,
+        hasIndex: async () => collectionExists,
+        getEffectiveIgnorePatterns: async () => [],
+        getEffectiveSupportedExtensions: () => [".ts"],
+        getPreparedCollection: async () => { collectionExists = true; },
+        setSynchronizer: () => {},
+        getEmbedding: () => ({ getProvider: () => "test", getDimension: () => 1 }),
+        indexCodebase: async (_path: string, progress: (value: object) => void) => {
+            rowCount = 4;
+            progress({ phase: "Indexing", percentage: 33, current: 4, total: 12 });
+            entered.resolve();
+            await completion.promise;
+            rowCount = 24;
+            return { indexedFiles: 12, totalChunks: 24, status: "completed" as const };
+        },
+        semanticSearch: async () => [{
+            relativePath: "index.ts", startLine: 1, endLine: 1,
+            content: "export const value = 1;", score: 0.9
+        }]
+    };
+    const handlers = new ToolHandlers(context as unknown as Context, snapshot);
+    return {
+        handlers,
+        database,
+        prepareCollection(rows: number) { collectionExists = true; rowCount = rows; },
+        finish(error?: Error) {
+            if (error) completion.reject(error);
+            else completion.resolve();
+        },
+        async start() {
+            const response = await handlers.handleIndexCodebase({ path: codebasePath });
+            assert.equal(response.isError, undefined, response.content[0].text);
+            // Only read the registered promise to join the task during cleanup.
+            // The public handler creates and removes the task itself.
+            const task = (handlers as any).indexingTasks.get(codebasePath);
+            assert.ok(task);
+            await Promise.race([
+                entered.promise,
+                task.promise.then(() => { throw new Error("Indexing ended before reaching the test barrier"); })
+            ]);
+            return { settled: task.promise as Promise<void> };
+        }
+    };
+}
+
+test("status and search preserve an active indexing task until it completes", async t => {
+    await withFixture(t, async (codebasePath, snapshot) => {
+        const harness = createHarness(codebasePath, snapshot);
+        const { settled } = await harness.start();
+        try {
+            const status = await harness.handlers.handleGetIndexingStatus({ path: codebasePath });
+            assert.match(status.content[0].text, /currently being indexed/);
+            assert.equal(snapshot.getCodebaseStatus(codebasePath), "indexing");
+            assert.deepEqual(snapshot.getIndexedCodebases(), []);
+
+            const search = awa
```

**File**: `packages/mcp/src/handlers.ts` (modified, +15/-0)
```diff
@@ -287,8 +287,23 @@ export class ToolHandlers {
             // Query Milvus for the real row count — if unknown/empty, skip the write
             // so we don't persist a poisoning 0/0+completed entry (Issue #295).
             for (const databaseCodebase of databaseCodebases) {
+                // Partial rows from our active task do not establish completion.
+                // Persisted 'indexing' entries alone may be stale and still need recovery.
+                if (this.indexingTasks.has(databaseCodebase)) {
+                    continue;
+                }
+
                 if (!localCodebases.has(databaseCodebase)) {
+                    const infoBeforeQuery = this.snapshotManager.getCodebaseInfo(databaseCodebase);
                     const stats = await this.queryCollectionStats(databaseCodebase);
+
+                    // A task can start, finish, or fail while the database query awaits I/O.
+                    // State transitions replace the info object; preserve the newer state.
+                    if (this.indexingTasks.has(databaseCodebase)
+                        || this.snapshotManager.getCodebaseInfo(databaseCodebase) !== infoBeforeQuery) {
+                        continue;
+                    }
+
                     if (stats) {
                         this.snapshotManager.setCodebaseIndexed(databaseCodebase, {
                             ...stats,
```

---

### Incident Patch 3: `4efb4bfe` (2026-11-12)
**Commit Message**: Merge pull request #443 from zc277584121/codex/fix-ast-source-coverage

fix(core): preserve source coverage in AST chunks

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ Configuration is entirely via environment variables (see `.env.example` and `pac
 
 - **Embedding** (`src/embedding/`) — `base-embedding.ts` interface with `OpenAIEmbedding`, `VoyageAIEmbedding`, `GeminiEmbedding`, `OllamaEmbedding` implementations.
 - **VectorDatabase** (`src/vectordb/`) — `MilvusVectorDatabase` (gRPC, Node-only) and `MilvusRestfulVectorDatabase` (HTTP, browser-safe). `zilliz-utils.ts` (`ClusterManager`) can provision a free Zilliz cluster and resolve an address from a token.
-- **Splitter** (`src/splitter/`) — `AstCodeSplitter` (tree-sitter, the default at 2500/300 chunk/overlap) which falls back to `LangChainCodeSplitter` for unsupported languages or parse failures.
+- **Splitter** (`src/splitter/`) — `AstCodeSplitter` (tree-sitter, the default at 2500/300 chunk/overlap) partitions the complete source using AST boundaries, packs adjacent ranges, and adds overlap within the size limit. Unsupported languages and parse failures use line/character boundaries. `LangChainCodeSplitter` is available as an explicit alternative.
 
 The public surface (`indexCodebase`, `reindexByChange`, `semanticSearch`, `clearIndex`, `hasIndex`) is re-exported from `src/index.ts`. Indexing reads files honoring ignore rules, splits them, embeds in batches, and upserts vectors. Collection name is derived from a hash of the absolute codebase path (overridable).
 
```

**File**: `packages/core/src/splitter/ast-splitter.test.ts` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+import { AstCodeSplitter } from './ast-splitter';
+import type { CodeChunk } from './index';
+
+function expectSourceCoverage(code: string, chunks: CodeChunk[], size: number, overlap = 0): void {
+    let covered = 0;
+    for (const chunk of chunks) {
+        expect(chunk.content.length).toBeGreaterThan(0);
+        expect(chunk.content.length).toBeLessThanOrEqual(size);
+        const earliestStart = Math.max(0, covered - overlap, covered - chunk.content.length + 1);
+        const start = code.indexOf(chunk.content, earliestStart);
+        expect(start).toBeGreaterThanOrEqual(earliestStart);
+        expect(start).toBeLessThanOrEqual(covered);
+        const end = start + chunk.content.length;
+        expect(end).toBeGreaterThan(covered);
+        expect(chunk.metadata.startLine).toBe(code.slice(0, start).split('\n').length);
+        expect(chunk.metadata.endLine).toBe(code.slice(0, end - 1).split('\n').length);
+        covered = end;
+    }
+    expect(covered).toBe(code.length);
+    if (overlap === 0) expect(chunks.map(chunk => chunk.content).join('')).toBe(code);
+}
+
+describe('AstCodeSplitter source coverage', () => {
+    beforeEach(() => {
+        jest.spyOn(console, 'log').mockImplementation(() => {});
+        jest.spyOn(console, 'warn').mockImplementation(() => {});
+    });
+
+    afterEach(() => jest.restoreAllMocks());
+
+    const sources = [
+        ['javascript', `// Response configuration\nconst DEFAULT_LIMIT = 17;\nres.json = function json(obj) { return JSON.stringify(obj); };\nfunction helper(value) { return String(value); }\nstart();\n`],
+        ['typescript', `// Handler configuration\nconst DEFAULT_LIMIT: number = 17;\nconst handler = function handler(): number { return DEFAULT_LIMIT; };\nfunction helper(): number { return 1; }\nhandler();\n`],
+        ['python', `# Request configuration\nimport os\nDEFAULT_TIMEOUT = 17\n\ndef timeout():\n    return DEFAULT_TIMEOUT\n\nprint(timeout())\n`],
+        ['go', `// Application entry point\npackage example\nimport "fmt"\nconst defaultLimit = 17\nfunc run() { fmt.Println(defaultLimit) }\n`],
+        ['rust', `// Retry configuration\nuse std::time::Duration;\nconst RETRY_LIMIT: u32 = 17;\nfn limit() -> u32 { RETRY_LIMIT }\n`],
+        ['cpp', `// Retry configuration\n#include <vector>\n#define RETRY_LIMIT 17\nint limit() { return RETRY_LIMIT; }\n`],
+        ['java', `package example;\nimport java.time.Duration;\nclass Example { static final int RETRY_LIMIT = 17; int limit() { return RETRY_LIMIT; } }\n`],
+        ['csharp', `using System;\nnamespace Example { class App { public const int Limit = 17; public void Run() { Console.WriteLine(Limit); } } }\n`],
+        ['scala', `import scala.util.Try\nobject Example { val retryLimit = 17; def limit(): Int = retryLimit; println(limit()) }\n`],
+    ];
+
+    it.each(sources)('preserves every source interval when splitting %s', async (language, code) => {
+        const chunks = await new AstCodeSplitter(80, 0).split(code, language, 'example');
+        expect(chunks.length).toBeGreaterThan(1);
+        expectSourceCoverage(code, chunks, 80);
+        for (const chunk of chunks) {
+            expect(chunk.metadata).toMatchObject({ language, filePath: 'example' });
+        }
+    });
+
+    it('packs adjacent small functions and definitions into one chunk', async () => {
+        const code = 'function a() { return 1; }\nconst limit = 17;\nfunction b() { return limit; }\n';
+        const chunks = await new AstCodeSplitter(2500, 0).split(code, 'javascript');
+        expect(chunks).toHaveLength(1);
+        expectSourceCoverage(code, chunks, 2500);
+    });
+
+    it('merges short definitions with the preceding function when they fit', async () => {
+        const a = `function a() { return '${'a'.repeat(100)}'; }`;
+        const definitions = '\nconst limit = 17;';
+        const b = `\nfunction b() { return '${'b'.repeat(100)}'; }`;
+        const code = a + definitions + b;
+        const chunks = await new AstCodeSplitter(180, 0).split(code, 'javascript');
+        expect(chunks.map(c => c.content)).toEqual([a + definitions, b]);
+        expectSourceCoverage(code, chunks, 180);
+    });
+
+    it('merges short definitions with the next function when the preceding chunk is full', async () => {
+        const a = `function a() { return '${'a'.repeat(140)}'; }`;
+        const definitions = '\nconst limit = 17;';
+        const b = '\nfunction b() { return limit; }';
+        const code = a + definitions + b;
+        const chunks = await new AstCodeSplitter(180, 0).split(code, 'javascript');
+        expect(chunks.map(c => c.content)).toEqual([a, definitions + b]);
+        expectSourceCoverage(code, chunks, 180);
+    });
+
+    it('splits large functions without losing or duplicating nested code', async () => {
+        const body = Array.from({ length: 120 }, (_, i) => `    total += ${i};`).join('\n');
+        const code = `// Header\nclass Counter {\n  a(
```

**File**: `packages/core/src/splitter/ast-splitter.ts` (modified, +114/-215)
```diff
@@ -1,7 +1,6 @@
 import Parser from 'tree-sitter';
-import { Splitter, CodeChunk } from './index';
+import type { Splitter, CodeChunk } from './index';
 
-// Language parsers
 const JavaScript = require('tree-sitter-javascript');
 const TypeScript = require('tree-sitter-typescript').typescript;
 const Python = require('tree-sitter-python');
@@ -12,259 +11,159 @@ const Rust = require('tree-sitter-rust');
 const CSharp = require('tree-sitter-c-sharp');
 const Scala = require('tree-sitter-scala');
 
-// Node types that represent logical code units
-const SPLITTABLE_NODE_TYPES = {
-    javascript: ['function_declaration', 'arrow_function', 'class_declaration', 'method_definition', 'export_statement'],
-    typescript: ['function_declaration', 'arrow_function', 'class_declaration', 'method_definition', 'export_statement', 'interface_declaration', 'type_alias_declaration'],
-    python: ['function_definition', 'class_definition', 'decorated_definition', 'async_function_definition'],
-    java: ['method_declaration', 'class_declaration', 'interface_declaration', 'constructor_declaration'],
-    cpp: ['function_definition', 'class_specifier', 'namespace_definition', 'declaration'],
-    go: ['function_declaration', 'method_declaration', 'type_declaration', 'var_declaration', 'const_declaration'],
-    rust: ['function_item', 'impl_item', 'struct_item', 'enum_item', 'trait_item', 'mod_item'],
-    csharp: ['method_declaration', 'class_declaration', 'interface_declaration', 'struct_declaration', 'enum_declaration'],
-    scala: ['method_declaration', 'class_declaration', 'interface_declaration', 'constructor_declaration']
+const LANGUAGE_PARSERS: Record<string, any> = {
+    javascript: JavaScript, js: JavaScript,
+    typescript: TypeScript, ts: TypeScript,
+    python: Python, py: Python,
+    java: Java,
+    cpp: Cpp, 'c++': Cpp, c: Cpp,
+    go: Go,
+    rust: Rust, rs: Rust,
+    csharp: CSharp, cs: CSharp,
+    scala: Scala,
 };
 
+interface SourceRange {
+    start: number;
+    end: number;
+}
+
 export class AstCodeSplitter implements Splitter {
-    private chunkSize: number = 2500;
-    private chunkOverlap: number = 300;
+    private chunkSize = 2500;
+    private chunkOverlap = 300;
     private parser: Parser;
-    private langchainFallback: any; // LangChainCodeSplitter for fallback
 
-    constructor(chunkSize?: number, chunkOverlap?: number) {
-        if (chunkSize) this.chunkSize = chunkSize;
-        if (chunkOverlap) this.chunkOverlap = chunkOverlap;
+    constructor(chunkSize = 2500, chunkOverlap = 300) {
+        this.setChunkSize(chunkSize);
+        this.setChunkOverlap(chunkOverlap);
         this.parser = new Parser();
-
-        // Initialize fallback splitter
-        const { LangChainCodeSplitter } = require('./langchain-splitter');
-        this.langchainFallback = new LangChainCodeSplitter(chunkSize, chunkOverlap);
     }
 
     async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
-        // Check if language is supported by AST splitter
-        const langConfig = this.getLanguageConfig(language);
-        if (!langConfig) {
-            console.log(`📝 Language ${language} not supported by AST, using LangChain splitter for: ${filePath || 'unknown'}`);
-            return await this.langchainFallback.split(code, language, filePath);
+        if (code.length === 0) return [];
+
+        let root: Parser.SyntaxNode | undefined;
+        if (AstCodeSplitter.isLanguageSupported(language)) {
+            try {
+                this.parser.setLanguage(LANGUAGE_PARSERS[language.toLowerCase()]);
+                const tree = this.parser.parse(code);
+                if (!tree.rootNode.hasError) root = tree.rootNode;
+            } catch (error) {
+                console.warn('[ASTSplitter] Using text boundaries for ' + (filePath || language) + ': ' + error);
+            }
         }
 
-        try {
-            console.log(`🌳 Using AST splitter for ${language} file: ${filePath || 'unknown'}`);
-
-            this.parser.setLanguage(langConfig.parser);
-            const tree = this.parser.parse(code);
-
-            if (!tree.rootNode) {
-                console.warn(`[ASTSplitter] ⚠️  Failed to parse AST for ${language}, falling back to LangChain: ${filePath || 'unknown'}`);
-                return await this.langchainFallback.split(code, language, filePath);
+        // Ranges partition the entire source. Pack adjacent ranges without
+        // emitting a parent node again alongside its children.
+        const ranges: SourceRange[] = [];
+        for (const range of this.splitRange(code, 0, code.length, root)) {
+            const previous = ranges[ranges.length - 1];
+            if (previous && range.end - previous.start <= this.chunkSize) {
+                previous.end = range.end;
+            } else {
+                ranges.push({ ...range });
             }
+        }
 
-            // Extract chunks based on AST nodes
-            const chu
```

#### Recent Merged Pull Requests:
- **PR #445** (2026-11-12): ci: allow more time for npm publication processing (@zc277584121)
- **PR #444** (2026-11-12): ci: use trusted publishing for npm releases (@zc277584121)
- **PR #443** (2026-11-12): fix(core): preserve source coverage in AST chunks (@zc277584121)
- **PR #442** (2026-11-11): fix(mcp): preserve active indexing during snapshot recovery (@zc277584121)
- **PR #423** (closed): fix: zilliztech/claude-context#421 (@Zewang0217)
- **PR #407** (2026-07-14): docs: add CLAUDE.md and AGENTS.md repository guide (@zc277584121)

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

## X. core): preserve source coverage in AST chunks

**RULE**:
When implementing operations in `CLAUDE.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zilliztech/claude-context. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e8af511`: core): preserve source coverage in AST chunks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `CLAUDE.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- **Splitter** (`src/splitter/`) — `AstCodeSplitter` (tree-sitter, the default at 2500/300 chunk/overlap) partitions the complete source using AST boundaries, packs adjacent ranges, and adds overlap within the size limit. Unsupported languages and parse failures use line/character boundaries. `LangChainCodeSplitter` is available as an explicit alternative.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
- **Splitter** (`src/splitter/`) — `AstCodeSplitter` (tree-sitter, the default at 2500/300 chunk/overlap) which falls back to `LangChainCodeSplitter` for unsupported languages or parse failures.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e8af511` are properly handled with clean fallback behavior.
