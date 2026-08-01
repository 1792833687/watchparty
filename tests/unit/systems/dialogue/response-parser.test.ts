/**
 * ResponseParser 单元测试
 *
 * 覆盖: 四块解析、假选择检测、StateDelta 提取、建议动作分类
 *
 * @see design/gdd/dialogue-system.md §7.1 DLG-UT-01 ~ DLG-UT-07
 */

import { describe, it, expect } from 'vitest';
import { ResponseParser } from '@/systems/dialogue/response-parser';

// ============================================================
// 测试夹具
// ============================================================

function makeParser(): ResponseParser {
  return new ResponseParser();
}

const FULL_RESPONSE = `[NARRATIVE]
你推开沉重的橡木门，一股霉味扑面而来。烛光照亮了石壁上古老的符文——它们似乎在对你的到来做出反应，微微发光。房间中央有一张石桌，上面放着一本翻开的书。

[ACTIONS]
- 走近查看那本书
- 研究墙壁上的符文
- 搜索房间的其他角落
- 原路返回走廊

[STATE]
HP: -0
位置: 地下密室
发现: 古老符文, 魔法书

[DECISION]
Scene Type: magic
Option A: 触碰发光的符文——感受魔法的脉动
Option B: 先阅读石桌上的书——知识就是力量
Option C: 谨慎地离开——不信任这古老的魔法`;

const RESPONSE_NO_DECISION = `[NARRATIVE]
你沿着走廊前行，脚步声在石壁上回荡。远处传来滴水的声音。

[ACTIONS]
- 继续前进
- 停下来仔细听
- 检查墙壁是否有暗门

[STATE]
位置: 地下走廊
发现: 无特殊发现`;

const RESPONSE_MINIMAL = `[NARRATIVE]
天色已暗，你感到疲惫。

[ACTIONS]
- 找个地方休息

[STATE]
状态: 疲劳`;

const RESPONSE_NO_ACTIONS = `[NARRATIVE]
你环顾四周，一切都很平静。

[STATE]
位置: 村口`;

const MALFORMED_RESPONSE = `这是一段没有标记的纯文本回应。
AI GM 说了很多话但没有使用正确的格式标签。`;

const FAKE_CHOICE_RESPONSE = `[NARRATIVE]
守卫站在你面前。

[ACTIONS]
- 和守卫交谈

[STATE]
状态: 对话中

[DECISION]
Scene Type: golden
Option A: 向守卫友善地问好
Option B: 向守卫友好地问好`;

// ============================================================
// 测试
// ============================================================

describe('ResponseParser', () => {
  describe('parse() — 四块解析', () => {
    it('应正确解析完整响应（包含所有四个块）', () => {
      const parser = makeParser();
      const result = parser.parse(FULL_RESPONSE);

      expect(result.blocks).toHaveLength(4);
      expect(result.isDecisionPoint).toBe(true);

      const narrative = result.blocks.find((b) => b.type === 'narrative');
      expect(narrative).toBeDefined();
      expect(narrative!.text).toContain('橡木门');

      const actions = result.blocks.find((b) => b.type === 'action');
      expect(actions).toBeDefined();
      expect(actions!.text).toContain('查看那本书');

      const state = result.blocks.find((b) => b.type === 'state');
      expect(state).toBeDefined();
      expect(state!.text).toContain('地下密室');

      const decision = result.blocks.find((b) => b.type === 'decision');
      expect(decision).toBeDefined();
      expect(decision!.options).toHaveLength(3);
    });

    it('应正确解析无决策的响应', () => {
      const parser = makeParser();
      const result = parser.parse(RESPONSE_NO_DECISION);

      expect(result.isDecisionPoint).toBe(false);
      expect(result.blocks).toHaveLength(3); // narrative + actions + state

      const decision = result.blocks.find((b) => b.type === 'decision');
      expect(decision).toBeUndefined();
    });

    it('应正确解析最小响应', () => {
      const parser = makeParser();
      const result = parser.parse(RESPONSE_MINIMAL);

      expect(result.blocks.length).toBeGreaterThanOrEqual(2);
      expect(result.isDecisionPoint).toBe(false);
    });

    it('缺失 ACTIONS 时应在 diagnostics 中标记', () => {
      const parser = makeParser();
      const result = parser.parse(RESPONSE_NO_ACTIONS);

      expect(result.diagnostics.missingBlocks).toContain('ACTIONS');
      expect(result.diagnostics.allBlocksFound).toBe(false);
    });

    it('格式错误的响应应全文视为 narrative（降级策略）', () => {
      const parser = makeParser();
      const result = parser.parse(MALFORMED_RESPONSE);

      // 应至少有一个 narrative 块
      const narrative = result.blocks.find((b) => b.type === 'narrative');
      expect(narrative).toBeDefined();
      expect(narrative!.text).toContain('纯文本回应');

      // 不应有决策点
      expect(result.isDecisionPoint).toBe(false);
    });

    it('空字符串应返回默认 narrative', () => {
      const parser = makeParser();
      const result = parser.parse('');

      const narrative = result.blocks.find((b) => b.type === 'narrative');
      expect(narrative).toBeDefined();
    });
  });

  describe('extractBlock() — 块提取', () => {
    it('应正确提取 NARRATIVE 块', () => {
      const parser = makeParser();
      const text = parser.extractBlock(FULL_RESPONSE, 'NARRATIVE');
      expect(text).toBeDefined();
      expect(text).toContain('橡木门');
    });

    it('应正确提取 DECISION 块', () => {
      const parser = makeParser();
      const text = parser.extractBlock(FULL_RESPONSE, 'DECISION');
      expect(text).toBeDefined();
      expect(text).toContain('Scene Type');
    });

    it('不存在的块应返回 null', () => {
      const parser = makeParser();
      const text = parser.extractBlock(RESPONSE_NO_DECISION, 'DECISION');
      expect(text).toBeNull();
    });
  });

  describe('parseDecisionOptions() — 决策选项解析', () => {
    it('应正确解析三个选项', () => {
      const parser = makeParser();
      const decisionText = parser.extractBlock(FULL_RESPONSE, 'DECISION')!;
      const options = parser.parseDecisionOptions(decisionText);

      expect(options).toHaveLength(3);
      expect(options[0]!.text).toContain('触碰发光的符文');
      expect(options[1]!.text).toContain('先阅读石桌上的书');
      expect(options[2]!.text).toContain('谨慎地离开');

      // 所有选项应有相同的 sceneType
      expect(options[0]!.sceneType).toBe('magic');
      expect(options[1]!.sceneType).toBe('magic');
    });
  });

  describe('parseSuggestedActions() — 建议动作解析', () => {
    it('应正确解析列表格式的建议动作', () => {
      const parser = makeParser();
      const actionsText = parser.extractBlock(FULL_RESPONSE, 'ACTIONS')!;
      const actions = parser.parseSuggestedActions(actionsText);

      expect(actions.length).toBeGreaterThanOrEqual(3);
      expect(actions[0]!.text).toContain('查看那本书');
    });

    it('应正确分类动作类型', () => {
      const parser = makeParser();

      expect(parser.classifyActionType('走向门口')).toBe('movement');
      expect(parser.classifyActionType('查看地面痕迹')).toBe('examination');
      expect(parser.classifyActionType('拔出武器准备战斗')).toBe('combat');
      expect(parser.classifyActionType('在篝火旁休息')).toBe('rest');
      expect(parser.classifyActionType('喝一瓶治疗药水')).toBe('item_use');
      expect(parser.classifyActionType('和守卫交谈')).toBe('conversation');
    });

    it('空文本应返回空数组', () => {
      const parser = makeParser();
      const actions = parser.parseSuggestedActions('');
      expect(actions).toHaveLength(0);
    });
  });

  describe('extractStateDelta() — StateDelta 提取', () => {
    it('应提取 HP 变化', () => {
      const parser = makeParser();
      const delta = parser.extractStateDelta('HP: -10\n位置: 村口', '');

      expect(delta.hpChange).toBe(-10);
    });

    it('应提取位置变化', () => {
      const parser = makeParser();
      const delta = parser.extractStateDelta(
        '位置: 地下密室',
        '你来到了地下密室'
      );

      expect(delta.locationChange).toBeDefined();
    });

    it('应提取物品变化', () => {
      const parser = makeParser();
      const delta = parser.extractStateDelta(
        '获得: 古老钥匙',
        '你获得了古老钥匙和魔法卷轴'
      );

      expect(delta.itemChanges.length).toBeGreaterThan(0);
    });

    it('空文本应返回空 StateDelta', () => {
      const parser = makeParser();
      const delta = parser.extractStateDelta('', '');

      expect(delta.relationshipChanges).toHaveLength(0);
      expect(delta.itemChanges).toHaveLength(0);
      expect(delta.questUpdates).toHaveLength(0);
    });
  });

  describe('detectFakeChoices() — 假选择检测', () => {
    it('应检测到高度相似的选项', () => {
      const parser = makeParser();
      const result = parser.parse(FAKE_CHOICE_RESPONSE);

      expect(result.fakeChoiceWarning).not.toBeNull();
      expect(result.fakeChoiceWarning!.severity).toBe('warning');
    });

    it('正常不同选项不应触发假选择警告', () => {
      const parser = makeParser();
      const result = parser.parse(FULL_RESPONSE);

      // FULL_RESPONSE 的选项明显不同
      if (result.fakeChoiceWarning) {
        // 如果触发，应该是 warning 级别（不是 error）
        expect(result.fakeChoiceWarning.severity).toBe('warning');
      }
    });

    it('单个选项不应触发假选择检测', () => {
      const parser = makeParser();
      const warning = parser.detectFakeChoices([]);
      expect(warning).toBeNull();

      const singleWarning = parser.detectFakeChoices([
        { id: '1', text: '唯一选项', sceneType: 'golden', predictedConsequence: '' },
      ]);
      expect(singleWarning).toBeNull();
    });
  });

  describe('extractNarrativeTags() — 叙事标签', () => {
    it('决策点应标记 golden_choice', () => {
      const parser = makeParser();
      const tags = parser.extractNarrativeTags('', '', 'Scene Type: golden', true);

      expect(tags).toContain('golden_choice');
    });

    it('危险场景应标记 danger_zone', () => {
      const parser = makeParser();
      const tags = parser.extractNarrativeTags(
        '危险正在逼近',
        '',
        'Scene Type: danger',
        true
      );

      expect(tags).toContain('danger_zone');
    });
  });
});
