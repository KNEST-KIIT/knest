import { getPayload } from 'payload'
import config from '@/payload/payload.config'

export async function seedDummy() {
  const payload = await getPayload({ config })
  
  const dummyPrograms = [
    { title: 'Ignite Ideation Lab', slug: 'ignite-ideation', stage: 'exploring', description: 'Brainstorming and sparking ideas.' },
    { title: 'Validation Bootcamp', slug: 'validation-bootcamp', stage: 'idea', description: 'Architectural blueprints turning into a solid object.' },
    { title: 'Prototype Studio', slug: 'prototype-studio', stage: 'idea', description: 'Building the first iteration.' },
    { title: 'MVP Builders Program', slug: 'mvp-builders', stage: 'mvp', description: 'Building and coding a glowing geometric structure.' },
    { title: 'Launchpad Accelerator', slug: 'launchpad-accelerator', stage: 'mvp', description: 'Deploying your MVP to real users.' },
    { title: 'Scale-Up Fellowship', slug: 'scale-up-fellowship', stage: 'scaling', description: 'A massive, towering structure extending upwards.' },
    { title: 'Series A Prep', slug: 'series-a-prep', stage: 'scaling', description: 'Preparing for institutional capital.' }
  ]

  for (const prog of dummyPrograms) {
    const existing = await payload.find({
      collection: 'programs',
      where: { slug: { equals: prog.slug } }
    })
    if (existing.totalDocs === 0) {
      await payload.create({
        collection: 'programs',
        data: {
          title: prog.title,
          slug: prog.slug,
          tagline: prog.description,
          whoItsFor: {
            root: {
              type: 'root',
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  children: [
                    {
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: 'This program is for early stage founders.',
                      type: 'text',
                      version: 1
                    }
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  type: 'paragraph',
                  version: 1
                }
              ]
            }
          },
          stage: [prog.stage],
          publishedAt: new Date().toISOString(),
          status: 'published',
          _status: 'published',
        } as any,
      })
    }
  }
  console.log('Dummy programs seeded')
}
