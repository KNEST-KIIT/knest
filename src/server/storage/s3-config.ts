type Env = { [name: string]: string | undefined }

/**
 * One place that turns the S3_* variables into S3 client settings, used by document
 * storage (src/server/storage) and by the CMS media plugin (payload.config.ts).
 *
 *  - Credentials are optional: with none set, the AWS SDK's default chain finds the
 *    EC2 instance role, so no long-lived key has to be stored on AWS.
 *  - S3_ENDPOINT (optional) points at an S3-compatible service, with path-style
 *    addressing. The test suite uses it to talk to a local stub.
 */
export function s3ClientConfig(env: Env = process.env) {
  const accessKeyId = env.S3_ACCESS_KEY_ID
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY
  const endpoint = env.S3_ENDPOINT || undefined
  return {
    region: env.S3_REGION,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  }
}
