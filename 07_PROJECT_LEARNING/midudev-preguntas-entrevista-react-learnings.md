# Forensic Learning Record (Deep Inspection): midudev/preguntas-entrevista-react

> **Canonical Artifact**: `07_PROJECT_LEARNING/midudev-preguntas-entrevista-react-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/midudev/preguntas-entrevista-react](https://github.com/midudev/preguntas-entrevista-react))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:13.039Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `midudev/preguntas-entrevista-react`
- **Description**: Preguntas típicas sobre React para entrevistas de trabajo ⚛️
- **Primary Language / Ecosystem**: Astro
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7837 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `astro.config.mjs`
```
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://www.reactjs.wiki',
  output: 'static',
  trailingSlash: 'never',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  build: {
    concurrency: 10,
    // Incrusta el CSS en el HTML en lugar de enlazarlo. El <link> obligaba a un
    // round-trip extra en serie (el navegador no descubre la hoja hasta que
    // parsea el head) que bloqueaba el primer pintado. Con el CSS dentro del
    // documento, el HTML llega listo para pintar.
    // Se pierde el cacheo de la hoja entre paginas, pero el CSS global ya se
    // dividio por ruta (global vs article) y el prefetch deja las paginas
    // calientes de todas formas.
    inlineStylesheets: 'always',
  },
  experimental: {
    // Prerender prefetched pages via the Speculation Rules API (Chromium)
    clientPrerender: true,
  },
  integrations: [
    react(),
    sitemap({
      filter: page => !page.includes('/404'),
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date(),
      serialize(item) {
        if (item.url === 'https://www.reactjs.wiki/') {
          return { ...item, changefreq: 'daily', priority: 1 }
        }
        if (item.url.endsWith('/questions')) {
          return { ...item, changefreq: 'weekly', priority: 0.9 }
        }
        // Article/question pages
        if (
          item.url !== 'https://www.reactjs.wiki/' &&
          !item.url.endsWith('/questions')
        ) {
          return { ...item, changefreq: 'monthly', priority: 0.7 }
        }
        return item
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})

```

### Core Architecture Module: `scripts/exportBook.mjs`
```
/**
 * Export Leanpub manuscript from README.md + quiz JSON.
 *
 * Layout per question:
 *   1. Title + explanation (from README)
 *   2. "Pon a prueba" block with 4 stable MCQ options (no spoilers)
 * Solucionario at the end of each level chapter.
 *
 * Usage:  node scripts/exportBook.mjs
 * Output: manuscript/
 */
import fs from 'fs-extra'
import path from 'node:path'
import slugify from '@sindresorhus/slugify'

const ROOT = process.cwd()
const README_PATH = path.join(ROOT, 'README.md')
const QUIZ_DIR = path.join(ROOT, 'public/quiz/qa')
const OUT_DIR = path.join(ROOT, 'manuscript')
/** Exclusive book chapters (not used on the website). */
const BEFORE_PATH = path.join(ROOT, 'book/before.md')
const BEFORE_OUT = '00-antes-de-empezar.md'
const AFTER_PATH = path.join(ROOT, 'book/after.md')
const AFTER_OUT = '05-hasta-aqui.md'

const LEVELS = [
  { key: 'principiante', heading: 'Principiante', file: '01-principiante.md' },
  { key: 'intermedio', heading: 'Intermedio', file: '02-intermedio.md' },
  { key: 'experto', heading: 'Experto', file: '03-experto.md' },
  {
    key: 'errores típicos en react',
    heading: 'Errores típicos en React',
    file: '04-errores-tipicos.md',
  },
]

const LETTERS = ['a', 'b', 'c', 'd']
/** 1 correct + 3 distractors — readable on paper / ebook */
const OPTIONS_PER_QUESTION = 4

// ─── Deterministic RNG (stable builds, not always answer "a") ───

function hashString(input) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(items, seed) {
  const arr = [...items]
  const rand = mulberry32(seed)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Quiz helpers ───

function loadQuiz(slug) {
  const file = path.join(QUIZ_DIR, `${slug}.json`)
  if (!fs.existsSync(file)) return null
  try {
    const data = fs.readJsonSync(file)
    return Array.isArray(data) && data.length > 0 ? data : null
  } catch {
    return null
  }
}

/**
 * Pick 1 correct + (n-1) incorrect, shuffle deterministically by question id.
 * Returns { options: [{letter, text, isCorrect}], answerLetter, answerText }
 */
function prepareBookQuestion(quizItem) {
  const alts = Array.isArray(quizItem.alternatives) ? quizItem.alternatives : []
  if (alts.length === 0) return null

  const correct = alts.find(a => a.is_correct) ?? alts[0]
  const incorrect = alts.filter(a => a !== correct)
  const seed = hashString(quizItem.id || quizItem.question || '')
  const pickedIncorrect = seededShuffle(incorrect, seed).slice(
    0,
    OPTIONS_PER_QUESTION - 1
  )
  const subset = seededShuffle([correct, ...pickedIncorrect], seed ^ 0x9e3779b9)

  const options = subset.map((alt, i) => ({
    letter: LETTERS[i],
    text: cleanText(alt.text),
    isCorrect: Boolean(alt.is_correct) || alt === correct,
  }))

  const answer = options.find(o => o.isCorrect) ?? options[0]
  return {
    prompt: cleanText(quizItem.question),
    options,
    answerLetter: answer.letter,
    answerText: answer.text,
  }
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatQuizBlock(preparedList) {
  if (!preparedList.length) return ''

  const lines = [
    '',
    '##### Pon a prueba',
    '',
    '*Responde sin mirar el solucionario del final del capítulo. Marca una sola opción.*',
    '',
  ]

  preparedList.forEach((q, i) => {
    lines.push(`**${i + 1}.** ${q.prompt}`)
    lines.push('')
    for (const opt of q.options) {
      lines.push(`- **${opt.letter})** ${opt.text}`)
    }
    lines.push('')
  })

  return lines.join('\n')
}

function formatChapterSolutions(entries) {
  if (!entries.length) return ''

  const lines = [
    '',
    '{pagebreak}',
    '',
    '## Solucionario',
    '',
    '*Comprueba tus respuestas cuando hayas terminado las preguntas del capítulo.*',
    '',
  ]

  for (const entry of entries) {
    lines.push(`### ${entry.title}`)
    lines.push('')
    entry.answers.forEach((a, i) => {
      lines.push(
        `${i + 1}. **${a.letter})** ${a.text}`
      )
    })
    lines.push('')
  }

  return lines.join('\n')
}

// ─── README parsing ───

/**
 * Split README into level chapters and questions (#### headings).
 * Returns [{ levelKey, levelHeading, questions: [{ title, slug, body }] }]
 */
function parseReadme(readme) {
  const start = readme.indexOf('\n### ')
  if (start === -1) throw new Error('No se encontró el primer heading ### en README.md')

  const body = readme.slice(start + 1) // keep leading ###
  const levelChunks = body.split(/\n(?=### )/g)

  const chapters = []

  for (const chunk of levelChunks) {
    const firstLineEnd = chunk.indexOf('\n')
    const firstLine = (firstLineEnd === -1 ? chunk : chunk.slice(0, firstLineEnd)).trim()
    if (!firstLine.startsWith('### ')) continue

    const levelHeading = firstLine.replace(/^###\s+/, '').trim()
    const levelKey = levelHeading.toLowerCase()
    const rest = firstLineEnd === -1 ? '' : chunk.slice(firstLineEnd + 1)

    // Split by #### questions
    const parts = rest.split(/\n(?=#### )/g)
    const questions = []

    for (const part of parts) {
      if (!part.trim().startsWith('#### ')) continue
      const nl = part.indexOf('\n')
      const titleLine = (nl === -1 ? part : part.slice(0, nl)).trim()
      const title = titleLine.replace(/^####\s+/, '').trim()
      let content = nl === -1 ? '' : part.slice(nl + 1)

      content = content
        .replace(/\*\*\[⬆ Volver a índice\]\(#índice\)\*\*/g, '')
        .replace(/\n---\s*$/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      if (!title) continue
      questions.push({
        title,
        slug: slugify(title),
        body: content,
      })
    }

    chapters.push({ levelKey, levelHeading, questions })
  }

  return chapters
}

// ─── Code fences for Leanpub (Markua + Pygments) ───

/**
 * Leanpub highlights fenced code with Pygments. Many books still run an older
 * Pygments build that does not include the `jsx` / `tsx` lexers — fences tagged
 * as those languages render as plain monospaced text in PDF (only occasional
 * lucky tokens get colour). Prefer widely-supported lexer names instead.
 *
 * Trade-off: `javascript` colours keywords/comments/strings well, but treats
 * `</div>` imperfectly. Still far better than no highlighting at all.
 *
 * @see https://leanpub.com/markua/read (Pygments-backed code highlighting)
 */
const LEANPUB_LANG_MAP = {
  jsx: 'javascript',
  tsx: 'typescript',
  js: 'javascript',
  ts: 'typescript',
  mjs: 'javascript',
  cjs: 'javascript',
  react: 'javascript',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  console: 'bash',
  text: 'text',
  plain: 'text',
  txt: 'text',
}

function normalizeCodeFencesForLeanpub(markdown) {
  return markdown.replace(
    /^```([^\n`]*)/gm,
    (full, info) => {
      const raw = String(info || '').trim()
      // Closing fences are bare ``` — leave them alone
      if (!raw) return full

      // info string may be "jsx" or "jsx title=..." — only map the language id
      const parts = raw.split(/\s+/)
      const lang = parts[0].toLowerCase()
      const rest = parts.slice(1).join(' ')
      const mapped = LEANPUB_LANG_MAP[lang] ?? lang
      return rest ? `\`\`\`${mapped} ${rest}` : `\`\`\`${mapped}`
    }
  )
}

// ─── Build manuscript ───

function buildQuestionMarkdown(question, preparedQuiz) {
  const lines = [`## ${question.title}`, '']

  if (question.body) {
    lines.push(normalizeCodeFencesForLeanpub(question.body))
    lines.push('')
  }

  if (preparedQuiz?.length) {
    lines.push(formatQuizBlock(preparedQuiz).trimEnd())
    lines.
```

### Core Architecture Module: `scripts/lint.mjs`
```
import markdownlint from 'markdownlint'

const { readConfigSync } = markdownlint

const options = {
  config: readConfigSync('.markdownlint.json'),
  files: ['README.md'],
}

markdownlint(options, function callback(err, result) {
  if (!err) {
    console.log(result.toString())
  }
})

```

### Core Architecture Module: `scripts/markdownToJson.mjs`
```
import fs from 'fs-extra'
import slugify from '@sindresorhus/slugify'
import { marked } from 'marked'
import Prism from 'prismjs'

const LEVELS = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
  ERRORS: -1,
}

const MAP_LEVELS = {
  principiante: LEVELS.EASY,
  intermedio: LEVELS.MEDIUM,
  experto: LEVELS.HARD,
  'errores típicos en react': LEVELS.ERRORS,
}

const addCodeHighlight = async markdown => {
  const codeBlockRegex = /^```(\w+)\n([a-z]*[\s\S]*?)\n```/gm
  for (const match of markdown.matchAll(codeBlockRegex)) {
    let lang = match[1]
    const isPrismLanguageLoaded = Object.keys(Prism.languages)
      .filter(id => typeof Prism.languages[id] === 'object')
      .includes(lang)
    if (!isPrismLanguageLoaded) {
      try {
        // dynamically import the required component for languague
        const component = `prismjs/components/prism-${lang}.js`
        await import(component)
      } catch (error) {
        if (error instanceof Error && error.code === 'ERR_MODULE_NOT_FOUND') {
          lang = 'txt' // fallback to plain text if the language component is not found
        } else {
          throw error
        }
      }
    }
    const code = Prism.highlight(match[2], Prism.languages[lang], lang)
    const block = `<pre><code class="language-${lang}">${code}</code></pre>`
    markdown = markdown.replace(match[0], block)
  }
  return markdown
}

const readme = await fs.readFile('./README.md', 'utf-8')
const start = readme.indexOf('### ')

const cleaned = (await addCodeHighlight(readme))
  .replaceAll('**[⬆ Volver a índice](#índice)**', '')
  .replaceAll('](#', '](/')
  .slice(start)

fs.outputFile('./public/content/README.md', cleaned, { encoding: 'utf-8' })

const tree = marked.lexer(cleaned)

let previousId = null
let previousTitle = ''
let previousLevel = undefined
const index = []
let levelLiteral = 'principiante'
let stack = []

const counter = {
  total: 0,
}

const promises = tree
  .map((item, i) => {
    const { depth, type, text } = item

    const isHeading = type === 'heading' && depth === 4
    const isLevel = depth === 3
    const isLast = i === tree.length - 1

    if (isLevel) {
      levelLiteral = text.toLowerCase()
      return null
    }

    if (isHeading || isLast) {
      let id
      let level

      if (isHeading) {
        id = slugify(text)
        level = MAP_LEVELS[levelLiteral]
        index.push({ id, text, level })
      }

      counter.total++

      // only for the first one
      if (previousId === null) {
        previousId = id
        previousTitle = text
        previousLevel = level
      }

      if (previousId !== id || isLast) {
        const content = marked.parser(stack)

        content
          .replace('<h4 ', '<h1 ')
          .replace('</h4', '</h1')
          .replace('<hr>', '')

        const promise = fs.outputJSON(`./public/content/${previousId}.json`, {
          id: previousId,
          level: previousLevel,
          title: previousTitle,
          content,
        })

        stack = []
        previousId = id
        previousTitle = text
        previousLevel = level

        return promise
      }
    }

    stack.push(item)
    return null
  })
  .filter(Boolean)

Promise.all(promises).then(() => {
  fs.outputJSON('./public/content/counter.json', counter)
  fs.outputJSON('./public/content/index.json', index)
  console.log('All files generated')
})

```

### Core Architecture Module: `src/components/Quiz.tsx`
```
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  IconCheck,
  IconX,
  IconArrowLeft,
  IconArrowRight,
  IconRefresh,
  IconTrophy,
  IconLoader2,
  IconCircleDashed,
  IconChevronDown,
  IconFlame,
  IconMoodSad,
} from '@tabler/icons-react'

export function Quiz({ slug }: { slug: string }) {
  const [questions, setQuestions] = useState([])
  const [status, setStatus] = useState(slug ? 'loading' : 'error')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [score, setScore] = useState(0)
  const [focusOption, setFocusOption] = useState(0)
  const nextBtnRef = useRef(null)
  const resultBtnRef = useRef(null)
  const questionHeadingRef = useRef(null)

  useEffect(() => {
    if (!slug) {
      setStatus('error')
      return
    }

    let cancelled = false
    setStatus('loading')

    fetch(`/quiz/qa/${slug}.json`)
      .then(r => {
        if (!r.ok) throw new Error('NOT_FOUND')
        return r.json()
      })
      .then(json => {
        if (cancelled) return
        if (!Array.isArray(json) || json.length === 0) {
          setStatus('error')
          return
        }
        const withPrepared = json.map(q => ({
          ...q,
          allAlternatives: q.alternatives,
          alternatives: prepareAlternatives(q.alternatives),
        }))
        setQuestions(withPrepared)
        setCurrent(0)
        setAnswers({})
        setScore(0)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const total = questions.length
  const question = questions[current]
  const answered = answers[question?.id]
  const isLast = current === total - 1

  // After answering, move focus to the primary action (no auto-advance —
  // better for keyboard / screen-reader control).
  useEffect(() => {
    if (!answered) return
    const id = window.setTimeout(() => {
      if (isLast) resultBtnRef.current?.focus()
      else nextBtnRef.current?.focus()
    }, 50)
    return () => window.clearTimeout(id)
  }, [answered, isLast, current])

  // Announce question changes by focusing the heading when the index changes
  // (not on first mount of each load to avoid fighting the page).
  const prevCurrent = useRef(null)
  useEffect(() => {
    if (status !== 'ready') return
    if (prevCurrent.current === null) {
      prevCurrent.current = current
      return
    }
    if (prevCurrent.current !== current) {
      prevCurrent.current = current
      setFocusOption(0)
      questionHeadingRef.current?.focus({ preventScroll: false })
    }
  }, [current, status])

  const handleSelect = useCallback(
    alternative => {
      if (answered) return
      const isCorrect = alternative.is_correct
      setAnswers(prev => ({ ...prev, [question.id]: alternative.id }))
      if (isCorrect) setScore(s => s + 1)
    },
    [answered, question]
  )

  const handleNext = () => {
    if (isLast) {
      setStatus('finished')
    } else {
      setCurrent(c => c + 1)
    }
  }

  const handlePrev = () => {
    setCurrent(c => Math.max(0, c - 1))
  }

  const handleRestart = () => {
    setAnswers({})
    setScore(0)
    setCurrent(0)
    setFocusOption(0)
    setQuestions(qs =>
      qs.map(q => ({
        ...q,
        alternatives: prepareAlternatives(q.allAlternatives || q.alternatives),
      }))
    )
    setStatus('ready')
  }

  const handleRadioKeyDown = (e, index) => {
    if (answered) return
    const count = question?.alternatives?.length ?? 0
    if (!count) return

    let next = index
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      next = (index + 1) % count
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      next = (index - 1 + count) % count
    } else if (e.key === 'Home') {
      e.preventDefault()
      next = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      next = count - 1
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleSelect(question.alternatives[index])
      return
    } else {
      return
    }
    setFocusOption(next)
    // Focus the button after state update
    requestAnimationFrame(() => {
      document.getElementById(`quiz-option-${question.id}-${next}`)?.focus()
    })
  }

  function prepareAlternatives(full = []) {
    if (!Array.isArray(full) || full.length === 0) return []
    const correct = full.find(a => a.is_correct) || full[0]
    const incorrect = full.filter(a => a !== correct)
    const shuffledIncorrect = [...incorrect].sort(() => Math.random() - 0.5)
    const needed = Math.max(0, 5 - 1)
    const pickedIncorrect = shuffledIncorrect.slice(0, needed)
    const subset = [correct, ...pickedIncorrect]
    return subset.sort(() => Math.random() - 0.5)
  }

  if (status === 'loading') {
    return (
      <div
        className='flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted)]'
        role='status'
        aria-live='polite'
      >
        <IconLoader2 size={18} className='animate-spin' aria-hidden='true' />
        Cargando preguntas…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        className='flex flex-col items-center gap-2 py-10 text-sm text-[var(--muted)]'
        role='status'
      >
        <IconCircleDashed
          size={28}
          className='text-[var(--faint)]'
          aria-hidden='true'
        />
        No se encontró un quiz para este contenido todavía.
      </div>
    )
  }

  if (status === 'finished') {
    const percent = Math.round((score / total) * 100)
    const ResultIcon =
      percent === 100 ? IconTrophy : percent >= 70 ? IconFlame : IconMoodSad
    const resultColor =
      percent === 100
        ? 'text-amber-500'
        : percent >= 70
          ? 'text-orange-500'
          : 'text-[var(--muted)]'
    const resultTitle =
      percent === 100
        ? '¡Perfecto!'
        : percent >= 70
          ? '¡Buen trabajo!'
          : 'Sigue practicando'

    return (
      <div className='space-y-8 animate-fade-in' role='region' aria-label='Resultado del quiz'>
        <div className='flex flex-col items-center gap-4 pt-4'>
          <div className='relative' role='img' aria-label={`Puntuación: ${percent} por ciento`}>
            <svg viewBox='0 0 120 120' className='h-36 w-36' aria-hidden='true'>
              <circle
                cx='60'
                cy='60'
                r='52'
                className='fill-none stroke-[var(--surface)]'
                strokeWidth='8'
              />
              <circle
                cx='60'
                cy='60'
                r='52'
                className='fill-none stroke-blue-500 dark:stroke-blue-400'
                strokeWidth='8'
                strokeLinecap='round'
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - percent / 100)}
                transform='rotate(-90 60 60)'
                style={{
                  transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)',
                }}
              />
            </svg>
            <div className='absolute inset-0 flex flex-col items-center justify-center'>
              <ResultIcon size={28} className={resultColor} aria-hidden='true' />
              <span className='mt-1 text-2xl font-semibold text-[var(--fg)]'>
                {percent}%
              </span>
            </div>
          </div>
          <div className='text-center'>
            <p className='text-lg font-semibold text-[var(--fg)]' role='status' aria-live='polite'>
              {resultTitle}
            </p>
            <p className='mt-1 text-sm text-[var(--muted)]'>
              {score} de {total} respuestas correctas
            </p>
          </div>
        </div>

        <div className='flex justify-center'>
          <button
            type='b
```

### Core Architecture Module: `src/constants.ts`
```
export const LEVELS = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
  ERRORS: -1,
} as const

/** Canonical origin without trailing slash (matches trailingSlash: 'never'). */
export const SITE_URL = 'https://www.reactjs.wiki'
export const SITE_NAME = 'React.js Wiki'
export const DEFAULT_TITLE = 'React.js Wiki - Preguntas y respuestas de React'
export const DEFAULT_DESCRIPTION =
  'Aprende React con preguntas de entrevista y conceptos clave explicados en español con ejemplos prácticos.'
/** JPEG is the most compatible format for social crawlers (LinkedIn, iMessage, etc.). */
export const OG_IMAGE_PATH = '/og.jpg'
export const OG_IMAGE_TYPE = 'image/jpeg'
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

/**
 * Absolute URL with no trailing slash (incl. homepage), matching
 * `trailingSlash: 'never'` and the preferred URL in Search Console.
 */
export function absoluteUrl(path = '/'): string {
  const normalized =
    !path || path === '/'
      ? '/'
      : path.startsWith('/')
        ? path
        : `/${path}`
  const url = new URL(normalized, `${SITE_URL}/`)

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1)
  }

  if (url.pathname === '/') {
    return SITE_URL // https://www.reactjs.wiki (no trailing slash)
  }

  return `${SITE_URL}${url.pathname}${url.search}${url.hash}`
}

```

### Core Architecture Module: `src/env.d.ts`
```
/// <reference types="astro/client" />

```

### Core Architecture Module: `src/lib/code-blocks.ts`
```
/**
 * Wrap Prism-highlighted <pre><code> blocks with a polished shell:
 * language label + sticky line numbers.
 *
 * Important: do NOT split the code HTML into per-line wrappers. Prism JSX
 * (and other grammars) emit token spans that cross newlines; wrapping each
 * line would produce invalid HTML and the browser would "fix" it by
 * collapsing indentation and mis-aligning the gutter.
 */
export function enhanceCodeBlocks(html: string): string {
  return html.replace(
    /<pre(?:\s[^>]*)?>\s*<code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_full, className = '', codeHtml: string) => {
      const langMatch = String(className).match(/language-([\w+-]+)/i)
      const lang = langMatch?.[1]?.toLowerCase() ?? ''
      const langLabel = formatLangLabel(lang)
      const lineCount = countLines(codeHtml)

      const gutter = Array.from({ length: lineCount }, (_, i) => {
        return `<span class="code-line-number">${i + 1}</span>`
      }).join('')

      const classAttr = className ? ` class="${className}"` : ''
      const langAttr = lang ? ` data-lang="${escapeAttr(lang)}"` : ''
      const linesLabel =
        lineCount === 1 ? '1 línea' : `${lineCount} líneas`
      const header = langLabel
        ? `<div class="code-block-header"><span class="code-block-lang">${escapeHtml(langLabel)}</span><span class="code-block-meta" aria-hidden="true">${escapeHtml(linesLabel)}</span></div>`
        : ''

      const regionLabel = langLabel
        ? `Bloque de código ${langLabel}, ${linesLabel}`
        : `Bloque de código, ${linesLabel}`

      return (
        `<div class="code-block"${langAttr} role="group" aria-label="${escapeAttr(regionLabel)}">` +
        header +
        `<div class="code-block-body">` +
        `<div class="code-gutter" aria-hidden="true">${gutter}</div>` +
        // Keep Prism HTML intact (including cross-line token spans).
        // tabindex allows keyboard users to scroll wide code with arrows.
        `<pre class="code-block-pre" tabindex="0" aria-label="${escapeAttr(regionLabel)}"><code${classAttr}>${codeHtml}</code></pre>` +
        `</div></div>`
      )
    }
  )
}

function countLines(codeHtml: string): number {
  let lines = codeHtml.split('\n')
  // Drop a single trailing empty line from a final newline in the source
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines = lines.slice(0, -1)
  }
  return Math.max(lines.length, 1)
}

function formatLangLabel(lang: string): string {
  if (!lang || lang === 'txt' || lang === 'text' || lang === 'plain') return ''
  const map: Record<string, string> = {
    js: 'JavaScript',
    jsx: 'JSX',
    ts: 'TypeScript',
    tsx: 'TSX',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    bash: 'Bash',
    sh: 'Shell',
    shell: 'Shell',
    md: 'Markdown',
    markdown: 'Markdown',
    diff: 'Diff',
    yml: 'YAML',
    yaml: 'YAML',
  }
  return map[lang] ?? lang.toUpperCase()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #137** (2026-07-18): **Enlace roto corregido dentro de "¿Cuáles son las reglas de los hooks …**
  *Symptoms*: ## Descripción Corregi el link del issue de enlace roto que menciones en #136    
  **Post-Mortem & Fix Analysis**:
  > @ismaeldevmw is attempting to deploy a commit to the **midudev pro** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=midudev%20pro&slug=midudev-pro&teamId=team_9BRYiN1B61IdOMjgcUBeBJqe&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22abbe3f5823f0f6fe7ae9cd1c33830ea2ec2ca7ae%22%7D%2C%22id%22%3A%22Qmaqd4YPgqYpdcV2YYfVMixJy7gEmWG8j5hezEYzq12jLG%22%2C%22org%22%3A%22midudev%22%2C%22prId%22%3A137%2C%22repo%22%3A%22preguntas-entrevista-react%22%7D).  

- **Issue #136** (2026-07-18): **Link roto en la  pregunta de errores tipicos**
  *Symptoms*: En esta pregunta esta roto un link https://www.reactjs.wiki/react-hook-use-xxx-is-called-conditionally-react-hooks-must-be-called-in-the-exact-same-order-in-every-component-render  ❌ En la parte de recomendaciones se envia a un enlace que contiene acentos https://www.reactjs.wiki/cu%C3%A1les-son-las-reglas-de-los-hooks-en-react  ✅ La url correcta es esta https://www.reactjs.wiki/cuales-son-las-reglas-de-los-hooks-en-react

- **Issue #135** (2026-04-25): **Activar marcado como leido en lista de preguntas**
  *Symptoms*: ## Descripción  Actualmente en la lista de preguntas de la pantalla de Inicio no se están marcando como leídas las preguntas que se han definido como "Leído" en el post de la pregunta. Estoy pasando el prop `showReadStatus={true}` al componente  `ListOfQuestions` para que se active dicha ayuda visual, así el usuario puede saber que preguntas ya leyó.  `<ListOfQuestions showReadStatus={true} />`  Actualmente, sin la ayuda visual: <img width="1467" height="1200" alt="Screenshot 2026-04-17 at 1 56 49 PM" src="https://github.com/user-attachments/assets/a8fce661-a437-4d0b-bacd-1298f929ad17" />  Con los cambios sugeridos:  <img width="1471" height="1147" alt="Screenshot 2026-04-17 at 1 57 09 PM" src="https://github.com/user-attachments/assets/9bfa20b1-85dc-4e5f-9d58-d34e5ce3dd5e" />     ## Checklist  - [x] He revisado que mi pregunta no está duplicada - [x] He revisado que la gramática de mis cambios es correcta - [ ] He agregado un link de (`**[⬆ Volver a índice](#índice)**`) y una línea separadora (`---`) al final de mi pregunta 
  **Post-Mortem & Fix Analysis**:
  > @daniseguraf is attempting to deploy a commit to the **midudev pro** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=midudev%20pro&slug=midudev-pro&teamId=team_9BRYiN1B61IdOMjgcUBeBJqe&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22f295c8335010f08153936cc292b05544282553d0%22%7D%2C%22id%22%3A%22QmQfUEcsxPe8SEZci3xjw6Mx9NscsQ3YSxa8QJjR6CtBUm%22%2C%22org%22%3A%22midudev%22%2C%22prId%22%3A135%2C%22repo%22%3A%22preguntas-entrevista-react%22%7D).  

- **Issue #134** (2026-05-18): **Enhance JSX explanation in que-es-jsx.json**
  *Symptoms*: ## Descripción  Se está incluyendo una breve explicación de porqué a JSX se le considera  un "syntactic sugar".  ## Checklist  - [x] He revisado que mi pregunta no está duplicada - [x] He revisado que la gramática de mis cambios es correcta - [ ] He agregado un link de (`**[⬆ Volver a índice](#índice)**`) y una línea separadora (`---`) al final de mi pregunta 
  **Post-Mortem & Fix Analysis**:
  > @daniseguraf is attempting to deploy a commit to the **midudev pro** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=midudev%20pro&slug=midudev-pro&teamId=team_9BRYiN1B61IdOMjgcUBeBJqe&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22a9e6d298ec66290c08d86f805e4efa7139219173%22%7D%2C%22id%22%3A%22QmZvfeCkFPWpbMQ2YguNYxFhjL6e6uxETwLAZvrxbVnjtN%22%2C%22org%22%3A%22midudev%22%2C%22prId%22%3A134%2C%22repo%22%3A%22preguntas-entrevista-react%22%7D).  

- **Issue #133** (2026-04-11): **fix: align pill hover styles, theme toggle, and buy book button**
  *Symptoms*: ## Descripción  - Evita que el hover de las preguntas se recorte. - Alinea el botón "Compra el libro" con los estilos del botón "Marcar leído". - Ajusta el contador de leídas y el toggle de tema.  Closes #132   ## Checklist  - [x] He revisado que mi pregunta no está duplicada - [x] He revisado que la gramática de mis cambios es correcta - [x] No aplica: este PR no añade una nueva pregunta
  **Post-Mortem & Fix Analysis**:
  > @manuelsolano2 is attempting to deploy a commit to the **midudev pro** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=midudev%20pro&slug=midudev-pro&teamId=team_9BRYiN1B61IdOMjgcUBeBJqe&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2203548b9c55234ef8e7d2cbb123b5c698b29bb471%22%7D%2C%22id%22%3A%22QmTLd82nTmo9Vg3Ds8pCHBeAFysXDZZVFQ76oHRBSttHSW%22%2C%22org%22%3A%22midudev%22%2C%22prId%22%3A133%2C%22repo%22%3A%22preguntas-entrevista-react%22%7D).  

- **Issue #132** (2026-04-11): **Visual fix**
  *Symptoms*: ## Descripción  Al hacer hover sobre algunas preguntas del listado, la animación lateral puede verse recortada visualmente. Esto ocurre porque las filas se desplazan ligeramente en hover y el contenedor de cada elemento estaba limitando el pintado del contenido.  También hay algunos elementos interactivos con estilos poco consistentes entre sí, como el contador de leídas, el toggle de tema y el botón "Compra el libro".  ## Resultado esperado  - El hover de las preguntas debería verse completo, sin cortes laterales. - Los elementos interactivos deberían compartir un lenguaje visual más consistente. - El botón "Compra el libro" debería alinearse con el estilo del botón "Marcar leído". 

- **Issue #131** (2026-04-10): **fix(security): remove preinstall.js file & his script on package json**
  *Symptoms*: ## Descripción  Eliminación del archivo preinstall.js con eval y el comando que lo ejecuta en package.json que conllevan possibles problemas de seguridad, com se menciona en #130 .  ## Checklist (NO APLICA)  - [x] He revisado que mi pregunta no está duplicada - [x] He revisado que la gramática de mis cambios es correcta - [x] He agregado un link de (`**[⬆ Volver a índice](#índice)**`) y una línea separadora (`---`) al final de mi pregunta 
  **Post-Mortem & Fix Analysis**:
  > @alesdevux is attempting to deploy a commit to the **midudev pro** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=midudev%20pro&slug=midudev-pro&teamId=team_9BRYiN1B61IdOMjgcUBeBJqe&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2264c8e9723dbbe5753d24dbce118b826e0e5b0b2e%22%7D%2C%22id%22%3A%22Qmbip3JDSTGHmpmLdGwmkn3xrN4NwNzayBM8sxkS3EpUF9%22%2C%22org%22%3A%22midudev%22%2C%22prId%22%3A131%2C%22repo%22%3A%22preguntas-entrevista-react%22%7D).  

- **Issue #130** (2026-04-10): **Archivo preinstall.js disponible en la rama main**
  *Symptoms*: Vi tu video sobre el posible hackeo con el archivo de preinstall.js, ¿porque no lo has eliminado de la rama main?
  **Post-Mortem & Fix Analysis**:
  > 😭 Lo borré en el main pero no hice push

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `3567a45d` (2026-07-20)
**Commit Message**: fix(cls): evita saltos de layout y mejora el buscador y /questions

Varios elementos se pintaban en servidor con un valor provisional que el
cliente corregia despues, desplazando el contenido de alrededor.

Boton de leido: el HTML estatico decia "Marcar leido" y el script lo
cambiaba a "Leido" al resolver localStorage. Ahora no se pinta ninguno
de los dos textos hasta conocer el estado (data-read-ready), y los dos
iconos se apilan en una celda de grid para que el intercambio no
colapse la caja.

Contador de leidas: pintaba un 0 que pasaba a 1, 23 o 138. Reserva
3 caracteres (min-w-[3ch], alineado a la derecha) y sale vacio del
servidor. Ya tenia tabular-nums, asi que el ancho queda fijo.

Autocomplete: la lista saltaba al pasar a mas de 4 resultados, cuando
aparecia la barra de scroll. Se reserva su hueco con scrollbar-gutter.
El panel compacto pasa ademas a 34rem centrados sobre el campo, que se
queda en su ancho actual. Se centra con margin-left y no con translateX
porque el panel ya anima transform al entrar.

Buscador: Cmd+K (Ctrl+K fuera de Apple) y "/" enfocan el campo desde
cualquier punto de la pagina. "/" se ignora si ya estas escribiendo en
un campo de texto. Se anuncia c

**File**: `src/components/ButtonRead.astro` (modified, +33/-7)
```diff
@@ -12,14 +12,42 @@ const { title, autoMark = true } = Astro.props
   data-read-button
   data-title={title}
   data-auto-mark={autoMark ? 'true' : 'false'}
+  data-read-ready="false"
   aria-pressed="false"
   class="pill-tag inline-flex cursor-pointer items-center gap-1 bg-[var(--surface)] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
 >
-  <svg data-icon-unread xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M14 12c0 .5 0 .5 -.5 .5h-3c-.5 0 -.5 0 -.5 -.5s0 -.5 .5 -.5h3c.5 0 .5 0 .5 .5"/><path d="M12 9v6"/></svg>
-  <svg data-icon-read class="hidden" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/></svg>
-  <span data-read-label>Marcar leído</span>
+  <span class="read-icon" aria-hidden="true">
+    <svg data-icon-unread xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M14 12c0 .5 0 .5 -.5 .5h-3c-.5 0 -.5 0 -.5 -.5s0 -.5 .5 -.5h3c.5 0 .5 0 .5 .5"/><path d="M12 9v6"/></svg>
+    <svg data-icon-read xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/></svg>
+  </span>
+  <span class="read-label-text" data-read-label></span>
 </button>
 
+<style>
+  /* Stack both icons in one grid cell so swapping them doesn't collapse the box */
+  .read-icon {
+    display: inline-grid;
+    align-items: center;
+    justify-items: center;
+  }
+
+  .read-icon > * {
+    grid-area: 1 / 1;
+  }
+
+  /* Nothing is shown until the client resolves the stored state */
+  [data-read-ready='false'] [data-icon-read],
+  [data-read-ready='false'] [data-icon-unread],
+  [data-read-ready='false'] .read-label-text {
+    visibility: hidden;
+  }
+
+  [data-read-ready='true'][aria-pressed='true'] [data-icon-unread],
+  [data-read-ready='true'][aria-pressed='false'] [data-icon-read] {
+    visibility: hidden;
+  }
+</style>
+
 <script>
   function getRead(): string[] {
     try {
@@ -62,13 +90,11 @@ const { title, autoMark = true } = Astro.props
     const title = btn.dataset.title || ''
     const isRead = getRead().includes(title)
     const label = btn.querySelector('[data-read-label]')
-    const iconRead = btn.querySelector('[data-icon-read]')
-    const iconUnread = btn.querySelector('[data-icon-unread]')
 
     if (label) label.textContent = isRead ? 'Leído' : 'Marcar leído'
-    iconRead?.classList.toggle('hidden', !isRead)
-    iconUnread?.classList.toggle('hidden', isRead)
+    // Icon visibility is driven by aria-pressed + data-read-ready in CSS
     btn.setAttribute('aria-pressed', isRead ? 'true' : 'false')
+    btn.dataset.readReady = 'true'
     btn.setAttribute(
       'aria-label',
       isRead ? 'Marcar como no leído' : 'Marcar como leído'
```

**File**: `src/components/Header.astro` (modified, +73/-3)
```diff
@@ -46,7 +46,7 @@ const total = counter.total
               class="font-mono tabular-nums text-[0.78rem] text-[var(--fg)]"
               aria-live="polite"
             >
-              <span data-read-count>0</span><span aria-hidden="true">/</span>{total}
+              <span class="inline-block min-w-[3ch] text-right" data-read-count></span><span aria-hidden="true">/</span>{total}
             </span>
           </span>
           <span class="sr-only">preguntas leídas de {total}</span>
@@ -190,7 +190,7 @@ const total = counter.total
                   class="font-mono tabular-nums text-[0.78rem] text-[var(--fg)]"
                   aria-live="polite"
                 >
-                  <span data-read-count>0</span><span aria-hidden="true">/</span
+                  <span class="inline-block min-w-[3ch] text-right" data-read-count></span><span aria-hidden="true">/</span
                   >{total}
                 </span>
               </span>
@@ -238,8 +238,11 @@ const total = counter.total
                 <path d="M6 6l12 12"></path>
               </svg>
             </button>
+            <kbd class="search-shortcut" data-search-shortcut aria-hidden="true">
+              <span data-search-shortcut-mod>Ctrl</span>K
+            </kbd>
             <p id="search-hint" class="sr-only">
-              Escribe al menos 2 caracteres. Usa flechas arriba y abajo para recorrer resultados y Enter para abrir la pregunta.
+              Escribe al menos 2 caracteres. Usa flechas arriba y abajo para recorrer resultados y Enter para abrir la pregunta. Pulsa Control o Comando más K desde cualquier punto de la página para volver al buscador.
             </p>
           </div>
           <div
@@ -663,18 +666,85 @@ const total = counter.total
     })
   }
 
+  function isTypingTarget(el: EventTarget | null) {
+    const node = el as HTMLElement | null
+    if (!node) return false
+    const tag = node.tagName
+    return (
+      tag === 'INPUT' ||
+      tag === 'TEXTAREA' ||
+      tag === 'SELECT' ||
+      node.isContentEditable
+    )
+  }
+
+  function onShortcut(e: KeyboardEvent) {
+    const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
+    const isSlash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
+
+    if (!isCmdK && !isSlash) return
+    // `/` is a legit character while typing; ⌘K should always reach the search
+    if (isSlash && isTypingTarget(document.activeElement)) return
+
+    const { input } = getEls()
+    if (!input) return
+
+    e.preventDefault()
+    input.focus({ preventScroll: true })
+    input.select()
+  }
+
   function onStorage(e: Event) {
     const detail = (e as CustomEvent).detail ?? e
     const key = (detail as any).key
     if (key === 'read' || (e as StorageEvent).key === 'read') paintCounter()
   }
 
+  function paintShortcutBadge() {
+    const isApple = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)
+    document.querySelectorAll<HTMLElement>('[data-search-shortcut]').forEach(badge => {
+      const mod = badge.querySelector('[data-search-shortcut-mod]')
+      if (mod) mod.textContent = isApple ? '⌘' : 'Ctrl'
+      badge.dataset.ready = 'true'
+    })
+  }
+
+  let topbarObserver: ResizeObserver | null = null
+
+  // Publish the sticky topbar's height so other sticky elements can offset
+  // themselves under it. The home page has no topbar, so it stays at 0px.
+  function trackTopbarHeight() {
+    topbarObserver?.disconnect()
+    const topbar = document.querySelector<HTMLElement>('.site-topbar')
+
+    if (!topbar) {
+      document.documentElement.style.setProperty('--topbar-h', '0px')
+      return
+    }
+
+    const update = () => {
+      document.documentElement.style.setProperty(
+        '--topbar-h',
+        `${Math.round(topbar.getBoundingClientRect().height)}px`
+      )
+    }
+
+    update()
+    topbarObserver = new ResizeObserver(update)
+    topbarObserver.observe(topbar)
+  }
+
   paintCounter()
+  paintSho
```

**File**: `src/components/ListOfQuestions.astro` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ const grouped = Array.from(categories.values()).filter(c => c.questions.length >
       const countId = `count-${category.id}`
       return (
       <section aria-labelledby={headingId}>
-        <div class="mb-3 flex items-center justify-between gap-3">
+        <div class="questions-group-header mb-3 flex items-center justify-between gap-3">
           {'level' in category && category.level !== undefined ? (
             <div id={headingId}>
               <Pill level={category.level} as="h3" />
```

**File**: `src/pages/questions.astro` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ const jsonLd = [
   </nav>
 
   <section
-    class="mt-8 animate-fade-in-up animate-duration-700"
+    class="mt-8"
     aria-labelledby="questions-heading"
   >
     <h1
```

**File**: `src/styles/global.css` (modified, +59/-0)
```diff
@@ -667,6 +667,17 @@
   max-height: min(18rem, 48vh);
 }
 
+/* The compact field stays narrow, but the panel spills wider on both sides */
+@media (min-width: 768px) {
+  .search-shell--compact .search-panel {
+    left: 50%;
+    right: auto;
+    width: 34rem;
+    /* margin, not translateX — the panel's entry animation owns `transform` */
+    margin-left: -17rem;
+  }
+}
+
 .search-shell--compact .search-option-link {
   padding: 0.55rem 0.65rem;
   gap: 0.55rem;
@@ -787,6 +798,41 @@
   outline-offset: 2px;
 }
 
+.search-shortcut {
+  flex: 0 0 auto;
+  display: inline-flex;
+  align-items: center;
+  gap: 0.1em;
+  padding: 0.15rem 0.35rem;
+  border: 1px solid var(--hairline-strong);
+  border-radius: 0.25rem;
+  background: var(--surface);
+  color: var(--faint);
+  font-family: var(--font-mono);
+  font-size: 0.7rem;
+  line-height: 1;
+  /* Hidden — not removed — until the client knows which modifier to show */
+  visibility: hidden;
+  transition: opacity 140ms ease;
+}
+
+.search-shortcut[data-ready='true'] {
+  visibility: visible;
+}
+
+/* The hint has done its job once the user is in the field */
+.search-shell:focus-within .search-shortcut,
+.search-shell[data-open='true'] .search-shortcut {
+  opacity: 0;
+  pointer-events: none;
+}
+
+@media (hover: none) {
+  .search-shortcut {
+    display: none;
+  }
+}
+
 .search-panel {
   /* Float over page content — never expand the header / layout */
   display: none;
@@ -815,6 +861,8 @@
   padding: 0.3rem;
   max-height: min(22rem, 52vh);
   overflow-y: auto;
+  /* Reserve the scrollbar track so the list doesn't jump when it overflows */
+  scrollbar-gutter: stable;
   overscroll-behavior: contain;
   scrollbar-width: thin;
   scrollbar-color: var(--hairline-strong) transparent;
@@ -975,6 +1023,17 @@
 
 /* ─── Sticky topbar (non-home pages) ─── */
 
+/* Level heading sticks under the topbar while scrolling its group.
+   --topbar-h is measured on pages that render the sticky topbar; on the
+   home page there is none, so the fallback of 0px applies. */
+.questions-group-header {
+  position: sticky;
+  top: var(--topbar-h, 0px);
+  z-index: 20;
+  padding-block: 0.5rem;
+  background: var(--page-bg, #ffffff);
+}
+
 .site-topbar {
   overflow: visible;
   border-bottom: 1px solid var(--hairline);
```

---

### Incident Patch 2: `1c4aa912` (2026-07-20)
**Commit Message**: fix(a11y): sustituye aria-label por texto oculto en el contador

**File**: `src/components/ListOfQuestions.astro` (modified, +11/-5)
```diff
@@ -59,12 +59,18 @@ const grouped = Array.from(categories.values()).filter(c => c.questions.length >
               {category.label}
             </h3>
           )}
-          <span
-            id={countId}
-            class="font-mono text-xs tabular-nums text-[var(--muted)]"
-            aria-label={`${category.questions.length} preguntas en ${category.label}`}
-          >
+          {/*
+            El texto accesible va como contenido real oculto, no como aria-label:
+            un <span> tiene rol implícito `generic`, donde aria-label está
+            prohibido y los lectores de pantalla pueden ignorarlo. Como este
+            elemento es el destino de un aria-describedby, necesita que la
+            descripción salga de su contenido para resolverse de forma fiable.
+          */}
+          <span id={countId} class="font-mono text-xs tabular-nums text-[var(--muted)]">
             <span aria-hidden="true">{category.questions.length}</span>
+            <span class="sr-only">
+              {category.questions.length} preguntas en {category.label}
+            </span>
           </span>
         </div>
 
```

---

### Incident Patch 3: `26b9acbc` (2026-07-20)
**Commit Message**: fix(code): limita overscroll-behavior al eje horizontal

Los bloques de codigo usaban overscroll-behavior: contain, que tambien
bloqueaba el encadenado vertical: al llegar al final de un bloque alto
el scroll se quedaba atrapado en lugar de seguir con la pagina.

Ahora solo se contiene en horizontal, que es lo que evitaba disparar el
swipe-back del navegador al hacer scroll lateral en el codigo.

**File**: `src/styles/highlight.css` (modified, +4/-1)
```diff
@@ -100,7 +100,10 @@
   display: flex;
   align-items: stretch;
   overflow: auto;
-  overscroll-behavior: contain;
+  /* contain solo en horizontal (evita el swipe-back); en vertical dejamos que
+     el scroll encadene con la página al llegar al límite */
+  overscroll-behavior-x: contain;
+  overscroll-behavior-y: auto;
   max-height: min(32rem, 70vh);
   scrollbar-width: thin;
   scrollbar-color: var(--code-muted) transparent;
```

---

### Incident Patch 4: `9b58e18d` (2026-07-20)
**Commit Message**: revert: elimina las view transitions cross-document

Revierte 5cd1fc4. Quita el bloque @view-transition con el cross-fade
de root, el view-transition-name de la portada del libro y la regla
de cortesia para prefers-reduced-motion, que ya no aplica a nada.

El fade anadia una espera perceptible antes de pintar la pagina nueva
justo cuando el prefetch ya la tenia lista.

**File**: `src/components/BuyBook.astro` (modified, +0/-3)
```diff
@@ -43,9 +43,6 @@ import BookCover from './BookCover.astro'
     right: 1.15rem;
     bottom: 1.15rem;
     z-index: 30;
-    /* Opts out of the page-wide fade so the book stays put across navigations.
-       Animation is disabled in global.css under "View transitions". */
-    view-transition-name: buy-book;
   }
 
   .buy-book-link {
```

**File**: `src/styles/global.css` (modified, +0/-55)
```diff
@@ -247,55 +247,6 @@
   border: 0;
 }
 
-/* ─── View transitions ─── */
-
-/*
-  Cross-document view transitions: pure CSS, zero JS. The browser cross-fades
-  the old page snapshot into the new one on same-origin navigations. Pairs with
-  the existing prefetch/prerender so the new document is usually already warm.
-  Unsupported browsers (Firefox today) simply navigate as before.
-*/
-@view-transition {
-  navigation: auto;
-}
-
-::view-transition-old(root) {
-  animation: vt-fade-out 140ms cubic-bezier(0.4, 0, 1, 1) both;
-}
-
-::view-transition-new(root) {
-  animation: vt-fade-in 180ms cubic-bezier(0, 0, 0.2, 1) both;
-}
-
-@keyframes vt-fade-out {
-  to {
-    opacity: 0;
-  }
-}
-
-@keyframes vt-fade-in {
-  from {
-    opacity: 0;
-  }
-}
-
-/*
-  Persistent chrome. Naming an element lifts it out of the `root` snapshot, so
-  it is no longer part of the page-wide fade. Because the element is identical
-  on both documents, killing its animation makes it appear to never re-render.
-*/
-::view-transition-group(buy-book),
-::view-transition-old(buy-book),
-::view-transition-new(buy-book) {
-  animation: none;
-  mix-blend-mode: normal;
-}
-
-/* Only the incoming copy is painted — no cross-fade of two identical layers. */
-::view-transition-old(buy-book) {
-  display: none;
-}
-
 /* ─── Reduced motion ─── */
 
 @media (prefers-reduced-motion: reduce) {
@@ -307,12 +258,6 @@
     transition-duration: 0.01ms !important;
     scroll-behavior: auto !important;
   }
-
-  /* The blanket rule above already collapses these, but be explicit: no fade. */
-  ::view-transition-old(root),
-  ::view-transition-new(root) {
-    animation: none !important;
-  }
 }
 
 /* ─── Home intro ─── */
```

---

### Incident Patch 5: `8b0b15e1` (2026-07-20)
**Commit Message**: revert: elimina la escalera de animaciones de entrada

Revierte el efecto de d3dd937 y acc44f0. Quita las clases
animate-fade-in-up del home, el header y el titulo, junto al script
inline de sessionStorage que marcaba la entrada como ya vista.

El escalonado retrasaba hasta 600ms la aparicion del contenido de la
home y obligaba a mantener estado de sesion solo para no repetirlo.

**File**: `src/components/Header.astro` (modified, +3/-3)
```diff
@@ -15,7 +15,7 @@ const total = counter.total
     <header class="relative mx-auto w-full max-w-6xl px-5 pb-10 pt-14 md:px-8 md:pt-16">
       <nav
         aria-label="Acciones del sitio"
-        class="site-actions animate-fade-in-up animate-duration-400 absolute right-5 top-2 z-20 md:right-8"
+        class="site-actions absolute right-5 top-2 z-20 md:right-8"
       >
         <ThemeToggle />
         <span class="site-actions-sep" aria-hidden="true"></span>
@@ -57,7 +57,7 @@ const total = counter.total
         <div class="flex gap-x-2">
           <Title isHome />
           <div
-            class="animate-fade-in-up animate-duration-400 animate-delay-60 absolute -right-4 top-6 hidden overflow-hidden p-2 lg:block md:right-0 dark:invert"
+            class="absolute -right-4 top-6 hidden overflow-hidden p-2 lg:block md:right-0 dark:invert"
             aria-hidden="true"
           >
             <div class="translate-x-1/3 sm:translate-x-0">
@@ -68,7 +68,7 @@ const total = counter.total
       </div>
 
       <form
-        class="search-shell animate-fade-in-up animate-duration-400 animate-delay-120 mt-6"
+        class="search-shell mt-6"
         role="search"
         aria-label="Buscar preguntas sobre React"
         data-search-form
```

**File**: `src/components/Title.astro` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ const { isHome = false } = Astro.props
 const classes = [
   'font-display max-w-2xl py-4 font-semibold leading-[1.08] tracking-tight text-balance text-[var(--fg)]',
   isHome
-    ? 'animate-fade-in-up animate-duration-400 animate-delay-60 text-5xl md:text-7xl'
+    ? 'text-5xl md:text-7xl'
     : 'text-2xl md:text-4xl',
 ]
 ---
```

**File**: `src/layouts/BaseLayout.astro` (modified, +0/-19)
```diff
@@ -54,25 +54,6 @@ const {
         root.style.setProperty('--page-fg', dark ? '#ededed' : '#171717')
       })()
     </script>
-    {/*
-      Marca la sesión como "ya ha visto la entrada" para que al volver al home
-      desde una pregunta no se repita la escalera de animaciones.
-      Debe ir inline y antes del primer pintado, igual que el bootstrap de tema:
-      si corriera después, se vería un frame de los elementos ya animándose.
-      sessionStorage (no localStorage) para que la entrada vuelva a verse en una
-      visita nueva, no solo la primera vez en la vida del navegador.
-    */}
-    <script is:inline>
-      ;(function () {
-        try {
-          if (sessionStorage.getItem('entrance-seen')) {
-            document.documentElement.dataset.entranceSeen = ''
-          } else {
-            sessionStorage.setItem('entrance-seen', '1')
-          }
-        } catch (e) {}
-      })()
-    </script>
     <style is:inline>
       /* Critical theme colors — apply before the main CSS bundle loads */
       html {
```

**File**: `src/pages/index.astro` (modified, +11/-21)
```diff
@@ -149,22 +149,22 @@ const jsonLd = [
 >
   <section class="home-intro" aria-labelledby="home-intro-heading">
     <div class="home-intro-copy">
-      <p class="home-intro-kicker animate-fade-in-up animate-duration-400 animate-delay-180">
+      <p class="home-intro-kicker">
         Guía para entrevistas técnicas
       </p>
       <h2
         id="home-intro-heading"
-        class="home-intro-title animate-fade-in-up animate-duration-400 animate-delay-240"
+        class="home-intro-title"
       >
         Preguntas reales.
         <span class="home-intro-title-accent">Respuestas con contexto.</span>
       </h2>
-      <p class="home-intro-lead animate-fade-in-up animate-duration-400 animate-delay-300">
+      <p class="home-intro-lead">
         Los temas que más se repiten en procesos de selección, explicados en
         español y con ejemplos. Practica con criterio, no con definiciones
         memorizadas. Más de {totalQuestions} preguntas.
       </p>
-      <div class="home-intro-actions animate-fade-in-up animate-duration-400 animate-delay-360">
+      <div class="home-intro-actions">
         <a href="#featured-heading" class="home-intro-btn home-intro-btn-primary">
           Ver las más buscadas
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M19 12l-7 7l-7 -7"/></svg>
@@ -176,25 +176,25 @@ const jsonLd = [
     </div>
 
     <ul class="home-intro-levels" aria-label="Preguntas por nivel">
-      <li class="animate-fade-in-up animate-duration-400 animate-delay-420">
+      <li>
         <a href="/questions#category-beginner" class="home-level-chip home-level-chip-easy">
           <span class="home-level-chip-count tabular-nums">{byLevel.beginner}</span>
           <span class="home-level-chip-name">Principiante</span>
         </a>
       </li>
-      <li class="animate-fade-in-up animate-duration-400 animate-delay-460">
+      <li>
         <a href="/questions#category-intermediate" class="home-level-chip home-level-chip-medium">
           <span class="home-level-chip-count tabular-nums">{byLevel.intermediate}</span>
           <span class="home-level-chip-name">Intermedio</span>
         </a>
       </li>
-      <li class="animate-fade-in-up animate-duration-400 animate-delay-500">
+      <li>
         <a href="/questions#category-expert" class="home-level-chip home-level-chip-hard">
           <span class="home-level-chip-count tabular-nums">{byLevel.expert}</span>
           <span class="home-level-chip-name">Experto</span>
         </a>
       </li>
-      <li class="animate-fade-in-up animate-duration-400 animate-delay-540">
+      <li>
         <a href="/questions#category-errors" class="home-level-chip home-level-chip-errors">
           <span class="home-level-chip-count tabular-nums">{byLevel.errors}</span>
           <span class="home-level-chip-name">Errores</span>
@@ -204,7 +204,7 @@ const jsonLd = [
   </section>
 
   <section class="mt-16 md:mt-20" aria-labelledby="featured-heading">
-    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-3 animate-fade-in-up animate-duration-400 animate-delay-600">
+    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
       <h2 id="featured-heading" class="mono-label">
         Las preguntas más buscadas
       </h2>
@@ -218,17 +218,7 @@ const jsonLd = [
     <ul class="m-0 list-none border-b border-[var(--hairline-soft)] p-0">
       {
         featured.map((item, i) => (
-          <li
-            class:list={[
-              'min-w-0 animate-fade-in-up animate-duration-400',
-              i === 0 && 'animate-delay-640',
-              i === 1 && 'animate-delay-680',
-              i === 2 && 'animate-delay-720',
-              i === 3 && 'animate-delay-760',
-              i === 4 && 'animate-delay-800',
-              i === 
```

---

### Incident Patch 6: `4e222d4d` (2026-07-20)
**Commit Message**: chore: elimina los workarounds específicos de Cloudflare

El sitio se despliega directamente en Vercel, así que `data-cfasync="false"`
(que existía para que Rocket Loader no difiriera los scripts inline) ya no
pinta nada. Fuera el atributo de los dos scripts del <head> y ajustadas las
referencias a Cloudflare/CDN en los comentarios.

Verificado en el build: el bootstrap de tema sigue aplicando dark antes del
primer pintado y no queda ninguna mención a Cloudflare en src/ ni en dist/.

**File**: `src/layouts/BaseLayout.astro` (modified, +4/-5)
```diff
@@ -33,10 +33,9 @@ const {
     <meta charset="utf-8" />
     {/*
       Theme bootstrap MUST be the first executable content in <head>.
-      data-cfasync="false" prevents Cloudflare Rocket Loader from deferring it
-      (that deferral is a common cause of light-mode FOUC).
+      Si se difiere, se ve un flash en modo claro antes de aplicar el tema.
     */}
-    <script is:inline data-cfasync="false">
+    <script is:inline>
       ;(function () {
         var root = document.documentElement
         var stored = null
@@ -63,7 +62,7 @@ const {
       sessionStorage (no localStorage) para que la entrada vuelva a verse en una
       visita nueva, no solo la primera vez en la vida del navegador.
     */}
-    <script is:inline data-cfasync="false">
+    <script is:inline>
       ;(function () {
         try {
           if (sessionStorage.getItem('entrance-seen')) {
@@ -91,7 +90,7 @@ const {
         background-color: var(--page-bg, #ffffff);
         color: var(--page-fg, #171717);
       }
-      /* Hide unthemed paint if script is delayed (e.g. by a CDN); removed once data-theme is set */
+      /* Hide unthemed paint if the script is delayed; removed once data-theme is set */
       html:not([data-theme]) {
         visibility: hidden;
       }
```

---

### Incident Patch 7: `22a4af7f` (2026-07-19)
**Commit Message**: fix(headers): move cache headers to vercel.json (site deploys on Vercel)

public/_headers is a Cloudflare/Netlify Pages convention that Vercel
ignores. Vercel already serves /_astro assets as immutable; add SWR
caching for HTML, content/quiz JSON and static images via vercel.json.

**File**: `public/_headers` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-# Default (HTML pages): browser revalidates every time, but the Cloudflare
-# edge may cache for 4h (purged on each deploy). Edge cacheability is what
-# makes hover prefetch/prerender eligible — otherwise Cloudflare refuses
-# speculative requests with 503 (cf-speculation-refused).
-# More specific rules below override this one (last match wins).
-/*
-  Cache-Control: public, max-age=0, s-maxage=14400, stale-while-revalidate=86400
-
-# Hashed build assets: safe to cache forever
-/_astro/*
-  Cache-Control: public, max-age=31536000, immutable
-
-# Content JSON (search index, quiz data): revalidate hourly, serve stale while updating
-/content/*
-  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
-
-/quiz/*
-  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
-
-# Static images / icons (unhashed): one day + grace period
-/*.webp
-  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
-
-/*.png
-  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
-
-/*.svg
-  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
-
-/*.ico
-  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

**File**: `vercel.json` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+{
+  "$schema": "https://openapi.vercel.sh/vercel.json",
+  "headers": [
+    {
+      "source": "/(.*)",
+      "headers": [
+        {
+          "key": "Cache-Control",
+          "value": "public, max-age=0, s-maxage=14400, stale-while-revalidate=86400"
+        }
+      ]
+    },
+    {
+      "source": "/content/(.*)",
+      "headers": [
+        {
+          "key": "Cache-Control",
+          "value": "public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400"
+        }
+      ]
+    },
+    {
+      "source": "/quiz/(.*)",
+      "headers": [
+        {
+          "key": "Cache-Control",
+          "value": "public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400"
+        }
+      ]
+    },
+    {
+      "source": "/(.*)\\.(webp|png|svg|ico|jpg)",
+      "headers": [
+        {
+          "key": "Cache-Control",
+          "value": "public, max-age=86400, stale-while-revalidate=604800"
+        }
+      ]
+    }
+  ]
+}
```

---

### Incident Patch 8: `86dbcd68` (2026-07-19)
**Commit Message**: fix(headers): make HTML edge-cacheable so Cloudflare accepts hover prefetch

Cloudflare refuses speculative prefetch requests (503 cf-speculation-refused)
for pages it cannot serve from its edge cache. Add s-maxage so the edge may
cache HTML while browsers still revalidate on every visit.

**File**: `public/_headers` (modified, +8/-0)
```diff
@@ -1,3 +1,11 @@
+# Default (HTML pages): browser revalidates every time, but the Cloudflare
+# edge may cache for 4h (purged on each deploy). Edge cacheability is what
+# makes hover prefetch/prerender eligible — otherwise Cloudflare refuses
+# speculative requests with 503 (cf-speculation-refused).
+# More specific rules below override this one (last match wins).
+/*
+  Cache-Control: public, max-age=0, s-maxage=14400, stale-while-revalidate=86400
+
 # Hashed build assets: safe to cache forever
 /_astro/*
   Cache-Control: public, max-age=31536000, immutable
```

---

### Incident Patch 9: `0bcbc743` (2026-07-18)
**Commit Message**: fix(ui): slow React logo spin to 30s with valid duration unit

animate-duration-[30000] compiled without a unit and fell back to 0.6s;
use animate-duration-[30s] instead.

**File**: `src/components/ReactLogo.astro` (modified, +2/-1)
```diff
@@ -17,7 +17,8 @@ const {
   class:list={[
     'h-auto',
     size === 'small' ? 'w-12' : 'w-60',
-    animated && 'animate-[spin_30s_linear_infinite]',
+    animated &&
+      'animate-spin-clockwise animate-duration-[30s] animate-iteration-count-infinite animate-linear',
     className,
   ]}
   fill="none"
```

---

### Incident Patch 10: `35f672ee` (2026-07-18)
**Commit Message**: fix(code): keep Prism HTML intact for correct indentation

Stop wrapping each source line in spans — JSX token tags cross newlines
and were producing invalid markup that collapsed indent and line numbers.

**File**: `src/lib/code-blocks.ts` (modified, +18/-22)
```diff
@@ -1,6 +1,11 @@
 /**
  * Wrap Prism-highlighted <pre><code> blocks with a polished shell:
  * language label + sticky line numbers.
+ *
+ * Important: do NOT split the code HTML into per-line wrappers. Prism JSX
+ * (and other grammars) emit token spans that cross newlines; wrapping each
+ * line would produce invalid HTML and the browser would "fix" it by
+ * collapsing indentation and mis-aligning the gutter.
  */
 export function enhanceCodeBlocks(html: string): string {
   return html.replace(
@@ -9,31 +14,12 @@ export function enhanceCodeBlocks(html: string): string {
       const langMatch = String(className).match(/language-([\w+-]+)/i)
       const lang = langMatch?.[1]?.toLowerCase() ?? ''
       const langLabel = formatLangLabel(lang)
+      const lineCount = countLines(codeHtml)
 
-      // Preserve Prism token HTML; split only on real newlines.
-      let lines = codeHtml.split('\n')
-      // Drop a single trailing empty line from a final newline in the source.
-      if (lines.length > 1 && lines[lines.length - 1].trim() === '') {
-        lines = lines.slice(0, -1)
-      }
-      if (lines.length === 0) lines = ['']
-
-      const lineCount = lines.length
       const gutter = Array.from({ length: lineCount }, (_, i) => {
-        const n = i + 1
-        return `<span class="code-line-number">${n}</span>`
+        return `<span class="code-line-number">${i + 1}</span>`
       }).join('')
 
-      // Join without newlines: each .code-line is display:block, and a
-      // literal \n between spans would double the vertical spacing in <pre>.
-      const body = lines
-        .map(line => {
-          // Keep empty lines selectable / non-collapsing via CSS min-height
-          const content = line.length === 0 ? '' : line
-          return `<span class="code-line">${content}</span>`
-        })
-        .join('')
-
       const classAttr = className ? ` class="${className}"` : ''
       const langAttr = lang ? ` data-lang="${escapeAttr(lang)}"` : ''
       const header = langLabel
@@ -45,13 +31,23 @@ export function enhanceCodeBlocks(html: string): string {
         header +
         `<div class="code-block-body">` +
         `<div class="code-gutter" aria-hidden="true">${gutter}</div>` +
-        `<pre class="code-block-pre" tabindex="0"><code${classAttr}>${body}</code></pre>` +
+        // Keep Prism HTML intact (including cross-line token spans)
+        `<pre class="code-block-pre" tabindex="0"><code${classAttr}>${codeHtml}</code></pre>` +
         `</div></div>`
       )
     }
   )
 }
 
+function countLines(codeHtml: string): number {
+  let lines = codeHtml.split('\n')
+  // Drop a single trailing empty line from a final newline in the source
+  if (lines.length > 1 && lines[lines.length - 1] === '') {
+    lines = lines.slice(0, -1)
+  }
+  return Math.max(lines.length, 1)
+}
+
 function formatLangLabel(lang: string): string {
   if (!lang || lang === 'txt' || lang === 'text' || lang === 'plain') return ''
   const map: Record<string, string> = {
```

**File**: `src/styles/highlight.css` (modified, +5/-16)
```diff
@@ -130,6 +130,7 @@
 
 .code-line-number {
   display: block;
+  /* Match pre line box: font-size × unitless line-height on the code column */
   height: calc(var(--code-font-size) * var(--code-line-height));
   padding: 0 0.75rem 0 0.85rem;
   color: var(--code-gutter-fg);
@@ -158,7 +159,8 @@ pre.code-block-pre {
   color: inherit;
   font-family: inherit;
   font-size: inherit;
-  line-height: inherit;
+  /* Fixed line box so gutter numbers stay aligned with source lines */
+  line-height: var(--code-line-height);
   tab-size: 2;
   -moz-tab-size: 2;
   white-space: pre;
@@ -177,6 +179,7 @@ pre.code-block-pre {
 .code-block code,
 .code-block-pre code,
 code[class*='language-'] {
+  display: block;
   font-family: inherit;
   font-size: inherit;
   font-weight: 400;
@@ -191,16 +194,6 @@ code[class*='language-'] {
   tab-size: 2;
 }
 
-.code-line {
-  display: block;
-  min-height: calc(var(--code-font-size) * var(--code-line-height));
-  line-height: calc(var(--code-font-size) * var(--code-line-height));
-}
-
-.code-line:hover {
-  background: var(--code-line-hover);
-}
-
 /* Fallback for unenhanced pre/code (legacy / edge cases) */
 pre[class*='language-']:not(.code-block-pre),
 :not(.code-block) > pre > code[class*='language-'] {
@@ -412,8 +405,4 @@ code[class*='language-'] *::selection {
   }
 }
 
-@media (prefers-reduced-motion: reduce) {
-  .code-line {
-    transition: none;
-  }
-}
+
```

#### Recent Merged Pull Requests:
- **PR #137** (2026-07-18): Enlace roto corregido dentro de "¿Cuáles son las reglas de los hooks … (@ismaeldevmw)
- **PR #135** (2026-04-25): Activar marcado como leido en lista de preguntas (@daniseguraf)
- **PR #134** (2026-05-18): Enhance JSX explanation in que-es-jsx.json (@daniseguraf)
- **PR #133** (2026-04-11): fix: align pill hover styles, theme toggle, and buy book button (@manuelsolano2)
- **PR #131** (2026-04-10): fix(security): remove preinstall.js file & his script on package json (@alesdevux)
- **PR #129** (2026-04-10): fix: sync 'mark as read' status in the same tab using CustomEvent (@nucket)
- **PR #128** (2026-04-10): fix: increase z-index for Combobox options to improve visibility (@javierpiquerasmartinez)
- **PR #125** (closed): Agregar pregunta de soporte multiidioma (i18n) en React y contenido generado asociado (@Copilot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
