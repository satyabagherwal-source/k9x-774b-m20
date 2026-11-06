/**
 * Base Language Adapter Interface
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\language-adapters\base-language-adapter.mjs
 * Purpose: Provides a standardized, extensible interface for multi-language semantic understanding.
 *
 * Invariant: Every adapter must truthfully declare its parsing capabilities and limitation boundaries.
 */

export class BaseLanguageAdapter {
  constructor({
    name = 'Base Adapter',
    extensions = [],
    capabilities = {}
  } = {}) {
    this.name = name;
    this.extensions = extensions.map(e => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`));
    this.capabilities = {
      syntax_aware: Boolean(capabilities.syntax_aware),
      ast_level: capabilities.ast_level || 'UNSUPPORTED',
      symbol_extraction: capabilities.symbol_extraction || 'UNSUPPORTED',
      control_flow: capabilities.control_flow || 'UNSUPPORTED',
      data_flow: capabilities.data_flow || 'UNSUPPORTED'
    };
  }

  /**
   * Tests whether this adapter supports the given file extension.
   */
  supports(ext) {
    if (!ext) return false;
    const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return this.extensions.includes(normalized);
  }

  /**
   * Parses the file content and returns a structured semantic model.
   * Must be overridden by subclasses.
   *
   * @param {object} fileRecord - { path, relativePath, size, ext }
   * @param {string} content - Raw file text
   * @param {object} options - Options
   * @returns {object} FileSemanticModel
   */
  parseFile(fileRecord, content, options = {}) {
    throw new Error(`METHOD_NOT_IMPLEMENTED: parseFile must be implemented by ${this.constructor.name}`);
  }

  /**
   * Reports explicit limitations of this language adapter.
   * Must be overridden by subclasses.
   *
   * @returns {Array<string>} List of limitation statements
   */
  reportLimitations() {
    return ['Base adapter does not implement language-specific parsing.'];
  }
}

