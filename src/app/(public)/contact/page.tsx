import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/ui'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { ContactForm } from './contact-form'

export const metadata: Metadata = {
  title: 'Contact KNEST',
  description: 'Send a message to the KNEST team.',
}

// The Turnstile site key is read when the page is served, not when it is built.
export const dynamic = 'force-dynamic'

export default function ContactPage() {
  return (
    <>
      <PageHeader kicker="Contact" title="Get in touch" description="Ask a question, offer to help, or tell us what you need. A person on the KNEST team reads every message." />
      <Section>
        <div className="mx-auto w-full max-w-[640px]">
          <ContactForm turnstileSiteKey={turnstileSiteKey()} />
        </div>
      </Section>
    </>
  )
}
