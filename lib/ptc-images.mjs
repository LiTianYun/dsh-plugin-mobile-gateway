// PTC 子调用产生的图片只挂在 tool/ptc-dispatch 上，父级 tool/result 的正文只有文本；
// 这里按 rootCallId 暂存，等父结果到达时并回去，让手机能在工具卡片里看到图。
const DEFAULT_LIMIT = 512

export function createPtcImageTracker(limit = DEFAULT_LIMIT) {
  const pending = new Map()
  const keyOf = (sessionId, rootCallId) => `${sessionId}:${rootCallId}`
  return {
    /** 累积某次根调用下各子调用带回的图片，按附件去重 */
    remember(sessionId, rootCallId, images) {
      if (!sessionId || !rootCallId || !Array.isArray(images) || images.length === 0) return
      const key = keyOf(sessionId, rootCallId)
      const merged = (pending.get(key) || []).slice()
      const seen = new Set(merged.map(image => image.attachmentId))
      for (const image of images) {
        if (!image?.attachmentId || seen.has(image.attachmentId)) continue
        seen.add(image.attachmentId)
        merged.push(image)
      }
      pending.set(key, merged)
      // 定长淘汰，避免长会话无限增长
      while (pending.size > limit) {
        const oldest = pending.keys().next()
        if (oldest.done) break
        pending.delete(oldest.value)
      }
    },
    /** 取某次根调用已累积的图片 */
    get(sessionId, rootCallId) {
      if (!sessionId || !rootCallId) return undefined
      return pending.get(keyOf(sessionId, rootCallId))
    },
  }
}
