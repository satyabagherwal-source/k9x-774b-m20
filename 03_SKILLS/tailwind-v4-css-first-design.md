# Tailwind CSS v4 — CSS-First Design & Token Architecture

> Canonical reference: `AI-Builder-Brain/03_SKILLS/tailwind-v4-css-first-design.md`  
> Purpose: Implementation standard for Tailwind CSS v4 in Astro projects, enforcing modern OKLCH tokens, eliminating `tailwind.config.js`, and guaranteeing zero CLS.

---

## 1. Paradigm Shift in Tailwind CSS v4

Tailwind CSS v4 is a ground-up rewrite engineered for maximum speed, modern CSS standards, and CSS-first configuration.

### What Changed in v4:
1. **No `tailwind.config.js`**: Configuration is declared directly in CSS files using `@theme`.
2. **CSS-First Architecture**: Use `@import "tailwindcss";` instead of the old `@tailwind base; @tailwind components; @tailwind utilities;`.
3. **Vite Plugin Integration**: Uses `@tailwindcss/vite` instead of PostCSS plugins for blazing-fast builds.
4. **Native CSS Variables & OKLCH**: Theme tokens map directly to standard CSS custom properties with perceptual OKLCH color spaces.
5. **Modern Utilities**: Built-in 3D transforms, container queries, color-mix, and subgrid.

---

## 2. Astro + Tailwind v4 Integration Spec

### Step A: Package Dependencies (`package.json`)
```json
{
  "dependencies": {
    "astro": "^5.4.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

### Step B: Astro Config (`astro.config.mjs`)
Configure `@tailwindcss/vite` directly inside Vite's plugins array:
```javascript
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()]
  }
});
```

### Step C: Global Stylesheet (`src/styles/global.css`)
```css
@import "tailwindcss";

@theme {
  --color-primary-50: oklch(0.97 0.02 250);
  --color-primary-500: oklch(0.55 0.22 260);
  --color-primary-600: oklch(0.48 0.24 260);
  --color-primary-900: oklch(0.25 0.15 260);

  --color-accent-400: oklch(0.75 0.18 160);
  --color-accent-500: oklch(0.65 0.20 160);

  --color-surface-light: oklch(0.99 0.00 0);
  --color-surface-dark: oklch(0.14 0.02 260);

  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-display: "Outfit", sans-serif;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

@custom-variant dark (&:where(.dark, .dark *));
```

---

## 3. Visual Polish & Micro-Animations

- **Glassmorphic Cards**:
  `backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-500/5 rounded-2xl`
- **Dynamic Buttons**:
  `inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0`
- **Zero CLS Sizing**:
  Never insert unstyled containers for dynamic content or ads; always specify `min-h-[Xpx]` or `aspect-[W/H]`.
