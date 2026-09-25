# 🎨 Design System & Visual Specification — Full-stack AI SaaS

This document defines the visual design language, color tokens, typography, and responsive component architecture.

---

## 🌈 Color Palette (OKLCH Native Tokens)

| Token | OKLCH Value | Purpose |
|---|---|---|
| `--color-surface-bg` | \`oklch(0.14 0.02 260)\` | Global app dark background |
| `--color-surface-card` | \`oklch(0.18 0.03 260)\` | Card & panel background |
| `--color-surface-border` | \`oklch(0.28 0.04 260)\` | Subtle borders & dividers |
| `--color-primary-500` | \`oklch(0.60 0.20 265)\` | Primary CTA, focus rings |
| `--color-primary-600` | \`oklch(0.52 0.22 265)\` | Button hover state |
| `--color-accent-400` | \`oklch(0.75 0.18 160)\` | Emerald status badge, success |

---

## 🔤 Typography & Hierarchy

- **Font Family**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Headings**:
  - H1: \`font-extrabold\`, 2.5rem–3.5rem, letter-spacing \`-0.025em\`
  - H2: \`font-semibold\`, 1.25rem–1.5rem
  - Body: \`text-sm\` / \`text-base\`, slate-300 / slate-400
  - Monospace (Code/Telemetry): \`font-mono\`, \`text-xs\`

---

## 📐 Layout & Visual Invariants

1. **Zero CLS**: Container blocks have explicit minimum heights to prevent layout shifts during async AI loading.
2. **Glassmorphism**: Backdrop blur with semi-transparent border (\`backdrop-blur-xl bg-slate-900/40 border-slate-800\`).
3. **Accessibility**: Minimum 4.5:1 text-to-background contrast ratio across all UI states.
