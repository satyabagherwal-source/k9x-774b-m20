/**
 * provenance-resolver.mjs
 * 
 * ProvenanceResolver Contract for Stage D Shared Harvesting Pipeline
 * Validates, enhances, and secures cryptographic upstream provenance.
 */

import crypto from 'crypto';

export class ProvenanceResolver {
  /**
   * Resolves and verifies provenance metadata for a normalized input and its candidates.
   * @param {object} normalizedInput 
   * @returns {object} { valid: boolean, provenance: object, errors: string[] }
   */
  resolve(normalizedInput) {
    const errors = [];

    if (!normalizedInput.source_url || normalizedInput.source_url.includes('unknown')) {
      errors.push('Missing or invalid source_url in normalized harvest input');
    }
    if (!normalizedInput.repository || normalizedInput.repository.includes('unknown')) {
      errors.push('Missing or invalid repository in normalized harvest input');
    }
    if (!normalizedInput.source_version) {
      errors.push('Missing source_version/commit SHA in normalized harvest input');
    }

    const fingerprint = crypto.createHash('sha256')
      .update(`${normalizedInput.source_url || ''}@${normalizedInput.source_version || ''}:${normalizedInput.license || ''}:${normalizedInput.harvest_origin || ''}`)
      .digest('hex');

    const provenance = {
      upstream_repository: normalizedInput.source_url,
      repository_name: normalizedInput.repository,
      source_revision: normalizedInput.source_version,
      license: normalizedInput.license,
      harvest_origin: normalizedInput.harvest_origin,
      extracted_at: normalizedInput.extracted_at,
      ai_provider: normalizedInput.ai_provider,
      source_fingerprint: fingerprint
    };

    return {
      valid: errors.length === 0,
      provenance,
      errors
    };
  }
}
