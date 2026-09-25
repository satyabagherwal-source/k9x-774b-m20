# Design System & Guidelines — {{PROJECT_NAME}}

## 1. Visual Identity & Aesthetic Philosophy
This project adheres to a modern, premium aesthetic designed to provide visual excellence and immediate polish.
- **Aesthetic Direction**: Sleek, clean, glassmorphic accents with refined depth and high typographic clarity.
- **Visual Contrast**: Dark/Light modes with WCAG AA compliance (minimum contrast ratio 4.5:1 for normal text).
- **Motion Philosophy**: Subtle micro-interactions, spring transitions on interactive components, zero jarring layout shifts (CLS = 0).

---

## 2. Color System (Tailwind CSS v4 OKLCH Tokens)

| Token | OKLCH / CSS Value | Semantic Role |
|---|---|---|
| `--color-primary-50` | `oklch(0.97 0.02 250)` | Primary tint / subtle backgrounds |
| `--color-primary-500` | `oklch(0.55 0.22 260)` | Primary brand color (buttons, active states) |
| `--color-primary-600` | `oklch(0.48 0.24 260)` | Primary hover state |
| `--color-primary-900` | `oklch(0.25 0.15 260)` | Deep brand text and dark accents |
| `--color-accent-400` | `oklch(0.75 0.18 160)` | Bright mint accent for highlights / badges |
| `--color-accent-500` | `oklch(0.65 0.20 160)` | Vibrant accent actions |
| `--color-surface-light`| `oklch(0.99 0.00 0)` | Pure background in light mode |
| `--color-surface-dark` | `oklch(0.14 0.02 260)` | Deep slate background in dark mode |
| `--color-border-subtle`| `oklch(0.88 0.01 260 / 0.5)` | Glassmorphism card borders |

---

## 3. Typography Hierarchy

- **Body Font**: Inter, system-ui, -apple-system, sans-serif
- **Heading Font**: Outfit, Inter, sans-serif
- **Scale**:
  - `h1`: `text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight`
  - `h2`: `text-2xl sm:text-3xl font-bold tracking-tight`
  - `h3`: `text-xl sm:text-2xl font-semibold`
  - `body`: `text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed`
  - `small`: `text-xs sm:text-sm text-slate-500 font-medium`

---

## 4. Layout & Grid Standards
- **Container Max-Width**: `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8`
- **Breakpoints**:
  - Mobile: `< 640px`
  - Tablet: `640px - 1024px`
  - Desktop: `> 1024px`
- **Spacing Rhythm**: 4px base grid (`p-2`, `p-4`, `p-6`, `p-8`, `p-12`).

---

## 5. Component Patterns
- **Glassmorphic Cards**:
  `backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-500/5 rounded-2xl`
- **Buttons**:
  - Primary: `inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0`
  - Secondary: `inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200`
