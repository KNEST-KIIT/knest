// Keeps the copy of scripts/ops/deploy-slot.sh that is embedded in the deploy document (infra/cfn/app.yaml)
// identical to the file. The document cannot include another file, so the script is pasted in at the document's
// indentation between two markers; this rewrites that block, or with --check only reports whether it is current.
//
//   node scripts/sync-deploy-slot.mjs           rewrite the embedded copy
//   node scripts/sync-deploy-slot.mjs --check   exit 1 if the copy differs (the unit suite runs the same comparison)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE = path.join(root, 'infra', 'cfn', 'app.yaml')
const SCRIPT = path.join(root, 'scripts', 'ops', 'deploy-slot.sh')
const START = "cat > /opt/knest/deploy-slot.sh <<'KNEST_DEPLOY_SLOT'"
const END = 'KNEST_DEPLOY_SLOT'
const INDENT = ' '.repeat(18)

const lf = (text) => text.split('\r\n').join('\n')

export function embeddedBlock(script) {
  return lf(script)
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => (line === '' ? '' : INDENT + line))
    .join('\n')
}

export function currentEmbedded(template) {
  const text = lf(template)
  const start = text.indexOf(START)
  if (start < 0) throw new Error('embedded deploy-slot block not found in app.yaml')
  const bodyStart = text.indexOf('\n', start) + 1
  const end = text.indexOf(`\n${INDENT}${END}`, bodyStart)
  if (end < 0) throw new Error('end marker of the embedded deploy-slot block not found')
  return { text, bodyStart, bodyEnd: end }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = readFileSync(TEMPLATE, 'utf8')
  const crlf = raw.includes('\r\n')
  const wanted = embeddedBlock(readFileSync(SCRIPT, 'utf8'))
  const { text, bodyStart, bodyEnd } = currentEmbedded(raw)
  const same = text.slice(bodyStart, bodyEnd) === wanted
  if (process.argv.includes('--check')) {
    if (!same) {
      console.error('The copy of deploy-slot.sh embedded in infra/cfn/app.yaml is out of date. Run: node scripts/sync-deploy-slot.mjs')
      process.exit(1)
    }
    console.log('embedded deploy-slot.sh is current')
  } else if (same) {
    console.log('embedded deploy-slot.sh already current')
  } else {
    const next = text.slice(0, bodyStart) + wanted + text.slice(bodyEnd)
    writeFileSync(TEMPLATE, crlf ? next.split('\n').join('\r\n') : next)
    console.log('embedded deploy-slot.sh updated')
  }
}
