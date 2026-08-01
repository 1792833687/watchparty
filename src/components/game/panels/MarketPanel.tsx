/**
 * v4.0.0 市场面板 — 物品买卖与多层级货币显示
 * @module components/game/panels/MarketPanel
 */
'use client';

import React, { useMemo, useState } from 'react';
import { C, RARITY, CURRENCY, RADIUS, SHADOW, FONT, Wallet, walletToCopper, copperToWallet } from '@/theme/tokens';
import { ITEMS_LIBRARY, LibraryItem } from '@/systems/content';
import { calculateBuyPrice, calculateSellPrice, formatPrice } from '@/systems/market/market-system';
import type { GameItem } from './types';

const S = {
  container: { padding: '1rem', display: 'flex', flexDirection: 'column' as const, gap: '0.75rem', maxHeight: '70vh', overflowY: 'auto' as const },
  header: { fontSize: FONT.lg, fontWeight: 700, color: C.gold, textAlign: 'center' as const, paddingBottom: '0.5rem', borderBottom: `1px solid ${C.border}` },
  wallet: { display: 'flex', gap: '1rem', justifyContent: 'center', padding: '0.5rem 0', flexWrap: 'wrap' as const },
  walletItem: { display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.75rem', borderRadius: RADIUS.pill, fontSize: FONT.sm },
  tabRow: { display: 'flex', gap: '0.5rem', justifyContent: 'center' },
  tab: (active: boolean) => ({ padding: '0.4rem 1.2rem', borderRadius: RADIUS.pill, border: 'none', cursor: 'pointer', fontSize: FONT.md, fontWeight: 600, background: active ? C.gold : C.bgCard, color: active ? C.bgDeep : C.textDim, transition: 'all 0.2s' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.625rem' },
  card: { padding: '0.75rem', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: C.bgCard, cursor: 'pointer', transition: 'all 0.2s' },
  cardName: { fontSize: FONT.md, fontWeight: 700, color: C.text, marginBottom: '0.25rem' },
  cardDesc: { fontSize: FONT.xs, color: C.textDim, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${C.border}` },
  priceTag: { fontSize: FONT.sm, fontWeight: 700, color: C.gold },
  actionBtn: (style: 'buy' | 'sell') => ({ padding: '0.35rem 0.875rem', borderRadius: RADIUS.sm, border: 'none', cursor: 'pointer', fontSize: FONT.sm, fontWeight: 600, background: style === 'buy' ? C.gold : '#A07050', color: C.bgDeep }),
  empty: { textAlign: 'center' as const, color: C.textDim, padding: '2rem 0' },
};

interface MarketPanelProps {
  wallet: Wallet;
  inventory: GameItem[];
  /** 当前地点（影响价格修正） */
  currentLocation?: string;
  /** 购买回调 */
  onBuy?: (item: LibraryItem) => void;
  /** 出售回调 */
  onSell?: (item: GameItem) => void;
}

export const MarketPanel: React.FC<MarketPanelProps> = ({ wallet, inventory, currentLocation, onBuy, onSell }) => {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const totalCopper = walletToCopper(wallet);

  const marketItems = useMemo(() => {
    return ITEMS_LIBRARY
      .filter(it => it.basePrice > 0 && it.sources.includes('market'))
      .map(it => ({
        ...it,
        buyPrice: calculateBuyPrice(it.basePrice, it.rarity, currentLocation, it.id),
      }))
      .sort((a, b) => a.buyPrice - b.buyPrice);
    // v4.2.2 (R2): wallet 入依赖 — 买卖后供需变化需实时重算价格
  }, [currentLocation, wallet]);

  const sellableItems = useMemo(() => {
    return inventory
      .filter(it => (it.quantity ?? 1) > 0)
      .map(it => {
        const libItem = ITEMS_LIBRARY.find(li => li.id === it.id || li.name === it.name);
        const buyPrice = libItem
          ? calculateBuyPrice(libItem.basePrice, it.rarity ?? libItem.rarity, currentLocation, it.id)
          : 5;
        return {
          ...it,
          sellPrice: calculateSellPrice(buyPrice, it.id),
          buyPrice,
        };
      })
      .sort((a, b) => b.sellPrice - a.sellPrice);
  }, [inventory, currentLocation, wallet]);

  const currencyTypes = ['gold', 'silver', 'copper', 'shard'] as const;

  return (
    <div style={S.container}>
      {/* 钱包余额 */}
      <div style={S.wallet}>
        {currencyTypes.map(ct => (
          <div key={ct} style={{ ...S.walletItem, background: C.currency[ct] + '18', border: `1px solid ${C.currency[ct]}33` }}>
            <span style={{ fontSize: FONT.base }}>{CURRENCY[ct].symbol}</span>
            <span style={{ fontWeight: 700, color: C.currency[ct] }}>{wallet[ct]}</span>
          </div>
        ))}
      </div>

      {/* 买卖切换 */}
      <div style={S.tabRow}>
        <button style={S.tab(tab === 'buy')} onClick={() => setTab('buy')}>🛒 购买 ({marketItems.length})</button>
        <button style={S.tab(tab === 'sell')} onClick={() => setTab('sell')}>💰 出售 ({sellableItems.length})</button>
      </div>

      {/* 购买列表 */}
      {tab === 'buy' && (
        <div style={S.grid}>
          {marketItems.map(it => (
            <div key={it.id} style={S.card} onClick={() => onBuy?.(it)}>
              <div style={S.cardName}>{it.emoji} {it.name}</div>
              <div style={{ ...S.cardDesc, marginBottom: '0.25rem' }}>{it.desc}</div>
              <div style={S.cardFooter}>
                <span style={{ fontSize: FONT.xs, fontWeight: 600, color: (RARITY[it.rarity]?.color ?? RARITY.common.color) }}>
                  {RARITY[it.rarity]?.label ?? RARITY.common.label}
                </span>
                <span style={S.priceTag}>{formatPrice(it.buyPrice)}</span>
              </div>
              <button style={{ ...S.actionBtn('buy'), width: '100%', marginTop: '0.5rem' }}
                disabled={it.buyPrice > totalCopper}>
                {it.buyPrice > totalCopper ? '资金不足' : '购买'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 出售列表 */}
      {tab === 'sell' && (
        sellableItems.length === 0 ? (
          <div style={S.empty}>背包中无可出售物品</div>
        ) : (
          <div style={S.grid}>
            {sellableItems.map((it, i) => (
              <div key={it.id + i} style={S.card} onClick={() => onSell?.(it)}>
                <div style={S.cardName}>{it.emoji} {it.name}</div>
                <div style={S.cardDesc}>{it.description || '—'}</div>
                <div style={S.cardFooter}>
                  <span style={{ fontSize: FONT.xs, color: C.textDim }}>
                    x{it.quantity ?? 1}
                  </span>
                  <span style={{ ...S.priceTag, color: '#A07050' }}>{formatPrice(it.sellPrice)}</span>
                </div>
                <button style={{ ...S.actionBtn('sell'), width: '100%', marginTop: '0.5rem' }}>
                  出售
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default MarketPanel;
