/**
 * 叙事渲染器解析测试 — v4.1.0（AI 旁白/对话可视化区分）
 */
import { describe, expect, it } from 'vitest';
import { parseNarrativeSegments } from '@/components/game/NarrativeRenderer';

describe('NarrativeRenderer 段落解析', () => {
  it('纯旁白文本 → 单个 narration 段', () => {
    const segs = parseNarrativeSegments('晨光越过雪线，洒在要塞城墙上。');
    expect(segs).toHaveLength(1);
    expect(segs[0]!.type).toBe('narration');
  });

  it('「」引号对话识别为 dialogue', () => {
    const segs = parseNarrativeSegments('老学士说：「编年史需要你的名字。」');
    expect(segs.some((s) => s.type === 'dialogue' && s.text === '编年史需要你的名字。')).toBe(true);
  });

  it('带说话人前缀时提取 speaker', () => {
    const segs = parseNarrativeSegments('塔林说：「来喝酒吧。」');
    const dialogue = segs.find((s) => s.type === 'dialogue');
    expect(dialogue?.speaker).toBe('塔林');
    expect(dialogue?.text).toBe('来喝酒吧。');
  });

  it('多种说话动词均可识别（喊道/低语/怒吼）', () => {
    expect(parseNarrativeSegments('罗兰怒吼：「为了要塞！」').find((s) => s.type === 'dialogue')?.speaker).toBe('罗兰');
    expect(parseNarrativeSegments('艾琳低语：「星语池在呼唤。」').find((s) => s.type === 'dialogue')?.speaker).toBe('艾琳');
    expect(parseNarrativeSegments('格朗喊道：「你们都会付出代价！」').find((s) => s.type === 'dialogue')?.speaker).toBe('格朗');
  });

  it('双引号 "" 同样识别为对话', () => {
    const segs = parseNarrativeSegments('She said "hello world".');
    expect(segs.some((s) => s.type === 'dialogue' && s.text === 'hello world')).toBe(true);
  });

  it('旁白与对话混合时顺序正确', () => {
    const segs = parseNarrativeSegments('你推开门。罗兰说：「小心！」你握紧了剑。');
    const types = segs.map((s) => s.type);
    expect(types).toEqual(['narration', 'dialogue', 'narration']);
    expect(segs[1]!.speaker).toBe('罗兰');
  });

  it('多段对话均被解析', () => {
    const segs = parseNarrativeSegments('甲说：「一。」乙说：「二。」');
    const dialogues = segs.filter((s) => s.type === 'dialogue');
    expect(dialogues).toHaveLength(2);
    expect(dialogues[0]!.speaker).toBe('甲');
    expect(dialogues[1]!.speaker).toBe('乙');
  });

  it('无引号的文本不产生 dialogue 段', () => {
    const segs = parseNarrativeSegments('风声呼啸，远处传来战鼓。');
    expect(segs.every((s) => s.type === 'narration')).toBe(true);
  });

  it('空文本返回空数组', () => {
    expect(parseNarrativeSegments('')).toEqual([]);
    expect(parseNarrativeSegments(null as unknown as string)).toEqual([]);
  });
});
