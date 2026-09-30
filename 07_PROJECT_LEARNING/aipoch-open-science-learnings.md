# Forensic Learning Record (Deep Inspection): aipoch/open-science

> **Canonical Artifact**: `07_PROJECT_LEARNING/aipoch-open-science-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aipoch/open-science](https://github.com/aipoch/open-science))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:54:44.689Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aipoch/open-science`
- **Description**: The open-source AI research workbench for scientific research and agent workflows. Local-first, model-agnostic desktop app with extensible skills, MCP tools and connectors, Python/R execution and traceable artifacts for reproducible research on macOS, Windows and Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5326 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/config-root.mjs`
```
export * from '../packages/open-science/config-root.mjs'

```

### Core Architecture Module: `cli/index.mjs`
```
#!/usr/bin/env node

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { reportCliError, runCli } from '../packages/open-science/cli.mjs'

export * from '../packages/open-science/cli.mjs'

const isEntryPoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isEntryPoint) {
  runCli().catch((error) => reportCliError(error))
}

```

### Core Architecture Module: `cli/locate-app.mjs`
```
export * from '../packages/open-science/locate-app.mjs'

```

### Core Architecture Module: `e2e/accessibility-reporter.ts`
```
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult
} from '@playwright/test/reporter'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ACCESSIBILITY_SCAN_ATTACHMENT = 'accessibility-scan'
const ACCESSIBILITY_UI_FINDING_ATTACHMENT = 'accessibility-ui-finding'
const ACCESSIBILITY_UI_READY_ATTACHMENT = 'accessibility-ui-ready'
const ACCESSIBILITY_COLLECT_ALL = process.env.ACCESSIBILITY_COLLECT_ALL === '1'
const DEFAULT_RESULT_PATH = 'test-results/accessibility/accessibility-summary.json'
const ACCESSIBILITY_SURFACES = [
  'Onboarding',
  'Home',
  'Home (narrow)',
  'Onboarding step focus',
  'Go-to locations (open)',
  'New project dialog',
  'Workspace',
  'Settings',
  'Permission request',
  'Project files (narrow)',
  'File preview dialog',
  'Long conversation (dark)',
  'Artifact provenance',
  'Compute settings (narrow, dark)',
  'Conversation recovery warning',
  'Home (375px, light)',
  'Home (375px, dark)',
  'Home (767px, light)',
  'Home (767px, dark)',
  'Reported text (light)',
  'Reported text (dark)'
] as const

type AccessibilitySurface = (typeof ACCESSIBILITY_SURFACES)[number]

type BlockingViolation = {
  id: string
  impact: string | null
  help: string
  nodes: Array<{ html: string; target: unknown }>
}

type AccessibilityScan = {
  surface: AccessibilitySurface
  violations: BlockingViolation[]
}

type AccessibilityUiFinding = {
  surface: string
  message: string
}

type AccessibilityRunInput = {
  runStatus: FullResult['status']
  plannedTests: number
  completedTests: number
  readyTests: number
  scans: AccessibilityScan[]
  uiFindings: AccessibilityUiFinding[]
}

type AccessibilityRunClassification = {
  status: 'passed' | 'advisory' | 'infra-failure'
  findings: number
}

const classifyAccessibilityRun = ({
  runStatus,
  plannedTests,
  completedTests,
  readyTests,
  scans,
  uiFindings
}: AccessibilityRunInput): AccessibilityRunClassification => {
  const axeFindings = scans.reduce((total, scan) => total + scan.violations.length, 0)
  const scannedSurfaces = new Set(scans.map(({ surface }) => surface))
  if (
    plannedTests === 0 ||
    runStatus !== 'passed' ||
    completedTests !== plannedTests ||
    readyTests !== plannedTests ||
    scans.length !== ACCESSIBILITY_SURFACES.length ||
    ACCESSIBILITY_SURFACES.some((surface) => !scannedSurfaces.has(surface))
  ) {
    return { status: 'infra-failure', findings: axeFindings }
  }
  const findings = axeFindings + uiFindings.length
  return {
    status: findings === 0 ? 'passed' : 'advisory',
    findings
  }
}

const formatAccessibilitySummary = (
  result: AccessibilityRunClassification,
  scans: AccessibilityScan[] = [],
  uiFindings: AccessibilityUiFinding[] = []
): string => {
  const heading =
    result.status === 'infra-failure'
      ? 'INFRA_FAILURE'
      : result.status === 'advisory'
        ? 'A11Y_FINDINGS'
        : 'VALID_SCAN'
  const lines = [
    '## Accessibility quality signal',
    '',
    `Result: **${heading}**`,
    '',
    `- axe scans completed: ${scans.length}`,
    `- blocking findings: ${result.findings}`
  ]

  if (result.status === 'infra-failure') {
    lines.push(
      '',
      'The real UI scan did not complete reliably. Inspect Playwright attempt results for failures or retries.'
    )
  } else if (result.status === 'advisory') {
    lines.push('', 'Findings block this pull request.')
    if (scans.some(({ violations }) => violations.length > 0)) {
      lines.push('', '### axe findings', '')
    }
    for (const scan of scans) {
      for (const violation of scan.violations) {
        lines.push(
          `- **${scan.surface} · ${violation.id}** (${violation.impact ?? 'unknown'}): ${violation.help}`
        )
        for (const node of violation.nodes) {
          lines.push(`  - Target: \`${JSON.stringify(node.target)}\`; HTML: \`${node.html}\``)
        }
      }
    }
    for (const finding of uiFindings) {
      lines.push(`- **${finding.surface}**: ${finding.message}`)
    }
  }

  return `${lines.join('\n')}\n`
}

const parseScans = (result: TestResult): AccessibilityScan[] =>
  result.attachments
    .filter(({ name, body }) => name === ACCESSIBILITY_SCAN_ATTACHMENT && body)
    .map(({ body }) => JSON.parse(body!.toString('utf8')) as AccessibilityScan)

const parseUiFindings = (result: TestResult): AccessibilityUiFinding[] =>
  result.attachments
    .filter(({ name, body }) => name === ACCESSIBILITY_UI_FINDING_ATTACHMENT && body)
    .map(({ body }) => JSON.parse(body!.toString('utf8')) as AccessibilityUiFinding)

class AccessibilityReporter implements Reporter {
  private plannedTests = 0
  private unsuccessfulAttempt = false
  private readonly finalResults = new Map<string, TestResult>()

  printsToStdio(): boolean {
    return false
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.plannedTests = suite.allTests().length
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'passed') this.unsuccessfulAttempt = true
    this.finalResults.set(test.id, result)
  }

  async onEnd(fullResult: FullResult): Promise<{ status?: FullResult['status'] } | void> {
    try {
      const scans = [...this.finalResults.values()].flatMap(parseScans)
      const uiFindings = [...this.finalResults.values()].flatMap(parseUiFindings)
      const readyTests = [...this.finalResults.values()].filter((result) =>
        result.attachments.some(({ name }) => name === ACCESSIBILITY_UI_READY_ATTACHMENT)
      ).length
      const result = classifyAccessibilityRun({
        runStatus: this.unsuccessfulAttempt ? 'failed' : fullResult.status,
        plannedTests: this.plannedTests,
        completedTests: this.finalResults.size,
        readyTests,
        scans,
        uiFindings
      })
      const report = {
        schemaVersion: 1,
        ...result,
        runStatus: this.unsuccessfulAttempt ? 'failed' : fullResult.status,
        plannedTests: this.plannedTests,
        completedTests: this.finalResults.size,
        readyTests,
        axeRunCount: scans.length,
        scans,
        uiFindings
      }
      const resultPath = resolve(process.env.ACCESSIBILITY_RESULT_PATH ?? DEFAULT_RESULT_PATH)

      mkdirSync(dirname(resultPath), { recursive: true })
      writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`)
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          formatAccessibilitySummary(result, scans, uiFindings)
        )
      }
      if (result.status !== 'passed') return { status: 'failed' }
      return undefined
    } catch (error) {
      console.error('Failed to publish accessibility scan evidence.', error)
      return { status: 'failed' }
    }
  }
}

export default AccessibilityReporter
export {
  ACCESSIBILITY_COLLECT_ALL,
  ACCESSIBILITY_SCAN_ATTACHMENT,
  ACCESSIBILITY_SURFACES,
  ACCESSIBILITY_UI_FINDING_ATTACHMENT,
  ACCESSIBILITY_UI_READY_ATTACHMENT,
  classifyAccessibilityRun,
  formatAccessibilitySummary
}
export type { AccessibilityScan, AccessibilitySurface, AccessibilityUiFinding }

```

### Core Architecture Module: `e2e/browser/fixture/anchored-content-resize.tsx`
```
import '@/assets/main.css'
import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem
} from '@/components/ui/message-scroller'
function TrailingReply(): JSX.Element {
  const [short, setShort] = useState(false)
  return (
    <>
      {createPortal(
        <button onClick={() => setShort(!short)}>Toggle trailing height</button>,
        document.body
      )}
      <div style={{ height: short ? 24 : 104 }}>Final reply</div>
    </>
  )
}

export function App(): JSX.Element {
  const [added, setAdded] = useState(false)
  return (
    <>
      <button onClick={() => setAdded(true)}>Append turn</button>
      <div style={{ height: 509, width: 700 }}>
        <MessageScrollerProvider
          autoScroll
          defaultScrollPosition="last-anchor"
          scrollPreviousItemPeek={64}
        >
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent>
                <MessageScrollerItem messageId="first" scrollAnchor disableContainment>
                  <div style={{ height: 180 }}>First prompt</div>
                </MessageScrollerItem>
                <MessageScrollerItem messageId="reply" disableContainment>
                  <div style={{ height: 180 }}>First reply</div>
                </MessageScrollerItem>
                {added && (
                  <>
                    <MessageScrollerItem messageId="prompt" scrollAnchor disableContainment>
                      <div style={{ height: 60 }}>Current prompt</div>
                    </MessageScrollerItem>
                    <MessageScrollerItem messageId="tool" disableContainment>
                      <div style={{ height: 36 }}>Completed tool</div>
                    </MessageScrollerItem>
                    <MessageScrollerItem messageId="tail" disableContainment>
                      <TrailingReply />
                    </MessageScrollerItem>
                  </>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)

```

### Core Architecture Module: `e2e/browser/fixture/batch-completion.tsx`
```
import '@/assets/main.css'
import '@/pages/settings/skill-marketplace.css'
import { createRoot } from 'react-dom/client'
import { initI18n, prepareI18nLocale } from '@/i18n'
import { SkillMarketplaceBatchControls } from '@/pages/settings/SkillMarketplaceBatch'
import type { SkillMarketplaceBatch } from '../../../src/shared/skill-marketplace'

const params = new URLSearchParams(location.search)
const failed = params.has('failed')
const batch: SkillMarketplaceBatch = {
  id: 'fixture-batch',
  snapshotId: 'a'.repeat(64),
  status: 'completed',
  items: ['literature-review', 'data-analysis'].map((id, index) => ({
    id,
    version: '1.0.0',
    expectedVersion: null,
    status: failed && index === 0 ? 'failed' : 'succeeded'
  }))
}
// The actual renderer components and CSS run against deterministic boundary data.
window.api = {
  platform: 'darwin',
  settings: { getSkillMarketplaceBatch: async () => batch }
} as typeof window.api
const locale = params.get('locale') === 'zh-Hans' ? 'zh-Hans' : 'en'
document.documentElement.classList.toggle('dark', params.has('dark'))
const noop = (): void => {}

export function Fixture(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-5 text-foreground">
      <h1 className="text-lg font-semibold">
        Batch completion · production components, fixture data
      </h1>
      <section
        aria-label="Skill Marketplace"
        className={`flex ${failed ? 'h-[28rem]' : 'h-80'} flex-col rounded-lg border border-border`}
      >
        <SkillMarketplaceBatchControls
          expanded
          heading={<h2 className="text-sm font-semibold">Skill Marketplace</h2>}
          onOpen={noop}
          onExit={noop}
          mode={undefined}
          filteredCount={2}
          showSelection
          onModeChange={noop}
          onSelectFiltered={noop}
          onClearSelection={noop}
          onBusyChange={noop}
          onChanged={noop}
        >
          {() => (
            <p className="p-5 text-sm text-muted-foreground">literature-review · data-analysis</p>
          )}
        </SkillMarketplaceBatchControls>
      </section>
    </main>
  )
}
void Promise.resolve(prepareI18nLocale(locale)).then(() => {
  initI18n(locale)
  createRoot(document.getElementById('root')!).render(<Fixture />)
})

```

### Core Architecture Module: `e2e/browser/fixture/button-feedback.tsx`
```
import '@/assets/main.css'
import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import { initI18n, prepareI18nLocale } from '@/i18n'
import { isLocale } from '../../../src/shared/locale'
import { UpdateCapsule } from '@/components/UpdateCapsule'
import { ErrorNotice } from '@/components/error-notice'
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog'
import { Button } from '@/components/ui/button'
import { RestoreDefaultPermissionsButton } from '@/pages/settings/RestoreDefaultPermissionsButton'
import { WorkspaceToolCodeBlock } from '@/pages/workspace/WorkspaceToolCodeBlock'
import { ManagedFileDownloadButton } from '@/pages/workspace/ManagedFileDownloadButton'
import { HomePage } from '@/pages/home/HomePage'
import { useProjectStore } from '@/stores/project-store'
import { NetworkProxyForm } from '@/pages/settings/NetworkProxyForm'
import { useSettingsStore } from '@/stores/settings-store'
import { useUpdateStore } from '@/stores/update-store'
import { useTranslation } from 'react-i18next'

const params = new URLSearchParams(location.search)
if (params.has('home')) {
  window.api = {
    projectFiles: { onChanged: () => () => {} },
    github: { getStars: async () => 1000 }
  } as unknown as typeof window.api
  useProjectStore.setState({ isLoaded: true })
}
const requestedLocale = params.get('locale')
const locale = isLocale(requestedLocale) ? requestedLocale : 'en'
await prepareI18nLocale(locale)
initI18n(locale)
document.documentElement.classList.toggle('dark', params.has('dark'))
useUpdateStore.setState({ status: { state: 'available', current: '0.29.0', latest: '0.30.0' } })
let finishSave: (() => void) | undefined
useSettingsStore.setState({
  networkProxy: { mode: 'direct' },
  setNetworkProxy: () =>
    new Promise<void>((resolve) => {
      finishSave = resolve
    })
})
// Test-only native boundary. Clipboard completion/failure never touches the user's clipboard.
let rejectCopy = false
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async () => {
      if (rejectCopy) throw new Error('Clipboard denied')
    }
  }
})

export function Fixture(): React.JSX.Element {
  const { t } = useTranslation()
  const [restoring, setRestoring] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(0)
  const updateOpen = useUpdateStore((state) => state.isDialogOpen)
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-7 p-6 text-foreground">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Open-Science</h1>
          <p className="text-sm text-muted-foreground">Button feedback · production components</p>
        </div>
        <div data-testid="update">
          <UpdateCapsule />
        </div>
      </header>
      <output data-testid="update-open" className="sr-only">
        {String(updateOpen)}
      </output>
      <section className="grid gap-3" aria-label="Action states">
        <h2 className="font-medium">{t('Restore defaults')}</h2>
        <div className="flex flex-wrap gap-3">
          {(['idle', 'loading', 'success', 'error'] as const).map((state) => (
            <RestoreDefaultPermissionsButton key={state} state={state} onRestore={() => {}} />
          ))}
        </div>
      </section>
      <section className="flex flex-wrap items-center gap-4" aria-label="Download states">
        <Button disabled aria-label="Spinner fallback">
          <span className="button-feedback">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t('Installing…')}
          </span>
        </Button>
        {(['idle', 'saving', 'saved', 'error'] as const).map((status) => (
          <ManagedFileDownloadButton
            key={status}
            source="local"
            path="/fixture/report.txt"
            suggestedName="report.txt"
            appearance="primary"
            download={{ status, sizeLimitError: false, execute: async () => {} }}
          />
        ))}
      </section>
      <section aria-label="Code copy">
        <WorkspaceToolCodeBlock code={'mean = sum(values) / len(values)'} copyable />
      </section>
      <ErrorNotice
        title={t('Try again')}
        description={t('Could not copy code. Try again.')}
        primaryButton={{ label: t('Retry'), loading: restoring, onClick: () => setRestoring(true) }}
      />
      <section className="rounded-lg border border-border" aria-label="Proxy form">
        <NetworkProxyForm onDone={() => {}} />
      </section>
      <div
        className="flex flex-wrap gap-2 border-t border-border pt-4"
        aria-label="Fixture controls"
      >
        <Button
          onClick={() => {
            finishSave?.()
          }}
        >
          Finish save
        </Button>
        <Button
          onClick={() => {
            rejectCopy = true
          }}
        >
          Reject next copy
        </Button>
        <Button
          onClick={() => {
            rejectCopy = false
          }}
        >
          Allow copy
        </Button>
        <Button onClick={() => setDialog(true)}>Open confirmation</Button>
        <Button
          onClick={() =>
            useUpdateStore.setState({
              status: { state: 'downloading', current: '0.29.0', latest: '0.30.0', progress: 42 }
            })
          }
        >
          Download progress
        </Button>
      </div>
      <output data-testid="confirm-count">{confirmed}</output>
      <ConfirmActionDialog
        open={dialog}
        title="Confirm action"
        description="Keep focus while the real dialog button changes phase."
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        loadingLabel="Working…"
        loading={confirming}
        onCancel={() => setDialog(false)}
        onConfirm={() => {
          setConfirming(true)
          setConfirmed((n) => n + 1)
        }}
      />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(
  params.has('home') ? (
    <HomePage canDeleteProjects hasCompleteSessionCatalog onOpenGlobalSearch={() => {}} />
  ) : (
    <Fixture />
  )
)

```

### Core Architecture Module: `e2e/browser/fixture/composer-recovery.tsx`
```
import '@/assets/main.css'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { initI18n } from '@/i18n'
import { WebEventRecoveryDialog } from '@/components/WebEventRecoveryDialog'
import { configureComposerDraftStorage } from '@/pages/workspace/composer-draft-storage'
import { WorkspaceComposerDraftsProvider } from '@/pages/workspace/workspace-composer-drafts'
import { useWorkspaceComposerController } from '@/pages/workspace/workspace-composer-controller'
import { docToText } from '@/pages/workspace/composer/composer-doc'
import type { WebEventConnectionPhase } from '../../../src/shared/web-event-connection'
import type { UploadedAttachment } from '../../../src/shared/uploads'

initI18n('en')
configureComposerDraftStorage('fixture-host/principal')
const attachment: UploadedAttachment = {
  id: 'completed',
  sessionId: '.pending',
  name: 'completed.txt',
  originalName: 'completed.txt',
  path: '/verified/completed.txt',
  size: 4,
  draftReceipt: 'fixture-receipt'
}
const uploads = {
  stageLocalFile: (file: File): Promise<UploadedAttachment> =>
    file.name === 'completed.txt' ? Promise.resolve(attachment) : new Promise(() => {}),
  claimLocalFile: async () => {},
  beginTransfer: async () => {
    throw new Error('not used')
  },
  appendTransfer: async () => {
    throw new Error('not used')
  },
  getTransferStatus: async () => null,
  finishTransfer: async () => attachment,
  abortTransfer: async () => {},
  deleteUpload: async () => {},
  recoverDraft: async ({ receipt }: { receipt: string }) =>
    receipt === 'fixture-receipt' ? attachment : null
}
Object.defineProperty(window, 'api', { value: { uploads }, configurable: true })
export const Harness = (): React.JSX.Element => {
  const [recovery, setRecovery] = useState<WebEventConnectionPhase>('live')
  const [project, setProject] = useState('project')
  const composer = useWorkspaceComposerController({
    currentDraftKey: `session-${project}`,
    newConversationDraftKey: `new:${project}`,
    activeProjectId: project,
    activeSession: { id: `session-${project}`, projectId: project },
    pendingCustomizePrefill: undefined,
    onCustomizePrefillApplied: () => {},
    historyEntries: [],
    historyPolicy: {
      catalogSkillIds: new Set(),
      allowedSkillIds: undefined,
      skillCatalogReady: true,
      refreshSkillCatalog: false,
      specialistCatalogReady: true,
      specialistId: undefined,
      loadSkills: async () => {},
      loadSpecialists: async () => {}
    },
    canStageAttachments: true,
    supportsImageInput: true,
    uploads
  })
  return (
    <main>
      <textarea
        aria-label="Draft"
        value={docToText(composer.view.doc)}
        onChange={(event) =>
          composer.actions.changeDoc({ nodes: [{ type: 'text', text: event.target.value }] })
        }
      />
      <button onClick={() => composer.actions.stageFiles([new File(['done'], 'completed.txt')])}>
        Complete upload
      </button>
      <button onClick={() => composer.actions.stageFiles([new File(['wait'], 'pending.txt')])}>
        Start upload
      </button>
      <button onClick={() => setRecovery('reload-required')}>Require reload</button>
      <button onClick={() => setRecovery('authorization-required')}>Require pairing</button>
      <button onClick={() => setProject(project === 'project' ? 'other' : 'project')}>
        Switch project
      </button>
      <button
        onClick={() => {
          Storage.prototype.setItem = () => {
            throw new Error('Storage unavailable')
          }
        }}
      >
        Block storage
      </button>
      <button
        onClick={() => {
          const snapshot = composer.lifecycle.captureSend()
          composer.lifecycle.clearDraft(snapshot.draftKey, snapshot.version)
        }}
      >
        Send
      </button>
      <div data-testid="attachments">
        {composer.view.attachments.map((file) => file.name).join(', ')}
      </div>
      <div data-testid="transfers">
        {composer.view.transfers
          .map((file) => `${file.name}: ${file.status} ${file.error ?? ''}`)
          .join(', ')}
      </div>
      <WebEventRecoveryDialog active={recovery !== 'live'} phase={recovery} />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(
  <WorkspaceComposerDraftsProvider>
    <Harness />
  </WorkspaceComposerDraftsProvider>
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3176** (2026-09-30): **fix(windows-installer): allow reinstall after old parent removal**
  *Symptoms*: ## Problem  Reinstalling after the old installation's parent directory has been moved or deleted can stop with “Open-Science could not safely protect its data folder before updating”, even when no data remains there. The cached `InstallLocation` reaches NSIS `GetFullPathName`, which requires the parent to exist and fails before data/backup checks.  ## Proposed change  Resolve the parent with the Windows API without requiring existence. Reject failed/oversized resolution and parent-attribute errors other than file/path not found. Keep the existing data move, conflict refusal and interrupted-backup restoration.  Add native regression coverage that compiles and executes the production NSIS macros in temporary directories, redirecting only UI output for unattended assertions. It exercises both historical data folder names, Chinese/spaced paths, missing parents/leaves, preservation/restoration, backup collisions and invalid paths.  ## Scope and non-goals  - No new fields, enums, schema, persistent format, database migration or recovery UI. - Existing `OpenScience`/`Open-Science` data and sibling-backup conventions stay supported. Stale installation registrations are tolerated only when the parent is missing. - Does not bypass Notebook resource ownership checks, modify old installed uninstallers or recover Recycle Bin items. - The separately reported generic Notebook uninstall failure still needs detail output to identify its cause. Matching the reproduced installation failure to t
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=e241e1da31ecc9123457135d4a452c1f129eac3f run=36721340378 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** Static inspection found no concrete merge-blocking defects in the pull request changes.

- **Issue #3172** (2026-09-30): **fix(literature): simplify journal mapping hints**
  *Symptoms*: ## Problem  Journal column mapping repeats an attribute-group heading for a single option and keeps explanatory paragraphs visible, making the menu unnecessarily tall.  ## Proposed change  - Move matching and attribute explanations into shared tooltips, available on hover and keyboard focus. - Remove the single-option attribute group heading and its unused translations in all eight locales. - Align option text with the identity group heading; distinguish the heading with smaller, muted, semibold text. - Keep help icons inside the menu and show only the selected role name in the closed field.  ## Scope and non-goals  Renderer presentation only. No import/matching logic, public interfaces, IPC, historical-data compatibility, persisted formats, or enum values change. No dependencies added.  ## Acceptance criteria and validation  Final focused checks ran after the last material edit:  | Behavior | Check | Result | | --- | --- | --- | | Group structure, focus tooltips, selection and existing import behavior | `npx vitest run src/renderer/src/pages/literature/JournalManager.render.test.tsx src/renderer/src/i18n/resources.test.ts` | 812 tests passed, including translation guards | | Renderer types | `npm run typecheck:web` | Passed | | Source quality | `npm run lint` and `git diff --check` | Passed | | Actual component layout and interaction | Ego browser preview of the production JournalManager with synthetic CSV and a stubbed catalog API | Hover, keyboard selection, Escape and sel
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=3462f792f5b2e310562f3b7d599f263ec8812716 run=36707742091 --> ## Codex Review  **Verdict: needs changes**  ### [P1] Wrap new tooltips in a TooltipProvider  **src/renderer/src/pages/literature/JournalManager.tsx:2718**  **Impact:** Opening any journal-column role selector mounts Radix Tooltip components outside a TooltipProvider. Radix throws for the missing provider, so the mapping UI can crash before users can choose roles.  **Recommendation:** Wrap the mapping UI (or JournalManager at an appropriate stable boundary) in TooltipProvider, following the existing TooltipProvider usage conventions.  **Summary:** The new role selector tooltips are mounted without the required TooltipProvider, blocking the journal import mapping workflow when the selector opens.
  > The reported missing `TooltipProvider` is already covered by the existing table-level provider, so no additional wrapper is needed:  - The mapping selector is rendered inside [`LiteratureTable`](https://github.com/aipoch/open-science/blob/3462f792f5b2e310562f3b7d599f263ec8812716/src/renderer/src/pages/literature/JournalManager.tsx#L2669). - [`LiteratureTable` wraps its children in `TooltipProvider`](https://github.com/aipoch/open-science/blob/3462f792f5b2e310562f3b7d599f263ec8812716/src/renderer/src/pages/literature/LiteratureTable.tsx#L14-L19). The Select portal preserves React context. - The [rendering test](https://github.com/aipoch/open-science/blob/3462f792f5b2e310562f3b7d599f263ec8812716/src/renderer/src/pages/literature/JournalManager.render.test.tsx#L95-L124) mounts JournalManager without an added outer provider, opens the selector, focuses both kinds of options, and verifies their tooltip content. The rendering and translation checks passed all 812 tests. A browser preview usi

- **Issue #3169** (2026-09-30): **fix(journals): clarify journal import column roles**
  *Symptoms*: ## Problem  Journal import presents matching columns and saved attributes as one flat list, making Journal name, Abbreviation, ISSN and External journal ID look like literature-table columns.  ## Proposed change  Group the four identity options under **Identify journals** and Journal attribute under **Save as attribute columns**, with always-visible descriptions and separators. Use small muted group headings without shaded backgrounds. Keep Skip outside the groups and align all six selectable options. Preserve concise labels in the closed selector and keep the menu within the viewport.  Clarify the instructions above the mapping table without naming specific metrics: “Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.” Translate the new copy in all eight renderer locales. Extend the existing import rendering test to cover the groups, descriptions, selection and import payload.  ## Scope and non-goals  Owner modules: `page_literature` and `i18n_catalog`. Changes are limited to renderer presentation, copy and existing test coverage. No shared component API, matching behavior, role enum, IPC payload, persistence schema or historical-data compatibility changes. No dependencies added.  ## Acceptance criteria and validation  Final checks ran after the last edit:  | Behavior | Check | Result | | --- | --- | --- | | Grouped roles, selection and import payload; attribute consumers | `npx vitest run src/renderer/src/p
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=230160734164182188304f36d0c9756524a83cea run=36697566789 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the pull request changes.
  > <!-- ai-review:codex --> <!-- ai-review-meta head=a324a1e0e0f127c4fad711e24484ddabc8eb4623 run=36698255019 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the requested changes. Static inspection covered the grouped selector, controlled role flow, callers, tests, shared Select conventions, renderer design guidance, and locale coverage.

- **Issue #3168** (2026-09-30): **fix(credentials): restore Linux KWallet startup**
  *Symptoms*: ## Problem  Fixes #3161. On KDE, the pre-ready credential gate rejected Chromium's selected KWallet backend (`linux-backend-unsupported:KDE`), so an upgrade exited before creating a window. Forcing libsecret can select a different store without the original key; the reported `key-missing-for-existing-ciphertext` safeguard must remain.  ## Proposed change  Match Chromium's ordered desktop/explicit `password-store` selection for KWallet, KWallet 5 and KWallet 6. Probe only the selected daemon's non-secret metadata, using Chromium's fixed wallet folder/key. Capture the default wallet and reject locked, unavailable or unstable metadata before native secret access. Validate the exact Electron backend, decrypt the existing inventory through the existing credential facade, and retain latched recovery after a failure. Update the native recovery guidance in all eight locales.  The D-Bus transport is shared with the existing Secret Service adapter; external consumers continue using the existing bootstrap/runtime facade.  ## Scope and non-goals  - **Historical compatibility:** reuse the original wallet/key and existing ciphertext; no cross-backend conversion or key replacement. - **State/model:** add a process-local `linux-kwallet` identity carrying wallet version/name. No new persisted enum, database column, settings field or IPC model. - **Persistence:** no migration, config/profile relocation or ciphertext rewrite. Native Electron remains the sole owner of secret retrieval/creation. 
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=01dc77b400f375c57ca3dc44b508db8bcb99ccac run=36694604669 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defect was found in the changed code after static inspection of callers, tests, configuration, and repository standards.
  > <!-- ai-review:codex --> <!-- ai-review-meta head=69585d2d77cdb8f1023f9d485ec847fbeded404b run=36696032137 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the reviewed changes.

- **Issue #3167** (2026-09-30): **fix(literature): add an overflow shadow to pinned columns**
  *Symptoms*: ## Problem  The Literature table pins Attachment and Actions on the right, but the fixed region lacks the subtle overflow edge used by Journal tables.  ## Proposed change  Reuse `LiteratureTableScrollArea` for the Library table while retaining its scroll ref, sizing, scrollbar gutter and pagination behavior. Apply the existing Journal gradient to the left edge of the fixed Attachment/Actions region in both the header and rows. Show the edge only while content remains to the right; remove the existing card shadow and header clipping that would hide the gradient. Keep row hover/focus backgrounds inherited by the pinned cells.  ## Scope and non-goals  Renderer presentation only. No historical-data compatibility, domain enum/state, persistence, schema, IPC, localization, or dependency changes. Existing Journal consumers keep their defaults.  ## Acceptance criteria and validation  Checks ran after the last material edit, on commit `2ac7b6ce0`:  | Behavior / scope | Project-owned check | Final evidence | | --- | --- | --- | | Owner module, contracts and registered consumers (including Journal) | `OPEN_SCIENCE_TEST_MAX_WORKERS=2 npm run test:module -- page_literature` | 5,752 passed, 1 skipped; 13 environment failures (9 timeouts during local resource contention, 4 sandbox socket denials), all passed in the focused rerun below | | Failed cases plus Library fixed-column wiring and scroll-edge lifecycle | Focused command below, one worker outside sandbox; original timeout limits retai
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=2ac7b6ce0ebf8afa8cbb25b03f89b9a89b236ff1 run=36693766294 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** Static inspection found no concrete merge-blocking defects in the pull request changes.

- **Issue #3165** (2026-09-30): **fix(literature): correct merged table preview styling**
  *Symptoms*: ## Problem  Parsed PDF tables only draw vertical borders on merged cells. Row hover paints the entire area of row-spanning cells, while first-row and colspan styling creates uneven backgrounds in multi-level headers. Numeric and text cells also use inconsistent alignment.  ## Proposed change  Give every displayed cell a complete collapsed border and neutral background. Highlight only the hovered cell and align all content to the start, retaining tabular numerals, numeric no-wrap, and vertical centering for row-spanning cells. Remove first-child sizing because DOM position does not identify the logical first column below a rowspan.  ## Scope and non-goals  The production change is confined to the PDF table preview stylesheet. The approved preview rules are also documented in `docs/design.md`, including the PDF-specific exception to default numeric right alignment. Source text, spans, extraction, copying and downloading are unchanged. No historical-data migration or compatibility branch, new state/enum, persistence change, dependency, or new UI copy is required. Existing cached tables receive the new styling directly.  ## Acceptance criteria and validation  Implementation commit: `31a68d3`; final head: `18552fc` (design clarification only). Runtime checks below ran after the final source edit; the design document passed formatting and diff checks after its final edit.  | Behavior | Project-owned check | Result | | --- | --- | --- | | Cell grid, neutral two-level headers, unifor
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=31a68d305eb5c19265c4b3118963afd3d0f70e09 run=36692004399 --> ## Codex Review  **Verdict: needs changes**  ### [P2] Keep numeric table cells right-aligned  **src/renderer/src/pages/workspace/previews/renderers/pdf-research-table.css:39**  **Impact:** Removing the numeric alignment override leaves every `data-numeric` cell inheriting `text-align: start`, so comparable numeric columns become left-aligned in the normal LTR UI. This makes research-table values harder to scan and violates the documented requirement to right-align numeric columns.  **Recommendation:** Retain `text-align: end` in the `.pdf-research-table td[data-numeric]` rule while keeping the new wrapping and grid styles.  **Summary:** Static inspection found one concrete regression against the repository’s table presentation standard.
  > <!-- ai-review:codex --> <!-- ai-review-meta head=18552fc95d48cc47115daf48f29470823d76bd7d run=36693158029 --> ## Codex Review  **Verdict: mergeable**  **No actionable findings.**  **Summary:** No concrete merge-blocking defects found in the requested commit range after static inspection.

- **Issue #3163** (2026-09-30): **fix(notebook): harden Python and R scientific lineage capture**
  *Symptoms*: ## Problem  Multi-cell scientific notebooks can lose dependency and file lineage at helper/callback boundaries, path handoffs, SQLite cursor reads, memory-mapped updates, or a cell failure after writing a usable checkpoint. R capture wrappers must also preserve promise evaluation and caller environments without closing their own protocol connections.  ## Proposed change  - Extend conservative Python/R dependency and source-file effects, including callback bindings, imported scripts, unpacked paths, cwd handoffs, and scientific library operations. Keep unresolved script/callback effects partial or unknown. - Keep recursive copytree read coverage partial and callback/kwargs effects conservative; treat SQLite execute as mutation/external-state by default, including SELECT. Synchronize architecture consumer expectations with additive registrations. - Require imported pathlib and Scanpy receiver identities before applying known effects; preserve partial/unknown effects for rebound or unmodeled callables. - Preserve immutable output generations from incomplete execution, and use bounded checksum comparison for declared writes whose size and mtime do not change. - Preserve R save semantics and protect capture/protocol connections during connection cleanup. - Add reduced, provider-neutral multi-cell examples under `src/main/notebook/fixtures/lineage/`: readonly SQLite, cwd/unpacked/atomic paths, R sourced-script/callback inputs, and a four-cell Python/R failed-checkpoint handoff. Sha
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=64fb346d0038f414b29219c50ffd4fb5d4db9d2c run=36674995687 --> ## Codex Review  **Verdict: needs changes**  ### [P1] Namespace-qualified R connection cleanup bypasses the guard  **resources/notebook/r_loop.R:989**  **Impact:** The replacement is installed only in baseenv(), while base::closeAllConnections() resolves the namespace binding. A notebook can therefore close the kernel request/capture connections, breaking subsequent requests and output capture; the added test explicitly exercises this call form.  **Recommendation:** Install the guarded binding in the base namespace as well as the package environment, or otherwise ensure both unqualified and base::closeAllConnections() resolve to the guarded implementation.  ### [P1] SQLite execute calls are classified as read-only  **src/main/notebook/python-library-effects.ts:302**  **Impact:** Because Connection.execute and Cursor.execute are registered with effect 'read', SQL such as UPDATE
  > <!-- ai-review:codex --> <!-- ai-review-meta head=5637a0fd8957858714e6c3eb6ff2d4dc8474112c run=36677769995 --> ## Codex Review  **Verdict: needs changes**  ### [P1] Do not report recursive copytree reads as complete  **src/main/notebook/dependency-analysis-python.ts:8716**  **Impact:** `shutil.copytree` records only the source directory path and leaves `unresolvedReads` false. Evidence capture therefore selects no descendant input files, can report complete read coverage, and omit the actual files needed for replay (especially with custom copy functions or dynamic directory contents).  **Recommendation:** Mark recursive directory reads as unresolved/partial, or add a read-directory scope and make initial-generation selection capture all descendants; also account for custom `copy_function`/kwargs.  **Summary:** Static inspection found one merge-blocking lineage coverage defect in the new directory-copy handling.
  > Addressed recursive-copy coverage: `shutil.copytree` retains source/destination identities and the destination directory scope, but recursive reads are now partial because those identities do not enumerate descendant inputs. Custom `ignore`/`copy_function` callbacks and expanded kwargs also keep writes and external effects partial. Added regressions for the default copy, keyword callbacks, positional callbacks, and expanded kwargs.  Addressed SQLite execution: both Connection.execute and Cursor.execute now conservatively retain mutation/external-state effects while preserving the cursor return type. No SQL parser or SELECT whitelist was introduced; SELECT is intentionally conservative too. Regressions cover SELECT, UPDATE, INSERT, DELETE and DDL, including receiver dependencies in a subsequent cell.  The R namespace concern was not reproducible in the production executor with R 4.4.3. Both `closeAllConnections()` and `base::closeAllConnections()` pass the live regression: user sinks/co

- **Issue #3162** (2026-09-30): **fix(pdf-structure): preserve native figure and table content**
  *Symptoms*: ## Problem  Scientific PDFs can lose figure panels, captions, table records, parent headings, merged-cell ownership or notes when model boundaries disagree with native text and rules. Repeated cohorts, wrapped records and separate caption pages make these failures difficult to distinguish from legitimately empty or unstructured content.  ## Proposed change  - Recover connected figure panels, framed diagrams and separated or continued captions using native graphics and text ownership. Preserve disjoint crop regions without including intervening prose. - Recover native table headers, cohort boundaries, repeated measurements, omitted records and merged cells from independent rule, alignment, count and source-ownership evidence. Restore shared statistics only when the complete categorical scope is proved. - Retain native statistical symbols, wrapped notes and unstructured records. Keep ambiguous spans and source diagnostics instead of inventing cells, words or statistical scope. - Add 265 anonymized difficult-layout fixtures and 106 new regression test files, with semantic names and no source document IDs or local paths. Register them with the existing literature module. The large fixture diff records the failure evidence and rejection cases accumulated across the supplied PDF batches.  ## Scope and non-goals  Changes are limited to the offline PDF parser, its result-normalization adapter, regressions and literature-module test registration. Original PDFs, local plans, reports, i
  **Post-Mortem & Fix Analysis**:
  > <!-- ai-review:codex --> <!-- ai-review-meta head=b8fd3e7c63a9d1e27b4876d5dc26a9e2b6f58a91 run=36672331760 --> ## Codex Review  **Verdict: needs changes**  ### [P2] Continued caption regions are not restored for rotated pages  **resources/pdf-structure/literature-pdf-extract.mjs:753**  **Impact:** Only the primary caption rectangle is converted back to original PDF coordinates. The rectangles in caption.regions remain in upright extraction coordinates, so source jumps and highlights for continued captions on rotated pages are displaced or incorrect.  **Recommendation:** Restore every caption.regions rectangle using its own page geometry and rotation, just as the primary caption rectangle is restored.  **Summary:** Static review found one concrete coordinate-conversion regression affecting continued figure captions on rotated PDFs.
  > Restored every continued-caption source rectangle using its own page geometry and the difference between analysis and native rotation. Caption part objects are copied during restoration so separate owners sharing a source array cannot transform the same part twice.  Added coverage for 0/90/180/270-degree rotations, different native page rotations, shared caption parts, and existing single-page captions. Verified the actual installed ONNX extraction and production result normalization on a two-page native PDF with opposite content rotations; both source rectangles match the original PDF's native text bounds, and both original pages were visually checked.  Also changed the two CodeQL-flagged comparison-symbol substitutions in the regression test to `replaceAll`, preserving all occurrences consistently.  Validation: PDF module 246 files / 3,140 tests passed (two existing Windows skips); the affected comparison-symbol suite passed after its adjustment (14 tests); Node and sandbox type chec
  > <!-- ai-review:codex --> <!-- ai-review-meta head=c51bdaeec09edb35a357d722bdc35938c80f85b3 run=36674923902 --> ## Codex Review  **Verdict: needs changes**  ### [P1] Coalescing rows leaves stale indexes that crash extraction  **resources/pdf-structure/literature-pdf-ruled-column-grid.mjs:367**  **Impact:** When a numeric estimate row is merged with its parenthesized range row, `groups` and `bands` shrink but `main` does not. The later `main.flatMap` can then access `groups[n]` as undefined and throw, failing extraction for valid tables using this layout.  **Recommendation:** Keep `main`, `groups`, and `bands` aligned during coalescing, or iterate the mutated arrays and guard missing groups before calling `.map`.  ### [P2] Missing predicted columns cause a TypeError  **resources/pdf-structure/literature-pdf-ruled-column-grid.mjs:925**  **Impact:** For a captioned closed grid with no vertical rules and zero predicted `table column` objects, the `predicted.length <= 2` branch evaluates `pr

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

### Incident Patch 1: `fb6f449a` (2026-09-30)
**Commit Message**: fix(windows-installer): allow reinstall after old parent removal (#3176)

Resolve the registered install parent without requiring it to exist, while retaining attribute-error and data-conflict safeguards. Native NSIS regressions fail on the original code for both historical data folder names and pass after the fix.

**File**: `build/installer.nsh` (modified, +18/-1)
```diff
@@ -65,7 +65,24 @@ FunctionEnd
   StrCpy ${BACKUP} ""
   ${if} "${DIR}" != ""
     ClearErrors
-    GetFullPathName $R2 "${DIR}\.."
+    # NSIS GetFullPathName requires the parent to exist. A stale InstallLocation may outlive
+    # that directory after a manual move/delete. Resolve lexically with the Windows API so
+    # absent data is a no-op, while existing data and interrupted backups still use the guards.
+    System::Call 'kernel32::GetFullPathName(t "${DIR}\..", i ${NSIS_MAX_STRLEN}, t .R2, p 0) i.R3'
+    ${if} $R3 == 0
+    ${orIf} $R3 >= ${NSIS_MAX_STRLEN}
+      SetErrors
+    ${else}
+      # Only a missing parent is harmless. Keep refusing paths whose attributes cannot be read
+      # for other reasons (permissions, unavailable drives, invalid paths).
+      System::Call 'kernel32::GetFileAttributes(t R2) i.R3 ?e'
+      Pop $R4
+      ${if} $R3 == -1
+      ${andIf} $R4 != 2
+      ${andIf} $R4 != 3
+        SetErrors
+      ${endif}
+    ${endif}
     ${if} ${Errors}
       DetailPrint `Open-Science data protection failure code=parent-path-unresolved path="${DIR}\${FOLDER}"`
       DetailPrint `Could not safely preserve "${DIR}\${FOLDER}"; its parent path could not be resolved.`
```

**File**: `build/packaging.test.ts` (modified, +137/-0)
```diff
@@ -5,6 +5,7 @@ import {
   mkdirSync,
   mkdtempSync,
   readFileSync,
+  readdirSync,
   realpathSync,
   rmSync,
   writeFileSync
@@ -25,6 +26,142 @@ const appBuilderLibRoot = dirname(appBuilderLibPath)
 const appBuilderRequire = createRequire(appBuilderLibPath)
 const { createPackageWithOptions, listPackage } = appBuilderRequire('@electron/asar')
 
+// Use an existing electron-builder NSIS cache; tests must not download a compiler.
+function findNsisCompiler(): string | undefined {
+  if (process.platform !== 'win32') return undefined
+  if (process.env.NSIS_TEST_COMPILER) return process.env.NSIS_TEST_COMPILER
+  const cache =
+    process.env.ELECTRON_BUILDER_CACHE ??
+    join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache')
+  if (!existsSync(cache)) return undefined
+  for (const entry of readdirSync(cache, { withFileTypes: true })) {
+    if (!entry.isDirectory() || !entry.name.startsWith('nsis')) continue
+    const directory = join(cache, entry.name)
+    const direct = join(directory, 'makensis.exe')
+    if (existsSync(direct)) return direct
+    for (const child of readdirSync(directory, { withFileTypes: true })) {
+      const compiler = join(directory, child.name, 'makensis.exe')
+      if (child.isDirectory() && existsSync(compiler)) return compiler
+    }
+  }
+  return undefined
+}
+
+const nsisCompiler = findNsisCompiler()
+
+describe.skipIf(!nsisCompiler).each(['OpenScience', 'Open-Science'])(
+  'NSIS data preservation native behavior (%s)',
+  (folder) => {
+    it.each([
+      'missing-parent',
+      'missing-install',
+      'existing-data',
+      'interrupted-backup',
+      'backup-conflict',
+      'backup-file',
+      'invalid-parent'
+    ])('protects data during reinstall with %s', (scenario) => {
+      const root = mkdtempSync(join(tmpdir(), 'nsis-preservation-'))
+      const parent = join(
+        root,
+        scenario === 'invalid-parent' ? 'invalid?parent' : 'Open Science 科学'
+      )
+      try {
+        const install = join(parent, 'open-science')
+        const data = join(install, folder)
+        const slot = folder === 'OpenScience' ? 'per-user' : 'per-user-branded'
+        const backup = join(parent, `.open-science-update-data-${slot}`)
+        const conflict = scenario === 'backup-conflict' || scenario === 'backup-file'
+        if (scenario !== 'missing-parent' && scenario !== 'invalid-parent') mkdirSync(parent)
+        if (scenario === 'existing-data' || conflict) {
+          mkdirSync(data, { recursive: true })
+          writeFileSync(join(data, 'sentinel.txt'), 'existing user data')
+        }
+        if (scenario === 'interrupted-backup' || scenario === 'backup-conflict') {
+          mkdirSync(backup)
+          writeFileSync(join(backup, 'sentinel.txt'), 'preserved user data')
+        }
+        if (scenario === 'backup-file') writeFileSync(backup, 'unrelated file')
+        const include = readFileSync(join(repoRoot, 'build/installer.nsh'), 'utf8')
+        const macro = include.match(
+          /!macro preserveNamedDataRoot DIR BACKUP SLOT FOLDER[\s\S]*?!macroend/
+        )?.[0]
+        expect(macro).toBeDefined()
+        const restore = include.match(
+          /!macro restoreNamedDataRoot DIR BACKUP FOLDER[\s\S]*?!macroend/
+        )?.[0]
+        expect(restore).toBeDefined()
+        // Execute the production macro with real NSIS filesystem operations. Redirect only
+        // UI output to a file so an error dialog cannot block unattended regression runs.
+        const observed = `${macro}\n${restore}`
+          .replace(/^\s*DetailPrint (.+)$/gm, 'FileWriteUTF16LE $9 $1')
+          .replace(/^\s*MessageBox MB_OK\|MB_ICONSTOP (.+)$/gm, 'FileWriteUTF16LE $9 $1')
+        const output = join(root, 'result.txt')
+        const executable = join(root, 'probe.exe')
+        const source = join(root, 'probe.nsi')
+        writeFileSync(
+          source,
+          `\uFEFFUnicode true
+!include "LogicLib.nsh"
+Name "Isolated data preserva
```

---

### Incident Patch 2: `f9d9c6b8` (2026-09-30)
**Commit Message**: fix(literature): simplify journal mapping hints (#3172)

**File**: `src/renderer/src/pages/literature/JournalManager.render.test.tsx` (modified, +13/-9)
```diff
@@ -108,15 +108,19 @@ it('keeps custom namespaces editable and rejects blank or invalid values before
         .getAllByRole('option')
         .map((option) => option.textContent)
     ).toEqual(['Journal name', 'Abbreviation', 'ISSN', 'External journal ID'])
-    expect(
-      within(identityGroup).getByText('Used for matching, not as attribute columns.')
-    ).toBeTruthy()
-    const attributeGroup = screen.getByRole('group', { name: 'Save as attribute columns' })
-    expect(within(attributeGroup).getAllByRole('option')).toHaveLength(1)
-    expect(within(attributeGroup).getByRole('option', { name: 'Journal attribute' })).toBeTruthy()
-    expect(
-      within(attributeGroup).getByText('Show and filter these columns in the literature table.')
-    ).toBeTruthy()
+    expect(screen.queryByText('Save as attribute columns')).toBeNull()
+    expect(screen.queryByText('Used for matching, not as attribute columns.')).toBeNull()
+    expect(screen.queryByText('Show and filter these columns in the literature table.')).toBeNull()
+    const attributeOption = screen.getByRole('option', { name: 'Journal attribute' })
+    expect(attributeOption.closest('[role="group"]')).toBeNull()
+    await act(async () => attributeOption.focus())
+    expect((await screen.findByRole('tooltip')).textContent).toBe(
+      'Show and filter these columns in the literature table.'
+    )
+    await act(async () => within(identityGroup).getByRole('option', { name: 'ISSN' }).focus())
+    expect((await screen.findByRole('tooltip')).textContent).toBe(
+      'Used for matching, not as attribute columns.'
+    )
     expect(screen.getByRole('option', { name: 'Skip' }).closest('[role="group"]')).toBeNull()
     fireEvent.click(within(identityGroup).getByRole('option', { name: 'External journal ID' }))
     expect(screen.getByRole('combobox', { name: 'Role for column 2' }).textContent).toBe(
```

**File**: `src/renderer/src/pages/literature/JournalManager.tsx` (modified, +38/-28)
```diff
@@ -20,6 +20,7 @@ import {
   Eye,
   EyeOff,
   Hash,
+  Info,
   List,
   ListChecks,
   LoaderCircle,
@@ -2708,42 +2709,51 @@ export const JournalManager = memo(function JournalManager({
                             })}
                             className="w-full max-w-40 min-w-0"
                           >
-                            <SelectValue />
+                            <SelectValue>{roles[column.role]}</SelectValue>
                           </SelectTrigger>
-                          <SelectContent className="max-h-[min(28rem,var(--radix-select-content-available-height))] w-72 max-w-[calc(100vw-2rem)]">
-                            <SelectItem value="ignore" className="pl-4">
-                              {roles.ignore}
-                            </SelectItem>
+                          <SelectContent className="w-60 max-w-[calc(100vw-2rem)]">
+                            <SelectItem value="ignore">{roles.ignore}</SelectItem>
                             <SelectSeparator />
                             <SelectGroup>
-                              <div className="mb-1 px-2 py-2">
-                                <SelectLabel className="p-0 text-xs font-semibold text-muted-foreground">
-                                  {t('Identify journals')}
-                                </SelectLabel>
-                                <p className="mt-1 text-xs text-muted-foreground">
+                              <Tooltip>
+                                <TooltipTrigger asChild>
+                                  <SelectLabel className="flex items-center gap-1.5 py-2 font-semibold">
+                                    {t('Identify journals')}
+                                    <Info className="size-3.5" aria-hidden="true" />
+                                  </SelectLabel>
+                                </TooltipTrigger>
+                                <TooltipContent side="right">
                                   {t('Used for matching, not as attribute columns.')}
-                                </p>
-                              </div>
+                                </TooltipContent>
+                              </Tooltip>
                               {(['name', 'alias', 'issn', 'externalId'] as const).map((value) => (
-                                <SelectItem key={value} value={value} className="pl-4">
-                                  {roles[value]}
-                                </SelectItem>
+                                <Tooltip key={value}>
+                                  <TooltipTrigger asChild>
+                                    <SelectItem value={value}>{roles[value]}</SelectItem>
+                                  </TooltipTrigger>
+                                  <TooltipContent side="right">
+                                    {t('Used for matching, not as attribute columns.')}
+                                  </TooltipContent>
+                                </Tooltip>
                               ))}
                             </SelectGroup>
                             <SelectSeparator />
-                            <SelectGroup>
-                              <div className="mb-1 px-2 py-2">
-                                <SelectLabel className="p-0 text-xs font-semibold text-muted-foreground">
-                                  {t('Save as attribute columns')}
-                                </SelectLabel>
-                                <p className="mt-1 text-xs text-muted-foreground">
-                                  {t('Show and filter these columns in the literature table.')}
-                                </p>
-                              </div>
-                              <SelectItem value="attribute" className="pl-4">
-                                {roles.attribute}
-                              </SelectItem>
-                            </SelectGroup>
+                            <Tooltip>
+                              <Tooltip
```

**File**: `src/shared/i18n/locales/de.json` (modified, +0/-1)
```diff
@@ -6644,7 +6644,6 @@
     "Match status": "Abgleichstatus",
     "Identify journals": "Zeitschriften identifizieren",
     "Used for matching, not as attribute columns.": "Zum Abgleichen, nicht als Attributspalten.",
-    "Save as attribute columns": "Als Attributspalten speichern",
     "Show and filter these columns in the literature table.": "Diese Spalten in der Literaturliste anzeigen und filtern.",
     "Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.": "Identitätsspalten dienen zum Abgleichen von Zeitschriften. Wählen Sie Zeitschriftenattribut für Werte, die Sie in der Literaturliste anzeigen und filtern möchten.",
     "Saved name and Value type apply only to journal attributes. Skipped columns are not saved.": "Gespeicherter Name und Werttyp gelten nur für Zeitschriftenattribute. Übersprungene Spalten werden nicht gespeichert.",
```

**File**: `src/shared/i18n/locales/es.json` (modified, +0/-1)
```diff
@@ -6811,7 +6811,6 @@
     "Match status": "Estado de correspondencia",
     "Identify journals": "Identificar revistas",
     "Used for matching, not as attribute columns.": "Para buscar coincidencias, no como columnas de atributos.",
-    "Save as attribute columns": "Guardar como atributos",
     "Show and filter these columns in the literature table.": "Mostrar y filtrar estas columnas en la lista bibliográfica.",
     "Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.": "Las columnas de identificación sirven para buscar coincidencias entre revistas. Seleccione Atributo de revista para los valores que desee mostrar y filtrar en la lista bibliográfica.",
     "Saved name and Value type apply only to journal attributes. Skipped columns are not saved.": "Nombre guardado y tipo de valor se aplican solo a los atributos de revista. Las columnas omitidas no se guardan.",
```

**File**: `src/shared/i18n/locales/fr.json` (modified, +0/-1)
```diff
@@ -6811,7 +6811,6 @@
     "Match status": "État de correspondance",
     "Identify journals": "Identifier les revues",
     "Used for matching, not as attribute columns.": "Pour la correspondance, pas comme colonnes d’attributs.",
-    "Save as attribute columns": "Enregistrer comme attributs",
     "Show and filter these columns in the literature table.": "Afficher et filtrer ces colonnes dans la liste bibliographique.",
     "Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.": "Les colonnes d’identification servent à faire correspondre les revues. Choisissez Attribut de revue pour les valeurs à afficher et à filtrer dans la liste bibliographique.",
     "Saved name and Value type apply only to journal attributes. Skipped columns are not saved.": "Le nom enregistré et le type de valeur s’appliquent uniquement aux attributs de revue. Les colonnes ignorées ne sont pas enregistrées.",
```

---

### Incident Patch 3: `29641551` (2026-09-30)
**Commit Message**: fix(journals): clarify journal import column roles (#3169)

* fix(journals): clarify journal import column roles

Separate journal identity matching from saved attribute columns with labelled groups and visible explanations. Keep selectable items aligned and translate the new copy in all renderer locales.

* fix(journals): simplify journal import guidance

**File**: `src/renderer/src/pages/literature/JournalManager.render.test.tsx` (modified, +27/-2)
```diff
@@ -1,6 +1,6 @@
 // @vitest-environment jsdom
 import { StrictMode } from 'react'
-import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
+import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
 import { afterEach, beforeAll, expect, it, vi } from 'vitest'
 import { read } from 'styled-exceljs'
 import { JournalManager } from './JournalManager'
@@ -96,7 +96,32 @@ it('keeps custom namespaces editable and rejects blank or invalid values before
     Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) })
     fireEvent.change(screen.getByLabelText('Import journal file'), { target: { files: [file] } })
     await screen.findByText(file.name)
-    await choose('Role for column 2', 'External journal ID')
+    expect(
+      screen.getByText(
+        'Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.'
+      )
+    ).toBeTruthy()
+    fireEvent.click(screen.getByRole('combobox', { name: 'Role for column 2' }))
+    const identityGroup = await screen.findByRole('group', { name: 'Identify journals' })
+    expect(
+      within(identityGroup)
+        .getAllByRole('option')
+        .map((option) => option.textContent)
+    ).toEqual(['Journal name', 'Abbreviation', 'ISSN', 'External journal ID'])
+    expect(
+      within(identityGroup).getByText('Used for matching, not as attribute columns.')
+    ).toBeTruthy()
+    const attributeGroup = screen.getByRole('group', { name: 'Save as attribute columns' })
+    expect(within(attributeGroup).getAllByRole('option')).toHaveLength(1)
+    expect(within(attributeGroup).getByRole('option', { name: 'Journal attribute' })).toBeTruthy()
+    expect(
+      within(attributeGroup).getByText('Show and filter these columns in the literature table.')
+    ).toBeTruthy()
+    expect(screen.getByRole('option', { name: 'Skip' }).closest('[role="group"]')).toBeNull()
+    fireEvent.click(within(identityGroup).getByRole('option', { name: 'External journal ID' }))
+    expect(screen.getByRole('combobox', { name: 'Role for column 2' }).textContent).toBe(
+      'External journal ID'
+    )
     await choose('Role for column 3', 'Journal attribute')
     await choose('External identifier namespace', 'Custom namespace')
     const input = screen.getByRole('textbox', { name: 'Custom namespace' }) as HTMLInputElement
```

**File**: `src/renderer/src/pages/literature/JournalManager.tsx` (modified, +47/-10)
```diff
@@ -44,7 +44,9 @@ import { useFileDropZone } from '@/hooks/useFileDropZone'
 import {
   Select,
   SelectContent,
+  SelectGroup,
   SelectItem,
+  SelectLabel,
   SelectSeparator,
   SelectTrigger,
   SelectValue
@@ -2632,11 +2634,18 @@ export const JournalManager = memo(function JournalManager({
               )}
             </p>
           ) : null}
-          <p className="text-xs text-muted-foreground">
-            {t(
-              'Original column and Example value come from your file. Import as controls matching or storing. Saved name and Value type apply to journal attributes. Skipped columns are not saved.'
-            )}
-          </p>
+          <div className="space-y-1 text-xs text-muted-foreground">
+            <p>
+              {t(
+                'Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.'
+              )}
+            </p>
+            <p>
+              {t(
+                'Saved name and Value type apply only to journal attributes. Skipped columns are not saved.'
+              )}
+            </p>
+          </div>
           {dataset ? (
             <label className="flex items-center gap-2 text-xs">
               {t('Existing values')}
@@ -2701,12 +2710,40 @@ export const JournalManager = memo(function JournalManager({
                           >
                             <SelectValue />
                           </SelectTrigger>
-                          <SelectContent>
-                            {Object.entries(roles).map(([value, label]) => (
-                              <SelectItem key={value} value={value}>
-                                {label}
+                          <SelectContent className="max-h-[min(28rem,var(--radix-select-content-available-height))] w-72 max-w-[calc(100vw-2rem)]">
+                            <SelectItem value="ignore" className="pl-4">
+                              {roles.ignore}
+                            </SelectItem>
+                            <SelectSeparator />
+                            <SelectGroup>
+                              <div className="mb-1 px-2 py-2">
+                                <SelectLabel className="p-0 text-xs font-semibold text-muted-foreground">
+                                  {t('Identify journals')}
+                                </SelectLabel>
+                                <p className="mt-1 text-xs text-muted-foreground">
+                                  {t('Used for matching, not as attribute columns.')}
+                                </p>
+                              </div>
+                              {(['name', 'alias', 'issn', 'externalId'] as const).map((value) => (
+                                <SelectItem key={value} value={value} className="pl-4">
+                                  {roles[value]}
+                                </SelectItem>
+                              ))}
+                            </SelectGroup>
+                            <SelectSeparator />
+                            <SelectGroup>
+                              <div className="mb-1 px-2 py-2">
+                                <SelectLabel className="p-0 text-xs font-semibold text-muted-foreground">
+                                  {t('Save as attribute columns')}
+                                </SelectLabel>
+                                <p className="mt-1 text-xs text-muted-foreground">
+                                  {t('Show and filter these columns in the literature table.')}
+                                </p>
+                              </div>
+                              <SelectItem value="attribute" className="pl-4">
+                                {roles.attribute}
                               </SelectItem>
-                            ))}
+                            </SelectGroup>
                           </SelectContent>
                         </Select>
                       </td>
```

**File**: `src/shared/i18n/locales/de.json` (modified, +6/-1)
```diff
@@ -6642,7 +6642,12 @@
     "Export journal bundle": "Zeitschriftenpaket exportieren",
     "Sort ascending": "Aufsteigend sortieren",
     "Match status": "Abgleichstatus",
-    "Original column and Example value come from your file. Import as controls matching or storing. Saved name and Value type apply to journal attributes. Skipped columns are not saved.": "Ursprüngliche Spalte und Beispielwert stammen aus Ihrer Datei. Importieren als steuert das Abgleichen oder Speichern. Gespeicherter Name und Werttyp gelten für Zeitschriftenattribute. Übersprungene Spalten werden nicht gespeichert.",
+    "Identify journals": "Zeitschriften identifizieren",
+    "Used for matching, not as attribute columns.": "Zum Abgleichen, nicht als Attributspalten.",
+    "Save as attribute columns": "Als Attributspalten speichern",
+    "Show and filter these columns in the literature table.": "Diese Spalten in der Literaturliste anzeigen und filtern.",
+    "Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.": "Identitätsspalten dienen zum Abgleichen von Zeitschriften. Wählen Sie Zeitschriftenattribut für Werte, die Sie in der Literaturliste anzeigen und filtern möchten.",
+    "Saved name and Value type apply only to journal attributes. Skipped columns are not saved.": "Gespeicherter Name und Werttyp gelten nur für Zeitschriftenattribute. Übersprungene Spalten werden nicht gespeichert.",
     "Journal attribute": "Zeitschriftenattribut",
     "External journal ID": "Externe Journal-ID",
     "Matched by external journal ID": "Über externe Journal-ID zugeordnet",
```

**File**: `src/shared/i18n/locales/es.json` (modified, +6/-1)
```diff
@@ -6809,7 +6809,12 @@
     "Export journal bundle": "Exportar paquete de revistas",
     "Sort ascending": "Ordenar de forma ascendente",
     "Match status": "Estado de correspondencia",
-    "Original column and Example value come from your file. Import as controls matching or storing. Saved name and Value type apply to journal attributes. Skipped columns are not saved.": "Columna original y valor de ejemplo proceden de su archivo. Importar como controla la coincidencia o el almacenamiento. Nombre guardado y tipo de valor se aplican a los atributos de revista. Las columnas omitidas no se guardan.",
+    "Identify journals": "Identificar revistas",
+    "Used for matching, not as attribute columns.": "Para buscar coincidencias, no como columnas de atributos.",
+    "Save as attribute columns": "Guardar como atributos",
+    "Show and filter these columns in the literature table.": "Mostrar y filtrar estas columnas en la lista bibliográfica.",
+    "Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.": "Las columnas de identificación sirven para buscar coincidencias entre revistas. Seleccione Atributo de revista para los valores que desee mostrar y filtrar en la lista bibliográfica.",
+    "Saved name and Value type apply only to journal attributes. Skipped columns are not saved.": "Nombre guardado y tipo de valor se aplican solo a los atributos de revista. Las columnas omitidas no se guardan.",
     "Journal attribute": "Atributo de revista",
     "External journal ID": "ID externo de la revista",
     "Matched by external journal ID": "Coincide por ID externo de la revista",
```

**File**: `src/shared/i18n/locales/fr.json` (modified, +6/-1)
```diff
@@ -6809,7 +6809,12 @@
     "Export journal bundle": "Exporter le paquet de revues",
     "Sort ascending": "Trier par ordre croissant",
     "Match status": "État de correspondance",
-    "Original column and Example value come from your file. Import as controls matching or storing. Saved name and Value type apply to journal attributes. Skipped columns are not saved.": "La colonne d’origine et la valeur d’exemple proviennent de votre fichier. Importer comme définit la correspondance ou l’enregistrement. Le nom enregistré et le type de valeur s’appliquent aux attributs de revue. Les colonnes ignorées ne sont pas enregistrées.",
+    "Identify journals": "Identifier les revues",
+    "Used for matching, not as attribute columns.": "Pour la correspondance, pas comme colonnes d’attributs.",
+    "Save as attribute columns": "Enregistrer comme attributs",
+    "Show and filter these columns in the literature table.": "Afficher et filtrer ces colonnes dans la liste bibliographique.",
+    "Use identity columns to match journals. Choose Journal attribute for values to show and filter in the literature table.": "Les colonnes d’identification servent à faire correspondre les revues. Choisissez Attribut de revue pour les valeurs à afficher et à filtrer dans la liste bibliographique.",
+    "Saved name and Value type apply only to journal attributes. Skipped columns are not saved.": "Le nom enregistré et le type de valeur s’appliquent uniquement aux attributs de revue. Les colonnes ignorées ne sont pas enregistrées.",
     "Journal attribute": "Attribut de revue",
     "External journal ID": "Identifiant externe du journal",
     "Matched by external journal ID": "Associé par identifiant externe du journal",
```

---

### Incident Patch 4: `6553fc3f` (2026-09-30)
**Commit Message**: fix(credentials): restore Linux KWallet startup (#3168)

* fix(credentials): restore Linux KWallet startup

Probe the original Chromium-selected KWallet backend before native secret access and retain the existing missing-key and recovery guards. Reuse historical ciphertext without switching stores or changing persisted formats.

* test(credentials): isolate locked KWallet startup fixture

**File**: `scripts/ci/module-impact/desktop_composition.json` (modified, +3/-0)
```diff
@@ -178,6 +178,9 @@
     "src/main/credential-identity/bootstrap.ts",
     "src/main/credential-identity/ciphertext-inventory.test.ts",
     "src/main/credential-identity/ciphertext-inventory.ts",
+    "src/main/credential-identity/linux-backend.ts",
+    "src/main/credential-identity/linux-dbus.ts",
+    "src/main/credential-identity/linux-kwallet.ts",
     "src/main/credential-identity/linux-secret-service.ts",
     "src/main/credential-identity/linux.test.ts",
     "src/main/credential-identity/persistence.test.ts",
```

**File**: `src/main/credential-identity/access.ts` (modified, +14/-14)
```diff
@@ -40,27 +40,25 @@ export const createCredentialAccess = (options: {
   }
   const check = (reading: boolean): void => {
     if (failure) throw failure
-    if (
-      reading &&
-      (options.identity.backend === 'mac-keychain' ||
-        options.identity.backend === 'linux-secret-service') &&
-      !options.identity.exists &&
-      !written
-    )
+    if (reading && 'exists' in options.identity && !options.identity.exists && !written)
       return fail('read-before-key-created')
-    if (options.identity.backend === 'linux-secret-service') {
+    if (
+      options.identity.backend === 'linux-secret-service' ||
+      options.identity.backend === 'linux-kwallet'
+    ) {
+      const expectedBackend =
+        options.identity.backend === 'linux-kwallet'
+          ? options.identity.passwordStore
+          : 'gnome_libsecret'
       try {
-        if (options.cipher.getSelectedStorageBackend?.() !== 'gnome_libsecret')
+        if (options.cipher.getSelectedStorageBackend?.() !== expectedBackend)
           return fail('linux-backend-unavailable-or-changed')
       } catch {
         return fail('linux-backend-unavailable-or-changed')
       }
     }
     if (checked) return
-    if (
-      options.identity.backend === 'mac-keychain' ||
-      options.identity.backend === 'linux-secret-service'
-    ) {
+    if ('exists' in options.identity) {
       let result: IdentityProbeResult
       try {
         result = options.probe(options.identity.appName)
@@ -86,7 +84,9 @@ export const createCredentialAccess = (options: {
       check(false)
       try {
         if (!options.cipher.isEncryptionAvailable()) return fail('credential-access-unavailable')
-        checked = options.identity.backend !== 'linux-secret-service'
+        checked =
+          options.identity.backend !== 'linux-secret-service' &&
+          options.identity.backend !== 'linux-kwallet'
         return true
       } catch {
         return fail('credential-access-unavailable')
```

**File**: `src/main/credential-identity/bootstrap.ts` (modified, +23/-17)
```diff
@@ -1,7 +1,6 @@
-import {
-  assertLinuxSecretServiceConfiguration,
-  probeLinuxCredentialIdentity
-} from './linux-secret-service'
+import { probeLinuxCredentialIdentity } from './linux-secret-service'
+import { selectLinuxCredentialBackend } from './linux-backend'
+import { probeLinuxKWalletIdentity } from './linux-kwallet'
 import { validateWindowsProfileKey } from './windows-profile-key'
 import type { SecureStorageCipher } from '../secure-storage'
 import { readCredentialCiphertexts, verifyCredentialCiphertexts } from './ciphertext-inventory'
@@ -14,14 +13,23 @@ import {
 } from './selection'
 
 export const selectStartupCredentialIdentity = (
-  options: Omit<Parameters<typeof selectCredentialIdentity>[0], 'probe' | 'linuxProbe'>
+  options: Omit<
+    Parameters<typeof selectCredentialIdentity>[0],
+    'probe' | 'linuxProbe' | 'linuxBackend'
+  >
 ): CredentialIdentity => {
-  if (options.platform === 'linux' && options.credentialStore !== 'file')
-    assertLinuxSecretServiceConfiguration(options.linuxPasswordStore)
+  const linuxBackend =
+    options.platform === 'linux' && options.credentialStore !== 'file'
+      ? selectLinuxCredentialBackend(options.linuxPasswordStore)
+      : undefined
   return selectCredentialIdentity({
     ...options,
     probe: probeCredentialIdentity,
-    linuxProbe: probeLinuxCredentialIdentity
+    linuxBackend,
+    linuxProbe:
+      linuxBackend && linuxBackend !== 'gnome_libsecret'
+        ? () => probeLinuxKWalletIdentity(linuxBackend)
+        : probeLinuxCredentialIdentity
   })
 }
 
@@ -36,11 +44,7 @@ export const prepareCredentialValidation = (
       profilePath: paths.profilePath,
       hasCiphertexts: ciphertexts.length > 0
     })
-  if (
-    (identity.backend === 'mac-keychain' || identity.backend === 'linux-secret-service') &&
-    !identity.exists &&
-    ciphertexts.length
-  )
+  if ('exists' in identity && !identity.exists && ciphertexts.length)
     throw new CredentialIdentityError('key-missing-for-existing-ciphertext')
   if (identity.backend === 'mac-keychain' && !identity.exists) {
     // Electron's native network service can use OSCrypt without going through the JS cipher.
@@ -58,12 +62,14 @@ export const prepareCredentialValidation = (
       identity,
       cipher,
       probe:
-        identity.backend === 'linux-secret-service'
-          ? probeLinuxCredentialIdentity
-          : probeCredentialIdentity,
+        identity.backend === 'linux-kwallet'
+          ? () => probeLinuxKWalletIdentity(identity.passwordStore, identity.wallet)
+          : identity.backend === 'linux-secret-service'
+            ? probeLinuxCredentialIdentity
+            : probeCredentialIdentity,
       recover
     })
-    if (identity.backend === 'linux-secret-service')
+    if (identity.backend === 'linux-secret-service' || identity.backend === 'linux-kwallet')
       credentialCipher(cipher).isEncryptionAvailable()
     verifyCredentialCiphertexts(ciphertexts, (value) =>
       credentialCipher(cipher).decryptString(value)
```

**File**: `src/main/credential-identity/linux-backend.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import { CredentialIdentityError } from './selection'
+
+export type LinuxKWalletBackend = 'kwallet' | 'kwallet5' | 'kwallet6'
+export type LinuxCredentialBackend = 'gnome_libsecret' | LinuxKWalletBackend
+
+// Mirror Chromium's ordered GetDesktopEnvironment/SelectBackend rules. Service availability
+// must never switch the backend: a healthy second store need not contain the original key.
+export const selectLinuxCredentialBackend = (passwordStore = ''): LinuxCredentialBackend => {
+  if (passwordStore === 'gnome-libsecret') return 'gnome_libsecret'
+  if (passwordStore === 'kwallet' || passwordStore === 'kwallet5' || passwordStore === 'kwallet6')
+    return passwordStore
+  if (passwordStore) throw new CredentialIdentityError(`linux-backend-unsupported:${passwordStore}`)
+  const desktops = (process.env.XDG_CURRENT_DESKTOP ?? '').split(':').map((name) => name.trim())
+  const secretService = new Set([
+    'GNOME',
+    'Unity',
+    'X-Cinnamon',
+    'Deepin',
+    'Pantheon',
+    'UKUI',
+    'XFCE',
+    'COSMIC'
+  ])
+  for (const desktop of desktops) {
+    if (desktop === 'KDE') {
+      if (process.env.KDE_SESSION_VERSION === '6') return 'kwallet6'
+      if (process.env.KDE_SESSION_VERSION === '5') return 'kwallet5'
+      return 'kwallet'
+    }
+    if (desktop === 'LXQt') throw new CredentialIdentityError('linux-backend-unsupported:LXQt')
+    if (secretService.has(desktop)) return 'gnome_libsecret'
+  }
+  const session = process.env.DESKTOP_SESSION ?? ''
+  if (['deepin', 'gnome', 'mate', 'ukui', 'xubuntu'].includes(session) || session.includes('xfce'))
+    return 'gnome_libsecret'
+  if (['kde4', 'kde-plasma'].includes(session)) return 'kwallet'
+  if (session === 'kde') {
+    if (process.env.KDE_SESSION_VERSION !== undefined) return 'kwallet'
+    throw new CredentialIdentityError('linux-backend-unsupported:KDE3')
+  }
+  if (process.env.GNOME_DESKTOP_SESSION_ID !== undefined) return 'gnome_libsecret'
+  if (process.env.KDE_FULL_SESSION !== undefined && process.env.KDE_SESSION_VERSION !== undefined)
+    return 'kwallet'
+  throw new CredentialIdentityError('linux-backend-unsupported:desktop-selection')
+}
```

**File**: `src/main/credential-identity/linux-dbus.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { spawnSync } from 'node:child_process'
+
+// Metadata-only calls: callers supply fixed service/method/signature contracts. Do not add
+// secret reads, wallet opens/unlocks or writes to this pre-ready transport.
+export const callLinuxCredentialMetadata = (
+  service: string,
+  path: string,
+  iface: string,
+  method: string,
+  signature: string,
+  args: string[],
+  expectedType: string
+): unknown[] => {
+  const result = spawnSync(
+    '/usr/bin/busctl',
+    [
+      '--user',
+      '--json=short',
+      '--timeout=5s',
+      '--allow-interactive-authorization=no',
+      'call',
+      service,
+      path,
+      iface,
+      method,
+      signature,
+      ...args
+    ],
+    { encoding: 'utf8', timeout: 6_000, maxBuffer: 16_384, stdio: ['ignore', 'pipe', 'ignore'] }
+  )
+  if (result.error || result.status !== 0 || result.signal) throw new Error('metadata-unavailable')
+  const value: unknown = JSON.parse(result.stdout)
+  if (!value || typeof value !== 'object') throw new Error('invalid-response')
+  const response = value as { type?: unknown; data?: unknown }
+  if (response.type !== expectedType || !Array.isArray(response.data))
+    throw new Error('invalid-response')
+  return response.data
+}
```

---

### Incident Patch 5: `012b1fa3` (2026-09-30)
**Commit Message**: fix(literature): correct merged table preview styling (#3165)

* fix(literature): correct merged table preview styling

* docs(literature): specify parsed table presentation rules

**File**: `docs/design.md` (modified, +3/-2)
```diff
@@ -344,7 +344,7 @@ Active-dialog menus and other foreground child layers retain their own ordering.
 - Dialog title: `text-lg font-semibold`.
 - Form label: `Label` + `text-sm font-medium`.
 - Helper copy: `text-xs text-muted-foreground` or `text-sm text-muted-foreground`.
-- Table small text: `text-[11px] leading-[1.625]`; table headers use `font-semibold`.
+- Table small text: `text-[11px] leading-[1.625]`; identified table headers use `font-semibold`. Parsed PDF table previews follow the source-preserving rules below because extracted cells do not identify headers.
 - Do not use negative letter spacing or viewport-driven font sizing.
 
 ### Radius
@@ -415,6 +415,7 @@ Active-dialog menus and other foreground child layers retain their own ordering.
 ### PDF reading and annotations
 
 - Original PDF, Figures & Tables, and Notes & Annotations use distinct leading document, image, and notebook icons with visible labels.
+- Parsed PDF tables in Figures & Tables preserve source row/column spans, use a collapsed border on every cell, and share one neutral theme surface without inferring headers from the first row or merged cells. Text and numbers use the same start alignment, with tabular digits and numeric no-wrap retained. Only the hovered cell is tinted, including when it spans multiple rows; row-spanning content stays vertically centered. Minimum widths apply uniformly because the first DOM cell below a rowspan may belong to a later column. These rules also apply to cached tables and do not change source text or exports.
 - Empty Notes shows a short explanation and a return-to-PDF action; an unavailable source shows a status instead of an empty panel.
 - Literature annotations belong to the exact PDF attachment version and appear in both Library and project previews. Upload/artifact annotations remain conversation-scoped. Both use the shared tag catalog.
 - Active text marking uses the I-beam cursor across the document; area selection uses a crosshair, and comment buttons retain a pointer. Escape dismisses the inner popup or exits the active tool before closing a containing preview dialog.
@@ -1267,7 +1268,7 @@ alert region excludes the diagnostic payload so opening it does not announce the
 - Text hints remain hoverable, dismissible with Escape, and bounded by the viewport. Long content gets internal scrolling. Preserve primary reference, attachment, and run-jump clicks.
 - CSL examples use a focusable preview button and a non-modal Popover: hover/focus discovers, click/tap pins, Escape/outside interaction dismisses, and internal scrolling preserves the panel. Show the complete style title, lazy-load and deduplicate per style, retain cached examples, and offer Retry after failure. The formatter's plain-text contract and content-addressed style identities stay unchanged.
 - Root canvas, body, and application root share the current theme background so exposed scrolling regions remain continuous; document canvases retain their own surface.
-- Use tabular digits for comparable numeric columns and changing counts/durations. Right-align numeric columns and reserve a minimum duration width where appropriate; retain existing formats and units.
+- Use tabular digits for comparable numeric columns and changing counts/durations. Right-align numeric columns by default; parsed PDF table previews use the uniform start alignment specified above. Reserve a minimum duration width where appropriate; retain existing formats and units.
 
 ## File version comparisons
 
```

**File**: `e2e/browser/fixture/pdf-research-table.html` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <title>PDF research table</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="./pdf-research-table.tsx"></script>
+  </body>
+</html>
```

**File**: `e2e/browser/fixture/pdf-research-table.tsx` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import '@/assets/main.css'
+import { createRoot } from 'react-dom/client'
+import { initI18n } from '@/i18n'
+import { PdfFiguresView } from '@/pages/workspace/previews/renderers/PdfFiguresView'
+import type { PdfStructureResult } from '../../../src/shared/pdf-structure'
+
+const cell = (
+  row: number,
+  column: number,
+  text: string,
+  rowSpan = 1,
+  columnSpan = 1
+): NonNullable<PdfStructureResult['elements'][number]['table']>['cells'][number] => ({
+  row,
+  column,
+  text,
+  rowSpan,
+  columnSpan,
+  regions: []
+})
+const result: PdfStructureResult = {
+  schemaVersion: 1,
+  extractionId: 'table-fixture',
+  engineFingerprint: 'a'.repeat(64),
+  sourceChecksum: 'b'.repeat(64),
+  sourceSizeBytes: 1,
+  pageCount: 1,
+  requestedPages: [1],
+  processedPages: [1],
+  pages: [{ page: 1, width: 600, height: 800, rotation: 0 }],
+  elements: [
+    {
+      id: 'table-1',
+      kind: 'table',
+      regions: [{ page: 1, x: 0, y: 0, width: 1, height: 1 }],
+      caption: { text: 'Table 1. Biomarkers', regions: [] },
+      issues: [],
+      table: {
+        rowCount: 6,
+        columnCount: 6,
+        cells: [
+          cell(0, 0, '', 2, 2),
+          cell(0, 2, 'CLDN18', 1, 2),
+          cell(0, 4, 'Total', 2),
+          cell(0, 5, 'P value', 2),
+          cell(1, 2, 'Negative'),
+          cell(1, 3, 'Positive'),
+          cell(2, 0, 'FGFR2', 4),
+          cell(2, 1, 'Negative', 2),
+          cell(4, 1, 'Positive', 2),
+          cell(2, 5, '0.077', 4),
+          ...[
+            ['237', '99', '336'],
+            ['70.5%', '29.5%', '84.0%'],
+            ['38', '26', '64'],
+            ['59.4%', '40.6%', '16.0%']
+          ].flatMap((values, row) => values.map((text, col) => cell(row + 2, col + 2, text)))
+        ],
+        unassignedText: [],
+        issues: []
+      }
+    }
+  ],
+  thumbnails: [],
+  navigation: [],
+  issues: []
+}
+window.api = {
+  localModels: { getSnapshot: async () => ({ models: [] }) },
+  pdfStructure: { readCached: async () => result }
+} as unknown as typeof window.api
+if (new URLSearchParams(location.search).has('dark')) document.documentElement.classList.add('dark')
+initI18n('en')
+createRoot(document.getElementById('root')!).render(
+  <main style={{ height: '100vh' }}>
+    <PdfFiguresView attachmentVersionId="table-version" pageCount={1} onNavigate={() => {}} />
+  </main>
+)
```

**File**: `e2e/browser/pdf-research-table.spec.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { expect, test } from '@playwright/test'
+
+for (const dark of [false, true]) {
+  test(`merged PDF table has a consistent grid and cell hover in ${dark ? 'dark' : 'light'} theme`, async ({
+    page
+  }, testInfo) => {
+    await page.setViewportSize({ width: 1440, height: 900 })
+    await page.goto(`/pdf-research-table.html${dark ? '?dark' : ''}`)
+    const table = page.getByRole('table', { name: 'Candidate table' })
+    const cells = table.locator('td')
+    await expect(cells).toHaveCount(22)
+    await page.mouse.move(0, 0)
+    const baseline = await cells.evaluateAll((elements) =>
+      elements.map((element) => {
+        const style = getComputedStyle(element)
+        return {
+          background: style.backgroundColor,
+          weight: style.fontWeight,
+          align: style.textAlign,
+          borders: ['Top', 'Right', 'Bottom', 'Left'].map((edge) => ({
+            width: style.getPropertyValue(`border-${edge.toLowerCase()}-width`),
+            style: style.getPropertyValue(`border-${edge.toLowerCase()}-style`),
+            color: style.getPropertyValue(`border-${edge.toLowerCase()}-color`)
+          }))
+        }
+      })
+    )
+    // Both header levels, merged labels and numeric values share one surface/alignment.
+    expect(new Set(baseline.map(({ background }) => background)).size).toBe(1)
+    expect(new Set(baseline.map(({ weight }) => weight)).size).toBe(1)
+    expect(new Set(baseline.map(({ align }) => align))).toEqual(new Set(['start']))
+    for (const cell of baseline) {
+      for (const border of cell.borders) {
+        expect(border.width).toBe('1px')
+        expect(border.style).toBe('solid')
+        expect(border.color).not.toBe('rgba(0, 0, 0, 0)')
+      }
+    }
+    await expect(table.getByRole('cell', { name: 'FGFR2', exact: true })).toHaveAttribute(
+      'rowspan',
+      '4'
+    )
+    await expect(table.getByRole('cell', { name: 'CLDN18', exact: true })).toHaveAttribute(
+      'colspan',
+      '2'
+    )
+    // Real pointer input must highlight exactly one cell, including below a rowspan's origin row.
+    for (const text of ['237', '70.5%', 'FGFR2', 'CLDN18', 'Total', 'Positive']) {
+      const target = table.getByRole('cell', { name: text, exact: true })
+      // 'Positive' occurs in both the header and the body; exercise the second header level.
+      await target.first().hover()
+      await expect
+        .poll(() =>
+          cells.evaluateAll(
+            (elements, backgrounds) =>
+              elements
+                .map(
+                  (element, index) =>
+                    getComputedStyle(element).backgroundColor !== backgrounds[index]
+                )
+                .filter(Boolean).length,
+            baseline.map(({ background }) => background)
+          )
+        )
+        .toBe(1)
+    }
+    await page.mouse.move(0, 0)
+    await expect
+      .poll(() =>
+        cells.evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundColor))
+      )
+      .toEqual(baseline.map(({ background }) => background))
+    await page.screenshot({ path: testInfo.outputPath('merged-table.png') })
+    await page.setViewportSize({ width: 375, height: 812 })
+    const scroller = page.getByRole('region', { name: 'Candidate table' })
+    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
+      true
+    )
+    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
+    await scroller.focus()
+    await expect(scroller).toBeFocused()
+  })
+}
```

**File**: `src/renderer/src/pages/workspace/previews/renderers/pdf-research-table.css` (modified, +4/-27)
```diff
@@ -1,6 +1,4 @@
-/* Hallmark · component: research table · genre: editorial · theme: existing app tokens
- * Quiet horizontal rules, grouped cells and tabular numerals; preserve source structure.
- * Pre-emit critique: P4 H4 E4 S5 R5 V4. */
+/* Preserve source spans without guessing which rows are headers. */
 
 .pdf-research-table-scroll {
   max-width: 100%;
@@ -28,43 +26,22 @@
 .pdf-research-table td {
   min-width: 6rem;
   padding: 0.625rem 1rem;
-  border-bottom: 1px solid var(--color-border-200);
+  border: 1px solid var(--color-border-200);
+  background: var(--color-bg-000);
   vertical-align: top;
   text-align: start;
 }
 
-.pdf-research-table tr:first-child > td {
-  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-000));
-  border-bottom-color: var(--color-border-300);
-  font-weight: 600;
-}
-
-.pdf-research-table td:first-child {
-  min-width: 10rem;
-}
-
-.pdf-research-table td[colspan]:not([colspan='1']) {
-  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-000));
-  font-weight: 600;
-  border-inline: 1px solid var(--color-border-200);
-}
-
 .pdf-research-table td[rowspan]:not([rowspan='1']) {
   vertical-align: middle;
-  border-inline-end: 1px solid var(--color-border-200);
-}
-
-.pdf-research-table td[colspan]:not([colspan='1']):not(:first-child) {
-  text-align: center;
 }
 
 .pdf-research-table td[data-numeric] {
-  text-align: end;
   white-space: nowrap;
 }
 
 @media (hover: hover) {
-  .pdf-research-table tr:hover > td {
+  .pdf-research-table td:hover {
     background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-000));
   }
 }
```

---

### Incident Patch 6: `b4241581` (2026-09-30)
**Commit Message**: fix(literature): add an overflow shadow to pinned columns (#3167)

**File**: `src/renderer/src/pages/literature/LiteratureLibraryPage.render.test.tsx` (modified, +21/-1)
```diff
@@ -6661,7 +6661,7 @@ describe('LiteratureLibraryPage', () => {
     expect(screen.getByRole('button', { name: 'Manage Tags' }).className).toContain('w-full')
     expect(screen.getByRole('columnheader', { name: 'Attachment' }).className).toContain('right-12')
     expect(screen.getByRole('columnheader', { name: 'Attachment' }).className).toContain(
-      'shadow-card-opaque'
+      'group-data-[overflow-right=true]/journal-scroll:before:opacity-100'
     )
     expect(screen.getByRole('columnheader', { name: 'Attachment' }).className).toContain(
       'bg-bg-200'
@@ -6670,6 +6670,26 @@ describe('LiteratureLibraryPage', () => {
     expect(screen.getByRole('columnheader', { name: 'Actions' }).className).toContain('bg-bg-200')
     expect(screen.getByRole('columnheader', { name: 'Attachment' }).className).toContain('w-28')
     const tableScroll = document.querySelector<HTMLElement>('[data-slot="literature-table-scroll"]')
+    expect(tableScroll?.className).toContain('group/journal-scroll')
+    for (const cell of [
+      stickyRowCells[0],
+      screen.getByRole('columnheader', { name: 'Attachment' })
+    ]) {
+      expect(cell.className).toContain('before:pointer-events-none')
+      expect(cell.className).toContain('before:right-full')
+      expect(cell.className).toContain('before:from-foreground/5')
+      expect(cell.className).not.toContain('shadow-card-opaque')
+      expect(cell.className).not.toContain('overflow-hidden')
+    }
+    Object.defineProperties(tableScroll!, {
+      clientWidth: { value: 600, configurable: true },
+      scrollWidth: { value: 1000, configurable: true }
+    })
+    fireEvent.scroll(tableScroll!)
+    expect(tableScroll?.dataset.overflowRight).toBe('true')
+    tableScroll!.scrollLeft = 400
+    fireEvent.scroll(tableScroll!)
+    expect(tableScroll?.dataset.overflowRight).toBe('false')
     expect(tableScroll?.className).toContain('pb-3')
     expect(tableScroll?.className).toContain('h-full')
     expect(tableScroll?.className).not.toContain('100vh')
```

**File**: `src/renderer/src/pages/literature/LiteratureLibraryPage.tsx` (modified, +10/-6)
```diff
@@ -162,7 +162,11 @@ import { useTagStore } from '@/stores/tag-store'
 import { LiteratureMergeReview } from './LiteratureMergeReview'
 import { LiteratureBatchLookupDialog, type BatchLookupMode } from './LiteratureBatchLookupDialog'
 import { LiteratureBackgroundTasks } from './LiteratureBackgroundTasks'
-import { LiteratureTable, LiteratureTextTooltip } from './LiteratureTable'
+import {
+  LiteratureTable,
+  LiteratureTableScrollArea,
+  LiteratureTextTooltip
+} from './LiteratureTable'
 import { buildLiteratureMergeItem, mergeScalarFields } from './literature-merge'
 import type {
   LiteratureCatalogCommand,
@@ -1637,7 +1641,7 @@ const LiteratureItemRow = memo(function LiteratureItemRow({
             return null
         }
       })}
-      <td className="sticky right-12 z-20 w-28 min-w-28 max-w-28 border-l border-border-300/80 bg-inherit px-3 py-2 text-center align-middle shadow-card-opaque">
+      <td className="sticky right-12 z-20 w-28 min-w-28 max-w-28 border-l border-transparent bg-inherit group-data-[overflow-right=true]/journal-scroll:border-border-300/60 px-3 py-2 text-center align-middle before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-2 before:bg-linear-to-l before:from-foreground/5 before:to-transparent before:opacity-0 group-data-[overflow-right=true]/journal-scroll:before:opacity-100">
         {attachmentVersion ? (
           <LiteratureTextTooltip text={attachmentVersion.filename}>
             <Button
@@ -6917,8 +6921,8 @@ const LiteratureLibraryPage = (): React.JSX.Element => {
                   ) : items.length > 0 || entriesPageTransitionLoading ? (
                     <div className="isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-300/80 bg-bg-000">
                       <div className="relative min-h-0 flex-1 overflow-hidden">
-                        <div
-                          ref={tableScrollRef}
+                        <LiteratureTableScrollArea
+                          viewportRef={tableScrollRef}
                           data-slot="literature-table-scroll"
                           className="h-full overflow-auto pb-3 [scrollbar-gutter:stable]"
                         >
@@ -6989,7 +6993,7 @@ const LiteratureLibraryPage = (): React.JSX.Element => {
                                 ))}
                                 <th
                                   scope="col"
-                                  className="sticky right-12 z-30 w-28 min-w-28 max-w-28 overflow-hidden border-l border-border-300/80 bg-bg-200 px-2 py-2.5 text-center text-[11px] whitespace-nowrap shadow-card-opaque"
+                                  className="sticky right-12 z-30 w-28 min-w-28 max-w-28 border-l border-transparent bg-bg-200 group-data-[overflow-right=true]/journal-scroll:border-border-300/60 px-2 py-2.5 text-center text-[11px] whitespace-nowrap before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-2 before:bg-linear-to-l before:from-foreground/5 before:to-transparent before:opacity-0 group-data-[overflow-right=true]/journal-scroll:before:opacity-100"
                                 >
                                   {t('Attachment')}
                                 </th>
@@ -7051,7 +7055,7 @@ const LiteratureLibraryPage = (): React.JSX.Element => {
                               </LiteratureRowNumbers.Provider>
                             </TooltipProvider>
                           </LiteratureTable>
-                        </div>
+                        </LiteratureTableScrollArea>
                         {entriesPageTransitionLoading ? (
                           <div
                             role="status"
```

**File**: `src/renderer/src/pages/literature/LiteratureTable.tsx` (modified, +17/-7)
```diff
@@ -2,10 +2,12 @@ import {
   useEffect,
   useRef,
   type ComponentProps,
+  type ComponentPropsWithoutRef,
+  type RefObject,
   type ReactElement,
-  type ReactNode,
   type SyntheticEvent
 } from 'react'
+import { cn } from '@/lib/utils'
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
 
 // One delay/skip-delay context for every text and attachment hint in the table.
@@ -18,11 +20,15 @@ export function LiteratureTable(props: ComponentProps<'table'>): React.JSX.Eleme
 }
 
 export function LiteratureTableScrollArea({
-  children
-}: {
-  children: ReactNode
+  children,
+  viewportRef,
+  className,
+  ...props
+}: ComponentPropsWithoutRef<'div'> & {
+  viewportRef?: RefObject<HTMLDivElement | null>
 }): React.JSX.Element {
-  const viewport = useRef<HTMLDivElement>(null)
+  const internalViewport = useRef<HTMLDivElement>(null)
+  const viewport = viewportRef ?? internalViewport
   useEffect(() => {
     const element = viewport.current!
     const update = (): void => {
@@ -38,11 +44,15 @@ export function LiteratureTableScrollArea({
       observer.disconnect()
       element.removeEventListener('scroll', update)
     }
-  }, [])
+  }, [viewport])
   return (
     <div
+      {...props}
       ref={viewport}
-      className="group/journal-scroll min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]"
+      className={cn(
+        'group/journal-scroll min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]',
+        className
+      )}
     >
       {children}
     </div>
```

---

### Incident Patch 7: `ab8b8cc8` (2026-09-30)
**Commit Message**: fix(notebook): harden Python and R scientific lineage capture (#3163)

* fix(notebook): harden scientific dependency and file capture

* test(notebook): add reduced multi-cell lineage regressions

* fix(notebook): preserve conservative effects for untrusted calls

**File**: `resources/notebook/r_loop.R` (modified, +28/-1)
```diff
@@ -386,6 +386,14 @@ make_runtime_write_guard <- function(binding_name, binding_env = baseenv()) {
   original <- get(binding_name, envir = binding_env, inherits = FALSE)
   force(original)
   force(binding_name)
+  if (identical(binding_name, "save")) {
+    # save inspects the unevaluated names in ... and resolves them in envir.
+    # list(...) / do.call() would force those promises and substitute their values.
+    return(function(..., file = stop("'file' must be specified"), envir = parent.frame()) {
+      assert_runtime_write_allowed(list(file))
+      original(..., file = file, envir = envir)
+    })
+  }
   function(...) {
     args <- list(...)
     targets <- switch(
@@ -415,7 +423,6 @@ make_runtime_write_guard <- function(binding_name, binding_env = baseenv()) {
       dir.create = list(runtime_argument(args, "path", 1L)),
       download.file = list(runtime_argument(args, "destfile", 2L)),
       saveRDS = list(runtime_argument(args, "file", 2L)),
-      save = list(runtime_argument(args, "file", .Machine$integer.max)),
       cat = list(runtime_argument(args, "file", .Machine$integer.max)),
       file = {
         open_mode <- runtime_argument(args, "open", 2L)
@@ -945,6 +952,7 @@ capture_environment <- function(execution_context = NULL) {
 output_sink_policy_env <- new.env(parent = baseenv())
 output_sink_policy_env$state <- new.env(parent = emptyenv())
 output_sink_policy_env$state$protected_depth <- 0L
+output_sink_policy_env$state$protected_connections <- as.integer(con)
 output_sink_policy_env$kernel_sink <- base::sink
 guarded_output_sink <- function(
     file = NULL,
@@ -960,10 +968,26 @@ guarded_output_sink <- function(
 }
 environment(guarded_output_sink) <- output_sink_policy_env
 assign("guarded_output_sink", guarded_output_sink, output_sink_policy_env)
+# base::closeAllConnections closes descriptors directly after popping sinks. The sink guard alone
+# cannot protect the request stream or active capture descriptor. Retain base cleanup semantics for
+# user connections, including user-owned sinks, while excluding these kernel-owned descriptors.
+guarded_close_all_connections <- function() {
+  if (sink.number(type = "message") > 0L) kernel_sink(stderr(), type = "message")
+  while (sink.number(type = "output") > state$protected_depth) kernel_sink(type = "output")
+  gc()
+  connections <- setdiff(getAllConnections(), c(0L, 1L, 2L, state$protected_connections))
+  for (id in connections) close(getConnection(id))
+  invisible(NULL)
+}
+environment(guarded_close_all_connections) <- output_sink_policy_env
+assign("guarded_close_all_connections", guarded_close_all_connections, output_sink_policy_env)
 lockEnvironment(output_sink_policy_env, bindings = TRUE)
 if (bindingIsLocked("sink", baseenv())) unlockBinding("sink", baseenv())
 assign("sink", output_sink_policy_env$guarded_output_sink, envir = baseenv())
 lockBinding("sink", baseenv())
+if (bindingIsLocked("closeAllConnections", baseenv())) unlockBinding("closeAllConnections", baseenv())
+assign("closeAllConnections", output_sink_policy_env$guarded_close_all_connections, envir = baseenv())
+lockBinding("closeAllConnections", baseenv())
 
 run <- base::local({
   kernel_figures_dir <- figures_dir
@@ -1489,11 +1513,14 @@ run <- base::local({
     error_line <- NA_integer_
     stdout_path <- tempfile("open-science-r-stdout-")
     stdout_connection <- file(stdout_path, open = "wb")
+    stdout_connection_id <- as.integer(stdout_connection)
+    output_sink_state$protected_connections <- c(output_sink_state$protected_connections, stdout_connection_id)
     sink_depth <- sink.number(type = "output")
     kernel_sink(stdout_connection, type = "output")
     output_sink_state$protected_depth <- sink_depth + 1L
     on.exit({
       output_sink_state$protected_depth <- sink_depth
+      output_sink_state$protected_connections <- setdiff(output_sink_state$protected_connections, stdout_connection_id)
       while (sink.number(type = "output") > sink_depth) kern
```

**File**: `scripts/ci/module-impact/desktop_composition.json` (modified, +7/-1)
```diff
@@ -1165,7 +1165,13 @@
       "src/main/session-diagnostics/environment.test.ts",
       "src/main/session-diagnostics/export-evidence.integration.test.ts",
       "src/main/session-diagnostics/notebook.test.ts",
-      "src/main/session-diagnostics/projection.test.ts"
+      "src/main/session-diagnostics/projection.test.ts",
+      "src/main/notebook/scientific-replay.test.ts",
+      "src/main/notebook/real-notebook-lineage.integration.test.ts",
+      "src/main/notebook/real-parquet-lineage.integration.test.ts",
+      "src/main/notebook/dependency-analysis.cwd-lineage.test.ts",
+      "src/main/notebook/r-connection-guard.test.ts",
+      "src/main/notebook/dependency-analysis.lineage-regressions.test.ts"
     ]
   },
   "capabilityOverlays": ["e2e_regressions", "e2e_delegation", "windows_sensitive"],
```

**File**: `scripts/ci/module-impact/i18n_main_adapter.json` (modified, +6/-1)
```diff
@@ -425,7 +425,12 @@
       "src/main/acp/library-auto-policy.test.ts",
       "src/main/notebook/wsl2-scheduling.integration.test.ts",
       "src/main/literature/journal-attributes.test.ts",
-      "src/main/notebook/shell-cell-session.integration.test.ts"
+      "src/main/notebook/shell-cell-session.integration.test.ts",
+      "src/main/notebook/scientific-replay.test.ts",
+      "src/main/notebook/real-notebook-lineage.integration.test.ts",
+      "src/main/notebook/real-parquet-lineage.integration.test.ts",
+      "src/main/notebook/r-connection-guard.test.ts",
+      "src/main/notebook/dependency-analysis.lineage-regressions.test.ts"
     ]
   },
   "capabilityOverlays": ["i18n_catalog"],
```

**File**: `scripts/ci/module-impact/i18n_shared_runtime.json` (modified, +6/-1)
```diff
@@ -653,7 +653,12 @@
       "src/renderer/src/pages/workspace/previews/LibraryPreview.test.tsx",
       "src/main/notebook/wsl2-scheduling.integration.test.ts",
       "src/main/literature/journal-attributes.test.ts",
-      "src/main/notebook/shell-cell-session.integration.test.ts"
+      "src/main/notebook/shell-cell-session.integration.test.ts",
+      "src/main/notebook/scientific-replay.test.ts",
+      "src/main/notebook/real-notebook-lineage.integration.test.ts",
+      "src/main/notebook/real-parquet-lineage.integration.test.ts",
+      "src/main/notebook/r-connection-guard.test.ts",
+      "src/main/notebook/dependency-analysis.lineage-regressions.test.ts"
     ]
   },
   "capabilityOverlays": [],
```

**File**: `scripts/ci/module-impact/main_background_result_delivery.json` (modified, +6/-1)
```diff
@@ -204,7 +204,12 @@
       "src/main/session-plan/plan-context-file.shell.integration.test.ts",
       "src/renderer/src/pages/workspace/workspace-message-queue-controller.test.ts",
       "src/main/notebook/wsl2-scheduling.integration.test.ts",
-      "src/main/notebook/shell-cell-session.integration.test.ts"
+      "src/main/notebook/shell-cell-session.integration.test.ts",
+      "src/main/notebook/scientific-replay.test.ts",
+      "src/main/notebook/real-notebook-lineage.integration.test.ts",
+      "src/main/notebook/real-parquet-lineage.integration.test.ts",
+      "src/main/notebook/r-connection-guard.test.ts",
+      "src/main/notebook/dependency-analysis.lineage-regressions.test.ts"
     ]
   },
   "capabilityOverlays": ["e2e_regressions", "e2e_delegation", "windows_sensitive"],
```

---

### Incident Patch 8: `d6a543df` (2026-09-30)
**Commit Message**: fix(pdf-structure): preserve native figure and table content (#3162)

* fix(pdf-structure): recover figures and tables from native evidence

Recover native headers, record boundaries, merged cells, notes and caption ownership while preserving uncertain source content and diagnostic evidence. Keep structured and unstructured figure regions bounded by source geometry.

* test(pdf-structure): cover difficult native layouts and source ownership

Add anonymized failure fixtures for cropped panels, continuation captions, repeated cohorts, merged cells, footnotes and unstructured records. Register focused regressions with the existing literature module and retain rejection cases for ambiguous evidence.

* fix(pdf-structure): restore continued caption source coordinates

* fix(pdf-structure): guard recovery without column evidence

* test(windows-updater): wait for native observer acquisition

* fix(pdf-structure): keep caption crops within their source page

Ignore caption-sheet coordinates when trimming another page and recognize explicit unnumbered labels irrespective of label case while retaining title evidence.

* ci(tests): serialize database-heavy session fork tests

The real packag

**File**: `resources/pdf-structure/literature-pdf-association.mjs` (modified, +781/-39)
```diff
@@ -9,11 +9,12 @@ import { captionKind, groupPageLines } from './literature-pdf-caption-group.mjs'
 
 import { union, area, intersection, lineRect } from './literature-pdf-page-geometry.mjs'
 import { associateTableNotes } from './literature-pdf-table-notes.mjs'
+import { joinHorizontalTableRules } from './literature-pdf-table-rules.mjs'
 
 // A neighboring plate can already own the caption on a text-only page.
 // Keep every resolved plate (including multi-page figures), but do not emit
 // a second unresolved candidate for that exact source caption.
-export function deduplicateFigureCaptions(figures) {
+export function deduplicateFigureCaptions(figures, auxiliaryOwners = []) {
   const key = (figure) =>
     figure.caption &&
     JSON.stringify([figure.caption.page, figure.caption.rect, figure.caption.text])
@@ -23,10 +24,17 @@ export function deduplicateFigureCaptions(figures) {
       .map(key)
       .filter(Boolean)
   )
+  const continued = new Set(
+    [...figures, ...auxiliaryOwners]
+      .filter((figure) => figure.region && figure.caption?.regions?.length === 2)
+      .flatMap((figure) => figure.caption.regions.slice(1))
+      .map(({ page, rect }) => JSON.stringify([page, rect]))
+  )
   return figures.filter(
     (figure) =>
       figure.region ||
-      (!resolved.has(key(figure)) &&
+      (!continued.has(JSON.stringify([figure.caption?.page, figure.caption?.rect])) &&
+        !resolved.has(key(figure)) &&
         !figures.some(
           (other) =>
             other.region &&
@@ -39,6 +47,40 @@ export function deduplicateFigureCaptions(figures) {
 }
 
 export function resolveFigureCaption(caption, candidates) {
+  // A sentence can continue on the next page even when extraction jobs split
+  // there. Require both printed ownership markers and one matching fragment;
+  // keep page-local rectangles rather than spanning unrelated page content.
+  const pointer = /\s*\(continued on (?:following|next) page\)\s*$/i
+  const continuation = /^(?:Fig\.?|Figure)\s*([AS]?\d+)\.?:?\s*\(Continued\)\.?\s*/i
+  const number = /^(?:Fig\.?|Figure)\s*([AS]?\d+)\b/i.exec(caption?.lines[0])?.[1]
+  if (number && pointer.test(caption.lines.join(' '))) {
+    const next = candidates.filter(
+      (other) =>
+        other.page === caption.page + 1 &&
+        continuation.exec(other.lines[0])?.[1] === number &&
+        !pointer.test(other.lines.join(' '))
+    )
+    if (
+      next.length === 1 &&
+      candidates.filter(
+        (other) =>
+          other.page === caption.page &&
+          /^(?:Fig\.?|Figure)\s*([AS]?\d+)\b/i.exec(other.lines[0])?.[1] === number
+      ).length === 1
+    ) {
+      const tail = [...next[0].lines]
+      tail[0] = tail[0].replace(continuation, '')
+      if (tail.join(' ').trim()) {
+        const lines = [...caption.lines]
+        lines[lines.length - 1] = lines.at(-1).replace(pointer, '')
+        return {
+          ...caption,
+          lines: [...lines, ...tail],
+          regions: [caption, next[0]].map(({ page, rect }) => ({ page, rect }))
+        }
+      }
+    }
+  }
   if (/^(?:Fig\.?|Figure)\s*\d+\.?$/i.test(caption?.lines.join(' ').trim())) {
     const label = (c) => /^(?:Fig\.?|Figure)\s*(\d+)\b/i.exec(c.lines[0])?.[1]
     const number = label(caption)
@@ -75,16 +117,21 @@ export function resolveFigureCaption(caption, candidates) {
   }
   const direction =
     /see legend on (previous|next) page/i.exec(caption?.lines.join(' '))?.[1] ??
+    (/^\((?:Fig\.?|Figure)\s*\d+\s+continues on (?:the )?next page\)$/i.test(
+      caption?.lines.join(' ')
+    )
+      ? 'next'
+      : undefined) ??
     (/^(?:Fig\.|Figure)\s*\d+\s*[:.]?\s*Continued\.?$/i.test(caption?.lines.join(' '))
       ? 'next'
       : undefined)
-  const number = /^(?:Fig\.|Figure)\s*(\d+)\b/i.exec(caption?.lines[0])?.[1]
-  if (!direction || !number) return caption
+  const pointerNumber = /^\(?(?:Fig\.|Figure)\s*(\d+)\b/i.exec(caption?.lines[0])?.[1]
+  if (!direction || !pointerNumber) r
```

**File**: `resources/pdf-structure/literature-pdf-caption-group.mjs` (modified, +207/-22)
```diff
@@ -151,14 +151,17 @@ export function startsDetachedTextColumn(pending, item) {
 }
 
 export function captionKind(text) {
+  if (/^\((?:Fig\.?|Figure)\s+\d+\s+continues on (?:the )?next page\)$/i.test(text?.trim() ?? ''))
+    return 'figure'
   // Publisher/appendix prefixes belong to the displayed label. Normalize only
   // for classification; keep the original caption text and source rectangle.
   text = (text ?? '')
     .replace(/^TaggedEnd(?=Table\s+\d)/, '')
     .replace(/^Appendix\s+(?=(?:Figure|Fig\.|Table)\b)/i, '')
+    .replace(/^Legend to\s+(?=(?:Figure|Fig\.?)\s+[AS]?\d+[.:])/i, '')
   // A closing parenthesis ends an inline cross-reference, not a caption.
   if (
-    /^(?:(?:Supplementary|Supplemental)\s+)?(?:Fig\.?|Figure|Table)\s+\d+(?:\s+and\s+(?:(?:Supplementary|Supplemental)\s+)?(?:Fig\.?|Figure|Table)\s+\d+)?\)\./i.test(
+    /^(?:(?:Supplementary|Supplemental)\s+)?(?:Fig\.?|Figure|Table)\s+[AS]?\d+(?:\s+[A-Z](?:\s*(?:[+,&/–-]|and)\s*[A-Z])*)?(?:\s+and\s+(?:(?:Supplementary|Supplemental)\s+)?(?:Fig\.?|Figure|Table)\s+[AS]?\d+)?\)\./i.test(
       text
     )
   )
@@ -188,7 +191,7 @@ export function captionKind(text) {
   )
     return undefined
   if (
-    /^(?:Table|Chart|Fig\.?|Figure)\s+[AS]?\d+(?:\s+and\s+(?:(?:Supplementary|Supplemental)\s+)?(?:Table|Chart|Fig\.?|Figure)\s+[AS]?\d+)?\s+(?:shows?|shown|presents?|presented|illustrates?|depicts?|represents?|reiterates?|reviews?|summari[sz](?:e(?:s|d)?|ing)|indicates?|suggests?|describes?|demonstrates?)\b/i.test(
+    /^(?:Table|Chart|Fig\.?|Figure)\s+[AS]?\d+(?:\s+and\s+(?:(?:Supplementary|Supplemental)\s+)?(?:Table|Chart|Fig\.?|Figure)\s+[AS]?\d+)?\s+(?:shows?|shown|presents?|presented|illustrat(?:es?|ed)|depict(?:s|ed)?|represents?|reiterates?|reviews?|summari[sz](?:e(?:s|d)?|ing)|indicates?|suggests?|describes?|demonstrates?)\b/i.test(
       text ?? ''
     )
   )
@@ -197,8 +200,9 @@ export function captionKind(text) {
   if (/^Appendix\s+[A-Z][.:]\s+(?:CONSORT\s+)?(?:flow diagram|flowchart)\.?$/i.test(text ?? ''))
     return 'figure'
   // Single-table articles can use an explicit label without a sequence number.
-  if (/^(?:Table|Figure)[.:]\s+\p{Lu}\p{L}/u.test(text))
-    return /^Table/.test(text) ? 'table' : 'figure'
+  const unnumbered = /^(Table|Figure)[.:]\s+/i.exec(text)
+  if (unnumbered && /^\p{Lu}\p{L}/u.test(text.slice(unnumbered[0].length)))
+    return unnumbered[1].toLowerCase() === 'table' ? 'table' : 'figure'
   if (/^(?:Figure|Fig\.?)\s+[AS]?\d+\s*[—–-]\s*Continued\.?$/i.test(text)) return 'figure'
   if (/^Figure\s+(?:[n▪■]\s+)?(?:Flow diagram|Flowchart)\b/.test(text ?? '')) return 'figure'
   // Pathology journals use decorated Image labels; a closing marker followed
@@ -210,6 +214,19 @@ export function captionKind(text) {
   if (/^(?:Fig\.?|Figure)\s+\d+\.?[A-Z](?:[-–][A-Z])?[.:](?:\s|$)/i.test(text ?? ''))
     return 'figure'
   if (/^(?:Table|Tab\.)\s+[IVXLCDM]+(?=[\s.:：．、]|$)/i.test(text ?? '')) return 'table'
+  // Czech and Slovak publishers use this explicit abbreviation for figures.
+  if (/^Obr\.\s*\d+(?=[\s.:]|$)/i.test(text)) return 'figure'
+  if (/^(?:Supplementary|Supplemental) Table(?: \(online only\))?\.\s+\p{Lu}/u.test(text))
+    return 'table'
+  if (/^Box\s+\d+[.:]\s+\p{Lu}/u.test(text)) return 'table'
+  // A letter suffix identifies a separate table, while a dash can delimit the
+  // title without whitespace. Require a title after the delimiter so ranges
+  // and inline references do not become captions.
+  const dashed =
+    /^(Table|TABLE|Tab\.|TAB\.|Figure|FIGURE|Fig\.?|FIG\.?)\s+[AS]?\d+[A-Z]?\s*[—–-]\s*\p{Lu}/u.exec(
+      text ?? ''
+    )
+  if (dashed) return /^(?:Table|Tab\.)$/i.test(dashed[1]) ? 'table' : 'figure'
   const match =
     /^(?:(?:Supplementary|Supplemental|Supplement|Extended\s+Data)\s+)?(F\s*I\s*G\s*U\s*R\s*E|F\s*I\s*G\.?|C\s*H\s*A\s*R\s*T|T\s*A\s*B\s*L\s*E|T\s*A\s*B\.?|图|圖|表)\s*[AS]?\d+(?:[.-]\d+)*(?=[\s.:：．、。]|$)/i.exec(
       text ?? ''
@@ -224,24 +241,71 @@ export fun
```

**File**: `resources/pdf-structure/literature-pdf-crop.mjs` (modified, +34/-2)
```diff
@@ -6,8 +6,24 @@ import { createCanvas } from '@napi-rs/canvas'
 const MAX_EDGE = 2400
 const MAX_BYTES = 4 * 1024 ** 2
 
-export const renderPdfCrop = async (page, rect, rotation = page.rotate) => {
+export const renderPdfCrop = async (page, rect, rotation = page.rotate, regions) => {
   assert(rect.length === 4 && rect.every(Number.isFinite), 'Invalid PDF crop region.')
+  if (regions)
+    assert(
+      regions.length > 0 &&
+        regions.every(
+          (r) =>
+            r.length === 4 &&
+            r.every(Number.isFinite) &&
+            r[2] > r[0] &&
+            r[3] > r[1] &&
+            r[0] >= rect[0] &&
+            r[1] >= rect[1] &&
+            r[2] <= rect[2] &&
+            r[3] <= rect[3]
+        ),
+      'Invalid PDF crop parts.'
+    )
   const bounds = page.getViewport({ scale: 1, rotation })
   const left = Math.max(0, rect[0]),
     top = Math.max(0, rect[1]),
@@ -21,10 +37,26 @@ export const renderPdfCrop = async (page, rect, rotation = page.rotate) => {
       Math.min(MAX_EDGE, Math.max(1, Math.ceil(height * scale)))
     )
     try {
+      const context = canvas.getContext('2d')
+      if (regions) {
+        // Preserve page coordinates between disjoint table continuations while
+        // excluding unrelated prose inside their enclosing rectangle.
+        context.fillStyle = 'white'
+        context.fillRect(0, 0, canvas.width, canvas.height)
+        context.beginPath()
+        for (const r of regions)
+          context.rect(
+            (r[0] - left) * scale,
+            (r[1] - top) * scale,
+            (r[2] - r[0]) * scale,
+            (r[3] - r[1]) * scale
+          )
+        context.clip()
+      }
       // Render vectors/text from the source PDF into only the crop-sized canvas. Enlarging the
       // inference page bitmap cannot recover its lost detail, especially on Retina displays.
       await page.render({
-        canvasContext: canvas.getContext('2d'),
+        canvasContext: context,
         viewport: page.getViewport({
           scale,
           rotation,
```

**File**: `resources/pdf-structure/literature-pdf-deviation-grid.mjs` (modified, +79/-0)
```diff
@@ -6,6 +6,85 @@ import {
   readSourceRow,
   hasUniqueRecordTokens
 } from './literature-pdf-source-records.mjs'
+import { joinHorizontalTableRules } from './literature-pdf-table-rules.mjs'
+
+// A single value heading and repeated complete mean ± deviation expressions
+// contradict a model split through that value. Source records also keep the
+// indented continuation of a long stub with its preceding numeric value.
+export function recoverSingleValueGrid(table, items, captions, rules) {
+  if (!captions.some((c) => captionKind(c.lines[0]) === 'table')) return
+  const crop = table.cropRect,
+    predicted = table.structure.objects
+      .filter((o) => o.label === 'table column')
+      .sort((a, b) => a.rect[0] - b.rect[0])
+  if (predicted.length !== 3) return
+  const borders = joinHorizontalTableRules(rules, 1)
+    .filter(
+      (r) =>
+        Math.abs(r[0] - crop[0]) < 12 &&
+        Math.abs(r[2] - crop[2]) < 12 &&
+        r[1] >= crop[1] &&
+        r[1] <= crop[3]
+    )
+    .filter((r, n, all) => !n || r[1] - all[n - 1][1] > 1.5)
+  if (borders.length !== 3) return
+  const frame = [crop[0], borders[0][1], crop[2], borders[2][1]],
+    source = tableSourceItems(items, frame)
+  const header = source.filter((i) => i.rect[3] < borders[1][1])
+  if (header.length !== 2 || !/^Values?$/i.test(header[1].text)) return
+  const cut = crop[0] + (predicted[0].rect[2] + predicted[1].rect[0]) / 2
+  if (header[0].rect[2] >= cut || header[1].rect[0] <= cut) return
+  const body = source.filter((i) => i.rect[1] > borders[1][1]),
+    groups = []
+  for (const item of [...body].sort((a, b) => a.baseline - b.baseline || a.rect[0] - b.rect[0])) {
+    const group = groups.find((g) => Math.abs(g[0].baseline - item.baseline) < item.height * 0.3)
+    if (group) group.push(item)
+    else groups.push([item])
+  }
+  const records = [],
+    spans = []
+  let deviations = 0
+  for (const group of groups) {
+    const cells = readSourceRow(group, [frame[0], cut, frame[2]])
+    if (!cells || !cells[0]) return
+    const value = cells[1].replace(/\s/g, '')
+    if (
+      value &&
+      !/^\d+(?:\.\d+)?(?:\(\d+(?:\.\d+)?\)|±\d+(?:\.\d+)?(?:\([\d.–-]+\))?)?$/.test(value)
+    )
+      return
+    if (value.includes('±')) deviations++
+    const previous = records.at(-1)
+    if (
+      !value &&
+      /^[a-z]/.test(cells[0]) &&
+      previous &&
+      group[0].rect[1] - union(previous)[3] < group[0].height &&
+      group.every((i) => i.rect[0] > previous[0].rect[0] + i.height * 0.5)
+    )
+      previous.push(...group)
+    else {
+      records.push(group)
+      if (!value) spans.push({ row: records.length, column: 0, rowSpan: 1, colSpan: 2 })
+    }
+  }
+  if (deviations < 3 || !hasUniqueRecordTokens(source, [header, ...records])) return
+  return {
+    cropRect: frame,
+    rows: [header, ...records].map((g) => {
+      const r = union(g)
+      return [frame[0], r[1], frame[2], r[3]]
+    }),
+    columns: [
+      [frame[0], frame[1], cut, frame[3]],
+      [cut, frame[1], frame[2], frame[3]]
+    ],
+    headerRows: [0],
+    spans,
+    completeSpans: true,
+    ownedTokens: new Set(source)
+  }
+}
 
 // Separate standard-deviation columns are established by repeated headings and
 // complete mean/(±SD) records. Every source token must fit a recovered row.
```

**File**: `resources/pdf-structure/literature-pdf-extract.mjs` (modified, +82/-42)
```diff
@@ -12,13 +12,15 @@ import {
   captionKind,
   excludePdfLineNumbers,
   findCaptionCandidates,
-  joinCaptionLines
+  joinCaptionLines,
+  sourceWordSpellings
 } from './literature-pdf-caption-group.mjs'
 import {
   associateFigures,
   deduplicateFigureCaptions,
   associateUnnumberedFigure,
   associateGraphicalTables,
+  associateRasterTables,
   resolveFigureCaption,
   findAlgorithmCandidates,
   associateAdjacentFigure,
@@ -34,7 +36,12 @@ import {
   recoverCaptionedRuledTables
 } from './literature-pdf-table-refine.mjs'
 import { deduplicateTableRegions } from './literature-pdf-table-regions.mjs'
-import { tableCaptionCropTop, tableMarginCropTop } from './literature-pdf-table-geometry.mjs'
+import { isFigureRiskTable } from './literature-pdf-table-evidence.mjs'
+import {
+  recoverOwnedTableCrop,
+  trimTableCaptionCrop,
+  tableMarginCropTop
+} from './literature-pdf-table-geometry.mjs'
 import { recoverWrappedCountTable } from './literature-pdf-wrapped-count-grid.mjs'
 import { groupTableParts } from './literature-pdf-table-group.mjs'
 import { renderPdfCrop, recoverScannedFigures } from './literature-pdf-crop.mjs'
@@ -44,7 +51,12 @@ import {
   excludeRemovedMarginTokens
 } from './literature-pdf-graphics.mjs'
 import { repairPdfSymbolText, splitPdfNumericRuns } from './literature-pdf-symbol-text.mjs'
-import { isUprightText, originalRect, rotatedTextRect } from './literature-pdf-orientation.mjs'
+import {
+  isUprightText,
+  originalRect,
+  rotatedTextRect,
+  restoreCaptionCoordinates
+} from './literature-pdf-orientation.mjs'
 import { readFigureSequence } from './literature-pdf-figure-sequence.mjs'
 
 const [pdfArgument, assetArgument, runtimeArgument, pageArgument, outputArgument] =
@@ -130,24 +142,37 @@ const normalize = (rect, width, height) => rect.map((v, i) => v / (i % 2 ? heigh
 const pageWords = new Map(
   geometry.pages.map((page) => [
     page.pageNumber,
-    new Set(
-      page.lines.flatMap((line) =>
-        (line.text.toLowerCase().match(/\p{L}+(?:[-\u2010\u2011]\p{L}+)*/gu) ?? []).map((word) =>
-          word.replace(/[\u2010\u2011]/g, '-')
-        )
-      )
-    )
+    sourceWordSpellings(page.lines.map((line) => line.text))
   ])
 )
 const captionValue = (c) =>
   c
     ? {
-        text: joinCaptionLines(c.lines, pageWords.get(c.page)),
+        text: joinCaptionLines(
+          c.lines,
+          c.regions
+            ? new Set(c.regions.flatMap(({ page }) => [...(pageWords.get(page) ?? [])]))
+            : pageWords.get(c.page)
+        ),
         lines: c.lines,
         page: c.page,
-        rect: c.rect
+        rect: c.rect,
+        ...(c.regions ? { regions: c.regions } : {})
       }
     : undefined
+// Neighbor geometry may own the first half of a caption outside this job.
+// Prove its graphic locally before suppressing a caption-only tail; never
+// publish the auxiliary figure as a newly processed page.
+const auxiliaryCaptionOwners = captions.flatMap((caption) => {
+  if (requestedPages.includes(caption.page)) return []
+  const combined = resolveFigureCaption(caption, captions)
+  if (!combined.regions) return []
+  const page = geometry.pages.find((p) => p.pageNumber === caption.page)
+  if (!page) return []
+  return associateFigures(page, captions)
+    .filter((figure) => figure.rect && figure.caption === caption)
+    .map((figure) => ({ region: figure.rect, caption: captionValue(combined) }))
+})
 try {
   const document = await task.promise
   const separatedFigures =
@@ -199,11 +224,11 @@ try {
     const scale = Math.ceil(pageGeometry.width * 1.5) / pageGeometry.width
     const page = await document.getPage(pageNumber)
     try {
-      const crop = async (rect, id) => {
+      const crop = async (rect, id, regions) => {
         const relativePath = `thumbnails/${id}.png`
         await writeFile(
           join(output, relativePath),
-          await renderPdfCrop(page, rect, pageGeometry.renderRotation)
+          await renderPdfCrop(page, rect, p
```

---

### Incident Patch 9: `022e0703` (2026-09-30)
**Commit Message**: fix(notebook): share sandbox npm global tools across sessions (#3160)

* fix(notebook): share sandbox npm global tools across sessions

* fix(storage): preserve WSL npm tools during data moves

Use guest filesystem operations for Linux npm links across copy, verification, commit, discard, and cleanup recovery. Keep the source when the configured WSL profile is unavailable, without changing persisted receipt formats.

* test(notebook): verify global npm tools in the desktop app

* test(notebook): align npm sandbox coverage with CI prerequisites

Synchronize architecture contracts with additive consumer registrations and classify the new npm environment helper as Windows-sensitive. Run real Linux npm sandbox coverage in the existing provisioned isolation job while retaining ordinary Shell tests in portable shards.

* test(notebook): stage local npm input inside each sandbox

* fix(notebook): allow sandbox reads of the selected npm CLI

Resolve the executable npm launcher on native POSIX PATH and grant its physical npm package read-only access. Keep sibling data, host npm writes, and protected runtime writes denied. Cover private Node layouts with real sandbox syscalls and make the wr

**File**: `.github/workflows/pr-gate.yml` (modified, +1/-0)
```diff
@@ -841,6 +841,7 @@ jobs:
           packages/notebook-network-sandbox/src/filesystem-enforcement.integration.test.ts
           packages/notebook-network-sandbox/src/network-enforcement.integration.test.ts
           src/main/session-plan/plan-context-file.shell.integration.test.ts
+          src/main/notebook/shell-cell-session.integration.test.ts
 
   windows_core:
     name: Windows core
```

**File**: `docs/PRD.md` (modified, +1/-0)
```diff
@@ -303,6 +303,7 @@ Key implemented capabilities, mapped to the codebase:
 - **Project layer.** Prisma + SQLite `Project` model; full CRUD via IPC (`projects:create/list/get/update/delete`); project/session navigation, pinning and archiving, and global search.
 - **Per-project session storage.** Sessions live at `sessions/<projectId>/<sessionId>.json` (migrated from a legacy single-file format on first run, idempotently); a manifest file restores the last-open project/session; a save bridge diffs the in-memory store against disk so only changed sessions get written. New v2 writes always include the canonical `conversationGraph`. The envelope also retains flat messages and activities as active-Branch compatibility fields; the materialization boundary synchronizes them before writing, so they must not be treated as an independent authority. Historical flat-only files remain readable and acquire a graph on their next write.
 - **Notebook execution runtime.** Warm Python, R, and REPL control-plane kernels are routed by session binding, while shell commands execute in order in a live interpreter per session lane and shell runtime. Shell variables, exports, functions, and working-directory changes survive across cells until cancellation, timeout, exit, restart, or a changed launch context resets the interpreter. Interpreter state stays in memory; earlier commands are never replayed to restore it. Cross-kernel handoff uses the shared workspace, and execution retains durable per-run history (`run.json`) through write-locking and atomic persistence. Environment and package mutations use a separate crash-recoverable operation journal. App-managed conda environments support offline provisioning and named-environment lifecycle; bring-your-own interpreter discovery and registration apply to Python and R, and external R package installation can use a consent-approved personal library.
+- **Shell npm tools.** When Node/npm is available in the selected Shell runtime, `npm install -g` uses the app-owned `runtime/npm/<platform>-<arch>` prefix. Its command directory is on every Shell PATH, sharing tools across cells, Sessions, and app restarts. Windows native and WSL Linux packages remain separate. Ordinary installs keep npm's local project behavior. Downloads use the disposable Notebook cache; cache cleanup and Python/R reset retain installed tools. Data-root migration copies and verifies the global package tree and relative command links before source cleanup. On Windows, moving WSL npm packages requires the activated WSL profile: guest filesystem operations preserve Linux links and permissions during copy, verification, and cleanup recovery. If WSL is unavailable, the move stops before switching roots; pending cleanup retains the source until WSL is available. Native Windows npm packages do not require WSL. Links outside the moved package tree must be removed or replaced before moving it. A staged move that predates newly installed tools must be repeated. Host npm configuration is not rewritten and host global packages are not imported. Packages with hardcoded installation paths may require reinstall after relocation. Use `npm uninstall -g` to remove shared tools; concurrent updates retain npm's own behavior. No new database state or package-operation journal is introduced.
 - **Managed runtime reinstall.** Settings can rebuild only the exact app-managed `default-python` and `default-r` environments. After explicit confirmation, the main process durably blocks the target runtime, marks matching bindings repair-required, cancels executing cells, closes running and idle kernels (including sessions using the implicit default), and then reuses the existing data-root gate, exclusive environment mutation lease, operation journal, recovery, provision, verification, and ready-marker path. The confirmation can be cancelled; once prefix deletion begins, rebuilding is deliberately uninterruptible so cancellation cannot leave a half-deleted environment. 
```

**File**: `e2e/certification/notebook-lifecycle.spec.ts` (modified, +82/-2)
```diff
@@ -1,6 +1,6 @@
 import { expect } from '@playwright/test'
-import { mkdir } from 'node:fs/promises'
-import { resolve } from 'node:path'
+import { access, mkdir, readFile } from 'node:fs/promises'
+import { join, resolve } from 'node:path'
 import { test } from '../fixtures/electron-app'
 import { createProject, openRecentSession, sendPrompt } from './helpers'
 
@@ -16,6 +16,86 @@ const captureLifecycleEvidence = async (
 const controlledWindowsFixtureAvailable =
   process.platform === 'win32' && Boolean(process.env.OPEN_SCIENCE_E2E_MICROMAMBA_EVENTS)
 
+test('installs global npm tools through the app and reuses them across Sessions and restart', async ({
+  app
+}) => {
+  test.setTimeout(240_000)
+  await app.completeOnboarding()
+  let page = await app.configureFakeAgent()
+  await createProject(page, 'Npm installation')
+  await sendPrompt(
+    page,
+    'Verify application npm global install.',
+    'Application npm install verified',
+    90_000
+  )
+  await page.getByRole('button', { name: 'All projects', exact: true }).click()
+  await createProject(page, 'Npm shared tools')
+  await sendPrompt(
+    page,
+    'Verify application npm shared tool and local install.',
+    'Application npm local verified',
+    90_000
+  )
+  await captureLifecycleEvidence(page, 'npm-across-sessions.png')
+  page = await app.restart()
+  await openRecentSession(page, 'Verify application npm shared tool and local install.')
+  await sendPrompt(
+    page,
+    'Verify application npm tool after restart.',
+    'Application npm restart verified',
+    90_000
+  )
+  await captureLifecycleEvidence(page, 'npm-after-app-restart.png')
+  const parent = await app.createTestDirectory('npm-migration')
+  const staged = await page.evaluate(async (parent) => {
+    const bridge = globalThis as unknown as {
+      api: {
+        storage: {
+          migrate: (parent: string) => Promise<{ ok: boolean; error?: string }>
+          inspectDataRoot: (
+            parent: string
+          ) => Promise<{ kind: string; dataRoot: string; recoveryStatus?: string }>
+        }
+      }
+    }
+    const moved = await bridge.api.storage.migrate(parent)
+    if (!moved.ok) throw new Error(moved.error)
+    return bridge.api.storage.inspectDataRoot(parent)
+  }, parent)
+  expect(staged).toMatchObject({ kind: 'recover', recoveryStatus: 'verified' })
+  const packageRoot = join(
+    staged.dataRoot,
+    'runtime',
+    'npm',
+    `${process.platform}-${process.arch}`,
+    ...(process.platform === 'win32' ? [] : ['lib']),
+    'node_modules',
+    'os-npm-app-fixture'
+  )
+  expect(JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')).name).toBe(
+    'os-npm-app-fixture'
+  )
+  const discarded = await page.evaluate(async (parent) => {
+    const bridge = globalThis as unknown as {
+      api: {
+        storage: {
+          discardMigratedCopy: (parent: string) => Promise<unknown>
+        }
+      }
+    }
+    return bridge.api.storage.discardMigratedCopy(parent)
+  }, parent)
+  expect(discarded).toEqual({ ok: true })
+  await expect(access(staged.dataRoot)).rejects.toMatchObject({ code: 'ENOENT' })
+  await sendPrompt(
+    page,
+    'Verify application npm tool after restart.',
+    'Application npm restart verified',
+    90_000
+  )
+})
+
 test('runs and shuts down a Notebook session through its packaged MCP boundary', async ({
   app
 }) => {
```

**File**: `e2e/fixtures/fake-opencode.mjs` (modified, +51/-0)
```diff
@@ -642,6 +642,51 @@ const verifyNotebookLifecycle = async (sessionId, delayMs = 0) =>
     return `Notebook lifecycle verified for ${initial.sessionId}.`
   })
 
+const verifyGlobalNpmTools = async (sessionId, mode) =>
+  withMcpClient(sessionId, 'open-science-notebook', async (client) => {
+    const execute = async (command) => {
+      const result = toolResult(
+        'bash_execute',
+        await client.callTool({
+          name: 'bash_execute',
+          arguments: { command }
+        })
+      )
+      if (result.exitCode !== 0)
+        throw new Error(`npm application check failed: ${JSON.stringify(result)}`)
+      return result.stdout ?? ''
+    }
+    const node = (code) =>
+      `node -e "eval(Buffer.from('${Buffer.from(code).toString('base64')}','base64').toString())"`
+    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
+    const invoke = process.platform === 'win32' ? 'os-npm-app-fixture.cmd' : 'os-npm-app-fixture'
+    if (mode !== 'restart') {
+      await execute(
+        node(`
+        const fs = require('node:fs');
+        fs.mkdirSync('npm-fixture', { recursive: true });
+        fs.writeFileSync('npm-fixture/package.json', JSON.stringify({ name: 'os-npm-app-fixture', version: '1.0.0', bin: { 'os-npm-app-fixture': 'cli.js' } }));
+        fs.writeFileSync('npm-fixture/cli.js', '#!/usr/bin/env node\\nprocess.stdout.write("npm-application-tool");\\n');
+      `)
+      )
+      await execute(`${npm} pack ./npm-fixture --offline --ignore-scripts`)
+      await execute(
+        `${npm} install ${mode === 'install' ? '-g ' : ''}./os-npm-app-fixture-1.0.0.tgz --offline --ignore-scripts --no-audit --no-fund`
+      )
+      if (mode === 'local') {
+        await execute(
+          node(
+            `if (!require('node:fs').existsSync('node_modules/os-npm-app-fixture/package.json')) throw new Error('Local npm package escaped the project');`
+          )
+        )
+      }
+    }
+    if (!(await execute(invoke)).includes('npm-application-tool')) {
+      throw new Error('The global npm command was not available in this Session.')
+    }
+    return `Application npm ${mode} verified through sandboxed Shell.`
+  })
+
 const readMicromambaEvents = async (path) =>
   readFile(path, 'utf8')
     .catch(() => '')
@@ -1625,6 +1670,12 @@ if (process.argv.includes('--version')) {
             '  A[begin] --> B[a node with a fairly long label] --> C[another node with an even longer label here] --> D[end]',
             '```'
           ].join('\n')
+        } else if (prompt.includes('Verify application npm global install.')) {
+          reply = await verifyGlobalNpmTools(context.params.sessionId, 'install')
+        } else if (prompt.includes('Verify application npm shared tool and local install.')) {
+          reply = await verifyGlobalNpmTools(context.params.sessionId, 'local')
+        } else if (prompt.includes('Verify application npm tool after restart.')) {
+          reply = await verifyGlobalNpmTools(context.params.sessionId, 'restart')
         } else if (prompt.includes('Verify WSL background cancellation.')) {
           await withMcpClient(context.params.sessionId, 'open-science-notebook', async (client) => {
             // Compute lists persistent kernels, not stateless Shell Runs. Keep a real REPL
```

**File**: `packages/notebook-network-sandbox/runtime/src/platform/wsl2-isolation.ts` (modified, +3/-0)
```diff
@@ -703,6 +703,9 @@ const createGuestEnvironment = async (
     }
     environment[key] = await map(value)
   }
+  if (environment.NPM_CONFIG_PREFIX) {
+    environment.PATH = `${environment.NPM_CONFIG_PREFIX}/bin:${environment.PATH}`
+  }
   return environment
 }
 
```

---

### Incident Patch 10: `d23f84e6` (2026-09-30)
**Commit Message**: fix(literature): clear annotation selection before closing reader (#3156)

**File**: `e2e/pdf-annotations.spec.ts` (modified, +22/-0)
```diff
@@ -122,7 +122,29 @@ test('imports external notes, preserves provenance through undo, and persists an
     .first()
     .click()
   await expect(originalView.locator('[data-pdf-bookmark-revealed="true"]')).toBeVisible()
+  const selectedMark = originalView
+    .locator('[data-pdf-bookmark-highlight][aria-pressed="true"]')
+    .first()
+  await expect(selectedMark).toBeVisible()
+  const selectedCard = notesSidebar
+    .locator('[data-annotation-id]')
+    .filter({ hasText: 'External highlight' })
+  const cardBounds = (await selectedCard.boundingBox())!
+  const quoteBounds = (await selectedCard.locator('blockquote').boundingBox())!
+  expect(quoteBounds.x - cardBounds.x).toBeGreaterThanOrEqual(8)
+  expect(
+    cardBounds.x + cardBounds.width - quoteBounds.x - quoteBounds.width
+  ).toBeGreaterThanOrEqual(8)
   await page.screenshot({ path: testInfo.outputPath('notes-sidebar-wide.png') })
+  await page.keyboard.press('Escape')
+  await expect(
+    originalView.locator('[data-pdf-bookmark-highlight][aria-pressed="true"]')
+  ).toHaveCount(0)
+  await expect(page.locator('[data-slot="file-preview-dialog"]')).toBeVisible()
+  await page.keyboard.press('Escape')
+  await expect(page.locator('[data-slot="file-preview-dialog"]')).toHaveCount(0)
+  await page.getByRole('button', { name: 'Preview native-notes.pdf', exact: true }).click()
+  await page.getByRole('button', { name: 'Show notes sidebar', exact: true }).click()
   await page.getByRole('button', { name: 'Show navigation', exact: true }).click()
   await expect(notesSidebar).toBeVisible()
   const toolbar = page.getByRole('tablist', { name: 'PDF reading mode' })
```

**File**: `src/renderer/src/pages/workspace/previews/renderers/PdfNotebookView.tsx` (modified, +1/-1)
```diff
@@ -1254,7 +1254,7 @@ const PdfNotebookView = ({
                     className={cn(
                       '@container/annotation-card group bg-bg-000',
                       sidebar
-                        ? 'border-b border-border/70 py-3'
+                        ? '-mx-2 rounded-md border-b border-border/70 px-2 py-3'
                         : 'rounded-xl border border-border/80 p-3 shadow-sm transition-shadow hover:shadow-md',
                       sidebar &&
                         selectedId === bookmark.id &&
```

**File**: `src/renderer/src/pages/workspace/previews/renderers/PdfPreview.test.tsx` (modified, +122/-0)
```diff
@@ -4436,4 +4436,126 @@ describe('PdfPreviewContent', () => {
       expect(deleteAnnotation).toHaveBeenCalledWith(expect.objectContaining({ id: 'bookmark-1' }))
     )
   })
+  it.each(['literature', 'upload'] as const)(
+    'handles selected annotation Escape only in the %s reader',
+    async (previewSource) => {
+      getPage.mockResolvedValue({
+        getViewport: vi.fn(() => ({ width: 600, height: 800, rotation: 0 })),
+        getTextContent: vi
+          .fn()
+          .mockResolvedValue({ items: [{ str: 'Selectable text' }], styles: {} }),
+        render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
+        cleanup: vi.fn()
+      })
+      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)
+      const source = {
+        kind:
+          previewSource === 'literature'
+            ? ('literature-attachment-version' as const)
+            : ('upload-version' as const),
+        projectId: 'project-1',
+        sessionId: 'session-1',
+        sourceFileId: 'file-1',
+        versionId: 'version-1',
+        name: 'paper.pdf',
+        path: `${previewSource === 'literature' ? 'literature-attachment-version' : 'upload-version'}:version-1`,
+        checksum: 'a'.repeat(64)
+      }
+      const annotation: SavedPdfAnnotation = {
+        id: 'bookmark-1',
+        projectId: source.projectId,
+        sessionId: source.sessionId,
+        version: 1,
+        origin: 'user',
+        target: {
+          source,
+          selector: {
+            kind: 'text',
+            pageNumber: 1,
+            exact: 'Selectable text',
+            position: { start: 0, end: 15 },
+            quads: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.03 }],
+            extractorVersion: 'pdfjs-test',
+            pageRotation: 0,
+            coordinateVersion: 1
+          }
+        },
+        kind: 'underline',
+        color: 'pink',
+        tagIds: [],
+        note: 'Saved note',
+        createdAt: '2026-09-19T00:00:00.000Z',
+        updatedAt: '2026-09-19T00:00:00.000Z'
+      }
+      window.api = {
+        ...window.api,
+        tags: { snapshot: vi.fn().mockResolvedValue({ revision: 1, tags: [], assignments: [] }) },
+        pdfAnnotations: {
+          list: vi.fn().mockResolvedValue({ source, items: [annotation], total: 1 })
+        }
+      } as unknown as Window['api']
+      await act(async () => {
+        root.render(
+          <PdfAnnotationsProvider projectId={source.projectId} sessionId={source.sessionId}>
+            <PdfPreviewContent
+              path={source.path}
+              name={source.name}
+              source={previewSource}
+              projectId={source.projectId}
+              sessionId={source.sessionId}
+              managedFileId={source.sourceFileId}
+              selectedVersionId={source.versionId}
+              pdfBookmarkSource={source}
+            />
+          </PdfAnnotationsProvider>
+        )
+        await flush()
+      })
+      const highlight = await waitFor(() => {
+        const element = container.querySelector<HTMLButtonElement>(
+          '[data-pdf-bookmark-highlight="bookmark-1"]'
+        )
+        expect(element).not.toBeNull()
+        return element!
+      })
+      await act(async () => highlight.click())
+      const pdfRoot = container.querySelector<HTMLElement>('[data-pdf-preview-root]')!
+      expect(highlight.getAttribute('aria-pressed')).toBe('true')
+      expect(pdfRoot.hasAttribute('data-preview-escape-boundary')).toBe(
+        previewSource === 'literature'
+      )
+      const composingEscape = new KeyboardEvent('keydown', {
+        key: 'Escape',
+        bubbles: true,
+        cancelable: true,
+        isComposing: true
+      })
+      await act(async () => document.activeElement!.dispatchEvent(composingEscape))
+      expect(highlight.getAttribute('aria-pressed')).toBe('true')
+      // An inner panel owns its Escape, even when it is portalled outside the reader.
+      cons
```

**File**: `src/renderer/src/pages/workspace/previews/renderers/PdfPreview.tsx` (modified, +14/-0)
```diff
@@ -2795,6 +2795,9 @@ export const PdfPreviewContent = ({
           readingMode === 'original' &&
           ['area', 'area-annotation', 'text-annotation'].includes(cursorMode)
         }
+        data-preview-escape-boundary={
+          source === 'literature' && selectedBookmarkId ? '' : undefined
+        }
         onKeyDown={(event) => {
           // Portalled panels remain mounted during exit motion. Let their own
           // dismissal consume Escape before the surrounding PDF tool handles it.
@@ -2804,6 +2807,17 @@ export const PdfPreviewContent = ({
               ? event.target.closest('[role="dialog"], [role="menu"]')
               : null
           if (layer && !layer.contains(event.currentTarget)) return
+          if (
+            event.key === 'Escape' &&
+            !event.nativeEvent.isComposing &&
+            source === 'literature' &&
+            selectedBookmarkId
+          ) {
+            event.preventDefault()
+            event.stopPropagation()
+            setSelectedBookmarkId(undefined)
+            return
+          }
           if (
             event.key === 'Escape' &&
             !event.nativeEvent.isComposing &&
```

#### Recent Merged Pull Requests:
- **PR #3177** (2026-09-30): docs(contributing): clarify module-impact registration workflow (@ewen-poch)
- **PR #3176** (2026-09-30): fix(windows-installer): allow reinstall after old parent removal (@ewen-poch)
- **PR #3174** (2026-09-30): feat(library-preview): add inbox navigation and batch acceptance (@ewen-poch)
- **PR #3172** (2026-09-30): fix(literature): simplify journal mapping hints (@ewen-poch)
- **PR #3170** (2026-09-30): feat(workspace): add .science import entry to empty state (@wen2zhou)
- **PR #3169** (2026-09-30): fix(journals): clarify journal import column roles (@ewen-poch)
- **PR #3168** (2026-09-30): fix(credentials): restore Linux KWallet startup (@ewen-poch)
- **PR #3167** (2026-09-30): fix(literature): add an overflow shadow to pinned columns (@ewen-poch)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
