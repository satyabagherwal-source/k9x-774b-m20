/**
 * Accessibility, Theme Management & Screen Reader Utilities
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/src/lib/accessibility.js
 * Domain Governance: Domain E (Creative) & Domain K (Quality & Verification)
 * 
 * Provides:
 * - WCAG 2.1 AA live announcements.
 * - Tri-Theme reading mode manager (Light, Dark, Sepia).
 * - Scroll-based reading progress indicator.
 * - Accessible date and time formatters.
 */

const THEME_STORAGE_KEY = 'pac002_reading_theme';

/**
 * Announces status update to screen readers via ARIA live region.
 * 
 * @param {string} message 
 * @param {'polite' | 'assertive'} priority 
 */
export function announceStatus(message, priority = 'polite') {
  if (typeof document === 'undefined') return;

  let announcer = document.getElementById('aria-live-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'aria-live-announcer';
    announcer.className = 'sr-only';
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcer);
  } else {
    announcer.setAttribute('aria-live', priority);
  }

  // Clear and update to ensure screen reader triggers on identical repeat messages
  announcer.textContent = '';
  setTimeout(() => {
    announcer.textContent = message;
  }, 50);
}

/**
 * Initializes and manages Reading Theme (light, dark, sepia).
 */
export class ReadingThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.listeners = new Set();
  }

  init() {
    if (typeof window === 'undefined') return;

    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (_) {}

    // Default to dark or user system preference
    if (!savedTheme) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        savedTheme = 'light';
      } else {
        savedTheme = 'dark';
      }
    }

    this.setTheme(savedTheme, false);
  }

  setTheme(themeName, announce = true) {
    const validThemes = ['light', 'dark', 'sepia'];
    const chosen = validThemes.includes(themeName) ? themeName : 'dark';
    this.currentTheme = chosen;

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', chosen);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, chosen);
      } catch (_) {}
    }

    if (announce) {
      announceStatus(`Reading theme switched to ${chosen} mode.`, 'polite');
    }

    for (const cb of this.listeners) {
      cb(chosen);
    }
  }

  getTheme() {
    return this.currentTheme;
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

/**
 * Attaches reading progress bar listener to window scroll.
 * 
 * @param {HTMLElement} progressBarElement 
 * @param {HTMLElement} contentContainerElement 
 * @returns {() => void} Cleanup function
 */
export function initReadingProgressBar(progressBarElement, contentContainerElement) {
  if (typeof window === 'undefined' || !progressBarElement || !contentContainerElement) {
    return () => {};
  }

  const handleScroll = () => {
    const rect = contentContainerElement.getBoundingClientRect();
    const totalHeight = rect.height - window.innerHeight;
    if (totalHeight <= 0) {
      progressBarElement.style.width = '100%';
      progressBarElement.setAttribute('aria-valuenow', '100');
      return;
    }

    const scrolled = -rect.top;
    const percent = Math.min(100, Math.max(0, Math.round((scrolled / totalHeight) * 100)));
    progressBarElement.style.width = `${percent}%`;
    progressBarElement.setAttribute('aria-valuenow', String(percent));
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  return () => window.removeEventListener('scroll', handleScroll);
}

/**
 * Formats ISO date string to human-friendly editorial format (e.g. "November 2, 2026").
 * 
 * @param {string} isoString 
 * @returns {string}
 */
export function formatEditorialDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (_) {
    return isoString;
  }
}

