/**
 * sse-stream.ts — AI Narrator Game
 *
 * SSE (Server-Sent Events) 流式输出工具。
 * 将 DeepSeek API 的 stream 响应解析为 ReadableStream，
 * 支持逐 token 回调，实现打字机效果。
 *
 * @module lib/utils/sse-stream
 */

// ============================================================
// Types
// ============================================================

export interface StreamConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamCallbacks {
  /** 每收到一个 token 时触发 */
  onToken: (token: string) => void;
  /** 流结束 */
  onComplete: (fullContent: string) => void;
  /** 流错误 */
  onError: (error: Error) => void;
}

// ============================================================
// SSE 解析器
// ============================================================

/**
 * 解析 SSE 数据行，提取 delta content。
 * DeepSeek API 格式: data: {"choices":[{"delta":{"content":"xxx"}}]}
 */
function parseSSELine(line: string): string | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice(6).trim();
  if (data === '[DONE]') return null;

  try {
    const parsed = JSON.parse(data);
    const delta = parsed?.choices?.[0]?.delta?.content;
    return typeof delta === 'string' ? delta : null;
  } catch {
    return null;
  }
}

// ============================================================
// 流式请求
// ============================================================

/**
 * 发起 SSE 流式请求并逐步回调。
 *
 * @param config - 请求配置
 * @param callbacks - 回调函数
 * @param signal - AbortSignal（可选，用于取消请求）
 */
export async function streamChat(
  config: StreamConfig,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const { endpoint, apiKey, model, messages, maxTokens = 2048, temperature = 0.8 } = config;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查设置。');
      }
      if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后重试。');
      }
      throw new Error(`API 错误 (${response.status}): ${errText.slice(0, 100)}`);
    }

    if (!response.body) {
      throw new Error('响应体为空，不支持流式输出。');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 最后一行可能不完整，保留到下次
      buffer = lines.pop() || '';

      for (const line of lines) {
        const token = parseSSELine(line);
        if (token) {
          fullContent += token;
          callbacks.onToken(token);
        }
      }
    }

    // 处理残留 buffer
    if (buffer.trim()) {
      const token = parseSSELine(buffer);
      if (token) {
        fullContent += token;
        callbacks.onToken(token);
      }
    }

    callbacks.onComplete(fullContent);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      // 用户取消，不报错
      return;
    }
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * 非流式请求（兼容降级方案）。
 * 当 SSE 不可用时自动降级为普通请求。
 */
export async function fetchChat(
  config: StreamConfig,
  signal?: AbortSignal
): Promise<string> {
  const { endpoint, apiKey, model, messages, maxTokens = 2048, temperature = 0.8 } = config;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: maxTokens,
      temperature,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('API Key 无效，请检查设置。');
    }
    if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后重试。');
    }
    throw new Error(`API 错误 (${response.status}): ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '(AI 返回了空内容)';
}
