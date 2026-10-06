# Forensic Learning Record (Deep Inspection): modelcontextprotocol/servers

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-servers-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:36:05.725Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/servers`
- **Description**: Model Context Protocol Servers
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 91033 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/filesystem/path-utils.ts`
```
import path from "path";
import os from 'os';

/**
 * Converts WSL or Unix-style Windows paths to Windows format
 * @param p The path to convert
 * @returns Converted Windows path
 */
export function convertToWindowsPath(p: string): string {
  // Handle WSL paths (/mnt/c/...)
  // NEVER convert WSL paths - they are valid Linux paths that work with Node.js fs operations in WSL
  // Converting them to Windows format (C:\...) breaks fs operations inside WSL
  if (p.startsWith('/mnt/')) {
    return p; // Leave WSL paths unchanged
  }

  // Handle Unix-style Windows paths (/c/...)
  // Only convert when running on Windows
  if (p.match(/^\/[a-zA-Z]\//) && process.platform === 'win32') {
    const driveLetter = p.charAt(1).toUpperCase();
    const pathPart = p.slice(2).replace(/\//g, '\\');
    return `${driveLetter}:${pathPart}`;
  }

  // Handle standard Windows paths, ensuring backslashes
  if (p.match(/^[a-zA-Z]:/)) {
    return p.replace(/\//g, '\\');
  }

  // Leave non-Windows paths unchanged
  return p;
}

/**
 * Normalizes path by standardizing format while preserving OS-specific behavior
 * @param p The path to normalize
 * @returns Normalized path
 */
export function normalizePath(p: string): string {
  // Remove any surrounding quotes and whitespace
  p = p.trim().replace(/^["']|["']$/g, '');

  // Check if this is a Unix path that should not be converted
  // WSL paths (/mnt/) should ALWAYS be preserved as they work correctly in WSL with Node.js fs
  // Regular Unix paths should also be preserved
  const isUnixPath = p.startsWith('/') && (
    // Always preserve WSL paths (/mnt/c/, /mnt/d/, etc.)
    p.match(/^\/mnt\/[a-z]\//i) ||
    // On non-Windows platforms, treat all absolute paths as Unix paths
    (process.platform !== 'win32') ||
    // On Windows, preserve Unix paths that aren't Unix-style Windows paths (/c/, /d/, etc.)
    (process.platform === 'win32' && !p.match(/^\/[a-zA-Z]\//))
  );

  if (isUnixPath) {
    // For Unix paths, just normalize without converting to Windows format
    // Replace double slashes with single slashes and remove trailing slashes
    return p.replace(/\/+/g, '/').replace(/(?<!^)\/$/, '');
  }

  // Convert Unix-style Windows paths (/c/, /d/) to Windows format if on Windows
  // This function will now leave /mnt/ paths unchanged
  p = convertToWindowsPath(p);

  // Handle double backslashes, preserving leading UNC \\
  if (p.startsWith('\\\\')) {
    // For UNC paths, first normalize any excessive leading backslashes to exactly \\
    // Then normalize double backslashes in the rest of the path
    let uncPath = p;
    // Replace multiple leading backslashes with exactly two
    uncPath = uncPath.replace(/^\\{2,}/, '\\\\');
    // Now normalize any remaining double backslashes in the rest of the path
    const restOfPath = uncPath.substring(2).replace(/\\\\/g, '\\');
    p = '\\\\' + restOfPath;
  } else {
    // For non-UNC paths, normalize all double backslashes
    p = p.replace(/\\\\/g, '\\');
  }

  // On Windows, if we have a bare drive letter (e.g. "C:"), append a separator
  // so path.normalize doesn't return "C:." which can break path validation.
  if (process.platform === 'win32' && /^[a-zA-Z]:$/.test(p)) {
    p = p + path.sep;
  }

  // Use Node's path normalization, which handles . and .. segments
  let normalized = path.normalize(p);

  // Fix UNC paths after normalization (path.normalize can remove a leading backslash)
  if (p.startsWith('\\\\') && !normalized.startsWith('\\\\')) {
    normalized = '\\' + normalized;
  }

  // Handle Windows paths: convert slashes and ensure drive letter is capitalized
  if (normalized.match(/^[a-zA-Z]:/)) {
    let result = normalized.replace(/\//g, '\\');
    // Capitalize drive letter if present
    if (/^[a-z]:/.test(result)) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  }

  // On Windows, convert forward slashes to backslashes for relative paths
  // On Linux/Unix, preserve forward slashes
  if (process.platform === 'win32') {
    return normalized.replace(/\//g, '\\');
  }

  // On non-Windows platforms, keep the normalized path as-is
  return normalized;
}

/**
 * Expands home directory tildes in paths
 * @param filepath The path to expand
 * @returns Expanded path
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}


```

### Core Architecture Module: `src/filesystem/roots-utils.ts`
```
import { promises as fs, type Stats } from 'fs';
import path from 'path';
import os from 'os';
import { normalizePath } from './path-utils.js';
import type { Root } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from "url";

/**
 * Converts a root URI to a normalized directory path with basic security validation.
 * @param rootUri - File URI (file://...) or plain directory path
 * @returns Promise resolving to validated path or null if invalid
 */
async function parseRootUri(rootUri: string): Promise<string | null> {
  try {
    const rawPath = rootUri.startsWith('file://') ? fileURLToPath(rootUri) : rootUri;
    const expandedPath = rawPath.startsWith('~/') || rawPath === '~' 
      ? path.join(os.homedir(), rawPath.slice(1)) 
      : rawPath;
    const absolutePath = path.resolve(expandedPath);
    const resolvedPath = await fs.realpath(absolutePath);
    return normalizePath(resolvedPath);
  } catch {
    return null; // Path doesn't exist or other error
  }
}

/**
 * Formats error message for directory validation failures.
 * @param dir - Directory path that failed validation
 * @param error - Error that occurred during validation
 * @param reason - Specific reason for failure
 * @returns Formatted error message
 */
function formatDirectoryError(dir: string, error?: unknown, reason?: string): string {
  if (reason) {
    return `Skipping ${reason}: ${dir}`;
  }
  const message = error instanceof Error ? error.message : String(error);
  return `Skipping invalid directory: ${dir} due to error: ${message}`;
}

/**
 * Resolves requested root directories from MCP root specifications.
 * 
 * Converts root URI specifications (file:// URIs or plain paths) into normalized
 * directory paths, validating that each path exists and is a directory.
 * Includes symlink resolution for security.
 * 
 * @param requestedRoots - Array of root specifications with URI and optional name
 * @returns Promise resolving to array of validated directory paths
 */
export async function getValidRootDirectories(
  requestedRoots: readonly Root[]
): Promise<string[]> {
  const validatedDirectories: string[] = [];
  
  for (const requestedRoot of requestedRoots) {
    const resolvedPath = await parseRootUri(requestedRoot.uri);
    if (!resolvedPath) {
      console.error(formatDirectoryError(requestedRoot.uri, undefined, 'invalid path or inaccessible'));
      continue;
    }
    
    try {
      const stats: Stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        validatedDirectories.push(resolvedPath);
      } else {
        console.error(formatDirectoryError(resolvedPath, undefined, 'non-directory root'));
      }
    } catch (error) {
      console.error(formatDirectoryError(resolvedPath, error));
    }
  }
  
  return validatedDirectories;
}
```

### Core Architecture Module: `scripts/release.py`
```
#!/usr/bin/env uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "click>=8.1.8",
#     "tomlkit>=0.13.2"
# ]
# ///
import sys
import re
import click
from pathlib import Path
import json
import tomlkit
import datetime
import subprocess
from dataclasses import dataclass
from typing import Any, Iterator, NewType, Protocol


Version = NewType("Version", str)
GitHash = NewType("GitHash", str)


class GitHashParamType(click.ParamType):
    name = "git_hash"

    def convert(
        self, value: Any, param: click.Parameter | None, ctx: click.Context | None
    ) -> GitHash | None:
        if value is None:
            return None

        if not (8 <= len(value) <= 40):
            self.fail(f"Git hash must be between 8 and 40 characters, got {len(value)}")

        if not re.match(r"^[0-9a-fA-F]+$", value):
            self.fail("Git hash must contain only hex digits (0-9, a-f)")

        try:
            # Verify hash exists in repo
            subprocess.run(
                ["git", "rev-parse", "--verify", value], check=True, capture_output=True
            )
        except subprocess.CalledProcessError:
            self.fail(f"Git hash {value} not found in repository")

        return GitHash(value.lower())


GIT_HASH = GitHashParamType()


class Package(Protocol):
    path: Path

    def package_name(self) -> str: ...

    def update_version(self, version: Version) -> None: ...


@dataclass
class NpmPackage:
    path: Path

    def package_name(self) -> str:
        with open(self.path / "package.json", "r") as f:
            return json.load(f)["name"]

    def update_version(self, version: Version):
        with open(self.path / "package.json", "r+") as f:
            data = json.load(f)
            data["version"] = version
            f.seek(0)
            json.dump(data, f, indent=2)
            f.truncate()


@dataclass
class PyPiPackage:
    path: Path

    def package_name(self) -> str:
        with open(self.path / "pyproject.toml") as f:
            toml_data = tomlkit.parse(f.read())
            name = toml_data.get("project", {}).get("name")
            if not name:
                raise Exception("No name in pyproject.toml project section")
            return str(name)

    def update_version(self, version: Version):
        # Update version in pyproject.toml
        with open(self.path / "pyproject.toml") as f:
            data = tomlkit.parse(f.read())
            data["project"]["version"] = version

        with open(self.path / "pyproject.toml", "w") as f:
            f.write(tomlkit.dumps(data))

        # Regenerate uv.lock to match the updated pyproject.toml
        subprocess.run(["uv", "lock"], cwd=self.path, check=True)


def has_changes(path: Path, git_hash: GitHash) -> bool:
    """Check if any files changed between current state and git hash"""
    try:
        output = subprocess.run(
            ["git", "diff", "--name-only", git_hash, "--", "."],
            cwd=path,
            check=True,
            capture_output=True,
            text=True,
        )

        changed_files = [Path(f) for f in output.stdout.splitlines()]
        # .md counts as a change: READMEs ship inside the published package
        # (npm tarball / PyPI long_description)
        relevant_files = [f for f in changed_files if f.suffix in [".py", ".ts", ".md"]]
        return len(relevant_files) >= 1
    except subprocess.CalledProcessError:
        return False


def gen_version() -> Version:
    """Generate version based on current date"""
    now = datetime.datetime.now()
    return Version(f"{now.year}.{now.month}.{now.day}")


def find_changed_packages(directory: Path, git_hash: GitHash) -> Iterator[Package]:
    for path in directory.glob("*/package.json"):
        if has_changes(path.parent, git_hash):
            yield NpmPackage(path.parent)
    for path in directory.glob("*/pyproject.toml"):
        if has_changes(path.parent, git_hash):
            yield PyPiPackage(path.parent)


@click.group()
def cli():
    pass


@cli.command("update-packages")
@click.option(
    "--directory", type=click.Path(exists=True, path_type=Path), default=Path.cwd()
)
@click.argument("git_hash", type=GIT_HASH)
def update_packages(directory: Path, git_hash: GitHash) -> int:
    # Detect package type
    path = directory.resolve(strict=True)
    version = gen_version()

    for package in find_changed_packages(path, git_hash):
        name = package.package_name()
        package.update_version(version)

        click.echo(f"{name}@{version}")

    return 0


@cli.command("generate-notes")
@click.option(
    "--directory", type=click.Path(exists=True, path_type=Path), default=Path.cwd()
)
@click.argument("git_hash", type=GIT_HASH)
def generate_notes(directory: Path, git_hash: GitHash) -> int:
    # Detect package type
    path = directory.resolve(strict=True)
    version = gen_version()

    click.echo(f"# Release : v{version}")
    click.echo("")
    click.echo("## Updated packages")
    for package in find_changed_packages(path, git_hash):
        name = package.package_name()
        click.echo(f"- {name}@{version}")

    return 0


@cli.command("generate-version")
def generate_version() -> int:
    # Detect package type
    click.echo(gen_version())
    return 0


@cli.command("generate-matrix")
@click.option(
    "--directory", type=click.Path(exists=True, path_type=Path), default=Path.cwd()
)
@click.option("--npm", is_flag=True, default=False)
@click.option("--pypi", is_flag=True, default=False)
@click.argument("git_hash", type=GIT_HASH)
def generate_matrix(directory: Path, git_hash: GitHash, pypi: bool, npm: bool) -> int:
    # Detect package type
    path = directory.resolve(strict=True)
    version = gen_version()

    changes = []
    for package in find_changed_packages(path, git_hash):
        pkg = package.path.relative_to(path)
        if npm and isinstance(package, NpmPackage):
            changes.append(str(pkg))
        if pypi and isinstance(package, PyPiPackage):
            changes.append(str(pkg))

    click.echo(json.dumps(changes))
    return 0


if __name__ == "__main__":
    sys.exit(cli())

```

### Core Architecture Module: `src/everything/index.ts`
```
#!/usr/bin/env node

// Parse command line arguments first
const args = process.argv.slice(2);
const scriptName = args[0] || "stdio";

async function run() {
  try {
    // Dynamically import only the requested module to prevent all modules from initializing
    switch (scriptName) {
      case "stdio":
        // Import and run the default server
        await import("./transports/stdio.js");
        break;
      case "sse":
        // Import and run the SSE server
        await import("./transports/sse.js");
        break;
      case "streamableHttp":
        // Import and run the streamable HTTP server
        await import("./transports/streamableHttp.js");
        break;
      default:
        console.error(`-`.repeat(53));
        console.error(`  Everything Server Launcher`);
        console.error(`  Usage: node ./index.js [stdio|sse|streamableHttp]`);
        console.error(`  Default transport: stdio`);
        console.error(`-`.repeat(53));
        console.error(`Unknown transport: ${scriptName}`);
        console.log("Available transports:");
        console.log("- stdio");
        console.log("- sse");
        console.log("- streamableHttp");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error running script:", error);
    process.exit(1);
  }
}

await run();

```

### Core Architecture Module: `src/everything/prompts/args.ts`
```
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register a prompt with arguments
 * - Two arguments, one required and one optional
 * - Combines argument values in the returned prompt
 *
 * @param server
 */
export const registerArgumentsPrompt = (server: McpServer) => {
  // Prompt arguments
  const promptArgsSchema = {
    city: z.string().describe("Name of the city"),
    state: z.string().describe("Name of the state").optional(),
  };

  // Register the prompt
  server.registerPrompt(
    "args-prompt",
    {
      title: "Arguments Prompt",
      description: "A prompt with two arguments, one required and one optional",
      argsSchema: promptArgsSchema,
    },
    (args) => {
      const location = `${args?.city}${args?.state ? `, ${args?.state}` : ""}`;
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `What's weather in ${location}?`,
            },
          },
        ],
      };
    }
  );
};

```

### Core Architecture Module: `src/everything/prompts/completions.ts`
```
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";

/**
 * Register a prompt with completable arguments
 * - Two required arguments, both with completion handlers
 * - First argument value will be included in context for second argument
 * - Allows second argument to depend on the first argument value
 *
 * @param server
 */
export const registerPromptWithCompletions = (server: McpServer) => {
  // Prompt arguments
  const promptArgsSchema = {
    department: completable(
      z.string().describe("Choose the department."),
      (value) => {
        return ["Engineering", "Sales", "Marketing", "Support"].filter((d) =>
          d.startsWith(value)
        );
      }
    ),
    name: completable(
      z
        .string()
        .describe("Choose a team member to lead the selected department."),
      (value, context) => {
        const department = context?.arguments?.["department"];
        if (department === "Engineering") {
          return ["Alice", "Bob", "Charlie"].filter((n) => n.startsWith(value));
        } else if (department === "Sales") {
          return ["David", "Eve", "Frank"].filter((n) => n.startsWith(value));
        } else if (department === "Marketing") {
          return ["Grace", "Henry", "Iris"].filter((n) => n.startsWith(value));
        } else if (department === "Support") {
          return ["John", "Kim", "Lee"].filter((n) => n.startsWith(value));
        }
        return [];
      }
    ),
  };

  // Register the prompt
  server.registerPrompt(
    "completable-prompt",
    {
      title: "Team Management",
      description: "First argument choice narrows values for second argument.",
      argsSchema: promptArgsSchema,
    },
    ({ department, name }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please promote ${name} to the head of the ${department} team.`,
          },
        },
      ],
    })
  );
};

```

### Core Architecture Module: `src/everything/prompts/index.ts`
```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSimplePrompt } from "./simple.js";
import { registerArgumentsPrompt } from "./args.js";
import { registerPromptWithCompletions } from "./completions.js";
import { registerEmbeddedResourcePrompt } from "./resource.js";

/**
 * Register the prompts with the MCP server.
 *
 * @param server
 */
export const registerPrompts = (server: McpServer) => {
  registerSimplePrompt(server);
  registerArgumentsPrompt(server);
  registerPromptWithCompletions(server);
  registerEmbeddedResourcePrompt(server);
};

```

### Core Architecture Module: `src/everything/prompts/resource.ts`
```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  resourceTypeCompleter,
  resourceIdForPromptCompleter,
} from "../resources/templates.js";
import {
  textResource,
  textResourceUri,
  blobResourceUri,
  blobResource,
  RESOURCE_TYPE_BLOB,
  RESOURCE_TYPE_TEXT,
  RESOURCE_TYPES,
} from "../resources/templates.js";

/**
 * Register a prompt with an embedded resource reference
 * - Takes a resource type and id
 * - Returns the corresponding dynamically created resource
 *
 * @param server
 */
export const registerEmbeddedResourcePrompt = (server: McpServer) => {
  // Prompt arguments
  const promptArgsSchema = {
    resourceType: resourceTypeCompleter,
    resourceId: resourceIdForPromptCompleter,
  };

  // Register the prompt
  server.registerPrompt(
    "resource-prompt",
    {
      title: "Resource Prompt",
      description: "A prompt that includes an embedded resource reference",
      argsSchema: promptArgsSchema,
    },
    (args) => {
      // Validate resource type argument
      const resourceType = args.resourceType;
      if (
        !RESOURCE_TYPES.includes(
          resourceType as typeof RESOURCE_TYPE_TEXT | typeof RESOURCE_TYPE_BLOB
        )
      ) {
        throw new Error(
          `Invalid resourceType: ${args?.resourceType}. Must be ${RESOURCE_TYPE_TEXT} or ${RESOURCE_TYPE_BLOB}.`
        );
      }

      // Validate resourceId argument
      const resourceId = Number(args?.resourceId);
      if (
        !Number.isFinite(resourceId) ||
        !Number.isInteger(resourceId) ||
        resourceId < 1
      ) {
        throw new Error(
          `Invalid resourceId: ${args?.resourceId}. Must be a finite positive integer.`
        );
      }

      // Get resource based on the resource type
      const uri =
        resourceType === RESOURCE_TYPE_TEXT
          ? textResourceUri(resourceId)
          : blobResourceUri(resourceId);
      const resource =
        resourceType === RESOURCE_TYPE_TEXT
          ? textResource(uri, resourceId)
          : blobResource(uri, resourceId);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `This prompt includes the ${resourceType} resource with id: ${resourceId}. Please analyze the following resource:`,
            },
          },
          {
            role: "user",
            content: {
              type: "resource",
              resource: resource,
            },
          },
        ],
      };
    }
  );
};

```

### Core Architecture Module: `src/everything/prompts/simple.ts`
```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register a simple prompt with no arguments
 * - Returns the fixed text of the prompt with no modifications
 *
 * @param server
 */
export const registerSimplePrompt = (server: McpServer) => {
  // Register the prompt
  server.registerPrompt(
    "simple-prompt",
    {
      title: "Simple Prompt",
      description: "A prompt with no arguments",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "This is a simple prompt without arguments.",
          },
        },
      ],
    })
  );
};

```

### Core Architecture Module: `src/everything/resources/files.ts`
```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readdirSync, readFileSync, statSync } from "fs";

/**
 * Register static file resources
 * - Each file in src/everything/docs is exposed as an individual static resource
 * - URIs follow the pattern: "demo://static/docs/<filename>"
 * - Markdown (.md) files are served as mime type "text/markdown"
 * - Text (.txt) files are served as mime type "text/plain"
 * - JSON (.json) files are served as mime type "application/json"
 *
 * @param server
 */
export const registerFileResources = (server: McpServer) => {
  // Read the entries in the docs directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const docsDir = join(__dirname, "..", "docs");
  let entries: string[] = [];
  try {
    entries = readdirSync(docsDir);
  } catch (e) {
    // If docs/ folder is missing or unreadable, just skip registration
    return;
  }

  // Register each file as a static resource
  for (const name of entries) {
    // Only process files, not directories
    const fullPath = join(docsDir, name);
    try {
      const st = statSync(fullPath);
      if (!st.isFile()) continue;
    } catch {
      continue;
    }

    // Prepare file resource info
    const uri = `demo://resource/static/document/${encodeURIComponent(name)}`;
    const mimeType = getMimeType(name);
    const description = `Static document file exposed from /docs: ${name}`;

    // Register file resource
    server.registerResource(
      name,
      uri,
      { mimeType, description },
      async (uri) => {
        const text = readFileSafe(fullPath);
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType,
              text,
            },
          ],
        };
      }
    );
  }
};

/**
 * Get the mimetype based on filename
 * @param fileName
 */
function getMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown"))
    return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  return "text/plain";
}

/**
 * Read a file or return an error message if it fails
 * @param path
 */
function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (e) {
    return `Error reading file: ${path}. ${e}`;
  }
}

```

### Core Architecture Module: `src/everything/resources/index.ts`
```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResourceTemplates } from "./templates.js";
import { registerFileResources } from "./files.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

/**
 * Register the resources with the MCP server.
 * @param server
 */
export const registerResources = (server: McpServer) => {
  registerResourceTemplates(server);
  registerFileResources(server);
};

/**
 * Reads the server instructions from the corresponding markdown file.
 * Attempts to load the content of the file located in the `docs` directory.
 * If the file cannot be loaded, an error message is returned instead.
 *
 * @return {string} The content of the server instructions file, or an error message if reading fails.
 */
export function readInstructions(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const filePath = join(__dirname, "..", "docs", "instructions.md");
  let instructions;

  try {
    instructions = readFileSync(filePath, "utf-8");
  } catch (e) {
    instructions = "Server instructions not loaded: " + e;
  }
  return instructions;
}

```

### Core Architecture Module: `src/everything/resources/session.ts`
```
import { McpServer, RegisteredResource } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Resource, ResourceLink } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tracks registered session resources by URI to allow updating/removing on re-registration.
 * This prevents "Resource already registered" errors when a tool creates a resource
 * with the same URI multiple times during a session.
 */
const registeredResources = new Map<string, RegisteredResource>();

/**
 * Generates a session-scoped resource URI string based on the provided resource name.
 *
 * @param {string} name - The name of the resource to create a URI for.
 * @returns {string} The formatted session resource URI.
 */
export const getSessionResourceURI = (name: string): string => {
  return `demo://resource/session/${name}`;
};

/**
 * Registers a session-scoped resource with the provided server and returns a resource link.
 *
 * The registered resource is available during the life of the session only; it is not otherwise persisted.
 *
 * @param {McpServer} server - The server instance responsible for handling the resource registration.
 * @param {Resource} resource - The resource object containing metadata such as URI, name, description, and mimeType.
 * @param {"text"|"blob"} type
 * @param payload
 * @returns {ResourceLink} An object representing the resource link, with associated metadata.
 */
export const registerSessionResource = (
  server: McpServer,
  resource: Resource,
  type: "text" | "blob",
  payload: string
): ResourceLink => {
  // Destructure resource
  const { uri, name, mimeType, description, title, annotations, icons, _meta } =
    resource;

  // Prepare the resource content to return
  // See https://modelcontextprotocol.io/specification/2025-11-25/server/resources#resource-contents
  const resourceContent =
    type === "text"
      ? {
          uri: uri.toString(),
          mimeType,
          text: payload,
        }
      : {
          uri: uri.toString(),
          mimeType,
          blob: payload,
        };

  // Check if a resource with this URI is already registered and remove it
  const existingResource = registeredResources.get(uri);
  if (existingResource) {
    existingResource.remove();
    registeredResources.delete(uri);
  }

  // Register file resource
  const registeredResource = server.registerResource(
    name,
    uri,
    { mimeType, description, title, annotations, icons, _meta },
    async () => {
      return {
        contents: [resourceContent],
      };
    }
  );

  // Track the registered resource for potential future removal
  registeredResources.set(uri, registeredResource);

  return { type: "resource_link", ...resource };
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5050** (2026-10-05): **git: git_commit concluding a merge leaves a --autostash stash unapplied**
  *Symptoms*: ### Describe the bug  #5012's fix (in #5007) makes `git_commit` conclude an in-progress merge: it records `HEAD` plus every `MERGE_HEAD` commit as parents and removes `MERGE_HEAD`, `MERGE_MSG`, `MERGE_MODE` and `AUTO_MERGE`. It does not handle `MERGE_AUTOSTASH`. For a merge started with `git merge --no-commit --autostash` over a dirty tree, native `git commit` reapplies the autostash when it concludes the merge and deletes `MERGE_AUTOSTASH`. If reapplying conflicts, it stores the stash in the stash list instead. `git_commit` creates the merge commit, reports success, and leaves the user's pre-merge edits stashed with `MERGE_AUTOSTASH` still on disk.  Found by Copilot's round-3 review of #5007 (review comment 4180846700).  ### To Reproduce  ```sh git checkout main && echo dirty >> tracked.txt     # uncommitted edit git merge --no-commit --no-ff --autostash side # git_commit(repo, "merge side") cat tracked.txt                                    # the "dirty" edit is gone ls .git/MERGE_AUTOSTASH                            # still present ```  ### Expected behavior  Concluding the merge reapplies the autostash the way `git commit` does: apply it, or store it in the stash list on conflict, then remove `MERGE_AUTOSTASH`. The simplest route is probably to hand merge finalization to native `git commit` (`repo.git.commit("-m", message)`) while `MERGE_HEAD` is present. A test covers a dirty tree merged with `--autostash`.  ### Additional context  `src/git/src/mcp_server_git/server.py`,

- **Issue #5012** (2026-10-05): **git_commit during a merge records one parent and leaves MERGE_HEAD in place**
  *Symptoms*: ### Describe the bug  `git_commit` cannot conclude a merge. While a merge is in progress (`MERGE_HEAD` present, e.g. after `git merge --no-commit` or a resolved conflict), it writes a commit with **one** parent, `HEAD`, and leaves `MERGE_HEAD` (and `MERGE_MSG`) in place, so the repository stays in merge state and the merged branch's history is not recorded.  `src/git/src/mcp_server_git/server.py`, `git_commit` calls `repo.index.commit(message)`. GitPython's `IndexFile.commit()` takes `parent_commits=None`, which means `[repo.head.commit]` only; it neither reads nor clears `MERGE_HEAD`.  Found in the Copilot review of #5007 (the fix for #4762), which keeps the empty-merge-commit case committable but, like the code before it, records it with one parent. This predates #5007: any merge resolved through `git_commit` has always been recorded this way.  ### To Reproduce  ```python import git # repo on main with a branch `side` that adds side.txt repo.git.merge("side", "--no-commit", "--no-ff") commit = repo.index.commit("merge side")   # what git_commit does len(commit.parents)                        # 1, git commit would give 2 (Path(repo.git_dir) / "MERGE_HEAD").exists()  # True, merge still in progress ```  ### Expected behavior  While `MERGE_HEAD` is present, `git_commit` records `HEAD` plus every `MERGE_HEAD` commit as parents and clears the merge state, as `git commit` does (either by shelling out to `git commit`, or by passing `parent_commits` and removing `MERGE_HEAD`/`MERGE
  **Post-Mortem & Fix Analysis**:
  > Fixed by #5007, merged into `v2/main` (Wave 6 of #5004).

- **Issue #5003** (2026-10-05): **time: an empty source_timezone surfaces zoneinfo's raw error**
  *Symptoms*: ## Problem  `get_current_time` with an empty `timezone` returns the server's own "Missing required argument" error, but `convert_time` with an empty `source_timezone` passes zoneinfo's raw exception text to the client.  ## Where it is pinned  `src/time/tests/test_protocol.py`: `test_convert_time_argument_errors` (the empty `source_timezone` case), added in #4972 (Wave 1 of #4857). Each of these tests carries a `KNOWN BUG` marker: it asserts the current, wrong behavior, so the fix has to change it.  ## Expected  Both tools report an empty timezone argument with the same clear error.  ## Done when  - The behavior above is fixed, in the legacy-era (2025-11-25) server on SDK 1.x. - The pinning tests assert the correct behavior, and their `KNOWN BUG` markers are gone. - The per-file 90% coverage gate still passes. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #5021, merged into `v2/main`.

- **Issue #5002** (2026-10-05): **time: convert_time accepts a nonexistent (spring-forward) local time without warning**
  *Symptoms*: ## Problem  `convert_time` converts a wall-clock time that does not exist in the source timezone (for example 02:30 on 2024-03-10 in America/New_York) as if it were valid, reporting `-05:00`, with nothing to tell the caller that the time never occurred.  ## Where it is pinned  `src/time/tests/test_protocol.py`: `test_convert_time_into_a_nonexistent_local_time`, added in #4972 (Wave 1 of #4857). Each of these tests carries a `KNOWN BUG` marker: it asserts the current, wrong behavior, so the fix has to change it.  ## Expected  A nonexistent local time is rejected with an error, or the result flags it.  ## Done when  - The behavior above is fixed, in the legacy-era (2025-11-25) server on SDK 1.x. - The pinning tests assert the correct behavior, and their `KNOWN BUG` markers are gone. - The per-file 90% coverage gate still passes. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #5028, merged into `v2/main`.

- **Issue #5001** (2026-10-05): **time: an invalid --local-timezone crashes the server with a traceback**
  *Symptoms*: ## Problem  An invalid `--local-timezone` value makes `serve()` raise before the stdio transport opens, so the process dies with a Python traceback.  ## Where it is pinned  `src/time/tests/test_protocol.py`: `test_invalid_local_timezone_fails_before_the_transport_opens`, added in #4972 (Wave 1 of #4857). Each of these tests carries a `KNOWN BUG` marker: it asserts the current, wrong behavior, so the fix has to change it.  ## Expected  A one-line error naming the invalid timezone, with a non-zero exit.  ## Done when  - The behavior above is fixed, in the legacy-era (2025-11-25) server on SDK 1.x. - The pinning tests assert the correct behavior, and their `KNOWN BUG` markers are gone. - The per-file 90% coverage gate still passes. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #5027, merged into `v2/main`.

- **Issue #5000** (2026-10-05): **sequentialthinking: thought log formatting prints "undefined" and draws the box too wide**
  *Symptoms*: ## Problem  The formatted thought log written to stderr has three defects:  - A revision with no `revisesThought` prints "revising thought undefined". - A `branchFromThought` with no `branchId` draws a Branch header reading "ID: undefined". - The border width counts the header's colour escape codes, so the box is drawn wider than its text.  ## Where it is pinned  `src/sequentialthinking/__tests__/thought-logging.test.ts`: "prints 'undefined' for a revision with no revisesThought", "draws a branch header even when no branch is recorded (no branchId)", "sizes the border from the coloured header, escape codes included", added in #4970 (Wave 1 of #4857). Each of these tests carries a `KNOWN BUG` marker: it asserts the current, wrong behavior, so the fix has to change it.  ## Expected  No "undefined" in headers, and the border is sized from the visible text.  ## Done when  - The behavior above is fixed, in the legacy-era (2025-11-25) server on SDK 1.x. - The pinning tests assert the correct behavior, and their `KNOWN BUG` markers are gone. - The per-file 90% coverage gate still passes. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #5031, merged to `v2/main` (Wave 4 of #5004). The combined wave was proven in rollup #5044, which had green CI.

- **Issue #4999** (2026-10-05): **git: flag-injection guard messages reach the client wrapped as "Ref ... did not resolve to an object"**
  *Symptoms*: ## Problem  The flag-injection guards raise `BadName`, so their own message reaches the client wrapped in GitPython's `Ref '<message>' did not resolve to an object`. The rejection works; the message is garbled.  ## Where it is pinned  `src/git/tests/test_protocol.py`: `test_git_diff_rejects_flag_injection`, `test_git_create_branch_rejects_flag_injection`, `test_git_checkout_rejects_flag_injection`, `test_git_show_rejects_flag_injection`, `test_git_branch_rejects_flag_injection`, added in #4974 (Wave 1 of #4857). Each of these tests carries a `KNOWN BUG` marker: it asserts the current, wrong behavior, so the fix has to change it.  ## Expected  The client sees the guard's message as written. Keep the rejection itself, which `test_server.py` guards.  ## Done when  - The behavior above is fixed, in the legacy-era (2025-11-25) server on SDK 1.x. - The pinning tests assert the correct behavior, and their `KNOWN BUG` markers are gone. - The per-file 90% coverage gate still passes. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #5038, merged into `v2/main` (Wave 6 of #5004).

- **Issue #4998** (2026-10-05): **git: git_show prints Python reprs instead of git's commit format**
  *Symptoms*: ## Problem  `git_show`'s header is built from Python objects, so it prints a quoted sha, a `<git.Actor …>` repr and a `datetime` repr that includes a memory address. For an added file it prints `--- None` where git prints `--- /dev/null`.  ## Where it is pinned  `src/git/tests/test_protocol.py`: `test_git_show_commit_with_parent`, `test_git_show_initial_commit_diffs_against_empty_tree`, `test_git_show_rename_only_commit_has_header_and_no_patch`, `test_git_show_binary_commit`, added in #4974 (Wave 1 of #4857). Each of these tests carries a `KNOWN BUG` marker: it asserts the current, wrong behavior, so the fix has to change it.  ## Expected  The header uses git's own format (sha, `Author: Name <email>`, an ISO date), and new or deleted files use `/dev/null`.  ## Done when  - The behavior above is fixed, in the legacy-era (2025-11-25) server on SDK 1.x. - The pinning tests assert the correct behavior, and their `KNOWN BUG` markers are gone. - The per-file 90% coverage gate still passes. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #5029, merged into `v2/main` (Wave 6 of #5004).

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

### Incident Patch 1: `a2077876` (2026-10-04)
**Commit Message**: chore: sync the bug report form with v2/main after #4965

Takes .github/ISSUE_TEMPLATE/1-bug_report.yml from v2/main, whose
Server version placeholder now shows both version schemes (#4964), so
this branch stays byte-identical to v2/main.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: cliffhall <[REDACTED_EMAIL]>

**File**: `.github/ISSUE_TEMPLATE/1-bug_report.yml` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ body:
       description: >
         The version you actually ran, not "latest". For an unreleased build,
         give the commit. For a repository-level report, write n/a.
-      placeholder: "0.6.3"
+      placeholder: "1.0.0 (npm) or 2026.8.1 (PyPI)"
     validations:
       required: true
 
```

---

### Incident Patch 2: `f46d9578` (2026-09-22)
**Commit Message**: fix(everything): clean up subscriptions on session disconnect (#4712)

Export removeSubscriber() to drop a session from all URI subscriber sets
when a transport session closes, and call it from cleanup() alongside
the existing interval and logging teardown.

Fixes #4710

Co-authored-by: arimu1 <[REDACTED_EMAIL]>

**File**: `src/everything/__tests__/resources.test.ts` (modified, +81/-0)
```diff
@@ -18,10 +18,14 @@ import {
   registerSessionResource,
 } from '../resources/session.js';
 import { registerFileResources } from '../resources/files.js';
+import {
+  SubscribeRequestSchema,
+} from '@modelcontextprotocol/sdk/types.js';
 import {
   setSubscriptionHandlers,
   beginSimulatedResourceUpdates,
   stopSimulatedResourceUpdates,
+  removeSubscriber,
 } from '../resources/subscriptions.js';
 
 describe('Resource Templates', () => {
@@ -298,10 +302,87 @@ describe('Subscriptions', () => {
     });
   });
 
+  describe('removeSubscriber', () => {
+    const testUri = 'demo://resource/dynamic/text/1';
+    const sessionId = 'disconnect-test-session';
+
+    let subscribeHandler: (
+      request: { params: { uri: string } },
+      extra: { sessionId: string }
+    ) => Promise<unknown>;
+
+    beforeEach(() => {
+      const handlers = new Map<unknown, typeof subscribeHandler>();
+      const mockServer = {
+        server: {
+          setRequestHandler: vi.fn((schema, handler) => {
+            handlers.set(schema, handler);
+          }),
+          notification: vi.fn(),
+        },
+        sendLoggingMessage: vi.fn(),
+      } as unknown as McpServer;
+
+      setSubscriptionHandlers(mockServer);
+      subscribeHandler = handlers.get(SubscribeRequestSchema)!;
+    });
+
+    afterEach(() => {
+      stopSimulatedResourceUpdates(sessionId);
+      removeSubscriber(sessionId);
+    });
+
+    it('should drop a disconnected session from all subscriptions', async () => {
+      const notification = vi.fn();
+      const mockServer = {
+        server: {
+          notification,
+        },
+      } as unknown as McpServer;
+
+      await subscribeHandler({ params: { uri: testUri } }, { sessionId });
+
+      beginSimulatedResourceUpdates(mockServer, sessionId);
+      expect(notification).toHaveBeenCalled();
+
+      notification.mockClear();
+      removeSubscriber(sessionId);
+      stopSimulatedResourceUpdates(sessionId);
+
+      beginSimulatedResourceUpdates(mockServer, sessionId);
+      expect(notification).not.toHaveBeenCalled();
+    });
+
+    it('should not affect other sessions subscribed to the same URI', async () => {
+      const otherSessionId = 'other-session';
+      const notification = vi.fn();
+      const mockServer = {
+        server: {
+          notification,
+        },
+      } as unknown as McpServer;
+
+      await subscribeHandler({ params: { uri: testUri } }, { sessionId });
+      await subscribeHandler(
+        { params: { uri: testUri } },
+        { sessionId: otherSessionId }
+      );
+
+      removeSubscriber(sessionId);
+
+      beginSimulatedResourceUpdates(mockServer, otherSessionId);
+      expect(notification).toHaveBeenCalled();
+
+      stopSimulatedResourceUpdates(otherSessionId);
+      removeSubscriber(otherSessionId);
+    });
+  });
+
   describe('simulated resource updates lifecycle', () => {
     afterEach(() => {
       // Clean up any intervals
       stopSimulatedResourceUpdates('lifecycle-test-session');
+      removeSubscriber('lifecycle-test-session');
     });
 
     it('should start and stop updates without errors', () => {
```

**File**: `src/everything/resources/subscriptions.ts` (modified, +19/-0)
```diff
@@ -166,3 +166,22 @@ export const stopSimulatedResourceUpdates = (sessionId?: string) => {
     subsUpdateIntervals.delete(sessionId);
   }
 };
+
+/**
+ * Removes a session from every URI's subscriber set, dropping any URI entry
+ * that ends up with no remaining subscribers.
+ *
+ * A session that disconnects without explicitly unsubscribing otherwise stays
+ * in `subscriptions` for the life of the process. Call this from the
+ * transport's `cleanup(sessionId)` when a session ends.
+ *
+ * @param {string} [sessionId]
+ */
+export const removeSubscriber = (sessionId?: string) => {
+  for (const [uri, subscribers] of subscriptions) {
+    subscribers.delete(sessionId);
+    if (subscribers.size === 0) {
+      subscriptions.delete(uri);
+    }
+  }
+};
```

**File**: `src/everything/server/index.ts` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ import {
 import {
   setSubscriptionHandlers,
   stopSimulatedResourceUpdates,
+  removeSubscriber,
 } from "../resources/subscriptions.js";
 import { registerConditionalTools, registerTools } from "../tools/index.js";
 import { registerResources, readInstructions } from "../resources/index.js";
@@ -110,6 +111,7 @@ export const createServer: () => ServerFactoryResponse = () => {
       // Stop any simulated logging or resource updates that may have been initiated.
       stopSimulatedLogging(sessionId);
       stopSimulatedResourceUpdates(sessionId);
+      removeSubscriber(sessionId);
       // Clean up task store timers
       taskStore.cleanup();
       if (initializeTimeout) clearTimeout(initializeTimeout);
```

---

### Incident Patch 3: `d73f99ef` (2026-09-03)
**Commit Message**: fix(memory): serialize graph mutations to prevent concurrent write race (#4555)

createEntities, createRelations, addObservations, deleteEntities,
deleteObservations, and deleteRelations each independently did
load -> mutate -> save with no synchronization. Concurrent tool
calls (e.g. multiple mutations dispatched from one LLM turn) could
race: both read the same starting state, both write back their own
copy, and whichever write landed last silently discarded the other's
changes. Interleaved writes could also corrupt the file outright.

Adds an in-process async mutex (KnowledgeGraphManager.withLock) that
serializes all six mutation methods through a single queue. Read-only
methods (readGraph, searchNodes, openNodes) are unaffected.

Verified: reverting the fix and re-running the new concurrency tests
reproduces the bug exactly (lost entities, lost relations, malformed
JSONL lines). With the fix, all 39 tests pass.

Fixes #1819

Co-authored-by: olaservo <[REDACTED_EMAIL]>

**File**: `src/memory/__tests__/knowledge-graph.test.ts` (modified, +75/-0)
```diff
@@ -696,4 +696,79 @@ describe('KnowledgeGraphManager', () => {
       expect(graph.entities.map(e => e.name)).toEqual(['Alice', 'Bob']);
     });
   });
+
+  describe('concurrent mutations', () => {
+    // Regression test for #1819: concurrent tool calls each independently
+    // load the graph, mutate their own copy, and write it back. Without
+    // serialization, whichever write lands last silently discards the
+    // other's changes. All mutations below are fired without awaiting each
+    // other first, simulating multiple tool calls landing close together.
+
+    it('should not lose entities created concurrently', async () => {
+      const batch1: Entity[] = Array.from({ length: 10 }, (_, i) => ({
+        name: `batch1-entity-${i}`,
+        entityType: 'test',
+        observations: [],
+      }));
+      const batch2: Entity[] = Array.from({ length: 10 }, (_, i) => ({
+        name: `batch2-entity-${i}`,
+        entityType: 'test',
+        observations: [],
+      }));
+
+      // Fire both concurrently instead of awaiting sequentially.
+      await Promise.all([
+        manager.createEntities(batch1),
+        manager.createEntities(batch2),
+      ]);
+
+      const graph = await manager.readGraph();
+      expect(graph.entities).toHaveLength(20);
+      expect(graph.entities.map(e => e.name).sort()).toEqual(
+        [...batch1, ...batch2].map(e => e.name).sort()
+      );
+    });
+
+    it('should not lose relations created concurrently with entity creation', async () => {
+      await manager.createEntities([
+        { name: 'Alice', entityType: 'person', observations: [] },
+        { name: 'Bob', entityType: 'person', observations: [] },
+        { name: 'Carol', entityType: 'person', observations: [] },
+      ]);
+
+      await Promise.all([
+        manager.createRelations([{ from: 'Alice', to: 'Bob', relationType: 'knows' }]),
+        manager.createRelations([{ from: 'Bob', to: 'Carol', relationType: 'knows' }]),
+        manager.addObservations([
+          { entityName: 'Alice', contents: ['likes coffee'] },
+        ]),
+      ]);
+
+      const graph = await manager.readGraph();
+      expect(graph.relations).toHaveLength(2);
+      expect(graph.entities.find(e => e.name === 'Alice')?.observations).toContain('likes coffee');
+    });
+
+    it('should keep the file valid JSONL after many concurrent mutations', async () => {
+      const operations = Array.from({ length: 25 }, (_, i) =>
+        manager.createEntities([
+          { name: `stress-entity-${i}`, entityType: 'test', observations: [] },
+        ])
+      );
+
+      await Promise.all(operations);
+
+      const raw = await fs.readFile(testFilePath, 'utf-8');
+      const lines = raw.split('\n').filter(line => line.trim() !== '');
+
+      // Every line must parse as valid JSON; a corrupted interleaved write
+      // would produce a truncated or malformed line here.
+      for (const line of lines) {
+        expect(() => JSON.parse(line)).not.toThrow();
+      }
+
+      const graph = await manager.readGraph();
+      expect(graph.entities).toHaveLength(25);
+    });
+  });
 });
```

**File**: `src/memory/index.ts` (modified, +105/-73)
```diff
@@ -86,6 +86,26 @@ export interface KnowledgeGraph {
 export class KnowledgeGraphManager {
   constructor(private memoryFilePath: string) {}
 
+  // Serializes all read-modify-write graph mutations behind a single queue.
+  // Without this, concurrent tool calls (e.g. multiple mutations dispatched
+  // from one LLM turn) each independently load the graph, mutate their own
+  // copy, and write it back — so whichever write lands last silently
+  // overwrites the other's changes, and interleaved writes to the same file
+  // can corrupt it outright. See #1819.
+  private mutationQueue: Promise<unknown> = Promise.resolve();
+
+  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
+    const result = this.mutationQueue.then(operation, operation);
+    // Always resolve the queue itself, even if this operation failed, so a
+    // single failed mutation doesn't permanently wedge every call after it.
+    // The failure still propagates normally to whoever awaited `result`.
+    this.mutationQueue = result.then(
+      () => undefined,
+      () => undefined,
+    );
+    return result;
+  }
+
   private async loadGraph(): Promise<KnowledgeGraph> {
     try {
       const data = await fs.readFile(this.memoryFilePath, "utf-8");
@@ -180,98 +200,110 @@ export class KnowledgeGraphManager {
   }
 
   async createEntities(entities: Entity[]): Promise<Entity[]> {
-    const graph = await this.loadGraph();
-    const newEntities = entities.filter((e, index) =>
-      !graph.entities.some(existingEntity => existingEntity.name === e.name) &&
-      // Also skip duplicates appearing earlier in this same batch
-      !entities.slice(0, index).some(earlier => earlier.name === e.name)
-    );
-    graph.entities.push(...newEntities);
-    await this.saveGraph(graph);
-    return newEntities;
+    return this.withLock(async () => {
+      const graph = await this.loadGraph();
+      const newEntities = entities.filter((e, index) =>
+        !graph.entities.some(existingEntity => existingEntity.name === e.name) &&
+        // Also skip duplicates appearing earlier in this same batch
+        !entities.slice(0, index).some(earlier => earlier.name === e.name)
+      );
+      graph.entities.push(...newEntities);
+      await this.saveGraph(graph);
+      return newEntities;
+    });
   }
 
   async createRelations(relations: Relation[]): Promise<Relation[]> {
-    const graph = await this.loadGraph();
-    const entityNames = new Set(graph.entities.map(e => e.name));
+    return this.withLock(async () => {
+      const graph = await this.loadGraph();
+      const entityNames = new Set(graph.entities.map(e => e.name));
 
-    relations.forEach(r => {
-      if (!entityNames.has(r.from)) {
-        throw new Error(`Entity with name ${r.from} not found`);
-      }
-      if (!entityNames.has(r.to)) {
-        throw new Error(`Entity with name ${r.to} not found`);
-      }
+      relations.forEach(r => {
+        if (!entityNames.has(r.from)) {
+          throw new Error(`Entity with name ${r.from} not found`);
+        }
+        if (!entityNames.has(r.to)) {
+          throw new Error(`Entity with name ${r.to} not found`);
+        }
+      });
+
+      const isSameRelation = (a: Relation, b: Relation) =>
+        a.from === b.from &&
+        a.to === b.to &&
+        a.relationType === b.relationType;
+      const newRelations = relations.filter((r, index) =>
+        !graph.relations.some(existingRelation => isSameRelation(existingRelation, r)) &&
+        // Also skip duplicates appearing earlier in this same batch
+        !relations.slice(0, index).some(earlier => isSameRelation(earlier, r))
+      );
+      graph.relations.push(...newRelations);
+      await this.saveGraph(graph);
+      return newRelations;
     });
-
-    const isSameRelation = (a: Relation, b: Relation) =>
-      a.from === b.from &&
-      a.to === b.to &&
-      a.relationType === b.relationType;
-    const newRelations = relations.filter((r, index) =>
-      !graph.relations.some(existingRelation => isSameRelation(existingRelation, r)) &&
-      // Also skip duplicates appearing earlier in this same batch
-      !relations.slice(0, index).some(earlier => isSameRelation(earlier, r))
-    );
-    graph.relations.push(...newRelations);
-    await this.saveGraph(graph);
-    return newRelations;
   }
 
   async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
-    const graph = await this.loadGraph();
-    const results = observations.map(o => {
-      const entity = graph.entities.find(e => e.name === o.entityName);
-      if (!entity) {
-        throw new Error(`Entity with name ${o.entityName} not found`);
-      }
-      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
-      entity.observations.push(...newObservations);
-      return { entityName: o.entityName, addedObservations: newObservations };
```

---

### Incident Patch 4: `1ec570c2` (2026-09-03)
**Commit Message**: fix(memory): skip duplicate entities and relations within a single batch (#4383)

create_entities and create_relations only de-duplicated against the existing
graph, so passing the same entity name (or identical relation) twice in one
call persisted duplicate records. This contradicts the documented behavior
("Ignores entities with existing names" / "Skips duplicate relations") and
breaks the implicit name-uniqueness invariant the rest of the manager relies
on (e.g. addObservations/deleteEntities key on name).

De-duplicate within the input batch as well, keeping the first occurrence.

Co-authored-by: JSap0914 <[REDACTED_EMAIL]>
Co-authored-by: olaservo <[REDACTED_EMAIL]>

**File**: `src/memory/__tests__/knowledge-graph.test.ts` (modified, +32/-0)
```diff
@@ -59,6 +59,20 @@ describe('KnowledgeGraphManager', () => {
       const newEntities = await manager.createEntities([]);
       expect(newEntities).toHaveLength(0);
     });
+
+    it('should ignore duplicate entity names within a single batch', async () => {
+      const entities: Entity[] = [
+        { name: 'Alice', entityType: 'person', observations: ['first'] },
+        { name: 'Alice', entityType: 'person', observations: ['second'] },
+      ];
+
+      const newEntities = await manager.createEntities(entities);
+      expect(newEntities).toHaveLength(1);
+
+      const graph = await manager.readGraph();
+      expect(graph.entities).toHaveLength(1);
+      expect(graph.entities[0].name).toBe('Alice');
+    });
   });
 
   describe('createRelations', () => {
@@ -135,6 +149,24 @@ describe('KnowledgeGraphManager', () => {
       const newRelations = await manager.createRelations([]);
       expect(newRelations).toHaveLength(0);
     });
+
+    it('should skip duplicate relations within a single batch', async () => {
+      await manager.createEntities([
+        { name: 'Alice', entityType: 'person', observations: [] },
+        { name: 'Bob', entityType: 'person', observations: [] },
+      ]);
+
+      const relations: Relation[] = [
+        { from: 'Alice', to: 'Bob', relationType: 'knows' },
+        { from: 'Alice', to: 'Bob', relationType: 'knows' },
+      ];
+
+      const newRelations = await manager.createRelations(relations);
+      expect(newRelations).toHaveLength(1);
+
+      const graph = await manager.readGraph();
+      expect(graph.relations).toHaveLength(1);
+    });
   });
 
   describe('addObservations', () => {
```

**File**: `src/memory/index.ts` (modified, +14/-6)
```diff
@@ -181,7 +181,11 @@ export class KnowledgeGraphManager {
 
   async createEntities(entities: Entity[]): Promise<Entity[]> {
     const graph = await this.loadGraph();
-    const newEntities = entities.filter(e => !graph.entities.some(existingEntity => existingEntity.name === e.name));
+    const newEntities = entities.filter((e, index) =>
+      !graph.entities.some(existingEntity => existingEntity.name === e.name) &&
+      // Also skip duplicates appearing earlier in this same batch
+      !entities.slice(0, index).some(earlier => earlier.name === e.name)
+    );
     graph.entities.push(...newEntities);
     await this.saveGraph(graph);
     return newEntities;
@@ -200,11 +204,15 @@ export class KnowledgeGraphManager {
       }
     });
 
-    const newRelations = relations.filter(r => !graph.relations.some(existingRelation => 
-      existingRelation.from === r.from && 
-      existingRelation.to === r.to && 
-      existingRelation.relationType === r.relationType
-    ));
+    const isSameRelation = (a: Relation, b: Relation) =>
+      a.from === b.from &&
+      a.to === b.to &&
+      a.relationType === b.relationType;
+    const newRelations = relations.filter((r, index) =>
+      !graph.relations.some(existingRelation => isSameRelation(existingRelation, r)) &&
+      // Also skip duplicates appearing earlier in this same batch
+      !relations.slice(0, index).some(earlier => isSameRelation(earlier, r))
+    );
     graph.relations.push(...newRelations);
     await this.saveGraph(graph);
     return newRelations;
```

---

### Incident Patch 5: `f41b666e` (2026-09-03)
**Commit Message**: fix(memory): constrain search_nodes query length (#4662)

The search_nodes tool accepted an unbounded query string (per
modelcontextprotocol/servers#3537, official servers should constrain
string parameters). An oversized query costs an O(graph) scan per
call with no value. Cap it at 2048 chars via an exported
SearchNodesQuerySchema, and add vitest coverage for the boundary
(at-limit accepted, over-limit rejected, non-string still rejected).

Signed-off-by: fei <[REDACTED_EMAIL]>

**File**: `src/memory/__tests__/search-nodes-schema.test.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { describe, it, expect } from 'vitest';
+import { SearchNodesQuerySchema, SEARCH_QUERY_MAX_LENGTH } from '../index.js';
+
+describe('search_nodes input schema', () => {
+  it('should accept a normal query', () => {
+    expect(SearchNodesQuerySchema.safeParse('Alice').success).toBe(true);
+    expect(SearchNodesQuerySchema.safeParse('works at Acme Corp').success).toBe(true);
+  });
+
+  it('should accept a query at exactly the max length', () => {
+    const atLimit = 'a'.repeat(SEARCH_QUERY_MAX_LENGTH);
+    expect(SearchNodesQuerySchema.safeParse(atLimit).success).toBe(true);
+  });
+
+  it('should reject a query longer than the max length', () => {
+    const oversized = 'a'.repeat(SEARCH_QUERY_MAX_LENGTH + 1);
+    const result = SearchNodesQuerySchema.safeParse(oversized);
+    expect(result.success).toBe(false);
+  });
+
+  it('should still reject non-string input', () => {
+    expect(SearchNodesQuerySchema.safeParse(42).success).toBe(false);
+    expect(SearchNodesQuerySchema.safeParse(null).success).toBe(false);
+  });
+});
```

**File**: `src/memory/index.ts` (modified, +8/-1)
```diff
@@ -582,14 +582,21 @@ server.registerTool(
   }
 );
 
+export const SEARCH_QUERY_MAX_LENGTH = 2048;
+
+export const SearchNodesQuerySchema = z
+  .string()
+  .max(SEARCH_QUERY_MAX_LENGTH)
+  .describe("The search query to match against entity names, types, and observation content");
+
 // Register search_nodes tool
 server.registerTool(
   "search_nodes",
   {
     title: "Search Nodes",
     description: "Search for nodes in the knowledge graph based on a query",
     inputSchema: {
-      query: z.string().describe("The search query to match against entity names, types, and observation content")
+      query: SearchNodesQuerySchema
     },
     outputSchema: {
       entities: z.array(EntitySchema),
```

---

### Incident Patch 6: `c3d8e43d` (2026-09-03)
**Commit Message**: fix(memory): validate knowledge graph entries when loading from disk (#4717)

loadGraph() trusted the persisted memory file and pushed entities and
relations without validating their fields. A corrupted or legacy entry
(e.g. an entity missing entityType, or an observation that is not a string)
would reach searchNodes and crash with "Cannot read properties of undefined
(reading 'toLowerCase')".

Validate each line against the existing EntitySchema/RelationSchema and skip
malformed entries with a warning, so the in-memory graph only ever contains
well-formed data. Malformed JSON lines are skipped as well.

Fixes #2044

**File**: `src/memory/__tests__/knowledge-graph.test.ts` (modified, +47/-0)
```diff
@@ -617,4 +617,51 @@ describe('KnowledgeGraphManager', () => {
       expect(result.relations[0]).not.toHaveProperty('type');
     });
   });
+
+  describe('loadGraph validation', () => {
+    it('skips corrupt entities instead of crashing search', async () => {
+      const lines = [
+        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'person', observations: ['works at Acme Corp'] }),
+        JSON.stringify({ type: 'entity', name: 'Broken', observations: ['missing entityType'] }),
+        JSON.stringify({ type: 'entity', name: 'BadObs', entityType: 'person', observations: ['ok', null] }),
+      ];
+      await fs.writeFile(testFilePath, lines.join('\n') + '\n');
+
+      const graph = await manager.readGraph();
+      expect(graph.entities).toHaveLength(1);
+      expect(graph.entities[0].name).toBe('Alice');
+
+      // searchNodes must not throw even though the file contains corrupt entries
+      const result = await manager.searchNodes('Acme');
+      expect(result.entities).toHaveLength(1);
+      expect(result.entities[0].name).toBe('Alice');
+    });
+
+    it('skips corrupt relations', async () => {
+      const lines = [
+        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'person', observations: [] }),
+        JSON.stringify({ type: 'relation', from: 'Alice', to: 'Bob' }), // missing relationType
+        JSON.stringify({ type: 'relation', from: 'Alice', to: 'Bob', relationType: 'knows' }),
+      ];
+      await fs.writeFile(testFilePath, lines.join('\n') + '\n');
+
+      const graph = await manager.readGraph();
+      expect(graph.entities).toHaveLength(1);
+      expect(graph.relations).toHaveLength(1);
+      expect(graph.relations[0].relationType).toBe('knows');
+    });
+
+    it('skips malformed JSON lines', async () => {
+      const lines = [
+        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'person', observations: [] }),
+        '{this is not valid json',
+        JSON.stringify({ type: 'entity', name: 'Bob', entityType: 'person', observations: [] }),
+      ];
+      await fs.writeFile(testFilePath, lines.join('\n') + '\n');
+
+      const graph = await manager.readGraph();
+      expect(graph.entities).toHaveLength(2);
+      expect(graph.entities.map(e => e.name)).toEqual(['Alice', 'Bob']);
+    });
+  });
 });
```

**File**: `src/memory/index.ts` (modified, +39/-16)
```diff
@@ -90,24 +90,47 @@ export class KnowledgeGraphManager {
     try {
       const data = await fs.readFile(this.memoryFilePath, "utf-8");
       const lines = data.split("\n").filter(line => line.trim() !== "");
-      return lines.reduce((graph: KnowledgeGraph, line) => {
-        const item = JSON.parse(line);
-        if (item.type === "entity") {
-          graph.entities.push({
-            name: item.name,
-            entityType: item.entityType,
-            observations: item.observations
-          });
+      const graph: KnowledgeGraph = { entities: [], relations: [] };
+
+      for (const line of lines) {
+        let item: unknown;
+        try {
+          item = JSON.parse(line);
+        } catch {
+          console.error("Skipping malformed line in memory file");
+          continue;
         }
-        if (item.type === "relation") {
-          graph.relations.push({
-            from: item.from,
-            to: item.to,
-            relationType: item.relationType
-          });
+
+        if (typeof item !== "object" || item === null) {
+          console.error("Skipping non-object line in memory file");
+          continue;
+        }
+
+        const record = item as Record<string, unknown>;
+        if (record.type === "entity") {
+          const parsed = EntitySchema.safeParse(item);
+          if (parsed.success) {
+            graph.entities.push(parsed.data);
+          } else {
+            console.error(
+              "Skipping invalid entity in memory file:",
+              parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ")
+            );
+          }
+        } else if (record.type === "relation") {
+          const parsed = RelationSchema.safeParse(item);
+          if (parsed.success) {
+            graph.relations.push(parsed.data);
+          } else {
+            console.error(
+              "Skipping invalid relation in memory file:",
+              parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ")
+            );
+          }
         }
-        return graph;
-      }, { entities: [], relations: [] });
+      }
+
+      return graph;
     } catch (error) {
       if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
         return { entities: [], relations: [] };
```

---

### Incident Patch 7: `abbbddb2` (2026-09-03)
**Commit Message**: fix(memory): stop reporting deletions that did not happen (#4738)

delete_entities, delete_observations and delete_relations returned
success: true with a hardcoded "deleted successfully" message regardless
of what matched. An agent that mistypes an entity name is told its memory
is clean while the data is still on disk, and nothing in the response
contradicts that. addObservations throws for the same condition ten lines
above, so the file already disagreed with itself.

Staying quiet is deliberate and documented, so nothing throws and the
output schema is unchanged. The three manager methods now return what
they matched, and the handlers say so. A delete where everything is found
returns the same message it always did.

README updated: the three "Silent operation" bullets described the
absence of an error, which is still true, but read as if the response
said nothing either.

**File**: `src/memory/README.md` (modified, +3/-3)
```diff
@@ -87,15 +87,15 @@ Example:
   - Remove entities and their relations
   - Input: `entityNames` (string[])
   - Cascading deletion of associated relations
-  - Silent operation if entity doesn't exist
+  - No error if an entity doesn't exist; the response reports which names were not found
 
 - **delete_observations**
   - Remove specific observations from entities
   - Input: `deletions` (array of objects)
     - Each object contains:
       - `entityName` (string): Target entity
       - `observations` (string[]): Observations to remove
-  - Silent operation if observation doesn't exist
+  - No error if an observation doesn't exist; the response reports how many were deleted
 
 - **delete_relations**
   - Remove specific relations from the graph
@@ -104,7 +104,7 @@ Example:
       - `from` (string): Source entity name
       - `to` (string): Target entity name
       - `relationType` (string): Relationship type
-  - Silent operation if relation doesn't exist
+  - No error if a relation doesn't exist; the response reports how many were deleted
 
 - **read_graph**
   - Read the entire knowledge graph
```

**File**: `src/memory/__tests__/delete-reporting.test.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { describe, it, expect, beforeEach, afterEach } from 'vitest';
+import { promises as fs } from 'fs';
+import path from 'path';
+import { fileURLToPath } from 'url';
+import { KnowledgeGraphManager, Entity, Relation } from '../index.js';
+
+/**
+ * The delete tools stay silent when a target is absent, which the README
+ * documents. What they must not do is report a deletion that did not happen:
+ * an agent that mistypes a name is told its memory is clean while the data is
+ * still on disk, and nothing in the response contradicts that.
+ */
+describe('delete reporting', () => {
+  let manager: KnowledgeGraphManager;
+  let testFilePath: string;
+
+  const entities: Entity[] = [
+    { name: 'Alice', entityType: 'person', observations: ['works at Acme Corp', 'likes tea'] },
+    { name: 'Bob', entityType: 'person', observations: ['likes programming'] },
+  ];
+  const relations: Relation[] = [{ from: 'Alice', to: 'Bob', relationType: 'works_with' }];
+
+  beforeEach(async () => {
+    testFilePath = path.join(
+      path.dirname(fileURLToPath(import.meta.url)),
+      `test-delete-reporting-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonl`
+    );
+    manager = new KnowledgeGraphManager(testFilePath);
+    await manager.createEntities(entities);
+    await manager.createRelations(relations);
+  });
+
+  afterEach(async () => {
+    try {
+      await fs.unlink(testFilePath);
+    } catch {
+      // the file is gone already
+    }
+  });
+
+  describe('deleteEntities', () => {
+    it('reports which names matched and which did not', async () => {
+      const result = await manager.deleteEntities(['Alice', 'Alise']);
+      expect(result).toEqual({ deleted: ['Alice'], notFound: ['Alise'] });
+    });
+
+    it('reports nothing deleted when no name matches', async () => {
+      const result = await manager.deleteEntities(['Nobody']);
+      expect(result).toEqual({ deleted: [], notFound: ['Nobody'] });
+
+      const graph = await manager.readGraph();
+      expect(graph.entities).toHaveLength(2);
+    });
+
+    it('still deletes the entity and its relations', async () => {
+      await manager.deleteEntities(['Alice']);
+
+      const graph = await manager.readGraph();
+      expect(graph.entities.map(e => e.name)).toEqual(['Bob']);
+      expect(graph.relations).toHaveLength(0);
+    });
+  });
+
+  describe('deleteObservations', () => {
+    it('counts only the observations that were present', async () => {
+      const result = await manager.deleteObservations([
+        { entityName: 'Alice', observations: ['likes tea', 'never said this'] },
+      ]);
+      expect(result).toEqual({ deletedCount: 1, missingEntities: [] });
+    });
+
+    it('names an entity that does not exist', async () => {
+      const result = await manager.deleteObservations([
+        { entityName: 'Carol', observations: ['anything'] },
+      ]);
+      expect(result).toEqual({ deletedCount: 0, missingEntities: ['Carol'] });
+    });
+  });
+
+  describe('deleteRelations', () => {
+    it('counts only the relations that matched', async () => {
+      const result = await manager.deleteRelations([
+        { from: 'Alice', to: 'Bob', relationType: 'works_with' },
+        { from: 'Alice', to: 'Bob', relationType: 'never_existed' },
+      ]);
+      expect(result).toEqual({ deletedCount: 1 });
+    });
+
+    it('reports nothing deleted when the relation type is wrong', async () => {
+      const result = await manager.deleteRelations([
+        { from: 'Alice', to: 'Bob', relationType: 'manages' },
+      ]);
+      expect(result).toEqual({ deletedCount: 0 });
+
+      const graph = await manager.readGraph();
+      expect(graph.relations).toHaveLength(1);
+    });
+  });
+});
```

**File**: `src/memory/index.ts` (modified, +36/-12)
```diff
@@ -202,32 +202,45 @@ export class KnowledgeGraphManager {
     return results;
   }
 
-  async deleteEntities(entityNames: string[]): Promise<void> {
+  async deleteEntities(entityNames: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
     const graph = await this.loadGraph();
+    const present = new Set(graph.entities.map(e => e.name));
+    const deleted = entityNames.filter(name => present.has(name));
+    const notFound = entityNames.filter(name => !present.has(name));
     graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
     graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
     await this.saveGraph(graph);
+    return { deleted, notFound };
   }
 
-  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
+  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<{ deletedCount: number; missingEntities: string[] }> {
     const graph = await this.loadGraph();
+    let deletedCount = 0;
+    const missingEntities: string[] = [];
     deletions.forEach(d => {
       const entity = graph.entities.find(e => e.name === d.entityName);
       if (entity) {
+        const before = entity.observations.length;
         entity.observations = entity.observations.filter(o => !d.observations.includes(o));
+        deletedCount += before - entity.observations.length;
+      } else {
+        missingEntities.push(d.entityName);
       }
     });
     await this.saveGraph(graph);
+    return { deletedCount, missingEntities };
   }
 
-  async deleteRelations(relations: Relation[]): Promise<void> {
+  async deleteRelations(relations: Relation[]): Promise<{ deletedCount: number }> {
     const graph = await this.loadGraph();
+    const before = graph.relations.length;
     graph.relations = graph.relations.filter(r => !relations.some(delRelation => 
       r.from === delRelation.from && 
       r.to === delRelation.to && 
       r.relationType === delRelation.relationType
     ));
     await this.saveGraph(graph);
+    return { deletedCount: before - graph.relations.length };
   }
 
   async readGraph(): Promise<KnowledgeGraph> {
@@ -436,11 +449,14 @@ server.registerTool(
     }
   },
   async ({ entityNames }) => {
-    await knowledgeGraphManager.deleteEntities(entityNames);
+    const { deleted, notFound } = await knowledgeGraphManager.deleteEntities(entityNames);
     notifyGraphUpdated();
+    const message = notFound.length === 0
+      ? "Entities deleted successfully"
+      : `Deleted ${deleted.length} of ${entityNames.length} entities. Not found: ${notFound.join(", ")}`;
     return {
-      content: [{ type: "text" as const, text: "Entities deleted successfully" }],
-      structuredContent: { success: true, message: "Entities deleted successfully" }
+      content: [{ type: "text" as const, text: message }],
+      structuredContent: { success: true, message }
     };
   }
 );
@@ -469,11 +485,16 @@ server.registerTool(
     }
   },
   async ({ deletions }) => {
-    await knowledgeGraphManager.deleteObservations(deletions);
+    const { deletedCount, missingEntities } = await knowledgeGraphManager.deleteObservations(deletions);
     notifyGraphUpdated();
+    const requested = deletions.reduce((total, d) => total + d.observations.length, 0);
+    const message = deletedCount === requested
+      ? "Observations deleted successfully"
+      : `Deleted ${deletedCount} of ${requested} observations.` +
+        (missingEntities.length ? ` Entities not found: ${missingEntities.join(", ")}` : "");
     return {
-      content: [{ type: "text" as const, text: "Observations deleted successfully" }],
-      structuredContent: { success: true, message: "Observations deleted successfully" }
+      content: [{ type: "text" as const, text: message }],
+      structuredContent: { success: true, message }
     };
   }
 );
@@ -499,11 +520,14 @@ server.registerTool(
     }
   },
   async ({ relations }) => {
-    await knowledgeGraphManager.deleteRelations(relations);
+    const { deletedCount } = await knowledgeGraphManager.deleteRelations(relations);
     notifyGraphUpdated();
+    const message = deletedCount === relations.length
+      ? "Relations deleted successfully"
+      : `Deleted ${deletedCount} of ${relations.length} relations. The rest matched nothing.`;
     return {
-      content: [{ type: "text" as const, text: "Relations deleted successfully" }],
-      structuredContent: { success: true, message: "Relations deleted successfully" }
+      content: [{ type: "text" as const, text: message }],
+      structuredContent: { success: true, message }
     };
   }
 );
```

---

### Incident Patch 8: `649af585` (2026-09-03)
**Commit Message**: fix(memory): expand leading ~ in MEMORY_FILE_PATH to the home directory (#4447)

* fix(memory): expand leading ~ in MEMORY_FILE_PATH to the home directory

MCP clients pass MEMORY_FILE_PATH from JSON config, where no shell
expands a leading "~". Because path.isAbsolute("~/memory.jsonl") is
false, the value was joined onto the package directory, so the server
persisted to a literal "~" folder inside the install instead of the
user's intended location.

Add an expandHome() helper that mirrors the one already used by the
filesystem server (src/filesystem/path-utils.ts) and apply it in
ensureMemoryFilePath() before the existing absolute/relative resolution.
Absolute paths, relative paths, and a "~" not at the start are
unaffected. Adds unit tests for expandHome plus an end-to-end test
through ensureMemoryFilePath.

Addresses #1600

* test(memory): use a literal ~/ path in the tilde expansion test

path.join('~', ...) produces a backslash on Windows, which expandHome does
not match, so the test failed there.

---------

Co-authored-by: olaservo <[REDACTED_EMAIL]>

**File**: `src/memory/__tests__/file-path.test.ts` (modified, +37/-1)
```diff
@@ -1,8 +1,9 @@
 import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
 import { promises as fs } from 'fs';
 import path from 'path';
+import os from 'os';
 import { fileURLToPath } from 'url';
-import { ensureMemoryFilePath, defaultMemoryPath } from '../index.js';
+import { ensureMemoryFilePath, defaultMemoryPath, expandHome } from '../index.js';
 
 describe('ensureMemoryFilePath', () => {
   const testDir = path.dirname(fileURLToPath(import.meta.url));
@@ -72,6 +73,15 @@ describe('ensureMemoryFilePath', () => {
         expect(path.isAbsolute(result)).toBe(true);
       }
     });
+
+    it('should expand a leading "~/" to the home directory', async () => {
+      process.env.MEMORY_FILE_PATH = '~/custom-memory.jsonl';
+
+      const result = await ensureMemoryFilePath();
+
+      expect(result).toBe(path.join(os.homedir(), 'custom-memory.jsonl'));
+      expect(path.isAbsolute(result)).toBe(true);
+    });
   });
 
   describe('without MEMORY_FILE_PATH environment variable', () => {
@@ -154,3 +164,29 @@ describe('ensureMemoryFilePath', () => {
     });
   });
 });
+
+describe('expandHome', () => {
+  it('expands a bare "~" to the home directory', () => {
+    expect(expandHome('~')).toBe(os.homedir());
+  });
+
+  it('expands a leading "~/" to the home directory', () => {
+    expect(expandHome('~/notes/memory.jsonl')).toBe(
+      path.join(os.homedir(), 'notes/memory.jsonl')
+    );
+  });
+
+  it('leaves a "~" not followed by a separator unchanged', () => {
+    expect(expandHome('~backup.jsonl')).toBe('~backup.jsonl');
+  });
+
+  it('leaves absolute paths unchanged', () => {
+    expect(expandHome('/var/data/memory.jsonl')).toBe('/var/data/memory.jsonl');
+  });
+
+  it('leaves relative paths unchanged', () => {
+    expect(expandHome(path.join('data', 'memory.jsonl'))).toBe(
+      path.join('data', 'memory.jsonl')
+    );
+  });
+});
```

**File**: `src/memory/index.ts` (modified, +19/-4)
```diff
@@ -6,20 +6,35 @@ import { SubscribeRequestSchema, UnsubscribeRequestSchema } from "@modelcontextp
 import { z } from "zod";
 import { promises as fs } from 'fs';
 import path from 'path';
+import os from 'os';
 import { randomBytes } from 'crypto';
 import { fileURLToPath } from 'url';
 import { SERVER_VERSION } from './version.js';
 
 // Define memory file path using environment variable with fallback
 export const defaultMemoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory.jsonl');
 
+// Expand a leading "~" to the user's home directory. MCP clients pass
+// MEMORY_FILE_PATH from JSON config, where no shell performs tilde expansion,
+// so an unexpanded "~" would otherwise be treated as a relative path and
+// joined onto the package directory. Mirrors the helper of the same name in
+// the filesystem server (src/filesystem/path-utils.ts).
+export function expandHome(filepath: string): string {
+  if (filepath.startsWith('~/') || filepath === '~') {
+    return path.join(os.homedir(), filepath.slice(1));
+  }
+  return filepath;
+}
+
 // Handle backward compatibility: migrate memory.json to memory.jsonl if needed
 export async function ensureMemoryFilePath(): Promise<string> {
   if (process.env.MEMORY_FILE_PATH) {
-    // Custom path provided, use it as-is (with absolute path resolution)
-    return path.isAbsolute(process.env.MEMORY_FILE_PATH)
-      ? process.env.MEMORY_FILE_PATH
-      : path.join(path.dirname(fileURLToPath(import.meta.url)), process.env.MEMORY_FILE_PATH);
+    // Custom path provided. Expand a leading "~" first, then resolve relative
+    // paths against the package directory (absolute paths are used as-is).
+    const customPath = expandHome(process.env.MEMORY_FILE_PATH);
+    return path.isAbsolute(customPath)
+      ? customPath
+      : path.join(path.dirname(fileURLToPath(import.meta.url)), customPath);
   }
   
   // No custom path set, check for backward compatibility migration
```

---

### Incident Patch 9: `242751e8` (2026-09-03)
**Commit Message**: fix(memory): add trailing newline to JSONL output (#3653)

Co-authored-by: Nick Veenhof <[REDACTED_EMAIL]>
Co-authored-by: olaservo <[REDACTED_EMAIL]>

**File**: `src/memory/__tests__/knowledge-graph.test.ts` (modified, +70/-0)
```diff
@@ -458,6 +458,76 @@ describe('KnowledgeGraphManager', () => {
       expect(JSON.parse(lines[1])).toHaveProperty('type', 'relation');
     });
 
+    it('should write a trailing newline to produce valid JSONL', async () => {
+      await manager.createEntities([
+        { name: 'Alice', entityType: 'person', observations: ['test'] },
+      ]);
+
+      const fileContent = await fs.readFile(testFilePath, 'utf-8');
+      expect(fileContent.endsWith('\n')).toBe(true);
+    });
+
+    it('should produce a file where every line is individually valid JSON', async () => {
+      // This test catches the bug where saveGraph wrote lines.join("\n")
+      // without a trailing newline. When the file was later appended to
+      // (e.g. by a concurrent process or external tool), the last JSON
+      // object and the new first JSON object ended up on the same line,
+      // producing invalid JSONL like:
+      //   {"type":"entity","name":"Alice"}{"type":"relation","from":"Alice",...}
+      // which fails with: "Unexpected non-whitespace character after JSON
+      // at position N"
+      await manager.createEntities([
+        { name: 'Alice', entityType: 'person', observations: ['test'] },
+        { name: 'Bob', entityType: 'person', observations: [] },
+      ]);
+      await manager.createRelations([
+        { from: 'Alice', to: 'Bob', relationType: 'knows' },
+      ]);
+
+      const fileContent = await fs.readFile(testFilePath, 'utf-8');
+      const allLines = fileContent.split('\n');
+
+      // Every non-empty line must be valid JSON on its own
+      for (const line of allLines) {
+        if (line.trim() === '') continue;
+        expect(() => JSON.parse(line)).not.toThrow();
+      }
+    });
+
+    it('should not corrupt JSONL when content is appended to the file externally', async () => {
+      // Simulate the real-world corruption scenario:
+      // 1. saveGraph writes entities to the file
+      // 2. An external process appends a new JSON line to the file
+      // 3. loadGraph must still parse the file without errors
+      //
+      // Without a trailing newline on step 1, the appended content in
+      // step 2 lands on the same line as the last entity, producing
+      // invalid JSONL that breaks loadGraph.
+      await manager.createEntities([
+        { name: 'Alice', entityType: 'person', observations: ['original'] },
+      ]);
+
+      // Simulate an external append (e.g. another process, a script, or
+      // a crash-recovery replay). This is what triggers the bug: without
+      // a trailing newline, this JSON object concatenates onto line 1.
+      const externalLine = JSON.stringify({
+        type: 'entity',
+        name: 'External',
+        entityType: 'person',
+        observations: ['appended externally'],
+      });
+      await fs.appendFile(testFilePath, externalLine + '\n');
+
+      // A new manager instance forces a fresh loadGraph from disk
+      const manager2 = new KnowledgeGraphManager(testFilePath);
+      const graph = await manager2.readGraph();
+
+      // Both entities must load without a JSON parse error
+      expect(graph.entities).toHaveLength(2);
+      expect(graph.entities.map(e => e.name)).toContain('Alice');
+      expect(graph.entities.map(e => e.name)).toContain('External');
+    });
+
     it('should strip type field from entities when loading from file', async () => {
       // Create entities and relations (these get saved with type field)
       await manager.createEntities([
```

**File**: `src/memory/index.ts` (modified, +1/-1)
```diff
@@ -132,7 +132,7 @@ export class KnowledgeGraphManager {
     );
 
     try {
-      await fs.writeFile(tempFilePath, lines.join("\n"));
+      await fs.writeFile(tempFilePath, lines.join("\n") + "\n");
       await fs.rename(tempFilePath, this.memoryFilePath);
     } catch (error) {
       // Never leave a stray temp file behind on failure.
```

---

### Incident Patch 10: `ba167cef` (2026-09-03)
**Commit Message**: fix: declare zod runtime dependencies (#4289)

Co-authored-by: olaservo <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +6/-3)
```diff
@@ -3866,7 +3866,8 @@
         "@modelcontextprotocol/sdk": "^1.30.0",
         "diff": "^8.0.3",
         "glob": "^13.0.6",
-        "minimatch": "^10.0.1"
+        "minimatch": "^10.0.1",
+        "zod": "^4.0.0"
       },
       "bin": {
         "mcp-server-filesystem": "dist/index.js"
@@ -3886,7 +3887,8 @@
       "version": "0.6.3",
       "license": "SEE LICENSE IN LICENSE",
       "dependencies": {
-        "@modelcontextprotocol/sdk": "^1.30.0"
+        "@modelcontextprotocol/sdk": "^1.30.0",
+        "zod": "^4.0.0"
       },
       "bin": {
         "mcp-server-memory": "dist/index.js"
@@ -3906,7 +3908,8 @@
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.30.0",
         "chalk": "^5.3.0",
-        "yargs": "^17.7.2"
+        "yargs": "^17.7.2",
+        "zod": "^4.0.0"
       },
       "bin": {
         "mcp-server-sequential-thinking": "dist/index.js"
```

**File**: `src/filesystem/package.json` (modified, +2/-1)
```diff
@@ -28,7 +28,8 @@
     "@modelcontextprotocol/sdk": "^1.30.0",
     "diff": "^8.0.3",
     "glob": "^13.0.6",
-    "minimatch": "^10.0.1"
+    "minimatch": "^10.0.1",
+    "zod": "^4.0.0"
   },
   "devDependencies": {
     "@types/diff": "^5.0.9",
```

**File**: `src/memory/package.json` (modified, +2/-1)
```diff
@@ -25,7 +25,8 @@
     "test": "vitest run --coverage"
   },
   "dependencies": {
-    "@modelcontextprotocol/sdk": "^1.30.0"
+    "@modelcontextprotocol/sdk": "^1.30.0",
+    "zod": "^4.0.0"
   },
   "devDependencies": {
     "@types/node": "^22",
```

**File**: `src/sequentialthinking/package.json` (modified, +3/-2)
```diff
@@ -27,7 +27,8 @@
   "dependencies": {
     "@modelcontextprotocol/sdk": "^1.30.0",
     "chalk": "^5.3.0",
-    "yargs": "^17.7.2"
+    "yargs": "^17.7.2",
+    "zod": "^4.0.0"
   },
   "devDependencies": {
     "@types/node": "^22",
@@ -37,4 +38,4 @@
     "typescript": "^5.3.3",
     "vitest": "^4.1.8"
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 11: `48723c95` (2026-09-02)
**Commit Message**: fix(memory): reject dangling relations (#4477)

Signed-off-by: King Star <[REDACTED_EMAIL]>

**File**: `src/memory/README.md` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@ Example:
       - `to` (string): Target entity name
       - `relationType` (string): Relationship type in active voice
   - Skips duplicate relations
+  - Fails if either the source or target entity doesn't exist
 
 - **add_observations**
   - Add new observations to existing entities
```

**File**: `src/memory/__tests__/knowledge-graph.test.ts` (modified, +32/-0)
```diff
@@ -99,6 +99,38 @@ describe('KnowledgeGraphManager', () => {
       expect(graph.relations).toHaveLength(1);
     });
 
+    it('should reject relations from non-existent entities', async () => {
+      await manager.createEntities([
+        { name: 'Alice', entityType: 'person', observations: [] },
+      ]);
+
+      await expect(
+        manager.createRelations([
+          { from: 'Ghost', to: 'Alice', relationType: 'knows' },
+        ])
+      ).rejects.toThrow('Entity with name Ghost not found');
+
+      const graph = await manager.readGraph();
+      expect(graph.relations).toHaveLength(0);
+    });
+
+    it('should reject relation batches that reference non-existent target entities', async () => {
+      await manager.createEntities([
+        { name: 'Alice', entityType: 'person', observations: [] },
+        { name: 'Bob', entityType: 'person', observations: [] },
+      ]);
+
+      await expect(
+        manager.createRelations([
+          { from: 'Alice', to: 'Bob', relationType: 'knows' },
+          { from: 'Alice', to: 'Ghost', relationType: 'knows' },
+        ])
+      ).rejects.toThrow('Entity with name Ghost not found');
+
+      const graph = await manager.readGraph();
+      expect(graph.relations).toHaveLength(0);
+    });
+
     it('should handle empty relation arrays', async () => {
       const newRelations = await manager.createRelations([]);
       expect(newRelations).toHaveLength(0);
```

**File**: `src/memory/index.ts` (modified, +11/-0)
```diff
@@ -151,6 +151,17 @@ export class KnowledgeGraphManager {
 
   async createRelations(relations: Relation[]): Promise<Relation[]> {
     const graph = await this.loadGraph();
+    const entityNames = new Set(graph.entities.map(e => e.name));
+
+    relations.forEach(r => {
+      if (!entityNames.has(r.from)) {
+        throw new Error(`Entity with name ${r.from} not found`);
+      }
+      if (!entityNames.has(r.to)) {
+        throw new Error(`Entity with name ${r.to} not found`);
+      }
+    });
+
     const newRelations = relations.filter(r => !graph.relations.some(existingRelation => 
       existingRelation.from === r.from && 
       existingRelation.to === r.to && 
```

---

### Incident Patch 12: `96c49c73` (2026-09-02)
**Commit Message**: fix(memory): read serverInfo.version from package.json (#4407)

Fixes #4406. The memory server previously hardcoded serverInfo.version as
"0.6.3", which no longer matched published calendar versions. Resolve
package.json from both source and dist layouts so Docker and npm installs
report the installed package version.

Co-authored-by: syf2211 <[REDACTED_EMAIL]>

**File**: `src/memory/__tests__/server-version.test.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { describe, it, expect } from 'vitest';
+import { createRequire } from 'node:module';
+import path from 'path';
+import { fileURLToPath } from 'url';
+import { resolvePackageVersion, SERVER_VERSION } from '../version.js';
+
+const packageJson = createRequire(import.meta.url)('../package.json') as { version: string };
+
+describe('server version', () => {
+  it('uses package.json version for serverInfo', () => {
+    expect(SERVER_VERSION).toBe(packageJson.version);
+    expect(resolvePackageVersion()).toBe(packageJson.version);
+  });
+
+  it('resolves package.json from the dist layout', () => {
+    const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
+    const distVersionPath = path.join(distDir, 'version.js');
+
+    expect(() => createRequire(distVersionPath)('./version.js')).not.toThrow();
+    const distModule = createRequire(distVersionPath)('./version.js') as {
+      SERVER_VERSION: string;
+    };
+    expect(distModule.SERVER_VERSION).toBe(packageJson.version);
+  });
+});
```

**File**: `src/memory/index.ts` (modified, +2/-2)
```diff
@@ -8,6 +8,7 @@ import { promises as fs } from 'fs';
 import path from 'path';
 import { randomBytes } from 'crypto';
 import { fileURLToPath } from 'url';
+import { SERVER_VERSION } from './version.js';
 
 // Define memory file path using environment variable with fallback
 export const defaultMemoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory.jsonl');
@@ -276,10 +277,9 @@ const RelationSchema = z.object({
   relationType: z.string().describe("The type of the relation")
 });
 
-// The server instance and tools exposed to Claude
 const server = new McpServer({
   name: "memory-server",
-  version: "0.6.3",
+  version: SERVER_VERSION,
 });
 
 const RESOURCE_URI = "memory://knowledge-graph";
```

**File**: `src/memory/version.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { createRequire } from 'node:module';
+import path from 'path';
+import { fileURLToPath } from 'url';
+
+export function resolvePackageVersion(): string {
+  const require = createRequire(import.meta.url);
+  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
+  const candidates = [
+    path.join(moduleDir, 'package.json'),
+    path.join(moduleDir, '..', 'package.json'),
+  ];
+
+  for (const candidate of candidates) {
+    try {
+      const pkg = require(candidate) as { version?: string };
+      if (pkg.version) {
+        return pkg.version;
+      }
+    } catch {
+      // Try the next candidate when running from dist/ or source.
+    }
+  }
+
+  throw new Error('Could not locate package.json for server version');
+}
+
+export const SERVER_VERSION = resolvePackageVersion();
```

---

### Incident Patch 13: `cce08de4` (2026-09-02)
**Commit Message**: fix(memory): resolve Vitest false positive for expected rejection (#3893)

Wrap the addObservations call in an async closure before asserting with
.rejects.toThrow(). This prevents Vitest's global unhandled rejection
handler from capturing the expected error before the assertion can
intercept it, eliminating the false-positive "Unhandled Errors" warning
that was failing CI.

Fixes #3073

**File**: `src/memory/__tests__/knowledge-graph.test.ts` (modified, +4/-4)
```diff
@@ -146,11 +146,11 @@ describe('KnowledgeGraphManager', () => {
     });
 
     it('should throw error for non-existent entity', async () => {
-      await expect(
-        manager.addObservations([
+      await expect(async () => {
+        await manager.addObservations([
           { entityName: 'NonExistent', contents: ['some observation'] },
-        ])
-      ).rejects.toThrow('Entity with name NonExistent not found');
+        ]);
+      }).rejects.toThrow('Entity with name NonExistent not found');
     });
   });
 
```

---

### Incident Patch 14: `3aa19f55` (2026-09-02)
**Commit Message**: fix(git): unify git_log output schema and remove raise_exceptions from server.run (#4658)

**File**: `src/git/src/mcp_server_git/server.py` (modified, +24/-41)
```diff
@@ -1,6 +1,6 @@
 import logging
 from pathlib import Path
-from typing import Sequence, Optional
+from typing import Any, Optional, Sequence
 from mcp.server import Server
 from mcp.server.session import ServerSession
 from mcp.server.stdio import stdio_server
@@ -157,45 +157,28 @@ def git_reset(repo: git.Repo) -> str:
     return "All staged changes reset"
 
 def git_log(repo: git.Repo, max_count: int = 10, start_timestamp: Optional[str] = None, end_timestamp: Optional[str] = None) -> list[str]:
-    if start_timestamp or end_timestamp:
-        # Defense in depth: reject timestamps starting with '-' to prevent flag injection
-        if start_timestamp and start_timestamp.startswith("-"):
-            raise ValueError(f"Invalid start_timestamp: '{start_timestamp}' - cannot start with '-'")
-        if end_timestamp and end_timestamp.startswith("-"):
-            raise ValueError(f"Invalid end_timestamp: '{end_timestamp}' - cannot start with '-'")
-        # Use git log command with date filtering
-        args = []
-        if start_timestamp:
-            args.extend(['--since', start_timestamp])
-        if end_timestamp:
-            args.extend(['--until', end_timestamp])
-        args.extend(['--format=%H%n%an%n%ad%n%s%n'])
-
-        log_output = repo.git.log(*args).split('\n')
-
-        log = []
-        # Process commits in groups of 4 (hash, author, date, message)
-        for i in range(0, len(log_output), 4):
-            if i + 3 < len(log_output) and len(log) < max_count:
-                log.append(
-                    f"Commit: {log_output[i]}\n"
-                    f"Author: {log_output[i+1]}\n"
-                    f"Date: {log_output[i+2]}\n"
-                    f"Message: {log_output[i+3]}\n"
-                )
-        return log
-    else:
-        # Use existing logic for simple log without date filtering
-        commits = list(repo.iter_commits(max_count=max_count))
-        log = []
-        for commit in commits:
-            log.append(
-                f"Commit: {commit.hexsha!r}\n"
-                f"Author: {commit.author!r}\n"
-                f"Date: {commit.authored_datetime}\n"
-                f"Message: {commit.message!r}\n"
-            )
-        return log
+    # Defense in depth: reject timestamps starting with '-' to prevent flag injection
+    if start_timestamp and start_timestamp.startswith("-"):
+        raise ValueError(f"Invalid start_timestamp: '{start_timestamp}' - cannot start with '-'")
+    if end_timestamp and end_timestamp.startswith("-"):
+        raise ValueError(f"Invalid end_timestamp: '{end_timestamp}' - cannot start with '-'")
+
+    kwargs: dict[str, Any] = {"max_count": max_count}
+    if start_timestamp:
+        kwargs["since"] = start_timestamp
+    if end_timestamp:
+        kwargs["until"] = end_timestamp
+
+    commits = list(repo.iter_commits(**kwargs))
+    log = []
+    for commit in commits:
+        log.append(
+            f"Commit: {commit.hexsha}\n"
+            f"Author: {commit.author}\n"
+            f"Date: {commit.authored_datetime}\n"
+            f"Message: {commit.message}\n"
+        )
+    return log
 
 def git_create_branch(repo: git.Repo, branch_name: str, base_branch: str | None = None) -> str:
     # Defense in depth: reject names starting with '-' to prevent flag injection
@@ -599,4 +582,4 @@ async def call_tool(name: str, arguments: dict) -> list[TextContent]:
 
     options = server.create_initialization_options()
     async with stdio_server() as (read_stream, write_stream):
-        await server.run(read_stream, write_stream, options, raise_exceptions=True)
+        await server.run(read_stream, write_stream, options)
```

**File**: `src/git/tests/test_server.py` (modified, +80/-0)
```diff
@@ -16,8 +16,10 @@
     git_create_branch,
     git_show,
     validate_repo_path,
+    serve,
 )
 import shutil
+import unittest.mock as mock
 
 @pytest.fixture
 def test_repository(tmp_path: Path):
@@ -508,3 +510,81 @@ def test_git_branch_rejects_contains_flag_injection(test_repository):
 
     with pytest.raises(BadName):
         git_branch(test_repository, "local", not_contains="--exec=evil")
+
+
+def test_git_log_formatting_no_repr(test_repository):
+    """Test that git_log does not use !r formatting (no Python object repr or quotes)."""
+    file_path = Path(test_repository.working_dir) / "multiline.txt"
+    file_path.write_text("multiline test")
+    test_repository.index.add(["multiline.txt"])
+    test_repository.index.commit("Subject line\n\nDetailed body line 1\nDetailed body line 2")
+
+    result = git_log(test_repository, max_count=1)
+    entry = result[0]
+
+    # Verify no python repr quotes around commit hash or message
+    assert "Commit: '" not in entry
+    assert 'Commit: "' not in entry
+    assert "<git.Actor" not in entry
+    assert "Message: '" not in entry
+    assert 'Message: "' not in entry
+
+    # Verify full message with body is included
+    assert "Subject line\n\nDetailed body line 1\nDetailed body line 2" in entry
+
+
+def test_git_log_filtered_unfiltered_parity(test_repository):
+    """Test that filtered and unfiltered git_log produce identical schema and preserve commit body."""
+    file_path = Path(test_repository.working_dir) / "parity_test.txt"
+    file_path.write_text("parity test")
+    test_repository.index.add(["parity_test.txt"])
+    test_repository.index.commit("Parity subject\n\nParity body line 1\nParity body line 2")
+
+    unfiltered = git_log(test_repository, max_count=1)
+    filtered_since = git_log(test_repository, max_count=1, start_timestamp="yesterday")
+    filtered_until = git_log(test_repository, max_count=1, end_timestamp="2099-01-01")
+
+    # Output schemas and contents must be identical
+    assert unfiltered == filtered_since
+    assert unfiltered == filtered_until
+
+    # Multi-line commit message preserved in filtered results
+    assert "Parity subject\n\nParity body line 1\nParity body line 2" in filtered_since[0]
+
+
+def test_git_log_date_filtering(test_repository):
+    """Test date filtering logic in git_log."""
+    # Future start_timestamp should return no commits
+    future_result = git_log(test_repository, start_timestamp="2099-01-01")
+    assert future_result == []
+
+    # Past end_timestamp should return no commits
+    past_result = git_log(test_repository, end_timestamp="2000-01-01")
+    assert past_result == []
+
+    # Valid range with max_count
+    valid_result = git_log(test_repository, max_count=1, start_timestamp="2000-01-01")
+    assert len(valid_result) == 1
+
+
+def test_serve_run_does_not_raise_exceptions(tmp_path: Path):
+    """Verify that serve() runs server.run without raise_exceptions=True."""
+    import anyio
+
+    repo_path = tmp_path / "serve_test_repo"
+    git.Repo.init(repo_path)
+
+    async def _run():
+        with mock.patch("mcp_server_git.server.stdio_server") as mock_stdio:
+            mock_read = mock.AsyncMock()
+            mock_write = mock.AsyncMock()
+            mock_stdio.return_value.__aenter__.return_value = (mock_read, mock_write)
+            mock_stdio.return_value.__aexit__.return_value = None
+
+            with mock.patch("mcp_server_git.server.Server.run", new_callable=mock.AsyncMock) as mock_run:
+                await serve(repo_path)
+                mock_run.assert_awaited_once()
+                _, kwargs = mock_run.call_args
+                assert kwargs.get("raise_exceptions") is not True
+
+    anyio.run(_run)
```

---

### Incident Patch 15: `a6cdbf4d` (2026-08-30)
**Commit Message**: fix(filesystem): reject Windows paths on POSIX (#4704)

Co-authored-by: Yohanes <[REDACTED_EMAIL]>

**File**: `src/filesystem/__tests__/lib.test.ts` (modified, +7/-0)
```diff
@@ -173,6 +173,13 @@ describe('Lib Functions', () => {
 
   describe('Security & Validation Functions', () => {
     describe('validatePath', () => {
+      it('rejects Windows drive paths on POSIX hosts', async () => {
+        if (process.platform === 'win32') return;
+
+        await expect(validatePath('C:\\Users\\me\\notes\\file.md'))
+          .rejects.toThrow('Windows-style path received on a POSIX host');
+      });
+
       // Use Windows-compatible paths for testing
       const allowedDirs = process.platform === 'win32' ? ['C:\\Users\\test', 'C:\\temp'] : ['/home/user', '/tmp'];
 
```

**File**: `src/filesystem/lib.ts` (modified, +6/-0)
```diff
@@ -139,6 +139,12 @@ async function resolveUnicodeEquivalentPath(absolutePath: string): Promise<strin
 
 export async function validatePath(requestedPath: string): Promise<string> {
   const expandedPath = expandHome(requestedPath);
+  // Do not silently reinterpret a Windows drive path as a relative POSIX path.
+  // This would create a literal filename such as `C:\\Users\\...` inside the
+  // allowed root and report success for the wrong location.
+  if (process.platform !== 'win32' && /^(?:[A-Za-z]:)(?:[\\/]|$)/.test(expandedPath)) {
+    throw new Error(`Access denied - Windows-style path received on a POSIX host: ${requestedPath}`);
+  }
   const absolute = path.isAbsolute(expandedPath)
     ? path.resolve(expandedPath)
     : resolveRelativePathAgainstAllowedDirectories(expandedPath);
```

#### Recent Merged Pull Requests:
- **PR #5055** (2026-10-05): Add a DCO signoff check to CI and the gate (@cliffhall)
- **PR #5054** (2026-10-05): fix(git): reapply a merge autostash when git_commit concludes a merge (@cliffhall)
- **PR #5053** (2026-10-05): chore(everything): keep compiled tests and vitest config out of the published package (@cliffhall)
- **PR #5052** (2026-10-05): fix(scripts): verify:action-pins matches contexts and job ids case-insensitively (@cliffhall)
- **PR #5051** (2026-10-05): docs(agents): state the dep-lockstep rule the guard enforces (@cliffhall)
- **PR #5049** (2026-10-05): ci: run Python and TypeScript workflows on push only (@cliffhall)
- **PR #5047** (2026-10-05): chore(ci): run the test suites on Windows runners (@cliffhall)
- **PR #5046** (closed): fix(memory): Wave 3 rollup of #5004 (#4797, #4827, #4885, #4887) (@cliffhall)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
