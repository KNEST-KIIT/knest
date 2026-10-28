import { createHash, randomUUID } from 'node:crypto'
import http from 'node:http'

/**
 * A small Amazon SQS stand-in for tests (the JSON 1.0 protocol the AWS SDK v3 speaks; no authentication).
 *
 * It models what the verdict worker depends on: ReceiveMessage with long polling, a visibility timeout, an
 * incrementing ApproximateReceiveCount, SentTimestamp, DeleteMessage, ChangeMessageVisibility, and redrive to a
 * dead-letter queue once a message has been received maxReceiveCount times. It does not model anything else.
 *
 * Test hooks (HTTP, so tests in other processes can use them):
 *   GET  /__stub/queue?name=<queue>        { visible, inFlight, total, messages: [{body, receiveCount, visible}] }
 *   POST /__stub/send  {queue, body}       puts a raw message body on a queue (forged or malformed events)
 */

export type SqsStub = {
  port: number
  endpoint: string
  /** Queue URL as the application would be configured with it. */
  queueUrl: (name: string) => string
  createQueue: (name: string, options?: { deadLetterQueue?: string; maxReceiveCount?: number; defaultVisibilitySeconds?: number }) => void
  send: (name: string, body: string) => void
  snapshot: (name: string) => { visible: number; inFlight: number; total: number; bodies: string[]; messages: { body: string; receiveCount: number; visible: boolean }[] }
  close: () => Promise<void>
}

type Message = {
  id: string
  body: string
  sentAt: number
  receiveCount: number
  firstReceivedAt?: number
  invisibleUntil: number
  handle?: string
}
type Queue = { messages: Message[]; deadLetterQueue?: string; maxReceiveCount: number; defaultVisibilitySeconds: number }

export function startSqsStub(): Promise<SqsStub> {
  const queues = new Map<string, Queue>()
  let port = 0

  const queueOf = (name: string): Queue => {
    const queue = queues.get(name)
    if (!queue) throw Object.assign(new Error(`The specified queue does not exist: ${name}`), { code: 'AWS.SimpleQueueService.NonExistentQueue' })
    return queue
  }
  const nameFromUrl = (queueUrl: string) => new URL(queueUrl).pathname.split('/').filter(Boolean).pop() ?? ''

  const send = (name: string, body: string) => {
    queueOf(name).messages.push({ id: randomUUID(), body, sentAt: Date.now(), receiveCount: 0, invisibleUntil: 0 })
  }

  /** Moves messages that have been received too many times to the dead-letter queue. */
  const redrive = (name: string) => {
    const queue = queueOf(name)
    if (!queue.deadLetterQueue) return
    const now = Date.now()
    const keep: Message[] = []
    for (const message of queue.messages) {
      if (message.receiveCount >= queue.maxReceiveCount && message.invisibleUntil <= now) {
        queueOf(queue.deadLetterQueue).messages.push({ ...message, receiveCount: 0, invisibleUntil: 0, handle: undefined })
      } else keep.push(message)
    }
    queue.messages = keep
  }

  const respond = (res: http.ServerResponse, status: number, body: unknown, errorType?: string) => {
    res.writeHead(status, { 'content-type': 'application/x-amz-json-1.0', ...(errorType ? { 'x-amzn-query-error': `${errorType};Sender` } : {}) })
    res.end(JSON.stringify(body))
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub')
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', async () => {
      const raw = Buffer.concat(chunks).toString('utf8')

      if (url.pathname === '/__stub/queue') {
        const name = url.searchParams.get('name') ?? ''
        const snap = queues.has(name) ? snapshot(name) : { visible: 0, inFlight: 0, total: 0, bodies: [], messages: [] }
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(snap))
        return
      }
      if (url.pathname === '/__stub/send' && req.method === 'POST') {
        const { queue, body } = JSON.parse(raw) as { queue: string; body: string }
        send(queue, body)
        res.writeHead(204).end()
        return
      }

      const target = String(req.headers['x-amz-target'] ?? '')
      const action = target.split('.').pop() ?? ''
      let input: Record<string, unknown> = {}
      try {
        input = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      } catch {
        return respond(res, 400, { __type: 'InvalidParameterValue', message: 'body is not JSON' }, 'InvalidParameterValue')
      }

      try {
        const name = typeof input.QueueUrl === 'string' ? nameFromUrl(input.QueueUrl) : ''
        if (action === 'ReceiveMessage') {
          const queue = queueOf(name)
          const max = Math.min(10, Math.max(1, Number(input.MaxNumberOfMessages ?? 1)))
          const wait = Math.min(20, Math.max(0, Number(input.WaitTimeSeconds ?? 0)))
          const visibility = input.VisibilityTimeout !== undefined ? Number(input.VisibilityTimeout) : queue.defaultVisibilitySeconds
          const deadline = Date.now() + wait * 1000
          for (;;) {
            redrive(name)
            const now = Date.now()
            const ready = queue.messages.filter((m) => m.invisibleUntil <= now).slice(0, max)
            if (ready.length > 0) {
              const out = ready.map((m) => {
                m.receiveCount += 1
                m.firstReceivedAt ??= now
                m.invisibleUntil = now + visibility * 1000
                m.handle = randomUUID()
                return {
                  MessageId: m.id,
                  ReceiptHandle: m.handle,
                  MD5OfBody: createHash('md5').update(m.body).digest('hex'),
                  Body: m.body,
                  Attributes: {
                    SentTimestamp: String(m.sentAt),
                    ApproximateReceiveCount: String(m.receiveCount),
                    ApproximateFirstReceiveTimestamp: String(m.firstReceivedAt),
                  },
                }
              })
              return respond(res, 200, { Messages: out })
            }
            if (Date.now() >= deadline || req.destroyed) return respond(res, 200, {})
            await new Promise((r) => setTimeout(r, 50))
          }
        }
        if (action === 'DeleteMessage') {
          const queue = queueOf(name)
          queue.messages = queue.messages.filter((m) => m.handle !== input.ReceiptHandle)
          return respond(res, 200, {})
        }
        if (action === 'ChangeMessageVisibility') {
          const found = queueOf(name).messages.find((m) => m.handle === input.ReceiptHandle)
          if (found) found.invisibleUntil = Date.now() + Number(input.VisibilityTimeout ?? 0) * 1000
          return respond(res, 200, {})
        }
        if (action === 'GetQueueAttributes') return respond(res, 200, { Attributes: { ApproximateNumberOfMessages: String(snapshot(name).visible) } })
        return respond(res, 400, { __type: 'InvalidAction', message: `${action} is not supported by the stand-in` }, 'InvalidAction')
      } catch (error) {
        const code = (error as { code?: string }).code ?? 'InternalError'
        return respond(res, 400, { __type: code, message: error instanceof Error ? error.message : 'error' }, code)
      }
    })
  })

  const snapshot = (name: string) => {
    redrive(name)
    const now = Date.now()
    const queue = queueOf(name)
    return {
      visible: queue.messages.filter((m) => m.invisibleUntil <= now).length,
      inFlight: queue.messages.filter((m) => m.invisibleUntil > now).length,
      total: queue.messages.length,
      bodies: queue.messages.map((m) => m.body),
      messages: queue.messages.map((m) => ({ body: m.body, receiveCount: m.receiveCount, visible: m.invisibleUntil <= now })),
    }
  }

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as import('node:net').AddressInfo).port
      resolve({
        port,
        endpoint: `http://127.0.0.1:${port}`,
        queueUrl: (name) => `http://127.0.0.1:${port}/000000000000/${name}`,
        createQueue: (name, options = {}) => {
          queues.set(name, {
            messages: [],
            deadLetterQueue: options.deadLetterQueue,
            maxReceiveCount: options.maxReceiveCount ?? 5,
            defaultVisibilitySeconds: options.defaultVisibilitySeconds ?? 30,
          })
        },
        send,
        snapshot,
        close: () => new Promise<void>((done) => { server.closeAllConnections?.(); server.close(() => done()) }),
      })
    })
  })
}
