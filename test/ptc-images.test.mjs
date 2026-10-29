import assert from 'node:assert/strict'
import { createPtcImageTracker } from '../lib/ptc-images.mjs'
import { buildWireEvent } from '../lib/index.mjs'

const image = (id, name) => ({ type: 'image', attachment: { attachmentId: id, mediaType: 'image/png', bytes: 10, width: 2, height: 2, name } })

// 追踪器：累积、去重、定长淘汰
const tracker = createPtcImageTracker(2)
tracker.remember('s1', 'c1', [{ attachmentId: 'a' }])
tracker.remember('s1', 'c1', [{ attachmentId: 'a' }, { attachmentId: 'b' }])
assert.deepEqual(tracker.get('s1', 'c1').map(i => i.attachmentId), ['a', 'b'])
assert.equal(tracker.get('s1', 'nope'), undefined)
tracker.remember('s1', 'c2', [{ attachmentId: 'c' }])
tracker.remember('s1', 'c3', [{ attachmentId: 'd' }])
assert.equal(tracker.get('s1', 'c1'), undefined, '超限后淘汰最旧的根调用')
assert.deepEqual(tracker.get('s1', 'c3').map(i => i.attachmentId), ['d'])

// 事件投影：子调用图片并回父工具的 tool/result
const session = { id: 'session-ptc' }
const dispatch = buildWireEvent(session, {
  type: 'tool/ptc-dispatch', seq: 1, time: 1,
  data: { rootCallId: 'call-root', subCallId: 'call-root:ptc:1', name: 'read_image', content: [
    { type: 'text', text: '<type>image</type>' }, image('sha256:one', 'one.png')] },
})
assert.equal(dispatch.event.type, 'tool/ptc-dispatch')

const result = buildWireEvent(session, {
  type: 'tool/result', seq: 2, time: 2,
  data: { turn: 1, step: 1, message: { role: 'tool', toolCallId: 'call-root', content: [{ type: 'text', text: 'done' }] } },
})
assert.equal(result.event.type, 'tool/result')
assert.equal(result.event.callId, 'call-root')
assert.equal(result.event.output, 'done')
assert.deepEqual(result.event.images.map(i => i.attachmentId), ['sha256:one'], '子调用图片必须出现在父工具结果上')
assert.equal(result.event.images[0].mediaType, 'image/png')

// 没有子调用图片时不应出现 images 字段
const plain = buildWireEvent(session, {
  type: 'tool/result', seq: 3, time: 3,
  data: { turn: 1, step: 1, message: { role: 'tool', toolCallId: 'call-plain', content: [{ type: 'text', text: 'ok' }] } },
})
assert.equal(plain.event.images, undefined)

console.log('PASS PTC images: 累积去重、定长淘汰、并回父工具结果、无图不产生字段')
