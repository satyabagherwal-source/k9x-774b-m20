import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MASTER_BRAIN_FOLDERS = [
  '00_START_HERE',
  '01_CORE',
  '02_AGENT_INTELLIGENCE',
  '03_SKILLS',
  '04_WORKFLOWS',
  '05_KNOWLEDGE',
  '06_PROJECT_CONTEXT',
  '07_PROJECT_LEARNING',
  '08_VERIFICATION',
  '09_SOURCES',
  '10_PROMPTS',
  '11_INBOX',
  '12_DECISIONS',
  '13_GOVERNANCE',
  '14_EVOLUTION',
  '15_METADATA'
];

export function resolveMasterBrainPath(customPath = null) {
  const candidatePaths = [
    customPath,
    process.env.AI_BUILDER_BRAIN_PATH,
    path.resolve(__dirname, '..', '..'),
    'C:\\AI-Builder-Brain',
    'C:/AI-Builder-Brain',
    path.resolve(process.cwd(), '..', 'AI-Builder-Brain')
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const isBrain = fs.existsSync(path.join(candidate, '00_START_HERE')) &&
                      fs.existsSync(path.join(candidate, '01_CORE'));
      if (isBrain) {
        return path.resolve(candidate);
      }
    }
  }

  return null;
}

export function inspectMasterBrain(brainPath) {
  if (!brainPath || !fs.existsSync(brainPath)) {
    return {
      connected: false,
      error: `Master Brain path not found: ${brainPath}`
    };
  }

  const folderStatus = {};
  let presentFolders = 0;

  for (const folder of MASTER_BRAIN_FOLDERS) {
    const fullPath = path.join(brainPath, folder);
    const exists = fs.existsSync(fullPath);
    folderStatus[folder] = exists;
    if (exists) presentFolders++;
  }

  // Key documents check
  const keyDocs = [
    '00_START_HERE/AGENT_BOOT_PROTOCOL.md',
    '01_CORE/operating-rules.md',
    '05_KNOWLEDGE/engineering-patterns.md',
    '07_PROJECT_LEARNING/project-learning-protocol.md',
    '08_VERIFICATION/verification-protocol.md',
    '14_EVOLUTION/brain-evolution-protocol.md'
  ];

  const docsStatus = {};
  for (const doc of keyDocs) {
    docsStatus[doc] = fs.existsSync(path.join(brainPath, doc));
  }

  return {
    connected: true,
    path: brainPath,
    totalFolders: MASTER_BRAIN_FOLDERS.length,
    presentFolders,
    allFoldersPresent: presentFolders === MASTER_BRAIN_FOLDERS.length,
    folderStatus,
    docsStatus,
    readOnlyEnforced: true
  };
}

export function queryMasterKnowledge(brainPath, patternNumberOrKeyword) {
  const patternsFile = path.join(brainPath, '05_KNOWLEDGE', 'engineering-patterns.md');
  if (!fs.existsSync(patternsFile)) {
    return { found: false, error: 'engineering-patterns.md not found in Master Brain' };
  }

  const content = fs.readFileSync(patternsFile, 'utf-8');
  const sections = content.split(/^##\s+/m);

  const term = String(patternNumberOrKeyword).toLowerCase().trim();
  const matched = sections.filter(sec => {
    const lower = sec.toLowerCase();
    return lower.includes(term);
  });

  return {
    found: matched.length > 0,
    matches: matched.map(m => '## ' + m.trim())
  };
}

export function initializeProjectBrainBridge(projectRoot, masterBrainPath, projectName) {
  const projectBrainDir = path.join(projectRoot, '.project-brain');
  fs.mkdirSync(path.join(projectBrainDir, 'incidents'), { recursive: true });
  fs.mkdirSync(path.join(projectBrainDir, 'lessons'), { recursive: true });
  fs.mkdirSync(path.join(projectBrainDir, 'promotion-queue'), { recursive: true });

  const bridgeConfig = {
    bridgeVersion: '1.0.0',
    projectName,
    createdAt: new Date().toISOString(),
    masterBrainPath,
    connected: Boolean(masterBrainPath && fs.existsSync(masterBrainPath)),
    zeroCopyEnforced: true,
    indexedKnowledge: [
      '05_KNOWLEDGE/engineering-patterns.md',
      '03_SKILLS/astro-adsense-mastery.md',
      '03_SKILLS/multilingual-seo-54-locales.md',
      '03_SKILLS/agent-error-prevention-protocol.md',
      '01_CORE/operating-rules.md',
      '00_START_HERE/AGENT_BOOT_PROTOCOL.md'
    ],
    learningPromotionWorkflow: {
      protocol: 'protocols/EVIDENCE_PROMOTION_PROTOCOL.md',
      stagingDirectory: '.project-brain/promotion-queue',
      reviewRequired: true
    }
  };

  fs.writeFileSync(
    path.join(projectBrainDir, 'brain-bridge.json'),
    JSON.stringify(bridgeConfig, null, 2),
    'utf-8'
  );

  return bridgeConfig;
}
