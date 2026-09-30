# Forensic Learning Record (Deep Inspection): xinnan-tech/xiaozhi-esp32-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/xinnan-tech-xiaozhi-esp32-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:36:46.760Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xinnan-tech/xiaozhi-esp32-server`
- **Description**: 本项目为xiaozhi-esp32提供后端服务，帮助您快速搭建ESP32设备控制服务器。Backend service for xiaozhi-esp32, helps you quickly build an ESP32 device control server.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10716 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `main/digital-human/js/app.js`
```
// 主应用入口
import { checkOpusLoaded, initOpusEncoder } from './core/audio/opus-codec.js?v=0205';
import { getAudioPlayer } from './core/audio/player.js?v=0205';
import { checkMicrophoneAvailability, isHttpNonLocalhost } from './core/audio/recorder.js?v=0205';
import { initMcpTools } from './core/mcp/tools.js?v=0205';
import { startWakewordBridgeListener } from './core/network/wakeword-bridge.js?v=0205';
import { uiController } from './ui/controller.js?v=0205';
import { log } from './utils/logger.js?v=0205';

// 辅助函数：将Base64数据转换为Blob
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

// 应用类
class App {
    constructor() {
        this.uiController = null;
        this.audioPlayer = null;
        this.live2dManager = null;
        this.cameraStream = null;
        this.currentFacingMode = 'user';
    }

    // 初始化应用
    async init() {
        log('正在初始化应用...', 'info');
        // 初始化UI控制器
        this.uiController = uiController;
        this.uiController.init();
        // 检查Opus库
        checkOpusLoaded();
        // 初始化Opus编码器
        initOpusEncoder();
        // 初始化音频播放器
        this.audioPlayer = getAudioPlayer();
        await this.audioPlayer.start();
        // 初始化MCP工具
        initMcpTools();
        // 初始化本地唤醒事件监听
        startWakewordBridgeListener();
        // 检查麦克风可用性
        await this.checkMicrophoneAvailability();
        // 检查摄像头可用性
        this.checkCameraAvailability();
        // 初始化Live2D
        await this.initLive2D();
        // 初始化摄像头
        this.initCamera();
        // 关闭加载loading
        this.setModelLoadingStatus(false);
        log('应用初始化完成', 'success');
    }

    // 初始化Live2D
    async initLive2D() {
        try {
            // 检查Live2DManager是否已加载
            if (typeof window.Live2DManager === 'undefined') {
                throw new Error('Live2DManager未加载，请检查脚本引入顺序');
            }
            this.live2dManager = new window.Live2DManager();
            await this.live2dManager.initializeLive2D();
            // 更新UI状态
            const live2dStatus = document.getElementById('live2dStatus');
            if (live2dStatus) {
                live2dStatus.textContent = '● 已加载';
                live2dStatus.className = 'status loaded';
            }
            log('Live2D初始化完成', 'success');
        } catch (error) {
            log(`Live2D初始化失败: ${error.message}`, 'error');
            // 更新UI状态
            const live2dStatus = document.getElementById('live2dStatus');
            if (live2dStatus) {
                live2dStatus.textContent = '● 加载失败';
                live2dStatus.className = 'status error';
            }
        }
    }

    // 设置model加载状态
    setModelLoadingStatus(isLoading) {
        const modelLoading = document.getElementById('modelLoading');
        if (modelLoading) {
            modelLoading.style.display = isLoading ? 'flex' : 'none';
        }
    }

    /**
     * 检查麦克风可用性
     * 在应用初始化时调用，检查麦克风是否可用并更新UI状态
     */
    async checkMicrophoneAvailability() {
        try {
            const isAvailable = await checkMicrophoneAvailability();
            const isHttp = isHttpNonLocalhost();
            // 保存可用性状态到全局变量
            window.microphoneAvailable = isAvailable;
            window.isHttpNonLocalhost = isHttp;
            // 更新UI
            if (this.uiController) {
                this.uiController.updateMicrophoneAvailability(isAvailable, isHttp);
            }
            log(`麦克风可用性检查完成: ${isAvailable ? '可用' : '不可用'}`, isAvailable ? 'success' : 'warning');
        } catch (error) {
            log(`检查麦克风可用性失败: ${error.message}`, 'error');
            // 默认设置为不可用
            window.microphoneAvailable = false;
            window.isHttpNonLocalhost = isHttpNonLocalhost();
            if (this.uiController) {
                this.uiController.updateMicrophoneAvailability(false, window.isHttpNonLocalhost);
            }
        }
    }

    // 检查摄像头可用性
    checkCameraAvailability() {
        window.cameraAvailable = true;
        log('摄像头可用性检查完成: 默认已绑定验证码', 'success');
    }

    // 初始化摄像头
    async initCamera() {
        const cameraContainer = document.getElementById('cameraContainer');
        const cameraVideo = document.getElementById('cameraVideo');
        const cameraSwitch = document.getElementById('cameraSwitch');
        const cameraSwitchMask = document.getElementById('cameraSwitchMask');
        const dialBtn = document.getElementById('dialBtn');

        if (!cameraContainer || !cameraVideo) {
            log('摄像头元素未找到，跳过初始化', 'warning');
            return Promise.resolve(false);
        }

        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        cameraContainer.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        cameraContainer.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd);

        function dragStart(e) {
            if (e.type === 'touchstart') {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            isDragging = true;
            cameraContainer.classList.add('dragging');
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                if (e.type === 'touchmove') {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                xOffset = currentX;
                yOffset = currentY;
                cameraContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        }

        function dragEnd() {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            cameraContainer.classList.remove('dragging');
        }

        return new Promise((resolve) => {
            window.startCamera = async () => {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        log('浏览器不支持摄像头API', 'warning');
                        return false;
                    }
                    log('正在请求摄像头权限...', 'info');
                    this.cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 180, height: 240, facingMode: this.currentFacingMode },
                        audio: false
                    });
                    cameraVideo.srcObject = this.cameraStream;
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(device => device.kind === 'videoinput');
                    if (videoDevices.length > 1) {
                        if (cameraSwitch) cameraSwitch.classList.add('active'); 
                    }
                    cameraContainer.classList.add('active');

                    // 切换时挂断情况
                    const hasActive = dialBtn.classList.contains('dial-active');
                    if (!hasActive) {
                        cameraContainer.classList.remove('active');
                        cameraSwitch.classList.remove('active');
         
```

### Core Architecture Module: `main/digital-human/js/config/manager.js`
```
// 配置管理模块

// 默认唤醒词列表
export const DEFAULT_WAKE_WORDS = '你好小智\n你好小志\n小爱同学\n你好小鑫\n你好小新\n小美同学\n小龙小龙\n喵喵同学\n小滨小滨\n小冰小冰\n嘿你好呀';

// 生成随机MAC地址
function generateRandomMac() {
    const hexDigits = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
        if (i > 0) mac += ':';
        for (let j = 0; j < 2; j++) {
            mac += hexDigits.charAt(Math.floor(Math.random() * 16));
        }
    }
    return mac;
}

// 加载配置
export function loadConfig() {
    const deviceMacInput = document.getElementById('deviceMac');
    const deviceNameInput = document.getElementById('deviceName');
    const clientIdInput = document.getElementById('clientId');
    const otaUrlInput = document.getElementById('otaUrl');
    const wakewordWsUrlInput = document.getElementById('wakewordWsUrl');
    const wakewordEnabledInput = document.getElementById('wakewordEnabled');
    const wakewordListInput = document.getElementById('wakewordList');

    // 从localStorage加载MAC地址，如果没有则生成新的
    let savedMac = localStorage.getItem('xz_tester_deviceMac');
    if (!savedMac) {
        savedMac = generateRandomMac();
        localStorage.setItem('xz_tester_deviceMac', savedMac);
    }
    deviceMacInput.value = savedMac;

    // 从localStorage加载其他配置
    const savedDeviceName = localStorage.getItem('xz_tester_deviceName');
    if (savedDeviceName) {
        deviceNameInput.value = savedDeviceName;
    }

    const savedClientId = localStorage.getItem('xz_tester_clientId');
    if (savedClientId) {
        clientIdInput.value = savedClientId;
    }

    const savedOtaUrl = localStorage.getItem('xz_tester_otaUrl');
    if (savedOtaUrl) {
        otaUrlInput.value = savedOtaUrl;
    }

    const savedWakewordWsUrl = localStorage.getItem('xz_tester_wakewordWsUrl');
    if (savedWakewordWsUrl !== null && wakewordWsUrlInput) {
        wakewordWsUrlInput.value = savedWakewordWsUrl;
    }

    const savedWakewordEnabled = localStorage.getItem('xz_tester_wakewordEnabled');
    if (savedWakewordEnabled !== null && wakewordEnabledInput) {
        wakewordEnabledInput.value = savedWakewordEnabled;
    }

    const savedWakewordList = localStorage.getItem('xz_tester_wakewordList');
    if (savedWakewordList !== null && wakewordListInput) {
        wakewordListInput.value = savedWakewordList;
    } else if (wakewordListInput) {
        wakewordListInput.value = DEFAULT_WAKE_WORDS;
    }

    const emojiEnabledInput = document.getElementById('emojiEnabled');
    const savedEmojiEnabled = localStorage.getItem('xz_tester_emojiEnabled');
    if (savedEmojiEnabled !== null && emojiEnabledInput) {
        emojiEnabledInput.value = savedEmojiEnabled;
    }
}

// 保存配置
export function saveConfig() {
    const deviceMacInput = document.getElementById('deviceMac');
    const deviceNameInput = document.getElementById('deviceName');
    const clientIdInput = document.getElementById('clientId');
    const wakewordWsUrlInput = document.getElementById('wakewordWsUrl');
    const wakewordEnabledInput = document.getElementById('wakewordEnabled');
    const wakewordListInput = document.getElementById('wakewordList');

    localStorage.setItem('xz_tester_deviceMac', deviceMacInput.value);
    localStorage.setItem('xz_tester_deviceName', deviceNameInput.value);
    localStorage.setItem('xz_tester_clientId', clientIdInput.value);
    const emojiEnabledInput = document.getElementById('emojiEnabled');
    if (emojiEnabledInput) {
        localStorage.setItem('xz_tester_emojiEnabled', emojiEnabledInput.value);
    }
    if (wakewordEnabledInput) {
        localStorage.setItem('xz_tester_wakewordEnabled', wakewordEnabledInput.value);
    }
    if (wakewordListInput) {
        localStorage.setItem('xz_tester_wakewordList', wakewordListInput.value);
    }
    if (wakewordWsUrlInput && wakewordWsUrlInput.value.trim()) {
        localStorage.setItem('xz_tester_wakewordWsUrl', wakewordWsUrlInput.value.trim());
    }
}

// 获取配置值
export function getConfig() {
    // 从DOM获取值
    const deviceMac = document.getElementById('deviceMac')?.value.trim() || '';
    const deviceName = document.getElementById('deviceName')?.value.trim() || '';
    const clientId = document.getElementById('clientId')?.value.trim() || '';
    const emojiEnabled = document.getElementById('emojiEnabled')?.value !== 'false';

    return {
        deviceId: deviceMac,  // 使用MAC地址作为deviceId
        deviceName,
        deviceMac,
        clientId,
        emojiEnabled
    };
}

// 保存连接URL
export function saveConnectionUrls() {
    const otaUrl = document.getElementById('otaUrl').value.trim();
    const wsUrl = document.getElementById('serverUrl').value.trim();
    localStorage.setItem('xz_tester_otaUrl', otaUrl);
    localStorage.setItem('xz_tester_wsUrl', wsUrl);
}

```

### Core Architecture Module: `main/digital-human/js/core/audio/opus-codec.js`
```
import { log } from '../../utils/logger.js?v=0205';


// 检查Opus库是否已加载
export function checkOpusLoaded() {
    try {
        // 检查Module是否存在（本地库导出的全局变量）
        if (typeof Module === 'undefined') {
            throw new Error('Opus库未加载，Module对象不存在');
        }

        // 尝试先使用Module.instance（libopus.js最后一行导出方式）
        if (typeof Module.instance !== 'undefined' && typeof Module.instance._opus_decoder_get_size === 'function') {
            // 使用Module.instance对象替换全局Module对象
            window.ModuleInstance = Module.instance;
            log('Opus库加载成功（使用Module.instance）', 'success');

            // 3秒后隐藏状态
            const statusElement = document.getElementById('scriptStatus');
            if (statusElement) statusElement.style.display = 'none';
            return;
        }

        // 如果没有Module.instance，检查全局Module函数
        if (typeof Module._opus_decoder_get_size === 'function') {
            window.ModuleInstance = Module;
            log('Opus库加载成功（使用全局Module）', 'success');

            // 3秒后隐藏状态
            const statusElement = document.getElementById('scriptStatus');
            if (statusElement) statusElement.style.display = 'none';
            return;
        }

        throw new Error('Opus解码函数未找到，可能Module结构不正确');
    } catch (err) {
        log(`Opus库加载失败，请检查libopus.js文件是否存在且正确: ${err.message}`, 'error');
    }
}


// 创建一个Opus编码器
let opusEncoder = null;
export function initOpusEncoder() {
    try {
        if (opusEncoder) {
            return opusEncoder; // 已经初始化过
        }

        if (!window.ModuleInstance) {
            log('无法创建Opus编码器：ModuleInstance不可用', 'error');
            return;
        }

        // 初始化一个Opus编码器
        const mod = window.ModuleInstance;
        const sampleRate = 16000; // 16kHz采样率
        const channels = 1;       // 单声道
        const application = 2048; // OPUS_APPLICATION_VOIP = 2048

        // 创建编码器
        opusEncoder = {
            channels: channels,
            sampleRate: sampleRate,
            frameSize: 960, // 60ms @ 16kHz = 60 * 16 = 960 samples
            maxPacketSize: 4000, // 最大包大小
            module: mod,

            // 初始化编码器
            init: function () {
                try {
                    // 获取编码器大小
                    const encoderSize = mod._opus_encoder_get_size(this.channels);
                    log(`Opus编码器大小: ${encoderSize}字节`, 'info');

                    // 分配内存
                    this.encoderPtr = mod._malloc(encoderSize);
                    if (!this.encoderPtr) {
                        throw new Error("无法分配编码器内存");
                    }

                    // 初始化编码器
                    const err = mod._opus_encoder_init(
                        this.encoderPtr,
                        this.sampleRate,
                        this.channels,
                        application
                    );

                    if (err < 0) {
                        throw new Error(`Opus编码器初始化失败: ${err}`);
                    }

                    // 设置位率 (16kbps)
                    mod._opus_encoder_ctl(this.encoderPtr, 4002, 16000); // OPUS_SET_BITRATE

                    // 设置复杂度 (0-10, 越高质量越好但CPU使用越多)
                    mod._opus_encoder_ctl(this.encoderPtr, 4010, 5);     // OPUS_SET_COMPLEXITY

                    // 设置使用DTX (不传输静音帧)
                    mod._opus_encoder_ctl(this.encoderPtr, 4016, 1);     // OPUS_SET_DTX

                    log("Opus编码器初始化成功", 'success');
                    return true;
                } catch (error) {
                    if (this.encoderPtr) {
                        mod._free(this.encoderPtr);
                        this.encoderPtr = null;
                    }
                    log(`Opus编码器初始化失败: ${error.message}`, 'error');
                    return false;
                }
            },

            // 编码PCM数据为Opus
            encode: function (pcmData) {
                if (!this.encoderPtr) {
                    if (!this.init()) {
                        return null;
                    }
                }

                try {
                    const mod = this.module;

                    // 为PCM数据分配内存
                    const pcmPtr = mod._malloc(pcmData.length * 2); // 2字节/int16

                    // 将PCM数据复制到HEAP
                    for (let i = 0; i < pcmData.length; i++) {
                        mod.HEAP16[(pcmPtr >> 1) + i] = pcmData[i];
                    }

                    // 为输出分配内存
                    const outPtr = mod._malloc(this.maxPacketSize);

                    // 进行编码
                    const encodedLen = mod._opus_encode(
                        this.encoderPtr,
                        pcmPtr,
                        this.frameSize,
                        outPtr,
                        this.maxPacketSize
                    );

                    if (encodedLen < 0) {
                        throw new Error(`Opus编码失败: ${encodedLen}`);
                    }

                    // 复制编码后的数据
                    const opusData = new Uint8Array(encodedLen);
                    for (let i = 0; i < encodedLen; i++) {
                        opusData[i] = mod.HEAPU8[outPtr + i];
                    }

                    // 释放内存
                    mod._free(pcmPtr);
                    mod._free(outPtr);

                    return opusData;
                } catch (error) {
                    log(`Opus编码出错: ${error.message}`, 'error');
                    return null;
                }
            },

            // 销毁编码器
            destroy: function () {
                if (this.encoderPtr) {
                    this.module._free(this.encoderPtr);
                    this.encoderPtr = null;
                }
            }
        };

        opusEncoder.init();
        return opusEncoder;
    } catch (error) {
        log(`创建Opus编码器失败: ${error.message}`, 'error');
        return false;
    }
}
```

### Core Architecture Module: `main/digital-human/js/core/audio/player.js`
```
// 音频播放模块
import BlockingQueue from '../../utils/blocking-queue.js?v=0205';
import { log } from '../../utils/logger.js?v=0205';
import { createStreamingContext } from './stream-context.js?v=0205';

// 音频播放器类
export class AudioPlayer {
    constructor() {
        // 音频参数
        this.SAMPLE_RATE = 16000;
        this.CHANNELS = 1;
        this.FRAME_SIZE = 960;
        this.MIN_AUDIO_DURATION = 0.12;

        // 状态
        this.audioContext = null;
        this.opusDecoder = null;
        this.streamingContext = null;
        this.queue = new BlockingQueue();
        this.isPlaying = false;
    }

    // 获取或创建AudioContext
    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.SAMPLE_RATE,
                latencyHint: 'interactive'
            });
            log('创建音频上下文，采样率: ' + this.SAMPLE_RATE + 'Hz', 'debug');
        }
        return this.audioContext;
    }

    // 初始化Opus解码器
    async initOpusDecoder() {
        if (this.opusDecoder) return this.opusDecoder;

        try {
            if (typeof window.ModuleInstance === 'undefined') {
                if (typeof Module !== 'undefined') {
                    window.ModuleInstance = Module;
                    log('使用全局Module作为ModuleInstance', 'info');
                } else {
                    throw new Error('Opus库未加载，ModuleInstance和Module对象都不存在');
                }
            }

            const mod = window.ModuleInstance;

            this.opusDecoder = {
                channels: this.CHANNELS,
                rate: this.SAMPLE_RATE,
                frameSize: this.FRAME_SIZE,
                module: mod,
                decoderPtr: null,

                init: function () {
                    if (this.decoderPtr) return true;

                    const decoderSize = mod._opus_decoder_get_size(this.channels);
                    log(`Opus解码器大小: ${decoderSize}字节`, 'debug');

                    this.decoderPtr = mod._malloc(decoderSize);
                    if (!this.decoderPtr) {
                        throw new Error("无法分配解码器内存");
                    }

                    const err = mod._opus_decoder_init(
                        this.decoderPtr,
                        this.rate,
                        this.channels
                    );

                    if (err < 0) {
                        this.destroy();
                        throw new Error(`Opus解码器初始化失败: ${err}`);
                    }

                    log("Opus解码器初始化成功", 'success');
                    return true;
                },

                decode: function (opusData) {
                    if (!this.decoderPtr) {
                        if (!this.init()) {
                            throw new Error("解码器未初始化且无法初始化");
                        }
                    }

                    try {
                        const mod = this.module;

                        const opusPtr = mod._malloc(opusData.length);
                        mod.HEAPU8.set(opusData, opusPtr);

                        const pcmPtr = mod._malloc(this.frameSize * 2);

                        const decodedSamples = mod._opus_decode(
                            this.decoderPtr,
                            opusPtr,
                            opusData.length,
                            pcmPtr,
                            this.frameSize,
                            0
                        );

                        if (decodedSamples < 0) {
                            mod._free(opusPtr);
                            mod._free(pcmPtr);
                            throw new Error(`Opus解码失败: ${decodedSamples}`);
                        }

                        const decodedData = new Int16Array(decodedSamples);
                        for (let i = 0; i < decodedSamples; i++) {
                            decodedData[i] = mod.HEAP16[(pcmPtr >> 1) + i];
                        }

                        mod._free(opusPtr);
                        mod._free(pcmPtr);

                        return decodedData;
                    } catch (error) {
                        log(`Opus解码错误: ${error.message}`, 'error');
                        return new Int16Array(0);
                    }
                },

                destroy: function () {
                    if (this.decoderPtr) {
                        this.module._free(this.decoderPtr);
                        this.decoderPtr = null;
                    }
                }
            };

            if (!this.opusDecoder.init()) {
                throw new Error("Opus解码器初始化失败");
            }

            return this.opusDecoder;

        } catch (error) {
            log(`Opus解码器初始化失败: ${error.message}`, 'error');
            this.opusDecoder = null;
            throw error;
        }
    }

    // 启动音频缓冲
    async startAudioBuffering() {
        log("开始音频缓冲...", 'info');

        this.initOpusDecoder().catch(error => {
            log(`预初始化Opus解码器失败: ${error.message}`, 'warning');
        });

        const timeout = 400;
        while (true) {
            const packets = await this.queue.dequeue(
                6,
                timeout,
                (count) => {
                    log(`缓冲超时，当前缓冲包数: ${count}，开始播放`, 'info');
                }
            );
            if (packets.length) {
                log(`已缓冲 ${packets.length} 个音频包，开始播放`, 'info');
                this.streamingContext.pushAudioBuffer(packets);
            }

            while (true) {
                const data = await this.queue.dequeue(99, 30);
                if (data.length) {
                    this.streamingContext.pushAudioBuffer(data);
                } else {
                    break;
                }
            }
        }
    }

    // 播放已缓冲的音频
    async playBufferedAudio() {
        try {
            this.audioContext = this.getAudioContext();

            if (!this.opusDecoder) {
                log('初始化Opus解码器...', 'info');
                try {
                    this.opusDecoder = await this.initOpusDecoder();
                    if (!this.opusDecoder) {
                        throw new Error('解码器初始化失败');
                    }
                    log('Opus解码器初始化成功', 'success');
                } catch (error) {
                    log('Opus解码器初始化失败: ' + error.message, 'error');
                    this.isPlaying = false;
                    return;
                }
            }

            if (!this.streamingContext) {
                this.streamingContext = createStreamingContext(
                    this.opusDecoder,
                    this.audioContext,
                    this.SAMPLE_RATE,
                    this.CHANNELS,
                    this.MIN_AUDIO_DURATION
                );
            }

            this.streamingContext.decodeOpusFrames();
            this.streamingContext.startPlaying();

        } catch (error) {
            log(`播放已缓冲的音频出错: ${error.message}`, 'error');
            this.isPlaying = false;
            this.streamingContext = null;
        }
    }

    // 添加音频数据到队列
    enqueueAudioData(opusData) {
        if (opusData.length > 0) {
            this.queue.enqueue(opusData);
        } else {
            log('收到空音频数据帧，可能是结束标志', 'warning');
            if (this.isPlaying && this.streamingContext) {
                this.streamingContext.endOfStream = true;
            }
        }
    }

    // 预加载解码器
    async preload() {
        log('预加载Opus解码器...', 'info');
        try {
            await this.initOpusDecoder();
            log('Opus解码器预加载成功', 'success');
        } catch (error) {
            log(`Opus解码器预加载失败: ${error.message}，将在需要时重试`, 'warning');
        }
    }

    // 启动播放系统
    async start() {
        await this.preload();
        this.playBufferedAudio();
        this.startAudioBuffering();
    }

    // 获取音频包统计信息
    getAudioStats() {
        if (!this.streamingContext) {
            return {
                
```

### Core Architecture Module: `main/digital-human/js/core/audio/recorder.js`
```
// Audio recording module
import { log } from '../../utils/logger.js?v=0205';
import { initOpusEncoder } from './opus-codec.js?v=0205';
import { getAudioPlayer } from './player.js?v=0205';

// Audio recorder class
export class AudioRecorder {
    constructor() {
        this.isRecording = false;
        this.audioContext = null;
        this.analyser = null;
        this.audioProcessor = null;
        this.audioProcessorType = null;
        this.audioSource = null;
        this.opusEncoder = null;
        this.pcmDataBuffer = new Int16Array();
        this.audioBuffers = [];
        this.totalAudioSize = 0;
        this.visualizationRequest = null;
        this.recordingTimer = null;
        this.websocket = null;
        // Callback functions
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onVisualizerUpdate = null;
    }

    // Set WebSocket instance
    setWebSocket(ws) {
        this.websocket = ws;
    }

    // Get AudioContext instance
    getAudioContext() {
        return getAudioPlayer().getAudioContext();
    }

    // Initialize encoder
    initEncoder() {
        if (!this.opusEncoder) {
            this.opusEncoder = initOpusEncoder();
        }
        return this.opusEncoder;
    }

    // PCM processor code
    getAudioProcessorCode() {
        return `
            class AudioRecorderProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.buffers = [];
                    this.frameSize = 960;
                    this.buffer = new Int16Array(this.frameSize);
                    this.bufferIndex = 0;
                    this.isRecording = false;
                    this.port.onmessage = (event) => {
                        if (event.data.command === 'start') {
                            this.isRecording = true;
                            this.port.postMessage({ type: 'status', status: 'started' });
                        } else if (event.data.command === 'stop') {
                            this.isRecording = false;
                            if (this.bufferIndex > 0) {
                                const finalBuffer = this.buffer.slice(0, this.bufferIndex);
                                this.port.postMessage({ type: 'buffer', buffer: finalBuffer });
                                this.bufferIndex = 0;
                            }
                            this.port.postMessage({ type: 'status', status: 'stopped' });
                        }
                    };
                }
                process(inputs, outputs, parameters) {
                    if (!this.isRecording) return true;
                    const input = inputs[0][0];
                    if (!input) return true;
                    for (let i = 0; i < input.length; i++) {
                        if (this.bufferIndex >= this.frameSize) {
                            this.port.postMessage({ type: 'buffer', buffer: this.buffer.slice(0) });
                            this.bufferIndex = 0;
                        }
                        this.buffer[this.bufferIndex++] = Math.max(-32768, Math.min(32767, Math.floor(input[i] * 32767)));
                    }
                    return true;
                }
            }
            registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
        `;
    }

    // Create audio processor
    async createAudioProcessor() {
        this.audioContext = this.getAudioContext();
        try {
            if (this.audioContext.audioWorklet) {
                const blob = new Blob([this.getAudioProcessorCode()], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                await this.audioContext.audioWorklet.addModule(url);
                URL.revokeObjectURL(url);
                const audioProcessor = new AudioWorkletNode(this.audioContext, 'audio-recorder-processor');
                audioProcessor.port.onmessage = (event) => {
                    if (event.data.type === 'buffer') {
                        this.processPCMBuffer(event.data.buffer);
                    }
                };
                log('使用AudioWorklet处理音频', 'success');
                const silent = this.audioContext.createGain();
                silent.gain.value = 0;
                audioProcessor.connect(silent);
                silent.connect(this.audioContext.destination);
                return { node: audioProcessor, type: 'worklet' };
            } else {
                log('AudioWorklet不可用，使用ScriptProcessorNode作为后备方案', 'warning');
                return this.createScriptProcessor();
            }
        } catch (error) {
            log(`创建音频处理器失败: ${error.message}，尝试后备方案`, 'error');
            return this.createScriptProcessor();
        }
    }

    // Create ScriptProcessor as fallback
    createScriptProcessor() {
        try {
            const frameSize = 4096;
            const scriptProcessor = this.audioContext.createScriptProcessor(frameSize, 1, 1);
            scriptProcessor.onaudioprocess = (event) => {
                if (!this.isRecording) return;
                const input = event.inputBuffer.getChannelData(0);
                const buffer = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    buffer[i] = Math.max(-32768, Math.min(32767, Math.floor(input[i] * 32767)));
                }
                this.processPCMBuffer(buffer);
            };
            const silent = this.audioContext.createGain();
            silent.gain.value = 0;
            scriptProcessor.connect(silent);
            silent.connect(this.audioContext.destination);
            log('使用ScriptProcessorNode作为后备方案成功', 'warning');
            return { node: scriptProcessor, type: 'processor' };
        } catch (fallbackError) {
            log(`后备方案也失败: ${fallbackError.message}`, 'error');
            return null;
        }
    }

    // Process PCM buffer data
    processPCMBuffer(buffer) {
        if (!this.isRecording) return;
        const newBuffer = new Int16Array(this.pcmDataBuffer.length + buffer.length);
        newBuffer.set(this.pcmDataBuffer);
        newBuffer.set(buffer, this.pcmDataBuffer.length);
        this.pcmDataBuffer = newBuffer;
        const samplesPerFrame = 960;
        while (this.pcmDataBuffer.length >= samplesPerFrame) {
            const frameData = this.pcmDataBuffer.slice(0, samplesPerFrame);
            this.pcmDataBuffer = this.pcmDataBuffer.slice(samplesPerFrame);
            this.encodeAndSendOpus(frameData);
        }
    }

    // Encode and send Opus data
    encodeAndSendOpus(pcmData = null) {
        if (!this.opusEncoder) {
            log('Opus编码器未初始化', 'error');
            return;
        }
        try {
            if (pcmData) {
                const opusData = this.opusEncoder.encode(pcmData);
                if (opusData && opusData.length > 0) {
                    this.audioBuffers.push(opusData.buffer);
                    this.totalAudioSize += opusData.length;
                    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                        try {
                            this.websocket.send(opusData.buffer);
                        } catch (error) {
                            log(`WebSocket发送错误: ${error.message}`, 'error');
                        }
                    }
                } else {
                    log('Opus编码失败，未返回有效数据', 'error');
                }
            } else {
                if (this.pcmDataBuffer.length > 0) {
                    const samplesPerFrame = 960;
                    if (this.pcmDataBuffer.length < samplesPerFrame) {
                        const paddedBuffer = new Int16Array(samplesPerFrame);
                        paddedBuffer.set(this.pcmDataBuffer);
                        this.encodeAndSendOpus(paddedBuffer);
                    } else {
                        this.encodeAndSendOpus
```

### Core Architecture Module: `main/digital-human/js/core/audio/stream-context.js`
```
import BlockingQueue from '../../utils/blocking-queue.js?v=0205';
import { log } from '../../utils/logger.js?v=0205';

// 音频流播放上下文类
export class StreamingContext {
    constructor(opusDecoder, audioContext, sampleRate, channels, minAudioDuration) {
        this.opusDecoder = opusDecoder;
        this.audioContext = audioContext;

        // 音频参数
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.minAudioDuration = minAudioDuration;

        // 初始化队列和状态
        this.queue = [];          // 已解码的PCM队列。正在播放
        this.activeQueue = new BlockingQueue(); // 已解码的PCM队列。准备播放
        this.pendingAudioBufferQueue = [];  // 待处理的缓存队列
        this.audioBufferQueue = new BlockingQueue();  // 缓存队列
        this.playing = false;     // 是否正在播放
        this.endOfStream = false; // 是否收到结束信号
        this.source = null;       // 当前音频源
        this.totalSamples = 0;    // 累积的总样本数
        this.lastPlayTime = 0;    // 上次播放的时间戳
        this.scheduledEndTime = 0; // 已调度音频的结束时间

        // 初始化分析器节点（供Live2D使用）
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
    }

    // 缓存音频数组
    pushAudioBuffer(item) {
        this.audioBufferQueue.enqueue(...item);
    }

    // 获取需要处理缓存队列，单线程：在audioBufferQueue一直更新的状态下不会出现安全问题
    async getPendingAudioBufferQueue() {
        // 等待数据到达并获取
        const data = await this.audioBufferQueue.dequeue();
        // 赋值给待处理队列
        this.pendingAudioBufferQueue = data;
    }

    // 获取正在播放已解码的PCM队列，单线程：在activeQueue一直更新的状态下不会出现安全问题
    async getQueue(minSamples) {
        const num = minSamples - this.queue.length > 0 ? minSamples - this.queue.length : 1;

        // 等待数据并获取
        const tempArray = await this.activeQueue.dequeue(num);
        this.queue.push(...tempArray);
    }

    // 将Int16音频数据转换为Float32音频数据
    convertInt16ToFloat32(int16Data) {
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            // 将[-32768,32767]范围转换为[-1,1]，统一使用32768.0避免不对称失真
            float32Data[i] = int16Data[i] / 32768.0;
        }
        return float32Data;
    }

    // 获取待解码包数
    getPendingDecodeCount() {
        return this.audioBufferQueue.length + this.pendingAudioBufferQueue.length;
    }

    // 获取待播放样本数（转换为包数，每包960样本）
    getPendingPlayCount() {
        // 计算已在队列中的样本
        const queuedSamples = this.activeQueue.length + this.queue.length;

        // 计算已调度但未播放的样本（在Web Audio缓冲区中）
        let scheduledSamples = 0;
        if (this.playing && this.scheduledEndTime) {
            const currentTime = this.audioContext.currentTime;
            const remainingTime = Math.max(0, this.scheduledEndTime - currentTime);
            scheduledSamples = Math.floor(remainingTime * this.sampleRate);
        }

        const totalSamples = queuedSamples + scheduledSamples;
        return Math.ceil(totalSamples / 960);
    }

    // 清空所有音频缓冲
    clearAllBuffers() {
        log('清空所有音频缓冲', 'info');

        // 清空所有队列（使用clear方法保持对象引用）
        this.audioBufferQueue.clear();
        this.pendingAudioBufferQueue = [];
        this.activeQueue.clear();
        this.queue = [];

        // 停止当前播放的音频源
        if (this.source) {
            try {
                this.source.stop();
                this.source.disconnect();
            } catch (e) {
                // 忽略已经停止的错误
            }
            this.source = null;
        }

        // 重置状态
        this.playing = false;
        this.scheduledEndTime = this.audioContext.currentTime;
        this.totalSamples = 0;

        log('音频缓冲已清空', 'success');
    }

    // 获取分析器节点（供Live2D使用）
    getAnalyser() {
        return this.analyser;
    }

    // 将Opus数据解码为PCM
    async decodeOpusFrames() {
        if (!this.opusDecoder) {
            log('Opus解码器未初始化，无法解码', 'error');
            return;
        } else {
            log('Opus解码器启动', 'info');
        }

        while (true) {
            let decodedSamples = [];
            for (const frame of this.pendingAudioBufferQueue) {
                try {
                    // 使用Opus解码器解码
                    const frameData = this.opusDecoder.decode(frame);
                    if (frameData && frameData.length > 0) {
                        // 转换为Float32
                        const floatData = this.convertInt16ToFloat32(frameData);
                        // 使用循环替代展开运算符
                        for (let i = 0; i < floatData.length; i++) {
                            decodedSamples.push(floatData[i]);
                        }
                    }
                } catch (error) {
                    log("Opus解码失败: " + error.message, 'error');
                }
            }

            if (decodedSamples.length > 0) {
                // 使用循环替代展开运算符
                for (let i = 0; i < decodedSamples.length; i++) {
                    this.activeQueue.enqueue(decodedSamples[i]);
                }
                this.totalSamples += decodedSamples.length;
            } else {
                log('没有成功解码的样本', 'warning');
            }
            await this.getPendingAudioBufferQueue();
        }
    }

    // 开始播放音频
    async startPlaying() {
        this.scheduledEndTime = this.audioContext.currentTime; // 跟踪已调度音频的结束时间

        while (true) {
            // 初始缓冲：等待足够的样本再开始播放
            const minSamples = this.sampleRate * this.minAudioDuration * 2;
            if (!this.playing && this.queue.length < minSamples) {
                await this.getQueue(minSamples);
            }
            this.playing = true;

            // 持续播放队列中的音频，每次播放一个小块
            while (this.playing && this.queue.length > 0) {
                // 每次播放120ms的音频（2个Opus包）
                const playDuration = 0.12;
                const targetSamples = Math.floor(this.sampleRate * playDuration);
                const actualSamples = Math.min(this.queue.length, targetSamples);

                if (actualSamples === 0) break;

                const currentSamples = this.queue.splice(0, actualSamples);
                const audioBuffer = this.audioContext.createBuffer(this.channels, currentSamples.length, this.sampleRate);
                audioBuffer.copyToChannel(new Float32Array(currentSamples), 0);

                // 创建音频源
                this.source = this.audioContext.createBufferSource();
                this.source.buffer = audioBuffer;

                // 精确调度播放时间
                const currentTime = this.audioContext.currentTime;
                const startTime = Math.max(this.scheduledEndTime, currentTime);

                // 连接到分析器和输出
                this.source.connect(this.analyser);
                this.source.connect(this.audioContext.destination);

                log(`调度播放 ${currentSamples.length} 个样本，约 ${(currentSamples.length / this.sampleRate).toFixed(2)} 秒`, 'debug');
                this.source.start(startTime);

                // 更新下一个音频块的调度时间
                const duration = audioBuffer.duration;
                this.scheduledEndTime = startTime + duration;
                this.lastPlayTime = startTime;

                // 如果队列中数据不足，等待新数据
                if (this.queue.length < targetSamples) {
                    break;
                }
            }

            // 等待新数据
            await this.getQueue(minSamples);
        }
    }
}

// 创建streamingContext实例的工厂函数
export function createStreamingContext(opusDecoder, audioContext, sampleRate, channels, minAudioDuration) {
    return new StreamingContext(opusDecoder, audioContext, sampleRate, channels, minAudioDuration);
}
```

### Core Architecture Module: `main/digital-human/js/core/mcp/tools.js`
```
import { log } from '../../utils/logger.js?v=0205';

// ==========================================
// MCP 工具管理逻辑
// ==========================================

// 全局变量
let mcpTools = [];
let mcpEditingIndex = null;
let mcpProperties = [];
let websocket = null; // 将从外部设置

/**
 * 设置 WebSocket 实例
 * @param {WebSocket} ws - WebSocket 连接实例
 */
export function setWebSocket(ws) {
    websocket = ws;
}

/**
 * 初始化 MCP 工具
 */
export async function initMcpTools() {
    // 加载默认工具数据
    const defaultMcpTools = await fetch("js/config/default-mcp-tools.json").then(res => res.json());
    const savedTools = localStorage.getItem('mcpTools');
    if (savedTools) {
        try {
            const parsedTools = JSON.parse(savedTools);
            // 合并默认工具和用户保存的工具，保留用户自定义的工具
            const defaultToolNames = new Set(defaultMcpTools.map(t => t.name));
            // 添加默认工具中不存在的新工具
            parsedTools.forEach(tool => {
                if (!defaultToolNames.has(tool.name)) {
                    defaultMcpTools.push(tool);
                }
            });
            mcpTools = defaultMcpTools;
        } catch (e) {
            log('加载MCP工具失败，使用默认工具', 'warning');
            mcpTools = [...defaultMcpTools];
        }
    } else {
        mcpTools = [...defaultMcpTools];
    }
    renderMcpTools();
    setupMcpEventListeners();
}

/**
 * 渲染工具列表
 */
function renderMcpTools() {
    const container = document.getElementById('mcpToolsContainer');
    const countSpan = document.getElementById('mcpToolsCount');
    if (!container) {
        return; // Container not found, skip rendering
    }
    if (countSpan) {
        countSpan.textContent = `${mcpTools.length} 个工具`;
    }
    if (mcpTools.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #999;">暂无工具，点击下方按钮添加新工具</div>';
        return;
    }
    container.innerHTML = mcpTools.map((tool, index) => {
        const paramCount = tool.inputSchema.properties ? Object.keys(tool.inputSchema.properties).length : 0;
        const requiredCount = tool.inputSchema.required ? tool.inputSchema.required.length : 0;
        const hasMockResponse = tool.mockResponse && Object.keys(tool.mockResponse).length > 0;
        return `
            <div class="mcp-tool-card">
                <div class="mcp-tool-header">
                    <div class="mcp-tool-name">${tool.name}</div>
                    <div class="mcp-tool-actions">
                        <button class="mcp-edit-btn" onclick="window.mcpModule.editMcpTool(${index})">
                            ✏️ 编辑
                        </button>
                        <button class="mcp-delete-btn" onclick="window.mcpModule.deleteMcpTool(${index})">
                            🗑️ 删除
                        </button>
                    </div>
                </div>
                <div class="mcp-tool-description">${tool.description}</div>
                <div class="mcp-tool-info">
                    <div class="mcp-tool-info-row">
                        <span class="mcp-tool-info-label">参数数量:</span>
                        <span class="mcp-tool-info-value">${paramCount} 个 ${requiredCount > 0 ? `(${requiredCount} 个必填)` : ''}</span>
                    </div>
                    <div class="mcp-tool-info-row">
                        <span class="mcp-tool-info-label">模拟返回:</span>
                        <span class="mcp-tool-info-value">${hasMockResponse ? '✅ 已配置: ' + JSON.stringify(tool.mockResponse) : '⚪ 使用默认'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 渲染参数列表
 */
function renderMcpProperties() {
    const container = document.getElementById('mcpPropertiesContainer');
    const emptyState = document.getElementById('mcpEmptyState');
    if (!container) {
        return; // Container not found, skip rendering
    }
    if (mcpProperties.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        container.innerHTML = '';
        return;
    }
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    container.innerHTML = mcpProperties.map((prop, index) => `
        <div class="mcp-property-card" onclick="window.mcpModule.editMcpProperty(${index})">
            <div class="mcp-property-row-label">
                <span class="mcp-property-label">参数名称</span>
                <span class="mcp-property-value">${prop.name}${prop.required ? ' <span class="mcp-property-required-badge">[必填]</span>' : ''}</span>
            </div>
            <div class="mcp-property-row-label">
                <span class="mcp-property-label">数据类型</span>
                <span class="mcp-property-value">${getTypeLabel(prop.type)}</span>
            </div>
            <div class="mcp-property-row-label">
                <span class="mcp-property-label">描述</span>
                <span class="mcp-property-value">${prop.description || '-'}</span>
            </div>
            <div class="mcp-property-row-action">
                <button class="mcp-property-delete-btn" onclick="event.stopPropagation(); window.mcpModule.deleteMcpProperty(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

/**
 * 获取数据类型标签
 */
function getTypeLabel(type) {
    const typeMap = {
        'string': '字符串',
        'integer': '整数',
        'number': '数字',
        'boolean': '布尔值',
        'array': '数组',
        'object': '对象'
    };
    return typeMap[type] || type;
}

/**
 * 添加参数 - 打开参数编辑模态框
 */
function addMcpProperty() {
    openPropertyModal();
}

/**
 * 编辑参数 - 打开参数编辑模态框
 */
function editMcpProperty(index) {
    openPropertyModal(index);
}

/**
 * 打开参数编辑模态框
 */
function openPropertyModal(index = null) {
    const form = document.getElementById('mcpPropertyForm');
    const title = document.getElementById('mcpPropertyModalTitle');
    document.getElementById('mcpPropertyIndex').value = index !== null ? index : -1;

    if (index !== null) {
        const prop = mcpProperties[index];
        title.textContent = '编辑参数';
        document.getElementById('mcpPropertyName').value = prop.name;
        document.getElementById('mcpPropertyType').value = prop.type || 'string';
        document.getElementById('mcpPropertyMinimum').value = prop.minimum !== undefined ? prop.minimum : '';
        document.getElementById('mcpPropertyMaximum').value = prop.maximum !== undefined ? prop.maximum : '';
        document.getElementById('mcpPropertyDescription').value = prop.description || '';
        document.getElementById('mcpPropertyRequired').checked = prop.required || false;
    } else {
        title.textContent = '添加参数';
        form.reset();
        document.getElementById('mcpPropertyName').value = `param_${mcpProperties.length + 1}`;
        document.getElementById('mcpPropertyType').value = 'string';
        document.getElementById('mcpPropertyMinimum').value = '';
        document.getElementById('mcpPropertyMaximum').value = '';
        document.getElementById('mcpPropertyDescription').value = '';
        document.getElementById('mcpPropertyRequired').checked = false;
    }

    updatePropertyRangeVisibility();
    document.getElementById('mcpPropertyModal').style.display = 'flex';
}

/**
 * 关闭参数编辑模态框
 */
function closePropertyModal() {
    document.getElementById('mcpPropertyModal').style.display = 'none';
}

/**
 * 更新数值范围输入框的可见性
 */
function updatePropertyRangeVisibility() {
    const type = document.getElementById('mcpPropertyType').value;
    const rangeGroup = document.getElementById('mcpPropertyRangeGroup');
    if (type === 'integer' || type === 'number') {
        rangeGroup.style.display = 'block';
    } else {
        rangeGroup.style.display = 'none';
    }
}

/**
 * 处理参数表单提交
 */
function handlePropertySubmit(e) {
    e.preventDefault();
    const index = parseInt(document.getElementById('mcpPropertyIndex').value);
    const name = document.getElementById('mcpPropertyName').value.trim();
    const type = document.getElement
```

### Core Architecture Module: `main/digital-human/js/core/network/ota-connector.js`
```
import { log } from '../../utils/logger.js?v=0205';

// WebSocket 连接
export async function webSocketConnect(otaUrl, config) {

    if (!validateConfig(config)) {
        return;
    }

    // 发送OTA请求并获取返回的websocket信息
    const otaResult = await sendOTA(otaUrl, config);
    if (!otaResult) {
        log('无法从OTA服务器获取信息', 'error');
        return;
    }

    // 从OTA响应中提取websocket信息
    const { websocket } = otaResult;
    if (!websocket || !websocket.url) {
        log('OTA响应中缺少websocket信息', 'error');
        return;
    }

    // 使用OTA返回的websocket URL
    let connUrl = new URL(websocket.url);

    // 添加token参数（从OTA响应中获取）
    if (websocket.token) {
        if (websocket.token.startsWith("Bearer ")) {
            connUrl.searchParams.append('authorization', websocket.token);
        } else {
            connUrl.searchParams.append('authorization', 'Bearer ' + websocket.token);
        }
    }

    // 添加认证参数（保持原有逻辑）
    connUrl.searchParams.append('device-id', config.deviceId);
    connUrl.searchParams.append('client-id', config.clientId);

    const wsurl = connUrl.toString()

    log(`正在连接: ${wsurl}`, 'info');

    if (wsurl) {
        document.getElementById('serverUrl').value = wsurl;
    }

    return new WebSocket(connUrl.toString());
}

// 验证配置
function validateConfig(config) {
    if (!config.deviceMac) {
        log('设备MAC地址不能为空', 'error');
        return false;
    }
    if (!config.clientId) {
        log('客户端ID不能为空', 'error');
        return false;
    }
    return true;
}

// OTA发送请求，验证状态，并返回响应数据
async function sendOTA(otaUrl, config) {
    try {
        const res = await fetch(otaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Device-Id': config.deviceId,
                'Client-Id': config.clientId
            },
            body: JSON.stringify({
                version: 0,
                uuid: '',
                application: {
                    name: 'xiaozhi-web-test',
                    version: '1.0.0',
                    compile_time: '2025-04-16 10:00:00',
                    idf_version: '4.4.3',
                    elf_sha256: '1234567890abcdef1234567890abcdef1234567890abcdef'
                },
                ota: { label: 'xiaozhi-web-test' },
                board: {
                    type: config.deviceName,
                    ssid: 'xiaozhi-web-test',
                    rssi: 0,
                    channel: 0,
                    ip: '192.168.1.1',
                    mac: config.deviceMac
                },
                flash_size: 0,
                minimum_free_heap_size: 0,
                mac_address: config.deviceMac,
                chip_model_name: '',
                chip_info: { model: 0, cores: 0, revision: 0, features: 0 },
                partition_table: [{ label: '', type: 0, subtype: 0, address: 0, size: 0 }]
            })
        });

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const result = await res.json();
        return result; // 返回完整的响应数据
    } catch (err) {
        return null; // 失败返回null
    }
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3372** (2026-09-16): **[Bug] 后台ota升级没有触发**
  *Symptoms*: 你好！我在使用后台ota时遭遇如下问题：  如图，我已经上传了对应的新版固件：  <img width="1890" height="288" alt="Image" src="https://github.com/user-attachments/assets/fdddde95-172f-402e-9ed1-5851e411c93b" />  设备里的固件是旧版：  <img width="1543" height="210" alt="Image" src="https://github.com/user-attachments/assets/1fdb8959-52e1-41c4-bd69-32d26da4b0f2" />  但是设备端没有触发更新，而是直接进入对话，这是为何  已核对设备固件型号名称，都是对的上的

- **Issue #3333** (2026-08-21): **[Bug] 声纹识别开启后, 会导致对话卡住, 有遇到同样问题的吗**
  *Symptoms*: ## 🐛 问题描述 <!-- 清晰简洁地描述问题是什么 -->  ## 🖥️ 环境信息 - 部署方式: 全模块部署 还是 单Server部署 - 版本号: 例如 0.3.x  ## 🔍 告诉我们，应该怎么复现这个问题 <!-- 这个很重要，方便我们快速定位 --> 1. 打开 '...' 2. 点击 '...' 3. 滚动到 '...' 4. 看到错误  ## 🤔 你原本希望是怎么样的 <!-- 简要描述预期的正确行为 -->  ## 😯 提供一些截图 <!-- 如果适用，添加问题的截图 --> 1. 比如日志截图，越多越好 2. 比如界面反应  ## 📋 其他信息 <!-- 在此添加关于此问题的任何其他上下文信息 --> 
  **Post-Mortem & Fix Analysis**:
  > 请详细描述
  > @wengzh12138    260821 12:08:53[0.9.5-SiFuChEdnocaCh][core.handle.textMessageProcessor]-INFO-收到listen消息：{"session_id":"33eb33c3-1d2c-4bd8-8b2d-7f790bd94ad7","type":"listen","state":"start","mode":"auto"} 260821 12:08:53[0.9.5-SiFuChEdnocaCh][core.handle.textMessageProcessor]-INFO-收到mcp消息：{"session_id":"33eb33c3-1d2c-4bd8-8b2d-7f790bd94ad7","type":"mcp","payload":{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"self.get_device_status","description":"Provides the real-time information of the device, including the current status of the audio speaker, screen, battery, network, etc.\nUse this tool for: \n1. Answering questions about current condition (e.g. what is the current volume of the audio speaker?)\n2. As the first step to control the device (e.g. turn up / down the volume of the audio speaker, etc.)","inputSchema":{"type":"object","properties":{}}},{"name":"self.audio_speaker.set_volume","description":"Set the volume of the audio speaker. If the current volume is unknown, you mus
  > 识别正确的时候, 就不会卡住

- **Issue #3311** (2026-08-10): **[Bug] 不算是 bug 的问题**
  *Symptoms*: ## 🐛问题描述  不清楚是否算bug，因为这是一个太棒的项目！  遇到的情况是： 头一天 通过 脚本 算是部署成功了，已经到核心配置的阶段，因ws配置报错，临下班再次 重装乌班图 后 重新通过脚本部署，大概1小时后，xiaozhi-esp32-server:server_latest等都下载完毕，删除了 docker-compose_all.yml 中的"version"（忘了具体啥时删除的）。 其实这时应该就开始无法访问服务器（120.*.*.166）了，但没注意。 第二天发现多个SSH客户端都无法访问服务器，在云服务器厂商官网的控制面板上也无法访问，都是超时一类。 求助云服务器厂商，检测后发现是有个Python进程一直重启，占用资源太多所致，估计就是22端口吧。 ......  这应该不算是 bug，最多是个隐患吧。 也没有能力提供改进方法，就只是反馈一下吧，希望能有点启发吧，因为这项目太棒了。  ## 🖥️ 环境信息 - 部署方式: 全模块部署  Server部署 - 版本号: 最新   
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，也谢谢你对项目的认可！  从目前的信息来看，服务器无法 SSH 登录更可能是主机资源耗尽导致的，并不是 Python 进程占用了 22 端口。删除 `docker-compose_all.yml` 中的 `version` 也不会造成这个问题，新版 Docker Compose 已经不再需要该字段。  全模块部署如果使用本地 FunASR，建议至少准备 4 核 8 GB；如果机器配置较低，而服务又因配置错误持续重启，确实可能导致 CPU、内存或磁盘 I/O 被占满。项目目前使用了 `restart: always`，这也可能放大启动失败带来的影响，我们会关注并考虑增加资源检查和更友好的失败保护。  为了进一步确认原因，方便的话请补充以下信息：  - 云服务器的 CPU、内存和磁盘配置； - `docker ps -a` 的输出； - `docker logs --tail 300 xiaozhi-esp32-server` 的输出； - 如果还能进入控制台，请提供 `free -h` 和 `docker stats --no-stream` 的结果。  如果再次出现无法访问，可以先通过云厂商控制台执行：  ```bash docker compose -f /opt/xiaozhi-server/docker-compose_all.yml down ```  等服务器恢复后再排查具体的启动日志。现阶段还不能确定是项目 Bug，但你反馈的“异常重启可能拖垮低配服务器”确实是一个值得改进的隐患，再次感谢提醒！
  > 非常感谢回复！ 并且，您说的对，是预置的 ASR 模型造成 OOM 了，也把 CPU 给累坏了。 后来，也知道可以在编排 Docker 时指定空间上限 等 可以避免这样 —— 第一次 从 部署开源库中 感觉收获满满。  如果可能，希望可以给这个原本就很出色的库 做点什么。 

- **Issue #3299** (2026-07-22): **[Bug] 设备管理中的“自动升级”选项不生效**
  *Symptoms*: ## 🐛 问题描述 设备管理中的“自动升级”选项无论开启与否，终端设备都会自动升级。  ## 🖥️ 环境信息 - 部署方式: 全模块部署 - 版本号: 例如 0.9.5 ~ e3453b1a87  ## 🔍 告诉我们，应该怎么复现这个问题 升级server到上述版本； 将OTA升级中的设备版本升级到高于实际设备版本； 关闭、打开设备管理中该设备的“自动升级”开关； 无论是“自动升级”开关处于何种状态，设备总会自动升级。  
  **Post-Mortem & Fix Analysis**:
  > 找到问题了。 main\manager-api\src\main\java\xiaozhi\modules\device\vo\UserShowDeviceListVO.java, Line 36, 将otaUpgrade修改为autoUpdate
  > 感谢反馈！已定位到设备列表接口的字段不一致，导致页面显示为关闭，但数据库中的自动升级状态仍可能是开启。已在 #3301 从接口契约处修复并补充回归测试，欢迎有空帮忙验证。 

- **Issue #3282** (2026-07-24): **[Bug] 简短描述问题 本地部署Qwen3.5-35B-A3B-FP8，调用报ValueError: System message must be at the beginning.**
  *Symptoms*: ## 🐛 问题描述 <!-- 清晰简洁地描述问题是什么 --> 本地部署Qwen3.5-35B-A3B-FP8，调用报ValueError: System message must be at the beginning. ## 🖥️ 环境信息 - 部署方式: 全模块部署  - 版本号:  0.94  ## 🔍 告诉我们，应该怎么复现这个问题 <!-- 这个很重要，方便我们快速定位 --> 1. 打开 智控台 2. 设置好本地部署的模型参数 3. 配置智能体，使用配置好的本地模型 4. 硬件听到，小智有点忙。实际就是模型调用错误  ## 🤔 你原本希望是怎么样的 <!-- 简要描述预期的正确行为 --> 调用的时候将 system提示词合并，并且放到第一个  ## 😯 提供一些截图 <!-- 如果适用，添加问题的截图 -->  <img width="1077" height="543" alt="Image" src="https://github.com/user-attachments/assets/e46bf99c-007b-4ca6-8d7c-9dc33a3d836f" />  <img width="1077" height="543" alt="Image" src="https://github.com/user-attachments/assets/93d3157c-6fdd-4625-a527-ac2dead866d0" />  ## 📋 其他信息 <!-- 在此添加关于此问题的任何其他上下文信息 --> 问题已经定位清楚：平台发送的 messages 顺序不符合 Qwen3.5 的 chat template 要求。 核心报错： ValueError: System message must be at the beginning. 也就是说，请求里出现了类似顺序： [   {"role": "user", "content": "你好"},   {"role": "system", "content": "你是一个助手"} ] 或者： [   {"role": "system", "content": "系统提示词1"},   {"role": "user", "content": "你好"},   {"role": "system", "content": "平台后来追加的提示词"} ] Qwen3.5 要求： system 消息只能位于最前面； 后续不能再次插入 system； 多个 system 最好合并成一个。 正确格式 {   "model": "Qwen3.5-35B-A3B-FP8",   "messages": [     {       "role": "system",       "content": "你是一个专业、准确的中文助手。"     },     {       "role": "user",       "content": "你好"     }   ] } 错误格式： {   "messages": [     {       "role": "user",       "content": "你好"     },     {       "role": "system",       "content": "请使用中文回答"     }   ] }
  **Post-Mortem & Fix Analysis**:
  > 这个[pr](https://github.com/xinnan-tech/xiaozhi-esp32-server/pull/3270)中有修复这个问题，可以更新试一下；如果还有报错，麻烦提供下日志

- **Issue #3280** (2026-07-16): **[Bug] 时区导致的设备离线问题**
  *Symptoms*: 这份完整的 Issue 草稿严格整合了之前整理的四个实际排查阶段、测试命令、实际的矛盾终端日志输出，以及后续排查到的数据库表结构和 API 配置发现，以专业、客观的软件工程事实逻辑呈现：  ---  ## 🐛 问题描述  设备在成功配置并连接网络后，设备底层鉴权、系统管理后台（Web UI）以及服务端的当前时间存在严重的 8 小时时差对齐失败。 由于容器层及 MySQL 引擎对本地时区环境变量（`TZ=Asia/Shanghai`）存在加载失效或解析畸变，导致新绑定的设备时间戳错位（写入了 UTC 0 时区时间）。  1. 控制台 UI 永久显示设备“离线”，设置入口被锁死。   ## 🖥️ 环境信息  * **部署方式**: 全模块部署 (Docker Compose) * **硬件平台**: Waveshare ESP32-S3-Touch-LCD-3.5 (-C) * **固件版本号**: v2.1.0 / v2.2.6 * **服务端镜像版本**: `server_latest` / `web_latest`  ## 🔍 告诉我们，应该怎么复现这个问题  1. 使用全模块部署 YAML（其中包含 `- TZ=Asia/Shanghai`）拉起容器。 2. 将开发板上电连接 Wi-Fi，在管理后台完成设备绑定。 3. 观察当前实际时间与界面上生成的设备绑定时间、活跃时间，发现二者存在固定的 8 小时时差（设备显示正确，但服务端日志/后台记录了 0 时区时间）。 4. 在该时差以及时钟不同步状态下，网页端的设备状态栏始终保持灰色“离线”；按键语音通信时，服务端终端抛出处理异常，导致界面参数（唤醒词/音色等）配置被锁定或调用失败。  ## 🛠️ 已做过的 YAML 修改、测试命令与终端现象输出  为了对齐时区并解决时差引发的连锁状态离线，先后对 YAML 进行了 4 个阶段的配置尝试，每次执行验证命令均出现了与配置预期不符或矛盾的实际日志输出：  ### 阶段一：尝试注入常规环境变量与启动参数  * **更改的 YAML 配置**： 在 `xiaozhi-esp32-server-web` 中追加 `JAVA_OPTS=-Duser.timezone=Asia/Shanghai`；在 `xiaozhi-esp32-server-db` 中追加 `command: --default-time-zone='+08:00'` 与 `TZ=Asia/Shanghai`。 * **测试命令**： ```bash sudo docker exec -it xiaozhi-esp32-server-web date  ```   * **实际终端输出**： ```text Fri Jul 10 08:56:26 Asia 2026  ```   * **矛盾现象**：输出既不是 `CST` 也不是 `UTC`，而是畸形的 `Asia 2026`，且时间仍为伦敦 0 时区（08点，实际物理时间应为 16点）。证明精简版基础镜像底层无 `tzdata` 组件，无法正确解析该时区字符串。  ### 阶段二：尝试挂载宿主机物理时区文件  * **更改的 YAML 配置**： 在 `xiaozhi-esp32-server`、`web`、`db`、`redis` 多个服务的 `volumes` 中均追加： `- /etc/localtime:/etc/localtime:ro` `- /etc/timezone:/etc/timezone:ro` * **测
  **Post-Mortem & Fix Analysis**:
  > 我在wsl部署依然是这样的问题，在wsl 是ubuntu 22.04，用的一键部署。前面问题中的部署方式是docker逐步部署。
  > 感谢反馈，相关修复已提交至 PR #3283，目前正在等待审查，尚未合并。  本次主要处理了两个跨时区问题：  - 后端返回绑定时间和最后连接时间的毫秒时间戳，由前端按浏览器本地时区显示，避免固定时差。 - 修复管理服务与 MQTT Gateway 处于不同时区时，日期鉴权 Token 不一致导致设备被误判为离线的问题。  如果方便，欢迎协助验证：  1. 绑定时间和最后连接时间是否正确； 2. 设备连接后是否能正常显示为在线； 3. 修改 TZ 后是否仍会出现固定时差或假离线。  如果问题仍然存在，也请提供管理服务请求 MQTT Gateway 时的 HTTP 状态或相关日志，方便继续定位。  PR: https://github.com/xinnan-tech/xiaozhi-esp32-server/pull/3283

- **Issue #3276** (2026-07-17): **[Bug] ContextProviderListTypeHandler类会导致一些bug问题**
  *Symptoms*: ## 🐛 问题描述  <img width="1012" height="600" alt="Image" src="https://github.com/user-attachments/assets/32b08447-e8c5-4631-b537-e8414374d9cf" />  启动也会发生依赖链路问题报错 2026-07-09 17:02:10.834 [main] DEBUG c.b.m.e.spring.MybatisSqlSessionFactoryBean - Registered plugin: 'MybatisPlusInterceptor{interceptors=[xiaozhi.common.interceptor.DataFilterInterceptor@68fa8ea5, PaginationInnerInterceptor(logger=org.apache.ibatis.logging.slf4j.Slf4jImpl@68c47cf9, overflow=false, maxLimit=null, dbType=null, dialect=null, optimizeJoin=true), com.baomidou.mybatisplus.extension.plugins.inner.OptimisticLockerInnerInterceptor@ecb8b3e, com.baomidou.mybatisplus.extension.plugins.inner.BlockAttackInnerInterceptor@7e764e5c]}' 2026-07-09 17:02:10.968 [main] DEBUG c.b.m.e.spring.MybatisSqlSessionFactoryBean - Parsed mapper file: 'file [D:\xiaozhi-esp32-server\main\manager-api\target\classes\mapper\agent\AgentCorrectWordMappingDao.xml]' 2026-07-09 17:02:10.982 [main] WARN  o.s.b.w.s.c.AnnotationConfigServletWebServerApplicationContext - Exception encountered during context initialization - cancelling refresh attempt: org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'methodValidationPostProcessor' defined in class path resource [org/springframework/boot/autoconfigure/validation/ValidationAutoConfiguration.class]: Failed to instantiate [org.springframework.validation.beanvalidation.MethodValidationPostProcessor]: Factory method 'methodValidationPostProcessor' threw exception 
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，已提交 PR #3279 处理该问题。  本次修复主要包含：  - `ContextProviderListTypeHandler` 改为基于 MyBatis `BaseTypeHandler` 实现，避免 MyBatis-Plus 3.5.6 之后 `AbstractJsonTypeHandler` 接口变化导致的编译冲突。 - 保留 `List<ContextProviderDTO>` 的准确序列化和反序列化类型。 - 补充 MyBatis-Plus 3.5.17 拆分后的 Spring Service、starter、JSqlParser 和批处理适配。 - 增加 Maven profile，支持 MyBatis-Plus 3.5.5、3.5.6、3.5.17 三个版本。  三个版本均已完成 clean 编译和相关运行测试，每个版本 25 项测试全部通过。  PR 当前正在等待评审，issue 会继续保持 Open，并在 PR 合并后自动关闭。如果方便，也请协助在完整 MySQL、Redis 环境中复测启动流程。 
  > @chentyke 建议直接升级MyBatis-Plus最新版本来适配解决问题，以支撑以后使用新特性带来的变化  > 感谢反馈，已提交 PR [#3279](https://github.com/xinnan-tech/xiaozhi-esp32-server/pull/3279) 处理该问题。 >  > 本次修复主要包含： >  > * `ContextProviderListTypeHandler` 改为基于 MyBatis `BaseTypeHandler` 实现，避免 MyBatis-Plus 3.5.6 之后 `AbstractJsonTypeHandler` 接口变化导致的编译冲突。 > * 保留 `List<ContextProviderDTO>` 的准确序列化和反序列化类型。 > * 补充 MyBatis-Plus 3.5.17 拆分后的 Spring Service、starter、JSqlParser 和批处理适配。 > * 增加 Maven profile，支持 MyBatis-Plus 3.5.5、3.5.6、3.5.17 三个版本。 >  > 三个版本均已完成 clean 编译和相关运行测试，每个版本 25 项测试全部通过。 >  > PR 当前正在等待评审，issue 会继续保持 Open，并在 PR 合并后自动关闭。如果方便，也请协助在完整 MySQL、Redis 环境中复测启动流程。  

- **Issue #3264** (2026-07-06): **[Bug] 最近的测试页面又用不了了，测试服务器也用不了，连接不上websocket，和上次一样**
  *Symptoms*: ## 🐛 问题描述 <!-- 清晰简洁地描述问题是什么 -->  ## 🖥️ 环境信息 - 部署方式: 全模块部署 还是 单Server部署 - 版本号: 例如 0.3.x  ## 🔍 告诉我们，应该怎么复现这个问题 <!-- 这个很重要，方便我们快速定位 --> 1. 打开 '...' 2. 点击 '...' 3. 滚动到 '...' 4. 看到错误  ## 🤔 你原本希望是怎么样的 <!-- 简要描述预期的正确行为 -->  ## 😯 提供一些截图 <!-- 如果适用，添加问题的截图 --> 1. 比如日志截图，越多越好 2. 比如界面反应  ## 📋 其他信息 <!-- 在此添加关于此问题的任何其他上下文信息 --> 
  **Post-Mortem & Fix Analysis**:
  > 再次感谢，终于找到了一个隐藏很久，但是又很难复现的一个bug。

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

### Incident Patch 1: `788f5301` (2026-09-21)
**Commit Message**: Merge pull request #3378 from xinnan-tech/fix-deps

fix(deps): 移除 chardet 直接依赖

**File**: `main/xiaozhi-server/requirements.txt` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ cnlunar==0.2.0
 PySocks==1.7.1
 dashscope==1.25.2
 baidu-aip==4.16.13
-chardet==7.6.0
 aioconsole==0.8.2
 markitdown==0.1.3
 mcp-proxy==0.10.0
```

---

### Incident Patch 2: `edad16ae` (2026-09-20)
**Commit Message**: fix(deps): 移除 chardet 直接依赖

**File**: `main/xiaozhi-server/requirements.txt` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ cnlunar==0.2.0
 PySocks==1.7.1
 dashscope==1.25.2
 baidu-aip==4.16.13
-chardet==7.6.0
 aioconsole==0.8.2
 markitdown==0.1.3
 mcp-proxy==0.10.0
```

---

### Incident Patch 3: `f4ba65f2` (2026-09-17)
**Commit Message**: Merge pull request #3375 from xinnan-tech/fix-snapshot-dialog-diff-style

fix: 修复 v-code-diff 斜体样式干扰 diff 展示

**File**: `main/manager-web/src/components/AgentSnapshotDialog.vue` (modified, +1/-1)
```diff
@@ -2479,7 +2479,7 @@ export default {
 
 ::v-deep .code-diff-view .hljs-emphasis,
 ::v-deep .code-diff-view em {
-  font-style: normal;
+  font-style: normal !important;
 }
 
 ::v-deep .code-diff-view .diff-table .blob-code-deletion .x,
```

---

### Incident Patch 4: `87c2bae5` (2026-09-17)
**Commit Message**: fix: 修复 v-code-diff 斜体样式干扰 diff 展示

**File**: `main/manager-web/src/components/AgentSnapshotDialog.vue` (modified, +1/-1)
```diff
@@ -2479,7 +2479,7 @@ export default {
 
 ::v-deep .code-diff-view .hljs-emphasis,
 ::v-deep .code-diff-view em {
-  font-style: normal;
+  font-style: normal !important;
 }
 
 ::v-deep .code-diff-view .diff-table .blob-code-deletion .x,
```

---

### Incident Patch 5: `daccfeb9` (2026-09-11)
**Commit Message**: Merge pull request #3364 from xinnan-tech/fix-memory-title

fix: 记忆模式为nomem时错误生成标题

**File**: `main/xiaozhi-server/core/connection.py` (modified, +4/-1)
```diff
@@ -279,7 +279,10 @@ async def _save_and_close(self, ws):
         """保存记忆并关闭连接"""
         try:
             # 守护线程1：独立生成标题（不依赖记忆模型）
-            if self.session_id:
+            # 仅在服务端开启 chat_history 上报时才触发标题生成，
+            # 否则服务端无法按 session_id 反查到对应的 agent/chat_history，
+            # 会抛出"智能体未找到"错误
+            if self.session_id and self.chat_history_conf != 0:
                 def generate_title_task():
                     try:
                         loop = asyncio.new_event_loop()
```

---

### Incident Patch 6: `d6d2da3d` (2026-09-09)
**Commit Message**: fix: 记忆模式为nomem时错误生成标题

**File**: `main/xiaozhi-server/core/connection.py` (modified, +4/-1)
```diff
@@ -279,7 +279,10 @@ async def _save_and_close(self, ws):
         """保存记忆并关闭连接"""
         try:
             # 守护线程1：独立生成标题（不依赖记忆模型）
-            if self.session_id:
+            # 仅在服务端开启 chat_history 上报时才触发标题生成，
+            # 否则服务端无法按 session_id 反查到对应的 agent/chat_history，
+            # 会抛出"智能体未找到"错误
+            if self.session_id and self.chat_history_conf != 0:
                 def generate_title_task():
                     try:
                         loop = asyncio.new_event_loop()
```

---

### Incident Patch 7: `5aa46538` (2026-09-08)
**Commit Message**: Merge pull request #3358 from xinnan-tech/fix-audio-delay

fix: 修复固定延迟不生效，调整相关逻辑

**File**: `main/xiaozhi-server/core/handle/sendAudioHandle.py` (modified, +26/-21)
```diff
@@ -64,16 +64,19 @@ async def _wait_for_audio_completion(conn: "ConnectionHandler"):
     """
     if hasattr(conn, "audio_rate_controller") and conn.audio_rate_controller:
         rate_controller = conn.audio_rate_controller
+        send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
         conn.logger.bind(tag=TAG).debug(
             f"等待音频发送完成，队列中还有 {len(rate_controller.queue)} 个包"
         )
         await rate_controller.queue_empty_event.wait()
 
-        # 等待预缓冲包播放完成
-        # 前N个包直接发送，增加2个网络抖动包，需要额外等待它们在客户端播放完成
-        frame_duration_ms = rate_controller.frame_duration
-        pre_buffer_playback_time = (PRE_BUFFER_COUNT + 2) * frame_duration_ms / 1000.0
-        await asyncio.sleep(pre_buffer_playback_time)
+        if send_delay_ms > 0:
+            # 自定义节奏：等待最后帧在客户端播放完成
+            playback_time = 2 * rate_controller.interval_ms / 1000.0
+        else:
+            # 默认节奏：前 N 帧预缓冲已直接发出，需要等待它们播放完成
+            playback_time = (PRE_BUFFER_COUNT + 2) * rate_controller.interval_ms / 1000.0
+        await asyncio.sleep(playback_time)
 
         conn.logger.bind(tag=TAG).debug("音频发送完成")
 
@@ -127,25 +130,25 @@ async def sendAudio(
     if audios is None or len(audios) == 0:
         return
 
-    send_delay = conn.config.get("tts_audio_send_delay", -1) / 1000.0
+    send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
     is_single_packet = isinstance(audios, bytes)
 
     # 初始化或获取 RateController
     rate_controller, flow_control = _get_or_create_rate_controller(
-        conn, frame_duration, is_single_packet
+        conn, frame_duration, is_single_packet, send_delay_ms
     )
 
     # 统一转换为列表处理
     audio_list = [audios] if is_single_packet else audios
 
     # 发送音频包
     await _send_audio_with_rate_control(
-        conn, audio_list, rate_controller, flow_control, send_delay
+        conn, audio_list, rate_controller, flow_control, send_delay_ms
     )
 
 
 def _get_or_create_rate_controller(
-    conn: "ConnectionHandler", frame_duration, is_single_packet
+    conn: "ConnectionHandler", frame_duration, is_single_packet, send_delay_ms=0
 ):
     """
     获取或创建 RateController 和 flow_control
@@ -154,6 +157,7 @@ def _get_or_create_rate_controller(
         conn: 连接对象
         frame_duration: 帧时长
         is_single_packet: 是否单包模式（True: TTS流式单包, False: 批量包）
+        send_delay_ms: 自定义发送间隔（毫秒）。
 
     Returns:
         (rate_controller, flow_control)
@@ -183,7 +187,9 @@ def _get_or_create_rate_controller(
     if need_reset:
         # 创建或获取 rate_controller
         if not hasattr(conn, "audio_rate_controller"):
-            conn.audio_rate_controller = AudioRateController(frame_duration)
+            conn.audio_rate_controller = AudioRateController(
+                frame_duration, send_delay=send_delay_ms
+            )
         else:
             conn.audio_rate_controller.reset()
 
@@ -225,7 +231,7 @@ async def send_callback(packet):
 
 
 async def _send_audio_with_rate_control(
-    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay
+    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay_ms
 ):
     """
     使用 rate_controller 发送音频包
@@ -235,24 +241,23 @@ async def _send_audio_with_rate_control(
         audio_list: 音频包列表
         rate_controller: 速率控制器
         flow_control: 流控状态
-        send_delay: 固定延迟（秒），-1表示使用动态流控
+        send_delay_ms: 自定义发送间隔（毫秒）。
     """
     for packet in audio_list:
         if conn.client_abort:
             return
 
         conn.last_activity_time = time.time() * 1000
 
-        # 预缓冲：前N个包直接发送
-        if flow_control["packet_count"] < PRE_BUFFER_COUNT:
-            await _do_send_audio(conn, packet, flow_control)
-        elif send_delay > 0:
-            # 固定延迟模式
-            await asyncio.sleep(send_delay)
-            await _do_send_audio(conn, packet, flow_control)
-        else:
-            # 动态流控模式：仅添加到队列，由后台循环负责发送
+        if send_delay_ms > 0:
+            # 自定义节奏模式：所有包入队按 send_delay 发（关闭预缓冲）
  
```

**File**: `main/xiaozhi-server/core/utils/audioRateController.py` (modified, +9/-5)
```diff
@@ -13,12 +13,16 @@ class AudioRateController:
     解决高并发下的时间累积误差问题
     """
 
-    def __init__(self, frame_duration=60):
+    def __init__(self, frame_duration=60, send_delay=0):
         """
         Args:
             frame_duration: 单个音频帧时长（毫秒），默认60ms
+            send_delay: 自定义发送间隔（毫秒）。
+                        0 = 按 frame_duration 节奏发；
+                        >0 = 按 send_delay 节奏发（主线程不入队延迟，无预缓冲）
         """
-        self.frame_duration = frame_duration
+        # 流控间隔（毫秒）：send_delay > 0 时用配置值，否则用 frame_duration
+        self.interval_ms = send_delay if send_delay > 0 else frame_duration
         self.queue = deque()
         self.play_position = 0  # 虚拟播放位置（毫秒）
         self.start_timestamp = None  # 开始时间戳（只读，不修改）
@@ -51,7 +55,7 @@ def add_audio(self, opus_packet):
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
             # 只有间隔超过1帧时长，才认为是真正的"暂停恢复"
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -71,7 +75,7 @@ def add_message(self, message_callback):
         """
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -138,7 +142,7 @@ async def check_queue(self, send_audio_callback):
 
                 # 时间已到，从队列移除并发送
                 self.queue.popleft()
-                self.play_position += self.frame_duration
+                self.play_position += self.interval_ms
                 try:
                     await send_audio_callback(opus_packet)
                 except Exception as e:
```

---

### Incident Patch 8: `79a95af3` (2026-09-07)
**Commit Message**: fix: 修复固定延迟不生效，调整相关逻辑

**File**: `main/xiaozhi-server/core/handle/sendAudioHandle.py` (modified, +26/-21)
```diff
@@ -64,16 +64,19 @@ async def _wait_for_audio_completion(conn: "ConnectionHandler"):
     """
     if hasattr(conn, "audio_rate_controller") and conn.audio_rate_controller:
         rate_controller = conn.audio_rate_controller
+        send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
         conn.logger.bind(tag=TAG).debug(
             f"等待音频发送完成，队列中还有 {len(rate_controller.queue)} 个包"
         )
         await rate_controller.queue_empty_event.wait()
 
-        # 等待预缓冲包播放完成
-        # 前N个包直接发送，增加2个网络抖动包，需要额外等待它们在客户端播放完成
-        frame_duration_ms = rate_controller.frame_duration
-        pre_buffer_playback_time = (PRE_BUFFER_COUNT + 2) * frame_duration_ms / 1000.0
-        await asyncio.sleep(pre_buffer_playback_time)
+        if send_delay_ms > 0:
+            # 自定义节奏：等待最后帧在客户端播放完成
+            playback_time = 2 * rate_controller.interval_ms / 1000.0
+        else:
+            # 默认节奏：前 N 帧预缓冲已直接发出，需要等待它们播放完成
+            playback_time = (PRE_BUFFER_COUNT + 2) * rate_controller.interval_ms / 1000.0
+        await asyncio.sleep(playback_time)
 
         conn.logger.bind(tag=TAG).debug("音频发送完成")
 
@@ -127,25 +130,25 @@ async def sendAudio(
     if audios is None or len(audios) == 0:
         return
 
-    send_delay = conn.config.get("tts_audio_send_delay", -1) / 1000.0
+    send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
     is_single_packet = isinstance(audios, bytes)
 
     # 初始化或获取 RateController
     rate_controller, flow_control = _get_or_create_rate_controller(
-        conn, frame_duration, is_single_packet
+        conn, frame_duration, is_single_packet, send_delay_ms
     )
 
     # 统一转换为列表处理
     audio_list = [audios] if is_single_packet else audios
 
     # 发送音频包
     await _send_audio_with_rate_control(
-        conn, audio_list, rate_controller, flow_control, send_delay
+        conn, audio_list, rate_controller, flow_control, send_delay_ms
     )
 
 
 def _get_or_create_rate_controller(
-    conn: "ConnectionHandler", frame_duration, is_single_packet
+    conn: "ConnectionHandler", frame_duration, is_single_packet, send_delay_ms=0
 ):
     """
     获取或创建 RateController 和 flow_control
@@ -154,6 +157,7 @@ def _get_or_create_rate_controller(
         conn: 连接对象
         frame_duration: 帧时长
         is_single_packet: 是否单包模式（True: TTS流式单包, False: 批量包）
+        send_delay_ms: 自定义发送间隔（毫秒）。
 
     Returns:
         (rate_controller, flow_control)
@@ -183,7 +187,9 @@ def _get_or_create_rate_controller(
     if need_reset:
         # 创建或获取 rate_controller
         if not hasattr(conn, "audio_rate_controller"):
-            conn.audio_rate_controller = AudioRateController(frame_duration)
+            conn.audio_rate_controller = AudioRateController(
+                frame_duration, send_delay=send_delay_ms
+            )
         else:
             conn.audio_rate_controller.reset()
 
@@ -225,7 +231,7 @@ async def send_callback(packet):
 
 
 async def _send_audio_with_rate_control(
-    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay
+    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay_ms
 ):
     """
     使用 rate_controller 发送音频包
@@ -235,24 +241,23 @@ async def _send_audio_with_rate_control(
         audio_list: 音频包列表
         rate_controller: 速率控制器
         flow_control: 流控状态
-        send_delay: 固定延迟（秒），-1表示使用动态流控
+        send_delay_ms: 自定义发送间隔（毫秒）。
     """
     for packet in audio_list:
         if conn.client_abort:
             return
 
         conn.last_activity_time = time.time() * 1000
 
-        # 预缓冲：前N个包直接发送
-        if flow_control["packet_count"] < PRE_BUFFER_COUNT:
-            await _do_send_audio(conn, packet, flow_control)
-        elif send_delay > 0:
-            # 固定延迟模式
-            await asyncio.sleep(send_delay)
-            await _do_send_audio(conn, packet, flow_control)
-        else:
-            # 动态流控模式：仅添加到队列，由后台循环负责发送
+        if send_delay_ms > 0:
+            # 自定义节奏模式：所有包入队按 send_delay 发（关闭预缓冲）
  
```

**File**: `main/xiaozhi-server/core/utils/audioRateController.py` (modified, +9/-5)
```diff
@@ -13,12 +13,16 @@ class AudioRateController:
     解决高并发下的时间累积误差问题
     """
 
-    def __init__(self, frame_duration=60):
+    def __init__(self, frame_duration=60, send_delay=0):
         """
         Args:
             frame_duration: 单个音频帧时长（毫秒），默认60ms
+            send_delay: 自定义发送间隔（毫秒）。
+                        0 = 按 frame_duration 节奏发；
+                        >0 = 按 send_delay 节奏发（主线程不入队延迟，无预缓冲）
         """
-        self.frame_duration = frame_duration
+        # 流控间隔（毫秒）：send_delay > 0 时用配置值，否则用 frame_duration
+        self.interval_ms = send_delay if send_delay > 0 else frame_duration
         self.queue = deque()
         self.play_position = 0  # 虚拟播放位置（毫秒）
         self.start_timestamp = None  # 开始时间戳（只读，不修改）
@@ -51,7 +55,7 @@ def add_audio(self, opus_packet):
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
             # 只有间隔超过1帧时长，才认为是真正的"暂停恢复"
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -71,7 +75,7 @@ def add_message(self, message_callback):
         """
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -138,7 +142,7 @@ async def check_queue(self, send_audio_callback):
 
                 # 时间已到，从队列移除并发送
                 self.queue.popleft()
-                self.play_position += self.frame_duration
+                self.play_position += self.interval_ms
                 try:
                     await send_audio_callback(opus_packet)
                 except Exception as e:
```

---

### Incident Patch 9: `32cba362` (2026-09-07)
**Commit Message**: fix: 修复 ManageApiClient 关闭期间的连接池创建竞态

**File**: `main/xiaozhi-server/config/manage_api_client.py` (modified, +30/-26)
```diff
@@ -60,31 +60,33 @@ async def _ensure_async_client(cls):
         """确保异步客户端已创建（为每个事件循环创建独立的客户端）"""
         import asyncio
 
-        if cls._closed:
-            raise Exception("ManageApiClient已关闭，不再创建新的HTTP客户端")
-
         try:
             loop = asyncio.get_running_loop()
             loop_id = id(loop)
 
-            # 为每个事件循环创建独立的客户端
-            if loop_id not in cls._async_clients:
-                # 服务端可能主动关闭连接，httpx 连接池无法正确检测和清理
-                limits = httpx.Limits(
-                    max_keepalive_connections=0,  # 禁用 keep-alive，每次都新建连接
-                )
-                cls._async_clients[loop_id] = httpx.AsyncClient(
-                    base_url=cls.config.get("url"),
-                    headers={
-                        "User-Agent": f"PythonClient/2.0 (PID:{os.getpid()})",
-                        "Accept": "application/json",
-                        "Authorization": "Bearer " + cls._secret,
-                    },
-                    timeout=cls.config.get("timeout", 30),
-                    limits=limits,  # 使用限制
-                    trust_env=False,
-                )
-            return cls._async_clients[loop_id]
+            # 检查关闭状态与创建连接池必须是同一个临界区，避免 safe_close()
+            # 清空连接池后又有请求将新客户端写回。
+            with cls._instance_lock:
+                if cls._closed:
+                    raise Exception("ManageApiClient已关闭，不再创建新的HTTP客户端")
+
+                if loop_id not in cls._async_clients:
+                    # 服务端可能主动关闭连接，httpx 连接池无法正确检测和清理
+                    limits = httpx.Limits(
+                        max_keepalive_connections=0,  # 禁用 keep-alive，每次都新建连接
+                    )
+                    cls._async_clients[loop_id] = httpx.AsyncClient(
+                        base_url=cls.config.get("url"),
+                        headers={
+                            "User-Agent": f"PythonClient/2.0 (PID:{os.getpid()})",
+                            "Accept": "application/json",
+                            "Authorization": "Bearer " + cls._secret,
+                        },
+                        timeout=cls.config.get("timeout", 30),
+                        limits=limits,  # 使用限制
+                        trust_env=False,
+                    )
+                return cls._async_clients[loop_id]
         except RuntimeError:
             # 如果没有运行中的事件循环，创建一个临时的
             raise Exception("必须在异步上下文中调用")
@@ -176,14 +178,16 @@ def safe_close(cls):
 
         with cls._instance_lock:
             cls._closed = True
-            for client in list(cls._async_clients.values()):
-                try:
-                    asyncio.run(client.aclose())
-                except Exception:
-                    pass
+            clients = list(cls._async_clients.values())
             cls._async_clients.clear()
             cls._instance = None
 
+        for client in clients:
+            try:
+                asyncio.run(client.aclose())
+            except Exception:
+                pass
+
 
 def api_guard(error_msg: str = None, raise_when_closed: bool = False):
     """装饰器：统一获取单例实例、判空与异常兜底
```

---

### Incident Patch 10: `c4782575` (2026-09-06)
**Commit Message**: Merge pull request #3356 from xinnan-tech/fix/docs-typos

docs: 批量修正文档里的错别字和拼写错误

**File**: `docs/Deployment.md` (modified, +2/-2)
```diff
@@ -70,7 +70,7 @@ xiaozhi-server
 
 ## 2. 配置项目文件
 
-接下里，程序还不能直接运行，你需要配置一下，你到底使用的是什么模型。你可以看这个教程：
+接下来，程序还不能直接运行，你需要配置一下，你到底使用的是什么模型。你可以看这个教程：
 [跳转到配置项目文件](#配置项目)
 
 配置完项目文件后，回到本教程继续往下。
@@ -119,7 +119,7 @@ docker rmi ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:web_latest
 如果确定使用`conda`，则安装好后，开始执行以下命令。
 
 重要提示！windows 用户，可以通过安装`Anaconda`来管理环境。安装好`Anaconda`后，在`开始`那里搜索`anaconda`相关的关键词，
-找到`Anaconda Prpmpt`，使用管理员身份运行它。如下图。
+找到`Anaconda Prompt`，使用管理员身份运行它。如下图。
 
 ![conda_prompt](./images/conda_env_1.png)
 
```

**File**: `docs/Deployment_all.md` (modified, +1/-1)
```diff
@@ -335,7 +335,7 @@ npm run serve
 如果确定使用`conda`，则安装好后，开始执行以下命令。
 
 重要提示！windows 用户，可以通过安装`Anaconda`来管理环境。安装好`Anaconda`后，在`开始`那里搜索`anaconda`相关的关键词，
-找到`Anaconda Prpmpt`，使用管理员身份运行它。如下图。
+找到`Anaconda Prompt`，使用管理员身份运行它。如下图。
 
 ![conda_prompt](./images/conda_env_1.png)
 
```

**File**: `docs/context-provider-integration.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 `上下文源` 在小智在唤醒那一刻，获取外部系统的数据，并将其动态注入到大模型的系统提示词（System Prompt）中。
 让其做到唤醒时感知世界某个事物的状态。
 
-它和MCP、记忆有本质的区别：`上下文源`是强制让小智感知世界的数据；`记忆(Mem)`是让他知道之前聊了什么内容；`MCP(functionc all)`是当需要调用某项能力/知识的时候使用调用。
+它和MCP、记忆有本质的区别：`上下文源`是强制让小智感知世界的数据；`记忆(Mem)`是让他知道之前聊了什么内容；`MCP(function_call)`是当需要调用某项能力/知识的时候使用调用。
 
 通过这个功能，在小智唤醒的一刹那，“感知”到：
 - 人体健康传感器状态（体温、血压、血氧状态等）
```

**File**: `docs/dev-ops-integration.md` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ cp 你原来的model.pt完整路径 /home/system/xiaozhi/xiaozhi-esp32-server/ma
 
 # 第四步 建立三个自动编译文件
 
-## 4.1 自动编译mananger-web模块
+## 4.1 自动编译manager-web模块
 在`/home/system/xiaozhi/`目录下，创建名字为`update_8001.sh`的文件，内容如下
 
 ```
@@ -106,7 +106,7 @@ fi
 
 nohup java -jar xiaozhi-esp32-api.jar --spring.profiles.active=dev &
 
-tail tail -f nohup.out
+tail -f nohup.out
 ```
 
 保存好后执行赋权命令
```

**File**: `docs/fish-speech-integration.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ python download_models.py
 python -m tools.api_server --listen 0.0.0.0:6006 
 ```
 
-然后用浏览器去到aotodl实例页面
+然后用浏览器去到autodl实例页面
 ```
 https://autodl.com/console/instance/list
 ```
```

#### Recent Merged Pull Requests:
- **PR #3387** (closed): Use (@karl9527)
- **PR #3386** (2026-09-29): Bump to 0.9.7 (@openrz)
- **PR #3385** (2026-09-28): Serpapi (@wengzh12138)
- **PR #3379** (closed): Sparkbot zgc (@sisufo)
- **PR #3378** (2026-09-21): fix(deps): 移除 chardet 直接依赖 (@Sakura-RanChen)
- **PR #3376** (2026-09-28): feat(web_search): 新增Serply搜索源 (@googio)
- **PR #3375** (2026-09-17): fix: 修复 v-code-diff 斜体样式干扰 diff 展示 (@lww155)
- **PR #3374** (2026-09-17): chore(deps): 批量升级 4 个允许的依赖 (@Sakura-RanChen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
