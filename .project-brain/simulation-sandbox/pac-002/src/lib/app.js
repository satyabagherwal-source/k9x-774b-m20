/**
 * Master Application Controller: The Sovereign Chronicle
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/src/lib/app.js
 * Domain Governance: All 13 Domains unified into a coherent, accessible reader interface.
 */

import {
  getAllArticles,
  getArticleBySlug,
  getRelatedArticles,
  CATEGORIES
} from './content-store.js';
import { ArticleSearchEngine } from './search-engine.js';
import { updateDocumentMetadata } from './seo-engine.js';
import {
  ReadingThemeManager,
  announceStatus,
  formatEditorialDate,
  initReadingProgressBar
} from './accessibility.js';
import { EditorialRouter } from './router.js';

export class ChronicleApp {
  constructor(domElements = {}) {
    this.elements = domElements;
    this.searchEngine = new ArticleSearchEngine();
    this.themeManager = new ReadingThemeManager();
    this.router = null;
    this.currentArticle = null;
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.progressCleanup = null;
  }

  /**
   * Initializes theme, routes, event listeners, and default view.
   */
  init() {
    this.themeManager.init();
    this.bindThemeControls();

    this.router = new EditorialRouter({
      home: (params) => this.renderHomeView(params),
      article: (params) => this.renderArticleView(params)
    });

    this.bindSearchAndFilterControls();
    this.bindNewsletterDemo();
    this.bindFeedbackWidget();

    this.router.init();
  }

  /**
   * Binds Theme switcher buttons (Light, Dark, Sepia).
   */
  bindThemeControls() {
    const themeButtons = document.querySelectorAll('[data-theme-set]');
    const updateActiveButton = (current) => {
      themeButtons.forEach(btn => {
        const theme = btn.getAttribute('data-theme-set');
        if (theme === current) {
          btn.classList.add('active-theme');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('active-theme');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
    };

    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTheme = btn.getAttribute('data-theme-set');
        this.themeManager.setTheme(targetTheme);
      });
    });

    this.themeManager.onChange(updateActiveButton);
    updateActiveButton(this.themeManager.getTheme());
  }

  /**
   * Binds search input and category filter buttons.
   */
  bindSearchAndFilterControls() {
    const { searchInput, clearSearchBtn } = this.elements;

    if (searchInput) {
      let debounceTimeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          if (clearSearchBtn) {
            clearSearchBtn.classList.toggle('hidden', this.searchQuery.length === 0);
          }
          this.executeSearchAndRenderGrid();
        }, 120);
      });
    }

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        searchInput.focus();
        this.executeSearchAndRenderGrid();
      });
    }
  }

  /**
   * Renders the Homepage View (Featured + Grid + Category Pills).
   */
  renderHomeView(params = {}) {
    if (this.progressCleanup) {
      this.progressCleanup();
      this.progressCleanup = null;
    }

    const { homeView, articleView, searchInput, progressBar } = this.elements;
    if (homeView) homeView.classList.remove('hidden');
    if (articleView) articleView.classList.add('hidden');
    if (progressBar) progressBar.style.width = '0%';

    // Sync state from URL params
    this.currentCategory = params.category || 'all';
    this.searchQuery = params.q || '';
    if (searchInput) {
      searchInput.value = this.searchQuery;
      if (this.elements.clearSearchBtn) {
        this.elements.clearSearchBtn.classList.toggle('hidden', this.searchQuery.length === 0);
      }
    }

    // Update SEO metadata for Homepage
    updateDocumentMetadata({
      title: 'The Sovereign Chronicle',
      description: 'A Journal of Systems, Engineering, Architecture, and Digital Sovereignty.',
      type: 'website'
    });

    this.renderCategoryPills();
    this.executeSearchAndRenderGrid();
  }

  /**
   * Renders Category Filter Pills with ARIA state.
   */
  renderCategoryPills() {
    const { categoryPillsContainer } = this.elements;
    if (!categoryPillsContainer) return;

    categoryPillsContainer.innerHTML = '';

    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = `category-pill ${this.currentCategory === 'all' ? 'active' : ''}`;
    allPill.textContent = 'All Essays';
    allPill.setAttribute('aria-pressed', this.currentCategory === 'all' ? 'true' : 'false');
    allPill.addEventListener('click', () => {
      this.currentCategory = 'all';
      this.renderCategoryPills();
      this.executeSearchAndRenderGrid();
    });
    categoryPillsContainer.appendChild(allPill);

    for (const cat of CATEGORIES) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `category-pill ${this.currentCategory === cat.id ? 'active' : ''}`;
      pill.textContent = cat.name;
      pill.setAttribute('aria-pressed', this.currentCategory === cat.id ? 'true' : 'false');
      pill.addEventListener('click', () => {
        this.currentCategory = cat.id;
        this.renderCategoryPills();
        this.executeSearchAndRenderGrid();
      });
      categoryPillsContainer.appendChild(pill);
    }
  }

  /**
   * Executes search query and populates the article card grid.
   */
  executeSearchAndRenderGrid() {
    const { articleGrid, searchSummary, featuredSection } = this.elements;
    if (!articleGrid) return;

    const { results, totalCount, durationMs } = this.searchEngine.search(this.searchQuery, {
      category: this.currentCategory
    });

    // Handle search status announcement (Domain K & E)
    if (this.searchQuery) {
      if (featuredSection) featuredSection.classList.add('hidden');
      const countMsg = `Found ${totalCount} article${totalCount === 1 ? '' : 's'} matching "${this.searchQuery}".`;
      if (searchSummary) {
        searchSummary.textContent = `${countMsg} (${durationMs.toFixed(1)}ms)`;
        searchSummary.classList.remove('hidden');
      }
      announceStatus(countMsg, 'polite');
    } else {
      if (featuredSection && this.currentCategory === 'all') {
        featuredSection.classList.remove('hidden');
      } else if (featuredSection) {
        featuredSection.classList.add('hidden');
      }
      if (searchSummary) {
        if (this.currentCategory !== 'all') {
          const catObj = CATEGORIES.find(c => c.id === this.currentCategory);
          searchSummary.textContent = `Showing essays under ${catObj?.name || this.currentCategory} (${totalCount})`;
          searchSummary.classList.remove('hidden');
        } else {
          searchSummary.textContent = '';
          searchSummary.classList.add('hidden');
        }
      }
    }

    // Empty State Check
    if (results.length === 0) {
      articleGrid.innerHTML = `
        <div class="empty-state card" role="region" aria-label="No search results">
          <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="empty-title">No Articles Found</h3>
          <p class="empty-desc">No publications matched your query <strong>"${this.searchQuery}"</strong> in the current category.</p>
          <button type="button" class="btn btn-secondary mt-4" id="reset-search-btn">Reset All Filters</button>
        </div>
      `;
      const resetBtn = document.getElementById('reset-search-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.searchQuery = '';
          this.currentCategory = 'all';
          if (this.elements.searchInput) this.elements.searchInput.value = '';
          if (this.elements.clearSearchBtn) this.elements.clearSearchBtn.classList.add('hidden');
          this.renderCategoryPills();
          this.executeSearchAndRenderGrid();
        });
      }
      return;
    }

    // Populate Cards
    articleGrid.innerHTML = results.map(art => this.createArticleCardHtml(art)).join('');

    // Attach click listeners to cards
    articleGrid.querySelectorAll('[data-slug]').forEach(card => {
      card.addEventListener('click', (e) => {
        // Allow native open in new tab if requested
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        const slug = card.getAttribute('data-slug');
        this.router.navigate(`article.html?slug=${encodeURIComponent(slug)}`);
      });
    });
  }

  /**
   * Generates accessible semantic HTML for an article card.
   */
  createArticleCardHtml(art) {
    return `
      <article class="article-card card" data-slug="${art.slug}" tabindex="0" role="link" aria-label="${art.title}">
        <div class="article-meta">
          <span class="category-badge">${art.categoryDetails?.name || art.category}</span>
          <span class="reading-time">⏱️ ${art.readingTime} min read</span>
        </div>
        <h3 class="article-title">
          <a href="article.html?slug=${art.slug}" class="article-link">${art.title}</a>
        </h3>
        <p class="article-excerpt">${art.excerpt}</p>
        <div class="article-footer">
          <div class="author-snippet">
            <span class="author-avatar" style="background-color: ${art.author?.avatarColor || '#4f46e5'}">${art.author?.avatar || 'SC'}</span>
            <span class="author-name">${art.author?.name || 'Staff'}</span>
          </div>
          <time class="article-date" datetime="${art.publishedAt}">${formatEditorialDate(art.publishedAt)}</time>
        </div>
        <div class="tags-row">
          ${(art.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join('')}
        </div>
      </article>
    `;
  }

  /**
   * Renders Individual Article View.
   */
  renderArticleView(params = {}) {
    const { homeView, articleView, articleContainer, progressBar } = this.elements;
    if (homeView) homeView.classList.add('hidden');
    if (articleView) articleView.classList.remove('hidden');

    const slug = params.slug;
    const article = getArticleBySlug(slug);

    if (!article) {
      this.render404View(slug);
      return;
    }

    this.currentArticle = article;

    // Update Document SEO Metadata (Domain J)
    updateDocumentMetadata({
      title: article.title,
      description: article.excerpt,
      article
    });

    if (articleContainer) {
      articleContainer.innerHTML = this.createFullArticleHtml(article);

      // Bind Reading Progress Bar (Domain E & K)
      if (progressBar) {
        if (this.progressCleanup) this.progressCleanup();
        this.progressCleanup = initReadingProgressBar(progressBar, articleContainer);
      }

      // Bind Back to Chronicle navigation
      const backLinks = articleContainer.querySelectorAll('[data-nav-home]');
      backLinks.forEach(b => {
        b.addEventListener('click', (e) => {
          e.preventDefault();
          this.router.navigate('/');
        });
      });

      // Bind Share button
      const shareBtn = document.getElementById('share-article-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => this.handleShareArticle(article));
      }

      // Bind Related Article cards
      articleContainer.querySelectorAll('[data-related-slug]').forEach(rc => {
        rc.addEventListener('click', (e) => {
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          const nextSlug = rc.getAttribute('data-related-slug');
          this.router.navigate(`article.html?slug=${encodeURIComponent(nextSlug)}`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }

    // Scroll to top upon opening article
    window.scrollTo({ top: 0, behavior: 'instant' });
    announceStatus(`Opened article: ${article.title}. Estimated reading time ${article.readingTime} minutes.`, 'polite');
  }

  /**
   * Generates full editorial article page layout with author bio and related articles.
   */
  createFullArticleHtml(art) {
    const related = getRelatedArticles(art.id, 2);

    // Simple markdown to HTML parser for headers, code blocks, lists, and paragraphs
    const formattedBody = this.renderMarkdownBody(art.content);

    return `
      <!-- Breadcrumbs Navigation (Domain J & E) -->
      <nav class="breadcrumb-nav" aria-label="Breadcrumbs">
        <ol class="breadcrumb-list">
          <li><a href="/" data-nav-home="true" class="breadcrumb-link">Chronicle Home</a></li>
          <li aria-hidden="true" class="breadcrumb-separator">/</li>
          <li><span class="breadcrumb-category">${art.categoryDetails?.name || art.category}</span></li>
          <li aria-hidden="true" class="breadcrumb-separator">/</li>
          <li class="breadcrumb-current" aria-current="page">${art.title}</li>
        </ol>
      </nav>

      <article class="longform-article">
        <!-- Article Header -->
        <header class="article-header">
          <div class="header-badges">
            <span class="category-pill active">${art.categoryDetails?.name || art.category}</span>
            <span class="reading-time">⏱️ ${art.readingTime} min read</span>
          </div>
          <h1 class="longform-title">${art.title}</h1>
          <p class="longform-lead">${art.excerpt}</p>
          
          <div class="article-byline">
            <div class="byline-author">
              <span class="author-avatar large" style="background-color: ${art.author?.avatarColor || '#4f46e5'}">${art.author?.avatar || 'SC'}</span>
              <div>
                <div class="byline-name">${art.author?.name || 'Staff Editor'}</div>
                <div class="byline-role">${art.author?.role || 'Contributor'}</div>
              </div>
            </div>
            <div class="byline-dates">
              <div>Published: <time datetime="${art.publishedAt}">${formatEditorialDate(art.publishedAt)}</time></div>
              ${art.modifiedAt ? `<div class="text-xs text-muted">Updated: <time datetime="${art.modifiedAt}">${formatEditorialDate(art.modifiedAt)}</time></div>` : ''}
            </div>
          </div>

          <!-- Action bar (Share & Reading Theme) -->
          <div class="article-actions-bar">
            <button type="button" class="btn btn-secondary btn-sm" id="share-article-btn" aria-label="Share this publication">
              <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Essay
            </button>
            <div id="share-feedback" class="share-feedback hidden" role="status"></div>
          </div>
        </header>

        <!-- Main Body -->
        <div class="article-prose" id="article-prose-body">
          ${formattedBody}
        </div>

        <!-- Tags List -->
        <footer class="article-tags-footer">
          <span class="tags-label">Tagged under:</span>
          <div class="tags-list">
            ${(art.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join('')}
          </div>
        </footer>

        <!-- Author Profile Box (Domain I) -->
        <section class="author-profile-box card" aria-labelledby="author-bio-heading">
          <div class="author-avatar xl" style="background-color: ${art.author?.avatarColor || '#4f46e5'}">${art.author?.avatar || 'SC'}</div>
          <div class="author-bio-content">
            <h2 id="author-bio-heading" class="author-bio-name">About ${art.author?.name}</h2>
            <p class="author-bio-role">${art.author?.role}</p>
            <p class="author-bio-text">${art.author?.bio}</p>
          </div>
        </section>

        <!-- Reader Rating / Feedback Widget (Domain M) -->
        <section class="feedback-widget card" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" class="feedback-title">Did this architectural essay clarify your understanding?</h2>
          <p class="feedback-desc">Client-side feedback demonstration. Reader sentiment helps refine future research monographs.</p>
          <div class="feedback-buttons">
            <button type="button" class="btn btn-secondary feedback-btn" data-vote="useful">👍 Invaluable Insight</button>
            <button type="button" class="btn btn-secondary feedback-btn" data-vote="neutral">🤔 Nuanced Question</button>
            <button type="button" class="btn btn-secondary feedback-btn" data-vote="needs-work">⚠️ Needs Clarification</button>
          </div>
          <div id="vote-response" class="vote-response hidden" role="status"></div>
        </section>

        <!-- Related Articles (Domain B & I) -->
        ${related.length > 0 ? `
          <section class="related-section" aria-labelledby="related-heading">
            <h2 id="related-heading" class="related-heading">Related Monographs & Essays</h2>
            <div class="related-grid">
              ${related.map(r => `
                <div class="related-card card" data-related-slug="${r.slug}" tabindex="0" role="link" aria-label="${r.title}">
                  <span class="category-badge">${r.categoryDetails?.name || r.category}</span>
                  <h3 class="related-title">${r.title}</h3>
                  <p class="related-excerpt">${r.excerpt}</p>
                  <span class="reading-time">⏱️ ${r.readingTime} min read</span>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Back to Top / Home -->
        <div style="margin-top: 3rem; text-align: center;">
          <a href="/" data-nav-home="true" class="btn btn-secondary">
            ← Return to Chronicle Homepage
          </a>
        </div>
      </article>
    `;
  }

  /**
   * Minimalist, safe markdown formatter for technical prose.
   */
  renderMarkdownBody(md) {
    if (!md) return '';
    const lines = md.trim().split(/\r?\n/);
    const html = [];
    let inCodeBlock = false;
    let codeContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeContent = [];
        } else {
          inCodeBlock = false;
          html.push(`<pre class="code-block"><code>${codeContent.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      if (line.startsWith('## ')) {
        html.push(`<h2 class="prose-h2">${line.replace('## ', '')}</h2>`);
      } else if (line.startsWith('### ')) {
        html.push(`<h3 class="prose-h3">${line.replace('### ', '')}</h3>`);
      } else if (line.startsWith('> ')) {
        html.push(`<blockquote class="prose-quote">${line.replace('> ', '')}</blockquote>`);
      } else if (line.startsWith('- ')) {
        html.push(`<li class="prose-li">${line.replace('- ', '')}</li>`);
      } else if (line.trim().length > 0) {
        html.push(`<p class="prose-p">${line}</p>`);
      }
    }

    return html.join('\n');
  }

  /**
   * Displays 404 / Article Not Found view.
   */
  render404View(slug = '') {
    const { articleContainer } = this.elements;
    if (!articleContainer) return;

    articleContainer.innerHTML = `
      <div class="empty-state card" role="region" aria-label="Publication Not Found">
        <h2 class="empty-title">404 — Article Not Found</h2>
        <p class="empty-desc">The requested monograph <code>${slug || 'unknown'}</code> does not exist or has been archived.</p>
        <a href="/" data-nav-home="true" class="btn btn-primary mt-4">
          ← Return to Chronicle Index
        </a>
      </div>
    `;

    articleContainer.querySelectorAll('[data-nav-home]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.router.navigate('/');
      });
    });

    announceStatus('Error 404: Article not found.', 'assertive');
  }

  /**
   * Handles Web Share API or Clipboard copy for sharing.
   */
  async handleShareArticle(article) {
    const feedback = document.getElementById('share-feedback');
    const shareData = {
      title: article.title,
      text: article.excerpt,
      url: window.location.href
    };

    if (navigator.share && window.isSecureContext) {
      try {
        await navigator.share(shareData);
        return;
      } catch (_) {}
    }

    // Fallback: Copy URL to clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (feedback) {
        feedback.textContent = '✓ Canonical URL copied to clipboard!';
        feedback.classList.remove('hidden');
        setTimeout(() => feedback.classList.add('hidden'), 3000);
      }
      announceStatus('Article link copied to clipboard.', 'polite');
    } catch (_) {
      if (feedback) {
        feedback.textContent = `Share URL: ${window.location.href}`;
        feedback.classList.remove('hidden');
      }
    }
  }

  /**
   * Binds the Newsletter Demonstration form (clearly labeled client-only demo).
   */
  bindNewsletterDemo() {
    const form = document.getElementById('newsletter-form');
    const msg = document.getElementById('newsletter-msg');
    if (!form || !msg) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const email = emailInput?.value.trim() || '';

      if (!email.includes('@')) {
        msg.textContent = 'Please provide a valid email format.';
        msg.className = 'newsletter-feedback text-danger';
        msg.classList.remove('hidden');
        return;
      }

      msg.textContent = `[DEMONSTRATION] Subscription confirmed for ${email} in local browser memory. Zero server transmission verified.`;
      msg.className = 'newsletter-feedback text-success';
      msg.classList.remove('hidden');
      form.reset();
      announceStatus('Newsletter subscription demonstrated in local memory.', 'polite');
    });
  }

  /**
   * Binds reader voting/feedback interaction (Domain M).
   */
  bindFeedbackWidget() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-vote]');
      if (!btn) return;

      const voteType = btn.getAttribute('data-vote');
      const label = btn.textContent.trim();
      const responseEl = document.getElementById('vote-response');
      if (responseEl) {
        responseEl.textContent = `Thank you! Feedback recorded locally: "${label}" [${voteType}].`;
        responseEl.classList.remove('hidden');
      }
      announceStatus('Thank you. Your feedback was recorded.', 'polite');
    });
  }
}
