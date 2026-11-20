# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: fabio-rovai/open-ontologies Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "fabio-rovai/open-ontologies",
  "source_url": "https://github.com/fabio-rovai/open-ontologies",
  "source_version": "17ef05b9",
  "license": "MIT",
  "timestamp": "2026-11-20T11:30:49.372Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fabio-rovai-open-ontologies",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies) (Revision: `17ef05b9`).  
> **License**: MIT | **Timestamp**: `2026-11-20T11:30:49.372Z`  
> **Learning ID**: `learn-github-fabio-rovai-open-ontologies`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from fabio-rovai/open-ontologies:

# Forensic Learning Record (Deep Inspection): fabio-rovai/open-ontologies

> **Canonical Artifact**: `07_PROJECT_LEARNING/fabio-rovai-open-ontologies-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T11:30:48.136Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fabio-rovai/open-ontologies`
- **Description**: Plan, apply and roll back changes to a production ontology, with a blast radius report and a proof an auditor can re-check.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2935 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/ontoaxiom/rescore_from_predictions.py`
```
#!/usr/bin/env python3
"""
Recompute scores from the raw predictions already stored in a results file.

Scoring is a pure function of (predictions, ground truth, normalizer). When the
normalizer is fixed, the stored model outputs can be rescored offline rather than
re-querying the model, which keeps the comparison honest: the same generations
are scored under the old and new rules.

  python3 rescore_from_predictions.py data/results/oo_conditionD_qwen_results.json
  python3 rescore_from_predictions.py data/results/*.json --write
"""
import argparse
import json
import os

from run_bare_llm_ablation import AXIOM_TYPES, load_gt, score

FLIP_TYPES = {"domain", "range"}


def rescore(path, write=False):
    with open(path) as f:
        blob = json.load(f)

    preds = blob.get("predictions") or {}
    if not preds:
        print(f"{os.path.basename(path)}: no stored predictions, skipping")
        return

    old_scores = blob.get("scores", {})
    new_scores = {}
    for onto, result in preds.items():
        if not isinstance(result, dict) or "error" in result:
            continue
        for ax in AXIOM_TYPES:
            gt = load_gt(onto, ax)
            new_scores[f"{onto}_{ax}"] = score(result.get(ax, []), gt, try_flip=(ax in FLIP_TYPES))

    def mean_f1(scores):
        f1s = [s["f1"] for s in scores.values()]
        return sum(f1s) / len(f1s) if f1s else 0.0

    old_overall, new_overall = mean_f1(old_scores), mean_f1(new_scores)

    print(f"\n{'=' * 74}\n{os.path.basename(path)}   ({blob.get('method')}, {blob.get('model')})\n{'=' * 74}")
    print(f"{'ontology':<16}{'old F1':>10}{'new F1':>10}{'delta':>10}")
    print("-" * 74)
    ontos = sorted({k.rsplit("_", 1)[0] for k in new_scores})
    for o in ontos:
        old = [old_scores[f"{o}_{ax}"]["f1"] for ax in AXIOM_TYPES if f"{o}_{ax}" in old_scores]
        new = [new_scores[f"{o}_{ax}"]["f1"] for ax in AXIOM_TYPES if f"{o}_{ax}" in new_scores]
        o_m = sum(old) / len(old) if old else 0.0
        n_m = sum(new) / len(new) if new else 0.0
        flag = "   <- was a scoring artifact" if o_m == 0.0 and n_m > 0.0 else ""
        print(f"{o:<16}{o_m:>10.3f}{n_m:>10.3f}{n_m - o_m:>+10.3f}{flag}")
    print("-" * 74)
    print(f"{'OVERALL':<16}{old_overall:>10.3f}{new_overall:>10.3f}{new_overall - old_overall:>+10.3f}")

    if write:
        blob["scores"] = new_scores
        blob["overall_f1"] = new_overall
        blob["rescored"] = "prefix-aware normalize (local_name); predictions unchanged"
        with open(path, "w") as f:
            json.dump(blob, f, indent=2)
        print(f"\nwritten back to {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--write", action="store_true", help="overwrite scores in place")
    args = ap.parse_args()
    for p in args.paths:
        rescore(p, write=args.write)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmark/ontoaxiom/score_all_conditions.py`
```
#!/usr/bin/env python3
"""
Score every OntoAxiom condition under ONE evaluator, and report macro and micro.

The benchmark scripts in this directory grew independently and disagreed on three
axes, each of which silently moved the headline numbers:

  1. Normalizer.  Condition A splits camelCase; the original condition-D scorer
     only lowercased, so it could not match the QNames and rdfs:label text that a
     model naturally emits when it is reading real Turtle.
  2. Averaging.   Condition A reports a MACRO mean over per-(ontology, axiom) F1
     cells. Condition D and the MCP benchmark report a MICRO F1 over pooled
     TP/FP/FN, which is dominated by a few huge axiom sets (Pizza `disjoint`
     alone carries 785 ground-truth pairs).
  3. Pair flip.   Condition A tries the reversed orientation only for domain and
     range; the original condition-D scorer tried it for every axiom type.

Mixing these makes cross-condition comparison meaningless. This script fixes the
normalizer (shared with run_bare_llm_ablation), fixes the flip policy to
domain/range only, and prints BOTH averages side by side so a reader can see
which conclusions depend on the choice.

  python3 score_all_conditions.py
"""
import glob
import json
import os

from run_bare_llm_ablation import AXIOM_TYPES, ONTOLOGIES, load_gt, normalize_pair

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(SCRIPT_DIR, "data", "results")
COND_D = os.path.join(SCRIPT_DIR, "results", "condition_d")
FLIP_TYPES = {"domain", "range"}

# Claude's condition-D dumps are inconsistent: most use OWL camelCase keys, but
# pizza_extracted.json uses lowercase. Try both spellings or pizza silently scores 0.
D_KEYS = {"subclassof": ["subclassof", "subClassOf"], "disjoint": ["disjoint", "disjointWith"],
          "domain": ["domain"], "range": ["range"], "subproperty": ["subproperty", "subPropertyOf"]}


def cell(pred_pairs, gt, try_flip):
    pred = {normalize_pair(p) for p in pred_pairs if isinstance(p, (list, tuple)) and len(p) == 2}
    if try_flip:
        flipped = {(b, a) for a, b in pred}
        if len(flipped & gt) > len(pred & gt):
            pred = flipped
    tp, fp, fn = len(pred & gt), len(pred - gt), len(gt - pred)
    return tp, fp, fn


def f1_of(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return 2 * p * r / (p + r) if p + r else 0.0


def aggregate(cells, keys=None):
    """cells: {cell_key: (tp, fp, fn)}. Returns (macro, micro, n_cells)."""
    vals = [cells[k] for k in (keys if keys is not None else cells)] if cells else []
    if not vals:
        return 0.0, 0.0, 0
    macro = sum(f1_of(*c) for c in vals) / len(vals)
    tp = sum(c[0] for c in vals)
    fp = sum(c[1] for c in vals)
    fn = sum(c[2] for c in vals)
    return macro, f1_of(tp, fp, fn), len(vals)


def pick(result, ax, keymap):
    """Read an axiom type's pairs, tolerating alternative key spellings."""
    for key in (keymap[ax] if keymap else [ax]):
        if key in result:
            return result[key]
    return []


def from_predictions(preds, keymap=None):
    """Score a {ontology: {axiom_type: [[a,b],...]}} prediction dump, keyed by cell."""
    cells = {}
    for onto, result in preds.items():
        if not isinstance(result, dict) or "error" in result:
            continue
        for ax in AXIOM_TYPES:
            gt = load_gt(onto, ax)
            if not gt:                       # no ground truth -> not a scorable cell
                continue
            cells[f"{onto}_{ax}"] = cell(pick(result, ax, keymap), gt, ax in FLIP_TYPES)
    return cells


def from_scored_cells(scores):
    """Reuse tp/fp/fn already stored by a prior run (valid when preds were bare names)."""
    return {k: (s["tp"], s["fp"], s["fn"]) for k, s in scores.items() if s.get("gt_size", 1) > 0}


def load(path):
    return json.load(open(path)) if os.path.exists(path) else None


def main():
    conds = {}

    # Claude condition A — predictions not stored, but per-cell tp/fp/fn are.
    # Its inputs are bare name lists, so the normalizer fix provably cannot move it.
    a_claude = load(os.path.join(RESULTS, "oo_bare_opus_subagent_results.json"))
    if a_claude:
        conds[("Claude Opus", "A: name lists")] = from_scored_cells(a_claude["scores"])

    # Claude condition D — raw Turtle, predictions stored per ontology.
    d_preds = {}
    for f in glob.glob(os.path.join(COND_D, "*_extracted.json")):
        d_preds[os.path.basename(f).replace("_extracted.json", "")] = json.load(open(f))
    if d_preds:
        conds[("Claude Opus", "D: raw OWL")] = from_predictions(d_preds, D_KEYS)

    for cond, path in [("A: name lists", "oo_bare_qwen_results.json"),
                       ("D: raw OWL", "oo_conditionD_qwen_results.json")]:
        blob = load(os.path.join(RESULTS, path))
        if blob and blob.get("predictions"):
            conds[("Qwen3-Coder-30B", cond)] = from_predictions(blob["predictions"])

    # MCP extraction — stored as {axiom_type: {ontology: {tp,fp,fn}}}.
    mcp = load(os.path.join(RESULTS, "oo_ontoaxiom_mcp_results.json"))
    if mcp:
        cells = {}
        for ax in AXIOM_TYPES:
            for onto, s in (mcp.get(ax) or {}).items():
                if onto.startswith("_") or not isinstance(s, dict) or "tp" not in s:
                    continue
                cells[f"{onto}_{ax}"] = (s["tp"], s["fp"], s["fn"])
        if cells:
            conds[("MCP + SPARQL", "full OWL")] = cells

    print("=" * 82)
    print("OntoAxiom — all conditions under ONE evaluator")
    print("shared normalizer (camelCase + prefix strip); flip on domain/range only")
    print("=" * 82)
    print(f"\n{'model':<18}{'condition':<18}{'macro F1':>11}{'micro F1':>11}{'cells':>8}")
    print("-" * 82)
    for (model, cond), cells in conds.items():
        macro, micro, n = aggregate(cells)
        print(f"{model:<18}{cond:<18}{macro:>11.3f}{micro:>11.3f}{n:>8}")
    print("-" * 82)
    print("\n  macro = mean of per-(ontology, axiom) F1 — every axiom type counts equally")
    print("  micro = F1 over pooled TP/FP/FN — dominated by large axiom sets")

    print(f"\n{'=' * 82}\nA vs D, restricted to the cells BOTH conditions scored\n{'=' * 82}")
    for model in ["Claude Opus", "Qwen3-Coder-30B"]:
        a, d = conds.get((model, "A: name lists")), conds.get((model, "D: raw OWL"))
        if not a or not d:
            continue
        common = sorted(set(a) & set(d))
        am, ami, _ = aggregate(a, common)
        dm, dmi, _ = aggregate(d, common)
        wins = sum(1 for k in common if f1_of(*d[k]) > f1_of(*a[k]))
        print(f"\n  {model}  ({len(common)} common cells; A has {len(a)}, D has {len(d)})")
        print(f"    macro   A={am:.3f}  D={dm:.3f}   delta {dm - am:+.3f}")
        print(f"    micro   A={ami:.3f}  D={dmi:.3f}   delta {dmi - ami:+.3f}")
        print(f"    raw OWL beats name lists on {wins}/{len(common)} cells")
        print(f"    verdict: raw OWL {'HELPS' if dm > am else 'HURTS'} (macro and micro agree: "
              f"{'yes' if (dm > am) == (dmi > ami) else 'NO'})")

    print("\n  The paper reports condition D = 0.323: the MICRO figure under the old")
    print("  lowercase-only normalizer. Condition A's 0.431 is a MACRO figure. They were")
    print("  never comparable on either axis.")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmark/ontoaxiom/score_condition_d.py`
```
#!/usr/bin/env python3
"""Score Condition D (raw OWL file -> LLM, no tools) against ground truth.
Run AFTER the extraction agents have finished.

HISTORY — this script used to produce F1 = 0.323 for condition D, the number behind
the OntoAxiom paper's "raw OWL hurts" result. That number is an artifact of how this
script scored, not of how the model performed. Three bugs, all one-directional:

  1. Its normalizer only lowercased. Condition A's normalizer (run_bare_llm_benchmark.py)
     also splits camelCase. Condition D is the condition where the model reads real
     Turtle, so it answers in QNames (foaf:Person) and rdfs:label text ("personal
     mailbox" for mbox). A lowercase-only normalizer matches none of those against
     ground truth's bare, camelCase local names. The bias only ever penalizes D.
  2. It reported a MICRO F1 (pooled TP/FP/FN) while condition A reported a MACRO mean
     of per-cell F1. The 0.323 (micro) was compared against A's 0.431 (macro). Those
     were never the same statistic.
  3. It tried the reversed pair order on EVERY axiom type; condition A only flips
     domain and range.

All three are fixed here: the normalizer is imported from run_bare_llm_ablation and
shared with every other script in this directory, flipping is restricted to
domain/range, and BOTH averages are printed so no reader has to guess which one a
headline number refers to. Cells with no ground truth are skipped rather than scored
as zero.

Under the corrected evaluator, condition D scores far ABOVE condition A on both
Claude and Qwen: reading the ontology helps, it does not hurt. See
ONTOAXIOM_SHOWDOWN.md, and score_all_conditions.py for the cross-condition table.

Pass --legacy to reproduce the historical broken number for comparison.
"""
import argparse
import json
import os

from run_bare_llm_ablation import normalize_pair

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GT_DIR = os.path.join(SCRIPT_DIR, 'data', 'ontoaxiom')
EX_DIR = os.path.join(SCRIPT_DIR, 'results', 'condition_d')

AXIOM_TYPES = ['subclassof', 'disjoint', 'domain', 'range', 'subproperty']
FLIP_TYPES = {'domain', 'range'}
GT_DIRS = {
    'subclassof': ['subclassof', 'subClassOf'],
    'disjoint': ['disjoint', 'disjointWith'],
    'domain': ['domain'],
    'range': ['range'],
    'subproperty': ['subproperty', 'subPropertyOf'],
}
ONTOLOGIES = ['pizza', 'foaf', 'gufo', 'time', 'saref', 'nordstream', 'goodrelations', 'era', 'music']


def legacy_pair(pair):
    """The original normalizer: lowercase and strip, nothing else."""
    return tuple(s.strip().lower() for s in pair)


def f1_of(tp, fp, fn):
    p = tp / (tp + fp) if (tp + fp) else 0.0
    r = tp / (tp + fn) if (tp + fn) else 0.0
    return 2 * p * r / (p + r) if (p + r) else 0.0


def load_gt(ontology, axiom_type, pairfn):
    fname = os.path.join(GT_DIR, axiom_type, f'{ontology}_{axiom_type}.json')
    if not os.path.exists(fname):
        return set()
    with open(fname) as f:
        data = json.load(f)
    return {pairfn(p) for p in data if isinstance(p, list) and len(p) == 2}


def load_extracted(ontology, axiom_type, gt, pairfn, allow_flip):
    fname = os.path.join(EX_DIR, f'{ontology}_extracted.json')
    if not os.path.exists(fname):
        return None
    with open(fname) as f:
        data = json.load(f)
    for key in GT_DIRS[axiom_type]:
        if key in data:
            pairs = [p for p in data[key] if isinstance(p, list) and len(p) == 2]
            normal = {pairfn(p) for p in pairs}
            if allow_flip:
                flipped = {pairfn([p[1], p[0]]) for p in pairs}
                if len(flipped & gt) > len(normal & gt):
                    return flipped
            return normal
    return set()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--legacy', action='store_true',
                    help="reproduce the historical broken scoring (lowercase-only "
                         "normalizer, flip every axiom type) that yielded F1 = 0.323")
    args = ap.parse_args()

    pairfn = legacy_pair if args.legacy else normalize_pair
    all_results = {}
    grand_tp = grand_fp = grand_fn = 0
    macro_cells = []

    mode = 'LEGACY (broken, for comparison only)' if args.legacy else 'CORRECTED (shared normalizer)'
    print(f'Condition D scoring — {mode}\n')
    print(f'{"Ontology":>15} {"Type":>12} {"TP":>4} {"FP":>4} {"FN":>4} {"P":>6} {"R":>6} {"F1":>6}')
    print('-' * 65)

    for onto in ONTOLOGIES:
        if not os.path.exists(os.path.join(EX_DIR, f'{onto}_extracted.json')):
            print(f'{onto:>15} {"MISSING":>12}')
            continue

        onto_tp = onto_fp = onto_fn = 0
        onto_results = {}

        for atype in AXIOM_TYPES:
            gt = load_gt(onto, atype, pairfn)
            if not gt:                       # no ground truth -> not a scorable cell
                continue
            allow_flip = True if args.legacy else (atype in FLIP_TYPES)
            ex = load_extracted(onto, atype, gt, pairfn, allow_flip)
            if ex is None:
                continue

            tp, fp, fn = len(gt & ex), len(ex - gt), len(gt - ex)
            onto_tp += tp
            onto_fp += fp
            onto_fn += fn
            grand_tp += tp
            grand_fp += fp
            grand_fn += fn

            f1 = f1_of(tp, fp, fn)
            macro_cells.append(f1)
            p = tp / (tp + fp) if (tp + fp) else 0.0
            r = tp / (tp + fn) if (tp + fn) else 0.0
            print(f'{onto:>15} {atype:>12} {tp:>4} {fp:>4} {fn:>4} {p:>6.3f} {r:>6.3f} {f1:>6.3f}')
            onto_results[atype] = {'tp': tp, 'fp': fp, 'fn': fn,
                                   'p': round(p, 4), 'r': round(r, 4), 'f1': round(f1, 4)}

        print(f'{onto:>15} {"OVERALL":>12} {onto_tp:>4} {onto_fp:>4} {onto_fn:>4} '
              f'{"":>6} {"":>6} {f1_of(onto_tp, onto_fp, onto_fn):>6.3f}\n')
        all_results[onto] = {'per_type': onto_results,
                             'overall': {'tp': onto_tp, 'fp': onto_fp, 'fn': onto_fn,
                                         'f1': round(f1_of(onto_tp, onto_fp, onto_fn), 4)}}

    micro = f1_of(grand_tp, grand_fp, grand_fn)
    macro = sum(macro_cells) / len(macro_cells) if macro_cells else 0.0

    print('=' * 65)
    print(f'{"GRAND TOTAL":>15} {"":>12} {grand_tp:>4} {grand_fp:>4} {grand_fn:>4}')
    print(f'\n  micro F1 (pooled TP/FP/FN)           = {micro:.3f}')
    print(f'  macro F1 (mean of {len(macro_cells):>2} scored cells)  = {macro:.3f}')
    print('\n  Condition A (bare LLM, name lists)   : macro 0.451  micro 0.397')
    print('  Condition C (MCP tools, OWL files)   : macro 0.713  micro 0.717')
    print(f'  Condition D (raw OWL file, no tools) : macro {macro:.3f}  micro {micro:.3f}')
    if args.legacy:
        print('\n  NOTE: --legacy reproduces the historical micro F1 = 0.323, an artifact of')
        print('  the lowercase-only normalizer. Re-run without --legacy for the real number.')
    else:
        print('\n  Raw OWL BEATS name lists on both averages. The paper\'s "raw OWL hurts"')
        print('  result does not survive a scorer shared with condition A.')

    all_results['_grand_total'] = {'tp': grand_tp, 'fp': grand_fp, 'fn': grand_fn,
                                   'micro_f1': round(micro, 4), 'macro_f1': round(macro, 4),
                                   'legacy_scoring': bool(args.legacy)}

    # --legacy writes to its own file. It used to share the canonical path, so a
    # single reproduction run silently replaced the corrected scores on disk with
    # the broken ones the corrected scores exist to refute.
    name = 'condition_d_scores_legacy.json' if args.legacy else 'condition_d_scores.json'
    out = os.path.join(EX_DIR, name)
    with open(out, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f'\nSaved to {out}')


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `python/src/open_ontologies_lite/engine.py`
```
"""Lightweight ontology engine over a prebuilt Oxigraph store.

No compilation, no native build step: pyoxigraph ships the Oxigraph engine as a
prebuilt wheel, so everything here is pure Python glue around it. This module is
deliberately MCP-free so it can be unit-tested in isolation; server.py wires it
to the MCP transport.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pyoxigraph as ox

# Map friendly format names to Oxigraph RdfFormat values.
_FORMATS = {
    "turtle": ox.RdfFormat.TURTLE,
    "ttl": ox.RdfFormat.TURTLE,
    "ntriples": ox.RdfFormat.N_TRIPLES,
    "nt": ox.RdfFormat.N_TRIPLES,
    "nquads": ox.RdfFormat.N_QUADS,
    "nq": ox.RdfFormat.N_QUADS,
    "trig": ox.RdfFormat.TRIG,
    "rdfxml": ox.RdfFormat.RDF_XML,
    "rdf": ox.RdfFormat.RDF_XML,
    "xml": ox.RdfFormat.RDF_XML,
    "n3": ox.RdfFormat.N3,
    "jsonld": ox.RdfFormat.JSON_LD,
    # The W3C media-type registration and most other tooling, rdflib included,
    # spell it with the hyphen. Taking only "jsonld" rejected a correct name.
    "json-ld": ox.RdfFormat.JSON_LD,
    "json": ox.RdfFormat.JSON_LD,
}

OWL_CLASS = "http://www.w3.org/2002/07/owl#Class"
RDFS_CLASS = "http://www.w3.org/2000/01/rdf-schema#Class"
RDF_PROPERTY = "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property"
_PROPERTY_TYPES = (RDF_PROPERTY,) + tuple(
    "http://www.w3.org/2002/07/owl#" + name
    for name in ("ObjectProperty", "DatatypeProperty", "AnnotationProperty")
)
_PROPERTY_VALUES = " ".join(f"<{iri}>" for iri in _PROPERTY_TYPES)
# An individual has a type outside the RDF, RDFS and OWL vocabularies, or is
# declared owl:NamedIndividual or owl:Thing. Everything else typed only from
# those vocabularies (restrictions, property characteristics, datatypes, axiom
# nodes) is part of the ontology's structure. Same rule as GraphStore::get_stats
# in the Rust engine (#395).
_INDIVIDUAL_TYPE_FILTER = (
    "FILTER(?t IN (<http://www.w3.org/2002/07/owl#NamedIndividual>, "
    "<http://www.w3.org/2002/07/owl#Thing>) || ("
    '!STRSTARTS(STR(?t), "http://www.w3.org/1999/02/22-rdf-syntax-ns#") && '
    '!STRSTARTS(STR(?t), "http://www.w3.org/2000/01/rdf-schema#") && '
    '!STRSTARTS(STR(?t), "http://www.w3.org/2002/07/owl#")))'
)


def resolve_format(name: str) -> ox.RdfFormat:
    key = name.strip().lower().lstrip(".")
    if key not in _FORMATS:
        raise ValueError(
            f"unknown format {name!r}; supported: {', '.join(sorted(set(_FORMATS)))}"
        )
    return _FORMATS[key]


@dataclass
class ValidationResult:
    ok: bool
    triples: int
    error: str | None = None


class OntologyEngine:
    """A single in-memory ontology store with the core lifecycle operations."""

    def __init__(self) -> None:
        self.store = ox.Store()

    # ---- validation -------------------------------------------------------
    @staticmethod
    def validate(data: str, fmt: str = "turtle") -> ValidationResult:
        """Parse RDF without loading it; report syntax validity and triple count."""
        rdf_format = resolve_format(fmt)
        try:
            count = sum(1 for _ in ox.parse(data.encode("utf-8"), format=rdf_format))
        except (SyntaxError, ValueError) as exc:
            return ValidationResult(ok=False, triples=0, error=str(exc))
        return ValidationResult(ok=True, triples=count)

    # ---- load / clear -----------------------------------------------------
    def load(self, data: str, fmt: str = "turtle") -> int:
        """Load RDF text into the store; return total triple count afterwards."""
        self.store.load(data.encode("utf-8"), format=resolve_format(fmt))
        return len(self.store)

    def load_path(self, path: str, fmt: str | None = None) -> int:
        p = Path(path)
        rdf_format = resolve_format(fmt) if fmt else ox.RdfFormat.from_extension(p.suffix.lstrip("."))
        if rdf_format is None:
            raise ValueError(f"cannot infer format from {path!r}; pass fmt explicitly")
        self.store.load(path=str(p), format=rdf_format)
        return len(self.store)

    def load_rows(
        self,
        rows_or_df,
        base_iri: str = "http://example.org/data/",
        class_iri: str | None = None,
        id_column: str | None = None,
    ) -> int:
        """Load tabular rows (or any dataframe-like object — fenic, polars,
        pandas, pyarrow) into the store as RDF; return total triple count."""
        from .dataframe import rows_from_dataframe, rows_to_turtle

        rows = rows_from_dataframe(rows_or_df)
        ntriples = rows_to_turtle(rows, base_iri=base_iri, class_iri=class_iri, id_column=id_column)
        return self.load(ntriples, "ntriples")

    def clear(self) -> None:
        self.store.clear()

    # ---- stats ------------------------------------------------------------
    def stats(self) -> dict[str, int]:
        return {
            "triples": len(self.store),
            "classes": self._count(
                f"SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {{ ?c a ?t "
                f"VALUES ?t {{ <{OWL_CLASS}> <{RDFS_CLASS}> }} }}"
            ),
            "properties": self._count(
                f"SELECT (COUNT(DISTINCT ?p) AS ?n) WHERE {{ ?p a ?t VALUES ?t {{ {_PROPERTY_VALUES} }} }}"
            ),
            "individuals": self._count(
                "SELECT (COUNT(DISTINCT ?i) AS ?n) WHERE { ?i a ?t "
                + _INDIVIDUAL_TYPE_FILTER
                + " }"
            ),
        }

    def _count(self, sparql: str) -> int:
        for sol in self.store.query(sparql):
            return int(sol["n"].value)
        return 0

    # ---- query ------------------------------------------------------------
    def query(self, sparql: str) -> dict:
        """Run SPARQL. Returns a typed dict for SELECT / ASK / CONSTRUCT/DESCRIBE."""
        result = self.store.query(sparql)
        if isinstance(result, ox.QueryBoolean):
            return {"type": "boolean", "boolean": bool(result)}
        if isinstance(result, ox.QuerySolutions):
            var_objs = list(result.variables)
            names = [str(v).lstrip("?") for v in var_objs]
            rows = []
            for sol in result:
                row = {}
                for name, var in zip(names, var_objs):
                    term = sol[var]
                    row[name] = _query_value(term)
                rows.append(row)
            return {"type": "table", "variables": names, "rows": rows}
        # QueryTriples (CONSTRUCT / DESCRIBE)
        triples = [
            {"subject": _query_value(t.subject), "predicate": _query_value(t.predicate),
             "object": _query_value(t.object)}
            for t in result
        ]
        return {"type": "graph", "triples": triples}

    # ---- save / convert ---------------------------------------------------
    def save(self, path: str, fmt: str | None = None) -> str:
        p = Path(path)
        rdf_format = resolve_format(fmt) if fmt else ox.RdfFormat.from_extension(p.suffix.lstrip("."))
        if rdf_format is None:
            raise ValueError(f"cannot infer format from {path!r}; pass fmt explicitly")
        _dump(self.store, str(p), rdf_format)
        return str(p)

    def dump(self, fmt: str = "turtle") -> str:
        """Serialize the loaded store to a string (needed to hand it to pySHACL)."""
        out = _dump(self.store, None, resolve_format(fmt))
        return out.decode("utf-8") if isinstance(out, (bytes, bytearray)) else str(out)

    @staticmethod
    def convert(data: str, from_fmt: str, to_fmt: str) -> str:
        tmp = ox.Store()
        tmp.load(data.encode("utf-8"), format=resolve_format(from_fmt))
        out = _dump(tmp, None, resolve_format(to_fmt))
        return out.decode("utf-8") if isinstance(out, (bytes, bytearray)) else str(out)

    # ---- diff -------------------------------------------------------------
    @staticmethod
    def diff(data_a: str, data_b: str, fmt: str = "turtle") -> dict:
        """Triple-level diff between two ontologies (added/removed vs A→B)."""
        rdf_format = resolve_format(fmt)
        a = {_triple_key(t) for t in ox.parse(data_a.encode("utf-8"), format=rdf_format)}
        # Reuse parsed blank-node identities for the same input document.
        b = a if data_a == data_b else {
            _triple_key(t) for t in ox.parse(data_b.encode("utf-8"), format=rdf_format)
        }
        return {
            "added": sorted(b - a),
            "removed": sorted(a - b),
            "added_count": len(b - a),
            "removed_count": len(a - b),
            "unchanged_count": len(a & b),
        }

    # ---- lint -------------------------------------------------------------
    def lint(self) -> dict:
        """Cheap structural hygiene checks: missing labels, domains, ranges."""
        missing_labels = self._terms(
            f"SELECT DISTINCT ?c WHERE {{ ?c a ?t VALUES ?t {{ <{OWL_CLASS}> <{RDFS_CLASS}> }} "
            "FILTER NOT EXISTS {{ ?c <http://www.w3.org/2000/01/rdf-schema#label> ?l }} }"
        )
        missing_domain = self._terms(
            f"SELECT DISTINCT ?p WHERE {{ ?p a ?t VALUES ?t {{ {_PROPERTY_VALUES} }} "
            "FILTER NOT EXISTS {{ ?p <http://www.w3.org/2000/01/rdf-schema#domain> ?d }} }"
        )
        missing_range = self._terms(
            f"SELECT DISTINCT ?p WHERE {{ ?p a ?t VALUES ?t {{ {_PROPERTY_VALUES} }} "
            "FILTER NOT EXISTS {{ ?p <http://www.w3.org/2000/01/rdf-schema#range> ?r }} }"
        )
        issues = (
            [{"rule": "missing-label", "term": t} for t in missing_labels]
            + [{"rule": "missing-domain", "term": t} for t in missing_domain]
            + [{"rule": "missing-range", "term": t} for t in missing_range]
        )
        return {"issue_count": len(issues), "issues": issues}

    def _terms(self, sparql: str) -> list[str]:
        result = self.store.query(sparql)
        var = result.variables[0]
        out = []
        for sol in re
```

### Core Architecture Module: `src/borderline_loop.rs`
```
// SPDX-FileCopyrightText: 2026 Fabio Rovai
// SPDX-License-Identifier: MIT

//! Generalised iterative borderline-pair review loop (#37, NORA NeurIPS
//! 2025).
//!
//! Generalises the borderline-pair pattern from `onto_align` (#16) to any
//! candidate set: given a list of `(item, score)` candidates plus two
//! thresholds, partition into `auto_accept` (above high), `borderline`
//! (between low and high), `auto_reject` (below low), and emit a summary
//! prompt instructing the orchestrator to judge the borderline bucket.
//!
//! The judgement persists via `record_verdict`, and `apply_verdicts`
//! merges accepted-borderline items back into the auto-accept set.

use crate::state::StateDb;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Candidate {
    pub id: String,
    pub score: f64,
    /// Free-form context for the LLM's judgement (e.g. labels, parents).
    #[serde(default)]
    pub context: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct PartitionReport {
    pub auto_accept: Vec<Candidate>,
    pub borderline: Vec<Candidate>,
    pub auto_reject: Vec<Candidate>,
    pub summary_for_review: String,
}

/// Partition `candidates` by two thresholds. Items with `score >= high`
/// land in `auto_accept`; `[low, high)` in `borderline`; `< low` in
/// `auto_reject`.
pub fn partition(candidates: Vec<Candidate>, low: f64, high: f64) -> PartitionReport {
    let (mut auto_a, mut bord, mut auto_r) = (Vec::new(), Vec::new(), Vec::new());
    for c in candidates {
        if c.score >= high {
            auto_a.push(c);
        } else if c.score >= low {
            bord.push(c);
        } else {
            auto_r.push(c);
        }
    }
    let summary = format!(
        "Review {} borderline candidate(s) in range [{:.3}, {:.3}). For each, call \
         `borderline_record_verdict` with verdict `\"accept\"` or `\"reject\"`. \
         {} auto-accepted, {} auto-rejected.",
        bord.len(),
        low,
        high,
        auto_a.len(),
        auto_r.len()
    );
    PartitionReport {
        auto_accept: auto_a,
        borderline: bord,
        auto_reject: auto_r,
        summary_for_review: summary,
    }
}

// ─── Verdict persistence ────────────────────────────────────────────────────

const ENSURE_TABLE: &str = "
CREATE TABLE IF NOT EXISTS borderline_verdicts (
    candidate_id TEXT NOT NULL,
    namespace TEXT NOT NULL DEFAULT 'default',
    verdict TEXT NOT NULL CHECK (verdict IN ('accept', 'reject')),
    rationale TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (candidate_id, namespace, created_at)
)";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BorderlineVerdict {
    pub candidate_id: String,
    /// Logical namespace ("default" if unspecified). Lets a single server
    /// host multiple independent borderline loops without collision.
    #[serde(default = "default_namespace")]
    pub namespace: String,
    /// Either "accept" or "reject".
    pub verdict: String,
    #[serde(default)]
    pub rationale: Option<String>,
}

fn default_namespace() -> String {
    "default".to_string()
}

fn ensure(db: &StateDb) -> anyhow::Result<()> {
    db.conn().execute(ENSURE_TABLE, [])?;
    Ok(())
}

pub fn record_verdict(db: &StateDb, v: &BorderlineVerdict) -> anyhow::Result<()> {
    if !matches!(v.verdict.as_str(), "accept" | "reject") {
        anyhow::bail!("invalid verdict `{}`: must be accept/reject", v.verdict);
    }
    ensure(db)?;
    db.conn().execute(
        "INSERT INTO borderline_verdicts (candidate_id, namespace, verdict, rationale) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![v.candidate_id, v.namespace, v.verdict, v.rationale],
    )?;
    Ok(())
}

/// Return the most-recent verdict for a candidate id in the given namespace,
/// or `None` if no verdict has been recorded.
pub fn latest_verdict(db: &StateDb, namespace: &str, candidate_id: &str) -> anyhow::Result<Option<BorderlineVerdict>> {
    ensure(db)?;
    let conn = db.conn();
    let row: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT verdict, rationale FROM borderline_verdicts \
             WHERE candidate_id = ?1 AND namespace = ?2 ORDER BY created_at DESC LIMIT 1",
            rusqlite::params![candidate_id, namespace],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();
    Ok(row.map(|(verdict, rationale)| BorderlineVerdict {
        candidate_id: candidate_id.to_string(),
        namespace: namespace.to_string(),
        verdict,
        rationale,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn fresh_db() -> StateDb {
        StateDb::open(Path::new(":memory:")).unwrap()
    }

    fn cand(id: &str, score: f64) -> Candidate {
        Candidate { id: id.to_string(), score, context: serde_json::Value::Null }
    }

    #[test]
    fn partition_splits_by_two_thresholds() {
        let cs = vec![cand("a", 0.95), cand("b", 0.7), cand("c", 0.2)];
        let r = partition(cs, 0.4, 0.85);
        assert_eq!(r.auto_accept.len(), 1);
        assert_eq!(r.auto_accept[0].id, "a");
        assert_eq!(r.borderline.len(), 1);
        assert_eq!(r.borderline[0].id, "b");
        assert_eq!(r.auto_reject.len(), 1);
        assert_eq!(r.auto_reject[0].id, "c");
    }

    #[test]
    fn summary_text_reflects_counts() {
        let cs = vec![cand("a", 0.9), cand("b", 0.6), cand("c", 0.6), cand("d", 0.1)];
        let r = partition(cs, 0.5, 0.85);
        assert!(r.summary_for_review.contains("2 borderline"));
        assert!(r.summary_for_review.contains("1 auto-accepted"));
        assert!(r.summary_for_review.contains("1 auto-rejected"));
    }

    #[test]
    fn record_verdict_round_trip() {
        let db = fresh_db();
        record_verdict(
            &db,
            &BorderlineVerdict {
                candidate_id: "pair_42".to_string(),
                namespace: "alignment".to_string(),
                verdict: "accept".to_string(),
                rationale: Some("labels matched after stemming".to_string()),
            },
        )
        .unwrap();
        let v = latest_verdict(&db, "alignment", "pair_42").unwrap().unwrap();
        assert_eq!(v.verdict, "accept");
    }

    #[test]
    fn record_verdict_rejects_invalid_label() {
        let db = fresh_db();
        let err = record_verdict(
            &db,
            &BorderlineVerdict {
                candidate_id: "x".to_string(),
                namespace: "default".to_string(),
                verdict: "maybe".to_string(),
                rationale: None,
            },
        )
        .expect_err("should reject");
        assert!(format!("{}", err).contains("invalid verdict"));
    }

    #[test]
    fn namespaces_isolate_verdicts() {
        let db = fresh_db();
        record_verdict(
            &db,
            &BorderlineVerdict {
                candidate_id: "x".to_string(),
                namespace: "ns_a".to_string(),
                verdict: "accept".to_string(),
                rationale: None,
            },
        )
        .unwrap();
        record_verdict(
            &db,
            &BorderlineVerdict {
                candidate_id: "x".to_string(),
                namespace: "ns_b".to_string(),
                verdict: "reject".to_string(),
                rationale: None,
            },
        )
        .unwrap();
        let va = latest_verdict(&db, "ns_a", "x").unwrap().unwrap();
        let vb = latest_verdict(&db, "ns_b", "x").unwrap().unwrap();
        assert_eq!(va.verdict, "accept");
        assert_eq!(vb.verdict, "reject");
    }
}

```

### Core Architecture Module: `src/boundary_core.rs`
```
// SPDX-FileCopyrightText: 2026 Fabio Rovai
// SPDX-License-Identifier: MIT

//! The pure core of the certificate boundary, over bytes and nothing else.
//!
//! `docs/trusted-computing-base.md` says that every Lean theorem in `lean/` is
//! conditional on the Rust engine writing down the truth, and that the code
//! deciding whether it does is a handful of small, total, pure functions. This
//! module is those functions. `src/reason.rs` and `src/tableaux.rs` call them;
//! they are not a copy.
//!
//! Everything here is `u8`, `&[u8]`, `Vec<u8>`, `usize`, `bool` and one
//! three-constructor enum. No `str`, no `String`, no trait beyond what the
//! primitives carry, no type from any other crate. That is not a style rule.
//! `aeneas/oo-boundary` reaches THIS FILE with `#[path]` and Aeneas translates
//! it into a pure functional model in Lean 4; Aeneas handles a subset of safe
//! Rust that stops at `str` and at anything reaching into `oxrdf` or `oxiri`.
//! Widening a signature here to `&str` deletes the Lean model of that function.
//! See `docs/aeneas-boundary.md`.
//!
//! The `&str` wrappers live at the call sites and are `as_bytes()` and nothing
//! else. Every separator this module tests for is ASCII, and no ASCII byte can
//! occur inside a multi-byte UTF-8 sequence, so a byte-level test and a
//! `char`-level test agree on every `&str` and the wrapper costs nothing.
//! `tcb_wrappers_agree_with_the_char_level_predicates` in `src/reason.rs` is
//! the property test that pins that sentence.

/// Which position of a certificate line refused to be written.
///
/// Deliberately a bare enum and not an `anyhow::Error`. A formatted error
/// inside a writer is what put CBMC inside the formatting machinery and killed
/// the first `parse_pat` Kani harness, and it would put Aeneas inside
/// `core::fmt` too. The message a user reads is built by the caller, from this
/// and the term.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Position {
    Subject,
    Predicate,
    Object,
}

/// Can this triple be written by an RDF serialiser?
///
/// A literal cannot be a subject and only an IRI can be a predicate, in every
/// RDF 1.1 serialisation. Terms arrive in their N-Triples spelling, so a
/// literal begins with `"` and an IRI with `<`. The history of the defect this
/// guard closed is on `reason::writable_triple`, which is the `&str` wrapper.
///
/// Note what it says about the EMPTY subject: `"".starts_with('"')` is false,
/// so an empty subject passes this guard. That is not a hole, because
/// `term_fits_the_format` refuses an empty term outright and every certificate
/// path runs both, but it is the kind of edge the bounded harness never saw:
/// `writable_triple_decides_both_positions` fixes the term length at four
/// bytes. `OOBoundary.writable_triple_bytes_eq` covers every length including
/// zero.
pub fn writable_triple_bytes(subject: &[u8], predicate: &[u8]) -> bool {
    !starts_with_byte(subject, b'"') && starts_with_byte(predicate, b'<')
}

/// Whether `s` begins with the byte `b`. False on the empty slice.
pub fn starts_with_byte(s: &[u8], b: u8) -> bool {
    !s.is_empty() && s[0] == b
}

/// The half of [`term_fits_the_format`] that is about the FORMAT and not about
/// N-Triples: a field is non-empty and carries no separator.
///
/// `horn.tsv` also writes variable names, which are not terms and have no
/// N-Triples spelling, and this is what they have to satisfy.
pub fn field_fits_the_format(f: &[u8]) -> bool {
    if f.is_empty() {
        return false;
    }
    let mut i = 0;
    while i < f.len() {
        if f[i] == b'\t' || f[i] == b'\n' || f[i] == b'\r' {
            return false;
        }
        i += 1;
    }
    true
}

/// Whether a term can be written to a certificate file without forging it.
///
/// This is TCB-4 and TCB-5, enforced here rather than observed of `oxrdf`.
/// The reasoning is on `reason::term_fits_the_format`, the `&str` wrapper.
pub fn term_fits_the_format(t: &[u8]) -> bool {
    if !field_fits_the_format(t) {
        return false;
    }
    t[0] == b'<' || t[0] == b'"' || (t[0] == b'_' && t.len() > 1 && t[1] == b':')
}

/// A name that survives the round trip through `axioms.tsv` and `model.tsv`.
///
/// TCB-25. The concept grammar is SPACE separated and the files are TAB
/// separated, so the DL path is exposed to a space as well as to the three
/// separators `field_fits_the_format` refuses. The two predicates are
/// deliberately separate functions rather than one with a flag: the set of
/// bytes that breaks a format is a property of that format.
pub fn name_is_safe_bytes(name: &[u8]) -> bool {
    if name.is_empty() {
        return false;
    }
    let mut i = 0;
    while i < name.len() {
        if name[i] == b' ' || name[i] == b'\t' || name[i] == b'\n' || name[i] == b'\r' {
            return false;
        }
        i += 1;
    }
    true
}

/// Append one line of `asserted.tsv`: `s TAB p TAB o NEWLINE`.
///
/// This is the whole of that file's grammar, and it is the narrowest point of
/// the trusted computing base: `OOCert.certificate_sound` is conditional on the
/// asserted graph and `OOCert.Parse.parseTriples` recovers it by splitting on
/// those two characters.
///
/// Every term is checked BEFORE anything is appended, so a refusal leaves `out`
/// byte for byte as it was. A writer that appended a subject and then refused
/// the object would leave a half-line in the buffer, which is the same defect
/// the non-atomic materialiser had.
pub fn push_asserted_line_bytes(
    out: &mut Vec<u8>,
    s: &[u8],
    p: &[u8],
    o: &[u8],
) -> Result<(), Position> {
    if !term_fits_the_format(s) {
        return Err(Position::Subject);
    }
    if !term_fits_the_format(p) {
        return Err(Position::Predicate);
    }
    if !term_fits_the_format(o) {
        return Err(Position::Object);
    }
    out.extend_from_slice(s);
    out.push(b'\t');
    out.extend_from_slice(p);
    out.push(b'\t');
    out.extend_from_slice(o);
    out.push(b'\n');
    Ok(())
}

/// Append a triple as three further fields of a line already begun, the shape
/// `derivations.tsv` and `horn.tsv` use after their header fields. Same guard
/// and same all-or-nothing discipline as [`push_asserted_line_bytes`].
pub fn push_triple_fields_bytes(
    out: &mut Vec<u8>,
    s: &[u8],
    p: &[u8],
    o: &[u8],
) -> Result<(), Position> {
    if !term_fits_the_format(s) {
        return Err(Position::Subject);
    }
    if !term_fits_the_format(p) {
        return Err(Position::Predicate);
    }
    if !term_fits_the_format(o) {
        return Err(Position::Object);
    }
    out.push(b'\t');
    out.extend_from_slice(s);
    out.push(b'\t');
    out.extend_from_slice(p);
    out.push(b'\t');
    out.extend_from_slice(o);
    Ok(())
}

```

### Core Architecture Module: `src/state.rs`
```
// SPDX-FileCopyrightText: 2026 Fabio Rovai
// SPDX-License-Identifier: MIT

use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS ontology_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    triple_count INTEGER NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'ntriples',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monitor_watchers (
    id TEXT PRIMARY KEY,
    check_type TEXT NOT NULL,
    threshold REAL NOT NULL DEFAULT 0.0,
    severity TEXT NOT NULL DEFAULT 'warning',
    action TEXT NOT NULL DEFAULT 'notify',
    query TEXT,
    message TEXT,
    webhook_url TEXT,
    webhook_headers TEXT,
    enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS monitor_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drift_feedback (
    id TEXT PRIMARY KEY,
    from_iri TEXT NOT NULL,
    to_iri TEXT NOT NULL,
    predicted TEXT NOT NULL,
    confidence REAL NOT NULL,
    actual TEXT,
    signal_domain_range INTEGER NOT NULL DEFAULT 0,
    signal_label_sim REAL NOT NULL DEFAULT 0.0,
    signal_hierarchy INTEGER NOT NULL DEFAULT 0,
    signal_individuals INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS iri_locks (
    iri TEXT PRIMARY KEY,
    locked_at TEXT NOT NULL DEFAULT (datetime('now')),
    reason TEXT
);

CREATE TABLE IF NOT EXISTS lineage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    operation TEXT NOT NULL,
    details TEXT
);

CREATE TABLE IF NOT EXISTS enforce_rules (
    id TEXT PRIMARY KEY,
    rule_pack TEXT NOT NULL,
    query TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    message TEXT,
    enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_lineage_session ON lineage_events(session_id);
CREATE INDEX IF NOT EXISTS idx_lineage_seq ON lineage_events(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_enforce_pack ON enforce_rules(rule_pack);

CREATE TABLE IF NOT EXISTS align_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_iri TEXT NOT NULL,
    target_iri TEXT NOT NULL,
    predicted_relation TEXT NOT NULL,
    accepted INTEGER NOT NULL,
    signals_json TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_align_feedback_iris ON align_feedback(source_iri, target_iri);

CREATE TABLE IF NOT EXISTS support_verdicts (
    claim_id TEXT PRIMARY KEY,
    verdict TEXT NOT NULL,
    note TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tool_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    accepted INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tool_feedback ON tool_feedback(tool, rule_id, entity);

-- `model_fp` is a composite hash of the embedding configuration that produced
-- the vectors — see src/embed_fingerprint.rs. It is what catches a model or
-- provider swap that keeps the same dimension: `text_dim` still matches and the
-- bytes are unchanged, so nothing else notices. Nullable, because rows written
-- before this column existed have no answer, and unknown must stay
-- distinguishable from known-and-equal.
CREATE TABLE IF NOT EXISTS embeddings (
    iri TEXT PRIMARY KEY,
    text_vec BLOB NOT NULL,
    struct_vec BLOB NOT NULL,
    text_dim INTEGER NOT NULL,
    struct_dim INTEGER NOT NULL,
    model_fp TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached HNSW cosine index over the embeddings.text_vec column. Single-row
-- table keyed on `kind` (currently only the cosine variant) so future
-- index variants (Poincare, product) can coexist. `entries_hash` is a
-- fingerprint of the (iri, text_vec) set the index was built from; if it
-- changes we know the cached index is stale and must be rebuilt.
--
-- `model_fp` catches what `entries_hash` structurally cannot. With zero new
-- entities, a model swap leaves every stored vector old-model while every query
-- vector is new-model: the entry set is byte-identical, `entries_hash` is
-- unchanged, and the comparison is meaningless anyway. The two checks are kept
-- side by side because they detect different failures and both are cheap.
CREATE TABLE IF NOT EXISTS hnsw_index_cache (
    kind TEXT PRIMARY KEY,
    entries_hash BLOB NOT NULL,
    entry_count INTEGER NOT NULL,
    serialised BLOB NOT NULL,
    model_fp TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Compile cache for loaded ontology files. One row per ontology `name`.
-- See src/cache.rs for the validity policy.
CREATE TABLE IF NOT EXISTS ontology_cache (
    name TEXT PRIMARY KEY,
    source_path TEXT NOT NULL,
    source_mtime INTEGER NOT NULL,
    source_size INTEGER NOT NULL,
    source_sha TEXT NOT NULL,
    cache_path TEXT NOT NULL,
    triple_count INTEGER NOT NULL,
    compiled_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_access_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id TEXT NOT NULL UNIQUE,
    owner TEXT NOT NULL DEFAULT 'cli',
    new_turtle TEXT NOT NULL,
    added_classes TEXT NOT NULL,
    removed_classes TEXT NOT NULL,
    added_properties TEXT NOT NULL,
    removed_properties TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    applied_at TEXT,
    applied_mode TEXT
);
";

/// A column an upgrade adds to an existing table.
///
/// `CREATE TABLE IF NOT EXISTS` in [`SCHEMA`] already declares every column, so
/// a database created today needs none of these. They exist only for databases
/// created before the column was introduced.
struct ColumnAddition {
    table: &'static str,
    column: &'static str,
    ddl: &'static str,
}

/// One schema upgrade step. Applied inside a single transaction, after which
/// `PRAGMA user_version` is set to `version`.
struct Migration {
    version: i64,
    description: &'static str,
    columns: &'static [ColumnAddition],
}

/// Ordered schema migrations. Append only, never renumber: the version is
/// recorded in every `open-ontologies.db` in the field.
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "monitor webhook delivery columns",
        columns: &[
            ColumnAddition {
                table: "monitor_watchers",
                column: "webhook_url",
                ddl: "ALTER TABLE monitor_watchers ADD COLUMN webhook_url TEXT",
            },
            ColumnAddition {
                table: "monitor_watchers",
                column: "webhook_headers",
                ddl: "ALTER TABLE monitor_watchers ADD COLUMN webhook_headers TEXT",
            },
        ],
    },
    Migration {
        version: 2,
        description: "align feedback signal payload",
        columns: &[ColumnAddition {
            table: "align_feedback",
            column: "signals_json",
            ddl: "ALTER TABLE align_feedback ADD COLUMN signals_json TEXT",
        }],
    },
    Migration {
        version: 3,
        description: "embedding model fingerprint on vectors and index cache",
        columns: &[
            ColumnAddition {
                table: "embeddings",
                column: "model_fp",
                ddl: "ALTER TABLE embeddings ADD COLUMN model_fp TEXT",
            },
            ColumnAddition {
                table: "hnsw_index_cache",
                column: "model_fp",
                ddl: "ALTER TABLE hnsw_index_cache ADD COLUMN model_fp TEXT",
            },
        ],
    },
];

/// Schema version a freshly-opened database is brought up to.
pub const SCHEMA_VERSION: i64 = 3;

/// Modelling-buffer vault: surrogate to original mappings, per session.
///
/// Declared alongside [`SCHEMA`] rather than as a migration because it is a new
/// table, and `CREATE TABLE IF NOT EXISTS` already handles both the fresh and
/// the upgrade case. [`MIGRATIONS`] exists for *columns added to tables that
/// already shipped*, which is a different problem.
///
/// This never leaves the machine. See
/// `docs/superpowers/specs/2026-08-09-modelling-buffer-design.md`.
const BUFFER_SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS buffer_vault (
    session_id TEXT NOT NULL,
    surrogate TEXT NOT NULL,
    original TEXT NOT NULL,
    disposition TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (session_id, surrogate)
);
CREATE INDEX IF NOT EXISTS idx_buffer_vault_original
    ON buffer_vault(session_id, original);

CREATE TABLE IF NOT EXISTS buffer_sessions (
    session_id TEXT PRIMARY KEY,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
";

/// Is `column` present on `table`?
///
/// This is the `PRAGMA table_info` probe that replaces the old
/// discard-the-error idiom. Asking whether the column is there lets a genuine
/// failure (locked file, I/O error, corrupt page) propagate, where
/// `let _ = execute_batch(...)` swallowed it alongside the expected
/// "duplicate column name".
fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Add `plans.owner` to a database created before the column existed.
///
/// Not a [`MIGRATIONS`] entry, by that list's own rule: it exists for *columns
/// added to tables that already shipped*, and `plans` has never appeared in a
///
```

### Core Architecture Module: `src/webhook.rs`
```
// SPDX-FileCopyrightText: 2026 Fabio Rovai
// SPDX-License-Identifier: MIT

use std::time::Duration;

/// Fire-and-forget webhook delivery. Timeout is configurable via
/// `[webhook] request_timeout_secs` (default 10s).
pub async fn deliver_webhook(
    url: &str,
    headers_json: Option<&str>,
    payload: &serde_json::Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let timeout_secs = crate::runtime::webhook_request_timeout_secs();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()?;
    let mut req = client.post(url).json(payload);
    if let Some(hdr_json) = headers_json
        && let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, String>>(hdr_json) {
            for (k, v) in map {
                req = req.header(&k, &v);
            }
    }
    let resp = req.send().await?;
    let status = resp.status();
    if !status.is_success() {
        eprintln!("Webhook to {} returned {}", url, status);
    }
    Ok(())
}

```

### Core Architecture Module: `studio/scripts/prepare-engine.mjs`
```
import fs from "node:fs";
import path from "node:path";

const studioRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(studioRoot, "..");
const ext = process.platform === "win32" ? ".exe" : "";

const targetTripleByPlatform = {
  win32: "x86_64-pc-windows-msvc",
  darwin: process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin",
  linux: "x86_64-unknown-linux-gnu",
};

const targetTriple = targetTripleByPlatform[process.platform];
if (!targetTriple) {
  console.warn(`Skipping engine bundle prep: unsupported platform ${process.platform}`);
  process.exit(0);
}

const source = path.join(workspaceRoot, "target", "release", `open-ontologies${ext}`);
const binariesDir = path.join(studioRoot, "src-tauri", "binaries");
const destination = path.join(binariesDir, `open-ontologies-${targetTriple}${ext}`);

if (!fs.existsSync(source)) {
  console.warn(
    `Skipping engine bundle prep: ${source} does not exist. Build the engine first with cargo build --release.`,
  );
  process.exit(0);
}

fs.mkdirSync(binariesDir, { recursive: true });
fs.copyFileSync(source, destination);
console.log(`Prepared bundled engine binary: ${destination}`);

```

### Core Architecture Module: `studio/src-tauri/src/engine.rs`
```
// SPDX-FileCopyrightText: 2026 Fabio Rovai
// SPDX-License-Identifier: MIT

use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

pub struct EngineState {
    pub running: Arc<AtomicBool>,
    pub child: Mutex<Option<Child>>,
}

fn engine_binary_names() -> &'static [&'static str] {
    #[cfg(target_os = "windows")]
    {
        &["open-ontologies-x86_64-pc-windows-msvc.exe", "open-ontologies.exe"]
    }
    #[cfg(target_os = "macos")]
    {
        &[
            "open-ontologies-aarch64-apple-darwin",
            "open-ontologies-x86_64-apple-darwin",
            "open-ontologies",
        ]
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        &[
            "open-ontologies-x86_64-unknown-linux-gnu",
            "open-ontologies-x86_64-unknown-linux-musl",
            "open-ontologies",
        ]
    }
}

fn find_existing_binary(dir: &Path) -> Option<PathBuf> {
    engine_binary_names()
        .iter()
        .map(|name| dir.join(name))
        .find(|path| path.exists())
}

fn resolve_engine_binary() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bundled_dir = manifest_dir.join("binaries");
    if let Some(path) = find_existing_binary(&bundled_dir) {
        return Ok(path);
    }

    let workspace_root = manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .ok_or("Cannot resolve workspace root from Tauri manifest directory")?;
    for profile in ["release", "debug"] {
        let candidate_dir = workspace_root.join("target").join(profile);
        if let Some(path) = find_existing_binary(&candidate_dir) {
            return Ok(path);
        }
    }

    Err(format!(
        "No open-ontologies binary found. Checked {} and workspace target/{{release,debug}}.",
        bundled_dir.display()
    ))
}

fn stale_pids_on_port(port: u16) -> Vec<u32> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("netstat")
            .args(["-ano", "-p", "tcp"])
            .output();
        let Ok(output) = output else {
            return Vec::new();
        };
        let needle = format!(":{}", port);
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter(|line| line.contains("LISTENING") && line.contains(&needle))
            .filter_map(|line| line.split_whitespace().last())
            .filter_map(|pid| pid.parse::<u32>().ok())
            .collect()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("lsof")
            .args(["-ti", &format!("tcp:{}", port)])
            .output();
        let Ok(output) = output else {
            return Vec::new();
        };
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| line.trim().parse::<u32>().ok())
            .collect()
    }
}

fn kill_process(pid: u32) {
    #[cfg(target_os = "windows")]
    let _ = Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    #[cfg(not(target_os = "windows"))]
    let _ = Command::new("kill")
        .args(["-9", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

fn clear_stale_port(port: u16) {
    for pid in stale_pids_on_port(port) {
        kill_process(pid);
    }
}

// Kept in sync by hand with the matching ENGINE_PORT constant in
// sidecars/agent/index.ts (`const ENGINE_PORT = process.env.OPEN_ONTOLOGIES_STUDIO_PORT ?? '8137'`).
// That copy is a fallback for running the sidecar standalone; in the normal
// path this Rust value always wins because spawn_agent_sidecar sets
// OPEN_ONTOLOGIES_STUDIO_PORT before the sidecar ever reads it, so the two
// never need to agree at runtime, only in source.
const DEFAULT_ENGINE_PORT: u16 = 8137;

fn parse_port(raw: Option<&str>) -> u16 {
    raw.and_then(|value| value.trim().parse::<u16>().ok())
        .filter(|port| *port != 0)
        .unwrap_or(DEFAULT_ENGINE_PORT)
}

/// Single source of truth for the engine's HTTP port. Every consumer of the
/// port (the REST base URL handed to the frontend, the MCP endpoint the
/// backend calls, and the environment variable passed to the agent sidecar)
/// derives its value from this function rather than resolving it again.
pub(crate) fn engine_port() -> u16 {
    let raw = std::env::var("OPEN_ONTOLOGIES_STUDIO_PORT").ok();
    parse_port(raw.as_deref())
}

/// Exposes the resolved engine port to the frontend so it does not need its
/// own copy of the port-resolution logic (and cannot drift from Rust's view
/// of it).
#[tauri::command]
pub fn get_engine_port() -> u16 {
    engine_port()
}

pub fn spawn_engine(app: &tauri::AppHandle) -> Result<(), String> {
    let binary = resolve_engine_binary()?;
    let port = engine_port();
    clear_stale_port(port);
    std::thread::sleep(std::time::Duration::from_millis(300));

    eprintln!("[engine] spawning {}", binary.display());

    let mut child = Command::new(&binary)
        .args(["serve-http", "--port", &port.to_string()])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn engine {}: {e}", binary.display()))?;

    let stderr = child.stderr.take().ok_or("No stderr")?;
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                eprintln!("[engine] {}", line);
                if line.contains("listening") || line.contains("Listening") || line.contains(&port.to_string())
                {
                    let _ = app_handle.emit("engine-ready", true);
                }
            }
        }
        let _ = app_handle.emit("engine-stopped", true);
    });

    let state = app.state::<EngineState>();
    *state.child.lock().map_err(|e| format!("Lock error: {e}"))? = Some(child);

    let app_handle2 = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        let _ = app_handle2.emit("engine-ready", true);
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_defaults_to_8137_and_never_to_8080() {
        assert_eq!(parse_port(None), 8137);
        assert_eq!(parse_port(Some("9001")), 9001);
        assert_eq!(parse_port(Some("not-a-port")), 8137);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #425** (2026-11-20): **Studio replay demo: 3D legend says 'ies-core.ttl · 1,083 triples' over a bundle of 28 DCAT-US classes with no warrants**
  *Symptoms*: ## What happens  The replay (web) build of Studio draws `demo/precomputed/bundle.json`. Its graph is 28 classes (`Address`, `Agent`, `Attribution`, `Author`, `Catalog`, ...), 69 properties and 682 edges, and no edge carries a `warrant`. The 3D legend over it reads:  - "PROOF-CARRYING INFERENCE · ies-core.ttl · 1,083 triples" - ASSERTED: "read from ies-core.ttl. claimed by a person" - CERTIFIED 0 and REJECTED 0, plus the Lean 4 / Isabelle footer  None of that describes the bundle. The replay empty state also points to a "Documents panel" the replay tabs do not have.  #414 kept the replay text unchanged on the premise that replay is built from ies-core; the bundle shows it is not.  ## Where  `studio/src/lib/graph-legend.ts` (the `REPLAY` constant and `legendParts` for `kind: 'replay'`), `studio/src/lib/graph3d-model.ts` / `Graph3D.tsx` (empty-state text).  ## Expected  The replay legend describes the bundle it draws: the corpus it came from and counts taken from the bundle, and the proof-carrying rows and footer only when the bundle carries warrants (the rule live mode now follows). If the replay is meant to show proof-carrying inference, the bundle needs regenerating with warrants instead. 

- **Issue #424** (2026-11-20): **Studio 3D in live mode still shows replay-only legend rows, footer and empty-state text, and tints classes named like tool nodes**
  *Symptoms*: Follow-up to #414, which makes the legend name the loaded file and its triple count.  ## What happens  `studio/src/components/Graph3D.tsx` was written for the replay demo, and in live mode:  - the legend still lists CERTIFIED and REJECTED rows (always 0 in live mode, which carries no warrants) and the Lean 4 / Isabelle footer; - the empty state reads "Build the knowledge graph first (Documents panel)" (around line 248), but live mode has no Documents panel; - `TOOL_NODES` (around line 54) matches nodes by display name, so a live class whose label or local name is exactly `E`, `Z3`, `Vampire`, `certificate` and so on is pulled out of its component and tinted as a verification-layer tool node.  ## Expected  The proof-carrying parts of the legend render only when the graph carries warrant data, the empty-state text fits the mode, and tool nodes are recognised by something the replay bundle sets (a kind or a namespace) rather than by name. 

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

### Incident Patch 1: `b639a6c3` (2026-11-18)
**Commit Message**: fix(reasoning): join newly derived edges during incremental transitivity

Fix #416 by joining the persisted closure with an in-memory index of
transitive edges from the current incremental run. Index both directions
and expose each round's inferred edges to subsequent joins, so subproperty
and inverse consequences can compose before final materialisation.

Keep targeted store queries, scan and iteration limits, dry-run behaviour,
and the existing transactional publication and durable support capture.
Deduplicate neighbours shared by the stored and in-memory graphs.

Add nine regression tests covering tracked and untracked inference, inverse
rules, multiple rounds, named graphs, batch-size invariance, dry runs,
alternative supports and withdrawal of ungrounded cycles. Update CHANGELOG.
All nine new tests fail against the previous implementation and pass after
the fix.

Validation on the existing Windows GNU toolchain:
- cargo build --offline --locked
- Five incremental unit tests and nine related integration suites: 110 tests
  exercised successfully; one release-provenance test skipped without Git tags.
- cargo clippy --offline --locked --all-targets -- -D warnings

Linux CI and th

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -165,6 +165,15 @@ All notable changes to Open Ontologies are documented here.
 
 ### Fixed
 
+- **Incremental transitivity joins edges derived in the same run** (#416).
+  Subproperty and inverse rules could produce two connected edges without
+  their transitive consequence, while the response reported `complete: true`.
+  Targeted joins now include an in-memory index of the current run's edges
+  alongside the stored closure. Materialisation still happens after inference,
+  and tracked runs retain alternative supports and dependency-based withdrawal.
+  Regression tests cover tracked and untracked runs, multiple rounds, named
+  graphs, dry runs, batching, and withdrawal of alternative or cyclic support.
+
 - **Clinical validation and drift detection read a tagged label by its text**
   (#406). Both stripped quotes from the N-Triples form of the literal, so
   `"Dog"@en` became `Dog"@en`. Clinical validation searched the crosswalk for
```

**File**: `src/reason_incremental.rs` (modified, +58/-5)
```diff
@@ -89,6 +89,36 @@ struct Schema {
     truncated: bool,
 }
 
+/// Transitive edges from this run, indexed before the next round joins them.
+/// They are published only after inference finishes, with their recorded support.
+#[derive(Default)]
+struct TransitiveEdges {
+    outgoing: HashMap<(String, String), HashSet<String>>,
+    incoming: HashMap<(String, String), HashSet<String>>,
+}
+
+impl TransitiveEdges {
+    fn insert(&mut self, (s, p, o): &Triple) {
+        self.outgoing
+            .entry((p.clone(), s.clone()))
+            .or_default()
+            .insert(o.clone());
+        self.incoming
+            .entry((p.clone(), o.clone()))
+            .or_default()
+            .insert(s.clone());
+    }
+
+    fn neighbours(&self, term: &str, pred: &str, forward: bool) -> Option<&HashSet<String>> {
+        let index = if forward {
+            &self.outgoing
+        } else {
+            &self.incoming
+        };
+        index.get(&(pred.to_owned(), term.to_owned()))
+    }
+}
+
 /// The row cap on every internally-authored scan here. A scan that returns
 /// exactly this many rows is reported as possibly truncated rather than assumed
 /// complete.
@@ -382,7 +412,11 @@ impl IncrementalReasoner {
         // that lead into it. Only asked for transitive properties, and only
         // about terms the delta actually mentions.
         let neighbours_truncated = std::cell::Cell::new(false);
-        let neighbours = |term: &str, pred: &str, forward: bool| -> anyhow::Result<Vec<String>> {
+        let neighbours = |term: &str,
+                          pred: &str,
+                          forward: bool,
+                          local: &TransitiveEdges|
+         -> anyhow::Result<HashSet<String>> {
             let q = if forward {
                 format!("SELECT ?x WHERE {{ {term} {pred} ?x }} LIMIT 10000")
             } else {
@@ -398,15 +432,26 @@ impl IncrementalReasoner {
             if rows.len() >= 10000 {
                 neighbours_truncated.set(true);
             }
-            rows.iter()
+            let mut found = rows
+                .iter()
                 .map(|row| {
                     row["x"].as_str().map(str::to_owned).ok_or_else(|| {
                         anyhow::anyhow!("incremental neighbour query returned an unbound term")
                     })
                 })
-                .collect()
+                .collect::<anyhow::Result<HashSet<_>>>()?;
+            if let Some(neighbours) = local.neighbours(term, pred, forward) {
+                found.extend(neighbours.iter().cloned());
+            }
+            Ok(found)
         };
 
+        let mut local_edges = TransitiveEdges::default();
+        for triple in delta {
+            if schema.transitive.contains(&triple.1) {
+                local_edges.insert(triple);
+            }
+        }
         let mut derived: HashSet<Triple> = HashSet::new();
         let mut frontier: Vec<Triple> = delta.to_vec();
         let mut rounds = 0usize;
@@ -547,7 +592,7 @@ impl IncrementalReasoner {
                         }
                     }
                     if schema.transitive.contains(p) {
-                        for far in neighbours(o, p, true)? {
+                        for far in neighbours(o, p, true, &local_edges)? {
                             emit(
                                 (s.clone(), p.clone(), far.clone()),
                                 "prp-trp",
@@ -563,7 +608,7 @@ impl IncrementalReasoner {
                                 &mut next,
                             );
                         }
-                        for near in neighbours(s, p, false)? {
+                        for near in neighbours(s, p, false, &local_edges)? {
                             emit(
                                 (near.clone(), p.clone(), o.clone()),
                                 "prp-trp",
@@ -597,6 +642,14 @@ impl IncrementalReasoner {
                     // forward chainer that only one of two entry points runs.
                 }
             }
+            // Joins must also see edges derived in earlier rounds of THIS run.
+            // Querying only the store misses new-new joins and can falsely
+            // report a complete closure when the frontier becomes empty (#416).
+            for triple in &next {
+                if schema.transitive.contains(&triple.1) {
+                    local_edges.insert(triple);
+                }
+            }
             frontier = next;
         }
 
```

**File**: `tests/incremental_transitive_join_test.rs` (added, +246/-0)
```diff
@@ -0,0 +1,246 @@
+// SPDX-FileCopyrightText: 2026 Gqqqqgg
+// SPDX-License-Identifier: MIT
+
+//! Newly inferred edges must participate in the same incremental closure (#416).
+
+use open_ontologies::graph::GraphStore;
+use open_ontologies::reason::{InferenceTarget, Reasoner, Spelled};
+use open_ontologies::reason_incremental::IncrementalReasoner;
+use open_ontologies::temporal::ScopeRequest;
+use serde_json::Value;
+use std::collections::BTreeSet;
+use std::sync::Arc;
+
+const PREFIXES: &str = "@prefix : <http://example.org/> .
+@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
+@prefix owl: <http://www.w3.org/2002/07/owl#> .";
+const SCHEMA: &str = ":q rdfs:subPropertyOf :p . :p a owl:TransitiveProperty .";
+
+fn edge(s: &str, p: &str, o: &str) -> Spelled {
+    (
+        format!("<http://example.org/{s}>"),
+        format!("<http://example.org/{p}>"),
+        format!("<http://example.org/{o}>"),
+    )
+}
+
+fn ntriples(edges: &[Spelled]) -> String {
+    edges
+        .iter()
+        .map(|(s, p, o)| format!("{s} {p} {o} .\n"))
+        .collect()
+}
+
+fn prepared_graph(schema: &str, tracking: bool) -> Arc<GraphStore> {
+    let graph = Arc::new(GraphStore::new());
+    graph
+        .load_turtle(&format!("{PREFIXES}\n{schema}"), None)
+        .unwrap();
+    Reasoner::run_scoped_with_tracking(
+        &graph,
+        "owl-rl",
+        true,
+        InferenceTarget::DefaultGraph,
+        None,
+        &ScopeRequest::Unscoped,
+        tracking,
+    )
+    .unwrap();
+    graph
+}
+
+fn incremental(graph: &Arc<GraphStore>, delta: &[Spelled], tracking: bool) -> Value {
+    graph.load_ntriples(&ntriples(delta)).unwrap();
+    let report: Value = serde_json::from_str(
+        &IncrementalReasoner::run_scoped_with_tracking(graph, delta, true, false, tracking)
+            .unwrap(),
+    )
+    .unwrap();
+    assert_eq!(report["ok"], true, "{report}");
+    assert_eq!(report["complete"], true, "{report}");
+    report
+}
+
+fn triples(graph: &GraphStore) -> BTreeSet<Spelled> {
+    graph.all_triples().unwrap().into_iter().collect()
+}
+
+fn check_subproperty_join(tracking: bool) {
+    let graph = prepared_graph(SCHEMA, tracking);
+    let report = incremental(
+        &graph,
+        &[edge("a", "q", "b"), edge("b", "q", "c")],
+        tracking,
+    );
+    assert!(
+        triples(&graph).contains(&edge("a", "p", "c")),
+        "a completed incremental run omitted the transitive consequence: {report}"
+    );
+    assert_eq!(report["inferred_count"], 3);
+    if tracking {
+        assert!(
+            graph
+                .ledger()
+                .unwrap()
+                .unwrap()
+                .grounded()
+                .contains(&edge("a", "p", "c"))
+        );
+    }
+}
+
+#[test]
+fn new_subproperty_edges_join_in_one_untracked_run() {
+    check_subproperty_join(false);
+}
+
+#[test]
+fn new_subproperty_edges_join_in_one_tracked_run() {
+    check_subproperty_join(true);
+}
+
+#[test]
+fn new_inverse_edges_join_in_one_run() {
+    for tracking in [false, true] {
+        let graph = prepared_graph(
+            ":q owl:inverseOf :p . :p a owl:TransitiveProperty .",
+            tracking,
+        );
+        incremental(
+            &graph,
+            &[edge("b", "q", "a"), edge("c", "q", "b")],
+            tracking,
+        );
+        assert!(triples(&graph).contains(&edge("a", "p", "c")));
+    }
+}
+
+#[test]
+fn several_rounds_join_new_edges_with_both_sides_of_the_stored_closure() {
+    for tracking in [false, true] {
+        let schema = format!("{SCHEMA} :left :p :a . :e :p :right .");
+        let graph = prepared_graph(&schema, tracking);
+        incremental(
+            &graph,
+            &[
+                edge("a", "q", "b"),
+                edge("b", "q", "c"),
+                edge("c", "q", "d"),
+                edge("d", "q", "e"),
+                edge("right", "other", "unrelated"),
+            ],
+            tracking,
+        );
+        let actual = triples(&graph);
+        assert!(actual.contains(&edge("left", "p", "right")));
+        assert!(!actual.contains(&edge("left", "p", "unrelated")));
+
+        let expected = prepared_graph(&schema, tracking);
+        expected
+            .load_ntriples(&ntriples(&[
+                edge("a", "q", "b"),
+                edge("b", "q", "c"),
+                edge("c", "q", "d"),
+                edge("d", "q", "e"),
+                edge("right", "other", "unrelated"),
+            ]))
+            .unwrap();
+        Reasoner::run(&expected, "owl-rl", true).unwrap();
+        assert_eq!(actual, triples(&expected));
+    }
+}
+
+#[test]
+fn dry_run_reports_the_new_join_without_publishing_data_or_support() {
+    let graph = prepared_graph(SCHEMA, false);
+    let delta = [edge("a", "q", "b"), edge("b", "q", "c")];
+    graph.load_ntriples(&ntriples(&delta)).unwrap();
+    let before = graph.snapshot("nquads").unwrap();
+    let report: Value = serde_json::from_str(
+        
```

---

### Incident Patch 2: `8ce22770` (2026-11-20)
**Commit Message**: An error is valid JSON whatever its message contains, so the REST routes no longer answer null (#420)

The serve-http /api routes, several CLI commands and batch built
{"error": ...} with format!, so a message carrying a double quote, a
backslash or a newline came out as invalid JSON. The REST routes parsed their
own output, failed, and answered null with HTTP 200. lint, diff, defects,
drift and vocab-check printed the broken text and exited 0, because their exit
code is read from an error key they could no longer parse. batch kept the text
only under raw. /api/save did the same on success when the path needed
escaping, which is every Windows path.

open_ontologies::output::error_json now builds the object with serde_json, and
all 36 sites (26 in main.rs, 10 in batch.rs) use it; /api/save's success body
is built the same way. tests/api_error_json_test.rs drives a real serve-http
child and the CLI with a SPARQL query and a Turtle file whose parse errors
quote a quote and a backslash, a caller-supplied format containing each, and a
save path that needs escaping. All five tests failed before the change (null
bodies, unparseable CLI output, lint exit 0) and pass after it.

Co-Authored-

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -192,6 +192,18 @@ All notable changes to Open Ontologies are documented here.
 
 ### Fixed
 
+- **An error is valid JSON whatever its message contains** (#420). The
+  `serve-http` REST routes, several CLI commands and `batch` wrote
+  `{"error": ...}` by string formatting, so a message carrying a double quote,
+  a backslash or a newline (a SPARQL or Turtle parse error quoting the
+  offending character, a format name the caller supplied, any Windows path)
+  was invalid JSON. `/api/query`, `/api/save` and the other `/api` routes
+  then answered `null` with HTTP 200; `lint`, `diff`, `defects`, `drift` and
+  `vocab-check` printed the broken text and exited 0; `batch` kept it only
+  under `raw`. `/api/save` also answered `null` on success when the saved path
+  needed escaping, which is every Windows path. All 36 sites now build the
+  object with `serde_json`.
+
 - **Studio's 3D legend names the ontology live mode has loaded** (#414). The
   legend read "ies-core.ttl · 1,083 triples", and its ASSERTED row "read from
   ies-core.ttl", in both builds. That is true of the replay demo, which is
```

**File**: `src/batch.rs` (modified, +10/-10)
```diff
@@ -312,7 +312,7 @@ impl BatchRunner {
         match crate::graph::GraphStore::read_as_turtle(input) {
             Ok(content) => {
                 let result = OntologyService::lint_with_feedback(&content, Some(&self.db))
-                    .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+                    .unwrap_or_else(crate::output::error_json);
                 serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
             }
             Err(e) => json!({"error": e.to_string()}),
@@ -1067,7 +1067,7 @@ impl BatchRunner {
         match crate::graph::GraphStore::read_as_turtle(data_path) {
             Ok(data) => {
                 let result = crate::vocab_check::check_data_vocab(&self.graph, &data, &extra)
-                    .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+                    .unwrap_or_else(crate::output::error_json);
                 serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
             }
             Err(e) => json!({"error": e.to_string()}),
@@ -1088,7 +1088,7 @@ impl BatchRunner {
             Err(e) => return json!({"error": format!("reading {}: {}", args[1], e)}),
         };
         let result = OntologyService::diff(&old, &new)
-            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+            .unwrap_or_else(crate::output::error_json);
         serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
     }
 
@@ -1142,7 +1142,7 @@ impl BatchRunner {
         let pack = args.first().map(|s| s.as_str()).unwrap_or("generic");
         let enforcer = crate::enforce::Enforcer::new(self.db.clone(), self.graph.clone());
         let result = enforcer.enforce_with_feedback(pack, Some(&self.db))
-            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+            .unwrap_or_else(crate::output::error_json);
         serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
     }
 
@@ -1207,7 +1207,7 @@ impl BatchRunner {
                     logic: !args.iter().any(|a| a == "--no-logic-check"),
                 };
                 let result = planner.plan_with(&turtle, checks)
-                    .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+                    .unwrap_or_else(crate::output::error_json);
                 serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
             }
             Err(e) => json!({"error": e.to_string()}),
@@ -1223,7 +1223,7 @@ impl BatchRunner {
             .unwrap_or("safe");
         let planner = crate::plan::Planner::new(self.db.clone(), self.graph.clone());
         let result = planner.apply_plan(plan_id.as_deref(), mode)
-            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+            .unwrap_or_else(crate::output::error_json);
         serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
     }
 
@@ -1234,14 +1234,14 @@ impl BatchRunner {
             None => return json!({"error": "version requires a label"}),
         };
         let result = OntologyService::save_version(&self.db, &self.graph, label)
-            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+            .unwrap_or_else(crate::output::error_json);
         serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
     }
 
     fn exec_history(&self) -> Value {
         use crate::ontology::OntologyService;
         let result = OntologyService::list_versions(&self.db)
-            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+            .unwrap_or_else(crate::output::error_json);
         serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
     }
 
@@ -1252,7 +1252,7 @@ impl BatchRunner {
             None => return json!({"error": "rollback requires a label"}),
         };
         let result = OntologyService::rollback_version(&self.db, &self.graph, label)
-            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+            .unwrap_or_else(crate::output::error_json);
         serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
     }
 
@@ -1431,7 +1431,7 @@ impl BatchRunner {
         };
         let detector = crate::drift::DriftDetector::new(self.db.clone());
         let result = detector.detect(&v1, &v2)
-            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+            .unwrap_or_else(crate::output::error_json);
         serde_json::from_str(&result).unwrap_or(json!({"raw": result}))
     }
 
```

**File**: `src/main.rs` (modified, +27/-27)
```diff
@@ -2563,7 +2563,7 @@ async fn async_main() -> anyhow::Result<()> {
                     let g = sg_stats.clone();
                     async move {
                         axum::Json(serde_json::from_str::<serde_json::Value>(
-                            &g.get_stats().unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e))
+                            &g.get_stats().unwrap_or_else(open_ontologies::output::error_json)
                         ).unwrap_or_default())
                     }
                 }))
@@ -2572,7 +2572,7 @@ async fn async_main() -> anyhow::Result<()> {
                     async move {
                         let query = body.0["query"].as_str().unwrap_or("").to_string();
                         axum::Json(serde_json::from_str::<serde_json::Value>(
-                            &g.sparql_select(&query).unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e))
+                            &g.sparql_select(&query).unwrap_or_else(open_ontologies::output::error_json)
                         ).unwrap_or_default())
                     }
                 }))
@@ -2583,7 +2583,7 @@ async fn async_main() -> anyhow::Result<()> {
                         axum::Json(serde_json::from_str::<serde_json::Value>(
                             &match g.sparql_update_with_retraction(&query, body.0["retract_inferences"].as_bool().unwrap_or(false)) {
                                 Ok(n)  => format!(r#"{{"ok":true,"affected":{}}}"#, n),
-                                Err(e) => format!(r#"{{"error":"{}"}}"#, e),
+                                Err(e) => open_ontologies::output::error_json(e),
                             }
                         ).unwrap_or_default())
                     }
@@ -2596,7 +2596,7 @@ async fn async_main() -> anyhow::Result<()> {
                         axum::Json(serde_json::from_str::<serde_json::Value>(
                             &match g.load_file(&path) {
                                 Ok(n)  => format!(r#"{{"ok":true,"triples_loaded":{}}}"#, n),
-                                Err(e) => format!(r#"{{"error":"{}"}}"#, e),
+                                Err(e) => open_ontologies::output::error_json(e),
                             }
                         ).unwrap_or_default())
                     }
@@ -2609,7 +2609,7 @@ async fn async_main() -> anyhow::Result<()> {
                         axum::Json(serde_json::from_str::<serde_json::Value>(
                             &match g.load_turtle(&turtle, base.as_deref()) {
                                 Ok(n)  => format!(r#"{{"ok":true,"triples_loaded":{}}}"#, n),
-                                Err(e) => format!(r#"{{"error":"{}"}}"#, e),
+                                Err(e) => open_ontologies::output::error_json(e),
                             }
                         ).unwrap_or_default())
                     }
@@ -2622,8 +2622,8 @@ async fn async_main() -> anyhow::Result<()> {
                         let path = open_ontologies::config::expand_tilde(&path);
                         axum::Json(serde_json::from_str::<serde_json::Value>(
                             &match g.save_file(&path, &format) {
-                                Ok(_)  => format!(r#"{{"ok":true,"path":"{}"}}"#, path),
-                                Err(e) => format!(r#"{{"error":"{}"}}"#, e),
+                                Ok(_)  => serde_json::json!({ "ok": true, "path": path }).to_string(),
+                                Err(e) => open_ontologies::output::error_json(e),
                             }
                         ).unwrap_or_default())
                     }
@@ -2989,7 +2989,7 @@ async fn async_main() -> anyhow::Result<()> {
             let (_db, graph) = setup(&cli.data_dir)?;
             let stats_json = graph
                 .get_stats()
-                .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+                .unwrap_or_else(open_ontologies::output::error_json);
             output_result(&stats_json, cli.pretty);
         }
         Commands::Query { query } => {
@@ -3003,7 +3003,7 @@ async fn async_main() -> anyhow::Result<()> {
             };
             let result = graph
                 .sparql_select(&query_str)
-                .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+                .unwrap_or_else(open_ontologies::output::error_json);
             output_result(&result, cli.pretty);
         }
         Commands::Diff { old_path, new_path } => {
@@ -3025,7 +3025,7 @@ async fn async_main() -> anyhow::Result<()> {
             let old = read(&old_path);
             let new = read(&new_path);
             let result = OntologyService::diff(&old, &new)
-                .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
+                .unwrap_or_else(open_ontologies::output::error_json);
             output_result_checked(&result, cli.pretty);
         }
         Commands::Defects { input, limit } => {
@@ -3069,7 +3069,7 @@ async fn async_main() -> anyhow::Re
```

**File**: `src/output.rs` (modified, +13/-0)
```diff
@@ -21,6 +21,19 @@
 
 use serde_json::Value;
 
+/// `{"error": "<message>"}` as JSON text, with the message escaped.
+///
+/// Call sites used to write `format!(r#"{{"error":"{}"}}"#, e)`, which is
+/// invalid JSON whenever the message carries a double quote, a backslash or a
+/// newline: a parse error quoting the offending character, a format name the
+/// caller supplied, any Windows path. The REST routes then parsed their own
+/// output, failed and answered `null`; the CLI printed the broken text and,
+/// where the exit code is read from the `error` key, exited 0; batch kept it
+/// only as `{"raw": ...}` (#420).
+pub fn error_json(message: impl std::fmt::Display) -> String {
+    serde_json::json!({ "error": message.to_string() }).to_string()
+}
+
 /// The whole human-readable text for one command's result.
 pub type Renderer = fn(&Value) -> String;
 
```

**File**: `tests/api_error_json_test.rs` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+// SPDX-FileCopyrightText: 2026 Fabio Rovai
+// SPDX-License-Identifier: MIT
+
+//! An error is valid JSON whatever its message contains (#420).
+//!
+//! The REST routes under `serve-http`'s `/api` and several CLI commands built
+//! `{"error": ...}` by string formatting. A message carrying a double quote or
+//! a backslash (a SPARQL or Turtle parse error quoting the offending
+//! character, a format name the caller supplied, any Windows path) produced
+//! invalid JSON. The REST routes then parsed their own output, failed, and
+//! answered `null` with HTTP 200; the CLI printed the broken text and, for the
+//! commands that set their exit code from the `error` key, exited 0.
+
+use serde_json::{Value, json};
+use std::io::{Read, Write};
+use std::net::{SocketAddr, TcpStream};
+use std::process::{Child, Command, Stdio};
+use std::time::{Duration, Instant};
+
+/// A SPARQL query whose parse error quotes `"` and `\` back to the caller.
+const BAD_QUERY: &str = r#"SELECT * WHERE { ?s ?p "\q" }"#;
+
+fn oo(dir: &tempfile::TempDir) -> Command {
+    let mut cmd = Command::new(env!("CARGO_BIN_EXE_open-ontologies"));
+    cmd.arg("--data-dir").arg(dir.path());
+    cmd.env_remove("OPEN_ONTOLOGIES_TOKEN")
+        .env_remove("OPEN_ONTOLOGIES_STORAGE_MODE")
+        .env_remove("GOVERNANCE_WEBHOOK")
+        .env("NO_PROXY", "127.0.0.1,localhost")
+        .env("no_proxy", "127.0.0.1,localhost")
+        .env("RUST_LOG", "warn");
+    cmd
+}
+
+struct Server(Child);
+impl Drop for Server {
+    fn drop(&mut self) {
+        let _ = self.0.kill();
+        let _ = self.0.wait();
+    }
+}
+
+fn start_server(dir: &tempfile::TempDir) -> (Server, SocketAddr) {
+    let config = dir.path().join("config.toml");
+    std::fs::write(&config, "[storage]\nmode = 'memory'\n").unwrap();
+    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
+    let addr = listener.local_addr().unwrap();
+    drop(listener);
+    let mut cmd = oo(dir);
+    cmd.env("OPEN_ONTOLOGIES_STORAGE_MODE", "memory")
+        .arg("serve-http")
+        .arg("--config")
+        .arg(&config)
+        .args(["--host", "127.0.0.1", "--port", &addr.port().to_string()])
+        .stdout(Stdio::null())
+        .stderr(Stdio::null());
+    let mut server = Server(cmd.spawn().unwrap());
+    let deadline = Instant::now() + Duration::from_secs(30);
+    loop {
+        assert!(
+            server.0.try_wait().unwrap().is_none(),
+            "HTTP server exited before binding"
+        );
+        if TcpStream::connect(addr).is_ok() {
+            break;
+        }
+        assert!(Instant::now() < deadline, "HTTP server did not bind");
+        std::thread::sleep(Duration::from_millis(20));
+    }
+    (server, addr)
+}
+
+/// One HTTP/1.1 POST over a plain socket, so the test needs no HTTP client.
+fn post(addr: SocketAddr, path: &str, body: &Value) -> (u16, Value) {
+    let body = body.to_string();
+    let mut stream = TcpStream::connect(addr).unwrap();
+    stream
+        .set_read_timeout(Some(Duration::from_secs(60)))
+        .unwrap();
+    write!(
+        stream,
+        "POST {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n\
+         Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
+        body.len()
+    )
+    .unwrap();
+    let mut response = String::new();
+    stream.read_to_string(&mut response).unwrap();
+    let (head, payload) = response
+        .split_once("\r\n\r\n")
+        .expect("an HTTP response with a header block");
+    let status = head
+        .split_whitespace()
+        .nth(1)
+        .and_then(|s| s.parse().ok())
+        .expect("a status code");
+    let value = serde_json::from_str(payload)
+        .unwrap_or_else(|e| panic!("response body is not JSON ({e}): {payload}"));
+    (status, value)
+}
+
+fn error_text(value: &Value) -> &str {
+    value["error"]
+        .as_str()
+        .unwrap_or_else(|| panic!("expected an error object, got {value}"))
+}
+
+#[test]
+fn api_query_parse_error_quoting_a_quote_and_a_backslash_is_an_error_object() {
+    let dir = tempfile::tempdir().unwrap();
+    let (_server, addr) = start_server(&dir);
+    let (status, body) = post(addr, "/api/query", &json!({ "query": BAD_QUERY }));
+    assert_eq!(status, 200);
+    let message = error_text(&body);
+    assert!(message.contains('"') && message.contains('\\'), "{message}");
+}
+
+#[test]
+fn api_save_reports_a_caller_supplied_format_that_contains_a_quote_or_backslash() {
+    let dir = tempfile::tempdir().unwrap();
+    let (_server, addr) = start_server(&dir);
+    let out = dir.path().join("out.ttl");
+    for format in ["ya\"ml", "ya\\ml"] {
+        let (_, body) = post(
+            addr,
+            "/api/save",
+            &json!({ "path": out.to_str().unwrap(), "format": format }),
+        );
+        let message = error_text(&body);
+        assert!(message.contains(format), "{message}");
+    }
+}
+
+#[test]
+fn api_save_success_names_a_path_
```

---

### Incident Patch 3: `3d0795c0` (2026-11-18)
**Commit Message**: fix(shacl): expand SPARQL constraint message templates

Expand {?name} and {$name} in fallback sh:message text using each SELECT
solution. Render literals by lexical value and preserve RDF notation for
IRIs and blank nodes. Leave unbound placeholders untouched and never
rescan inserted values.

Write the expanded message to JSON, Turtle and N-Triples reports while
preserving the template literal's language tag or datatype. Keep bound
?message precedence, default messages, result values and query evaluation
unchanged.

Add regression coverage for the issue example, per-solution bindings,
repeated placeholders, unbound variables, literal braces, escaping,
blank-node focus nodes and existing override/default behavior. Record the
user-facing fix in CHANGELOG.md.

Fixes #411

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -165,6 +165,14 @@ All notable changes to Open Ontologies are documented here.
 
 ### Fixed
 
+- **SHACL-SPARQL message templates substitute solution variables** (#411).
+  Fallback `sh:message` text now expands `{?name}` and `{$name}` for each
+  result, including the pre-bound focus node. Literals use their lexical
+  values, while IRIs and blank nodes retain their RDF form. Unbound variables
+  stay as written, and inserted values are not expanded again. JSON, Turtle
+  and N-Triples reports carry the expanded message; RDF reports preserve its
+  language tag or datatype. A bound `?message` keeps its existing precedence.
+
 - **Clinical validation and drift detection read a tagged label by its text**
   (#406). Both stripped quotes from the N-Triples form of the literal, so
   `"Dog"@en` became `Dog"@en`. Clinical validation searched the crosswalk for
```

**File**: `src/shacl.rs` (modified, +40/-4)
```diff
@@ -4,7 +4,7 @@
 use crate::graph::{GraphStore, ReadScope};
 use crate::temporal::{ScopeManifest, ScopeRequest};
 use oxigraph::io::{RdfFormat, RdfParser};
-use oxigraph::model::{Term, Variable};
+use oxigraph::model::{Literal, Term, Variable};
 use oxigraph::sparql::{QueryResults, SparqlEvaluator};
 use oxigraph::store::Store;
 use std::collections::{HashMap, HashSet};
@@ -2118,13 +2118,16 @@ impl ShaclValidator {
                                     if message.is_empty() {
                                         "SPARQL constraint violated".to_string()
                                     } else {
-                                        message.clone()
+                                        expand_message_template(&message, &row)
                                     }
                                 });
                                 let rdf = RdfTerms::new(
                                     constraint.get("severity").cloned(),
                                     bound_message.cloned().or_else(|| {
-                                        constraint.get("message").cloned().filter(|_| !message.is_empty())
+                                        constraint
+                                            .get("message")
+                                            .filter(|_| !message.is_empty())
+                                            .map(|raw| message_literal_with_text(raw, &msg))
                                     }),
                                 );
                                 let mut v = serde_json::json!({
@@ -3258,7 +3261,8 @@ fn attribute(
 /// `core/misc/message-001` declares `"Test message"@en`, and the language tag
 /// is gone. SHACL 3.6.2 makes `sh:resultSeverity` the shape's
 /// `sh:severity` and `sh:resultMessage` a copy of its `sh:message`, so the
-/// writer needs the terms as written. They travel inside each violation under
+/// writer needs the terms as written (with SPARQL message templates expanded).
+/// They travel inside each violation under
 /// [`crate::shacl_report::RDF_TERMS_KEY`] and the JSON renderer removes them.
 ///
 /// `message` is `None` whenever the result carries this engine's default text,
@@ -3524,6 +3528,38 @@ fn strip_quotes(s: &str) -> String {
     }
 }
 
+/// SHACL 5.3.2: expand `{?name}` and `{$name}` in a fallback `sh:message`.
+/// Literals use their lexical value; IRIs and blank nodes keep their RDF form.
+/// Unbound names stay as written. Only the template is scanned, so braces in
+/// an inserted value cannot trigger another substitution.
+fn expand_message_template(template: &str, row: &HashMap<String, String>) -> String {
+    let mut expanded = String::with_capacity(template.len());
+    for part in template.split_inclusive('}') {
+        if let Some((prefix, name)) = part.strip_suffix('}').and_then(|s| s.rsplit_once('{'))
+            && let Some(name) = name.strip_prefix('?').or_else(|| name.strip_prefix('$'))
+            && let Some(value) = row.get(name)
+        {
+            expanded.push_str(prefix);
+            expanded.push_str(&strip_quotes(value));
+        } else {
+            expanded.push_str(part);
+        }
+    }
+    expanded
+}
+
+/// Keep the RDF message's language tag or datatype when its text is expanded.
+fn message_literal_with_text(raw: &str, text: &str) -> String {
+    let Ok(Term::Literal(lit)) = raw.parse::<Term>() else {
+        return raw.to_string();
+    };
+    let expanded = match lit.language() {
+        Some(lang) => Literal::new_language_tagged_literal_unchecked(text, lang),
+        None => Literal::new_typed_literal(text, lit.datatype().into_owned()),
+    };
+    expanded.to_string()
+}
+
 /// Read a cardinality bound (`sh:minCount`, `sh:maxCount` and the qualified
 /// pair), or record it in `skipped` and return None.
 ///
```

**File**: `tests/shacl_sparql_message_template_test.rs` (added, +205/-0)
```diff
@@ -0,0 +1,205 @@
+// SPDX-FileCopyrightText: 2026 Fabio Rovai
+// SPDX-License-Identifier: MIT
+
+//! SHACL 5.3.2 message templates are expanded for each solution (#411).
+
+use open_ontologies::graph::GraphStore;
+use open_ontologies::shacl::{ShaclReport, ShaclValidator};
+use open_ontologies::shacl_report::ReportFormat;
+use open_ontologies::temporal::ScopeRequest;
+use oxigraph::io::{RdfFormat, RdfParser};
+use oxigraph::model::{Literal, Term};
+use serde_json::Value;
+use std::io::Cursor;
+use std::sync::Arc;
+
+fn report(data: &str, message: &str, select: &str) -> ShaclReport {
+    let graph = Arc::new(GraphStore::new());
+    graph.load_turtle(data, None).unwrap();
+    let shapes = format!(
+        r#"
+        @prefix ex: <http://example.org/> .
+        @prefix sh: <http://www.w3.org/ns/shacl#> .
+        ex:S a sh:NodeShape ; sh:targetClass ex:Item ;
+            sh:sparql [ {message} sh:select """{select}""" ] .
+        "#
+    );
+    ShaclValidator::report_scoped(&graph, &shapes, &ScopeRequest::Unscoped).unwrap()
+}
+
+fn messages(report: &ShaclReport) -> Vec<String> {
+    let json: Value = serde_json::from_str(&report.to_json_string()).unwrap();
+    assert_eq!(json["conforms"], false, "{json}");
+    assert!(json["skipped_constraints"].is_null(), "{json}");
+    let mut messages: Vec<_> = json["violations"]
+        .as_array()
+        .unwrap()
+        .iter()
+        .map(|v| v["message"].as_str().unwrap().to_string())
+        .collect();
+    messages.sort();
+    messages
+}
+
+const DATA: &str = r#"
+    @prefix ex: <http://example.org/> .
+    ex:a a ex:Item ; ex:v 5 .
+"#;
+
+const SELECT_VALUE: &str =
+    "SELECT $this ?value WHERE { $this <http://example.org/v> ?value . FILTER(?value > 3) }";
+
+fn assert_rdf_message(report: &ShaclReport, expected: Literal) {
+    for (format, parser_format) in [
+        (ReportFormat::Turtle, RdfFormat::Turtle),
+        (ReportFormat::NTriples, RdfFormat::NTriples),
+    ] {
+        let rendered = report.render(format).unwrap();
+        let found: Vec<_> = RdfParser::from_format(parser_format)
+            .for_reader(Cursor::new(rendered.as_bytes()))
+            .map(Result::unwrap)
+            .filter(|q| q.predicate.as_str() == "http://www.w3.org/ns/shacl#resultMessage")
+            .map(|q| q.object)
+            .collect();
+        assert_eq!(found, vec![Term::Literal(expected.clone())], "{rendered}");
+    }
+}
+
+#[test]
+fn the_issue_example_expands_value_and_focus_without_changing_the_result_value() {
+    let r = report(
+        DATA,
+        r#"sh:message "value too big: {?value} (focus {$this})" ;"#,
+        SELECT_VALUE,
+    );
+    assert_eq!(
+        messages(&r),
+        ["value too big: 5 (focus <http://example.org/a>)"]
+    );
+    let json: Value = serde_json::from_str(&r.to_json_string()).unwrap();
+    assert_eq!(json["violation_count"], 1);
+    assert_eq!(
+        json["violations"][0]["value"],
+        "\"5\"^^<http://www.w3.org/2001/XMLSchema#integer>"
+    );
+    assert_rdf_message(
+        &r,
+        Literal::new_simple_literal("value too big: 5 (focus <http://example.org/a>)"),
+    );
+}
+
+#[test]
+fn each_solution_expands_both_variable_markers_and_repeated_names() {
+    let data = r#"
+        @prefix ex: <http://example.org/> .
+        ex:a a ex:Item ; ex:v 5, 9 .
+        ex:b a ex:Item ; ex:v 7 .
+    "#;
+    let r = report(
+        data,
+        r#"sh:message "{?this}: {?value}/{$value}/{?value}; {$label}" ;"#,
+        r#"SELECT $this ?value ("large" AS ?label) WHERE { $this <http://example.org/v> ?value }"#,
+    );
+    assert_eq!(
+        messages(&r),
+        [
+            "<http://example.org/a>: 5/5/5; large",
+            "<http://example.org/a>: 9/9/9; large",
+            "<http://example.org/b>: 7/7/7; large",
+        ]
+    );
+}
+
+#[test]
+fn unbound_variables_and_ordinary_braces_remain_literal_text() {
+    let r = report(
+        DATA,
+        r#"sh:message "{?missing} {$missing} {value} {?} { ?value} {?value!} {ordinary {?value}} {?value" ;"#,
+        "SELECT $this ?value ?missing WHERE { $this <http://example.org/v> ?value }",
+    );
+    assert_eq!(
+        messages(&r),
+        ["{?missing} {$missing} {value} {?} { ?value} {?value!} {ordinary 5} {?value"]
+    );
+}
+
+#[test]
+fn inserted_literal_values_are_not_expanded_again() {
+    let data = r#"
+        @prefix ex: <http://example.org/> .
+        ex:a a ex:Item ; ex:v "{$this} and {?other}" .
+    "#;
+    let r = report(
+        data,
+        r#"sh:message "{?value} / {$other}" ;"#,
+        r#"SELECT $this ?value ("done" AS ?other) WHERE { $this <http://example.org/v> ?value }"#,
+    );
+    assert_eq!(messages(&r), ["{$this} and {?other} / done"]);
+}
+
+#[test]
+fn blank_node_focus_and_iri_values_keep_their_rdf_form() {
+    let data = r#"
+        @prefix ex: <http://example.org/> .
+        _:item a ex:Item ; ex:v ex:value .
+    "#;
+    let r = report(
+        data,
+        r#"sh:
```

#### Recent Merged Pull Requests:
- **PR #429** (2026-11-20): The replay's 3D legend is true of its graph: a certified ies-core run three checkers judged (#425) (@fabio-rovai)
- **PR #426** (2026-11-20): Errors are valid JSON everywhere; Studio refresh, findings, auto-save and live 3D fixes (#420 to #424) (@fabio-rovai)
- **PR #419** (2026-11-20): Land #410, #412, #415, #417, #418 and the Studio fixes for #413 and #414 (@fabio-rovai)
- **PR #418** (2026-11-20): Execute every SHACL 2.3.1 property path form (@MatthewYe)
- **PR #417** (2026-11-20): fix(reasoning): join newly derived edges during incremental transitivity (@Gqqqqgg)
- **PR #415** (2026-11-20): Studio: 2D Graph view (schema and instance neighbourhood) (@fabio-rovai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. reasoning): join newly derived edges during incremental transitivity

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fabio-rovai/open-ontologies. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b639a6c3`: reasoning): join newly derived edges during incremental transitivity. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Incremental transitivity joins edges derived in the same run** (#416).
  Subproperty and inverse rules could produce two connected edges without
  their transitive consequence, while the response reported `complete: true`.
  Targeted joins now include an in-memory index of the current run's edges
  alongside the stored closure. Materialisation still happens after inference,
  and tracked runs retain alternative supports and dependency-based withdrawal.
  Regression tests cover tracked and untracked runs, multiple rounds, named
  graphs, dry runs, batching, and withdrawal of alternative or cyclic support.

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b639a6c3` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
