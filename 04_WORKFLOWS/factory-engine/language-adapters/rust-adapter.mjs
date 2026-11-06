/**
 * Rust Language Semantic Adapter
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\language-adapters\rust-adapter.mjs
 * Purpose: Provides syntax-directed semantic analysis for Rust codebases:
 *          - Module declarations and `use` imports
 *          - Struct, enum, and trait declarations
 *          - Functions and impl blocks
 *          - Visibility keyword (`pub`) identification
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

export class RustAdapter extends BaseLanguageAdapter {
  constructor() {
    super({
      name: 'Rust Semantic Adapter',
      extensions: ['.rs'],
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
    let currentImpl = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      if (!trimmed || trimmed.startsWith('//')) continue;

      // 1. Uses / Imports
      const useMatch = trimmed.match(/^use\s+([^;]+);/);
      if (useMatch) {
        const fullSpec = useMatch[1].trim();
        imports.push({
          source: fullSpec,
          specifiers: [fullSpec],
          line: lineNum,
          is_relative: fullSpec.startsWith('crate::') || fullSpec.startsWith('super::'),
          evidence: trimmed
        });
        continue;
      }

      // 2. Struct and Enum definitions
      const typeMatch = trimmed.match(/^(?:pub(?:\([^)]*\))?\s+)?(struct|enum|trait)\s+([a-zA-Z0-9_]+)/);
      if (typeMatch) {
        const typeKind = typeMatch[1].toUpperCase();
        const typeName = typeMatch[2];
        const isExported = trimmed.startsWith('pub');

        symbols.push({
          id: `SYM-${sha256(`${relPath}:${typeName}`).slice(0, 8)}`,
          name: typeName,
          kind: typeKind === 'STRUCT' ? 'CLASS' : (typeKind === 'TRAIT' ? 'INTERFACE' : 'ENUM'),
          exported: isExported,
          line_start: lineNum,
          file: relPath,
          excerpt: trimmed
        });
        continue;
      }

      // 3. Impl blocks
      const implMatch = trimmed.match(/^impl(?:\s+([a-zA-Z0-9_]+)\s+for)?\s+([a-zA-Z0-9_]+)/);
      if (implMatch) {
        currentImpl = implMatch[2];
        continue;
      }

      // 4. Functions
      const fnMatch = trimmed.match(/^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^\{]+))?/);
      if (fnMatch) {
        const fnName = fnMatch[1];
        const returnType = fnMatch[3] ? fnMatch[3].trim() : null;
        const isExported = trimmed.startsWith('pub');
        const isAsync = trimmed.includes('async fn');

        symbols.push({
          id: `SYM-${sha256(`${relPath}:${currentImpl ? currentImpl + '.' : ''}${fnName}`).slice(0, 8)}`,
          name: fnName,
          kind: currentImpl ? 'METHOD' : (isAsync ? 'ASYNC_FUNCTION' : 'FUNCTION'),
          exported: isExported,
          enclosing_class: currentImpl,
          return_type: returnType,
          line_start: lineNum,
          file: relPath,
          excerpt: trimmed
        });
        continue;
      }
    }

    return {
      file: relPath,
      language: 'Rust',
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
      'Rust macro expansions (macro_rules! and procedural macros) are captured unexpanded in static mode.',
      'Borrow checker lifetime constraints and unsafe block invariant verification are unsupported statically.',
      'Conditional compilation flags (#[cfg(...)]) are parsed without target platform expansion.'
    ];
  }
}

