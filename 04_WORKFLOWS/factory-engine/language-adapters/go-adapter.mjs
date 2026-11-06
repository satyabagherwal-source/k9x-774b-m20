/**
 * Go Language Semantic Adapter
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\language-adapters\go-adapter.mjs
 * Purpose: Provides syntax-directed semantic analysis for Go codebases:
 *          - Package declarations
 *          - Multi-line import blocks
 *          - Struct and interface definitions
 *          - Functions and receiver methods
 *          - Go capital-letter export convention identification
 *
 * Capabilities:
 *   syntax_aware: true
 *   ast_level: 'SYNTAX_SCANNER_PARTIAL'
 *   symbol_extraction: 'FULL'
 *   control_flow: 'PARTIAL'
 *   data_flow: 'PARTIAL'
 *
 * Zero external dependencies. Native Node.js ES Module.
 */

import crypto from 'crypto';
import { BaseLanguageAdapter } from './base-language-adapter.mjs';

function sha256(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

export class GoAdapter extends BaseLanguageAdapter {
  constructor() {
    super({
      name: 'Go Semantic Adapter',
      extensions: ['.go'],
      capabilities: {
        syntax_aware: true,
        ast_level: 'SYNTAX_SCANNER_PARTIAL',
        symbol_extraction: 'FULL',
        control_flow: 'PARTIAL',
        data_flow: 'PARTIAL'
      }
    });
  }

  parseFile(fileRecord, content, options = {}) {
    if (!content) {
      return {
        file: fileRecord.relativePath,
        symbols: [],
        imports: [],
        exports: [],
        control_flows: [],
        data_flows: [],
        limitations: this.reportLimitations()
      };
    }

    const relPath = fileRecord.relativePath;
    const lines = content.split(/\r?\n/);
    const symbols = [];
    const imports = [];
    const controlFlows = [];
    let inImportBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      if (!trimmed || trimmed.startsWith('//')) continue;

      // 1. Imports
      if (trimmed.startsWith('import (')) {
        inImportBlock = true;
        continue;
      }
      if (inImportBlock) {
        if (trimmed === ')') {
          inImportBlock = false;
          continue;
        }
        const m = trimmed.match(/(?:([a-zA-Z0-9_]+)\s+)?['"]([^'"]+)['"]/);
        if (m) {
          imports.push({
            source: m[2],
            alias: m[1] || null,
            line: lineNum,
            is_relative: m[2].startsWith('.'),
            evidence: trimmed
          });
        }
        continue;
      }
      const singleImport = trimmed.match(/^import\s+(?:([a-zA-Z0-9_]+)\s+)?['"]([^'"]+)['"]/);
      if (singleImport) {
        imports.push({
          source: singleImport[2],
          alias: singleImport[1] || null,
          line: lineNum,
          is_relative: singleImport[2].startsWith('.'),
          evidence: trimmed
        });
        continue;
      }

      // 2. Struct and Interface types
      const typeMatch = trimmed.match(/^type\s+([a-zA-Z0-9_]+)\s+(struct|interface)/);
      if (typeMatch) {
        const typeName = typeMatch[1];
        const kind = typeMatch[2].toUpperCase();
        const isExported = /^[A-Z]/.test(typeName);

        symbols.push({
          id: `SYM-${sha256(`${relPath}:${typeName}`).slice(0, 8)}`,
          name: typeName,
          kind: kind === 'STRUCT' ? 'CLASS' : 'INTERFACE',
          exported: isExported,
          line_start: lineNum,
          file: relPath,
          excerpt: trimmed
        });
        continue;
      }

      // 3. Functions and Methods: func (r *Receiver) MethodName(...) ...
      const methodMatch = trimmed.match(/^func\s+\(\s*([a-zA-Z0-9_]+)\s+\*?([a-zA-Z0-9_]+)\s*\)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
      if (methodMatch) {
        const receiverType = methodMatch[2];
        const methodName = methodMatch[3];
        const isExported = /^[A-Z]/.test(methodName);

        symbols.push({
          id: `SYM-${sha256(`${relPath}:${receiverType}.${methodName}`).slice(0, 8)}`,
          name: methodName,
          kind: 'METHOD',
          exported: isExported,
          enclosing_class: receiverType,
          line_start: lineNum,
          file: relPath,
          excerpt: trimmed
        });
        continue;
      }

      // Normal function: func FunctionName(...)
      const funcMatch = trimmed.match(/^func\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const isExported = /^[A-Z]/.test(funcName);

        symbols.push({
          id: `SYM-${sha256(`${relPath}:${funcName}`).slice(0, 8)}`,
          name: funcName,
          kind: 'FUNCTION',
          exported: isExported,
          line_start: lineNum,
          file: relPath,
          excerpt: trimmed
        });
        continue;
      }
    }

    return {
      file: relPath,
      language: 'Go',
      adapter: this.name,
      ast_level: this.capabilities.ast_level,
      symbols,
      imports,
      exports: symbols.filter(s => s.exported).map(s => ({ name: s.name, line: s.line_start })),
      control_flows: controlFlows,
      data_flows: [],
      limitations: this.reportLimitations()
    };
  }

  reportLimitations() {
    return [
      'Go implicit interface satisfaction across separate packages is not resolved without full build context.',
      'Goroutine channels and select statement message topologies are partially analyzed.',
      'Cgo C bindings and assembly code files are unsupported.'
    ];
  }
}

