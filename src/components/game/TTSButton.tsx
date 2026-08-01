/**
 * v4.1.0 TTS 语音旁白组件 — 基于 acto 的 TTS 理念
 * 利用浏览器内置 Web Speech API，朗读 AI 生成的叙述文本。
 * 低改动成本，无需第三方 API Key。
 * @module components/game/TTSButton
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface TTSButtonProps {
  /** 要朗读的文本内容 */
  text: string;
  /** 按钮尺寸 */
  size?: 'sm' | 'md';
  /** 语音语言（默认中文） */
  lang?: string;
  /** 语速 0.1-2.0 */
  rate?: number;
  /** 音调 0-2 */
  pitch?: number;
}

export function TTSButton({
  text,
  size = 'sm',
  lang = 'zh-CN',
  rate = 1.0,
  pitch = 1.0,
}: TTSButtonProps): React.ReactElement {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
      setSupported(true);
      return () => {
        window.speechSynthesis.cancel();
      };
    }
    return;
  }, []);

  const handleSpeak = useCallback(() => {
    if (!synthRef.current || !text) return;

    // 如果正在说话，停止
    if (speaking) {
      synthRef.current.cancel();
      setSpeaking(false);
      return;
    }

    // 清理文本（去掉 emoji 和特殊标记）
    const cleanText = text
      .replace(/---[A-Z]+---/g, '')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{200D}]/gu, '')
      .replace(/\{.*?\}/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synthRef.current.speak(utterance);
  }, [text, speaking, lang, rate, pitch]);

  if (!supported) return <span />;

  const isSm = size === 'sm';
  return (
    <button
      type="button"
      onClick={handleSpeak}
      title={speaking ? '停止朗读' : '朗读文本'}
      style={{
        background: speaking ? 'rgba(123,111,223,0.15)' : 'transparent',
        border: `1px solid ${speaking ? 'rgba(123,111,223,0.4)' : 'rgba(201,169,78,0.15)'}`,
        borderRadius: 4,
        color: speaking ? '#7B6FDF' : '#6B6258',
        cursor: 'pointer',
        padding: isSm ? '1px 6px' : '2px 8px',
        fontSize: isSm ? '0.6875rem' : '0.75rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        flexShrink: 0,
      }}
    >
      {speaking ? '⏹' : '🔊'}
    </button>
  );
}

export default TTSButton;
