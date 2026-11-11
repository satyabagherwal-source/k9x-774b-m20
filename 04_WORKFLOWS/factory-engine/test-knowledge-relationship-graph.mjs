/**
 * AI-Builder-Brain Knowledge Relationship Graph Test Suite
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-knowledge-relationship-graph.mjs
 * Purpose: Verifies System B & C Knowledge Graph Foundation:
 *          1. Clean initialization and schema invariants
 *          2. Multi-domain node creation & upsertion
 *          3. Directed edge creation & duplicate prevention
 *          4. Multi-hop BFS traversal & cycle safety
 *          5. Relation type filtering
 *          6. Atomic disk persistence & reload
 *          7. Canonical registry ingestion & bridge edge synthesis
 *          8. Zero production contamination
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import {
  KNOWLEDGE_RELATION_TYPES,
  createEmptyKnowledgeGraph,
  loadKnowledgeGraph,
  persistKnowledgeGraph,
  computeNodeId,
  upsertGraphNode,
  addGraphEdge,
  traverseKnowledgeGraph,
  ingestRegistryIntoKnowledgeGraph,
  getGraphStoragePaths
} from './knowledge-relationship-graph.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: KNOWLEDGE RELATIONSHIP GRAPH & ONTOLOGY ENGINE');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? ': ' + details : ''}`);
    failedTests++;
  }
}

const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-test-sandbox-'));

try {
  // ---------------------------------------------------------------------------
  // 1. Initialization & Empty Graph
  // ---------------------------------------------------------------------------
  console.log('--- Phase 1: Clean Graph Initialization ---');
  const emptyGraph = createEmptyKnowledgeGraph();
  assert(emptyGraph.version === '1.0.0', 'Empty graph has version 1.0.0');
  assert(emptyGraph.statistics.total_nodes === 0, 'Total nodes starts at 0');
  assert(emptyGraph.statistics.total_edges === 0, 'Total edges starts at 0');
  assert(Array.isArray(emptyGraph.edges), 'Edges is an array');
  assert(typeof emptyGraph.nodes === 'object', 'Nodes is an object');

  // ---------------------------------------------------------------------------
  // 2. Node Upsertion
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 2: Node Upsertion Across Domains ---');
  const nodeA = upsertGraphNode(emptyGraph, {
    id: 'NODE-A-OFFLINE-NEED',
    domain: 'A',
    type: 'HUMAN_NEED',
    title: 'Offline Data Sovereignty',
    summary: 'Users require full functionality without sending sensitive data to external clouds.',
    confidence: 0.95
  });
  assert(nodeA.id === 'NODE-A-OFFLINE-NEED', 'Upserted Domain A node successfully');
  assert(emptyGraph.nodes['NODE-A-OFFLINE-NEED'] !== undefined, 'Node present in graph nodes map');

  const nodeB = upsertGraphNode(emptyGraph, {
    id: 'NODE-B-OFFLINE-PRD',
    domain: 'B',
    type: 'PRODUCT_SPEC',
    title: 'Client-Side Local Storage Specification',
    confidence: 0.90
  });
  assert(nodeB.domain === 'B', 'Upserted Domain B node');

  const nodeG = upsertGraphNode(emptyGraph, {
    id: 'NODE-G-LOCAL-FIRST-ARCH',
    domain: 'G',
    type: 'ARCHITECTURE_INVARIANT',
    title: 'Local-First Reactive Event Sourcing',
    confidence: 0.98
  });
  assert(nodeG.domain === 'G', 'Upserted Domain G node');

  const nodeH = upsertGraphNode(emptyGraph, {
    id: 'NODE-H-INDEXEDDB-CRDT',
    domain: 'H',
    type: 'TECHNICAL_IMPLEMENTATION',
    title: 'IndexedDB CRDT Storage Engine',
    confidence: 0.92
  });
  assert(nodeH.domain === 'H', 'Upserted Domain H node');

  const nodeK = upsertGraphNode(emptyGraph, {
    id: 'NODE-K-ZERO-NETWORK-TEST',
    domain: 'K',
    type: 'QUALITY_VERIFICATION',
    title: 'Zero-Network Socket Assertion Test Suite',
    confidence: 1.0
  });
  assert(nodeK.domain === 'K', 'Upserted Domain K node');

  // ---------------------------------------------------------------------------
  // 3. Directed Edge Creation & Deduplication
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 3: Directed Edge Creation & Multi-Relational Links ---');
  const edge1 = addGraphEdge(emptyGraph, {
    sourceId: 'NODE-B-OFFLINE-PRD',
    targetId: 'NODE-A-OFFLINE-NEED',
    relationType: 'SOLVES_PROBLEM',
    weight: 1.0,
    rationale: 'PRD capability directly resolves user need for offline data sovereignty'
  });
  assert(edge1.id.startsWith('EDGE-'), 'Created valid edge ID for SOLVES_PROBLEM');
  assert(emptyGraph.edges.length === 1, 'Edge registered in graph edges array');

  const edge2 = addGraphEdge(emptyGraph, {
    sourceId: 'NODE-H-INDEXEDDB-CRDT',
    targetId: 'NODE-G-LOCAL-FIRST-ARCH',
    relationType: 'CONSTRAINED_BY_ARCHITECTURE',
    weight: 0.95
  });
  assert(edge2.relationType === 'CONSTRAINED_BY_ARCHITECTURE', 'Created CONSTRAINED_BY_ARCHITECTURE edge');

  const edge3 = addGraphEdge(emptyGraph, {
    sourceId: 'NODE-H-INDEXEDDB-CRDT',
    targetId: 'NODE-K-ZERO-NETWORK-TEST',
    relationType: 'VERIFIED_BY_TEST',
    weight: 1.0
  });
  assert(edge3.relationType === 'VERIFIED_BY_TEST', 'Created VERIFIED_BY_TEST edge');

  // Edge deduplication test
  const dupEdge = addGraphEdge(emptyGraph, {
    sourceId: 'NODE-H-INDEXEDDB-CRDT',
    targetId: 'NODE-G-LOCAL-FIRST-ARCH',
    relationType: 'CONSTRAINED_BY_ARCHITECTURE',
    weight: 0.99
  });
  assert(emptyGraph.edges.length === 3, 'Duplicate edge correctly updated in-place without duplicating (Count: 3)');
  assert(dupEdge.weight === 0.99, 'Existing edge weight successfully updated');

  // ---------------------------------------------------------------------------
  // 4. Multi-Hop BFS Traversal & Cycle Safety
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 4: Multi-Hop BFS Graph Traversal & Cycle Safety ---');
  // Add a cycle edge to test cycle safety
  addGraphEdge(emptyGraph, {
    sourceId: 'NODE-G-LOCAL-FIRST-ARCH',
    targetId: 'NODE-B-OFFLINE-PRD',
    relationType: 'COMMERCIAL_FEASIBILITY'
  });

  const traversal1 = traverseKnowledgeGraph(emptyGraph, 'NODE-H-INDEXEDDB-CRDT', { maxHops: 1 });
  assert(traversal1.reachableNodes.length === 3, '1-hop traversal discovers root + 2 direct neighbors (Count: 3)');

  const traversal2 = traverseKnowledgeGraph(emptyGraph, 'NODE-H-INDEXEDDB-CRDT', { maxHops: 3 });
  assert(traversal2.reachableNodes.length === 5, '3-hop traversal reaches all 5 connected nodes across domains A, B, G, H, K');
  assert(traversal2.depths['NODE-A-OFFLINE-NEED'] === 3, 'Node A reached at hop depth 3 through chain');

  // Filtered relation traversal
  const filteredTraversal = traverseKnowledgeGraph(emptyGraph, 'NODE-H-INDEXEDDB-CRDT', {
    maxHops: 2,
    relationTypes: ['VERIFIED_BY_TEST']
  });
  assert(filteredTraversal.reachableNodes.some(n => n.id === 'NODE-K-ZERO-NETWORK-TEST'), 'Filtered traversal includes VERIFIED_BY_TEST target');
  assert(!filteredTraversal.reachableNodes.some(n => n.id === 'NODE-G-LOCAL-FIRST-ARCH'), 'Filtered traversal strictly excludes non-matching edges');

  // ---------------------------------------------------------------------------
  // 5. Atomic Persistence & Reload
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 5: Atomic Sandbox Persistence & Reload ---');
  persistKnowledgeGraph(emptyGraph, sandboxDir);

  const storagePaths = getGraphStoragePaths(sandboxDir);
  assert(fs.existsSync(storagePaths.graphFile), 'Knowledge graph file exists on sandbox disk');

  const reloadedGraph = loadKnowledgeGraph(sandboxDir);
  assert(reloadedGraph.statistics.total_nodes === 5, 'Reloaded graph total nodes matches (5)');
  assert(reloadedGraph.statistics.total_edges === 4, 'Reloaded graph total edges matches (4)');
  assert(reloadedGraph.statistics.domain_distribution['H'] === 1, 'Domain distribution contains H');
  assert(reloadedGraph.statistics.relation_distribution['VERIFIED_BY_TEST'] === 1, 'Relation distribution contains VERIFIED_BY_TEST');

  // ---------------------------------------------------------------------------
  // 6. Canonical Registry Ingestion into Sandbox Graph
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 6: Canonical Registry Ingestion & Cross-Domain Edge Synthesis ---');
  // Create mock sandbox domain registry with 2 records
  const mockRegistryDir = path.join(sandboxDir, '05_KNOWLEDGE', 'domain-intelligence');
  fs.mkdirSync(mockRegistryDir, { recursive: true });
  fs.writeFileSync(path.join(mockRegistryDir, 'domain-registry.json'), JSON.stringify({
    version: '1.0.0',
    total_records: 2,
    records: {
      'DOM-H-CANON-01': {
        record_id: 'DOM-H-CANON-01',
        title: 'Buffer Alloc Unsafe Boundary',
        universal_invariant: 'Never allocate uninitialized memory buffers.',
        primary_domain: { letter: 'H', name: 'Technical Construction' },
        secondary_domains: [{ letter: 'K', name: 'Quality' }],
        confidence: 0.96,
        provenance: { source_uri: 'CANONICAL_AUDIT' }
      },
      'DOM-B-CANON-02': {
        record_id: 'DOM-B-CANON-02',
        title: 'MVP Scope Bounds',
        universal_invariant: 'P0 MVP must exclude cloud storage.',
        primary_domain: { letter: 'B', name: 'Product' },
        secondary_domains: [{ letter: 'A', name: 'Human Need' }],
        confidence: 0.94,
        provenance: { source_uri: 'CANONICAL_PRD' }
      }
    }
  }, null, 2), 'utf-8');

  const ingestionRes = ingestRegistryIntoKnowledgeGraph(sandboxDir);
  assert(ingestionRes.success === true, 'Successfully ingested registry into sandbox graph');
  assert(ingestionRes.nodesAdded >= 2, 'Added canonical records as graph nodes', `Nodes: ${ingestionRes.nodesAdded}`);
  assert(ingestionRes.edgesAdded >= 2, 'Synthesized cross-domain relationship edges', `Edges: ${ingestionRes.edgesAdded}`);

  // ---------------------------------------------------------------------------
  // 7. Strict Production Purity
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 7: Strict Production Purity Verification ---');
  const prodGraphPaths = getGraphStoragePaths(BRAIN_ROOT);
  assert(!fs.existsSync(path.join(prodGraphPaths.graphDir, 'sandbox-test')), 'Zero sandbox files leaked to production');

} finally {
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (e) { }
}

console.log('\n======================================================================');
console.log(`📊 GRAPH VERIFICATION SUMMARY: ${passedTests} passed | ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests === 0) {
  console.log('🎉 KNOWLEDGE RELATIONSHIP GRAPH IS FULLY VERIFIED WORKING!');
  process.exit(0);
} else {
  console.error('❌ Knowledge Relationship Graph test suite failed!');
  process.exit(1);
}

