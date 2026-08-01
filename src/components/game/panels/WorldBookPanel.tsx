/**
 * v4.1.0 世界书面板（查看 + 编辑）
 * 章节树展示权威设定；支持编辑条目内容、新增条目、重置默认。
 * @module components/game/panels/WorldBookPanel
 */
'use client';

import React, { useMemo, useState } from 'react';
import { C } from '@/theme/tokens';
import {
  groupBySection, resetWorldBook, saveWorldBook,
  type WorldBookEntry,
} from '@/systems/worldbook/worldbook-system';

export interface WorldBookPanelProps {
  entries: WorldBookEntry[];
  onChange: (entries: WorldBookEntry[]) => void;
}

const GOLD = C.gold;
const TEXT = C.text;
const DIM = C.textDim;
const MUTED = C.textMuted;
const PANEL = C.bgCard;
const DEEP = C.bgPanel;
const PURPLE = C.magic;
const OK = C.ok;
const DANGER = C.darkAccent;

const SECTIONS = ['世界观', '设定', '人物', '规则'];

export function WorldBookPanel({ entries, onChange }: WorldBookPanelProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [filter, setFilter] = useState<string>('全部');

  const groups = useMemo(() => groupBySection(entries), [entries]);
  const filtered = useMemo(() => {
    if (filter === '全部') return groups;
    return groups.filter((g) => g.section === filter);
  }, [groups, filter]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const startEdit = (entry: WorldBookEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditTitle(entry.title);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const next = entries.map((e) =>
      e.id === editingId ? { ...e, title: editTitle.trim() || e.title, content: editContent } : e
    );
    onChange(next);
    saveWorldBook(next);
    setEditingId(null);
  };

  const addEntry = (section: string) => {
    const id = `wb-custom-${Date.now()}`;
    const next: WorldBookEntry[] = [...entries, {
      id, section, title: '新条目', content: '（在此输入设定内容…）', order: 90,
    }];
    onChange(next);
    saveWorldBook(next);
    setSelectedId(id);
    setEditingId(id);
    setEditTitle('新条目');
    setEditContent('（在此输入设定内容…）');
  };

  const removeEntry = (id: string) => {
    const target = entries.find((e) => e.id === id);
    if (!target || target.locked) return;
    const next = entries.filter((e) => e.id !== id);
    onChange(next);
    saveWorldBook(next);
    if (selectedId === id) { setSelectedId(null); setEditingId(null); }
  };

  const toggleEnabled = (id: string) => {
    const next = entries.map((e) =>
      e.id === id ? { ...e, enabled: e.enabled === false } : e
    );
    onChange(next);
    saveWorldBook(next);
  };

  const handleReset = () => {
    if (!window.confirm('确定重置世界书为默认设定？你的自定义条目将被移除。')) return;
    const next = resetWorldBook();
    onChange(next);
    setSelectedId(null);
    setEditingId(null);
  };

  return (
    <div style={{
      padding: '1.25rem', color: TEXT, fontFamily: 'system-ui, sans-serif',
      height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      <h3 style={{
        textAlign: 'center', fontSize: '1.375rem', fontWeight: 700, color: GOLD,
        marginBottom: '0.25rem', paddingBottom: '0.625rem', borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        📖 世界书
      </h3>
      <p style={{
        textAlign: 'center', fontSize: '0.6875rem', color: MUTED, margin: '0 0 0.75rem',
      }}>
        权威设定源 · AI 叙事严格遵循 · 可在游戏中编辑设定
      </p>

      {/* 章节筛选 */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {['全部', ...SECTIONS].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            style={{
              padding: '0.1875rem 0.625rem', borderRadius: 999, fontSize: '0.6875rem',
              border: `1px solid ${filter === s ? GOLD : 'rgba(201,169,78,0.2)'}`,
              background: filter === s ? 'rgba(201,169,78,0.15)' : 'transparent',
              color: filter === s ? GOLD : DIM, cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          onClick={handleReset}
          style={{
            marginLeft: 'auto', padding: '0.1875rem 0.625rem', borderRadius: 999, fontSize: '0.6875rem',
            border: '1px solid rgba(229,62,62,0.3)', background: 'transparent',
            color: DANGER, cursor: 'pointer',
          }}
        >
          ↺ 重置默认
        </button>
      </div>

      {/* 条目列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {filtered.map((g) => (
          <div key={g.section}>
            <div style={{
              fontSize: '0.75rem', fontWeight: 700, color: '#D4A574',
              margin: '0.375rem 0 0.25rem', display: 'flex', alignItems: 'center',
            }}>
              {g.section}
              <button
                type="button"
                onClick={() => addEntry(g.section)}
                title={`在「${g.section}」新增条目`}
                style={{
                  marginLeft: '0.5rem', fontSize: '0.625rem', padding: '0 5px', borderRadius: 4,
                  border: '1px solid ' + GOLD + '55', background: 'transparent',
                  color: GOLD, cursor: 'pointer', lineHeight: 1.4,
                }}
              >
                + 新增
              </button>
            </div>
            {g.entries.map((e) => {
              const active = selectedId === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => { setSelectedId(active ? null : e.id); setEditingId(null); }}
                  style={{
                    padding: '0.5rem 0.625rem', borderRadius: 8, cursor: 'pointer', marginBottom: '0.25rem',
                    background: active ? 'rgba(201,169,78,0.1)' : PANEL,
                    border: `1px solid ${active ? 'rgba(201,169,78,0.4)' : 'rgba(201,169,78,0.12)'}`,
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                  }}
                >
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: active ? GOLD : TEXT, flex: 1 }}>
                    {e.title}
                  </span>
                  {e.enabled === false && (
                    <span style={{ fontSize: '0.5625rem', color: MUTED, border: '1px solid ' + MUTED + '55', borderRadius: 4, padding: '0 4px' }}>停用</span>
                  )}
                  {e.locked && (
                    <span style={{ fontSize: '0.5625rem', color: MUTED }}>🔒</span>
                  )}
                  <span style={{
                    fontSize: '0.6875rem', color: DIM,
                    maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {e.content.split('\n')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 详情 / 编辑区 */}
      {editingId && (() => {
        const editing = entries.find((e) => e.id === editingId);
        if (!editing) return null;
        return (
          <div style={{
            marginTop: '0.75rem', padding: '0.875rem', borderRadius: 10,
            background: DEEP, border: '1px solid ' + GOLD + '44',
          }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: GOLD, marginBottom: '0.5rem' }}>
              ✏️ 编辑条目
            </div>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="条目标题"
              maxLength={40}
              style={{
                width: '100%', padding: '0.375rem 0.625rem', borderRadius: 6, boxSizing: 'border-box',
                border: '1px solid rgba(201,169,78,0.25)', background: PANEL, color: TEXT,
                fontSize: '0.8125rem', marginBottom: '0.5rem', outline: 'none',
              }}
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="在此输入设定内容…（多行文本）"
              rows={6}
              style={{
                width: '100%', padding: '0.5rem 0.625rem', borderRadius: 6, boxSizing: 'border-box',
                border: '1px solid rgba(201,169,78,0.25)', background: PANEL, color: TEXT,
                fontSize: '0.8125rem', lineHeight: 1.6, outline: 'none', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem' }}>
              <button
                type="button"
                onClick={saveEdit}
                style={{
                  flex: 1, padding: '0.375rem', borderRadius: 6,
                  border: '1px solid ' + OK, background: 'rgba(90,158,111,0.15)',
                  color: OK, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                ✓ 保存
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                style={{
                  padding: '0.375rem 0.875rem', borderRadius: 6,
                  border: '1px solid rgba(160,152,136,0.4)', background: 'transparent',
                  color: DIM, fontSize: '0.75rem', cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>
        );
      })()}

      {/* 详情区 */}
      {selected && !editingId && (
        <div style={{
          marginTop: '0.75rem', padding: '0.875rem', borderRadius: 10,
          background: DEEP, border: '1px solid rgba(201,169,78,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: GOLD }}>{selected.title}</span>
            <span style={{ fontSize: '0.625rem', color: MUTED }}>{selected.section}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => toggleEnabled(selected.id)}
                title={selected.enabled === false ? '启用该条目' : '停用该条目（不注入 AI）'}
                style={{
                  fontSize: '0.625rem', padding: '1px 6px', borderRadius: 4,
                  border: `1px solid ${selected.enabled === false ? MUTED : OK}66`,
                  background: 'transparent', color: selected.enabled === false ? MUTED : OK,
                  cursor: 'pointer',
                }}
              >
                {selected.enabled === false ? '▶ 启用' : '⏸ 停用'}
              </button>
              <button
                type="button"
                onClick={() => startEdit(selected)}
                style={{
                  fontSize: '0.625rem', padding: '1px 6px', borderRadius: 4,
                  border: '1px solid ' + PURPLE + '66', background: 'transparent',
                  color: PURPLE, cursor: 'pointer',
                }}
              >
                ✏️ 编辑
              </button>
              {!selected.locked && (
                <button
                  type="button"
                  onClick={() => removeEntry(selected.id)}
                  style={{
                    fontSize: '0.625rem', padding: '1px 6px', borderRadius: 4,
                    border: '1px solid rgba(229,62,62,0.4)', background: 'transparent',
                    color: DANGER, cursor: 'pointer',
                  }}
                >
                  🗑 删除
                </button>
              )}
            </span>
          </div>
          <div style={{
            fontSize: '0.75rem', lineHeight: 1.7, color: '#C8BFB0',
            whiteSpace: 'pre-line', maxHeight: '30vh', overflowY: 'auto',
          }}>
            {selected.content}
          </div>
        </div>
      )}

      {/* 提示 */}
      <div style={{
        marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.625rem', color: MUTED, textAlign: 'center',
      }}>
        💡 世界书内容会注入 AI 系统提示作为权威设定，编辑后即时生效（默认条目锁定不可删除）
      </div>
    </div>
  );
}

export default WorldBookPanel;
