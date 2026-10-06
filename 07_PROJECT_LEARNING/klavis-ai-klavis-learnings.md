# Forensic Learning Record (Deep Inspection): Klavis-AI/klavis

> **Canonical Artifact**: `07_PROJECT_LEARNING/klavis-ai-klavis-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Klavis-AI/klavis](https://github.com/Klavis-AI/klavis))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:39.380Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Klavis-AI/klavis`
- **Description**: Klavis AI:  MCP integration platforms that let AI agents use tools reliably at any scale
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5805 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mcp_servers/coinbase/utils/__init__.py`
```
from .rate_limiter import rate_limited

__all__ = [
    "rate_limited",
]
```

### Core Architecture Module: `mcp_servers/coinbase/utils/rate_limiter.py`
```
import asyncio
import functools
import logging
import time

from typing import Any, Callable, Optional
from contextlib import asynccontextmanager

from tools.constants import (
    COINBASE_DEFAULT_RATE_LIMIT,
    COINBASE_MARKET_DATA_RATE_LIMIT,
    COINBASE_ACCOUNTS_RATE_LIMIT,
    COINBASE_PRODUCTS_RATE_LIMIT,
    COINBASE_MAX_RETRY_ATTEMPTS,
    COINBASE_INITIAL_DELAY,
    COINBASE_MAX_DELAY,
    COINBASE_BACKOFF_FACTOR,
)

logger = logging.getLogger(__name__)


_rate_limiters = {}


class RateLimitConfig:
    """Configuration class for rate limiting settings."""

    def __init__(self):
        # Default rate limit for Coinbase API
        self.default_max_requests_per_second = COINBASE_DEFAULT_RATE_LIMIT

        # API-specific rate limits with smart defaults
        # Market API: 10,000 per hour = 2.78 per second, rounded down to 2 for safety
        self.market_data_rate_limit = COINBASE_MARKET_DATA_RATE_LIMIT

        # Accounts API: 10,000 per hour = 2.78 per second, rounded down to 2 for safety
        self.accounts_rate_limit = COINBASE_ACCOUNTS_RATE_LIMIT

        # Products API: 10 per second
        self.products_rate_limit = COINBASE_PRODUCTS_RATE_LIMIT

        # Retry settings
        self.max_retry_attempts = COINBASE_MAX_RETRY_ATTEMPTS
        self.initial_delay = COINBASE_INITIAL_DELAY
        self.max_delay = COINBASE_MAX_DELAY
        self.backoff_factor = COINBASE_BACKOFF_FACTOR


class TokenBucketRateLimiter:
    """
    Token Bucket Rate Limiter Implementation

    The token bucket algorithm allows for a burst of traffic up to the bucket capacity,
    while maintaining a steady rate of token refill.
    """

    def __init__(
        self,
        tokens_per_second: int,
        bucket_capacity: Optional[int] = None
    ):
        """
        Initialize token bucket rate limiter.

        Args:
            tokens_per_second: Rate at which tokens are refilled
            bucket_capacity: Maximum number of tokens in bucket (defaults to tokens_per_second)
        """
        self.tokens_per_second = tokens_per_second
        self.bucket_capacity = bucket_capacity or tokens_per_second
        self.tokens = self.bucket_capacity  # Start with full bucket
        self.last_refill_time = time.time()

    def _refill_tokens(self):
        """Refill tokens based on time elapsed since last refill."""
        current_time = time.time()
        time_elapsed = current_time - self.last_refill_time

        # Calculate tokens to add
        tokens_to_add = time_elapsed * self.tokens_per_second

        # Update tokens (don't exceed capacity)
        self.tokens = min(self.bucket_capacity, self.tokens + tokens_to_add)
        self.last_refill_time = current_time

    def try_consume_token(self) -> bool:
        """
        Try to consume a token from the bucket.

        Returns:
            True if token was consumed, False if bucket is empty
        """
        self._refill_tokens()

        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

    def get_wait_time(self) -> float:
        """
        Calculate how long to wait before a token will be available.

        Returns:
            Time in seconds to wait
        """
        self._refill_tokens()

        if self.tokens >= 1:
            return 0.0

        # Calculate time until next token is available
        tokens_needed = 1 - self.tokens
        wait_time = tokens_needed / self.tokens_per_second

        return max(wait_time, 0.1)  # Minimum 0.1 second wait


class RateLimiter:
    def __init__(
        self,
        max_requests_per_second: Optional[int] = None
    ):
        self.max_requests_per_second = max_requests_per_second or config.default_max_requests_per_second
        self.token_bucket = TokenBucketRateLimiter(
            self.max_requests_per_second
        )

    def _is_rate_limited(self) -> bool:
        """Check if we're currently rate limited using token bucket."""
        return not self.token_bucket.try_consume_token()

    def _calculate_wait_time(self) -> float:
        """Calculate how long to wait before next request is allowed."""
        return self.token_bucket.get_wait_time()

    def _add_request(self):
        """Record a new request (not needed for token bucket, but kept for compatibility)."""
        pass

    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry with exponential backoff."""
        delay = min(
            config.initial_delay * (config.backoff_factor ** (attempt - 1)),
            config.max_delay
        )
        return delay

    def _is_rate_limit_error(self, error: Exception) -> bool:
        """Check if the error is a rate limit error."""
        error_str = str(error).lower()
        return any(phrase in error_str for phrase in [
            'rate limit',
            '429',
            'too many requests',
            'quota exceeded',
            'throttled'
        ])

    async def _delay(self, seconds: float):
        """Async delay function."""
        await asyncio.sleep(seconds)

    async def with_retry(self, operation: Callable, context: str = "API request") -> Any:
        """
        Execute an operation with retry logic and rate limiting.

        Args:
            operation: The async function to execute
            context: Context string for logging

        Returns:
            The result of the operation
        """
        attempt = 1

        while attempt <= config.max_retry_attempts:
            try:
                # Check rate limits before making request
                if self._is_rate_limited():
                    wait_time = self._calculate_wait_time()
                    logger.warning(
                        f"Rate limit active for {context}. Waiting {wait_time:.2f}s")
                    await self._delay(wait_time)

                # Record the request
                self._add_request()

                # Execute the operation
                return await operation()

            except Exception as error:
                if self._is_rate_limit_error(error) and attempt < config.max_retry_attempts:
                    delay = self._calculate_delay(attempt)
                    logger.warning(
                        f"Rate limit hit for {context}. "
                        f"Attempt {attempt}/{config.max_retry_attempts}. "
                        f"Retrying in {delay:.2f}s"
                    )
                    await self._delay(delay)
                    attempt += 1
                    continue
                else:
                    # Re-raise the error if it's not a rate limit error or we've exhausted retries
                    raise error

        # This should never be reached, but just in case
        raise Exception(
            f"Max retry attempts ({config.max_retry_attempts}) exceeded for {context}")

    @asynccontextmanager
    async def rate_limited_operation(self, context: str = "API request"):
        """
        Context manager for rate-limited operations.

        Args:
            context: Context string for logging

        Yields:
            None
        """
        try:
            # Check rate limits before starting
            if self._is_rate_limited():
                wait_time = self._calculate_wait_time()
                logger.warning(
                    f"Rate limit active for {context}. Waiting {wait_time:.2f}s")
                await self._delay(wait_time)

            # Record the request
            self._add_request()

            yield

        except Exception as error:
            if self._is_rate_limit_error(error):
                logger.error(f"Rate limit error in {context}: {error}")
            raise error


def get_rate_limiter(
    api_type: str = "default",
    max_requests_per_second: Optional[int] = None
) -> RateLimiter:
    """
    Get a rate limiter instance for a specific API type.

    Args:
        api_type: Type of API (e.g., "market_data", "accounts", "products")
        max_requests_per_second: Custom per-second limit for this API type

    Returns:
        RateLimiter instance
    """
    if max_requests_per_second is None:
        if api_type == "market_data":
            max_requests_per_second = config.market_data_rate_limit
        elif api_type == "accounts":
            max_requests_per_second = config.accounts_rate_limit
        elif api_type == "products":
            max_requests_per_second = config.products_rate_limit
        else:
            max_requests_per_second = config.default_max_requests_per_second

    if api_type not in _rate_limiters:
        _rate_limiters[api_type] = RateLimiter(
            max_requests_per_second=max_requests_per_second
        )

    return _rate_limiters[api_type]


def rate_limited(
    api_type: str = "default",
    max_requests_per_second: Optional[int] = None
):
    """
    Decorator to apply rate limiting to async functions.

    Args:
        api_type: Type of API for rate limiting configuration
        max_requests_per_second: Custom per-second limit for this function

    Returns:
        Decorated function with rate limiting
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            rate_limiter = get_rate_limiter(
                api_type=api_type,
                max_requests_per_second=max_requests_per_second
            )

            async def operation():
                return await func(*args, **kwargs)

            context = f"{api_type} API call: {func.__name__}"
            return await rate_limiter.with_retry(operation, context)

        return wrapper
    return decorator


# Create config instance
config = RateLimitConfig()

```

### Core Architecture Module: `mcp_servers/confluence/utils.py`
```
import re

from errors import ToolExecutionError, RetryableToolError


def remove_none_values(data: dict) -> dict:
    """Remove all keys with None values from the dictionary."""
    return {k: v for k, v in data.items() if v is not None}


def validate_ids(ids: list[str] | None, max_length: int) -> None:
    """Validate a list of IDs. The ids can be page ids, space ids, etc.

    A valid id is a string that is a number.

    Args:
        ids: A list of IDs to validate.
        max_length: Maximum number of IDs allowed.

    Returns:
        None

    Raises:
        ToolExecutionError: If any of the IDs are not valid.
        RetryableToolError: If the number of IDs is greater than the max length.
    """
    if not ids:
        return
    if len(ids) > max_length:
        raise RetryableToolError(
            message=f"The 'ids' parameter must have less than {max_length} items. Got {len(ids)}"
        )
    if any(not id_.isdigit() for id_ in ids):
        raise ToolExecutionError(message="Invalid ID provided. IDs are numeric")


def build_child_url(base_url: str, child: dict) -> str | None:
    """Build URL for a child node based on its type and status.

    Args:
        base_url: The base URL for the Confluence space
        child: A dictionary representing a Confluence content item

    Returns:
        The URL for the child, or None if it can't be determined
    """
    if child["type"] in ("whiteboard", "database", "embed"):
        return f"{base_url}/{child['type']}/{child['id']}"
    elif child["type"] == "folder":
        return None
    elif child["type"] == "page":
        parsed_title = re.sub(r"[ '\s]+", "+", child["title"].strip())
        if child.get("status") == "draft":
            return f"{base_url}/{child['type']}s/edit-v2/{child['id']}"
        else:
            return f"{base_url}/{child['type']}s/{child['id']}/{parsed_title}"
    return None


def build_hierarchy(transformed_children: list, parent_id: str, parent_node: dict) -> None:
    """Build parent-child hierarchy from a flat list of descendants.

    This function takes a flat list of items that have parentId references and
    builds a hierarchical tree structure. It modifies the parent_node in place.

    Args:
        transformed_children: List of child nodes with parentId fields
        parent_id: The ID of the parent node
        parent_node: The parent node to attach direct children to

    Returns:
        None (modifies parent_node in place)
    """
    # Create a map of children by their ID for efficient lookups
    child_map = {child["id"]: child for child in transformed_children}

    # Find all direct children of the given parent_id
    direct_children = []
    for child in transformed_children:
        if child.get("parentId") == parent_id:
            direct_children.append(child)
        elif child.get("parentId") in child_map:
            # Add child to its parent's children list
            parent = child_map[child.get("parentId")]
            if "children" not in parent:
                parent["children"] = []
            parent["children"].append(child)

    # Set the direct children on the parent node
    parent_node["children"] = direct_children 
```

### Core Architecture Module: `mcp_servers/context7/packages/cli/src/utils/api.ts`
```
import type {
  ListSkillsResponse,
  SingleSkillResponse,
  SearchResponse,
  DownloadResponse,
} from "../types.js";
import { downloadSkillFromGitHub } from "./github.js";

let baseUrl = "https://context7.com";

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

export async function listProjectSkills(project: string): Promise<ListSkillsResponse> {
  const params = new URLSearchParams({ project });
  const response = await fetch(`${baseUrl}/api/v2/skills?${params}`);
  return (await response.json()) as ListSkillsResponse;
}

export async function getSkill(project: string, skillName: string): Promise<SingleSkillResponse> {
  const params = new URLSearchParams({ project, skill: skillName });
  const response = await fetch(`${baseUrl}/api/v2/skills?${params}`);
  return (await response.json()) as SingleSkillResponse;
}

export async function searchSkills(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ query });
  const response = await fetch(`${baseUrl}/api/v2/skills?${params}`);
  return (await response.json()) as SearchResponse;
}

export function trackInstalls(skills: string[], ides: string[]): void {
  if (process.env.CTX7_TELEMETRY_DISABLED || !skills.length) return;
  fetch(`${baseUrl}/api/v2/skills/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills, ides }),
  }).catch(() => {});
}

export async function downloadSkill(project: string, skillName: string): Promise<DownloadResponse> {
  const skillData = await getSkill(project, skillName);

  if (skillData.error) {
    return {
      skill: { name: skillName, description: "", url: "", project },
      files: [],
      error: skillData.message || skillData.error,
    };
  }

  const skill = {
    name: skillData.name,
    description: skillData.description,
    url: skillData.url,
    project: skillData.project,
  };

  const { files, error } = await downloadSkillFromGitHub(skill);

  if (error) {
    return { skill, files: [], error };
  }

  return { skill, files };
}

```

### Core Architecture Module: `mcp_servers/context7/packages/cli/src/utils/github.ts`
```
import type { SkillFile, Skill } from "../types.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  branch: string;
  path: string;
} | null {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);

    // Handle raw.githubusercontent.com URLs
    // Format: https://raw.githubusercontent.com/owner/repo/refs/heads/branch/path/SKILL.md
    if (urlObj.hostname === "raw.githubusercontent.com") {
      if (parts.length < 5) return null;

      const owner = parts[0];
      const repo = parts[1];

      // Handle refs/heads/branch format
      if (parts[2] === "refs" && parts[3] === "heads") {
        const branch = parts[4];
        // Get directory path (exclude the filename like SKILL.md)
        const pathParts = parts.slice(5);
        // Remove the last part if it looks like a file (has extension)
        if (pathParts.length > 0 && pathParts[pathParts.length - 1].includes(".")) {
          pathParts.pop();
        }
        const path = pathParts.join("/");
        return { owner, repo, branch, path };
      }

      // Handle direct branch format: owner/repo/branch/path
      const branch = parts[2];
      const pathParts = parts.slice(3);
      if (pathParts.length > 0 && pathParts[pathParts.length - 1].includes(".")) {
        pathParts.pop();
      }
      const path = pathParts.join("/");
      return { owner, repo, branch, path };
    }

    // Handle github.com tree URLs
    // Format: https://github.com/owner/repo/tree/branch/path
    if (urlObj.hostname === "github.com") {
      if (parts.length < 4 || parts[2] !== "tree") return null;

      const owner = parts[0];
      const repo = parts[1];
      const branch = parts[3];
      const path = parts.slice(4).join("/");

      return { owner, repo, branch, path };
    }

    return null;
  } catch {
    return null;
  }
}

export async function downloadSkillFromGitHub(
  skill: Skill & { project: string }
): Promise<{ files: SkillFile[]; error?: string }> {
  try {
    const parsed = parseGitHubUrl(skill.url);

    if (!parsed) {
      return { files: [], error: `Invalid GitHub URL: ${skill.url}` };
    }

    const { owner, repo, branch, path: skillPath } = parsed;

    const treeUrl = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const treeResponse = await fetch(treeUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "context7-cli",
      },
    });

    if (!treeResponse.ok) {
      return { files: [], error: `GitHub API error: ${treeResponse.status}` };
    }

    const treeData = (await treeResponse.json()) as GitHubTreeResponse;

    const skillFiles = treeData.tree.filter(
      (item) => item.type === "blob" && item.path.startsWith(skillPath + "/")
    );

    if (skillFiles.length === 0) {
      return { files: [], error: `No files found in ${skillPath}` };
    }

    const files: SkillFile[] = [];
    for (const item of skillFiles) {
      const rawUrl = `${GITHUB_RAW}/${owner}/${repo}/${branch}/${item.path}`;
      const fileResponse = await fetch(rawUrl);

      if (!fileResponse.ok) {
        console.warn(`Failed to fetch ${item.path}: ${fileResponse.status}`);
        continue;
      }

      const content = await fileResponse.text();
      const relativePath = item.path.slice(skillPath.length + 1);

      files.push({
        path: relativePath,
        content,
      });
    }

    return { files };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { files: [], error: message };
  }
}

```

### Core Architecture Module: `mcp_servers/context7/packages/cli/src/utils/ide.ts`
```
import pc from "picocolors";
import { select, checkbox, confirm } from "@inquirer/prompts";
import { access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

import { log } from "./logger.js";
import type {
  IDE,
  IDEOptions,
  Scope,
  AddOptions,
  ListOptions,
  RemoveOptions,
  InstallTargets,
} from "../types.js";
import { IDE_PATHS, IDE_GLOBAL_PATHS, IDE_NAMES, DEFAULT_CONFIG } from "../types.js";
import { dirname } from "path";

export function getSelectedIdes(options: IDEOptions): IDE[] {
  const ides: IDE[] = [];
  if (options.claude) ides.push("claude");
  if (options.cursor) ides.push("cursor");
  if (options.codex) ides.push("codex");
  if (options.opencode) ides.push("opencode");
  if (options.amp) ides.push("amp");
  if (options.antigravity) ides.push("antigravity");
  return ides;
}

export function hasExplicitIdeOption(options: IDEOptions): boolean {
  return !!(
    options.claude ||
    options.cursor ||
    options.codex ||
    options.opencode ||
    options.amp ||
    options.antigravity
  );
}

interface DetectedIdes {
  ides: IDE[];
  scope: Scope;
}

export async function detectInstalledIdes(preferredScope?: Scope): Promise<DetectedIdes | null> {
  const allIdes = Object.keys(IDE_PATHS) as IDE[];

  if (preferredScope === "global") {
    const globalIdes: IDE[] = [];
    for (const ide of allIdes) {
      const detectionPath = dirname(IDE_GLOBAL_PATHS[ide]);
      const globalParent = join(homedir(), detectionPath);
      try {
        await access(globalParent);
        globalIdes.push(ide);
      } catch {}
    }
    if (globalIdes.length > 0) {
      return { ides: globalIdes, scope: "global" };
    }
    return null;
  }

  const projectIdes: IDE[] = [];
  for (const ide of allIdes) {
    const detectionPath = dirname(IDE_PATHS[ide]);
    const projectParent = join(process.cwd(), detectionPath);
    try {
      await access(projectParent);
      projectIdes.push(ide);
    } catch {}
  }

  if (projectIdes.length > 0) {
    return { ides: projectIdes, scope: "project" };
  }

  return null;
}

export async function promptForInstallTargets(options: AddOptions): Promise<InstallTargets | null> {
  if (hasExplicitIdeOption(options)) {
    const ides = getSelectedIdes(options);
    const scope: Scope = options.global ? "global" : "project";
    return {
      ides: ides.length > 0 ? ides : [DEFAULT_CONFIG.defaultIde],
      scopes: [scope],
    };
  }

  const preferredScope: Scope | undefined = options.global ? "global" : undefined;
  const detected = await detectInstalledIdes(preferredScope);

  if (detected) {
    const scope: Scope = options.global ? "global" : detected.scope;
    const pathMap = scope === "global" ? IDE_GLOBAL_PATHS : IDE_PATHS;
    const baseDir = scope === "global" ? homedir() : process.cwd();

    const paths = detected.ides.map((ide) => join(baseDir, pathMap[ide]));
    const pathList = paths.join("\n");

    log.blank();
    let confirmed: boolean;
    try {
      confirmed = await confirm({
        message: `Install to detected location(s)?\n${pc.dim(pathList)}`,
        default: true,
      });
    } catch {
      return null;
    }

    if (!confirmed) {
      log.warn("Installation cancelled");
      return null;
    }

    return { ides: detected.ides, scopes: [scope] };
  }

  // No IDE detected - prompt user to select which client(s) to install for
  log.blank();

  const scope: Scope = options.global ? "global" : "project";
  const pathMap = scope === "global" ? IDE_GLOBAL_PATHS : IDE_PATHS;
  const baseDir = scope === "global" ? homedir() : process.cwd();

  const ideChoices = (Object.keys(IDE_NAMES) as IDE[]).map((ide) => ({
    name: `${IDE_NAMES[ide]} ${pc.dim(`(${pathMap[ide]})`)}`,
    value: ide,
    checked: ide === DEFAULT_CONFIG.defaultIde,
  }));

  let selectedIdes: IDE[];
  try {
    selectedIdes = await checkbox({
      message: `Which clients do you want to install the skill(s) for?\n${pc.dim(baseDir)}`,
      choices: ideChoices,
      required: true,
    });
  } catch {
    return null;
  }

  if (selectedIdes.length === 0) {
    log.warn("You must select at least one client");
    return null;
  }

  return { ides: selectedIdes, scopes: [scope] };
}

export async function promptForSingleTarget(
  options: ListOptions | RemoveOptions
): Promise<{ ide: IDE; scope: Scope } | null> {
  if (hasExplicitIdeOption(options)) {
    const ides = getSelectedIdes(options);
    const ide = ides[0] || DEFAULT_CONFIG.defaultIde;
    const scope: Scope = options.global ? "global" : "project";
    return { ide, scope };
  }

  log.blank();

  const ideChoices = (Object.keys(IDE_NAMES) as IDE[]).map((ide) => ({
    name: `${IDE_NAMES[ide]} ${pc.dim(`(${IDE_PATHS[ide]})`)}`,
    value: ide,
  }));

  let selectedIde: IDE;
  try {
    selectedIde = await select({
      message: "Which client?",
      choices: ideChoices,
      default: DEFAULT_CONFIG.defaultIde,
    });
  } catch {
    return null;
  }

  let selectedScope: Scope;
  if (options.global !== undefined) {
    selectedScope = options.global ? "global" : "project";
  } else {
    try {
      selectedScope = await select({
        message: "Which scope?",
        choices: [
          {
            name: `Project ${pc.dim("(current directory)")}`,
            value: "project" as Scope,
          },
          {
            name: `Global ${pc.dim("(home directory)")}`,
            value: "global" as Scope,
          },
        ],
        default: DEFAULT_CONFIG.defaultScope,
      });
    } catch {
      return null;
    }
  }

  return { ide: selectedIde, scope: selectedScope };
}

export function getTargetDirs(targets: InstallTargets): string[] {
  // Prioritize Claude to receive original files (others get symlinks)
  const sortedIdes = [...targets.ides].sort((a, b) => {
    if (a === "claude") return -1;
    if (b === "claude") return 1;
    return 0;
  });

  const dirs: string[] = [];
  for (const ide of sortedIdes) {
    for (const scope of targets.scopes) {
      if (scope === "global") {
        dirs.push(join(homedir(), IDE_GLOBAL_PATHS[ide]));
      } else {
        dirs.push(join(process.cwd(), IDE_PATHS[ide]));
      }
    }
  }
  return dirs;
}

export function getTargetDirFromSelection(ide: IDE, scope: Scope): string {
  if (scope === "global") {
    return join(homedir(), IDE_GLOBAL_PATHS[ide]);
  }
  return join(process.cwd(), IDE_PATHS[ide]);
}

```

### Core Architecture Module: `mcp_servers/context7/packages/cli/src/utils/installer.ts`
```
import { mkdir, writeFile, rm, symlink, lstat } from "fs/promises";
import { join } from "path";

import type { SkillFile } from "../types.js";

export async function installSkillFiles(
  skillName: string,
  files: SkillFile[],
  targetDir: string
): Promise<void> {
  const skillDir = join(targetDir, skillName);

  for (const file of files) {
    const filePath = join(skillDir, file.path);
    const fileDir = join(filePath, "..");

    await mkdir(fileDir, { recursive: true });
    await writeFile(filePath, file.content);
  }
}

export async function symlinkSkill(
  skillName: string,
  sourcePath: string,
  targetDir: string
): Promise<void> {
  const targetPath = join(targetDir, skillName);

  try {
    const stats = await lstat(targetPath);
    if (stats.isSymbolicLink() || stats.isDirectory()) {
      await rm(targetPath, { recursive: true });
    }
  } catch {}

  await mkdir(targetDir, { recursive: true });
  await symlink(sourcePath, targetPath);
}

```

### Core Architecture Module: `mcp_servers/context7/packages/cli/src/utils/logger.ts`
```
import pc from "picocolors";

export const log = {
  info: (message: string) => console.log(pc.cyan(message)),
  success: (message: string) => console.log(pc.green(`✔ ${message}`)),
  warn: (message: string) => console.log(pc.yellow(`⚠ ${message}`)),
  error: (message: string) => console.log(pc.red(`✖ ${message}`)),
  dim: (message: string) => console.log(pc.dim(message)),
  item: (message: string) => console.log(pc.green(`  ${message}`)),
  itemAdd: (message: string) => console.log(`  ${pc.green("+")} ${message}`),
  plain: (message: string) => console.log(message),
  blank: () => console.log(""),
};

```

### Core Architecture Module: `mcp_servers/context7/packages/cli/src/utils/parse-input.ts`
```
export interface ParsedSkillInput {
  type: "repo" | "url";
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

export function parseSkillInput(input: string): ParsedSkillInput | null {
  const urlMatch = input.match(
    /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)/
  );
  if (urlMatch) {
    const [, owner, repo, branch, path] = urlMatch;
    return { type: "url", owner, repo, branch, path };
  }

  const shortMatch = input.match(/^\/?([^\/]+)\/([^\/]+)$/);
  if (shortMatch) {
    const [, owner, repo] = shortMatch;
    return { type: "repo", owner, repo };
  }

  return null;
}

```

### Core Architecture Module: `mcp_servers/context7/packages/mcp/src/lib/utils.ts`
```
import { SearchResponse, SearchResult } from "./types.js";

function getSourceReputationLabel(
  sourceReputation?: number
): "High" | "Medium" | "Low" | "Unknown" {
  if (sourceReputation === undefined || sourceReputation < 0) return "Unknown";
  if (sourceReputation >= 7) return "High";
  if (sourceReputation >= 4) return "Medium";
  return "Low";
}

export function formatSearchResult(result: SearchResult): string {
  const formattedResult = [
    `- Title: ${result.title}`,
    `- Context7-compatible library ID: ${result.id}`,
    `- Description: ${result.description}`,
  ];

  if (result.totalSnippets !== -1 && result.totalSnippets !== undefined) {
    formattedResult.push(`- Code Snippets: ${result.totalSnippets}`);
  }

  const reputationLabel = getSourceReputationLabel(result.trustScore);
  formattedResult.push(`- Source Reputation: ${reputationLabel}`);

  if (result.benchmarkScore !== undefined && result.benchmarkScore > 0) {
    formattedResult.push(`- Benchmark Score: ${result.benchmarkScore}`);
  }

  if (result.versions !== undefined && result.versions.length > 0) {
    formattedResult.push(`- Versions: ${result.versions.join(", ")}`);
  }

  return formattedResult.join("\n");
}

export function formatSearchResults(searchResponse: SearchResponse): string {
  if (!searchResponse.results || searchResponse.results.length === 0) {
    return "No documentation libraries found matching your query.";
  }

  const formattedResults = searchResponse.results.map(formatSearchResult);
  return formattedResults.join("\n----------\n");
}

export function extractClientInfoFromUserAgent(
  userAgent: string | undefined
): { ide?: string; version?: string } | undefined {
  if (!userAgent) return undefined;
  const match = userAgent.match(/^([^\/\s]+)\/([^\s(]+)/);
  if (match) {
    return { ide: match[1], version: match[2] };
  }
  return undefined;
}

```

### Core Architecture Module: `mcp_servers/context7/packages/sdk/src/utils/format.ts`
```
import type { Documentation, Library } from "@commands/types";
import type { ApiCodeSnippet, ApiInfoSnippet } from "@commands/get-context/types";

export function formatCodeSnippet(snippet: ApiCodeSnippet): Documentation {
  const codeBlocks = snippet.codeList
    .map((c) => `\`\`\`${c.language}\n${c.code}\n\`\`\``)
    .join("\n\n");

  const content = snippet.codeDescription
    ? `${snippet.codeDescription}\n\n${codeBlocks}`
    : codeBlocks;

  return {
    title: snippet.codeTitle,
    content,
    source: snippet.codeId,
  };
}

export function formatInfoSnippet(snippet: ApiInfoSnippet): Documentation {
  return {
    title: snippet.breadcrumb || "Documentation",
    content: snippet.content,
    source: snippet.pageId,
  };
}

export function formatLibrary(r: {
  id: string;
  title: string;
  description: string;
  versions?: string[];
  totalSnippets?: number;
  trustScore?: number;
  benchmarkScore?: number;
}): Library {
  return {
    id: r.id,
    name: r.title,
    description: r.description,
    totalSnippets: r.totalSnippets ?? 0,
    trustScore: r.trustScore ?? 0,
    benchmarkScore: r.benchmarkScore ?? 0,
    versions: r.versions,
  };
}

/**
 * Maps numeric trust score to an interpretable label.
 */
function getTrustScoreLabel(trustScore?: number): "High" | "Medium" | "Low" | "Unknown" {
  if (trustScore === undefined || trustScore < 0) return "Unknown";
  if (trustScore >= 7) return "High";
  if (trustScore >= 4) return "Medium";
  return "Low";
}

/**
 * Formats a single library as a human-readable text block.
 */
export function formatLibraryAsText(library: Library): string {
  const lines = [
    `- Title: ${library.name}`,
    `- Context7-compatible library ID: ${library.id}`,
    `- Description: ${library.description}`,
  ];

  if (library.totalSnippets > 0) {
    lines.push(`- Code Snippets: ${library.totalSnippets}`);
  }

  lines.push(`- Trust Score: ${getTrustScoreLabel(library.trustScore)}`);

  if (library.benchmarkScore > 0) {
    lines.push(`- Benchmark Score: ${library.benchmarkScore}`);
  }

  if (library.versions && library.versions.length > 0) {
    lines.push(`- Versions: ${library.versions.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Formats an array of libraries as human-readable text.
 */
export function formatLibrariesAsText(libraries: Library[]): string {
  if (libraries.length === 0) {
    return "No documentation libraries found matching your query.";
  }

  return libraries.map(formatLibraryAsText).join("\n----------\n");
}

```

### Core Architecture Module: `mcp_servers/dropbox/src/utils/context.ts`
```
import { AsyncLocalStorage } from 'async_hooks';
import { Dropbox } from 'dropbox';

// Create AsyncLocalStorage for request context
export const asyncLocalStorage = new AsyncLocalStorage<{
    dropboxClient: Dropbox | null;
}>();

// Helper function to get Dropbox client from context
export function getDropboxClient() {
    const client = asyncLocalStorage.getStore()?.dropboxClient;
    if (!client) {
        throw new Error('Access token is missing. Provide it via x-auth-token header or set DROPBOX_ACCESS_TOKEN in the environment.');
    }
    return client;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #696** (2025-11-17): **[BUG] Attio MCP is missing write permissions for "Tasks" object**
  *Symptoms*: Unable to create tasks with the Klavis / Strata Attio MCP because the integration with Attio doesn't have the correct permissions. We need write permissions but currently only have read.  <img width="848" height="936" alt="Image" src="https://github.com/user-attachments/assets/4a9b1eb4-2e47-492f-a6aa-fe7f60cb1996" />
  **Post-Mortem & Fix Analysis**:
  > Thanks! Just changed that:  <img width="813" height="547" alt="Image" src="https://github.com/user-attachments/assets/288fde40-adc4-43da-b594-9cffb2211f46" />  Please give it another try.

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

### Incident Patch 1: `669e95dc` (2026-05-09)
**Commit Message**: bug fix (#1629)

**File**: `mcp_servers/hugging_face/packages/mcp/src/duplicate-space.ts` (modified, +1/-0)
```diff
@@ -207,6 +207,7 @@ export class DuplicateSpaceTool extends HfApiCall<DuplicateSpaceParams, Duplicat
 
 			const response = await this.fetchFromApi<{ url: string }>(url, {
 				method: 'POST',
+				headers: { 'Content-Type': 'application/json' },
 				body: JSON.stringify(payload),
 			});
 
```

**File**: `mcp_servers/snowflake_toolathlon/src/mcp_snowflake_server/server.py` (modified, +1/-1)
```diff
@@ -375,7 +375,7 @@ async def handle_read_query(arguments, db, write_detector, *_, exclude_json_resu
     return results
 
 
-async def handle_append_insight(arguments, db, _, __, server, exclude_json_results=False):
+async def handle_append_insight(arguments, db, _, __, server, exclude_json_results=False, allowed_databases=None, **___):
     if not arguments or "insight" not in arguments:
         raise ValueError("Missing insight argument")
 
```

---

### Incident Patch 2: `8ab6b168` (2026-04-30)
**Commit Message**: increase timeout (#1577)

**File**: `mcp_servers/notion_mcpmark/src/openapi-mcp-server/client/http-client.ts` (modified, +3/-1)
```diff
@@ -42,7 +42,9 @@ export class HttpClient {
         // Without this, a half-open TCP connection to Notion's API hangs the
         // handler until Cloud Run's 300s request limit kills it with 504,
         // which closes the client's MCP stream and surfaces as ClosedResourceError.
-        timeout: 60_000,
+        // 90s covers slow Notion writes (delete-a-block, post-page,
+        // patch-block-children) while staying well under Cloud Run's 300s deadline.
+        timeout: 90_000,
         headers: {
           'Content-Type': 'application/json',
           'User-Agent': 'notion-mcp-server',
```

---

### Incident Patch 3: `9ab50702` (2026-04-23)
**Commit Message**: notion_mcpmark: wrap upstream timeouts as HttpClientError (#1573)

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `mcp_servers/notion_mcpmark/src/openapi-mcp-server/client/http-client.ts` (modified, +11/-0)
```diff
@@ -193,6 +193,17 @@ export class HttpClient {
 
         throw new HttpClientError(error.response.statusText || 'Request failed', error.response.status, error.response.data, headers)
       }
+      // No response (timeout, DNS, socket hangup) — wrap so proxy.ts can return
+      // a structured tool-result error instead of bubbling as a protocol-level
+      // McpError. Keeps the CallToolResult schema consistent for the agent.
+      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
+        console.error('Error in http client (no response)', error.code, error.message)
+        throw new HttpClientError(
+          error.message || 'Upstream request failed',
+          504,
+          { code: error.code, message: error.message },
+        )
+      }
       throw error
     }
   }
```

---

### Incident Patch 4: `c5574067` (2026-04-23)
**Commit Message**: notion_mcpmark: cap Notion upstream + request timeouts (#1572)

Co-authored-by: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `mcp_servers/notion_mcpmark/scripts/start-server.ts` (modified, +4/-0)
```diff
@@ -180,6 +180,10 @@ Examples:
 
     // Handle POST requests for client-to-server communication (stateless per-request model)
     app.post('/mcp', async (req, res) => {
+      // Belt-and-braces in case the upstream axios timeout is bypassed: cap each
+      // request well under Cloud Run's 300s so a hang terminates with a normal
+      // 5xx instead of tearing down the client's MCP stream.
+      req.setTimeout(90_000)
       // Extract Notion token from request header
       const notionToken = extractNotionToken(req)
 
```

**File**: `mcp_servers/notion_mcpmark/src/openapi-mcp-server/client/http-client.ts` (modified, +4/-0)
```diff
@@ -39,6 +39,10 @@ export class HttpClient {
       definition: openApiSpec,
       axiosConfigDefaults: {
         baseURL: config.baseUrl,
+        // Without this, a half-open TCP connection to Notion's API hangs the
+        // handler until Cloud Run's 300s request limit kills it with 504,
+        // which closes the client's MCP stream and surfaces as ClosedResourceError.
+        timeout: 60_000,
         headers: {
           'Content-Type': 'application/json',
           'User-Agent': 'notion-mcp-server',
```

---

### Incident Patch 5: `2fc4b0b5` (2026-04-06)
**Commit Message**: Fix slack server logging problem (#1471)

**File**: `mcp_servers/slack_atlas/pkg/server/server.go` (modified, +0/-1)
```diff
@@ -28,7 +28,6 @@ func NewMCPServer(p *provider.ApiProvider, logger *zap.Logger) *MCPServer {
 	s := server.NewMCPServer(
 		"Slack MCP Server",
 		version.Version,
-		server.WithLogging(),
 		server.WithRecovery(),
 		server.WithToolHandlerMiddleware(buildLoggerMiddleware(logger)),
 		server.WithToolHandlerMiddleware(auth.BuildMiddleware(p.ServerTransport(), logger)),
```

---

### Incident Patch 6: `340b6cfc` (2026-03-26)
**Commit Message**: fix proxy again. (#1415)

**File**: `mcp_servers/scholarly_toolathlon/src/mcp_scholarly/google_scholar.py` (modified, +10/-10)
```diff
@@ -1,31 +1,31 @@
 import os
 from typing import List, Optional
 
-from scholarly import scholarly, ProxyGenerator
+from scholarly import scholarly
 
 MAX_RESULTS = 10
 
 
-def _get_proxy_url() -> Optional[str]:
-    """Build proxy URL from environment variables (same as duckduckgo server)."""
+def _setup_proxy() -> None:
+    """Set HTTP_PROXY/HTTPS_PROXY env vars so scholarly (httpx) uses the proxy."""
     username = os.environ.get("PROXY_USERNAME")
     password = os.environ.get("PROXY_PASSWORD")
     if not (username and password):
-        return None
+        return
     host = os.environ.get("PROXY_HOST", "p.webshare.io")
     scheme = os.environ.get("PROXY_SCHEME", "http")
     port = os.environ.get("PROXY_PORT", "1080" if "socks" in scheme else "80")
-    return f"{scheme}://{username}:{password}@{host}:{port}"
+    proxy = f"{scheme}://{username}:{password}@{host}:{port}"
+    os.environ.setdefault("HTTP_PROXY", proxy)
+    os.environ.setdefault("HTTPS_PROXY", proxy)
+
+
+_setup_proxy()
 
 
 class GoogleScholar:
     def __init__(self):
         self.scholarly = scholarly
-        proxy = _get_proxy_url()
-        if proxy:
-            pg = ProxyGenerator()
-            pg.SingleProxy(http=proxy, https=proxy)
-            self.scholarly.use_proxy(pg)
 
     def get_scholarly(self, keyword):
         return self.scholarly.search_pubs(keyword)
```

---

### Incident Patch 7: `eeabcfc7` (2026-03-26)
**Commit Message**: fix proxy. (#1414)

**File**: `mcp_servers/scholarly_toolathlon/src/mcp_scholarly/google_scholar.py` (modified, +4/-2)
```diff
@@ -1,7 +1,7 @@
 import os
 from typing import List, Optional
 
-from scholarly import scholarly
+from scholarly import scholarly, ProxyGenerator
 
 MAX_RESULTS = 10
 
@@ -23,7 +23,9 @@ def __init__(self):
         self.scholarly = scholarly
         proxy = _get_proxy_url()
         if proxy:
-            self.scholarly.use_proxy(http=proxy, https=proxy)
+            pg = ProxyGenerator()
+            pg.SingleProxy(http=proxy, https=proxy)
+            self.scholarly.use_proxy(pg)
 
     def get_scholarly(self, keyword):
         return self.scholarly.search_pubs(keyword)
```

---

### Incident Patch 8: `8d3a6061` (2026-03-21)
**Commit Message**: handle OOM and css issues. (#1398)

**File**: `mcp_servers/fetch_toolathlon/Dockerfile` (modified, +3/-0)
```diff
@@ -32,5 +32,8 @@ RUN npm ci --omit=dev --ignore-scripts
 
 EXPOSE 8000
 
+# Set Node.js heap limit (container has 8GiB; leave headroom for OS/buffers)
+ENV NODE_OPTIONS="--max-old-space-size=4096"
+
 # Specify the command to run the application
 ENTRYPOINT ["node", "dist/index.js"]
```

**File**: `mcp_servers/fetch_toolathlon/src/Fetcher.ts` (modified, +72/-10)
```diff
@@ -1,7 +1,10 @@
-import { JSDOM } from "jsdom";
+import { JSDOM, VirtualConsole } from "jsdom";
 import TurndownService from "turndown";
 import { RequestPayload } from "./types.js";
 
+// Max response body size: 5MB to prevent OOM on huge pages
+const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
+
 export class Fetcher {
   private static async _fetch({
     url,
@@ -29,10 +32,64 @@ export class Fetcher {
     }
   }
 
+  /**
+   * Read response body as text with a size limit to prevent OOM.
+   */
+  private static async _readText(response: Response): Promise<string> {
+    const contentLength = response.headers.get("content-length");
+    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
+      throw new Error(
+        `Response too large (${contentLength} bytes). Max allowed: ${MAX_RESPONSE_SIZE} bytes.`
+      );
+    }
+
+    const reader = response.body?.getReader();
+    if (!reader) {
+      return await response.text();
+    }
+
+    const chunks: Uint8Array[] = [];
+    let totalSize = 0;
+    const decoder = new TextDecoder();
+
+    while (true) {
+      const { done, value } = await reader.read();
+      if (done) break;
+      totalSize += value.byteLength;
+      if (totalSize > MAX_RESPONSE_SIZE) {
+        reader.cancel();
+        throw new Error(
+          `Response too large (>${MAX_RESPONSE_SIZE} bytes). Truncated to prevent out-of-memory.`
+        );
+      }
+      chunks.push(value);
+    }
+
+    return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") +
+      decoder.decode();
+  }
+
+  /**
+   * Create a JSDOM instance with a virtual console that suppresses CSS parse errors.
+   */
+  private static _createDOM(html: string): JSDOM {
+    const virtualConsole = new VirtualConsole();
+    // Swallow all jsdom internal errors (CSS parse errors, etc.)
+    virtualConsole.on("error", () => {});
+    virtualConsole.on("warn", () => {});
+    virtualConsole.on("info", () => {});
+    virtualConsole.on("dir", () => {});
+
+    // Strip <style> tags before parsing to avoid CSS parse errors and reduce memory
+    const strippedHtml = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
+
+    return new JSDOM(strippedHtml, { virtualConsole });
+  }
+
   static async html(requestPayload: RequestPayload) {
     try {
       const response = await this._fetch(requestPayload);
-      const html = await response.text();
+      const html = await this._readText(response);
       return { content: [{ type: "text" as const, text: html }], isError: false };
     } catch (error) {
       return {
@@ -45,7 +102,8 @@ export class Fetcher {
   static async json(requestPayload: RequestPayload) {
     try {
       const response = await this._fetch(requestPayload);
-      const json = await response.json();
+      const text = await this._readText(response);
+      const json = JSON.parse(text);
       return {
         content: [{ type: "text" as const, text: JSON.stringify(json) }],
         isError: false,
@@ -61,20 +119,20 @@ export class Fetcher {
   static async txt(requestPayload: RequestPayload) {
     try {
       const response = await this._fetch(requestPayload);
-      const html = await response.text();
+      const html = await this._readText(response);
 
-      const dom = new JSDOM(html);
+      const dom = this._createDOM(html);
       const document = dom.window.document;
 
       const scripts = document.getElementsByTagName("script");
-      const styles = document.getElementsByTagName("style");
       Array.from(scripts).forEach((script) => script.remove());
-      Array.from(styles).forEach((style) => style.remove());
 
       const text = document.body.textContent || "";
-
       const normalizedText = text.replace(/\s+/g, " ").trim();
 
+      // Close the JSDOM window to free memory
+      dom.window.close();
+
       return {
         content: [{ type: "text" as const, text: normalizedText }],
         isError: false,
@@ -90,9 +148,13 @@ export class Fetcher {
   static async markdown(requestPayload: RequestPayload) {
     try {
       const response = await this._fetch(requestPayload);
-      const html = await response.text();
+      const html = await this._readText(response);
+
+      // Strip <style> tags before conversion to avoid CSS parse errors in turndown
+      const strippedHtml = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
+
       const turndownService = new TurndownService();
-      const markdown = turndownService.turndown(html);
+      const markdown = turndownService.turndown(strippedHtml);
       return { content: [{ type: "text" as const, text: markdown }], isError: false };
     } catch (error) {
       return {
```

---

### Incident Patch 9: `304b0717` (2026-03-14)
**Commit Message**: Fix package version for youtube mcp (#1374)

**File**: `mcp_servers/youtube_toolathlon/package.json` (modified, +5/-5)
```diff
@@ -22,15 +22,15 @@
     "@modelcontextprotocol/sdk": "^1.1.1",
     "express": "^4.18.0",
     "googleapis": "^129.0.0",
-    "ytdl-core": "^4.11.5",
-    "youtube-transcript": "^1.0.6"
+    "youtube-transcript": "1.0.6",
+    "ytdl-core": "^4.11.5"
   },
   "devDependencies": {
     "@types/express": "^4.17.0",
     "@types/node": "^18.0.0",
-    "typescript": "^5.0.0",
+    "nodemon": "^3.0.0",
     "ts-node": "^10.9.1",
-    "nodemon": "^3.0.0"
+    "typescript": "^5.0.0"
   },
   "keywords": [
     "youtube",
@@ -50,4 +50,4 @@
     "url": "https://github.com/ZubeidHendricks/youtube-mcp-server/issues"
   },
   "homepage": "https://github.com/ZubeidHendricks/youtube-mcp-server#readme"
-}
\ No newline at end of file
+}
```

---

### Incident Patch 10: `eab2becb` (2026-03-10)
**Commit Message**: fix docker. (#1339)

**File**: `mcp_servers/arxiv_latex/Dockerfile` (modified, +2/-2)
```diff
@@ -19,13 +19,13 @@ RUN curl -LsSf https://astral.sh/uv/install.sh | sh
 
 ENV PATH="/root/.local/bin:${PATH}"
 
-COPY mcp_servers/arxiv-latex-mcp/.python-version .
+COPY mcp_servers/arxiv_latex/.python-version .
 
 RUN uv venv
 
 FROM base AS builder
 
-COPY mcp_servers/arxiv-latex-mcp/ .
+COPY mcp_servers/arxiv_latex/ .
 
 RUN uv sync
 
```

---

### Incident Patch 11: `a1efdeaf` (2026-03-09)
**Commit Message**: fix OOM for notion-toolathlon. (#1332)

**File**: `mcp_servers/notion_toolathlon/scripts/start-server.ts` (modified, +5/-1)
```diff
@@ -5,7 +5,7 @@ import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/
 import { randomBytes } from 'node:crypto'
 import express from 'express'
 
-import { initProxy, ValidationError } from '../src/init-server.js'
+import { initProxy, preloadSpec, ValidationError } from '../src/init-server.js'
 
 /**
  * Extract Notion token from request header.
@@ -134,6 +134,10 @@ Examples:
     await proxy.connect(new StdioServerTransport())
     return proxy.getServer()
   } else if (transport === 'http') {
+    // Pre-load and pre-compute the OpenAPI spec and tools once at startup
+    // to avoid re-parsing on every request (major memory optimization)
+    await preloadSpec(specPath, baseUrl)
+
     // Use Streamable HTTP transport
     const app = express()
     app.use(express.json())
```

**File**: `mcp_servers/notion_toolathlon/src/init-server.ts` (modified, +16/-4)
```diff
@@ -4,7 +4,7 @@ import path from 'node:path'
 import { OpenAPIV3 } from 'openapi-types'
 import OpenAPISchemaValidator from 'openapi-schema-validator'
 
-import { MCPProxy } from './openapi-mcp-server/mcp/proxy.js'
+import { MCPProxy, precomputeTools, type PrecomputedTools } from './openapi-mcp-server/mcp/proxy.js'
 
 export class ValidationError extends Error {
   constructor(public errors: any[]) {
@@ -42,9 +42,21 @@ async function loadOpenApiSpec(specPath: string, baseUrl: string | undefined): P
   }
 }
 
-export async function initProxy(specPath: string, baseUrl: string | undefined, options: { pageIds?: string[]; pageUrls?: string[]; notionToken?: string } = {}) {
-  const openApiSpec = await loadOpenApiSpec(specPath, baseUrl)
-  const proxy = new MCPProxy('Notion API', openApiSpec, options)
+let cachedSpec: OpenAPIV3.Document | null = null
+let cachedPrecomputed: PrecomputedTools | null = null
+
+/**
+ * Pre-load the OpenAPI spec and precompute tools once at startup.
+ * This avoids re-parsing and re-converting on every request.
+ */
+export async function preloadSpec(specPath: string, baseUrl: string | undefined): Promise<void> {
+  cachedSpec = await loadOpenApiSpec(specPath, baseUrl)
+  cachedPrecomputed = precomputeTools(cachedSpec)
+  console.log('OpenAPI spec and tools pre-computed successfully')
+}
 
+export async function initProxy(specPath: string, baseUrl: string | undefined, options: { pageIds?: string[]; pageUrls?: string[]; notionToken?: string } = {}) {
+  const openApiSpec = cachedSpec ?? await loadOpenApiSpec(specPath, baseUrl)
+  const proxy = new MCPProxy('Notion API', openApiSpec, options, cachedPrecomputed ?? undefined)
   return proxy
 }
```

**File**: `mcp_servers/notion_toolathlon/src/openapi-mcp-server/client/http-client.ts` (modified, +40/-18)
```diff
@@ -29,24 +29,44 @@ export class HttpClientError extends Error {
   }
 }
 
+/**
+ * Initialize the OpenAPI client from a spec. This is expensive (parses and
+ * validates the entire spec) so the result should be cached and reused.
+ */
+export function initApiClient(
+  baseUrl: string,
+  openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document,
+): Promise<AxiosInstance> {
+  // @ts-expect-error
+  const client = new (OpenAPIClientAxios.default ?? OpenAPIClientAxios)({
+    definition: openApiSpec,
+    axiosConfigDefaults: {
+      baseURL: baseUrl,
+      headers: {
+        'Content-Type': 'application/json',
+        'User-Agent': 'notion-mcp-server',
+      },
+    },
+  })
+  return client.init()
+}
+
 export class HttpClient {
   private api: Promise<AxiosInstance>
-  private client: OpenAPIClientAxios
-
-  constructor(config: HttpClientConfig, openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document) {
-    // @ts-expect-error
-    this.client = new (OpenAPIClientAxios.default ?? OpenAPIClientAxios)({
-      definition: openApiSpec,
-      axiosConfigDefaults: {
-        baseURL: config.baseUrl,
-        headers: {
-          'Content-Type': 'application/json',
-          'User-Agent': 'notion-mcp-server',
-          ...config.headers,
-        },
-      },
-    })
-    this.api = this.client.init()
+  private perRequestHeaders: Record<string, string>
+
+  /**
+   * Create an HttpClient. If a cachedApi is provided, reuses the already-initialized
+   * axios instance (avoids expensive re-parsing of the spec on every request).
+   */
+  constructor(config: HttpClientConfig, openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document, cachedApi?: Promise<AxiosInstance>) {
+    this.perRequestHeaders = config.headers || {}
+
+    if (cachedApi) {
+      this.api = cachedApi
+    } else {
+      this.api = initApiClient(config.baseUrl, openApiSpec)
+    }
   }
 
   private async prepareFileUpload(operation: OpenAPIV3.OperationObject, params: Record<string, any>): Promise<FormData | null> {
@@ -152,12 +172,14 @@ export class HttpClient {
     try {
       // If we have form data, we need to set the correct headers
       const hasBody = Object.keys(bodyParams).length > 0
-      const headers = formData
+      const contentHeaders = formData
         ? formData.getHeaders()
         : { ...(hasBody ? { 'Content-Type': 'application/json' } : { 'Content-Type': null }) }
       const requestConfig = {
         headers: {
-          ...headers,
+          ...contentHeaders,
+          // Inject per-request auth headers (e.g. per-user Notion token)
+          ...this.perRequestHeaders,
         },
       }
 
```

**File**: `mcp_servers/notion_toolathlon/src/openapi-mcp-server/mcp/proxy.ts` (modified, +42/-7)
```diff
@@ -2,7 +2,8 @@ import { Server } from '@modelcontextprotocol/sdk/server/index.js'
 import { CallToolRequestSchema, JSONRPCResponse, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js'
 import { JSONSchema7 as IJsonSchema } from 'json-schema'
 import { OpenAPIToMCPConverter } from '../openapi/parser.js'
-import { HttpClient, HttpClientError } from '../client/http-client.js'
+import { HttpClient, HttpClientError, initApiClient } from '../client/http-client.js'
+import type { AxiosInstance } from 'axios'
 import { OpenAPIV3 } from 'openapi-types'
 import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
 import { PageAccessController } from '../auth/page-access-control.js'
@@ -30,6 +31,34 @@ export interface MCPProxyOptions {
   notionToken?: string
 }
 
+/**
+ * Pre-computed tools, lookup, and cached API client from OpenAPI spec.
+ * These are expensive to compute and should be done once at startup.
+ */
+export interface PrecomputedTools {
+  tools: Record<string, NewToolDefinition>
+  openApiLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>
+  cachedApi: Promise<AxiosInstance>
+}
+
+/**
+ * Pre-compute tools and initialize the API client from an OpenAPI spec.
+ * Call once at startup to avoid expensive re-parsing on every request.
+ */
+export function precomputeTools(openApiSpec: OpenAPIV3.Document): PrecomputedTools {
+  const converter = new OpenAPIToMCPConverter(openApiSpec)
+  const { tools, openApiLookup } = converter.convertToMCPTools()
+
+  const baseUrl = openApiSpec.servers?.[0]?.url
+  if (!baseUrl) {
+    throw new Error('No base URL found in OpenAPI spec')
+  }
+
+  const cachedApi = initApiClient(baseUrl, openApiSpec)
+
+  return { tools, openApiLookup, cachedApi }
+}
+
 // import this class, extend and return server
 export class MCPProxy {
   private server: Server
@@ -38,7 +67,7 @@ export class MCPProxy {
   private openApiLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>
   private pageAccessController: PageAccessController | null = null
 
-  constructor(name: string, openApiSpec: OpenAPIV3.Document, options: MCPProxyOptions = {}) {
+  constructor(name: string, openApiSpec: OpenAPIV3.Document, options: MCPProxyOptions = {}, precomputed?: PrecomputedTools) {
     this.server = new Server({ name, version: '1.0.0' }, { capabilities: { tools: {} } })
     const baseUrl = openApiSpec.servers?.[0].url
     if (!baseUrl) {
@@ -50,6 +79,7 @@ export class MCPProxy {
         headers: this.parseHeadersFromEnv(options.notionToken),
       },
       openApiSpec,
+      precomputed?.cachedApi,
     )
 
     // Initialize page access control if needed
@@ -61,11 +91,16 @@ export class MCPProxy {
       })
     }
 
-    // Convert OpenAPI spec to MCP tools
-    const converter = new OpenAPIToMCPConverter(openApiSpec)
-    const { tools, openApiLookup } = converter.convertToMCPTools()
-    this.tools = tools
-    this.openApiLookup = openApiLookup
+    // Use pre-computed tools if available, otherwise compute them
+    if (precomputed) {
+      this.tools = precomputed.tools
+      this.openApiLookup = precomputed.openApiLookup
+    } else {
+      const converter = new OpenAPIToMCPConverter(openApiSpec)
+      const { tools, openApiLookup } = converter.convertToMCPTools()
+      this.tools = tools
+      this.openApiLookup = openApiLookup
+    }
 
     this.setupHandlers()
   }
```

**File**: `mcp_servers/notion_toolathlon/src/openapi-mcp-server/openapi/parser.ts` (modified, +5/-0)
```diff
@@ -20,6 +20,7 @@ type FunctionParameters = {
 export class OpenAPIToMCPConverter {
   private schemaCache: Record<string, IJsonSchema> = {}
   private nameCounter: number = 0
+  private componentSchemaCache: Record<string, IJsonSchema> | null = null
 
   constructor(private openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document) {}
 
@@ -250,11 +251,15 @@ export class OpenAPIToMCPConverter {
   }
 
   private convertComponentsToJsonSchema(): Record<string, IJsonSchema> {
+    if (this.componentSchemaCache) {
+      return this.componentSchemaCache
+    }
     const components = this.openApiSpec.components || {}
     const schema: Record<string, IJsonSchema> = {}
     for (const [key, value] of Object.entries(components.schemas || {})) {
       schema[key] = this.convertOpenApiSchemaToJsonSchema(value, new Set())
     }
+    this.componentSchemaCache = schema
     return schema
   }
   /**
```

---

### Incident Patch 12: `82baa0f2` (2026-03-05)
**Commit Message**: fix yahoo finance (#1326)

**File**: `mcp_servers/yahoo_finance/server.py` (modified, +27/-6)
```diff
@@ -621,13 +621,34 @@ async def get_recommendations(ticker: str, recommendation_type: str, months_back
 
 
 if __name__ == "__main__":
+    import contextlib
     import uvicorn
+    from collections.abc import AsyncIterator
+    from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
+    from starlette.applications import Starlette
+    from starlette.routing import Mount
+    from starlette.types import Receive, Scope, Send
 
     print("Starting Yahoo Finance MCP server...")
-    uvicorn.run(
-        yfinance_server.streamable_http_app(),
-        host="0.0.0.0",
-        port=5000,
-        proxy_headers=True,
-        forwarded_allow_ips="*",
+
+    session_manager = StreamableHTTPSessionManager(
+        app=yfinance_server._mcp_server,
+        event_store=None,
+        json_response=False,
+        stateless=True,
+    )
+
+    async def handle_streamable_http(scope: Scope, receive: Receive, send: Send) -> None:
+        await session_manager.handle_request(scope, receive, send)
+
+    @contextlib.asynccontextmanager
+    async def lifespan(app: Starlette) -> AsyncIterator[None]:
+        async with session_manager.run():
+            yield
+
+    starlette_app = Starlette(
+        routes=[Mount("/mcp", app=handle_streamable_http)],
+        lifespan=lifespan,
     )
+
+    uvicorn.run(starlette_app, host="0.0.0.0", port=5000)
```

---

### Incident Patch 13: `f422f244` (2026-03-05)
**Commit Message**: fix yahoo finance (#1325)

**File**: `mcp_servers/yahoo_finance/server.py` (modified, +9/-4)
```diff
@@ -33,8 +33,6 @@ class RecommendationType(str, Enum):
 # Initialize FastMCP server
 yfinance_server = FastMCP(
     "yfinance",
-    host="0.0.0.0",
-    port=5000,
     instructions="""
 # Yahoo Finance MCP Server
 
@@ -623,6 +621,13 @@ async def get_recommendations(ticker: str, recommendation_type: str, months_back
 
 
 if __name__ == "__main__":
-    # Initialize and run the server
+    import uvicorn
+
     print("Starting Yahoo Finance MCP server...")
-    yfinance_server.run(transport="streamable-http")
+    uvicorn.run(
+        yfinance_server.streamable_http_app(),
+        host="0.0.0.0",
+        port=5000,
+        proxy_headers=True,
+        forwarded_allow_ips="*",
+    )
```

---

### Incident Patch 14: `57481e62` (2026-03-05)
**Commit Message**: Fix routing (#1323)

**File**: `mcp_servers/howtocook/src/index.ts` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ async function main() {
         // 为每个请求创建新的服务器实例
         const requestServer = createServerInstance();
 
-        if (url === "/mcp") {
+        if (url === "/mcp" || url === "/mcp/") {
           const transport = new StreamableHTTPServerTransport({
             sessionIdGenerator: undefined,
           });
```

---

### Incident Patch 15: `68d4d559` (2026-03-05)
**Commit Message**: fix routing (#1320)

**File**: `mcp_servers/github_mcpmark/internal/ghmcp/server.go` (modified, +13/-3)
```diff
@@ -484,27 +484,37 @@ func RunHTTPServer(cfg HTTPServerConfig) error {
 
 	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
 
-	// Let Start() manage its own mux (routes POST/GET/DELETE to /mcp).
+	mux := http.NewServeMux()
+	httpSrv := &http.Server{
+		Addr:    addr,
+		Handler: mux,
+	}
+
 	streamableServer := server.NewStreamableHTTPServer(ghServer,
 		server.WithStateLess(true),
 		server.WithHTTPContextFunc(contextFunc),
+		server.WithStreamableHTTPServer(httpSrv),
 	)
 
+	// Register both /mcp and /mcp/ so the cloud proxy trailing-slash variant works.
+	mux.Handle("/mcp", streamableServer)
+	mux.Handle("/mcp/", streamableServer)
+
 	// Graceful shutdown on signal.
 	go func() {
 		<-ctx.Done()
 		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
 		defer cancel()
 		logger.Info("shutting down HTTP server")
-		if err := streamableServer.Shutdown(shutdownCtx); err != nil {
+		if err := httpSrv.Shutdown(shutdownCtx); err != nil {
 			logger.Error("error during server shutdown", "error", err)
 		}
 	}()
 
 	_, _ = fmt.Fprintf(os.Stderr, "GitHub MCP Server running on HTTP (streamable) at %s/mcp\n", addr)
 	logger.Info("HTTP server listening", "addr", addr)
 
-	if err := streamableServer.Start(addr); err != nil && err != http.ErrServerClosed {
+	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
 		return fmt.Errorf("HTTP server error: %w", err)
 	}
 
```

#### Recent Merged Pull Requests:
- **PR #1665** (2026-06-01): Update API specifications with fern api update (@zihaolin96)
- **PR #1662** (2026-05-26): Update API specifications with fern api update (@zihaolin96)
- **PR #1629** (2026-05-09): bug fix (@zihaolin96)
- **PR #1590** (closed): Bump axios from 1.9.0 to 1.16.0 in /mcp_servers/notion_toolathlon (@dependabot[bot])
- **PR #1585** (2026-05-07): add sandbox concept back. (@xiangkaiz)
- **PR #1584** (2026-05-07): update doc (@zihaolin96)
- **PR #1580** (closed): Fix CWE-863: allowed_databases bypass via unqualified SQL in Snowflake MCP server (@andesyteoss)
- **PR #1579** (closed): Sanitize error messages in Snowflake MCP server to prevent credential leakage (CWE-200) (@andesyteoss)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
