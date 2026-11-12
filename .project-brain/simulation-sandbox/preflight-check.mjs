import fs from 'fs';
import crypto from 'crypto';

const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

console.log('--- PREFLIGHT VERIFICATION ---');

const productionFiles = [
  '05_KNOWLEDGE/domain-intelligence/domain-registry.json',
  '11_INBOX/candidate-directives-registry.json',
  '.project-brain/knowledge-graph/relationship-graph.json',
  '05_KNOWLEDGE/knowledge-index.json',
  '05_KNOWLEDGE/engineering-patterns.md',
  'harvest-control.json'
];

for (const f of productionFiles) {
  console.log(`${f}: ${hashFile(f)}`);
}

// Verify KHU-005
const domReg = JSON.parse(fs.readFileSync('05_KNOWLEDGE/domain-intelligence/domain-registry.json', 'utf8'));
const khuIds = ['DOM-H-94C4B932', 'DOM-H-2007DF83', 'DOM-H-7D0B9F17', 'DOM-H-C2A738D4', 'DOM-H-1B2AC6F8'];
const foundKhu = khuIds.filter(id => !!domReg.records[id]);
console.log(`KHU-005 duplicate records intact: ${foundKhu.length} / 5`);

// Verify Phase E.4 results
const e4Results = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e4-verification/verification-results.json', 'utf8'));
console.log('Phase E.4 results verified:', e4Results.suitesPassed, 'of', e4Results.suitesRun, 'suites passed');

const top3 = ['SYNTH-E3-164-CD-F2AV', 'SYNTH-E3-179-CD-3H9L', 'SYNTH-E3-113-CD-8KGR'];
for (const id of top3) {
  const item = e4Results.candidateOutcomes.find(c => c.candidateId === id);
  console.log(`- ${id}: ${item?.status} (${item?.evidenceType})`);
}

const partialCount = e4Results.candidateOutcomes.filter(c => c.status === 'PARTIALLY_VERIFIED').length;
const unverifiedCount = e4Results.candidateOutcomes.filter(c => c.status === 'NOT_INDEPENDENTLY_VERIFIABLE').length;
console.log(`Partially verified count: ${partialCount} (expected 7)`);
console.log(`Not independently verifiable count: ${unverifiedCount} (expected 2)`);

