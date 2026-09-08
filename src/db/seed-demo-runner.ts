import 'dotenv/config'
import { clearDemo, seedDemo } from './seed-demo'

const clear = process.argv.includes('--clear')

;(clear ? clearDemo() : seedDemo())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
