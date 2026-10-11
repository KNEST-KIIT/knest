/**
 * Builds the lab attendance PWA icons from the existing KNEST mark.
 *   node scripts/make-pwa-icons.mjs
 * Output: public/icons/icon-192.png, icon-512.png (any purpose) and icon-maskable-512.png
 * (the mark inside the 80% safe zone so Android can crop it to a circle or squircle).
 * Colours are the brand ink and paper from src/styles/tokens.css.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const INK = '#0d1321'
const source = path.resolve('public/images/knest_icon.png')
const outDir = path.resolve('public/icons')
await mkdir(outDir, { recursive: true })

async function icon(size, markFraction, file) {
  const mark = await sharp(source)
    .resize(Math.round(size * markFraction), Math.round(size * markFraction), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(path.join(outDir, file))
  console.log('wrote', file)
}

await icon(192, 0.72, 'icon-192.png')
await icon(512, 0.72, 'icon-512.png')
await icon(512, 0.56, 'icon-maskable-512.png')
