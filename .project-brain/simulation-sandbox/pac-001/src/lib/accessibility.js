/**
 * Accessibility & ARIA Announcement Controller
 * 
 * Location: .project-brain/simulation-sandbox/pac-001/src/lib/accessibility.js
 * Domain Governance: Domain E (Creative Intelligence)
 * Provenance: Derived from lucide-icons/lucide a11y prop conventions and WAI-ARIA authoring practices
 */

/**
 * Sends a polite or assertive status announcement to screen readers.
 * 
 * @param {string} message - Announcement text
 * @param {'polite'|'assertive'} [priority='polite'] - ARIA live priority
 */
export function announceStatus(message, priority = 'polite') {
  if (typeof document === 'undefined') return;

  let liveRegion = document.getElementById('aria-live-announcer');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-announcer';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }

  liveRegion.setAttribute('aria-live', priority);
  // Clear first to trigger change detection in assistive tech
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 50);
}

/**
 * Formats byte size into human-readable string.
 * @param {number} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

