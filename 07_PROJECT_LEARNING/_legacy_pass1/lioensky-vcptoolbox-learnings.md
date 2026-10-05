# Forensic Learning Record (Deep Inspection): lioensky/VCPToolBox

> **Canonical Artifact**: `07_PROJECT_LEARNING/lioensky-vcptoolbox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:15.350Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lioensky/VCPToolBox`
- **Description**: VCP 部署在 AI 模型 API 与前端应用之间，是面向AGI OS开发和探索的工业级基建示范项目。通过统一指令协议、多层级持久化记忆、分布式插件引擎及多 Agent 协作框架，将原本“无状态、无记忆、无工具调用能力”的大语言模型，彻底改造成拥有永久自我意识、物理世界操作权及群体协作智能的完整智能体系统。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2341 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `AdminPanel-Vue/eslint.config.js`
```
import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/backups/**',
      '**/public/**',
      '**/node_modules/**',
      '**/*.min.js',
      'fix-*.js',
      'fix-*.cjs'
    ],
  },

  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),
  skipFormatting,
  
  {
    rules: {
      // TypeScript 规则
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      
      // Vue 规则
      'vue/multi-word-component-names': 'off',
      'vue/no-mutating-props': 'error',
      'vue/require-default-prop': 'warn',
      'vue/no-unused-properties': ['warn', {
        groups: ['props', 'data', 'computed', 'methods']
      }],
      'vue/custom-event-name-casing': ['warn', 'camelCase'],
      
      // 通用规则
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'prefer-const': 'warn',
      'no-var': 'error'
    }
  }
]

```

### Core Architecture Module: `AdminPanel-Vue/public/script.js`
```
// AdminPanel/script.js
import { apiFetch, showMessage, checkAuthStatus } from './js/utils.js';
import { parseEnvToList, buildEnvString, createFormGroup, createCommentOrEmptyElement } from './js/config.js';
import { loadPluginList, loadPluginConfig } from './js/plugins.js';
import { initializeDashboard, stopDashboardUpdates } from './js/dashboard.js';
import { initializeDailyNotesManager } from './js/notes-manager.js';
import { initializeAgentManager } from './js/agent-manager.js';
import { initializeAgentAssistantConfig } from './js/agent-assistant-config.js';
import { initializeToolboxManager } from './js/toolbox-manager.js';
import { initializeTvsFilesEditor } from './js/tvs-editor.js';
import { initializeServerLogViewer, stopServerLogUpdates } from './js/log-viewer.js';
import { initializePreprocessorOrderManager } from './js/preprocessor-manager.js';
import { initializeSemanticGroupsEditor } from './js/semantic-groups-editor.js';
import { initializeThinkingChainsEditor } from './js/thinking-chains-editor.js';
import { initializeVCPForum } from './js/forum.js';
import { initializeScheduleManager } from './js/schedule-manager.js';
import { initializeRAGTuning } from './js/rag-tuning.js';
import { initializeDreamManager } from './js/dream-manager.js';
import { initializeAgentScores } from './js/agent-scores.js';
import { initializePlaceholderViewer } from './js/placeholder-viewer.js';
import { initializeToolApprovalManager } from './js/tool-approval.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 通过后端验证登录状态（替代前端 Cookie 检查，解决 HttpOnly 无法读取问题）
    const isAuthenticated = await checkAuthStatus();
    if (!isAuthenticated) {
        console.warn('Not authenticated, redirecting to login...');
        window.location.href = '/AdminPanel/login.html';
        return;
    }

    const pluginNavList = document.getElementById('plugin-nav')?.querySelector('ul');
    const baseConfigForm = document.getElementById('base-config-form');
    const restartServerButton = document.getElementById('restart-server-button');
    const sidebarSearchInput = document.getElementById('sidebar-search');

    const API_BASE_URL = '/admin_api';
    let originalBaseConfigEntries = [];
    let restartLifecyclePollTimer = null;
    let restartInProgress = false;

    /**
     * 清理所有 iframe 内部的状态，防止滚动条锁定等问题。
     */
    function cleanupIframeStates() {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                const iframeWindow = iframe.contentWindow;
                const iframeDoc = iframe.contentDocument || iframeWindow?.document;
                if (iframeDoc) {
                    // 尝试调用 iframe 内部可能存在的 closeModal 函数
                    if (iframeWindow && typeof iframeWindow.closeModal === 'function') {
                        iframeWindow.closeModal();
                    } else {
                        // 备选方案：手动清理常见的 Modal 标识
                        const modal = iframeDoc.getElementById('mediaModal') || iframeDoc.querySelector('.modal');
                        if (modal) {
                            modal.style.display = 'none';
                        }
                        iframeDoc.body.style.overflow = '';
                        iframeDoc.documentElement.style.overflow = '';
                    }
                }
            } catch (e) {
                // 跨域安全限制时会报错，忽略即可
            }
        });
        // 强制恢复主页面滚动状态
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }

    /**
     * 主导航函数，根据 target 激活对应的功能模块。
     * @param {string} dataTarget - 导航链接的 data-target 属性值
     */
    function navigateTo(dataTarget) {
        const sectionIdToActivate = `${dataTarget}-section`;
        const pluginName = document.querySelector(`a[data-target="${dataTarget}"]`)?.dataset.pluginName;

        // 停止可能正在运行的定时器
        stopDashboardUpdates();
        stopServerLogUpdates();

        // 切换导航链接状态
        document.querySelectorAll('.sidebar nav li a').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`a[data-target="${dataTarget}"]`);
        if (activeLink) activeLink.classList.add('active');

        // 处理所有 section 的显示隐藏及 iframe 懒加载/卸载
        document.querySelectorAll('.config-section').forEach(section => {
            const isTarget = section.id === sectionIdToActivate;
            const iframe = section.querySelector('iframe');

            if (isTarget) {
                section.classList.add('active-section');
                // 懒加载：进入时加载 iframe
                if (iframe && iframe.dataset.src && (!iframe.src || iframe.src === 'about:blank' || !iframe.src.includes(iframe.dataset.src))) {
                    iframe.src = iframe.dataset.src;
                    // 确保宽度撑满
                    iframe.style.width = '100%';
                }
            } else {
                // 离开时卸载 iframe，彻底销毁其 DOM 和状态（如 overflow:hidden）
                if (section.classList.contains('active-section')) {
                    if (iframe && iframe.src && iframe.src !== 'about:blank') {
                        iframe.src = 'about:blank';
                    }
                }
                section.classList.remove('active-section');
            }
        });

        const targetSection = document.getElementById(sectionIdToActivate);
        if (targetSection) {
            // 根据 sectionId 初始化对应的模块
            if (pluginName) {
                loadPluginConfig(pluginName).catch(err => console.error(`Failed to load config for ${pluginName}`, err));
            } else {
                switch (sectionIdToActivate) {
                    case 'dashboard-section':
                        initializeDashboard();
                        break;
                    case 'daily-notes-manager-section':
                        initializeDailyNotesManager();
                        break;
                    case 'agent-files-editor-section':
                        initializeAgentManager();
                        break;
                    case 'agent-assistant-config-section':
                        initializeAgentAssistantConfig();
                        break;
                    case 'agent-scores-section':
                        initializeAgentScores();
                        break;
                    case 'toolbox-manager-section':
                        initializeToolboxManager();
                        break;
                    case 'tvs-files-editor-section':
                        initializeTvsFilesEditor();
                        break;
                    case 'server-log-viewer-section':
                        initializeServerLogViewer();
                        break;
                    case 'preprocessor-order-manager-section':
                        initializePreprocessorOrderManager();
                        break;
                    case 'semantic-groups-editor-section':
                        initializeSemanticGroupsEditor();
                        break;
                    case 'thinking-chains-editor-section':
                        initializeThinkingChainsEditor();
                        break;
                    case 'vcp-forum-section':
                        initializeVCPForum();
                        break;
                    case 'schedule-manager-section':
                        initializeScheduleManager();
                        break;
                    case 'rag-tuning-section':
                        initializeRAGTuning();
                        break;
                    case 'dream-manager-section':
                        initializeDreamManager();
                        break;
                    case 'placeholder-viewer-section':
                        initializePlaceholderViewer();
                        break;
                    case 'tool-approval-manager-section':
                        initializeToolApprovalManager();
   
```

### Core Architecture Module: `AdminPanel-Vue/public/tool_list_editor.js`
```
// tool_list_editor.js

(function() {
    'use strict';

    // API基础URL
    const API_BASE = '/admin_api';
    
    // 状态
    let allTools = []; // 所有可用工具
    let selectedTools = new Set(); // 已选择的工具名称
    let toolDescriptions = {}; // 自定义工具描述（工具名 -> 描述文本）
    let currentConfigFile = null; // 当前配置文件名
    let availableConfigs = []; // 可用的配置文件列表
    const toolItemsCache = new Map(); // DOM缓存：uniqueId -> DOM元素
    const visiblePlugins = new Set(); // 可见的插件名称

    // DOM元素
    const elements = {
        configSelect: document.getElementById('config-file-select'),
        newConfigInput: document.getElementById('new-config-name'),
        loadConfigBtn: document.getElementById('load-config-btn'),
        createConfigBtn: document.getElementById('create-config-btn'),
        deleteConfigBtn: document.getElementById('delete-config-btn'),
        saveConfigBtn: document.getElementById('save-config-btn'),
        exportTxtBtn: document.getElementById('export-txt-btn'),
        configStatus: document.getElementById('config-status'),
        
        toolSearch: document.getElementById('tool-search'),
        showSelectedOnly: document.getElementById('show-selected-only'),
        selectAllBtn: document.getElementById('select-all-btn'),
        deselectAllBtn: document.getElementById('deselect-all-btn'),
        
        toolsList: document.getElementById('tools-list'),
        toolCount: document.getElementById('tool-count'),
        
        includeHeader: document.getElementById('include-header'),
        includeExamples: document.getElementById('include-examples'),
        copyPreviewBtn: document.getElementById('copy-preview-btn'),
        previewOutput: document.getElementById('preview-output'),
        
        loadingOverlay: document.getElementById('loading-overlay')
    };

    // 初始化
    async function init() {
        showLoading(true);
        try {
            await loadAvailableTools();
            await loadAvailableConfigs();
            renderPluginFilterList();
            attachEventListeners();
            updateToolCount();
            updatePreview();
        } catch (error) {
            console.error('初始化失败:', error);
            showStatus('初始化失败: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // 加载所有可用工具
    async function loadAvailableTools() {
        try {
            const response = await fetch(`${API_BASE}/tool-list-editor/tools`);
            if (!response.ok) throw new Error('获取工具列表失败');
            const data = await response.json();
            allTools = data.tools || [];
            
            // 标记无效工具，但不过滤掉（方便用户检查）
            allTools.forEach((tool, index) => {
                if (!tool || !tool.pluginName || !tool.name) {
                    console.warn('发现无效工具数据:', tool);
                    tool.isInvalid = true;
                    // 为无效工具设置默认值
                    tool.pluginName = tool.pluginName || '未知插件';
                    tool.name = tool.name || `无效工具_${index}`;
                    tool.description = '⚠️ 此工具数据不完整，请检查插件配置';
                } else {
                    tool.isInvalid = false;
                }
            });
            
            // 为每个工具生成唯一ID，使用更稳定的方式
            // 使用计数器处理同插件同名的情况
            const nameCounters = new Map();
            allTools.forEach(tool => {
                const baseId = `${tool.pluginName}__${tool.name}`;
                const count = nameCounters.get(baseId) || 0;
                tool.uniqueId = count === 0 ? baseId : `${baseId}__${count}`;
                nameCounters.set(baseId, count + 1);
            });
            
            renderToolsList();
        } catch (error) {
            console.error('加载工具列表失败:', error);
            throw error;
        }
    }

    // 加载可用的配置文件列表
    async function loadAvailableConfigs() {
        try {
            const response = await fetch(`${API_BASE}/tool-list-editor/configs`);
            if (!response.ok) throw new Error('获取配置文件列表失败');
            const data = await response.json();
            availableConfigs = data.configs || [];
            renderConfigSelect();
        } catch (error) {
            console.error('加载配置文件列表失败:', error);
            // 非关键错误，不抛出
        }
    }

    // 渲染配置文件下拉列表
    function renderConfigSelect() {
        // 保留"新建"选项
        elements.configSelect.innerHTML = '<option value="">-- 新建配置文件 --</option>';
        availableConfigs.forEach(config => {
            const option = document.createElement('option');
            option.value = config;
            option.textContent = config;
            elements.configSelect.appendChild(option);
        });
    }

    // 渲染工具列表
    function renderToolsList() {
        elements.toolsList.innerHTML = '';
        toolItemsCache.clear(); // 清空DOM缓存
        
        if (allTools.length === 0) {
            elements.toolsList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--secondary-text);">暂无可用工具</p>';
            return;
        }

        // 按插件分组工具，同时区分有效和无效工具
        const validToolsByPlugin = {};
        const invalidToolsByPlugin = {};
        
        allTools.forEach(tool => {
            const pluginName = tool.pluginName;
            const targetMap = tool.isInvalid ? invalidToolsByPlugin : validToolsByPlugin;
            
            if (!targetMap[pluginName]) {
                targetMap[pluginName] = [];
            }
            targetMap[pluginName].push(tool);
        });

        // 先显示有效插件（按插件名排序）
        const sortedValidPluginNames = Object.keys(validToolsByPlugin).sort((a, b) => a.localeCompare(b));
        sortedValidPluginNames.forEach(pluginName => {
            const pluginTools = validToolsByPlugin[pluginName];
            const pluginGroup = createPluginGroupElement(pluginName, pluginTools, false);
            elements.toolsList.appendChild(pluginGroup);
        });
        
        // 再显示无效插件（放在最后，方便用户检查）
        const sortedInvalidPluginNames = Object.keys(invalidToolsByPlugin).sort((a, b) => a.localeCompare(b));
        if (sortedInvalidPluginNames.length > 0) {
            // 添加分隔符
            const separator = document.createElement('div');
            separator.className = 'invalid-tools-separator';
            separator.innerHTML = '<span>⚠️ 以下工具数据不完整，请检查插件配置 ⚠️</span>';
            elements.toolsList.appendChild(separator);
            
            sortedInvalidPluginNames.forEach(pluginName => {
                const pluginTools = invalidToolsByPlugin[pluginName];
                const pluginGroup = createPluginGroupElement(pluginName, pluginTools, true);
                elements.toolsList.appendChild(pluginGroup);
            });
        }
    }

    // 创建插件分组元素
    function createPluginGroupElement(pluginName, tools, isInvalid = false) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'plugin-group' + (isInvalid ? ' invalid-plugin-group' : '');
        groupDiv.dataset.pluginName = pluginName;

        // 创建分组头部
        const header = document.createElement('div');
        header.className = 'plugin-group-header' + (isInvalid ? ' invalid-plugin-header' : '');
        
        // 插件名称 (使用第一个工具的displayName作为插件显示名)
        const pluginDisplayName = tools.length > 0 ? tools[0].displayName : pluginName;
        const icon = isInvalid ? '⚠️' : '📦';
        
        // 检查这个插件下所有工具是否都已选中
        const allSelected = tools.every(tool => selectedTools.has(tool.uniqueId));
        const someSelected = tools.some(tool => selectedTools.has(tool.uniqueId));
        
        header.innerHTML = `
            <span class="plugin-group-icon">${icon}</span>
            <span class="plugin-group-name">${pluginDisplayName}</span>
            <span class="plugin-group-original-name">(${pluginName})</span>
            <span class="plugin-group-count">${tools.length} 个工具</span>
            <button class="btn-select-all-plugin" data-plugin="${pluginName}" title="${allSelected ? '取消全选' : '全选此插件'}">
                ${allS
```

### Core Architecture Module: `AdminPanel-Vue/public/vcptavern_editor.js`
```
document.addEventListener('DOMContentLoaded', () => {
    const presetSelect = document.getElementById('preset-select');
    const loadPresetBtn = document.getElementById('load-preset');
    const newPresetBtn = document.getElementById('new-preset');
    const deletePresetBtn = document.getElementById('delete-preset');
    const editorContainer = document.getElementById('editor-container');
    const presetNameInput = document.getElementById('preset-name');
    const presetDescriptionInput = document.getElementById('preset-description');
    const presetPlaceholderAllowlistInput = document.getElementById('preset-placeholder-allowlist');
    const rulesList = document.getElementById('rules-list');
    const addRuleBtn = document.getElementById('add-rule');
    const savePresetBtn = document.getElementById('save-preset');

    const API_BASE_URL = '/admin_api/vcptavern';
    let currentPreset = null;
    let draggedItem = null;

    async function fetchPresets() {
        try {
            const response = await fetch(`${API_BASE_URL}/presets`);
            const presets = await response.json();
            presetSelect.innerHTML = '<option value="">--选择一个预设--</option>';
            presets.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                presetSelect.appendChild(option);
            });
        } catch (error) {
            console.error('获取预设列表失败:', error);
            alert('获取预设列表失败!');
        }
    }

    async function loadPreset(name) {
        if (!name) {
            editorContainer.classList.add('hidden');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/presets/${name}`);
            if (!response.ok) {
                throw new Error(`服务器返回 ${response.status}`);
            }
            currentPreset = await response.json();
            presetNameInput.value = name;
            presetNameInput.disabled = true; // Don't allow editing name of existing preset
            presetDescriptionInput.value = currentPreset.description || '';
            presetPlaceholderAllowlistInput.value = (currentPreset.placeholderAllowlist || [])
                .map(item => String(item).replace(/^\{\{|\}\}$/g, '').trim())
                .filter(Boolean)
                .join('\n');
            renderRules(currentPreset.rules || []);
            editorContainer.classList.remove('hidden');
        } catch (error) {
            console.error(`加载预设 ${name} 失败:`, error);
            alert(`加载预设 ${name} 失败!`);
        }
    }

    function renderRules(rules) {
        rulesList.innerHTML = '';
        rules.forEach(rule => {
            const ruleElement = createRuleElement(rule);
            rulesList.appendChild(ruleElement);
        });
    }

    function createRuleElement(rule) {
        const ruleId = rule.id || `rule-${Date.now()}-${Math.random()}`;
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.dataset.id = ruleId;

        card.innerHTML = `
            <div class="rule-header">
                <div class="drag-handle" title="拖拽移动">⋮⋮</div>
                <h3 contenteditable="true">${rule.name || '新规则'}</h3>
                <div class="rule-controls">
                    <button class="toggle-rule" title="启用/禁用">${rule.enabled ? '🟢' : '🔴'}</button>
                    <button class="delete-rule" title="删除规则">🗑️</button>
                </div>
            </div>
            <div class="rule-body">
                <div class="form-group">
                    <label>注入类型</label>
                    <select class="rule-type">
                        <option value="relative" ${rule.type === 'relative' ? 'selected' : ''}>相对注入</option>
                        <option value="depth" ${rule.type === 'depth' ? 'selected' : ''}>深度注入</option>
                        <option value="embed" ${rule.type === 'embed' ? 'selected' : ''}>嵌入</option>
                    </select>
                </div>
                <div class="form-group relative-options" style="display: ${(rule.type === 'relative' || rule.type === 'embed') ? 'flex' : 'none'};">
                    <label>相对位置</label>
                    <select class="rule-position">
                        <option value="before" ${(rule.position === 'before' || !rule.position) ? 'selected' : ''}>之前</option>
                        <option value="after" ${rule.position === 'after' ? 'selected' : ''}>之后</option>
                    </select>
                </div>
                <div class="form-group relative-options" style="display: ${(rule.type === 'relative' || rule.type === 'embed') ? 'flex' : 'none'};">
                    <label>目标</label>
                    <select class="rule-target">
                        <option value="system" ${(rule.target === 'system' || !rule.target) ? 'selected' : ''}>系统提示</option>
                        <option value="last_user" ${rule.target === 'last_user' ? 'selected' : ''}>最后的用户消息</option>
                    </select>
                </div>
                <div class="form-group depth-options" style="display: ${rule.type === 'depth' ? 'flex' : 'none'};">
                    <label>深度</label>
                    <input type="number" class="rule-depth" value="${rule.depth || 1}" min="1">
                </div>
                <div class="form-group role-options" style="display: ${rule.type !== 'embed' ? 'flex' : 'none'};">
                    <label>注入角色</label>
                    <select class="rule-content-role">
                        <option value="system" ${rule.content.role === 'system' ? 'selected' : ''}>system</option>
                        <option value="user" ${rule.content.role === 'user' ? 'selected' : ''}>user</option>
                        <option value="assistant" ${rule.content.role === 'assistant' ? 'selected' : ''}>assistant</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>注入内容</label>
                    <textarea class="rule-content-text" style="${rule.ui?.textareaWidth ? `width: ${rule.ui.textareaWidth};` : ''} ${rule.ui?.textareaHeight ? `height: ${rule.ui.textareaHeight};` : ''}">${rule.content.content || ''}</textarea>
                </div>
            </div>
        `;

        // Event Listeners
        card.querySelector('.rule-type').addEventListener('change', (e) => {
            const relativeOptions = card.querySelectorAll('.relative-options');
            const depthOptions = card.querySelectorAll('.depth-options');
            const roleOptions = card.querySelectorAll('.role-options');
            const type = e.target.value;

            if (type === 'relative') {
                relativeOptions.forEach(el => el.style.display = 'flex');
                depthOptions.forEach(el => el.style.display = 'none');
                roleOptions.forEach(el => el.style.display = 'flex');
            } else if (type === 'depth') {
                relativeOptions.forEach(el => el.style.display = 'none');
                depthOptions.forEach(el => el.style.display = 'flex');
                roleOptions.forEach(el => el.style.display = 'flex');
            } else if (type === 'embed') {
                relativeOptions.forEach(el => el.style.display = 'flex');
                depthOptions.forEach(el => el.style.display = 'none');
                roleOptions.forEach(el => el.style.display = 'none');
            }
        });

        card.querySelector('.delete-rule').addEventListener('click', () => card.remove());
        
        const toggleBtn = card.querySelector('.toggle-rule');
        toggleBtn.addEventListener('click', () => {
             const isEnabled = toggleBtn.textContent === '🟢';
             toggleBtn.textContent = isEnabled ? '🔴' : '🟢';
        });

        // Drag and Drop
        const drag
```

### Core Architecture Module: `AdminPanel-Vue/scripts/check-typography-guard.mjs`
```
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.cwd();

const pxGuardTargets = [
  "src",
  "src/views",
  "src/layouts/MainLayout.vue",
  "src/views/ImageCacheEditor.vue",
  "src/views/RagTuning.vue",
  "src/components/layout",
  "src/views/PlaceholderViewer.vue",
  "src/views/PlaceholderViewer",
  "src/components/feedback",
  "src/components/dashboard",
  "src/views/AgentAssistantConfig.vue",
  "src/views/ScheduleManager.vue",
  "src/views/Login.vue",
  "src/views/BaseConfig.vue",
  "src/views/ForumAssistantConfig.vue",
  "src/views/AgentScores.vue",
  "src/views/ToolboxManager.vue",
  "src/views/SemanticGroupsEditor.vue",
  "src/views/ServerLogViewer.vue",
  "src/views/ToolApprovalManager.vue",
  "src/views/ThinkingChainsEditor.vue",
  "src/views/DreamManager.vue",
  "src/views/AgentFilesEditor.vue",
  "src/views/PluginsHub.vue",
];

const duplicateGuardFile = "src/style/layout.css";
const allowedExtensions = new Set([".css", ".vue"]);
const issues = [];

function toPosixPath(filePath) {
  return normalize(filePath).replaceAll("\\", "/");
}

function walkAbsolute(absolutePath) {
  const stats = statSync(absolutePath);

  if (stats.isFile()) {
    return allowedExtensions.has(extname(absolutePath)) ? [absolutePath] : [];
  }

  const files = [];
  for (const name of readdirSync(absolutePath)) {
    files.push(...walkAbsolute(join(absolutePath, name)));
  }

  return files;
}

function getLine(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function checkNoFixedPxFontSize(filePath) {
  const content = readFileSync(filePath, "utf8");
  const regex = /font-size\s*:\s*\d+(?:\.\d+)?px\b/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    issues.push({
      filePath,
      line: getLine(content, match.index),
      message: `禁止使用固定字号：${match[0]}，请改为语义字号变量（var(--font-size-*)）`,
    });
  }
}

function checkNoDirectClampFontSize(filePath) {
  const content = readFileSync(filePath, "utf8");
  const regex = /font-size\s*:\s*clamp\s*\(/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    issues.push({
      filePath,
      line: getLine(content, match.index),
      message: "禁止直接使用 font-size: clamp(...)，请封装为语义字号变量后再引用",
    });
  }
}

function checkLayoutUtilityDuplicates(filePath) {
  const content = readFileSync(filePath, "utf8");
  const utilitySelectors = [".text-sm", ".text-lg"];

  for (const selector of utilitySelectors) {
    const escaped = selector.replace(".", "\\.");
    const regex = new RegExp(`${escaped}\\s*\\{`, "g");
    const matches = [...content.matchAll(regex)];

    if (matches.length > 1) {
      const lines = matches
        .map((entry) => getLine(content, entry.index ?? 0))
        .join(", ");
      issues.push({
        filePath,
        line: getLine(content, matches[1].index ?? 0),
        message: `${selector} 重复定义（共 ${matches.length} 处，行：${lines}），会造成流体排版被覆盖`,
      });
    }
  }
}

function main() {
  const fileSet = new Set();

  for (const target of pxGuardTargets) {
    const absoluteTargetPath = join(root, target);
    for (const filePath of walkAbsolute(absoluteTargetPath)) {
      fileSet.add(filePath);
    }
  }

  for (const filePath of fileSet) {
    checkNoFixedPxFontSize(filePath);
    checkNoDirectClampFontSize(filePath);
  }

  const layoutFilePath = join(root, duplicateGuardFile);
  checkLayoutUtilityDuplicates(layoutFilePath);

  if (issues.length === 0) {
    console.log("Typography guard passed.");
    return;
  }

  console.error("Typography guard failed:\n");
  for (const issue of issues) {
    const displayPath = toPosixPath(issue.filePath).replace(`${toPosixPath(root)}/`, "");
    console.error(`- ${displayPath}:${issue.line} ${issue.message}`);
  }

  process.exitCode = 1;
}

main();

```

### Core Architecture Module: `AdminPanel-Vue/src/api/admin-config.ts`
```
import {
  requestWithUi,
  type RequestUiOptions,
} from "./requestWithUi";
import type {
  Preprocessor,
  ToolApprovalConfig,
} from "@/types/api.admin-config";

const DEFAULT_READ_UI_OPTIONS: RequestUiOptions = { showLoader: false };
export type { Preprocessor, ToolApprovalConfig } from "@/types/api.admin-config";

interface MainConfigResponse {
  content?: string;
  exampleContent?: string;
  source?: "config.env" | "config.env.example" | "none";
  hasCustomConfig?: boolean;
  configExists?: boolean;
  exampleExists?: boolean;
  configMatchesExample?: boolean;
}

export interface MainConfigData {
  content: string;
  exampleContent: string;
  source: "config.env" | "config.env.example" | "none";
  hasCustomConfig: boolean;
  configExists: boolean;
  exampleExists: boolean;
  configMatchesExample: boolean;
}

interface PreprocessorOrderResponse {
  order?: Preprocessor[];
  newOrder?: Preprocessor[];
}

export const adminConfigApi = {
  async getMainConfig(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<MainConfigData> {
    const response = await requestWithUi<MainConfigResponse>(
      {
        url: "/admin_api/config/main",
      },
      uiOptions
    );

    const source =
      response.source === "config.env" ||
      response.source === "config.env.example" ||
      response.source === "none"
        ? response.source
        : "config.env";

    return {
      content: response.content || "",
      exampleContent: response.exampleContent || "",
      source,
      hasCustomConfig:
        response.hasCustomConfig === true ||
        (response.hasCustomConfig !== false && source === "config.env"),
      configExists: response.configExists !== false,
      exampleExists:
        response.exampleExists === true || source === "config.env.example",
      configMatchesExample: response.configMatchesExample === true,
    };
  },

  async saveMainConfig(
    content: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await requestWithUi(
      {
        url: "/admin_api/config/main",
        method: "POST",
        body: { content },
      },
      uiOptions
    );
  },

  async getToolApprovalConfig(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<ToolApprovalConfig> {
    return requestWithUi(
      {
        url: "/admin_api/tool-approval-config",
      },
      uiOptions
    );
  },

  async saveToolApprovalConfig(
    config: ToolApprovalConfig,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await requestWithUi(
      {
        url: "/admin_api/tool-approval-config",
        method: "POST",
        body: { config },
      },
      uiOptions
    );
  },

  async getPreprocessorOrder(
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<Preprocessor[]> {
    const response = await requestWithUi<PreprocessorOrderResponse>(
      {
        url: "/admin_api/preprocessors/order",
      },
      uiOptions
    );
    const order = response.order || response.newOrder;
    return Array.isArray(order) ? order : [];
  },

  async savePreprocessorOrder(
    order: string[],
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await requestWithUi(
      {
        url: "/admin_api/preprocessors/order",
        method: "POST",
        body: { order },
      },
      uiOptions
    );
  },
};


```

### Core Architecture Module: `AdminPanel-Vue/src/api/agent.ts`
```
import {
  requestWithUi,
  type HttpRequestContext,
  type RequestUiOptions,
} from "./requestWithUi";
import type {
  AgentAssistantConfigResponse,
  AgentAssistantDelegationTask,
  AgentAssistantDelegationsResponse,
  CancelAgentAssistantDelegationResponse,
  AgentMapResponse,
  AgentScoreHistoryEntry,
  AgentScoreSummary,
  SaveAgentAssistantConfigPayload,
} from "@/types/api.agent";

const DEFAULT_READ_UI_OPTIONS: RequestUiOptions = { showLoader: false };
export type {
  AgentAssistantConfigAgent,
  AgentAssistantConfigResponse,
  AgentAssistantDelegationTask,
  AgentAssistantDelegationsResponse,
  CancelAgentAssistantDelegationResponse,
  AgentInfo,
  AgentMapResponse,
  AgentScoreHistoryEntry,
  AgentScoreSummary,
  SaveAgentAssistantConfigPayload,
} from "@/types/api.agent";

interface AgentFilesResponse {
  files?: string[];
}

interface AgentScoreApiEntry {
  name?: string;
  totalPoints?: number;
  history?: AgentScoreHistoryEntry[];
}

export const agentApi = {
  async getAgentConfig(
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<AgentAssistantConfigResponse> {
    return requestWithUi(
      {
        url: "/admin_api/agent-assistant/config",
        ...requestContext,
      },
      uiOptions
    );
  },

  async saveAgentConfig(
    config: SaveAgentAssistantConfigPayload,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await requestWithUi(
      {
        url: "/admin_api/agent-assistant/config",
        method: "POST",
        body: config,
      },
      uiOptions
    );
  },

  async getAgentDelegations(
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<AgentAssistantDelegationsResponse> {
    const response = await requestWithUi<{ data?: AgentAssistantDelegationsResponse } | AgentAssistantDelegationsResponse>(
      {
        url: "/admin_api/agent-assistant/delegations",
        ...requestContext,
      },
      uiOptions
    );
    if ("data" in response && response.data) {
      return response.data;
    }
    return response as AgentAssistantDelegationsResponse;
  },

  async getAgentDelegationDetail(
    delegationId: string,
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<AgentAssistantDelegationTask | null> {
    const response = await requestWithUi<{ data?: AgentAssistantDelegationTask } | AgentAssistantDelegationTask>(
      {
        url: `/admin_api/agent-assistant/delegations/${encodeURIComponent(delegationId)}`,
        ...requestContext,
      },
      uiOptions
    );
    if ("data" in response && response.data) {
      return response.data;
    }
    return response as AgentAssistantDelegationTask;
  },

  async cancelAgentDelegation(
    delegationId: string,
    reason = "用户从管理面板请求取消。",
    uiOptions: RequestUiOptions = {}
  ): Promise<CancelAgentAssistantDelegationResponse> {
    return requestWithUi(
      {
        url: `/admin_api/agent-assistant/delegations/${encodeURIComponent(delegationId)}/cancel`,
        method: "POST",
        body: { reason },
      },
      uiOptions
    );
  },

  async getAgentMap(
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<AgentMapResponse> {
    return requestWithUi(
      {
        url: "/admin_api/agents/map",
        ...requestContext,
      },
      uiOptions
    );
  },

  async saveAgentMap(
    agentMap: AgentMapResponse,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await requestWithUi(
      {
        url: "/admin_api/agents/map",
        method: "POST",
        body: agentMap,
      },
      uiOptions
    );
  },

  async getAgentFiles(
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<string[]> {
    const response = await requestWithUi<AgentFilesResponse | string[]>(
      {
        url: "/admin_api/agents",
        ...requestContext,
      },
      uiOptions
    );
    if (Array.isArray(response)) {
      return response;
    }
    return response.files || [];
  },

  async getAgentFileContent(
    filename: string,
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<string> {
    const response = await requestWithUi<{ content?: string }>(
      {
        url: `/admin_api/agents/${encodeURIComponent(filename)}`,
        ...requestContext,
      },
      uiOptions
    );
    return response.content || "";
  },

  async saveAgentFile(
    filename: string,
    content: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await requestWithUi(
      {
        url: `/admin_api/agents/${encodeURIComponent(filename)}`,
        method: "POST",
        body: { content },
      },
      uiOptions
    );
  },

  async createAgentFile(
    filename: string,
    folderPath?: string,
    uiOptions: RequestUiOptions = {}
  ): Promise<void> {
    await requestWithUi(
      {
        url: "/admin_api/agents/new-file",
        method: "POST",
        body: { fileName: filename, folderPath },
      },
      uiOptions
    );
  },

  async getAgentScores(
    requestContext: HttpRequestContext = {},
    uiOptions: RequestUiOptions = DEFAULT_READ_UI_OPTIONS
  ): Promise<AgentScoreSummary[]> {
    const response = await requestWithUi<Record<string, AgentScoreApiEntry>>(
      {
        url: "/admin_api/agent-assistant/scores",
        ...requestContext,
      },
      uiOptions
    );

    return Object.entries(response || {}).map(([baseName, entry]) => ({
      baseName,
      name: entry.name || baseName,
      totalPoints: entry.totalPoints || 0,
      history: Array.isArray(entry.history) ? entry.history : [],
    }));
  },
};


```

### Core Architecture Module: `AdminPanel-Vue/src/api/auth.ts`
```
import type {
  AuthCheckResponse,
  LoginRequest,
  LoginResponse,
} from "@/types/api.auth";
import { executeRequest } from '@/platform/http/request'
import { HttpError, toHttpError } from '@/platform/http/errors'
import { createLogger } from '@/utils/logger'

export type AuthUserInfo = NonNullable<AuthCheckResponse['user']>

const logger = createLogger('AuthApi')

interface StatusError extends Error {
  status?: number
}

interface AuthRequestResult<T> {
  ok: boolean
  status?: number
  data?: T
  message?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractAuthUser(payload: unknown): AuthUserInfo | null {
  if (!isRecord(payload)) {
    return null
  }

  const user = payload.user
  if (!isRecord(user)) {
    return null
  }

  const username = user.username
  const role = user.role

  if (typeof username !== 'string' || username.length === 0) {
    return null
  }

  return {
    username,
    role: typeof role === 'string' ? role : undefined,
  }
}

function toStatusError(error: unknown): StatusError {
  if (error instanceof HttpError) {
    return error
  }

  if (error instanceof Error) {
    return error as StatusError
  }

  return toHttpError(error)
}

function createBasicAuth(credentials: LoginRequest): string {
  return `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
  }

async function requestAuth<T>(
  request: {
    url: string
    method: 'GET' | 'POST'
    headers?: Record<string, string>
  }
): Promise<AuthRequestResult<T>> {
  try {
    const data = await executeRequest<T>(request)
    return {
      ok: true,
      data,
    }
  } catch (error) {
    const statusError = toStatusError(error)
    return {
      ok: false,
      status: statusError.status,
      message: statusError.message,
    }
  }
}

async function requestVerifyLogin(
  credentials?: LoginRequest
): Promise<AuthRequestResult<unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (credentials) {
    headers.Authorization = createBasicAuth(credentials)
  }

  return requestAuth({
    url: '/admin_api/verify-login',
    method: 'POST',
    headers,
  })
}

async function requestCheckAuth(): Promise<AuthRequestResult<AuthCheckResponse>> {
  return requestAuth<AuthCheckResponse>({
    url: '/admin_api/check-auth',
    method: 'GET',
  })
}

function isAuthenticatedResponse(payload: AuthCheckResponse | undefined): boolean {
  if (!payload) {
    return false
  }

  if (typeof payload.authenticated === 'boolean') {
    return payload.authenticated
  }

  return true
}

function normalizeLoginError(result: AuthRequestResult<unknown>): LoginResponse {
  if (result.status === 429) {
    return {
      success: false,
      message: result.message || '登录尝试过于频繁，请稍后再试',
    }
  }

  if (result.status === 401 || result.status === 403) {
    return {
      success: false,
      message: '用户名或密码错误',
    }
  }

  if (result.status && result.status >= 500) {
    return {
      success: false,
      message: '服务器暂时不可用，请稍后再试',
    }
  }

  if (result.message) {
    return {
      success: false,
      message: '连接服务器失败，请检查网络',
    }
  }

  return {
    success: false,
    message: '登录失败，请稍后重试',
  }
}

export const authApi = {
  async verifyLogin(): Promise<boolean> {
    const result = await requestVerifyLogin()
    if (!result.ok) {
      logger.warn('verify-login check failed:', {
        status: result.status,
        message: result.message,
      })
    }

    return result.ok
  },

  async checkAuthStatus(): Promise<boolean> {
    const result = await requestCheckAuth()

    if (result.ok) {
      return isAuthenticatedResponse(result.data)
    }

    if (result.status === 404) {
      logger.warn('check-auth not found, falling back to verify-login')
      return authApi.verifyLogin()
    }

    logger.warn('check-auth failed, falling back to verify-login:', {
      status: result.status,
      message: result.message,
    })
    return authApi.verifyLogin()
  },

  async getCurrentUserInfo(): Promise<AuthUserInfo | null> {
    const result = await requestCheckAuth()

    if (!result.ok) {
      if (result.status !== 404) {
        logger.warn('fetch user info failed at /admin_api/check-auth:', {
          status: result.status,
          message: result.message,
        })
      }
      return null
    }

    return extractAuthUser(result.data)
  },

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const result = await requestVerifyLogin(credentials)

    if (result.ok) {
      return { success: true }
    }

    logger.warn('login request failed:', {
      status: result.status,
      message: result.message,
    })

    return normalizeLoginError(result)
  },
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #483** (2026-09-25): **fix(deps): remove unused hnswlib-node dependency**
  *Symptoms*: Fixes #482.  `hnswlib-node` is no longer used after the RAG storage refactor, but it remains in the root dependency list and runs `node-gyp` during clean Windows installs. This patch removes the dead dependency, adds the missing optional `fsevents` lock entry so `npm ci` is reproducible, and updates the RAG README to describe the current SQLite/`rust-vexus-lite` path.  Validation:  - `npm install --package-lock=false --no-audit --no-fund --foreground-scripts` - `npm ci --dry-run --ignore-scripts --no-audit --no-fund` - native-module smoke checks for the current SQLite, TriviumDB, Rust index, image, tokenizer, and Puppeteer modules 

- **Issue #482** (2026-09-25): **移除死依赖 hnswlib-node：它让 npm install 必须安装 MSVC Build Tools（2-3GB）才能成功**
  *Symptoms*: ## 现象  全新 Windows 机器上按 `docs/OPERATIONS.md` 走 `npm install` 会直接失败，并且**整棵依赖树回滚**（`node_modules` 被清空，exit 1），报错指向 `hnswlib-node`：  ``` > hnswlib-node@1.4.2 install > node-gyp rebuild  gyp ERR! find VS gyp ERR! find VS --msvs_version was not set on the command line gyp ERR! find VS VCINSTALLDIR not set, not running in VS Command Prompt gyp ERR! find VS You need to install the latest version of Visual Studio gyp ERR! find VS including the "Desktop development with C++" workload. gyp ERR! not ok  npm error code 1 npm error path C:\...\node_modules\hnswlib-node npm error command failed ```  环境：Windows 10.0.26100 / Node v24.21.0（ABI 137）/ npm 11.19.0。  ## 根因  `hnswlib-node@1.4.2` 没有发布任何预编译产物，`install` 脚本就是裸的 `node-gyp rebuild`，因此必须本机存在 MSVC C++ 工具链。而同一棵树里**其它原生依赖全部走预编译，完全不需要编译器**：  | 包 | 安装方式 | 需要 MSVC | | --- | --- | --- | | `hnswlib-node@1.4.2` | `node-gyp rebuild`（无 prebuild） | **是** | | `better-sqlite3@12.4.1` | `prebuild-install`（ABI 137 有产物） | 否 | | `sharp` / `@napi-rs/canvas` / `@node-rs/jieba` / `triviumdb` | 预编译产物 | 否 | | `rust-vexus-lite` | 仓库自带 `.node`，或 cargo 自编 | 否 | | `puppeteer` | 只下载 Chrome | 否 | | `ssh2` 的可选 crypto binding / `cpu-features` | node-gyp，但为 optional，失败被容忍 | 否（可忽略） |  为了一个没人用的依赖去装 2-3 GB 的 VS Build Tools 并配置 "Desktop development with C++"，对只想跑起服务的人是很大的体验代价（下载、安装、可能还要重开终端；安装器为此专门写了 `msvc_ops.rs` 整条流程也是同一个痛点）。  ## 这个依赖已经没有任何代码在用  `hnswlib-node` 是 2025-11-19 那轮数据库重构的遗留：重构删掉了全部调用点，但漏删了 `package.json` 里的声明。  ``` $ git grep -in hnsw -- '*.js' '*.mjs' '*.cjs' '

- **Issue #481** (2026-09-22): **feat(BilibiliFetch): 修复快照多模态在下游网关触发 SSRF 500 熔断的问题，并优化国内代理路由与多级凭据读取容错**
  *Symptoms*: ### 📌 Summary / 概述 本 PR 针对最新 `2.1.0` 多模态快照特性在生产环境中暴露出的网关拦截隐患进行了关键性修复，并增强了国内 API 的代理路由协调与凭据多级读取容错。  保持 100% 纯 Python 单文件 `synchronous` 同步插件契约，零新增外部依赖，完全向下兼容。  ---  ### 🐛 Critical Bugfix / 关键缺陷修复  1. **彻底解决多模态快照在 API 网关 (New-API / One-API) 下触发 SSRF 500 熔断的问题**：    - **痛点**：`2.1.0` 在 `images_to_add` 中直接将 `http://localhost:6005/...` 传给大模型的 `image_url`。当下游使用 New-API / One-API 或公网云端大模型时，网关的 SSRF 防火墙会拦截内网端口并报错：      `failed to download file from http://localhost:6005/...: request reject: port 6005 is not allowed (500 Error)`，导致整次对话流被掐断。    - **方案（双轨视界分离）**：      - **人类视角**：正文 Markdown 引用保留 `http://localhost:6005`，供前端客户端轻量渲染；      - **模型视角**：将小体积快照编码为标准内联 Base64 Data URI（`data:image/jpeg;base64,...`）喂入 `image_url`。大模型免网络请求直接视觉解析，彻底根除 SSRF 拦截。    - **安全熔断**：单次请求注入大模型的多模态图片数量硬编码上限设为 10 张（`MAX_MULTIMODAL_IMAGES = 10`），防止异常长数组撑爆上下文或网关 Payload 上限。  ---  ### ✨ Other Improvements / 其它改进  2. **零配置 POSIX NO_PROXY 智能路由协调**：    - 针对国内用户开启系统全局代理（如 Clash 7890 端口）常导致 `api.bilibili.com` 直连请求误走海外节点触发 `412 Precondition Failed` 风控的痛点，自动在当前子进程注入 `NO_PROXY` 域；    - 保持用户的 `HTTP_PROXY / HTTPS_PROXY` 完整原貌，不破坏海外用户和内网用户的专用代理链路。  3. **内联凭据管理器与热更新钩子（Credentials Cache Hook）**：    - 内联轻量凭据读取器，支持多级回退阶梯：      1. 目录级 `.cookies_cache` 运行时缓存（若存在则优先提取最新 `SESSDATA`，为外部脚本/扩展热自愈提供标准通道）；      2. 插件局部 `config.env`（解除对主程序根目录的强依赖）；      3. 环境变量 `BILIBILI_COOKIE`；      4. 全局根目录 `config.env`（向下绝对兼容）。  4. **跨平台可执行文件后缀兼容**：    - `get_ffmpeg_path` 兼容 `os.name == 'nt'` 的动态 `.exe` 探测，提升 Linux / Do

- **Issue #480** (2026-09-21): **fix(dailyNotes): 支持日记保存时同步重命名与严格扩展名白名单兜底**
  *Symptoms*: ### 问题背景 1. `POST /note/:folderName/:fileName` 接口原先只处理正文覆盖，不支持日记重命名，导致前端修改标题输入框后无法物理生效。 2. 传统的 `path.extname()` 在处理类似 `2025.04.txt` 这类包含点号的日期或版本号文件名时，若输入无后缀的 `2025.04`，易将 `.04` 误判为扩展名截断，导致后缀判定失常。  ### 修复内容 1. **支持 newFileName**：从请求体解构新文件名，支持同时修改文件名与日记正文。 2. **扩展名严格白名单与兜底**：严格依据 `allowedExtensions` 白名单判定后缀；若新文件名未以白名单后缀结尾，优先寻找原文件合法后缀，若原文件亦无合法后缀则强制铁律兜底补齐 `.txt`，杜绝裸文件与伪扩展名。 3. **原子落盘与防冲撞**：重命名前使用 `fs.access` 探测目标文件，若冲突返回 `409 Conflict (EEXIST)`，杜绝静默误覆盖；写入新文件并物理清理旧文件，向 `executeFileMutation` 提交完整变更路径。 4. **安全防御**：阻断 `newFileName` 中的跨目录穿透字符（`..`、`/`、`\`）。  …… 注：这是前端“记忆”子模块应用的相应后端pr

- **Issue #479** (2026-09-27): **feat: add opt-in Telegram bridge with correlated host events**
  *Symptoms*: 为 VCP Agent 增加默认关闭的 Telegram 私聊入口，复用现有 Agent、模型、工具和管理员认证链路。授权用户可以切换 Agent、收发媒体、查看流式回复、批准关联工具请求，并收到通用异步任务结果。  此 PR 同时补齐 Host Integration v1：在流式/非流式工具执行中传递原始请求关联 ID，提供最小化的进程内审批与异步事件，并在回调结果持久化后通知传输插件。保留现有 WebSocket 通知、审批变更预览和管理员认证。未集成这些接口的旧主机无法仅复制插件目录使用。  ## 范围  - TelegramBridge 插件、SQLite 迁移、测试、安装/恢复文档和可重复打包脚本；通用附件通过受限路径或公共 HTTPS 解析。 - 请求与投递持久化、取消、重启恢复、未知效果隔离、图片历史和相册合并。 - 不包含任何生成服务专用适配，也不增加生成服务依赖。 - 配置模板只含空凭据和通用 Agent 示例；不提交本地配置、聊天数据、媒体、日志、数据库、私人 Agent 文件或本地验收记录。  ## 验证  - 本地 Windows / Node 22.21.1：721 项，711 PASS、10 SKIP、0 FAIL。 - 隔离 Linux Alpine / Node 20.20.2：720 项，715 PASS、5 SKIP、0 FAIL。镜像未安装 Git，忽略规则单项在 Windows 验证。 - 主机接口回归：24 PASS；隔离的真实 PluginManager 审批/管理员门禁集成：2 PASS。 - 94 个 JavaScript 文件语法检查通过；密钥扫描通过；插件 npm audit 为 0 漏洞；发布包确定性和排除运行数据的测试通过。 - [GitHub Actions](https://github.com/SeOgi-Tsu/VCPToolBox/actions/runs/35487115525) 在当前提交 a127c427 上全部通过：Ubuntu Node 20/22、Windows Node 22 和主机接口四个任务。初次云端运行发现的 Windows 临时目录短路径夹具差异及主机 SQLite 原生构建遗漏已修复，未放宽生产路径校验。  ## Draft 状态与使用边界  版本为 0.1.0-beta.1，默认 TELEGRAM_MODE=disabled。完整媒体暂存依赖 Linux/Docker 的目录句柄与 /proc/self/fd；原生 Windows 会明确拒绝部分媒体路径。自动化测试使用模拟网络及独立数据库，不宣称新安装已通过真实 Bot 全场景验收。维护者可按 Plugin/TelegramBridge/docs/ACCEPTANCE.md 完成目标环境验收后再转正式评审。 
  **Post-Mortem & Fix Analysis**:
  > 感觉影响的面有点大。不如隔壁钉钉和飞书的桥接器做的数组复制深隔离这种设计好。

- **Issue #478** (2026-09-19): **feat(jev): 折叠/剪枝/river 三处加 Jev 语义二次判断（级联，默认关闭）**
  *Symptoms*: ## 背景  仓库里有三处"该不该保留/展开这段内容"的判断，目前都只靠 embedding 余弦或位置规则：  | 位置 | 现状 | 问题 | | :-- | :-- | :-- | | 工具箱折叠 `messageProcessor.resolveDynamicFoldProtocol` | `sim >= 区块阈值` | 90 个阈值挤在 0.43~0.70（中位 0.53），与具体 embedding 模型的中文相似度分布强绑定；阈值一旦低于该模型的噪声地板就会"全部展开"，换模型要整体重标 | | 上下文剪枝 `contextManager.pruneMessages` | 保 system / `[系统提示:]` / 最后两条，然后**从索引 0 往后删**到预算内 | 纯位置规则、零语义：删的是"最老的"，不是"最没用的"。一条很早但定义了整个任务的消息，和一条昨天的闲聊同等对待 | | river `semantic:N` `vcpLoop/toolExecutor` | 工具参数拼 query → 逐条向量化 → 余弦取 Top-N | 余弦量的是词汇/语义邻近，结构上分不清"词汇重合"和"真的用得上" |  ## 做法  复用已有的 `modules/jevClient.js`（`RAGDiaryPlugin` 高级 Rerank 已在用），在这三处**后面**各加一道 TypeSafe Jev 判断，形成级联：**embedding / 位置规则负责"别漏"，Jev 负责"别滥"**。  不是替换，是加一道闸。原有的召回逻辑一行没动。  ## 安全边界  - **只删不加、只重排不扩充**：折叠只会从已展开的候选里移除；剪枝只改删除顺序；river 最终条数仍是 N。不会因为 Jev 而给模型多塞任何东西。 - **失败即回退原行为**：未配置 `JEV_API_KEY`、超时、网络失败、响应异常，一律回到原结果（折叠→embedding 结果，剪枝→位置规则，river→embedding 的 Top-N，再失败才是原有的 `last:N`）。 - **异常不冒泡**：三处各自带 try/catch。折叠那处若冒泡会被外层 catch 整个退化成 `fallbackBlock`，river 那处若冒泡会连带退回 `last:N`——都是实际会踩的坑。 - **不变量留在代码里**：剪枝的 system / `[系统提示:]` / 最后两条永不可删，预算循环也在代码里，模型只提供排序依据。没打到分的消息按"保留"处理。 - **三个开关默认 `false`**，不开启则行为与现在完全一致。  ## 为什么是"一次请求问全部候选"  官方文档与本机实测一致表明**题数不增加延迟**：1 题 331ms / 31 题 329ms / 70 题 372ms；官方 `parallel_questions` cookbook 的实测是一次调用比逐题便宜 12.2 倍、快 10.0 倍且答案完全相同（5 次重复下 std dev 为 0）。  折叠另按 `sha256(userContent)` 记忆化，同一轮里多个工具箱占位符共用同一次请求（否则 7 个占位符就是 7 次串行往返）。  `state` 只放判断必需的参照系 + 候选正文并各自截断，规避官方指出的 context rot。  ## 实测  - **29 项离线单测**（`tests/jev*.test.js`，stub 客户端、不发网络）：覆盖默认关闭、门槛过滤、低意

- **Issue #477** (2026-09-19): **fix: Responses 格式丢失系统提示词和思维链**
  *Symptoms*: Responses 格式丢失系统提示词，原生 reasoning 字段及工具续接。

- **Issue #476** (2026-09-18): **fix: Responses 格式对 function call 的支持**
  *Symptoms*: 我自己修复了一下，经测试问题解决了。 狮佬看看，是否有问题。VCP 系统太复杂了，之前好几个提交都是破坏性的，这次得还你把下关。

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

### Incident Patch 1: `27c39bbc` (2026-09-30)
**Commit Message**: fix

**File**: `Plugin/DMXDoubaoGen/DoubaoGen.js` (modified, +55/-2)
```diff
@@ -192,6 +192,21 @@ async function signRequest() {
     };
 }
 
+function isPrivateOrLocalHost(hostname) {
+    if (!hostname) return false;
+    const h = hostname.toLowerCase();
+    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
+    const parts = h.split('.').map(Number);
+    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
+        if (parts[0] === 10) return true;
+        if (parts[0] === 127) return true;
+        if (parts[0] === 192 && parts[1] === 168) return true;
+        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
+        if (parts[0] === 169 && parts[1] === 254) return true;
+    }
+    return false;
+}
+
 // --- Helper function to process the 'image' parameter ---
 async function getImageData(imageUrl, imageBase64) {
     // Priority to imageBase64 if provided (on retry from file fetch)
@@ -210,9 +225,47 @@ async function getImageData(imageUrl, imageBase64) {
         return imageUrl;
     }
 
-    // Handle public https URL
+    // Handle HTTP / HTTPS URL
     if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
-        return imageUrl;
+        try {
+            const parsedUrl = new URL(imageUrl);
+            const isLocal = isPrivateOrLocalHost(parsedUrl.hostname);
+
+            // 1. 本地图床直接读盘加速 (/pw=.../images/... 或 /images/...)
+            const imageMatch = parsedUrl.pathname.match(/(?:\/pw=[^/]+)?\/images\/(.+)$/);
+            if (imageMatch && imageMatch[1] && PROJECT_BASE_PATH) {
+                const subPath = decodeURIComponent(imageMatch[1]);
+                const localDiskPath = path.join(PROJECT_BASE_PATH, 'image', subPath);
+                try {
+                    const stats = await fs.stat(localDiskPath);
+                    if (stats.isFile()) {
+                        const buffer = await fs.readFile(localDiskPath);
+                        const mimeType = mime.lookup(localDiskPath) || 'image/png';
+                        return `data:${mimeType};base64,${buffer.toString('base64')}`;
+                    }
+                } catch {
+                    // 本地未命中，继续网络下载
+                }
+            }
+
+            // 2. 局域网地址：必须本地下载转 Base64（云端无法访问私有网段）
+            if (isLocal) {
+                const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
+                const mimeType = resp.headers['content-type']?.split(';')[0]?.trim() || 'image/png';
+                return `data:${mimeType};base64,${Buffer.from(resp.data).toString('base64')}`;
+            }
+
+            // 3. 公网地址：尝试预先下载转 Base64，失败则安全回退原 URL
+            try {
+                const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
+                const mimeType = resp.headers['content-type']?.split(';')[0]?.trim() || 'image/png';
+                return `data:${mimeType};base64,${Buffer.from(resp.data).toString('base64')}`;
+            } catch {
+                return imageUrl;
+            }
+        } catch {
+            return imageUrl;
+        }
     }
 
     // Handle local file URL
```

**File**: `Plugin/DoubaoGen/DoubaoGen.js` (modified, +99/-8)
```diff
@@ -223,24 +223,66 @@ function netRequest(options, postData) {
     });
 }
 
-function downloadImage(url) {
+function downloadImage(url, timeoutMs = 30000) {
     return new Promise((resolve, reject) => {
         const fullUrl = url.startsWith('http') ? url : `https:${url}`;
-        const client = fullUrl.startsWith('http://') ? http : https;
-        client.get(fullUrl, (res) => {
-            if (res.statusCode === 301 || res.statusCode === 302) {
+        let client;
+        try {
+            const parsed = new URL(fullUrl);
+            client = parsed.protocol === 'http:' ? http : https;
+        } catch (e) {
+            return reject(new Error(`无效的 URL: ${url}`));
+        }
+
+        const req = client.get(fullUrl, (res) => {
+            if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                 const redirectUrl = res.headers.location;
                 if (!redirectUrl) return reject(new Error('收到重定向但无 Location 头'));
-                return downloadImage(redirectUrl).then(resolve).catch(reject);
+                const nextUrl = new URL(redirectUrl, fullUrl).toString();
+                return downloadImage(nextUrl, timeoutMs).then(resolve).catch(reject);
+            }
+            if (res.statusCode < 200 || res.statusCode >= 300) {
+                return reject(new Error(`HTTP 状态码异常: ${res.statusCode}`));
             }
             const chunks = [];
-            res.on('data', c => chunks.push(c));
+            let totalBytes = 0;
+            const MAX_BYTES = 25 * 1024 * 1024; // 25MB 上限保护
+            res.on('data', c => {
+                totalBytes += c.length;
+                if (totalBytes > MAX_BYTES) {
+                    req.destroy();
+                    reject(new Error('图片体积过大 (超过 25MB)'));
+                    return;
+                }
+                chunks.push(c);
+            });
             res.on('end', () => resolve({ data: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
             res.on('error', reject);
-        }).on('error', reject);
+        });
+
+        req.on('error', reject);
+        req.setTimeout(timeoutMs, () => {
+            req.destroy();
+            reject(new Error(`下载图片超时 (${Math.round(timeoutMs / 1000)}秒)`));
+        });
     });
 }
 
+function isPrivateOrLocalHost(hostname) {
+    if (!hostname) return false;
+    const h = hostname.toLowerCase();
+    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
+    const parts = h.split('.').map(Number);
+    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
+        if (parts[0] === 10) return true;
+        if (parts[0] === 127) return true;
+        if (parts[0] === 192 && parts[1] === 168) return true;
+        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
+        if (parts[0] === 169 && parts[1] === 254) return true;
+    }
+    return false;
+}
+
 // ============================================================
 //  API Call Dispatcher & Fallback
 // ============================================================
@@ -504,7 +546,56 @@ async function processSingleImage(item, paramName = 'image') {
     const image = item.image;
     if (!image || typeof image !== 'string') return image;
     if (image.startsWith('data:image')) return image;
-    if (image.startsWith('http://') || image.startsWith('https://')) return image;
+
+    // 处理 HTTP / HTTPS 链接 (支持局域网直接读盘/本地代理下载转 Base64)
+    if (image.startsWith('http://') || image.startsWith('https://')) {
+        try {
+            const parsedUrl = new URL(image);
+            const isLocal = isPrivateOrLocalHost(parsedUrl.hostname);
+
+            // 1. 本地图床直读优化 (如果匹配 /pw=.../images/... 或 /images/...)
+            const imageMatch = parsedUrl.pathname.match(/(?:\/pw=[^/]+)?\/images\/(.+)$/);
+            if (imageMatch && imageMatch[1]) {
+                const subPath = decodeURIC
```

---

### Incident Patch 2: `f66f2ede` (2026-09-29)
**Commit Message**: fix

**File**: `docs/vcp-whitepaper.md` (modified, +20/-5)
```diff
@@ -1,7 +1,7 @@
 ---
 title: VCP 全景技术白皮书 V5
 summary: 全面介绍 VCP 全栈运行时、Jev 决策与自然语言调用管网、Agent 工业级软件工程体系、前端应用群、共享 IPC 管网、Loom 与共笔文坊协作系统的工作原理和系统交互，是理解迈向 VCP 2.0 正式版全景生态的重要读物。
-updatedAt: 2026-09-29
+updatedAt: 2026-09-30
 category: guide
 ---
 
@@ -203,10 +203,12 @@ OneRing 系统为每个 Agent 维护唯一的事实时间线——每条消息
 │              VCP 中间层服务器(VCPToolBox 2.0)                 │
 │  ───────────────────────────────────────────────────────────  │
 │  协议层:  JEV-TOOL-call 编译器 · JevCallBridgeEXP · 原生ToolCall│
+│          jevcall/vcpcall 管线对齐 · 参数正则白名单安检系统       │
 │          安检双轨隔离机制 · 任意数组兼容 · SystemPromptHacker  │
 │  决策层:  JevRuntime 公共服务 (扩散架构低延迟概率决策, 255/300ms)│
 │          JEVRerank (记忆/提示词/上下文折叠/群聊发言动态裁决)    │
 │  工程层:  VCPCode 核心工程移植 · VCPProjectForge 协同模组      │
+│          MoonASTSearch C/Rust 双擎 · RustCodeSearch AST 强化   │
 │          脉络署名责任制 · 代际分支仲裁 · 操作级虚拟快照树      │
 │  上下文层:引力场 · 折叠 V2 · OneRing · OneRingMemo · 占位符精控│
 │  工具层:  300+ 插件 · 6 大插件协议 · 声明式 Jev 接入规范        │
@@ -415,7 +417,7 @@ JEV:「始」请使用 {联网搜索}，从[美国土豆产能]和[美国当前
    - **`生活服务`**：即时咨询、资讯聚合与本地生活场景调度。
    第三方插件使用严格的 `ToolName` 作为导航锚点，支持自由绑定上述官方划分的能力大类，零门槛享受官方 JevCallEXPService 的解析红利。
 
-### 4.4 工业级安检双轨隔离机制：高危精准操作的绝对防御
+### 4.4 工业级安检双轨隔离机制：高危精准操作的绝对防御与参数正则白名单系统
 
 在全面拥抱自然语言“言出法随”的柔性便利时，VCP 展现了对系统级生产力与数据主权的极致克制——确立了**自然语言柔性调用与高精度工业操作的双轨物理安全隔离哲学**：
 
@@ -442,6 +444,8 @@ Jev-Tool-Call 柔性自然语言调用         【安检双轨层拦截检验】
 1. **高危破坏性操作安检自动拦截**：凡是涉及**底层命令行执行（CLI / Shell / PowerShell）、精准代码重构（ProjectForge）以及文件系统破坏性/行级编辑（FileOperator / ServerFileOperator）**的 JevCall 请求，将被系统安检层判定为越界风险并直接**自动拒绝**。
 2. **强制收敛至原生严格 VCP ToolCall 协议**：关乎系统根基、代码生命与文件一致性的高精度严肃操作，必须强制走严格、显式且具备防格式坍塌机制的 **VCP 原生 ToolCall 格式**（以 `<<<[TOOL_REQUEST]>>>`、`maid` 署名及严格字段包裹为物理准则）。
 3. **确定性与灵活性的黄金解耦**：日常生活、交互娱乐、信息检索与智能硬件控制走轻盈的自然语言调用；底层代码工程与系统级运维走确定、可审计、抗歧义的原生协议，彻底杜绝模糊语义导致的“误改误删”与不可逆灾难。
+4. **工具调用审核新增白名单系统与内部参数正则级细粒度控制**：在黑名单拦截防御的基础上，系统引入**白名单系统与黑名单交叉校验**。审核系统的颗粒度进一步细化至**单一指令的内部参数正则级**——不仅控制 Agent “能否调用某个指令”，更严密限制指令参数必须满足指定的正则模式、路径白名单或格式规范，从根本上阻断提示词注入注入与越界参数滥用。
+5. **jevcall 与常规 vcpcall 管线深度对齐**：为了消除双协议运行带来的认知与维护分歧，系统进一步统一了 Jev 自然语言调用与原生 VCPCall 调用的底层执行管线。两端在参数解析、中间状态通知、错误规范化、异步占位符追踪以及 VCPToolRecord 审计落盘上实现**能力和实现几乎完整对齐**，大幅降低开发成本与运行时状态分歧。
 
 ### 4.5 串语法与并发
 
@@ -718,7 +722,7 @@ VSearch（自研轻量搜索引擎）、VSearch+（聚合多种模型的联网
 VCPFetch、VCPBilibiliFetch(检索/字幕/弹幕/评论/截图/上传/Google FileCacheAPI 预向量阅读)、VCPYoutubeFetch、ChromeBridge V3(脚本管理/Cookie/多层级安全解析器/300+ CDP 指令)、VCPDownload、VCPCloudDrive……
 
 **通讯与控制**
-VCPAgentAssistant(混合插件,4 种类型同时声明)、VCPAgentMessage、VCPFlowLock、VCPPluginCreator、VCPMiJiaManager、VCPMail、VCPSuperMail、VCPPowerShell、VCPCodeSearcher、VCPFileOperate(镜像/纠错/回退/批处理/Diff fuzz 检查)、VCPEverything、VCPWorkSpace、ProjectAnalyst、VCPAuthNet、VCPSom(纯数学窗口语义操控)……
+VCPAgentAssistant(混合插件,4 种类型同时声明)、VCPAgentMessage、VCPFlowLock、VCPPluginCreator、VCPMiJiaManager、VCPMail、VCPSuperMail、VCPPowerShell、RustCodeSearch（全面重构，AST 解析与复合正则增强，渐进函数披露，智能行号追踪，保留起止行映射并生成引用依赖报告）、VCPCodeSearcher、VCPFileOperate(镜像/纠错/回退/批处理/Diff fuzz 检查)、VCPEverything、VCPWorkSpace、ProjectAnalyst、VCPAuthNet、VCPSom(纯数学窗口语义操控)……
 
 **数学与科学**
 高级科学计算器、函数图形渲染、3D 模型渲染、NCBI/KEGG 等 6 个生信模组(数百个专业指令,调研指令覆盖蛋白质折叠/RNA 序列/化学标记/药物分子等)
@@ -1636,6 +1640,8 @@ VChat 在迈向 2.0 的进程中完成了底层与桌面宿主的大版本换代
 3. **统一全局磨砂渲染管线**：废弃过去各浮窗、气泡独立执行 CSS `backdrop-filter` 导致的 GPU 重复多重采样与高功耗开销，统一在视图层执行单次全局 Blur 计算并生成共享模糊纹理缓冲区，各组件依据视口坐标按需投影分配，消除局部重绘抖动。
 4. **滚动器与非整数缩放深度修正**：针对 Windows 系统非 100% 缩放（如 125%、150%）下的亚像素修正，彻底收敛滚动器与尺寸计算，杜绝非整数 DPI 环境下长消息界面的偶发全局重排。
 5. **系统级独立语音输入引擎**：新增基于纯 Rust 构建的独立语音引擎，彻底摒弃外部反代。直接通过 **Windows 原生 WinAPI 通道** 或 **本地输入法 API 通道**（即插即用豆包/讯飞等输入法）捕获麦克风输入，让语音指令可脱离主窗口在游戏、创作软件中直接驱动 Agent；配合 **渲染态流式音频朗读（Mimo 2.5 / 本地 SoVITS）**，实现即生成即发音的无停顿语音交互闭环。
+6. **Preload 重构为子应用分区的渐进声明式校验**：彻底打破过去前端 Preload 脚本在单体进程中的庞杂硬编码校验，将 Preload 重构为**子应用分区的渐进声明式校验**。通过按子应用独立声明权限接口、生命周期与 IPC 契约，为 Agent 敏捷、低摩擦地自动化开发和生成海量 VChat 子应用扫清了架构障碍。
+7. **工作区感知的编辑器**：编辑器核心深度融入工作区感知机制，支持工程目录智能过滤、按语义深度渐进展开代码层级，并引入精细的 Token 预算管理机制，在保障 Agent 获取高价值代码上下文的同时，严格抑制上下文膨胀。
 
 ### 13.2 VCPMessageRenderer V4：流式竞态根治与极端内容防御
 
@@ -2428,7 +2434,12 @@ VCP 前端应用群的联动不是预先写死的“
```

---

### Incident Patch 3: `324189c7` (2026-09-29)
**Commit Message**: fix

**File**: `Plugin/FileOperator/plugin-manifest.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
   "version": "1.0.1",
   "description": "VCP服务器专用的一个强大的文件系统操作插件，允许AI对受限目录进行读、写、列出、移动、复制、删除等多种文件和目录操作。特别增强了文件读取能力，可自动提取PDF、Word(.docx)和表格(.xlsx, .csv)文件的纯文本内容。",
   "author": "VCPToolBox",
-  "license": "MIT",
+  "license": "CC BY-NC-SA 4.0",
   "entryPoint": {
     "command": "node FileOperator.js",
     "timeout": 300000
```

**File**: `Plugin/VCPEverything/plugin-manifest.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
   "version": "1.1.0",
   "description": "通过调用 Everything 命令行工具 (es.exe) 在本地计算机上实现毫秒级文件搜索。",
   "author": "VCPToolBox Community",
-  "license": "MIT",
+  "license": "CC BY-NC-SA 4.0",
   "entryPoint": {
     "command": "node local-search-controller.js"
   },
```

**File**: `diary-tag-processor-package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "rag"
   ],
   "author": "VCP Team",
-  "license": "MIT",
+  "license": "CC BY-NC-SA 4.0",
   "dependencies": {
     "dotenv": "^16.4.5",
     "node-fetch": "^3.3.2"
```

---

### Incident Patch 4: `721f2271` (2026-09-29)
**Commit Message**: fix

**File**: `modules/vcpLoop/toolCallParser.js` (modified, +15/-1)
```diff
@@ -156,7 +156,8 @@ class ToolCallParser {
       } else if (field.key === 'vref') {
         vref = trimmedValue;
       } else {
-        args[field.key] = trimmedValue;
+        // 工具参数：保留前导缩进（仅剥离首行紧贴标记的单次换行，以及末尾的单次换行/空白）
+        args[field.key] = this._normalizeFieldValue(field.value);
       }
     }
 
@@ -281,6 +282,19 @@ class ToolCallParser {
     return fields;
   }
 
+  /**
+   * 规范化参数字段值：
+   * 保护首行与各行的代码/文本前导缩进（禁止直接使用全量 trim()）。
+   * 1. 若首字符紧跟换行（\r\n 或 \n），剥离该换行符，但保留第一行代码的缩进空格。
+   * 2. 剥离末尾的换行及尾随空白。
+   * @param {string} value
+   * @returns {string}
+   */
+  static _normalizeFieldValue(value) {
+    if (typeof value !== 'string') return '';
+    return value.replace(/^(?:\r?\n)/, '').replace(/(?:\r?\n)?[ \t]*$/, '');
+  }
+
   static _restoreEscapedLiterals(content) {
     let restored = content;
     for (const [escapedValue, literalValue] of Object.entries(this.ESCAPED_LITERAL_MAP)) {
```

**File**: `tests/jevToolCallExp.test.js` (modified, +20/-0)
```diff
@@ -668,4 +668,24 @@ test('隐式能力推断保持保守，弱信号和不完整组合必须拒绝',
         planner.plan('请生成【一只猫】'),
         /缺少能力目录/
     );
+});
+
+test('ToolCallParser 提取参数时保留首行缩进与多行代码缩进', () => {
+    const rawCall = `
+<<<[TOOL_REQUEST]>>>
+tool_name:「始」FileEditor「末」
+content:「始」
+    def hello_world():
+        print("Hello")
+「末」
+inline_code:「始」  const a = 1;「末」
+<<<[END_TOOL_REQUEST]>>>
+    `;
+
+    const [call] = ToolCallParser.parse(rawCall);
+    assert.equal(call.name, 'FileEditor');
+    // 首行前导4空格必须被完整保留，末尾单独的换行被清理
+    assert.equal(call.args.content, '    def hello_world():\n        print("Hello")');
+    // 单行参数的前导2空格也必须完整保留
+    assert.equal(call.args.inline_code, '  const a = 1;');
 });
\ No newline at end of file
```

---

### Incident Patch 5: `7f386719` (2026-09-28)
**Commit Message**: fix顶栏行为

**File**: `AdminPanel-Vue/dist/assets/css/ForumAssistantConfig-CSHVUp_k.css` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-.forum-assistant-view[data-v-0d89bf20]{gap:var(--space-4);flex-direction:column;display:flex}.forum-assistant-view>.description[data-v-0d89bf20]{margin-bottom:0}.forum-assistant-view>.description[data-v-0d89bf20]+*{margin-top:0}.toolbar-card[data-v-0d89bf20],.status-card[data-v-0d89bf20],.composer-card[data-v-0d89bf20],.history-card[data-v-0d89bf20]{padding:var(--space-4)}.toolbar-row[data-v-0d89bf20],.composer-head[data-v-0d89bf20],.composer-controls[data-v-0d89bf20],.status-metrics[data-v-0d89bf20],.task-card-header[data-v-0d89bf20],.task-card-actions[data-v-0d89bf20],.runtime-state-row[data-v-0d89bf20],.history-item-top[data-v-0d89bf20],.history-meta[data-v-0d89bf20]{gap:var(--space-3);display:flex}.toolbar-row[data-v-0d89bf20],.composer-head[data-v-0d89bf20],.task-card-header[data-v-0d89bf20],.history-item-top[data-v-0d89bf20]{justify-content:space-between;align-items:center}.composer-controls[data-v-0d89bf20],.task-card-actions[data-v-0d89bf20]{flex-wrap:wrap}.compact-field[data-v-0d89bf20]{min-width:180px}.status-grid[data-v-0d89bf20]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(280px,1fr));display:grid}.status-metrics[data-v-0d89bf20]{margin-top:var(--space-3);flex-wrap:wrap}.metric[data-v-0d89bf20]{gap:var(--space-1);flex-direction:column;min-width:120px;display:flex}.metric-label[data-v-0d89bf20],.hint-text[data-v-0d89bf20]{color:var(--secondary-text)}.card-title[data-v-0d89bf20]{margin:0}.task-type-list[data-v-0d89bf20],.task-list[data-v-0d89bf20],.history-list[data-v-0d89bf20]{gap:var(--space-3);flex-direction:column;display:flex}.task-type-item[data-v-0d89bf20]{padding:var(--space-3);border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent)}.task-type-item strong[data-v-0d89bf20]{margin-bottom:var(--space-1);display:block}.task-type-item p[data-v-0d89bf20],.history-item p[data-v-0d89bf20]{color:var(--secondary-text);margin:0}.composer-head[data-v-0d89bf20]{margin-bottom:var(--space-4)}.composer-controls[data-v-0d89bf20]{flex:1;justify-content:flex-end;align-items:flex-end}.quick-create-actions[data-v-0d89bf20]{align-items:flex-end;display:flex}.schedule-field[data-v-0d89bf20]{grid-column:1/-1}.schedule-inline-row[data-v-0d89bf20]{align-items:center;gap:var(--space-3);flex-wrap:wrap;display:flex}.schedule-mode-select[data-v-0d89bf20]{flex:0 0 200px;max-width:230px}.schedule-mode-input[data-v-0d89bf20]{flex:320px;min-width:220px}.schedule-manual-hint[data-v-0d89bf20]{flex:260px;margin:0}.empty-state[data-v-0d89bf20],.history-empty[data-v-0d89bf20]{padding:var(--space-6) var(--space-5);border:1px dashed var(--border-color);border-radius:var(--radius-xl);text-align:center;color:var(--secondary-text)}.empty-state h3[data-v-0d89bf20]{margin:var(--space-3) 0 var(--space-2);color:var(--primary-text)}.task-card[data-v-0d89bf20]{padding:var(--space-4);border-radius:var(--radius-lg);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent);gap:var(--space-4);flex-direction:column;display:flex}.task-card-header h4[data-v-0d89bf20]{margin:0 0 var(--space-1)}.task-card-header p[data-v-0d89bf20]{color:var(--secondary-text);margin:0}.task-grid[data-v-0d89bf20]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(260px,1fr));display:grid}.full-field[data-v-0d89bf20]{width:100%}.full-field[data-v-0d89bf20] .ui-textarea{min-height:168px;max-height:none}.section-switch[data-v-0d89bf20]{margin-top:-4px}.placeholder-row[data-v-0d89bf20]{gap:var(--space-2);flex-wrap:wrap;align-items:center;display:flex}.placeholder-label[data-v-0d89bf20]{color:var(--secondary-text);font-weight:600}.placeholder-chip[data-v-0d89bf20]{font-family:monospace}.placeholder-empty[data-v-0d89bf20]{color:var(--secondary-text)}.placeholder-hint[data-v-0d89bf20]{margin-top:var(--space-1);color:var(--secondary-text);font-size:var
```

**File**: `AdminPanel-Vue/dist/assets/css/ForumAssistantConfig-DoGehtmU.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.forum-assistant-view[data-v-2f7f110f]{gap:var(--space-4);flex-direction:column;display:flex}.forum-assistant-view>.description[data-v-2f7f110f]{margin-bottom:0}.forum-assistant-view>.description[data-v-2f7f110f]+*{margin-top:0}.toolbar-card[data-v-2f7f110f],.status-card[data-v-2f7f110f],.composer-card[data-v-2f7f110f],.history-card[data-v-2f7f110f]{padding:var(--space-4)}.toolbar-row[data-v-2f7f110f],.composer-head[data-v-2f7f110f],.composer-controls[data-v-2f7f110f],.status-metrics[data-v-2f7f110f],.task-card-header[data-v-2f7f110f],.task-card-actions[data-v-2f7f110f],.runtime-state-row[data-v-2f7f110f],.history-item-top[data-v-2f7f110f],.history-meta[data-v-2f7f110f]{gap:var(--space-3);display:flex}.toolbar-row[data-v-2f7f110f],.composer-head[data-v-2f7f110f],.task-card-header[data-v-2f7f110f],.history-item-top[data-v-2f7f110f]{justify-content:space-between;align-items:center}.composer-controls[data-v-2f7f110f],.task-card-actions[data-v-2f7f110f]{flex-wrap:wrap}.compact-field[data-v-2f7f110f]{min-width:180px}.status-grid[data-v-2f7f110f]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(280px,1fr));display:grid}.status-metrics[data-v-2f7f110f]{margin-top:var(--space-3);flex-wrap:wrap}.metric[data-v-2f7f110f]{gap:var(--space-1);flex-direction:column;min-width:120px;display:flex}.metric-label[data-v-2f7f110f],.hint-text[data-v-2f7f110f]{color:var(--secondary-text)}.card-title[data-v-2f7f110f]{margin:0}.task-type-list[data-v-2f7f110f],.task-list[data-v-2f7f110f],.history-list[data-v-2f7f110f]{gap:var(--space-3);flex-direction:column;display:flex}.task-type-item[data-v-2f7f110f]{padding:var(--space-3);border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent)}.task-type-item strong[data-v-2f7f110f]{margin-bottom:var(--space-1);display:block}.task-type-item p[data-v-2f7f110f],.history-item p[data-v-2f7f110f]{color:var(--secondary-text);margin:0}.composer-head[data-v-2f7f110f]{margin-bottom:var(--space-4)}.composer-controls[data-v-2f7f110f]{flex:1;justify-content:flex-end;align-items:flex-end}.quick-create-actions[data-v-2f7f110f]{align-items:flex-end;display:flex}.schedule-field[data-v-2f7f110f]{grid-column:1/-1}.schedule-inline-row[data-v-2f7f110f]{align-items:center;gap:var(--space-3);flex-wrap:wrap;display:flex}.schedule-mode-select[data-v-2f7f110f]{flex:0 0 200px;max-width:230px}.schedule-mode-input[data-v-2f7f110f]{flex:320px;min-width:220px}.schedule-manual-hint[data-v-2f7f110f]{flex:260px;margin:0}.empty-state[data-v-2f7f110f],.history-empty[data-v-2f7f110f]{padding:var(--space-6) var(--space-5);border:1px dashed var(--border-color);border-radius:var(--radius-xl);text-align:center;color:var(--secondary-text)}.empty-state h3[data-v-2f7f110f]{margin:var(--space-3) 0 var(--space-2);color:var(--primary-text)}.task-card[data-v-2f7f110f]{padding:var(--space-4);border-radius:var(--radius-lg);border:1px solid color-mix(in srgb, var(--border-color) 84%, transparent);background:color-mix(in srgb, var(--primary-text) 2%, transparent);gap:var(--space-4);flex-direction:column;display:flex}.task-card-header h4[data-v-2f7f110f]{margin:0 0 var(--space-1)}.task-card-header p[data-v-2f7f110f]{color:var(--secondary-text);margin:0}.task-grid[data-v-2f7f110f]{gap:var(--space-4);grid-template-columns:repeat(auto-fit,minmax(260px,1fr));display:grid}.full-field[data-v-2f7f110f]{width:100%}.full-field[data-v-2f7f110f] .ui-textarea{min-height:168px;max-height:none}.section-switch[data-v-2f7f110f]{margin-top:-4px}.placeholder-row[data-v-2f7f110f]{gap:var(--space-2);flex-wrap:wrap;align-items:center;display:flex}.placeholder-label[data-v-2f7f110f]{color:var(--secondary-text);font-weight:600}.placeholder-chip[data-v-2f7f110f]{font-family:monospace}.placeholder-empty[data-v-2f7f110f]{color:var(--secondary-text)}.placeholder-hint[data-v-2f7f110f]{margin-top:var(--space-1);color:var(--secondary-text);font-size:var
```

**File**: `AdminPanel-Vue/dist/assets/css/VcpForum-B5BUH-kd.css` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-.forum-controls[data-v-e4654b87]{gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;align-items:flex-end;display:flex}.forum-controls[data-v-e4654b87] .ui-field{min-width:min(100%,220px)}.forum-controls[data-v-e4654b87] .ui-field:last-child{flex:280px}.forum-posts-list[data-v-751c5fd9]{flex-direction:column;gap:12px;display:flex}.forum-post-item[data-v-751c5fd9]{background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:var(--radius-sm);cursor:pointer;padding:16px;transition:background .2s;position:relative}.forum-post-item[data-v-751c5fd9]:hover{background:var(--accent-bg)}.forum-post-item.pinned-post[data-v-751c5fd9]{background:var(--primary-color-translucent);border-top:2px solid var(--highlight-text)}.forum-post-header[data-v-751c5fd9]{align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);display:flex}.post-title[data-v-751c5fd9]{font-weight:600;font-size:var(--font-size-emphasis);color:var(--primary-text);-webkit-line-clamp:2;line-clamp:2;text-overflow:ellipsis;word-break:break-word;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.forum-post-meta[data-v-751c5fd9]{font-size:var(--font-size-helper);color:var(--secondary-text);flex-wrap:wrap;gap:16px;display:flex}.pagination-controls[data-v-751c5fd9]{justify-content:flex-start;align-items:center;gap:var(--space-4);margin-top:var(--space-5);padding:var(--space-4) 0;display:flex}.pagination-info[data-v-751c5fd9]{font-size:var(--font-size-body);color:var(--secondary-text);padding:0 12px}@media (width<=480px){.pagination-controls[data-v-751c5fd9]{flex-direction:column;align-items:stretch;gap:10px}.pagination-info[data-v-751c5fd9]{text-align:center;padding:0}}.material-symbols-outlined[data-v-751c5fd9]{vertical-align:middle;font-size:var(--font-size-emphasis)!important}.post-detail-header[data-v-ce0b82d7]{margin-bottom:var(--space-4);flex-direction:column;align-items:flex-start;gap:10px;display:flex}.post-detail-actions[data-v-ce0b82d7]{flex-wrap:wrap;gap:10px;display:flex}.post-title[data-v-ce0b82d7]{font-size:var(--font-size-display);overflow-wrap:anywhere;width:100%;font-weight:600;line-height:1.3}.post-detail-meta[data-v-ce0b82d7]{font-size:var(--font-size-body);color:var(--secondary-text);margin-bottom:var(--space-4);flex-wrap:wrap;gap:16px;display:flex}.post-detail-content[data-v-ce0b82d7]{margin-bottom:var(--space-6);width:100%;max-width:none;line-height:1.6}.post-detail-content[data-v-ce0b82d7] img{max-width:100%;height:auto}.post-replies h3[data-v-ce0b82d7]{margin:0 0 var(--space-4)}.empty-replies[data-v-ce0b82d7]{align-items:flex-start;gap:var(--space-2);margin:0 0 var(--space-4);padding:var(--space-4) 0;color:var(--secondary-text);flex-direction:column;display:flex}.empty-replies-icon[data-v-ce0b82d7]{font-size:var(--font-size-icon-empty);opacity:.3;color:var(--highlight-text)}.empty-replies-hint[data-v-ce0b82d7]{font-size:var(--font-size-helper);opacity:.7}.reply-item[data-v-ce0b82d7]{padding:var(--space-4) 0;border-bottom:1px solid var(--border-color);scroll-margin-top:var(--space-6);background:0 0;margin-bottom:0}.reply-item[data-v-ce0b82d7]:last-child{border-bottom:none}.reply-header[data-v-ce0b82d7]{margin-bottom:var(--space-3);font-size:var(--font-size-body);justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.reply-meta[data-v-ce0b82d7]{flex-wrap:wrap;align-items:center;gap:12px;display:flex}.reply-floor[data-v-ce0b82d7]{color:var(--highlight-text);font-weight:600}.reply-author[data-v-ce0b82d7]{font-weight:600}.reply-time[data-v-ce0b82d7]{color:var(--secondary-text)}.reply-content[data-v-ce0b82d7]{line-height:1.5}.reply-form[data-v-ce0b82d7]{margin-top:var(--space-6);gap:var(--space-3);flex-direction:column;display:flex}.material-symbols-outlined[data-v-ce0b82d7]{vertical-align:middle;font-size:var(--font-size-emphasis)!important}.post-detail-content[data-v-ce0b82d7] p,.reply-content[data-v-ce0b82d7] p{margin:0 0 12px}.post-detail-content[data-v-ce0b82d7] :last-ch
```

**File**: `AdminPanel-Vue/dist/assets/js/ActivityChartCard-CQzUHfQj.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{g as a}from"./Dashboard-D2O0nw7Z.js";export{a as default};
```

**File**: `AdminPanel-Vue/dist/assets/js/ActivityChartCard-DN_707Ub.js` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-import{g as a}from"./Dashboard-C4VHww6O.js";export{a as default};
```

---

### Incident Patch 6: `614f4152` (2026-09-28)
**Commit Message**: fix

**File**: `docs/vcp-whitepaper.md` (modified, +22/-23)
```diff
@@ -322,7 +322,6 @@ OneRing 系统为每个 Agent 维护唯一的事实时间线——每条消息
    ├─ 消息完成三方对账与 Revision Token 世代同步落盘
    └─ VCPToolRecord 写入同步、异步、系统、人类调用的全量工具运行记录
 ```
-```
 
 ### 3.3 分布式星型拓扑
 
@@ -465,7 +464,7 @@ replaceString3:「始」最终内容「末」
 
 AI 也可以发出多个独立的 TOOL_REQUEST 块,系统会并发执行。
 
-### 4.3 全局元指令
+### 4.6 全局元指令
 
 适用于所有工具的全局控制指令:
 
@@ -482,7 +481,7 @@ AI 也可以发出多个独立的 TOOL_REQUEST 块,系统会并发执行。
 
 `river` 和 `vref` 让工具不再是"无状态执行者"。比如 Agent 间通讯(AgentAssistant)可以传递整个对话上下文给目标 Agent,让对方根据完整语境而非孤立请求作出回应。
 
-### 4.4 上下文异步管理:五类 user 数组
+### 4.7 上下文异步管理:五类 user 数组
 
 这是 VCP 上下文工程的核心,也是抑制工具幻觉的关键。
 
@@ -508,7 +507,7 @@ AI 也可以发出多个独立的 TOOL_REQUEST 块,系统会并发执行。
 
 这些细碎的数组控制构成了 VCP 上下文工程的核心层。它让 VCP 可以在同一个 AI 视野里同时维护**聊天、工具结果、异步任务、通知栏、状态机、时间戳、群聊身份、多 Agent 事实历史**这些异质信息,而不把它们混成一锅粥。
 
-### 4.5 工具返回的统一格式
+### 4.8 工具返回的统一格式
 
 所有 VCP 工具的返回结果统一转换为**标准 OpenAI 格式的多模态数组**,使用 Markdown 呈现。
 
@@ -1817,7 +1816,7 @@ VCP 框架要求所有 div 元素携带 `description` 字段:
 - 根据对话情绪动态调整界面色温
 - 双向情绪感知:用户情绪 → 界面色彩 / AI 情绪 → 输出样式
 
-### 13.5 专业级音频底层架构
+### 13.6 专业级音频底层架构
 
 音频引擎不只调用系统播放接口，而是尝试直接管理更底层的音频处理与输出链路：
 
@@ -1844,7 +1843,7 @@ VCP 框架要求所有 div 元素携带 `description` 字段:
 - 引擎以网播形式独立化,支持分布式多设备作为 WebDAV 音源
 - 后端播放器的纯遥控,前端是语义级音乐搜索
 
-### 13.6 VCPDesktop:AI 桌面运行时
+### 13.7 VCPDesktop:AI 桌面运行时
 
 VCPDesktop 是 V3 阶段诞生的子系统,真正消除了**AI-UI-APP 三者之间的界限**。它的核心不是“让 AI 生成一个桌面卡片”，而是让桌面对象从创建开始就拥有 Agent 可调用的生命周期、状态、源码和权限接口。
 
@@ -1939,7 +1938,7 @@ Scriptorium 的核心突破，是让 Agent 同时面对同一份文档的三个
 
 这三个层级不是三份互相漂移的副本，而是同一份工程对象的三种投影。Agent 可以知道“文档写了什么”“现在呈现成什么样”“它由哪段源码实现”，也可以把视觉意图追溯到具体语义对象和源码区间，再执行可验证的局部修改。
 
-#### 13.8.1 渲染编辑即真相：一个 Three.js 文档案例
+#### 13.10.1 渲染编辑即真相：一个 Three.js 文档案例
 
 想象一份文档中嵌入了一个已经渲染完成的 Three.js 旋转立方体。立方体表面不是空白贴图，而是包含标题、段落和数据说明等文本内容。
 
@@ -1961,7 +1960,7 @@ Scriptorium 的核心突破，是让 Agent 同时面对同一份文档的三个
 
 > **对人类而言，渲染结果是可以直接编辑的真实工作面；对 Agent 而言，渲染操作必须能够还原为语义对象和真实源码。**
 
-#### 13.8.2 Agent 与人类看到的是同一份作品
+#### 13.10.2 Agent 与人类看到的是同一份作品
 
 在人类完成上述操作后，Agent 侧不会只收到一句“用户修改了立方体”。它可以同时获得：
 
@@ -1974,7 +1973,7 @@ Scriptorium 的核心突破，是让 Agent 同时面对同一份文档的三个
 
 这也是 Scriptorium 与普通富文本编辑器、Markdown 编辑器和“AI + 模板”工具的根本区别：**人类编辑渲染结果，Agent 编辑源码和语义对象，但双方操作的是同一份唯一真源。**
 
-#### 13.8.3 三层状态如何保持一致
+#### 13.10.3 三层状态如何保持一致
 
 Scriptorium 使用源码保持型渲染编辑管线：
 
@@ -2005,7 +2004,7 @@ Scriptorium 使用源码保持型渲染编辑管线：
 
 对可编程组件而言，稳定语义 ID 将源码、渲染节点和运行时生命周期连接起来。一个 Three.js 场景、Canvas 图表或动画组件可以被单独暂停、编辑、恢复和销毁，而不必牵连整份文档。
 
-#### 13.8.4 AI Office 的工程接口
+#### 13.10.4 AI Office 的工程接口
 
 Scriptorium 的 Agent Port 不是 GUI 自动化，而是直接面向文档工程模型的接口。Agent 可以读取文档语义、源码、真实截图、编译诊断、修订状态和运行时状态，也可以执行局部源码编辑、资源管理、页面增删、渲染验证、Diff、PR、审批、merge、回溯和导出。
 
@@ -2455,13 +2454,13 @@ VChat 前端应用群迎来重磅新成员——**ProjectModule（V工程子前
 
 VCP 不只是技术系统,它构建了一个完整的 Agent 数字社会。
 
-### 15.1 VCPAuthNet:跨用户公网联邦
+### 16.1 VCPAuthNet:跨用户公网联邦
 
 允许通过安全授权验证码构建全球不同 VCP 用户的公共局域网,实现 Agent 跨用户服务器通讯和 VCP 论坛互联。
 
 这意味着:你的 Agent 不仅可以和你聊天,还可以和**其他 VCP 用户的 Agent** 通讯、合作、讨论。
 
-### 15.2 VCP 论坛
+### 16.2 VCP 论坛
 
 Agent 社交平台,复用主界面渲染引擎,通过超栈追踪协议让 Agent 轻松在帖子中传递附件和图表。
 
@@ -2470,19 +2469,19 @@ Agent 社交平台,复用主界面渲染引擎,通过超栈追踪协议让 Agent
 - 静态插件"论坛小助手"感知论坛内容,自主回帖
 - 跨用户论坛互联(VCPAuthNet)
 
-### 15.3 VCPTask 任务版
+### 16.3 VCPTask 任务版
 
 Agent 接取任务、完成任务、获得 VCP 积分。
 
 - 静态插件"任务版小助手"感知任务,自主接取
 - 积分体系驱动 Agent 自主行为
 - 复杂任务可由多个 Agent 协作完成
 
-### 15.4 AgentDream 梦系统
+### 16.4 AgentDream 梦系统
 
 详见第八章 8.12。
 
-### 15.5 GameCenter
+### 16.5 GameCenter
 
 Agent 之间可以玩游戏:
 - 华山论剑
@@ -2492,7 +2491,7 @@ Agent 之间可以玩游戏:
 
 游戏不仅是娱乐,也是 Agent 间互动、记忆形成、关系建立的场景。
 
-### 15.6 VCPSuperMail:AI 原生邮件协议
+### 16.6 VCPSuperMail:AI 原生邮件协议
 
 VCPSuperMail 的核心设计指标不是“支持 AI 发邮件”，而是**邮件本身就是 Agent 的原生异步通讯与工作流协议**。收件、白名单、附件、多模态读取、到信唤醒、定时发送、状态查询和任务回执，都直接暴露给 Agent Native Core。
 
@@ -2525,7 +2524,7 @@ V4 阶段已纳入统一前端应用群与 Agent 原生生态的自研系统，
 
 VCPSuperMail 极大提升了 Agent 将工作记录通知用户和异步通讯的能力。它不是"AI 收发邮件",而是 **AI 用邮件作为异步工作流的骨架**。
 
-### 15.7 VCP 官方 Agent 阵容
+### 16.7 VCP 官方 Agent 阵容
 
 VCP 维护了一批官方 Agent,既是产品也是范例:
 
@@ -2545,7 +2544,7 @@ VCP 维护了一批官方 Agent,既是产品也是范例:
 
 VCP 作为 7×24 小时运行的 AI 生命支持系统,容灾和数据安全是生命线。
 
-### 16.1 三位一体容灾
+### 17.1 三位一体容灾
 
 **多网络设备接入降级容灾**:
 - 分布式节点断开时自动注销插件
@@ -2564,7 +2563,7 @@ VCP 作为 7
```

---

### Incident Patch 7: `48c5ce26` (2026-09-28)
**Commit Message**: fix

**File**: `modules/jevToolCallExp.js` (modified, +21/-11)
```diff
@@ -837,12 +837,22 @@ class JevToolCallExp {
      *    “执行【关闭台灯】”这类写法的意图完全在【】里，不能因此落入 JEV 的随机裁决。
      */
     _thirdPartyMatchLayers(parsed) {
-        const withoutAnchors = parsed.raw
+        // 按语义锚点主次排序，返回别名判定器数组；某层有命中即停止，低层不能覆盖高层：
+        // 1. 【】主要目标：子串匹配；
+        // 2. [] 次要约束：仅当整条约束与别名完全相等（标签式，如 [制冷]）才命中，
+        //    [] 中的自由文本（台词、说明）绝不参与子串匹配，只交给 text 参数原样搬运；
+        // 3. 锚点之外的自然语言动作词（如“打开”“查询”）：兜底。
+        const primaryText = normalizeAlias(parsed.primary.join(' '));
+        const constraintTags = new Set(parsed.constraints.map(normalizeAlias).filter(Boolean));
+        const wrapperText = normalizeAlias(parsed.raw
+            .replace(/【[\s\S]*?】/g, ' ')
+            .replace(/\[[\s\S]*?\]/g, ' ')
             .replace(/`[^`]*`/g, ' ')
-            .replace(/\{[^{}]*\}/g, ' ');
+            .replace(/\{[^{}]*\}/g, ' '));
         return [
-            normalizeAlias(withoutAnchors.replace(/【[\s\S]*?】/g, ' ')),
-            normalizeAlias(withoutAnchors)
+            alias => this._textHasAlias(primaryText, alias),
+            alias => constraintTags.has(normalizeAlias(alias)),
+            alias => this._textHasAlias(wrapperText, alias)
         ];
     }
 
@@ -934,8 +944,8 @@ class JevToolCallExp {
         const commands = entry.commands;
         if (commands.length === 1) return commands[0];
 
-        const matched = this._firstLayerHits(matchLayers, text => commands.filter(cmd => (
-            [cmd.commandIdentifier, ...cmd.aliases].some(alias => this._textHasAlias(text, alias))
+        const matched = this._firstLayerHits(matchLayers, hit => commands.filter(cmd => (
+            [cmd.commandIdentifier, ...cmd.aliases].some(alias => hit(alias))
         )));
         if (matched.length === 1) return matched[0];
 
@@ -1010,8 +1020,8 @@ class JevToolCallExp {
                         throw new Error(`参数 ${name} 的取值 "${prefixed}" 不在允许选项中：${keys.join('、')}。`);
                     }
                 } else {
-                    matched = this._firstLayerHits(matchLayers, text => keys.filter(key => (
-                        aliasesOf(key).some(alias => this._textHasAlias(text, alias))
+                    matched = this._firstLayerHits(matchLayers, hit => keys.filter(key => (
+                        aliasesOf(key).some(alias => hit(alias))
                     )));
                 }
                 if (matched.length === 1) {
@@ -1030,9 +1040,9 @@ class JevToolCallExp {
                 // 同一层内否定词优先；锚点层有任意命中时不再看全文层。
                 let falseHit = [];
                 let trueHit = [];
-                for (const text of matchLayers) {
-                    falseHit = param.falseAliases.filter(alias => this._textHasAlias(text, alias));
-                    trueHit = param.trueAliases.filter(alias => this._textHasAlias(text, alias));
+                for (const hit of matchLayers) {
+                    falseHit = param.falseAliases.filter(alias => hit(alias));
+                    trueHit = param.trueAliases.filter(alias => hit(alias));
                     if (falseHit.length > 0 || trueHit.length > 0) break;
                 }
                 if (falseHit.length > 0) {
```

---

### Incident Patch 8: `44fc1e9f` (2026-09-28)
**Commit Message**: fix

**File**: `modules/jevToolCallExp.js` (modified, +40/-17)
```diff
@@ -818,9 +818,9 @@ class JevToolCallExp {
             throw new Error(`工具 "${toolName}" 注册在 {${entry.categoryLabel}}，不能通过 {${label}} 调用。`);
         }
 
-        const decisionText = this._thirdPartyDecisionText(parsed);
-        const command = await this._selectThirdPartyCommand(entry, parsed, decisionText);
-        const args = await this._buildThirdPartyArgs(entry, command, parsed, decisionText);
+        const matchLayers = this._thirdPartyMatchLayers(parsed);
+        const command = await this._selectThirdPartyCommand(entry, parsed, matchLayers);
+        const args = await this._buildThirdPartyArgs(entry, command, parsed, matchLayers);
 
         return [this._buildExpandedCall(entry.toolName, args, inheritedCall, {
             category: parsed.categoryKey,
@@ -830,12 +830,29 @@ class JevToolCallExp {
         })];
     }
 
-    /** 用于确定性匹配的文本：去掉目录、工具名与【】主要负载，只保留动作词和 [] 约束。 */
-    _thirdPartyDecisionText(parsed) {
-        return parsed.raw
-            .replace(/【[\s\S]*?】/g, ' ')
+    /**
+     * 确定性匹配的分层文本（已归一化）：
+     * 1. 锚点层：去掉目录、工具名与【】，只含动作词和 [] 约束，优先级最高；
+     * 2. 全文层：在锚点层无命中时回退，包含【】内容。
+     *    “执行【关闭台灯】”这类写法的意图完全在【】里，不能因此落入 JEV 的随机裁决。
+     */
+    _thirdPartyMatchLayers(parsed) {
+        const withoutAnchors = parsed.raw
             .replace(/`[^`]*`/g, ' ')
             .replace(/\{[^{}]*\}/g, ' ');
+        return [
+            normalizeAlias(withoutAnchors.replace(/【[\s\S]*?】/g, ' ')),
+            normalizeAlias(withoutAnchors)
+        ];
+    }
+
+    /** 按层依次尝试，返回第一层的非空命中结果。 */
+    _firstLayerHits(layers, collect) {
+        for (const text of layers) {
+            const hits = collect(text);
+            if (hits.length > 0) return hits;
+        }
+        return [];
     }
 
     _textHasAlias(normalizedText, alias) {
@@ -913,14 +930,13 @@ class JevToolCallExp {
         return null;
     }
 
-    async _selectThirdPartyCommand(entry, parsed, decisionText) {
+    async _selectThirdPartyCommand(entry, parsed, matchLayers) {
         const commands = entry.commands;
         if (commands.length === 1) return commands[0];
 
-        const normalized = normalizeAlias(decisionText);
-        const matched = commands.filter(cmd => (
-            [cmd.commandIdentifier, ...cmd.aliases].some(alias => this._textHasAlias(normalized, alias))
-        ));
+        const matched = this._firstLayerHits(matchLayers, text => commands.filter(cmd => (
+            [cmd.commandIdentifier, ...cmd.aliases].some(alias => this._textHasAlias(text, alias))
+        )));
         if (matched.length === 1) return matched[0];
 
         const candidates = matched.length > 1 ? matched : commands;
@@ -971,13 +987,12 @@ class JevToolCallExp {
         });
     }
 
-    async _buildThirdPartyArgs(entry, command, parsed, decisionText) {
+    async _buildThirdPartyArgs(entry, command, parsed, matchLayers) {
         const args = { ...command.fixedArgs };
         if (command.injectCommand) args.command = command.commandIdentifier;
 
         const constraints = parsed.constraints;
         const consumed = new Set();
-        const normalizedDecision = normalizeAlias(decisionText);
         const pending = [];
         const paramEntries = Object.entries(command.parameters || {});
 
@@ -995,7 +1010,9 @@ class JevToolCallExp {
                         throw new Error(`参数 ${name} 的取值 "${prefixed}" 不在允许选项中：${keys.join('、')}。`);
                     }
                 } else {
-                    matched = keys.filter(key => aliasesOf(key).some(alias => this._textHasAlias(normalizedDecision, alias)));
+                    matched = this._firstLayerHits(matchLayers, text => keys.filter(key => (
+                        aliasesOf(key).some(alias => this._textHasAlias(text, alias))
+                    )));
                 }
                 if (matched.length === 1) {
                     args[name] = matched[0];
@@ -1010,8 +1027,14 @@ class JevToolCallExp {
                 });
             } else if (param.type === 'bool
```

---

### Incident Patch 9: `9fb8ef6a` (2026-09-25)
**Commit Message**: Merge pull request #483 from Oscar-Williams/fix/remove-unused-hnswlib-node

fix(deps): remove unused hnswlib-node dependency

**File**: `Plugin/RAGDiaryPlugin/README.md` (modified, +4/-4)
```diff
@@ -33,12 +33,12 @@
 
 ## 数据库核心功能
 
-VCP的RAG日记系统不仅仅是一个功能强大的信息检索工具，其背后还有一个经过深度优化的、高性能的向量数据库管理器 (`VectorDBManager.js`)。该管理器确保了日记内容的实时同步、高效检索和系统的长期稳定运行。
+VCP 的 RAG 日记系统由 `KnowledgeBaseManager.js` 统一编排 SQLite 权威存储与 Rust 向量索引，负责日记内容的同步、检索和恢复。向量索引使用项目自带的 `rust-vexus-lite`，不依赖额外的 Node 原生 HNSW 模块。
 
-### 1. 高性能的HNSW索引
+### 1. SQLite 与 Rust 派生索引
 
--   **核心技术**：采用业界领先的 `hnswlib-node` 库，基于HNSW（Hierarchical Navigable Small World）算法构建向量索引。
--   **优势**：即使在数百万级别的日记片段中，也能实现毫秒级的近似最近邻搜索，确保了RAG检索的极速响应。
+-   **权威数据**：SQLite (`better-sqlite3`) 保存文件、文本块、标签和索引元数据。
+-   **向量检索**：`rust-vexus-lite` 提供 Vexus/USearch 索引；全局标签索引和按日记本索引可按需加载，并可从 SQLite 基线重建。
 
 ### 2. 智能的增量与全量同步
 
```

**File**: `package-lock.json` (modified, +14/-18)
```diff
@@ -33,7 +33,6 @@
         "fs-extra": "^10.1.0",
         "glob": "^7.2.3",
         "globals": "^14.0.0",
-        "hnswlib-node": "^1.4.2",
         "https-browserify": "^1.0.0",
         "https-proxy-agent": "^7.0.4",
         "ioredis": "^5.6.1",
@@ -4301,6 +4300,20 @@
       "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
       "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="
     },
+    "node_modules/fsevents": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
+      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
+      "hasInstallScript": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
+      }
+    },
     "node_modules/fstream": {
       "version": "1.0.12",
       "resolved": "https://registry.npmjs.org/fstream/-/fstream-1.0.12.tgz",
@@ -4640,17 +4653,6 @@
         "he": "bin/he"
       }
     },
-    "node_modules/hnswlib-node": {
-      "version": "1.4.2",
-      "resolved": "https://registry.npmjs.org/hnswlib-node/-/hnswlib-node-1.4.2.tgz",
-      "integrity": "sha512-76PIzOaNcX8kOpKwlFPl07uelpctqDMzbiC+Qsk2JWNVkzeU/6iXRk4tfE9z3DoK1RCBrOaFXmQ6RFb1BVF9LA==",
-      "hasInstallScript": true,
-      "license": "Apache-2.0",
-      "dependencies": {
-        "bindings": "^1.5.0",
-        "node-addon-api": "^6.0.0"
-      }
-    },
     "node_modules/hookified": {
       "version": "1.13.0",
       "resolved": "https://registry.npmjs.org/hookified/-/hookified-1.13.0.tgz",
@@ -6083,12 +6085,6 @@
         "node": ">=10"
       }
     },
-    "node_modules/node-addon-api": {
-      "version": "6.1.0",
-      "resolved": "https://registry.npmjs.org/node-addon-api/-/node-addon-api-6.1.0.tgz",
-      "integrity": "sha512-+eawOlIgy680F0kBzPUNFhMZGtJ1YmqM6l4+Crf4IkImjYrO/mqPwRMh352g23uIaQKFItcQ64I7KMaJxHgAVA==",
-      "license": "MIT"
-    },
     "node_modules/node-cache": {
       "version": "5.1.2",
       "resolved": "https://registry.npmjs.org/node-cache/-/node-cache-5.1.2.tgz",
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@
     "fs-extra": "^10.1.0",
     "glob": "^7.2.3",
     "globals": "^14.0.0",
-    "hnswlib-node": "^1.4.2",
     "https-browserify": "^1.0.0",
     "https-proxy-agent": "^7.0.4",
     "ioredis": "^5.6.1",
```

---

### Incident Patch 10: `427528f5` (2026-09-25)
**Commit Message**: fix(deps): remove unused hnswlib-node dependency

**File**: `Plugin/RAGDiaryPlugin/README.md` (modified, +4/-4)
```diff
@@ -33,12 +33,12 @@
 
 ## 数据库核心功能
 
-VCP的RAG日记系统不仅仅是一个功能强大的信息检索工具，其背后还有一个经过深度优化的、高性能的向量数据库管理器 (`VectorDBManager.js`)。该管理器确保了日记内容的实时同步、高效检索和系统的长期稳定运行。
+VCP 的 RAG 日记系统由 `KnowledgeBaseManager.js` 统一编排 SQLite 权威存储与 Rust 向量索引，负责日记内容的同步、检索和恢复。向量索引使用项目自带的 `rust-vexus-lite`，不依赖额外的 Node 原生 HNSW 模块。
 
-### 1. 高性能的HNSW索引
+### 1. SQLite 与 Rust 派生索引
 
--   **核心技术**：采用业界领先的 `hnswlib-node` 库，基于HNSW（Hierarchical Navigable Small World）算法构建向量索引。
--   **优势**：即使在数百万级别的日记片段中，也能实现毫秒级的近似最近邻搜索，确保了RAG检索的极速响应。
+-   **权威数据**：SQLite (`better-sqlite3`) 保存文件、文本块、标签和索引元数据。
+-   **向量检索**：`rust-vexus-lite` 提供 Vexus/USearch 索引；全局标签索引和按日记本索引可按需加载，并可从 SQLite 基线重建。
 
 ### 2. 智能的增量与全量同步
 
```

**File**: `package-lock.json` (modified, +14/-18)
```diff
@@ -33,7 +33,6 @@
         "fs-extra": "^10.1.0",
         "glob": "^7.2.3",
         "globals": "^14.0.0",
-        "hnswlib-node": "^1.4.2",
         "https-browserify": "^1.0.0",
         "https-proxy-agent": "^7.0.4",
         "ioredis": "^5.6.1",
@@ -4301,6 +4300,20 @@
       "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
       "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="
     },
+    "node_modules/fsevents": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
+      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
+      "hasInstallScript": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
+      }
+    },
     "node_modules/fstream": {
       "version": "1.0.12",
       "resolved": "https://registry.npmjs.org/fstream/-/fstream-1.0.12.tgz",
@@ -4640,17 +4653,6 @@
         "he": "bin/he"
       }
     },
-    "node_modules/hnswlib-node": {
-      "version": "1.4.2",
-      "resolved": "https://registry.npmjs.org/hnswlib-node/-/hnswlib-node-1.4.2.tgz",
-      "integrity": "sha512-76PIzOaNcX8kOpKwlFPl07uelpctqDMzbiC+Qsk2JWNVkzeU/6iXRk4tfE9z3DoK1RCBrOaFXmQ6RFb1BVF9LA==",
-      "hasInstallScript": true,
-      "license": "Apache-2.0",
-      "dependencies": {
-        "bindings": "^1.5.0",
-        "node-addon-api": "^6.0.0"
-      }
-    },
     "node_modules/hookified": {
       "version": "1.13.0",
       "resolved": "https://registry.npmjs.org/hookified/-/hookified-1.13.0.tgz",
@@ -6083,12 +6085,6 @@
         "node": ">=10"
       }
     },
-    "node_modules/node-addon-api": {
-      "version": "6.1.0",
-      "resolved": "https://registry.npmjs.org/node-addon-api/-/node-addon-api-6.1.0.tgz",
-      "integrity": "sha512-+eawOlIgy680F0kBzPUNFhMZGtJ1YmqM6l4+Crf4IkImjYrO/mqPwRMh352g23uIaQKFItcQ64I7KMaJxHgAVA==",
-      "license": "MIT"
-    },
     "node_modules/node-cache": {
       "version": "5.1.2",
       "resolved": "https://registry.npmjs.org/node-cache/-/node-cache-5.1.2.tgz",
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@
     "fs-extra": "^10.1.0",
     "glob": "^7.2.3",
     "globals": "^14.0.0",
-    "hnswlib-node": "^1.4.2",
     "https-browserify": "^1.0.0",
     "https-proxy-agent": "^7.0.4",
     "ioredis": "^5.6.1",
```

#### Recent Merged Pull Requests:
- **PR #483** (2026-09-25): fix(deps): remove unused hnswlib-node dependency (@Oscar-Williams)
- **PR #481** (2026-09-22): feat(BilibiliFetch): 修复快照多模态在下游网关触发 SSRF 500 熔断的问题，并优化国内代理路由与多级凭据读取容错 (@infinite-vector)
- **PR #480** (2026-09-21): fix(dailyNotes): 支持日记保存时同步重命名与严格扩展名白名单兜底 (@infinite-vector)
- **PR #479** (closed): feat: add opt-in Telegram bridge with correlated host events (@SeOgi-Tsu)
- **PR #478** (2026-09-19): feat(jev): 折叠/剪枝/river 三处加 Jev 语义二次判断（级联，默认关闭） (@Lutra23)
- **PR #477** (2026-09-19): fix: Responses 格式丢失系统提示词和思维链 (@Wooden-Gear)
- **PR #476** (2026-09-18): fix: Responses 格式对 function call 的支持 (@Wooden-Gear)
- **PR #475** (2026-09-18): fix(deps): 补充缺失的跨平台二进制、幽灵依赖与守卫脚本 (@qingkenzi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
