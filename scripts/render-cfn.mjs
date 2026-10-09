#!/usr/bin/env node
// Renders the environment variants of the CloudFormation templates from one source.
//
//   node scripts/render-cfn.mjs <s1|production> <app|ci> > rendered.yaml
//
// The templates in infra/cfn are written for production: databases are snapshotted
// and buckets and registries are kept when a stack is deleted. Lines ending in
// "# DELETION" are the only ones that differ for the disposable S-1 spike, where the
// stack must delete everything, including the database (no final snapshot), so that
// the automated teardown leaves nothing behind. Keeping one source means the spike
// tests the same template that production runs.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function render(text, variant) {
  if (variant === 'production') return text
  if (variant !== 's1') throw new Error('variant must be s1 or production')
  return text.replace(/^(\s*(?:DeletionPolicy|UpdateReplacePolicy): )(?:Snapshot|Retain|Delete)( # DELETION)$/gm, '$1Delete$2')
}

function main() {
  const [variant, name] = process.argv.slice(2)
  if (!variant || !['app', 'ci'].includes(name ?? '')) {
    console.error('usage: node scripts/render-cfn.mjs <s1|production> <app|ci>')
    process.exit(2)
  }
  const source = readFileSync(new URL('../infra/cfn/' + name + '.yaml', import.meta.url), 'utf8')
  process.stdout.write(render(source, variant))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
