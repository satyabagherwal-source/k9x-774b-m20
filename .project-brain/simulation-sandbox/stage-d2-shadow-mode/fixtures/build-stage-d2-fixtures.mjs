/**
 * Stage D.2 Fixture Generator
 * Generates 10 deterministic test fixtures for shadow-mode verification.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = __dirname;

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const FIXTURES = {
  // 1. Cloud Standard Payload (mimicking zero-clone-harvester)
  'cloud-standard-payload.json': {
    learning_id: 'cloud-pkg-fastapi-lifespan-01',
    slug: 'fastapi-lifespan-async-cleanup',
    repository: 'tiangolo/fastapi',
    platform: 'github',
    source_url: 'https://github.com/tiangolo/fastapi',
    source_version: '9f83a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
    license: 'MIT',
    harvest_origin: 'CLOUD_HARVESTER',
    approval_status: 'APPROVED',
    dossier_content: `# FastAPI Lifespan Async Context Management\n\n## Abstract\nModern FastAPI applications handle startup and shutdown logic via asynccontextmanager lifespan handlers instead of deprecated on_event handlers.`,
    content_hash: hash('FastAPI Lifespan Async Context Management'),
    candidates: [
      {
        candidate_id: 'CAND-FASTAPI-LIFESPAN-01',
        title: 'FastAPI Lifespan Async State Lifecycle Pattern',
        approval_status: 'APPROVED',
        domain: 'H',
        evidence: 'Use @asynccontextmanager lifespan instead of on_event startup/shutdown',
        confidence: 0.96
      }
    ],
    metadata: {
      stars: 76000,
      language: 'Python',
      agent: 'Agent-Alpha'
    }
  },

  // 2. Manual Standard Payload (mimicking batch-auto-harvester)
  'manual-standard-payload.json': {
    learning_id: 'manual-pkg-tokio-task-budget-01',
    slug: 'tokio-cooperative-task-budgeting',
    repository: 'tokio-rs/tokio',
    platform: 'github',
    source_url: 'https://github.com/tokio-rs/tokio',
    source_version: 'a1b2c3d4e5f67890123456789abcdef012345678',
    license: 'MIT',
    harvest_origin: 'MANUAL_HARVESTER',
    approval_status: 'APPROVED',
    dossier_content: `# Tokio Cooperative Task Scheduling & Budgeting\n\n## Abstract\nTo prevent long-running tasks from starving other tasks on the runtime thread, Tokio uses task budgets decremented on each yield.`,
    content_hash: hash('Tokio Cooperative Task Scheduling & Budgeting'),
    candidates: [
      {
        candidate_id: 'CAND-TOKIO-BUDGET-01',
        title: 'Tokio Cooperative Task Budgeting Invariant',
        approval_status: 'APPROVED',
        domain: 'G',
        evidence: 'coop::poll_budget decrement preventing starvation in unbounded loops',
        confidence: 0.94
      }
    ],
    metadata: {
      manual_session: 'session-2026-11-12-tokio-eval',
      operator: 'admin'
    }
  },

  // 3. Equivalent Cloud Payload
  'equivalent-cloud-payload.json': {
    learning_id: 'equiv-cloud-retry-jitter-01',
    slug: 'distributed-retry-decorrelated-jitter',
    repository: 'resilience-eng/retry-patterns',
    platform: 'github',
    source_url: 'https://github.com/resilience-eng/retry-patterns',
    source_version: 'e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
    license: 'Apache-2.0',
    harvest_origin: 'CLOUD_HARVESTER',
    dossier_content: `# Decorrelated Jitter Retry Pattern\n\n## Abstract\nFull jitter decorrelates retry spikes across distributed microservices.`,
    content_hash: hash('Decorrelated Jitter Retry Pattern Full Content'),
    extracted_rules: [
      {
        title: 'Decorrelated Jitter Backoff Formula',
        domain: 'G',
        evidence: 'sleep = min(cap, random_between(base, sleep * 3))'
      }
    ]
  },

  // 4. Equivalent Manual Payload (same concept and content hash)
  'equivalent-manual-payload.json': {
    learning_id: 'equiv-manual-retry-jitter-01',
    slug: 'distributed-retry-decorrelated-jitter',
    repository: 'resilience-eng/retry-patterns',
    platform: 'github',
    source_url: 'https://github.com/resilience-eng/retry-patterns',
    source_version: 'e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
    license: 'Apache-2.0',
    harvest_origin: 'MANUAL_HARVESTER',
    dossier_content: `# Decorrelated Jitter Retry Pattern\n\n## Abstract\nFull jitter decorrelates retry spikes across distributed microservices.`,
    content_hash: hash('Decorrelated Jitter Retry Pattern Full Content'),
    extracted_rules: [
      {
        title: 'Decorrelated Jitter Backoff Formula',
        domain: 'G',
        evidence: 'sleep = min(cap, random_between(base, sleep * 3))'
      }
    ]
  },

  // 5. Duplicate Test Payload
  'duplicate-test-payload.json': {
    learning_id: 'duplicate-zod-memoizer-check',
    slug: 'zod-memoizer-leak-dupe-test',
    repository: 'colinhacks/zod',
    platform: 'github',
    source_url: 'https://github.com/colinhacks/zod',
    source_version: 'c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7',
    license: 'MIT',
    harvest_origin: 'CLOUD_HARVESTER',
    dossier_content: `# Memory Retention & Leak via Memoizer Parse Pinning (BUG-ZOD-V4-02)\n\n## Duplicate verification`,
    content_hash: 'c1b48b64e0310705a2e6fca78e8b6b0b5c7e098492040b2d6a7d18861cf1f92e', // Known hash or flag
    metadata: {
      is_duplicate: true,
      parent_id: 'DOM-H-83C24083'
    }
  },

  // 6. Unapproved Candidate Payload
  'unapproved-candidate-payload.json': {
    learning_id: 'unapproved-candidate-raft-snapshot-01',
    slug: 'raft-snapshot-log-compaction-safety',
    repository: 'tikv/raft-rs',
    platform: 'github',
    source_url: 'https://github.com/tikv/raft-rs',
    source_version: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
    license: 'Apache-2.0',
    harvest_origin: 'CLOUD_HARVESTER',
    dossier_content: `# Raft Snapshot Compaction Safety\n\n## Abstract\nSnapshot installation requires holding term invariant.`,
    content_hash: hash('Raft Snapshot Compaction Safety'),
    requires_human_approval: true,
    candidates: [
      {
        candidate_id: 'CAND-RAFT-UNAPPROVED-01',
        title: 'Raft Snapshot Truncation Gate',
        approval_status: 'PENDING_REVIEW', // Unapproved
        domain: 'G'
      }
    ]
  },

  // 7. Incomplete Provenance Payload
  'incomplete-provenance-payload.json': {
    learning_id: 'incomplete-prov-pkg-01',
    slug: 'incomplete-provenance-test',
    repository: '', // Missing repo
    source_url: '', // Missing source URL
    source_version: '', // Missing commit SHA
    license: '',
    harvest_origin: 'SYNTHETIC_FIXTURE',
    dossier_content: 'Incomplete content',
    content_hash: hash('Incomplete content')
  },

  // 8. Large Stress Batch Payload (> 5 items)
  'large-stress-payload.json': {
    learning_id: 'large-batch-stress-pkg',
    slug: 'large-batch-stress',
    repository: 'stress/test-suite',
    source_url: 'https://github.com/stress/test-suite',
    source_version: '11223344556677889900aabbccddeeff00112233',
    license: 'MIT',
    harvest_origin: 'SYNTHETIC_FIXTURE',
    dossier_content: 'Stress batch with 8 candidates',
    content_hash: hash('Stress batch with 8 candidates'),
    candidates: Array.from({ length: 8 }).map((_, i) => ({
      candidate_id: `CAND-STRESS-${i + 1}`,
      title: `Stress Candidate ${i + 1}`,
      approval_status: 'APPROVED',
      domain: 'H'
    }))
  },

  // 9. Malformed Syntax Payload
  'malformed-syntax-payload.json': {
    learning_id: null,
    slug: 12345, // invalid type
    repository: false,
    content_hash: null,
    dossier_content: undefined
  },

  // 10. Credential-Bearing Payload
  'credential-bearing-payload.json': {
    learning_id: 'credential-bearing-test-pkg',
    slug: 'security-token-sanitization-eval',
    repository: 'auth0/jwt-decode',
    platform: 'github',
    source_url: 'https://github.com/auth0/jwt-decode?token=ghp_ABC12345678901234567890123456789012345',
    source_version: 'abcdef0123456789abcdef0123456789abcdef01',
    license: 'MIT',
    harvest_origin: 'CLOUD_HARVESTER',
    dossier_content: `# Security Redaction Test\n\nGitHub PAT: ghp_1111222233334444555566667777888899990000\nHuggingFace Token: hf_abcdef1234567890abcdef1234567890abcdef\nGoogle Key: AIzaSyD-79182371923871923871923871923812\nBearer: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae7\nAWS: AKIAIOSFODNN7EXAMPLE`,
    content_hash: hash('Security Redaction Test Content'),
    apiKey: 'AIzaSyD-79182371923871923871923871923812',
    client_secret: 'gho_secret12345678901234567890123456789012345',
    token: 'hf_abcdef1234567890abcdef1234567890abcdef'
  }
};

export function buildFixtures() {
  for (const [filename, content] of Object.entries(FIXTURES)) {
    const filePath = path.join(FIXTURES_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    console.log(`Generated fixture: ${filename}`);
  }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildFixtures();
}
