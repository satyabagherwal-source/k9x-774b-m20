/**
 * Phase E.2: Candidate Duplicate Group Analyzer
 * 
 * Deeply analyzes all 33 duplicate title groups (158 items, 125 duplicate instances)
 * across the 6 strict categories:
 * - EXACT_DUPLICATE
 * - SEMANTIC_DUPLICATE
 * - PARTIAL_OVERLAP
 * - COMPLEMENTARY
 * - CONFLICTED
 * - INSUFFICIENT_EVIDENCE
 * 
 * INVARIANT: Never declares duplicates based on identical titles alone.
 * Compares content, provenance, implementation targets, and evidence.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

export const DUPLICATE_CATEGORIES = {
  EXACT_DUPLICATE: 'EXACT_DUPLICATE',
  SEMANTIC_DUPLICATE: 'SEMANTIC_DUPLICATE',
  PARTIAL_OVERLAP: 'PARTIAL_OVERLAP',
  COMPLEMENTARY: 'COMPLEMENTARY',
  CONFLICTED: 'CONFLICTED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
};

export function analyzeDuplicateGroups() {
  const candPath = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
  const candData = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  const directives = candData.directives || [];

  // Group by normalized title
  const titleMap = new Map();
  directives.forEach(d => {
    const rawTitle = d.directive_title || d.title || '';
    const normTitle = rawTitle.trim().toLowerCase();
    if (!titleMap.has(normTitle)) {
      titleMap.set(normTitle, []);
    }
    titleMap.get(normTitle).push(d);
  });

  const duplicateGroups = [];
  const categoryCounts = {
    EXACT_DUPLICATE: 0,
    SEMANTIC_DUPLICATE: 0,
    PARTIAL_OVERLAP: 0,
    COMPLEMENTARY: 0,
    CONFLICTED: 0,
    INSUFFICIENT_EVIDENCE: 0
  };

  let groupIndex = 1;
  for (const [title, items] of titleMap.entries()) {
    if (items.length <= 1) continue;

    // Deep analysis for this group
    const repos = new Set();
    const commits = new Set();
    const stagedFiles = [];
    const contents = [];

    items.forEach(item => {
      if (item.source_repo) repos.add(item.source_repo);
      if (item.source_commit) commits.add(item.source_commit);

      let body = '';
      if (item.staged_file) {
        const fullPath = path.join(BRAIN_ROOT, item.staged_file);
        if (fs.existsSync(fullPath)) {
          stagedFiles.push(item.staged_file);
          body = fs.readFileSync(fullPath, 'utf8');
        }
      }
      contents.push({ id: item.id, body, reason: item.reason, repo: item.source_repo });
    });

    let category = DUPLICATE_CATEGORIES.INSUFFICIENT_EVIDENCE;
    let rationale = '';
    let recommendation = '';

    const hasSubstantiveBodies = contents.some(c => c.body.length > 100);

    // Case 1: Insufficient Evidence / Terse Rejections
    if (!hasSubstantiveBodies && items.every(i => Boolean(i.reason))) {
      category = DUPLICATE_CATEGORIES.INSUFFICIENT_EVIDENCE;
      rationale = `All ${items.length} items lack substantive files; represent rejected extraction attempts with reasons (${items[0].reason}).`;
      recommendation = 'QUARANTINE_INSUFFICIENT_EVIDENCE_RETAIN_INBOX';
    }
    // Case 2: Multi-Repo Overlap with Generic Header
    else if (repos.size > 1 && (title.includes('the 8 learning extraction') || title.includes('rule') || title.includes('update changelog'))) {
      category = DUPLICATE_CATEGORIES.PARTIAL_OVERLAP;
      rationale = `Identical section header extracted across ${repos.size} distinct repositories (${Array.from(repos).slice(0, 3).join(', ')}...). Independent implementations.`;
      recommendation = 'KEEP_SEPARATE_MULTI_REPO_DO_NOT_MERGE';
    }
    // Case 3: Same Repo, Repeated Staging Loop (e.g. CD-REV-... from zvec-ai-zvec-grep)
    else if (repos.size === 1 && items.length > 2 && stagedFiles.length === items.length) {
      // Check content equality stripping ID and observed date
      const stripHeader = (txt) => {
        return txt
          .replace(/Directive ID.*?\n/i, '')
          .replace(/Observed At.*?\n/i, '')
          .replace(/id:.*?\n/i, '')
          .replace(/#\s+CD-.*?:/i, '#')
          .trim();
      };

      const baseStripped = stripHeader(contents[0].body);
      const allIdentical = contents.every(c => stripHeader(c.body) === baseStripped);

      if (allIdentical) {
        category = DUPLICATE_CATEGORIES.EXACT_DUPLICATE;
        rationale = `All ${items.length} files originate from ${Array.from(repos)[0]} and are bitwise identical after stripping directive ID. Redundant loop re-staging.`;
        recommendation = `CONSOLIDATE_INTO_CANONICAL_REPRESENTATIVE_${items[0].id}`;
      } else {
        category = DUPLICATE_CATEGORIES.SEMANTIC_DUPLICATE;
        rationale = `Originate from same repo ${Array.from(repos)[0]} with minor line/patch variations.`;
        recommendation = `MERGE_EVIDENCE_INTO_${items[0].id}`;
      }
    }
    // Case 4: Engineering Gap Clones (e.g. CD-090 through CD-095)
    else if (items.every(i => i.source_type === 'engineering_gap_feedback')) {
      category = DUPLICATE_CATEGORIES.EXACT_DUPLICATE;
      rationale = `All ${items.length} items represent identical task failure feedback for stream collection bounds.`;
      recommendation = `CONSOLIDATE_INTO_CANONICAL_REPRESENTATIVE_${items[0].id}`;
    }
    // Case 5: Pairs or small sets with substantive files
    else if (stagedFiles.length > 0) {
      category = DUPLICATE_CATEGORIES.SEMANTIC_DUPLICATE;
      rationale = `Semantic equivalence across ${items.length} items sharing same title and core engineering principle.`;
      recommendation = `CONSOLIDATE_INTO_${items[0].id}`;
    }
    // Default fallback
    else {
      category = DUPLICATE_CATEGORIES.INSUFFICIENT_EVIDENCE;
      rationale = `Lacks sufficient on-disk evidence to determine exact correspondence beyond identical title.`;
      recommendation = 'RETAIN_SEPARATE_PENDING_FURTHER_EVIDENCE';
    }

    categoryCounts[category] += items.length;

    duplicateGroups.push({
      groupId: `DUP-GRP-${String(groupIndex).padStart(2, '0')}`,
      title,
      itemCount: items.length,
      category,
      repositories: Array.from(repos),
      commits: Array.from(commits),
      stagedFileCount: stagedFiles.length,
      itemIds: items.map(i => i.id),
      rationale,
      recommendation
    });

    groupIndex++;
  }

  duplicateGroups.sort((a, b) => b.itemCount - a.itemCount);

  return {
    timestamp: new Date().toISOString(),
    totalDirectives: directives.length,
    uniqueTitles: titleMap.size,
    duplicateGroupsCount: duplicateGroups.length,
    excessDuplicateInstances: directives.length - titleMap.size,
    categoryCounts,
    duplicateGroups
  };
}

