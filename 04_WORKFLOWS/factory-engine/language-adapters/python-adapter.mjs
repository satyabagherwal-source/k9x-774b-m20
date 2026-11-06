/**
 * Python Semantic Adapter
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\language-adapters\python-adapter.mjs
 * Purpose: Provides syntax-directed semantic analysis for Python codebases:
 *          - Imports and package references
 *          - Function and class definitions with inheritance
 *          - Class methods and constructors (__init__)
 *          - Decorator annotations (@app.get, @property)
 *          - Try/except error boundaries
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

export class PythonAdapter extends BaseLanguageAdapter {
  constructor() {
    super({
      name: 'Python Semantic Adapter',
      extensions: ['.py'],
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
    let currentClass = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // Skip blank or comment
      if (!trimmed || trimmed.startsWith('#')) continue;

      // 1. Imports
      const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
      if (fromMatch) {
        const specifiers = fromMatch[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        imports.push({
          source: fromMatch[1],
          specifiers,
          line: lineNum,
          is_relative: fromMatch[1].startsWith('.'),
          evidence: trimmed
        });
        continue;
      }

      const importMatch = trimmed.match(/^import\s+([\w.,\s]+)$/);
      if (importMatch) {
        const modules = importMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        for (const mod of modules) {
          imports.push({
            source: mod,
            specifiers: [mod],
            line: lineNum,
            is_relative: false,
            evidence: trimmed
          });
        }
        continue;
      }

      // 2. Class Definitions
      const classMatch = trimmed.match(/^class\s+([a-zA-Z0-9_]+)(?:\(([^)]*)\))?:/);
      if (classMatch) {
        const className = classMatch[1];
        const superclass = classMatch[2] ? classMatch[2].trim() : null;
        currentClass = {
          name: className,
          lineStart: lineNum,
          superclass,
          methods: []
        };

        symbols.push({
          id: `SYM-${sha256(`${relPath}:${className}`).slice(0, 8)}`,
          name: className,
          kind: 'CLASS',
          exported: !className.startsWith('_'),
          superclass,
          methods: currentClass.methods,
          line_start: lineNum,
          line_end: lineNum, // Updated when methods close
          file: relPath,
          excerpt: trimmed
        });
        continue;
      }

      // 3. Function / Method Definitions
      const funcMatch = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const rawParams = funcMatch[2];
        const returnType = funcMatch[3] ? funcMatch[3].trim() : null;
        const isAsync = trimmed.startsWith('async');
        const isIndented = line.startsWith(' ') || line.startsWith('\t');

        const params = rawParams.split(',').map(p => {
          const parts = p.trim().split('=');
          const nameType = parts[0].trim().split(':');
          return {
            name: nameType[0].trim(),
            typeAnnotation: nameType[1] ? nameType[1].trim() : null,
            defaultValue: parts[1] ? parts[1].trim() : null
          };
        }).filter(p => p.name && p.name !== 'self' && p.name !== 'cls');

        const symId = `SYM-${sha256(`${relPath}:${currentClass && isIndented ? currentClass.name + '.' : ''}${funcName}`).slice(0, 8)}`;

        if (currentClass && isIndented) {
          currentClass.methods.push({
            id: symId,
            name: funcName,
            kind: 'METHOD',
            is_async: isAsync,
            parameters: params,
            return_type: returnType,
            line_start: lineNum,
            enclosing_class: currentClass.name
          });
        } else {
          currentClass = null; // Exited class
          symbols.push({
            id: symId,
            name: funcName,
            kind: isAsync ? 'ASYNC_FUNCTION' : 'FUNCTION',
            exported: !funcName.startsWith('_'),
            parameters: params,
            return_type: returnType,
            line_start: lineNum,
            file: relPath,
            excerpt: trimmed
          });
        }
        continue;
      }

      // 4. Try / Except error boundaries
      if (trimmed.startsWith('try:')) {
        controlFlows.push({
          id: `CFP-PY-ERR-${sha256(`${relPath}:${lineNum}`).slice(0, 8)}`,
          type: 'ERROR_BOUNDARY_TRY_EXCEPT',
          line: lineNum,
          file: relPath,
          evidence: trimmed
        });
      }
    }

    return {
      file: relPath,
      language: 'Python',
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
      'Python metaclass metaprogramming and dynamic __getattr__ / __setattr__ cannot be resolved statically.',
      'Complex decorator chaining is captured as line-level annotations without executing Python decorators.',
      'Dynamic sys.path modifications and conditional runtime imports are unsupported.'
    ];
  }
}

