# Forensic Learning Record: sethblack/python-seo-analyzer

> **Canonical Artifact**: `07_PROJECT_LEARNING/sethblack-python-seo-analyzer-learnings.md`  
> **Source Repository**: [https://github.com/sethblack/python-seo-analyzer.git](https://github.com/sethblack/python-seo-analyzer)  
> **Commit Hash**: `c995a4649e13782ef594ebc3681c8061d40dc83c`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Python 3.10+, Trafilatura, lxml, LangChain, Pydantic  

---

## 1. Project Context & Architectural Mission

`sethblack/python-seo-analyzer` is a hybrid technical and semantic SEO analyzer. It combines classical NLP keyword frequency calculations (n-grams, stopword filtering, tokenization) with modern LLM-driven semantic audits (entity extraction, Google Knowledge Panel readiness, N-E-E-A-T-T credibility scoring, and AI conversation search optimization).

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Core Modules**:
  - `pyseoanalyzer/page.py`: Page extraction using `trafilatura` for boilerplate removal and `lxml.html` with compiled XPaths for tag analysis.
  - `pyseoanalyzer/stopwords.py`: Curated English stopword set.
  - `pyseoanalyzer/llm_analyst.py`: Structured Pydantic LLM analysis via Anthropic/OrcaRouter.

### D2: Classical NLP Extraction & N-Gram Frequencies
- Compiles token regular expressions: `re.compile(r"(?u)\b\w\w+\b")`.
- Computes unigram (`wordcount`), bigram (`bigrams`), and trigram (`trigrams`) token frequency counters.
- Strips punctuation using high-performance byte translation tables (`bytes.maketrans`).
- Identifies keyword stuffing and over-optimization across headings and body text.

### D3: Structured LLM Semantic SEO Models
- Leverages Pydantic schemas to enforce structured outputs from LLM evaluations:
  - `EntityAnalysis`: Evaluates whether core entities are recognized and ready for Google Knowledge Panel indexing.
  - `CredibilityAnalysis`: Scores Experience, Expertise, Authoritativeness, and Trustworthiness (N-E-E-A-T-T).
  - `ConversationAnalysis`: Assesses content structure for AI conversational answer engines (Perplexity, ChatGPT Search, Claude).
  - `SEORecommendations`: Categorizes fixes into quick wins vs strategic milestones with an impact/effort priority matrix.
