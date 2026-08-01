/**
 * v4.2.0 NPC 关系链系统
 *
 * 由原「关系网」拓展为「关系链」：
 * - 剧情中遇到的任意人物可加入关系链（不限于预设同伴）
 * - 每个节点包含：基础信息、好感度、忠诚度、当前关系、羁绊记忆
 * - 面板角色可交互：对话、赠送、邀约、结盟
 * @module systems/npc/relation-chain
 */

export type ChainRelation = 'unknown' | 'acquaintance' | 'friend' | 'ally' | 'rival' | 'enemy' | 'companion';

export interface ChainNode {
  id: string;
  /** 显示名（未知时为代号） */
  name: string;
  /** 隐藏时的代号 */
  codename: string;
  role: string;
  emoji: string;
  /** 种族 */
  race?: string;
  /** 好感度 -100 ~ 100 */
  affinity: number;
  /** 忠诚度 0 ~ 100 */
  loyalty: number;
  /** 关系层级 */
  relation: ChainRelation;
  /** 情报解锁 0-3 */
  revealLevel: 0 | 1 | 2 | 3;
  /** 外貌速写 */
  appearance?: string;
  /** 羁绊记忆（重要事件） */
  memories: string[];
  /** 是否在剧情中活跃 */
  active: boolean;
  /** 加入关系链的契机 */
  metAt?: string;
  /** 最后互动时间 */
  lastInteraction?: number;
  /** 互动次数 */
  interactionCount: number;
  /** 玩家对该角色的称呼标签 */
  tags?: string[];
}

export interface ChainEdge {
  /** 节点 A */
  from: string;
  /** 节点 B */
  to: string;
  /** 关系类型描述 */
  label: string;
  /** 关系强度 0-100 */
  strength: number;
}

export interface RelationChain {
  nodes: ChainNode[];
  edges: ChainEdge[];
}

export const RELATION_LABELS: Record<ChainRelation, string> = {
  unknown: '陌生',
  acquaintance: '相识',
  friend: '友人',
  ally: '盟友',
  rival: '对手',
  enemy: '仇敌',
  companion: '同伴',
};

export const RELATION_COLORS: Record<ChainRelation, string> = {
  unknown: '#6B6258',
  acquaintance: '#A09888',
  friend: '#5A9E6F',
  ally: '#C9A94E',
  rival: '#E8843C',
  enemy: '#E53E3E',
  companion: '#7B6FDF',
};

export function createEmptyChain(): RelationChain {
  return { nodes: [], edges: [] };
}

/** 将 CompanionRelationship 迁移为 ChainNode */
export function companionToNode(
  c: { id: string; name: string; codename: string; role?: string; emoji: string; race?: string; affinity: number; loyalty: number; revealLevel: 0 | 1 | 2 | 3; memories?: string[]; coreBelief?: string; conflict?: string; appearance?: string; status?: string }
): ChainNode {
  return {
    id: c.id,
    name: c.name,
    codename: c.codename,
    role: c.role ?? '未知身份',
    emoji: c.emoji,
    race: c.race,
    affinity: c.affinity,
    loyalty: c.loyalty,
    relation: c.status === 'companion' ? 'companion' : c.affinity >= 60 ? 'ally' : c.affinity <= -40 ? 'enemy' : c.affinity >= 20 ? 'friend' : 'acquaintance',
    revealLevel: c.revealLevel,
    appearance: c.appearance,
    memories: c.memories ?? [],
    active: c.status === 'companion',
    interactionCount: 0,
    lastInteraction: Date.now(),
  };
}

/** 依据好感度更新关系层级 */
export function relationFromAffinity(affinity: number, isCompanion: boolean): ChainRelation {
  if (isCompanion) return 'companion';
  if (affinity >= 60) return 'ally';
  if (affinity >= 20) return 'friend';
  if (affinity >= -20) return 'acquaintance';
  if (affinity >= -60) return 'rival';
  return 'enemy';
}

/** 添加或更新节点 */
export function upsertNode(chain: RelationChain, node: ChainNode): RelationChain {
  const idx = chain.nodes.findIndex((n) => n.id === node.id);
  const nodes = [...chain.nodes];
  if (idx >= 0) nodes[idx] = { ...nodes[idx], ...node };
  else nodes.push(node);
  return { ...chain, nodes };
}

/** 记录一次互动（好感度变化 + 记忆追加 + 计数） */
export function interactWithNode(
  chain: RelationChain,
  nodeId: string,
  opts: { affinityDelta?: number; loyaltyDelta?: number; memory?: string }
): RelationChain {
  const idx = chain.nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return chain;
  const prev = chain.nodes[idx]!;
  const affinity = Math.max(-100, Math.min(100, prev.affinity + (opts.affinityDelta ?? 0)));
  const loyalty = Math.max(0, Math.min(100, prev.loyalty + (opts.loyaltyDelta ?? 0)));
  const memories = opts.memory ? [opts.memory, ...prev.memories].slice(0, 12) : prev.memories;
  const updated: ChainNode = {
    ...prev,
    affinity,
    loyalty,
    relation: relationFromAffinity(affinity, prev.relation === 'companion'),
    memories,
    lastInteraction: Date.now(),
    interactionCount: prev.interactionCount + 1,
  };
  const nodes = [...chain.nodes];
  nodes[idx] = updated;
  return { ...chain, nodes };
}

/** 从 AI 的 NEWS/关系更新中新增临时角色到关系链 */
export function addDynamicNode(
  chain: RelationChain,
  node: Omit<ChainNode, 'interactionCount' | 'lastInteraction' | 'memories' | 'active'> & { memories?: string[] }
): RelationChain {
  return upsertNode(chain, {
    ...node,
    // 提供健壮默认值（AI 字段可能缺失）
    affinity: node.affinity ?? 0,
    loyalty: node.loyalty ?? 0,
    relation: node.relation ?? relationFromAffinity(node.affinity ?? 0, false),
    revealLevel: (node.revealLevel ?? 1) as ChainNode['revealLevel'],
    codename: node.codename ?? `陌生的${node.role ?? '旅人'}`,
    emoji: node.emoji ?? '❓',
    memories: node.memories ?? [],
    active: true,
    interactionCount: 0,
    lastInteraction: Date.now(),
  });
}
