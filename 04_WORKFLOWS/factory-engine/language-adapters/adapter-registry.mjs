/**
 * Language Adapter Registry
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\language-adapters\adapter-registry.mjs
 * Purpose: Central discovery and dispatch registry for multi-language semantic analyzers.
 *
 * Invariant: Language adapters can be registered or extended without modifying the central URE pipeline.
 */

import path from 'path';
import { JavaScriptTypeScriptAdapter } from './javascript-typescript-adapter.mjs';
import { PythonAdapter } from './python-adapter.mjs';
import { GoAdapter } from './go-adapter.mjs';
import { RustAdapter } from './rust-adapter.mjs';

const adapters = [
  new JavaScriptTypeScriptAdapter(),
  new PythonAdapter(),
  new GoAdapter(),
  new RustAdapter()
];

/**
 * Returns the best language adapter for the given file path or extension.
 */
export function getAdapterForFile(filePath) {
  if (!filePath) return null;
  const ext = path.extname(filePath).toLowerCase();
  for (const adapter of adapters) {
    if (adapter.supports(ext)) {
      return adapter;
    }
  }
  return null;
}

/**
 * Returns all registered language adapters.
 */
export function getAllAdapters() {
  return [...adapters];
}

/**
 * Returns an inventory of all supported languages, their extensions, declared AST levels, and limitations.
 */
export function getSupportedLanguages() {
  return adapters.map(a => ({
    name: a.name,
    extensions: a.extensions,
    capabilities: a.capabilities,
    limitations: a.reportLimitations()
  }));
}

