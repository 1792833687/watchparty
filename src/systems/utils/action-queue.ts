/**
 * v4.2.2 全局指令队列 — 纯函数核心（R3 修复的可测化提取）
 *
 * 面板操作（领地/传送/城镇/关系链/低语）统一走 dispatchAction：
 * - AI 正在回复（isLoading）→ 指令入队，本轮结束后串行发送
 * - 空闲 → 立即发送
 * @module systems/utils/action-queue
 */

export interface ActionQueueResult {
  /** 入队后的队列快照 */
  queue: string[];
  /** 空闲时应立即发送的指令（loading 时为空） */
  immediate?: string;
}

/**
 * 指令入队决策纯函数。
 * @param queue 当前队列
 * @param text 待发送指令
 * @param isLoading AI 是否正在回复
 */
export function enqueueAction(queue: string[], text: string, isLoading: boolean): ActionQueueResult {
  if (isLoading) {
    return { queue: [...queue, text] };
  }
  return { queue, immediate: text };
}

/** 出队下一条待发指令（串行执行） */
export function dequeueAction(queue: string[]): { queue: string[]; next?: string } {
  if (queue.length === 0) return { queue };
  const [next, ...rest] = queue;
  return { queue: rest, next };
}
