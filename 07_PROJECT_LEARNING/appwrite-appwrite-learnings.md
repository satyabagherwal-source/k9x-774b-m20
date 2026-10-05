# Forensic Learning Record (Deep Inspection): appwrite/appwrite

> **Canonical Artifact**: `07_PROJECT_LEARNING/appwrite-appwrite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/appwrite/appwrite](https://github.com/appwrite/appwrite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:16:25.720Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `appwrite/appwrite`
- **Description**: Appwrite® - complete cloud infrastructure for your web, mobile and AI apps. Including Auth, Databases, Storage, Functions, Messaging, Hosting, Realtime and more
- **Primary Language / Ecosystem**: PHP
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 57575 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/views/install/installer/js/modules/state.js`
```
(() => {
    const {
        getBodyDataset,
        isUpgradeMode,
        getLockedDatabase
    } = window.InstallerStepsContext || {};

    const INSTALL_LOCK_KEY = 'appwrite-install-lock';
    const INSTALL_ID_KEY = 'appwrite-install-id';
    const INSTALL_LOCK_LOCAL_KEY = 'appwrite-install-lock-backup';
    const INSTALL_ID_LOCAL_KEY = 'appwrite-install-id-backup';

    const formState = {
        appDomain: null,
        database: null,
        httpPort: null,
        httpsPort: null,
        emailCertificates: null,
        forceHttps: null,
        opensslKey: null,
        assistantOpenAIKey: null,
        topology: null,
        accountName: null,
        accountEmail: null,
        accountPassword: null
    };

    const dispatchStateChange = (key) => {
        if (!key || typeof document === 'undefined') return;
        try {
            document.dispatchEvent(new CustomEvent('installer:state-change', {
                detail: { key, value: formState[key] }
            }));
        } catch (error) {}
    };

    const setStateIfEmpty = (key, value) => {
        if (value === null || value === undefined || value === '') return;
        if (formState[key] === null || formState[key] === undefined || formState[key] === '') {
            formState[key] = value;
        }
    };

    const applyBodyDefaults = () => {
        const data = getBodyDataset?.() ?? {};
        setStateIfEmpty('appDomain', data.defaultAppDomain);
        setStateIfEmpty('httpPort', data.defaultHttpPort);
        setStateIfEmpty('httpsPort', data.defaultHttpsPort);
        setStateIfEmpty('emailCertificates', data.defaultEmailCertificates);
        setStateIfEmpty('forceHttps', data.defaultForceHttps === 'true');
        setStateIfEmpty('opensslKey', data.defaultSecretKey);
        setStateIfEmpty('assistantOpenAIKey', data.defaultAssistantOpenaiKey);
        if (data.lockedDatabase) {
            formState.database = data.lockedDatabase;
        }
        if (data.topology === 'combined' || data.topology === 'separate') {
            setStateIfEmpty('topology', data.topology);
        }
        if (!isUpgradeMode?.()) {
            setStateIfEmpty('database', data.defaultDatabase);
        }
    };

    const getInstallLock = () => {
        try {
            const raw = sessionStorage.getItem(INSTALL_LOCK_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (error) {}

        try {
            const raw = localStorage.getItem(INSTALL_LOCK_LOCAL_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    sessionStorage.setItem(INSTALL_LOCK_KEY, raw);
                    return parsed;
                }
            }
        } catch (error) {}

        return null;
    };

    const setInstallLock = (installId, payload) => {
        const sanitizedPayload = payload ? { ...payload } : null;
        if (sanitizedPayload) {
            delete sanitizedPayload.opensslKey;
            delete sanitizedPayload.accountPassword;
            delete sanitizedPayload.assistantOpenAIKey;
        }
        const lock = {
            installId,
            payload: sanitizedPayload,
            startedAt: Date.now()
        };
        try {
            sessionStorage.setItem(INSTALL_LOCK_KEY, JSON.stringify(lock));
        } catch (error) {}
        try {
            localStorage.setItem(INSTALL_LOCK_LOCAL_KEY, JSON.stringify(lock));
        } catch (error) {}
        if (document.body) {
            document.body.dataset.installLocked = 'true';
        }
        return lock;
    };

    const clearInstallLock = () => {
        try {
            sessionStorage.removeItem(INSTALL_LOCK_KEY);
        } catch (error) {}
        try {
            localStorage.removeItem(INSTALL_LOCK_LOCAL_KEY);
        } catch (error) {}
        if (document.body) {
            delete document.body.dataset.installLocked;
        }
    };

    const isInstallLocked = () => {
        return Boolean(getInstallLock());
    };

    const syncInstallLockFlag = () => {
        if (!document.body) return;
        if (isInstallLocked()) {
            document.body.dataset.installLocked = 'true';
        } else {
            delete document.body.dataset.installLocked;
        }
    };

    const applyLockPayload = () => {
        const lock = getInstallLock();
        if (!lock || !lock.payload) return;
        const payload = lock.payload;
        setStateIfEmpty('appDomain', payload.appDomain);
        setStateIfEmpty('database', payload.database);
        setStateIfEmpty('httpPort', payload.httpPort);
        setStateIfEmpty('httpsPort', payload.httpsPort);
        setStateIfEmpty('emailCertificates', payload.emailCertificates);
        setStateIfEmpty('forceHttps', payload.forceHttps);
        setStateIfEmpty('accountEmail', payload.accountEmail);
    };

    const getStoredInstallId = () => {
        try {
            const val = sessionStorage.getItem(INSTALL_ID_KEY);
            if (val) return val;
        } catch (error) {}
        try {
            return localStorage.getItem(INSTALL_ID_LOCAL_KEY);
        } catch (error) {}
        return null;
    };

    const storeInstallId = (installId) => {
        try {
            sessionStorage.setItem(INSTALL_ID_KEY, installId);
        } catch (error) {}
        try {
            localStorage.setItem(INSTALL_ID_LOCAL_KEY, installId);
        } catch (error) {}
    };

    const clearInstallId = () => {
        try {
            sessionStorage.removeItem(INSTALL_ID_KEY);
        } catch (error) {}
        try {
            localStorage.removeItem(INSTALL_ID_LOCAL_KEY);
        } catch (error) {}
    };

    window.InstallerStepsState = {
        formState,
        dispatchStateChange,
        setStateIfEmpty,
        applyBodyDefaults,
        applyLockPayload,
        getInstallLock,
        setInstallLock,
        clearInstallLock,
        isInstallLocked,
        syncInstallLockFlag,
        getStoredInstallId,
        storeInstallId,
        clearInstallId,
        getLockedDatabase: getLockedDatabase || (() => '')
    };
})();

```

### Core Architecture Module: `app/views/install/installer/js/constants.js`
```
(() => {
    window.InstallerConstants = Object.freeze({
        stepTransitionMs: 260,
        errorClearMs: 180,
        installPollIntervalMs: 4000,
        installFallbackDelayMs: 12000,
        redirectDelayMs: 2500,
        progressTransitionDelayMs: 320,
        progressCompleteDelayMs: 140,
    });
})();

```

### Core Architecture Module: `app/views/install/installer/js/installer.js`
```
(() => {
    const stepContainer = document.querySelector('.installer-step');
    const installerCard = document.querySelector('.installer-card');
    const backButton = document.querySelector('[data-action="back"]');
    const nextButton = document.querySelector('[data-action="next"]');
    const installScreen = document.querySelector('.install-screen-content');
    const indicatorNodes = Array.from(document.querySelectorAll('.step-indicator'));
    const STEP_TRANSITION_TIMEOUT = window.InstallerConstants?.stepTransitionMs ?? 260;

    if (!stepContainer || !installerCard) return;

    const { validateInstallRequest } = window.InstallerStepsProgress || {};

    const isUpgrade = document.body?.dataset.upgrade === 'true';
    const stepFlow = isUpgrade ? [1, 6, 4, 5] : [1, 2, 3, 4, 5];
    const cardSteps = stepFlow.filter((step) => step !== 5);

    const normalizeStep = (step) => {
        const numeric = clampStep(step);
        if (stepFlow.includes(numeric)) return numeric;
        if (numeric <= stepFlow[0]) return stepFlow[0];
        for (let i = 0; i < stepFlow.length; i += 1) {
            if (numeric < stepFlow[i]) {
                return stepFlow[i];
            }
        }
        return stepFlow[stepFlow.length - 1];
    };

    const buildStepConfig = () => {
        const config = {};
        stepFlow.forEach((step, index) => {
            if (step === 5) {
                config[step] = { back: { target: null }, next: { target: null } };
                return;
            }
            const prev = stepFlow[index - 1] ?? null;
            const next = stepFlow[index + 1] ?? null;
            const label = next === 5 ? (isUpgrade ? 'Update' : 'Install') : 'Next';
            config[step] = {
                back: { target: prev },
                next: { label, target: next }
            };
        });
        return config;
    };

    const STEP_CONFIG = buildStepConfig();

    const stepCache = new Map();
    const stepHeights = new Map();
    let isTransitioning = false;
    let pendingStep = null;
    let pendingPushState = false;

    const clampStep = (step) => Math.max(1, Math.min(6, step));
    const isInstallLocked = () => Boolean(window.InstallerSteps?.isInstallLocked?.());

    const scrollToFirstError = (panel) => {
        if (!panel) return;
        const getErrorNode = () => panel.querySelector('.field-error.is-visible')
            || panel.querySelector('.field-error')
            || panel.querySelector('.input-field.is-error, .input-action.is-error');
        const container = panel.closest('.step-panel') || panel;
        const attemptScroll = () => {
            const target = getErrorNode();
            if (!target || typeof target.getBoundingClientRect !== 'function') return false;
            const targetRect = target.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const targetTop = targetRect.top - containerRect.top + container.scrollTop;
            const targetBottom = targetTop + targetRect.height;
            const viewTop = container.scrollTop;
            const viewBottom = viewTop + containerRect.height;
            const padding = 12;

            let nextScrollTop = viewTop;
            if (targetTop < viewTop + padding) {
                nextScrollTop = Math.max(0, targetTop - padding);
            } else if (targetBottom > viewBottom - padding) {
                nextScrollTop = Math.max(0, targetBottom - containerRect.height + padding);
            }

            if (Math.abs(nextScrollTop - viewTop) < 1) {
                return false;
            }

            container.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
            return true;
        };

        let remaining = 20;
        let lastScrollTop = -1;
        const settle = () => {
            if (remaining <= 0) return;
            const moved = attemptScroll();
            remaining -= 1;
            const currentTop = container.scrollTop;
            const delta = Math.abs(currentTop - lastScrollTop);
            lastScrollTop = currentTop;
            if (!moved && delta < 0.5) {
                return;
            }
            requestAnimationFrame(settle);
        };
        requestAnimationFrame(settle);
    };

    const getStepFromUrl = () => {
        const url = new URL(window.location.href);
        const step = Number(url.searchParams.get('step') || 1);
        return normalizeStep(Number.isNaN(step) ? 1 : step);
    };

    const buildStepUrl = (step) => {
        const url = new URL(window.location.href);
        url.searchParams.set('step', step);
        return url;
    };

    const setStepInUrl = (step, pushState) => {
        const url = new URL(window.location.href);
        url.searchParams.set('step', step);

        if (pushState) {
            window.history.pushState({ step }, '', url.toString());
        }

        return url;
    };

    const updateActionBar = (step) => {
        const config = STEP_CONFIG[step] || STEP_CONFIG[1];
        if (!backButton || !nextButton) return;
        const locked = isInstallLocked();

        const setButtonLabel = (button, label) => {
            if (!button) return;
            let text = button.querySelector('.button-text');
            if (!text) {
                text = document.createElement('span');
                text.className = 'button-text typography-text-m-500';
                button.textContent = '';
                button.appendChild(text);
            }
            text.textContent = label;
        };

        if (!locked && config.back?.target) {
            backButton.disabled = false;
            backButton.setAttribute('data-step-target', String(config.back.target));
        } else {
            backButton.disabled = true;
            backButton.removeAttribute('data-step-target');
        }
        setButtonLabel(backButton, 'Back');

        if (!locked && config.next?.target) {
            setButtonLabel(nextButton, config.next?.label || 'Next');
            nextButton.setAttribute('data-step-target', String(config.next?.target || 1));
            nextButton.disabled = false;
        } else {
            setButtonLabel(nextButton, config.next?.label || 'Next');
            nextButton.removeAttribute('data-step-target');
            nextButton.disabled = true;
        }

        indicatorNodes.forEach((node, index) => {
            const isVisible = index < cardSteps.length;
            node.classList.toggle('is-hidden', !isVisible);
            if (!isVisible) {
                node.classList.remove('is-active');
                return;
            }
            node.classList.toggle('is-active', cardSteps[index] === step);
        });

        installerCard.setAttribute('data-step', String(step));
        document.body.dataset.step = String(step);
        if (locked) {
            document.body.dataset.installLocked = 'true';
        } else {
            delete document.body.dataset.installLocked;
        }
    };

    // Each step is remembered on its own rather than folded into a running maximum. A
    // single tall step used to set the floor for every other one, so the short ones -- the
    // review in particular -- carried its leftover height as dead space.
    const recordStepHeight = (panel, step) => {
        if (!panel || step == null) return;
        const height = panel.getBoundingClientRect().height;
        if (!height) return;
        stepHeights.set(Number(step), height);
    };

    const applyStepHeight = (step) => {
        const height = stepHeights.get(Number(step));
        if (!height) return;
        stepContainer.style.setProperty('--step-min-height', `${height}px`);
    };

    const measureStepHeight = (panel, step) => {
        recordStepHeight(panel, step);
        applyStepHeight(step);
    };

    const runStepInit = (step, rootElement) => {
        if (!window.InstallerSteps || typeof window.InstallerSteps.initStep !== 'function') return;
        const root = rootElement || stepContainer;
        window.InstallerSteps.initStep(step, root);
        updateActionBar(step);
    };

    const fetchStepHtml = (step, url) => {
        if (stepCache.has(step)) {
            return Promise.resolve(stepCache.get(step));
        }

        const fetchUrl = new URL(url);
        fetchUrl.searchParams.set('partial', '1');

        return fetch(fetchUrl.toString(), {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to load step');
                }
                return response.text();
            })
            .then((html) => {
                stepCache.set(step, html);
                return html;
            });
    };

    const preloadSteps = (steps) => {
        const current = getStepFromUrl();
        const targets = steps.filter((step) => step !== current);

        return Promise.all(
            targets.map((step) => {
                const url = buildStepUrl(step);
                return fetchStepHtml(step, url)
                    .then((html) => {
                        const panel = document.createElement('div');
                        panel.className = 'step-panel is-measure';
                        panel.innerHTML = html;
                        stepContainer.appendChild(panel);
                        panel.getBoundingClientRect();
                        recordStepHeight(panel, step);
                        panel.remove();
                    })
                    .catch(() => null);
            })
        );
    };

    const swapPanels = (step, html, onDone) => {
        const activePanel = stepContainer.querySelector('.step-panel');

        const measurePanel = document.createElement('div');
        measurePanel.className = 'step-panel is-measure';
        measurePanel.innerHTML = html;
        stepContainer.appendChild(measureP
```

### Core Architecture Module: `app/views/install/installer/js/modules/context.js`
```
(() => {
    const getBodyDataset = () => document.body?.dataset ?? {};
    const isUpgradeMode = () => getBodyDataset().upgrade === 'true';
    const getLockedDatabase = () => getBodyDataset().lockedDatabase || '';
    const getTopology = () => {
        const topology = getBodyDataset().topology || 'combined';
        return topology === 'separate' ? 'separate' : 'combined';
    };
    const getEnabledDatabases = () => {
        const raw = getBodyDataset().enabledDatabases;
        if (!raw) return ['postgresql', 'mariadb', 'mongodb'];
        try { return JSON.parse(raw); } catch (e) { return ['postgresql', 'mariadb', 'mongodb']; }
    };

    const STEP_IDS = Object.freeze({
        CONFIG_FILES: 'config-files',
        DOCKER_COMPOSE: 'docker-compose',
        ENV_VARS: 'env-vars',
        DOCKER_CONTAINERS: 'docker-containers',
        ACCOUNT_SETUP: 'account-setup',
        MIGRATION: 'migration',
        SSL_CERTIFICATE: 'ssl-certificate',
        REDIRECT: 'redirect'
    });

    const STATUS = Object.freeze({
        IN_PROGRESS: 'in-progress',
        COMPLETED: 'completed',
        ERROR: 'error'
    });

    const SSE_EVENTS = Object.freeze({
        PING: 'ping',
        INSTALL_ID: 'install-id',
        PROGRESS: 'progress',
        DONE: 'done',
        ERROR: 'error'
    });

    const buildInstallationSteps = (upgrade) => (upgrade ? [
        {
            id: STEP_IDS.CONFIG_FILES,
            inProgress: 'Updating configuration files...',
            done: 'Configuration files updated'
        },
        {
            id: STEP_IDS.DOCKER_COMPOSE,
            inProgress: 'Updating Docker Compose file...',
            done: 'Docker Compose file updated'
        },
        {
            id: STEP_IDS.ENV_VARS,
            inProgress: 'Updating environment variables...',
            done: 'Environment variables updated'
        },
        {
            id: STEP_IDS.DOCKER_CONTAINERS,
            inProgress: 'Restarting Docker containers...',
            done: 'Docker containers restarted'
        },
        {
            id: STEP_IDS.MIGRATION,
            inProgress: 'Running database migration...',
            done: 'Database migration completed'
        }
    ] : [
        {
            id: STEP_IDS.CONFIG_FILES,
            inProgress: 'Creating configuration files...',
            done: 'Configuration files created'
        },
        {
            id: STEP_IDS.DOCKER_COMPOSE,
            inProgress: 'Generating Docker Compose file...',
            done: 'Docker Compose file generated'
        },
        {
            id: STEP_IDS.ENV_VARS,
            inProgress: 'Configuring environment variables...',
            done: 'Environment variables configured'
        },
        {
            id: STEP_IDS.DOCKER_CONTAINERS,
            inProgress: 'Starting Docker containers...',
            done: 'Docker containers started'
        },
        {
            id: STEP_IDS.ACCOUNT_SETUP,
            inProgress: 'Creating Appwrite account...',
            done: 'Appwrite account created'
        }
    ]);

    const INSTALLATION_STEPS = buildInstallationSteps(isUpgradeMode());
    const CONSTANTS = window.InstallerConstants || {};
    const TIMINGS = {
        errorClear: CONSTANTS.errorClearMs ?? 180,
        installPollInterval: CONSTANTS.installPollIntervalMs ?? 4000,
        installFallbackDelay: CONSTANTS.installFallbackDelayMs ?? 12000,
        redirectDelay: CONSTANTS.redirectDelayMs ?? 500,
        progressTransitionDelay: CONSTANTS.progressTransitionDelayMs ?? 140,
        progressCompleteDelay: CONSTANTS.progressCompleteDelayMs ?? 120
    };

    const clampStep = (step) => {
        const numeric = Number(step);
        if (Number.isNaN(numeric)) return 1;
        return Math.max(1, Math.min(6, numeric));
    };

    window.InstallerStepsContext = Object.freeze({
        getBodyDataset,
        isUpgradeMode,
        getLockedDatabase,
        getTopology,
        getEnabledDatabases,
        STEP_IDS,
        STATUS,
        SSE_EVENTS,
        INSTALLATION_STEPS,
        TIMINGS,
        clampStep
    });
})();

```

### Core Architecture Module: `app/views/install/installer/js/modules/progress.js`
```
(() => {
    const {
        INSTALLATION_STEPS,
        TIMINGS,
        getBodyDataset,
        isUpgradeMode,
        STEP_IDS,
        STATUS,
        SSE_EVENTS
    } = window.InstallerStepsContext;
    const {
        formState,
        applyLockPayload,
        applyBodyDefaults,
        setInstallLock,
        getInstallLock,
        clearInstallLock,
        isInstallLocked,
        syncInstallLockFlag,
        getStoredInstallId,
        storeInstallId,
        clearInstallId
    } = window.InstallerStepsState || {};
    const { extractHostname, isLocalHost, isIPAddress } = window.InstallerStepsValidation || {};
    const { generateSecretKey } = window.InstallerStepsUI || {};
    const { showToast } = window.InstallerToast || {};

    let activeInstall = null;
    let unloadGuard = null;
    let sseSessionDetails = null;
    const csrfToken = document.querySelector('meta[name="appwrite-installer-csrf"]')?.getAttribute('content') || '';

    const installerSecret = (() => {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('secret') || '';
        if (fromQuery) {
            try {
                sessionStorage.setItem('appwrite-installer-secret', fromQuery);
            } catch (error) {
                // ignore quota / private-mode failures
            }
            params.delete('secret');
            const query = params.toString();
            const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
            history.replaceState({}, '', next);
            return fromQuery;
        }
        try {
            return sessionStorage.getItem('appwrite-installer-secret') || '';
        } catch (error) {
            return '';
        }
    })();

    const withCsrfHeader = (headers = {}) => {
        const next = { ...headers };
        if (csrfToken) {
            next['X-Appwrite-Installer-CSRF'] = csrfToken;
        }
        if (installerSecret) {
            next['X-Appwrite-Installer-Secret'] = installerSecret;
        }
        return next;
    };

    const showCsrfToast = () => {
        showToast?.({
            status: 'error',
            title: 'Session expired',
            description: 'Refresh the page and try again.',
            dismissible: true
        });
    };

    const showSecretToast = () => {
        showToast?.({
            status: 'error',
            title: 'Installer secret required',
            description: 'Open the URL printed in the installer terminal, or add ?secret= from STDOUT.',
            dismissible: true
        });
    };

    const validateInstallRequest = async () => {
        try {
            const response = await fetch('/install/validate', {
                method: 'POST',
                headers: withCsrfHeader({
                    'Content-Type': 'application/json'
                })
            });
            if (response.status === 401) {
                showSecretToast();
                return false;
            }
            if (!response.ok) {
                showCsrfToast();
                return false;
            }
            const data = await response.json().catch(() => ({}));
            if (!data?.success) {
                showCsrfToast();
                return false;
            }
            return true;
        } catch (error) {
            showCsrfToast();
            return false;
        }
    };

    const setUnloadGuard = (enabled) => {
        if (!enabled && unloadGuard) {
            window.removeEventListener('beforeunload', unloadGuard);
            unloadGuard = null;
            return;
        }

        if (enabled && !unloadGuard) {
            unloadGuard = (event) => {
                event.preventDefault();
                event.returnValue = '';
                return '';
            };
            window.addEventListener('beforeunload', unloadGuard);
        }
    };

    const cleanupInstallFlow = () => {
        if (activeInstall?.controller) {
            activeInstall.controller.abort();
            if (activeInstall.pollTimer) {
                clearInterval(activeInstall.pollTimer);
            }
            if (activeInstall.fallbackTimer) {
                clearTimeout(activeInstall.fallbackTimer);
            }
            activeInstall = null;
        }
        stopSyncedSpinnerRotation();
        setUnloadGuard(false);
    };

    const getStepDefinition = (id) => INSTALLATION_STEPS.find((step) => step.id === id);

    const getProgressLabel = (step, status, message) => {
        if (!step) return message || '';
        if (status === STATUS.ERROR) {
            const normalized = normalizeInstallError(message || '');
            return normalized.summary || 'Installation failed.';
        }
        if (status === STATUS.COMPLETED) return step.done;
        return message || step.inProgress;
    };

    const updateInstallRow = (row, step, status, message, details) => {
        if (!row || !step) return;
        row.dataset.status = status;
        row.dataset.step = step.id;
        if (status !== STATUS.ERROR) {
            row.classList.remove('is-open');
            const toggle = row.querySelector('[data-install-toggle]');
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
            }
        }
        const label = getProgressLabel(step, status, message);
        const text = row.querySelector('[data-install-text]');
        if (text) {
            if (text.textContent !== label) {
                text.classList.remove('is-enter');
                text.textContent = label;
                text.classList.add('is-enter');
                requestAnimationFrame(() => {
                    text.classList.remove('is-enter');
                });
            }
        }

        const counter = row.querySelector('[data-install-counter]');
        if (counter) {
            const started = details?.containerStarted ?? 0;
            const total = details?.containerTotal;
            counter.textContent = (status === STATUS.IN_PROGRESS && total > 0 && started < total)
                ? `${started}/${total}`
                : '';
        }

        // Show/hide "Navigate to Console" button for account setup errors
        const consoleBtn = row.querySelector('[data-install-console]');
        if (consoleBtn) {
            const shouldShow = step.id === STEP_IDS.ACCOUNT_SETUP && status === STATUS.ERROR;
            consoleBtn.classList.toggle('is-hidden', !shouldShow);
        }
    };

    const normalizeInstallError = (message) => {
        const text = String(message || '').trim();
        if (!text) {
            return { summary: '', details: '' };
        }
        const colonIndex = text.indexOf(':');
        if (colonIndex > 0 && colonIndex < 80) {
            const summary = text.slice(0, colonIndex).trim();
            const details = text.slice(colonIndex + 1).trim();
            return { summary, details };
        }
        if (text.length > 180) {
            return { summary: text.slice(0, 180).trim() + '…', details: text };
        }
        return { summary: text, details: '' };
    };

    let spinnerAnimationFrame = null;
    const stopSyncedSpinnerRotation = () => {
        if (spinnerAnimationFrame) {
            cancelAnimationFrame(spinnerAnimationFrame);
            spinnerAnimationFrame = null;
        }
    };

    const startSyncedSpinnerRotation = (container) => {
        stopSyncedSpinnerRotation();
        if (!container) return;
        let startTime = null;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const rotation = ((elapsed / 1000) * 360 * 1.5) % 360;
            container.style.setProperty('--spinner-rotation', `${rotation}deg`);
            spinnerAnimationFrame = requestAnimationFrame(animate);
        };
        spinnerAnimationFrame = requestAnimationFrame(animate);
    };

    const updateInstallErrorDetails = (row, error) => {
        if (!row) return;
        const traceNode = row.querySelector('[data-install-trace]');
        const normalized = normalizeInstallError(error?.message || '');
        const output = error?.output || '';
        const trace = error?.trace || '';
        const detailChunks = [];
        if (normalized.details) detailChunks.push(normalized.details);
        if (output) detailChunks.push(output);
        if (trace) detailChunks.push(trace);
        const detailText = detailChunks.join('\n\n');

        if (traceNode) {
            traceNode.textContent = detailText;
            traceNode.style.display = detailText ? 'block' : 'none';
        }
    };

    const createInstallRow = (template, step) => {
        const fragment = template.content.cloneNode(true);
        const row = fragment.querySelector('.install-row');
        if (!row) return null;
        const toggle = row.querySelector('[data-install-toggle]');
        const setOpenState = (isOpen) => {
            row.classList.toggle('is-open', isOpen);
            if (toggle) {
                toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            }
        };
        const toggleRow = () => {
            if (!row.dataset.status || row.dataset.status !== STATUS?.ERROR) {
                return;
            }
            setOpenState(!row.classList.contains('is-open'));
        };
        row.addEventListener('click', (event) => {
            if (event.target.closest('[data-install-retry]')) {
                return;
            }
            if (event.target.closest('[data-install-toggle]')) {
                return;
            }
            if (event.target.closest('.install-row-details')) {
                return;
            }
            toggleRow();
        });
        if (toggle) {
            toggle.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleRow()
```

### Core Architecture Module: `app/views/install/installer/js/modules/toast.js`
```
(() => {
    const TOAST_STACK_ID = 'installer-toast-stack';
    const DEFAULT_TIMEOUT = 5000;
    const MAX_TOASTS = 3;
    const ICONS = {
        error: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0m-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1" clip-rule="evenodd"/></svg>',
        close: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L10 8.586l3.293-3.293a1 1 0 1 1 1.414 1.414L11.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414L10 11.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L8.586 10 5.293 6.707a1 1 0 0 1 0-1.414" clip-rule="evenodd"/></svg>'
    };

    const getStack = () => document.getElementById(TOAST_STACK_ID);

    const dismissToast = (toast) => {
        if (!toast) return;
        if (toast.classList.contains('is-leaving')) return;
        toast.classList.add('is-leaving');
        const remove = () => toast.remove();
        toast.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 450);
    };

    const showToast = ({
        title = '',
        description = '',
        status = 'error',
        dismissible = true,
        timeout = DEFAULT_TIMEOUT
    } = {}) => {
        const stack = getStack();
        if (!stack) return;
        const visibleToasts = Array.from(
            stack.querySelectorAll('.installer-toast:not(.is-leaving)')
        );
        if (visibleToasts.length >= MAX_TOASTS) {
            dismissToast(visibleToasts[0]);
        }

        const toast = document.createElement('div');
        toast.className = 'installer-toast is-entering';
        toast.dataset.status = status;
        toast.setAttribute('role', status === 'error' ? 'alert' : 'status');

        const content = document.createElement('div');
        content.className = 'installer-toast-content';

        const icon = document.createElement('span');
        icon.className = 'installer-toast-icon';
        icon.dataset.status = status;
        icon.innerHTML = ICONS.error;
        content.appendChild(icon);

        const body = document.createElement('section');
        body.className = 'installer-toast-body';

        if (title) {
            const titleNode = document.createElement('p');
            titleNode.className = 'installer-toast-title typography-text-m-500';
            titleNode.textContent = title;
            body.appendChild(titleNode);
        }

        if (description) {
            const descNode = document.createElement('p');
            descNode.className = 'installer-toast-description typography-text-m-400';
            descNode.textContent = description;
            body.appendChild(descNode);
        }

        content.appendChild(body);
        toast.appendChild(content);

        if (dismissible) {
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'installer-toast-close';
            close.setAttribute('aria-label', 'Dismiss notification');
            close.innerHTML = ICONS.close;
            close.addEventListener('click', () => dismissToast(toast));
            toast.appendChild(close);
        }

        stack.appendChild(toast);
        toast.getBoundingClientRect();
        requestAnimationFrame(() => {
            toast.classList.remove('is-entering');
        });

        if (timeout > 0) {
            setTimeout(() => dismissToast(toast), timeout);
        }
    };

    window.InstallerToast = Object.freeze({
        showToast
    });
})();

```

### Core Architecture Module: `app/views/install/installer/js/modules/ui.js`
```
(() => {
    const { TIMINGS } = window.InstallerStepsContext || {};
    const { formState } = window.InstallerStepsState || {};

    const clearFieldErrors = (root) => {
        if (!root) return;
        root.querySelectorAll('.field-error').forEach((node) => {
            node.classList.remove('is-visible');
        });
        root.querySelectorAll('.input-field.is-error, .input-action.is-error').forEach((node) => {
            node.classList.remove('is-error');
        });
        root.querySelectorAll('.field-helper').forEach((helper) => {
            helper.style.display = '';
        });
    };

    const setFieldError = (input, message) => {
        if (!input) return;
        const group = input.closest('.input-group');
        if (!group) return;
        let error = group.querySelector('.field-error');
        let errorText = error?.querySelector('.field-error-text');
        const hasSameMessage = Boolean(errorText && errorText.textContent === message);
        const alreadyVisible = Boolean(error && error.classList.contains('is-visible'));

        if (hasSameMessage && alreadyVisible) {
            return;
        }

        if (!error) {
            const template = document.getElementById('field-error-template');
            if (template && template.content) {
                const fragment = template.content.cloneNode(true);
                error = fragment.querySelector('.field-error');
                group.appendChild(fragment);
            }
            errorText = error?.querySelector('.field-error-text');
        }
        if (errorText) {
            errorText.textContent = message;
        }

        if (!alreadyVisible) {
            requestAnimationFrame(() => {
                error.classList.add('is-visible');
            });
        }

        input.classList.add('is-error');
        const actionWrapper = input.closest('.input-action');
        if (actionWrapper) {
            actionWrapper.classList.add('is-error');
        }
        const helper = group.querySelector('.field-helper');
        if (helper) {
            helper.style.display = 'none';
        }
    };

    const bindErrorClear = (input) => {
        if (!input) return;
        const handler = () => {
            const group = input.closest('.input-group');
            const error = group?.querySelector('.field-error');
            if (error) {
                error.classList.remove('is-visible');
            }
            input.classList.remove('is-error');
            const actionWrapper = input.closest('.input-action');
            if (actionWrapper) {
                actionWrapper.classList.remove('is-error');
            }
            const helper = group?.querySelector('.field-helper');
            if (helper) {
                helper.style.display = '';
            }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    };

    const toDatabaseLabel = (value) => {
        if (!value) return '';
        const lower = value.toLowerCase();
        if (lower === 'mariadb') return 'MariaDB';
        if (lower === 'postgresql') return 'PostgreSQL';
        return 'MongoDB';
    };

    const updateDatabaseSelection = (radio, root) => {
        if (!radio || !root) return;
        const group = radio.closest('.selector-group') || root;
        const allOptions = group.querySelectorAll('.selector-card');
        allOptions.forEach((option) => option.classList.remove('selected'));
        const selectedOption = radio.closest('.selector-card');
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    };

    const syncResetButton = (input, button) => {
        const defaultValue = input.dataset.default ?? '';
        button.disabled = input.value === defaultValue;
    };

    const setupResetButtons = (root) => {
        const inputs = root.querySelectorAll('.input-field[data-default]');
        inputs.forEach((input) => {
            const button = root.querySelector(`[data-reset-target="${input.id}"]`);
            if (!button) return;

            syncResetButton(input, button);

            input.addEventListener('input', () => syncResetButton(input, button));
            button.addEventListener('click', () => {
                input.value = input.dataset.default ?? '';
                syncResetButton(input, button);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
    };

    const toggleAccordion = (button) => {
        const content = button.nextElementSibling;
        const icon = button.querySelector('.accordion-chevron');
        const isOpen = button.classList.contains('is-open');

        button.classList.toggle('is-open', !isOpen);
        button.setAttribute('aria-expanded', String(!isOpen));

        if (content) {
            if (!isOpen) {
                content.classList.add('open');
                content.style.maxHeight = `${content.scrollHeight}px`;
            } else {
                content.style.maxHeight = '0px';
                content.classList.remove('open');
            }
        }

        if (icon) {
            icon.setAttribute('data-open', String(!isOpen));
        }
    };

    const setupAccordion = (root) => {
        const buttons = root.querySelectorAll('.accordion-toggle');
        buttons.forEach((button) => {
            button.addEventListener('click', () => toggleAccordion(button));
        });
    };

    const openAccordion = (root) => {
        const toggle = root.querySelector('.accordion-toggle');
        const content = root.querySelector('.accordion-content');
        if (!toggle || !content) return;
        if (!toggle.classList.contains('is-open')) {
            toggle.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            content.classList.add('open');
            content.style.maxHeight = `${content.scrollHeight}px`;
        }
    };

    const disableControls = (root) => {
        const inputs = root.querySelectorAll('input, select, textarea');
        inputs.forEach((input) => {
            if (input.type === 'radio' || input.type === 'checkbox') {
                input.disabled = true;
            } else {
                input.readOnly = true;
                input.setAttribute('aria-disabled', 'true');
            }
        });

        const buttons = root.querySelectorAll('button');
        buttons.forEach((button) => {
            if (button.matches('[data-copy-target]')) return;
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
        });

        root.classList.add('is-locked');
    };

    const generateSecretKey = () => {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    };

    const copyToClipboard = (value, input) => {
        if (!value) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value);
            return;
        }
        if (input) {
            input.select();
            document.execCommand('copy');
            input.setSelectionRange(0, 0);
            return;
        }
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (error) {} finally {
            document.body.removeChild(textArea);
        }
    };

    const setTooltipText = (wrapper, message) => {
        if (!wrapper) return;
        const tooltip = wrapper.querySelector('.tooltip');
        if (tooltip && message) {
            tooltip.textContent = message;
        }
    };

    const resetTooltipText = (wrapper) => {
        if (!wrapper) return;
        const defaultText = wrapper.dataset.tooltipDefault;
        if (!defaultText) return;
        setTooltipText(wrapper, defaultText);
    };

    const updateReviewSummary = (root) => {
        if (!root) return;
        const valueNodes = root.querySelectorAll('[data-review-value]');
        valueNodes.forEach((node) => {
            const key = node.dataset.reviewValue;
            if (!key) return;
            let value = formState?.[key];
            if (key === 'database') {
                value = toDatabaseLabel(formState?.database);
            }
            if (value) {
                node.textContent = value;
            }
        });

        // Nothing entered and no account email to borrow: shown as a tag, the way the
        // other absent settings on this panel are, rather than an empty row.
        const emailNode = root.querySelector('[data-review-value="emailCertificates"]');
        if (emailNode) {
            const email = (formState?.emailCertificates || formState?.accountEmail || '').trim();
            emailNode.textContent = email || 'Empty';
            emailNode.classList.toggle('badge', !email);
            emailNode.classList.toggle('badge-neutral', !email);
            emailNode.classList.toggle('typography-text-xs-400', !email);
            emailNode.classList.toggle('typography-text-m-500', Boolean(email));
            emailNode.classList.toggle('text-neutral-primary', Boolean(email));
        }

        const badge = root.querySelector('[data-review-badge]');
        if (badge) {
            const hasKey = Boolean((formState?.opensslKey || '').trim());
            badge.textContent = hasKey ? 'Generated' : 'Missing';
            badge.classList.remove('badge-success', 'badge-warning');
            badge.classList.add(hasKey ? 'badge-success' : 'badge-warning');
        }

        const httpsBadge = root.querySelector('[data-review-https-badge]');
        if (htt
```

### Core Architecture Module: `app/views/install/installer/js/modules/validation.js`
```
(() => {
    const isValidEmail = (email) => {
        if (!email) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const isValidPort = (value) => {
        const numeric = Number(value);
        if (!Number.isInteger(numeric)) return false;
        return numeric >= 1 && numeric <= 65535;
    };

    const isValidPassword = (value) => {
        if (!value) return false;
        return value.length >= 8 && /\S/.test(value);
    };

    const isValidIPv4 = (host) => {
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
        return host.split('.').every((part) => {
            const num = Number(part);
            return num >= 0 && num <= 255;
        });
    };

    const isValidIPv6 = (host) => {
        try {
            const url = new URL(`http://[${host}]`);
            return url.hostname.toLowerCase() === host.toLowerCase();
        } catch (error) {
            return false;
        }
    };

    const isValidHostnameLabel = (label) => {
        if (!label || label.length > 63) return false;
        if (label.startsWith('-') || label.endsWith('-')) return false;
        return /^[a-zA-Z0-9-]+$/.test(label);
    };

    const isValidDomain = (host) => {
        if (host.length > 253) return false;
        const labels = host.split('.');
        return labels.every((label) => isValidHostnameLabel(label));
    };

    const isValidHost = (host) => {
        if (host === 'localhost') return true;
        if (isValidIPv4(host)) return true;
        if (isValidIPv6(host)) return true;
        return isValidDomain(host);
    };

    const isValidHostnameInput = (value) => {
        if (!value) return false;
        const trimmed = value.trim();
        if (!trimmed) return false;

        let host = trimmed;
        let port = null;

        if (trimmed.startsWith('[')) {
            const match = trimmed.match(/^\[([^\]]+)\](?::(\d+))?$/);
            if (!match) return false;
            host = match[1] || '';
            port = match[2] || null;
        } else {
            const parts = trimmed.split(':');
            if (parts.length > 2) return false;
            if (parts.length === 2) {
                // Trailing colon with no digits is an explicit but empty port.
                if (!parts[1]) return false;
                host = parts[0];
                port = parts[1];
            }
        }

        if (port !== null && !isValidPort(port)) {
            return false;
        }

        return isValidHost(host);
    };

    const extractHostname = (value) => {
        if (!value) return '';
        const trimmed = value.trim();
        if (trimmed.startsWith('[')) {
            const end = trimmed.indexOf(']');
            if (end !== -1) {
                return trimmed.slice(1, end);
            }
            return trimmed;
        }
        const colonCount = (trimmed.match(/:/g) || []).length;
        if (colonCount === 1) {
            return trimmed.split(':')[0];
        }
        return trimmed;
    };

    const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

    const isLocalHost = (host) => {
        if (!host) return false;
        const normalized = host.toLowerCase();
        return LOCAL_HOSTS.has(normalized);
    };

    const isIPAddress = (host) => {
        if (!host) return false;
        return isValidIPv4(host) || isValidIPv6(host);
    };

    window.InstallerStepsValidation = {
        isValidEmail,
        isValidPort,
        isValidPassword,
        isValidHostnameInput,
        extractHostname,
        isLocalHost,
        isIPAddress
    };
})();

```

### Core Architecture Module: `app/views/install/installer/js/steps.js`
```
(() => {
    const Context = window.InstallerStepsContext || {};
    const State = window.InstallerStepsState || {};
    const Validation = window.InstallerStepsValidation || {};
    const UI = window.InstallerStepsUI || {};
    const Progress = window.InstallerStepsProgress || {};
    const Tooltips = window.InstallerTooltips || null;

    const {
        INSTALLATION_STEPS,
        clampStep,
        isUpgradeMode,
        getEnabledDatabases,
        getTopology
    } = Context;

    const {
        formState,
        dispatchStateChange,
        applyBodyDefaults,
        applyLockPayload,
        clearInstallLock,
        clearInstallId,
        isInstallLocked,
        syncInstallLockFlag,
        getInstallLock,
        getLockedDatabase
    } = State;

    const {
        isValidEmail,
        isValidPort,
        isValidHostnameInput,
        isValidPassword
    } = Validation;

    const {
        clearFieldErrors,
        setFieldError,
        bindErrorClear,
        updateDatabaseSelection,
        setupResetButtons,
        setupAccordion,
        openAccordion,
        disableControls,
        generateSecretKey,
        copyToClipboard,
        setTooltipText,
        resetTooltipText,
        updateReviewSummary
    } = UI;

    let reviewListener = null;

    const bindInputToState = (input, key) => {
        if (!input) return;
        const update = () => {
            formState[key] = input.value;
            dispatchStateChange?.(key);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        update();
    };

    const bindCheckboxToState = (input, key) => {
        if (!input) return;
        const update = () => {
            formState[key] = input.checked;
            dispatchStateChange?.(key);
        };
        input.addEventListener('change', update);
        update();
    };

    const lockDatabaseSelection = (root, lockedDatabase) => {
        if (lockedDatabase) {
            const radios = root.querySelectorAll('input[name="database"]');
            radios.forEach((radio) => {
                const isLockedChoice = radio.value === lockedDatabase;
                const card = radio.closest('.selector-card');
                radio.disabled = !isLockedChoice;
                if (card) {
                    card.classList.toggle('is-disabled', !isLockedChoice);
                }
                if (isLockedChoice) {
                    radio.checked = true;
                    updateDatabaseSelection?.(radio, root);
                }
            });
        }
    };

    const applyEnabledDatabases = (root) => {
        const enabled = getEnabledDatabases?.() || [];
        const radios = root.querySelectorAll('input[name="database"]');
        radios.forEach((radio) => {
            if (!enabled.includes(radio.value)) {
                const card = radio.closest('.selector-card');
                if (card) {
                    card.remove();
                }
            }
        });
    };

    const bindDatabaseSelection = (root) => {
        const radios = root.querySelectorAll('input[name="database"]');
        radios.forEach((radio) => {
            radio.addEventListener('change', () => {
                formState.database = radio.value;
                updateDatabaseSelection?.(radio, root);
            });
        });
    };

    // A hostname that no public certificate authority will issue for: loopback names,
    // .local/.internal names, and bare IP literals. Those are served over plain HTTP, so
    // the toggle follows the hostname instead of making the operator know this.
    const servedOverPlainHttp = (value) => {
        const host = (value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');

        if (host === '') return true;
        if (host === 'localhost' || host.endsWith('.localhost')) return true;
        if (host.endsWith('.local') || host.endsWith('.internal')) return true;
        if (host === '::1' || host === '0.0.0.0') return true;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
        if (host.includes(':') && /^[0-9a-f:]+$/.test(host)) return true;

        return false;
    };

    const hydrateStep1State = (root) => {
        State.setStateIfEmpty?.('appDomain', root.querySelector('#hostname')?.value);
        State.setStateIfEmpty?.('database', root.querySelector('input[name="database"]:checked')?.value);
        State.setStateIfEmpty?.('topology', getTopology?.() || root.querySelector('input[name="topology"]:checked')?.value || 'combined');
        State.setStateIfEmpty?.('httpPort', root.querySelector('#http-port')?.value);
        State.setStateIfEmpty?.('httpsPort', root.querySelector('#https-port')?.value);
        State.setStateIfEmpty?.('emailCertificates', root.querySelector('#ssl-email')?.value);
        State.setStateIfEmpty?.('forceHttps', root.querySelector('#force-https')?.checked);
        State.setStateIfEmpty?.('assistantOpenAIKey', root.querySelector('#assistant-openai-key')?.value);
    };

    const applyStep1State = (root) => {
        const hostname = root.querySelector('#hostname');
        if (hostname && formState.appDomain) hostname.value = formState.appDomain;

        const httpPort = root.querySelector('#http-port');
        if (httpPort && formState.httpPort) httpPort.value = formState.httpPort;

        const httpsPort = root.querySelector('#https-port');
        if (httpsPort && formState.httpsPort) httpsPort.value = formState.httpsPort;

        const sslEmail = root.querySelector('#ssl-email');
        if (sslEmail && formState.emailCertificates) sslEmail.value = formState.emailCertificates;

        const forceHttps = root.querySelector('#force-https');
        if (forceHttps && typeof formState.forceHttps === 'boolean') {
            forceHttps.checked = formState.forceHttps;
        }

        const assistantKey = root.querySelector('#assistant-openai-key');
        if (assistantKey && formState.assistantOpenAIKey) {
            assistantKey.value = formState.assistantOpenAIKey;
        }

        if (formState.database) {
            const radio = root.querySelector(`input[name="database"][value="${formState.database}"]`);
            if (radio) {
                radio.checked = true;
                updateDatabaseSelection?.(radio, root);
            }
        }

        if (formState.topology) {
            const radio = root.querySelector(`input[name="topology"][value="${formState.topology}"]`);
            if (radio) {
                radio.checked = true;
                const group = radio.closest('.selector-group');
                group?.querySelectorAll('.selector-card').forEach((card) => card.classList.remove('selected'));
                radio.closest('.selector-card')?.classList.add('selected');
            }
        }
    };

    const initStep1 = (root) => {
        if (!root) return;
        syncInstallLockFlag?.();
        applyLockPayload?.();
        applyBodyDefaults?.();
        hydrateStep1State(root);
        applyStep1State(root);

        if (isInstallLocked?.()) {
            openAccordion?.(root);
            disableControls?.(root);
            return;
        }

        applyEnabledDatabases(root);

        const lockedDatabase = getLockedDatabase?.() || '';
        if (lockedDatabase) {
            lockDatabaseSelection(root, lockedDatabase);
        } else {
            bindDatabaseSelection(root);
        }

        const topologyRadios = root.querySelectorAll('input[name="topology"]');
        topologyRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                formState.topology = radio.value;
                const group = radio.closest('.selector-group');
                group?.querySelectorAll('.selector-card').forEach((card) => card.classList.remove('selected'));
                radio.closest('.selector-card')?.classList.add('selected');
            });
        });

        const hostname = root.querySelector('#hostname');
        const httpPort = root.querySelector('#http-port');
        const httpsPort = root.querySelector('#https-port');
        const sslEmail = root.querySelector('#ssl-email');
        const forceHttps = root.querySelector('#force-https');
        const assistantKey = root.querySelector('#assistant-openai-key');

        bindInputToState(hostname, 'appDomain');

        // Follow the hostname until the operator sets the toggle themselves, after which
        // their choice stands however the hostname changes.
        if (hostname && forceHttps) {
            const followHostname = () => {
                if (forceHttps.dataset.touched === 'true') return;
                const https = !servedOverPlainHttp(hostname.value);
                forceHttps.checked = https;
                formState.forceHttps = https;
            };

            forceHttps.addEventListener('change', () => {
                forceHttps.dataset.touched = 'true';
            });
            hostname.addEventListener('input', followHostname);
            followHostname();
        }

        bindInputToState(httpPort, 'httpPort');
        bindInputToState(httpsPort, 'httpsPort');
        bindInputToState(sslEmail, 'emailCertificates');
        bindCheckboxToState(forceHttps, 'forceHttps');
        bindInputToState(assistantKey, 'assistantOpenAIKey');

        bindErrorClear?.(hostname);
        bindErrorClear?.(httpPort);
        bindErrorClear?.(httpsPort);
        bindErrorClear?.(sslEmail);
        bindErrorClear?.(assistantKey);

        const checked = root.querySelector('input[name="database"]:checked');
        if (checked) {
            updateDatabaseSelection?.(checked, root);
        }

        setupResetButtons?.(root);
        setupAccordion?.(root);
        Tooltips?.setupTooltipPortals?.(root);
    };

    const hydrateStep2State = (root) => {
        const value = root.querySelector('#secret-key')?.value;
        if (formState.opensslKey) return;
      
```

### Core Architecture Module: `app/views/install/installer/js/tooltips.js`
```
(() => {
    const tooltipPortals = new Set();

    const positionTooltipPortal = (tooltip, anchor) => {
        if (!tooltip || !anchor) return;
        const rect = anchor.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const offset = Number(tooltip.dataset.tooltipOffset || 6);
        const padding = 8;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
        const top = rect.bottom + offset;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    };

    const attachTooltipPortal = (tooltip) => {
        if (!tooltip || tooltip.dataset.portalInitialized === 'true') return;
        const anchor = tooltip.parentElement;
        if (!anchor) return;

        tooltip.dataset.portalInitialized = 'true';
        tooltip.classList.add('tooltip-portal');
        document.body.appendChild(tooltip);

        const show = () => {
            tooltip.classList.add('is-open');
            positionTooltipPortal(tooltip, anchor);
        };
        const hide = () => {
            tooltip.classList.remove('is-open');
        };
        const refresh = () => {
            if (tooltip.classList.contains('is-open')) {
                positionTooltipPortal(tooltip, anchor);
            }
        };

        anchor.addEventListener('mouseenter', show);
        anchor.addEventListener('mouseleave', hide);
        anchor.addEventListener('focusin', show);
        anchor.addEventListener('focusout', hide);
        window.addEventListener('scroll', refresh, true);
        window.addEventListener('resize', refresh);

        tooltipPortals.add({
            tooltip,
            cleanup: () => {
                anchor.removeEventListener('mouseenter', show);
                anchor.removeEventListener('mouseleave', hide);
                anchor.removeEventListener('focusin', show);
                anchor.removeEventListener('focusout', hide);
                window.removeEventListener('scroll', refresh, true);
                window.removeEventListener('resize', refresh);
                if (tooltip.parentElement) {
                    tooltip.parentElement.removeChild(tooltip);
                }
            }
        });
    };

    const setupTooltipPortals = (root) => {
        if (!root) return;
        const portalTooltips = root.querySelectorAll('.tooltip[data-tooltip-portal]');
        portalTooltips.forEach((tooltip) => attachTooltipPortal(tooltip));
    };

    const cleanupTooltipPortals = () => {
        tooltipPortals.forEach((entry) => entry.cleanup());
        tooltipPortals.clear();
    };

    window.InstallerTooltips = {
        setupTooltipPortals,
        cleanupTooltipPortals
    };
})();

```

### Core Architecture Module: `mongo-init.js`
```
// mongo-init.js

// Switch to the admin database
const adminDb = db.getSiblingDB("admin");

// Get username and password from environment variables
const username = process.env.MONGO_INITDB_USERNAME;
const password = process.env.MONGO_INITDB_PASSWORD;
const database = process.env.MONGO_INITDB_DATABASE;

// Create the user
if (adminDb.getUser(username) === null) {
  adminDb.createUser({
    user: username,
    pwd: password,
    roles: [{ role: "readWrite", db: database }],
  });
}

```

### Core Architecture Module: `public/sdk-console/client.ts`
```
import 'isomorphic-form-data';
import { fetch } from 'cross-fetch';
import { Models } from './models';
import { Service } from './service';

type Payload = {
    [key: string]: any;
}

type Headers = {
    [key: string]: string;
}

type RealtimeResponse = {
    type: 'error' | 'event' | 'connected' | 'response';
    data: RealtimeResponseAuthenticated | RealtimeResponseConnected | RealtimeResponseError | RealtimeResponseEvent<unknown>;
}

type RealtimeRequest = {
    type: 'authentication';
    data: RealtimeRequestAuthenticate;
}

export type RealtimeResponseEvent<T extends unknown> = {
    events: string[];
    channels: string[];
    timestamp: number;
    payload: T;
}

type RealtimeResponseError = {
    code: number;
    message: string;
}

type RealtimeResponseConnected = {
    channels: string[];
    user?: object;
}

type RealtimeResponseAuthenticated = {
    to: string;
    success: boolean;
    user: object;
}

type RealtimeRequestAuthenticate = {
    session: string;
}

type Realtime = {
    socket?: WebSocket;
    timeout?: number;
    url?: string;
    lastMessage?: RealtimeResponse;
    channels: Set<string>;
    subscriptions: Map<number, {
        channels: string[];
        callback: (payload: RealtimeResponseEvent<any>) => void
    }>;
    subscriptionsCounter: number;
    reconnect: boolean;
    reconnectAttempts: number;
    getTimeout: () => number;
    connect: () => void;
    createSocket: () => void;
    cleanUp: (channels: string[]) => void;
    onMessage: (event: MessageEvent) => void;
}

export type UploadProgress = {
    $id: string;
    progress: number;
    sizeUploaded: number;
    chunksTotal: number;
    chunksUploaded: number;
}

class AppwriteException extends Error {
    code: number;
    response: string;
    type: string;
    constructor(message: string, code: number = 0, type: string = '', response: string = '') {
        super(message);
        this.name = 'AppwriteException';
        this.message = message;
        this.code = code;
        this.type = type;
        this.response = response;
    }
}

class Client {
    config = {
        endpoint: 'https://HOSTNAME/v1',
        endpointRealtime: '',
        project: '',
        jwt: '',
        locale: '',
    };
    headers: Headers = {
        'x-sdk-name': 'Web',
        'x-sdk-platform': 'client',
        'x-sdk-language': 'web',
        'x-sdk-version': '10.0.1',
        'X-Appwrite-Response-Format': '1.0.0',
    };

    /**
     * Set Endpoint
     *
     * Your project endpoint
     *
     * @param {string} endpoint
     *
     * @returns {this}
     */
    setEndpoint(endpoint: string): this {
        this.config.endpoint = endpoint;
        this.config.endpointRealtime = this.config.endpointRealtime || this.config.endpoint.replace('https://', 'wss://').replace('http://', 'ws://');

        return this;
    }

    /**
     * Set Realtime Endpoint
     *
     * @param {string} endpointRealtime
     *
     * @returns {this}
     */
    setEndpointRealtime(endpointRealtime: string): this {
        this.config.endpointRealtime = endpointRealtime;

        return this;
    }

    /**
     * Set Project
     *
     * Your project ID
     *
     * @param value string
     *
     * @return {this}
     */
    setProject(value: string): this {
        this.headers['X-Appwrite-Project'] = value;
        this.config.project = value;
        return this;
    }

    /**
     * Set JWT
     *
     * Your secret JSON Web Token
     *
     * @param value string
     *
     * @return {this}
     */
    setJWT(value: string): this {
        this.headers['X-Appwrite-JWT'] = value;
        this.config.jwt = value;
        return this;
    }

    /**
     * Set Locale
     *
     * @param value string
     *
     * @return {this}
     */
    setLocale(value: string): this {
        this.headers['X-Appwrite-Locale'] = value;
        this.config.locale = value;
        return this;
    }


    private realtime: Realtime = {
        socket: undefined,
        timeout: undefined,
        url: '',
        channels: new Set(),
        subscriptions: new Map(),
        subscriptionsCounter: 0,
        reconnect: true,
        reconnectAttempts: 0,
        lastMessage: undefined,
        connect: () => {
            clearTimeout(this.realtime.timeout);
            this.realtime.timeout = window?.setTimeout(() => {
                this.realtime.createSocket();
            }, 50);
        },
        getTimeout: () => {
            switch (true) {
                case this.realtime.reconnectAttempts < 5:
                    return 1000;
                case this.realtime.reconnectAttempts < 15:
                    return 5000;
                case this.realtime.reconnectAttempts < 100:
                    return 10_000;
                default:
                    return 60_000;
            }
        },
        createSocket: () => {
            if (this.realtime.channels.size < 1) return;

            const channels = new URLSearchParams();
            channels.set('project', this.config.project);
            this.realtime.channels.forEach(channel => {
                channels.append('channels[]', channel);
            });

            const url = this.config.endpointRealtime + '/realtime?' + channels.toString();

            if (
                url !== this.realtime.url || // Check if URL is present
                !this.realtime.socket || // Check if WebSocket has not been created
                this.realtime.socket?.readyState > WebSocket.OPEN // Check if WebSocket is CLOSING (3) or CLOSED (4)
            ) {
                if (
                    this.realtime.socket &&
                    this.realtime.socket?.readyState < WebSocket.CLOSING // Close WebSocket if it is CONNECTING (0) or OPEN (1)
                ) {
                    this.realtime.reconnect = false;
                    this.realtime.socket.close();
                }

                this.realtime.url = url;
                this.realtime.socket = new WebSocket(url);
                this.realtime.socket.addEventListener('message', this.realtime.onMessage);
                this.realtime.socket.addEventListener('open', _event => {
                    this.realtime.reconnectAttempts = 0;
                });
                this.realtime.socket.addEventListener('close', event => {
                    if (
                        !this.realtime.reconnect ||
                        (
                            this.realtime?.lastMessage?.type === 'error' && // Check if last message was of type error
                            (<RealtimeResponseError>this.realtime?.lastMessage.data).code === 1008 // Check for policy violation 1008
                        )
                    ) {
                        this.realtime.reconnect = true;
                        return;
                    }

                    const timeout = this.realtime.getTimeout();
                    console.error(`Realtime got disconnected. Reconnect will be attempted in ${timeout / 1000} seconds.`, event.reason);

                    setTimeout(() => {
                        this.realtime.reconnectAttempts++;
                        this.realtime.createSocket();
                    }, timeout);
                })
            }
        },
        onMessage: (event) => {
            try {
                const message: RealtimeResponse = JSON.parse(event.data);
                this.realtime.lastMessage = message;
                switch (message.type) {
                    case 'connected':
                        const cookie = JSON.parse(window.localStorage.getItem('cookieFallback') ?? '{}');
                        const session = cookie?.[`a_session_${this.config.project}`];
                        const messageData = <RealtimeResponseConnected>message.data;

                        if (session && !messageData.user) {
                            this.realtime.socket?.send(JSON.stringify(<RealtimeRequest>{
                                type: 'authentication',
                                data: {
                                    session
                                }
                            }));
                        }
                        break;
                    case 'event':
                        let data = <RealtimeResponseEvent<unknown>>message.data;
                        if (data?.channels) {
                            const isSubscribed = data.channels.some(channel => this.realtime.channels.has(channel));
                            if (!isSubscribed) return;
                            this.realtime.subscriptions.forEach(subscription => {
                                if (data.channels.some(channel => subscription.channels.includes(channel))) {
                                    setTimeout(() => subscription.callback(data));
                                }
                            })
                        }
                        break;
                    case 'error':
                        throw message.data;
                    default:
                        break;
                }
            } catch (e) {
                console.error(e);
            }
        },
        cleanUp: channels => {
            this.realtime.channels.forEach(channel => {
                if (channels.includes(channel)) {
                    let found = Array.from(this.realtime.subscriptions).some(([_key, subscription] )=> {
                        return subscription.channels.includes(channel);
                    })

                    if (!found) {
                        this.realtime.channels.delete(channel);
                    }
                }
            })
        }
    }

    /**
     * Subscribes to Appwrite events and passes you the payload in realtime.
     * 
     * @param {string|string[]} channels 
     * Channel to subscribe - pass a single channel as a string or multiple with an array of strings.
     * 
     * Possible channels are:
     * - account
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10857** (2026-02-24): **OAuth Callback Error: Invalid Scheme tauri://localhost Not Supported**
  *Symptoms*: ### 👟 Reproduction steps  i ran my tauri app with `npm run build && npm run tauri dev` and tried to use the Appwrite SDK to login but instead i got this error: `Invalid Scheme: The scheme used (tauri) in the Origin (tauri://localhost) is not supported.  If you are using a custom scheme, please change it to appwrite-callback-<PROJECT_ID>`  source code:  ```js // Import necessary components import React, { useState } from "react"; import { ID,  Client, Account } from "appwrite"; console.log('Appwrite imports:', { Client, Account }); import "./AuthModal.css"; import { getTranslationObject } from "./locales/index.js";  // Define server credientials const client = new Client(); client   .setEndpoint("https://cloud.appwrite.io/v1")   .setProject("reskin");  let account; // Attempt to initialize Appwrite try {   account = new Account(client);   console.log('Appwrite initialized:', { client, account }); } catch (e) {   console.error('Error initializing Appwrite:', e); }  export default function AuthModal({ open, onClose, onAuth }) {   const language = localStorage.getItem("reskin_language") || "en";   const t = getTranslationObject(language);   const [mode, setMode] = useState("login");   const [username, setUsername] = useState("");   const [email, setEmail] = useState("");   const [password, setPassword] = useState("");   const [error, setError] = useState("");   const [loading, setLoading] = useState(false);   const [showRecovery, setShowRecovery] = useState(false);   const [reco
  **Post-Mortem & Fix Analysis**:
  > 🎯 **Agentic Issue Triage**  This issue reports an OAuth callback error when using Appwrite SDK in a Tauri application. The SDK rejects the `(redacted) scheme, suggesting it needs to be changed to `appwrite-callback-(PROJECT_ID)`.  **Summary**: OAuth authentication fails in Tauri desktop app due to unsupported custom URI scheme `(redacted)  <details> <summary>(strong)🔍 Issue Analysis(/strong)</summary>  **Issue Type**: Bug / Feature Gap - OAuth authentication in Tauri/desktop applications  **Key Details**: - **Environment**: Tauri desktop app, Appwrite Cloud, Appwrite JS SDK 18.2.0 - **Operating System**: Linux - **Error**: `Invalid Scheme: The scheme used (tauri) in the Origin ((redacted)) is not supported. If you are using a custom scheme, please change it to appwrite-callback-(PROJECT_ID)` - **Impact**: OAuth authentication completely non-functional in Tauri apps - **User Action**: Attempting email/password authentication, but getting scheme validation error  **Root Cause**: Appwri
  > Hi team   I would like to work on this issue and open a PR if approved.  ### Summary of what I plan to do The Tauri desktop environment uses custom URL schemes to handle OAuth redirects, but the Appwrite JS SDK currently validates callback URL schemes only against the whitelist for web contexts and blocks schemes like `tauri://...`.  Proposed direction for the fix:  - Expand the allowed callback URL scheme validation to support desktop environments (Tauri/Electron)     **or** - Provide a configuration flag in the SDK to bypass strict web `Origin`/scheme validation when running in a desktop runtime - Ensure compatibility with the recommended `appwrite-callback-(PROJECT_ID)` pattern if this is the intended official approach  ### Expected outcome - OAuth authentication should become functional in Tauri apps without requiring undocumented workarounds - Documentation (or SDK comments) should clarify how callback schemes should be registered in desktop environments  ### Next steps If this di
  > so how exactly am i supposed to fix it? here's my tauri.conf.json cause i think it makes sense: ```{   "version": "1.6.1",   "productName": "Reskin",   "identifier": "com.reskin.reskinapp",   "build": {     "frontendDist": "../dist",     "removeUnusedCommands": false,     "beforeBuildCommand": "npm run build"   },   "app": {     "windows": [       {         "label": "main",         "visible": true,         "decorations": false,         "minWidth": 400,         "minHeight": 300,         "maximized": true,         "title": "Reskin"       }     ],     "security": {       "csp": null,       "capabilities": [         {           "identifier": "main-capability",           "windows": [             "main"           ],           "permissions": [             "core:window:allow-start-dragging",             "core:window:allow-internal-toggle-maximize"           ]         }       ]     }   },   "bundle": {     "active": true,     "targets": [],     "icon": [       "icons/32x32.png",       "icons/12

- **Issue #10836** (2025-11-25): **Web-Assembly .wasm files served as stream/octet instead of application/wasm**
  *Symptoms*: ### 👟 Reproduction steps  1. Create a basic Flutter app, build with "flutter build web --release --wasm"  For example: flutter create wasm_mimetype_error cd wasm_mimetype_error flutter build web --release --wasm cd build tar -cf code.tar ./web gzip -9 code.tar  2. Deploy the code.tar.gz contents manually to Appwrite Sites. Set the base directory to ./web and fallback file to index.html and redeploy. 3. Open the site on the Chrome Browser.  4. See error in Chrome browser console: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream". Strict MIME type checking is enforced for module scripts per HTML spec. Understand this error (index):1 Uncaught (in promise) TypeError: Failed to fetch dynamically imported module: https://demo.appwrite.network/main.dart.mjs  If you use some SPA router intermediary like NextJS then it may correctly serve the .wasm as application/wasm  ### 👍 Expected behavior  Correctly serve the .wasm as application/wasm without the need of another routing service.  ### 👎 Actual Behavior  Error in Chrome browser console: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream". Strict MIME type checking is enforced for module scripts per HTML spec.Understand this error (index):1 Uncaught (in promise) TypeError: Failed to fetch dynamically imported module: https://quade-demo.appwrite
  **Post-Mortem & Fix Analysis**:
  > 🎯 **Agentic Issue Triage**  This issue reports that Appwrite Sites serves WebAssembly (`.wasm`) files with the incorrect MIME type `application/octet-stream` instead of `application/wasm`, causing Flutter Web apps built with WASM to fail loading in Chrome browsers.  **Summary**: Flutter Web + WASM deployments fail in Chrome due to incorrect MIME type for `.wasm` files served by Appwrite Sites.  <details> <summary>(strong)🔍 Issue Analysis(/strong)</summary>  **Issue Type**: Bug - Sites/Storage MIME type configuration  **Key Details**: - **Environment**: Appwrite Cloud, Appwrite Sites - **Platform**: macOS / Chrome Browser - **Affected Technology**: Flutter Web with WebAssembly (--wasm flag) - **Error Message**: `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream"` - **Impact**: Flutter WASM apps cannot load, showing blank screen - **Workaround Mentioned**: Using SPA routers like NextJS may se
  > Hey, I’d like to work on this issue. Before I begin, can I get confirmation and have this assigned to me?  ### 🔍 Issue Understanding  I’ve reviewed the problem in detail:  - `.wasm` files are currently served with `application/octet-stream` - Chrome requires `application/wasm` for WebAssembly module loading - This causes Flutter Web apps built with WASM (`--wasm` flag) to fail on Appwrite Sites - The fix likely involves updating the Sites file server’s MIME type mapping to correctly serve `.wasm` files  ### 🛠 Proposed Approach  1. Identify where MIME types are configured in the Appwrite Sites / static file server. 2. Add or update the mapping for: 3. Ensure this new MIME type flows correctly through the file-serving pipeline. 4. Test locally by deploying a small Flutter Web WASM build and verifying Chrome loads it without MIME-type errors. 5. Add or update any related tests if required.  Let me know if this approach aligns with the expected fix and if I can get this issue assigned be
  > @cursoragent create a PR to attempt and fix this, make sure to have a proper test in place.

- **Issue #10823** (2025-11-19): **Function not available, page show 404 error**
  *Symptoms*: ### 👟 Reproduction steps  1. Go to 'https://cloud.appwrite.io/console/project-fra-680dc3f800036e182e62/functions' 2. Click on function and open the page 'https://cloud.appwrite.io/console/project-fra-680dc3f800036e182e62/functions/function-680dc816003dcd1d8061' 3. See page with 404 Deployment with the requested ID could not be found.  <img width="1725" height="875" alt="Image" src="https://github.com/user-attachments/assets/3242c7a7-b7ae-4883-a607-834f05dbf8ff" />   ### 👍 Expected behavior  I need access to the function  ### 👎 Actual Behavior  See page with 404 error  ### 🎲 Appwrite version  Appwrite Cloud  ### 💻 Operating system  MacOS  ### 🧱 Your Environment  _No response_  ### 👀 Have you spent some time to check if this issue has been raised before?  - [x] I checked and didn't find similar issue  ### 🏢 Have you read the Code of Conduct?  - [x] I have read the [Code of Conduct](https://github.com/appwrite/.github/blob/main/CODE_OF_CONDUCT.md)
  **Post-Mortem & Fix Analysis**:
  > 🎯 **Agentic Issue Triage**  This issue reports a 404 error when accessing a function in the Appwrite Cloud console. The user gets an error "Deployment with the requested ID could not be found" when trying to access their function page.  <details> <summary>(strong)🔍 Issue Analysis(/strong)</summary>  **Issue Type**: Console/Functions navigation bug on Appwrite Cloud  **Key Details**: - **Environment**: Appwrite Cloud - **Platform**: macOS - **Affected Area**: Functions console page - **Error**: 404 with message "Deployment with the requested ID could not be found" - **URL Pattern**: `/console/project-{projectId}/functions/function-{functionId}`  **Potential Causes**: 1. **Routing Issue**: The console might be incorrectly treating the function ID as a deployment ID 2. **State Mismatch**: Function exists in the database but the console is looking for deployment information 3. **Deleted Deployment**: The function's deployment may have been deleted while the function still exists 4. **Con
  > Hi, I’d like to help with this issue. Could you please describe which part of the code is causing the 404 — is it the console UI, or the API backend?
  > Hi, Thanks for help. My steps: 1. Open console by link - https://cloud.appwrite.io/console 2. Select my project and go to the Functions tap: https://cloud.appwrite.io/console/project-fra-xxxx/functions 3. Try to open one from my functions and see: 404 Deployment with the requested ID could not be found.  Some times ago it works fine and after next update I got this state. So, I cannot see setting for this functions, even unable to delete it. I created a new one and it's works fine with the same codebase. But any cases I need access to old function.  Thanks a lot!

- **Issue #10809** (2025-12-11): **Appwrite Console freezes (Page Unresponsive) when opening one specific collection**
  *Symptoms*: ### 👟 Reproduction steps  When I click on the usersDetails collection inside my Appwrite Cloud Console, the page becomes completely unresponsive and shows the error:  “Page Unresponsive — You can wait for it to become responsive or exit the page.”  Other collections in the same database (e.g. items) open normally without any issue.   ### 👍 Expected behavior  teps to reproduce the behavior:  Go to Appwrite Cloud Console  Open project → Database → select database shelfie_native_app_db  Click on the collection usersDetails  The page freezes, and Chrome shows “Page Unresponsive”  ### 👎 Actual Behavior  The usersDetails collection should open and display its documents or schema without freezing.  ### 🎲 Appwrite version  Version 1.8.x  ### 💻 Operating system  MacOS  ### 🧱 Your Environment  The usersDetails collection should open and display its documents or schema without freezing.  ### 👀 Have you spent some time to check if this issue has been raised before?  - [x] I checked and didn't find similar issue  ### 🏢 Have you read the Code of Conduct?  - [x] I have read the [Code of Conduct](https://github.com/appwrite/.github/blob/main/CODE_OF_CONDUCT.md)
  **Post-Mortem & Fix Analysis**:
  > 🎯 **Agentic Issue Triage**  User reports that the Appwrite Console becomes completely unresponsive when attempting to open a specific collection (`usersDetails`) in the database, while other collections in the same database work normally. This appears to be a performance or rendering issue specific to this collection's content.  <details> <summary>(strong)🔍 Analysis & Observations(/strong)</summary>  - **Issue Type**: Console performance/freezing bug - **Affected Component**: Database Console UI - **Scope**: Cloud instance, specific to one collection - **Impact**: High - completely prevents access to collection management - **Labels Applied**: Already has appropriate labels (bug, product/databases, product/auth, product/console, product/cloud, sdk/cli)  The issue suggests the problem may be related to: - Large number of documents in the collection - Complex document structure or large document sizes - Relationship attributes causing rendering issues - Console attempting to render too
  > Hey,  Thanks for creating this issue.  Can you try the steps below and see if it helps:-  1. Use the Appwrite CLI or SDK to list a few documents. 2. Open the Console in Incognito Mode or another browser example - firefox 3. Open network tab to see if there are any console/network errors.
  > Submitted PR #10840 fixes the critical freeze triggered when Appwrite loads thousands of documents at once. The backend now caps excessive limits and applies sane defaults, preventing UI death loops. This patch removes the bottleneck entirely and restores console responsiveness. Need a fast review so this high-impact bug doesn’t keep blocking developers.

- **Issue #10803** (2025-11-13): **Getting Error Not Found while deploying functions**
  *Symptoms*: ### 👟 Reproduction steps  I'm using the self-hosted 1.18.0 Appwrite version. I'm trying to use the Manual and Github Deployments Functions features. I am getting error Not Found while using both methods.  <img width="1456" height="752" alt="Image" src="https://github.com/user-attachments/assets/1aec1efa-2d64-4d3f-b4fb-f248f0a1c04e" />   ### 👍 Expected behavior  I should be able to deploy the function  ### 👎 Actual Behavior  Getting Error Not Found, appwrite-worker-builds log  ``` [Job] Received Job (6913989703a7a7.63096414). Build action started Creating build for deployment: 69139896f23b565f57fc Deployment action started Status marked as processing Status marked as building Runtime creation started createRuntime failed Runtime creation finished listLogs finished Build failed: Not Found /usr/src/code/src/Executor/Executor.php 107 #0 /usr/src/code/src/Appwrite/Platform/Modules/Functions/Workers/Builds.php(715): Executor\Executor->createRuntime('69139896f23b565...', '******', '/storage/functi...', 'openruntimes/no...', 'v5', 1.0, 1024, 900, true, 'index.js', '/storage/builds...', Array, 'tar -zxf /tmp/c...', '') #1 [internal function]: Appwrite\Platform\Modules\Functions\Workers\Builds->Appwrite\Platform\Modules\Functions\Workers\{closure}() #2 {main} [Job] (6913989703a7a7.63096414) successfully run.: ```  Openruntimes-executor log at same time   ``` [Error] Type: Utopia\Http\Exception [Error] Message: Not Found [Error] Type: Utopia\Http\Exception [Error] File: /usr/local/ve
  **Post-Mortem & Fix Analysis**:
  > 🎯 **Agentic Issue Triage**  User reports "Not Found" error when attempting to deploy functions (both Manual and Github deployments) on self-hosted Appwrite 1.8.0. The error occurs during the build process with the openruntimes-executor returning a generic "Not Found" error.  <details> <summary>(strong)🔍 Analysis & Observations(/strong)</summary>  - **Issue Type**: Function deployment/build failure - **Affected Component**: Functions, openruntimes-executor - **Scope**: Self-hosted v1.8.0 (potentially upgrade-related) - **Impact**: Critical - completely prevents function deployment - **Environment**: AWS Lightsail, Ubuntu, Docker 27.5.1, Docker Compose v2.27.0  **Key Error Details**: ``` Runtime creation failed Build failed: Not Found /usr/src/code/src/Executor/Executor.php:107 ```  The configuration shows potential version mismatch: - Image: `appwrite/appwrite:1.8.0` - Executor: `openruntimes/executor:0.5.10` - Runtime env: `openruntimes/node:v5-18.0`  </details>  <details> <summary>(
  > Update : I have updated my openruntimes-proxy and openruntimes-executor now the I am getting "Internal server error." while deploying the function.  **appwrite-worker-builds log is**   ``` [Job] Received Job (6914ef4408a9b4.47661780). Build action started Creating build for deployment: 6914ef440382a53a7ff1 Deployment action started Status marked as processing Status marked as building Runtime creation started createRuntime failed listLogs finished Runtime creation finished Build failed: Internal server error. /usr/src/code/src/Executor/Executor.php 107 #0 /usr/src/code/src/Appwrite/Platform/Modules/Functions/Workers/Builds.php(715): Executor\Executor->createRuntime('6914ef440382a53...', 'konfess', '/storage/functi...', 'openruntimes/no...', 'v5', 1.0, 1024, 900, true, 'index.js', '/storage/builds...', Array, 'tar -zxf /tmp/c...', '') #1 [internal function]: Appwrite\Platform\Modules\Functions\Workers\Builds->Appwrite\Platform\Modules\Functions\Workers\{closure}() #2 {main} [Job] (6914e
  > @artbyrtech btw, it's best to format code-like text using backticks like in markdown.  Please try reverting your changes to your docker-compose.yml file. You should not be changing that. As mentioned in the [environment variables docs](https://appwrite.io/docs/environment-variables), you should be updating your .env file. To configure which runtimes should be available, you should be updating the `_APP_FUNCTIONS_RUNTIMES` env var in your .env file.

- **Issue #10781** (2025-11-12): **VCS webhook handler fails with 'No permissions provided for action delete' when processing GitHub events**
  *Symptoms*: I had the described issue and asked Claude Code to fix it.  It works now and I told him to summarize what he did in a issue.  Please be advised that I did not review this. The preview builds now work though and I hope this is helpful to you guys. Thanks.    ## Bug Description  GitHub webhook events (PR opened, push, etc.) fail to trigger builds because the VCS controller's cleanup operations lack proper authorization context. The endpoint throws "No permissions provided for action 'delete'" errors when trying to delete `vcsCommentLocks` documents.  ## Version - **Appwrite Version:** 1.8.0 - **Affected Component:** Sites/VCS Integration (`app/controllers/api/vcs.php`)  ## Impact - **Severity:** Critical - **Affected Feature:** Appwrite Sites preview deployments from GitHub PRs - Builds never start when PRs are opened or updated - Users see "Waiting for build to start..." indefinitely - This breaks the entire Sites CI/CD workflow for GitHub integrations  ## Steps to Reproduce 1. Set up Appwrite 1.8.0 with GitHub App integration 2. Connect a repository to an Appwrite Site 3. Open a pull request or push to a branch 4. GitHub sends webhook to `/v1/vcs/github/events` 5. Check Docker logs: `docker logs appwrite`  ## Expected Behavior - Webhook processes successfully - Lock documents are created and cleaned up - Build job is queued - Preview deployment starts  ## Actual Behavior - Webhook processing fails with error: ``` [Error] Method: POST [Error] URL: /v1/vcs/github/events [Error]
  **Post-Mortem & Fix Analysis**:
  > 🎯 **Agentic Issue Triage**  **Summary:** Critical bug in VCS webhook handler causes GitHub events (PR opened, push) to fail with authorization errors when cleaning up `vcsCommentLocks` documents. This breaks the entire Sites preview deployment workflow for GitHub integrations in Appwrite 1.8.0.  <details> <summary>(strong)📋 Issue Analysis(/strong)</summary>  **Type:** Bug - Critical   **Component:** VCS Integration / Sites   **Affected Version:** 1.8.0   **(redacted) `/usr/src/code/app/controllers/api/vcs.php`   **Severity:** Critical - Blocks core CI/CD functionality   **User Impact:** Complete failure of GitHub PR preview deployments  **Root Cause:**   The `/v1/vcs/github/events` endpoint has `label('scope', 'public')`, meaning webhooks run without authenticated user context. However, cleanup operations in `finally` blocks (lines 169, 240, and 461) attempt to delete `vcsCommentLocks` documents without bypassing authorization checks using `Authorization::skip()`.  **Error Pattern:**
  > Hey @JoeNerdan  and @stnguyen90  I’ve gone through the issue details and root cause analysis. The missing Authorization::skip() wrapper around deleteDocument('vcsCommentLocks', …) seems to be the core problem. I’d like to take this up and open a PR implementing the fix at lines 169, 240, and 461 in app/controllers/api/vcs.php, along with appropriate testing for GitHub event handling. Please confirm if it’s okay for me to proceed.
  > @TejasGoyal0 to avoid wasted effort, please make sure to follow our [contributing guide](https://github.com/appwrite/appwrite/blob/main/CONTRIBUTING.md#how-to-start).

- **Issue #10426** (2025-09-03): **🐛 Bug Report: Query.select doesn't work properly in android sdk (kotlin)**
  *Symptoms*: ### 👟 Reproduction steps  You need a database with a table which will contain a column. For example, i have a database with news table, which contains "headline" column.  Then write down some code: `kotlin val client = Client(context)             .setEndpoint(APPWRITE_PUBLIC_ENDPOINT)             .setProject(APPWRITE_PROJECT_ID)  val tablesDB = TablesDB(client)  val (_, rows) = tablesDB.listRows(             databaseId = APPWRITE_DATABASE_ID,             tableId = APPWRITE_TABLE_ID,             queries = listOf(Query.select(listOf("headline"))) ) `  And then see an exception.  ### 👍 Expected behavior  It should return row with headline column.  ### 👎 Actual Behavior  It actually throws an exception: `kotlin java.lang.NullPointerException: null cannot be cast to non-null type kotlin.String                                                                                                     	at io.appwrite.models.Row$Companion.from(Row.kt:97)                                                                                                     	at io.appwrite.models.RowList$Companion.from(RowList.kt:43)                                                                                                     	at io.appwrite.services.TablesDB$listRows$converter$1.invoke(TablesDb.kt:44)                                                                                                     	at io.appwrite.services.TablesDB$listRows$converter$1.invoke(TablesDb.kt:42)                            

- **Issue #10413** (2025-09-01): **🐛 Bug Report: Appwrite threads page show internal error 500**
  *Symptoms*: ### 👟 Reproduction steps  when I just tried access a [this](https://appwrite.io/threads/1393290266370113556) thread I got not found error, tried another thread and the same issue, and finally tried the [threads page](https://appwrite.io/threads) and got Internal error.  The point is when clicking on any link from the navbar and press the browser back button, the threads page works fine. The issue come again when reloading the page.  ### 👍 Expected behavior  it should open the threads page normally.  ### 👎 Actual Behavior  Internal Error  Image: <img width="1658" height="1080" alt="Image" src="https://github.com/user-attachments/assets/c9fa4ca6-4eaa-4800-9ccd-41caaa01dd40" />  Video: https://github.com/user-attachments/assets/16fe1fad-17b4-415c-92a6-48c54c26ffec  ### 🎲 Appwrite version  Appwrite Cloud  ### 💻 Operating system  MacOS  ### 🧱 Your Environment  MacOS with Arc browser   ### 👀 Have you spent some time to check if this issue has been raised before?  - [x] I checked and didn't find similar issue  ### 🏢 Have you read the Code of Conduct?  - [x] I have read the [Code of Conduct](https://github.com/appwrite/.github/blob/main/CODE_OF_CONDUCT.md)
  **Post-Mortem & Fix Analysis**:
  > I want to fix it. Can you assign me? @stnguyen90 
  > > I want to fix it. Can you assign me? [@stnguyen90](https://github.com/stnguyen90)  I just checked — it's not in this repository. The code is in the 'appwrite/website' repository, I'm opening another issue on it 
  > oh my bad, i did not found the actual repo. Thanks dude, do it

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

### Incident Patch 1: `0160b0f3` (2026-10-05)
**Commit Message**: Merge pull request #14139 from appwrite/fix/mails-project-smtp-failures

fix(mails): finish the job when a project's own SMTP server fails

**File**: `src/Appwrite/Platform/Workers/Mails.php` (modified, +4/-1)
```diff
@@ -234,8 +234,11 @@ public function action(Message $message, Document $project, Registry $register,
             Span::add('mail.status', 'failure');
 
             if ($type === 'smtp') {
-                throw new Exception('Error sending mail: ' . $error->getMessage(), 401);
+                Span::add('mail.error.message', $error->getMessage());
+
+                return;
             }
+
             throw new Exception('Error sending mail: ' . $error->getMessage(), 500);
         }
 
```

**File**: `tests/unit/Platform/Workers/MailsTest.php` (modified, +18/-2)
```diff
@@ -166,6 +166,19 @@ public function testProviderRejectionIsSkippedWithoutRetry(): void
         $this->assertSame(1, $adapter->sendCount);
     }
 
+    public function testProjectSmtpFailureIsNotRetried(): void
+    {
+        $adapter = new SpyMailAdapter();
+
+        $this->runMailWorker($adapter, recipient: 'john@example.test', smtp: [
+            'host' => '127.0.0.1',
+            'port' => 1,
+            'senderEmail' => 'sender@example.test',
+        ]);
+
+        $this->assertSame(0, $adapter->sendCount);
+    }
+
     private function assertMailWorkerThrows(SpyMailAdapter $adapter, string $expectedMessage): void
     {
         $this->expectException(\Exception::class);
@@ -174,7 +187,10 @@ private function assertMailWorkerThrows(SpyMailAdapter $adapter, string $expecte
         $this->runMailWorker($adapter, recipient: 'legacy@example.test');
     }
 
-    private function runMailWorker(SpyMailAdapter $adapter, string $recipient): void
+    /**
+     * @param array<string, mixed> $smtp
+     */
+    private function runMailWorker(SpyMailAdapter $adapter, string $recipient, array $smtp = []): void
     {
         $registry = new Registry();
         $registry->set('smtp', static fn () => new Pool(new Stack(), 'smtp', 1, static fn () => $adapter, 1.0));
@@ -190,7 +206,7 @@ private function runMailWorker(SpyMailAdapter $adapter, string $recipient): void
                     'queue' => 'v1-mails',
                     'timestamp' => \time(),
                     'payload' => [
-                        'smtp' => [],
+                        'smtp' => $smtp,
                         'recipient' => $recipient,
                         'name' => 'Legacy User',
                         'subject' => 'Hello',
```

---

### Incident Patch 2: `c25bd101` (2026-10-05)
**Commit Message**: Merge pull request #14137 from appwrite/cursor/fix-vcs-tag-pattern-clone-9547

fix(vcs): resolve wildcard tags when cloning templates

**File**: `packages/vcs/src/Adapter/Git.php` (modified, +53/-7)
```diff
@@ -296,9 +296,8 @@ abstract public function getCommitStatuses(string $owner, string $repositoryName
 
     /**
      * Sparse, shallow clone of one ref into $directory, checking out only
-     * $rootDirectory. Every value reaches git as its own argument; the one
-     * shell script, the branch fallback, is constant and reads its values
-     * from positional parameters.
+     * $rootDirectory. Every value reaches git as its own argument. The shell
+     * scripts are constant and read their values from positional parameters.
      */
     protected function cloneCommand(string $cloneUrl, string $version, string $versionType, string $directory, string $rootDirectory): Command
     {
@@ -324,10 +323,7 @@ protected function cloneCommand(string $cloneUrl, string $version, string $versi
                 $this->git($directory)->argument('fetch')->option('--depth', '1')->argument('origin')->argument($version),
                 $this->git($directory)->argument('checkout')->argument($version),
             ),
-            self::CLONE_TYPE_TAG => Command::and(
-                $this->git($directory)->argument('fetch')->option('--depth', '1')->argument('origin')->argument('refs/tags/' . $version),
-                $this->git($directory)->argument('checkout')->argument('FETCH_HEAD'),
-            ),
+            self::CLONE_TYPE_TAG => $this->tagCheckout($directory, $version),
             default => throw new Exception("Unsupported clone type: {$versionType}"),
         };
 
@@ -349,6 +345,56 @@ protected function cloneCommand(string $cloneUrl, string $version, string $versi
         );
     }
 
+    /**
+     * Resolve a tag glob the way GitHub and Origin used to: the last tag
+     * `git ls-remote --tags` lists for the pattern. `--refs` omits the peeled
+     * `^{}` line of an annotated tag. The name is everything after
+     * `refs/tags/`, so a namespaced tag such as `release/0.1.2` stays whole.
+     * The directory and the pattern arrive as `$1` and `$2`.
+     */
+    private const string TAG_GLOB_CHECKOUT = <<<'SCRIPT'
+refs=$(git -C "$1" ls-remote --refs --tags origin -- "$2") || exit
+line=$(printf '%s\n' "$refs" | tail -n 1)
+tag=${line#*refs/tags/}
+if [ -z "$tag" ]; then
+    printf 'fatal: no tag matching %s\n' "$2" >&2
+    exit 1
+fi
+git -C "$1" fetch --depth=1 origin "refs/tags/$tag" && git -C "$1" checkout FETCH_HEAD
+SCRIPT;
+
+    /**
+     * Check out $version. A glob is resolved to one tag. An exact name is
+     * fetched as refs/tags/<name>, so a leading dash stays part of the name.
+     */
+    private function tagCheckout(string $directory, string $version): Command
+    {
+        if (!$this->isTagGlob($version)) {
+            return Command::and(
+                $this->git($directory)->argument('fetch')->option('--depth', '1')->argument('origin')->argument('refs/tags/' . $version),
+                $this->git($directory)->argument('checkout')->argument('FETCH_HEAD'),
+            );
+        }
+
+        return new Command('sh')
+            ->flag('-c')
+            ->argument(self::TAG_GLOB_CHECKOUT)
+            ->argument('sh')
+            ->argument($directory)
+            ->argument($version);
+    }
+
+    /**
+     * True when $version is a git ref glob. `*`, `?` and `[` cannot appear in
+     * a tag name, and they are the wildcards `git ls-remote` matches on.
+     */
+    private function isTagGlob(string $version): bool
+    {
+        return str_contains($version, '*')
+            || str_contains($version, '?')
+            || str_contains($version, '[');
+    }
+
     /**
      * git, run against the repository in $directory
      */
```

**File**: `packages/vcs/tests/CloneCommandTest.php` (modified, +77/-3)
```diff
@@ -126,14 +126,88 @@ public function testCloneChecksOutATagStartingWithADash(): void
         $this->assertFileExists($this->directory . '/README.md');
     }
 
-    private function clone(string $rootDirectory, string $version = 'main', string $versionType = Git::CLONE_TYPE_BRANCH): int
+    /**
+     * `git ls-remote` lists tags in refname order, and the lookup keeps the
+     * last line. 0.1.10 sorts before 0.1.2; the annotated 0.1.2 is the tag
+     * that line names. A namespaced pattern keeps the full name after
+     * `refs/tags/`, so `release/0.1.*` resolves to `release/0.1.2`.
+     */
+    public function testCloneChecksOutATagPattern(): void
+    {
+        $this->tag('0.1.0', "tag-0.1.0\n");
+        $this->tag('0.1.10', "tag-0.1.10\n");
+        $this->tag('0.1.2', "tag-0.1.2\n", annotated: true);
+        $this->tag('0.2.0', "tag-0.2.0\n");
+
+        $this->assertSame(0, $this->clone('', '0.1.*', Git::CLONE_TYPE_TAG));
+
+        $this->assertSame("tag-0.1.2\n", $this->read($this->directory . '/README.md'));
+
+        $this->tag('release/0.1.0', "tag-release-0.1.0\n");
+        $this->tag('release/0.1.10', "tag-release-0.1.10\n");
+        $this->tag('release/0.1.2', "tag-release-0.1.2\n", annotated: true);
+        $this->tag('release/0.2.0', "tag-release-0.2.0\n");
+
+        $this->execute(new Command('rm')->flag('-rf')->argument($this->directory));
+        $this->assertSame(0, $this->clone('', 'release/0.1.*', Git::CLONE_TYPE_TAG));
+
+        $this->assertSame("tag-release-0.1.2\n", $this->read($this->directory . '/README.md'));
+    }
+
+    public function testCloneChecksOutAnExactTag(): void
+    {
+        $this->tag('1.2.3', "tag-1.2.3\n");
+        $this->tag('1.2.4', "tag-1.2.4\n");
+
+        $this->assertSame(0, $this->clone('', '1.2.3', Git::CLONE_TYPE_TAG));
+
+        $this->assertSame("tag-1.2.3\n", $this->read($this->directory . '/README.md'));
+    }
+
+    public function testCloneFailsWhenNoTagMatches(): void
+    {
+        $this->tag('0.1.0', "tag-0.1.0\n");
+
+        $stderr = '';
+        $this->assertNotSame(0, $this->clone('', '9.9.*', Git::CLONE_TYPE_TAG, $stderr));
+        $this->assertStringContainsString('fatal: no tag matching 9.9.*', $stderr);
+    }
+
+    private function tag(string $name, string $content, bool $annotated = false): void
+    {
+        $work = $this->workspace . '/work';
+        if (!is_dir($work . '/.git')) {
+            $this->assertSame(0, $this->execute(new Command('git')->argument('clone')->flag('-q')->argument($this->repository)->argument($work)));
+        }
+
+        file_put_contents($work . '/README.md', $content);
+        $this->assertSame(0, $this->execute(new Command('git')->option('-C', $work)->argument('add')->argument('README.md')));
+        $this->assertSame(0, $this->execute(new Command('git')->option('-C', $work)->option('-c', 'user.name=Test')->option('-c', 'user.email=test@example.com')->argument('commit')->flag('-q')->option('-m', $name)));
+
+        $tag = new Command('git')->option('-C', $work)->option('-c', 'user.name=Test')->option('-c', 'user.email=test@example.com')->argument('tag');
+        if ($annotated) {
+            $tag->flag('-a')->option('-m', $name);
+        }
+        $this->assertSame(0, $this->execute($tag->argument($name)));
+        $this->assertSame(0, $this->execute(new Command('git')->option('-C', $work)->argument('push')->flag('-q')->argument('origin')->argument('refs/tags/' . $name)));
+    }
+
+    private function read(string $path): string
+    {
+        $content = file_get_contents($path);
+        $this->assertIsString($content);
+
+        return $content;
+    }
+
+    private function clone(string $rootDirectory, string $version = 'main', string $versionType = Git::CLONE_TYPE_BRANCH, string &$stderr = ''): int
     {
         $adapter = new LocalGit($this->repository);
 
-        return $this->execute($adapter->generateCloneCommand('owner', 'repository', $version, $versionType, $this->directory, $rootDirectory));
+        return $this->execute($adapter->generateCloneCommand('owner', 'repository', $version, $versionType, $this->directory, $rootDirectory), $stderr);
     }
 
-    private function execute(Command $command): int
+    private function execute(Command $command, string &$stderr = ''): int
     {
         $stdout = '';
         $stderr = '';
```

---

### Incident Patch 3: `3e26d087` (2026-10-05)
**Commit Message**: fix(vcs): keep namespaced tag names when resolving globs

git ls-remote prints refs/tags/release/0.1.2. The third slash-separated
field is only release, so the fetch misses the tag. Take the full name
after refs/tags/ and cover release/0.1.* in the tag-pattern clone test.

Co-authored-by: Chirag Aggarwal <[REDACTED_EMAIL]>

**File**: `packages/vcs/src/Adapter/Git.php` (modified, +5/-4)
```diff
@@ -347,14 +347,15 @@ protected function cloneCommand(string $cloneUrl, string $version, string $versi
 
     /**
      * Resolve a tag glob the way GitHub and Origin used to: the last tag
-     * `git ls-remote --tags` lists for the pattern
-     * (`tail -n 1 | awk -F/ '{print $3}'`). `--refs` omits the peeled `^{}`
-     * line of an annotated tag, so the name awk prints is the tag itself.
+     * `git ls-remote --tags` lists for the pattern. `--refs` omits the peeled
+     * `^{}` line of an annotated tag. The name is everything after
+     * `refs/tags/`, so a namespaced tag such as `release/0.1.2` stays whole.
      * The directory and the pattern arrive as `$1` and `$2`.
      */
     private const string TAG_GLOB_CHECKOUT = <<<'SCRIPT'
 refs=$(git -C "$1" ls-remote --refs --tags origin -- "$2") || exit
-tag=$(printf '%s\n' "$refs" | tail -n 1 | awk -F '/' '{print $3}')
+line=$(printf '%s\n' "$refs" | tail -n 1)
+tag=${line#*refs/tags/}
 if [ -z "$tag" ]; then
     printf 'fatal: no tag matching %s\n' "$2" >&2
     exit 1
```

**File**: `packages/vcs/tests/CloneCommandTest.php` (modified, +14/-3)
```diff
@@ -127,9 +127,10 @@ public function testCloneChecksOutATagStartingWithADash(): void
     }
 
     /**
-     * `git ls-remote` lists tags in refname order, and the old lookup kept the
-     * last line. 0.1.10 is the newest version and sorts before 0.1.2; the
-     * annotated 0.1.2 is the tag that line names.
+     * `git ls-remote` lists tags in refname order, and the lookup keeps the
+     * last line. 0.1.10 sorts before 0.1.2; the annotated 0.1.2 is the tag
+     * that line names. A namespaced pattern keeps the full name after
+     * `refs/tags/`, so `release/0.1.*` resolves to `release/0.1.2`.
      */
     public function testCloneChecksOutATagPattern(): void
     {
@@ -141,6 +142,16 @@ public function testCloneChecksOutATagPattern(): void
         $this->assertSame(0, $this->clone('', '0.1.*', Git::CLONE_TYPE_TAG));
 
         $this->assertSame("tag-0.1.2\n", $this->read($this->directory . '/README.md'));
+
+        $this->tag('release/0.1.0', "tag-release-0.1.0\n");
+        $this->tag('release/0.1.10', "tag-release-0.1.10\n");
+        $this->tag('release/0.1.2', "tag-release-0.1.2\n", annotated: true);
+        $this->tag('release/0.2.0', "tag-release-0.2.0\n");
+
+        $this->execute(new Command('rm')->flag('-rf')->argument($this->directory));
+        $this->assertSame(0, $this->clone('', 'release/0.1.*', Git::CLONE_TYPE_TAG));
+
+        $this->assertSame("tag-release-0.1.2\n", $this->read($this->directory . '/README.md'));
     }
 
     public function testCloneChecksOutAnExactTag(): void
```

---

### Incident Patch 4: `4ab36cb3` (2026-10-05)
**Commit Message**: fix(mails): finish the job when a project's own SMTP server fails

A project's SMTP credentials or host are theirs to fix, so retrying cannot help and the failed list only grows. Cloud SMTP failures still fail the job.

**File**: `src/Appwrite/Platform/Workers/Mails.php` (modified, +4/-1)
```diff
@@ -234,8 +234,11 @@ public function action(Message $message, Document $project, Registry $register,
             Span::add('mail.status', 'failure');
 
             if ($type === 'smtp') {
-                throw new Exception('Error sending mail: ' . $error->getMessage(), 401);
+                Span::add('mail.error.message', $error->getMessage());
+
+                return;
             }
+
             throw new Exception('Error sending mail: ' . $error->getMessage(), 500);
         }
 
```

**File**: `tests/unit/Platform/Workers/MailsTest.php` (modified, +18/-2)
```diff
@@ -166,6 +166,19 @@ public function testProviderRejectionIsSkippedWithoutRetry(): void
         $this->assertSame(1, $adapter->sendCount);
     }
 
+    public function testProjectSmtpFailureIsNotRetried(): void
+    {
+        $adapter = new SpyMailAdapter();
+
+        $this->runMailWorker($adapter, recipient: 'john@example.test', smtp: [
+            'host' => '127.0.0.1',
+            'port' => 1,
+            'senderEmail' => 'sender@example.test',
+        ]);
+
+        $this->assertSame(0, $adapter->sendCount);
+    }
+
     private function assertMailWorkerThrows(SpyMailAdapter $adapter, string $expectedMessage): void
     {
         $this->expectException(\Exception::class);
@@ -174,7 +187,10 @@ private function assertMailWorkerThrows(SpyMailAdapter $adapter, string $expecte
         $this->runMailWorker($adapter, recipient: 'legacy@example.test');
     }
 
-    private function runMailWorker(SpyMailAdapter $adapter, string $recipient): void
+    /**
+     * @param array<string, mixed> $smtp
+     */
+    private function runMailWorker(SpyMailAdapter $adapter, string $recipient, array $smtp = []): void
     {
         $registry = new Registry();
         $registry->set('smtp', static fn () => new Pool(new Stack(), 'smtp', 1, static fn () => $adapter, 1.0));
@@ -190,7 +206,7 @@ private function runMailWorker(SpyMailAdapter $adapter, string $recipient): void
                     'queue' => 'v1-mails',
                     'timestamp' => \time(),
                     'payload' => [
-                        'smtp' => [],
+                        'smtp' => $smtp,
                         'recipient' => $recipient,
                         'name' => 'Legacy User',
                         'subject' => 'Hello',
```

---

### Incident Patch 5: `fcbd1e2a` (2026-10-05)
**Commit Message**: fix(vcs): resolve tag globs when cloning

Template versions such as 0.1.* are not refspecs. PR #14022 fetches
refs/tags/<version> directly, so those clones fail. Resolve a glob to the
last tag git ls-remote lists for it, the same tag the old GitHub and Origin
lookup selected, and keep exact tag names on the direct fetch.

Co-authored-by: Chirag Aggarwal <[REDACTED_EMAIL]>

**File**: `packages/vcs/src/Adapter/Git.php` (modified, +52/-7)
```diff
@@ -296,9 +296,8 @@ abstract public function getCommitStatuses(string $owner, string $repositoryName
 
     /**
      * Sparse, shallow clone of one ref into $directory, checking out only
-     * $rootDirectory. Every value reaches git as its own argument; the one
-     * shell script, the branch fallback, is constant and reads its values
-     * from positional parameters.
+     * $rootDirectory. Every value reaches git as its own argument. The shell
+     * scripts are constant and read their values from positional parameters.
      */
     protected function cloneCommand(string $cloneUrl, string $version, string $versionType, string $directory, string $rootDirectory): Command
     {
@@ -324,10 +323,7 @@ protected function cloneCommand(string $cloneUrl, string $version, string $versi
                 $this->git($directory)->argument('fetch')->option('--depth', '1')->argument('origin')->argument($version),
                 $this->git($directory)->argument('checkout')->argument($version),
             ),
-            self::CLONE_TYPE_TAG => Command::and(
-                $this->git($directory)->argument('fetch')->option('--depth', '1')->argument('origin')->argument('refs/tags/' . $version),
-                $this->git($directory)->argument('checkout')->argument('FETCH_HEAD'),
-            ),
+            self::CLONE_TYPE_TAG => $this->tagCheckout($directory, $version),
             default => throw new Exception("Unsupported clone type: {$versionType}"),
         };
 
@@ -349,6 +345,55 @@ protected function cloneCommand(string $cloneUrl, string $version, string $versi
         );
     }
 
+    /**
+     * Resolve a tag glob the way GitHub and Origin used to: the last tag
+     * `git ls-remote --tags` lists for the pattern
+     * (`tail -n 1 | awk -F/ '{print $3}'`). `--refs` omits the peeled `^{}`
+     * line of an annotated tag, so the name awk prints is the tag itself.
+     * The directory and the pattern arrive as `$1` and `$2`.
+     */
+    private const string TAG_GLOB_CHECKOUT = <<<'SCRIPT'
+refs=$(git -C "$1" ls-remote --refs --tags origin -- "$2") || exit
+tag=$(printf '%s\n' "$refs" | tail -n 1 | awk -F '/' '{print $3}')
+if [ -z "$tag" ]; then
+    printf 'fatal: no tag matching %s\n' "$2" >&2
+    exit 1
+fi
+git -C "$1" fetch --depth=1 origin "refs/tags/$tag" && git -C "$1" checkout FETCH_HEAD
+SCRIPT;
+
+    /**
+     * Check out $version. A glob is resolved to one tag. An exact name is
+     * fetched as refs/tags/<name>, so a leading dash stays part of the name.
+     */
+    private function tagCheckout(string $directory, string $version): Command
+    {
+        if (!$this->isTagGlob($version)) {
+            return Command::and(
+                $this->git($directory)->argument('fetch')->option('--depth', '1')->argument('origin')->argument('refs/tags/' . $version),
+                $this->git($directory)->argument('checkout')->argument('FETCH_HEAD'),
+            );
+        }
+
+        return new Command('sh')
+            ->flag('-c')
+            ->argument(self::TAG_GLOB_CHECKOUT)
+            ->argument('sh')
+            ->argument($directory)
+            ->argument($version);
+    }
+
+    /**
+     * True when $version is a git ref glob. `*`, `?` and `[` cannot appear in
+     * a tag name, and they are the wildcards `git ls-remote` matches on.
+     */
+    private function isTagGlob(string $version): bool
+    {
+        return str_contains($version, '*')
+            || str_contains($version, '?')
+            || str_contains($version, '[');
+    }
+
     /**
      * git, run against the repository in $directory
      */
```

**File**: `packages/vcs/tests/CloneCommandTest.php` (modified, +66/-3)
```diff
@@ -126,14 +126,77 @@ public function testCloneChecksOutATagStartingWithADash(): void
         $this->assertFileExists($this->directory . '/README.md');
     }
 
-    private function clone(string $rootDirectory, string $version = 'main', string $versionType = Git::CLONE_TYPE_BRANCH): int
+    /**
+     * `git ls-remote` lists tags in refname order, and the old lookup kept the
+     * last line. 0.1.10 is the newest version and sorts before 0.1.2; the
+     * annotated 0.1.2 is the tag that line names.
+     */
+    public function testCloneChecksOutATagPattern(): void
+    {
+        $this->tag('0.1.0', "tag-0.1.0\n");
+        $this->tag('0.1.10', "tag-0.1.10\n");
+        $this->tag('0.1.2', "tag-0.1.2\n", annotated: true);
+        $this->tag('0.2.0', "tag-0.2.0\n");
+
+        $this->assertSame(0, $this->clone('', '0.1.*', Git::CLONE_TYPE_TAG));
+
+        $this->assertSame("tag-0.1.2\n", $this->read($this->directory . '/README.md'));
+    }
+
+    public function testCloneChecksOutAnExactTag(): void
+    {
+        $this->tag('1.2.3', "tag-1.2.3\n");
+        $this->tag('1.2.4', "tag-1.2.4\n");
+
+        $this->assertSame(0, $this->clone('', '1.2.3', Git::CLONE_TYPE_TAG));
+
+        $this->assertSame("tag-1.2.3\n", $this->read($this->directory . '/README.md'));
+    }
+
+    public function testCloneFailsWhenNoTagMatches(): void
+    {
+        $this->tag('0.1.0', "tag-0.1.0\n");
+
+        $stderr = '';
+        $this->assertNotSame(0, $this->clone('', '9.9.*', Git::CLONE_TYPE_TAG, $stderr));
+        $this->assertStringContainsString('fatal: no tag matching 9.9.*', $stderr);
+    }
+
+    private function tag(string $name, string $content, bool $annotated = false): void
+    {
+        $work = $this->workspace . '/work';
+        if (!is_dir($work . '/.git')) {
+            $this->assertSame(0, $this->execute(new Command('git')->argument('clone')->flag('-q')->argument($this->repository)->argument($work)));
+        }
+
+        file_put_contents($work . '/README.md', $content);
+        $this->assertSame(0, $this->execute(new Command('git')->option('-C', $work)->argument('add')->argument('README.md')));
+        $this->assertSame(0, $this->execute(new Command('git')->option('-C', $work)->option('-c', 'user.name=Test')->option('-c', 'user.email=test@example.com')->argument('commit')->flag('-q')->option('-m', $name)));
+
+        $tag = new Command('git')->option('-C', $work)->option('-c', 'user.name=Test')->option('-c', 'user.email=test@example.com')->argument('tag');
+        if ($annotated) {
+            $tag->flag('-a')->option('-m', $name);
+        }
+        $this->assertSame(0, $this->execute($tag->argument($name)));
+        $this->assertSame(0, $this->execute(new Command('git')->option('-C', $work)->argument('push')->flag('-q')->argument('origin')->argument('refs/tags/' . $name)));
+    }
+
+    private function read(string $path): string
+    {
+        $content = file_get_contents($path);
+        $this->assertIsString($content);
+
+        return $content;
+    }
+
+    private function clone(string $rootDirectory, string $version = 'main', string $versionType = Git::CLONE_TYPE_BRANCH, string &$stderr = ''): int
     {
         $adapter = new LocalGit($this->repository);
 
-        return $this->execute($adapter->generateCloneCommand('owner', 'repository', $version, $versionType, $this->directory, $rootDirectory));
+        return $this->execute($adapter->generateCloneCommand('owner', 'repository', $version, $versionType, $this->directory, $rootDirectory), $stderr);
     }
 
-    private function execute(Command $command): int
+    private function execute(Command $command, string &$stderr = ''): int
     {
         $stdout = '';
         $stderr = '';
```

---

### Incident Patch 6: `bd11153e` (2026-10-05)
**Commit Message**: fix: keep the fixture IP out of the dynamic range

**File**: `docker-compose.override.yml` (modified, +1/-0)
```diff
@@ -674,6 +674,7 @@ networks:
     ipam:
       config:
         - subnet: 203.0.0.0/24
+          ip_range: 203.0.0.128/25
           gateway: 203.0.0.254
 volumes:
   appwrite-gitea: null
```

---

### Incident Patch 7: `8379170f` (2026-10-05)
**Commit Message**: Merge pull request #14125 from appwrite/fix-certificate-retry-errors

**File**: `src/Appwrite/Platform/Workers/Certificates.php` (modified, +5/-3)
```diff
@@ -381,17 +381,19 @@ private function handleCertificateGenerationAction(
             ]);
 
             if ($awaitingProvider && $attempts < self::MAX_GENERATION_ATTEMPTS) {
-                // Nothing retries 'unverified', so keep the rule generating while attempts remain
+                // Nothing retries 'unverified', so keep the rule generating while attempts remain.
+                // The interval retries it, so this is a wait, not a worker error.
                 $rule->setAttribute('status', RULE_STATUS_CERTIFICATE_GENERATING);
+                Console::warning('Certificate for ' . $domain->get() . ' will be retried: ' . $e->getMessage());
             } else {
                 // Mark rule as 'unverified'
                 $rule->setAttribute('status', RULE_STATUS_CERTIFICATE_GENERATION_FAILED);
 
                 // Send email to security email
                 $this->notifyError($domain->get(), $e->getMessage(), $attempts, $publisherForMails, $plan, $dbForPlatform->getDocument('projects', 'console'));
-            }
 
-            throw $e;
+                throw $e;
+            }
         } finally {
             // Update certificate document with logs
             $certificate->setAttribute('logs', $logs);
```

---

### Incident Patch 8: `6f2b3450` (2026-10-05)
**Commit Message**: fix(certificates): stop reporting a retryable certificate failure as a worker error

A delayed provider's failure that keeps the rule generating for another attempt was still rethrown, so every interval retry of a domain waiting on its owner's DNS records reached the error tracker. Log it and let the interval retry; only the final failure, which marks the rule unverified and mails, is rethrown.

**File**: `src/Appwrite/Platform/Workers/Certificates.php` (modified, +5/-3)
```diff
@@ -381,17 +381,19 @@ private function handleCertificateGenerationAction(
             ]);
 
             if ($awaitingProvider && $attempts < self::MAX_GENERATION_ATTEMPTS) {
-                // Nothing retries 'unverified', so keep the rule generating while attempts remain
+                // Nothing retries 'unverified', so keep the rule generating while attempts remain.
+                // The interval retries it, so this is a wait, not a worker error.
                 $rule->setAttribute('status', RULE_STATUS_CERTIFICATE_GENERATING);
+                Console::warning('Certificate for ' . $domain->get() . ' will be retried: ' . $e->getMessage());
             } else {
                 // Mark rule as 'unverified'
                 $rule->setAttribute('status', RULE_STATUS_CERTIFICATE_GENERATION_FAILED);
 
                 // Send email to security email
                 $this->notifyError($domain->get(), $e->getMessage(), $attempts, $publisherForMails, $plan, $dbForPlatform->getDocument('projects', 'console'));
-            }
 
-            throw $e;
+                throw $e;
+            }
         } finally {
             // Update certificate document with logs
             $certificate->setAttribute('logs', $logs);
```

---

### Incident Patch 9: `b707cb01` (2026-10-05)
**Commit Message**: Merge pull request #14101 from appwrite/fix/14099-proof-for-password-params

fix(auth): use configured Argon2 params on signup and user create

**File**: `app/controllers/api/account.php` (modified, +13/-11)
```diff
@@ -319,7 +319,8 @@
     ->inject('hooks')
     ->inject('plan')
     ->inject('pwnedPasswords')
-    ->action(function (string $userId, string $email, string $password, ?string $name, Request $request, Response $response, Document $user, Document $project, Database $dbForProject, Authorization $authorization, Hooks $hooks, array $plan, PasswordPwned $pwnedPasswords) {
+    ->inject('proofForPassword')
+    ->action(function (string $userId, string $email, string $password, ?string $name, Request $request, Response $response, Document $user, Document $project, Database $dbForProject, Authorization $authorization, Hooks $hooks, array $plan, PasswordPwned $pwnedPasswords, ProofsPassword $proofForPassword) {
         $name ??= '';
         $email = \strtolower($email);
         if ('console' === $project->getId()) {
@@ -376,8 +377,7 @@
         $hooks->trigger('passwordValidator', [$dbForProject, $project, $password, &$user, true]);
 
         $passwordHistory = $project->getAttribute('auths', [])['passwordHistory'] ?? 0;
-        $proof = new ProofsPassword();
-        $hash = $proof->hash($password);
+        $hash = $proofForPassword->hash($password);
         $emailMetadata = [
             'emailCanonical' => null,
             'emailIsCanonical' => null,
@@ -431,8 +431,8 @@
                 'password' => $hash,
                 'passwordHistory' => $passwordHistory > 0 ? [$hash] : [],
                 'passwordUpdate' => DateTime::now(),
-                'hash' => $proof->getHash()->getName(),
-                'hashOptions' => $proof->getHash()->getOptions(),
+                'hash' => $proofForPassword->getHash()->getName(),
+                'hashOptions' => $proofForPassword->getHash()->getOptions(),
                 'registration' => DateTime::now(),
                 'reset' => false,
                 'name' => $name,
@@ -1109,13 +1109,15 @@
             }
         }
 
-        // Re-hash if not using recommended algo
-        if ($user->getAttribute('hash') !== $proofForPassword->getHash()->getName()) {
-            $proofForPasswordUpdated = new ProofsPassword();
+        // Re-hash if not using recommended algo or its configured costs (read from the hash, not hashOptions)
+        if (
+            $user->getAttribute('hash') !== $proofForPassword->getHash()->getName()
+            || \password_needs_rehash($user->getAttribute('password'), PASSWORD_ARGON2ID, $proofForPassword->getHash()->getOptions())
+        ) {
             $user
-                ->setAttribute('password', $proofForPasswordUpdated->hash($password))
-                ->setAttribute('hash', $proofForPasswordUpdated->getHash()->getName())
-                ->setAttribute('hashOptions', $proofForPasswordUpdated->getHash()->getOptions());
+                ->setAttribute('password', $proofForPassword->hash($password))
+                ->setAttribute('hash', $proofForPassword->getHash()->getName())
+                ->setAttribute('hashOptions', $proofForPassword->getHash()->getOptions());
             $dbForProject->updateDocument('users', $user->getId(), new Document([
                 'password' => $user->getAttribute('password'),
                 'hash' => $user->getAttribute('hash'),
```

**File**: `src/Appwrite/Platform/Modules/Users/Base.php` (modified, +5/-6)
```diff
@@ -21,7 +21,7 @@
 
 class Base extends Action
 {
-    protected function createUser(Hash $hash, string $userId, ?string $email, ?string $password, ?string $phone, ?string $name, Document $project, Database $dbForProject, Hooks $hooks, array $plan, ?bool $passwordPwned = null): Document
+    protected function createUser(Hash $hash, string $userId, ?string $email, ?string $password, ?string $phone, ?string $name, Document $project, Database $dbForProject, Hooks $hooks, array $plan, ProofsPassword $proofForPassword, ?bool $passwordPwned = null): Document
     {
         $name = $name ?? '';
         $plaintextPassword = $password;
@@ -99,17 +99,16 @@ protected function createUser(Hash $hash, string $userId, ?string $email, ?strin
 
             $isHashed = !$hash instanceof Plaintext;
 
-            $defaultHash = new ProofsPassword();
             if (!empty($password)) {
-                if (!$isHashed) { // Password was never hashed, hash it with the default hash
-                    $hashedPassword = $defaultHash->hash($password);
-                    $hash = $defaultHash->getHash();
+                if (!$isHashed) { // Password was never hashed, hash it with the configured default
+                    $hashedPassword = $proofForPassword->hash($password);
+                    $hash = $proofForPassword->getHash();
                 } else {
                     $hashedPassword = $password;
                 }
             } else {
                 // when password is not provided, plaintext was set as the default hash causing the issue
-                $hash = $defaultHash->getHash();
+                $hash = $proofForPassword->getHash();
                 $isHashed = !$hash instanceof Plaintext;
             }
 
```

**File**: `src/Appwrite/Platform/Modules/Users/Http/Users/Argon2/Create.php` (modified, +4/-2)
```diff
@@ -12,6 +12,7 @@
 use Appwrite\Utopia\Database\Validator\CustomId;
 use Appwrite\Utopia\Response;
 use Utopia\Auth\Hashes\Argon2;
+use Utopia\Auth\Proofs\Password as ProofsPassword;
 use Utopia\Database\Database;
 use Utopia\Database\Document;
 use Utopia\Emails\Validator\Email as EmailValidator;
@@ -59,14 +60,15 @@ public function __construct()
             ->inject('dbForProject')
             ->inject('hooks')
             ->inject('plan')
+            ->inject('proofForPassword')
             ->callback($this->action(...));
     }
 
-    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan): void
+    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan, ProofsPassword $proofForPassword): void
     {
         $argon2 = new Argon2();
 
-        $user = $this->createUser($argon2, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan);
+        $user = $this->createUser($argon2, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan, $proofForPassword);
 
         $response
             ->setStatusCode(Response::STATUS_CODE_CREATED)
```

**File**: `src/Appwrite/Platform/Modules/Users/Http/Users/Bcrypt/Create.php` (modified, +4/-2)
```diff
@@ -12,6 +12,7 @@
 use Appwrite\Utopia\Database\Validator\CustomId;
 use Appwrite\Utopia\Response;
 use Utopia\Auth\Hashes\Bcrypt;
+use Utopia\Auth\Proofs\Password as ProofsPassword;
 use Utopia\Database\Database;
 use Utopia\Database\Document;
 use Utopia\Emails\Validator\Email as EmailValidator;
@@ -59,15 +60,16 @@ public function __construct()
             ->inject('dbForProject')
             ->inject('hooks')
             ->inject('plan')
+            ->inject('proofForPassword')
             ->callback($this->action(...));
     }
 
-    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan): void
+    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan, ProofsPassword $proofForPassword): void
     {
         $bcrypt = new Bcrypt();
         $bcrypt->setCost(8); // Default cost
 
-        $user = $this->createUser($bcrypt, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan);
+        $user = $this->createUser($bcrypt, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan, $proofForPassword);
 
         $response
             ->setStatusCode(Response::STATUS_CODE_CREATED)
```

**File**: `src/Appwrite/Platform/Modules/Users/Http/Users/Create.php` (modified, +4/-2)
```diff
@@ -17,6 +17,7 @@
 use Appwrite\Utopia\Database\Validator\CustomId;
 use Appwrite\Utopia\Response;
 use Utopia\Auth\Hashes\Plaintext;
+use Utopia\Auth\Proofs\Password as ProofsPassword;
 use Utopia\Database\Database;
 use Utopia\Database\Document;
 use Utopia\Emails\Validator\Email as EmailValidator;
@@ -69,10 +70,11 @@ public function __construct()
             ->inject('hooks')
             ->inject('plan')
             ->inject('pwnedPasswords')
+            ->inject('proofForPassword')
             ->callback($this->action(...));
     }
 
-    public function action(string $userId, ?string $email, ?string $phone, ?string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan, PasswordPwned $pwnedPasswords): void
+    public function action(string $userId, ?string $email, ?string $phone, ?string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan, PasswordPwned $pwnedPasswords, ProofsPassword $proofForPassword): void
     {
         $pwnedPolicy = $project->getAttribute('auths', [])['passwordPwned'] ?? [];
         $passwordPwned = empty($password) || !($pwnedPolicy['enabled'] ?? true)
@@ -84,7 +86,7 @@ public function action(string $userId, ?string $email, ?string $phone, ?string $
 
         $plaintext = new Plaintext();
 
-        $user = $this->createUser($plaintext, $userId, $email, $password, $phone, $name, $project, $dbForProject, $hooks, $plan, $passwordPwned);
+        $user = $this->createUser($plaintext, $userId, $email, $password, $phone, $name, $project, $dbForProject, $hooks, $plan, $proofForPassword, $passwordPwned);
 
         $response
             ->setStatusCode(Response::STATUS_CODE_CREATED)
```

**File**: `src/Appwrite/Platform/Modules/Users/Http/Users/MD5/Create.php` (modified, +4/-2)
```diff
@@ -12,6 +12,7 @@
 use Appwrite\Utopia\Database\Validator\CustomId;
 use Appwrite\Utopia\Response;
 use Utopia\Auth\Hashes\MD5;
+use Utopia\Auth\Proofs\Password as ProofsPassword;
 use Utopia\Database\Database;
 use Utopia\Database\Document;
 use Utopia\Emails\Validator\Email as EmailValidator;
@@ -59,14 +60,15 @@ public function __construct()
             ->inject('dbForProject')
             ->inject('hooks')
             ->inject('plan')
+            ->inject('proofForPassword')
             ->callback($this->action(...));
     }
 
-    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan): void
+    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan, ProofsPassword $proofForPassword): void
     {
         $md5 = new MD5();
 
-        $user = $this->createUser($md5, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan);
+        $user = $this->createUser($md5, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan, $proofForPassword);
 
         $response
             ->setStatusCode(Response::STATUS_CODE_CREATED)
```

**File**: `src/Appwrite/Platform/Modules/Users/Http/Users/PHPass/Create.php` (modified, +4/-2)
```diff
@@ -12,6 +12,7 @@
 use Appwrite\Utopia\Database\Validator\CustomId;
 use Appwrite\Utopia\Response;
 use Utopia\Auth\Hashes\PHPass;
+use Utopia\Auth\Proofs\Password as ProofsPassword;
 use Utopia\Database\Database;
 use Utopia\Database\Document;
 use Utopia\Emails\Validator\Email as EmailValidator;
@@ -59,14 +60,15 @@ public function __construct()
             ->inject('dbForProject')
             ->inject('hooks')
             ->inject('plan')
+            ->inject('proofForPassword')
             ->callback($this->action(...));
     }
 
-    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan): void
+    public function action(string $userId, string $email, string $password, ?string $name, Response $response, Document $project, Database $dbForProject, Hooks $hooks, array $plan, ProofsPassword $proofForPassword): void
     {
         $phpass = new PHPass();
 
-        $user = $this->createUser($phpass, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan);
+        $user = $this->createUser($phpass, $userId, $email, $password, null, $name, $project, $dbForProject, $hooks, $plan, $proofForPassword);
 
         $response
             ->setStatusCode(Response::STATUS_CODE_CREATED)
```

**File**: `src/Appwrite/Platform/Modules/Users/Http/Users/Password/Update.php` (modified, +4/-6)
```diff
@@ -17,7 +17,6 @@
 use Appwrite\SDK\Specification\Validator\PasswordFormat;
 use Appwrite\Utopia\Database\Documents\User;
 use Appwrite\Utopia\Response;
-use Utopia\Auth\Hashes\Argon2;
 use Utopia\Auth\Proofs\Password as ProofsPassword;
 use Utopia\Database\Database;
 use Utopia\Database\DateTime;
@@ -69,10 +68,11 @@ public function __construct()
             ->inject('queueForEvents')
             ->inject('hooks')
             ->inject('pwnedPasswords')
+            ->inject('proofForPassword')
             ->callback($this->action(...));
     }
 
-    public function action(string $userId, string $password, Response $response, Document $project, Database $dbForProject, Event $queueForEvents, Hooks $hooks, PasswordPwned $pwnedPasswords): void
+    public function action(string $userId, string $password, Response $response, Document $project, Database $dbForProject, Event $queueForEvents, Hooks $hooks, PasswordPwned $pwnedPasswords, ProofsPassword $proofForPassword): void
     {
         $user = $dbForProject->getDocument('users', $userId);
 
@@ -111,10 +111,8 @@ public function action(string $userId, string $password, Response $response, Doc
 
         $hooks->trigger('passwordValidator', [$dbForProject, $project, $password, &$user, true]);
 
-        // Create Argon2 hasher with default settings
-        $hasher = new Argon2();
-
-        $newPassword = $hasher->hash($password);
+        $newPassword = $proofForPassword->hash($password);
+        $hasher = $proofForPassword->getHash();
 
         $hash = ProofsPassword::createHash($user->getAttribute('hash'), $user->getAttribute('hashOptions'));
         $historyLimit = $project->getAttribute('auths', [])['passwordHistory'] ?? 0;
```

---

### Incident Patch 10: `851c7680` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/14099-proof-for-password-params

**File**: `packages/cdn/src/Certificates/Provider/Fastly.php` (modified, +2/-1)
```diff
@@ -34,6 +34,7 @@ public function __construct(
         private readonly string $apiBase = 'https://api.fastly.com',
         private readonly int $deploymentPollAttempts = 10,
         private readonly int $deploymentPollIntervalMilliseconds = 5000,
+        string $tlsConfigurationId = '',
     ) {
         if ($this->deploymentPollAttempts < 1) {
             throw new \InvalidArgumentException('Deployment poll attempts must be at least one.');
@@ -46,7 +47,7 @@ public function __construct(
         $this->client = $client ?? new Client(new CurlAdapter());
         $this->tls = new FastlyTls(
             apiToken: $this->apiToken,
-            tlsConfigurationId: '',
+            tlsConfigurationId: $tlsConfigurationId,
             certificateAuthority: $certificateAuthority,
             client: $this->client,
             apiBase: $this->apiBase,
```

**File**: `packages/cdn/src/Certificates/Provider/FastlyTls.php` (modified, +218/-1)
```diff
@@ -44,7 +44,12 @@ public function issueCertificate(string $certName, string $domain, ?string $doma
             $subscription = $this->retrySubscription($subscription['resource']['id']);
         }
 
-        return $this->extractRenewDate($subscription);
+        $renewDate = $this->extractRenewDate($subscription);
+        if ($renewDate !== null) {
+            $this->ensureActivated($subscription, $domain);
+        }
+
+        return $renewDate;
     }
 
     public function isInstantGeneration(string $domain, ?string $domainType): bool
@@ -65,6 +70,10 @@ public function getCertificateStatus(string $domain, ?string $domainType): strin
 
         $status = $this->mapStatus($subscription['resource']['attributes']['state'] ?? '');
 
+        if ($status === Status::ISSUED && !$this->ensureActivated($subscription, $domain)) {
+            return Status::PROCESSING;
+        }
+
         // An issued certificate needs nothing from the domain owner, whatever
         // an authorization left over from an earlier order still says.
         if ($status === Status::ISSUED || $status === Status::UNKNOWN) {
@@ -76,6 +85,10 @@ public function getCertificateStatus(string $domain, ?string $domainType): strin
         // subscription state alone cannot tell waiting from progress.
         $authorizations = $this->findAuthorizations($subscription, $domain);
         if ($status !== Status::FAILED && !$this->isBlocked($authorizations)) {
+            if ($status === Status::RENEWING && !$this->ensureActivated($subscription, $domain)) {
+                return Status::PROCESSING;
+            }
+
             return $status;
         }
 
@@ -416,6 +429,210 @@ private function retrySubscription(string $subscriptionId): array
         return ['resource' => $data, 'included' => \is_array($included) ? array_values(array_filter($included, is_array(...))) : []];
     }
 
+    /**
+     * Without an activation, the hostname keeps serving the shared default
+     * certificate instead of this one.
+     *
+     * @param array{resource:array<string, mixed>,included:array<int, array<string, mixed>>} $subscription
+     * @return bool False when Fastly reports the subscription issued or renewing before its certificate appears.
+     */
+    private function ensureActivated(array $subscription, string $domain): bool
+    {
+        if ($this->tlsConfigurationId === '') {
+            return true;
+        }
+
+        $certificateId = $this->issuedCertificateId($subscription);
+        if ($certificateId === null) {
+            return false;
+        }
+
+        // Every hostname on the subscription, so the apex also activates www when one certificate covers both
+        $hostnames = [];
+        foreach ([...$this->references($subscription['resource'], 'tls_domains'), $domain] as $name) {
+            $hostnames[strtolower($name)] ??= $name;
+        }
+
+        foreach ($hostnames as $hostname) {
+            $activation = $this->findActivation($hostname);
+
+            if ($activation === null) {
+                $this->createActivation($certificateId, $hostname);
+                continue;
+            }
+
+            if ($activation['certificate'] === $certificateId) {
+                continue;
+            }
+
+            // A renewal leaves the hostname on the subscription's previous certificate
+            if (!\in_array($activation['certificate'], $this->references($subscription['resource'], 'tls_certificates'), true)) {
+                throw new \RuntimeException('Another certificate already terminates TLS for ' . $hostname . '.');
+            }
+
+            $this->updateActivation($activation['id'], $certificateId, $hostname);
+        }
+
+        return true;
+    }
+
+    /**
+     * The latest-expiring certificate, so a renewal activates the new one.
+     *
+     * @param array{resource:array<string, mixed>,included:array<int, array<string, mixed>>} $subscription
+     */
+    private function issuedCertificateId(array $subscription): ?string
+    {
+        $ids = $this->references($subscription['resource'], 'tls_certificates');
+
+        $bestId = null;
+        $bestExpiry = null;
+        foreach ($subscription['included'] as $included) {
+            if (($included['type'] ?? null) !== 'tls_certificate' || !\in_array($included['id'] ?? null, $ids, true)) {
+                continue;
+            }
+
+            $attributes = $included['attributes'] ?? null;
+            $notAfter = \is_array($attributes) ? ($attributes['not_after'] ?? null) : null;
+            $expiry = \is_string($notAfter) ? strtotime($notAfter) : false;
+            if ($expiry === false) {
+                continue;
+            }
+
+            if ($bestExpiry === null || $expiry > $bestExpiry) {
+                $bestExpiry = $expiry;
+                $bestId = $included['id'];
+            }
+        }
+
+        // Without an expiry to compare, the last reference is the newest.
+        return \is_string($bestId) ? $be
```

**File**: `packages/cdn/tests/Certificates/Provider/FastlyTest.php` (modified, +41/-0)
```diff
@@ -6,6 +6,7 @@
 
 use PHPUnit\Framework\TestCase;
 use Utopia\Cdn\Certificates\Provider\Fastly;
+use Utopia\Cdn\Certificates\Status;
 use Utopia\Cdn\Tests\TestClient;
 use Utopia\Psr7\Response;
 use Utopia\Psr7\Stream;
@@ -31,6 +32,46 @@ public function testIssueCreatesDomainAndTlsSubscription(): void
         $this->assertSame('example.com', $client->calls[3]['body']['data']['relationships']['tls_domains']['data'][0]['id']);
     }
 
+    public function testTlsConfigurationActivatesIssuedCertificate(): void
+    {
+        $client = new TestClient([
+            $this->json('{"data":[{"id":"sub_1","attributes":{"state":"issued"},"relationships":{"tls_certificates":{"data":[{"id":"cert_1","type":"tls_certificate"}]},"tls_domains":{"data":[{"id":"example.com","type":"tls_domain"}]}}}]}'),
+            $this->json('{"data":[]}'),
+            $this->json('{}', 201),
+        ]);
+
+        $status = new Fastly('token', 'service_1', client: $client, tlsConfigurationId: 'tls_config_1')
+            ->getCertificateStatus('example.com', null);
+
+        $this->assertSame(Status::ISSUED, $status);
+        $this->assertCount(3, $client->calls);
+        $this->assertStringContainsString('filter%5Btls_configuration.id%5D=tls_config_1', $client->calls[1]['url']);
+        $this->assertSame('POST', $client->calls[2]['method']);
+        $this->assertSame('https://api.fastly.com/tls/activations', $client->calls[2]['url']);
+        $this->assertSame([
+            'data' => [
+                'type' => 'tls_activation',
+                'relationships' => [
+                    'tls_certificate' => ['data' => ['type' => 'tls_certificate', 'id' => 'cert_1']],
+                    'tls_configuration' => ['data' => ['type' => 'tls_configuration', 'id' => 'tls_config_1']],
+                    'tls_domain' => ['data' => ['type' => 'tls_domain', 'id' => 'example.com']],
+                ],
+            ],
+        ], $client->calls[2]['body']);
+    }
+
+    public function testIssuedCertificateWithoutATlsConfigurationIsNotActivated(): void
+    {
+        $client = new TestClient([
+            $this->json('{"data":[{"id":"sub_1","attributes":{"state":"issued"},"relationships":{"tls_certificates":{"data":[{"id":"cert_1","type":"tls_certificate"}]}}}]}'),
+        ]);
+
+        $status = new Fastly('token', 'service_1', client: $client)->getCertificateStatus('example.com', null);
+
+        $this->assertSame(Status::ISSUED, $status);
+        $this->assertCount(1, $client->calls);
+    }
+
     public function testBlockedTlsLeavesVersionlessDomainOnItsCurrentService(): void
     {
         $blocked = json_encode([
```

**File**: `packages/cdn/tests/Certificates/Provider/FastlyTlsTest.php` (modified, +249/-18)
```diff
@@ -51,9 +51,11 @@ public function testIssueCertificateCanUseFastlyDomainManagementWithoutAConfigur
 
     public function testGetCertificateStatusMapsFastlyState(): void
     {
+        $issued = '{"data":[{"id":"sub_123","attributes":{"state":"issued"},"relationships":{"tls_certificates":{"data":[{"type":"tls_certificate","id":"cert_1"}]}}}]}';
         $client = new TestClient([
-            new Response(200, body: new Stream('{"data":[{"id":"sub_123","attributes":{"state":"issued"}}]}')),
-            new Response(200, body: new Stream('{"data":[{"id":"sub_123","attributes":{"state":"issued"}}]}')),
+            new Response(200, body: new Stream($issued)),
+            new Response(200, body: new Stream('{"data":[{"id":"act_1","type":"tls_activation","relationships":{"tls_certificate":{"data":{"type":"tls_certificate","id":"cert_1"}}}}]}')),
+            new Response(200, body: new Stream($issued)),
         ]);
 
         $provider = new FastlyTls('token', 'tls-config-id', 'certainly', $client);
@@ -79,21 +81,26 @@ public function testDeleteCertificateRemovesSubscription(): void
 
     public function testIssueCertificateReturnsRenewDateFromIncludedCertificate(): void
     {
-        $client = new TestClient([new Response(200, body: new Stream(json_encode([
-            'data' => [[
-                'id' => 'sub_123',
-                'attributes' => ['state' => 'issued'],
-                'relationships' => ['tls_certificates' => ['data' => [['type' => 'tls_certificate', 'id' => 'cert_1']]]],
-            ]],
-            'included' => [[
-                'type' => 'tls_certificate',
-                'id' => 'cert_1',
-                'attributes' => ['not_after' => '2027-02-01T00:00:00Z'],
-            ]],
-        ])))]);
+        $client = new TestClient([
+            new Response(200, body: new Stream(json_encode([
+                'data' => [[
+                    'id' => 'sub_123',
+                    'attributes' => ['state' => 'issued'],
+                    'relationships' => ['tls_certificates' => ['data' => [['type' => 'tls_certificate', 'id' => 'cert_1']]]],
+                ]],
+                'included' => [[
+                    'type' => 'tls_certificate',
+                    'id' => 'cert_1',
+                    'attributes' => ['not_after' => '2027-02-01T00:00:00Z'],
+                ]],
+            ]))),
+            new Response(200, body: new Stream('{"data":[]}')),
+            new Response(201, body: new Stream('{"data":{"id":"act_1","type":"tls_activation"}}')),
+        ]);
 
         $provider = new FastlyTls('token', 'tls-config-id', 'certainly', $client);
         $this->assertSame('2027-01-02 00:00:00.000', $provider->issueCertificate('cert', 'example.com', null));
+        $this->assertSame([['domain' => 'example.com', 'certificate' => 'cert_1']], $this->activations($client));
     }
 
     public function testRetriesFailedSubscriptionWithForce(): void
@@ -230,9 +237,194 @@ public function testFailedSubscriptionWithoutAuthorizationsIsStillReported(): vo
 
     public function testIssuedSubscriptionIgnoresStaleAuthorization(): void
     {
+        $client = new TestClient([
+            $this->json($this->subscription(state: 'issued', certificates: [['type' => 'tls_certificate', 'id' => 'cert_1']])),
+            $this->json($this->activation('cert_1')),
+        ]);
+
+        $this->assertSame(Status::ISSUED, new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null));
+    }
+
+    public function testIssuedSubscriptionWithoutACertificateIsStillProcessing(): void
+    {
+        // Issued, but no certificate on the subscription yet.
         $client = new TestClient([$this->json($this->subscription(state: 'issued'))]);
 
+        $this->assertSame(Status::PROCESSING, new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null));
+        $this->assertCount(1, $client->calls);
+    }
+
+    public function testRenewingSubscriptionWithoutACertificateIsStillProcessing(): void
+    {
+        $client = new TestClient([$this->json($this->subscription(state: 'renewing', authorizationState: 'passing'))]);
+
+        $this->assertSame(Status::PROCESSING, new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null));
+        $this->assertCount(1, $client->calls);
+    }
+
+    public function testRenewingSubscriptionActivatesItsCertificate(): void
+    {
+        $client = new TestClient([
+            $this->json($this->subscription(state: 'renewing', authorizationState: 'passing', certificates: [['type' => 'tls_certificate', 'id' => 'cert_1']])),
+            $this->json(['data' => []]),
+            $this->json(['data' => ['id' => 'act_1', 'type' => 'tls_activation']], 201),
+        ]);
+
+        $this->assertSame(Status::RENEWING, new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null)
```

**File**: `packages/vcs/src/Adapter/Git/GitHub.php` (modified, +7/-0)
```diff
@@ -8,6 +8,7 @@
 use Utopia\Command;
 use Utopia\VCS\Adapter\Git;
 use Utopia\VCS\Exception\FileNotFound;
+use Utopia\VCS\Exception\OwnerNotFound;
 use Utopia\VCS\Exception\RepositoryNotFound;
 
 class GitHub extends Git
@@ -713,6 +714,12 @@ public function getOwnerName(string $installationId, ?int $repositoryId = null):
         $url = '/app/installations/' . $installationId;
         $response = $this->call(self::METHOD_GET, $url, ['Authorization' => "Bearer $this->jwtToken"]);
 
+        // Only a missing installation is permanent; rate limits and server errors stay retryable failures
+        $responseHeaders = $response['headers'] ?? [];
+        if (\is_array($responseHeaders) && ($responseHeaders['status-code'] ?? 0) === 404) {
+            throw new OwnerNotFound("Installation '{$installationId}' was not found.");
+        }
+
         $responseBody = $response['body'] ?? [];
         $responseBodyAccount = $responseBody['account'] ?? [];
 
```

**File**: `packages/vcs/src/Exception/OwnerNotFound.php` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+<?php
+
+declare(strict_types=1);
+
+namespace Utopia\VCS\Exception;
+
+class OwnerNotFound extends \Exception
+{
+}
```

**File**: `packages/vcs/tests/GitHubTest.php` (modified, +66/-0)
```diff
@@ -8,6 +8,7 @@
 use Utopia\Cache\Adapter\None;
 use Utopia\Cache\Cache;
 use Utopia\VCS\Adapter\Git\GitHub;
+use Utopia\VCS\Exception\OwnerNotFound;
 
 final class GitHubTest extends Base
 {
@@ -277,4 +278,69 @@ public static function encodedPemProvider(): \Iterator
         yield 'wrapped base64' => [fn (string $pem): string => chunk_split(base64_encode($pem), 76, "\n")];
         yield 'escaped newlines' => [fn (string $pem): string => str_replace("\n", '\n', $pem)];
     }
+
+    public function testGetOwnerNameForMissingInstallationThrowsOwnerNotFound(): void
+    {
+        $adapter = $this->installationResponse(404, ['message' => 'Not Found']);
+
+        $this->expectException(OwnerNotFound::class);
+
+        $adapter->getOwnerName('1234');
+    }
+
+    /**
+     * @param array<string, mixed> $body
+     */
+    #[DataProvider('transientInstallationResponses')]
+    public function testGetOwnerNameKeepsTransientFailuresRetryable(int $status, array $body): void
+    {
+        $adapter = $this->installationResponse($status, $body);
+
+        try {
+            $adapter->getOwnerName('1234');
+            $this->fail('A failed installation lookup must throw');
+        } catch (\Exception $error) {
+            $this->assertNotInstanceOf(OwnerNotFound::class, $error);
+        }
+    }
+
+    /**
+     * @return iterable<string, array{int, array<string, mixed>}>
+     */
+    public static function transientInstallationResponses(): iterable
+    {
+        yield 'rate limited' => [403, ['message' => 'API rate limit exceeded']];
+        yield 'too many requests' => [429, ['message' => 'You have exceeded a secondary rate limit']];
+        yield 'server error' => [502, ['message' => 'Server Error']];
+    }
+
+    public function testGetOwnerNameReturnsInstallationLogin(): void
+    {
+        $adapter = $this->installationResponse(200, ['account' => ['login' => 'appwrite']]);
+
+        $this->assertSame('appwrite', $adapter->getOwnerName('1234'));
+    }
+
+    /**
+     * @param array<string, mixed> $body
+     */
+    private function installationResponse(int $status, array $body): GitHub
+    {
+        return new class ($status, $body) extends GitHub {
+            protected string $jwtToken = 'app-token';
+
+            /**
+             * @param array<string, mixed> $body
+             */
+            public function __construct(private readonly int $status, private readonly array $body)
+            {
+                parent::__construct(new Cache(new None()));
+            }
+
+            protected function call(string $method, string $path = '', array $headers = [], array $params = [], bool $decode = true, bool $followRedirects = true): array
+            {
+                return ['body' => $this->body, 'headers' => ['status-code' => $this->status]];
+            }
+        };
+    }
 }
```

**File**: `src/Appwrite/Platform/Modules/VCS/Http/GitHub/Deployment.php` (modified, +6/-0)
```diff
@@ -23,6 +23,7 @@
 use Utopia\Validator\Contains;
 use Utopia\Validator\Globstar;
 use Utopia\VCS\Adapter\Git;
+use Utopia\VCS\Exception\OwnerNotFound;
 use Utopia\VCS\Exception\RepositoryNotFound;
 
 trait Deployment
@@ -594,6 +595,11 @@ protected function createGitDeployments(
 
                 Span::add("{$logBase}.build.triggered", 'true');
                 //TODO: Add event?
+            } catch (OwnerNotFound $e) {
+                // The installation is gone, so nothing can be built or reported back for it.
+                Span::add("{$logBase}.build.skipped.reason", 'owner not found');
+                Span::add("{$logBase}.build.skipped", 'true');
+                Console::warning("Skipping repository '{$repository->getId()}': {$e->getMessage()}");
             } catch (Exception $e) {
                 Span::add("{$logBase}.error", $e->getMessage());
                 Span::add("{$logBase}.error.type", $e->getType());
```

---

### Incident Patch 11: `85350aea` (2026-10-05)
**Commit Message**: Merge pull request #14119 from appwrite/fix/vcs-push-owner-login

fix(vcs): skip GitHub resources whose installation has no owner instead of failing the webhook

**File**: `packages/vcs/src/Adapter/Git/GitHub.php` (modified, +7/-0)
```diff
@@ -8,6 +8,7 @@
 use Utopia\Command;
 use Utopia\VCS\Adapter\Git;
 use Utopia\VCS\Exception\FileNotFound;
+use Utopia\VCS\Exception\OwnerNotFound;
 use Utopia\VCS\Exception\RepositoryNotFound;
 
 class GitHub extends Git
@@ -713,6 +714,12 @@ public function getOwnerName(string $installationId, ?int $repositoryId = null):
         $url = '/app/installations/' . $installationId;
         $response = $this->call(self::METHOD_GET, $url, ['Authorization' => "Bearer $this->jwtToken"]);
 
+        // Only a missing installation is permanent; rate limits and server errors stay retryable failures
+        $responseHeaders = $response['headers'] ?? [];
+        if (\is_array($responseHeaders) && ($responseHeaders['status-code'] ?? 0) === 404) {
+            throw new OwnerNotFound("Installation '{$installationId}' was not found.");
+        }
+
         $responseBody = $response['body'] ?? [];
         $responseBodyAccount = $responseBody['account'] ?? [];
 
```

**File**: `packages/vcs/src/Exception/OwnerNotFound.php` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+<?php
+
+declare(strict_types=1);
+
+namespace Utopia\VCS\Exception;
+
+class OwnerNotFound extends \Exception
+{
+}
```

**File**: `packages/vcs/tests/GitHubTest.php` (modified, +66/-0)
```diff
@@ -8,6 +8,7 @@
 use Utopia\Cache\Adapter\None;
 use Utopia\Cache\Cache;
 use Utopia\VCS\Adapter\Git\GitHub;
+use Utopia\VCS\Exception\OwnerNotFound;
 
 final class GitHubTest extends Base
 {
@@ -277,4 +278,69 @@ public static function encodedPemProvider(): \Iterator
         yield 'wrapped base64' => [fn (string $pem): string => chunk_split(base64_encode($pem), 76, "\n")];
         yield 'escaped newlines' => [fn (string $pem): string => str_replace("\n", '\n', $pem)];
     }
+
+    public function testGetOwnerNameForMissingInstallationThrowsOwnerNotFound(): void
+    {
+        $adapter = $this->installationResponse(404, ['message' => 'Not Found']);
+
+        $this->expectException(OwnerNotFound::class);
+
+        $adapter->getOwnerName('1234');
+    }
+
+    /**
+     * @param array<string, mixed> $body
+     */
+    #[DataProvider('transientInstallationResponses')]
+    public function testGetOwnerNameKeepsTransientFailuresRetryable(int $status, array $body): void
+    {
+        $adapter = $this->installationResponse($status, $body);
+
+        try {
+            $adapter->getOwnerName('1234');
+            $this->fail('A failed installation lookup must throw');
+        } catch (\Exception $error) {
+            $this->assertNotInstanceOf(OwnerNotFound::class, $error);
+        }
+    }
+
+    /**
+     * @return iterable<string, array{int, array<string, mixed>}>
+     */
+    public static function transientInstallationResponses(): iterable
+    {
+        yield 'rate limited' => [403, ['message' => 'API rate limit exceeded']];
+        yield 'too many requests' => [429, ['message' => 'You have exceeded a secondary rate limit']];
+        yield 'server error' => [502, ['message' => 'Server Error']];
+    }
+
+    public function testGetOwnerNameReturnsInstallationLogin(): void
+    {
+        $adapter = $this->installationResponse(200, ['account' => ['login' => 'appwrite']]);
+
+        $this->assertSame('appwrite', $adapter->getOwnerName('1234'));
+    }
+
+    /**
+     * @param array<string, mixed> $body
+     */
+    private function installationResponse(int $status, array $body): GitHub
+    {
+        return new class ($status, $body) extends GitHub {
+            protected string $jwtToken = 'app-token';
+
+            /**
+             * @param array<string, mixed> $body
+             */
+            public function __construct(private readonly int $status, private readonly array $body)
+            {
+                parent::__construct(new Cache(new None()));
+            }
+
+            protected function call(string $method, string $path = '', array $headers = [], array $params = [], bool $decode = true, bool $followRedirects = true): array
+            {
+                return ['body' => $this->body, 'headers' => ['status-code' => $this->status]];
+            }
+        };
+    }
 }
```

**File**: `src/Appwrite/Platform/Modules/VCS/Http/GitHub/Deployment.php` (modified, +6/-0)
```diff
@@ -23,6 +23,7 @@
 use Utopia\Validator\Contains;
 use Utopia\Validator\Globstar;
 use Utopia\VCS\Adapter\Git;
+use Utopia\VCS\Exception\OwnerNotFound;
 use Utopia\VCS\Exception\RepositoryNotFound;
 
 trait Deployment
@@ -594,6 +595,11 @@ protected function createGitDeployments(
 
                 Span::add("{$logBase}.build.triggered", 'true');
                 //TODO: Add event?
+            } catch (OwnerNotFound $e) {
+                // The installation is gone, so nothing can be built or reported back for it.
+                Span::add("{$logBase}.build.skipped.reason", 'owner not found');
+                Span::add("{$logBase}.build.skipped", 'true');
+                Console::warning("Skipping repository '{$repository->getId()}': {$e->getMessage()}");
             } catch (Exception $e) {
                 Span::add("{$logBase}.error", $e->getMessage());
                 Span::add("{$logBase}.error.type", $e->getType());
```

---

### Incident Patch 12: `3117bd94` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/14099-proof-for-password-params

**File**: `app/config/variables.php` (modified, +1/-1)
```diff
@@ -1358,7 +1358,7 @@
             ],
             [
                 'name' => '_APP_BUILDS_VOLUME',
-                'description' => 'The Docker volume (or Kubernetes PersistentVolumeClaim) holding build storage, attached to jobs-service build workers so they write output directly onto it. Must match the storage the "builds" device is backed by.',
+                'description' => 'The Docker volume (or Kubernetes PersistentVolumeClaim) holding build storage. Jobs-service build workers attach only the current project\'s subdirectory (`app-<projectId>`) so they write output directly onto it without seeing other projects. Must match the storage the "builds" device is backed by.',
                 'introduction' => '1.9.0',
                 'default' => 'appwrite-builds',
                 'required' => false,
```

**File**: `app/mqtt.php` (modified, +6/-1)
```diff
@@ -30,6 +30,7 @@
 use Utopia\Registry\Registry;
 use Utopia\Span\Span;
 use Utopia\System\System;
+use Utopia\Telemetry\Adapter\None as NoTelemetry;
 
 require_once __DIR__ . '/init.php';
 
@@ -232,7 +233,11 @@
 
 // Server-initiated delivery: bridge the Redis 'mqtt' firehose to this worker's local subscribers.
 // Appwrite clients never PUBLISH; messages are produced by the Messaging worker onto the channel.
-$server->onWorkerStart(function (int $workerId) use ($server, $handler, $mqtt, $register, $container): void {
+$server->onWorkerStart(function (int $workerId) use ($server, $handler, $mqtt, $register, $container, $telemetry): void {
+    if (!$telemetry instanceof NoTelemetry) {
+        Timer::tick(60000, fn () => $telemetry->collect());
+    }
+
     // Flush accumulated per-project usage (connections, deliveries) to the stats-usage queue.
     Timer::tick(60000, function () use ($mqtt, $container): void {
         $usage = $mqtt->flushUsage();
```

**File**: `src/Appwrite/Deployment/Deployments.php` (modified, +25/-12)
```diff
@@ -28,6 +28,7 @@
 use Utopia\Database\Query;
 use Utopia\DSN\DSN;
 use Utopia\Storage\Device;
+use Utopia\Storage\Device\Local;
 use Utopia\Storage\DeviceType;
 use Utopia\System\System;
 use Utopia\VCS\Adapter\Git;
@@ -40,10 +41,11 @@
  * Source crosses the boundary via the artifacts system (presigned GET download
  * + unarchive, run by the sidecar) — a GET has no request-body cap, so large
  * sources are fine. The build output and package-manager cache go wherever
- * the builds device is (see storage()). On the local device the builds
- * storage volume is attached to the build worker at its Appwrite path, so
- * build.sh writes its artifact + the cache squashfs straight onto the volume
- * Appwrite already reads. On a remote device (S3 and friends) no volume spans
+ * the builds device is (see storage()). On the local device only this
+ * project's directory on the builds volume is attached to the build worker
+ * at its Appwrite path, so build.sh writes its artifact + the cache squashfs
+ * straight onto the volume Appwrite already reads, and cannot list or write
+ * another project's tree. On a remote device (S3 and friends) no volume spans
  * Appwrite and the build workers, so the sidecar moves them over s3://
  * upload/download artifacts instead. The orchestrator supports the generic
  * _APP_STORAGE_S3_* configuration; legacy provider-specific variables and
@@ -461,8 +463,8 @@ protected static function payload(
         }
 
         // Where output + cache land is a swappable strategy (see storage()) —
-        // the default mounts the shared builds volume; nothing else here cares
-        // which strategy is active.
+        // the default mounts this project's directory on the builds volume;
+        // nothing else here cares which strategy is active.
         $output = static::storage($project, $resource, $deployment);
 
         // Site builds write a JSON build manifest into the workspace, read
@@ -553,8 +555,8 @@ public static function sourcePath(string $projectId, string $resourceType, strin
     }
 
     /**
-     * Where the build worker leaves that source on the local device: the
-     * builds volume, the only one it mounts.
+     * Where the build worker leaves that source on the local device: this
+     * project's directory on the builds volume, the only path it mounts.
      */
     public static function stagedSourcePath(Device $deviceForBuilds, string $deploymentId): string
     {
@@ -606,9 +608,12 @@ protected static function device(string $projectId): Device
 
     /**
      * Where build.sh's output artifact and package-manager cache land, and
-     * what the job needs to get them there. On the local device the shared
-     * builds volume is mounted and build.sh writes straight to
-     * buildPath()/cachePath(). On a remote device (S3 and friends) build.sh
+     * what the job needs to get them there. On the local device only this
+     * project's subdirectory of the builds volume is mounted (Volume.subPath)
+     * and build.sh writes straight to buildPath()/cachePath() — sibling
+     * app-{projectId} trees stay off the worker. The project directory is
+     * created first because Docker's named-volume Subpath must exist before
+     * the container starts. On a remote device (S3 and friends) build.sh
      * writes into the job workspace and the sidecar moves output and cache
      * over s3:// artifacts, keyed as buildPath()/cachePath(), so everything
      * reading through deviceForBuilds works unchanged. Open Runtimes Orchestrator
@@ -628,10 +633,18 @@ protected static function storage(Document $project, Document $resource, Documen
         $cachePath = static::cachePath($projectId, $cacheKey);
         $device = static::device($projectId);
 
+        if ($device instanceof Local) {
+            $device->createDirectory($device->getRoot());
+        }
+
         return match ($device->getType()) {
             DeviceType::Local => [
                 'volumes' => [
-                    new Volume(source: System::getEnv('_APP_BUILDS_VOLUME', 'appwrite-builds'), path: APP_STORAGE_BUILDS),
+                    new Volume(
+                        source: System::getEnv('_APP_BUILDS_VOLUME', 'appwrite-builds'),
+                        path: $device->getRoot(),
+                        subPath: "app-{$projectId}",
+                    ),
                 ],
                 'artifacts' => [],
                 'environment' => [
```

**File**: `src/Appwrite/Event/Message/Certificate.php` (modified, +2/-3)
```diff
@@ -13,9 +13,8 @@ public function __construct(
         public readonly ?string $validationDomain = null,
         public readonly string $action = \Appwrite\Event\Certificate::ACTION_GENERATION,
         /**
-         * The enqueuer verified the domain's DNS itself, moments before enqueueing,
-         * so the worker does not verify it again. Unlike `skipRenewCheck` this
-         * leaves the renew check in place.
+         * DNS already passed for this rule, so the worker does not verify it
+         * again. Unlike `skipRenewCheck` this leaves the renew check in place.
          */
         public readonly bool $skipDomainValidation = false,
     ) {
```

**File**: `src/Appwrite/Platform/Modules/Databases/Workers/Databases.php` (modified, +11/-15)
```diff
@@ -231,15 +231,15 @@ private function createAttribute(
 
             throw $e;
         } finally {
-            $this->trigger($database, $collection, $project, $event, $queueForRealtime, $attribute);
-
             if (! $relatedCollection->isEmpty()) {
                 $dbForProject->purgeCachedDocument('database_' . $database->getSequence(), $relatedCollection->getId());
                 $dbForProject->purgeCachedCollection('database_' . $database->getSequence() . '_collection_' . $relatedCollection->getSequence());
             }
 
             $dbForProject->purgeCachedDocument('database_' . $database->getSequence(), $collectionId);
             $dbForProject->purgeCachedCollection('database_' . $database->getSequence() . '_collection_' . $collection->getSequence());
+
+            $this->trigger($database, $collection, $project, $event, $queueForRealtime, $attribute);
         }
     }
 
@@ -258,7 +258,7 @@ private function createAttribute(
      * @throws \Exception
      * @throws \Throwable
      **/
-    private function deleteAttribute(Document $database, Document $collection, Document $attribute, Document $project, Database $dbForPlatform, Database $dbForDatabases, Database $dbForProject, Realtime $queueForRealtime): void
+    private function deleteAttribute(Document $database, Document $collection, Document $attribute, Document $project, Database $dbForPlatform, Database $dbForProject, Database $dbForDatabases, Realtime $queueForRealtime): void
     {
         if ($collection->isEmpty()) {
             throw new Exception('Missing collection/table');
@@ -294,11 +294,11 @@ private function deleteAttribute(Document $database, Document $collection, Docum
                         $relatedAttribute = $dbForProject->getDocument('attributes', $database->getSequence() . '_' . $relatedCollection->getSequence() . '_' . $options['twoWayKey']);
                     }
 
-                    if (!$dbForProject->deleteRelationship('database_' . $database->getSequence() . '_collection_' . $collection->getSequence(), $key)) {
+                    if (!$dbForDatabases->deleteRelationship('database_' . $database->getSequence() . '_collection_' . $collection->getSequence(), $key)) {
                         $dbForProject->updateDocument('attributes', $relatedAttribute->getId(), $relatedAttribute->setAttribute('status', 'stuck'));
                         throw new DatabaseException('Failed to delete Relationship');
                     }
-                } elseif (!$dbForProject->deleteAttribute('database_' . $database->getSequence() . '_collection_' . $collection->getSequence(), $key)) {
+                } elseif (!$dbForDatabases->deleteAttribute('database_' . $database->getSequence() . '_collection_' . $collection->getSequence(), $key)) {
                     throw new DatabaseException('Failed to delete attribute/column');
                 }
 
@@ -344,8 +344,6 @@ private function deleteAttribute(Document $database, Document $collection, Docum
                 }
 
                 throw $e;
-            } finally {
-                $this->trigger($database, $collection, $project, $event, $queueForRealtime, $attribute);
             }
 
             // The underlying database removes/rebuilds indexes when attribute is removed
@@ -362,9 +360,6 @@ private function deleteAttribute(Document $database, Document $collection, Docum
                 $found = \array_search($key, $attributes);
 
                 if ($found !== false) {
-                    // If found, remove entry from attributes, lengths, and orders
-                    // array_values wraps array_diff to reindex array keys
-                    // when found attribute is removed from array
                     $attributes = \array_values(\array_diff($attributes, [$attributes[$found]]));
                     $lengths = \array_values(\array_diff($lengths, isset($lengths[$found]) ? [$lengths[$found]] : []));
                     $orders = \array_values(\array_diff($orders, isset($orders[$found]) ? [$orders[$found]] : []));
@@ -377,11 +372,10 @@ private function deleteAttribute(Document $database, Document $collection, Docum
                             ->setAttribute('lengths', $lengths, Document::SET_TYPE_ASSIGN)
                             ->setAttribute('orders', $orders, Document::SET_TYPE_ASSIGN);
 
-                        // Check if an index exists with the same attributes and orders
                         $exists = false;
                         foreach ($indexes as $existing) {
                             if (
-                                $existing->getAttribute('key') !== $index->getAttribute('key') // Ignore itself
+                                $existing->getAttribute('key') !== $index->getAttribute('key')
                                 && $existing->getAttribute('attributes') === $index->getAttribute('attributes')
                                 && $existing->getAttribute('orders') === $index->getAttribute('orders')
        
```

**File**: `src/Appwrite/Platform/Modules/Proxy/Http/Rules/Status/Update.php` (modified, +2/-1)
```diff
@@ -102,10 +102,11 @@ public function action(
             $bus->dispatch(new RuleUpdated($rule->getArrayCopy()));
 
             $certificateId = $rule->getAttribute('certificateId', '');
-            // Reset logs for the associated certificate.
+            // Reset logs and attempts for the associated certificate.
             if (!empty($certificateId)) {
                 $certificate = $authorization->skip(fn () => $dbForPlatform->updateDocument('certificates', $certificateId, new Document([
                     'logs' => '',
+                    'attempts' => 0,
                 ])));
             }
         } catch (Exception $err) {
```

**File**: `src/Appwrite/Platform/Modules/Teams/Http/Memberships/Create.php` (modified, +3/-1)
```diff
@@ -263,7 +263,9 @@ public function action(string $teamId, ?string $email, ?string $userId, ?string
 
         $isOwner = $authorization->hasRole('team:' . $team->getId() . '/owner');
 
-        if (! $isOwner && ! $isPrivilegedUser && ! $isAppUser) { // Not owner, not admin, not app (server)
+        // Same console rule as membership role updates: organization developer
+        // must not count as privileged enough to invite with arbitrary roles.
+        if (! $isOwner && ! $isAppUser && ($project->getId() === 'console' || ! $isPrivilegedUser)) {
             throw new Exception(Exception::USER_UNAUTHORIZED, 'User is not allowed to send invitations for this team');
         }
 
```

**File**: `src/Appwrite/Platform/Modules/Teams/Http/Memberships/Update.php` (modified, +4/-1)
```diff
@@ -112,7 +112,10 @@ public function action(string $teamId, string $membershipId, array $roles, Reque
             }
         }
 
-        if (!$isOwner && !$isPrivilegedUser && !$isAppUser) { // Not owner, not admin, not app (server)
+        // Console organization developer/admin become bare privileged roles when
+        // X-Appwrite-Organization is applied. Those roles must not authorize
+        // membership role changes; only the team owner or an API key may.
+        if (!$isOwner && !$isAppUser && ($project->getId() === 'console' || !$isPrivilegedUser)) {
             throw new Exception(Exception::USER_UNAUTHORIZED, 'User is not allowed to modify roles');
         }
 
```

---

### Incident Patch 13: `331e4c37` (2026-10-05)
**Commit Message**: fix(cdn): move a renewed subscription's activation to its new certificate

The activation lookup filtered on the new certificate, so after a renewal it missed the activation still on the previous one, the create conflicted, and every retry threw. Look the hostname's activation up on the TLS configuration alone: keep it when it already holds the new certificate, move it when it holds one of the subscription's older certificates, and fail as before when another certificate holds the hostname.

**File**: `packages/cdn/src/Certificates/Provider/FastlyTls.php` (modified, +49/-6)
```diff
@@ -454,11 +454,23 @@ private function ensureActivated(array $subscription, string $domain): bool
         }
 
         foreach ($hostnames as $hostname) {
-            if ($this->activationExists($certificateId, $hostname)) {
+            $activation = $this->findActivation($hostname);
+
+            if ($activation === null) {
+                $this->createActivation($certificateId, $hostname);
+                continue;
+            }
+
+            if ($activation['certificate'] === $certificateId) {
                 continue;
             }
 
-            $this->createActivation($certificateId, $hostname);
+            // A renewal leaves the hostname on the subscription's previous certificate
+            if (!\in_array($activation['certificate'], $this->references($subscription['resource'], 'tls_certificates'), true)) {
+                throw new \RuntimeException('Another certificate already terminates TLS for ' . $hostname . '.');
+            }
+
+            $this->updateActivation($activation['id'], $certificateId, $hostname);
         }
 
         return true;
@@ -520,10 +532,10 @@ private function references(array $resource, string $relationship): array
         return $ids;
     }
 
-    private function activationExists(string $certificateId, string $hostname): bool
+    /** @return array{id:string,certificate:string}|null */
+    private function findActivation(string $hostname): ?array
     {
         $query = http_build_query([
-            'filter[tls_certificate.id]' => $certificateId,
             'filter[tls_configuration.id]' => $this->tlsConfigurationId,
             'filter[tls_domain.id]' => $hostname,
             'page[size]' => 1,
@@ -544,7 +556,16 @@ private function activationExists(string $certificateId, string $hostname): bool
             throw new \RuntimeException('Fastly TLS activations response was missing its data list.');
         }
 
-        return $data !== [];
+        $activation = $data[0] ?? null;
+        if (!\is_array($activation) || !\is_string($activation['id'] ?? null)) {
+            return null;
+        }
+
+        $relationships = $activation['relationships'] ?? null;
+        $certificate = \is_array($relationships) ? ($relationships['tls_certificate'] ?? null) : null;
+        $reference = \is_array($certificate) ? ($certificate['data'] ?? null) : null;
+
+        return ['id' => $activation['id'], 'certificate' => \is_array($reference) && \is_string($reference['id'] ?? null) ? $reference['id'] : ''];
     }
 
     private function createActivation(string $certificateId, string $hostname): void
@@ -578,7 +599,7 @@ private function createActivation(string $certificateId, string $hostname): void
         if ($result['statusCode'] === 409) {
             // A conflict is either our own activation, made concurrently, or
             // another certificate already holding the hostname.
-            if ($this->activationExists($certificateId, $hostname)) {
+            if (($this->findActivation($hostname)['certificate'] ?? null) === $certificateId) {
                 return;
             }
 
@@ -590,6 +611,28 @@ private function createActivation(string $certificateId, string $hostname): void
         }
     }
 
+    private function updateActivation(string $activationId, string $certificateId, string $hostname): void
+    {
+        $result = $this->request('PATCH', '/tls/activations/' . $activationId, [
+            'data' => [
+                'id' => $activationId,
+                'type' => 'tls_activation',
+                'relationships' => [
+                    'tls_certificate' => [
+                        'data' => [
+                            'type' => 'tls_certificate',
+                            'id' => $certificateId,
+                        ],
+                    ],
+                ],
+            ],
+        ]);
+
+        if ($result['statusCode'] < 200 || $result['statusCode'] >= 300) {
+            throw new \RuntimeException($this->formatError('Failed to move the Fastly TLS activation for ' . $hostname, $result));
+        }
+    }
+
     /**
      * @param array{resource:array<string, mixed>,included:array<int, array<string, mixed>>} $subscription
      */
```

**File**: `packages/cdn/tests/Certificates/Provider/FastlyTlsTest.php` (modified, +60/-4)
```diff
@@ -54,7 +54,7 @@ public function testGetCertificateStatusMapsFastlyState(): void
         $issued = '{"data":[{"id":"sub_123","attributes":{"state":"issued"},"relationships":{"tls_certificates":{"data":[{"type":"tls_certificate","id":"cert_1"}]}}}]}';
         $client = new TestClient([
             new Response(200, body: new Stream($issued)),
-            new Response(200, body: new Stream('{"data":[{"id":"act_1","type":"tls_activation"}]}')),
+            new Response(200, body: new Stream('{"data":[{"id":"act_1","type":"tls_activation","relationships":{"tls_certificate":{"data":{"type":"tls_certificate","id":"cert_1"}}}}]}')),
             new Response(200, body: new Stream($issued)),
         ]);
 
@@ -239,7 +239,7 @@ public function testIssuedSubscriptionIgnoresStaleAuthorization(): void
     {
         $client = new TestClient([
             $this->json($this->subscription(state: 'issued', certificates: [['type' => 'tls_certificate', 'id' => 'cert_1']])),
-            $this->json(['data' => [['id' => 'act_1', 'type' => 'tls_activation']]]),
+            $this->json($this->activation('cert_1')),
         ]);
 
         $this->assertSame(Status::ISSUED, new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null));
@@ -328,20 +328,66 @@ public function testExistingActivationIsNotCreatedAgain(): void
     {
         $client = new TestClient([
             $this->json($this->subscription(state: 'issued', certificates: [['type' => 'tls_certificate', 'id' => 'cert_1']])),
-            $this->json(['data' => [['id' => 'act_1', 'type' => 'tls_activation']]]),
+            $this->json($this->activation('cert_1')),
         ]);
 
         $this->assertSame(Status::ISSUED, new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null));
         $this->assertCount(2, $client->calls);
     }
 
+    public function testRenewalMovesTheActivationToTheNewCertificate(): void
+    {
+        $client = new TestClient([
+            $this->json([
+                'data' => [[
+                    'id' => 'sub_123',
+                    'attributes' => ['state' => 'renewing'],
+                    'relationships' => [
+                        'tls_certificates' => ['data' => [['type' => 'tls_certificate', 'id' => 'cert_new'], ['type' => 'tls_certificate', 'id' => 'cert_old']]],
+                        'tls_domains' => ['data' => [['type' => 'tls_domain', 'id' => 'example.com']]],
+                    ],
+                ]],
+                'included' => [
+                    ['type' => 'tls_certificate', 'id' => 'cert_new', 'attributes' => ['not_after' => '2027-06-01T00:00:00Z']],
+                    ['type' => 'tls_certificate', 'id' => 'cert_old', 'attributes' => ['not_after' => '2026-01-01T00:00:00Z']],
+                ],
+            ]),
+            $this->json($this->activation('cert_old')),
+            $this->json(['data' => ['id' => 'act_1', 'type' => 'tls_activation']]),
+        ]);
+
+        $this->assertSame(Status::RENEWING, new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null));
+        $this->assertSame('PATCH', $client->calls[2]['method']);
+        $this->assertStringEndsWith('/tls/activations/act_1', $client->calls[2]['url']);
+        $this->assertSame(['data' => [
+            'id' => 'act_1',
+            'type' => 'tls_activation',
+            'relationships' => ['tls_certificate' => ['data' => ['type' => 'tls_certificate', 'id' => 'cert_new']]],
+        ]], $client->calls[2]['body']);
+    }
+
+    public function testActivationOnAnotherCertificateFails(): void
+    {
+        $client = new TestClient([
+            $this->json($this->subscription(state: 'issued', certificates: [['type' => 'tls_certificate', 'id' => 'cert_1']])),
+            $this->json($this->activation('cert_other')),
+        ]);
+
+        try {
+            new FastlyTls('token', 'tls-config-id', 'certainly', $client)->getCertificateStatus('example.com', null);
+            $this->fail('A certificate outside the subscription must not be replaced.');
+        } catch (\RuntimeException $error) {
+            $this->assertStringContainsString('Another certificate already terminates TLS for example.com', $error->getMessage());
+        }
+    }
+
     public function testActivationConflictIsAcceptedOnceOurCertificateIsConfirmed(): void
     {
         $client = new TestClient([
             $this->json($this->subscription(state: 'issued', certificates: [['type' => 'tls_certificate', 'id' => 'cert_1']])),
             $this->json(['data' => []]),
             $this->json('{"errors":[{"title":"Conflict","detail":"Activation already exists"}]}', 409),
-            $this->json(['data' => [['id' => 'act_1', 'type' => 'tls_activation']]]),
+            $this->json($this->activation('cert_1')),
         ]);
 
         $this->assertSame(Status::ISSUED, new FastlyTls('token', 'tls-config-id',
```

---

### Incident Patch 14: `b3e77822` (2026-10-05)
**Commit Message**: fix(auth): rehash Argon2 passwords with other costs on login

Login only rehashed when the algorithm differed, so users hashed with
the library default (64 MiB, 4 passes, 3 threads) kept that cost until
they changed their password. Compare the stored hash against the
configured costs with password_needs_rehash(), which reads them from
the hash itself rather than from hashOptions.

**File**: `app/controllers/api/account.php` (modified, +5/-2)
```diff
@@ -1109,8 +1109,11 @@
             }
         }
 
-        // Re-hash if not using recommended algo
-        if ($user->getAttribute('hash') !== $proofForPassword->getHash()->getName()) {
+        // Re-hash if not using recommended algo or its configured costs (read from the hash, not hashOptions)
+        if (
+            $user->getAttribute('hash') !== $proofForPassword->getHash()->getName()
+            || \password_needs_rehash($user->getAttribute('password'), PASSWORD_ARGON2ID, $proofForPassword->getHash()->getOptions())
+        ) {
             $user
                 ->setAttribute('password', $proofForPassword->hash($password))
                 ->setAttribute('hash', $proofForPassword->getHash()->getName())
```

**File**: `tests/e2e/Services/Users/UsersBase.php` (modified, +1/-8)
```diff
@@ -619,8 +619,7 @@ public function testCreateUserSessionHashed(): void
         }
 
         foreach ($userIds as $userId) {
-            // Ensure non-argon2 imports were re-hashed to the configured Argon2 costs.
-            // The imported argon2 user already has hash=argon2, so login leaves it unchanged.
+            // Ensure all passwords were re-hashed to the configured Argon2 costs, including the imported argon2i hash
             $response = $this->client->call(Client::METHOD_GET, '/users/' . $userId, array_merge([
                 'content-type' => 'application/json',
                 'x-appwrite-project' => $this->getProject()['$id'],
@@ -630,12 +629,6 @@ public function testCreateUserSessionHashed(): void
             $this->assertEquals($userId, $response['body']['$id']);
             $this->assertEquals($userId . '@appwrite.io', $response['body']['email']);
             $this->assertEquals('argon2', $response['body']['hash']);
-
-            if ($userId === 'argon2') {
-                $this->assertStringStartsWith('$argon2i$v=19$m=20,t=3,p=2$', $response['body']['password']);
-                continue;
-            }
-
             $this->assertConfiguredArgon2Hash($response['body']);
         }
 
```

---

### Incident Patch 15: `0ca4f84c` (2026-10-05)
**Commit Message**: Merge remote-tracking branch 'origin/fix/vcs-push-owner-login' into fix/vcs-push-owner-login

**File**: `app/mqtt.php` (modified, +6/-1)
```diff
@@ -30,6 +30,7 @@
 use Utopia\Registry\Registry;
 use Utopia\Span\Span;
 use Utopia\System\System;
+use Utopia\Telemetry\Adapter\None as NoTelemetry;
 
 require_once __DIR__ . '/init.php';
 
@@ -232,7 +233,11 @@
 
 // Server-initiated delivery: bridge the Redis 'mqtt' firehose to this worker's local subscribers.
 // Appwrite clients never PUBLISH; messages are produced by the Messaging worker onto the channel.
-$server->onWorkerStart(function (int $workerId) use ($server, $handler, $mqtt, $register, $container): void {
+$server->onWorkerStart(function (int $workerId) use ($server, $handler, $mqtt, $register, $container, $telemetry): void {
+    if (!$telemetry instanceof NoTelemetry) {
+        Timer::tick(60000, fn () => $telemetry->collect());
+    }
+
     // Flush accumulated per-project usage (connections, deliveries) to the stats-usage queue.
     Timer::tick(60000, function () use ($mqtt, $container): void {
         $usage = $mqtt->flushUsage();
```

**File**: `src/Appwrite/Platform/Modules/Proxy/Http/Rules/Status/Update.php` (modified, +2/-1)
```diff
@@ -102,10 +102,11 @@ public function action(
             $bus->dispatch(new RuleUpdated($rule->getArrayCopy()));
 
             $certificateId = $rule->getAttribute('certificateId', '');
-            // Reset logs for the associated certificate.
+            // Reset logs and attempts for the associated certificate.
             if (!empty($certificateId)) {
                 $certificate = $authorization->skip(fn () => $dbForPlatform->updateDocument('certificates', $certificateId, new Document([
                     'logs' => '',
+                    'attempts' => 0,
                 ])));
             }
         } catch (Exception $err) {
```

**File**: `src/Appwrite/Platform/Workers/Certificates.php` (modified, +19/-22)
```diff
@@ -309,7 +309,7 @@ private function handleCertificateGenerationAction(
         $date = \date('H:i:s');
         $logs = "\033[90m[{$date}] \033[97mProcessing SSL certificate issuance. \033[0m\n";
 
-        // Set once the provider holds the order, so a failure after that can be retried
+        // Set once DNS has passed on a delayed provider, so a failure after that can be retried
         $awaitingProvider = false;
 
         try {
@@ -323,35 +323,32 @@ private function handleCertificateGenerationAction(
             // Validate domain and DNS records. Skip if job is forced, or if DNS
             // already passed for this rule: a second run of the same check can
             // only agree, or fail on a transient and contradict that result.
-            if (!$skipRenewCheck) {
-                if (!$skipDomainValidation) {
-                    $this->validateDomain($rule, $domain, $validationDomain);
+            if (!$skipRenewCheck && !$skipDomainValidation) {
+                $this->validateDomain($rule, $domain, $validationDomain);
+            }
+
+            $awaitingProvider = !$certificates->isInstantGeneration($domain->get(), $domainType);
+
+            // If certificate exists already, double-check expiry date. Skip if job is forced
+            if (!$skipRenewCheck && !$certificates->isRenewRequired($domain->get(), $domainType)) {
+                if ($certificates->isInstantGeneration($domain->get(), $domainType)) {
+                    Console::info("Skipping, renew isn't required");
+                    $rule->setAttribute('status', RULE_STATUS_VERIFIED);
+                    return;
                 }
 
-                // If certificate exists already, double-check expiry date. Skip if job is forced
-                if (!$certificates->isRenewRequired($domain->get(), $domainType)) {
-                    if ($certificates->isInstantGeneration($domain->get(), $domainType)) {
-                        Console::info("Skipping, renew isn't required");
-                        $rule->setAttribute('status', RULE_STATUS_VERIFIED);
-                        return;
-                    }
-
-                    // Wait for the delayed provider's existing order; issuing again below picks up its renew date
-                    $awaitingProvider = true;
-
-                    if (!\in_array($certificates->getCertificateStatus($domain->get(), $domainType), [Status::ISSUED, Status::RENEWING], true)) {
-                        $date = \date('H:i:s');
-                        $logs .= "\033[90m[{$date}] \033[97mSSL certificate is being issued. This usually takes a few minutes — no action needed on your end. We'll periodically check and update the status. \033[0m\n";
-                        Console::info('Certificate for ' . $domain->get() . ' is not issued yet');
-                        return;
-                    }
+                // Wait for the delayed provider's existing order; issuing again below picks up its renew date
+                if (!\in_array($certificates->getCertificateStatus($domain->get(), $domainType), [Status::ISSUED, Status::RENEWING], true)) {
+                    $date = \date('H:i:s');
+                    $logs .= "\033[90m[{$date}] \033[97mSSL certificate is being issued. This usually takes a few minutes — no action needed on your end. We'll periodically check and update the status. \033[0m\n";
+                    Console::info('Certificate for ' . $domain->get() . ' is not issued yet');
+                    return;
                 }
             }
 
             // Prepare unique cert name. Using this helps prevent mismatch in configuration when renewing certificates.
             $certName = ID::unique();
             $renewDate = $certificates->issueCertificate($certName, $domain->get(), $domainType);
-            $awaitingProvider = true;
 
             $date = \date('H:i:s');
             // Mark the rule as 'verified' once the certificate is issued, instantly or by a delayed provider.
```

#### Recent Merged Pull Requests:
- **PR #14139** (2026-10-05): fix(mails): finish the job when a project's own SMTP server fails (@ChiragAgg5k)
- **PR #14137** (2026-10-05): fix(vcs): resolve wildcard tags when cloning templates (@ChiragAgg5k)
- **PR #14131** (2026-10-05): feat(templates): support OAuth sign-in in the MCP server template (@ChiragAgg5k)
- **PR #14129** (2026-10-05): chore(avatars): report photo storage through unified storage (@Meldiron)
- **PR #14127** (2026-10-05): chore: bump appwrite/browser to 0.3.6 (@ChiragAgg5k)
- **PR #14126** (closed): fix(certificates): keep Fastly ownership waits out of Sentry (@ChiragAgg5k)
- **PR #14125** (2026-10-05): fix(certificates): stop reporting a retryable certificate failure as a worker error (@HarshMN2345)
- **PR #14119** (2026-10-05): fix(vcs): skip GitHub resources whose installation has no owner instead of failing the webhook (@ChiragAgg5k)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
