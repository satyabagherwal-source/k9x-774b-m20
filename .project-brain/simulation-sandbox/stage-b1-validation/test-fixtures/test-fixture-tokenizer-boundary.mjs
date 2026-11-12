/**
 * ISOLATED TEST FIXTURE: Tokenizer Special Token Normalization Boundary
 * Candidate ID: CD-HE9Q
 * Origin: Nanbeige/Nanbeige4.3-33B
 * Purpose: Empirically verify that special tokens (BOS, EOS, PAD) enforce normalized=false
 *          to prevent whitespace stripping, while structural tokens allow normalized=true.
 */

import assert from 'assert';

console.log('--- RUNNING ISOLATED RUNTIME TEST FIXTURE: TOKENIZER NORMALIZATION BOUNDARY ---');

function validateTokenizerConfig(tokenizerConfig) {
  const addedTokens = tokenizerConfig.added_tokens_decoder || {};
  const specialTokens = ['<s>', '</s>', '<unk>', '<pad>'];
  const violations = [];

  for (const [id, tokenObj] of Object.entries(addedTokens)) {
    const content = tokenObj.content;
    const isSpecial = tokenObj.special;
    const isNormalized = tokenObj.normalized;

    // RULE: Special control tokens MUST NOT be normalized
    if (specialTokens.includes(content) || isSpecial) {
      if (isNormalized === true) {
        violations.push({
          id,
          content,
          error: `Special token '${content}' has normalized: true (MUST be false to prevent whitespace/case stripping)`
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

// TEST 1: Valid Nanbeige Config Pattern
const validNanbeigeConfig = {
  added_tokens_decoder: {
    "0": {
      "content": "<unk>",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "1": {
      "content": "<s>",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "2": {
      "content": "</s>",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "151644": {
      "content": "</think>",
      "lstrip": false,
      "normalized": true, // Structural thinking token may participate in normalization
      "rstrip": false,
      "single_word": false,
      "special": false
    }
  }
};

const resValid = validateTokenizerConfig(validNanbeigeConfig);
console.log('Test 1 - Valid Config Validation:', resValid);
assert.strictEqual(resValid.valid, true);
assert.strictEqual(resValid.violations.length, 0);
console.log('✅ Test 1 PASSED: Valid configuration adheres to normalization boundary.');

// TEST 2: Defective Config (Violates Invariant by setting normalized=true on <s>)
const defectiveConfig = {
  added_tokens_decoder: {
    "1": {
      "content": "<s>",
      "normalized": true, // BUG: Whitespace stripping will alter token matching!
      "special": true
    }
  }
};

const resDefective = validateTokenizerConfig(defectiveConfig);
console.log('Test 2 - Defective Config Validation:', resDefective);
assert.strictEqual(resDefective.valid, false);
assert.strictEqual(resDefective.violations.length, 1);
console.log('✅ Test 2 PASSED: Defective configuration successfully flagged by boundary invariant.');

console.log('ALL TOKENIZER NORMALIZATION BOUNDARY TESTS PASSED IN ISOLATION.');

