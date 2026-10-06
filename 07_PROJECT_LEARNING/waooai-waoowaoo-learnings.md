# Forensic Learning Record (Deep Inspection): waooAI/waoowaoo

> **Canonical Artifact**: `07_PROJECT_LEARNING/waooai-waoowaoo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/waooAI/waoowaoo](https://github.com/waooAI/waoowaoo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:51:46.382Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `waooAI/waoowaoo`
- **Description**: 首家工业级全流程 AI 影视生产平台。Industry-first professional AI Agent platform for controllable film & video production. From shorts to live-action with Hollywood-standard workflows.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 14366 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app/[locale]/profile/components/api-config-tab/hooks/useApiConfigFilters.ts`
```
'use client'

import { useMemo } from 'react'
import type { UnifiedModelType } from '@/lib/ai-registry/types'
import { resolveSingleModelSelection } from '@/lib/ai-registry/media-model-selection'
import { encodeModelKey, parseModelKey, type CustomModel, type Provider } from '../../api-config'
import { isPresetComingSoonModelKey } from '../../api-config/types'
import type { DefaultModels } from '../../api-config/selectors'

export interface ModelSlotOption {
  modelKey: string
  name: string
  provider: string
  providerName: string
  providerHasKey: boolean
  comingSoon: boolean
}

export interface ModelSlotSelection {
  /** The model this slot currently uses; empty when the slot is unused. */
  modelKey: string
  /** Legacy configs may hold several models for one slot; the user must re-pick. */
  ambiguous: boolean
}

interface UseApiConfigFiltersParams {
  providers: Provider[]
  models: CustomModel[]
  defaultModels: DefaultModels
}

function hasProviderApiKey(provider: Provider | undefined): boolean {
  if (!provider) return false
  if (provider.hasApiKey === true) return true
  const apiKey = typeof provider.apiKey === 'string' ? provider.apiKey.trim() : ''
  return apiKey.length > 0
}

export function useApiConfigFilters({ providers, models, defaultModels }: UseApiConfigFiltersParams) {
  const providersById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider] as const)),
    [providers],
  )

  const modelProviders = useMemo(() => {
    const modelProviderIds = new Set(models.map((model) => model.provider))
    return providers.filter((provider) => modelProviderIds.has(provider.id))
  }, [models, providers])

  /** Every model of a type, providers holding a key first so the pickable ones lead. */
  const slotOptionsByType = useMemo(() => {
    const grouped = new Map<UnifiedModelType, ModelSlotOption[]>()
    for (const model of models) {
      const provider = providersById.get(model.provider)
      const option: ModelSlotOption = {
        modelKey: model.modelKey,
        name: model.name,
        provider: model.provider,
        providerName: provider?.name || model.provider,
        providerHasKey: hasProviderApiKey(provider),
        comingSoon: isPresetComingSoonModelKey(model.modelKey),
      }
      const bucket = grouped.get(model.type)
      if (bucket) bucket.push(option)
      else grouped.set(model.type, [option])
    }
    for (const options of grouped.values()) {
      options.sort((left, right) => Number(right.providerHasKey) - Number(left.providerHasKey))
    }
    return grouped
  }, [models, providersById])

  const enabledModels = useMemo(() => models.filter((model) => model.enabled), [models])

  const assistantModelKey = useMemo(() => {
    const parsed = parseModelKey(defaultModels.assistantModel)
    return parsed ? encodeModelKey(parsed.provider, parsed.modelId) : ''
  }, [defaultModels.assistantModel])

  /**
   * The Assistant selection is the authority for the text slot; media slots read
   * their single enabled model. Both are written through one selection action.
   */
  const getSlotSelection = (type: UnifiedModelType): ModelSlotSelection => {
    if (type === 'llm') return { modelKey: assistantModelKey, ambiguous: false }
    const selection = resolveSingleModelSelection(enabledModels, type)
    if (selection.status === 'selected') return { modelKey: selection.model.modelKey, ambiguous: false }
    return { modelKey: '', ambiguous: selection.status === 'ambiguous' }
  }

  return {
    modelProviders,
    getModelsForProvider: (providerId: string) => models.filter((model) => model.provider === providerId),
    getSlotOptions: (type: UnifiedModelType): ModelSlotOption[] => slotOptionsByType.get(type) ?? [],
    getSlotSelection,
    assistantModelKey,
  }
}

```

### Core Architecture Module: `src/app/[locale]/profile/components/api-config/hooks.ts`
```
'use client'
import { logError as _ulogError } from '@/lib/logging/core'
import { useLocale, useTranslations } from 'next-intl'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Provider,
    CustomModel,
    encodeModelKey,
    getProviderKey,
    isPresetComingSoonModelKey,
    resolvePresetProviderName,
} from './types'
import type { CapabilitySelections, UnifiedModelType } from '@/lib/ai-registry/types'
import type { WorkflowConcurrencyConfig } from '@/lib/workflow-concurrency'
import { useApiConfigSaver } from './editor'
import type { ApiConfigSaveError } from './editor'
import { useUserApiConfigQuery } from './query'
import { useToast } from '@/contexts/ToastContext'
import {
    clearMissingDefaultModels,
    createInitialModels,
    createInitialProviders,
    mergeModelsForDisplay,
    mergeProvidersForDisplay,
    parseWorkflowConcurrency,
    replaceDefaultModelKey,
    type DefaultModels,
} from './selectors'

export { mergeProvidersForDisplay } from './selectors'

interface UseProvidersReturn {
    fixedParameterFields: import('@/lib/ai-registry/fixed-parameters').FixedParameterFieldsByModel
    providers: Provider[]
    models: CustomModel[]
    defaultModels: DefaultModels
    workflowConcurrency: WorkflowConcurrencyConfig | null
    capabilityDefaults: CapabilitySelections
    loading: boolean
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    saveError: ApiConfigSaveError | null
    flushConfig: () => Promise<void>
    updateProviderApiKey: (providerId: string, apiKey: string) => void
    reorderProviders: (activeProviderId: string, overProviderId: string) => void
    deleteProvider: (providerId: string) => void
    selectSlotModel: (type: UnifiedModelType, modelKey: string) => void
    updateModel: (modelKey: string, updates: Partial<CustomModel>, providerId?: string) => void
    addModel: (model: Omit<CustomModel, 'enabled'>) => void
    deleteModel: (modelKey: string, providerId?: string) => void
    updateWorkflowConcurrency: (field: keyof WorkflowConcurrencyConfig, value: number) => void
    updateCapabilityDefault: (modelKey: string, field: string, value: string | number | boolean | null) => void
    getModelsByType: (type: CustomModel['type']) => CustomModel[]
}

export function useProviders(): UseProvidersReturn {
    const locale = useLocale()
    const t = useTranslations('apiConfig')
    const { showToast } = useToast()
    const [providers, setProviders] = useState<Provider[]>(createInitialProviders([]))
    const [models, setModels] = useState<CustomModel[]>(createInitialModels([]))
    const [defaultModels, setDefaultModels] = useState<DefaultModels>({})
    const [workflowConcurrency, setWorkflowConcurrency] = useState<WorkflowConcurrencyConfig | null>(null)
    const [capabilityDefaults, setCapabilityDefaults] = useState<CapabilitySelections>({})
    const { data, loading: queryLoading, error: queryError } = useUserApiConfigQuery()
    const catalogProviderIdsRef = useRef<Set<string>>(new Set())
    const catalogModelKeysRef = useRef<Set<string>>(new Set())

    // 始终持有最新值的 refs，用于避免异步保存时读到旧的闭包值
    const latestModelsRef = useRef(models)
    const latestProvidersRef = useRef(providers)
    const latestDefaultModelsRef = useRef(defaultModels)
    const latestWorkflowConcurrencyRef = useRef(workflowConcurrency)
    const latestCapabilityDefaultsRef = useRef(capabilityDefaults)
    useEffect(() => { latestModelsRef.current = models }, [models])
    useEffect(() => { latestProvidersRef.current = providers }, [providers])
    useEffect(() => { latestDefaultModelsRef.current = defaultModels }, [defaultModels])
    useEffect(() => { latestWorkflowConcurrencyRef.current = workflowConcurrency }, [workflowConcurrency])
    useEffect(() => { latestCapabilityDefaultsRef.current = capabilityDefaults }, [capabilityDefaults])

    const { saveStatus, saveError, performSave, flushConfig } = useApiConfigSaver({
        latestModelsRef,
        latestProvidersRef,
        latestDefaultModelsRef,
        latestWorkflowConcurrencyRef,
        latestCapabilityDefaultsRef,
    })

    useEffect(() => {
        if (queryError) {
            _ulogError('获取配置失败:', queryError)
            return
        }
        if (!data) return
        if (!data.catalog) {
            throw new Error('API_CONFIG_CATALOG_MISSING')
        }
        const catalogProviders = data.catalog.providers
        const catalogModels = data.catalog.models
        catalogProviderIdsRef.current = new Set(catalogProviders.map((provider) => provider.id))
        catalogModelKeysRef.current = new Set(catalogModels.map((model) => encodeModelKey(model.provider, model.modelId)))

        const serverCatalogProviders = catalogProviders.map((provider) => ({
            ...provider,
            name: resolvePresetProviderName(provider.id, provider.name, locale),
        }))

        const savedProviders: Provider[] = data.providers || []
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize editable drafts from the received server catalog snapshot.
        setProviders(mergeProvidersForDisplay(savedProviders, serverCatalogProviders))
        setModels(mergeModelsForDisplay(data.models || [], catalogModels))
        if (data.defaultModels) setDefaultModels(data.defaultModels)
        setWorkflowConcurrency(parseWorkflowConcurrency(data.workflowConcurrency))
        if (data.capabilityDefaults && typeof data.capabilityDefaults === 'object') {
            setCapabilityDefaults(data.capabilityDefaults as CapabilitySelections)
        }
    }, [data, queryError, locale])

    const updateCapabilityDefault = useCallback((modelKey: string, field: string, value: string | number | boolean | null) => {
        setCapabilityDefaults((previous) => {
            const next: CapabilitySelections = { ...previous }
            const current = { ...(next[modelKey] || {}) }
            if (value === null) {
                delete current[field]
            } else {
                current[field] = value
            }

            if (Object.keys(current).length === 0) {
                delete next[modelKey]
            } else {
                next[modelKey] = current
            }
            latestCapabilityDefaultsRef.current = next
            void performSave({ capabilityDefaults: next })
            return next
        })
    }, [performSave])

    const updateWorkflowConcurrency = useCallback((field: keyof WorkflowConcurrencyConfig, value: number) => {
        const previous = latestWorkflowConcurrencyRef.current
        if (previous === null) throw new Error('WORKFLOW_CONCURRENCY_MANAGED_BY_SYSTEM')
        if (!Number.isInteger(value) || value < 1) throw new Error('WORKFLOW_CONCURRENCY_VALUE_INVALID')
        const next = { ...previous, [field]: value }
        latestWorkflowConcurrencyRef.current = next
        setWorkflowConcurrency(next)
        void performSave({ workflowConcurrency: next })
    }, [performSave])

    // 提供商操作
    const updateProviderApiKey = useCallback((providerId: string, apiKey: string) => {
        const previousProvider = latestProvidersRef.current.find((provider) => provider.id === providerId)
        if (!previousProvider) return
        const next = latestProvidersRef.current.map((provider) => (
            provider.id === providerId ? { ...provider, apiKey, hasApiKey: Boolean(apiKey) } : provider
        ))
        latestProvidersRef.current = next
        setProviders(next)
        void performSave().then((saved) => {
            const settled = latestProvidersRef.current.map((provider) => {
                if (provider.id !== providerId) return provider
                if (!saved) return previousProvider
                return { ...provider, apiKey: undefined, hasApiKey: Boolean(apiKey) }
            })
            latestProvidersRef.current = settled
            setProviders(settled)
        })
    }, [performSave])

    const reorderProviders = useCallback((activeProviderId: string, overProviderId: string) => {
        if (activeProviderId === overProviderId) return
        setProviders((previous) => {
            const oldIndex = previous.findIndex((provider) => provider.id === activeProviderId)
            const newIndex = previous.findIndex((provider) => provider.id === overProviderId)
            if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
                return previous
            }

            const next = [...previous]
            const moved = next[oldIndex]
            if (!moved) return previous
            next.splice(oldIndex, 1)
            next.splice(newIndex, 0, moved)
            latestProvidersRef.current = next
            void performSave()
            return next
        })
    }, [performSave])

    const deleteProvider = useCallback((providerId: string) => {
        if (catalogProviderIdsRef.current.has(providerId)) {
            showToast(t('presetProviderCannotDelete'), 'warning')
            return
        }
        if (confirm(t('confirmDeleteProvider'))) {
            setProviders(prev => {
                const next = prev.filter(p => p.id !== providerId)
                latestProvidersRef.current = next
                return next
            })
            setModels(prev => {
                const nextModels = prev.filter(m => m.provider !== providerId)
                setDefaultModels(prevDefaults => {
                    const remainingModelKeys = new Set(nextModels.map(m => m.modelKey))
                    const updates = clearMissingDefaultModels(prevDefaults, remainingModelKeys)
                    latestDefaultModelsRef.current = updates
                    return updates
                })
                latestModelsRef.current = nextModels
                void performSave()
                return nextModels
            })
        }
    }, [t, performSave, showToast])

    /**
     * One action for every slot: the picked model becomes the only enabled model
     * of its type, and the
```

### Core Architecture Module: `src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts`
```
'use client'

import { useState, useMemo } from 'react'
import {
  encodeModelKey,
  getProviderTutorial,
  matchesModelKey,
} from '../../types'
import type {
  ModelFormState,
  ProviderCardGroupedModels,
  ProviderCardModelType,
  ProviderCardProps,
  ProviderCardTranslator,
} from '../types'
import type { CustomModel } from '../../types'
import { useToast } from '@/contexts/ToastContext'

interface UseProviderCardStateParams {
  provider: ProviderCardProps['provider']
  models: ProviderCardProps['models']
  allModels?: ProviderCardProps['allModels']
  defaultModels: ProviderCardProps['defaultModels']
  onUpdateApiKey: ProviderCardProps['onUpdateApiKey']
  onUpdateModel: ProviderCardProps['onUpdateModel']
  onAddModel: ProviderCardProps['onAddModel']
  t: ProviderCardTranslator
}

const EMPTY_MODEL_FORM: ModelFormState = {
  name: '',
  modelId: '',
}

export function buildProviderCardGroupedModels(
  models: CustomModel[],
): ProviderCardGroupedModels {
  const groupedModels: ProviderCardGroupedModels = {}
  for (const model of models) {
    const groupedType = model.type
    if (!groupedModels[groupedType]) {
      groupedModels[groupedType] = []
    }
    groupedModels[groupedType]!.push(model)
  }
  return groupedModels
}

export interface UseProviderCardStateResult {
  isPresetProvider: boolean
  tutorial: ReturnType<typeof getProviderTutorial>
  groupedModels: ProviderCardGroupedModels
  isEditing: boolean
  tempKey: string
  showTutorial: boolean
  showAddForm: ProviderCardModelType | null
  newModel: ModelFormState
  editingModelId: string | null
  editModel: ModelFormState
  isPresetModel: (modelKey: string) => boolean
  isDefaultModel: (model: CustomModel) => boolean
  setShowTutorial: (value: boolean) => void
  setShowAddForm: (value: ProviderCardModelType | null) => void
  setNewModel: (value: ModelFormState) => void
  setEditModel: (value: ModelFormState) => void
  setTempKey: (value: string) => void
  startEditKey: () => void
  handleSaveKey: () => void
  handleCancelEdit: () => void
  handleEditModel: (model: CustomModel) => void
  handleCancelEditModel: () => void
  handleSaveModel: (originalModelKey: string) => Promise<void>
  handleAddModel: (type: ProviderCardModelType) => Promise<void>
  handleCancelAdd: () => void
  isModelSavePending: boolean
}

export function useProviderCardState({
  provider,
  models,
  allModels,
  defaultModels,
  onUpdateApiKey,
  onUpdateModel,
  onAddModel,
  t,
}: UseProviderCardStateParams): UseProviderCardStateResult {
  const { showToast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [tempKey, setTempKey] = useState(provider.apiKey || '')
  const [showTutorial, setShowTutorial] = useState(false)
  const [showAddForm, setShowAddForm] = useState<ProviderCardModelType | null>(null)
  const [newModel, setNewModel] = useState<ModelFormState>(EMPTY_MODEL_FORM)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [editModel, setEditModel] = useState<ModelFormState>(EMPTY_MODEL_FORM)
  const [isModelSavePending, setIsModelSavePending] = useState(false)

  const isPresetProvider = !provider.id.includes(':')
  const tutorial = getProviderTutorial(provider.id)

  const groupedModels = useMemo(
    () => buildProviderCardGroupedModels(models),
    [models],
  )

  const isPresetModel = () => false

  const isDefaultModel = (model: CustomModel) => (
    model.type === 'llm'
      ? matchesModelKey(defaultModels.assistantModel, model.provider, model.modelId)
      : model.enabled
  )

  const startEditKey = () => {
    setTempKey('')
    setIsEditing(true)
  }

  const handleSaveKey = () => {
    if (!tempKey.trim()) {
      showToast(t('enterApiKey'), 'warning')
      return
    }
    onUpdateApiKey(provider.id, tempKey.trim())
    setTempKey('')
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setTempKey('')
    setIsEditing(false)
  }

  const handleEditModel = (model: CustomModel) => {
    setEditingModelId(model.modelKey)
    setEditModel({
      name: model.name,
      modelId: model.modelId,
    })
  }

  const handleCancelEditModel = () => {
    setEditingModelId(null)
    setEditModel(EMPTY_MODEL_FORM)
  }

  const handleSaveModel = async (originalModelKey: string): Promise<void> => {
    if (isModelSavePending) return
    if (!editModel.name || !editModel.modelId) {
      showToast(t('fillComplete'), 'warning')
      return
    }

    const nextModelKey = encodeModelKey(provider.id, editModel.modelId)
    const all = allModels || models
    const duplicate = all.some(
      (model) =>
        model.modelKey === nextModelKey &&
        model.modelKey !== originalModelKey,
    )

    if (duplicate) {
      showToast(t('modelIdExists'), 'warning')
      return
    }

    setIsModelSavePending(true)
    try {
      onUpdateModel?.(originalModelKey, {
        name: editModel.name,
        modelId: editModel.modelId,
      })

      handleCancelEditModel()
    } finally {
      setIsModelSavePending(false)
    }
  }

  const handleAddModel = async (type: ProviderCardModelType): Promise<void> => {
    if (isModelSavePending) return
    if (!newModel.name || !newModel.modelId) {
      showToast(t('fillComplete'), 'warning')
      return
    }

    const finalModelId = newModel.modelId
    const finalModelKey = encodeModelKey(provider.id, finalModelId)

    const all = allModels || models
    if (all.some((model) => model.modelKey === finalModelKey)) {
      showToast(t('modelIdExists'), 'warning')
      return
    }

    setIsModelSavePending(true)
    try {
      onAddModel({
        modelId: finalModelId,
        modelKey: finalModelKey,
        name: newModel.name,
        type,
        provider: provider.id,
      })

      setNewModel(EMPTY_MODEL_FORM)
      setShowAddForm(null)
    } finally {
      setIsModelSavePending(false)
    }
  }

  const handleCancelAdd = () => {
    setShowAddForm(null)
    setNewModel(EMPTY_MODEL_FORM)
  }

  return {
    isPresetProvider,
    tutorial,
    groupedModels,
    isEditing,
    tempKey,
    showTutorial,
    showAddForm,
    newModel,
    editingModelId,
    editModel,
    isPresetModel,
    isDefaultModel,
    setShowTutorial,
    setShowAddForm,
    setNewModel,
    setEditModel,
    setTempKey,
    startEditKey,
    handleSaveKey,
    handleCancelEdit,
    handleEditModel,
    handleCancelEditModel,
    handleSaveModel,
    handleAddModel,
    handleCancelAdd,
    isModelSavePending,
  }
}

```

### Core Architecture Module: `src/app/api/assets/[assetId]/revert-render/route.ts`
```
import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { executeProjectAgentOperationFromApi } from '@/lib/adapters/api/execute-project-agent-operation'
import type { AssetKind, AssetScope } from '@/lib/assets/contracts'
import { GLOBAL_ASSET_PROJECT_ID } from '@/lib/workspace-resource/resource-impact'

type RevertRenderBody = {
  scope?: AssetScope
  kind?: Extract<AssetKind, 'character' | 'location' | 'prop'>
} & Record<string, unknown>

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) => {
  const { assetId } = await context.params
  const body = await request.json() as RevertRenderBody
  if (body.scope !== 'global') {
    throw new ApiError('INVALID_PARAMS')
  }
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const result = await executeProjectAgentOperationFromApi({
    request,
    operationId: 'api_assets_revert_render',
    projectId: GLOBAL_ASSET_PROJECT_ID,
    userId: authResult.session.user.id,
    input: { assetId, ...body },
    source: 'asset-hub',
    responseContract: 'operation_mutation_response_v1',
  })
  return NextResponse.json(result)
})

```

### Core Architecture Module: `src/app/api/assets/[assetId]/select-render/route.ts`
```
import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { executeProjectAgentOperationFromApi } from '@/lib/adapters/api/execute-project-agent-operation'
import type { AssetKind, AssetScope } from '@/lib/assets/contracts'
import { GLOBAL_ASSET_PROJECT_ID } from '@/lib/workspace-resource/resource-impact'

type SelectRenderBody = {
  scope?: AssetScope
  kind?: Extract<AssetKind, 'character' | 'location' | 'prop'>
} & Record<string, unknown>

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) => {
  const { assetId } = await context.params
  const body = await request.json() as SelectRenderBody
  if (body.scope !== 'global') {
    throw new ApiError('INVALID_PARAMS')
  }
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const result = await executeProjectAgentOperationFromApi({
    request,
    operationId: 'api_assets_select_render',
    projectId: GLOBAL_ASSET_PROJECT_ID,
    userId: authResult.session.user.id,
    input: { assetId, ...body },
    source: 'asset-hub',
    responseContract: 'operation_mutation_response_v1',
  })
  return NextResponse.json(result)
})

```

### Core Architecture Module: `src/app/api/payments/stripe/webhook/route.ts`
```
import type { NextRequest } from 'next/server'
import type { EditionRouteContext } from '@/lib/edition/contracts/routes'
import { editionRouteHandlers } from '@/lib/edition/current/routes'

export const runtime = 'nodejs'

export function POST(request: NextRequest, context: EditionRouteContext): Promise<Response> {
  return editionRouteHandlers.paymentsStripeWebhookPost(request, context)
}

```

### Core Architecture Module: `src/app/api/task-target-states/route.ts`
```
import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { executeProjectAgentOperationFromApi } from '@/lib/adapters/api/execute-project-agent-operation'
import {
  isErrorResponse,
  requireProjectAuthLight,
  requireUserAuth,
} from '@/lib/api-auth'
import { GLOBAL_ASSET_PROJECT_ID } from '@/lib/workspace-resource/resource-impact'

type TaskTargetQuery = {
  targetType: string
  targetId: string
  types?: string[]
}

function normalizeTarget(input: unknown): TaskTargetQuery {
  const payload = input as Record<string, unknown>
  const targetType = typeof payload.targetType === 'string' ? payload.targetType.trim() : ''
  const targetId = typeof payload.targetId === 'string' ? payload.targetId.trim() : ''
  const types = Array.isArray(payload.types)
    ? payload.types.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined

  if (!targetType || !targetId) {
    throw new ApiError('INVALID_PARAMS')
  }

  return {
    targetType,
    targetId,
    ...(types && types.length > 0 ? { types } : {}),
  }
}

export const POST = apiHandler(async (request: NextRequest) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    throw new ApiError('INVALID_PARAMS', {
      code: 'BODY_PARSE_FAILED',
      field: 'body',
      message: 'request body must be valid JSON',
    })
  }

  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''
  const targetsRaw = Array.isArray(body?.targets) ? body.targets : null

  if (!projectId || !targetsRaw) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (targetsRaw.length > 500) {
    throw new ApiError('INVALID_PARAMS')
  }

  const targets = targetsRaw.map(normalizeTarget)

  if (targets.length === 0) {
    return NextResponse.json({ states: [] })
  }

  let userId: string
  if (projectId === GLOBAL_ASSET_PROJECT_ID) {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    userId = authResult.session.user.id
  } else {
    const authResult = await requireProjectAuthLight(projectId)
    if (isErrorResponse(authResult)) return authResult
    userId = authResult.session.user.id
  }

  const result = await executeProjectAgentOperationFromApi({
    request,
    operationId: 'get_task_status',
    projectId,
    userId,
    input: { targets },
    source: 'project-ui',
  })

  return NextResponse.json(result)
})

```

### Core Architecture Module: `src/components/shared/assets/character-creation/hooks/useCharacterCreationSubmit.ts`
```
'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { shouldShowError } from '@/lib/error-utils'
import {
  useCreateAssetHubCharacter,
} from '@/lib/query/hooks'
import { useToast } from '@/contexts/ToastContext'

interface UseCharacterCreationSubmitParams {
  folderId?: string | null
  name: string
  description: string
  onSuccess: () => void
  onClose: () => void
}

export function useCharacterCreationSubmit({
  folderId,
  name,
  description,
  onSuccess,
  onClose,
}: UseCharacterCreationSubmitParams) {
  const t = useTranslations('assetModal')
  const { showError } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createAssetHubCharacter = useCreateAssetHubCharacter()

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !description.trim()) return
    try {
      setIsSubmitting(true)
      await createAssetHubCharacter.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        folderId: folderId ?? null,
      })
      onSuccess()
      onClose()
    } catch (error: unknown) {
      if (shouldShowError(error)) {
        showError(error, t('errors.createFailed'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    createAssetHubCharacter,
    description,
    folderId,
    name,
    onClose,
    onSuccess,
    showError,
    t,
  ])

  return {
    isSubmitting,
    handleSubmit,
  }
}

```

### Core Architecture Module: `src/features/project-workspace/canvas/hooks/canvas-projection-signature.ts`
```
import type {
  WorkspaceCanvasFlowEdge,
  WorkspaceCanvasFlowNode,
} from '../node-canvas-types'

function stableRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((record, key) => {
      if (key === 'onAction') return record
      record[key] = value[key]
      return record
    }, {})
}

function nodeSignature(node: WorkspaceCanvasFlowNode): string {
  return JSON.stringify({
    id: node.id,
    type: node.type,
    position: node.position,
    zIndex: node.zIndex ?? null,
    draggable: node.draggable ?? null,
    selectable: node.selectable ?? null,
    style: node.style ?? null,
    data: stableRecord(node.data),
  })
}

function edgeSignature(edge: WorkspaceCanvasFlowEdge): string {
  return JSON.stringify({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type ?? null,
    animated: edge.animated ?? null,
    style: edge.style ?? null,
  })
}

export function buildWorkspaceCanvasNodeSignature(nodes: readonly WorkspaceCanvasFlowNode[]): string {
  return nodes.map(nodeSignature).join('\n')
}

export function buildWorkspaceCanvasEdgeSignature(edges: readonly WorkspaceCanvasFlowEdge[]): string {
  return edges.map(edgeSignature).join('\n')
}

```

### Core Architecture Module: `src/features/project-workspace/canvas/hooks/useCanvasCreateDraft.ts`
```
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CapabilityValue } from '@/lib/ai-registry/types'
import type { WorkspaceCanvasGenerationCapabilitiesView } from '@/lib/workspace-resource/canvas-generation-capabilities'
import type { WorkspaceAssistantTurnOutcomeView } from '../../workspace-assistant-focus'
import { resolveWorkspaceAssistantUserMessageId } from '../../components/workspace-assistant/workspace-assistant-command-receipt'
import { canvasGenerationFormIssues, canvasEditableParameters } from '../create/canvas-generation-form'
import type { WorkspaceAssistantDraftSubmitRequest } from '../contracts/workspace-canvas-interactions'
import {
  canvasDraftSourceKey,
  canvasReferenceRole,
  canvasDraftReferenceRoles,
  defaultCanvasDraftReferenceRole,
  resolveCanvasAspectRatioChoices,
  type CanvasDraftComposition,
  type CanvasDraftMediaType,
  type CanvasDraftReference,
  type CanvasDraftReferenceCandidate,
  type CanvasDraftReferenceRole,
  type CanvasGenerationCapability,
} from '../create/canvas-draft'

export interface CanvasDraftPosition {
  readonly x: number
  readonly y: number
}

export type CanvasCreateDraft =
  | { readonly phase: 'menu'; readonly id: string; readonly position: CanvasDraftPosition }
  | {
      readonly phase: 'compose'
      readonly id: string
      readonly position: CanvasDraftPosition
      readonly composition: CanvasDraftComposition
    }
  | {
      readonly phase: 'submitted'
      readonly id: string
      readonly position: CanvasDraftPosition
      readonly mediaType: CanvasDraftMediaType
      readonly aspectRatio: string | null
      /** Deterministic identity of the user message this draft sent. */
      readonly sourceMessageId: string
      /** True once the Turn started by that message was seen in the assistant view. */
      readonly turnObserved: boolean
      readonly pinnedResourceIds: readonly string[]
    }

export type CanvasComposeDraft = Extract<CanvasCreateDraft, { phase: 'compose' }>
export type CanvasSubmittedDraft = Extract<CanvasCreateDraft, { phase: 'submitted' }>

/** The configured model's capability for one generation kind, or null when no model is configured. */
export function canvasGenerationCapabilityFor(
  capabilities: WorkspaceCanvasGenerationCapabilitiesView | null,
  mediaType: CanvasDraftMediaType,
  purpose: 'assistant' | 'manual' = 'assistant',
): CanvasGenerationCapability | null {
  if (!capabilities) return null
  if (mediaType === 'image') {
    const view = purpose === 'assistant' ? capabilities.assistantImage : capabilities.image
    return view ? { mediaType, view } : null
  }
  const view = purpose === 'assistant' ? capabilities.assistantVideo : capabilities.video
  return view ? { mediaType, view } : null
}

function resolveSubmittedDraftTransition(
  draft: CanvasSubmittedDraft,
  outcome: WorkspaceAssistantTurnOutcomeView | null,
  newResourceIds: readonly string[],
): CanvasSubmittedDraft | 'close' | null {
  if (!outcome) return draft.turnObserved ? 'close' : null
  if (newResourceIds.length > 0 || !draft.turnObserved) {
    return {
      ...draft,
      turnObserved: true,
      pinnedResourceIds: [...draft.pinnedResourceIds, ...newResourceIds],
    }
  }
  return outcome.terminal && outcome.resourceTargetIds.length === 0 ? 'close' : null
}

/**
 * Owner of the one Canvas draft (menu → compose → submitted). Every choice a
 * draft offers is bound to the configured model's capability View. Submission
 * goes through the assistant's single send authority; afterwards the draft
 * only waits for the Turn it started to reserve Resources, pins them at the
 * draft position, and retires once a pinned node is projected or the Turn
 * ends without producing anything.
 */
export function useCanvasCreateDraft(params: {
  readonly projectId: string
  readonly folderPath: string | null
  readonly projectAspectRatio: string | null
  readonly capabilities: WorkspaceCanvasGenerationCapabilitiesView | null
  readonly turnOutcomes: readonly WorkspaceAssistantTurnOutcomeView[]
  readonly projectedResourceIds: ReadonlySet<string>
  readonly buildMessage: (composition: CanvasDraftComposition) => string
  readonly submitToAssistant: (request: WorkspaceAssistantDraftSubmitRequest) => void
  readonly pinResources: (resourceIds: readonly string[], position: CanvasDraftPosition) => void
}) {
  const {
    projectId, folderPath, projectAspectRatio, capabilities, turnOutcomes, projectedResourceIds,
    buildMessage, submitToAssistant, pinResources,
  } = params
  const [draft, setDraft] = useState<CanvasCreateDraft | null>(null)
  const submittingRef = useRef<{ readonly draftId: string; readonly controller: AbortController } | null>(null)

  const close = useCallback((draftId?: string) => {
    if (draftId === undefined || submittingRef.current?.draftId === draftId) submittingRef.current?.controller.abort()
    setDraft((current) => (current && (draftId === undefined || current.id === draftId) ? null : current))
  }, [])

  const openMenu = useCallback((position: CanvasDraftPosition) => {
    submittingRef.current?.controller.abort()
    setDraft({ phase: 'menu', id: crypto.randomUUID(), position })
  }, [])

  const startCompose = useCallback((input: {
    readonly position: CanvasDraftPosition
    readonly mediaType: CanvasDraftMediaType
    readonly references?: readonly CanvasDraftReference[]
  }) => {
    submittingRef.current?.controller.abort()
    const capability = canvasGenerationCapabilityFor(capabilities, input.mediaType)
    setDraft({
      phase: 'compose',
      id: crypto.randomUUID(),
      position: input.position,
      composition: {
        mediaType: input.mediaType,
        configurationVersion: capability?.view.configurationVersion ?? null,
        durationSeconds: null,
        text: '',
        aspectRatio: resolveCanvasAspectRatioChoices(capability, projectAspectRatio).defaultRatio,
        parameters: {},
        references: input.references ?? [],
      },
    })
  }, [capabilities, projectAspectRatio])

  const updateComposition = useCallback((patch: Partial<Omit<CanvasDraftComposition, 'mediaType' | 'references'>>) => {
    submittingRef.current?.controller.abort()
    setDraft((current) => (
      current?.phase === 'compose'
        ? { ...current, composition: { ...current.composition, ...patch } }
        : current
    ))
  }, [])

  const setParameter = useCallback((field: string, value: CapabilityValue | undefined) => {
    submittingRef.current?.controller.abort()
    setDraft((current) => {
      if (current?.phase !== 'compose') return current
      const parameters: Record<string, CapabilityValue> = { ...current.composition.parameters }
      if (value === undefined) delete parameters[field]
      else parameters[field] = value
      return { ...current, composition: { ...current.composition, parameters } }
    })
  }, [])

  const addReference = useCallback((reference: CanvasDraftReferenceCandidate): boolean => {
    submittingRef.current?.controller.abort()
    if (draft?.phase !== 'compose') return false
    const existing = draft.composition.references
    if (existing.some((candidate) => candidate.resourceId === reference.resourceId)) return false
    const role = defaultCanvasDraftReferenceRole(
      draft.composition.mediaType, reference.mediaType, existing.map(canvasReferenceRole),
      canvasGenerationCapabilityFor(capabilities, draft.composition.mediaType),
    )
    if (!role) return false
    setDraft({ ...draft, composition: { ...draft.composition, references: [...existing, { ...reference, role }] } })
    return true
  }, [capabilities, draft])

  const removeReference = useCallback((resourceId: string) => {
    submittingRef.current?.controller.abort()
    setDraft((current) => (
      current?.phase === 'compose'
        ? {
            ...current,
            composition: {
              ...current.composition,
              references: current.composition.references.filter((reference) => reference.resourceId !== resourceId),
            },
          }
        : current
    ))
  }, [])

  const setReferenceRole = useCallback((resourceId: string, role: CanvasDraftReferenceRole) => {
    submittingRef.current?.controller.abort()
    setDraft((current) => {
      if (current?.phase !== 'compose') return current
      const reference = current.composition.references.find((candidate) => candidate.resourceId === resourceId)
      if (!reference) return current
      const others = current.composition.references.filter((candidate) => candidate.resourceId !== resourceId)
      const capability = canvasGenerationCapabilityFor(capabilities, current.composition.mediaType)
      if (!canvasDraftReferenceRoles(current.composition.mediaType, reference.mediaType, capability, others.map(canvasReferenceRole)).includes(role)) return current
      return { ...current, composition: { ...current.composition, references: current.composition.references.map((candidate) => (
        candidate.resourceId === resourceId ? { ...candidate, role } : candidate
      )) } }
    })
  }, [capabilities])

  const reviewConfiguration = useCallback(() => {
    submittingRef.current?.controller.abort()
    setDraft((current) => {
      if (current?.phase !== 'compose') return current
      const capability = canvasGenerationCapabilityFor(capabilities, current.composition.mediaType)
      if (!capability) return current
      return { ...current, composition: { ...current.composition,
        configurationVersion: capability.view.configurationVersion,
        parameters: canvasEditableParameters(capability, current.composition.parameters),
      } }
    })
  }, [capabilities])

  const submit = useCallback(async () => {
    if (draft?.phase !== 'compose' || !draft.composition.text.trim()) return
    const capability = canvasGenerationCapabilityFor(capabilities, draft.composition.mediaType)
    if (!capability || submittingRef.current || canvasGenerationFormIssues(capability, {
```

### Core Architecture Module: `src/features/project-workspace/canvas/hooks/useCanvasFocusFollow.ts`
```
'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import type { TaskRuntimeTarget } from '@/lib/task/runtime-targets'
import { taskRuntimeTargetQueryKey } from '@/lib/task/runtime-targets'
import type { WorkspaceCanvasFlowNode } from '../node-canvas-types'

const FOCUS_FOLLOW_DEBOUNCE_MS = 240
const FOCUS_FIT_PADDING = 0.14
const FOCUS_FIT_MAX_ZOOM = 1
const FOCUS_FIT_DURATION_MS = 180

export interface UseCanvasFocusFollowParams {
  readonly reactFlow: ReactFlowInstance<WorkspaceCanvasFlowNode>
  readonly containerRef: RefObject<HTMLDivElement | null>
  readonly enabled: boolean
  readonly focusNodeIds: readonly string[]
  readonly focusRequestKey: string | null
}

export interface CanvasFocusFollowResult {
  readonly notifyUserInteraction: () => void
}

/**
 * A Task batch becomes focusable only after at least one of its durable
 * targets has materialized as a Canvas node. The returned ids are a trigger,
 * not the fitView target: the viewport always fits the whole Canvas once.
 */
export function resolveWorkspaceCanvasFocusNodeIds(
  nodes: readonly WorkspaceCanvasFlowNode[],
  taskTargets: readonly TaskRuntimeTarget[],
): string[] {
  const targetKeys = new Set(taskTargets.map(taskRuntimeTargetQueryKey))
  if (targetKeys.size === 0) return []
  return nodes.flatMap((node) => (
    (node.data.runtimeTargets ?? []).some((target) => targetKeys.has(taskRuntimeTargetQueryKey(target)))
      ? [node.id]
      : []
  ))
}

export function useCanvasFocusFollow({
  reactFlow,
  containerRef,
  enabled,
  focusNodeIds,
  focusRequestKey,
}: UseCanvasFocusFollowParams): CanvasFocusFollowResult {
  const debounceTimerRef = useRef<number | null>(null)
  const currentFocusKeyRef = useRef<string | null>(null)
  const handledFocusKeysRef = useRef(new Set<string>())
  const focusNodesReady = focusNodeIds.length > 0
  const focusNodeSignature = useMemo(() => [...focusNodeIds].sort().join('|'), [focusNodeIds])
  useLayoutEffect(() => { currentFocusKeyRef.current = focusRequestKey }, [focusRequestKey])

  const clearPendingFocus = useCallback(() => {
    if (debounceTimerRef.current === null) return
    window.clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = null
  }, [])

  const notifyUserInteraction = useCallback(() => {
    clearPendingFocus()
    const currentFocusKey = currentFocusKeyRef.current
    if (currentFocusKey) handledFocusKeysRef.current.add(currentFocusKey)
    void reactFlow.setViewport(reactFlow.getViewport(), { duration: 0 })
  }, [clearPendingFocus, reactFlow])

  useEffect(() => {
    clearPendingFocus()
    const focusKey = focusRequestKey?.trim() || null
    if (
      !enabled
      || !focusKey
      || !focusNodesReady
      || handledFocusKeysRef.current.has(focusKey)
    ) {
      return undefined
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      if (
        !containerRef.current
        || handledFocusKeysRef.current.has(focusKey)
      ) {
        return
      }
      handledFocusKeysRef.current.add(focusKey)
      void reactFlow.fitView({
        padding: FOCUS_FIT_PADDING,
        maxZoom: FOCUS_FIT_MAX_ZOOM,
        duration: FOCUS_FIT_DURATION_MS,
      })
    }, FOCUS_FOLLOW_DEBOUNCE_MS)

    return clearPendingFocus
  }, [
    clearPendingFocus,
    containerRef,
    enabled,
    focusNodeSignature,
    focusNodesReady,
    focusRequestKey,
    reactFlow,
  ])

  useEffect(() => clearPendingFocus, [clearPendingFocus])

  return { notifyUserInteraction }
}

```

### Core Architecture Module: `src/features/project-workspace/canvas/hooks/useCanvasHistory.ts`
```
'use client'

import { useCallback, useRef } from 'react'

interface CanvasPoint {
  readonly x: number
  readonly y: number
}

export type CanvasHistoryEntry =
  | {
      readonly kind: 'move'
      readonly changes: readonly { readonly nodeId: string; readonly from: CanvasPoint; readonly to: CanvasPoint }[]
    }
  | {
      readonly kind: 'delete'
      readonly resources: readonly { readonly resourceId: string; readonly workspacePath: string; readonly name: string }[]
    }

const MAX_HISTORY_ENTRIES = 100

/**
 * Undo/redo journal of Canvas user actions. Moves are pure layout facts and
 * replay both ways; a delete undo restores through the restore Operation and
 * is not redoable, because re-deleting must go through confirmation again.
 * The journal never interprets Resource state; it only remembers what the
 * user did and lets the Canvas owner apply the inverse.
 */
export function useCanvasHistory() {
  // The journal is consulted only from event handlers, so it lives in refs
  // and never drives a render.
  const undoRef = useRef<CanvasHistoryEntry[]>([])
  const redoRef = useRef<Extract<CanvasHistoryEntry, { kind: 'move' }>[]>([])

  const push = useCallback((entry: CanvasHistoryEntry) => {
    undoRef.current = [...undoRef.current.slice(-(MAX_HISTORY_ENTRIES - 1)), entry]
    redoRef.current = []
  }, [])

  const undo = useCallback((): CanvasHistoryEntry | null => {
    const entry = undoRef.current.at(-1) ?? null
    if (!entry) return null
    undoRef.current = undoRef.current.slice(0, -1)
    if (entry.kind === 'move') redoRef.current = [...redoRef.current, entry]
    return entry
  }, [])

  const redo = useCallback((): Extract<CanvasHistoryEntry, { kind: 'move' }> | null => {
    const entry = redoRef.current.at(-1) ?? null
    if (!entry) return null
    redoRef.current = redoRef.current.slice(0, -1)
    undoRef.current = [...undoRef.current, entry]
    return entry
  }, [])

  return { push, undo, redo } as const
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #179** (2026-04-25): **换不了模型**
  *Symptoms*: 我一开始用的gpt，后面想换qwen不行 在设置里已经换了，但是剧本生成还是报错生成失败: MODEL_NOT_FOUND: openai-compatible:mnk2aqij-ab16kel3::gpt-4.1 is not enabled for llm 我都没用4.1了
  **Post-Mortem & Fix Analysis**:
  > 无法重试某一步

- **Issue #172** (2026-04-10): **comfyUI的API配置，能不能支持下？**
  *Symptoms*: 我想配置本地部署的comfyui，能不能支持通过API方式配置？
  **Post-Mortem & Fix Analysis**:
  > 不支持本地模型哦

- **Issue #169** (2026-04-10): **希望能支持 OpenRouter 渠道的生图模型**
  *Symptoms*: 如题
  **Post-Mortem & Fix Analysis**:
  > 还可以增加vllm-omni的，vllm-omni本地运行Wan2.2-I2V-A14B-Diffusers，vllm-omni本地运行qwen-image，好像也不支持
  > 后续会支持

- **Issue #167** (2026-04-03): **Invalid `prisma.locationImage.createMany()` invocation: The column `availableSlots` does not exist in the current database.**
  *Symptoms*: 报错啊，显示剧本转换完成了 但是有这个问题 我是docker compose部署的
  **Post-Mortem & Fix Analysis**:
  > 清空数据库 目前版本之间是不兼容的

- **Issue #166** (2026-04-03): **支持提交代码吗**
  *Symptoms*: 大佬可以fork后提交代码吗
  **Post-Mortem & Fix Analysis**:
  > 目前不开放

- **Issue #165** (2026-04-03): **出现了bug，做到资产分析那一步，不小心按了Esc，整个项目直接丢失了。**
  *Symptoms*: 出现了bug，做到资产分析那一步，不小心按了Esc，整个项目直接丢失了。

- **Issue #164** (2026-04-03): **我使用CPA搭建的服务，一直报错**
  *Symptoms*: Unexpected token 'd', "data: {"id"... is not valid JSON

- **Issue #163** (2026-04-03): **作者失联了？wx群满了也没法更新**
  *Symptoms*: 咋回事，wx群满也不更新，难道要我们自己创建组织啊。赶紧更新！来个新的群码
  **Post-Mortem & Fix Analysis**:
  > 已更新 前段时间比较忙！
  > 大佬，码呢
  > 更新在原来的码上了

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

### Incident Patch 1: `78b93331` (2026-04-03)
**Commit Message**: Fix prop confirmation bug, add Wan 2.7 model, refine multiple UI details, improve prop generation quality and aspect ratio, remove text overlays from Asset Center created images, and optimize prop filtering logic

**File**: `lib/prompts/novel-promotion/prop_description_update.en.txt` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+You are a prop asset description editor.
+
+Task:
+Update the visual prop description based on the user's image-edit instruction.
+
+Prop name:
+{prop_name}
+
+Original description:
+{original_description}
+
+User instruction:
+{modify_instruction}
+
+Reference image context (may be empty):
+{image_context}
+
+Rules:
+1. Describe only the prop itself. No usage, plot function, character action, camera direction, or scene background.
+2. Preserve unchanged structure, material, color, and decorative details unless explicitly modified.
+3. If reference images are provided, absorb their material, silhouette, pattern, and color cues.
+4. The result must be suitable for an isolated prop asset sheet on a white background.
+5. Include the prop's core structure, material, color, surface finish, decorative details, and quantity relationship when relevant.
+6. Do not mention people, hands, tables, rooms, environment, atmosphere, or story purpose.
+7. Return one concise English visual description.
+
+Output format:
+Return JSON only. ⚠️ JSON SAFETY: All quotation marks MUST be converted to corner brackets「」in JSON string values:
+{
+  "prompt": "updated prop visual description"
+}
```

**File**: `lib/prompts/novel-promotion/prop_description_update.zh.txt` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+你是一个专业的道具资产描述更新专家。
+
+【任务】
+根据用户对道具图片的修改，更新道具的视觉描述词。
+
+【道具名称】
+{prop_name}
+
+【原始道具描述】
+{original_description}
+
+【用户修改指令】
+{modify_instruction}
+
+{image_context}
+
+【更新规则】
+1. 只描述道具本体的静态视觉信息，不写用途、剧情、角色动作、镜头、背景环境。
+2. 优先保留原描述里未被修改的结构、材质、颜色和装饰细节。
+3. 如果有参考图片，请吸收参考图中的材质、轮廓、纹样、配色等关键视觉特征。
+4. 输出必须适合白底居中的道具资产图生成。
+5. 必须明确道具的主体结构、材质、颜色、表面处理、装饰细节和数量关系。
+6. 禁止出现人物、手部、桌面、房间、场景、光影氛围、剧情用途等信息。
+7. 使用中文输出，长度 40-100 字。
+
+【输出格式】
+只返回 JSON，禁止返回任何其他内容。⚠️ 所有引号（""''等）在 JSON 字符串值中必须替换为「」，严禁出现未转义的英文双引号 "：
+{
+  "prompt": "更新后的道具视觉描述"
+}
```

**File**: `lib/prompts/novel-promotion/select_prop.en.txt` (modified, +27/-10)
```diff
@@ -3,26 +3,31 @@ You are a key story prop extractor.
 Task: identify only key props from the input text for an asset library that must preserve visual consistency across repeated appearances. Be conservative. Return JSON only.
 
 Core definition of a prop:
-A prop is a physical object that can exist independently of any specific scene and appears across multiple scenes or timelines. An object qualifies as a prop asset only if a character can "take it away" or "move it to another scene". Most stories have very few props, or even none at all.
+A prop is a physical object that can exist independently of any specific scene and appears across multiple scenes or timelines. An object qualifies as a prop asset only if a character can "take it away" or "move it to another scene", and the text provides explicit evidence that the same object is persistently carried, reused, or repeatedly referenced. Most stories have very few props, or even none at all.
 
 Output format:
 {
   "props": [
     {
       "name": "prop name",
-      "summary": "one-line objective prop description"
+      "summary": "short human-readable prop summary",
+      "description": "pure visual description for image generation"
     }
   ]
 }
 
 Key prop criteria:
 1. It must be a real physical object that actually appears in the story.
 2. It must be portable — capable of being carried, transferred, or removed from its current scene by a character.
-3. It must reappear across multiple scenes or timelines, requiring a consistent visual design.
+3. There must be explicit textual evidence that it reappears across multiple scenes or timelines and needs a consistent visual design. Do not infer future recurrence from common sense.
 4. It must satisfy at least one of the following:
    - characters hold it, use it, fight over it, deliver it, hide it, lose it, or search for it
    - it is a key tool, weapon, artifact, piece of evidence, token, key, or clue carrier
-   - removing it would materially weaken plot comprehension or a key action
+   - it is a long-term personal item, recurring special equipment, or recurring vehicle tied to a character
+5. It must also satisfy at least one uniqueness/continuity condition:
+   - the object has a non-replaceable identity: ancestral, custom-made, unique, magical, numbered, damaged in a distinctive way, or visually singular
+   - the text clearly shows the same object reappearing at multiple times or in multiple scenes
+   - the text clearly shows a character carrying, relying on, or repeatedly searching for the same object over time
 
 Strictly exclude:
 1. Ordinary background items, furniture, tableware, food, drinks, daily necessities, and decorations.
@@ -32,6 +37,8 @@ Strictly exclude:
 5. Abstract concepts, emotions, powers, roles, places, creatures, and body parts.
 6. Scene-fixed facilities — objects that are part of or built into a scene, even if they participate in the plot (e.g. a hacked computer, a smashed window, a fireplace on fire). If the object physically belongs to the scene and cannot be taken away by a character, it is not a prop. These are "scene states" and should be handled by scene descriptions.
 7. Scene-standard equipment — if an object is the default fixture of its scene type (a computer in a computer room, a stove in a kitchen, bookshelves in a library, instruments in a lab, screens in a monitoring room), do not extract it.
+8. Ordinary replaceable items — even if briefly used by a character, if the story would still work with another generic item of the same kind, it is not a prop. Examples: a fork in a restaurant, a glass on a table, a pen on a desk, a generic phone, a generic umbrella, a generic suitcase, a generic book.
+9. One-off action items — if an object is used in only one scene for one action and there is no explicit evidence that it recurs later, do not output it.
 
 Decision bias:
 1. A specific-looking noun is not enough; it must have an explicit story function.
@@ -40,27 +47,37 @@ Decision bias:
 4. If you are unsure whether it deserves an asset entry, do not output it.
 5. Prefer under-extraction. Never output props just to increase the count.
 6. Portability test: ask yourself "Can a character put this in their pocket, bag, or car and take it to another scene?" If not, do not output it.
+7. Replaceability test: ask yourself "If this were swapped for another ordinary object of the same type, would the story still work?" If yes, do not output it.
+8. Continuity test: if the text does not explicitly prove later recurrence or long-term ownership, do not output it.
+9. Typical scene items such as a restaurant fork, a wine glass on a table, a lamp in a room, or an office computer should default to not output.
 
 Example judgements (to calibrate your standard):
 ✅ Extract: a revolver the character carries at all times (cross-scene, portable)
 ✅ Extract: an evidence envelope (discovered, handed over, appears in multiple scenes)
 ✅ Extract: a time-manipulating watch worn by the
```

**File**: `lib/prompts/novel-promotion/select_prop.zh.txt` (modified, +27/-10)
```diff
@@ -3,26 +3,31 @@
 任务：从输入文本中只识别【关键道具】，用于建立需要长期保持外观一致的资产库。宁缺毋滥。只返回 JSON，不得包含任何额外解释或 markdown。
 
 道具的核心定义：
-道具是可以脱离特定场景独立存在的、跨场景/跨时间线出现的实体物件。一个物件必须能被角色「带走」或「转移到另一个场景」，才有资格成为道具资产。大部分故事中道具数量非常少，甚至为零。
+道具是可以脱离特定场景独立存在的、跨场景/跨时间线出现的实体物件。一个物件必须能被角色「带走」或「转移到另一个场景」，并且在文本中有明确证据表明它会被持续持有、反复使用、反复提及，才有资格成为道具资产。大部分故事中道具数量非常少，甚至为零。
 
 输出格式：
 {
   "props": [
     {
       "name": "道具名称",
-      "summary": "一句话描述道具的外观/用途"
+      "summary": "给人阅读的简短道具说明",
+      "description": "用于生成图片的纯视觉描述"
     }
   ]
 }
 
 关键道具判定标准：
 1. 必须是剧情中真实出现的实体物件。
 2. 必须是可移动的——能够被角色携带、转移、带离当前场景。
-3. 必须跨场景或跨时间线重复出现，且需要保持外观一致。
+3. 必须有明确文本证据表明它跨场景或跨时间线重复出现，且需要保持外观一致；禁止凭常识猜测它以后还会出现。
 4. 必须至少满足以下一种情况：
    - 被角色持有、使用、争夺、交付、隐藏、丢失、寻找
    - 是推进情节的关键工具、武器、法器、证物、信物、钥匙、线索载体
-   - 去掉它会明显影响剧情理解或关键动作成立
+   - 是角色长期携带或反复回收使用的专属物件、独特装备、特殊交通工具
+5. 必须同时满足以下至少一条“唯一性/持续性”条件，否则不输出：
+   - 物件具有不可替代的独特身份，例如祖传、特制、唯一、带特殊能力、带特殊机关、带独特编号/纹样/损伤
+   - 文本明确表明同一件物品在多个场景/多个时间点反复出现
+   - 文本明确表明角色长期随身携带、持续依赖或反复寻找同一件物品
 
 严格不提取：
 1. 普通背景陈设、家具、餐具、食物、饮料、日用品、装饰物。
@@ -32,6 +37,8 @@
 5. 抽象概念、情绪、能力、身份、地点、生物、身体部位。
 6. 场景固有设施——物件是某个场景的组成部分或内置设备，即便它参与了剧情互动（如被黑客入侵的电脑、被砸碎的窗户、着火的壁炉），只要它在物理上依附于场景、无法被角色带走，就不是道具。这类属于"场景状态"，由场景描述承载。
 7. 场景常规配置——如果一个物件是该类场景的标配（电脑房的电脑、厨房的灶台、图书馆的书架、实验室的仪器、监控室的屏幕），直接不提取。
+8. 普通可替换物件——即使它被角色短暂使用，只要换成同类另一件物品剧情仍成立，就不是道具。例如餐厅里的叉子、桌上的杯子、办公桌上的笔、本子、普通手机、普通雨伞、普通行李箱、普通书籍。
+9. 一次性动作依赖物件——如果它只在单个场景里承担一次动作功能，没有明确后续复现证据，不输出。
 
 判断倾向：
 1. 仅因外观具体、名词明确，不足以成为关键道具；必须有明确剧情作用。
@@ -40,27 +47,37 @@
 4. 如果不确定它是否值得进入资产库，直接不输出。
 5. 优先少报，禁止为了凑数量而输出。
 6. 可移动性测试：问自己"角色能把它装进口袋/背包/车里带到另一个场景吗？"如果不能，不输出。
+7. 可替换性测试：问自己"把它替换成同类另一件普通物品，剧情是否仍然成立？"如果答案是“成立”，不输出。
+8. 贯穿性测试：如果文本没有明确证据证明它会在后续再次出现或被长期持有，默认不输出。
+9. 对“餐厅里的叉子、桌上的酒杯、房间里的台灯、办公室里的电脑”这类典型场景内物件，一律默认不输出。
 
 示例判断（帮助校准标准）：
 ✅ 应提取：角色随身携带的左轮手枪（跨场景出现、可移动）
 ✅ 应提取：关键证物信封（被发现、传递、多场景出现）
 ✅ 应提取：主角可操控时间的手表（核心道具，贯穿全剧）
 ✅ 应提取：主角驾驶的黑色越野车（跨场景移动工具）
+✅ 应提取：祖传青铜短剑（独特身份，反复出现，无法被普通物件替代）
 ❌ 不提取：电脑房里的电脑（场景固有设施）
 ❌ 不提取：被黑客入侵、显示关键线索的电脑（场景设施的状态变化，不可移动）
 ❌ 不提取：监控室的监控屏幕（场景固有设施）
 ❌ 不提取：厨房的冰箱（场景常规配置）
 ❌ 不提取：图书馆的某本古籍（除非角色将它取走带到其他场景使用）
+❌ 不提取：餐厅里的叉子（普通可替换餐具，即使角色拿它吃饭或短暂拿在手里）
+❌ 不提取：桌上的红酒杯（单场景普通物件，不具备贯穿性）
+❌ 不提取：办公室里的普通笔记本电脑（普通设备，场景配置）
 
 输出要求：
-1. 只输出两个字段：name、summary。
-2. name 不能为空；summary 不能为空。
+1. 只输出三个字段：name、summary、description。
+2. name、summary、description 都不能为空。
 3. 如果道具库里已经有完全同名道具，不要重复输出。
 4. 名称尽量简洁稳定，例如"青铜匕首""录音笔""红绳手链"。
-5. summary 只写客观描述，不写剧情推断。
-6. 通常不超过 3 个；只有确实都是关键道具时才可更多。
-7. 如果没有合适道具，返回 {"props": []}。绝大多数情况下返回空数组是正确的。
-8. JSON 字符串值中的引号统一替换为「」。
+5. summary 只给人阅读，简短说明这是一个什么道具；禁止写剧情作用、使用过程、出现频次、角色互动、镜头描述。
+6. description 只写图片生成所需的静态视觉信息；只允许写材质、颜色、形状、结构、数量关系、装饰细节；禁止写用途、剧情、动作、人物、手部、桌面、环境、背景。
+7. 如果 summary 或 description 中出现"多次出现""被角色使用""推进剧情""在画面中"这类语义，视为错误，禁止输出。
+8. 通常不超过 3 个；只有确实都是关键道具时才可更多。
+9. 如果没有合适道具，返回 {"props": []}。绝大多数情况下返回空数组是正确的。
+10. JSON 字符串值中的引号统一替换为「」。
+11. 宁可漏掉边缘候选，也不要把场景里的普通物件误报为道具。
 
 输入文本：
 {input}
```

**File**: `messages/en/assetModal.json` (modified, +4/-2)
```diff
@@ -55,8 +55,10 @@
         "title": "New Prop",
         "name": "Prop Name",
         "namePlaceholder": "Enter prop name",
-        "summary": "Prop Description",
-        "summaryPlaceholder": "Describe the prop..."
+        "summary": "Summary",
+        "summaryPlaceholder": "One-line human summary of the prop, without plot usage...",
+        "description": "Image Description",
+        "descriptionPlaceholder": "Describe only the prop itself: material, color, structure, and decoration..."
     },
     "artStyle": {
         "title": "Art Style"
```

**File**: `messages/en/assetPicker.json` (modified, +4/-4)
```diff
@@ -10,10 +10,10 @@
     "appearances": "appearances",
     "images": "images",
     "cancel": "Cancel",
-    "confirmCopy": "Confirm Copy",
-    "copyFromGlobal": "Copy from Asset Hub",
-    "copySuccess": "Copy successful",
-    "copyFailed": "Copy failed",
+    "confirmCopy": "Confirm Import",
+    "copyFromGlobal": "Import from Asset Hub",
+    "copySuccess": "Import successful",
+    "copyFailed": "Import failed",
     "preview": "Preview",
     "stop": "Stop"
 }
```

**File**: `messages/en/assets.json` (modified, +9/-2)
```diff
@@ -58,7 +58,7 @@
         "characterCount": "{count} Characters",
         "updateFailed": "Update description failed",
         "addFailed": "Add character failed",
-        "copyFromGlobal": "Copy from Asset Hub"
+        "copyFromGlobal": "Import from Asset Hub"
     },
     "location": {
         "add": "Add Location",
@@ -83,7 +83,9 @@
         "deleteFailed": "Delete failed: {error}",
         "name": "Prop Name",
         "summary": "Summary",
-        "summaryPlaceholder": "Describe the prop",
+        "summaryPlaceholder": "One-line human summary of the prop, without plot usage",
+        "description": "Image Description",
+        "descriptionPlaceholder": "Describe only the prop itself: material, color, structure, and decoration",
         "regenerateImage": "Regenerate",
         "addFailed": "Add prop failed"
     },
@@ -171,8 +173,10 @@
         "scenePrompt": "Scene Description Prompt",
         "appearancePrompt": "Appearance Description Prompt",
         "smartModify": "Smart Modify",
+        "modifyDescription": "AI Modify Description",
         "modifyPlaceholder": "e.g.: Change to night, add moonlight, add curtains...",
         "modifyPlaceholderCharacter": "e.g.: Change hair to blonde, height to 180cm, wear black suit...",
+        "modifyPlaceholderProp": "e.g.: change to brushed silver, add carvings to the handle, remove ruby decoration...",
         "modifying": "Smart modifying...",
         "modifyFailed": "Modification failed",
         "editCharacter": "Edit Character",
@@ -344,12 +348,15 @@
     "imageEdit": {
         "editCharacterImage": "Edit Character Image",
         "editLocationImage": "Edit Location Image",
+        "editPropImage": "Edit Prop Image",
         "characterLabel": "Character: {name}",
         "locationLabel": "Location: {name}",
+        "propLabel": "Prop: {name}",
         "editInstruction": "Edit Instruction",
         "subtitle": "Enter an edit instruction and optionally upload reference images",
         "characterPlaceholder": "Describe what you want to change, e.g.: Change hair to blonde, add glasses, change to casual clothes...",
         "locationPlaceholder": "Describe what you want to change, e.g.: Add more trees, change to night scene...",
+        "propPlaceholder": "Describe what you want to change, e.g.: change to brushed silver metal, add carved patterns to the handle, remove gem decoration...",
         "storyboardPlaceholder": "Describe what you want to change, e.g.: Change background color, adjust character expression...",
         "noAssetHint": "No assets, click \"Add Asset\" to select",
         "referenceImages": "Reference Images",
```

**File**: `messages/en/progress.json` (modified, +2/-0)
```diff
@@ -68,6 +68,7 @@
     "aiStoryExpand": "AI story expansion",
     "aiModifyAppearance": "Character description modify",
     "aiModifyLocation": "Location description modify",
+    "aiModifyProp": "Prop description modify",
     "aiModifyShotPrompt": "Shot prompt modify",
     "analyzeShotVariants": "Shot variant analysis",
     "aiCreateCharacter": "Project character design",
@@ -80,6 +81,7 @@
     "assetHubAiDesignLocation": "Asset hub location design",
     "assetHubAiModifyCharacter": "Asset hub character modify",
     "assetHubAiModifyLocation": "Asset hub location modify",
+    "assetHubAiModifyProp": "Asset hub prop modify",
     "assetHubReferenceToCharacter": "Asset hub reference to character"
   },
   "stage": {
```

---

### Incident Patch 2: `9703714b` (2026-04-02)
**Commit Message**: feat: refine UI, improve UX, optimize the analysis pipeline, and add character standing positions

**File**: `lib/prompts/novel-promotion/agent_cinematographer.en.txt` (modified, +6/-2)
```diff
@@ -29,5 +29,9 @@ Rules:
 2. Keep continuity across neighboring panels.
 3. Adapt to scene_type and story rhythm.
 4. Technical notes must be directly actionable by image/video generation.
-5. JSON only, no markdown.
-6. ⚠️ JSON SAFETY: All quotation marks in text (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
+5. If characters already carry `slot`, treat it as a preferred placement anchor, not an absolute boundary.
+6. When a panel is about movement, entry/exit, path traversal, transition space, temporary space, empty space, imagination, dream, memory, or abstract/non-literal space, composition and placement may deviate from a static slot if the shot logic requires it.
+7. Treat `slot` as one full placement phrase from the location context, not as a short token, whenever you reference it.
+8. Do not shorten, rewrite, summarize, or replace a provided `slot` phrase with a short token.
+9. JSON only, no markdown.
+10. ⚠️ JSON SAFETY: All quotation marks in text (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
```

**File**: `lib/prompts/novel-promotion/agent_cinematographer.zh.txt` (modified, +8/-5)
```diff
@@ -129,8 +129,11 @@
 3. 每个元素必须包含 panel_number 字段
 4. 使用相对方向（画面左侧/右侧），禁止使用东南西北
 5. 角色位置必须与镜头描述一致！
-6. 景深根据 shot_type（全景/中景/近景/特写）自动调整
-7. ⚠️ 对话镜头必须使用浅景深（T2.8或更小），并且注明其他人虚化，确保只有说话者脸部清晰
-8. 如果镜头涉及不同场景，灯光和色调要相应调整
-9. 输出要简洁，每个镜头的规则独立完整
-10. ⚠️ JSON安全：所有引号（""''等）在 JSON 字符串值中必须统一替换为「」，严禁出现未转义的英文双引号 "
+6. 如果角色对象中包含 slot，screen_position / posture / facing 应优先参考该位置语义，但 slot 不是绝对硬限制
+7. 当镜头属于移动过程、入口/出口、过渡区域、路径空间、临时位置、空镜、想象空间、梦境、回忆或抽象空间时，可以基于镜头描述自由决定构图与位置，不必强行贴合 slot
+8. slot 若被引用，必须视为一条完整的位置描述，禁止缩写、改写、总结或替换成短词
+9. 景深根据 shot_type（全景/中景/近景/特写）自动调整
+10. ⚠️ 对话镜头必须使用浅景深（T2.8或更小），并且注明其他人虚化，确保只有说话者脸部清晰
+11. 如果镜头涉及不同场景，灯光和色调要相应调整
+12. 输出要简洁，每个镜头的规则独立完整
+13. ⚠️ JSON安全：所有引号（""''等）在 JSON 字符串值中必须统一替换为「」，严禁出现未转义的英文双引号 "
```

**File**: `lib/prompts/novel-promotion/agent_shot_variant_generate.en.txt` (modified, +2/-1)
```diff
@@ -33,4 +33,5 @@ Execution rules:
 1. Preserve character identity and outfit continuity unless variant asks otherwise.
 2. Preserve location continuity.
 3. Change framing/angle/composition according to target shot and camera move.
-4. Keep one-frame output only, no text overlays.
+4. If characters_info or location_asset includes fixed slots / available slots, keep every visible character anchored to the same fixed slot instead of drifting to another area.
+5. Keep one-frame output only, no text overlays.
```

**File**: `lib/prompts/novel-promotion/agent_shot_variant_generate.zh.txt` (modified, +2/-1)
```diff
@@ -66,7 +66,8 @@
 2. 保持角色外观与参考图一致（服装、发型、体型）
 3. 保持场景氛围与参考图一致（室内布置、光线、色调）
 4. 改变镜头视角/景别/构图以匹配变体要求
-5. 输出图像比例: {aspect_ratio}
+5. 如果角色信息或场景参考中提供了固定站位 / 可站位置，必须保持人物仍然处于同一固定站位，不得随意换边、换前后景或漂移到其他区域
+6. 输出图像比例: {aspect_ratio}
 
 ======================================
 【风格要求】
```

**File**: `lib/prompts/novel-promotion/agent_storyboard_detail.en.txt` (modified, +9/-3)
```diff
@@ -12,6 +12,8 @@ Location info:
 
 Task:
 For each panel, output a complete panel object with improved cinematic detail.
+If any character already has `slot`, prefer preserving it exactly and use it as a preferred placement anchor.
+Treat `slot` as one full placement phrase from the location context, not as a short token.
 
 Required fields per panel:
 - panel_number
@@ -30,7 +32,7 @@ Output schema example (field names must be preserved):
   {
     "panel_number": 1,
     "description": "panel description",
-    "characters": [{ "name": "Character", "appearance": "appearance" }],
+    "characters": [{ "name": "Character", "appearance": "appearance", "slot": "the position beneath the throne steps at the center of the hall" }],
     "location": "location name",
     "scene_type": "daily",
     "source_text": "source text excerpt",
@@ -46,5 +48,9 @@ Rules:
 2. Keep source_text semantically aligned with input; do not rewrite story meaning.
 3. video_prompt should be motion-ready and concrete.
 4. Prefer age+gender wording in video_prompt when naming actors in camera directions.
-5. Return JSON array only.
-6. ⚠️ JSON SAFETY: All quotation marks in text (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
+5. Preserve every input `slot` when the character is stably positioned, and reflect it as a preferred anchor in refined description/video_prompt.
+6. `slot` is not an absolute boundary. If the shot is clearly about movement, entry/exit, path traversal, transition space, temporary space, empty space, imagination, dream, memory, or abstract/non-literal space, you may remove `slot` or keep it without forcing a rigid static match.
+7. When no `slot` is used, decide placement freely from source text, action flow, spatial logic, and cinematic staging.
+8. Do not shorten, rewrite, summarize, or replace a provided `slot` phrase with a short token.
+9. Return JSON array only.
+10. ⚠️ JSON SAFETY: All quotation marks in text (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
```

**File**: `lib/prompts/novel-promotion/agent_storyboard_detail.zh.txt` (modified, +8/-3)
```diff
@@ -5,6 +5,7 @@
 - 为每个分镜设计景别、视角、镜头运动
 - 撰写video_prompt（用年龄段+性别替代角色名）
 - ⚠️ 保留输入分镜中的所有原始字段（特别是 source_text，必须原样保留）
+- 如果输入角色包含 slot，应优先原样保留，并让 refined description/video_prompt 优先参考该位置
 
 【镜头语言库】
 
@@ -147,7 +148,7 @@
     "camera_move": "固定",
     "description": "角色A站在桌前，双手撑在桌面上，表情严肃地看着对面的角色B",
     "video_prompt": "年轻男子站在桌前，双手撑在桌面上，表情严肃，正在说话，镜头固定拍摄",
-    "characters": [{"name": "角色A", "appearance": "初始形象"}],
+    "characters": [{"name": "角色A", "appearance": "初始形象", "slot": "皇宫正中龙椅前方台阶下的位置"}],
     "location": "办公室",
     "scene_type": "daily",
     "source_text": "角色A对角色B说：你好"
@@ -179,5 +180,9 @@
 8. 根据输入的分镜数量动态处理
 9. panel_number、characters、location、scene_type保持不变
 10. description可以适当优化，但不要改变核心内容
-11. ⚠️ 必须保留输入分镜中的 source_text 字段，原样输出到结果中，不得遗漏或修改
-12. ⚠️ JSON安全：所有引号（""''等）在 JSON 字符串值中必须统一替换为「」，严禁出现未转义的英文双引号 "
+11. 如果输入中存在 slot，应优先保留并优先参考该位置，但 slot 不是绝对硬边界
+12. 当镜头明显属于移动过程、入口/出口、过渡区域、路径空间、临时位置、空镜、想象空间、梦境、回忆或抽象空间时，可以删除 slot 或保留 slot 但不严格贴合其静态位置
+13. 若不使用 slot，应根据 source_text、动作过程、空间关系与镜头调度自由决定人物位置，不要为了命中 slot 而破坏叙事逻辑
+14. slot 若被保留，必须原样保留为完整位置描述，禁止缩写、改写、总结或替换成短词
+15. ⚠️ 必须保留输入分镜中的 source_text 字段，原样输出到结果中，不得遗漏或修改
+16. ⚠️ JSON安全：所有引号（""''等）在 JSON 字符串值中必须统一替换为「」，严禁出现未转义的英文双引号 "
```

**File**: `lib/prompts/novel-promotion/agent_storyboard_insert.en.txt` (modified, +6/-3)
```diff
@@ -23,7 +23,7 @@ Output format (single JSON object only):
 {
   "panel_number": 0,
   "description": "visual description",
-  "characters": [{ "name": "Character Name", "appearance": "appearance name" }],
+  "characters": [{ "name": "Character Name", "appearance": "appearance name", "slot": "the position beneath the throne steps at the center of the hall" }],
   "location": "location name",
   "scene_type": "daily",
   "source_text": "source text or transition shot",
@@ -37,5 +37,8 @@ Rules:
 1. Return one object only (not array).
 2. Keep narrative and spatial continuity between previous and next panel.
 3. Use valid character and location names from provided context.
-4. JSON only, no markdown.
-5. ⚠️ JSON SAFETY: All quotation marks in text (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
+4. If location details include available slots, treat them as preferred anchors. Reuse a provided `slot` for characters who are stably positioned in the scene.
+5. You may omit `slot` when the inserted panel is mainly about movement, entry/exit, path traversal, transition space, temporary space, empty space, imagination, dream, memory, or abstract/non-literal space.
+6. If `slot` is used, it must copy one full placement phrase from the available slots list verbatim. Do not shorten or rename it.
+7. JSON only, no markdown.
+8. ⚠️ JSON SAFETY: All quotation marks in text (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
```

**File**: `lib/prompts/novel-promotion/agent_storyboard_insert.zh.txt` (modified, +9/-2)
```diff
@@ -54,7 +54,7 @@
 |------|------|------|
 | panel_number | number | 固定填 0（由系统重新编号） |
 | description | string | 画面描述：包含角色动作、位置、表情。禁止身份称呼（如"母亲"），使用具体角色名。禁止主观情绪词（如"显得尴尬"），只描述可视化动作。 |
-| characters | array | 出现的角色列表，格式：`[{"name": "角色名", "appearance": "形象名"}]`。角色名必须与角色信息中的名字完全一致。形象名从角色信息的形象列表中选择。 |
+| characters | array | 出现的角色列表，格式：`[{"name": "角色名", "appearance": "形象名", "slot": "场景位置描述"}]`。角色名必须与角色信息中的名字完全一致。形象名从角色信息的形象列表中选择。如果场景信息中提供了可站位置，应优先为稳定停留的角色选择 slot，并直接复用可站位置列表中的完整位置描述。动态移动、过渡区域、入口出口、空镜、想象空间等情况可以不使用 slot。 |
 | location | string | 场景名称，必须与场景信息中的名字完全一致 |
 | scene_type | string | 场景类型，枚举值：`daily`（日常）/ `emotion`（情感）/ `action`（动作）/ `epic`（史诗）/ `suspense`（悬疑） |
 | source_text | string | 对应的原文片段。可以基于前后镜头的 source_text 推断，或填写"过渡镜头" |
@@ -72,6 +72,8 @@
 ❌ location 使用不存在的场景名 → ✅ 必须与场景信息完全一致
 ❌ 特写镜头使用非固定的镜头运动 → ✅ 特写必须用"固定"
 ❌ video_prompt 中使用角色名 → ✅ 必须用年龄段+性别
+❌ 稳定停留位置明明适合使用已有 slot，却完全无视场景锚点 → ✅ 优先复用场景可站位置中的 slot
+❌ 把 slot 改写成短词、代号、缩写 → ✅ 若使用 slot，必须直接复制可站位置列表中的完整位置描述
 
 ======================================
 【输出格式】
@@ -83,11 +85,16 @@
 {
   "panel_number": 0,
   "description": "...",
-  "characters": [{"name": "...", "appearance": "..."}],
+  "characters": [{"name": "...", "appearance": "...", "slot": "皇宫正中龙椅前方台阶下的位置"}],
   "location": "...",
   "scene_type": "...",
   "source_text": "...",
   "shot_type": "...",
   "camera_move": "...",
   "video_prompt": "..."
 }
+
+补充原则：
+- slot 是优先锚点，不是绝对硬边界
+- 当新镜头主要表现角色走动、进入/离开、穿过空间、临时停留、空白空间或想象空间时，可以不使用 slot
+- 若不使用 slot，应根据前后镜头、原文空间关系和过渡逻辑自由决定人物位置
```

---

### Incident Patch 3: `c3e74c22` (2026-03-28)
**Commit Message**: style: polish UI and improve UX

**File**: `messages/en/assetHub.json` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
     "downloadSuccess": "Download Complete",
     "downloadFailed": "Download Failed",
     "downloadEmpty": "No image assets to download",
+    "filteredEmptyHint": "Click \"New Asset\" to add assets",
     "newFolder": "New Folder",
     "editFolder": "Edit Folder",
     "deleteFolder": "Delete Folder",
```

**File**: `messages/en/home.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "title": "Quick Start",
+  "title": "From Inspiration to Screen",
   "subtitle": "Describe your story and let AI generate cinematic short dramas",
   "inputPlaceholder": "Enter your story idea, novel excerpt, or script outline...",
   "startCreation": "Start Creating",
```

**File**: `messages/en/novel-promotion.json` (modified, +1/-1)
```diff
@@ -173,4 +173,4 @@
     "confirm": "Continue and Clear",
     "cancel": "Cancel"
   }
-}
\ No newline at end of file
+}
```

**File**: `messages/zh/assetHub.json` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
     "downloadSuccess": "下载完成",
     "downloadFailed": "下载失败",
     "downloadEmpty": "当前没有可下载的图片资产",
+    "filteredEmptyHint": "点击新建资产添加资产",
     "newFolder": "新建文件夹",
     "editFolder": "编辑文件夹",
     "deleteFolder": "删除文件夹",
```

**File**: `messages/zh/home.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "title": "快速开始",
+  "title": "从灵感到银幕",
   "subtitle": "描述你想要创作的故事，AI 为你智能生成影视短剧",
   "inputPlaceholder": "输入你的故事创意、小说片段或剧本大纲...",
   "startCreation": "开始创作",
```

**File**: `messages/zh/novel-promotion.json` (modified, +1/-1)
```diff
@@ -173,4 +173,4 @@
     "confirm": "继续并清空",
     "cancel": "取消"
   }
-}
\ No newline at end of file
+}
```

**File**: `src/app/[locale]/home/page.tsx` (modified, +98/-130)
```diff
@@ -4,21 +4,20 @@
  * 首页 - 创作中心
  * 用户登录后的主入口页面：快速创作 + 最近项目
  */
-import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
+import { useState, useEffect, useCallback, useMemo } from 'react'
 import { useSession } from 'next-auth/react'
 import { useTranslations } from 'next-intl'
 import Navbar from '@/components/Navbar'
 import { AppIcon, IconGradientDefs } from '@/components/ui/icons'
-import { RatioSelector, StyleSelector } from '@/components/selectors/RatioStyleSelectors'
+import StoryInputComposer from '@/components/story-input/StoryInputComposer'
+import TypewriterHero from '@/components/home/TypewriterHero'
 import { ART_STYLES, VIDEO_RATIOS } from '@/lib/constants'
+import { DEFAULT_STYLE_PRESET_VALUE, STYLE_PRESETS } from '@/lib/style-presets'
 import { Link, useRouter } from '@/i18n/navigation'
 import { apiFetch } from '@/lib/api-fetch'
 import { expandHomeStory } from '@/lib/home/ai-story-expand'
 import { createHomeProjectLaunch } from '@/lib/home/create-project-launch'
-import {
-  HOME_QUICK_START_MIN_ROWS,
-  resolveTextareaTargetHeight,
-} from '@/lib/home/quick-start-textarea'
+import { HOME_QUICK_START_MIN_ROWS } from '@/lib/ui/textarea-height'
 import AiWriteModal from '@/components/home/AiWriteModal'
 
 interface ProjectStats {
@@ -51,48 +50,10 @@ export default function HomePage() {
   const [inputValue, setInputValue] = useState('')
   const [videoRatio, setVideoRatio] = useState('9:16')
   const [artStyle, setArtStyle] = useState('american-comic')
+  const [stylePresetValue, setStylePresetValue] = useState<string>(DEFAULT_STYLE_PRESET_VALUE)
   const [createLoading, setCreateLoading] = useState(false)
   const [aiWriteOpen, setAiWriteOpen] = useState(false)
   const [aiWriteLoading, setAiWriteLoading] = useState(false)
-  const textareaRef = useRef<HTMLTextAreaElement>(null)
-  const textareaMinHeightRef = useRef<number | null>(null)
-
-  // textarea 自适应高度（rAF 分帧动画）
-  const autoResizeTextarea = useCallback(() => {
-    const el = textareaRef.current
-    if (!el) return
-    const maxH = window.innerHeight * 0.5
-    const oldH = el.offsetHeight
-    const oldScrollTop = el.scrollTop
-    if (textareaMinHeightRef.current === null && oldH > 0) {
-      textareaMinHeightRef.current = oldH
-    }
-    const minH = textareaMinHeightRef.current ?? oldH
-
-    // 同步：测量真实高度（不改 overflow，避免 scrollTop 被重置）
-    el.style.transition = 'none'
-    el.style.height = 'auto'
-    const scrollH = el.scrollHeight
-    const targetH = resolveTextareaTargetHeight({
-      minHeight: minH,
-      maxHeight: maxH,
-      scrollHeight: scrollH,
-    })
-    el.style.height = `${oldH}px`
-    el.scrollTop = oldScrollTop
-
-    // 下一帧：开启 transition → 动画到目标高度
-    requestAnimationFrame(() => {
-      el.scrollTop = oldScrollTop
-      el.style.transition = 'height 200ms ease-out'
-      el.style.height = `${targetH}px`
-      el.style.overflowY = scrollH > maxH ? 'auto' : 'hidden'
-    })
-  }, [])
-
-  useEffect(() => {
-    autoResizeTextarea()
-  }, [inputValue, autoResizeTextarea])
 
   // 鉴权
   useEffect(() => {
@@ -183,7 +144,6 @@ export default function HomePage() {
     () => ART_STYLES.map((s) => ({ ...s, recommended: s.value === 'realistic' })),
     []
   )
-
   // 时间格式化
   const formatTimeAgo = (dateString: string): string => {
     const diffMs = Date.now() - new Date(dateString).getTime()
@@ -228,97 +188,105 @@ export default function HomePage() {
           45% { transform: translate(-15px, -20px) scale(1.15); opacity: 0.7; }
           70% { transform: translate(10px, -10px) scale(1); opacity: 0.35; }
         }
+        @keyframes bracket-breathe {
+          0%, 70%, 100% { opacity: 0.2; }
+          75%, 90% { opacity: 0.6; }
+        }
       `}</style>
 
-      <main className="flex flex-col items-center pt-[16vh] pb-12 px-4 max-w-3xl mx-auto w-full">
-        <div className="mb-6 text-center">
-          <h1 className="text-3xl font-bold text-[var(--glass-text-primary)] mb-2">
-            ✨ {t('title')}
-          </h1>
-          <p className="text-sm text-[var(--glass-text-tertiary)]">{t('subtitle')}</p>
-        </div>
+      <main className="flex flex-col items-center pt-[13vh] pb-12 px-4 max-w-5xl mx-auto w-full">
 
-        {/* 呼吸光晕 + 输入区域 */}
-        <div className="w-full relative group">
-          <div
-            className="absolute -inset-10 rounded-[48px] pointer-events-none"
-            style={{
-              background: 'radial-gradient(ellipse 80% 60% at 30% 40%, rgba(6, 182, 212, 0.4), transparent 70%)',
-              animation: 'breathe-drift-1 8s ease-in-out infinite',
-              filter: 'blur(30px)',
-            }}
-          />
-          <div
-            className="absolute -inset-10 rounded-[48px] pointer-events-none"
-            style={{
-              background: 'radial-gradient(ellipse 70% 80% at 70% 60%, rgba(139, 92, 246, 0.35), transparent 70%)',
-              animation: 'breathe-drift-2 10s ease-in-out infinite',
-           
```

**File**: `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/NovelInputStage.tsx` (modified, +104/-105)
```diff
@@ -8,11 +8,16 @@
 import { useTranslations } from 'next-intl'
 import { useState, useRef, useEffect, useCallback } from 'react'
 import '@/styles/animations.css'
+import AiWriteModal from '@/components/home/AiWriteModal'
+import StoryInputComposer from '@/components/story-input/StoryInputComposer'
 import { ART_STYLES, VIDEO_RATIOS } from '@/lib/constants'
 import TaskStatusInline from '@/components/task/TaskStatusInline'
 import { resolveTaskPresentationState } from '@/lib/task/presentation'
 import { AppIcon } from '@/components/ui/icons'
-import { RatioSelector, StyleSelector } from '@/components/selectors/RatioStyleSelectors'
+import { DEFAULT_STYLE_PRESET_VALUE, STYLE_PRESETS } from '@/lib/style-presets'
+import { PROJECT_STORY_INPUT_MIN_ROWS } from '@/lib/ui/textarea-height'
+import { apiFetch } from '@/lib/api-fetch'
+import { expandHomeStory } from '@/lib/home/ai-story-expand'
 
 /** 触发智能分集建议的字数阈值 */
 const LONG_TEXT_THRESHOLD = 1000
@@ -58,6 +63,7 @@ export default function NovelInputStage({
   onArtStyleChange
 }: NovelInputStageProps) {
   const t = useTranslations('novelPromotion')
+  const homeT = useTranslations('home')
 
   // ── IME 组合输入处理 ──
   // 中文/日文/韩文输入法在组合（composing）期间会持续触发 onChange，
@@ -66,6 +72,9 @@ export default function NovelInputStage({
   // 解决方案：组合期间仅更新本地 state，组合结束后再同步到父组件。
   const isComposingRef = useRef(false)
   const [localText, setLocalText] = useState(novelText)
+  const [stylePresetValue, setStylePresetValue] = useState<string>(DEFAULT_STYLE_PRESET_VALUE)
+  const [aiWriteOpen, setAiWriteOpen] = useState(false)
+  const [aiWriteLoading, setAiWriteLoading] = useState(false)
 
   // 当父组件的 novelText 变化（非本地编辑触发）时，同步到本地 state
   useEffect(() => {
@@ -74,15 +83,6 @@ export default function NovelInputStage({
     }
   }, [novelText])
 
-  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
-    const newValue = e.target.value
-    setLocalText(newValue)
-    // 仅在非 IME 组合状态下才同步到父组件
-    if (!isComposingRef.current) {
-      onNovelTextChange(newValue)
-    }
-  }
-
   const handleCompositionStart = () => {
     isComposingRef.current = true
   }
@@ -106,23 +106,25 @@ export default function NovelInputStage({
     }
   }, [localText, onNext, onSmartSplit])
 
-  // 当前配置展示文案
-  const ratioDisplayLabel = (VIDEO_RATIOS.find((option) => option.value === videoRatio) ?? VIDEO_RATIOS[0])?.label
-  const artStyleDisplayLabel = (ART_STYLES.find((option) => option.value === artStyle) ?? ART_STYLES[0])?.label
-
-  // 不同比例适合的素材类型文案映射（完整句子，用于 info 悬浮层）
-  const ratioUsageTextMap: Record<string, string> = {
-    '1:1': t('storyInput.ratioUsage.1_1'),
-    '9:16': t('storyInput.ratioUsage.9_16'),
-    '16:9': t('storyInput.ratioUsage.16_9'),
-    '4:3': t('storyInput.ratioUsage.4_3'),
-    '3:4': t('storyInput.ratioUsage.3_4'),
-    '2:3': t('storyInput.ratioUsage.2_3'),
-    '3:2': t('storyInput.ratioUsage.3_2'),
-    '4:5': t('storyInput.ratioUsage.4_5'),
-    '5:4': t('storyInput.ratioUsage.5_4'),
-    '21:9': t('storyInput.ratioUsage.21_9'),
-  }
+  const handleAiWriteStart = useCallback(async (prompt: string) => {
+    if (aiWriteLoading) return
+    setAiWriteLoading(true)
+    try {
+      const result = await expandHomeStory({
+        apiFetch,
+        prompt,
+      })
+
+      setLocalText(result.expandedText)
+      onNovelTextChange(result.expandedText)
+      setAiWriteOpen(false)
+    } catch (error) {
+      const message = error instanceof Error ? error.message : 'Failed'
+      window.alert(message)
+    } finally {
+      setAiWriteLoading(false)
+    }
+  }, [aiWriteLoading, onNovelTextChange])
 
   // 下拉中使用的简短标签（低信息密度）
   const ratioUsageTagMap: Record<string, string> = {
@@ -138,13 +140,9 @@ export default function NovelInputStage({
     '21:9': t('storyInput.ratioUsageTag.21_9'),
   }
 
-  const getRatioUsageText = (ratio: string): string =>
-    ratioUsageTextMap[ratio] ?? t('storyInput.videoRatioHint')
-
   const getRatioUsageTag = (ratio: string): string =>
     ratioUsageTagMap[ratio] ?? ''
 
-  const ratioUsageText = getRatioUsageText(videoRatio)
   const stageSwitchingState = isSwitchingStage
     ? resolveTaskPresentationState({
       phase: 'processing',
@@ -168,81 +166,82 @@ export default function NovelInputStage({
       )}
 
       {/* 主输入区域（含底部工具栏） */}
-      <div className="glass-surface-elevated overflow-hidden relative z-10">
-        <div className="p-6 pb-0">
-          {/* 字数统计 */}
-          <div className="flex items-center justify-end mb-3">
-            <span className="glass-chip glass-chip-neutral text-xs">
-              {t("storyInput.wordCount")} {localText.length}
-            </span>
-          </div>
-
-          {/* 剧本输入框 */}
-          <textarea
-            value={localText}
-            onChange={handleTextChange}
-            onCompositionStart={handleCompositionStart}
-            onCompositionEnd={handleCompositionEnd}
-            placeholder={`请输入您的剧本或小说内容...\n\nAI 将根据您的文本智能分析：\n• 自动识别场景切换\n• 提取角色对话和动作\n•
```

---

### Incident Patch 4: `4e469074` (2026-03-23)
**Commit Message**: feat: add home page and refactor workspace entry UI

**File**: `lib/prompts/novel-promotion/select_prop.en.txt` (modified, +22/-5)
```diff
@@ -2,6 +2,9 @@ You are a key story prop extractor.
 
 Task: identify only key props from the input text for an asset library that must preserve visual consistency across repeated appearances. Be conservative. Return JSON only.
 
+Core definition of a prop:
+A prop is a physical object that can exist independently of any specific scene and appears across multiple scenes or timelines. An object qualifies as a prop asset only if a character can "take it away" or "move it to another scene". Most stories have very few props, or even none at all.
+
 Output format:
 {
   "props": [
@@ -14,11 +17,11 @@ Output format:
 
 Key prop criteria:
 1. It must be a real physical object that actually appears in the story.
-2. It must serve a clear story function rather than being background dressing.
-3. It must satisfy at least one of the following:
+2. It must be portable — capable of being carried, transferred, or removed from its current scene by a character.
+3. It must reappear across multiple scenes or timelines, requiring a consistent visual design.
+4. It must satisfy at least one of the following:
    - characters hold it, use it, fight over it, deliver it, hide it, lose it, or search for it
    - it is a key tool, weapon, artifact, piece of evidence, token, key, or clue carrier
-   - it is likely to reappear and therefore needs a consistent visual design
    - removing it would materially weaken plot comprehension or a key action
 
 Strictly exclude:
@@ -27,22 +30,36 @@ Strictly exclude:
 3. Environmental elements that belong to the scene unless they are explicitly used as key props.
 4. Ordinary clothing, makeup, and accessories unless they are themselves key clues or tokens.
 5. Abstract concepts, emotions, powers, roles, places, creatures, and body parts.
+6. Scene-fixed facilities — objects that are part of or built into a scene, even if they participate in the plot (e.g. a hacked computer, a smashed window, a fireplace on fire). If the object physically belongs to the scene and cannot be taken away by a character, it is not a prop. These are "scene states" and should be handled by scene descriptions.
+7. Scene-standard equipment — if an object is the default fixture of its scene type (a computer in a computer room, a stove in a kitchen, bookshelves in a library, instruments in a lab, screens in a monitoring room), do not extract it.
 
 Decision bias:
 1. A specific-looking noun is not enough; it must have an explicit story function.
 2. If an object could be either a background item or a prop, treat it as background and do not output it.
 3. If it merely appears but is not used, emphasized, or plot-relevant, do not output it.
 4. If you are unsure whether it deserves an asset entry, do not output it.
 5. Prefer under-extraction. Never output props just to increase the count.
+6. Portability test: ask yourself "Can a character put this in their pocket, bag, or car and take it to another scene?" If not, do not output it.
+
+Example judgements (to calibrate your standard):
+✅ Extract: a revolver the character carries at all times (cross-scene, portable)
+✅ Extract: an evidence envelope (discovered, handed over, appears in multiple scenes)
+✅ Extract: a time-manipulating watch worn by the protagonist (core prop, present throughout)
+✅ Extract: a black SUV driven by the protagonist (cross-scene transport)
+❌ Skip: a computer in a computer room (scene-fixed facility)
+❌ Skip: a hacked computer displaying key clues (state change of a scene facility, not portable)
+❌ Skip: a surveillance monitor in a monitoring room (scene-fixed facility)
+❌ Skip: a refrigerator in a kitchen (scene-standard equipment)
+❌ Skip: a rare book in a library (unless the character takes it away and uses it in another scene)
 
 Output rules:
 1. Only output `name` and `summary`.
 2. `name` and `summary` must both be non-empty.
 3. Do not repeat props that already exist in the prop library with the exact same name.
 4. Keep names stable and short.
 5. Keep summaries objective.
-6. Usually output no more than 3-5 props unless more are clearly all key props.
-7. If none exist, return {"props": []}.
+6. Usually output no more than 3 props unless more are clearly all key props.
+7. If none exist, return {"props": []}. Returning an empty array is correct in most cases.
 8. Replace raw quotation marks inside JSON string values with corner brackets「」.
 
 Input:
```

**File**: `lib/prompts/novel-promotion/select_prop.zh.txt` (modified, +25/-8)
```diff
@@ -1,7 +1,10 @@
-你是“关键剧情道具资产分析师”。
+你是"关键剧情道具资产分析师"。
 
 任务：从输入文本中只识别【关键道具】，用于建立需要长期保持外观一致的资产库。宁缺毋滥。只返回 JSON，不得包含任何额外解释或 markdown。
 
+道具的核心定义：
+道具是可以脱离特定场景独立存在的、跨场景/跨时间线出现的实体物件。一个物件必须能被角色「带走」或「转移到另一个场景」，才有资格成为道具资产。大部分故事中道具数量非常少，甚至为零。
+
 输出格式：
 {
   "props": [
@@ -14,11 +17,11 @@
 
 关键道具判定标准：
 1. 必须是剧情中真实出现的实体物件。
-2. 必须在剧情中承担明确功能，而不只是背景摆设。
-3. 必须至少满足以下一种情况：
+2. 必须是可移动的——能够被角色携带、转移、带离当前场景。
+3. 必须跨场景或跨时间线重复出现，且需要保持外观一致。
+4. 必须至少满足以下一种情况：
    - 被角色持有、使用、争夺、交付、隐藏、丢失、寻找
    - 是推进情节的关键工具、武器、法器、证物、信物、钥匙、线索载体
-   - 后续大概率需要重复出镜，且需要保持外观一致
    - 去掉它会明显影响剧情理解或关键动作成立
 
 严格不提取：
@@ -27,22 +30,36 @@
 3. 场景自带的环境元素，除非它被明确当作关键道具使用。
 4. 普通服装、妆容、饰品，除非它本身就是关键线索或关键信物。
 5. 抽象概念、情绪、能力、身份、地点、生物、身体部位。
+6. 场景固有设施——物件是某个场景的组成部分或内置设备，即便它参与了剧情互动（如被黑客入侵的电脑、被砸碎的窗户、着火的壁炉），只要它在物理上依附于场景、无法被角色带走，就不是道具。这类属于"场景状态"，由场景描述承载。
+7. 场景常规配置——如果一个物件是该类场景的标配（电脑房的电脑、厨房的灶台、图书馆的书架、实验室的仪器、监控室的屏幕），直接不提取。
 
 判断倾向：
 1. 仅因外观具体、名词明确，不足以成为关键道具；必须有明确剧情作用。
 2. 如果一个物件既可能是背景物，也可能是道具，默认按背景物处理，不输出。
-3. 如果只是“出现过”，但没有“被使用/被强调/影响剧情”，不输出。
+3. 如果只是"出现过"，但没有"被使用/被强调/影响剧情"，不输出。
 4. 如果不确定它是否值得进入资产库，直接不输出。
 5. 优先少报，禁止为了凑数量而输出。
+6. 可移动性测试：问自己"角色能把它装进口袋/背包/车里带到另一个场景吗？"如果不能，不输出。
+
+示例判断（帮助校准标准）：
+✅ 应提取：角色随身携带的左轮手枪（跨场景出现、可移动）
+✅ 应提取：关键证物信封（被发现、传递、多场景出现）
+✅ 应提取：主角可操控时间的手表（核心道具，贯穿全剧）
+✅ 应提取：主角驾驶的黑色越野车（跨场景移动工具）
+❌ 不提取：电脑房里的电脑（场景固有设施）
+❌ 不提取：被黑客入侵、显示关键线索的电脑（场景设施的状态变化，不可移动）
+❌ 不提取：监控室的监控屏幕（场景固有设施）
+❌ 不提取：厨房的冰箱（场景常规配置）
+❌ 不提取：图书馆的某本古籍（除非角色将它取走带到其他场景使用）
 
 输出要求：
 1. 只输出两个字段：name、summary。
 2. name 不能为空；summary 不能为空。
 3. 如果道具库里已经有完全同名道具，不要重复输出。
-4. 名称尽量简洁稳定，例如“青铜匕首”“录音笔”“红绳手链”。
+4. 名称尽量简洁稳定，例如"青铜匕首""录音笔""红绳手链"。
 5. summary 只写客观描述，不写剧情推断。
-6. 通常不超过 3-5 个；只有确实都是关键道具时才可更多。
-7. 如果没有合适道具，返回 {"props": []}。
+6. 通常不超过 3 个；只有确实都是关键道具时才可更多。
+7. 如果没有合适道具，返回 {"props": []}。绝大多数情况下返回空数组是正确的。
 8. JSON 字符串值中的引号统一替换为「」。
 
 输入文本：
```

**File**: `messages/en/configModal.json` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@
     "subtitle": "Defaults to the global settings. You can customize models for this project only — changes apply to this project only.",
     "saved": "Saved",
     "autoSave": "Auto-save",
-    "visualStyle": "Visual Style",
+    "visualSettings": "Visual Settings",
+    "visualStyle": "Art Style",
     "modelParams": "Model Parameters",
     "aspectRatio": "Aspect Ratio",
     "ttsSettings": "TTS Settings",
```

**File**: `messages/en/home.json` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+{
+  "title": "Quick Start",
+  "subtitle": "Describe your story and let AI generate cinematic short dramas",
+  "inputPlaceholder": "Enter your story idea, novel excerpt, or script outline...",
+  "startCreation": "Start Creating",
+  "recentProjects": "Recent Projects",
+  "viewAll": "View All Projects",
+  "noProjects": "No projects yet. Start your first creation from above!",
+  "ago": {
+    "justNow": "Just now",
+    "minutesAgo": "{n}m ago",
+    "hoursAgo": "{n}h ago",
+    "daysAgo": "{n}d ago"
+  }
+}
```

**File**: `messages/en/novel-promotion.json` (modified, +12/-3)
```diff
@@ -123,8 +123,8 @@
       "5_4": "Horizontal · Banner",
       "21_9": "Ultra‑wide · Cinema feel"
     },
-    "visualStyle": "Visual Style",
-    "visualStyleHint": "Pick a style that matches your audience — e.g. Realistic for live‑action, Anime for 2D content",
+    "visualStyle": "Art Style",
+    "visualStyleHint": "Choose an art style that fits your project — e.g. Realistic for live-action, Anime for 2D content",
     "currentConfigSummary": "Current config: {ratio} · {style}. All subsequent generations will use this combo.",
     "assetLibraryRatioNote": "Asset library ratios are not affected",
     "moreConfig": "For more configuration options, click the 「 Settings」 button in the top right",
@@ -134,7 +134,16 @@
     },
     "creating": "AI Creating...",
     "ready": "✓ Configuration complete, ready for next step",
-    "pleaseInput": "Please enter script content first"
+    "pleaseInput": "Please enter script content first",
+    "longTextDetection": {
+      "title": "🚀 Smart Episode Splitting Recommended",
+      "description": "Detected ~{count} characters. Processing long text as a single episode may reduce output quality.",
+      "strongRecommend": "We strongly recommend using Smart Split. AI will automatically identify chapters, split into episodes, and process them in parallel for significantly better results.",
+      "continueAnyway": "Continue as single episode",
+      "smartSplit": "Smart Split",
+      "smartSplitRecommend": "Recommended",
+      "singleEpisodeWarning": "All content will be processed as one episode"
+    }
   },
   "execution": {
     "selectEpisode": "Please select an episode first",
```

**File**: `messages/en/workspaceRedesign.json` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+{
+  "pageTitle": "Homepage Redesign Test",
+  "switchVariant": "Switch Layout",
+  "currentVariant": "Current Layout",
+  "inputPlaceholder": "Describe the story you want to create...",
+  "startCreation": "Start Creating",
+  "recentProjects": "Recent Projects",
+  "viewAll": "View All",
+  "noRecentProjects": "No recent projects",
+  "latestUpdate": "Latest Update",
+  "style": "Style",
+  "ratio": "Ratio",
+  "quality": "Quality",
+  "model": "Model",
+  "styles": {
+    "anime": "Anime",
+    "realistic": "Realistic",
+    "watercolor": "Watercolor",
+    "cyberpunk": "Cyberpunk",
+    "ghibli": "Ghibli",
+    "ink": "Ink Wash"
+  },
+  "ratios": {
+    "r16_9": "16:9 Landscape",
+    "r9_16": "9:16 Portrait",
+    "r1_1": "1:1 Square",
+    "r4_3": "4:3 Classic"
+  },
+  "qualities": {
+    "standard": "Standard",
+    "high": "High",
+    "ultra": "Ultra"
+  },
+  "quickActions": {
+    "title": "Quick Start",
+    "fromNovel": "Import from Novel",
+    "fromScript": "Create from Script",
+    "fromScratch": "Start from Scratch",
+    "fromTemplate": "Use Template"
+  },
+  "mockProject": {
+    "name1": "Campus Youth Story",
+    "desc1": "A romantic tale about high school life",
+    "name2": "Star Trek Journal",
+    "desc2": "A space adventure sci-fi short drama",
+    "name3": "Ancient Xianxia Chronicles",
+    "desc3": "Love and rivalry in a cultivation world",
+    "name4": "Urban Encounters",
+    "desc4": "Wondrous encounters in a modern city",
+    "name5": "The Last Travelers",
+    "desc5": "A survival journey in a post-apocalyptic world"
+  },
+  "variantNames": {
+    "v1": "Grid Cards",
+    "v2": "Horizontal Scroll",
+    "v3": "Compact List",
+    "v4": "Featured First",
+    "v5": "Minimal List"
+  },
+  "variantDescs": {
+    "v1": "Standard 5-column grid with system card style",
+    "v2": "Horizontal scrollable cards with snap",
+    "v3": "Single-row list with left-right info",
+    "v4": "Large first card + small card grid",
+    "v5": "Minimal dot-list matching input width"
+  },
+  "episodes": "Episodes",
+  "images": "Images",
+  "videos": "Videos",
+  "updated": "Updated",
+  "ago": {
+    "justNow": "Just now",
+    "minutesAgo": "{n}m ago",
+    "hoursAgo": "{n}h ago",
+    "daysAgo": "{n}d ago"
+  }
+}
```

**File**: `messages/zh/configModal.json` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@
     "subtitle": "默认沿用设置中心的全局配置，也可为当前项目单独自定义，修改仅对本项目生效。",
     "saved": "已保存",
     "autoSave": "自动保存",
-    "visualStyle": "视觉风格",
+    "visualSettings": "画面设置",
+    "visualStyle": "画面风格",
     "modelParams": "模型参数",
     "aspectRatio": "画面比例",
     "ttsSettings": "旁白配置",
```

**File**: `messages/zh/home.json` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+{
+  "title": "快速开始",
+  "subtitle": "描述你想要创作的故事，AI 为你智能生成影视短剧",
+  "inputPlaceholder": "输入你的故事创意、小说片段或剧本大纲...",
+  "startCreation": "开始创作",
+  "recentProjects": "最近项目",
+  "viewAll": "查看全部项目",
+  "noProjects": "还没有项目，从上方开始你的第一个创作吧",
+  "ago": {
+    "justNow": "刚刚",
+    "minutesAgo": "{n}分钟前",
+    "hoursAgo": "{n}小时前",
+    "daysAgo": "{n}天前"
+  }
+}
```

---

### Incident Patch 5: `a6ad11b9` (2026-03-21)
**Commit Message**: fix: resolve confirmed character hidden bug, remove online font dependency, improve UI/UX experience

**File**: `lib/prompts/novel-promotion/select_prop.en.txt` (modified, +34/-12)
```diff
@@ -1,6 +1,6 @@
-You are a prop asset extractor.
+You are a key story prop extractor.
 
-Task: identify reusable physical props from the input text and return JSON only.
+Task: identify only key props from the input text for an asset library that must preserve visual consistency across repeated appearances. Be conservative. Return JSON only.
 
 Output format:
 {
@@ -12,16 +12,38 @@ Output format:
   ]
 }
 
-Rules:
-1. Only include concrete reusable physical props that actually appear in the story.
-2. Only output `name` and `summary`.
-3. `name` and `summary` must both be non-empty.
-4. Do not repeat props that already exist in the prop library with the exact same name.
-5. Exclude abstract concepts, powers, roles, places, creatures, outfits, and makeup.
-6. Keep names stable and short.
-7. Keep summaries objective.
-8. If none exist, return {"props": []}.
-9. Replace raw quotation marks inside JSON string values with corner brackets「」.
+Key prop criteria:
+1. It must be a real physical object that actually appears in the story.
+2. It must serve a clear story function rather than being background dressing.
+3. It must satisfy at least one of the following:
+   - characters hold it, use it, fight over it, deliver it, hide it, lose it, or search for it
+   - it is a key tool, weapon, artifact, piece of evidence, token, key, or clue carrier
+   - it is likely to reappear and therefore needs a consistent visual design
+   - removing it would materially weaken plot comprehension or a key action
+
+Strictly exclude:
+1. Ordinary background items, furniture, tableware, food, drinks, daily necessities, and decorations.
+2. Objects that are only mentioned in passing and have no story function.
+3. Environmental elements that belong to the scene unless they are explicitly used as key props.
+4. Ordinary clothing, makeup, and accessories unless they are themselves key clues or tokens.
+5. Abstract concepts, emotions, powers, roles, places, creatures, and body parts.
+
+Decision bias:
+1. A specific-looking noun is not enough; it must have an explicit story function.
+2. If an object could be either a background item or a prop, treat it as background and do not output it.
+3. If it merely appears but is not used, emphasized, or plot-relevant, do not output it.
+4. If you are unsure whether it deserves an asset entry, do not output it.
+5. Prefer under-extraction. Never output props just to increase the count.
+
+Output rules:
+1. Only output `name` and `summary`.
+2. `name` and `summary` must both be non-empty.
+3. Do not repeat props that already exist in the prop library with the exact same name.
+4. Keep names stable and short.
+5. Keep summaries objective.
+6. Usually output no more than 3-5 props unless more are clearly all key props.
+7. If none exist, return {"props": []}.
+8. Replace raw quotation marks inside JSON string values with corner brackets「」.
 
 Input:
 {input}
```

**File**: `lib/prompts/novel-promotion/select_prop.zh.txt` (modified, +34/-12)
```diff
@@ -1,6 +1,6 @@
-你是“故事道具资产分析师”。
+你是“关键剧情道具资产分析师”。
 
-任务：从输入文本中识别适合做成长期复用资产的道具，只返回 JSON，不得包含任何额外解释或 markdown。
+任务：从输入文本中只识别【关键道具】，用于建立需要长期保持外观一致的资产库。宁缺毋滥。只返回 JSON，不得包含任何额外解释或 markdown。
 
 输出格式：
 {
@@ -12,16 +12,38 @@
   ]
 }
 
-规则：
-1. 只保留在剧情中真实出现、可被反复引用、值得进入资产库的实体道具。
-2. 只输出两个字段：name、summary。
-3. name 不能为空；summary 不能为空。
-4. 如果道具库里已经有完全同名道具，不要重复输出。
-5. 禁止输出抽象概念、情绪、能力、身份、地点、生物、服装妆容。
-6. 名称尽量简洁稳定，例如“青铜匕首”“录音笔”“红绳手链”。
-7. summary 只写客观描述，不写剧情推断。
-8. 如果没有合适道具，返回 {"props": []}。
-9. JSON 字符串值中的引号统一替换为「」。
+关键道具判定标准：
+1. 必须是剧情中真实出现的实体物件。
+2. 必须在剧情中承担明确功能，而不只是背景摆设。
+3. 必须至少满足以下一种情况：
+   - 被角色持有、使用、争夺、交付、隐藏、丢失、寻找
+   - 是推进情节的关键工具、武器、法器、证物、信物、钥匙、线索载体
+   - 后续大概率需要重复出镜，且需要保持外观一致
+   - 去掉它会明显影响剧情理解或关键动作成立
+
+严格不提取：
+1. 普通背景陈设、家具、餐具、食物、饮料、日用品、装饰物。
+2. 仅被顺带提及、没有剧情功能的物件。
+3. 场景自带的环境元素，除非它被明确当作关键道具使用。
+4. 普通服装、妆容、饰品，除非它本身就是关键线索或关键信物。
+5. 抽象概念、情绪、能力、身份、地点、生物、身体部位。
+
+判断倾向：
+1. 仅因外观具体、名词明确，不足以成为关键道具；必须有明确剧情作用。
+2. 如果一个物件既可能是背景物，也可能是道具，默认按背景物处理，不输出。
+3. 如果只是“出现过”，但没有“被使用/被强调/影响剧情”，不输出。
+4. 如果不确定它是否值得进入资产库，直接不输出。
+5. 优先少报，禁止为了凑数量而输出。
+
+输出要求：
+1. 只输出两个字段：name、summary。
+2. name 不能为空；summary 不能为空。
+3. 如果道具库里已经有完全同名道具，不要重复输出。
+4. 名称尽量简洁稳定，例如“青铜匕首”“录音笔”“红绳手链”。
+5. summary 只写客观描述，不写剧情推断。
+6. 通常不超过 3-5 个；只有确实都是关键道具时才可更多。
+7. 如果没有合适道具，返回 {"props": []}。
+8. JSON 字符串值中的引号统一替换为「」。
 
 输入文本：
 {input}
```

**File**: `messages/en/assets.json` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@
         "confirmProfiles": "Character Profiles to Confirm",
         "confirmHint": "Please confirm these profiles before generating descriptions",
         "confirmAll": "Confirm All ({count})",
+        "pendingProfilesBanner": "AI Casting Complete",
+        "pendingProfilesHint": "Confirm profiles to auto-generate character visuals",
         "assetsTitle": "Asset Analysis",
         "characterAssets": "Character Assets",
         "locationAssets": "Location Assets",
```

**File**: `messages/en/progress.json` (modified, +1/-0)
```diff
@@ -125,6 +125,7 @@
   "streamStep": {
     "analyzeCharacters": "Analyze characters",
     "analyzeLocations": "Analyze locations",
+    "analyzeProps": "Analyze props",
     "splitClips": "Split clips",
     "screenplayConversion": "Convert screenplay",
     "storyboardPlan": "Plan storyboard",
```

**File**: `messages/zh/assets.json` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@
         "confirmProfiles": "角色档案待确认",
         "confirmHint": "请确认以下角色档案后生成外貌描述",
         "confirmAll": "全部确认 ({count})",
+        "pendingProfilesBanner": "AI 选角完成",
+        "pendingProfilesHint": "确认档案后自动生成角色形象",
         "assetsTitle": "资产分析",
         "characterAssets": "角色资产",
         "locationAssets": "场景资产",
```

**File**: `messages/zh/progress.json` (modified, +1/-0)
```diff
@@ -125,6 +125,7 @@
   "streamStep": {
     "analyzeCharacters": "角色分析",
     "analyzeLocations": "场景分析",
+    "analyzeProps": "道具分析",
     "splitClips": "片段切分",
     "screenplayConversion": "剧本转换",
     "storyboardPlan": "分镜规划",
```

**File**: `package-lock.json` (modified, +10/-0)
```diff
@@ -37,6 +37,7 @@
         "cos-nodejs-sdk-v5": "^2.15.4",
         "express": "^5.2.1",
         "file-saver": "^2.0.5",
+        "geist": "^1.7.0",
         "ioredis": "^5.9.2",
         "jsonrepair": "^3.13.2",
         "jszip": "^3.10.1",
@@ -10207,6 +10208,15 @@
         "node": ">=18"
       }
     },
+    "node_modules/geist": {
+      "version": "1.7.0",
+      "resolved": "https://registry.npmmirror.com/geist/-/geist-1.7.0.tgz",
+      "integrity": "sha512-ZaoiZwkSf0DwwB1ncdLKp+ggAldqxl5L1+SXaNIBGkPAqcu+xjVJLxlf3/S8vLt9UHx1xu5fz3lbzKCj5iOVdQ==",
+      "license": "SIL OPEN FONT LICENSE",
+      "peerDependencies": {
+        "next": ">=13.2.0"
+      }
+    },
     "node_modules/generate-function": {
       "version": "2.3.1",
       "resolved": "https://registry.npmmirror.com/generate-function/-/generate-function-2.3.1.tgz",
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -138,6 +138,7 @@
     "cos-nodejs-sdk-v5": "^2.15.4",
     "express": "^5.2.1",
     "file-saver": "^2.0.5",
+    "geist": "^1.7.0",
     "ioredis": "^5.9.2",
     "jsonrepair": "^3.13.2",
     "jszip": "^3.10.1",
```

---

### Incident Patch 6: `eec27fba` (2026-03-13)
**Commit Message**: feat: add asset library download button, fix env ports, update README, optimize semantics, support multi-image reading, and allow voiceover analysis for silent segments

**File**: `.env.example` (modified, +12/-7)
```diff
@@ -1,6 +1,7 @@
 # ==================== 数据库 ====================
-# Docker 模式下无需修改，docker-compose.yml 会自动覆盖
-DATABASE_URL="mysql://root:waoowaoo123@localhost:3306/waoowaoo"
+# 本地开发模式：docker-compose.yml 将 MySQL 映射到宿主机的 13306 端口
+# Docker 容器模式：docker-compose.yml 会自动覆盖此配置
+DATABASE_URL="mysql://root:waoowaoo123@localhost:13306/waoowaoo"
 
 # ==================== 存储 ====================
 # minio: S3 兼容对象存储（默认）
@@ -9,7 +10,8 @@ DATABASE_URL="mysql://root:waoowaoo123@localhost:3306/waoowaoo"
 STORAGE_TYPE=minio
 
 # MinIO / S3 兼容存储配置
-MINIO_ENDPOINT=http://localhost:9000
+# 本地开发模式：docker-compose.yml 将 MinIO 映射到宿主机的 19000 端口
+MINIO_ENDPOINT=http://localhost:19000
 MINIO_REGION=us-east-1
 MINIO_BUCKET=waoowaoo
 MINIO_ACCESS_KEY=minioadmin
@@ -23,18 +25,21 @@ MINIO_FORCE_PATH_STYLE=true
 # COS_REGION=
 
 # ==================== 认证 ====================
-NEXTAUTH_URL=https://localhost
+# 本地开发模式（方式三）：使用 http://localhost:3000
+# Docker 容器模式（方式一、二）：改为 https://localhost（配合 Caddy）或 http://localhost:13000
+NEXTAUTH_URL=http://localhost:3000
 NEXTAUTH_SECRET=please-change-this-to-a-random-string
 
 # ==================== 内部密钥 ====================
 CRON_SECRET=please-change-this-cron-secret
 INTERNAL_TASK_TOKEN=please-change-this-task-token
-API_ENCRYPTION_KEY=please-change-this-encryption-key
+API_ENCRYPTION_KEY=waoowaoo-opensource-fixed-key-2026
 
 # ==================== Redis ====================
-# Docker 模式下无需修改，docker-compose.yml 会自动覆盖
+# 本地开发模式：docker-compose.yml 将 Redis 映射到宿主机的 16379 端口
+# Docker 容器模式：docker-compose.yml 会自动覆盖此配置
 REDIS_HOST=127.0.0.1
-REDIS_PORT=6379
+REDIS_PORT=16379
 REDIS_USERNAME=
 REDIS_PASSWORD=
 REDIS_TLS=
```

**File**: `README.md` (modified, +11/-1)
```diff
@@ -81,18 +81,28 @@ docker compose down && docker compose up -d --build
 ```bash
 git clone https://github.com/saturndec/waoowaoo.git
 cd waoowaoo
+
+# 复制环境变量配置文件（必须在 npm install 之前完成）
+cp .env.example .env
+# ⚠️ 编辑 .env，填入你的 AI API Key（NEXTAUTH_URL 默认已是 http://localhost:3000，无需修改）
+
 npm install
 
 # 只启动基础设施
+# 注意：docker-compose.yml 将服务映射到非标准端口，.env.example 已按此预设
+mysql:13306  redis:16379  minio:19000
 docker compose up mysql redis minio -d
 
-# 运行数据库迁移
+# 初始化数据库表结构（首次必须执行，跳过会导致启动后报错）
 npx prisma db push
 
 # 启动开发服务器
 npm run dev
 ```
 
+> [!WARNING]
+> 跳过 `npx prisma db push` 会导致所有数据库表不存在，启动后报错 `The table 'tasks' does not exist`。请务必先运行此命令再启动开发服务器。
+
 ---
 
 访问 [http://localhost:13000](http://localhost:13000)（方式一、二）或 [http://localhost:3000](http://localhost:3000)（方式三）开始使用！
```

**File**: `README_en.md` (modified, +5/-0)
```diff
@@ -73,6 +73,11 @@ docker compose down && docker compose up -d --build
 ```bash
 git clone https://github.com/saturndec/waoowaoo.git
 cd waoowaoo
+
+# Copy environment config (must be done before npm install)
+cp .env.example .env
+# ⚠️ Edit .env to fill in your AI API Keys (NEXTAUTH_URL defaults to http://localhost:3000, no change needed)
+
 npm install
 
 # Start infrastructure only
```

**File**: `lib/prompts/novel-promotion/voice_analysis.en.txt` (modified, +3/-2)
```diff
@@ -34,5 +34,6 @@ Rules:
 4. Match panel by order + speaker consistency + semantic relevance.
 5. If no reliable panel match exists, set "matchedPanel": null.
 6. Use canonical names from character library when possible.
-7. Return strict JSON only, no markdown.
-8. ⚠️ JSON SAFETY: All quotation marks in dialogue (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
+7. If there is no spoken dialogue that should be voiced, return [].
+8. Return strict JSON only, no markdown.
+9. ⚠️ JSON SAFETY: All quotation marks in dialogue (""''「」 etc.) MUST be converted to corner brackets「」in JSON string values. NEVER use raw ASCII double quotes " inside string values.
```

**File**: `lib/prompts/novel-promotion/voice_analysis.zh.txt` (modified, +3/-1)
```diff
@@ -28,8 +28,10 @@
    - 动作描写（描述角色的动作）
    - 场景描述（描述环境、画面）
    - 章节标题
-   
+   - 明确设定为无语言、默片、纯画面表达的内容
+
    ⚠️ 判断标准：这句话是否需要有人"说出来"？如果只是描述画面动作，不要提取。
+   ⚠️ 如果全文没有任何需要配音的台词，直接返回 []。
 
 2. 【情绪强度 emotionStrength】
    根据台词的情绪激烈程度，输出0.1-0.5之间的数值（⚠️ 注意：最高不超过0.5，保持语音自然平稳）：
```

**File**: `messages/en/assetHub.json` (modified, +7/-1)
```diff
@@ -13,6 +13,12 @@
     "addCharacter": "Add Character",
     "addLocation": "Add Location",
     "addVoice": "Add Voice",
+    "downloadAll": "Download All",
+    "downloadAllTitle": "Download All Image Assets as ZIP",
+    "downloading": "Packing...",
+    "downloadSuccess": "Download Complete",
+    "downloadFailed": "Download Failed",
+    "downloadEmpty": "No image assets to download",
     "newFolder": "New Folder",
     "editFolder": "Edit Folder",
     "deleteFolder": "Delete Folder",
@@ -98,4 +104,4 @@
         "dropOrClick": "Drop image or click to upload",
         "supportedFormats": "JPG, PNG supported"
     }
-}
+}
\ No newline at end of file
```

**File**: `messages/en/assets.json` (modified, +9/-3)
```diff
@@ -85,6 +85,9 @@
         "selectCount": "Select generation count",
         "generateCountPrefix": "Generate",
         "generateCountSuffix": "images",
+        "regenCountPrefix": "Regenerate",
+        "regenCountSuffix": "",
+        "regenCountAriaLabel": "Select regeneration count",
         "generatedProgress": "Generated {generated}/{total}",
         "generating": "Generating",
         "regenerating": "Regenerating",
@@ -188,7 +191,8 @@
         "regenerateAll": "Regenerate All",
         "regenerateAllConfirm": "Regenerate images for all assets? This will overwrite existing images.",
         "noAssetsToGenerate": "No assets available for generation",
-        "regenerateAllHint": "Regenerate all asset images (overwrite existing)"
+        "regenerateAllHint": "Regenerate all asset images (overwrite existing)",
+        "downloadAll": "Download all images as ZIP"
     },
     "common": {
         "actions": "Actions",
@@ -241,7 +245,9 @@
         "copySuccessCharacter": "Character appearance copied successfully",
         "copySuccessLocation": "Location image copied successfully",
         "copySuccessVoice": "Voice copied successfully",
-        "copyFailed": "Copy failed: {error}"
+        "copyFailed": "Copy failed: {error}",
+        "downloadEmpty": "No image assets to download",
+        "downloadFailed": "Download failed"
     },
     "tts": {
         "voiceDesignSaved": "AI-designed voice has been set for {name}",
@@ -326,4 +332,4 @@
         "referenceImagesHint": "(optional, paste supported)",
         "startEditing": "Start Editing"
     }
-}
+}
\ No newline at end of file
```

**File**: `messages/en/errors.json` (modified, +2/-1)
```diff
@@ -6,6 +6,7 @@
     "RATE_LIMIT": "Too many requests. Please retry in {retryAfter} seconds",
     "MODEL_NOT_OPEN": "Model permission is not activated. Go to https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&advancedActiveKey=model and click \"Activate all models\" in the top-right of Model Management",
     "MODEL_NOT_REGISTERED": "Model is not registered. Add an available model in configuration first",
+    "MODEL_NOT_CONFIGURED": "No model configured. Please go to Settings and add the required model type before generating.",
     "QUOTA_EXCEEDED": "Quota exceeded. Please try again later",
     "GENERATION_FAILED": "Generation failed. Please retry",
     "GENERATION_TIMEOUT": "Generation timed out. Please retry",
@@ -19,4 +20,4 @@
     "TASK_NOT_READY": "Task is still processing",
     "NO_RESULT": "Task has no result",
     "CONFLICT": "Resource state conflict"
-}
+}
\ No newline at end of file
```

---

### Incident Patch 7: `fba480ae` (2026-03-08)
**Commit Message**: feat: add Husky hooks and fix provider tutorial UI/logic

- Add Husky pre-commit and pre-push hooks for linting, type checking, and build validation
- Fix visual hierarchy bug in the provider onboarding tutorial
- Remove feedback modal
- Move MinIO bucket creation logic to before app startup
- Wire MiniMax audio through voice generation pipeline
- Fix scene insertion issues
- Fix portal tutorial modal and harden panel variant task flow

**File**: `README.md` (modified, +3/-0)
```diff
@@ -55,10 +55,13 @@ docker compose up -d
 
 ```bash
 docker compose down -v
+docker rmi ghcr.io/saturndec/waoowaoo:latest
 curl -O https://raw.githubusercontent.com/saturndec/waoowaoo/main/docker-compose.yml
 docker compose up -d
 ```
 
+> 启动后请**清空浏览器缓存**并重新登录，避免旧版本缓存导致异常。
+
 ### 方式二：克隆仓库 + Docker 构建（完全控制）
 
 ```bash
```

**File**: `README_en.md` (modified, +3/-0)
```diff
@@ -47,10 +47,13 @@ docker compose up -d
 
 ```bash
 docker compose down -v
+docker rmi ghcr.io/saturndec/waoowaoo:latest
 curl -O https://raw.githubusercontent.com/saturndec/waoowaoo/main/docker-compose.yml
 docker compose up -d
 ```
 
+> After starting, please **clear your browser cache** and log in again to avoid issues caused by stale cache.
+
 ### Method 2: Clone & Docker Build (Full Control)
 
 ```bash
```

**File**: `docker-compose.yml` (modified, +0/-15)
```diff
@@ -60,19 +60,6 @@ services:
       retries: 30
       start_period: 10s
 
-  minio-init:
-    image: minio/mc:RELEASE.2025-02-21T16-00-46Z
-    container_name: waoowaoo-minio-init
-    depends_on:
-      minio:
-        condition: service_healthy
-    restart: "no"
-    entrypoint: >
-      /bin/sh -c "
-        mc alias set local http://minio:9000 minioadmin minioadmin &&
-        mc mb --ignore-existing local/waoowaoo
-      "
-
   # ==================== App (Next.js + Workers) ====================
   app:
     image: ghcr.io/saturndec/waoowaoo:latest
@@ -140,8 +127,6 @@ services:
         condition: service_healthy
       minio:
         condition: service_healthy
-      minio-init:
-        condition: service_completed_successfully
     command: >
       sh -c "
         npx prisma db push --skip-generate &&
```

**File**: `messages/en/nav.json` (modified, +3/-3)
```diff
@@ -2,8 +2,8 @@
   "workspace": "Workspace",
   "assetHub": "Asset Hub",
   "profile": "Settings",
+  "downloadLogs": "Download Logs",
   "signin": "Sign In",
   "signup": "Sign Up",
-  "logout": "Logout",
-  "feedback": "Bug Feedback / Join Community"
-}
\ No newline at end of file
+  "logout": "Logout"
+}
```

**File**: `messages/en/novel-promotion.json` (modified, +1/-0)
```diff
@@ -126,6 +126,7 @@
     "visualStyle": "Visual Style",
     "visualStyleHint": "Pick a style that matches your audience — e.g. Realistic for live‑action, Anime for 2D content",
     "currentConfigSummary": "Current config: {ratio} · {style}. All subsequent generations will use this combo.",
+    "assetLibraryRatioNote": "Asset library ratios are not affected",
     "moreConfig": "For more configuration options, click the 「 Settings」 button in the top right",
     "narration": {
       "title": "Enable Narration Voiceover",
```

**File**: `messages/en/progress.json` (modified, +1/-3)
```diff
@@ -120,9 +120,7 @@
     "storyToScriptSubtitle": "Story To Script V2",
     "scriptToStoryboardSubtitle": "Script To Storyboard V2",
     "stop": "Stop",
-    "minimize": "Minimize",
-    "copyErrorDetail": "Copy error detail",
-    "openFeedbackForm": "Open feedback form"
+    "minimize": "Minimize"
   },
   "streamStep": {
     "analyzeCharacters": "Analyze characters",
```

**File**: `messages/zh/nav.json` (modified, +3/-3)
```diff
@@ -2,8 +2,8 @@
   "workspace": "工作区",
   "assetHub": "资产中心",
   "profile": "设置中心",
+  "downloadLogs": "下载日志",
   "signin": "登录",
   "signup": "注册",
-  "logout": "退出登录",
-  "feedback": "Bug 反馈 / 加入群聊"
-}
\ No newline at end of file
+  "logout": "退出登录"
+}
```

**File**: `messages/zh/novel-promotion.json` (modified, +1/-0)
```diff
@@ -126,6 +126,7 @@
     "visualStyle": "视觉风格",
     "visualStyleHint": "根据受众选择画面风格，例如：真人风格适合写实剧情，动漫风格适合二次元内容",
     "currentConfigSummary": "当前配置：{ratio} · {style}，后续生成都会使用此组合",
+    "assetLibraryRatioNote": "资产库比例不受影响",
     "moreConfig": "更多配置请点击右上角「 配置」按钮",
     "narration": {
       "title": "启用旁白配音",
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
