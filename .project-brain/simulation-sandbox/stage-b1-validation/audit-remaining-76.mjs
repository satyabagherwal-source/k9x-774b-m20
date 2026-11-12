import fs from 'fs';

const synth = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/stage-b-synthesis/stage-b-synthesis-dataset-197.json', 'utf8'));

const needsEvidenceRecords = synth.records.filter(r => r.final_classification === 'NEEDS_MORE_EVIDENCE');

console.log('Auditing remaining 76 NEEDS_MORE_EVIDENCE records...');
console.log('Record count:', needsEvidenceRecords.length);

const gapReport = needsEvidenceRecords.map((r, idx) => {
  const repo = r.source_provenance?.repository || 'UNKNOWN';
  const commit = r.source_provenance?.commit || 'UNKNOWN';
  const dossier = r.source_provenance?.dossier_file || 'UNKNOWN';
  const dossierExists = fs.existsSync(dossier);

  // Analyze specific gaps
  const missing_commit = commit === 'UNKNOWN' || commit.startsWith('hf-');
  const missing_tests = !r.test_evidence || !r.test_evidence.test_existence_verified;
  const evidenceStr = typeof r.evidence === 'string' ? r.evidence : JSON.stringify(r.evidence || '');
  const missing_code_patch = !r.evidence || r.evidence === 'UNKNOWN' || !evidenceStr.toLowerCase().includes('diff');
  const rootCauseStr = typeof r.root_cause === 'string' ? r.root_cause : JSON.stringify(r.root_cause || '');
  const missing_root_cause = !r.root_cause || r.root_cause === 'UNKNOWN' || rootCauseStr.includes('UNKNOWN');
  const negConstraintStr = typeof r.negative_constraint === 'string' ? r.negative_constraint : JSON.stringify(r.negative_constraint || '');
  const missing_negative_constraint = !r.negative_constraint || r.negative_constraint === 'UNKNOWN' || negConstraintStr.includes('UNKNOWN');

  // Recoverability prioritization:
  // HIGH: Dossier exists on disk and has architectural context, just needs git commit patch
  // MEDIUM: Dossier exists but requires remote repo inspection for code diffs
  // LOW: No local dossier, remote repository inspection strictly required
  let recoverability_priority = 'MEDIUM';
  if (dossierExists && !missing_root_cause) {
    recoverability_priority = 'HIGH';
  } else if (!dossierExists) {
    recoverability_priority = 'LOW';
  }

  return {
    item_number: idx + 1,
    candidate_id: r.candidate_id,
    title: r.synthesized_title,
    repository: repo,
    commit_or_version: commit,
    dossier_file: dossier,
    dossier_exists_locally: dossierExists,
    gaps: {
      missing_commit_sha: missing_commit,
      missing_code_patch,
      missing_test_evidence: missing_tests,
      missing_root_cause,
      missing_negative_constraint
    },
    recoverability_priority,
    required_remote_action: `Inspect remote repo ${repo} for full git commit and test suite.`
  };
});

const priorityCensus = {
  HIGH: gapReport.filter(r => r.recoverability_priority === 'HIGH').length,
  MEDIUM: gapReport.filter(r => r.recoverability_priority === 'MEDIUM').length,
  LOW: gapReport.filter(r => r.recoverability_priority === 'LOW').length
};

console.log('76 Records Recoverability Priority Census:', priorityCensus);

const output = {
  mission_id: 'UKD-STAGE-B1-INDEPENDENT-VALIDATION-01',
  timestamp: new Date().toISOString(),
  total_records: gapReport.length,
  recoverability_priority_census: priorityCensus,
  records: gapReport
};

fs.writeFileSync('.project-brain/simulation-sandbox/stage-b1-validation/remaining-evidence-gaps-76.json', JSON.stringify(output, null, 2), 'utf8');
console.log('Saved .project-brain/simulation-sandbox/stage-b1-validation/remaining-evidence-gaps-76.json');
