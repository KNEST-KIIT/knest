import 'dotenv/config'
import { seedDummy } from './seed-dummy'
import { assertDemoSeedAllowed } from './seed-policy'

assertDemoSeedAllowed(process.env, 'seed-dummy-runner')

seedDummy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✗ dummy seed failed:', error)
    process.exit(1)
  })
