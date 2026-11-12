/**
 * Agentic Knowledge Gateway: Documentation Anchor Engine
 * Grounded in Brain Pattern SYNTH-E3-179-CD-3H9L (from mikeroyal/Apple-Silicon-Guide, commit 7e58c7d7)
 * Re-verified in Phase E.4 (VERIFIED_INDEPENDENTLY)
 */

/**
 * Converts a Markdown heading text into a deterministic GitHub-standard URL fragment anchor.
 * 
 * Rules:
 * 1. Strips leading Markdown hashes (#) and surrounding whitespace.
 * 2. Downcases all characters.
 * 3. Removes punctuation and special characters (preserving alphanumeric, whitespace, and hyphens).
 * 4. Replaces each whitespace character with a hyphen.
 * 5. Handles duplicate headings with sequential suffixes (-1, -2, ...).
 */
export function slugifyHeading(headingText, existingSlugs = new Set()) {
  if (typeof headingText !== 'string' || !headingText.trim()) {
    throw new Error('Heading text must be a non-empty string');
  }

  // 1. Strip leading Markdown hashes and whitespace
  const clean = headingText.replace(/^#+\s*/, '').trim();

  // 2. Downcase
  let slug = clean.toLowerCase();

  // 3. Remove punctuation / symbols (preserving Unicode letters, numbers, spaces, and hyphens)
  slug = slug.replace(/[^\p{L}\p{N}\s-]/gu, '');

  // 4. Convert each space to a hyphen
  slug = slug.replace(/\s/g, '-');

  // 5. Strip leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // 5. Deduplicate
  let candidateSlug = slug;
  let counter = 1;
  while (existingSlugs.has(candidateSlug)) {
    candidateSlug = `${slug}-${counter}`;
    counter++;
  }
  existingSlugs.add(candidateSlug);

  return candidateSlug;
}

/**
 * Parses all headings from a Markdown document and returns a structured TOC map
 */
export function generateTableOfContents(markdownContent) {
  if (typeof markdownContent !== 'string') return [];

  const lines = markdownContent.split(/\r?\n/);
  const headings = [];
  const existingSlugs = new Set();

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      const slug = slugifyHeading(rawText, existingSlugs);
      headings.push({
        level,
        line: lineNum,
        rawText,
        anchor: `#${slug}`,
        markdownLink: `[${rawText}](#${slug})`
      });
    }
  }

  return headings;
}

/**
 * Validates whether an anchor link matches the target heading text
 */
export function validateAnchorLink(anchorFragment, targetHeading) {
  const cleanAnchor = anchorFragment.startsWith('#') ? anchorFragment.slice(1) : anchorFragment;
  const expectedSlug = slugifyHeading(targetHeading, new Set());
  if (cleanAnchor !== expectedSlug) {
    throw new Error(`Anchor mismatch: Expected #${expectedSlug}, received #${cleanAnchor}`);
  }
  return true;
}
