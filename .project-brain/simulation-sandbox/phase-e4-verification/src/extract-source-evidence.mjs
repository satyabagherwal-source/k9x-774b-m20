import fs from 'fs';
import path from 'path';

const selectedData = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e4-verification/selected-candidates.json', 'utf8'));

const evidenceDir = '.project-brain/simulation-sandbox/phase-e4-verification/source-evidence';

for (const c of selectedData.candidates) {
  const dPath = c.sourceProvenance.dossierPath;
  const rawDossier = fs.readFileSync(dPath, 'utf8');
  
  // Extract key sections: Header, Learning ID, Code snippets, specific terms
  let relevantEvidence = '';
  
  if (c.synthesisId === 'SYNTH-E3-164-CD-F2AV') {
    // serpiq extractJSON code
    const idx = rawDossier.indexOf('export function extractJSON');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx, idx + 2500);
    }
  } else if (c.synthesisId === 'SYNTH-E3-179-CD-3H9L') {
    // Apple silicon anchor heading
    const idx = rawDossier.indexOf('The Anchor Index (TOC)');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx, idx + 2000);
    }
  } else if (c.synthesisId === 'SYNTH-E3-113-CD-8KGR') {
    // Qwen Image binary formats
    const idx = rawDossier.indexOf('Format-Specific Optimization');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx, idx + 2000);
    } else {
      relevantEvidence = rawDossier.slice(0, 2500);
    }
  } else if (c.synthesisId === 'SYNTH-E3-108-CD-YKUY') {
    // MiniCPM patch size
    const idx = rawDossier.indexOf('Patch size: 14x14');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx - 200, idx + 1800);
    }
  } else if (c.synthesisId === 'SYNTH-E3-122-CD-X37I') {
    // MiniCPM partial rope
    const idx = rawDossier.indexOf('Partial RoPE');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx - 100, idx + 1800);
    } else {
      relevantEvidence = rawDossier.slice(0, 2000);
    }
  } else if (c.synthesisId === 'SYNTH-E3-020-CD-V1HX') {
    // DeepSeek MLA
    const idx = rawDossier.indexOf('Multi-Head Latent Attention');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx, idx + 2200);
    } else {
      relevantEvidence = rawDossier.slice(0, 2200);
    }
  } else if (c.synthesisId === 'SYNTH-E3-096-CD-DVLL') {
    // Phocinae multi-choice logit
    const idx = rawDossier.indexOf('outputs = model');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx - 150, idx + 1500);
    }
  } else if (c.synthesisId === 'SYNTH-E3-014-CD-J7YF') {
    // Qwen GGUF context length
    const idx = rawDossier.indexOf('qwen2.context_length');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx - 100, idx + 1500);
    }
  } else if (c.synthesisId === 'SYNTH-E3-029-CD-BKS6') {
    // TeleOCR deterministic decoding
    const idx = rawDossier.indexOf('Language Decoding Core');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx, idx + 1800);
    }
  } else if (c.synthesisId === 'SYNTH-E3-137-CD-644A') {
    // OpenOPC shadow adapter
    const idx = rawDossier.indexOf('useSubmitTask');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx, idx + 1800);
    }
  } else if (c.synthesisId === 'SYNTH-E3-134-CD-HBYI') {
    // Nucleoid colon-free parser
    const idx = rawDossier.indexOf('pub(super) fn suite_body');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx - 100, idx + 1800);
    }
  } else if (c.synthesisId === 'SYNTH-E3-153-CD-P49U') {
    // Turso Limbo SQL function drop
    const idx = rawDossier.indexOf('DROP FUNCTION');
    if (idx !== -1) {
      relevantEvidence = rawDossier.slice(idx - 100, idx + 1800);
    }
  }
  
  if (!relevantEvidence) {
    relevantEvidence = rawDossier.slice(0, 2000);
  }
  
  const evidenceFile = path.join(evidenceDir, `${c.synthesisId}-evidence.md`);
  const content = `# Source Evidence Dossier: ${c.synthesisId}
- **Title**: ${c.clearTechnicalTitle}
- **Repository**: ${c.sourceProvenance.sourceRepo}
- **Source Commit**: ${c.sourceProvenance.sourceCommit}
- **Parent Dossier**: ${c.sourceProvenance.dossierPath}
- **Primary Domain**: ${c.domains.primary} (${c.domains.primaryName})
- **Mechanism**: ${c.selectionMetadata.mechanism}

---

## Forensic Source Excerpt

\`\`\`
${relevantEvidence}
\`\`\`
`;
  fs.writeFileSync(evidenceFile, content, 'utf8');
}

console.log(`Generated 12 source evidence files in ${evidenceDir}`);

