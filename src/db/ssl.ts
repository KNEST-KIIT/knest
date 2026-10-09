import { readFileSync } from 'node:fs'

export type DatabaseSsl = false | { ca: string; rejectUnauthorized: true }

type Env = { [name: string]: string | undefined }

/**
 * TLS settings for the PostgreSQL connection.
 *
 *  - DATABASE_SSL=off (default): no TLS. Local development and the CI containers.
 *  - DATABASE_SSL=verify: TLS, and the server's certificate is checked against the
 *    authority bundle in DATABASE_SSL_CA_FILE (on AWS, Amazon RDS's global bundle).
 *
 * There is deliberately no "encrypt but do not verify" mode: that protects against
 * eavesdropping on the wire but not against someone answering as the database.
 */
export function databaseSsl(env: Env = process.env): DatabaseSsl {
  if ((env.DATABASE_SSL ?? 'off') !== 'verify') return false
  const file = env.DATABASE_SSL_CA_FILE
  if (!file) throw new Error('DATABASE_SSL=verify needs DATABASE_SSL_CA_FILE (the certificate authority bundle).')
  return { ca: readFileSync(file, 'utf8'), rejectUnauthorized: true }
}
