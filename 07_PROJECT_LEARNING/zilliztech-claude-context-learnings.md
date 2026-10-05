# Forensic Learning Record (Deep Inspection): zilliztech/claude-context

> **Canonical Artifact**: `07_PROJECT_LEARNING/zilliztech-claude-context-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zilliztech/claude-context](https://github.com/zilliztech/claude-context))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:54:21.839Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zilliztech/claude-context`
- **Description**: Code search MCP for Claude Code. Make entire codebase the context for any coding agent.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12586 stars

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

### Core Architecture Module: `packages/core/src/embedding/openai-embedding.ts`
```
import OpenAI from 'openai';
import { Embedding, EmbeddingVector } from './base-embedding';

export interface OpenAIEmbeddingConfig {
    model: string;
    apiKey: string;
    baseURL?: string; // OpenAI supports custom baseURL
}

export class OpenAIEmbedding extends Embedding {
    private client: OpenAI;
    private config: OpenAIEmbeddingConfig;
    private dimension: number = 1536; // Default dimension for text-embedding-3-small
    protected maxTokens: number = 8192; // Maximum tokens for OpenAI embedding models

    constructor(config: OpenAIEmbeddingConfig) {
        super();
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
    }

    async detectDimension(testText: string = "test"): Promise<number> {
        const model = this.config.model || 'text-embedding-3-small';
        const knownModels = OpenAIEmbedding.getSupportedModels();

        // Use known dimension for standard models
        if (knownModels[model]) {
            return knownModels[model].dimension;
        }

        // For custom models, make API call to detect dimension
        try {
            const processedText = this.preprocessText(testText);
            const response = await this.client.embeddings.create({
                model: model,
                input: processedText,
                encoding_format: 'float',
            });
            return response.data[0].embedding.length;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Re-throw authentication errors
            if (errorMessage.includes('API key') || errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
                throw new Error(`Failed to detect dimension for model ${model}: ${errorMessage}`);
            }

            // For other errors, throw exception instead of using fallback
            throw new Error(`Failed to detect dimension for model ${model}: ${errorMessage}`);
        }
    }

    async embed(text: string): Promise<EmbeddingVector> {
        const processedText = this.preprocessText(text);
        const model = this.config.model || 'text-embedding-3-small';

        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model] && this.dimension !== knownModels[model].dimension) {
            this.dimension = knownModels[model].dimension;
        } else if (!knownModels[model]) {
            this.dimension = await this.detectDimension();
        }

        try {
            const response = await this.client.embeddings.create({
                model: model,
                input: processedText,
                encoding_format: 'float',
            });

            // Update dimension from actual response
            this.dimension = response.data[0].embedding.length;

            return {
                vector: response.data[0].embedding,
                dimension: this.dimension
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to generate OpenAI embedding: ${errorMessage}`);
        }
    }

    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
        const processedTexts = this.preprocessTexts(texts);
        const model = this.config.model || 'text-embedding-3-small';

        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model] && this.dimension !== knownModels[model].dimension) {
            this.dimension = knownModels[model].dimension;
        } else if (!knownModels[model]) {
            this.dimension = await this.detectDimension();
        }

        try {
            const response = await this.client.embeddings.create({
                model: model,
                input: processedTexts,
                encoding_format: 'float',
            });

            this.dimension = response.data[0].embedding.length;

            return response.data.map((item) => ({
                vector: item.embedding,
                dimension: this.dimension
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to generate OpenAI batch embeddings: ${errorMessage}`);
        }
    }

    getDimension(): number {
        // For custom models, we need to detect the dimension first
        const model = this.config.model || 'text-embedding-3-small';
        const knownModels = OpenAIEmbedding.getSupportedModels();

        // If it's a known model, return its known dimension
        if (knownModels[model]) {
            return knownModels[model].dimension;
        }

        // For custom models, return the current dimension
        // Note: This may be incorrect until detectDimension() is called
        console.warn(`[OpenAIEmbedding] ⚠️ getDimension() called for custom model '${model}' - returning ${this.dimension}. Call detectDimension() first for accurate dimension.`);
        return this.dimension;
    }

    getProvider(): string {
        return 'OpenAI';
    }

    /**
     * Set model type
     * @param model Model name
     */
    async setModel(model: string): Promise<void> {
        this.config.model = model;
        const knownModels = OpenAIEmbedding.getSupportedModels();
        if (knownModels[model]) {
            this.dimension = knownModels[model].dimension;
        } else {
            this.dimension = await this.detectDimension();
        }
    }

    /**
     * Get client instance (for advanced usage)
     */
    getClient(): OpenAI {
        return this.client;
    }

    /**
     * Get list of supported models
     */
    static getSupportedModels(): Record<string, { dimension: number; description: string }> {
        return {
            'text-embedding-3-small': {
                dimension: 1536,
                description: 'High performance and cost-effective embedding model (recommended)'
            },
            'text-embedding-3-large': {
                dimension: 3072,
                description: 'Highest performance embedding model with larger dimensions'
            },
            'text-embedding-ada-002': {
                dimension: 1536,
                description: 'Legacy model (use text-embedding-3-small instead)'
            }
        };
    }
} 
```

### Core Architecture Module: `packages/core/src/embedding/voyageai-embedding.ts`
```
import { VoyageAIClient } from 'voyageai';
import { Embedding, EmbeddingVector } from './base-embedding';

export interface VoyageAIEmbeddingConfig {
    model: string;
    apiKey: string;
}

export class VoyageAIEmbedding extends Embedding {
    private client: VoyageAIClient;
    private config: VoyageAIEmbeddingConfig;
    private dimension: number = 1024; // Default dimension for voyage-code-3
    private inputType: 'document' | 'query' = 'document';
    protected maxTokens: number = 32000; // Default max tokens

    constructor(config: VoyageAIEmbeddingConfig) {
        super();
        this.config = config;
        this.client = new VoyageAIClient({
            apiKey: config.apiKey,
        });

        // Set dimension and context length based on different models
        this.updateModelSettings(config.model || 'voyage-code-3');
    }

    private updateModelSettings(model: string): void {
        const supportedModels = VoyageAIEmbedding.getSupportedModels();
        const modelInfo = supportedModels[model];

        if (modelInfo) {
            if (typeof modelInfo.dimension === 'string') {
                // Parse default dimension from string like "1024 (default), 256, 512, 2048"
                const match = modelInfo.dimension.match(/^(\d+)/);
                this.dimension = match ? parseInt(match[1], 10) : 1024;
            } else {
                this.dimension = modelInfo.dimension;
            }
            // Set max tokens based on model's context length
            this.maxTokens = modelInfo.contextLength;
        } else {
            // Use default dimension and context length for unknown models
            this.dimension = 1024;
            this.maxTokens = 32000;
        }
    }

    async detectDimension(): Promise<number> {
        // VoyageAI doesn't need dynamic detection, return configured dimension
        return this.dimension;
    }

    async embed(text: string): Promise<EmbeddingVector> {
        const processedText = this.preprocessText(text);
        const model = this.config.model || 'voyage-code-3';

        const response = await this.client.embed({
            input: processedText,
            model: model,
            inputType: this.inputType,
        });

        if (!response.data || !response.data[0] || !response.data[0].embedding) {
            throw new Error('VoyageAI API returned invalid response');
        }

        return {
            vector: response.data[0].embedding,
            dimension: this.dimension
        };
    }

    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
        const processedTexts = this.preprocessTexts(texts);
        const model = this.config.model || 'voyage-code-3';

        const response = await this.client.embed({
            input: processedTexts,
            model: model,
            inputType: this.inputType,
        });

        if (!response.data) {
            throw new Error('VoyageAI API returned invalid response');
        }

        return response.data.map((item) => {
            if (!item.embedding) {
                throw new Error('VoyageAI API returned invalid embedding data');
            }
            return {
                vector: item.embedding,
                dimension: this.dimension
            };
        });
    }

    getDimension(): number {
        return this.dimension;
    }

    getProvider(): string {
        return 'VoyageAI';
    }

    /**
     * Set model type
     * @param model Model name
     */
    setModel(model: string): void {
        this.config.model = model;
        this.updateModelSettings(model);
    }

    /**
     * Set input type (VoyageAI specific feature)
     * @param inputType Input type: 'document' | 'query'
     */
    setInputType(inputType: 'document' | 'query'): void {
        this.inputType = inputType;
    }

    /**
     * Get client instance (for advanced usage)
     */
    getClient(): VoyageAIClient {
        return this.client;
    }

    /**
     * Get list of supported models
     */
    static getSupportedModels(): Record<string, { dimension: number | string; contextLength: number; description: string }> {
        return {
            // Voyage 4 series (January 2026)
            'voyage-4-large': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'Best general-purpose and multilingual retrieval quality (latest)'
            },
            'voyage-4': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'Optimized for general-purpose and multilingual retrieval quality'
            },
            'voyage-4-lite': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'Optimized for latency and cost'
            },
            'voyage-4-nano': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'Open-weight model, smallest and fastest'
            },
            // Voyage 3 series
            'voyage-3-large': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'The best general-purpose and multilingual retrieval quality'
            },
            'voyage-3.5': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'Optimized for general-purpose and multilingual retrieval quality'
            },
            'voyage-3.5-lite': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'Optimized for latency and cost'
            },
            'voyage-code-3': {
                dimension: '1024 (default), 256, 512, 2048',
                contextLength: 32000,
                description: 'Optimized for code retrieval (recommended for code)'
            },
            // Professional domain models
            'voyage-finance-2': {
                dimension: 1024,
                contextLength: 32000,
                description: 'Optimized for finance retrieval and RAG'
            },
            'voyage-law-2': {
                dimension: 1024,
                contextLength: 16000,
                description: 'Optimized for legal retrieval and RAG'
            },
            'voyage-multilingual-2': {
                dimension: 1024,
                contextLength: 32000,
                description: 'Legacy: Use voyage-3.5 for multilingual tasks'
            },
            'voyage-large-2-instruct': {
                dimension: 1024,
                contextLength: 16000,
                description: 'Legacy: Use voyage-3.5 instead'
            },
            // Legacy models
            'voyage-large-2': {
                dimension: 1536,
                contextLength: 16000,
                description: 'Legacy: Use voyage-3.5 instead'
            },
            'voyage-code-2': {
                dimension: 1536,
                contextLength: 16000,
                description: 'Previous generation of code embeddings'
            },
            'voyage-3': {
                dimension: 1024,
                contextLength: 32000,
                description: 'Legacy: Use voyage-3.5 instead'
            },
            'voyage-3-lite': {
                dimension: 512,
                contextLength: 32000,
                description: 'Legacy: Use voyage-3.5-lite instead'
            },
            'voyage-2': {
                dimension: 1024,
                contextLength: 4000,
                description: 'Legacy: Use voyage-3.5-lite instead'
            },
            // Other legacy models
            'voyage-02': {
                dimension: 1024,
                contextLength: 4000,
                description: 'Legacy model'
            },
            'voyage-01': {
                dimension: 1024,
                contextLength: 4000,
                description: 'Legacy model'
            },
            'voyage-lite-01': {
                dimension: 1024,
                contextLength: 4000,
                description: 'Legacy model'
            },
            'voyage-lite-01-instruct': {
                dimension: 1024,
                contextLength: 4000,
                description: 'Legacy model'
            },
            'voyage-lite-02-instruct': {
                dimension: 1024,
                contextLength: 4000,
                description: 'Legacy model'
            }
        };
    }
} 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #423** (2026-08-13): **fix: zilliztech/claude-context#421**
  *Symptoms*: ## Summary  Grammar loaders in `packages/core/src/splitter/ast-splitter.ts` were required eagerly at module load, unconditionally and without error handling. On macOS arm64, the unsigned `tree-sitter-cpp`/`tree-sitter-scala` prebuilds fail `dlopen` with `ERR_DLOPEN_FAILED`, crashing the whole MCP server at startup for **every** user — even ones with pure TypeScript/JavaScript codebases and zero C++/Scala files.  This PR makes per-language grammar loading lazy and defensive. Grammars are now `require()`d on first use (inside a try/catch), so a broken grammar only degrades that one language:  - AST splitting is disabled for the affected language - A warning is logged (`[ASTSplitter] ⚠️ Failed to load ...`) - Files of that language fall back to the existing LangChain character-based splitter  The rest of the pipeline (and every other language) keeps working normally.  ## Why this fixes the issue  The crash was self-inflicted: **any** single broken parser took down the server for all languages, regardless of what the user's codebase actually contains. Lazy, guarded loading confines the failure to exactly the language whose grammar is broken. The upstream unsigned-binary problem (arguably a `tree-sitter-cpp`/`tree-sitter-scala` packaging bug) now becomes a graceful degradation instead of a hard, unrecoverable startup crash.  ## Implementation details  - Replaced the module-level `require` block with a `LANGUAGE_PARSER_LOADERS` map of lazy loader functions. - Added `loadLanguagePar
  **Post-Mortem & Fix Analysis**:
  > Addressed review comment 3772389966 (failedLanguages memoization): added a test that reloads the module fresh (`jest.resetModules()`), then asserts two `split()` calls on the broken cpp grammar invoke the loader and `console.warn` exactly once — a per-file re-`require` regression now fails the suite. Verified: 8/8 core test suites pass, `tsc --noEmit` clean. Commit c7f2270.
  > Superseded by #426 — this PR was auto-closed when the head branch was recreated without shared history with master (my earlier force-push caused it). #426 is the same change (lazy grammar loading + failedLanguages memoization, review feedback addressed) on a branch based on current master.

- **Issue #414** (2026-07-28): **clear_index does not reclaim disk space in milvus/minio volumes (data leak)**
  *Symptoms*: 

- **Issue #407** (2026-07-14): **docs: add CLAUDE.md and AGENTS.md repository guide**
  *Symptoms*: ## What  Adds a `CLAUDE.md` repository guide (with `AGENTS.md` as a symlink to it), and removes the `CLAUDE.md` line from `.gitignore` so the shared guide can be tracked.  `CLAUDE.md` documents:  - **Monorepo layout** — the pnpm workspace (`core` / `mcp` / `vscode-extension` / `chrome-extension`) and how the frontends consume `core/dist` via `workspace:*`. - **Commands** — build / lint / typecheck, and the two different test runners (Jest for `core`, the Node built-in runner via `tsx` for `mcp`). - **Architecture** — the `Context` orchestrator and its pluggable embedding / vector-db / splitter interfaces, the two control-flow error types, incremental Merkle-DAG sync, layered ignore-pattern resolution, and the MCP server's "stdout is reserved for the protocol" constraint. - **Conventions** — the Conventional Commits scopes used in this repo.  ## Why  Gives contributors a single, accurate description of the architecture and workflow instead of reverse-engineering it from the source, and lets the coding tools many of us use pick up the same context.  `AGENTS.md` is a symlink to `CLAUDE.md`, so tools following either convention read the same content.  ## Note on `.gitignore`  `.gitignore` previously listed `CLAUDE.md` (treating it as a personal/local file). This PR drops that one line so the shared guide is committed; `.claude/*` stays ignored. Happy to revert that part if you'd rather keep `CLAUDE.md` local and ship only `AGENTS.md`.

- **Issue #397** (2026-06-22): **Bug: .gitignore negation patterns (!pattern) not supported, causing tracked directories to be silently excluded from index**
  *Symptoms*: ## Bug Description  When a `.gitignore` file contains wildcard + negation patterns (a common gitignore idiom), `claude-context-core` silently excludes the negated directories from indexing. This is because `getIgnorePatternsFromFile` loads all non-comment lines from every `.*ignore` file in the codebase root — including `.gitignore` — but there is no negation (`!`) support in `isPatternMatch`.  ## Root Cause  In `packages/core/dist/context.js`:  1. **`getIgnorePatternsFromFile`** loads all lines except empty and `#` comments. Negation lines like `!wp-content/plugins/app` are loaded as literal patterns.  2. **`isPatternMatch`** has no negation handling. The `!wp-content/plugins/app` literal pattern never matches any real path (the `!` prefix breaks glob matching), so it is silently inert — it does NOT whitelist/un-ignore anything.  3. The wildcard line (e.g. `wp-content/plugins/*`) correctly matches subdirectories, but the negation that should reverse it has no effect.  ## Reproduction  A `.gitignore` with this common pattern:  ```gitignore wp-content/plugins/* !wp-content/plugins/app !wp-content/plugins/backoffice ```  This is valid gitignore syntax: ignore all plugins except the listed ones. Git respects the negations. `claude-context` does not.  **Result:** `wp-content/plugins/app` and `wp-content/plugins/backoffice` are **completely excluded** from the index even though they are tracked by git and explicitly whitelisted. In our project this caused ~770 PHP/JS files across 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This has been fixed on master and released in 0.1.15.  The indexer now uses gitignore-compatible matching for ignore patterns, including ordered negation rules like `ignored/*` followed by `!ignored/keep`. The same matcher is used for initial indexing and incremental sync so those paths stay consistent. Dotfiles and dot-directories remain excluded by the existing default behavior.  Closing this as fixed, but please reopen or file a follow-up if 0.1.15 still misses an explicitly unignored path.
  > Fixed and released in 0.1.15.

- **Issue #396** (2026-06-13): **feat(core): CI semantic index — collection override, Qwen3-4B OpenRouter, Postgres cache**
  *Symptoms*: Enables the CovestLabs/workflows code-index pipeline. COLLECTION_NAME override (fixes cross-machine collection collision), qwen/qwen3-embedding-4b OpenRouter model (dim 2560), pluggable disk|postgres embedding cache (shared, content-addressed, plain psql). Disk default unchanged; typecheck+build green.
  **Post-Mortem & Fix Analysis**:
  > Opened against the wrong repo by mistake — this belongs in my fork. Closing.

- **Issue #390** (2026-06-08): **fix(mcp): show error when embedding model unavailable**
  *Symptoms*: Description:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 

- **Issue #386** (2026-07-14): **fix(core): make Merkle root hashing deterministic**
  *Symptoms*: ## Summary - build the Merkle DAG root hash from sorted file paths instead of Map insertion order - add a regression test that builds identical file-hash maps in different insertion orders and checks the root id stays stable  ## Why `buildMerkleDAG()` already adds child nodes in `sortedPaths` order, but the root node data was still built from the unsorted `Map` key order. When the same file hashes are inserted in a different traversal order, the root id can change even though the files did not.  `MerkleDAG.compare()` treats changed node ids as added/removed, so an insertion-order-only root change can make the synchronizer do unnecessary file-state comparisons and snapshot writes.  ## Tests - `cd packages/core && node_modules/.bin/jest src/sync/synchronizer.test.ts --runInBand` - `./node_modules/.bin/tsc --build packages/core --force` - `git diff --check` 

- **Issue #385** (2026-07-14): **fix(mcp): derive default version from package metadata**
  *Symptoms*: ## Summary - derive the default MCP server version from `packages/mcp/package.json` instead of the stale hard-coded `1.0.0` - preserve the `MCP_SERVER_VERSION` environment override - add focused regression coverage for the package default and override paths  ## Why `createMcpConfig()` passes `config.version` into the MCP server metadata. The package is currently versioned as `0.1.13`, but a default install still reports `1.0.0` unless `MCP_SERVER_VERSION` is set.  ## Tests - `./node_modules/.bin/tsc --build packages/core --force` - `cd packages/mcp && node --import tsx --test "src/config.test.ts"` - `./node_modules/.bin/tsc --build packages/mcp --force` - `git diff --check`  Note: `pnpm --filter @zilliz/claude-context-mcp test -- --test-name-pattern 'server version'` attempted to run through the local pnpm shim, but pnpm 11 aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` before executing tests, so I used the package's underlying `node --import tsx --test` command directly. 

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

### Incident Patch 1: `6fc318b4` (2026-07-14)
**Commit Message**: fix(mcp): derive default version from package metadata

Use the MCP package version as the default server version while preserving the MCP_SERVER_VERSION override.

**File**: `packages/mcp/src/config.test.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import { createMcpConfig } from "./config.js";
+
+const mcpPackage = JSON.parse(
+    readFileSync(new URL("../package.json", import.meta.url), "utf8")
+) as { version: string };
+
+function withEnvOverride(name: string, value: string | undefined, run: () => void): void {
+    const originalValue = process.env[name];
+
+    if (value === undefined) {
+        delete process.env[name];
+    } else {
+        process.env[name] = value;
+    }
+
+    try {
+        run();
+    } finally {
+        if (originalValue === undefined) {
+            delete process.env[name];
+        } else {
+            process.env[name] = originalValue;
+        }
+    }
+}
+
+test("uses the MCP package version as the default server version", () => {
+    withEnvOverride("MCP_SERVER_VERSION", undefined, () => {
+        const config = createMcpConfig();
+
+        assert.equal(config.version, mcpPackage.version);
+    });
+});
+
+test("allows MCP_SERVER_VERSION to override the package default", () => {
+    withEnvOverride("MCP_SERVER_VERSION", "custom-test-version", () => {
+        const config = createMcpConfig();
+
+        assert.equal(config.version, "custom-test-version");
+    });
+});
```

**File**: `packages/mcp/src/config.ts` (modified, +18/-1)
```diff
@@ -1,3 +1,4 @@
+import { readFileSync } from "node:fs";
 import { envManager } from "@zilliz/claude-context-core";
 
 export interface ContextMcpConfig {
@@ -118,6 +119,22 @@ export function getEmbeddingModelForProvider(provider: string): string {
     }
 }
 
+function readMcpPackageVersion(): string {
+    try {
+        const packageJsonUrl = new URL("../package.json", import.meta.url);
+        const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: unknown };
+        if (typeof packageJson.version === "string" && packageJson.version.trim()) {
+            return packageJson.version;
+        }
+    } catch (error) {
+        console.warn(`[DEBUG] ⚠️  Unable to read MCP package version: ${error}`);
+    }
+
+    return "1.0.0";
+}
+
+const defaultMcpServerVersion = readMcpPackageVersion();
+
 function getPositiveIntegerFromEnv(name: string): number | undefined {
     const rawValue = envManager.get(name);
     if (!rawValue) {
@@ -148,7 +165,7 @@ export function createMcpConfig(): ContextMcpConfig {
 
     const config: ContextMcpConfig = {
         name: envManager.get('MCP_SERVER_NAME') || "Context MCP Server",
-        version: envManager.get('MCP_SERVER_VERSION') || "1.0.0",
+        version: envManager.get('MCP_SERVER_VERSION') || defaultMcpServerVersion,
         // Embedding provider configuration
         embeddingProvider: (envManager.get('EMBEDDING_PROVIDER') as 'OpenAI' | 'VoyageAI' | 'Gemini' | 'Ollama' | 'OpenRouter') || 'OpenAI',
         embeddingModel: getEmbeddingModelForProvider(envManager.get('EMBEDDING_PROVIDER') || 'OpenAI'),
```

---

### Incident Patch 2: `d0a2effd` (2026-07-14)
**Commit Message**: fix(core): make Merkle root hashing deterministic

Build the Merkle DAG root from sorted file paths so identical file hash sets keep a stable root regardless of insertion order.

**File**: `packages/core/src/sync/synchronizer.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { FileSynchronizer } from './synchronizer';
+
+type TestableFileSynchronizer = {
+    buildMerkleDAG(fileHashes: Map<string, string>): {
+        rootIds: string[];
+    };
+};
+
+describe('FileSynchronizer Merkle DAG', () => {
+    it('uses stable root ids for identical file hashes inserted in different orders', () => {
+        const synchronizer = new FileSynchronizer('/tmp/project') as unknown as TestableFileSynchronizer;
+        const firstOrder = new Map([
+            ['src/a.ts', 'hash-a'],
+            ['src/b.ts', 'hash-b'],
+            ['README.md', 'hash-readme'],
+        ]);
+        const secondOrder = new Map([
+            ['README.md', 'hash-readme'],
+            ['src/b.ts', 'hash-b'],
+            ['src/a.ts', 'hash-a'],
+        ]);
+
+        const firstDag = synchronizer.buildMerkleDAG(firstOrder);
+        const secondDag = synchronizer.buildMerkleDAG(secondOrder);
+
+        expect(firstDag.rootIds).toEqual(secondDag.rootIds);
+    });
+});
```

**File**: `packages/core/src/sync/synchronizer.ts` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ export class FileSynchronizer {
 
         // Create a root node for the entire directory
         let valuesString = "";
-        keys.forEach(key => {
+        sortedPaths.forEach(key => {
             valuesString += fileHashes.get(key);
         });
         const rootNodeData = "root:" + valuesString;
```

---

### Incident Patch 3: `6111c071` (2026-07-14)
**Commit Message**: docs: add repository guide

Add a shared repository guide with project layout, commands, architecture notes, and contributor conventions.

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -59,7 +59,6 @@ __pycache__/
 !evaluation/case_study/**/*.log
 
 .claude/*
-CLAUDE.md
 
 .cursor/*
 
```

**File**: `AGENTS.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+CLAUDE.md
\ No newline at end of file
```

**File**: `CLAUDE.md` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+# CLAUDE.md
+
+This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
+
+## Overview
+
+Claude Context is an MCP plugin that adds semantic code search to AI coding agents. A codebase is split into chunks, embedded, and stored in a Milvus/Zilliz vector database; queries are answered by semantic (hybrid dense + sparse) search instead of loading whole directories into the model's context.
+
+## Monorepo Layout
+
+pnpm workspace (`packages/*`, `examples/*`). Requires Node >=20 <24 and pnpm >=10.
+
+- `packages/core` (`@zilliz/claude-context-core`) — the indexing engine. All real logic lives here; the other packages are thin frontends over it.
+- `packages/mcp` (`@zilliz/claude-context-mcp`) — stdio MCP server, the primary product. ESM (`"type": "module"`).
+- `packages/vscode-extension` (`semanticcodesearch`) — VSCode extension. Bundled with webpack; stubs out Node-only deps (Milvus gRPC, native AST) in `src/stubs/`.
+- `packages/chrome-extension` — browser build; overrides `@zilliz/milvus2-sdk-node` to `false` (no gRPC in browser).
+- `examples/basic-usage` — runnable library example.
+
+## Commands
+
+```bash
+pnpm install
+pnpm build                 # build all packages (examples built last)
+pnpm build:core            # build a single package: also build:mcp, build:vscode
+pnpm dev                   # watch all; or dev:core / dev:mcp / dev:vscode
+pnpm lint                  # eslint across packages; lint:fix to autofix
+pnpm typecheck             # tsc --noEmit across packages
+pnpm clean                 # rimraf dist in every package
+```
+
+Packages depend on `core` via `workspace:*`, so **rebuild core (`pnpm build:core`) before testing mcp/vscode against core changes** — they consume `core/dist`, not its source.
+
+### Tests
+
+- **core** uses Jest + ts-jest. Test files are colocated as `*.test.ts` in `src/`.
+  ```bash
+  pnpm --filter @zilliz/claude-context-core test                     # all (runs in band)
+  pnpm --filter @zilliz/claude-context-core test -- context.abort    # by filename
+  pnpm --filter @zilliz/claude-context-core test -- -t "pattern"     # by test name
+  ```
+- **mcp** uses the Node built-in test runner via tsx (no Jest):
+  ```bash
+  pnpm --filter @zilliz/claude-context-mcp test                      # runs src/**/*.test.ts
+  ```
+
+### Running the MCP server locally
+
+```bash
+pnpm --filter @zilliz/claude-context-mcp start        # tsx src/index.ts
+```
+Configuration is entirely via environment variables (see `.env.example` and `packages/mcp/src/config.ts`). Key vars: `EMBEDDING_PROVIDER` (OpenAI | VoyageAI | Gemini | Ollama | OpenRouter), provider API key, `EMBEDDING_MODEL`, `MILVUS_ADDRESS` and/or `MILVUS_TOKEN` (address can be auto-resolved from a Zilliz token), `CODE_CHUNKS_COLLECTION_NAME_OVERRIDE`.
+
+## Architecture
+
+### Core: the `Context` orchestrator (`packages/core/src/context.ts`)
+
+`Context` ties together three pluggable interfaces injected through its constructor config:
+
+- **Embedding** (`src/embedding/`) — `base-embedding.ts` interface with `OpenAIEmbedding`, `VoyageAIEmbedding`, `GeminiEmbedding`, `OllamaEmbedding` implementations.
+- **VectorDatabase** (`src/vectordb/`) — `MilvusVectorDatabase` (gRPC, Node-only) and `MilvusRestfulVectorDatabase` (HTTP, browser-safe). `zilliz-utils.ts` (`ClusterManager`) can provision a free Zilliz cluster and resolve an address from a token.
+- **Splitter** (`src/splitter/`) — `AstCodeSplitter` (tree-sitter, the default at 2500/300 chunk/overlap) which falls back to `LangChainCodeSplitter` for unsupported languages or parse failures.
+
+The public surface (`indexCodebase`, `reindexByChange`, `semanticSearch`, `clearIndex`, `hasIndex`) is re-exported from `src/index.ts`. Indexing reads files honoring ignore rules, splits them, embeds in batches, and upserts vectors. Collection name is derived from a hash of the absolute codebase path (overridable).
+
+Two error types carry control-flow meaning and should be preserved when touching the pipeline:
+- `IndexAbortError` — cooperative cancellation via `AbortSignal`.
+- `EmbeddingError` — always re-thrown to halt the whole pipeline, unlike per-file read/parse errors which are logged and skipped. This prevents silent partial indexing (Milvus getting zero vectors while the snapshot marks files done).
+
+### Incremental sync (`packages/core/src/sync/`)
+
+`FileSynchronizer` builds a Merkle DAG (`merkle.ts`) of file hashes to compute `{added, removed, modified}` between runs. Snapshots persist to `~/.context/merkle/<md5-of-path>.json`. `reindexByChange` uses this so re-indexing only touches changed files. The MCP server can also run a background sync loop (`CLAUDE_CONTEXT_BACKGROUND_SYNC`, `CLAUDE_CONTEXT_SYNC_INTERVAL_MS`).
+
+### Ignore patterns
+
+Layered: built-in `DEFAULT_IGNORE_PATTERNS` + config + env (`CUSTOM_IGNORE_PATTERNS`) + on-disk ignore files (`.gitignore`, `.contextignore`, `.xxxignore`, and a global 
```

---

### Incident Patch 4: `627eb2be` (2026-06-22)
**Commit Message**: fix(core): support gitignore negation patterns

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "claude-context",
-    "version": "0.1.14",
+    "version": "0.1.15",
     "description": "A powerful code indexing tool with multi-platform support",
     "private": true,
     "scripts": {
```

**File**: `packages/core/package.json` (modified, +2/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "@zilliz/claude-context-core",
-    "version": "0.1.14",
+    "version": "0.1.15",
     "description": "Core indexing engine for Claude Context",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
@@ -19,6 +19,7 @@
         "faiss-node": "^0.5.1",
         "fs-extra": "^11.0.0",
         "glob": "^10.0.0",
+        "ignore": "^7.0.5",
         "langchain": "^0.3.27",
         "ollama": "^0.5.16",
         "openai": "^5.1.1",
```

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +64/-0)
```diff
@@ -211,6 +211,45 @@ describe('Context ignore pattern isolation', () => {
         ]);
     });
 
+    it('honors gitignore negation patterns during indexing', async () => {
+        const project = path.join(tempRoot, 'project-with-negation');
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'app'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'backoffice'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'unused'), { recursive: true });
+        await fs.writeFile(
+            path.join(project, '.gitignore'),
+            [
+                'wp-content/plugins/*',
+                '!wp-content/plugins/app',
+                '!wp-content/plugins/backoffice',
+                '',
+            ].join('\n')
+        );
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'app', 'main.md'), 'app should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'backoffice', 'admin.md'), 'backoffice should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'unused', 'skip.md'), 'unused should be ignored');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual([
+            'wp-content/plugins/app/main.md',
+            'wp-content/plugins/backoffice/admin.md',
+        ]);
+    });
+
     it('skips dotfiles and dot directories during initial indexing', async () => {
         const project = path.join(tempRoot, 'project');
         await fs.mkdir(path.join(project, '.config'), { recursive: true });
@@ -284,4 +323,29 @@ describe('Context ignore pattern isolation', () => {
         expect(fileHashes.has(path.join('src', 'Library', 'nested.md'))).toBe(true);
         expect(fileHashes.has(path.join('src', 'keep.md'))).toBe(true);
     });
+
+    it('honors gitignore negation patterns during sync hashing', async () => {
+        const project = path.join(tempRoot, 'sync-project-with-negation');
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'app'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'backoffice'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'unused'), { recursive: true });
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'app', 'main.md'), 'app should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'backoffice', 'admin.md'), 'backoffice should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'unused', 'skip.md'), 'unused should be ignored');
+
+        const synchronizer = new FileSynchronizer(
+            project,
+            [
+                'wp-content/plugins/*',
+                '!wp-content/plugins/app',
+                '!wp-content/plugins/backoffice',
+            ],
+            ['.md']
+        );
+        const fileHashes = await (synchronizer as any).generateFileHashes(project) as Map<string, string>;
+
+        expect(fileHashes.has(path.join('wp-content', 'plugins', 'app', 'main.md'))).toBe(true);
+        expect(fileHashes.has(path.join('wp-content', 'plugins', 'backoffice', 'admin.md'))).toBe(true);
+        expect(fileHashes.has(path.join('wp-content', 'plugins', 'unused', 'skip.md'))).toBe(false);
+    });
 });
```

**File**: `packages/core/src/context.ts` (modified, +4/-105)
```diff
@@ -22,6 +22,7 @@ import * as fs from 'fs';
 import * as path from 'path';
 import * as crypto from 'crypto';
 import { FileSynchronizer } from './sync/synchronizer';
+import { IgnoreMatcher } from './utils/ignore-matcher';
 
 /**
  * Thrown by indexCodebase / processFileList when an AbortSignal fires
@@ -811,15 +812,17 @@ export class Context {
         supportedExtensions: string[] = this.supportedExtensions
     ): Promise<string[]> {
         const files: string[] = [];
+        const ignoreMatcher = new IgnoreMatcher(ignorePatterns);
 
         const traverseDirectory = async (currentPath: string) => {
             const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
 
             for (const entry of entries) {
                 const fullPath = path.join(currentPath, entry.name);
+                const relativePath = path.relative(codebasePath, fullPath);
 
                 // Check if path matches ignore patterns
-                if (this.matchesIgnorePattern(fullPath, codebasePath, ignorePatterns)) {
+                if (ignoreMatcher.ignores(relativePath, entry.isDirectory())) {
                     continue;
                 }
 
@@ -1282,110 +1285,6 @@ export class Context {
         }
     }
 
-    /**
-     * Check if a path matches any ignore pattern
-     * @param filePath Path to check
-     * @param basePath Base path for relative pattern matching
-     * @returns True if path should be ignored
-     */
-    private matchesIgnorePattern(filePath: string, basePath: string, ignorePatterns: string[] = this.ignorePatterns): boolean {
-        const relativePath = path.relative(basePath, filePath);
-
-        // Always ignore dotfiles/dotdirs to stay aligned with
-        // FileSynchronizer.shouldIgnore. If these traversals diverge, files
-        // indexed here are never hashed by the synchronizer and their stale
-        // chunks linger in Milvus forever.
-        if (relativePath.split(path.sep).some(part => part.startsWith('.'))) {
-            return true;
-        }
-
-        if (ignorePatterns.length === 0) {
-            return false;
-        }
-
-        const normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize path separators
-
-        for (const pattern of ignorePatterns) {
-            if (this.isPatternMatch(normalizedPath, pattern)) {
-                return true;
-            }
-        }
-
-        return false;
-    }
-
-    /**
-     * Simple glob pattern matching
-     * @param filePath File path to test
-     * @param pattern Glob pattern
-     * @returns True if pattern matches
-     */
-    private isPatternMatch(filePath: string, pattern: string): boolean {
-        const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
-        const normalizedPattern = pattern.replace(/\\/g, '/');
-        const cleanPattern = normalizedPattern.replace(/^\/+|\/+$/g, '');
-        const isRootAnchored = normalizedPattern.startsWith('/');
-        const isDirectoryPattern = normalizedPattern.endsWith('/');
-
-        if (!cleanPath || !cleanPattern) {
-            return false;
-        }
-
-        // Handle directory patterns (ending with /)
-        if (isDirectoryPattern) {
-            if (isRootAnchored) {
-                return this.simpleGlobMatch(cleanPath, cleanPattern) ||
-                    cleanPath.startsWith(`${cleanPattern}/`);
-            }
-
-            return this.matchesDirectoryPattern(cleanPath, cleanPattern);
-        }
-
-        if (isRootAnchored) {
-            return this.simpleGlobMatch(cleanPath, cleanPattern);
-        }
-
-        // Handle file patterns
-        if (cleanPattern.includes('/')) {
-            // Pattern with path separator - match exact path
-            return this.simpleGlobMatch(cleanPath, cleanPattern);
-        } else {
-            // Pattern without path separator - match filename in any directory
-            const fileName = path.basename(cleanPath);
-            return this.simpleGlobMatch(fileName, cleanPattern);
-        }
-    }
-
-    private matchesDirectoryPattern(filePath: string, dirPattern: string): boolean {
-        const pathParts = filePath.split('/');
-        const dirPartCount = dirPattern.split('/').length;
-
-        for (let i = 0; i <= pathParts.length - dirPartCount; i++) {
-            const candidate = pathParts.slice(i, i + dirPartCount).join('/');
-            if (this.simpleGlobMatch(candidate, dirPattern)) {
-                return true;
-            }
-        }
-
-        return false;
-    }
-
-    /**
-     * Simple glob matching supporting * wildcard
-     * @param text Text to test
-     * @param pattern Pattern with * wildcards
-     * @returns True if pattern matches
-     */
-    private simpleGlobMatch(text: string, pattern: string): boolean {
-        // Convert glob pattern to regex
-        const regexPattern = pattern
-            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
-            .repl
```

**File**: `packages/core/src/sync/synchronizer.ts` (modified, +8/-104)
```diff
@@ -3,22 +3,23 @@ import * as path from 'path';
 import * as crypto from 'crypto';
 import { MerkleDAG } from './merkle';
 import * as os from 'os';
+import { IgnoreMatcher } from '../utils/ignore-matcher';
 
 export class FileSynchronizer {
     private fileHashes: Map<string, string>;
     private merkleDAG: MerkleDAG;
     private rootDir: string;
     private snapshotPath: string;
-    private ignorePatterns: string[];
     private supportedExtensions: string[];
+    private ignoreMatcher: IgnoreMatcher;
 
     constructor(rootDir: string, ignorePatterns: string[] = [], supportedExtensions: string[] = []) {
         this.rootDir = rootDir;
         this.snapshotPath = this.getSnapshotPath(rootDir);
         this.fileHashes = new Map();
         this.merkleDAG = new MerkleDAG();
-        this.ignorePatterns = ignorePatterns;
         this.supportedExtensions = supportedExtensions;
+        this.ignoreMatcher = new IgnoreMatcher(ignorePatterns);
     }
 
     private getSnapshotPath(codebasePath: string): string {
@@ -57,7 +58,7 @@ export class FileSynchronizer {
             const relativePath = path.relative(this.rootDir, fullPath);
 
             // Check if this path should be ignored BEFORE any file system operations
-            if (this.shouldIgnore(relativePath)) {
+            if (this.shouldIgnore(relativePath, entry.isDirectory())) {
                 continue; // Skip completely - no access at all
             }
 
@@ -72,7 +73,7 @@ export class FileSynchronizer {
 
             if (stat.isDirectory()) {
                 // Verify it's really a directory and not ignored
-                if (!this.shouldIgnore(relativePath)) {
+                if (!this.shouldIgnore(relativePath, true)) {
                     const subHashes = await this.generateFileHashes(fullPath);
                     const entries = Array.from(subHashes.entries());
                     for (let i = 0; i < entries.length; i++) {
@@ -82,7 +83,7 @@ export class FileSynchronizer {
                 }
             } else if (stat.isFile()) {
                 // Verify it's really a file and not ignored
-                if (!this.shouldIgnore(relativePath)) {
+                if (!this.shouldIgnore(relativePath, false)) {
                     const ext = path.extname(entry.name);
                     if (this.supportedExtensions.length > 0 && !this.supportedExtensions.includes(ext)) {
                         continue;
@@ -101,105 +102,8 @@ export class FileSynchronizer {
         return fileHashes;
     }
 
-    private shouldIgnore(relativePath: string): boolean {
-        // Always ignore hidden files and directories (starting with .)
-        const pathParts = relativePath.split(path.sep);
-        if (pathParts.some(part => part.startsWith('.'))) {
-            return true;
-        }
-
-        if (this.ignorePatterns.length === 0) {
-            return false;
-        }
-
-        // Normalize path separators and remove leading/trailing slashes
-        const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
-
-        if (!normalizedPath) {
-            return false; // Don't ignore root
-        }
-
-        // Check direct pattern matches first
-        for (const pattern of this.ignorePatterns) {
-            if (this.matchPattern(normalizedPath, pattern)) {
-                return true;
-            }
-        }
-
-        // Check if any parent directory is ignored
-        const normalizedPathParts = normalizedPath.split('/');
-        for (let i = 0; i < normalizedPathParts.length; i++) {
-            const partialPath = normalizedPathParts.slice(0, i + 1).join('/');
-            for (const pattern of this.ignorePatterns) {
-                if (this.matchPattern(partialPath, pattern)) {
-                    return true;
-                }
-            }
-        }
-
-        return false;
-    }
-
-    private matchPattern(filePath: string, pattern: string): boolean {
-        // Clean both path and pattern
-        const cleanPath = filePath.replace(/^\/+|\/+$/g, '');
-        const normalizedPattern = pattern.replace(/\\/g, '/');
-        const cleanPattern = normalizedPattern.replace(/^\/+|\/+$/g, '');
-        const isRootAnchored = normalizedPattern.startsWith('/');
-        const isDirectoryPattern = normalizedPattern.endsWith('/');
-
-        if (!cleanPath || !cleanPattern) {
-            return false;
-        }
-
-        // Handle directory patterns (ending with /)
-        if (isDirectoryPattern) {
-            if (isRootAnchored) {
-                return this.simpleGlobMatch(cleanPath, cleanPattern) ||
-                    cleanPath.startsWith(`${cleanPattern}/`);
-            }
-
-            return this.matchesDirectoryPattern(cleanPath, cleanPattern);
-        }
-
-        if (isRootAnchored) {
-            return this.simpleGlobMatch(cleanPath, cleanPattern);
-        }
-
-        // Handle path patterns (containing /)
-        if (cleanPattern.includes('/')) {
-           
```

**File**: `packages/core/src/utils/ignore-matcher.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import ignore, { Ignore } from 'ignore';
+
+export class IgnoreMatcher {
+    private matcher: Ignore;
+
+    constructor(patterns: string[] = []) {
+        const cleanPatterns = patterns
+            .map(pattern => pattern.trim())
+            .filter(pattern => pattern.length > 0 && !pattern.startsWith('#'));
+
+        this.matcher = ignore().add(cleanPatterns);
+    }
+
+    ignores(relativePath: string, isDirectory: boolean = false): boolean {
+        const normalizedPath = this.normalizePath(relativePath);
+        if (!normalizedPath) {
+            return false;
+        }
+
+        if (this.hasHiddenSegment(normalizedPath)) {
+            return true;
+        }
+
+        if (this.matcher.ignores(normalizedPath)) {
+            return true;
+        }
+
+        return isDirectory && this.matcher.ignores(`${normalizedPath}/`);
+    }
+
+    private normalizePath(relativePath: string): string {
+        return relativePath
+            .replace(/\\/g, '/')
+            .replace(/^\/+|\/+$/g, '');
+    }
+
+    private hasHiddenSegment(relativePath: string): boolean {
+        return relativePath
+            .split('/')
+            .some(part => part.length > 0 && part.startsWith('.'));
+    }
+}
```

**File**: `packages/core/src/utils/index.ts` (modified, +2/-1)
```diff
@@ -1 +1,2 @@
-export { EnvManager, envManager } from './env-manager'; 
\ No newline at end of file
+export { EnvManager, envManager } from './env-manager';
+export { IgnoreMatcher } from './ignore-matcher';
```

**File**: `packages/mcp/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "@zilliz/claude-context-mcp",
-    "version": "0.1.14",
+    "version": "0.1.15",
     "description": "Model Context Protocol integration for Claude Context",
     "type": "module",
     "main": "dist/index.js",
```

---

### Incident Patch 5: `f8e26729` (2026-06-05)
**Commit Message**: fix(mcp): show error when embedding model unavailable

**File**: `packages/core/src/context.embedding-error.test.ts` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+import * as fs from 'fs/promises';
+import * as os from 'os';
+import * as path from 'path';
+import { Context, EmbeddingError } from './context';
+import { Embedding, EmbeddingVector } from './embedding';
+import { Splitter, CodeChunk } from './splitter';
+import { VectorDatabase } from './vectordb';
+
+type EmbeddingMode = 'throw' | 'empty' | 'short';
+
+class FailingEmbedding extends Embedding {
+    protected maxTokens = 8192;
+
+    constructor(private readonly mode: EmbeddingMode) {
+        super();
+    }
+
+    async detectDimension(): Promise<number> {
+        return 3;
+    }
+
+    async embed(_text: string): Promise<EmbeddingVector> {
+        return { vector: [1, 0, 0], dimension: 3 };
+    }
+
+    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
+        if (this.mode === 'throw') {
+            throw new Error('quota exhausted');
+        }
+
+        if (this.mode === 'empty') {
+            return [];
+        }
+
+        return texts.slice(0, Math.max(0, texts.length - 1)).map(() => ({
+            vector: [1, 0, 0],
+            dimension: 3,
+        }));
+    }
+
+    getDimension(): number {
+        return 3;
+    }
+
+    getProvider(): string {
+        return 'test';
+    }
+}
+
+class OneChunkSplitter implements Splitter {
+    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
+        return [{
+            content: code,
+            metadata: {
+                startLine: 1,
+                endLine: 1,
+                language,
+                filePath,
+            },
+        }];
+    }
+
+    setChunkSize(): void { }
+    setChunkOverlap(): void { }
+}
+
+const createVectorDatabase = (): jest.Mocked<VectorDatabase> => ({
+    createCollection: jest.fn().mockResolvedValue(undefined),
+    createHybridCollection: jest.fn().mockResolvedValue(undefined),
+    dropCollection: jest.fn().mockResolvedValue(undefined),
+    hasCollection: jest.fn().mockResolvedValue(false),
+    listCollections: jest.fn().mockResolvedValue([]),
+    insert: jest.fn().mockResolvedValue(undefined),
+    insertHybrid: jest.fn().mockResolvedValue(undefined),
+    search: jest.fn().mockResolvedValue([]),
+    hybridSearch: jest.fn().mockResolvedValue([]),
+    delete: jest.fn().mockResolvedValue(undefined),
+    query: jest.fn().mockResolvedValue([]),
+    getCollectionDescription: jest.fn().mockResolvedValue(''),
+    checkCollectionLimit: jest.fn().mockResolvedValue(true),
+    getCollectionRowCount: jest.fn().mockResolvedValue(0),
+});
+
+describe('Context embedding failure handling', () => {
+    let tempRoot: string;
+    let originalHome: string | undefined;
+    let originalHybridMode: string | undefined;
+    let originalEmbeddingBatchSize: string | undefined;
+
+    beforeEach(async () => {
+        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-context-embedding-error-'));
+        const homeDir = path.join(tempRoot, 'home');
+        await fs.mkdir(homeDir, { recursive: true });
+        originalHome = process.env.HOME;
+        originalHybridMode = process.env.HYBRID_MODE;
+        originalEmbeddingBatchSize = process.env.EMBEDDING_BATCH_SIZE;
+        process.env.HOME = homeDir;
+        process.env.HYBRID_MODE = 'false';
+    });
+
+    afterEach(async () => {
+        if (originalHome === undefined) {
+            delete process.env.HOME;
+        } else {
+            process.env.HOME = originalHome;
+        }
+        if (originalHybridMode === undefined) {
+            delete process.env.HYBRID_MODE;
+        } else {
+            process.env.HYBRID_MODE = originalHybridMode;
+        }
+        if (originalEmbeddingBatchSize === undefined) {
+            delete process.env.EMBEDDING_BATCH_SIZE;
+        } else {
+            process.env.EMBEDDING_BATCH_SIZE = originalEmbeddingBatchSize;
+        }
+        await fs.rm(tempRoot, { recursive: true, force: true });
+    });
+
+    async function createProject(): Promise<string> {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(project);
+        await fs.writeFile(path.join(project, 'one.ts'), 'const one = 1;');
+        await fs.writeFile(path.join(project, 'two.ts'), 'const two = 2;');
+        return project;
+    }
+
+    it('propagates embedding API errors instead of treating them as file skips', async () => {
+        process.env.EMBEDDING_BATCH_SIZE = '1';
+        const project = await createProject();
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new FailingEmbedding('throw'),
+            vectorDatabase,
+            codeSplitter: new OneChunkSplitter(),
+        });
+
+        await expect(context.indexCodebase(project)).rejects.toThrow(EmbeddingError);
+        expect(vectorDatabase.insert).not.toHaveBeenCalled();
+        expect(vectorDatabase.insertHybrid).not.toHaveBeenCalled();
+    });
+
+    it('rejects empty embedding batches b
```

**File**: `packages/core/src/context.ts` (modified, +72/-1)
```diff
@@ -35,6 +35,23 @@ export class IndexAbortError extends Error {
     }
 }
 
+/**
+ * Thrown when the embedding API fails (quota exhausted, auth failure,
+ * network error, etc.). Propagates through processFileList so callers
+ * can distinguish a critical embedding failure from a per-file skip.
+ *
+ * Unlike a per-file read/parse error (which is logged and skipped),
+ * an EmbeddingError is always re-thrown so that the entire indexing
+ * pipeline stops. This prevents silent partial indexing: Milvus would
+ * otherwise receive zero vectors while the snapshot marks files as done.
+ */
+export class EmbeddingError extends Error {
+    constructor(message: string) {
+        super(message);
+        this.name = 'EmbeddingError';
+    }
+}
+
 const DEFAULT_SUPPORTED_EXTENSIONS = [
     // Programming languages
     '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
@@ -877,6 +894,10 @@ export class Context {
                         try {
                             await this.processChunkBuffer(chunkBuffer);
                         } catch (error) {
+                            // Embedding errors (such as API having no quota) halt the entire indexing process and propagate upwards.
+                            if (error instanceof EmbeddingError) {
+                                throw error;
+                            }
                             const searchType = isHybrid === true ? 'hybrid' : 'regular';
                             console.error(`[Context] ❌ Failed to process chunk batch for ${searchType}:`, error);
                             if (error instanceof Error) {
@@ -903,6 +924,9 @@ export class Context {
                 }
 
             } catch (error) {
+                if (error instanceof EmbeddingError) {
+                    throw error;
+                }
                 console.warn(`[Context] ⚠️  Skipping file ${filePath}: ${error}`);
             }
         }
@@ -914,6 +938,9 @@ export class Context {
             try {
                 await this.processChunkBuffer(chunkBuffer);
             } catch (error) {
+                if (error instanceof EmbeddingError) {
+                    throw error;
+                }
                 console.error(`[Context] ❌ Failed to process final chunk batch for ${searchType}:`, error);
                 if (error instanceof Error) {
                     console.error('[Context] Stack trace:', error.stack);
@@ -959,7 +986,18 @@ export class Context {
 
         // Generate embedding vectors
         const chunkContents = chunks.map(chunk => chunk.content);
-        const embeddings = await this.embedding.embedBatch(chunkContents);
+
+        let embeddings: EmbeddingVector[];
+        try {
+            embeddings = await this.embedding.embedBatch(chunkContents);
+        } catch (error) {
+            const errorMessage = error instanceof Error ? error.message : String(error);
+            // Include batch size in the log/error message so operators can
+            // identify how many chunks were lost when the API call failed.
+            console.error(`[Context] ❌ Embedding API failed (batch size: ${chunkContents.length}): ${errorMessage}`);
+            throw new EmbeddingError(`Embedding API error (batch size: ${chunkContents.length}): ${errorMessage}`);
+        }
+        this.validateEmbeddings(embeddings, chunks.length);
 
         if (isHybrid === true) {
             // Create hybrid vector documents
@@ -1024,6 +1062,39 @@ export class Context {
         }
     }
 
+    /**
+     * Validate that the embedding batch response is well-formed before writing
+     * any vectors to Milvus. Throwing EmbeddingError here aborts the entire
+     * indexing run so that no partial / empty vectors are persisted.
+     *
+     * @param embeddings   - Array of embedding vectors returned by the API.
+     * @param expectedCount - Number of chunks submitted in the batch request.
+     * @throws EmbeddingError if the response is missing, mismatched, or contains
+     *         any empty vector.
+     * @returns void
+     */
+    private validateEmbeddings(embeddings: EmbeddingVector[], expectedCount: number): void {
+        // Guard against non-array return values (e.g. API returning null or an
+        // error object instead of throwing).
+        if (!Array.isArray(embeddings)) {
+            throw new EmbeddingError('Embedding API returned invalid embedding batch response');
+        }
+
+        // A partial response would silently mis-align embeddings[i] with chunks[i],
+        // producing wrong vectors in Milvus — treat it as a hard failure.
+        if (embeddings.length !== expectedCount) {
+            throw new EmbeddingError(`Embedding API returned ${embeddings.length} embeddings for ${expectedCount} chunks`);
+        }
+
+        // Check each vector; an empty vector inserted into Milvus
+        // would corrupt search results for that chunk's file.
+        embeddings.forEach((embedding, index) => {
+  
```

---

### Incident Patch 6: `7326074a` (2026-05-22)
**Commit Message**: Merge pull request #378 from yuyua9/devc/dotfile-indexing-regression

test(core): cover dotfile skips during indexing

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +58/-0)
```diff
@@ -211,6 +211,64 @@ describe('Context ignore pattern isolation', () => {
         ]);
     });
 
+    it('skips dotfiles and dot directories during initial indexing', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(path.join(project, '.config'), { recursive: true });
+        await fs.mkdir(path.join(project, '.github', 'workflows'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src', '.cache'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src'), { recursive: true });
+
+        await fs.writeFile(path.join(project, '.hidden.md'), 'root hidden file should be ignored');
+        await fs.writeFile(path.join(project, '.config', 'settings.md'), 'hidden dir should be ignored');
+        await fs.writeFile(path.join(project, '.github', 'workflows', 'ci.md'), 'hidden nested dir should be ignored');
+        await fs.writeFile(path.join(project, 'src', '.cache', 'generated.md'), 'nested hidden dir should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'keep.md'), 'regular file should stay');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual(['src/keep.md']);
+    });
+
+    it('keeps dotfile skipping active when request ignore patterns are provided', async () => {
+        const project = path.join(tempRoot, 'project-with-request-ignores');
+        await fs.mkdir(path.join(project, '.config'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src'), { recursive: true });
+
+        await fs.writeFile(path.join(project, '.config', 'settings.ts'), 'hidden dir should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'ignored.ts'), 'request ignore should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'keep.ts'), 'regular file should stay');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project, undefined, false, ['src/ignored.ts']);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual(['src/keep.ts']);
+    });
+
     it('treats leading-slash directory ignore patterns as root-anchored and recursive during sync', async () => {
         const project = path.join(tempRoot, 'project');
         await fs.mkdir(path.join(project, 'Library'), { recursive: true });
```

---

### Incident Patch 7: `291863a4` (2026-05-05)
**Commit Message**: fix(mcp): cancel background indexing on clear_index (#199) (#369)

clear_index returned "successfully cleared" while the background
indexing task kept embedding chunks and writing them into the
just-cleared collection, leaving the user with a half-rebuilt index
they did not ask for.

Add cooperative cancellation:

- core: indexCodebase / processFileList accept an optional AbortSignal
  and bail at the next file boundary with a new IndexAbortError.
- mcp: handlers track the AbortController + promise per absolute
  codebase path, abort and await the in-flight task before dropping
  the collection in handleClearIndex, and skip the indexfailed
  snapshot write when the failure is an IndexAbortError so the
  abort-then-clear path leaves no tombstone.

Tests: 4 new jest cases in packages/core covering the no-signal
regression, never-fires regression, mid-indexing abort (only the
files processed before the signal are split, no inserts fire), and
pre-aborted signal.

Closes #199

Co-authored-by: voidborne-d <[REDACTED_EMAIL]>

**File**: `packages/core/src/context.abort.test.ts` (added, +207/-0)
```diff
@@ -0,0 +1,207 @@
+import * as fs from 'fs/promises';
+import * as os from 'os';
+import * as path from 'path';
+import { Context, IndexAbortError } from './context';
+import { Embedding, EmbeddingVector } from './embedding';
+import { Splitter, CodeChunk } from './splitter';
+import { VectorDatabase } from './vectordb';
+
+class TestEmbedding extends Embedding {
+    protected maxTokens = 8192;
+
+    async detectDimension(): Promise<number> {
+        return 3;
+    }
+
+    async embed(_text: string): Promise<EmbeddingVector> {
+        return { vector: [1, 0, 0], dimension: 3 };
+    }
+
+    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
+        return texts.map(() => ({ vector: [1, 0, 0], dimension: 3 }));
+    }
+
+    getDimension(): number {
+        return 3;
+    }
+
+    getProvider(): string {
+        return 'test';
+    }
+}
+
+class CountingSplitter implements Splitter {
+    public calls = 0;
+
+    constructor(private readonly onCall?: (callIndex: number) => void) { }
+
+    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
+        this.calls += 1;
+        this.onCall?.(this.calls);
+        return [{
+            content: code,
+            metadata: {
+                startLine: 1,
+                endLine: code.split('\n').length,
+                language,
+                filePath,
+            },
+        }];
+    }
+
+    setChunkSize(): void { }
+    setChunkOverlap(): void { }
+}
+
+const createVectorDatabase = (): jest.Mocked<VectorDatabase> => ({
+    createCollection: jest.fn().mockResolvedValue(undefined),
+    createHybridCollection: jest.fn().mockResolvedValue(undefined),
+    dropCollection: jest.fn().mockResolvedValue(undefined),
+    hasCollection: jest.fn().mockResolvedValue(false),
+    listCollections: jest.fn().mockResolvedValue([]),
+    insert: jest.fn().mockResolvedValue(undefined),
+    insertHybrid: jest.fn().mockResolvedValue(undefined),
+    search: jest.fn().mockResolvedValue([]),
+    hybridSearch: jest.fn().mockResolvedValue([]),
+    delete: jest.fn().mockResolvedValue(undefined),
+    query: jest.fn().mockResolvedValue([]),
+    getCollectionDescription: jest.fn().mockResolvedValue(''),
+    checkCollectionLimit: jest.fn().mockResolvedValue(true),
+    getCollectionRowCount: jest.fn().mockResolvedValue(0),
+});
+
+describe('Context indexCodebase AbortSignal support', () => {
+    let tempRoot: string;
+    let originalHome: string | undefined;
+    let originalHybridMode: string | undefined;
+
+    beforeEach(async () => {
+        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-context-abort-'));
+        const homeDir = path.join(tempRoot, 'home');
+        await fs.mkdir(homeDir, { recursive: true });
+        originalHome = process.env.HOME;
+        originalHybridMode = process.env.HYBRID_MODE;
+        process.env.HOME = homeDir;
+        process.env.HYBRID_MODE = 'false';
+    });
+
+    afterEach(async () => {
+        if (originalHome === undefined) {
+            delete process.env.HOME;
+        } else {
+            process.env.HOME = originalHome;
+        }
+        if (originalHybridMode === undefined) {
+            delete process.env.HYBRID_MODE;
+        } else {
+            process.env.HYBRID_MODE = originalHybridMode;
+        }
+        await fs.rm(tempRoot, { recursive: true, force: true });
+    });
+
+    it('completes normally when no signal is provided (regression guard)', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(project);
+        for (let i = 0; i < 3; i++) {
+            await fs.writeFile(path.join(project, `file${i}.ts`), `const v${i} = ${i};`);
+        }
+
+        const vectorDatabase = createVectorDatabase();
+        const splitter = new CountingSplitter();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: splitter,
+        });
+
+        const stats = await context.indexCodebase(project);
+
+        expect(stats.indexedFiles).toBe(3);
+        expect(stats.status).toBe('completed');
+        expect(splitter.calls).toBe(3);
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        expect(insertedDocuments).toHaveLength(3);
+    });
+
+    it('completes normally when signal is provided but never fires', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(project);
+        for (let i = 0; i < 3; i++) {
+            await fs.writeFile(path.join(project, `file${i}.ts`), `const v${i} = ${i};`);
+        }
+
+        const vectorDatabase = createVectorDatabase();
+        const splitter = new CountingSplitter();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: splitter,
+        });
+
+        const controller = n
```

**File**: `packages/core/src/context.ts` (modified, +31/-5)
```diff
@@ -23,6 +23,18 @@ import * as path from 'path';
 import * as crypto from 'crypto';
 import { FileSynchronizer } from './sync/synchronizer';
 
+/**
+ * Thrown by indexCodebase / processFileList when an AbortSignal fires
+ * mid-indexing. Callers (e.g. the MCP server's clear_index handler) use
+ * this to detect a cooperative cancel vs. a real failure.
+ */
+export class IndexAbortError extends Error {
+    constructor(message: string = 'Indexing aborted') {
+        super(message);
+        this.name = 'IndexAbortError';
+    }
+}
+
 const DEFAULT_SUPPORTED_EXTENSIONS = [
     // Programming languages
     '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
@@ -328,7 +340,8 @@ export class Context {
         forceReindex: boolean = false,
         additionalIgnorePatterns: string[] = [],
         additionalSupportedExtensions: string[] = [],
-        requestSplitter?: Splitter
+        requestSplitter?: Splitter,
+        signal?: AbortSignal
     ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
@@ -376,7 +389,8 @@ export class Context {
                     percentage: Math.round(progressPercentage)
                 });
             },
-            splitter
+            splitter,
+            signal
         );
 
         console.log(`[Context] ✅ Codebase indexing completed! Processed ${result.processedFiles} files in total, generated ${result.totalChunks} code chunks`);
@@ -818,7 +832,8 @@ export class Context {
         filePaths: string[],
         codebasePath: string,
         onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void,
-        splitter: Splitter = this.codeSplitter
+        splitter: Splitter = this.codeSplitter,
+        signal?: AbortSignal
     ): Promise<{ processedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const EMBEDDING_BATCH_SIZE = Math.max(1, parseInt(envManager.get('EMBEDDING_BATCH_SIZE') || '100', 10));
@@ -831,6 +846,13 @@ export class Context {
         let limitReached = false;
 
         for (let i = 0; i < filePaths.length; i++) {
+            // Cooperative cancellation: bail out at the next file boundary so the
+            // caller (e.g. clear_index) can rely on no further inserts/snapshot
+            // writes happening once it has signalled abort. See issue #199.
+            if (signal?.aborted) {
+                throw new IndexAbortError(`Indexing aborted after processing ${processedFiles}/${filePaths.length} files`);
+            }
+
             const filePath = filePaths[i];
 
             try {
@@ -885,8 +907,8 @@ export class Context {
             }
         }
 
-        // Process any remaining chunks in the buffer
-        if (chunkBuffer.length > 0) {
+        // Process any remaining chunks in the buffer (skip if cancelled).
+        if (chunkBuffer.length > 0 && !signal?.aborted) {
             const searchType = isHybrid === true ? 'hybrid' : 'regular';
             console.log(`📝 Processing final batch of ${chunkBuffer.length} chunks for ${searchType}`);
             try {
@@ -899,6 +921,10 @@ export class Context {
             }
         }
 
+        if (signal?.aborted) {
+            throw new IndexAbortError(`Indexing aborted after processing ${processedFiles}/${filePaths.length} files`);
+        }
+
         return {
             processedFiles,
             totalChunks,
```

**File**: `packages/mcp/src/handlers.ts` (modified, +61/-6)
```diff
@@ -1,7 +1,7 @@
 import * as fs from "fs";
 import * as path from "path";
 import * as crypto from "crypto";
-import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer } from "@zilliz/claude-context-core";
+import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer, IndexAbortError } from "@zilliz/claude-context-core";
 import { SnapshotManager } from "./snapshot.js";
 import type { CodebaseIndexOptions, RequestSplitterType } from "./config.js";
 import { createRequestSplitter, isRequestSplitterType } from "./splitter.js";
@@ -12,6 +12,14 @@ export class ToolHandlers {
     private snapshotManager: SnapshotManager;
     private indexingStats: { indexedFiles: number; totalChunks: number } | null = null;
     private currentWorkspace: string;
+    /**
+     * Tracks active background indexing tasks per absolute codebase path so
+     * clear_index can cancel and await them before dropping the collection.
+     * Without this, a clear_index call returns "successfully cleared" while
+     * the background task keeps embedding chunks and writing them into the
+     * just-cleared collection (issue #199).
+     */
+    private indexingTasks: Map<string, { controller: AbortController; promise: Promise<void> }> = new Map();
 
     constructor(context: Context, snapshotManager: SnapshotManager) {
         this.context = context;
@@ -476,8 +484,27 @@ export class ToolHandlers {
             // Track the codebase path for syncing
             trackCodebasePath(absolutePath);
 
-            // Start background indexing - now safe to proceed
-            this.startBackgroundIndexing(absolutePath, forceReindex, splitterType, customIgnorePatterns, customFileExtensions, indexOptions);
+            // Start background indexing - now safe to proceed.
+            // Track the controller + promise so clear_index can cancel and
+            // await us before dropping the underlying collection.
+            const controller = new AbortController();
+            const promise = this.startBackgroundIndexing(
+                absolutePath,
+                forceReindex,
+                splitterType,
+                customIgnorePatterns,
+                customFileExtensions,
+                indexOptions,
+                controller.signal
+            ).finally(() => {
+                // Only clear the entry if it still points at this run — a
+                // concurrent re-index may have replaced us.
+                const current = this.indexingTasks.get(absolutePath);
+                if (current && current.controller === controller) {
+                    this.indexingTasks.delete(absolutePath);
+                }
+            });
+            this.indexingTasks.set(absolutePath, { controller, promise });
 
             const pathInfo = codebasePath !== absolutePath
                 ? `\nNote: Input path '${codebasePath}' was resolved to absolute path '${absolutePath}'`
@@ -519,8 +546,9 @@ export class ToolHandlers {
         splitterType: RequestSplitterType,
         customIgnorePatterns: string[] = [],
         customFileExtensions: string[] = [],
-        indexOptions?: CodebaseIndexOptions
-    ) {
+        indexOptions?: CodebaseIndexOptions,
+        signal?: AbortSignal
+    ): Promise<void> {
         const absolutePath = codebasePath;
         let lastSaveTime = 0; // Track last save timestamp
 
@@ -574,7 +602,7 @@ export class ToolHandlers {
                 }
 
                 console.log(`[BACKGROUND-INDEX] Progress: ${progress.phase} - ${progress.percentage}% (${progress.current}/${progress.total})`);
-            }, false, customIgnorePatterns, customFileExtensions, requestSplitter);
+            }, false, customIgnorePatterns, customFileExtensions, requestSplitter, signal);
             console.log(`[BACKGROUND-INDEX] ✅ Indexing completed successfully! Files: ${stats.indexedFiles}, Chunks: ${stats.totalChunks}`);
 
             // Set codebase to indexed status with complete statistics
@@ -592,6 +620,15 @@ export class ToolHandlers {
             console.log(`[BACKGROUND-INDEX] ${message}`);
 
         } catch (error: any) {
+            // Cooperative cancel from clear_index — clear_index is responsible
+            // for tearing down the snapshot/collection right after, so do not
+            // overwrite the snapshot with an "indexfailed" entry that would
+            // race the clear and leave a tombstone behind.
+            if (error instanceof IndexAbortError) {
+                console.log(`[BACKGROUND-INDEX] Indexing for ${absolutePath} was cancelled: ${error.message}`);
+                return;
+            }
+
             console.error(`[BACKGROUND-INDEX] Error during indexing for ${absolutePath}:`, error);
 
             // Get the last attempted progress
@@ -869,6 +906,24 @@ export class ToolHandlers {
 
             console.log(`[CLEAR] Clearing codebase: ${absolutePath}`);
 
+            // Cancel any in-flight background indexing for this codebase and
+            // wait for it 
```

---

### Incident Patch 8: `747ada5f` (2026-05-02)
**Commit Message**: docs: fix Cherry Studio npx arguments (#368)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_ADDRESS`: `your-zilliz-cloud-public-endpoint`
```

**File**: `docs/getting-started/quick-start.md` (modified, +1/-1)
```diff
@@ -300,7 +300,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

**File**: `packages/mcp/README.md` (modified, +1/-1)
```diff
@@ -502,7 +502,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

---

### Incident Patch 9: `0d558ff7` (2026-05-01)
**Commit Message**: docs: fix Cherry Studio npx arguments

**File**: `README.md` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_ADDRESS`: `your-zilliz-cloud-public-endpoint`
```

**File**: `docs/getting-started/quick-start.md` (modified, +1/-1)
```diff
@@ -300,7 +300,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

**File**: `packages/mcp/README.md` (modified, +1/-1)
```diff
@@ -502,7 +502,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

---

### Incident Patch 10: `ead19f4a` (2026-05-01)
**Commit Message**: fix(mcp,core): honor request-scoped splitter option (#363)

**File**: `packages/core/src/context.splitter.test.ts` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+import * as fs from 'fs/promises';
+import * as os from 'os';
+import * as path from 'path';
+import { Context } from './context';
+import { Embedding, EmbeddingVector } from './embedding';
+import { Splitter, CodeChunk } from './splitter';
+import { FileSynchronizer } from './sync/synchronizer';
+import { VectorDatabase } from './vectordb';
+
+class TestEmbedding extends Embedding {
+    protected maxTokens = 8192;
+
+    async detectDimension(): Promise<number> {
+        return 3;
+    }
+
+    async embed(text: string): Promise<EmbeddingVector> {
+        return { vector: [1, 0, 0], dimension: 3 };
+    }
+
+    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
+        return texts.map(() => ({ vector: [1, 0, 0], dimension: 3 }));
+    }
+
+    getDimension(): number {
+        return 3;
+    }
+
+    getProvider(): string {
+        return 'test';
+    }
+}
+
+class RecordingSplitter implements Splitter {
+    public calls: Array<{ code: string; language: string; filePath?: string }> = [];
+
+    constructor(private readonly label: string) { }
+
+    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
+        this.calls.push({ code, language, filePath });
+        return [{
+            content: `${this.label}:${code}`,
+            metadata: {
+                startLine: 1,
+                endLine: code.split('\n').length,
+                language,
+                filePath,
+            },
+        }];
+    }
+
+    setChunkSize(): void { }
+
+    setChunkOverlap(): void { }
+}
+
+const createVectorDatabase = (): jest.Mocked<VectorDatabase> => ({
+    createCollection: jest.fn().mockResolvedValue(undefined),
+    createHybridCollection: jest.fn().mockResolvedValue(undefined),
+    dropCollection: jest.fn().mockResolvedValue(undefined),
+    hasCollection: jest.fn().mockResolvedValue(false),
+    listCollections: jest.fn().mockResolvedValue([]),
+    insert: jest.fn().mockResolvedValue(undefined),
+    insertHybrid: jest.fn().mockResolvedValue(undefined),
+    search: jest.fn().mockResolvedValue([]),
+    hybridSearch: jest.fn().mockResolvedValue([]),
+    delete: jest.fn().mockResolvedValue(undefined),
+    query: jest.fn().mockResolvedValue([]),
+    getCollectionDescription: jest.fn().mockResolvedValue(''),
+    checkCollectionLimit: jest.fn().mockResolvedValue(true),
+    getCollectionRowCount: jest.fn().mockResolvedValue(0),
+});
+
+describe('Context request-scoped splitters', () => {
+    let tempRoot: string;
+    let originalHome: string | undefined;
+    let originalHybridMode: string | undefined;
+
+    beforeEach(async () => {
+        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-context-splitter-'));
+        const homeDir = path.join(tempRoot, 'home');
+        await fs.mkdir(homeDir, { recursive: true });
+        originalHome = process.env.HOME;
+        originalHybridMode = process.env.HYBRID_MODE;
+        process.env.HOME = homeDir;
+        process.env.HYBRID_MODE = 'false';
+    });
+
+    afterEach(async () => {
+        if (originalHome === undefined) {
+            delete process.env.HOME;
+        } else {
+            process.env.HOME = originalHome;
+        }
+        if (originalHybridMode === undefined) {
+            delete process.env.HYBRID_MODE;
+        } else {
+            process.env.HYBRID_MODE = originalHybridMode;
+        }
+        await fs.rm(tempRoot, { recursive: true, force: true });
+    });
+
+    it('uses a request-scoped splitter for indexing without replacing the context splitter', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(project);
+        await fs.writeFile(path.join(project, 'index.ts'), 'const value = 1;');
+
+        const vectorDatabase = createVectorDatabase();
+        const contextSplitter = new RecordingSplitter('context');
+        const requestSplitter = new RecordingSplitter('request');
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: contextSplitter,
+        });
+
+        await context.indexCodebase(project, undefined, false, [], [], requestSplitter);
+
+        expect(contextSplitter.calls).toHaveLength(0);
+        expect(requestSplitter.calls).toHaveLength(1);
+        expect(context.getCodeSplitter()).toBe(contextSplitter);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        expect(insertedDocuments).toHaveLength(1);
+        expect(insertedDocuments[0].content).toBe('request:const value = 1;');
+    });
+
+    it('uses a request-scoped splitter for changed files during sync reindexing', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(project);
+        const filePath = path.join(project, 'note.md');
+        await fs.writeFile(filePath, 'first version');
+
+        const vectorDa
```

**File**: `packages/core/src/context.ts` (modified, +14/-6)
```diff
@@ -319,18 +319,21 @@ export class Context {
      * @param forceReindex Whether to recreate the collection even if it exists
      * @param additionalIgnorePatterns Request-scoped ignore patterns
      * @param additionalSupportedExtensions Request-scoped file extensions
+     * @param requestSplitter Request-scoped splitter for this indexing run
      * @returns Indexing statistics
      */
     async indexCodebase(
         codebasePath: string,
         progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
         forceReindex: boolean = false,
         additionalIgnorePatterns: string[] = [],
-        additionalSupportedExtensions: string[] = []
+        additionalSupportedExtensions: string[] = [],
+        requestSplitter?: Splitter
     ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
         console.log(`[Context] 🚀 Starting to index codebase with ${searchType}: ${codebasePath}`);
+        const splitter = requestSplitter || this.codeSplitter;
 
         // 1. Compute ignore patterns for this codebase/request without
         // retaining file-based patterns from previous codebases.
@@ -372,7 +375,8 @@ export class Context {
                     total: totalFiles,
                     percentage: Math.round(progressPercentage)
                 });
-            }
+            },
+            splitter
         );
 
         console.log(`[Context] ✅ Codebase indexing completed! Processed ${result.processedFiles} files in total, generated ${result.totalChunks} code chunks`);
@@ -395,10 +399,12 @@ export class Context {
         codebasePath: string,
         progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
         additionalIgnorePatterns: string[] = [],
-        additionalSupportedExtensions: string[] = []
+        additionalSupportedExtensions: string[] = [],
+        requestSplitter?: Splitter
     ): Promise<{ added: number, removed: number, modified: number }> {
         const collectionName = this.getCollectionName(codebasePath);
         const synchronizer = this.synchronizers.get(collectionName);
+        const splitter = requestSplitter || this.codeSplitter;
 
         if (!synchronizer) {
             // Recreate the synchronizer with the same request-scoped options that
@@ -454,7 +460,8 @@ export class Context {
                 codebasePath,
                 (filePath, fileIndex, totalFiles) => {
                     updateProgress(`Indexed ${filePath} (${fileIndex}/${totalFiles})`);
-                }
+                },
+                splitter
             );
         }
 
@@ -810,7 +817,8 @@ export class Context {
     private async processFileList(
         filePaths: string[],
         codebasePath: string,
-        onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void
+        onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void,
+        splitter: Splitter = this.codeSplitter
     ): Promise<{ processedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const EMBEDDING_BATCH_SIZE = Math.max(1, parseInt(envManager.get('EMBEDDING_BATCH_SIZE') || '100', 10));
@@ -828,7 +836,7 @@ export class Context {
             try {
                 const content = await fs.promises.readFile(filePath, 'utf-8');
                 const language = this.getLanguageFromExtension(path.extname(filePath));
-                const chunks = await this.codeSplitter.split(content, language, filePath);
+                const chunks = await splitter.split(content, language, filePath);
 
                 // Log files with many chunks or large content
                 if (chunks.length > 50) {
```

**File**: `packages/mcp/src/config.ts` (modified, +3/-0)
```diff
@@ -33,8 +33,11 @@ export interface CodebaseSnapshotV1 {
 
 // New format (v2) - structured with codebase information
 
+export type RequestSplitterType = 'ast' | 'langchain';
+
 // Request-level indexing options stored with a codebase's snapshot entry.
 export interface CodebaseIndexOptions {
+    requestSplitter?: RequestSplitterType;
     requestCustomExtensions?: string[];
     requestIgnorePatterns?: string[];
 }
```

**File**: `packages/mcp/src/handlers.ts` (modified, +17/-21)
```diff
@@ -3,7 +3,8 @@ import * as path from "path";
 import * as crypto from "crypto";
 import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer } from "@zilliz/claude-context-core";
 import { SnapshotManager } from "./snapshot.js";
-import type { CodebaseIndexOptions } from "./config.js";
+import type { CodebaseIndexOptions, RequestSplitterType } from "./config.js";
+import { createRequestSplitter, isRequestSplitterType } from "./splitter.js";
 import { ensureAbsolutePath, truncateContent, trackCodebasePath } from "./utils.js";
 
 export class ToolHandlers {
@@ -315,28 +316,30 @@ export class ToolHandlers {
     public async handleIndexCodebase(args: any) {
         const { path: codebasePath, force, splitter, customExtensions, ignorePatterns } = args;
         const forceReindex = force || false;
-        const splitterType = splitter || 'ast'; // Default to AST
+        const requestedSplitter = splitter || 'ast'; // Default to AST
         const customFileExtensions = customExtensions || [];
         const customIgnorePatterns = ignorePatterns || [];
-        const indexOptions: CodebaseIndexOptions = {
-            requestCustomExtensions: customFileExtensions,
-            requestIgnorePatterns: customIgnorePatterns
-        };
 
         try {
             // Sync indexed codebases from cloud first
             await this.syncIndexedCodebasesFromCloud();
 
             // Validate splitter parameter
-            if (splitterType !== 'ast' && splitterType !== 'langchain') {
+            if (!isRequestSplitterType(requestedSplitter)) {
                 return {
                     content: [{
                         type: "text",
-                        text: `Error: Invalid splitter type '${splitterType}'. Must be 'ast' or 'langchain'.`
+                        text: `Error: Invalid splitter type '${requestedSplitter}'. Must be 'ast' or 'langchain'.`
                     }],
                     isError: true
                 };
             }
+            const splitterType: RequestSplitterType = requestedSplitter;
+            const indexOptions: CodebaseIndexOptions = {
+                requestSplitter: splitterType,
+                requestCustomExtensions: customFileExtensions,
+                requestIgnorePatterns: customIgnorePatterns
+            };
             // Force absolute path resolution - warn if relative path provided
             const absolutePath = ensureAbsolutePath(codebasePath);
 
@@ -513,7 +516,7 @@ export class ToolHandlers {
     private async startBackgroundIndexing(
         codebasePath: string,
         forceReindex: boolean,
-        splitterType: string,
+        splitterType: RequestSplitterType,
         customIgnorePatterns: string[] = [],
         customFileExtensions: string[] = [],
         indexOptions?: CodebaseIndexOptions
@@ -529,17 +532,13 @@ export class ToolHandlers {
                 console.log(`[BACKGROUND-INDEX] ℹ️  Force reindex mode - collection was already cleared during validation`);
             }
 
-            // Use the existing Context instance for indexing.
-            let contextForThisTask = this.context;
-            if (splitterType !== 'ast') {
-                console.warn(`[BACKGROUND-INDEX] Non-AST splitter '${splitterType}' requested; falling back to AST splitter`);
-            }
+            const requestSplitter = createRequestSplitter(splitterType);
 
             // Load ignore patterns from files first (including .ignore, .gitignore, etc.)
             // and merge them with this request's custom ignore patterns without
             // relying on shared Context state for this background indexing task.
-            const ignorePatterns = await contextForThisTask.getEffectiveIgnorePatterns(absolutePath, customIgnorePatterns);
-            const supportedExtensions = contextForThisTask.getEffectiveSupportedExtensions(customFileExtensions);
+            const ignorePatterns = await this.context.getEffectiveIgnorePatterns(absolutePath, customIgnorePatterns);
+            const supportedExtensions = this.context.getEffectiveSupportedExtensions(customFileExtensions);
 
             // Initialize file synchronizer with proper ignore patterns (including project-specific patterns)
             console.log(`[BACKGROUND-INDEX] Using ignore patterns: ${ignorePatterns.join(', ')}`);
@@ -553,9 +552,6 @@ export class ToolHandlers {
             await this.context.getPreparedCollection(absolutePath);
             const collectionName = this.context.getCollectionName(absolutePath);
             this.context.setSynchronizer(collectionName, synchronizer);
-            if (contextForThisTask !== this.context) {
-                contextForThisTask.setSynchronizer(collectionName, synchronizer);
-            }
 
             console.log(`[BACKGROUND-INDEX] Starting indexing with ${splitterType} splitter for: ${absolutePath}`);
 
@@ -565,7 +561,7 @@ export class ToolHandlers {
 
             // Start indexing with the appropriate context and progres
```

**File**: `packages/mcp/src/snapshot.request-options.test.ts` (modified, +8/-0)
```diff
@@ -39,6 +39,7 @@ test("preserves request-level index options across snapshot state transitions",
 
         const snapshotManager = new SnapshotManager();
         const indexOptions = {
+            requestSplitter: "langchain" as const,
             requestCustomExtensions: ["foo", ".vue"],
             requestIgnorePatterns: ["drafts/**", "*.tmp"]
         };
@@ -48,6 +49,7 @@ test("preserves request-level index options across snapshot state transitions",
 
         const indexingInfo = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(indexingInfo?.status, "indexing");
+        assert.equal(indexingInfo?.requestSplitter, "langchain");
         assert.deepEqual(indexingInfo?.requestCustomExtensions, ["foo", ".vue"]);
         assert.deepEqual(indexingInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
 
@@ -59,13 +61,15 @@ test("preserves request-level index options across snapshot state transitions",
 
         const indexedInfo = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(indexedInfo?.status, "indexed");
+        assert.equal(indexedInfo?.requestSplitter, "langchain");
         assert.deepEqual(indexedInfo?.requestCustomExtensions, ["foo", ".vue"]);
         assert.deepEqual(indexedInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
 
         snapshotManager.setCodebaseIndexFailed(codebasePath, "boom", 55);
 
         const failedInfo = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(failedInfo?.status, "indexfailed");
+        assert.equal(failedInfo?.requestSplitter, "langchain");
         assert.deepEqual(failedInfo?.requestCustomExtensions, ["foo", ".vue"]);
         assert.deepEqual(failedInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
     });
@@ -79,13 +83,15 @@ test("explicit empty request options clear previous request-level index options"
         const snapshotManager = new SnapshotManager();
 
         snapshotManager.setCodebaseIndexing(codebasePath, 0, {
+            requestSplitter: "langchain",
             requestCustomExtensions: ["foo"],
             requestIgnorePatterns: ["drafts/**"]
         });
         snapshotManager.setCodebaseIndexing(codebasePath, 0, {});
 
         const info = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(info?.status, "indexing");
+        assert.equal(info?.requestSplitter, undefined);
         assert.equal(info?.requestCustomExtensions, undefined);
         assert.equal(info?.requestIgnorePatterns, undefined);
     });
@@ -98,6 +104,7 @@ test("preserves request-level index options when interrupted indexing is loaded
 
         const firstSnapshotManager = new SnapshotManager();
         firstSnapshotManager.setCodebaseIndexing(codebasePath, 25, {
+            requestSplitter: "langchain",
             requestCustomExtensions: ["astro"],
             requestIgnorePatterns: ["drafts/**"]
         });
@@ -112,6 +119,7 @@ test("preserves request-level index options when interrupted indexing is loaded
             throw new Error("Expected interrupted indexing to load as indexfailed");
         }
         assert.equal(info.lastAttemptedPercentage, 25);
+        assert.equal(info?.requestSplitter, "langchain");
         assert.deepEqual(info?.requestCustomExtensions, ["astro"]);
         assert.deepEqual(info?.requestIgnorePatterns, ["drafts/**"]);
     });
```

**File**: `packages/mcp/src/snapshot.ts` (modified, +3/-0)
```diff
@@ -226,6 +226,9 @@ export class SnapshotManager {
 
     private getIndexOptions(options?: CodebaseIndexOptions): CodebaseIndexOptions {
         const indexOptions: CodebaseIndexOptions = {};
+        if (options?.requestSplitter === 'ast' || options?.requestSplitter === 'langchain') {
+            indexOptions.requestSplitter = options.requestSplitter;
+        }
         if (options?.requestCustomExtensions?.length) {
             indexOptions.requestCustomExtensions = options.requestCustomExtensions;
         }
```

**File**: `packages/mcp/src/splitter.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { AstCodeSplitter, LangChainCodeSplitter } from "@zilliz/claude-context-core";
+import type { Splitter } from "@zilliz/claude-context-core";
+import type { RequestSplitterType } from "./config.js";
+
+export function isRequestSplitterType(splitterType: unknown): splitterType is RequestSplitterType {
+    return splitterType === "ast" || splitterType === "langchain";
+}
+
+export function resolveRequestSplitterType(splitterType: unknown): RequestSplitterType {
+    return isRequestSplitterType(splitterType) ? splitterType : "ast";
+}
+
+export function createRequestSplitter(splitterType: RequestSplitterType): Splitter {
+    switch (splitterType) {
+        case "langchain":
+            return new LangChainCodeSplitter(1000, 200);
+        case "ast":
+            return new AstCodeSplitter(2500, 300);
+    }
+}
```

**File**: `packages/mcp/src/sync.ts` (modified, +5/-1)
```diff
@@ -3,6 +3,8 @@ import * as os from "os";
 import * as path from "path";
 import { Context, FileSynchronizer, envManager } from "@zilliz/claude-context-core";
 import { SnapshotManager } from "./snapshot.js";
+import type { RequestSplitterType } from "./config.js";
+import { createRequestSplitter, resolveRequestSplitterType } from "./splitter.js";
 
 const DEFAULT_SYNC_LOCK_STALE_MS = 10 * 60 * 1000;
 const SYNC_LOCK_STALE_ENV = "CLAUDE_CONTEXT_SYNC_LOCK_STALE_MS";
@@ -158,13 +160,15 @@ export class SyncManager {
                 try {
                     console.log(`[SYNC-DEBUG] Calling context.reindexByChange() for '${codebasePath}'`);
                     const codebaseInfo = this.snapshotManager.getCodebaseInfo(codebasePath);
+                    const requestSplitterType: RequestSplitterType = resolveRequestSplitterType(codebaseInfo?.requestSplitter);
                     const requestIgnorePatterns = codebaseInfo?.requestIgnorePatterns || [];
                     const requestCustomExtensions = codebaseInfo?.requestCustomExtensions || [];
                     const stats = await this.context.reindexByChange(
                         codebasePath,
                         undefined,
                         requestIgnorePatterns,
-                        requestCustomExtensions
+                        requestCustomExtensions,
+                        createRequestSplitter(requestSplitterType)
                     );
                     const codebaseElapsed = Date.now() - codebaseStartTime;
 
```

---

### Incident Patch 11: `be107de3` (2026-04-29)
**Commit Message**: fix(core): support root-anchored directory ignore patterns

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +46/-1)
```diff
@@ -3,8 +3,8 @@ import * as os from 'os';
 import * as path from 'path';
 import { Context } from './context';
 import { Embedding, EmbeddingVector } from './embedding';
-import { FileSynchronizer } from './sync/synchronizer';
 import { Splitter, CodeChunk } from './splitter';
+import { FileSynchronizer } from './sync/synchronizer';
 import { VectorDatabase } from './vectordb';
 
 class TestEmbedding extends Embedding {
@@ -181,4 +181,49 @@ describe('Context ignore pattern isolation', () => {
         }
     });
 
+    it('treats leading-slash directory ignore patterns as root-anchored and recursive during indexing', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(path.join(project, 'Library'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src', 'Library'), { recursive: true });
+        await fs.writeFile(path.join(project, '.gitignore'), '/Library/\n');
+        await fs.writeFile(path.join(project, 'Library', 'generated.md'), 'root library should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'Library', 'nested.md'), 'nested library should stay');
+        await fs.writeFile(path.join(project, 'src', 'keep.md'), 'regular file should stay');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual([
+            'src/Library/nested.md',
+            'src/keep.md',
+        ]);
+    });
+
+    it('treats leading-slash directory ignore patterns as root-anchored and recursive during sync', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(path.join(project, 'Library'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src', 'Library'), { recursive: true });
+        await fs.writeFile(path.join(project, 'Library', 'generated.md'), 'root library should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'Library', 'nested.md'), 'nested library should stay');
+        await fs.writeFile(path.join(project, 'src', 'keep.md'), 'regular file should stay');
+
+        const synchronizer = new FileSynchronizer(project, ['/Library/'], ['.md']);
+        const fileHashes = await (synchronizer as any).generateFileHashes(project) as Map<string, string>;
+
+        expect(fileHashes.has(path.join('Library', 'generated.md'))).toBe(false);
+        expect(fileHashes.has(path.join('src', 'Library', 'nested.md'))).toBe(true);
+        expect(fileHashes.has(path.join('src', 'keep.md'))).toBe(true);
+    });
 });
```

**File**: `packages/core/src/context.ts` (modified, +39/-8)
```diff
@@ -1187,24 +1187,55 @@ export class Context {
      * @returns True if pattern matches
      */
     private isPatternMatch(filePath: string, pattern: string): boolean {
+        const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
+        const normalizedPattern = pattern.replace(/\\/g, '/');
+        const cleanPattern = normalizedPattern.replace(/^\/+|\/+$/g, '');
+        const isRootAnchored = normalizedPattern.startsWith('/');
+        const isDirectoryPattern = normalizedPattern.endsWith('/');
+
+        if (!cleanPath || !cleanPattern) {
+            return false;
+        }
+
         // Handle directory patterns (ending with /)
-        if (pattern.endsWith('/')) {
-            const dirPattern = pattern.slice(0, -1);
-            const pathParts = filePath.split('/');
-            return pathParts.some(part => this.simpleGlobMatch(part, dirPattern));
+        if (isDirectoryPattern) {
+            if (isRootAnchored) {
+                return this.simpleGlobMatch(cleanPath, cleanPattern) ||
+                    cleanPath.startsWith(`${cleanPattern}/`);
+            }
+
+            return this.matchesDirectoryPattern(cleanPath, cleanPattern);
+        }
+
+        if (isRootAnchored) {
+            return this.simpleGlobMatch(cleanPath, cleanPattern);
         }
 
         // Handle file patterns
-        if (pattern.includes('/')) {
+        if (cleanPattern.includes('/')) {
             // Pattern with path separator - match exact path
-            return this.simpleGlobMatch(filePath, pattern);
+            return this.simpleGlobMatch(cleanPath, cleanPattern);
         } else {
             // Pattern without path separator - match filename in any directory
-            const fileName = path.basename(filePath);
-            return this.simpleGlobMatch(fileName, pattern);
+            const fileName = path.basename(cleanPath);
+            return this.simpleGlobMatch(fileName, cleanPattern);
         }
     }
 
+    private matchesDirectoryPattern(filePath: string, dirPattern: string): boolean {
+        const pathParts = filePath.split('/');
+        const dirPartCount = dirPattern.split('/').length;
+
+        for (let i = 0; i <= pathParts.length - dirPartCount; i++) {
+            const candidate = pathParts.slice(i, i + dirPartCount).join('/');
+            if (this.simpleGlobMatch(candidate, dirPattern)) {
+                return true;
+            }
+        }
+
+        return false;
+    }
+
     /**
      * Simple glob matching supporting * wildcard
      * @param text Text to test
```

**File**: `packages/core/src/sync/synchronizer.ts` (modified, +36/-32)
```diff
@@ -57,7 +57,7 @@ export class FileSynchronizer {
             const relativePath = path.relative(this.rootDir, fullPath);
 
             // Check if this path should be ignored BEFORE any file system operations
-            if (this.shouldIgnore(relativePath, entry.isDirectory())) {
+            if (this.shouldIgnore(relativePath)) {
                 continue; // Skip completely - no access at all
             }
 
@@ -72,7 +72,7 @@ export class FileSynchronizer {
 
             if (stat.isDirectory()) {
                 // Verify it's really a directory and not ignored
-                if (!this.shouldIgnore(relativePath, true)) {
+                if (!this.shouldIgnore(relativePath)) {
                     const subHashes = await this.generateFileHashes(fullPath);
                     const entries = Array.from(subHashes.entries());
                     for (let i = 0; i < entries.length; i++) {
@@ -82,7 +82,7 @@ export class FileSynchronizer {
                 }
             } else if (stat.isFile()) {
                 // Verify it's really a file and not ignored
-                if (!this.shouldIgnore(relativePath, false)) {
+                if (!this.shouldIgnore(relativePath)) {
                     const ext = path.extname(entry.name);
                     if (this.supportedExtensions.length > 0 && !this.supportedExtensions.includes(ext)) {
                         continue;
@@ -101,7 +101,7 @@ export class FileSynchronizer {
         return fileHashes;
     }
 
-    private shouldIgnore(relativePath: string, isDirectory: boolean = false): boolean {
+    private shouldIgnore(relativePath: string): boolean {
         // Always ignore hidden files and directories (starting with .)
         const pathParts = relativePath.split(path.sep);
         if (pathParts.some(part => part.startsWith('.'))) {
@@ -121,7 +121,7 @@ export class FileSynchronizer {
 
         // Check direct pattern matches first
         for (const pattern of this.ignorePatterns) {
-            if (this.matchPattern(normalizedPath, pattern, isDirectory)) {
+            if (this.matchPattern(normalizedPath, pattern)) {
                 return true;
             }
         }
@@ -131,49 +131,39 @@ export class FileSynchronizer {
         for (let i = 0; i < normalizedPathParts.length; i++) {
             const partialPath = normalizedPathParts.slice(0, i + 1).join('/');
             for (const pattern of this.ignorePatterns) {
-                // Check directory patterns
-                if (pattern.endsWith('/')) {
-                    const dirPattern = pattern.slice(0, -1);
-                    if (this.simpleGlobMatch(partialPath, dirPattern) ||
-                        this.simpleGlobMatch(normalizedPathParts[i], dirPattern)) {
-                        return true;
-                    }
-                }
-                // Check exact path patterns
-                else if (pattern.includes('/')) {
-                    if (this.simpleGlobMatch(partialPath, pattern)) {
-                        return true;
-                    }
-                }
-                // Check filename patterns against any path component
-                else {
-                    if (this.simpleGlobMatch(normalizedPathParts[i], pattern)) {
-                        return true;
-                    }
+                if (this.matchPattern(partialPath, pattern)) {
+                    return true;
                 }
             }
         }
 
         return false;
     }
 
-    private matchPattern(filePath: string, pattern: string, isDirectory: boolean = false): boolean {
+    private matchPattern(filePath: string, pattern: string): boolean {
         // Clean both path and pattern
         const cleanPath = filePath.replace(/^\/+|\/+$/g, '');
-        const cleanPattern = pattern.replace(/^\/+|\/+$/g, '');
+        const normalizedPattern = pattern.replace(/\\/g, '/');
+        const cleanPattern = normalizedPattern.replace(/^\/+|\/+$/g, '');
+        const isRootAnchored = normalizedPattern.startsWith('/');
+        const isDirectoryPattern = normalizedPattern.endsWith('/');
 
         if (!cleanPath || !cleanPattern) {
             return false;
         }
 
         // Handle directory patterns (ending with /)
-        if (pattern.endsWith('/')) {
-            if (!isDirectory) return false; // Directory pattern only matches directories
-            const dirPattern = cleanPattern.slice(0, -1);
+        if (isDirectoryPattern) {
+            if (isRootAnchored) {
+                return this.simpleGlobMatch(cleanPath, cleanPattern) ||
+                    cleanPath.startsWith(`${cleanPattern}/`);
+            }
+
+            return this.matchesDirectoryPattern(cleanPath, cleanPattern);
+        }
 
-            // Direct match or any path component matches
-            return this.simpleGlobMatch(cleanPath, dirPattern) ||
-                cleanPath.split('/').some(part => this.simpleGlobMatch(part, dirPattern));
+        if (isRootAnchored) {
+
```

---

### Incident Patch 12: `d2ef81c4` (2026-04-29)
**Commit Message**: fix(mcp): persist request-level index options for sync

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +25/-0)
```diff
@@ -3,6 +3,7 @@ import * as os from 'os';
 import * as path from 'path';
 import { Context } from './context';
 import { Embedding, EmbeddingVector } from './embedding';
+import { FileSynchronizer } from './sync/synchronizer';
 import { Splitter, CodeChunk } from './splitter';
 import { VectorDatabase } from './vectordb';
 
@@ -156,4 +157,28 @@ describe('Context ignore pattern isolation', () => {
         await context.indexCodebase(projectB);
         expect(vectorDatabase.insert).not.toHaveBeenCalled();
     });
+
+    it('uses request options when recreating a synchronizer for change indexing', async () => {
+        const project = path.join(tempRoot, 'project-with-options');
+        await fs.mkdir(project);
+        await fs.writeFile(path.join(project, 'custom.foo'), 'custom extension file');
+        await fs.writeFile(path.join(project, 'ignored.ts'), 'ignored by request pattern');
+
+        const context = new Context({ vectorDatabase: createVectorDatabase() });
+
+        try {
+            await context.reindexByChange(project, undefined, ['*.ts'], ['foo']);
+
+            const collectionName = context.getCollectionName(project);
+            const synchronizer = context.getSynchronizers().get(collectionName);
+
+            expect(synchronizer).toBeDefined();
+            expect(synchronizer?.getFileHash('custom.foo')).toBeDefined();
+            expect(synchronizer?.getFileHash('ignored.ts')).toBeUndefined();
+            expect(context.getSupportedExtensions()).not.toContain('.foo');
+        } finally {
+            await FileSynchronizer.deleteSnapshot(project);
+        }
+    });
+
 });
```

**File**: `packages/core/src/context.ts` (modified, +8/-4)
```diff
@@ -393,17 +393,21 @@ export class Context {
 
     async reindexByChange(
         codebasePath: string,
-        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void
+        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
+        additionalIgnorePatterns: string[] = [],
+        additionalSupportedExtensions: string[] = []
     ): Promise<{ added: number, removed: number, modified: number }> {
         const collectionName = this.getCollectionName(codebasePath);
         const synchronizer = this.synchronizers.get(collectionName);
 
         if (!synchronizer) {
-            // Load project-specific ignore patterns before creating FileSynchronizer.
-            const ignorePatterns = await this.loadIgnorePatterns(codebasePath);
+            // Recreate the synchronizer with the same request-scoped options that
+            // were used for the original indexing task.
+            const ignorePatterns = await this.loadIgnorePatterns(codebasePath, additionalIgnorePatterns);
+            const supportedExtensions = this.getEffectiveSupportedExtensions(additionalSupportedExtensions);
 
             // To be safe, let's initialize if it's not there.
-            const newSynchronizer = new FileSynchronizer(codebasePath, ignorePatterns, this.supportedExtensions);
+            const newSynchronizer = new FileSynchronizer(codebasePath, ignorePatterns, supportedExtensions);
             await newSynchronizer.initialize();
             this.synchronizers.set(collectionName, newSynchronizer);
         }
```

**File**: `packages/mcp/package.json` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@
         "lint": "eslint src --ext .ts",
         "lint:fix": "eslint src --ext .ts --fix",
         "typecheck": "tsc --noEmit",
+        "test": "node --import tsx --test \"src/**/*.test.ts\"",
         "start": "tsx src/index.ts",
         "start:with-env": "OPENAI_API_KEY=${OPENAI_API_KEY:your-api-key-here} MILVUS_ADDRESS=${MILVUS_ADDRESS:localhost:19530} tsx src/index.ts",
         "prepublishOnly": "pnpm build"
```

**File**: `packages/mcp/src/config.ts` (modified, +7/-1)
```diff
@@ -33,8 +33,14 @@ export interface CodebaseSnapshotV1 {
 
 // New format (v2) - structured with codebase information
 
+// Request-level indexing options stored with a codebase's snapshot entry.
+export interface CodebaseIndexOptions {
+    requestCustomExtensions?: string[];
+    requestIgnorePatterns?: string[];
+}
+
 // Base interface for common fields
-interface CodebaseInfoBase {
+interface CodebaseInfoBase extends CodebaseIndexOptions {
     lastUpdated: string;
 }
 
```

**File**: `packages/mcp/src/handlers.ts` (modified, +11/-5)
```diff
@@ -3,6 +3,7 @@ import * as path from "path";
 import * as crypto from "crypto";
 import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer } from "@zilliz/claude-context-core";
 import { SnapshotManager } from "./snapshot.js";
+import type { CodebaseIndexOptions } from "./config.js";
 import { ensureAbsolutePath, truncateContent, trackCodebasePath } from "./utils.js";
 
 export class ToolHandlers {
@@ -317,6 +318,10 @@ export class ToolHandlers {
         const splitterType = splitter || 'ast'; // Default to AST
         const customFileExtensions = customExtensions || [];
         const customIgnorePatterns = ignorePatterns || [];
+        const indexOptions: CodebaseIndexOptions = {
+            requestCustomExtensions: customFileExtensions,
+            requestIgnorePatterns: customIgnorePatterns
+        };
 
         try {
             // Sync indexed codebases from cloud first
@@ -462,14 +467,14 @@ export class ToolHandlers {
             }
 
             // Set to indexing status and save snapshot immediately
-            this.snapshotManager.setCodebaseIndexing(absolutePath, 0);
+            this.snapshotManager.setCodebaseIndexing(absolutePath, 0, indexOptions);
             this.snapshotManager.saveCodebaseSnapshot();
 
             // Track the codebase path for syncing
             trackCodebasePath(absolutePath);
 
             // Start background indexing - now safe to proceed
-            this.startBackgroundIndexing(absolutePath, forceReindex, splitterType, customIgnorePatterns, customFileExtensions);
+            this.startBackgroundIndexing(absolutePath, forceReindex, splitterType, customIgnorePatterns, customFileExtensions, indexOptions);
 
             const pathInfo = codebasePath !== absolutePath
                 ? `\nNote: Input path '${codebasePath}' was resolved to absolute path '${absolutePath}'`
@@ -510,7 +515,8 @@ export class ToolHandlers {
         forceReindex: boolean,
         splitterType: string,
         customIgnorePatterns: string[] = [],
-        customFileExtensions: string[] = []
+        customFileExtensions: string[] = [],
+        indexOptions?: CodebaseIndexOptions
     ) {
         const absolutePath = codebasePath;
         let lastSaveTime = 0; // Track last save timestamp
@@ -576,7 +582,7 @@ export class ToolHandlers {
             console.log(`[BACKGROUND-INDEX] ✅ Indexing completed successfully! Files: ${stats.indexedFiles}, Chunks: ${stats.totalChunks}`);
 
             // Set codebase to indexed status with complete statistics
-            this.snapshotManager.setCodebaseIndexed(absolutePath, stats);
+            this.snapshotManager.setCodebaseIndexed(absolutePath, stats, indexOptions);
             this.indexingStats = { indexedFiles: stats.indexedFiles, totalChunks: stats.totalChunks };
 
             // Save snapshot after updating codebase lists
@@ -597,7 +603,7 @@ export class ToolHandlers {
 
             // Set codebase to failed status with error information
             const errorMessage = error.message || String(error);
-            this.snapshotManager.setCodebaseIndexFailed(absolutePath, errorMessage, lastProgress);
+            this.snapshotManager.setCodebaseIndexFailed(absolutePath, errorMessage, lastProgress, indexOptions);
             this.snapshotManager.saveCodebaseSnapshot();
 
             // Log error but don't crash MCP service - indexing errors are handled gracefully
```

**File**: `packages/mcp/src/snapshot.request-options.test.ts` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import * as fs from "node:fs/promises";
+import * as os from "node:os";
+import * as path from "node:path";
+import { SnapshotManager } from "./snapshot.js";
+
+async function withTempHome(run: (tempRoot: string) => Promise<void>): Promise<void> {
+    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-context-mcp-snapshot-"));
+    const homeDir = path.join(tempRoot, "home");
+    const originalHome = process.env.HOME;
+    const originalUserProfile = process.env.USERPROFILE;
+
+    process.env.HOME = homeDir;
+    process.env.USERPROFILE = homeDir;
+
+    try {
+        await fs.mkdir(path.join(homeDir, ".context"), { recursive: true });
+        await run(tempRoot);
+    } finally {
+        if (originalHome === undefined) {
+            delete process.env.HOME;
+        } else {
+            process.env.HOME = originalHome;
+        }
+        if (originalUserProfile === undefined) {
+            delete process.env.USERPROFILE;
+        } else {
+            process.env.USERPROFILE = originalUserProfile;
+        }
+        await fs.rm(tempRoot, { recursive: true, force: true });
+    }
+}
+
+test("preserves request-level index options across snapshot state transitions", async () => {
+    await withTempHome(async (tempRoot) => {
+        const codebasePath = path.join(tempRoot, "repo");
+        await fs.mkdir(codebasePath);
+
+        const snapshotManager = new SnapshotManager();
+        const indexOptions = {
+            requestCustomExtensions: ["foo", ".vue"],
+            requestIgnorePatterns: ["drafts/**", "*.tmp"]
+        };
+
+        snapshotManager.setCodebaseIndexing(codebasePath, 0, indexOptions);
+        snapshotManager.setCodebaseIndexing(codebasePath, 42);
+
+        const indexingInfo = snapshotManager.getCodebaseInfo(codebasePath);
+        assert.equal(indexingInfo?.status, "indexing");
+        assert.deepEqual(indexingInfo?.requestCustomExtensions, ["foo", ".vue"]);
+        assert.deepEqual(indexingInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
+
+        snapshotManager.setCodebaseIndexed(codebasePath, {
+            indexedFiles: 1,
+            totalChunks: 2,
+            status: "completed"
+        });
+
+        const indexedInfo = snapshotManager.getCodebaseInfo(codebasePath);
+        assert.equal(indexedInfo?.status, "indexed");
+        assert.deepEqual(indexedInfo?.requestCustomExtensions, ["foo", ".vue"]);
+        assert.deepEqual(indexedInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
+
+        snapshotManager.setCodebaseIndexFailed(codebasePath, "boom", 55);
+
+        const failedInfo = snapshotManager.getCodebaseInfo(codebasePath);
+        assert.equal(failedInfo?.status, "indexfailed");
+        assert.deepEqual(failedInfo?.requestCustomExtensions, ["foo", ".vue"]);
+        assert.deepEqual(failedInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
+    });
+});
+
+test("explicit empty request options clear previous request-level index options", async () => {
+    await withTempHome(async (tempRoot) => {
+        const codebasePath = path.join(tempRoot, "repo");
+        await fs.mkdir(codebasePath);
+
+        const snapshotManager = new SnapshotManager();
+
+        snapshotManager.setCodebaseIndexing(codebasePath, 0, {
+            requestCustomExtensions: ["foo"],
+            requestIgnorePatterns: ["drafts/**"]
+        });
+        snapshotManager.setCodebaseIndexing(codebasePath, 0, {});
+
+        const info = snapshotManager.getCodebaseInfo(codebasePath);
+        assert.equal(info?.status, "indexing");
+        assert.equal(info?.requestCustomExtensions, undefined);
+        assert.equal(info?.requestIgnorePatterns, undefined);
+    });
+});
+
+test("preserves request-level index options when interrupted indexing is loaded as failed", async () => {
+    await withTempHome(async (tempRoot) => {
+        const codebasePath = path.join(tempRoot, "repo");
+        await fs.mkdir(codebasePath);
+
+        const firstSnapshotManager = new SnapshotManager();
+        firstSnapshotManager.setCodebaseIndexing(codebasePath, 25, {
+            requestCustomExtensions: ["astro"],
+            requestIgnorePatterns: ["drafts/**"]
+        });
+        firstSnapshotManager.saveCodebaseSnapshot();
+
+        const secondSnapshotManager = new SnapshotManager();
+        secondSnapshotManager.loadCodebaseSnapshot();
+
+        const info = secondSnapshotManager.getCodebaseInfo(codebasePath);
+        assert.equal(info?.status, "indexfailed");
+        if (!info || info.status !== "indexfailed") {
+            throw new Error("Expected interrupted indexing to load as indexfailed");
+        }
+        assert.equal(info.lastAttemptedPercentage, 25);
+        assert.deepEqual(info?.requestCustomExtensions, ["astro"]);
+        assert.deepEqual(info?.requestIgnorePatterns, ["drafts/**"]);
+    });
+});
```

**File**: `packages/mcp/src/snapshot.ts` (modified, +31/-3)
```diff
@@ -6,6 +6,7 @@ import {
     CodebaseSnapshotV1,
     CodebaseSnapshotV2,
     CodebaseInfo,
+    CodebaseIndexOptions,
     CodebaseInfoIndexing,
     CodebaseInfoIndexed,
     CodebaseInfoIndexFailed
@@ -124,6 +125,7 @@ export class SnapshotManager {
                     status: 'indexfailed',
                     errorMessage: 'Indexing was interrupted (MCP server restarted)',
                     lastAttemptedPercentage: info.indexingPercentage,
+                    ...this.getIndexOptions(info),
                     lastUpdated: new Date().toISOString()
                 };
                 validCodebaseInfoMap.set(codebasePath, failedInfo);
@@ -222,6 +224,21 @@ export class SnapshotManager {
         return bestMatch;
     }
 
+    private getIndexOptions(options?: CodebaseIndexOptions): CodebaseIndexOptions {
+        const indexOptions: CodebaseIndexOptions = {};
+        if (options?.requestCustomExtensions?.length) {
+            indexOptions.requestCustomExtensions = options.requestCustomExtensions;
+        }
+        if (options?.requestIgnorePatterns?.length) {
+            indexOptions.requestIgnorePatterns = options.requestIgnorePatterns;
+        }
+        return indexOptions;
+    }
+
+    private resolveIndexOptions(codebasePath: string, options?: CodebaseIndexOptions): CodebaseIndexOptions {
+        return this.getIndexOptions(options ?? this.codebaseInfoMap.get(codebasePath));
+    }
+
     public findIndexedCodebasePath(codebasePath: string): string | undefined {
         return this.findBestMatchingCodebasePath(codebasePath, this.getIndexedCodebases());
     }
@@ -374,17 +391,20 @@ export class SnapshotManager {
     /**
      * Set codebase to indexing status
      */
-    public setCodebaseIndexing(codebasePath: string, progress: number = 0): void {
+    public setCodebaseIndexing(codebasePath: string, progress: number = 0, indexOptions?: CodebaseIndexOptions): void {
         this.indexingCodebases.set(codebasePath, progress);
 
         // Remove from other states
         this.indexedCodebases = this.indexedCodebases.filter(path => path !== codebasePath);
         this.codebaseFileCount.delete(codebasePath);
 
+        const resolvedIndexOptions = this.resolveIndexOptions(codebasePath, indexOptions);
+
         // Update info map
         const info: CodebaseInfoIndexing = {
             status: 'indexing',
             indexingPercentage: progress,
+            ...resolvedIndexOptions,
             lastUpdated: new Date().toISOString()
         };
         this.codebaseInfoMap.set(codebasePath, info);
@@ -395,7 +415,8 @@ export class SnapshotManager {
      */
     public setCodebaseIndexed(
         codebasePath: string,
-        stats: { indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }
+        stats: { indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' },
+        indexOptions?: CodebaseIndexOptions
     ): void {
         // Defensive guard: 0/0 + completed is a known-bad state that causes an
         // infinite force-reindex loop — the client reads it as "not indexed",
@@ -418,11 +439,14 @@ export class SnapshotManager {
         // Update file count and info
         this.codebaseFileCount.set(codebasePath, stats.indexedFiles);
 
+        const resolvedIndexOptions = this.resolveIndexOptions(codebasePath, indexOptions);
+
         const info: CodebaseInfoIndexed = {
             status: 'indexed',
             indexedFiles: stats.indexedFiles,
             totalChunks: stats.totalChunks,
             indexStatus: stats.status,
+            ...resolvedIndexOptions,
             lastUpdated: new Date().toISOString()
         };
         this.codebaseInfoMap.set(codebasePath, info);
@@ -434,18 +458,22 @@ export class SnapshotManager {
     public setCodebaseIndexFailed(
         codebasePath: string,
         errorMessage: string,
-        lastAttemptedPercentage?: number
+        lastAttemptedPercentage?: number,
+        indexOptions?: CodebaseIndexOptions
     ): void {
         // Remove from other states
         this.indexedCodebases = this.indexedCodebases.filter(path => path !== codebasePath);
         this.indexingCodebases.delete(codebasePath);
         this.codebaseFileCount.delete(codebasePath);
 
+        const resolvedIndexOptions = this.resolveIndexOptions(codebasePath, indexOptions);
+
         // Update info map
         const info: CodebaseInfoIndexFailed = {
             status: 'indexfailed',
             errorMessage: errorMessage,
             lastAttemptedPercentage: lastAttemptedPercentage,
+            ...resolvedIndexOptions,
             lastUpdated: new Date().toISOString()
         };
         this.codebaseInfoMap.set(codebasePath, info);
```

**File**: `packages/mcp/src/sync.ts` (modified, +9/-1)
```diff
@@ -157,7 +157,15 @@ export class SyncManager {
 
                 try {
                     console.log(`[SYNC-DEBUG] Calling context.reindexByChange() for '${codebasePath}'`);
-                    const stats = await this.context.reindexByChange(codebasePath);
+                    const codebaseInfo = this.snapshotManager.getCodebaseInfo(codebasePath);
+                    const requestIgnorePatterns = codebaseInfo?.requestIgnorePatterns || [];
+                    const requestCustomExtensions = codebaseInfo?.requestCustomExtensions || [];
+                    const stats = await this.context.reindexByChange(
+                        codebasePath,
+                        undefined,
+                        requestIgnorePatterns,
+                        requestCustomExtensions
+                    );
                     const codebaseElapsed = Date.now() - codebaseStartTime;
 
                     console.log(`[SYNC-DEBUG] Reindex stats for '${codebasePath}':`, stats);
```

---

### Incident Patch 13: `968cce69` (2026-04-29)
**Commit Message**: fix(mcp): clean up orphan merkle snapshots

**File**: `packages/mcp/src/handlers.ts` (modified, +8/-2)
```diff
@@ -1,7 +1,7 @@
 import * as fs from "fs";
 import * as path from "path";
 import * as crypto from "crypto";
-import { Context, COLLECTION_LIMIT_MESSAGE } from "@zilliz/claude-context-core";
+import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer } from "@zilliz/claude-context-core";
 import { SnapshotManager } from "./snapshot.js";
 import { ensureAbsolutePath, truncateContent, trackCodebasePath } from "./utils.js";
 
@@ -267,6 +267,13 @@ export class ToolHandlers {
                 if (!cloudCodebases.has(localCodebase)) {
                     this.snapshotManager.removeCodebaseCompletely(localCodebase);
                     hasChanges = true;
+
+                    try {
+                        await FileSynchronizer.deleteSnapshot(localCodebase);
+                    } catch (error: any) {
+                        console.warn(`[SYNC-CLOUD] ⚠️  Failed to delete local merkle snapshot for removed codebase '${localCodebase}':`, error?.message || error);
+                    }
+
                     console.log(`[SYNC-CLOUD] ➖ Removed local codebase (not in cloud): ${localCodebase}`);
                 }
             }
@@ -529,7 +536,6 @@ export class ToolHandlers {
             const supportedExtensions = contextForThisTask.getEffectiveSupportedExtensions(customFileExtensions);
 
             // Initialize file synchronizer with proper ignore patterns (including project-specific patterns)
-            const { FileSynchronizer } = await import("@zilliz/claude-context-core");
             console.log(`[BACKGROUND-INDEX] Using ignore patterns: ${ignorePatterns.join(', ')}`);
             if (customFileExtensions.length > 0) {
                 console.log(`[BACKGROUND-INDEX] Using ${customFileExtensions.length} request-scoped custom extensions: ${customFileExtensions.join(', ')}`);
```

---

### Incident Patch 14: `a83f2607` (2026-04-29)
**Commit Message**: fix(mcp): pass embedding dimension to Ollama

**File**: `packages/mcp/README.md` (modified, +4/-0)
```diff
@@ -130,6 +130,9 @@ EMBEDDING_MODEL=nomic-embed-text
 
 # Optional: Specify Ollama host (default: http://127.0.0.1:11434)
 OLLAMA_HOST=http://127.0.0.1:11434
+
+# Optional: Override embedding dimension to skip runtime dimension detection
+EMBEDDING_DIMENSION=768
 ```
 
 **Setup Instructions:**
@@ -388,6 +391,7 @@ Pasting the following configuration into your Cursor `~/.cursor/mcp.json` file i
         "EMBEDDING_PROVIDER": "Ollama",
         "EMBEDDING_MODEL": "nomic-embed-text",
         "OLLAMA_HOST": "http://127.0.0.1:11434",
+        "EMBEDDING_DIMENSION": "768",
         "MILVUS_TOKEN": "your-zilliz-cloud-api-key"
       }
     }
```

**File**: `packages/mcp/src/config.ts` (modified, +22/-0)
```diff
@@ -17,6 +17,7 @@ export interface ContextMcpConfig {
     // Ollama configuration
     ollamaModel?: string;
     ollamaHost?: string;
+    ollamaDimension?: number;
     // Vector database configuration
     milvusAddress?: string; // Optional, can be auto-resolved from token
     milvusToken?: string;
@@ -108,11 +109,27 @@ export function getEmbeddingModelForProvider(provider: string): string {
     }
 }
 
+function getPositiveIntegerFromEnv(name: string): number | undefined {
+    const rawValue = envManager.get(name);
+    if (!rawValue) {
+        return undefined;
+    }
+
+    const parsedValue = Number(rawValue);
+    if (Number.isInteger(parsedValue) && parsedValue > 0) {
+        return parsedValue;
+    }
+
+    console.warn(`[DEBUG] ⚠️  Ignoring invalid ${name}: ${rawValue}. Expected a positive integer.`);
+    return undefined;
+}
+
 export function createMcpConfig(): ContextMcpConfig {
     // Debug: Print all environment variables related to Context
     console.log(`[DEBUG] 🔍 Environment Variables Debug:`);
     console.log(`[DEBUG]   EMBEDDING_PROVIDER: ${envManager.get('EMBEDDING_PROVIDER') || 'NOT SET'}`);
     console.log(`[DEBUG]   EMBEDDING_MODEL: ${envManager.get('EMBEDDING_MODEL') || 'NOT SET'}`);
+    console.log(`[DEBUG]   EMBEDDING_DIMENSION: ${envManager.get('EMBEDDING_DIMENSION') || 'NOT SET'}`);
     console.log(`[DEBUG]   OLLAMA_MODEL: ${envManager.get('OLLAMA_MODEL') || 'NOT SET'}`);
     console.log(`[DEBUG]   GEMINI_API_KEY: ${envManager.get('GEMINI_API_KEY') ? 'SET (length: ' + envManager.get('GEMINI_API_KEY')!.length + ')' : 'NOT SET'}`);
     console.log(`[DEBUG]   OPENAI_API_KEY: ${envManager.get('OPENAI_API_KEY') ? 'SET (length: ' + envManager.get('OPENAI_API_KEY')!.length + ')' : 'NOT SET'}`);
@@ -137,6 +154,7 @@ export function createMcpConfig(): ContextMcpConfig {
         // Ollama configuration
         ollamaModel: envManager.get('OLLAMA_MODEL'),
         ollamaHost: envManager.get('OLLAMA_HOST'),
+        ollamaDimension: getPositiveIntegerFromEnv('EMBEDDING_DIMENSION'),
         // Vector database configuration - address can be auto-resolved from token
         milvusAddress: envManager.get('MILVUS_ADDRESS'), // Optional, can be resolved from token
         milvusToken: envManager.get('MILVUS_TOKEN'),
@@ -181,6 +199,9 @@ export function logConfigurationSummary(config: ContextMcpConfig): void {
         case 'Ollama':
             console.log(`[MCP]   Ollama Host: ${config.ollamaHost || 'http://127.0.0.1:11434'}`);
             console.log(`[MCP]   Ollama Model: ${config.embeddingModel}`);
+            if (config.ollamaDimension) {
+                console.log(`[MCP]   Ollama Embedding Dimension: ${config.ollamaDimension}`);
+            }
             break;
     }
 
@@ -203,6 +224,7 @@ Environment Variables:
   Embedding Provider Configuration:
   EMBEDDING_PROVIDER      Embedding provider: OpenAI, VoyageAI, Gemini, Ollama, OpenRouter (default: OpenAI)
   EMBEDDING_MODEL         Embedding model name (works for all providers)
+  EMBEDDING_DIMENSION     Optional embedding dimension override for Ollama
   
   Provider-specific API Keys:
   OPENAI_API_KEY          OpenAI API key (required for OpenAI provider)
```

**File**: `packages/mcp/src/embedding.ts` (modified, +5/-4)
```diff
@@ -64,10 +64,11 @@ export function createEmbeddingInstance(config: ContextMcpConfig): OpenAIEmbeddi
 
         case 'Ollama':
             const ollamaHost = config.ollamaHost || 'http://127.0.0.1:11434';
-            console.log(`[EMBEDDING] 🔧 Configuring Ollama with model: ${config.embeddingModel}, host: ${ollamaHost}`);
+            console.log(`[EMBEDDING] 🔧 Configuring Ollama with model: ${config.embeddingModel}, host: ${ollamaHost}${config.ollamaDimension ? `, dimension: ${config.ollamaDimension}` : ''}`);
             const ollamaEmbedding = new OllamaEmbedding({
                 model: config.embeddingModel,
-                host: ollamaHost
+                host: ollamaHost,
+                ...(config.ollamaDimension && { dimension: config.ollamaDimension })
             });
             console.log(`[EMBEDDING] ✅ Ollama embedding instance created successfully`);
             return ollamaEmbedding;
@@ -97,7 +98,7 @@ export function logEmbeddingProviderInfo(config: ContextMcpConfig, embedding: Op
             console.log(`[EMBEDDING] OpenRouter configuration - API Key: ${config.openrouterApiKey ? '✅ Provided' : '❌ Missing'}`);
             break;
         case 'Ollama':
-            console.log(`[EMBEDDING] Ollama configuration - Host: ${config.ollamaHost || 'http://127.0.0.1:11434'}, Model: ${config.embeddingModel}`);
+            console.log(`[EMBEDDING] Ollama configuration - Host: ${config.ollamaHost || 'http://127.0.0.1:11434'}, Model: ${config.embeddingModel}${config.ollamaDimension ? `, Dimension: ${config.ollamaDimension}` : ''}`);
             break;
     }
-} 
\ No newline at end of file
+}
```

---

### Incident Patch 15: `b56ca043` (2026-04-29)
**Commit Message**: fix(mcp): scope customExtensions to index request

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +102/-15)
```diff
@@ -2,35 +2,82 @@ import * as fs from 'fs/promises';
 import * as os from 'os';
 import * as path from 'path';
 import { Context } from './context';
+import { Embedding, EmbeddingVector } from './embedding';
+import { Splitter, CodeChunk } from './splitter';
 import { VectorDatabase } from './vectordb';
 
-const createVectorDatabase = (): VectorDatabase => ({
-    createCollection: jest.fn(),
-    createHybridCollection: jest.fn(),
-    dropCollection: jest.fn(),
-    hasCollection: jest.fn(),
-    listCollections: jest.fn(),
-    insert: jest.fn(),
-    insertHybrid: jest.fn(),
-    search: jest.fn(),
-    hybridSearch: jest.fn(),
-    delete: jest.fn(),
-    query: jest.fn(),
-    getCollectionDescription: jest.fn(),
-    checkCollectionLimit: jest.fn(),
-    getCollectionRowCount: jest.fn(),
+class TestEmbedding extends Embedding {
+    protected maxTokens = 8192;
+
+    async detectDimension(): Promise<number> {
+        return 3;
+    }
+
+    async embed(text: string): Promise<EmbeddingVector> {
+        return { vector: [1, 0, 0], dimension: 3 };
+    }
+
+    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
+        return texts.map(() => ({ vector: [1, 0, 0], dimension: 3 }));
+    }
+
+    getDimension(): number {
+        return 3;
+    }
+
+    getProvider(): string {
+        return 'test';
+    }
+}
+
+class TestSplitter implements Splitter {
+    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
+        return [{
+            content: code,
+            metadata: {
+                startLine: 1,
+                endLine: 1,
+                language,
+                filePath,
+            },
+        }];
+    }
+
+    setChunkSize(): void { }
+
+    setChunkOverlap(): void { }
+}
+
+const createVectorDatabase = (): jest.Mocked<VectorDatabase> => ({
+    createCollection: jest.fn().mockResolvedValue(undefined),
+    createHybridCollection: jest.fn().mockResolvedValue(undefined),
+    dropCollection: jest.fn().mockResolvedValue(undefined),
+    hasCollection: jest.fn().mockResolvedValue(false),
+    listCollections: jest.fn().mockResolvedValue([]),
+    insert: jest.fn().mockResolvedValue(undefined),
+    insertHybrid: jest.fn().mockResolvedValue(undefined),
+    search: jest.fn().mockResolvedValue([]),
+    hybridSearch: jest.fn().mockResolvedValue([]),
+    delete: jest.fn().mockResolvedValue(undefined),
+    query: jest.fn().mockResolvedValue([]),
+    getCollectionDescription: jest.fn().mockResolvedValue(''),
+    checkCollectionLimit: jest.fn().mockResolvedValue(true),
+    getCollectionRowCount: jest.fn().mockResolvedValue(0),
 });
 
 describe('Context ignore pattern isolation', () => {
     let tempRoot: string;
     let originalHome: string | undefined;
+    let originalHybridMode: string | undefined;
 
     beforeEach(async () => {
         tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-context-ignore-'));
         const homeDir = path.join(tempRoot, 'home');
         await fs.mkdir(homeDir, { recursive: true });
         originalHome = process.env.HOME;
+        originalHybridMode = process.env.HYBRID_MODE;
         process.env.HOME = homeDir;
+        process.env.HYBRID_MODE = 'false';
     });
 
     afterEach(async () => {
@@ -39,6 +86,11 @@ describe('Context ignore pattern isolation', () => {
         } else {
             process.env.HOME = originalHome;
         }
+        if (originalHybridMode === undefined) {
+            delete process.env.HYBRID_MODE;
+        } else {
+            process.env.HYBRID_MODE = originalHybridMode;
+        }
         await fs.rm(tempRoot, { recursive: true, force: true });
     });
 
@@ -69,4 +121,39 @@ describe('Context ignore pattern isolation', () => {
         const withoutRequestIgnores = await context.getEffectiveIgnorePatterns(project);
         expect(withoutRequestIgnores).not.toContain('*.txt');
     });
+
+    it('does not leak request custom extensions into persistent supported extensions', () => {
+        const context = new Context({ vectorDatabase: createVectorDatabase() });
+
+        const withRequestExtensions = context.getEffectiveSupportedExtensions(['foo']);
+        expect(withRequestExtensions).toContain('.foo');
+
+        const withoutRequestExtensions = context.getSupportedExtensions();
+        expect(withoutRequestExtensions).not.toContain('.foo');
+    });
+
+    it('does not leak request custom extensions between codebase indexes', async () => {
+        const projectA = path.join(tempRoot, 'project-a');
+        const projectB = path.join(tempRoot, 'project-b');
+        await fs.mkdir(projectA);
+        await fs.mkdir(projectB);
+        await fs.writeFile(path.join(projectA, 'a.foo'), 'project a custom file');
+        await fs.writeFile(path.join(projectB, 'b.foo'), 'project b custom file');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            
```

**File**: `packages/core/src/context.ts` (modified, +29/-8)
```diff
@@ -190,6 +190,15 @@ export class Context {
         return [...this.supportedExtensions];
     }
 
+    /**
+     * Get supported extensions for the current operation without mutating
+     * the Context's persistent extension list.
+     */
+    getEffectiveSupportedExtensions(additionalExtensions: string[] = []): string[] {
+        const normalizedExtensions = this.normalizeExtensions(additionalExtensions);
+        return [...new Set([...this.supportedExtensions, ...normalizedExtensions])];
+    }
+
     /**
      * Get ignore patterns
      */
@@ -308,13 +317,16 @@ export class Context {
      * @param codebasePath Codebase root path
      * @param progressCallback Optional progress callback function
      * @param forceReindex Whether to recreate the collection even if it exists
+     * @param additionalIgnorePatterns Request-scoped ignore patterns
+     * @param additionalSupportedExtensions Request-scoped file extensions
      * @returns Indexing statistics
      */
     async indexCodebase(
         codebasePath: string,
         progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
         forceReindex: boolean = false,
-        additionalIgnorePatterns: string[] = []
+        additionalIgnorePatterns: string[] = [],
+        additionalSupportedExtensions: string[] = []
     ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
@@ -331,7 +343,8 @@ export class Context {
 
         // 3. Recursively traverse codebase to get all supported files
         progressCallback?.({ phase: 'Scanning files...', current: 5, total: 100, percentage: 5 });
-        const codeFiles = await this.getCodeFiles(codebasePath, ignorePatterns);
+        const supportedExtensions = this.getEffectiveSupportedExtensions(additionalSupportedExtensions);
+        const codeFiles = await this.getCodeFiles(codebasePath, ignorePatterns, supportedExtensions);
         console.log(`[Context] 📁 Found ${codeFiles.length} code files`);
 
         if (codeFiles.length === 0) {
@@ -722,7 +735,11 @@ export class Context {
     /**
      * Recursively get all code files in the codebase
      */
-    private async getCodeFiles(codebasePath: string, ignorePatterns: string[] = this.ignorePatterns): Promise<string[]> {
+    private async getCodeFiles(
+        codebasePath: string,
+        ignorePatterns: string[] = this.ignorePatterns,
+        supportedExtensions: string[] = this.supportedExtensions
+    ): Promise<string[]> {
         const files: string[] = [];
 
         const traverseDirectory = async (currentPath: string) => {
@@ -740,7 +757,7 @@ export class Context {
                     await traverseDirectory(fullPath);
                 } else if (entry.isFile()) {
                     const ext = path.extname(entry.name);
-                    if (this.supportedExtensions.includes(ext)) {
+                    if (supportedExtensions.includes(ext)) {
                         files.push(fullPath);
                     }
                 }
@@ -1253,17 +1270,21 @@ export class Context {
         }
     }
 
+    private normalizeExtensions(extensions: string[]): string[] {
+        return extensions
+            .map(ext => ext.trim())
+            .filter(ext => ext.length > 0)
+            .map(ext => ext.startsWith('.') ? ext : `.${ext}`);
+    }
+
     /**
      * Add custom extensions (from MCP or other sources) without replacing existing ones
      * @param customExtensions Array of custom extensions to add
      */
     addCustomExtensions(customExtensions: string[]): void {
         if (customExtensions.length === 0) return;
 
-        // Ensure extensions start with dot
-        const normalizedExtensions = customExtensions.map(ext =>
-            ext.startsWith('.') ? ext : `.${ext}`
-        );
+        const normalizedExtensions = this.normalizeExtensions(customExtensions);
 
         // Merge current extensions with new custom extensions, avoiding duplicates
         const mergedExtensions = [...this.supportedExtensions, ...normalizedExtensions];
```

**File**: `packages/mcp/src/handlers.ts` (modified, +16/-8)
```diff
@@ -443,10 +443,8 @@ export class ToolHandlers {
                 };
             }
 
-            // Add custom extensions if provided
             if (customFileExtensions.length > 0) {
-                console.log(`[CUSTOM-EXTENSIONS] Adding ${customFileExtensions.length} custom extensions: ${customFileExtensions.join(', ')}`);
-                this.context.addCustomExtensions(customFileExtensions);
+                console.log(`[CUSTOM-EXTENSIONS] Using ${customFileExtensions.length} request-scoped custom extensions: ${customFileExtensions.join(', ')}`);
             }
 
             // Check current status and log if retrying after failure
@@ -464,7 +462,7 @@ export class ToolHandlers {
             trackCodebasePath(absolutePath);
 
             // Start background indexing - now safe to proceed
-            this.startBackgroundIndexing(absolutePath, forceReindex, splitterType, customIgnorePatterns);
+            this.startBackgroundIndexing(absolutePath, forceReindex, splitterType, customIgnorePatterns, customFileExtensions);
 
             const pathInfo = codebasePath !== absolutePath
                 ? `\nNote: Input path '${codebasePath}' was resolved to absolute path '${absolutePath}'`
@@ -500,7 +498,13 @@ export class ToolHandlers {
         }
     }
 
-    private async startBackgroundIndexing(codebasePath: string, forceReindex: boolean, splitterType: string, customIgnorePatterns: string[] = []) {
+    private async startBackgroundIndexing(
+        codebasePath: string,
+        forceReindex: boolean,
+        splitterType: string,
+        customIgnorePatterns: string[] = [],
+        customFileExtensions: string[] = []
+    ) {
         const absolutePath = codebasePath;
         let lastSaveTime = 0; // Track last save timestamp
 
@@ -521,12 +525,16 @@ export class ToolHandlers {
             // Load ignore patterns from files first (including .ignore, .gitignore, etc.)
             // and merge them with this request's custom ignore patterns without
             // relying on shared Context state for this background indexing task.
-            const ignorePatterns = await this.context.getEffectiveIgnorePatterns(absolutePath, customIgnorePatterns);
+            const ignorePatterns = await contextForThisTask.getEffectiveIgnorePatterns(absolutePath, customIgnorePatterns);
+            const supportedExtensions = contextForThisTask.getEffectiveSupportedExtensions(customFileExtensions);
 
             // Initialize file synchronizer with proper ignore patterns (including project-specific patterns)
             const { FileSynchronizer } = await import("@zilliz/claude-context-core");
             console.log(`[BACKGROUND-INDEX] Using ignore patterns: ${ignorePatterns.join(', ')}`);
-            const synchronizer = new FileSynchronizer(absolutePath, ignorePatterns, this.context.getSupportedExtensions());
+            if (customFileExtensions.length > 0) {
+                console.log(`[BACKGROUND-INDEX] Using ${customFileExtensions.length} request-scoped custom extensions: ${customFileExtensions.join(', ')}`);
+            }
+            const synchronizer = new FileSynchronizer(absolutePath, ignorePatterns, supportedExtensions);
             await synchronizer.initialize();
 
             // Store synchronizer in the context (let context manage collection names)
@@ -558,7 +566,7 @@ export class ToolHandlers {
                 }
 
                 console.log(`[BACKGROUND-INDEX] Progress: ${progress.phase} - ${progress.percentage}% (${progress.current}/${progress.total})`);
-            }, false, customIgnorePatterns);
+            }, false, customIgnorePatterns, customFileExtensions);
             console.log(`[BACKGROUND-INDEX] ✅ Indexing completed successfully! Files: ${stats.indexedFiles}, Chunks: ${stats.totalChunks}`);
 
             // Set codebase to indexed status with complete statistics
```

#### Recent Merged Pull Requests:
- **PR #423** (closed): fix: zilliztech/claude-context#421 (@Zewang0217)
- **PR #407** (2026-07-14): docs: add CLAUDE.md and AGENTS.md repository guide (@zc277584121)
- **PR #396** (closed): feat(core): CI semantic index — collection override, Qwen3-4B OpenRouter, Postgres cache (@BeamNawapat)
- **PR #390** (2026-06-08): fix(mcp): show error when embedding model unavailable (@xu20160924)
- **PR #386** (2026-07-14): fix(core): make Merkle root hashing deterministic (@wuyua9)
- **PR #385** (2026-07-14): fix(mcp): derive default version from package metadata (@wuyua9)
- **PR #380** (2026-05-22): test(core): cover VoyageAI variable dimensions (@euyua9)
- **PR #379** (2026-05-22): test(mcp): cover get_indexing_status cloud sync (@yuyua9)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
