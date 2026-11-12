import fs from 'fs';

const cd = JSON.parse(fs.readFileSync('11_INBOX/candidate-directives-registry.json', 'utf8'));
const candidateIds = ['CD-ZNND', 'CD-UV2I', 'CD-8KGR', 'CD-550F', 'CD-UQL0', 'CD-9RFV', 'CD-URAY', 'CD-HE9Q'];

for (const id of candidateIds) {
  const matches = (cd.directives || []).filter(d => (d.directive_id || d.id) === id);
  console.log(`\n================================================================================`);
  console.log(`Candidate ID: ${id} (Matches in registry: ${matches.length})`);
  matches.forEach((m, idx) => {
    console.log(`Match ${idx + 1}:`);
    console.log(' - Title:', m.title || m.directive_title);
    console.log(' - Repo:', m.source_repo || m.source_repository);
    console.log(' - Domain:', m.domain || m.domain_code);
    console.log(' - Scope:', m.scope);
    console.log(' - Summary:', (m.summary || m.description || '').slice(0, 150));
    console.log(' - Raw keys:', Object.keys(m));
  });
}

