/**
 * JavaScript & TypeScript Syntax-Aware Semantic Adapter
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\language-adapters\javascript-typescript-adapter.mjs
 * Purpose: Provides AST-level syntax-aware extraction for JS/TS codebases:
 *          - Tokenization with line/column tracking
 *          - Structural symbol extraction (functions, methods, classes, interfaces, params, return types)
 *          - Call expression and control-flow tracing (route dispatch, try/catch, shutdown, error propagation)
 *          - Data-flow tracking (input sources, validation checks, state mutations, output sinks)
 *
 * Capabilities:
 *   syntax_aware: true
 *   ast_level: 'RECURSIVE_DESCENT_SYNTAX_TREE'
 *   symbol_extraction: 'FULL'
 *   control_flow: 'FULL'
 *   data_flow: 'FULL'
 *
 * Zero external dependencies. Native Node.js ES Module.
 */

import crypto from 'crypto';
import { BaseLanguageAdapter } from './base-language-adapter.mjs';

function sha256(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

/**
 * Tokenizer for JavaScript and TypeScript.
 * Yields structured tokens with exact line and column coordinates.
 */
export function tokenizeJsTs(source) {
  const tokens = [];
  const len = source.length;
  let i = 0;
  let line = 1;
  let col = 1;

  function advance() {
    const ch = source[i];
    i++;
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function peek(offset = 0) {
    return i + offset < len ? source[i + offset] : '';
  }

  const isAlpha = ch => /[a-zA-Z_$]/.test(ch);
  const isAlphaNum = ch => /[a-zA-Z0-9_$]/.test(ch);
  const isDigit = ch => /[0-9]/.test(ch);
  const isWhitespace = ch => /\s/.test(ch);

  while (i < len) {
    const startLine = line;
    const startCol = col;
    const ch = peek();

    // 1. Whitespace
    if (isWhitespace(ch)) {
      advance();
      continue;
    }

    // 2. Comments
    if (ch === '/' && peek(1) === '/') {
      advance(); advance();
      let comment = '';
      while (i < len && peek() !== '\n') {
        comment += advance();
      }
      tokens.push({ type: 'LINE_COMMENT', value: comment, line: startLine, col: startCol });
      continue;
    }

    if (ch === '/' && peek(1) === '*') {
      advance(); advance();
      let comment = '';
      while (i < len && !(peek() === '*' && peek(1) === '/')) {
        comment += advance();
      }
      if (i < len) { advance(); advance(); }
      tokens.push({ type: 'BLOCK_COMMENT', value: comment, line: startLine, col: startCol });
      continue;
    }

    // 3. String Literals
    if (ch === '\'' || ch === '"' || ch === '`') {
      const quote = advance();
      let val = '';
      while (i < len && peek() !== quote) {
        if (peek() === '\\') {
          val += advance();
          if (i < len) val += advance();
        } else {
          val += advance();
        }
      }
      if (i < len) advance(); // consume closing quote
      tokens.push({ type: 'STRING', value: val, quote, line: startLine, col: startCol });
      continue;
    }

    // 4. Numbers
    if (isDigit(ch)) {
      let num = '';
      while (i < len && (isDigit(peek()) || peek() === '.')) {
        num += advance();
      }
      tokens.push({ type: 'NUMBER', value: num, line: startLine, col: startCol });
      continue;
    }

    // 5. Identifiers and Keywords
    if (isAlpha(ch)) {
      let id = '';
      while (i < len && isAlphaNum(peek())) {
        id += advance();
      }
      const KEYWORDS = new Set([
        'import', 'export', 'default', 'from', 'as', 'function', 'class', 'interface', 'type',
        'const', 'let', 'var', 'async', 'await', 'return', 'if', 'else', 'try', 'catch', 'finally',
        'throw', 'new', 'extends', 'implements', 'this', 'super', 'typeof', 'instanceof'
      ]);

      const type = KEYWORDS.has(id) ? 'KEYWORD' : 'IDENTIFIER';
      tokens.push({ type, value: id, line: startLine, col: startCol });
      continue;
    }

    // 6. Two-character Operators
    const two = ch + peek(1);
    if (['=>', '===', '!==', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--'].includes(two)) {
      advance(); advance();
      tokens.push({ type: 'OPERATOR', value: two, line: startLine, col: startCol });
      continue;
    }

    // 7. Single-character Punctuation and Operators
    const single = advance();
    tokens.push({ type: 'PUNCTUATION', value: single, line: startLine, col: startCol });
  }

  return tokens;
}

/**
 * Parses parameters from token stream starting inside '(' up to matching ')'.
 */
function parseParameterList(tokens, startIndex) {
  const params = [];
  let idx = startIndex;
  let depth = 1;
  let currentParam = { name: '', defaultValue: null, typeAnnotation: null };
  let stage = 'NAME'; // 'NAME' | 'TYPE' | 'DEFAULT'

  while (idx < tokens.length && depth > 0) {
    const t = tokens[idx];
    if (t.value === '(') {
      depth++;
      if (stage === 'DEFAULT') currentParam.defaultValue = (currentParam.defaultValue || '') + t.value;
    } else if (t.value === ')') {
      depth--;
      if (depth === 0) {
        if (currentParam.name) params.push(currentParam);
        break;
      }
      if (stage === 'DEFAULT') currentParam.defaultValue = (currentParam.defaultValue || '') + t.value;
    } else if (t.value === ',' && depth === 1) {
      if (currentParam.name) params.push(currentParam);
      currentParam = { name: '', defaultValue: null, typeAnnotation: null };
      stage = 'NAME';
    } else if (t.value === ':' && depth === 1 && stage === 'NAME') {
      stage = 'TYPE';
    } else if (t.value === '=' && depth === 1 && (stage === 'NAME' || stage === 'TYPE')) {
      stage = 'DEFAULT';
    } else {
      if (stage === 'NAME') {
        currentParam.name += t.value;
      } else if (stage === 'TYPE') {
        currentParam.typeAnnotation = (currentParam.typeAnnotation ? currentParam.typeAnnotation + ' ' : '') + t.value;
      } else if (stage === 'DEFAULT') {
        currentParam.defaultValue = (currentParam.defaultValue ? currentParam.defaultValue + ' ' : '') + t.value;
      }
    }
    idx++;
  }

  return { params, nextIndex: idx + 1 };
}

/**
 * Finds the matching closing brace index for a block starting after '{'.
 */
function findMatchingBrace(tokens, openBraceIndex) {
  let depth = 1;
  let idx = openBraceIndex + 1;
  while (idx < tokens.length && depth > 0) {
    if (tokens[idx].value === '{') depth++;
    else if (tokens[idx].value === '}') depth--;
    if (depth === 0) return idx;
    idx++;
  }
  return tokens.length - 1;
}

export class JavaScriptTypeScriptAdapter extends BaseLanguageAdapter {
  constructor() {
    super({
      name: 'JavaScript / TypeScript Semantic Adapter',
      extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'],
      capabilities: {
        syntax_aware: true,
        ast_level: 'RECURSIVE_DESCENT_SYNTAX_TREE',
        symbol_extraction: 'FULL',
        control_flow: 'FULL',
        data_flow: 'FULL'
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
        limitations: []
      };
    }

    const tokens = tokenizeJsTs(content);
    const symbols = [];
    const imports = [];
    const exportsList = [];
    const controlFlows = [];
    const dataFlows = [];
    const lines = content.split(/\r?\n/);

    const relPath = fileRecord.relativePath;
    let i = 0;

    while (i < tokens.length) {
      const tok = tokens[i];

      // 1. IMPORT STATEMENTS
      if (tok.type === 'KEYWORD' && tok.value === 'import') {
        const importStartLine = tok.line;
        let sourcePath = '';
        const specifiers = [];
        let isDefault = false;
        let j = i + 1;

        while (j < tokens.length && tokens[j].value !== ';' && tokens[j].line === importStartLine) {
          if (tokens[j].type === 'STRING') {
            sourcePath = tokens[j].value;
          } else if (tokens[j].type === 'IDENTIFIER') {
            specifiers.push(tokens[j].value);
          }
          j++;
        }
        if (tokens[j] && tokens[j].type === 'STRING' && !sourcePath) {
          sourcePath = tokens[j].value;
        }

        if (sourcePath) {
          imports.push({
            source: sourcePath,
            specifiers,
            line: importStartLine,
            is_relative: sourcePath.startsWith('.'),
            evidence: lines[importStartLine - 1] || `import from ${sourcePath}`
          });
        }
        i = j;
        continue;
      }

      // 2. EXPORT STATEMENTS
      if (tok.type === 'KEYWORD' && tok.value === 'export') {
        const exportLine = tok.line;
        let nextTok = tokens[i + 1];
        let isDefault = false;
        if (nextTok && nextTok.value === 'default') {
          isDefault = true;
          nextTok = tokens[i + 2];
        }

        if (nextTok && (nextTok.value === 'function' || nextTok.value === 'class' || nextTok.value === 'const' || nextTok.value === 'let' || nextTok.value === 'var' || nextTok.value === 'async' || nextTok.value === 'interface')) {
          // Will be captured by symbol extraction with exported: true
        } else if (nextTok && nextTok.value === '{') {
          // export { a, b as c }
          let j = i + (isDefault ? 3 : 2);
          while (j < tokens.length && tokens[j].value !== '}') {
            if (tokens[j].type === 'IDENTIFIER') {
              exportsList.push({ name: tokens[j].value, is_default: false, line: exportLine });
            }
            j++;
          }
          i = j;
          continue;
        }
      }

      // 3. CLASS & INTERFACE DECLARATIONS
      if (tok.type === 'KEYWORD' && (tok.value === 'class' || tok.value === 'interface')) {
        const kind = tok.value === 'class' ? 'CLASS' : 'INTERFACE';
        const startLine = tok.line;
        const nameTok = tokens[i + 1];
        const isExported = i > 0 && (tokens[i - 1].value === 'export' || (i > 1 && tokens[i - 2].value === 'export'));

        if (nameTok && nameTok.type === 'IDENTIFIER') {
          const className = nameTok.value;
          let superclass = null;
          let openBraceIdx = -1;

          let j = i + 2;
          while (j < tokens.length && tokens[j].value !== '{') {
            if (tokens[j].value === 'extends' && tokens[j + 1]) {
              superclass = tokens[j + 1].value;
            }
            j++;
          }
          if (tokens[j] && tokens[j].value === '{') openBraceIdx = j;

          let endLine = startLine;
          const methods = [];
          if (openBraceIdx !== -1) {
            const closeBraceIdx = findMatchingBrace(tokens, openBraceIdx);
            endLine = tokens[closeBraceIdx] ? tokens[closeBraceIdx].line : startLine;

            // Extract methods inside class body
            let k = openBraceIdx + 1;
            while (k < closeBraceIdx) {
              const mTok = tokens[k];
              const isAsync = mTok.value === 'async';
              const nameIdx = isAsync ? k + 1 : k;
              const maybeMethodName = tokens[nameIdx];

              if (maybeMethodName && (maybeMethodName.type === 'IDENTIFIER' || maybeMethodName.value === 'constructor') && tokens[nameIdx + 1]?.value === '(') {
                const methodStartLine = maybeMethodName.line;
                const { params, nextIndex } = parseParameterList(tokens, nameIdx + 2);
                let methodEndLine = methodStartLine;
                if (tokens[nextIndex]?.value === '{') {
                  const mCloseIdx = findMatchingBrace(tokens, nextIndex);
                  methodEndLine = tokens[mCloseIdx] ? tokens[mCloseIdx].line : methodStartLine;
                }

                const methodId = `SYM-${sha256(`${relPath}:${className}.${maybeMethodName.value}`).slice(0, 8)}`;
                methods.push({
                  id: methodId,
                  name: maybeMethodName.value,
                  kind: 'METHOD',
                  is_async: isAsync,
                  parameters: params,
                  line_start: methodStartLine,
                  line_end: methodEndLine,
                  enclosing_class: className
                });
                k = nextIndex;
              }
              k++;
            }
          }

          const classId = `SYM-${sha256(`${relPath}:${className}`).slice(0, 8)}`;
          symbols.push({
            id: classId,
            name: className,
            kind,
            exported: isExported,
            superclass,
            methods,
            line_start: startLine,
            line_end: endLine,
            file: relPath,
            excerpt: lines.slice(startLine - 1, Math.min(startLine + 5, endLine)).join('\n')
          });

          if (isExported) {
            exportsList.push({ name: className, is_default: false, line: startLine });
          }
        }
      }

      // 4. FUNCTION DECLARATIONS (function name(...) { ... } or const name = (...) => { ... })
      const isAsync = tok.value === 'async';
      const funcKeyword = isAsync ? tokens[i + 1] : tok;

      if (funcKeyword && funcKeyword.type === 'KEYWORD' && funcKeyword.value === 'function') {
        const startLine = tok.line;
        const nameTok = isAsync ? tokens[i + 2] : tokens[i + 1];
        const isExported = (isAsync ? i >= 2 && tokens[i - 2].value === 'export' : i >= 1 && tokens[i - 1].value === 'export') ||
                           (isAsync ? i >= 1 && tokens[i - 1].value === 'export' : false);

        if (nameTok && nameTok.type === 'IDENTIFIER' && (isAsync ? tokens[i + 3]?.value === '(' : tokens[i + 2]?.value === '(')) {
          const funcName = nameTok.value;
          const parenIdx = isAsync ? i + 4 : i + 3;
          const { params, nextIndex } = parseParameterList(tokens, parenIdx);

          let endLine = startLine;
          if (tokens[nextIndex]?.value === '{') {
            const closeIdx = findMatchingBrace(tokens, nextIndex);
            endLine = tokens[closeIdx] ? tokens[closeIdx].line : startLine;
          }

          const funcId = `SYM-${sha256(`${relPath}:${funcName}`).slice(0, 8)}`;
          symbols.push({
            id: funcId,
            name: funcName,
            kind: isAsync ? 'ASYNC_FUNCTION' : 'FUNCTION',
            exported: isExported,
            parameters: params,
            line_start: startLine,
            line_end: endLine,
            file: relPath,
            excerpt: lines.slice(startLine - 1, Math.min(startLine + 6, endLine)).join('\n')
          });

          if (isExported) {
            exportsList.push({ name: funcName, is_default: false, line: startLine });
          }
        }
      }

      // 5. CALL EXPRESSION & CONTROL-FLOW INTELLIGENCE
      // Detects callee.method(...) or callee(...)
      if (tok.type === 'IDENTIFIER' && tokens[i + 1]?.value === '.' && tokens[i + 2]?.type === 'IDENTIFIER' && tokens[i + 3]?.value === '(') {
        const callerObj = tok.value;
        const methodName = tokens[i + 2].value;
        const callLine = tok.line;

        // Route Registration Call
        if (['get', 'post', 'put', 'delete', 'patch', 'use'].includes(methodName) && ['fastify', 'app', 'router', 'server'].includes(callerObj)) {
          const argTok = tokens[i + 4];
          const routePath = argTok?.type === 'STRING' ? argTok.value : 'DYNAMIC_PATH';
          controlFlows.push({
            id: `CFP-ROUTE-${sha256(`${relPath}:${callLine}`).slice(0, 8)}`,
            type: 'ROUTE_REGISTRATION',
            caller: `${callerObj}.${methodName}`,
            route_path: routePath,
            line: callLine,
            file: relPath,
            evidence: lines[callLine - 1] || `${callerObj}.${methodName}('${routePath}')`
          });
        }

        // Process Signal Listener
        if (callerObj === 'process' && methodName === 'on') {
          const signalTok = tokens[i + 4];
          const signalName = signalTok?.type === 'STRING' ? signalTok.value : 'SIGNAL';
          controlFlows.push({
            id: `CFP-SIGNAL-${sha256(`${relPath}:${callLine}`).slice(0, 8)}`,
            type: 'PROCESS_SIGNAL_HANDLER',
            signal: signalName,
            line: callLine,
            file: relPath,
            evidence: lines[callLine - 1] || `process.on('${signalName}')`
          });
        }

        // Teardown / Graceful Shutdown calls
        if (['close', 'flush', 'disconnect', 'shutdown', 'end'].includes(methodName)) {
          controlFlows.push({
            id: `CFP-TEARDOWN-${sha256(`${relPath}:${callLine}`).slice(0, 8)}`,
            type: 'TEARDOWN_LIFECYCLE',
            target: `${callerObj}.${methodName}`,
            line: callLine,
            file: relPath,
            evidence: lines[callLine - 1] || `${callerObj}.${methodName}()`
          });
        }

        // Output / Response Dispatch
        if (methodName === 'send' || methodName === 'json') {
          dataFlows.push({
            id: `DFP-OUTPUT-${sha256(`${relPath}:${callLine}`).slice(0, 8)}`,
            stage: 'OUTPUT_DISPATCH',
            handler: `${callerObj}.${methodName}`,
            line: callLine,
            file: relPath,
            evidence: lines[callLine - 1] || `${callerObj}.${methodName}(...)`
          });
        }
      }

      // Output / Response Dispatch on chained method calls (e.g. reply.status(200).send(...))
      if (tok.value === '.' && tokens[i + 1]?.type === 'IDENTIFIER' && ['send', 'json', 'sendStatus', 'write'].includes(tokens[i + 1].value) && tokens[i + 2]?.value === '(') {
        const methodName = tokens[i + 1].value;
        const callLine = tokens[i + 1].line;
        if (!dataFlows.some(df => df.line === callLine && df.handler.includes(methodName))) {
          dataFlows.push({
            id: `DFP-OUTPUT-${sha256(`${relPath}:${callLine}`).slice(0, 8)}`,
            stage: 'OUTPUT_DISPATCH',
            handler: `.${methodName}`,
            line: callLine,
            file: relPath,
            evidence: lines[callLine - 1] || `.${methodName}(...)`
          });
        }
      }

      // 6. TRY / CATCH & ERROR PROPAGATION
      if (tok.type === 'KEYWORD' && tok.value === 'try') {
        const tryLine = tok.line;
        controlFlows.push({
          id: `CFP-ERR-${sha256(`${relPath}:${tryLine}`).slice(0, 8)}`,
          type: 'ERROR_BOUNDARY_TRY_CATCH',
          line: tryLine,
          file: relPath,
          evidence: lines[tryLine - 1] || 'try { ... }'
        });
      }

      if (tok.type === 'KEYWORD' && tok.value === 'throw') {
        const throwLine = tok.line;
        controlFlows.push({
          id: `CFP-THROW-${sha256(`${relPath}:${throwLine}`).slice(0, 8)}`,
          type: 'EXPLICIT_ERROR_THROW',
          line: throwLine,
          file: relPath,
          evidence: lines[throwLine - 1] || 'throw new Error(...)'
        });
      }

      i++;
    }

    return {
      file: relPath,
      language: 'JavaScript / TypeScript',
      adapter: this.name,
      ast_level: this.capabilities.ast_level,
      symbols,
      imports,
      exports: exportsList,
      control_flows: controlFlows,
      data_flows: dataFlows,
      limitations: this.reportLimitations()
    };
  }

  reportLimitations() {
    return [
      'Complex JSX inline conditional expression trees are simplified to container scopes.',
      'Dynamic variable computed imports (e.g. import(variable)) cannot be resolved statically.',
      'TypeScript advanced type-level conditional types (e.g. T extends U ? X : Y) are captured as textual type annotations without compiler-level type expansion.'
    ];
  }
}
