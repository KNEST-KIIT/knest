import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * A small storage abstraction so application uploads work in dev without AWS
 * credentials and swap to S3 in production by setting env vars — nothing
 * above this file (src/server/applications/actions.ts) knows which backend
 * is active.
 *
 * Local backend writes under a gitignored `uploads/` directory at the repo
 * root. Never used in production: `putFile` throws if S3 isn't configured
 * and NODE_ENV is production, rather than silently writing to local disk on
 * an ephemeral container filesystem.
 */

const s3Configured = Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID)
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export function generateStorageKey(originalName: string): string {
  const ext = path.extname(originalName).slice(0, 10)
  return `${new Date().toISOString().slice(0, 10)}/${randomBytes(16).toString('hex')}${ext}`
}

export async function putFile(key: string, buffer: Buffer): Promise<void> {
  if (s3Configured) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({ region: process.env.S3_REGION })
    await client.send(
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: buffer }),
    )
    return
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('S3 is not configured and local disk storage is disabled in production.')
  }

  const dest = path.join(LOCAL_UPLOAD_DIR, key)
  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, buffer)
}

export async function getFile(key: string): Promise<Buffer> {
  if (s3Configured) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({ region: process.env.S3_REGION })
    const result = await client.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    )
    const bytes = await result.Body?.transformToByteArray()
    if (!bytes) throw new Error(`Empty response reading ${key} from S3`)
    return Buffer.from(bytes)
  }

  return readFile(path.join(LOCAL_UPLOAD_DIR, key))
}
