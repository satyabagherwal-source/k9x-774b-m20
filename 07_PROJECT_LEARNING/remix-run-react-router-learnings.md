# Forensic Learning Dossier: remix-run/react-router

## 1. Metadata & Source Provenance
- **Repository**: [remix-run/react-router](https://github.com/remix-run/react-router) (Remix / React Router v7)
- **Commit SHA**: `90d815774b76df4da81b37f2dc0ea1cfa44d5c9d`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Modern full-stack React framework with route-level metadata functions and SSR streaming.

## 2. Core Architectural Mechanisms
1. **Route-Level `MetaFunction` Architecture**:
   - Each route module exports a `meta` function: `export const meta: MetaFunction<typeof loader> = ({ data, matches }) => [...]`.
   - Receives strongly-typed loader data, allowing SEO tags (canonical, title, schema, OG image) to be derived directly from server database queries without client-side state latency.
2. **Parent-Child Meta Inheritance (`matches`)**:
   - Child routes can inspect parent route metadata via `matches`, enabling inheritance of brand names, OpenGraph site names, or parent canonical URLs while selectively overriding page-specific titles.
3. **SSR Head Streaming (`<Meta />`)**:
   - The `<Meta />` component compiles route meta definitions directly into the initial server HTML stream before client hydration occurs.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Rendering blank placeholder titles while waiting for client-side API fetch. Defended by coupling metadata generation directly to server loaders.
- **Failure Mode 2**: Duplicate or conflicting meta tags across nested layout hierarchies. Defended by array-based tag descriptor structure.
