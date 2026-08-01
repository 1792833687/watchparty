/**
 * DialoguePanel — 对话面板 — Story 5.2
 *
 * @description
 * AI叙述气泡（左边框accent-magic 3px）
 * 玩家消息气泡（右对齐，bg-input）
 * 建议动作卡片（水平排列，可点击）
 * 输入区：Textarea + 发送按钮(Ctrl+Enter)
 * 流式输出：打字机效果（默认关闭，有开关）
 * AI思考中：skeleton wave动画
 * 自动滚动到底
 * 空状态：AI GM欢迎语
 *
 * @see design/art-bible.md §6, §8
 * @see design/ux-spec.md §6.2 (对话交互)
 * @see design/accessibility-requirements.md §2.3 (屏幕阅读器)
 */

'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useDialogueStore } from '@/stores/dialogue-store';
import { useUIStore } from '@/stores/ui-store';
import { AIAvatar } from '@/components/common/AIAvatar';
import type { DialogueMessage } from '@/stores/dialogue-store';

// ============================================================
// 类型
// ============================================================

export interface DialoguePanelProps {
  /** 测试用的决策触发回调 */
  onTriggerDecision?: () => void;
}

// ============================================================
// Skeleton Wave
// ============================================================

const SkeletonWave: React.FC = () => (
  <div
    className="dialogue-skeleton"
    aria-label="AI 思考中"
    role="status"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '16px 0',
    }}
  >
    <div
      style={{
        height: 14,
        width: '80%',
        background: 'var(--bg-input)',
        borderRadius: 4,
        animation: 'skeleton-wave 1.5s ease-in-out infinite',
      }}
    />
    <div
      style={{
        height: 14,
        width: '60%',
        background: 'var(--bg-input)',
        borderRadius: 4,
        animation: 'skeleton-wave 1.5s ease-in-out infinite',
        animationDelay: '0.2s',
      }}
    />
    <div
      style={{
        height: 14,
        width: '70%',
        background: 'var(--bg-input)',
        borderRadius: 4,
        animation: 'skeleton-wave 1.5s ease-in-out infinite',
        animationDelay: '0.4s',
      }}
    />
  </div>
);

// ============================================================
// 消息气泡
// ============================================================

const MessageBubble: React.FC<{ message: DialogueMessage }> = ({ message }) => {
  const isAI = message.role === 'ai_gm';
  const isPlayer = message.role === 'player';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div
        className="dialogue-message dialogue-message--system"
        style={{
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
        }}
      >
        {message.content}
      </div>
    );
  }

  return (
    <div
      className={`dialogue-message dialogue-message--${message.role}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isPlayer ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        paddingLeft: isPlayer ? 48 : 0,
        paddingRight: isPlayer ? 0 : 48,
      }}
    >
      {/* AI 头像 + 名称 */}
      {isAI && (
        <div style={{ marginBottom: 6 }}>
          <AIAvatar
            level={2}
            state="speaking"
            name={message.speakerName}
            size={28}
          />
        </div>
      )}

      {/* 气泡 */}
      <div
        className={`dialogue-bubble dialogue-bubble--${message.role}`}
        style={{
          maxWidth: 'var(--narrative-max-width)',
          padding: '12px 16px',
          borderRadius: 12,
          borderTopLeftRadius: isAI ? 4 : 12,
          borderTopRightRadius: isPlayer ? 4 : 12,
          background: isPlayer
            ? 'var(--bg-input)'
            : 'var(--bg-panel-raised)',
          borderLeft: isAI
            ? `3px solid ${
                message.sceneType === 'danger'
                  ? 'var(--accent-danger)'
                  : message.sceneType === 'magic'
                  ? 'var(--accent-magic)'
                  : 'var(--accent-magic)'
              }`
            : 'none',
          fontSize: 'var(--text-narrative-size, 1.0625rem)',
          lineHeight: 1.75,
          color: isAI ? 'var(--text-narrative)' : 'var(--text-primary)',
          fontFamily: isAI ? 'var(--font-narrative)' : 'var(--font-ui)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {message.content}
      </div>

      {/* 时间 */}
      <span
        style={{
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          marginTop: 4,
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
};

// ============================================================
// 建议动作卡片
// ============================================================

const SuggestionCards: React.FC<{
  suggestions: Array<{ id: string; text: string; icon?: string }>;
  onSelect: (actionId: string) => void;
}> = ({ suggestions, onSelect }) => {
  if (suggestions.length === 0) return null;

  return (
    <div
      className="dialogue-suggestions"
      role="listbox"
      aria-label="建议动作"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
        padding: '0 16px',
      }}
    >
      {suggestions.map((action, i) => (
        <button
          key={action.id}
          role="option"
          aria-selected={false}
          onClick={() => onSelect(action.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
            animation: `suggestion-slide-in 200ms ease-out ${i * 50}ms both`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-gold)';
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-panel)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span aria-hidden="true">{action.icon ?? '💡'}</span>
          {action.text}
        </button>
      ))}
    </div>
  );
};

// ============================================================
// 输入区域
// ============================================================

const InputArea: React.FC<{
  disabled: boolean;
  onSend: (text: string) => void;
}> = ({ disabled, onSend }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦输入框
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // 全局 `/` 键聚焦
  useEffect(() => {
    const handleGlobalKey = (e: globalThis.KeyboardEvent) => {
      if (
        e.key === '/' &&
        !disabled &&
        document.activeElement !== textareaRef.current &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [disabled]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div
      className="dialogue-input-area"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-panel)',
      }}
    >
      <textarea
        ref={textareaRef}
        id="player-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'AI GM 正在回应…' : '输入你想做什么… (Ctrl+Enter 发送)'}
        rows={2}
        aria-label="输入行动描述"
        style={{
          flex: 1,
          resize: 'none',
          padding: '10px 14px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontSize: '0.9375rem',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1.5,
          outline: 'none',
          transition: 'border-color 150ms ease',
          minHeight: 44,
          maxHeight: 120,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-gold)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        aria-label="发送消息"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          background:
            disabled || !text.trim()
              ? 'var(--bg-input)'
              : 'var(--accent-magic)',
          border: 'none',
          borderRadius: 10,
          color:
            disabled || !text.trim()
              ? 'var(--text-muted)'
              : '#FFFFFF',
          cursor: disabled || !text.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 150ms ease, transform 150ms ease',
          flexShrink: 0,
        }}
      >
        {disabled ? (
          <Sparkles size={18} style={{ animation: 'ai-dot-pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <Send size={18} />
        )}
      </button>
    </div>
  );
};

// ============================================================
// DialoguePanel 组件
// ============================================================

export const DialoguePanel: React.FC<DialoguePanelProps> = ({
  onTriggerDecision,
}) => {
  const messages = useDialogueStore((s) => s.messages);
  const isStreaming = useDialogueStore((s) => s.isStreaming);
  const streamedText = useDialogueStore((s) => s.streamedText);
  const currentSuggestions = useDialogueStore((s) => s.currentSuggestions);
  const sendMessage = useDialogueStore((s) => s.sendMessage);
  const executeSuggestion = useDialogueStore((s) => s.executeSuggestion);
  const typingEffectEnabled = useUIStore((s) => s.typingEffectEnabled);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // 自动滚动到底
  useEffect(() => {
    if (shouldAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamedText, shouldAutoScroll]);

  // 检测用户手动滚动
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // 如果距离底部超过 60px，停止自动滚动
    setShouldAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage({ type: 'free_text', text });
    },
    [sendMessage]
  );

  const handleSuggestionClick = useCallback(
    (actionId: string) => {
      executeSuggestion(actionId);
    },
    [executeSuggestion]
  );

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div
      className="dialogue-panel"
      id="dialogue-panel"
      role="region"
      aria-label="对话面板"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--panel-radius)',
        overflow: 'hidden',
      }}
    >
      {/* ── 消息列表 ── */}
      <div
        ref={scrollRef}
        className="dialogue-messages"
        onScroll={handleScroll}
        aria-live="polite"
        aria-label="对话历史"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          scrollBehavior: 'smooth',
        }}
      >
        {/* 空状态 */}
        {isEmpty && (
          <div
            className="dialogue-empty"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              gap: 16,
              padding: '40px 20px',
            }}
          >
            <Sparkles
              size={48}
              color="var(--accent-magic)"
              style={{ opacity: 0.6 }}
            />
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              AI GM 已就绪
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                maxWidth: 400,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              点击地图探索世界，或在此输入你想做的事情。
              AI 主持人将引导你的冒险故事。
            </p>
            {/* 测试按钮 */}
            {onTriggerDecision && (
              <button
                onClick={onTriggerDecision}
                style={{
                  marginTop: 12,
                  padding: '8px 20px',
                  background: 'var(--accent-gold)',
                  color: 'var(--bg-deep)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                测试: 触发抉择
              </button>
            )}
          </div>
        )}

        {/* 消息列表 */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* 流式输出 */}
        {isStreaming && streamedText && (
          <div
            className="dialogue-message dialogue-message--streaming"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginBottom: 12,
              paddingRight: 48,
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <AIAvatar
                level={2}
                state="speaking"
                name="AI GM"
                size={28}
              />
            </div>
            <div
              style={{
                maxWidth: 'var(--narrative-max-width)',
                padding: '12px 16px',
                borderRadius: 12,
                borderTopLeftRadius: 4,
                background: 'var(--bg-panel-raised)',
                borderLeft: '3px solid var(--accent-magic)',
                fontSize: '1.0625rem',
                lineHeight: 1.75,
                color: 'var(--text-narrative)',
                fontFamily: 'var(--font-narrative)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {typingEffectEnabled ? streamedText : streamedText}
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  background: 'var(--accent-magic-glow)',
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'cursor-blink 1s step-end infinite',
                }}
              />
            </div>
          </div>
        )}

        {/* Skeleton loading */}
        {isStreaming && !streamedText && <SkeletonWave />}
      </div>

      {/* ── 建议动作 ── */}
      {currentSuggestions.length > 0 && !isStreaming && (
        <SuggestionCards
          suggestions={currentSuggestions}
          onSelect={handleSuggestionClick}
        />
      )}

      {/* ── 输入区 ── */}
      <InputArea disabled={isStreaming} onSend={handleSend} />
    </div>
  );
};
