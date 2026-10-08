/**
 * Starts an ephemeral PostgreSQL 16 and prints its URL, then waits. Ctrl+C removes it.
 * For manual experiments:  pnpm test:db
 */
import { startTestDatabase } from './pg'

const db = await startTestDatabase()
console.log(`TEST_DATABASE_URL=${db.url}`)
const stop = async () => {
  await db.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
