/** Add questions only to an empty fictional local demo program. Never reset applications. */
import { getPayload } from 'payload'
import config from '../src/payload/payload.config'
import { assertDemoSeedAllowed } from '../src/db/seed-policy'

assertDemoSeedAllowed(process.env, 'seed-local-journey')
const database = new URL(process.env.DATABASE_URL!)
if (database.hostname !== '127.0.0.1' || database.pathname !== '/knest_local_test') throw new Error('Dedicated local sandbox required')
const payload = await getPayload({ config })
const found = await payload.find({ collection: 'programs', where: { slug: { equals: 'validation-bootcamp' } }, limit: 1, overrideAccess: true })
const program = found.docs[0]
if (program && (!program.applicationQuestions?.length || program.applicationStatus !== 'open')) {
  await payload.update({ collection: 'programs', id: program.id, overrideAccess: true, data: {
    applicationStatus: 'open',
    _status: 'published',
    applicationQuestions: program.applicationQuestions?.length ? program.applicationQuestions : [
      { label: 'What is your idea called?', fieldType: 'text', required: true, maxLength: 120, helpText: 'A working name is fine. You can explain the idea next.' },
      { label: 'What problem are you solving?', fieldType: 'textarea', required: true, maxLength: 1000, helpText: 'Tell us who faces the problem and what you want to test.' },
      { label: 'How far along are you?', fieldType: 'select', required: true, options: [{ label: 'Just an idea', value: 'idea' }, { label: 'Testing with people', value: 'testing' }, { label: 'Working prototype', value: 'prototype' }] },
      { label: 'What support would help?', fieldType: 'multiselect', required: true, options: [{ label: 'Customer research', value: 'research' }, { label: 'Mentoring', value: 'mentoring' }, { label: 'Building a prototype', value: 'prototype' }] },
      { label: 'Do you have a website or demo link?', fieldType: 'url', required: false, helpText: 'Optional. Include https://, or leave this blank.' },
      { label: 'Share a short concept note', fieldType: 'file', required: true, helpText: 'For local testing, upload a fictional PDF you create locally. This is a demo requirement only.' },
    ],
  } })
  console.log('Local Validation Bootcamp: six demo questions added. Existing applications preserved.')
} else console.log('Existing local question set preserved.')
process.exit(0)
