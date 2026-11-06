/**
 * Lightweight Client-Side Routing & Navigation Controller
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/src/lib/router.js
 * Domain Governance: Domain G (Architecture) & Domain H (Technical Construction)
 * 
 * Provides:
 * - Query parameter and hash routing without full page reload where possible.
 * - Article detail navigation (`?slug=...` or `/article.html?slug=...`).
 * - Category filter navigation (`?category=...`).
 * - Search query URL synchronization (`?q=...`).
 * - Browser History API integration (back/forward button compatibility).
 */

export class EditorialRouter {
  constructor(routes = {}) {
    this.routes = routes;
    this.currentRoute = null;
    this.currentParams = {};
  }

  init() {
    if (typeof window === 'undefined') return;

    window.addEventListener('popstate', () => this.handleLocationChange());
    this.handleLocationChange();
  }

  /**
   * Parses current window location into route name and query parameters.
   */
  parseLocation() {
    if (typeof window === 'undefined') return { route: 'home', params: {} };

    const searchParams = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    const params = {};
    for (const [key, val] of searchParams.entries()) {
      params[key] = val;
    }

    // Hash overrides
    if (hash.startsWith('#/article/') || hash.startsWith('#article/')) {
      params.slug = hash.replace(/^#\/?article\//, '');
      return { route: 'article', params };
    }
    if (hash.startsWith('#/category/') || hash.startsWith('#category/')) {
      params.category = hash.replace(/^#\/?category\//, '');
      return { route: 'home', params };
    }

    // Pathname or query parameter routing
    if (pathname.includes('article') || params.slug) {
      return { route: 'article', params };
    }

    return { route: 'home', params };
  }

  handleLocationChange() {
    const { route, params } = this.parseLocation();
    this.currentRoute = route;
    this.currentParams = params;

    const handler = this.routes[route] || this.routes.home;
    if (typeof handler === 'function') {
      handler(params);
    }
  }

  /**
   * Navigates programmatically to a new route.
   * 
   * @param {string} url 
   * @param {boolean} replace 
   */
  navigate(url, replace = false) {
    if (typeof window === 'undefined') return;

    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
    this.handleLocationChange();
  }
}
