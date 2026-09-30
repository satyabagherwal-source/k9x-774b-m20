# Forensic Learning Record (Deep Inspection): czlonkowski/n8n-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/czlonkowski-n8n-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:29:07.780Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `czlonkowski/n8n-mcp`
- **Description**: A MCP for Claude Desktop / Claude Code / Windsurf / Cursor to build n8n workflows for you 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 23029 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/parse-config.js`
```
#!/usr/bin/env node
/**
 * Parse JSON config file and output shell-safe export commands
 * Only outputs variables that aren't already set in environment
 * 
 * Security: Uses safe quoting without any shell execution
 */

const fs = require('fs');

// Debug logging support
const DEBUG = process.env.DEBUG_CONFIG === 'true';

function debugLog(message) {
  if (DEBUG) {
    process.stderr.write(`[parse-config] ${message}\n`);
  }
}

const configPath = process.argv[2] || '/app/config.json';
debugLog(`Using config path: ${configPath}`);

// Dangerous environment variables that should never be set
const DANGEROUS_VARS = new Set([
  'PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'LD_AUDIT',
  'BASH_ENV', 'ENV', 'CDPATH', 'IFS', 'PS1', 'PS2', 'PS3', 'PS4',
  'SHELL', 'BASH_FUNC', 'SHELLOPTS', 'GLOBIGNORE',
  'PERL5LIB', 'PYTHONPATH', 'NODE_PATH', 'RUBYLIB'
]);

/**
 * Sanitize a key name for use as environment variable
 * Converts to uppercase and replaces invalid chars with underscore
 */
function sanitizeKey(key) {
  // Convert to string and handle edge cases
  const keyStr = String(key || '').trim();
  
  if (!keyStr) {
    return 'EMPTY_KEY';
  }
  
  // Special handling for NODE_DB_PATH to preserve exact casing
  if (keyStr === 'NODE_DB_PATH') {
    return 'NODE_DB_PATH';
  }
  
  const sanitized = keyStr
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') // Trim underscores
    .replace(/^(\d)/, '_$1'); // Prefix with _ if starts with number
  
  // If sanitization results in empty string, use a default
  return sanitized || 'EMPTY_KEY';
}

/**
 * Safely quote a string for shell use
 * This follows POSIX shell quoting rules
 */
function shellQuote(str) {
  // Remove null bytes which are not allowed in environment variables
  str = str.replace(/\x00/g, '');
  
  // Always use single quotes for consistency and safety
  // Single quotes protect everything except other single quotes
  return "'" + str.replace(/'/g, "'\"'\"'") + "'";
}

try {
  if (!fs.existsSync(configPath)) {
    debugLog(`Config file not found at: ${configPath}`);
    process.exit(0); // Silent exit if no config file
  }

  let configContent;
  let config;
  
  try {
    configContent = fs.readFileSync(configPath, 'utf8');
    debugLog(`Read config file, size: ${configContent.length} bytes`);
  } catch (readError) {
    // Silent exit on read errors
    debugLog(`Error reading config: ${readError.message}`);
    process.exit(0);
  }
  
  try {
    config = JSON.parse(configContent);
    debugLog(`Parsed config with ${Object.keys(config).length} top-level keys`);
  } catch (parseError) {
    // Silent exit on invalid JSON
    debugLog(`Error parsing JSON: ${parseError.message}`);
    process.exit(0);
  }
  
  // Validate config is an object
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    // Silent exit on invalid config structure
    process.exit(0);
  }
  
  // Convert nested objects to flat environment variables
  const flattenConfig = (obj, prefix = '', depth = 0) => {
    const result = {};
    
    // Prevent infinite recursion
    if (depth > 10) {
      return result;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeKey(key);
      
      // Skip if sanitization resulted in EMPTY_KEY (indicating invalid key)
      if (sanitizedKey === 'EMPTY_KEY') {
        debugLog(`Skipping key '${key}': invalid key name`);
        continue;
      }
      
      const envKey = prefix ? `${prefix}_${sanitizedKey}` : sanitizedKey;
      
      // Skip if key is too long
      if (envKey.length > 255) {
        debugLog(`Skipping key '${envKey}': too long (${envKey.length} chars)`);
        continue;
      }
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, flattenConfig(value, envKey, depth + 1));
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        // Only include if not already set in environment
        if (!process.env[envKey]) {
          let stringValue = String(value);
          
          // Handle special JavaScript number values
          if (typeof value === 'number') {
            if (!isFinite(value)) {
              if (value === Infinity) {
                stringValue = 'Infinity';
              } else if (value === -Infinity) {
                stringValue = '-Infinity';
              } else if (isNaN(value)) {
                stringValue = 'NaN';
              }
            }
          }
          
          // Skip if value is too long
          if (stringValue.length <= 32768) {
            result[envKey] = stringValue;
          }
        }
      }
    }
    
    return result;
  };
  
  // Output shell-safe export commands
  const flattened = flattenConfig(config);
  const exports = [];
  
  for (const [key, value] of Object.entries(flattened)) {
    // Validate key name (alphanumeric and underscore only)
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      continue; // Skip invalid variable names
    }
    
    // Skip dangerous variables
    if (DANGEROUS_VARS.has(key) || key.startsWith('BASH_FUNC_')) {
      debugLog(`Warning: Ignoring dangerous variable: ${key}`);
      process.stderr.write(`Warning: Ignoring dangerous variable: ${key}\n`);
      continue;
    }
    
    // Safely quote the value
    const quotedValue = shellQuote(value);
    exports.push(`export ${key}=${quotedValue}`);
  }
  
  // Use process.stdout.write to ensure output goes to stdout
  if (exports.length > 0) {
    process.stdout.write(exports.join('\n') + '\n');
  }
  
} catch (error) {
  // Silent fail - don't break the container startup
  process.exit(0);
}
```

### Core Architecture Module: `examples/enhanced-documentation-demo.js`
```
#!/usr/bin/env node

const { DocumentationFetcher } = require('../dist/utils/documentation-fetcher');

async function demonstrateEnhancedDocumentation() {
  console.log('🎯 Enhanced Documentation Demo\n');
  
  const fetcher = new DocumentationFetcher();
  const nodeType = 'n8n-nodes-base.slack';
  
  console.log(`Fetching enhanced documentation for: ${nodeType}\n`);
  
  try {
    const doc = await fetcher.getEnhancedNodeDocumentation(nodeType);
    
    if (!doc) {
      console.log('No documentation found for this node.');
      return;
    }
    
    // Display title and description
    console.log('📄 Basic Information:');
    console.log(`Title: ${doc.title || 'N/A'}`);
    console.log(`URL: ${doc.url}`);
    console.log(`Description: ${doc.description || 'See documentation for details'}\n`);
    
    // Display operations
    if (doc.operations && doc.operations.length > 0) {
      console.log('⚙️  Available Operations:');
      // Group by resource
      const resourceMap = new Map();
      doc.operations.forEach(op => {
        if (!resourceMap.has(op.resource)) {
          resourceMap.set(op.resource, []);
        }
        resourceMap.get(op.resource).push(op);
      });
      
      resourceMap.forEach((ops, resource) => {
        console.log(`\n  ${resource}:`);
        ops.forEach(op => {
          console.log(`    - ${op.operation}: ${op.description}`);
        });
      });
      console.log('');
    }
    
    // Display API methods
    if (doc.apiMethods && doc.apiMethods.length > 0) {
      console.log('🔌 API Method Mappings (first 5):');
      doc.apiMethods.slice(0, 5).forEach(method => {
        console.log(`  ${method.resource}.${method.operation} → ${method.apiMethod}`);
        if (method.apiUrl) {
          console.log(`    Documentation: ${method.apiUrl}`);
        }
      });
      console.log(`  ... and ${Math.max(0, doc.apiMethods.length - 5)} more\n`);
    }
    
    // Display templates
    if (doc.templates && doc.templates.length > 0) {
      console.log('📋 Available Templates:');
      doc.templates.forEach(template => {
        console.log(`  - ${template.name}`);
        if (template.description) {
          console.log(`    ${template.description}`);
        }
      });
      console.log('');
    }
    
    // Display related resources
    if (doc.relatedResources && doc.relatedResources.length > 0) {
      console.log('🔗 Related Resources:');
      doc.relatedResources.forEach(resource => {
        console.log(`  - ${resource.title} (${resource.type})`);
        console.log(`    ${resource.url}`);
      });
      console.log('');
    }
    
    // Display required scopes
    if (doc.requiredScopes && doc.requiredScopes.length > 0) {
      console.log('🔐 Required Scopes:');
      doc.requiredScopes.forEach(scope => {
        console.log(`  - ${scope}`);
      });
      console.log('');
    }
    
    // Display summary
    console.log('📊 Summary:');
    console.log(`  - Total operations: ${doc.operations?.length || 0}`);
    console.log(`  - Total API methods: ${doc.apiMethods?.length || 0}`);
    console.log(`  - Code examples: ${doc.examples?.length || 0}`);
    console.log(`  - Templates: ${doc.templates?.length || 0}`);
    console.log(`  - Related resources: ${doc.relatedResources?.length || 0}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await fetcher.cleanup();
  }
}

// Run demo
demonstrateEnhancedDocumentation().catch(console.error);
```

### Core Architecture Module: `scripts/audit-schema-coverage.ts`
```
/**
 * Database Schema Coverage Audit Script
 *
 * Audits the database to determine how many nodes have complete schema information
 * for resourceLocator mode validation. This helps assess the coverage of our
 * schema-driven validation approach.
 *
 * properties_schema is stored gzip-compressed (see src/database/compressed-column.ts),
 * so the rows are decoded here instead of matched with SQL LIKE.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { decompressColumnJson } from '../src/database/compressed-column';

const dbPath = path.join(__dirname, '../data/nodes.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== Schema Coverage Audit ===\n');

type NodeRow = { node_type: string; display_name: string; properties_schema: string | null };

const rows = db
  .prepare('SELECT node_type, display_name, properties_schema FROM nodes')
  .all() as NodeRow[];

// Inflate each schema once and match on its JSON text, the way the SQL LIKE predicates used to.
const nodes = rows.map(row => ({
  nodeType: row.node_type,
  displayName: row.display_name,
  schema: JSON.stringify(decompressColumnJson(row.properties_schema ?? '[]', [])),
}));

const resourceLocatorNodes = nodes.filter(node => node.schema.includes('resourceLocator'));
const withModes = resourceLocatorNodes.filter(node => node.schema.includes('modes'));
const withoutModes = resourceLocatorNodes.filter(node => !node.schema.includes('modes'));

console.log(`Nodes with resourceLocator properties: ${resourceLocatorNodes.length}`);
console.log(`Nodes with modes defined: ${withModes.length}`);

console.log(`\nSample nodes WITHOUT modes (showing 10):`);
withoutModes.slice(0, 10).forEach(node => {
  console.log(`  - ${node.displayName} (${node.nodeType})`);
});

// Calculate coverage percentage
const coverage = resourceLocatorNodes.length > 0
  ? (withModes.length / resourceLocatorNodes.length) * 100
  : 0;

console.log(`\nSchema coverage: ${coverage.toFixed(1)}% of resourceLocator nodes have modes defined`);

console.log('\nSample nodes WITH modes (showing 5):');
withModes.slice(0, 5).forEach(node => {
  console.log(`  - ${node.displayName} (${node.nodeType})`);
});

// Summary
console.log('\n=== Summary ===');
console.log(`Total nodes in database: ${rows.length}`);
console.log(`Nodes with resourceLocator: ${resourceLocatorNodes.length}`);
console.log(`Nodes with complete mode schemas: ${withModes.length}`);
console.log(`Nodes without mode schemas: ${withoutModes.length}`);
console.log(`\nImplication: Schema-driven validation will apply to ${withModes.length} nodes.`);
console.log(`For the remaining ${withoutModes.length} nodes, validation will be skipped (graceful degradation).`);

db.close();

```

### Core Architecture Module: `scripts/check-settings-drift.ts`
```
#!/usr/bin/env npx tsx
/**
 * Compare src/constants/workflow-settings.ts against the workflowSettings schema n8n ships in
 * its published package, and fail if they disagree.
 *
 * n8n adds settings properties in most minor releases. Our list trailed by five properties for
 * two months before anyone noticed, and one of them (redactionPolicy) controls whether
 * execution data is redacted. `npm run update:n8n` runs this so an n8n bump that changes the
 * schema stops rather than shipping a stale list.
 *
 * Usage:
 *   npx tsx scripts/check-settings-drift.ts            # version from package.json
 *   npx tsx scripts/check-settings-drift.ts 2.34.4     # explicit n8n version
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as ts from 'typescript';
import {
  WORKFLOW_SETTINGS_PROPERTIES,
  type SettingsVersion,
} from '../src/constants/workflow-settings';
import { WRITABLE_NODE_PROPERTIES } from '../src/services/n8n-validation';

const SCHEMA_PATH = 'dist/public-api/v1/openapi.yml';
const SCHEMA_NAME = 'workflowSettings';
/** The node schema is `additionalProperties: false` too; cleanNodeForApi strips to WRITABLE_NODE_PROPERTIES. */
const NODE_SCHEMA_NAME = 'node';
const ENTITY_INTERFACE = 'IWorkflowSettings';

function resolveVersion(): string {
  const fromArgs = process.argv[2];
  if (fromArgs) return fromArgs.replace(/^v/, '');

  // The n8n CLI package and n8n-nodes-base share a release train, so the pinned node package
  // names the n8n release whose schema we must match.
  const pkg = require('../package.json');
  const pinned = pkg.dependencies?.['n8n-nodes-base'];
  if (!pinned) {
    throw new Error('n8n-nodes-base is not a dependency - pass an n8n version explicitly');
  }
  return pinned.replace(/^[^0-9]*/, '');
}

async function fetchSchemaFile(version: string): Promise<string> {
  const url = `https://unpkg.com/n8n@${version}/${SCHEMA_PATH}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${url} (HTTP ${response.status}). ` +
        'If n8n moved or renamed its bundled OpenAPI spec, update SCHEMA_PATH in this script.'
    );
  }
  return response.text();
}

function parseVersion(version: string): SettingsVersion {
  const [major, minor, patch] = version.split('.').map(part => parseInt(part, 10) || 0);
  return { major, minor, patch };
}

function compareVersions(a: SettingsVersion, b: SettingsVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

const indentOf = (line: string): number => line.length - line.trimStart().length;

/**
 * Pull the property names out of `components.schemas.workflowSettings.properties`.
 *
 * Indentation is measured rather than assumed, so a reformatted spec still parses; anything
 * this cannot find throws, which is the point - a silently empty result would read as "no
 * drift".
 */
export function parseSchemaProperties(
  yaml: string,
  schemaName = SCHEMA_NAME,
  readOnly?: Set<string>
): Set<string> {
  const lines = yaml.split('\n');

  const schemaIndex = lines.findIndex(line => new RegExp(`^\\s+${schemaName}:\\s*$`).test(line));
  if (schemaIndex === -1) {
    throw new Error(
      `No "${schemaName}:" schema in ${SCHEMA_PATH}. n8n may have renamed it - check the spec.`
    );
  }
  const schemaIndent = indentOf(lines[schemaIndex]);

  let propertiesIndex = -1;
  for (let i = schemaIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (indentOf(line) <= schemaIndent) break; // left the schema without finding properties
    // Any depth below the schema, so the step size is not assumed. The schema's own
    // `properties:` is the first one inside it; a nested one always comes later.
    if (line.trim() === 'properties:') {
      propertiesIndex = i;
      break;
    }
  }
  if (propertiesIndex === -1) {
    throw new Error(`"${schemaName}" has no properties block in ${SCHEMA_PATH}`);
  }

  const propertiesIndent = indentOf(lines[propertiesIndex]);
  const names = new Set<string>();
  let keyIndent: number | null = null;
  let current: string | null = null;
  let readOnlyIndent: number | null = null;

  for (let i = propertiesIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const indent = indentOf(line);
    if (indent <= propertiesIndent) break;

    if (keyIndent === null) keyIndent = indent;
    if (indent !== keyIndent) {
      // Directly under the property above, `readOnly: true` marks a GET-only property. Deeper
      // lines belong to a sub-schema and say nothing about the property itself.
      if (current && indent > keyIndent && line.trim() === 'readOnly: true' && readOnlyIndent === indent) {
        readOnly?.add(current);
      }
      continue;
    }

    const match = line.trim().match(/^([A-Za-z][A-Za-z0-9_]*):/);
    current = match ? match[1] : null;
    if (match) names.add(match[1]);
    // The property's own attributes sit one level in; measured from the next line, not assumed.
    readOnlyIndent = lines.slice(i + 1).find(next => next.trim() !== '')?.match(/^\s*/)?.[0].length ?? null;
  }

  if (names.size === 0) {
    throw new Error(`Parsed zero properties from "${schemaName}" - the spec format changed`);
  }
  return names;
}

/**
 * Node-level drift: properties the node write schema accepts that cleanNodeForApi would strip,
 * and properties we send that the schema no longer lists. Read-only ones (createdAt, updatedAt)
 * are rejected on write, so stripping them is correct and they are not reported.
 */
export function diffNodeProperties(yaml: string): { missing: string[]; removed: string[] } {
  const readOnly = new Set<string>();
  const schema = parseSchemaProperties(yaml, NODE_SCHEMA_NAME, readOnly);
  return {
    missing: [...schema].filter(name => !readOnly.has(name) && !WRITABLE_NODE_PROPERTIES.has(name)),
    removed: [...WRITABLE_NODE_PROPERTIES].filter(name => !schema.has(name)),
  };
}

/**
 * Pull the property names out of n8n-workflow's `IWorkflowSettings` declaration - the workflow
 * entity's settings type, which the Public API schema is supposed to mirror but has trailed
 * (engineType, issue #1043). Parsed with the real TypeScript parser: review kept finding ways
 * a hand-rolled lexer silently under-reports (comments, string types, inline braces), and a
 * missed property here reads as "no entity-only properties" - the one failure mode this check
 * must never have. Anything the walk cannot fully enumerate throws.
 */
export function parseEntitySettingsProperties(dts: string): Set<string> {
  const source = ts.createSourceFile('interfaces.d.ts', dts, ts.ScriptTarget.Latest);

  // createSourceFile recovers from syntax errors, so a truncated file (missing brace,
  // unterminated string) would yield a PARTIAL property set - reject anything that does not
  // parse cleanly. parseDiagnostics is internal API, so its disappearance must also throw
  // rather than quietly skipping the syntax gate.
  const diagnostics = (source as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (!Array.isArray(diagnostics)) {
    throw new Error(
      'TypeScript no longer exposes parseDiagnostics on SourceFile - rework this check to get ' +
        'syntax diagnostics from a Program before trusting the parse.'
    );
  }
  if (diagnostics.length > 0) {
    throw new Error(
      `n8n-workflow's declarations do not parse cleanly (` +
        `${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, ' ')}) - a partial ` +
        'parse would under-report properties.'
    );
  }

  // Top-level statements only: a same-named interface inside a namespace or module does not
  // merge with the export this check is after.
  const declarations = source.statements.filter(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(
```

### Core Architecture Module: `scripts/export-webhook-workflows.ts`
```
#!/usr/bin/env tsx

/**
 * Export Webhook Workflow JSONs
 *
 * Generates the 4 webhook workflow JSON files needed for integration testing.
 * These workflows must be imported into n8n and activated manually.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { exportAllWebhookWorkflows } from '../tests/integration/n8n-api/utils/webhook-workflows';

const OUTPUT_DIR = join(process.cwd(), 'workflows-for-import');

// Create output directory
mkdirSync(OUTPUT_DIR, { recursive: true });

// Generate all workflow JSONs
const workflows = exportAllWebhookWorkflows();

// Write each workflow to a separate file
Object.entries(workflows).forEach(([method, workflow]) => {
  const filename = `webhook-${method.toLowerCase()}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  writeFileSync(filepath, JSON.stringify(workflow, null, 2), 'utf-8');

  console.log(`✓ Generated: ${filename}`);
});

console.log(`\n✓ All workflow JSONs written to: ${OUTPUT_DIR}`);
console.log('\nNext steps:');
console.log('1. Import each JSON file into your n8n instance');
console.log('2. Activate each workflow in the n8n UI');
console.log('3. Copy the webhook URLs from each workflow (open workflow → Webhook node → copy URL)');
console.log('4. Add them to your .env file:');
console.log('   N8N_TEST_WEBHOOK_GET_URL=https://your-n8n.com/webhook/mcp-test-get');
console.log('   N8N_TEST_WEBHOOK_POST_URL=https://your-n8n.com/webhook/mcp-test-post');
console.log('   N8N_TEST_WEBHOOK_PUT_URL=https://your-n8n.com/webhook/mcp-test-put');
console.log('   N8N_TEST_WEBHOOK_DELETE_URL=https://your-n8n.com/webhook/mcp-test-delete');

```

### Core Architecture Module: `scripts/extract-changelog.js`
```
#!/usr/bin/env node

/**
 * Extract changelog content for a specific version
 * Used by GitHub Actions to extract release notes
 */

const fs = require('fs');
const path = require('path');

function extractChangelog(version, changelogPath) {
  try {
    if (!fs.existsSync(changelogPath)) {
      console.error(`Changelog file not found at ${changelogPath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(changelogPath, 'utf8');
    const lines = content.split('\n');
    
    // Find the start of this version's section
    const versionHeaderRegex = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`);
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (versionHeaderRegex.test(lines[i])) {
        startIndex = i;
        break;
      }
    }
    
    if (startIndex === -1) {
      console.error(`No changelog entries found for version ${version}`);
      process.exit(1);
    }
    
    // Find the end of this version's section (next version or end of file)
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## [') && !lines[i].includes('Unreleased')) {
        endIndex = i;
        break;
      }
    }
    
    if (endIndex === -1) {
      endIndex = lines.length;
    }
    
    // Extract the section content
    const sectionLines = lines.slice(startIndex, endIndex);
    
    // Remove the version header and any trailing empty lines
    let contentLines = sectionLines.slice(1);
    while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === '') {
      contentLines.pop();
    }
    
    if (contentLines.length === 0) {
      console.error(`No content found for version ${version}`);
      process.exit(1);
    }
    
    const releaseNotes = contentLines.join('\n').trim();
    
    // Write to stdout for GitHub Actions
    console.log(releaseNotes);
    
  } catch (error) {
    console.error(`Error extracting changelog: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const version = process.argv[2];
const changelogPath = process.argv[3];

if (!version || !changelogPath) {
  console.error('Usage: extract-changelog.js <version> <changelog-path>');
  process.exit(1);
}

extractChangelog(version, changelogPath);
```

### Core Architecture Module: `scripts/extract-from-docker.js`
```
#!/usr/bin/env node
const dotenv = require('dotenv');
const { NodeDocumentationService } = require('../dist/services/node-documentation-service');
const { NodeSourceExtractor } = require('../dist/utils/node-source-extractor');
const { logger } = require('../dist/utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
dotenv.config();

async function extractNodesFromDocker() {
  logger.info('🐳 Starting Docker-based node extraction...');
  
  // Add Docker volume paths to environment for NodeSourceExtractor
  const dockerVolumePaths = [
    process.env.N8N_MODULES_PATH || '/n8n-modules',
    process.env.N8N_CUSTOM_PATH || '/n8n-custom',
  ];
  
  logger.info(`Docker volume paths: ${dockerVolumePaths.join(', ')}`);
  
  // Check if volumes are mounted
  for (const volumePath of dockerVolumePaths) {
    try {
      await fs.access(volumePath);
      logger.info(`✅ Volume mounted: ${volumePath}`);
      
      // List what's in the volume
      const entries = await fs.readdir(volumePath);
      logger.info(`Contents of ${volumePath}: ${entries.slice(0, 10).join(', ')}${entries.length > 10 ? '...' : ''}`);
    } catch (error) {
      logger.warn(`❌ Volume not accessible: ${volumePath}`);
    }
  }
  
  // Initialize services
  const docService = new NodeDocumentationService();
  const extractor = new NodeSourceExtractor();
  
  // Extend the extractor's search paths with Docker volumes
  extractor.n8nBasePaths.unshift(...dockerVolumePaths);
  
  // Clear existing nodes to ensure we only have latest versions
  logger.info('🧹 Clearing existing nodes...');
  const db = docService.db;
  db.prepare('DELETE FROM nodes').run();
  
  logger.info('🔍 Searching for n8n nodes in Docker volumes...');
  
  // Known n8n packages to extract
  const n8nPackages = [
    'n8n-nodes-base',
    '@n8n/n8n-nodes-langchain',
    'n8n-nodes-extras',
  ];
  
  let totalExtracted = 0;
  let ifNodeVersion = null;
  
  for (const packageName of n8nPackages) {
    logger.info(`\n📦 Processing package: ${packageName}`);
    
    try {
      // Find package in Docker volumes
      let packagePath = null;
      
      for (const volumePath of dockerVolumePaths) {
        const possiblePaths = [
          path.join(volumePath, packageName),
          path.join(volumePath, '.pnpm', `${packageName}@*`, 'node_modules', packageName),
        ];
        
        for (const testPath of possiblePaths) {
          try {
            // Use glob pattern to find pnpm packages
            if (testPath.includes('*')) {
              const baseDir = path.dirname(testPath.split('*')[0]);
              const entries = await fs.readdir(baseDir);
              
              for (const entry of entries) {
                if (entry.includes(packageName.replace('/', '+'))) {
                  const fullPath = path.join(baseDir, entry, 'node_modules', packageName);
                  try {
                    await fs.access(fullPath);
                    packagePath = fullPath;
                    break;
                  } catch {}
                }
              }
            } else {
              await fs.access(testPath);
              packagePath = testPath;
              break;
            }
          } catch {}
        }
        
        if (packagePath) break;
      }
      
      if (!packagePath) {
        logger.warn(`Package ${packageName} not found in Docker volumes`);
        continue;
      }
      
      logger.info(`Found package at: ${packagePath}`);
      
      // Check package version
      try {
        const packageJsonPath = path.join(packagePath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        logger.info(`Package version: ${packageJson.version}`);
      } catch {}
      
      // Find nodes directory
      const nodesPath = path.join(packagePath, 'dist', 'nodes');
      
      try {
        await fs.access(nodesPath);
        logger.info(`Scanning nodes directory: ${nodesPath}`);
        
        // Extract all nodes from this package
        const nodeEntries = await scanForNodes(nodesPath);
        logger.info(`Found ${nodeEntries.length} nodes in ${packageName}`);
        
        for (const nodeEntry of nodeEntries) {
          try {
            const nodeName = nodeEntry.name.replace('.node.js', '');
            const nodeType = `${packageName}.${nodeName}`;
            
            logger.info(`Extracting: ${nodeType}`);
            
            // Extract source info
            const sourceInfo = await extractor.extractNodeSource(nodeType);
            
            // Check if this is the If node
            if (nodeName === 'If') {
              // Look for version in the source code
              const versionMatch = sourceInfo.sourceCode.match(/version:\s*(\d+)/);
              if (versionMatch) {
                ifNodeVersion = versionMatch[1];
                logger.info(`📍 Found If node version: ${ifNodeVersion}`);
              }
            }
            
            // Store in database
            await docService.storeNode({
              nodeType: nodeType,
              name: nodeName,
              displayName: nodeName,
              description: `${nodeName} node from ${packageName}`,
              sourceCode: sourceInfo.sourceCode,
              credentialCode: sourceInfo.credentialCode,
              packageName: packageName,
              version: ifNodeVersion || '1',
              hasCredentials: !!sourceInfo.credentialCode,
              isTrigger: sourceInfo.sourceCode.includes('trigger: true') || nodeName.toLowerCase().includes('trigger'),
              isWebhook: sourceInfo.sourceCode.includes('webhook: true') || nodeName.toLowerCase().includes('webhook'),
            });
            
            totalExtracted++;
          } catch (error) {
            logger.error(`Failed to extract ${nodeEntry.name}: ${error}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to scan nodes directory: ${error}`);
      }
    } catch (error) {
      logger.error(`Failed to process package ${packageName}: ${error}`);
    }
  }
  
  logger.info(`\n✅ Extraction complete!`);
  logger.info(`📊 Total nodes extracted: ${totalExtracted}`);
  
  if (ifNodeVersion) {
    logger.info(`📍 If node version: ${ifNodeVersion}`);
    if (ifNodeVersion === '2' || ifNodeVersion === '2.2') {
      logger.info('✅ Successfully extracted latest If node (v2+)!');
    } else {
      logger.warn(`⚠️ If node version is ${ifNodeVersion}, expected v2 or higher`);
    }
  }
  
  // Close database
  docService.close();
}

async function scanForNodes(dirPath) {
  const nodes = [];
  
  async function scan(currentPath) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isFile() && entry.name.endsWith('.node.js')) {
          nodes.push({ name: entry.name, path: fullPath });
        } else if (entry.isDirectory() && entry.name !== 'node_modules') {
          await scan(fullPath);
        }
      }
    } catch (error) {
      logger.debug(`Failed to scan directory ${currentPath}: ${error}`);
    }
  }
  
  await scan(dirPath);
  return nodes;
}

// Run extraction
extractNodesFromDocker().catch(error => {
  logger.error('Extraction failed:', error);
  process.exit(1);
});
```

### Core Architecture Module: `scripts/generate-detailed-reports.js`
```
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Generate detailed test reports in multiple formats
 */
class TestReportGenerator {
  constructor() {
    this.results = {
      tests: null,
      coverage: null,
      benchmarks: null,
      metadata: {
        timestamp: new Date().toISOString(),
        repository: process.env.GITHUB_REPOSITORY || 'n8n-mcp',
        sha: process.env.GITHUB_SHA || 'unknown',
        branch: process.env.GITHUB_REF || 'unknown',
        runId: process.env.GITHUB_RUN_ID || 'local',
        runNumber: process.env.GITHUB_RUN_NUMBER || '0',
      }
    };
  }

  loadTestResults() {
    const testResultPath = resolve(process.cwd(), 'test-results/results.json');
    if (existsSync(testResultPath)) {
      try {
        const data = JSON.parse(readFileSync(testResultPath, 'utf-8'));
        this.results.tests = this.processTestResults(data);
      } catch (error) {
        console.error('Error loading test results:', error);
      }
    }
  }

  processTestResults(data) {
    const processedResults = {
      summary: {
        total: data.numTotalTests || 0,
        passed: data.numPassedTests || 0,
        failed: data.numFailedTests || 0,
        skipped: data.numSkippedTests || 0,
        duration: data.duration || 0,
        success: (data.numFailedTests || 0) === 0
      },
      testSuites: [],
      failedTests: []
    };

    // Process test suites
    if (data.testResults) {
      for (const suite of data.testResults) {
        const suiteInfo = {
          name: suite.name,
          duration: suite.duration || 0,
          tests: {
            total: suite.numPassingTests + suite.numFailingTests + suite.numPendingTests,
            passed: suite.numPassingTests || 0,
            failed: suite.numFailingTests || 0,
            skipped: suite.numPendingTests || 0
          },
          status: suite.numFailingTests === 0 ? 'passed' : 'failed'
        };

        processedResults.testSuites.push(suiteInfo);

        // Collect failed tests
        if (suite.testResults) {
          for (const test of suite.testResults) {
            if (test.status === 'failed') {
              processedResults.failedTests.push({
                suite: suite.name,
                test: test.title,
                duration: test.duration || 0,
                error: test.failureMessages ? test.failureMessages.join('\n') : 'Unknown error'
              });
            }
          }
        }
      }
    }

    return processedResults;
  }

  loadCoverageResults() {
    const coveragePath = resolve(process.cwd(), 'coverage/coverage-summary.json');
    if (existsSync(coveragePath)) {
      try {
        const data = JSON.parse(readFileSync(coveragePath, 'utf-8'));
        this.results.coverage = this.processCoverageResults(data);
      } catch (error) {
        console.error('Error loading coverage results:', error);
      }
    }
  }

  processCoverageResults(data) {
    const coverage = {
      summary: {
        lines: data.total.lines.pct,
        statements: data.total.statements.pct,
        functions: data.total.functions.pct,
        branches: data.total.branches.pct,
        average: 0
      },
      files: []
    };

    // Calculate average
    coverage.summary.average = (
      coverage.summary.lines +
      coverage.summary.statements +
      coverage.summary.functions +
      coverage.summary.branches
    ) / 4;

    // Process file coverage
    for (const [filePath, fileData] of Object.entries(data)) {
      if (filePath !== 'total') {
        coverage.files.push({
          path: filePath,
          lines: fileData.lines.pct,
          statements: fileData.statements.pct,
          functions: fileData.functions.pct,
          branches: fileData.branches.pct,
          uncoveredLines: fileData.lines.total - fileData.lines.covered
        });
      }
    }

    // Sort files by coverage (lowest first)
    coverage.files.sort((a, b) => a.lines - b.lines);

    return coverage;
  }

  loadBenchmarkResults() {
    const benchmarkPath = resolve(process.cwd(), 'benchmark-results.json');
    if (existsSync(benchmarkPath)) {
      try {
        const data = JSON.parse(readFileSync(benchmarkPath, 'utf-8'));
        this.results.benchmarks = this.processBenchmarkResults(data);
      } catch (error) {
        console.error('Error loading benchmark results:', error);
      }
    }
  }

  processBenchmarkResults(data) {
    const benchmarks = {
      timestamp: data.timestamp,
      results: []
    };

    for (const file of data.files || []) {
      for (const group of file.groups || []) {
        for (const benchmark of group.benchmarks || []) {
          benchmarks.results.push({
            file: file.filepath,
            group: group.name,
            name: benchmark.name,
            ops: benchmark.result.hz,
            mean: benchmark.result.mean,
            min: benchmark.result.min,
            max: benchmark.result.max,
            p75: benchmark.result.p75,
            p99: benchmark.result.p99,
            samples: benchmark.result.samples
          });
        }
      }
    }

    // Sort by ops/sec (highest first)
    benchmarks.results.sort((a, b) => b.ops - a.ops);

    return benchmarks;
  }

  generateMarkdownReport() {
    let report = '# n8n-mcp Test Report\n\n';
    report += `Generated: ${this.results.metadata.timestamp}\n\n`;
    
    // Metadata
    report += '## Build Information\n\n';
    report += `- **Repository**: ${this.results.metadata.repository}\n`;
    report += `- **Commit**: ${this.results.metadata.sha.substring(0, 7)}\n`;
    report += `- **Branch**: ${this.results.metadata.branch}\n`;
    report += `- **Run**: #${this.results.metadata.runNumber}\n\n`;

    // Test Results
    if (this.results.tests) {
      const { summary, testSuites, failedTests } = this.results.tests;
      const emoji = summary.success ? '✅' : '❌';
      
      report += `## ${emoji} Test Results\n\n`;
      report += `### Summary\n\n`;
      report += `- **Total Tests**: ${summary.total}\n`;
      report += `- **Passed**: ${summary.passed} (${((summary.passed / summary.total) * 100).toFixed(1)}%)\n`;
      report += `- **Failed**: ${summary.failed}\n`;
      report += `- **Skipped**: ${summary.skipped}\n`;
      report += `- **Duration**: ${(summary.duration / 1000).toFixed(2)}s\n\n`;

      // Test Suites
      if (testSuites.length > 0) {
        report += '### Test Suites\n\n';
        report += '| Suite | Status | Tests | Duration |\n';
        report += '|-------|--------|-------|----------|\n';
        
        for (const suite of testSuites) {
          const status = suite.status === 'passed' ? '✅' : '❌';
          const tests = `${suite.tests.passed}/${suite.tests.total}`;
          const duration = `${(suite.duration / 1000).toFixed(2)}s`;
          report += `| ${suite.name} | ${status} | ${tests} | ${duration} |\n`;
        }
        report += '\n';
      }

      // Failed Tests
      if (failedTests.length > 0) {
        report += '### Failed Tests\n\n';
        for (const failed of failedTests) {
          report += `#### ${failed.suite} > ${failed.test}\n\n`;
          report += '```\n';
          report += failed.error;
          report += '\n```\n\n';
        }
      }
    }

    // Coverage Results
    if (this.results.coverage) {
      const { summary, files } = this.results.coverage;
      const emoji = summary.average >= 80 ? '✅' : summary.average >= 60 ? '⚠️' : '❌';
      
      report += `## ${emoji} Coverage Report\n\n`;
      report += '### Summary\n\n';
      report += `- **Lines**: ${summary.lines.toFixed(2)}%\n`;
      report += `- **Statements**: ${summary.statements.toFixed(2)}%\n`;
      report += `- **Functions**: ${summary.functions.toFixed(2)}%\n`;
      report += `- **Branches**: ${summary.branches.toFixed(2)}%\n`;
      report += `- **Average**: ${summary.average.toFixed(2)}%\n\n`;

      // Fi
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1119** (2026-09-16): **N8nApiClient source control methods do not match the n8n 2.39 Public API**
  *Symptoms*: ## Problem  n8n 2.39 added `GET /source-control/status` and `POST /source-control/push` to the Public API; neither is in the 2.38.5 spec. `N8nApiClient` already has methods for both, but their requests do not match the new contract.  **`getSourceControlStatus()`** ([n8n-api-client.ts:1474](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/n8n-api-client.ts#L1474)) sends no query parameters. The 2.39.6 spec requires `direction`:  ```yaml parameters:   - name: direction     in: query     required: true     schema: { type: string, enum: [push, pull] } ```  **`pushSourceControl(message, fileNames?: string[])`** ([n8n-api-client.ts:1492](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/n8n-api-client.ts#L1492)) sends `{ message, fileNames }`. The 2.39.6 spec requires this body:  ```yaml required: [commitMessage, fileNames] properties:   commitMessage: string   force: boolean   fileNames:     type: array     items:       required: [id, type]       properties:         id: { type: string, minLength: 1 }         type: { enum: [credential, workflow, tags, variables, file, folders, project, datatable] } ```  Both calls would answer 400. The `SourceControlStatus` and `SourceControlPushResult` types in `src/types/n8n-api.ts` should be checked against the 2.39 response DTOs as well.  `pullSourceControl(force)` sends `{ force }`, which is still valid. The 2.39 pull body also accepts `autoPublish

- **Issue #1118** (2026-09-16): **n8n_update_partial_workflow: misleading error after n8n 2.39 refuses to publish on save**
  *Symptoms*: ## Problem  Since n8n 2.39, saving a published workflow through `PUT /workflows/{id}` re-publishes it only if the caller may publish. The caller needs both:  - the `workflow:activate` API key scope - the `workflow:publish` permission on the workflow  Without either, n8n saves the change as a draft, keeps the published version live, and returns **403**:  ```json {   "message": "Your change was saved as a draft. It wasn't published because this API key does not have the workflow:activate scope.",   "reason": "insufficient_api_key_scope",   "versionId": "<id of the draft just saved>" } ```  `reason` can also be `insufficient_permissions`. On the n8n side this comes from `WorkflowService.assertMayPublishOnSave` and `WorkflowPublishForbiddenError`, both added in 2.39.  ## What n8n-mcp does today  This is from reading the code, not from a live run. A test needs a key with narrowed scopes or a user who may edit but not publish.  **`n8n_update_partial_workflow`** ([handlers-workflow-diff.ts:417-535](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/mcp/handlers-workflow-diff.ts#L417-L535)):  1. The PUT fails with 403. 2. The follow-up GET shows a new `versionId` (the draft), so `compareVersions` returns `changed` and the handler rolls back. 3. The rollback PUT also re-publishes, so n8n answers 403 again after persisting it. `sameWritableContent` then confirms the restore, which sets `rollbackPerformed: true` and `rollbackVerifiedAfterError: true

- **Issue #1115** (2026-09-16): **"Possible missing $ prefix" warning fires on words inside string literals, e.g. JMESPath queries over .all() items**
  *Symptoms*: ## Summary  The expression warning **"Possible missing $ prefix for variable (e.g., use $json instead of json)"** fires on the words `json`/`node`/`input`/`items`/`workflow`/`execution` inside **string literals**. The idiomatic case is a JMESPath query over `.all()` items, which must say `json.` because each item is a `{json: …}` wrapper.  ## Reproduction  ``` {{ $jmespath($('Split Customers').all(), "[?json.country=='PL'].json.name") }} ```  → `Expression warning: … Possible missing $ prefix for variable (e.g., use $json instead of json)`  The expression is correct (verified on n8n 2.38.5 → `["Acme","Bar"]`). Following the hint (`$json.country`) or dropping the prefix returns `[]` silently.  ## Where  [`src/services/expression-validator.ts#L221`](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/expression-validator.ts#L221):  ```ts const missingPrefixPattern = /(?<![.$\w['])\b(json|node|input|items|workflow|execution)\b(?!\s*[:''])/; ```  The pattern runs on the raw expression, including string literal contents (a `.` before `json` is excluded, but `[?json` inside a string is not).  ## Suggested fix  Strip string and template-literal contents before this check (the Code-node validator already has a stripped view for similar checks), or skip the check when the match sits inside quotes. 

- **Issue #1113** (2026-09-16): **Python Code-node validation still models Pyodide: legacy _input/_json/_now, blocked imports and classes pass; a valid single-dict return errors**
  *Symptoms*: ## Summary  The Python Code-node checks still model the removed **Pyodide "Python (Beta)"** runtime. On n8n 2.x (`language: "pythonNative"`, task-runner native Python) several patterns that always fail at runtime pass validation, and one valid return shape is rejected. Everything below was verified by execution on n8n 2.38.5 with the `n8nio/runners` sidecar.  ## Not flagged, but fail at runtime  | Code | Runtime result | |---|---| | `_input.all()`, `_input.first()`, `_json`, `_node["X"]`, `_now`, `_today`, `_jmespath(...)` | `NameError` (native Python exposes only `_items` in all-items mode and `_item` in each-item mode) | | `_items` in each-item mode / `_item` in all-items mode | `NameError` | | `item.json.field` | `AttributeError: 'dict' object has no attribute 'json'` | | **any** `import` not on the instance allowlist, e.g. `import json` | `Security violations detected` / `Import of standard library module 'json' is disallowed. Allowed stdlib modules: none` (default allowlist is empty; n8n Cloud allows none). Only `requests`/`pandas`/`numpy`/`pip` are flagged today. | | `class Foo: ...` | `__build_class__ not found` | | `type(x)`, `getattr`, `hasattr`, `setattr`, `vars`, `dir`, `globals`, `locals`, `open`, `input`, `compile` | `NameError` (default `N8N_RUNNERS_BUILTINS_DENY`). Only `eval(`/`exec(` get a warning. | | `x.__class__`, `"{0.__class__}".format(x)`, `__import__("json")` | `Security violations detected` (static rejection before execution) | | `global counter` insi

- **Issue #1112** (2026-09-16): **validate_node reports "Code cannot be empty" for every Python Code node using language pythonNative**
  *Symptoms*: ## Summary  `validate_node` reports **"Code cannot be empty"** (property `jsCode`) for every Code node that uses `language: "pythonNative"`, even when `pythonCode` has content. `pythonNative` is the only Python option n8n 2.x offers (`get_node` lists `javaScript` | `pythonNative`), so `validate_node` is effectively unusable for Python Code nodes. Workflow-level validation handles it correctly (it normalizes `pythonNative` → `python`).  ## Reproduction  ```js validate_node({   nodeType: "nodes-base.code",   profile: "runtime",   config: { language: "pythonNative", mode: "runOnceForEachItem",             pythonCode: "row = _item[\"json\"]\nreturn {\"json\": row}" } }) // → valid: false, errors: [{ property: "jsCode", message: "Code cannot be empty" }] ```  ## Where  [`src/services/config-validator.ts#L603`](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/config-validator.ts#L603):  ```ts const codeField = config.language === 'python' ? 'pythonCode' : 'jsCode'; ```  Compare [`node-specific-validators.ts#L1266`](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/node-specific-validators.ts#L1266), which already maps `pythonNative` → `python`.  ## Suggested fix  Apply the same normalization in `ConfigValidator.validateCode` (`language === 'python' || language === 'pythonNative'`), and add a `validate_node` test with `pythonNative`. 

- **Issue #1111** (2026-09-16): **Error-output heuristic turns a Respond to Webhook fan-out into a hard error and prescribes a fix that breaks the success path**
  *Symptoms*: ## Summary  `validate_workflow` raises a **hard error** (`valid: false`) whenever a node's `main[0]` fans out to more than one node and one of the targets *looks like* an error handler by **name** (`error`, `fail`, `catch`, `exception`) or **type** (`respondToWebhook`, `emailSend`). The suggested "fix" moves that node onto the error output and adds `onError: "continueErrorOutput"`. For the most common real case, a Respond to Webhook next to a side-effect node, following the fix breaks the workflow: the webhook would only ever answer when the upstream node **fails**.  ## Reproduction (validate_workflow, profile `runtime`)  Webhook (`responseMode: responseNode`) → Set "Prepare Order" → [**Respond to Webhook**, Set "Save Order"]  ```json {"connections": {"Webhook": {"main": [[{"node": "Prepare Order", "type": "main", "index": 0}]]},  "Prepare Order": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0},                              {"node": "Save Order", "type": "main", "index": 0}]]}}} ```  Result:  ``` valid: false Incorrect error output configuration. Nodes "Respond to Webhook" appear to be error handlers but are in main[0] (success output) along with other nodes. ... CORRECT (should be): main[1] = [Respond to Webhook] ... Also add: "onError": "continueErrorOutput" to the "Prepare Order" node. ```  The name heuristic fires the same way on ordinary fan-outs to nodes named e.g. "Log failed logins", "Catch-all router" or "Handle error (real error)".  ## Where  [

- **Issue #1103** (2026-09-16): **validate_node never checks IF/Switch operator structure, so it passes configs that validate_workflow and n8n_create_workflow reject**
  *Symptoms*: Spotted during the live testing on #1099 and confirmed to be broader than it first looked. Pre-existing; nothing in that PR caused it.  ## The divergence  `validate_node` never runs operator-structure validation. `validateConditionNodeStructure` is called from `validateWorkflowStructure` (the `n8n_create_workflow` / `n8n_update_full_workflow` path) and from `WorkflowValidator` (`validate_workflow`), but not from `EnhancedConfigValidator`, which is what `validate_node` uses.  So every operator defect class passes `validate_node` and fails the other two. Measured against the built code, for both node types:  | node | operator | `validate_node` | `validate_workflow` | |---|---|---|---| | IF v2.2 | `{type: "string"}` — no `operation` | clean | error | | IF v2.2 | `{operation: "equals"}` — no `type` | clean | error | | IF v2.2 | `{type: "equals", operation: "equals"}` — operation name in the type field | clean | error | | IF v2.2 | `"equals"` — a string | clean | error | | IF v2.2 | `null` | clean | error | | Switch v3.2 | all five of the same | clean | error |  Ten for ten. `EnhancedConfigValidator` is not unaware of these nodes — `validateSwitchNodeStructure` checks `rules.values` entries for `conditions` and `outputKey` — it just stops short of the operators inside them.  ## Why it matters  This is the same shape as #1096, the divergence that prompted that PR: an agent validates, is told the config is fine, then the write is refused with no way to tell which validator to believ

- **Issue #1102** (2026-09-16): **cleanupOrphanedWorkflows deletes other test files' in-flight workflows, making local integration runs non-deterministic**
  *Symptoms*: Found while running the full suite repeatedly during #1099. Test infrastructure only — no effect on shipped code, and CI is not affected.  ## The race  `cleanupOrphanedWorkflows` (`tests/integration/n8n-api/utils/cleanup-helpers.ts:25`) deletes **every** workflow on the instance whose name starts with the shared cleanup prefix or that carries the cleanup tag:  ```ts const testWorkflows = allWorkflows.filter(w => {   const isTestWorkflow = w.tags?.includes(creds.cleanup.tag) || w.name?.startsWith(creds.cleanup.namePrefix);   const isPreserved = preservedWorkflowNames.has(w.name);   return isTestWorkflow && !isPreserved; }); ```  The scope is the whole instance, not the calling file's own resources. 18 test files call it from `afterAll`:  ```ts afterAll(async () => {   if (!process.env.CI) {     await cleanupOrphanedWorkflows();   } }); ```  Vitest runs test files in parallel, so the first file to finish deletes the in-flight workflows of every file still running. Each file already has `afterEach(() => context.cleanup())`, which deletes its own tracked resources correctly — the instance-wide sweep is belt-and-braces for leaks from crashed runs, and it is the part that does the damage.  ## Observed  Three consecutive `npm test` runs on the same commit, failing in three different files, every failure a 404 on a workflow the test had just created:  | run | failures | |---|---| | 1 | `integration/database/performance.test.ts` (timing ratio — unrelated, separately flaky) | | 2 | `sm

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

### Incident Patch 1: `4cc0efda` (2026-09-23)
**Commit Message**: Merge pull request #1132 from czlonkowski/fix/agents-default-personal-project

feat(agents): default projectId to the caller's personal project (v2.89.0)

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -7,6 +7,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.89.0] - 2026-09-23
+
+### Changed
+
+- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also on failure responses (n8n rejecting another argument, or a timeout or transport error on the call itself). The action then takes a second round trip, the lookup before the call. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description, the `args` schema description and `tools_documentation` describe the default; they no longer say that arguments are forwarded verbatim.
+
 ## [2.88.0] - 2026-09-23
 
 ### Changed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.88.0",
+  "version": "2.89.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.88.0",
+      "version": "2.89.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.88.0",
+  "version": "2.89.0",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.87.0",
+  "version": "2.89.0",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/agents-action-map.ts` (modified, +9/-3)
```diff
@@ -41,6 +41,12 @@ export interface AgentActionSpec {
    * create/mutate/call could run it a second time.
    */
   idempotent: boolean;
+  /**
+   * The official tool requires `projectId`. When `args.projectId` is omitted
+   * or is the alias `personal`, the handler fills in the personal project of
+   * the MCP token's user.
+   */
+  defaultsToPersonalProject?: boolean;
 }
 
 export const DEFAULT_TIMEOUT_MS = 30_000;
@@ -58,7 +64,7 @@ export const AGENT_ACTION_MAP: Record<AgentAction, AgentActionSpec> = {
   reference: { tools: ['get_agent_builder_reference'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   search: { tools: ['search_agents'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   get: { tools: ['get_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
-  create: { tools: ['create_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
+  create: { tools: ['create_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false, defaultsToPersonalProject: true },
   mutate: { tools: ['mutate_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
   validate: { tools: ['validate_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   call: { tools: ['call_agent'], defaultTimeoutMs: CALL_TIMEOUT_MS, destructive: true, idempotent: false },
@@ -67,8 +73,8 @@ export const AGENT_ACTION_MAP: Record<AgentAction, AgentActionSpec> = {
   revert: { tools: ['revert_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
   versions: { tools: ['list_agent_versions'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   delete: { tools: ['delete_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
-  discover_assets: { tools: ['discover_agent_assets'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
-  verify_mcp_server: { tools: ['verify_agent_mcp_server'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
+  discover_assets: { tools: ['discover_agent_assets'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true, defaultsToPersonalProject: true },
+  verify_mcp_server: { tools: ['verify_agent_mcp_server'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true, defaultsToPersonalProject: true },
   update_integration: { tools: ['update_agent_integration'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
 };
 
```

---

### Incident Patch 2: `d877d391` (2026-09-23)
**Commit Message**: fix(agents): address Copilot review on the projectId default

- keep defaultedProjectId when the action call throws after the lookup
- stop describing args as forwarded verbatim; document the extra
  search_projects round trip
- sync package.runtime.json to 2.89.0

Conceived by Romuald Członkowski - https://aiadvisors.pl/en

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
-- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also when n8n then rejects another argument. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description and `tools_documentation` describe the default.
+- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also on failure responses (n8n rejecting another argument, or a timeout or transport error on the call itself). The action then takes a second round trip, the lookup before the call. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description, the `args` schema description and `tools_documentation` describe the default; they no longer say that arguments are forwarded verbatim.
 
 ## [2.88.0] - 2026-09-23
 
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.87.0",
+  "version": "2.89.0",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/handlers-agents.ts` (modified, +6/-3)
```diff
@@ -3,7 +3,8 @@
  *
  * Validates the action/timeout envelope, resolves the current alias for the
  * requested action against the connected instance's tool list, forwards
- * `args` verbatim to the official tool, and maps the official response
+ * `args` to the official tool (filling in a default projectId where the
+ * action needs one), and maps the official response
  * shapes onto this server's response envelope. All business logic for
  * *what* an action does lives in n8n's own MCP server; this file only
  * translates between the two contracts.
@@ -153,6 +154,8 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
   if (!client) return notConfiguredResponse(context, action);
 
   const spec = AGENT_ACTION_MAP[action];
+  // Outside the try so a call that throws after the lookup still reports it.
+  let defaultedProjectId: string | undefined;
   try {
     const caps = await client.capabilities();
     if (!caps.reachable) {
@@ -176,7 +179,6 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
 
     const callTimeoutMs = timeoutMs ?? spec.defaultTimeoutMs;
     let callArgs = toolArgs;
-    let defaultedProjectId: string | undefined;
     // null and "" count as omitted: LLM callers send them for "unset".
     const requested = toolArgs.projectId;
     const wantsPersonalProject = spec.defaultsToPersonalProject
@@ -237,7 +239,8 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
     if (hint) response.hint = hint;
     return response;
   } catch (err) {
-    const failure = officialFailure(err, action);
+    const failure: McpToolResponse = officialFailure(err, action);
+    if (defaultedProjectId) failure.defaultedProjectId = defaultedProjectId;
     if (failure.code === 'OFFICIAL_MCP_TIMEOUT' && action === 'call') {
       failure.hint = OFFICIAL_MCP_HINTS.OFFICIAL_MCP_TIMEOUT + ' Each agent turn is one n8n execution; the executionId appears in n8n_executions once the turn finishes.';
     }
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-manage-agents.ts` (modified, +4/-4)
```diff
@@ -7,7 +7,7 @@ export const n8nManageAgentsDoc: ToolDocumentation = {
     description: 'Create, configure, validate, run and publish n8n Agents (persisted assistants) through n8n\'s instance-level MCP server. Needs N8N_MCP_ACCESS_TOKEN and n8n >= 2.34 with the agents module.',
     keyParameters: ['action', 'args', 'timeoutMs'],
     example: 'n8n_manage_agents({action: "reference"}) → n8n_manage_agents({action: "create", args: {name, config: {model: "openai/gpt-4o-mini", instructions: "..."}}})',
-    performance: '150-400 ms per action; call: 5-60 s per turn (one n8n execution each)',
+    performance: '150-400 ms per action (a second round trip when projectId is defaulted); call: 5-60 s per turn (one n8n execution each)',
     tips: [
       'Always read action=reference first: it returns the config schema and the exact mutate operations.',
       'Every mutate needs the configHash from the last get/create/mutate response; STALE_CONFIG means re-read it.',
@@ -17,7 +17,7 @@ export const n8nManageAgentsDoc: ToolDocumentation = {
     ],
   },
   full: {
-    description: `Thin adapter over n8n's official MCP agent tools. The action selects the official tool, args are forwarded verbatim, results are returned verbatim under data with our envelope and error codes.
+    description: `Thin adapter over n8n's official MCP agent tools. The action selects the official tool, args are forwarded unchanged apart from the projectId default described below, and results are returned verbatim under data with our envelope and error codes.
 
 Build sequence: reference → discover_assets (kind=models with provider, kind=integrations/workflows/subagents/mcpServers) → create (name, config, projectId?) → mutate per resource (config.patch is RFC 6902; skill.upsert/delete, task.upsert/delete, customTool.upsert/delete) → validate → call (test) → publish (only when asked).
 
@@ -40,10 +40,10 @@ Credentials: on this n8n generation the agents runtime rejects azureOpenAiApi an
       'n8n_manage_agents({action: "call", args: {agentId: "a1", request: {type: "message", message: "Summarise yesterday\'s tickets"}}, timeoutMs: 300000})',
     ],
     useCases: ['Build a persisted n8n Agent from a spec', 'Add skills, tasks and custom tools to an existing agent', 'Validate and test-run an agent before the user publishes it', 'Inspect agent versions and revert'],
-    performance: 'Each action is one HTTP round trip to the instance; call adds the model latency.',
+    performance: 'Each action is one HTTP round trip to the instance, plus a search_projects lookup first when create, discover_assets or verify_mcp_server defaults projectId; call adds the model latency.',
     errorHandling: 'STALE_CONFIG → get and retry with the new configHash. AGENT_NOT_RUNNABLE → validate and fix errors/missing. OFFICIAL_MCP_TIMEOUT on call → the turn continues in n8n; reuse sessionId instead of re-sending.',
     bestPractices: ['One mutate per resource, re-reading configHash between them', 'Validate before call and before publish', 'Name test agents "[TEST] …" and delete them afterwards', 'Never publish, delete or approve without the user saying so'],
-    pitfalls: ['args are forwarded verbatim — a misspelled field is reported by n8n as INVALID_ARGS', 'timeoutMs belongs at the top level, not inside args', 'The MCP access token is separate from the Public API key'],
+    pitfalls: ['args are forwarded unchanged apart from the projectId default — a misspelled field is reported by n8n as INVALID_ARGS', 'timeoutMs belongs at the top level, not inside args', 'The MCP access token is separate from the Public API key'],
     relatedTools: ['n8n_manage_credentials', 'n8n_list_catalog', 'n8n_executions', 'n8n_health_check'],
   },
 };
```

**File**: `src/mcp/tools-n8n-manager.ts` (modified, +1/-1)
```diff
@@ -933,7 +933,7 @@ Two sources:
       type: 'object',
       properties: {
         action: { type: 'string', enum: AGENT_ACTIONS, description: 'Operation to perform' },
-        args: { type: 'object', description: 'Arguments for the action, forwarded to n8n verbatim. See tools_documentation("n8n_manage_agents", "full") for the per-action fields.' },
+        args: { type: 'object', description: 'Arguments for the action, forwarded to n8n unchanged except that an omitted, null, empty or "personal" projectId on create, discover_assets and verify_mcp_server is replaced with your personal project ID. See tools_documentation("n8n_manage_agents", "full") for the per-action fields.' },
         timeoutMs: { type: 'integer', minimum: 5000, maximum: 600000, description: 'Request timeout in ms. Default 30000; 180000 for action=call. The agent run continues in n8n even if this expires.' },
       },
       required: ['action'],
```

---

### Incident Patch 3: `2d0d7a67` (2026-09-23)
**Commit Message**: fix(agents): harden the personal-project default after review

- refuse an unresolved "personal" alias instead of sending it to n8n
- treat projectId null and "" as omitted
- keep defaultedProjectId on INVALID_ARGS responses
- cap the lookup at the caller's timeoutMs
- ask search_projects for limit 2 and require count 1; ignore error results

Conceived by Romuald Członkowski - https://aiadvisors.pl/en

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
-- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted or is the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. n8n lists only projects the caller belongs to, so an instance owner never gets another user's personal project. The response reports the filled-in ID as `defaultedProjectId`. If the lookup fails or does not return exactly one personal project, the request goes to n8n unchanged, and the resulting `INVALID_ARGS` carries a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description and `tools_documentation` describe the default.
+- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also when n8n then rejects another argument. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description and `tools_documentation` describe the default.
 
 ## [2.88.0] - 2026-09-23
 
```

**File**: `src/mcp/handlers-agents.ts` (modified, +25/-10)
```diff
@@ -64,14 +64,17 @@ const PROJECT_ID_HINT = "projectId could not be defaulted to your personal proje
  * `search_projects` tool. That tool lists only projects the caller has a
  * relation to, so `type: personal` returns the caller's own project and never
  * another user's, even for an instance owner. Returns undefined when the tool
- * is missing, the call fails, or the answer is not exactly one project; the
- * request then goes to n8n unchanged and n8n reports the missing projectId.
+ * is missing, the call fails, or the answer is not exactly one project
+ * (`limit: 2` plus `count` keep a truncated answer from passing as unique).
  */
-async function personalProjectId(client: N8nOfficialMcpClient, toolNames: string[]): Promise<string | undefined> {
+async function personalProjectId(client: N8nOfficialMcpClient, toolNames: string[], timeoutMs: number): Promise<string | undefined> {
   if (!toolNames.includes('search_projects')) return undefined;
   try {
-    const result = await client.callTool('search_projects', { type: 'personal' }, { timeoutMs: DEFAULT_TIMEOUT_MS, idempotent: true });
-    const projects = ((result.json as any)?.data ?? []).filter((p: any) => p?.type === 'personal' && typeof p.id === 'string');
+    const result = await client.callTool('search_projects', { type: 'personal', limit: 2 }, { timeoutMs, idempotent: true });
+    const json = result.json as any;
+    if (result.isError || json?.ok === false) return undefined;
+    if (typeof json?.count === 'number' && json.count !== 1) return undefined;
+    const projects = (Array.isArray(json?.data) ? json.data : []).filter((p: any) => p?.type === 'personal' && typeof p.id === 'string');
     return projects.length === 1 ? projects[0].id : undefined;
   } catch {
     return undefined;
@@ -171,16 +174,27 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
       return { success: true, action, officialTool: tool, data: await client.reference(tool) };
     }
 
+    const callTimeoutMs = timeoutMs ?? spec.defaultTimeoutMs;
     let callArgs = toolArgs;
     let defaultedProjectId: string | undefined;
+    // null and "" count as omitted: LLM callers send them for "unset".
+    const requested = toolArgs.projectId;
     const wantsPersonalProject = spec.defaultsToPersonalProject
-      && (toolArgs.projectId === undefined || toolArgs.projectId === PERSONAL_PROJECT_ALIAS);
+      && (requested === undefined || requested === null || requested === '' || requested === PERSONAL_PROJECT_ALIAS);
     if (wantsPersonalProject) {
-      defaultedProjectId = await personalProjectId(client, caps.toolNames);
-      if (defaultedProjectId) callArgs = { ...toolArgs, projectId: defaultedProjectId };
+      defaultedProjectId = await personalProjectId(client, caps.toolNames, Math.min(callTimeoutMs, DEFAULT_TIMEOUT_MS));
+      if (defaultedProjectId) {
+        callArgs = { ...toolArgs, projectId: defaultedProjectId };
+      } else if (requested === PERSONAL_PROJECT_ALIAS) {
+        // n8n would take the alias as a literal project ID and answer not-found.
+        return { ...invalid(action, 'projectId "personal" could not be resolved to your personal project.'), hint: PROJECT_ID_HINT };
+      } else if (requested !== undefined) {
+        const { projectId: _omit, ...rest } = toolArgs;
+        callArgs = rest;
+      }
     }
 
-    const result: OfficialToolResult = await client.callTool(tool, callArgs, { timeoutMs: timeoutMs ?? spec.defaultTimeoutMs, idempotent: spec.idempotent });
+    const result: OfficialToolResult = await client.callTool(tool, callArgs, { timeoutMs: callTimeoutMs, idempotent: spec.idempotent });
     const data = result.json ?? result.text;
 
     // "Input validation error" is the literal prefix n8n's MCP server puts on
@@ -191,7 +205,8 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
     // Error text is capped at 2000 chars — n8n's error text is untrusted output.
     if (res
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-manage-agents.ts` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ export const n8nManageAgentsDoc: ToolDocumentation = {
 
 Build sequence: reference → discover_assets (kind=models with provider, kind=integrations/workflows/subagents/mcpServers) → create (name, config, projectId?) → mutate per resource (config.patch is RFC 6902; skill.upsert/delete, task.upsert/delete, customTool.upsert/delete) → validate → call (test) → publish (only when asked).
 
-projectId: create, discover_assets and verify_mcp_server need a project. When args.projectId is omitted or is "personal", the personal project of the MCP access token's user is filled in (read with n8n's search_projects) and returned as defaultedProjectId. If it cannot be resolved, the request goes to n8n unchanged and the INVALID_ARGS response carries a hint to pass projectId. search takes projectId only as an optional filter and is never defaulted.
+projectId: create, discover_assets and verify_mcp_server need a project. When args.projectId is omitted, null, empty or "personal", the personal project of the MCP access token's user is filled in (read with n8n's search_projects) and returned as defaultedProjectId. If it cannot be resolved, "personal" is refused with INVALID_ARGS before anything is sent, and an omitted projectId is left for n8n to report; both responses carry a hint to pass projectId. search takes projectId only as an optional filter and is never defaulted.
 
 Gates: reference and search work for every agent; all other actions need the agent exposed to MCP (agents created here are exposed automatically).
 
```

**File**: `tests/unit/mcp/handlers-agents.test.ts` (modified, +53/-1)
```diff
@@ -207,7 +207,7 @@ describe('handleManageAgents projectId default', () => {
     const client = fakeClient(TOOLS, { search_projects: PERSONAL, discover_agent_assets: { ok: true, models: [] } });
     access.getOfficialMcpClient.mockReturnValue(client);
     const r = await handleManageAgents({ action: 'discover_assets', args: { kind: 'models', provider: 'minimax' } });
-    expect(client.callTool).toHaveBeenCalledWith('search_projects', { type: 'personal' }, { timeoutMs: 30_000, idempotent: true });
+    expect(client.callTool).toHaveBeenCalledWith('search_projects', { type: 'personal', limit: 2 }, { timeoutMs: 30_000, idempotent: true });
     expect(client.callTool).toHaveBeenLastCalledWith('discover_agent_assets', { kind: 'models', provider: 'minimax', projectId: 'pp1' }, { timeoutMs: 30_000, idempotent: true });
     expect(r).toMatchObject({ success: true, action: 'discover_assets', defaultedProjectId: 'pp1' });
   });
@@ -256,6 +256,58 @@ describe('handleManageAgents projectId default', () => {
     expect(client.callTool).toHaveBeenCalledWith('discover_agent_assets', { kind: 'models' }, expect.anything());
   });
 
+  it('treats null and "" as omitted, and drops them when the lookup fails', async () => {
+    const client = fakeClient(TOOLS, { search_projects: PERSONAL });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { projectId: null, name: 'x' } });
+    expect(client.callTool).toHaveBeenLastCalledWith('create_agent', { projectId: 'pp1', name: 'x' }, expect.anything());
+    expect(r.defaultedProjectId).toBe('pp1');
+
+    const noLookup = fakeClient(ALL);
+    access.getOfficialMcpClient.mockReturnValue(noLookup);
+    await handleManageAgents({ action: 'create', args: { projectId: '', name: 'x' } });
+    expect(noLookup.callTool).toHaveBeenLastCalledWith('create_agent', { name: 'x' }, expect.anything());
+  });
+
+  it('refuses an unresolved "personal" alias instead of sending it to n8n as a project ID', async () => {
+    const client = fakeClient(ALL);
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { projectId: 'personal', name: 'x' } });
+    expect(r).toMatchObject({ success: false, action: 'create', code: 'INVALID_ARGS' });
+    expect(r.hint).toContain('n8n_list_catalog');
+    expect(client.callTool).not.toHaveBeenCalled();
+  });
+
+  it.each([
+    ['an error result', { ok: false, code: 'forbidden' }],
+    ['a count above one on a truncated page', { ok: true, data: [{ id: 'a', type: 'personal' }], count: 3 }],
+  ])('does not default from %s', async (_label, projects) => {
+    const client = fakeClient(TOOLS, { search_projects: projects });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { name: 'x' } });
+    expect(client.callTool).toHaveBeenLastCalledWith('create_agent', { name: 'x' }, expect.anything());
+    expect(r.defaultedProjectId).toBeUndefined();
+  });
+
+  it('picks the personal entry and ignores team projects in the answer', async () => {
+    const client = fakeClient(TOOLS, { search_projects: { ok: true, data: [{ id: 't1', type: 'team' }, { id: 'pp1', type: 'personal' }] } });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { name: 'x' } });
+    expect(r.defaultedProjectId).toBe('pp1');
+  });
+
+  it('reports defaultedProjectId when n8n rejects another argument, and caps the lookup at the caller timeout', async () => {
+    const client = fakeClient(TOOLS);
+    client.callTool.mockImplementation(async (name: string) => name === 'search_projects'
+      ? { isError: false, text: JSON.stringify(PERSONAL), json: PERSONAL, sizeBytes: 10, truncated: false }
+      : { isError: true, text: 'Input validation error: kind: Required', json: undefined, sizeBytes: 10, truncated: false });
+   
```

---

### Incident Patch 4: `ec903687` (2026-09-23)
**Commit Message**: docs: document the Node 22 workaround for fetch:community aborts

Conceived by Romuald Członkowski - https://aiadvisors.pl/en

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `MEMORY_N8N_UPDATE.md` (modified, +10/-0)
```diff
@@ -117,6 +117,16 @@ gh release list | head -1
 **Cause**: npm 11 skips the install scripts of packages not covered by `allowScripts`, so `npm install` does not recompile better-sqlite3 for the current Node.js and the rebuild falls back to sql.js, which has no FTS5
 **Solution**: `npm rebuild better-sqlite3`, then `npm run build && npm run rebuild && npm run validate`
 
+**Problem**: `npm run fetch:community` aborts (exit 134) with `Assertion failed: (env) != nullptr` in `RemoveEnvironmentCleanupHook`, while fetching or saving nodes
+**Cause**: better-sqlite3 11.10 crashes in a statement destructor during garbage collection under Node.js 24.21. Forcing sql.js does not help: the community fetch writes to FTS5-indexed tables, which sql.js lacks
+**Solution**: run the community fetch and the docs generators under Node.js 22, then recompile for the default Node.js. The fetch upserts, so re-running it after an abort is safe; check `sqlite3 data/nodes.db 'pragma integrity_check'` first
+```bash
+PATH=/opt/homebrew/opt/node@22/bin:$PATH npm rebuild better-sqlite3
+PATH=/opt/homebrew/opt/node@22/bin:$PATH node dist/scripts/fetch-community-nodes.js
+# generate-community-docs.js runs the same way
+npm rebuild better-sqlite3   # back to the default Node.js
+```
+
 **Problem**: `generate:docs:readme-only` exits with code 1
 **Reason**: Some packages have no README anywhere (the fetch reads the tarball when the registry metadata has none) or are no longer on npm
 **Normal**: A few failed fetches are expected; check the "With README" count instead of the exit code
```

---

### Incident Patch 5: `2fef0563` (2026-09-16)
**Commit Message**: Merge pull request #1126 from czlonkowski/test/all-fixes-0916

chore: release v2.87.0 (issues #1100–#1119)

**File**: `.github/workflows/docker-build-fast.yml` (modified, +4/-1)
```diff
@@ -22,14 +22,17 @@ jobs:
     permissions:
       contents: read
       packages: write
-      
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
+
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
         with:
           lfs: true
         
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
```

**File**: `.github/workflows/docker-build-n8n.yml` (modified, +3/-0)
```diff
@@ -47,6 +47,8 @@ jobs:
     permissions:
       contents: read
       packages: write
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
 
     steps:
       - name: Checkout repository
@@ -56,6 +58,7 @@ jobs:
         uses: docker/setup-qemu-action@v4
 
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
```

**File**: `.github/workflows/docker-build.yml` (modified, +6/-0)
```diff
@@ -53,6 +53,8 @@ jobs:
     permissions:
       contents: read
       packages: write
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
 
     steps:
       - name: Checkout repository
@@ -72,6 +74,7 @@ jobs:
           echo "✅ Synced package.runtime.json to version $VERSION"
 
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
@@ -161,6 +164,8 @@ jobs:
     permissions:
       contents: read
       packages: write
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
 
     steps:
       - name: Checkout repository
@@ -180,6 +185,7 @@ jobs:
           echo "✅ Synced package.runtime.json to version $VERSION"
 
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
```

**File**: `CHANGELOG.md` (modified, +28/-0)
```diff
@@ -7,6 +7,34 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.87.0] - 2026-09-16
+
+### Added
+
+- **`$jmespath()` queries inside `{{ }}` expressions are checked** ([#1114](https://github.com/czlonkowski/n8n-mcp/issues/1114)). n8n swallows JMESPath parse errors inside an expression, so the field resolves to `null` while the node reports success, and in a Filter or IF condition every item silently fails the check. `validate_workflow` now reads the query when it is a string literal and reports as errors a bare number in a comparison (`[?revenue > 100000]`; JMESPath literals are backtick-quoted), `and`/`or` in place of `&&`/`||`, a single `=` in place of `==`, and reversed arguments (`$jmespath("query", data)`). A double-quoted right-hand side (`== "PL"`, which JMESPath reads as an identifier) and a bare `true`/`false`/`null` (read as a field name) are warnings. Queries held in a variable or built with `${}` are not followed. The JavaScript Code-node checks use the same module, including for nested calls; Python `_jmespath` is no longer checked there because n8n 2.x native Python does not have it.
+
+### Changed
+
+- **Python Code-node validation models n8n 2.x native Python** ([#1113](https://github.com/czlonkowski/n8n-mcp/issues/1113)). The checks still described the Pyodide "Python (Beta)" runtime that n8n 2.0 removed. On the native task runner only `_items` (all-items mode) and `_item` (each-item mode) exist, items are plain dicts, imports are blocked unless the instance allowlists the module (none on n8n Cloud), and the sandbox denies `class` definitions, a set of builtins (`type`, `getattr`, `open`, `eval` and the rest), dunder attribute access and `global` inside a function. The validator now reports as errors the removed globals `_input`, `_json`, `_node`, `_now`, `_today`, `_jmespath` and the JavaScript habit `items` (with the native replacement), `_items` or `_item` used in the wrong mode, `.json` attribute access on an item, `class`, denied builtins, dunder access (including inside format strings), `global` inside a function, and a list returned in each-item mode; every `import` is a warning that survives the `runtime` and `minimal` profiles. A single dict returned in all-items mode, which native Python wraps into one item, is accepted, and the "return must be a list of dicts" error is gone. References are resolved per scope, so a parameter or local named like a removed global does not fire inside its function, f-string fields count as code, and every scan stays linear on adversarial input. `_jmespath` is reported as a removed global instead of getting JMESPath advice. The Python samples in the task templates and `get_node` examples are native too.
+- **Validation errors are de-duplicated by message, not by property** ([#1103](https://github.com/czlonkowski/n8n-mcp/issues/1103) follow-up). `validate_node` and `validate_workflow` kept one error per property, so six Python defects, or five malformed IF operators, surfaced as one, chosen by message length. Only exact repeats collapse now; `missing_required` still collapses per property and keeps the more specific wording. The two validators that reported the same defect twice under the old rule (fixedCollection pattern prefixes, MongoDB collection) report it once, and a null value for a required property no longer adds a type error to the required-property error. Over the bundled templates this changed nothing for non-Python nodes apart from removing one false enum error on a null optional value.
+
+### Fixed
+
+- **`validate_node` no longer reports "Code cannot be empty" for `language: pythonNative`** ([#1112](https://github.com/czlonkowski/n8n-mcp/issues/1112)). The base validator compared the language against `python` only and read `jsCode`; it now treats `pythonNative` the same way the node-specific checks already did.
+- **`python_code_node_guide` documents native Python** ([#1116](https://github.com/czl
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.0",
+  "version": "2.87.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.0",
+      "version": "2.87.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

---

### Incident Patch 6: `d348f3d7` (2026-09-16)
**Commit Message**: merge fix/python-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.87.0] - 2026-09-16
+
+### Changed
+
+- **Python Code-node validation models n8n 2.x native Python** ([#1113](https://github.com/czlonkowski/n8n-mcp/issues/1113)). The checks still described the Pyodide "Python (Beta)" runtime that n8n 2.0 removed. On the native task runner only `_items` (all-items mode) and `_item` (each-item mode) exist, items are plain dicts, imports are blocked unless the instance allowlists the module (none on n8n Cloud), and the sandbox denies `class` definitions, a set of builtins (`type`, `getattr`, `open`, `eval` and the rest), dunder attribute access and `global` inside a function. The validator now reports as errors the removed globals `_input`, `_json`, `_node`, `_now`, `_today`, `_jmespath` and the JavaScript habit `items` (with the native replacement), `_items` or `_item` used in the wrong mode, `.json` attribute access on an item, `class`, denied builtins, dunder access (including inside format strings), `global` inside a function, and a list returned in each-item mode; every `import` is a warning that survives the `runtime` and `minimal` profiles. A single dict returned in all-items mode, which native Python wraps into one item, is accepted, and the "return must be a list of dicts" error is gone. References are resolved per scope, so a parameter or local named like a removed global does not fire inside its function, f-string fields count as code, and every scan stays linear on adversarial input. `_jmespath` is reported as a removed global instead of getting JMESPath advice. The Python samples in the task templates and `get_node` examples are native too.
+- **Validation errors are de-duplicated by message, not by property** ([#1103](https://github.com/czlonkowski/n8n-mcp/issues/1103) follow-up). `validate_node` and `validate_workflow` kept one error per property, so six Python defects, or five malformed IF operators, surfaced as one, chosen by message length. Only exact repeats collapse now; `missing_required` still collapses per property and keeps the more specific wording. The two validators that reported the same defect twice under the old rule (fixedCollection pattern prefixes, MongoDB collection) report it once, and a null value for a required property no longer adds a type error to the required-property error. Over the bundled templates this changed nothing for non-Python nodes apart from removing one false enum error on a null optional value.
+
+### Fixed
+
+- **`validate_node` no longer reports "Code cannot be empty" for `language: pythonNative`** ([#1112](https://github.com/czlonkowski/n8n-mcp/issues/1112)). The base validator compared the language against `python` only and read `jsCode`; it now treats `pythonNative` the same way the node-specific checks already did.
+- **`python_code_node_guide` documents native Python** ([#1116](https://github.com/czlonkowski/n8n-mcp/issues/1116)). Both the essentials and the full guide described `_input.all()`, `_json` and stdlib imports that fail on every n8n 2.x instance. They now cover `pythonNative`, `_items`/`_item`, dict access, the import allowlist (none on Cloud, a custom runner image self-hosted), the sandbox limits, `nonlocal` instead of `global` inside functions, the accepted return shapes per mode, a Pyodide-to-native migration table, `pairedItem`, `onError: continueErrorOutput`, and the `n8nio/runners` sidecar that self-hosted Docker needs ("Python runner unavailable" otherwise).
 ## [2.86.4] - 2026-09-16
 
 ### Fixed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.4",
+  "version": "2.87.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.4",
+      "version": "2.87.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.4",
+  "version": "2.87.0",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.4",
+  "version": "2.87.0",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp-tools-engine.ts` (modified, +11/-5)
```diff
@@ -63,11 +63,17 @@ export class MCPEngine {
       };
     }
 
-    // CRITICAL FIX: Extract user-provided keys before validation
-    // This prevents false warnings about default values
-    const userProvidedKeys = new Set(Object.keys(args.config || {}));
-
-    return ConfigValidator.validate(args.nodeType, args.config, node.properties || [], userProvidedKeys);
+    // Routed through the enhanced validator so the embedding API sees the same
+    // node-specific checks as validate_node and workflow validation - it also
+    // derives the user-provided keys itself, which keeps default values from
+    // raising false warnings. The result is a superset of ValidationResult.
+    return EnhancedConfigValidator.validateWithMode(
+      args.nodeType,
+      args.config || {},
+      node.properties || [],
+      args.mode ?? 'operation',
+      args.profile ?? 'ai-friendly'
+    );
   }
 
   async validateNodeMinimal(args: any) {
```

---

### Incident Patch 7: `21b3ee4f` (2026-09-16)
**Commit Message**: merge fix/api-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -7,6 +7,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.86.4] - 2026-09-16
+
+### Fixed
+
+- **An n8n 2.39 refusal to publish on save is reported as what it is** ([#1118](https://github.com/czlonkowski/n8n-mcp/issues/1118)). Since n8n 2.39, saving a published workflow re-publishes it, and without the `workflow:activate` API key scope or the `workflow:publish` permission n8n keeps the published version, saves the change as a draft and answers 403 with a `reason` and the draft's `versionId`. That response now maps to its own error code, `PUBLISH_FORBIDDEN`, wherever a workflow is written. `n8n_update_full_workflow` says the published version is unchanged, the change was saved as draft `draftVersionId`, and retrying with the same credentials will not publish it. `n8n_update_partial_workflow` keeps rolling back, decides whether anything persisted by content rather than by `versionId` (a name or settings change does not bump it), and reports one of: rolled back, with `supersededDraftVersionId` and `restoredDraftVersionId`; the change retained as an unpublished draft (`draftVersionId`); an incomplete restore (`observedDraftVersionId`); or a rollback that could not be confirmed (`attemptedDraftVersionId`), each pointing to `n8n_workflow_versions`. It no longer appends "workflow restored to prior state" to n8n's "saved as a draft" sentence. `n8n_autofix_workflow` passes the code through, `n8n_workflow_versions` restore says the draft holds the restored snapshot, and `n8n_test_workflow` reads the workflow back after the exposure write: when `availableInMCP` persisted on the draft the test proceeds with a warning, otherwise it fails and says whether the state was confirmed. Failure telemetry records the content that actually persisted. This has not been run against a key with narrowed scopes.
+
+### Removed
+
+- **Source-control client methods** ([#1119](https://github.com/czlonkowski/n8n-mcp/issues/1119)). `getSourceControlStatus`, `pullSourceControl` and `pushSourceControl` in `N8nApiClient`, and their types, no longer matched the n8n 2.39 Public API (`direction` query parameter, `commitMessage` and typed `fileNames`) and no tool used them; they are deleted rather than aligned. The never-set `CredentialListParams.filter` is gone too. The 2.86.0 entry's description of the partial-update behaviour on this 403, and of these endpoints as merely unused, is superseded by this entry.
 ## [2.86.3] - 2026-09-16
 
 ### Fixed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.3",
+  "version": "2.86.4",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.3",
+      "version": "2.86.4",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.3",
+  "version": "2.86.4",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.3",
+  "version": "2.86.4",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/handlers-n8n-manager.ts` (modified, +46/-3)
```diff
@@ -1107,6 +1107,10 @@ export async function handleUpdateWorkflow(
   // persisted the folder move (write-only in n8n, so it can be neither read back nor
   // rolled back), and the error path below must say so.
   let sentParentFolderId = false;
+  // The merged payload sent to the failed PUT. On PUBLISH_FORBIDDEN, n8n saves this as a
+  // draft — the failure telemetry should reflect that content, not silently claim
+  // "no change" by reusing workflowBefore.
+  let attemptedWorkflow: any = null;
 
   try {
     const client = ensureApiConfigured(context);
@@ -1181,6 +1185,7 @@ export async function handleUpdateWorkflow(
     if (nodeGroupsUpdate !== undefined) {
       fullWorkflow.nodeGroups = nodeGroupsUpdate;
     }
+    attemptedWorkflow = fullWorkflow;
 
     // Backup + structure validation when the graph or its grouping changed.
     if (updateData.nodes || updateData.connections || nodeGroupsUpdate !== undefined) {
@@ -1257,13 +1262,20 @@ export async function handleUpdateWorkflow(
   } catch (error) {
     // Track failed mutation
     if (workflowBefore) {
+      // PUBLISH_FORBIDDEN means n8n persisted the attempted payload as a draft even
+      // though the PUT threw — workflowBefore would misreport "no change". Use the
+      // attempted payload when we have one; otherwise omit workflowAfter rather than
+      // claim an unchanged state we cannot confirm.
+      const isPublishForbidden = error instanceof N8nApiError && error.code === 'PUBLISH_FORBIDDEN';
       void trackWorkflowMutationForFullUpdate({
         sessionId,
         toolName: 'n8n_update_full_workflow',
         userIntent,
         operations: [],
         workflowBefore,
-        workflowAfter: workflowBefore, // No change since it failed
+        ...(isPublishForbidden
+          ? (attemptedWorkflow ? { workflowAfter: attemptedWorkflow } : {})
+          : { workflowAfter: workflowBefore }), // No change since it failed
         mutationSuccess: false,
         mutationError: error instanceof Error ? error.message : 'Unknown error',
         durationMs: Date.now() - startTime,
@@ -1280,6 +1292,24 @@ export async function handleUpdateWorkflow(
       };
     }
 
+    if (error instanceof N8nApiError && error.code === 'PUBLISH_FORBIDDEN') {
+      const body = error.details as { reason?: string; versionId?: string } | undefined;
+      return {
+        success: false,
+        error: 'n8n did not publish this change. The published version is unchanged; ' +
+          `the change was saved as a draft${body?.versionId ? ` (id: ${body.versionId})` : ''}. ` +
+          'Retrying with the same credentials will save another draft without publishing it. ' +
+          'The API key needs the workflow:activate scope, and the user needs workflow:publish permission on this workflow.',
+        code: error.code,
+        details: {
+          reason: body?.reason,
+          draftVersionId: body?.versionId,
+          publishedVersionUnchanged: true,
+          ...(sentParentFolderId ? { folderMoveMayHavePersisted: true } : {})
+        }
+      };
+    }
+
     if (error instanceof N8nApiError) {
       const baseDetails = error.details as Record<string, unknown> | undefined;
       return {
@@ -1633,9 +1663,17 @@ export async function handleAutofixWorkflow(
         return {
           success: false,
           error: 'Failed to apply fixes',
+          // Pass the partial-update failure's code through (e.g. PUBLISH_FORBIDDEN) so
+          // callers can tell a publish refusal apart from a generic update failure
+          // instead of having to parse updateError.
+          ...(updateResult.code ? { code: updateResult.code } : {}),
           details: {
             fixes: fixResult.fixes,
-            updateError: updateResult.error
+            updateError: updateResult.error,
+            // The partial-update failure's own details (e.g. PUBLISH_FORBIDDEN's
+            // draftVersionId/rollbackPerformed) — dropped before, leaving callers
```

---

### Incident Patch 8: `8601e18a` (2026-09-16)
**Commit Message**: merge fix/structure-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -7,6 +7,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.86.3] - 2026-09-16
+
+### Fixed
+
+- **Switch branch-count validation reads the rules n8n reads** ([#1100](https://github.com/czlonkowski/n8n-mcp/issues/1100)). The check on the write path (`n8n_create_workflow`, `n8n_update_full_workflow`, `n8n_update_partial_workflow`) read only the legacy `rules.rules`, so it never ran on a current Switch, and pointing it at `rules.values` as written would have flagged 51 bundled templates. It now reads `rules.values` (typeVersion 3.2 and later) as well as the legacy key, counts one extra output for `options.fallbackOutput: "extra"` and one for `onError: "continueErrorOutput"`, reports only more branches than the node has outputs (n8n omits trailing branches that route nowhere), skips Switch v1 (four fixed outputs), and no longer reports an unconnected rule output, which 13 published templates use on purpose. `validate_workflow` computes the same output count for its error-output warnings, so a Switch, whose bundled metadata carries its outputs as an expression, gets those warnings at all, a 2-rule Switch is told its error output is main[2] rather than main[3], and a Filter, which has one output, no longer gets the "no connections on the unmatched branch" warning (16 templates).
+- **A connection key with no targets no longer counts as a connection** ([#1101](https://github.com/czlonkowski/n8n-mcp/issues/1101)). n8n keeps `"A": {"main": [[]]}` or `[null]` after a node's last edge is removed, and both the write-path disconnected-node check and the `validate_workflow` orphan warning treated the key as proof of an outgoing connection, so two isolated nodes passed. A source counts once it names a target; triggers follow the same rule (an mcpTrigger reached only by an inbound `ai_tool` connection still counts). Over the bundled templates this reports 22 more workflows with a disconnected node, all real (unwired alternative model nodes, leftover triggers). The suggested fix never proposes a self-loop.
+- **`validate_node` checks IF, Switch and Filter operator structure** ([#1103](https://github.com/czlonkowski/n8n-mcp/issues/1103)). The operator checks ran on the workflow paths only, so `validate_node` passed `{type: "string"}` without an operation, an operation name in the type field, a string or `null` operator, while `n8n_create_workflow` refused the same config. `EnhancedConfigValidator` now runs `validateConditionNodeStructure` with the `@version` the handler merges into the config (IF and Filter from version 2, Switch from 3.2 in rules mode); a malformed `@version` value is treated as version 1 rather than throwing. Because the enhanced validator keeps one error per property, `validate_workflow` also keeps its direct call and skips only the message already reported, so every operator is still listed once.
+- **A fan-out to a node named like an error handler is no longer a hard error** ([#1111](https://github.com/czlonkowski/n8n-mcp/issues/1111)). `validate_workflow` reported `valid: false` whenever `main[0]` fanned out and one target was named error/fail/catch/exception or was a Respond to Webhook or Email Send node, and prescribed moving it to the error output, which for the common Respond to Webhook beside a side-effect node makes the webhook answer only on failure. The name is now only a hint appended to the existing warning for a node whose `onError: "continueErrorOutput"` error output has nothing connected; node type is not a signal. This removed 46 false errors across the bundled templates and added one hint.
 ## [2.86.2] - 2026-09-16
 
 ### Added
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.2",
+  "version": "2.86.3",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.2",
+      "version": "2.86.3",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.2",
+  "version": "2.86.3",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.2",
+  "version": "2.86.3",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/server.ts` (modified, +20/-6)
```diff
@@ -3940,6 +3940,18 @@ Full documentation is being prepared. For now, use get_node_essentials for confi
     return result;
   }
   
+  /**
+   * The typeVersion the validators see for a single-node config: the caller's `@version` when
+   * it is a finite number (or numeric string), else the node's version from the database.
+   */
+  private resolveConfigVersion(requested: unknown, nodeVersion: unknown): number {
+    const numeric = typeof requested === 'number' ? requested
+      : typeof requested === 'string' && requested.trim() !== '' ? Number(requested) : NaN;
+    if (Number.isFinite(numeric)) return numeric;
+    const fallback = Number(nodeVersion);
+    return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
+  }
+
   private async validateNodeConfig(
     nodeType: string, 
     config: Record<string, any>, 
@@ -3979,10 +3991,11 @@ Full documentation is being prepared. For now, use get_node_essentials for confi
     // Get properties
     const properties = node.properties || [];
 
-    // Add @version to config for displayOptions evaluation (supports _cnd operators)
+    // Add @version to config for displayOptions evaluation (supports _cnd operators). A
+    // caller may pin a version, but only a real one; anything else keeps the node's version.
     const configWithVersion = {
-      '@version': node.version || 1,
-      ...config
+      ...config,
+      '@version': this.resolveConfigVersion(config['@version'], node.version)
     };
 
     // Use enhanced validator with operation mode by default
@@ -4237,10 +4250,11 @@ Full documentation is being prepared. For now, use get_node_essentials for confi
     // Get properties
     const properties = node.properties || [];
 
-    // Add @version to config for displayOptions evaluation (supports _cnd operators)
+    // Add @version to config for displayOptions evaluation (supports _cnd operators). A
+    // caller may pin a version, but only a real one; anything else keeps the node's version.
     const configWithVersion = {
-      '@version': node.version || 1,
-      ...(config || {})
+      ...(config || {}),
+      '@version': this.resolveConfigVersion(config?.['@version'], node.version)
     };
 
     // Find missing required fields
```

---

### Incident Patch 9: `b0ec17cf` (2026-09-16)
**Commit Message**: merge fix/expr-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -7,6 +7,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.86.2] - 2026-09-16
+
+### Added
+
+- **`$jmespath()` queries inside `{{ }}` expressions are checked** ([#1114](https://github.com/czlonkowski/n8n-mcp/issues/1114)). n8n swallows JMESPath parse errors inside an expression, so the field resolves to `null` while the node reports success, and in a Filter or IF condition every item silently fails the check. `validate_workflow` now reads the query when it is a string literal and reports as errors a bare number in a comparison (`[?revenue > 100000]`; JMESPath literals are backtick-quoted), `and`/`or` in place of `&&`/`||`, a single `=` in place of `==`, and reversed arguments (`$jmespath("query", data)`). A double-quoted right-hand side (`== "PL"`, which JMESPath reads as an identifier) and a bare `true`/`false`/`null` (read as a field name) are warnings. Queries held in a variable or built with `${}` are not followed. The JavaScript Code-node checks use the same module, including for nested calls; Python `_jmespath` is no longer checked there because n8n 2.x native Python does not have it.
+
+### Fixed
+
+- **The "Possible missing $ prefix" warning no longer fires on words inside string literals** ([#1115](https://github.com/czlonkowski/n8n-mcp/issues/1115)). A JMESPath query over `.all()` items has to say `json.` because each item is a `{json: …}` wrapper, and the warning read that as a missing `$`. String, template and regex literal contents are blanked before the check; the bare words outside literals still warn. Over the 2,352 bundled templates this removed 60 of 73 such warnings and added no new finding.
 ## [2.86.1] - 2026-09-16
 
 ### Fixed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.1",
+  "version": "2.86.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.1",
+      "version": "2.86.2",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.1",
+  "version": "2.86.2",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
@@ -44,7 +44,7 @@
     "test:unit": "vitest run tests/unit",
     "test:cjs-runtime": "node scripts/smoke-cjs-runtime.js",
     "test:integration": "vitest run --config vitest.config.integration.ts",
-    "test:integration:n8n": "vitest run --config vitest.config.integration.ts tests/integration/n8n-api",
+    "test:integration:n8n": "vitest run tests/integration/n8n-api",
     "test:cleanup:orphans": "tsx tests/integration/n8n-api/scripts/cleanup-orphans.ts",
     "test:e2e": "vitest run tests/e2e",
     "lint": "tsc --noEmit",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.1",
+  "version": "2.86.2",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/tools-documentation.ts` (modified, +1/-1)
```diff
@@ -339,7 +339,7 @@ const plus5Days = now.plus({ days: 5 });
 ### JSON Querying
 \`\`\`javascript
 // JMESPath queries
-const result = $jmespath($json, "users[?age > 30].name");
+const result = $jmespath($json, "users[?age > \`30\`].name"); // numbers are backtick literals
 \`\`\`
 
 ## Return Format Requirements
```

---

### Incident Patch 10: `6aa07d92` (2026-09-16)
**Commit Message**: fix(api): folder-move caveat on every rollback outcome; partial restoration telemetry

Conceived by Romuald Członkowski - https://aiadvisors.pl/en
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `src/mcp/handlers-workflow-diff.ts` (modified, +31/-9)
```diff
@@ -177,6 +177,11 @@ export async function handleUpdatePartialWorkflow(
   let workflowBefore: any = null;
   let validationBefore: any = null;
   let validationAfter: any = null;
+  // Set only for the "restore incomplete" (partialRestoration) rollback outcome, deep
+  // inside the update-workflow catch below — hoisted here so the telemetry catch at the
+  // bottom of this function (a sibling of that nested scope, not a descendant of it) can
+  // read it too.
+  let partialRestorationObservedWorkflow: unknown;
 
   try {
     // Debug logging (only in debug mode)
@@ -553,6 +558,10 @@ export async function handleUpdatePartialWorkflow(
                 // observed rather than guessing which of the two known states it's in.
                 partialRestoration = true;
                 observedDraftVersionId = (afterRollback as any)?.versionId;
+                // The verification GET succeeded here — afterRollback IS the real
+                // persisted state, unlike the other non-retained outcomes where we only
+                // know what the server ISN'T holding. Telemetry uses this as workflowAfter.
+                partialRestorationObservedWorkflow = afterRollback;
                 logger.warn('rollback PUT errored and the readback matches neither the prior nor the attempted content', {
                   workflowId: input.id,
                   rollbackError: rollbackErrorMessage,
@@ -646,7 +655,13 @@ export async function handleUpdatePartialWorkflow(
                 'The published version is unchanged.',
                 outcomeSentence,
                 'Retrying with the same credentials will not publish it — the API key needs the workflow:activate scope, and the user needs workflow:publish permission on this workflow.',
-                folderMoveInPayload && rollbackPerformed
+                // A folder move on the first PUT is never rolled back regardless of
+                // outcome (rolled back, retained, incomplete or unconfirmed) — n8n never
+                // returns parentFolderId, so there is nothing to restore it from and no
+                // way to confirm it either way. Gate on the payload alone, not on
+                // rollbackPerformed, or this caveat silently disappears for every
+                // outcome except the clean rollback.
+                folderMoveInPayload
                   ? 'A folder move in the failed update may have persisted — n8n cannot report or restore folder placement.'
                   : '',
               ].filter(Boolean).join(' ');
@@ -657,7 +672,7 @@ export async function handleUpdatePartialWorkflow(
                 ...priorVersionDetail,
                 rollbackPerformed,
                 ...(rollbackVerifiedAfterError ? { rollbackVerifiedAfterError: true } : {}),
-                ...folderMoveDetail,
+                ...(folderMoveInPayload ? { folderMoveMayHavePersisted: true } : {}),
                 ...rollbackErrorDetail,
                 ...warningsDetail,
               };
@@ -875,18 +890,25 @@ export async function handleUpdatePartialWorkflow(
         // `rollbackPerformed: false` in its details — never persisted anything, so
         // workflowBefore remains accurate; do not key this off the presence of a
         // `rollbackPerformed` field, or those cases wrongly fall through to "unknown".
-        // For PUBLISH_FORBIDDEN, report the attempted content only when it's confirmed
-        // still retained (changeRetained). Every other outcome — rolled back, restore
-        // incomplete, or unconfirmed — falls back to workflowBefore: the best known
-        // content, even where it isn't certain (restore incomplete/unconfirmed). Always
-        // recording SOME workflowAfter matters more than precision here — MutationTracker
-        // rejects an event with none, so omitting it here dropped these failures entirely.
+        // For PUBLISH_FORBIDDEN, report the attempted content when it's confirmed still
+        // retained (changeRetained
```

**File**: `tests/unit/mcp/handlers-workflow-diff.test.ts` (modified, +84/-5)
```diff
@@ -1534,12 +1534,12 @@ describe('handlers-workflow-diff', () => {
       expect(result.details).not.toHaveProperty('supersededDraftVersionId');
       expect(result.details).not.toHaveProperty('restoredDraftVersionId');
       expect(result.details).not.toHaveProperty('changeRetained');
-      // Telemetry: a partial restore is neither known state, so workflowAfter falls
-      // back to workflowBefore (the best known content) rather than being omitted.
+      // Telemetry: the verification GET succeeded here, so it IS the real persisted
+      // state — workflowAfter should be that observed content, not workflowBefore.
       await vi.waitFor(() => expect(telemetryMocks.trackWorkflowMutation).toHaveBeenCalled());
-      const [telemetryArgs] = telemetryMocks.trackWorkflowMutation.mock.calls.at(-1)!;
-      expect(telemetryArgs).toHaveProperty('workflowAfter');
-      expect(telemetryArgs.workflowAfter).toEqual(telemetryArgs.workflowBefore);
+      expect(telemetryMocks.trackWorkflowMutation).toHaveBeenCalledWith(
+        expect.objectContaining({ workflowAfter: expect.objectContaining({ name: 'Partially Restored Workflow' }) }),
+      );
     });
 
     it('reports that what persisted could not be confirmed when both the version and content are unchanged after the failed PUT', async () => {
@@ -1630,6 +1630,85 @@ describe('handlers-workflow-diff', () => {
       });
     });
 
+    it('flags folder-move uncertainty when the restore is incomplete (#1124)', async () => {
+      const before = createTestWorkflow({ name: 'Original Workflow', versionId: 'v1' });
+      const attempted = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'v1', parentFolderId: 'folder-2' });
+      const afterPersist = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'draft-1' });
+      const partiallyRestored = createTestWorkflow({ name: 'Partially Restored Workflow', versionId: 'draft-3' });
+
+      const publishForbidden = new N8nApiError(
+        "Your change was saved as a draft. It wasn't published because this API key does not have the workflow:activate scope.",
+        403,
+        'PUBLISH_FORBIDDEN',
+        { reason: 'insufficient_api_key_scope', versionId: 'draft-1' },
+      );
+      const rollbackRejection = new N8nValidationError('Bad request', { field: 'connections' });
+
+      mockApiClient.getWorkflow
+        .mockResolvedValueOnce(before)
+        .mockResolvedValueOnce(afterPersist)
+        .mockResolvedValueOnce(partiallyRestored);
+      mockDiffEngine.applyDiff.mockResolvedValue({
+        success: true,
+        workflow: attempted,
+        operationsApplied: 1,
+        message: 'Success',
+        errors: [],
+      });
+      mockApiClient.updateWorkflow
+        .mockRejectedValueOnce(publishForbidden)
+        .mockRejectedValueOnce(rollbackRejection);
+
+      const result = await handleUpdatePartialWorkflow({
+        id: 'test-id',
+        operations: [{ type: 'updateName', name: 'Renamed Workflow' }, { type: 'moveToFolder', parentFolderId: 'folder-2' }],
+      }, mockRepository);
+
+      expect(result.code).toBe('PUBLISH_FORBIDDEN');
+      expect(result.details).toMatchObject({ observedDraftVersionId: 'draft-3', folderMoveMayHavePersisted: true });
+      expect(result.error).toContain('restore did not complete');
+      expect(result.error).toContain('folder move');
+    });
+
+    it('flags folder-move uncertainty on the unconfirmed (verification-GET-failed) outcome (#1124)', async () => {
+      const before = createTestWorkflow({ name: 'Original Workflow', versionId: 'v1' });
+      const attempted = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'v1', parentFolderId: 'folder-2' });
+      const afterPersist = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'draft-1' });
+
+      const publishForbidden = new N8nApiError(
+        "Your change was saved as a draft. It wasn't published because this API key does not have the workflow:activate scope.",
+       
```

#### Recent Merged Pull Requests:
- **PR #1138** (closed): deps(deps): bump the production-dependencies group across 1 directory with 85 updates (@dependabot[bot])
- **PR #1137** (2026-09-27): Telemetry: move to telemetry.n8n-mcp.com (2.90.0) (@czlonkowski)
- **PR #1134** (closed): deps(deps): bump the production-dependencies group across 1 directory with 90 updates (@dependabot[bot])
- **PR #1132** (2026-09-23): feat(agents): default projectId to the caller's personal project (v2.89.0) (@czlonkowski)
- **PR #1131** (2026-09-23): chore: update n8n to 2.40.x (v2.88.0) (@czlonkowski)
- **PR #1130** (closed): deps(deps): bump the production-dependencies group across 1 directory with 97 updates (@dependabot[bot])
- **PR #1129** (closed): deps-dev(deps-dev): bump the development-dependencies group across 1 directory with 11 updates (@dependabot[bot])
- **PR #1128** (closed): ci(deps): bump github/gh-aw-actions/setup from 0.68.3 to 0.89.16 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
