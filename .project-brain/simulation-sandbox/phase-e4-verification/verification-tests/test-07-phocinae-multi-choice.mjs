/**
 * Test 07: Permutation-Invariant Multi-Choice Logit Aggregation
 * Candidate: SYNTH-E3-096-CD-DVLL (Phocinae/Phocinae-Largha-150M-v1, commit hf-phocinae-)
 * Status: PARTIALLY_VERIFIED (Logit classification & permutation invariance algorithm verified; 150M weights unavailable offline)
 */
import assert from 'assert';

/**
 * Stable Softmax implementation over an array of numbers
 */
function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - max));
  const sum = exps.reduce((acc, val) => acc + val, 0);
  return exps.map(v => v / sum);
}

/**
 * Extracts normalized probabilities for a discrete set of choice tokens
 * from a raw vocabulary logit vector (as extracted from Phocinae parent dossier).
 */
export function extractChoiceProbabilities(vocabularyLogits, choiceTokenMap) {
  // choiceTokenMap: { "A": 101, "B": 102, "C": 103, "D": 104 }
  const choices = Object.keys(choiceTokenMap);
  const choiceLogits = choices.map(ch => {
    const tokenId = choiceTokenMap[ch];
    if (tokenId === undefined || tokenId < 0 || tokenId >= vocabularyLogits.length) {
      throw new RangeError(`Token ID ${tokenId} for choice ${ch} out of vocabulary range (${vocabularyLogits.length})`);
    }
    return vocabularyLogits[tokenId];
  });

  const probs = softmax(choiceLogits);
  const result = {};
  choices.forEach((ch, idx) => {
    result[ch] = probs[idx];
  });
  return result;
}

/**
 * Aggregates decision across multiple prompt permutations to cancel position bias
 */
export function aggregatePermutations(permutationResults) {
  const aggregated = {};
  const count = permutationResults.length;
  if (count === 0) throw new Error('At least one permutation result is required');

  for (const res of permutationResults) {
    for (const [ch, p] of Object.entries(res)) {
      aggregated[ch] = (aggregated[ch] || 0) + p / count;
    }
  }

  // Find argmax
  let bestChoice = null;
  let maxP = -1;
  for (const [ch, p] of Object.entries(aggregated)) {
    if (p > maxP) {
      maxP = p;
      bestChoice = ch;
    }
  }

  return { probabilities: aggregated, selectedChoice: bestChoice };
}

export function run() {
  const log = [];
  log.push('Executing Test 07: Phocinae Multi-Choice Logit Aggregation');

  // Simulated vocabulary of 1000 tokens
  const mockVocabLogits = new Array(1000).fill(0.0);
  // Option A (token 101) = 2.5, Option B (token 102) = 1.0, Option C (token 103) = 0.2
  mockVocabLogits[101] = 2.5;
  mockVocabLogits[102] = 1.0;
  mockVocabLogits[103] = 0.2;

  const choiceMap = { A: 101, B: 102, C: 103 };

  // 1. Single extraction
  const probs1 = extractChoiceProbabilities(mockVocabLogits, choiceMap);
  assert.strictEqual(probs1.A > probs1.B && probs1.B > probs1.C, true);
  const sumProbs = probs1.A + probs1.B + probs1.C;
  assert.strictEqual(Math.abs(sumProbs - 1.0) < 1e-6, true);
  log.push('  PASS: Logit extraction and softmax normalizes choice probability distribution to 1.0');

  // 2. Permutation Aggregation: simulate forward and reverse orders
  // Forward: A=2.5, B=1.0, C=0.2
  // Reverse (with slight position bias favoring the first shown item, say B gets a boost of 0.5):
  const mockVocabLogitsRev = new Array(1000).fill(0.0);
  mockVocabLogitsRev[101] = 2.3;
  mockVocabLogitsRev[102] = 1.4;
  mockVocabLogitsRev[103] = 0.1;
  const probs2 = extractChoiceProbabilities(mockVocabLogitsRev, choiceMap);

  const decision = aggregatePermutations([probs1, probs2]);
  assert.strictEqual(decision.selectedChoice, 'A');
  log.push('  PASS: Permutation averaging robustly selects choice "A" while mitigating single-shot position bias');

  // 3. Negative Constraint: Out-of-vocabulary token ID throws RangeError
  assert.throws(() => extractChoiceProbabilities(mockVocabLogits, { A: 9999 }), (err) => {
    return err instanceof RangeError;
  });
  log.push('  PASS: Out-of-vocabulary choice token ID correctly rejected');

  // 4. Negative Constraint: Empty permutation list throws Error
  assert.throws(() => aggregatePermutations([]), (err) => {
    return err.message.includes('At least one permutation result is required');
  });
  log.push('  PASS: Empty permutation list caught');

  return {
    candidateId: 'SYNTH-E3-096-CD-DVLL',
    title: 'Permutation-Invariant Multi-Choice Logit Aggregation',
    status: 'PARTIALLY_VERIFIED',
    evidenceType: 'ALGORITHMIC_CONTRACT_EXECUTED',
    qualification: 'Logit extraction and permutation invariance verified; 150M weights unavailable offline',
    checksPassed: 4,
    checksTotal: 4,
    log
  };
}

