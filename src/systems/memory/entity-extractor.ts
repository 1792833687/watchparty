/**
 * EntityExtractor — 规则引擎实体提取
 *
 * @description
 * MVP 阶段使用正则 + 关键词匹配提取实体和关系，不调用 LLM。
 * 专有名词识别覆盖中文和英文。置信度 0.0–1.0。
 *
 * 设计决策：
 * - MEM-001：实体提取优先使用规则引擎（MVP），LLM 辅助为 Should Have
 * - 人名匹配：中文 2-3 字常见姓氏 + 职位后缀；英文首字母大写连续词
 * - 地名匹配：地理后缀关键词（森林/山脉/洞穴/城堡…）
 * - 物品名匹配：物品关键词 + 量词前缀
 * - 关系动词匹配：社交动词 → RelationType 映射
 *
 * @see GDD §2.5, §2.6, MEM-001
 */

import type {
  EntityType,
  ExtractedEntity,
  Relation,
  RelationType,
} from './types';

// FIX: QUAL-2 — 硬编码词典外置为 JSON 配置文件，便于非开发者维护和扩展
import dictionaries from './dictionaries.json';

// ============================================================
// 中文姓氏库（TOP 100 常见姓氏）
// ============================================================

const CHINESE_SURNAMES = new Set(dictionaries.chineseSurnames);

// ============================================================
// NPC 职位/角色后缀（按长度降序排列，确保长匹配优先）
// ============================================================

const NPC_TITLE_SUFFIXES = dictionaries.npcTitleSuffixes as readonly string[];

// ============================================================
// 地名后缀（按长度降序排列）
// ============================================================

const LOCATION_SUFFIXES = dictionaries.locationSuffixes as readonly string[];

// ============================================================
// 物品关键词
// ============================================================

const ITEM_KEYWORDS = dictionaries.itemKeywords as readonly string[];

// 物品量词前缀（"一把剑" → 识别"剑"）
const ITEM_QUANTIFIERS = /^(一把|一支|一件|一块|一颗|一枚|一瓶|一本|一张|一条|一面|一柄|一副|一根|一袋|一包|一个)/;

// ============================================================
// 派系/组织关键词
// ============================================================

const FACTION_KEYWORDS = dictionaries.factionKeywords as readonly string[];

// ============================================================
// 关系动词 → RelationType 映射
// ============================================================

interface RelationVerbRule {
  verbs: RegExp;
  type: RelationType;
  bidirectional: boolean;
}

const RELATION_VERB_RULES: RelationVerbRule[] = [
  {
    verbs: /同盟|结盟|联手|合作|并肩|盟友/g,
    type: 'ALLY',
    bidirectional: true,
  },
  {
    verbs: /敌对|仇视|憎恨|敌人|对立|对抗|袭击|攻击了/g,
    type: 'ENEMY',
    bidirectional: true,
  },
  {
    verbs: /友好|善待|帮助|救助|款待|欢迎/g,
    type: 'FRIEND',
    bidirectional: false,
  },
  {
    verbs: /爱慕|爱上|爱恋|倾心|爱着|相爱/g,
    type: 'LOVER',
    bidirectional: true,
  },
  {
    verbs: /父子|母子|父女|母女|兄弟|姐妹|亲属|后代|祖先/g,
    type: 'FAMILY',
    bidirectional: true,
  },
  {
    verbs: /竞争|较量|挑战|对决|比试|较劲/g,
    type: 'RIVAL',
    bidirectional: true,
  },
  {
    verbs: /教导|传授|指导|拜师|师从/g,
    type: 'MENTOR',
    bidirectional: false,
  },
  {
    verbs: /位于|坐落|在.*(?:里|中|内)|身处/g,
    type: 'LOCATED_AT',
    bidirectional: false,
  },
  {
    verbs: /来自|出身|起源于|发源于/g,
    type: 'ORIGIN_OF',
    bidirectional: false,
  },
  {
    verbs: /属于|加入|隶属于|归属于/g,
    type: 'PART_OF',
    bidirectional: false,
  },
  {
    verbs: /拥有|持有|掌握|占有|带着/g,
    type: 'OWNS',
    bidirectional: false,
  },
  {
    verbs: /被.*拥有|被.*占有|属于/g,
    type: 'OWED_BY',
    bidirectional: false,
  },
  {
    verbs: /导致|造成|引起|致使|引发了/g,
    type: 'CAUSED_BY',
    bidirectional: false,
  },
  {
    verbs: /触发|启动|激活|开启了/g,
    type: 'TRIGGERED',
    bidirectional: false,
  },
  {
    verbs: /知晓|知道|了解|听说|得知|获悉/g,
    type: 'KNOWS_OF',
    bidirectional: false,
  },
];

// ============================================================
// ExtractedEntity 评分常量
// ============================================================

const CONFIDENCE_HIGH = 0.9;
const CONFIDENCE_MEDIUM = 0.7;
const CONFIDENCE_LOW = 0.5;

// ============================================================
// EntityExtractor 类
// ============================================================

export class EntityExtractor {
  private knownEntityNames: Set<string> = new Set();

  /**
   * 注册已知实体名称（从现有图谱加载），用于去重和置信度提升。
   */
  registerKnownNames(names: string[]): void {
    for (const name of names) {
      this.knownEntityNames.add(name.toLowerCase());
    }
  }

  /**
   * 从文本中提取所有实体。
   *
   * @param text - 待分析文本
   * @param sourceEventId - 来源事件 ID
   * @returns 提取的实体数组（已去重）
   */
  extractEntities(text: string, sourceEventId: string): ExtractedEntity[] {
    const results: ExtractedEntity[] = [];
    const seenNames = new Set<string>();

    // 1. 提取中文人名（姓氏 + 1-2字名 + 可选职位后缀）
    const chineseNames = this.extractChineseNames(text, sourceEventId);
    for (const entity of chineseNames) {
      const key = entity.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push(entity);
      }
    }

    // 2. 提取英文专有名词（连续大写字母开头的词）
    const englishNames = this.extractEnglishNames(text, sourceEventId);
    for (const entity of englishNames) {
      const key = entity.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push(entity);
      }
    }

    // 3. 提取地名
    const locations = this.extractLocations(text, sourceEventId);
    for (const entity of locations) {
      const key = entity.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push(entity);
      }
    }

    // 4. 提取物品
    const items = this.extractItems(text, sourceEventId);
    for (const entity of items) {
      const key = entity.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push(entity);
      }
    }

    // 5. 提取派系/组织
    const factions = this.extractFactions(text, sourceEventId);
    for (const entity of factions) {
      const key = entity.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push(entity);
      }
    }

    return results;
  }

  /**
   * 从文本和已提取的实体中提取关系。
   *
   * @param entities - 已提取的实体
   * @param text - 原文
   * @returns 推断的关系数组
   */
  extractRelations(
    entities: ExtractedEntity[],
    text: string
  ): Omit<Relation, 'id' | 'evidence' | 'establishedAt' | 'lastUpdatedAt'>[] {
    const results: Omit<
      Relation,
      'id' | 'evidence' | 'establishedAt' | 'lastUpdatedAt'
    >[] = [];

    // 至少需要两个实体才能建立关系
    const characterEntities = entities.filter(
      (e) => e.type === 'character' || e.type === 'faction'
    );
    if (characterEntities.length < 2) return results;

    for (const rule of RELATION_VERB_RULES) {
      // 重置 lastIndex
      rule.verbs.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.verbs.exec(text)) !== null) {
        // 在匹配位置附近寻找实体
        const matchPos = match.index;
        const nearbyEntities = this.findNearbyEntities(
          characterEntities,
          text,
          matchPos
        );

        if (nearbyEntities.length >= 2) {
          const from = nearbyEntities[0]!;
          const to = nearbyEntities[1]!;
          // FIX: BUG-2 — 传递实体名称，避免 MemoryEngine 仅凭索引猜测
          results.push({
            fromEntityId: '', // 由 MemoryEngine 填充
            toEntityId: '', // 由 MemoryEngine 填充
            type: rule.type,
            strength: 0.5, // 初始关系强度
            fromEntityName: from.name,
            toEntityName: to.name,
          });

          // 双向关系
          if (rule.bidirectional && nearbyEntities.length >= 2) {
            results.push({
              fromEntityId: '',
              toEntityId: '',
              type: rule.type,
              strength: 0.5,
              fromEntityName: to.name,
              toEntityName: from.name,
            });
          }
        }
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private: 中文人名提取（基于后缀位置匹配）
  // ---------------------------------------------------------------------------

  private extractChineseNames(
    text: string,
    sourceEventId: string
  ): ExtractedEntity[] {
    const results: ExtractedEntity[] = [];
    const seenNames = new Set<string>();

    // 模式1: 姓氏 + 1-2个汉字(名) + 职位后缀
    // 例如: "李队长" (李+队长), "张小铁匠" (张+小+铁匠)
    for (const surname of CHINESE_SURNAMES) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(surname, searchFrom);
        if (idx === -1) break;

        for (const suffix of NPC_TITLE_SUFFIXES) {
          // 姓氏 + 后缀 = 名称（如"李队长"）
          const candidate1 = text.slice(idx, idx + 1 + suffix.length);
          if (candidate1 === surname + suffix) {
            if (!seenNames.has(candidate1)) {
              seenNames.add(candidate1);
              results.push({
                name: candidate1,
                type: 'character',
                attributes: { surname, title: suffix },
                confidence: this.knownEntityNames.has(candidate1.toLowerCase())
                  ? CONFIDENCE_HIGH : CONFIDENCE_MEDIUM,
                sourceEventId,
              });
            }
            break;
          }

          // 姓氏 + 1个汉字(名) + 后缀（如"张小铁匠"）
          if (idx + 2 + suffix.length <= text.length) {
            const midChar = text[idx + 1]!;
            const candidate2 = text.slice(idx, idx + 2 + suffix.length);
            if (
              this.isChineseChar(midChar.charCodeAt(0)) &&
              candidate2.endsWith(suffix) &&
              !seenNames.has(candidate2)
            ) {
              seenNames.add(candidate2);
              results.push({
                name: candidate2,
                type: 'character',
                attributes: { surname, title: suffix },
                confidence: this.knownEntityNames.has(candidate2.toLowerCase())
                  ? CONFIDENCE_HIGH : CONFIDENCE_MEDIUM,
                sourceEventId,
              });
              break;
            }
          }
        }

        searchFrom = idx + 1;
      }
    }

    // 模式2: 纯职位/角色后缀（无姓氏前缀），例如: "守卫队长", "旅店老板"
    for (const suffix of NPC_TITLE_SUFFIXES) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(suffix, searchFrom);
        if (idx === -1) break;

        // 向前查找前缀（最多 2 个汉字，停于标点/空白）
        let start = idx;
        let count = 0;
        while (start > 0 && count < 2) {
          const prev = text.charCodeAt(start - 1);
          if (this.isChineseChar(prev)) {
            start--;
            count++;
          } else {
            break;
          }
        }
        const fullName = text.slice(start, idx + suffix.length);

        if (
          fullName.length >= 2 &&
          fullName.length <= 5 &&
          !seenNames.has(fullName) &&
          !CHINESE_SURNAMES.has(fullName[0]!) &&
          (fullName !== suffix || suffix.length >= 3)
        ) {
          seenNames.add(fullName);
          const confidence = this.knownEntityNames.has(fullName.toLowerCase())
            ? CONFIDENCE_HIGH
            : CONFIDENCE_MEDIUM;

          results.push({
            name: fullName,
            type: 'character',
            attributes: { title: suffix },
            confidence,
            sourceEventId,
          });
        }

        searchFrom = idx + 1;
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private: 英文专有名词提取
  // ---------------------------------------------------------------------------

  private extractEnglishNames(
    text: string,
    sourceEventId: string
  ): ExtractedEntity[] {
    const results: ExtractedEntity[] = [];

    // 连续大写字母开头的词（2-4 词组成的专有名词）
    const pattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]!;
      // 排除全大写缩写词
      if (/^[A-Z]{2,}$/.test(name)) continue;

      const confidence = this.knownEntityNames.has(name.toLowerCase())
        ? CONFIDENCE_HIGH
        : CONFIDENCE_MEDIUM;

      results.push({
        name,
        type: 'character',
        attributes: {},
        confidence,
        sourceEventId,
      });
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private: 地名提取（基于后缀位置匹配）
  // ---------------------------------------------------------------------------

  private extractLocations(
    text: string,
    sourceEventId: string
  ): ExtractedEntity[] {
    const results: ExtractedEntity[] = [];
    const seenNames = new Set<string>();

    for (const suffix of LOCATION_SUFFIXES) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(suffix, searchFrom);
        if (idx === -1) break;

        // 向前查找前缀（最多 2 个汉字，停于标点/空白/非中文字符）
        let start = idx;
        let count = 0;
        while (start > 0 && count < 2) {
          const prev = text.charCodeAt(start - 1);
          if (this.isChineseChar(prev)) {
            start--;
            count++;
          } else {
            break;
          }
        }
        const fullName = text.slice(start, idx + suffix.length);

        if (
          fullName !== suffix &&
          fullName.length >= 2 &&
          fullName.length <= 6 &&
          !seenNames.has(fullName)
        ) {
          seenNames.add(fullName);
          const confidence = this.knownEntityNames.has(fullName.toLowerCase())
            ? CONFIDENCE_HIGH
            : CONFIDENCE_MEDIUM;

          results.push({
            name: fullName,
            type: 'location',
            attributes: { suffix },
            confidence,
            sourceEventId,
          });
        }

        searchFrom = idx + 1;
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private: 物品提取（基于关键词位置匹配）
  // ---------------------------------------------------------------------------

  private extractItems(
    text: string,
    sourceEventId: string
  ): ExtractedEntity[] {
    const results: ExtractedEntity[] = [];
    const seenNames = new Set<string>();

    for (const keyword of ITEM_KEYWORDS) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(keyword, searchFrom);
        if (idx === -1) break;

        // 向前查找修饰词（最多 2 个字符，停于标点/空白/非中文）
        let start = idx;
        let count = 0;
        while (start > 0 && count < 2) {
          const prev = text.charCodeAt(start - 1);
          // 检查是否为中文字符或常见的物品修饰词字符
          if (
            this.isChineseChar(prev) ||
            (prev >= 0x30 && prev <= 0x39) || // 0-9
            prev === 0x2e // .
          ) {
            start--;
            count++;
          } else {
            break;
          }
        }
        const fullName = text.slice(start, idx + keyword.length);

        if (
          fullName.length >= 1 &&
          fullName.length <= 8 &&
          !seenNames.has(fullName)
        ) {
          seenNames.add(fullName);
          const confidence = this.knownEntityNames.has(fullName.toLowerCase())
            ? CONFIDENCE_HIGH
            : CONFIDENCE_LOW;

          results.push({
            name: fullName,
            type: 'item',
            attributes: { keyword },
            confidence,
            sourceEventId,
          });
        }

        searchFrom = idx + 1;
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private: 派系提取（基于后缀位置匹配）
  // ---------------------------------------------------------------------------

  private extractFactions(
    text: string,
    sourceEventId: string
  ): ExtractedEntity[] {
    const results: ExtractedEntity[] = [];
    const seenNames = new Set<string>();

    for (const suffix of FACTION_KEYWORDS) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(suffix, searchFrom);
        if (idx === -1) break;

        // 向前查找前缀（最多 2 个汉字）
        let start = idx;
        let count = 0;
        while (start > 0 && count < 2) {
          const prev = text.charCodeAt(start - 1);
          if (this.isChineseChar(prev)) {
            start--;
            count++;
          } else {
            break;
          }
        }
        const fullName = text.slice(start, idx + suffix.length);

        if (
          fullName !== suffix &&
          fullName.length >= 3 &&
          fullName.length <= 7 &&
          !seenNames.has(fullName)
        ) {
          seenNames.add(fullName);
          const confidence = this.knownEntityNames.has(fullName.toLowerCase())
            ? CONFIDENCE_HIGH
            : CONFIDENCE_MEDIUM;

          results.push({
            name: fullName,
            type: 'faction',
            attributes: { suffix },
            confidence,
            sourceEventId,
          });
        }

        searchFrom = idx + 1;
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private: 辅助方法
  // ---------------------------------------------------------------------------

  /**
   * 判断一个 Unicode code point 是否为中文字符。
   */
  private isChineseChar(codePoint: number): boolean {
    return (
      (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK Unified
      (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK Ext-A
      (codePoint >= 0xf900 && codePoint <= 0xfaff)    // CJK Compat
    );
  }

  /**
   * 判断字符串是否全部由中文字符组成。
   */
  private isAllChinese(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
      if (!this.isChineseChar(str.charCodeAt(i))) {
        return false;
      }
    }
    return str.length > 0;
  }

  /**
   * 在文本中指定位置附近查找实体。
   * 窗口大小：前后各 30 个字符。
   */
  private findNearbyEntities(
    entities: ExtractedEntity[],
    text: string,
    matchPos: number
  ): ExtractedEntity[] {
    const windowStart = Math.max(0, matchPos - 30);
    const windowEnd = Math.min(text.length, matchPos + 30);

    return entities.filter((e) => {
      // 在原文中查找实体名称的位置
      const idx = text.indexOf(e.name, windowStart);
      return idx !== -1 && idx < windowEnd;
    });
  }
}
