# Forensic Learning Dossier: postlight/parser

## 1. Metadata & Source Provenance
- **Repository**: [postlight/parser](https://github.com/postlight/parser)
- **Commit SHA**: `57df895171dfebac03b1e3895e7bbce9c4e8b340`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Content extraction engine extracting clean article text, title, author, and published date from messy HTML.

## 2. Core Architectural Mechanisms
1. **Boilerplate Stripping Algorithm**:
   - Eliminates navigation menus, sidebar widgets, footer links, and advertising blocks to isolate the primary content container.
   - Calculates text-to-HTML density ratios to identify article boundaries, mirroring search engine main-content parsers.
2. **Metadata Normalization**:
   - Falls back gracefully through OpenGraph, Twitter, Schema.org, and standard HTML meta tags to extract canonical titles and author names.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Search engine crawlers misidentifying cookie banners or sidebar text as the main page content.
- **Failure Mode 2**: Low text-to-code ratio triggering thin-content indexing penalties.
