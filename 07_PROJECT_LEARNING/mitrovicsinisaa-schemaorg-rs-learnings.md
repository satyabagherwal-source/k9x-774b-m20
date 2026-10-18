# mitrovicsinisaa SchemaOrg-RS — Forensic Learning Dossier

**Repository**: `https://github.com/mitrovicsinisaa/schemaorg-rs`
**Harvest Date**: 2026-10-18
**Ecosystem**: Rust / WebAssembly
**Domain**: Zero-Network High-Throughput Structured Data Graph & Validation

## 1. Architectural Overview
An ultra-high-performance Rust crate and WebAssembly module designed for search crawlers and data pipelines. It extracts structured data from HTML across JSON-LD, Microdata, and RDFa Lite formats simultaneously into a unified `StructuredDataGraph`, validated against compile-time static Schema.org definitions.

## 2. Key Code Evidence & Implementation Patterns
- **Build-Time Code Generation (`build.rs`)**: Generates Rust types, property definitions, and domain/range tables during compilation, eliminating runtime network overhead and JSON parsing latency.
- **Unified Graph Model**: Represents entities, blank nodes, and scalar values in a directed graph structure, allowing cross-format entity linking (e.g. Microdata referencing a JSON-LD entity via `@id`).
- **Google Search Feature Profiles**: Modular profile engines (`article.rs`, `breadcrumb.rs`, `product.rs`) check exact Google eligibility criteria independently of generic Schema.org compliance.

## 3. Negative Constraints
- Never execute external network requests during HTML parsing or validation; all vocabulary tables must be statically embedded.
- Avoid treating Schema.org validation warnings as errors when assessing search rich result eligibility.

## 4. Reusable Intelligence Promoted
- Contributed to **Rule 1626**: Dual-Format Structured Data Extraction & Context Decoupling Invariant.
