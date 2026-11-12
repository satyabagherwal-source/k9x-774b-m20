#!/usr/bin/env node
/**
 * Agentic Knowledge Gateway (agentic-kgw) — CLI Interface
 * Executable command line utility for safe AI knowledge extraction & inspection
 */

import fs from 'fs';
import path from 'path';
import {
  extractJSON,
  ExtractJSONError,
  slugifyHeading,
  generateTableOfContents,
  inspectModelBinaryEnvelope,
  clampContext,
  validateExtractionConfig,
  VERSION
} from '../src/index.mjs';

const HELP_TEXT = `agentic-kgw — Agentic Knowledge Gateway CLI v${VERSION}

USAGE:
  agentic-kgw <command> [arguments] [options]

COMMANDS:
  extract-json <input-file-or-string>
      Extracts a clean, balanced JSON object from noisy, conversational,
      or Markdown-fenced LLM outputs.
      Options:
        --file <path>       Read input from specified file path
        --pretty            Pretty-print JSON output with 2-space indentation

  slugify <heading-or-file>
      Generates deterministic GitHub-standard URL anchor slugs from headings
      or outputs a complete Table of Contents from a Markdown document.
      Options:
        --file <path>       Parse all headings in markdown file into a TOC table

  inspect-artifact <binary-file-path>
      Safely inspects binary model files (GGUF / Safetensors) with memory bounds
      checking, format identification, and overflow attack prevention.
      Options:
        --max-header-mb <N> Maximum allowed header size in MB (default: 25)

  validate-config <json-config-or-file>
      Validates model generation parameters to enforce deterministic decoding
      (temperature=0, greedy sampling) for reliable entity extraction.

  version
      Displays the current gateway version.

  help
      Displays this help documentation.

EXIT CODES:
  0   Success
  1   Validation / Parsing / Corrupted artifact error
  2   CLI usage or invalid arguments error
`;

async function readInputString(arg, options = {}) {
  if (options.file) {
    if (!fs.existsSync(options.file)) {
      throw new Error(`Input file not found: ${options.file}`);
    }
    return fs.readFileSync(options.file, 'utf8');
  }

  if (arg === '-' || (!arg && !process.stdin.isTTY)) {
    // Read from standard input
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });
  }

  if (!arg) {
    throw new Error('Missing input argument or --file parameter.');
  }

  // Check if arg is an existing file path
  if (fs.existsSync(arg)) {
    return fs.readFileSync(arg, 'utf8');
  }

  return arg;
}

function parseCliArgs(args) {
  const command = args[0];
  const rest = args.slice(1);
  const options = {};
  const positional = [];

  for (let i = 0; i < rest.length; i++) {
    const item = rest[i];
    if (item.startsWith('--')) {
      const key = item.slice(2);
      if (key === 'pretty' || key === 'strict') {
        options[key] = true;
      } else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
        options[key] = rest[i + 1];
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(item);
    }
  }

  return { command, positional, options };
}

export async function main(cliArgs = process.argv.slice(2)) {
  const { command, positional, options } = parseCliArgs(cliArgs);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    process.stdout.write(`agentic-kgw v${VERSION}\n`);
    return 0;
  }

  try {
    switch (command) {
      case 'extract-json': {
        const raw = await readInputString(positional[0], options);
        const result = extractJSON(raw);
        const output = options.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
        process.stdout.write(output + '\n');
        return 0;
      }

      case 'slugify': {
        if (options.file) {
          const content = fs.readFileSync(options.file, 'utf8');
          const toc = generateTableOfContents(content);
          process.stdout.write(JSON.stringify(toc, null, 2) + '\n');
          return 0;
        }
        const text = positional.join(' ');
        if (!text) {
          process.stderr.write('Error: slugify requires a heading string or --file <path>\n');
          return 2;
        }
        const slug = slugifyHeading(text);
        process.stdout.write(slug + '\n');
        return 0;
      }

      case 'inspect-artifact': {
        const filePath = positional[0] || options.file;
        if (!filePath) {
          process.stderr.write('Error: inspect-artifact requires a file path argument\n');
          return 2;
        }
        if (!fs.existsSync(filePath)) {
          process.stderr.write(`Error: File not found: ${filePath}\n`);
          return 1;
        }
        const maxMb = options['max-header-mb'] ? Number(options['max-header-mb']) : 25;
        const buffer = fs.readFileSync(filePath);
        const report = inspectModelBinaryEnvelope(buffer, maxMb * 1024 * 1024);
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return 0;
      }

      case 'validate-config': {
        const raw = await readInputString(positional[0], options);
        let configObj;
        try {
          configObj = JSON.parse(raw);
        } catch {
          configObj = extractJSON(raw);
        }
        const validated = validateExtractionConfig(configObj);
        process.stdout.write(JSON.stringify(validated, null, 2) + '\n');
        return 0;
      }

      case 'clamp-context': {
        const len = Number(positional[0]);
        const max = options.max ? Number(options.max) : 32768;
        const res = clampContext(len, max, !!options.strict);
        process.stdout.write(JSON.stringify(res, null, 2) + '\n');
        return 0;
      }

      default: {
        process.stderr.write(`Unknown command: "${command}". Run "agentic-kgw help" for available commands.\n`);
        return 2;
      }
    }
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return 1;
  }
}

// Direct invocation check
if (process.argv[1] && (process.argv[1].endsWith('cli.mjs') || process.argv[1].endsWith('agentic-kgw'))) {
  main().then(code => process.exit(code));
}

