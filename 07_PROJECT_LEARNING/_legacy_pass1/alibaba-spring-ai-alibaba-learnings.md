# Forensic Learning Record (Deep Inspection): alibaba/spring-ai-alibaba

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-spring-ai-alibaba-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/spring-ai-alibaba](https://github.com/alibaba/spring-ai-alibaba))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:56:08.129Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/spring-ai-alibaba`
- **Description**: Agentic AI Framework for Java Developers
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10952 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/voice-agent/src/main/resources/static/js/voice.js`
```
/**
 * Voice Agent - Real-time voice interaction with Spring AI Alibaba
 * Uses WebSocket for streaming: /voice/ws/audio (audio input) or /voice/ws (text input)
 */

(function () {
  'use strict';

  const SAMPLE_RATE = 16000;
  const CHUNK_SIZE = 1600;

  // State
  let ws = null;
  let audioContext = null;
  let workletNode = null;
  let mediaStream = null;
  let ttsFinishTimeout = null;
  let sessionStartTime = null;
  let isEnding = false;
  let stopTimeoutId = null;
  let agentEndCloseId = null;
  let timerInterval = null;
  let currentTranscript = '';
  let currentResponse = '';

  // DOM refs
  const el = {
    btnStart: document.getElementById('btn-start'),
    btnStop: document.getElementById('btn-stop'),
    statusDot: document.getElementById('status-dot'),
    statusDotInline: document.getElementById('status-dot-inline'),
    statusText: document.getElementById('status-text'),
    elapsed: document.getElementById('elapsed'),
    sessionHint: document.getElementById('session-hint'),
    turnBadge: document.getElementById('turn-badge'),
    transcript: document.getElementById('transcript'),
    response: document.getElementById('response'),
    activityList: document.getElementById('activity-list'),
    logList: document.getElementById('log-list'),
    btnClearActivity: document.getElementById('btn-clear-activity'),
    textInput: document.getElementById('text-input'),
    btnSendText: document.getElementById('btn-send-text'),
  };

  // AudioWorklet code for PCM capture (16kHz, 16-bit, mono)
  const workletCode = `
    class PCMProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.buffer = [];
        this.targetSampleRate = 16000;
        this.resampleRatio = sampleRate / this.targetSampleRate;
        this.resampleIndex = 0;
      }
      process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;
        const channelData = input[0];
        for (let i = 0; i < channelData.length; i++) {
          this.resampleIndex += 1;
          if (this.resampleIndex >= this.resampleRatio) {
            this.resampleIndex -= this.resampleRatio;
            let sample = Math.max(-1, Math.min(1, channelData[i]));
            const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            this.buffer.push(int16);
          }
        }
        const CHUNK_SIZE = 1600;
        while (this.buffer.length >= CHUNK_SIZE) {
          const chunk = this.buffer.splice(0, CHUNK_SIZE);
          const int16Array = new Int16Array(chunk);
          this.port.postMessage(int16Array.buffer, [int16Array.buffer]);
        }
        return true;
      }
    }
    registerProcessor('pcm-processor', PCMProcessor);
  `;

  function setStatus(status) {
    el.statusDot.className = 'status-dot status-' + status;
    el.statusDotInline.className = 'status-dot status-' + status;
    const texts = {
      ready: 'Ready',
      connecting: 'Connecting...',
      listening: 'Listening...',
      error: 'Error',
      disconnected: 'Disconnected',
    };
    el.statusText.textContent = texts[status] || status;
  }

  function formatTime(date) {
    return date.toLocaleTimeString();
  }

  function addActivity(type, label, text, args) {
    const empty = el.activityList.querySelector('.activity-empty');
    if (empty) empty.remove();

    const icons = { stt: '🎤', agent: '🤖', tts: '🔊', tool: '🔧' };
    const iconClass = 'activity-icon-' + type;
    const labelClass = 'activity-label-' + type;

    const div = document.createElement('div');
    div.className = 'activity-item';
    div.innerHTML = `
      <div class="activity-icon ${iconClass}">${icons[type] || '📋'}</div>
      <div class="activity-body">
        <div class="activity-label ${labelClass}">${escapeHtml(label)}</div>
        <div class="activity-text">${escapeHtml(text)}</div>
        ${args ? `<pre class="activity-args" style="margin-top:0.5rem;padding:0.5rem;background:#fff;border-radius:0.25rem;font-size:0.6875rem;overflow-x:auto;">${escapeHtml(JSON.stringify(args, null, 2))}</pre>` : ''}
        <div class="activity-time">${formatTime(new Date())}</div>
      </div>
    `;
    el.activityList.insertBefore(div, el.activityList.firstChild);

    // Keep max 50 items
    while (el.activityList.children.length > 50) {
      el.activityList.removeChild(el.activityList.lastChild);
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function addLog(message) {
    const empty = el.logList.querySelector('.log-empty');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">${formatTime(new Date())}</span>${escapeHtml(message)}`;
    el.logList.appendChild(div);

    while (el.logList.children.length > 100) {
      el.logList.removeChild(el.logList.firstChild);
    }
    el.logList.scrollTop = el.logList.scrollHeight;
  }

  function clearActivity() {
    el.activityList.innerHTML = '<div class="activity-empty">No activity yet...</div>';
  }

  function clearLogs() {
    el.logList.innerHTML = '<div class="log-empty">Logs will appear here...</div>';
  }

  function resetPipeline() {
    currentTranscript = '';
    currentResponse = '';
    el.transcript.textContent = '—';
    el.response.textContent = '—';
    el.turnBadge.textContent = 'Waiting...';
    el.turnBadge.className = 'turn-badge turn-waiting';
  }

  function startTurn() {
    el.turnBadge.textContent = 'Turn Active';
    el.turnBadge.className = 'turn-badge turn-active';
  }

  function finishTurn() {
    el.turnBadge.textContent = 'Waiting...';
    el.turnBadge.className = 'turn-badge turn-waiting';
  }

  // TTS playback: buffer MP3 chunks, flush to blob and queue; play queue in order (no overlap)
  let ttsBuffer = [];
  let ttsPlayTimeout = null;
  let ttsPlayQueue = [];
  let ttsPlaying = false;
  /** One-shot callback when TTS queue has finished playing (so we can close session after playback). */
  let onTtsQueueDrained = null;

  function pushTtsChunk(base64Audio) {
    ttsBuffer.push(base64Audio);
  }

  function flushTtsToQueue() {
    if (ttsBuffer.length === 0) return;
    const combined = ttsBuffer.map((b) => atob(b)).join('');
    const bytes = new Uint8Array(combined.length);
    for (let i = 0; i < combined.length; i++) bytes[i] = combined.charCodeAt(i);
    ttsBuffer = [];
    ttsPlayQueue.push(new Blob([bytes], { type: 'audio/mpeg' }));
    playNextTtsInQueue();
  }

  function playNextTtsInQueue() {
    if (ttsPlaying || ttsPlayQueue.length === 0) {
      if (!ttsPlaying && ttsPlayQueue.length === 0 && onTtsQueueDrained) {
        const fn = onTtsQueueDrained;
        onTtsQueueDrained = null;
        fn();
      }
      return;
    }
    ttsPlaying = true;
    const blob = ttsPlayQueue.shift();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      ttsPlaying = false;
      playNextTtsInQueue();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      ttsPlaying = false;
      playNextTtsInQueue();
    };
    audio.play();
  }

  function stopTtsPlayback() {
    onTtsQueueDrained = null;
    ttsBuffer = [];
    ttsPlayQueue = [];
    if (ttsPlayTimeout) {
      clearTimeout(ttsPlayTimeout);
      ttsPlayTimeout = null;
    }
    if (ttsFinishTimeout) {
      clearTimeout(ttsFinishTimeout);
      ttsFinishTimeout = null;
    }
  }

  function handleEvent(ev) {
    switch (ev.type) {
      case 'stt_chunk':
        // Realtime partial transcript (live recognition)
        el.transcript.textContent = (ev.transcript || '') + '…';
        break;

      case 'stt_output':
        currentTranscript = ev.transcript || '';
        el.transcript.textContent = currentTranscript || '—';
        addActivity('stt', 'Transcription', currentTranscript);
        break;

      case
```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/.eslintrc.js`
```
module.exports = {
  extends: require.resolve('umi/eslint'),
  rules: {
    '@typescript-eslint/no-unused-vars': 0,
    '@typescript-eslint/no-non-null-asserted-optional-chain': 0,
    'no-case-declarations': 0,
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/no-unused-expressions': 0,
    'no-useless-escape': 0,
  },
};

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/.prettierrc.js`
```
module.exports = {
  pluginSearchDirs: false,
  plugins: [
    require.resolve('prettier-plugin-organize-imports'),
    require.resolve('prettier-plugin-packagejson'),
  ],
  printWidth: 80,
  proseWrap: 'never',
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '*.md',
      options: {
        proseWrap: 'preserve',
      },
    },
  ],
};

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/.stylelintrc.js`
```
module.exports = {
  extends: require.resolve('umi/stylelint'),
  customSyntax: 'postcss-less',
  rules: {
    'shorthand-property-no-redundant-values': null,
    'alpha-value-notation': null,
    'rule-empty-line-before': null,
    'value-no-vendor-prefix': null,
    'length-zero-no-unit': null,
    'keyframes-name-pattern': null,
    'declaration-empty-line-before': null,
    'value-keyword-case': null,
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'variants',
          'responsive',
          'screen',
          'layer',
        ],
      },
    ],
    'selector-class-pattern': null,
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['e'],
      },
    ],
  },
};

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/.umirc.ts`
```
import path from 'path';
import { defineConfig } from 'umi';

export default defineConfig({
  title: 'SAA',
  define: {
    'process.env.WEB_SERVER': process.env.WEB_SERVER,
    'process.env.BACK_END': process.env.BACK_END,
    'process.env.DEFAULT_USERNAME': process.env.DEFAULT_USERNAME,
    'process.env.DEFAULT_PASSWORD': process.env.DEFAULT_PASSWORD,
    BUILD_ID: new Date().toString(),
  },
  alias: {
    '@src': path.resolve(__dirname, './src'),
    '@': path.resolve(__dirname, './src'),
    '@spark-ai/flow': path.resolve(__dirname, '../spark-flow/dist'),
  },
  routes: [
    {
      path: '/',
      redirect: '/app',
    },
    {
      path: '/admin',
      routes: [
        { path: '/admin', component: '@/legacy/pages/index' },
        { path: '/admin/playground', component: '@/legacy/pages/playground/playground' },
        { path: '/admin/prompts', component: '@/legacy/pages/prompts/prompts' },
        { path: '/admin/prompt-detail', component: '@/legacy/pages/prompts/prompt-detail/prompt-detail' },
        { path: '/admin/version-history', component: '@/legacy/pages/prompts/version-history/version-history' },
        { path: '/admin/tracing', component: '@/legacy/pages/tracing/tracing' },
        { path: '/admin/evaluation/experiment', component: '@/legacy/pages/evaluation/experiment/index' },
        { path: '/admin/evaluation/experiment/create', component: '@/legacy/pages/evaluation/experiment/experimentCreate' },
        { path: '/admin/evaluation/experiment/detail/:id', component: '@/legacy/pages/evaluation/experiment/experimentDetail' },
        { path: '/admin/evaluation/gather', component: '@/legacy/pages/evaluation/gather/index' },
        { path: '/admin/evaluation/gather/create', component: '@/legacy/pages/evaluation/gather/gatherCreate' },
        { path: '/admin/evaluation/gather/detail/:id', component: '@/legacy/pages/evaluation/gather/gatherDetail' },
        { path: '/admin/evaluation/evaluator', component: '@/legacy/pages/evaluation/evaluator/index' },
        { path: '/admin/evaluation/evaluator/:id', component: '@/legacy/pages/evaluation/evaluator/evaluator-detail' },
        { path: '/admin/evaluation/debug', component: '@/legacy/pages/evaluation/evaluator/evaluator-debug' },
      ],
    },
    {
      path: '/app/assistant/:id',
      component: 'App/AssistantAppEdit',
    },
    {
      path: '/app/workflow/:id',
      component: 'App/Workflow',
    },
    {
      path: '/app',
      component: 'App/AppList',
    },
    {
      path: '/app/:tab',
      component: 'App/AppList',
    },
    {
      path: '/home',
      component: 'App/index',
    },
    {
      path: '/dify',
      component: 'Dify/index',
    },
    {
      path: '/debug',
      component: 'Debug/index',
    },
    {
      path: '/login',
      component: 'Login/index',
      layout: false,
    },
    {
      path: '/mcp',
      component: 'MCP/index',
    },
    {
      path: '/mcp/create',
      component: 'MCP/Create',
    },
    {
      path: '/mcp/edit/:id',
      component: 'MCP/Create',
    },
    {
      path: '/mcp/detail/:id',
      component: 'MCP/Detail',
    },
    {
      path: '/component/:tab',
      component: 'Component/index',
    },
    {
      path: '/component',
      redirect:
        process.env.BACK_END === 'python'
          ? '/component/flow'
          : '/component/plugin',
    },
    {
      path: '/component/plugin/create',
      component: 'Component/Plugin/Info/Create',
    },
    {
      path: '/component/plugin/:id',
      component: 'Component/Plugin/Info/Edit',
    },
    {
      path: '/component/plugin/:id/tool/create',
      component: 'Component/Plugin/Tools/Edit',
    },
    {
      path: '/component/plugin/:id/tool/:toolId',
      component: 'Component/Plugin/Tools/Edit',
    },
    {
      path: '/component/plugin/:id/tools',
      component: 'Component/Plugin/Tools/List',
    },
    {
      path: '/knowledge',
      component: 'Knowledge/List/index',
    },
    {
      path: '/knowledge/:kb_id',
      component: 'Knowledge/Detail/index',
    },
    {
      path: '/knowledge/test/:kb_id',
      component: 'Knowledge/Test/index',
    },
    {
      path: '/knowledge/create',
      component: 'Knowledge/Create/index',
    },
    {
      path: '/knowledge/edit/:kb_id',
      component: 'Knowledge/Editor/index',
    },
    {
      path: '/knowledge/sliceConfiguration/:kb_id/:doc_id',
      component: 'Knowledge/Detail/SliceConfiguration/index',
    },
    {
      path: '/knowledge/sliceEditing/:kb_id/:doc_id',
      component: 'Knowledge/Detail/SliceEditing/index',
    },
    {
      path: '/setting',
      redirect: '/setting/modelService',
    },
    {
      path: '/setting/modelService',
      component: 'Setting/ModelService',
    },
    {
      path: '/setting/modelService/:id',
      component: 'Setting/ModelService/Detail',
    },
    {
      path: '/setting/account',
      component: 'Setting/Account',
    },
    {
      path: '/setting/apiKeys',
      component: 'Setting/APIKeys',
    },
    {
      path: '/agent-schema',
      component: 'AgentSchema/index',
    },
  ],
  clickToComponent: {},
  // tailwindcss: {},
  esbuildMinifyIIFE: true,
  mfsu: false,
  plugins: [
    // '@umijs/plugins/dist/tailwindcss'
  ],
  proxy: {
    '/api': {
      target: process.env.WEB_SERVER || 'http://localhost:8080',
      changeOrigin: true,
    },
    '/console': {
      target: process.env.WEB_SERVER || 'http://localhost:8080',
      changeOrigin: true,
    },
    '/oauth2': {
      target: process.env.WEB_SERVER || 'http://localhost:8080',
      changeOrigin: true,
    },
  },
  lessLoader: {
    javascriptEnabled: true,
    modifyVars: {
      '@ant-prefix': 'ag-ant',
    },
  },
});

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/public/iconfonts/index.js`
```
window._iconfont_svg_string_4807885='<svg><symbol id="spark-japan-line" viewBox="0 0 1024 1024"><path d="M160 160c29.8688-29.8656 65.92-44.8 108.16-44.8H752c42.2368 0 78.2912 14.9344 108.16 44.8 29.8656 29.8688 44.8 65.92 44.8 108.16V752c0 42.2368-14.9344 78.2912-44.8 108.16-29.8688 29.8656-65.9232 44.8-108.16 44.8H268.16c-42.24 0-78.2912-14.9344-108.16-44.8-29.8656-29.8688-44.8-65.9232-44.8-108.16V268.16c0-42.24 14.9344-78.2912 44.8-108.16z m108.16 680.96H752c24.5664 0 45.5328-8.6848 62.9056-26.0544 17.3696-17.3728 26.0544-38.3392 26.0544-62.9056V268.16c0-24.5664-8.6848-45.536-26.0544-62.9056C797.5296 187.8848 776.5664 179.2 752 179.2H268.16c-24.5664 0-45.536 8.6848-62.9056 26.0544C187.8848 222.6272 179.2 243.5936 179.2 268.16V752c0 24.5664 8.6848 45.5328 26.0544 62.9056 17.3728 17.3696 38.3392 26.0544 62.9056 26.0544zM476.8 332.8c17.6736 0 32 14.3264 32 32s-14.3264 32-32 32h-12.8v217.6c0 0.2688-0.0032 0.5344-0.0096 0.8a93.9904 93.9904 0 0 1-7.664 38.1504 96.5696 96.5696 0 0 1-21.8496 31.664 100.0736 100.0736 0 0 1-32.704 21.1552A102.6752 102.6752 0 0 1 363.2 713.6c-13.3664 0-26.224-2.4768-38.576-7.4304a100.0736 100.0736 0 0 1-32.7008-21.1552c-9.4528-9.152-16.736-19.7056-21.8496-31.664A94.016 94.016 0 0 1 262.4 616c0-17.6736 14.3264-32 32-32s32 14.3264 32 32c0 4.2016 0.8384 8.2592 2.5152 12.1792a33.1456 33.1456 0 0 0 7.5264 10.8544 36.6944 36.6944 0 0 0 12.0064 7.7376c4.704 1.8848 9.6224 2.8288 14.752 2.8288 5.1296 0 10.048-0.944 14.752-2.8288a36.6944 36.6944 0 0 0 12.0064-7.7376 33.1456 33.1456 0 0 0 7.5264-10.8544A30.6656 30.6656 0 0 0 400 616c0-0.2688 0-0.5344 0.0096-0.8A31.568 31.568 0 0 1 400 614.4v-217.6h-16c-17.6736 0-32-14.3264-32-32s14.3264-32 32-32h92.8z m169.6 0c1.1136 0 2.2144 0.0576 3.296 0.1664 1.0208-0.096 2.048-0.1472 3.0944-0.1472 14.848 0 29.136 2.9248 42.8576 8.768 13.7184 5.8464 25.8304 14.1696 36.3296 24.9728 10.5024 10.8 18.592 23.2576 24.2784 37.3696a116.928 116.928 0 0 1 8.5248 44.08c0 15.2736-2.8416 29.968-8.5248 44.0832-5.6832 14.112-13.776 26.5696-24.2784 37.3696-10.4992 10.8-22.6112 19.1232-36.3296 24.9696a108.2496 108.2496 0 0 1-42.8576 8.768c-1.0784 0-2.144-0.0544-3.2-0.1568-1.0464 0.1024-2.112 0.1568-3.1904 0.1568h-57.6v118.4c0 17.6736-14.3264 32-32 32s-32-14.3264-32-32v-315.2c0-0.2656 0-0.5312 0.0096-0.7968A33.6224 33.6224 0 0 1 524.8 364.8c0-17.6736 14.3264-32 32-32h89.6z m-57.6 64v102.4h57.6c1.088 0 2.1632 0.0544 3.2256 0.16 1.04-0.1024 2.096-0.1536 3.1648-0.1536 6.1408 0 12.064-1.216 17.7728-3.648a47.3952 47.3952 0 0 0 15.5328-10.7072 50.9792 50.9792 0 0 0 10.7968-16.6656 53.4976 53.4976 0 0 0 3.8944-20.176c0-7.0048-1.2992-13.728-3.8944-20.176a50.9696 50.9696 0 0 0-10.7968-16.6656 47.4272 47.4272 0 0 0-15.5328-10.704 44.896 44.896 0 0 0-17.7728-3.648c-1.104 0-2.1952-0.0576-3.2704-0.1664-1.0272 0.0992-2.0672 0.1504-3.12 0.1504h-57.6z"  ></path></symbol><symbol id="spark-productService-line" viewBox="0 0 1024 1024"><path d="M801.792 217.6h-101.0176v83.2c0 15.872-5.632 29.4912-16.8448 40.7552-11.264 11.264-24.832 16.8448-40.7552 16.8448h-121.5488c-15.9232 0-29.4912-5.632-40.7552-16.896-11.264-11.264-16.896-24.7808-16.896-40.704V217.6H363.008c-3.072 0-4.5568 1.5872-4.5568 4.8128V371.2H294.4V222.4128c0-18.944 6.656-35.1744 19.968-48.64 13.4656-13.4144 29.6448-20.1728 48.64-20.1728h438.784c18.9952 0 35.1744 6.7584 48.64 20.224 13.312 13.4144 19.968 29.5936 19.968 48.5888v295.9872h-64V222.4128c0-3.2256-1.536-4.8128-4.608-4.8128z m-273.8176 32v44.8h108.8512v-76.8h-108.8512v32z m304.64 352c16.384 0 29.7984 4.7616 40.2944 14.336a50.7904 50.7904 0 0 1 16.6912 39.3216c0 23.04-11.3152 46.336-33.9456 69.8368a620.1856 620.1856 0 0 1-105.472 86.8352c-62.0544 41.1136-117.9648 61.6448-167.68 61.6448a348.16 348.16 0 0 1-83.3536-10.5472 789.504 789.504 0 0 1-67.6864-21.1456c-38.5536-13.5168-65.9968-20.2752-82.3296-20.2752H182.3744a32 32 0 0 1-32-32v-206.336c0-8.3456 3.2768-16.384 9.1136-22.3232A302.6944 302.6944 0 0 1 239.9232 502.784c38.3488-19.456 75.7248-29.2352 112.0768-29.2352 37.888 0 89.6 12.1344 155.136 36.4544 67.9424 25.2416 110.1824 49.152 126.72 71.7824 12.7488 17.408 16.128 35.8912 10.24 55.4496 106.2912-23.808 169.1648-35.6864 188.5184-35.6864z m-287.4368 52.5824a33.9968 33.9968 0 0 0 2.816 0.9728c16.384-12.032 27.2384-22.4768 32.4096-31.3344a12.544 12.544 0 0 0 1.9968-4.5568l-0.2048 0.3584c-3.2768-4.4544-13.4144-11.2128-30.3616-20.224-18.6368-9.8816-40.96-19.6608-67.0208-29.3376-58.2656-21.6576-102.5536-32.4608-132.8128-32.4608-26.112 0-53.8624 7.424-83.0976 22.272a247.0912 247.0912 0 0 0-54.4768 36.9664v160.768h134.656c23.6544 0 58.1632 7.936 103.5776 23.8592 26.7264 9.3696 47.36 15.872 61.7984 19.456 23.552 5.7856 46.2848 8.704 68.096 8.704 36.8128 0 80.896-17.0496 132.352-51.0464a556.8512 556.8512 0 0 0 94.6176-77.824c5.12-5.3248 9.0624-10.0864 11.7248-14.1824-31.7952 4.096-112.7424 21.1968-242.7904 51.3536-19.3024 4.4544-38.144 3.072-56.6272-4.1984l-84.3264-32.9728A32 32 0 1 1 460.8 621.1584l84.3776 33.024z"  ></path></symbol><symbol id="spark-luckyBag-line" viewBox="0 0 1024 1024"><path d="M769.043175 168.953584c3.4784 12.812799 3.3216 26.950397-0.473599 42.406396-3.1904 12.998399-8.825599 26.399997-16.902399 40.207996a211.05598 211.05598 0 0 1-8.095999 12.755199 223.609579 223.609579 0 0 1 40.339196-3.6992c36.479997 0 72.255993 9.084799 107.33119 27.247998a31.999997 31.999997 0 0 1 17.283198 28.233597v0.1824a31.996797 31.996797 0 0 1-46.713595 28.415997l-0.0288-0.0128c-25.839998-13.375999-51.798395-20.063998-77.871993-20.063998-11.830399 0-23.795198 1.3696-35.891197 4.1152 64.831994 35.145597 126.348788 45.657596 184.553583 31.535997h0.0096l0.0416-0.0128a31.958397 31.958397 0 0 1 24.198398 3.769599 31.999997 31.999997 0 0 1-9.1008 58.425595l-0.0288 0.0064c-43.999996 10.681599-88.863992 10.655999-134.582387-0.0768a418.38396 418.38396 0 0 1 9.782399 16.655998c30.979197 55.699195 46.467196 114.329589 46.467196 175.894383 0 47.871995-5.0816 89.644791-15.247999 125.327988-11.935999 41.891196-31.209597 77.094393-57.820794 105.60639-28.854397 30.915197-66.409594 54.095995-112.659189 69.542394-47.222395 15.769598-104.23679 23.651198-171.039984 23.651197-66.803194 0-123.817588-7.881599-171.039984-23.647997-46.249596-15.449599-83.801592-38.630396-112.655989-69.545594-26.614397-28.511997-45.887996-63.711994-57.823994-105.60639-10.163199-35.679997-15.247999-77.459193-15.247999-125.327988 0-61.564794 15.487999-120.191989 46.463996-175.894383C228.102427 392.639963 264.608024 348.479967 311.817619 306.559971a277.971173 277.971173 0 0 1-15.852798-16.083199c-11.481599-12.639999-21.110398-25.609598-28.889598-38.905596-8.076799-13.807999-13.711999-27.209597-16.902398-40.207996-3.7952-15.455999-3.9552-29.593597-0.48-42.406396 2.1024-7.743999 5.462399-14.710399 10.083199-20.905598a60.191994 60.191994 0 0 1 17.945598-16.015999c25.423998-14.953599 51.331195-19.907198 77.721593-14.863998 12.979199 2.4832 25.724798 7.388799 38.236796 14.719998a128.630388 128.630388 0 0 1 13.142399-15.727998c14.643199-14.927999 32.812797-26.217597 54.508795-33.865597a143.449586 143.449586 0 0 1 48.038395-8.182399c16.553598 0 32.569597 2.7264 48.041596 8.182399 21.699198 7.647999 39.871996 18.937598 54.508794 33.865597a128.367988 128.367988 0 0 1 13.142399 15.724798c12.515199-7.327999 25.260798-12.233599 38.239997-14.716798 26.390397-5.0432 52.297595-0.0896 77.718392 14.867198a60.108794 60.108794 0 0 1 17.945598 16.012799c4.6208 6.195199 7.980799 13.161599 10.079999 20.905598z m-110.835189 174.508783a299.391971 299.391971 0 0 1-24.527998 13.382399c-39.708796 19.318398-81.145592 28.979197-124.313588 28.979197-43.161596 0-84.598392-9.660799-124.310388-28.979197a299.363171 299.363171 0 0 1-20.748798-11.123199c-46.687996 39.740796-82.051192 81.215992-106.08319 124.431988-25.599998 46.028796-38.399996 94.291191-38.399996 144.787186 0 41.910396 4.2688 77.843193 12.799999 107.79519 9.116799 31.990397 23.468798 58.483194 43.059196 79.471992 21.459198 22.991998 50.172795 40.492796 86.140791 52.502395 40.643196 13.571199 90.902391 20.358398 150.767986 20.358399 59.
```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/app.tsx`
```
import '../tailwind.css';
import '@src/legacy/styles/tailwind.css';
import '@src/legacy/styles/index.css';
import $i18n from '@/i18n';
import { matchRoutes } from 'umi';

console.log(
  // @ts-ignore
  `%cBUILD_ID: ${BUILD_ID}`,
  'color: #fff; background: #615ced; font-size: 10px;border-radius:6px;padding:2px 4px;',
);

// Initialize window.g_config
// @ts-ignore
window.g_config = {
  user: {},
  config: {},
};

// @ts-ignore
export function onRouteChange({ clientRoutes, location }) {
  const route = matchRoutes(clientRoutes, location.pathname)?.pop()?.route;

  const firstLevelRouteMaps = {
    '/app': $i18n.get({
      id: 'main.layouts.MenuList.application',
      dm: '应用',
    }),
    '/mcp': 'MCP',
    '/component': $i18n.get({
      id: 'main.pages.Component.AppComponent.index.component',
      dm: '组件',
    }),
    '/knowledge': $i18n.get({
      id: 'main.pages.Knowledge.Test.index.knowledgeBase',
      dm: '知识库',
    }),
    '/setting': $i18n.get({
      id: 'main.pages.Setting.ModelService.Detail.setting',
      dm: '设置',
    }),
    '/login': $i18n.get({
      id: 'main.pages.Login.components.Register.index.login',
      dm: '登录',
    }),
    '/debug': $i18n.get({
      id: 'main.pages.Debug.index.title',
      dm: 'Agent Chat UI',
    }),
    '/dify': $i18n.get({
      id: 'main.pages.Dify.index.title',
      dm: 'Dify Converter',
    }),
  };

  Object.entries(firstLevelRouteMaps).some((item) => {
    if (route?.path?.startsWith(item[0])) {
      document.title = `SAA - ${item[1]}`;
      return true;
    } else {
      return false;
    }
  });
}

```

### Core Architecture Module: `spring-ai-alibaba-admin/frontend/packages/main/src/components/AccountModal/index.tsx`
```
import $i18n from '@/i18n';
import { authLogout } from '@/services/login';
import { IAccount, USER_TYPE } from '@/types/account';
import { Avatar, Button, Form, Input, Modal, Tag } from '@spark-ai/design';
import { Flex } from 'antd';
import React, { useEffect } from 'react';
import styles from './index.module.less';

interface AccountModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (values: any) => void;
  userInfo: IAccount | null;
}

const AccountModal: React.FC<AccountModalProps> = ({
  open,
  onCancel,
  onOk,
  userInfo,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && userInfo) {
      form.setFieldsValue({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [open, userInfo, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      onOk(values);
    });
  };

  if (!userInfo) {
    return null;
  }

  return (
    <Modal
      title={$i18n.get({
        id: 'main.components.AccountModal.index.accountManagement',
        dm: '账号管理',
      })}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {$i18n.get({
            id: 'main.pages.Setting.ModelService.components.ProviderInfoForm.index.cancel',
            dm: '取消',
          })}
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          {$i18n.get({
            id: 'main.pages.Setting.Account.components.UserEditModal.index.confirm',
            dm: '确定',
          })}
        </Button>,
      ]}
      width={520}
    >
      <div className={styles['user-info-header']}>
        <Avatar size={40}>{userInfo.username.charAt(0).toUpperCase()}</Avatar>
        <div className={styles['user-info-details']}>
          <Flex align="center" gap={24}>
            <div className={styles['user-name']}>{userInfo.username}</div>
            <Button
              size="small"
              iconType="spark-escape-line"
              onClick={() => {
                authLogout();
              }}
            >
              {$i18n.get({
                id: 'main.components.AccountModal.index.logout',
                dm: '退出登录',
              })}
            </Button>
          </Flex>
          <Tag color={userInfo.type === 'admin' ? 'purple' : 'mauve'}>
            {USER_TYPE[userInfo.type as keyof typeof USER_TYPE]}
          </Tag>
        </div>
      </div>

      <Form
        form={form}
        requiredMark={false}
        colon={false}
        labelCol={$i18n.getCurrentLanguage() === 'cn' ? { span: 4 } : undefined}
        labelAlign="right"
      >
        <div className={styles['section-title']}>
          {$i18n.get({
            id: 'main.pages.Setting.Account.components.UserEditModal.index.changePassword',
            dm: '更改密码',
          })}
        </div>
        <Form.Item
          name="currentPassword"
          label={$i18n.get({
            id: 'main.components.AccountModal.index.currentPassword',
            dm: '当前密码',
          })}
          rules={[
            {
              required: true,
              message: $i18n.get({
                id: 'main.components.AccountModal.index.enterCurrentPassword',
                dm: '请输入当前密码',
              }),
            },
          ]}
        >
          <Input.Password
            placeholder={$i18n.get({
              id: 'main.components.AccountModal.index.inputCurrentPassword',
              dm: '输入当前密码',
            })}
          />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label={$i18n.get({
            id: 'main.pages.Setting.Account.components.UserEditModal.index.newPassword',
            dm: '新密码',
          })}
        >
          <Input.Password
            placeholder={$i18n.get({
              id: 'main.components.AccountModal.index.inputNewPassword',
              dm: '输入新的密码',
            })}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={$i18n.get({
            id: 'main.pages.Setting.Account.components.UserEditModal.index.newPassword',
            dm: '新密码',
          })}
          dependencies={['newPassword']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const newPassword = getFieldValue('newPassword');
                if (newPassword && newPassword !== value) {
                  return Promise.reject(
                    new Error(
                      $i18n.get({
                        id: 'main.pages.Setting.Account.components.UserEditModal.index.passwordNotMatch',
                        dm: '两次输入的密码不一致',
                      }),
                    ),
                  );
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <Input.Password
            placeholder={$i18n.get({
              id: 'main.pages.Setting.Account.components.UserEditModal.index.confirmNewPassword',
              dm: '确认新密码',
            })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AccountModal;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4981** (2026-09-18): **[Question]**
  *Symptoms*: ### Question  v2.0 GA版本预计什么时间发布呢

- **Issue #4967** (2026-09-12): **[Docs] quick-start 示例照抄即复现 400：工具 inputType 使用 String.class**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  照抄官方 quick-start 的「构建一个基础 Agent」小节（`FunctionToolCallback` 使用 `.inputType(String.class)`），**第二轮**请求返回 400，工具调用链路中断。  第一轮请求正常；第二轮（回传模型返回的 `tool_call` 时）失败：  ```text HTTP 400 - {"request_id":"330f8d4d-77f5-9671-86ba-a1b223fbb175","code":"InvalidParameter", "message":"<400> InternalError.Algo.InvalidParameter: The \"function.arguments\" parameter of the code model must be in JSON format."} ```  同一页「构建一个真实的 Agent」步骤 2 的两个工具（`WeatherForLocationTool` / `UserLocationTool`）写法相同，同样会失败。   ### Expected Behavior  正常返回天气结果，且 `get_weather` 被真实调用（ReAct 循环能正常走完两轮）。    ### Steps To Reproduce  1. 打开 https://java2ai.com/docs/quick-start 的「构建一个基础 Agent」小节，**原样**复制该小节代码； 2. 执行 `agent.call("what is the weather in San Francisco")`； 3. 第二轮请求返回上述 400。  补充：以下最小验证**不需要 API Key、不联网**，可直接确认根因（约 30 秒）：  ```java ToolCallback tool = FunctionToolCallback.builder("get_weather", new WeatherTool())         .description("Get weather for a given city")         .inputType(String.class)         .build();  System.out.println(tool.getToolDefinition().inputSchema()); // 输出: { "type" : "string", "additionalProperties" : false } ```  把 `inputType` 换成 record 类型后，输出为 `"type" : "object"`，且 400 消失。   ### Environment  ```markdown Spring AI Alibaba version(s): 1.1.2.0  | 项                                  | 值                                                          | | ----------------------------------- | ---------------
  **Post-Mortem & Fix Analysis**:
  > 与 #4966 重复（网络原因重复提交，抱歉制造噪音），保留 #4966。

- **Issue #4966** (2026-09-25): **[Docs] quick-start 示例照抄即复现 400：工具 inputType 使用 String.class**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  照抄官方 quick-start 的「构建一个基础 Agent」小节（`FunctionToolCallback` 使用 `.inputType(String.class)`），**第二轮**请求返回 400，工具调用链路中断。  第一轮请求正常；第二轮（回传模型返回的 `tool_call` 时）失败：  ```text HTTP 400 - {"request_id":"330f8d4d-77f5-9671-86ba-a1b223fbb175","code":"InvalidParameter", "message":"<400> InternalError.Algo.InvalidParameter: The \"function.arguments\" parameter of the code model must be in JSON format."} ```  同一页「构建一个真实的 Agent」步骤 2 的两个工具（`WeatherForLocationTool` / `UserLocationTool`）写法相同，同样会失败。   ### Expected Behavior  正常返回天气结果，且 `get_weather` 被真实调用（ReAct 循环能正常走完两轮）。  ### Steps To Reproduce  1. 打开 https://java2ai.com/docs/quick-start 的「构建一个基础 Agent」小节，**原样**复制该小节代码； 2. 执行 `agent.call("what is the weather in San Francisco")`； 3. 第二轮请求返回上述 400。  补充：以下最小验证**不需要 API Key、不联网**，可直接确认根因（约 30 秒）：  ```java ToolCallback tool = FunctionToolCallback.builder("get_weather", new WeatherTool())         .description("Get weather for a given city")         .inputType(String.class)         .build();  System.out.println(tool.getToolDefinition().inputSchema()); // 输出: { "type" : "string", "additionalProperties" : false } ```  把 `inputType` 换成 record 类型后，输出为 `"type" : "object"`，且 400 消失。    ### Environment  ```markdown Spring AI Alibaba version(s): 1.1.2.0  | 项                                  | 值                                                          | | ----------------------------------- | ----------------
  **Post-Mortem & Fix Analysis**:
  > 已在文档仓库提交修复 PR：https://github.com/spring-ai-alibaba/website/pull/282
  > https://github.com/agentic-spring-ai/website
  > @yuluo-yx 感谢指引！已按您的提示，把同样的修复提交到 agentic-spring-ai/website：  https://github.com/agentic-spring-ai/website/pull/1  改动与 spring-ai-alibaba/website#282 一致（docs/quick-start.md，+34/-16）。 #282 我先保留，如需关闭请告知。

- **Issue #4952** (2026-09-17): **[BUG] Timed-out parallel tools can execute after waiting for a permit**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues and pull requests.  ### Current Behavior  With parallel tool execution and a concurrency limit, a tool waiting in `Semaphore.acquire()` can outlive its outer `CompletableFuture.orTimeout()`:  1. The agent receives timeout responses for both tools. 2. Releasing a permit afterward still lets the waiting tool invoke its callback, despite its response already being finalized as a timeout. 3. If the running tool never releases its permit, the waiter continues occupying an executor worker after the agent call returns.  For tools that perform writes or call external services, the late invocation can cause side effects after the caller has already received a failure. This was reproduced with an invocation counter, not with real external writes.  ### Expected Behavior  Waiting for a parallel execution permit should be bounded by the tool's remaining timeout budget, including executor queueing time. A tool whose budget expired while waiting should not begin execution when a permit later becomes available. Waiting workers should become reusable even if an already-running synchronous tool remains blocked.  ### Steps To Reproduce  Use an `AgentToolNode` configured as follows:  ```java AgentToolNode.builder()     .agentName("test-agent")     .toolCallbacks(List.of(firstTool, secondTool))     .parallelToolExecution(true)     .maxParallelTools(1)     .toolExecutionTimeout(Duration.ofSeconds(2))     .toolExecu
  **Post-Mortem & Fix Analysis**:
  > **Issue Evaluation**  Category: `bug` | Status: **Needs Verification**  Thank you for reporting this issue. It has been classified as a potential bug.  **Next steps:** - This issue will be verified against the current codebase by the automated analysis engine. - If confirmed, a fix proposal (spec) will be generated for community review. - You can reply `/approve` to fast-track PR generation, or `/reject` to close the proposal.  **Reported by:** @beemines  --- *Automated evaluation by oss-sentinel-ai*

- **Issue #4950** (2026-09-17): **[BUG] AppendStrategy(false) ignores duplicate policy for scalar updates**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues and pull requests.  ### Current Behavior  `AppendStrategy(false)` removes duplicates when a node returns a list, but ignores the flag when the node returns a single value. The same logical update therefore produces different state depending on whether it is wrapped in a list.  ### Expected Behavior  When appending to an existing list with `allowDuplicate=false`, a scalar update should have the same duplicate policy and encounter order as an equivalent singleton-list update, without mutating the previous state. The default duplicate-allowing behavior should remain unchanged.  ### Steps To Reproduce  Using `com.alibaba.cloud.ai.graph.state.strategy.AppendStrategy` and `java.util.List`:  ```java var strategy = new AppendStrategy(false); var previous = List.of("first", "second");  strategy.apply(previous, "second");         // [first, second, second] strategy.apply(previous, List.of("second")); // [first, second] ```  This also reproduces through `StateGraph`: register `new AppendStrategy(false)` for a `results` key, connect two nodes that each return `Map.of("results", "answer")`, and invoke the graph. The final state is `[answer, answer]` instead of `[answer]`.  ### Environment  - Current `main`: `f82da0b50f35744c13968191be2b1cd2452ef550` (POM version 1.1.2.2) - Windows, JDK 17.0.17, Maven 3.9.4 - No database or external model calls required  ### Debug logs  A local regression suite has 9 cases.
  **Post-Mortem & Fix Analysis**:
  > **Issue Evaluation**  Category: `bug` | Status: **Needs Verification**  Thank you for reporting this issue. It has been classified as a potential bug.  **Next steps:** - This issue will be verified against the current codebase by the automated analysis engine. - If confirmed, a fix proposal (spec) will be generated for community review. - You can reply `/approve` to fast-track PR generation, or `/reject` to close the proposal.  **Reported by:** @beemines  --- *Automated evaluation by oss-sentinel-ai*

- **Issue #4940** (2026-09-07): **fix(agent): resolve skill tools after HITL resume**
  *Symptoms*: ### Describe what this PR does / why we need it  When a Skill progressively discloses a tool through `SkillsInterceptor`, `AgentLlmNode` stores the dynamic callback in the current run's `RunnableConfig.context` so `AgentToolNode` can execute it.  If `HumanInTheLoopHook` interrupts that tool call, applications normally resume with a newly built `RunnableConfig`. The new config has an empty context, so the approved Skill tool can no longer be resolved. Current `main` consequently returns a `Tool not available` response (older releases throw `No ToolCallback found`) instead of executing the approved tool.  This PR preserves progressive disclosure while making Skill-managed callbacks resolvable during resumed tool execution.  ### Does this pull request fix one issue?  Fixes #4606.  ### Describe how you did it  - Make `SkillsInterceptor` implement Spring AI's `ToolCallbackResolver` contract for tools it manages. - Resolve current `groupedTools` / `groupedToolsSupplier` entries at execution time, so runtime tool updates remain effective. - Limit fallback resolution through the configured resolver to tool names declared in a registered Skill's `allowed_tools` list. - Register model interceptors that implement `ToolCallbackResolver` as execution-only dynamic resolvers on `AgentToolNode`. - Keep the existing resolution order: static node tools, current-run dynamic callbacks, dynamic interceptor resolvers, then the agent-level resolver. - Do not add these execution fallback callbacks t
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-08-30T18:18:10.042591Z">2026-08-30T18:18:10.042591Z</relative-time> | `9d6adf3` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  > ## PR Review — #4940: fix(agent): resolve skill tools after HITL resume  ### Summary This PR modifies 4 files (+146 -1) on branch `fix/skill-hitl-dynamic-tools` targeting `main`.  ### Changed Files - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/ReactAgent.java` - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/interceptor/skills/SkillsInterceptor.java` - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/node/AgentToolNode.java` - `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/interceptors/SkillsInterceptorEnhancementsTest.java`  ### Note Automated deep review via code engine was unavailable. This is a structural overview only. Please verify: - All changed files are intentional - Tests cover the modifications - No credentials or secrets are introduced - API changes are backward compatible
  >  https://github.com/agentic-spring-ai/agentic-spring-ai 可以提这里   这里的我不会再看了

- **Issue #4938** (2026-08-31): **fix(agent): use object schemas for filesystem tools**
  *Symptoms*: ## Summary  - wrap the `ls` path and `glob` pattern in request records so their generated tool schemas use a top-level JSON object - preserve the existing direct `apply(String, ToolContext)` API for compatibility - add regression tests for the generated schemas and JSON tool invocation  ## Verification  - reproduced the reported `ls` string-schema rejection against DeepSeek - verified a `ReactAgent` with `FilesystemInterceptor` is accepted after the change - `./mvnw -pl spring-ai-alibaba-agent-framework test` (`615` tests, `0` failures, `0` errors)  Fixes #4937
  **Post-Mortem & Fix Analysis**:
  > ## PR Review — #4938: fix(agent): use object schemas for filesystem tools  ### Summary This PR modifies 3 files (+95 -5) on branch `fix/4937-deepseek-filesystem-schema` targeting `main`.  ### Changed Files - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/extension/tools/filesystem/GlobTool.java` - `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/extension/tools/filesystem/ListFilesTool.java` - `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/extension/tools/filesystem/FilesystemToolSchemaTest.java`  ### Note Automated deep review via code engine was unavailable. This is a structural overview only. Please verify: - All changed files are intentional - Tests cover the modifications - No credentials or secrets are introduced - API changes are backward compatible
  >  https://github.com/agentic-spring-ai/agentic-spring-ai 可以提这里   这里的我不会再看了
  > The fix has been moved to agentic-spring-ai/agentic-spring-ai#54 per maintainer guidance. Closing this PR to avoid duplicate review.

- **Issue #4933** (2026-09-03): **fix(admin): add missing ThreadPoolExecutor import in RequestContextThreadPoolWrapper**
  *Symptoms*: ### Describe what this PR does / why we need it  `spring-ai-alibaba-admin-server-core` currently fails to compile on `main` because `RequestContextThreadPoolWrapper` references `ThreadPoolExecutor` (line 235) without importing it. This PR adds the missing import.  ### Does this pull request fix one issue?  Fixes #4931  ### Describe how you did it  Added `import java.util.concurrent.ThreadPoolExecutor;` to `RequestContextThreadPoolWrapper.java`, placed in alphabetical order among the existing `java.util.concurrent` imports.  ### Describe how to verify it  Verified with an A/B test on a clean clone of `main` (`f82da0b`, JDK 17):  1. `cd spring-ai-alibaba-admin && mvn -pl spring-ai-alibaba-admin-server-core -am compile`    fails with:    `RequestContextThreadPoolWrapper.java:[235,16] cannot find symbol: class ThreadPoolExecutor` 2. With this one-line change (`git diff` = 1 insertion), the same command    completes with `BUILD SUCCESS`.  Checkstyle (using the repo's own config at `tools/src/checkstyle/checkstyle.xml`) reports no violations for the changed file.  Note: the CI workflows do not cover the `spring-ai-alibaba-admin` modules (the root `pom.xml` reactor excludes them), so the local compilation above is the authoritative verification.  ### Special notes for reviews  None. 
  **Post-Mortem & Fix Analysis**:
  > ## PR Review — #4933: fix(admin): add missing ThreadPoolExecutor import in RequestContextThreadPoolWrapper  ### Summary This PR modifies 1 files (+1 -0) on branch `fix/issue-4931-admin-server-core-compile` targeting `main`.  ### Changed Files - `spring-ai-alibaba-admin/spring-ai-alibaba-admin-server-core/src/main/java/com/alibaba/cloud/ai/studio/core/utils/concurrent/RequestContextThreadPoolWrapper.java`  ### Note Automated deep review via code engine was unavailable. This is a structural overview only. Please verify: - All changed files are intentional - Tests cover the modifications - No credentials or secrets are introduced - API changes are backward compatible
  >  https://github.com/agentic-spring-ai/agentic-spring-ai 可以提这里   这里的我不会再看了
  > The `spring-ai-alibaba-admin` module appears to have been migrated to [agentic-spring-ai/agentic-spring-ai](https://github.com/agentic-spring-ai/agentic-spring-ai). As the target file (`RequestContextThreadPoolWrapper.java`) does not exist in the new repository, I'm closing this PR. Thank you for the review guidance, @yuluo-yx.

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

### Incident Patch 1: `e61cbc4e` (2026-08-25)
**Commit Message**: fix(graph): preserve streaming node id in error callbacks (#4925)

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/GraphRunnerContext.java` (modified, +14/-4)
```diff
@@ -314,23 +314,33 @@ public OverAllState cloneState(Map<String, Object> data) throws Exception {
 	// ================================================================================================================
 
 	public void doListeners(String scene, Exception e) {
+		doListeners(scene, getCurrentNodeId(), e);
+	}
+
+	/**
+	 * Notifies lifecycle listeners using an explicit node ID.
+	 * @param scene the lifecycle scene
+	 * @param nodeId the node associated with the lifecycle event
+	 * @param e the error when the scene is {@link StateGraph#ERROR}
+	 */
+	public void doListeners(String scene, String nodeId, Exception e) {
 		for (GraphLifecycleListener listener : compiledGraph.compileConfig.lifecycleListeners()) {
 			try {
 				switch (scene) {
 					case START:
-						listener.onStart(getCurrentNodeId(), getCurrentStateData(), config);
+						listener.onStart(nodeId, getCurrentStateData(), config);
 						break;
 					case END:
 						listener.onComplete(END, getCurrentStateData(), config);
 						break;
 					case NODE_BEFORE:
-						listener.before(getCurrentNodeId(), getCurrentStateData(), config, SystemClock.now());
+						listener.before(nodeId, getCurrentStateData(), config, SystemClock.now());
 						break;
 					case NODE_AFTER:
-						listener.after(getCurrentNodeId(), getCurrentStateData(), config, SystemClock.now());
+						listener.after(nodeId, getCurrentStateData(), config, SystemClock.now());
 						break;
 					case ERROR:
-						listener.onError(getCurrentNodeId(), getCurrentStateData(), e, config);
+						listener.onError(nodeId, getCurrentStateData(), e, config);
 						break;
 				}
 			} catch (Exception ex) {
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/executor/NodeExecutor.java` (modified, +1/-1)
```diff
@@ -322,7 +322,7 @@ else if (element instanceof GraphResponse) {
 				// Handle actual error signals from the Flux
 				log.error("Error signal occurred in embedded Flux stream for key '{}': {}",
 					key, error.getMessage());
-				context.doListeners(ERROR, new Exception(error));
+				context.doListeners(ERROR, nodeId, new Exception(error));
 				GraphResponse<NodeOutput> errorResponse = GraphResponse.error(error);
 				lastGraphResponseRef.set(errorResponse);
 				return Flux.just(errorResponse);
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/StateGraphTest.java` (modified, +43/-0)
```diff
@@ -32,6 +32,8 @@
 import com.alibaba.cloud.ai.graph.state.RemoveByHash;
 import com.alibaba.cloud.ai.graph.state.strategy.AppendStrategy;
 import com.alibaba.cloud.ai.graph.state.strategy.ReplaceStrategy;
+import com.alibaba.cloud.ai.graph.streaming.GraphFlux;
+import com.alibaba.cloud.ai.graph.streaming.ParallelGraphFlux;
 import com.alibaba.cloud.ai.graph.streaming.StreamingOutput;
 import com.alibaba.cloud.ai.graph.utils.EdgeMappings;
 
@@ -1273,6 +1275,47 @@ public void onError(String nodeId, Map<String, Object> state, Throwable ex, Runn
 		assertEquals(sourceException, listenerException.get().getCause());
 	}
 
+	@Test
+	public void testGraphFluxErrorUsesChildNodeIdForLifecycleListener() throws Exception {
+		RuntimeException sourceException = new RuntimeException("GraphFlux child failure");
+		AtomicReference<String> errorNodeId = new AtomicReference<>();
+		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "parent")
+				.addNode("parent", node_async(state -> Map.of("stream",
+						GraphFlux.of("child", Flux.error(sourceException)))))
+				.addEdge("parent", END);
+
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorNodeId.set(nodeId);
+			}
+		}).build());
+
+		assertThrows(RuntimeException.class, () -> app.stream(Map.of()).blockLast());
+		assertEquals("child", errorNodeId.get());
+	}
+
+	@Test
+	public void testParallelGraphFluxErrorUsesFailingChildNodeIdForLifecycleListener() throws Exception {
+		RuntimeException sourceException = new RuntimeException("ParallelGraphFlux child failure");
+		AtomicReference<String> errorNodeId = new AtomicReference<>();
+		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "parent")
+				.addNode("parent", node_async(state -> Map.of("stream", ParallelGraphFlux.of(List.of(
+						GraphFlux.of("child_success", Flux.just("ok")),
+						GraphFlux.of("child_failure", Flux.error(sourceException)))))))
+				.addEdge("parent", END);
+
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorNodeId.set(nodeId);
+			}
+		}).build());
+
+		assertThrows(RuntimeException.class, () -> app.stream(Map.of()).blockLast());
+		assertEquals("child_failure", errorNodeId.get());
+	}
+
 	@Test
 	public void testStreamingNodeWithNodeException() throws Exception {
 		AtomicInteger errorCount = new AtomicInteger();
```

---

### Incident Patch 2: `cc137635` (2026-08-24)
**Commit Message**: docs: fix GitHub capitalization in CONTRIBUTING and GOVERNANCE (#4912)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `CONTRIBUTING-zh.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Spring AI Alibaba 从开源建设以来，受到了很多社区同学的关注
 - 点击 [本项目](https://github.com/alibaba/spring-ai-alibaba) 右上角的 `Fork` 图标 将 alibaba/spring-ai-alibaba  fork 到自己的空间。
 - 将自己账号下的 spring-ai-alibaba 仓库 clone 到本地，例如我的账号是 `chickenlj`，那就是执行 `git clone https://github.com/chickenlj/spring-ai-alibaba.git` 进行 clone 操作。
 
-### 配置 Github 信息
+### 配置 GitHub 信息
 
 - 在自己的机器执行 `git config --list` ，查看 git 的全局用户名和邮箱。
 - 检查显示的 user.name 和 user.email 是不是与自己 github 的用户名和邮箱相匹配。
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ If you are a first-time contributor, you can claim a relatively simple task from
 - Click the `Fork` icon in the upper right corner of [this project](https://github.com/alibaba/spring-ai-alibaba) to fork alibaba/spring-ai-alibaba to your own space.
 - Clone the spring-ai-alibaba repository from your account to your local machine. For example, if my account is `chickenlj`, I would execute `git clone https://github.com/chickenlj/spring-ai-alibaba.git` to clone it.
 
-### Configure Github Information
+### Configure GitHub Information
 
 - Execute `git config --list` on your machine to check git's global username and email.
 - Verify that the displayed user.name and user.email match your github username and email.
```

**File**: `GOVERNANCE.md` (modified, +2/-2)
```diff
@@ -6,9 +6,9 @@ Below is the organizational structure of the Spring AI Alibaba project.
 
 Committers have full write permissions to the entire project codebase, like permissions to operate branches, issues, pull requests, etc. PMC Members have the same codebase permissions as Committers, and are responsible for the community management, decision-making, etc., and are responsible for voting and making decisions on important matters such as releases, vulnerabilities, committer and PMC Member nominations, etc.
 
-The Spring AI Alibaba project belongs to the Alibaba Github organization, so it can leverage all the resources and help from the Alibaba open source organization in some key matters such as security vulnerability reporting and copyright protection.
+The Spring AI Alibaba project belongs to the Alibaba GitHub organization, so it can leverage all the resources and help from the Alibaba open source organization in some key matters such as security vulnerability reporting and copyright protection.
 
-As the only commission of the Alibaba Github organization for this project, PMC is responsible for managing and monitoring the Spring AI Alibaba open source project and ensuring that all development activities comply with the Alibaba organization's open source specifications.
+As the only commission of the Alibaba GitHub organization for this project, PMC is responsible for managing and monitoring the Spring AI Alibaba open source project and ensuring that all development activities comply with the Alibaba organization's open source specifications.
 
 ## Project Management Committee (PMC)
 
```

---

### Incident Patch 3: `44592ade` (2026-08-24)
**Commit Message**: fix(graph): notify lifecycle listener on streaming errors (#4911)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/executor/NodeExecutor.java` (modified, +1/-0)
```diff
@@ -322,6 +322,7 @@ else if (element instanceof GraphResponse) {
 				// Handle actual error signals from the Flux
 				log.error("Error signal occurred in embedded Flux stream for key '{}': {}",
 					key, error.getMessage());
+				context.doListeners(ERROR, new Exception(error));
 				GraphResponse<NodeOutput> errorResponse = GraphResponse.error(error);
 				lastGraphResponseRef.set(errorResponse);
 				return Flux.just(errorResponse);
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/StateGraphTest.java` (modified, +32/-10)
```diff
@@ -46,6 +46,8 @@
 import java.util.concurrent.Executors;
 import java.util.concurrent.ForkJoinPool;
 import java.util.concurrent.LinkedBlockingQueue;
+import java.util.concurrent.atomic.AtomicInteger;
+import java.util.concurrent.atomic.AtomicReference;
 import java.util.stream.Collectors;
 
 import com.fasterxml.jackson.databind.ObjectMapper;
@@ -1229,23 +1231,31 @@ public void testParallelInterrupt() throws GraphStateException {
 
 	@Test
 	public void testStreamingNodeWithFluxException() throws Exception {
+		RuntimeException sourceException = new RuntimeException("Exception in streaming flux");
+		AtomicInteger errorCount = new AtomicInteger();
+		AtomicReference<String> errorNodeId = new AtomicReference<>();
+		AtomicReference<Throwable> listenerException = new AtomicReference<>();
 		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "agent_1")
 				.addNode("agent_1", node_async(state -> {
 					log.info("agent_1\n{}", state);
-					return Map.of("pro1", Flux.just("response1", "response2", "response3")
-							.map(value -> {
-								if (value.equals("response3")) {
-									throw new RuntimeException("Exception in map operation");
-								}
-								return value;
-							}));
+					return Map.of("pro1", Flux.concat(Flux.just("response1", "response2"), Flux.error(sourceException)));
 				}))
 				.addEdge("agent_1", END);
 
-		CompiledGraph app = workflow.compile();
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorCount.incrementAndGet();
+				errorNodeId.set(nodeId);
+				listenerException.set(ex);
+			}
+		}).build());
 
 		assertThrows(RuntimeException.class,
 				() -> app.invoke(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1")));
+		errorCount.set(0);
+		errorNodeId.set(null);
+		listenerException.set(null);
 
 		Flux<NodeOutput> flux = app.stream(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1"));
 
@@ -1256,26 +1266,38 @@ public void testStreamingNodeWithFluxException() throws Exception {
 		assertEquals(2, firstTwoElements.size());
 
 		// 验证第三个元素会抛出异常
-		assertThrows(RuntimeException.class, () -> flux.blockLast());
+		RuntimeException exception = assertThrows(RuntimeException.class, () -> flux.blockLast());
+		assertEquals(sourceException.getMessage(), exception.getMessage());
+		assertEquals(1, errorCount.get());
+		assertEquals("agent_1", errorNodeId.get());
+		assertEquals(sourceException, listenerException.get().getCause());
 	}
 
 	@Test
 	public void testStreamingNodeWithNodeException() throws Exception {
+		AtomicInteger errorCount = new AtomicInteger();
 		StateGraph workflow = new StateGraph(createKeyStrategyFactory()).addEdge(START, "agent_1")
 				.addNode("agent_1", node_async(state -> {
 					throw new RuntimeException("forced exception for testing");
 				}))
 				.addEdge("agent_1", END);
 
-		CompiledGraph app = workflow.compile();
+		CompiledGraph app = workflow.compile(CompileConfig.builder().withLifecycleListener(new GraphLifecycleListener() {
+			@Override
+			public void onError(String nodeId, Map<String, Object> state, Throwable ex, RunnableConfig config) {
+				errorCount.incrementAndGet();
+			}
+		}).build());
 
 		// 验证 invoke 会抛出异常
 		assertThrows(RuntimeException.class,
 				() -> app.invoke(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1")));
+		assertEquals(1, errorCount.get());
 
 		// 验证 stream 也会抛出异常
 		Flux<NodeOutput> flux = app.stream(Map.of(OverAllState.DEFAULT_INPUT_KEY, "test1"));
 		assertThrows(RuntimeException.class, () -> flux.blockLast());
+		assertEquals(2, errorCount.get());
 	}
 
 	/**
```

---

### Incident Patch 4: `e9760b61` (2026-08-24)
**Commit Message**: docs: fix broken Code of Conduct link in GOVERNANCE.md (#4909)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `GOVERNANCE.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ The Spring AI Alibaba project management committee (PMC), is the only governance
    all Spring AI Alibaba project resources and has the final say in the disposition of
    those resources.
 5. Define and evolve the scope of the community.
-6. Receive and handle reports about [code of conduct](./CODE-OF-CONDUCT.md)
+6. Receive and handle reports about [code of conduct](./CODE_OF_CONDUCT.md)
    violations and maintain confidentiality.
 7. Approval of logo changes, significant website updates and marketing campaigns.
 8. Establish processes regarding project resources/assets, including artifact repositories, build and test infrastructure, web sites and their domains, blogs, social-media accounts, etc.
```

---

### Incident Patch 5: `4dc37885` (2026-08-24)
**Commit Message**: fix(graph): cap ParallelNode core pool size on high-core hosts (#4895)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/internal/node/ParallelNode.java` (modified, +6/-2)
```diff
@@ -61,6 +61,10 @@ public class ParallelNode extends Node {
 
 	public static final String MAX_CONCURRENCY_KEY = "__MAX_CONCURRENCY__";
 
+	private static final int MIN_DEFAULT_POOL_SIZE = 4;
+
+	private static final int MAX_DEFAULT_POOL_SIZE = 200;
+
 	static {
 		Runtime.getRuntime().addShutdownHook(new Thread(() -> {
 			shutdownDefaultExecutor();
@@ -181,7 +185,7 @@ private static int calculateCorePoolSize() {
 		// For mixed workloads, 2x CPU cores is typically optimal
 		int corePoolSize = cpuCores * 2;
 		// Ensure minimum of 4 threads for reasonable parallelism on small systems
-		int finalCorePoolSize = Math.max(corePoolSize, 4);
+		int finalCorePoolSize = Math.min(Math.max(corePoolSize, MIN_DEFAULT_POOL_SIZE), MAX_DEFAULT_POOL_SIZE);
 		logger.info("Calculated core pool size: {} (CPU cores: {})", finalCorePoolSize, cpuCores);
 		return finalCorePoolSize;
 	}
@@ -196,7 +200,7 @@ private static int calculateMaximumPoolSize() {
 		int cpuCores = Runtime.getRuntime().availableProcessors();
 		// Allow for handling burst workloads with 4x CPU cores
 		// Cap at reasonable maximum to prevent resource exhaustion
-		int maxPoolSize = Math.min(cpuCores * 4, 200);
+		int maxPoolSize = Math.min(cpuCores * 4, MAX_DEFAULT_POOL_SIZE);
 		logger.info("Calculated maximum pool size: {} (CPU cores: {})", maxPoolSize, cpuCores);
 		return maxPoolSize;
 	}
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/internal/node/ParallelNodeTest.java` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+/*
+ * Copyright 2024-2026 the original author or authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      https://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.alibaba.cloud.ai.graph.internal.node;
+
+import org.junit.jupiter.api.Test;
+
+import java.nio.charset.StandardCharsets;
+import java.util.concurrent.TimeUnit;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+class ParallelNodeTest {
+
+	@Test
+	void initializesWithMoreThanOneHundredProcessors() throws Exception {
+		String javaCommand = ProcessHandle.current().info().command().orElseThrow();
+		String classPath = System.getProperty("surefire.test.class.path", System.getProperty("java.class.path"));
+		Process process = new ProcessBuilder(javaCommand, "-XX:ActiveProcessorCount=128", "-cp",
+				classPath, ParallelNodeLoader.class.getName()).redirectErrorStream(true)
+				.start();
+
+		boolean exited = process.waitFor(30, TimeUnit.SECONDS);
+		if (!exited) {
+			process.destroyForcibly();
+		}
+		assertTrue(exited, "child JVM did not exit in time");
+		String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
+		assertEquals(0, process.exitValue(), output);
+	}
+
+	static class ParallelNodeLoader {
+
+		public static void main(String[] args) throws ClassNotFoundException {
+			Class.forName(ParallelNode.class.getName());
+		}
+
+	}
+
+}
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/plain_text/SpringAIJacksonStateSerializerTest.java` (modified, +6/-1)
```diff
@@ -67,6 +67,7 @@
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertArrayEquals;
+import static org.junit.jupiter.api.Assertions.assertInstanceOf;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertNull;
 import static org.junit.jupiter.api.Assertions.assertTrue;
@@ -480,7 +481,11 @@ void shouldPreserveJacksonByteArraySerialization() throws Exception {
 
 		AssistantMessage deserialized = serializeAndDeserialize(message);
 
-		assertEquals(List.of("[B", "AQID"), deserialized.getMetadata().get("payload"));
+		// Primitive-array metadata must retain its binary type. The previous
+		// List["[B", "AQID"] assertion described the serialization defect fixed by #4860.
+		Object payload = deserialized.getMetadata().get("payload");
+		assertInstanceOf(byte[].class, payload);
+		assertArrayEquals(new byte[] { 1, 2, 3 }, (byte[]) payload);
 	}
 
 	@Test
```

---

### Incident Patch 6: `94efa888` (2026-08-24)
**Commit Message**: fix(admin): preserve workflow tool callbacks (#4903)

**File**: `spring-ai-alibaba-admin/spring-ai-alibaba-admin-server-core/src/main/java/com/alibaba/cloud/ai/studio/core/agent/BasicAgentExecutor.java` (modified, +0/-1)
```diff
@@ -295,7 +295,6 @@ private ChatClient.Builder buildChatClient(AgentContext context, ToolCallingChat
 		// Add tool callbacks
 		ToolCallback[] toolCallbacks = toolCallbackProvider.getToolCallbacks();
 		if (!ArrayUtils.isEmpty(toolCallbacks)) {
-			chatOptions = chatOptions.copy();
 			chatOptions.setToolCallbacks(Arrays.stream(toolCallbacks).toList());
 		}
 
```

**File**: `spring-ai-alibaba-admin/spring-ai-alibaba-admin-server-core/src/test/java/com/alibaba/cloud/ai/studio/core/agent/BasicAgentExecutorTest.java` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+/*
+ * Copyright 2026 the original author or authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      https://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.alibaba.cloud.ai.studio.core.agent;
+
+import com.alibaba.cloud.ai.studio.core.base.manager.AppComponentManager;
+import com.alibaba.cloud.ai.studio.core.base.manager.DocumentRetrieverManager;
+import com.alibaba.cloud.ai.studio.core.base.manager.FileManager;
+import com.alibaba.cloud.ai.studio.core.base.service.McpServerService;
+import com.alibaba.cloud.ai.studio.core.base.service.PluginService;
+import com.alibaba.cloud.ai.studio.core.base.service.ToolExecutionService;
+import com.alibaba.cloud.ai.studio.core.config.CommonConfig;
+import com.alibaba.cloud.ai.studio.core.model.llm.ModelFactory;
+import com.alibaba.cloud.ai.studio.runtime.domain.agent.AgentRequest;
+import com.alibaba.cloud.ai.studio.runtime.domain.app.AgentConfig;
+
+import org.junit.jupiter.api.Test;
+import org.springframework.ai.chat.memory.ChatMemory;
+import org.springframework.ai.chat.model.ChatModel;
+import org.springframework.ai.model.tool.ToolCallingChatOptions;
+import org.springframework.ai.openai.OpenAiChatOptions;
+import org.springframework.ai.tool.ToolCallback;
+import org.springframework.ai.tool.ToolCallbackProvider;
+
+import java.lang.reflect.Method;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.when;
+
+class BasicAgentExecutorTest {
+
+	@Test
+	void buildChatClientAddsCallbacksToPromptOptions() throws Exception {
+		ModelFactory modelFactory = mock(ModelFactory.class);
+		when(modelFactory.getChatModel("dashscope")).thenReturn(mock(ChatModel.class));
+
+		BasicAgentExecutor executor = new BasicAgentExecutor(
+				mock(ToolExecutionService.class), mock(PluginService.class), mock(McpServerService.class),
+				mock(AppComponentManager.class), mock(DocumentRetrieverManager.class), mock(ChatMemory.class),
+				mock(CommonConfig.class), modelFactory, mock(FileManager.class));
+
+		AgentConfig config = new AgentConfig();
+		config.setModelProvider("dashscope");
+		AgentContext context = new AgentContext();
+		context.setConfig(config);
+		context.setRequest(new AgentRequest());
+		ToolCallback toolCallback = mock(ToolCallback.class);
+		ToolCallbackProvider toolCallbackProvider = () -> new ToolCallback[] { toolCallback };
+		ToolCallingChatOptions chatOptions = OpenAiChatOptions.builder().build();
+
+		Method buildChatClient = BasicAgentExecutor.class.getDeclaredMethod("buildChatClient", AgentContext.class,
+				ToolCallingChatOptions.class, ToolCallbackProvider.class);
+		buildChatClient.setAccessible(true);
+		buildChatClient.invoke(executor, context, chatOptions, toolCallbackProvider);
+
+		assertThat(chatOptions.getToolCallbacks()).containsExactly(toolCallback);
+	}
+
+}
```

---

### Incident Patch 7: `c65a3eb5` (2026-08-15)
**Commit Message**: fix(agent): use configured fallback after routing retries fail (#4899)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/flow/node/RoutingNode.java` (modified, +35/-2)
```diff
@@ -103,7 +103,19 @@ public MultiCommand apply(OverAllState state, RunnableConfig config) throws Exce
 		// Prepare messages with instruction if available
 		List<Message> messagesWithInstruction = prepareMessagesWithInstruction(messages);
 		
-		RoutingDecision decision = getDecisionWithRetry(messagesWithInstruction, DEFAULT_MAX_RETRIES);
+		RoutingDecision decision;
+		try {
+			decision = getDecisionWithRetry(messagesWithInstruction, DEFAULT_MAX_RETRIES);
+		}
+		catch (Exception e) {
+			MultiCommand fallbackCommand = createFallbackCommand(state, messages);
+			if (fallbackCommand != null) {
+				logger.warn("RoutingAgent {} exhausted routing retries. Routing to fallback agent {}.",
+						rootAgent.name(), fallbackCommand.gotoNodes().get(0));
+				return fallbackCommand;
+			}
+			throw e;
+		}
 		List<String> decisionValues = decision.getAgentNames();
 
 		// Validate all agent names are valid
@@ -134,6 +146,28 @@ public MultiCommand apply(OverAllState state, RunnableConfig config) throws Exce
 		}
 	}
 
+	private MultiCommand createFallbackCommand(OverAllState state, List<Message> messages) {
+		if (!(rootAgent instanceof LlmRoutingAgent llmRoutingAgent)) {
+			return null;
+		}
+
+		String fallbackAgent = llmRoutingAgent.getFallbackAgent();
+		if (!StringUtils.hasText(fallbackAgent)
+				|| subAgents.stream().noneMatch(agent -> agent.name().equals(fallbackAgent))) {
+			return null;
+		}
+
+		String fallbackInput = state.value("input").map(Object::toString).orElseGet(() -> {
+			for (int i = messages.size() - 1; i >= 0; i--) {
+				if (messages.get(i) instanceof UserMessage userMessage) {
+					return userMessage.getText();
+				}
+			}
+			return "";
+		});
+		return new MultiCommand(List.of(fallbackAgent), Map.of(fallbackAgent + "_input", fallbackInput));
+	}
+
 	/**
 	 * Prepares messages with instruction. If rootAgent has instruction, adds it as UserMessage.
 	 * Otherwise, adds a default instruction message.
@@ -296,4 +330,3 @@ public Map<String, String> getAgentQueries() {
 	public record AgentRouting(String agent, String query) {
 	}
 }
-
```

**File**: `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/flow/node/RoutingNodeTest.java` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+/*
+ * Copyright 2024-2026 the original author or authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      https://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+package com.alibaba.cloud.ai.graph.agent.flow.node;
+
+import com.alibaba.cloud.ai.graph.OverAllState;
+import com.alibaba.cloud.ai.graph.RunnableConfig;
+import com.alibaba.cloud.ai.graph.action.MultiCommand;
+import com.alibaba.cloud.ai.graph.agent.Agent;
+import com.alibaba.cloud.ai.graph.agent.flow.agent.LlmRoutingAgent;
+
+import org.junit.jupiter.api.Test;
+import org.springframework.ai.chat.messages.AssistantMessage;
+import org.springframework.ai.chat.messages.Message;
+import org.springframework.ai.chat.messages.UserMessage;
+import org.springframework.ai.chat.model.ChatModel;
+import org.springframework.ai.chat.model.ChatResponse;
+import org.springframework.ai.chat.model.Generation;
+import org.springframework.ai.chat.prompt.Prompt;
+import reactor.core.publisher.Flux;
+
+import java.util.List;
+import java.util.Map;
+import java.util.concurrent.atomic.AtomicInteger;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.when;
+
+class RoutingNodeTest {
+
+	@Test
+	void routesToConfiguredFallbackAfterInvalidDecisions() throws Exception {
+		AtomicInteger modelCalls = new AtomicInteger();
+		ChatModel chatModel = invalidRoutingModel(modelCalls);
+		Agent writerAgent = mockAgent();
+		LlmRoutingAgent routingAgent = routingAgent(chatModel, writerAgent, "writer_agent");
+		RoutingNode node = new RoutingNode(chatModel, routingAgent, List.of(writerAgent));
+		OverAllState state = new OverAllState(Map.of(
+				"input", "write a summary",
+				"messages", List.<Message>of(new UserMessage("write a summary"))));
+
+		MultiCommand command = node.apply(state, RunnableConfig.builder().build());
+
+		assertEquals(3, modelCalls.get());
+		assertEquals(List.of("writer_agent"), command.gotoNodes());
+		assertEquals("write a summary", command.update().get("writer_agent_input"));
+	}
+
+	@Test
+	void throwsAfterInvalidDecisionsWhenFallbackIsNotConfigured() {
+		ChatModel chatModel = invalidRoutingModel(new AtomicInteger());
+		Agent writerAgent = mockAgent();
+		LlmRoutingAgent routingAgent = routingAgent(chatModel, writerAgent, null);
+		RoutingNode node = new RoutingNode(chatModel, routingAgent, List.of(writerAgent));
+		OverAllState state = new OverAllState(Map.of(
+				"messages", List.<Message>of(new UserMessage("write a summary"))));
+
+		assertThrows(IllegalStateException.class,
+				() -> node.apply(state, RunnableConfig.builder().build()));
+	}
+
+	private static ChatModel invalidRoutingModel(AtomicInteger modelCalls) {
+		return new ChatModel() {
+			@Override
+			public ChatResponse call(Prompt prompt) {
+				modelCalls.incrementAndGet();
+				return new ChatResponse(List.of(new Generation(new AssistantMessage(
+						"{\"agents\":[{\"agent\":\"unknown_agent\",\"query\":\"ignored\"}]}"))));
+			}
+
+			@Override
+			public Flux<ChatResponse> stream(Prompt prompt) {
+				return Flux.just(call(prompt));
+			}
+		};
+	}
+
+	private static Agent mockAgent() {
+		Agent writerAgent = mock(Agent.class);
+		when(writerAgent.name()).thenReturn("writer_agent");
+		when(writerAgent.description()).thenReturn("Writes text");
+		return writerAgent;
+	}
+
+	private static LlmRoutingAgent routingAgent(ChatModel chatModel, Agent writerAgent, String fall
```

---

### Incident Patch 8: `7601a9fb` (2026-08-15)
**Commit Message**: fix(agent): validate WebFetchTool prompt before cache lookup and fetch (#4897)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `spring-ai-alibaba-agent-framework/src/main/java/com/alibaba/cloud/ai/graph/agent/tools/WebFetchTool.java` (modified, +4/-0)
```diff
@@ -173,6 +173,10 @@ public String apply(Request request, ToolContext toolContext) {
 			return "Error: Invalid URL format: " + e.getMessage();
 		}
 
+		if (!StringUtils.hasText(prompt)) {
+			return "Error: Prompt cannot be empty or null";
+		}
+
 		// Upgrade HTTP to HTTPS if needed
 		if (url.startsWith("http://")) {
 			url = "https://" + url.substring(7);
```

**File**: `spring-ai-alibaba-agent-framework/src/test/java/com/alibaba/cloud/ai/graph/agent/tools/WebFetchToolTest.java` (modified, +50/-0)
```diff
@@ -29,7 +29,9 @@
 import org.springframework.ai.chat.model.Generation;
 import org.springframework.ai.chat.model.ToolContext;
 import org.springframework.ai.chat.prompt.Prompt;
+import org.springframework.ai.tool.ToolCallback;
 
+import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 import static org.mockito.ArgumentMatchers.any;
@@ -85,6 +87,54 @@ void testInvalidUrlMissingSchemeReturnsError() {
 		assertTrue(result.contains("Invalid URL"));
 	}
 
+	@Test
+	void testNullPromptReturnsError() {
+		String result = webFetchTool.apply(new WebFetchTool.Request("https://localhost:1", null),
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.startsWith("Error:"));
+		assertTrue(result.contains("Prompt cannot be empty or null"));
+	}
+
+	@Test
+	void testEmptyPromptReturnsError() {
+		String result = webFetchTool.apply(new WebFetchTool.Request("https://localhost:1", ""),
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.startsWith("Error:"));
+		assertTrue(result.contains("Prompt cannot be empty or null"));
+	}
+
+	@Test
+	void testBlankPromptReturnsError() {
+		String result = webFetchTool.apply(new WebFetchTool.Request("https://localhost:1", "   "),
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.startsWith("Error:"));
+		assertTrue(result.contains("Prompt cannot be empty or null"));
+	}
+
+	@Test
+	void testToolCallbackReturnsErrorForNullPrompt() {
+		ToolCallback toolCallback = WebFetchTool.builder(ChatClient.builder(mock(ChatModel.class)).build()).build();
+		String result = toolCallback.call("{\"url\":\"https://localhost:1\",\"prompt\":null}",
+				new ToolContext(Collections.emptyMap()));
+		assertTrue(result.contains("Error: Prompt cannot be empty or null"));
+	}
+
+	@Test
+	@SuppressWarnings("unchecked")
+	void testValidPromptUsesCache() throws Exception {
+		String url = "https://example.com";
+		String prompt = "Summarize";
+		String expected = "Cached summary";
+		Field cacheField = WebFetchTool.class.getDeclaredField("urlCache");
+		cacheField.setAccessible(true);
+		Cache<String, String> cache = (Cache<String, String>) cacheField.get(webFetchTool);
+		cache.put(url + "::prompt::" + prompt.hashCode(), expected);
+
+		String result = webFetchTool.apply(new WebFetchTool.Request(url, prompt),
+				new ToolContext(Collections.emptyMap()));
+		assertEquals(expected, result);
+	}
+
 	@Test
 	@SuppressWarnings("unchecked")
 	void testCacheRespectsMaxCacheSize() throws Exception {
```

---

### Incident Patch 9: `ab14413c` (2026-08-15)
**Commit Message**: fix(graph): serialize map-shaped DashScope search metadata (#4846)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/AgentInstructionMessageHandler.java` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ public void serializeWithType(AgentInstructionMessage msg, JsonGenerator gen, Se
 		private void serializeFields(AgentInstructionMessage msg, JsonGenerator gen, SerializerProvider provider) throws IOException {
 			gen.writeStringField(Field.TEXT.name, msg.getText());
 			gen.writeBooleanField(Field.RENDERED.name, msg.isRendered());
-			serializeMetadata(gen, msg.getMetadata());
+			serializeMetadata(gen, provider, msg.getMetadata());
 		}
 	}
 
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/AssistantMessageHandler.java` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ private void serializeFields(AssistantMessage msg, JsonGenerator gen, Serializer
 		}
 		gen.writeEndArray();
 
-		serializeMetadata(gen, msg.getMetadata());
+		serializeMetadata(gen, provider, msg.getMetadata());
 
 		// gen.writeArrayFieldStart( Property.MEDIA.field);
 		// for (var media : msg.getMedia()) {
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/DeepSeekAssistantMessageHandler.java` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ private void serializeFields(DeepSeekAssistantMessage msg, JsonGenerator gen, Se
 			}
 
 			java.util.Map<String, Object> metadata = msg.getMetadata();
-			serializeMetadata(gen, metadata);
+			serializeMetadata(gen, provider, metadata);
 		}
 
 	}
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/DocumentHandler.java` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ private void serializeFields(Document document, JsonGenerator gen, SerializerPro
 			if (document.getScore() != null) {
 				gen.writeNumberField(Field.SCORE.name, document.getScore());
 			}
-			serializeMetadata(gen, document.getMetadata());
+			serializeMetadata(gen, provider, document.getMetadata());
 		}
 	}
 
```

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/serializer/plain_text/jackson/SerializationHelper.java` (modified, +436/-2)
```diff
@@ -16,13 +16,44 @@
 package com.alibaba.cloud.ai.graph.serializer.plain_text.jackson;
 
 import java.io.IOException;
+import java.lang.annotation.Annotation;
+import java.lang.reflect.Array;
+import java.util.ArrayList;
+import java.util.Collection;
+import java.util.LinkedHashMap;
+import java.util.List;
 import java.util.Map;
+import java.util.Objects;
 
+import com.fasterxml.jackson.annotation.JsonInclude;
+import com.fasterxml.jackson.annotation.JsonIgnore;
+import com.fasterxml.jackson.annotation.JsonFormat;
+import com.fasterxml.jackson.annotation.JsonProperty;
 import com.fasterxml.jackson.core.JsonGenerator;
+import com.fasterxml.jackson.core.JsonParser;
 import com.fasterxml.jackson.core.JsonProcessingException;
+import com.fasterxml.jackson.core.ObjectCodec;
 import com.fasterxml.jackson.core.type.TypeReference;
 import com.fasterxml.jackson.databind.JsonNode;
+import com.fasterxml.jackson.databind.JavaType;
+import com.fasterxml.jackson.databind.MapperFeature;
 import com.fasterxml.jackson.databind.ObjectMapper;
+import com.fasterxml.jackson.databind.SerializerProvider;
+import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
+import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
+import com.fasterxml.jackson.databind.ser.PropertyWriter;
+import com.fasterxml.jackson.databind.ser.BeanPropertyWriter;
+import com.fasterxml.jackson.databind.ser.impl.IndexedListSerializer;
+import com.fasterxml.jackson.databind.ser.impl.IndexedStringListSerializer;
+import com.fasterxml.jackson.databind.ser.impl.StringArraySerializer;
+import com.fasterxml.jackson.databind.ser.impl.StringCollectionSerializer;
+import com.fasterxml.jackson.databind.ser.std.AsArraySerializerBase;
+import com.fasterxml.jackson.databind.ser.std.BeanSerializerBase;
+import com.fasterxml.jackson.databind.ser.std.CollectionSerializer;
+import com.fasterxml.jackson.databind.ser.std.MapSerializer;
+import com.fasterxml.jackson.databind.ser.std.ObjectArraySerializer;
+import com.fasterxml.jackson.databind.util.BeanUtil;
+import com.fasterxml.jackson.databind.util.TokenBuffer;
 
 class SerializationHelper {
 
@@ -46,8 +77,411 @@ static Map<String, Object> deserializeMetadata(ObjectMapper mapper, JsonNode par
 		});
 	}
 
-	static void serializeMetadata(JsonGenerator gen, Map<String, Object> metadata) throws IOException {
-		gen.writeObjectField(METADATA_FIELD, metadata);
+	static void serializeMetadata(JsonGenerator gen, SerializerProvider provider, Map<String, Object> metadata)
+			throws IOException {
+		gen.writeObjectField(METADATA_FIELD, normalizeMetadataValue(provider, metadata));
+	}
+
+	private static Object normalizeMetadataValue(SerializerProvider provider, Object value) throws IOException {
+		return normalizeMetadataValue(provider, value, JsonInclude.Include.ALWAYS);
+	}
+
+	private static Object normalizeMetadataValue(SerializerProvider provider, Object value,
+			JsonInclude.Include contentInclusion) throws IOException {
+		if (value instanceof Map<?, ?> map) {
+			boolean preserveContainer = hasClassSerializationOverrides(provider, map.getClass());
+			Object serializer = provider.findValueSerializer(map.getClass());
+			if (!isStandardMapSerializer(serializer)
+					|| preserveContainer && hasAssignedMapContentSerializer(serializer)) {
+				return map;
+			}
+			boolean incompatible = hasIncompatibleContainerValue(
+					provider.constructType(map.getClass()), map);
+			Map<Object, Object> normalized = new LinkedHashMap<>(map.size());
+			boolean changed = false;
+			for (Map.Entry<?, ?> entry : map.entrySet()) {
+				if (shouldInclude(provider, contentInclusion, entry.getValue())) {
+					Object normalizedValue = normalizeMetadataValue(provider, entry.getValue());
+					normalized.put(entry.getKey(), normalizedValue);
+					changed |= normalizedValue != entry.getValue();
+				}
+				else {
+					changed = true;
+				}
+			}
+			return preserveContainer && !incompatible
+					? preserveMapType(provider, map, normalized
```

---

### Incident Patch 10: `9bb2d4b5` (2026-08-15)
**Commit Message**: fix(graph): make PostgresSaver latest checkpoint deterministic (#4753)

Co-authored-by: shown <yuluo08290126@gmail.com>

**File**: `spring-ai-alibaba-graph-core/src/main/java/com/alibaba/cloud/ai/graph/checkpoint/savers/postgresql/PostgresSaver.java` (modified, +34/-3)
```diff
@@ -64,6 +64,7 @@
  *          ON GraphThread(thread_name) WHERE is_released = FALSE
  *
  *     CREATE TABLE GraphCheckpoint (
+ *          checkpoint_seq BIGSERIAL UNIQUE,
  *          checkpoint_id UUID PRIMARY KEY,
  *          parent_checkpoint_id UUID,
  *          thread_id UUID NOT NULL,
@@ -119,6 +120,7 @@ thread_name VARCHAR(255),
 			 );
 
 			 CREATE TABLE IF NOT EXISTS GraphCheckpoint (
+			     checkpoint_seq BIGSERIAL UNIQUE,
 			     checkpoint_id UUID PRIMARY KEY,
 			     parent_checkpoint_id UUID,
 			     thread_id UUID NOT NULL,
@@ -137,10 +139,22 @@ REFERENCES GraphThread(thread_id)
 
 	private static final String CREATE_INDEXES = """
 			CREATE INDEX IF NOT EXISTS idx_lg4jcheckpoint_thread_id ON GraphCheckpoint(thread_id);
-			CREATE INDEX IF NOT EXISTS idx_lg4jcheckpoint_thread_id_saved_at_desc ON GraphCheckpoint(thread_id, saved_at DESC);
+			CREATE INDEX IF NOT EXISTS idx_lg4jcheckpoint_thread_id_sequence ON GraphCheckpoint(thread_id, checkpoint_seq DESC);
 			CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_lg4jthread_thread_name_unreleased ON GraphThread(thread_name) WHERE is_released = FALSE;
 			""";
 
+	private static final String ADD_CHECKPOINT_SEQUENCE_COLUMN = """
+			ALTER TABLE GraphCheckpoint
+			ADD COLUMN checkpoint_seq BIGSERIAL UNIQUE
+			""";
+
+	private static final String HAS_CHECKPOINT_SEQUENCE_COLUMN = """
+			SELECT 1
+			FROM information_schema.columns
+			WHERE table_name = 'graphcheckpoint'
+			  AND column_name = 'checkpoint_seq'
+			""";
+
 	// DML statements
 	private static final String UPSERT_THREAD = """
 			WITH inserted AS (
@@ -194,7 +208,7 @@ INSERT INTO GraphCheckpoint(
 			FROM GraphCheckpoint c
 			  JOIN GraphThread t ON c.thread_id = t.thread_id
 			WHERE t.thread_name = ? AND t.is_released = FALSE
-			ORDER BY c.saved_at DESC
+			ORDER BY c.checkpoint_seq DESC
 			""";
 
 	private static final String SELECT_LATEST_CHECKPOINT = """
@@ -207,7 +221,7 @@ INSERT INTO GraphCheckpoint(
 			FROM GraphCheckpoint c
 			  JOIN GraphThread t ON c.thread_id = t.thread_id
 			WHERE t.thread_name = ? AND t.is_released = FALSE
-			ORDER BY c.saved_at DESC
+			ORDER BY c.checkpoint_seq DESC
 			LIMIT 1
 			""";
 
@@ -338,6 +352,10 @@ protected void initTable(CreateOption createOption) throws SQLException {
 				sqlCommand = CREATE_TABLES;
 				statement.executeUpdate(sqlCommand);
 
+				log.trace("Ensuring checkpoint sequence column exists");
+				sqlCommand = ADD_CHECKPOINT_SEQUENCE_COLUMN;
+				ensureCheckpointSequenceColumn(connection);
+
 				log.trace("Executing create indexes:\n---\n{}---", CREATE_INDEXES);
 				sqlCommand = CREATE_INDEXES;
 				statement.executeUpdate(sqlCommand);
@@ -349,6 +367,19 @@ protected void initTable(CreateOption createOption) throws SQLException {
 		}
 	}
 
+	private void ensureCheckpointSequenceColumn(Connection connection) throws SQLException {
+		try (Statement statement = connection.createStatement();
+				ResultSet resultSet = statement.executeQuery(HAS_CHECKPOINT_SEQUENCE_COLUMN)) {
+			if (resultSet.next()) {
+				return;
+			}
+		}
+
+		try (Statement statement = connection.createStatement()) {
+			statement.execute(ADD_CHECKPOINT_SEQUENCE_COLUMN);
+		}
+	}
+
 	private Checkpoint readCheckpoint(ResultSet resultSet)
 			throws SQLException, IOException, ClassNotFoundException {
 		return Checkpoint.builder()
```

**File**: `spring-ai-alibaba-graph-core/src/test/java/com/alibaba/cloud/ai/graph/checkpoint/savers/PostgresSaverTest.java` (modified, +59/-3)
```diff
@@ -36,6 +36,7 @@
 import java.lang.reflect.InvocationTargetException;
 import java.lang.reflect.Proxy;
 import java.sql.Connection;
+import java.sql.PreparedStatement;
 import java.sql.SQLException;
 import java.sql.SQLFeatureNotSupportedException;
 import java.util.Collection;
@@ -145,11 +146,66 @@ private static RunnableConfig config(String threadId, String checkpointId) {
     }
 
     private static Checkpoint checkpoint(String value) {
-        return Checkpoint.builder()
+        return checkpoint(null, value);
+    }
+
+    private static Checkpoint checkpoint(String id, String value) {
+        Checkpoint.Builder builder = Checkpoint.builder()
                 .nodeId("agent_1")
                 .nextNodeId(END)
-                .state(Map.of("value", value))
+                .state(Map.of("value", value));
+        if (id != null) {
+            builder.id(id);
+        }
+        return builder.build();
+    }
+
+    private static void forceSameSavedAt(String threadId) throws SQLException {
+        try (Connection connection = dataSource().getConnection();
+                PreparedStatement statement = connection.prepareStatement("""
+                        UPDATE GraphCheckpoint c
+                        SET saved_at = TIMESTAMPTZ '2026-01-01 00:00:00+00'
+                        FROM GraphThread t
+                        WHERE c.thread_id = t.thread_id
+                          AND t.thread_name = ? AND t.is_released = FALSE
+                        """)) {
+            statement.setString(1, threadId);
+            assertEquals(2, statement.executeUpdate());
+        }
+    }
+
+    private static String firstCheckpointId() {
+        return "00000000-0000-0000-0000-000000000001";
+    }
+
+    private static String secondCheckpointId() {
+        return "00000000-0000-0000-0000-000000000002";
+    }
+
+    @Test
+    public void testPostgresSaverOrdersCheckpointsByInsertSequenceWhenSavedAtTies() throws Exception {
+        var saver = PostgresSaver.builder()
+                .datasource(dataSource())
+                .stateSerializer(serializer)
+                .createOption(CreateOption.CREATE_OR_REPLACE)
+                .maxCachedThreads(0)
                 .build();
+
+        String threadId = "postgres-checkpoint-sequence-thread";
+        var firstCheckpoint = checkpoint(firstCheckpointId(), "first");
+        var secondCheckpoint = checkpoint(secondCheckpointId(), "second");
+
+        saver.put(config(threadId), firstCheckpoint);
+        saver.put(config(threadId), secondCheckpoint);
+        forceSameSavedAt(threadId);
+
+        Collection<Checkpoint> history = saver.list(config(threadId));
+        assertEquals(2, history.size());
+        assertEquals(secondCheckpoint.getId(), history.iterator().next().getId());
+
+        var latest = saver.get(config(threadId));
+        assertTrue(latest.isPresent());
+        assertEquals(secondCheckpoint.getId(), latest.get().getId());
     }
 
     @Test
@@ -697,7 +753,7 @@ private void countQuery(java.lang.reflect.Method method, Object[] args) {
                     || !(args[0] instanceof String sql)) {
                 return;
             }
-            if (sql.contains("ORDER BY c.saved_at DESC") && sql.contains("LIMIT 1")) {
+            if (sql.contains("ORDER BY c.checkpoint_seq DESC") && sql.contains("LIMIT 1")) {
                 latestCheckpointSelects.incrementAndGet();
             }
             if (sql.contains("AND c.checkpoint_id = ?")) {
```

#### Recent Merged Pull Requests:
- **PR #4940** (closed): fix(agent): resolve skill tools after HITL resume (@dangzitou)
- **PR #4938** (closed): fix(agent): use object schemas for filesystem tools (@logicwu0)
- **PR #4933** (closed): fix(admin): add missing ThreadPoolExecutor import in RequestContextThreadPoolWrapper (@GerardGao)
- **PR #4930** (closed): fix(agent): pass groupedTools map to interceptor even when initially empty (@ikaitist)
- **PR #4926** (2026-08-25): test(graph): pin List<byte[]> element types across serializer round-trip (@zeng-bohan)
- **PR #4925** (2026-08-25): fix(graph): preserve streaming node id in error callbacks (@aravelo7)
- **PR #4922** (2026-08-24): feat(agent): support Supplier-based grouped tools for dynamic skill registries (@ikaitist)
- **PR #4918** (2026-08-24): test(graph): migrate AssignerNodeTest to JUnit 5 so its tests actually run (@GerardGao)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
