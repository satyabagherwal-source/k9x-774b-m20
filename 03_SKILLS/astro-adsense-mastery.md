# Astro.js + Google AdSense Fast Approval & High-RPM Playbook

This skill defines the architectural, content, and layout patterns required to build Astro.js websites that achieve rapid Google AdSense approval, maximum earnings (high RPM), top Core Web Vitals, and zero Cumulative Layout Shift (CLS).

---

## 1. The Core Architecture for AdSense Success

Google AdSense rejects over 85% of tool-based websites (calculators, protractors, converters, timers) with the reason:
> **"Low-Value Content" / "Thin Utility"**

### Why AdSense Rejects Tool Sites
1. AdSense crawlers cannot execute heavy client-side JavaScript canvas actions.
2. If the HTML page is mostly a canvas or script tag, the crawler sees an empty page with less than 200 words of text.
3. Automated review bots require semantic HTML (`<article>`, `<section>`, `<h2>`, `<p>`) and high-density educational text demonstrating **E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness).

### The Winning Solution: The Programmatic Educational Handbook Pattern
Wrap every utility or tool with an authoritative **Educational Masterclass Section** directly on the same page below the tool:
- **Technical Rigor**: In-depth explanations of real-world mathematics, physics, engineering, and vocational applications (e.g., carpentry rafter cuts, solar panel inclination, civil engineering ADA ramp slopes, mechanical CNC point angles).
- **Educational Curriculum Alignment**: Reference official standards (e.g. Common Core State Standards `CCSS.MATH.CONTENT.4.MD.C.5`, ISO/IEC specifications).
- **Editorial Transparency**: Include an EEAT disclosure banner identifying editorial board credentials, client-side IEEE 754 precision math verification, and physical lab testing procedures.
- **Minimum Text Density**: Maintain at least 1,200 to 2,500 words of rich, localized semantic text on every monetized page.

---

## 2. Core Web Vitals & Zero CLS Ad Placement

Google search rankings and AdSense RPM plummet if advertisements cause page elements to jump (Cumulative Layout Shift > 0.1).

### The Invariant Rules for Ad Units:
1. **Always Reserve Explicit Dimensions (CSS Aspect Ratio / Min-Height)**:
   Never insert an unstyled ad container:
   ```html
   <!-- WRONG (Causes massive layout shift when ad loads): -->
   <div id="ad-slot"><ins class="adsbygoogle" ...></ins></div>

   <!-- RIGHT (Zero CLS): -->
   <div class="ad-wrapper min-h-[90px] sm:min-h-[250px] w-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 rounded-xl overflow-hidden my-4">
     <ins class="adsbygoogle" style="display:block" data-ad-format="auto" ...></ins>
   </div>
   ```
2. **High-Yield Placements**:
   - **Unit 1: Below Primary Tool Context Bar**: High visibility immediately after user performs measurement.
   - **Unit 2: In-Feed Between Educational Sections**: Seamless reading experience with 40%+ viewability rate.
   - **Unit 3: Sticky Desktop Sidebar / Floating Dock**: Visible during sustained tool usage without blocking canvas handles.
3. **AdSense Script Optimization**:
   Load `adsbygoogle.js` asynchronously with `data-ad-client` in the `<head>` of `Layout.astro`:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```

---

## 3. Fast Static Performance with Astro

1. **Static Rendering (`output: 'static'`)**:
   Always pre-render all pages to static HTML at build time. Cloudflare Pages / Vercel Edge serves these static files in <50ms globally (TTFB < 80ms).
2. **Zero Unnecessary Framework Overhead**:
   Build interactive tools with Vanilla JavaScript + HTML5 Canvas rather than heavy React/Vue hydration overhead. This yields a 100/100 Lighthouse Performance score.
3. **Responsive Viewport Meta**:
   Always set `viewport-fit=cover` and handle mobile safe-area insets (`env(safe-area-inset-top)`).
