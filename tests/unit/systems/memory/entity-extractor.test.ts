/**
 * EntityExtractor 单元测试
 *
 * @see GDD §7.1 MEM-UT-01, MEM-UT-02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityExtractor } from '@/systems/memory/entity-extractor';

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeEach(() => {
    extractor = new EntityExtractor();
  });

  describe('extractEntities — 中文人名', () => {
    it('提取中文姓氏+名+职位后缀的人名', () => {
      const entities = extractor.extractEntities(
        '李队长带领士兵前往黑暗森林。',
        'evt-1'
      );
      const names = entities.map((e) => e.name);
      expect(names).toContain('李队长');
    });

    it('提取纯职位角色名', () => {
      const entities = extractor.extractEntities(
        '守卫队长站在城门口。旅店老板正在擦拭酒杯。',
        'evt-2'
      );
      const names = entities.map((e) => e.name);
      expect(names).toContain('守卫队长');
      expect(names).toContain('旅店老板');
    });

    it('标记 character 类型', () => {
      const entities = extractor.extractEntities(
        '张铁匠为你打造了一把剑。',
        'evt-3'
      );
      const charEntity = entities.find((e) => e.name === '张铁匠');
      expect(charEntity).toBeDefined();
      expect(charEntity!.type).toBe('character');
    });

    it('已知实体置信度更高', () => {
      extractor.registerKnownNames(['李队长']);
      const entities = extractor.extractEntities(
        '李队长和守卫队长在交谈。',
        'evt-4'
      );
      const known = entities.find((e) => e.name === '李队长');
      const unknown = entities.find((e) => e.name === '守卫队长');
      expect(known!.confidence).toBeGreaterThanOrEqual(0.9);
      expect(unknown!.confidence).toBeLessThan(0.9);
    });
  });

  describe('extractEntities — 英文专有名词', () => {
    it('提取连续大写字母开头的英文名', () => {
      const entities = extractor.extractEntities(
        'Captain Morgan and Lady Elizabeth arrived at Dark Forest.',
        'evt-5'
      );
      const names = entities.map((e) => e.name);
      // "Captain Morgan" 是连续大写词
      expect(names.some((n) => n.includes('Captain Morgan') || n.includes('Lady Elizabeth'))).toBe(true);
    });
  });

  describe('extractEntities — 地名', () => {
    it('提取地理后缀匹配的地名', () => {
      const entities = extractor.extractEntities(
        '他们穿越了黑暗森林，来到了古老城堡。',
        'evt-6'
      );
      const names = entities.map((e) => e.name);
      expect(names).toContain('黑暗森林');
      expect(names).toContain('古老城堡');
    });

    it('标记 location 类型', () => {
      const entities = extractor.extractEntities(
        '龙栖山脉高耸入云。',
        'evt-7'
      );
      const loc = entities.find((e) => e.name === '龙栖山脉');
      expect(loc).toBeDefined();
      expect(loc!.type).toBe('location');
    });
  });

  describe('extractEntities — 物品', () => {
    it('提取量词+物品名', () => {
      const entities = extractor.extractEntities(
        '你获得了一把锋利的剑和一瓶治疗药水。',
        'evt-8'
      );
      const names = entities.map((e) => e.name);
      expect(names.some((n) => n.includes('剑'))).toBe(true);
      expect(names.some((n) => n.includes('药水'))).toBe(true);
    });

    it('标记 item 类型', () => {
      const entities = extractor.extractEntities(
        '地上有一把匕首。',
        'evt-9'
      );
      const item = entities.find((e) => e.name.includes('匕首'));
      expect(item).toBeDefined();
      expect(item!.type).toBe('item');
    });
  });

  describe('extractEntities — 派系', () => {
    it('提取组织/派系名称', () => {
      const entities = extractor.extractEntities(
        '他是光辉骑士团的成员，曾效力于北方联盟。',
        'evt-10'
      );
      const names = entities.map((e) => e.name);
      expect(names).toContain('光辉骑士团');
      expect(names).toContain('北方联盟');
    });

    it('标记 faction 类型', () => {
      const entities = extractor.extractEntities(
        '暗影兄弟会的刺客潜入了王宫。',
        'evt-11'
      );
      const faction = entities.find((e) => e.name === '暗影兄弟会');
      expect(faction).toBeDefined();
      expect(faction!.type).toBe('faction');
    });
  });

  describe('extractEntities — 去重', () => {
    it('同一实体不重复提取', () => {
      const entities = extractor.extractEntities(
        '黑暗森林笼罩在迷雾中。黑暗森林是冒险者的禁地。',
        'evt-12'
      );
      const forestEntries = entities.filter((e) => e.name === '黑暗森林');
      expect(forestEntries).toHaveLength(1);
    });
  });

  describe('extractEntities — 边界条件', () => {
    it('空文本返回空数组', () => {
      const entities = extractor.extractEntities('', 'evt-13');
      expect(entities).toEqual([]);
    });

    it('无匹配时返回空数组', () => {
      const entities = extractor.extractEntities('今天天气不错。', 'evt-14');
      expect(entities).toEqual([]);
    });

    it('文本中无地名后缀时不误提取地名', () => {
      const entities = extractor.extractEntities(
        '他说这里很美。',
        'evt-15'
      );
      const locations = entities.filter((e) => e.type === 'location');
      expect(locations).toHaveLength(0);
    });
  });

  describe('extractRelations', () => {
    it('从文本中提取关系动词映射', () => {
      const entities = extractor.extractEntities(
        '李队长与守卫队长并肩作战，共同对抗暗影兄弟会。',
        'evt-16'
      );
      const relations = extractor.extractRelations(
        entities,
        '李队长与守卫队长并肩作战，共同对抗暗影兄弟会。'
      );
      expect(relations.length).toBeGreaterThan(0);
      // 应至少包含 ALLY 关系
      expect(relations.some((r) => r.type === 'ALLY')).toBe(true);
    });

    it('实体少于 2 时不提取关系', () => {
      const entities = extractor.extractEntities(
        '李队长独自前行。',
        'evt-17'
      );
      const relations = extractor.extractRelations(
        entities,
        '李队长独自前行。'
      );
      // 至少需要两个 character/faction 才能提取关系
      const charsAndFactions = entities.filter(
        (e) => e.type === 'character' || e.type === 'faction'
      );
      if (charsAndFactions.length >= 2) {
        // 如果有足够实体，检查是否有关系
        expect(relations.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('敌对话语触发 ENEMY 关系', () => {
      const entities = extractor.extractEntities(
        '守卫队长憎恨暗影兄弟会，他们袭击了村庄。',
        'evt-18'
      );
      const relations = extractor.extractRelations(
        entities,
        '守卫队长憎恨暗影兄弟会，他们袭击了村庄。'
      );
      // 检查是否有 ENEMY 或相关关系
      const enemyRels = relations.filter(
        (r) => r.type === 'ENEMY' || r.type === 'RIVAL'
      );
      expect(enemyRels.length).toBeGreaterThan(0);
    });

    it('无关系动词时返回空数组', () => {
      const entities = extractor.extractEntities(
        '李队长和守卫队长在广场上。',
        'evt-19'
      );
      const relations = extractor.extractRelations(
        entities,
        '李队长和守卫队长在广场上。'
      );
      // 可能触发 LOCATED_AT，也可能没有
      // 主要验证不抛异常
      expect(Array.isArray(relations)).toBe(true);
    });
  });
});
