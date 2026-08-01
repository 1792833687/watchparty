'use client';

/**
 * NarratorIntro — AI Narrator Game v1.1.0
 *
 * World introduction narration: displays stylized narrative text
 * for the game world, generated from the worldMeta in the game setting.
 * v1.1.0: narration content varies by world preset (not single template).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================
// Types
// ============================================================

export interface NarratorIntroProps {
  /** World metadata for generating contextual narration */
  worldName: string;
  worldGenre: string;
  worldTone: string;
  worldDescription: string;
  /** Optional: pre-existing opening narrative from game setting */
  startingNarrative?: string;
  /** Called when narration animation is complete and user clicks continue */
  onContinue: () => void;
  /** If true, generate narration via AI; if false, use startingNarrative directly */
  generateWithAI?: boolean;
  /** API config for AI generation */
  apiConfig?: NarratorApiConfig;
}

export interface NarratorApiConfig {
  /** OpenRouter or DeepSeek API key */
  apiKey: string;
  /** Model ID */
  model: string;
  /** API endpoint override (from custom config) */
  endpoint?: string;
}

// ============================================================
// AI Prompt
// ============================================================

const NARRATOR_PROMPT = (worldName: string, genre: string, tone: string, description: string) =>
  `你是一位出色的叙事者。请为以下游戏世界创作一段开场叙事：

世界名称：${worldName}
类型：${genre}
基调：${tone}
世界描述：${description}

要求：
1. 用第二人称"你"称呼玩家，营造沉浸感
2. 描述世界观背景（1-2句概括）
3. 然后展开开场叙事——玩家当前所处的场景、氛围、感官细节
4. 结尾留下悬念或行动提示，引导玩家探索
5. 约200-300字
6. 使用富有文学性的中文，与"${tone}"的基调相符
7. 不要添加任何选项列表，纯粹是叙事段落`;

// ============================================================
// Component
// ============================================================

export function NarratorIntro({
  worldName,
  worldGenre,
  worldTone,
  worldDescription,
  startingNarrative,
  onContinue,
  generateWithAI = false,
  apiConfig,
}: NarratorIntroProps): React.ReactElement {
  const [narrative, setNarrative] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [error, setError] = useState('');
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Generate or use pre-existing narrative ──
  useEffect(() => {
    // Use pre-existing narrative if available and not generating with AI
    if (!generateWithAI && startingNarrative) {
      // Simulate typing effect for pre-existing narrative
      startTypingEffect(startingNarrative);
      return;
    }

    // Use AI to generate the narrative
    if (generateWithAI && apiConfig?.apiKey) {
      generateNarrative();
    } else if (!startingNarrative && !generateWithAI) {
      // Fallback: build a narrative from world metadata
      const fallback = buildFallbackNarrative(worldName, worldGenre, worldTone, worldDescription);
      startTypingEffect(fallback);
    }

    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Typing effect ──
  const startTypingEffect = useCallback((fullText: string) => {
    setIsTyping(true);
    setNarrative('');
    setShowContinue(false);

    let index = 0;
    const charsPerTick = 3; // characters per interval for smooth speed
    const intervalMs = 40;

    typingTimerRef.current = setInterval(() => {
      index += charsPerTick;
      if (index >= fullText.length) {
        setNarrative(fullText);
        setIsTyping(false);
        setShowContinue(true);
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
      } else {
        setNarrative(fullText.slice(0, index));
      }
    }, intervalMs);
  }, []);

  // ── AI Generation ──
  const generateNarrative = useCallback(async () => {
    if (!apiConfig) return;

    setIsGenerating(true);
    setError('');

    try {
      const prompt = NARRATOR_PROMPT(worldName, worldGenre, worldTone, worldDescription);
      const endpoint = apiConfig.endpoint
        ? apiConfig.endpoint.replace(/\/+$/, '') + '/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`,
      };

      if (!apiConfig.endpoint) {
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : '';
        headers['X-Title'] = 'AI Narrator Game';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: apiConfig.endpoint ? 'deepseek-chat' : apiConfig.model,
          messages: [
            { role: 'user', content: prompt },
          ],
          stream: false,
          max_tokens: 800,
          temperature: 0.9,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`API 请求失败 (${response.status})`);
      }

      const data = await response.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';

      if (!content) {
        throw new Error('AI 未返回有效内容');
      }

      startTypingEffect(content.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      // Fallback to built-in narrative
      const fallback = buildFallbackNarrative(worldName, worldGenre, worldTone, worldDescription);
      startTypingEffect(fallback);
    } finally {
      setIsGenerating(false);
    }
  }, [apiConfig, worldName, worldGenre, worldTone, worldDescription, startTypingEffect]);

  // ── Skip typing ──
  const handleSkip = useCallback(() => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    // Need full narrative - if we started from fallback, we need to build it
    if (narrative.length > 0) {
      // We already have partial text; let's finish it
      const fullText = startingNarrative ||
        buildFallbackNarrative(worldName, worldGenre, worldTone, worldDescription);
      setNarrative(fullText);
    }
    setIsTyping(false);
    setShowContinue(true);
  }, [narrative.length, startingNarrative, worldName, worldGenre, worldTone, worldDescription]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
      }}
    >
      {/* World Title */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: 'var(--accent-gold)',
            margin: '0 0 0.25rem',
            letterSpacing: '0.05em',
          }}
        >
          {worldName}
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {worldGenre} · {worldTone}
        </p>
      </div>

      {/* Loading state */}
      {isGenerating && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div
            style={{
              display: 'inline-block',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--accent-gold)',
              animation: 'ai-dot-pulse 1s linear infinite',
              marginBottom: '1rem',
            }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            AI 正在编织这个世界的故事…
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 8,
            background: 'rgba(255,0,0,0.1)',
            color: 'var(--accent-danger)',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Narrative text */}
      {narrative && (
        <div
          style={{
            maxWidth: 680,
            width: '100%',
            padding: '1.5rem 2rem',
            borderLeft: '3px solid var(--accent-gold)',
            fontStyle: 'italic',
            textAlign: 'center',
            color: 'var(--text-primary)',
            fontSize: '1.0625rem',
            lineHeight: 2,
            letterSpacing: '0.02em',
          }}
        >
          {narrative}
          {isTyping && (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: '1.1em',
                background: 'var(--accent-gold)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'ai-dot-pulse 0.8s ease-in-out infinite',
              }}
            />
          )}
        </div>
      )}

      {/* Skip / Continue */}
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        {isTyping && (
          <button
            onClick={handleSkip}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            跳过动画
          </button>
        )}
        {showContinue && (
          <button
            onClick={onContinue}
            style={{
              padding: '0.75rem 2.5rem',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent-gold)',
              color: 'var(--bg-deep)',
              fontWeight: 700,
              fontSize: '1.0625rem',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)',
            }}
          >
            开始你的冒险
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Fallback narrative builder
// ============================================================

function buildFallbackNarrative(
  name: string,
  genre: string,
  tone: string,
  description: string
): string {
  const tonePrefix: Record<string, string> = {
    '史诗冒险': '传说在这片土地上',
    '黑暗压抑': '阴影笼罩着这个世界',
    '轻松幽默': '这可不是什么正经冒险故事',
    '神秘悬疑': '没有人知道真相',
  };

  const prefix = tonePrefix[tone] ?? '在这片土地上';

  return `${prefix}——${name}，一个属于${genre}的世界。\n\n${description}\n\n你站在命运的十字路口，前方是未知的旅途。古老的预言、沉睡的力量、以及那些被遗忘的誓言——一切都在等待你的到来。\n\n深吸一口气，冒险者。你的故事，从此刻开始。`;
}
