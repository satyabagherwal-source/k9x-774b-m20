/**
 * AI-Builder-Brain Universal Knowledge Relationship Graph & Ontology Engine
 * 
 * Location: 04_WORKFLOWS/factory-engine/knowledge-relationship-graph.mjs
 * Purpose: MISSION-ALIGN-03 (System B & C Foundation)
 *          Connects discrete 13-domain knowledge records, engineering patterns, and
 *          forensic dossiers into a structured, queryable, multi-relational Knowledge Graph.
 * 
 * Invariants:
 * 1. AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS CREATE OUTCOMES.
 * 2. 13-Domain Relational Parity: Connects nodes across all 13 Co-Equal Intelligence Domains (A–M).
 * 3. Epistemic Traceability: Every node and edge preserves immutable source provenance, confidence, and timestamp.
 * 4. Deterministic Multi-Hop Traversal: Directed semantic graph supports cycle-safe path traversal.
 * 5. Strictly Additive Evolution: Never deletes or weakens existing verified relationships.
 * 6. Zero Production Contamination: Supports custom root directories and isolated testing sandboxes.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  INTELLIGENCE_DOMAINS,
  resolveDomain,
  classifyIntelligenceDomain,
  loadDomainRegistry
} from './domain-intelligence-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// 1. Canonical Relationship Ontology & Taxonomies
// ---------------------------------------------------------------------------

export const KNOWLEDGE_RELATION_TYPES = Object.freeze({
  // Cross-Domain Lifecycle Relationships
  SOLVES_PROBLEM: {
    id: 'SOLVES_PROBLEM',
    name: 'Solves Human Need',
    sourceDomain: 'B', // Product
    targetDomain: 'A', // Human Need
    description: 'Product capability directly addresses a specific human pain point or need.'
  },
  CONSTRAINED_BY_ARCHITECTURE: {
    id: 'CONSTRAINED_BY_ARCHITECTURE',
    name: 'Constrained by Architecture',
    sourceDomain: 'H', // Technical
    targetDomain: 'G', // Architecture
    description: 'Technical implementation must adhere to an architectural boundary or invariant.'
  },
  IMPLEMENTED_BY_CODE: {
    id: 'IMPLEMENTED_BY_CODE',
    name: 'Implemented by Code Pattern',
    sourceDomain: 'G', // Architecture
    targetDomain: 'H', // Technical
    description: 'Architectural pattern is concretely realized through technical code or components.'
  },
  STYLED_BY_DESIGN: {
    id: 'STYLED_BY_DESIGN',
    name: 'Styled by Design System',
    sourceDomain: 'H', // Technical
    targetDomain: 'F', // Design
    description: 'UI implementation adheres to design tokens, typography, and contrast rules.'
  },
  VERIFIED_BY_TEST: {
    id: 'VERIFIED_BY_TEST',
    name: 'Verified by Quality Test',
    sourceDomain: 'H', // Technical
    targetDomain: 'K', // Verification
    description: 'Technical construction is verified against automated test suites and assertions.'
  },
  DEPLOYED_BY_OPS: {
    id: 'DEPLOYED_BY_OPS',
    name: 'Deployed by Operations',
    sourceDomain: 'H', // Technical
    targetDomain: 'L', // Deployment
    description: 'Code artifact is packaged, containerized, or deployed by ops workflow.'
  },
  INDEXED_BY_SEO: {
    id: 'INDEXED_BY_SEO',
    name: 'Indexed by Distribution & SEO',
    sourceDomain: 'I', // Content
    targetDomain: 'J', // Search/Distribution
    description: 'Content artifact is discovered, indexed, and distributed via search engines.'
  },
  GOVERNED_BY_FEEDBACK: {
    id: 'GOVERNED_BY_FEEDBACK',
    name: 'Governed by Feedback & Evolution',
    sourceDomain: 'M', // Feedback
    targetDomain: 'H', // Technical
    description: 'Operational feedback loop triggers continuous refactoring or bug remediation.'
  },
  COMMERCIAL_FEASIBILITY: {
    id: 'COMMERCIAL_FEASIBILITY',
    name: 'Validated by Business Feasibility',
    sourceDomain: 'B', // Product
    targetDomain: 'C', // Market/Business
    description: 'Product scope aligns with business model, unit economics, and market hurdle.'
  },

  // Epistemic & Provenance Relationships
  EVIDENCE_CORROBORATES: {
    id: 'EVIDENCE_CORROBORATES',
    name: 'Evidence Corroborates',
    description: 'An independent source or evidence record confirms an existing claim or invariant.'
  },
  DEPENDS_ON: {
    id: 'DEPENDS_ON',
    name: 'Depends on Prerequisite Knowledge',
    description: 'A component or invariant relies on a foundational rule or prerequisite.'
  },
  DERIVED_FROM: {
    id: 'DERIVED_FROM',
    name: 'Derived from Empirical Source',
    description: 'Knowledge candidate derived from a specific dossier, commit, or issue.'
  },
  APPLIES_TO: {
    id: 'APPLIES_TO',
    name: 'Applies to Architecture or Domain',
    description: 'Designates that a rule applies to a specific execution model, runtime, or stack.'
  },
  SUPERSEDES: {
    id: 'SUPERSEDES',
    name: 'Supersedes Outdated Knowledge',
    description: 'A newer verified rule or pattern replaces a deprecated legacy pattern.'
  },
  DEPRECATES: {
    id: 'DEPRECATES',
    name: 'Deprecates Insecure or Obsolete Practice',
    description: 'Marks an older practice as obsolete or hazardous with causal rationale.'
  },
  CONFLICTS_WITH: {
    id: 'CONFLICTS_WITH',
    name: 'Direct Invariant Conflict',
    description: 'Two patterns or directives express mutually exclusive normative mandates.'
  },
  CONTRADICTS: {
    id: 'CONTRADICTS',
    name: 'Logical Contradiction',
    description: 'Two claims directly oppose one another across context boundaries.'
  }
});

// ---------------------------------------------------------------------------
// 2. Storage Paths & In-Memory Graph Structure
// ---------------------------------------------------------------------------

export function getGraphStoragePaths(customRoot = null) {
  const root = customRoot ? path.resolve(customRoot) : BRAIN_ROOT;
  const graphDir = path.join(root, '.project-brain', 'knowledge-graph');
  return {
    graphDir,
    graphFile: path.join(graphDir, 'relationship-graph.json'),
    auditFile: path.join(graphDir, 'graph-audit-log.json')
  };
}

/**
 * Initializes a clean, valid Knowledge Graph data structure.
 */
export function createEmptyKnowledgeGraph() {
  return {
    version: '1.0.0',
    name: 'AI-Builder-Brain Universal Knowledge Relationship Graph',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    statistics: {
      total_nodes: 0,
      total_edges: 0,
      domain_distribution: {},
      relation_distribution: {}
    },
    nodes: {},
    edges: []
  };
}

/**
 * Loads the Knowledge Graph from disk or returns a fresh empty structure.
 */
export function loadKnowledgeGraph(customRoot = null) {
  const p = getGraphStoragePaths(customRoot);
  if (!fs.existsSync(p.graphFile)) {
    return createEmptyKnowledgeGraph();
  }
  try {
    const raw = fs.readFileSync(p.graphFile, 'utf-8');
    const graph = JSON.parse(raw);
    if (!graph.nodes || !Array.isArray(graph.edges)) {
      return createEmptyKnowledgeGraph();
    }
    return graph;
  } catch (err) {
    console.warn(`[WARN] Failed to parse knowledge graph at ${p.graphFile}, returning empty graph: ${err.message}`);
    return createEmptyKnowledgeGraph();
  }
}

/**
 * Saves the Knowledge Graph atomically to disk.
 */
export function persistKnowledgeGraph(graph, customRoot = null) {
  const p = getGraphStoragePaths(customRoot);
  if (!fs.existsSync(p.graphDir)) {
    fs.mkdirSync(p.graphDir, { recursive: true });
  }

  // Update statistics
  graph.updated_at = new Date().toISOString();
  graph.statistics.total_nodes = Object.keys(graph.nodes).length;
  graph.statistics.total_edges = graph.edges.length;

  const domainDist = {};
  for (const node of Object.values(graph.nodes)) {
    const d = node.domain || 'UNKNOWN';
    domainDist[d] = (domainDist[d] || 0) + 1;
  }
  graph.statistics.domain_distribution = domainDist;

  const relDist = {};
  for (const edge of graph.edges) {
    const r = edge.relationType || 'UNKNOWN';
    relDist[r] = (relDist[r] || 0) + 1;
  }
  graph.statistics.relation_distribution = relDist;

  // Atomic write via temp file
  const tmpPath = `${p.graphFile}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(graph, null, 2), 'utf-8');
  fs.renameSync(tmpPath, p.graphFile);

  return true;
}

// ---------------------------------------------------------------------------
// 3. Node & Edge Management
// ---------------------------------------------------------------------------

/**
 * Computes deterministic Node ID from domain and identifier.
 */
export function computeNodeId(domainLetter, entityName) {
  const normDomain = String(domainLetter || 'H').toUpperCase().trim();
  const normName = String(entityName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
  return `NODE-${normDomain}-${normName}`;
}

/**
 * Adds or updates a Knowledge Node in the graph.
 */
export function upsertGraphNode(graph, nodeData) {
  if (!nodeData || !nodeData.id) {
    throw new Error('Graph node must provide a valid ID');
  }

  const existing = graph.nodes[nodeData.id];
  const domain = nodeData.domain || (existing ? existing.domain : 'H');
  const now = new Date().toISOString();

  const node = {
    id: nodeData.id,
    domain,
    type: nodeData.type || (existing ? existing.type : 'CONCEPT'),
    title: nodeData.title || (existing ? existing.title : nodeData.id),
    summary: nodeData.summary || (existing ? existing.summary : ''),
    confidence: typeof nodeData.confidence === 'number' ? nodeData.confidence : (existing ? existing.confidence : 0.8),
    epistemic_state: nodeData.epistemic_state || (existing ? existing.epistemic_state : 'VALIDATED'),
    source_provenance: {
      ...(existing?.source_provenance || {}),
      ...(nodeData.source_provenance || {})
    },
    tags: Array.from(new Set([...(existing?.tags || []), ...(nodeData.tags || [])])),
    created_at: existing ? existing.created_at : now,
    updated_at: now
  };

  graph.nodes[nodeData.id] = node;
  return node;
}

/**
 * Adds a directed edge between two existing nodes.
 * Automatically avoids exact duplicate edges.
 */
export function addGraphEdge(graph, edgeData) {
  if (!edgeData || !edgeData.sourceId || !edgeData.targetId || !edgeData.relationType) {
    throw new Error('Graph edge must provide sourceId, targetId, and relationType');
  }

  if (!graph.nodes[edgeData.sourceId]) {
    throw new Error(`Source node does not exist in graph: ${edgeData.sourceId}`);
  }
  if (!graph.nodes[edgeData.targetId]) {
    throw new Error(`Target node does not exist in graph: ${edgeData.targetId}`);
  }

  // Check for existing edge
  const existingIndex = graph.edges.findIndex(e =>
    e.sourceId === edgeData.sourceId &&
    e.targetId === edgeData.targetId &&
    e.relationType === edgeData.relationType
  );

  const edgeId = `EDGE-${crypto.createHash('sha256')
    .update(`${edgeData.sourceId}:${edgeData.relationType}:${edgeData.targetId}`)
    .digest('hex').slice(0, 12).toUpperCase()}`;

  const edge = {
    id: edgeId,
    sourceId: edgeData.sourceId,
    targetId: edgeData.targetId,
    relationType: edgeData.relationType,
    weight: typeof edgeData.weight === 'number' ? edgeData.weight : 1.0,
    evidenceProvenance: edgeData.evidenceProvenance || null,
    rationale: edgeData.rationale || '',
    created_at: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // Update existing edge weights and rationale additively
    graph.edges[existingIndex] = {
      ...graph.edges[existingIndex],
      ...edge,
      created_at: graph.edges[existingIndex].created_at,
      updated_at: new Date().toISOString()
    };
    return graph.edges[existingIndex];
  }

  graph.edges.push(edge);
  return edge;
}

// ---------------------------------------------------------------------------
// 4. Graph Traversal & Multi-Hop Querying
// ---------------------------------------------------------------------------

/**
 * Traverses the Knowledge Graph starting from a root node up to maxHops.
 * Supports cycle detection and relation filtering.
 * 
 * @param {object} graph - Knowledge Graph object
 * @param {string} rootNodeId - Origin Node ID
 * @param {object} options - { maxHops: 2, relationTypes: [], minWeight: 0.0, direction: 'BOTH'|'OUT'|'IN' }
 * @returns {object} { nodes: [], edges: [], paths: [] }
 */
export function traverseKnowledgeGraph(graph, rootNodeId, options = {}) {
  const maxHops = typeof options.maxHops === 'number' ? options.maxHops : 2;
  const relationTypes = Array.isArray(options.relationTypes) && options.relationTypes.length > 0
    ? new Set(options.relationTypes)
    : null;
  const minWeight = typeof options.minWeight === 'number' ? options.minWeight : 0.0;
  const direction = options.direction || 'BOTH';

  if (!graph.nodes[rootNodeId]) {
    return {
      rootNode: null,
      reachableNodes: [],
      traversedEdges: [],
      depths: {}
    };
  }

  const visitedNodes = new Set([rootNodeId]);
  const collectedEdges = new Map();
  const nodeDepths = { [rootNodeId]: 0 };

  // BFS Queue: [ { nodeId, currentHop } ]
  const queue = [{ nodeId: rootNodeId, hop: 0 }];

  while (queue.length > 0) {
    const { nodeId, hop } = queue.shift();
    if (hop >= maxHops) continue;

    // Find outgoing and incoming edges
    for (const edge of graph.edges) {
      if (edge.weight < minWeight) continue;
      if (relationTypes && !relationTypes.has(edge.relationType)) continue;

      let neighborId = null;

      if ((direction === 'OUT' || direction === 'BOTH') && edge.sourceId === nodeId) {
        neighborId = edge.targetId;
      } else if ((direction === 'IN' || direction === 'BOTH') && edge.targetId === nodeId) {
        neighborId = edge.sourceId;
      }

      if (neighborId && graph.nodes[neighborId]) {
        collectedEdges.set(edge.id, edge);

        if (!visitedNodes.has(neighborId)) {
          visitedNodes.add(neighborId);
          nodeDepths[neighborId] = hop + 1;
          queue.push({ nodeId: neighborId, hop: hop + 1 });
        }
      }
    }
  }

  const reachableNodes = Array.from(visitedNodes).map(id => ({
    ...graph.nodes[id],
    distance: nodeDepths[id]
  })).sort((a, b) => a.distance - b.distance);

  return {
    rootNode: graph.nodes[rootNodeId],
    reachableNodes,
    traversedEdges: Array.from(collectedEdges.values()),
    depths: nodeDepths
  };
}

// ---------------------------------------------------------------------------
// 5. Automated Graph Ingestion from Canonical Registries & Patterns
// ---------------------------------------------------------------------------

/**
 * Builds or refreshes the Knowledge Graph by ingesting all canonical domain records
 * and cross-domain relationships.
 */
export function ingestRegistryIntoKnowledgeGraph(customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  const registry = loadDomainRegistry(root);
  const graph = loadKnowledgeGraph(root);

  let nodesAdded = 0;
  let edgesAdded = 0;

  // 1. Ingest Canonical Domain Intelligence Records as Nodes
  for (const [recordId, record] of Object.entries(registry.records || {})) {
    const domainLetter = record.primary_domain?.letter || record.domain || 'H';
    const nodeId = recordId;

    const node = upsertGraphNode(graph, {
      id: nodeId,
      domain: domainLetter,
      type: 'CANONICAL_DIRECTIVE',
      title: record.title || record.invariant || recordId,
      summary: record.causal_explanation || record.universal_invariant || '',
      confidence: record.confidence || 0.95,
      epistemic_state: 'CANONICAL',
      source_provenance: record.provenance || { source_uri: 'CANONICAL_REGISTRY' },
      tags: [domainLetter, record.primary_domain?.name || '', ...(record.secondary_domains?.map(d => d.letter) || [])]
    });
    nodesAdded++;

    // Create cross-domain edges for secondary domains
    if (Array.isArray(record.secondary_domains)) {
      for (const sec of record.secondary_domains) {
        const secLetter = sec.letter || sec;
        if (!secLetter || secLetter === domainLetter) continue;

        // Create domain concept bridge node if needed
        const conceptNodeId = computeNodeId(secLetter, `domain-bridge-${secLetter}`);
        if (!graph.nodes[conceptNodeId]) {
          upsertGraphNode(graph, {
            id: conceptNodeId,
            domain: secLetter,
            type: 'DOMAIN_CONCEPT_BRIDGE',
            title: `Domain ${secLetter} Concept Space`,
            confidence: 1.0,
            epistemic_state: 'CANONICAL'
          });
        }

        // Determine appropriate relation type based on source and target domains
        let relType = 'CONSTRAINED_BY_ARCHITECTURE';
        if (domainLetter === 'H' && secLetter === 'F') relType = 'STYLED_BY_DESIGN';
        else if (domainLetter === 'H' && secLetter === 'K') relType = 'VERIFIED_BY_TEST';
        else if (domainLetter === 'H' && secLetter === 'L') relType = 'DEPLOYED_BY_OPS';
        else if (domainLetter === 'B' && secLetter === 'A') relType = 'SOLVES_PROBLEM';
        else if (domainLetter === 'B' && secLetter === 'C') relType = 'COMMERCIAL_FEASIBILITY';
        else if (domainLetter === 'I' && secLetter === 'J') relType = 'INDEXED_BY_SEO';
        else if (domainLetter === 'M') relType = 'GOVERNED_BY_FEEDBACK';

        addGraphEdge(graph, {
          sourceId: nodeId,
          targetId: conceptNodeId,
          relationType: relType,
          weight: 0.9,
          rationale: `Cross-domain classification links ${recordId} [${domainLetter}] with Domain ${secLetter}`
        });
        edgesAdded++;
      }
    }
  }

  // 2. Persist updated graph
  persistKnowledgeGraph(graph, root);

  return {
    success: true,
    nodesAdded,
    edgesAdded,
    totalNodes: graph.statistics.total_nodes,
    totalEdges: graph.statistics.total_edges
  };
}

/**
 * Synchronizes a single newly promoted or updated canonical record into the Knowledge Relationship Graph.
 * Ensures that System B promotion events immediately reflect in the graph.
 * 
 * @param {object} record - Canonical domain intelligence record
 * @param {string|null} customRoot - Optional root directory
 * @returns {object} { success: boolean, record_id: string, totalNodes: number, totalEdges: number }
 */
export function syncRecordToKnowledgeGraph(record, customRoot = null) {
  if (!record || !record.record_id) {
    return { success: false, reason: 'Missing valid record or record_id' };
  }

  const root = customRoot || BRAIN_ROOT;
  const graph = loadKnowledgeGraph(root);
  const domainLetter = record.domain_letter || record.primary_domain?.letter || record.domain || 'H';
  const nodeId = record.record_id;

  upsertGraphNode(graph, {
    id: nodeId,
    domain: domainLetter,
    type: 'CANONICAL_DIRECTIVE',
    title: record.title || record.invariant || nodeId,
    summary: record.summary || record.causal_explanation || record.content || '',
    confidence: record.confidence || 0.95,
    epistemic_state: 'CANONICAL',
    source_provenance: record.provenance || { source_uri: 'CANONICAL_REGISTRY' },
    tags: [domainLetter, record.domain_name || '', ...(record.secondary_domains?.map(d => d.letter) || [])]
  });

  // Cross-domain bridge edges
  if (Array.isArray(record.secondary_domains)) {
    for (const sec of record.secondary_domains) {
      const secLetter = sec.letter || sec;
      if (!secLetter || secLetter === domainLetter) continue;

      const conceptNodeId = computeNodeId(secLetter, `domain-bridge-${secLetter}`);
      if (!graph.nodes[conceptNodeId]) {
        upsertGraphNode(graph, {
          id: conceptNodeId,
          domain: secLetter,
          type: 'DOMAIN_CONCEPT_BRIDGE',
          title: `Domain ${secLetter} Concept Space`,
          confidence: 1.0,
          epistemic_state: 'CANONICAL'
        });
      }

      let relType = 'CONSTRAINED_BY_ARCHITECTURE';
      if (domainLetter === 'H' && secLetter === 'F') relType = 'STYLED_BY_DESIGN';
      else if (domainLetter === 'H' && secLetter === 'K') relType = 'VERIFIED_BY_TEST';
      else if (domainLetter === 'H' && secLetter === 'L') relType = 'DEPLOYED_BY_OPS';
      else if (domainLetter === 'B' && secLetter === 'A') relType = 'SOLVES_PROBLEM';
      else if (domainLetter === 'B' && secLetter === 'C') relType = 'COMMERCIAL_FEASIBILITY';
      else if (domainLetter === 'I' && secLetter === 'J') relType = 'INDEXED_BY_SEO';
      else if (domainLetter === 'M') relType = 'GOVERNED_BY_FEEDBACK';

      addGraphEdge(graph, {
        sourceId: nodeId,
        targetId: conceptNodeId,
        relationType: relType,
        weight: 0.9,
        rationale: `Cross-domain classification links ${record.record_id} [${domainLetter}] with Domain ${secLetter}`
      });
    }
  }

  // Explicit relationships if provided
  if (record.relationships && typeof record.relationships === 'object') {
    for (const [relType, targets] of Object.entries(record.relationships)) {
      const list = Array.isArray(targets) ? targets : [targets];
      for (const targetId of list) {
        if (graph.nodes[targetId]) {
          addGraphEdge(graph, {
            sourceId: nodeId,
            targetId,
            relationType: relType,
            weight: 1.0,
            rationale: `Explicit canonical link ${relType}`
          });
        }
      }
    }
  }

  persistKnowledgeGraph(graph, root);

  return {
    success: true,
    record_id: nodeId,
    totalNodes: graph.statistics.total_nodes,
    totalEdges: graph.statistics.total_edges
  };
}

/**
 * Retrieves graph-expanded contextual intelligence for a given list of record IDs.
 * Used by System C (Retrieval Engine) to enrich top search results with related
 * architectural constraints, tests, human needs, and operational rules.
 * 
 * @param {Array<string>} recordIds - Seed record IDs (e.g. from top BM25 search results)
 * @param {object} options - { maxHops: 1, customRoot: string, minWeight: 0.0 }
 * @returns {object} { expandedNodes: [], relationshipPaths: [], categorized: {} }
 */
export function getExpandedContextForRecords(recordIds = [], options = {}) {
  const root = options.customRoot || options.brainRoot || BRAIN_ROOT;
  const graph = loadKnowledgeGraph(root);
  const maxHops = typeof options.maxHops === 'number' ? options.maxHops : 1;
  const minWeight = typeof options.minWeight === 'number' ? options.minWeight : 0.0;

  const validRecordIds = (Array.isArray(recordIds) ? recordIds : [recordIds]).filter(id => id && graph.nodes[id]);
  if (validRecordIds.length === 0) {
    return {
      seedRecordIds: [],
      expandedNodes: [],
      relationshipPaths: [],
      categorized: {
        architectural_constraints: [],
        verification_tests: [],
        human_needs: [],
        design_tokens: [],
        deployment_ops: [],
        dependencies: []
      }
    };
  }

  const seenNodeIds = new Set(validRecordIds);
  const collectedNodes = [];
  const relationshipPaths = [];
  const categorized = {
    architectural_constraints: [],
    verification_tests: [],
    human_needs: [],
    design_tokens: [],
    deployment_ops: [],
    dependencies: []
  };

  for (const rootId of validRecordIds) {
    const traversal = traverseKnowledgeGraph(graph, rootId, { maxHops, minWeight, direction: 'BOTH' });

    for (const edge of traversal.traversedEdges) {
      const isOut = edge.sourceId === rootId;
      const otherId = isOut ? edge.targetId : edge.sourceId;
      const otherNode = graph.nodes[otherId];

      if (otherNode) {
        const pathStr = isOut
          ? `[${rootId}] --(${edge.relationType})--> [${otherId}]`
          : `[${otherId}] --(${edge.relationType})--> [${rootId}]`;

        if (!relationshipPaths.includes(pathStr)) {
          relationshipPaths.push(pathStr);
        }

        if (!seenNodeIds.has(otherId)) {
          seenNodeIds.add(otherId);
          const enrichedNode = {
            ...otherNode,
            connectedVia: edge.relationType,
            connectedFrom: rootId,
            edgeWeight: edge.weight
          };
          collectedNodes.push(enrichedNode);

          // Categorize
          if (edge.relationType === 'CONSTRAINED_BY_ARCHITECTURE') {
            categorized.architectural_constraints.push(enrichedNode);
          } else if (edge.relationType === 'VERIFIED_BY_TEST') {
            categorized.verification_tests.push(enrichedNode);
          } else if (edge.relationType === 'SOLVES_PROBLEM') {
            categorized.human_needs.push(enrichedNode);
          } else if (edge.relationType === 'STYLED_BY_DESIGN') {
            categorized.design_tokens.push(enrichedNode);
          } else if (edge.relationType === 'DEPLOYED_BY_OPS') {
            categorized.deployment_ops.push(enrichedNode);
          } else if (edge.relationType === 'DEPENDS_ON') {
            categorized.dependencies.push(enrichedNode);
          }
        }
      }
    }
  }

  return {
    seedRecordIds: validRecordIds,
    expandedNodes: collectedNodes,
    relationshipPaths,
    categorized
  };
}

