# Source Evidence Dossier: SYNTH-E3-164-CD-F2AV
- **Title**: harden core utilities, add vitest suite, contributing guide
- **Repository**: manojahi/serpiq
- **Source Commit**: f3330d7e
- **Parent Dossier**: 07_PROJECT_LEARNING/manojahi-serpiq-learnings.md
- **Primary Domain**: I (Content & Information Intelligence)
- **Mechanism**: LLM Response Sanitization & Brace-Aware JSON Extraction

---

## Forensic Source Excerpt

```
export function extractJSON<T = unknown>(raw: string): T {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ExtractJSONError('LLM returned empty response.', raw);
  }

  const cleaned = stripFences(raw).trim();

  // Fast path: the whole thing is already JSON.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to bracket-matching
  }

  const json = sliceFirstBalancedObject(cleaned);
  if (!json) {
    throw new ExtractJSONError('No JSON object found in LLM response.', raw);
  }

  try {
    return JSON.parse(json) as T;
  } catch (e) {
    throw new ExtractJSONError(
      `Failed to parse JSON: ${(e as Error).message}`,
      raw,
      json
    );
  }
}

export class ExtractJSONError extends Error {
  readonly raw: string;
  readonly attempted?: string;

  constructor(message: string, raw: string, attempted?: string) {
    const preview = truncate(raw, 500);
    super(`${message}\n\n--- raw response (first 500 chars) ---\n${preview}\n----------------------------------------`);
    this.name = 'ExtractJSONError';
    this.raw = raw;
    if (attempted !== undefined) this.attempted = attempted;
  }
}

function stripFences(s: string): string {
  // Remove ```json or ``` fences anywhere in the string.
  return s.replace(/```(?:json|JSON)?\s*/g, '').replace(/```/g, '');
}

/**
 * Find the first balanced top-level `{...}` object in the string,
 * accounting for braces inside string literals and escaped quotes.
 */
function sliceFirstBalancedObject(s: string): string | null {
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
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n... (${s.length - max} more chars truncated)`;
}

/**
 * Run an async LLM call that's expected to return JSON. Retries up to `maxRetries`
 * times on ExtractJSONError (i.e. 
```
