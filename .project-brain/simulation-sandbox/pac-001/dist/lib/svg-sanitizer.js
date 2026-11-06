/**
 * SVG Sanitizer & Safe XML Parser
 * 
 * Location: .project-brain/simulation-sandbox/pac-001/src/lib/svg-sanitizer.js
 * Domain Governance: Domain I (Content & Information Intelligence) & Domain K (Quality & Verification)
 * Provenance: Derived from lucky-media/astro-seo and OWASP SVG Sanitizer guidelines
 * 
 * Invariants:
 * 1. Environment-Agnostic Byte Sizing: Uses TextEncoder (or Node Buffer / Blob fallback) without hard Node.js dependencies.
 * 2. Blocks XML Entity Expansion: Fails closed on any DOCTYPE or ENTITY declaration (XXE / Billion Laughs protection).
 * 3. Prunes all active and executable elements:
 *    - Scripts: <script>
 *    - SMIL Animations (SEC-01): <set>, <animate>, <animateTransform>, <animateMotion>, <discard>
 *    - Embedded sub-documents: <foreignObject>, <iframe>, <embed>, <object>, <base>, <meta>, <link>, <applet>
 * 4. ReDoS-Immune Attribute Cleaning (SEC-02): Linear-time word-boundary attribute scanning preventing catastrophic backtracking.
 * 5. Strips all inline event handlers (/^on[a-z0-9_-]+/i).
 * 6. Nested SVG & Script URI Policy (SEC-03): Disallows javascript:, data:text/html, data:image/svg, and external HTTP/HTTPS tracking links.
 * 7. Dual Engine: Leverages native browser DOMParser & XMLSerializer AST when available, with deterministic linear-time regex fallback in Node.js.
 * 8. Extracts and normalizes coordinate dimensions (viewBox, width, height).
 */

const MAX_SVG_SIZE_BYTES = 5 * 1024 * 1024; // 5MB safety cap

/**
 * Calculates UTF-8 byte length across Browser DOM and Node.js runtimes.
 * 
 * @param {string} str 
 * @returns {number}
 */
export function getUtf8ByteLength(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf8');
  }
  if (typeof Blob !== 'undefined') {
    return new Blob([str]).size;
  }
  return encodeURI(str).split(/%..|./).length - 1;
}

/**
 * Validates and sanitizes raw SVG text input.
 * Works uniformly in Browser DOM and Node.js environments.
 * 
 * @param {string} rawInput - Untrusted raw SVG string or file text
 * @returns {{
 *   isValid: boolean,
 *   error?: string,
 *   sanitizedSvg?: string,
 *   width: number,
 *   height: number,
 *   viewBox: string
 * }}
 */
export function sanitizeSvg(rawInput) {
  if (typeof rawInput !== 'string') {
    return {
      isValid: false,
      error: 'INVALID_INPUT: Input must be a valid SVG string.',
      width: 0,
      height: 0,
      viewBox: ''
    };
  }

  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'EMPTY_INPUT: Input SVG string is empty.',
      width: 0,
      height: 0,
      viewBox: ''
    };
  }

  // File size barrier (Domain K / Resource Exhaustion Defense)
  if (getUtf8ByteLength(trimmed) > MAX_SVG_SIZE_BYTES) {
    return {
      isValid: false,
      error: 'OVERSIZED_INPUT: SVG exceeds maximum allowed size of 5MB.',
      width: 0,
      height: 0,
      viewBox: ''
    };
  }

  // 1. Defend against XML Entity Expansion / XXE (Domain I Security Invariant)
  if (/<!ENTITY/i.test(trimmed) || /<!DOCTYPE/i.test(trimmed)) {
    return {
      isValid: false,
      error: 'SECURITY_VIOLATION: SVG contains unsafe DOCTYPE ENTITY declarations (XXE protection).',
      width: 0,
      height: 0,
      viewBox: ''
    };
  }

  // 2. Validate root <svg tag existence
  if (!/<svg[\s>]/i.test(trimmed)) {
    return {
      isValid: false,
      error: 'MALFORMED_SVG: No valid <svg> root element found.',
      width: 0,
      height: 0,
      viewBox: ''
    };
  }

  // 3. Browser DOMParser-based AST sanitization when available
  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');

      const parserErrors = doc.getElementsByTagName('parsererror');
      if (parserErrors.length > 0 || doc.documentElement.nodeName.toLowerCase() !== 'svg') {
        return {
          isValid: false,
          error: 'MALFORMED_SVG: XML parser failed to parse SVG markup.',
          width: 0,
          height: 0,
          viewBox: ''
        };
      }

      const svgEl = doc.documentElement;

      // Disallow dangerous elements (case-insensitive localName check)
      // Including SMIL animation elements (SEC-01)
      const forbiddenTags = new Set([
        'script',
        'foreignobject',
        'iframe',
        'embed',
        'object',
        'meta',
        'link',
        'base',
        'applet',
        'set',
        'animate',
        'animatetransform',
        'animatemotion',
        'discard'
      ]);

      const allDescendants = Array.from(svgEl.querySelectorAll('*'));
      for (const el of allDescendants) {
        const localTag = (el.localName || el.tagName || '').toLowerCase();
        if (forbiddenTags.has(localTag)) {
          el.parentNode?.removeChild(el);
        }
      }

      // Sanitize <style> elements containing @import, url(), or expression()
      const styleEls = Array.from(svgEl.querySelectorAll('style'));
      for (const styleEl of styleEls) {
        const text = styleEl.textContent || '';
        if (/(@import|url\s*\(|expression\s*\()/i.test(text)) {
          styleEl.parentNode?.removeChild(styleEl);
        }
      }

      // Sanitize attributes across all remaining elements
      const remainingElements = [svgEl, ...Array.from(svgEl.querySelectorAll('*'))];
      for (const el of remainingElements) {
        const attrsToRemove = [];
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          const attrName = attr.name.toLowerCase();
          const rawAttrVal = attr.value.trim().toLowerCase();
          let decodedVal = rawAttrVal;
          try {
            decodedVal = decodeURIComponent(rawAttrVal);
          } catch (_) {}

          // Strip inline event handlers (onclick, onload, onerror, etc.)
          if (attrName.startsWith('on')) {
            attrsToRemove.push(attr.name);
          }
          // Strip dangerous or external URIs in href and xlink:href (SEC-03)
          else if (attrName === 'href' || attrName === 'xlink:href') {
            if (
              rawAttrVal.startsWith('javascript:') ||
              decodedVal.startsWith('javascript:') ||
              rawAttrVal.includes('data:text/html') ||
              decodedVal.includes('data:text/html') ||
              rawAttrVal.includes('data:image/svg') ||
              decodedVal.includes('data:image/svg') ||
              rawAttrVal.startsWith('http://') ||
              rawAttrVal.startsWith('https://') ||
              rawAttrVal.startsWith('//')
            ) {
              attrsToRemove.push(attr.name);
            }
          }
          // Strip dangerous inline style expressions or external imports
          else if (attrName === 'style') {
            if (
              rawAttrVal.includes('javascript:') ||
              rawAttrVal.includes('expression(') ||
              rawAttrVal.includes('@import') ||
              /url\s*\(\s*['"]?https?:/i.test(rawAttrVal)
            ) {
              attrsToRemove.push(attr.name);
            }
          }
          // Defend against any leftover to/values/from attributes referencing javascript
          else if (attrName === 'to' || attrName === 'values' || attrName === 'from') {
            if (rawAttrVal.includes('javascript:') || decodedVal.includes('javascript:')) {
              attrsToRemove.push(attr.name);
            }
          }
        }
        for (const a of attrsToRemove) {
          el.removeAttribute(a);
        }
      }

      // Extract and normalize dimensions
      let width = 300;
      let height = 150;
      let viewBox = svgEl.getAttribute('viewBox') || '';

      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && !parts.some(isNaN) && parts[2] > 0 && parts[3] > 0) {
          width = Math.round(parts[2]);
          height = Math.round(parts[3]);
        }
      }

      const wAttr = svgEl.getAttribute('width');
      const hAttr = svgEl.getAttribute('height');
      if (wAttr && parseFloat(wAttr) > 0) width = Math.round(parseFloat(wAttr));
      if (hAttr && parseFloat(hAttr) > 0) height = Math.round(parseFloat(hAttr));

      if (!viewBox) {
        viewBox = `0 0 ${width} ${height}`;
        svgEl.setAttribute('viewBox', viewBox);
      }

      const serializer = new XMLSerializer();
      const sanitizedXml = serializer.serializeToString(svgEl);

      return {
        isValid: true,
        sanitizedSvg: sanitizedXml,
        width,
        height,
        viewBox
      };
    } catch (err) {
      return {
        isValid: false,
        error: `PARSER_EXCEPTION: ${err.message}`,
        width: 0,
        height: 0,
        viewBox: ''
      };
    }
  }

  // 4. Node.js / Headless linear-time regex fallback (SEC-02 ReDoS-hardened)
  let sanitized = trimmed;

  // Strip <script> tags and contents (both self-closing and paired)
  sanitized = sanitized.replace(/<script\b[^>]*\/>|<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  // Strip SMIL animation and foreignObject tags (SEC-01)
  sanitized = sanitized.replace(/<(?:foreignObject|set|animate|animateTransform|animateMotion|discard)\b[^>]*\/>|<(?:foreignObject|set|animate|animateTransform|animateMotion|discard)\b[^>]*>[\s\S]*?<\/(?:foreignObject|set|animate|animateTransform|animateMotion|discard)>/gi, '');

  // Strip embedded unsafe tags
  sanitized = sanitized.replace(/<(?:iframe|embed|object|meta|link|base|applet)\b[^>]*\/>|<(?:iframe|embed|object|meta|link|base|applet)\b[^>]*>[\s\S]*?<\/(?:iframe|embed|object|meta|link|base|applet)>/gi, '');

  // Strip inline event handlers with word-boundary match (SEC-02 ReDoS immune)
  sanitized = sanitized.replace(/\b(?:on[a-z0-9_-]+)\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // Strip javascript:, data:text/html, and data:image/svg in href/xlink:href (SEC-03)
  sanitized = sanitized.replace(/\b(?:href|xlink:href)\s*=\s*['"]\s*(?:javascript:|data:text\/html|data:image\/svg)[^'"]*['"]/gi, 'href=""');

  // Strip external tracking links in href/xlink:href
  sanitized = sanitized.replace(/\b(?:href|xlink:href)\s*=\s*['"]\s*(?:https?:)?\/\/[^'"]*['"]/gi, 'href=""');

  // Strip unsafe <style> with @import or external url()
  sanitized = sanitized.replace(/<style\b[\s\S]*?<\/style>/gi, (match) => {
    return /(@import|url\s*\(\s*['"]?https?:|expression\s*\()/i.test(match) ? '' : match;
  });

  // Extract Dimensions & ViewBox
  const svgOpenTagMatch = sanitized.match(/<svg\b([^>]*)>/i);
  let width = 300;
  let height = 150;
  let viewBox = '';

  if (svgOpenTagMatch) {
    const attrs = svgOpenTagMatch[1];
    
    // Check viewBox
    const vbMatch = attrs.match(/viewBox\s*=\s*['"]([^'"]+)['"]/i);
    if (vbMatch) {
      viewBox = vbMatch[1].trim();
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && !parts.some(isNaN) && parts[2] > 0 && parts[3] > 0) {
        width = Math.round(parts[2]);
        height = Math.round(parts[3]);
      }
    }

    // Explicit width/height override if present and valid
    const wMatch = attrs.match(/\bwidth\s*=\s*['"]([0-9.]+)(?:px)?['"]/i);
    const hMatch = attrs.match(/\bheight\s*=\s*['"]([0-9.]+)(?:px)?['"]/i);
    if (wMatch && Number(wMatch[1]) > 0) width = Math.round(Number(wMatch[1]));
    if (hMatch && Number(hMatch[1]) > 0) height = Math.round(Number(hMatch[1]));

    // If no viewBox was present, synthesize one from width/height
    if (!viewBox) {
      viewBox = `0 0 ${width} ${height}`;
      sanitized = sanitized.replace(/<svg\b/i, `<svg viewBox="${viewBox}" `);
    }
  }

  return {
    isValid: true,
    sanitizedSvg: sanitized,
    width,
    height,
    viewBox
  };
}
