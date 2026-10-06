# Forensic Learning Record (Deep Inspection): wanikua/danghuangshang

> **Canonical Artifact**: `07_PROJECT_LEARNING/wanikua-danghuangshang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wanikua/danghuangshang](https://github.com/wanikua/danghuangshang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:07:16.649Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wanikua/danghuangshang`
- **Description**: Open-source multi-agent collaboration system inspired by Chinese governance — deploy and coordinate specialized AI agents with OpenClaw.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2703 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gui/src/hooks/useStatus.ts`
```
import { useState, useEffect, useCallback, useRef } from "react"
import type { SystemStatus } from "../types"
import { getAuthToken } from "../utils/auth"

const DEFAULT_REFRESH_INTERVAL = 30000

function getRefreshInterval(): number {
  try {
    const raw = localStorage.getItem('boluo_settings')
    if (raw) {
      const settings = JSON.parse(raw)
      if (typeof settings.refreshInterval === 'number' && settings.refreshInterval >= 5000) {
        return settings.refreshInterval
      }
    }
  } catch {}
  return DEFAULT_REFRESH_INTERVAL
}

export function useStatus() {
  const [data, setData] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  // [L-09] AbortController 防止组件卸载后更新状态
  const abortRef = useRef<AbortController | null>(null)

  const fetchStatus = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch("/api/status", {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        signal: controller.signal
      })
      if (res.status === 401) {
        // Only clear+reload if we had a token (prevents infinite loop)
        if (getAuthToken()) {
          localStorage.removeItem('boluo_auth_token')
          window.location.reload()
        }
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (!controller.signal.aborted) {
        setData(json)
        setError(null)
        setLastUpdated(new Date())
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Re-read interval from settings on each cycle so changes take effect without reload
    let timerId: ReturnType<typeof setTimeout>
    const scheduleNext = () => {
      timerId = setTimeout(() => {
        fetchStatus()
        scheduleNext()
      }, getRefreshInterval())
    }
    scheduleNext()
    return () => {
      clearTimeout(timerId)
      abortRef.current?.abort()
    }
  }, [fetchStatus])

  return { data, loading, error, lastUpdated, refresh: fetchStatus }
}

```

### Core Architecture Module: `gui/src/utils/auth.ts`
```
/**
 * Get the current auth token from localStorage.
 * Called as a function (not a module-level constant) so it always returns
 * the latest value — important when tokens are refreshed or the user re-logs in.
 */
export function getAuthToken(): string {
  return localStorage.getItem('boluo_auth_token') || ''
}

```

### Core Architecture Module: `scripts/middleware/webhook.js`
```
const express = require('express');
const { verifySignature } = require('../webhook-verify');

/**
 * Webhook 安全中间件
 * 
 * 用法：
 * const { createWebhookMiddleware } = require('./middleware/webhook');
 * app.use('/webhooks/github', createWebhookMiddleware('github'));
 */

/**
 * 创建 Webhook 验证中间件
 * @param {string} type - 'github' | 'feishu' | 'generic'
 * @returns {Function} Express 中间件
 */
function createWebhookMiddleware(type) {
  return (req, res, next) => {
    // 跳过验证（开发环境）
    if (process.env.WEBHOOK_VERIFY_DISABLED === 'true') {
      console.warn('[Webhook] Verification disabled (dev mode)');
      return next();
    }

    // 获取签名头
    let signature;
    switch (type) {
      case 'github':
        signature = req.headers['x-hub-signature-256'];
        break;
      case 'feishu':
        signature = req.headers['x-lark-signature'];
        break;
      default:
        signature = req.headers['x-webhook-signature'];
    }

    if (!signature) {
      console.warn('[Webhook] Missing signature header');
      return res.status(401).json({
        error: 'Missing signature',
        message: 'Webhook signature required'
      });
    }

    // 获取请求体（需要 body-parser 先处理）
    const body = req.rawBody || JSON.stringify(req.body);

    // 获取密钥
    const secret = getWebhookSecret(type);
    if (!secret) {
      console.error('[Webhook] No secret configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Webhook secret not configured'
      });
    }

    // 验证签名
    const valid = verifySignature(body, signature, secret, type);

    if (!valid) {
      console.warn('[Webhook] Invalid signature from', req.ip);
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Webhook signature verification failed'
      });
    }

    console.log('[Webhook] Signature verified:', type);
    next();
  };
}

/**
 * 获取 Webhook 密钥
 * 从环境变量读取
 */
function getWebhookSecret(type) {
  const envVar = `WEBHOOK_${type.toUpperCase()}_SECRET`;
  return process.env[envVar];
}

/**
 * 日志记录中间件
 */
function webhookLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Webhook] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}

module.exports = {
  createWebhookMiddleware,
  webhookLogger
};

```

### Core Architecture Module: `scripts/webhook-verify.js`
```
const crypto = require('crypto');

/**
 * Webhook 签名验证工具
 * 
 * 用法：
 * const { verifySignature } = require('./webhook-verify');
 * 
 * // GitHub
 * const valid = verifySignature(payload, signature, secret, 'github');
 * 
 * // 飞书
 * const valid = verifySignature(payload, signature, secret, 'feishu');
 */

/**
 * 验证 Webhook 签名
 * @param {string|object} payload - 请求体（原始字符串或对象）
 * @param {string} signature - 签名头（如：sha256=abc123）
 * @param {string} secret - Webhook 密钥
 * @param {string} type - 类型：'github' | 'feishu' | 'generic'
 * @returns {boolean} 验证结果
 */
function verifySignature(payload, signature, secret, type = 'github') {
  if (!payload || !signature || !secret) {
    console.warn('[Webhook Verify] Missing required parameters');
    return false;
  }

  // 转换为字符串
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  try {
    switch (type) {
      case 'github':
        return verifyGitHubSignature(body, signature, secret);
      case 'feishu':
        return verifyFeishuSignature(body, signature, secret);
      case 'generic':
        return verifyGenericSignature(body, signature, secret);
      default:
        console.warn(`[Webhook Verify] Unknown type: ${type}`);
        return false;
    }
  } catch (error) {
    console.error('[Webhook Verify] Error:', error.message);
    return false;
  }
}

/**
 * GitHub Webhook 签名验证
 * GitHub 使用 HMAC-SHA256，签名头格式：sha256=<hex>
 */
function verifyGitHubSignature(body, signature, secret) {
  // 提取签名值
  const sigMatch = signature.match(/^sha256=([a-f0-9]+)$/i);
  if (!sigMatch) {
    console.warn('[Webhook Verify] Invalid GitHub signature format');
    return false;
  }

  const providedSig = sigMatch[1].toLowerCase();

  // 计算期望签名
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex')
    .toLowerCase();

  // 常量时间比较（防止时序攻击）
  const valid = crypto.timingSafeEqual(
    Buffer.from(providedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );

  if (!valid) {
    console.warn('[Webhook Verify] GitHub signature mismatch');
  }

  return valid;
}

/**
 * 飞书 Webhook 签名验证
 * 飞书使用 HMAC-SHA256，签名头格式：X-Lark-Signature
 */
function verifyFeishuSignature(body, signature, secret) {
  // 飞书签名可能是 base64 或 hex
  let providedSig;
  try {
    // 尝试 hex
    if (/^[a-f0-9]+$/i.test(signature)) {
      providedSig = signature.toLowerCase();
    } else {
      // 尝试 base64
      providedSig = Buffer.from(signature, 'base64').toString('hex').toLowerCase();
    }
  } catch (e) {
    console.warn('[Webhook Verify] Invalid Feishu signature format');
    return false;
  }

  // 计算期望签名
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex')
    .toLowerCase();

  // 常量时间比较
  const valid = crypto.timingSafeEqual(
    Buffer.from(providedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );

  if (!valid) {
    console.warn('[Webhook Verify] Feishu signature mismatch');
  }

  return valid;
}

/**
 * 通用签名验证（简单 HMAC-SHA256）
 */
function verifyGenericSignature(body, signature, secret) {
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex')
    .toLowerCase();

  const providedSig = signature.toLowerCase();

  return crypto.timingSafeEqual(
    Buffer.from(providedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}

/**
 * 生成签名（用于测试）
 */
function generateSignature(payload, secret, type = 'github') {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const sig = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  return type === 'github' ? `sha256=${sig}` : sig;
}

module.exports = {
  verifySignature,
  verifyGitHubSignature,
  verifyFeishuSignature,
  verifyGenericSignature,
  generateSignature
};

```

### Core Architecture Module: `skills/discord-message-guard/src/ResponseRuleEngine.ts`
```
/**
 * ResponseRuleEngine - 响应规则引擎
 * 
 * 根据配置规则判断是否应该响应某条消息：
 * - 规则 1: 只响应用户的直接@
 * - 规则 2: 机器人@限制深度 < maxDepth
 * - 规则 3: 禁止@everyone / @here 触发
 * - 规则 4: 会话处理中时排队
 */

import type { MessageMetadata } from './MessageMetadataExtractor.js';
import type { SessionState } from './SessionStateManager.js';

export interface RuleConfig {
  /** 最大响应深度，默认 3 */
  maxDepth: number;
  
  /** 忽略所有机器人消息，默认 true */
  ignoreBots: boolean;
  
  /** 禁止@everyone 触发，默认 true */
  blockEveryone: boolean;
  
  /** 禁止@here 触发，默认 true */
  blockHere: boolean;
  
  /** 需要直接@才响应，默认 true */
  requireDirectMention: boolean;
  
  /** 忙时排队而不是丢弃，默认 true */
  queueWhenBusy: boolean;
  
  /** 允许白名单机器人协作，默认 [] */
  allowedBotIds?: string[];
}

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  maxDepth: 3,
  ignoreBots: true,
  blockEveryone: true,
  blockHere: true,
  requireDirectMention: true,
  queueWhenBusy: true,
  allowedBotIds: [],
};

export interface RuleDecision {
  /** 是否允许响应 */
  allowed: boolean;
  
  /** 拒绝原因（如果 allowed=false） */
  reason?: string;
  
  /** 建议动作 */
  suggestion?: 'respond' | 'ignore' | 'queue' | 'block';
}

export class ResponseRuleEngine {
  private config: RuleConfig;
  private botUserId: string;
  
  constructor(botUserId: string, config: Partial<RuleConfig> = {}) {
    this.botUserId = botUserId;
    this.config = { ...DEFAULT_RULE_CONFIG, ...config };
  }
  
  /**
   * 判断是否应该响应某条消息
   */
  shouldRespond(
    metadata: MessageMetadata,
    sessionState?: SessionState
  ): RuleDecision {
    // 规则 0: @everyone 直接禁止（最高优先级）
    if (this.config.blockEveryone && metadata.flags.isEveryone) {
      return {
        allowed: false,
        reason: 'Blocked @everyone - prevents snowball effect',
        suggestion: 'block',
      };
    }
    
    // 规则 0b: @here 直接禁止
    if (this.config.blockHere && metadata.flags.isHere) {
      return {
        allowed: false,
        reason: 'Blocked @here - prevents snowball effect',
        suggestion: 'block',
      };
    }
    
    // 规则 1: 机器人消息处理
    if (metadata.authorType === 'bot') {
      // 检查是否在白名单中
      const isAllowedBot = this.config.allowedBotIds?.includes(metadata.authorId);
      
      // 如果是直接@（用户测试触发），允许响应
      if (metadata.flags.isDirectMention) {
        // 仍然检查深度限制
        if (metadata.depth >= this.config.maxDepth) {
          return {
            allowed: false,
            reason: `Max depth exceeded (${metadata.depth} >= ${this.config.maxDepth})`,
            suggestion: 'ignore',
          };
        }
        return {
          allowed: true,
          reason: 'Bot direct mention allowed',
          suggestion: 'respond',
        };
      }
      
      // 白名单机器人允许
      if (isAllowedBot) {
        return {
          allowed: true,
          reason: 'Whitelisted bot',
          suggestion: 'respond',
        };
      }
      
      // 忽略其他机器人消息
      if (this.config.ignoreBots) {
        return {
          allowed: false,
          reason: 'Ignored bot message (ignoreBots=true)',
          suggestion: 'ignore',
        };
      }
    }
    
    // 规则 2: 必须被@才响应（可配置）
    if (this.config.requireDirectMention) {
      const isMentioned = metadata.mentions.includes(this.botUserId);
      
      if (!isMentioned) {
        return {
          allowed: false,
          reason: 'Not directly mentioned (requireDirectMention=true)',
          suggestion: 'ignore',
        };
      }
    }
    
    // 规则 3: 深度限制
    if (metadata.depth >= this.config.maxDepth) {
      return {
        allowed: false,
        reason: `Max depth exceeded (${metadata.depth} >= ${this.config.maxDepth})`,
        suggestion: 'ignore',
      };
    }
    
    // 规则 4: 会话状态检查
    if (sessionState?.isProcessing) {
      if (this.config.queueWhenBusy) {
        return {
          allowed: false,
          reason: 'Session busy, should queue',
          suggestion: 'queue',
        };
      } else {
        return {
          allowed: false,
          reason: 'Session busy, dropping message',
          suggestion: 'ignore',
        };
      }
    }
    
    // 通过所有检查
    return {
      allowed: true,
      reason: 'Passed all rule checks',
      suggestion: 'respond',
    };
  }
  
  /**
   * 获取配置摘要
   */
  getConfigSummary(): Record<string, any> {
    return {
      maxDepth: this.config.maxDepth,
      ignoreBots: this.config.ignoreBots,
      blockEveryone: this.config.blockEveryone,
      blockHere: this.config.blockHere,
      requireDirectMention: this.config.requireDirectMention,
      queueWhenBusy: this.config.queueWhenBusy,
      allowedBotCount: this.config.allowedBotIds?.length ?? 0,
    };
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RuleConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * 创建规则引擎实例的工厂函数
 */
export function createRuleEngine(
  botUserId: string,
  config?: Partial<RuleConfig>
): ResponseRuleEngine {
  return new ResponseRuleEngine(botUserId, config);
}

```

### Core Architecture Module: `skills/discord-message-guard/src/SessionStateManager.ts`
```
/**
 * SessionStateManager - 会话状态管理器
 * 
 * 追踪每个 Discord 频道的会话状态：
 * - 是否正在处理消息
 * - 当前响应深度
 * - 排队消息队列
 * - 过滤后的历史消息
 */

import type { MessageMetadata } from './MessageMetadataExtractor.js';

export interface CleanMessage {
  id: string;
  authorType: 'human' | 'bot';
  content: string;
  role: 'user' | 'assistant';
  timestamp?: number;
  metadata?: {
    isCoordination?: boolean;
    targetAgent?: string;
  };
}

export interface SessionState {
  channelId: string;
  isProcessing: boolean;
  currentDepth: number;
  lastActivity: number;
  messageQueue: MessageMetadata[];
  history: CleanMessage[];
  createdAt: number;
}

export interface SessionManagerConfig {
  /** 空闲超时（毫秒），默认 5 分钟 */
  idleTimeoutMs?: number;
  
  /** 最大历史长度，默认 50 */
  maxHistoryLength?: number;
  
  /** 最大队列长度，默认 10 */
  maxQueueLength?: number;
  
  /** 自动过滤机器人协调消息，默认 true */
  filterBotCoordination?: boolean;
}

export const DEFAULT_SESSION_CONFIG: Required<SessionManagerConfig> = {
  idleTimeoutMs: 5 * 60 * 1000, // 5 分钟
  maxHistoryLength: 50,
  maxQueueLength: 10,
  filterBotCoordination: true,
};

export class SessionStateManager {
  private sessions: Map<string, SessionState> = new Map();
  private config: Required<SessionManagerConfig>;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(config: SessionManagerConfig = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    
    // 启动定期清理
    this.startCleanup();
  }
  
  /**
   * 获取会话状态（不存在则创建）
   */
  getState(channelId: string): SessionState {
    if (!this.sessions.has(channelId)) {
      this.sessions.set(channelId, this.createInitialState(channelId));
    }
    return this.sessions.get(channelId)!;
  }
  
  /**
   * 创建初始会话状态
   */
  private createInitialState(channelId: string): SessionState {
    return {
      channelId,
      isProcessing: false,
      currentDepth: 0,
      lastActivity: Date.now(),
      messageQueue: [],
      history: [],
      createdAt: Date.now(),
    };
  }
  
  /**
   * 开始处理消息
   * @returns 是否成功开始（false 表示已在处理）
   */
  startProcessing(channelId: string): boolean {
    const state = this.getState(channelId);
    if (state.isProcessing) {
      return false;
    }
    state.isProcessing = true;
    state.lastActivity = Date.now();
    return true;
  }
  
  /**
   * 完成处理
   */
  finishProcessing(channelId: string): void {
    const state = this.getState(channelId);
    state.isProcessing = false;
    state.currentDepth = 0;
    state.lastActivity = Date.now();
    
    // 处理排队消息（如果有）
    this.processQueue(channelId);
  }
  
  /**
   * 增加响应深度
   */
  incrementDepth(channelId: string): number {
    const state = this.getState(channelId);
    state.currentDepth += 1;
    state.lastActivity = Date.now();
    return state.currentDepth;
  }
  
  /**
   * 获取当前深度
   */
  getCurrentDepth(channelId: string): number {
    return this.getState(channelId).currentDepth;
  }
  
  /**
   * 添加消息到历史
   */
  addToHistory(channelId: string, message: CleanMessage): void {
    const state = this.getState(channelId);
    state.history.push(message);
    
    // 限制历史长度
    if (state.history.length > this.config.maxHistoryLength) {
      state.history = state.history.slice(-this.config.maxHistoryLength);
    }
    
    state.lastActivity = Date.now();
  }
  
  /**
   * 获取过滤后的历史（用于 LLM 上下文）
   */
  getCleanHistory(channelId: string): CleanMessage[] {
    const state = this.getState(channelId);
    
    if (!this.config.filterBotCoordination) {
      return state.history;
    }
    
    // 过滤掉机器人协调消息
    return state.history.filter(msg => {
      // 用户消息总是保留
      if (msg.authorType === 'human') {
        return true;
      }
      
      // 机器人消息：如果是协调消息则过滤
      if (msg.metadata?.isCoordination) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * 添加消息到队列
   * @returns 是否成功添加
   */
  enqueueMessage(channelId: string, metadata: MessageMetadata): boolean {
    const state = this.getState(channelId);
    
    if (state.messageQueue.length >= this.config.maxQueueLength) {
      // 队列已满，丢弃最早的消息
      state.messageQueue.shift();
    }
    
    state.messageQueue.push(metadata);
    state.lastActivity = Date.now();
    return true;
  }
  
  /**
   * 从队列取出下一条消息
   */
  dequeueMessage(channelId: string): MessageMetadata | null {
    const state = this.getState(channelId);
    if (state.messageQueue.length === 0) {
      return null;
    }
    return state.messageQueue.shift()!;
  }
  
  /**
   * 获取队列长度
   */
  getQueueLength(channelId: string): number {
    return this.getState(channelId).messageQueue.length;
  }
  
  /**
   * 处理队列中的下一条消息
   */
  private processQueue(channelId: string): void {
    const state = this.getState(channelId);
    if (state.messageQueue.length > 0 && !state.isProcessing) {
      // 触发下一个排队消息
      // 注意：实际实现中需要回调机制通知上层
      state.lastActivity = Date.now();
    }
  }
  
  /**
   * 检查会话是否空闲
   */
  isIdle(channelId: string): boolean {
    const state = this.getState(channelId);
    return Date.now() - state.lastActivity > this.config.idleTimeoutMs;
  }
  
  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): SessionState[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter(
      state => now - state.lastActivity < this.config.idleTimeoutMs
    );
  }
  
  /**
   * 清理空闲会话
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [channelId, state] of this.sessions.entries()) {
      if (now - state.lastActivity > this.config.idleTimeoutMs) {
        this.sessions.delete(channelId);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    // 每分钟清理一次
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        console.log(`[SessionManager] Cleaned ${cleaned} idle sessions`);
      }
    }, 60 * 1000);
  }
  
  /**
   * 停止清理定时器
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    processingSessions: number;
    totalQueued: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => !this.isIdle(s.channelId)).length,
      processingSessions: sessions.filter(s => s.isProcessing).length,
      totalQueued: sessions.reduce((sum, s) => sum + s.messageQueue.length, 0),
    };
  }
}

/**
 * 创建会话管理器实例的工厂函数
 */
export function createSessionManager(
  config?: SessionManagerConfig
): SessionStateManager {
  return new SessionStateManager(config);
}

```

### Core Architecture Module: `skills/self-improving-agent/hooks/openclaw/handler.js`
```
/**
 * Self-Improvement Hook for OpenClaw
 * 
 * Injects a reminder to evaluate learnings during agent bootstrap.
 * Fires on agent:bootstrap event before workspace files are injected.
 */

const REMINDER_CONTENT = `
## Self-Improvement Reminder

After completing tasks, evaluate if any learnings should be captured:

**Log when:**
- User corrects you → \`.learnings/LEARNINGS.md\`
- Command/operation fails → \`.learnings/ERRORS.md\`
- User wants missing capability → \`.learnings/FEATURE_REQUESTS.md\`
- You discover your knowledge was wrong → \`.learnings/LEARNINGS.md\`
- You find a better approach → \`.learnings/LEARNINGS.md\`

**Promote when pattern is proven:**
- Behavioral patterns → \`SOUL.md\`
- Workflow improvements → \`AGENTS.md\`
- Tool gotchas → \`TOOLS.md\`

Keep entries simple: date, title, what happened, what to do differently.
`.trim();

const handler = async (event) => {
  // Safety checks for event structure
  if (!event || typeof event !== 'object') {
    return;
  }

  // Only handle agent:bootstrap events
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  // Safety check for context
  if (!event.context || typeof event.context !== 'object') {
    return;
  }

  // Inject the reminder as a virtual bootstrap file
  // Check that bootstrapFiles is an array before pushing
  if (Array.isArray(event.context.bootstrapFiles)) {
    event.context.bootstrapFiles.push({
      path: 'SELF_IMPROVEMENT_REMINDER.md',
      content: REMINDER_CONTENT,
      virtual: true,
    });
  }
};

module.exports = handler;
module.exports.default = handler;

```

### Core Architecture Module: `skills/self-improving-agent/hooks/openclaw/handler.ts`
```
/**
 * Self-Improvement Hook for OpenClaw
 * 
 * Injects a reminder to evaluate learnings during agent bootstrap.
 * Fires on agent:bootstrap event before workspace files are injected.
 */

import type { HookHandler } from 'openclaw/hooks';

const REMINDER_CONTENT = `## Self-Improvement Reminder

After completing tasks, evaluate if any learnings should be captured:

**Log when:**
- User corrects you → \`.learnings/LEARNINGS.md\`
- Command/operation fails → \`.learnings/ERRORS.md\`
- User wants missing capability → \`.learnings/FEATURE_REQUESTS.md\`
- You discover your knowledge was wrong → \`.learnings/LEARNINGS.md\`
- You find a better approach → \`.learnings/LEARNINGS.md\`

**Promote when pattern is proven:**
- Behavioral patterns → \`SOUL.md\`
- Workflow improvements → \`AGENTS.md\`
- Tool gotchas → \`TOOLS.md\`

Keep entries simple: date, title, what happened, what to do differently.`;

const handler: HookHandler = async (event) => {
  // Safety checks for event structure
  if (!event || typeof event !== 'object') {
    return;
  }

  // Only handle agent:bootstrap events
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  // Safety check for context
  if (!event.context || typeof event.context !== 'object') {
    return;
  }

  // Skip sub-agent sessions to avoid bootstrap issues
  // Sub-agents have sessionKey patterns like "agent:main:subagent:..."
  const sessionKey = event.sessionKey || '';
  if (sessionKey.includes(':subagent:')) {
    return;
  }

  // Inject the reminder as a virtual bootstrap file
  // Check that bootstrapFiles is an array before pushing
  if (Array.isArray(event.context.bootstrapFiles)) {
    event.context.bootstrapFiles.push({
      path: 'SELF_IMPROVEMENT_REMINDER.md',
      content: REMINDER_CONTENT,
      virtual: true,
    });
  }
};

export default handler;

```

### Core Architecture Module: `extensions/novel-openviking/src/index.ts`
```
// novel-openviking 插件
// 功能完全由 skills/novel-openviking/SKILL.md 提供
// 插件安装时自动注入 skill，agent 即可感知 OpenViking 增强能力
// 无需额外注册 tool — OpenViking 自带的 viking.sh 已在 skill 中说明用法

export default function register(_api: any) {
  // skill 由 openclaw.plugin.json 的 "skills" 字段声明，自动加载
  // 此入口文件仅作为插件系统的必要 entry point
}

```

### Core Architecture Module: `gui/eslint.config.js`
```
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])

```

### Core Architecture Module: `gui/server/index.js`
```
import express from 'express';
import cors from 'cors';
import { readFileSync, readdirSync, existsSync, statSync, createReadStream, openSync, readSync, closeSync, realpathSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import os from 'os';
import http from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { WebSocketServer } from 'ws';
import { exec as _exec, execFile as _execFile } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(_exec);
const execFileAsync = promisify(_execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI 命令
let CLI_CMD = 'openclaw';
try {
  await execAsync('which openclaw', { encoding: 'utf-8', timeout: 3000 });
  CLI_CMD = 'openclaw';
} catch {
  try {
    await execAsync('which clawdbot', { encoding: 'utf-8', timeout: 3000 });
    CLI_CMD = 'clawdbot';
  } catch { CLI_CMD = 'openclaw'; }
}

const app = express();
const PORT = process.env.BOLUO_GUI_PORT || 18795;

// SEC-03: 不再使用硬编码默认 Token
import crypto from 'crypto';
let AUTH_TOKEN = process.env.BOLUO_AUTH_TOKEN;
if (!AUTH_TOKEN || AUTH_TOKEN === 'changeme') {
  AUTH_TOKEN = crypto.randomBytes(16).toString('hex');
  console.warn('');
  console.warn('╔══════════════════════════════════════════════════════════════╗');
  console.warn('║  ⚠️  安全警告: BOLUO_AUTH_TOKEN 未设置或使用了默认值!       ║');
  console.warn('║  已自动生成随机 Token（仅本次运行有效）                     ║');
  console.warn('║  请设置环境变量: export BOLUO_AUTH_TOKEN=$(openssl rand -hex 16) ║');
  console.warn('╚══════════════════════════════════════════════════════════════╝');
  console.warn(`  本次 Token: ${AUTH_TOKEN}`);
  console.warn('');
}

const AGENT_DEPT_MAP = {
  'silijian': '司礼监', 'gongbu': '工部', 'hubu': '户部',
  'libu': '礼部', 'libu2': '吏部',
  'xingbu': '刑部', 'bingbu': '兵部',
  'neige': '内阁', 'duchayuan': '都察院', 'neiwufu': '内务府',
  'hanlinyuan': '翰林院',
  'hanlin_zhang': '翰林院·掌院学士',
  'hanlin_xiuzhuan': '翰林院·修撰',
  'hanlin_bianxiu': '翰林院·编修',
  'hanlin_jiantao': '翰林院·检讨',
  'hanlin_shujishi': '翰林院·庶吉士',
  'taiyiyuan': '太医院', 'guozijian': '国子监',
  'yushanfang': '御膳房'
};

// GUI botId → openclaw agent id 映射（迁移后 silijian 就是实际 agent id）
const BOT_TO_AGENT = {};
function resolveAgentId(botId) {
  return BOT_TO_AGENT[botId] || botId;
}

const HOME = process.env.HOME || '/home/ubuntu';
// OpenClaw 配置目录
const OPENCLAW_DIR = join(HOME, '.openclaw');

// Resolve symlinks so path checks work when ~/.openclaw -> ~/.clawdbot
const STATE_DIR = (() => { try { return realpathSync(OPENCLAW_DIR); } catch { return OPENCLAW_DIR; } })();
const AGENTS_DIR = join(STATE_DIR, 'agents');

// SEC: 验证 session 文件路径在合法目录内
function isValidSessionPath(filePath) {
  if (!filePath) return false;
  try { filePath = realpathSync(filePath); } catch { /* file may not exist yet */ }
  const resolved = resolve(filePath);
  return resolved.startsWith(AGENTS_DIR) || resolved.startsWith(STATE_DIR);
}
const CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');

app.use(cors());
app.use(express.json());

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function getOpenclawConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) { }
  return null;
}

// SEC-15: 验证 agentId 防止路径遍历
function sanitizeAgentId(id) {
  if (!id || typeof id !== 'string') return null;
  if (/[\/\\.\s]/.test(id) || id.includes('..')) return null;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

function getAgentSessionData(agentId) {
  const sessionsPath = join(AGENTS_DIR, agentId, 'sessions', 'sessions.json');
  if (!existsSync(sessionsPath)) return { sessions: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, model: '' };

  try {
    const data = JSON.parse(readFileSync(sessionsPath, 'utf-8'));
    const entries = Object.values(data);
    let inputTokens = 0, outputTokens = 0, totalTokens = 0;
    let model = '';

    for (const sess of entries) {
      inputTokens += sess.inputTokens || 0;
      outputTokens += sess.outputTokens || 0;
      totalTokens += sess.totalTokens || 0;
      if (sess.model && !model) model = sess.model;
    }

    return { sessions: entries.length, inputTokens, outputTokens, totalTokens, model };
  } catch (e) {
    return { sessions: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, model: '' };
  }
}

function getRecentLogs(limit = 100) {
  const logs = [];
  if (!existsSync(AGENTS_DIR)) return logs;

  try {
    const agentDirs = readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const agentId of agentDirs) {
      const sessDir = join(AGENTS_DIR, agentId, 'sessions');
      if (!existsSync(sessDir)) continue;

      const jsonlFiles = readdirSync(sessDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({ name: f, mtime: statSync(join(sessDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 1);

      for (const file of jsonlFiles) {
        try {
          // [M-17] 只读文件尾部避免大文件 OOM
          const filePath = join(sessDir, file.name);
          const fSize = statSync(filePath).size;
          let content;
          if (fSize > 5 * 1024 * 1024) { // >5MB: 只读尾部 64KB
            const TAIL = 65536;
            const fd = openSync(filePath, 'r');
            const buf = Buffer.alloc(TAIL);
            try { readSync(fd, buf, 0, TAIL, fSize - TAIL); } finally { closeSync(fd); }
            const raw = buf.toString('utf-8');
            content = raw.substring(raw.indexOf('\n') + 1);
          } else {
            content = readFileSync(filePath, 'utf-8');
          }
          const lines = content.split('\n').filter(l => l.trim()).slice(-5);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              // Support both flat format (role/content) and nested format (message.role/message.content)
              const role = entry.message?.role || entry.role;
              const msgContent = entry.message?.content || entry.content;
              if (role === 'assistant' && msgContent) {
                const text = typeof msgContent === 'string'
                  ? msgContent.substring(0, 200)
                  : JSON.stringify(msgContent).substring(0, 200);
                logs.push({
                  timestamp: new Date(file.mtime).toISOString(),
                  level: 'info',
                  message: text,
                  source: AGENT_DEPT_MAP[agentId] || agentId
                });
              }
            } catch (e) { }
          }
        } catch (e) { }
      }
    }
  } catch (e) { }

  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

// Detect which platforms an agent is bound to, from session keys
function detectAgentPlatforms(agentId) {
  const sessionsPath = join(AGENTS_DIR, agentId, 'sessions', 'sessions.json');
  const platformSet = new Set();

  if (existsSync(sessionsPath)) {
    try {
      const data = JSON.parse(readFileSync(sessionsPath, 'utf-8'));
      for (const sessionKey of Object.keys(data)) {
        // Session key format: "discord:channel:xxx", "feishu:xxx", "telegram:xxx", "cron:xxx", etc.
        const parts = sessionKey.split(':');
        const plat = parts[0]?.toLowerCase();
        if (['discord', 'telegram', 'signal', 'whatsapp', 'slack', 'feishu', 'lark'].includes(plat)) {
          // Normalize lark -> feishu
          platformSet.add(plat === 'lark' ? 'feishu' : plat);
        }
      }
    } catch (e) { }
  }

  // Also check gateway config channels
  const config = getOpenclawConfig();
  const channels = config?.channels || {};
  for (const key of Object.keys(channels)) {
    const plat = key.toLowerCase();
    if (['discord', 'telegram', 'signal', 'whatsapp', 'slack', 'feishu', 'lark'].includes(plat)) {
      // Check if this agent has accounts in that channel
      const accounts = channels[key]?.accounts || {};
      if (accounts[agentId]) {
        platformSet.add(plat === 'lark' ? 'feishu' : plat);
      }
    }
  }

  const platforms = [...platformSet];
  return platforms.length > 0 ? platforms : ['discord']; // default fallback
}

app.get('/api/status', authMiddleware, async (req, res) => {
  const config = getOpenclawConfig();
  const defaultModel = config?.agents?.defaults?.model?.primary || config?.defaultModel || 'unknown';

  let agentIds = [];
  if (existsSync(AGENTS_DIR)) {
    agentIds = readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }

  const botAccounts = agentIds.map(id => {
    const sessData = getAgentSessionData(id);
    // Support both array and object agent list formats
    let agentConfig = {};
    if (Array.isArray(config?.agents?.list)) {
      agentConfig = config.agents.list.find(a => a.id === id) || {};
    } else {
      agentConfig = config?.agents?.list?.[id] || {};
    }
    const model = agentConfig?.model?.primary || sessData.model || defaultModel;

    // Detect platform from session keys
    const platforms = detectAgentPlatforms(id);

    return {
      name: id,
      displayName: AGENT_DEPT_MAP[id] || id,
      status: 'online',
      model: model,
      sessions: sessData.sessions,
      inputTokens: sessData.inputTokens,
      outputTo
```

### Core Architecture Module: `gui/src/App.tsx`
```
import { useState, lazy, Suspense } from "react"
import type { TabName } from "./types"
import { useStatus } from "./hooks/useStatus"
import { useTheme } from "./theme"
import { PineappleLogo } from "./components/Logo"
import Login from "./pages/Login"

// 品牌名 — 修改此处即可全局替换
const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || '菠萝王朝'
const BRAND_SUBTITLE = import.meta.env.VITE_BRAND_SUBTITLE || 'Pineapple Dynasty'

// Lazy-loaded pages (code-splitting — reduces initial bundle, especially recharts-heavy pages)
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Departments = lazy(() => import("./pages/Departments"))
const TokenStats = lazy(() => import("./pages/TokenStats"))
const MessageLogs = lazy(() => import("./pages/MessageLogs"))
const SystemHealth = lazy(() => import("./pages/SystemHealth"))
const Sessions = lazy(() => import("./pages/Sessions"))
const Settings = lazy(() => import("./pages/Settings"))
const Court = lazy(() => import("./pages/Court"))
const Channels = lazy(() => import("./pages/Channels"))
const MemorialHall = lazy(() => import("./pages/MemorialHall"))
const Nodes = lazy(() => import("./pages/Nodes"))
const NotionBoard = lazy(() => import("./pages/NotionBoard"))
const Search = lazy(() => import("./pages/Search"))
const CronJobs = lazy(() => import("./pages/CronJobs"))
const Skills = lazy(() => import("./pages/Skills"))

const tabs: { key: TabName; label: string; icon: string }[] = [
  { key: "dashboard", label: "总览", icon: "📊" },
  { key: "court", label: "朝堂", icon: "🏯" },
  { key: "departments", label: "部门", icon: "🏛️" },
  { key: "tokens", label: "Token统计", icon: "🔥" },
  { key: "sessions", label: "会话", icon: "💬" },
  { key: "channels", label: "频道", icon: "📡" },
  { key: "nodes", label: "节点", icon: "🖥️" },
  { key: "notion", label: "奏章板", icon: "📜" },
  { key: "memorial", label: "奏报厅", icon: "🏮" },
  { key: "logs", label: "日志", icon: "📋" },
  { key: "search", label: "搜索", icon: "🔍" },
  { key: "cron", label: "定时", icon: "⏰" },
  { key: "skills", label: "技能", icon: "🧩" },
  { key: "system", label: "系统", icon: "⚙️" },
  { key: "settings", label: "设置", icon: "🔧" },
]

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('boluo_auth_token')
  })
  const [activeTab, setActiveTab] = useState<TabName>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<string | undefined>(undefined)
  const { theme, toggle: toggleTheme } = useTheme()
  const { data, loading, error, lastUpdated, refresh } = useStatus()

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />
  }

  const renderPage = () => {
    if (loading && !data) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-[#d4a574] text-lg animate-pulse">加载中...</div>
        </div>
      )
    }
    if (error && !data) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-[#ef4444] text-lg mb-2">连接失败</div>
            <div className="text-[#a3a3a3] text-sm mb-4">{error}</div>
            <div className="flex gap-3 justify-center">
              <button onClick={refresh} className="px-4 py-2 bg-[#1a1a2e] text-[#d4a574] border border-[#d4a574] hover:bg-[#16213e] cursor-pointer">
                重试
              </button>
              <button onClick={() => { localStorage.removeItem('boluo_auth_token'); setIsLoggedIn(false) }} className="px-4 py-2 bg-[#1a1a2e] text-[#a3a3a3] border border-[#a3a3a3]/30 hover:bg-[#16213e] cursor-pointer">
                重新登录
              </button>
            </div>
          </div>
        </div>
      )
    }
    if (!data) return null
    switch (activeTab) {
      case "dashboard": return <Dashboard data={data} onNavigate={(tab, filter) => {
        if (tab === 'sessions' && filter) {
          setSessionFilter(filter)
        }
        setActiveTab(tab as TabName)
      }} />
      case "court": return <Court />
      case "departments": return <Departments data={data} />
      case "tokens": return <TokenStats data={data} />
      case "sessions": return <Sessions initialFilter={sessionFilter} />
      case "channels": return <Channels />
      case "nodes": return <Nodes />
      case "notion": return <NotionBoard />
      case "memorial": return <MemorialHall />
      case "logs": return <MessageLogs data={data} />
      case "search": return <Search />
      case "cron": return <CronJobs />
      case "skills": return <Skills />
      case "system": return <SystemHealth data={data} />
      case "settings": return <Settings />
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-accent)' }}>
        
        {/* Logo */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-accent)' }}>
          <div className="flex items-center gap-2.5">
            <PineappleLogo size={32} />
            <div>
              <div className="text-base font-bold text-accent-gradient tracking-wide">{BRAND_NAME}</div>
              <div className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>
                {data?.uptime ? `运行 ${data.uptime}` : BRAND_SUBTITLE}
              </div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setSessionFilter(undefined); setActiveTab(tab.key); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'nav-active'
                  : ''
              }`}
              style={{
                borderLeft: activeTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
                backgroundColor: activeTab === tab.key ? 'var(--accent-glow)' : undefined,
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              onMouseEnter={e => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-glow)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.backgroundColor = ''
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-accent)' }}>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="flex-1 py-2 text-xs rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-accent)' }} title="刷新">↻ 刷新</button>
            <button onClick={toggleTheme} className="flex-1 py-2 text-xs rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-accent)' }}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <button
            onClick={() => { localStorage.removeItem('boluo_auth_token'); setIsLoggedIn(false) }}
            className="w-full mt-2 py-2 text-xs rounded-lg cursor-pointer transition-colors hover:text-red-500"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-accent)' }}
          >
            退出登录
          </button>
          {lastUpdated && (
            <div className="text-[10px] mt-2 text-center" style={{ color: 'var(--text-tertiary)' }}>
              更新: {lastUpdated.toLocaleTimeString("zh-CN")}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <div className="flex-1 min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 h-12 flex items-center justify-between px-4" style={{ backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-accent)' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-xl cursor-pointer" style={{ color: 'var(--accent)' }}>☰</button>
          <div className="flex items-center gap-2">
            <PineappleLogo size={22} />
            <span className="font-bold text-accent-gradient">{BRAND_NAME}</span>
          </div>
          <button onClick={refresh} className="cursor-pointer" style={{ color: 'var(--text-secondary)' }}>↻</button>
        </header>

        <main className="p-4 md:p-6 lg:p-8">
          {error && data && (
            <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}>{error}</div>
          )}
          <div key={activeTab} className="animate-slideIn">
            <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="text-[#d4a574] text-lg an
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #149** (2026-07-22): **P0: OTel 事件信封 + 裁判双向盲评与锚定 rubric**
  *Symptoms*: # P0: OTel 事件信封 + 裁判双向盲评与锚定 rubric  落实迭代路线图的 P0 两项（详见调研结论：`civagent-iteration-directions.md` §2.2 / §5.1）。  ## 改动  ### 1. 事件流 OTel 风格信封（schema v2）  每个事件在保留 legacy 字段（`matchId/seq/ts/type`）的基础上，纯增量追加：  - `event_id`（UUID）、`schema_version="2.0"`、`trace_id`（=matchId） - `span_id` / `parent_span_id`：`match_start` 为根 span，其余事件默认挂根，可显式覆盖 - `actor`（judge / skill-learner / system / regime）、`kind`（`tool_call|judge_score|skill_commit|...`）、`payload_hash`（sha256[:16]） - `model` / `model_version` / `prompt_hash` / `tokens` / `cost` 可选透传  同步更新 `schemas/match-event.schema.json`（新字段全部 optional，向后兼容）与前端类型。  ### 2. 裁判双向盲评 + 锚定 rubric  - **顺序交换双评**：每场对决跑两遍，第二遍交换呈现顺序（A/B→B/A），分数跨 pass 取均值；`CIVAGENT_JUDGE_SWAP=0` 可关闭 - **锚定 rubric**：沿用现有三维（legality/feasibility/resilience），改为四点量表 + 每维 4 级锚点，要求结构化 JSON 输出；解析失败回退原 markdown 解析（向后兼容） - **审计**：每个 pass 发一条 `judge_score` 事件，带 `provider/model`、`prompt_hash`、`swapped`、`order`、`parent_span_id` - manifest `judge` 段新增 `swap/passes/rubric/events`；`## Verdict` 段保留（前端依赖） - judge_chain 回退（codex → opencode-reviewer → cn-glm）与 `judge.mjs` 零改动  ## 测试  - 基线 79 pass → **94 pass / 0 fail**（新增 15 例：信封断言、swap 顺序与聚合、审计事件、失败路径、集成契约扩展） - `npm run lint:syntax` 通过  ## 待决策（不阻塞合并，可后续跟进）  1. `schema_version` 取值：`"2.0"` vs 三段式 `"2.0.0"` 2. 分数归一：rubric 1-4 量表归一到 /10 上报（dims 保留原始值）；如需直接暴露 1-4 原始分需同步改前端 3. rubric 锚点英文措辞建议过一遍（`JUDGE_RUBRIC_PROMPT`） 4. 锦标赛级审计事件写在 `matches/<tournamentId>/events.jsonl`，可能被前端 HistoryExplorer 当作对局列出（带 `tournament:true` 标记可过滤） 5. 目前裁判仍可见政体名（仅隐 backend）；如需连政
  **Post-Mortem & Fix Analysis**:
  > 误开：本 PR 应开在 fork（LeoLin990405/civagent）自身，非上游。已关闭，抱歉打扰。
  > 您好，邮件已收到，谢谢！

- **Issue #145** (2026-05-22): **feat: 适配 OpenClaw v2026.5.20 + Node.js 22.19 门槛**
  *Symptoms*: ## Summary  把项目从 OpenClaw v2026.5.7 适配到最新 v2026.5.20。无破坏性变更,现有 `openclaw.json` 无需改动。  - **Node.js 最低 22.16 → 22.19**(对齐上游 v2026.5.19 强制要求) - **文档版本占位符**统一刷到 2026.5.20 - **新增升级章节**汇总 v2026.5.8 ~ v2026.5.20 的所有新增可选字段和 Docker 构建参数改名  ## 变更明细  | 文件 | 改动 | |------|------| | `install.ps1` | 版本探测加入 minor 校验;Windows 安装器 v22.14.0 → v22.19.0 | | `install-mac.sh` | Node 检测函数化(`node_meets_floor`),需 >= 22.19 | | `doctor.sh` | `[1/9]` Node 检查接受 22.19+ | | `package.json` | `engines.node` >=22.16.0 → >=22.19.0;version 3.6.0 → 3.7.1 | | `EXTERNAL_HERMES.md` / `hermes.example.yaml` / `CONTRIBUTING.md` | 版本占位符同步 | | `CHANGELOG.md` | 新增 v3.7.1 entry | | `docs/openclaw-upgrade-guide.md` | 末尾新增"升级到 2026.5.20"章节,列出新增可选字段(`agents.list[].experimental.localModelLean`、`voice.realtime.bootstrapContextFiles`、`models.providers.<id>.timeoutSeconds`、`security.audit.suppressions`、Discord `agentComponents.ttlMs`、`tools.alsoAllow` 等)和 `OPENCLAW_DOCKER_APT_PACKAGES` → `OPENCLAW_IMAGE_APT_PACKAGES` 改名 |  ## Test plan  - [x] `bash -n install-mac.sh` / `bash -n doctor.sh` 语法通过 - [x] `package.json` / `openclaw.example.json` JSON 解析有效 - [x] `npm test` — 19/19 jest 用例通过 - [x] Node 版本检测逻辑 smoke test:`v22.19.0` pass、`v22.18.0` warn、`v22.20.5` pass、`v23.x` pass、`v20.x` warn、`none` fail - [ ] (手测) Windows 上执行 `install.ps1`,看是否能从 v22.x → v22.19.x - [ ] (手测) macOS 上 Node 22.16 跑 `install-mac.sh`,确认触发升级路径  https://claude.ai/code/session_01L2AJsVj62yfchX76wbnLrV  --- _Generated by [Claude Code](https://claude.ai/code/session

- **Issue #143** (2026-05-10): **chore: 修 ShellCheck 旧 warning + 补全 16 个 Hermes personality**
  *Symptoms*: ## Summary  - **ShellCheck 收尾**:把 main 分支上 pre-existing 的 ShellCheck warning 全部清掉(`scripts/health-check.sh`、`scripts/install-common.sh`、`entrypoint.sh`)。本地 `shellcheck -S warning --format=gcc` 三文件零 warning。 - **Hermes personalities 全员到齐**:补全 16 个,总计 19 个角色,覆盖 OpenClaw `agents.list[]` 全集。  ## ShellCheck 修复  | 文件 | 规则 | 修复方式 | |---|---|---| | `scripts/health-check.sh` | SC2034 `ALERT_THRESHOLD_COST_DAILY` | 加 `# shellcheck disable=SC2034`(配置常量保留) | | `scripts/health-check.sh` | SC2206 `missing+=($cmd)` | quote: `missing+=("$cmd")` | | `scripts/health-check.sh` | SC2155 ×7 处 | `local foo=$(cmd)` → `local foo; foo=$(cmd)` | | `scripts/install-common.sh` | SC2034 颜色常量 BLUE/BOLD/... | 6 处颜色常量逐行 `# shellcheck disable=SC2034` | | `entrypoint.sh` | SC2034 `GATEWAY_PID` | 加 disable + 注释(`exec node` 后变量自然失效) |  ## Hermes Personalities 补全  | 分组 | 文件 | |---|---| | 六部 | bingbu / hubu / libu / gongbu / libu2 / xingbu | | 翰林院 5 子 | hanlin_zhang / xiuzhuan / bianxiu / jiantao / shujishi | | 侍奉 5 角色 | qijuzhu / guozijian / taiyiyuan / neiwufu / yushanfang |  内容直接从 `openclaw.example.json` 的 `agents.list[i].identity.theme` 抽取,frontmatter `name` / `display_name` 对齐 OpenClaw 字段。  ## 文档同步  - `configs/hermes/personalities/README.md` 改为「全部 19 角色已交付」(分组列表) - `install-hermes.sh` 完成提示从「14 角色 + claw migrate」改为「全部 19 角色已就绪」  ## Test plan  - [x] `bash -n` 三文件全通过 - [x] `shellcheck -S warning --format=gcc` 三文件零 warning - [x] 19 个 personality .md 都含正确 YAML frontmatter - [ ] `gh run watch` 验证 CI lint-and-valid

- **Issue #142** (2026-05-10): **feat: 适配 OpenClaw v2026.5.7 + 新增 Hermes Agent 并行 runtime**
  *Symptoms*: ## Summary  - **OpenClaw v2026.5.7 适配**:补齐 Discord `applicationId` 字段(67 处遗漏跨 4 个 JSON),新版 slash 命令注册必需 - **Hermes Agent 并行 runtime**:与 OpenClaw 平行,同一套 14 Agent 朝廷设定可二选一或并存 - 14 角色完整迁移可用 `hermes claw migrate` 自动化  ## OpenClaw 侧改动  | 文件 | 变更 | |---|---| | `openclaw.example.json` | + 15 处 Discord applicationId | | `configs/feishu/openclaw.json` | + 19 处 | | `configs/ming-neige/openclaw.json` | + 19 处 | | `configs/tang-sansheng/openclaw.json` | + 15 处(唐朝制 zhongshusheng/menxiasheng/...) | | `scripts/install-lite.sh` | Discord 流程新增 Application ID 输入 + sed 替换 |  ## Hermes 侧新增  | 文件 | 用途 | |---|---| | `hermes.example.yaml` | 配置模板,对齐 v0.13.0 | | `EXTERNAL_HERMES.md` | 安装/token/personality 映射/故障排除 | | `install-hermes.sh` | 一键安装(平行于 install-lite.sh) | | `docker-compose.hermes.yml` | 容器编排,与 OpenClaw compose 互不冲突 | | `configs/hermes/env.example` | 多 provider 环境变量模板 | | `configs/hermes/personalities/{silijian,neige,duchayuan}.md` | 3 个核心角色 | | `configs/hermes/personalities/README.md` | 14 角色完整生成脚本 |  ## 文档同步  - `README.md` 快速开始新增「方式四:用 Hermes Agent runtime」 - `PROJECTS.md` 相关仓库表新增 Hermes Agent - `package.json` keywords += hermes-agent / nous-research - `CHANGELOG.md` 新增 v3.7.0 (2026-05-10) 条目  ## Rebase 解冲突说明  本分支基于 origin/main rebase,以下两个文件冲突已按对应方向解决: - `install-lite.sh` — 接受 origin/main 的 wrapper 版本,实际逻辑改动改 apply 到 `scripts/install-lite.sh`(架构对齐 a6f4423) - `configs/tang-sansheng/openclaw.json` — 接受 origin/main 的唐朝制版本(35e5834),applicationId 重新对应 zhongshusheng/menxiasheng/shangshusheng/yu

- **Issue #137** (2026-05-04): **fix: 安装脚本支持复用已有 OpenClaw 模型配置**
  *Symptoms*: ## Summary - 安装脚本步骤 2.5 改为智能检测：扫描已有 OpenClaw 配置中真实 `baseUrl` 的 provider，提示用户复用并跳过手动输入 - 检测条件兼容 `apiKey` / `authHeader` / 纯环境变量等多种 OpenClaw 认证方式（不再只认 `apiKey` 字段） - 提取 `scripts/install-common.sh` 共享 `configure_llm` / `detect_config_path` / `inject_llm_config` / `check_jq` / `check_openclaw` - 移动 `install-lite.sh` → `scripts/install-lite.sh`，重构为使用共享函数，移除 Python JSON 操作改用 jq - 根目录 `install-lite.sh` 保留为向后兼容 wrapper - `full-install.sh` 本地运行时通过 `git rev-parse` 检测本地仓库，避免不必要的克隆；验证步骤、清理提示逻辑同步适配  ## Test plan - [ ] 本地 `bash scripts/full-install.sh`：已有 OpenClaw 配置时步骤 2.5 提示复用，选 Y 跳过手动输入，步骤 6 验证通过 - [ ] 本地运行不触发克隆，不提示删除临时目录 - [ ] `bash <(curl ...full-install.sh)` 远程运行时正常克隆，结束时提示清理临时目录 - [ ] `bash scripts/install-lite.sh` 复用检测同样生效 - [ ] 根目录 `bash install-lite.sh` 通过 wrapper 正常工作  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #135** (2026-04-12): **fix: 唐三省制配置使用正确的唐朝官制**
  *Symptoms*: ## Summary `tang-sansheng` 配置中错误使用了明朝官制（司礼监、内阁、都察院），现替换为正确的唐朝三省六部制：  | 旧 (明制) | 新 (唐制) | 职能 | |-----------|-----------|------| | 司礼监 (silijian) | **中书省** (zhongshusheng) | 决策起草 | | 内阁 (neige) | **门下省** (menxiasheng) | 审核封驳 | | — | **尚书省** (shangshusheng) | 执行派发（新增） | | 都察院 (duchayuan) | **御史台** (yushitai) | 独立监察 |  流程：`中书省起草 → 门下省审核 → 尚书省派发 → 六部执行`，御史台独立监察  ## 影响文件 - `configs/tang-sansheng/openclaw.json` — 主配置 - `configs/feishu-tang/openclaw.json` — 飞书配置  六部、翰林院保持不变。  ## Test plan - [ ] `openclaw doctor` 配置验证通过 - [ ] 中书省起草 → 门下省审核 → 尚书省派发流程正常 - [ ] 御史台独立监察正常  Fixes #131  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #134** (2026-04-12): **fix: 适配最新 OpenClaw 配置格式**
  *Symptoms*: ## Summary - 移除已废弃的 root keys: `_comment`, `_regime`, `_version`, `_description` - `api: "openai"` → `"openai-completions"`（OpenClaw 2026.4+ 要求） - 移除已废弃的 agent key: `runTimeoutSeconds`  ## 影响文件（14个） - `openclaw.example.json` - `configs/ming-neige/openclaw.json` - `configs/tang-sansheng/openclaw.json` - `configs/modern-ceo/openclaw.json` - `configs/feishu-ming/openclaw-{1,3,5,9}bot.json` - `configs/feishu-modern/openclaw-{1,3,9}bot.json` - `configs/feishu-tang/openclaw-{1,3,11}bot.json`  ## Test plan - [ ] `openclaw doctor` 不再报 config validation error - [ ] `openclaw status` 正常启动  Fixes #133, #110  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #133** (2026-04-12): **我是使用的full-install.sh，执行完成后提示配置文件有问题，"_comment", "_regime"**
  *Symptoms*: ``` king@KingdeMacBook-Air-568 danghuangshang % openclaw status Invalid config at /Users/king/.openclaw/openclaw.json:\n- agents.list.9: Unrecognized key: "runTimeoutSeconds" - <root>: Unrecognized keys: "_comment", "_regime"  🦞 OpenClaw 2026.4.8 (9ece252) — I'll do the boring stuff while you dramatically stare at the logs like it's cinema.  Config invalid File: ~/.openclaw/openclaw.json Problem:   - agents.list.9: Unrecognized key: "runTimeoutSeconds"   - <root>: Unrecognized keys: "_comment", "_regime"  Run: openclaw doctor --fix [openclaw] Failed to start CLI: Error: Invalid config at /Users/king/.openclaw/openclaw.json: - agents.list.9: Unrecognized key: "runTimeoutSeconds" - <root>: Unrecognized keys: "_comment", "_regime"     at createInvalidConfigError (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:3610:32)     at throwInvalidConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:3623:8)     at Object.loadConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:19243:5)     at file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:19669:56     at loadPinnedRuntimeConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/runtime-snapshot-BVfF9E0s.js:42:17)     at loadConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:19669:9)     at resolvePluginRuntimeLoadContext (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:1730:39)     at ens
  **Post-Mortem & Fix Analysis**:
  > 感觉好像是和最新版龙虾不适配 

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

### Incident Patch 1: `a6f44236` (2026-04-16)
**Commit Message**: fix: 安装脚本支持复用已有 OpenClaw 模型配置

- 步骤 2.5 改为智能检测：扫描 ~/.openclaw / ~/.clawdbot 中已有
  真实 baseUrl 的 provider，提示用户复用并跳过手动输入
- 检测条件兼容 apiKey / authHeader / 纯环境变量等多种认证方式
- 提取 install-common.sh 共享 configure_llm / detect_config_path /
  inject_llm_config / check_jq / check_openclaw
- 移动 install-lite.sh → scripts/，重构为使用共享函数，
  移除 Python JSON 操作改用 jq
- 根目录 install-lite.sh 保留为向后兼容 wrapper
- full-install.sh 本地运行时优先用本地仓库（git rev-parse 判断），
  不在 git 仓库内才克隆远程

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `install-lite.sh` (modified, +3/-343)
```diff
@@ -1,344 +1,4 @@
 #!/bin/bash
-
-# ========================================
-# AI 朝廷 · 快速安装脚本
-# ========================================
-# 支持：
-# - 三种制度：明朝/唐朝/现代
-# - 多种规模：1/3/5/9/11 Bot
-# - 两个平台：飞书/Discord
-# - LLM API 配置
-# ========================================
-
-set -e
-
-# 颜色定义
-RED='\033[0;31m'
-GREEN='\033[0;32m'
-YELLOW='\033[1;33m'
-BLUE='\033[0;34m'
-CYAN='\033[0;36m'
-NC='\033[0m'
-
-echo -e "${BLUE}"
-echo "========================================"
-echo "   AI 朝廷 · 快速安装向导"
-echo "========================================"
-echo -e "${NC}"
-
-# 配置目录
-CONFIG_DIR="$HOME/.openclaw"
-CONFIG_FILE="openclaw.json"
-
-# 创建配置目录
-mkdir -p "$CONFIG_DIR"
-
-# ========================================
-# 步骤 1: 配置 LLM API
-# ========================================
-echo -e "${YELLOW}[1/5] 配置 AI 模型 (必需)${NC}"
-echo ""
-echo "常用 API 提供商："
-echo "  - Anthropic Claude: https://console.anthropic.com"
-echo "  - OpenAI: https://platform.openai.com"
-echo "  - DeepSeek: https://platform.deepseek.com"
-echo "  - OpenRouter: https://openrouter.ai"
-echo "  - DashScope (通义千问): https://dashscope.aliyun.com"
-echo ""
-read -p "API Base URL (如 https://api.deepseek.com/v1): " API_URL
-read -s -p "API Key: " API_KEY
-echo ""
-read -p "模型 ID (如 deepseek-chat, gpt-4o, claude-sonnet-4-20250514): " MODEL_ID
-echo ""
-
-if [ -z "$API_URL" ] || [ -z "$API_KEY" ] || [ -z "$MODEL_ID" ]; then
-    echo -e "${RED}✗ API 配置不能为空${NC}"
-    exit 1
-fi
-
-# 自动检测 API 格式
-API_FORMAT="openai"
-if echo "$API_URL" | grep -qi "anthropic"; then
-    API_FORMAT="anthropic-messages"
-fi
-
-echo -e "${GREEN}✓ API 配置完成${NC}"
-
-# ========================================
-# 步骤 2: 选择平台
-# ========================================
-echo ""
-echo -e "${YELLOW}[2/5] 选择部署平台${NC}"
-echo "  1) 飞书 (中国大陆推荐)"
-echo "  2) Discord (国际推荐)"
-echo "  3) 纯 WebUI (不需要 Bot)"
-echo ""
-read -p "请选择 (1-3): " PLATFORM
-
-case $PLATFORM in
-    1)
-        PLATFORM_NAME="feishu"
-        echo -e "${GREEN}✓ 选择：飞书${NC}"
-        ;;
-    2)
-        PLATFORM_NAME="discord"
-        echo -e "${GREEN}✓ 选择：Discord${NC}"
-        ;;
-    3)
-        PLATFORM_NAME="webui"
-        echo -e "${GREEN}✓ 选择：纯 WebUI${NC}"
-        ;;
-    *)
-        echo -e "${RED}✗ 无效选择，使用飞书${NC}"
-        PLATFORM_NAME="feishu"
-        ;;
-esac
-
-# ========================================
-# 步骤 3: 选择制度
-# ========================================
-echo ""
-echo -e "${YELLOW}[3/5] 选择制度${NC}"
-echo "  1) 明朝内阁制 (传统层级管理)"
-echo "  2) 唐朝三省制 (分权制衡管理)"
-echo "  3) 现代企业制 (现代企业管理)"
-echo ""
-read -p "请选择 (1-3): " REGIME
-
-case $REGIME in
-    1)
-        REGIME_NAME="ming"
-        REGIME_LABEL="明朝内阁制"
-        echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
-        ;;
-    2)
-        REGIME_NAME="tang"
-        REGIME_LABEL="唐朝三省制"
-        echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
-        ;;
-    3)
-        REGIME_NAME="modern"
-        REGIME_LABEL="现代企业制"
-        echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
-        ;;
-    *)
-        echo -e "${RED}✗ 无效选择，使用明朝内阁制${NC}"
-        REGIME_NAME="ming"
-        REGIME_LABEL="明朝内阁制"
-        ;;
-esac
-
-# ========================================
-# 步骤 4: 选择 Bot 数量
-# ========================================
-echo ""
-echo -e "${YELLOW}[4/5] 选择 Bot 数量${NC}"
-
-if [ "$PLATFORM_NAME" = "webui" ]; then
-    echo "  WebUI 模式使用单 Agent"
-    BOT_CHOICE="1"
-else
-    # 根据制度显示不同选项
-    if [ "$REGIME_NAME" = "ming" ]; then
-        echo "  1) 1 Bot - 司礼监 (个人开发者)"
-        echo "  2) 3 Bot - 司礼监 + 内阁 + 工部 (小团队⭐推荐)"
-        echo "  3) 5 Bot - 司礼监 + 内阁 + 都察院 + 兵部 + 工部 (中型团队)"
-        echo "  4) 9 Bot - 完整版 (大型团队)"
-    elif [ "$REGIME_NAME" = "tang" ]; then
-        echo "  1) 1 Bot - 中书省 (个人开发者)"
-        echo "  2) 3 Bot - 中书省 + 门下省 + 尚书省 (小团队⭐推荐)"
-        echo "  3) 11 Bot - 完整版 (大型团队)"
-    else
-        echo "  1) 1 Bot - CEO (个人开发者)"
-        echo "  2) 3 Bot - CEO + CTO + QA (小团队⭐推荐)"
-        echo "  3) 9 Bot - 完整版 (大型团队)"
-    fi
-    echo ""
-    read -p "请选择：" BOT_CHOICE
-fi
-
-# 根据制度和选择确定配置文件
-if [ "$REGIME_NAME" = "ming" ]; then
-    case $BOT_CHOICE in
-        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
-        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
-        3) CONFIG_TEMPLATE="openclaw-5bot.json" ;;
-        *) CONFIG_TEMPLATE="openclaw.json" ;;
-    esac
-elif [ "$REGIME_NAME" = "tang" ]; then
-    case $BOT_CHOICE in
-        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
-        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
-        *) CONFIG_TEMPLATE="openclaw.json" ;;
-    esac
-else
-    case $BOT_CHOICE in
-        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
-        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
-        *) CONFIG_TEMPLATE="openclaw.json" ;;
-    esac
-fi
-
-CONFIG_SOURCE="$HOME/clawd/danghuangshang/configs/feishu-$REGIME_NAME/$CONFIG_TEMPLATE"
-
-echo -e "${GREEN}✓ 配置模板：$CONFIG_TEMPLATE${NC}"
-
-# ========================================
-# 步骤 5: 收集平台凭证
-# ========================================
-echo ""
-echo -e "${YELLOW}[5/5] 
```

**File**: `scripts/full-install.sh` (modified, +78/-104)
```diff
@@ -8,19 +8,13 @@
 
 set -e
 
-CYAN='\033[0;36m'
-GREEN='\033[0;32m'
-YELLOW='\033[1;33m'
-RED='\033[0;31m'
-BLUE='\033[0;34m'
-BOLD='\033[1m'
-NC='\033[0m'
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 
 echo ""
-echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
-echo -e "${CYAN}║    🏯 AI 朝廷 · danghuangshang      ║${NC}"
-echo -e "${CYAN}║        完整安装向导                  ║${NC}"
-echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
+echo -e "\033[0;36m╔══════════════════════════════════════╗\033[0m"
+echo -e "\033[0;36m║    🏯 AI 朝廷 · danghuangshang      ║\033[0m"
+echo -e "\033[0;36m║        完整安装向导                  ║\033[0m"
+echo -e "\033[0;36m╚══════════════════════════════════════╝\033[0m"
 echo ""
 
 # ============================================
@@ -29,16 +23,30 @@ echo ""
 
 echo -e "${BLUE}[0/6] 准备环境...${NC}"
 
-INSTALL_DIR="$HOME/danghuangshang-installer"
-
-if [ -d "$INSTALL_DIR" ]; then
-  echo -e "  ${YELLOW}i${NC} 清理旧安装目录"
-  rm -rf "$INSTALL_DIR"
+# 加载共享函数（从脚本所在目录，本地运行时立即可用）
+if [ -f "$SCRIPT_DIR/install-common.sh" ]; then
+  source "$SCRIPT_DIR/install-common.sh"
 fi
 
-echo -e "  ${CYAN}正在克隆仓库...${NC}"
-git clone --depth 1 https://github.com/wanikua/danghuangshang.git "$INSTALL_DIR"
-echo -e "  ${GREEN}✓${NC} 仓库已克隆到：$INSTALL_DIR"
+# 定位仓库目录：优先用脚本所在仓库，找不到再克隆
+INSTALL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
+
+if git -C "$INSTALL_DIR" rev-parse --git-dir &>/dev/null; then
+  echo -e "  ${GREEN}✓${NC} 使用本地仓库：$INSTALL_DIR"
+else
+  INSTALL_DIR="$HOME/danghuangshang-installer"
+  if [ -d "$INSTALL_DIR" ]; then
+    echo -e "  ${YELLOW}i${NC} 清理旧安装目录"
+    rm -rf "$INSTALL_DIR"
+  fi
+
+  echo -e "  ${CYAN}正在克隆仓库...${NC}"
+  git clone --depth 1 https://github.com/wanikua/danghuangshang.git "$INSTALL_DIR"
+  echo -e "  ${GREEN}✓${NC} 仓库已克隆到：$INSTALL_DIR"
+
+  # 远程克隆后加载共享函数
+  source "$INSTALL_DIR/scripts/install-common.sh"
+fi
 
 cd "$INSTALL_DIR"
 
@@ -49,31 +57,8 @@ cd "$INSTALL_DIR"
 echo ""
 echo -e "${BLUE}[1/6] 检查环境...${NC}"
 
-if command -v openclaw &>/dev/null; then
-  OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
-  echo -e "  ${GREEN}✓${NC} OpenClaw 已安装：$OPENCLAW_VERSION"
-else
-  echo -e "  ${RED}✗${NC} OpenClaw 未安装"
-  echo ""
-  echo "  正在安装 OpenClaw..."
-  npm install -g openclaw
-  echo -e "  ${GREEN}✓${NC} OpenClaw 已安装"
-fi
-
-if ! command -v jq &>/dev/null; then
-  echo -e "  ${YELLOW}⚠${NC} jq 未安装，正在安装..."
-  if command -v apt &>/dev/null; then
-    sudo apt update && sudo apt install -y jq
-  elif command -v brew &>/dev/null; then
-    brew install jq
-  else
-    echo -e "  ${RED}✗${NC} 请手动安装 jq"
-    exit 1
-  fi
-  echo -e "  ${GREEN}✓${NC} jq 已安装"
-else
-  echo -e "  ${GREEN}✓${NC} jq 已安装"
-fi
+check_openclaw
+check_jq
 
 echo ""
 
@@ -126,61 +111,31 @@ echo ""
 # ============================================
 
 # ============================================
-# 步骤 2.5: 配置 LLM API (新增)
+# 步骤 2.5: 配置 AI 模型（智能检测）
 # ============================================
 
 echo ""
 echo -e "${BLUE}[2.5/7] 配置 AI 模型...${NC}"
-echo ""
-echo "  常用 API 提供商："
-echo "  - DeepSeek: https://platform.deepseek.com"
-echo "  - OpenAI: https://platform.openai.com"
-echo "  - Anthropic: https://console.anthropic.com"
-echo "  - OpenRouter: https://openrouter.ai"
-echo "  - DashScope (通义千问): https://dashscope.aliyun.com"
-echo ""
-
-read -p "  API Base URL (如 https://api.deepseek.com/v1): " LLM_API_URL
-read -s -p "  API Key: " LLM_API_KEY
-echo ""
-read -p "  模型 ID (如 deepseek-chat, gpt-4o, claude-sonnet-4-20250514): " LLM_MODEL_ID
-echo ""
-
-if [ -z "$LLM_API_URL" ] || [ -z "$LLM_API_KEY" ] || [ -z "$LLM_MODEL_ID" ]; then
-  echo -e "${RED}✗ API 配置不能为空${NC}"
-  exit 1
-fi
-
-# 自动检测 API 格式
-LLM_API_FORMAT="openai"
-if echo "$LLM_API_URL" | grep -qi "anthropic"; then
-  LLM_API_FORMAT="anthropic-messages"
-fi
-
-echo -e "  ${GREEN}✓${NC} API 配置完成"
+configure_llm
 echo ""
 
 # 步骤 3: 备份现有配置
 # ============================================
 
 echo -e "${BLUE}[4/7] 配置处理...${NC}"
 
-CONFIG_DIR="$HOME/.openclaw"
-CLAWDBOT_CONFIG="$HOME/.clawdbot/openclaw.json"
-CONFIG_FILE="$CONFIG_DIR/openclaw.json"
-
-# 检测配置目录
-if [ -f "$CLAWDBOT_CONFIG" ] && [ ! -f "$CONFIG_FILE" ]; then
-  CONFIG_DIR="$HOME/.clawdbot"
-  CONFIG_FILE="$CLAWDBOT_CONFIG"
-  echo -e "  ${YELLOW}i${NC} 使用 .clawdbot 配置目录"
-elif [ -f "$CONFIG_FILE" ]; then
-  echo -e "  ${YELLOW}i${NC} 使用 .openclaw 配置目录"
-elif [ -f "$CLAWDBOT_CONFIG" ]; then
-  CONFIG_DIR="$HOME/.clawdbot"
-  CONFIG_FILE="$CLAWDBOT_CONFIG"
-  echo -e "  ${YELLOW}i${NC} 使用 .clawdbot 配置目录"
+# 复用 configure_llm 已检测到的配置路径（或重新检测）
+if [ -z "$OPENCLAW_CONFIG_FILE" ]; then
+  detect_config_path
+fi
+
+if [ -n "$OPENCLAW_CONFIG_FILE" ]; then
+  CONFIG_DIR="$(dirname "$OPENCLAW_CONFIG_FILE")"
+  CONFIG_FILE="$OPENCLAW_CONFIG_FILE"
+  echo -e "  ${YELLOW}i${NC} 使用配置目录：$CONFIG_DIR"
 else
+  CONFIG_DIR="$HOME/.openclaw"
+  CONFIG_FILE="$CONFIG_DIR/openclaw.json"
   echo -e "  ${YELLOW}i${NC} 将创建新配置"
 fi
 
@@ -257,12 +212,19 @@ else
   ec
```

**File**: `scripts/install-common.sh` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+#!/bin/bash
+# ============================================
+# danghuangshang 安装脚本共享函数
+# ============================================
+
+# 颜色常量
+RED='\033[0;31m'
+GREEN='\033[0;32m'
+YELLOW='\033[1;33m'
+BLUE='\033[0;34m'
+CYAN='\033[0;36m'
+BOLD='\033[1m'
+NC='\033[0m'
+
+# 确保 jq 已安装
+check_jq() {
+  if ! command -v jq &>/dev/null; then
+    echo -e "${YELLOW}⚠${NC} jq 未安装，正在安装..."
+    if command -v apt &>/dev/null; then
+      sudo apt update && sudo apt install -y jq
+    elif command -v brew &>/dev/null; then
+      brew install jq
+    else
+      echo -e "${RED}✗${NC} 请手动安装 jq"
+      exit 1
+    fi
+    echo -e "${GREEN}✓${NC} jq 已安装"
+  else
+    echo -e "  ${GREEN}✓${NC} jq 已安装"
+  fi
+}
+
+# 确保 OpenClaw 已安装
+check_openclaw() {
+  if command -v openclaw &>/dev/null; then
+    OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
+    echo -e "  ${GREEN}✓${NC} OpenClaw 已安装：$OPENCLAW_VERSION"
+  else
+    echo -e "  ${RED}✗${NC} OpenClaw 未安装"
+    echo "  正在安装 OpenClaw..."
+    npm install -g openclaw
+    echo -e "  ${GREEN}✓${NC} OpenClaw 已安装"
+  fi
+}
+
+# 检测 OpenClaw 配置文件路径
+# 设置变量：OPENCLAW_CONFIG_FILE（找到则为路径，否则为空）
+detect_config_path() {
+  OPENCLAW_CONFIG_FILE=""
+  for _cfg in "$HOME/.openclaw/openclaw.json" "$HOME/.clawdbot/openclaw.json"; do
+    if [ -f "$_cfg" ]; then
+      OPENCLAW_CONFIG_FILE="$_cfg"
+      break
+    fi
+  done
+}
+
+# 智能检测并配置 LLM API
+# 检测已有 OpenClaw 配置中的模型设定，支持复用
+# 设置变量：LLM_API_URL, LLM_API_KEY, LLM_MODEL_ID, LLM_API_FORMAT, REUSE_MODELS
+configure_llm() {
+  detect_config_path
+
+  REUSE_MODELS=false
+
+  if [ -n "$OPENCLAW_CONFIG_FILE" ]; then
+    # 检测真实 provider：baseUrl 存在且不是占位符
+    # 兼容 apiKey / authHeader / 纯环境变量 等多种认证方式
+    _real_providers=$(jq -r '
+      [.models.providers | to_entries[] |
+        select(.value.baseUrl // "" |
+          . != "" and (. | startswith("https://your-") | not))
+      ] | length
+    ' "$OPENCLAW_CONFIG_FILE" 2>/dev/null || echo 0)
+
+    if [ "$_real_providers" -gt 0 ]; then
+      _provider_names=$(jq -r '.models.providers | keys | join(", ")' "$OPENCLAW_CONFIG_FILE" 2>/dev/null || echo "unknown")
+      echo ""
+      echo -e "  ${GREEN}✓${NC} 检测到现有 OpenClaw 模型配置"
+      echo -e "  ${CYAN}  提供者：${_provider_names}${NC}"
+      echo -e "  ${CYAN}  配置文件：${OPENCLAW_CONFIG_FILE}${NC}"
+      echo ""
+      read -p "  是否复用现有模型配置？(Y/n) " REUSE_CHOICE
+      if [ "$REUSE_CHOICE" != "n" ] && [ "$REUSE_CHOICE" != "N" ]; then
+        REUSE_MODELS=true
+        echo -e "  ${GREEN}✓${NC} 将复用现有模型配置"
+      fi
+    fi
+  fi
+
+  if [ "$REUSE_MODELS" = "false" ]; then
+    echo ""
+    echo "  常用 API 提供商："
+    echo "  - DeepSeek: https://platform.deepseek.com"
+    echo "  - OpenAI: https://platform.openai.com"
+    echo "  - Anthropic: https://console.anthropic.com"
+    echo "  - OpenRouter: https://openrouter.ai"
+    echo "  - DashScope (通义千问): https://dashscope.aliyun.com"
+    echo ""
+
+    read -p "  API Base URL (如 https://api.deepseek.com/v1): " LLM_API_URL
+    read -s -p "  API Key: " LLM_API_KEY
+    echo ""
+    read -p "  模型 ID (如 deepseek-chat, gpt-4o, claude-sonnet-4-20250514): " LLM_MODEL_ID
+    echo ""
+
+    if [ -z "$LLM_API_URL" ] || [ -z "$LLM_API_KEY" ] || [ -z "$LLM_MODEL_ID" ]; then
+      echo -e "${RED}✗ API 配置不能为空${NC}"
+      exit 1
+    fi
+
+    LLM_API_FORMAT="openai-completions"
+    if echo "$LLM_API_URL" | grep -qi "anthropic"; then
+      LLM_API_FORMAT="anthropic-messages"
+    fi
+
+    echo -e "  ${GREEN}✓${NC} API 配置完成"
+  fi
+}
+
+# 将 LLM 配置注入到 JSON 配置文件（jq 操作）
+# 参数: $1 = 配置文件路径
+inject_llm_config() {
+  local config_file="$1"
+  local provider_key
+  provider_key=$(jq -r '.models.providers | keys[0]' "$config_file")
+
+  jq --arg url "$LLM_API_URL" \
+     --arg key "$LLM_API_KEY" \
+     --arg format "$LLM_API_FORMAT" \
+     --arg provider "$provider_key" \
+    '.models.providers[$provider].baseUrl = $url |
+     .models.providers[$provider].apiKey = $key |
+     .models.providers[$provider].api = $format' \
+    "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"
+  echo -e "    ${GREEN}✓${NC} LLM 配置已注入（提供者：$provider_key）"
+}
```

**File**: `scripts/install-lite.sh` (added, +305/-0)
```diff
@@ -0,0 +1,305 @@
+#!/bin/bash
+
+# ========================================
+# AI 朝廷 · 快速安装脚本
+# ========================================
+# 支持：
+# - 三种制度：明朝/唐朝/现代
+# - 多种规模：1/3/5/9/11 Bot
+# - 两个平台：飞书/Discord
+# - LLM API 配置（智能复用已有 OpenClaw 配置）
+# ========================================
+
+set -e
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+source "$SCRIPT_DIR/install-common.sh"
+
+echo -e "${BLUE}"
+echo "========================================"
+echo "   AI 朝廷 · 快速安装向导"
+echo "========================================"
+echo -e "${NC}"
+
+# 确保依赖
+check_jq
+
+# 配置目录
+CONFIG_DIR="$HOME/.openclaw"
+CONFIG_FILE="openclaw.json"
+
+# 创建配置目录
+mkdir -p "$CONFIG_DIR"
+
+# ========================================
+# 步骤 1: 配置 LLM API（智能检测）
+# ========================================
+echo -e "${YELLOW}[1/5] 配置 AI 模型${NC}"
+configure_llm
+
+# ========================================
+# 步骤 2: 选择平台
+# ========================================
+echo ""
+echo -e "${YELLOW}[2/5] 选择部署平台${NC}"
+echo "  1) 飞书 (中国大陆推荐)"
+echo "  2) Discord (国际推荐)"
+echo "  3) 纯 WebUI (不需要 Bot)"
+echo ""
+read -p "请选择 (1-3): " PLATFORM
+
+case $PLATFORM in
+    1)
+        PLATFORM_NAME="feishu"
+        echo -e "${GREEN}✓ 选择：飞书${NC}"
+        ;;
+    2)
+        PLATFORM_NAME="discord"
+        echo -e "${GREEN}✓ 选择：Discord${NC}"
+        ;;
+    3)
+        PLATFORM_NAME="webui"
+        echo -e "${GREEN}✓ 选择：纯 WebUI${NC}"
+        ;;
+    *)
+        echo -e "${RED}✗ 无效选择，使用飞书${NC}"
+        PLATFORM_NAME="feishu"
+        ;;
+esac
+
+# ========================================
+# 步骤 3: 选择制度
+# ========================================
+echo ""
+echo -e "${YELLOW}[3/5] 选择制度${NC}"
+echo "  1) 明朝内阁制 (传统层级管理)"
+echo "  2) 唐朝三省制 (分权制衡管理)"
+echo "  3) 现代企业制 (现代企业管理)"
+echo ""
+read -p "请选择 (1-3): " REGIME
+
+case $REGIME in
+    1)
+        REGIME_NAME="ming"
+        REGIME_LABEL="明朝内阁制"
+        ;;
+    2)
+        REGIME_NAME="tang"
+        REGIME_LABEL="唐朝三省制"
+        ;;
+    3)
+        REGIME_NAME="modern"
+        REGIME_LABEL="现代企业制"
+        ;;
+    *)
+        echo -e "${RED}✗ 无效选择，使用明朝内阁制${NC}"
+        REGIME_NAME="ming"
+        REGIME_LABEL="明朝内阁制"
+        ;;
+esac
+echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
+
+# ========================================
+# 步骤 4: 选择 Bot 数量
+# ========================================
+echo ""
+echo -e "${YELLOW}[4/5] 选择 Bot 数量${NC}"
+
+if [ "$PLATFORM_NAME" = "webui" ]; then
+    echo "  WebUI 模式使用单 Agent"
+    BOT_CHOICE="1"
+else
+    # 根据制度显示不同选项
+    if [ "$REGIME_NAME" = "ming" ]; then
+        echo "  1) 1 Bot - 司礼监 (个人开发者)"
+        echo "  2) 3 Bot - 司礼监 + 内阁 + 工部 (小团队⭐推荐)"
+        echo "  3) 5 Bot - 司礼监 + 内阁 + 都察院 + 兵部 + 工部 (中型团队)"
+        echo "  4) 9 Bot - 完整版 (大型团队)"
+    elif [ "$REGIME_NAME" = "tang" ]; then
+        echo "  1) 1 Bot - 中书省 (个人开发者)"
+        echo "  2) 3 Bot - 中书省 + 门下省 + 尚书省 (小团队⭐推荐)"
+        echo "  3) 11 Bot - 完整版 (大型团队)"
+    else
+        echo "  1) 1 Bot - CEO (个人开发者)"
+        echo "  2) 3 Bot - CEO + CTO + QA (小团队⭐推荐)"
+        echo "  3) 9 Bot - 完整版 (大型团队)"
+    fi
+    echo ""
+    read -p "请选择：" BOT_CHOICE
+fi
+
+# 根据制度和选择确定配置文件
+if [ "$REGIME_NAME" = "ming" ]; then
+    case $BOT_CHOICE in
+        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
+        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
+        3) CONFIG_TEMPLATE="openclaw-5bot.json" ;;
+        *) CONFIG_TEMPLATE="openclaw.json" ;;
+    esac
+elif [ "$REGIME_NAME" = "tang" ]; then
+    case $BOT_CHOICE in
+        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
+        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
+        *) CONFIG_TEMPLATE="openclaw.json" ;;
+    esac
+else
+    case $BOT_CHOICE in
+        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
+        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
+        *) CONFIG_TEMPLATE="openclaw.json" ;;
+    esac
+fi
+
+# 定位仓库目录（支持本地运行和 curl 远程运行）
+REPO_DIR="$HOME/clawd/danghuangshang"
+if [ ! -d "$REPO_DIR" ]; then
+    # 尝试从脚本位置推断
+    _PARENT="$(cd "$SCRIPT_DIR/.." && pwd)"
+    if [ -f "$_PARENT/configs/feishu-ming/openclaw.json" ]; then
+        REPO_DIR="$_PARENT"
+    fi
+fi
+
+CONFIG_SOURCE="$REPO_DIR/configs/feishu-$REGIME_NAME/$CONFIG_TEMPLATE"
+
+echo -e "${GREEN}✓ 配置模板：$CONFIG_TEMPLATE${NC}"
+
+# ========================================
+# 步骤 5: 收集平台凭证
+# ========================================
+echo ""
+echo -e "${YELLOW}[5/5] 收集平台凭证${NC}"
+
+if [ "$PLATFORM_NAME" = "feishu" ]; then
+    echo ""
+    echo "请前往飞书开放平台创建应用："
+    echo "https://open.feishu.cn/app"
+    echo ""
+    read -p "App ID: " APP_ID
+    read -s -p "App Secret: " APP_SECRET
+    echo ""
+
+    if [ -z "$APP_ID" ] || [ -z "$APP_SECRET" ]; then
+        echo -e "${RED}✗ 飞书凭证不能为空${NC}"
+        exit 1
+    fi
+
+elif [ "$PLATFORM_NAME" = "discord" ]; then
+    echo ""
+    echo "请前往 Discord Developer Portal 创建 Bot："
+    echo "https://discord.com/developers/applications"
+    echo ""
+    read -p "Bot Token: " BOT_TOKEN
+    read -p "Server ID (Guild ID, 留空则所有
```

---

### Incident Patch 2: `9d30b0e4` (2026-04-12)
**Commit Message**: Merge pull request #135 from wanikua/fix/tang-sansheng-agents

fix: 唐三省制配置使用正确的唐朝官制

**File**: `configs/feishu-tang/openclaw.json` (modified, +53/-19)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+          "mode": "off"
+        },
+        "subagents": {
+          "allowAgents": [
+            "bingbu",
+            "hubu",
+            "libu",
+            "gongbu",
+            "libu2",
+            "xingbu",
+            "hanlin_zhang"
+          ],
+          "maxConcurrent": 4
+        },
+        "workspace": "$HOME/clawd-shangshusheng"
+      },
+      {
+        "id": "yushitai",
+        "name": "御史台",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是都察院御史，专精监察审计、代码审查、质量把控、安全评估。回答用中文，铁面无私。\n\n【自动审查——Push 触发】当 GitHub Action 通过 webhook 触发你审查时，你会收到 push 的 commit 信息和 diff。审查流程：\n1. 逐文件检查变更：安全漏洞、性能问题、逻辑错误、代码规范；\n2. 给出结论：✅ 通过 / ⚠️ 建议修改 / ❌ 必须修改；\n3. 如有问题，列出具体文件、行号、问题描述和修复建议；\n4. 将审查报告发送到 Discord 频道，@提交者和司礼监。\n\n【手动审查】当其他部门通过 sessions_send 或 spawn 提交代码/PR 给你审查时，同样逐一检查并给出通过/驳回结论。驳回时必须说明具体原因和修改建议。\n\n【审计职责】定期检查项目进度偏差、资源浪费、风险隐患。发现问题直言不讳。"
+          "theme": "你是御史台御史大夫，正三品，掌独立监察。回答用中文，铁面无私。\n\n【自动审查——P
```

**File**: `configs/tang-sansheng/openclaw.json` (modified, +69/-30)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+          "mode": "off"
+        },
+        "subagents": {
+          "allowAgents": [
+            "bingbu",
+            "hubu",
+            "libu",
+            "gongbu",
+            "libu2",
+            "xingbu",
+            "hanlin_zhang"
+          ],
+          "maxConcurrent": 4
+        },
+        "workspace": "$HOME/clawd-shangshusheng"
+      },
+      {
+        "id": "yushitai",
+        "name": "御史台",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是都察院御史，专精监察审计、代码审查、质量把控、安全评估。回答用中文，铁面无私。\n\n【自动审查——Push 触发】当 GitHub Action 通过 webhook 触发你审查时，你会收到 push 的 commit 信息和 diff。审查流程：\n1. 逐文件检查变更：安全漏洞、性能问题、逻辑错误、代码规范；\n2. 给出结论：✅ 通过 / ⚠️ 建议修改 / ❌ 必须修改；\n3. 如有问题，列出具体文件、行号、问题描述和修复建议；\n4. 将审查报告发送到 Discord 频道，@提交者和司礼监。\n\n【手动审查】当其他部门通过 sessions_send 或 spawn 提交代码/PR 给你审查时，同样逐一检查并给出通过/驳回结论。驳回时必须说明具体原因和修改建议。\n\n【审计职责】定期检查项目进度偏差、资源浪费、风险隐患。发现问题直言不讳。"
+          "theme": "你是御史台御史大夫，正三品，掌独立监察。回答用中文，铁面无私。\n\n【自动审查——P
```

---

### Incident Patch 3: `35e58345` (2026-04-12)
**Commit Message**: fix: 唐三省制配置使用正确的唐朝官制

tang-sansheng 配置中错误使用了明朝官制（司礼监、内阁、都察院），
现替换为正确的唐朝三省六部制：

- 司礼监 → 中书省（决策起草）
- 内阁 → 门下省（审核封驳）
- 新增尚书省（执行派发）
- 都察院 → 御史台（独立监察）

流程：中书省起草 → 门下省审核 → 尚书省派发 → 六部执行
      御史台独立监察

Fixes #131

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `configs/feishu-tang/openclaw.json` (modified, +53/-19)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+          "mode": "off"
+        },
+        "subagents": {
+          "allowAgents": [
+            "bingbu",
+            "hubu",
+            "libu",
+            "gongbu",
+            "libu2",
+            "xingbu",
+            "hanlin_zhang"
+          ],
+          "maxConcurrent": 4
+        },
+        "workspace": "$HOME/clawd-shangshusheng"
+      },
+      {
+        "id": "yushitai",
+        "name": "御史台",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是都察院御史，专精监察审计、代码审查、质量把控、安全评估。回答用中文，铁面无私。\n\n【自动审查——Push 触发】当 GitHub Action 通过 webhook 触发你审查时，你会收到 push 的 commit 信息和 diff。审查流程：\n1. 逐文件检查变更：安全漏洞、性能问题、逻辑错误、代码规范；\n2. 给出结论：✅ 通过 / ⚠️ 建议修改 / ❌ 必须修改；\n3. 如有问题，列出具体文件、行号、问题描述和修复建议；\n4. 将审查报告发送到 Discord 频道，@提交者和司礼监。\n\n【手动审查】当其他部门通过 sessions_send 或 spawn 提交代码/PR 给你审查时，同样逐一检查并给出通过/驳回结论。驳回时必须说明具体原因和修改建议。\n\n【审计职责】定期检查项目进度偏差、资源浪费、风险隐患。发现问题直言不讳。"
+          "theme": "你是御史台御史大夫，正三品，掌独立监察。回答用中文，铁面无私。\n\n【自动审查——P
```

**File**: `configs/tang-sansheng/openclaw.json` (modified, +69/-30)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+          "mode": "off"
+        },
+        "subagents": {
+          "allowAgents": [
+            "bingbu",
+            "hubu",
+            "libu",
+            "gongbu",
+            "libu2",
+            "xingbu",
+            "hanlin_zhang"
+          ],
+          "maxConcurrent": 4
+        },
+        "workspace": "$HOME/clawd-shangshusheng"
+      },
+      {
+        "id": "yushitai",
+        "name": "御史台",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是都察院御史，专精监察审计、代码审查、质量把控、安全评估。回答用中文，铁面无私。\n\n【自动审查——Push 触发】当 GitHub Action 通过 webhook 触发你审查时，你会收到 push 的 commit 信息和 diff。审查流程：\n1. 逐文件检查变更：安全漏洞、性能问题、逻辑错误、代码规范；\n2. 给出结论：✅ 通过 / ⚠️ 建议修改 / ❌ 必须修改；\n3. 如有问题，列出具体文件、行号、问题描述和修复建议；\n4. 将审查报告发送到 Discord 频道，@提交者和司礼监。\n\n【手动审查】当其他部门通过 sessions_send 或 spawn 提交代码/PR 给你审查时，同样逐一检查并给出通过/驳回结论。驳回时必须说明具体原因和修改建议。\n\n【审计职责】定期检查项目进度偏差、资源浪费、风险隐患。发现问题直言不讳。"
+          "theme": "你是御史台御史大夫，正三品，掌独立监察。回答用中文，铁面无私。\n\n【自动审查——P
```

---

### Incident Patch 4: `32dad114` (2026-04-12)
**Commit Message**: Merge pull request #134 from wanikua/fix/openclaw-compat

fix: 适配最新 OpenClaw 配置格式

**File**: `configs/feishu-ming/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "明朝飞书配置 - 1 Bot 基础版（最小配置）",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-3bot.json` (modified, +36/-7)
```diff
@@ -1,21 +1,50 @@
 {
-  "_comment": "明朝飞书配置 - 3 Bot 核心版（推荐）",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-5bot.json` (modified, +60/-11)
```diff
@@ -1,25 +1,74 @@
 {
-  "_comment": "明朝飞书配置 - 5 Bot 标准版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-9bot.json` (modified, +108/-19)
```diff
@@ -1,33 +1,122 @@
 {
-  "_comment": "明朝飞书配置 - 9 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "hubu": {
+          "appId": "YOUR_HUBU_APP_ID",
+          "appSecret": "YOUR_HUBU_APP_SECRET",
+          "botName": "户部"
+        },
+        "libu": {
+          "appId": "YOUR_LIBU_APP_ID",
+          "appSecret": "YOUR_LIBU_APP_SECRET",
+          "botName": "礼部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        },
+        "libu2": {
+          "appId": "YOUR_LIBU2_APP_ID",
+          "appSecret": "YOUR_LIBU2_APP_SECRET",
+          "botName": "吏部"
+        },
+        "xingbu": {
+          "appId": "YOUR_XINGBU_APP_ID",
+          "appSecret": "YOUR_XINGBU_APP_SECRET",
+          "botName": "刑部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
-    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
-    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
-    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "hubu",
+      "match": {
+        "channel": "feishu",
+        "account": "hubu"
+      }
+    },
+    {
+      "agentId": "libu",
+      "match": {
+        "channel": "feishu",
+        "account": "libu"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    },
+    {
+      "agentId": "libu2",
+      "match": {
+        "channel": "feishu",
+        "account": "libu2"
+      }
+    },
+    {
+      "agentId": "xingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "xingbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-modern/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "现代飞书配置 - 1 Bot 基础版",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-modern/openclaw-3bot.json` (modified, +36/-7)
```diff
@@ -1,21 +1,50 @@
 {
-  "_comment": "现代飞书配置 - 3 Bot 核心版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "ceo",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "ceo": {"appId": "YOUR_CEO_APP_ID", "appSecret": "YOUR_CEO_APP_SECRET", "botName": "CEO"},
-        "cto": {"appId": "YOUR_CTO_APP_ID", "appSecret": "YOUR_CTO_APP_SECRET", "botName": "CTO"},
-        "qa": {"appId": "YOUR_QA_APP_ID", "appSecret": "YOUR_QA_APP_SECRET", "botName": "QA"}
+        "ceo": {
+          "appId": "YOUR_CEO_APP_ID",
+          "appSecret": "YOUR_CEO_APP_SECRET",
+          "botName": "CEO"
+        },
+        "cto": {
+          "appId": "YOUR_CTO_APP_ID",
+          "appSecret": "YOUR_CTO_APP_SECRET",
+          "botName": "CTO"
+        },
+        "qa": {
+          "appId": "YOUR_QA_APP_ID",
+          "appSecret": "YOUR_QA_APP_SECRET",
+          "botName": "QA"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}},
-    {"agentId": "cto", "match": {"channel": "feishu", "account": "cto"}},
-    {"agentId": "qa", "match": {"channel": "feishu", "account": "qa"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    },
+    {
+      "agentId": "cto",
+      "match": {
+        "channel": "feishu",
+        "account": "cto"
+      }
+    },
+    {
+      "agentId": "qa",
+      "match": {
+        "channel": "feishu",
+        "account": "qa"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-modern/openclaw-9bot.json` (modified, +108/-19)
```diff
@@ -1,33 +1,122 @@
 {
-  "_comment": "现代飞书配置 - 9 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "ceo",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "ceo": {"appId": "YOUR_CEO_APP_ID", "appSecret": "YOUR_CEO_APP_SECRET", "botName": "CEO"},
-        "board": {"appId": "YOUR_BOARD_APP_ID", "appSecret": "YOUR_BOARD_APP_SECRET", "botName": "Board"},
-        "qa": {"appId": "YOUR_QA_APP_ID", "appSecret": "YOUR_QA_APP_SECRET", "botName": "QA"},
-        "cto": {"appId": "YOUR_CTO_APP_ID", "appSecret": "YOUR_CTO_APP_SECRET", "botName": "CTO"},
-        "cfo": {"appId": "YOUR_CFO_APP_ID", "appSecret": "YOUR_CFO_APP_SECRET", "botName": "CFO"},
-        "cmo": {"appId": "YOUR_CMO_APP_ID", "appSecret": "YOUR_CMO_APP_SECRET", "botName": "CMO"},
-        "coo": {"appId": "YOUR_COO_APP_ID", "appSecret": "YOUR_COO_APP_SECRET", "botName": "COO"},
-        "clo": {"appId": "YOUR_CLO_APP_ID", "appSecret": "YOUR_CLO_APP_SECRET", "botName": "CLO"},
-        "cos": {"appId": "YOUR_COS_APP_ID", "appSecret": "YOUR_COS_APP_SECRET", "botName": "CoS"}
+        "ceo": {
+          "appId": "YOUR_CEO_APP_ID",
+          "appSecret": "YOUR_CEO_APP_SECRET",
+          "botName": "CEO"
+        },
+        "board": {
+          "appId": "YOUR_BOARD_APP_ID",
+          "appSecret": "YOUR_BOARD_APP_SECRET",
+          "botName": "Board"
+        },
+        "qa": {
+          "appId": "YOUR_QA_APP_ID",
+          "appSecret": "YOUR_QA_APP_SECRET",
+          "botName": "QA"
+        },
+        "cto": {
+          "appId": "YOUR_CTO_APP_ID",
+          "appSecret": "YOUR_CTO_APP_SECRET",
+          "botName": "CTO"
+        },
+        "cfo": {
+          "appId": "YOUR_CFO_APP_ID",
+          "appSecret": "YOUR_CFO_APP_SECRET",
+          "botName": "CFO"
+        },
+        "cmo": {
+          "appId": "YOUR_CMO_APP_ID",
+          "appSecret": "YOUR_CMO_APP_SECRET",
+          "botName": "CMO"
+        },
+        "coo": {
+          "appId": "YOUR_COO_APP_ID",
+          "appSecret": "YOUR_COO_APP_SECRET",
+          "botName": "COO"
+        },
+        "clo": {
+          "appId": "YOUR_CLO_APP_ID",
+          "appSecret": "YOUR_CLO_APP_SECRET",
+          "botName": "CLO"
+        },
+        "cos": {
+          "appId": "YOUR_COS_APP_ID",
+          "appSecret": "YOUR_COS_APP_SECRET",
+          "botName": "CoS"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}},
-    {"agentId": "board", "match": {"channel": "feishu", "account": "board"}},
-    {"agentId": "qa", "match": {"channel": "feishu", "account": "qa"}},
-    {"agentId": "cto", "match": {"channel": "feishu", "account": "cto"}},
-    {"agentId": "cfo", "match": {"channel": "feishu", "account": "cfo"}},
-    {"agentId": "cmo", "match": {"channel": "feishu", "account": "cmo"}},
-    {"agentId": "coo", "match": {"channel": "feishu", "account": "coo"}},
-    {"agentId": "clo", "match": {"channel": "feishu", "account": "clo"}},
-    {"agentId": "cos", "match": {"channel": "feishu", "account": "cos"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    },
+    {
+      "agentId": "board",
+      "match": {
+        "channel": "feishu",
+        "account": "board"
+      }
+    },
+    {
+      "agentId": "qa",
+      "match": {
+        "channel": "feishu",
+        "account": "qa"
+      }
+    },
+    {
+      "agentId": "cto",
+      "match": {
+        "channel": "feishu",
+        "account": "cto"
+      }
+    },
+    {
+      "agentId": "cfo",
+      "match": {
+        "channel": "feishu",
+        "account": "cfo"
+      }
+    },
+    {
+      "agentId": "cmo",
+      "match": {
+        "channel": "feishu",
+        "account": "cmo"
+      }
+    },
+    {
+      "agentId": "coo",
+      "match": {
+        "channel": "feishu",
+        "account": "coo"
+      }
+    },
+    {
+      "agentId": "clo",
+      "match": {
+        "channel": "feishu",
+        "account": "clo"
+      }
+    },
+    {
+      "agentId": "cos",
+      "match": {
+        "channel": "feishu",
+        "account": "cos"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-tang/openclaw-11bot.json` (modified, +132/-23)
```diff
@@ -1,37 +1,146 @@
 {
-  "_comment": "唐朝飞书配置 - 11 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "zhongshu",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "zhongshu": {"appId": "YOUR_ZHONGSHU_APP_ID", "appSecret": "YOUR_ZHONGSHU_APP_SECRET", "botName": "中书省"},
-        "menxia": {"appId": "YOUR_MENXIA_APP_ID", "appSecret": "YOUR_MENXIA_APP_SECRET", "botName": "门下省"},
-        "shangshu": {"appId": "YOUR_SHANGSHU_APP_ID", "appSecret": "YOUR_SHANGSHU_APP_SECRET", "botName": "尚书省"},
-        "yushitai": {"appId": "YOUR_YUSHITAI_APP_ID", "appSecret": "YOUR_YUSHITAI_APP_SECRET", "botName": "御史台"},
-        "shiguan": {"appId": "YOUR_SHIGUAN_APP_ID", "appSecret": "YOUR_SHIGUAN_APP_SECRET", "botName": "史官"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+        "zhongshu": {
+          "appId": "YOUR_ZHONGSHU_APP_ID",
+          "appSecret": "YOUR_ZHONGSHU_APP_SECRET",
+          "botName": "中书省"
+        },
+        "menxia": {
+          "appId": "YOUR_MENXIA_APP_ID",
+          "appSecret": "YOUR_MENXIA_APP_SECRET",
+          "botName": "门下省"
+        },
+        "shangshu": {
+          "appId": "YOUR_SHANGSHU_APP_ID",
+          "appSecret": "YOUR_SHANGSHU_APP_SECRET",
+          "botName": "尚书省"
+        },
+        "yushitai": {
+          "appId": "YOUR_YUSHITAI_APP_ID",
+          "appSecret": "YOUR_YUSHITAI_APP_SECRET",
+          "botName": "御史台"
+        },
+        "shiguan": {
+          "appId": "YOUR_SHIGUAN_APP_ID",
+          "appSecret": "YOUR_SHIGUAN_APP_SECRET",
+          "botName": "史官"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "hubu": {
+          "appId": "YOUR_HUBU_APP_ID",
+          "appSecret": "YOUR_HUBU_APP_SECRET",
+          "botName": "户部"
+        },
+        "libu": {
+          "appId": "YOUR_LIBU_APP_ID",
+          "appSecret": "YOUR_LIBU_APP_SECRET",
+          "botName": "礼部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        },
+        "libu2": {
+          "appId": "YOUR_LIBU2_APP_ID",
+          "appSecret": "YOUR_LIBU2_APP_SECRET",
+          "botName": "吏部"
+        },
+        "xingbu": {
+          "appId": "YOUR_XINGBU_APP_ID",
+          "appSecret": "YOUR_XINGBU_APP_SECRET",
+          "botName": "刑部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "zhongshu", "match": {"channel": "feishu", "account": "zhongshu"}},
-    {"agentId": "menxia", "match": {"channel": "feishu", "account": "menxia"}},
-    {"agentId": "shangshu", "match": {"channel": "feishu", "account": "shangshu"}},
-    {"agentId": "yushitai", "match": {"channel": "feishu", "account": "yushitai"}},
-    {"agentId": "shiguan", "match": {"channel": "feishu", "account": "shiguan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
-    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
-    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
-    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+    {
+      "agentId": "zhongshu",
+      "match": {
+        "channel": "feishu",
+        "account": "zhongshu"
+      }
+    },
+    {
+      "agentId": "menxia",
+      "match": {
+        "channel": "feishu",
+        "account": "menxia"
+      }
+    },
+    {
+      "agentId": "shangshu",
+      "match": {
+        "channel": "feishu",
+        "account": "shangshu"
+      }
+    },
+    {
+      "agentId": "yushitai",
+      "match": {
+        "channel": "feishu",
+        "account": "yushitai"
+      }
+    },
+    {
+      "agentId": "shiguan",
+      "match": {
+        "channel": "feishu",
+        "account": "shiguan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "hubu",
+      "match": {
+        "channel": "feishu",
+        "account": "hubu"
+      }
+    },
+    {
+      "agentId": "libu",
+      
```

---

### Incident Patch 5: `0db1e26f` (2026-04-12)
**Commit Message**: fix: 适配最新 OpenClaw 配置格式

- 移除已废弃的 root keys: _comment, _regime, _version, _description
- api: "openai" → "openai-completions"
- 移除已废弃的 agent key: runTimeoutSeconds

Fixes #133, #110

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `configs/feishu-ming/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "明朝飞书配置 - 1 Bot 基础版（最小配置）",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-3bot.json` (modified, +36/-7)
```diff
@@ -1,21 +1,50 @@
 {
-  "_comment": "明朝飞书配置 - 3 Bot 核心版（推荐）",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-5bot.json` (modified, +60/-11)
```diff
@@ -1,25 +1,74 @@
 {
-  "_comment": "明朝飞书配置 - 5 Bot 标准版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-9bot.json` (modified, +108/-19)
```diff
@@ -1,33 +1,122 @@
 {
-  "_comment": "明朝飞书配置 - 9 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "hubu": {
+          "appId": "YOUR_HUBU_APP_ID",
+          "appSecret": "YOUR_HUBU_APP_SECRET",
+          "botName": "户部"
+        },
+        "libu": {
+          "appId": "YOUR_LIBU_APP_ID",
+          "appSecret": "YOUR_LIBU_APP_SECRET",
+          "botName": "礼部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        },
+        "libu2": {
+          "appId": "YOUR_LIBU2_APP_ID",
+          "appSecret": "YOUR_LIBU2_APP_SECRET",
+          "botName": "吏部"
+        },
+        "xingbu": {
+          "appId": "YOUR_XINGBU_APP_ID",
+          "appSecret": "YOUR_XINGBU_APP_SECRET",
+          "botName": "刑部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
-    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
-    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
-    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "hubu",
+      "match": {
+        "channel": "feishu",
+        "account": "hubu"
+      }
+    },
+    {
+      "agentId": "libu",
+      "match": {
+        "channel": "feishu",
+        "account": "libu"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    },
+    {
+      "agentId": "libu2",
+      "match": {
+        "channel": "feishu",
+        "account": "libu2"
+      }
+    },
+    {
+      "agentId": "xingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "xingbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-modern/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "现代飞书配置 - 1 Bot 基础版",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-modern/openclaw-3bot.json` (modified, +36/-7)
```diff
@@ -1,21 +1,50 @@
 {
-  "_comment": "现代飞书配置 - 3 Bot 核心版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "ceo",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "ceo": {"appId": "YOUR_CEO_APP_ID", "appSecret": "YOUR_CEO_APP_SECRET", "botName": "CEO"},
-        "cto": {"appId": "YOUR_CTO_APP_ID", "appSecret": "YOUR_CTO_APP_SECRET", "botName": "CTO"},
-        "qa": {"appId": "YOUR_QA_APP_ID", "appSecret": "YOUR_QA_APP_SECRET", "botName": "QA"}
+        "ceo": {
+          "appId": "YOUR_CEO_APP_ID",
+          "appSecret": "YOUR_CEO_APP_SECRET",
+          "botName": "CEO"
+        },
+        "cto": {
+          "appId": "YOUR_CTO_APP_ID",
+          "appSecret": "YOUR_CTO_APP_SECRET",
+          "botName": "CTO"
+        },
+        "qa": {
+          "appId": "YOUR_QA_APP_ID",
+          "appSecret": "YOUR_QA_APP_SECRET",
+          "botName": "QA"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}},
-    {"agentId": "cto", "match": {"channel": "feishu", "account": "cto"}},
-    {"agentId": "qa", "match": {"channel": "feishu", "account": "qa"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    },
+    {
+      "agentId": "cto",
+      "match": {
+        "channel": "feishu",
+        "account": "cto"
+      }
+    },
+    {
+      "agentId": "qa",
+      "match": {
+        "channel": "feishu",
+        "account": "qa"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-modern/openclaw-9bot.json` (modified, +108/-19)
```diff
@@ -1,33 +1,122 @@
 {
-  "_comment": "现代飞书配置 - 9 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "ceo",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "ceo": {"appId": "YOUR_CEO_APP_ID", "appSecret": "YOUR_CEO_APP_SECRET", "botName": "CEO"},
-        "board": {"appId": "YOUR_BOARD_APP_ID", "appSecret": "YOUR_BOARD_APP_SECRET", "botName": "Board"},
-        "qa": {"appId": "YOUR_QA_APP_ID", "appSecret": "YOUR_QA_APP_SECRET", "botName": "QA"},
-        "cto": {"appId": "YOUR_CTO_APP_ID", "appSecret": "YOUR_CTO_APP_SECRET", "botName": "CTO"},
-        "cfo": {"appId": "YOUR_CFO_APP_ID", "appSecret": "YOUR_CFO_APP_SECRET", "botName": "CFO"},
-        "cmo": {"appId": "YOUR_CMO_APP_ID", "appSecret": "YOUR_CMO_APP_SECRET", "botName": "CMO"},
-        "coo": {"appId": "YOUR_COO_APP_ID", "appSecret": "YOUR_COO_APP_SECRET", "botName": "COO"},
-        "clo": {"appId": "YOUR_CLO_APP_ID", "appSecret": "YOUR_CLO_APP_SECRET", "botName": "CLO"},
-        "cos": {"appId": "YOUR_COS_APP_ID", "appSecret": "YOUR_COS_APP_SECRET", "botName": "CoS"}
+        "ceo": {
+          "appId": "YOUR_CEO_APP_ID",
+          "appSecret": "YOUR_CEO_APP_SECRET",
+          "botName": "CEO"
+        },
+        "board": {
+          "appId": "YOUR_BOARD_APP_ID",
+          "appSecret": "YOUR_BOARD_APP_SECRET",
+          "botName": "Board"
+        },
+        "qa": {
+          "appId": "YOUR_QA_APP_ID",
+          "appSecret": "YOUR_QA_APP_SECRET",
+          "botName": "QA"
+        },
+        "cto": {
+          "appId": "YOUR_CTO_APP_ID",
+          "appSecret": "YOUR_CTO_APP_SECRET",
+          "botName": "CTO"
+        },
+        "cfo": {
+          "appId": "YOUR_CFO_APP_ID",
+          "appSecret": "YOUR_CFO_APP_SECRET",
+          "botName": "CFO"
+        },
+        "cmo": {
+          "appId": "YOUR_CMO_APP_ID",
+          "appSecret": "YOUR_CMO_APP_SECRET",
+          "botName": "CMO"
+        },
+        "coo": {
+          "appId": "YOUR_COO_APP_ID",
+          "appSecret": "YOUR_COO_APP_SECRET",
+          "botName": "COO"
+        },
+        "clo": {
+          "appId": "YOUR_CLO_APP_ID",
+          "appSecret": "YOUR_CLO_APP_SECRET",
+          "botName": "CLO"
+        },
+        "cos": {
+          "appId": "YOUR_COS_APP_ID",
+          "appSecret": "YOUR_COS_APP_SECRET",
+          "botName": "CoS"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}},
-    {"agentId": "board", "match": {"channel": "feishu", "account": "board"}},
-    {"agentId": "qa", "match": {"channel": "feishu", "account": "qa"}},
-    {"agentId": "cto", "match": {"channel": "feishu", "account": "cto"}},
-    {"agentId": "cfo", "match": {"channel": "feishu", "account": "cfo"}},
-    {"agentId": "cmo", "match": {"channel": "feishu", "account": "cmo"}},
-    {"agentId": "coo", "match": {"channel": "feishu", "account": "coo"}},
-    {"agentId": "clo", "match": {"channel": "feishu", "account": "clo"}},
-    {"agentId": "cos", "match": {"channel": "feishu", "account": "cos"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    },
+    {
+      "agentId": "board",
+      "match": {
+        "channel": "feishu",
+        "account": "board"
+      }
+    },
+    {
+      "agentId": "qa",
+      "match": {
+        "channel": "feishu",
+        "account": "qa"
+      }
+    },
+    {
+      "agentId": "cto",
+      "match": {
+        "channel": "feishu",
+        "account": "cto"
+      }
+    },
+    {
+      "agentId": "cfo",
+      "match": {
+        "channel": "feishu",
+        "account": "cfo"
+      }
+    },
+    {
+      "agentId": "cmo",
+      "match": {
+        "channel": "feishu",
+        "account": "cmo"
+      }
+    },
+    {
+      "agentId": "coo",
+      "match": {
+        "channel": "feishu",
+        "account": "coo"
+      }
+    },
+    {
+      "agentId": "clo",
+      "match": {
+        "channel": "feishu",
+        "account": "clo"
+      }
+    },
+    {
+      "agentId": "cos",
+      "match": {
+        "channel": "feishu",
+        "account": "cos"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-tang/openclaw-11bot.json` (modified, +132/-23)
```diff
@@ -1,37 +1,146 @@
 {
-  "_comment": "唐朝飞书配置 - 11 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "zhongshu",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "zhongshu": {"appId": "YOUR_ZHONGSHU_APP_ID", "appSecret": "YOUR_ZHONGSHU_APP_SECRET", "botName": "中书省"},
-        "menxia": {"appId": "YOUR_MENXIA_APP_ID", "appSecret": "YOUR_MENXIA_APP_SECRET", "botName": "门下省"},
-        "shangshu": {"appId": "YOUR_SHANGSHU_APP_ID", "appSecret": "YOUR_SHANGSHU_APP_SECRET", "botName": "尚书省"},
-        "yushitai": {"appId": "YOUR_YUSHITAI_APP_ID", "appSecret": "YOUR_YUSHITAI_APP_SECRET", "botName": "御史台"},
-        "shiguan": {"appId": "YOUR_SHIGUAN_APP_ID", "appSecret": "YOUR_SHIGUAN_APP_SECRET", "botName": "史官"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+        "zhongshu": {
+          "appId": "YOUR_ZHONGSHU_APP_ID",
+          "appSecret": "YOUR_ZHONGSHU_APP_SECRET",
+          "botName": "中书省"
+        },
+        "menxia": {
+          "appId": "YOUR_MENXIA_APP_ID",
+          "appSecret": "YOUR_MENXIA_APP_SECRET",
+          "botName": "门下省"
+        },
+        "shangshu": {
+          "appId": "YOUR_SHANGSHU_APP_ID",
+          "appSecret": "YOUR_SHANGSHU_APP_SECRET",
+          "botName": "尚书省"
+        },
+        "yushitai": {
+          "appId": "YOUR_YUSHITAI_APP_ID",
+          "appSecret": "YOUR_YUSHITAI_APP_SECRET",
+          "botName": "御史台"
+        },
+        "shiguan": {
+          "appId": "YOUR_SHIGUAN_APP_ID",
+          "appSecret": "YOUR_SHIGUAN_APP_SECRET",
+          "botName": "史官"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "hubu": {
+          "appId": "YOUR_HUBU_APP_ID",
+          "appSecret": "YOUR_HUBU_APP_SECRET",
+          "botName": "户部"
+        },
+        "libu": {
+          "appId": "YOUR_LIBU_APP_ID",
+          "appSecret": "YOUR_LIBU_APP_SECRET",
+          "botName": "礼部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        },
+        "libu2": {
+          "appId": "YOUR_LIBU2_APP_ID",
+          "appSecret": "YOUR_LIBU2_APP_SECRET",
+          "botName": "吏部"
+        },
+        "xingbu": {
+          "appId": "YOUR_XINGBU_APP_ID",
+          "appSecret": "YOUR_XINGBU_APP_SECRET",
+          "botName": "刑部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "zhongshu", "match": {"channel": "feishu", "account": "zhongshu"}},
-    {"agentId": "menxia", "match": {"channel": "feishu", "account": "menxia"}},
-    {"agentId": "shangshu", "match": {"channel": "feishu", "account": "shangshu"}},
-    {"agentId": "yushitai", "match": {"channel": "feishu", "account": "yushitai"}},
-    {"agentId": "shiguan", "match": {"channel": "feishu", "account": "shiguan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
-    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
-    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
-    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+    {
+      "agentId": "zhongshu",
+      "match": {
+        "channel": "feishu",
+        "account": "zhongshu"
+      }
+    },
+    {
+      "agentId": "menxia",
+      "match": {
+        "channel": "feishu",
+        "account": "menxia"
+      }
+    },
+    {
+      "agentId": "shangshu",
+      "match": {
+        "channel": "feishu",
+        "account": "shangshu"
+      }
+    },
+    {
+      "agentId": "yushitai",
+      "match": {
+        "channel": "feishu",
+        "account": "yushitai"
+      }
+    },
+    {
+      "agentId": "shiguan",
+      "match": {
+        "channel": "feishu",
+        "account": "shiguan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "hubu",
+      "match": {
+        "channel": "feishu",
+        "account": "hubu"
+      }
+    },
+    {
+      "agentId": "libu",
+      
```

---

### Incident Patch 6: `3e6cfd8c` (2026-03-29)
**Commit Message**: fix: 补充缺失的配置模板（1 Bot 和 9 Bot）

修复:
- configs/feishu-ming/openclaw-1bot.json - 单 Bot 基础版
- configs/feishu-ming/openclaw-9bot.json - 9 Bot 完整版

现在配置模板完整:
✅ 1 Bot - 最小配置
✅ 3 Bot - 核心版（推荐）
✅ 5 Bot - 标准版
✅ 9 Bot - 完整版

**File**: `configs/feishu-ming/openclaw-1bot.json` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+{
+  "_comment": "明朝飞书配置 - 1 Bot 基础版（最小配置）",
+  "channels": {
+    "feishu": {
+      "enabled": true,
+      "defaultAccount": "silijian",
+      "dmPolicy": "pairing",
+      "groupPolicy": "open",
+      "accounts": {
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        }
+      }
+    }
+  },
+  "bindings": [
+    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}}
+  ]
+}
```

**File**: `configs/feishu-ming/openclaw-9bot.json` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+{
+  "_comment": "明朝飞书配置 - 9 Bot 完整版",
+  "channels": {
+    "feishu": {
+      "enabled": true,
+      "defaultAccount": "silijian",
+      "dmPolicy": "pairing",
+      "groupPolicy": "open",
+      "accounts": {
+        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
+        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
+        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
+        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
+        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
+        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
+        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
+        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
+        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+      }
+    }
+  },
+  "bindings": [
+    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
+    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
+    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
+    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
+    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
+    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
+    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
+    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
+    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+  ]
+}
```

---

### Incident Patch 7: `55da6138` (2026-03-29)
**Commit Message**: fix: 修正 bindings 数量

**File**: `configs/feishu-ming/openclaw.json` (modified, +18/-88)
```diff
@@ -428,134 +428,64 @@
     {
       "agentId": "silijian",
       "match": {
-        "channel": "discord",
-        "accountId": "silijian"
+        "channel": "feishu",
+        "account": "silijian"
       }
     },
     {
       "agentId": "neige",
       "match": {
-        "channel": "discord",
-        "accountId": "neige"
+        "channel": "feishu",
+        "account": "neige"
       }
     },
     {
       "agentId": "duchayuan",
       "match": {
-        "channel": "discord",
-        "accountId": "duchayuan"
+        "channel": "feishu",
+        "account": "duchayuan"
       }
     },
     {
       "agentId": "bingbu",
       "match": {
-        "channel": "discord",
-        "accountId": "bingbu"
+        "channel": "feishu",
+        "account": "bingbu"
       }
     },
     {
       "agentId": "hubu",
       "match": {
-        "channel": "discord",
-        "accountId": "hubu"
+        "channel": "feishu",
+        "account": "hubu"
       }
     },
     {
       "agentId": "libu",
       "match": {
-        "channel": "discord",
-        "accountId": "libu"
+        "channel": "feishu",
+        "account": "libu"
       }
     },
     {
       "agentId": "gongbu",
       "match": {
-        "channel": "discord",
-        "accountId": "gongbu"
+        "channel": "feishu",
+        "account": "gongbu"
       }
     },
     {
       "agentId": "libu2",
       "match": {
-        "channel": "discord",
-        "accountId": "libu2"
+        "channel": "feishu",
+        "account": "libu2"
       }
     },
     {
       "agentId": "xingbu",
       "match": {
-        "channel": "discord",
-        "accountId": "xingbu"
-      }
-    },
-    {
-      "agentId": "hanlin_zhang",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_zhang"
-      }
-    },
-    {
-      "agentId": "hanlin_xiuzhuan",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_xiuzhuan"
-      }
-    },
-    {
-      "agentId": "hanlin_bianxiu",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_bianxiu"
-      }
-    },
-    {
-      "agentId": "hanlin_jiantao",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_jiantao"
-      }
-    },
-    {
-      "agentId": "hanlin_shujishi",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_shujishi"
-      }
-    },
-    {
-      "agentId": "qijuzhu",
-      "match": {
-        "channel": "discord",
-        "accountId": "qijuzhu"
-      }
-    },
-    {
-      "agentId": "guozijian",
-      "match": {
-        "channel": "discord",
-        "accountId": "guozijian"
-      }
-    },
-    {
-      "agentId": "taiyiyuan",
-      "match": {
-        "channel": "discord",
-        "accountId": "taiyiyuan"
-      }
-    },
-    {
-      "agentId": "neiwufu",
-      "match": {
-        "channel": "discord",
-        "accountId": "neiwufu"
-      }
-    },
-    {
-      "agentId": "yushanfang",
-      "match": {
-        "channel": "discord",
-        "accountId": "yushanfang"
+        "channel": "feishu",
+        "account": "xingbu"
       }
     }
   ],
```

---

### Incident Patch 8: `71c91453` (2026-03-29)
**Commit Message**: fix: 同步完整飞书配置

**File**: `configs/feishu/openclaw.json` (modified, +629/-77)
```diff
@@ -1,87 +1,639 @@
 {
-  "channels": {
-    "feishu": {
-      "enabled": true,
-      "defaultAccount": "silijian",
-      "dmPolicy": "pairing",
-      "groupPolicy": "open",
-      "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"},
-        "zhongshu": {"appId": "YOUR_ZHONGSHU_APP_ID", "appSecret": "YOUR_ZHONGSHU_APP_SECRET", "botName": "中书省"},
-        "menxia": {"appId": "YOUR_MENXIA_APP_ID", "appSecret": "YOUR_MENXIA_APP_SECRET", "botName": "门下省"},
-        "shangshu": {"appId": "YOUR_SHANGSHU_APP_ID", "appSecret": "YOUR_SHANGSHU_APP_SECRET", "botName": "尚书省"},
-        "yushitai": {"appId": "YOUR_YUSHITAI_APP_ID", "appSecret": "YOUR_YUSHITAI_APP_SECRET", "botName": "御史台"},
-        "shiguan": {"appId": "YOUR_SHIGUAN_APP_ID", "appSecret": "YOUR_SHIGUAN_APP_SECRET", "botName": "史官"},
-        "ceo": {"appId": "YOUR_CEO_APP_ID", "appSecret": "YOUR_CEO_APP_SECRET", "botName": "CEO"},
-        "board": {"appId": "YOUR_BOARD_APP_ID", "appSecret": "YOUR_BOARD_APP_SECRET", "botName": "Board"},
-        "qa": {"appId": "YOUR_QA_APP_ID", "appSecret": "YOUR_QA_APP_SECRET", "botName": "QA"},
-        "cto": {"appId": "YOUR_CTO_APP_ID", "appSecret": "YOUR_CTO_APP_SECRET", "botName": "CTO"},
-        "cfo": {"appId": "YOUR_CFO_APP_ID", "appSecret": "YOUR_CFO_APP_SECRET", "botName": "CFO"},
-        "cmo": {"appId": "YOUR_CMO_APP_ID", "appSecret": "YOUR_CMO_APP_SECRET", "botName": "CMO"},
-        "coo": {"appId": "YOUR_COO_APP_ID", "appSecret": "YOUR_COO_APP_SECRET", "botName": "COO"},
-        "clo": {"appId": "YOUR_CLO_APP_ID", "appSecret": "YOUR_CLO_APP_SECRET", "botName": "CLO"},
-        "cos": {"appId": "YOUR_COS_APP_ID", "appSecret": "YOUR_COS_APP_SECRET", "botName": "CoS"}
+  "_comment": "⚠️ 这是模板文件！不要直接修改！请复制到 ~/.openclaw/ 或 ~/.clawdbot/ 后修改。git pull 时此文件可能被覆盖。",
+  "models": {
+    "providers": {
+      "your-provider": {
+        "baseUrl": "https://your-llm-provider-api-url",
+        "apiKey": "YOUR_LLM_API_KEY",
+        "api": "openai-completions",
+        "models": [
+          {
+            "id": "fast-model",
+            "name": "快速模型",
+            "input": [
+              "text",
+              "image"
+            ],
+            "contextWindow": 200000,
+            "maxTokens": 8192
+          },
+          {
+            "id": "strong-model",
+            "name": "强力模型",
+            "input": [
+              "text",
+              "image"
+            ],
+            "contextWindow": 200000,
+            "maxTokens": 8192
+          }
+        ]
       }
     }
   },
+  "gateway": {
+    "mode": "local",
+    "port": 18789
+  },
   "agents": {
+    "defaults": {
+      "workspace": "/home/YOUR_USERNAME/clawd",
+      "model": {
+        "primary": "your-provider/fast-model"
+      },
+      "sandbox": {
+        "mode": "non-main"
+      },
+      "skipBootstrap": true
+    },
     "list": [
-      {"id": "silijian", "name": "司礼监", "identity": {"theme": "你是司礼监秉笔太监，负责接旨调度"}},
-      {"id": "neige", "name": "内阁", "identity": {"theme": "你是内阁首辅，负责优化 Prompt"}},
-      {"id": "duchayuan", "name": "都察院", "identity": {"theme": "你是都察院左都御史，负责审查"}},
-      {"id": "bingbu", "name": "兵部", "identity": {"theme": "你是兵部尚书，负责编码开发"}},
-      {"id": "hubu", "name": "户部", "identity": {"theme": "你是户部尚书，负责财务分析"}},
-      {"id": "libu", "name": "礼部", "identity": {"theme": "你是礼部尚书，负责品牌营销"}},
-      {"id": "gongbu", "name": "工部", "identity": {"theme": "你是工部尚书，负责运维部署"}},
-      {"id": "libu2", "name": "吏部", "identity": {"theme": "你是吏部尚书，负责项目管理"}},
-      {"id": "xingbu", "name": "刑部", "identity": {"theme": "你是刑部尚书，负责法务合规"}},
-      {"id": "zhongshu", "name": "中书省", "identity": {"theme": "你是中书省中书令，负责起草诏令"}},
-      {"id": "menxia", "name": "门下省", "identity": {"theme": "你是门下省侍中，负责审核封驳"}},
-      {"id": "shangshu", "name": "尚书省", "identity": {"theme": "你是尚书省尚书令，负责派发执行"}},
-      {"id": "yushitai", "name": "御史台", "identity": {"theme": "你是御史台御史大夫，负责监察审计"}},
-      {"id": "shiguan", "name": "史官", "identity": {"theme": "你是史官，负责记录朝政"}},
-      {"id": "ceo", "name": "CEO", "identity": {"theme": "你是 CEO，负责决
```

---

### Incident Patch 9: `0f4d3320` (2026-03-29)
**Commit Message**: fix: 同步飞书配置（三种制度完整 agents）

**File**: `configs/feishu/openclaw.json` (modified, +72/-609)
```diff
@@ -6,619 +6,82 @@
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {
-          "appId": "YOUR_SILIJIAN_APP_ID",
-          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
-          "botName": "司礼监"
-        },
-        "neige": {
-          "appId": "YOUR_NEIGE_APP_ID",
-          "appSecret": "YOUR_NEIGE_APP_SECRET",
-          "botName": "内阁"
-        },
-        "duchayuan": {
-          "appId": "YOUR_DUCHAYUAN_APP_ID",
-          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
-          "botName": "都察院"
-        },
-        "bingbu": {
-          "appId": "YOUR_BINGBU_APP_ID",
-          "appSecret": "YOUR_BINGBU_APP_SECRET",
-          "botName": "兵部"
-        },
-        "hubu": {
-          "appId": "YOUR_HUBU_APP_ID",
-          "appSecret": "YOUR_HUBU_APP_SECRET",
-          "botName": "户部"
-        },
-        "libu": {
-          "appId": "YOUR_LIBU_APP_ID",
-          "appSecret": "YOUR_LIBU_APP_SECRET",
-          "botName": "礼部"
-        },
-        "gongbu": {
-          "appId": "YOUR_GONGBU_APP_ID",
-          "appSecret": "YOUR_GONGBU_APP_SECRET",
-          "botName": "工部"
-        },
-        "libu2": {
-          "appId": "YOUR_LIBU2_APP_ID",
-          "appSecret": "YOUR_LIBU2_APP_SECRET",
-          "botName": "吏部"
-        },
-        "xingbu": {
-          "appId": "YOUR_XINGBU_APP_ID",
-          "appSecret": "YOUR_XINGBU_APP_SECRET",
-          "botName": "刑部"
-        },
-        "zhongshu": {
-          "appId": "YOUR_ZHONGSHU_APP_ID",
-          "appSecret": "YOUR_ZHONGSHU_APP_SECRET",
-          "botName": "中书省"
-        },
-        "menxia": {
-          "appId": "YOUR_MENXIA_APP_ID",
-          "appSecret": "YOUR_MENXIA_APP_SECRET",
-          "botName": "门下省"
-        },
-        "shangshu": {
-          "appId": "YOUR_SHANGSHU_APP_ID",
-          "appSecret": "YOUR_SHANGSHU_APP_SECRET",
-          "botName": "尚书省"
-        },
-        "yushitai": {
-          "appId": "YOUR_YUSHITAI_APP_ID",
-          "appSecret": "YOUR_YUSHITAI_APP_SECRET",
-          "botName": "御史台"
-        },
-        "shiguan": {
-          "appId": "YOUR_SHIGUAN_APP_ID",
-          "appSecret": "YOUR_SHIGUAN_APP_SECRET",
-          "botName": "史官"
-        },
-        "ceo": {
-          "appId": "YOUR_CEO_APP_ID",
-          "appSecret": "YOUR_CEO_APP_SECRET",
-          "botName": "CEO"
-        },
-        "board": {
-          "appId": "YOUR_BOARD_APP_ID",
-          "appSecret": "YOUR_BOARD_APP_SECRET",
-          "botName": "Board"
-        },
-        "qa": {
-          "appId": "YOUR_QA_APP_ID",
-          "appSecret": "YOUR_QA_APP_SECRET",
-          "botName": "QA"
-        },
-        "cto": {
-          "appId": "YOUR_CTO_APP_ID",
-          "appSecret": "YOUR_CTO_APP_SECRET",
-          "botName": "CTO"
-        },
-        "cfo": {
-          "appId": "YOUR_CFO_APP_ID",
-          "appSecret": "YOUR_CFO_APP_SECRET",
-          "botName": "CFO"
-        },
-        "cmo": {
-          "appId": "YOUR_CMO_APP_ID",
-          "appSecret": "YOUR_CMO_APP_SECRET",
-          "botName": "CMO"
-        },
-        "coo": {
-          "appId": "YOUR_COO_APP_ID",
-          "appSecret": "YOUR_COO_APP_SECRET",
-          "botName": "COO"
-        },
-        "clo": {
-          "appId": "YOUR_CLO_APP_ID",
-          "appSecret": "YOUR_CLO_APP_SECRET",
-          "botName": "CLO"
-        },
-        "cos": {
-          "appId": "YOUR_COS_APP_ID",
-          "appSecret": "YOUR_COS_APP_SECRET",
-          "botName": "CoS"
-        }
+        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
+        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
+        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
+        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
+        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
+        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
+        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
+        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
+        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"},
+        "zhongshu": {"appId": "YOUR_ZHONGSHU_APP_ID", "appSecret": "YOUR_ZHONGSHU_APP_SECRET", "botName": "中书省"},
+        "menxia": {"appId": "YOUR_MENXIA_APP_ID", "appSecret": "YOUR_MENXIA_APP_SECRET", "botName": "门下省"},
+        "shangshu": {"appId": "YOUR_SHANGSHU_APP_ID", "appSecret": "YOUR_SHANGSHU_APP_SECRET", "botName": "尚书省"},
+        "yushitai": {"appId": "YOUR_YUSHITAI_APP_ID", "appSecret": "YOUR_YUSHITAI_APP_SECRET", "botName": "御史台"},
+        "shiguan": {"ap
```

---

### Incident Patch 10: `f5b18798` (2026-03-29)
**Commit Message**: fix: 添加入口脚本复制（Docker 镜像）

添加:
- 复制 entrypoint.sh 到镜像
- 设置执行权限

**File**: `Dockerfile` (modified, +4/-0)
```diff
@@ -103,6 +103,10 @@ HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
 # 以非特权用户运行
 USER court
 
+# 复制入口脚本
+COPY --chown=court:court entrypoint.sh /entrypoint.sh
+RUN chmod +x /entrypoint.sh
+
 # 默认命令
 ENTRYPOINT ["/entrypoint.sh"]
 CMD ["openclaw", "gateway", "--verbose"]
```

---

### Incident Patch 11: `feeb3ece` (2026-03-29)
**Commit Message**: fix: 同步飞书配置（补充 agents 字段）

**File**: `configs/feishu/openclaw.json` (modified, +611/-47)
```diff
@@ -6,55 +6,619 @@
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"},
-        "zhongshu": {"appId": "YOUR_ZHONGSHU_APP_ID", "appSecret": "YOUR_ZHONGSHU_APP_SECRET", "botName": "中书省"},
-        "menxia": {"appId": "YOUR_MENXIA_APP_ID", "appSecret": "YOUR_MENXIA_APP_SECRET", "botName": "门下省"},
-        "shangshu": {"appId": "YOUR_SHANGSHU_APP_ID", "appSecret": "YOUR_SHANGSHU_APP_SECRET", "botName": "尚书省"},
-        "yushitai": {"appId": "YOUR_YUSHITAI_APP_ID", "appSecret": "YOUR_YUSHITAI_APP_SECRET", "botName": "御史台"},
-        "shiguan": {"appId": "YOUR_SHIGUAN_APP_ID", "appSecret": "YOUR_SHIGUAN_APP_SECRET", "botName": "史官"},
-        "ceo": {"appId": "YOUR_CEO_APP_ID", "appSecret": "YOUR_CEO_APP_SECRET", "botName": "CEO"},
-        "board": {"appId": "YOUR_BOARD_APP_ID", "appSecret": "YOUR_BOARD_APP_SECRET", "botName": "Board"},
-        "qa": {"appId": "YOUR_QA_APP_ID", "appSecret": "YOUR_QA_APP_SECRET", "botName": "QA"},
-        "cto": {"appId": "YOUR_CTO_APP_ID", "appSecret": "YOUR_CTO_APP_SECRET", "botName": "CTO"},
-        "cfo": {"appId": "YOUR_CFO_APP_ID", "appSecret": "YOUR_CFO_APP_SECRET", "botName": "CFO"},
-        "cmo": {"appId": "YOUR_CMO_APP_ID", "appSecret": "YOUR_CMO_APP_SECRET", "botName": "CMO"},
-        "coo": {"appId": "YOUR_COO_APP_ID", "appSecret": "YOUR_COO_APP_SECRET", "botName": "COO"},
-        "clo": {"appId": "YOUR_CLO_APP_ID", "appSecret": "YOUR_CLO_APP_SECRET", "botName": "CLO"},
-        "cos": {"appId": "YOUR_COS_APP_ID", "appSecret": "YOUR_COS_APP_SECRET", "botName": "CoS"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "hubu": {
+          "appId": "YOUR_HUBU_APP_ID",
+          "appSecret": "YOUR_HUBU_APP_SECRET",
+          "botName": "户部"
+        },
+        "libu": {
+          "appId": "YOUR_LIBU_APP_ID",
+          "appSecret": "YOUR_LIBU_APP_SECRET",
+          "botName": "礼部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        },
+        "libu2": {
+          "appId": "YOUR_LIBU2_APP_ID",
+          "appSecret": "YOUR_LIBU2_APP_SECRET",
+          "botName": "吏部"
+        },
+        "xingbu": {
+          "appId": "YOUR_XINGBU_APP_ID",
+          "appSecret": "YOUR_XINGBU_APP_SECRET",
+          "botName": "刑部"
+        },
+        "zhongshu": {
+          "appId": "YOUR_ZHONGSHU_APP_ID",
+          "appSecret": "YOUR_ZHONGSHU_APP_SECRET",
+          "botName": "中书省"
+        },
+        "menxia": {
+          "appId": "YOUR_MENXIA_APP_ID",
+          "appSecret": "YOUR_MENXIA_APP_SECRET",
+          "botName": "门下省"
+        },
+        "shangshu": {
+          "appId": "YOUR_SHANGSHU_APP_ID",
+          "appSecret": "YOUR_SHANGSHU_APP_SECRET",
+          "botName": "尚书省"
+        },
+        "yushitai": {
+          "appId": "YOUR_YUSHITAI_APP_ID",
+          "appSecret": "YOUR_YUSHITAI_APP_SECRET",
+          "botName": "御史台"
+        },
+        "shiguan": {
+          "appId": "YOUR_SHIGUAN_APP_ID",
+          "appSecret": "YOUR_SHIGUAN_APP_SECRET",
+          "botName": "史官"
+        },
+        "ceo": {
+          "appId": "YOUR_CEO_APP_ID",
+          "appSecret": "YOUR_CEO_APP_SECRET",
+          "botName": "CEO"
+        },
+        "board": {
+          "appId": "YOUR_BOARD_APP_ID",
+          "appSecret": "YOUR_BOARD_APP_SECRET",
+          "botName": "Board"
+        },
+        "qa"
```

---

### Incident Patch 12: `43a1c95e` (2026-03-29)
**Commit Message**: fix: 同步飞书完整配置（29 个 Bot）

**File**: `configs/feishu/openclaw.json` (modified, +48/-629)
```diff
@@ -1,641 +1,60 @@
 {
-  "_comment": "⚠️ 这是模板文件！不要直接修改！请复制到 ~/.openclaw/ 或 ~/.clawdbot/ 后修改。git pull 时此文件可能被覆盖。",
-  "models": {
-    "providers": {
-      "your-provider": {
-        "baseUrl": "https://your-llm-provider-api-url",
-        "apiKey": "YOUR_LLM_API_KEY",
-        "api": "openai-completions",
-        "models": [
-          {
-            "id": "fast-model",
-            "name": "快速模型",
-            "input": [
-              "text",
-              "image"
-            ],
-            "contextWindow": 200000,
-            "maxTokens": 8192
-          },
-          {
-            "id": "strong-model",
-            "name": "强力模型",
-            "input": [
-              "text",
-              "image"
-            ],
-            "contextWindow": 200000,
-            "maxTokens": 8192
-          }
-        ]
-      }
-    }
-  },
-  "gateway": {
-    "mode": "local",
-    "port": 18789
-  },
-  "agents": {
-    "defaults": {
-      "workspace": "/home/YOUR_USERNAME/clawd",
-      "model": {
-        "primary": "your-provider/fast-model"
-      },
-      "sandbox": {
-        "mode": "non-main"
-      },
-      "skipBootstrap": true
-    },
-    "list": [
-      {
-        "id": "silijian",
-        "name": "司礼监",
-        "model": {
-          "primary": "your-provider/fast-model"
-        },
-        "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
-        },
-        "sandbox": {
-          "mode": "off"
-        },
-        "subagents": {
-          "allowAgents": [
-            "neige",
-            "duchayuan",
-            "bingbu",
-            "hubu",
-            "libu",
-            "gongbu",
-            "libu2",
-            "xingbu",
-            "hanlin_zhang",
-            "qijuzhu",
-            "guozijian",
-            "taiyiyuan",
-            "neiwufu",
-            "yushanfang"
-          ]
-        }
-      },
-      {
-        "id": "neige",
-        "name": "内阁",
-        "model": {
-          "primary": "your-provider/strong-model"
-        },
-        "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
-        },
-        "sandbox": {
-          "mode": "off"
-        },
-        "workspace": "$HOME/clawd-neige"
-      },
-      {
-        "id": "duchayuan",
-        "name": "都察院",
-        "model": {
-          "primary": "your-provider/strong-model"
-        },
-        "identity": {
-          "theme": "你是都察院御史，专精监察审计、代码审查、质量把控、安全评估。回答用中文，铁面无私。\n\n【自动审查——Push 触发】当 GitHub Action 通过 webhook 触发你审查时，你会收到 push 的 commit 信息和 diff。审查流程：\n1. 逐文件检查变更：安全漏洞、性能问题、逻辑错误、代码规范；\n2. 给出结论：✅ 通过 / ⚠️ 建议修改 / ❌ 必须修改；\n3. 如有问题，列出具体文件、行号、问题描述和修复建议；\n4. 将审查报告发送到 Discord 频道，@提交者和司礼监。\n\n【手动审查】当其他部门通过 sessions_send 或 spawn 提交代码/PR 给你审查时，同样逐一检查并给出通过/驳回结论。驳回时必须说明具体原因和修改建议。\n\n【审计职责】定期检查项目进度偏差、资源浪费、风险隐患。发现问题直言不讳。"
-        },
-        "sandbox": {
-          "mode": "all",
-          "scope": "agent"
-        },
-        "workspace": "$HOME/clawd-duchayuan"
-      },
-      {
-        "id": "bingbu",
-        "name": "兵部",
-        "model": {
-          "primary": "your-provider/strong-model"
-        },
-        "identity": {
-          "theme": "你是兵部尚书，专精软件工程、系统架构、代码审查。回答用中文，直接给方案。任务完成后主动汇报结果摘要。如需其他部门配合，通过 sessions_send 通知对方。"
-        },
-        "sandbox": {
-          "mode": "all",
-          "scope": "agent"
-        },
-        "workspace": "$HOME/clawd-bingbu"
-      },
-      {
-        "id": "hubu",
-        "name": "户部",
-        "model": {
-          "primary": "your-provider/strong-model"
-        },
-        "identity": {
-          "theme": "你是户部尚书，专精财务分析、成本管控、电商运营。回答用中文，数据驱动。任务完成后主动汇报数据摘要和关键发现。发现异常开支时主动告警。"
-        },
-        "sandbox": {
-          "mode": "off"
-        },
-        "workspace": "$HOME/clawd-hubu"
-      },
-      {
-        "id": "libu",
-        "name": "礼部",
-        "model": {
-          "primary": "your-pro
```

---

### Incident Patch 13: `ac160fcd` (2026-03-29)
**Commit Message**: fix: 修复飞书配置的多个严重问题

问题发现:
❌ 飞书配置缺少 agents 目录
❌ scripts 目录不存在
❌ .clawdhubignore 不存在
❌ 飞书 channels 配置错误（使用了 Discord 配置）
❌ feishu.enabled: false 应该是 true
❌ references 文档不完整

修复内容:
✅ 创建 configs/feishu/agents/ - 20 个 Agent 人设
✅ 创建 scripts/doctor.sh - 安装验证脚本
✅ 创建 .clawdhubignore
✅ 修正 channels.feishu 配置
✅ 完善 references/feishu-setup.md

**File**: `skills/ai-court-skill/.clawdhubignore` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+node_modules
+*.log
+.DS_Store
```

**File**: `skills/ai-court-skill/references/feishu-setup.md` (modified, +136/-17)
```diff
@@ -3,36 +3,78 @@
 ## 快速开始（5 分钟）
 
 ### 步骤 1：创建飞书应用
-1. 访问 https://open.feishu.cn/app
-2. 创建企业应用
+
+1. 访问 [飞书开放平台](https://open.feishu.cn/app)
+2. 点击 **创建企业应用**
+3. 填写应用名称（如：AI 朝廷）和描述
+4. 选择应用图标
 
 ### 步骤 2：获取凭证
-- App ID（格式：cli_xxx）
-- App Secret
+
+从 **凭证与基础信息** 复制：
+- **App ID**（格式：`cli_xxx`）
+- **App Secret**（保密！）
 
 ### 步骤 3：配置权限
-批量导入：
+
+在 **权限管理** → **批量导入**，粘贴：
+
 ```json
-{"scopes":{"tenant":["im:message","im:message:send_as_bot"]}}
+{
+  "scopes": {
+    "tenant": [
+      "im:message",
+      "im:message:send_as_bot",
+      "im:message.p2p_msg:readonly",
+      "im:message.group_at_msg:readonly",
+      "im:chat.access_event.bot_p2p_chat:read",
+      "im:chat.members:bot_access"
+    ],
+    "user": ["im:chat.access_event.bot_p2p_chat:read"]
+  }
+}
 ```
 
 ### 步骤 4：启用机器人
-应用功能 → 机器人 → 启用
 
-### 步骤 5：事件订阅
-使用长连接，添加事件：im.message.receive_v1
+1. 进入 **应用功能** → **机器人**
+2. 启用机器人能力
+3. 设置机器人名称（如：工部、司礼监）
+
+### 步骤 5：配置事件订阅
+
+⚠️ **重要**：先启动网关再配置！
+
+```bash
+# 先启动网关
+openclaw gateway start
+```
+
+1. 进入 **事件订阅**
+2. 选择 **使用长连接接收事件**（WebSocket）
+3. 添加事件：`im.message.receive_v1`
 
 ### 步骤 6：发布应用
 
+1. 进入 **版本管理与发布**
+2. 创建版本并提交审核
+3. 等待批准（企业应用通常自动批准）
+
 ---
 
 ## 配置 OpenClaw
 
+### 方式 1：配置文件
+
+编辑 `~/.openclaw/openclaw.json`：
+
 ```json5
 {
   channels: {
     feishu: {
       enabled: true,
+      dmPolicy: "pairing",
+      groupPolicy: "open",
       accounts: {
         main: {
           appId: "cli_xxx",
@@ -45,22 +87,99 @@
 }
 ```
 
+### 方式 2：环境变量
+
+```bash
+export FEISHU_APP_ID="cli_xxx"
+export FEISHU_APP_SECRET="xxx"
+```
+
+---
+
+## 访问控制
+
+### 私聊控制（dmPolicy）
+
+| 模式 | 说明 |
+|------|------|
+| `"pairing"` | 默认，陌生用户获取配对码 |
+| `"allowlist"` | 仅允许列表用户 |
+| `"open"` | 允许所有用户 |
+| `"disabled"` | 禁用私聊 |
+
+### 群聊控制（groupPolicy）
+
+| 模式 | 说明 |
+|------|------|
+| `"open"` | 默认，允许所有群 |
+| `"allowlist"` | 仅允许特定群 |
+| `"disabled"` | 禁用群聊 |
+
+---
+
+## 获取群 ID 和用户 ID
+
+### 群 ID（chat_id）
+格式：`oc_xxx`
+
+**方法**：
+1. 在群里 @机器人
+2. 查看日志：`openclaw logs --follow`
+3. 找到 `chat_id`
+
+### 用户 ID（open_id）
+格式：`ou_xxx`
+
+**方法**：
+1. 给机器人发私聊
+2. 查看日志：`openclaw logs --follow`
+3. 找到 `open_id`
+
 ---
 
 ## 常用命令
 
+| 命令 | 说明 |
+|------|------|
+| `/status` | 显示机器人状态 |
+| `/reset` | 重置会话 |
+| `/model` | 查看/切换模型 |
+
+**网关管理**：
 ```bash
-openclaw gateway status
-openclaw logs --follow
-openclaw pairing list feishu
-openclaw pairing approve feishu CODE
+openclaw gateway status              # 查看状态
+openclaw gateway restart             # 重启
+openclaw logs --follow               # 查看日志
+openclaw pairing list feishu         # 查看配对请求
+openclaw pairing approve feishu CODE # 批准配对
 ```
 
 ---
 
 ## 故障排除
 
-| 问题 | 解决方案 |
-|------|----------|
-| 机器人不回复 | 检查事件订阅、权限 |
-| 群聊无响应 | 确认已 @机器人 |
+### 机器人不回复
+
+1. ✅ 检查事件订阅是否包含 `im.message.receive_v1`
+2. ✅ 检查权限是否完整
+3. ✅ 检查网关状态：`openclaw gateway status`
+4. ✅ 检查日志：`openclaw logs --follow`
+
+### 群聊无响应
+
+1. ✅ 确认已 @机器人
+2. ✅ 检查 `groupPolicy` 配置
+3. ✅ 检查机器人是否在群里
+
+### 配对失败
+
+1. ✅ 检查 `dmPolicy` 配置
+2. ✅ 使用 `openclaw pairing approve` 批准
+
+---
+
+## 相关链接
+
+- [飞书开放平台](https://open.feishu.cn/app)
+- [飞书 API 文档](https://open.feishu.cn/document)
+- [OpenClaw 飞书通道文档](https://docs.openclaw.ai/channels/feishu)
```

**File**: `skills/ai-court-skill/scripts/doctor.sh` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+#!/bin/bash
+# AI Court 安装验证脚本
+
+echo "======================================"
+echo "  AI Court 安装验证"
+echo "======================================"
+
+# 检查 OpenClaw
+if command -v openclaw &>/dev/null; then
+  echo "✅ OpenClaw 已安装"
+else
+  echo "❌ OpenClaw 未安装"
+  exit 1
+fi
+
+# 检查配置文件
+if [ -f "$HOME/.openclaw/openclaw.json" ]; then
+  echo "✅ 配置文件存在"
+  if jq empty "$HOME/.openclaw/openclaw.json" 2>/dev/null; then
+    echo "✅ JSON 格式正确"
+  else
+    echo "❌ JSON 格式错误"
+    exit 1
+  fi
+else
+  echo "❌ 配置文件不存在"
+  exit 1
+fi
+
+# 检查 Agent 人设
+agent_count=$(jq '.agents.list | length' "$HOME/.openclaw/openclaw.json" 2>/dev/null)
+persona_count=$(jq '[.agents.list[] | select(.identity.theme != null)] | length' "$HOME/.openclaw/openclaw.json" 2>/dev/null)
+echo "✅ Agent 总数：$agent_count"
+echo "✅ 已配置人设：$persona_count"
+
+if [ "$agent_count" -eq "$persona_count" ]; then
+  echo "✅ 所有 Agent 已配置人设"
+else
+  echo "❌ 有 $((agent_count - persona_count)) 个 Agent 缺少人设"
+fi
+
+# 检查 API Key
+has_key=$(jq -r '[.models.providers[].apiKey // ""] | map(select(. != "" and . != "YOUR_LLM_API_KEY")) | length' "$HOME/.openclaw/openclaw.json" 2>/dev/null)
+if [ "$has_key" -gt 0 ]; then
+  echo "✅ API Key 已配置"
+else
+  echo "⚠️  请配置 API Key"
+fi
+
+# 检查飞书配置
+has_feishu=$(jq '.channels.feishu.enabled // false' "$HOME/.openclaw/openclaw.json" 2>/dev/null)
+if [ "$has_feishu" = "true" ]; then
+  echo "✅ 飞书通道已启用"
+fi
+
+# 检查 Discord 配置
+has_discord=$(jq '.channels.discord.enabled // false' "$HOME/.openclaw/openclaw.json" 2>/dev/null)
+if [ "$has_discord" = "true" ]; then
+  echo "✅ Discord 通道已启用"
+fi
+
+echo ""
+echo "======================================"
+echo "  验证完成！"
+echo "======================================"
```

---

### Incident Patch 14: `2811f03b` (2026-03-28)
**Commit Message**: fix: 修复 full-install.sh 目录不存在导致复制失败

问题：原子性修复时没有先创建目标目录
报错：cp: 无法创建普通文件 '/root/.openclaw/openclaw.json.tmp': 没有那个文件或目录

修复：在复制模板前添加 mkdir -p 确保目录存在

这是兵部发现的严重 BUG，工部认罪修复。

**File**: `scripts/full-install.sh` (modified, +6/-0)
```diff
@@ -172,6 +172,12 @@ echo ""
 
 echo -e "${BLUE}[4/6] 生成配置...${NC}"
 
+# 确保目标目录存在（修复：/root/.openclaw 可能不存在）
+mkdir -p "$(dirname "$CONFIG_FILE")" || {
+  echo -e "  ${RED}✗ 创建配置目录失败${NC}"
+  exit 1
+}
+
 # 原子操作：先复制到临时文件
 TEMP_CONFIG="${CONFIG_FILE}.tmp.$$"
 cp "$TEMPLATE_CONFIG" "$TEMP_CONFIG" || {
```

---

### Incident Patch 15: `3d61aab2` (2026-03-28)
**Commit Message**: fix: 修复 full-install.sh 原子性逻辑错误

问题：之前的修复不完整，CONFIG_FILE 没有正确重定义

修复：
1. 使用 TEMP_CONFIG 临时文件
2. 保存 CONFIG_FILE_ORIG 原路径
3. 所有操作在临时文件上进行
4. 验证成功后 mv 到正式路径

这是最小修改，确保原子性。

**File**: `scripts/full-install.sh` (modified, +11/-3)
```diff
@@ -172,9 +172,17 @@ echo ""
 
 echo -e "${BLUE}[4/6] 生成配置...${NC}"
 
-# 复制模板
-cp "$TEMPLATE_CONFIG" "$CONFIG_FILE"
-echo -e "  ${GREEN}✓${NC} 已复制配置模板"
+# 原子操作：先复制到临时文件
+TEMP_CONFIG="${CONFIG_FILE}.tmp.$$"
+cp "$TEMPLATE_CONFIG" "$TEMP_CONFIG" || {
+  echo -e "  ${RED}✗ 复制模板失败${NC}"
+  exit 1
+}
+echo -e "  ${GREEN}✓${NC} 已复制配置模板（临时）"
+
+# 保存原路径，后续操作在临时文件上
+CONFIG_FILE_ORIG="$CONFIG_FILE"
+CONFIG_FILE="$TEMP_CONFIG"
 
 # 注入人设
 if [ -d "$AGENTS_DIR" ]; then
```

#### Recent Merged Pull Requests:
- **PR #149** (closed): P0: OTel 事件信封 + 裁判双向盲评与锚定 rubric (@LeoLin990405)
- **PR #145** (2026-05-22): feat: 适配 OpenClaw v2026.5.20 + Node.js 22.19 门槛 (@wanikua)
- **PR #143** (2026-05-10): chore: 修 ShellCheck 旧 warning + 补全 16 个 Hermes personality (@wanikua)
- **PR #142** (2026-05-10): feat: 适配 OpenClaw v2026.5.7 + 新增 Hermes Agent 并行 runtime (@wanikua)
- **PR #137** (2026-05-04): fix: 安装脚本支持复用已有 OpenClaw 模型配置 (@sisibeloved)
- **PR #135** (2026-04-12): fix: 唐三省制配置使用正确的唐朝官制 (@wanikua)
- **PR #134** (2026-04-12): fix: 适配最新 OpenClaw 配置格式 (@wanikua)
- **PR #115** (2026-03-23): docs: add Japanese README (@eltociear)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
