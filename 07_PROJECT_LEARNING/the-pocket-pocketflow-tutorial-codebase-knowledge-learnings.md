# Forensic Learning Record (Deep Inspection): The-Pocket/PocketFlow-Tutorial-Codebase-Knowledge

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-pocket-pocketflow-tutorial-codebase-knowledge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/The-Pocket/PocketFlow-Tutorial-Codebase-Knowledge](https://github.com/The-Pocket/PocketFlow-Tutorial-Codebase-Knowledge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:16:02.265Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `The-Pocket/PocketFlow-Tutorial-Codebase-Knowledge`
- **Description**: Pocket Flow: Codebase to Tutorial
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 12685 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `flow.py`
```
from pocketflow import Flow
# Import all node classes from nodes.py
from nodes import (
    FetchRepo,
    IdentifyAbstractions,
    AnalyzeRelationships,
    OrderChapters,
    WriteChapters,
    CombineTutorial
)

def create_tutorial_flow():
    """Creates and returns the codebase tutorial generation flow."""

    # Instantiate nodes
    fetch_repo = FetchRepo()
    identify_abstractions = IdentifyAbstractions(max_retries=5, wait=20)
    analyze_relationships = AnalyzeRelationships(max_retries=5, wait=20)
    order_chapters = OrderChapters(max_retries=5, wait=20)
    write_chapters = WriteChapters(max_retries=5, wait=20) # This is a BatchNode
    combine_tutorial = CombineTutorial()

    # Connect nodes in sequence based on the design
    fetch_repo >> identify_abstractions
    identify_abstractions >> analyze_relationships
    analyze_relationships >> order_chapters
    order_chapters >> write_chapters
    write_chapters >> combine_tutorial

    # Create the flow starting with FetchRepo
    tutorial_flow = Flow(start=fetch_repo)

    return tutorial_flow

```

### Core Architecture Module: `main.py`
```
import dotenv
import os
import argparse
# Import the function that creates the flow
from flow import create_tutorial_flow

dotenv.load_dotenv()

# Default file patterns
DEFAULT_INCLUDE_PATTERNS = {
    "*.py", "*.js", "*.jsx", "*.ts", "*.tsx", "*.go", "*.java", "*.pyi", "*.pyx",
    "*.c", "*.cc", "*.cpp", "*.h", "*.md", "*.rst", "*Dockerfile",
    "*Makefile", "*.yaml", "*.yml",
}

DEFAULT_EXCLUDE_PATTERNS = {
    "assets/*", "data/*", "images/*", "public/*", "static/*", "temp/*",
    "*docs/*",
    "*venv/*",
    "*.venv/*",
    "*test*",
    "*tests/*",
    "*examples/*",
    "v1/*",
    "*dist/*",
    "*build/*",
    "*experimental/*",
    "*deprecated/*",
    "*misc/*",
    "*legacy/*",
    ".git/*", ".github/*", ".next/*", ".vscode/*",
    "*obj/*",
    "*bin/*",
    "*node_modules/*",
    "*.log"
}

# --- Main Function ---
def main():
    parser = argparse.ArgumentParser(description="Generate a tutorial for a GitHub codebase or local directory.")

    # Create mutually exclusive group for source
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--repo", help="URL of the public GitHub repository.")
    source_group.add_argument("--dir", help="Path to local directory.")

    parser.add_argument("-n", "--name", help="Project name (optional, derived from repo/directory if omitted).")
    parser.add_argument("-t", "--token", help="GitHub personal access token (optional, reads from GITHUB_TOKEN env var if not provided).")
    parser.add_argument("-o", "--output", default="output", help="Base directory for output (default: ./output).")
    parser.add_argument("-i", "--include", nargs="+", help="Include file patterns (e.g. '*.py' '*.js'). Defaults to common code files if not specified.")
    parser.add_argument("-e", "--exclude", nargs="+", help="Exclude file patterns (e.g. 'tests/*' 'docs/*'). Defaults to test/build directories if not specified.")
    parser.add_argument("-s", "--max-size", type=int, default=100000, help="Maximum file size in bytes (default: 100000, about 100KB).")
    # Add language parameter for multi-language support
    parser.add_argument("--language", default="english", help="Language for the generated tutorial (default: english)")
    # Add use_cache parameter to control LLM caching
    parser.add_argument("--no-cache", action="store_true", help="Disable LLM response caching (default: caching enabled)")
    # Add max_abstraction_num parameter to control the number of abstractions
    parser.add_argument("--max-abstractions", type=int, default=10, help="Maximum number of abstractions to identify (default: 10)")

    args = parser.parse_args()

    # Get GitHub token from argument or environment variable if using repo
    github_token = None
    if args.repo:
        github_token = args.token or os.environ.get('GITHUB_TOKEN')
        if not github_token:
            print("Warning: No GitHub token provided. You might hit rate limits for public repositories.")

    # Initialize the shared dictionary with inputs
    shared = {
        "repo_url": args.repo,
        "local_dir": args.dir,
        "project_name": args.name, # Can be None, FetchRepo will derive it
        "github_token": github_token,
        "output_dir": args.output, # Base directory for CombineTutorial output

        # Add include/exclude patterns and max file size
        "include_patterns": set(args.include) if args.include else DEFAULT_INCLUDE_PATTERNS,
        "exclude_patterns": set(args.exclude) if args.exclude else DEFAULT_EXCLUDE_PATTERNS,
        "max_file_size": args.max_size,

        # Add language for multi-language support
        "language": args.language,
        
        # Add use_cache flag (inverse of no-cache flag)
        "use_cache": not args.no_cache,
        
        # Add max_abstraction_num parameter
        "max_abstraction_num": args.max_abstractions,

        # Outputs will be populated by the nodes
        "files": [],
        "abstractions": [],
        "relationships": {},
        "chapter_order": [],
        "chapters": [],
        "final_output_dir": None
    }

    # Display starting message with repository/directory and language
    print(f"Starting tutorial generation for: {args.repo or args.dir} in {args.language.capitalize()} language")
    print(f"LLM caching: {'Disabled' if args.no_cache else 'Enabled'}")

    # Create the flow instance
    tutorial_flow = create_tutorial_flow()

    # Run the flow
    tutorial_flow.run(shared)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `nodes.py`
```
import os
import re
import yaml
from pocketflow import Node, BatchNode
from utils.crawl_github_files import crawl_github_files
from utils.call_llm import call_llm
from utils.crawl_local_files import crawl_local_files


# Helper to get content for specific file indices
def get_content_for_indices(files_data, indices):
    content_map = {}
    for i in indices:
        if 0 <= i < len(files_data):
            path, content = files_data[i]
            content_map[f"{i} # {path}"] = (
                content  # Use index + path as key for context
            )
    return content_map


class FetchRepo(Node):
    def prep(self, shared):
        repo_url = shared.get("repo_url")
        local_dir = shared.get("local_dir")
        project_name = shared.get("project_name")

        if not project_name:
            # Basic name derivation from URL or directory
            if repo_url:
                project_name = repo_url.split("/")[-1].replace(".git", "")
            else:
                project_name = os.path.basename(os.path.abspath(local_dir))
            shared["project_name"] = project_name

        # Get file patterns directly from shared
        include_patterns = shared["include_patterns"]
        exclude_patterns = shared["exclude_patterns"]
        max_file_size = shared["max_file_size"]

        return {
            "repo_url": repo_url,
            "local_dir": local_dir,
            "token": shared.get("github_token"),
            "include_patterns": include_patterns,
            "exclude_patterns": exclude_patterns,
            "max_file_size": max_file_size,
            "use_relative_paths": True,
        }

    def exec(self, prep_res):
        if prep_res["repo_url"]:
            print(f"Crawling repository: {prep_res['repo_url']}...")
            result = crawl_github_files(
                repo_url=prep_res["repo_url"],
                token=prep_res["token"],
                include_patterns=prep_res["include_patterns"],
                exclude_patterns=prep_res["exclude_patterns"],
                max_file_size=prep_res["max_file_size"],
                use_relative_paths=prep_res["use_relative_paths"],
            )
        else:
            print(f"Crawling directory: {prep_res['local_dir']}...")

            result = crawl_local_files(
                directory=prep_res["local_dir"],
                include_patterns=prep_res["include_patterns"],
                exclude_patterns=prep_res["exclude_patterns"],
                max_file_size=prep_res["max_file_size"],
                use_relative_paths=prep_res["use_relative_paths"]
            )

        # Convert dict to list of tuples: [(path, content), ...]
        files_list = list(result.get("files", {}).items())
        if len(files_list) == 0:
            raise (ValueError("Failed to fetch files"))
        print(f"Fetched {len(files_list)} files.")
        return files_list

    def post(self, shared, prep_res, exec_res):
        shared["files"] = exec_res  # List of (path, content) tuples


class IdentifyAbstractions(Node):
    def prep(self, shared):
        files_data = shared["files"]
        project_name = shared["project_name"]  # Get project name
        language = shared.get("language", "english")  # Get language
        use_cache = shared.get("use_cache", True)  # Get use_cache flag, default to True
        max_abstraction_num = shared.get("max_abstraction_num", 10)  # Get max_abstraction_num, default to 10

        # Helper to create context from files, respecting limits (basic example)
        def create_llm_context(files_data):
            context = ""
            file_info = []  # Store tuples of (index, path)
            for i, (path, content) in enumerate(files_data):
                entry = f"--- File Index {i}: {path} ---\n{content}\n\n"
                context += entry
                file_info.append((i, path))

            return context, file_info  # file_info is list of (index, path)

        context, file_info = create_llm_context(files_data)
        # Format file info for the prompt (comment is just a hint for LLM)
        file_listing_for_prompt = "\n".join(
            [f"- {idx} # {path}" for idx, path in file_info]
        )
        return (
            context,
            file_listing_for_prompt,
            len(files_data),
            project_name,
            language,
            use_cache,
            max_abstraction_num,
        )  # Return all parameters

    def exec(self, prep_res):
        (
            context,
            file_listing_for_prompt,
            file_count,
            project_name,
            language,
            use_cache,
            max_abstraction_num,
        ) = prep_res  # Unpack all parameters
        print(f"Identifying abstractions using LLM...")

        # Add language instruction and hints only if not English
        language_instruction = ""
        name_lang_hint = ""
        desc_lang_hint = ""
        if language.lower() != "english":
            language_instruction = f"IMPORTANT: Generate the `name` and `description` for each abstraction in **{language.capitalize()}** language. Do NOT use English for these fields.\n\n"
            # Keep specific hints here as name/description are primary targets
            name_lang_hint = f" (value in {language.capitalize()})"
            desc_lang_hint = f" (value in {language.capitalize()})"

        prompt = f"""
For the project `{project_name}`:

Codebase Context:
{context}

{language_instruction}Analyze the codebase context.
Identify the top 5-{max_abstraction_num} core most important abstractions to help those new to the codebase.

For each abstraction, provide:
1. A concise `name`{name_lang_hint}.
2. A beginner-friendly `description` explaining what it is with a simple analogy, in around 100 words{desc_lang_hint}.
3. A list of relevant `file_indices` (integers) using the format `idx # path/comment`.

List of file indices and paths present in the context:
{file_listing_for_prompt}

Format the output as a YAML list of dictionaries:

```yaml
- name: |
    Query Processing{name_lang_hint}
  description: |
    Explains what the abstraction does.
    It's like a central dispatcher routing requests.{desc_lang_hint}
  file_indices:
    - 0 # path/to/file1.py
    - 3 # path/to/related.py
- name: |
    Query Optimization{name_lang_hint}
  description: |
    Another core concept, similar to a blueprint for objects.{desc_lang_hint}
  file_indices:
    - 5 # path/to/another.js
# ... up to {max_abstraction_num} abstractions
```"""
        response = call_llm(prompt, use_cache=(use_cache and self.cur_retry == 0))  # Use cache only if enabled and not retrying

        # --- Validation ---
        yaml_str = response.strip().split("```yaml")[1].split("```")[0].strip()
        abstractions = yaml.safe_load(yaml_str)

        if not isinstance(abstractions, list):
            raise ValueError("LLM Output is not a list")

        validated_abstractions = []
        for item in abstractions:
            if not isinstance(item, dict) or not all(
                k in item for k in ["name", "description", "file_indices"]
            ):
                raise ValueError(f"Missing keys in abstraction item: {item}")
            if not isinstance(item["name"], str):
                raise ValueError(f"Name is not a string in item: {item}")
            if not isinstance(item["description"], str):
                raise ValueError(f"Description is not a string in item: {item}")
            if not isinstance(item["file_indices"], list):
                raise ValueError(f"file_indices is not a list in item: {item}")

            # Validate indices
            validated_indices = []
            for idx_entry in item["file_indices"]:
                try:
                    if isinstance(idx_entry, int):
                        idx = idx_entry
                    elif isinstance(idx_entry, str) and "#" in idx_entry:
                        idx = int(idx_entry.split("#")[0].strip())
              
```

### Core Architecture Module: `utils/call_llm.py`
```
from google import genai
import os
import logging
import json
import requests
from datetime import datetime

# Configure logging
log_directory = os.getenv("LOG_DIR", "logs")
os.makedirs(log_directory, exist_ok=True)
log_file = os.path.join(
    log_directory, f"llm_calls_{datetime.now().strftime('%Y%m%d')}.log"
)

# Set up logger
logger = logging.getLogger("llm_logger")
logger.setLevel(logging.INFO)
logger.propagate = False  # Prevent propagation to root logger
file_handler = logging.FileHandler(log_file, encoding='utf-8')
file_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
)
logger.addHandler(file_handler)

# Simple cache configuration
cache_file = "llm_cache.json"


def load_cache():
    try:
        with open(cache_file, 'r') as f:
            return json.load(f)
    except:
        logger.warning(f"Failed to load cache.")
    return {}


def save_cache(cache):
    try:
        with open(cache_file, 'w') as f:
            json.dump(cache, f)
    except:
        logger.warning(f"Failed to save cache")


def get_llm_provider():
    provider = os.getenv("LLM_PROVIDER")
    if not provider and (os.getenv("GEMINI_PROJECT_ID") or os.getenv("GEMINI_API_KEY")):
        provider = "GEMINI"
    # if necessary, add ANTHROPIC/OPENAI
    return provider


def _call_llm_provider(prompt: str) -> str:
    """
    Call an LLM provider based on environment variables.
    Environment variables:
    - LLM_PROVIDER: "OLLAMA" or "XAI"
    - <provider>_MODEL: Model name (e.g., OLLAMA_MODEL, XAI_MODEL)
    - <provider>_BASE_URL: Base URL without endpoint (e.g., OLLAMA_BASE_URL, XAI_BASE_URL)
    - <provider>_API_KEY: API key (e.g., OLLAMA_API_KEY, XAI_API_KEY; optional for providers that don't require it)
    The endpoint /v1/chat/completions will be appended to the base URL.
    """
    logger.info(f"PROMPT: {prompt}") # log the prompt

    # Read the provider from environment variable
    provider = os.environ.get("LLM_PROVIDER")
    if not provider:
        raise ValueError("LLM_PROVIDER environment variable is required")

    # Construct the names of the other environment variables
    model_var = f"{provider}_MODEL"
    base_url_var = f"{provider}_BASE_URL"
    api_key_var = f"{provider}_API_KEY"

    # Read the provider-specific variables
    model = os.environ.get(model_var)
    base_url = os.environ.get(base_url_var)
    api_key = os.environ.get(api_key_var, "")  # API key is optional, default to empty string

    # Validate required variables
    if not model:
        raise ValueError(f"{model_var} environment variable is required")
    if not base_url:
        raise ValueError(f"{base_url_var} environment variable is required")

    # Append the endpoint to the base URL
    url = f"{base_url.rstrip('/')}/v1/chat/completions"

    # Configure headers and payload based on provider
    headers = {
        "Content-Type": "application/json",
    }
    if api_key:  # Only add Authorization header if API key is provided
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response_json = response.json() # Log the response
        logger.info("RESPONSE:\n%s", json.dumps(response_json, indent=2))
        #logger.info(f"RESPONSE: {response.json()}")
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except requests.exceptions.HTTPError as e:
        error_message = f"HTTP error occurred: {e}"
        try:
            error_details = response.json().get("error", "No additional details")
            error_message += f" (Details: {error_details})"
        except:
            pass
        raise Exception(error_message)
    except requests.exceptions.ConnectionError:
        raise Exception(f"Failed to connect to {provider} API. Check your network connection.")
    except requests.exceptions.Timeout:
        raise Exception(f"Request to {provider} API timed out.")
    except requests.exceptions.RequestException as e:
        raise Exception(f"An error occurred while making the request to {provider}: {e}")
    except ValueError:
        raise Exception(f"Failed to parse response as JSON from {provider}. The server might have returned an invalid response.")

# By default, we Google Gemini 2.5 pro, as it shows great performance for code understanding
def call_llm(prompt: str, use_cache: bool = True) -> str:
    # Log the prompt
    logger.info(f"PROMPT: {prompt}")

    # Check cache if enabled
    if use_cache:
        # Load cache from disk
        cache = load_cache()
        # Return from cache if exists
        if prompt in cache:
            logger.info(f"RESPONSE: {cache[prompt]}")
            return cache[prompt]

    provider = get_llm_provider()
    if provider == "GEMINI":
        response_text = _call_llm_gemini(prompt)
    else:  # generic method using a URL that is OpenAI compatible API (Ollama, ...)
        response_text = _call_llm_provider(prompt)

    # Log the response
    logger.info(f"RESPONSE: {response_text}")

    # Update cache if enabled
    if use_cache:
        # Load cache again to avoid overwrites
        cache = load_cache()
        # Add to cache and save
        cache[prompt] = response_text
        save_cache(cache)

    return response_text


def _call_llm_gemini(prompt: str) -> str:
    if os.getenv("GEMINI_PROJECT_ID"):
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GEMINI_PROJECT_ID"),
            location=os.getenv("GEMINI_LOCATION", "us-central1")
        )
    elif os.getenv("GEMINI_API_KEY"):
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    else:
        raise ValueError("Either GEMINI_PROJECT_ID or GEMINI_API_KEY must be set in the environment")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro-exp-03-25")
    response = client.models.generate_content(
        model=model,
        contents=[prompt]
    )
    return response.text

if __name__ == "__main__":
    test_prompt = "Hello, how are you?"

    # First call - should hit the API
    print("Making call...")
    response1 = call_llm(test_prompt, use_cache=False)
    print(f"Response: {response1}")

```

### Core Architecture Module: `utils/crawl_github_files.py`
```
import requests
import base64
import os
import tempfile
import git
import time
import fnmatch
from typing import Union, Set, List, Dict, Tuple, Any
from urllib.parse import urlparse

def crawl_github_files(
    repo_url, 
    token=None, 
    max_file_size: int = 1 * 1024 * 1024,  # 1 MB
    use_relative_paths: bool = False,
    include_patterns: Union[str, Set[str]] = None,
    exclude_patterns: Union[str, Set[str]] = None
):
    """
    Crawl files from a specific path in a GitHub repository at a specific commit.

    Args:
        repo_url (str): URL of the GitHub repository with specific path and commit
                        (e.g., 'https://github.com/microsoft/autogen/tree/e45a15766746d95f8cfaaa705b0371267bec812e/python/packages/autogen-core/src/autogen_core')
        token (str, optional): **GitHub personal access token.**
            - **Required for private repositories.**
            - **Recommended for public repos to avoid rate limits.**
            - Can be passed explicitly or set via the `GITHUB_TOKEN` environment variable.
        max_file_size (int, optional): Maximum file size in bytes to download (default: 1 MB)
        use_relative_paths (bool, optional): If True, file paths will be relative to the specified subdirectory
        include_patterns (str or set of str, optional): Pattern or set of patterns specifying which files to include (e.g., "*.py", {"*.md", "*.txt"}).
                                                       If None, all files are included.
        exclude_patterns (str or set of str, optional): Pattern or set of patterns specifying which files to exclude.
                                                       If None, no files are excluded.

    Returns:
        dict: Dictionary with files and statistics
    """
    # Convert single pattern to set
    if include_patterns and isinstance(include_patterns, str):
        include_patterns = {include_patterns}
    if exclude_patterns and isinstance(exclude_patterns, str):
        exclude_patterns = {exclude_patterns}

    def should_include_file(file_path: str, file_name: str) -> bool:
        """Determine if a file should be included based on patterns"""
        # If no include patterns are specified, include all files
        if not include_patterns:
            include_file = True
        else:
            # Check if file matches any include pattern
            include_file = any(fnmatch.fnmatch(file_name, pattern) for pattern in include_patterns)

        # If exclude patterns are specified, check if file should be excluded
        if exclude_patterns and include_file:
            # Exclude if file matches any exclude pattern
            exclude_file = any(fnmatch.fnmatch(file_path, pattern) for pattern in exclude_patterns)
            return not exclude_file

        return include_file

    # Detect SSH URL (git@ or .git suffix)
    is_ssh_url = repo_url.startswith("git@") or repo_url.endswith(".git")

    if is_ssh_url:
        # Clone repo via SSH to temp dir
        with tempfile.TemporaryDirectory() as tmpdirname:
            print(f"Cloning SSH repo {repo_url} to temp dir {tmpdirname} ...")
            try:
                repo = git.Repo.clone_from(repo_url, tmpdirname)
            except Exception as e:
                print(f"Error cloning repo: {e}")
                return {"files": {}, "stats": {"error": str(e)}}

            # Attempt to checkout specific commit/branch if in URL
            # Parse ref and subdir from SSH URL? SSH URLs don't have branch info embedded
            # So rely on default branch, or user can checkout manually later
            # Optionally, user can pass ref explicitly in future API

            # Walk directory
            files = {}
            skipped_files = []

            for root, dirs, filenames in os.walk(tmpdirname):
                for filename in filenames:
                    abs_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(abs_path, tmpdirname)

                    # Check file size
                    try:
                        file_size = os.path.getsize(abs_path)
                    except OSError:
                        continue

                    if file_size > max_file_size:
                        skipped_files.append((rel_path, file_size))
                        print(f"Skipping {rel_path}: size {file_size} exceeds limit {max_file_size}")
                        continue

                    # Check include/exclude patterns
                    if not should_include_file(rel_path, filename):
                        print(f"Skipping {rel_path}: does not match include/exclude patterns")
                        continue

                    # Read content
                    try:
                        with open(abs_path, "r", encoding="utf-8-sig") as f:
                            content = f.read()
                        files[rel_path] = content
                        print(f"Added {rel_path} ({file_size} bytes)")
                    except Exception as e:
                        print(f"Failed to read {rel_path}: {e}")

            return {
                "files": files,
                "stats": {
                    "downloaded_count": len(files),
                    "skipped_count": len(skipped_files),
                    "skipped_files": skipped_files,
                    "base_path": None,
                    "include_patterns": include_patterns,
                    "exclude_patterns": exclude_patterns,
                    "source": "ssh_clone"
                }
            }

    # Parse GitHub URL to extract owner, repo, commit/branch, and path
    parsed_url = urlparse(repo_url)
    path_parts = parsed_url.path.strip('/').split('/')
    
    if len(path_parts) < 2:
        raise ValueError(f"Invalid GitHub URL: {repo_url}")
    
    # Extract the basic components
    owner = path_parts[0]
    repo = path_parts[1]
    
    # Setup for GitHub API
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    def fetch_branches(owner: str, repo: str):
        """Get brancshes of the repository"""

        url = f"https://api.github.com/repos/{owner}/{repo}/branches"
        response = requests.get(url, headers=headers, timeout=(30, 30))

        if response.status_code == 404:
            if not token:
                print(f"Error 404: Repository not found or is private.\n"
                      f"If this is a private repository, please provide a valid GitHub token via the 'token' argument or set the GITHUB_TOKEN environment variable.")
            else:
                print(f"Error 404: Repository not found or insufficient permissions with the provided token.\n"
                      f"Please verify the repository exists and the token has access to this repository.")
            return []
            
        if response.status_code != 200:
            print(f"Error fetching the branches of {owner}/{repo}: {response.status_code} - {response.text}")
            return []

        return response.json()

    def check_tree(owner: str, repo: str, tree: str):
        """Check the repository has the given tree"""

        url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{tree}"
        response = requests.get(url, headers=headers, timeout=(30, 30))

        return True if response.status_code == 200 else False 

    # Check if URL contains a specific branch/commit
    if len(path_parts) > 2 and 'tree' == path_parts[2]:
        join_parts = lambda i: '/'.join(path_parts[i:])

        branches = fetch_branches(owner, repo)
        branch_names = map(lambda branch: branch.get("name"), branches)

        # Fetching branches is not successfully
        if len(branches) == 0:
            return

        # To check branch name
        relevant_path = join_parts(3)

        # Find a match with relevant path and get the branch name
        filter_gen = (name for name in branch_names
```

### Core Architecture Module: `utils/crawl_local_files.py`
```
import os
import fnmatch
import pathspec


def crawl_local_files(
    directory,
    include_patterns=None,
    exclude_patterns=None,
    max_file_size=None,
    use_relative_paths=True,
):
    """
    Crawl files in a local directory with similar interface as crawl_github_files.
    Args:
        directory (str): Path to local directory
        include_patterns (set): File patterns to include (e.g. {"*.py", "*.js"})
        exclude_patterns (set): File patterns to exclude (e.g. {"tests/*"})
        max_file_size (int): Maximum file size in bytes
        use_relative_paths (bool): Whether to use paths relative to directory

    Returns:
        dict: {"files": {filepath: content}}
    """
    if not os.path.isdir(directory):
        raise ValueError(f"Directory does not exist: {directory}")

    files_dict = {}

    # --- Load .gitignore ---
    gitignore_path = os.path.join(directory, ".gitignore")
    gitignore_spec = None
    if os.path.exists(gitignore_path):
        try:
            with open(gitignore_path, "r", encoding="utf-8-sig") as f:
                gitignore_patterns = f.readlines()
            gitignore_spec = pathspec.PathSpec.from_lines("gitwildmatch", gitignore_patterns)
            print(f"Loaded .gitignore patterns from {gitignore_path}")
        except Exception as e:
            print(f"Warning: Could not read or parse .gitignore file {gitignore_path}: {e}")

    all_files = []
    for root, dirs, files in os.walk(directory):
        # Filter directories using .gitignore and exclude_patterns early
        excluded_dirs = set()
        for d in dirs:
            dirpath_rel = os.path.relpath(os.path.join(root, d), directory)

            if gitignore_spec and gitignore_spec.match_file(dirpath_rel):
                excluded_dirs.add(d)
                continue

            if exclude_patterns:
                for pattern in exclude_patterns:
                    if fnmatch.fnmatch(dirpath_rel, pattern) or fnmatch.fnmatch(d, pattern):
                        excluded_dirs.add(d)
                        break

        for d in dirs.copy():
            if d in excluded_dirs:
                dirs.remove(d)

        for filename in files:
            filepath = os.path.join(root, filename)
            all_files.append(filepath)

    total_files = len(all_files)
    processed_files = 0

    for filepath in all_files:
        relpath = os.path.relpath(filepath, directory) if use_relative_paths else filepath

        # --- Exclusion check ---
        excluded = False
        if gitignore_spec and gitignore_spec.match_file(relpath):
            excluded = True

        if not excluded and exclude_patterns:
            for pattern in exclude_patterns:
                if fnmatch.fnmatch(relpath, pattern):
                    excluded = True
                    break

        included = False
        if include_patterns:
            for pattern in include_patterns:
                if fnmatch.fnmatch(relpath, pattern):
                    included = True
                    break
        else:
            included = True

        processed_files += 1 # Increment processed count regardless of inclusion/exclusion

        status = "processed"
        if not included or excluded:
            status = "skipped (excluded)"
            # Print progress for skipped files due to exclusion
            if total_files > 0:
                percentage = (processed_files / total_files) * 100
                rounded_percentage = int(percentage)
                print(f"\033[92mProgress: {processed_files}/{total_files} ({rounded_percentage}%) {relpath} [{status}]\033[0m")
            continue # Skip to next file if not included or excluded

        if max_file_size and os.path.getsize(filepath) > max_file_size:
            status = "skipped (size limit)"
            # Print progress for skipped files due to size limit
            if total_files > 0:
                percentage = (processed_files / total_files) * 100
                rounded_percentage = int(percentage)
                print(f"\033[92mProgress: {processed_files}/{total_files} ({rounded_percentage}%) {relpath} [{status}]\033[0m")
            continue # Skip large files

        # --- File is being processed ---        
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                content = f.read()
            files_dict[relpath] = content
        except Exception as e:
            print(f"Warning: Could not read file {filepath}: {e}")
            status = "skipped (read error)"

        # --- Print progress for processed or error files ---
        if total_files > 0:
            percentage = (processed_files / total_files) * 100
            rounded_percentage = int(percentage)
            print(f"\033[92mProgress: {processed_files}/{total_files} ({rounded_percentage}%) {relpath} [{status}]\033[0m")

    return {"files": files_dict}


if __name__ == "__main__":
    print("--- Crawling parent directory ('..') ---")
    files_data = crawl_local_files(
        "..",
        exclude_patterns={
            "*.pyc",
            "__pycache__/*",
            ".venv/*",
            ".git/*",
            "docs/*",
            "output/*",
        },
    )
    print(f"Found {len(files_data['files'])} files:")
    for path in files_data["files"]:
        print(f"  {path}")
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #198** (2026-07-13): **Fix a small issue in PocketFlow-Tutorial-Codebase-Knowledge (#196)**
  *Symptoms*: This is a focused change for the cited issue with minimal side effects.  Related to #196.

- **Issue #197** (2026-07-13): **Fix typo in PocketFlow-Tutorial-Codebase-Knowledge (#196)**
  *Symptoms*: Small scoped patch based on the reported behavior.  Related to #196.

- **Issue #195** (2026-07-04): **call claude code on local machine to avoid API key usage**
  *Symptoms*: 

- **Issue #194** (2026-07-04): **call claude code on local machine to avoid API key usage**
  *Symptoms*: 

- **Issue #190** (2026-06-17): **feat: split large local files into configurable content chunks**
  *Symptoms*: ## Summary  This PR updates `crawl_local_files` to split large text files into smaller content chunks before returning them.  Previously, each file was read and stored as a single dictionary entry. Large files could therefore produce oversized prompts and exceed the context window or token limit of an LLM.  After this change, files whose content exceeds the configured chunk size are divided into multiple entries.  ## Changes  * Added a new `content_chunk_size` parameter to `crawl_local_files`. * The default chunk size is `20,000` characters. * Added `split_text_content` to split large text content. * Prefer splitting at newline boundaries to avoid cutting source-code lines in the middle. * Fall back to a hard split when no newline is available. * Preserve the original key for files that do not require splitting. * Generate numbered keys for split files. * Improved progress output to show how many chunks were created. * Normalized Windows paths to `/` for more consistent pattern matching. * Added clearer handling for:    * excluded files   * files outside include patterns   * file size errors   * non-UTF-8 files   * read errors  ## Example  Given the following file:  ```text src/main.py ```  If its content is smaller than `20,000` characters, the result remains unchanged:  ```python {     "files": {         "src/main.py": "<file content>"     } } ```  If the file contains approximately `45,000` characters, it is returned as:  ```p

- **Issue #175** (2026-03-03): **Website demo crashing due to unavailable gemini ?**
  *Symptoms*: Hi I loved your work and want to explore this further.  But when trying to run the online demo at `https://code2tutorial.com/`, using the repository `https://github.com/datalab-to/marker`,   I get the error  ``` Error during generation: 404 NOT_FOUND. {'error': {'code': 404, 'message': 'This model models/gemini-2.5-flash-preview-09-2025 is no longer available. Please update your code to use a newer model for the latest features and improvements.', 'status': 'NOT_FOUND'}} ```  Unavailable model from Google perhaps? I'm super excited to try it. :)
  **Post-Mortem & Fix Analysis**:
  > gemini-2.5-flash-preview-09-2025 has been shutdown starting feburary 17th , you should try to migrate to 3 Flash
  > Can the website owner do this? I've tweeted at him but no response yet.   Unable to access existing or any creation of a new tutorial because of this hence not be able to use the site.
  > Working now. Woo hoo! Keep up the good work!

- **Issue #171** (2026-01-20): **Copilot llm**
  *Symptoms*: 

- **Issue #167** (2025-12-19): **Frontend displays "Connection Lost" error during generation but actually generates full tutorial in the backend**
  *Symptoms*: When I created a tutorial for my project, the frontend displayed a "Connection to the generation stream failed. The server might be down or the Run ID is invalid." even when the generation actually finished completely on the backend. This seems to be a frontend error that may cause users to make multiple tutorials by mistake.
  **Post-Mortem & Fix Analysis**:
  > <img width="1484" height="1226" alt="Image" src="https://github.com/user-attachments/assets/6d93a7c7-f275-4447-a2df-a4676ad8373e" />  Same issue.
  > This error seems to have gone, so I'm closing this issue.

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

### Incident Patch 1: `9e82cc8e` (2025-05-16)
**Commit Message**: fix: update file opening encoding to utf-8-sig to handle files with BOM

**File**: `utils/call_llm.py` (modified, +7/-7)
```diff
@@ -15,7 +15,7 @@
 logger = logging.getLogger("llm_logger")
 logger.setLevel(logging.INFO)
 logger.propagate = False  # Prevent propagation to root logger
-file_handler = logging.FileHandler(log_file)
+file_handler = logging.FileHandler(log_file, encoding='utf-8')
 file_handler.setFormatter(
     logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
 )
@@ -36,7 +36,7 @@ def call_llm(prompt: str, use_cache: bool = True) -> str:
         cache = {}
         if os.path.exists(cache_file):
             try:
-                with open(cache_file, "r") as f:
+                with open(cache_file, "r", encoding="utf-8") as f:
                     cache = json.load(f)
             except:
                 logger.warning(f"Failed to load cache, starting with empty cache")
@@ -73,15 +73,15 @@ def call_llm(prompt: str, use_cache: bool = True) -> str:
         cache = {}
         if os.path.exists(cache_file):
             try:
-                with open(cache_file, "r") as f:
+                with open(cache_file, "r", encoding="utf-8") as f:
                     cache = json.load(f)
             except:
                 pass
 
         # Add to cache and save
         cache[prompt] = response_text
         try:
-            with open(cache_file, "w") as f:
+            with open(cache_file, "w", encoding="utf-8") as f:
                 json.dump(cache, f)
         except Exception as e:
             logger.error(f"Failed to save cache: {e}")
@@ -161,7 +161,7 @@ def call_llm(prompt: str, use_cache: bool = True) -> str:
 #         cache = {}
 #         if os.path.exists(cache_file):
 #             try:
-#                 with open(cache_file, "r") as f:
+#                 with open(cache_file, "r", encoding="utf-8") as f:
 #                     cache = json.load(f)
 #             except:
 #                 logger.warning(f"Failed to load cache, starting with empty cache")
@@ -211,15 +211,15 @@ def call_llm(prompt: str, use_cache: bool = True) -> str:
 #         cache = {}
 #         if os.path.exists(cache_file):
 #             try:
-#                 with open(cache_file, "r") as f:
+#                 with open(cache_file, "r", encoding="utf-8") as f:
 #                     cache = json.load(f)
 #             except:
 #                 pass
 
 #         # Add to cache and save
 #         cache[prompt] = response_text
 #         try:
-#             with open(cache_file, "w") as f:
+#             with open(cache_file, "w", encoding="utf-8") as f:
 #                 json.dump(cache, f)
 #         except Exception as e:
 #             logger.error(f"Failed to save cache: {e}")
```

**File**: `utils/crawl_github_files.py` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ def should_include_file(file_path: str, file_name: str) -> bool:
 
                     # Read content
                     try:
-                        with open(abs_path, "r", encoding="utf-8") as f:
+                        with open(abs_path, "r", encoding="utf-8-sig") as f:
                             content = f.read()
                         files[rel_path] = content
                         print(f"Added {rel_path} ({file_size} bytes)")
```

**File**: `utils/crawl_local_files.py` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@ def crawl_local_files(
     gitignore_spec = None
     if os.path.exists(gitignore_path):
         try:
-            with open(gitignore_path, "r", encoding="utf-8") as f:
+            with open(gitignore_path, "r", encoding="utf-8-sig") as f:
                 gitignore_patterns = f.readlines()
             gitignore_spec = pathspec.PathSpec.from_lines("gitwildmatch", gitignore_patterns)
             print(f"Loaded .gitignore patterns from {gitignore_path}")
@@ -113,7 +113,7 @@ def crawl_local_files(
 
         # --- File is being processed ---        
         try:
-            with open(filepath, "r", encoding="utf-8") as f:
+            with open(filepath, "r", encoding="utf-8-sig") as f:
                 content = f.read()
             files_dict[relpath] = content
         except Exception as e:
```

---

### Incident Patch 2: `15c10cee` (2025-05-12)
**Commit Message**: Merge pull request #103 from Emiyaaaaa/fix/import

fix: add missing import

**File**: `utils/call_llm.py` (modified, +1/-0)
```diff
@@ -123,6 +123,7 @@ def call_llm(prompt: str, use_cache: bool = True) -> str:
 
 # Use OpenRouter API
 # def call_llm(prompt: str, use_cache: bool = True) -> str:
+#     import requests
 #     # Log the prompt
 #     logger.info(f"PROMPT: {prompt}")
 
```

---

### Incident Patch 3: `89318369` (2025-05-10)
**Commit Message**: fix markdown render

**File**: `docs/PocketFlow/index.md` (modified, +5/-5)
```diff
@@ -18,17 +18,17 @@ Additionally, it demonstrates an **A2A (Agent-to-Agent) Communication Framework*
 
 ```mermaid
 flowchart TD
-    A0["Node (`BaseNode`, `Node`, `AsyncNode`)
+    A0["Node (<code>BaseNode</code>, <code>Node</code>, <code>AsyncNode</code>)
 "]
-    A1["Flow (`Flow`, `AsyncFlow`)
+    A1["Flow (<code>Flow</code>, <code>AsyncFlow</code>)
 "]
-    A2["Shared State (`shared` dictionary)
+    A2["Shared State (<code>shared</code> dictionary)
 "]
     A3["Actions / Transitions
 "]
-    A4["Batch Processing (`BatchNode`, `BatchFlow`, `AsyncParallelBatchNode`)
+    A4["Batch Processing (<code>BatchNode</code>, <code>BatchFlow</code>, <code>AsyncParallelBatchNode</code>)
 "]
-    A5["Asynchronous Processing (`AsyncNode`, `AsyncFlow`)
+    A5["Asynchronous Processing (<code>AsyncNode</code>, <code>AsyncFlow</code>)
 "]
     A6["A2A (Agent-to-Agent) Communication Framework
 "]
```

---

### Incident Patch 4: `d0f43049` (2025-05-05)
**Commit Message**: Merge pull request #86 from The-Pocket/revert-84-patch-1

Revert "Update index.md to fix the broken links issue"

**File**: `docs/index.md` (modified, +6/-6)
```diff
@@ -20,8 +20,8 @@ This is a tutorial project of [Pocket Flow](https://github.com/The-Pocket/Pocket
 
 ## Example Tutorials for Popular GitHub Repositories
 
-- [AutoGen Core](./AutoGen%20Core/index.md) - Build AI teams that talk, think, and solve problems together like coworkers!
-- [Browser Use](./Browser%20Use/index.md) - Let AI surf the web for you, clicking buttons and filling forms like a digital assistant!
+- [AutoGen Core](./AutoGen Core/index.md) - Build AI teams that talk, think, and solve problems together like coworkers!
+- [Browser Use](./Browser Use/index.md) - Let AI surf the web for you, clicking buttons and filling forms like a digital assistant!
 - [Celery](./Celery/index.md) - Supercharge your app with background tasks that run while you sleep!
 - [Click](./Click/index.md) - Turn Python functions into slick command-line tools with just a decorator!
 - [Codex](./Codex/index.md) - Turn plain English into working code with this AI terminal wizard!
@@ -30,13 +30,13 @@ This is a tutorial project of [Pocket Flow](https://github.com/The-Pocket/Pocket
 - [DSPy](./DSPy/index.md) - Build LLM apps like Lego blocks that optimize themselves!
 - [FastAPI](./FastAPI/index.md) - Create APIs at lightning speed with automatic docs that clients will love!
 - [Flask](./Flask/index.md) - Craft web apps with minimal code that scales from prototype to production!
-- [Google A2A](./Google%20A2A/index.md) - The universal language that lets AI agents collaborate across borders!
+- [Google A2A](./Google A2A/index.md) - The universal language that lets AI agents collaborate across borders!
 - [LangGraph](./LangGraph/index.md) - Design AI agents as flowcharts where each step remembers what happened before!
 - [LevelDB](./LevelDB/index.md) - Store data at warp speed with Google's engine that powers blockchains!
-- [MCP Python SDK](./MCP%20Python%20SDK/index.md) - Build powerful apps that communicate through an elegant protocol without sweating the details!
-- [NumPy Core](./NumPy%20Core/index.md) - Master the engine behind data science that makes Python as fast as C!
+- [MCP Python SDK](./MCP Python SDK/index.md) - Build powerful apps that communicate through an elegant protocol without sweating the details!
+- [NumPy Core](./NumPy Core/index.md) - Master the engine behind data science that makes Python as fast as C!
 - [OpenManus](./OpenManus/index.md) - Build AI agents with digital brains that think, learn, and use tools just like humans do!
-- [Pydantic Core](./Pydantic%20Core/index.md) - Validate data at rocket speed with just Python type hints!
+- [Pydantic Core](./Pydantic Core/index.md) - Validate data at rocket speed with just Python type hints!
 - [Requests](./Requests/index.md) - Talk to the internet in Python with code so simple it feels like cheating!
 - [SmolaAgents](./SmolaAgents/index.md) - Build tiny AI agents that punch way above their weight class!
 
```

---

### Incident Patch 5: `ad6148ad` (2025-05-05)
**Commit Message**: Revert "Update index.md to fix the broken links issue"

**File**: `docs/index.md` (modified, +6/-6)
```diff
@@ -20,8 +20,8 @@ This is a tutorial project of [Pocket Flow](https://github.com/The-Pocket/Pocket
 
 ## Example Tutorials for Popular GitHub Repositories
 
-- [AutoGen Core](./AutoGen%20Core/index.md) - Build AI teams that talk, think, and solve problems together like coworkers!
-- [Browser Use](./Browser%20Use/index.md) - Let AI surf the web for you, clicking buttons and filling forms like a digital assistant!
+- [AutoGen Core](./AutoGen Core/index.md) - Build AI teams that talk, think, and solve problems together like coworkers!
+- [Browser Use](./Browser Use/index.md) - Let AI surf the web for you, clicking buttons and filling forms like a digital assistant!
 - [Celery](./Celery/index.md) - Supercharge your app with background tasks that run while you sleep!
 - [Click](./Click/index.md) - Turn Python functions into slick command-line tools with just a decorator!
 - [Codex](./Codex/index.md) - Turn plain English into working code with this AI terminal wizard!
@@ -30,13 +30,13 @@ This is a tutorial project of [Pocket Flow](https://github.com/The-Pocket/Pocket
 - [DSPy](./DSPy/index.md) - Build LLM apps like Lego blocks that optimize themselves!
 - [FastAPI](./FastAPI/index.md) - Create APIs at lightning speed with automatic docs that clients will love!
 - [Flask](./Flask/index.md) - Craft web apps with minimal code that scales from prototype to production!
-- [Google A2A](./Google%20A2A/index.md) - The universal language that lets AI agents collaborate across borders!
+- [Google A2A](./Google A2A/index.md) - The universal language that lets AI agents collaborate across borders!
 - [LangGraph](./LangGraph/index.md) - Design AI agents as flowcharts where each step remembers what happened before!
 - [LevelDB](./LevelDB/index.md) - Store data at warp speed with Google's engine that powers blockchains!
-- [MCP Python SDK](./MCP%20Python%20SDK/index.md) - Build powerful apps that communicate through an elegant protocol without sweating the details!
-- [NumPy Core](./NumPy%20Core/index.md) - Master the engine behind data science that makes Python as fast as C!
+- [MCP Python SDK](./MCP Python SDK/index.md) - Build powerful apps that communicate through an elegant protocol without sweating the details!
+- [NumPy Core](./NumPy Core/index.md) - Master the engine behind data science that makes Python as fast as C!
 - [OpenManus](./OpenManus/index.md) - Build AI agents with digital brains that think, learn, and use tools just like humans do!
-- [Pydantic Core](./Pydantic%20Core/index.md) - Validate data at rocket speed with just Python type hints!
+- [Pydantic Core](./Pydantic Core/index.md) - Validate data at rocket speed with just Python type hints!
 - [Requests](./Requests/index.md) - Talk to the internet in Python with code so simple it feels like cheating!
 - [SmolaAgents](./SmolaAgents/index.md) - Build tiny AI agents that punch way above their weight class!
 
```

---

### Incident Patch 6: `0dbae552` (2025-05-05)
**Commit Message**: Update index.md to fix the broken links issue

**File**: `docs/index.md` (modified, +6/-6)
```diff
@@ -20,8 +20,8 @@ This is a tutorial project of [Pocket Flow](https://github.com/The-Pocket/Pocket
 
 ## Example Tutorials for Popular GitHub Repositories
 
-- [AutoGen Core](./AutoGen Core/index.md) - Build AI teams that talk, think, and solve problems together like coworkers!
-- [Browser Use](./Browser Use/index.md) - Let AI surf the web for you, clicking buttons and filling forms like a digital assistant!
+- [AutoGen Core](./AutoGen%20Core/index.md) - Build AI teams that talk, think, and solve problems together like coworkers!
+- [Browser Use](./Browser%20Use/index.md) - Let AI surf the web for you, clicking buttons and filling forms like a digital assistant!
 - [Celery](./Celery/index.md) - Supercharge your app with background tasks that run while you sleep!
 - [Click](./Click/index.md) - Turn Python functions into slick command-line tools with just a decorator!
 - [Codex](./Codex/index.md) - Turn plain English into working code with this AI terminal wizard!
@@ -30,13 +30,13 @@ This is a tutorial project of [Pocket Flow](https://github.com/The-Pocket/Pocket
 - [DSPy](./DSPy/index.md) - Build LLM apps like Lego blocks that optimize themselves!
 - [FastAPI](./FastAPI/index.md) - Create APIs at lightning speed with automatic docs that clients will love!
 - [Flask](./Flask/index.md) - Craft web apps with minimal code that scales from prototype to production!
-- [Google A2A](./Google A2A/index.md) - The universal language that lets AI agents collaborate across borders!
+- [Google A2A](./Google%20A2A/index.md) - The universal language that lets AI agents collaborate across borders!
 - [LangGraph](./LangGraph/index.md) - Design AI agents as flowcharts where each step remembers what happened before!
 - [LevelDB](./LevelDB/index.md) - Store data at warp speed with Google's engine that powers blockchains!
-- [MCP Python SDK](./MCP Python SDK/index.md) - Build powerful apps that communicate through an elegant protocol without sweating the details!
-- [NumPy Core](./NumPy Core/index.md) - Master the engine behind data science that makes Python as fast as C!
+- [MCP Python SDK](./MCP%20Python%20SDK/index.md) - Build powerful apps that communicate through an elegant protocol without sweating the details!
+- [NumPy Core](./NumPy%20Core/index.md) - Master the engine behind data science that makes Python as fast as C!
 - [OpenManus](./OpenManus/index.md) - Build AI agents with digital brains that think, learn, and use tools just like humans do!
-- [Pydantic Core](./Pydantic Core/index.md) - Validate data at rocket speed with just Python type hints!
+- [Pydantic Core](./Pydantic%20Core/index.md) - Validate data at rocket speed with just Python type hints!
 - [Requests](./Requests/index.md) - Talk to the internet in Python with code so simple it feels like cheating!
 - [SmolaAgents](./SmolaAgents/index.md) - Build tiny AI agents that punch way above their weight class!
 
```

---

### Incident Patch 7: `c765bff2` (2025-05-01)
**Commit Message**: fix the default chapter number

**File**: `main.py` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ def main():
     # Add use_cache parameter to control LLM caching
     parser.add_argument("--no-cache", action="store_true", help="Disable LLM response caching (default: caching enabled)")
     # Add max_abstraction_num parameter to control the number of abstractions
-    parser.add_argument("--max-abstractions", type=int, default=10, help="Maximum number of abstractions to identify (default: 20)")
+    parser.add_argument("--max-abstractions", type=int, default=10, help="Maximum number of abstractions to identify (default: 10)")
 
     args = parser.parse_args()
 
```

**File**: `nodes.py` (modified, +2/-2)
```diff
@@ -86,7 +86,7 @@ def prep(self, shared):
         project_name = shared["project_name"]  # Get project name
         language = shared.get("language", "english")  # Get language
         use_cache = shared.get("use_cache", True)  # Get use_cache flag, default to True
-        max_abstraction_num = shared.get("max_abstraction_num", 10)  # Get max_abstraction_num, default to 20
+        max_abstraction_num = shared.get("max_abstraction_num", 10)  # Get max_abstraction_num, default to 10
 
         # Helper to create context from files, respecting limits (basic example)
         def create_llm_context(files_data):
@@ -693,7 +693,7 @@ def exec(self, item):
 
 - Explain how to use this abstraction to solve the use case{instruction_lang_note}. Give example inputs and outputs for code snippets (if the output isn't values, describe at a high level what will happen{instruction_lang_note}).
 
-- Each code block should be BELOW 20 lines! If longer code blocks are needed, break them down into smaller pieces and walk through them one-by-one. Aggresively simplify the code to make it minimal. Use comments{code_comment_note} to skip non-important implementation details. Each code block should have a beginner friendly explanation right after it{instruction_lang_note}.
+- Each code block should be BELOW 10 lines! If longer code blocks are needed, break them down into smaller pieces and walk through them one-by-one. Aggresively simplify the code to make it minimal. Use comments{code_comment_note} to skip non-important implementation details. Each code block should have a beginner friendly explanation right after it{instruction_lang_note}.
 
 - Describe the internal implementation to help understand what's under the hood{instruction_lang_note}. First provide a non-code or code-light walkthrough on what happens step-by-step when the abstraction is called{instruction_lang_note}. It's recommended to use a simple sequenceDiagram with a dummy example - keep it minimal with at most 5 participants to ensure clarity. If participant name has space, use: `participant QP as Query Processing`. {mermaid_lang_note}.
 
```

---

### Incident Patch 8: `6f4d62f8` (2025-05-01)
**Commit Message**: drop yaml fix

**File**: `nodes.py` (modified, +295/-169)
```diff
@@ -5,7 +5,6 @@
 from utils.crawl_github_files import crawl_github_files
 from utils.call_llm import call_llm
 from utils.crawl_local_files import crawl_local_files
-from utils.fix_yaml import add_indentation
 
 
 # Helper to get content for specific file indices
@@ -14,9 +13,12 @@ def get_content_for_indices(files_data, indices):
     for i in indices:
         if 0 <= i < len(files_data):
             path, content = files_data[i]
-            content_map[f"{i} # {path}"] = content # Use index + path as key for context
+            content_map[f"{i} # {path}"] = (
+                content  # Use index + path as key for context
+            )
     return content_map
 
+
 class FetchRepo(Node):
     def prep(self, shared):
         repo_url = shared.get("repo_url")
@@ -26,7 +28,7 @@ def prep(self, shared):
         if not project_name:
             # Basic name derivation from URL or directory
             if repo_url:
-                project_name = repo_url.split('/')[-1].replace('.git', '')
+                project_name = repo_url.split("/")[-1].replace(".git", "")
             else:
                 project_name = os.path.basename(os.path.abspath(local_dir))
             shared["project_name"] = project_name
@@ -43,7 +45,7 @@ def prep(self, shared):
             "include_patterns": include_patterns,
             "exclude_patterns": exclude_patterns,
             "max_file_size": max_file_size,
-            "use_relative_paths": True
+            "use_relative_paths": True,
         }
 
     def exec(self, prep_res):
@@ -55,7 +57,7 @@ def exec(self, prep_res):
                 include_patterns=prep_res["include_patterns"],
                 exclude_patterns=prep_res["exclude_patterns"],
                 max_file_size=prep_res["max_file_size"],
-                use_relative_paths=prep_res["use_relative_paths"]
+                use_relative_paths=prep_res["use_relative_paths"],
             )
         else:
             print(f"Crawling directory: {prep_res['local_dir']}...")
@@ -64,44 +66,61 @@ def exec(self, prep_res):
                 include_patterns=prep_res["include_patterns"],
                 exclude_patterns=prep_res["exclude_patterns"],
                 max_file_size=prep_res["max_file_size"],
-                use_relative_paths=prep_res["use_relative_paths"]
+                use_relative_paths=prep_res["use_relative_paths"],
             )
 
         # Convert dict to list of tuples: [(path, content), ...]
         files_list = list(result.get("files", {}).items())
         if len(files_list) == 0:
-            raise(ValueError("Failed to fetch files"))
+            raise (ValueError("Failed to fetch files"))
         print(f"Fetched {len(files_list)} files.")
         return files_list
 
     def post(self, shared, prep_res, exec_res):
-        shared["files"] = exec_res # List of (path, content) tuples
+        shared["files"] = exec_res  # List of (path, content) tuples
+
 
 class IdentifyAbstractions(Node):
     def prep(self, shared):
         files_data = shared["files"]
         project_name = shared["project_name"]  # Get project name
-        language = shared.get("language", "english") # Get language
+        language = shared.get("language", "english")  # Get language
         use_cache = shared.get("use_cache", True)  # Get use_cache flag, default to True
 
         # Helper to create context from files, respecting limits (basic example)
         def create_llm_context(files_data):
             context = ""
-            file_info = [] # Store tuples of (index, path)
+            file_info = []  # Store tuples of (index, path)
             for i, (path, content) in enumerate(files_data):
                 entry = f"--- File Index {i}: {path} ---\n{content}\n\n"
                 context += entry
                 file_info.append((i, path))
 
-            return context, file_info # file_info is list of (index, path)
+            return context, file_info  # file_info is list of (index, path)
 
         cont
```

**File**: `utils/fix_yaml.py` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-import re
-
-def add_indentation(text):
-    # This pattern matches lines that don't start with a hyphen or whitespace
-    pattern = r'^(?![-\s])(.*)$'
-    
-    # Replace with 4 spaces followed by the captured content
-    result = re.sub(pattern, r'    \1', text, flags=re.MULTILINE)
-    
-    return result
-
-
-if __name__ == "__main__":
-    # Example usage
-    text = """This line will be indented
-    - This line won't be indented
-    This line won't be indented either
-    Another line that will be indented"""
-
-    indented_text = add_indentation(text)
\ No newline at end of file
```

---

### Incident Patch 9: `98fa9fc0` (2025-04-30)
**Commit Message**: fix: improve file filtering, add new utility,

- Improved the speed of file filtering in `crawl_local_files.py` with folder-level exclusion
- Added `fix_yaml.py` utility for YAML indentation fixes
- Updated `nodes.py` to support up to 20 core abstractions
- add option for no cache.

**File**: `.env.sample` (modified, +4/-1)
```diff
@@ -1,2 +1,5 @@
 GEMINI_PROJECT_ID=<GEMINI_PROJECT_ID>
-GITHUB_TOKEN=<GITHUB_TOKEN>
\ No newline at end of file
+GEMINI_API_KEY=<GEMINI_API_KEY>
+GITHUB_TOKEN=<GITHUB_TOKEN>
+OPENROUTER_API_KEY = <OPENROUTER_API_KEY>
+OPENROUTER_MODEL = <OPENROUTER_MODEL>
\ No newline at end of file
```

**File**: `.gitignore` (modified, +8/-1)
```diff
@@ -99,4 +99,11 @@ coverage/
 llm_cache.json
 
 # Output files
-output/
\ No newline at end of file
+output/
+
+# uv manage
+pyproject.toml
+uv.lock
+
+docs/*.pdf
+docs/design-cn.md
```

**File**: `main.py` (modified, +9/-1)
```diff
@@ -14,8 +14,10 @@
 }
 
 DEFAULT_EXCLUDE_PATTERNS = {
+    "assets/*", "data/*", "examples/*", "images/*", "public/*", "static/*", "temp/*",
+    "docs/*", 
     "venv/*", ".venv/*", "*test*", "tests/*", "docs/*", "examples/*", "v1/*",
-    "dist/*", "build/*", "experimental/*", "deprecated/*",
+    "dist/*", "build/*", "experimental/*", "deprecated/*", "misc/*", 
     "legacy/*", ".git/*", ".github/*", ".next/*", ".vscode/*", "obj/*", "bin/*", "node_modules/*", "*.log"
 }
 
@@ -36,6 +38,8 @@ def main():
     parser.add_argument("-s", "--max-size", type=int, default=100000, help="Maximum file size in bytes (default: 100000, about 100KB).")
     # Add language parameter for multi-language support
     parser.add_argument("--language", default="english", help="Language for the generated tutorial (default: english)")
+    # Add use_cache parameter to control LLM caching
+    parser.add_argument("--no-cache", action="store_true", help="Disable LLM response caching (default: caching enabled)")
 
     args = parser.parse_args()
 
@@ -61,6 +65,9 @@ def main():
 
         # Add language for multi-language support
         "language": args.language,
+        
+        # Add use_cache flag (inverse of no-cache flag)
+        "use_cache": not args.no_cache,
 
         # Outputs will be populated by the nodes
         "files": [],
@@ -73,6 +80,7 @@ def main():
 
     # Display starting message with repository/directory and language
     print(f"Starting tutorial generation for: {args.repo or args.dir} in {args.language.capitalize()} language")
+    print(f"LLM caching: {'Disabled' if args.no_cache else 'Enabled'}")
 
     # Create the flow instance
     tutorial_flow = create_tutorial_flow()
```

**File**: `nodes.py` (modified, +23/-13)
```diff
@@ -1,9 +1,12 @@
 import os
+import re
 import yaml
 from pocketflow import Node, BatchNode
 from utils.crawl_github_files import crawl_github_files
 from utils.call_llm import call_llm
 from utils.crawl_local_files import crawl_local_files
+from utils.fix_yaml import add_indentation
+
 
 # Helper to get content for specific file indices
 def get_content_for_indices(files_data, indices):
@@ -79,6 +82,7 @@ def prep(self, shared):
         files_data = shared["files"]
         project_name = shared["project_name"]  # Get project name
         language = shared.get("language", "english") # Get language
+        use_cache = shared.get("use_cache", True)  # Get use_cache flag, default to True
 
         # Helper to create context from files, respecting limits (basic example)
         def create_llm_context(files_data):
@@ -94,10 +98,10 @@ def create_llm_context(files_data):
         context, file_info = create_llm_context(files_data)
         # Format file info for the prompt (comment is just a hint for LLM)
         file_listing_for_prompt = "\n".join([f"- {idx} # {path}" for idx, path in file_info])
-        return context, file_listing_for_prompt, len(files_data), project_name, language # Return language
+        return context, file_listing_for_prompt, len(files_data), project_name, language, use_cache # Return use_cache
 
     def exec(self, prep_res):
-        context, file_listing_for_prompt, file_count, project_name, language = prep_res  # Unpack project name and language
+        context, file_listing_for_prompt, file_count, project_name, language, use_cache = prep_res  # Unpack use_cache
         print(f"Identifying abstractions using LLM...")
 
         # Add language instruction and hints only if not English
@@ -117,7 +121,7 @@ def exec(self, prep_res):
 {context}
 
 {language_instruction}Analyze the codebase context.
-Identify the top 5-10 core most important abstractions to help those new to the codebase.
+Identify the top 5-20 core most important abstractions to help those new to the codebase.
 
 For each abstraction, provide:
 1. A concise `name`{name_lang_hint}.
@@ -144,12 +148,14 @@ def exec(self, prep_res):
     Another core concept, similar to a blueprint for objects.{desc_lang_hint}
   file_indices:
     - 5 # path/to/another.js
-# ... up to 10 abstractions
+# ... up to 20 abstractions
 ```"""
-        response = call_llm(prompt)
+        response = call_llm(prompt, use_cache=use_cache)  # Pass use_cache parameter
 
         # --- Validation ---
         yaml_str = response.strip().split("```yaml")[1].split("```")[0].strip()
+        # add whitespace to fix llm generation error(except -)
+        yaml_str = add_indentation(yaml_str)
         abstractions = yaml.safe_load(yaml_str)
 
         if not isinstance(abstractions, list):
@@ -203,6 +209,7 @@ def prep(self, shared):
         files_data = shared["files"]
         project_name = shared["project_name"]  # Get project name
         language = shared.get("language", "english") # Get language
+        use_cache = shared.get("use_cache", True)  # Get use_cache flag, default to True
 
         # Create context with abstraction names, indices, descriptions, and relevant file snippets
         context = "Identified Abstractions:\n"
@@ -230,10 +237,10 @@ def prep(self, shared):
         )
         context += file_context_str
 
-        return context, "\n".join(abstraction_info_for_prompt), project_name, language # Return language
+        return context, "\n".join(abstraction_info_for_prompt), project_name, language, use_cache # Return use_cache
 
     def exec(self, prep_res):
-        context, abstraction_listing, project_name, language = prep_res  # Unpack project name and language
+        context, abstraction_listing, project_name, language, use_cache = prep_res  # Unpack use_cache
         print(f"Analyzing relationships using LLM...")
 
         # Add language instruction and hints only if not English
@@ -339,6 +346,7 @@ def prep(self, shared):
         rel
```

**File**: `requirements.txt` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@ requests>=2.28.0
 gitpython>=3.1.0
 google-cloud-aiplatform>=1.25.0
 google-genai>=1.9.0
-python-dotenv>=1.0.0
+python-dotenv>=1.0.0
\ No newline at end of file
```

---

### Incident Patch 10: `98fc7b42` (2025-04-24)
**Commit Message**: Merge pull request #46 from siaeyy/fix/issue-35

Fix for issue #35

**File**: `utils/crawl_github_files.py` (modified, +68/-12)
```diff
@@ -135,21 +135,77 @@ def should_include_file(file_path: str, file_name: str) -> bool:
     owner = path_parts[0]
     repo = path_parts[1]
     
-    # Check if URL contains a specific branch/commit
-    if 'tree' in path_parts:
-        tree_index = path_parts.index('tree')
-        ref = path_parts[tree_index + 1]
-        # Combine all parts after the ref as the path
-        path_start = tree_index + 2
-        specific_path = '/'.join(path_parts[path_start:]) if path_start < len(path_parts) else ""
-    else:
-        ref = "main"  # Default branch
-        specific_path = ""
-    
     # Setup for GitHub API
     headers = {"Accept": "application/vnd.github.v3+json"}
     if token:
         headers["Authorization"] = f"token {token}"
+
+    def fetch_branches(owner: str, repo: str):
+        """Get brancshes of the repository"""
+
+        url = f"https://api.github.com/repos/{owner}/{repo}/branches"
+        response = requests.get(url, headers=headers)
+
+        if response.status_code == 404:
+            if not token:
+                print(f"Error 404: Repository not found or is private.\n"
+                      f"If this is a private repository, please provide a valid GitHub token via the 'token' argument or set the GITHUB_TOKEN environment variable.")
+            else:
+                print(f"Error 404: Repository not found or insufficient permissions with the provided token.\n"
+                      f"Please verify the repository exists and the token has access to this repository.")
+            return []
+            
+        if response.status_code != 200:
+            print(f"Error fetching the branches of {owner}/{path}: {response.status_code} - {response.text}")
+            return []
+
+        return response.json()
+
+    def check_tree(owner: str, repo: str, tree: str):
+        """Check the repository has the given tree"""
+
+        url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{tree}"
+        response = requests.get(url, headers=headers)
+
+        return True if response.status_code == 200 else False 
+
+    # Check if URL contains a specific branch/commit
+    if len(path_parts) > 2 and 'tree' == path_parts[2]:
+        join_parts = lambda i: '/'.join(path_parts[i:])
+
+        branches = fetch_branches(owner, repo)
+        branch_names = map(lambda branch: branch.get("name"), branches)
+
+        # Fetching branches is not successfully
+        if len(branches) == 0:
+            return
+
+        # To check branch name
+        relevant_path = join_parts(3)
+
+        # Find a match with relevant path and get the branch name
+        filter_gen = (name for name in branch_names if relevant_path.startswith(name))
+        ref = next(filter_gen, None)
+
+        # If match is not found, check for is it a tree
+        if ref == None:
+            tree = path_parts[3]
+            ref = tree if check_tree(owner, repo, tree) else None
+
+        # If it is neither a tree nor a branch name
+        if ref == None:
+            print(f"The given path does not match with any branch and any tree in the repository.\n"
+                  f"Please verify the path is exists.")
+            return
+
+        # Combine all parts after the ref as the path
+        part_index = 5 if '/' in ref else 4
+        specific_path = join_parts(part_index) if part_index < len(path_parts) else ""
+    else:
+        # Dont put the ref param to quiery
+        # and let Github decide default branch
+        ref = None
+        specific_path = ""
     
     # Dictionary to store path -> content mapping
     files = {}
@@ -158,7 +214,7 @@ def should_include_file(file_path: str, file_name: str) -> bool:
     def fetch_contents(path):
         """Fetch contents of the repository at a specific path and commit"""
         url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
-        params = {"ref": ref}
+        params = {"ref": ref} if ref != None else {}
         
         response = req
```

#### Recent Merged Pull Requests:
- **PR #198** (closed): Fix a small issue in PocketFlow-Tutorial-Codebase-Knowledge (#196) (@bglglzd)
- **PR #197** (closed): Fix typo in PocketFlow-Tutorial-Codebase-Knowledge (#196) (@bglglzd)
- **PR #195** (closed): call claude code on local machine to avoid API key usage (@voxelvoxelvoxel)
- **PR #194** (closed): call claude code on local machine to avoid API key usage (@voxelvoxelvoxel)
- **PR #190** (closed): feat: split large local files into configurable content chunks (@yuedong111)
- **PR #171** (closed): Copilot llm (@kondoaki)
- **PR #166** (closed): delete (@ld-nesto)
- **PR #165** (2025-10-24): Automatically switch provider based on envirnment variables, Ollama support: closes #13 & #50 (@taqtiqa-mark)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
