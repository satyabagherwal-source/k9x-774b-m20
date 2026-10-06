# Forensic Learning Record (Deep Inspection): lemonade-sdk/lemonade

> **Canonical Artifact**: `07_PROJECT_LEARNING/lemonade-sdk-lemonade-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lemonade-sdk/lemonade](https://github.com/lemonade-sdk/lemonade))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:47.258Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lemonade-sdk/lemonade`
- **Description**: Lemonade helps users discover and run local AI apps by serving optimized LLMs right from their own GPUs and NPUs. Join our discord: https://discord.gg/5xXzkMu8Zk
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 5832 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app/src/renderer/AboutModal.tsx`
```
import React, { useEffect, useRef, useState } from 'react';
import { serverConfig } from './utils/serverConfig';
import { fetchSystemInfoData } from './utils/systemData';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemInfo {
  system: string;
  os: string;
  cpu: string;
  gpus: string[];
  gtt_gb?: string;
  vram_gb?: string;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [version, setVersion] = useState<string>('Loading...');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setVersion('Loading...');
    setIsLoadingInfo(true);

    // Retry logic to handle backend startup delay. /health returns the server
    // version; if it's unreachable for the first few attempts the renderer
    // backs off and shows a friendly fallback.
    const fetchVersionWithRetry = async (retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await serverConfig.fetch('/health');
          if (response.ok) {
            const data = await response.json();
            const v = data.version;
            if (v && v !== 'Unknown') {
              setVersion(v);
              return;
            }
          }
        } catch {
          // fall through to retry
        }
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      setVersion('Unknown (Backend not running)');
    };

    const fetchSystemInfo = async () => {
      try {
        const { info } = await fetchSystemInfoData();
        if (!info) {
          return;
        }

        const gpus: string[] = [];
        let maxGttGb = 0;
        let maxVramGb = 0;

        const considerAmdGpu = (gpu?: { name?: string; virtual_mem_gb?: number; vram_gb?: number }) => {
          if (!gpu) return;
          if (gpu.name) gpus.push(gpu.name);
          if (typeof gpu.virtual_mem_gb === 'number' && isFinite(gpu.virtual_mem_gb)) {
            maxGttGb = Math.max(maxGttGb, gpu.virtual_mem_gb);
          }
          if (typeof gpu.vram_gb === 'number' && isFinite(gpu.vram_gb)) {
            maxVramGb = Math.max(maxVramGb, gpu.vram_gb);
          }
        };

        considerAmdGpu(info.devices?.amd_igpu);
        info.devices?.amd_dgpu?.forEach(considerAmdGpu);

        info.devices?.nvidia_gpu?.forEach((gpu) => {
          if (gpu?.name) gpus.push(gpu.name);
        });

        const normalized: SystemInfo = {
          system: 'Unknown',
          os: info.os_version || 'Unknown',
          cpu: info.processor || 'Unknown',
          gpus,
          gtt_gb: maxGttGb > 0 ? `${maxGttGb} GB` : 'Unknown',
          vram_gb: maxVramGb > 0 ? `${maxVramGb} GB` : 'Unknown',
        };

        setSystemInfo(normalized);
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      } finally {
        setIsLoadingInfo(false);
      }
    };

    fetchVersionWithRetry();
    fetchSystemInfo();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="about-popover" ref={cardRef}>
      <div className="about-popover-header">
        <div>
          <p className="about-popover-title">Lemonade</p>
          <p className="about-popover-subtitle">Local AI control center</p>
        </div>
        <button className="about-popover-close" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M 1,1 L 13,13 M 13,1 L 1,13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="about-popover-body">
        <div className="about-popover-version">
          <span>Version</span>
          <span>{version}</span>
        </div>

        {!isLoadingInfo && systemInfo && (
          <>
            {systemInfo.system && systemInfo.system !== 'Unknown' && (
              <div className="about-popover-info-row">
                <span className="about-popover-info-label">System</span>
                <span className="about-popover-info-value">{systemInfo.system}</span>
              </div>
            )}
            {systemInfo.os && systemInfo.os !== 'Unknown' && (
              <div className="about-popover-info-row">
                <span className="about-popover-info-label">OS</span>
                <span className="about-popover-info-value">{systemInfo.os}</span>
              </div>
            )}
            {systemInfo.cpu && systemInfo.cpu !== 'Unknown' && (
              <div className="about-popover-info-row">
                <span className="about-popover-info-label">CPU</span>
                <span className="about-popover-info-value">{systemInfo.cpu}</span>
              </div>
            )}
            {systemInfo.gpus.length > 0 && (
              <div className="about-popover-info-row">
                <span className="about-popover-info-label">GPU{systemInfo.gpus.length > 1 ? 's' : ''}</span>
                <span className="about-popover-info-value">
                  {systemInfo.gpus.join(', ')}
                </span>
              </div>
            )}
            {systemInfo.gtt_gb && systemInfo.gtt_gb !== 'Unknown' && (
              <div className="about-popover-info-row">
                <span className="about-popover-info-label">Shared GPU memory</span>
                <span className="about-popover-info-value">{systemInfo.gtt_gb}</span>
              </div>
            )}
            {systemInfo.vram_gb && systemInfo.vram_gb !== 'Unknown' && (
              <div className="about-popover-info-row">
                <span className="about-popover-info-label">Dedicated GPU memory</span>
                <span className="about-popover-info-value">{systemInfo.vram_gb}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AboutModal;

```

### Core Architecture Module: `src/app/src/renderer/AddModelPanel.tsx`
```
import React, { useState, useEffect } from 'react';
import { useSystem } from './hooks/useSystem';
import { COLLECTION_OMNI_MODEL_RECIPE, RECIPE_DISPLAY_NAMES } from './utils/recipeNames';

export type ModelRegistrySource = 'huggingface' | 'modelscope';

export interface AddModelInitialValues {
  name: string;
  checkpoint: string;
  recipe: string;
  source?: ModelRegistrySource;
  checkpoints?: Record<string, string>;
  mmprojOptions?: string[];
  labels?: string[];
  vision?: boolean;
  reranking?: boolean;
  embedding?: boolean;
}

export interface ModelInstallData {
  name: string;
  checkpoint: string;
  recipe: string;
  // Omitted when the user leaves the source on "Automatic" so the server can
  // apply its configured default_model_source.
  source?: ModelRegistrySource;
  checkpoints?: Record<string, string>;
  mmproj?: string;
  labels?: string[];
  reasoning?: boolean;
  vision?: boolean;
  embedding?: boolean;
  reranking?: boolean;
}

interface AddModelPanelProps {
  onClose: () => void;
  onInstall: (data: ModelInstallData) => void;
  initialValues?: AddModelInitialValues;
}

const FALLBACK_RECIPE_OPTIONS = ['llamacpp', 'flm', 'ryzenai-llm'];
const HIDDEN_RECIPE_OPTIONS = new Set([COLLECTION_OMNI_MODEL_RECIPE]);

const getRecipeLabel = (recipe: string): string => RECIPE_DISPLAY_NAMES[recipe] ?? recipe;

type RecipeExample = {
  name: string;
  checkpoint: string;
  textEncoderCheckpoint?: string;
  vaeCheckpoint?: string;
};

const RECIPE_EXAMPLES: Record<string, RecipeExample> = {
  'llamacpp': {
    name: 'Gemma-3-4b-it-GGUF',
    checkpoint: 'ggml-org/gemma-3-4b-it-GGUF:Q4_K_M',
  },
  'ryzenai-llm': {
    name: 'Qwen2.5-0.5B-Instruct-CPU',
    checkpoint: 'amd/Qwen2.5-0.5B-Instruct-quantized_int4-float16-cpu-onnx',
  },
  'flm': {
    name: 'Gemma-3-4B-FLM',
    checkpoint: 'gemma3:4b',
  },
  'whispercpp': {
    name: 'Whisper-Tiny',
    checkpoint: 'ggerganov/whisper.cpp:ggml-tiny.bin',
  },
  'moonshine': {
    name: 'Moonshine-Tiny-Streaming',
    checkpoint: 'UsefulSensors/moonshine-streaming:onnx/tiny',
  },
  'sd-cpp': {
    name: 'Z-Image-Turbo',
    checkpoint: 'Comfy-Org/z_image_turbo:split_files/diffusion_models/z_image_turbo_bf16.safetensors',
    textEncoderCheckpoint: 'Comfy-Org/z_image_turbo:split_files/text_encoders/qwen_3_4b.safetensors',
    vaeCheckpoint: 'Comfy-Org/z_image_turbo:split_files/vae/ae.safetensors',
  },
  'kokoro': {
    name: 'kokoro-v1',
    checkpoint: 'mikkoph/kokoro-onnx',
  },
  'vllm': {
    name: 'Qwen3.5-0.8B-FP16-vLLM',
    checkpoint: 'Qwen/Qwen3.5-0.8B',
  },
};

const getRecipeExample = (recipe: string): RecipeExample => RECIPE_EXAMPLES[recipe] ?? RECIPE_EXAMPLES.llamacpp;

type AddModelFormState = {
  name: string;
  checkpoint: string;
  recipe: string;
  // '' means "Automatic": defer to the server's configured default_model_source.
  source: ModelRegistrySource | '';
  textEncoderCheckpoint: string;
  vaeCheckpoint: string;
  mmproj: string;
  reasoning: boolean;
  vision: boolean;
  embedding: boolean;
  reranking: boolean;
};

const createEmptyForm = (initial?: AddModelInitialValues): AddModelFormState => ({
  name: initial?.name ?? '',
  checkpoint: initial?.checkpoint ?? initial?.checkpoints?.main ?? '',
  recipe: initial?.recipe ?? 'llamacpp',
  source: initial?.source ?? '',
  textEncoderCheckpoint: initial?.checkpoints?.text_encoder ?? '',
  vaeCheckpoint: initial?.checkpoints?.vae ?? '',
  mmproj: '',
  reasoning: false,
  vision: initial?.vision ?? false,
  embedding: initial?.embedding ?? false,
  reranking: initial?.reranking ?? false,
});

const hasRepoRelativeFilePath = (checkpoint: string): boolean => {
  const separatorIndex = checkpoint.indexOf(':');
  if (separatorIndex === -1) return false;
  const variant = checkpoint.slice(separatorIndex + 1).trim();
  return variant.includes('.');
};

const isGgufCheckpoint = (checkpoint: string): boolean => checkpoint.toLowerCase().includes('gguf');

const AddModelPanel: React.FC<AddModelPanelProps> = ({ onClose, onInstall, initialValues }) => {
  const { supportedRecipes, ensureSystemInfoLoaded } = useSystem();
  const [form, setForm] = useState(() => createEmptyForm(initialValues));
  const [error, setError] = useState<string | null>(null);

  const mmprojOptions = initialValues?.mmprojOptions ?? [];
  const isSdCpp = form.recipe === 'sd-cpp';
  const recipeExample = getRecipeExample(form.recipe);

  const getMmprojLabel = (filename: string): string =>
    filename.replace(/^mmproj-/i, '').replace(/^model-/i, '').replace(/\.gguf$/i, '');

  useEffect(() => {
    void ensureSystemInfoLoaded();
  }, [ensureSystemInfoLoaded]);

  useEffect(() => {
    const newForm = createEmptyForm(initialValues);
    if (initialValues?.mmprojOptions && initialValues.mmprojOptions.length > 0) {
      newForm.mmproj = initialValues.mmprojOptions[0];
    }
    setForm(newForm);
    setError(null);
  }, [initialValues]);

  const handleChange = <K extends keyof AddModelFormState>(
    field: K, value: AddModelFormState[K]
  ) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleInstall = () => {
    const name = form.name.trim();
    const checkpoint = form.checkpoint.trim();
    const recipe = form.recipe.trim();
    const source = form.source;
    const textEncoderCheckpoint = form.textEncoderCheckpoint.trim();
    const vaeCheckpoint = form.vaeCheckpoint.trim();
    const hasSdComponents = Boolean(textEncoderCheckpoint || vaeCheckpoint);

    if (!name) {
      setError('Model name is required.');
      return;
    }
    if (!checkpoint) {
      setError('Checkpoint is required.');
      return;
    }
    if (!recipe) {
      setError('Recipe is required.');
      return;
    }
    if (recipe === 'sd-cpp' && !hasRepoRelativeFilePath(checkpoint)) {
      setError('StableDiffusion.cpp checkpoints must include the full file path relative to the selected registry repo, for example repo/model:path/to/model.safetensors or repo/model:path/to/model.gguf.');
      return;
    }
    if (recipe !== 'sd-cpp' && isGgufCheckpoint(checkpoint) && !checkpoint.includes(':')) {
      setError('GGUF checkpoints must include a variant using the CHECKPOINT:VARIANT syntax.');
      return;
    }
    if (recipe === 'vllm' && isGgufCheckpoint(checkpoint)) {
      setError('vLLM checkpoints should use a model repository, not a GGUF file or GGUF repo.');
      return;
    }
    if (recipe === 'sd-cpp' && hasSdComponents && (!textEncoderCheckpoint || !vaeCheckpoint)) {
      setError('Provide both text encoder and VAE checkpoints for sd-cpp components.');
      return;
    }
    if (recipe === 'sd-cpp' && ((textEncoderCheckpoint && !hasRepoRelativeFilePath(textEncoderCheckpoint)) || (vaeCheckpoint && !hasRepoRelativeFilePath(vaeCheckpoint)))) {
      setError('Additional sd-cpp checkpoints must use the full repo-relative file path, for example repo/model:path/to/file.safetensors or repo/model:path/to/file.gguf.');
      return;
    }

    const labels = (initialValues?.labels ?? []).filter(label => label !== 'vision');

    onInstall({
      name,
      checkpoint,
      // Only pin a registry when the user picked one; "Automatic" lets the
      // server apply its configured default_model_source.
      ...(source ? { source } : {}),
      checkpoints: recipe === 'sd-cpp' && hasSdComponents
        ? { main: checkpoint, text_encoder: textEncoderCheckpoint, vae: vaeCheckpoint }
        : undefined,
      recipe,
      mmproj: !isSdCpp ? (form.mmproj.trim() || undefined) : undefined,
      labels,
      reasoning: form.reasoning,
      vision: !isSdCpp ? form.vision : false,
      embedding: !isSdCpp ? form.embedding : false,
      reranking: !isSdCpp ? form.reranking : false,
    });
  };

  const supportedRecipeOptions = Object.keys(supportedRecipes)
    .filter(recipe => !HIDDEN_RECIPE_OPTIONS.has(recipe))
    .sort((a, b) => getRecipeLabel(a).localeCompare(getRecipeLabel(b)));
  const recipeOptions = supportedRecipeOptions.length > 0
    ? supportedRecipeOptions
    : FALLBACK_RECIPE_OPTIONS;

  const mmprojOptionElements = mmprojOptions.map((f: string) => {
    const label = getMmprojLabel(f);
    return React.createElement('option', { key: f, value: f }, label);
  });

  const showMmproj = !isSdCpp && (mmprojOptions.length > 0 || !initialValues);
  const mmprojField: React.ReactNode = showMmproj
    ? React.createElement(
        'div',
        { className: 'form-subsection' },
        React.createElement(
          'label',
          { className: 'form-label-secondary', title: 'Multimodal projection file for vision models' },
          'mmproj file (Optional)'
        ),
        mmprojOptions.length > 0
          ? React.createElement(
              'select',
              {
                className: 'form-input form-select',
                value: form.mmproj,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => handleChange('mmproj', e.target.value),
              },
              ...mmprojOptionElements
            )
          : React.createElement('input', {
              type: 'text',
              className: 'form-input',
              placeholder: 'mmproj-F16.gguf',
              value: form.mmproj,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange('mmproj', e.target.value),
            })
      )
    : null;

  return (
    <>
      <div className="settings-header">
        <h3>Add a Model</h3>
        <button className="settings-close-button" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M 1,1 L 13,13 M 13,1 L 1,13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="settings-content">
        <div className="form-section">
          <label className="form-label" title="A unique name to identify your model in the catalog">
            Model Name
          </label>
          <inp
```

### Core Architecture Module: `src/app/src/renderer/App.tsx`
```
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from './components/Icons';
import TitleBar from './TitleBar';
import ChatWindow from './ChatWindow';
import ModelManager, { LeftPanelView } from './ModelManager';
import LogsWindow from './LogsWindow';
import ResizableDivider from './ResizableDivider';
import DownloadManager from './DownloadManager';
import StatusBar from './StatusBar';
import { ModelsProvider, useModels } from './hooks/useModels';
import { SystemProvider } from './hooks/useSystem';
import { DEFAULT_LAYOUT_SETTINGS } from './utils/appSettings';
import { downloadTracker } from './utils/downloadTracker';
import CustomCollectionPanel from './components/CustomCollectionPanel';
import RouterCollectionPanel from './components/RouterCollectionPanel';
import { ToastContainer, useToast } from './Toast';
import { pullModel, type ModelRegistrationData } from './utils/backendInstaller';
import {
  CustomCollectionDraft,
  RouterCollectionDraft,
  buildCustomCollectionPullRequest,
  buildRouterCollectionPullRequest,
  getCollectionDisplayName,
  routingBlocksEquivalent,
  validateRouterImportPayload,
} from './utils/customCollections';
import { isCollectionRecipe, COLLECTION_ROUTER_MODEL_RECIPE } from './utils/recipeNames';
import { buildModelExportFile, downloadJsonFile } from './utils/modelData';
import { isModelEffectivelyDownloaded } from './utils/collectionModels';
import '../../styles/index.css';

type PullRegistrationPayload = {
  model_name: string;
  recipe: string;
  checkpoint?: string;
  checkpoints?: Record<string, string>;
  components?: string[];
  models?: Array<Record<string, unknown>>;
  labels?: string[];
  mmproj?: string;
  size?: number;
  image_defaults?: unknown;
  reasoning?: boolean;
  vision?: boolean;
};


const LAYOUT_CONSTANTS = {
  modelManagerMinWidth: 200,
  experienceRailWidth: 40,
  mainContentMinWidth: 300,
  chatMinWidth: 250,
  dividerWidth: 4,
  absoluteMinWidth: 400,
};

// Inner component that can use SystemProvider context
const AppContent: React.FC = () => {
  const [theme, setTheme] = useState(DEFAULT_LAYOUT_SETTINGS.theme);
  const [isChatVisible, setIsChatVisible] = useState(DEFAULT_LAYOUT_SETTINGS.isChatVisible);
  const [isModelManagerVisible, setIsModelManagerVisible] = useState(DEFAULT_LAYOUT_SETTINGS.isModelManagerVisible);
  const [leftPanelView, setLeftPanelView] = useState<LeftPanelView>('models');
  const [externalContentUrl, setExternalContentUrl] = useState<string | null>(null);
  const [isLogsVisible, setIsLogsVisible] = useState(DEFAULT_LAYOUT_SETTINGS.isLogsVisible);
  const [isDownloadManagerVisible, setIsDownloadManagerVisible] = useState(false);
  const [modelManagerWidth, setModelManagerWidth] = useState(DEFAULT_LAYOUT_SETTINGS.modelManagerWidth);
  const [chatWidth, setChatWidth] = useState(DEFAULT_LAYOUT_SETTINGS.chatWidth);
  const [logsHeight, setLogsHeight] = useState(DEFAULT_LAYOUT_SETTINGS.logsHeight);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [customCollectionModal, setCustomCollectionModal] = useState<{ mode: 'create' | 'edit'; collectionId?: string } | null>(null);
  const importCollectionFileRef = useRef<HTMLInputElement>(null);
  const [routerCollectionModal, setRouterCollectionModal] = useState<{ mode: 'create' | 'edit'; collectionId?: string } | null>(null);
  const importRouterFileRef = useRef<HTMLInputElement>(null);
  const { modelsData, selectedModel, setSelectedModel, setUserHasSelectedModel, refresh: refreshModels } = useModels();
  const { toasts, removeToast, showError, showSuccess, showWarning, showInfo } = useToast();
  const isDraggingRef = useRef<'left' | 'right' | 'bottom' | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startWidthRef = useRef(0);
  const startHeightRef = useRef(0);
  // Auto-open the manager when a tab first discovers active downloads, but
  // respect a user close while those same downloads are still active. Without
  // this, the 2 s /downloads poll reopens the panel immediately.
  const suppressDownloadAutoOpenRef = useRef(false);

  // Load saved layout settings on mount
  useEffect(() => {
    const loadLayoutSettings = async () => {
      try {
        if (window?.api?.getSettings) {
          const settings = await window.api.getSettings();
          if (settings.layout) {
            setTheme(settings.layout.theme ?? DEFAULT_LAYOUT_SETTINGS.theme);
            setIsChatVisible(settings.layout.isChatVisible ?? DEFAULT_LAYOUT_SETTINGS.isChatVisible);
            setIsModelManagerVisible(settings.layout.isModelManagerVisible ?? DEFAULT_LAYOUT_SETTINGS.isModelManagerVisible);
            const savedView = settings.layout.leftPanelView;
            if (savedView === 'models' || savedView === 'marketplace' || savedView === 'backends' || savedView === 'settings') {
              setLeftPanelView(savedView);
            }
            setIsLogsVisible(settings.layout.isLogsVisible ?? DEFAULT_LAYOUT_SETTINGS.isLogsVisible);
            setModelManagerWidth(settings.layout.modelManagerWidth ?? DEFAULT_LAYOUT_SETTINGS.modelManagerWidth);
            setChatWidth(settings.layout.chatWidth ?? DEFAULT_LAYOUT_SETTINGS.chatWidth);
            setLogsHeight(settings.layout.logsHeight ?? DEFAULT_LAYOUT_SETTINGS.logsHeight);
          }
        }
      } catch (error) {
        console.error('Failed to load layout settings:', error);
      } finally {
        // Override with URL parameters if present
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') === 'logs') {
          setIsLogsVisible(true);
        }
        setLayoutLoaded(true);
      }
    };
    loadLayoutSettings();
  }, []);

  // Save layout settings when they change (debounced)
  const saveLayoutSettings = useCallback(async () => {
    if (!layoutLoaded) return;
    try {
      if (window?.api?.getSettings && window?.api?.saveSettings) {
        // Get current settings and merge layout changes
        const currentSettings = await window.api.getSettings();
        await window.api.saveSettings({
          ...currentSettings,
          layout: {
            theme,
            isChatVisible,
            isModelManagerVisible,
            leftPanelView,
            isLogsVisible,
            modelManagerWidth,
            chatWidth,
            logsHeight,
          },
        });
      }
    } catch (error) {
      console.error('Failed to save layout settings:', error);
    }
  }, [layoutLoaded, theme, isChatVisible, isModelManagerVisible, leftPanelView, isLogsVisible, modelManagerWidth, chatWidth, logsHeight]);

  // Debounced save effect
  useEffect(() => {
    if (!layoutLoaded) return;
    const timeoutId = setTimeout(saveLayoutSettings, 300);
    return () => clearTimeout(timeoutId);
  }, [saveLayoutSettings, layoutLoaded]);

  // Listen for download events to automatically open the download manager.
  useEffect(() => {
    const isVisibleStatus = (status?: string) =>
      status === 'downloading' || status === 'paused' || status === 'error';

    const openIfActive = (downloads = downloadTracker.getActiveDownloads()) => {
      const hasVisibleDownload = downloads.some((d: any) => isVisibleStatus(d?.status));
      if (!hasVisibleDownload) {
        suppressDownloadAutoOpenRef.current = false;
        return false;
      }
      if (!suppressDownloadAutoOpenRef.current) {
        setIsDownloadManagerVisible(true);
      }
      return true;
    };

    const handleDownloadStart = () => {
      suppressDownloadAutoOpenRef.current = false;
      setIsDownloadManagerVisible(true);
    };

    const handleDownloadSignal = (e: any) => {
      const downloads = Array.isArray(e.detail?.downloads) ? e.detail.downloads : downloadTracker.getActiveDownloads();
      openIfActive(downloads);
    };

    const handleChatDownloadComplete = () => {
      suppressDownloadAutoOpenRef.current = true;
      setIsDownloadManagerVisible(false);
    };

    downloadTracker.startServerPolling();

    window.addEventListener('download:started' as any, handleDownloadStart);
    window.addEventListener('download:update' as any, handleDownloadSignal);
    window.addEventListener('download:snapshot' as any, handleDownloadSignal);
    window.addEventListener('download:chatComplete' as any, handleChatDownloadComplete);

    void downloadTracker.hydrateFromServer().then(() => openIfActive());

    const handleOpenExternalContent = (e: any) => {
      if (e.detail?.url) {
        setExternalContentUrl(e.detail.url);
        setIsChatVisible(true);
        if (!openIfActive()) {
          setIsDownloadManagerVisible(false);
        }
      }
    };
    window.addEventListener('open-external-content' as any, handleOpenExternalContent);

    return () => {
      window.removeEventListener('download:started' as any, handleDownloadStart);
      window.removeEventListener('download:update' as any, handleDownloadSignal);
      window.removeEventListener('download:snapshot' as any, handleDownloadSignal);
      window.removeEventListener('download:chatComplete' as any, handleChatDownloadComplete);
      window.removeEventListener('open-external-content' as any, handleOpenExternalContent);
    };
  }, [refreshModels]);

  // Handle lemonade:// protocol navigation from main process.
  // Must await tauriReady because window.api is installed asynchronously
  // and isn't available on the first render.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { tauriReady } = await import('./tauriShim');
      await tauriReady;
      if (cancelled || !window?.api?.onNavigate) return;
      const unsub = window.api.onNavigate((data: { view?: string; model?: string }) => {
        if (data.view === 'logs') {
          setIsLogsVisible(true);
        }
      });
      if (typeof unsub === 'function') unsubscribe = unsub;

```

### Core Architecture Module: `src/app/src/renderer/AudioButton.tsx`
```
import React, { ReactElement } from 'react';

export const PAUSED = 0;
export const LOADING = 1;
export const PLAYING = 2;

interface  AudioButtonProps {
  textMessage: any;
  role?: string;
  buttonIndex: number;
  onClickFunction: (message: any, buttonIndex: number, role?: string) => void;
  buttonContext: {buttonId: number, audioState: number};
}

const AudioButton: React.FC<AudioButtonProps> = React.memo(function AudioButton({ textMessage, role, buttonIndex, onClickFunction, buttonContext}) {
  const LoadingIcon = () => {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18px" height="18px"  style={{opacity:1}}>
        <circle cx="3" cy="9" r="2" fill="currentColor">
          <animate id="SVG9IgbRbsl" attributeName="r" begin="0;SVGFUNpCWdG.end-0.35s" dur="0.95s" values="3;.2;3"/>
        </circle>
        <circle cx="9" cy="9" r="2" fill="currentColor">
          <animate attributeName="r" begin="SVG9IgbRbsl.end-0.7s" dur="0.95s" values="3;.2;3"/>
        </circle>
        <circle cx="16" cy="9" r="2" fill="currentColor">
          <animate id="SVGFUNpCWdG" attributeName="r" begin="SVG9IgbRbsl.end-0.55s" dur="0.95s" values="3;.2;3"/>
        </circle>
      </svg>
    )
  }

  const PausedIcon = () => {
    return (
      <svg fill="#000000" width="18px" height="18px" viewBox="-11.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.2 22.48c-0.48 0-0.84-0.36-0.84-0.84v-11.28c0-0.48 0.36-0.84 0.84-0.84s0.84 0.36 0.84 0.84v11.32c0 0.44-0.36 0.8-0.84 0.8zM0.84 22.48c-0.48 0-0.84-0.36-0.84-0.84v-11.28c0-0.48 0.36-0.84 0.84-0.84s0.84 0.36 0.84 0.84v11.32c-0.040 0.44-0.36 0.8-0.84 0.8z"></path>
      </svg>
    )
  }

  const PlayingIcon = () => {
    return(
      <svg fill="#000000" width="18px" height="18px" viewBox="-3.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.16 25.46c-0.16 0-0.28-0.040-0.4-0.12l-7.52-4.32h-2.6c-1.44 0-2.64-1.16-2.64-2.6v-4.8c0-1.44 1.2-2.64 2.64-2.64h2.6l7.52-4.32c0.12-0.080 0.28-0.12 0.4-0.12 1.44 0 2.64 1.2 2.64 2.64v13.6c0 1.48-1.16 2.68-2.64 2.68zM2.64 12.66c-0.52 0-0.96 0.44-0.96 0.96v4.8c0 0.52 0.44 0.96 0.96 0.96h2.84c0.16 0 0.28 0.040 0.4 0.12l7.48 4.28c0.44-0.080 0.76-0.48 0.76-0.92v-13.64c0-0.48-0.32-0.84-0.76-0.92l-7.48 4.28c-0.12 0.080-0.28 0.12-0.4 0.12l-2.84-0.040zM18.64 21.297c-0.16 0-0.32-0.040-0.48-0.16-0.4-0.24-0.48-0.8-0.24-1.16 0.8-1.16 1.2-2.52 1.2-3.92 0-1.44-0.44-2.84-1.28-4.040-0.28-0.36-0.16-0.92 0.2-1.16 0.36-0.28 0.92-0.16 1.16 0.2 1.040 1.48 1.56 3.2 1.56 5 0 1.76-0.52 3.44-1.48 4.88-0.080 0.24-0.36 0.36-0.64 0.36zM22.28 23.042c-0.16 0-0.28-0.040-0.44-0.12-0.4-0.24-0.52-0.76-0.28-1.16 1.040-1.72 1.6-3.72 1.6-5.76s-0.56-4.040-1.6-5.76c-0.24-0.4-0.12-0.92 0.28-1.16s0.92-0.12 1.16 0.28c1.2 2 1.84 4.28 1.84 6.64s-0.64 4.64-1.84 6.64c-0.16 0.24-0.44 0.4-0.72 0.4z"></path>
      </svg>
    )
  }

  const renderButtonIcon = () : ReactElement=> {
    if(buttonContext.buttonId == buttonIndex) {
      switch(buttonContext.audioState) {
        case LOADING:
          return <LoadingIcon />;
        case PLAYING:
          return <PausedIcon />;
        default:
          return <PlayingIcon />;
      }
    } else {
      return <PlayingIcon />;
    }
  }

  return (
    <div key={buttonIndex} className="message-play-button-container">
      <button className="message-play-button" onClick={() => onClickFunction(textMessage, buttonIndex, role)} disabled={buttonContext.audioState == LOADING}>{renderButtonIcon()}</button>
    </div>
  );
}, (prevProps, nextProps) => {
  return (nextProps.buttonContext.buttonId === prevProps.buttonContext.buttonId) && (nextProps.buttonContext.audioState === prevProps.buttonContext.audioState) && (nextProps.textMessage == prevProps.textMessage) && (nextProps.role === prevProps.role) && (nextProps.onClickFunction == prevProps.onClickFunction);
});

export default AudioButton;

```

### Core Architecture Module: `src/app/src/renderer/BackendManager.tsx`
```
import React, { useState, useCallback, useEffect } from 'react';

import { useSystem } from './hooks/useSystem';
import { Recipe, BackendInfo } from './utils/systemData';
import { RECIPE_DISPLAY_NAMES } from './utils/recipeNames';
import ConnectedBackendRow from './components/ConnectedBackendRow';
import CloudProvidersSection from './CloudProvidersSection';

const RECIPE_ORDER = new Map([
  'llamacpp',
  'whispercpp',
  'moonshine',
  'sd-cpp',
  'kokoro',
  'flm',
  'ryzenai-llm',
  'vllm',
].map((recipe, index) => [recipe, index]));

interface GithubReleaseRef {
  owner: string;
  repo: string;
  tag: string;
}

const parseGithubReleaseUrl = (url?: string): GithubReleaseRef | null => {
  if (!url) return null;
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/(.+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], tag: match[3] };
};

interface BackendManagerProps {
  searchQuery: string;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  showWarning: (msg: string) => void;
}

const BackendManager: React.FC<BackendManagerProps> = ({ searchQuery, showError, showSuccess, showWarning }) => {
  const { systemInfo, isLoading, refresh } = useSystem();
  const [backendAssetSizes, setBackendAssetSizes] = useState<Record<string, number>>({});

  // Refresh system info when the backend manager is opened
  useEffect(() => {
    refresh();
  }, [refresh]);

  const recipes = systemInfo?.recipes;
  // `recipes` is canonical (docs are generated from it), so host-specific
  // availability arrives separately: these have no model that fits this
  // machine's memory, so there is nothing to install them for.
  const unavailableRecipes = new Set(systemInfo?.unavailable_recipes ?? []);

  // Fetch asset sizes from GitHub Releases API
  useEffect(() => {
    if (!recipes) return;

    const pendingByRelease = new Map<string, Set<string>>();
    Object.values(recipes).forEach((recipe: Recipe) => {
      Object.values(recipe.backends).forEach((backend: BackendInfo) => {
        const releaseUrl = backend.release_url;
        const filename = backend.download_filename;
        if (!releaseUrl || !filename) return;
        if (typeof backend.download_size_mb === 'number' || typeof backend.download_size_bytes === 'number') return;

        const cacheKey = `${releaseUrl}:${filename}`;
        if (typeof backendAssetSizes[cacheKey] === 'number') return;

        if (!pendingByRelease.has(releaseUrl)) {
          pendingByRelease.set(releaseUrl, new Set());
        }
        pendingByRelease.get(releaseUrl)!.add(filename);
      });
    });

    if (pendingByRelease.size === 0) return;

    let isCancelled = false;

    const fetchReleaseAssets = async () => {
      const discoveredSizes: Record<string, number> = {};

      await Promise.all(
        Array.from(pendingByRelease.entries()).map(async ([releaseUrl, fileNames]) => {
          const parsed = parseGithubReleaseUrl(releaseUrl);
          if (!parsed) return;

          try {
            const response = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/tags/${parsed.tag}`);
            if (!response.ok) return;
            const data = await response.json();
            const assets = Array.isArray(data?.assets) ? data.assets : [];
            assets.forEach((asset: any) => {
              if (fileNames.has(asset?.name) && typeof asset?.size === 'number') {
                discoveredSizes[`${releaseUrl}:${asset.name}`] = asset.size;
              }
            });
          } catch {
            // Size fallback is best-effort
          }
        })
      );

      if (isCancelled || Object.keys(discoveredSizes).length === 0) return;
      setBackendAssetSizes((prev) => ({ ...prev, ...discoveredSizes }));
    };

    fetchReleaseAssets();
    return () => {
      isCancelled = true;
    };
  }, [backendAssetSizes, recipes]);

  const getBackendSizeLabel = useCallback((backendInfo: BackendInfo): string | null => {
    if (typeof backendInfo.download_size_mb === 'number' && backendInfo.download_size_mb > 0) {
      return `${Math.round(backendInfo.download_size_mb)} MB`;
    }

    if (typeof backendInfo.download_size_bytes === 'number' && backendInfo.download_size_bytes > 0) {
      return `${Math.round(backendInfo.download_size_bytes / (1024 * 1024))} MB`;
    }

    if (backendInfo.release_url && backendInfo.download_filename) {
      const bytes = backendAssetSizes[`${backendInfo.release_url}:${backendInfo.download_filename}`];
      if (typeof bytes === 'number' && bytes > 0) {
        return `${Math.round(bytes / (1024 * 1024))} MB`;
      }
      return '...';
    }

    return null;
  }, [backendAssetSizes]);

  const openExternalLink = useCallback((url?: string) => {
    if (!url) return;
    if (window.api?.openExternal) {
      window.api.openExternal(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Matches the server's own `locally_installed` (system_info.cpp): these three
  // states all mean the backend is on disk, `update_required` included.
  const isLocallyInstalled = (info: BackendInfo) =>
    info.state === 'installed' ||
    info.state === 'update_available' ||
    info.state === 'update_required';

  // An unavailable recipe has no built-in model that fits this host, so it keeps
  // only rows for an existing installation: this panel is the only one offering
  // uninstall (ModelManager renders the 'banner' variant, which has none), so
  // hiding those would strand them. `installable` and `action_required` are
  // dropped — nothing is on disk yet, and setting one up would buy the user
  // nothing. A recipe left with no rows falls out via the length check below.
  const keepBackend = (recipeName: string) =>
    unavailableRecipes.has(recipeName)
      ? isLocallyInstalled
      : (info: BackendInfo) => info.state !== 'unsupported';

  const groupedBackends: Array<[string, Array<[string, BackendInfo]>]> = recipes
    ? Object.entries(recipes)
      .map(([recipeName, recipe]: [string, Recipe]) => {
        const keep = keepBackend(recipeName);
        const backends = Object.entries(recipe.backends).filter(([, info]) => keep(info));
        return [recipeName, backends] as [string, Array<[string, BackendInfo]>];
      })
      .filter(([, backends]) => backends.length > 0)
      .sort(([a], [b]) => {
        const aOrder = RECIPE_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = RECIPE_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.localeCompare(b);
      })
    : [];

  const query = searchQuery.trim().toLowerCase();
  const visibleGroups = groupedBackends
    .map(([recipeName, backends]) => {
      const filteredBackends = backends.filter(([backendName, info]) => {
        if (!query) return true;
        const haystack = `${recipeName} ${backendName} ${info.version || ''} ${info.state} ${info.message || ''}`.toLowerCase();
        return haystack.includes(query);
      });
      return [recipeName, filteredBackends] as [string, Array<[string, BackendInfo]>];
    })
    .filter(([, backends]) => backends.length > 0);

  if (isLoading || !recipes) {
    return <div className="left-panel-empty-state">Loading backends...</div>;
  }

  const cloudSection = (
    <CloudProvidersSection
      searchQuery={searchQuery}
      showError={showError}
      showSuccess={showSuccess}
      showWarning={showWarning}
    />
  );

  if (visibleGroups.length === 0) {
    return (
      <>
        <div className="left-panel-empty-state">No local backends match your current filter.</div>
        {cloudSection}
      </>
    );
  }

  return (
    <>
      {visibleGroups.map(([recipeName, backends]) => (
        <div key={recipeName} className="model-category">
          <div className="model-category-header static">
            <span className="category-label">{RECIPE_DISPLAY_NAMES[recipeName] || recipeName}</span>
            <span className="category-count">({backends.length})</span>
          </div>
          <div className="model-list">
            {backends.map(([backendName, info]) => (
              <ConnectedBackendRow
                key={`${recipeName}:${backendName}`}
                recipe={recipeName}
                backend={backendName}
                showError={showError}
                showSuccess={showSuccess}
                variant="full"
                sizeLabel={getBackendSizeLabel(info)}
                onOpenReleaseUrl={openExternalLink}
              />
            ))}
          </div>
        </div>
      ))}
      {cloudSection}
    </>
  );
};

export default BackendManager;

```

### Core Architecture Module: `src/app/src/renderer/ChatWindow.tsx`
```
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AppSettings,
  mergeWithDefaultSettings,
} from './utils/appSettings';
import { serverFetch } from './utils/serverConfig';
import { useModels } from './hooks/useModels';
import { useInferenceState } from './hooks/useInferenceState';
import { useToast, ToastContainer } from './Toast';
import EmbeddingPanel from './components/panels/EmbeddingPanel';
import RerankingPanel from './components/panels/RerankingPanel';
import TranscriptionPanel from './components/panels/TranscriptionPanel';
import ImageGenerationPanel from './components/panels/ImageGenerationPanel';
import TTSPanel from './components/panels/TTSPanel';
import AudioGenerationPanel from './components/panels/AudioGenerationPanel';
import Model3DPanel from './components/panels/Model3DPanel';
import LLMChatPanel from './components/panels/LLMChatPanel';
import { RefreshIcon } from './components/Icons';
import { isCollectionModel, isRouterCollection, getCollectionComponents } from './utils/collectionModels';
import AddModelPanel, { AddModelInitialValues, ModelInstallData } from './AddModelPanel';

interface ChatWindowProps {
  isVisible: boolean;
  width?: number;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isVisible, width }) => {
  const {
    modelsData,
    selectedModel,
    setSelectedModel,
    userHasSelectedModel,
    setUserHasSelectedModel,
    refresh,
  } = useModels();
  const inference = useInferenceState();
  const { toasts, removeToast, showError } = useToast();

  const [currentLoadedModel, setCurrentLoadedModel] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [showAddModelForm, setShowAddModelForm] = useState(false);
  const [addModelInitialValues, setAddModelInitialValues] = useState<AddModelInitialValues | undefined>(undefined);
  const addModelFromJSONRef = useRef<HTMLInputElement>(null);

  type ModelType = 'llm' | 'embedding' | 'reranking' | 'transcription' | 'image' | 'tts' | 'audio' | 'model3d';

  const modelType = useMemo((): ModelType => {
    if (!selectedModel) return 'llm';
    const info = modelsData[selectedModel];
    if (!info) return 'llm';
    if (isCollectionModel(info)) return 'llm';
    // Chat-indicator labels win over modality labels so multimodal "any-to-text"
    // models (e.g. Gemma 4 on FLM) — which carry both "vision" / "tool-calling"
    // AND modality labels like "transcription" — route to the LLM
    // panel rather than the Transcription/Image panel.
    const chatIndicators = ['vision', 'reasoning', 'tool-calling', 'tools'];
    if (info.labels?.some(l => chatIndicators.includes(l))) return 'llm';
    if (info.labels?.includes('embeddings') || (info as any)?.embedding) return 'embedding';
    if (info.labels?.includes('reranking') || (info as any)?.reranking) return 'reranking';
    if (info.labels?.includes('transcription')) return 'transcription';
    if (info.labels?.includes('image')) return 'image';
    if (info.labels?.includes('tts')) return 'tts';
    if (info.labels?.includes('audio-generation')) return 'audio';
    if (info.labels?.includes('3d')) return 'model3d';
    return 'llm';
  }, [selectedModel, modelsData]);

  // Lock the rendered panel type during inference so that loading a
  // different-modality model via Model Manager doesn't yank the current
  // panel out from under the user mid-inference.
  const [activeModelType, setActiveModelType] = useState<ModelType>(modelType);
  useEffect(() => {
    if (!inference.isBusy) {
      setActiveModelType(modelType);
    }
  }, [modelType, inference.isBusy]);

  const isVision = useMemo(() => {
    if (!selectedModel) return false;
    const info = modelsData[selectedModel];
    if (isCollectionModel(info)) {
      const components = getCollectionComponents(info);
      return components.some(component => modelsData[component]?.labels?.includes('vision'));
    }
    return info?.labels?.includes('vision') || false;
  }, [selectedModel, modelsData]);

  // A multimodal chat model that accepts audio *as input* to a chat turn.
  // Models with the "chat-transcription" label can handle audio in
  // /chat/completions; distinct from pure ASR (Whisper) models which serve
  // /audio/transcriptions via the "transcription" label. Collection models can
  // also expose a dedicated ASR component, so enable audio controls for those.
  const isAudioChat = useMemo(() => {
    if (!selectedModel) return false;

    const info = modelsData[selectedModel];

    if (isCollectionModel(info)) {
      return getCollectionComponents(info).some(component => {
        const labels = modelsData[component]?.labels || [];
        return labels.includes('chat-transcription') || labels.includes('transcription');
      });
    }

    const labels = info?.labels || [];
    return labels.includes('chat-transcription');
  }, [selectedModel, modelsData]);

  const isCollectionSelected = useMemo(() => {
    if (!selectedModel) return false;
    return isCollectionModel(modelsData[selectedModel]);
  }, [selectedModel, modelsData]);

  // Router collections are plain chat targets - the server routes each request
  // to a component. The agentic tool loop is a collection.omni feature; running
  // it against a router would attach tools and a system prompt to every turn,
  // skewing has_tools / length conditions in the routing policy.
  const collectionMode = activeModelType === 'llm' && isCollectionSelected &&
    !isRouterCollection(selectedModel ? modelsData[selectedModel] : undefined);

  // Use refs so the mount-once effect can read current values without re-running
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const modelsDataRef = useRef(modelsData);
  modelsDataRef.current = modelsData;
  const userHasSelectedModelRef = useRef(userHasSelectedModel);
  userHasSelectedModelRef.current = userHasSelectedModel;

  const fetchLoadedModel = useCallback(async () => {
    try {
      const response = await serverFetch('/health');
      const data = await response.json();
      if (data?.model_loaded) {
        setCurrentLoadedModel(data.model_loaded);
        const selectedInfo = selectedModelRef.current ? modelsDataRef.current[selectedModelRef.current] : undefined;
        const keepCollectionSelection = !!selectedInfo && isCollectionModel(selectedInfo);
        if (!userHasSelectedModelRef.current && !keepCollectionSelection) {
          setSelectedModel(data.model_loaded);
        }
      } else {
        setCurrentLoadedModel(null);
      }
    } catch (error) {
      console.error('Failed to fetch loaded model:', error);
    }
  }, [setSelectedModel]);

  useEffect(() => {
    fetchLoadedModel();

    const loadSettings = async () => {
      if (!window.api?.getSettings) return;
      try {
        const stored = await window.api.getSettings();
        setAppSettings(mergeWithDefaultSettings(stored));
      } catch (error) {
        console.error('Failed to load app settings:', error);
      }
    };
    loadSettings();

    const unsubscribeSettings = window.api?.onSettingsUpdated?.((updated) => {
      setAppSettings(mergeWithDefaultSettings(updated));
    });

    const handleModelLoadEnd = (event: Event) => {
      const customEvent = event as CustomEvent<{ modelId?: string }>;
      const loadedModelId = customEvent.detail?.modelId;
      if (loadedModelId) {
        setCurrentLoadedModel(loadedModelId);
        setSelectedModel(loadedModelId);
      } else {
        fetchLoadedModel();
      }
    };

    const handleModelUnload = () => {
      setCurrentLoadedModel(null);
    };

    const handleModelLoadStart = (e: CustomEvent) => {
      setSelectedModel(e.detail.modelId);
      setUserHasSelectedModel(true);
    };

    window.addEventListener('modelLoadStart' as any, handleModelLoadStart);
    window.addEventListener('modelLoadEnd' as any, handleModelLoadEnd);
    window.addEventListener('modelUnload' as any, handleModelUnload);

    const healthCheckInterval = setInterval(() => {
      fetchLoadedModel();
    }, 5000);

    return () => {
      window.removeEventListener('modelLoadStart' as any, handleModelLoadStart);
      window.removeEventListener('modelLoadEnd' as any, handleModelLoadEnd);
      window.removeEventListener('modelUnload' as any, handleModelUnload);
      clearInterval(healthCheckInterval);
      if (typeof unsubscribeSettings === 'function') {
        unsubscribeSettings();
      }
    };
  }, [fetchLoadedModel, setSelectedModel, setUserHasSelectedModel]);

  useEffect(() => {
    const handleOpenAddModel = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAddModelInitialValues(detail?.initialValues ?? undefined);
      setShowAddModelForm(true);
    };
    const handleOpenAddModelFromJSON = () => {
      addModelFromJSONRef.current?.click();
    };
    window.addEventListener('openAddModel', handleOpenAddModel);
    window.addEventListener('openAddModelFromJSON', handleOpenAddModelFromJSON);
    return () => {
      window.removeEventListener('openAddModel', handleOpenAddModel);
      window.removeEventListener('openAddModelFromJSON', handleOpenAddModelFromJSON);
    };
  }, []);

  const handleAddModelInstall = (data: ModelInstallData) => {
    setShowAddModelForm(false);
    setAddModelInitialValues(undefined);
    const modelName = data.name.startsWith('user.') ? data.name : `user.${data.name}`;
    window.dispatchEvent(new CustomEvent('installModel', {
      detail: {
        name: modelName,
        registrationData: {
          checkpoint: data.checkpoint,
          checkpoints: data.checkpoints,
          recipe: data.recipe,
          // Omitted on "Automatic" so lemond applies its default_model_source.
          ...(data.source ? { source: data.source } : {}),
          mmproj: data.mmproj,
          labels: 
```

### Core Architecture Module: `src/app/src/renderer/CloudProvidersSection.tsx`
```
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { serverConfig } from './utils/serverConfig';
import { useModels } from './hooks/useModels';

// Mirror of one entry in `/v1/system-info`'s `cloud.providers` array.
// Single source of truth lives in the server — we never read the local
// settings file for cloud config. Cloud providers are shared infrastructure
// config, not per-client UI state (see AGENTS.md invariant #11).
interface CloudProviderRow {
  name: string;
  base_url: string;
  allow_insecure_http: boolean;
  env_var: string;
  env_var_set: boolean;
  runtime_key_set: boolean;
  models_discovered: number;
  warnings: string[];
}

interface CloudProvidersSectionProps {
  searchQuery: string;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  showWarning: (msg: string) => void;
}

const QUICK_FILL: Array<{ label: string; name: string; baseUrl: string }> = [
  { label: 'Fireworks', name: 'fireworks', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  { label: 'OpenAI', name: 'openai', baseUrl: 'https://api.openai.com/v1' },
  { label: 'OpenRouter', name: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { label: 'Together', name: 'together', baseUrl: 'https://api.together.xyz/v1' },
];

const extractWarnings = (value: any): string[] => {
  if (Array.isArray(value?.warnings)) {
    return value.warnings.filter((w: any) => typeof w === 'string');
  }
  if (typeof value?.warning === 'string' && value.warning) {
    return [value.warning];
  }
  return [];
};

const isHttpBaseUrl = (value: string): boolean => value.trim().toLowerCase().startsWith('http://');

const fetchCloudProviders = async (): Promise<CloudProviderRow[]> => {
  const response = await serverConfig.fetch('/system-info');
  if (!response.ok) return [];
  const info = await response.json();
  const providers = info?.cloud?.providers;
  if (!Array.isArray(providers)) return [];
  return providers
    .filter((p: any) => p && typeof p.name === 'string')
    .map((p: any) => ({
      name: String(p.name),
      base_url: typeof p.base_url === 'string' ? p.base_url : '',
      allow_insecure_http: p.allow_insecure_http === true,
      env_var: typeof p.env_var === 'string' ? p.env_var : '',
      env_var_set: p.env_var_set === true,
      runtime_key_set: p.runtime_key_set === true,
      models_discovered: typeof p.models_discovered === 'number' ? p.models_discovered : 0,
      warnings: extractWarnings(p),
    }));
};

// Install modal — single source for both new-provider registration and
// supplying an initial key. Optional api_key because LEMONADE_<P>_API_KEY may
// already cover this provider on the server; any server warnings are surfaced
// through the shared warning toast.
interface InstallModalProps {
  onClose: () => void;
  onInstalled: () => void;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  showWarning: (msg: string) => void;
}

const InstallModal: React.FC<InstallModalProps> = ({ onClose, onInstalled, showError, showSuccess, showWarning }) => {
  const [provider, setProvider] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!provider.trim() || !baseUrl.trim()) {
      setError('Provider name and base URL are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const normalizedBaseUrl = baseUrl.trim();
      const normalizedApiKey = apiKey.trim();
      const needsInsecureOptIn = isHttpBaseUrl(normalizedBaseUrl) && !!normalizedApiKey;
      if (needsInsecureOptIn && !window.confirm('Send this API key over http://? Traffic to this provider will not be encrypted.')) {
        setBusy(false);
        return;
      }
      const body: Record<string, string | boolean> = {
        backend: 'cloud',
        provider: provider.trim(),
        base_url: normalizedBaseUrl,
      };
      if (needsInsecureOptIn) body.allow_insecure_http = true;
      if (normalizedApiKey) body.api_key = normalizedApiKey;
      const response = await serverConfig.fetch('/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        setError(`Install failed (${response.status}): ${text}`);
        setBusy(false);
        return;
      }
      const result = await response.json();
      const discovered = result?.models_discovered ?? 0;
      showSuccess(`Installed '${provider.trim()}' (${discovered} models).`);
      extractWarnings(result).forEach((warning) => showWarning(warning));
      onInstalled();
    } catch (err) {
      setError(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  }, [provider, baseUrl, apiKey, onInstalled, showSuccess, showWarning]);

  return (
    <>
      <div className="settings-header">
        <h2>Install cloud provider</h2>
        <button className="settings-close-button" onClick={onClose} title="Close">×</button>
      </div>
      <div className="settings-content">
        <span className="settings-description" style={{ display: 'block', marginBottom: '12px' }}>
          Registers an OpenAI-compatible chat provider on this lemonade server. Provider URL is
          persisted; the API key (if you supply one) lives in process memory only and dies on restart.
          For persistence across restarts, set <code>LEMONADE_&lt;PROVIDER&gt;_API_KEY</code> in
          lemond's environment instead.
        </span>

        <div className="form-section">
          <label className="form-label">Quick-fill</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {QUICK_FILL.map((q) => (
              <button
                key={q.label}
                className="settings-reset-button"
                onClick={() => { setProvider(q.name); setBaseUrl(q.baseUrl); }}
                disabled={busy}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-section">
          <label className="form-label" title="Short identifier used as the model name prefix">
            Provider name
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="fireworks"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="form-section">
          <label className="form-label" title="OpenAI-compatible base URL ending in /v1">
            Base URL
          </label>
          <input
            type="url"
            className="form-input"
            placeholder="https://api.fireworks.ai/inference/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="form-section">
          <label className="form-label" title="Optional. If unset, lemond will use LEMONADE_<PROVIDER>_API_KEY at request time.">
            API key (optional)
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type={showKey ? 'text' : 'password'}
              className="form-input"
              placeholder="Leave blank if env var is set"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <button
              className="settings-reset-button"
              onClick={() => setShowKey(!showKey)}
              disabled={busy}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="settings-footer">
        <button className="settings-reset-button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="settings-save-button" onClick={submit} disabled={busy}>
          {busy ? 'Installing…' : 'Install'}
        </button>
      </div>
    </>
  );
};

// Per-provider edit modal — sets/clears the runtime key, removes the
// provider. The base URL is not editable here because changing it makes the
// stored runtime key meaningless against the new URL; we'd rather force the
// user to uninstall + reinstall and re-authenticate explicitly.
interface EditModalProps {
  row: CloudProviderRow;
  onClose: () => void;
  onChanged: () => void;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  showWarning: (msg: string) => void;
}

const EditModal: React.FC<EditModalProps> = ({ row, onClose, onChanged, showError, showSuccess, showWarning }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveKey = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('API key cannot be empty.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const needsInsecureOptIn = isHttpBaseUrl(row.base_url) && !row.allow_insecure_http;
      if (needsInsecureOptIn && !window.confirm('Send this API key over http://? Traffic to this provider will not be encrypted.')) {
        setBusy(false);
        return;
      }
      const r = await serverConfig.fetch('/cloud/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: row.na
```

### Core Architecture Module: `src/app/src/renderer/ConfirmDialog.tsx`
```
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      // Focus the confirm button when dialog opens
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="confirm-dialog-overlay" onClick={handleOverlayClick}>
      <div className="confirm-dialog" ref={dialogRef}>
        <h3 className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-btn confirm-dialog-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            className={`confirm-dialog-btn ${danger ? 'confirm-dialog-btn-danger' : 'confirm-dialog-btn-confirm'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook for managing confirm dialogs
interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export const useConfirmDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const ConfirmDialogComponent = useCallback(() => (
    <ConfirmDialog
      isOpen={isOpen}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      danger={options.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ), [isOpen, options, handleConfirm, handleCancel]);

  return {
    confirm,
    ConfirmDialog: ConfirmDialogComponent
  };
};

export default ConfirmDialog;

```

### Core Architecture Module: `src/app/src/renderer/DownloadManager.tsx`
```
import React, { useState, useEffect } from 'react';
import { controlDownload, deleteModel, uninstallBackend, waitForDownloadStatus } from './utils/backendInstaller';
import { downloadTracker } from './utils/downloadTracker';

export interface DownloadItem {
  id: string;
  modelName: string;
  fileName: string;
  fileIndex: number;
  totalFiles: number;
  bytesDownloaded: number;
  bytesTotal: number;
  // True when bytesTotal is only the amount known so far, not the real final total.
  // Used for backend split archives or runtime follow-up steps whose later sizes are not known yet.
  bytesTotalIsLowerBound?: boolean;
  percent: number;
  status: 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled' | 'deleting';
  error?: string;
  startTime: number;
  bytesResumed: number;  // Bytes already on disk at session start (for accurate speed)
  abortController?: AbortController;
  downloadType?: 'model' | 'backend';
  // Components when this download is a collection.
  // UI uses this to explain the collection is made up of separate models.
  collectionComponents?: string[];
  // Declared size from the model registry (bytes). Used as the total when the
  // server doesn't emit a cumulative download size, instead of extrapolating
  // from the first file or two (which overshoots badly for FLM pulls).
  declaredTotalBytes?: number;
  // Server-owned jobs can be terminal from the UI point of view while the
  // worker is still unwinding. Keep this so resume waits until pause is real.
  running?: boolean;
  // Smoothed/last-sample speed from the tracker. Calculated from byte deltas
  // between progress snapshots so restored/skipped bytes do not inflate speed.
  speedBytesPerSecond?: number;
  speedSampleTime?: number;
  speedSampleBytes?: number;
  updatedAt?: number;
}

interface DownloadManagerProps {
  isVisible: boolean;
  onClose: () => void;
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ isVisible, onClose }) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => downloadTracker.getActiveDownloads());
  const [expandedDownloads, setExpandedDownloads] = useState<Set<string>>(new Set());
  // Track models that are currently being deleted to prevent retry during cleanup
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());

  const getPanelDownloads = (): DownloadItem[] => downloadTracker.getActiveDownloads();

  const forceServerSync = async (): Promise<DownloadItem[]> => {
    await downloadTracker.hydrateFromServer();
    return getPanelDownloads();
  };

  useEffect(() => {
    // Listen for download events from the global download tracker
    const handleDownloadUpdate = (event: CustomEvent<DownloadItem>) => {
      const downloadItem = event.detail;
      setDownloads(prev => {
        const existingIndex = prev.findIndex(d => d.id === downloadItem.id);
        if (existingIndex >= 0) {
          const newDownloads = [...prev];
          newDownloads[existingIndex] = downloadItem;
          return newDownloads;
        } else {
          // Remove any previous downloads for this model before adding the new one
          const filtered = prev.filter(d => d.modelName !== downloadItem.modelName);
          return [downloadItem, ...filtered];
        }
      });
    };

    const handleDownloadComplete = (event: CustomEvent<{ id: string }>) => {
      const { id } = event.detail;
      setDownloads(prev => prev.map(d =>
        d.id === id ? { ...d, status: 'completed' as const, percent: 100 } : d
      ));
    };

    const handleDownloadError = (event: CustomEvent<{ id: string; error: string }>) => {
      const { id, error } = event.detail;
      setDownloads(prev => prev.map(d =>
        d.id === id ? { ...d, status: 'error' as const, error } : d
      ));
    };

    const handleDownloadRemoved = (event: CustomEvent<{ id: string }>) => {
      const { id } = event.detail;
      setDownloads(prev => prev.filter(d => d.id !== id));
    };

    const handleDownloadSnapshot = () => {
      setDownloads(getPanelDownloads());
    };

    window.addEventListener('download:update' as any, handleDownloadUpdate);
    window.addEventListener('download:complete' as any, handleDownloadComplete);
    window.addEventListener('download:error' as any, handleDownloadError);
    window.addEventListener('download:removed' as any, handleDownloadRemoved);
    window.addEventListener('download:snapshot' as any, handleDownloadSnapshot);

    downloadTracker.connectServerEvents();
    void forceServerSync().then(setDownloads);

    return () => {
      window.removeEventListener('download:update' as any, handleDownloadUpdate);
      window.removeEventListener('download:complete' as any, handleDownloadComplete);
      window.removeEventListener('download:error' as any, handleDownloadError);
      window.removeEventListener('download:removed' as any, handleDownloadRemoved);
      window.removeEventListener('download:snapshot' as any, handleDownloadSnapshot);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    void forceServerSync().then(setDownloads);
  }, [isVisible]);

  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(
      Math.max(Math.floor(Math.log(bytes) / Math.log(k)), 0),
      sizes.length - 1,
    );
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTotalBytes = (download: DownloadItem): string => {
    if (download.bytesTotalIsLowerBound && download.bytesTotal > 0) {
      return `${formatBytes(download.bytesTotal)}+`;
    }
    return formatBytes(download.bytesTotal);
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '--';
    if (bytesPerSecond < 1) return '<1 B/s';
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const getDownloadDisplayName = (modelName: string): string => {
    return modelName.startsWith('user.') ? modelName.slice('user.'.length) : modelName;
  };

  const calculateSpeed = (download: DownloadItem): number => {
    if (typeof download.speedBytesPerSecond === 'number') {
      return Math.max(0, download.speedBytesPerSecond);
    }

    const elapsedSeconds = (Date.now() - download.startTime) / 1000;
    if (elapsedSeconds === 0) return 0;
    // Only count bytes downloaded in this session, not bytes already on disk from a prior run
    const sessionBytes = download.bytesDownloaded - (download.bytesResumed || 0);
    return Math.max(0, sessionBytes) / elapsedSeconds;
  };

  const calculateETA = (download: DownloadItem): string => {
    if (download.status !== 'downloading' || download.bytesDownloaded === 0) {
      return '--';
    }

    // Unknown lower-bound totals cannot produce a meaningful remaining-time estimate.
    if (download.bytesTotalIsLowerBound) {
      return '--';
    }

    const speed = calculateSpeed(download);
    if (!Number.isFinite(speed) || speed < 1) return '--';

    const remainingBytes = download.bytesTotal - download.bytesDownloaded;

    // Handle edge case where bytesDownloaded > bytesTotal (incomplete byte tracking)
    if (remainingBytes <= 0) return '--';

    const remainingSeconds = remainingBytes / speed;

    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}s`;
    } else if (remainingSeconds < 3600) {
      return `${Math.round(remainingSeconds / 60)}m`;
    } else {
      return `${Math.round(remainingSeconds / 3600)}h`;
    }
  };

  const isFinalizingDownload = (download: DownloadItem): boolean => {
    return download.status === 'downloading' &&
      !download.bytesTotalIsLowerBound &&
      download.bytesTotal > 0 &&
      download.bytesDownloaded >= download.bytesTotal;
  };

  const isServerDownloadId = (downloadId?: string): boolean =>
    downloadId?.startsWith('model:') === true || downloadId?.startsWith('backend:') === true;

  const usesServerDownloadControl = (download: DownloadItem | undefined, downloadId?: string): boolean => {
    return download?.downloadType === 'model' ||
      download?.downloadType === 'backend' ||
      isServerDownloadId(download?.id ?? downloadId);
  };

  const hasLocalDownloadOwner = (download: DownloadItem): boolean => {
    return !!download.abortController && !download.abortController.signal.aborted;
  };

  const handlePauseDownload = async (download: DownloadItem) => {
    // UI feedback must be immediate. Keep the tracker owner intact until the
    // server confirms; otherwise the local fallback cannot abort the owner.
    setDownloads(prev => prev.map(d =>
      d.id === download.id ? { ...d, status: 'paused' as const, running: true } : d
    ));

    if (!usesServerDownloadControl(download)) {
      downloadTracker.requestPause(download.id);
      return;
    }

    try {
      const snapshot = await controlDownload(download.id, 'pause');
      if (snapshot) {
        downloadTracker.applyServerDownload(snapshot);
      }
    } catch (error) {
      console.error('Error pausing model download via server registry:', error);
      if (hasLocalDownloadOwner(download)) {
        downloadTracker.requestPause(download.id);
        return;
      }

      alert('Could not pause the server-owned download. Refreshing download state.');
      void forceServerSync().then(setDownloads);
    }
  };

  const waitForLocalDownloadCleanup = (download: DownloadItem, timeoutMs = 30000): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const cleanup = () => {
        window.removeEventListener('download:cleanup-complete' as any, handler);
        clearTimeout(timeout);
      };

      const handler = (event: CustomEvent) => {
        if (event.detail?.id === download.id || event.detail?.modelName === download.modelName) {
          cleanup();
          resolve(true);
        }
      };

      const timeout = setTimeo
```

### Core Architecture Module: `src/app/src/renderer/LogsWindow.tsx`
```
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { getAPIKey, getServerBaseUrl, onServerUrlChange, serverConfig, serverFetch } from './utils/serverConfig';
import { connectLogStream, LogEntry, LogStreamHandle } from './utils/logWebSocketClient';

interface LogsWindowProps {
  isVisible: boolean;
  height?: number;
}

const BOTTOM_FOLLOW_THRESHOLD_PX = 60;
const LOG_LEVELS = ['trace', 'debug', 'info', 'warning', 'error', 'fatal', 'none'] as const;
type LogLevel = typeof LOG_LEVELS[number];

const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && LOG_LEVELS.includes(value as LogLevel);

const LogsWindow: React.FC<LogsWindowProps> = ({ isVisible, height }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [autoScroll, setAutoScroll] = useState(true);
  const [logLevel, setLogLevel] = useState<LogLevel>('info');
  const [isSettingLogLevel, setIsSettingLogLevel] = useState(false);
  const [serverSupportsLogLevel, setServerSupportsLogLevel] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContentRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const lastSeqRef = useRef<number | null>(null);
  const socketRef = useRef<LogStreamHandle | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  const isNearBottom = () => {
    const logsContent = logsContentRef.current;
    if (!logsContent) return true;
    return (
      logsContent.scrollHeight - logsContent.scrollTop <=
      logsContent.clientHeight + BOTTOM_FOLLOW_THRESHOLD_PX
    );
  };

  const scrollToBottom = () => {
    if (!logsEndRef.current) return;

    isProgrammaticScrollRef.current = true;
    logsEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });

    // Keep programmatic-scroll guard through the next paint.
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  };

  // Initialize server configuration and load the current log level
  useEffect(() => {
    const init = async () => {
      await serverConfig.waitForInit();
      const url = getServerBaseUrl();
      setServerUrl(url);
      setIsInitialized(true);

      try {
        const response = await serverFetch('/internal/config');
        if (!response.ok) return;

        const config = await response.json();
        if ('log_level' in config) {
          setServerSupportsLogLevel(true);
          if (isLogLevel(config.log_level)) {
            setLogLevel(config.log_level);
          }
        }
      } catch (error) {
        console.error('Failed to load log level:', error);
      }
    };

    init();
  }, []);

  // Listen for URL changes (covers both port changes and explicit URL updates)
  useEffect(() => {
    const unsubscribe = onServerUrlChange((newUrl: string) => {
      console.log('Server URL changed, updating logs URL:', newUrl);
      setServerUrl(newUrl);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive (if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  // Detect if user scrolls up (disable auto-scroll) or scrolls to bottom (enable auto-scroll)
  useEffect(() => {
    const logsContent = logsContentRef.current;
    if (!logsContent) return;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      const isAtBottom = isNearBottom();
      setAutoScroll((prev) => (prev === isAtBottom ? prev : isAtBottom));
    };

    logsContent.addEventListener('scroll', handleScroll);
    return () => logsContent.removeEventListener('scroll', handleScroll);
  }, []);

  const appendEntries = (incomingEntries: LogEntry[]) => {
    if (incomingEntries.length === 0) {
      return;
    }

    if (!autoScrollRef.current && isNearBottom()) {
      setAutoScroll(true);
    }

    setLogs((prevLogs) => {
      const lastSeq = prevLogs.length > 0 ? prevLogs[prevLogs.length - 1].seq : -1;
      const newEntries = incomingEntries.filter((e) => e.seq > lastSeq);
      if (newEntries.length === 0) {
        return prevLogs;
      }

      lastSeqRef.current = newEntries[newEntries.length - 1].seq;
      const combined = [...prevLogs, ...newEntries];
      return combined.length > 1000 ? combined.slice(-1000) : combined;
    });
  };

  // Connect to websocket log stream
  useEffect(() => {
    if (!isVisible || !isInitialized || !serverUrl) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    const connectToLogStream = () => {
      try {
        setConnectionStatus('connecting');

        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }

        connectLogStream(lastSeqRef.current, {
          onConnected: () => {
            console.log('Log stream connected to:', serverUrl);
            setConnectionStatus('connected');
          },
          onDisconnected: () => {
            if (isVisible) {
              setConnectionStatus('error');
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log('Attempting to reconnect to log stream...');
                connectToLogStream();
              }, 5000);
            } else {
              setConnectionStatus('disconnected');
            }
          },
          onError: (message) => {
            console.error('Log stream error:', message);
            setConnectionStatus('error');
          },
          onSnapshot: (entries) => {
            appendEntries(entries);
          },
          onEntry: (entry) => {
            appendEntries([entry]);
          },
        }).then((handle) => {
          socketRef.current = handle;
        }).catch((error) => {
          console.error('Failed to connect to log stream:', error);
          setConnectionStatus('error');

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect to log stream...');
            connectToLogStream();
          }, 5000);
        });
      } catch (error) {
        console.error('Failed to connect to log stream:', error);
        setConnectionStatus('error');

        reconnectTimeoutRef.current = setTimeout(() => {
          connectToLogStream();
        }, 5000);
      }
    };

    // Initial connection
    connectToLogStream();

    // Cleanup on unmount or when visibility changes
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isVisible, serverUrl, isInitialized]);

  const handleClearLogs = () => {
    setLogs([]);
    lastSeqRef.current = null;
  };

  const handleScrollToBottom = () => {
    setAutoScroll(true);
    scrollToBottom();
  };

  const handleLogLevelChange = async (nextLevel: LogLevel) => {
    if (!isLogLevel(nextLevel)) {
      return;
    }

    const previousLevel = logLevel;
    setLogLevel(nextLevel);
    setIsSettingLogLevel(true);

    try {
      const response = await serverFetch('/internal/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_level: nextLevel }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const applied = data?.updated?.log_level;
      if (isLogLevel(applied)) {
        setLogLevel(applied);
      }
    } catch (error) {
      console.error('Failed to update log level:', error);
      setLogLevel(previousLevel);
    } finally {
      setIsSettingLogLevel(false);
    }
  };

  const getSeverityPriority = (level: string): number => {
    const p: Record<string, number> = {
      'trace': 0,
      'debug': 1,
      'info': 2,
      'warning': 4,
      'warn': 4,
      'error': 5,
      'fatal': 6,
      'none': 10
    };
    return p[level.toLowerCase()] ?? 2; // Default to info
  };

  const filteredLogs = useMemo(() => {
    if (logLevel === 'none') return [];
    const threshold = getSeverityPriority(logLevel);
    return logs.filter((log: LogEntry) => getSeverityPriority(log.severity) >= threshold);
  }, [logs, logLevel]);

  if (!isVisible) return null;

  return (
    <div className="logs-window" style={height ? { height: `${height}px`, flex: 'none' } : undefined}>
      <div className="logs-header">
        <h3>Server Logs</h3>
        <div className="logs-controls">
          {serverSupportsLogLevel && (
            <label className="logs-level-control">
              <span>Level</span>
              <select
                className="logs-level-select form-input form-select"
                value={logLevel}
                disabled={isSettingLogLevel}
                onChange={(event) => handleLogLevelChange(event.target.value as LogLevel)}
                title="Set server log level"
              >
                {LOG_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
          )}
          <span className={`connection-status status-${connectionStatus}`}>
           
```

### Core Architecture Module: `src/app/src/renderer/MarkdownMessage.tsx`
```
import React, { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { writeClipboard } from './utils/clipboardUtils';

interface MarkdownMessageProps {
  content: string;
  isComplete?: boolean;
}

const COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isComplete = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const copyTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const maxStreamHeightRef = useRef(0);
  const [streamMinHeight, setStreamMinHeight] = useState<number | undefined>(undefined);

  const md = useMemo(() => {
    const mdInstance = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      breaks: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(str, { language: lang }).value;
          } catch (__) {
            // ignore
          }
        }
        return ''; // use external default escaping
      }
    });

    // Add math support with KaTeX
    mdInstance.use(texmath, {
      engine: katex,
      delimiters: 'dollars',
      katexOptions: {
        throwOnError: false,
        displayMode: false
      }
    });

    return mdInstance;
  }, []);

  const htmlContent = useMemo(() => {
    const rendered = md.render(content);

    if (!isComplete) {
      return rendered;
    }

    // Use DOM manipulation to wrap each <pre> block with a wrapper div and add copy button
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = rendered;

    const preElements = tempContainer.querySelectorAll('pre');
    preElements.forEach((pre) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const button = document.createElement('button');
      button.className = 'code-copy-button';
      button.title = 'Copy code';
      button.innerHTML = COPY_ICON_SVG;

      const parent = pre.parentNode;
      if (!parent) {
        return;
      }

      parent.insertBefore(wrapper, pre);
      wrapper.appendChild(button);
      wrapper.appendChild(pre);
    });

    const result = tempContainer.innerHTML;
    // Clean up tempContainer to help GC
    tempContainer.innerHTML = '';
    return result;
  }, [content, md, isComplete]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isComplete) {
      maxStreamHeightRef.current = 0;
      setStreamMinHeight(undefined);
      return;
    }

    const measureAndLock = () => {
      const currentHeight = container.scrollHeight;
      // Keep height monotonic while streaming to avoid 1-line markdown reflow jitter.
      if (currentHeight > maxStreamHeightRef.current) {
        maxStreamHeightRef.current = currentHeight;
        setStreamMinHeight(currentHeight);
      }
    };

    measureAndLock();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        measureAndLock();
      });
      observer.observe(container);
    }

    return () => {
      observer?.disconnect();
    };
  }, [htmlContent, isComplete]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSafeUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url, 'https://example.com/');
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    // Add click handlers for links to open in external browser
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A') {
        e.preventDefault();
        const href = target.getAttribute('href');
        if (href) {
          // Open documentation pages in-app via iframe
          if (href.endsWith('.html') && (href.includes('lemonade-server.ai') || href.startsWith('/'))) {
            window.dispatchEvent(new CustomEvent('open-external-content', { detail: { url: href } }));
            return;
          }
          if (window.api && isSafeUrl(href)) {
            window.api.openExternal(href);
          }
        }
      }
    };

    // Add click handlers for copy buttons
    const handleCopyClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('.code-copy-button') as HTMLButtonElement;
      if (!button) return;

      const wrapper = button.closest('.code-block-wrapper');
      const preElement = wrapper?.querySelector('pre');
      const codeElement = preElement?.querySelector('code') as HTMLElement | null;
      if (!codeElement) return;
      const codeText = codeElement.textContent || '';

      try {
        await writeClipboard(codeText);
        button.innerHTML = CHECK_ICON_SVG;
        button.classList.add('copied');

        // Clear any existing timeout before setting a new one
        if (copyTimeoutIdRef.current) {
          clearTimeout(copyTimeoutIdRef.current);
        }

        copyTimeoutIdRef.current = setTimeout(() => {
          // Check if button still exists in DOM before modifying
          if (button.isConnected) {
            button.innerHTML = COPY_ICON_SVG;
            button.classList.remove('copied');
          }
          copyTimeoutIdRef.current = null;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    };

    container.addEventListener('click', handleLinkClick);
    container.addEventListener('click', handleCopyClick);
    return () => {
      container.removeEventListener('click', handleLinkClick);
      container.removeEventListener('click', handleCopyClick);
      // Clean up the timeout when component unmounts
      if (copyTimeoutIdRef.current) {
        clearTimeout(copyTimeoutIdRef.current);
      }
    };
  }, [htmlContent]);

  return (
    <div
      ref={containerRef}
      className="markdown-content"
      style={streamMinHeight ? { minHeight: `${streamMinHeight}px` } : undefined}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default MarkdownMessage;

```

### Core Architecture Module: `src/app/src/renderer/MarketplacePanel.tsx`
```
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ExternalLink } from './components/Icons';
import { MarketplaceApp, MarketplaceCategory, APPS_JSON_URL } from './utils/marketplace';

interface MarketplacePanelProps {
  searchQuery: string;
  selectedCategory: string;
  onCategoriesLoaded?: (categories: MarketplaceCategory[]) => void;
}

const MarketplacePanel: React.FC<MarketplacePanelProps> = ({ searchQuery, selectedCategory, onCategoriesLoaded }) => {
  const [marketplaceApps, setMarketplaceApps] = useState<MarketplaceApp[]>([]);
  const [marketplaceCategories, setMarketplaceCategories] = useState<MarketplaceCategory[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const onCategoriesLoadedRef = useRef(onCategoriesLoaded);
  onCategoriesLoadedRef.current = onCategoriesLoaded;

  useEffect(() => {
    let isMounted = true;

    const fetchMarketplaceApps = async () => {
      setMarketplaceLoading(true);
      setMarketplaceError(null);

      try {
        const response = await fetch(APPS_JSON_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch marketplace apps: HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!isMounted) return;

        const apps: MarketplaceApp[] = Array.isArray(data?.apps) ? data.apps : [];
        const categories: MarketplaceCategory[] = Array.isArray(data?.categories) ? data.categories : [];
        setMarketplaceApps(apps);
        setMarketplaceCategories(categories);
        onCategoriesLoadedRef.current?.(categories);
      } catch (error) {
        if (!isMounted) return;
        setMarketplaceError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        if (isMounted) {
          setMarketplaceLoading(false);
        }
      }
    };

    fetchMarketplaceApps();
    return () => {
      isMounted = false;
    };
  }, []);

  const openExternalLink = (url?: string) => {
    if (!url) return;
    // Open documentation pages in-app via iframe
    if (url.endsWith('.html') && (url.includes('lemonade-server.ai') || url.startsWith('/'))) {
      window.dispatchEvent(new CustomEvent('open-external-content', { detail: { url } }));
      return;
    }
    if (window.api?.openExternal) {
      window.api.openExternal(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredApps = useMemo(() => {
    return marketplaceApps
      .filter((app) => {
        if (selectedCategory !== 'all') {
          return Array.isArray(app.category) && app.category.includes(selectedCategory);
        }
        return true;
      })
      .filter((app) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          app.name.toLowerCase().includes(query) ||
          (app.description || '').toLowerCase().includes(query) ||
          (app.category || []).some(category => category.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name));
  }, [marketplaceApps, searchQuery, selectedCategory]);

  if (marketplaceLoading) {
    return <div className="left-panel-empty-state">Loading marketplace apps...</div>;
  }
  if (marketplaceError) {
    return <div className="left-panel-empty-state">Marketplace unavailable: {marketplaceError}</div>;
  }
  if (filteredApps.length === 0) {
    return <div className="left-panel-empty-state">No apps match your current filter.</div>;
  }

  return (
    <div className="left-panel-row-list">
      {filteredApps.map((app) => (
        <div key={app.id} className="left-panel-row-item marketplace-app-card">
          <div className="left-panel-row-main marketplace-app-main">
            <div className="left-panel-app-icon-wrap">
              {app.logo ? (
                <img className="left-panel-app-icon" src={app.logo} alt={app.name} />
              ) : (
                <span className="left-panel-app-fallback">{app.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="left-panel-row-text marketplace-app-content">
              <div className="marketplace-title-row">
                <div className="left-panel-row-title marketplace-app-title">{app.name}</div>
                {Array.isArray(app.category) && app.category.length > 0 && (
                  <div className="marketplace-app-categories">{app.category[0]}</div>
                )}
              </div>
              <div className="left-panel-row-meta marketplace-app-description">{app.description || 'No description available'}</div>
              {(app.links?.guide || app.links?.video || app.links?.app) && (
                <div className="left-panel-row-actions marketplace-app-actions">
                  {app.links?.app && (
                    <button className="left-panel-link-btn primary" title="Visit app" onClick={() => openExternalLink(app.links?.app)}>
                      <ExternalLink size={12} strokeWidth={1.9} />
                      <span>Visit</span>
                    </button>
                  )}
                  {app.links?.guide && (
                    <button className="left-panel-link-btn" title="Open guide" onClick={() => openExternalLink(app.links?.guide)}>
                      <BookOpen size={12} strokeWidth={1.9} />
                      <span>Guide</span>
                    </button>
                  )}
                  {app.links?.video && (
                    <button className="left-panel-link-btn" title="Watch video" onClick={() => openExternalLink(app.links?.video)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
                      </svg>
                      <span>Video</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export { MarketplaceCategory };
export default MarketplacePanel;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3741** (2026-10-04): **fix(server): merge args options must take into account per-model saved option**
  *Symptoms*: ## Spec Driven Development  This PR: - [x] fixes something <!-- (closes #issue-number) --> and does not need a WG/RFC.  ## Summary  `GET /v1/models/{id}/options` reports an empty `effective.<recipe>_args` even when non-empty args are saved in `recipe_options.json`, and a subsequent load silently drops the user's saved args.  `resolve_scoped_custom_args()` handled `merge_args=false` by returning `""` whenever the request did not carry an explicit `*_args` value. That wipes **all** layers, but `merge_args=false` is only meant to suppress the *inherited* layers (backend, architecture, model defaults). The model's own saved entry is a direct per-model setting (priority layer 2 in the load docs) and must survive.  Repro (any llamacpp model): 1. `POST /v1/models/<id>/options -d '{"llamacpp_args":"--temp 1.0","merge_args":false}'` 2. `GET /v1/models/<id>/options` → `saved.llamacpp_args` is `"--temp 1.0"` but `effective.llamacpp_args` is `""`  The fix keeps the three-state request semantics intact: an explicit request value still wins, an explicit `null` tombstone still clears to `""`, and only an omitted request falls through to the saved per-model args instead of `""`.  ## Scope  - [x] This PR addresses one clear issue or change. - [x] I reviewed the full diff myself before submitting. - [x] I removed unrelated local changes. - [x] I kept refactoring separate unless it is required for this change.  ## Testing  - [x] The code change has been locally tested.
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/lemonade-sdk/lemonade/pull/3741?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Repository UI - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `ff41376f-385d-4e1a-9120-52e6b41622ba`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from t
  > I think current behavior is the intended one. @fl0rianr can you confirm?

- **Issue #3730** (2026-10-02): **fix(http): make download stall timeouts follow global_timeout**
  *Symptoms*: A couple parts of our download stack were ignoring `global_timeout`, this PR makes them respect it.  Why now, and why in this PR stack: Devlab Dispatch's Hugging Face proxy answers a cold 124 GB Halogen checkpoint request only after fetching it upstream, so every 60 s attempt was dropped before its headers arrived (#3712's Halogen leg).  ## Breaking Changes  - [ ] This PR introduces breaking changes. - [x] This PR does not introduce breaking changes. 

- **Issue #3726** (2026-10-02): **fix(server): watch extra_models_dir's nested folders on Linux and macOS**
  *Symptoms*: ## Spec Driven Development  This PR: - [x] fixes something and does not need a WG/RFC. - [ ] is within the scope of WG: - [ ] has approved RFC #  ## Summary  `DirectoryWatcher` (introduced by @superm1 some time ago) only monitors the top level of `extra_models_dir` on Linux and macOS, which means it can miss deep changes or switching a cache repo's `refs/main`. The Windows did not have that issue.  Why now, why in this stack: this stack adds support for Hugging Face and ModelScope caches in `extra_models_dir`, which would not work very well with `DirectoryWatcher`'s shallow monitoring.  This PR fixes: - Linux: every folder below the root gets an inotify watch, including folders created later; nested watches omit `IN_MODIFY`, so a file being downloaded fires once on close - macOS: kqueue replaced with FSEvents, which is recursive; recursive kqueue would need one descriptor per folder  Raised by @fl0rianr in review of #3635. It sits at the bottom of that stack because #3635's `refs/main` test depends on it.  ## Scope  - [x] This PR addresses one clear issue or change. - [x] I reviewed the full diff myself before submitting. - [x] I removed unrelated local changes. - [x] I kept refactoring separate unless it is required for this change.  ## Testing  - [x] The code change has been locally tested.  _Testing details:_  | Check | Result | |---|---| | 2 new `test_directory_watcher` cases (nested change, folder created after start) without the fix | b
  **Post-Mortem & Fix Analysis**:
  > `Test CLI/Endpoints (ubuntu-latest)` and `Test CLI/Endpoints (windows-latest)` are red on `e69c3e5`, but not because of this PR. Every failing test fails in setup while pulling a model, with `Hugging Face API returned status 429 for unsloth/gemma-3-270m-it-GGUF` starting at about 15:54 UTC (`server_jobs.py`, `test_ollama.py`, `server_endpoints.py`, `server_router.py`, `server_cli2.py`, `test_gpu_hang_retry.py`). The `extra_models_dir` tests passed, and the macOS jobs, the only ones that exercise `e69c3e5`'s change, are all green. No code fix exists or is needed. I can't re-run jobs from here (403), so a maintainer needs to re-run the failed jobs of [run 36885974107](https://github.com/lemonade-sdk/lemonade/actions/runs/36885974107) once the rate limit clears. It would be sweet to see it come back green.  --- _Generated by [Claude Code](https://claude.ai/code)_
  > Sure, re-run makes sense, but since also all follow-up PRs depend on this one I would prefer a review ready version - are we ready for review?
  > I am waiting for CI to be green on the whole stack before bringing this one out of draft. The implementation on macOS is a little tricky, and the debug cycle is long.

- **Issue #3717** (2026-09-30): **(ci): llamacpp GPU assertion checks**
  *Symptoms*: ## Summary  This PR only touches the **auto-bump llamacpp** workflow. It runs once a week and updates the `llamacpp` pins with the latest binaries.  This weekly **llama.cpp auto-bump PR** checked that models *ran*, but not that they ran on the **GPU** when a GPU backend is selected. CI tests are added though this PR to capture silent CPU fallback of any `llamacpp` binary. We can then merge/close the PR after a manual review.  - **Per-model GPU offload check.** For each model × backend, llama-server's device logs are scanned and recorded:   - `PASS ✅` = GPU offload   - `FAIL ❌` = fallback to CPU - `llama-server` now passes **`-lv 4` in debug mode** (`llamacpp_server.cpp`) so that it emits its device-selection lines. These lines are grepped to ensure that the model is actually offloaded to the GPU.    - The device-selection lines are suppressed by default when no explicit verbose flag is passed. - **Results table reworked** - grouped by model, one row per backend (vulkan / rocm stable / rocm nightly), with the new GPU column. - **Hard-fail on unverifiable GPU runs**   ## Scope  - [x] This PR addresses one clear issue or change. - [x] I reviewed the full diff myself before submitting. - [x] I removed unrelated local changes. - [x] I kept refactoring separate unless it is required for this change.   ## Documentation  - [x] Documentation is not affected by this change. - [ ] Documentation is affected and has been updated.  ## Breaking Changes  - [ ] T
  **Post-Mortem & Fix Analysis**:
  > Closing this PR in favor of #3718. All required changes have been committed there, including the move to a shared helper function as @jeremyfowers suggested.

- **Issue #3716** (2026-10-02): **Don't fail HTTPS requests on Windows when cert revocation status is unknown**
  *Symptoms*: ## Spec Driven Development  This PR: - [x] fixes something and does not need a WG/RFC. - [ ] is within the scope of WG: - [ ] has approved RFC #  ## Summary  On Windows, curl uses Schannel to make HTTPS connections. Schannel checks whether the server's certificate has been revoked (via CRL/OCSP) by default, and curl's Schannel backend treats "couldn't check revocation" as a hard connection failure not just "couldn't verify trust."  Private/internal CAs (the kind used for internal company servers) usually don't run a CRL/OCSP responder at all. So registering a cloud provider secured by an internal CA failed every single request with a generic "SSL connect error," even though the certificate was completely valid and its CA was trusted.   The fix sets `CURLOPT_SSL_OPTIONS` to `CURLSSLOPT_REVOKE_BEST_EFFORT` in `apply_http_security_policy()`. This still checks revocation when a responder is reachable, it just stops treating "no responder available" as fatal. Certificate signature, chain-of-trust, and hostname validation are unaffected.  ## Scope  - [x] This PR addresses one clear issue or change. - [x] I reviewed the full diff myself before submitting. - [x] I removed unrelated local changes. - [x] I kept refactoring separate unless it is required for this change.  ## Testing  - [x] The code change has been locally tested. <img width="1434" height="898" alt="image" src="https://github.com/user-attachments/assets/76bdcc66-58bb-4f0d-8cb7-d8bc7fce7206" /> 

- **Issue #3686** (2026-09-30): **`lemonade bench` "no suitable backends" error**
  *Symptoms*: `lemonade bench` currently only works with backends that are already installed, and displays a non-actionable error message if no backends are installed.  Reproduction: 1. Download and untar a fresh copy of embeddable lemonade 2. `./lemond ./ ./` start lemond with no backends preinstalled 3. `lemonade bench --backend rocm --scenarios chat Qwen3.5-4B-GGUF` 4. `Error: No suitable backends found for model 'Qwen3.5-4B-GGUF'.`  The workaround is to `./lemonade backends install llamacpp:rocm` between steps 2 and 3 above.  There are two ways to make this actionable for users: 1. Change the error message to suggest a specific backend install command that would get the user unblocked. 2. Install the backend on behalf of the user.  @bitgamma would you kindly implement one or the other? Appreciate it!
  **Post-Mortem & Fix Analysis**:
  > I think I'll do both:  1. if --backend is passed explicitly => try to install automatically 2. if not, and no backend is found => suggest to manually install a backend using the appropriate command.  @jeremyfowers do you agree with this plan?

- **Issue #3684** (2026-09-29): **fix(config): reject invalid backend-specific keys**
  *Symptoms*: ## Spec Driven Development  This PR: - [x] fixes something (closes #3678) and does not need a WG/RFC. - [ ] is within the scope of WG: - [ ] has approved RFC #  ## Summary  Closes #3678  | | before | after | |---|---|---| | `validate_backend` `_bin` / `_args` check | `key.find("_bin")` / `key.find("_args")` substring match | `<variant>_bin` / `<variant>_args` where `<variant>` is in the section descriptor's `bin_variants` / `arg_variants` or `support` backends | | `flm.flm_bin`, `flm.random_bin`, `flm.foo_args` | accepted, never read | `Unknown key: 'flm.<key>'` | | `flm.npu_bin`, `llamacpp.metal_bin`, `llamacpp.cuda_args`, `llamacpp.args` | accepted | accepted |  ## Scope  - [x] This PR addresses one clear issue or change. - [x] I reviewed the full diff myself before submitting. - [x] I removed unrelated local changes. - [x] I kept refactoring separate unless it is required for this change.  ## Testing  - [x] The code change has been locally tested.  _Testing details:_  | command | result | |---|---| | `test/cpp/test_runtime_config_backend_validation.cpp` (20 cases via `RuntimeConfig::set()`) | pass | | `ctest --test-dir build -L "^cpp-ci$"` | 72/72 pass | | `test/server_endpoints.py` `test_066_backend_bin_and_args_keys_must_name_a_real_variant` vs live `lemond` | pass | | `lemonade config set flm.flm_bin=builtin` / `flm.npu_bin=builtin` | rejected / accepted | | `pre-commit`, `gen_backend_boilerplate.py --check` | pass |  ## Documentati

- **Issue #3682** (2026-09-29): **Kokoro: British and French voices return ~0.3s of audio regardless of input**
  *Symptoms*: Five Kokoro voices return a fixed ~0.3s of audio no matter what text you send. All the others work.  ``` curl -s localhost:8000/api/v1/audio/speech -H 'Content-Type: application/json' \   -d '{"model":"kokoro-v1","voice":"bm_george","input":"The quick brown fox jumps over the lazy dog today.","response_format":"wav"}' -o out.wav ffprobe -v error -show_entries format=duration -of csv=p=0 out.wav ```  Duration for the same sentence, one voice per row:  ``` af_heart     3.75    bf_emma       0.33 af_bella     4.13    bf_isabella   0.30 af_nicole    5.30    bm_george     0.33 af_sarah     4.23    bm_lewis      0.45 am_michael   4.28    ff_siwis      0.50 am_adam      3.85 am_onyx      4.20 ef_dora      3.15 em_alex      3.25 if_sara      3.40 im_nicola    3.78 pf_dora      3.33 pm_alex      3.35 jf_alpha    11.97 zf_xiaobei   4.70 hf_alpha     4.23 ```  So it's the four British English voices plus the French one. Spanish, Italian, Portuguese, Japanese, Mandarin and Hindi are all fine.  It's not text-dependent — `bm_george` gives 0.325s for a 10-word sentence and 0.325s for a 35-word one, while `am_michael` goes 4.28s -> 14.10s on the same pair. Looks like a fixed stub rather than truncated synthesis.  Returns HTTP 200 with a valid WAV, so nothing signals a failure. Anything scripted against it just gets silence.  Guessing the voice embeddings are missing from the bundled `voices-v1.0.bin`, but I can't check — the file isn't readable under `/var/cache/lemonade`.  Related but not t
  **Post-Mortem & Fix Analysis**:
  > This is the leftover half of #1925. The `ESPEAK_DATA_PATH` fix landed, but the `espeak-ng-data` we bundle with koko b17 has no `en-gb` or `fr-fr` voice entries, so phonemization returns nothing and you just get the padding clip.  In the short term until we ship a fixed Kokoros build, you can symlink them under `/var/lib/lemonade/.cache/lemonade/bin/kokoro/cpu/espeak-ng-data`: `ln -s en-GB-x-rp lang/gmw/en-gb` and `ln -s fr lang/roa/fr-fr`, then restart `lemond`.   Can you confirm that fixes all five voices for you? I will open another issue once you confirm the fix.
  > Confirmed, all five work. Same sentence and command as the report:  ``` bf_emma      0.33 -> 3.65 bf_isabella  0.30 -> 3.95 bm_george    0.33 -> 4.47 bm_lewis     0.45 -> 4.38 ff_siwis     0.50 -> 3.02   (French sentence) ```  Controls unchanged: af_heart 3.75, am_michael 4.28 — same as the original table.  Also checked it's the right language rather than just longer audio: ran the clips back through a local ASR. bf_emma returns the English sentence, ff_siwis returns the French one with the accents intact.  Both symlink targets already existed, only the aliases were missing. Lemonade 2026.39.1. 
  > Fixed in https://github.com/lemonade-sdk/lemonade/pull/3695

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

### Incident Patch 1: `ee87a42e` (2026-10-04)
**Commit Message**: fix(models): give a shared folder name to one model in both forms (#3657)

* fix(models): give a shared folder name to one model in both forms

A folder split into per-variant models keeps its old name as an input alias.
When several folders share a name, as LM Studio's publisher/repo layout does
for one repo from several publishers, every folder registered that alias. The
bare form then resolved to the first model by id and the extra. form to the
last, so the two forms of one name loaded different publishers' models.

The first folder found now owns the name in both forms, as the custom model
guide specifies, and later folders do not register it.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(models): keep a shared folder name with the first folder over a later single model

A folder split into variants keeps its name as an input alias, but a later
single-model folder with the same name still registered that name as its
model id, which outranks an alias, so both forms resolved to the later
folder. The first folder found now owns the name whichever kind it is, and a
later single-model folder is qualified with the folder that contains it, as
in beta-Shared.


**File**: `docs/guide/configuration/custom-models.md` (modified, +2/-1)
```diff
@@ -382,7 +382,7 @@ These notes apply to both:
 | A `.gguf` file at the search root, or in a reserved directory | the filename without `.gguf` |
 | A folder holding one model | the folder name |
 | A folder holding several quantization variants | one name per variant, each from its filename |
-| A name another imported model already took | the name, qualified with its own folder, then `-2`, `-3` if that is also taken |
+| A name another imported model already took, or an earlier folder owns | the name, qualified with the folder that contains it, then `-2`, `-3` if that is also taken |
 
 For example:
 
@@ -395,6 +395,7 @@ For example:
 | `Qwen3-8B-GGUF/` holding `Qwen3-8B-Q4_K_M.gguf` and `mmproj-Qwen3-8B-f16.gguf` | `Qwen3-8B-GGUF` |
 | `Mixtral-GGUF/` holding a two-shard `Mixtral-Q4_K_M` set and a two-shard `Mixtral-Q8_0` set | `Mixtral-Q4_K_M`, `Mixtral-Q8_0` |
 | `Llama-Local-GGUF/` and `Mistral-Local-GGUF/`, each holding `model-Q4_K_M.gguf` and `model-Q8_0.gguf` | `model-Q4_K_M`, `model-Q8_0`, `Mistral-Local-GGUF-model-Q4_K_M`, `Mistral-Local-GGUF-model-Q8_0` |
+| `alpha/Shared/` holding `Llama-Q4_K_M.gguf` and `Llama-Q8_0.gguf`, and `beta/Shared/` holding `Mistral-Q4_K_M.gguf` | `Llama-Q4_K_M`, `Llama-Q8_0`, `beta-Shared` |
 
 Notes:
 
```

**File**: `src/cpp/include/lemon/model_manager.h` (modified, +2/-1)
```diff
@@ -557,7 +557,8 @@ struct UpdateCheckResult {
         const std::filesystem::path& dir_path,
         const std::vector<std::filesystem::path>& gguf_files,
         std::map<std::string, ModelInfo>& discovered,
-        const std::filesystem::path& search_path) const;
+        const std::filesystem::path& search_path,
+        std::set<std::string>& claimed_names) const;
 
     json server_models_;
     json user_models_;
```

**File**: `src/cpp/server/model_manager.cpp` (modified, +29/-17)
```diff
@@ -1165,23 +1165,31 @@ ModelInfo ModelManager::init_extra_model_info(const std::string& name) const {
 
 // Record a discovered model without ever overwriting one already found. Two
 // extra_models_dir folders can hold identically named files; qualifying the
-// newcomer with its folder keeps both and leaves the first model's id alone.
+// newcomer with the folder that contains it keeps both and leaves the first
+// model's id alone. Ids and kept folder names share one namespace, so a
+// qualified id can never shadow a folder name another model already owns.
 static void add_extra_model(std::map<std::string, ModelInfo>& discovered,
+                            std::set<std::string>& claimed_names,
                             const std::string& base_name,
                             const fs::path& folder,
                             ModelInfo info,
                             const std::set<std::string>* reserved_ids = nullptr) {
     const std::string prefix(EXTRA_MODEL_PREFIX);
-    std::string id = prefix + base_name;
-    if (discovered.count(id) || (reserved_ids && reserved_ids->count(id))) {
+    auto taken = [&](const std::string& name) {
+        return claimed_names.count(name) ||
+               (reserved_ids && reserved_ids->count(prefix + name));
+    };
+    std::string name = base_name;
+    if (taken(name)) {
         const std::string qualified = folder.filename().string() + "-" + base_name;
-        id = prefix + qualified;
-        for (int n = 2; discovered.count(id); ++n) {
-            id = prefix + qualified + "-" + std::to_string(n);
+        name = qualified;
+        for (int n = 2; taken(name); ++n) {
+            name = qualified + "-" + std::to_string(n);
         }
     }
-    info.model_name = id;
-    discovered.emplace(id, std::move(info));
+    claimed_names.insert(name);
+    info.model_name = prefix + name;
+    discovered.emplace(info.model_name, std::move(info));
 }
 
 static const std::set<std::string>& reserved_extra_model_ids() {
@@ -1263,7 +1271,9 @@ std::map<std::string, ModelInfo> ModelManager::discover_extra_models() const {
 
     // A directory used to be listed as a single model named after itself.
     // Reserving one splits it into separate models, so keep the old id resolving.
-    std::set<std::string> folder_ids_kept;
+    // The first model to keep a folder name owns it in both its bare and
+    // extra. forms; resolving each form separately could split them.
+    std::set<std::string> claimed_names;
     auto add_standalone_model = [&](const std::vector<fs::path>& model_files,
                                     const std::string& deployment_label,
                                     const fs::path& mmproj_file = fs::path()) {
@@ -1297,12 +1307,12 @@ std::map<std::string, ModelInfo> ModelManager::discover_extra_models() const {
             info.labels.push_back("vision");
         }
 
-        if (!deployment_label.empty() && folder_ids_kept.insert(deployment_label).second) {
+        if (!deployment_label.empty() && claimed_names.insert(deployment_label).second) {
             info.input_aliases.push_back(deployment_label);
             info.input_aliases.push_back(std::string(EXTRA_MODEL_PREFIX) + deployment_label);
         }
 
-        add_extra_model(discovered, base_name, gguf_path.parent_path(),
+        add_extra_model(discovered, claimed_names, base_name, gguf_path.parent_path(),
                         std::move(info), deployment_label.empty()
                             ? nullptr
                             : &reserved_extra_model_ids());
@@ -1372,7 +1382,8 @@ std::map<std::string, ModelInfo> ModelManager::discover_extra_models() const {
                   [](const fs::path& lhs, const fs::path& rhs) {
                       return lhs.generic_string() < rhs.generic_string();
                   });
-        discover_extra_models_in_directory(dir_path, gguf_files, discovered, search_path);
+        discover_extra_models_in_directory(dir_path, gguf_files, discovered, search_path,
+                                           claimed_names);
     }
 
     LOG(INFO, "ModelManager") << "Discovered " << discovered.size() << " models from extra directory" << std::endl;
@@ -1384,7 +1395,8 @@ void ModelManager::discover_extra_models_in_directory(
     const fs::path& dir_path,
     const std::vector<fs::path>& gguf_files,
     std::map<std::string, ModelInfo>& discovered,
-    const fs::path& search_path) const {
+    const fs::path& search_path,
+    std::set<std::string>& claimed_names) const {
 
     std::string dir_name = dir_path.filename().string();
     const std::string deployment_label = extra_model_deployment_label(dir_path, search_path);
@@ -1474,12 +1486,12 @@ void ModelManager::discover_extra_models_in_directory(
             info.type = get_model_type_from_labels(info.labels);
 
             // Keep the old folder name working in requests without listing it.
-            if (path == main_model_path) {
+            if (path ==
```

**File**: `test/cpp/test_extra_model_discovery.cpp` (modified, +22/-0)
```diff
@@ -439,6 +439,27 @@ static void test_discovery_is_independent_of_creation_order() {
     check("discovery result is independent of file creation order", forward == reversed);
 }
 
+static void test_qualified_id_skips_kept_folder_name() {
+    fs::path dir = make_temp_dir();
+    touch(dir / "a" / "Shared" / "Llama-Q4_K_M.gguf");
+    touch(dir / "a" / "Shared" / "Llama-Q8_0.gguf");
+    touch(dir / "a" / "beta-Shared" / "Mistral-Q4_K_M.gguf");
+    touch(dir / "a" / "beta-Shared" / "Mistral-Q8_0.gguf");
+    touch(dir / "beta" / "Shared" / "Phi.gguf");
+
+    ModelManager manager(dir.string());
+    auto models = manager.discover_extra_models_for_test();
+
+    const ModelInfo* owner = find_model(models, "extra.Mistral-Q4_K_M");
+    check("earlier folder keeps its folder name",
+          owner != nullptr && has_alias(*owner, "beta-Shared"));
+    check("qualified id does not shadow a kept folder name",
+          find_model(models, "extra.beta-Shared") == nullptr &&
+          find_model(models, "extra.beta-Shared-2") != nullptr);
+
+    fs::remove_all(dir);
+}
+
 int main() {
     // The constructor loads the registry JSON files unconditionally, so point it
     // at a scratch dir to keep the test off the real user cache.
@@ -464,6 +485,7 @@ int main() {
     test_root_beats_category_for_short_id();
     test_non_normalized_search_path();
     test_discovery_is_independent_of_creation_order();
+    test_qualified_id_skips_kept_folder_name();
 
     fs::remove_all(cache_dir);
 
```

**File**: `test/server_endpoints.py` (modified, +49/-0)
```diff
@@ -6843,6 +6843,55 @@ def test_021yf_extra_root_shards_are_one_model(self):
 
             print("[OK] root shard files are one model")
 
+    def test_021yg_extra_shared_folder_name_has_one_owner(self):
+        """When several folders share a name, the first one found owns that name
+        in both its bare and extra. forms."""
+        with self._extra_models_dir(
+            ggufs=[
+                f"{publisher}/Qwen3-8B-GGUF/{name}"
+                for publisher in ("bartowski", "lmstudio-community", "unsloth")
+                for name in ("Qwen3-8B-Q4_K_M.gguf", "Qwen3-8B-Q8_0.gguf")
+            ]
+        ) as extra_dir:
+            for requested in ("Qwen3-8B-GGUF", "extra.Qwen3-8B-GGUF"):
+                self.assertEqual(
+                    self._get_model(requested)["checkpoint"],
+                    os.path.join(
+                        extra_dir, "bartowski", "Qwen3-8B-GGUF", "Qwen3-8B-Q4_K_M.gguf"
+                    ),
+                    f"{requested} must resolve to the first folder found",
+                )
+
+            print("[OK] a shared folder name has one owner")
+
+    def test_021ygb_extra_shared_folder_name_qualifies_a_later_single_model(self):
+        """A later single-model folder whose name an earlier folder owns is
+        qualified with the folder that contains it, and the earlier folder
+        keeps the name."""
+        with self._extra_models_dir(
+            ggufs=[
+                "alpha/Shared/Llama-Q4_K_M.gguf",
+                "alpha/Shared/Llama-Q8_0.gguf",
+                "beta/Shared/Mistral-Q4_K_M.gguf",
+            ]
+        ) as extra_dir:
+            self.assertExtraModelsListed(
+                extra_dir,
+                {
+                    "Llama-Q4_K_M": "alpha/Shared/Llama-Q4_K_M.gguf",
+                    "Llama-Q8_0": "alpha/Shared/Llama-Q8_0.gguf",
+                    "beta-Shared": "beta/Shared/",
+                },
+            )
+            for requested in ("Shared", "extra.Shared"):
+                self.assertEqual(
+                    self._get_model(requested)["checkpoint"],
+                    os.path.join(extra_dir, "alpha", "Shared", "Llama-Q4_K_M.gguf"),
+                    f"{requested} must resolve to the first folder found",
+                )
+
+            print("[OK] a later single-model folder is qualified")
+
     def test_021r_openai_chat_extra_models_precedence(self):
         """Regression test for #2014: OpenAI API resolves aliases to local files, shadowing built-ins."""
         # Use a built-in model name to prove precedence and alias resolution simultaneously
```

---

### Incident Patch 2: `7dc09e21` (2026-10-02)
**Commit Message**: fix(http): make download stall timeouts follow global_timeout (#3730)

A download gave up after 60 seconds without a byte, and after 60 seconds
under 1000 B/s for model files, whatever global_timeout said. Both now
default to global_timeout, like every other HttpClient call, and the
stall error names the timeout that actually fired rather than always
reporting the base value.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/cpp/include/lemon/utils/http_client.h` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ struct DownloadOptions {
     int low_speed_limit = 0;       // Minimum bytes/sec before timeout (disabled — 0 = no limit)
     int low_speed_time = 0;        // Seconds below low_speed_limit before timeout (disabled)
     int connect_timeout = 30;         // Connection timeout in seconds
-    int no_progress_timeout = 60;      // Seconds without byte progress before aborting (0 = disabled)
+    int no_progress_timeout = 0;       // Seconds without byte progress before aborting; 0 uses the default timeout
     bool range_retry_on_zero_byte_retry = true; // Retry empty failed attempts with Range: 0-
     bool force_initial_range_request = false;   // Force Range: 0- even on the first attempt
 
```

**File**: `src/cpp/server/model_manager.cpp` (modified, +1/-1)
```diff
@@ -5568,7 +5568,7 @@ void ModelManager::download_from_manifest(const json& manifest, std::map<std::st
         download_opts.max_retry_delay_ms = 120000;
         download_opts.resume_partial = true;
         download_opts.low_speed_limit = 1000;
-        download_opts.low_speed_time = 60;
+        download_opts.low_speed_time = static_cast<int>(utils::HttpClient::get_default_timeout());
         download_opts.connect_timeout = 60;
         if (file_desc.contains("hash") && file_desc["hash"].is_object()) {
             const auto& hash = file_desc["hash"];
```

**File**: `src/cpp/server/utils/http_client.cpp` (modified, +4/-2)
```diff
@@ -345,6 +345,7 @@ struct ProgressData {
     ProgressCallback callback;
     bool cancelled = false;
     bool stalled = false;
+    long stalled_after = 0;
     bool waiting_for_first_byte = false;
     long current_response_code = 0;
     int no_progress_timeout = 0;
@@ -443,6 +444,7 @@ static int progress_callback(void* clientp, curl_off_t dltotal, curl_off_t dlnow
 
         if (idle_seconds >= stall_timeout) {
             data->stalled = true;
+            data->stalled_after = stall_timeout;
             return 1;
         }
     }
@@ -927,7 +929,7 @@ DownloadResult HttpClient::download_attempt(const std::string& url,
         curl_easy_setopt(curl, CURLOPT_RANGE, "0-");
     }
 
-    const int no_progress_timeout = options.no_progress_timeout;
+    const int no_progress_timeout = static_cast<int>(effective_timeout(options.no_progress_timeout));
     std::unique_ptr<ProgressData> prog_data;
     if (callback || no_progress_timeout > 0) {
         prog_data = std::make_unique<ProgressData>();
@@ -983,7 +985,7 @@ DownloadResult HttpClient::download_attempt(const std::string& url,
         result.can_resume = current_file_size > 0;
         std::ostringstream oss;
         oss << "Download stalled: no bytes received for "
-            << no_progress_timeout << " seconds";
+            << prog_data->stalled_after << " seconds";
         if (current_file_size > 0) {
             oss << "\n  Partial file size: " << (current_file_size / (1024.0 * 1024.0)) << " MB (resumable)";
         }
```

---

### Incident Patch 3: `35e62510` (2026-10-02)
**Commit Message**: fix(models): group shard files at the extra_models_dir root (#3656)

Shard files sitting in a folder or a reserved directory are one model, but at
the search root each shard was listed as its own model, named with its
-0000N-of-0000M suffix. The root now uses the same grouping as the reserved
directories, so the custom model guide's shard rule holds everywhere.

An mmproj file at the root is still skipped rather than attached.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/cpp/server/model_manager.cpp` (modified, +17/-15)
```diff
@@ -1261,13 +1261,6 @@ std::map<std::string, ModelInfo> ModelManager::discover_extra_models() const {
         return discovered;
     }
 
-    // Root files claim their short id first, so adding a reserved directory
-    // never renames an extra model that already exists.
-    std::sort(standalone_files.begin(), standalone_files.end(),
-              [](const fs::path& lhs, const fs::path& rhs) {
-                  return lhs.generic_string() < rhs.generic_string();
-              });
-
     // A directory used to be listed as a single model named after itself.
     // Reserving one splits it into separate models, so keep the old id resolving.
     std::set<std::string> folder_ids_kept;
@@ -1315,18 +1308,14 @@ std::map<std::string, ModelInfo> ModelManager::discover_extra_models() const {
                             : &reserved_extra_model_ids());
     };
 
-    for (const auto& gguf_path : standalone_files) {
-        if (gguf_reader_detail::contains_ignore_case(
-                gguf_path.filename().string(), "mmproj")) continue;
-        add_standalone_model({gguf_path}, "");
-    }
-
-    for (auto& [category_path, files] : category_files) {
+    // Files sitting directly in a directory are separate models, except where
+    // numbered shard names declare that they belong together.
+    auto group_logical_models = [](std::vector<fs::path> files,
+                                   std::vector<fs::path>& mmproj_files) {
         std::sort(files.begin(), files.end(),
                   [](const fs::path& lhs, const fs::path& rhs) {
                       return lhs.generic_string() < rhs.generic_string();
                   });
-        std::vector<fs::path> mmproj_files;
         std::vector<std::vector<fs::path>> logical_models;
         std::map<std::pair<std::string, int>, size_t> shard_groups;
 
@@ -1353,6 +1342,19 @@ std::map<std::string, ModelInfo> ModelManager::discover_extra_models() const {
                   [](const auto& lhs, const auto& rhs) {
                       return lhs.front().generic_string() < rhs.front().generic_string();
                   });
+        return logical_models;
+    };
+
+    // Root files claim their short id first, so adding a reserved directory
+    // never renames an extra model that already exists.
+    std::vector<fs::path> root_mmproj_files;
+    for (const auto& model_files : group_logical_models(standalone_files, root_mmproj_files)) {
+        add_standalone_model(model_files, "");
+    }
+
+    for (const auto& [category_path, files] : category_files) {
+        std::vector<fs::path> mmproj_files;
+        const auto logical_models = group_logical_models(files, mmproj_files);
 
         const std::string deployment_label = category_path.filename().string();
         const fs::path direct_mmproj = logical_models.size() == 1 && !mmproj_files.empty()
```

**File**: `test/server_endpoints.py` (modified, +19/-0)
```diff
@@ -6824,6 +6824,25 @@ def test_021ya_extra_same_quant_non_shard_files_remain_separate(self):
 
             print("[OK] same-quant non-shard files remain separate models")
 
+    def test_021yf_extra_root_shards_are_one_model(self):
+        """Shard files at the search root are one model, as they are in a folder."""
+        with self._extra_models_dir(
+            ggufs=[
+                "Big-Q4_K_M-00001-of-00002.gguf",
+                "Big-Q4_K_M-00002-of-00002.gguf",
+                "Small-Q8_0.gguf",
+            ]
+        ) as extra_dir:
+            self.assertExtraModelsListed(
+                extra_dir,
+                {
+                    "Big-Q4_K_M": "Big-Q4_K_M-00001-of-00002.gguf",
+                    "Small-Q8_0": "Small-Q8_0.gguf",
+                },
+            )
+
+            print("[OK] root shard files are one model")
+
     def test_021r_openai_chat_extra_models_precedence(self):
         """Regression test for #2014: OpenAI API resolves aliases to local files, shadowing built-ins."""
         # Use a built-in model name to prove precedence and alias resolution simultaneously
```

---

### Incident Patch 4: `ff3b1ce1` (2026-10-02)
**Commit Message**: docs(models): specify extra_models_dir behavior in the custom model guide (#3633)

* docs(models): specify extra_models_dir behavior in the custom model guide

The behavior was specified in src/cpp/Extra-Models-Dir-Spec.md, which was not
published, had drifted from the code, and documented a --extra-models-dir flag
that no longer exists. Its content becomes an "Imported models" section of the
custom model guide, and the file is deleted.

Naming is one subsection: a rules table, an examples table with one row per
interpretation, and a list of notes. Every example was run against a live
server. One inherited example row was wrong, pairing a one-file-per-folder
layout with the outcome of a two-file layout, and another documented an id that
kept its .gguf extension. This is the spec the C++ changes above it in the
stack are written against, so two of its rows describe behavior that lands
later in the stack.

The FAQ, configuration reference, and embeddable guide now point here. The
embeddable guide had restated six naming rules, which is worse than a pointer
because a partial copy reads complete. llama.cpp cache paths are dropped, since
llama.cpp downloads into the Hugging Face cache a

**File**: `docs/dev/getting-started.md` (modified, +0/-1)
```diff
@@ -452,7 +452,6 @@ The notarization process will:
 src/cpp/
 ├── CPackRPM.cmake              # RPM packaging configuration
 ├── DOCKER_GUIDE.md             # Docker containerization guide
-├── Extra-Models-Dir-Spec.md    # Extra models directory specification
 ├── Multi-Model-Spec.md         # Multi-model loading specification
 ├── postinst                    # Debian package post-install script
 ├── postinst-full               # Debian package post-install script (full version)
```

**File**: `docs/embeddable/models.md` (modified, +4/-16)
```diff
@@ -18,7 +18,7 @@ Contents:
 `lemond`'s configuration has two properties, `models_dir` and `extra_models_dir`, that determine where `lemond` will look when listing, pulling, and loading models.
 
 - `models_dir` is the primary model store, where `lemond` will `pull` models to.
-- `extra_models_dir` is a search path for GGUF models (chat, embedding, or reranking) that can be imported into `lemond`.
+- `extra_models_dir` is a search path for GGUF models that can be imported into `lemond`.
 
 ### Sharing Models With Other Apps
 
@@ -153,24 +153,12 @@ You can test whether it worked like this:
 Which should return:
 
 ```
-extra.my_custom_model.gguf              Yes         llamacpp
+my_custom_model                         Yes                 N/A       llamacpp
 ```
 
-> Note: models imported via `extra_models_dir` will have the `extra.` prefix in the `list` command and `/v1/models` endpoint.
+> Tip: `extra_models_dir` can be a relative path inside your app's package, which is how you ship GGUFs that are not on a registry.
 
-> Tip: `extra_models_dir` can be a relative path to any location within your app's package, or any absolute path on your user's system. It searches recursively and can import many GGUFs from a single directory tree.
-
-**Folder convention:** the folder a model sits in tells the server how to run it. Filenames are never used to guess.
-
-Use the reserved top-level directories `chat`, `embeddings`, and `reranking` to select how imported models run. Files directly inside a reserved directory, and models in its nested folders, inherit that mode. Models at the root or under any other directory default to chat.
-
-Direct numbered shards are grouped when their filenames declare the same shard set. A direct `mmproj` is attached only when the reserved directory contains one main model. Convention: if a reserved directory contains multiple vision models, place each model and its `mmproj` together in their own subdirectory. This makes it clear which files belong together.
-
-Reserved directory names must match exactly: `embeddings` is reserved, while `Embedding`, `embedding`, and `embeddings 2` are ordinary directories. The server does not try to infer near-matches because doing so could accidentally select the wrong runtime behavior.
-
-> Upgrading: if you already have a top-level folder named `chat`, `embeddings`, or `reranking`, its contents were previously listed as a single model called `extra.chat`, `extra.embeddings`, or `extra.reranking`. Those files are now listed individually by filename. The old name is still accepted in requests, so existing configs and scripts keep working.
-
-> Note: When an existing `extra_models_dir` is set at runtime, the path must be a readable directory for the `lemond` process. Permission or I/O failures are rejected instead of replacing the current model view. A path that does not exist yet is allowed and can be picked up later by the directory watcher.
+For how imported models are named and run, see [Imported models (`extra_models_dir`)](../guide/configuration/custom-models.md#imported-models-extra_models_dir) in the custom model guide.
 
 ## Customization
 
```

**File**: `docs/guide/configuration/README.md` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@ When `lemond` starts, effective configuration is resolved by deep-merging settin
 | `auto_evict` | bool | false | Enable dynamic VRAM management based on idle time and global GPU memory pressure. Can be overridden per model. |
 | `auto_evict_threshold_pct` | number | 0.90 | Global VRAM fraction at which pressure eviction is evaluated. Must be greater than 0 and at most 1.0; `0.90` means 90%. |
 | `broadcast` | bool | true | Enable or disable UDP broadcasting for server discovery |
-| `extra_models_dir` | string | "" | Secondary directory recursively scanned for GGUF model files. Empty disables extra discovery; existing paths must be readable by `lemond`. Top-level `chat`, `embeddings`, and `reranking` directories select how models run, see [Model Management](../../embeddable/models.md) |
+| `extra_models_dir` | string | "" | Secondary directory recursively scanned for GGUF model files. Empty disables extra discovery; existing paths must be readable by `lemond`. See [Imported models](./custom-models.md#imported-models-extra_models_dir) |
 | `models_dir` | string | "auto" | Directory for cached model files. `"auto"` follows `HF_HUB_CACHE` / `HF_HOME` / platform default |
 | `ctx_size` | int | -1 | Default context size for LLM models. Use `-1` for auto-resolution: the server computes the largest context that fits in available device memory using GGUF architecture metadata. Use a positive integer to set an explicit size. |
 | `default_model_source` | string | "huggingface" | Remote registry used to pull checkpoints when a request does not name one (`huggingface` or `modelscope`). Explicit `--source`, a `source`/`registry_source` field, or a provider URL always overrides it. |
```

**File**: `docs/guide/configuration/custom-models.md` (modified, +121/-4)
```diff
@@ -7,7 +7,7 @@ There are three ways to get a model into Lemonade:
 | Option | Use when | What happens |
 |--------|----------|--------------|
 | [Pull a model](#pull-a-model) | The model is published on Hugging Face or ModelScope | Lemonade downloads it into your model store and registers it |
-| [Point at a folder of GGUFs](#model-naming-spec) | You already have GGUF files on disk, or share a library with LM Studio or llama.cpp | Lemonade lists them where they sit and downloads nothing |
+| [Point at a folder of GGUFs](#imported-models-extra_models_dir) | You already have GGUF files on disk, or share a library with LM Studio or llama.cpp | Lemonade lists them where they sit and downloads nothing |
 | [Edit the JSON files by hand](#configuration-files) | You need full control over a definition and can restart `lemond` | You describe the model yourself in `user_models.json` |
 
 Pulling covers most cases and has several front ends that all end in the same registration; pick one under [Pull a Model](#pull-a-model).
@@ -255,7 +255,7 @@ Lemonade tracks three sources of models. Every model has a **canonical ID** of t
 | Canonical ID    | Source                                                                   |
 |-----------------|--------------------------------------------------------------------------|
 | `user.NAME`     | Model registered via `lemonade pull` (entry in `user_models.json`)       |
-| `extra.NAME`    | Model imported from `extra_models_dir`, see [Imported models](#model-naming-spec) |
+| `extra.NAME`    | Model imported from `extra_models_dir`, see [Imported models](#imported-models-extra_models_dir) |
 | `builtin.NAME`  | Model compiled into Lemonade's built-in catalog (`server_models.json`)   |
 
 The **bare name** `NAME` is an alias that always resolves to whichever source wins precedence for that name. Precedence is **registered > imported > built-in**.
@@ -280,7 +280,7 @@ Anywhere a model name is accepted (request bodies, CLI args, URL path parameters
 
 `lemonade pull` rejects model names starting with `extra.` or `builtin.` since those prefixes are reserved.
 
-An imported model also answers to names derived from the directory layout around it, so a name keeps working after that layout changes. See [model naming spec](#model-naming-spec).
+An imported model also answers to names derived from the directory layout around it, so a name keeps working after that layout changes. See [Model Naming Scheme](#model-naming-scheme).
 
 ### CLI vs. GUI display
 
@@ -348,6 +348,123 @@ Every registered alias is exposed as an independent model entry in `/v1/models`,
 | built-in `Baz` + extra `Baz`                    | `Baz`, `builtin.Baz`                                   | `Baz`/`extra.Baz` → extra; `builtin.Baz` → built-in                          |
 | registered `MyModel` only                       | `MyModel`                                              | `MyModel`/`user.MyModel` → user; `builtin.MyModel` → 404                     |
 
+## Imported models (`extra_models_dir`)
+
+`extra_models_dir` is a directory that `lemond` scans recursively for `.gguf` files, listing everything it finds alongside your other models. The files stay where they are and Lemonade reads them in place. It is empty by default, which disables the feature.
+
+```bash
+lemonade config set extra_models_dir="/home/you/.lmstudio/models"
+```
+
+`lemonade pull` still downloads into `models_dir`. Point `extra_models_dir` at files you already have:
+
+| Source | Typical path |
+|---|---|
+| LM Studio | `~/.lmstudio/models`, or `C:\Users\You\.lmstudio\models` |
+| A Hugging Face or ModelScope cache | `~/.cache/huggingface/hub` |
+| Your own folder of GGUFs | anywhere readable, absolute or relative |
+
+### Model Naming Scheme
+
+A model's name comes from the directory layout around its files. A path uses the Hugging Face / ModelScope cache rules only when its GGUFs are inside a recognized cache layout such as `models--<org>--<repo>/snapshots/<commit>/...` or `modelscope--models--<org>--<repo>/snapshots/<commit>/...`. A folder merely named like a cache repo is not sufficient. All other paths use the non-HF/MS rules below.
+
+These notes apply to both:
+
+- Files whose names declare the same shard series are one model, as in `model-Q4_K_M-00001-of-00003.gguf`, and its name drops the shard suffix. The `-`, `.`, and `_` separators are accepted before the shard index.
+- An `mmproj` file joins the model in its folder.
+- Names are assigned in a fixed order: files at the search root, then files in reserved directories, then folders, each group in sorted path order. A model at the search root keeps its name when a directory is reserved later.
+- Every imported model is also addressable as `extra.<name>`; see the [model naming spec](#model-naming-spec). [Model aliases](#model-aliases-aliasesjson) are a separate feature that you define yourself in `aliases.json`.
+
+#### Non-HF/MS folders
+
+| What is on disk | Name |
+|---|---|
+| A `.gguf
```

**File**: `docs/guide/faq.md` (modified, +5/-7)
```diff
@@ -65,20 +65,18 @@
 
    **Secondary: Extra Models Directory (GGUF)**
 
-   Lemonade Server can discover GGUF models from a secondary directory using the `extra_models_dir` option, enabling compatibility with llama.cpp and LM Studio model caches. Suggested paths:
+   Lemonade Server can discover GGUF models from a secondary directory using the `extra_models_dir` option, so a library you already have works without downloading anything again. Suggested paths:
 
-   - **Windows:**
-       - LM Studio: `C:\Users\You\.lmstudio\models`
-       - llamacpp: `%LOCALAPPDATA%\llama.cpp` (e.g., `C:\Users\You\AppData\Local\llama.cpp`)
-   - **Linux:** `~/.cache/llama.cpp`
+   - **LM Studio:** `~/.lmstudio/models`, or `C:\Users\You\.lmstudio\models` on Windows
+   - **A Hugging Face cache:** `~/.cache/huggingface/hub`
 
    Set `extra_models_dir` (see [Server Configuration](./configuration/README.md)):
 
    ```bash
-   lemonade config set extra_models_dir="/home/you/.cache/llama.cpp"
+   lemonade config set extra_models_dir="/home/you/.lmstudio/models"
    ```
 
-   Any `.gguf` files found in this directory (including subdirectories) will automatically appear in Lemonade's model list in the `custom` category.
+   Any `.gguf` files in this directory, including its subdirectories, appear in Lemonade's model list in the `custom` category. For how they are named and how the folder layout selects the way they run, see [Imported models](./configuration/custom-models.md#imported-models-extra_models_dir).
 
    **FastFlowLM**
 
```

**File**: `src/cpp/Extra-Models-Dir-Spec.md` (removed, +0/-143)
```diff
@@ -1,143 +0,0 @@
-# Extra Models Directory Specification
-
-Lemonade Server supports discovering GGUF models from a secondary directory in addition to the HuggingFace cache. This enables compatibility with llama.cpp's model cache and user-managed model directories.
-
-## CLI Argument
-
-The `--extra-models-dir PATH` argument specifies a secondary directory to scan for GGUF models.
-
-**Default value:** None (feature is disabled unless explicitly enabled)
-
-**Suggested paths:**
-- **Windows:** `%LOCALAPPDATA%\llama.cpp`
-- **Linux/macOS:** `~/.cache/llama.cpp`
-
-## Model Discovery
-
-### Scanning Rules
-
-1. The directory is scanned recursively for `.gguf` files.
-2. Discovered models are added to the model list alongside registered models from `server_models.json` and `user_models.json`.
-3. HuggingFace cache remains the primary source for registered models.
-4. The top-level directory a model sits in selects how it runs. `chat`, `embeddings`, and `reranking` are reserved for this; anything else defaults to chat. Filenames are never used to guess. See [Embedding and Reranking Detection](#embedding-and-reranking-detection).
-
-### Access and Failure Behavior
-
-When `extra_models_dir` is updated at runtime, an existing path must be a directory that the `lemond` process can enumerate. Permission and I/O failures reject the config update. A path that does not exist yet is accepted so the directory watcher can observe it if it is created later.
-
-During discovery, inaccessible nested directories are skipped. Extra-model discovery is optional: a filesystem failure must not remove or hide models from `server_models.json` or `user_models.json`.
-
-### Naming Convention
-
-All discovered models are prefixed with `extra.` to prevent naming conflicts with registered models (similar to how user-added models are prefixed with `user.`):
-
-| Directory Structure | Model Name |
-|---------------------|------------|
-| `Qwen3-8B-Q4_K_M.gguf` | `extra.Qwen3-8B-Q4_K_M.gguf` |
-| `gemma-3-4b-it-Q8_0/*.gguf` | `extra.gemma-3-4b-it-Q8_0` |
-
-This allows users to have both a registered model (e.g., `Qwen3-Coder-30B-A3B-Instruct-GGUF`) and a custom GGUF variant (e.g., `extra.Qwen3-Coder-30B-A3B-Instruct-GGUF`) without conflict.
-
-### Directory-Based Models
-
-A subdirectory holding several distinct model variants is listed as one model per variant, so every version in the folder can be selected:
-
-| Directory contents | Models listed |
-|--------------------|---------------|
-| `Qwen3-8B-Q4_K_M.gguf`, `Qwen3-8B-Q8_0.gguf` | `extra.Qwen3-8B-Q4_K_M`, `extra.Qwen3-8B-Q8_0` |
-| `model-00001-of-00002.gguf`, `model-00002-of-00002.gguf` | `extra.<folder name>` (one model) |
-
-The folder stays a single model when splitting would be ambiguous: a single shard set, or files that do not all belong to a named variant. This still supports:
-
-- **Multimodal models:** Directory contains a main `.gguf` file and an `mmproj*.gguf` file.
-- **Multi-shard models:** Directory contains multiple numbered shard files (e.g., `*-00001-of-00006.gguf`).
-
-### Shard Grouping
-
-Files are merged into one model only when their names declare the same shard series, such as `model-Q4_K_M-00001-of-00003.gguf`. The `-`, `.` and `_` separators are all accepted before the shard index.
-
-Sharing a quantization token is not sufficient. `Model-Q4_K_M.gguf` and `Model-Q4_K_M-imatrix.gguf` are two independent models and are listed separately.
-
-### Preserved Folder Names
-
-When a folder is split into variants, its folder name is still accepted in requests as a hidden input alias, resolving to the first variant alphabetically. It is not listed as an extra model, so existing scripts keep working without a duplicate entry appearing in `/api/v1/models`.
-
-Reserving a directory has the same effect. Any directory holding GGUF files is listed as a single model named after that directory, so `embeddings/` produced `extra.embeddings`. Once the directory is reserved, its files are listed separately instead.
-
-For a directory holding `all-MiniLM-L6-v2.gguf` and `nomic-embed-text-v2.gguf`:
-
-| | Model ids |
-|---|---|
-| Before it was reserved | `extra.embeddings` |
-| After | `extra.all-MiniLM-L6-v2`, `extra.nomic-embed-text-v2` |
-
-`extra.embeddings` is still accepted in requests so existing configs keep working. It resolves to the first file alphabetically, which is the file the single model used.
-
-### Multimodal Detection
-
-If a model directory contains a file with `mmproj` anywhere in the filename, it is automatically set as the model's `mmproj` field and the `vision` label is applied. When several `mmproj` files are present, the first by filename is chosen, so the selection is stable across restarts.
-
-A direct `mmproj` inside a reserved directory is attached only when that directory contains one logical main model. Convention: if a reserved directory contains multiple multimodal models, place each model and its `mmproj` together in their own subdirectory. 
```

---

### Incident Patch 5: `b01156fb` (2026-10-02)
**Commit Message**: fix(server): watch extra_models_dir's nested folders on Linux and macOS (#3726)

* fix(server): watch extra_models_dir's nested folders on Linux and macOS

The Linux and macOS DirectoryWatchers watched extra_models_dir itself, which
reports changes to that directory's own entries only. A GGUF added to an
existing model folder, or a cache repo's refs/main moving to a new revision,
left the model list stale until something else invalidated it.

On Linux every folder below the root now gets an inotify watch, including
folders created after the watcher starts. Nested watches leave out IN_MODIFY
so a file being downloaded fires once when it is closed rather than on every
write.

On macOS the kqueue watcher is replaced with FSEvents, which reports changes
anywhere below the watched path. Recursive kqueue would need a descriptor per
folder, and a large model tree would exceed the default open-file limit.

Windows already polls the whole tree.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(server): fire macOS DirectoryWatcher once per download

FSEvents keeps reporting a file while it is written, so a download in
extra_models_dir fired the callback every latency wi

**File**: `CMakeLists.txt` (modified, +6/-0)
```diff
@@ -2374,6 +2374,9 @@ if(BUILD_TESTING AND EXISTS "${_DIR_WATCHER_TEST_SRC}" AND EXISTS "${_DIR_WATCHE
         target_link_libraries(test_directory_watcher PRIVATE pthread)
         target_link_options(test_directory_watcher PRIVATE -pthread)
     endif()
+    if(APPLE)
+        target_link_libraries(test_directory_watcher PRIVATE "-framework CoreServices")
+    endif()
 
     # Enable testing and register the test with CTest
     include(CTest)
@@ -2832,6 +2835,9 @@ if(BUILD_TESTING AND EXISTS "${_ROUTING_STORE_TEST_SRC}")
     target_link_libraries(test_routing_policy_store PRIVATE nlohmann_json::nlohmann_json)
     find_package(Threads REQUIRED)
     target_link_libraries(test_routing_policy_store PRIVATE Threads::Threads)
+    if(APPLE)
+        target_link_libraries(test_routing_policy_store PRIVATE "-framework CoreServices")
+    endif()
     target_compile_definitions(test_routing_policy_store PRIVATE
         ROUTING_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/test/cpp/fixtures/routing"
     )
```

**File**: `src/cpp/include/lemon/directory_watcher.h` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ namespace lemon {
 ///
 /// Concrete implementations differ by platform:
 ///   - Linux  : inotify + epoll  (low latency, ~0-5ms)
-///   - macOS  : kqueue           (~50ms latency)
+///   - macOS  : FSEvents         (~50ms latency)
 ///   - others : polling fallback (~200ms interval)
 class DirectoryWatcher {
 public:
```

**File**: `src/cpp/server/directory_watcher.cpp` (modified, +126/-132)
```diff
@@ -6,6 +6,7 @@
 #include <memory>
 #include <functional>
 #include <cstring>
+#include <map>
 #include <set>
 #include <tuple>
 #include <filesystem>
@@ -21,11 +22,11 @@ namespace fs = std::filesystem;
     #include <unistd.h>
     #include <errno.h>
 #elif defined(__APPLE__)
-    #include <sys/event.h>
+    #include <CoreServices/CoreServices.h>
+    #include <condition_variable>
+    #include <dispatch/dispatch.h>
+    #include <mutex>
     #include <sys/stat.h>
-    #include <fcntl.h>
-    #include <unistd.h>
-    #include <errno.h>
 #endif
 
 #ifdef _WIN32
@@ -102,7 +103,7 @@ class DirectoryWatcher::Impl {
         }
 
         unsigned int mask = IN_CREATE | IN_DELETE | IN_DELETE_SELF | IN_MOVE_SELF |
-                            IN_MOVED_FROM | IN_MOVED_TO | IN_MODIFY | IN_ISDIR |
+                            IN_MOVED_FROM | IN_MOVED_TO | IN_ISDIR |
                             IN_CLOSE_WRITE;
         wd_ = inotify_add_watch(inotify_fd_, dir_path_.c_str(), mask);
         if (wd_ < 0) {
@@ -139,6 +140,9 @@ class DirectoryWatcher::Impl {
         epoll_ctl(epoll_fd_, EPOLL_CTL_ADD, inotify_fd_, &ev);
 
         has_watch_ = true;
+        watch_paths_[wd_] = dir_path_;
+        watch_subdirectories(dir_path_);
+
         constexpr int epoll_timeout_ms = 100;
 
         while (!stop_flag_.load()) {
@@ -164,17 +168,24 @@ class DirectoryWatcher::Impl {
 
             // Drain all pending inotify events
             bool got_event = false;
-            for (int retries = 0; retries < 5; ++retries) {
-                constexpr size_t buf_size = 4096;
-                char buf[buf_size];
-                ssize_t n2 = read(inotify_fd_, buf, buf_size);
-                if (n2 < 0) {
-                    if (errno == EAGAIN || errno == EWOULDBLOCK) break;
-                    break;
-                }
-                if (n2 > 0) {
-                    got_event = true;
-                    break;
+            alignas(struct inotify_event) char buf[4096];
+            ssize_t len;
+            while ((len = read(inotify_fd_, buf, sizeof(buf))) > 0) {
+                for (char* p = buf; p < buf + len;) {
+                    const auto* event = reinterpret_cast<const struct inotify_event*>(p);
+                    p += sizeof(struct inotify_event) + event->len;
+                    if (event->mask & IN_IGNORED) {
+                        watch_paths_.erase(event->wd);
+                        continue;
+                    }
+                    auto parent = watch_paths_.find(event->wd);
+                    if ((event->mask & IN_ISDIR) && (event->mask & (IN_CREATE | IN_MOVED_TO)) &&
+                        event->len > 0 && parent != watch_paths_.end()) {
+                        const fs::path created = parent->second / event->name;
+                        add_nested_watch(created);
+                        watch_subdirectories(created);
+                    }
+                    if (!is_file_being_written(*event, parent)) got_event = true;
                 }
             }
 
@@ -188,13 +199,49 @@ class DirectoryWatcher::Impl {
         if (epoll_fd_ >= 0) { ::close(epoll_fd_); epoll_fd_ = -1; }
         if (wd_ >= 0)       { inotify_rm_watch(inotify_fd_, wd_); wd_ = -1; }
         if (inotify_fd_ >= 0) { ::close(inotify_fd_); inotify_fd_ = -1; }
+        watch_paths_.clear();
         has_watch_ = false;
     }
 
+    // inotify watches one directory, not its subtree, and models sit in
+    // nested folders whose contents (a new variant, a cache's refs/main) also
+    // change what is listed. IN_MODIFY is left off so a file being downloaded
+    // fires once when it closes, not on every write.
+    void add_nested_watch(const fs::path& dir) {
+        constexpr unsigned int nested_mask = IN_CREATE | IN_DELETE | IN_MOVED_FROM |
+                                             IN_MOVED_TO | IN_CLOSE_WRITE | IN_ONLYDIR;
+        int wd = inotify_add_watch(inotify_fd_, dir.c_str(), nested_mask);
+        if (wd >= 0) watch_paths_[wd] = dir;
+    }
+
+    // A new regular file reports IN_CLOSE_WRITE once it is written, so its
+    // IN_CREATE would only announce a file that may still be incomplete.
+    // Symlinks (a cache snapshot's links into blobs/) and hard links never
+    // close, so their IN_CREATE still counts.
+    bool is_file_being_written(const struct inotify_event& event,
+                               std::map<int, fs::path>::const_iterator parent) const {
+        if (!(event.mask & IN_CREATE) || (event.mask & IN_ISDIR) || event.len == 0 ||
+            parent == watch_paths_.end()) {
+            return false;
+        }
+        struct stat st;
+        const fs::path created = parent->second / event.name;
+        return lstat(created.c_str(), &st) == 0 && S_ISREG(st.st_mode) && st.st_nlink == 1;
+    }
+
+    void watch_subdirectories(const fs::path& dir) {
+        std::error_code ec;
+        for (fs::recursive_directory_iterator it(dir, fs::directory_options::skip_permission_denied
```

**File**: `test/cpp/test_directory_watcher.cpp` (modified, +95/-0)
```diff
@@ -208,6 +208,96 @@ static void test_directory_removal(TestResult& r) {
     r.ok("directory removal graceful stop");
 }
 
+// Test 7: A file written in a pre-existing nested folder is detected
+static void test_nested_change(TestResult& r) {
+    fs::path dir = make_temp_dir();
+    fs::path nested = fs::path(dir) / "nested_existing" / "refs";
+    fs::create_directories(nested);
+    std::atomic<int> call_count{0};
+
+    {
+        DirectoryWatcher watcher(dir.string());
+        watcher.set_callback([&call_count]() { ++call_count; });
+        watcher.start();
+
+        std::this_thread::sleep_for(std::chrono::milliseconds(500));
+        std::ofstream{nested / "main"} << "commit-b";
+        std::this_thread::sleep_for(std::chrono::milliseconds(800));
+    }
+
+    fs::remove_all(fs::path(dir) / "nested_existing");
+    if (call_count.load() > 0) {
+        r.ok("nested folder change detection");
+    } else {
+        r.fail("nested folder change detection (callback never fired)");
+    }
+}
+
+// Test 8: A folder created after start() is watched too
+static void test_new_folder_is_watched(TestResult& r) {
+    fs::path dir = make_temp_dir();
+    fs::path created = fs::path(dir) / "nested_created";
+    std::atomic<int> call_count{0};
+    int after_create = 0;
+
+    {
+        DirectoryWatcher watcher(dir.string());
+        watcher.set_callback([&call_count]() { ++call_count; });
+        watcher.start();
+
+        std::this_thread::sleep_for(std::chrono::milliseconds(500));
+        fs::create_directories(created);
+        std::this_thread::sleep_for(std::chrono::milliseconds(800));
+        after_create = call_count.load();
+
+        std::ofstream{created / "model.gguf"} << "GGUF";
+        std::this_thread::sleep_for(std::chrono::milliseconds(800));
+    }
+
+    fs::remove_all(created);
+    if (call_count.load() > after_create) {
+        r.ok("new folder is watched");
+    } else {
+        r.fail("new folder is watched (write inside it was missed)");
+    }
+}
+
+#ifdef __linux__
+// Test 9: A file still being written is not announced until it is closed
+static void test_open_file_waits_for_close(TestResult& r) {
+    fs::path dir = make_temp_dir();
+    fs::path nested = fs::path(dir) / "nested_download";
+    fs::create_directories(nested);
+    std::atomic<int> call_count{0};
+    int while_open = 0;
+
+    {
+        DirectoryWatcher watcher(dir.string());
+        watcher.set_callback([&call_count]() { ++call_count; });
+        watcher.start();
+
+        std::this_thread::sleep_for(std::chrono::milliseconds(500));
+        {
+            std::ofstream file(nested / "model.gguf");
+            for (int i = 0; i < 6; ++i) {
+                file << "GGUF" << std::flush;
+                std::this_thread::sleep_for(std::chrono::milliseconds(100));
+            }
+            while_open = call_count.load();
+        }
+        std::this_thread::sleep_for(std::chrono::milliseconds(800));
+    }
+
+    fs::remove_all(nested);
+    if (while_open == 0 && call_count.load() > 0) {
+        r.ok("open file waits for close");
+    } else {
+        r.fail("open file waits for close (calls while open=" + std::to_string(while_open) +
+               ", total=" + std::to_string(call_count.load()) + ")");
+    }
+}
+#endif
+
 int main() {
     TestResult r;
 
@@ -219,6 +309,11 @@ int main() {
     test_nonexistent_dir(r);
     test_debounce(r);
     test_directory_removal(r);
+    test_nested_change(r);
+    test_new_folder_is_watched(r);
+#ifdef __linux__
+    test_open_file_waits_for_close(r);
+#endif
 
     printf("\n%d/%d tests passed\n", r.passed, r.passed + r.failed);
     return r.failed == 0 ? 0 : 1;
```

**File**: `test/cpp/test_routing_policy_store.cpp` (modified, +6/-10)
```diff
@@ -102,28 +102,24 @@ static void test_directory_watcher_reload() {
 
     std::this_thread::sleep_for(std::chrono::milliseconds(250));
     doc["routing"]["rules"][0]["route_to"] = "Qwen3-8B-GGUF";
-    // Delete first to trigger a directory entry change. macOS's kqueue-based
-    // DirectoryWatcher monitors the directory fd and does not detect inline writes.
-    fs::remove(policy_path);
-    std::this_thread::sleep_for(std::chrono::milliseconds(50));
     write_json(policy_path, doc);
 
+    // A watcher event left over from the first write can reload the old file,
+    // so wait for the updated policy rather than for any engine swap.
     std::shared_ptr<const lemon::RoutingPolicyEngine> next_engine;
+    std::string routed_to;
     for (int i = 0; i < 40; ++i) {
         std::this_thread::sleep_for(std::chrono::milliseconds(100));
         next_engine = store.get_engine("user.Router-Keywords");
         if (next_engine && next_engine != first_engine) {
-            break;
+            routed_to = next_engine->route(request("please fix this stack trace"), false).route_to;
+            if (routed_to == "Qwen3-8B-GGUF") break;
         }
     }
 
     check("DirectoryWatcher triggers engine swap",
           next_engine != nullptr && next_engine != first_engine);
-    if (next_engine) {
-        Decision routed = next_engine->route(request("please fix this stack trace"), false);
-        check("watcher-reloaded engine uses updated policy",
-              routed.route_to == "Qwen3-8B-GGUF");
-    }
+    check("watcher-reloaded engine uses updated policy", routed_to == "Qwen3-8B-GGUF");
     store.stop_watching();
     fs::remove_all(dir);
 }
```

---

### Incident Patch 6: `6f8e87bb` (2026-09-29)
**Commit Message**: docs: add a spec writing guide under docs/dev/specs (#3687)

* docs: add a spec writing guide under docs/dev/specs and link it from the RFC process

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Clarify specification requirements in RFC template

Updated the RFC template to clarify specification requirements.

* Revise spec writing guide for clarity and precision

Revised the spec writing guide to enhance clarity and precision in the documentation process. Updated rules for structure, precision, and content to better align with reviewer expectations.

* Fixes for Mario's feedback

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/DISCUSSION_TEMPLATE/request-for-comment-rfc.yml` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ body:
         Before you start:
 
         - **Write in proportion to the change.** A minor feature, such as a new flag on a CLI subcommand, needs far less detail than a proposal for a new working group.
+        - **If your RFC includes a full technical specification, please see the [spec writing guide](https://github.com/lemonade-sdk/lemonade/blob/main/docs/dev/specs/spec-writing-guide.md)** for structure and precision expectations.
         - **The [AI content policy](https://github.com/lemonade-sdk/lemonade/blob/main/docs/dev/ai-content-policy.md) strictly applies here.** Important decisions in Lemonade are made through human-to-human discourse.
 
         After you post, tag the relevant [maintainers](https://github.com/lemonade-sdk/lemonade/blob/main/docs/dev/contribute.md#maintainers) and share the RFC in the `#dev` channel on [Discord](https://discord.gg/5xXzkMu8Zk).
```

**File**: `docs/dev/spec-driven-dev.md` (modified, +2/-0)
```diff
@@ -67,6 +67,8 @@ The following maintainers are required to review RFCs within their subject area.
 
 This section helps you understand how to write a polished RFC that is likely to get a good reception with the community. The `Request for Comment (RFC)` discussion category also has a template that will guide you.
 
+Follow the [spec writing guide](./specs/spec-writing-guide.md) for structure and precision.
+
 Reminder: the [AI content policy](./ai-content-policy.md) strictly applies to RFCs. Important decisions in Lemonade must be made through human-to-human discourse.
 
 <!-- if you ever edit this section, make sure to update the template too! -->
```

**File**: `docs/dev/specs/spec-writing-guide.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# Spec Writing Guide
+
+A technical spec tells a reviewer what an important part of the Lemonade design will be, precisely enough to perform the implementation. This guide can help you write specs that meet the expectations of reviewers. It builds on the general voice and formatting guidelines in the [documentation guide](../documentation.md).
+
+## Structure
+
+1. The first sentence of each section states the scope of the section.
+1. Describe each component once, in its own section, to produce a tops-down view of the architecture. Avoid organizing content chronologically.
+1. A significant change gets its own heading, placed before the first content that relies on it.
+1. Use tables, mermaid diagrams, and lists over prose. Context about a table goes in the sentence that introduces it, not in a sentence trailing after it.
+1. Title-case headings. Capitalize every major word in a section heading ("Setup Assistant", not "Setup assistant").
+1. A multi-step process, including one inside a table cell, is an ordered list, and a step with its own sub-steps gets a nested ordered list. A set of alternatives ("through a unit, a shell or an app") is an unordered list.
+
+## Precision
+
+1. Use precise names. For example: "`lemonade-server` snap", not "the snap". `class::method()`, not `method()`.
+1. Replace vague values with specifics.
+1. Keep each table cell self-contained. A cell never contradicts its row and never points at other rows. It holds one recommended option, not a decision tree.
+1. Split tables by variant when behavior differs. When two variants (Podman and Docker, Windows and Linux) behave identically, use one table. When they differ at all, give each its own table, without exception notes.
+
+## Content
+
+1. Check every claim against the code, a manifest or the upstream source. State what is unverified.
+1. Answer researchable questions. Look up anything the source can answer, such as which release added a feature, and cite it. An open question is reserved for a decision the reviewers must make.
+1. State each fact once. Refer to it elsewhere by section name, and hyperlink every section reference to its heading.
+1. Leave out the obvious. Omit behavior every reader already expects, such as an install failing while offline.
+1. Phrase positively: say what the design does, and do not enumerate design alternatives that were not selected.
```

**File**: `mkdocs.yml` (modified, +1/-0)
```diff
@@ -85,6 +85,7 @@ nav:
     - Philosophy: dev/philosophy.md
     - AI Content Policy: dev/ai-content-policy.md
     - Spec Driven Development Policy: dev/spec-driven-dev.md
+    - Spec Writing Guide: dev/specs/spec-writing-guide.md
     - Working Groups: dev/working-groups/README.md
     - Contribute: dev/contribute.md
     - Documentation Guide: dev/documentation.md
```

---

### Incident Patch 7: `a2e042d7` (2026-09-29)
**Commit Message**: fix(config): reject invalid backend-specific keys (#3684)

* fix(config): reject invalid backend-specific keys

validate_backend accepted any key containing "_bin" or "_args", so
`config set flm.flm_bin=...` or `flm.foo_args=...` succeeded even though
nothing reads those keys.

A "<variant>_bin" / "<variant>_args" key is now accepted only when
<variant> is declared in the section's descriptor (bin_variants /
arg_variants) or is one of its support-row backends, which the runtime
also resolves (e.g. flm.npu_bin, llamacpp.cuda_args, llamacpp.metal_bin).
Anything else falls through to the existing "Unknown key" error.

* test(config): use a portable absolute path for the missing-bin case

"/nonexistent/..." is not absolute on Windows, so looks_like_path()
treats it as a version tag and the path-existence check never runs.
Build the path from fs::temp_directory_path() instead.

**File**: `src/cpp/server/runtime_config.cpp` (modified, +26/-2)
```diff
@@ -54,6 +54,30 @@ static bool has_backend_selection(const std::string& config_section) {
     return false;
 }
 
+// A "<variant>_bin" / "<variant>_args" key is valid when <variant> is declared
+// in the section's defaults schema or is one of its support-row backends, which
+// the runtime also resolves (e.g. flm reads "npu_bin", llamacpp "cuda_args").
+static bool is_backend_variant_key(const std::string& config_section,
+                                   const std::string& key,
+                                   const std::string& suffix) {
+    if (key.size() <= suffix.size() ||
+        key.compare(key.size() - suffix.size(), suffix.size(), suffix) != 0) {
+        return false;
+    }
+    const std::string variant = key.substr(0, key.size() - suffix.size());
+    for (const auto* desc : lemon::backends::all_descriptors()) {
+        if (desc->effective_config_section() != config_section) continue;
+        const auto& declared = (suffix == "_bin") ? desc->bin_variants : desc->arg_variants;
+        if (std::find(declared.begin(), declared.end(), variant) != declared.end()) {
+            return true;
+        }
+        for (const auto& row : desc->support) {
+            if (row.backend == variant) return true;
+        }
+    }
+    return false;
+}
+
 static void validate_extra_models_dir_access(const std::string& raw_dir) {
     if (raw_dir.empty()) {
         return;
@@ -1115,7 +1139,7 @@ void RuntimeConfig::validate_backend(const std::string& backend, const std::stri
         }
         validate_backend_choice(backend, value.get<std::string>());
     }
-    else if (key == "args" || key.find("_args") != std::string::npos) {
+    else if (key == "args" || is_backend_variant_key(backend, key, "_args")) {
         if (!value.is_string()) {
             throw std::invalid_argument("'" + backend + "." + key + "' must be a string");
         }
@@ -1125,7 +1149,7 @@ void RuntimeConfig::validate_backend(const std::string& backend, const std::stri
             throw std::invalid_argument("'" + backend + "." + key + "' must be a string");
         }
     }
-    else if (key.find("_bin") != std::string::npos) {
+    else if (is_backend_variant_key(backend, key, "_bin")) {
         if (!value.is_string()) {
             throw std::invalid_argument("'" + backend + "." + key + "' must be a string");
         }
```

**File**: `test/cpp/test_runtime_config_backend_validation.cpp` (modified, +71/-2)
```diff
@@ -1,14 +1,56 @@
 #include <lemon/runtime_config.h>
 
+#include <nlohmann/json.hpp>
+
 #include <cstdio>
+#include <filesystem>
 #include <stdexcept>
 #include <string>
 
 using lemon::RuntimeConfig;
+using nlohmann::json;
 
-int main() {
-    int failures = 0;
+namespace {
+
+int failures = 0;
+
+void expect_accepted(const std::string& section, const std::string& key, const json& value) {
+    RuntimeConfig config(json::object());
+    try {
+        config.set({{section, {{key, value}}}});
+        std::printf("[PASS] %s.%s is accepted\n", section.c_str(), key.c_str());
+    } catch (const std::invalid_argument& error) {
+        std::printf("[FAIL] %s.%s was rejected: %s\n", section.c_str(), key.c_str(), error.what());
+        ++failures;
+    }
+}
+
+void expect_rejected(const std::string& section, const std::string& key, const json& value,
+                     const std::string& expected_message) {
+    RuntimeConfig config(json::object());
+    try {
+        config.set({{section, {{key, value}}}});
+        std::printf("[FAIL] %s.%s was accepted\n", section.c_str(), key.c_str());
+        ++failures;
+    } catch (const std::invalid_argument& error) {
+        const std::string message = error.what();
+        if (message.find(expected_message) == std::string::npos) {
+            std::printf("[FAIL] %s.%s rejected with unexpected message: %s\n",
+                        section.c_str(), key.c_str(), message.c_str());
+            ++failures;
+        } else {
+            std::printf("[PASS] %s.%s is rejected\n", section.c_str(), key.c_str());
+        }
+    }
+}
+
+void expect_unknown_key(const std::string& section, const std::string& key, const json& value) {
+    expect_rejected(section, key, value, "Unknown key: '" + section + "." + key + "'");
+}
 
+}  // namespace
+
+int main() {
     try {
         RuntimeConfig::validate_backend_choice("llamacpp", "system");
 #ifdef __linux__
@@ -26,5 +68,32 @@ int main() {
 #endif
     }
 
+    // _bin / _args keys must name a backend variant the section actually has.
+    expect_unknown_key("flm", "flm_bin", "builtin");
+    expect_unknown_key("flm", "random_bin", "builtin");
+    expect_unknown_key("flm", "foo_args", "");
+    expect_unknown_key("llamacpp", "vulkan_bin_extra", "builtin");
+    expect_unknown_key("llamacpp", "vulkan_args_extra", "");
+    expect_unknown_key("llamacpp", "npu_bin", "builtin");
+    expect_unknown_key("whispercpp", "cuda_args", "");
+
+    expect_accepted("llamacpp", "vulkan_bin", "builtin");
+    expect_accepted("llamacpp", "cuda_bin", "b8664");
+    expect_accepted("llamacpp", "vulkan_args", "--no-mmap");
+    expect_accepted("llamacpp", "cuda_args", "--no-mmap");
+    expect_accepted("llamacpp", "args", "--no-mmap");
+    expect_accepted("flm", "npu_bin", "builtin");
+    expect_accepted("flm", "args", "");
+    expect_accepted("ryzenai", "server_bin", "latest");
+    expect_accepted("hrx", "hrx_bin", "builtin");
+
+    expect_rejected("llamacpp", "vulkan_bin", 1, "'llamacpp.vulkan_bin' must be a string");
+    expect_rejected("llamacpp", "vulkan_args", 1, "'llamacpp.vulkan_args' must be a string");
+    const std::string missing_bin =
+        (std::filesystem::temp_directory_path() / "lemonade-does-not-exist" / "llama-server")
+            .string();
+    expect_rejected("llamacpp", "vulkan_bin", missing_bin,
+                    "'llamacpp.vulkan_bin' path does not exist");
+
     return failures == 0 ? 0 : 1;
 }
```

**File**: `test/server_endpoints.py` (modified, +24/-0)
```diff
@@ -8632,6 +8632,30 @@ def test_065_unversioned_docs_returns_404_and_not_spa(self):
                 "/docs-example returned unexpected status without web app",
             )
 
+    def test_066_backend_bin_and_args_keys_must_name_a_real_variant(self):
+        """/internal/set rejects *_bin / *_args keys that name no backend variant."""
+        config_url = f"http://localhost:{PORT}/internal/config"
+        set_url = f"http://localhost:{PORT}/internal/set"
+
+        for key in ("flm_bin", "foo_args"):
+            bad = requests.post(
+                set_url, json={"flm": {key: "builtin"}}, timeout=TIMEOUT_DEFAULT
+            )
+            self.assertEqual(bad.status_code, 400, bad.text)
+            self.assertIn(f"Unknown key: 'flm.{key}'", bad.text)
+
+        config = requests.get(config_url, timeout=TIMEOUT_DEFAULT).json()
+        self.assertNotIn("flm_bin", config.get("flm", {}))
+        self.assertNotIn("foo_args", config.get("flm", {}))
+
+        prior = config.get("llamacpp", {}).get("vulkan_bin", "builtin")
+        resp = requests.post(
+            set_url,
+            json={"llamacpp": {"vulkan_bin": prior}},
+            timeout=TIMEOUT_DEFAULT,
+        )
+        self.assertEqual(resp.status_code, 200, f"/internal/set failed: {resp.text}")
+
 
 if __name__ == "__main__":
     run_server_tests(EndpointTests, "ENDPOINT TESTS")
```

---

### Incident Patch 8: `e249a043` (2026-09-29)
**Commit Message**: fix: change deprecated --no-mmap option to --load-mode none for llama.cpp (#3559)

Co-authored-by: Sreeram <[REDACTED_EMAIL]>

**File**: `docs/api/lemonade.md` (modified, +7/-7)
```diff
@@ -409,22 +409,22 @@ curl http://localhost:13305/v1/models/Qwen3-0.6B-GGUF/options
 
 ### Response format
 
-`effective` is the exact request body a [`POST /v1/load`](#post-v1load) for this model uses right now, with every option the recipe accepts resolved through the full priority chain. `defaults` is what a reset model would get. For `llamacpp`, with `--no-mmap` saved and the context size left automatic:
+`effective` is the exact request body a [`POST /v1/load`](#post-v1load) for this model uses right now, with every option the recipe accepts resolved through the full priority chain. `defaults` is what a reset model would get. For `llamacpp`, with `--load-mode none` saved and the context size left automatic:
 
 ```json
 {
   "model_name": "Qwen3-0.6B-GGUF",
   "recipe": "llamacpp",
   "saved": {
-    "llamacpp_args": "--no-mmap"
+    "llamacpp_args": "--load-mode none"
   },
   "effective": {
     "auto_evict": null,
     "ctx_size": -1,
     "downsize_idle_timeout": 60,
     "evict_idle_timeout": 300,
     "evict_weight_factor": 1.0,
-    "llamacpp_args": "--no-mmap",
+    "llamacpp_args": "--load-mode none",
     "llamacpp_backend": "vulkan",
     "llamacpp_device": "",
     "merge_args": true,
@@ -1196,7 +1196,7 @@ curl -X POST http://localhost:13305/v1/load \
     "model_name": "Qwen3-0.6B-GGUF",
     "ctx_size": 8192,
     "llamacpp_backend": "rocm",
-    "llamacpp_args": "--flash-attn on --no-mmap"
+    "llamacpp_args": "--flash-attn on --load-mode none"
   }'
 ```
 
@@ -1209,7 +1209,7 @@ curl -X POST http://localhost:13305/v1/load \
     "model_name": "Qwen3-0.6B-GGUF",
     "ctx_size": 8192,
     "llamacpp_backend": "vulkan",
-    "llamacpp_args": "--no-context-shift --no-mmap",
+    "llamacpp_args": "--no-context-shift --load-mode none",
     "save_options": true
   }'
 ```
@@ -1539,11 +1539,11 @@ curl http://localhost:13305/v1/health
         "-m", "~/.cache/huggingface/hub/models--nomic-ai--nomic-embed-text-v1-GGUF/.../nomic-embed-text-v1.Q4_K_S.gguf",
         "--ctx-size", "8192",
         "--port", "8002",
-        "--no-mmap"
+        "--load-mode none"
       ],
       "recipe_options": {
         "ctx_size": 8192,
-        "llamacpp_args": "--no-mmap",
+        "llamacpp_args": "--load-mode none",
         "llamacpp_backend": "rocm"
       },
       "backend_url": "http://127.0.0.1:8002/v1"
```

**File**: `docs/api/openai.md` (modified, +1/-1)
```diff
@@ -1174,7 +1174,7 @@ Returns a single model object with the same fields as described in the [models l
   "labels": ["reasoning"],
   "recipe_options": {
     "ctx_size": 8192,
-    "llamacpp_args": "--no-mmap",
+    "llamacpp_args": "--load-mode none",
     "llamacpp_backend": "rocm"
   }
 }
```

**File**: `docs/guide/cli.md` (modified, +1/-1)
```diff
@@ -494,7 +494,7 @@ lemonade load Qwen3-0.6B-GGUF --ctx-size 4096 --save-options
 lemonade load Qwen3-0.6B-GGUF --llamacpp vulkan
 
 # Load a llama.cpp model with custom arguments
-lemonade load Qwen3-0.6B-GGUF --llamacpp-args "--flash-attn on --no-mmap"
+lemonade load Qwen3-0.6B-GGUF --llamacpp-args "--flash-attn on --load-mode none"
 
 # Load a model without merging global args (per-model args replace global entirely)
 lemonade load Qwen3-0.6B-GGUF --no-merge-args --llamacpp-args "--flash-attn on"
```

**File**: `test/cpp/test_custom_args.cpp` (modified, +9/-9)
```diff
@@ -130,17 +130,17 @@ int main() {
         "--override-kv a=bool:false --override-kv b=bool:false --threads 8");
     failures += !expect_merge(
         "binary negation precedence is preserved",
-        "--no-mmap",
-        "--mmap --override-kv a=bool:false --override-kv b=bool:false",
-        "--no-mmap --override-kv a=bool:false --override-kv b=bool:false");
+        "--no-jinja",
+        "--jinja --override-kv a=bool:false --override-kv b=bool:false",
+        "--no-jinja --override-kv a=bool:false --override-kv b=bool:false");
 
     // Overridable-arg detection must compare complete flag tokens, not
     // substrings, so a flag name appearing only inside a value or file path
     // does not suppress a Lemonade default (regression for llama.cpp arg
-    // handling, e.g. "--load-mode none" and the -lm / --mmap aliases).
+    // handling, e.g. "--load-mode none" and the -lm / --load-mode aliases).
     failures += !expect_has_flag(
-        "real long alias token matches",
-        "--no-mmap", "--no-mmap", true);
+        "real long flag token matches",
+        "--load-mode none", "--load-mode", true);
     failures += !expect_has_flag(
         "real short alias token matches",
         "-lm", "-lm", true);
@@ -149,16 +149,16 @@ int main() {
         "--load-mode=auto", "--load-mode", true);
     failures += !expect_has_flag(
         "equals-value alias matches",
-        "--mmap=auto", "--mmap", true);
+        "-lm=auto", "-lm", true);
     failures += !expect_has_flag(
         "alias inside path does not match",
         "--lora /models/alma-lm-adapter.gguf", "-lm", false);
     failures += !expect_has_flag(
         "long alias inside value does not match",
-        "--override-kv tokenizer.mmap=auto", "--mmap", false);
+        "--override-kv tokenizer.load-mode=auto", "--load-mode", false);
     failures += !expect_has_flag(
         "missing alias does not match",
-        "--threads 8", "--mmap", false);
+        "--threads 8", "--load-mode", false);
 
     std::printf("\n%d failures\n", failures);
     return failures == 0 ? 0 : 1;
```

**File**: `test/cpp/test_hrx_contract.cpp` (modified, +2/-2)
```diff
@@ -47,11 +47,11 @@ void check_launch_contract() {
         "--jinja",
         "--metrics",
         "--threads", "7",
-        "--no-mmap",
+        "--load-mode", "none",
         "--parallel", "1",
     };
     const auto argv = hrx::build_server_argv(
-        "/models/qualified.gguf", 32768, 14123, "--threads 7 --no-mmap");
+        "/models/qualified.gguf", 32768, 14123, "--threads 7 --load-mode none");
     check("HRX builds the complete managed argv with a benign custom tail",
           argv == expected_argv);
 
```

**File**: `test/cpp/test_recipe_arg_resolution.cpp` (modified, +6/-6)
```diff
@@ -52,14 +52,14 @@ int main() {
     const std::string backend = "-b 2048 -ub 1024 -np 1";
     const std::string architecture = "--temp 0.8 --top-k 40";
     const std::string model_defaults = "--flash-attn on";
-    const std::string model = "--no-mmap --threads 8";
+    const std::string model = "--load-mode none --threads 8";
 
     failures += !expect_args(
         "no request inherits backend and model scope",
         resolve_scoped_custom_args(
             {backend, architecture, model_defaults, model,
              CustomArgsRequestState::Omitted, "", true}),
-        "-b 2048 -ub 1024 -np 1 --temp 0.8 --top-k 40 --no-mmap --threads 8");
+        "-b 2048 -ub 1024 -np 1 --temp 0.8 --top-k 40 --load-mode none --threads 8");
 
     failures += !expect_args(
         "request replaces model scope and keeps backend",
@@ -111,11 +111,11 @@ int main() {
         "-b 2048 --threads 4");
 
     failures += !expect_args(
-        "request negation overrides backend opposite",
+        "request load-mode overrides backend load-mode",
         resolve_scoped_custom_args(
-            {"--mmap -b 2048", "", "", "",
-             CustomArgsRequestState::Value, "--no-mmap", true}),
-        "-b 2048 --no-mmap");
+            {"--load-mode mmap -b 2048", "", "", "",
+             CustomArgsRequestState::Value, "--load-mode none", true}),
+        "-b 2048 --load-mode none");
 
     failures += !expect_args(
         "repeatable request flags survive wholesale model replacement",
```

**File**: `test/server_endpoints.py` (modified, +5/-5)
```diff
@@ -1597,7 +1597,7 @@ def test_012le_load_request_args_still_merge_global_args(self):
             timeout=TIMEOUT_DEFAULT,
         )
         self._reset_options()
-        self._set_global_llamacpp_args("--no-mmap --threads 1")
+        self._set_global_llamacpp_args("--load-mode none --threads 1")
 
         response = requests.post(
             self._options_url(),
@@ -1624,7 +1624,7 @@ def test_012le_load_request_args_still_merge_global_args(self):
         self.assertIsNotNone(loaded)
         loaded_args = loaded.get("recipe_options", {}).get("llamacpp_args", "")
         self.assertIn("--threads 2", loaded_args)
-        self.assertIn("--no-mmap", loaded_args)
+        self.assertIn("--load-mode none", loaded_args)
         self.assertNotIn("--threads-batch 1", loaded_args)
         self.assertNotIn("--threads 1 ", loaded_args + " ")
 
@@ -1685,11 +1685,11 @@ def test_012o_model_options_merge_and_delete(self):
         )
         merged = requests.post(
             self._options_url(),
-            json={"llamacpp_args": "--no-mmap"},
+            json={"llamacpp_args": "--load-mode none"},
             timeout=TIMEOUT_DEFAULT,
         ).json()
         self.assertEqual(merged["saved"].get("ctx_size"), 4096)
-        self.assertEqual(merged["saved"].get("llamacpp_args"), "--no-mmap")
+        self.assertEqual(merged["saved"].get("llamacpp_args"), "--load-mode none")
 
         # Clearing one key leaves the other alone
         partial = requests.post(
@@ -1851,7 +1851,7 @@ def test_012t_effective_replays_as_a_load_command(self):
                 self._reset_options()
                 requests.post(
                     self._options_url(),
-                    json={"ctx_size": ctx_size, "llamacpp_args": "--no-mmap"},
+                    json={"ctx_size": ctx_size, "llamacpp_args": "--load-mode none"},
                     timeout=TIMEOUT_DEFAULT,
                 )
                 effective = requests.get(
```

---

### Incident Patch 9: `e9d0fc36` (2026-09-28)
**Commit Message**: fix(server): abort non-streaming requests on client disconnect (#2898)

Client drops during non-streaming inference left the backend computing
the abandoned request to completion, holding the slot for other clients.
The connection-liveness checker now propagates through the request scope
so the upstream transfer aborts promptly.

The documented guarantee covers the OpenAI non-streaming endpoints only;
the Anthropic/Ollama/MCP gateways and streaming Omni are excluded and
remain future work. The C++ regression suite covers the abort via a
mock backend.

**File**: `.github/workflows/cpp_server_build_test_release.yml` (modified, +1/-0)
```diff
@@ -2013,6 +2013,7 @@ jobs:
         run: |
           .venv/bin/python -m test.utils.reset_server_state --best-effort --label "ubuntu endpoints"
           .venv/bin/python test/server_endpoints.py --cli-binary lemonade
+          .venv/bin/python test/server_cancellation.py --cli-binary lemonade
           echo "Running WebSocket idle test..."
           .venv/bin/python test/test_websocket_idle.py
           echo "WebSocket idle test PASSED!"
```

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -194,3 +194,4 @@ These MUST be maintained in all changes:
 8. **Web-app dependencies constrained by Debian native packaging** — `src/web-app/package.json` is kept separate from `src/app/package.json` because the native Debian package (`lemonade-server` .deb) must build using only npm modules available in Debian's `/usr/share/nodejs` (see `USE_SYSTEM_NODEJS_MODULES` in `src/web-app/webpack.config.js`). The old Electron app depended on packages Debian does not ship. Do NOT consolidate the two `package.json` files — the split is required for reproducible distro packaging.
 9. **Desktop app is on-demand; `lemond` runs independently** — On Windows, `LemonadeServer.exe` (which embeds `lemond` + tray icon) is the always-on process, auto-started via the Windows startup folder. The Tauri desktop app (`lemonade-app.exe`) is opened on demand when the user wants the UI and must not be added to startup. The desktop app must not embed or manage `lemond`'s lifecycle — it discovers the already-running server (UDP beacon for local, explicit base URL for remote) and speaks to it over HTTP.
 10. **Quad-prefix registration** — Every new endpoint MUST be registered under `/api/v0/`, `/api/v1/`, `/v0/`, AND `/v1/`. Documented exceptions: Ollama (`/api/*` without version prefix), Anthropic (`POST /v1/messages` only), and MCP (`POST /mcp`) — each of those protocols mandates a fixed URL shape that conflicts with the quad-prefix scheme.
+11. **Client disconnect non-blocking guarantee (OpenAI non-streaming)** — Unrecoverable client socket disconnects or timeouts during OpenAI-compatible non-streaming inference (`chat/completions`, `completions`, `responses`; prefill or token generation) MUST trigger non-blocking upstream HTTP transfer aborts to the backend process without re-entering `Router` mutex scopes or triggering nuclear model reloads. Not currently covered: non-streaming paths through the Anthropic/Ollama/MCP gateways and streaming Omni (which runs inside the SSE content-provider after the handler scope ends).
```

**File**: `CMakeLists.txt` (modified, +5/-5)
```diff
@@ -3294,11 +3294,11 @@ if(BUILD_TESTING AND EXISTS "${_HTTP_CLIENT_TIMEOUT_TEST_SRC}")
     add_cpp_ci_test(HttpClientTimeoutTest CI ON COMMAND test_http_client_timeout)
 endif()
 
-set(_STREAMING_PROXY_CANCEL_TEST_SRC "${CMAKE_CURRENT_SOURCE_DIR}/test/cpp/test_streaming_proxy_cancel.cpp")
-if(BUILD_TESTING AND EXISTS "${_STREAMING_PROXY_CANCEL_TEST_SRC}")
-    add_executable(test_streaming_proxy_cancel test/cpp/test_streaming_proxy_cancel.cpp)
-    target_link_libraries(test_streaming_proxy_cancel PRIVATE lemonade-server-core)
-    add_cpp_ci_test(StreamingProxyCancelTest CI OFF COMMAND test_streaming_proxy_cancel)
+set(_REQUEST_CANCELLATION_TEST_SRC "${CMAKE_CURRENT_SOURCE_DIR}/test/cpp/test_request_cancellation.cpp")
+if(BUILD_TESTING AND EXISTS "${_REQUEST_CANCELLATION_TEST_SRC}")
+    add_executable(test_request_cancellation test/cpp/test_request_cancellation.cpp)
+    target_link_libraries(test_request_cancellation PRIVATE lemonade-server-core)
+    add_cpp_ci_test(RequestCancellationTest CI ON COMMAND test_request_cancellation)
 endif()
 
 set(_STREAMING_HEARTBEAT_TEST_SRC "${CMAKE_CURRENT_SOURCE_DIR}/test/cpp/test_streaming_heartbeat.cpp")
```

**File**: `docs/dev/getting-started.md` (modified, +4/-0)
```diff
@@ -865,6 +865,7 @@ The C++ implementation is tested using the existing Python test suite.
 |-----------|-------------|
 | `server_cli2.py` | CLI commands (version, status, list, export, backends, pull, import, load, unload, run, launch, delete) |
 | `server_endpoints.py` | HTTP endpoints (health, models, pull, load, unload, system-info, stats) |
+| `server_cancellation.py` | Client disconnect robustness (server stays healthy; prompt-abort regression lives in `test_request_cancellation`) |
 | `server_llm.py` | LLM inference (chat completions, embeddings, reranking) |
 | `server_whisper.py` | Audio transcription (whisper models) |
 | `server_sd.py` | Image generation (Stable Diffusion, ~2-3 min per image on CPU) |
@@ -877,6 +878,9 @@ python test/server_cli2.py
 # Endpoint tests (no inference backend needed)
 python test/server_endpoints.py
 
+# Client disconnect robustness tests (health checks; prompt-abort regression lives in the C++ suite)
+python test/server_cancellation.py
+
 # LLM tests (specify wrapped server and backend)
 python test/server_llm.py --wrapped-server llamacpp --backend vulkan
 
```

**File**: `docs/dev/router-policy.md` (modified, +9/-0)
```diff
@@ -290,3 +290,12 @@ Unlike a `type: "llm"` classifier (which never receives `has_tools`/
 `has_images`, see above), the router always does: it's the sole decision
 mechanism here, so `prompt` can rely on them directly — e.g. "use Vision-GGUF
 when the request includes images."
+
+## Request Cancellation & Connection Robustness
+
+When an OpenAI-compatible HTTP client disconnects or times out mid-request:
+1. **Socket Progress Interception**: `utils::HttpClient` progress callbacks (`CURLOPT_XFERINFOFUNCTION`) monitor client socket liveness during prefill and generation for both streaming and non-streaming requests.
+2. **Upstream Transfer Abort**: Detecting client disconnect immediately aborts the active upstream HTTP transfer to the backend, enabling the backend process to reclaim execution slots without re-entering `Router` mutex scopes.
+3. **Isolated Disconnect Handling**: Non-streaming client disconnects return a clean HTTP 400 "Request cancelled by client" response (`ErrorType::INVALID_REQUEST`); streaming disconnects end the SSE stream. Neither triggers a nuclear model reload nor disrupts concurrent clients.
+
+This guarantee currently covers the OpenAI-compatible non-streaming endpoints (`chat/completions`, `completions`, `responses`). Non-streaming paths through the Anthropic/Ollama/MCP gateways and streaming Omni (which runs inside the SSE content-provider after the handler scope ends) are not yet covered.
```

**File**: `src/cpp/include/lemon/utils/http_client.h` (modified, +32/-2)
```diff
@@ -8,6 +8,7 @@
 #include <iostream>
 #include <map>
 #include <memory>
+#include <stdexcept>
 #include <string>
 #include <vector>
 
@@ -51,6 +52,34 @@ struct DownloadResult {
     bool permanent = false;            // Non-recoverable failure (e.g. unsupported protocol, malformed URL); do not retry
 };
 
+class HttpClientException : public std::runtime_error {
+public:
+    HttpClientException(int curl_code, const std::string& message)
+        : std::runtime_error(message), curl_code_(curl_code) {}
+    int curl_code() const noexcept { return curl_code_; }
+private:
+    int curl_code_ = 0;
+};
+
+class HttpClientCancellationException : public HttpClientException {
+public:
+    HttpClientCancellationException(int curl_code, const std::string& message)
+        : HttpClientException(curl_code, message) {}
+};
+
+// Cancellation state for a non-streaming request. The flag is an atomic a
+// caller may share; the checker is a predicate consulted on each curl progress
+// tick, which is how a client disconnect aborts an in-flight transfer.
+struct RequestCancelToken {
+    std::atomic<bool>* flag = nullptr;
+    std::function<bool()> should_cancel = nullptr;
+
+    bool cancelled() const {
+        return (flag != nullptr && flag->load()) ||
+               (should_cancel != nullptr && should_cancel());
+    }
+};
+
 // Progress callback returns bool: true = continue, false = cancel download
 using ProgressCallback = std::function<bool(size_t downloaded, size_t total)>;
 using StreamCallback = std::function<bool(const char* data, size_t length)>;
@@ -135,15 +164,16 @@ class HttpClient {
         const std::map<std::string, std::string>& headers = {},
         long timeout_seconds = 300,
         HttpSecurityPolicy policy = HttpSecurityPolicy::ExternalHttpsOnly,
-        std::atomic<bool>* cancel_flag = nullptr);
+        const RequestCancelToken& cancel = {});
 
     // Multipart form data POST request. Redirects are never followed.
     // timeout_seconds=0 uses default_timeout_seconds_.
     static HttpResponse post_multipart(
         const std::string& url,
         const std::vector<MultipartField>& fields,
         long timeout_seconds = 300,
-        HttpSecurityPolicy policy = HttpSecurityPolicy::ExternalHttpsOnly);
+        HttpSecurityPolicy policy = HttpSecurityPolicy::ExternalHttpsOnly,
+        const RequestCancelToken& cancel = {});
 
     // Streaming POST request (calls callback for each chunk as it arrives).
     // on_status fires once, before the first chunk is delivered, so callers can
```

**File**: `src/cpp/include/lemon/wrapped_server.h` (modified, +16/-3)
```diff
@@ -443,8 +443,19 @@ class WrappedServer : public ICompletionServer {
 
     void set_load_cancel_flag(std::atomic<bool>* f) { load_cancel_ = f; }
 
-    static void set_request_cancel_flag(std::atomic<bool>* f);
-    static std::atomic<bool>* current_request_cancel();
+    class RequestCancelScope {
+    public:
+        explicit RequestCancelScope(const utils::RequestCancelToken& token);
+        ~RequestCancelScope();
+
+        RequestCancelScope(const RequestCancelScope&) = delete;
+        RequestCancelScope& operator=(const RequestCancelScope&) = delete;
+
+    private:
+        utils::RequestCancelToken prev_token_;
+    };
+
+    static utils::RequestCancelToken current_request_cancel_context();
 
     // Downsize the model on soft idle (e.g., clear KV cache). Returns true if the
     // downsize succeeded (or was a no-op), false if the backend operation failed.
@@ -610,7 +621,9 @@ class WrappedServer : public ICompletionServer {
     void set_watchdog_health_endpoint(const std::string& endpoint);
 
     // Common method to forward requests to the wrapped server (non-streaming)
-    json forward_request(const std::string& endpoint, const json& request, long timeout_seconds = 0);
+    json forward_request(const std::string& endpoint,
+                         const json& request,
+                         long timeout_seconds = 0);
 
     json forward_get_request(const std::string& endpoint, long timeout_seconds = 0);
 
```

**File**: `src/cpp/server/backends/cloud/cloud_server.cpp` (modified, +11/-1)
```diff
@@ -535,13 +535,20 @@ json CloudServer::post_with_auth(const std::string& path, const json& request,
     auto headers = upstream_headers(creds.auth_header, creds.api_key, "openai");
     session::apply_forwardable_session(headers);
 
+    auto cancel_token = current_request_cancel_context();
+    if (cancel_token.cancelled()) {
+        LOG(WARNING, "CloudServer") << "Client request already cancelled before forwarding cloud request; aborting." << std::endl;
+        return ErrorResponse::create("Request cancelled by client", ErrorType::INVALID_REQUEST);
+    }
+
     try {
         auto response = utils::HttpClient::post(
             url,
             request.dump(),
             headers,
             timeout_seconds,
-            creds.policy);
+            creds.policy,
+            cancel_token);
         if (response.status_code == 200) {
             // Return the body unchanged so the server.cpp handler picks up the
             // `usage` telemetry like every other backend.
@@ -562,6 +569,9 @@ json CloudServer::post_with_auth(const std::string& path, const json& request,
                 {"response", error_details}
             }
         );
+    } catch (const utils::HttpClientCancellationException& e) {
+        LOG(WARNING, "CloudServer") << "Cloud request aborted due to client disconnect: " << e.what() << std::endl;
+        return ErrorResponse::create("Request cancelled by client", ErrorType::INVALID_REQUEST);
     } catch (const std::exception& e) {
         return ErrorResponse::from_exception(NetworkException(e.what()));
     }
```

---

### Incident Patch 10: `6a20ea9b` (2026-09-25)
**Commit Message**: docs: link website-only pages to the website, revert marketplace link rewriting (#3667)

* docs: link website-only pages (models, marketplace) to the website

The model browser and marketplace exist only on lemonade-server.ai; their
in-repo sources (server_models.json, the marketplace repo) aren't browsable.
Document the exception in the link policy.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* docs: revert marketplace README link rewriting

The script only runs on the website branch, whose README is not published,
and apps.json already carries working guide URLs. The GAIA override and the
fallback also masked marketplace data instead of letting it be fixed there.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Update link text for model catalog in README

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ Lemonade comes in two flavors:
 2. **Get Models**: Browse and download with the [Model Manager](#model-library)
 3. **Generate**: Try models with the built-in interfaces for chat, image gen, speech gen, and more
 4. **Mobile**: Take your lemonade to go: [iOS](https://apps.apple.com/us/app/lemonade-mobile/id6757372210) · [Android](https://play.google.com/store/apps/details?id=com.lemonade.mobile.chat.ai&pli=1) · [Source](https://github.com/lemonade-sdk/lemonade-mobile)
-5. **Connect**: Use Lemonade with your [favorite apps](https://github.com/lemonade-sdk/marketplace):
+5. **Connect**: Use Lemonade with your [favorite apps](https://lemonade-server.ai/marketplace):
 
 <!-- MARKETPLACE_START -->
 <p align="center">
@@ -126,7 +126,7 @@ Lemonade supports a wide variety of LLMs (**GGUF**, **FLM**, and **ONNX**), whis
 
 Use `lemonade pull` or the built-in **Model Manager** to download models. Custom GGUF/ONNX models can be pulled from Hugging Face or ModelScope, with their source retained for future updates.
 
-**[Browse the built-in model registry →](./src/cpp/resources/server_models.json)**
+**[Browse the included model catalog →](https://lemonade-server.ai/models.html)**
 
 <br clear="right"/>
 
```

**File**: `docs/dev/documentation.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ Add a ToC only if the document has **5 or more H2 sections**. Use a plain markdo
 
 ### Links
 
-Link to documentation in this repository using relative Markdown file paths, including the `.md` extension (for example, `../guide/install/windows.md`). Avoid published website URLs and hardcoded `blob/main` URLs for these links. Relative paths keep the source and destination on the same branch or tag; the website is published separately at release boundaries. Use the same convention in generated documentation. For repository-only files outside `docs/`, use explicit GitHub URLs so links also work on the published website.
+Link to documentation in this repository using relative Markdown file paths, including the `.md` extension (for example, `../guide/install/windows.md`). Avoid published website URLs and hardcoded `blob/main` URLs for these links. Relative paths keep the source and destination on the same branch or tag; the website is published separately at release boundaries. Use the same convention in generated documentation. For repository-only files outside `docs/`, use explicit GitHub URLs so links also work on the published website. Pages that exist only on the website, such as the [model browser](https://lemonade-server.ai/models.html) and the [marketplace](https://lemonade-server.ai/marketplace), have no in-repo equivalent, so link to them on the website.
 
 ### Code blocks
 
```

**File**: `docs/integrations/README.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 This folder contains integration guides for connecting third-party applications to Lemonade Server.
 
-For a complete list of compatible apps with links to guides, videos, and more, visit the **[Lemonade Marketplace](https://github.com/lemonade-sdk/marketplace)**.
+For a complete list of compatible apps with links to guides, videos, and more, visit the **[Lemonade Marketplace](https://lemonade-server.ai/marketplace)**.
```

**File**: `docs/update_readme_marketplace.py` (modified, +0/-13)
```diff
@@ -8,7 +8,6 @@
 import re
 import sys
 from pathlib import Path
-from urllib.parse import urlsplit
 from urllib.request import urlopen
 from urllib.error import URLError
 
@@ -55,18 +54,6 @@ def generate_markdown(apps: list) -> str:
         name = app.get("name", "Unknown")
         logo = app.get("logo", "")
         link = app.get("links", {}).get("guide") or app.get("links", {}).get("app", "#")
-        if app.get("id") == "gaia":
-            link = "https://github.com/amd/gaia"
-        guide_url = urlsplit(link)
-        if guide_url.hostname == "lemonade-server.ai":
-            guide_name = guide_url.path.rstrip("/").rsplit("/", 1)[-1]
-            guide = Path("docs/integrations") / f"{guide_name}.md"
-            if (README_PATH.parent / guide).is_file():
-                link = f"./{guide.as_posix()}"
-                if guide_url.fragment:
-                    link += f"#{guide_url.fragment}"
-            else:
-                link = "./docs/integrations/README.md"
 
         if logo:
             icon_html = f'<a href="{link}" title="{name}"><img src="{logo}" alt="{name}" width="60" /></a>'
```

---

### Incident Patch 11: `a1966988` (2026-09-24)
**Commit Message**: Fix repository documentation links and published docs paths (#3665)

* docs: keep repository documentation links on GitHub

* docs: refresh stale integration links and stabilize GAIA destination

* docs: correct published documentation paths

* docs: restore documentation guide reference links

* docs: remove trailing whitespace from FAQ

**File**: `README.md` (modified, +13/-13)
```diff
@@ -20,8 +20,8 @@
   <img src="https://github.com/lemonade-sdk/assets/blob/main/docs/banner_02.png?raw=true" alt="Lemonade Banner" />
 </p>
 <h3 align="center">
-  <a href="https://lemonade-server.ai/docs/guide/install/">Download</a> |
-  <a href="https://lemonade-server.ai/docs/">Documentation</a> |
+  <a href="./docs/guide/install/README.md">Download</a> |
+  <a href="./docs/README.md">Documentation</a> |
   <a href="https://discord.gg/5xXzkMu8Zk">Discord</a>
 </h3>
 
@@ -36,15 +36,15 @@ Lemonade comes in two flavors:
 
 ## Getting Started
 
-1. **Install**: [Windows](https://lemonade-server.ai/docs/guide/install/windows/) · [Linux](https://lemonade-server.ai/docs/guide/install/linux/) · [macOS](https://lemonade-server.ai/docs/guide/install/macos/) · [Docker](https://lemonade-server.ai/docs/guide/install/docker/) · [Source](./docs/dev/getting-started.md)
+1. **Install**: [Windows](./docs/guide/install/windows.md) · [Linux](./docs/guide/install/linux.md) · [macOS](./docs/guide/install/macos.md) · [Docker](./docs/guide/install/docker.md) · [Source](./docs/dev/getting-started.md)
 2. **Get Models**: Browse and download with the [Model Manager](#model-library)
 3. **Generate**: Try models with the built-in interfaces for chat, image gen, speech gen, and more
 4. **Mobile**: Take your lemonade to go: [iOS](https://apps.apple.com/us/app/lemonade-mobile/id6757372210) · [Android](https://play.google.com/store/apps/details?id=com.lemonade.mobile.chat.ai&pli=1) · [Source](https://github.com/lemonade-sdk/lemonade-mobile)
-5. **Connect**: Use Lemonade with your [favorite apps](https://lemonade-server.ai/marketplace):
+5. **Connect**: Use Lemonade with your [favorite apps](https://github.com/lemonade-sdk/marketplace):
 
 <!-- MARKETPLACE_START -->
 <p align="center">
-  <a href="https://lemonade-server.ai/docs/server/apps/claude-code/" title="Claude Code"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/claude-code/logo.png" alt="Claude Code" width="60" /></a>&nbsp;&nbsp;<a href="https://quickthoughts.ca/posts/firefox-chatback-lemonade-sdk/" title="Firefox Chatbot"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/fx-chatbot/logo.png" alt="Firefox Chatbot" width="60" /></a>&nbsp;&nbsp;<a href="https://lemonade-server.ai/docs/server/apps/anythingLLM/" title="AnythingLLM"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/anythingllm/logo.png" alt="AnythingLLM" width="60" /></a>&nbsp;&nbsp;<a href="https://marketplace.dify.ai/plugins/langgenius/lemonade" title="Dify"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/dify/logo.png" alt="Dify" width="60" /></a>&nbsp;&nbsp;<a href="https://github.com/amd/gaia?tab=readme-ov-file#getting-started-guide" title="GAIA"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/gaia/logo.png" alt="GAIA" width="60" /></a>&nbsp;&nbsp;<a href="https://admcpr.com/local-github-copilot-with-lemonade-server-on-windows" title="GitHub Copilot"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/github-copilot/logo.png" alt="GitHub Copilot" width="60" /></a>&nbsp;&nbsp;<a href="https://github.com/lemonade-sdk/infinity-arcade" title="Infinity Arcade"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/infinity-arcade/logo.png" alt="Infinity Arcade" width="60" /></a>&nbsp;&nbsp;<a href="https://n8n.io/integrations/lemonade-model/" title="n8n"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/n8n/logo.png" alt="n8n" width="60" /></a>&nbsp;&nbsp;<a href="https://lemonade-server.ai/docs/server/apps/open-webui/" title="Open WebUI"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/open-webui/logo.png" alt="Open WebUI" width="60" /></a>&nbsp;&nbsp;<a href="https://lemonade-server.ai/docs/server/apps/open-hands/" title="OpenHands"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/openhands/logo.png" alt="OpenHands" width="60" /></a>
+  <a href="./docs/integrations/claude-code.md" title="Claude Code"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/claude-code/logo.png" alt="Claude Code" width="60" /></a>&nbsp;&nbsp;<a href="https://quickthoughts.ca/posts/firefox-chatback-lemonade-sdk/" title="Firefox Chatbot"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/fx-chatbot/logo.png" alt="Firefox Chatbot" width="60" /></a>&nbsp;&nbsp;<a href="./docs/integrations/anythingLLM.md" title="AnythingLLM"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/anythingllm/logo.png" alt="AnythingLLM" width="60" /></a>&nbsp;&nbsp;<a href="https://marketplace.dify.ai/plugins/langgenius/lemonade" title="Dify"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/dify/logo.png" alt="Dify" width="60" /></a>&nbsp;&nbsp;<a href="https://githu
```

**File**: `docs/api/lemonade.md` (modified, +1/-1)
```diff
@@ -1751,7 +1751,7 @@ text/plain; version=0.0.4; charset=utf-8
 
 ### Lemonade Metric Families
 
-The authoritative metric-family list is generated by the `/metrics` implementation in [`src/cpp/server/server.cpp`](../../src/cpp/server/server.cpp). Search for `handle_metrics` and `metrics.describe(...)` to see the current names, types, labels, and descriptions.
+The authoritative metric-family list is generated by the `/metrics` implementation in [`src/cpp/server/server.cpp`](https://github.com/lemonade-sdk/lemonade/blob/main/src/cpp/server/server.cpp). Search for `handle_metrics` and `metrics.describe(...)` to see the current names, types, labels, and descriptions.
 
 Unsupported, unavailable, null, NaN, and infinity values are omitted rather than emitted as samples.
 
```

**File**: `docs/dev/adding-a-backend.md` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ A new capability, a request type with no existing endpoint, is a larger change.
 | Capability interface `I<Thing>Server` | `src/cpp/include/lemon/server_capabilities.h` |
 | A `ModelType` value and its label mapping | `src/cpp/include/lemon/model_types.h`. Add it to `Router::get_pinned_model_counts` so loaded models of the new type are counted. |
 | Router method that `dynamic_cast`s to your interface and dispatches | `src/cpp/server/router.h`, `src/cpp/server/router.cpp` |
-| Endpoint handler, registered with `register_post` or `register_get` | `src/cpp/server/server.cpp`. One call registers all four `/api/v0`, `/api/v1`, `/v0`, `/v1` prefixes ([invariant 1](../../AGENTS.md)). |
+| Endpoint handler, registered with `register_post` or `register_get` | `src/cpp/server/server.cpp`. One call registers all four `/api/v0`, `/api/v1`, `/v0`, `/v1` prefixes ([invariant 1](https://github.com/lemonade-sdk/lemonade/blob/main/AGENTS.md)). |
 | API documentation | `docs/api/` |
 
 Pick the API-doc file by protocol: extend `docs/api/openai.md` for an OpenAI-compatible endpoint, add a file alongside `docs/api/llamacpp.md` when you mirror another server's standard, or use `docs/api/lemonade.md` for a Lemonade-specific endpoint. Follow the API reference structure from the [documentation guide](documentation.md): an H2 `METHOD /path` heading, a status badge, a one-sentence description, a parameters table, a curl example, and the response format.
```

**File**: `docs/dev/documentation.md` (modified, +4/-0)
```diff
@@ -111,6 +111,10 @@ Add a ToC only if the document has **5 or more H2 sections**. Use a plain markdo
 
 ## Formatting
 
+### Links
+
+Link to documentation in this repository using relative Markdown file paths, including the `.md` extension (for example, `../guide/install/windows.md`). Avoid published website URLs and hardcoded `blob/main` URLs for these links. Relative paths keep the source and destination on the same branch or tag; the website is published separately at release boundaries. Use the same convention in generated documentation. For repository-only files outside `docs/`, use explicit GitHub URLs so links also work on the published website.
+
 ### Code blocks
 
 Always include a language tag.
```

**File**: `docs/guide/concepts.md` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ In the OpenAI API standard, applications and servers communicate in the form of
 | Assistant | Messages sent from the LLM to the application. |
 | User      | Messages sent from the application to the LLM. Often these messages are written by the application's end-user. |
 
-OpenAI also provides [convenient libraries](https://platform.openai.com/docs/libraries/python-library#install-an-official-sdk) in JavaScript, Python, .Net, Java, and Go to help application and server developers adhere to the standard.
+OpenAI also provides [convenient libraries](https://developers.openai.com/api/docs/libraries) in JavaScript, Python, .Net, Java, and Go to help application and server developers adhere to the standard.
 
 For example, the following Python code demonstrates how an application can request an LLM response from the Lemonade Server:
 
```

**File**: `docs/guide/faq.md` (modified, +8/-9)
```diff
@@ -5,24 +5,23 @@
 ### 1. **What is Lemonade and what does it include?**
 
    Lemonade is an open-source local LLM solution that:
-   
+
    - Gets you started in minutes with one-click installers.
    - Auto-configures optimized inference engines for your PC.
    - Provides a convenient app to get set up and test out LLMs.
    - Provides LLMs through the OpenAI API standard, enabling apps on your PC to access them.
 
 ### 2. **What are the use cases for different audiences?**
 
-   - **LLM Enthusiasts**: LLMs on your GPU or NPU with minimal setup, and connect to great apps listed [here](https://lemonade-server.ai/docs/server/apps/).
-   - **Developers**: Integrate LLMs into apps using standard APIs with no device-specific code. See the [Server Integration Guide](https://lemonade-server.ai/docs/server/server_integration/
-   ).
+   - **LLM Enthusiasts**: LLMs on your GPU or NPU with minimal setup, and connect to great apps listed [here](../integrations/README.md).
+   - **Developers**: Integrate LLMs into apps using standard APIs with no device-specific code. See the [Server Integration Guide](../api/README.md).
    - **Agent Developers**: Use [GAIA](https://github.com/amd/gaia) to quickly develop local-first agents.
 
 ## Installation & Compatibility
 
 ### 1. **How do I install Lemonade SDK or Server?**
 
-   Visit https://lemonade-server.ai/docs/guide/install/ and click the options that apply to you.
+   Visit the [installation guide](./install/README.md) and click the options that apply to you.
 
 ### 2. **Which devices are supported?**
 
@@ -34,8 +33,8 @@
 
    Yes, both Linux and macOS are supported!
 
-   - **Linux**: Visit https://lemonade-server.ai/docs/guide/install/ for installation instructions.
-   - **macOS**: A macOS installer (.pkg) is available for Apple Silicon Macs. Visit https://lemonade-server.ai/docs/guide/install/ to download. macOS support uses the llama.cpp backend with Metal acceleration.
+   - **Linux**: Visit the [installation guide](./install/README.md) for installation instructions.
+   - **macOS**: A macOS installer (.pkg) is available for Apple Silicon Macs. Visit the [installation guide](./install/README.md) to download. macOS support uses the llama.cpp backend with Metal acceleration.
 
    Visit the [Supported Configurations](https://github.com/lemonade-sdk/lemonade?tab=readme-ov-file#supported-configurations) section to see the support matrix for CPU, GPU, and NPU.
 
@@ -90,7 +89,7 @@
    Lemonade supports a wide range of LLMs including LLaMA, DeepSeek, Qwen, Gemma, Phi, gpt-oss, LFM, and many more. Most GGUF models can also be added to Lemonade Server by users using the Model Manager interface in the app or the `pull` command on the CLI.
 
    👉 [Supported Models List](https://lemonade-server.ai/models.html)
-   👉 [pull command](https://lemonade-server.ai/docs/lemonade-cli/#options-for-pull)
+   👉 [pull command](./cli.md#options-for-pull)
 
 ### 3. **How do I know what size model will work with my setup?**
 
@@ -108,7 +107,7 @@
 
    You can:
 
-   - Add a custom model manually via the app's "Add a Model" interface or the [CLI pull command](https://lemonade-server.ai/docs/lemonade-cli/#options-for-pull). For advanced manual configuration, see the [Custom Model Configuration Guide](https://lemonade-server.ai/docs/server/custom-models/).
+   - Add a custom model manually via the app's "Add a Model" interface or the [CLI pull command](./cli.md#options-for-pull). For advanced manual configuration, see the [Custom Model Configuration Guide](./configuration/custom-models.md).
    - Use a pull request to add the model to the built-in `server_models.json` file.
    - Request support by opening a [GitHub issue](https://github.com/lemonade-sdk/lemonade/issues).
 
```

**File**: `docs/integrations/README.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 This folder contains integration guides for connecting third-party applications to Lemonade Server.
 
-For a complete list of compatible apps with links to guides, videos, and more, visit the **[Lemonade Marketplace](https://lemonade-server.ai/marketplace)**.
+For a complete list of compatible apps with links to guides, videos, and more, visit the **[Lemonade Marketplace](https://github.com/lemonade-sdk/marketplace)**.
```

**File**: `docs/integrations/anythingLLM.md` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ AnythingLLM also supports complex multi-step agentic tool calling. You can do th
   <img src="https://github.com/lemonade-sdk/assets/blob/main/anythingllm/tool-calling.png?raw=true" alt="Complex multi-step agentic tool calling with simple natural language" width="600"/>
 </div>
 
-You can find more details about agent usage [here](https://docs.anythingllm.com/agent/usage).
+You can find more details about agent usage [here](https://docs.anythingllm.com/agent/overview).
 
 ## Additional Resources
 
```

---

### Incident Patch 12: `25a73abf` (2026-09-21)
**Commit Message**: docs(models): name the custom model guide's sections after their topics (#3640)

"Choose a Workflow" named the act of choosing rather than a topic, and its
subsections named mechanisms ("with explicit CLI flags") or a source shared by
several of them ("from Hugging Face or ModelScope"), so none of them said what
distinguishes one from the next. They are now named after the command that runs
them and the input you supply.

"Overview" was a leftover. It introduced the two JSON config files and sat at
the top of the page when the page was only about those files; 34ad11350
prepended the CLI workflows above it and it has drifted down ever since,
reaching line 243. It is renamed for what it holds and moved to sit above the
two sections it introduces, with the short "Edit JSON files directly" folded
into it.

Two subsections were not workflows: sharing a collection between machines is
promoted to its own section, and the intro gains a table of the three ways to
add a model.

Link updates in four other documents follow the renamed headings.

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `docs/api/lemonade.md` (modified, +1/-1)
```diff
@@ -770,7 +770,7 @@ Files written by `lemonade export` (and the desktop app's Export button) are imp
 This works for regular models and collections alike; exported collection files additionally
 carry `components` plus a `models` array embedding each component's definition (see the
 `models` parameter above). For the file format and the export/import/Hugging Face workflows,
-see [Share a collection](../guide/configuration/custom-models.md#share-a-collection-export-import-and-model-registries).
+see [Share a collection](../guide/configuration/custom-models.md#share-a-collection-between-machines).
 
 ### Streaming Response (stream=true)
 
```

**File**: `docs/api/openai.md` (modified, +1/-1)
```diff
@@ -1156,7 +1156,7 @@ curl http://localhost:13305/v1/models/Qwen3-0.6B-GGUF
 
 ### Response format
 
-Returns a single model object with the same fields as described in the [models list endpoint](#get-v1models) above. For Omni collections (`recipe: "collection.omni"`), the object additionally carries `components` (ordered component names) and `models` (each component's full model object) — see the [collection file documentation](../guide/configuration/custom-models.md#share-a-collection-export-import-and-model-registries).
+Returns a single model object with the same fields as described in the [models list endpoint](#get-v1models) above. For Omni collections (`recipe: "collection.omni"`), the object additionally carries `components` (ordered component names) and `models` (each component's full model object) — see the [collection file documentation](../guide/configuration/custom-models.md#share-a-collection-between-machines).
 
 ```json
 {
```

**File**: `docs/dev/app.md` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ npm run watch:renderer         # Webpack watch mode for the renderer only
 
 ## Testing custom Omni Models
 
-The custom Omni Model UI (see [Register a custom Omni Model from the desktop app](../guide/configuration/custom-models.md#register-a-custom-omni-model-from-the-desktop-app)) has both an automated smoke test and a manual checklist.
+The custom Omni Model UI (see [Register a custom Omni Model from the desktop app](../guide/configuration/custom-models.md#build-an-omni-model-in-the-desktop-app)) has both an automated smoke test and a manual checklist.
 
 ### Automated unit test
 
```

**File**: `docs/dev/lemonade-omni.md` (modified, +2/-2)
```diff
@@ -86,6 +86,6 @@ python examples/lemonade_tools.py "Say hello world out loud"
 
 ## Custom Omni Models
 
-You can build your own omni model from registered models — see [Register a custom Omni Model from the desktop app](../guide/configuration/custom-models.md#register-a-custom-omni-model-from-the-desktop-app) in the custom models guide. The planner LLM must carry the `tool-calling` label, and each modality must have a downloaded model whose `labels` include the matching entry from the [tools table](#available-tools).
+You can build your own omni model from registered models — see [Register a custom Omni Model from the desktop app](../guide/configuration/custom-models.md#build-an-omni-model-in-the-desktop-app) in the custom models guide. The planner LLM must carry the `tool-calling` label, and each modality must have a downloaded model whose `labels` include the matching entry from the [tools table](#available-tools).
 
-To distribute a custom omni model to other machines or via Hugging Face, see [Share a collection](../guide/configuration/custom-models.md#share-a-collection-export-import-and-model-registries).
+To distribute a custom omni model to other machines or via Hugging Face, see [Share a collection](../guide/configuration/custom-models.md#share-a-collection-between-machines).
```

**File**: `docs/guide/configuration/custom-models.md` (modified, +87/-77)
```diff
@@ -1,10 +1,20 @@
 # Add a Custom Model
 
-This guide explains every supported way to add a custom model to Lemonade Server. Start with the CLI workflows below unless you specifically need to hand-edit `user_models.json` or `recipe_options.json`.
+This guide explains every supported way to add a custom model to Lemonade Server, and documents the files and naming rules behind them.
 
-## Choose a Workflow
+There are three ways to get a model into Lemonade:
 
-### Pull from Hugging Face or ModelScope
+| Option | Use when | What happens |
+|--------|----------|--------------|
+| [Pull a model](#pull-a-model) | The model is published on Hugging Face or ModelScope | Lemonade downloads it into your model store and registers it |
+| [Point at a folder of GGUFs](#model-naming-spec) | You already have GGUF files on disk, or share a library with LM Studio or llama.cpp | Lemonade lists them where they sit and downloads nothing |
+| [Edit the JSON files by hand](#configuration-files) | You need full control over a definition and can restart `lemond` | You describe the model yourself in `user_models.json` |
+
+Pulling covers most cases and has several front ends that all end in the same registration; pick one under [Pull a Model](#pull-a-model).
+
+## Pull a Model
+
+### Pull by Hugging Face or ModelScope Checkpoint
 
 A source-less pull uses the server's configured `default_model_source` (shipped default: Hugging Face), so existing commands keep working unchanged:
 
@@ -51,14 +61,16 @@ Hugging Face snapshots use the immutable commit returned by the Hub. ModelScope
 
 The desktop app's manual model form exposes the same source selector. The browse/search catalog remains Hugging Face-backed in this first version; ModelScope models can be added by repository ID through the manual form, CLI, or API.
 
-### Register with explicit CLI flags
+### Pull with an Explicit Recipe and Checkpoints
 
-Use a `user.*` name plus `--checkpoint` and `--recipe` when you need full control: multiple checkpoints, a non-default recipe, or custom labels.
+Give the model a name plus `--checkpoint` and `--recipe` when you need full control: multiple checkpoints, a non-default recipe, or custom labels.
 
 ```bash
 lemonade pull user.NAME --source SOURCE --checkpoint TYPE CHECKPOINT --recipe RECIPE [--label LABEL ...]
 ```
 
+The `user.` prefix is optional; the CLI adds it when you leave it off.
+
 Examples:
 
 ```bash
@@ -91,7 +103,7 @@ Supported registration flags:
 | `--label LABEL` | Add a label to the new model. Repeatable. Valid labels include `chat`, `coding`, `dflash`, `embeddings`, `hot`, `mtp`, `reasoning`, `reranking`, `tool-calling`, `vision`. When no [deployment label](../../api/openai.md#model-labels) is given, the recipe's default is added — `chat` for `llamacpp`, `flm`, `ryzenai-llm` and `vllm`; `transcription` for `whispercpp`; `image` for `sd-cpp`; and so on. |
 | `--components MODEL [MODEL ...]` | Components for an omni collection (see below). Use with `--recipe collection.omni`. |
 
-### Register an omni collection
+### Pull an Omni Collection
 
 A collection is a meta-model made up of components. An **omni collection** is the recipe type behind [Lemonade Omni Models](../../dev/lemonade-omni.md) — registered with `recipe: "collection.omni"`.
 
@@ -105,7 +117,7 @@ lemonade pull user.MyKit \
 
 `lemonade load user.MyKit` loads every component. `lemonade delete user.MyKit` removes only the collection entry; component files stay on disk.
 
-### Register a custom Omni Model from the desktop app
+### Build an Omni Model in the Desktop App
 
 The desktop app offers a UI-driven path to register the same `recipe: "collection.omni"` entry — useful when you want to swap in a different planner LLM or a different image/ASR/TTS backbone without waiting for a new built-in [Lemonade Omni Model](../../dev/lemonade-omni.md) to ship.
 
@@ -132,7 +144,50 @@ If a component model is deleted later, the Omni Model entry remains registered b
 
 The editor also exposes a **System Prompt** field, pre-filled with the shipped default so you can see the text you'd be replacing. Edit it to override the default for this collection only; the override stays a *template* — both the `{tool_list}` and `{tool_guidance}` placeholders are **required** in any custom prompt and the editor blocks save/export when either is missing, because the server expands them at runtime based on which components are present. A collection whose textarea matches the default — or that has been reset via **Reset to default** — stores no override and keeps tracking whatever the global default is at runtime.
 
-### Share a collection: export, import, and model registries
+### Pull from the API
+
+The `/v1/pull` endpoint accepts the same model registration fields as the CLI. Set `source` to `huggingface` or `modelscope`; when omitted, the server's configured `default_model_source` applies. The server canonicalizes and persists the resolved value for later update checks. Use this when integr
```

---

### Incident Patch 13: `5f899725` (2026-09-20)
**Commit Message**: fix: support mbedTLS 4 on Arch Linux (#3188)

**File**: `CMakeLists.txt` (modified, +1/-1)
```diff
@@ -472,7 +472,7 @@ endif()
 if(NOT USE_SYSTEM_HTTPLIB)
     FetchContent_Declare(httplib
         GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
-        GIT_TAG fe332fa06bac76a1c6d402c08f414052999347da  # v0.47.0
+        GIT_TAG d66d9a95997d51a8ba9822a611d1267757741535  # v0.51.0
         GIT_SHALLOW TRUE
     )
     set(HTTPLIB_REQUIRE_OPENSSL OFF CACHE INTERNAL "")
```

---

### Incident Patch 14: `1c2f67f1` (2026-09-17)
**Commit Message**: fix(server): drop the lookup-miss registry reload (#3613)

* fix(server): drop the lookup-miss registry reload

#2064 fixed two real defects in the registry write path: an unsynchronized
read-modify-write in register_user_model/delete_model that could silently drop
a registration, and an in-place save that could leave user_models.json
truncated. It also added a fifth change, reloading the registry whenever a
lookup missed the cache, and that one has no reason to exist.

Once every write re-reads under models_cache_mutex_ and invalidates the cache,
the in-memory registry cannot be stale relative to anything this process did.
The reload only covered an edit made outside the process, which is undocumented,
untested, and has no caller: nothing outside model_manager.cpp reads or writes
user_models.json, and lemond runs one ModelManager.

What it did do was decide the cache was stale whenever the looked-up name
appeared in the file. A registered model whose backend this host cannot run is
filtered out of every build, so that test said "stale" forever: the rebuild
could never resolve the lookup, and the next miss paid for it again.
/v1/models calls model_exists() on every component of eve

**File**: `docs/guide/configuration/custom-models.md` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ curl -X POST http://localhost:13305/v1/pull \
 
 ### Edit JSON files directly
 
-Advanced users can edit `user_models.json` and `recipe_options.json` directly. The rest of this guide documents those files and gives complete examples.
+Advanced users can edit `user_models.json` and `recipe_options.json` directly, however you must restart lemond for the changes to take effect. The rest of this guide documents those files and gives complete examples.
 
 ## Overview
 
```

**File**: `src/cpp/include/lemon/model_manager.h` (modified, +0/-5)
```diff
@@ -633,11 +633,6 @@ struct UpdateCheckResult {
     mutable std::set<std::string> recipes_all_models_filtered_;
     mutable bool cache_valid_ = false;
 
-    // Refresh user_models.json on-demand when a user.* lookup misses the cache.
-    // This keeps startup cache warmup / external registry writes from causing
-    // stale hard "Model not found" failures for registered user models.
-    bool refresh_user_models_from_disk_for_lookup(const std::string& model_name);
-
     json get_sync_status_locked() const;
     void rebuild_public_model_aliases_locked();
 };
```

**File**: `src/cpp/server/model_manager.cpp` (modified, +0/-79)
```diff
@@ -1112,48 +1112,6 @@ void ModelManager::notify_models_changed() {
     }
 }
 
-bool ModelManager::refresh_user_models_from_disk_for_lookup(const std::string& model_name) {
-    std::vector<std::string> candidate_keys;
-
-    if (auto canon = parse_canonical_id(model_name)) {
-        if (canon->source == ModelSource::Registered) {
-            candidate_keys.push_back(canon->bare_name);
-        }
-    } else if (!model_name.empty()) {
-        candidate_keys.push_back(model_name);
-    }
-
-    if (candidate_keys.empty()) {
-        return false;
-    }
-
-    json latest_user_models = load_optional_json(get_user_models_file());
-    if (!latest_user_models.is_object()) {
-        return false;
-    }
-
-    bool found = false;
-    for (const auto& key : candidate_keys) {
-        if (latest_user_models.contains(key)) {
-            found = true;
-            break;
-        }
-    }
-
-    if (!found) {
-        return false;
-    }
-
-    {
-        std::lock_guard<std::mutex> lock(models_cache_mutex_);
-        user_models_ = std::move(latest_user_models);
-        cache_valid_ = false;
-    }
-
-    build_cache();
-    return true;
-}
-
 void ModelManager::set_extra_models_dir(const std::string& dir) {
     extra_models_dir_ = dir;
 
@@ -6311,16 +6269,6 @@ ModelInfo ModelManager::get_model_info(const std::string& model_name) {
         }
     }
 
-    if (refresh_user_models_from_disk_for_lookup(model_name)) {
-        std::lock_guard<std::mutex> lock(models_cache_mutex_);
-        auto alias_it = public_model_aliases_.find(model_name);
-        std::string canonical_name = alias_it != public_model_aliases_.end() ? alias_it->second : model_name;
-        auto it = models_cache_.find(canonical_name);
-        if (it != models_cache_.end()) {
-            return it->second;
-        }
-    }
-
     throw std::runtime_error("Model not found: " + model_name);
 }
 
@@ -6354,13 +6302,6 @@ bool ModelManager::model_exists(const std::string& model_name) {
         }
     }
 
-    if (refresh_user_models_from_disk_for_lookup(model_name)) {
-        std::lock_guard<std::mutex> lock(models_cache_mutex_);
-        auto alias_it = public_model_aliases_.find(model_name);
-        std::string canonical_name = alias_it != public_model_aliases_.end() ? alias_it->second : model_name;
-        return models_cache_.find(canonical_name) != models_cache_.end();
-    }
-
     return false;
 }
 
@@ -6552,16 +6493,6 @@ bool ModelManager::model_exists_unfiltered(const std::string& model_name) {
         return true;
     }
 
-    // If a stale warm cache caused the alias/registry lookup to miss, reload the
-    // persisted user registry before reporting a hard "not found".
-    if (refresh_user_models_from_disk_for_lookup(model_name)) {
-        if (exists_in_registries(model_name)) {
-            return true;
-        }
-        canonical_name = resolve_model_name(model_name);
-        return exists_in_registries(canonical_name) || server_models_.contains(canonical_name);
-    }
-
     return false;
 }
 
@@ -6599,16 +6530,6 @@ ModelInfo ModelManager::get_model_info_unfiltered(const std::string& model_name)
         }
     }
 
-    if (!resolved && refresh_user_models_from_disk_for_lookup(model_name)) {
-        resolved = try_resolve(model_name);
-        if (!resolved) {
-            std::string canonical_name = resolve_model_name(model_name);
-            if (canonical_name != model_name) {
-                resolved = try_resolve(canonical_name);
-            }
-        }
-    }
-
     json* model_json = nullptr;
     if (is_user_lookup && user_models_.contains(registry_name)) {
         model_json = &user_models_[registry_name];
```

---

### Incident Patch 15: `c453af9b` (2026-09-17)
**Commit Message**: Don't run inference backend jobs on release branch builds (#3604)

Closes #3603


Claude-Session: https://claude.ai/code/session_01DLNHAHz3stofEP2pApTs2G

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.github/workflows/cpp_server_build_test_release.yml` (modified, +3/-0)
```diff
@@ -1044,6 +1044,7 @@ jobs:
     # these instead of PR pushes. Label a PR `ci:backends` to opt it back in.
     if: >-
       !startsWith(github.ref, 'refs/tags/') &&
+      !startsWith(github.ref, 'refs/heads/release-v') &&
       inputs.enable_signing != true &&
       inputs.disable_macos_signing != true &&
       (github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'ci:backends'))
@@ -1317,6 +1318,7 @@ jobs:
     # these instead of PR pushes. Label a PR `ci:backends` to opt it back in.
     if: >-
       !startsWith(github.ref, 'refs/tags/') &&
+      !startsWith(github.ref, 'refs/heads/release-v') &&
       inputs.enable_signing != true &&
       inputs.disable_macos_signing != true &&
       (github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'ci:backends'))
@@ -1468,6 +1470,7 @@ jobs:
     needs: build-lemonade-deb
     if: >-
       !startsWith(github.ref, 'refs/tags/') &&
+      !startsWith(github.ref, 'refs/heads/release-v') &&
       inputs.enable_signing != true &&
       inputs.disable_macos_signing != true &&
       (github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'ci:backends'))
```

#### Recent Merged Pull Requests:
- **PR #3760** (2026-10-05): Change evaluation date for AI content policy (@jeremyfowers)
- **PR #3750** (2026-10-05): bump TheNoise version (@bitgamma)
- **PR #3746** (closed): Bump FLM backend version to v1.0.7 (@zaneni6)
- **PR #3744** (2026-10-02): chore(backends): bump FastFlowLM to v1.0.7 (@julianxhokaxhiu)
- **PR #3741** (closed): fix(server): merge args options must take into account per-model saved option (@storm1er)
- **PR #3730** (2026-10-02): fix(http): make download stall timeouts follow global_timeout (@jeremyfowers)
- **PR #3726** (2026-10-02): fix(server): watch extra_models_dir's nested folders on Linux and macOS (@jeremyfowers)
- **PR #3723** (2026-10-02): feat(hrx): bump hrx to b99 + add 26 models (@AaronStGeorge)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
