import { ChangeMessageVisibilityCommand, DeleteMessageCommand, ReceiveMessageCommand, SQSClient, type Message } from '@aws-sdk/client-sqs'
import { documentStorage } from '@/server/storage/documents'
import { scanConfigOrNull } from './scan-config'
import { processScanMessage, sweepOverdue, type Disposition, type MessageContext, type ProcessDeps } from './scan-processor'
import { dbScanNotifier } from './scan-notifier'
import { dbScanStore } from './scan-store'

/**
 * The loop that turns GuardDuty results into document states.
 *
 * GuardDuty -> EventBridge rule -> SQS queue -> this worker (long polling over the instance role, so there is no
 * inbound endpoint and nothing to authenticate). A message is deleted only after its outcome is recorded or it is
 * provably a duplicate; anything else is returned to the queue to be tried again and, if it never settles, lands in
 * the dead-letter queue, which has an alarm. If the process is down, results simply wait in the queue.
 */

export type QueueClient = { send(command: unknown): Promise<unknown> }

export function createScanWorker(deps: {
  queue: QueueClient
  queueUrl: string
  pollWaitSeconds: number
  process: (ctx: MessageContext) => Promise<Disposition>
  sweep: () => Promise<unknown>
  log: (line: string) => void
}) {
  const { queue, queueUrl, pollWaitSeconds, log } = deps

  async function handle(message: Message): Promise<void> {
    const ctx: MessageContext = {
      body: message.Body ?? '',
      sentAt: new Date(Number(message.Attributes?.SentTimestamp) || Date.now()),
      receiveCount: Number(message.Attributes?.ApproximateReceiveCount) || 1,
    }
    let result: Disposition
    try {
      result = await deps.process(ctx)
    } catch (error) {
      log(`malware_scan_process_failed message=${message.MessageId ?? ''} error=${error instanceof Error ? error.message.replace(/\s+/g, '_') : 'unknown'}`)
      result = { disposition: 'retry', retryAfterSeconds: 60, outcome: 'exception' }
    }
    if (result.disposition === 'ack') {
      await queue.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }))
    } else {
      await queue.send(
        new ChangeMessageVisibilityCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle, VisibilityTimeout: result.retryAfterSeconds ?? 60 }),
      )
    }
  }

  return {
    /** One receive call and the handling of what it returned. Returns how many messages it handled. */
    async pollOnce(): Promise<number> {
      const out = (await queue.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: pollWaitSeconds,
          VisibilityTimeout: 120,
          MessageSystemAttributeNames: ['SentTimestamp', 'ApproximateReceiveCount'],
        }),
      )) as { Messages?: Message[] }
      const messages = out.Messages ?? []
      for (const message of messages) await handle(message)
      return messages.length
    },
    async sweepOnce(): Promise<void> {
      await deps.sweep()
    },
  }
}

export function sqsClientConfig(env: Record<string, string | undefined> = process.env) {
  const accessKeyId = env.S3_ACCESS_KEY_ID
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY
  return {
    region: env.S3_REGION,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    ...(env.SQS_ENDPOINT ? { endpoint: env.SQS_ENDPOINT } : {}),
  }
}

const STARTED = Symbol.for('knest.malwareScanWorker')

/** Starts polling in this process. Does nothing when screening is not configured; safe to call twice. */
export function startMalwareScanWorker(): void {
  const g = globalThis as Record<symbol, unknown>
  if (g[STARTED]) return
  const config = scanConfigOrNull()
  const storage = documentStorage()
  if (!config || !storage) return
  g[STARTED] = true

  const log = (line: string) => console.log(line)
  const processDeps: ProcessDeps = { store: dbScanStore, storage, notifier: dbScanNotifier, config, now: () => new Date(), log }
  const worker = createScanWorker({
    queue: new SQSClient(sqsClientConfig(process.env)),
    queueUrl: config.queueUrl,
    pollWaitSeconds: config.pollWaitSeconds,
    process: (ctx) => processScanMessage(ctx, processDeps),
    sweep: () => sweepOverdue(processDeps),
    log,
  })

  const sweep = () => worker.sweepOnce().catch((error) => log(`malware_scan_sweep_failed error=${error instanceof Error ? error.message.replace(/\s+/g, '_') : 'unknown'}`))
  const sweeper = setInterval(sweep, 60_000)
  sweeper.unref?.()

  void (async () => {
    let failures = 0
    for (;;) {
      try {
        const handled = await worker.pollOnce()
        failures = 0
        // With long polling the call itself waits; with a zero wait, avoid spinning on an empty queue.
        if (handled === 0 && config.pollWaitSeconds === 0) await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        failures += 1
        log(`malware_scan_poll_failed failures=${failures} error=${error instanceof Error ? error.message.replace(/\s+/g, '_') : 'unknown'}`)
        await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, 1000 * 2 ** Math.min(failures, 6))))
      }
    }
  })()
}
