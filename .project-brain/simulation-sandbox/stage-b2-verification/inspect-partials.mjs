import fs from 'fs';

const dup = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/stage-b1-validation/duplicate-independent-audit-25.json', 'utf8'));
const partials = dup.mappings.filter(m => m.independent_classification === 'PARTIAL_EQUIVALENCE');

console.log('Total partial mappings:', partials.length);
partials.forEach((p, idx) => {
  console.log(`\nPartial ${idx + 1}: [${p.link_id}] Child: ${p.child_candidate_id} -> Parent: ${p.parent_candidate_id}`);
  console.log(`Child Title: ${p.child_title}`);
  console.log(`Parent Title: ${p.parent_title}`);
  console.log(`Equivalence Type: ${p.equivalence_type}`);
  console.log(`Repo: ${p.source_repository}`);
  console.log(`Preserved Differences: ${p.differences_to_preserve}`);
});

