/**
 * Agentic Knowledge Gateway: JSON Extractor Module
 * Grounded in Brain Pattern SYNTH-E3-164-CD-F2AV (from manojahi/serpiq, commit f3330d7e)
 * Re-verified in Phase E.4 (VERIFIED_INDEPENDENTLY)
 */

export class ExtractJSONError extends Error {
  constructor(message, raw, attempted) {
    const preview = typeof raw === 'string' && raw.length > 500
      ? raw.slice(0, 500) + `\n... (${raw.length - 500} more chars truncated)`
      : String(raw);
    super(`${message}\n\n--- raw response (first 500 chars) ---\n${preview}\n----------------------------------------`);
    this.name = 'ExtractJSONError';
    this.raw = raw;
    if (attempted !== undefined) this.attempted = attempted;
  }
}

/**
 * Strips Markdown code fences (```json, ```JSON, or ```) anywhere in the input string.
 */
export function stripFences(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/```(?:json|JSON)?\s*/g, '').replace(/```/g, '');
}

/**
 * Finds the first balanced top-level {...} object in the string,
 * accounting for braces inside string literals and escaped quotes.
 */
export function sliceFirstBalancedObject(s) {
  if (typeof s !== 'string') return null;
  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Extracts a structured JSON object from potentially noisy, conversational,
 * or Markdown-fenced LLM output strings.
 */
export function extractJSON(raw, options = {}) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ExtractJSONError('LLM returned empty or non-string response.', raw);
  }

  const cleaned = stripFences(raw).trim();

  // Fast path: the whole thing is already valid JSON
  try {
    const parsed = JSON.parse(cleaned);
    if (options.requireObject && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
      throw new ExtractJSONError('Extracted JSON must be a non-null object.', raw, cleaned);
    }
    return parsed;
  } catch (err) {
    if (err instanceof ExtractJSONError) throw err;
    // fall through to bracket-matching
  }

  // Bracket-matching path
  const jsonSlice = sliceFirstBalancedObject(cleaned);
  if (!jsonSlice) {
    throw new ExtractJSONError('No JSON object found in response.', raw);
  }

  try {
    const parsed = JSON.parse(jsonSlice);
    if (options.requireObject && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
      throw new ExtractJSONError('Extracted JSON must be a non-null object.', raw, jsonSlice);
    }
    return parsed;
  } catch (err) {
    throw new ExtractJSONError(
      `Failed to parse JSON: ${err.message}`,
      raw,
      jsonSlice
    );
  }
}

