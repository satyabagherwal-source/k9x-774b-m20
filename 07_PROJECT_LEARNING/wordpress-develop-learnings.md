# Forensic Learning Dossier: WordPress/wordpress-develop

## 1. Metadata & Source Provenance
- **Repository**: [WordPress/wordpress-develop](https://github.com/WordPress/wordpress-develop)
- **Commit SHA**: `17a6ba237223479d44342c7824916b8e39a35179`
- **License**: GNU General Public License v2 or later
- **Audit Date**: 2026-10-16
- **Architecture**: The core open-source WordPress software governing search engine standards for over 40% of the world wide web.

## 2. Core Architectural Mechanisms
1. **The `wp_robots()` Filter Pipeline (`general-template.php`)**:
   - Introduced in WordPress 5.7 to standardize search directives.
   - Outputs `<meta name="robots" content="...">` by executing registered filter callbacks.
   - Enforces default modern directives: `max-image-preview:large`, `max-snippet:-1`, `max-video-preview:-1`.
   - Automatically handles `noindex, nofollow` when the "Discourage search engines" site setting is enabled.
2. **Core XML Sitemaps Infrastructure (`wp-includes/sitemaps/`)**:
   - Built-in dynamic XML sitemap index: `/wp-sitemap.xml`.
   - Automatically partitions content by post types, taxonomies, and users into chunked sitemaps: `/wp-sitemap-posts-post-1.xml`, `/wp-sitemap-taxonomies-category-1.xml`.
   - Filters out unpublished, private, and password-protected posts automatically.
3. **Canonical Calculation (`wp_get_canonical_url()`)**:
   - Resolves canonical URLs using the permanent permalink structure, taking into account pagination (`/page/2/`), comments pagination, and HTTPS scheme enforcement.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Small, cropped preview thumbnails on Google Discover and social networks. Defended by default `max-image-preview:large` in `wp_robots()`.
- **Failure Mode 2**: Sitemap inclusion of private or draft posts. Defended by strict post status filters in `WP_Sitemaps_Posts`.
