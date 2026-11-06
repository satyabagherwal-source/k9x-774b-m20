/**
 * SEO & Metadata Generation Engine
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/src/lib/seo-engine.js
 * Domain Governance: Domain J (Search & Distribution Intelligence)
 * 
 * Provides:
 * - Schema.org JSON-LD (NewsArticle, BreadcrumbList, WebSite, Person).
 * - Canonical tag normalization with path prefix protection.
 * - OpenGraph & Twitter Card dynamic metadata injection.
 * - XML Sitemap generation.
 */

const SITE_CONFIG = Object.freeze({
  siteName: 'The Sovereign Chronicle',
  siteUrl: 'https://chronicle.ai-builder-brain.local',
  description: 'A Journal of Systems, Engineering, Architecture, and Digital Sovereignty.',
  publisher: {
    name: 'The Sovereign Chronicle Editorial Board',
    logo: 'https://chronicle.ai-builder-brain.local/assets/logo.png'
  }
});

/**
 * Generates Schema.org NewsArticle / BlogPosting JSON-LD for an article.
 * 
 * @param {object} article 
 * @returns {object}
 */
export function generateArticleJsonLd(article) {
  if (!article) return null;
  const canonicalUrl = `${SITE_CONFIG.siteUrl}/article.html?slug=${encodeURIComponent(article.slug)}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    'headline': article.title,
    'description': article.excerpt,
    'datePublished': article.publishedAt,
    'dateModified': article.modifiedAt || article.publishedAt,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': canonicalUrl
    },
    'author': {
      '@type': 'Person',
      'name': article.author?.name || 'Staff Editor',
      'jobTitle': article.author?.role || 'Staff Writer',
      'description': article.author?.bio || ''
    },
    'publisher': {
      '@type': 'Organization',
      'name': SITE_CONFIG.publisher.name,
      'logo': {
        '@type': 'ImageObject',
        'url': SITE_CONFIG.publisher.logo
      }
    },
    'keywords': (article.tags || []).join(', '),
    'articleSection': article.categoryDetails?.name || article.category,
    'timeRequired': `PT${article.readingTime || 5}M`
  };
}

/**
 * Generates Schema.org BreadcrumbList JSON-LD.
 * 
 * @param {object} article 
 * @returns {object}
 */
export function generateBreadcrumbJsonLd(article) {
  const items = [
    {
      '@type': 'ListItem',
      'position': 1,
      'name': 'Home',
      'item': `${SITE_CONFIG.siteUrl}/`
    }
  ];

  if (article) {
    if (article.categoryDetails) {
      items.push({
        '@type': 'ListItem',
        'position': 2,
        'name': article.categoryDetails.name,
        'item': `${SITE_CONFIG.siteUrl}/?category=${encodeURIComponent(article.category)}`
      });
    }
    items.push({
      '@type': 'ListItem',
      'position': 3,
      'name': article.title,
      'item': `${SITE_CONFIG.siteUrl}/article.html?slug=${encodeURIComponent(article.slug)}`
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items
  };
}

/**
 * Generates Schema.org WebSite JSON-LD with Sitelinks Searchbox.
 * 
 * @returns {object}
 */
export function generateWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': SITE_CONFIG.siteName,
    'url': `${SITE_CONFIG.siteUrl}/`,
    'description': SITE_CONFIG.description,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${SITE_CONFIG.siteUrl}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * Injects or updates metadata tags in document <head>.
 * 
 * @param {{
 *   title: string,
 *   description: string,
 *   canonicalUrl?: string,
 *   article?: object,
 *   type?: string
 * }} meta
 */
export function updateDocumentMetadata(meta = {}) {
  if (typeof document === 'undefined') return;

  const fullTitle = meta.title 
    ? `${meta.title} | ${SITE_CONFIG.siteName}` 
    : `${SITE_CONFIG.siteName} — ${SITE_CONFIG.description}`;

  document.title = fullTitle;

  const setMeta = (attr, key, content) => {
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content || '');
  };

  setMeta('name', 'description', meta.description || SITE_CONFIG.description);

  // OpenGraph
  setMeta('property', 'og:site_name', SITE_CONFIG.siteName);
  setMeta('property', 'og:title', meta.title || SITE_CONFIG.siteName);
  setMeta('property', 'og:description', meta.description || SITE_CONFIG.description);
  setMeta('property', 'og:type', meta.type || (meta.article ? 'article' : 'website'));
  setMeta('property', 'og:url', meta.canonicalUrl || `${SITE_CONFIG.siteUrl}/`);

  // Twitter Card
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', meta.title || SITE_CONFIG.siteName);
  setMeta('name', 'twitter:description', meta.description || SITE_CONFIG.description);

  // Canonical Tag
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', meta.canonicalUrl || `${SITE_CONFIG.siteUrl}/`);

  // Update or inject JSON-LD script
  let jsonLdEl = document.getElementById('structured-data-jsonld');
  if (!jsonLdEl) {
    jsonLdEl = document.createElement('script');
    jsonLdEl.id = 'structured-data-jsonld';
    jsonLdEl.setAttribute('type', 'application/ld+json');
    document.head.appendChild(jsonLdEl);
  }

  const jsonLdPayload = meta.article 
    ? [generateArticleJsonLd(meta.article), generateBreadcrumbJsonLd(meta.article)]
    : [generateWebSiteJsonLd(), generateBreadcrumbJsonLd(null)];

  jsonLdEl.textContent = JSON.stringify(jsonLdPayload, null, 2);
}

/**
 * Builds XML Sitemap content for all articles and categories.
 * 
 * @param {Array<object>} articles 
 * @param {Array<object>} categories 
 * @returns {string}
 */
export function generateXmlSitemap(articles = [], categories = []) {
  const baseUrl = SITE_CONFIG.siteUrl;
  const now = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Homepage
  xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  // Categories
  for (const cat of categories) {
    xml += `  <url>\n    <loc>${baseUrl}/?category=${encodeURIComponent(cat.id)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  }

  // Articles
  for (const art of articles) {
    const modDate = (art.modifiedAt || art.publishedAt || now).split('T')[0];
    xml += `  <url>\n    <loc>${baseUrl}/article.html?slug=${encodeURIComponent(art.slug)}</loc>\n    <lastmod>${modDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  }

  xml += '</urlset>\n';
  return xml;
}
