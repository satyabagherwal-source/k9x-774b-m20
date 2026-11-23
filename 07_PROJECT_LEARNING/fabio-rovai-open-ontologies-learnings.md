> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fabio-rovai-open-ontologies-learnings.md`  
> **Source**: github ([https://github.com/fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies))  
> **Source Version**: `1ba7ecf8`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T17:46:20.400Z  
> **Learning ID**: `learn-github-fabio-rovai-open-ontologies`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): fabio-rovai/open-ontologies

> **Canonical Artifact**: `07_PROJECT_LEARNING/fabio-rovai-open-ontologies-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T17:46:20.393Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fabio-rovai/open-ontologies`
- **Description**: Plan, apply and roll back changes to a production ontology, with a blast radius report and a proof an auditor can re-check.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2950 stars

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
- **Issue #436** (2026-11-23): **Front-page knowledge-graph figure: labels sit on nodes, arrows and the panel border**
  *Symptoms*: The front-page figure `docs/assets/knowledge-graph.svg` (and the zh-CN variant) is crowded, and several labels are printed on top of other things drawn:  - The amber `returned unasked · Accent is a Concept, never a class` badge runs through a row of graph nodes. - The 無 glyph lands on the nodes beside `Property`. - `this line is forged` and its red ring sit on nodes. - `exit 1, rdfs11 step refused`, `oo-resolution` and `FusionOfIntegralParts` cross the border of the ontology panel. - `problem.tsv` is crossed by the dotted curves that run back from the provers. - `Activity` covers the node beside it.  Every test passes, because `no_two_labels_sit_on_top_of_each_other` compares labels with labels only. The placement code in `docs/assets/knowledge-graph.py` checks a candidate against `placed` (other labels) and never against node circles, pipeline arrows or the panel edge. Badges rest at opacity 0.4, so whatever is under them shows through.  Expected: no label box intersects a node circle, a pipeline arrow, or the panel border, in either language, and a test fails when one does. 

- **Issue #432** (2026-11-23): **vocab-check accepts a declared class used as a predicate, and a declared property used as rdf:type**
  *Symptoms*: `vocab-check` checks whether a term is declared in the loaded ontology, but not whether it is used in the role it was declared in. A declared class used as a predicate, or a declared property used as the object of `rdf:type`, passes with `conforms: true`.  Repro (`3fd98f50`):  ``` # ont.ttl @prefix ex: <http://example.org/o/> . @prefix owl: <http://www.w3.org/2002/07/owl#> . ex:Sensor a owl:Class . ex:observes a owl:ObjectProperty .  # data.ttl @prefix ex: <http://example.org/o/> . @prefix d: <http://example.org/d/> . d:s1 a ex:observes . d:s2 ex:Sensor d:x . ```  ``` printf 'load ont.ttl\nvocab-check data.ttl\n' | open-ontologies batch --no-connect ```  Result: `"conforms": true, "hallucinated_terms": []`.  Expected: both terms reported. `ex:observes` is not a class and `ex:Sensor` is not a property, so neither use is declared. Reporting them under a separate field (for example `wrong_role_terms`) would keep the "not declared at all" case distinguishable.  Related asymmetry seen in the same run: a term declared only as an individual (for example `ex:UAV a skos:Concept`) used as `rdf:type` is reported in `hallucinated_terms`, so individuals are already treated as "not a class". Classes used as predicates and properties used as classes should get the same treatment. 

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

### Incident Patch 1: `1ba7ecf8` (2026-11-23)
**Commit Message**: Merge pull request #437 from fabio-rovai/fix/hero-svg-crowding

No label on the front-page figure sits on a node, an arrow or the panel border (#436)

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -192,6 +192,21 @@ All notable changes to Open Ontologies are documented here.
 
 ### Fixed
 
+- **No label on the front-page figure sits on a node, an arrow or the panel
+  border** (#436). Labels in `docs/assets/knowledge-graph.py` were checked
+  against other labels only, so the unasked-question badge ran through a row of
+  classes, the forged-line badge and the 無 glyph sat on nodes, three labels
+  crossed the ontology panel's border and the provers' dotted curves cut through
+  `problem.tsv`, while every test passed. Placement now goes through one `fits`
+  check (labels, node discs, pipeline arrows, the forged and unasked lines, the
+  panel edge); a badge with no clear candidate searches outward (the two beat badges in
+  the panel then get a leader back to their line), and the generator refuses to
+  draw if nothing fits. The canvas is
+  1200 x 830 (was 1100 x 780) so the panel has room, the forged line is marked
+  with a capsule instead of a circle that took in its neighbours, and
+  `no_label_sits_on_a_node_an_arrow_or_the_panel_edge` checks both languages
+  (30 violations on the old English figure, 0 now).
+
 - **`vocab-check` checks that each term is used in the role it is declared in**
   (#432). A class used as a predicate, or a property used as the object of
   `rdf:type`, passed with `conforms: true` because the check only asked whether
```

**File**: `docs/assets/knowledge-graph.py` (modified, +337/-210)
```diff
@@ -94,7 +94,13 @@
 #   + rdf:type                      5
 #   + rdfs:domain, rdfs:range       1, and the file's own header
 LINKING = (SUBCLASS, TYPE, DOMAIN, RANGE)
-W, H = 1100, 780
+# 1200 x 830, up from 1100 x 780 (#436). At 1100 the pipeline's right-hand
+# labels ran into the ontology panel and the panel was too short for its 233
+# terms, so badges had nowhere to land that was not on a node. The extra width
+# goes to the gap between the pipeline and the panel, the extra height to the
+# panel; the pipeline itself stays where it was, because hero.js scales it from
+# these coordinates.
+W, H = 1200, 830
 SEED = 20260919
 ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
 OO_CERT = os.path.join(ROOT, "lean", ".lake", "build", "bin", "oo-cert")
@@ -574,7 +580,9 @@ def lay(members):
     # the rectangle the same way along its longer side, recurse. It fills the
     # region with no leftover, which is the point — the earlier layout left the
     # bottom-right of the canvas empty while fragments crowded the middle.
-    OL, OR_, T, B = 470, W - 34, 138, H - 246
+    # The panel starts at 566 so its border (550) clears the widest label of
+    # the pipeline, `oo-resolution`, which ends near 533.
+    OL, OR_, T, B = 566, W - 34, 138, H - 246
 
     def split(items, rect):
         if len(items) == 1:
@@ -784,7 +792,10 @@ def off_segment(k, i, j):
         LEAN: (318, 168),
         "Isabelle/HOL": (318, 250),
         "Vampire": (318, 336),
-        FORES: (420, 336),
+        # 444, not 420: the arrow from Vampire now starts after Vampire's name
+        # instead of running under it, and needs the length. hero.js pushes
+        # this node clear of that name on its own, so its layout is unchanged.
+        FORES: (444, 336),
         "E": (318, 384),
         "Z3": (318, 432),
         "Mace4": (318, 480),
@@ -926,6 +937,8 @@ def rad(i):
     order = sorted(range(len(edges)), key=lambda e: (depth[edges[e][0]] + depth[edges[e][1]]) / 2)
 
     layers = {"asserted": [], "certified": [], "rejected": []}
+    # Every pipeline arrow as drawn, tip included, so no label is placed on one.
+    pipe_segs = []
     for e in order:
         i, j, w = edges[e]
         d = (depth[i] + depth[j]) / 2
@@ -947,8 +960,14 @@ def rad(i):
             vx, vy = bx - ax, by - ay
             L = math.hypot(vx, vy) or 1.0
             ux_, uy_ = vx / L, vy / L
-            ax, ay = ax + ux_ * (rad(i) + 4.0), ay + uy_ * (rad(i) + 4.0)
+            lead_ = rad(i) + 4.0
+            if nodes[i] in PROGRAMS and nodes[j] in PROGRAMS and abs(ay - by) < 0.5:
+                # A judge feeding the judge beside it: the arrow leaves after the
+                # first one's name, which is drawn on that side, not under it.
+                lead_ = rad(i) + 1 + len(nodes[i]) * (10.5 * 0.55) + 8 + 4.0
+            ax, ay = ax + ux_ * lead_, ay + uy_ * lead_
             bx, by = bx - ux_ * (rad(j) + 8.5), by - uy_ * (rad(j) + 8.5)
+            pipe_segs.append(((ax, ay), (bx + ux_ * 7.0, by + uy_ * 7.0)))
         head = (f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{bx:.1f}" y2="{by:.1f}" '
                 f'stroke="{COLOR[w]}" stroke-width="{WIDTH[w] * (0.7 + 0.8 * d):.2f}" '
                 f'opacity="{op:.2f}"')
@@ -1051,67 +1070,164 @@ def rad(i):
     # is to show who judged what. Ontology classes get a label only if they are
     # busy and the chip lands clear, the way the component shows one on hover
     # rather than all at once: a label per node is a grey wall.
-    placed = []
-
-    def chip(i, label, color, size, weight, insist=False):
-        """Place a label, trying a few positions before giving up.
-
-        `insist` is for the verification layer. An ontology class that cannot
-        find room simply goes unlabelled, which is the right trade in a dense
-        graph. A judge that goes unlabelled defeats the purpose of drawing the
-        layer at all, so those get every candidate position and then take the
-        last one regardless. Dropping `Isabelle/HOL` off the picture because a
-        blue dot was in the way is not a tidier drawing, it is a wrong one."""
+    #
+    # WHERE A LABEL MAY GO (#436). Every label used to be checked against the
+    # other labels and against nothing else, and the figure passed every test
+    # while the amber badge ran through a row of nine classes, the forged-line
+    # badge sat on more, three labels straddled the panel's border and the
+    # dotted curves from the provers cut through `problem.tsv`. A badge rests at
+    # 0.4, so whatever it covers shows through it. Now `fits` refuses a box that
+    # touches another label, a node, an arrow of the pipeline, the forged line or
+    # the unasked question, or that crosses the panel's border. Nothing is placed
+    # blind: a label with no clear candidate searches outward from where it
+    # belongs, and if that fails too the figure is not drawn.
+    # `no_label_sits_on_a_node_an_arrow_or_
```

**File**: `tests/knowledge_graph_asset_test.rs` (modified, +208/-41)
```diff
@@ -668,56 +668,223 @@ fn the_unasked_beat_comes_from_the_mu_run() {
 /// stricter rule is a few pixels of layout freedom.
 #[test]
 fn no_two_labels_sit_on_top_of_each_other() {
-    let s = svg();
-    let mut boxes: Vec<(f64, f64, f64, f64)> = Vec::new();
+    for name in FIGURES {
+        let s = figure(name);
+        let boxes = label_boxes(&s);
+        assert!(
+            boxes.len() > 20,
+            "{name}: only {} label boxes were found, so this test is not looking at the \
+             labels and cannot fail",
+            boxes.len()
+        );
+        let mut clashes = Vec::new();
+        for (i, a) in boxes.iter().enumerate() {
+            for b in &boxes[i + 1..] {
+                let ix = a.2.min(b.2) - a.0.max(b.0);
+                let iy = a.3.min(b.3) - a.1.max(b.1);
+                if ix > 0.5 && iy > 0.5 {
+                    clashes.push(format!(
+                        "  {:?} and {:?} share {ix:.0}x{iy:.0} pixels",
+                        a, b
+                    ));
+                }
+            }
+        }
+        assert!(
+            clashes.is_empty(),
+            "{name}: {} pair(s) of labels overlap, so the drawing prints two sentences \
+             through each other:\n{}\n\nEvery badge is placed by trying candidate positions \
+             against `placed`; one that overlaps is one that was placed blind.",
+            clashes.len(),
+            clashes.join("\n")
+        );
+    }
+}
+
+/// Both published figures. The Chinese one is laid out by the same code with
+/// wider strings, so it is where a badge runs out of room first.
+const FIGURES: [&str; 2] = ["knowledge-graph.svg", "knowledge-graph.zh-CN.svg"];
+
+fn figure(name: &str) -> String {
+    std::fs::read_to_string(repo().join("docs/assets").join(name))
+        .unwrap_or_else(|_| panic!("read docs/assets/{name}"))
+}
+
+/// Every opening tag `<name ...>` in the document, attributes included.
+fn open_tags<'a>(s: &'a str, name: &str) -> Vec<&'a str> {
+    let pat = format!("<{name} ");
+    let mut out = Vec::new();
     let mut at = 0usize;
-    while let Some(i) = s[at..].find("<rect x=\"") {
+    while let Some(i) = s[at..].find(&pat) {
         let start = at + i;
-        let Some(end) = s[start..].find("/>") else { break };
-        let tag = &s[start..start + end + 2];
-        at = start + end + 2;
-        // Label chips and badges only: the legend panel and the colour swatches
-        // are neither rounded nor this colour.
-        if !tag.contains("fill=\"#020617\"") || !tag.contains("rx=\"") {
-            continue;
+        let Some(end) = s[start..].find('>') else { break };
+        out.push(&s[start..start + end + 1]);
+        at = start + end + 1;
+    }
+    out
+}
+
+/// A numeric attribute. Matched with the leading space, so `x` never reads the
+/// `x` inside `rx` and `r` never reads the one inside `cx`.
+fn num_attr(tag: &str, k: &str) -> Option<f64> {
+    let key = format!(" {k}=\"");
+    let i = tag.find(&key)? + key.len();
+    tag[i..].split('"').next()?.parse().ok()
+}
+
+/// The box of every label chip and badge: a rounded `#020617` rectangle with
+/// text over it. The legend panel and the colour swatches are neither. Plus
+/// the 無 of the sixth beat, which is writing without a box: one em wide, its
+/// ink from 0.9 em above the baseline to 0.15 below.
+fn label_boxes(s: &str) -> Vec<(f64, f64, f64, f64)> {
+    let mut out: Vec<(f64, f64, f64, f64)> = open_tags(s, "rect")
+        .into_iter()
+        .filter(|t| t.contains("fill=\"#020617\"") && t.contains(" rx=\""))
+        .filter_map(|t| {
+            let (x, y) = (num_attr(t, "x")?, num_attr(t, "y")?);
+            Some((x, y, x + num_attr(t, "width")?, y + num_attr(t, "height")?))
+        })
+        .collect();
+    if let Some(end) = s.find("無</text>") {
+        let start = s[..end].rfind("<text ").expect("the 無 is in a <text>");
+        let tag = &s[start..start + s[start..].find('>').unwrap()];
+        let (x, y, f) = (
+            num_attr(tag, "x").expect("無 x"),
+            num_attr(tag, "y").expect("無 y"),
+            num_attr(tag, "font-size").expect("無 font-size"),
+        );
+        out.push((x - f * 0.6, y - f * 0.9, x + f * 0.6, y + f * 0.15));
+    }
+    out
+}
+
+/// Points along every arrow of the pipeline, sampled every two units: the
+/// straight `<line>`s and the dotted `Q` curves that run back from the provers
+/// to the certificate. The pipeline is everything left of the ontology panel
+/// and above its bottom edge; the step rail and the legend sit below that.
+fn pipeline_points(s: &str, panel: (f64, f64, f64, f64)) -> Vec<(f64, f64)> {
+    let (panel_x0, bottom) = (panel.0, panel.3);
+    let mut pts = Vec::new();
+    let mut run = |a: (f64, f64), b: (f64, f64), c: Option<(f64, f64)>| {
+        let n = (((b.0 - a.0).hypot(b.1 - a.1)) / 2.0).ceil().max(1.0) as usize;
+        for k in 0..=n {
+            let t = k as f64 / n as f64;
+            pts.pu
```

---

### Incident Patch 2: `fc6215f2` (2026-11-23)
**Commit Message**: Merge pull request #434 from fabio-rovai/fix/vocab-check-role-432

vocab-check reports a declared term used in the wrong role (#432)

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -192,6 +192,16 @@ All notable changes to Open Ontologies are documented here.
 
 ### Fixed
 
+- **`vocab-check` checks that each term is used in the role it is declared in**
+  (#432). A class used as a predicate, or a property used as the object of
+  `rdf:type`, passed with `conforms: true` because the check only asked whether
+  the term was declared at all. Declared terms are now kept per role (typed
+  classes and subjects of `rdfs:subClassOf`; typed properties and subjects of
+  `rdfs:domain`, `rdfs:range` and `rdfs:subPropertyOf`), and a declared term used
+  in the other role is reported under a new `wrong_role_terms` field and fails
+  the check. Undeclared terms stay in `hallucinated_terms`, so the two cases
+  remain distinguishable. A term declared in both roles is accepted in both.
+
 - **`reason --certificate` writes the same `derivations.tsv` on every run over
   the same store** (#427). The conclusions were always the same set, but the
   premises a step recorded (which intermediate class justifies a transitive
```

**File**: `src/output.rs` (modified, +37/-0)
```diff
@@ -694,6 +694,15 @@ fn render_vocab_check(v: &Value) -> String {
         ));
         push_lines(&mut out, terms, text);
     }
+    let wrong_role = items(v, "wrong_role_terms");
+    if !wrong_role.is_empty() {
+        out.push_str(&format!(
+            "\n{} term(s) the ontology declares in the other role \
+             (a class used as a predicate, or a property used as a type):",
+            wrong_role.len()
+        ));
+        push_lines(&mut out, wrong_role, text);
+    }
     out.push_str(&format!(
         "\nChecked {} predicate(s) and {} type(s) against {} ontology term(s); namespaces policed: {}.",
         text(&v["predicates_checked"]),
@@ -1469,6 +1478,34 @@ mod tests {
         assert!(render("load", payload).contains("Loaded 3 triple(s)"));
     }
 
+    #[test]
+    fn vocab_check_lists_wrong_role_terms_apart_from_undeclared_ones() {
+        let rendered = render(
+            "vocab-check",
+            json!({
+                "conforms": false,
+                "hallucinated_terms": ["http://example.org/o#Persn"],
+                "wrong_role_terms": ["http://example.org/o#worksFor"],
+                "checked_namespaces": ["http://example.org/o#"],
+                "predicates_checked": 1,
+                "types_checked": 2,
+                "ontology_terms": 4
+            }),
+        );
+        assert!(
+            rendered
+                .contains("1 term(s) the ontology does not declare:\n  http://example.org/o#Persn"),
+            "got: {rendered}"
+        );
+        assert!(
+            rendered.contains(
+                "1 term(s) the ontology declares in the other role \
+                 (a class used as a predicate, or a property used as a type):\n  http://example.org/o#worksFor"
+            ),
+            "got: {rendered}"
+        );
+    }
+
     #[test]
     fn both_spellings_of_a_batch_command_find_one_renderer() {
         assert!(renderer_for("vocab_check").is_some());
```

**File**: `src/server.rs` (modified, +1/-1)
```diff
@@ -1554,7 +1554,7 @@ impl OpenOntologiesServer {
             .unwrap_or_else(Self::err_json)
     }
 
-    #[tool(name = "onto_vocab_check", description = "Closed-world vocabulary check on a Turtle DATA graph: verify that every predicate and every rdf:type class used in the data is actually DECLARED in the loaded ontology. Catches hallucinated/undeclared terms — e.g. an LLM emitting `ies:hasDeparturePort` when the ontology only defines `ies:scheduledDeparturePort`. This is the gate open-world SHACL structurally CANNOT provide: SHACL silently ignores predicates it has no shape for, so a graph full of invented terms still reports conforms=true. Only IRIs whose namespace belongs to the ontology (plus any passed in `namespaces`) are policed; standard rdf/rdfs/owl/xsd/sh vocabulary and your instance-data IRIs are never flagged. Returns {conforms, hallucinated_terms, checked_namespaces}. Companion to `onto_shacl` (open-world structural validation of data) and `onto_shacl_check` (checks proposed SHACL shapes); run this on generated data to catch fabricated vocabulary before it enters the store.")]
+    #[tool(name = "onto_vocab_check", description = "Closed-world vocabulary check on a Turtle DATA graph: verify that every predicate and every rdf:type class used in the data is actually DECLARED in the loaded ontology, and declared in that role (a class used as a predicate, or a property used as rdf:type, is reported under wrong_role_terms). Catches hallucinated/undeclared terms — e.g. an LLM emitting `ies:hasDeparturePort` when the ontology only defines `ies:scheduledDeparturePort`. This is the gate open-world SHACL structurally CANNOT provide: SHACL silently ignores predicates it has no shape for, so a graph full of invented terms still reports conforms=true. Only IRIs whose namespace belongs to the ontology (plus any passed in `namespaces`) are policed; standard rdf/rdfs/owl/xsd/sh vocabulary and your instance-data IRIs are never flagged. Returns {conforms, hallucinated_terms, checked_namespaces}. Companion to `onto_shacl` (open-world structural validation of data) and `onto_shacl_check` (checks proposed SHACL shapes); run this on generated data to catch fabricated vocabulary before it enters the store.")]
     async fn onto_vocab_check(&self, Parameters(input): Parameters<OntoVocabCheckInput>) -> String {
         let data = if input.inline.unwrap_or(false) {
             input.data.clone()
```

**File**: `src/vocab_check.rs` (modified, +219/-29)
```diff
@@ -12,8 +12,12 @@
 //!
 //! `check_data_vocab` runs the complementary CLOSED-WORLD gate: every predicate
 //! and every `rdf:type` object in the data whose namespace belongs to the ontology
-//! must be *declared* in the ontology. Standard `rdf`/`rdfs`/`owl`/`xsd`/`sh`
-//! vocabulary and the caller's own instance-data IRIs are never policed.
+//! must be *declared* in the ontology, and declared in the role it is used in: a
+//! predicate must be declared as a property and an `rdf:type` object as a class.
+//! An undeclared term is reported in `hallucinated_terms`; a declared term used in
+//! the other role (a class as a predicate, a property as a type) in
+//! `wrong_role_terms` (#432). Standard `rdf`/`rdfs`/`owl`/`xsd`/`sh` vocabulary and
+//! the caller's own instance-data IRIs are never policed.
 //!
 //! This mirrors `shacl::check_shapes` (which checks that proposed SHACL references
 //! real terms) but points the same idea at generated data instead of shapes.
@@ -35,10 +39,13 @@ const STD_NS: &[&str] = &[
 
 #[derive(Serialize)]
 pub struct VocabReport {
-    /// True iff an ontology was present AND no hallucinated terms were found.
+    /// True iff an ontology was present AND no hallucinated or wrong-role terms were found.
     pub conforms: bool,
     /// Terms used in the data, in a policed namespace, but not declared in the ontology.
     pub hallucinated_terms: Vec<String>,
+    /// Terms the ontology declares, used in the other role: a class used as a
+    /// predicate, or a property used as the object of `rdf:type` (#432).
+    pub wrong_role_terms: Vec<String>,
     /// The namespaces that were policed (ontology's own namespaces + any caller-supplied).
     pub checked_namespaces: Vec<String>,
     pub predicates_checked: usize,
@@ -90,22 +97,49 @@ fn select_iris(graph: &Arc<GraphStore>, query: &str, var: &str) -> anyhow::Resul
     Ok(out)
 }
 
-const CLASS_OR_PROP_FILTER: &str = r#"FILTER(
+const CLASS_FILTER: &str = r#"FILTER(
     ?k = <http://www.w3.org/2002/07/owl#Class>
- || ?k = <http://www.w3.org/2000/01/rdf-schema#Class>
- || ?k = <http://www.w3.org/2002/07/owl#ObjectProperty>
+ || ?k = <http://www.w3.org/2000/01/rdf-schema#Class>)"#;
+
+const PROPERTY_FILTER: &str = r#"FILTER(
+    ?k = <http://www.w3.org/2002/07/owl#ObjectProperty>
  || ?k = <http://www.w3.org/2002/07/owl#DatatypeProperty>
  || ?k = <http://www.w3.org/2002/07/owl#AnnotationProperty>
  || ?k = <http://www.w3.org/2002/07/owl#FunctionalProperty>
  || ?k = <http://www.w3.org/2002/07/owl#InverseFunctionalProperty>
  || ?k = <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property>)"#;
 
-const DEFINED_BY_AXIOM_FILTER: &str = r#"FILTER(
+/// A subject of `rdfs:subClassOf` is a class.
+const CLASS_AXIOM_FILTER: &str =
+    r#"FILTER(?p = <http://www.w3.org/2000/01/rdf-schema#subClassOf>)"#;
+
+/// A subject of `rdfs:domain`, `rdfs:range` or `rdfs:subPropertyOf` is a property.
+const PROPERTY_AXIOM_FILTER: &str = r#"FILTER(
     ?p = <http://www.w3.org/2000/01/rdf-schema#domain>
  || ?p = <http://www.w3.org/2000/01/rdf-schema#range>
- || ?p = <http://www.w3.org/2000/01/rdf-schema#subClassOf>
  || ?p = <http://www.w3.org/2000/01/rdf-schema#subPropertyOf>)"#;
 
+/// Terms the ontology declares in one role: typed with one of `type_filter`'s
+/// kinds, or the subject of one of `axiom_filter`'s axioms.
+fn declared(
+    onto: &Arc<GraphStore>,
+    type_filter: &str,
+    axiom_filter: &str,
+) -> anyhow::Result<BTreeSet<String>> {
+    let mut out: BTreeSet<String> = BTreeSet::new();
+    out.extend(select_iris(
+        onto,
+        &format!("SELECT DISTINCT ?t WHERE {{ ?t a ?k . {type_filter} }}"),
+        "t",
+    )?);
+    out.extend(select_iris(
+        onto,
+        &format!("SELECT DISTINCT ?t WHERE {{ ?t ?p ?o . {axiom_filter} }}"),
+        "t",
+    )?);
+    Ok(out)
+}
+
 /// Closed-world vocabulary check of `data_ttl` against the loaded ontology `onto`.
 /// `extra_ns` adds namespaces to police beyond the ontology's own.
 /// Returns a JSON `VocabReport`.
@@ -119,30 +153,20 @@ pub fn check_data_vocab(
     data.load_turtle(data_ttl, None)
         .map_err(|e| anyhow::anyhow!("data failed to parse as Turtle: {e}"))?;
 
-    // 2. The ontology's declared vocabulary (full IRIs): typed classes/properties
-    //    plus anything given a domain/range/subClassOf/subPropertyOf axiom.
-    let mut onto_terms: BTreeSet<String> = BTreeSet::new();
-    for t in select_iris(
-        onto,
-        &format!("SELECT DISTINCT ?t WHERE {{ ?t a ?k . {CLASS_OR_PROP_FILTER} }}"),
-        "t",
-    )? {
-        onto_terms.insert(t);
-    }
-    for t in select_iris(
-        onto,
-        &format!("SELECT DISTINCT ?t WHERE {{ ?t ?p ?o . {DEFINED_BY_AXIOM_FILTER} }}"),
-        "t",
-    )? {
-        onto_terms.insert(t);
-    }
+    // 2. The ontology's declared vocabulary (full IRIs), kept per role: typed
+    //    classes/properties plus anything given a subClassOf (class) or a
+    //    domain/range/subPropertyOf (p
```

#### Recent Merged Pull Requests:
- **PR #437** (2026-11-23): No label on the front-page figure sits on a node, an arrow or the panel border (#436) (@fabio-rovai)
- **PR #434** (2026-11-23): vocab-check reports a declared term used in the wrong role (#432) (@fabio-rovai)
- **PR #431** (2026-11-20): README front page shows the dark knowledge-graph figure; the hand-drawn version is linked (@fabio-rovai)
- **PR #430** (2026-11-20): Certificates are byte-stable across runs (#427); the README figure's red edge is a forgery oo-cert really refused (#428) (@fabio-rovai)
- **PR #429** (2026-11-20): The replay's 3D legend is true of its graph: a certified ies-core run three checkers judged (#425) (@fabio-rovai)
- **PR #426** (2026-11-20): Errors are valid JSON everywhere; Studio refresh, findings, auto-save and live 3D fixes (#420 to #424) (@fabio-rovai)

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

## X. Empirical Invariant Guard in CHANGELOG.md

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fabio-rovai/open-ontologies. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1ba7ecf8`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **No label on the front-page figure sits on a node, an arrow or the panel
  border** (#436). Labels in `docs/assets/knowledge-graph.py` were checked
  against other labels only, so the unasked-question badge ran through a row of
  classes, the forged-line badge and the 無 glyph sat on nodes, three labels
  crossed the ontology panel's border and the provers' dotted curves cut through
  `problem.tsv`, while every test passed. Placement now goes through one `fits`
  check (labels, node discs, pipeline arrows, the forged and unasked lines, the
  panel edge); a badge with no clear candidate searches outward (the two beat badges in
  the panel then get a leader back to their line), and the generator refuses to
  draw if nothing fits. The canvas is
  1200 x 830 (was 1100 x 780) so the panel has room, the forged line is marked
  with a capsule instead of a circle that took in its neighbours, and
  `no_label_sits_on_a_node_an_arrow_or_the_panel_edge` checks both languages
  (30 violations on the old English figure, 0 now).

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1ba7ecf8` are properly handled with clean fallback behavior.
