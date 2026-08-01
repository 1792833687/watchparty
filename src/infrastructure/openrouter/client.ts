/**
 * OpenRouter API 客户端 — AI Narrator Game
 *
 * @description
 * 纯前端直连 OpenRouter（ADR-001）。
 * 支持流式 SSE（fetch + ReadableStream）和非流式 fallback。
 * 含指数退避重试 + AbortController 取消 + 超时保护。
 *
 * @see docs/architecture/adr/001-frontend-vs-backend.md
 * @see design/gdd/dialogue-system.md §4.4
 */

import type { LLMConfig, LLMResponse, LLMUsage, OpenRouterMessage } from '@/systems/dialogue/types';
import {
  LLM_MAX_RETRIES,
  LLM_REQUEST_TIMEOUT_MS,
  LLM_RETRY_BASE_DELAY_MS,
  OPENROUTER_BASE_URL,
  DEEPSEEK_BASE_URL,
} from '@/lib/constants';

/** 检测模型是否需要走 DeepSeek 直连 */
function getBaseUrlForModel(modelId: string): string {
  // 通过 OpenRouter 代理的模型不加前缀
  // 直连模型直接用 DeepSeek endpoint
  if (modelId === 'deepseek-chat' || modelId === 'deepseek-reasoner') {
    return DEEPSEEK_BASE_URL;
  }
  return OPENROUTER_BASE_URL;
}

// ============================================================
// 错误类型
// ============================================================

export enum OpenRouterErrorType {
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  PARSE_ERROR = 'PARSE_ERROR',
  STREAM_ERROR = 'STREAM_ERROR',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN',
}

export class OpenRouterError extends Error {
  public readonly type: OpenRouterErrorType;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    type: OpenRouterErrorType,
    message: string,
    statusCode?: number,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenRouterError';
    this.type = type;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }

  static fromHttpStatus(status: number, body: string): OpenRouterError {
    switch (status) {
      case 401:
        return new OpenRouterError(
          OpenRouterErrorType.UNAUTHORIZED,
          'API Key 无效或已过期。请在设置中更新您的 OpenRouter API Key。',
          status,
          false
        );
      case 429:
        return new OpenRouterError(
          OpenRouterErrorType.RATE_LIMITED,
          '请求过于频繁，请稍后再试。',
          status,
          true
        );
      case 402:
        return new OpenRouterError(
          OpenRouterErrorType.PAYMENT_REQUIRED,
          'OpenRouter 账户余额不足。请充值后重试。',
          status,
          false
        );
      default:
        if (status >= 500) {
          return new OpenRouterError(
            OpenRouterErrorType.SERVER_ERROR,
            `OpenRouter 服务器错误 (${status})。${body.slice(0, 200)}`,
            status,
            true
          );
        }
        return new OpenRouterError(
          OpenRouterErrorType.UNKNOWN,
          `未知错误 (${status}): ${body.slice(0, 200)}`,
          status,
          false
        );
    }
  }
}

// ============================================================
// 配置
// ============================================================

export interface OpenRouterClientConfig {
  apiKey: string;
  baseUrl?: string;
  customProxyUrl?: string;
  httpReferer?: string;
  appTitle?: string;
}

// ============================================================
// OpenRouter 客户端
// ============================================================

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private customProxyUrl?: string;
  private httpReferer: string;
  private appTitle: string;

  constructor(config: OpenRouterClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || OPENROUTER_BASE_URL;
    this.customProxyUrl = config.customProxyUrl;
    this.httpReferer = config.httpReferer || '';
    this.appTitle = config.appTitle || 'AI Narrator Game';
  }

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 非流式聊天补全。
   * 带自动重试（指数退避 1s/3s/9s，最多 3 次）。
   */
  async sendChatCompletion(
    config: LLMConfig,
    messages: OpenRouterMessage[],
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const startTime = performance.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < LLM_MAX_RETRIES; attempt++) {
      try {
        return await this.doNonStreamingRequest(config, messages, signal, startTime);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 不可重试的错误直接抛出
        if (error instanceof OpenRouterError && !error.retryable) {
          throw error;
        }

        // 取消不重试
        if (error instanceof OpenRouterError && error.type === OpenRouterErrorType.CANCELLED) {
          throw error;
        }

        // 最后一次尝试也失败
        if (attempt === LLM_MAX_RETRIES - 1) {
          break;
        }

        // 指数退避
        const delay = LLM_RETRY_BASE_DELAY_MS * Math.pow(3, attempt);
        await this.delay(delay);
      }
    }

    throw new OpenRouterError(
      OpenRouterErrorType.NETWORK_ERROR,
      `请求失败（已重试 ${LLM_MAX_RETRIES} 次）: ${lastError?.message}`,
      undefined,
      false
    );
  }

  /**
   * 流式聊天补全（SSE）。
   * 通过 onChunk 回调逐步传递 token。
   * 流中断时自动 fallback 到非流式补全。
   */
  async streamChatCompletion(
    config: LLMConfig,
    messages: OpenRouterMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const startTime = performance.now();
    let timeToFirstToken = 0;
    let firstToken = true;

    // 合并 signal 和超时
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, config.streamTimeout);

    // 链路 AbortSignal
    const combinedSignal = this.combineAbortSignals(
      ...[signal, timeoutController.signal].filter(Boolean) as AbortSignal[]
    );

    try {
      const url = this.buildUrl('/chat/completions', config.model);
      const body = this.buildRequestBody(config, messages, true);

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw OpenRouterError.fromHttpStatus(response.status, errorBody);
      }

      if (!response.body) {
        throw new OpenRouterError(
          OpenRouterErrorType.STREAM_ERROR,
          '响应体为空，无法进行流式读取',
          undefined,
          true
        );
      }

      // 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // 按行解析 SSE
          const lines = buffer.split('\n');
          // 保留可能不完整的最后一行
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) {
              // 空行或 SSE 注释
              continue;
            }

            if (trimmed === 'data: [DONE]') {
              // 流结束标记
              continue;
            }

            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (delta) {
                  if (firstToken) {
                    timeToFirstToken = performance.now() - startTime;
                    firstToken = false;
                  }
                  accumulatedText += delta;
                  onChunk(delta);
                }
              } catch {
                // 跳过无法解析的行
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 流式完成
      const latency = performance.now() - startTime;

      return {
        id: `stream-${Date.now()}`,
        model: config.model,
        content: accumulatedText,
        usage: this.estimateUsage(messages, accumulatedText),
        latency,
        timeToFirstToken,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof OpenRouterError && error.type === OpenRouterErrorType.CANCELLED) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new OpenRouterError(
          OpenRouterErrorType.TIMEOUT,
          `请求超时（${config.streamTimeout / 1000}秒）`,
          undefined,
          true
        );
      }

      // 流式中断 → fallback 到非流式
      if (error instanceof OpenRouterError && error.retryable) {
        return this.sendChatCompletion(config, messages, signal);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 验证 API Key 是否有效。
   * 发送一个最小请求（1 token max）来检测。
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(this.buildUrl('/models'), {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async fetchAvailableModels(): Promise<Array<{ id: string; name: string }>> {
    const response = await fetch(this.buildUrl('/models'), {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      throw OpenRouterError.fromHttpStatus(response.status, await response.text().catch(() => ''));
    }

    const data = await response.json();
    const models = (data as { data?: Array<{ id: string; name: string }> }).data ?? [];
    return models;
  }

  /**
   * 更新 API Key
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private async doNonStreamingRequest(
    config: LLMConfig,
    messages: OpenRouterMessage[],
    signal: AbortSignal | undefined,
    startTime: number
  ): Promise<LLMResponse> {
    const url = this.buildUrl('/chat/completions');
    const body = this.buildRequestBody(config, messages, false);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw OpenRouterError.fromHttpStatus(response.status, errorBody);
    }

    const data = await response.json();
    const completion = data as NonStreamingResponse;

    const latency = performance.now() - startTime;
    const content = completion.choices?.[0]?.message?.content ?? '';

    return {
      id: completion.id ?? `resp-${Date.now()}`,
      model: completion.model ?? config.model,
      content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
      latency,
      timeToFirstToken: latency,
    };
  }

  private buildUrl(path: string, model?: string): string {
    const customBase = this.customProxyUrl || this.baseUrl;
    // DeepSeek 直连模型用 DeepSeek endpoint
    const base = model ? getBaseUrlForModel(model) : customBase;
    return `${base}${path}`;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...(this.httpReferer ? { 'HTTP-Referer': this.httpReferer } : {}),
      ...(this.appTitle ? { 'X-Title': this.appTitle } : {}),
    };
  }

  private buildRequestBody(
    config: LLMConfig,
    messages: OpenRouterMessage[],
    stream: boolean
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      stream,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    };

    // OpenRouter 特有参数
    if (config.model.startsWith('anthropic/')) {
      // Claude 不支持 temperature > 1
      body.temperature = Math.min(config.temperature, 1.0);
    }

    return body;
  }

  private combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
    if (signals.length === 0) {
      return new AbortController().signal;
    }
    if (signals.length === 1) {
      return signals[0]!;
    }

    const controller = new AbortController();
    const onAbort = () => {
      controller.abort();
      for (const sig of signals) {
        sig.removeEventListener('abort', onAbort);
      }
    };

    for (const sig of signals) {
      if (sig.aborted) {
        controller.abort();
        return controller.signal;
      }
      sig.addEventListener('abort', onAbort);
    }

    return controller.signal;
  }

  /**
   * 估算 token 用量（当 API 不返回 usage 时）。
   */
  private estimateUsage(messages: OpenRouterMessage[], responseText: string): LLMUsage {
    let promptChars = 0;
    for (const msg of messages) {
      promptChars += msg.content.length;
    }
    return {
      promptTokens: Math.ceil(promptChars / 4),
      completionTokens: Math.ceil(responseText.length / 4),
      totalTokens: Math.ceil((promptChars + responseText.length) / 4),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================
// API Key 存储工具函数
// ============================================================

const API_KEY_STORAGE_KEY = 'ai-narrator-openrouter-api-key';

/** 获取本地存储的 API Key */
export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 存储 API Key 到 localStorage */
export function storeApiKey(key: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch (error) {
    console.error('[OpenRouter] Failed to store API key:', error);
  }
}

/** 删除本地存储的 API Key */
export function removeStoredApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 检查是否有存储的 API Key */
export function hasStoredApiKey(): boolean {
  return getStoredApiKey() !== null;
}

/**
 * 验证 API Key 是否有效（独立函数，不需要客户端实例）。
 * 发送一个最小请求来检测。
 */
export async function validateApiKey(apiKey?: string): Promise<{ valid: boolean; error?: string }> {
  const key = apiKey || getStoredApiKey();
  if (!key) {
    return { valid: false, error: 'No API key provided' };
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'API Key 无效或已过期' };
    }

    return { valid: false, error: `服务器错误 (${response.status})` };
  } catch (error) {
    return {
      valid: false,
      error: `网络错误: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

// ============================================================
// 独立聊天补全函数 — 供设置/AI生成等场景使用
// ============================================================

/** 简化的 OpenRouter 配置（独立函数使用） */
export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/** 补全选项 */
export interface CompletionOptions {
  temperature: number;
  maxTokens: number;
  jsonMode?: boolean;
}

/** 补全响应 */
export interface CompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * 非流式聊天补全（独立函数，不需要客户端实例）。
 * 用于 AI 设定生成等一次性请求场景。
 */
export async function completeChat(
  config: OpenRouterConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: CompletionOptions
): Promise<CompletionResponse> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: false,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${getBaseUrlForModel(config.model)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw OpenRouterError.fromHttpStatus(response.status, errorBody);
  }

  return response.json() as Promise<CompletionResponse>;
}

// ============================================================
// API 响应类型（内部）
// ============================================================

interface NonStreamingResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}
