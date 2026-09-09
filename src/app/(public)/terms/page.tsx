import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'
import { LEGAL_LAST_REVIEWED, LegalSection, LegalContact } from '../legal-page'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The rules for using the KNEST platform — accounts, applications, events and what we do and do not promise.',
}

/** Paired with /privacy: both were footer links with no page behind them. Same caveat — this describes how the platform actually works and should still be reviewed by KIIT before launch. */
export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Terms"
        title="The rules, in plain words."
        lede="What you can expect from KNEST, what we expect from you, and the things we are careful not to promise. Short, because it does not need to be long."
      />

      <Section padding="top">
        <div className="max-w-[68ch]">
          <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Last reviewed {LEGAL_LAST_REVIEWED}.
          </p>

          <LegalSection title="Using this site">
            <p>
              This site is run by KNEST at the School of Innovation &amp; Entrepreneurial Leadership,
              KIIT Deemed to be University. Reading it means these terms apply to you; creating an
              account means you accept them.
            </p>
          </LegalSection>

          <LegalSection title="Your account">
            <ul>
              <li>One account per person, with real details. A program decision made on false information can be reversed.</li>
              <li>Keep your password to yourself. Anything done through your account is treated as done by you.</li>
              <li>You can close your account whenever you want.</li>
              <li>We can suspend an account that is being used to harass people, break the law, or abuse the platform.</li>
            </ul>
          </LegalSection>

          <LegalSection title="Programs and applications">
            <ul>
              <li>Applying is free. Being accepted is not guaranteed, and neither is a place in a later cohort.</li>
              <li>Selection decisions are made by KNEST staff and are final, though we will always tell you the reasoning.</li>
              <li>Programs, dates, cohort sizes and formats can change. If a change affects an application you have already made, we will tell you.</li>
              <li>Nothing here is an offer of admission to KIIT, a grade, a job, funding, or an investment.</li>
            </ul>
          </LegalSection>

          <LegalSection title="What you submit stays yours">
            <p>
              Your idea, your venture, your documents and your writing remain yours. Applying to a
              program does not transfer any intellectual property to KNEST or to KIIT.
            </p>
            <p>
              You do give us permission to read, store and share your submission internally for the
              purpose of reviewing it and running the program. If we ever want to feature your work
              publicly — a startup profile, a founder story, a photograph — we ask first.
            </p>
          </LegalSection>

          <LegalSection title="Mentors and advice">
            <p>
              Mentors volunteer their time. What they give you is experience, not professional advice —
              legal, financial, tax or otherwise — and it does not create an employment, agency,
              partnership or investment relationship with them, with KNEST or with KIIT. Decisions about
              your venture are yours, including the expensive ones.
            </p>
          </LegalSection>

          <LegalSection title="Events">
            <ul>
              <li>Places are limited and registration is first come, first served.</li>
              <li>If you cannot make it, cancel your registration so someone else can have the seat.</li>
              <li>Events can be rescheduled or cancelled. We tell registered attendees as soon as we know.</li>
              <li>Sessions are sometimes photographed or recorded. Tell the organiser if you would rather not appear.</li>
            </ul>
          </LegalSection>

          <LegalSection title="Fair use of the platform">
            <p>
              Do not scrape it, break into it, test its security without asking, upload malware, or use
              other members&rsquo; details for anything they did not agree to. Treat other people here
              the way you would in a room together — this is a university community, and behaviour that
              would not be acceptable on campus is not acceptable here.
            </p>
          </LegalSection>

          <LegalSection title="Availability and liability">
            <p>
              We aim to keep this platform running and accurate, but it is provided as it is. Features
              change, pages occasionally break, and maintenance happens. To the extent the law allows,
              KNEST and KIIT are not liable for indirect or consequential loss arising from your use of
              the site, and nothing here limits liability that cannot lawfully be limited.
            </p>
            <p>These terms are governed by the laws of India.</p>
          </LegalSection>

          <LegalSection title="Changes">
            <p>
              We will update these terms as the platform grows, and date the change on this page.
              Continuing to use the site after a change means the updated terms apply.
            </p>
          </LegalSection>

          <LegalContact>
            <p>
              Anything unclear here, ask before you agree to it:{' '}
              <a
                href="mailto:sujata.acharya@kiit.ac.in"
                className="font-medium text-[var(--color-signal)] underline underline-offset-2"
              >
                sujata.acharya@kiit.ac.in
              </a>
              . See also our{' '}
              <Link href="/privacy" className="underline underline-offset-2">
                privacy notice
              </Link>
              .
            </p>
          </LegalContact>
        </div>
      </Section>
    </>
  )
}
