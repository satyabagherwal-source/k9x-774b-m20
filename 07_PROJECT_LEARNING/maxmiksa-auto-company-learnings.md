# Forensic Learning Record (Deep Inspection): MaxMiksa/Auto-Company

> **Canonical Artifact**: `07_PROJECT_LEARNING/maxmiksa-auto-company-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MaxMiksa/Auto-Company](https://github.com/MaxMiksa/Auto-Company))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:05:04.965Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MaxMiksa/Auto-Company`
- **Description**: An auto-company works for 24/7 on your own PC - Windows/Linux/macOS.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3116 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/deep-research/scripts/research_engine.py`
```
#!/usr/bin/env python3
"""
Deep Research Engine for Claude Code
Orchestrates comprehensive research across multiple sources with verification and synthesis
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum


class ResearchPhase(Enum):
    """Research pipeline phases"""
    SCOPE = "scope"
    PLAN = "plan"
    RETRIEVE = "retrieve"
    TRIANGULATE = "triangulate"
    SYNTHESIZE = "synthesize"
    CRITIQUE = "critique"
    REFINE = "refine"
    PACKAGE = "package"


class ResearchMode(Enum):
    """Research depth modes"""
    QUICK = "quick"  # 3 phases: scope, retrieve, package
    STANDARD = "standard"  # 6 phases: skip refine and critique
    DEEP = "deep"  # Full 8 phases
    ULTRADEEP = "ultradeep"  # 8 phases + extended iterations


@dataclass
class Source:
    """Represents a research source"""
    url: str
    title: str
    snippet: str
    retrieved_at: str
    credibility_score: float = 0.0
    source_type: str = "web"  # web, academic, documentation, code
    verification_status: str = "unverified"  # unverified, verified, conflicted

    def to_citation(self, index: int) -> str:
        """Generate citation string"""
        return f"[{index}] {self.title} - {self.url} (Retrieved: {self.retrieved_at})"


@dataclass
class ResearchState:
    """Maintains research state across phases"""
    query: str
    mode: ResearchMode
    phase: ResearchPhase
    scope: Dict[str, Any]
    plan: Dict[str, Any]
    sources: List[Source]
    findings: List[Dict[str, Any]]
    synthesis: Dict[str, Any]
    critique: Dict[str, Any]
    report: str
    metadata: Dict[str, Any]

    def save(self, filepath: Path):
        """Save research state to file with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with open(filepath, 'w') as f:
                    json.dump(self._serialize(), f, indent=2)
                return  # Success
            except (IOError, OSError) as e:
                if attempt == max_retries - 1:
                    # Final attempt failed
                    raise IOError(f"Failed to save state after {max_retries} attempts: {e}")
                # Wait with exponential backoff before retry
                wait_time = (attempt + 1) * 0.5  # 0.5s, 1s, 1.5s
                time.sleep(wait_time)

    def _serialize(self) -> dict:
        """Convert to serializable dict"""
        return {
            'query': self.query,
            'mode': self.mode.value,
            'phase': self.phase.value,
            'scope': self.scope,
            'plan': self.plan,
            'sources': [asdict(s) for s in self.sources],
            'findings': self.findings,
            'synthesis': self.synthesis,
            'critique': self.critique,
            'report': self.report,
            'metadata': self.metadata
        }

    @classmethod
    def load(cls, filepath: Path) -> 'ResearchState':
        """Load research state from file"""
        with open(filepath, 'r') as f:
            data = json.load(f)

        return cls(
            query=data['query'],
            mode=ResearchMode(data['mode']),
            phase=ResearchPhase(data['phase']),
            scope=data['scope'],
            plan=data['plan'],
            sources=[Source(**s) for s in data['sources']],
            findings=data['findings'],
            synthesis=data['synthesis'],
            critique=data['critique'],
            report=data['report'],
            metadata=data['metadata']
        )


class ResearchEngine:
    """Main research orchestration engine"""

    def __init__(self, mode: ResearchMode = ResearchMode.STANDARD):
        self.mode = mode
        self.state: Optional[ResearchState] = None
        self.output_dir = Path.home() / ".claude" / "research_output"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def initialize_research(self, query: str) -> ResearchState:
        """Initialize new research session"""
        self.state = ResearchState(
            query=query,
            mode=self.mode,
            phase=ResearchPhase.SCOPE,
            scope={},
            plan={},
            sources=[],
            findings=[],
            synthesis={},
            critique={},
            report="",
            metadata={
                'started_at': datetime.now().isoformat(),
                'version': '1.0'
            }
        )
        return self.state

    def get_phase_instructions(self, phase: ResearchPhase) -> str:
        """Get instructions for current phase"""
        instructions = {
            ResearchPhase.SCOPE: """
# Phase 1: SCOPE

Your task: Define research boundaries and success criteria

## Execute:
1. Decompose the question into 3-5 core components
2. Identify 2-4 key stakeholder perspectives
3. Define what's IN scope and what's OUT of scope
4. List 3-5 success criteria for this research
5. Document 3-5 assumptions that need validation

## Output Format:
```json
{
  "core_components": ["component1", "component2", ...],
  "stakeholder_perspectives": ["perspective1", "perspective2", ...],
  "in_scope": ["item1", "item2", ...],
  "out_of_scope": ["item1", "item2", ...],
  "success_criteria": ["criteria1", "criteria2", ...],
  "assumptions": ["assumption1", "assumption2", ...]
}
```

Use extended reasoning to explore multiple framings before finalizing scope.
""",
            ResearchPhase.PLAN: """
# Phase 2: PLAN

Your task: Create intelligent research roadmap

## Execute:
1. Identify 5-10 primary sources to investigate
2. List 5-10 secondary/backup sources
3. Map knowledge dependencies (what must be understood first)
4. Create 10-15 search query variations
5. Plan triangulation approach (how to verify claims)
6. Define 3-5 quality gates

## Output Format:
```json
{
  "primary_sources": ["source_type1", "source_type2", ...],
  "secondary_sources": ["source_type1", "source_type2", ...],
  "knowledge_dependencies": {"concept1": ["prerequisite1", "prerequisite2"], ...},
  "search_queries": ["query1", "query2", ...],
  "triangulation_strategy": "description of verification approach",
  "quality_gates": ["gate1", "gate2", ...]
}
```

Use Graph-of-Thoughts: branch into 3-4 potential research paths, evaluate, then converge on optimal strategy.
""",
            ResearchPhase.RETRIEVE: """
# Phase 3: RETRIEVE

Your task: Systematically collect information from multiple sources

## Execute:
1. Use WebSearch with iterative query refinement (minimum 10 searches)
2. Use WebFetch to deep-dive into 5-10 most promising sources
3. Extract key passages with metadata
4. Track information gaps
5. Follow 2-3 promising tangents
6. Ensure source diversity (different domains, perspectives)

## Tools to Use:
- WebSearch: For current information and broad coverage
- WebFetch: For detailed extraction from specific URLs
- Grep/Read: For local documentation if relevant
- Task: Spawn 2-3 parallel retrieval agents for efficiency

## Output:
Store all sources with metadata. Each source should include:
- URL/location
- Title
- Key excerpts
- Relevance score
- Source type
- Retrieved timestamp

Aim for 15-30 distinct sources minimum.
""",
            ResearchPhase.TRIANGULATE: """
# Phase 4: TRIANGULATE

Your task: Validate information across multiple independent sources

## Execute:
1. List all major claims from retrieved information
2. For each claim, find 3+ independent confirmatory sources
3. Flag any contradictions or uncertainties
4. Assess source credibility (domain expertise, recency, bias)
5. Document consensus areas vs. debate areas
6. Mark verification status for each claim

## Quality Standards:
- Core claims MUST have 3+ independent sources
- Flag any single-source claims as "unverified"
- Note information recency
- Identify potential biases

## Output Format:
```json
{
  "verified_claims": [
    {
      "claim": "statement",
      "sources": ["source1", "source2", "source3"],
      "confidence": "high|medium|low"
    }
  ],
  "unverified_claims": [...],
  "contradictions": [
    {
      "topic": "what's contradicted",
      "viewpoint1": {"claim": "...", "sources": [...]},
      "viewpoint2": {"claim": "...", "sources": [...]}
    }
  ]
}
```
""",
            ResearchPhase.SYNTHESIZE: """
# Phase 5: SYNTHESIZE

Your task: Connect insights and generate novel understanding

## Execute:
1. Identify 5-10 key patterns across sources
2. Map relationships between concepts
3. Generate 3-5 insights that go beyond source material
4. Create conceptual frameworks or mental models
5. Build argument structures
6. Develop evidence hierarchies

## Use Extended Reasoning:
- Explore non-obvious connections
- Consider second-order implications
- Think about what sources might be missing
- Generate novel hypotheses

## Output Format:
```json
{
  "patterns": ["pattern1", "pattern2", ...],
  "concept_relationships": {"concept1": ["related_to1", "related_to2"], ...},
  "novel_insights": ["insight1", "insight2", ...],
  "frameworks": ["framework_description1", ...],
  "key_arguments": [
    {
      "argument": "main claim",
      "supporting_evidence": ["evidence1", "evidence2"],
      "strength": "strong|moderate|weak"
    }
  ]
}
```
""",
            ResearchPhase.CRITIQUE: """
# Phase 6: CRITIQUE

Your task: Rigorously evaluate research quality

## Execute Red Team Analysis:
1. Check logical consistency
2. Verify citation completeness
3. Identify gaps or weaknesses
4. Assess balance and objectivity
5. Test alternative interpretations
6. Challenge assumptions

## Red Team Questions:
- What's missing from this research?
- What could be wrong?
- What alternative explanations exist?
- What biases might be present?
- What counterfactuals should be considered?
- What would a skeptic say?

## Output Format:
```json
{
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "we
```

### Core Architecture Module: `.claude/skills/tailwind-v4-shadcn/templates/utils.ts`
```
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `dashboard/ui/src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

```

### Core Architecture Module: `examples/chart-proof/core.js`
```
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChartProof = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KINDS = ['observed', 'approximate', 'interpolated', 'missing', 'unconfirmed'];
  const LABELS = { observed: '观测值', approximate: '近似值', interpolated: '插值', missing: '缺测', unconfirmed: '未确认' };
  const MAX_POINTS = 5000;
  const MAX_TEXT = 10000;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  const emptyReview = () => ({ name: '', date: '', note: '' });
  const fail = message => { throw new Error(message); };
  const text = (value, label, limit = MAX_TEXT) => {
    if (typeof value !== 'string' || value.length > limit) fail(`${label}必须是长度不超过 ${limit} 的文本。`);
    return value;
  };
  const object = (value, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}格式不正确。`);
  };
  const keys = (value, allowed, label) => {
    Object.keys(value).forEach(key => { if (!allowed.includes(key)) fail(`${label}包含未知字段：${key}。`); });
  };
  const number = (value, label) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label}必须是有限数值。`);
    return value;
  };
  const parseNumber = (value, label) => {
    const input = value.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(input)) fail(`${label}不是有效数值：${value}。`);
    return number(Number(input), label);
  };
  const isoDate = (value, label) => {
    text(value, label, 100);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label}必须是 UTC ISO 时间。`);
    const canonical = value.includes('.') ? value.replace(/\.(\d{1,3})Z$/, (_, digits) => '.' + digits.padEnd(3, '0') + 'Z') : value.replace('Z', '.000Z');
    if (new Date(value).toISOString() !== canonical) fail(`${label}不是有效日期。`);
    return value;
  };

  function normalizePoint(input, position) {
    object(input, `第 ${position + 1} 个点`);
    keys(input, ['id', 'series', 'x', 'y', 'kind', 'evidence', 'note', 'review'], '数据点');
    const point = {
      id: text(input.id, '数据点标识', 100),
      series: text(input.series, '系列名称', 200).trim(),
      x: number(input.x, '横轴值'),
      y: input.y === null ? null : number(input.y, '纵轴值'),
      kind: input.kind,
      evidence: text(input.evidence, '数值出处'),
      note: text(input.note, '数据备注'),
      review: emptyReview()
    };
    if (!point.id.trim()) fail('数据点标识不能为空。');
    if (!point.series) fail('系列名称不能为空。');
    if (!KINDS.includes(point.kind)) fail(`未知数据类型：${point.kind}。`);
    if (point.kind === 'missing' && point.y !== null) fail('缺测点不能包含数值。');
    if (point.kind !== 'missing' && point.y === null) fail('空值必须标记为缺测。');
    object(input.review, '复核记录');
    keys(input.review, ['name', 'date', 'note'], '复核记录');
    point.review.name = text(input.review.name, '复核人', 200).trim();
    point.review.date = text(input.review.date, '复核时间', 100);
    point.review.note = text(input.review.note, '复核备注');
    if (point.review.name || point.review.date) {
      if (!point.review.name || !point.review.date || !point.evidence.trim()) fail('已复核点必须保留复核人、时间和出处。');
      isoDate(point.review.date, '复核时间');
    } else if (point.review.note) fail('未署名复核不能包含复核备注。');
    return point;
  }

  function normalizeMeta(input = {}) {
    object(input, '项目说明');
    keys(input, ['title', 'source', 'xLabel', 'yLabel', 'xScale', 'yScale', 'description'], '项目说明');
    const defaults = { title: '未命名图表资料', source: '', xLabel: '横轴', yLabel: '纵轴', xScale: 'linear', yScale: 'linear', description: '' };
    const meta = {};
    Object.keys(defaults).forEach(key => { meta[key] = own(input, key) ? text(input[key], `项目 ${key}`) : defaults[key]; });
    if (!meta.title.trim()) fail('资料标题不能为空。');
    if (!['linear', 'log'].includes(meta.xScale) || !['linear', 'log'].includes(meta.yScale)) fail('轴尺度仅支持 linear（线性）或 log（对数）。');
    return meta;
  }

  function validateProject(input) {
    object(input, '项目');
    keys(input, ['version', 'meta', 'points', 'history'], '项目');
    if (input.version !== 1) fail('不支持此项目版本，请使用版本 1。');
    object(input.meta, '项目说明');
    if (!['title', 'source', 'xLabel', 'yLabel', 'xScale', 'yScale', 'description'].every(key => own(input.meta, key))) fail('项目说明缺少必需字段。');
    if (!Array.isArray(input.points) || !input.points.length || input.points.length > MAX_POINTS) fail(`项目需包含 1 至 ${MAX_POINTS} 个数据点。`);
    const meta = normalizeMeta(input.meta);
    const points = input.points.map(normalizePoint);
    const ids = new Set();
    const coordinates = new Set();
    points.forEach(point => {
      if (ids.has(point.id)) fail(`数据点标识重复：${point.id}。`);
      ids.add(point.id);
      const coordinate = JSON.stringify([point.series, point.x]);
      if (coordinates.has(coordinate)) fail(`系列「${point.series}」的横轴值 ${point.x} 重复。`);
      coordinates.add(coordinate);
      if (meta.xScale === 'log' && point.x <= 0) fail('对数横轴的数据必须大于 0。');
      if (meta.yScale === 'log' && point.y !== null && point.y <= 0) fail('对数纵轴的非缺测数据必须大于 0。');
    });
    if (!Array.isArray(input.history) || input.history.length > 20000) fail('变更记录必须是最多 20000 条的数组。');
    const historyIds = new Set();
    const history = input.history.map((entry, index) => {
      object(entry, '变更记录');
      keys(entry, ['id', 'date', 'action', 'pointId', 'actor', 'before', 'after', 'revokedReviews'], '变更记录');
      const id = text(entry.id, '变更标识', 100);
      if (!id.trim() || historyIds.has(id)) fail('变更标识为空或重复。');
      historyIds.add(id);
      if (!['update', 'review', 'meta'].includes(entry.action)) fail('未知变更操作。');
      const pointId = text(entry.pointId, '变更数据点', 100);
      const date = isoDate(entry.date, '变更时间');
      const actor = text(entry.actor, '操作人', 200);
      if (!actor.trim()) fail('变更操作人不能为空。');
      if (entry.action === 'meta') {
        if (pointId !== '') fail('资料说明变更不能指定单个数据点。');
        const before = normalizeMeta(entry.before);
        const after = normalizeMeta(entry.after);
        if (!Array.isArray(entry.revokedReviews) || entry.revokedReviews.length > MAX_POINTS) fail('资料说明变更必须记录撤销的复核。');
        const revokedReviews = entry.revokedReviews.map(revoked => {
          object(revoked, '撤销复核');
          keys(revoked, ['pointId', 'review'], '撤销复核');
          if (!ids.has(revoked.pointId)) fail('撤销复核引用了不存在的数据点。');
          const reference = points.find(point => point.id === revoked.pointId);
          const review = normalizePoint({ ...reference, evidence: reference.evidence || '历史复核出处详见旧记录', review: revoked.review }, index).review;
          if (!review.name) fail('撤销复核记录必须包含原复核人。');
          return { pointId: revoked.pointId, review };
        });
        return { id, date, action: 'meta', pointId, actor, before, after, revokedReviews };
      }
      if (own(entry, 'revokedReviews')) fail('逐点变更不能包含资料说明复核撤销字段。');
      if (!ids.has(pointId)) fail('变更记录引用了不存在的数据点。');
      const before = normalizePoint(entry.before, index);
      const after = normalizePoint(entry.after, index);
      if (before.id !== pointId || after.id !== pointId) fail('变更记录的数据点标识不一致。');
      if (entry.action === 'review') {
        if (after.review.name !== actor || after.review.date !== date) fail('复核签署与变更操作人、时间不一致。');
        const oldData = { ...before, review: emptyReview() };
        const newData = { ...after, review: emptyReview() };
        if (JSON.stringify(oldData) !== JSON.stringify(newData)) fail('复核操作不能同时改动数据。');
      } else if (after.review.name) fail('修改数据后必须撤销旧复核。');
      return { id, date, action: entry.action, pointId, actor, before, after };
    });
    return { version: 1, meta, points, history };
  }

  function createProject(points, meta = {}) {
    if (!Array.isArray(points)) fail('数据点必须是数组。');
    return validateProject({ version: 1, meta: normalizeMeta(meta), points: points.map((point, index) => ({ ...point, id: point.id || `p${index + 1}`, evidence: point.evidence || '', note: point.note || '', review: point.review || emptyReview() })), history: [] });
  }

  function importProject(input) {
    if (typeof input !== 'string' || input.length > 30000000) fail('项目文件必须是大小不超过 30 MB 的 JSON 文本。');
    let parsed;
    try { parsed = JSON.parse(input); } catch (_) { fail('项目文件不是有效 JSON，请重新选择保存的项目文件。'); }
    return validateProject(parsed);
  }

  function csvRows(input) {
    if (typeof input !== 'string' || input.length > 5000000) fail('CSV 必须是大小不超过 5 MB 的文本。');
    input = input.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', quoted = false, closed = false;
    const finish = () => { row.push(field); field = ''; closed = false; };
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') { quoted = false; closed = true; }
        else field += char;
      } else if (char === '"') {
        if (field || closed) fail('CSV 引号位置不正确。');
        quoted = true;
      } else if (char === ',') { finish(); }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && input[i + 1] === '\n') i++;
        finish(); rows.push(row); row = [];
      } else {
        if (closed) fail('CSV 引号关闭后只能出现分隔符或换行。');
        field += char;
      }
    }
    if (quoted) fail('CSV 存在未关闭的引号。');
    if (field || row.length || closed) { finish(); rows.push(row); }
    return rows.filter(values => values.some(value => value.trim()));
  }

  const ALIASES = {
    series: 'series', '系列': 'series', '系列名称': 'series',
    x: 'x', '横轴': 'x', '横轴值': 'x',
    y: 'y', '纵轴': 'y', '纵轴值': 'y',
    kind: 'kind', '类型': 'kind', '数据类型': 'kind',
    evidence: 'evidence', '出处': 'evidence', '证据': 'evidence', '数值出处': 'evidence',
    note: 'note', '备注': 'note',
    review_na
```

### Core Architecture Module: `examples/coi-chase-desk/core.js`
```
(function(root) {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function counts(requests) {
    return {all:requests.length, chase:requests.filter(r=>r.status==='chase').length, waiting:requests.filter(r=>r.status==='waiting').length, received:requests.filter(r=>r.status==='received').length};
  }
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csvReport(requests, labels) {
    const rows = [labels.header];
    for (const r of requests) rows.push([r.sample?labels.sample:labels.local,r.partner,r.email,r.coverage,r.due,labels.status[r.status],r.reference || '',r.events.map(e=>`${e.at} | ${labels.event[e.type]} | ${e.note}`).join('\n')]);
    return '\uFEFF' + rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  function addEvent(request, type, note, at) {
    if (!['followup','received','reopened'].includes(type)) throw new Error('Unsupported event');
    if (!String(note).trim()) throw new Error('A note is required');
    const next = {...request, events:[...request.events,{type,note:String(note).trim(),at}]};
    if (type==='followup' && request.status!=='received') next.status='waiting';
    if (type==='received') {next.status='received';next.reference=String(note).trim();}
    if (type==='reopened') {next.status='chase';next.reference='';}
    return next;
  }
  const api={escapeHtml,counts,csvCell,csvReport,addEvent};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.COICore=api;
})(typeof globalThis!=='undefined'?globalThis:this);

```

### Core Architecture Module: `examples/crm-migration-proof/engine.js`
```
// 所有处理在本地进行；身份、范围与转换授权由使用者明确声明。
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20000;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export function parseCSV(text) {
  if (typeof text !== 'string') throw new Error('CSV 必须是文本。');
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('CSV 超过 5 MB 上限，请拆分导出。');
  text = text.replace(/^\uFEFF/, '');
  if (!text.length) throw new Error('CSV 文件为空。');
  if (text.includes('\0')) throw new Error('CSV 包含无效的空字符，请重新导出为 UTF-8 文本。');
  const records = [];
  let row = [], cell = '', quoted = false, closed = false, atStart = true;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; atStart = true; };
  const finishRow = () => {
    finishCell(); records.push(row); row = [];
    if (records.length > MAX_ROWS + 1) throw new Error('CSV 超过每表 20,000 行上限，请拆分导出。');
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += char;
      continue;
    }
    if (char === '"') {
      if (!atStart || closed) throw new Error(`CSV 第 ${records.length + 1} 行引号格式错误。`);
      quoted = true; atStart = false;
    } else if (char === ',') finishCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else {
      if (closed) throw new Error(`CSV 第 ${records.length + 1} 行关闭引号后含有多余字符。`);
      cell += char; atStart = false;
    }
  }
  if (quoted) throw new Error('CSV 引号未闭合，请检查多行字段。');
  if (row.length || cell.length || closed || !atStart) finishRow();
  if (!records.length) throw new Error('CSV 文件为空。');
  const headers = records.shift();
  if (headers.some(header => !header.trim())) throw new Error('CSV 表头不能为空。');
  if (new Set(headers).size !== headers.length) throw new Error('CSV 包含重复表头，请使用唯一列名。');
  const rows = records.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV 第 ${index + 2} 行有 ${values.length} 列，表头为 ${headers.length} 列。`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
  return { headers, rows };
}

function decimal(value) {
  const text = value.trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) throw new Error('金额不是普通十进制字符串（不接受逗号、指数或货币符号）');
  const negative = text[0] === '-';
  const [whole, fraction = ''] = text.replace(/^[+-]/, '').split('.');
  const integer = whole.replace(/^0+(?=\d)/, '');
  const tail = fraction.replace(/0+$/, '');
  const zero = integer === '0' && !tail;
  return `${negative && !zero ? '-' : ''}${integer}${tail ? '.' + tail : ''}`;
}

function normalized(value, type, precision = 2) {
  const text = value.trim();
  if (!text) return '';
  if (type === 'text') return text;
  if (type === 'email') return text.toLowerCase();
  if (type === 'money') {
    const canonical = decimal(text);
    if ((canonical.split('.')[1] || '').length > precision) throw new Error(`金额超出已声明的 ${precision} 位小数精度，不允许舍入`);
    return canonical;
  }
  if (type === 'date') {
    const match = /^(\d{4})([-/])(\d{2})\2(\d{2})$/.exec(text);
    if (!match) throw new Error('日期须为 YYYY-MM-DD 或 YYYY/MM/DD');
    const year = Number(match[1]), month = Number(match[3]), day = Number(match[4]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error('日期不是有效日历日期');
    return `${match[1]}-${match[3]}-${match[4]}`;
  }
  throw new Error('不支持的字段类型');
}

export function audit(config = {}) {
  if (!config || typeof config !== 'object') config = {};
  const report = {
    version: 1, status: 'unknown', project: typeof config.project === 'string' ? config.project : '未命名项目',
    summary: { sourceRows: 0, targetRows: 0, issues: 0, unknowns: 0 },
    checks: [], issues: [], unknowns: [], scope: config.scope || {}, generatedAt: new Date().toISOString(),
    limitation: '结果仅覆盖所提供的表、明确的字段映射及声明的快照；不是 CRM 全系统或实际授权的独立证明。',
  };
  const unknown = message => { if (!report.unknowns.includes(message)) report.unknowns.push(message); };
  try { report.config = JSON.parse(JSON.stringify(config)); }
  catch { report.config = null; unknown('输入配置不能保存为 JSON，请移除循环引用或非 JSON 值。'); }
  report.scope = report.config?.scope || {};
  const issue = (object, kind, key, field, source, target, message) => {
    report.issues.push({ object, kind, key: String(key ?? ''), field: String(field ?? ''), source: String(source ?? ''), target: String(target ?? ''), message });
  };
  const check = (name, issueStart, unknownStart, detail) => report.checks.push({
    name, status: report.issues.length > issueStart ? 'fail' : report.unknowns.length > unknownStart ? 'unknown' : 'pass', detail,
  });
  const scope = config.scope || {};
  for (const [key, message] of [
    ['complete', '尚未确认源端和目标端导出范围完整一致。'],
    ['identity', '尚未确认稳定身份或经核实的旧 ID 映射，不能猜测记录身份。'],
    ['rules', '尚未确认字段转换与值映射已获授权。'],
    ['snapshot', '尚未确认源端和目标端快照可比。'],
  ]) {
    const valid = scope[key] === true;
    if (!valid) unknown(message);
    report.checks.push({ name: `契约：${{ complete: '导出范围', identity: '稳定身份', rules: '转换授权', snapshot: '可比快照' }[key]}`, status: valid ? 'pass' : 'unknown', detail: valid ? '使用者已明确声明；工具未独立验证该声明。' : message });
  }
  function table(value, label, columns) {
    if (!value || !Array.isArray(value.headers) || !Array.isArray(value.rows)) { unknown(`${label}缺少可读取的数据表。`); return false; }
    if (!value.headers.length || value.headers.some(h => typeof h !== 'string' || !h.trim()) || new Set(value.headers).size !== value.headers.length) { unknown(`${label}表头无效或重复。`); return false; }
    if (value.rows.length > MAX_ROWS) { unknown(`${label}超过每表 20,000 行上限。`); return false; }
    const missing = columns.filter(column => typeof column !== 'string' || !column || !value.headers.includes(column));
    if (missing.length) { unknown(`${label}缺少已指定的列：${missing.map(v => v || '未选择').join('、')}。`); return false; }
    if (value.rows.some(row => !row || typeof row !== 'object' || value.headers.some(header => !own(row, header) || typeof row[header] !== 'string'))) { unknown(`${label}行值须与表头对应，且每格必须是字符串。`); return false; }
    return true;
  }
  const indexes = new Map();
  const objects = Array.isArray(config.objects) ? config.objects : [];
  if (!objects.length) unknown('尚未配置任何待验收对象。');
  const names = new Set();
  for (const object of objects) {
    if (!object || typeof object.name !== 'string' || !object.name.trim()) { unknown('对象名称缺失。'); continue; }
    const name = object.name;
    if (names.has(name)) { unknown(`对象名称重复：${name}。`); indexes.delete(name); continue; }
    names.add(name);
    const issueStart = report.issues.length, unknownStart = report.unknowns.length;
    const sourceOK = table(object.source, `${name}源表`, [object.key?.source]);
    const targetOK = table(object.target, `${name}目标表`, [object.key?.target]);
    if (sourceOK) report.summary.sourceRows += object.source.rows.length;
    if (targetOK) report.summary.targetRows += object.target.rows.length;
    if (!sourceOK || !targetOK || scope.identity !== true) {
      report.checks.push({ name: `${name}：记录身份核验`, status: 'unknown', detail: '缺少稳定身份或必要输入，未以邮件、顺序或数值猜测配对。' });
      continue;
    }
    function index(rows, column, side) {
      const map = new Map();
      for (const [i, row] of rows.entries()) {
        const key = row[column];
        if (!key.trim()) { issue(name, 'empty-key', '', column, side === 'source' ? key : '', side === 'target' ? key : '', `${side === 'source' ? '源端' : '目标端'}第 ${i + 2} 行身份为空。`); continue; }
        if (map.has(key)) { issue(name, 'duplicate-key', key, column, side === 'source' ? key : '', side === 'target' ? key : '', `${side === 'source' ? '源端' : '目标端'}身份重复，不能唯一配对。`); map.set(key, null); }
        else map.set(key, row);
      }
      return map;
    }
    const source = index(object.source.rows, object.key.source, 'source');
    const target = index(object.target.rows, object.key.target, 'target');
    indexes.set(name, { source, target });
    for (const key of source.keys()) if (!target.has(key)) issue(name, 'missing-record', key, '', key, '', '目标端缺少源记录。');
    for (const key of target.keys()) if (!source.has(key)) issue(name, 'extra-record', key, '', '', key, '目标端存在源端没有的记录。');
    const fields = Array.isArray(object.fields) ? object.fields : [];
    if (!fields.length) unknown(`${name}未配置任何待核验字段，仅检查身份不能形成完整字段验收。`);
    const usableFields = fields.filter(field => {
      if (!field || !['text', 'email', 'money', 'date'].includes(field.type)) { unknown(`${name}含未配置或不支持的字段类型。`); return false; }
      if (field.map !== undefined && (!field.map || typeof field.map !== 'object' || Array.isArray(field.map) || Object.values(field.map).some(v => typeof v !== 'string'))) { unknown(`${name}字段 ${field.source} 的值映射必须是字符串到字符串的对象。`); return false; }
      if (field.type === 'money' && field.precision !== undefined && (!Number.isInteger(field.precision) || field.precision < 0 || field.precision > 8)) { unknown(`${name}字段 ${field.source} 的金额精度必须是 0 至 8 的整数。`); return false; }
      return table(object.source, `${name}源表`, [field.source]) && table(object.target, `${name}目标表`, [field.target]);
    });
    if (usableFields.some(field => field.type === 'money') && !object.currency) unknown(`${name}金额字段尚未指定币种列。`);
    const currencyOK = object.currency && table(object.source, `${name}源表`, [object.currency.source]) && table(object.target, `${name}目标表`, [object.currency.target]);
    if (scope.rules === true) {
      for (const [key, sourceRow] of source) {
        const targetRow = target.get(key);
        if (!sourceRow || !targetRow) continue;
        for (const field of usableFields) {
          const left = sourceRow[field.source], right = targetRow[field.target];
          let mappe
```

### Core Architecture Module: `examples/crossed-island-experiment/engine.js`
```
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IslandEngine = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STAGES = ['intro', 'createA', 'handoffB', 'createB', 'handoffA', 'actionA',
    'handoffActionB', 'actionB', 'reveal', 'decision', 'finished'];
  const AUTHOR_FIELDS = ['name', 'landmark', 'detail', 'reason', 'prediction', 'rule'];
  const LIMITS = Object.freeze({ name: 30, landmark: 60, detail: 600, reason: 600,
    prediction: 600, action: 600, reflection: 600, joint: 1000, backup: 65536 });
  const TOP_KEYS = ['version', 'stage', 'authors', 'actions', 'votes', 'joint',
    'reflections', 'paused', 'outcome', 'stoppedAt'];
  const RULES = { A: ['moon', 'sun'], B: ['low', 'high'] };
  const FIELD_LABELS = { name: '旅人名字', landmark: '地标名字', detail: '地标细节',
    reason: '虚构缘由', prediction: '行动预测', rule: '环境规则' };
  const RULE_LABELS = { moon: '月光照路', sun: '日光照路', low: '退潮开放', high: '涨潮开放' };
  const STAGE_LABELS = { intro: '开场', createA: '阿岚创作', handoffB: '交给雨生',
    createB: '雨生创作', handoffA: '交给阿岚', actionA: '阿岚进入对方世界',
    handoffActionB: '交给雨生回应', actionB: '雨生进入对方世界', reveal: '共同揭晓',
    decision: '共同取舍', finished: '完成' };

  function fail(message) { throw new Error(message); }
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
      fail(label + '必须是普通对象。');
    }
  }
  function keys(value, allowed, label, partial) {
    object(value, label);
    if (Object.keys(value).some(key => !allowed.includes(key)) ||
        (!partial && allowed.some(key => !Object.prototype.hasOwnProperty.call(value, key)))) {
      fail(label + '字段不完整或包含未知字段。');
    }
  }
  function string(value, max, label, required) {
    if (typeof value !== 'string') fail(label + '必须是文字。');
    if (value.length > max) fail(label + '最多 ' + max + ' 字。');
    if (required && !value.trim()) fail('请填写' + label + '。');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(label + '包含无效控制字符。');
    return value;
  }
  function roleCheck(role) { if (role !== 'A' && role !== 'B') fail('请选择有效角色。'); }
  function vote(value) {
    if (!['', 'road', 'objects'].includes(value)) fail('取舍只能是留路或留物。');
    return value;
  }
  function author(value, role, complete) {
    keys(value, AUTHOR_FIELDS, '角色创作');
    const result = {};
    AUTHOR_FIELDS.forEach(field => {
      result[field] = string(value[field], field === 'rule' ? 4 : LIMITS[field], FIELD_LABELS[field], complete);
    });
    if (result.rule && !RULES[role].includes(result.rule)) fail('环境规则与角色不符。');
    return result;
  }
  function emptyAuthor() {
    return { name: '', landmark: '', detail: '', reason: '', prediction: '', rule: '' };
  }
  function create() {
    return { version: 1, stage: 'intro', authors: { A: emptyAuthor(), B: emptyAuthor() },
      actions: { A: '', B: '' }, votes: { A: '', B: '' }, joint: '',
      reflections: { A: '', B: '' }, paused: false, outcome: null, stoppedAt: null };
  }
  function isEmptyAuthor(value) { return AUTHOR_FIELDS.every(field => value[field] === ''); }

  // Stage checks also apply to stopped sessions, using their last active stage.
  function progressCheck(state, stage) {
    const index = STAGES.indexOf(stage);
    if (index < 0 || stage === 'finished') fail('备份的原阶段无效。');
    if (index >= 2) author(state.authors.A, 'A', true);
    if (index < 1 && !isEmptyAuthor(state.authors.A)) fail('开场不能包含已创作内容。');
    if (index >= 4) author(state.authors.B, 'B', true);
    if (index < 3 && !isEmptyAuthor(state.authors.B)) fail('雨生创作早于交接。');
    if (index >= 6) string(state.actions.A, LIMITS.action, '阿岚的行动', true);
    if (index < 5 && state.actions.A !== '') fail('阿岚行动早于创作完成。');
    if (index >= 8) string(state.actions.B, LIMITS.action, '雨生的行动', true);
    if (index < 7 && state.actions.B !== '') fail('雨生行动早于交接。');
    if (index < 9 && (state.votes.A !== '' || state.votes.B !== '' || state.joint !== '' ||
        state.reflections.A !== '' || state.reflections.B !== '')) fail('共同取舍早于揭晓。');
  }
  function validate(input) {
    keys(input, TOP_KEYS, '备份');
    if (input.version !== 1) fail('不支持这个备份版本。');
    if (!STAGES.includes(input.stage)) fail('备份阶段无效。');
    if (typeof input.paused !== 'boolean') fail('暂停标记无效。');
    keys(input.authors, ['A', 'B'], '双方创作');
    keys(input.actions, ['A', 'B'], '双方行动');
    keys(input.votes, ['A', 'B'], '双方取舍');
    keys(input.reflections, ['A', 'B'], '双方反思');
    const state = { version: 1, stage: input.stage,
      authors: { A: author(input.authors.A, 'A', false), B: author(input.authors.B, 'B', false) },
      actions: { A: string(input.actions.A, LIMITS.action, '阿岚的行动'),
        B: string(input.actions.B, LIMITS.action, '雨生的行动') },
      votes: { A: vote(input.votes.A), B: vote(input.votes.B) },
      joint: string(input.joint, LIMITS.joint, '共同取舍句'),
      reflections: { A: string(input.reflections.A, LIMITS.reflection, '阿岚的反思'),
        B: string(input.reflections.B, LIMITS.reflection, '雨生的反思') },
      paused: input.paused, outcome: input.outcome, stoppedAt: input.stoppedAt };
    if (state.stage === 'finished') {
      if (state.paused) fail('已结束的体验不能处于暂停状态。');
      if (state.outcome === 'stop') {
        progressCheck(state, state.stoppedAt);
      } else if (state.outcome === 'road' || state.outcome === 'objects') {
        if (state.stoppedAt !== null) fail('共同结局不能带有停下阶段。');
        progressCheck(state, 'decision');
        if (state.votes.A !== state.outcome || state.votes.B !== state.outcome) fail('共同结局缺少双方同意。');
        string(state.joint, LIMITS.joint, '共同取舍句', true);
      } else fail('结束记录缺少有效结局。');
    } else {
      if (state.outcome !== null || state.stoppedAt !== null) fail('进行中的体验不能有结局。');
      progressCheck(state, state.stage);
    }
    return state;
  }
  function active(input, expected) {
    const state = validate(input);
    if (state.stage === 'finished') fail('这次体验已经结束。');
    if (state.paused) fail('请先继续体验。');
    if (expected && state.stage !== expected) fail('请按交接顺序完成当前步骤。');
    return state;
  }
  function advance(input) {
    const state = active(input);
    const next = { intro: 'createA', handoffB: 'createB', handoffA: 'actionA',
      handoffActionB: 'actionB', reveal: 'decision' }[state.stage];
    if (!next) fail('当前步骤需要填写并保存，不能跳过。');
    state.stage = next;
    return validate(state);
  }
  function saveAuthor(input, role, data) {
    roleCheck(role);
    const state = active(input, 'create' + role);
    state.authors[role] = author(data, role, true);
    state.stage = role === 'A' ? 'handoffB' : 'handoffA';
    return validate(state);
  }
  function saveAction(input, role, text) {
    roleCheck(role);
    const state = active(input, 'action' + role);
    state.actions[role] = string(text, LIMITS.action, '在对方世界里的打算', true);
    state.stage = role === 'A' ? 'handoffActionB' : 'reveal';
    return validate(state);
  }
  function saveDraft(input, patch) {
    const state = active(input);
    if (state.stage === 'createA' || state.stage === 'createB') {
      keys(patch, ['author'], '草稿');
      keys(patch.author, AUTHOR_FIELDS, '创作草稿', true);
      const role = state.stage.slice(-1);
      state.authors[role] = author(Object.assign({}, state.authors[role], patch.author), role, false);
    } else if (state.stage === 'actionA' || state.stage === 'actionB') {
      keys(patch, ['action'], '行动草稿');
      state.actions[state.stage.slice(-1)] = string(patch.action, LIMITS.action, '行动草稿');
    } else if (state.stage === 'decision') {
      keys(patch, ['votes', 'joint', 'reflections'], '取舍草稿', true);
      if (Object.prototype.hasOwnProperty.call(patch, 'votes')) {
        keys(patch.votes, ['A', 'B'], '取舍草稿', true);
        Object.keys(patch.votes).forEach(role => { state.votes[role] = vote(patch.votes[role]); });
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'joint')) state.joint = string(patch.joint, LIMITS.joint, '共同取舍句');
      if (Object.prototype.hasOwnProperty.call(patch, 'reflections')) {
        keys(patch.reflections, ['A', 'B'], '反思草稿', true);
        Object.keys(patch.reflections).forEach(role => {
          state.reflections[role] = string(patch.reflections[role], LIMITS.reflection, '反思');
        });
      }
    } else fail('当前步骤没有可编辑草稿。');
    return validate(state);
  }
  function resolve(input, voteA, voteB, joint, reflections) {
    const state = active(input, 'decision');
    state.votes = { A: vote(voteA), B: vote(voteB) };
    if (!voteA || !voteB) fail('请让双方各自选择留路或留物。');
    state.joint = string(joint === undefined ? '' : joint, LIMITS.joint, '共同取舍句');
    if (reflections !== undefined) {
      keys(reflections, ['A', 'B'], '反思');
      state.reflections = { A: string(reflections.A, LIMITS.reflection, '阿岚的反思'),
        B: string(reflections.B, LIMITS.reflection, '雨生的反思') };
    }
    if (voteA === voteB) {
      string(state.joint, LIMITS.joint, '共同取舍句', true);
      state.stage = 'finished';
      state.outcome = voteA;
    }
    return validate(state);
  }
  function stop(input) {
    const state = validate(input);
    if (state.stage === 'finished') fail('这次体验已经结束。');
    state.stoppedAt = state.stage;
    state.stage = 'finished';
    state.outcome = 'stop';
    state.paused = false;
    return validate(state);
  }
  function pause(input) {
    const state = active(input);
    state.paused = true;
    return state;
  }
  function resume(input) {
    const state = validate(input);
    if (state.stage === 'finished') fail('这次体验已经结束。');
    state.paused = false;
    return state;
  }
  function route(input) {
    const state = validate(input);
    const light = state.authors.A.rule;
    const tide = state.authors.B.rule;
    if (!light || !tide) return null;
    const a = tide === 'low' ? { action: '踏浅滩送灯塔', forbidden: '使用浮台' } :

```

### Core Architecture Module: `examples/cuecheck/core.js`
```
export const LIMITS = Object.freeze({ maxBytes: 2097152, maxCues: 5000 });
export const DEFAULT_RULES = Object.freeze({ minDuration: 0.8, maxDuration: 7, maxCps: 12, maxLines: 2 });

const MAX_TIME = 359999999;
const TIME = /^(\d{2}):([0-5]\d):([0-5]\d),(\d{3})$/;
const TIMING_LINE = /^(\d{2}:[0-5]\d:[0-5]\d,\d{3})[ \t]+-->[ \t]+(\d{2}:[0-5]\d:[0-5]\d,\d{3})$/;
const byteLength = (value) => new TextEncoder().encode(value).length;
const validTime = (value) => Number.isInteger(value) && value >= 0 && value <= MAX_TIME;
const invalidUnicode = (value) => /[\uD800-\uDFFF]/u.test(value);

export function parseTime(value) {
  const match = typeof value === 'string' && TIME.exec(value);
  if (!match) throw new Error('时码须为 HH:MM:SS,mmm，小时 00–99，分秒 00–59。');
  return Number(match[1]) * 3600000 + Number(match[2]) * 60000 + Number(match[3]) * 1000 + Number(match[4]);
}

export function formatTime(ms) {
  if (!validTime(ms)) throw new Error('时码必须是 0 至 99:59:59,999 范围内的整数毫秒。');
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export function parseSrt(text) {
  const fail = (line, code, message) => ({ cues: [], errors: [{ line, code, message }] });
  if (typeof text !== 'string') return fail(1, 'invalid_input', '请输入 UTF-8 SRT 文本。');
  if (byteLength(text) > LIMITS.maxBytes) return fail(1, 'size_limit', '文件超过 2 MiB 上限。');
  const illegal = /\r(?!\n)|\0|[\uD800-\uDFFF]/u.exec(text);
  if (illegal) return fail(text.slice(0, illegal.index).split('\n').length, 'invalid_character', '文本含孤立 CR、NUL 或无效 Unicode 字符。');
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  const cues = [];
  const errors = [];
  let cursor = 0;
  while (cursor < lines.length) {
    if (lines[cursor] === '') { cursor++; continue; }
    const begin = cursor;
    while (cursor < lines.length && lines[cursor] !== '') cursor++;
    const block = lines.slice(begin, cursor);
    if (!/^\d+$/.test(block[0])) {
      errors.push({ line: begin + 1, code: 'invalid_number', message: '字幕块须以独立数字序号开头；请检查空行分隔。' });
      continue;
    }
    const timing = TIMING_LINE.exec(block[1] ?? '');
    if (!timing) {
      errors.push({ line: begin + 2, code: 'invalid_timing', message: '时间行须为 HH:MM:SS,mmm --> HH:MM:SS,mmm。' });
      continue;
    }
    for (let index = 2; index < block.length - 1; index++) {
      if (/^\d+$/.test(block[index]) && block[index + 1].includes('-->')) {
        errors.push({ line: begin + index + 1, code: 'missing_separator', message: '相邻字幕之间缺少空行，无法安全区分正文。' });
      }
    }
    cues.push({ id: cues.length + 1, sourceNumber: block[0], line: begin + 1, startMs: parseTime(timing[1]), endMs: parseTime(timing[2]), text: block.slice(2).join('\n') });
    if (cues.length > LIMITS.maxCues) return fail(begin + 1, 'cue_limit', '字幕超过 5,000 条上限。');
  }
  if (!cues.length && !errors.length) return fail(1, 'empty_file', '文件中没有字幕。');
  return { cues: errors.length ? [] : cues, errors };
}

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object') throw new Error('请填写完整的检查阈值。');
  const { minDuration, maxDuration, maxCps, maxLines } = rules;
  if (![minDuration, maxDuration].every((value) => Number.isFinite(value) && value >= 0.1 && value <= 60)) throw new Error('最短和最长时长须在 0.1–60 秒之间。');
  if (minDuration > maxDuration) throw new Error('最短时长不能大于最长时长。');
  if (!Number.isFinite(maxCps) || maxCps < 1 || maxCps > 100) throw new Error('每秒字符上限须在 1–100 之间。');
  if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 10) throw new Error('行数上限须为 1–10 之间的整数。');
  return { minDuration, maxDuration, maxCps, maxLines };
}

export function analyze(cues, rules = DEFAULT_RULES) {
  const normalized = validateRules(rules);
  const issues = [];
  const add = (cue, code, severity, message) => issues.push({ cueId: cue.id, code, severity, message });
  let latestStart = -1;
  for (const cue of cues) {
    const timingValid = validTime(cue.startMs) && validTime(cue.endMs);
    if (!timingValid) add(cue, 'invalid_time', 'error', '时码超出有效范围或不是整数毫秒。');
    const duration = (cue.endMs - cue.startMs) / 1000;
    if (timingValid && duration <= 0) add(cue, 'nonpositive_duration', 'error', '结束时间必须晚于开始时间。');
    const textValid = typeof cue.text === 'string';
    if (!textValid || !cue.text.trim()) add(cue, 'empty_text', 'error', '字幕正文不能为空。');
    if (textValid && (cue.text.includes('\r') || cue.text.includes('\0') || invalidUnicode(cue.text))) add(cue, 'invalid_text', 'error', '正文含不支持的控制字符或无效 Unicode。');
    if (textValid && cue.text !== '' && cue.text.split('\n').includes('')) add(cue, 'blank_text_line', 'error', '正文不能含空行；空行是 SRT 字幕块的分隔符。');
    if (textValid && cue.text.split('\n').some((line, index, lines) => /^\d+$/.test(line) && (lines[index + 1] ?? '').includes('-->'))) add(cue, 'ambiguous_text', 'error', '正文含数字序号与时间箭头组合，重新导入时无法安全区分字幕块。');
    if (timingValid) {
      if (cue.startMs < latestStart) add(cue, 'out_of_order', 'warning', '开始时间早于前序字幕，请复核顺序。');
      latestStart = Math.max(latestStart, cue.startMs);
      if (duration > 0 && duration < normalized.minDuration) add(cue, 'too_short', 'warning', `显示时长 ${duration.toFixed(3)} 秒，低于 ${normalized.minDuration} 秒。`);
      if (duration > normalized.maxDuration) add(cue, 'too_long', 'warning', `显示时长 ${duration.toFixed(3)} 秒，超过 ${normalized.maxDuration} 秒。`);
    }
    if (textValid) {
      const lineCount = cue.text.split('\n').length;
      if (lineCount > normalized.maxLines) add(cue, 'too_many_lines', 'warning', `正文 ${lineCount} 行，超过 ${normalized.maxLines} 行。`);
      const characters = [...cue.text].filter((character) => !/\s/u.test(character)).length;
      if (timingValid && duration > 0 && characters / duration > normalized.maxCps) add(cue, 'high_cps', 'warning', `每秒 ${Number((characters / duration).toFixed(1))} 个字符，超过 ${normalized.maxCps}。`);
    }
  }
  // 按时间扫描最大结束点，覆盖嵌套区间，同时保持输出字幕顺序。
  const chronological = cues.filter((cue) => validTime(cue.startMs) && validTime(cue.endMs) && cue.endMs > cue.startMs).slice().sort((a, b) => a.startMs - b.startMs);
  const overlapping = new Set();
  let furthest = null;
  for (const cue of chronological) {
    if (furthest && cue.startMs < furthest.endMs) { overlapping.add(furthest.id); overlapping.add(cue.id); }
    if (!furthest || cue.endMs > furthest.endMs) furthest = cue;
  }
  for (const cue of cues) if (overlapping.has(cue.id)) add(cue, 'overlap', 'warning', '与其他字幕的显示时间重叠，请复核。');
  const order = new Map(cues.map((cue, index) => [cue.id, index]));
  issues.sort((a, b) => order.get(a.cueId) - order.get(b.cueId));
  return {
    issues,
    stats: { cues: cues.length, durationMs: cues.reduce((max, cue) => validTime(cue.endMs) ? Math.max(max, cue.endMs) : max, 0), errors: issues.filter((issue) => issue.severity === 'error').length, warnings: issues.filter((issue) => issue.severity === 'warning').length, affected: new Set(issues.map((issue) => issue.cueId)).size },
    rules: normalized,
  };
}

export function serializeSrt(cues) {
  if (!Array.isArray(cues) || !cues.length) throw new Error('没有可导出的字幕。');
  if (cues.length > LIMITS.maxCues) throw new Error('字幕超过 5,000 条上限。');
  if (analyze(cues).stats.errors) throw new Error('请先修复全部错误，再导出 SRT。');
  const result = cues.map((cue, index) => `${index + 1}\n${formatTime(cue.startMs)} --> ${formatTime(cue.endMs)}\n${cue.text}`).join('\n\n') + '\n';
  if (byteLength(result) > LIMITS.maxBytes) throw new Error('导出内容超过 2 MiB 上限，请缩减正文。');
  return result;
}

export function createReport(cues, rules = DEFAULT_RULES, fileName = '') {
  const result = analyze(cues, rules);
  const byId = new Map(cues.map((cue) => [cue.id, cue]));
  return {
    version: '1.0',
    tool: 'CueCheck',
    fileName,
    rules: result.rules,
    counting: { characters: 'Unicode 码点数，排除空白，标签按原文计数；并非精准阅读难度。', errorsAndWarnings: '按问题项计数，同一字幕可有多个问题。', duration: '最大结束时码；不是显示时长之和。', overlap: '每条参与重叠的字幕记一个提示，相接边界不算重叠。' },
    scope: '仅检查本工具覆盖的问题，不检查翻译和音视频同步，不代表平台合规认证。',
    stats: result.stats,
    issues: result.issues.map((issue) => {
      const cue = byId.get(issue.cueId);
      return { ...issue, sourceNumber: cue.sourceNumber, sourceLine: cue.line, startMs: cue.startMs, endMs: cue.endMs, startTime: validTime(cue.startMs) ? formatTime(cue.startMs) : null, endTime: validTime(cue.endMs) ? formatTime(cue.endMs) : null };
    }),
  };
}

```

### Core Architecture Module: `examples/disclosure-qa-spike/engine.py`
```
"""本地披露文件双向检查；结果是复核依据，不是安全认证。"""
import base64
import binascii
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import pymupdf as fitz

MAX_FILES = 20
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_BATCH_BYTES = 25 * 1024 * 1024
MAX_FILE_PAGES = 200
MAX_BATCH_PAGES = 500
MAX_OBJECT_BYTES = 32 * 1024 * 1024
MAX_FINDINGS = 400


class ValidationError(ValueError):
    """用户可以修复的批次输入错误。"""


class FileInputError(ValueError):
    """可公开给用户的稳定文件输入提示。"""


def normalize(text):
    """统一全半角、大小写和 PDF 抽取产生的字间空白。"""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text)).casefold()


def _label(value, name, limit=180):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValidationError(f"{name}必须是非空文本，且不超过 {limit} 个字符。")
    if any(ord(character) < 32 for character in value):
        raise ValidationError(f"{name}不能包含控制字符。")
    return value.strip()


def validate_payload(payload):
    if not isinstance(payload, dict):
        raise ValidationError("请求必须是 JSON 对象。")
    batch_name = _label(payload.get("batch_name"), "批次名称")
    raw_rules = payload.get("rules")
    if not isinstance(raw_rules, dict):
        raise ValidationError("请提供规则对象。")
    rules = {key: _label(raw_rules.get(key), label) for key, label in
             [("version", "规则版本"), ("approved_by", "规则批准人")]}
    for kind, label in [("remove", "应删除规则"), ("retain", "应保留规则")]:
        values = raw_rules.get(kind)
        if not isinstance(values, list) or not 1 <= len(values) <= 100:
            raise ValidationError(f"{label}必须包含 1 至 100 条文本。")
        rules[kind] = [_label(value, label, 300) for value in values]
        normalized = [normalize(value) for value in rules[kind]]
        if len(set(normalized)) != len(normalized):
            raise ValidationError(f"{label}存在规范化后重复的规则。")
    remove = [normalize(value) for value in rules["remove"]]
    retain = [normalize(value) for value in rules["retain"]]
    if any(left in right or right in left for left in remove for right in retain):
        raise ValidationError("删除与保留规则存在相同或相互包含的冲突，请先修订规则。")
    files = payload.get("files")
    if not isinstance(files, list) or not 1 <= len(files) <= MAX_FILES:
        raise ValidationError(f"每批必须包含 1 至 {MAX_FILES} 个 PDF。")
    names = []
    estimated_bytes = 0
    for file in files:
        if not isinstance(file, dict):
            raise ValidationError("文件条目必须是对象。")
        name = _label(file.get("name"), "文件名")
        if "/" in name or "\\" in name or name in (".", ".."):
            raise ValidationError("文件名不能包含路径。")
        if name.casefold() in names:
            raise ValidationError("同一批次的文件名不能重复。")
        names.append(name.casefold())
        data = file.get("data")
        if isinstance(data, str):
            estimated_bytes += len(data) * 3 // 4
    # base64 末尾填充最多造成每份 2 字节的估算差异。
    if estimated_bytes > MAX_BATCH_BYTES + 2 * MAX_FILES:
        raise ValidationError("本批文件总大小超过 25 MB，请拆分批次。")
    return batch_name, rules, files


def _pdf_strings(data):
    """补充可读原对象字符串；复杂编码和历史修订仍须独立人工检查。"""
    texts = []
    for token in re.findall(rb"\((?:\\.|[^\\)]){1,8192}\)|<([0-9A-Fa-f\s]{2,16384})>", data):
        # findall 的捕获组仅返回 hex；literal 由下方独立扫描。
        if token:
            try:
                raw = bytes.fromhex(token.decode("ascii"))
                texts.extend(_decode_text(raw))
            except (ValueError, UnicodeError):
                pass
    for token in re.finditer(rb"\((?:\\.|[^\\)]){1,8192}\)", data):
        raw = token.group()[1:-1]
        raw = re.sub(rb"\\([0-7]{1,3})", lambda match: bytes([int(match[1], 8) % 256]), raw)
        raw = re.sub(rb"\\([()\\])", rb"\1", raw)
        texts.extend(_decode_text(raw))
    texts.extend(_decode_text(data))
    return "\n".join(texts)


def _decode_text(data):
    results = []
    for encoding in ("utf-8", "utf-16-be", "utf-16-le", "latin-1"):
        try:
            results.append(data.decode(encoding))
        except UnicodeError:
            pass
    return results


def check_file(name, data, rules, remaining_pages=MAX_BATCH_PAGES):
    result = {"name": name.strip(), "sha256": None, "pages": 0, "status": "error",
              "findings": [], "coverage": [], "error": None}
    try:
        if not isinstance(data, str):
            raise FileInputError("文件内容必须是 base64 文本。")
        if len(data) > ((MAX_FILE_BYTES + 2) // 3) * 4:
            raise FileInputError("单文件超过 10 MB，请拆分文件。")
        try:
            raw = base64.b64decode(data, validate=True)
        except (binascii.Error, ValueError):
            raise FileInputError("文件 base64 编码无效，请重新选择 PDF。") from None
        if not raw or len(raw) > MAX_FILE_BYTES:
            raise FileInputError("文件为空或超过 10 MB。")
        result["sha256"] = hashlib.sha256(raw).hexdigest()
        if not raw[:1024].lstrip().startswith(b"%PDF-"):
            raise FileInputError("文件内容不是 PDF。")
        with fitz.open(stream=raw, filetype="pdf") as document:
            if document.needs_pass:
                raise FileInputError("PDF 已加密，请在本地解密后重新检查。")
            count = document.page_count
            if not 1 <= count <= MAX_FILE_PAGES:
                raise FileInputError("PDF 页数必须为 1 至 200 页。")
            if count > remaining_pages:
                raise FileInputError("本批总页数超过 500 页，请另建批次。")
            result["pages"] = count
            _inspect(document, raw, rules, result)
        result["status"] = "issues" if any(f["severity"] == "error" for f in result["findings"]) else "review"
    except Exception as error:
        # 解析器细节可能包含文件中的敏感文字，只公开稳定的用户提示。
        result["error"] = str(error) if isinstance(error, FileInputError) else "PDF 无法完整解析，请修复或替换该文件后重试。"
        result["findings"] = []
        result["coverage"] = []
    return result


def _inspect(document, raw, rules, result):
    normalized_remove = [normalize(value) for value in rules["remove"]]
    normalized_retain = [normalize(value) for value in rules["retain"]]
    seen = set()
    found_retain = set()
    has_text = False
    image_pages = []
    object_complete = True
    budget = MAX_OBJECT_BYTES
    truncated = False

    def finding(kind, severity, rule_index, page, location, message):
        nonlocal truncated
        key = (kind, rule_index, page, location)
        if key in seen:
            return
        if len(result["findings"]) >= MAX_FINDINGS:
            truncated = True
            return
        seen.add(key)
        result["findings"].append({"id": f"f{len(result['findings']) + 1}", "kind": kind,
            "severity": severity, "rule_index": rule_index, "page": page,
            "location": location, "message": message})

    def scan(text, location, page=None):
        normalized = normalize(text)
        for index, rule in enumerate(normalized_remove):
            if rule in normalized:
                finding("remove", "error", index, page, location,
                        f"发现应删除规则 {index + 1} 的匹配内容。")

    for index, page in enumerate(document):
        text = page.get_text("text", sort=True)
        normalized = normalize(text)
        has_text = has_text or bool(normalized)
        scan(text, "页面文本", index + 1)
        for rule_index, rule in enumerate(normalized_retain):
            if rule in normalized:
                found_retain.add(rule_index)
        if page.get_images(full=True):
            image_pages.append(index + 1)
        annotations = page.annots()
        if annotations:
            for annotation in annotations:
                scan(json.dumps(annotation.info, ensure_ascii=False), "批注", index + 1)
                if annotation.type[0] == fitz.PDF_ANNOT_REDACT:
                    finding("coverage", "error", None, index + 1, "未应用的脱敏批注",
                            "存在尚未应用的脱敏批注；请在本地实际应用脱敏并另存最终文件后重查。")
    scan(json.dumps(document.metadata or {}, ensure_ascii=False), "元数据")
    for attachment in document.embfile_names():
        scan(attachment, "附件名称")
        info = document.embfile_info(attachment)
        scan(json.dumps(info, ensure_ascii=False), "附件信息")
        if info.get("size", 0) > 4 * 1024 * 1024:
            object_complete = False
            continue
        content = document.embfile_get(attachment)
        if len(content) > budget:
            object_complete = False
            continue
        budget -= len(content)
        scan("\n".join(_decode_text(content)), "附件可读文本")
    if document.xref_length() > 20000:
        object_complete = False
    for xref in range(1, min(document.xref_length(), 20000)):
        object_text = document.xref_object(xref, compressed=False)
        scan(object_text, "原对象")
        scan(_pdf_strings(object_text.encode("utf-8")), "原对象")
        if document.xref_is_stream(xref):
            # 图像 / 字体不解压，避免把压缩炸弹作为文本加载。
            if "/Subtype /Image" in object_text or "/Length1" in object_text:
                continue
            compressed = document.xref_stream_raw(xref)
            if len(compressed) > 4 * 1024 * 1024 or budget <= 0:
                object_complete = False
                continue
            # 所有解压都在隔离子进程中受内存和时限约束（HTTP 入口）。
            stream = document.xref_stream(xref)
            if len(stream) > min(4 * 1024 * 1024, budget):
                object_complete = False
                continue
            budget -= len(stream)
            scan(_pdf_strings(stream), "对象流可读文本")
    # 直接搜索现存文件字节补充未压缩历史内容，不能穷尽旧修订。
    scan("\n".join(_decode_text(raw)), "原文件可读字节")
    for index in range(len(normalized_retain)):
        if index not in found_retain:
            uncertain = not has_text or bool(image_pages)
            finding("retain", "warning" if uncertain else "error", index, None, "页面文本",
                    f"未在页面可检文本中找到保留规则 {index + 1}；" +
                    ("图像或扫描内容须人工核对，不能据此确定已过删。" if uncertain else "请核对是否过度删除或文字抽取异常。"))
    result["coverage"] = [
        {"id": "page-text", "status": "checked", "message": "已检查逐页可抽取文本（含可抽取隐藏文字）；保留规则仅在页面检索。"},
        {
```

### Core Architecture Module: `examples/dual-flavor-table/engine.js`
```
import { menus, flavors, exclusions as exclusionOptions } from './catalog.js';

const allowedFields = ['menuId', 'servingsA', 'servingsB', 'flavorA', 'flavorB', 'vegetarian', 'exclusions', 'maxMinutes'];
const round = (number) => Math.round(number * 100) / 100;
const cleanName = (name) => name.replace(/^原味|^去骨|^鲜|^熟/, '');

function validateOptions(options, forPlan) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('请提供有效的方案设置。');
  for (const key of Object.keys(options)) if (!allowedFields.includes(key)) throw new Error(`未知设置：${key}。`);
  const config = { vegetarian: false, exclusions: [], maxMinutes: 60, ...(forPlan ? {} : { servingsA: 1, servingsB: 1 }), ...options };
  for (const key of ['servingsA', 'servingsB']) {
    if (!Number.isInteger(config[key]) || config[key] < 1 || config[key] > 4) throw new Error(`${key === 'servingsA' ? 'A' : 'B'}组份数必须为1至4的整数。`);
  }
  if (config.servingsA + config.servingsB > 6) throw new Error('两组总份数不能超过6份，请减少份数。');
  if (!Number.isInteger(config.maxMinutes) || config.maxMinutes < 20 || config.maxMinutes > 90) throw new Error('时间上限必须为20至90分钟的整数。');
  if (typeof config.vegetarian !== 'boolean') throw new Error('素食设置必须为 true 或 false。');
  if (!Array.isArray(config.exclusions)) throw new Error('排除食材必须使用数组。');
  for (const id of config.exclusions) {
    if (typeof id !== 'string' || !exclusionOptions.some((item) => item.id === id)) throw new Error(`未知排除食材：${String(id)}。`);
  }
  if (new Set(config.exclusions).size !== config.exclusions.length) throw new Error('排除食材不能重复选择。');
  config.exclusions = [...config.exclusions];
  if (forPlan || config.menuId !== undefined) {
    if (typeof config.menuId !== 'string' || !menus.some((menu) => menu.id === config.menuId)) throw new Error('整餐菜单不存在，请重新选择。');
  }
  for (const key of ['flavorA', 'flavorB']) {
    if (forPlan || config[key] !== undefined) {
      const flavor = flavors.find((item) => item.id === config[key]);
      if (!flavor) throw new Error(`${key === 'flavorA' ? 'A' : 'B'}组口味无效，请选择清淡、香辣或蒜香。`);
      const forbidden = excludedIds(config.exclusions);
      if (flavor.ingredients.some((ingredient) => forbidden.has(ingredient.id))) throw new Error(`${key === 'flavorA' ? 'A' : 'B'}组的${flavor.label}口味含有已排除食材，请更换口味。`);
    }
  }
  return config;
}

function excludedIds(selected) {
  return new Set(selected.flatMap((id) => exclusionOptions.find((option) => option.id === id).ingredientIds));
}

const chickpea = { id: 'chickpea', name: '熟鹰嘴豆', quantity: 130, unit: '克', note: '原味罐装或预煮熟豆，冲洗沥干；不可用干豆直接替代。' };
const tofu = { id: 'tofu', name: '原味硬豆腐', quantity: 150, unit: '克', note: '选无额外调味的硬豆腐；按包装要求冷藏。' };

function resolveMenu(menu, config) {
  const blocked = excludedIds(config.exclusions);
  const resolved = { ...menu, protein: { ...menu.protein }, accent: { ...menu.accent }, side: { ...menu.side }, substitutions: [] };
  if (resolved.protein.id === 'chicken' && (config.vegetarian || blocked.has('chicken'))) {
    resolved.protein = { ...tofu };
    resolved.substitutions.push('鸡肉替换为原味硬豆腐；烹饪步骤已改为豆腐做法。');
  }
  if (blocked.has(resolved.protein.id) && ['tofu', 'egg'].includes(resolved.protein.id)) {
    const original = resolved.protein.name;
    resolved.protein = { ...chickpea };
    resolved.substitutions.push(`${original}替换为熟鹰嘴豆；使用熟豆，不使用干豆。`);
  }
  if (blocked.has(resolved.accent.id) && resolved.accent.id === 'tomato') {
    resolved.accent = { id: 'pumpkin', name: '南瓜', quantity: 120, unit: '克', prep: '去皮去籽，切成1厘米小块。', usesMainWater: true, cook: '加入南瓜和分配给本批的主菜用水，中小火盖锅焖8分钟，中途翻动，筷子能穿透后开盖。' };
    resolved.substitutions.push('番茄替换为南瓜；切小块焖至无硬芯，时间估算增加5分钟。');
    resolved.mainMinutes += 5;
    resolved.minutes += 5;
  }
  if (blocked.has(resolved.accent.id) && resolved.accent.id === 'mushroom') {
    resolved.accent = { id: 'zucchini', name: '西葫芦', quantity: 120, unit: '克', prep: '洗净去两端，切成5毫米半圆片。', usesMainWater: false, cook: '中火翻炒西葫芦4分钟，直到中心变软但仍成片。' };
    resolved.substitutions.push('蘑菇替换为西葫芦；采购清单和步骤均已更新。');
  }
  const rejected = [resolved.protein, resolved.accent, resolved.side].filter((item) => blocked.has(item.id));
  if (rejected.length) throw new Error(`这套菜单无法避开${rejected.map((item) => item.name).join('、')}，请改选整餐或调整排除项。`);
  resolved.vegetarian = resolved.protein.id !== 'chicken';
  resolved.dishes = [`${cleanName(resolved.accent.name)}${cleanName(resolved.protein.name)}`, `清炒${cleanName(resolved.side.name)}`, '白米饭'];
  resolved.title = resolved.dishes.join(' · ');
  const total = config.servingsA + config.servingsB;
  const batches = Math.ceil(total / 2);
  // 一名操作者顺序使用炒锅；每增加一批主菜和蔬菜，增加相应炒制时间和分装时间。
  resolved.minutes += (batches - 1) * (resolved.mainMinutes + resolved.side.minutes + 1) + Math.max(0, total - 2);
  return resolved;
}

export function findMenus(options = {}) {
  const config = validateOptions(options, false);
  const available = [];
  for (const menu of menus) {
    try {
      const resolved = resolveMenu(menu, config);
      if (resolved.minutes <= config.maxMinutes) available.push(resolved);
    } catch (error) {
      if (!error.message.startsWith('这套菜单无法避开')) throw error;
    }
  }
  return available;
}

function ingredient(item, servings, group = '共享基础', note = item.note || '') {
  const prefix = group === '共享基础' ? 'shared' : group.startsWith('A') ? 'A' : 'B';
  return { id: `${prefix}:${item.id}`, ingredientId: item.ingredientId || item.id, name: item.name, quantity: round(item.quantity * servings), unit: item.unit, group, note };
}

function proteinPreparation(protein) {
  if (protein.id === 'chicken') return '蔬菜全部备好后再处理鸡肉；不要冲洗生鸡肉。用独立生肉刀板切成约1.5厘米小块，放生肉专用碗，暂不接触熟食容器。处理后用肥皂流水洗手，彻底清洁刀、板和台面；之后仅用干净器具接触熟食。';
  if (protein.id === 'tofu') return '豆腐沥干，切成约1.5厘米方块，用厨房纸轻压表面水分。放干净碗，不与其他食材混在一起，方便按批下锅。';
  if (protein.id === 'egg') return '将鸡蛋打入干净碗，搅打至蛋白蛋黄均匀。蛋壳丢弃后用肥皂流水洗手，清洁接触蛋液的台面；盛熟蛋使用另一只干净碗。';
  return '熟鹰嘴豆打开包装后冲洗沥干，按沥干重量称量；只使用已煮熟的豆，不把干豆加入本流程。';
}

function mainCooking(menu, batch, servings, total) {
  const ratio = `${servings}/${total}`;
  const prefix = `第${batch}批做${servings}份：取主菜食材、主菜用油、主菜用水及主菜盐各占总量的${ratio}。`;
  const oil = `锅用中火预热约1分钟，加入本批主菜用油（${round(5 * servings)}毫升）。`;
  const water = `本批主菜用水（${round(60 * servings)}毫升）`;
  const accent = menu.accent.cook.replace('分配给本批的主菜用水', water);
  const addWater = menu.accent.usesMainWater ? '' : `加入${water}。`;
  const salt = `加入本批主菜盐（${round(0.5 * servings)}克）。`;
  const finish = '成品盛入干净的共享主菜盆，先不加蒜粉或辣椒粉；每批熟菜用干净锅铲取出。';
  if (menu.protein.id === 'chicken') return `${prefix}${oil}下鸡肉中火翻炒约4分钟，肉块分开、不堆叠。${accent}${addWater}再小火煮3至5分钟。${salt}用干净食品温度计从侧面测各批最大肉块中心，至少74°C；未达标继续加热并复测，不能只看颜色或按分钟判断。温度计按说明清洁，生肉碗和夹具不可盛熟食。${finish}`;
  if (menu.protein.id === 'tofu') return `${prefix}${oil}下豆腐，煎约5分钟，中途轻翻，至表面微黄；用干净碗暂盛。${accent}${addWater}放回豆腐，小火煮3分钟至内部热透。${salt}${finish}`;
  if (menu.protein.id === 'egg') return `${prefix}${oil}下蛋液，中火轻推2至3分钟至全部凝固、无流动蛋液，盛入干净碗。${accent}${addWater}放回熟蛋，翻炒1分钟至全部热透。${salt}${finish}`;
  return `${prefix}${oil}${accent}${addWater}下熟鹰嘴豆，中小火翻动并加热3分钟，直到豆子内部热透。${salt}${finish}`;
}

export function generatePlan(options) {
  const config = validateOptions(options, true);
  const menu = resolveMenu(menus.find((item) => item.id === config.menuId), config);
  if (menu.minutes > config.maxMinutes) throw new Error(`这套${config.servingsA + config.servingsB}份整餐预计需要${menu.minutes}分钟，超过${config.maxMinutes}分钟上限；请增加时间、减少份数或更换菜单。`);
  const total = config.servingsA + config.servingsB;
  const groups = ['A', 'B'].map((id) => {
    const flavor = flavors.find((item) => item.id === config[`flavor${id}`]);
    return { id, label: `${id}组`, servings: config[`servings${id}`], flavorId: flavor.id, flavorLabel: flavor.label };
  });
  const ingredients = [
    ingredient({ id: 'rice', name: '大米（干重）', quantity: 75, unit: '克' }, total, '共享基础', '普通白米；淘洗水另备，煮饭水以电饭煲与米包装说明为准。'),
    ingredient({ id: 'rice-water', ingredientId: 'water', name: '煮饭用水', quantity: 112.5, unit: '毫升' }, total, '共享基础', '参考干米:水重量1:1.5；如设备刻度或米包装不同，按其说明调整。'),
    ingredient(menu.protein, total), ingredient(menu.accent, total), ingredient(menu.side, total),
    ingredient({ id: 'main-oil', ingredientId: 'rapeseed-oil', name: '主菜用纯菜籽油', quantity: 5, unit: '毫升' }, total),
    ingredient({ id: 'side-oil', ingredientId: 'rapeseed-oil', name: '蔬菜用纯菜籽油', quantity: 3, unit: '毫升' }, total),
    ingredient({ id: 'main-water', ingredientId: 'water', name: '主菜用水', quantity: 60, unit: '毫升' }, total),
    ingredient({ id: 'side-water', ingredientId: 'water', name: '蔬菜用水', quantity: 20, unit: '毫升' }, total),
    ingredient({ id: 'main-salt', ingredientId: 'salt', name: '主菜基础盐', quantity: 0.5, unit: '克' }, total),
    ingredient({ id: 'side-salt', ingredientId: 'salt', name: '蔬菜基础盐', quantity: 0.3, unit: '克' }, total),
  ];
  for (const group of groups) {
    const flavor = flavors.find((item) => item.id === group.flavorId);
    ingredients.push(...flavor.ingredients.map((item) => ingredient(item, group.servings, `${group.id}组最后调味`, '只加入本组主菜；用本组独立干净勺子。')));
  }
  const blocked = excludedIds(config.exclusions);
  if (ingredients.some((item) => blocked.has(item.ingredientId))) throw new Error('采购清单仍含已排除食材，无法生成该方案。');
  const steps = [];
  const addStep = (title, detail, minutes, phase) => steps.push({ id: `step-${steps.length + 1}`, title, detail, minutes, phase });
  addStep('先启动共享米饭', `洗手并清洁台面。称${75 * total}克干米，淘洗后加参考${round(112.5 * total)}毫升水（按设备/米包装调整），启动电饭煲普通煮饭档。米饭在后续备料和炒菜时并行煮约30至40分钟；一名操作者只依次操作一口炒锅。确认电饭煲与炒锅容量适合${total}份；主菜与蔬菜每批最多2份。`, 3, 'prepare');
  addStep('一次备好两组蔬菜', `共享主菜的${menu.accent.name}：${menu.accent.prep}配菜${menu.side.name}：${menu.side.prep}分别放入干净碗。称出主菜与蔬菜各自的油、水、基础盐，勿加入蒜、辣椒或复合酱料。备好共享熟菜盆、A/B两组主菜碗及各自干净勺；碗可加干净盖子保温。`, 7 + Math.max(0, total - 2), 'prepare');
  addStep(`准备${menu.protein.name}`, proteinPreparation(menu.protein), menu.protein.id === 'chicken' ? 6 : 3, 'prepare');
  const batches = [];
  for (let remaining = total; remaining > 0; remaining -= 2) batches.push(Math.min(2, remaining));
  batches.forEach((servings, index) => addStep(`共享主菜：第${index + 1}/${batches.length}批`, mainC
```

### Core Architecture Module: `examples/family-memory/core.js`
```
const LIMITS = { participants: 5, memories: 300, questions: 300, stories: 100, text: 6000, short: 200, backup: 3000000 };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const fail = message => { throw new Error(message); };
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}格式不正确`);
  return value;
}

function string(value, label, max = LIMITS.text, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(`${label}应为不超过 ${max} 字的文字`);
  if (required && !value.trim()) fail(`${label}不能为空`);
  return value;
}

function identifier(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)) fail(`${label}无效`);
  return value;
}

function list(value, label, max) {
  if (!Array.isArray(value) || value.length > max) fail(`${label}数量应不超过 ${max}`);
  return value;
}

function uniqueIds(items, label) {
  if (new Set(items.map(item => item.id)).size !== items.length) fail(`${label}编号重复`);
}

function references(value, label) {
  const result = list(value, label, LIMITS.memories).map(item => identifier(item, label));
  if (new Set(result).size !== result.length) fail(`${label}有重复编号`);
  return result;
}

export function createSession() {
  return { version: 1, id: id('session'), title: '一起把往事补完整', date: '', place: '', prompt: '一张旧照或一段往事', participants: [], memories: [], questions: [], stories: [] };
}

export function validateSession(input) {
  const source = object(input, '活动');
  if (source.version !== 1) fail('暂不支持这个备份版本');
  const state = {
    version: 1, id: identifier(source.id, '活动编号'),
    title: string(source.title, '活动标题', LIMITS.short, true),
    date: string(source.date, '日期', 10), place: string(source.place, '地点', LIMITS.short),
    prompt: string(source.prompt, '主持提示'),
    participants: list(source.participants, '参与者', LIMITS.participants).map(value => {
      const participant = object(value, '参与者');
      if (typeof participant.consent !== 'boolean') fail('请明确记录是否自愿参与');
      return { id: identifier(participant.id, '参与者编号'), name: string(participant.name, '称呼', 80, true), consent: participant.consent };
    }),
    memories: list(source.memories, '原话', LIMITS.memories).map(value => {
      const memory = object(value, '原话');
      if (!['public', 'private'].includes(memory.visibility)) fail('原话留存范围无效');
      return { id: identifier(memory.id, '原话编号'), participantId: identifier(memory.participantId, '讲述者编号'), text: string(memory.text, '原话', LIMITS.text, true), eventHint: string(memory.eventHint, '线索', LIMITS.short), visibility: memory.visibility };
    }),
    questions: list(source.questions, '互问', LIMITS.questions).map(value => {
      const question = object(value, '互问');
      if (!['open', 'answered', 'skipped'].includes(question.status)) fail('互问状态无效');
      return { id: identifier(question.id, '互问编号'), fromId: identifier(question.fromId, '提问者编号'), toId: identifier(question.toId, '回答者编号'), sourceIds: references(question.sourceIds, '互问原话'), text: string(question.text, '问题', LIMITS.text, true), status: question.status, answer: string(question.answer, '回答'), answerMemoryId: question.answerMemoryId === null ? null : identifier(question.answerMemoryId, '回答原话编号') };
    }),
    stories: list(source.stories, '故事', LIMITS.stories).map(value => {
      const story = object(value, '故事');
      return { id: identifier(story.id, '故事编号'), title: string(story.title, '故事标题', LIMITS.short, true), memoryIds: references(story.memoryIds, '故事原话'), note: string(story.note, '故事注记'), disagreement: string(story.disagreement, '不同说法') };
    })
  };
  if (state.date && !/^\d{4}-\d{2}-\d{2}$/.test(state.date)) fail('日期请使用 年-月-日 格式');
  if (state.date && (Number.isNaN(Date.parse(state.date)) || new Date(`${state.date}T00:00:00Z`).toISOString().slice(0, 10) !== state.date)) fail('日期不存在，请重新选择');
  for (const [collection, label] of [[state.participants, '参与者'], [state.memories, '原话'], [state.questions, '互问'], [state.stories, '故事']]) uniqueIds(collection, label);
  const participants = new Map(state.participants.map(item => [item.id, item]));
  const memories = new Map(state.memories.map(item => [item.id, item]));
  const willing = participantId => participants.get(participantId)?.consent === true;
  const publicMemory = memoryId => memories.get(memoryId)?.visibility === 'public';
  for (const memory of state.memories) if (!willing(memory.participantId)) fail('原话必须属于已自愿参与的亲属');
  for (const question of state.questions) {
    if (!willing(question.fromId) || !willing(question.toId)) fail('互问双方需要自愿参与');
    if (question.sourceIds.some(memoryId => !publicMemory(memoryId))) fail('互问引用的共同原话已缺失或为私密');
    if (question.status === 'answered') {
      const answer = memories.get(question.answerMemoryId);
      if (!answer || answer.participantId !== question.toId || answer.visibility !== 'public' || answer.text !== question.answer || question.sourceIds.includes(answer.id)) fail('回答与署名原话不一致');
    } else if (question.answer !== '' || question.answerMemoryId !== null) fail('未回答或跳过的问题不能保留回答');
  }
  const answers = state.questions.filter(question => question.answerMemoryId).map(question => question.answerMemoryId);
  if (new Set(answers).size !== answers.length) fail('一条回答原话不能属于多个互问');
  for (const story of state.stories) {
    if (!story.memoryIds.length || story.memoryIds.some(memoryId => !publicMemory(memoryId))) fail('故事需要至少一条仍可共同留存的原话');
  }
  if (new TextEncoder().encode(JSON.stringify(state, null, 2)).byteLength > LIMITS.backup) fail('完整活动备份超过 3 MB，请减少本次活动内容');
  return state;
}

function find(items, itemId, label) {
  const item = items.find(value => value.id === itemId);
  if (!item) fail(`${label}不存在或已撤回`);
  return item;
}

function patch(input, values, allowed) {
  object(values, '修改内容');
  for (const key of allowed) if (own(values, key)) input[key] = values[key];
}

export function updateSession(input, values) {
  const state = validateSession(input);
  patch(state, values, ['title', 'date', 'place', 'prompt']);
  return validateSession(state);
}

export function addParticipant(input, values) {
  const state = validateSession(input);
  state.participants.push({ id: id('person'), name: values.name, consent: values.consent });
  return validateSession(state);
}

// 删除来源后，连带删除由它产生的互问与回答，避免派生文字残留。
function invalidate(state, memoryIds) {
  const removed = new Set(memoryIds);
  let affected;
  do {
    affected = state.questions.filter(question => question.sourceIds.some(memoryId => removed.has(memoryId)) || removed.has(question.answerMemoryId));
    for (const question of affected) if (question.answerMemoryId) removed.add(question.answerMemoryId);
    state.questions = state.questions.filter(question => !affected.includes(question));
  } while (affected.length);
  state.memories = state.memories.filter(memory => !removed.has(memory.id));
  state.stories = state.stories.flatMap(story => {
    if (!story.memoryIds.some(memoryId => removed.has(memoryId))) return [story];
    const remaining = story.memoryIds.filter(memoryId => !removed.has(memoryId));
    return remaining.length ? [{ ...story, title: '待重新核对的故事', memoryIds: remaining, note: '', disagreement: '' }] : [];
  });
  return state;
}

export function updateParticipant(input, participantId, values) {
  const state = validateSession(input);
  const participant = find(state.participants, participantId, '参与者');
  patch(participant, values, ['name', 'consent']);
  if (participant.consent === false) {
    const questions = state.questions.filter(question => question.fromId === participantId || question.toId === participantId);
    invalidate(state, [...state.memories.filter(memory => memory.participantId === participantId).map(memory => memory.id), ...questions.map(question => question.answerMemoryId).filter(Boolean)]);
    state.questions = state.questions.filter(question => question.fromId !== participantId && question.toId !== participantId);
  }
  return validateSession(state);
}

export function addMemory(input, values) {
  const state = validateSession(input);
  state.memories.push({ id: id('memory'), participantId: values.participantId, text: values.text, eventHint: values.eventHint ?? '', visibility: values.visibility ?? 'public' });
  return validateSession(state);
}

export function updateMemory(input, memoryId, values) {
  const state = validateSession(input);
  const memory = find(state.memories, memoryId, '原话');
  const updated = { ...memory };
  patch(updated, values, ['text', 'eventHint', 'visibility']);
  if (['text', 'eventHint', 'visibility'].some(key => updated[key] !== memory[key])) {
    const position = state.memories.indexOf(memory);
    invalidate(state, [memoryId]);
    state.memories.splice(Math.min(position, state.memories.length), 0, updated);
    // 仍然公开的修订原话保留故事归属；标题和注记必须由人重新核对。
    if (updated.visibility === 'public') {
      state.stories = input.stories.flatMap(story => {
        if (!story.memoryIds.includes(memoryId)) return state.stories.filter(value => value.id === story.id);
        const remaining = story.memoryIds.filter(value => state.memories.some(entry => entry.id === value && entry.visibility === 'public'));
        return remaining.length ? [{ ...story, memoryIds: [...remaining], title: '待重新核对的故事', note: '', disagreement: '' }] : [];
      });
    }
  }
  return validateSession(state);
}

export function withdrawMemory(input, memoryId) {
  const state = validateSession(input);
  find(state.memories, memoryId, '原话');
  return validateSession(invalidate(state, [memoryId]));
}

export function addQuestion(input, values) {
  const state = validateSession(input);
  state.questions.push({ id: id('question'), fromId: values.fromId, toId: values.toId, sourceIds: values.sourceIds ?? [], text: 
```

### Core Architecture Module: `examples/participation-recovery/core.js`
```
const KINDS = ['route', 'captions', 'materials'];
const PROOF = { route: 'route-traversed', captions: 'captions-visible', materials: 'materials-open' };
const LABELS = { route: '参加路径', captions: '观看端字幕', materials: '提前资料' };
const clone = value => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value, label, optional = false) => {
  assert(typeof value === 'string' && value.length <= 10000 && (optional || value.trim().length > 0), `${label}须填写有效文字`);
};
const instant = (value, label) => {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value)), `${label}须填写有效日期时间`);
};
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const find = (list, key, label) => { const item = list.find(entry => entry.id === key); assert(item, `${label}不存在`); return item; };
const snapshot = resource => ({ version: resource.version, title: resource.title, owner: resource.owner, location: resource.location, deadline: resource.deadline, changedAt: resource.changedAt });
const sameInstant = (left, right) => left === right || Number.isFinite(Date.parse(left)) && Date.parse(left) === Date.parse(right);
const materialContentStart = (resource, version) => {
  let start = resource.versionHistory[0];
  for (let index = 1; index < version; index++) {
    if (resource.versionHistory[index].contentUpdated === true || resource.versionHistory[index].location !== resource.versionHistory[index - 1].location) start = resource.versionHistory[index];
  }
  return start;
};
const hasTimelyMaterialProof = (state, resource, version, deadline, checkedBefore) => {
  const start = materialContentStart(resource, version);
  return state.evidence.some(proof => proof.resourceId === resource.id && proof.version >= start.version && proof.version <= version && proof.result === 'pass' && Date.parse(proof.deliveredAt) <= Date.parse(deadline) && Date.parse(proof.checkedAt) <= Date.parse(checkedBefore));
};
const materialMissedDeadline = (state, resource) => resource.kind === 'materials' && (resource.missedDeadline || resource.versionHistory.some((revision, index) => {
  if (index === 0) return false;
  const previous = resource.versionHistory[index - 1];
  if (Date.parse(revision.changedAt) <= Date.parse(previous.deadline)) return false;
  return revision.contentUpdated === true || revision.location !== previous.location || !sameInstant(revision.deadline, previous.deadline) && !hasTimelyMaterialProof(state, resource, previous.version, previous.deadline, revision.changedAt);
}) || state.evidence.some(proof => proof.resourceId === resource.id && Date.parse(proof.deliveredAt) > Date.parse(resource.versionHistory[proof.version - 1].deadline)));
const audit = (state, action, details) => state.audit.push({ id: id('audit'), at: now(), action, details });
const unique = (items, label) => {
  assert(new Set(items.map(item => item.id)).size === items.length, `${label}编号重复`);
  items.forEach(item => text(item.id, `${label}编号`));
};

export function createEmptyProject() {
  return { schemaVersion: 1, event: { name: '', date: '' }, sessions: [], resources: [], paths: [], evidence: [], confirmations: [], audit: [] };
}

export function validateProject(state) {
  assert(state && typeof state === 'object' && !Array.isArray(state) && state.schemaVersion === 1, '文件版本不支持，请导入版本 1 项目');
  assert(state.event && typeof state.event === 'object', '活动信息缺失');
  text(state.event.name, '活动名称', true);
  text(state.event.date, '活动日期', true);
  assert(state.event.date === '' || validDay(state.event.date), '活动日期无效');
  for (const key of ['sessions', 'resources', 'paths', 'evidence', 'confirmations', 'audit']) {
    assert(Array.isArray(state[key]) && state[key].length <= 10000, `${key} 数据格式无效或超过 10000 条`);
    assert(state[key].every(item => item && typeof item === 'object' && !Array.isArray(item)), `${key} 数据条目无效`);
  }
  for (const key of ['sessions', 'resources', 'paths', 'evidence']) unique(state[key], key);
  for (const session of state.sessions) {
    text(session.title, '场次名称'); instant(session.startsAt, '场次开始时间');
    assert(Number.isInteger(session.version) && session.version >= 1 && Array.isArray(session.versionHistory) && session.versionHistory.length === session.version, '场次版本历史无效');
    for (let index = 0; index < session.versionHistory.length; index++) {
      const revision = session.versionHistory[index];
      assert(revision && revision.version === index + 1, '场次版本历史必须连续'); text(revision.title, '历史场次名称'); instant(revision.startsAt, '历史场次开始时间');
      if (index > 0) {
        instant(revision.changedAt, '场次变更时间'); assert(Date.parse(revision.changedAt) <= Date.now(), '场次变更时间不能在未来');
        if (index > 1) assert(Date.parse(revision.changedAt) >= Date.parse(session.versionHistory[index - 1].changedAt), '场次变更时间顺序无效');
      }
      else assert(revision.changedAt === null, '初始场次时间无效');
    }
    assert(session.versionHistory.at(-1).title === session.title && session.versionHistory.at(-1).startsAt === session.startsAt, '当前场次与版本历史不一致');
  }
  for (const resource of state.resources) {
    const session = find(state.sessions, resource.sessionId, '资源关联场次');
    assert(KINDS.includes(resource.kind), '资源类型无效');
    for (const key of ['title', 'owner', 'location']) text(resource[key], `资源${key}`);
    assert(Number.isInteger(resource.version) && resource.version >= 1, '资源版本无效');
    if (resource.kind === 'materials') {
      instant(resource.deadline, '提前资料期限');
      assert(Date.parse(resource.deadline) <= Date.parse(session.startsAt), '提前资料期限不能晚于场次开始');
    } else assert(resource.deadline === '', '只有提前资料资源可以设置交付期限');
    assert(typeof resource.missedDeadline === 'boolean', '迟交记录缺失');
    assert(Array.isArray(resource.versionHistory) && resource.versionHistory.length === resource.version, '资源版本历史不完整，不能伪造当前版本');
    for (let index = 0; index < resource.versionHistory.length; index++) {
      const revision = resource.versionHistory[index];
      assert(revision && revision.version === index + 1, '资源版本历史必须连续');
      assert(revision.contentUpdated === undefined || typeof revision.contentUpdated === 'boolean', '内容更新标记须为布尔值');
      if (index === 0) assert(revision.contentUpdated !== true, '初始版本不能标为内容更新');
      for (const key of ['title', 'owner', 'location']) text(revision[key], `历史资源${key}`);
      if (resource.kind === 'materials') { instant(revision.deadline, '历史提前资料期限'); assert(session.versionHistory.some(item => Date.parse(revision.deadline) <= Date.parse(item.startsAt)), '历史提前资料期限不能晚于所有场次安排'); }
      else assert(revision.deadline === '', '历史期限格式无效');
      if (index > 0) {
        instant(revision.changedAt, '资源变更时间'); assert(Date.parse(revision.changedAt) <= Date.now(), '资源变更时间不能在未来');
        if (index > 1) assert(Date.parse(revision.changedAt) >= Date.parse(resource.versionHistory[index - 1].changedAt), '资源变更时间顺序无效');
      }
      else assert(revision.changedAt === null, '初始资源时间记录无效');
    }
    assert(Object.entries(snapshot(resource)).every(([key, value]) => resource.versionHistory.at(-1)[key] === value), '当前资源与版本历史不一致');
  }
  for (const path of state.paths) {
    find(state.sessions, path.sessionId, '参加路径关联场次'); text(path.label, '参加路径名称');
    assert(Array.isArray(path.resourceIds) && path.resourceIds.length > 0 && new Set(path.resourceIds).size === path.resourceIds.length, '参加路径至少选择一项资源，且不能重复');
    for (const resourceId of path.resourceIds) assert(find(state.resources, resourceId, '参加路径资源').sessionId === path.sessionId, '参加路径不能引用其他场次资源');
    assert(Number.isInteger(path.version) && path.version >= 1 && Array.isArray(path.versionHistory) && path.versionHistory.length === path.version, '参加路径版本历史无效');
    for (let index = 0; index < path.versionHistory.length; index++) {
      const revision = path.versionHistory[index];
      assert(revision && revision.version === index + 1, '参加路径版本历史必须连续'); text(revision.label, '历史参加路径名称');
      assert(Array.isArray(revision.resourceIds) && revision.resourceIds.length > 0 && new Set(revision.resourceIds).size === revision.resourceIds.length, '历史参加路径资源无效');
      for (const key of revision.resourceIds) assert(find(state.resources, key, '历史参加路径资源').sessionId === path.sessionId, '历史参加路径不能引用其他场次资源');
      if (index > 0) {
        instant(revision.changedAt, '参加路径变更时间'); assert(Date.parse(revision.changedAt) <= Date.now(), '参加路径变更时间不能在未来');
        if (index > 1) assert(Date.parse(revision.changedAt) >= Date.parse(path.versionHistory[index - 1].changedAt), '参加路径变更时间顺序无效');
      }
      else assert(revision.changedAt === null, '初始参加路径时间无效');
    }
    const latest = path.versionHistory.at(-1);
    assert(latest.label === path.label && JSON.stringify(latest.resourceIds) === JSON.stringify(path.resourceIds), '当前参加路径与版本历史不一致');
  }
  for (const proof of state.evidence) validateEvidence(state, proof);
  for (const confirmation of state.confirmations) {
    const path = find(state.paths, confirmation.pathId, '确认的参加路径');
    text(confirmation.by, '确认人'); instant(confirmation.at, '确认时间');
    assert(Date.parse(confirmation.at) <= Date.now(), '确认时间不能在未来');
    assert(['owner', 'participant'].includes(confirmation.role), '确认角色无效');
    assert(typeof confirmation.signature === 'string', '确认签名无效');
    let parsed;
    try { parsed = JSON.parse(confirmation.signature); } catch { throw new Error('确认签名无效'); }
    const session = find(state.sessions, path.sessionId, '场次');
    assert(parsed && typeof parsed === 'object' && parsed.pathId === path.id && parsed.sessionId === path.sessionId && session.versionHistory.some(item => item.version === parsed.sessionVersion && item.startsAt === parsed.start
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #47** (2026-10-04): **Refine product detail showcase screenshots**
  *Symptoms*: The README detail-page screenshots showed unavailable runtime fields and an internal read-only notice. Refresh all 18 desktop/mobile captures with the requested presentation values: unavailable run status is shown as Ended, concurrency as No, and the read-only banner is omitted.  The capture tool now has an explicit `--presentation-demo` flag. Its display replacements are disclosed beside the README images and recorded individually in the public manifest. Original reports, cycle identities, dates, checks, APIs and media remain unchanged; no image pixels are edited. Normal capture mode and the live Dashboard are unchanged.  Validation: six bilingual browser views passed original report/media digest checks, chronology, language, image loading, overflow and demo-field assertions; all 18 image hashes verified. Node syntax and Git whitespace checks pass. This is a README follow-up; the published v2.1.0 tag is unchanged. 

- **Issue #46** (2026-10-03): **Release v2.1.0: parallel work and Product Center**
  *Symptoms*: ## Summary  Prepare v2.1.0 with parallel product execution, saved configuration templates and the reviewed Product Center redesign. New centers default to four concurrent projects; each request retains its submitted configuration and independent runtime ownership. Existing ownership uncertainty, P1 and budget protections remain in force.  The catalog now provides an expanding search field, shared filters, separate preview/name columns, whole-row navigation and batched read-only status observations. Product journals use consistent current and historical report layouts, compact dates and a unified header. Returning to the catalog preserves its filters, expanded products and reading position.  Includes committed Dashboard UI assets with pinned dependency locks, a shared interface specification, upgrade guidance, bilingual README updates and 18 fresh screenshots verified against preserved real report/media digests. Corrects standalone static asset routes and updates browser contracts for the actual controls.  ## Validation  - All 85 browser cases covered on Windows Chromium: 37 center/dashboard cases and 18 journal cases passed initially; five corrected contract cases passed on rerun; all 25 public-example cases passed. - 71 JavaScript contracts passed; UI type check and build passed. - Actual Windows/WSL bridge fixture passed; native Windows managed-entrypoint guard passed. Read-only observer: 11 Windows cases passed, two POSIX cases delegated to the Linux suite. - 199 bundled s

- **Issue #45** (2026-10-02): **Restore B frontend design and add a dedicated polishing pass**
  *Symptoms*: Restore the frontend instruction chain from the user's preferred B refinement baseline. Add a dedicated finishing prompt for an already working frontend, covering component consistency, task hierarchy, unnecessary explanatory copy, responsive behavior and same-state functional/visual review while preserving the product's identity.  The bilingual main prompts schedule this pass through the existing Next Action workflow; a completed pass is not repeated after restart. Update the UI role/team handoff and include the new skill in the isolated runtime resource manifest. Update README/study adoption notes while retaining all historical B/C evidence.  Validation: all six restored files matched the frozen B manifest before adding finishing handoffs; the design skill remains byte-identical to B. Skill validation and 199 resource links pass. All 16 localization tests pass on WSL. An actual namespace probe confirms the new skill is readable in the packaged workspace, normal writes work, and foreign/host project paths remain absent. This is prompt integration verification, not a new visual A/B result. 

- **Issue #44** (2026-10-02): **Simplify bilingual timelines and refresh README screenshots**
  *Symptoms*: The English and Chinese work timelines now omit refinement/original-capture captions and the bottom data-notes disclosure. Runtime diagnostics are available only in Logs. Product screenshots remain expanded by default, with manual disclosure choices preserved.  Removed cycle-count captions from both READMEs and recaptured all six bilingual showcase views (18 desktop/mobile images). Original reports, cycle identities, chronology, screenshot records and resource digests remain unchanged; provenance remains in the public manifest and API.  Validation: 35 frontend helper tests, 8 showcase preview tests and 2 targeted browser smoke tests passed. All six real read-only showcase views passed language, image loading, clipping, overflow, disclosure persistence and Log-only diagnostics checks, with no capture warnings or browser errors. All six desktop captures were visually reviewed. 

- **Issue #43** (2026-10-02): **Enforce project isolation across models, tools and previews**
  *Symptoms*: Model permission settings previously left host files, other product repositories, shared sessions and host-local services reachable through tools or descendants. This change makes Linux namespace isolation mandatory for model cycles, interactive teams, product checks, screenshot workers and product Git status. Each invocation receives only the current product and explicit framework resources, with a fresh HOME and public-only HTTP(S) egress.  Output collection validates project ownership and links before a journaled replacement, preserves rejected/interrupted work for recovery, and prevents exited preview records from contacting host services. Missing isolation dependencies fail closed. Linux/WSL2 is supported; native Windows/macOS and unverified Cursor packaging are refused. No production service is deployed or restarted by this PR.  Validation includes independent host/child filesystem and network probes, actual Chromium captures, transactional recovery, and natural-completion `gpt-6.1-sol/high` parent/subagent runs. Orchestration doubles are confined to disposable test copies; CI separately requires a real kernel preflight and namespace/media tests. Detailed supported runtime and recovery instructions are in `docs/project-isolation.md`.  Final validation: all 11 CI jobs passed at `742f666`, including 583 Python tests (23 explicit platform/opt-in skips covered by the appropriate separate checks), 61 browser tests, 43 media contracts, host-to-media isolation, center media li

- **Issue #42** (2026-10-02): **Expand timeline product screenshots and validate explicit frontend redesign**
  *Symptoms*: Product screenshots in recorded timelines were collapsed by default, so README showcases hid the product surface. They now start expanded and preserve a user's toggle during the browser session. The six bilingual desktop timeline images and their mobile captures were refreshed; reviewed refinements have separate provenance and original-run image links.  The frontend prompt previously routed every existing product into identity-preserving refinement. It now distinguishes refinement from an explicitly requested redesign across the prompt, UI role and design skill. Three completed redesign runs and 24 matching B/C browser captures show structural changes, while documenting the remaining warm-color convergence and mobile tradeoffs. The old study's strict read-isolation and single-variable causal claims are corrected following the run-log audit.  Validation: - Dashboard helpers: 35 passed; showcase preview: 8 passed; six real bilingual captures and disclosure interactions passed. - Localization: 15 passed on Windows; its one Linux-only case passed under real WSL Ubuntu. - Independent B/C browser workflows: 12/12 passed; old B backup into C: 2/2 passed; frozen product hashes unchanged. - Parent directly exercised all three C workflows; image hashes and same-state fixtures verified.  No generated C candidate replaces a published product example. Raw sessions, local paths and private audit evidence remain outside the public commit. No production deployment. 

- **Issue #41** (2026-10-01): **Publish refined examples, bilingual showcases and measured frontend guidance**
  *Symptoms*: The public examples were scattered under the generated-project workspace, while the README mixed languages and showed too little recorded work. This publishes 22 runnable examples under `examples/`, refines the 14 recent interfaces, and replaces the README images with reviewed English and Chinese captures. ScopeFence's seven real cycles lead the page; ScopeFence, Image Checklist and COI Chase Desk each have paired product/timeline images.  The dashboard keeps exploration and product work in one continuous journal. Reviewed display overlays translate the selected historical views without changing original identities, reports, timestamps, failures or cycle counts. The read-only showcase preview validates its inputs; captures and source hashes have a public manifest. Real interaction fixes include evidence invalidation after rapid edits and correct missing-record labels. New local runs still use `projects/`.  Frontend guidance now specifies user tasks, content hierarchy, component states, readable copy and product-specific identity. The adapted Anthropic skill includes attribution and its Apache-2.0 license. Six real `gpt-6.1-sol/high` runs compared the old and frozen new instructions on three fixed products. Primary-agent review chose B with two wins and one tie; all 12 common desktop/mobile scenarios passed. The small, non-blinded study, same-state images and limits are published under `presentation/frontend-study/`.  Verification also exposed an existing state-publication rac

- **Issue #40** (2026-09-27): **Release v2.0.0: Product Center**
  *Symptoms*: Product Center brings separate local product runs into one searchable dashboard, with read-only imports and explicit continuation requests. One persistent queue owns each full auto-loop and its cleanup; viewing or refreshing never starts work.  This release also fixes the systematic-review findings around stop authorization, P1 queue protection, complete older-cycle history and usage, default exploration creation, visible preparation failures, stopping uncertain work, preview links and keyboard focus. Existing single-runtime entrypoints remain available outside center-managed directories. Installer work is excluded.  Validation: - Independent Astra/high implementation review and release preflight; source behavior is unchanged by release preparation. - Local browser suite: 38 passed and one Text Meter teardown timeout; the unchanged targeted recheck passed (39 unique scenarios covered). JavaScript contracts: 44 passed. - Focused runtime, catalog, identity, journal and HTTP checks passed; platform-specific optional bridge/media checks retain their explicit skips. Prior real Luna, Terra and Sol acceptance is recorded separately and is not represented as an uninterrupted all-green run. - Required PR and merge CI must pass before tagging and publishing v2.0.0. These jobs do not establish complete real macOS Product Center execution coverage.  Version, bilingual README guidance and upgrade documentation are updated. Release notes are bilingual; existing screenshots and private rele

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `f4a4a874` (2026-10-02)
**Commit Message**: Expand product screenshots and distinguish explicit frontend redesign (#42)

**File**: `.claude/agents/ui-duarte.md` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ model: inherit
 # UI Design Agent — Matías Duarte
 
 ## Role
-UI 设计总监，负责从用户任务形成具体视觉方向、组件规范，并核对实现效果。涉及前端时先读取并使用 `.claude/skills/frontend-design.md`；设计决定须能落实到实际页面。
+UI 设计总监，负责从用户任务形成具体视觉方向、组件规范，并核对实现效果。涉及前端时先读取并使用 `.claude/skills/frontend-design.md`，按用户意图选择精修或重新设计/新建模式；设计决定须能落实到实际页面。
 
 ## Persona
 你是一位深受 Matías Duarte 设计哲学影响的 AI UI 设计师。你的设计思维来自 Material Design 的创造过程——将物理世界的直觉带入数字界面。
@@ -60,7 +60,7 @@ UI 设计总监，负责从用户任务形成具体视觉方向、组件规范
 
 ## 独立开发者特别建议
 - 复用现有组件和可靠交互模式；根据产品调整排版、颜色和构图
-- 沿用技术栈，精修不强制迁移框架；已有产品先保留身份与有效结构
+- 精修复用现有技术栈并保留有效身份与结构；明确重新设计/新建时从任务重新决定布局、配色、字体、组件和交互流程，框架可按需要选择。已有代码不等于必须保留旧外观；业务、数据兼容、恢复与隐私边界继续有效
 - 一致性比完美更重要
 - 先做好移动端，再扩展到桌面端
 
```

**File**: `.claude/skills/frontend-design.md` (modified, +14/-8)
```diff
@@ -1,21 +1,27 @@
 ---
 name: frontend-design
-description: Design and implement distinctive, usable web interfaces, or refine an existing product's layout, typography, color, components and responsive states. Use for frontend creation and visual refinement, within the requested product scope.
+description: Design and implement distinctive, usable web interfaces. Use for frontend creation, an explicitly requested redesign, or refinement of an existing product, with the scope chosen from the user's intent.
 license: Apache-2.0; see frontend-design.LICENSE.txt
 ---
 
 # Frontend Design
 
-Create an interface with a deliberate visual identity that helps its specific audience complete a real task. This applies to working software as well as websites. Read the existing product and its task before choosing its visual treatment.
+Create an interface with a deliberate visual identity that helps its specific audience complete a real task. This applies to working software as well as websites. Understand the product's task and functional contracts before choosing its visual treatment.
+
+## Select the requested mode
+
+An existing codebase does not automatically mean refinement. Choose the mode from the user's request and record it in the design brief. A current explicit redesign request overrides earlier refinement-only visual constraints; preserve unrelated functional and operational requirements.
+
+- **Refine:** for targeted polish or improvement, inspect the current screens, assets and states. Preserve the useful identity, structure and familiar actions unless the requested change needs otherwise. Do not turn a local improvement into an unsolicited redesign.
+- **Redesign / new build:** when the user asks to redesign, rebuild, reimagine or create a new frontend, derive the composition from the audience, material and task. For an existing product, establish its behaviors, data contracts and recovery paths first, then propose the new direction before studying old styling in detail. Existing screens are functional references, not a required palette, layout, type system, component system or navigation flow. Replacing frontend code and reorganizing the full experience is allowed within the request. Preserve business meaning, existing data compatibility, import/export, recovery, privacy and meaningful errors unless the user explicitly changes those requirements.
+
+Honor explicit stack choices. For refinement, reuse the existing stack and components. For an authorized redesign or new build, choose an implementation that supports the design and delivery needs; neither a framework migration nor retaining the framework is a visual requirement. Keep dependencies proportionate and verify the resulting application.
 
 ## Establish the direction
 
 Before implementation, leave a short design brief in the work notes: the user and situation; the primary task and outcome; the content that deserves attention first; and a visual direction supported by that content. Name concrete choices for typography, color roles, layout and the main interactive component. Briefly compare a plausible alternative so the choice is intentional. Keep this brief out of the product interface.
 
-- **Refining an existing product:** inspect its current screens, assets and states. Preserve its identity, useful structure, familiar actions and functional scope. Identify what needs to change to improve hierarchy or use; a refinement need not become a redesign.
-- **Creating a new product:** derive the direction from the audience, material and use context. A workbench, a shared activity and a visual collection can need very different compositions. Do not reuse one portfolio-wide palette or page skeleton.
-
-Use the user's chosen stack and existing components. Add a framework or dependency only when the requested behavior requires it. A small HTML/CSS implementation can receive the same design attention as a larger application.
+A workbench, a shared activity and a visual collection can need very different compositions. Do not reuse one portfolio-wide palette or page skeleton. In redesign mode, make the new direction concrete in the work surface, information hierarchy and interaction, not just a changed accent color. No color family or layout is required or prohibited; make the choices appropriate to this product. A small HTML/CSS implementation can receive the same design attention as a larger application.
 
 ## Make the task visible
 
@@ -26,7 +32,7 @@ Define the important components precisely enough to implement: alignment, dimens
 ## Give it character
 
 - **Type:** use a purposeful type scale and strong text hierarchy. Choose faces and fallbacks that render the product language well; use existing or available fonts and verify missing-font behavior. Distinctiveness may come from composition and proportions rather than adding a font download.
-- **Color:** choose a coherent base, readable text, action and semantic status colors. Consider contrast and satura
```

**File**: `.claude/skills/team/SKILL.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ Use the Agent Teams feature to assemble the temporary team:
 - Use the Task tool to spawn each teammate with `subagent_type` set to `general-purpose`; inject the full content of the corresponding agent file into the prompt as its role definition
 - When spawning a teammate, state in the prompt: its role definition, the task to complete, the cycle's runtime `Language` instruction, and that output documents belong under `docs/<role>/`
 
-For frontend work, name one selected member as design owner without expanding the team just for a title. The owner and implementer must read `.claude/skills/frontend-design.md`. Pass the user task, agreed visual direction, key component decisions and acceptance states with the implementation handoff; the owner checks the implemented screens, not only a written design.
+For frontend work, name one selected member as design owner without expanding the team just for a title. The owner and implementer must read `.claude/skills/frontend-design.md`. Select refinement or redesign/new-build mode from the user's intent; an existing codebase alone does not select refinement. Pass the mode, user task, functional contracts, agreed visual direction, key component decisions and acceptance states with the implementation handoff. In an explicit redesign, do not reintroduce earlier refinement-only identity, palette or layout constraints. The owner checks the implemented screens, not only a written design.
 
 ### 3. Coordinate and Consolidate
 
```

**File**: `PROMPT.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
 
 读 `.claude/skills/team/SKILL.md`，按里面的流程组建团队执行任务。每轮选 3-5 个最相关的 agent，不要全部拉上。
 
-如果本轮任务会产出 landing page、dashboard、marketing site、产品 Web UI、应用界面、前端组件，或任何面向用户的前端交付物，必须先读并使用 `.claude/skills/frontend-design.md`，再进入界面设计或代码实现。协调器须指定本轮已有成员中的前端设计负责人；负责人与实现者均读取该技能，先确定用户任务、信息层级及具体视觉方向，再实现并检查真实页面。已有产品按既有身份与流程精修，新产品按其内容和使用场景选择方向；不规定统一配色或框架。
+如果本轮任务会产出 landing page、dashboard、marketing site、产品 Web UI、应用界面、前端组件，或任何面向用户的前端交付物，必须先读并使用 `.claude/skills/frontend-design.md`，再进入界面设计或代码实现。协调器须指定本轮已有成员中的前端设计负责人；负责人与实现者均读取该技能，先按用户意图确定精修或重新设计/新建模式，再确定用户任务、信息层级及具体视觉方向，实现并检查真实页面。精修保留有效身份与结构；明确要求重新设计时，可重建布局、配色、字体、组件与交互流程，既有界面仅作功能参考，不自动沿用旧视觉限制。保留业务语义、数据兼容、导入导出、恢复与隐私要求；不规定统一配色或框架。
 
 ### 4. 更新共识（必须）
 
```

**File**: `README-ZH.md` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@
 
 ScopeFence 的 **7 个真实完成轮次：3 轮探索 + 4 轮产品工作**。探索、交付与后续工作在同一条时间轴中连续显示，原有身份、时间、检查与日志保持不变。
 
-时间轴使用经审校的中文翻译视图；产品截图来自经过人工精修和功能验收的公开副本。这些修复不增加历史轮次，也不代表已验证付费需求。点击图片查看原尺寸；[截图来源与复现](presentation/showcase/README.md)。
+时间轴使用经审校的中文翻译视图，产品实拍默认展开。标明**发布精修版**的图片来自已审校的中文产品副本；原运行截图保留独立查看入口。这些修复不增加历史轮次，也不代表已验证付费需求。点击图片查看原尺寸；[截图来源与复现](presentation/showcase/README.md)。
 
 <table>
 <tr><th colspan="2"><a href="examples/scopefence/">范围确认单</a> · 7 轮 · 3 探索 + 4 产品</th></tr>
@@ -93,7 +93,7 @@ make center
 
 案例覆盖专业数据核验、图片交付、双人饮食、旅行节奏、家庭共同创作等任务。展示副本保留原产品方向，修复真实交互问题并统一组件细节；原始运行报告与失败结论不会随宣传图改写。
 
-前端现采用基于 Anthropic 技能改编、从用户任务出发的设计规则。[三个固定产品的提示词对照](presentation/frontend-study/README.md)中，新规则两胜一平，12 次共同桌面与手机流程全部通过。
+前端采用基于 Anthropic 技能改编的设计规则，区分局部精修与明确要求的重新设计。[三个固定产品的重做实拍](presentation/frontend-redesign/README.md)记录布局、风格与功能验收；[上轮精修实验](presentation/frontend-study/README.md)已补充读取边界审计。这些小样本、非盲评案例不代表提示词普遍更优。
 
 ## 你该看哪一节（按平台）
 
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ Optional Cursor and OpenAI-compatible adapters require explicit configuration. S
 
 ScopeFence across **7 real completed cycles: 3 exploration + 4 product cycles**. Exploration, delivery and later work share one continuous timeline, with original identities, timestamps, checks and logs preserved.
 
-The timeline uses a reviewed English presentation overlay. Product screenshots show the published copies after human-directed refinement and functional checks. These changes do not add historical cycles or establish paid demand. Open an image at full size; see [capture provenance and reproduction](presentation/showcase/README.md).
+The timeline uses a reviewed English presentation overlay, with product screenshots expanded by default. The labeled **Published refinement** shows the reviewed English product copy; the original run captures remain linked separately. These changes do not add historical cycles or establish paid demand. Open an image at full size; see [capture provenance and reproduction](presentation/showcase/README.md).
 
 <table>
 <tr><th colspan="2"><a href="examples/scopefence/">ScopeFence</a> · 7 · 3 exploration + 4 product</th></tr>
@@ -93,7 +93,7 @@ The [example catalog](examples/README.md) contains 22 independently runnable pub
 
 The examples cover professional data review, image delivery, shared meals, travel pacing and family creation. Published copies preserve the original product direction while refining components and repairing real interactions; original reports and unsuccessful conclusions are not rewritten for the showcase.
 
-Frontend work now uses a task-led design skill adapted from Anthropic. In a [three-product prompt comparison](presentation/frontend-study/README.md), the retained instructions won two pairs and tied one, with all 12 shared desktop/mobile scenarios passing.
+Frontend work uses a task-led skill adapted from Anthropic, distinguishing targeted refinement from an explicitly requested redesign. See [three-product redesign captures and acceptance](presentation/frontend-redesign/README.md) and the [corrected earlier refinement study](presentation/frontend-study/README.md), which now includes a read-boundary audit. These small, non-blind case studies do not establish universal prompt superiority.
 
 ## Where To Start (By Platform)
 
```

**File**: `acceptance/2026-10-02-frontend-redesign/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+*
+!.gitignore
```

**File**: `dashboard/app.js` (modified, +42/-6)
```diff
@@ -262,12 +262,23 @@
     if ((!cycle.active && cycle.durationReliable === false) || cycle.status === 'interrupted') { row.title = message('recoveredEnd'); row.append(element('span', '', message('durationUnknown'))); }
     return row;
   }
-  function bindDisclosure(details, key) {
+  function bindDisclosure(details, key, defaultOpen = false) {
     details.dataset.disclosureKey = key;
+    const preferenceKey = key === 'product-media' ? `journal:product-media:${scope.entryId || state.data?.productMedia?.productId || ''}` : null;
+    const initializationKey = preferenceKey || key;
+    if (!state.disclosureInitialized) state.disclosureInitialized = new Set();
+    if (!state.disclosureInitialized.has(initializationKey)) {
+      state.disclosureInitialized.add(initializationKey);
+      let open = defaultOpen;
+      try { if (preferenceKey && sessionStorage.getItem(preferenceKey) !== null) open = sessionStorage.getItem(preferenceKey) === 'open'; } catch (_) {}
+      if (open) state.expanded.add(key);
+      else if (preferenceKey) state.expanded.delete(key);
+    }
     details.open = state.expanded.has(key);
     details.addEventListener('toggle', () => {
       if (details.open) state.expanded.add(key);
       else state.expanded.delete(key);
+      try { if (preferenceKey) sessionStorage.setItem(preferenceKey, details.open ? 'open' : 'closed'); } catch (_) {}
     });
     return details;
   }
@@ -728,12 +739,18 @@
     if (reference?.state === 'preserved') return 'iconReferencePreserved';
     return reference && !['inserted', 'linked', 'not_applicable'].includes(reference.state) ? 'iconReferenceUnconfirmed' : null;
   }
+  function publishedRefinement(media) {
+    return readOnly() && media?.publishedRefinement?.language === state.language ? media.publishedRefinement : null;
+  }
   function renderProductMedia(media) {
     if (!media?.productId) return null;
-    const section = readOnly() ? bindDisclosure(element('details', 'sidebar-block product-media'), 'product-media') : element('section', 'sidebar-block product-media');
+    const section = readOnly() ? bindDisclosure(element('details', 'sidebar-block product-media'), 'product-media', true) : element('section', 'sidebar-block product-media');
     section.append(element(readOnly() ? 'summary' : 'h2', '', message('productScreenshot')));
     const capture = media.screenshot || {};
-    const success = capture.latestSuccess;
+    const original = capture.latestSuccess;
+    const refinement = publishedRefinement(media);
+    const success = refinement || original;
+    if (refinement) section.append(element('p', 'sidebar-note refinement-label', message('publishedRefinement')));
     const variants = (success?.variants || []).filter((item) => mediaURL(item.href, media.productId));
     const desktop = variants.find((item) => item.viewport === 'desktop') || variants[0];
     if (desktop) {
@@ -751,9 +768,18 @@
       image.addEventListener('error', () => {
         link.replaceWith(element('p', 'sidebar-note status-failed', message('screenshotResourceUnavailable')));
       }, { once: true });
-      link.append(image); section.append(link);
-      const caption = element('p', 'sidebar-note screenshot-caption', message('capturedAt', { time: formatTime(success.capturedAt, true) }));
-      if (capture.currentVersion && success.version !== capture.currentVersion) caption.append(element('span', 'screenshot-stale', message('screenshotOldVersion')));
+      if (refinement) {
+        const mobile = variants.find((item) => item.viewport === 'mobile');
+        const picture = element('picture');
+        if (mobile) {
+          const source = element('source'); source.media = '(max-width: 760px)'; source.srcset = mediaURL(mobile.href, media.productId);
+          source.width = mobile.width; source.height = mobile.height; picture.append(source);
+        }
+        picture.append(image); link.append(picture);
+      } else link.append(image);
+      section.append(link);
+      const caption = element('p', 'sidebar-note screenshot-caption', message(refinement && !refinement.capturedAt ? 'captureSessionAt' : 'capturedAt', { time: formatTime(success.capturedAt || success.captureSessionAt, true) }));
+      if (!refinement && capture.currentVersion && success.version !== capture.currentVersion) caption.append(element('span', 'screenshot-stale', message('screenshotOldVersion')));
       section.append(caption);
       const links = element('div', 'screenshot-links');
       for (const variant of variants) {
@@ -762,6 +788,16 @@
         links.append(item);
       }
       section.append(links);
+      if (refinement && original) {
+        const originals = element('div', 'screenshot-links original-screenshot-links');
+        for (const variant of original.variants || []) {
+          const href = mediaURL(variant.href, media.productId);
+          if (!href) continue;
+          const item = element('a', '', message(variant.viewport === 'mobile' ? 'or
```

---

### Incident Patch 2: `1037a4ba` (2026-10-01)
**Commit Message**: Publish refined examples, bilingual showcases and measured frontend guidance (#41)

* feat: publish refined examples and bilingual recorded showcases

* feat: adopt measured frontend guidance and publish comparison

* fix: preserve P1 observation during atomic state refresh

**File**: `.claude/agents/ui-duarte.md` (modified, +11/-11)
```diff
@@ -7,17 +7,17 @@ model: inherit
 # UI Design Agent — Matías Duarte
 
 ## Role
-UI 设计总监，负责视觉设计语言、界面规范和设计系统。
+UI 设计总监，负责从用户任务形成具体视觉方向、组件规范，并核对实现效果。涉及前端时先读取并使用 `.claude/skills/frontend-design.md`；设计决定须能落实到实际页面。
 
 ## Persona
 你是一位深受 Matías Duarte 设计哲学影响的 AI UI 设计师。你的设计思维来自 Material Design 的创造过程——将物理世界的直觉带入数字界面。
 
 ## Core Principles
 
-### Material Metaphor（材质隐喻）
-- UI 元素应该像真实世界的材质一样有物理属性：厚度、阴影、层级
-- 不是拟物化，而是借用物理规律让界面行为可预测
-- 光影和层级传达信息层次，elevation 有语义
+### 清晰的层级
+- 布局与分组表达内容关系，主要任务和结果占据合适空间
+- 仅在需要表达浮层或前后关系时使用阴影与材质效果
+- 同一产品的交互保持可预测，不让组件库预设决定所有产品的外观
 
 ### Bold, Graphic, Intentional（大胆、图形化、有意图）
 - 排版是 UI 的骨架，Typography 优先
@@ -39,11 +39,11 @@ UI 设计总监，负责视觉设计语言、界面规范和设计系统。
 ## Design System Framework
 
 ### 建立设计系统时：
-1. 从 Typography Scale 开始：定义字体、字号、行高的完整层级
+1. 从具体用户任务与内容优先级开始，再定义字体、字号、行高的完整层级
 2. 颜色系统：Primary、Secondary、Surface、Error，每个角色明确
 3. 间距系统：基于 4px/8px 网格，保持一致性
 4. 组件库：从原子组件开始，逐步组合为复杂组件
-5. Elevation 系统：0dp-24dp，每个层级对应不同的语义
+5. 定义关键组件的布局边界、文字折行、焦点、选中、禁用和错误状态；阴影按需要使用
 
 ### 审查 UI 方案时：
 1. 视觉层级是否清晰？用户的眼睛知道先看哪里吗？
@@ -53,14 +53,14 @@ UI 设计总监，负责视觉设计语言、界面规范和设计系统。
 5. 无障碍性：对比度、触摸目标大小、屏幕阅读器兼容
 
 ### 面对设计权衡时：
-1. 一致性 > 创新（除非创新带来 10x 改进）
+1. 同一产品内保持行为一致；不同产品的视觉方向由各自任务和内容决定
 2. 可读性 > 美观
 3. 功能清晰 > 视觉酷炫
-4. 少即是多 — 能删掉的元素就删掉
+4. 删重复解释与装饰性文字；保留必要操作提示及决策相关的隐私、风险和错误信息，不缩成低对比小字
 
 ## 独立开发者特别建议
-- 直接使用成熟的设计系统（Material Design, Tailwind UI）作为基础
-- 不要从零设计，站在巨人的肩膀上
+- 复用现有组件和可靠交互模式；根据产品调整排版、颜色和构图
+- 沿用技术栈，精修不强制迁移框架；已有产品先保留身份与有效结构
 - 一致性比完美更重要
 - 先做好移动端，再扩展到桌面端
 
```

**File**: `.claude/skills/frontend-design.LICENSE.txt` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
+
+                                 Apache License
+                           Version 2.0, January 2004
+                        http://www.apache.org/licenses/
+
+   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
+
+   1. Definitions.
+
+      "License" shall mean the terms and conditions for use, reproduction,
+      and distribution as defined by Sections 1 through 9 of this document.
+
+      "Licensor" shall mean the copyright owner or entity authorized by
+      the copyright owner that is granting the License.
+
+      "Legal Entity" shall mean the union of the acting entity and all
+      other entities that control, are controlled by, or are under common
+      control with that entity. For the purposes of this definition,
+      "control" means (i) the power, direct or indirect, to cause the
+      direction or management of such entity, whether by contract or
+      otherwise, or (ii) ownership of fifty percent (50%) or more of the
+      outstanding shares, or (iii) beneficial ownership of such entity.
+
+      "You" (or "Your") shall mean an individual or Legal Entity
+      exercising permissions granted by this License.
+
+      "Source" form shall mean the preferred form for making modifications,
+      including but not limited to software source code, documentation
+      source, and configuration files.
+
+      "Object" form shall mean any form resulting from mechanical
+      transformation or translation of a Source form, including but
+      not limited to compiled object code, generated documentation,
+      and conversions to other media types.
+
+      "Work" shall mean the work of authorship, whether in Source or
+      Object form, made available under the License, as indicated by a
+      copyright notice that is included in or attached to the work
+      (an example is provided in the Appendix below).
+
+      "Derivative Works" shall mean any work, whether in Source or Object
+      form, that is based on (or derived from) the Work and for which the
+      editorial revisions, annotations, elaborations, or other modifications
+      represent, as a whole, an original work of authorship. For the purposes
+      of this License, Derivative Works shall not include works that remain
+      separable from, or merely link (or bind by name) to the interfaces of,
+      the Work and Derivative Works thereof.
+
+      "Contribution" shall mean any work of authorship, including
+      the original version of the Work and any modifications or additions
+      to that Work or Derivative Works thereof, that is intentionally
+      submitted to Licensor for inclusion in the Work by the copyright owner
+      or by an individual or Legal Entity authorized to submit on behalf of
+      the copyright owner. For the purposes of this definition, "submitted"
+      means any form of electronic, verbal, or written communication sent
+      to the Licensor or its representatives, including but not limited to
+      communication on electronic mailing lists, source code control systems,
+      and issue tracking systems that are managed by, or on behalf of, the
+      Licensor for the purpose of discussing and improving the Work, but
+      excluding communication that is conspicuously marked or otherwise
+      designated in writing by the copyright owner as "Not a Contribution."
+
+      "Contributor" shall mean Licensor and any individual or Legal Entity
+      on behalf of whom a Contribution has been received by Licensor and
+      subsequently incorporated within the Work.
+
+   2. Grant of Copyright License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      copyright license to reproduce, prepare Derivative Works of,
+      publicly display, publicly perform, sublicense, and distribute the
+      Work and such Derivative Works in Source or Object form.
+
+   3. Grant of Patent License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      (except as stated in this section) patent license to make, have made,
+      use, offer to sell, sell, import, and otherwise transfer the Work,
+      where such license applies only to those patent claims licensable
+      by such Contributor that are necessarily infringed by their
+      Contribution(s) alone or by combination of their Contribution(s)
+      with the Work to which such Contribution(s) was submitted. If You
+      institute patent litigation against any entity (including a
+      cross-claim or counterclaim in a lawsuit) alleging that the Work
+      or a Contribution incorporated within the Work constitutes direct
+      or contributory patent infringement, then any patent licenses
+      granted to You under this License for that Work shal
```

**File**: `.claude/skills/frontend-design.md` (modified, +32/-27)
```diff
@@ -1,42 +1,47 @@
 ---
 name: frontend-design
-description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
-license: Complete terms in LICENSE.txt
+description: Design and implement distinctive, usable web interfaces, or refine an existing product's layout, typography, color, components and responsive states. Use for frontend creation and visual refinement, within the requested product scope.
+license: Apache-2.0; see frontend-design.LICENSE.txt
 ---
 
-This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.
+# Frontend Design
 
-The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.
+Create an interface with a deliberate visual identity that helps its specific audience complete a real task. This applies to working software as well as websites. Read the existing product and its task before choosing its visual treatment.
 
-## Design Thinking
+## Establish the direction
 
-Before coding, understand the context and commit to a BOLD aesthetic direction:
-- **Purpose**: What problem does this interface solve? Who uses it?
-- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
-- **Constraints**: Technical requirements (framework, performance, accessibility).
-- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?
+Before implementation, leave a short design brief in the work notes: the user and situation; the primary task and outcome; the content that deserves attention first; and a visual direction supported by that content. Name concrete choices for typography, color roles, layout and the main interactive component. Briefly compare a plausible alternative so the choice is intentional. Keep this brief out of the product interface.
 
-**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.
+- **Refining an existing product:** inspect its current screens, assets and states. Preserve its identity, useful structure, familiar actions and functional scope. Identify what needs to change to improve hierarchy or use; a refinement need not become a redesign.
+- **Creating a new product:** derive the direction from the audience, material and use context. A workbench, a shared activity and a visual collection can need very different compositions. Do not reuse one portfolio-wide palette or page skeleton.
 
-Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
-- Production-grade and functional
-- Visually striking and memorable
-- Cohesive with a clear aesthetic point-of-view
-- Meticulously refined in every detail
+Use the user's chosen stack and existing components. Add a framework or dependency only when the requested behavior requires it. A small HTML/CSS implementation can receive the same design attention as a larger application.
 
-## Frontend Aesthetics Guidelines
+## Make the task visible
 
-Focus on:
-- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
-- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
-- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
-- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
-- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the over
```

**File**: `.claude/skills/team/SKILL.md` (modified, +2/-0)
```diff
@@ -53,6 +53,8 @@ Use the Agent Teams feature to assemble the temporary team:
 - Use the Task tool to spawn each teammate with `subagent_type` set to `general-purpose`; inject the full content of the corresponding agent file into the prompt as its role definition
 - When spawning a teammate, state in the prompt: its role definition, the task to complete, the cycle's runtime `Language` instruction, and that output documents belong under `docs/<role>/`
 
+For frontend work, name one selected member as design owner without expanding the team just for a title. The owner and implementer must read `.claude/skills/frontend-design.md`. Pass the user task, agreed visual direction, key component decisions and acceptance states with the implementation handoff; the owner checks the implemented screens, not only a written design.
+
 ### 3. Coordinate and Consolidate
 
 - Coordinate the members' work as team lead
```

**File**: `.github/CI.md` (modified, +2/-1)
```diff
@@ -8,7 +8,8 @@ Only this aggregate job should be a required status check on `main`.
 | --- | --- |
 | Runtime, configuration, or runtime tests | Windows PowerShell 5.1/7, Python, macOS launchd, Shell syntax, Linux systemd and runtime contracts |
 | Dashboard or its runtime/language dependencies | Dashboard Chromium smoke tests, in addition to applicable runtime checks |
-| A published example under `projects/` | That example's core tests (TableDelta/CueCheck) or type check (SnapOG) |
+| A published example under `examples/` | Showcase catalog and Chromium smoke checks, plus TableDelta/CueCheck core tests for those directories |
+| The preserved legacy `projects/snapog/` | SnapOG type check |
 | CI workflow or routing policy | All checks |
 | Ordinary documentation only | Successful routing and aggregate gate; test jobs explicitly skipped |
 
```

**File**: `.github/workflows/auto-company-runtime-ci.yml` (modified, +6/-6)
```diff
@@ -186,10 +186,6 @@ jobs:
         run: python3 scripts/ci/run.py shell-contracts-6 node tests/test_dashboard_frontend.js
       - name: Verify product center frontend contracts
         run: python3 scripts/ci/run.py center-frontend node tests/test_center_frontend.js
-      - name: Verify published example logic and syntax
-        run: |
-          python3 scripts/ci/run.py showcase-core node --test projects/scopefence/tests/scopefence-core.test.mjs projects/text-meter/tests/counts.test.js
-          python3 scripts/ci/run.py showcase-syntax node --check projects/scope-sheet/app.js
       - name: Save failure evidence
         if: failure()
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
@@ -222,6 +218,10 @@ jobs:
         run: python3 ../../scripts/ci/run.py chromium-install npx playwright install --with-deps chromium
       - name: Test Dashboard with a real browser and isolated server
         run: python3 scripts/ci/run.py dashboard-browser npm test --prefix tests/browser
+      - name: Verify published example logic and syntax
+        run: |
+          python3 scripts/ci/run.py showcase-core node --test examples/scopefence/tests/scopefence-core.test.mjs examples/text-meter/tests/counts.test.js
+          python3 scripts/ci/run.py showcase-syntax node --check examples/scope-sheet/app.js
       - name: Verify automatic product screenshots and process cleanup
         env:
           AUTO_COMPANY_TEST_PRODUCT_MEDIA_BROWSER: '1'
@@ -252,7 +252,7 @@ jobs:
           node-version: '22'
           package-manager-cache: false
       - name: Run existing core tests
-        run: python3 scripts/ci/run.py tabledelta npm test --prefix projects/tabledelta
+        run: python3 scripts/ci/run.py tabledelta npm test --prefix examples/tabledelta
       - name: Save failure evidence
         if: failure()
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
@@ -275,7 +275,7 @@ jobs:
           node-version: '22'
           package-manager-cache: false
       - name: Run existing core tests
-        run: python3 scripts/ci/run.py cuecheck npm test --prefix projects/cuecheck
+        run: python3 scripts/ci/run.py cuecheck npm test --prefix examples/cuecheck
       - name: Save failure evidence
         if: failure()
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
```

**File**: `.gitignore` (modified, +5/-6)
```diff
@@ -158,12 +158,8 @@ projects/*
 !projects/README.md
 !projects/registry.tsv
 
-# Explicitly published product examples; autonomous output stays ignored.
-!projects/tabledelta/
-!projects/cuecheck/
-!projects/scopefence/
-!projects/text-meter/
-!projects/scope-sheet/
+# Human-authorized public snapshots live under examples/. Autonomous output
+# under projects/ stays ignored; the historical tracked SnapOG assets remain.
 
 # Local/private outputs (do not publish)
 AGENTS.md
@@ -195,6 +191,9 @@ CHANGELOG.md
 RELEASE_NOTES.md
 node_modules/
 bin/
+# This public CLI entrypoint is source, not a generated binary directory.
+!examples/payment-recovery-audit/bin/
+!examples/payment-recovery-audit/bin/audit.js
 obj/
 .vs/
 .vscode/
```

**File**: `PROMPT.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
 
 读 `.claude/skills/team/SKILL.md`，按里面的流程组建团队执行任务。每轮选 3-5 个最相关的 agent，不要全部拉上。
 
-如果本轮任务会产出 landing page、dashboard、marketing site、产品 Web UI、应用界面、前端组件，或任何面向用户的前端交付物，必须先读并使用 `.claude/skills/frontend-design.md`，再进入界面设计或代码实现。不要跳过这一步，也不要只做普通样式拼装。
+如果本轮任务会产出 landing page、dashboard、marketing site、产品 Web UI、应用界面、前端组件，或任何面向用户的前端交付物，必须先读并使用 `.claude/skills/frontend-design.md`，再进入界面设计或代码实现。协调器须指定本轮已有成员中的前端设计负责人；负责人与实现者均读取该技能，先确定用户任务、信息层级及具体视觉方向，再实现并检查真实页面。已有产品按既有身份与流程精修，新产品按其内容和使用场景选择方向；不规定统一配色或框架。
 
 ### 4. 更新共识（必须）
 
```

---

### Incident Patch 3: `b6c04eef` (2026-09-27)
**Commit Message**: fix: close product center control and journal review gaps

**File**: `dashboard/app.js` (modified, +123/-10)
```diff
@@ -30,7 +30,7 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   const DEFAULT_HISTORY_LIMIT = 4;
   const productMatch = (globalThis.location?.pathname || '/journal').match(/^\/products\/([^/]+)\/?$/);
   const scope = { center: Boolean(productMatch), entryId: productMatch ? decodeURIComponent(productMatch[1]) : null, token: 0, contextToken: 0, entries: [] };
-  const state = { data: null, language: 'zh-CN', tab: 'work', expanded: new Set(), older: false, selectedLog: scope.center ? '' : 'runtime', logText: '', logLoadedId: '', logRequest: 0, logPending: null, refreshPending: null, signature: '', statusFailed: true, action: '', languageState: null, languageSaving: false, languageLoading: false, languageRevision: 0, languageError: '', languageSaved: false, timer: null, autoChanged: false, currentCycle: null, receivedAt: 0, elapsedTimer: null, centerSummary: null, mediaIntent: null, exploration: { key: '', token: 0, loading: false, loaded: false, failed: false, total: null, cycles: [] } };
+  const state = { data: null, language: 'zh-CN', tab: 'work', expanded: new Set(), older: false, selectedLog: scope.center ? '' : 'runtime', logText: '', logLoadedId: '', logRequest: 0, logPending: null, refreshPending: null, signature: '', statusFailed: true, action: '', languageState: null, languageSaving: false, languageLoading: false, languageRevision: 0, languageError: '', languageSaved: false, timer: null, autoChanged: false, currentCycle: null, receivedAt: 0, elapsedTimer: null, centerSummary: null, scopedUsage: null, usageToken: 0, detailToken: 0, detailLoads: new Map(), mediaIntent: null, exploration: { key: '', token: 0, loading: false, loaded: false, failed: false, total: null, cycles: [] } };
   const message = (key, values = {}) => {
     const dictionary = window.JOURNAL_MESSAGES[state.language] || window.JOURNAL_MESSAGES.en;
     return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), dictionary[key] || key);
@@ -147,6 +147,73 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     try { const url = new URL(value, location.origin); return url.origin === location.origin && url.pathname.startsWith(prefix) ? `${url.pathname}${url.search}` : null; }
     catch (_) { return null; }
   }
+  function safePreviewURL(artifact, data = state.data) {
+    if (!scope.center || artifact?.kind !== 'preview' || artifact.available !== true || typeof artifact.url !== 'string') return null;
+    const productId = data?.project?.stableId || data?.entry?.productId;
+    if (!productId || artifact.productId !== productId) return null;
+    try {
+      const url = new URL(artifact.url);
+      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.origin === location.origin) return null;
+      return url.href;
+    } catch (_) { return null; }
+  }
+  function journalPageMatches(page, expected) {
+    return Boolean(expected?.entryId && expected?.sourceId && Number.isFinite(expected.sourceRevision)) && page?.entryId === expected.entryId && page?.sourceId === expected.sourceId && page?.sourceRevision === expected.sourceRevision && Array.isArray(page.cycles);
+  }
+  async function fetchFullScopedJournal() {
+    const first = await fetchCenter(`${scopedJournalPath('/journal')}?limit=100`);
+    const expected = { entryId: scope.entryId, sourceId: first?.sourceId, sourceRevision: first?.sourceRevision };
+    if (!journalPageMatches(first, expected)) throw new Error('Invalid scoped journal page');
+    const cycles = [...first.cycles]; const seenCursors = new Set(); const seenCycles = new Set(cycles.map((cycle) => cycle.id));
+    let cursor = first.nextBefore;
+    while (cursor) {
+      if (seenCursors.has(cursor)) throw new Error('Repeated journal cursor');
+      seenCursors.add(cursor);
+      const page = await fetchCenter(`${scopedJournalPath('/journal')}?limit=100&before=${encodeURIComponent(cursor)}&sourceId=${encodeURIComponent(expected.sourceId)}`);
+      if (!journalPageMatches(page, expected)) throw new Error('Journal source changed');
+      for (const cycle of page.cycles) {
+        if (seenCycles.has(cycle.id)) throw new Error('Repeated journal cycle');
+        seenCycles.add(cycle.id); cycles.push(cycle);
+      }
+      cursor = page.nextBefore;
+    }
+    if (Number.isFinite(first.total) && cycles.length !== first.total) throw new Error('Incomplete journal history');
+    return { ...first, cycles, nextBefore: null };
+  }
+  function usageSelection() {
+    const period = $('usagePeriod').value;
+    return { period, date: period === 'all' ? '' : $('usageDate').value };
+  }
+  function usageKey(selection, data = state.data) { return JSON.stringify([data?.entryId, data?.sourceId, data?.sourceRevision, selection.period, selection.date]); }
+  function expectedUsageRange(selection) {
+    if (selection.period === 'all') return { startDate: null, endDate: null };
+    if (!/^\
```

**File**: `dashboard/center-i18n.js` (modified, +6/-6)
```diff
@@ -28,7 +28,7 @@ window.CENTER_MESSAGES = {
     phase_planning: "梳理方案", phase_implementing: "执行任务", phase_validating: "检查验证", phase_blocked: "遇到阻塞", phase_review: "提交验收",
     currentCycle: "当前第 {number} 轮", startedAt: "{time} 开始", queuePosition: "队列第 {position} 位", queuedCount: "{count} 项等待执行",
     attentionCount: "{count} 项需要处理", queueEmpty: "队列中没有工作请求。", runningSection: "正在执行", queuedSection: "等待执行 · {count}",
-    attentionSection: "需要处理 · {count}", historySection: "历史请求", stopItem: "停止此项", cancelItem: "取消", moveUp: "上移",
+    attentionSection: "需要处理 · {count}", historySection: "历史请求", preparingSection: "正在准备 · {count}", preparationAttentionSection: "准备失败或需处理 · {count}", preparationHistorySection: "准备历史 · {count}", stopItem: "停止此项", cancelItem: "取消", moveUp: "上移",
     moveDown: "下移", reconcile: "核对状态", plannedConfig: "计划：{model} · {effort}", languageConfig: "产品语言：{language}",
     requestCreated: "工作请求已保存。", explorationPrepared: "探索准备请求已保存；准备完成后才可执行。", actionAccepted: "操作已接受，状态将继续更新。",
     requestFailed: "操作未完成：{detail}", actionPending: "正在提交…", queueChanged: "队列顺序已更新。", preferencesSaved: "设置已保存。",
@@ -40,11 +40,11 @@ window.CENTER_MESSAGES = {
     readOnlySource: "来源为只读", contextUnavailable: "无法核对继续工作所需的产品身份或运行记录。请先恢复来源状态。", productRegistrationInvalid: "产品登记与当前源码不一致。请恢复或重新连接登记后再继续。", unresolvedP1: "有未解决的 P1 问题，等待人工决定后继续。", runtimeIncompatible: "运行环境不兼容", slotBusy: "执行槽正被占用",
     dispatchUncertain: "启动状态需要核对", stopUnconfirmed: "停止尚未确认", governancePaused: "治理保护已暂停执行", budgetPaused: "预算保护已暂停执行",
     revisionConflict: "记录已发生变化，请重新读取后再操作。", cursorExpired: "列表已更新，请重新读取。", unsupported: "当前来源不支持此操作",
-    openRequestExists: "此项已有未结束的工作请求。", productLanguageLocked: "已有产品的语言已经锁定，不能由中心改写。", recoveryRequired: "存在未确认的归属或操作，需要先核对恢复。", invalidConfig: "工作配置无效。",
+    openRequestExists: "此项已有未结束的工作请求。", productLanguageLocked: "已有产品的语言已经锁定，不能由中心改写。", recoveryRequired: "存在未确认的归属或操作，需要先核对恢复。", invalidConfig: "工作配置无效。", frameworkUnverified: "无法核验产品中心框架来源。", preparationFailed: "探索准备失败，请核对后重试。",
     unknownError: "未知错误", language_zh: "简体中文", language_en: "English", notRecorded: "未记录", noAttention: "没有需要处理的请求。",
     showHistory: "显示历史", hideHistory: "收起历史", queueOrderHint: "当前工作结束后依次执行", observedStale: "上次成功读取于 {time}",
     archiveSuccess: "产品已归档。", restoreSuccess: "产品已恢复。", detachReferenceSuccess: "参考源码已从中心移除。", detachEntrySuccess: "来源登记已从中心移除。", preparing: "正在准备", fieldMissing: "尚未记录", warningsCount: "{count} 项说明",
-    attentionReason: "原因：{reason}", requestedStop: "已按请求停止", requestedCancel: "等待请求已取消", operationPending: "准备操作已创建", invalidResponse: "服务返回了无法识别的数据。", openQueue: "打开工作队列",
+    attentionReason: "原因：{reason}", requestedStop: "已按请求停止", requestedCancel: "等待请求已取消", operationPending: "准备操作已创建", preparationItem: "新探索准备", preparationSucceeded: "准备完成", recheckPreparation: "重新核对", createdAt: "创建于 {time}", invalidResponse: "服务返回了无法识别的数据。", openQueue: "打开工作队列",
     archivedProduct: "已归档产品", exploreList: "尚未立项的探索", filterExploration: "探索", viewReferences: "查看参考源码", filterReference: "参考源码",
     connectionType: "登记方式", readOnlyProduct: "只读产品档案", readOnlyProductHint: "保留已有产品身份与工作记录，不自动接管执行。", referenceOnly: "仅参考源码", referenceOnlyHint: "只登记源码与 README 摘要，不计入产品，也不可执行。",
     sourceList: "已登记来源", sourceNumber: "来源 {number}", currentSource: "当前来源", sourceProject: "项目 {project}", sourceProjectLabel: "项目", sourceIdShort: "ID …{id}", sourceDetails: "来源详情", sourceLocation: "登记位置", sourceIdentifier: "来源 ID", sourceLastVerified: "最近核验", selectSource: "设为当前来源", reconnectSource: "重新连接目录", reconnectPath: "新的本机目录", reconnectHint: "先只读检查新目录，身份与已有记录一致后再连接。", takeover: "由中心接管", release: "解除中心接管", previewStart: "启动预览", previewStop: "停止预览", captureMedia: "更新产品媒体", detachEntry: "从中心移除", sourceSelected: "当前来源已更新。", sourceReconnected: "来源已重新连接。", managementComplete: "操作已完成。", operationAttention: "操作需要处理：{reason}", selectCurrentFirst: "请先把该来源设为当前来源。", noSources: "没有可用来源。", registeredDocuments: "登记文档", unmanagedSource: "尚未由产品中心管理", sourceUnavailableReason: "来源当前不可用", releaseFirst: "请先解除中心接管。", operationInProgress: "操作进行中…", queuePausedOnRestart: "中心重启后队列默认暂停。"
@@ -78,7 +78,7 @@ window.CENTER_MESSAGES = {
     phase_planning: "Planning", phase_implementing: "Implementing", phase_validating: "Validating", phase_blocked: "Blocked", phase_review: "Review",
     currentCycle: "Current cycle {number}", startedAt: "Started {time}", queuePosition: "Queue position {position}", queuedCount: "{count} waiting",
     attentionCount: "{count} need attention", queueEmpty: "There are no work requests in the queue.", runningSection: "Running", queuedSection: "Waiting · {count}",
-    attentionSection: "Needs attention · {count}", historySection: "Request history", stopItem: "Stop this item", cancelItem: "Cancel", moveUp: "Move up",
+    attentionSection: "Needs attention · {count}", historySection: "Request history", preparingSection: "Preparing · {count}", preparationAttentionSection: "Preparation needs attention · {count}", preparationHistorySection: "P
```

**File**: `dashboard/center.js` (modified, +78/-24)
```diff
@@ -7,7 +7,7 @@
   const TERMINAL_STATES = new Set(["ended", "failed", "canceled"]);
   const state = {
     language: "zh-CN", revision: null, centerId: null, observedAt: null,
-    summary: null, entries: [], requests: [], preferences: null,
+    summary: null, entries: [], requests: [], operations: [], preferences: null,
     query: "", filter: "all", loading: true, stale: false, refreshing: null,
     refreshToken: 0, timer: null, menuEntryId: null, historyVisible: false,
     activeEntry: null, managementEntry: null, selectedSourceId: null, sourceToken: 0, probe: null, confirmAction: null, drawerOpen: false, pendingWrites: new Map(), projectionSignature: "", projectionTimer: null,
@@ -28,6 +28,16 @@
   function clear(node) { node.replaceChildren(); return node; }
   function text(value) { return typeof value === "string" ? value.trim() : ""; }
   function knownNumber(value) { return Number.isFinite(value) && value >= 0; }
+  function focusKey(node, value) { node.dataset.focusKey = value; return node; }
+  function rememberFocus() {
+    const active = document.activeElement;
+    return active && active !== document.body ? text(active.dataset?.focusKey) : "";
+  }
+  function restoreFocus(key) {
+    if (!key) return;
+    const node = [...document.querySelectorAll("[data-focus-key]")].find((item) => item.dataset.focusKey === key);
+    if (node && !node.disabled) node.focus({ preventScroll: true });
+  }
   function idempotencyKey() { return globalThis.crypto?.randomUUID?.() || `center-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
 
   class APIError extends Error {
@@ -149,7 +159,7 @@
 
   function capabilityReason(reason, fallback = "capabilityUnavailable") {
     if (!reason) return message(fallback);
-    const known = { unmanaged_source: "unmanagedSource", read_only_source: "readOnlySource", execution_domain_unconfigured: "executionUnavailable", runtime_incompatible: "runtimeIncompatible", slot_busy: "slotBusy", open_request_exists: "openRequestExists", source_unavailable: "sourceUnavailableReason", entry_archived: "archiveBlocked", product_registration_invalid: "productRegistrationInvalid", context_unavailable: "contextUnavailable", governance_pause: "governancePaused", budget_pause: "budgetPaused", stop_unconfirmed: "stopUnconfirmed", unresolved_p1: "unresolvedP1" };
+    const known = { unmanaged_source: "unmanagedSource", read_only_source: "readOnlySource", execution_domain_unconfigured: "executionUnavailable", runtime_incompatible: "runtimeIncompatible", slot_busy: "slotBusy", open_request_exists: "openRequestExists", source_unavailable: "sourceUnavailableReason", entry_archived: "archiveBlocked", product_registration_invalid: "productRegistrationInvalid", context_unavailable: "contextUnavailable", governance_pause: "governancePaused", budget_pause: "budgetPaused", stop_unconfirmed: "stopUnconfirmed", unresolved_p1: "unresolvedP1", framework_unverified: "frameworkUnverified", preparation_failed: "preparationFailed" };
     if (window.CENTER_MESSAGES[state.language][reason]) return message(reason);
     const key = known[reason] || known[String(reason).toLowerCase()];
     return key ? message(key) : errorText({ code: reason });
@@ -159,7 +169,7 @@
     const value = text(reason);
     if (value === "user_stop") return message("requestedStop");
     if (value === "user_cancel") return message("requestedCancel");
-    return /^(?:PRODUCT_REGISTRATION_INVALID|CONTEXT_UNAVAILABLE|GOVERNANCE_PAUSE|BUDGET_PAUSE|STOP_UNCONFIRMED|UNRESOLVED_P1)$/i.test(value) ? capabilityReason(value) : value || message("unknownError");
+    return /^(?:PRODUCT_REGISTRATION_INVALID|CONTEXT_UNAVAILABLE|GOVERNANCE_PAUSE|BUDGET_PAUSE|STOP_UNCONFIRMED|UNRESOLVED_P1|FRAMEWORK_UNVERIFIED|PREPARATION_FAILED)$/i.test(value) ? capabilityReason(value) : value || message("unknownError");
   }
 
   async function allEntries() {
@@ -283,28 +293,28 @@
     if (entry.lastActivityAt) { activity.dateTime = entry.lastActivityAt; activity.title = formatTime(entry.lastActivityAt); }
 
     const actions = element("div", "row-actions"); actions.setAttribute("role", "cell");
-    if (entry.kind !== "reference") { const view = element("a", "", message("view")); view.href = detailURL(entry); actions.append(view); }
+    if (entry.kind !== "reference") { const view = focusKey(element("a", "", message("view")), `entry:${entry.entryId}:view`); view.href = detailURL(entry); actions.append(view); }
     const execute = capability(entry, "execute");
     if (execute.enabled && !entry.archived && ["product", "exploration"].includes(entry.kind)) {
-      const continueButton = element("button", "text-button continue-inline", message("continue")); continueButton.type = "button";
+      const continueButton = focusKey(element("button", "text-button continue-inline", message("continue")), `entry:${entry.entryId}:continue-inline`); continueButton.type = "button";
       continueButton.addEventListener("click", () => openContinue(entry)); ac
```

**File**: `dashboard/center_catalog.py` (modified, +19/-13)
```diff
@@ -442,18 +442,27 @@ def journal(self, entry_id, query=None):
                     available = False
                 data['artifacts'].append({**item, 'kind': 'document', 'available': available,
                                           'url': base + item['id'] + '?sourceId=' + quote(source['sourceId']) if available else None})
-        for row in data['cycles']:
-            row['logUrl'] = base + 'log-' + quote(row['id']) + '?sourceId=' + quote(source['sourceId']) if row.get('logAvailable') else None
-        for item in data['artifacts']:
-            if item.get('id') and not item['id'].startswith('reference-'):
-                item['url'] = base + 'artifact-' + quote(item['id']) + '?sourceId=' + quote(source['sourceId'])
+        self._journal_links(entry_id, source['sourceId'], data['cycles'], data['artifacts'])
         media = data.get('productMedia') or {}
         images = [media.get('icon'), *((media.get('screenshot') or {}).get('latestSuccess') or {}).get('variants', [])]
         for item in images:
             if item and item.get('name'):
                 item['href'] = base + 'media-' + quote(item['name']) + '?sourceId=' + quote(source['sourceId'])
         return data
 
+    def _journal_links(self, entry_id, source_id, cycles, artifacts):
+        base = '/api/center/v1/entries/' + quote(entry_id) + '/resources/'
+        suffix = '?sourceId=' + quote(source_id)
+        items = list(artifacts)
+        for row in cycles:
+            row['logUrl'] = base + 'log-' + quote(row['id']) + suffix if row.get('logAvailable') else None
+            items.extend(row.get('artifacts', []))
+        for item in items:
+            # Preview URLs already passed product ownership and token health
+            # checks. Keep their separate origin; they are not document paths.
+            if item.get('kind') != 'preview' and item.get('id') and not item['id'].startswith('reference-'):
+                item['url'] = base + 'artifact-' + quote(item['id']) + suffix
+
     def usage(self, entry_id, query=None):
         query = query or {}
         entry, source, reader = self.resolve_source(entry_id, query.get('sourceId'))
@@ -499,15 +508,11 @@ def record(self, entry_id, record_id, source_id=None):
         entry, source, reader = self.resolve_source(entry_id, source_id)
         if not isinstance(record_id, str) or not CYCLE_ID.fullmatch(record_id):
             raise CenterError('RECORD_NOT_FOUND', 'Record is unavailable.', 404)
-        row = next((row for row in reader.snapshot()['cycles'] if row['id'] == record_id), None)
+        row = next((row for row in reader.snapshot(detail_cycle_id=record_id)['cycles'] if row['id'] == record_id), None)
         if not row:
             raise CenterError('RECORD_NOT_FOUND', 'Record does not belong to this entry.', 404)
-        if row.get('detailStatus') == 'limited':
-            from cycle_reports import read_report
-            from observability_data import cycle_events
-            row.update(read_report(reader, row))
-            row.update(cycle_events(reader, row))
-            row['detailStatus'] = 'recorded'
+        self._journal_links(entry_id, source['sourceId'], [row], [])
+        row.update(entryId=entry_id, sourceId=source['sourceId'], sourceRevision=source['sourceRevision'])
         return row
 
     def resource(self, entry_id, resource_id, source_id=None):
@@ -529,7 +534,8 @@ def resource(self, entry_id, resource_id, source_id=None):
             return raw.encode('utf-8'), 'text/plain; charset=utf-8'
         if resource_id.startswith('artifact-'):
             artifact_id = resource_id[9:]
-            item = next((item for item in reader.documents() if item.get('id') == artifact_id and item.get('available')), None)
+            item = next((item for item in reader.documents() if item.get('id') == artifact_id
+                         and item.get('kind') != 'preview' and item.get('available')), None)
             if item and item.get('path'):
                 raw, truncated = reader.document(item['path'])
                 return raw.encode('utf-8'), 'text/plain; charset=utf-8'
```

**File**: `dashboard/center_runtime.py` (modified, +44/-8)
```diff
@@ -215,10 +215,7 @@ def __init__(self, store, catalog, framework_root, execution_domain=None, *, ada
                 language = system_language(os.environ)
                 tx.put("preferences", "main", {"language": language, "productLanguage": language, "engine": "codex", "model": "", "effort": "high", "revision": 1})
             # A single-item authorization also expires at a center restart.
-            for request in tx.list("requests"):
-                if request["state"] == "queued" and request.get("startAuthorized"):
-                    request["startAuthorized"] = False
-                    tx.put("requests", request["requestId"], request)
+            self._revoke_start_authorizations(tx)
             for operation in tx.list("operations"):
                 if operation.get("state") in {"preparing", "running"}:
                     operation.update(state="attention", reason="recovery_required")
@@ -313,7 +310,20 @@ def _transition(self, tx, request, state, actor, reason=None, body=None, **field
         self._event(tx, request, old, actor, reason, body)
         return request
 
+    @staticmethod
+    def _revoke_start_authorizations(tx):
+        for request in tx.list("requests"):
+            if request["state"] == "queued" and request.get("startAuthorized"):
+                request.update(startAuthorized=False, revision=request["revision"] + 1)
+                tx.put("requests", request["requestId"], request)
+        for operation in tx.list("operations"):
+            if (operation.get("kind") == "exploration" and operation.get("state") in {"preparing", "attention"}
+                    and operation.get("input", {}).get("executionMode") == "start_now" and not operation.get("authorizationRevoked")):
+                operation.update(authorizationRevoked=True, revision=operation["revision"] + 1)
+                tx.put("operations", operation["operationId"], operation)
+
     def _pause(self, tx, reason):
+        self._revoke_start_authorizations(tx)
         queue = tx.get("controls", "queue")
         if queue.get("dispatchEnabled") or queue.get("reason") != reason:
             queue.update(dispatchEnabled=False, reason=reason, revision=queue["revision"] + 1)
@@ -323,11 +333,14 @@ def summary(self):
         with self.store.transaction() as tx:
             requests, queue = tx.list("requests"), tx.get("controls", "queue")
             entries = [entry for entry in tx.list("entries") if not entry.get("detached")]
+            preparations = [row for row in tx.list("operations") if row.get("kind") == "exploration"]
             current = next((request for request in requests if request["state"] in ACTIVE and request.get("dispatchId")), None)
             current = self._request_view(tx, current) if current else None
             return {"dispatchEnabled": queue["dispatchEnabled"], "queueRevision": queue["revision"], "currentRequest": current,
                     "queuedCount": sum(row["state"] == "queued" for row in requests),
-                    "attentionCount": sum(row["state"] == "attention" for row in requests),
+                    "attentionCount": sum(row["state"] == "attention" for row in requests)
+                                      + sum(row["state"] in {"failed", "attention"} for row in preparations),
+                    "preparationCount": sum(row["state"] == "preparing" for row in preparations),
                     "counts": {kind: sum(row.get("kind") == kind for row in entries) for kind in ("product", "exploration", "legacy", "reference")},
                     "language": tx.get("preferences", "main")["language"], "executionDomain": self.domain,
                     "executionAvailable": self.adapter.available, "dispatchReason": queue.get("reason")}
@@ -564,6 +577,7 @@ def queue_action(self, action, body):
                         raise CenterError("RECOVERY_REQUIRED", "Resolve outstanding ownership or operation issues first", 409)
                     queue.update(dispatchEnabled=True, reason=None)
                 elif action in {"pause", "stop-all"}:
+                    self._revoke_start_authorizations(tx)
                     queue.update(dispatchEnabled=False, reason="user_pause" if action == "pause" else "stop_all")
                     if action == "stop-all":
                         self._stop_media_tx(tx)
@@ -612,6 +626,22 @@ def preferences(self, body=None):
             self._remember(tx, key, body_hash, candidate)
             return candidate
 
+    def list_operations(self, query=None):
+        query = query or {}
+        with self.store.transaction() as tx:
+            operations = [row for row in tx.list("operations") if row.get("kind") == "exploration"]
+            if query.get("state"):
+                operations = [row for row in operations if row["state"] == query["state"]]
+            operations.sort(key=lambda row: (row["createdAt"], row["operationId"]), reverse=True)
+            items = []
+            for operation in operatio
```

**File**: `dashboard/center_server.py` (modified, +2/-0)
```diff
@@ -221,6 +221,8 @@ def get_api(self, route, query):
             self.result(result)
         elif route == "/requests":
             self.result(runtime.list_requests(query))
+        elif route == "/operations":
+            self.result(runtime.list_operations(query))
         elif route == "/preferences":
             self.result(runtime.preferences())
         elif match := re.fullmatch(rf"/requests/({IDENTIFIER})", route):
```

**File**: `dashboard/journal_data.py` (modified, +14/-4)
```diff
@@ -286,8 +286,11 @@ def documents(self, registered: list[dict[str, Any]] | None = None) -> list[dict
         registered = registered_artifacts(self) if registered is None else registered
         if self.scope:
             allowed = self.scoped_cycle_ids()
-            return [item for item in registered if item.get("associationStatus") == "bound"
-                    and (allowed is None or item.get("cycleId") in allowed)]
+            return [item for item in registered
+                    if (item.get("associationStatus") == "bound"
+                        and (allowed is None or item.get("cycleId") in allowed))
+                    or (item.get("kind") == "preview" and item.get("associationStatus") == "product"
+                        and self.scope.product_id and item.get("productId") == self.scope.product_id)]
         # Root DELIVERY.md was the legacy archive convention. Once a product is
         # explicitly selected, only identity-bound runner records may surface.
         if self.project()["id"]:
@@ -517,7 +520,8 @@ def log_tail(self, lines: int = 180) -> str:
             return ""
 
     def snapshot(self, *, status: dict[str, Any] | None = None,
-                 language_state: dict[str, Any] | None = None) -> dict[str, Any]:
+                 language_state: dict[str, Any] | None = None,
+                 detail_cycle_id: str | None = None) -> dict[str, Any]:
         generated = datetime.now(timezone.utc)
         generated_at = generated.isoformat()
         records, warnings = self.ledger()
@@ -625,7 +629,11 @@ def snapshot(self, *, status: dict[str, Any] | None = None,
             current = next((cycle for cycle in cycles if cycle["id"] == runtime["currentCycleId"]), None)
             if current:
                 runtime["currentCycleNumber"] = current["number"]
-        for cycle in cycles[:30]:
+        # On-demand history uses the same identity and artifact checks as the
+        # initial detail window, before limited rows receive placeholder data.
+        for index, cycle in enumerate(cycles):
+            if index >= 30 and cycle["id"] != detail_cycle_id:
+                continue
             cycle["detailStatus"] = "recorded"
             cycle.update(read_report(self, cycle))
             cycle.update(cycle_events(self, cycle))
@@ -684,6 +692,8 @@ def snapshot(self, *, status: dict[str, Any] | None = None,
         if len(cycles) > 30:
             warnings.append("cycle_details_truncated")
         for cycle in cycles[30:]:
+            if cycle["id"] == detail_cycle_id:
+                continue
             recorded_project = cycle.get("projectId")
             cycle.update({"detailStatus": "limited", "projectIdentity": {
                               "project": recorded_project, "status": "recorded" if recorded_project else "not_loaded",
```

**File**: `docs/product-center.md` (modified, +16/-0)
```diff
@@ -52,10 +52,22 @@ Windows需要明确的WSL发行版与用户才能运行任务；未配置时仍
 
 一次请求持续占用执行位置直到整个循环停止并清理完成，不会在每轮结束时自动切换产品。队列不设置隐含的轮数上限或商业完成条件。重启默认暂停派发；无法确认的启动或停止需要核对，不自动重放。已有预算和人类约束保护继续生效。
 
+Pause and Stop all also revoke earlier Start now authorizations that have not launched, including work still being prepared. Preparation may finish, but it cannot silently restore that authorization. An owned request in an attention state keeps its Stop action; an unlaunched request does not claim a process to stop.
+
+暂停队列和全部停止也会撤销尚未启动的“立即开始”授权，包括仍在准备中的工作。准备过程可以完成，但不会重新获得旧启动授权。已经拥有执行进程的待核对请求仍提供停止操作，未启动的请求不会被当作运行中进程。
+
+The direction for new work can be left empty for autonomous exploration. Preparation and any preparation failure remain visible in the queue after a page reload, separately from model execution requests. Checking that record does not retry or start a model.
+
+新建工作的方向可以留空，由原流程自主探索。准备状态和准备失败原因会保留在队列中，重新打开页面仍可查看，并与模型执行请求区分。核对准备记录不会重试或启动模型。
+
 An unresolved P1 in the original consensus prevents a new start. If the original guard pauses a loop that is already alive, the center shows a protection pause while retaining that request's slot and Stop action. It does not clear P1, resolve the decision or stop the loop automatically. Expired live observations become unknown.
 
 原共识中存在未解决的 P1 时，中心拒绝新启动。如果原保护规则让已启动的循环暂停，中心显示保护暂停，但该请求仍持有执行位置，停止按钮仍可用。中心不会清除 P1、代做决定或自动停止循环；实时证据过期后显示未知。
 
+A live unresolved-P1 observation also pauses subsequent queue dispatch. Stopping the current request does not resume that queue; resuming dispatch remains an explicit operator action.
+
+运行中观察到未解决的 P1 时，后续队列派发也会暂停。停止当前请求不会恢复队列，恢复派发仍需明确操作。
+
 ## Existing data and capabilities / 旧数据与能力
 
 An imported archive stays read-only until a compatible, unambiguous runtime is explicitly taken over. A run directory that contains several historical products does not necessarily contain independent resumable contexts for each. Missing, conflicting or unsupported sources cannot execute. The center does not merge diverged ledgers or infer old consensus from the newest report.
@@ -74,6 +86,10 @@ Reported titles, summaries and phases remain model-authored records. The center
 
 标题、摘要和阶段仍是模型填写的结构化记录；程序直接解析，不加第二个AI解释器。检查、实拍与进程结果各有适用范围，不等于产品已完成或商业化成功。缺失用量保持未知。
 
+The journal initially shows the latest round and four earlier rows. Earlier history remains accessible, and retained details load when an older round is opened. Usage covers the selected product and period independently of which history rows are expanded. Verified previews open on their own loopback origin, separately from read-only document resources.
+
+工作记录默认显示最新一轮和此前四轮，更早记录仍可展开查看；打开较早轮次时会读取其保留的详细记录。用量按所选产品和时间范围汇总，不受当前展开的轮次影响。核验后的产品预览使用独立本地地址打开，与只读文档资源分开。
+
 Product language is attributed from program-recorded configuration for an actual product cycle. Older archives without that evidence remain unknown, even if their current root language preference is available. Changing the center language translates interface labels, not recorded reports or product pages.
 
 产品语言取自实际产品轮次的程序配置记录；旧档案没有该证据时保持未知，不能拿当前根目录语言偏好倒推历史。切换中心语言只翻译界面固定文案，不改写历史汇报或产品页面。
```

---

### Incident Patch 4: `e3a12358` (2026-09-26)
**Commit Message**: Refresh read-only center views and expire rendered runtime evidence

**File**: `dashboard/app.js` (modified, +45/-16)
```diff
@@ -56,14 +56,19 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   function readOnly() { return state.data?.readOnly !== false; }
   function centerModeKey() { return state.data?.entry?.runtimeId ? 'centerManaged' : 'centerArchive'; }
   function liveProcess() { return !readOnly() && !state.statusFailed && state.data?.runtime?.processState === 'running'; }
-  function scopedCenterRuntimeState(data = state.data, summary = state.centerSummary, currentTime = Date.now()) {
+  function freshCenterRequest(summary = state.centerSummary, currentTime = Date.now()) {
     if (!scope.center || state.statusFailed) return null;
-    const entry = data?.entry; const execution = entry?.executionSummary; const request = summary?.currentRequest;
-    if (!entry?.entryId || !request?.liveConfirmedAt || request.entryId !== entry.entryId) return null;
+    const request = summary?.currentRequest;
+    if (!request?.liveConfirmedAt || !['starting', 'running', 'stopping'].includes(request.state)) return null;
     const confirmationAge = currentTime - Date.parse(request.liveConfirmedAt);
     if (!Number.isFinite(confirmationAge) || confirmationAge < 0 || confirmationAge > 15000) return null;
+    return request;
+  }
+  function scopedCenterRuntimeState(data = state.data, summary = state.centerSummary, currentTime = Date.now()) {
+    const entry = data?.entry; const execution = entry?.executionSummary; const request = freshCenterRequest(summary, currentTime);
+    if (!entry?.entryId || !request || request.entryId !== entry.entryId) return null;
     if (!execution?.requestId || execution.requestId !== request.requestId || execution.state !== request.state) return null;
-    return ['starting', 'running', 'stopping'].includes(request.state) ? request.state : null;
+    return request.state;
   }
   function runtimeStateValue() {
     const centerState = scopedCenterRuntimeState();
@@ -75,9 +80,17 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     const plan = [request?.config?.model, request?.config?.effort].filter(Boolean).join(' · ');
     return plan ? `${name} · ${plan}` : request?.sourceId ? `${name} · …${String(request.sourceId).slice(-8)}` : name;
   }
-  function renderCenterRuntimeContext(summary) {
-    const active = summary?.currentRequest;
-    const value = !active ? '' : active.entryId === scope.entryId ? message('viewingRunningProduct') : message('otherProductRunning', { name: requestContextLabel(active) });
+  function centerRuntimeContextValue(summary = state.centerSummary, currentTime = Date.now()) {
+    const active = freshCenterRequest(summary, currentTime);
+    if (!active) return '';
+    if (active.entryId === scope.entryId) {
+      const scopedState = scopedCenterRuntimeState(state.data, summary, currentTime);
+      return scopedState ? message('currentWorkState', { state: statusLabel(scopedState) }) : '';
+    }
+    return message('otherWorkState', { state: statusLabel(active.state), name: requestContextLabel(active) });
+  }
+  function renderCenterRuntimeContext(summary = state.centerSummary) {
+    const value = centerRuntimeContextValue(summary);
     $('centerRuntimeContext').textContent = value;
     $('centerRuntimeContext').title = value;
   }
@@ -152,6 +165,7 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   }
   function updateElapsed() {
     document.querySelectorAll('.live-elapsed').forEach((node) => { if (node.dataset.cycleId === state.currentCycle?.id) node.textContent = liveDuration(state.currentCycle); });
+    if (scope.center) renderCenterLiveState();
   }
   function cycleTitle(cycle) {
     if (cycle.workReport) return cycle.workReport.title;
@@ -507,13 +521,11 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     const data = state.data;
     const runtime = data?.runtime || {};
     const unavailable = scope.center ? false : state.statusFailed || runtime.available === false;
-    const displayedState = runtimeStateValue();
     const process = runtime.processState || runtime.state;
     const action = state.action || data?.control?.action;
     const retryStop = data?.control?.stopUnconfirmed === true;
     const locked = !data || readOnly() || (unavailable && !retryStop) || Boolean(action || state.mediaAction);
-    $('runtimeState').textContent = statusLabel(displayedState);
-    $('runtimeState').dataset.state = unavailable ? 'unavailable' : displayedState;
+    renderRuntimeState();
     $('startButton').disabled = locked || retryStop || !['stopped', 'inactive'].includes(process);
     $('stopButton').disabled = locked || (!retryStop && process !== 'running');
     iconLabel($('startButton'), 'play', message(action === 'start' ? 'starting' : 'start'));
@@ -523,7 +535,7 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     $('stopButton').hidden = scope.center;
     $('refreshButton').disabled = Boolean(state.refreshPending || state.action);
     $('modeNote').textContent = data ?
```

**File**: `dashboard/i18n.js` (modified, +4/-0)
```diff
@@ -81,6 +81,8 @@ window.JOURNAL_MESSAGES = {
     "currentProduct": "当前产品",
     "otherProductRunning": "正在执行：{name}",
     "viewingRunningProduct": "当前产品正在执行",
+    "currentWorkState": "当前工作 · {state}",
+    "otherWorkState": "其他工作 · {state}：{name}",
     "centerManaged": "由产品中心管理",
     "centerArchive": "产品中心档案 · 只读",
     "work": "工作记录",
@@ -423,6 +425,8 @@ window.JOURNAL_MESSAGES = {
     "currentProduct": "Current product",
     "otherProductRunning": "Running: {name}",
     "viewingRunningProduct": "Current product is running",
+    "currentWorkState": "Current work · {state}",
+    "otherWorkState": "Other work · {state}: {name}",
     "centerManaged": "Managed by Product Center",
     "centerArchive": "Product Center archive · Read only",
     "work": "Work journal",
```

**File**: `tests/test_center_frontend.js` (modified, +13/-4)
```diff
@@ -33,7 +33,7 @@ function journalHelpers() {
   vm.runInContext(fs.readFileSync(path.join(dashboard, "i18n.js"), "utf8"), context);
   const binding = journalApp.indexOf("\n  document.querySelectorAll('[data-tab]')");
   assert.ok(binding > 0, "Journal event wiring must follow helper declarations");
-  vm.runInContext(journalApp.slice(0, binding) + "\n globalThis.journal = { state, scope, scopedCenterRuntimeState, runtimeStateValue, runtimeLabel, requestContextLabel };\n})();", context);
+  vm.runInContext(journalApp.slice(0, binding) + "\n globalThis.journal = { state, scope, freshCenterRequest, scopedCenterRuntimeState, runtimeStateValue, runtimeLabel, requestContextLabel, centerRuntimeContextValue };\n})();", context);
   context.journal.state.language = "en";
   return context.journal;
 }
@@ -98,7 +98,7 @@ test("unfiltered catalog without formed products points to explorations", () =>
 });
 
 test("product detail trusts only the confirmed matching center request", () => {
-  const { state, scopedCenterRuntimeState, runtimeStateValue, runtimeLabel } = journalHelpers();
+  const { state, scopedCenterRuntimeState, runtimeStateValue, runtimeLabel, centerRuntimeContextValue } = journalHelpers();
   const now = Date.now();
   const request = { requestId: "request-a", entryId: "entry-a", state: "running", liveConfirmedAt: new Date(now - 1000).toISOString() };
   state.data = { entry: { entryId: "entry-a", executionSummary: { requestId: "request-a", state: "running" } }, cycles: [{ status: "completed", active: false }] };
@@ -107,6 +107,7 @@ test("product detail trusts only the confirmed matching center request", () => {
   assert.equal(scopedCenterRuntimeState(state.data, state.centerSummary, now), "running");
   assert.equal(runtimeStateValue(), "running");
   assert.equal(runtimeLabel(), "Running");
+  assert.equal(centerRuntimeContextValue(state.centerSummary, now), "Current work · Running");
   state.centerSummary = { currentRequest: { ...request, entryId: "entry-b" } };
   assert.equal(scopedCenterRuntimeState(state.data, state.centerSummary, now), null);
   assert.equal(runtimeStateValue(), "unknown");
@@ -116,24 +117,32 @@ test("product detail trusts only the confirmed matching center request", () => {
 });
 
 test("product detail drops stale or disconnected running evidence", () => {
-  const { state, scopedCenterRuntimeState, runtimeStateValue, runtimeLabel } = journalHelpers();
+  const { state, freshCenterRequest, scopedCenterRuntimeState, runtimeStateValue, runtimeLabel, centerRuntimeContextValue } = journalHelpers();
   const now = Date.now();
   const entry = { entryId: "entry-a", executionSummary: { requestId: "request-a", state: "running" } };
   const currentRequest = { requestId: "request-a", entryId: "entry-a", state: "running", liveConfirmedAt: new Date(now - 1000).toISOString() };
   state.data = { entry, runtime: { state: "running" } }; state.centerSummary = { currentRequest }; state.statusFailed = true;
   assert.equal(scopedCenterRuntimeState(state.data, state.centerSummary, now), null);
   assert.equal(runtimeStateValue(), "unknown");
   assert.equal(runtimeLabel(), "Unknown");
+  assert.equal(centerRuntimeContextValue(state.centerSummary, now), "");
   state.statusFailed = false; state.centerSummary.currentRequest.liveConfirmedAt = new Date(now - 15001).toISOString();
+  assert.equal(freshCenterRequest(state.centerSummary, now), null);
   assert.equal(scopedCenterRuntimeState(state.data, state.centerSummary, now), null);
   assert.equal(runtimeStateValue(), "unknown");
   assert.equal(runtimeLabel(), "Unknown");
+  assert.equal(centerRuntimeContextValue(state.centerSummary, now), "");
 });
 
 test("cross-product running context includes the queued-plan identity", () => {
-  const { requestContextLabel } = journalHelpers();
+  const { state, requestContextLabel, centerRuntimeContextValue } = journalHelpers();
   assert.equal(requestContextLabel({ displayName: "Auto Company", config: { model: "gpt-5.6-luna", effort: "high" } }), "Auto Company · gpt-5.6-luna · high");
   assert.equal(requestContextLabel({ displayName: "Auto Company", sourceId: "source_1234567890" }), "Auto Company · …34567890");
+  const now = Date.now(); state.statusFailed = false;
+  state.centerSummary = { currentRequest: { requestId: "other", entryId: "entry-b", state: "starting", liveConfirmedAt: new Date(now - 1000).toISOString(), displayName: "Auto Company", config: { model: "gpt-5.6-luna", effort: "high" } } };
+  assert.equal(centerRuntimeContextValue(state.centerSummary, now), "Other work · Starting…: Auto Company · gpt-5.6-luna · high");
+  state.centerSummary.currentRequest.state = "stopping";
+  assert.equal(centerRuntimeContextValue(state.centerSummary, now), "Other work · Stopping…: Auto Company · gpt-5.6-luna · high");
 });
 
 test("center actions use the versioned envelope routes and explicit write preconditions", () => {
```

---

### Incident Patch 5: `6d4349d9` (2026-09-26)
**Commit Message**: fix product center runtime context states

**File**: `dashboard/app.js` (modified, +28/-8)
```diff
@@ -51,12 +51,33 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   }
   function statusLabel(status) {
     if (['not_started', 'startup_unconfirmed'].includes(status)) return message(status);
-    return ['stopping', 'stop_failed', 'completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
+    return ['starting', 'stopping', 'stop_failed', 'completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
   }
   function readOnly() { return state.data?.readOnly !== false; }
   function centerModeKey() { return state.data?.entry?.runtimeId ? 'centerManaged' : 'centerArchive'; }
   function liveProcess() { return !readOnly() && !state.statusFailed && state.data?.runtime?.processState === 'running'; }
-  function runtimeLabel() { return statusLabel(state.action === 'stop' ? 'stopping' : state.data?.control?.stopUnconfirmed ? (state.data?.control?.action === 'stop' ? 'stopping' : 'stop_failed') : state.statusFailed ? 'unavailable' : state.data?.runtime?.state); }
+  function scopedCenterRuntimeState(data = state.data, summary = state.centerSummary) {
+    if (!scope.center) return null;
+    const entry = data?.entry; const execution = entry?.executionSummary; const request = summary?.currentRequest;
+    if (!entry?.entryId || !request?.liveConfirmedAt || request.entryId !== entry.entryId) return null;
+    if (!execution?.requestId || execution.requestId !== request.requestId || execution.state !== request.state) return null;
+    return ['starting', 'running', 'stopping'].includes(request.state) ? request.state : null;
+  }
+  function runtimeLabel() {
+    const centerState = scopedCenterRuntimeState();
+    return statusLabel(centerState || (scope.center ? 'unknown' : state.action === 'stop' ? 'stopping' : state.data?.control?.stopUnconfirmed ? (state.data?.control?.action === 'stop' ? 'stopping' : 'stop_failed') : state.statusFailed ? 'unavailable' : state.data?.runtime?.state));
+  }
+  function requestContextLabel(request) {
+    const name = request?.displayName || message('unknown');
+    const plan = [request?.config?.model, request?.config?.effort].filter(Boolean).join(' · ');
+    return plan ? `${name} · ${plan}` : request?.sourceId ? `${name} · …${String(request.sourceId).slice(-8)}` : name;
+  }
+  function renderCenterRuntimeContext(summary) {
+    const active = summary?.currentRequest;
+    const value = !active ? '' : active.entryId === scope.entryId ? message('viewingRunningProduct') : message('otherProductRunning', { name: requestContextLabel(active) });
+    $('centerRuntimeContext').textContent = value;
+    $('centerRuntimeContext').title = value;
+  }
   function pauseLabel(value) { return message(`pause_${value}`) === `pause_${value}` ? String(value || '') : message(`pause_${value}`); }
   async function fetchJSON(url, options = {}, timeout = 100000) {
     const controller = new AbortController();
@@ -482,13 +503,14 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   function renderRuntime() {
     const data = state.data;
     const runtime = data?.runtime || {};
-    const unavailable = state.statusFailed || runtime.available === false;
+    const centerState = scopedCenterRuntimeState();
+    const unavailable = scope.center ? false : state.statusFailed || runtime.available === false;
     const process = runtime.processState || runtime.state;
     const action = state.action || data?.control?.action;
     const retryStop = data?.control?.stopUnconfirmed === true;
     const locked = !data || readOnly() || (unavailable && !retryStop) || Boolean(action || state.mediaAction);
     $('runtimeState').textContent = runtimeLabel();
-    $('runtimeState').dataset.state = unavailable ? 'unavailable' : runtime.state || 'unknown';
+    $('runtimeState').dataset.state = unavailable ? 'unavailable' : centerState || runtime.state || 'unknown';
     $('startButton').disabled = locked || retryStop || !['stopped', 'inactive'].includes(process);
     $('stopButton').disabled = locked || (!retryStop && process !== 'running');
     iconLabel($('startButton'), 'play', message(action === 'start' ? 'starting' : 'start'));
@@ -998,8 +1020,7 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
       const [entries, summary] = await Promise.all([fetchAllCenterEntri
```

**File**: `dashboard/center-i18n.js` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ window.CENTER_MESSAGES = {
     readOnlyProbe: "只读探测", importIntro: "先读取目录身份与能力；不会执行目录中的脚本或启动产品。", folderPath: "目录",
     folderPlaceholder: "输入本机目录路径", probe: "检查目录", confirmImport: "确认接入", centerSettings: "中心设置",
     centerLanguage: "中心界面语言", centerLanguageHint: "只改变产品中心固定文字，不翻译产品记录。", newWorkDefaults: "新工作的默认值",
-    save: "保存", confirm: "确认", loading: "正在读取产品…", noProducts: "尚未接入产品。可新建工作或接入已有产品。",
+    save: "保存", confirm: "确认", loading: "正在读取产品…", noProducts: "尚未接入产品。可新建工作或接入已有产品。", noFormedProducts: "还没有已立项产品。可查看尚未立项的探索，或接入已有产品。", viewExplorations: "查看探索",
     noMatches: "没有符合当前搜索和筛选的产品。", clearFilters: "清除筛选", staleData: "刷新失败。以下为上次读取的记录；执行操作已暂停。",
     loadFailed: "产品中心暂时无法读取。请检查本地服务后重试。", retry: "重试", refreshedAt: "读取于 {time}", unknownTime: "时间未记录",
     purposeMissing: "用途尚未记录", workMissing: "尚无工作汇报", cycleNumber: "第 {number} 轮", phaseRecorded: "记录阶段：{phase}", view: "查看",
@@ -66,7 +66,7 @@ window.CENTER_MESSAGES = {
     readOnlyProbe: "Read-only probe", importIntro: "First inspect identity and capabilities. The center will not execute scripts from the folder or start the product.", folderPath: "Folder",
     folderPlaceholder: "Enter a local folder path", probe: "Check folder", confirmImport: "Confirm connection", centerSettings: "Center settings",
     centerLanguage: "Center interface language", centerLanguageHint: "Changes fixed center labels only. Product records are not translated.", newWorkDefaults: "Defaults for new work",
-    save: "Save", confirm: "Confirm", loading: "Loading products…", noProducts: "No products are connected. Create new work or connect an existing product.",
+    save: "Save", confirm: "Confirm", loading: "Loading products…", noProducts: "No products are connected. Create new work or connect an existing product.", noFormedProducts: "There are no formed products yet. View pre-product explorations or connect an existing product.", viewExplorations: "View explorations",
     noMatches: "No products match the current search and filter.", clearFilters: "Clear filter", staleData: "Refresh failed. These are the last records read; execution actions are paused.",
     loadFailed: "The product center cannot be read right now. Check the local service and retry.", retry: "Retry", refreshedAt: "Read at {time}", unknownTime: "Time not recorded",
     purposeMissing: "Purpose not recorded", workMissing: "No work report yet", cycleNumber: "Cycle {number}", phaseRecorded: "Recorded phase: {phase}", view: "View",
```

**File**: `dashboard/center.js` (modified, +16/-2)
```diff
@@ -175,6 +175,15 @@
     });
   }
 
+  function emptyListState(entries = filteredEntries()) {
+    if (entries.length) return null;
+    if (state.stale && !state.entries.length) return { messageKey: "loadFailed" };
+    if (state.query || state.filter !== "all") return { messageKey: "noMatches", actionKey: "clearFilters", target: "all" };
+    const hasProduct = state.entries.some((entry) => !entry.archived && ["product", "legacy"].includes(entry.kind));
+    if (!hasProduct) return { messageKey: "noFormedProducts", actionKey: "viewExplorations", target: "exploration" };
+    return { messageKey: "noProducts" };
+  }
+
   function safeAssetURL(value) {
     if (typeof value !== "string" || !value.startsWith(`${API}/`)) return null;
     try { const url = new URL(value, location.origin); return url.origin === location.origin && url.pathname.startsWith(`${API}/`) ? `${url.pathname}${url.search}` : null; }
@@ -280,8 +289,13 @@
     const entries = filteredEntries();
     for (const entry of entries) container.append(renderRow(entry));
     if (!entries.length) {
-      const empty = element("span", "", state.stale && !state.entries.length ? message("loadFailed") : state.entries.length ? message("noMatches") : message("noProducts")); listState.append(empty);
-      if (state.entries.length) { const clearButton = element("button", "text-button", message("clearFilters")); clearButton.type = "button"; clearButton.addEventListener("click", clearFilters); listState.append(clearButton); }
+      const emptyState = emptyListState(entries);
+      listState.append(element("span", "", message(emptyState.messageKey)));
+      if (emptyState.actionKey) {
+        const action = element("button", "text-button", message(emptyState.actionKey)); action.type = "button";
+        action.addEventListener("click", () => { state.query = ""; $("productSearch").value = ""; setFilter(emptyState.target); });
+        listState.append(action);
+      }
     }
   }
 
```

**File**: `dashboard/styles.css` (modified, +1/-1)
```diff
@@ -1839,7 +1839,7 @@ dialog .runtime-details {
 .center-back-link::after { content: "/"; margin-left: 13px; color: var(--line-strong); }
 .product-switcher-button { min-width: 0; max-width: 260px; display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 3px; background: #fff; color: var(--ink); font-weight: 650; cursor: pointer; }
 .product-switcher-button span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
-.center-runtime-context { overflow: hidden; max-width: 240px; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
+.center-runtime-context { overflow: hidden; max-width: 360px; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
 .product-switcher-dialog { width: min(520px, calc(100vw - 32px)); padding: 24px; }
 .product-switcher-dialog .dialog-header { margin-bottom: 17px; }
 .switcher-search { display: block; margin-bottom: 10px; }
```

**File**: `tests/test_center_frontend.js` (modified, +42/-1)
```diff
@@ -20,11 +20,24 @@ function helpers() {
   vm.runInContext(i18n, context);
   const binding = app.lastIndexOf("\n  applyLanguage(); wire(); renderPage(); refresh();");
   assert.ok(binding > 0, "Center event wiring must follow helper declarations");
-  vm.runInContext(app.slice(0, binding) + "\n globalThis.center = { state, message, entryState, capability, normalizeCounts, filteredEntries, requestState, statusLabel, write };\n})();", context);
+  vm.runInContext(app.slice(0, binding) + "\n globalThis.center = { state, message, entryState, capability, normalizeCounts, filteredEntries, emptyListState, requestState, statusLabel, write };\n})();", context);
   context.center.state.language = "en";
   return { ...context.center, messages: context.window.CENTER_MESSAGES, context };
 }
 
+function journalHelpers() {
+  const context = vm.createContext({
+    window: {}, location: { pathname: "/products/entry-a", origin: "http://127.0.0.1:8843" },
+    document: {}, URL, Intl, Date, Number, Object, Set, Map, String, Math, AbortController, setTimeout, clearTimeout,
+  });
+  vm.runInContext(fs.readFileSync(path.join(dashboard, "i18n.js"), "utf8"), context);
+  const binding = journalApp.indexOf("\n  document.querySelectorAll('[data-tab]')");
+  assert.ok(binding > 0, "Journal event wiring must follow helper declarations");
+  vm.runInContext(journalApp.slice(0, binding) + "\n globalThis.journal = { state, scope, scopedCenterRuntimeState, runtimeLabel, requestContextLabel };\n})();", context);
+  context.journal.state.language = "en";
+  return context.journal;
+}
+
 test("center fixed labels are complete and bilingual", () => {
   const { messages } = helpers();
   assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages["zh-CN"]).sort());
@@ -76,6 +89,34 @@ test("catalog filters use recorded state and never search report bodies", () =>
   state.filter = "reference"; assert.deepEqual(Array.from(filteredEntries(), (entry) => entry.entryId), ["e"]);
 });
 
+test("unfiltered catalog without formed products points to explorations", () => {
+  const { state, emptyListState } = helpers();
+  state.entries = [{ entryId: "explore", kind: "exploration", archived: false }]; state.filter = "all"; state.query = "";
+  assert.deepEqual({ ...emptyListState([]) }, { messageKey: "noFormedProducts", actionKey: "viewExplorations", target: "exploration" });
+  state.query = "missing";
+  assert.deepEqual({ ...emptyListState([]) }, { messageKey: "noMatches", actionKey: "clearFilters", target: "all" });
+});
+
+test("product detail trusts only the confirmed matching center request", () => {
+  const { state, scopedCenterRuntimeState, runtimeLabel } = journalHelpers();
+  const request = { requestId: "request-a", entryId: "entry-a", state: "running", liveConfirmedAt: "2026-09-26T23:24:49+08:00" };
+  state.data = { entry: { entryId: "entry-a", executionSummary: { requestId: "request-a", state: "running" } }, cycles: [{ status: "completed", active: false }] };
+  state.centerSummary = { currentRequest: request };
+  assert.equal(scopedCenterRuntimeState(), "running");
+  assert.equal(runtimeLabel(), "Running");
+  state.centerSummary = { currentRequest: { ...request, entryId: "entry-b" } };
+  assert.equal(scopedCenterRuntimeState(), null);
+  assert.equal(runtimeLabel(), "Unknown");
+  state.centerSummary = { currentRequest: { ...request, liveConfirmedAt: null } };
+  assert.equal(scopedCenterRuntimeState(), null);
+});
+
+test("cross-product running context includes the queued-plan identity", () => {
+  const { requestContextLabel } = journalHelpers();
+  assert.equal(requestContextLabel({ displayName: "Auto Company", config: { model: "gpt-5.6-luna", effort: "high" } }), "Auto Company · gpt-5.6-luna · high");
+  assert.equal(requestContextLabel({ displayName: "Auto Company", sourceId: "source_1234567890" }), "Auto Company · …34567890");
+});
+
 test("center actions use the versioned envelope routes and explicit write preconditions", () => {
   for (const route of ["/summary", "/entries?filter=all&sort=activity&limit=100", "/requests?limit=100", "/imports/probe", "/imports/commit", "/explorations", "/queue/order", "/queue/stop-all", "/preferences"]) {
     assert.ok(app.includes(route), `Missing route ${route}`);
```

---

### Incident Patch 6: `3f4ba37c` (2026-09-23)
**Commit Message**: fix: protect P1 consensus content across cycles

**File**: `PROMPT.md` (modified, +3/-2)
```diff
@@ -58,7 +58,8 @@
 [逐字保留现有内容；Agent 不得删除、改写、重排或格式化]
 
 ## Priority Issues
-- [ ] P1: [未解决的最高优先级阻断项；没有则写 `- None.`]
+[逐字保留已有 P1 条目及其说明，包括人工已勾选的历史项；可以追加新的未解决项，不得删除、改写、降级或自行勾选]
+- [ ] P1: [新发现且需要人工处理的阻断项；没有任何条目时才写 `- None.`]
 
 ## Open Questions
 - [待思考的问题]
@@ -83,7 +84,7 @@
 ## 人工治理与项目边界（强制）
 
 1. `Human Overrides` 是人类专属区，必须逐字保留；任何改动都会触发整轮共识回滚并暂停循环。
-2. `Priority Issues` 中存在未勾选的 P1 时，本轮会在调用模型前被阻断。只能由人类解决或明确勾选完成。
+2. `Priority Issues` 中存在未勾选的 P1 时，本轮会在调用模型前被阻断。逐字保留运行前已有 P1 条目及其说明，包括人工已勾选的历史项；可以追加未解决 P1，不得删除、改写、降级已有条目或新增已勾选条目。只能由人类在停止运行、完成待处理的中断恢复后解决或明确勾选；不支持运行中直接编辑共识来保证人工问题不被覆盖。
 3. 新产品只能通过 `make project-new NAME=<slug>` 创建；它会成为独立本地 Git 仓库。
 4. 框架仓库只登记项目元数据，不承载产品源码、产品提交或产品远端。
 5. 创建项目后禁止添加远端或 push；只有人类显式执行 `make project-publish ... CONFIRM=PUBLISH` 才能发布。
```

**File**: `README-ZH.md` (modified, +2/-0)
```diff
@@ -299,6 +299,8 @@ Auto-Company 并非简单调用 LLM API，而是一个高度解耦的 **多智
 | **恢复** | `make resume`，回到自主模式 |
 | **审查产出** | 查看 `docs/*/`——每个 Agent 的工作成果 |
 
+模型可以上报未解决的 P1，但必须保留已有 P1 条目，不能新增已勾选条目。人工应在停止运行并完成待处理恢复后解决问题，详见 [P1 问题与人工修改](docs/troubleshooting.md#p1-问题与人工修改)。
+
 ## 安全红线
 
 `CLAUDE.md` 向智能体提供以下行为规则。它们与框架的特定检查共同使用，但不是通用命令拦截机制，也不保证每次违反规则的操作都被阻止：
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -298,6 +298,8 @@ To change direction, stop the foreground run with `make stop`, pause a macOS/WSL
 | **Resume** | `make resume` |
 | **Review outputs** | Check `docs/*/` for artifacts generated by agents |
 
+Agents may report unresolved P1 blockers, but must preserve existing P1 entries and cannot add checked-off ones. Resolve blockers only after stopping and completing pending recovery; see [P1 issues and human edits](i18n/en/docs/troubleshooting.md#p1-issues-and-human-edits).
+
 ## Safety Guardrails
 
 `CLAUDE.md` gives agents the following behavioral rules. They complement specific framework checks, but are not a general command-denial mechanism or a guarantee that every agent action is blocked when it violates a rule:
```

**File**: `dashboard/i18n.js` (modified, +2/-0)
```diff
@@ -252,6 +252,7 @@ window.JOURNAL_MESSAGES = {
     "pause_budget_exceeded": "达到用量预算，需要检查预算设置",
     "pause_rate_limit": "等待额度恢复",
     "pause_user_requested": "用户请求暂停",
+    "pause_priority_issue_mutated": "P1 问题被修改，需要人工检查",
     "actionPending": "正在处理“{action}”，请稍候…",
     "actionComplete": "“{action}”请求已完成，正在核对实际状态。",
     "actionFailed": "“{action}”未能确认完成：{detail}。已重新读取状态，可在确认后重试。",
@@ -583,6 +584,7 @@ window.JOURNAL_MESSAGES = {
     "pause_budget_exceeded": "Usage budget reached; review the budget settings",
     "pause_rate_limit": "Waiting for quota to recover",
     "pause_user_requested": "Paused by user request",
+    "pause_priority_issue_mutated": "P1 issues changed; human review is required",
     "actionPending": "Processing “{action}”…",
     "actionComplete": "“{action}” request completed. Checking the actual runtime state.",
     "actionFailed": "Could not confirm “{action}”: {detail}. Status has been checked again; review it before retrying.",
```

**File**: `docs/troubleshooting.md` (modified, +12/-0)
```diff
@@ -47,6 +47,18 @@
 
 Linux/WSL、macOS 的后台服务可在原因解决后使用 `make resume`；前台运行先正常停止，再用 `python3 scripts/core/usage.py resume` 清除预算暂停并重新 `make start`。Windows 用户可在对应 WSL 仓库中执行后台恢复命令。恢复不会清空已记录的用量，再次超限仍会暂停。详细规则见 [用量治理](../i18n/zh-CN/docs/usage-governance.md)。
 
+## P1 问题与人工修改
+
+`Priority Issues` 中的 P1 表示必须由人处理的阻断项。模型可以追加未解决的 `- [ ] P1: 描述`；运行前已有的 P1 条目及说明必须原样保留，包括人工已勾选的历史项。模型删除、改写、降级既有条目或新增已勾选条目时，共识会恢复到运行前版本并暂停，原因记为 `priority_issue_mutated`。这项恢复不撤销产品文件或外部操作。
+
+需要随条目保留的说明写在该条目下的缩进续行中；另一条 P1、新标题或同级列表项会开始新的内容。空分隔行不属于条目内容。
+
+违反人工规则或 P1 内容保护时，程序会尝试把被拒绝的原稿保存在 `memories/rejected/`，并在日志中记录位置，供人工审查；它不是成功轮次快照。保存失败会明确记录，循环仍保持暂停并尝试恢复运行前共识。
+
+人工处理时先正常停止前台循环或暂停后台服务，并确认已经停止。若上一轮被强制中断，在对应 Linux/WSL 或 macOS 仓库运行 `bash scripts/core/consensus-guard.sh recover` 完成待处理恢复，再编辑共识。成功恢复会保留暂停并返回 42；没有待恢复轮次时返回 0。若提示恢复失败，先处理原始错误，不要删除恢复标记或基线来绕过。
+
+确认问题解决后，人工可将对应条目改为 `- [x] P1: 描述`，再启动或恢复运行。不要在模型执行期间直接编辑这份文件：周期前后比较无法可靠保留中途新增后又被覆盖的内容，也不是实时中断入口。
+
 ## 提交问题时提供什么
 
 提供操作系统、WSL 发行版（如适用）、项目版本、执行的命令、所选语言、原始错误及相关日志片段。发送前移除密钥、令牌和不应公开的业务内容；无需提供整个配置目录。
```

**File**: `i18n/en/PROMPT.md` (modified, +3/-2)
```diff
@@ -58,7 +58,8 @@ Before finishing, you **must** update `memories/consensus.md` in this format:
 [Preserve existing content verbatim; agents must not delete, rewrite, reorder, or reformat it]
 
 ## Priority Issues
-- [ ] P1: [Unresolved highest-priority blocker; if there is none, write `- None.`]
+[Preserve existing P1 entries and their descriptions verbatim, including history checked off by a human. You may append unresolved entries; do not delete, rewrite, downgrade or check them off.]
+- [ ] P1: [A newly discovered blocker requiring human action; write `- None.` only when there are no entries.]
 
 ## Open Questions
 - [Question to consider]
@@ -83,7 +84,7 @@ Cycle 1/2/3 below describe convergence for a **new exploration task**, not a bus
 ## Human Governance and Project Boundaries (Mandatory)
 
 1. `Human Overrides` is a human-only section and must be preserved verbatim; any change triggers a rollback of the entire cycle's consensus and pauses the loop.
-2. If `Priority Issues` contains an unchecked P1, the cycle is blocked before the model is called. Only a human may resolve it or explicitly check it off as complete.
+2. If `Priority Issues` contains an unchecked P1, the cycle is blocked before the model is called. Preserve all pre-cycle P1 entries and their descriptions verbatim, including history checked off by a human. You may append unresolved P1 entries, but must not delete, rewrite or downgrade existing entries or add checked-off entries. Only a human may resolve or check off an issue after stopping the run and completing any pending interrupted-cycle recovery. Directly editing the consensus during execution does not provide reliable protection for human issue updates.
 3. New products may only be created through `make project-new NAME=<slug>`; each becomes an independent local Git repository.
 4. The framework repository records project metadata only; it must not contain product source code, product commits, or product remotes.
 5. After creating a project, adding a remote or pushing is prohibited; publishing is allowed only when a human explicitly runs `make project-publish ... CONFIRM=PUBLISH`.
```

**File**: `i18n/en/docs/troubleshooting.md` (modified, +12/-0)
```diff
@@ -47,6 +47,18 @@ Language preferences can be saved while a product is running. Its current langua
 
 For a Linux/WSL or macOS background service, use `make resume` after resolving the cause. For a foreground loop, stop normally, clear the budget pause with `python3 scripts/core/usage.py resume`, then run `make start` again. Windows users can run the background recovery command inside the matching WSL repository. Resuming does not clear recorded usage; the loop pauses again if the limit is still exceeded. See [usage governance](../../../docs/usage-governance.md).
 
+## P1 issues and human edits
+
+A P1 under `Priority Issues` is a blocker requiring human action. An agent may append an unresolved `- [ ] P1: description`; it must preserve pre-cycle P1 entries and their descriptions verbatim, including history already checked off by a human. Deleting, rewriting or downgrading an existing entry, or adding a checked-off entry, restores the pre-cycle consensus and pauses with reason `priority_issue_mutated`. This recovery does not undo product files or external actions.
+
+Put descriptions that belong to an entry in indented continuation lines beneath it. Another P1, a heading or a sibling list item starts new content. Blank separator lines are not part of the entry.
+
+For a human-rule or P1 content violation, the program attempts to save the rejected draft under `memories/rejected/` and records its location in the log for human review. It is not a successful-cycle snapshot. An archive failure is reported explicitly; the loop remains paused and still attempts to restore the pre-cycle consensus.
+
+Before editing, stop the foreground loop or pause the background service and confirm it has stopped. If the previous cycle was forcibly interrupted, run `bash scripts/core/consensus-guard.sh recover` in the matching Linux/WSL or macOS repository to complete pending recovery first. Successful recovery retains the pause and returns 42; no pending cycle returns 0. If recovery fails, address the original error rather than deleting recovery markers or baselines.
+
+After resolving the issue, a human may change its entry to `- [x] P1: description`, then start or resume the loop. Do not edit this file directly while the model is executing: before/after comparisons cannot reliably preserve content added and then overwritten between checks, and this is not a live interrupt channel.
+
 ## What to include in a report
 
 Include your operating system, WSL distribution if applicable, project version, command, selected language, original error and relevant log excerpts. Remove keys, tokens and private business content before sharing; the entire configuration directory is unnecessary.
```

**File**: `i18n/source-hashes.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "INDEX.md": "bb3baf532639b7f7de882fa78c2eae385964099bdcc286f4f7608ac46a7a9526",
-  "PROMPT.md": "adb11c6045ce6a3af8a065c574e5dde28517d6d2ad4cefa5879887616f4a66cd",
+  "PROMPT.md": "99a382b995e121e1c9f85c1ee463a82b25ff6bd8562e7e85b61b358911f4e3dd",
   ".claude/agents/ceo-bezos.md": "04655828d6c110787651efc71d53ab2e6d04f26356b3c7de8f00c909aa645de2",
   ".claude/agents/cfo-campbell.md": "63186e51dad6191930907dd8f0847fa8d78080c43f3d9d1576629c30b5f01545",
   ".claude/agents/critic-munger.md": "ca59c72d8b8a91436b1fe60866af2318bb0540e83551c244882427c6fc52b18b",
@@ -19,5 +19,5 @@
   "CLAUDE.md": "9973ac31f1d0eba8a68fbe705c86dfbfceda8820181f8a73d6d1236612537530",
   "ENGINE_ADAPTERS.md": "b81a46b9b41765b41c22958bf4d2b2bfa0a39b70649f2e9bb16d482b7aaf6040",
   "docs/usage-governance.md": "d10069939325b85e77f9f26baa05aa0033a706453e3a059996226d0968175b17",
-  "docs/troubleshooting.md": "e12a34fd14a4360e3bd3b8605e115a79b6d64cf58c314f0b6d31746d9ffc770f"
+  "docs/troubleshooting.md": "05ebfc93aaca9cc64950e5a39c2aa2422b6da27e7fb5fee077e428f6465574ec"
 }
```

---

### Incident Patch 7: `aa663ace` (2026-09-22)
**Commit Message**: fix: preserve product ownership and runtime control boundaries

**File**: `README-ZH.md` (modified, +29/-25)
```diff
@@ -2,10 +2,10 @@
 
 # Auto Company
 
-**全自主 AI 公司，24/7 不停歇运行** <a href="README.md"><img alt="[English Documentation]" src="https://img.shields.io/badge/%5BEnglish%20Documentation%5D-2f3640.svg" /></a>
+**支持持续自主工作的 AI 公司框架** <a href="README.md"><img alt="[English Documentation]" src="https://img.shields.io/badge/%5BEnglish%20Documentation%5D-2f3640.svg" /></a>
 
-基于 **Agentic Workflows (代理式工作流)** 驱动，系统编排了 14 个 **Autonomous AI Agent (自主智能体)**，每个都是该领域世界顶级专家的思维分身。
-自主构思产品、做决策、写代码、部署上线、搞营销。没有人类参与。
+基于 **Agentic Workflows（代理式工作流）**，系统提供 14 份 **AI 智能体角色定义**，各自参考相关领域专家的工作方法。
+团队可以在人类设定的目标、权限和预算内自主调研产品、做决策和写代码。部署、发布和营销取决于可用工具及授权范围，持续运行也依赖服务和模型可用性。
 
 默认使用 Claude Code，并支持 [Codex CLI](https://www.npmjs.com/package/@openai/codex)（macOS 原生 + Windows/WSL），两端都可启动本地 Dashboard。
 
@@ -44,23 +44,23 @@ ScopeFence 的真实四轮产品记录：04 展开，03、02、01 逐项收起
 
 ## 这是什么？
 
-你启动一个循环。AI 团队醒来，读取共识记忆，决定干什么，组建 3-5 人小队，执行任务，更新共识记忆，然后睡一觉。接着又醒来。如此往复，永不停歇。
+你启动循环后，每轮会读取工作摘要、决定任务、按需组队、执行并更新摘要，然后等待下一轮。实际组队取决于模型和引擎能力；错误、预算限制或暂停请求可能中止后续运行。
 
 ```
 daemon (launchd / systemd --user, 崩溃自重启)
-  └── scripts/core/auto-loop.sh (永续循环)
+  └── scripts/core/auto-loop.sh (持续循环)
         ├── 读 PROMPT.md + consensus.md
         ├── CLI 调用（Codex CLI / Claude Code）
         │   ├── 读 CLAUDE.md (公司章程 + 安全红线)
         │   ├── 读 .claude/skills/team/SKILL.md (组队方法)
-        │   ├── 组建 Agent Team (3-5 人)
+        │   ├── 按需组建 Agent Team
         │   ├── 执行：调研、写码、部署、营销
-        │   └── 更新 memories/consensus.md (传递接力棒)
+        │   └── 更新 memories/consensus.md (工作摘要)
         ├── 失败处理: 限额等待 / 熔断保护 / consensus 回滚
         └── sleep → 下一轮
 ```
 
-每个周期是一次独立的 CLI 调用。`memories/consensus.md` 是唯一的跨周期状态——类似接力赛传棒。
+每个周期是一次独立的 CLI 调用。`memories/consensus.md` 是下一轮预加载的主要工作摘要，产品文件、仓库、配置、身份记录、日志和用量数据也会跨轮次保留。
 
 ## 运行产物示例
 
@@ -106,7 +106,7 @@ daemon (launchd / systemd --user, 崩溃自重启)
 | 用量与预算 | [治理说明](i18n/zh-CN/docs/usage-governance.md) | [Governance guide](docs/usage-governance.md) |
 | 操作与排错 | [常见操作与排错](docs/troubleshooting.md) | [Common tasks and errors](i18n/en/docs/troubleshooting.md) |
 
-## 团队阵容（14 人）
+## 团队阵容（14 个角色）
 
 不是"你是一个开发者"，而是"你是 DHH"——用真实传奇人物激活 LLM 的深层知识。
 
@@ -224,38 +224,38 @@ Auto-Company 并非简单调用 LLM API，而是一个高度解耦的 **多智
 ```text
 ┌────────────────────────────────────────────────────────────┐
 │ 5. 监控与人机交互层 (Observability & HITL)                 │
-│    [ Dashboard看板 ]  [ 基于文件的操纵杆 (consensus.md) ]  │
+│    [ Dashboard看板 ]  [ 文件式引导 (consensus.md) ]       │
 ├────────────────────────────────────────────────────────────┤
 │ 4. 工作流路由层 (Workflow Routing & Teaming)               │
-│    [ 动态组队路由 (Squad) ]  [ 强制收敛流 (Cycle 1->2->3) ]│
+│    [ 按角色组队 (Squad) ]  [ 提示词工作流指导 ]           │
 ├────────────────────────────────────────────────────────────┤
 │ 3. 智能体模型与认知层 (Agentic Models & Cognition)         │
 │    [ 14 个专家人格 (Personas) ]  [ 30+ 技能库 (Skills) ]   │
 ├────────────────────────────────────────────────────────────┤
 │ 2. 编排与状态控制层 (Orchestration & State Machine)        │
-│    [ 永续主循环 ]  [ 状态机 (Consensus) ]  [ 容错与熔断 ]  │
+│    [ 持续主循环 ]  [ 持久状态 ]  [ 容错与熔断 ]          │
 ├────────────────────────────────────────────────────────────┤
 │ 1. 基础设施与执行引擎层 (Execution Engine & Infrastructure)│
 │    [ 引擎适配器 (Adapters) ]  [ 跨平台守护进程 (Daemon) ] │
 └────────────────────────────────────────────────────────────┘
 ```
 
 ### 第 5 层：监控与人机交互层 (Observability & HITL)
-*   **基于文件的操纵杆 (File-based Steering)**：人类只需编辑 `memories/consensus.md`，修改 `Next Action`，下一个周期醒来的 AI 团队就会立刻“转舵”，实现极简的宏观控制。
+*   **文件式引导 (File-based Steering)**：停止当前运行后，在 `memories/consensus.md` 中修改 `Next Action` 来安排下一步，或修改 `Human Overrides` 来设置持续约束，然后启动或恢复。运行中编辑可能与模型更新和恢复操作冲突，不保证立即改变方向。
 *   **日志与看板 (Dashboard)**：`logs/` 保存引擎实际输出（对已知凭据进行脱敏），以及每轮结果和可用的用量记录。输出详细程度取决于引擎，不保证包含完整思考链。`dashboard/` 按当前与历史轮次组织工作汇报和成果，并提供运行控制、状态、用量、预算与日志，不跟踪各个 Agent 的活跃度。
 
 ### 第 4 层：工作流路由层 (Workflow Routing & Teaming)
-*   **动态组队路由 (Dynamic Squad Formation)**：系统利用 Agent Teams 功能，根据当前 `consensus.md` 中的 "Next Action"，从 14 人池子中动态挑选 2-5 名最适合的专家，并在当前循环中将它们“实例化”为子代理。
-*   **强制收敛流 (Convergence Workflow)**：由 `PROMPT.md` 强制执行的流程控制。例如：Cycle 1 发散（提 Idea） -> Cycle 2 验证（算账预检，输出 GO/NO-GO） -> Cycle 3 执行（写代码部署，**禁止纯讨论**）。
+*   **按角色组队 (Role-based Teaming)**：组队技能建议从 14 份角色定义中选择 2–5 个相关角色。实际子代理创建和并发取决于执行模型与引擎，不代表 14 个常驻工作者或固定人数的调度器。
+*   **工作流指导 (Workflow Guidance)**：`PROMPT.md` 要求团队从构思推进到验证和实现。这是提示词约定，不是程序强制执行的业务状态机；第三个引擎轮次不保证完成产品或部署。
 
 ### 第 3 层：智能体模型与认知层 (Agentic Models & Cognition)
 *   **专家思维注入 (Expert Personas)**：在 `.claude/agents/` 下，注入具体的历史人物/行业领袖思维模型框架（如 Bezos 的“逆向工作法”、Munger 的“查理清单”、DHH 的“宏伟单体架构”），使决策具有极高的商业和工程厚度。
 *   **技能库系统 (Skill Arsenal)**：位于 `.claude/skills/` 的可插拔插件系统（如 `frontend-design`, `security-audit`）。将具体方法论封装成工具，供任何被唤醒的 Agent “临时加载”。
-*   **约束与红线 (Constitutional Guardrails)**：写死在 `CLAUDE.md` 中的系统级 Prompt，设定了绝对不能触碰的底线（如禁止删除仓库、强制推送），确保高度自治下的安全性。
+*   **行为规则 (Behavioral Rules)**：`CLAUDE.md` 要求智能体遵守不删除仓库、不强制推送等规则。框架另有针对特定运行和配置边界的检查；提示词规则不能拦截任意命令，也不提供操作系统级沙箱。
 
 ### 第 2 层：编排与状态控制层 (Orchestration & State Machine)
-*   **永续主循环 (The Auto-Loop)**：通过 `scripts/core/auto-l
```

**File**: `README.md` (modified, +26/-22)
```diff
@@ -2,10 +2,10 @@
 
 # Auto Company
 
-**A fully autonomous AI company running 24/7** <a href="README-ZH.md"><img alt="[中文说明]" src="https://img.shields.io/badge/%5B%E4%B8%AD%E6%96%87%E8%AF%B4%E6%98%8E%5D-2f3640.svg" /></a>
+**An AI company framework for continuous autonomous work** <a href="README-ZH.md"><img alt="[中文说明]" src="https://img.shields.io/badge/%5B%E4%B8%AD%E6%96%87%E8%AF%B4%E6%98%8E%5D-2f3640.svg" /></a>
 
-Powered by **Agentic Workflows**, this project orchestrates 14 **Autonomous AI Agents**, each modeled after world-class experts in their domain.
-They ideate products, make decisions, write code, deploy, and market - without human intervention.
+Powered by **Agentic Workflows**, this project provides 14 **AI agent role definitions**, each drawing on an expert's approach to its domain.
+The team can research products, make decisions, and write code autonomously within human-configured goals, permissions, and budgets. Deployment, publication, and marketing depend on the tools and authorization available; continuous operation depends on services and model availability.
 
 Powered by Claude Code (default) and [Codex CLI](https://www.npmjs.com/package/@openai/codex) on macOS + Windows/WSL, with a local dashboard on both hosts.
 
@@ -44,7 +44,7 @@ Four real ScopeFence product cycles: 04 is expanded; 03, 02 and 01 remain indivi
 
 ## What Is This?
 
-You start a loop. The AI team wakes up, reads shared consensus memory, decides what to do, forms a 3-5 person squad, executes, updates consensus memory, then sleeps briefly. Then it repeats.
+You start a loop. Each cycle reads the shared work summary, decides what to do, forms a team as needed, executes, updates the summary, and waits before the next cycle. Team creation depends on the model and engine capabilities; errors, budget limits, or a pause request can stop continuation.
 
 ```
 daemon (launchd / systemd --user, auto-restart on crash)
@@ -53,14 +53,14 @@ daemon (launchd / systemd --user, auto-restart on crash)
         ├── LLM CLI call (Codex CLI / Claude Code)
         │   ├── reads CLAUDE.md (charter + guardrails)
         │   ├── reads .claude/skills/team/SKILL.md (teaming method)
-        │   ├── forms an Agent Team (3-5 agents)
+        │   ├── forms an Agent Team as needed
         │   ├── executes: research, coding, deploy, marketing
-        │   └── updates memories/consensus.md (handoff baton)
+        │   └── updates memories/consensus.md (work summary)
         ├── failure handling: rate-limit wait / circuit breaker / consensus rollback
         └── sleep -> next cycle
 ```
 
-Each cycle is an independent CLI call. `memories/consensus.md` is the only cross-cycle state.
+Each cycle is an independent CLI call. `memories/consensus.md` is the main work summary loaded for the next cycle. Product files, repositories, configuration, identity records, logs, and usage data also persist across cycles.
 
 ## Generated Applications
 
@@ -106,7 +106,7 @@ All bundled skills are written in English; their user-facing work follows the pr
 | Usage and budgets | [Governance guide](docs/usage-governance.md) | [用量与预算治理](i18n/zh-CN/docs/usage-governance.md) |
 | Operations and troubleshooting | [Common tasks and errors](i18n/en/docs/troubleshooting.md) | [常见操作与排错](docs/troubleshooting.md) |
 
-## Team Lineup (14 Agents)
+## Team Lineup (14 Roles)
 
 This is not "you are a generic developer". It is "you are DHH" style role prompting with real expert mental models.
 
@@ -226,35 +226,35 @@ Auto-Company is not a simple LLM API wrapper, but a highly decoupled **Multi-Age
 │    [ Dashboard ]  [ File-based Steering (consensus.md) ]   │
 ├────────────────────────────────────────────────────────────┤
 │ 4. Workflow Routing & Teaming Layer                        │
-│    [ Dynamic Squad Routing ]  [ Forced Convergence Flow ]  │
+│    [ Role-based Teaming ]  [ Prompt Workflow Guidance ]   │
 ├────────────────────────────────────────────────────────────┤
 │ 3. Agentic Models & Cognition Layer                        │
 │    [ 14 Expert Personas ]  [ 30+ Skill Arsenal ]           │
 ├────────────────────────────────────────────────────────────┤
 │ 2. Orchestration & State Machine Layer                     │
-│    [ 24/7 Auto-Loop ]  [ State Machine ]  [ Resilience ]   │
+│    [ Auto-Loop ]  [ Persistent State ]  [ Resilience ]    │
 ├────────────────────────────────────────────────────────────┤
 │ 1. Execution Engine & Infrastructure Layer                 │
 │    [ Engine Adapters ]  [ Cross-Platform Daemon ]        │
 └────────────────────────────────────────────────────────────┘
 ```
 
 ### Layer 5: Observability & HITL (Human-In-The-Loop)
-*   **File-based Steering**: Humans only need to edit `memories/consensus.md` and modify the `Next Action`. The AI team waking up in the next cycle will immediately pivot, enabling minimalist macro-control.
+*   **File-based Steering**: After stopping the current run, edit `Next Action` in `memories/consensus.md` for the next task,
```

**File**: `dashboard/app.js` (modified, +1/-0)
```diff
@@ -540,6 +540,7 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     finally { state.languageSaving = false; renderLanguage(); }
   }
   function unavailableArtifact(artifact) {
+    if (artifact.associationStatus === 'unknown') return message('artifactUnassociated');
     if (artifact.kind === 'preview') {
       return message(artifact.state === 'stopped' ? 'previewEnded' : artifact.state === 'interrupted' ? 'previewInterrupted' : 'previewUnavailable');
     }
```

**File**: `dashboard/i18n.js` (modified, +2/-0)
```diff
@@ -325,6 +325,7 @@ window.JOURNAL_MESSAGES = {
     "durationUnknown": "耗时未确认",
     "commandTruncated": "命令记录已截断。",
     "artifactStale": "文件已变更或缺失",
+    "artifactUnassociated": "尚未确认所属产品",
     "previewEnded": "预览已结束",
     "previewInterrupted": "预览已中断",
     "previewUnavailable": "预览不可用",
@@ -655,6 +656,7 @@ window.JOURNAL_MESSAGES = {
     "durationUnknown": "Duration unconfirmed",
     "commandTruncated": "The recorded command is truncated.",
     "artifactStale": "File changed or missing",
+    "artifactUnassociated": "Product association unconfirmed",
     "previewEnded": "Preview ended",
     "previewInterrupted": "Preview interrupted",
     "previewUnavailable": "Preview unavailable",
```

**File**: `dashboard/journal_data.py` (modified, +25/-15)
```diff
@@ -326,6 +326,19 @@ def document(self, relative: str) -> tuple[str, bool]:
             raise ValueError("Document is not an advertised artifact")
         return self.read(relative)
 
+    @staticmethod
+    def project_status(cycle, project, recorded_project):
+        # Paths describe historical locations; only the ledger can establish
+        # continuity across a move or distinguish a replacement at that path.
+        stable_id = cycle.get("stableProductId")
+        if cycle.get("identityKind") == "exploration":
+            stable_id = cycle.get("linkedProductId")
+        if stable_id:
+            return "current" if stable_id == project["stableId"] else "other"
+        if project["stableId"] or cycle.get("numbering") == "unavailable":
+            return "unknown"
+        return "current" if recorded_project and recorded_project == project["id"] else "other" if recorded_project else "unknown"
+
     def active_cycle(self, status: dict[str, Any]) -> dict[str, Any] | None:
         """Join a live loop to its reserved identity, never infer from log names."""
         loop = status.get("parsed", {}).get("loop", {})
@@ -515,10 +528,10 @@ def snapshot(self, *, status: dict[str, Any] | None = None,
                 elif cycle["events"]:
                     cycle["report"] = cycle["summary"] = ""
             reported_project = cycle.get("workReport", {}).get("project") if isinstance(cycle.get("workReport"), dict) else None
-            bound = [item for item in registered if item.get("cycleId") == cycle["id"]]
+            bound = [item for item in registered if item.get("cycleId") == cycle["id"] and item.get("associationStatus") == "bound"]
             context = cycle.get("projectIdentity") or self.cycle_context(cycle["id"])
             recorded_project = cycle.get("projectId")
-            artifact_projects = {item["project"] for item in bound}
+            artifact_projects = {item.get("recordedProject", item["project"]) for item in bound}
             if context["status"] == "recorded":
                 cycle_project = context["project"]
             elif context["status"] == "missing" and recorded_project:
@@ -534,22 +547,22 @@ def snapshot(self, *, status: dict[str, Any] | None = None,
             if cycle.get("identityKind") == "exploration" and cycle.get("linkedProductId") == project["stableId"] and project["stableId"]:
                 try:
                     if selected_project in cycle_projects(self.root, cycle["id"]):
-                        cycle_project = selected_project
-                        context = {"project": selected_project, "status": "recorded", "recordedAt": None,
-                                   "source": "product_cycle_ledger", "kind": "linked_exploration"}
+                        # Preserve the recorded product location for report
+                        # validation; the stable link decides current ownership.
+                        cycle_project = cycle_project or (next(iter(artifact_projects)) if len(artifact_projects) == 1 else selected_project)
+                        context = {"project": cycle_project, "status": "recorded", "recordedAt": None,
+                                   "source": "product_cycle_ledger", "kind": "linked_exploration",
+                                   "currentProject": selected_project}
                 except (OSError, ValueError, TypeError, KeyError):
                     warnings.append("exploration_association_unavailable")
             if cycle_project and reported_project and reported_project != cycle_project:
                 cycle["workReport"] = None
                 cycle["workReportStatus"] = "identity_mismatch"
             cycle["projectId"] = cycle_project
             cycle["projectIdentity"] = context
-            cycle["projectStatus"] = ("current" if cycle_project and cycle_project == selected_project else
-                                      "other" if cycle_project else "unknown")
-            if cycle.get("stableProductId") and cycle["stableProductId"] != project["stableId"]:
-                cycle["projectStatus"] = "other"
+            cycle["projectStatus"] = self.project_status(cycle, project, cycle_project)
             cycle["belongsToCurrentProject"] = cycle["projectStatus"] == "current"
-            cycle_artifacts = [item for item in bound if cycle_project and item.get("project") == cycle_project]
+            cycle_artifacts = bound if cycle["belongsToCurrentProject"] else []
             checks = [item for item in cycle_artifacts if item["kind"] == "check"]
             cycle["artifacts"] = cycle_artifacts
             cycle["checks"] = checks
@@ -562,12 +575,9 @@ def snapshot(self, *, status: dict[str, Any] | None = None,
             cycle.update({"detailStatus": "limited", "projectIdentity": {
                               "project": recorded_project, "status": "recorded" if recorded_project else "not_loaded",
                               "recordedAt": None, "source": "usage_ledger" i
```

**File**: `dashboard/observability_data.py` (modified, +87/-14)
```diff
@@ -127,7 +127,7 @@ def preview_available(record):
         return False
     connection = http.client.HTTPConnection("127.0.0.1", port, timeout=0.25)
     try:
-        connection.request("GET", "/.auto-company-health")
+        connection.request("GET", "/.auto-company-health", headers={"X-Auto-Company-Preview": token})
         response = connection.getresponse()
         return response.status == 204 and response.getheader("X-Auto-Company-Preview") == token
     except (OSError, http.client.HTTPException):
@@ -144,21 +144,73 @@ def _counts(value):
     return {key: value[key] for key in keys}
 
 
-def _artifact_entry(source, selected, record, preview_probe):
+def _artifact_owner(source, state, record, historical_paths):
+    """Resolve recorded identity from the ledger, never from file equality."""
+    product_id = record.get("productId")
+    row = state["cycles"].get(record.get("cycleId"))
+    if product_id is not None:
+        if not isinstance(product_id, str) or not ARTIFACT_ID.fullmatch(product_id):
+            raise ValueError("Invalid artifact product identity")
+        product = state["identities"].get(product_id)
+        if not product or product["kind"] != "product":
+            return None
+        if row and product_id not in [row["identityId"], *row.get("createdProductIds", [])]:
+            raise ValueError("Artifact identity conflicts with its cycle")
+        return product_id
+    if not row:
+        return None
+    owner = state["identities"][row["identityId"]]
+    if owner["kind"] == "product" and record["project"] in {row.get("project"), owner["project"]}:
+        return owner["id"]
+    created = row.get("createdProductIds", [])
+    if owner["kind"] == "exploration" and len(created) == 1 and owner.get("linkedProductId") == created[0]:
+        # Legacy creation records predate productId. A unique creation still
+        # needs positive path evidence: that cycle could inspect other products.
+        if any(item["kind"] == "product" and item["id"] != created[0] and item["project"] == record["project"]
+               for item in state["identities"].values()):
+            return None
+        current_project = state["identities"][created[0]]["project"]
+        if record["project"] != current_project and record["project"] not in historical_paths.get(created[0], set()):
+            # A retained marker can prove a copied source; an absent old source
+            # cannot prove relocation. Missing path history stays unassociated.
+            try:
+                raw, truncated = source.read(record["project"] + "/.auto-company/identity.json", 4096)
+                marker = json.loads(raw)
+                if truncated or marker.get("schemaVersion") != 1 or marker.get("id") != created[0]:
+                    return None
+            except (OSError, ValueError, TypeError, AttributeError):
+                return None
+        return created[0]
+    elif owner["kind"] == "product":
+        matches = [identity for identity in created if state["identities"][identity]["project"] == record["project"]]
+        return matches[0] if len(matches) == 1 else None
+    return None
+
+
+def _artifact_entry(source, selected, record, preview_probe, scope):
     kind = record.get("kind")
     identity = record.get("id")
     cycle = record.get("cycleId")
     recorded = valid_time(record.get("recordedAt"))
-    if (record.get("version") != 1 or record.get("source") != "runner" or record.get("project") != selected
+    if (record.get("version") != 1 or record.get("source") != "runner"
             or kind not in {"document", "check", "preview"} or not isinstance(identity, str)
             or not ARTIFACT_ID.fullmatch(identity) or not recorded
             or (cycle is not None and (not isinstance(cycle, str) or not CYCLE_ID.fullmatch(cycle)))):
         return None
     relative = record.get("path")
+    recorded_project = record["project"]
+    associated, product_id = scope
     entry = {"id": identity, "kind": kind, "project": selected, "cycleId": cycle,
-             "associationStatus": "bound" if cycle else "unbound", "recordedAt": recorded,
+             "associationStatus": "bound" if associated and cycle else "product" if associated and product_id else "unbound", "recordedAt": recorded,
              "source": "runner", "label": relative or kind, "available": False,
-             "evidenceStatus": "unavailable"}
+             "evidenceStatus": "unavailable", "recordedProject": recorded_project, "productId": product_id}
+    if isinstance(relative, str) and relative.startswith(recorded_project + "/"):
+        entry["recordedPath"] = relative
+        relative = selected + relative[len(recorded_project):]
+        entry["path"] = relative
+    if not associated:
+        entry["associationStatus"] = "unknown"
+        return entry
     if kind == "preview":
         available = preview_probe and preview_available(record)
         state = record.get("state") if record.get("st
```

**File**: `i18n/messages.json` (modified, +8/-0)
```diff
@@ -87,6 +87,14 @@
     "en": "Service unloaded.",
     "zh-CN": "后台服务已卸载出运行环境。"
   },
+  "mac.query_failed": {
+    "en": "Could not inspect loaded LaunchAgents; no pause or stop was requested.",
+    "zh-CN": "无法检查已加载的 LaunchAgent；未请求暂停或停止。"
+  },
+  "mac.unload_failed": {
+    "en": "Service unload failed. Pause and stop markers are retained; retry Stop after resolving the launchctl error.",
+    "zh-CN": "后台服务卸载失败。已保留暂停和停止标记；处理 launchctl 错误后可重试停止。"
+  },
   "mac.removed": {
     "en": "Plist removed: {0}",
     "zh-CN": "已删除 plist：{0}"
```

**File**: `scripts/core/launchd-config.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def main() -> None:
             raw = args.validate.read_bytes() if args.validate else sys.stdin.buffer.read()
             validate(args.project, plistlib.loads(raw), args.validate_loaded)
         except (OSError, ValueError, TypeError, ExpatError, plistlib.InvalidFileException) as exc:
-            parser.exit(1, f"Error: cannot resume LaunchAgent: {exc}\n")
+            parser.exit(1, f"Error: cannot control LaunchAgent: {exc}\n")
         return
     if args.path is None:
         parser.error("--path is required with --output")
```

---

### Incident Patch 8: `a9685162` (2026-09-19)
**Commit Message**: Fix capture cancellation during process-state reads

**File**: `scripts/core/product_media.py` (modified, +14/-4)
```diff
@@ -347,21 +347,28 @@ def run_worker(project, profile, version, staging):
     atomic_json(staging / "request.json", request)
     command = [node, str(Path(__file__).with_name("product_media_worker.cjs")), str(staging / "request.json")]
     from product_media_process import ProcessScope
-    scope = ProcessScope(command)
-    process = scope.process
+    scope = None
     previous_signal = None
+    interrupted = False
     if threading.current_thread() is threading.main_thread():
         previous_signal = signal.getsignal(signal.SIGTERM)
 
         def interrupt_capture(_signal, _frame):
-            raise MediaError("capture_interrupted")
+            # Do not raise asynchronously: process-stat parsing catches
+            # ValueError, and a repeated signal must not interrupt teardown.
+            nonlocal interrupted
+            interrupted = True
 
         signal.signal(signal.SIGTERM, interrupt_capture)
     try:
+        scope = ProcessScope(command)
+        process = scope.process
         deadline = time.monotonic() + 45
         result_path = staging / "result.json"
         while not result_path.exists():
             scope.observe()
+            if interrupted:
+                raise MediaError("capture_interrupted")
             if process.poll() is not None:
                 raise MediaError("worker_terminated")
             if time.monotonic() >= deadline:
@@ -374,10 +381,13 @@ def interrupt_capture(_signal, _frame):
         return result
     finally:
         try:
-            stop_worker(scope)
+            if scope is not None:
+                stop_worker(scope)
         finally:
             if previous_signal is not None:
                 signal.signal(signal.SIGTERM, previous_signal)
+        if interrupted:
+            raise MediaError("capture_interrupted")
 
 
 def load_record(folder):
```

**File**: `tests/test_product_media.py` (modified, +68/-8)
```diff
@@ -22,7 +22,7 @@
                            content_version, digest, load_profile, media_folder, media_projection,
                            now, read_resource, validate_icon)
 from runtime_artifacts import finalize
-from product_media_process import ProcessScope
+from product_media_process import ProcessScope, proc_identity
 from product_icon_html import inspect_reference
 
 HEAD_REVIEW_CASES = {
@@ -637,21 +637,75 @@ def test_readiness_timeout_cleans_preview_and_does_not_publish_success(self):
 
     @unittest.skipIf(os.name == "nt", "POSIX SIGTERM cleanup is verified on Linux")
     def test_interrupted_capture_reaps_preview_without_waiting_for_watchdog(self):
+        self.assert_interrupted_capture_reaps_scope()
+
+    @unittest.skipUnless(Path("/proc").is_dir(), "Deterministic process-scan interruption requires Linux procfs")
+    def test_sigterm_during_process_scan_is_not_swallowed(self):
+        self.assert_interrupted_capture_reaps_scope(interrupt_scan=True)
+
+    def assert_interrupted_capture_reaps_scope(self, interrupt_scan=False):
         self.node_server(spawn_descendant=True)
         profile = load_profile(self.project)
         profile.update(readySelector="#never-present", timeoutSeconds=15)
         self.write_profile(profile)
         command = [sys.executable, str(ROOT / "scripts/core/runtime_artifacts.py"), "--root", str(self.root), "--project", self.name, "media"]
-        process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
+        if interrupt_scan:
+            # Deliver a real SIGTERM inside proc_identity's guarded stat read.
+            # A ValueError raised by the handler used to disappear there.
+            launcher = self.root / "interrupt-scan.py"
+            launcher.write_text("""import os, runpy, signal, sys, time
+from pathlib import Path
+original = Path.read_text
+root = Path(sys.argv[1])
+injected = False
+def read_stat(path, *args, **kwargs):
+    global injected
+    if not injected and path.name == 'stat' and path.parent.parent == Path('/proc') and (root / 'projects/example/.preview-port').exists():
+        injected = True
+        (root / 'scan-ready').touch()
+        deadline = time.monotonic() + 10
+        while not (root / 'interrupt-now').exists() and time.monotonic() < deadline:
+            time.sleep(0.01)
+        os.kill(os.getpid(), signal.SIGTERM)
+    return original(path, *args, **kwargs)
+Path.read_text = read_stat
+sys.argv = sys.argv[2:]
+sys.path.insert(0, str(Path(sys.argv[0]).parent))
+from product_media_process import ProcessScope
+close_scope = ProcessScope.close
+def interrupt_cleanup(scope):
+    os.kill(os.getpid(), signal.SIGTERM)
+    (root / 'cleanup-interrupted').touch()
+    return close_scope(scope)
+ProcessScope.close = interrupt_cleanup
+runpy.run_path(sys.argv[0], run_name='__main__')
+""", encoding="utf-8")
+            command = [sys.executable, str(launcher), str(self.root), *command[1:]]
+        sentinel = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
+        scope = ProcessScope(command)
+        process = scope.process
         try:
             deadline = time.monotonic() + 10
-            while not (self.project / ".preview-port").exists() and time.monotonic() < deadline and process.poll() is None:
+            ready = self.root / "scan-ready" if interrupt_scan else self.project / ".preview-port"
+            while not ready.exists() and time.monotonic() < deadline and process.poll() is None:
+                scope.observe()
                 time.sleep(0.05)
-            self.assertTrue((self.project / ".preview-port").exists())
+            self.assertTrue(ready.exists())
+            scope.observe()
+            owned = dict(scope.members)
+            browser_pids = [pid for pid in owned if (path := Path(f"/proc/{pid}/cmdline")).exists()
+                            and any(name in path.read_bytes() for name in (b"chromium", b"chrome"))]
+            if Path("/proc").is_dir():
+                self.assertTrue(browser_pids, "The owned scope must include the real Chromium processes")
             started = time.monotonic()
-            process.terminate()
+            if interrupt_scan:
+                (self.root / "interrupt-now").touch()
+            else:
+                process.terminate()
             process.wait(timeout=8)
             self.assertLess(time.monotonic() - started, 8)
+            if interrupt_scan:
+                self.assertTrue((self.root / "cleanup-interrupted").exists(), "Repeated SIGTERM must not abort cleanup")
             self.assertEqual(media_projection(self.root, self.name)["screenshot"]["state"], "interrupted")
             port = int((self.project / ".preview-port").read_text())
             with socket.socket() as client:
@@ -660,10 +714,16 @@ def test_interrupted_capture_reaps_preview_without_waiting_for_watchdog(self):
             pid = int((self.proj
```

---

### Incident Patch 9: `e05c3751` (2026-09-19)
**Commit Message**: Align regression fixtures with project-bound evidence

**File**: `docs/runtime-observability.md` (modified, +6/-3)
```diff
@@ -97,9 +97,12 @@ a cycle, not an implicit side effect. The loop finalizes unfinished checks as
 interrupted after existing process supervision ends; an unknown end time stays
 null rather than being replaced by cleanup time.
 
-Artifact records live in `logs/artifacts/`. The reader bounds discovery to
-501 entries, checks the newest 100 of those, and exposes up to 20 records and
-three loopback checks per refresh. It is not an unlimited artifact archive.
+Artifact records live in `logs/artifacts/`. The reader enumerates filenames and
+keeps the newest 500 by modification time/name in a fixed-size heap. It reads
+only those 500 records, at most 16 KiB each, and exposes up to 100 records and
+three loopback checks per refresh. `scannedRecords` reports all candidate names;
+`partial`/`truncated` explicitly mark omitted or invalid evidence. This is not
+an unlimited artifact archive.
 Lifecycle cleanup streams all record filenames, reading at most 16 KiB per
 regular file and handling one record at a time. Display limits never cause a
 later cycle-owned process or unfinished check to be excluded from cleanup.
```

**File**: `tests/browser/journal.spec.js` (modified, +12/-2)
```diff
@@ -1,5 +1,6 @@
 import { test as base, expect } from "@playwright/test";
 import { spawn } from "node:child_process";
+import { createHash } from "node:crypto";
 import fs from "node:fs/promises";
 import net from "node:net";
 import os from "node:os";
@@ -56,7 +57,16 @@ const test = base.extend({
     }));
     await fs.writeFile(path.join(directory, ".auto-company.local"), "ACTIVE_PROJECT=projects/journal-fixture\nAUTO_COMPANY_LANGUAGE=zh-CN\n");
     await fs.writeFile(path.join(directory, ".auto-loop-state"), "STATUS=stopped\nENGINE=codex\nMODEL=gpt-6-astra\nLOOP_COUNT=3\n");
-    await fs.writeFile(path.join(directory, "DELIVERY.md"), "# Browser fixture delivery\nThis document stays read-only.\n");
+    const deliveryText = "# Browser fixture delivery\nThis document stays read-only.\n";
+    const deliveryPath = "projects/journal-fixture/DELIVERY.md";
+    await fs.writeFile(path.join(directory, deliveryPath), deliveryText);
+    await fs.mkdir(path.join(directory, "logs/artifacts"), { recursive: true });
+    const recordedAt = new Date().toISOString();
+    await fs.writeFile(path.join(directory, "logs/artifacts/delivery.json"), JSON.stringify({
+      version: 1, id: "a".repeat(32), kind: "document", project: "projects/journal-fixture",
+      cycleId: cycles.at(-1).cycle_id, recordedAt, modifiedAt: recordedAt, source: "runner",
+      path: deliveryPath, sha256: createHash("sha256").update(deliveryText).digest("hex"),
+    }));
     // Exercise the optional backup route without relying on private local files
     // or keeping a second production dashboard in the repository.
     const legacyDirectory = path.join(directory, "legacy-backup");
@@ -142,7 +152,7 @@ test("usage preserves unknown coverage and artifacts open through the real serve
   await page.locator("#tab-usage").click();
   await expect(page.locator("body")).toContainText(/部分|未知|不完整/);
   await page.locator("#tab-work").click();
-  const delivery = page.locator('#projectSidebar a[href="/api/journal/document?path=DELIVERY.md"]');
+  const delivery = page.locator('#projectSidebar a[href="/api/journal/document?path=projects%2Fjournal-fixture%2FDELIVERY.md"]');
   await expect(delivery.first()).toBeVisible();
   const response = await page.request.get(new URL(await delivery.first().getAttribute("href"), journal.url).href);
   expect(response.ok()).toBeTruthy();
```

**File**: `tests/test_engine_adapters.py` (modified, +1/-1)
```diff
@@ -287,7 +287,7 @@ def test_loop_provider_error_exit_zero_is_recorded_as_failure(self) -> None:
         record = json.loads(ledger.read_text().splitlines()[0])
         self.assertEqual(record["status"], "failed")
         self.assertEqual(record["usage"]["total_tokens"], 3)
-        sidecar = json.loads(next((self.workspace / "logs").glob("cycle-*.json")).read_text())
+        sidecar = json.loads((self.workspace / "logs" / f"{record['cycle_id']}.json").read_text())
         self.assertEqual(sidecar["cycle_outcome"], "failure")
         self.assertIn("Adapter reported error", sidecar["failure_reason"])
 
```

---

### Incident Patch 10: `efd3fd75` (2026-09-19)
**Commit Message**: test: include cycle report reader in browser fixture

**File**: `docs/runtime-observability.md` (modified, +10/-7)
```diff
@@ -1,4 +1,4 @@
-# Runtime observations (local prototype)
+# Runtime observations and cycle work reports
 
 The Codex adapter projects its JSONL stream into `logs/<cycle-id>.events.jsonl`.
 The dashboard reads that stream while the cycle runs. No extra model calls or
@@ -53,16 +53,19 @@ require separate runner integration. A preview started inside a model cycle is
 owned by that cycle and ends during normal supervisor cleanup; keeping a preview
 alive is a separate operator action, not an implicit cycle side effect.
 
-Artifact records live in `logs/artifacts/`. The prototype bounds discovery to
+Artifact records live in `logs/artifacts/`. The reader bounds discovery to
 501 entries, checks the newest 100 of those, and exposes up to 20 records and
 three loopback checks per refresh. It is not an unlimited artifact archive.
 
-## Verification model
+## Verification settings
 
-`MODEL=gpt-5.6-luna CODEX_REASONING_EFFORT=high ENGINE=codex`.
-This is the local experiment's policy in ignored `AGENTS.md`; it is not a new
-production default. `CODEX_REASONING_EFFORT` is optional and does not substitute
-for observed configuration in the dashboard.
+Continuous-cycle verification covered both `MODEL=gpt-5.6-luna` and
+`MODEL=gpt-5.6-terra`, each with `CODEX_REASONING_EFFORT=high ENGINE=codex`.
+Each model completed three successive cycles with distinct session identities,
+live and final work reports, preserved historical reports and registered checks.
+These are bounded local verification settings, not new production defaults or a
+long-term reliability guarantee. `CODEX_REASONING_EFFORT` is optional and does
+not substitute for observed configuration in the dashboard.
 
 ## Cycle work report v1
 
```

**File**: `tests/browser/fixture-server.py` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ def main():
         shutil.copytree(REPO_ROOT / "dashboard", root / "dashboard")
         core = root / "scripts/core"
         core.mkdir(parents=True)
-        for name in ("localization.py", "usage_lib.py"):
+        for name in ("localization.py", "usage_lib.py", "cycle_reports.py"):
             shutil.copy2(REPO_ROOT / "scripts/core" / name, core / name)
         (root / "memories").mkdir()
         (root / "memories/consensus.md").write_text(
```

---

### Incident Patch 11: `6d50c529` (2026-09-19)
**Commit Message**: docs: refresh dashboard and product usage guidance

**File**: `README-ZH.md` (modified, +45/-17)
```diff
@@ -9,6 +9,8 @@
 
 默认使用 Claude Code，并支持 [Codex CLI](https://www.npmjs.com/package/@openai/codex)（macOS 原生 + Windows/WSL），两端都可启动本地 Dashboard。
 
+另有需要显式配置的 Cursor 与 OpenAI-compatible 可选适配器，能力与限制见[引擎适配说明](i18n/zh-CN/ENGINE_ADAPTERS.md)。
+
 [![macOS](https://img.shields.io/badge/平台-macOS-blue?logo=apple&logoColor=white)](#依赖)
 [![Windows WSL](https://img.shields.io/badge/平台-Windows%20WSL-blue?logo=windows&logoColor=white)](#windows-wsl-快速开始)
 [![Codex CLI](https://img.shields.io/badge/驱动-Codex%20CLI-orange?logo=data:image/svg%2Bxml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0yMi4yODE5IDkuODIxMWE1Ljk4NDcgNS45ODQ3IDAgMCAwLS41MTU3LTQuOTEwOCA2LjA0NjIgNi4wNDYyIDAgMCAwLTYuNTA5OC0yLjlBNi4wNjUxIDYuMDY1MSAwIDAgMCA0Ljk4MDcgNC4xODE4YTUuOTg0NyA1Ljk4NDcgMCAwIDAtMy45OTc3IDIuOSA2LjA0NjIgNi4wNDYyIDAgMCAwIC43NDI3IDcuMDk2NiA1Ljk4IDUuOTggMCAwIDAgLjUxMSA0LjkxMDcgNi4wNTEgNi4wNTEgMCAwIDAgNi41MTQ2IDIuOTAwMUE2LjA2NTEgNi4wNjUxIDAgMCAwIDE5LjAyIDE5LjgxODJhNS45ODQ3IDUuOTg0NyAwIDAgMCAzLjk5NzctMi45MDAxIDYuMDQ2MiA2LjA0NjIgMCAwIDAtLjczNTgtNy4wOTdaTTguNzQ5IDYuNzU3OGE0LjQxMTggNC40MTE4IDAgMCAxIDcuMzY3MyAxLjE0NDQgNC4zOTg2IDQuMzk4NiAwIDAgMS0uMjkyOCA0LjIyODVsLTQuNzA3LTIuNzIxNHYtMi42NTE1Wk02LjUzMzIgMTQuNjU0YTQuNDExOCA0LjQxMTggMCAwIDEtMS4xMjkzLTcuMzcgNC4zOTg2IDQuMzk4NiAwIDAgMSA0LjEzNTItMS4zOWwyLjM2MTUgNC4wOTN2NS4zMDJMNi41MzMyIDE0LjY1NFptLTEuODQ4LTEuNTcyYTQuNDExOCA0LjQxMTggMCAwIDEgNi4yMzgtNi4yMjYgNC4zOTg2IDQuMzk4NiAwIDAgMSAzLjg0MzMgMi44MzhsLTQuNzA3IDIuNzIxdjUuMzAxNUw0LjY4NTIgMTMuMDgyWm0xMC41NjU4IDQuMTZhNC40MTE4IDQuNDExOCAwIDAgMS03LjM2NzMtMS4xNDQzIDQuMzk4NiA0LjM5ODYgMCAwIDEgLjI5MjgtNC4yMjg1bDQuNzA3IDIuNzIxNHYyLjY1MTRabTIuMjE1OC03Ljg5NmE0LjQxMTggNC40MTE4IDAgMCAxIDEuMTI5MyA3LjM3IDQuMzk4NiA0LjM5ODYgMCAwIDEtNC4xMzUyIDEuMzlsLTIuMzYxNS00LjA5M1Y5LjE4Nmw1LjM2NzQgMi4xODZabTEuODQ4IDEuNTcyYTQuNDExOCA0LjQxMTggMCAwIDEtNi4yMzggNi4yMjYgNC4zOTg2IDQuMzk4NiAwIDAgMS0zLjg0MzMtMi44MzhsNC43MDctMi43MjFWOS4xODZsNS4zNzQgMy4wOTZaTTEyIDE2LjUxNmE0LjQxMTggNC40MTE4IDAgMCAxLTQuNDExOC00LjQxMThjMC0yLjQzNDggMS45NzctNC40MTE4IDQuNDExOC00LjQxMThzNC40MTE4IDEuOTc3IDQuNDExOCA0LjQxMTgtMS45NzcgNC40MTE4LTQuNDExOCA0LjQxMThaIi8+PC9zdmc+&logoColor=white)](https://www.npmjs.com/package/@openai/codex)
@@ -23,6 +25,8 @@
 
 ![Auto Company 看板](presentation/dashboard-showcase.png)
 
+新版看板按轮次展示工作汇报、成果、下一步和历史记录，并提供独立的用量与日志视图。截图使用已完成的 TableDelta 真实运行记录，以只读归档模式展示，不代表各 Agent 的实时活动。用量仅覆盖已记录的数据，缺失值保持未知，不等于完整账单。
+
 ## 这是什么？
 
 你启动一个循环。AI 团队醒来，读取共识记忆，决定干什么，组建 3-5 人小队，执行任务，更新共识记忆，然后睡一觉。接着又醒来。如此往复，永不停歇。
@@ -49,13 +53,26 @@ daemon (launchd / systemd --user, 崩溃自重启)
 
 人类仅下达启动指令和交付范围；从产品立项、方案讨论、设计开发到测试交付，均由 Agent 团队自主讨论、决策并执行，过程中无需人工介入。
 
-![行间 / TableDelta：CSV 差异核对结果](projects/tabledelta/docs/images/desktop-result.png)
-
-**行间 / TableDelta**：对比两份 CSV，查看新增、删除和修改，并导出变化报告。[查看源码](projects/tabledelta/)
-
-![幕检 / CueCheck：字幕检查与编辑工作台](projects/cuecheck/docs/images/desktop-result.png)
-
-**幕检 / CueCheck**：检查 SRT 字幕的时码、重叠与阅读速度，支持逐条编辑、重检和导出。[查看源码](projects/cuecheck/)
+<table>
+  <tr>
+    <th width="50%">行间 / TableDelta</th>
+    <th width="50%">幕检 / CueCheck</th>
+  </tr>
+  <tr>
+    <td width="50%" valign="top"><a href="projects/tabledelta/docs/images/desktop-result.png"><img src="projects/tabledelta/docs/images/desktop-result.png" alt="行间 / TableDelta：CSV 差异核对结果" width="100%" /></a></td>
+    <td width="50%" valign="top"><a href="projects/cuecheck/docs/images/desktop-result.png"><img src="projects/cuecheck/docs/images/desktop-result.png" alt="幕检 / CueCheck：字幕检查与编辑工作台" width="100%" /></a></td>
+  </tr>
+  <tr>
+    <td width="50%" valign="top">
+      <p>对比两份 CSV，查看新增、删除和修改，并导出变化报告。</p>
+      <p><a href="projects/tabledelta/">查看源码 →</a></p>
+    </td>
+    <td width="50%" valign="top">
+      <p>检查 SRT 字幕的时码、重叠与阅读速度，支持逐条编辑、重检和导出。</p>
+      <p><a href="projects/cuecheck/">查看源码 →</a></p>
+    </td>
+  </tr>
+</table>
 
 ## 你该看哪一节（按平台）
 
@@ -108,26 +125,33 @@ daemon (launchd / systemd --user, 崩溃自重启)
 # 前提:
 # - macOS
 # - 已安装并登录 Codex CLI 或 Claude Code
+# - 已可用 Python 3.10+（python3）、Git 和 make
 # - 可用模型配额
 
 # 克隆
 git clone https://github.com/MaxMiksa/Auto-Company.git
 cd Auto-Company
 
-# 前台运行（直接看输出）
+# 使用 Claude Code 前台运行（默认引擎，直接看输出）
 make start
 
-# 或安装为守护进程（开机自启 + 崩溃自重启）
+# 或使用 Codex CLI 前台运行
+ENGINE=codex make start
+
+# 也可为所选引擎安装并启动守护进程
 make install
+# 使用 Codex 而非默认的 Claude：
+ENGINE=codex make install
 ```
 
 ## Windows (WSL) 快速开始
 
 ```powershell
 # 前提:
-# - Windows 10/11 + WSL2 (Ubuntu)
+# - Windows 10/11 + WSL2 (Ubuntu)，systemd --user 可用
 # - 已在 WSL 内安装并登录 Codex CLI 或 Claude Code
-# - WSL 内已可用 jq 和 make
+# - WSL 内已可用 Python 3.10+（python3）、Git 和 make
+# - Windows 端已安装 Python 3.10+（python），供 PowerShell 看板入口使用
 # - 可用模型配额
 
 # 克隆
@@ -159,13 +183,15 @@ cd Auto-Company
 | 实时日志 | `make monitor` | `.\scripts\windows\monitor-win.ps1` |
 | 最近一轮输出 | `make last` | `.\scripts\windows\last-win.ps1` |
 | 周期摘要 | `make cycles` | `.\scripts\windows\cycles-win.ps1` |
-| 停止 | `make stop` | `.\scripts\windows\stop-win.ps1` |
+| 停止 | 前台：`make stop`；后台守护：`make pa
```

**File**: `README.md` (modified, +45/-17)
```diff
@@ -9,6 +9,8 @@ They ideate products, make decisions, write code, deploy, and market - without h
 
 Powered by Claude Code (default) and [Codex CLI](https://www.npmjs.com/package/@openai/codex) on macOS + Windows/WSL, with a local dashboard on both hosts.
 
+Optional Cursor and OpenAI-compatible adapters require explicit configuration. See the [adapter guide](ENGINE_ADAPTERS.md) for their capabilities and limits.
+
 [![macOS](https://img.shields.io/badge/Platform-macOS-blue?logo=apple&logoColor=white)](#dependencies)
 [![Windows WSL](https://img.shields.io/badge/Platform-Windows%20WSL-blue?logo=windows&logoColor=white)](#windows-wsl-quick-start)
 [![Codex CLI](https://img.shields.io/badge/Engine-Codex%20CLI-orange?logo=data:image/svg%2Bxml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0yMi4yODE5IDkuODIxMWE1Ljk4NDcgNS45ODQ3IDAgMCAwLS41MTU3LTQuOTEwOCA2LjA0NjIgNi4wNDYyIDAgMCAwLTYuNTA5OC0yLjlBNi4wNjUxIDYuMDY1MSAwIDAgMCA0Ljk4MDcgNC4xODE4YTUuOTg0NyA1Ljk4NDcgMCAwIDAtMy45OTc3IDIuOSA2LjA0NjIgNi4wNDYyIDAgMCAwIC43NDI3IDcuMDk2NiA1Ljk4IDUuOTggMCAwIDAgLjUxMSA0LjkxMDcgNi4wNTEgNi4wNTEgMCAwIDAgNi41MTQ2IDIuOTAwMUE2LjA2NTEgNi4wNjUxIDAgMCAwIDE5LjAyIDE5LjgxODJhNS45ODQ3IDUuOTg0NyAwIDAgMCAzLjk5NzctMi45MDAxIDYuMDQ2MiA2LjA0NjIgMCAwIDAtLjczNTgtNy4wOTdaTTguNzQ5IDYuNzU3OGE0LjQxMTggNC40MTE4IDAgMCAxIDcuMzY3MyAxLjE0NDQgNC4zOTg2IDQuMzk4NiAwIDAgMS0uMjkyOCA0LjIyODVsLTQuNzA3LTIuNzIxNHYtMi42NTE1Wk02LjUzMzIgMTQuNjU0YTQuNDExOCA0LjQxMTggMCAwIDEtMS4xMjkzLTcuMzcgNC4zOTg2IDQuMzk4NiAwIDAgMSA0LjEzNTItMS4zOWwyLjM2MTUgNC4wOTN2NS4zMDJMNi41MzMyIDE0LjY1NFptLTEuODQ4LTEuNTcyYTQuNDExOCA0LjQxMTggMCAwIDEgNi4yMzgtNi4yMjYgNC4zOTg2IDQuMzk4NiAwIDAgMSAzLjg0MzMgMi44MzhsLTQuNzA3IDIuNzIxdjUuMzAxNUw0LjY4NTIgMTMuMDgyWm0xMC41NjU4IDQuMTZhNC40MTE4IDQuNDExOCAwIDAgMS03LjM2NzMtMS4xNDQzIDQuMzk4NiA0LjM5ODYgMCAwIDEgLjI5MjgtNC4yMjg1bDQuNzA3IDIuNzIxNHYyLjY1MTRabTIuMjE1OC03Ljg5NmE0LjQxMTggNC40MTE4IDAgMCAxIDEuMTI5MyA3LjM3IDQuMzk4NiA0LjM5ODYgMCAwIDEtNC4xMzUyIDEuMzlsLTIuMzYxNS00LjA5M1Y5LjE4Nmw1LjM2NzQgMi4xODZabTEuODQ4IDEuNTcyYTQuNDExOCA0LjQxMTggMCAwIDEtNi4yMzggNi4yMjYgNC4zOTg2IDQuMzk4NiAwIDAgMS0zLjg0MzMtMi44MzhsNC43MDctMi43MjFWOS4xODZsNS4zNzQgMy4wOTZaTTEyIDE2LjUxNmE0LjQxMTggNC40MTE4IDAgMCAxLTQuNDExOC00LjQxMThjMC0yLjQzNDggMS45NzctNC40MTE4IDQuNDExOC00LjQxMThzNC40MTE4IDEuOTc3IDQuNDExOCA0LjQxMTgtMS45NzcgNC40MTE4LTQuNDExOCA0LjQxMThaIi8+PC9zdmc+&logoColor=white)](https://www.npmjs.com/package/@openai/codex)
@@ -23,6 +25,8 @@ Powered by Claude Code (default) and [Codex CLI](https://www.npmjs.com/package/@
 
 ![Auto Company Dashboard](presentation/dashboard-showcase.png)
 
+The current dashboard shows per-cycle work reports, results, next steps, and history, with separate usage and log views. This screenshot uses real records from a completed TableDelta run in read-only archive mode; it does not show live agent activity. Usage covers recorded data only; missing values remain unknown and do not represent a complete bill.
+
 ## What Is This?
 
 You start a loop. The AI team wakes up, reads shared consensus memory, decides what to do, forms a 3-5 person squad, executes, updates consensus memory, then sleeps briefly. Then it repeats.
@@ -49,13 +53,26 @@ These independent applications were created through autonomous Auto-Company runs
 
 Humans supplied only the instruction to start and the delivery scope. From product selection and planning through design, development, testing, and delivery, the Agent team discussed, decided, and executed autonomously, with no human intervention in that process.
 
-![TableDelta: CSV comparison results](projects/tabledelta/docs/images/desktop-result.png)
-
-**行间 / TableDelta**: Compare two CSV files, inspect added, removed, and changed records, and export a change report. [View source](projects/tabledelta/)
-
-![CueCheck: subtitle checking and editing workspace](projects/cuecheck/docs/images/desktop-result.png)
-
-**幕检 / CueCheck**: Check SRT subtitle timing, overlaps, and reading speed; edit individual subtitles, recheck, and export. [View source](projects/cuecheck/)
+<table>
+  <tr>
+    <th width="50%">行间 / TableDelta</th>
+    <th width="50%">幕检 / CueCheck</th>
+  </tr>
+  <tr>
+    <td width="50%" valign="top"><a href="projects/tabledelta/docs/images/desktop-result.png"><img src="projects/tabledelta/docs/images/desktop-result.png" alt="TableDelta: CSV comparison results" width="100%" /></a></td>
+    <td width="50%" valign="top"><a href="projects/cuecheck/docs/images/desktop-result.png"><img src="projects/cuecheck/docs/images/desktop-result.png" alt="CueCheck: subtitle checking and editing workspace" width="100%" /></a></td>
+  </tr>
+  <tr>
+    <td width="50%" valign="top">
+      <p>Compare two CSV files, inspect added, removed, and changed records, and export a change report.</p>
+      <p><a href="projects/tabledelta/">View source →</a></p>
+    </td>
+    <td width="50%" valign="top">
+      <p>Check SRT subtitle timing, overlaps, and reading speed; edit individual subtitles, recheck,
```

**File**: `projects/snapog/README.md` (modified, +16/-9)
```diff
@@ -1,13 +1,14 @@
 # SnapOG
 
-Generate stunning Open Graph images via API — hosted on Cloudflare Workers, cached globally on R2, sub-100ms on cache hit.
+An Open Graph image API prototype built for Cloudflare Workers, with D1 usage records and R2 image caching. This example is intended for local evaluation and deployment to your own account. Hosted-service availability and cache-hit latency have not been verified for this source snapshot.
 
 ## Quick Start
 
+Follow [Local Development](#local-development) to start your own instance, then open its `/register` page to create a test API key. The examples below use a local server. References to `snapog.dev` in the prototype's branding are not a verified hosted-service entrypoint.
+
 ```bash
-# Get a free API key at https://snapog.dev/register, then:
-curl "https://snapog.dev/og?title=My+Blog+Post&domain=myblog.com&key=sk_YOUR_KEY" \
-  --output og.png && open og.png
+curl "http://127.0.0.1:8787/og?title=My+Blog+Post&domain=myblog.com&key=sk_YOUR_KEY" \
+  --output og.png
 ```
 
 ## API
@@ -32,24 +33,28 @@ Headers:
 
 ## HTML Integration
 
+After deploying your own instance, replace `YOUR_DEPLOYMENT_HOST` and `YOUR_KEY` below. A local address is not reachable by social preview crawlers.
+
 ```html
 <meta property="og:image"
-      content="https://snapog.dev/og?title=YOUR_TITLE&key=YOUR_KEY" />
+      content="https://YOUR_DEPLOYMENT_HOST/og?title=YOUR_TITLE&key=YOUR_KEY" />
 <meta property="og:image:width"  content="1200" />
 <meta property="og:image:height" content="630" />
 <meta name="twitter:card"   content="summary_large_image" />
-<meta name="twitter:image"  content="https://snapog.dev/og?title=YOUR_TITLE&key=YOUR_KEY" />
+<meta name="twitter:image"  content="https://YOUR_DEPLOYMENT_HOST/og?title=YOUR_TITLE&key=YOUR_KEY" />
 ```
 
-## Pricing
+## Demo Tiers
 
-| Tier | Price | Images/month |
+The prototype displays the following proposed prices and implements per-key monthly request limits. Registration accepts a tier selection without payment verification; there is no implemented subscription checkout. These are demo settings, not purchasable plans.
+
+| Tier | Proposed price (demo only) | Requests/key/month |
 |------|-------|-------------|
 | Free | $0 | 100 |
 | Pro | $19/mo | 10,000 |
 | Business | $49/mo | 100,000 |
 
-Free tier images include "snapog.dev" watermark.
+Cache hits also count toward these limits. Free tier images include a "snapog.dev" watermark as prototype branding.
 
 ## Local Development
 
@@ -99,6 +104,8 @@ npm run typecheck
 
 ## Deployment
 
+Deploy to resources you control after reviewing the prototype's authentication and tier handling. The checked-in D1 database ID is a placeholder; replace it with your own. Deploying this code does not add payment verification or turn the demo prices into subscriptions.
+
 ```bash
 # 1. Create remote D1 database
 wrangler d1 create snapog-db
```

---

### Incident Patch 12: `6b632b53` (2026-09-18)
**Commit Message**: fix(runtime): confirm stop cleanup and preserve interrupted cycle evidence

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -145,6 +145,8 @@ logs/
 .auto-loop-awake.pid
 .auto-loop-awake.stop
 .auto-loop-wsl-anchor.pid
+.auto-loop-wsl-anchor.linux
+.auto-loop-stop-pending
 .auto-loop-wsl-anchor.stop
 memories/consensus.md.bak
 
```

**File**: `dashboard/app.js` (modified, +13/-9)
```diff
@@ -22,11 +22,11 @@
     return text.length > length ? `${text.slice(0, length).trim()}…` : text;
   }
   function statusLabel(status) {
-    return ['completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
+    return ['stopping', 'stop_failed', 'completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
   }
   function readOnly() { return state.data?.readOnly !== false; }
   function liveProcess() { return !readOnly() && !state.statusFailed && state.data?.runtime?.processState === 'running'; }
-  function runtimeLabel() { return statusLabel(state.statusFailed ? 'unavailable' : state.data?.runtime?.state); }
+  function runtimeLabel() { return statusLabel(state.action === 'stop' ? 'stopping' : state.data?.control?.stopUnconfirmed ? (state.data?.control?.action === 'stop' ? 'stopping' : 'stop_failed') : state.statusFailed ? 'unavailable' : state.data?.runtime?.state); }
   function pauseLabel(value) { return message(`pause_${value}`) === `pause_${value}` ? String(value || '') : message(`pause_${value}`); }
   async function fetchJSON(url, options = {}, timeout = 100000) {
     const controller = new AbortController();
@@ -261,13 +261,15 @@
     const runtime = data?.runtime || {};
     const unavailable = state.statusFailed || runtime.available === false;
     const process = runtime.processState || runtime.state;
-    const locked = !data || readOnly() || unavailable || Boolean(state.action);
+    const action = state.action || data?.control?.action;
+    const retryStop = data?.control?.stopUnconfirmed === true;
+    const locked = !data || readOnly() || (unavailable && !retryStop) || Boolean(action);
     $('runtimeState').textContent = runtimeLabel();
     $('runtimeState').dataset.state = unavailable ? 'unavailable' : runtime.state || 'unknown';
-    $('startButton').disabled = locked || !['stopped', 'inactive'].includes(process);
-    $('stopButton').disabled = locked || process !== 'running';
-    $('startButton').textContent = message(state.action === 'start' ? 'starting' : 'start');
-    $('stopButton').textContent = message(state.action === 'stop' ? 'stopping' : 'stop');
+    $('startButton').disabled = locked || retryStop || !['stopped', 'inactive'].includes(process);
+    $('stopButton').disabled = locked || (!retryStop && process !== 'running');
+    $('startButton').textContent = message(action === 'start' ? 'starting' : 'start');
+    $('stopButton').textContent = message(action === 'stop' ? 'stopping' : 'stop');
     $('startButton').title = $('stopButton').title = readOnly() ? message('readOnly') : unavailable ? message('statusUnavailable') : '';
     $('refreshButton').disabled = Boolean(state.refreshPending || state.action);
     $('modeNote').textContent = data ? message(readOnly() ? 'preview' : 'live') : '';
@@ -633,17 +635,19 @@
     clearTimeout(state.timer);
     renderRuntime();
     actionMessage('actionPending', { action: message(action) });
-    if (state.refreshPending) await state.refreshPending;
+    if (action === 'start' && state.refreshPending) await state.refreshPending;
     try {
       // Recheck after any in-flight status read before mutating the runtime.
       const process = state.data?.runtime?.processState || state.data?.runtime?.state;
-      if (readOnly() || state.statusFailed || (action === 'start' ? !['stopped', 'inactive'].includes(process) : process !== 'running')) throw new Error(message('stateChanged'));
+      const retryStop = action === 'stop' && state.data?.control?.stopUnconfirmed === true;
+      if (readOnly() || (!retryStop && (state.statusFailed || (action === 'start' ? !['stopped', 'inactive'].includes(process) : process !== 'running')))) throw new Error(message('stateChanged'));
       const result = await fetchJSON(`/api/action/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, 120000);
       if (result.ok !== true) throw new Error('Action not confirmed');
       actionMessage('actionComplete', { action: message(action) });
     } catch (error) {
       actionMessage('actionFailed', { action: message(action), detail: error.name === 'AbortError' ? message('actionUnconfirmed') : error.message || message('actionUnconfirmed') }, true);
     } finally {
+      if (state.refreshPending) await state.refreshPen
```

**File**: `dashboard/i18n.js` (modified, +2/-0)
```diff
@@ -129,6 +129,7 @@ window.JOURNAL_MESSAGES = {
     "stop": "停止运行",
     "starting": "正在启动…",
     "stopping": "正在停止…",
+    "stop_failed": "停止未完成，请重试停止",
     "running": "运行中",
     "idle": "等待下一轮",
     "paused": "已暂停",
@@ -344,6 +345,7 @@ window.JOURNAL_MESSAGES = {
     "stop": "Stop run",
     "starting": "Starting…",
     "stopping": "Stopping…",
+    "stop_failed": "Stop incomplete — retry Stop",
     "running": "Running",
     "idle": "Waiting for next cycle",
     "paused": "Paused",
```

**File**: `dashboard/server.py` (modified, +32/-0)
```diff
@@ -14,6 +14,7 @@
 import subprocess
 import sys
 import time
+import threading
 from datetime import datetime, timezone
 from http import HTTPStatus
 from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
@@ -50,6 +51,9 @@
 CONSENSUS_FILE = REPO_ROOT / "memories" / "consensus.md"
 BUDGET_PAUSE_FILE = REPO_ROOT / ".auto-loop-budget-paused"
 
+CONTROL_LOCK = threading.Lock()
+CONTROL_ACTION = ""
+
 WINDOWS_HOST = "windows"
 MACOS_HOST = "macos"
 LINUX_HOST = "linux"
@@ -614,6 +618,12 @@ def gather_journal_payload() -> dict[str, Any]:
     except (OSError, ValueError):
         payload["budgetPause"] = None
         payload["warnings"].append("budget_pause_unavailable")
+    # Keep cleanup failures visible after reload, even if the model already exited.
+    control = {"action": CONTROL_ACTION,
+               "stopUnconfirmed": (REPO_ROOT / ".auto-loop-stop-pending").exists()}
+    payload["control"] = control
+    if control["action"] == "stop" or control["stopUnconfirmed"]:
+        payload["runtime"]["state"] = "stopping" if control["action"] == "stop" else "stop_failed"
     return payload
 
 
@@ -752,6 +762,7 @@ def do_GET(self) -> None:  # noqa: N802
         self._text("Not found", code=404)
 
     def do_POST(self) -> None:  # noqa: N802
+        global CONTROL_ACTION
         if not self._request_allowed():
             return
         if self.headers.get("Content-Type", "").split(";", 1)[0] != "application/json":
@@ -781,12 +792,33 @@ def do_POST(self) -> None:  # noqa: N802
             return
 
         action = path.rsplit("/", 1)[-1]
+        mutating = action in {"start", "stop"}
+        if mutating and not CONTROL_LOCK.acquire(blocking=False):
+            self._json({"ok": False, "error": "A runtime action is already in progress."},
+                       code=HTTPStatus.CONFLICT)
+            return
+        pending = REPO_ROOT / ".auto-loop-stop-pending"
         try:
+            if action == "start" and pending.exists():
+                self._json({"ok": False, "error": "Stop cleanup is unconfirmed. Retry Stop first."},
+                           code=HTTPStatus.CONFLICT)
+                return
+            if mutating:
+                CONTROL_ACTION = action
+            if action == "stop":
+                pending.write_text("stopping\n", encoding="utf-8")
+                (REPO_ROOT / ".auto-loop-stop").touch()
             result = run_dashboard_action(action)
+            if action == "stop" and result["ok"]:
+                pending.unlink(missing_ok=True)
         except (subprocess.TimeoutExpired, OSError) as exc:
             self._json({"ok": False, "output": f"Dashboard action failed: {exc}"},
                        code=HTTPStatus.GATEWAY_TIMEOUT)
             return
+        finally:
+            if mutating:
+                CONTROL_ACTION = ""
+                CONTROL_LOCK.release()
         payload = {
             "timestamp": datetime.now(timezone.utc).isoformat(),
             "action": action,
```

**File**: `scripts/core/auto-loop.sh` (modified, +19/-0)
```diff
@@ -261,6 +261,25 @@ cleanup() {
         final_state="process_cleanup_failed"
         log "Process-tree cleanup could not be confirmed for cycle PGID ${CYCLE_SUPERVISOR_LAST_PGID}"
     else
+        # A signal interrupts adapter_execute before it can publish its output.
+        # Preserve already emitted evidence after the owned process tree exits.
+        if [ -n "${ADAPTER_OUTPUT_FILE:-}" ] && [ -f "$ADAPTER_OUTPUT_FILE" ] &&
+           [ -f "${USAGE_FILE}.pending" ]; then
+            ADAPTER_OUTPUT=$(adapter_redact < "$ADAPTER_OUTPUT_FILE")
+            printf '%s\n' "$ADAPTER_OUTPUT" > "$cycle_log"
+            ADAPTER_RESULT_SOURCE="$ADAPTER_OUTPUT"
+            ADAPTER_EXIT_CODE=130
+            ADAPTER_TIMED_OUT=0
+            engine_adapter_extract_metadata
+            cycle_record="${cycle_log%.log}.json"
+            engine_adapter_write_record "$cycle_record" interrupted "Stopped by operator"
+            cycle_ended_at=$(date '+%Y-%m-%dT%H:%M:%S%z')
+            CYCLE_LEDGER_STATUS=interrupted
+            EXIT_CODE=130
+            record_cycle_usage >/dev/null
+            rm -f "$ADAPTER_OUTPUT_FILE"
+            ADAPTER_OUTPUT_FILE=""
+        fi
         # The engine must be stopped before restoring its interrupted governance baseline.
         "$CONSENSUS_GUARD" recover || true
     fi
```

**File**: `scripts/core/engine-adapters.sh` (modified, +2/-0)
```diff
@@ -359,6 +359,7 @@ engine_adapter_description() {
 adapter_execute() {
     local output_file
     output_file=$(mktemp)
+    ADAPTER_OUTPUT_FILE="$output_file"
 
     cycle_supervisor_run \
         "$CYCLE_TIMEOUT_SECONDS" \
@@ -373,6 +374,7 @@ adapter_execute() {
 
     ADAPTER_OUTPUT=$(adapter_redact < "$output_file")
     rm -f "$output_file"
+    ADAPTER_OUTPUT_FILE=""
     if [ "$ADAPTER_TIMED_OUT" -eq 1 ]; then
         ADAPTER_EXIT_CODE=124
     fi
```

**File**: `scripts/core/loop-lock.py` (modified, +14/-1)
```diff
@@ -8,9 +8,10 @@
 import signal
 import subprocess
 import sys
+import time
 
 
-def stop(pid_file: str, script: str) -> int:
+def stop(pid_file: str, script: str, wait_seconds: str = "0") -> int:
     descriptor = os.open(pid_file, os.O_RDWR | os.O_CREAT, 0o600)
     try:
         fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
@@ -43,6 +44,18 @@ def stop(pid_file: str, script: str) -> int:
         else:
             os.kill(pid, signal.SIGTERM)
         print(f"Sent SIGTERM to the owned loop (PID {pid}).")
+        # Dashboard service stop waits for the existing owner to seal records
+        # before systemd sends its broader control-group termination signal.
+        deadline = time.monotonic() + float(wait_seconds)
+        while float(wait_seconds) > 0:
+            try:
+                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
+                break
+            except BlockingIOError:
+                if time.monotonic() >= deadline:
+                    print("Loop cleanup did not finish before the stop deadline.", file=sys.stderr)
+                    return 1
+                time.sleep(0.05)
     except (ProcessLookupError, FileNotFoundError):
         print("Loop owner has already exited.")
     finally:
```

**File**: `scripts/core/stop-loop.sh` (modified, +4/-1)
```diff
@@ -31,7 +31,7 @@ stop_loop_process() {
     fi
 
     # Validate the held lock and exact script identity before signalling a PID.
-    python3 "$SCRIPT_DIR/loop-lock.py" --stop "$PID_FILE" "$SCRIPT_DIR/auto-loop.sh"
+    python3 "$SCRIPT_DIR/loop-lock.py" --stop "$PID_FILE" "$SCRIPT_DIR/auto-loop.sh" "${1:-0}"
 }
 
 pause_daemon() {
@@ -79,6 +79,9 @@ resume_daemon() {
 }
 
 case "${1:-}" in
+    --wait)
+        stop_loop_process 20
+        ;;
     --pause-daemon)
         pause_daemon
         ;;
```

---

### Incident Patch 13: `3c3eba19` (2026-09-18)
**Commit Message**: test: include journal module in isolated macOS fixtures

**File**: `tests/test_launchd_installation.py` (modified, +2/-1)
```diff
@@ -43,7 +43,8 @@ def setUp(self):
         self.plist.parent.mkdir(parents=True)
         shutil.copytree(REPO / "scripts", self.project / "scripts")
         (self.project / "dashboard").mkdir()
-        shutil.copy2(REPO / "dashboard/server.py", self.project / "dashboard/server.py")
+        for name in ("server.py", "journal_data.py"):
+            shutil.copy2(REPO / "dashboard" / name, self.project / "dashboard" / name)
         for relative in ("scripts/core/launchd-config.py", "scripts/core/stop-loop.sh",
                          "scripts/macos/install-daemon.sh", "scripts/macos/start-daemon.sh",
                          "scripts/macos/launchd-job.py"):
```

**File**: `tests/test_macos_start.py` (modified, +2/-1)
```diff
@@ -28,7 +28,8 @@ def setUp(self):
         self.project = self.root / 'Repo & "trial"'
         shutil.copytree(REPO / "scripts", self.project / "scripts")
         (self.project / "dashboard").mkdir()
-        shutil.copy2(REPO / "dashboard/server.py", self.project / "dashboard/server.py")
+        for name in ("server.py", "journal_data.py"):
+            shutil.copy2(REPO / "dashboard" / name, self.project / "dashboard" / name)
         self.home = self.root / "home"
         self.plist = self.home / f"Library/LaunchAgents/{LABEL}.plist"
         self.plist.parent.mkdir(parents=True)
```

---

### Incident Patch 14: `99461c8f` (2026-09-18)
**Commit Message**: ci: require routed checks and add browser and example coverage

**File**: `.github/CI.md` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+# Continuous integration
+
+Every pull request and push to `main` starts **Auto Company Runtime CI**. The
+`CI gate` job reports whether all checks selected for that change succeeded.
+Only this aggregate job should be a required status check on `main`.
+
+| Change | Checks |
+| --- | --- |
+| Runtime, configuration, or runtime tests | Windows PowerShell 5.1/7, Python, macOS launchd, Shell syntax, Linux systemd and runtime contracts |
+| Dashboard or its runtime/language dependencies | Dashboard Chromium smoke tests, in addition to applicable runtime checks |
+| A published example under `projects/` | That example's core tests (TableDelta/CueCheck) or type check (SnapOG) |
+| CI workflow or routing policy | All checks |
+| Ordinary documentation only | Successful routing and aggregate gate; test jobs explicitly skipped |
+
+Unknown file areas or unavailable comparison commits conservatively select all
+checks. A manual run always selects all checks. Renamed and deleted paths are
+included in routing. Selected jobs must succeed: failure, cancellation, missing
+results, or unexpected skipping fail the gate.
+
+Do not add workflow-level path filters or use skip-CI commit messages: a required
+workflow that never starts cannot report a result. Keep the required check name
+`CI gate` stable. The workflow has read-only repository permissions and does not
+use deployment credentials, paid models, or self-hosted machines.
+
+## Browser smoke tests
+
+```sh
+cd tests/browser
+npm ci
+npx playwright install --with-deps chromium
+npm test
+```
+
+The browser opens the actual Dashboard and Python HTTP handler against a fresh
+temporary workspace. Host service operations are isolated. The tests exercise
+page controls, saved language, current/next product language, and API failures.
+They do not start the user's company service or an AI engine.
+
+## Failure evidence and maintenance
+
+Each test command streams its output to the Actions log and a `ci-results/` file.
+Failed test jobs upload their logs for 14 days. Browser failures also retain the
+HTML report, screenshots, and Playwright traces. Setup failures before evidence
+exists remain visible in the Actions step log. The run summary shows routing,
+command results, and the final gate decision.
+
+Actions are pinned to full commit SHAs with release-version comments. Dependabot
+opens weekly update PRs for Actions and the browser test dependency. Updates must
+pass the same CI gate; they are not automatically merged.
```

**File**: `.github/dependabot.yml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+version: 2
+updates:
+  - package-ecosystem: github-actions
+    directory: /
+    schedule:
+      interval: weekly
+    open-pull-requests-limit: 3
+    groups:
+      github-actions:
+        patterns: ['*']
+  - package-ecosystem: npm
+    directory: /tests/browser
+    schedule:
+      interval: weekly
+    open-pull-requests-limit: 3
```

**File**: `.github/workflows/auto-company-runtime-ci.yml` (modified, +230/-95)
```diff
@@ -1,146 +1,136 @@
+# Always start this workflow so the required CI gate can report on every PR.
 name: Auto Company Runtime CI
-
-"on":
-  pull_request:
-    paths:
-      - ".github/workflows/auto-company-runtime-ci.yml"
-      - ".claude/**"
-      - ".gitattributes"
-      - ".gitignore"
-      - "CLAUDE.md"
-      - "ENGINE_ADAPTERS.md"
-      - "INDEX.md"
-      - "Makefile"
-      - "PROMPT.md"
-      - "README.md"
-      - "README-ZH.md"
-      - "dashboard/**"
-      - "i18n/**"
-      - "docs/**"
-      - "memories/**"
-      - "package.json"
-      - "projects/README.md"
-      - "projects/registry.tsv"
-      - "scripts/**"
-      - "tests/**"
-      - "**/*.sh"
+'on':
+  pull_request: null
   push:
     branches:
       - main
-    paths:
-      - ".github/workflows/auto-company-runtime-ci.yml"
-      - ".claude/**"
-      - ".gitattributes"
-      - ".gitignore"
-      - "CLAUDE.md"
-      - "ENGINE_ADAPTERS.md"
-      - "INDEX.md"
-      - "Makefile"
-      - "PROMPT.md"
-      - "README.md"
-      - "README-ZH.md"
-      - "dashboard/**"
-      - "i18n/**"
-      - "docs/**"
-      - "memories/**"
-      - "package.json"
-      - "projects/README.md"
-      - "projects/registry.tsv"
-      - "scripts/**"
-      - "tests/**"
-      - "**/*.sh"
-  workflow_dispatch:
-
+  workflow_dispatch: null
 permissions:
   contents: read
-
 concurrency:
-  group: auto-company-runtime-${{ github.workflow }}-${{ github.ref }}
+  group: auto-company-runtime-${{ github.event_name }}-${{ github.ref }}
   cancel-in-progress: true
-
 jobs:
+  changes:
+    name: Select affected checks
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    outputs:
+      runtime: ${{ steps.select.outputs.runtime }}
+      browser: ${{ steps.select.outputs.browser }}
+      tabledelta: ${{ steps.select.outputs.tabledelta }}
+      cuecheck: ${{ steps.select.outputs.cuecheck }}
+      snapog: ${{ steps.select.outputs.snapog }}
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
+          fetch-depth: 0
+      - name: Select checks from the complete Git diff
+        id: select
+        run: python3 scripts/ci/changes.py
   windows-config:
     name: Windows configuration contracts
     runs-on: windows-latest
     timeout-minutes: 5
     steps:
       - name: Check out repository
-        uses: actions/checkout@v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           persist-credentials: false
-
       - name: Verify Windows PowerShell 5.1 configuration and paths
         shell: powershell
         run: |
-          ./tests/test_windows_start_config.ps1
-          ./tests/test_windows_wsl_paths.ps1
-          ./tests/test_windows_env_culture.ps1
-          ./tests/test_windows_messages.ps1
-
+          foreach ($test in @('start_config', 'wsl_paths', 'env_culture', 'messages')) {
+            python scripts/ci/run.py "powershell-$test" powershell -NoProfile -File "tests/test_windows_$test.ps1"
+            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
+          }
       - name: Verify PowerShell 7 configuration and paths
         shell: pwsh
         run: |
-          ./tests/test_windows_start_config.ps1
-          ./tests/test_windows_wsl_paths.ps1
-          ./tests/test_windows_env_culture.ps1
-          ./tests/test_windows_messages.ps1
-
+          foreach ($test in @('start_config', 'wsl_paths', 'env_culture', 'messages')) {
+            python scripts/ci/run.py "pwsh-$test" pwsh -NoProfile -File "tests/test_windows_$test.ps1"
+            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
+          }
+      - name: Save failure evidence
+        if: failure()
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        with:
+          name: windows-config-failure
+          path: ci-results/
+          retention-days: 14
+    needs: changes
+    if: needs.changes.outputs.runtime == 'true'
   python-tests:
     name: Python unit tests
     runs-on: ubuntu-latest
     timeout-minutes: 10
     steps:
       - name: Check out repository
-        uses: actions/checkout@v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           persist-credentials: false
-
       - name: Run standard-library test suite
-        run: python3 -m unittest discover -s tests -v
-
+        run: python3 scripts/ci/run.py python-tests-1 python3 -m unittest discover -s tests -v
       - name: Check bundled skill resource references
-        run: python3 scripts/check_skill_resources.py
-
+        run: python3 scripts/ci/run.py python-tests-2 python3 scripts/check_skill_resources.py
+      - name: Save failure evidence
+        if: failure()
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        with:
+          name: python-tests-failure
+          path: ci-results/
+     
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ htmlcov/
 .pytest_cache/
 nosetests.xml
 coverage.xml
+ci-results/
 *.cover
 *.py,cover
 .hypothesis/
```

**File**: `scripts/ci/changes.py` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+"""Route CI from the event's actual commit range, without shell interpolation."""
+
+import argparse
+import json
+import os
+from pathlib import Path
+import re
+import subprocess
+import sys
+
+
+ROUTES = ("runtime", "browser", "tabledelta", "cuecheck", "snapog")
+ROOT = Path(__file__).resolve().parents[2]
+SHA = re.compile(r"[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?\Z")
+RUNTIME_FILES = {
+    ".gitattributes", ".gitignore", "CLAUDE.md", "ENGINE_ADAPTERS.md",
+    "INDEX.md", "Makefile", "PROMPT.md", "package.json", "projects/registry.tsv",
+}
+RUNTIME_PREFIXES = (".claude/", "dashboard/", "i18n/", "memories/", "scripts/", "tests/")
+BROWSER_PREFIXES = (
+    "dashboard/", "i18n/", "scripts/core/", "scripts/windows/", "scripts/macos/",
+    "scripts/wsl/", "tests/browser/", "tests/fixtures/",
+)
+
+
+def all_routes():
+    return dict.fromkeys(ROUTES, True)
+
+
+def route_paths(paths):
+    selected = dict.fromkeys(ROUTES, False)
+    for path in paths:
+        if path.startswith((".github/workflows/", ".github/actions/", "scripts/ci/")) or path == "tests/test_ci_policy.py":
+            return all_routes()
+        product = next((name for name in ROUTES[2:] if path.startswith(f"projects/{name}/")), None)
+        if product:
+            selected[product] = True
+        runtime = path in RUNTIME_FILES or path.startswith(RUNTIME_PREFIXES) or path.endswith(".sh")
+        if runtime:
+            selected["runtime"] = True
+        if path.startswith(BROWSER_PREFIXES) or path.startswith("tests/test_dashboard"):
+            selected["browser"] = True
+        if product or runtime:
+            continue
+        # Ordinary prose and presentation assets explicitly need no test jobs.
+        if path.endswith(".md") or path.startswith(("docs/", "presentation/")) or path == "LICENSE":
+            continue
+        # A new build/config area must not silently escape CI coverage.
+        return all_routes()
+    return selected
+
+
+def git(repo, *args):
+    return subprocess.run(
+        ["git", "-C", str(repo), *args], stdout=subprocess.PIPE,
+        stderr=subprocess.PIPE, check=False,
+    )
+
+
+def commit_sha(value, field):
+    if not isinstance(value, str) or not SHA.fullmatch(value):
+        raise ValueError(f"Event has an invalid {field} commit SHA")
+    return value.lower()
+
+
+def changed_paths(repo, base, head):
+    result = git(repo, "diff", "--no-ext-diff", "--no-renames", "--name-only", "-z", base, head, "--")
+    if result.returncode:
+        raise RuntimeError("Git could not compare the event commits")
+    # Disabling rename detection preserves BOTH old and new names; -z preserves
+    # tabs/newlines and prevents Git's quoted-path representation changing routes.
+    return [os.fsdecode(path) for path in result.stdout.split(b"\0") if path]
+
+
+def select_routes(repo, event_name, event):
+    if event_name == "workflow_dispatch":
+        return all_routes(), "Manual run: all checks selected.", []
+    if event_name == "pull_request":
+        pr = event.get("pull_request", {})
+        base = commit_sha(pr.get("base", {}).get("sha"), "pull request base")
+        head = commit_sha(pr.get("head", {}).get("sha"), "pull request head")
+    elif event_name == "push":
+        base = commit_sha(event.get("before"), "push before")
+        head = commit_sha(event.get("after"), "push after")
+    else:
+        raise ValueError(f"Unsupported CI event: {event_name!r}")
+    for name, commit in (("head", head), ("base", base)):
+        if set(commit) == {"0"} or git(repo, "cat-file", "-e", f"{commit}^{{commit}}").returncode:
+            return all_routes(), f"Event {name} commit unavailable: conservatively selected all checks.", []
+    if event_name == "pull_request":
+        ancestor = git(repo, "merge-base", base, head)
+        if ancestor.returncode:
+            return all_routes(), "No pull request merge base: conservatively selected all checks.", []
+        base = commit_sha(ancestor.stdout.decode("ascii").strip(), "merge base")
+    paths = changed_paths(repo, base, head)
+    selected = route_paths(paths)
+    reason = f"Compared {len(paths)} changed path(s)."
+    if not any(selected.values()):
+        reason += " Documentation-only or empty change: test jobs explicitly skipped."
+    return selected, reason, paths
+
+
+def append_summary(selected, reason):
+    summary = os.environ.get("GITHUB_STEP_SUMMARY")
+    if summary:
+        lines = ["## CI change routing", "", reason, "", "| Check group | Selected |", "| --- | --- |"]
+        lines.extend(f"| {name} | {str(value).lower()} |" for name, value in selected.items())
+        with open(summary, "a", encoding="utf-8") as stream:
+            stream.write("\n".join(lines) + "\n")
+
+
+def main(argv=None):
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("--repo", type=Path, default=ROOT)
+    parser.add_argument("--event-name", default=os.environ.get("GITHUB_EVENT_NAME
```

**File**: `scripts/ci/gate.py` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+"""Require success from every selected CI job, including the routing job."""
+
+import json
+import os
+import sys
+
+
+JOBS = {
+    "runtime": ("windows-config", "python-tests", "macos-runtime", "shell-syntax", "shell-contracts"),
+    "browser": ("dashboard-browser",),
+    "tabledelta": ("tabledelta",),
+    "cuecheck": ("cuecheck",),
+    "snapog": ("snapog",),
+}
+
+
+def evaluate(needs):
+    errors = []
+    rows = []
+    if not isinstance(needs, dict):
+        return ["CI needs must be a JSON object."], rows
+    changes = needs.get("changes", {})
+    if not isinstance(changes, dict) or changes.get("result") != "success":
+        errors.append("The changes job did not succeed.")
+        changes = {}
+    outputs = changes.get("outputs", {})
+    if not isinstance(outputs, dict):
+        outputs = {}
+    for route, jobs in JOBS.items():
+        selected = outputs.get(route)
+        if selected not in ("true", "false"):
+            errors.append(f"Missing or invalid {route} route; skipping is not authorized.")
+        for job in jobs:
+            item = needs.get(job, {})
+            result = item.get("result") if isinstance(item, dict) else None
+            rows.append((job, selected or "invalid", result or "missing"))
+            if selected == "true" and result != "success":
+                errors.append(f"Selected job {job} must succeed; got {result!r}.")
+            elif selected == "false" and result not in ("success", "skipped"):
+                errors.append(f"Unselected job {job} has an unexpected result: {result!r}.")
+    known = {"changes"} | {job for jobs in JOBS.values() for job in jobs}
+    for job in needs.keys() - known:
+        item = needs[job]
+        if not isinstance(item, dict) or item.get("result") != "success":
+            errors.append(f"Unmapped job {job} did not succeed; it has no explicit skip policy.")
+    return errors, rows
+
+
+def main():
+    try:
+        errors, rows = evaluate(json.loads(os.environ["CI_NEEDS_JSON"]))
+    except (KeyError, ValueError) as exc:
+        print(f"CI gate could not read CI_NEEDS_JSON: {exc}", file=sys.stderr)
+        return 1
+    lines = ["## CI gate", "", "| Job | Selected | Result |", "| --- | --- | --- |"]
+    lines.extend(f"| {job} | {selected} | {result} |" for job, selected, result in rows)
+    lines.extend(["", "**FAILED**" if errors else "**PASSED**"])
+    lines.extend(f"- {error}" for error in errors)
+    report = "\n".join(lines) + "\n"
+    print(report)
+    if os.environ.get("GITHUB_STEP_SUMMARY"):
+        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
+            stream.write(report)
+    return 1 if errors else 0
+
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `scripts/ci/run.py` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+"""Run a command verbatim, streaming its output to the console and a CI log."""
+
+import argparse
+import os
+from pathlib import Path
+import re
+import subprocess
+import sys
+
+
+def main(argv=None):
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("label")
+    parser.add_argument("command", nargs=argparse.REMAINDER)
+    args = parser.parse_args(argv)
+    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", args.label):
+        parser.error("label must contain only letters, numbers, underscores, or hyphens")
+    if not args.command:
+        parser.error("a command is required")
+    directory = Path("ci-results")
+    directory.mkdir(exist_ok=True)
+    logfile = directory / f"{args.label}.log"
+    with logfile.open("wb") as log:
+        try:
+            process = subprocess.Popen(args.command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
+        except OSError as exc:
+            message = f"Could not launch command: {exc}\n"
+            print(message, file=sys.stderr, end="")
+            log.write(message.encode("utf-8"))
+            code = 127
+        else:
+            try:
+                while True:
+                    chunk = process.stdout.read1(65536)
+                    if not chunk:
+                        break
+                    sys.stdout.buffer.write(chunk)
+                    sys.stdout.buffer.flush()
+                    log.write(chunk)
+                    log.flush()
+                code = process.wait()
+            except KeyboardInterrupt:
+                process.terminate()
+                try:
+                    process.wait(timeout=5)
+                except subprocess.TimeoutExpired:
+                    process.kill()
+                    process.wait()
+                code = 130
+            finally:
+                process.stdout.close()
+    # POSIX signal termination is negative; returning it directly is ambiguous.
+    if code < 0:
+        code = 128 - code
+    status = "PASS" if code == 0 else "FAIL"
+    message = f"{status}: {args.label} (exit {code}); log: {logfile.as_posix()}"
+    print(message, flush=True)
+    if os.environ.get("GITHUB_STEP_SUMMARY"):
+        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
+            summary.write(f"- **{status}** `{args.label}` — exit `{code}`, log `{logfile.as_posix()}`\n")
+    return code
+
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `tests/browser/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+/test-results/
+/playwright-report/
```

---

### Incident Patch 15: `7c771b80` (2026-09-18)
**Commit Message**: fix: support macOS Bash and isolate native test exit codes

**File**: `.github/workflows/auto-company-runtime-ci.yml` (modified, +1/-0)
```diff
@@ -122,6 +122,7 @@ jobs:
           python3 -m unittest discover -s tests -p test_daemon_installers.py -v
           python3 -m unittest discover -s tests -p test_macos_start.py -v
           python3 -m unittest discover -s tests -p test_log_rotation.py -v
+          python3 -m unittest discover -s tests -p test_ui_messages.py -v
 
       - name: Verify Dashboard Start with a real isolated LaunchAgent
         env:
```

**File**: `scripts/core/ui-messages.sh` (modified, +4/-3)
```diff
@@ -5,13 +5,14 @@ UI_MESSAGES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 ui_message() {
     local key="$1" value
     shift
-    local arguments=()
+    # Bash 3.2 (macOS) treats an empty array as unset under `set -u`.
+    # Keep fixed arguments in the array so zero-placeholder messages are safe.
+    local arguments=(message --root "${PROJECT_DIR:-$UI_MESSAGES_DIR/../..}" --key "$key")
     for value in "$@"; do
         arguments+=("--arg=$value")
     done
     if command -v python3 >/dev/null 2>&1 && \
-        python3 "$UI_MESSAGES_DIR/localization.py" message \
-            --root "${PROJECT_DIR:-$UI_MESSAGES_DIR/../..}" --key "$key" "${arguments[@]}"; then
+        python3 "$UI_MESSAGES_DIR/localization.py" "${arguments[@]}"; then
         return 0
     fi
     # Python is unavailable: keep dependency diagnostics useful without hiding
```

**File**: `tests/test_ui_messages.py` (modified, +16/-0)
```diff
@@ -106,6 +106,22 @@ def test_check_keeps_exact_machine_language_output(self):
         self.assertEqual(result.stdout, "")
         self.assertIn("Check AUTO_COMPANY_LANGUAGE", result.stderr)
 
+    @unittest.skipUnless(os.name == "posix" and Path("/bin/bash").exists(), "Native POSIX Bash")
+    def test_native_bash_nounset_handles_messages_with_and_without_parameters(self):
+        # /bin/bash is 3.2 on macOS; empty arrays there differ from modern Bash.
+        command = ["/bin/bash", "-uc",
+                   'source "$1/scripts/core/ui-messages.sh"; PROJECT_DIR="$1"; '
+                   'ui_message loop.stopping; ui_message language.saved en',
+                   "message-test", str(ROOT)]
+        for language, saved in (("en", "Saved AUTO_COMPANY_LANGUAGE=en"),
+                                ("zh-CN", "已保存 AUTO_COMPANY_LANGUAGE=en")):
+            result = subprocess.run(command, env=dict(self.env, AUTO_COMPANY_LANGUAGE=language),
+                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
+            self.assertEqual(result.returncode, 0, result.stderr)
+            self.assertEqual(len(result.stdout.splitlines()), 2)
+            self.assertIn(saved, result.stdout)
+            self.assertEqual(result.stderr, "")
+
 
 @unittest.skipUnless(os.name == "posix" and sys.platform == "linux", "Linux/WSL entrypoint fixtures")
 class ShellOperatorMessageTests(unittest.TestCase):
```

**File**: `tests/test_windows_messages.ps1` (modified, +3/-0)
```diff
@@ -259,3 +259,6 @@ try {
 
 Write-Host "Windows message checks: $($script:checks - $script:failures.Count) passed, $($script:failures.Count) failed, 0 skipped"
 if ($script:failures.Count) { throw ($script:failures -join "`n") }
+# The final case deliberately sets a failing native code. Report the assertions'
+# result to CI, whose PowerShell wrapper exits with the last native exit code.
+$global:LASTEXITCODE = 0
```

#### Recent Merged Pull Requests:
- **PR #47** (2026-10-04): Refine product detail showcase screenshots (@MaxMiksa)
- **PR #46** (2026-10-03): Release v2.1.0: parallel work and Product Center (@MaxMiksa)
- **PR #45** (2026-10-02): Restore B frontend design and add a dedicated polishing pass (@MaxMiksa)
- **PR #44** (2026-10-02): Simplify bilingual timelines and refresh README screenshots (@MaxMiksa)
- **PR #43** (2026-10-02): Enforce project isolation across models, tools and previews (@MaxMiksa)
- **PR #42** (2026-10-02): Expand timeline product screenshots and validate explicit frontend redesign (@MaxMiksa)
- **PR #41** (2026-10-01): Publish refined examples, bilingual showcases and measured frontend guidance (@MaxMiksa)
- **PR #40** (2026-09-27): Release v2.0.0: Product Center (@MaxMiksa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
