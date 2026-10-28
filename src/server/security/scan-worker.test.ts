import { describe, expect, it } from 'vitest'
import { createScanWorker, sqsClientConfig } from './scan-worker'
import type { Disposition, MessageContext } from './scan-processor'

type Sent = { name: string; input: Record<string, unknown> }
function fakeQueue(messages: Record<string, unknown>[] = []) {
  const calls: Sent[] = []
  let delivered = false
  return {
    calls,
    queue: {
      send: async (command: unknown) => {
        const c = command as { constructor: { name: string }; input: Record<string, unknown> }
        calls.push({ name: c.constructor.name, input: c.input })
        if (c.constructor.name === 'ReceiveMessageCommand') {
          if (delivered) return {}
          delivered = true
          return messages.length ? { Messages: messages } : {}
        }
        return {}
      },
    },
  }
}
const message = (id: string, body = '{}', attrs: Record<string, string> = {}) => ({
  MessageId: id,
  ReceiptHandle: `handle-${id}`,
  Body: body,
  Attributes: { SentTimestamp: '1790000000000', ApproximateReceiveCount: '2', ...attrs },
})

function worker(
  q: ReturnType<typeof fakeQueue>,
  process: (ctx: MessageContext) => Promise<Disposition>,
  logs: string[] = [],
) {
  return createScanWorker({ queue: q.queue, queueUrl: 'https://sqs.example/q', pollWaitSeconds: 20, process, sweep: async () => undefined, log: (l) => logs.push(l) })
}

describe('the verdict worker', () => {
  it('long-polls with the attributes it needs and a visibility window long enough to finish', async () => {
    const q = fakeQueue()
    expect(await worker(q, async () => ({ disposition: 'ack', outcome: 'x' })).pollOnce()).toBe(0)
    expect(q.calls[0]!.name).toBe('ReceiveMessageCommand')
    expect(q.calls[0]!.input).toMatchObject({
      QueueUrl: 'https://sqs.example/q',
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 120,
      MessageSystemAttributeNames: ['SentTimestamp', 'ApproximateReceiveCount'],
    })
  })

  it('deletes a message only after it is processed to an acknowledgement', async () => {
    const q = fakeQueue([message('1', 'body-1')])
    const seen: MessageContext[] = []
    const handled = await worker(q, async (ctx) => {
      seen.push(ctx)
      expect(q.calls.map((c) => c.name)).toEqual(['ReceiveMessageCommand']) // nothing deleted yet
      return { disposition: 'ack', outcome: 'decided:clean' }
    }).pollOnce()
    expect(handled).toBe(1)
    expect(seen[0]).toMatchObject({ body: 'body-1', receiveCount: 2 })
    expect(seen[0]!.sentAt.getTime()).toBe(1790000000000)
    expect(q.calls.map((c) => c.name)).toEqual(['ReceiveMessageCommand', 'DeleteMessageCommand'])
    expect(q.calls[1]!.input).toEqual({ QueueUrl: 'https://sqs.example/q', ReceiptHandle: 'handle-1' })
  })

  it('returns a message it could not settle to the queue, after the delay it asked for, without deleting it', async () => {
    const q = fakeQueue([message('1')])
    await worker(q, async () => ({ disposition: 'retry', retryAfterSeconds: 45, outcome: 'tag-not-yet-present' })).pollOnce()
    expect(q.calls.map((c) => c.name)).toEqual(['ReceiveMessageCommand', 'ChangeMessageVisibilityCommand'])
    expect(q.calls[1]!.input).toEqual({ QueueUrl: 'https://sqs.example/q', ReceiptHandle: 'handle-1', VisibilityTimeout: 45 })
    expect(q.calls.some((c) => c.name === 'DeleteMessageCommand')).toBe(false)
  })

  it('treats an exception while processing as "try again later", never as success', async () => {
    const q = fakeQueue([message('1'), message('2')])
    const logs: string[] = []
    let n = 0
    await worker(
      q,
      async () => {
        if (++n === 1) throw new Error('database\nunreachable')
        return { disposition: 'ack', outcome: 'decided:clean' }
      },
      logs,
    ).pollOnce()
    expect(q.calls.map((c) => c.name)).toEqual(['ReceiveMessageCommand', 'ChangeMessageVisibilityCommand', 'DeleteMessageCommand'])
    expect(q.calls[1]!.input.VisibilityTimeout).toBe(60)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/^malware_scan_process_failed message=1 error=database_unreachable$/)
  })

  it('handles a message with a missing body or attributes without crashing', async () => {
    const q = fakeQueue([{ MessageId: 'x', ReceiptHandle: 'h' }])
    const seen: MessageContext[] = []
    await worker(q, async (ctx) => (seen.push(ctx), { disposition: 'retry', outcome: 'rejected' })).pollOnce()
    expect(seen[0]).toMatchObject({ body: '', receiveCount: 1 })
  })

  it('runs the overdue sweep on request', async () => {
    let swept = 0
    const w = createScanWorker({ queue: fakeQueue().queue, queueUrl: 'u', pollWaitSeconds: 0, process: async () => ({ disposition: 'ack', outcome: '' }), sweep: async () => void swept++, log: () => undefined })
    await w.sweepOnce()
    expect(swept).toBe(1)
  })
})

describe('the queue client settings', () => {
  it('uses the instance role on AWS and a local endpoint only when one is configured', () => {
    expect(sqsClientConfig({ S3_REGION: 'ap-south-1' })).toEqual({ region: 'ap-south-1', credentials: undefined })
    expect(sqsClientConfig({ S3_REGION: 'ap-south-1', SQS_ENDPOINT: 'http://127.0.0.1:9324', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' })).toEqual({
      region: 'ap-south-1',
      credentials: { accessKeyId: 'k', secretAccessKey: 's' },
      endpoint: 'http://127.0.0.1:9324',
    })
  })
})
