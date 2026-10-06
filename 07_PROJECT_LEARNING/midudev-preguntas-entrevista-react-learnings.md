# Forensic Learning Record (Deep Inspection): midudev/preguntas-entrevista-react

> **Canonical Artifact**: `07_PROJECT_LEARNING/midudev-preguntas-entrevista-react-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/midudev/preguntas-entrevista-react](https://github.com/midudev/preguntas-entrevista-react))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:16.657Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `midudev/preguntas-entrevista-react`
- **Description**: Preguntas típicas sobre React para entrevistas de trabajo ⚛️
- **Primary Language / Ecosystem**: Astro
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7834 stars

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
    lines.push('')
  }

  // Soft separation between topics (not a hard page break — the book is long)
  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

async function main() {
  const readme = await fs.readFile(README_PATH, 'utf-8')
  const parsed = parseReadme(readme)

  for (const [label, filePath] of [
    ['introducción', BEFORE_PATH],
    ['cierre', AFTER_PATH],
  ]) {
    if (!(await fs.pathExists(filePath))) {
      throw new Error(
        `Falta el capítulo de ${label} del libro: ${path.relative(ROOT, filePath)}`
      )
    }
  }

  await fs.emptyDir(OUT_DIR)

  // Exclusive frontmatter chapter (source: book/before.md)
  const before = (await fs.readFile(BEFORE_PATH, 'utf-8')).trimEnd() + '\n'
  await fs.outputFile(path.join(OUT_DIR, BEFORE_OUT), before)

  const bookTxt = ['frontmatter:', BEFORE_OUT, 'mainmatter:']

  let totalQuestions = 0
  let withQuiz = 0
  let totalQuizItems = 0

  for (const level of LEVELS) {
    const chapter = parsed.find(
      c =>
        c.levelKey === level.key ||
        c.levelHeading.toLowerCase() === level.heading.toLowerCase()
    )

    if (!chapter || chapter.questions.length === 0) {
      console.warn(`⚠ Capítulo sin contenido: ${level.heading}`)
      continue
    }

    const solutionEntries = []
    const sections = [
      `# ${level.heading}`,
      '',
      `Preguntas de nivel **${level.heading}**. Tras cada explicación puedes encontrar un bloque *Pon a prueba*; las respuestas están al final del capítulo.`,
      '',
      '---',
      '',
    ]

    for (const q of chapter.questions) {
      totalQuestions++
      const quiz = loadQuiz(q.slug)
      let prepared = []

      if (quiz) {
        prepared = quiz
          .map(prepareBookQuestion)
          .filter(Boolean)
        if (prepared.length) {
          withQuiz++
          totalQuizItems += prepared.length
          solutionEntries.push({
            title: q.title,
            answers: prepared.map(p => ({
              letter: p.answerLette
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
            type='button'
            onClick={handleRestart}
            className='home-intro-btn home-intro-btn-primary'
          >
            <IconRefresh size={16} aria-hidden='true' />
            Reintentar
          </button>
        </div>

        <details className='group rounded-md border border-[var(--hairline)] overflow-hidden'>
          <summary className='flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]'>
            <IconChevronDown
              size={16}
              className='transition-transform group-open:rotate-180'
              aria-hidden='true'
            />
            Ver resumen de respuestas
          </summary>
          <ul className='divide-y divide-[var(--hairline-soft)] border-t border-[var(--hairline)]'>
            {questions.map((q, i) => {
              const userAlt = q.alternatives.find(a => a.id === answers[q.id])
              const correctAlt = q.alternatives.find(a => a.is_correct)
              const isCorrect = userAlt?.is_correct
              return (
                <li key={q.id} className='px-4 py-3 text-sm'>
                  <p className='font-medium text-[var(--fg)]'>
                    <span className='mr-1.5 font-mono text-xs text-[var(--faint)]'>
                      {i + 1}.
                    </span>
                    {q.question}
                  </p>
                  <div className='mt-1.5 flex items-start gap-1.5'>
                    {isCorrect ? (
                      <IconCheck
                        size={14}
                        className='mt-0.5 shrink-0 text-emerald-500'
                        aria-hidden='true'
                      />
                    ) : (
                      <IconX
                        size={14}
                        className='mt-0.5 shrink-0 text-red-500'
       
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

### Core Architecture Module: `src/lib/github-stars.ts`
```
const REPO_API =
  'https://api.github.com/repos/midudev/preguntas-entrevista-react'
const SHIELDS_API =
  'https://img.shields.io/github/stars/midudev/preguntas-entrevista-react.json'

/** In-memory cache so a full static build only hits the network once. */
let cached: number | null = null
let inflight: Promise<number | null> | null = null

function parseShieldsMessage(message: string): number | null {
  const compact = message.trim().toLowerCase().replace(/,/g, '')
  const k = compact.match(/^([\d.]+)\s*k$/)
  if (k) return Math.round(parseFloat(k[1]) * 1000)
  const n = Number(compact)
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function fetchFromGithubApi(): Promise<number | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'reactjs.wiki',
    }
    // Optional token for CI / local builds (higher rate limit)
    const token = import.meta.env.GITHUB_TOKEN || import.meta.env.GH_TOKEN
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(REPO_API, { headers })
    if (!res.ok) return null

    const data = (await res.json()) as { stargazers_count?: number }
    const count = data.stargazers_count
    return typeof count === 'number' && count >= 0 ? count : null
  } catch {
    return null
  }
}

/** Fallback when GitHub rate-limits unauthenticated builds. */
async function fetchFromShields(): Promise<number | null> {
  try {
    const res = await fetch(SHIELDS_API, {
      headers: { 'User-Agent': 'reactjs.wiki' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: string }
    if (!data.message) return null
    return parseShieldsMessage(data.message)
  } catch {
    return null
  }
}

/**
 * Fetch stargazers_count once per process. Returns null if every source
 * fails so the UI can fall back gracefully (client script may still recover).
 */
export async function getGithubStars(): Promise<number | null> {
  if (cached != null) return cached
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const count =
        (await fetchFromGithubApi()) ?? (await fetchFromShields())
      if (count == null) return null
      cached = count
      return count
    } finally {
      inflight = null
    }
  })()

  return inflight
}

export function formatStarCount(number: number): string {
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`
  return String(number)
}

```

### Core Architecture Module: `src/lib/markdown.ts`
```
import { marked } from 'marked'

/**
 * Renders inline Markdown (code, emphasis, bold) to HTML.
 * Safe for titles and short labels — no block-level elements.
 */
export function renderInlineMarkdown(text: string): string {
  if (!text) return ''
  return marked.parseInline(text, { async: false }) as string
}

/**
 * Strips Markdown/HTML to plain text (for meta tags, aria-labels, etc.).
 */
export function stripMarkdown(text: string): string {
  if (!text) return ''
  return decodeEntities(
    renderInlineMarkdown(text)
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

```

### Core Architecture Module: `src/lib/posts.ts`
```
import index from '../../public/content/index.json'
import { enhanceCodeBlocks } from './code-blocks'

export type PostIndexItem = {
  id: string
  text: string
  level?: number
}

export type PostData = {
  content: string
  level: number
  title: string
  prev: PostIndexItem | null
  next: PostIndexItem | null
}

const postModules = import.meta.glob('../../public/content/*.json', {
  eager: true,
}) as Record<string, { default?: any } | any>

function loadPostJson(slug: string) {
  const key = Object.keys(postModules).find(k => k.endsWith(`/${slug}.json`))
  if (!key) return null
  const mod = postModules[key]
  return (mod as any).default ?? mod
}

export function readIndex(): PostIndexItem[] {
  return index as PostIndexItem[]
}

export async function fetchPost(slug: string): Promise<PostData | null> {
  const posts = readIndex()
  const currentIndex = posts.findIndex(post => post.id === slug)

  if (currentIndex === -1) {
    return null
  }

  const post = loadPostJson(slug)
  if (!post || !post.content) {
    return null
  }

  const { content, level, title } = post

  const prev = currentIndex > 0 ? posts[currentIndex - 1] : null
  const next = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null

  return {
    content: enhanceCodeBlocks(content),
    level,
    title,
    prev,
    next,
  }
}

export function listPosts() {
  return readIndex().map(post => ({ params: { post: post.id } }))
}

const DESCRIPTION_MAX_LENGTH = 160

export function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toMetaDescription(content: string) {
  const cleanContent = stripHtml(content)

  if (cleanContent.length <= DESCRIPTION_MAX_LENGTH) {
    return cleanContent
  }

  return `${cleanContent.slice(0, DESCRIPTION_MAX_LENGTH - 1).trimEnd()}...`
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
+  paintShortcutBadge()
+  trackTopbarHeight()
   initSearch()
   window.addEventListener('storage', onStorage)
   window.addEventListener('local-storage', onStorage)
+  document.addEventListener('keydown', onShortcut)
   document.addEventListener('astro:page-load', () => {
     paintCounter()
+    paintShortcutBadge()
+    trackTopbarHeight()
     initSearch()
   })
 </script>
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

### Incident Patch 3: `5b5bff84` (2026-07-20)
**Commit Message**: perf(css): incrusta el CSS en el HTML en vez de enlazarlo

El <link rel=stylesheet> creaba una dependencia en serie: el navegador
no descubria la hoja hasta parsear el head, y no pintaba hasta tenerla.
Medido en produccion eran ~55ms de bloqueo (HTML listo a 201ms, CSS
descargado a 257ms). Con el CSS dentro del documento, el HTML llega
listo para pintar y esa espera desaparece.

Primera visita, gzip: home 28377 -> 28604 bytes (+227, -1 RTT), pagina
de pregunta 25480 -> 25302 (-178, -1 RTT). El coste en bytes es nulo o
negativo porque el CSS ya se habia dividido por ruta.

Contrapartida: se pierde el cacheo de la hoja entre paginas, asi que
cada documento repite su CSS. Con prefetchAll activo, el HTML medio
por link prefetcheado pasa de 10525 a 25879 bytes gzip.

Verificado en navegador: los 16 selectores comprobados de la pagina de
articulo dan estilos computados identicos al build anterior.

**File**: `astro.config.mjs` (modified, +10/-0)
```diff
@@ -11,6 +11,16 @@ export default defineConfig({
     prefetchAll: true,
     defaultStrategy: 'hover',
   },
+  build: {
+    // Incrusta el CSS en el HTML en lugar de enlazarlo. El <link> obligaba a un
+    // round-trip extra en serie (el navegador no descubre la hoja hasta que
+    // parsea el head) que bloqueaba el primer pintado. Con el CSS dentro del
+    // documento, el HTML llega listo para pintar.
+    // Se pierde el cacheo de la hoja entre paginas, pero el CSS global ya se
+    // dividio por ruta (global vs article) y el prefetch deja las paginas
+    // calientes de todas formas.
+    inlineStylesheets: 'always',
+  },
   experimental: {
     // Prerender prefetched pages via the Speculation Rules API (Chromium)
     clientPrerender: true,
```

---

### Incident Patch 4: `613e178f` (2026-07-20)
**Commit Message**: perf(css): recorta el CSS critico de subsets y estilos de articulo

Dos cambios sobre el bundle global, que hasta ahora viajaba entero en
todas las paginas (72KB en crudo, 15KB comprimido).

Fuentes: Fontsource declaraba los 11 subsets de Geist y Geist Mono
(cirilico, griego, vietnamita, symbols2). El contenido del sitio es
solo latino, asi que declaramos a mano latin y latin-ext. Los .woff2
sobrantes ya no se descargaban nunca por unicode-range, pero sus
@font-face si ocupaban el CSS critico, y ademas dejamos de emitir 7
ficheros de fuente al build.

Articulo: los estilos de .article-prose y la navegacion entre posts
solo los usa [post].astro. Salen a article.css, que se carga junto a
highlight.css, con el mismo patron que ya seguia el resaltado. Van
envueltos en @layer components para conservar el orden de cascada.

BaseLayout.css: 72578 -> 66639 bytes (13062 comprimido).
Verificado en navegador: los estilos computados de la pagina de
articulo son identicos a produccion en los 15 selectores comprobados.

**File**: `src/pages/[post].astro` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ import {
 } from '../lib/posts'
 import { renderInlineMarkdown, stripMarkdown } from '../lib/markdown'
 import { SITE_URL, SITE_NAME, OG_IMAGE_PATH, absoluteUrl } from '../constants'
+import '../styles/article.css'
 import '../styles/highlight.css'
 
 export function getStaticPaths() {
```

**File**: `src/styles/article.css` (added, +269/-0)
```diff
@@ -0,0 +1,269 @@
+/* Estilos del detalle de pregunta ([post]).
+   Extraído de global.css: solo lo necesita la página de artículo, así que no
+   tiene sentido enviarlo en la home ni en /questions.
+   Los tokens de diseño (--fg, --surface, --hairline...) vienen de global.css,
+   que se carga siempre desde BaseLayout.
+   Va en @layer components para conservar el mismo orden de cascada que tenía. */
+
+@layer components {
+  /* ─── Article detail (question page) ─── */
+
+  .article-shell {
+    max-width: 46rem;
+  }
+
+  .article-meta {
+    display: flex;
+    flex-wrap: wrap;
+    align-items: center;
+    gap: 0.5rem;
+  }
+
+  .article-title {
+    font-family: var(--font-display);
+    font-size: clamp(1.65rem, 1.2rem + 1.6vw, 2.35rem);
+    font-weight: 600;
+    line-height: 1.18;
+    letter-spacing: -0.025em;
+    color: var(--fg);
+    text-wrap: balance;
+  }
+
+  .article-prose {
+    font-size: 1.0625rem;
+    line-height: 1.75;
+    color: var(--page-fg, #171717);
+  }
+
+  .dark .article-prose {
+    color: rgb(212 212 212);
+  }
+
+  @media (min-width: 768px) {
+    .article-prose {
+      font-size: 1.125rem;
+      line-height: 1.8;
+    }
+  }
+
+  .article-prose > *:first-child {
+    margin-top: 0;
+  }
+
+  .article-prose > p {
+    margin: 0 0 1.25em;
+  }
+
+  .article-prose > p:last-child {
+    margin-bottom: 0;
+  }
+
+  .article-prose strong {
+    font-weight: 600;
+    color: var(--fg);
+  }
+
+  .article-prose a {
+    color: var(--accent);
+    font-weight: 500;
+    text-decoration: underline;
+    text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
+    text-underline-offset: 0.18em;
+    text-decoration-thickness: 1px;
+    transition: text-decoration-color 140ms ease;
+  }
+
+  .article-prose a:hover {
+    text-decoration-color: var(--accent);
+  }
+
+  .article-prose ul,
+  .article-prose ol {
+    margin: 0 0 1.35em;
+    padding-left: 1.25em;
+    display: grid;
+    gap: 0.55em;
+  }
+
+  .article-prose ul {
+    list-style: disc;
+  }
+
+  .article-prose ol {
+    list-style: decimal;
+  }
+
+  .article-prose li {
+    padding-left: 0.2em;
+  }
+
+  .article-prose li::marker {
+    color: var(--faint);
+  }
+
+  .article-prose code {
+    font-family: var(--font-mono);
+    font-size: 0.85em;
+    font-weight: 500;
+    padding: 0.1em 0.35em;
+    border-radius: 0.25rem;
+    background: var(--surface);
+    border: 1px solid var(--hairline);
+    color: inherit;
+  }
+
+  /* Fenced code blocks are enhanced to .code-block (see highlight.css).
+     Keep a sensible fallback for plain <pre> without Prism classes. */
+  .article-prose > pre:not(.code-block-pre) {
+    margin: 0 0 1.5em;
+    padding: 1.1rem 1.2rem;
+    overflow-x: auto;
+    border-radius: 0.375rem;
+    border: 1px solid var(--hairline);
+    background: #0a0a0a;
+    color: #e5e5e5;
+    font-family: var(--font-mono);
+    font-size: 0.875rem;
+    line-height: 1.65;
+  }
+
+  .article-prose > pre:not(.code-block-pre) code {
+    padding: 0;
+    border: 0;
+    border-radius: 0;
+    background: transparent;
+    font-weight: 400;
+    font-size: inherit;
+    color: inherit;
+  }
+
+  .article-prose .code-block {
+    margin-top: 0.25em;
+    margin-bottom: 1.6em;
+  }
+
+  .article-prose h1,
+  .article-prose h2,
+  .article-prose h3 {
+    font-family: var(--font-display);
+    font-weight: 600;
+    letter-spacing: -0.02em;
+    color: var(--fg);
+    line-height: 1.25;
+    margin: 1.75em 0 0.65em;
+  }
+
+  .article-prose h1 {
+    font-size: 1.5em;
+  }
+
+  .article-prose h2 {
+    font-size: 1.3em;
+  }
+
+  .article-prose h3 {
+    font-size: 1.12em;
+  }
+
+  .article-prose hr {
+    display: none;
+  }
+
+  .article-prose blockquote {
+    margin: 0 0 1.35em;
+    padding: 0.15rem 0 0.15rem 1rem;
+    border-left: 2px solid var(--accent);
+    border-radius: 0;
+    background: transparent;
+    color: var(--muted);
+  }
+
+  .article-prose img {
+    max-width: 100%;
+    height: auto;
+    border-radius: 0.375rem;
+  }
+
+  /* Prev / next navigation ─ hairline, no boxes */
+  .post-nav {
+    display: grid;
+    gap: 1.25rem;
+    margin-top: 2.5rem;
+    padding-top: 1.75rem;
+    border-top: 1px solid var(--hairline);
+  }
+
+  @media (min-width: 768px) {
+    .post-nav {
+      grid-template-columns: 1fr 1fr;
+      gap: 2rem;
+    }
+  }
+
+  .post-nav-link {
+    display: flex;
+    flex-direction: column;
+    gap: 0.4rem;
+    min-width: 0;
+    padding: 0.25rem;
+    border: 0;
+    border-radius: 0.375rem;
+    background: transparent;
+    color: inherit;
+    text-decoration: none;
+  }
+
+  .post-nav-link[data-dir='next'] {
+    text-align: right;
+    align-items: flex-end;
+  }
+
+  @media (min-width: 768px) {
+    .post-nav-link[data-dir='next'] {
+      grid-column: 2;
+    }
+
+    .post-nav-link[data-dir='prev']:only-child {
+      grid-column: 1;
+    }
+  }
+
+  .post-nav-label {
+    display: inline-flex;
+    align-items: center;
+    g
```

**File**: `src/styles/global.css` (modified, +59/-284)
```diff
@@ -1,7 +1,64 @@
 @import 'tailwindcss';
 @import 'tailwind-animations';
-@import '@fontsource-variable/geist';
-@import '@fontsource-variable/geist-mono';
+
+/* ─── Fuentes ───
+   Los paquetes de Fontsource declaran 11 subsets (cirílico, griego, vietnamita,
+   symbols2...). El contenido del sitio es solo latino, así que declaramos a mano
+   únicamente latin y latin-ext y nos ahorramos 7 @font-face en el CSS crítico.
+   Los .woff2 de los otros subsets nunca se descargaban (el navegador respeta
+   unicode-range), pero sus reglas sí viajaban en cada página. */
+
+@font-face {
+  font-family: 'Geist Variable';
+  font-style: normal;
+  font-display: swap;
+  font-weight: 100 900;
+  src: url('@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')
+    format('woff2-variations');
+  unicode-range:
+    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
+    U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
+    U+2212, U+2215, U+FEFF, U+FFFD;
+}
+
+@font-face {
+  font-family: 'Geist Variable';
+  font-style: normal;
+  font-display: swap;
+  font-weight: 100 900;
+  src: url('@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2')
+    format('woff2-variations');
+  unicode-range:
+    U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304,
+    U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
+    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
+}
+
+@font-face {
+  font-family: 'Geist Mono Variable';
+  font-style: normal;
+  font-display: swap;
+  font-weight: 100 900;
+  src: url('@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2')
+    format('woff2-variations');
+  unicode-range:
+    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
+    U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
+    U+2212, U+2215, U+FEFF, U+FFFD;
+}
+
+@font-face {
+  font-family: 'Geist Mono Variable';
+  font-style: normal;
+  font-display: swap;
+  font-weight: 100 900;
+  src: url('@fontsource-variable/geist-mono/files/geist-mono-latin-ext-wght-normal.woff2')
+    format('woff2-variations');
+  unicode-range:
+    U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304,
+    U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
+    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
+}
 
 /* Match .dark on the root and any descendant (Tailwind v4 class strategy) */
 @custom-variant dark (&:where(.dark, .dark *));
@@ -916,267 +973,6 @@
   line-height: 1;
 }
 
-/* ─── Article detail (question page) ─── */
-
-.article-shell {
-  max-width: 46rem;
-}
-
-.article-meta {
-  display: flex;
-  flex-wrap: wrap;
-  align-items: center;
-  gap: 0.5rem;
-}
-
-.article-title {
-  font-family: var(--font-display);
-  font-size: clamp(1.65rem, 1.2rem + 1.6vw, 2.35rem);
-  font-weight: 600;
-  line-height: 1.18;
-  letter-spacing: -0.025em;
-  color: var(--fg);
-  text-wrap: balance;
-}
-
-.article-prose {
-  font-size: 1.0625rem;
-  line-height: 1.75;
-  color: var(--page-fg, #171717);
-}
-
-.dark .article-prose {
-  color: rgb(212 212 212);
-}
-
-@media (min-width: 768px) {
-  .article-prose {
-    font-size: 1.125rem;
-    line-height: 1.8;
-  }
-}
-
-.article-prose > *:first-child {
-  margin-top: 0;
-}
-
-.article-prose > p {
-  margin: 0 0 1.25em;
-}
-
-.article-prose > p:last-child {
-  margin-bottom: 0;
-}
-
-.article-prose strong {
-  font-weight: 600;
-  color: var(--fg);
-}
-
-.article-prose a {
-  color: var(--accent);
-  font-weight: 500;
-  text-decoration: underline;
-  text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
-  text-underline-offset: 0.18em;
-  text-decoration-thickness: 1px;
-  transition: text-decoration-color 140ms ease;
-}
-
-.article-prose a:hover {
-  text-decoration-color: var(--accent);
-}
-
-.article-prose ul,
-.article-prose ol {
-  margin: 0 0 1.35em;
-  padding-left: 1.25em;
-  display: grid;
-  gap: 0.55em;
-}
-
-.article-prose ul {
-  list-style: disc;
-}
-
-.article-prose ol {
-  list-style: decimal;
-}
-
-.article-prose li {
-  padding-left: 0.2em;
-}
-
-.article-prose li::marker {
-  color: var(--faint);
-}
-
-.article-prose code {
-  font-family: var(--font-mono);
-  font-size: 0.85em;
-  font-weight: 500;
-  padding: 0.1em 0.35em;
-  border-radius: 0.25rem;
-  background: var(--surface);
-  border: 1px solid var(--hairline);
-  color: inherit;
-}
-
-/* Fenced code blocks are enhanced to .code-block (see highlight.css).
-   Keep a sensible fallback for plain <pre> without Prism classes. */
-.article-prose > pre:not(.code-block-pre) {
-  margin: 0 0 1.5em;
-  padding: 1.1rem 1.2rem;
-  overflow-x: auto;
-  border-radius: 0.375rem;
-  border: 1px solid var(--hairline);
-  background: #0a0a0a;
-  color: #e5e5e5;
-  font-family: var(--font-mono);
-  font-size: 0.875rem;
-  line-height: 1.65;
-}
-
-.article-prose > pre:not(.code-block-pre) code {
-  padding: 0;
-  border: 
```

---

### Incident Patch 5: `26b9acbc` (2026-07-20)
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

### Incident Patch 6: `9b58e18d` (2026-07-20)
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

### Incident Patch 7: `8b0b15e1` (2026-07-20)
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
-              i === 5 && 'animate-delay-840',
-            ]}
-          >
+          <li class="min-w-0">
             <Card
               title={item.title}
               excerpt={item.excerpt}
@@ -243,7 +233,7 @@ const jsonLd = [
   </section>
 
   <section
-    class="hero-panel mt-16 animate-fade-in-up animate-duration-400 animate-delay-900 pt-10 md:mt-20 md:pt-12"
+    class="hero-panel mt-16 pt-10 md:mt-20 md:pt-12"
     aria-labelledby="archive-heading"
   >
     <p class="mono-label pb-3">Archivo completo</p>
```

---

### Incident Patch 8: `4e222d4d` (2026-07-20)
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

### Incident Patch 9: `5cd1fc48` (2026-07-20)
**Commit Message**: feat(view-transitions): cross-document fade con CSS nativo

Activa `@view-transition { navigation: auto }` en vez de <ClientRouter />:
misma transición sin JS, sin riesgo para el bootstrap de tema inline ni
para la isla React del Quiz.

Fade asimétrico (140ms out / 180ms in) y opt-out en prefers-reduced-motion.
Reserva el nombre `buy-book` para excluir el libro flotante del fundido.

**File**: `src/styles/global.css` (modified, +55/-0)
```diff
@@ -247,6 +247,55 @@
   border: 0;
 }
 
+/* ─── View transitions ─── */
+
+/*
+  Cross-document view transitions: pure CSS, zero JS. The browser cross-fades
+  the old page snapshot into the new one on same-origin navigations. Pairs with
+  the existing prefetch/prerender so the new document is usually already warm.
+  Unsupported browsers (Firefox today) simply navigate as before.
+*/
+@view-transition {
+  navigation: auto;
+}
+
+::view-transition-old(root) {
+  animation: vt-fade-out 140ms cubic-bezier(0.4, 0, 1, 1) both;
+}
+
+::view-transition-new(root) {
+  animation: vt-fade-in 180ms cubic-bezier(0, 0, 0.2, 1) both;
+}
+
+@keyframes vt-fade-out {
+  to {
+    opacity: 0;
+  }
+}
+
+@keyframes vt-fade-in {
+  from {
+    opacity: 0;
+  }
+}
+
+/*
+  Persistent chrome. Naming an element lifts it out of the `root` snapshot, so
+  it is no longer part of the page-wide fade. Because the element is identical
+  on both documents, killing its animation makes it appear to never re-render.
+*/
+::view-transition-group(buy-book),
+::view-transition-old(buy-book),
+::view-transition-new(buy-book) {
+  animation: none;
+  mix-blend-mode: normal;
+}
+
+/* Only the incoming copy is painted — no cross-fade of two identical layers. */
+::view-transition-old(buy-book) {
+  display: none;
+}
+
 /* ─── Reduced motion ─── */
 
 @media (prefers-reduced-motion: reduce) {
@@ -258,6 +307,12 @@
     transition-duration: 0.01ms !important;
     scroll-behavior: auto !important;
   }
+
+  /* The blanket rule above already collapses these, but be explicit: no fade. */
+  ::view-transition-old(root),
+  ::view-transition-new(root) {
+    animation: none !important;
+  }
 }
 
 /* ─── Home intro ─── */
```

---

### Incident Patch 10: `22a4af7f` (2026-07-19)
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

### Incident Patch 11: `86dbcd68` (2026-07-19)
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

### Incident Patch 12: `be879192` (2026-07-19)
**Commit Message**: perf: prefetch + hover prerender and long-lived cache headers

- Enable prefetchAll with hover strategy and experimental clientPrerender
  (Speculation Rules API) for near-instant navigation in Chromium
- Add _headers: immutable caching for hashed /_astro assets,
  stale-while-revalidate for content/quiz JSON and static images

**File**: `astro.config.mjs` (modified, +8/-0)
```diff
@@ -7,6 +7,14 @@ export default defineConfig({
   site: 'https://www.reactjs.wiki',
   output: 'static',
   trailingSlash: 'never',
+  prefetch: {
+    prefetchAll: true,
+    defaultStrategy: 'hover',
+  },
+  experimental: {
+    // Prerender prefetched pages via the Speculation Rules API (Chromium)
+    clientPrerender: true,
+  },
   integrations: [
     react(),
     sitemap({
```

**File**: `public/_headers` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+# Hashed build assets: safe to cache forever
+/_astro/*
+  Cache-Control: public, max-age=31536000, immutable
+
+# Content JSON (search index, quiz data): revalidate hourly, serve stale while updating
+/content/*
+  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
+
+/quiz/*
+  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
+
+# Static images / icons (unhashed): one day + grace period
+/*.webp
+  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
+
+/*.png
+  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
+
+/*.svg
+  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
+
+/*.ico
+  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

---

### Incident Patch 13: `379cfff5` (2026-07-19)
**Commit Message**: feat(ui): redesign with minimal monochrome theme and Geist fonts

- Geist + Geist Mono (Fontsource variable, self-hosted) with latin preloads
- Neutral light/dark tokens (#fff / #0a0a0a), hairline rules instead of
  cards, shadows and gradients; mono uppercase section labels
- Home featured questions become a ranked leaderboard list; level stats
  lose their boxes; archive section flattened
- Refreshed flat Prism theme for code blocks in both light and dark
- Quiz, footer, topbar, 404 and questions pages aligned to the new look
- Faster entrance stagger (last element settles at ~375ms)
- Detail links drop #content anchors; buy-book dismiss button removed
- Perf: Fuse.js is now a lazy chunk loaded on first search, quiz island
  hydrates on visibility instead of idle

**File**: `package.json` (modified, +4/-2)
```diff
@@ -29,14 +29,16 @@
   "devDependencies": {
     "@types/react": "19.2.17",
     "@types/react-dom": "19.2.3",
+    "markdownlint": "0.41.1",
     "oxlint": "1.74.0",
     "prettier": "3.9.5",
-    "typescript": "6.0.3",
-    "markdownlint": "0.41.1"
+    "typescript": "6.0.3"
   },
   "dependencies": {
     "@astrojs/react": "6.0.1",
     "@astrojs/sitemap": "3.7.3",
+    "@fontsource-variable/geist": "^5.2.9",
+    "@fontsource-variable/geist-mono": "^5.2.8",
     "@sindresorhus/slugify": "3.0.0",
     "@tabler/icons-react": "3.44.0",
     "@tailwindcss/vite": "4.3.3",
```

**File**: `pnpm-lock.yaml` (modified, +16/-0)
```diff
@@ -14,6 +14,12 @@ importers:
       '@astrojs/sitemap':
         specifier: 3.7.3
         version: 3.7.3
+      '@fontsource-variable/geist':
+        specifier: ^5.2.9
+        version: 5.2.9
+      '@fontsource-variable/geist-mono':
+        specifier: ^5.2.8
+        version: 5.2.8
       '@sindresorhus/slugify':
         specifier: 3.0.0
         version: 3.0.0
@@ -478,6 +484,12 @@ packages:
     cpu: [x64]
     os: [win32]
 
+  '@fontsource-variable/geist-mono@5.2.8':
+    resolution: {integrity: sha512-KI5bj+hkkRiHttYHmccotUZ80ZuZyai+RwI1d7UId0clkx/jXxlo8qYK8j54WzmpBjtMoEMPyllV7faDcj+6RA==}
+
+  '@fontsource-variable/geist@5.2.9':
+    resolution: {integrity: sha512-TP+QSBG3wxKGPE33CbMy/L0Nu3qvJ6Fy81Yc4LnQ95xH+i+cfEp8fyU8/kfV14YwszxIFPhnoMTbjL71waVpyQ==}
+
   '@img/colour@1.1.0':
     resolution: {integrity: sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==}
     engines: {node: '>=18'}
@@ -2489,6 +2501,10 @@ snapshots:
   '@esbuild/win32-x64@0.28.1':
     optional: true
 
+  '@fontsource-variable/geist-mono@5.2.8': {}
+
+  '@fontsource-variable/geist@5.2.9': {}
+
   '@img/colour@1.1.0':
     optional: true
 
```

**File**: `src/components/ButtonRead.astro` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ const { title, autoMark = true } = Astro.props
   data-title={title}
   data-auto-mark={autoMark ? 'true' : 'false'}
   aria-pressed="false"
-  class="pill-tag font-bold inline-flex items-center gap-1 transition-colors border-slate-300/60 bg-slate-50 text-slate-600 hover:border-blue-400/50 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
+  class="pill-tag inline-flex cursor-pointer items-center gap-1 bg-[var(--surface)] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
 >
   <svg data-icon-unread xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M14 12c0 .5 0 .5 -.5 .5h-3c-.5 0 -.5 0 -.5 -.5s0 -.5 .5 -.5h3c.5 0 .5 0 .5 .5"/><path d="M12 9v6"/></svg>
   <svg data-icon-read class="hidden" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/></svg>
```

**File**: `src/components/BuyBook.astro` (modified, +11/-129)
```diff
@@ -2,29 +2,7 @@
 import BookCover from './BookCover.astro'
 ---
 
-<aside class="buy-book" aria-label="Promoción del libro" data-buy-book>
-  <button
-    type="button"
-    class="buy-book-close"
-    data-buy-book-dismiss
-    aria-label="Cerrar promoción del libro"
-  >
-    <svg
-      xmlns="http://www.w3.org/2000/svg"
-      width="12"
-      height="12"
-      viewBox="0 0 24 24"
-      fill="none"
-      stroke="currentColor"
-      stroke-width="2.6"
-      stroke-linecap="round"
-      aria-hidden="true"
-    >
-      <path d="M18 6L6 18"></path>
-      <path d="M6 6l12 12"></path>
-    </svg>
-  </button>
-
+<aside class="buy-book" aria-label="Promoción del libro">
   <a
     href="https://leanpub.com/react-preguntas-tipicas"
     target="_blank"
@@ -54,38 +32,6 @@ import BookCover from './BookCover.astro'
     z-index: 30;
   }
 
-  .buy-book-close {
-    position: absolute;
-    top: -0.4rem;
-    right: -0.4rem;
-    z-index: 4;
-    display: grid;
-    place-items: center;
-    width: 1.6rem;
-    height: 1.6rem;
-    border: 1px solid rgb(255 255 255 / 12%);
-    border-radius: 9999px;
-    background: rgb(15 23 42 / 90%);
-    color: rgb(203 213 225);
-    box-shadow: 0 4px 14px rgb(0 0 0 / 35%);
-    cursor: pointer;
-    transition:
-      background-color 140ms ease,
-      color 140ms ease,
-      transform 140ms ease;
-  }
-
-  .buy-book-close:hover {
-    background: rgb(30 41 59);
-    color: white;
-    transform: scale(1.06);
-  }
-
-  .buy-book-close:focus-visible {
-    outline: 2px solid rgb(96 165 250);
-    outline-offset: 2px;
-  }
-
   .buy-book-link {
     display: flex;
     flex-direction: column;
@@ -101,48 +47,27 @@ import BookCover from './BookCover.astro'
   }
 
   .buy-book-link:focus-visible {
-    outline: 2px solid rgb(96 165 250);
+    outline: 2px solid var(--accent);
     outline-offset: 4px;
-    border-radius: 0.5rem;
+    border-radius: 0.375rem;
   }
 
   .buy-book-cta {
-    font-size: 0.78rem;
-    font-weight: 700;
-    letter-spacing: 0.01em;
-    color: rgb(226 232 240);
-    text-shadow: 0 1px 8px rgb(0 0 0 / 45%);
+    font-family: var(--font-mono);
+    font-size: 0.68rem;
+    font-weight: 500;
+    letter-spacing: 0.07em;
+    text-transform: uppercase;
+    color: var(--muted);
     transition: color 140ms ease;
   }
 
   .buy-book-link:hover .buy-book-cta {
-    color: white;
-  }
-
-  :global(html:not(.dark)) .buy-book-close {
-    border-color: rgb(226 232 240);
-    background: white;
-    color: rgb(100 116 139);
-    box-shadow: 0 4px 12px rgb(15 23 42 / 12%);
-  }
-
-  :global(html:not(.dark)) .buy-book-close:hover {
-    background: rgb(248 250 252);
-    color: rgb(15 23 42);
-  }
-
-  :global(html:not(.dark)) .buy-book-cta {
-    color: rgb(51 65 85);
-    text-shadow: none;
-  }
-
-  :global(html:not(.dark)) .buy-book-link:hover .buy-book-cta {
-    color: rgb(29 78 216);
+    color: var(--fg);
   }
 
   @media (prefers-reduced-motion: reduce) {
-    .buy-book-link,
-    .buy-book-close {
+    .buy-book-link {
       transition: none;
     }
 
@@ -151,46 +76,3 @@ import BookCover from './BookCover.astro'
     }
   }
 </style>
-
-<script>
-  const STORAGE_KEY = 'buy-book-dismissed'
-
-  function initBuyBook() {
-    const root = document.querySelector<HTMLElement>('[data-buy-book]')
-    const dismiss = document.querySelector<HTMLButtonElement>(
-      '[data-buy-book-dismiss]'
-    )
-    if (!root || !dismiss) return
-
-    try {
-      if (localStorage.getItem(STORAGE_KEY) === '1') {
-        root.hidden = true
-        return
-      }
-    } catch {
-      /* private mode */
-    }
-
-    if (dismiss.dataset.bound === '1') return
-    dismiss.dataset.bound = '1'
-
-    dismiss.addEventListener('click', () => {
-      root.hidden = true
-      try {
-        localStorage.setItem(STORAGE_KEY, '1')
-      } catch {
-        /* ignore */
-      }
-      const status = document.getElementById('a11y-status')
-      if (status) {
-        status.textContent = ''
-        requestAnimationFrame(() => {
-          status.textContent = 'Promoción del libro cerrada'
-        })
-      }
-    })
-  }
-
-  initBuyBook()
-  document.addEventListener('astro:page-load', initBuyBook)
-</script>
```

**File**: `src/components/Card.astro` (modified, +25/-17)
```diff
@@ -7,34 +7,42 @@ interface Props {
   excerpt: string
   slug: string
   level: number
+  rank?: number
 }
 
-const { title, excerpt, slug, level } = Astro.props
+const { title, excerpt, slug, level, rank } = Astro.props
 const plainTitle = stripMarkdown(title)
 const titleId = `card-title-${slug.replace(/[^a-z0-9-]/gi, '')}`
 const excerptId = `card-excerpt-${slug.replace(/[^a-z0-9-]/gi, '')}`
 ---
 
 <a
-  class="question-card relative z-10 flex h-full min-w-0"
+  class="question-card"
   href={slug}
   aria-labelledby={titleId}
   aria-describedby={excerptId}
 >
-  <article class="flex h-full w-full min-w-0 flex-col gap-y-4">
-    <Pill level={level} as="p" />
-    <h3
-      id={titleId}
-      class="rich-text min-w-0 font-display text-xl font-bold leading-tight text-slate-900 dark:text-white"
-      title={plainTitle}
-      set:html={renderInlineMarkdown(title)}
-    />
-    <p id={excerptId} class="min-w-0 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
+  {
+    rank != null && (
+      <span class="question-card-rank" aria-hidden="true">
+        {String(rank).padStart(2, '0')}
+      </span>
+    )
+  }
+  <span class="flex min-w-0 flex-1 flex-col">
+    <span class="flex min-w-0 items-baseline justify-between gap-3">
+      <span
+        id={titleId}
+        class="question-card-title rich-text"
+        title={plainTitle}
+        set:html={renderInlineMarkdown(title)}
+      />
+      <span class="shrink-0">
+        <Pill level={level} as="span" />
+      </span>
+    </span>
+    <span id={excerptId} class="question-card-excerpt">
       {excerpt}
-    </p>
-    <p class="mt-auto inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400">
-      <span>Abrir respuesta</span>
-      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/></svg>
-    </p>
-  </article>
+    </span>
+  </span>
 </a>
```

**File**: `src/components/Footer.astro` (modified, +13/-26)
```diff
@@ -1,40 +1,27 @@
-<footer class="mt-14 w-full animate-fade-in animate-duration-700">
-  <div class="mx-auto max-w-6xl px-4">
+<footer class="mt-16 w-full animate-fade-in animate-duration-400">
+  <div class="mx-auto max-w-6xl border-t border-[var(--hairline)] px-5 pt-8 md:px-8">
+    <p class="mono-label pb-2">¿Echas en falta una pregunta?</p>
     <a
-      class="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-blue-200/60 bg-linear-to-r from-blue-50 via-white to-indigo-50 px-6 py-5 shadow-sm transition-all hover:border-blue-300/80 hover:shadow-md md:px-8 dark:border-blue-500/15 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/30 dark:hover:border-blue-500/30"
+      class="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] underline decoration-[color-mix(in_srgb,var(--accent)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--accent)]"
       href="https://github.com/midudev/preguntas-entrevista-react/issues/new"
       target="_blank"
       rel="noopener noreferrer"
     >
-      <div class="flex items-center gap-3">
-        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:group-hover:bg-blue-500/25" aria-hidden="true">
-          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9h8"/><path d="M8 13h6"/><path d="M12.99 18.556l-4.99 1.444v-3h-.5c-1.5 0 -2.5 -.98 -2.5 -2.5v-5c0 -1.52 1 -2.5 2.5 -2.5h10c1.5 0 2.5 .98 2.5 2.5v3"/><path d="M16 19h6"/><path d="M19 16v6"/></svg>
-        </span>
-        <div>
-          <p class="font-display text-base font-bold text-slate-900 dark:text-white">
-            ¿Echas en falta una pregunta?
-          </p>
-          <p class="text-xs text-slate-500 dark:text-slate-400">
-            Abre un issue en GitHub y la añadimos
-            <span class="sr-only"> (se abre en una pestaña nueva)</span>
-          </p>
-        </div>
-      </div>
-      <span class="hidden shrink-0 rounded-full border border-blue-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white sm:inline-flex dark:border-blue-500/25 dark:bg-slate-800 dark:text-blue-400 dark:group-hover:bg-blue-500 dark:group-hover:text-white" aria-hidden="true">
-        ¡Avísanos!
-      </span>
+      Abre un issue en GitHub y la añadimos
+      <span class="sr-only"> (se abre en una pestaña nueva)</span>
+      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 7l-10 10"/><path d="M8 7l9 0l0 9"/></svg>
     </a>
   </div>
 
-  <div class="mt-6 border-t border-slate-200/80 py-5 dark:border-slate-800">
-    <div class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 md:flex-row">
-      <p class="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
+  <div class="mt-8 border-t border-[var(--hairline)] py-6">
+    <div class="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-5 md:flex-row md:items-center md:px-8">
+      <p class="flex items-center gap-1.5 text-sm text-[var(--muted)]">
         Desarrollado con
-        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-rose-500" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.572z"/></svg>
+        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-[var(--level-errors)]" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.572z"/></svg>
         <span class="sr-only">amor</span>
         por
         <a
-          class="font-bold text-slate-700 underline decoration-blue-400/40 underline-offset-3 transition-colors hover:text-blue-600 hover:decoration-blue-400 dark:text-slate-300 dark:hover:text-blue-400"
+          class="font-medium text-[var(--fg)] underline decoration-[var(--hairline-strong)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
           href="https://midu.dev/"
           target="_blank"
           rel="noopener noreferrer author"
@@ -45,7 +32,7 @@
       </p>
       <nav aria-label="Enlaces del pie de página">
         <a
-          class="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-
```

**File**: `src/components/Header.astro` (modified, +20/-16)
```diff
@@ -15,7 +15,7 @@ const total = counter.total
     <header class="relative mx-auto w-full max-w-6xl px-5 pb-10 pt-14 md:px-8 md:pt-16">
       <nav
         aria-label="Acciones del sitio"
-        class="site-actions animate-fade-in animate-duration-500 animate-delay-100 absolute right-5 top-2 z-20 md:right-8"
+        class="site-actions animate-fade-in animate-duration-400 animate-delay-50 absolute right-5 top-2 z-20 md:right-8"
       >
         <ThemeToggle />
         <span class="site-actions-sep" aria-hidden="true"></span>
@@ -39,11 +39,11 @@ const total = counter.total
             <path d="M9 12l2 2l4 -4"></path>
           </svg>
           <span class="flex items-baseline gap-1">
-            <span class="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
+            <span class="mono-label text-[0.62rem]">
               Leídas
             </span>
             <span
-              class="tabular-nums text-[0.8rem] font-semibold tracking-tight text-slate-700 dark:text-slate-200"
+              class="font-mono tabular-nums text-[0.78rem] text-[var(--fg)]"
               aria-live="polite"
             >
               <span data-read-count>0</span><span aria-hidden="true">/</span>{total}
@@ -57,7 +57,7 @@ const total = counter.total
         <div class="flex gap-x-2">
           <Title isHome />
           <div
-            class="animate-zoom-in animate-duration-700 animate-delay-300 absolute -right-4 top-6 overflow-hidden p-2 md:right-0 dark:invert"
+            class="animate-zoom-in animate-duration-400 animate-delay-75 absolute -right-4 top-6 overflow-hidden p-2 md:right-0 dark:invert"
             aria-hidden="true"
           >
             <div class="translate-x-1/3 sm:translate-x-0">
@@ -68,7 +68,7 @@ const total = counter.total
       </div>
 
       <form
-        class="search-shell animate-fade-in-up animate-duration-700 animate-delay-400 mt-6"
+        class="search-shell animate-fade-in-up animate-duration-400 animate-delay-100 mt-6"
         role="search"
         aria-label="Buscar preguntas sobre React"
         data-search-form
@@ -129,25 +129,25 @@ const total = counter.total
       </form>
     </header>
   ) : (
-    <header class="site-topbar sticky top-0 z-50 overflow-visible border-b border-slate-200/70 bg-[var(--page-bg,#fafbff)]/85 backdrop-blur-xl dark:border-white/8">
+    <header class="site-topbar sticky top-0 z-50 overflow-visible backdrop-blur-xl">
       <div class="mx-auto flex w-full max-w-6xl flex-col gap-3 overflow-visible px-5 py-3 md:flex-row md:items-center md:gap-4 md:px-8 md:py-3.5">
         <div class="flex items-center justify-between gap-3 md:contents">
           <a
             href="/"
-            class="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg outline-offset-4"
+            class="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-md outline-offset-4"
           >
-            <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 shadow-sm transition group-hover:border-blue-300 group-hover:text-blue-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:border-blue-500/40 dark:group-hover:text-blue-300" aria-hidden="true">
+            <span class="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] transition-colors group-hover:text-[var(--fg)]" aria-hidden="true">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M5 12h14" />
                 <path d="M5 12l6 6" />
                 <path d="M5 12l6 -6" />
               </svg>
             </span>
             <span class="min-w-0">
-              <span class="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
+              <span class="mono-label block text-[10px]">
                 Volver al inicio
               </span>
-              <span class="font-display block truncate text-sm font-bold leading-tight text-slate-900 dark:text-white md:text-base">
+              <span class="font-display block truncate text-sm font-semibold leading-tight text-[var(--fg)] md:text-base">
                 Preguntas de React
               </span>
             </span>
@@ -183,11 +183,11 @@ const total = counter.total
                 <path d="M9 12l2 2l4 -4"></path>
               </svg>
               <span class="flex items-baseline gap-1">
-                <span class="hidden text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:inline dark:text-slate-400">
+                <span class="mono-label hidden text-[0.62rem] sm:inline">
                   Leídas
                 </span>
                 <span
-                  class="tabular-nums text-[0.8rem] font-semibold tracking-tight text-slat
```

**File**: `src/components/ListOfQuestions.astro` (modified, +7/-7)
```diff
@@ -39,7 +39,7 @@ questions.forEach(question => {
 const grouped = Array.from(categories.values()).filter(c => c.questions.length > 0)
 ---
 
-<div class="animate-fade-in animate-duration-700 space-y-8" data-questions-list>
+<div class="animate-fade-in animate-duration-400 space-y-8" data-questions-list>
   {
     grouped.map(category => {
       const headingId = `category-${category.id}`
@@ -54,14 +54,14 @@ const grouped = Array.from(categories.values()).filter(c => c.questions.length >
           ) : (
             <h3
               id={headingId}
-              class="font-display text-xl font-bold text-slate-900 dark:text-white md:text-2xl"
+              class="font-display text-xl font-semibold text-[var(--fg)] md:text-2xl"
             >
               {category.label}
             </h3>
           )}
           <span
             id={countId}
-            class="rounded-full border border-slate-300/80 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-500/60 dark:bg-slate-800/65 dark:text-slate-200"
+            class="font-mono text-xs tabular-nums text-[var(--muted)]"
             aria-label={`${category.questions.length} preguntas en ${category.label}`}
           >
             <span aria-hidden="true">{category.questions.length}</span>
@@ -76,8 +76,8 @@ const grouped = Array.from(categories.values()).filter(c => c.questions.length >
             <li>
               {showReadStatus ? (
                 <a
-                  class="question-row rich-text leading-snug text-slate-800 dark:text-slate-100"
-                  href={`/${id}#content`}
+                  class="question-row rich-text leading-snug"
+                  href={`/${id}`}
                   data-read-item
                   data-read-title={text}
                 >
@@ -87,8 +87,8 @@ const grouped = Array.from(categories.values()).filter(c => c.questions.length >
                 </a>
               ) : (
                 <a
-                  class="question-row rich-text leading-snug text-slate-800 dark:text-slate-100"
-                  href={`/${id}#content`}
+                  class="question-row rich-text leading-snug"
+                  href={`/${id}`}
                 >
                   <span set:html={textHtml} />
                 </a>
```

---

### Incident Patch 14: `0bcbc743` (2026-07-18)
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

### Incident Patch 15: `8b52318e` (2026-07-18)
**Commit Message**: style(ui): simplify floating buy-book promo

Use a minimal book cover with a plain “Comprar libro” label and a
corner dismiss control, without nested CTA chrome.

**File**: `src/components/BuyBook.astro` (modified, +147/-67)
```diff
@@ -2,76 +2,156 @@
 import BookCover from './BookCover.astro'
 ---
 
-<aside
-  class="fixed bottom-4 right-4 z-20 m-4"
-  aria-label="Promoción del libro"
-  data-buy-book
->
-  <div class="relative">
-    <button
-      type="button"
-      class="absolute -right-1 -top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white"
-      data-buy-book-dismiss
-      aria-label="Cerrar promoción del libro"
+<aside class="buy-book" aria-label="Promoción del libro" data-buy-book>
+  <button
+    type="button"
+    class="buy-book-close"
+    data-buy-book-dismiss
+    aria-label="Cerrar promoción del libro"
+  >
+    <svg
+      xmlns="http://www.w3.org/2000/svg"
+      width="12"
+      height="12"
+      viewBox="0 0 24 24"
+      fill="none"
+      stroke="currentColor"
+      stroke-width="2.6"
+      stroke-linecap="round"
+      aria-hidden="true"
     >
-      <svg
-        xmlns="http://www.w3.org/2000/svg"
-        width="14"
-        height="14"
-        viewBox="0 0 24 24"
-        fill="none"
-        stroke="currentColor"
-        stroke-width="2.4"
-        stroke-linecap="round"
-        aria-hidden="true"
-      >
-        <path d="M18 6L6 18"></path>
-        <path d="M6 6l12 12"></path>
-      </svg>
-    </button>
-    <a
-      href="https://leanpub.com/react-preguntas-tipicas"
-      target="_blank"
-      rel="noopener noreferrer"
-      class="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
-      aria-label="Comprar el libro de preguntas típicas de React en Leanpub (se abre en una pestaña nueva)"
-    >
-      <span
-        class="pill-tag mb-4 gap-1 border-slate-300/60 bg-slate-50 font-bold text-slate-600 shadow-[0_8px_30px_rgb(59_130_246_/_12%)] backdrop-blur-md transition-colors hover:border-blue-400/50 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
-        aria-hidden="true"
-      >
-        <svg
-          xmlns="http://www.w3.org/2000/svg"
-          width="13"
-          height="13"
-          viewBox="0 0 24 24"
-          fill="none"
-          stroke="currentColor"
-          stroke-width="2"
-          stroke-linecap="round"
-          stroke-linejoin="round"
-          aria-hidden="true"
-          ><path d="M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path
-            d="M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path
-            d="M17 17h-11v-14h-2"></path><path d="M6 5l14 1l-1 7h-13"></path
-          ></svg
-        >
-        Compra el libro
-      </span>
-      <BookCover width={136} height={176}>
-        <img
-          alt=""
-          src="/book.webp"
-          width="136"
-          height="176"
-          loading="lazy"
-          decoding="async"
-        />
-      </BookCover>
-    </a>
-  </div>
+      <path d="M18 6L6 18"></path>
+      <path d="M6 6l12 12"></path>
+    </svg>
+  </button>
+
+  <a
+    href="https://leanpub.com/react-preguntas-tipicas"
+    target="_blank"
+    rel="noopener noreferrer"
+    class="buy-book-link"
+    aria-label="Comprar el libro de preguntas típicas de React en Leanpub (se abre en una pestaña nueva)"
+  >
+    <BookCover width={120} height={156} rotate={22} rotateHover={6}>
+      <img
+        alt=""
+        src="/book.webp"
+        width="120"
+        height="156"
+        loading="lazy"
+        decoding="async"
+      />
+    </BookCover>
+    <span class="buy-book-cta" aria-hidden="true">Comprar libro</span>
+  </a>
 </aside>
 
+<style>
+  .buy-book {
+    position: fixed;
+    right: 1.15rem;
+    bottom: 1.15rem;
+    z-index: 30;
+  }
+
+  .buy-book-close {
+    position: absolute;
+    top: -0.4rem;
+    right: -0.4rem;
+    z-index: 4;
+    display: grid;
+    place-items: center;
+    width: 1.6rem;
+    height: 1.6rem;
+    border: 1px solid rgb(255 255 255 / 12%);
+    border-radius: 9999px;
+    background: rgb(15 23 42 / 90%);
+    color: rgb(203 213 225);
+    box-shadow: 0 4px 14px rgb(0 0 0 / 35%);
+    cursor: pointer;
+    transition:
+      background-color 140ms ease,
+      color 140ms ease,
+      transform 140ms ease;
+  }
+
+  .buy-book-close:hover {
+    background: rgb(30 41 59);
+    color: white;
+    transform: scale(1.06);
+  }
+
+  .buy-book-close:focus-visible {
+    outline: 2px solid rgb(96 165 250);
+    outline-offset: 2px;
+  }
+
+  .buy-book-link {
+    display: flex;
+    flex-direction: column;
+    align-items: center;
+    gap: 0.55rem;
+    text-decoration: none;
+    color: inherit;
+    transition: transform 180ms cubic
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
