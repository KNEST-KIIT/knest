import 'dotenv/config'
import { seedDummy } from './seed-dummy'

seedDummy().then(() => process.exit(0)).catch(console.error)
