# Forensic Learning Dossier: google/robotstxt

## 1. Metadata & Source Provenance
- **Repository**: [google/robotstxt](https://github.com/google/robotstxt)
- **Commit SHA**: `22b355ff855419e6a3ff8ff09c0ad7fdb17116f9`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Google's production C++ library implementing the Robots Exclusion Protocol (RFC 9309).

## 2. Core Architectural Mechanisms
1. **Longest-Match Rule Precedence Invariant**:
   - When a URL matches both an `Allow:` and a `Disallow:` directive:
     - The directive with the longer matching path pattern takes precedence.
     - If both matching paths have identical length, `Allow:` wins!
2. **Pattern Matching Grammar**:
   - Wildcard `*` matches 0 or more characters.
   - Anchor `$` matches the exact end of the URL.
   - Trailing slash rule: `Disallow: /admin/` matches `/admin/page`, but does NOT match `/admin-dashboard`.
3. **500KB Parser Truncation Boundary**:
   - Googlebot enforces a strict 500 Kibibytes (512,000 bytes) limit on `robots.txt`.
   - Characters beyond the 500KB boundary are discarded, which can accidentally unblock disallowed paths!

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Giant `robots.txt` files (>500KB) causing truncation and accidental public disclosure of confidential directories.
- **Failure Mode 2**: `Disallow: /` overriding specific `Allow:` directives due to misunderstood precedence rules.
