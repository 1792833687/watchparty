'use client';

import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import type { GameItem, ItemType } from './types';
import { findRecipe, isCraftable, CRAFT_CATEGORY_LABELS } from '@/systems/crafting/crafting-system';

export interface InventoryPanelProps {
  items: GameItem[];
  onUseItem?: (item: GameItem) => void;
  /** v4.1.0: 当前装备槽位（用于显示已装备标记） */
  equippedSlots?: Record<string, GameItem | null>;
  /** v4.1.0: 装备回调（weapon/armor/trinket） */
  onEquip?: (item: GameItem) => void;
  /** v4.1.0: 装备槽名称列表 */
  equipmentSlotNames?: string[];
  /** v4.2.0: 组合回调（两件物品 → 合成） */
  onCraft?: (itemA: GameItem, itemB: GameItem) => void;
}

const GRID_COLS = 4;
const TOTAL_SLOTS = 16;

const DEFAULT_ITEMS: GameItem[] = [
  { id: 'medkit', name: '急救包', emoji: '💊', type: 'consumable', description: '恢复20点生命值', effect: { hp: 20 }, quantity: 2 },
  { id: 'knife', name: '小刀', emoji: '🔪', type: 'weapon', description: '增加2点力量', effect: { attr: 'strength', value: 2 }, quantity: 1 },
  { id: 'rope', name: '绳索', emoji: '🪢', type: 'tool', description: '攀爬或捆绑用', quantity: 1 },
  { id: 'flask', name: '水壶', emoji: '🧴', type: 'consumable', description: '恢复10点魔力', effect: { mp: 10 }, quantity: 1 },
];

function buildSlots(items: GameItem[]): (GameItem | null)[] {
  const slots: (GameItem | null)[] = [...items];
  while (slots.length < TOTAL_SLOTS) {
    slots.push(null);
  }
  return slots;
}

function resolveItems(items: GameItem[]): GameItem[] {
  if (items.length > 0) return items;
  return DEFAULT_ITEMS;
}

const TYPE_LABELS: Record<ItemType, string> = {
  consumable: '消耗品',
  weapon: '武器',
  armor: '防具',
  tool: '工具',
  key: '关键物品',
  material: '材料',
  quest: '任务',
  treasure: '宝物',
  tome: '典籍',
  trinket: '饰品',
};

const TYPE_COLORS: Record<ItemType, string> = {
  consumable: '#7B6FDF',
  weapon: '#C9A94E',
  armor: '#5A9E6F',
  tool: '#6B8FA3',
  key: '#E53E3E',
  material: '#A07050',
  quest: '#5B8CBE',
  treasure: '#E8A840',
  tome: '#A864C0',
  trinket: '#C8966C',
};

// v2.0.0: Rarity colors for Frosthold setting
const RARITY_COLORS: Record<string, string> = {
  common: '#9E9E9E',
  uncommon: '#5A9E6F',
  rare: '#5B8CBE',
  epic: '#7B6FDF',
  legendary: '#C9A94E',
};

const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export function InventoryPanel({ items, onUseItem, equippedSlots, onEquip, equipmentSlotNames, onCraft }: InventoryPanelProps): React.ReactElement {
  const resolvedItems = resolveItems(items);
  const slots = buildSlots(resolvedItems);
  const usedCount = resolvedItems.length;

  // v4.2.0: 组合模式 — 选择两件物品触发合成
  const [craftMode, setCraftMode] = useState(false);
  const [craftPick, setCraftPick] = useState<GameItem | null>(null);

  // v4.1.0: 已装备物品 ID 集合（用于标记）
  const equippedIds = useMemo(() => {
    const s = new Set<string>();
    Object.values(equippedSlots ?? {}).forEach((i) => { if (i) s.add(i.id); });
    return s;
  }, [equippedSlots]);

  // Context menu state
  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [discardConfirmId, setDiscardConfirmId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setSelectedItem(null);
    setMenuPos(null);
    setDiscardConfirmId(null);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!menuPos) return;
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuPos, closeMenu]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuPos) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menuPos, closeMenu]);

  const handleItemClick = useCallback((item: GameItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // v4.2.0: 组合模式 — 点击物品作为第二件组合材料
    if (craftMode) {
      if (craftPick) {
        const match = findRecipe(craftPick, item);
        if (match) {
          onCraft?.(craftPick, item);
        }
        setCraftPick(null);
        setCraftMode(false);
      } else {
        setCraftPick(item);
      }
      closeMenu();
      return;
    }
    // Prevent re-opening if clicking same item
    if (selectedItem?.id === item.id && menuPos) {
      closeMenu();
      return;
    }
    const rect = (e.target as HTMLElement).closest('[data-item-slot]')?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ x: rect.right + 8, y: rect.top - 4 });
    } else {
      setMenuPos({ x: e.clientX + 8, y: e.clientY - 4 });
    }
    setSelectedItem(item);
    setDiscardConfirmId(null);
  }, [selectedItem, menuPos, closeMenu, craftMode, craftPick, onCraft]);

  const handleUse = useCallback((item: GameItem) => {
    setUsingId(item.id);
    if (onUseItem) {
      onUseItem(item);
    }
    // Brief feedback then close
    setTimeout(() => {
      setUsingId(null);
      closeMenu();
    }, 400);
  }, [onUseItem, closeMenu]);

  const handleDiscard = useCallback((item: GameItem) => {
    if (discardConfirmId === item.id) {
      setDiscarding(true);
      if (onUseItem) {
        // Use negative quantity to signal discard
        onUseItem({ ...item, quantity: -(item.quantity ?? 1) });
      }
      setTimeout(() => {
        setDiscarding(false);
        closeMenu();
      }, 500);
    } else {
      setDiscardConfirmId(item.id);
    }
  }, [discardConfirmId, onUseItem, closeMenu]);

  const isConsumable = (item: GameItem): boolean => item.type === 'consumable';
  const isEquippable = (item: GameItem): boolean => item.type === 'weapon' || item.type === 'armor' || item.type === 'trinket';
  /** v4.1.0: 装备目标槽位 */
  const equipSlotFor = (item: GameItem): string | null => {
    const map: Record<string, string> = { weapon: '主手', armor: '护甲', trinket: '饰品' };
    return item.type ? (map[item.type] ?? null) : null;
  };
  /** 背包中物品是否已装备在某个槽位 */
  const isItemEquipped = (itemId: string): boolean => equippedIds.has(itemId);

  return (
    <div style={{
      padding: '1.5rem 1.25rem',
      color: '#E8E0D5',
      fontFamily: 'system-ui, sans-serif',
      height: '100%',
      overflowY: 'auto',
    }}>
      <h3 style={{
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#C9A94E',
        marginBottom: '1.25rem',
        paddingBottom: '0.875rem',
        borderBottom: '1px solid rgba(201,169,78,0.3)',
      }}>
        🎒 背包
      </h3>

      <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <span style={{ fontSize: '1rem', color: '#A09888' }}>
          已用 {usedCount}/{TOTAL_SLOTS} 格
        </span>
        {/* v4.2.0: 组合模式开关 */}
        {onCraft && (
          <div style={{ marginTop: '0.5rem' }}>
            {craftMode ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.375rem 0.875rem', borderRadius: 999,
                background: 'rgba(123,111,223,0.15)', border: '1px solid #7B6FDF66',
                fontSize: '0.75rem', color: '#7B6FDF',
              }}>
                {craftPick
                  ? `已选「${craftPick.name}」，点击第二件物品合成`
                  : '点击第一件材料'}
                <button
                  type="button"
                  onClick={() => { setCraftMode(false); setCraftPick(null); }}
                  style={{
                    fontSize: '0.625rem', color: '#A09888', background: 'transparent',
                    border: 'none', cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setCraftMode(true); setCraftPick(null); closeMenu(); }}
                style={{
                  padding: '0.3125rem 0.875rem', borderRadius: 999,
                  border: '1px solid #7B6FDF66', background: 'transparent',
                  color: '#7B6FDF', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                🧬 组合物品
              </button>
            )}
          </div>
        )}
      </div>

      {usedCount === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          color: '#5A5248',
          fontSize: '0.9375rem',
        }}>
          背包空空如也。冒险中获取的物品将显示在这里。
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gap: '0.75rem',
          position: 'relative',
        }}>
          {slots.map((item, idx) => {
            if (item) {
              const isSelected = selectedItem?.id === item.id;
              const itemType = item.type ?? 'tool';
              const isCraftPick = craftMode && craftPick?.id === item.id;
              const craftable = craftMode && !craftPick && isCraftable(item);
              const craftResult = craftMode && craftPick ? findRecipe(craftPick, item) : null;

              return (
                <div
                  key={idx}
                  data-item-slot
                  data-item-id={item.id}
                  onClick={(e) => handleItemClick(item, e)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 10,
                    background: isCraftPick ? 'rgba(123,111,223,0.22)' : isSelected ? '#2A282F' : '#2A2522',
                    border: isCraftPick
                      ? '2px solid #7B6FDF'
                      : craftResult
                        ? '2px solid #5A9E6F'
                        : isSelected
                          ? `2px solid ${TYPE_COLORS[itemType]}`
                          : `1px solid rgba(${itemType === 'consumable' ? '123,111,223' : '201,169,78'}, 0.25)`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    boxShadow: isCraftPick || craftResult
                      ? '0 0 14px rgba(123,111,223,0.4)'
                      : isSelected
                        ? `0 0 12px rgba(${itemType === 'consumable' ? '123,111,223' : '201,169,78'}, 0.3)`
                        : '0 2px 8px rgba(0,0,0,0.35)',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    outline: craftable ? '1px dashed #7B6FDF66' : 'none',
                    outlineOffset: 2,
                  }}
                >
                  <span style={{ fontSize: '2rem', lineHeight: 1 }}>{item.emoji}</span>
                  <span style={{
                    fontSize: '0.8125rem',
                    color: '#E8E0D5',
                    marginTop: '0.375rem',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    fontWeight: 500,
                  }}>
                    {item.name}
                  </span>
                  {craftResult && (
                    <span style={{
                      position: 'absolute', top: 2, left: 2,
                      fontSize: '0.5625rem', fontWeight: 700, color: '#0A0A0F',
                      background: '#5A9E6F', borderRadius: 4, padding: '1px 4px',
                    }}>
                      +{craftResult.recipe.result.name}
                    </span>
                  )}
                  {item.quantity !== undefined && item.quantity > 1 && (
                    <span style={{
                      position: 'absolute',
                      top: 4,
                      right: 6,
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#E8E0D5',
                      background: 'rgba(0,0,0,0.6)',
                      borderRadius: 4,
                      padding: '1px 5px',
                    }}>
                      x{item.quantity}
                    </span>
                  )}
                  {/* v4.1.0: 已装备标记 */}
                  {isItemEquipped(item.id) && (
                    <span style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      color: '#0A0A0F',
                      background: '#C9A94E',
                      borderRadius: 4,
                      padding: '1px 5px',
                    }}>
                      ✔ 已装备
                    </span>
                  )}
                </div>
              );
            }
            return (
              <div key={idx} style={{
                aspectRatio: '1',
                borderRadius: 10,
                background: '#1E1B18',
                border: '1px dashed rgba(201,169,78,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1rem', color: '#5A5248' }}>空</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Context action menu */}
      {menuPos && selectedItem && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: Math.min(menuPos.x, window.innerWidth - 220),
            top: Math.min(menuPos.y, window.innerHeight - 280),
            zIndex: 200,
            background: '#1E1B18',
            border: '1px solid #C9A94E',
            borderRadius: 12,
            padding: '0.875rem',
            minWidth: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            opacity: 1,
            transform: 'scale(1)',
            transition: 'all 0.15s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Item info header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            marginBottom: '0.75rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid rgba(201,169,78,0.2)',
          }}>
            <span style={{ fontSize: '1.75rem' }}>{selectedItem.emoji}</span>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#E8E0D5' }}>
                {selectedItem.name}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: TYPE_COLORS[selectedItem.type ?? 'tool'] }}>
                  {TYPE_LABELS[selectedItem.type ?? 'tool']}
                </span>
                {(selectedItem as GameItem & { rarity?: string }).rarity && (
                  <span style={{
                    fontSize: '0.6875rem',
                    color: RARITY_COLORS[(selectedItem as GameItem & { rarity?: string }).rarity ?? 'common'] ?? '#9E9E9E',
                    background: `${RARITY_COLORS[(selectedItem as GameItem & { rarity?: string }).rarity ?? 'common'] ?? '#9E9E9E'}20`,
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}>
                    {RARITY_LABELS[(selectedItem as GameItem & { rarity?: string }).rarity ?? 'common']}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {selectedItem.description && (
            <div style={{
              fontSize: '0.8125rem',
              color: '#A09888',
              marginBottom: '0.75rem',
              lineHeight: 1.5,
            }}>
              {selectedItem.description}
            </div>
          )}

          {/* v4.1.0: 背景故事 lore */}
          {(selectedItem as GameItem & { lore?: string }).lore && (
            <div style={{
              fontSize: '0.75rem', color: '#8A80A8', fontStyle: 'italic',
              marginBottom: '0.75rem', lineHeight: 1.6,
              padding: '0.5rem 0.625rem', borderRadius: 6,
              background: 'rgba(123,111,223,0.06)', border: '1px dashed rgba(123,111,223,0.2)',
            }}>
              📜 {(selectedItem as GameItem & { lore?: string }).lore}
            </div>
          )}

          {/* v4.1.0: 装备数值 stats */}
          {(selectedItem as GameItem & { stats?: Record<string, number> }).stats && Object.keys((selectedItem as GameItem & { stats?: Record<string, number> }).stats ?? {}).length > 0 && (
            <div style={{
              fontSize: '0.75rem', marginBottom: '0.75rem',
              display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem',
            }}>
              {Object.entries((selectedItem as GameItem & { stats?: Record<string, number> }).stats ?? {}).map(([k, v]) => (
                <span key={k} style={{ color: '#C9A94E', background: 'rgba(201,169,78,0.08)', padding: '1px 6px', borderRadius: 4 }}>
                  {k} +{v}
                </span>
              ))}
            </div>
          )}

          {/* v4.1.0: 来源 sources */}
          {(selectedItem as GameItem & { sources?: string[] }).sources && (selectedItem as GameItem & { sources?: string[] }).sources!.length > 0 && (
            <div style={{
              fontSize: '0.6875rem', color: '#6B6258',
              marginBottom: '0.75rem', lineHeight: 1.5,
            }}>
              来源：{(selectedItem as GameItem & { sources?: string[] }).sources!.join(' · ')}
            </div>
          )}

          {/* Effect display */}
          {selectedItem.effect && (
            <div style={{
              fontSize: '0.8125rem',
              color: '#7B6FDF',
              marginBottom: '0.75rem',
              padding: '0.5rem',
              borderRadius: 6,
              background: 'rgba(123,111,223,0.1)',
            }}>
              {selectedItem.effect.hp && <div>❤️ HP +{selectedItem.effect.hp}</div>}
              {selectedItem.effect.mp && <div>💎 MP +{selectedItem.effect.mp}</div>}
              {selectedItem.effect.attr && (
                <div>📊 {selectedItem.effect.attr} +{selectedItem.effect.value}</div>
              )}
            </div>
          )}

          {/* Quantity */}
          {selectedItem.quantity !== undefined && (
            <div style={{
              fontSize: '0.75rem',
              color: '#6B6258',
              marginBottom: '0.625rem',
            }}>
              数量: {selectedItem.quantity > 0 ? selectedItem.quantity : '用完'}
            </div>
          )}

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            {/* Use button for consumables */}
            {isConsumable(selectedItem) && (selectedItem.quantity ?? 1) > 0 && (
              <button
                type="button"
                onClick={() => handleUse(selectedItem)}
                disabled={usingId === selectedItem.id}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 8,
                  border: '1px solid #7B6FDF',
                  background: usingId === selectedItem.id
                    ? 'rgba(123,111,223,0.4)'
                    : 'rgba(123,111,223,0.2)',
                  color: usingId === selectedItem.id ? '#E8E0D5' : '#7B6FDF',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: usingId === selectedItem.id ? 'wait' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: usingId === selectedItem.id ? 0.6 : 1,
                }}
              >
                {usingId === selectedItem.id ? '使用中...' : '🧪 使用'}
              </button>
            )}

            {/* Equip button for weapons/armor/trinkets */}
            {isEquippable(selectedItem) && (() => {
              const targetSlot = equipSlotFor(selectedItem);
              const alreadyEquipped = isItemEquipped(selectedItem.id);
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (onEquip) onEquip(selectedItem);
                    else handleUse(selectedItem);
                    closeMenu();
                  }}
                  disabled={alreadyEquipped}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 8,
                    border: '1px solid #C9A94E',
                    background: alreadyEquipped ? 'rgba(201,169,78,0.05)' : 'rgba(201,169,78,0.15)',
                    color: alreadyEquipped ? '#6B6258' : '#C9A94E',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: alreadyEquipped ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {alreadyEquipped
                    ? '✔ 已装备'
                    : `⚔️ 装备（${targetSlot ?? '—'}）`}
                </button>
              );
            })()}

            {/* v4.2.0: 组合按钮（参与配方的物品） */}
            {onCraft && isCraftable(selectedItem) && (
              <button
                type="button"
                onClick={() => {
                  setCraftMode(true);
                  setCraftPick(selectedItem);
                  closeMenu();
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 8,
                  border: '1px solid #7B6FDF',
                  background: 'rgba(123,111,223,0.15)',
                  color: '#7B6FDF',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                🧬 用于组合
              </button>
            )}

            {/* Discard button */}
            {discardConfirmId === selectedItem.id ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleDiscard(selectedItem)}
                  disabled={discarding}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: 8,
                    border: '1px solid #E53E3E',
                    background: discarding ? 'rgba(229,62,62,0.4)' : 'rgba(229,62,62,0.2)',
                    color: '#E53E3E',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: discarding ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {discarding ? '丢弃中...' : '确认丢弃'}
                </button>
                <button
                  type="button"
                  onClick={() => setDiscardConfirmId(null)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid rgba(201,169,78,0.3)',
                    background: 'transparent',
                    color: '#A09888',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleDiscard(selectedItem)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 8,
                  border: '1px solid rgba(229,62,62,0.3)',
                  background: 'transparent',
                  color: '#E53E3E',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                🗑️ 丢弃
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overlay to catch clicks outside menu */}
      {menuPos && (
        <div
          onClick={closeMenu}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 199,
          }}
        />
      )}
    </div>
  );
}
