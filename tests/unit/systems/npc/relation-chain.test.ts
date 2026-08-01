/**
 * v4.2.0 关系链系统测试
 */
import { describe, expect, it } from 'vitest';
import {
  createEmptyChain, companionToNode, interactWithNode, addDynamicNode,
  relationFromAffinity, RELATION_LABELS, type ChainNode,
} from '@/systems/npc/relation-chain';

function node(id: string, affinity = 0, opts: Partial<ChainNode> = {}): ChainNode {
  return {
    id, name: id, codename: `未知${id}`, role: '旅人', emoji: '❓',
    affinity, loyalty: 50, relation: relationFromAffinity(affinity, false),
    revealLevel: 1, memories: [], active: false,
    interactionCount: 0, lastInteraction: Date.now(), ...opts,
  };
}

describe('关系链系统', () => {
  it('空链创建', () => {
    const chain = createEmptyChain();
    expect(chain.nodes).toEqual([]);
    expect(chain.edges).toEqual([]);
  });

  it('addDynamicNode 加入剧情角色', () => {
    let chain = createEmptyChain();
    chain = addDynamicNode(chain, {
      id: 'mysterious-stranger', name: '戴兜帽的人', role: '神秘旅人', emoji: '🎭',
      affinity: 10, loyalty: 30,
    });
    expect(chain.nodes).toHaveLength(1);
    expect(chain.nodes[0]!.name).toBe('戴兜帽的人');
    expect(chain.nodes[0]!.active).toBe(true);
  });

  it('interactWithNode 好感度变化并钳制', () => {
    let chain = createEmptyChain();
    chain = addDynamicNode(chain, { id: 'n1', name: '角色A', role: '卫兵', emoji: '⚔️' });
    chain = interactWithNode(chain, 'n1', { affinityDelta: 20, memory: '他救了你一命' });
    expect(chain.nodes[0]!.affinity).toBe(20);
    expect(chain.nodes[0]!.memories[0]).toBe('他救了你一命');
    expect(chain.nodes[0]!.interactionCount).toBe(1);
    // 好感度上限钳制
    chain = interactWithNode(chain, 'n1', { affinityDelta: 200 });
    expect(chain.nodes[0]!.affinity).toBe(100);
  });

  it('好感度驱动关系层级', () => {
    expect(relationFromAffinity(80, false)).toBe('ally');
    expect(relationFromAffinity(30, false)).toBe('friend');
    expect(relationFromAffinity(0, false)).toBe('acquaintance');
    expect(relationFromAffinity(-30, false)).toBe('rival');
    expect(relationFromAffinity(-80, false)).toBe('enemy');
    expect(relationFromAffinity(-80, true)).toBe('companion');
  });

  it('companionToNode 迁移预设同伴', () => {
    const n = companionToNode({
      id: 'roland', name: '罗兰爵士', codename: '陌生的圣武士', role: '圣武士',
      emoji: '⚔️', affinity: 50, loyalty: 80, revealLevel: 2,
      status: 'companion', memories: ['宣誓保卫要塞'],
    });
    expect(n.relation).toBe('companion');
    expect(n.memories).toContain('宣誓保卫要塞');
  });

  it('interactWithNode 对不存在节点无副作用', () => {
    const chain = createEmptyChain();
    const next = interactWithNode(chain, 'ghost', { affinityDelta: 10 });
    expect(next.nodes).toEqual([]);
  });

  it('关系标签完整', () => {
    expect(RELATION_LABELS.companion).toBe('同伴');
    expect(RELATION_LABELS.enemy).toBe('仇敌');
  });
});
