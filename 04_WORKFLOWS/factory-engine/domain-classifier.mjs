/**
 * 04_WORKFLOWS/factory-engine/domain-classifier.mjs
 *
 * Universal 13-Domain Knowledge Classifier (Model-Independent)
 * Governing Architecture: AI-Builder-Brain Continuous Intelligence
 *
 * Classifies raw or extracted text across all 13 co-equal intelligence domains (A–M):
 * A: Human & Need
 * B: Product
 * C: Market & Business
 * D: Research & Knowledge
 * E: Creative
 * F: Design
 * G: Architecture
 * H: Technical Construction
 * I: Content & Information
 * J: Search & Distribution
 * K: Quality & Verification
 * L: Deployment & Operations
 * M: Feedback & Evolution
 */

import crypto from 'crypto';
import { INTELLIGENCE_DOMAINS } from './domain-intelligence-engine.mjs';

// Pre-compute normalized keyword sets for deterministic in-memory matching
export const DOMAIN_TAXONOMY = Object.entries(INTELLIGENCE_DOMAINS).map(([letter, domain]) => ({
  letter,
  id: domain.id,
  name: domain.name,
  keywords: new Set((domain.keywords || []).map(k => k.toLowerCase().trim()))
}));

// Known prompt injection / malicious instruction patterns to neutralize untrusted external data
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system:\s*override/i,
  /you\s+are\s+now\s+(an?\s+)?unrestricted/i,
  /disregard\s+(the\s+)?safety/i,
  /bypass\s+(all\s+)?(guardrails|checks|security)/i,
  /reveal\s+(the\s+)?(secret|token|api_key|password)/i
];

/**
 * Deterministic text tokenizer
 */
export function tokenizeText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/**
 * Detects whether external content contains adversarial instruction override attempts
 */
export function detectUntrustedInjection(text) {
  if (!text || typeof text !== 'string') return { safe: true, matches: [] };
  const matches = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(pattern.toString());
    }
  }
  return {
    safe: matches.length === 0,
    matches
  };
}

/**
 * Universal Content Classification across all 13 domains
 *
 * @param {string|object} input - Text body or structured candidate object { title, content, tags }
 * @param {object} options - Classification options { minSecondaryRatio, defaultFallback }
 * @returns {object} Classification result with primaryDomain, secondaryDomains, confidence, scores
 */
export function classifyKnowledgeContent(input, options = {}) {
  let text = '';
  let tags = [];

  if (typeof input === 'string') {
    text = input;
  } else if (input && typeof input === 'object') {
    const firstRule = (Array.isArray(input.validated_rules) && input.validated_rules[0]) ||
                      (Array.isArray(input.candidate_rules) && input.candidate_rules[0]) ||
                      (Array.isArray(input.extracted_rules) && input.extracted_rules[0]) || {};
    const ruleTags = Array.isArray(firstRule.tags) ? firstRule.tags : [];
    const directTags = Array.isArray(input.tags || input.trigger_tags) ? (input.tags || input.trigger_tags) : [];
    tags = [...directTags, ...ruleTags];
    text = `${input.title || firstRule.title || ''} ${input.context || firstRule.context || ''} ${input.content || firstRule.body || ''} ${input.dossier_content || ''} ${input.rule || ''} ${input.why || ''}`;
  }

  // Security check for untrusted external injection
  const injectionAudit = detectUntrustedInjection(text);

  const tokens = tokenizeText(text);
  const tagTokens = tags.map(t => String(t).toLowerCase().trim());
  const allTokens = [...tokens, ...tagTokens];

  if (allTokens.length === 0) {
    return {
      status: 'EMPTY_INPUT',
      primaryDomain: null,
      secondaryDomains: [],
      confidence: 0.0,
      scores: {},
      isUntrusted: !injectionAudit.safe,
      securityFlags: injectionAudit.matches
    };
  }

  // Calculate scores per domain
  const domainScores = {};
  let maxScore = 0;
  let totalScore = 0;

  for (const domain of DOMAIN_TAXONOMY) {
    let score = 0;
    for (const t of allTokens) {
      if (domain.keywords.has(t)) {
        // Tag matches carry 2x weight
        score += tagTokens.includes(t) ? 2 : 1;
      }
    }
    domainScores[domain.letter] = score;
    totalScore += score;
    if (score > maxScore) {
      maxScore = score;
    }
  }

  // Ambiguous condition: no keywords matched any domain
  if (maxScore === 0) {
    return {
      status: 'AMBIGUOUS',
      primaryDomain: null,
      secondaryDomains: [],
      confidence: 0.0,
      scores: domainScores,
      isUntrusted: !injectionAudit.safe,
      securityFlags: injectionAudit.matches,
      uncertaintyReason: 'Zero keyword matches across all 13 domain vocabularies'
    };
  }

  // Rank domains by score
  const ranked = Object.entries(domainScores)
    .filter(([_, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  const primaryLetter = ranked[0][0];
  const primaryDomain = INTELLIGENCE_DOMAINS[primaryLetter];

  // Secondary domains: any domain with >= 40% of the max score, or >= 2 matches (excluding primary)
  const minRatio = options.minSecondaryRatio || 0.4;
  const secondaryDomains = ranked
    .slice(1)
    .filter(([_, score]) => (score / maxScore >= minRatio) || score >= 2)
    .map(([letter, _]) => ({
      letter,
      id: INTELLIGENCE_DOMAINS[letter].id,
      name: INTELLIGENCE_DOMAINS[letter].name
    }));

  // Confidence calculation: separation margin between rank 1 and rank 2, normalized by token density
  const runnerUpScore = ranked.length > 1 ? ranked[1][1] : 0;
  const margin = (maxScore - runnerUpScore) / Math.max(1, maxScore);
  const density = Math.min(1.0, maxScore / 5);
  const confidence = parseFloat((0.5 * margin + 0.5 * density).toFixed(3));

  return {
    status: 'CLASSIFIED',
    primaryDomain: {
      letter: primaryLetter,
      id: primaryDomain.id,
      name: primaryDomain.name
    },
    secondaryDomains,
    confidence,
    scores: domainScores,
    isUntrusted: !injectionAudit.safe,
    securityFlags: injectionAudit.matches
  };
}

/**
 * Batch classifies candidate directives (e.g. from 11_INBOX)
 */
export function batchClassifyDirectives(directives = []) {
  return directives.map(d => {
    const res = classifyKnowledgeContent(d);
    return {
      id: d.id,
      directive_title: d.directive_title || d.title,
      candidateDomain: res.primaryDomain ? res.primaryDomain.letter : 'UNASSIGNED',
      candidateDomainName: res.primaryDomain ? res.primaryDomain.name : null,
      secondaryDomains: res.secondaryDomains.map(s => s.letter),
      classificationConfidence: res.confidence,
      classificationStatus: res.status,
      isUntrusted: res.isUntrusted
    };
  });
}

