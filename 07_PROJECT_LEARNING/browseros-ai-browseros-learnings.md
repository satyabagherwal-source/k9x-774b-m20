# Forensic Learning Record (Deep Inspection): browseros-ai/BrowserOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/browseros-ai-browseros-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/browseros-ai/BrowserOS](https://github.com/browseros-ai/BrowserOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:22:18.430Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `browseros-ai/BrowserOS`
- **Description**: 🌐 The open-source Agentic browser; alternative to ChatGPT Atlas, Perplexity Comet, Dia.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13781 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/App.tsx`
```
import { Onboarding } from './onboarding/Onboarding'

export function App() {
  return <Onboarding />
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/components/ui/button.tsx`
```
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background shadow-xs hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

```

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/components/ui/checkbox.tsx`
```
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs transition-shadow outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

```

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/components/ui/form.tsx`
```
'use client'

import * as React from 'react'
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
  useFormState,
} from 'react-hook-form'
import { cn } from '@/lib/utils'

const Form = FormProvider

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext?.name })

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }
  if (!itemContext) {
    throw new Error('useFormField should be used within <FormItem>')
  }

  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

interface FormItemContextValue {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null)

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn('grid gap-2', className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message ?? '') : props.children
  if (!body) return null
  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn('text-destructive text-sm', className)}
      {...props}
    >
      {body}
    </p>
  )
}

export { Form, FormField, FormItem, FormMessage }

```

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/components/ui/tooltip.tsx`
```
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

```

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/main.tsx`
```
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

```

### Core Architecture Module: `packages/browseros-agent/apps/app-onboard/src/onboarding/Onboarding.tsx`
```
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import {
  BROWSEROS_ONBOARDING_API_VERSION,
  type BrowserOSImportStatus,
  type BrowserOSOnboardingState,
} from './browseros-onboarding-api'
import { createBrowserOSOnboardingBridge } from './browseros-onboarding-bridge'
import { OnboardingShell } from './components/OnboardingShell'
import {
  importSourceSelectionChangeFor,
  selectedSourceById,
  startImportRequestFor,
} from './onboarding-v2.helpers'
import {
  type OnboardingFormValues,
  onboardingFormDefaults,
  onboardingFormResolver,
} from './onboarding-v2.schemas'
import type { ImportPhase, Step } from './onboarding-v2.types'
import { ImportStep } from './steps/ImportStep'
import { SetupAgentStep } from './steps/SetupAgentStep'
import { SetupStep } from './steps/SetupStep'
import { WelcomeStep } from './steps/WelcomeStep'

const TOTAL_STEPS = 3

const initialOnboardingState: BrowserOSOnboardingState = {
  apiVersion: BROWSEROS_ONBOARDING_API_VERSION,
  status: 'idle',
  sources: [],
}

/** Maps Chromium importer status into the local three-step onboarding screen state. */
export function importPhaseFor(status: BrowserOSImportStatus): ImportPhase {
  if (status === 'importing') return 'importing'
  if (status === 'failed') return 'failed'
  if (status === 'succeeded') return 'imported'
  return 'picker'
}

/** Runs the standalone three-step BrowserOS onboarding flow. */
export function Onboarding() {
  const reduce = useReducedMotion()
  const form = useForm<OnboardingFormValues>({
    resolver: onboardingFormResolver,
    defaultValues: onboardingFormDefaults,
    mode: 'onChange',
  })

  const [step, setStep] = useState<Step>(0)
  const direction = useRef(1)
  const [bridge] = useState(() => createBrowserOSOnboardingBridge())
  const [onboardingState, setOnboardingState] =
    useState<BrowserOSOnboardingState>(initialOnboardingState)
  const didNotifyPageReady = useRef(false)
  const importPhase = importPhaseFor(onboardingState.status)
  const isFinishing = Boolean(
    onboardingState.setupState && onboardingState.setupState !== 'idle',
  )

  function goTo(next: Step) {
    direction.current = next >= step ? 1 : -1
    setStep(next)
  }

  useEffect(() => {
    // Install first: pageReady may synchronously restore an in-flight setup
    // after reload. Receiving it only renders state; it never sends COMPLETE.
    const cleanup = bridge.registerReceiver(setOnboardingState)
    if (!didNotifyPageReady.current) {
      didNotifyPageReady.current = true
      bridge.pageReady()
    }
    return cleanup
  }, [bridge])

  // Sync the picker form to whatever profiles the native side reports. This is a
  // subscription to an external source (the chrome.send bridge), so it stays an
  // effect rather than derived render state.
  useEffect(() => {
    const currentSourceId = form.getValues('selectedSourceId')
    const selectionChange = importSourceSelectionChangeFor(
      onboardingState.sources,
      currentSourceId,
    )
    if (!selectionChange) return
    if (selectionChange.selectedSourceId !== currentSourceId) {
      form.setValue('selectedSourceId', selectionChange.selectedSourceId, {
        shouldValidate: true,
      })
    }
    if (selectionChange.selectedItems.length === 0) {
      if (form.getValues('selectedItems').length > 0) {
        form.setValue('selectedItems', [], { shouldValidate: true })
      }
      return
    }
    form.setValue('selectedItems', selectionChange.selectedItems, {
      shouldValidate: true,
    })
  }, [form, onboardingState.sources])

  function startImport() {
    const source = selectedSourceById(
      onboardingState.sources,
      form.getValues('selectedSourceId'),
    )
    if (!source) return
    const request = startImportRequestFor(
      source,
      form.getValues('selectedItems'),
    )
    if (!request) return
    bridge.startImport(request)
  }

  // The bridge publishes preparing before sending the finish request and
  // suppresses repeated exits. Chromium alone decides when it is safe to leave.
  function finishOnboarding() {
    bridge.complete()
  }

  return (
    <Form {...form}>
      <OnboardingShell
        step={step}
        totalSteps={TOTAL_STEPS}
        showProgress={!isFinishing}
      >
        {isFinishing ? (
          <SetupStep
            failed={onboardingState.setupState === 'failed'}
            onRetry={() => bridge.retrySetup()}
          />
        ) : (
          <>
            {/* Re-mounts on each step (keyed) and plays a directional slide-in.
            No exit animation, so the flow can never stall waiting on one. */}
            <motion.div
              key={step}
              initial={
                reduce
                  ? false
                  : { x: direction.current >= 0 ? 40 : -40, opacity: 0 }
              }
              animate={{ x: 0, opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
                opacity: { duration: 0.2 },
              }}
            >
              {step === 0 && (
                <WelcomeStep
                  onPrimary={() => goTo(1)}
                  onSkip={finishOnboarding}
                />
              )}
              {step === 1 && (
                <ImportStep
                  phase={importPhase}
                  state={onboardingState}
                  form={form}
                  onImport={startImport}
                  onRefresh={() => bridge.refreshSources()}
                  onContinue={() => goTo(2)}
                />
              )}
              {step === 2 && <SetupAgentStep onSetup={finishOnboarding} />}
            </motion.div>
          </>
        )}
      </OnboardingShell>
    </Form>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2673** (2026-09-15): **Unable to Open Recent Agent Chat**
  *Symptoms*: ### Issue Type  Agent Issue  ### Operating System  macOS  ### Description of the bug  I like to resume to my previous conversation lots of times and when my computer restarts or when i close my browser and come back, it as usual will show that the chat exist, so i click on it but then it returns to the original default agent panel screen.   <img width="596" height="228" alt="Image" src="https://github.com/user-attachments/assets/ca1ae353-ca3a-4c51-9b0d-dc3d9611fd5c" />  For example here I'll click on one of them, but then it will take me back to the default landing page:   <img width="442" height="513" alt="Image" src="https://github.com/user-attachments/assets/5ca069a3-55b7-42d0-b8df-048e104bb1a5" />  ### Steps to Reproduce  Mentioned above.  ### Screenshots / Videos  _No response_  ### BrowserOS Version  151.0.8160.137  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > a fix has been merged in https://github.com/browseros-ai/BrowserOS/pull/2667 - this will be published in the next update

- **Issue #2479** (2026-09-08): **MCP Tool Schema Pydantic Validation Failure (enum.3)**
  *Symptoms*: ### Issue Type  Both / Not sure  ### Operating System  macOS  ### Description of the bug  Bug Report: The MCP client fails during tool schema decoding when encountering a null (None) value inside a string enumeration array (enum.3) provided by the BrowserOS neo MCP server. Pydantic v2 strict typing expects all enum elements to be valid strings, resulting in a ValidationError.  dcode version : v0.1.65  langchain deepagent dcode  " Error: Agent error: ValidationError: 1 validation error for Schema enum.3   Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]     For further information visit https://errors.pydantic.dev/2.13/v/string_type "  ### Steps to Reproduce  1- set up browseros-neo. "     "browseros-neo": {       "type": "http",       "url": "http://127.0.0.1:9010/mcp"     }, " 2- run  'dcode '. langraph deepagent dcode version : v0.1.65 3- dcode tui result error on any prompt executed: " Error: Agent error: ValidationError: 1 validation error for Schema enum.3   Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]     For further information visit https://errors.pydantic.dev/2.13/v/string_type "  ### Screenshots / Videos  <img width="1016" height="605" alt="Image" src="https://github.com/user-attachments/assets/b1c4b964-5101-4f1c-a32c-c248604eeda6" />  ### BrowserOS Version  BrowserOS - 0.49.5.0  ### Additional Context  works on most  other harnesses; opencode, vscode, antigravity, custom harness.
  **Post-Mortem & Fix Analysis**:
  > The fix is merged and will be released in the next update.  Thanks @avinashgola for the PR!

- **Issue #2436** (2026-09-26): **[macOS] WebAuthn platform authenticator unavailable because app entitlements omit Touch ID keychain groups**
  *Symptoms*: ### Issue Type  Browser Issue  ### Operating System  macOS  ### Description of the bug  BrowserOS on macOS reports that no user-verifying platform authenticator is available for WebAuthn. As a result, websites cannot start passkey/Touch ID authentication.  This is reproducible even when macOS Touch ID is enabled and a fingerprint is enrolled:  - `bioutil -r` reports that biometrics for unlock are enabled. - `bioutil -c` reports an enrolled biometric template. - `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` resolves to `false` in BrowserOS.  The installed BrowserOS app's code signature contains device entitlements, but does not contain the WebAuthn-related entitlements:  - `keychain-access-groups` - `com.apple.developer.web-browser.public-key-credential` - a `.webauthn` keychain access group  This appears to be a packaging/signing issue rather than a missing macOS Touch ID setting.  ### Steps to Reproduce  1. Install BrowserOS `0.48.2` on macOS. 2. Open any WebAuthn/passkey relying party that supports a platform authenticator. 3. Run `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` in the page context, or attempt a Touch ID/passkey sign-in. 4. Observe that the API returns `false` and the platform authenticator is reported as unavailable.  ### Expected  BrowserOS should report a macOS platform authenticator when Touch ID is enabled, and WebAuthn should be able to invoke Touch ID for passkey operations.  ### Actual  BrowserOS reports 
  **Post-Mortem & Fix Analysis**:
  > The signing code changes landed in #2487, but this isn't fixed in the published 0.50.3 macOS app yet. I checked the arm64 release DMG: there's no embedded provisioning profile, keychain-access-groups entitlement, or com.apple.developer.web-browser.public-key-credential entitlement.  The [release build](https://github.com/browseros-ai/BrowserOS/actions/runs/34011734605/job/101429999474) also explicitly says it signed without macOS platform passkeys because the profile wasn't configured. Keeping this open until a correctly provisioned release ships and the platform-authenticator check is verified. Thanks for identifying the signing requirements. 
  > 不再跟进此问题，关闭。

- **Issue #2423** (2026-09-07): **MCP `run` tool fails with -32600 structuredContent on every success**
  *Symptoms*: ### Issue Type  Both / Not sure  ### Operating System  Linux  ### Description of the bug  `BrowserOS Neo` MCP (`http://localhost:9010/mcp`) — the `run` tool always returns:  MCP error -32600: Tool run has an output schema but did not return structured content  on every successful execution, regardless of payload (`return "hello"`, `console.log`, `browser.pages.list()`, `browser.pages.newPage(...)`).  Side-effects DO execute (e.g. `browser.pages.newPage("https://www.detik.com")` creates a new tab visible via `tabs list`), but the success response is empty.  Error path DOES work — `throw new Error(...)` correctly returns the message. So the bug is success path not populating `structuredContent` despite declaring an `outputSchema`.  Expected: `run` should return `structuredContent`/`content` wrapping the `return` value and `console.log` output.  Granular tools (`tabs`, `snapshot`, `grep`, `screenshot`, `evaluate`) all work fine on same server.  <img width="682" height="637" alt="Image" src="https://github.com/user-attachments/assets/5f9d52ad-2064-4dfe-bd37-0bb41be190d1" />  ### Steps to Reproduce  1. Configure MCP as `"BrowserOS Neo": {"type":"remote","url":"http://localhost:9010/mcp","enabled":true}` in `~/.config/opencode/opencode.jsonc` and restart opencode. 2. Call `run` with `code: 'return "hello";'` → observe `-32600`. 3. Call `run` with `code: 'const p=await browser.pages.newPage("https://example.com"); return "ok";'` → same `-32600`, but `tabs list` shows the new page wa
  **Post-Mortem & Fix Analysis**:
  > This is fixed in [neo server 0.0.50](https://github.com/browseros-ai/BrowserOS/releases/tag/claw-server/v0.0.50), which is on the production server update feed. #2513 preserves structuredContent for tools that declare an output schema, including run, so successful results no longer fail MCP validation.  Thanks for the minimal repro and for distinguishing successful side effects from the broken response. Closing as fixed. The relevant update is neo's server update, separate from the BrowserOS 0.50.3 desktop release. 

- **Issue #2417** (2026-09-07): **Agent Mode Query Fails Midway**
  *Symptoms*: ### Issue Type  Agent Issue  ### Operating System  Windows  ### Description of the bug  I'm encountering an error when using agent mode. Whenever I submit a query, the response stops midway and throws an error message saying “something went wrong.” I tested this with different AI setups, including BrowserOS and OpenAI-compatible APIs, but the issue persists across all of them.  ### Steps to Reproduce  1. open Browser os and Enable Agent Mode 2. Submit a Query 3. Watched the response fail midway with the error.  ### Screenshots / Videos  <img width="468" height="927" alt="Image" src="https://github.com/user-attachments/assets/bb520ab7-2194-470b-b541-487e35dfd6cd" />  ### BrowserOS Version  148.0.7966.97  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > This should be fixed in [BrowserOS 0.50.3](https://github.com/browseros-ai/BrowserOS/releases/tag/v0.50.3), which includes the redesigned agent and updated provider integration. Please update to 0.50.3. Closing this older report; if a task still fails midway, please open a new issue with the current provider/model and the detailed error now shown by the app. Thanks for reporting this.

- **Issue #2279** (2026-08-21): **Bug: Claude Code provider always fails via malformed Windows path for CLAUDE.md.browseros-tmp**
  *Symptoms*: ### Issue Type  Agent Issue  ### Operating System  Windows  ### Description of the bug  Give me a write up for a bug ticket  **Environment** - BrowserOS version: `148.0.7966.97` - OS: Windows (paths use drive-letter format, e.g. `C:\Users\...`) - Provider affected: `claude-code` (via `@agentclientprotocol/claude-agent-acp@0.31.4`) - Claude Code CLI/SDK: `2.1.121`, entrypoint `sdk-ts`  **Summary** Every chat request using the `claude-code` provider fails with a generic `"An error occurred."` toast in the UI, even though the underlying Claude Code ACP subprocess and Anthropic account/auth are fully functional. The root cause is a malformed file path — built by concatenating two absolute paths instead of joining directory + filename — that BrowserOS uses when writing the `CLAUDE.md` workspace-instructions file. Because the resulting path embeds a second drive letter (`C:`) mid-path, it is invalid on Windows and the write fails every single time.  **Steps to reproduce** 1. On Windows, open BrowserOS and start a chat using the `claude-code` provider. 2. Send any message. 3. Observe the UI show "Something went wrong / An error occurred" with a "Try again" button. 4. Network tab shows a 200 response whose SSE body is `{"type":"start"}` followed almost immediately by `{"type":"error","errorText":"An error occurred."}`.  **Relevant log lines** (`%LOCALAPPDATA%\BrowserOS\User Data\.browseros\browseros-server.log`) ```json {"providerType":"claude-code","workspacePath":"C:\\Users\\Triss\
  **Post-Mortem & Fix Analysis**:
  > Update, I'm seeing this event stream with a 200 response on the chat request:   <img width="893" height="961" alt="Image" src="https://github.com/user-attachments/assets/66c503b4-ae4c-455b-bf1d-0087d78c115c" />
  > Thanks for the detailed report!   This is already fixed in https://github.com/browseros-ai/BrowserOS/pull/2099 - the latest update will carry the fix for the problem
  > Duplicate of #1595  The same Windows ACP instruction-file path bug affects CLAUDE.md and AGENTS.md. #1595 contains the original path analysis; both are addressed by #2099.

- **Issue #2168** (2026-08-13): **MCP server incompatible with modern clients (protocol 2026-07-28): "Version negotiation failed" — proposes dual-era support**
  *Symptoms*: ### Issue Type  Browser Issue  ### Operating System  Linux  ### Description of the bug  BrowserOS MCP server (v0.0.127) cannot be used from MCP clients that implement the modern protocol revision 2026-07-28 (per-request _meta, server/discover method). The most common modern client today is ZCode, which reports: "Version negotiation probe failed: the server answered the probe with HTTP 500".  The same BrowserOS instance connects fine from Claude Code, which still speaks the legacy initialize handshake.  This is a protocol-version era mismatch, not a config or header problem. Per the MCP spec (https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions): modern clients (2026-07-28+) are stateless and probe the server with server/discover, while legacy servers (2025-11-25 and earlier) only understand the initialize handshake. The compatibility matrix is explicit: "Modern client -> Legacy server: Fails."  Even if discovery were bypassed, BrowserOS's JSON-RPC result objects do not include the fields a modern validator requires (resultType, ttlMs, cacheScope, _meta.io.modelcontextprotocol/serverInfo), so subsequent calls like tools/list fail validation: "Invalid result for tools/list: missing required resultType".  Workaround: I wrote a small Python proxy that acts as a dual-era server in front of BrowserOS MCP. Source + install: https://github.com/111blackeagle111/zcode-browseros-mcp-proxy  ### Steps to Reprod
  **Post-Mortem & Fix Analysis**:
  > I wouldn't patch `resultType` / `ttlMs` into each handler. Negotiate the era once at the transport boundary (`server/discover` vs `initialize`), then send every result through a legacy or modern encoder. Otherwise tools, resources, and prompts will drift at different rates.  I work on BitFun; we keep MCP wire mapping isolated for the same reason. The proxy already gives you a nice two-column conformance suite: legacy handshake, modern discovery, then the same list/call cases through both.
  > Thanks, this is a really useful report. We'll fix the error handling so the MCP endpoint returns a proper JSON-RPC / HTTP error for modern probes instead of a 500.  Full stateless 2026-07-28 support is a larger migration to the new MCP SDK line; it's on our radar now that the spec and SDK are stable!
  > The fix is merged to main & the version negotiation should pass once we release the new update!

- **Issue #2080** (2026-08-04): **<short description of the bug>**
  *Symptoms*: ### Issue Type  Both / Not sure  ### Operating System  Windows  ### Description of the bug  <html> <body> <!--StartFragment--><html><head></head><body><h1>Bug Report: BrowserClaw Fails to Launch After Auto-Update — <code inline="">chrome_elf.dll</code> Blocked by Smart App Control</h1><p><strong>Title:</strong> After auto-update, BrowserClaw fails to launch: <code inline="">chrome_elf.dll</code> blocked by Smart App Control / Code Integrity — error <code inline="">0xc0e90002</code></p><h2>Environment</h2> Item | Value -- | -- OS | Windows 11 Smart App Control | Enabled BrowserClaw version | 148.0.7974.97 Installation type | Per-user installation under %LOCALAPPDATA%\BrowserClaw\ Third-party antivirus | None; Microsoft Defender only  <h2>Description</h2><p>After BrowserClaw was automatically updated through winSparkle, the application could no longer start.</p><p>The following error dialog appears:</p><blockquote><p><code inline="">chrome.exe - Bad Image</code><br><code inline="">chrome_elf.dll is either not designed to run on Windows or it contains an error.</code><br><code inline="">Error status: 0xc0e90002</code></p></blockquote><h2>Steps to Reproduce</h2><ol><li><p>Enable Smart App Control on Windows 11.</p></li><li><p>Install an earlier BrowserClaw version.</p></li><li><p>Allow winSparkle to update BrowserClaw to version <code inline="">148.0.7974.97</code>.</p></li><li><p>Launch:</p></li></ol><pre><code class="language-text">%LOCALAPPDATA%\BrowserClaw\Application\chrome.

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

### Incident Patch 1: `1fb93551` (2026-09-30)
**Commit Message**: fix(mcp): run-SDK reliability for backgrounded tabs, waits, and dialogs (#2782)

* fix(mcp): keep agent tabs responsive with focus emulation

Agent tabs open in the background, where Chromium throttles layout,
hit-testing and the compositor, so click and fill wait seconds for a
CDP ack while press stays fast. Enable focus emulation when a tab the
agent opened attaches, so it renders at full speed. Scoped to
agent-created tabs so an adopted user tab keeps its real focus state.

Fixes #2778

* fix(mcp): raise the wait default and document the matched contract

A no-timeout wait for a selector or text gave up after 2s and returned
{ matched: false } rather than throwing, so a script that awaited it
without checking matched silently ran on against an unready page. Raise
the poll default to 10s (still capped at 30s, still overridable per
call) and document, in both the wait tool and the run SDK, that these
waits return { matched } and do not throw on timeout.

Fixes #2779

* fix(mcp): stop a blocking page dialog from hanging the run

A confirm/prompt/beforeunload freezes the renderer main thread, so the
click that opened it never gets its CDP ack and the run stalled to its
30s cap with 

**File**: `packages/browseros-agent/apps/server/tests/tools/browser/register.test.ts` (modified, +2/-2)
```diff
@@ -517,7 +517,7 @@ describe('registerBrowserTools', () => {
       expect(result?.content).toEqual([
         expect.objectContaining({
           type: 'text',
-          text: 'timed out after 2000ms waiting for text',
+          text: 'timed out after 10000ms waiting for text',
         }),
       ])
     } finally {
@@ -527,7 +527,7 @@ describe('registerBrowserTools', () => {
     const inputSchema = fake.configs.get('wait')?.inputSchema as
       | { shape?: { timeout?: { description?: string } } }
       | undefined
-    expect(inputSchema?.shape?.timeout?.description).toContain('default 2000')
+    expect(inputSchema?.shape?.timeout?.description).toContain('default 10000')
   })
 
   it('runs server-runtime JavaScript against the browser session', async () => {
```

**File**: `packages/browseros-agent/crates/browseros-core/src/pages.rs` (modified, +113/-17)
```diff
@@ -6,7 +6,10 @@ use crate::{
 use browseros_cdp::{browser, target};
 use futures_util::future::BoxFuture;
 use serde_json::{Value, json};
-use std::{collections::HashMap, sync::Arc};
+use std::{
+    collections::{HashMap, HashSet},
+    sync::Arc,
+};
 use tokio::{sync::Mutex, time::sleep};
 use tracing::warn;
 
@@ -51,6 +54,10 @@ pub struct PageSession {
 struct PageState {
     pages: HashMap<PageId, PageInfo>,
     sessions: HashMap<TargetId, SessionId>,
+    // Pages the agent opened (via new_page), as opposed to tabs it adopted from a
+    // list. Only these get focus emulation on attach, so an adopted user tab keeps
+    // its real focus state (#2778).
+    agent_created: HashSet<PageId>,
     connection_epoch: u64,
     next_page_id: u32,
 }
@@ -127,6 +134,7 @@ impl PageManager {
                 let info = state.pages.remove(&page_id);
                 if let Some(info) = info {
                     state.sessions.remove(&info.target_id);
+                    state.agent_created.remove(&page_id);
                     detached.push(page_id);
                 }
             }
@@ -348,6 +356,7 @@ impl PageManager {
             page_id.clone(),
             page_info_from_tab(page_id.clone(), tab, None),
         );
+        state.agent_created.insert(page_id.clone());
         Ok(page_id)
     }
 
@@ -367,6 +376,7 @@ impl PageManager {
         let mut state = self.state.lock().await;
         state.pages.remove(&page_id);
         state.sessions.remove(&info.target_id);
+        state.agent_created.remove(&page_id);
         drop(state);
         if let Some(callback) = &self.hooks.on_page_detached {
             callback(page_id);
@@ -431,6 +441,22 @@ impl PageManager {
         let _ = session
             .send::<_, Value>("Runtime.runIfWaitingForDebugger", json!({}))
             .await;
+        // Agent tabs open in the background, where Chromium throttles layout,
+        // hit-testing and the compositor, so click/fill wait seconds for a CDP
+        // ack. Emulating focus keeps a tab the agent opened rendering at full
+        // speed. Scoped to agent-created tabs so an adopted user tab keeps its
+        // real focus state; best-effort, so it never fails attach (#2778).
+        let is_agent_created = self.state.lock().await.agent_created.contains(&page_id);
+        if is_agent_created
+            && let Err(err) = session
+                .send::<_, Value>(
+                    "Emulation.setFocusEmulationEnabled",
+                    json!({ "enabled": true }),
+                )
+                .await
+        {
+            warn!("failed to enable focus emulation for agent page {page_id:?}: {err}");
+        }
         self.state
             .lock()
             .await
@@ -551,29 +577,42 @@ fn find_by_tab(pages: &HashMap<PageId, PageInfo>, tab_id: TabId) -> Option<PageI
 
 #[cfg(test)]
 mod tests {
-    use super::{PageManager, PageManagerHooks};
+    use super::{NewPageOptions, PageManager, PageManagerHooks};
     use crate::test_support::TestConnection;
-    use serde_json::json;
+    use serde_json::{Value, json};
     use std::error::Error;
 
+    fn tab_json(tab_id: u64, target_id: &str) -> Value {
+        json!({
+            "tabId": tab_id,
+            "targetId": target_id,
+            "url": "https://example.com",
+            "title": "Example",
+            "isActive": true,
+            "isLoading": false,
+            "loadProgress": 1.0,
+            "isPinned": false,
+            "isHidden": false,
+            "windowId": 3
+        })
+    }
+
+    fn attach_responses() -> Vec<(&'static str, Value)> {
+        vec![
+            ("Target.attachToTarget", json!({ "sessionId": "session-7" })),
+            ("Page.enable", json!({})),
+            ("DOM.enable", json!({})),
+            ("Runtime.enable", json!({})),
+            ("Accessibility.enable", json!({})),
+            ("Runtime.runIfWaitingForDebugger", json!({})),
+        ]
+    }
+
     #[tokio::test]
     async
```

**File**: `packages/browseros-agent/crates/browseros-mcp/src/tools/act.rs` (modified, +35/-3)
```diff
@@ -11,6 +11,7 @@ use futures_util::future::BoxFuture;
 use schemars::JsonSchema;
 use serde::Deserialize;
 use serde_json::{Value, json};
+use std::time::Duration;
 
 const DESCRIPTION: &str = "\
 Act on the page using refs from the last snapshot. \
@@ -193,11 +194,42 @@ fn handler<'a>(
         }
         let console_start = ctx.session.page_signals.console_mark(&page_id);
         let input = ctx.session.input(page_id.clone()).await;
-        if let Some(err) = run_kind(&args, &input).await? {
-            return Ok(Some(err));
-        }
         if args.kind.is_dialog() {
+            if let Some(err) = run_kind(&args, &input).await? {
+                return Ok(Some(err));
+            }
             ctx.session.page_signals.clear_dialog(&page_id);
+        } else {
+            // A confirm/prompt/beforeunload opened by this action freezes the
+            // renderer, so the action's CDP ack never returns; race it against the
+            // page's dialog signal and hand control back with the pending dialog so
+            // the caller can accept or dismiss it, instead of hanging to the run cap
+            // (#2780).
+            let signals = ctx.session.page_signals.clone();
+            let watched = page_id.clone();
+            let dialog = async move {
+                while signals.pending_dialog(&watched).is_none() {
+                    tokio::time::sleep(Duration::from_millis(25)).await;
+                }
+            };
+            tokio::select! {
+                biased;
+                result = run_kind(&args, &input) => {
+                    if let Some(err) = result? {
+                        return Ok(Some(err));
+                    }
+                }
+                () = dialog => {
+                    return Ok(Some(pending_dialog_result(ctx, page_id.clone()).unwrap_or_else(
+                        || {
+                            text_result(
+                                "a JavaScript dialog is open on this page; use act kind=\"dialog_accept\" or \"dialog_dismiss\" before other actions".to_string(),
+                                None,
+                            )
+                        },
+                    )));
+                }
+            }
         }
         response.data(json!({ "kind": args.kind.as_str() }));
         if let Some(detail) = resolve_diff_detail(args.diff) {
```

**File**: `packages/browseros-agent/crates/browseros-mcp/src/tools/run.rs` (modified, +202/-33)
```diff
@@ -22,7 +22,7 @@ use std::{
     sync::{Arc, Mutex},
     time::Duration,
 };
-use tokio::time::{Instant, sleep_until};
+use tokio::time::{Instant, sleep, sleep_until};
 
 const DEFAULT_TIMEOUT_MS: f64 = 30_000.0;
 const MAX_TIMEOUT_MS: u64 = 30_000;
@@ -59,8 +59,8 @@ Page handle (refs eN come from a snapshot's text/refs):
   page.check(ref) / uncheck(ref) / focus(ref) / drag(fromRef,toRef)
   page.type(text) / press(key) / insertText(text)   - these act on whatever has focus, so they take no ref
   page.scroll(dir,amount,ref?) / clickAt(x,y) / typeAt(x,y,text) / hoverAt(x,y) / dragAt(x1,y1,x2,y2)
-  page.dialogAccept() / dialogDismiss()
-  page.waitForSelector(sel) / waitForText(text) / waitForTime(ms) - resolve when ready. For content that loads in, wait on the thing itself with waitForSelector (or waitForText); it resolves the moment it appears. Use waitForTime only for a plain fixed pause; `await sleep(ms)` also works. Never poll in a loop (re-checking a count with a fixed wait between tries) - wait on the selector once instead.
+  page.dialogAccept() / dialogDismiss() - accept or dismiss an open JavaScript dialog (confirm/prompt/beforeunload). An action that opens one gets back { dialogOpen: true, kind, message } instead of its usual result, and the page stays blocked until you accept or dismiss, so do that before anything else on the page.
+  page.waitForSelector(sel) / waitForText(text) / waitForTime(ms) - resolve when ready. For content that loads in, wait on the thing itself with waitForSelector (or waitForText); it resolves the moment it appears, polling up to 10s by default (pass { timeout } to change it, max 30s) and returning { matched }. On timeout matched is false and it does NOT throw, so check matched instead of assuming the wait succeeded. Use waitForTime only for a plain fixed pause; `await sleep(ms)` also works. Never poll in a loop (re-checking a count with a fixed wait between tries) - wait on the selector once instead.
   page.evaluate(fn, arg?)            - runs INSIDE the page. Pass a real function; a second argument is JSON-serialized and handed to it, e.g. page.evaluate((sel) => document.querySelectorAll(sel).length, '.row'). It does not close over script variables. A code string with a `return` also works: page.evaluate("return document.title").
   page.screenshot(opts?) / pdf(opts?)
   page.download(ref) / upload(ref, files)
@@ -836,6 +836,46 @@ impl BrowserBridge {
         outcome
     }
 
+    /// Runs a page input action but stops waiting if a blocking JavaScript dialog
+    /// opens on that page (or is already open). A confirm/prompt/beforeunload freezes
+    /// the renderer main thread, so the action's CDP ack never returns and the run
+    /// would otherwise hang to its 30s cap (#2780). The dialog listener records it
+    /// concurrently, so polling pending_dialog lets us hand control back; the pending
+    /// dialog is left set for page.dialogAccept()/dialogDismiss() to resolve. Returns
+    /// Ok(None) when a dialog interrupted the action, so callers surface the dialog
+    /// rather than reporting the action as done.
+    async fn race_input<F, T>(&self, page_id: &PageId, future: F) -> Result<Option<T>, String>
+    where
+        F: Future<Output = Result<T, browseros_core::CoreError>>,
+    {
+        let signals = self.ctx.session.page_signals.clone();
+        let page = page_id.clone();
+        let dialog = async move {
+            while signals.pending_dialog(&page).is_none() {
+                sleep(Duration::from_millis(25)).await;
+            }
+        };
+        tokio::select! {
+            biased;
+            result = self.control.race(future) => result.map(Some),
+            () = dialog => Ok(None),
+        }
+    }
+
+    /// The value an input action returns when a blocking dialog interrupted it: a
+    /// marker plus the dialog's kind and message, so the script can see that the
+    /// action did not complete and must accept or dismiss the dialog next (#2
```

**File**: `packages/browseros-agent/crates/browseros-mcp/src/tools/wait.rs` (modified, +7/-5)
```diff
@@ -10,7 +10,7 @@ use serde_json::{Value, json};
 use std::time::{Duration, Instant};
 
 pub const DEFAULT_PAUSE_MS: u64 = 2_000;
-const DEFAULT_WAIT_TIMEOUT_MS: u64 = 2_000;
+const DEFAULT_WAIT_TIMEOUT_MS: u64 = 10_000;
 const MAX_WAIT_TIMEOUT_MS: u64 = 30_000;
 // A for="time" pause does no page work (it is an abortable sleep), so it is not
 // bound by the 30s page-work polling cap that text/selector waits use. An explicit
@@ -21,9 +21,11 @@ const MAX_WAIT_TIMEOUT_MS: u64 = 30_000;
 const MAX_TIME_WAIT_MS: u64 = 90_000;
 const DESCRIPTION: &str = "\
 Wait on a signal: for=\"text\" (substring appears) or for=\"selector\" (CSS selector matches) \
-beat a blind pause. for=\"time\" (default) pauses value ms (default 2000, honored up to 90000; \
-an explicit timeout caps it lower, and a larger value is rejected, not silently shortened) - last resort. \
-Best of all: act and read the diff instead of waiting.";
+beat a blind pause. They poll until the page matches or the timeout elapses (default 10000, \
+capped at 30000), then return { matched: true } or, on timeout, { matched: false } - they do NOT \
+throw, so check matched before trusting the page is ready. for=\"time\" (default) pauses value ms \
+(default 2000, honored up to 90000; an explicit timeout caps it lower, and a larger value is \
+rejected, not silently shortened) - last resort. Best of all: act and read the diff instead of waiting.";
 
 #[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
 #[serde(rename_all = "lowercase")]
@@ -51,7 +53,7 @@ struct WaitArgs {
     wait_for: WaitFor,
     /// Optional. For for="time", ms to pause (default 2000, honored up to 90000). For "text"/"selector", the substring or CSS selector to wait for.
     value: Option<WaitValue>,
-    /// Max wait in ms. For "text"/"selector" it caps polling before giving up (default 2000, capped at 30000). For "time" it optionally caps the pause from above (default: pause for value).
+    /// Max wait in ms. For "text"/"selector" it caps polling before giving up (default 10000, capped at 30000). For "time" it optionally caps the pause from above (default: pause for value).
     timeout: Option<f64>,
 }
 
```

---

### Incident Patch 2: `af2052db` (2026-09-29)
**Commit Message**: fix(server): validate scheduled-job cadence fields on the API boundary (#2781)

* fix(server): validate scheduled-job cadence fields on the API boundary

The scheduled-job PUT route accepted loose cadence fields (scheduleTime as any
string, scheduleInterval as any number), even though the extension alarm builder
assumes valid data: daily splits scheduleTime on ":" into hours/minutes, and
hourly/minutes hand scheduleInterval straight to chrome.alarms. UI-created jobs
are guarded by the create-task form, but imports and direct/programmatic writes
could persist a schedule that later fails to produce a usable alarm.

Mirror the form's rules on the server: daily requires an HH:MM (24-hour) time,
and hourly/minutes require an integer interval between 1 and 60.

* fix(server): only gate scheduled-job cadence when it is set or changed

Validate cadence in the handler against the stored job instead of unconditionally
in the schema, so a maintenance write that keeps an existing cadence (recording
lastRunAt after a run, or toggling enabled) still succeeds. A job stored before
this validation with an invalid cadence would otherwise fail those write-backs,
breaking run reporting and missed-run 

**File**: `packages/browseros-agent/apps/server/src/api/routes/scheduled-jobs.ts` (modified, +63/-4)
```diff
@@ -15,6 +15,10 @@ import type { Env } from '../types'
 
 const IdParamSchema = z.object({ jobId: z.string().min(1) })
 
+const HH_MM_24H = /^([01]\d|2[0-3]):[0-5]\d$/
+const MIN_INTERVAL = 1
+const MAX_INTERVAL = 60
+
 /**
  * Timestamps arrive as epoch numbers. The extension holds ISO strings today,
  * so the conversion belongs on its side of this boundary, keeping the database
@@ -32,6 +36,57 @@ const UpsertJobSchema = z.object({
   createdAt: z.number().optional(),
 })
 
+type UpsertJob = z.infer<typeof UpsertJobSchema>
+
+type Cadence = Pick<
+  UpsertJob,
+  'scheduleType' | 'scheduleTime' | 'scheduleInterval'
+>
+
+/**
+ * The cadence the extension alarm builder can actually use
+ * (apps/app/lib/schedules/createAlarmFromJob.ts): daily splits scheduleTime on
+ * ":" into hours/minutes so it needs an HH:MM (24-hour) time, and hourly/minutes
+ * hand scheduleInterval straight to chrome.alarms so it needs a whole-number
+ * interval in [1, 60]. Returns an error message when the cadence is unusable, or
+ * null when it is fine. Mirrors the create-task form so imports and direct or
+ * programmatic writes cannot persist a schedule that never produces an alarm.
+ */
+function cadenceProblem(job: Cadence): string | null {
+  if (job.scheduleType === 'daily') {
+    if (!job.scheduleTime || !HH_MM_24H.test(job.scheduleTime)) {
+      return 'daily jobs require scheduleTime as HH:MM (24-hour)'
+    }
+    return null
+  }
+
+  const interval = job.scheduleInterval
+  if (
+    interval == null ||
+    !Number.isInteger(interval) ||
+    interval < MIN_INTERVAL ||
+    interval > MAX_INTERVAL
+  ) {
+    return `${job.scheduleType} jobs require an integer scheduleInterval between ${MIN_INTERVAL} and ${MAX_INTERVAL}`
+  }
+  return null
+}
+
+/**
+ * True when the write introduces or changes the cadence. Maintenance writes that
+ * keep an existing cadence, recording lastRunAt or toggling enabled, leave it
+ * unchanged, so they are not re-gated and a job stored before this validation
+ * never becomes unwritable because of an older invalid cadence.
+ */
+function cadenceChanged(existing: Cadence | null, next: Cadence): boolean {
+  if (!existing) return true
+  return (
+    existing.scheduleType !== next.scheduleType ||
+    (existing.scheduleTime ?? null) !== (next.scheduleTime ?? null) ||
+    (existing.scheduleInterval ?? null) !== (next.scheduleInterval ?? null)
+  )
+}
+
 export function createScheduledJobRoutes(
   options: { store?: ScheduledJobStore } = {},
 ) {
@@ -49,10 +104,14 @@ export function createScheduledJobRoutes(
       zValidator('param', IdParamSchema),
       zValidator('json', UpsertJobSchema),
       async (c) => {
-        const job = await store.upsert({
-          ...c.req.valid('json'),
-          id: c.req.valid('param').jobId,
-        })
+        const jobId = c.req.valid('param').jobId
+        const input = c.req.valid('json')
+        const existing = await store.get(jobId)
+        if (cadenceChanged(existing, input)) {
+          const problem = cadenceProblem(input)
+          if (problem) return c.json({ error: problem }, 400)
+        }
+        const job = await store.upsert({ ...input, id: jobId })
         return c.json({ job })
       },
     )
```

**File**: `packages/browseros-agent/apps/server/tests/api/routes/scheduled-jobs.test.ts` (modified, +109/-0)
```diff
@@ -125,6 +125,115 @@ describe('scheduled job routes', () => {
     expect(response.status).toBe(400)
   })
 
+  it('rejects a daily job with no time', async () => {
+    const routes = createScheduledJobRoutes(memoryStore())
+    const response = await put(routes, {
+      ...body,
+      scheduleType: 'daily',
+      scheduleTime: null,
+    })
+    expect(response.status).toBe(400)
+  })
+
+  it('rejects a daily job with a malformed time', async () => {
+    const routes = createScheduledJobRoutes(memoryStore())
+    for (const scheduleTime of ['9am', '24:00', '09:60', '9:5', '']) {
+      const response = await put(routes, { ...body, scheduleTime })
+      expect(response.status).toBe(400)
+    }
+  })
+
+  it('accepts daily edge times', async () => {
+    for (const scheduleTime of ['00:00', '23:59']) {
+      const response = await put(createScheduledJobRoutes(memoryStore()), {
+        ...body,
+        scheduleTime,
+      })
+      expect(response.status).toBe(200)
+    }
+  })
+
+  it('rejects an interval job with no interval', async () => {
+    const routes = createScheduledJobRoutes(memoryStore())
+    for (const scheduleType of ['hourly', 'minutes'] as const) {
+      const response = await put(routes, {
+        ...body,
+        scheduleType,
+        scheduleTime: null,
+        scheduleInterval: null,
+      })
+      expect(response.status).toBe(400)
+    }
+  })
+
+  it('rejects an out-of-range or non-integer interval', async () => {
+    const routes = createScheduledJobRoutes(memoryStore())
+    for (const scheduleInterval of [0, -1, 61, 1.5]) {
+      const response = await put(routes, {
+        ...body,
+        scheduleType: 'minutes',
+        scheduleTime: null,
+        scheduleInterval,
+      })
+      expect(response.status).toBe(400)
+    }
+  })
+
+  it('accepts a valid interval job and persists the interval', async () => {
+    for (const [scheduleType, scheduleInterval] of [
+      ['hourly', 6],
+      ['minutes', 30],
+    ] as const) {
+      const { store, rows } = memoryStore()
+      const response = await put(createScheduledJobRoutes({ store }), {
+        ...body,
+        scheduleType,
+        scheduleTime: null,
+        scheduleInterval,
+      })
+      expect(response.status).toBe(200)
+      expect(rows.get(JOB_ID)?.scheduleInterval).toBe(scheduleInterval)
+    }
+  })
+
+  it('allows maintenance writes on a job with a legacy-invalid cadence', async () => {
+    // A job stored before this validation can have a missing time. Recording
+    // lastRunAt after a run, or toggling enabled, keeps the same (invalid)
+    // cadence, so those writes must still succeed, otherwise run reporting and
+    // missed-run processing break and the job cannot be toggled to fix it.
+    const { store, rows } = memoryStore([
+      row({ scheduleType: 'daily', scheduleTime: null }),
+    ])
+    const routes = createScheduledJobRoutes({ store })
+
+    const runWriteBack = await put(routes, {
+      ...body,
+      scheduleType: 'daily',
+      scheduleTime: null,
+      lastRunAt: 1234,
+    })
+    expect(runWriteBack.status).toBe(200)
+    expect(rows.get(JOB_ID)?.lastRunAt).toBe(1234)
+
+    const toggle = await put(routes, {
+      ...body,
+      scheduleType: 'daily',
+      scheduleTime: null,
+      enabled: false,
+    })
+    expect(toggle.status).toBe(200)
+  })
+
+  it('rejects changing an existing job to an invalid cadence', async () => {
+    const { store } = memoryStore([row()]) // stored as a valid daily 09:00 job
+    const response = await put(createScheduledJobRoutes({ store }), {
+      ...body,
+      scheduleType: 'daily',
+      scheduleTime: null,
+    })
+    expect(response.status).toBe(400)
+  })
+
   it('deletes a job', async () => {
     const { store, rows } = memoryStore([row()])
     const routes = createScheduledJobRoutes({ store })
```

---

### Incident Patch 3: `7a5ae536` (2026-09-28)
**Commit Message**: fix(claw-server): keep the feedback invite until it is dismissed (#2767)

* fix(claw-server): keep the feedback invite until it is dismissed

The card appeared once per installation and never again. Recording the
impression spent the invitation, so the offer was consumed by the first paint of
a new tab whether or not anyone read it, and most of a new tab's openings are
incidental. Almost nobody ever saw it, and opening the booking page ended it
too, which is not the same as having booked.

Eligibility now ends only when the reader dismisses it. Dismissal gets its own
column rather than being read off the outcome, because the two answer different
questions: the outcome is the funnel's strongest claim about what the reader did,
where a click outranks a later dismissal, while this is an instruction to stop
showing the card that nothing outranks. A click arriving after a dismissal still
raises the outcome and still leaves the card hidden.

The migration carries existing dismissals into the new column, so anyone who
already said no is not asked again.

The impression event is now counted once per browser profile. The cockpit is the
new tab page, so tracking every appearance would report

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/FeedbackInviteCard.test.tsx` (modified, +189/-5)
```diff
@@ -5,33 +5,51 @@ import type { Root } from 'react-dom/client'
 
 interface HookState {
   invitation: { eligible: boolean; bookUrl?: string }
+  invitationUpdatedAt: number
   recorded: string[]
+  recordSucceeds: boolean
   cached: unknown[]
   tracked: string[]
+  errors: string[]
   opened: string[]
+  capturing: boolean
 }
 
 const state: HookState = {
   invitation: { eligible: false },
+  invitationUpdatedAt: 1_000,
   recorded: [],
+  recordSucceeds: true,
   cached: [],
   tracked: [],
+  errors: [],
   opened: [],
+  capturing: true,
 }
 
 const invitationKey = ['api', 'feedback', 'invitation']
 
 mock.module('@/modules/api/feedback.hooks', () => ({
-  useFeedbackInvitation: Object.assign(() => ({ data: state.invitation }), {
-    getKey: () => invitationKey,
-  }),
+  useFeedbackInvitation: Object.assign(
+    () => ({
+      data: state.invitation,
+      dataUpdatedAt: state.invitationUpdatedAt,
+    }),
+    {
+      getKey: () => invitationKey,
+    },
+  ),
   useRecordFeedbackInvite: () => ({
     mutate: (
       { outcome }: { outcome: string },
-      options?: { onSuccess?: (settled: unknown) => void },
+      options?: {
+        onSuccess?: (settled: unknown) => void
+        onError?: (error: Error) => void
+      },
     ) => {
       state.recorded.push(outcome)
-      options?.onSuccess?.({ eligible: false })
+      if (state.recordSucceeds) options?.onSuccess?.({ eligible: false })
+      else options?.onError?.(new Error('sidecar unavailable'))
     },
   }),
 }))
@@ -44,6 +62,16 @@ mock.module('@tanstack/react-query', () => ({
   }),
 }))
 
+const captureStateListeners = new Set<() => void>()
+
+mock.module('@/modules/analytics/posthog', () => ({
+  isCapturing: () => state.capturing,
+  subscribeToCaptureState: (listener: () => void) => {
+    captureStateListeners.add(listener)
+    return () => captureStateListeners.delete(listener)
+  },
+}))
+
 mock.module('@/modules/analytics/events', () => ({
   AnalyticsEvent: {
     FeedbackInviteShown: 'feedback_invite_shown',
@@ -55,6 +83,26 @@ mock.module('@/modules/analytics/events', () => ({
   },
 }))
 
+mock.module('sonner', () => ({
+  toast: {
+    error: (message: string) => state.errors.push(message),
+  },
+}))
+
+const storage: Record<string, string> = {}
+Object.defineProperty(globalThis, 'localStorage', {
+  configurable: true,
+  value: {
+    getItem: (key: string) => storage[key] ?? null,
+    setItem: (key: string, value: string) => {
+      storage[key] = value
+    },
+    removeItem: (key: string) => {
+      delete storage[key]
+    },
+  },
+})
+
 const globalDescriptors = new Map(
   ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event'].map(
     (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)],
@@ -68,10 +116,15 @@ let container: HTMLElement
 
 beforeEach(async () => {
   state.invitation = { eligible: false }
+  state.invitationUpdatedAt = 1_000
   state.recorded = []
+  state.recordSucceeds = true
   state.cached = []
   state.tracked = []
+  state.errors = []
+  for (const key of Object.keys(storage)) delete storage[key]
   state.opened = []
+  state.capturing = true
 
   const dom = parseHTML(
     '<!doctype html><html><body><div id="root"></div></body></html>',
@@ -148,6 +201,25 @@ async function click(element: HTMLElement) {
   })
 }
 
+async function setCapturing(capturing: boolean) {
+  await act(async () => {
+    state.capturing = capturing
+    for (const listener of captureStateListeners) listener()
+  })
+}
+
+async function publishDismissal(dismissedAt: number) {
+  storage['feedbackInviteDismissedAt:v1'] = String(dismissedAt)
+  await act(async () => {
+    const event = new window.Event('storage')
+    Object.defineProperty(event, 'key', {
+      configurable: true,
+      value: 'feedbackInviteDismissedAt:v1',
+    })
+    window.dispatchEvent(event)
+  })
+}
+
 const eligible = { eligible: true, bookUrl: 'https://cal.test/book' }
 
 describe('FeedbackInviteCard', () => {
@@ -219
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/FeedbackInviteCard.tsx` (modified, +115/-14)
```diff
@@ -4,25 +4,85 @@
  * SPDX-License-Identifier: AGPL-3.0-or-later
  *
  * Invites the most active installations to a feedback call. The server decides
- * who is eligible and enforces that this is offered once ever; the card asks,
- * shows, and reports back what happened.
+ * who is eligible and keeps the invitation open until dismissal; the card
+ * asks, shows, and reports back what happened.
  */
 
 import { useQueryClient } from '@tanstack/react-query'
 import { CalendarCheck, X } from 'lucide-react'
-import { useEffect, useRef, useState } from 'react'
+import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
+import { toast } from 'sonner'
 import { Button } from '@/components/ui/button'
 import { AnalyticsEvent, track } from '@/modules/analytics/events'
+import {
+  isCapturing,
+  subscribeToCaptureState,
+} from '@/modules/analytics/posthog'
 import {
   useFeedbackInvitation,
   useRecordFeedbackInvite,
 } from '@/modules/api/feedback.hooks'
 
 /**
- * What this page load has decided to show. Recording the impression is exactly
- * what makes the server answer 'not eligible', so the card cannot follow the
- * query: it would erase itself the moment it appeared. The invitation is
- * copied here once and the card lives on that until the reader answers.
+ * Remembers that the impression has already been counted for this browser
+ * profile. Only the analytics event is deduplicated here; whether the card
+ * appears at all stays the server's answer, so losing this key costs at most a
+ * repeated impression and never a missed invitation.
+ */
+const SHOWN_TRACKED_KEY = 'feedbackInviteShownTracked'
+
+/**
+ * Fences stale eligible query results after a server-confirmed dismissal. The
+ * timestamp is compared with React Query's dataUpdatedAt, so a newer server
+ * answer always wins and browser storage never becomes an eligibility source.
+ */
+const DISMISSED_AT_KEY = 'feedbackInviteDismissedAt:v1'
+
+function readDismissedAt(): number | null {
+  try {
+    const value = Number(localStorage.getItem(DISMISSED_AT_KEY))
+    return Number.isFinite(value) && value > 0 ? value : null
+  } catch {
+    return null
+  }
+}
+
+function rememberDismissal(): void {
+  try {
+    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
+  } catch {
+    // The server still holds the durable dismissal when storage is unavailable.
+  }
+}
+
+function subscribeToDismissals(listener: () => void): () => void {
+  const onStorage = (event: StorageEvent) => {
+    if (event.key === DISMISSED_AT_KEY) listener()
+  }
+  window.addEventListener('storage', onStorage)
+  return () => window.removeEventListener('storage', onStorage)
+}
+
+function impressionAlreadyCounted(): boolean {
+  try {
+    return localStorage.getItem(SHOWN_TRACKED_KEY) === 'true'
+  } catch {
+    return false
+  }
+}
+
+function rememberImpression(): void {
+  try {
+    localStorage.setItem(SHOWN_TRACKED_KEY, 'true')
+  } catch {
+    // A new tab without storage access simply counts the impression again.
+  }
+}
+
+/**
+ * What this page load has decided to show. The card is copied here once so it
+ * cannot be pulled out from under the reader by the query answering again
+ * mid-view; it lives on that until they dismiss it.
  */
 type InviteState =
   | { phase: 'waiting' }
@@ -33,37 +93,78 @@ export function FeedbackInviteCard() {
   const queryClient = useQueryClient()
   const invitation = useFeedbackInvitation()
   const record = useRecordFeedbackInvite()
+  const dismissedAt = useSyncExternalStore(
+    subscribeToDismissals,
+    readDismissedAt,
+    () => null,
+  )
+  const capturing = useSyncExternalStore(
+    subscribeToCaptureState,
+    isCapturing,
+    () => false,
+  )
   const [state, setState] = useState<InviteState>({ phase: 'waiting' })
   const appeared = useRef(false)
   const booked = useRef(false)
 
+  const fencedByNewerDismissal =
+    dismissedAt !== null && dismissedAt >= invitation.dataUpdatedAt
   const offered =
-
```

**File**: `packages/browseros-agent/apps/claw-app/modules/analytics/posthog.ts` (modified, +16/-0)
```diff
@@ -50,6 +50,15 @@ const STRIPPED_PROPS = [
 ]
 
 let initialised = false
+const captureStateListeners = new Set<() => void>()
+let lastCaptureState = false
+
+function notifyCaptureStateListeners(): void {
+  const nextCaptureState = isCapturing()
+  if (nextCaptureState === lastCaptureState) return
+  lastCaptureState = nextCaptureState
+  for (const listener of captureStateListeners) listener()
+}
 
 export function sanitizeProperties(
   properties: Record<string, unknown>,
@@ -182,13 +191,20 @@ export function applyTelemetry(input: {
   } else {
     reconcileSessionRecording(posthog, false, initialised)
   }
+  notifyCaptureStateListeners()
 }
 
 /** Whether posthog is initialised AND currently opted in to capturing. */
 export function isCapturing(): boolean {
   return initialised && !posthog.has_opted_out_capturing()
 }
 
+/** Subscribes React consumers to changes in effective capture readiness. */
+export function subscribeToCaptureState(listener: () => void): () => void {
+  captureStateListeners.add(listener)
+  return () => captureStateListeners.delete(listener)
+}
+
 /** Fire-and-forget event. No-ops until capturing. */
 export function capture(
   event: string,
```

**File**: `packages/browseros-agent/apps/claw-app/modules/api/feedback.hooks.test.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import { describe, expect, it } from 'bun:test'
+import { useFeedbackInvitation } from './feedback.hooks'
+
+describe('feedback invitation query', () => {
+  it('always refreshes the server authority when the card remounts', () => {
+    const options = useFeedbackInvitation.getOptions()
+
+    expect(options.staleTime).toBe(30_000)
+    expect(options.refetchOnMount).toBe('always')
+  })
+})
```

**File**: `packages/browseros-agent/apps/claw-app/modules/api/feedback.hooks.ts` (modified, +6/-4)
```diff
@@ -4,10 +4,8 @@
  * SPDX-License-Identifier: AGPL-3.0-or-later
  *
  * The feedback call invitation shown to the most active installations. The
- * server decides who is eligible and enforces that an invitation is offered
- * once ever; this only asks and reports back. Recording an outcome makes the
- * query ineligible, so the mutation invalidates it at the call site via
- * `useFeedbackInvitation.getKey()`.
+ * server decides who is eligible and keeps an invitation open until dismissal;
+ * this only asks and reports back.
  */
 
 import type {
@@ -17,9 +15,13 @@ import type {
 import { createMutation, createQuery } from 'react-query-kit'
 import { apiClient } from './client'
 
+const FEEDBACK_INVITATION_STALE_TIME_MS = 30_000
+
 export const useFeedbackInvitation = createQuery<FeedbackInvitation>({
   queryKey: ['api', 'feedback', 'invitation'],
   fetcher: async () => (await apiClient()).getFeedbackInvitation(),
+  staleTime: FEEDBACK_INVITATION_STALE_TIME_MS,
+  refetchOnMount: 'always',
 })
 
 // Mutations default to no retries. A lost outcome is not free here: the
```

---

### Incident Patch 4: `11431585` (2026-09-28)
**Commit Message**: fix(server): deliver screenshot images to the model on custom providers (#2768)

* fix(server): deliver screenshot images to the model on custom providers

The AI SDK MCP client emits an image tool result as the canonical v7 `file`
content part ({ type: 'file', data: { type: 'data', data }, mediaType }), but
the tool-result media extractor only handled the deprecated image-data and
file-data shapes. For any provider that cannot carry media inside a tool result
(OpenRouter and every other custom provider), the image was stripped to
"[Tool content omitted]" and never re-attached, so the agent could not see
screenshots. Providers that keep media in tool results (Anthropic, OpenAI, and
similar) were unaffected because they skip normalization entirely.

Handle the canonical `file` part when re-attaching tool-result media as a
following user message, and in the compaction helpers that classify, render,
and budget binary content, so a screenshot reaches vision-capable models on
every provider.

Fixes #2722

* test(server): move screenshot normalization test into the CI-run tests/agent group

**File**: `packages/browseros-agent/apps/server/src/agent/compaction/content.ts` (modified, +8/-1)
```diff
@@ -38,13 +38,19 @@ function formatFilePlaceholder(mediaType?: string, filename?: string): string {
 }
 
 function isBinaryToolResultContentPart(part: ToolResultContentPart): boolean {
-  return part.type === 'image-data' || part.type === 'file-data'
+  return (
+    part.type === 'file' ||
+    part.type === 'image-data' ||
+    part.type === 'file-data'
+  )
 }
 
 function toolResultContentPartToText(part: ToolResultContentPart): string {
   switch (part.type) {
     case 'text':
       return part.text
+    case 'file':
+      return formatFilePlaceholder(part.mediaType, part.filename)
     case 'image-data':
       return '[Image]'
     case 'file-data':
@@ -105,6 +111,7 @@ export function estimateToolResultOutput(output: ToolResultOutput): {
           case 'text':
             chars += part.text.length
             break
+          case 'file':
           case 'image-data':
           case 'file-data':
             images++
```

**File**: `packages/browseros-agent/apps/server/src/agent/message-normalization.ts` (modified, +23/-0)
```diff
@@ -75,6 +75,29 @@ function toolResultContentPartToUserMedia(
   part: ToolResultContentPart,
 ): UserMediaPart | null {
   switch (part.type) {
+    // The canonical AI SDK v7 file part is what the MCP client actually emits
+    // for an image tool result (image-data/file-data are its deprecated
+    // predecessors). Its data is a tagged union; only the inline `data` variant
+    // carries bytes we can re-attach. Without this case a screenshot is dropped
+    // for every provider that cannot carry media inside a tool result (#2722).
+    case 'file': {
+      if (part.data.type !== 'data') {
+        return null
+      }
+      if (part.mediaType.startsWith('image/')) {
+        return {
+          type: 'image',
+          image: part.data.data,
+          mediaType: part.mediaType,
+        }
+      }
+      return {
+        type: 'file',
+        data: part.data.data,
+        mediaType: part.mediaType,
+        filename: part.filename,
+      }
+    }
     case 'image-data':
       if (part.mediaType.startsWith('image/')) {
         return {
```

**File**: `packages/browseros-agent/apps/server/tests/agent/message-normalization.test.ts` (added, +197/-0)
```diff
@@ -0,0 +1,197 @@
+import { describe, expect, test } from 'bun:test'
+import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
+import type { ModelMessage, ToolResultPart } from 'ai'
+import {
+  getMessageNormalizationOptions,
+  normalizeMessagesForModel,
+} from '../../src/agent/message-normalization'
+import type { ResolvedAgentConfig } from '../../src/agent/types'
+
+type ToolResultContentPart = Extract<
+  ToolResultPart['output'],
+  { type: 'content' }
+>['value'][number]
+
+function cfg(
+  overrides: Partial<ResolvedAgentConfig> = {},
+): ResolvedAgentConfig {
+  return {
+    conversationId: 'c1',
+    provider: LLM_PROVIDERS.OPENROUTER,
+    model: 'deepseek/deepseek-v4.1-flash',
+    ...overrides,
+  }
+}
+
+const BASE64 = 'aW1hZ2UtYnl0ies'
+
+// A screenshot tool result as the AI SDK MCP client actually emits it: the
+// canonical v7 `file` content part with inline tagged data.
+function screenshotToolMessage(part: ToolResultContentPart): ModelMessage {
+  return {
+    role: 'tool',
+    content: [
+      {
+        type: 'tool-result',
+        toolCallId: 't1',
+        toolName: 'screenshot',
+        output: { type: 'content', value: [part] },
+      },
+    ],
+  }
+}
+
+const CUSTOM_PROVIDER_OPTS = {
+  supportsImages: true,
+  supportsMediaInToolResults: false,
+}
+
+describe('getMessageNormalizationOptions', () => {
+  test('custom providers (OpenRouter) cannot carry media inside tool results', () => {
+    expect(getMessageNormalizationOptions(cfg())).toEqual({
+      supportsImages: true,
+      supportsMediaInToolResults: false,
+    })
+  })
+
+  test('providers with native tool-result media keep it inline', () => {
+    expect(
+      getMessageNormalizationOptions(
+        cfg({ provider: LLM_PROVIDERS.ANTHROPIC }),
+      ),
+    ).toEqual({ supportsImages: true, supportsMediaInToolResults: true })
+  })
+
+  test('supportsImages only disables on an explicit false', () => {
+    expect(
+      getMessageNormalizationOptions(cfg({ supportsImages: false }))
+        .supportsImages,
+    ).toBe(false)
+    expect(
+      getMessageNormalizationOptions(cfg({ supportsImages: undefined }))
+        .supportsImages,
+    ).toBe(true)
+  })
+})
+
+describe('normalizeMessagesForModel', () => {
+  test('re-attaches a canonical `file` image (screenshot) as a user message (#2722)', () => {
+    const messages = [
+      screenshotToolMessage({
+        type: 'file',
+        data: { type: 'data', data: BASE64 },
+        mediaType: 'image/jpeg',
+      }),
+    ]
+
+    const out = normalizeMessagesForModel(messages, CUSTOM_PROVIDER_OPTS)
+
+    expect(out).toHaveLength(2)
+    // tool result keeps a text placeholder, no longer the raw image
+    const toolResult = (out[0] as { content: Array<{ output: unknown }> })
+      .content[0].output
+    expect(toolResult).toEqual({ type: 'text', value: '[Image]' })
+    // the image rides in a following user message so the model can see it
+    const userMessage = out[1] as {
+      role: string
+      content: Array<Record<string, unknown>>
+    }
+    expect(userMessage.role).toBe('user')
+    expect(userMessage.content).toContainEqual({
+      type: 'image',
+      image: BASE64,
+      mediaType: 'image/jpeg',
+    })
+  })
+
+  test('a non-image `file` part is re-attached as a file', () => {
+    const messages = [
+      screenshotToolMessage({
+        type: 'file',
+        data: { type: 'data', data: BASE64 },
+        mediaType: 'application/pdf',
+        filename: 'report.pdf',
+      }),
+    ]
+
+    const out = normalizeMessagesForModel(messages, CUSTOM_PROVIDER_OPTS)
+
+    const userMessage = out[1] as { content: Array<Record<string, unknown>> }
+    expect(userMessage.content).toContainEqual({
+      type: 'file',
+      data: BASE64,
+      mediaType: 'application/pdf',
+      filename: 'report.pdf',
+    })
+  })
+
+  test('the deprecated `image-data` shape still works', () => {
+    const messages = [
+      screenshotToolMessage({
+     
```

---

### Incident Patch 5: `68d6e9bb` (2026-09-24)
**Commit Message**: fix(mcp): let callers control the wait time cap and the act diff size (#2746)

* fix(browser-mcp): let callers control wait time cap and act diff size

wait for="time" no longer silently clamps a pure-time pause to the 30s
page-work polling cap. A time pause does no page work, so it is honored
up to the tool-call budget (120000ms) and a larger value is rejected
naming the cap instead of quietly under-waiting.

act now takes a diff param ("none" | "summary" | "full" | maxChars,
default "full") so a caller can suppress or cap the auto-included
post-action accessibility diff, which otherwise dumps the whole page on
every act. Char-based cap mirrors the evaluate maxChars control.

Fixes #2701
Fixes #2700

* fix(browser-mcp): address review on wait cap and act diff readback

wait for="time": keep an explicit timeout as an upper bound on the pause
(restores the documented bound the first pass dropped) while still lifting
the 30s page-work clamp, and hold the pure-time ceiling below the tool-call
budget so the documented maximum completes rather than racing the outer
timeout.

act diff: preserve the URL-change notice when a maxChars-capped readback is
actually the new page's snapshot afte

**File**: `packages/browseros-agent/apps/claw-server-rust/src/api/mcp/prompt.rs` (modified, +2/-1)
```diff
@@ -39,7 +39,8 @@ Core loop: snapshot -> act -> verify.
 - act drives them by ref: click, fill, type, press, hover, check, select,
   scroll, drag; fill batches a whole form via fields[].
 - act reads back a diff of what changed — trust it; don't reflexively wait
-  or re-snapshot.
+  or re-snapshot. On a large page pass diff="summary"/"none"/a char cap to
+  keep it small.
 - When an act fails, the error says why — fix the cause; don't blind-retry.
 - Refs go stale when the page changes (navigate, submit, re-render) —
   re-snapshot before reusing them.
```

**File**: `packages/browseros-agent/crates/browseros-mcp/src/format/diff.rs` (modified, +137/-1)
```diff
@@ -10,13 +10,29 @@ use serde_json::{Value, json};
 const MAX_INLINE_DIFF_TOKENS: usize = 10_000;
 const MAX_INLINE_EXCERPT_TOKENS: usize = 5_000;
 
+/// How much of a changed diff to render. `Full` is the token-bounded inline diff
+/// with spill-to-file; `Summary` returns only change counts; `MaxChars` caps the
+/// inline diff to that many characters, spilling the rest to a file (mirrors the
+/// evaluate maxChars control) (#2700).
+#[derive(Debug, Clone, Copy)]
+pub enum DiffDetail {
+    Full,
+    Summary,
+    MaxChars(usize),
+}
+
 #[derive(Debug, Clone)]
 pub struct FormattedDiff {
     pub text: String,
     pub structured: Value,
 }
 
-pub async fn format_diff_result(diff: &SnapshotDiff, origin: &str, ctx: &ToolCtx) -> FormattedDiff {
+pub async fn format_diff_result(
+    diff: &SnapshotDiff,
+    origin: &str,
+    ctx: &ToolCtx,
+    detail: DiffDetail,
+) -> FormattedDiff {
     if !diff.changed {
         return FormattedDiff {
             text: "no change since last snapshot".to_string(),
@@ -56,6 +72,23 @@ pub async fn format_diff_result(diff: &SnapshotDiff, origin: &str, ctx: &ToolCtx
         );
     }
 
+    match detail {
+        DiffDetail::Summary => return summary_result(diff, structured),
+        DiffDetail::MaxChars(max_chars) => {
+            return cap_inline_diff(
+                diff,
+                diff_text,
+                wrapped_diff,
+                origin,
+                structured,
+                max_chars,
+                ctx,
+            )
+            .await;
+        }
+        DiffDetail::Full => {}
+    }
+
     if token_estimate > MAX_INLINE_DIFF_TOKENS {
         let excerpt = slice_text_by_estimated_tokens(diff_text, MAX_INLINE_EXCERPT_TOKENS);
         let content_length = wrapped_diff.len();
@@ -146,6 +179,109 @@ pub async fn format_diff_result(diff: &SnapshotDiff, origin: &str, ctx: &ToolCtx
     }
 }
 
+fn summary_result(diff: &SnapshotDiff, structured: Value) -> FormattedDiff {
+    let counts = format!("{} added, {} removed", diff.added, diff.removed);
+    let text = if diff.url_changed {
+        format!(
+            "URL changed ({} -> {}); {counts}. Take a snapshot for the current state.",
+            diff.before_url.as_deref().unwrap_or("?"),
+            diff.after_url.as_deref().unwrap_or("?")
+        )
+    } else {
+        format!("changed: {counts}. Take a snapshot to see details.")
+    };
+    FormattedDiff { text, structured }
+}
+
+/// Caps a changed diff to a caller-supplied character budget: returns it whole when
+/// it fits, otherwise an inline excerpt plus the full diff written to a local output
+/// file. Char-based to mirror the evaluate maxChars control (#2700). When the action
+/// navigated, diff.text is the new page's snapshot, so the navigation notice is kept
+/// here just as the full and summary modes do (a truncated snapshot must not read as
+/// an ordinary in-page diff).
+async fn cap_inline_diff(
+    diff: &SnapshotDiff,
+    diff_text: &str,
+    wrapped_diff: String,
+    origin: &str,
+    mut structured: Value,
+    max_chars: usize,
+    ctx: &ToolCtx,
+) -> FormattedDiff {
+    let nav_note = if diff.url_changed {
+        format!(
+            "URL changed ({} -> {}); the content below is the new page's current snapshot, not an in-page diff.\n",
+            diff.before_url.as_deref().unwrap_or("?"),
+            diff.after_url.as_deref().unwrap_or("?")
+        )
+    } else {
+        String::new()
+    };
+    let (noun, noun_lower) = if diff.url_changed {
+        ("Snapshot", "snapshot")
+    } else {
+        ("Diff", "diff")
+    };
+
+    if diff_text.chars().count() <= max_chars {
+        return FormattedDiff {
+            text: format!("{nav_note}{wrapped_diff}"),
+            structured,
+        };
+    }
+
+    let excerpt_src: String = diff_text.chars().take(max_chars).collect();
+    let excerpt = wrap_untrusted(&excerpt_src, origin);
+    let content_length = wrapped_diff.len();
+    match write_te
```

**File**: `packages/browseros-agent/crates/browseros-mcp/src/response.rs` (modified, +19/-6)
```diff
@@ -4,7 +4,10 @@
 
 use crate::{
     constants::TOOL_POST_ACTION_CAPTURE_TIMEOUT,
-    format::{diff::format_diff_result, snapshot::format_snapshot_result},
+    format::{
+        diff::{DiffDetail, format_diff_result},
+        snapshot::format_snapshot_result,
+    },
     framework::{ToolCtx, ToolError, ToolExecResult, ToolResult, merge_structured},
 };
 use browseros_core::{ConsoleEntry, PageId, settle::SettleOutcome};
@@ -13,10 +16,18 @@ use serde_json::{Value, json};
 
 #[derive(Debug, Clone)]
 enum PostAction {
-    Snapshot { page: u32 },
-    Diff { page: u32, include_structured: bool },
+    Snapshot {
+        page: u32,
+    },
+    Diff {
+        page: u32,
+        include_structured: bool,
+        detail: DiffDetail,
+    },
     Pages,
-    Screenshot { page: u32 },
+    Screenshot {
+        page: u32,
+    },
 }
 
 #[derive(Debug, Clone)]
@@ -79,10 +90,11 @@ impl ToolResponse {
         self.post_actions.push(PostAction::Snapshot { page });
     }
 
-    pub fn include_diff(&mut self, page: u32, include_structured: bool) {
+    pub fn include_diff(&mut self, page: u32, include_structured: bool, detail: DiffDetail) {
         self.post_actions.push(PostAction::Diff {
             page,
             include_structured,
+            detail,
         });
     }
 
@@ -167,6 +179,7 @@ impl ToolResponse {
             PostAction::Diff {
                 page,
                 include_structured,
+                detail,
             } => {
                 self.throw_if_dialog_open(ctx, page)?;
                 let diff = ctx
@@ -186,7 +199,7 @@ impl ToolResponse {
                         .map(|info| info.url)
                         .unwrap_or_else(|| "unknown".to_string()),
                 };
-                let formatted = format_diff_result(&diff, &origin, ctx).await;
+                let formatted = format_diff_result(&diff, &origin, ctx, detail).await;
                 self.text(format!("[Page {page} diff]\n{}", formatted.text));
                 if include_structured {
                     let mut structured = json!({ "changed": diff.changed });
```

**File**: `packages/browseros-agent/crates/browseros-mcp/src/service.rs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ Shared environment. The user (and possibly other agents) are using this browser
 Core loop: snapshot -> act -> verify.
 - snapshot renders the page as an accessibility tree; interactive elements carry [ref=eN] handles.
 - act drives them by ref: click, fill, type, press, hover, check, select, scroll, drag; fill batches a whole form via fields[].
-- act reads back a post-settle diff (the server waits out navigation/DOM churn) - trust it; don't reflexively wait or re-diff.
+- act reads back a post-settle diff (the server waits out navigation/DOM churn) - trust it; don't reflexively wait or re-diff. On a large page pass diff="summary"/"none"/a char cap so the readback stays small.
 - A click on a covered element fails and names the blocker - deal with it; don't blind-retry.
 - Dialogs surface inline on results; act kind="dialog_accept"/"dialog_dismiss" handles them (alerts auto-accept).
 - Console errors land on the act result; read format="console" lists recent ones.
```

**File**: `packages/browseros-agent/crates/browseros-mcp/src/tests.rs` (modified, +107/-2)
```diff
@@ -1,5 +1,8 @@
 use crate::{
-    format::{diff::format_diff_result, snapshot::format_snapshot_result},
+    format::{
+        diff::{DiffDetail, format_diff_result},
+        snapshot::format_snapshot_result,
+    },
     framework::{BrowserToolDefaults, BrowserToolOptions, ToolCtx, catalog, execute_tool},
     output_file::create_browser_output_file_access,
     response::ToolResponse,
@@ -1185,6 +1188,7 @@ async fn diff_formatter_keeps_unchanged_compact() {
         },
         "https://example.com/current",
         &fake_ctx(),
+        DiffDetail::Full,
     )
     .await;
     assert_eq!(formatted.text, "no change since last snapshot");
@@ -1195,7 +1199,7 @@ async fn diff_formatter_keeps_unchanged_compact() {
 async fn diff_post_action_failure_is_visible() {
     let ctx = fake_ctx();
     let mut response = ToolResponse::new();
-    response.include_diff(7, true);
+    response.include_diff(7, true, DiffDetail::Full);
     let built = response
         .build_for_session(&ctx, None)
         .await
@@ -1230,6 +1234,107 @@ fn wait_parse_ms_matches_ts_fallback_rules() {
     assert_eq!(wait::parse_wait_ms(Some("1500.6"), 2_000), 1_501);
 }
 
+#[test]
+fn wait_time_resolution_honors_long_values_and_caps() {
+    // 75000ms (the reporter's case) is honored, not silently clamped to 30000 (#2701).
+    assert_eq!(wait::resolve_time_wait_ms(Some("75000"), None), Ok(75_000));
+    // An explicit timeout still bounds the pause from above.
+    assert_eq!(
+        wait::resolve_time_wait_ms(Some("75000"), Some(40.0)),
+        Ok(40)
+    );
+    assert_eq!(wait::resolve_time_wait_ms(Some("5"), Some(999.0)), Ok(5));
+    // A timeout above the value leaves a long-but-valid pause honored.
+    assert_eq!(
+        wait::resolve_time_wait_ms(Some("75000"), Some(500_000.0)),
+        Ok(75_000)
+    );
+    // A missing value defaults to the default pause.
+    assert_eq!(wait::resolve_time_wait_ms(None, None), Ok(2_000));
+    // A value past the cap is rejected, naming the cap.
+    let err = wait::resolve_time_wait_ms(Some("120001"), None)
+        .err()
+        .unwrap_or_else(|| panic!("expected over-cap value to be rejected"));
+    assert!(err.contains("90000"));
+    assert!(err.contains("120001"));
+}
+
+#[tokio::test]
+async fn diff_formatter_summary_returns_counts_only() {
+    let formatted = format_diff_result(
+        &SnapshotDiff {
+            changed: true,
+            text: "+ button \"Save\" [ref=e1]".to_string(),
+            added: 4,
+            removed: 1,
+            ..SnapshotDiff::default()
+        },
+        "https://example.com/current",
+        &fake_ctx(),
+        DiffDetail::Summary,
+    )
+    .await;
+    assert!(formatted.text.contains("4 added, 1 removed"));
+    assert!(!formatted.text.contains("+ button \"Save\" [ref=e1]"));
+}
+
+#[tokio::test]
+async fn diff_formatter_maxchars_keeps_nav_notice() {
+    // Fits within budget -> whole diff.
+    let fits = format_diff_result(
+        &SnapshotDiff {
+            changed: true,
+            text: "+ node \"Save\"".to_string(),
+            added: 1,
+            ..SnapshotDiff::default()
+        },
+        "https://example.com/current",
+        &fake_ctx(),
+        DiffDetail::MaxChars(10_000),
+    )
+    .await;
+    assert!(fits.text.contains("+ node \"Save\""));
+
+    // A navigation snapshot capped by maxChars must keep the URL-change notice.
+    let nav = format_diff_result(
+        &SnapshotDiff {
+            changed: true,
+            text: "new page snapshot body".to_string(),
+            url_changed: true,
+            before_url: Some("https://example.com/a".to_string()),
+            after_url: Some("https://example.com/b".to_string()),
+            ..SnapshotDiff::default()
+        },
+        "https://example.com/b",
+        &fake_ctx(),
+        DiffDetail::MaxChars(10_000),
+    )
+    .await;
+    assert!(nav.text.contains("URL changed"));
+    assert!(nav.text.contains("https://example.com/a"));
+    
```

---

### Incident Patch 6: `8d9a4082` (2026-09-24)
**Commit Message**: fix: replace and verify native fill values (TKT-996) (#2756)

Unify act and run fill replacement defaults, preserve native input events, and verify the resulting field value. Add browser contracts for rejected edits, focus, frames, and explicit append; use the supported headless CI configuration.

**File**: `.github/workflows/test.yml` (modified, +3/-1)
```diff
@@ -175,7 +175,9 @@ jobs:
         id: test
         env:
           BROWSEROS_BINARY: ${{ github.workspace }}/packages/browseros-agent/.ci/bin/browseros
-          BROWSEROS_TEST_HEADLESS: ${{ matrix.suite == 'claw-mcp' && 'false' || 'true' }}
+          # The hidden-window APIs that required X11 have been retired. Use the
+          # suite's headless default so native input does not depend on Xvfb focus.
+          BROWSEROS_TEST_HEADLESS: "true"
           BROWSEROS_TEST_EXTRA_ARGS: --no-sandbox --disable-dev-shm-usage
           BROWSEROS_JUNIT_PATH: ${{ github.workspace }}/packages/browseros-agent/${{ matrix.junit_path }}
         run: |
```

**File**: `packages/browseros-agent/contracts/claw-mcp/fixtures/pages/fill.html` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="utf-8" />
+    <title>Fill contract fixture</title>
+    <style>
+      label { display: block; margin: 8px; }
+      #covered-wrap { position: relative; width: 240px; }
+      #cover { position: absolute; inset: 0; background: white; }
+    </style>
+  </head>
+  <body>
+    <label>Text field <input id="text" value="original"></label>
+    <label>Multiline <textarea id="multiline">first
+second</textarea></label>
+    <label>Email field <input id="email" type="email" value="old@example.com"></label>
+    <label>Number field <input id="number" type="number" value="42"></label>
+    <label>Password field <input id="password" type="password" value="original"></label>
+    <div id="rich" contenteditable="true" role="textbox" aria-label="Rich editor">old <b>content</b></div>
+    <label>Read only <input id="readonly" readonly value="original"></label>
+    <fieldset disabled><label>Disabled field <input id="disabled" value="original"></label></fieldset>
+    <div id="covered-wrap">
+      <label>Covered field <input id="covered" value="original"></label>
+      <div id="cover"></div>
+    </div>
+    <label>Rejecting field <input id="reject" value="original"></label>
+    <label>Reverting field <input id="revert" value="original"></label>
+    <label>Detached field <input id="detach" value="original"></label>
+    <label>Focus redirect <input id="redirect" value="original"></label>
+    <label>Other field <input id="other" value="untouched"></label>
+    <div id="shadow-host"></div>
+    <script>
+      // Browser editing must fire trusted events, and handlers must run before
+      // the tool claims success. Microtask rollback models controlled inputs.
+      window.fillEvents = []
+      document.addEventListener('input', event => {
+        window.fillEvents.push({id: event.target.id, trusted: event.isTrusted})
+      })
+      document.getElementById('reject').addEventListener('beforeinput', event => event.preventDefault())
+      document.getElementById('revert').addEventListener('input', event => {
+        queueMicrotask(() => { event.target.value = 'original' })
+      })
+      document.getElementById('detach').addEventListener('input', event => {
+        event.target.remove()
+      })
+      document.getElementById('redirect').addEventListener('focus', () => {
+        document.getElementById('other').focus()
+      })
+      const shadow = document.getElementById('shadow-host').attachShadow({mode: 'open'})
+      shadow.innerHTML = '<label>Shadow field <input value="original"></label>'
+    </script>
+  </body>
+</html>
```

**File**: `packages/browseros-agent/contracts/claw-mcp/tests/cases-act.ts` (modified, +13/-11)
```diff
@@ -179,33 +179,38 @@ export const actCases: ContractCase[] = [
     },
   },
   {
-    name: 'act: fill sets a single field',
+    name: 'act: fill replaces a prefilled single field',
     async run(ctx) {
       const page = await ctx.openPage(ctx.fixture('/form.html'))
       const snap = await snapshot(ctx, page)
       expectOk(
         await ctx.mcp.callTool('act', {
           page,
           kind: 'fill',
-          ref: refFor(snap, '"Name '),
+          ref: refFor(snap, '"Nickname '),
           value: 'Grace Hopper',
         }),
         'act fill',
       )
       const value = await evalIn(
         ctx,
         page,
-        'return document.getElementById("name").value',
+        'return document.getElementById("nickname").value === "Grace Hopper"',
       )
-      if (!value.includes('Grace Hopper')) {
+      if (!value.includes('true')) {
         throw new Error(`fill did not set the field: ${value}`)
       }
     },
   },
   {
-    name: 'act: fill sets a whole form via fields[] in one call',
+    name: 'act: fill replaces a whole form via fields[] in one call',
     async run(ctx) {
       const page = await ctx.openPage(ctx.fixture('/form.html'))
+      await evalIn(
+        ctx,
+        page,
+        'document.getElementById("name").value="old name"; document.getElementById("bio").value="old bio"',
+      )
       const snap = await snapshot(ctx, page)
       expectOk(
         await ctx.mcp.callTool('act', {
@@ -221,17 +226,14 @@ export const actCases: ContractCase[] = [
       const name = await evalIn(
         ctx,
         page,
-        'return document.getElementById("name").value',
+        'return document.getElementById("name").value === "Katherine Johnson"',
       )
       const bio = await evalIn(
         ctx,
         page,
-        'return document.getElementById("bio").value',
+        'return document.getElementById("bio").value === "orbital mechanics"',
       )
-      if (
-        !name.includes('Katherine Johnson') ||
-        !bio.includes('orbital mechanics')
-      ) {
+      if (!name.includes('true') || !bio.includes('true')) {
         throw new Error(`batch fill missed a field: name=${name} bio=${bio}`)
       }
     },
```

**File**: `packages/browseros-agent/contracts/claw-mcp/tests/cases-claw-layer.ts` (modified, +1/-1)
```diff
@@ -378,7 +378,7 @@ export const clawLayerCases: ContractCase[] = [
       } catch (error) {
         rejection = error
       }
-      if (!String(rejection).includes('no longer live')) {
+      if (!String(rejection).includes('was stopped and will not resume')) {
         throw new Error(
           `post-cancel browser call was not rejected: ${rejection}`,
         )
```

**File**: `packages/browseros-agent/contracts/claw-mcp/tests/cases-fill.ts` (added, +277/-0)
```diff
@@ -0,0 +1,277 @@
+/** Fill is tested through both public MCP surfaces, with page-observed values
+ * and events. These contracts intentionally avoid the implementation's CDP calls.
+ */
+import type { CaseContext, ContractCase } from './cases'
+import { expectError, expectOk } from './helpers'
+
+type Surface = 'act' | 'run'
+
+async function fieldRef(
+  ctx: CaseContext,
+  page: number,
+  label: string,
+): Promise<string> {
+  const snapshot = expectOk(await ctx.mcp.callTool('snapshot', { page }))
+  const line = snapshot.split('\n').find((line) => line.includes(`"${label}`))
+  const ref = line?.match(/\[ref=(e\d+)\]/)?.[1]
+  if (!ref) throw new Error(`No ref for ${label}`)
+  return ref
+}
+
+async function fill(
+  ctx: CaseContext,
+  page: number,
+  surface: Surface,
+  ref: string,
+  value: string,
+) {
+  return surface === 'act'
+    ? ctx.mcp.callTool('act', { page, kind: 'fill', fields: [{ ref, value }] })
+    : ctx.mcp.callTool('run', {
+        code: `await browser.input(${page}).fill(${JSON.stringify(ref)}, ${JSON.stringify(value)})`,
+      })
+}
+
+async function assertPage(
+  ctx: CaseContext,
+  page: number,
+  expression: string,
+): Promise<void> {
+  // A failed assertion throws inside the page, which evaluate exposes as an MCP
+  // error. This avoids substring checks that accidentally accept appended text.
+  expectOk(
+    await ctx.mcp.callTool('evaluate', {
+      page,
+      code: `if (!(${expression})) throw new Error("Fill postcondition failed"); return true`,
+    }),
+    expression,
+  )
+}
+
+export const fillCases: ContractCase[] = [
+  ...(['act', 'run'] as const).flatMap((surface) => [
+    {
+      name: `${surface}: fill replaces text, textarea, editable and native input types`,
+      async run(ctx: CaseContext) {
+        const page = await ctx.openPage(ctx.fixture('/fill.html'))
+        for (const [label, id, value] of [
+          ['Text field', 'text', 'new text 😀'],
+          ['Multiline', 'multiline', 'line one\nline two'],
+          ['Rich editor', 'rich', 'new rich\ntext'],
+          ['Email field', 'email', 'new@example.com'],
+          ['Number field', 'number', '123'],
+          ['Password field', 'password', 'new password'],
+        ]) {
+          expectOk(
+            await fill(
+              ctx,
+              page,
+              surface,
+              await fieldRef(ctx, page, label),
+              value,
+            ),
+          )
+          await assertPage(
+            ctx,
+            page,
+            `(document.getElementById("${id}").value ?? document.getElementById("${id}").innerText) === ${JSON.stringify(value)}`,
+          )
+          await assertPage(
+            ctx,
+            page,
+            `window.fillEvents.some(e => e.id === "${id}" && e.trusted)`,
+          )
+        }
+      },
+    },
+    {
+      name: `${surface}: fill clears prefilled text and contenteditable to empty`,
+      async run(ctx: CaseContext) {
+        const page = await ctx.openPage(ctx.fixture('/fill.html'))
+        for (const [label, id] of [
+          ['Text field', 'text'],
+          ['Multiline', 'multiline'],
+          ['Rich editor', 'rich'],
+        ]) {
+          expectOk(
+            await fill(
+              ctx,
+              page,
+              surface,
+              await fieldRef(ctx, page, label),
+              '',
+            ),
+          )
+          await assertPage(
+            ctx,
+            page,
+            `(document.getElementById("${id}").value ?? document.getElementById("${id}").textContent) === ""`,
+          )
+        }
+      },
+    },
+    ...[
+      ['Read only', 'readonly'],
+      ['Disabled field', 'disabled'],
+      ['Covered field', 'covered'],
+      ['Rejecting field', 'reject'],
+      ['Reverting field', 'revert'],
+      ['Focus redirect', 'redirect'],
+    ].map(([label, id]) => ({
+      name: `${surface}: fill rejects ${label.toLowerCase()} without false success`,
+      asyn
```

---

### Incident Patch 7: `ac5e7004` (2026-09-24)
**Commit Message**: fix(claw-app): unblock diagnostics and correct analytics host fallback (#2755)

Hidden cockpit tabs kept SSE previews open until unmount, exhausting the shared HTTP/1 connection pool and causing diagnostics to time out before reaching the server. Close preview streams while hidden and reconnect from the latest server snapshot when visible.

Trim the optional PostHog host and fall back when it is empty so analytics requests use the HTTPS ingestion endpoint instead of chrome-extension URLs.

Add lifecycle and environment regression tests. Verified with the isolated browser reproduction, production build, repository checks, 2,093 passing tests, clean independent review, and passing PR CI. The six-simultaneously-visible-preview limit remains outside this fix.

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/LivePreview.test.tsx` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
+import { parseHTML } from 'linkedom'
+import { act } from 'react'
+import type { Root } from 'react-dom/client'
+import * as auditHooks from '@/modules/api/audit.hooks'
+
+mock.module('@/modules/api/audit.hooks', () => ({
+  ...auditHooks,
+  useApiBaseUrl: () => 'http://127.0.0.1:9210',
+}))
+
+/** Track the real component's connection ownership without recording any page data. */
+class PreviewSource extends EventTarget {
+  static sources: PreviewSource[] = []
+  closed = false
+  constructor(readonly url: string) {
+    super()
+    PreviewSource.sources.push(this)
+  }
+  close() {
+    this.closed = true
+  }
+}
+
+const globalNames = [
+  'window',
+  'document',
+  'navigator',
+  'HTMLElement',
+  'Node',
+  'Event',
+  'EventSource',
+  'IS_REACT_ACT_ENVIRONMENT',
+]
+const originals = new Map(
+  globalNames.map((name) => [
+    name,
+    Object.getOwnPropertyDescriptor(globalThis, name),
+  ]),
+)
+const { LivePreview } = await import('./LivePreview')
+let root: Root
+let visibility: DocumentVisibilityState
+
+beforeEach(async () => {
+  PreviewSource.sources = []
+  visibility = 'visible'
+  const dom = parseHTML(
+    '<!doctype html><html><body><div id="root"></div></body></html>',
+  )
+  const globals = {
+    window: dom.window,
+    document: dom.document,
+    navigator: dom.window.navigator,
+    HTMLElement: dom.window.HTMLElement,
+    Node: dom.window.Node,
+    Event: dom.window.Event,
+    EventSource: PreviewSource,
+    IS_REACT_ACT_ENVIRONMENT: true,
+  }
+  for (const [name, value] of Object.entries(globals)) {
+    Object.defineProperty(globalThis, name, {
+      configurable: true,
+      writable: true,
+      value,
+    })
+  }
+  Object.defineProperty(document, 'visibilityState', {
+    configurable: true,
+    get: () => visibility,
+  })
+  const { createRoot } = await import('react-dom/client')
+  const container = document.getElementById('root')
+  if (!container) throw new Error('Missing test container')
+  root = createRoot(container)
+})
+
+afterEach(async () => {
+  await act(async () => root.unmount())
+  for (const [name, descriptor] of originals) {
+    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
+    else Reflect.deleteProperty(globalThis, name)
+  }
+})
+
+async function renderPreviews() {
+  await act(async () => {
+    const sessions = Array.from({ length: 6 }, (_, i) => `session-${i}`)
+    root.render(
+      sessions.map((sessionId) => (
+        <LivePreview key={sessionId} sessionId={sessionId} site="example.com" />
+      )),
+    )
+  })
+}
+
+async function setVisibility(next: DocumentVisibilityState) {
+  await act(async () => {
+    visibility = next
+    document.dispatchEvent(new Event('visibilitychange'))
+  })
+}
+
+const openSources = () =>
+  PreviewSource.sources.filter((source) => !source.closed)
+
+describe('LivePreview connection lifecycle', () => {
+  it('releases all preview connections when hidden and reconnects when visible', async () => {
+    await renderPreviews()
+    expect(openSources()).toHaveLength(6)
+    await setVisibility('hidden')
+    expect(openSources()).toHaveLength(0)
+    await setVisibility('visible')
+    expect(openSources()).toHaveLength(6)
+    expect(PreviewSource.sources).toHaveLength(12)
+    await act(async () => root.render(null))
+    expect(openSources()).toHaveLength(0)
+    await setVisibility('hidden')
+    await setVisibility('visible')
+    expect(openSources()).toHaveLength(0)
+  })
+
+  it('does not consume connections when a cockpit mounts in a background tab', async () => {
+    visibility = 'hidden'
+    await renderPreviews()
+    expect(PreviewSource.sources).toHaveLength(0)
+    await setVisibility('visible')
+    expect(openSources()).toHaveLength(6)
+  })
+})
```

**File**: `packages/browseros-agent/apps/claw-app/components/cockpit/LivePreview.tsx` (modified, +19/-3)
```diff
@@ -1,5 +1,5 @@
 import { Globe } from 'lucide-react'
-import { useEffect, useRef, useState } from 'react'
+import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
 import { Replayer } from 'rrweb'
 import { cn } from '@/lib/utils'
 import { useApiBaseUrl } from '@/modules/api/audit.hooks'
@@ -11,6 +11,13 @@ const FULL_SNAPSHOT = 2
 const META = 4
 const DEFAULT_SIZE = { width: 1280, height: 720 }
 
+function subscribeToVisibility(onChange: () => void): () => void {
+  document.addEventListener('visibilitychange', onChange)
+  return () => document.removeEventListener('visibilitychange', onChange)
+}
+
+const isDocumentVisible = () => document.visibilityState === 'visible'
+
 interface LivePreviewProps {
   site: string
   sessionId: string
@@ -57,10 +64,19 @@ function SessionLivePreview({
   const baseUrl = useApiBaseUrl()
   const mountRef = useRef<HTMLDivElement>(null)
   const [rendering, setRendering] = useState(false)
+  // SSE shares the browser's HTTP/1 connection pool with diagnostics and other
+  // API reads. Hidden cockpits must release their streams or a few open tabs
+  // exhaust that pool. Only preview playback pauses: recording continues in the
+  // background, and reopening the stream obtains a fresh server bootstrap.
+  const visible = useSyncExternalStore(
+    subscribeToVisibility,
+    isDocumentVisible,
+    () => false,
+  )
 
   useEffect(() => {
     const mount = mountRef.current
-    if (!mount || baseUrl === null) return
+    if (!mount || baseUrl === null || !visible) return
 
     const query =
       browserTabId === undefined ? '' : `?browserTabId=${browserTabId}`
@@ -158,7 +174,7 @@ function SessionLivePreview({
       source.close()
       teardown()
     }
-  }, [baseUrl, sessionId, browserTabId])
+  }, [baseUrl, sessionId, browserTabId, visible])
 
   return (
     <div
```

**File**: `packages/browseros-agent/apps/claw-app/modules/analytics/posthog-host.test.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { describe, expect, it } from 'bun:test'
+import { tmpdir } from 'node:os'
+
+/** Exercise build-time env loading in isolation: this module reads its host at import. */
+function configuredHost(host?: string): string {
+  const env = { ...process.env }
+  delete env.VITE_CLAW_POSTHOG_HOST
+  if (host !== undefined) env.VITE_CLAW_POSTHOG_HOST = host
+  const result = Bun.spawnSync({
+    cmd: [
+      process.execPath,
+      '--eval',
+      `import { createPostHogConfig } from ${JSON.stringify(`${import.meta.dir}/posthog.ts`)};
+       console.log(JSON.stringify(createPostHogConfig('test-install').api_host));`,
+    ],
+    // Keep local env files from supplying the optional release variable.
+    cwd: tmpdir(),
+    env,
+  })
+  expect(result.exitCode).toBe(0)
+  return JSON.parse(result.stdout.toString().trim())
+}
+
+describe('PostHog release host', () => {
+  it.each([undefined, '', '   '])(
+    'sends analytics to the default ingestion host when host is %j',
+    (host) => {
+      const configured = configuredHost(host)
+      expect(configured).toBe('https://us.i.posthog.com')
+      for (const path of ['/e/', '/array/test-key/config']) {
+        expect(
+          new URL(`${configured}${path}`, 'chrome-extension://app/newtab.html')
+            .protocol,
+        ).toBe('https:')
+      }
+    },
+  )
+
+  it('preserves an explicitly configured ingestion host', () => {
+    expect(configuredHost('https://eu.i.posthog.com')).toBe(
+      'https://eu.i.posthog.com',
+    )
+  })
+})
```

**File**: `packages/browseros-agent/apps/claw-app/modules/analytics/posthog.ts` (modified, +3/-1)
```diff
@@ -29,8 +29,10 @@ import posthog, { type PostHog, type PostHogConfig } from 'posthog-js'
 import 'posthog-js/dist/posthog-recorder'
 
 const KEY = import.meta.env.VITE_CLAW_POSTHOG_KEY as string | undefined
+// Optional release secrets arrive as empty strings. Passing one to PostHog
+// overrides its default host and resolves requests against chrome-extension://.
 const HOST =
-  (import.meta.env.VITE_CLAW_POSTHOG_HOST as string | undefined) ??
+  (import.meta.env.VITE_CLAW_POSTHOG_HOST as string | undefined)?.trim() ||
   'https://us.i.posthog.com'
 const REDACTED_REPLAY_URL = 'browserclaw://redacted'
 
```

---

### Incident Patch 8: `c3b4bd88` (2026-09-23)
**Commit Message**: fix(claw-app): include installed app version in analytics (#2751)

**File**: `packages/browseros-agent/apps/claw-app/modules/analytics/posthog.test.ts` (modified, +25/-3)
```diff
@@ -1,4 +1,4 @@
-import { describe, expect, it } from 'bun:test'
+import { afterEach, describe, expect, it } from 'bun:test'
 import { PostHog } from 'posthog-js'
 import {
   createPostHogConfig,
@@ -8,8 +8,23 @@ import {
   sanitizeProperties,
 } from './posthog'
 
+const originalChrome = globalThis.chrome
+
+afterEach(() => {
+  Object.defineProperty(globalThis, 'chrome', {
+    configurable: true,
+    value: originalChrome,
+  })
+})
+
 describe('BrowserClaw PostHog privacy', () => {
-  it('switches a running anonymous SDK from installation B to canonical A', async () => {
+  it('keeps the installed app version when switching anonymous identity', async () => {
+    Object.defineProperty(globalThis, 'chrome', {
+      configurable: true,
+      value: {
+        runtime: { getManifest: () => ({ version: '0.2.25.7' }) },
+      },
+    })
     const events: Array<{
       event: string
       properties: Record<string, unknown>
@@ -24,7 +39,9 @@ describe('BrowserClaw PostHog privacy', () => {
         return null // Inspect the actual SDK payload without any network delivery.
       },
     })
-    client.capture('before-migration')
+    // A prior build's persisted properties must not override this package.
+    client.register({ app_version: '0.2.24.0' })
+    client.capture('before-migration', { app_version: 'caller-override' })
     reconcileTelemetryIdentity(client, 'analytics-A')
     client.opt_in_capturing({ captureEventName: false })
     client.capture('after-migration')
@@ -38,6 +55,10 @@ describe('BrowserClaw PostHog privacy', () => {
       'installation-B',
       'analytics-A',
     ])
+    expect(events.map(({ properties }) => properties.app_version)).toEqual([
+      '0.2.25.7',
+      '0.2.25.7',
+    ])
     expect(
       events.every(
         ({ properties }) => properties.$process_person_profile === false,
@@ -97,6 +118,7 @@ describe('BrowserClaw PostHog privacy', () => {
         $initial_pathname: '/',
         $initial_referrer: 'https://private.example',
         $initial_referring_domain: 'private.example',
+        app_version: 'stale-without-extension-runtime',
         screen: 'cockpit',
       }),
     ).toEqual({ screen: 'cockpit' })
```

**File**: `packages/browseros-agent/apps/claw-app/modules/analytics/posthog.ts` (modified, +6/-0)
```diff
@@ -54,6 +54,12 @@ export function sanitizeProperties(
 ): Record<string, unknown> {
   const cleaned = { ...properties }
   for (const key of STRIPPED_PROPS) delete cleaned[key]
+  // Read the installed package at capture time: persisted super-properties can
+  // outlive an extension update, while identity reset clears registered ones.
+  // Web development has no extension manifest, so omit its version.
+  const appVersion = globalThis.chrome?.runtime?.getManifest?.().version
+  if (appVersion) cleaned.app_version = appVersion
+  else delete cleaned.app_version
   return cleaned
 }
 
```

---

### Incident Patch 9: `483c41c4` (2026-09-23)
**Commit Message**: fix(claw-server): load server-only feedback cohort configuration (#2750)

Declare the server evaluation runtime when fetching the feedback cohort from PostHog, with an HTTP regression test. Align the stale MCP ownership contract test with the existing advisory ownership behavior.

**File**: `packages/browseros-agent/apps/claw-server-rust/src/services/feedback_cohort.rs` (modified, +53/-0)
```diff
@@ -264,6 +264,9 @@ pub async fn fetch_once(cohort: &FeedbackCohort, source: &CohortSource, now_ms:
             .json(&serde_json::json!({
                 "api_key": project_key,
                 "distinct_id": REMOTE_CONFIG_IDENTITY,
+                // PostHog omits server-only flags unless the caller declares this
+                // runtime, leaving the cohort empty and every invitation ineligible.
+                "evaluation_runtime": "server",
             })),
     };
     let response = match request.send().await {
@@ -653,6 +656,56 @@ mod tests {
         assert!(document_from_flags(b"not json").is_none());
     }
 
+    /// PostHog omits server-only remote configurations unless the caller declares its
+    /// runtime. Exercise the HTTP boundary so a successful but empty response cannot
+    /// silently leave an otherwise eligible installation without an invitation.
+    #[tokio::test]
+    async fn a_server_only_remote_configuration_allows_invitations() -> anyhow::Result<()> {
+        let now = now_ms();
+        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
+        let source = CohortSource::RemoteConfig {
+            host: format!("http://{}", listener.local_addr()?),
+            project_key: "test-project-key".to_string(),
+        };
+        let payload = serde_json::to_string(&json!({
+            "generated_at_ms": now,
+            "installs": ["install-a"],
+        }))?;
+        let app = axum::Router::new().route(
+            "/flags",
+            axum::routing::post(
+                async move |axum::Json(body): axum::Json<serde_json::Value>| {
+                    let flags = if body["evaluation_runtime"] == "server" {
+                        json!({
+                            "feedback-call-cohort": {
+                                "enabled": true,
+                                "metadata": { "payload": payload }
+                            }
+                        })
+                    } else {
+                        json!({})
+                    };
+                    axum::Json(json!({ "flags": flags, "errorsWhileComputingFlags": false }))
+                },
+            ),
+        );
+        let server = tokio::spawn(async move { axum::serve(listener, app).await });
+        let cohort = FeedbackCohort::new();
+        let adopted = fetch_once(&cohort, &source, now).await;
+        server.abort();
+
+        assert!(
+            adopted,
+            "the server-only cohort must be returned and adopted"
+        );
+        assert_eq!(
+            cohort.invitation_url("install-a", now).await.as_deref(),
+            Some(DEFAULT_BOOK_URL)
+        );
+        assert!(cohort.invitation_url("install-b", now).await.is_none());
+        Ok(())
+    }
+
     /// Serves one canned response and returns the URL to ask for it.
     async fn serve_once(response: String) -> anyhow::Result<String> {
         use tokio::io::{AsyncReadExt, AsyncWriteExt};
```

**File**: `packages/browseros-agent/contracts/claw-mcp/tests/cases-claw-layer.ts` (modified, +23/-17)
```diff
@@ -1,6 +1,6 @@
 /**
  * name_session (3) + the claw-layer cross-cutting invariants: two-session
- * ownership isolation [1], browser-down guidance [2], trust-boundary
+ * ownership labeling [1], browser-down guidance [2], trust-boundary
  * nonce fencing [3], auto-context embedding [4], REST audit tie-in [5],
  * and cancellation [6]. ([7] transport lives in cases-transport.)
  *
@@ -108,9 +108,9 @@ export const clawLayerCases: ContractCase[] = [
     },
   },
 
-  // [1] two-session ownership isolation ------------------------------------
+  // [1] two-session ownership labeling -------------------------------------
   {
-    name: 'ownership: a second session cannot act on the first session pages',
+    name: 'ownership: cross-session access preserves labels without blocking',
     smoke: true,
     async run(ctx) {
       const other = await ctx.openSession('agent-other')
@@ -134,24 +134,19 @@ export const clawLayerCases: ContractCase[] = [
           `foreign page not bucketed for the other session:\n${bucketed.slice(0, 300)}`,
         )
       }
-      // And is refused act + close, with an ownership-guard error.
+      // Ownership identifies whose work this is, rather than granting access.
+      // A foreign read must succeed, name the owner, and leave the claim intact.
       const foreignSnapshot = await other.callTool('snapshot', {
         page: ownPage,
       })
-      const foreignClose = await other.callTool('tabs', {
-        action: 'close',
-        page: ownPage,
-      })
-      for (const [operation, result] of [
-        ['snapshot', foreignSnapshot],
-        ['close', foreignClose],
-      ] as const) {
-        const text = textOf(result)
-        if (!result.isError || errorClass(text) !== 'not-owned') {
-          throw new Error(`foreign ${operation} was not refused: ${text}`)
-        }
+      expectOk(foreignSnapshot, 'foreign snapshot')
+      const notice = textOf(foreignSnapshot)
+      if (
+        !notice.includes(`page ${ownPage} belongs to another agent`) ||
+        !notice.includes('You are allowed to use it')
+      ) {
+        throw new Error(`foreign snapshot lost its ownership notice: ${notice}`)
       }
-      // The owner is unaffected: the page still lists and snapshots.
       const stillOwned = textOf(
         await ctx.mcp.callTool('tabs', { action: 'list' }),
       )
@@ -162,6 +157,17 @@ export const clawLayerCases: ContractCase[] = [
         await ctx.mcp.callTool('snapshot', { page: ownPage }),
         'owner snapshot after foreign attempt',
       )
+
+      // Explicit cross-session mutations are allowed too. Closing must remove
+      // the page from the owner's list, rather than retain a stale owned tab.
+      expectOk(
+        await other.callTool('tabs', { action: 'close', page: ownPage }),
+        'foreign close',
+      )
+      await waitUntil(async () => {
+        const pages = textOf(await ctx.mcp.callTool('tabs', { action: 'list' }))
+        return !pages.includes(`[${ownPage}]`)
+      }, 'the owner list to remove the closed page')
     },
   },
 
```

---

### Incident Patch 10: `a6e76ff9` (2026-09-23)
**Commit Message**: fix(claw-server-rust): write runtime.json in place instead of temp+rename (#2745)

The discovery file was published by writing runtime.json.tmp and renaming it
over runtime.json. On Windows that rename can fail when the destination is
momentarily locked (a discovery client, antivirus, or the search indexer holding
it open), and the error is swallowed, leaving a stale URL that external clients
connect to after a restart or port change (#2721).

Write the file directly (create/truncate) instead. std::fs::write replaces an
existing file's contents in place on every platform (O_TRUNC on Unix,
CREATE_ALWAYS on Windows), so there is no rename to fail. A torn read of this
tiny, startup-written file is vanishingly unlikely and recoverable by re-reading,
so the atomic-rename it dropped was not buying anything here.

Fixes #2721

**File**: `packages/browseros-agent/apps/claw-server-rust/src/services/runtime_file.rs` (modified, +11/-7)
```diff
@@ -11,8 +11,9 @@ use tracing::warn;
 
 const RUNTIME_FILE: &str = "runtime.json";
 
-/// Atomically write `{ "url": <url> }` to `<dir>/runtime.json`. Errors are
-/// logged and swallowed so this best-effort disk write can never fail boot.
+/// Write `{ "url": <url> }` to `<dir>/runtime.json`, replacing any existing file
+/// in place. Errors are logged and swallowed so this best-effort disk write can
+/// never fail boot.
 pub async fn write(dir: &Path, url: &str) {
     if let Err(err) = try_write(dir, url).await {
         warn!(
@@ -26,20 +27,23 @@ pub async fn write(dir: &Path, url: &str) {
 async fn try_write(dir: &Path, url: &str) -> std::io::Result<()> {
     fs::create_dir_all(dir).await?;
     let path = dir.join(RUNTIME_FILE);
-    let tmp = dir.join(format!("{RUNTIME_FILE}.tmp"));
     let mut payload = serde_json::to_string_pretty(&json!({ "url": url }))
         .unwrap_or_else(|_| format!("{{\n  \"url\": \"{url}\"\n}}"));
     payload.push('\n');
-    fs::write(&tmp, &payload).await?;
-    fs::rename(&tmp, &path).await
+    // Write in place (create or truncate) rather than write-a-temp-then-rename.
+    // The rename could fail on Windows when the destination was momentarily
+    // locked, leaving a stale URL (#2721); a single portable overwrite avoids
+    // that whole class, and a torn read of this tiny startup-written file is
+    // both vanishingly unlikely and recoverable by re-reading.
+    fs::write(&path, &payload).await
 }
 
 #[cfg(test)]
 mod tests {
     use super::*;
 
     #[tokio::test]
-    async fn writes_url_and_cleans_up_temp() -> anyhow::Result<()> {
+    async fn writes_url() -> anyhow::Result<()> {
         let root = tempfile::tempdir()?;
         let dir = root.path();
 
@@ -49,7 +53,7 @@ mod tests {
         // Byte-for-byte identical to the archived TS writer's contract:
         // JSON.stringify({ url }, null, 2) + "\n".
         assert_eq!(raw, "{\n  \"url\": \"http://127.0.0.1:9200\"\n}\n");
-        // The atomic temp file must not survive the rename.
+        // No temp file is created any more.
         assert!(!dir.join("runtime.json.tmp").exists());
 
         Ok(())
```

#### Recent Merged Pull Requests:
- **PR #2789** (2026-09-30): chore: bump Claw server version to 0.0.60 (@github-actions[bot])
- **PR #2788** (2026-09-30): chore(release): snapshot browserclaw server alpha v0.0.60 (@github-actions[bot])
- **PR #2786** (2026-09-30): chore: bump browserclaw extension version to 0.2.27.0 (@github-actions[bot])
- **PR #2785** (2026-09-30): chore(release): update extension alpha feeds to 0.2.27.0 (@github-actions[bot])
- **PR #2784** (2026-09-30): ci: stop component releases claiming the Latest badge (@DaniAkash)
- **PR #2783** (2026-09-30): docs: add a code of conduct, a PR template, and an ask to watch the repo (@DaniAkash)
- **PR #2782** (2026-09-30): fix(mcp): run-SDK reliability for backgrounded tabs, waits, and dialogs (@DaniAkash)
- **PR #2781** (2026-09-29): fix(server): validate scheduled-job cadence fields on the API boundary (@DaniAkash)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
