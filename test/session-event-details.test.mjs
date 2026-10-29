import assert from 'node:assert/strict'
import { assistantFinish, toolResultDetails, turnReasonDetails } from '../lib/session-event-details.mjs'
import { handleQuery } from '../lib/index.mjs'

const tail = '\n[stderr]\nOperation not permitted\n[sandbox: file access denied under workspace-write mode]\n[exit code: 1]'
const output = 'command output\n' + 'x'.repeat(30_000) + tail
const data = { turn: 1, step: 0, message: { toolCallId: 'c', content: [{ type: 'text', text: output }] } }
const details = toolResultDetails(data)
assert.equal(details.outputTruncated, true)
assert.ok(details.output.startsWith('command output\n'))
assert.ok(details.output.endsWith(tail))
assert.ok(details.output.length < 16_100)
assert.equal(toolResultDetails({ message: { content: [
  { type: 'tool-result', isError: true, content: [{ type: 'text', text: 'nested error' }] },
] } }).output, 'nested error')
assert.equal(toolResultDetails({}).output, '')
// 工具结果里的图片要透传，否则手机端看不到工具产出的图
const shot = { attachmentId: 'att-1', mediaType: 'image/png', bytes: 2048, width: 640, height: 480 }
assert.deepEqual(toolResultDetails({ message: { content: [
  { type: 'tool-result', content: [{ type: 'text', text: 'shot' }, { type: 'image', attachment: shot }] },
] } }).images, [shot])
assert.equal(toolResultDetails({ message: { content: [{ type: 'text', text: 'x' }] } }).images, undefined)
assert.equal(assistantFinish({ stream: [{ type: 'text-chunks', texts: ['not a finish'] }] }), undefined)
assert.deepEqual(assistantFinish({ stream: [{ type: 'chunk', chunk: { type: 'finish',
  reason: { kind: 'aborted', failure: { message: 'Cancelled', code: 'ABORTED' } } } }] }),
{ kind: 'aborted', failure: { message: 'Cancelled', code: 'ABORTED' } })
assert.deepEqual(turnReasonDetails({ kind: 'aborted', reason: { kind: 'user' } }),
  { kind: 'aborted', reason: { kind: 'user' } })
const event = { type: 'tool/result', seq: 1, time: 1, data }
const api = { sessions: { history: async () => ({ historyFormatVersion: 4, events: [{ event }] }) } }
const history = await handleQuery(api, null, null, { type: 'history', sessionId: 's', view: 'conversation' })
assert.deepEqual(history.events[0].data.output, details.output)
assert.equal(history.events[0].data.outputTruncated, true)
assert.ok(history.events[0].data.message.content[0].text.length < 2100)
assert.equal(data.message.content[0].text, output)
const shotEvent = { type: 'tool/result', seq: 2, time: 2, data: { turn: 1, step: 0,
  message: { toolCallId: 'c2', content: [{ type: 'image', attachment: shot }] } } }
const shotHistory = await handleQuery(
  { sessions: { history: async () => ({ historyFormatVersion: 4, events: [{ event: shotEvent }] }) } },
  null, null, { type: 'history', sessionId: 's', view: 'conversation' })
assert.deepEqual(shotHistory.events[0].data.images, [shot])
console.log('SESSION EVENT DIAGNOSTICS TESTS PASSED')
