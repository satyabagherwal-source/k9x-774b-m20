# Adaptive Depth & Dual-Theme Ergonomics Learning

## 1. Incident & Trigger Context
- **Project**: Old English Font Free (`localhost:4321/font-pairing/`)
- **Observed Defect**:
  1. The header brand logo was vertically squished and clipped ("OLD" cut off at the top; "100% Free & Legal Safe" badge bleeding into the green guarantee bar).
  2. The navigation links had no responsive hamburger menu or slide-over drawer on screens `< 1024px`, leaving mobile visitors stranded without navigation.
  3. No Dark / Light mode switcher icon existed, despite rich manuscript parchment styling potential for historical Old English typography.
- **Root Cause**:
  The AI previously executed a "Surface-Level Audit" (verifying API status codes, static HTML builds, and isolated text conversion functions), without automatically escalating into a "Deep Visual & Ergonomic Verification" that tests multi-viewport responsiveness, ascender headroom, and dual-theme accessibility.

## 2. The Core Learning
> **Rule 23**: The AI must never assume that passing functional tests equates to a production-ready user interface. Whenever a task touches any user-facing surface, the AI must automatically escalate from Surface Mode to Deep Mode.

## 3. Mandatory Deep Mode Front-End Standard
1. **Dual-Theme Invariant (Dark Obsidian + Light Manuscript)**:
   - Header must include an interactive Theme Switcher (`#themeToggleBtn`) with Sun/Moon icons.
   - Pre-hydration script in `<head>` ensures zero flash of wrong theme upon page load (`localStorage.theme`).
   - Both modes must have bespoke palette tokens (e.g. obsidian midnight vs. illuminated ancient parchment).
2. **Full Responsive Invariant (Mobile Drawer Navigation)**:
   - Header navigation links must collapse gracefully into a mobile hamburger menu (`#mobileMenuToggleBtn`) with an animated slide-over drawer (`#mobileNavDrawer`).
   - All multi-page routes, search shortcuts, and theme switchers must be accessible within the mobile drawer.
3. **Headroom & Typography Protection**:
   - High-ascender decorative display typefaces (such as `Cinzel Decorative`) must have explicit line-height and `shrink-0` to avoid vertical clipping and unwanted wrapping on flex containers.
4. **Multi-Viewport Headless Verification**:
   - Automated CDP/browser testing must verify at least two viewports: Desktop (1280x800) and Mobile (375x812), asserting bounding client rects and drawer transitions.

## 4. Git Invariant Reminder
- **Child Product Repositories**: Changes remain strictly UNCOMMITTED in the working tree for user review.
- **AI-Builder-Brain**: Auto-committed and pushed to GitHub remote to update fleet intelligence.
