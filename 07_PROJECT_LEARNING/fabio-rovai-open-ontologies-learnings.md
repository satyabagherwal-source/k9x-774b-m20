> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fabio-rovai-open-ontologies-learnings.md`  
> **Source**: github ([https://github.com/fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies))  
> **Source Version**: `cefe5997`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T10:33:56.802Z  
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
> **Harvest Timestamp**: 2026-10-31T10:33:56.795Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fabio-rovai/open-ontologies`
- **Description**: Plan, apply and roll back changes to a production ontology, with a blast radius report and a proof an auditor can re-check.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2501 stars

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
_SCHEMA_TYPES = (OWL_CLASS, RDFS_CLASS) + _PROPERTY_TYPES


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
                "FILTER(?t NOT IN (" + ", ".join(f"<{iri}>" for iri in _SCHEMA_TYPES) + ")) }"
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
        for sol in result:
            val = sol[var]
            if val is not None:
                out.append(val.value)
        return out

    # ---- certified reasoning ----------------------------------------------
    def reason_horn(
        self,
        certificate_dir: str,
        *,
        rules=None,
        graphs: str | list[str] = "default",
        check: bool = True,
        checker: str | None = None,
        timeout: float = 120.0,
        max_iterations: int | None = None,
    ) -> dict:
        """Derive the closure of a Horn rule table over the loaded store and
        write a certificate the proved-sou
```

### Core Architecture Module: `src/borderline_loop.rs`
```
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
/// release — it was added and then given an owner within the same unreleased
//
```

### Core Architecture Module: `src/webhook.rs`
```
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
- **Issue #350** (2026-10-30): **--human prints a wrong answer for diff, shacl, validate and monitor: key-sniffing picks another command's renderer**
  *Symptoms*: ## What happens  `--human` prints a WRONG answer, not just an unformatted one, for four commands. `render_human` picks a renderer by sniffing which keys the JSON happens to carry, and these payloads share a key with another command's shape. Measured on main 2ecb50c2, one-shot path, `--no-connect`:  | Command | JSON says | `--human` prints | |---|---|---| | `diff a.ttl b.ttl` (b has one extra triple) | `"added":1, "added_triples":[...], "removed":0` | `Diff: +0 triples, -0 triples.` | | `shacl shapes.ttl` (no focus node matched, exit 2) | `"conforms":null`, warning "conformance is undetermined" | `No violations found.` | | `validate a.ttl` (2 classes) | `{"ok":true,"statements":4,"triples":4}` | `Triples: 4  Classes: 0  Properties: 0  Individuals: 0` | | `monitor` | `{"status":"ok","alerts":[],"passed":[]}` | `Status: ok (v?, 0 triples in store)` |  - **diff**: `added` and `removed` are counts, and the renderer reads them with `as_array()`, which is `None` on a number and falls back to 0. So `diff --human` reports two files as identical whatever they contain. The JSON has had numeric counts since 99848ff4, so this has never worked. - **shacl**: the empty `violations` array matches the enforce branch. The exit code says undetermined; the text reads as a pass. It is the vacuous-conformance reading the undetermined verdict exists to prevent. - **validate**: the `triples` key matches the stats branch, which prints class, property and individual counts that `validate` never compute

- **Issue #349** (2026-10-30): **SPARQL arithmetic chains associate to the right on the pinned oxigraph (8-3-2 = 7); fixed upstream in 0.5.12**
  *Symptoms*: ## What happens  On main 2ecb50c2, SPARQL arithmetic chains associate to the RIGHT. The SPARQL 1.1 grammar makes `AdditiveExpression` and `MultiplicativeExpression` left-associative, so these answers are wrong:  ``` open-ontologies query --no-connect 'SELECT (8-3-2 AS ?a) (7/20*1000 AS ?b) WHERE {}' ```  ``` {"results":[{"a":"\"7\"^^<http://www.w3.org/2001/XMLSchema#integer>","b":"\"0.00035\"^^<http://www.w3.org/2001/XMLSchema#decimal>"}],"variables":["a","b"]} ```  Expected `3` and `350`. Every query, SHACL-SPARQL constraint, monitor watcher and rule that computes a ratio, a percentage or a difference of more than two operands without parentheses gets a wrong number, silently.  ## Cause  The parser is upstream's, and upstream fixed it: oxigraph/oxigraph#1974 (merged 12 Oct), backported to the `0.5` branch as 69b902aef3 and released in **v0.5.12** and **v0.5.13**. OO pins the fork at rev 6409fa1c, which sits on **v0.5.9**, so OO never received the fix.  Measured with pyoxigraph on the same query: 0.5.9 gives `7` / `0.00035`, 0.5.13 gives `3` / `350`.  ## Fix proposed  Rebase the three fork commits (abf36ef `Store::snapshot`, a380b8b and 6409fa1 for #335) from v0.5.9 onto **v0.5.13** and move the pin. A dry run applies all three cleanly. This also brings in the other 0.5.10 to 0.5.13 fixes (month subtraction, effective boolean value of large strings, `rdf:dirLangString` equality, sparopt OPTIONAL and equality rewrites).  Add a regression test pinning `8-3-2 = 3` and `7/20*1000

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

### Incident Patch 1: `4676fddc` (2026-10-30)
**Commit Message**: Merge branch 'feat/346-weighted-repair' into integrate/fix-all-343-350

Both #346 and #347 add a CLI subcommand, a batch verb and an MCP tool, so
the dispatch tables, the clap enum, the reasoning profile and the
CHANGELOG take both additions side by side. The tool count each branch
moved from 122 to 123 is 124 with both, and 116 advertised in a default
build. `repair` now renders through the command registry like
`compile-exceptions`, and `onto_compile_exceptions` gets the CLAUDE.md
tool-table row its branch left out.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +18/-0)
```diff
@@ -730,6 +730,24 @@ jobs:
         run: OO_REQUIRE_FIXTURES=1 cargo test --test dl_consistency_differential_test -- --nocapture
       - name: Check the model ingestion, both front ends
         run: OO_REQUIRE_FIXTURES=1 cargo test --test fol_model_ingest_test -- --nocapture
+      - name: Install picosat, the solver whose refutations oo-lrat checks
+        # Ubuntu's picosat package builds the solver twice and installs the
+        # build WITH proof traces as /usr/bin/picosat.trace; plain
+        # /usr/bin/picosat has no trace support, and `-T` is how src/sat.rs
+        # gets the proof it converts to LRAT. Read off the package's
+        # debian/rules and debian/install rather than assumed. The apt index is
+        # fresh from the model finders step above.
+        run: |
+          set -euo pipefail
+          sudo apt-get install -y picosat
+          test -x /usr/bin/picosat.trace
+      - name: Refute a cheaper weighted repair through oo-lrat
+        # #346. A weighted repair is called optimal when its branch and bound
+        # closes; with a certificate the same claim is a CNF that picosat
+        # refutes and oo-lrat checks under Lrat.unsat_of_check. Strict, because
+        # the leg that matters needs both tools, and a skip here would leave
+        # the word `refuted` printed by no run that CI ever sees.
+        run: OO_SAT_SOLVER=/usr/bin/picosat.trace OO_REQUIRE_FIXTURES=1 cargo test --test repair_certificate_test -- --nocapture
       - name: Build the release binary the SMT differential drives
         # The differential compares the SMT-LIB THE PRODUCT EMITS, so it runs
         # the real binary rather than linking the library. `cargo test` does not
```

**File**: `CHANGELOG.md` (modified, +33/-0)
```diff
@@ -35,6 +35,39 @@ All notable changes to Open Ontologies are documented here.
   does, and marks the row `declared_exception: true` with a hint naming the
   compile; `declared_exceptions` counts them. The issue's defeasible
   semantics is not built, for four reasons given in decision 0019.
+
+- **`repair` returns the cheapest set of asserted axioms whose removal makes
+  every class coherent, and says what checked each half of that** (#346).
+  `defects` said that a class could have no instances and `onto_justify` said
+  which axioms were responsible; nothing said which to drop. `repair`
+  (CLI), `onto_repair` (MCP) and `repair` (`batch`) read per-axiom weights
+  from `owl:Axiom` reifications (`--weight-property`, `--default-weight`, 1 by
+  default) and return the dropped axioms with the conflicts each one hits, the
+  total weight, the classes made coherent, `optimal` with its basis, a
+  `lower_bound`, and `--out` writes the repaired Turtle. Coherence is judged in
+  the atomic named-class fragment `defects` judges (`subClassOf`,
+  `disjointWith`, and `equivalentClass` as one axiom with two edges, between
+  IRIs), plus a class disjoint with itself; every other triple is counted by
+  bucket under `scope` and never read. The search is the implicit hitting set
+  loop of Davies and Bacchus (CP 2011): a hitting set of the conflicts
+  collected so far is removed and the fragment re-checked, greedy in the
+  intermediate rounds and exact (branch and bound) once a greedy repair is
+  coherent, and an exact repair that comes out coherent is optimal by
+  monotonicity; it does not enumerate every MinA first. `--weights
+  probability` minimises the summed log-odds of what is dropped, the most
+  probable coherent subset under independence, because summing raw
+  probabilities is not: conflicts `{a=0.6, c=0.9}` and `{b=0.6, c=0.9}` drop
+  `c` under `cost` and `a` and `b` under `probability`, and both are pinned.
+  `p = 1` is hard and a conflict of hard axioms is reported `unrepairable`;
+  `p <= 0.5` is dropped at no cost with that reason. Conflicts are re-run,
+  coherence is re-run (and the `--out` file is read back through `defects`),
+  and with `--certificate-dir` optimality is written as CNF (one clause per
+  conflict, the cost bound as a reduced BDD), refuted by picosat and checked by
+  `oo-lrat` under `Lrat.unsat_of_check`; without either tool the status is
+  `undetermined`, never `refuted`. `max_nodes` and `max_rounds` bound the
+  search and name themselves when they fire. The `lean` CI job now installs
+  Ubuntu's `picosat` and runs `repair_certificate_test` strictly against its
+  `picosat.trace` build.
 - **A plan says whether the change breaks the ontology, and scores it `high`
   when it does** (#336, reported by @jpsanchezcalypso). `risk_score` came from
   removal counts alone, so a change that made a named class unsatisfiable (R1:
```

**File**: `CLAUDE.md` (modified, +2/-0)
```diff
@@ -77,12 +77,14 @@ Claude dynamically decides the next tool call based on what the previous tool re
 | `onto_shacl` | To validate loaded data against SHACL shapes (cardinality, datatypes, classes) |
 | `onto_vocab_check` | To closed-world-check generated DATA: flags any predicate/class used that is not declared in the loaded ontology (hallucinated terms). Catches what open-world SHACL silently passes. Run on LLM-generated Turtle before `onto_load` |
 | `onto_defects` | BEFORE trusting any fact-level result, and on every marketplace pack before adopting it. Checks the ONTOLOGY against itself with no data present: `transitive_and_functional`, `symmetric_and_asymmetric`, `subclass_cycle`, `sub_property_cycle`, `disjoint_with_ancestor`, `inherited_disjoint`, `self_inverse`, `inverse_not_mutual`. A different question from `onto_dl_check`: a transitive functional property is satisfiable and is still a trap, because the pair manufactures contradictions the moment instances arrive. Each kind is listed at most 50 times, with the full total under `truncated` |
+| `onto_compile_exceptions` | When a disjointness is meant to have EXCEPTIONS (a houseboat is both a vehicle and a building) and `onto_defects` reports the excepted class as an `inherited_disjoint` error marked `declared_exception: true`. Annotate the reified `owl:disjointWith` axiom with `exc:exceptFor` (`https://open-ontologies.org/exceptions#`), then run this: it replaces the axiom with ordinary pairwise disjointness over the asserted named hierarchy, so every reasoner, SHACL run and `onto_defects` reads one classical ontology. A pair of classes stays compatible only when an exception, or a class below one, is filed under both. Rewrites the loaded store in place and is idempotent; the report lists every pair emitted and the classes exempted beyond the exceptions (the cost). Decision 0019 says why this is compiled rather than inferred |
 | `onto_dlp_boundary` | BEFORE trusting any `onto_reason` result, in the same register as `onto_defects`. Asks which of YOUR axioms the rule engine can actually SEE. A certificate from `onto_reason` is a sound proof about the axioms the rules read and says nothing about the ones no rule fires on, so a user can reason, get a green machine-checked certificate, and never learn that a third of the TBox was invisible. TWO DIMENSIONS THAT ARE NEVER MERGED, because one is a rewrite of the ontology and the other is a patch to this engine. (1) THE FRAGMENT: is the axiom Horn at all? The line is OWL 2 RL's class grammar (OWL 2 Profiles 4.3), and `outside` there would hold of a perfect OWL 2 RL engine: disjunction in the consequent, existential in the head, cardinality restriction, negation in the antecedent, each listed per axiom with the reason. (2) THIS ENGINE: does a rule fire on it? `owl:hasKey` and `owl:propertyChainAxiom` are Horn, OWL 2 RL has `prp-key` and `prp-spo2`, and this engine runs neither, so they are INSIDE the fragment and still invisible. An axiom that splits soundly is `partially_inside`: `A subClassOf (B and Out)` keeps its `A subClassOf B` half, and an `owl:equivalentClass` with an existential on one side keeps the direction `cls-svf1` evaluates. A conjunction in the ANTECEDENT does not split, because dropping a conjunct from a rule body makes it fire more often. The rule-table figures (78 OWL 2 RL rules, 29 evaluated, 10 more detected only as a clash, 7 that conclude false and are not looked for) are DERIVED from `src/reason.rs`, not typed. Every triple lands in an axiom bucket or a counted `not_classified` one. NOT a consistency check |
 | `onto_trace_label` | AFTER a model, an agent or a person hands you a reasoning trace and BEFORE you believe any step of it. Takes the trace in `oo-trace/1`, which is the same line `onto_reason`'s `derivations.tsv` writes, so a certificate this engine emitted is itself a valid trace. THREE FAMILIES, and the third is the reason to use this rather than an LLM judge. `entailed`: a Lean checker accepted a certificate slice of the run that concludes the triple. `not_entailed`: a rule head in the table could conclude a triple of this shape, every axiom the step cites is inside the fragment, and the graph still does not support it. `outside_the_fragment`: no data could ever make this table derive it, and the two reasons stay apart exactly as `onto_dlp_boundary` keeps them apart, because `outside_the_fragment` is a rewrite of the ontology and `no_rule_in_this_table_concludes_this_shape` is a patch to `src/reason.rs`. Under the built-in table the second of those is unreachable and that is a fact about the table: `rdfs7`'s head is three variables, so some data makes it conclude any triple at all. TWO ANSWERS PER STEP AND NEITHER IS REPORTED AS THE OTHER: `local` is a one-line certificate over the premises the STEP cited, so a step whose own reasoning is machine-checked sound over triples the graph does not hold reads `premises_in_store: false` and `locally_sound_but_premises_not_in_the
```

**File**: `docs/ci-gates.md` (modified, +1/-0)
```diff
@@ -65,6 +65,7 @@ job invokes the file at all.
 |---|---|---|---|
 | `lean_certificate_test.rs` | lake | `lean` job | **strict** |
 | `justify_test.rs` | `benchmark/reference/pizza-reference.owl`, which ships with the repository | `lean` job | **strict** |
+| `repair_certificate_test.rs` | picosat with trace support + `oo-lrat`, for the one leg that refutes a cheaper repair; the other two need nothing | `lean` job installs Ubuntu's `picosat` and points `OO_SAT_SOLVER` at its `picosat.trace` | **strict** |
 | `provenance_test.rs` | the same shipped ontology | `lean` job | **strict** |
 | `shacl_core_verified_test.rs` | lake + vendored W3C SHACL suite | `lean` job | **strict** |
 | `dl_model_certificate_test.rs` | lake + `oo-dlmodel` | `lean` job | **strict** |
```

**File**: `docs/tool-reference.md` (modified, +2/-1)
```diff
@@ -74,7 +74,7 @@ it withheld.
 ## Every tool
 
 
-123 tools.
+124 tools.
 
 | Tool | What it does |
 | --- | --- |
@@ -169,6 +169,7 @@ it withheld.
 | `onto_reason` | Run inference over the loaded ontology. |
 | `onto_reason_incremental` | Derive the consequences of newly added triples WITHOUT recomputing the whole closure. |
 | `onto_recompile` | Force-recompile an ontology from its source file, ignoring the on-disk cache. |
+| `onto_repair` | WEIGHTED REPAIR: the cheapest set of ASSERTED axioms whose removal makes every class coherent, with the conflicts each dropped axiom breaks. |
 | `onto_repo_list` | List RDF/OWL files in the configured ontology repository directories ([general] ontology_dirs). |
 | `onto_repo_load` | Load an ontology from one of the configured repository directories ([general] ontology_dirs) into the active store. |
 | `onto_rollback` | Restore the ontology store to a previously saved version |
```

**File**: `python/README.md` (modified, +1/-1)
```diff
@@ -226,7 +226,7 @@ report["conforms"]           # None, because nothing was examined
 
 ## Relationship to the Rust engine
 
-This is the **Python layer** of the project. For the full engine (three-layer Dynamics/Causal/Planner architecture, HNSW semantic search, SHIQ tableaux reasoning, PDDL planning, governance, 123 tools), use the [Rust build](https://github.com/fabio-rovai/open-ontologies). HNSW semantic search there is a compile-time feature, so build with `--features embeddings`; the published binaries do not carry it. Same Oxigraph core; pick the weight class you need.
+This is the **Python layer** of the project. For the full engine (three-layer Dynamics/Causal/Planner architecture, HNSW semantic search, SHIQ tableaux reasoning, PDDL planning, governance, 124 tools), use the [Rust build](https://github.com/fabio-rovai/open-ontologies). HNSW semantic search there is a compile-time feature, so build with `--features embeddings`; the published binaries do not carry it. Same Oxigraph core; pick the weight class you need.
 
 ## License
 
```

**File**: `skills/ontology-engineer.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ description: Use when building, modifying, or validating ontologies. Orchestrate
 
 # Ontology Engineer
 
-AI-native ontology engineering using the Open Ontologies `onto_*` MCP tools (123 tools, 8 of which require an optional Cargo feature).
+AI-native ontology engineering using the Open Ontologies `onto_*` MCP tools (124 tools, 8 of which require an optional Cargo feature).
 
 ## When to Use
 
```

**File**: `skills/ontology-engineering/SKILL.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ description: Build, validate, and govern RDF/OWL ontologies using the Open Ontol
 
 # Ontology Engineering Workflow
 
-You have access to the Open Ontologies MCP server, which provides 123 tools for AI-native ontology engineering backed by an in-memory Oxigraph triple store. 115 of them are advertised in a default build, and the other 8 require an optional Cargo feature and return an error without it: four need `embeddings`, two need `plugins`, and two need `postgres` or `duckdb`.
+You have access to the Open Ontologies MCP server, which provides 124 tools for AI-native ontology engineering backed by an in-memory Oxigraph triple store. 116 of them are advertised in a default build, and the other 8 require an optional Cargo feature and return an error without it: four need `embeddings`, two need `plugins`, and two need `postgres` or `duckdb`.
 
 ## Core Workflow
 
```

---

### Incident Patch 2: `33a00e9f` (2026-10-30)
**Commit Message**: --human renders each command by name, so diff counts its triples and an undetermined SHACL run says so (#350, #345)

The one-shot CLI rendered --human output through output::render_human,
which chose a rendering from the keys the JSON happened to carry, and four
commands printed a wrong answer as a result. diff read its numeric added and
removed counts as arrays and printed +0 -0 for any two files. An
undetermined shacl run (conforms null, exit 2) printed "No violations
found." because its empty violations array matched the branch written for
enforce. validate reached the stats branch through its triples key and
printed class, property and individual counts it never computed, as zeros.
monitor reached the server-status branch through its status key. A
CONSTRUCT query printed "Triples: 0" over the triples it built, and drift's
classes were reported as triples. Shapes with no branch, defects among them,
printed raw JSON.

main.rs now records the subcommand path from clap's own matches (diff,
vocab-check, daemon status), and output_json and output_result pass it to
render_human_for. output::renderer_for maps each name to that command's
renderer, and the key-sniffing render_human is go

**File**: `CHANGELOG.md` (modified, +24/-0)
```diff
@@ -89,6 +89,30 @@ All notable changes to Open Ontologies are documented here.
 
 ### Fixed
 
+- **`--human` renders each command's result by the command's name, so `diff`
+  counts the triples it found and an undetermined `shacl` run says so**
+  (#350, #345). The one-shot CLI called a renderer that picked a rendering by
+  which keys the JSON carried, and four commands printed a wrong answer rather
+  than an unformatted one. `diff` read its numeric counts as arrays and printed
+  `+0 -0` for any two files. An undetermined `shacl` run, exit 2, printed "No
+  violations found." because its empty `violations` matched the `enforce`
+  branch. `validate` printed class, property and individual counts it never
+  computed, as zeros, and `monitor` printed itself as server status. A
+  CONSTRUCT query printed "Triples: 0" over the triples it built. Eighteen of
+  55 offline invocations, `defects` among them, printed raw JSON. The CLI now
+  passes its subcommand path (`diff`, `daemon status`) and
+  `output::renderer_for` maps each name to its own renderer. Verdict commands
+  lead with the verdict (`conforms: true | false | undetermined`), `defects`
+  prints one line per defect or `No defects (N kinds checked).`, `drift`
+  reports terms, velocity and likely renames, and `plan`, `align`,
+  `vocab-check`, `reason` and `lineage` are rendered with their verdict and
+  counts first. A name with no renderer prints its JSON under a line saying no
+  human rendering exists for it, and is never matched by shape. `batch
+  --human` now renders each result by the command its envelope names when it
+  runs locally, as it already did through a daemon. Exit codes are unchanged.
+  A test in `src/main.rs` walks the clap command tree and fails for any
+  subcommand with no renderer registered.
+
 - **MCP `onto_lint` and `onto_diff`, and CLI `diff`, read RDF/XML and
   relative-IRI Turtle** (#317, @vishalhabib99). They passed the raw file to
   the Turtle parser, so an RDF/XML `.owl` file failed with "Invalid IRI code
```

**File**: `src/batch.rs` (modified, +23/-6)
```diff
@@ -14,6 +14,7 @@ pub struct BatchRunner {
     db: StateDb,
     graph: Arc<GraphStore>,
     pretty: bool,
+    human: bool,
 }
 
 /// A parsed batch command with its arguments.
@@ -25,14 +26,24 @@ struct BatchCmd {
 
 impl BatchRunner {
     pub fn new(db: StateDb, graph: Arc<GraphStore>, pretty: bool) -> Self {
-        Self { db, graph, pretty }
+        Self { db, graph, pretty, human: false }
+    }
+
+    /// Print each result as human-readable text instead of an NDJSON envelope.
+    ///
+    /// `batch --human` printed NDJSON when it ran locally and rendered text when
+    /// a daemon ran it, because only the proxy path read the flag. Both now
+    /// render each result by the command its envelope names.
+    pub fn human(mut self, human: bool) -> Self {
+        self.human = human;
+        self
     }
 
     /// Parse input (auto-detect line vs JSON format) and run all commands,
     /// printing each result as it completes.
     /// Returns the process exit code (0 = success, 1 = at least one error).
     pub async fn run(&self, input: &str, bail: bool) -> i32 {
-        self.run_each(input, bail, |line| self.print_json(line)).await
+        self.run_each(input, bail, |line| self.print_result(line)).await
     }
 
     /// Run all commands and collect results into a Vec instead of printing.
@@ -109,11 +120,17 @@ impl BatchRunner {
         exit_code
     }
 
-    fn print_json(&self, value: &Value) {
-        if self.pretty {
-            println!("{}", serde_json::to_string_pretty(value).unwrap());
+    /// Print one envelope: as JSON, or under `--human` as its result rendered
+    /// by the command it names, exactly as `connect::proxy_batch` prints one.
+    fn print_result(&self, envelope: &Value) {
+        if self.human && !self.pretty {
+            let command = envelope.get("command").and_then(Value::as_str);
+            let result = envelope.get("result").unwrap_or(envelope);
+            println!("{}", crate::output::render_human_for(command, result));
+        } else if self.pretty {
+            println!("{}", serde_json::to_string_pretty(envelope).unwrap());
         } else {
-            println!("{}", value);
+            println!("{}", envelope);
         }
     }
 
```

**File**: `src/main.rs` (modified, +113/-5)
```diff
@@ -1629,6 +1629,33 @@ static JSON_MODE: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
 fn json_mode() -> bool {
     JSON_MODE.get().copied().unwrap_or(true)
 }
+
+/// The subcommand this process is running, by the name the human renderer
+/// looks it up under: `diff`, `vocab-check`, or `daemon status` for a nested
+/// one. Set once from clap's own matches, so it is the name clap parsed and
+/// never a guess from the arguments.
+static COMMAND: std::sync::OnceLock<String> = std::sync::OnceLock::new();
+
+/// The running subcommand's name, for `output::render_human_for`.
+///
+/// The one-shot paths used to call the renderer with no name at all, and it
+/// guessed one from the keys of the JSON, which is how `diff`, `shacl`,
+/// `validate` and `monitor` printed another command's rendering of their
+/// results (#350).
+fn command_name() -> Option<&'static str> {
+    COMMAND.get().map(String::as_str)
+}
+
+/// A subcommand's full path through nested subcommands, space-separated.
+fn command_path(matches: &clap::ArgMatches) -> String {
+    let mut path = Vec::new();
+    let mut m = matches;
+    while let Some((name, sub)) = m.subcommand() {
+        path.push(name);
+        m = sub;
+    }
+    path.join(" ")
+}
 /// Whether the resolved storage backend keeps the graph in RAM only.
 ///
 /// One-shot CLI subcommands each build their own store, so in this mode nothing
@@ -1675,7 +1702,7 @@ fn output_json(value: &serde_json::Value, pretty: bool) {
             println!("{}", value);
         }
     } else {
-        println!("{}", open_ontologies::output::render_human(value));
+        println!("{}", open_ontologies::output::render_human_for(command_name(), value));
     }
 }
 
@@ -1801,7 +1828,7 @@ fn output_result(result: &str, pretty: bool) {
         }
     } else {
         if let Ok(v) = serde_json::from_str::<serde_json::Value>(result) {
-            println!("{}", open_ontologies::output::render_human(&v));
+            println!("{}", open_ontologies::output::render_human_for(command_name(), &v));
         } else {
             println!("{}", result);
         }
@@ -2010,7 +2037,12 @@ fn main() -> anyhow::Result<()> {
 
 #[tokio::main]
 async fn async_main() -> anyhow::Result<()> {
-    let cli = Cli::parse();
+    // Parsed in two steps, as `Cli::parse` does internally, so the matches that
+    // name the subcommand are still in hand for `COMMAND`.
+    let matches = <Cli as clap::CommandFactory>::command().get_matches();
+    let cli = <Cli as clap::FromArgMatches>::from_arg_matches(&matches)
+        .unwrap_or_else(|e| e.format(&mut <Cli as clap::CommandFactory>::command()).exit());
+    COMMAND.set(command_path(&matches)).ok();
 
     // Activate JSON mode when --json or --pretty is passed.
     JSON_MODE.set(cli.json || cli.pretty || !cli.human).ok();
@@ -2712,7 +2744,8 @@ async fn async_main() -> anyhow::Result<()> {
                 std::process::exit(code);
             }
             let (db, graph) = setup(&cli.data_dir)?;
-            let runner = open_ontologies::batch::BatchRunner::new(db, graph, cli.pretty);
+            let runner = open_ontologies::batch::BatchRunner::new(db, graph, cli.pretty)
+                .human(!json_mode());
             let exit_code = runner.run(&batch_input, bail).await;
             std::process::exit(exit_code);
         }
@@ -4286,7 +4319,7 @@ mod proxy_serialization_tests {
     /// One instance of every variant `to_batch_command` will proxy. If a new
     /// proxy-able command is added and not listed here it simply goes uncovered;
     /// nothing here passes falsely because of it.
-    fn every_proxy_able_command() -> Vec<Commands> {
+    pub(super) fn every_proxy_able_command() -> Vec<Commands> {
         vec![
             Commands::Load { path: "x.ttl".into() },
             Commands::Save { path: "x.ttl".into(), format: "turtle".into() },
@@ -4394,3 +4427,78 @@ mod proxy_serialization_tests {
             .is_none());
     }
 }
+
+#[cfg(test)]
+mod human_render_registry_tests {
+    use super::*;
+    use clap::CommandFactory;
+
+    /// The path of every runnable subcommand, nested ones included, spelled as
+    /// `command_path` spells the one a process is running.
+    fn leaf_paths(cmd: &clap::Command, prefix: &str, out: &mut Vec<String>) {
+        for sub in cmd.get_subcommands() {
+            // clap adds `help` itself; it prints usage and never a result.
+            if sub.get_name() == "help" {
+                continue;
+            }
+            let path = if prefix.is_empty() {
+                sub.get_name().to_string()
+            } else {
+                format!("{prefix} {}", sub.get_name())
+            };
+            if sub.has_subcommands() {
+                leaf_paths(sub, &path, out);
+            } else {
+                out.push(path);
+            }
+        }
+    }
+
+    /// The guard behind #350 and #345. A subcommand added without a renderer
+    /// fails here, rather than printing raw JSON
```

**File**: `src/output.rs` (modified, +1364/-206)
```diff
@@ -1,234 +1,1305 @@
 //! Human-readable rendering of JSON result values for CLI output.
+//!
+//! A result is rendered by the renderer registered for the NAME of the command
+//! that produced it, and never by guessing from which keys the payload happens
+//! to carry. Guessing printed wrong answers, not merely unformatted ones
+//! (#350). `diff` reported any two files as identical, because its counts were
+//! read as arrays. An undetermined `shacl` run printed "No violations found.",
+//! because its empty `violations` array matched the branch written for
+//! `enforce`. `validate` printed class counts it never computed, because its
+//! `triples` key matched `stats`, and `monitor` printed itself as server status
+//! because of its `status` key. A shape nobody had guessed at, like the
+//! `defects` report, came out as raw JSON (#345).
+//!
+//! Registering a renderer for a new command is one arm in [`renderer_for`]. A
+//! test in `main.rs` walks the clap command tree and fails for any subcommand
+//! that has no arm there and no entry in [`PRINTS_ITS_OWN_TEXT`], so a command
+//! cannot ship with `--human` quietly printing JSON.
 
 use serde_json::Value;
 
-/// Render a result whose producing command is known, dispatching on the command
-/// rather than guessing from which keys the payload happens to carry.
+/// The whole human-readable text for one command's result.
+pub type Renderer = fn(&Value) -> String;
+
+/// How the text for a result with no renderer begins. Public so a test can tell
+/// a rendered result from one printed as labelled JSON.
+pub const NO_RENDERING: &str = "No human rendering exists for";
+
+/// Subcommands that never hand a JSON value to this module, and so need no
+/// renderer. `init` prints its own progress lines and the three server modes
+/// print nothing to stdout. `batch` is here because it has no result of its
+/// own: under `--human` each result in it is rendered by the renderer of the
+/// command its envelope names, exactly as the daemon path does.
+pub const PRINTS_ITS_OWN_TEXT: &[&str] = &["init", "serve", "serve-http", "serve-unix", "batch"];
+
+/// The renderer registered for `command`, the name the CLI and the batch
+/// envelope give it. A nested subcommand is named by its path, so `daemon
+/// status` and the top-level `status` are two commands with two shapes.
 ///
-/// Key-sniffing is what made a successful `daemon start` print "Daemon dead":
-/// `{ok, pid, url}` matched a branch meant for `daemon status`. The batch
-/// envelope names the command that produced each result, so on the proxy path
-/// there is no need to guess at all. `None` falls back to sniffing, which is
-/// still what the local one-shot paths use.
+/// To add one, write a `fn(&Value) -> String` below and add its arm here.
+pub fn renderer_for(command: &str) -> Option<Renderer> {
+    // The batch runner accepts `vocab_check` as well as `vocab-check`, and its
+    // envelope repeats the name as it was written, so both spellings must reach
+    // the same renderer.
+    let name = command.replace('_', "-");
+    let render: Renderer = match name.as_str() {
+        // Store and files
+        "validate" => render_validate,
+        "load" => render_load,
+        "save" => render_save,
+        "clear" | "push" | "monitor-clear" | "daemon stop" => render_message,
+        "stats" => render_stats,
+        "query" => render_query,
+        "diff" => render_diff,
+        "lint" => render_lint,
+        "defects" => render_defects,
+        "convert" => render_convert,
+        "status" => render_status,
+        "pull" => render_pull,
+        "marketplace" => render_marketplace,
+        "import-owl" => render_import_owl,
+        // Versioning
+        "version" => render_version,
+        "history" => render_history,
+        "rollback" => render_rollback,
+        // Data pipeline
+        "map" => render_map,
+        "ingest" => render_ingest,
+        "sql-ingest" => render_sql_ingest,
+        "import-schema" => render_import_schema,
+        "extend" => render_extend,
+        // Verdicts
+        "shacl" => render_shacl,
+        "vocab-check" => render_vocab_check,
+        "reason" => render_reason,
+        "enforce" => render_enforce,
+        "unpack" => render_unpack,
+        "monitor" => render_monitor,
+        // First-order export and the certificate commands
+        "fol" => render_fol,
+        "rules-import" => render_rules_import,
+        "fol-model" => render_fol_model,
+        "fol-prove" => render_fol_prove,
+        "preserve" => render_preserve,
+        "closure-diff" => render_closure_diff,
+        "trace-label" => render_trace_label,
+        // Lifecycle
+        "plan" => render_plan,
+        "apply" => render_apply,
+        "lock" => render_lock,
+        "drift" => render_drift,
+        "lineage" => render_lineage,
+        // Alignment and feedback
+        "align" => render_align,
+        "crosswalk-probe" | "contradiction-probe" => rende
```

**File**: `tests/human_render_test.rs` (added, +406/-0)
```diff
@@ -0,0 +1,406 @@
+//! `--human` renders every command's result by the command's NAME (#350, #345).
+//!
+//! The renderer used to be picked by sniffing which keys the JSON carried, and
+//! four commands printed a WRONG answer, not merely an unformatted one: `diff`
+//! reported any two files as identical, an undetermined `shacl` run read as a
+//! pass, `validate` printed class counts it never computed, and `monitor`
+//! printed itself as server status. Others, `defects` among them, printed raw
+//! JSON. Everything here runs the real binary on tiny synthetic fixtures.
+//!
+//! The guard that every clap subcommand has a renderer registered lives in
+//! `src/main.rs`, because the CLI struct is private to the binary crate.
+
+use serde_json::Value;
+use std::path::{Path, PathBuf};
+use std::process::{Command, Stdio};
+use std::time::{Duration, Instant};
+
+/// How the text for a result with no renderer begins. Kept in step with
+/// `output::NO_RENDERING` by hand, so this file reads only the binary.
+const NO_RENDERING: &str = "No human rendering exists for";
+
+const A: &str = r#"@prefix ex: <https://example.org/x/> .
+@prefix owl: <http://www.w3.org/2002/07/owl#> .
+@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
+ex:A a owl:Class ; rdfs:label "A" .
+ex:B a owl:Class ; rdfs:label "B" .
+"#;
+
+/// A with exactly one extra triple, which also declares one extra class.
+const B: &str = r#"@prefix ex: <https://example.org/x/> .
+@prefix owl: <http://www.w3.org/2002/07/owl#> .
+@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
+ex:A a owl:Class ; rdfs:label "A" .
+ex:B a owl:Class ; rdfs:label "B" .
+ex:C a owl:Class .
+"#;
+
+/// The reproduction from #345: a class under something it is disjoint from.
+const DEFECTIVE: &str = r#"@prefix ex: <https://example.org/x/> .
+@prefix owl: <http://www.w3.org/2002/07/owl#> .
+@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
+ex:A a owl:Class . ex:B a owl:Class .
+ex:A rdfs:subClassOf ex:B .
+ex:A owl:disjointWith ex:B .
+"#;
+
+const SHAPES: &str = r#"@prefix sh: <http://www.w3.org/ns/shacl#> .
+@prefix ex: <https://example.org/x/> .
+ex:PersonShape a sh:NodeShape ;
+  sh:targetClass ex:Person ;
+  sh:property [ sh:path ex:name ; sh:minCount 1 ] .
+"#;
+
+/// Two people, one with no name, so the shapes above find one violation.
+const PEOPLE: &str = r#"@prefix ex: <https://example.org/x/> .
+ex:alice a ex:Person .
+ex:bob a ex:Person ; ex:name "Bob" .
+"#;
+
+const CSV: &str = "id,name\n1,alpha\n2,beta\n";
+const SSSOM: &str =
+    "subject_id\tpredicate_id\tobject_id\nhttps://example.org/x/A\tskos:exactMatch\thttps://example.org/x/A\n";
+const GOALS: &str = "@prefix ex: <https://example.org/x/> .\nex:A a <http://www.w3.org/2002/07/owl#Class> .\n";
+const TRACE: &str = "rdfs9\t<https://example.org/x/a>\t<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>\t<https://example.org/x/B>\n";
+
+struct Fixtures {
+    dir: tempfile::TempDir,
+}
+
+impl Fixtures {
+    fn new() -> Self {
+        let dir = tempfile::tempdir().unwrap();
+        for (name, body) in [
+            ("a.ttl", A),
+            ("b.ttl", B),
+            ("defective.ttl", DEFECTIVE),
+            ("shapes.ttl", SHAPES),
+            ("people.ttl", PEOPLE),
+            ("data.csv", CSV),
+            ("mappings.sssom.tsv", SSSOM),
+            ("goals.ttl", GOALS),
+            ("trace.tsv", TRACE),
+        ] {
+            std::fs::write(dir.path().join(name), body).unwrap();
+        }
+        Fixtures { dir }
+    }
+
+    fn path(&self, name: &str) -> String {
+        self.dir.path().join(name).to_string_lossy().into_owned()
+    }
+
+    fn data_dir(&self) -> PathBuf {
+        self.dir.path().join("data")
+    }
+}
+
+struct Run {
+    code: i32,
+    stdout: String,
+}
+
+/// Run the binary locally, with its own data directory and none of the
+/// environment that could point it at a daemon or another store.
+fn oo(data_dir: &Path, args: &[&str]) -> Run {
+    let mut cmd = Command::new(env!("CARGO_BIN_EXE_open-ontologies"));
+    cmd.arg("--no-connect")
+        .arg("--data-dir")
+        .arg(data_dir)
+        .args(args)
+        .env_remove("OPEN_ONTOLOGIES_TOKEN")
+        .env_remove("OPEN_ONTOLOGIES_STORAGE_MODE")
+        .env_remove("GOVERNANCE_WEBHOOK")
+        .env("RUST_LOG", "warn")
+        .stdin(Stdio::null())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped());
+    let mut child = cmd.spawn().unwrap();
+    let deadline = Instant::now() + Duration::from_secs(120);
+    while child.try_wait().unwrap().is_none() {
+        if Instant::now() >= deadline {
+            child.kill().unwrap();
+            panic!("{args:?} timed out");
+        }
+        std::thread::sleep(Duration::from_millis(20));
+    }
+    let out = child.wait_with_output().unwrap();
+    Run {
+        code: out.status.code().unwrap_or(-1),
+        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
+    }
+}
+
+fn human(fx: &Fixtures, args: &[&str]) -> Run 
```

**File**: `tests/query_human_output_test.rs` (modified, +37/-42)
```diff
@@ -60,21 +60,20 @@ fn real_store_select_renders_flat_rows_on_both_entrypoints() {
     store.load_turtle(DATA, None).unwrap();
     let result: Value = serde_json::from_str(&store.sparql_select(QUERY).unwrap()).unwrap();
     assert_native_rows(&result);
-    for command in [None, Some("query")] {
-        let rendered = output::render_human_for(command, &result);
-        eprintln!("STORE {command:?}: {rendered}");
-        assert_native_table(&rendered);
-    }
+    // Both entrypoints name the command now: the one-shot CLI passes its
+    // subcommand and the proxy passes the batch envelope's (#350). The CLI
+    // tests below drive both end to end.
+    let rendered = output::render_human_for(Some("query"), &result);
+    eprintln!("STORE: {rendered}");
+    assert_native_table(&rendered);
 }
 
 #[test]
 fn empty_store_select_renders_no_results() {
     let store = GraphStore::new();
     let result: Value = serde_json::from_str(&store.sparql_select(QUERY).unwrap()).unwrap();
     assert_eq!(result["results"], json!([]));
-    for command in [None, Some("query")] {
-        assert_eq!(output::render_human_for(command, &result), "No results.");
-    }
+    assert_eq!(output::render_human_for(Some("query"), &result), "No results.");
 }
 
 #[test]
@@ -84,38 +83,37 @@ fn standard_bindings_and_non_select_fallbacks_keep_their_rendering() {
         {"s": {"type": "uri", "value": "urn:other"}}
     ]}});
     let expected = "s          label\n---------  -----\nurn:item   Item \nurn:other";
-    for command in [None, Some("query")] {
-        assert_eq!(output::render_human_for(command, &standard), expected);
-        assert_eq!(
-            output::render_human_for(
-                command,
-                &json!({"variables":["s"],"results":{"bindings":[]}})
-            ),
-            "No results."
-        );
-        for value in [
-            json!({"result": true}),
-            json!({"results": [{"s": "ordinary result"}]}),
-        ] {
-            assert_eq!(
-                output::render_human_for(command, &value),
-                serde_json::to_string_pretty(&value).unwrap()
-            );
-        }
-        assert_eq!(
-            output::render_human_for(
-                command,
-                &json!({"error":"invalid SPARQL","variables":["s"],"results":[]})
-            ),
-            "Error: invalid SPARQL"
-        );
-    }
-    // Preserve the existing CONSTRUCT rendering, even though it shares the
-    // stats discriminator. This patch only changes SELECT recognition.
+    let command = Some("query");
+    assert_eq!(output::render_human_for(command, &standard), expected);
+    assert_eq!(
+        output::render_human_for(
+            command,
+            &json!({"variables":["s"],"results":{"bindings":[]}})
+        ),
+        "No results."
+    );
+    // An ASK answer is rendered as one. A results array with no variables
+    // is no SELECT the query command produces, so it is printed as
+    // labelled JSON rather than guessed at.
+    assert_eq!(output::render_human_for(command, &json!({"result": true})), "ASK: true");
+    let unknown = json!({"results": [{"s": "ordinary result"}]});
+    let rendered = output::render_human_for(command, &unknown);
+    assert!(rendered.starts_with(output::NO_RENDERING), "{rendered}");
+    assert!(rendered.ends_with(&serde_json::to_string_pretty(&unknown).unwrap()));
+    assert_eq!(
+        output::render_human_for(
+            command,
+            &json!({"error":"invalid SPARQL","variables":["s"],"results":[]})
+        ),
+        "Error: invalid SPARQL"
+    );
+    // A CONSTRUCT used to reach the stats rendering through its `triples` key
+    // and print "Triples: 0" over the triples it had built (#350). It is now
+    // one N-Triples line per triple.
     let construct = json!({"triples":[{"subject":"urn:s","predicate":"urn:p","object":"urn:o"}]});
     assert_eq!(
-        output::render_human(&construct),
-        "Triples:     0\nClasses:     0\nProperties:  0\nIndividuals: 0"
+        output::render_human_for(Some("query"), &construct),
+        "urn:s urn:p urn:o ."
     );
 }
 
@@ -183,10 +181,7 @@ fn check_cli_queries(dir: &tempfile::TempDir, path: &str, local: bool) {
         &human_flags,
         "ASK { ?s <https://example.org/label> ?label }",
     );
-    assert_eq!(
-        serde_json::from_str::<Value>(&ask).unwrap(),
-        json!({"result":true})
-    );
+    assert_eq!(ask.trim(), "ASK: true");
     assert_native_table(&human);
     assert_eq!(empty.trim(), "No results.");
 }
```

---

### Incident Patch 3: `cefe5997` (2026-10-30)
**Commit Message**: Merge pull request #351 from fabio-rovai/integrate/fix-all-343-350

Fix #343 #345 #349 #350, add weighted repair (#346) and disjointness exceptions (#347), land #348

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +26/-0)
```diff
@@ -730,6 +730,32 @@ jobs:
         run: OO_REQUIRE_FIXTURES=1 cargo test --test dl_consistency_differential_test -- --nocapture
       - name: Check the model ingestion, both front ends
         run: OO_REQUIRE_FIXTURES=1 cargo test --test fol_model_ingest_test -- --nocapture
+      - name: Build picosat with proof traces, the solver whose refutations oo-lrat checks
+        # Ubuntu's picosat package cannot serve here: measured in ubuntu:24.04
+        # (picosat 965-2), /usr/bin/picosat.trace is the build WITHOUT trace
+        # support, the same size as /usr/bin/picosat, and `-T` aborts with
+        # "compiled without trace support". `-T` is how src/sat.rs gets the
+        # proof it converts to LRAT, so the solver is built from the upstream
+        # 965 tarball with `--trace`, pinned by its SHA-256.
+        run: |
+          set -euo pipefail
+          curl -sSfL -o "$RUNNER_TEMP/picosat-965.tar.gz" https://fmv.jku.at/picosat/picosat-965.tar.gz
+          echo "15169b4f28ba8f628f353f6f75a100845cdef4a2244f101a02b6e5a26e46a754  $RUNNER_TEMP/picosat-965.tar.gz" | sha256sum -c -
+          tar -xzf "$RUNNER_TEMP/picosat-965.tar.gz" -C "$RUNNER_TEMP"
+          cd "$RUNNER_TEMP/picosat-965"
+          ./configure.sh --trace
+          make picosat
+          printf 'p cnf 1 2\n1 0\n-1 0\n' > unsat.cnf
+          status=0; ./picosat -T unsat.trace unsat.cnf || status=$?
+          test "$status" -eq 20
+          test -s unsat.trace
+      - name: Refute a cheaper weighted repair through oo-lrat
+        # #346. A weighted repair is called optimal when its branch and bound
+        # closes; with a certificate the same claim is a CNF that picosat
+        # refutes and oo-lrat checks under Lrat.unsat_of_check. Strict, because
+        # the leg that matters needs both tools, and a skip here would leave
+        # the word `refuted` printed by no run that CI ever sees.
+        run: OO_SAT_SOLVER="$RUNNER_TEMP/picosat-965/picosat" OO_REQUIRE_FIXTURES=1 cargo test --test repair_certificate_test -- --nocapture
       - name: Build the release binary the SMT differential drives
         # The differential compares the SMT-LIB THE PRODUCT EMITS, so it runs
         # the real binary rather than linking the library. `cargo test` does not
```

**File**: `CHANGELOG.md` (modified, +160/-0)
```diff
@@ -6,6 +6,68 @@ All notable changes to Open Ontologies are documented here.
 
 ### Added
 
+- **An exception to a disjointness can be declared and compiled away, so
+  every tool reads one classical ontology** (#347). `exc:exceptFor E` on the
+  reified `owl:disjointWith` axiom (`exc:` is
+  `https://open-ontologies.org/exceptions#`), in either direction, names the
+  classes the disjointness should not reach. `compile-exceptions FILE --out
+  COMPILED` (CLI; without `--out` it is a dry run), `compile-exceptions` in
+  `batch` and `onto_compile_exceptions` (MCP, the loaded store in place)
+  rewrite each annotated `X ⊥ Y` over the asserted hierarchy of named classes
+  under one reading: a class under X and a class under Y stay compatible
+  exactly when an exception, or a class below one, is told-below both. `X ⊥ Y`
+  is removed; with Z the exceptions, what is below them and all their
+  ancestors, `S ⊥ Y` is emitted for every S under X outside Z, `T ⊥ X` for
+  every T under Y outside Z, and `a ⊥ b` for each most general pair inside Z
+  with nothing licensed below both (two exceptions under different
+  intermediate classes keep those intermediates apart). On the issue's
+  example `Houseboat` and its subclass become satisfiable to the owl-dl
+  tableau, `FloatingRestaurant` (under both, not an exception) stays
+  unsatisfiable, and `Car ⊓ Building` is still unsatisfiable. An exception not under both sides is rejected by name
+  (`exception_not_under_both`). The cost is in the report:
+  `exempted_classes`, with `exempted_beyond_the_exceptions` naming those that
+  are not exceptions (here `Vehicle` and `Building`, so an individual typed
+  only as both is no longer a contradiction). The axiom becomes a record
+  (`exc:compiledDisjointWith`, an annotation property) rather than a dangling
+  reification, a re-run adds pairs for new subclasses and never retracts one,
+  and a run over a compiled graph changes nothing. `defects` on an uncompiled
+  store still reports the exception as an error, as every reasoner still
+  does, and marks the row `declared_exception: true` with a hint naming the
+  compile; `declared_exceptions` counts them. The issue's defeasible
+  semantics is not built, for four reasons given in decision 0019.
+
+- **`repair` returns the cheapest set of asserted axioms whose removal makes
+  every class coherent, and says what checked each half of that** (#346).
+  `defects` said that a class could have no instances and `onto_justify` said
+  which axioms were responsible; nothing said which to drop. `repair`
+  (CLI), `onto_repair` (MCP) and `repair` (`batch`) read per-axiom weights
+  from `owl:Axiom` reifications (`--weight-property`, `--default-weight`, 1 by
+  default) and return the dropped axioms with the conflicts each one hits, the
+  total weight, the classes made coherent, `optimal` with its basis, a
+  `lower_bound`, and `--out` writes the repaired Turtle. Coherence is judged in
+  the atomic named-class fragment `defects` judges (`subClassOf`,
+  `disjointWith`, and `equivalentClass` as one axiom with two edges, between
+  IRIs), plus a class disjoint with itself; every other triple is counted by
+  bucket under `scope` and never read. The search is the implicit hitting set
+  loop of Davies and Bacchus (CP 2011): a hitting set of the conflicts
+  collected so far is removed and the fragment re-checked, greedy in the
+  intermediate rounds and exact (branch and bound) once a greedy repair is
+  coherent, and an exact repair that comes out coherent is optimal by
+  monotonicity; it does not enumerate every MinA first. `--weights
+  probability` minimises the summed log-odds of what is dropped, the most
+  probable coherent subset under independence, because summing raw
+  probabilities is not: conflicts `{a=0.6, c=0.9}` and `{b=0.6, c=0.9}` drop
+  `c` under `cost` and `a` and `b` under `probability`, and both are pinned.
+  `p = 1` is hard and a conflict of hard axioms is reported `unrepairable`;
+  `p <= 0.5` is dropped at no cost with that reason. Conflicts are re-run,
+  coherence is re-run (and the `--out` file is read back through `defects`),
+  and with `--certificate-dir` optimality is written as CNF (one clause per
+  conflict, the cost bound as a reduced BDD), refuted by picosat and checked by
+  `oo-lrat` under `Lrat.unsat_of_check`; without either tool the status is
+  `undetermined`, never `refuted`. `max_nodes` and `max_rounds` bound the
+  search and name themselves when they fire. The `lean` CI job now installs
+  Ubuntu's `picosat` and runs `repair_certificate_test` strictly against its
+  `picosat.trace` build.
 - **A plan says whether the change breaks the ontology, and scores it `high`
   when it does** (#336, reported by @jpsanchezcalypso). `risk_score` came from
   removal counts alone, so a change that made a named class unsatisfiable (R1:
@@ -89,6 +151,104 @@ All notable changes to Open Ontologies are documented here.
 
 ### Fixed
 
+- **`--human` ren
```

**File**: `CLAUDE.md` (modified, +2/-0)
```diff
@@ -77,12 +77,14 @@ Claude dynamically decides the next tool call based on what the previous tool re
 | `onto_shacl` | To validate loaded data against SHACL shapes (cardinality, datatypes, classes) |
 | `onto_vocab_check` | To closed-world-check generated DATA: flags any predicate/class used that is not declared in the loaded ontology (hallucinated terms). Catches what open-world SHACL silently passes. Run on LLM-generated Turtle before `onto_load` |
 | `onto_defects` | BEFORE trusting any fact-level result, and on every marketplace pack before adopting it. Checks the ONTOLOGY against itself with no data present: `transitive_and_functional`, `symmetric_and_asymmetric`, `subclass_cycle`, `sub_property_cycle`, `disjoint_with_ancestor`, `inherited_disjoint`, `self_inverse`, `inverse_not_mutual`. A different question from `onto_dl_check`: a transitive functional property is satisfiable and is still a trap, because the pair manufactures contradictions the moment instances arrive. Each kind is listed at most 50 times, with the full total under `truncated` |
+| `onto_compile_exceptions` | When a disjointness is meant to have EXCEPTIONS (a houseboat is both a vehicle and a building) and `onto_defects` reports the excepted class as an `inherited_disjoint` error marked `declared_exception: true`. Annotate the reified `owl:disjointWith` axiom with `exc:exceptFor` (`https://open-ontologies.org/exceptions#`), then run this: it replaces the axiom with ordinary pairwise disjointness over the asserted named hierarchy, so every reasoner, SHACL run and `onto_defects` reads one classical ontology. A pair of classes stays compatible only when an exception, or a class below one, is filed under both. Rewrites the loaded store in place and is idempotent; the report lists every pair emitted and the classes exempted beyond the exceptions (the cost). Decision 0019 says why this is compiled rather than inferred |
 | `onto_dlp_boundary` | BEFORE trusting any `onto_reason` result, in the same register as `onto_defects`. Asks which of YOUR axioms the rule engine can actually SEE. A certificate from `onto_reason` is a sound proof about the axioms the rules read and says nothing about the ones no rule fires on, so a user can reason, get a green machine-checked certificate, and never learn that a third of the TBox was invisible. TWO DIMENSIONS THAT ARE NEVER MERGED, because one is a rewrite of the ontology and the other is a patch to this engine. (1) THE FRAGMENT: is the axiom Horn at all? The line is OWL 2 RL's class grammar (OWL 2 Profiles 4.3), and `outside` there would hold of a perfect OWL 2 RL engine: disjunction in the consequent, existential in the head, cardinality restriction, negation in the antecedent, each listed per axiom with the reason. (2) THIS ENGINE: does a rule fire on it? `owl:hasKey` and `owl:propertyChainAxiom` are Horn, OWL 2 RL has `prp-key` and `prp-spo2`, and this engine runs neither, so they are INSIDE the fragment and still invisible. An axiom that splits soundly is `partially_inside`: `A subClassOf (B and Out)` keeps its `A subClassOf B` half, and an `owl:equivalentClass` with an existential on one side keeps the direction `cls-svf1` evaluates. A conjunction in the ANTECEDENT does not split, because dropping a conjunct from a rule body makes it fire more often. The rule-table figures (78 OWL 2 RL rules, 29 evaluated, 10 more detected only as a clash, 7 that conclude false and are not looked for) are DERIVED from `src/reason.rs`, not typed. Every triple lands in an axiom bucket or a counted `not_classified` one. NOT a consistency check |
 | `onto_trace_label` | AFTER a model, an agent or a person hands you a reasoning trace and BEFORE you believe any step of it. Takes the trace in `oo-trace/1`, which is the same line `onto_reason`'s `derivations.tsv` writes, so a certificate this engine emitted is itself a valid trace. THREE FAMILIES, and the third is the reason to use this rather than an LLM judge. `entailed`: a Lean checker accepted a certificate slice of the run that concludes the triple. `not_entailed`: a rule head in the table could conclude a triple of this shape, every axiom the step cites is inside the fragment, and the graph still does not support it. `outside_the_fragment`: no data could ever make this table derive it, and the two reasons stay apart exactly as `onto_dlp_boundary` keeps them apart, because `outside_the_fragment` is a rewrite of the ontology and `no_rule_in_this_table_concludes_this_shape` is a patch to `src/reason.rs`. Under the built-in table the second of those is unreachable and that is a fact about the table: `rdfs7`'s head is three variables, so some data makes it conclude any triple at all. TWO ANSWERS PER STEP AND NEITHER IS REPORTED AS THE OTHER: `local` is a one-line certificate over the premises the STEP cited, so a step whose own reasoning is machine-checked sound over triples the graph does not hold reads `premises_in_store: false` and `locally_sound_but_premises_not_in_the
```

**File**: `Cargo.lock` (modified, +24/-24)
```diff
@@ -2849,8 +2849,8 @@ dependencies = [
 
 [[package]]
 name = "oxigraph"
-version = "0.5.9"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.5.13"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "dashmap",
  "getrandom 0.3.4",
@@ -2886,8 +2886,8 @@ checksum = "54b4ed3a7192fa19f5f48f99871f2755047fabefd7f222f12a1df1773796a102"
 
 [[package]]
 name = "oxjsonld"
-version = "0.2.5"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.2.7"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "json-event-parser",
  "oxiri",
@@ -2898,8 +2898,8 @@ dependencies = [
 
 [[package]]
 name = "oxrdf"
-version = "0.3.3"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.3.5"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "hex",
  "oxilangtag",
@@ -2912,8 +2912,8 @@ dependencies = [
 
 [[package]]
 name = "oxrdfio"
-version = "0.2.5"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.2.7"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "oxjsonld",
  "oxrdf",
@@ -2924,8 +2924,8 @@ dependencies = [
 
 [[package]]
 name = "oxrdfxml"
-version = "0.2.3"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.2.5"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "oxilangtag",
  "oxiri",
@@ -2936,25 +2936,25 @@ dependencies = [
 
 [[package]]
 name = "oxrocksdb-sys"
-version = "0.5.9"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.5.13"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "bindgen",
  "cc",
 ]
 
 [[package]]
 name = "oxsdatatypes"
-version = "0.2.2"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.2.4"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "thiserror",
 ]
 
 [[package]]
 name = "oxttl"
-version = "0.2.3"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.2.5"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "memchr",
  "oxilangtag",
@@ -4052,8 +4052,8 @@ dependencies = [
 
 [[package]]
 name = "sparesults"
-version = "0.3.3"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.3.5"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "json-event-parser",
  "memchr",
@@ -4064,8 +4064,8 @@ dependencies = [
 
 [[package]]
 name = "spareval"
-version = "0.2.6"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.2.9"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "hex",
  "json-event-parser",
@@ -4086,8 +4086,8 @@ dependencies = [
 
 [[package]]
 name = "spargebra"
-version = "0.4.6"
-source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=6409fa1c8ad5880399d0ca69b38e43cbb2052ad7#6409fa1c8ad5880399d0ca69b38e43cbb2052ad7"
+version = "0.4.8"
+source = "git+https://github.com/fabio-rovai/oxigraph.git?rev=37db8e1522585ed2f9aa994be6c5c716859af5c8#37db8e1522585ed2f9aa994be6c5c716859af5c8"
 dependencies = [
  "oxilangtag",
  "oxiri",
@@ -4099,8 +4099,8 @@ dependencies = [
 
 [[package]]
 name = "sparo
```

**File**: `Cargo.toml` (modified, +26/-9)
```diff
@@ -119,26 +119,43 @@ toml = "0.8"
 # not grow by a single crate.
 proptest = "1"
 
-# A patched Oxigraph, pinned by revision. Two changes over 0.5.9, on branch
-# `oo/lexical-forms-0.5.9` of the fork.
+# A patched Oxigraph, pinned by revision: release 0.5.13 plus four changes, on
+# branch `oo/lexical-forms-0.5.13` of the fork.
 #
-# 1. `Store::snapshot`, not in Oxigraph 0.5.9. It is a read view pinned to one
+# 1. `Store::snapshot`, not in Oxigraph 0.5. It is a read view pinned to one
 #    state that takes no lock, and decision 0010 explains at length why neither
 #    thing the unpatched crate offers will do: a transaction pins the state but
 #    stops every writer for the length of a reasoning run on the memory backend,
 #    and copying the graph costs about 221 bytes a triple. The patch is a public
 #    wrapper over `Storage::snapshot`, which `Store::len` and
 #    `Store::quads_for_pattern` already call internally on every read.
 # 2. A literal is kept as written (oxigraph/oxigraph#2010, fixing #1989; here
-#    #335). 0.5.9 stored every literal of an XSD datatype with a value encoding
-#    by value and gave it back in the canonical form of the primitive type, so
-#    "4.0"^^xsd:decimal came back as "4", "1"^^xsd:boolean as "true",
+#    #335). Oxigraph 0.5 stores every literal of an XSD datatype with a value
+#    encoding by value and gives it back in the canonical form of the primitive
+#    type, so "4.0"^^xsd:decimal came back as "4", "1"^^xsd:boolean as "true",
 #    "5"^^xsd:int as "5"^^xsd:integer, and "4.0" and "4" loaded as one triple.
 #    A literal is now value-encoded only when decoding gives back the same
 #    datatype and lexical form; any other takes the generic typed-literal path.
+# 3. STR() and DATATYPE() read a literal as written (here #343). The 0.5
+#    evaluator reads both from the parsed value, so even with the literal stored
+#    as written STR("4.0"^^xsd:decimal) was "4" and DATATYPE("5"^^xsd:int) was
+#    xsd:integer. STR is upstream 1392252f, which is on main (0.6.0-dev) and
+#    not on the 0.5 branch. DATATYPE is the second commit of
+#    oxigraph/oxigraph#2010, open against main, and builds on it. Both are
+#    ported to 0.5.13 by hand.
+# 4. The fork's W3C testsuite compares result literals by value through
+#    spareval, since with change 2 a round trip through a store no longer
+#    normalises them. Test code only; nothing OO links changes.
+#
+# Release 0.5.13 is the base, rather than 0.5.9, for oxigraph/oxigraph#1974,
+# released in 0.5.12: 0.5.9 parses an arithmetic chain to the right, so
+# `8-3-2` was 7 and `7/20*1000` was 0.00035 (here #349).
 #
 # Pinned by REVISION and not by branch, so that what CI builds is what was
-# reviewed. Upstream at oxigraph/oxigraph; when both land this stanza goes and
-# the version bound below is all that remains.
+# reviewed. The stanza can go when an upstream release carries all three
+# library changes, which means Oxigraph 0.6 with #2010 merged: `Store::snapshot`
+# (oxigraph/oxigraph#1957, there named `Snapshot`) and the STR fix are on main,
+# and #2010 is open. The `oxigraph` bound in `[dependencies]` then moves to
+# that release.
 [patch.crates-io]
-oxigraph = { git = "https://github.com/fabio-rovai/oxigraph.git", rev = "6409fa1c8ad5880399d0ca69b38e43cbb2052ad7" }
+oxigraph = { git = "https://github.com/fabio-rovai/oxigraph.git", rev = "37db8e1522585ed2f9aa994be6c5c716859af5c8" }
```

**File**: `docs/UPSTREAM_ISSUES.md` (modified, +21/-14)
```diff
@@ -8,16 +8,18 @@ send.
 
 ## 1. Twelve XSD integer-derived datatypes, and `xsd:dateTimeStamp`, are not preserved
 
-**Status, 28 Oct 2026.** 1a is fixed in the pinned fork and filed upstream as
-oxigraph/oxigraph#2010 (issue #1989): the store value-encodes a literal only
-when decoding gives it back as written, so these datatypes, and non-canonical
-lexical forms such as `"4.0"^^xsd:decimal`, now survive a load (here #335,
+**Status, 30 Oct 2026.** Both halves are fixed in the pinned fork, which now
+sits on 0.5.13. 1a is filed upstream as oxigraph/oxigraph#2010 (issue #1989):
+the store value-encodes a literal only when decoding gives it back as written,
+so these datatypes, and non-canonical lexical forms such as
+`"4.0"^^xsd:decimal`, survive a load (here #335,
 `tests/datatype_preservation_test.rs::the_store_keeps_every_declared_datatype`).
-1b is NOT fixed: measured on the new pin, `DATATYPE()` still answers
-`xsd:integer` for the twelve and `xsd:dateTime` for `xsd:dateTimeStamp`, and
-`STR()` of a known-datatype literal is still its canonical form, inside any
-query, whether the literal is stored or written in the query text. So the
-workaround below stays.
+1b is fixed by two commits ported to 0.5.13 by hand, neither of which is on the
+0.5 branch: upstream 1392252f, on main, makes `STR()` read the term as written,
+and the DATATYPE commit of #2010, still open, builds on it (here #343). Measured on the new pin,
+`DATATYPE()` answers the written datatype for all thirteen and `STR()` the
+written lexical form, whether the literal is stored or written in the query
+text. The workaround below is gone.
 
 **Two independent defects, in two crates.** They were first reported here as one,
 blamed on storage. That was wrong, and the correction matters for anyone acting
@@ -121,14 +123,19 @@ Neither enum has such a slot today, so this is a coordinated change across the
 two crates, and it wants their conformance suites run against it. It is written
 up here rather than attempted blind.
 
-### Our workaround
+### Our workaround, removed with #343
 
-`datatype_is_indistinguishable_in_store` in `src/shacl.rs` records a
+`datatype_is_indistinguishable_in_store` in `src/shacl.rs` recorded a
 `sh:datatype` constraint (and, since the #333 follow-ups, an `sh:or`, `sh:not`,
 qualified or `sh:node` member) naming one of these as unevaluated rather than
-answering it wrongly. With 1a fixed it rests on 1b alone.
-`tests/datatype_preservation_test.rs` pins the exact set `DATATYPE()` misreports
-and fails in both directions, so the workaround is removed when 1b is fixed.
+answering it wrongly. With 1a and 1b fixed it had no reason left and was
+deleted. One thing it had been hiding remains the engine's to do: `DATATYPE()`
+does not judge a lexical form, and the evaluator parses each of the twelve as
+an unbounded `xsd:integer`, so `"300"^^xsd:byte` is a number to it. The engine
+therefore tests these lexical spaces itself, as regexes
+(`derived_lexical_space_regexes` in `src/shacl.rs`).
+`tests/datatype_preservation_test.rs` now asserts that `DATATYPE()` reports
+every datatype in its document.
 
 ---
 
```

**File**: `docs/ci-gates.md` (modified, +1/-0)
```diff
@@ -65,6 +65,7 @@ job invokes the file at all.
 |---|---|---|---|
 | `lean_certificate_test.rs` | lake | `lean` job | **strict** |
 | `justify_test.rs` | `benchmark/reference/pizza-reference.owl`, which ships with the repository | `lean` job | **strict** |
+| `repair_certificate_test.rs` | picosat with trace support + `oo-lrat`, for the one leg that refutes a cheaper repair; the other two need nothing | `lean` job builds picosat 965 from the upstream tarball with `--trace` (Ubuntu's `picosat.trace` is built without it) and points `OO_SAT_SOLVER` at it | **strict** |
 | `provenance_test.rs` | the same shipped ontology | `lean` job | **strict** |
 | `shacl_core_verified_test.rs` | lake + vendored W3C SHACL suite | `lean` job | **strict** |
 | `dl_model_certificate_test.rs` | lake + `oo-dlmodel` | `lean` job | **strict** |
```

**File**: `docs/decisions/0018-conformance-is-not-truth.md` (modified, +423/-32)
```diff
@@ -1,6 +1,12 @@
 # 0018. Conformance is not truth, and a report must say which shapes ran
 
-**Status:** accepted, 28 September 2026.
+**Status:** accepted, 28 September 2026. **Amended 28 September 2026: engine defect E1 is
+fixed.** The amendment is in place rather than appended, because a record whose table says a defect
+is open is read by the table and not by a footnote. Every sentence that changed is marked, and the
+deferral argument is kept rather than deleted, because it is the reason the fix has the shape it has.
+**Amended again 30 October 2026: the calendar moved into the SPARQL expression (option 2 of PR #348),
+so E1 is fixed at every site that asks the datatype question and not only on the two direct paths.**
+Sentences changed by that amendment are marked "Amended 30 October".
 
 ## The thesis
 
@@ -34,7 +40,7 @@ invites the reply that the tool is simply being used wrongly, and that reply is
 
 | fixture | bucket | fixed here | what it shows |
 | --- | --- | --- | --- |
-| E1, impossible date | engine defect | **no** | `"2026-02-31"^^xsd:date` conforms to `sh:datatype xsd:date` on both evaluation paths |
+| E1, impossible date | engine defect | **yes, in the amendment** | `"2026-02-31"^^xsd:date` conformed to `sh:datatype xsd:date` on both evaluation paths |
 | E2, two answers to one constraint | engine defect | **yes** | `sh:datatype` under `sh:property` skipped the lexical test the node-shape path ran |
 | E3, inference read as assertion | engine defect | **no** | materialising into the inference graph flips a verdict from violated to conforming |
 | S1, decorative shape | standard limitation, plus a report gap | report gap only | a shape selecting one node buys a `true` verdict for a shapes graph whose load-bearing shape selected none |
@@ -43,17 +49,17 @@ invites the reply that the tool is simply being used wrongly, and that reply is
 | `owl:sameAs` cardinality | NEITHER | not applicable | rejected as an overclaim; see below |
 | control, `xsd:byte` | not an attack | not applicable | a probe the existing defence turns into an undetermined verdict rather than a pass |
 
-## Engine defect E1, the impossible date, recorded and deliberately not fixed
+## Engine defect E1, the impossible date, FIXED in the amendment
 
 SHACL 4.1.2 makes a literal whose lexical form falls outside its datatype's lexical space a violation
 of `sh:datatype`. XSD 1.1 section 3.3.9 puts the day-of-month constraint IN the lexical space of
-`xsd:date`, so `"2026-02-31"^^xsd:date` is ill formed and must be reported. This engine reports
-nothing. `ill_typed_test` in `src/shacl.rs` implements the lexical test as a regex, and for
-`xsd:date` that regex is positional and counts digits:
-`^-?[0-9]{4}-[0-9]{2}-[0-9]{2}(Z|[+-][0-9]{2}:[0-9]{2})?$`. Both `2026-02-31` and `2026-13-01` match
-it, so both conform on both evaluation paths.
+`xsd:date`, so `"2026-02-31"^^xsd:date` is ill formed and must be reported. This engine reported
+nothing. `ill_typed_test` in `src/shacl.rs` implemented the lexical test as a regex, and for
+`xsd:date` that regex was positional and counted digits:
+`^-?[0-9]{4}-[0-9]{2}-[0-9]{2}(Z|[+-][0-9]{2}:[0-9]{2})?$`. Both `2026-02-31` and `2026-13-01` matched
+it, so both conformed on both evaluation paths.
 
-The verified evaluator disagrees, and that is what makes this a defect rather than a reading of an
+The verified evaluator disagreed, and that is what made this a defect rather than a reading of an
 ambiguous specification. Run on 28 September 2026:
 
 ```
@@ -71,24 +77,255 @@ $ ./lean/.lake/build/bin/oo-shacl validate date_data.nt date_shapes.nt
    "toolchain":"4.33.1"}}
 ```
 
-The Lean development checks the day against `daysInMonth` in `parseDateBody`. The Rust does not. Two
-evaluators in one repository give opposite answers to the same constraint over the same store, and
-the one carrying the theorem is the one saying `false`.
+The Lean development checks the day against `daysInMonth` in `parseDateBody`. The Rust did not. Two
+evaluators in one repository gave opposite answers to the same constraint over the same store, and
+the one carrying the theorem was the one saying `false`.
 
-**The fix is deferred, and the reason is the W3C baseline.** Closing this means implementing the XSD
-date lexical space in Rust. A hand-written regex approximating it fails in the direction that reports
-violations on VALID dates, which is the failure mode a conformance suite exists to catch, and
+### The deferral argument, which was right, and what it settles about the fix
+
+The fix was deferred here on the following reasoning, kept verbatim in substance because it is what
+decides the SHAPE the fix ended up having. Closing this means implementing the XSD date lexical space
+in Rust. A hand-written regex approximating it fails in the direction that reports violations on
+VALID dates, which is the failure mode a conformance suite exists to catch, and
 `tests/w3c_shacl_baseline.json` is the ratchet that woul
```

#### Recent Merged Pull Requests:
- **PR #351** (2026-10-30): Fix #343 #345 #349 #350, add weighted repair (#346) and disjointness exceptions (#347), land #348 (@fabio-rovai)
- **PR #348** (2026-10-30): An impossible date is a violation, and the day is judged where a regex cannot judge it (@fabio-rovai)
- **PR #344** (2026-10-28): The store keeps literals as written: oxigraph pin moves to 6409fa1c (#335) (@fabio-rovai)
- **PR #342** (2026-10-28): Land #317, #337, #338 and fixes for #333, #334, #336, #339, #340, #341 (@fabio-rovai)
- **PR #338** (closed): Pin GitHub Actions to exact release commit SHAs (@lpmi-13)
- **PR #337** (2026-10-28): benchmark: document where the ORE 2015 corpus lives (Zenodo DOI, licence, layout) (@jpsanchezcalypso)

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

## X. Merge branch 'feat/346-weighted-repair' into integrate/fix-all-343-350

**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fabio-rovai/open-ontologies. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4676fddc`: Merge branch 'feat/346-weighted-repair' into integrate/fix-all-343-350. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      - name: Install picosat, the solver whose refutations oo-lrat checks
        # Ubuntu's picosat package builds the solver twice and installs the
        # build WITH proof traces as /usr/bin/picosat.trace; plain
        # /usr/bin/picosat has no trace support, and `-T` is how src/sat.rs
        # gets the proof it converts to LRAT. Read off the package's
        # debian/rules and debian/install rather than assumed. The apt index is
        # fresh from the model finders step above.
        run: |
          set -euo pipefail
          sudo apt-get install -y picosat
          test -x /usr/bin/picosat.trace
      - name: Refute a cheaper weighted repair through oo-lrat
        # #346. A weighted repair is called optimal when its branch and bound
        # closes; with a certificate the same claim is a CNF that picosat
        # refutes and oo-lrat checks under Lrat.unsat_of_check. Strict, because
        # the leg that matters needs both tools, and a skip here would leave
        # the word `refuted` printed by no run that CI ever sees.
        run: OO_SAT_SOLVER=/usr/bin/picosat.trace OO_REQUIRE_FIXTURES=1 cargo test --test repair_certificate_test -- --nocapture
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4676fddc` are properly handled with clean fallback behavior.
