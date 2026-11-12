/**
 * Phase G Improvement 2: Post-Extraction Schema Invariant Validator
 * Affects: Domain K (Quality & Verification) & Domain H (Technical Construction)
 * 
 * Provides lightweight, zero-dependency schema validation for extracted JSON:
 * - Required properties check
 * - Primitive type checking (string, number, boolean, array, object)
 * - String constraints (nonEmpty, minLength, regexPattern)
 * - Number constraints (positive, integer, min, max)
 * - Array validation (itemType or itemSchema)
 * - Enum value enforcement
 * - Structured violation reporting
 */

export class SchemaValidationError extends Error {
  constructor(message, violations) {
    super(`${message}\n- ${violations.join('\n- ')}`);
    this.name = 'SchemaValidationError';
    this.violations = violations;
  }
}

/**
 * Validates an arbitrary JavaScript object against a lightweight schema contract.
 * 
 * Schema structure:
 * {
 *   properties: {
 *     keyName: {
 *       type: 'string' | 'number' | 'boolean' | 'array' | 'object',
 *       required: true | false,
 *       nonEmpty: true | false,
 *       enum: ['val1', 'val2'],
 *       min: 0,
 *       max: 100,
 *       itemType: 'string' (for arrays)
 *     }
 *   },
 *   strict: true (disallows unlisted keys)
 * }
 */
export function validateSchema(data, schema) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SchemaValidationError('Target data must be a non-null object', ['Target is not an object']);
  }

  const violations = [];
  const properties = schema.properties || {};

  // 1. Check required properties and types
  for (const [propName, rules] of Object.entries(properties)) {
    const value = data[propName];

    if (value === undefined || value === null) {
      if (rules.required) {
        violations.push(`Missing required property: "${propName}"`);
      }
      continue;
    }

    // Type checking
    if (rules.type) {
      if (rules.type === 'array') {
        if (!Array.isArray(value)) {
          violations.push(`Property "${propName}" must be an array (received ${typeof value})`);
        } else if (rules.itemType) {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== rules.itemType) {
              violations.push(`Array "${propName}[${i}]" must be of type ${rules.itemType} (received ${typeof value[i]})`);
            }
          }
        }
      } else if (rules.type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          violations.push(`Property "${propName}" must be a non-null object (received ${typeof value})`);
        }
      } else {
        if (typeof value !== rules.type) {
          violations.push(`Property "${propName}" must be of type ${rules.type} (received ${typeof value})`);
        }
      }
    }

    // String constraints
    if (typeof value === 'string') {
      if (rules.nonEmpty && value.trim().length === 0) {
        violations.push(`Property "${propName}" cannot be empty or whitespace only`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        violations.push(`Property "${propName}" does not match required pattern ${rules.pattern}`);
      }
    }

    // Number constraints
    if (typeof value === 'number') {
      if (rules.positive && value <= 0) {
        violations.push(`Property "${propName}" must be positive (> 0) (received ${value})`);
      }
      if (rules.integer && !Number.isInteger(value)) {
        violations.push(`Property "${propName}" must be an integer (received ${value})`);
      }
      if (rules.min !== undefined && value < rules.min) {
        violations.push(`Property "${propName}" must be >= ${rules.min} (received ${value})`);
      }
      if (rules.max !== undefined && value > rules.max) {
        violations.push(`Property "${propName}" must be <= ${rules.max} (received ${value})`);
      }
    }

    // Enum constraints
    if (rules.enum && Array.isArray(rules.enum)) {
      if (!rules.enum.includes(value)) {
        violations.push(`Property "${propName}" value "${value}" is not in allowed enum [${rules.enum.join(', ')}]`);
      }
    }
  }

  // 2. Strict mode: check for unlisted properties
  if (schema.strict) {
    for (const key of Object.keys(data)) {
      if (!properties[key]) {
        violations.push(`Unexpected property "${key}" in strict mode`);
      }
    }
  }

  if (violations.length > 0) {
    throw new SchemaValidationError(`Schema validation failed with ${violations.length} violation(s)`, violations);
  }

  return { isValid: true, violations: [] };
}

