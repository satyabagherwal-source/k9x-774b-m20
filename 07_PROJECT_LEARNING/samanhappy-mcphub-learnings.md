# Forensic Learning Record (Deep Inspection): samanhappy/mcphub

> **Canonical Artifact**: `07_PROJECT_LEARNING/samanhappy-mcphub-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/samanhappy/mcphub](https://github.com/samanhappy/mcphub))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:46:35.044Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `samanhappy/mcphub`
- **Description**: Self-hosted MCP gateway and control plane for connecting, controlling, and operating MCP servers.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2485 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/cli.js`
```
#!/usr/bin/env node

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Subcommands routed to the CLI dispatcher in dist/cli/main.js. Anything else
// (including no args) falls through to the legacy server bootstrap so
// `npx @samanhappy/mcphub` keeps working exactly as before.
const CLI_COMMANDS = new Set([
  'login',
  'logout',
  'config',
  'servers',
  'groups',
  'keys',
  'tools',
  'call',
  'export',
  'discover',
  'install',
  'help',
  '--help',
  '-h',
  '--version',
  '-v',
]);

const argv = process.argv.slice(2);
const isCliCommand = argv.length > 0 && CLI_COMMANDS.has(argv[0]);

function findPackageRoot() {
  const isDebug = process.env.DEBUG === 'true';

  const possibleRoots = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..', '..'),
  ];

  if (process.argv[1] && process.argv[1].includes('_npx')) {
    const npxDir = path.dirname(process.argv[1]);
    possibleRoots.unshift(path.resolve(npxDir, '..'));
  }

  if (isDebug) {
    console.log('DEBUG: Checking for package.json in:', possibleRoots);
  }

  for (const root of possibleRoots) {
    const packageJsonPath = path.join(root, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.name === 'mcphub' || pkg.name === '@samanhappy/mcphub') {
          if (isDebug) {
            console.log(`DEBUG: Found package.json at ${packageJsonPath}`);
          }
          return root;
        }
      } catch (e) {
        // Continue to the next potential root
      }
    }
  }

  if (!isCliCommand) {
    console.log('⚠️ Could not find package.json, using default path');
  }
  return path.resolve(__dirname, '..');
}

const projectRoot = findPackageRoot();

if (isCliCommand) {
  // CLI subcommand path — keep stdout clean for --json / pipes.
  const cliEntryPath = path.join(projectRoot, 'dist', 'cli', 'main.js');
  if (!fs.existsSync(cliEntryPath)) {
    console.error('❌ CLI build missing: ' + cliEntryPath);
    console.error('Run "pnpm backend:build" (or "pnpm build") and retry.');
    process.exit(1);
  }
  const cliEntryUrl = pathToFileURL(cliEntryPath).href;
  const mod = await import(cliEntryUrl);
  await mod.runCli(argv);
} else {
  // Legacy: server bootstrap. Existing console.log banner preserved here so it
  // never leaks into CLI subcommand output.
  console.log('📋 MCPHub CLI');
  console.log(`📁 CLI script location: ${__dirname}`);
  console.log(`📦 Using package root: ${projectRoot}`);

  const frontendDistPath = path.join(projectRoot, 'frontend', 'dist');
  if (
    fs.existsSync(frontendDistPath) &&
    fs.existsSync(path.join(frontendDistPath, 'index.html'))
  ) {
    console.log('✅ Frontend distribution found');
  } else {
    console.log('⚠️ Frontend distribution not found at', frontendDistPath);
  }

  console.log('🚀 Starting MCPHub server...');
  const entryPath = path.join(projectRoot, 'dist', 'index.js');
  const entryUrl = pathToFileURL(entryPath).href;
  import(entryUrl).catch((err) => {
    console.error('Failed to start MCPHub:', err);
    process.exit(1);
  });
}

```

### Core Architecture Module: `eslint.config.mjs`
```
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ['coverage/**', 'dist/**', 'frontend/dist/**', 'data/**'],
  },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
    },

    rules: {
      'no-console': 'off',

      '@typescript-eslint/no-unused-vars': [
        'off',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
    },
  },
];

```

### Core Architecture Module: `frontend/postcss.config.js`
```
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `frontend/src/App.tsx`
```
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ServerProvider } from './contexts/ServerContext';
import { SettingsProvider } from './contexts/SettingsContext';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import EmbeddingSyncAlertListener from './components/EmbeddingSyncAlertListener';
import { getBasePath } from './utils/runtime';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OAuthConsentPage = lazy(() => import('./pages/OAuthConsentPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const CredentialsPage = lazy(() => import('./pages/CredentialsPage'));
const ServersPage = lazy(() => import('./pages/ServersPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const PromptsPage = lazy(() => import('./pages/PromptsPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));

// Helper component to redirect legacy cloud server routes to the local market page
const CloudRedirect: React.FC = () => {
  const { serverName } = useParams<{ serverName: string }>();
  return <Navigate to={`/market/${serverName}`} replace />;
};

const RouteFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
    Loading...
  </div>
);

function App() {
  const basename = getBasePath();
  return (
    <ThemeProvider>
      <AuthProvider>
        <ServerProvider>
          <ToastProvider>
            <SettingsProvider>
              <Router basename={basename}>
                <EmbeddingSyncAlertListener />
                <Routes>
                  {/* 公共路由 */}
                  <Route
                    path="/login"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <LoginPage />
                      </Suspense>
                    }
                  />

                  {/* OAuth consent screen: server injects the consent context
                      into the SPA shell served at /oauth/authorize */}
                  <Route
                    path="/oauth/authorize"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <OAuthConsentPage />
                      </Suspense>
                    }
                  />

                  {/* 受保护的路由，使用 MainLayout 作为布局容器 */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<MainLayout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/credentials" element={<CredentialsPage />} />
                      <Route path="/servers" element={<ServersPage />} />
                      <Route path="/groups" element={<GroupsPage />} />
                      <Route path="/prompts" element={<PromptsPage />} />
                      <Route path="/resources" element={<ResourcesPage />} />
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/market" element={<MarketPage />} />
                      <Route path="/market/:serverName" element={<MarketPage />} />
                      {/* Legacy cloud routes redirect to the local market page */}
                      <Route path="/cloud" element={<Navigate to="/market" replace />} />
                      <Route path="/cloud/:serverName" element={<CloudRedirect />} />
                      <Route path="/logs" element={<LogsPage />} />
                      <Route path="/activity" element={<ActivityPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>

                  {/* 未匹配的路由重定向到首页 */}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Router>
            </SettingsProvider>
          </ToastProvider>
        </ServerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

```

### Core Architecture Module: `frontend/src/components/AddGroupForm.tsx`
```
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupData } from '@/hooks/useGroupData';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { GroupFormData, Server, IGroupServerConfig } from '@/types';
import { ServerToolConfig } from './ServerToolConfig';
import GroupVisibilityFields from './GroupVisibilityFields';

interface AddGroupFormProps {
  onAdd: () => void;
  onCancel: () => void;
}

const AddGroupForm = ({ onAdd, onCancel }: AddGroupFormProps) => {
  const { t } = useTranslation();
  const { createGroup } = useGroupData();
  const { allServers } = useServerData();
  const { serverCosts } = useCostData();
  const [availableServers, setAvailableServers] = useState<Server[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<GroupFormData>({
    visibility: 'private',
    sharedWithUsers: [],
    name: '',
    description: '',
    servers: [] as IGroupServerConfig[],
  });

  useEffect(() => {
    // Filter available servers (enabled only)
    setAvailableServers(allServers.filter((server) => server.enabled !== false));
  }, [allServers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.name.trim()) {
        setError(t('groups.nameRequired'));
        setIsSubmitting(false);
        return;
      }

      const result = await createGroup(formData.name, formData.description, formData.servers, {
        visibility: formData.visibility,
        sharedWithUsers: formData.sharedWithUsers,
      });
      if (!result || !result.success) {
        setError(result?.message || t('groups.createError'));
        setIsSubmitting(false);
        return;
      }

      onAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('groups.addNew')}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md border border-gray-200 dark:border-gray-700">
              {error}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  {t('groups.name')} *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('groups.namePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  {t('groups.configureCapabilities')}
                </label>
                <ServerToolConfig
                  servers={availableServers}
                  value={formData.servers as IGroupServerConfig[]}
                  onChange={(servers) => setFormData((prev) => ({ ...prev, servers }))}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                  serverCosts={serverCosts}
                />
              </div>

              <GroupVisibilityFields
                value={formData}
                onChange={(access) => setFormData((previous) => ({ ...previous, ...access }))}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 p-5 pt-3 border-t border-[var(--hub-line-2)] flex-shrink-0">
            <button type="button" onClick={onCancel} className="hub-btn" disabled={isSubmitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="hub-btn primary" disabled={isSubmitting}>
              {isSubmitting ? t('common.submitting') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGroupForm;

```

### Core Architecture Module: `frontend/src/components/AddServerForm.tsx`
```
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ServerForm from './ServerForm'
import { apiPost } from '../utils/fetchInterceptor'
import { detectVariables } from '../utils/variableDetection'
import { buildDuplicateSource, carryOverCapabilityOverrides } from '../utils/serverDuplicate'
import { useSettingsData } from '../hooks/useSettingsData'
import { Server } from '../types'

interface AddServerFormProps {
  onAdd: () => void
  /**
   * Source server for the card's Duplicate action (#1187). Setting it opens the
   * add modal pre-filled from that server and the copy is created through the
   * normal `POST /servers` path; clearing it closes the modal again.
   */
  duplicateSource?: Server | null
  onDuplicateCancel?: () => void
}

const AddServerForm = ({
  onAdd,
  duplicateSource = null,
  onDuplicateCancel,
}: AddServerFormProps) => {
  const { t } = useTranslation()
  const { nameSeparator } = useSettingsData()
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationVisible, setConfirmationVisible] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<any>(null)
  const [detectedVariables, setDetectedVariables] = useState<string[]>([])

  const duplicatePrefill = useMemo(
    () => (duplicateSource ? buildDuplicateSource(duplicateSource) : null),
    [duplicateSource],
  )
  const modalVisible = addModalVisible || duplicateSource !== null

  const resetModalState = () => {
    setError(null) // Clear any previous errors when toggling modal
    setConfirmationVisible(false) // Close confirmation dialog
    setPendingPayload(null) // Clear pending payload
  }

  const closeModal = () => {
    setAddModalVisible(false)
    resetModalState()
    if (duplicateSource) {
      onDuplicateCancel?.()
    }
  }

  const toggleModal = () => {
    if (modalVisible) {
      closeModal()
      return
    }

    setAddModalVisible(true)
    resetModalState()
  }

  const handleConfirmSubmit = async () => {
    if (pendingPayload) {
      await submitServer(pendingPayload)
      setConfirmationVisible(false)
      setPendingPayload(null)
    }
  }

  const submitServer = async (payload: any) => {
    try {
      setError(null)
      const result = await apiPost('/servers', payload)

      if (!result.success) {
        // Use specific error message from the response if available
        if (result && result.message) {
          setError(result.message)
        } else {
          setError(t('server.addError'))
        }
        return
      }

      closeModal()
      onAdd()
    } catch (err) {
      console.error('Error adding server:', err)

      // Use friendly error messages based on error type
      if (!navigator.onLine) {
        setError(t('errors.network'))
      } else if (err instanceof TypeError && (
        err.message.includes('NetworkError') ||
        err.message.includes('Failed to fetch')
      )) {
        setError(t('errors.serverConnection'))
      } else {
        setError(t('errors.serverAdd'))
      }
    }
  }

  const handleSubmit = async (payload: any) => {
    try {
      // The create payload is rebuilt from form fields, so a duplicate has to
      // get the source's capability overrides re-attached (#1187).
      const nextPayload = duplicateSource
        ? carryOverCapabilityOverrides(payload, duplicateSource, { nameSeparator })
        : payload

      // Check for variables in the payload
      const variables = detectVariables(nextPayload)

      if (variables.length > 0) {
        // Show confirmation dialog
        setDetectedVariables(variables)
        setPendingPayload(nextPayload)
        setConfirmationVisible(true)
      } else {
        // Submit directly if no variables found
        await submitServer(nextPayload)
      }
    } catch (err) {
      console.error('Error processing server submission:', err)
      setError(t('errors.serverAdd'))
    }
  }

  return (
    <div>
      <button
        onClick={toggleModal}
        className="hub-btn primary"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        {t('server.add')}
      </button>

      {modalVisible && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          {/* B1: keyed on the source name so switching the duplicate source
              forces ServerForm to remount. ServerForm seeds its internal state
              from `initialData` only on mount, so the key guarantees the form
              re-initializes from the current source in every case. This is
              defence in depth rather than a reachable defect path: the modal
              overlay blocks further clicks while it is open, and the
              ServersPage request-id guard already drops superseded duplicate
              responses before they can swap the source mid-session. */}
          <ServerForm
            key={duplicateSource?.name ?? 'add'}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            initialData={duplicatePrefill}
            mode="create"
            shareCandidatesFrom={duplicateSource?.name}
            modalTitle={
              duplicateSource
                ? t('server.duplicateTitle', { serverName: duplicateSource.name })
                : t('server.addServer')
            }
            formError={error}
          />
        </div>
      )}

      {confirmationVisible && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="hub-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('server.confirmVariables')}
            </h3>
            <p className="text-gray-600 mb-4">
              {t('server.variablesDetected')}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">
                    {t('server.detectedVariables')}:
                  </h4>
                  <ul className="mt-1 text-sm text-yellow-700">
                    {detectedVariables.map((variable, index) => (
                      <li key={index} className="font-mono">
                        ${`{${variable}}`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              {t('server.confirmVariablesMessage')}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setConfirmationVisible(false)
                  setPendingPayload(null)
                }}
                className="hub-btn"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="hub-btn primary"
              >
                {t('server.confirmAndAdd')}
              </button>
            </div>
          </div>
        </div
```

### Core Architecture Module: `frontend/src/components/AddUserForm.tsx`
```
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import { UserFormData } from '@/types';
import {
  validatePasswordStrength,
  mapBackendPasswordErrors,
} from '../utils/passwordValidation';

interface AddUserFormProps {
  onAdd: () => void;
  onCancel: () => void;
}

const AddUserForm = ({ onAdd, onCancel }: AddUserFormProps) => {
  const { t } = useTranslation();
  const { createUser } = useUserData();
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    isAdmin: false,
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordErrors([]);

    if (!formData.username.trim()) {
      setError(t('users.usernameRequired'));
      return;
    }

    if (!formData.password.trim()) {
      setError(t('users.passwordRequired'));
      return;
    }

    const validation = validatePasswordStrength(formData.password);
    if (!validation.isValid) {
      setError(t('auth.passwordStrengthError'));
      setPasswordErrors(validation.errors.map((key) => t(`auth.${key}`)));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createUser(formData);
      if (result?.success) {
        onAdd();
      } else if (result?.errors?.length) {
        setError(result.message || t('auth.passwordStrengthError'));
        setPasswordErrors(mapBackendPasswordErrors(result.errors).map((key) => t(key)));
      } else {
        setError(result?.message || t('users.createError'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 border border-gray-100 dark:border-gray-700">
        <form onSubmit={handleSubmit}>
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t('users.addNew')}</h2>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md">
              <p className="text-sm font-medium">{error}</p>
              {passwordErrors.length > 0 && (
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  {passwordErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.username')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder={t('users.usernamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent form-input transition-all duration-200"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                placeholder={t('users.emailPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent form-input transition-all duration-200"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.password')} <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder={t('users.passwordPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent form-input transition-all duration-200"
                required
                disabled={isSubmitting}
                minLength={8}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('auth.passwordStrengthHint')}
              </p>
            </div>

            <div className="flex items-center pt-2">
              <input
                type="checkbox"
                id="isAdmin"
                name="isAdmin"
                checked={formData.isAdmin}
                onChange={handleInputChange}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors duration-200"
                disabled={isSubmitting}
              />
              <label
                htmlFor="isAdmin"
                className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer select-none"
              >
                {t('users.adminRole')}
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="hub-btn"
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="hub-btn primary"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {isSubmitting ? t('common.creating') : t('users.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserForm;

```

### Core Architecture Module: `frontend/src/components/ChangePasswordForm.tsx`
```
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangePasswordCredentials } from '../types';
import { changePassword } from '../services/authService';
import { validatePasswordStrength } from '../utils/passwordValidation';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ChangePasswordCredentials>({
    currentPassword: '',
    newPassword: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      
      // Validate password strength on change for new password
      if (name === 'newPassword') {
        const validation = validatePasswordStrength(value);
        setPasswordErrors(validation.errors);
      }
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password strength
    const validation = validatePasswordStrength(formData.newPassword);
    if (!validation.isValid) {
      setError(t('auth.passwordStrengthError'));
      setPasswordErrors(validation.errors);
      return;
    }

    setPasswordErrors([]);

    // Validate passwords match
    if (formData.newPassword !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await changePassword(formData);

      if (response.success) {
        setSuccess(true);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(response.message || t('auth.changePasswordError'));
      }
    } catch (err) {
      setError(t('auth.changePasswordError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">{t('auth.changePassword')}</h2>

      {success ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {t('auth.changePasswordSuccess')}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
              {passwordErrors.length > 0 && (
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {passwordErrors.map((errorKey) => (
                    <li key={errorKey}>{t(`auth.${errorKey}`)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="currentPassword">
              {t('auth.currentPassword')}
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 form-input"
              value={formData.currentPassword}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPassword">
              {t('auth.newPassword')}
            </label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 form-input"
              value={formData.newPassword}
              onChange={handleChange}
              required
              minLength={8}
            />
            {/* Password strength hints */}
            {formData.newPassword && passwordErrors.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <p className="font-semibold mb-1">{t('auth.passwordStrengthHint')}</p>
                <ul className="list-disc list-inside space-y-1">
                  {passwordErrors.map((errorKey) => (
                    <li key={errorKey} className="text-red-600">
                      {t(`auth.${errorKey}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {formData.newPassword && passwordErrors.length === 0 && (
              <p className="mt-2 text-sm text-green-600">✓ {t('auth.passwordStrengthHint')}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 form-input"
              value={confirmPassword}
              onChange={handleChange}
              required
              minLength={8}
            />
          </div>

          <div className="flex justify-end space-x-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="hub-btn"
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="hub-btn primary"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.save')}
                </span>
              ) : (
                t('common.save')
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChangePasswordForm;
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1241** (2026-09-30): **Smart Routing: credential-template servers are only indexed by a manual reindex, lose their index on rename, and embed their disabled tools**
  *Symptoms*: **Bug Description / 问题描述**  Servers with a `credentialTemplate` (per-user credentials) are searchable through Smart Routing only right after someone calls `POST /api/smart-routing/reindex` (#1199). Otherwise:  - **Never indexed on their own.** A credential server never connects globally: initialization returns early with no tools. The per-user runtime that does get its real tool list (`createPrincipalRuntime`) assigns `info.tools` without going through the embedding sync. So a newly added server, an update that changes its tools, or a wiped index leaves `search_tools` returning nothing for it until an admin runs the reindex. - **A rename empties its index.** `updateServer` drops the old name's embeddings and relies on the reconnect to regenerate them (see the comment there). A credential server never gets that reconnect, so after a rename `search_tools` finds none of its tools until the next manual reindex. The rename also drops the credential bindings. - **The reindex embeds disabled tools.** It embeds the per-principal tool list unmasked. Read-only still holds, because hits are filtered through the tools config afterwards, but the disabled tools use up the search `limit` first. On a server with 170 tools, 97 of them disabled, the query "find photos of a person" returned 6 of 8 relevant hits. - **The reindex ignores tool description overrides**, for every server, not just credential ones. It calls `saveToolsAsVectorEmbeddings` directly and skips the override step that #1200 

- **Issue #1239** (2026-09-30): **Renaming a server re-enables its disabled tools and drops tool and prompt description overrides**
  *Symptoms*: **Bug Description / 问题描述**  Renaming a server silently undoes its per-tool and per-prompt settings made in the dashboard:  - a tool that was disabled is listed again and **can be called**, on every route (direct group, server route, `$smart` `call_tool`); - tool description overrides disappear, so clients see the upstream description again; - disabled prompts are listed again, and prompt description overrides disappear.  Nothing in the UI or the logs shows the change.  Cause: the dashboard stores toggles and overrides under the prefixed item name, e.g. `tools["notes-delete_note"] = { enabled: false }` (see the comment above `findToolOnServer` in `src/services/mcpService.ts`). The rename branch of `updateServer` (`src/controllers/serverController.ts`) moves the server record, its group memberships, bearer keys and embeddings, but copies the `tools` and `prompts` maps unchanged. After `notes` → `notebook` the tool is called `notebook-delete_note`, and `notes-delete_note` no longer matches anything.  **Steps to Reproduce / 复现步骤**  1. Add a stdio server `notes` that has a tool `delete_note` and a prompt, and put the server in a group `g`. 2. In the dashboard, disable `delete_note`, give another tool a custom description, and disable the prompt. 3. Rename the server to `notebook` in its edit form. 4. On `/mcp/g`:    - `tools/list` includes `notebook-delete_note`, and `tools/call` on it succeeds;    - the custom description is gone;    - `prompts/list` shows the disabled prompt aga

- **Issue #1205** (2026-09-24): **Connection terminated due to connection timeout**
  *Symptoms*: **Bug Description / 问题描述** What happened? / 发生了什么？ 你好我是用的MCP HUB 1.0.37在高并发情况下,数据库执行:SELECT state, count(*) FROM pg_stat_activity GROUP BY state;出现idle in transaction =1,后服务就hold住一直在重试连接,HCP HUB报错: [2026-09-22T14:32:35.195+08:00] [ERROR] [1] [main] Unhandled error: {   "stack": "Error: Connection terminated due to connection timeout\n    at Client._connectionCallback (/app/node_modules/.pnpm/pg-pool@3.14.0_pg@8.22.0/node_modules/pg-pool/index.js:276:17)\n    at Connection.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/client.js:212:18)\n    at Object.onceWrapper (node:events:633:28)\n    at Connection.emit (node:events:519:28)\n    at Socket.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/connection.js:63:12)\n    at Socket.emit (node:events:519:28)\n    at TCP.<anonymous> (node:net:347:12)\n    at TCP.callbackTrampoline (node:internal/async_hooks:130:17)",   "message": "Connection terminated due to connection timeout",   "cause": {     "stack": "Error: Connection terminated unexpectedly\n    at Connection.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/client.js:199:73)\n    at Object.onceWrapper (node:events:633:28)\n    at Connection.emit (node:events:519:28)\n    at Socket.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/connection.js:63:12)\n    at Socket.emit (node:events:519:28)\n    at TCP.<anonymous> (node:net:347:12)\n    at TCP.callbackTrampoline (node:internal/async_hooks:130:17)",     "me
  **Post-Mortem & Fix Analysis**:
  > docker run -d \   --name mcphub_pg_1 \   --restart unless-stopped \   -p 3003:3000 \   -e NODE_ENV=production \   -e PORT=3000 \   -e USE_DB=true \   -e 'DB_URL=postgresql://xxxxx' \   -e DB_POOL_SIZE=10 \   -e ADMIN_PASSWORD='admin' \   -e JWT_SECRET='442b0337-992c-4eeb-aca5-9f38ac7884c3' \   -v "$(pwd)/mcp_settings.json:/app/mcp_settings.json:ro" \   -v "$(pwd)/data:/app/data" \   --health-cmd 'wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1' \   --health-interval=30s \   --health-timeout=10s \   --health-retries=3 \   --health-start-period=60s \   samanhappy/mcphub:latest  附上我的docker启动指令
  > ## 诊断分析（基于源码逐行核对）  ### 错误日志的含义  日志里的两行错误在 pg/pg-pool 源码中语义确定：  - `Connection terminated due to connection timeout`：**新建**一条到 PostgreSQL 的 TCP 连接时，超过 `connectionTimeoutMillis`（本项目默认 60000ms，见 `src/db/connection.ts`）仍未建立成功，pg-pool 销毁了 socket。 - `Connection terminated unexpectedly`（cause）：连接建立过程中 socket 被关闭。  注意：如果是连接池耗尽，pg-pool 报的是另一条错误 `timeout exceeded when trying to connect`。你收到的是前者，说明**当时连接池并未满，是 PostgreSQL 服务端在 60 秒以上无法接受/完成新连接**（服务端过载、`max_connections` 打满、前置连接池器排队，或网络饱和），而不是池子参数问题。  ### `idle in transaction = 1` 与"服务 hold 住"的因果链  1. MCPHub 在 DB 模式下，**每个请求**都直接读数据库：`src/middlewares/index.ts` 每请求 `getSystemConfigDao().get()`，`src/middlewares/auth.ts` 每请求再读一次 system_config 并全表扫 `bearer_keys`（`findEnabled`）。高并发时 10 条 TypeORM 连接很容易饱和，任何 DB 抖动都会波及整个 HTTP 服务。 2. 任一请求读配置失败（`connection.*timeout` 命中重试规则）→ `SystemConfigRepository.withConnectionRecovery` → `reconnectDatabase()` → `attemptReconnection()` → 先 `dataSource.destroy()`。 3. TypeORM 的 `closePool` → `pool.end()` **没有任何超时**，而 pg-pool 的 

- **Issue #1144** (2026-09-09): **bug: session rebuild drops client capabilities, so MCP Apps clients get "Tool not available" after a restart**
  *Symptoms*: **Bug Description**  With enableSessionRebuild on, a session that is rebuilt after a restart has no client capabilities, because the rebuilt Server never received an initialize. For a client that advertises MCP Apps (Claude.ai does) on a single-server route, this changes the tool naming from raw ("get_orders") to prefixed ("myserver-get_orders"). The client keeps calling the raw names it cached before the restart and every call fails with:  ToolUnavailableError: Tool not available: get_orders at handleCallToolRequest (dist/services/mcpService.js:2720)  The connector stays broken until the user removes and re-adds it. Clients that do not advertise MCP Apps are not affected, since they always get prefixed names.  **Steps to Reproduce**  1. Run MCPHub in database mode with enableSessionRebuild set to true and one stdio server exposed on /mcp/myserver. Authenticate with a bearer key. 2. POST an initialize request to /mcp/myserver whose capabilities contain extensions["io.modelcontextprotocol/ui"] = {"mimeTypes": ["text/html;profile=mcp-app"]}. Call tools/list: names are raw ("get_orders"). Call tools/call with "get_orders": it works. 3. Restart MCPHub, or simply send the same tools/call with a random unknown mcp-session-id. The session is rebuilt and the response is "Error: Tool not available: get_orders". The same call with "myserver-get_orders" works, and tools/list on the rebuilt session returns prefixed names.  **Expected Behavior**  Tool names should not change for an existi

- **Issue #1110** (2026-08-31): **streamable-http 地址无法连接UnsafeUrlError**
  *Symptoms*: **Bug Description / 问题描述** What happened? / 发生了什么？ ` "serverName": "chrome-bridge",   "error": {     "name": "UnsafeUrlError",     "message": "Host localhost resolves to blocked address: 127.0.0.1",     "stack": "UnsafeUrlError: Host localhost resolves to blocked address: 127.0.0.1\n    at assertSafeUrl (file:///app/dist/utils/ssrf.js:118:19)\n    at async createTransportFromConfig (file:///app/dist/services/mcpService.js:892:9)\n    at async initializeClientsFromSettings (file:///app/dist/services/mcpService.js:1263:29)\n    at async toggleServerStatus (file:///app/dist/services/mcpService.js:1860:17)\n    at async toggleServer (file:///app/dist/controllers/serverController.js:787:24)"   } } ` **Steps to Reproduce / 复现步骤** 1. `"chrome-bridge": {       "enabled": true,       "owner": "guest",       "type": "streamable-http",       "options": {         "timeout": 10000,         "resetTimeoutOnProgress": true       },       "visibility": "private",       "url": "http://localhost:12306/mcp",       "enableKeepAlive": false     }`  **Expected Behavior / 预期行为** What should happen? / 应该发生什么？  **Environment / 运行环境** - Running on / 运行方式: docker - Version / 版本: v1.0.25  **Screenshots / 截图** If relevant, add screenshots / 如果有帮助的话，请添加截图  **Additional Info / 补充信息** Any other details? / 还有其他信息吗？ 
  **Post-Mortem & Fix Analysis**:
  > chrome-bridge需要通过本地streamable-http流链接, 因为客户端命令不在容器里面
  > 感谢反馈！这是 v1.0.25 的 SSRF 防护触发的：Docker 中 `localhost` 指向容器自身，且 `guest` 用户默认不能访问内网地址。可以尝试使用 `host.docker.internal:12306`，并由管理员创建或拥有该服务。我们也会补充 Docker 场景下的配置说明。
  > > 感谢反馈！这是 v1.0.25 的 SSRF 防护触发的：Docker 中 `localhost` 指向容器自身，且 `guest` 用户默认不能访问内网地址。可以尝试使用 `host.docker.internal:12306`，并由管理员创建或拥有该服务。我们也会补充 Docker 场景下的配置说明。  ``` 2026-08-31T03:51:34.278Z] [ERROR] [31] [main] [FATAL] Unhandled promise rejection {   "error": {     "stack": "UnsafeUrlError: Unable to resolve host: host.docker.internal\n    at assertSafeUrl (file:///app/dist/utils/ssrf.js:111:15)\n    at async createTransportFromConfig (file:///app/dist/services/mcpService.js:892:9)\n    at async initializeClientsFromSettings (file:///app/dist/services/mcpService.js:1263:29)\n    at async registerAllTools (file:///app/dist/services/mcpService.js:1423:5)\n    at async initUpstreamServers (file:///app/dist/services/mcpService.js:199:5)",     "message": "Unable to resolve host: host.docker.internal",     "name": "UnsafeUrlError"   } } ```

- **Issue #1105** (2026-08-30): **Docker image attempts a runtime Corepack download when run as non-root**
  *Symptoms*: **Bug Description / 问题描述**  The official `v1.0.32` image fails before MCPHub starts when it runs as a non-root user and cannot reach the public npm registry.  The image prepares pnpm during its root-owned build layer:  ```dockerfile RUN corepack enable && corepack prepare pnpm@10.12.4 --activate ```  It launches the application through:  ```dockerfile CMD ["pnpm", "start"] ```  At runtime as UID 1000, Corepack attempts to download pnpm again:  ```text ! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-10.12.4.tgz Error: Error when performing request ETIMEDOUT ...:443 ```  This happens before the application loads its settings or binds its HTTP port.  **Steps to Reproduce / 复现步骤**  1. Run `docker.io/samanhappy/mcphub:1.0.32` as UID/GID 1000. 2. Provide a writable home/config location, for example `HOME=/tmp` and `NPM_CONFIG_USERCONFIG=/tmp/.npmrc`. 3. Deny runtime egress to `registry.npmjs.org` (for example, with an egress-restricted Kubernetes NetworkPolicy). 4. Start the container using its default entrypoint and command. 5. Observe Corepack attempt to fetch `pnpm-10.12.4.tgz`, followed by a network error and exit code 1.  **Expected Behavior / 预期行为**  The prebuilt image should start without package-registry access after the image has been pulled. Running the application should not require a package-manager download.  **Environment / 运行环境**  - Running on / 运行方式: Kubernetes container - Version / 版本: `v1.0.32` - Image index: `sha256:df34df85e639743d0bf4b641
  **Post-Mortem & Fix Analysis**:
  > Root cause confirmed and a fix is up in #1109 (one-line Dockerfile change: `CMD [pnpm, start]` -> `CMD [node, dist/index.js]`).  **Why it happens:** `corepack prepare` in the build layer runs as root, so the prepared pnpm lands in root's HOME cache; only the shim in `/usr/bin` is global. At runtime as UID 1000 the shim looks in the runtime user's HOME cache, misses, and downloads `pnpm-10.12.4.tgz` before the app starts.  **Local Docker verification of #1109:**  - Reproduced on the exact `v1.0.32` image (`df34df85e639`): `--user 1000:1000 -e HOME=/tmp --network none` -> Corepack download attempt, exit 1, HTTP never binds. - Same image as default root + `--network none`: starts fine (confirms the failure is specific to the non-root Corepack path). - Fixed image, same non-root/no-egress scenario: no Corepack lookup, settings loaded from a writable mount (`MCPHUB_SETTING_PATH`), default admin created, port 3000 bound, `GET /health` -> `{status:healthy,...}`. - Fixed image as default root 
  > @kelchm Thanks again for the detailed Kubernetes report. v1.0.33 now includes the non-root / no-egress startup fix.  Your environment looks close to a hardened production deployment (non-root, read-only rootfs, restricted egress), so I’m curious: are you still running MCPHub there, and are there any remaining production blockers around reliability, HA, security, or upgrades?  If there are, even the top 1–2 pain points would be very useful — I’m focusing the next production-readiness work on real deployment constraints.

- **Issue #1094** (2026-08-28): **[Security] Privilege escalation via template import allows low-privileged users to create stdio servers and achieve RCE**
  *Symptoms*: ### Description  The template import endpoint (`POST /api/templates/import`) lacks proper authorization checks. While other server creation/modification endpoints (`createServer`, `batchCreateServers`, `updateServer`) enforce the `isPrivilegedServerConfig` check – which blocks non-admin users from creating `stdio`-type servers with `command`/`args` – the `importTemplate` service function does **not** perform this validation.  An authenticated non-admin user can import a malicious template containing a `stdio`-type server configuration with arbitrary `command` and `args`. The imported server is persisted with the current user as its `owner`, and the user can then call the toggle endpoint (`POST /api/servers/:name/toggle`) to enable it.  When the server is enabled, MCPHub calls `StdioClientTransport` from the MCP SDK, which spawns the attacker-controlled command via `child_process.spawn()` as the MCPHub process. This results in **arbitrary command execution** with the privileges of the MCPHub host process.  ### Affected Versions  - Current `dev` version (as of the latest commit in the repository) - Likely all versions that include the template import feature without the privileged config check  ### Steps to Reproduce  **Prerequisites:** An authenticated non-admin user account. In deployments with Better Auth social login (GitHub/Google/OIDC) enabled, attackers can self-register with default `isAdmin: false`, creating a complete unauthenticated-to-RCE chain.  1. Log in as a non-

- **Issue #1051** (2026-08-17): **BETTER_AUTH_URL环境变量配置，建议增加到前端页面可添加**
  *Symptoms*: `BETTER_AUTH_URL`环境变量配置，建议增加到前端页面可添加，即设置-Better Auth配置项下可以配置

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

### Incident Patch 1: `c9df5956` (2026-09-30)
**Commit Message**: fix(oauth): restore discovery state for authorization callbacks (#1249)

**File**: `src/controllers/oauthCallbackController.ts` (modified, +1/-1)
```diff
@@ -371,7 +371,7 @@ export const handleOAuthCallback = async (req: Request, res: Response) => {
       try {
         logger.log('Calling transport.finishAuth for server', { serverName: serverInfo.name });
         const currentTransport = serverInfo.transport as any;
-        await currentTransport.finishAuth(codeParam);
+        await currentTransport.finishAuth(codeParam, issParam);
 
         // The state has served its purpose: the code was exchanged and the
         // server now holds the resulting tokens. Mark it consumed so a replayed
```

**File**: `src/services/mcpOAuthProvider.ts` (modified, +35/-2)
```diff
@@ -63,6 +63,7 @@ type OAuthClientInformationWithAuthMethod = OAuthClientInformation &
 export class MCPHubOAuthProvider implements OAuthClientProvider {
   private serverName: string;
   private serverConfig: ServerConfig;
+  private _discoveryState?: OAuthDiscoveryState;
   private _issuer?: string;
   private _issRequired?: boolean;
   private _codeVerifier?: string;
@@ -327,6 +328,9 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
 
     this._codeVerifier = undefined;
     this._currentState = undefined;
+    this._discoveryState = undefined;
+    this._issuer = undefined;
+    this._issRequired = undefined;
 
     const serverInfo = getServerByName(this.serverName);
     if (serverInfo) {
@@ -339,6 +343,7 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
   // Capture the SDK's actual discovery result before redirecting. Keep this
   // snapshot with the pending flow so callback validation survives restarts.
   saveDiscoveryState(state: OAuthDiscoveryState): void {
+    this._discoveryState = state;
     const metadata = state.authorizationServerMetadata;
     this._issuer = metadata?.issuer;
     this._issRequired = Boolean(
@@ -348,6 +353,18 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
     );
   }
 
+  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
+    if (this._discoveryState) return this._discoveryState;
+
+    const storedConfig = await loadServerConfig(this.serverName);
+    const state = storedConfig?.oauth?.pendingAuthorization?.discoveryState;
+    if (state && storedConfig) {
+      this.serverConfig = storedConfig;
+      this.saveDiscoveryState(state);
+    }
+    return state;
+  }
+
   /**
    * Redirect to authorization URL
    * In a server environment, we can't directly redirect the user
@@ -372,6 +389,7 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
     try {
       const pendingUpdate: Partial<NonNullable<ServerConfig['oauth']>['pendingAuthorization']> = {
         authorizationUrl,
+        discoveryState: this._discoveryState,
         issuer: this._issuer ?? this.serverConfig.oauth?.dynamicRegistration?.issuer,
         issRequired: this._issRequired,
         state,
@@ -390,6 +408,7 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
         serverName: this.serverName,
         error,
       });
+      throw error;
     }
 
     // Store the authorization URL in ServerInfo for the frontend to access
@@ -474,7 +493,14 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
    * Invalidate cached OAuth credentials when the SDK detects they are no longer valid.
    * This keeps stored configuration in sync and forces a fresh authorization flow.
    */
-  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
+  async invalidateCredentials(
+    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
+  ): Promise<void> {
+    if (scope === 'discovery' || scope === 'verifier' || scope === 'all') {
+      this._discoveryState = undefined;
+      this._issuer = undefined;
+      this._issRequired = undefined;
+    }
     const storedConfig = await loadServerConfig(this.serverName);
 
     if (!storedConfig?.oauth) {
@@ -521,6 +547,10 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
       }
     }
 
+    if (scope === 'discovery' && currentConfig.oauth.pendingAuthorization) {
+      assignUpdatedConfig(await clearOAuthData(this.serverName, 'discovery'));
+    }
+
     if (scope === 'verifier' || scope === 'all') {
       this._codeVerifier = undefined;
       this._currentState = undefined;
@@ -557,7 +587,10 @@ const prepopulateScopesIfMissing = async (
   }
 
   try {
-    const scopes = await fetchScopesFromServer(serverConfig.url, await createOAuthFetch(serverConfig));
+    const scopes = await fetchScopesFromServer(
+      serverConfig.url,
+      await createOAuthFetch(serverConfig),
+    );
    
```

**File**: `src/services/oauthSettingsStore.ts` (modified, +7/-1)
```diff
@@ -154,7 +154,7 @@ export const updatePendingAuthorization = async (
  */
 export const clearOAuthData = async (
   serverName: string,
-  scope: 'all' | 'client' | 'tokens' | 'verifier',
+  scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
 ): Promise<ServerConfigWithOAuth | undefined> => {
   return mutateOAuthSettings(serverName, ({ oauth }) => {
     if (scope === 'tokens' || scope === 'all') {
@@ -167,6 +167,12 @@ export const clearOAuthData = async (
       delete oauth.clientSecret;
     }
 
+    if (scope === 'discovery' && oauth.pendingAuthorization) {
+      delete oauth.pendingAuthorization.discoveryState;
+      delete oauth.pendingAuthorization.issuer;
+      delete oauth.pendingAuthorization.issRequired;
+    }
+
     if (scope === 'verifier' || scope === 'all') {
       if (oauth.pendingAuthorization) {
         delete oauth.pendingAuthorization;
```

**File**: `src/types/index.ts` (modified, +2/-0)
```diff
@@ -4,6 +4,7 @@ import {
   SSEClientTransport,
   StreamableHTTPClientTransport,
   RequestOptions,
+  type OAuthDiscoveryState,
 } from '@modelcontextprotocol/client';
 import { SmartRoutingConfig } from '../utils/smartRouting.js';
 
@@ -505,6 +506,7 @@ export interface ServerConfig {
       issRequired?: boolean;
       state?: string;
       codeVerifier?: string;
+      discoveryState?: OAuthDiscoveryState;
       createdAt?: number;
     };
   };
```

**File**: `tests/controllers/oauthCallbackController.test.ts` (modified, +3/-3)
```diff
@@ -126,7 +126,7 @@ describe('oauthCallbackController iss validation', () => {
     );
 
     expect(res.statusCode).toBe(200);
-    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code');
+    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code', 'https://as.example.com');
   });
 
   it('rejects a mismatched iss without redeeming the code', async () => {
@@ -170,7 +170,7 @@ describe('oauthCallbackController iss validation', () => {
     );
 
     expect(res.statusCode).toBe(200);
-    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code');
+    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code', undefined);
   });
 
   it('reconnects a previously initialized client with the refreshed transport', async () => {
@@ -362,7 +362,7 @@ describe('oauthCallbackController iss validation', () => {
     );
 
     expect(res.statusCode).toBe(200);
-    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code');
+    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code', 'https://as.example.com');
   });
 
   it('rejects a replayed state after the authorization completed', async () => {
```

---

### Incident Patch 2: `bb6b794e` (2026-09-30)
**Commit Message**: fix(servers): move prefixed tool and prompt toggles to the new name when a server is renamed (#1240)

**File**: `src/controllers/serverController.ts` (modified, +89/-0)
```diff
@@ -35,6 +35,7 @@ import {
   syncAllServerToolsEmbeddings,
 } from '../services/vectorSearchService.js';
 import { createSafeJSON } from '../utils/serialization.js';
+import { getNameSeparator } from '../config/index.js';
 import { cloneDefaultOAuthServerConfig } from '../constants/oauthServerDefaults.js';
 import {
   getBearerKeyDao,
@@ -943,6 +944,69 @@ export const deleteServer = async (req: Request, res: Response): Promise<void> =
   }
 };
 
+/**
+ * Move the keys of a server's `tools` or `prompts` map from the old name's
+ * prefix to the new one. The dashboard stores toggles and description
+ * overrides under the prefixed item name (`<server><separator><item>`), so
+ * after a rename the old keys match nothing: a tool disabled under them comes
+ * back enabled and callable, and its description override is lost. Keys
+ * without the old prefix are left as they are; if both prefixes are present,
+ * the old one wins, since it is the one that was in effect.
+ *
+ * With the default `-` separator a key such as `notes-delete_note` can also be
+ * the bare name of an upstream tool called `notes-delete_note`, which tool
+ * toggles accept as well. `keepOldKey` says which old-prefix keys to keep next
+ * to their moved copy, so that meaning survives the rename too.
+ */
+const movePrefixedItemKeys = <T>(
+  entries: Record<string, T> | undefined,
+  oldName: string,
+  newName: string,
+  keepOldKey: (key: string) => boolean = () => false,
+): Record<string, T> | undefined => {
+  if (!entries) {
+    return entries;
+  }
+
+  const separator = getNameSeparator();
+  const oldPrefix = `${oldName}${separator}`;
+  const newPrefix = `${newName}${separator}`;
+  const moved = Object.fromEntries(
+    Object.entries(entries).filter(([key]) => !key.startsWith(oldPrefix)),
+  ) as Record<string, T>;
+  for (const [key, value] of Object.entries(entries)) {
+    if (key.startsWith(oldPrefix)) {
+      moved[`${newPrefix}${key.substring(oldPrefix.length)}`] = value;
+      if (keepOldKey(key)) {
+        moved[key] = value;
+      }
+    }
+  }
+  return moved;
+};
+
+/**
+ * Whether an old-prefix `tools` key may be a bare upstream tool name. Tool
+ * toggles accept the bare name as well as the prefixed one, so `notes-x` on
+ * server `notes` applies both to tool `x` and to a tool literally named
+ * `notes-x`. The cached tool list says which bare names exist; without one
+ * (server not connected yet) every such key is kept, which is harmless when
+ * no such tool exists.
+ */
+const bareToolNameCheck = (serverName: string): ((key: string) => boolean) => {
+  const prefix = `${serverName}${getNameSeparator()}`;
+  const cachedTools = getServerByName(serverName)?.tools ?? [];
+  if (cachedTools.length === 0) {
+    return () => true;
+  }
+  const bareNames = new Set(
+    cachedTools.map((tool) =>
+      tool.name.startsWith(prefix) ? tool.name.substring(prefix.length) : tool.name,
+    ),
+  );
+  return (key) => bareNames.has(key);
+};
+
 export const updateServer = async (req: Request, res: Response): Promise<void> => {
   try {
     const { name } = req.params;
@@ -1084,6 +1148,9 @@ export const updateServer = async (req: Request, res: Response): Promise<void> =
         return;
       }
 
+      // Read the cached tool list before the runtime under the old name is closed
+      const isBareToolName = bareToolNameCheck(name);
+
       // Rename the server
       const renamed = await serverDao.rename(name, targetName);
       if (!renamed) {
@@ -1110,6 +1177,28 @@ export const updateServer = async (req: Request, res: Response): Promise<void> =
       const bearerKeyDao = getBearerKeyDao();
       await bearerKeyDao.updateServerName(name, targetName);
 
+      // Move tool and prompt toggles to the new prefix. A request without the
+      // map would keep the stored one through the update merge, old keys and
+      // all, so the stored map is moved in that case. Prompt lookups use the
+      // prefixed name only, so prompt keys
```

**File**: `tests/controllers/serverController.test.ts` (modified, +126/-0)
```diff
@@ -103,6 +103,12 @@ jest.mock('../../src/services/vectorSearchService.js', () => ({
   ),
 }));
 
+// Tool and prompt toggles are keyed by `<server><separator><item>`; pin the separator
+jest.mock('../../src/config/index.js', () => ({
+  ...(jest.requireActual('../../src/config/index.js') as object),
+  getNameSeparator: jest.fn(() => '::'),
+}));
+
 jest.mock('../../src/services/userContextService.js', () => ({
   UserContextService: {
     getInstance: jest.fn(() => ({
@@ -1725,13 +1731,24 @@ describe('serverController - updateServer', () => {
       mockBearerKeyDao.updateServerName.mockResolvedValue(undefined);
       mockAddOrUpdateServer.mockResolvedValue({ success: true });
       mockRemoveServerToolEmbeddings.mockResolvedValue(undefined);
+      // The runtime's cached tool list, named `<server><separator><upstream name>`
+      mockGetServerByName.mockReturnValue({
+        name: 'test-server',
+        tools: ['delete_note', 'list_notes', 'search_notes'].map((tool) => ({
+          name: `test-server::${tool}`,
+        })),
+      });
 
       mockRequest.body = {
         ...mockRequest.body,
         newName: 'renamed-server',
       };
     });
 
+    afterEach(() => {
+      mockGetServerByName.mockReset();
+    });
+
     it('updates every reference to the old name, including vector embeddings', async () => {
       await updateServer(mockRequest as Request, mockResponse as Response);
 
@@ -1756,6 +1773,115 @@ describe('serverController - updateServer', () => {
       });
     });
 
+    it('moves prefixed tool and prompt toggles to the new name', async () => {
+      mockRequest.body.config = {
+        ...mockRequest.body.config,
+        tools: {
+          'test-server::delete_note': { enabled: false },
+          'test-server::list_notes': { enabled: true, description: 'Custom description' },
+          // Bare keys do not depend on the server name
+          search_notes: { enabled: false },
+        },
+        prompts: { 'test-server::summarize': { enabled: false } },
+      };
+
+      await updateServer(mockRequest as Request, mockResponse as Response);
+
+      const [, savedConfig] = mockAddOrUpdateServer.mock.calls[0] as [string, any, boolean];
+      expect(savedConfig.tools).toEqual({
+        'renamed-server::delete_note': { enabled: false },
+        'renamed-server::list_notes': { enabled: true, description: 'Custom description' },
+        search_notes: { enabled: false },
+      });
+      expect(savedConfig.prompts).toEqual({ 'renamed-server::summarize': { enabled: false } });
+    });
+
+    it('moves the stored toggles when the request does not send them', async () => {
+      // Without them the update merge would keep the stored map, old keys and all
+      mockServerDao.findById.mockResolvedValue({
+        name: 'test-server',
+        type: 'sse',
+        url: 'https://example.com/sse',
+        enabled: true,
+        owner: 'admin',
+        visibility: 'private',
+        tools: { 'test-server::delete_note': { enabled: false } },
+        prompts: { 'test-server::summarize': { enabled: false } },
+      });
+
+      await updateServer(mockRequest as Request, mockResponse as Response);
+
+      const [, savedConfig] = mockAddOrUpdateServer.mock.calls[0] as [string, any, boolean];
+      expect(savedConfig.tools).toEqual({ 'renamed-server::delete_note': { enabled: false } });
+      expect(savedConfig.prompts).toEqual({ 'renamed-server::summarize': { enabled: false } });
+    });
+
+    it('keeps the toggle that was in effect when both prefixes are present', async () => {
+      mockRequest.body.config = {
+        ...mockRequest.body.config,
+        tools: {
+          // Left over from an earlier server of that name; it never matched anything
+          'renamed-server::delete_note': { enabled: true },
+          'test-server::delete_note': { enabled: false },
+        },
+      };
+
+      await updateServer(mockRequest as Request, mockResponse as Response);
+
+      const [,
```

---

### Incident Patch 3: `93ba5116` (2026-09-30)
**Commit Message**: fix(smart-routing): index credential servers on every per-user connect, mask their disabled tools and keep reindex and connect on the same sync (#1237)

**File**: `src/controllers/serverController.ts` (modified, +4/-1)
```diff
@@ -1112,7 +1112,10 @@ export const updateServer = async (req: Request, res: Response): Promise<void> =
 
       // Drop embeddings stored under the old name so search_tools does not
       // advertise phantom tools; addOrUpdateServer below regenerates them
-      // under the new name. A failure here must not abort the rename.
+      // under the new name. A credential server never connects globally, so
+      // its rows come back on the first per-user connect after a user binds
+      // credentials again (the bindings were dropped above), or on a reindex.
+      // A failure here must not abort the rename.
       try {
         await removeServerToolEmbeddings(name);
       } catch (error) {
```

**File**: `src/controllers/smartRoutingController.ts` (modified, +19/-5)
```diff
@@ -11,8 +11,12 @@ import {
   initializeDatabase,
   isDatabaseConnected,
 } from '../db/connection.js';
-import { saveToolsAsVectorEmbeddings } from '../services/vectorSearchService.js';
-import { getServerToolsForPrincipal, getServersInfo } from '../services/mcpService.js';
+import {
+  getServerToolsForPrincipal,
+  getServersInfo,
+  syncCredentialServerToolEmbeddings,
+  syncToolsAsVectorEmbeddings,
+} from '../services/mcpService.js';
 
 /**
  * Resolve the effective embedding model that the vector store is (or will be)
@@ -444,12 +448,22 @@ export const reindexSmartRouting = async (
       }
 
       try {
-        await saveToolsAsVectorEmbeddings(server.name, tools, { reportProgress: true });
+        // The same sync a connect runs, so the rows written here (description
+        // overrides, and for credential servers the disabled-tool mask) are the
+        // ones the next connect expects and skips.
+        let toolCount = tools.length;
+        if (hasCredentialTemplate(server.config)) {
+          toolCount = await syncCredentialServerToolEmbeddings(server.name, tools, {
+            reportProgress: true,
+          });
+        } else {
+          await syncToolsAsVectorEmbeddings(server.name, tools, { reportProgress: true });
+        }
         syncedServers += 1;
-        totalTools += tools.length;
+        totalTools += toolCount;
         results.push({
           serverName: server.name,
-          toolCount: tools.length,
+          toolCount,
           ok: true,
           ...(principals ? { principals } : {}),
         });
```

**File**: `src/db/repositories/VectorEmbeddingRepository.ts` (modified, +28/-5)
```diff
@@ -300,21 +300,22 @@ export class VectorEmbeddingRepository extends BaseRepository<VectorEmbedding> {
   async getToolIdentityByServerNameAndModel(
     serverName: string,
     model: string,
-  ): Promise<Array<{ contentId: string; toolSetHash?: string }>> {
+  ): Promise<Array<{ contentId: string; toolSetHash?: string; textContent?: string }>> {
     // Use raw SQL to bypass TypeORM's entity mapping for pgvector columns.
     // TypeORM's QueryBuilder with getMany() and .andWhere('ve.embedding IS NOT NULL')
     // on a vector-type column may silently return 0 rows due to type-mapping issues.
     const prefix = `${escapeLikePattern(serverName)}:%`;
 
-    const rows: Array<{ content_id: string; metadata: unknown }> = await getAppDataSource().query(
-      `SELECT content_id, metadata
+    const rows: Array<{ content_id: string; metadata: unknown; text_content: string | null }> =
+      await getAppDataSource().query(
+        `SELECT content_id, metadata, text_content
        FROM vector_embeddings
        WHERE content_type = $1
          AND content_id LIKE $2 ESCAPE '\\'
          AND model = $3
          AND embedding IS NOT NULL`,
-      ['tool', prefix, model],
-    );
+        ['tool', prefix, model],
+      );
 
     return rows.map((row) => {
       const rawMeta = row.metadata;
@@ -333,6 +334,7 @@ export class VectorEmbeddingRepository extends BaseRepository<VectorEmbedding> {
       return {
         contentId: row.content_id,
         toolSetHash: meta?.toolSetHash?.toString(),
+        textContent: row.text_content ?? undefined,
       };
     });
   }
@@ -370,6 +372,27 @@ export class VectorEmbeddingRepository extends BaseRepository<VectorEmbedding> {
     }
   }
 
+  /**
+   * Delete specific tool embeddings, e.g. tools that were disabled.
+   * @param contentIds content_ids of the tools to delete (e.g. "server:tool-name")
+   * @returns Number of deleted rows
+   */
+  async deleteToolEmbeddingsByContentIds(contentIds: string[]): Promise<number> {
+    if (contentIds.length === 0) return 0;
+    try {
+      const result = await getAppDataSource().query(
+        `DELETE FROM vector_embeddings
+         WHERE content_type = $1
+           AND content_id IN (SELECT unnest($2::text[]))`,
+        ['tool', contentIds],
+      );
+      return result.rowCount ?? result[1] ?? 0;
+    } catch (error) {
+      logger.error('Error deleting tool embeddings', contentIds, error);
+      return 0;
+    }
+  }
+
   /**
    * Delete tool and server embeddings for a specific server
    * @param serverName Server name
```

**File**: `src/services/mcpService.ts` (modified, +82/-12)
```diff
@@ -49,7 +49,11 @@ import config from '../config/index.js';
 import { validateServerName } from '../utils/serverNameValidation.js';
 import { getGroup } from './sseService.js';
 import { getServerConfigInGroup, normalizeGroupServers } from './groupService.js';
-import { removeServerToolEmbeddings, saveToolsAsVectorEmbeddings } from './vectorSearchService.js';
+import {
+  removeServerToolEmbeddings,
+  removeToolEmbeddings,
+  saveToolsAsVectorEmbeddings,
+} from './vectorSearchService.js';
 import { OpenAPIClient } from '../clients/openapi.js';
 import { RequestContextService } from './requestContextService.js';
 import { getDataService } from './services.js';
@@ -714,20 +718,78 @@ const applyDescriptionOverridesForEmbedding = async (
   });
 };
 
-const syncToolsAsVectorEmbeddings = async (
+// Tail of the embedding tasks queued per server. A per-user connect and a
+// reindex, or two users connecting at once, often race on the same tool set;
+// queued behind the first run, the second one hits the skip check in
+// saveToolsAsVectorEmbeddings instead of embedding every tool a second time.
+const embeddingSyncTails = new Map<string, Promise<void>>();
+
+// Run `task` after every embedding task already queued for the server. A task
+// must not wait for another queued task of the same server, or both stall.
+const enqueueEmbeddingTask = (serverName: string, task: () => Promise<void>): Promise<void> => {
+  const run = (embeddingSyncTails.get(serverName) ?? Promise.resolve()).then(task);
+  const tail = run.catch(() => undefined);
+  embeddingSyncTails.set(serverName, tail);
+  void tail.then(() => {
+    if (embeddingSyncTails.get(serverName) === tail) embeddingSyncTails.delete(serverName);
+  });
+  return run;
+};
+
+export const syncToolsAsVectorEmbeddings = (
   serverName: string,
   tools: Tool[],
   options?: { reportProgress?: boolean; partial?: boolean },
-): Promise<void> => {
-  const toolsWithOverrides = await applyDescriptionOverridesForEmbedding(serverName, tools);
-  const modelVisibleTools = filterModelVisibleTools(toolsWithOverrides);
-  if (modelVisibleTools.length === 0) {
-    if (options?.partial) return;
-    await removeServerToolEmbeddings(serverName);
-    return;
-  }
+): Promise<void> =>
+  enqueueEmbeddingTask(serverName, async () => {
+    const toolsWithOverrides = await applyDescriptionOverridesForEmbedding(serverName, tools);
+    const modelVisibleTools = filterModelVisibleTools(toolsWithOverrides);
+    if (modelVisibleTools.length === 0) {
+      if (options?.partial) return;
+      await removeServerToolEmbeddings(serverName);
+      return;
+    }
+
+    await saveToolsAsVectorEmbeddings(serverName, modelVisibleTools, options);
+  });
 
-  await saveToolsAsVectorEmbeddings(serverName, modelVisibleTools, options);
+/**
+ * Embed the tools of a credential server, which never connects globally.
+ * Tools disabled in the server's tools config are never embedded: search
+ * filters them out of the hits anyway, but only after they have taken result
+ * slots. A toggle reaches the index without extra wiring: the tools config is
+ * part of the runtime revision, so the next acquire reconnects and re-syncs.
+ *
+ * Two callers, two scopes:
+ * - `partial: true` (every per-user connect): the list is what one user's
+ *   credentials show, and users may see different tools. The rows of the
+ *   listed, enabled tools are added or refreshed and nothing else is pruned,
+ *   so tools only other users see stay indexed. The listed tools that are
+ *   disabled are removed by name, queued before the sync.
+ * - otherwise (the reindex endpoint, which passes the union of every binding's
+ *   tools): the list is complete, so rows of tools outside it are pruned.
+ *
+ * Resolves to the number of tools handed to the vector store.
+ */
+export const syncCredentialServerToolEmbeddings = async (
+  serverName: string,
+  tools: Tool[],
+  options?: { reportProgress?: boolean; partial?: boolean },
+): Promise<num
```

**File**: `src/services/vectorSearchService.ts` (modified, +97/-18)
```diff
@@ -1155,6 +1155,25 @@ const parseEmbeddingMetadata = (metadata: unknown): Record<string, any> | null =
  * @param serverName Server name
  * @param tools Array of tools to save
  */
+/** The text a tool is embedded from, and stored as its row's text_content. */
+const buildToolSearchableText = (tool: Tool): string =>
+  [
+    tool.name,
+    tool.description,
+    // Include input schema properties if available
+    ...(tool.inputSchema && typeof tool.inputSchema === 'object'
+      ? Object.keys(tool.inputSchema).filter((key) => key !== 'type' && key !== 'properties')
+      : []),
+    // Include schema property names if available
+    ...(tool.inputSchema &&
+    tool.inputSchema.properties &&
+    typeof tool.inputSchema.properties === 'object'
+      ? Object.keys(tool.inputSchema.properties)
+      : []),
+  ]
+    .filter(Boolean)
+    .join(' ');
+
 export const saveToolsAsVectorEmbeddings = async (
   serverName: string,
   tools: Tool[],
@@ -1217,13 +1236,54 @@ export const saveToolsAsVectorEmbeddings = async (
       .sort((a, b) => a.localeCompare(b));
     const expectedToolSetHash = buildToolSetHash(tools, smartRoutingConfig.embeddingDocumentPrefix);
 
+    // ── Partial updates: only embed tools whose row is missing or out of date ──
+    // A partial list is one view of the server's index (a single tool update, or
+    // the tools one user's credentials list), so the whole-set check below can
+    // never match it. Compare per tool instead: same content id, model and text.
+    if (options.partial && isDatabaseConnected()) {
+      try {
+        const partialRepo = getRepositoryFactory('vectorEmbeddings')() as VectorEmbeddingRepository;
+        const existingText = new Map(
+          (
+            await partialRepo.getToolIdentityByServerNameAndModel(
+              serverName,
+              persistedEmbeddingModel,
+            )
+          ).map((item) => [item.contentId, item.textContent]),
+        );
+        const staleTools = tools.filter(
+          (tool) =>
+            existingText.get(`${serverName}:${tool.name}`) !== buildToolSearchableText(tool),
+        );
+        const serverEmbStatus = await partialRepo.findEmbeddingStatus('server', serverName);
+        const hasCurrentServerEmbedding =
+          serverEmbStatus?.model === persistedEmbeddingModel &&
+          serverEmbStatus.text_content === serverSearchableText &&
+          serverEmbStatus.hasEmbedding === true;
+        if (staleTools.length === 0 && hasCurrentServerEmbedding) {
+          logger.log(
+            `[Embedding] [${serverName}] Skipping — all ${tools.length} tool(s) of the partial update already indexed (model=${persistedEmbeddingModel})`,
+          );
+          return;
+        }
+        logger.log(
+          `[Embedding] [${serverName}] Partial update: embedding ${staleTools.length} of ${tools.length} tool(s) (model=${persistedEmbeddingModel})`,
+        );
+        tools = staleTools;
+      } catch (partialCheckError: any) {
+        logger.warn(
+          `[Embedding] [${serverName}] Partial freshness check failed, embedding every listed tool: ${partialCheckError?.message ?? partialCheckError}`,
+        );
+      }
+    }
+
     // ── Skip check: avoid regenerating embeddings that are already up-to-date ──
     // Validate exact content IDs and a tool-set hash/version marker to avoid
     // false positives when only counts match but the actual tool set changed.
     // This is an optimization to skip the expensive embedding generation phase when
     // nothing changed, which can save a lot of time for servers with many tools and
     // slow embedding providers. It also prevents rewrites on every server restart.
-    if (isDatabaseConnected()) {
+    if (!options.partial && isDatabaseConnected()) {
       try {
         const skipCheckRepo = getRepositoryFactory(
           'vectorEmbeddings',
@@ -1296,23 +1356,7 @@ export const saveToolsAsVectorEmbeddings = async (
     for (let _toolIdx = 0; _toolI
```

---

### Incident Patch 4: `ef13317e` (2026-09-30)
**Commit Message**: fix(config): expand environment variables in a single pass (#1243)

**File**: `src/config/index.ts` (modified, +22/-9)
```diff
@@ -205,12 +205,20 @@ export function replaceEnvVars(
   return input;
 }
 
+const isVarNameStart = (char: string | undefined): boolean =>
+  char !== undefined && ((char >= 'A' && char <= 'Z') || char === '_');
+
+const isVarNameChar = (char: string | undefined): boolean =>
+  isVarNameStart(char) || (char !== undefined && char >= '0' && char <= '9');
+
 /**
- * Expand `${VAR}` references via a linear scan. A manual scan is used instead
- * of a regular expression so that adversarial input (many '${' sequences)
- * cannot trigger catastrophic backtracking.
+ * Expand `${VAR}` and `$VAR` references in a single linear scan. Substituted
+ * values are copied as-is and never scanned again, so a secret containing
+ * `$` (e.g. `Pa$SWORD`) is not expanded a second time. A manual scan is used
+ * instead of a regular expression so that adversarial input (many '${'
+ * sequences) cannot trigger catastrophic backtracking.
  */
-const expandDollarBraceVars = (
+const expandVarReferences = (
   value: string,
   envSource: Record<string, string | undefined>,
 ): string => {
@@ -225,6 +233,15 @@ const expandDollarBraceVars = (
         i = closeIndex + 1;
         continue;
       }
+    } else if (value[i] === '$' && isVarNameStart(value[i + 1])) {
+      // $VAR format (common on Unix-like systems)
+      let end = i + 2;
+      while (isVarNameChar(value[end])) {
+        end += 1;
+      }
+      result += envSource[value.slice(i + 1, end)] || '';
+      i = end;
+      continue;
     }
     result += value[i];
     i += 1;
@@ -244,11 +261,7 @@ export const expandEnvVars = (
   if (typeof value !== 'string') {
     return String(value);
   }
-  // Replace ${VAR} format
-  let result = expandDollarBraceVars(value, envSource);
-  // Also replace $VAR format (common on Unix-like systems)
-  result = result.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, key) => envSource[key] || '');
-  return result.trim();
+  return expandVarReferences(value, envSource).trim();
 };
 
 export default defaultConfig;
```

**File**: `tests/config/replaceEnvVars.test.ts` (modified, +23/-0)
```diff
@@ -61,6 +61,29 @@ describe('Environment Variable Expansion - Comprehensive Tests', () => {
       process.env.PADDED_VAR = '  padded-value  ';
       expect(expandEnvVars('${PADDED_VAR}')).toBe('padded-value');
     });
+
+    it('should keep a "$" inside an expanded ${VAR} value', () => {
+      process.env.API_KEY = 'sk-abc$XYZ123';
+      process.env.XYZ123 = 'leaked';
+      expect(expandEnvVars('${API_KEY}')).toBe('sk-abc$XYZ123');
+    });
+
+    it('should keep a "$" inside a password embedded in a URL', () => {
+      process.env.DB_PASS = 'Pa$SWORD!';
+      expect(expandEnvVars('postgres://user:${DB_PASS}@db:5432/app')).toBe(
+        'postgres://user:Pa$SWORD!@db:5432/app',
+      );
+    });
+
+    it('should keep a "$" inside an expanded $VAR value', () => {
+      process.env.TOKEN = 'a$B';
+      process.env.B = 'b';
+      expect(expandEnvVars('Bearer $TOKEN')).toBe('Bearer a$B');
+    });
+
+    it('should leave "$" alone when no variable name follows it', () => {
+      expect(expandEnvVars('cost: $5, ${ and $lower')).toBe('cost: $5, ${ and $lower');
+    });
   });
 
   describe('replaceEnvVars - Recursive expansion', () => {
```

---

### Incident Patch 5: `90e3ac87` (2026-09-29)
**Commit Message**: fix(oauth): distinguish explicitly-empty scopes from unset ones (#1228)

Co-authored-by: Claude Code <noreply@anthropic.com>

**File**: `src/services/mcpOAuthProvider.ts` (modified, +29/-11)
```diff
@@ -123,14 +123,22 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
           ? 'client_secret_post'
           : 'none';
 
+    // `oauth.scopes` is `string[] | undefined`: `undefined` means "not configured/detected",
+    // `[]` means the upstream server explicitly publishes no scopes and should get none. Using
+    // `||` here would treat `''` (from an empty array) the same as "unset" and always fall back
+    // to 'openid', which zero-scope authorization servers commonly reject (see #1227).
+    const configuredScopes = this.serverConfig.oauth?.scopes;
+    const scope =
+      metadata.scope || (configuredScopes !== undefined ? configuredScopes.join(' ') : 'openid');
+
     return {
       ...metadata, // Include any additional custom metadata
       client_name: metadata.client_name || `MCPHub - ${this.serverName}`,
       redirect_uris: redirectUris,
       grant_types: metadata.grant_types || ['authorization_code', 'refresh_token'],
       response_types: metadata.response_types || ['code'],
       token_endpoint_auth_method: tokenEndpointAuthMethod,
-      scope: metadata.scope || this.serverConfig.oauth?.scopes?.join(' ') || 'openid',
+      scope,
     };
   }
 
@@ -142,7 +150,10 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
       return existingScopes;
     }
 
-    if (existingScopes && existingScopes.length > 0) {
+    // `existingScopes !== undefined` (not `.length > 0`): an empty array is a previously
+    // resolved "this server uses no scopes" result and must short-circuit re-fetching just like
+    // a non-empty one would.
+    if (existingScopes !== undefined) {
       return existingScopes;
     }
 
@@ -151,7 +162,9 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
         serverUrl,
         await createOAuthFetch(this.serverConfig),
       );
-      if (scopes && scopes.length > 0) {
+      // `scopes !== undefined`: persist and honor an explicitly empty result too, not only a
+      // non-empty one (see #1227).
+      if (scopes !== undefined) {
         const updatedConfig = await mutateOAuthSettings(this.serverName, ({ oauth }) => {
           oauth.scopes = scopes;
         });
@@ -533,7 +546,9 @@ const prepopulateScopesIfMissing = async (
   serverName: string,
   serverConfig: ServerConfig,
 ): Promise<void> => {
-  if (!serverConfig.oauth || serverConfig.oauth.scopes?.length) {
+  // `[]` means resolved-to-no-scopes; a missing `oauth` block means never resolved, so
+  // discovery must still run before the first registration too (#1227).
+  if (serverConfig.oauth?.scopes !== undefined) {
     return;
   }
 
@@ -542,17 +557,20 @@ const prepopulateScopesIfMissing = async (
   }
 
   try {
-    const scopes = await fetchScopesFromServer(serverConfig.url);
-    if (scopes && scopes.length > 0) {
-      const updatedConfig = await mutateOAuthSettings(serverName, ({ oauth }) => {
-        oauth.scopes = scopes;
-      });
-
+    const scopes = await fetchScopesFromServer(serverConfig.url, await createOAuthFetch(serverConfig));
+    // `scopes !== undefined`: persist and honor an explicitly empty result too (see #1227).
+    if (scopes !== undefined) {
+      // Update the in-memory config first: if the DAO write below throws, this connection
+      // attempt still proceeds with the correct scopes instead of falling back to 'openid'.
       if (!serverConfig.oauth) {
         serverConfig.oauth = {};
       }
       serverConfig.oauth.scopes = scopes;
 
+      const updatedConfig = await mutateOAuthSettings(serverName, ({ oauth }) => {
+        oauth.scopes = scopes;
+      });
+
       if (updatedConfig) {
         logger.log('Stored auto-detected OAuth scopes during provider initialization', {
           serverName,
@@ -610,7 +628,7 @@ export const createOAuthProvider = async (
     return undefined;
   }
 
-  // Ensure scopes are pre-populated if dynamic registration already ran previously
+  // Discover and persist scopes before 
```

**File**: `src/services/oauthClientRegistration.ts` (modified, +54/-8)
```diff
@@ -307,13 +307,19 @@ const registerAndPersistClient = async (
       resolveInstallBaseUrl(systemConfig),
     );
 
-    // Determine scopes: priority is metadata.scope > autoDetectedScopes > configured scopes > 'openid'
+    // Determine scopes: priority is metadata.scope > autoDetectedScopes > configured scopes > 'openid'.
+    // autoDetectedScopes and serverConfig.oauth.scopes are `string[] | undefined`: `undefined`
+    // means "not detected / not configured", while `[]` is a valid, meaningful result (the
+    // upstream server published an empty `scopes_supported` list, i.e. it uses no scopes at
+    // all). Checking `.length > 0` instead of `!== undefined` collapses that distinction and
+    // silently falls back to 'openid', which many zero-scope authorization servers reject
+    // outright during dynamic client registration (see #1227).
     let scopeValue: string;
     if (metadata.scope) {
       scopeValue = metadata.scope;
-    } else if (autoDetectedScopes && autoDetectedScopes.length > 0) {
+    } else if (autoDetectedScopes !== undefined) {
       scopeValue = autoDetectedScopes.join(' ');
-    } else if (serverConfig.oauth?.scopes) {
+    } else if (serverConfig.oauth?.scopes !== undefined) {
       scopeValue = serverConfig.oauth.scopes.join(' ');
     } else {
       scopeValue = 'openid';
@@ -405,13 +411,15 @@ export const getAuthorizationUrl = async (
     // Generate code challenge for PKCE (required by MCP spec)
     const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
 
-    // Build authorization parameters
+    // Build authorization parameters. See the comment in registerAndPersistClient for why
+    // `!== undefined` (not `.length > 0` / truthiness) is required here.
+    const configuredScopes = serverConfig.oauth?.scopes;
     const params: Record<string, string> = {
       redirect_uri: redirectUri,
       state,
       code_challenge: codeChallenge,
       code_challenge_method: 'S256',
-      scope: serverConfig.oauth?.scopes?.join(' ') || 'openid',
+      scope: configuredScopes !== undefined ? configuredScopes.join(' ') : 'openid',
     };
 
     // Add resource parameter for MCP (RFC8707)
@@ -546,6 +554,34 @@ export const getRegisteredClient = (serverName: string): RegisteredClientInfo |
  * @param autoDetectedScopes - Optional scopes from auto-detection
  * @returns RegisteredClientInfo or null
  */
+/**
+ * Discover and persist scopes for a server whose `oauth` block already exists but hasn't had
+ * scopes resolved yet -- used by callers that reach `initializeOAuthForServer` directly instead
+ * of through `createOAuthProvider` (which already runs its own pre-registration discovery for
+ * the "no oauth block at all" case). Without this, a server pre-registered at startup or via
+ * `getServerOAuthToken` with `dynamicRegistration.enabled: true` and no configured scopes would
+ * register with the default `scope: 'openid'`, reproducing #1227 in these two call sites too.
+ */
+const ensureScopesResolved = async (serverName: string, serverConfig: ServerConfig): Promise<void> => {
+  if (!serverConfig.oauth || serverConfig.oauth.scopes !== undefined || !serverConfig.url) {
+    return;
+  }
+  try {
+    const scopes = await fetchScopesFromServer(serverConfig.url, await createOAuthFetch(serverConfig));
+    if (scopes !== undefined) {
+      serverConfig.oauth.scopes = scopes;
+      const updatedConfig = await mutateOAuthSettings(serverName, ({ oauth }) => {
+        oauth.scopes = scopes;
+      });
+      if (updatedConfig) {
+        logger.log('Stored auto-detected OAuth scopes', { serverName, scopes });
+      }
+    }
+  } catch (error) {
+    logger.warn('Failed to auto-detect OAuth scopes', { serverName, error });
+  }
+};
+
 export const initializeOAuthForServer = async (
   serverName: string,
   serverConfig: ServerConfig,
@@ -556,6 +592,12 @@ export const initializeOAuthForServer = async (
     return null;
   }
 
+  // Only when the caller didn't a
```

**File**: `src/services/oauthSettingsStore.ts` (modified, +7/-3)
```diff
@@ -75,7 +75,9 @@ export const persistClientCredentials = async (
     oauth.clientId = credentials.clientId;
     oauth.clientSecret = credentials.clientSecret;
 
-    if (credentials.scopes && credentials.scopes.length > 0) {
+    // `!== undefined` (not `.length > 0`): an explicitly empty scope list is a meaningful
+    // result (the upstream server uses no scopes) and must be persisted, not dropped (#1227).
+    if (credentials.scopes !== undefined) {
       oauth.scopes = credentials.scopes;
     }
     if (credentials.authorizationEndpoint) {
@@ -94,8 +96,10 @@ export const persistClientCredentials = async (
   }
 
   logger.log(`Persisted OAuth client credentials for server: ${serverName}`);
-  if (credentials.scopes && credentials.scopes.length > 0) {
-    logger.log(`Stored OAuth scopes for ${serverName}: ${credentials.scopes.join(', ')}`);
+  if (credentials.scopes !== undefined) {
+    logger.log(
+      `Stored OAuth scopes for ${serverName}: ${credentials.scopes.length > 0 ? credentials.scopes.join(', ') : '(none)'}`,
+    );
   }
 
   return updated;
```

**File**: `src/utils/serverConfigPersistence.ts` (modified, +14/-2)
```diff
@@ -36,6 +36,18 @@ const normalizeSharedUsers = (value?: string[]): string[] | undefined => {
   return normalized ? Array.from(new Set(normalized)) : undefined;
 };
 
+// Unlike normalizeStringArray, this preserves an explicitly empty array instead of collapsing
+// it to `undefined`. For oauth.scopes, `[]` is a meaningful, distinct value from "not
+// configured" (it says the upstream server uses no OAuth scopes at all) and downstream OAuth
+// registration/authorization logic relies on being able to tell the two apart (see #1227) —
+// collapsing `[]` to `undefined` here silently discarded that signal on every save.
+const normalizeOAuthScopes = (value?: string[]): string[] | undefined => {
+  if (!Array.isArray(value)) {
+    return undefined;
+  }
+  return value.map((item) => item.trim()).filter((item) => item.length > 0);
+};
+
 /**
  * Unpacks the startOnDemand/idleTimeoutMs values mirrored into the `options`
  * blob by normalizeOptions() (see below) back to top-level fields, stripping
@@ -156,11 +168,11 @@ const normalizeOAuth = (oauth?: ServerConfig['oauth']): ServerConfig['oauth'] |
   const resource = trimToUndefined(oauth.resource);
   const redirectUri = trimToUndefined(oauth.redirectUri);
   const revocationEndpoint = trimToUndefined(oauth.revocationEndpoint);
-  const scopes = normalizeStringArray(oauth.scopes);
+  const scopes = normalizeOAuthScopes(oauth.scopes);
 
   if (clientId) normalized.clientId = clientId;
   if (clientSecret) normalized.clientSecret = clientSecret;
-  if (scopes) normalized.scopes = scopes;
+  if (scopes !== undefined) normalized.scopes = scopes;
   if (accessToken) normalized.accessToken = accessToken;
   if (refreshToken) normalized.refreshToken = refreshToken;
   if (authorizationEndpoint) normalized.authorizationEndpoint = authorizationEndpoint;
```

**File**: `tests/services/mcpOAuthProvider.test.ts` (modified, +90/-1)
```diff
@@ -7,6 +7,7 @@ jest.mock('../../src/services/oauthClientRegistration.js', () => ({
   getRegisteredClient: jest.fn(),
   removeRegisteredClient: jest.fn(),
   fetchScopesFromServer: jest.fn(),
+  createOAuthFetch: jest.fn().mockResolvedValue(jest.fn()),
 }));
 
 jest.mock('../../src/services/oauthSettingsStore.js', () => ({
@@ -23,7 +24,11 @@ jest.mock('../../src/services/mcpService.js', () => ({
 }));
 
 import { getSystemConfigDao } from '../../src/dao/index.js';
-import { getRegisteredClient } from '../../src/services/oauthClientRegistration.js';
+import {
+  getRegisteredClient,
+  fetchScopesFromServer,
+} from '../../src/services/oauthClientRegistration.js';
+import { mutateOAuthSettings } from '../../src/services/oauthSettingsStore.js';
 import { MCPHubOAuthProvider, createOAuthProvider } from '../../src/services/mcpOAuthProvider.js';
 
 describe('MCPHubOAuthProvider redirect URI resolution', () => {
@@ -221,6 +226,90 @@ describe('createOAuthProvider - 401 auto-discovery guard', () => {
   });
 });
 
+describe('createOAuthProvider - scope discovery before first registration (#1227)', () => {
+  beforeEach(() => {
+    jest.clearAllMocks();
+    (getSystemConfigDao as jest.Mock).mockReturnValue({
+      get: jest.fn().mockResolvedValue({}),
+    });
+  });
+
+  it('discovers scopes for a URL-only config and the first registration sees them, not openid', async () => {
+    // Exact repro from the upstream review: `{ type: 'streamable-http', url: '...' }` with no
+    // `oauth` key at all -- the very first connection attempt, before any registration has
+    // happened. Scope discovery must run here so the *first* registration already knows the
+    // upstream server uses no scopes, instead of only finding out after defaulting to 'openid'.
+    // Asserting the resulting `clientMetadata.scope` (not just that the mocks were called) is
+    // what actually proves the behavior the maintainer asked for.
+    (fetchScopesFromServer as jest.Mock).mockResolvedValue([]);
+    (mutateOAuthSettings as jest.Mock).mockImplementation(async (_name, mutator) => {
+      const oauth: Record<string, unknown> = {};
+      mutator({ oauth, serverConfig: {} });
+      return { oauth };
+    });
+
+    const provider = await createOAuthProvider('pcloud', {
+      type: 'streamable-http',
+      url: 'https://mcp.pcloud.com/mcp',
+    } as any);
+
+    expect(fetchScopesFromServer).toHaveBeenCalledWith(
+      'https://mcp.pcloud.com/mcp',
+      expect.any(Function),
+    );
+    expect(mutateOAuthSettings).toHaveBeenCalledWith('pcloud', expect.any(Function));
+    expect((provider as MCPHubOAuthProvider).clientMetadata.scope).toBe('');
+  });
+
+  it('keeps the openid default when discovery finds nothing, without persisting anything', async () => {
+    (fetchScopesFromServer as jest.Mock).mockResolvedValue(undefined);
+
+    const provider = await createOAuthProvider('undiscoverable', {
+      type: 'streamable-http',
+      url: 'https://example.com/mcp',
+    } as any);
+
+    expect(fetchScopesFromServer).toHaveBeenCalledWith(
+      'https://example.com/mcp',
+      expect.any(Function),
+    );
+    expect(mutateOAuthSettings).not.toHaveBeenCalled();
+    expect((provider as MCPHubOAuthProvider).clientMetadata.scope).toBe('openid');
+  });
+
+  it('does not throw and keeps the openid default when discovery itself fails', async () => {
+    (fetchScopesFromServer as jest.Mock).mockRejectedValue(new Error('network error'));
+
+    const provider = await createOAuthProvider('flaky', {
+      type: 'streamable-http',
+      url: 'https://example.com/mcp',
+    } as any);
+
+    expect(mutateOAuthSettings).not.toHaveBeenCalled();
+    expect((provider as MCPHubOAuthProvider).clientMetadata.scope).toBe('openid');
+  });
+
+  it('does not re-fetch scopes when they were already resolved to an empty array', async () => {
+    await createOAuthProvider('pcloud', {
+      type: 'streamable-http',
+      url: 'https://mcp.pcloud.com/mcp',
+   
```

---

### Incident Patch 6: `b6a0eddd` (2026-09-28)
**Commit Message**: fix: expand server config before tool-call reconnect (#1231)

**File**: `src/services/mcpService.ts` (modified, +4/-2)
```diff
@@ -1639,11 +1639,13 @@ const callToolWithReconnect = async (
         );
 
         try {
-          const server = await getServerDao().findById(serverInfo.name);
-          if (!server) {
+          const rawConfig = await getServerDao().findById(serverInfo.name);
+          if (!rawConfig) {
             throw new Error(`Server configuration not found for: ${serverInfo.name}`);
           }
 
+          // Match initial connection expansion before URL validation and transport creation.
+          const server = replaceEnvVars(rawConfig) as ServerConfigWithName;
           const newTransport = await createTransportFromConfig(serverInfo.name, server);
           const newClient = createUpstreamMcpClient(serverInfo.name, () => serverInfo);
 
```

**File**: `tests/integration/mcpService-reconnect.test.ts` (renamed, +53/-4)
```diff
@@ -1,5 +1,10 @@
 /// <reference types="jest" />
-import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
+import { SSEClientTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
+
+// Keep DNS deterministic while exercising the real SSRF URL validation.
+jest.mock('node:dns/promises', () => ({
+  lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
+}));
 
 const mockReconnectClient = {
   connect: jest.fn().mockResolvedValue(undefined),
@@ -131,8 +136,7 @@ jest.mock('../../src/dao/index.js', () => ({
 }));
 
 jest.mock('../../src/config/index.js', () => ({
-  expandEnvVars: jest.fn((value: string) => value),
-  replaceEnvVars: jest.fn((value: any) => value),
+  ...jest.requireActual('../../src/config/index.js'),
   getNameSeparator: jest.fn(() => '::'),
   default: {
     mcpHubName: 'test-hub',
@@ -142,7 +146,7 @@ jest.mock('../../src/config/index.js', () => ({
 }));
 
 import * as mcpService from '../../src/services/mcpService.js';
-describe('mcpService streamable-http reconnect', () => {
+describe('mcpService reconnect config integration', () => {
   beforeEach(() => {
     jest.clearAllMocks();
   });
@@ -208,6 +212,51 @@ describe('mcpService streamable-http reconnect', () => {
     );
   });
 
+  it.each(['sse', 'streamable-http'])('expands URL credentials on %s reconnect', async (type) => {
+    const previousToken = process.env.MCPHUB_TEST_RECONNECT_TOKEN;
+    process.env.MCPHUB_TEST_RECONNECT_TOKEN = 'reconnect-secret';
+    const rawConfig = {
+      name: 'clock-server',
+      type,
+      url: 'https://example.com/mcp?token=${MCPHUB_TEST_RECONNECT_TOKEN}',
+      enabled: true,
+    };
+    mockServerDao.findById.mockResolvedValueOnce(rawConfig);
+    const initialTransport =
+      type === 'sse'
+        ? new SSEClientTransport(new URL('https://example.com/mcp?token=reconnect-secret'))
+        : new StreamableHTTPClientTransport(
+            new URL('https://example.com/mcp?token=reconnect-secret'),
+          );
+    const serverInfo = createServerInfo(
+      jest
+        .fn()
+        .mockRejectedValue(type === 'sse' ? new Error('Request timed out') : { status: 404 }),
+      initialTransport,
+    ) as any;
+    mcpService.setServerInfosForTest([serverInfo]);
+    try {
+      const result = await mcpService.handleCallToolRequest(
+        {
+          params: {
+            name: 'call_tool',
+            arguments: { toolName: 'clock-server::get_current_time', arguments: {} },
+          },
+        },
+        { sessionId: 'session-1', server: 'clock-server' },
+      );
+      expect(result.isError).toBe(false);
+      expect(serverInfo.transport.url.searchParams.get('token')).toBe('reconnect-secret');
+      expect(serverInfo.status).toBe('connected');
+      expect(mockReconnectClient.callTool).toHaveBeenCalledTimes(1);
+      expect(rawConfig.url).toContain('${MCPHUB_TEST_RECONNECT_TOKEN}');
+    } finally {
+      if (previousToken === undefined) delete process.env.MCPHUB_TEST_RECONNECT_TOKEN;
+      else process.env.MCPHUB_TEST_RECONNECT_TOKEN = previousToken;
+      mcpService.setServerInfosForTest([]);
+    }
+  });
+
   it('reconnects when the HTTP status is exposed via error.status', async () => {
     const initialCallTool = jest.fn().mockRejectedValue({
       message: 'Streamable HTTP error: upstream session expired',
```

---

### Incident Patch 7: `aea74eda` (2026-09-28)
**Commit Message**: fix: remove render-blocking Google Fonts dependency (#1230)

**File**: `frontend/index.html` (modified, +1/-4)
```diff
@@ -6,14 +6,11 @@
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>MCPHub Dashboard</title>
   <link rel="icon" type="image/x-icon" href="/favicon.ico">
-  <link rel="preconnect" href="https://fonts.googleapis.com">
-  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
-  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
 </head>
 
 <body class="bg-gray-100">
   <div id="root"></div>
   <script type="module" src="/src/main.tsx"></script>
 </body>
 
-</html>
\ No newline at end of file
+</html>
```

**File**: `frontend/src/index.css` (modified, +1/-1)
```diff
@@ -837,7 +837,7 @@ textarea.form-input:focus {
 body {
   margin: 0;
   font-family:
-    'Inter',
+    system-ui,
     'PingFang SC',
     -apple-system,
     BlinkMacSystemFont,
```

---

### Incident Patch 8: `82160424` (2026-09-27)
**Commit Message**: fix(oauth): respect upstream issuer response support (#1223)

**File**: `src/controllers/oauthCallbackController.ts` (modified, +8/-2)
```diff
@@ -328,14 +328,20 @@ export const handleOAuthCallback = async (req: Request, res: Response) => {
     // RFC 9207 / SEP-2468: when the authorization response carries `iss`,
     // validate it against the issuer we sent the authorization request to
     // before redeeming the code (mix-up attack mitigation). Legacy servers
-    // that omit `iss` are allowed through.
+    // that do not advertise support may omit `iss`.
     const issParam = normalizeQueryParam(req.query.iss);
     const issResult = validateAuthorizationIss({
       iss: issParam,
       authorizationUrl:
         serverInfo.oauth?.authorizationUrl ??
         serverInfo.config?.oauth?.pendingAuthorization?.authorizationUrl,
-      configuredIssuer: serverInfo.config?.oauth?.dynamicRegistration?.issuer,
+      configuredIssuer:
+        serverInfo.oauth?.issuer ??
+        serverInfo.config?.oauth?.pendingAuthorization?.issuer ??
+        serverInfo.config?.oauth?.dynamicRegistration?.issuer,
+      issRequired:
+        serverInfo.oauth?.issRequired ??
+        serverInfo.config?.oauth?.pendingAuthorization?.issRequired,
     });
     if (!issResult.valid) {
       logger.error('OAuth callback iss validation failed', {
```

**File**: `src/services/mcpOAuthProvider.ts` (modified, +22/-1)
```diff
@@ -12,7 +12,10 @@
  */
 
 import { randomBytes } from 'node:crypto';
-import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
+import type {
+  OAuthClientProvider,
+  OAuthDiscoveryState,
+} from '@modelcontextprotocol/sdk/client/auth.js';
 import type {
   OAuthClientInformation,
   OAuthClientInformationFull,
@@ -62,6 +65,8 @@ type OAuthClientInformationWithAuthMethod = OAuthClientInformation &
 export class MCPHubOAuthProvider implements OAuthClientProvider {
   private serverName: string;
   private serverConfig: ServerConfig;
+  private _issuer?: string;
+  private _issRequired?: boolean;
   private _codeVerifier?: string;
   private _currentState?: string;
   private _systemInstallBaseUrl?: string;
@@ -320,6 +325,18 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
     logger.log('Saved OAuth tokens', { serverName: this.serverName });
   }
 
+  // Capture the SDK's actual discovery result before redirecting. Keep this
+  // snapshot with the pending flow so callback validation survives restarts.
+  saveDiscoveryState(state: OAuthDiscoveryState): void {
+    const metadata = state.authorizationServerMetadata;
+    this._issuer = metadata?.issuer;
+    this._issRequired = Boolean(
+      metadata &&
+        'authorization_response_iss_parameter_supported' in metadata &&
+        metadata.authorization_response_iss_parameter_supported === true,
+    );
+  }
+
   /**
    * Redirect to authorization URL
    * In a server environment, we can't directly redirect the user
@@ -344,6 +361,8 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
     try {
       const pendingUpdate: Partial<NonNullable<ServerConfig['oauth']>['pendingAuthorization']> = {
         authorizationUrl,
+        issuer: this._issuer ?? this.serverConfig.oauth?.dynamicRegistration?.issuer,
+        issRequired: this._issRequired,
         state,
       };
 
@@ -368,6 +387,8 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
       serverInfo.status = 'oauth_required';
       serverInfo.oauth = {
         authorizationUrl,
+        issuer: this._issuer ?? this.serverConfig.oauth?.dynamicRegistration?.issuer,
+        issRequired: this._issRequired,
         state,
         // codeVerifier is intentionally NOT stored on serverInfo.oauth: it is a
         // PKCE credential, and storing it on the long-lived ServerInfo taints the
```

**File**: `src/types/index.ts` (modified, +4/-0)
```diff
@@ -496,6 +496,8 @@ export interface ServerConfig {
     // Pending OAuth session metadata for PKCE/state recovery between restarts
     pendingAuthorization?: {
       authorizationUrl?: string;
+      issuer?: string;
+      issRequired?: boolean;
       state?: string;
       codeVerifier?: string;
       createdAt?: number;
@@ -596,6 +598,8 @@ export interface ServerInfo {
   lastUsedAt?: number; // Timestamp of last tool call (ms since epoch)
   oauth?: {
     // OAuth authorization state
+    issuer?: string;
+    issRequired?: boolean;
     authorizationUrl?: string; // OAuth authorization URL for user to visit
     state?: string; // OAuth state parameter for CSRF protection
     connected?: boolean; // True when stored upstream OAuth tokens exist
```

**File**: `src/utils/oauthIssuer.ts` (modified, +12/-17)
```diff
@@ -12,9 +12,11 @@
 export interface AuthorizationResponseIssContext {
   /** `iss` query parameter from the authorization response (absent on legacy servers). */
   iss?: string;
+  /** Support advertised by the AS when this authorization flow started. */
+  issRequired?: boolean;
   /** The authorization URL MCPHub originally redirected the user to. */
   authorizationUrl?: string;
-  /** Explicitly configured issuer for the upstream server, if any. */
+  /** Discovered or explicitly configured issuer for this flow, if any. */
   configuredIssuer?: string;
 }
 
@@ -36,36 +38,29 @@ const originOf = (url: string | undefined): string | undefined => {
 
 /**
  * Expected `iss` values for an upstream authorization flow: the explicitly
- * configured issuer plus the origin of the authorization endpoint actually used.
+ * configured issuer, falling back to the authorization endpoint origin.
  */
 export const expectedIssValues = (ctx: AuthorizationResponseIssContext): string[] => {
-  const candidates = [ctx.configuredIssuer, originOf(ctx.authorizationUrl)];
-  return [...new Set(candidates.filter((c): c is string => Boolean(c)))];
+  const issuer = ctx.configuredIssuer || originOf(ctx.authorizationUrl);
+  return issuer ? [issuer] : [];
 };
 
 /**
  * Validate the `iss` authorization-response parameter.
  *
- * - Absent `iss` with a known expected issuer → invalid (RFC 9207 requires
- *   `iss` in the authorization response; when MCPHub knows which issuer it
- *   sent the request to, a response without `iss` cannot be bound to that
- *   request — GHSA-vc28-27px-x492).
- * - Absent `iss` with no way to establish the expected issuer → valid but
- *   unchecked (older servers do not send it and no mix-up is possible when no
- *   issuer expectation exists).
- * - Present `iss` with nothing to compare against → unchecked fail-safe pass,
- *   since we cannot establish what the client expected (no mix-up possible
- *   when only one AS is involved in a flow keyed by our own state parameter).
- * - Present `iss` → must exactly match one of the expected values.
+ * Missing `iss` is allowed for servers known not to advertise RFC 9207 support.
+ * Older pending flows without a support snapshot retain the strict policy.
+ * A supplied issuer must match the complete expected issuer; the endpoint
+ * origin is only a fallback when no issuer was discovered or configured.
  */
 export const validateAuthorizationIss = (
   ctx: AuthorizationResponseIssContext,
 ): IssValidationResult => {
   const { iss } = ctx;
 
-  if (!iss) {
+  if (iss === undefined) {
     const expected = expectedIssValues(ctx);
-    if (expected.length > 0) {
+    if (ctx.issRequired === true || (ctx.issRequired === undefined && expected.length > 0)) {
       return {
         valid: false,
         checked: true,
```

**File**: `tests/integration/oauth-callback-reconnect.test.ts` (modified, +77/-56)
```diff
@@ -19,7 +19,10 @@ jest.mock('../../src/config/index.js', () => ({
   replaceEnvVars: jest.fn((value: unknown) => value),
 }));
 
-import { handleOAuthCallback } from '../../src/controllers/oauthCallbackController.js';
+import {
+  handleOAuthCallback,
+  resetOAuthStateTrackingForTests,
+} from '../../src/controllers/oauthCallbackController.js';
 import {
   connectClientWithDiagnostics,
   createTransportFromConfig,
@@ -29,64 +32,82 @@ import {
 import { loadServerConfig } from '../../src/services/oauthSettingsStore.js';
 
 describe('OAuth callback reconnect integration', () => {
-  it('reconnects an existing client after replacing its transport', async () => {
-    const serverInfo = {
-      name: 'oauth-server',
-      status: 'oauth_required' as const,
-      config: {
-        url: 'https://upstream.example.com/mcp',
-        oauth: { dynamicRegistration: { enabled: true } },
-      },
-      options: undefined,
-      transport: {
-        finishAuth: jest.fn().mockResolvedValue(undefined),
-        close: jest.fn().mockResolvedValue(undefined),
-      },
-      client: {
-        getServerCapabilities: jest.fn().mockReturnValue({ tools: {} }),
-        listTools: jest.fn().mockResolvedValue({ tools: [] }),
-      },
-      tools: [],
-      prompts: [],
-      resources: [],
-      oauth: {
-        authorizationUrl: 'https://as.example.com/authorize',
-        state: 'state-123',
-      },
-    };
-    const refreshedTransport = { close: jest.fn().mockResolvedValue(undefined) };
-    const app = express();
-    const limiter = rateLimit({
-      windowMs: 15 * 60 * 1000,
-      max: 100,
-    });
-    app.use(limiter);
-    app.get('/oauth/callback', (req, res) => {
-      void handleOAuthCallback(req, res);
-    });
+  it.each([
+    { issRequired: false, iss: undefined, status: 200 },
+    { issRequired: true, iss: undefined, status: 400 },
+    { issRequired: true, iss: 'https://as.example.com/tenant', status: 200 },
+    { issRequired: false, iss: 'https://as.example.com', status: 400 },
+  ])(
+    'validates persisted issuer context before reconnecting: %j',
+    async ({ issRequired, iss, status }) => {
+      resetOAuthStateTrackingForTests();
+      const serverInfo = {
+        name: 'oauth-server',
+        status: 'oauth_required' as const,
+        config: {
+          url: 'https://upstream.example.com/mcp',
+          oauth: {
+            dynamicRegistration: { enabled: true },
+            pendingAuthorization: { issuer: 'https://as.example.com/tenant', issRequired },
+          },
+        },
+        options: undefined,
+        transport: {
+          finishAuth: jest.fn().mockResolvedValue(undefined),
+          close: jest.fn().mockResolvedValue(undefined),
+        },
+        client: {
+          getServerCapabilities: jest.fn().mockReturnValue({ tools: {} }),
+          listTools: jest.fn().mockResolvedValue({ tools: [] }),
+        },
+        tools: [],
+        prompts: [],
+        resources: [],
+        oauth: {
+          authorizationUrl: 'https://as.example.com/authorize',
+          state: 'state-123',
+        },
+      };
+      const finishAuth = serverInfo.transport.finishAuth;
+      const refreshedTransport = { close: jest.fn().mockResolvedValue(undefined) };
+      const app = express();
+      const limiter = rateLimit({
+        windowMs: 15 * 60 * 1000,
+        max: 100,
+      });
+      app.use(limiter);
+      app.get('/oauth/callback', (req, res) => {
+        void handleOAuthCallback(req, res);
+      });
 
-    (getServerByOAuthState as jest.Mock).mockReturnValue(serverInfo);
-    (getServerByPendingOAuthState as jest.Mock).mockReturnValue(undefined);
-    (loadServerConfig as jest.Mock).mockResolvedValue(serverInfo.config);
-    (createTransportFromConfig as jest.Mock).mockResolvedValue(refreshedTransport);
-    (connectClientWithDiagnostics as jest.Mock).mockResolvedValue(undefined);
+      (getServerByOAuthState as jest.Mock).mockReturnValue(serverInfo);
+      (
```

---

### Incident Patch 9: `941b5753` (2026-09-26)
**Commit Message**: fix(security): rate-limit the /api auth gate ahead of the auth check

Failed-auth requests answer 401 before any route-level limiter runs, so the
shared /api authorization middleware in src/middlewares/index.ts was uncapped
and brute-forceable (CodeQL js/missing-rate-limiting). Mount
apiAuthGateRateLimiter before the auth middleware, sharing the
API_RATE_LIMIT_* budget with authenticatedRouteRateLimiter, and skip the public
auth routes (login, register, better-auth) so they keep using their own
limiters instead of consuming the shared authenticated-route budget. The
exemption is a single shared predicate (isApiAuthExemptPath) used by both the
auth middleware and the gate limiter's skip.

Also rate-limit the auth handler in the server-config-persistence integration
app. Closes code-scanning alerts 388, 389 and 391.

**File**: `src/middlewares/index.test.ts` (modified, +63/-0)
```diff
@@ -58,9 +58,18 @@ jest.mock('../services/betterAuthConfig.js', () => ({
   getBetterAuthRuntimeConfig: jest.fn(() => ({
     basePath: '/better-auth',
   })),
+  isApiAuthExemptPath: jest.fn(() => false),
+}));
+
+jest.mock('../utils/rateLimit.js', () => ({
+  apiAuthGateRateLimiter: jest.fn((_req, _res, next) => next()),
 }));
 
 import { initMiddlewares } from './index.js';
+import { apiAuthGateRateLimiter } from '../utils/rateLimit.js';
+import { auth } from './auth.js';
+import { userContextMiddleware } from './userContext.js';
+import { isApiAuthExemptPath } from '../services/betterAuthConfig.js';
 
 describe('initMiddlewares', () => {
   beforeEach(() => {
@@ -154,4 +163,58 @@ describe('initMiddlewares', () => {
     expect(mockJsonMiddleware).toHaveBeenCalled();
     expect(mockGetSystemConfig).not.toHaveBeenCalled();
   });
+
+  it('mounts the /api rate-limit gate before the auth middleware', () => {
+    const app = {
+      use: jest.fn(),
+    } as any;
+
+    initMiddlewares(app);
+
+    // Registration order: i18n (0), JSON body wrapper (1), /api rate-limit gate
+    // (2), /api auth middleware (3), error handler (4). The gate must run ahead
+    // of the auth check so failed-auth requests are rate-limited too.
+    expect(app.use.mock.calls[2][0]).toBe('/test/api');
+    expect(app.use.mock.calls[2][1]).toBe(apiAuthGateRateLimiter);
+    expect(app.use.mock.calls[3][0]).toBe('/test/api');
+    expect(app.use.mock.calls[3][1]).toEqual(expect.any(Function));
+  });
+
+  it('skips auth for exempt public auth routes via the shared exemption helper', async () => {
+    (isApiAuthExemptPath as jest.Mock).mockReturnValue(true);
+
+    const app = {
+      use: jest.fn(),
+    } as any;
+
+    initMiddlewares(app);
+
+    const authMiddleware = app.use.mock.calls[3][1];
+    const next = jest.fn();
+
+    await authMiddleware({ path: '/auth/login' }, {}, next);
+
+    expect(isApiAuthExemptPath).toHaveBeenCalledWith('/auth/login', { basePath: '/better-auth' });
+    expect(auth).not.toHaveBeenCalled();
+    expect(next).toHaveBeenCalled();
+  });
+
+  it('applies auth and user context for non-exempt API routes', async () => {
+    (isApiAuthExemptPath as jest.Mock).mockReturnValue(false);
+
+    const app = {
+      use: jest.fn(),
+    } as any;
+
+    initMiddlewares(app);
+
+    const authMiddleware = app.use.mock.calls[3][1];
+    const next = jest.fn();
+
+    await authMiddleware({ path: '/servers' }, {}, next);
+
+    expect(isApiAuthExemptPath).toHaveBeenCalledWith('/servers', { basePath: '/better-auth' });
+    expect(auth).toHaveBeenCalled();
+    expect(userContextMiddleware).toHaveBeenCalled();
+  });
 });
```

**File**: `src/middlewares/index.ts` (modified, +14/-9)
```diff
@@ -4,9 +4,13 @@ import { userContextMiddleware } from './userContext.js';
 import { i18nMiddleware } from './i18n.js';
 import config from '../config/index.js';
 import { getSystemConfigDao } from '../dao/index.js';
-import { getBetterAuthRuntimeConfig } from '../services/betterAuthConfig.js';
+import {
+  getBetterAuthRuntimeConfig,
+  isApiAuthExemptPath,
+} from '../services/betterAuthConfig.js';
 import { getCachedSystemConfig } from '../utils/systemConfigCache.js';
 import { resolveJsonBodyLimit } from '../utils/bearerAuth.js';
+import { apiAuthGateRateLimiter } from '../utils/rateLimit.js';
 import { logger } from '../utils/logger.js';
 
 export const errorHandler = (
@@ -66,21 +70,22 @@ export const initMiddlewares = (app: express.Application): void => {
     }
   });
 
+  // Rate-limit the shared /api authorization gate BEFORE the auth check runs.
+  // Failed-auth requests answer 401 without ever reaching the authenticated
+  // sub-router's limiter, so without this gate the auth check itself would be
+  // uncapped and brute-forceable (CodeQL js/missing-rate-limiting). Public auth
+  // routes (login, register, better-auth) are skipped here - they carry their
+  // own limiters - so they do not consume the shared authenticated-route budget.
+  app.use(`${config.basePath}/api`, apiAuthGateRateLimiter);
+
   // Protect API routes with authentication middleware, but exclude auth endpoints
   app.use(`${config.basePath}/api`, async (req, res, next) => {
     try {
       // Route exemptions must reflect the current shared authentication policy.
       const betterAuthConfig = await getBetterAuthRuntimeConfig();
-      const betterAuthApiPath = betterAuthConfig.basePath.startsWith('/api')
-        ? betterAuthConfig.basePath.replace(/^\/api/, '') || '/'
-        : null;
 
       // Skip authentication for login endpoint
-      if (
-        req.path === '/auth/login' ||
-        (betterAuthApiPath !== null && req.path.startsWith(betterAuthApiPath)) ||
-        req.path.startsWith('/better-auth')
-      ) {
+      if (isApiAuthExemptPath(req.path, betterAuthConfig)) {
         next();
         return;
       }
```

**File**: `src/services/betterAuthConfig.ts` (modified, +25/-0)
```diff
@@ -349,6 +349,31 @@ export const getBetterAuthRuntimeConfig = async (
   return resolveBetterAuthRuntimeConfig(systemConfig);
 };
 
+/**
+ * True when a request path under the `/api` mount should bypass the shared
+ * authentication gate and its rate limiter. This is the single source of truth
+ * for the exemption applied in `src/middlewares/index.ts` and mirrored by the
+ * `apiAuthGateRateLimiter` skip in `src/utils/rateLimit.ts`: public auth routes
+ * (login, register) and better-auth endpoints carry their own limiters or
+ * handler, so they must not consume the shared authenticated-route budget.
+ *
+ * `reqPath` is the path relative to the `/api` mount (Express strips the mount
+ * prefix), e.g. `/auth/login` for a request to `/api/auth/login`.
+ */
+export const isApiAuthExemptPath = (
+  reqPath: string,
+  betterAuthConfig: Pick<BetterAuthRuntimeConfig, 'basePath'>,
+): boolean => {
+  const betterAuthApiPath = betterAuthConfig.basePath.startsWith('/api')
+    ? betterAuthConfig.basePath.replace(/^\/api/, '') || '/'
+    : null;
+  return (
+    reqPath === '/auth/login' ||
+    (betterAuthApiPath !== null && reqPath.startsWith(betterAuthApiPath)) ||
+    reqPath.startsWith('/better-auth')
+  );
+};
+
 export const betterAuthRuntimeConfig = (() => {
   const cachedSystemConfig = getCachedSystemConfig();
   if (cachedSystemConfig) {
```

**File**: `src/utils/rateLimit.test.ts` (modified, +35/-0)
```diff
@@ -24,6 +24,12 @@ jest.mock('./logger.js', () => ({
   logger: { warn: warnMock, info: jest.fn(), error: jest.fn(), debug: jest.fn() },
 }));
 
+jest.mock('../services/betterAuthConfig.js', () => ({
+  __esModule: true,
+  getBetterAuthRuntimeConfig: jest.fn(async () => ({ basePath: '/api/auth/better' })),
+  isApiAuthExemptPath: jest.fn((reqPath: string) => reqPath === '/auth/login'),
+}));
+
 const ENV_KEYS = [
   'AUTH_RATE_LIMIT_MAX',
   'AUTH_RATE_LIMIT_WINDOW_MS',
@@ -115,6 +121,12 @@ describe('rateLimit configuration', () => {
       standardHeaders: true,
       legacyHeaders: false,
     });
+    expect(mod.apiAuthGateRateLimiter).toMatchObject({
+      windowMs: 15 * 60 * 1000,
+      max: 600,
+      standardHeaders: true,
+      legacyHeaders: false,
+    });
     expect(mod.mcpConnectionRateLimiter).toMatchObject({
       windowMs: 60 * 1000,
       max: 480,
@@ -163,6 +175,7 @@ describe('rateLimit configuration', () => {
         mod.spaPageRateLimiter,
         mod.hostedInternalEventRateLimiter,
         mod.authRegistrationRateLimiter,
+        mod.apiAuthGateRateLimiter,
       ]) {
         expect(limiter).not.toMatchObject({ skipSuccessfulRequests: true });
       }
@@ -261,6 +274,7 @@ describe('rateLimit configuration', () => {
 
       expect(mod.templateRateLimiter).toMatchObject({ max: 11 });
       expect(mod.authenticatedRouteRateLimiter).toMatchObject({ max: 12 });
+      expect(mod.apiAuthGateRateLimiter).toMatchObject({ max: 12 });
       expect(mod.hostedInternalEventRateLimiter).toMatchObject({ max: 13 });
       expect(mod.mcpConnectionRateLimiter).toMatchObject({ max: 14 });
       expect(mod.authAttemptRateLimiter).toMatchObject({ max: 15 });
@@ -283,4 +297,25 @@ describe('rateLimit configuration', () => {
       expect(mod.authAttemptRateLimiter).toMatchObject({ max: 20 });
     });
   });
+
+  describe('api auth gate limiter', () => {
+    it('skips automatically in test environments', async () => {
+      const mod = await loadRateLimit();
+
+      expect((mod.apiAuthGateRateLimiter as unknown as { skip: () => boolean }).skip()).toBe(true);
+    });
+
+    it('delegates the per-path exemption to isApiAuthExemptPath in production', async () => {
+      const mod = await loadRateLimit({}, { productionLike: true });
+
+      const skip = (
+        mod.apiAuthGateRateLimiter as unknown as {
+          skip: (req: { path: string }) => Promise<boolean>;
+        }
+      ).skip;
+
+      await expect(skip({ path: '/auth/login' })).resolves.toBe(true);
+      await expect(skip({ path: '/servers' })).resolves.toBe(false);
+    });
+  });
 });
```

**File**: `src/utils/rateLimit.ts` (modified, +26/-2)
```diff
@@ -1,4 +1,5 @@
 import rateLimit from 'express-rate-limit';
+import type { Request, Response } from 'express';
 import dotenv from 'dotenv';
 import { logger } from './logger.js';
 
@@ -68,16 +69,20 @@ export const createStandardRateLimiter = (options: {
   windowMs: number;
   max: number | typeof UNLIMITED;
   skipSuccessfulRequests?: boolean;
+  skip?: (request: Request, response: Response) => boolean | Promise<boolean>;
 }) => {
-  const { max, ...rest } = options;
+  const { max, skip, ...rest } = options;
 
   return rateLimit({
     ...rest,
     // Kept positive so the middleware never blocks; `skip` is what disables it.
     max: max === UNLIMITED ? Number.MAX_SAFE_INTEGER : max,
     standardHeaders: true,
     legacyHeaders: false,
-    skip: () => isTestEnv || max === UNLIMITED,
+    // A caller-provided `skip` (e.g. path exemptions) is combined with the
+    // built-in test/unlimited skips.
+    skip: (request, response) =>
+      isTestEnv || max === UNLIMITED || (skip !== undefined && skip(request, response)),
     // The rest of the API answers with JSON; without this the 429 body is bare
     // text, so clients that parse the response as JSON lose the error entirely.
     message: { success: false, message: 'Too many requests, please try again later.' },
@@ -94,6 +99,25 @@ export const authenticatedRouteRateLimiter = createStandardRateLimiter({
   max: envLimit('API_RATE_LIMIT_MAX', 600),
 });
 
+// Rate-limit gate mounted ahead of the shared `/api` authorization middleware
+// in src/middlewares/index.ts. Without it, failed-auth requests answer 401
+// before any route-level limiter runs, leaving the auth check itself uncapped
+// and brute-forceable (CodeQL js/missing-rate-limiting). It shares the
+// authenticated-route budget (API_RATE_LIMIT_MAX) and skips the public auth
+// routes that carry their own limiters (login, register, better-auth), so those
+// keep using their dedicated budgets instead of consuming the shared one.
+export const apiAuthGateRateLimiter = createStandardRateLimiter({
+  windowMs: envInt('API_RATE_LIMIT_WINDOW_MS', MINUTES_15),
+  max: envLimit('API_RATE_LIMIT_MAX', 600),
+  skip: async (req) => {
+    const { getBetterAuthRuntimeConfig, isApiAuthExemptPath } = await import(
+      '../services/betterAuthConfig.js'
+    );
+    const betterAuthConfig = await getBetterAuthRuntimeConfig();
+    return isApiAuthExemptPath(req.path, betterAuthConfig);
+  },
+});
+
 export const hostedInternalEventRateLimiter = createStandardRateLimiter({
   windowMs: envInt('HOSTED_EVENT_RATE_LIMIT_WINDOW_MS', MINUTE_1),
   max: envLimit('HOSTED_EVENT_RATE_LIMIT_MAX', 600),
```

---

### Incident Patch 10: `79b6eb0e` (2026-09-26)
**Commit Message**: fix(security): bump qs, browserslist, baseline-browser-mapping to patched versions

Resolve open Dependabot alerts:
- qs 6.15.2 -> 6.16.0 (GHSA-4mjr-xmp4-gh2g, GHSA-x5fp-wj9c-mxmx)
- browserslist 4.28.1 -> 4.28.7 (GHSA-73wf-gq98-2v4g)
- baseline-browser-mapping 2.10.23 -> 2.11.9 (GHSA-w5vr-8v7q-w6rv)

**File**: `package.json` (modified, +3/-1)
```diff
@@ -181,6 +181,8 @@
       "hono": "4.13.5",
       "ajv@6.12.6": "6.14.0",
       "ajv@8.17.1": "8.18.0",
+      "baseline-browser-mapping": "2.11.9",
+      "browserslist": "4.28.7",
       "js-yaml": "4.3.2",
       "jws@3.2.2": "4.0.1",
       "lodash@4.17.23": "4.18.1",
@@ -191,7 +193,7 @@
       "picomatch@2.3.1": "2.3.2",
       "picomatch@4.0.3": "4.0.4",
       "postcss": "8.5.23",
-      "qs": "6.15.2",
+      "qs": "6.16.0",
       "rollup": "4.59.0",
       "tar@7.5.10": "7.5.13",
       "uuid": "14.0.0"
```

**File**: `pnpm-lock.yaml` (modified, +22/-55)
```diff
@@ -32,6 +32,8 @@ overrides:
   hono: 4.13.5
   ajv@6.12.6: 6.14.0
   ajv@8.17.1: 8.18.0
+  baseline-browser-mapping: 2.11.9
+  browserslist: 4.28.7
   js-yaml: 4.3.2
   jws@3.2.2: 4.0.1
   lodash@4.17.23: 4.18.1
@@ -42,7 +44,7 @@ overrides:
   picomatch@2.3.1: 2.3.2
   picomatch@4.0.3: 4.0.4
   postcss: 8.5.23
-  qs: 6.15.2
+  qs: 6.16.0
   rollup: 4.59.0
   tar@7.5.10: 7.5.13
   uuid: 14.0.0
@@ -2427,11 +2429,6 @@ packages:
   base64-js@1.5.1:
     resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}
 
-  baseline-browser-mapping@2.10.23:
-    resolution: {integrity: sha512-xwVXGqevyKPsiuQdLj+dZMVjidjJV508TBqexND5HrF89cGdCYCJFB3qhcxRHSeMctdCfbR1jrxBajhDy7o29g==}
-    engines: {node: '>=6.0.0'}
-    hasBin: true
-
   baseline-browser-mapping@2.11.9:
     resolution: {integrity: sha512-cp447VUsGS07+n1Dqf7YSQ8maeJrjEhaDxTm1ZefbqDtypHBC5GzGMQbklR6IPR13Y8OAJRHZWEMtZipJLCttg==}
     engines: {node: '>=6.0.0'}
@@ -2558,11 +2555,6 @@ packages:
     resolution: {integrity: sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==}
     engines: {node: '>=8'}
 
-  browserslist@4.28.1:
-    resolution: {integrity: sha512-ZC5Bd0LgJXgwGqUknZY/vkUQ04r8NXnJZ3yYi4vDmSiZmC/pdSN0NbNRPxZpbtO4uAfDUAFffO8IZoM3Gj8IkA==}
-    engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
-    hasBin: true
-
   browserslist@4.28.7:
     resolution: {integrity: sha512-JxV13hNrFxqjOc8alRbq9dK1MM79NEXYpma2B2J4wAtpWS5zIEIKqWPGCl7N4o7Uc7B7itylh7SuDujATRyyTw==}
     engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
@@ -2908,9 +2900,6 @@ packages:
   ee-first@1.1.1:
     resolution: {integrity: sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==}
 
-  electron-to-chromium@1.5.302:
-    resolution: {integrity: sha512-sM6HAN2LyK82IyPBpznDRqlTQAtuSaO+ShzFiWTvoMJLHyZ+Y39r8VMfHzwbU8MVBzQ4Wdn85+wlZl2TLGIlwg==}
-
   electron-to-chromium@1.5.399:
     resolution: {integrity: sha512-lEcqhErbHjXRvd41rnWLpzbyU/IXfIYo7QwaFWmxGeLiLyY2TBCdHnWY88vB+p3ubnihRypDm66panXl7TylLA==}
 
@@ -4327,9 +4316,6 @@ packages:
   node-int64@0.4.0:
     resolution: {integrity: sha512-O5lz91xSOeoXP6DulyHfllpq+Eg00MWitZIbtPfoSEvqIHdl5gfcY6hYzDWnj0qD5tz52PI08u9qUvSVeUBeHw==}
 
-  node-releases@2.0.27:
-    resolution: {integrity: sha512-nmh3lCkYZ3grZvqcCH+fjmQ7X+H0OeZgP40OierEaAptX4XofMh5kwNbWh7lBduUzCcV/8kZ+NDLCwm2iorIlA==}
-
   node-releases@2.0.51:
     resolution: {integrity: sha512-wRNIrw4DmVLKQlbgOMdkMx27Wrpzes2hh5Jtbi2bjPd+4wJstWIqP5A+lscnqbm0xxmT5Bpg8Lec5ItEBwx6BQ==}
     engines: {node: '>=18'}
@@ -4621,8 +4607,8 @@ packages:
   pure-rand@7.0.1:
     resolution: {integrity: sha512-oTUZM/NAZS8p7ANR3SHh30kXB+zK2r2BPcEn/awJIbOvq82WoMN4p62AWWp3Hhw50G0xMsw1mhIBLqHw64EcNQ==}
 
-  qs@6.15.2:
-    resolution: {integrity: sha512-Rzq0KEyX/w/tEybncDgdkZrJgVUsUMk3xjh3t5bv3S1HTAtg+uOYt72+ZfwiQwKdysThkTBdL/rTi6HDmX9Ddw==}
+  qs@6.16.0:
+    resolution: {integrity: sha512-h6fhOIaRrID2CbEY2fqs+7t+UXZo+MLAnU5gRIq85uFtdiUPCdsApMlHhXogKVM4HM2DVbIjGNTTYH2OcmP1vA==}
     engines: {node: '>=0.6'}
 
   range-parser@1.2.1:
@@ -4866,8 +4852,8 @@ packages:
     resolution: {integrity: sha512-w1aiOKwKuRgtwAReIIj89puqg+I7GvX4IbLrvmhXbzQsj1+Zwi4VO3+fa6ZF91TWSjIxoEkKnMeHcLEODK5ZXA==}
     engines: {node: '>= 0.4'}
 
-  side-channel-list@1.0.0:
-    resolution: {integrity: sha512-FCLHtRD/gnpCiCHEiJLOwdmFP+wzCmDEkc9y7NsYxeF4u7Btsn1ZuwgwJGxImImHicJArLP4R0yX4c2KCrMrTA==}
+  side-channel-list@1.0.1:
+    resolution: {integrity: sha512-mjn/0bi/oUURjc5Xl7IaWi/OJJJumuoJFQJfDDyO46+hBWsfaVM65TBHq2eoZBhzl9EchxOijpkbRC8SVBQU0w==}
     engines: {node: '>= 0.4'}
 
   side-channel-map@1.0.1:
@@ -4878,8 +4864,8 @@ packages:
     resolution: {integrity: sha512-WPS/HvHQTYnHisLo9McqBHOJk2FkHO/tlpvldyrnem4aeQp4hai3gythswg6p01oSoTl58rcpiFAjF2br2Ak2A==}
     engines: {node: '>= 0.4'}
 
-  side-channel@1.1.0:
-    resolution: {integrity: sha512-ZX99e6tRweoUXqR+V
```

#### Recent Merged Pull Requests:
- **PR #1249** (2026-09-30): fix(oauth): restore discovery state for authorization callbacks (@samanhappy)
- **PR #1247** (2026-09-30): docs(contributing): replace scripts and files that do not exist (@Bdysj)
- **PR #1246** (2026-09-30): test(mcp): verify modern routing header compatibility (@samanhappy)
- **PR #1245** (2026-09-30): feat(mcp): decouple stateful tools from downstream sessions (@samanhappy)
- **PR #1244** (2026-09-30): docs(config): align env loading order and USE_DAO_LAYER with the code (@Bdysj)
- **PR #1243** (2026-09-30): fix(config): expand environment variables in a single pass (@Bdysj)
- **PR #1240** (2026-09-30): fix(servers): move prefixed tool and prompt toggles to the new name when a server is renamed (@SelfRef)
- **PR #1238** (2026-09-30): feat(smart-routing): pin chosen tools of a group next to the meta-tools on its $smart endpoint (@SelfRef)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
