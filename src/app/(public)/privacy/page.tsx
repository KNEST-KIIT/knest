import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'
import { LEGAL_LAST_REVIEWED, LegalSection, LegalContact } from '../legal-page'

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What KNEST collects when you use this site, why, who can see it, and how to have it removed.',
}

/**
 * This page and /terms existed as links in the site footer for three phases
 * with no route behind them — every visitor who clicked either got a 404 on
 * the two pages a person checks precisely when they have started to doubt
 * you. The copy describes what this codebase actually does: the fields on
 * `app.users`, the first-party analytics in `src/server/analytics/track.ts`,
 * the two cookies that are really set, and nothing else. It should still be
 * read by whoever owns data protection at KIIT before launch — accuracy
 * about the system is not the same thing as legal sign-off.
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="What we know about you."
        lede="KNEST is run by a university, not an advertising business. We collect what running programs actually requires, and we would rather tell you exactly what that is than write three pages that avoid the question."
      />

      <Section padding="top">
        <div className="max-w-[68ch]">
          <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Last reviewed {LEGAL_LAST_REVIEWED}.
          </p>

          <LegalSection title="Who this covers">
            <p>
              This notice covers this website and the account behind it, run by KNEST at the School of
              Innovation &amp; Entrepreneurial Leadership, KIIT Deemed to be University, Bhubaneswar.
            </p>
            <p>
              You can read almost all of this site — programs, startups, events, resources, mentors —
              without an account and without telling us who you are.
            </p>
          </LegalSection>

          <LegalSection title="What we collect">
            <ul>
              <li>
                <strong>Your account.</strong> Email address, name, and a password stored only as a
                one-way hash. If you sign in with Google, we receive your email, name and profile
                picture from Google instead, and never see your Google password.
              </li>
              <li>
                <strong>Your profile.</strong> Whatever you choose to add during onboarding — school,
                graduation year, bio, skills, interests, goals, links. All of it is optional except the
                parts a program application specifically asks for.
              </li>
              <li>
                <strong>Your applications.</strong> Your answers, the documents you upload, and the
                status history of each application.
              </li>
              <li>
                <strong>Your participation.</strong> Events you register for, and notifications sent to
                you.
              </li>
              <li>
                <strong>Usage.</strong> A small server-side record of key actions — a page viewed, a
                search run, an application started or submitted — so we can tell which parts of this
                site help and which waste your time.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="Cookies">
            <p>
              Two, both first-party. One keeps you signed in. One is a random visit identifier used for
              the usage record described above. There are no advertising cookies, no third-party
              analytics scripts, and nothing on this site reports your behaviour to another company.
            </p>
          </LegalSection>

          <LegalSection title="What we use it for">
            <ul>
              <li>Running your account and keeping you signed in.</li>
              <li>Reviewing applications and telling you the outcome.</li>
              <li>Managing event registrations and capacity.</li>
              <li>Sending you email that relates to something you did — verification, password resets, application updates, event confirmations.</li>
              <li>Understanding, in aggregate, how the site is used so we can fix what is not working.</li>
            </ul>
            <p>
              We do not sell your data. We do not share it with advertisers. We do not use it to train
              anything.
            </p>
          </LegalSection>

          <LegalSection title="Who can see it">
            <ul>
              <li>
                <strong>You,</strong> through your dashboard and profile.
              </li>
              <li>
                <strong>KNEST staff</strong> reviewing applications, running programs and operating the
                platform. Staff access is role-based and every review action is logged.
              </li>
              <li>
                <strong>Other members,</strong> only as far as your profile visibility setting allows.
                You control that setting and can change it at any time.
              </li>
              <li>
                <strong>Nobody else,</strong> unless you ask us to make an introduction, or the law
                requires it.
              </li>
            </ul>
            <p>
              Mentors do not get your application. If you are matched with one, they see what you choose
              to tell them.
            </p>
          </LegalSection>

          <LegalSection title="Where it lives and how long we keep it">
            <p>
              Data is held in KNEST&rsquo;s own database and file storage on managed cloud
              infrastructure, and email is sent through a transactional email provider. Nothing is
              hosted with a third party that gets to use it for its own purposes.
            </p>
            <p>
              Account and profile data is kept while your account exists. Applications and their
              decisions are kept as a record of the program that ran. Usage records are kept in
              aggregate. Ask us to delete your account and we will remove your personal data, keeping
              only what a university has to keep about a selection decision it made.
            </p>
          </LegalSection>

          <LegalSection title="Your choices">
            <ul>
              <li>Correct anything in your profile yourself, at any time.</li>
              <li>Change who can see your profile, or make it private.</li>
              <li>Withdraw an application before a decision is made.</li>
              <li>Ask for a copy of your data, or ask us to delete your account.</li>
            </ul>
            <p>
              Email that relates to your account — a password reset, an application decision — is not
              marketing and cannot be turned off while the account is open.
            </p>
          </LegalSection>

          <LegalSection title="Changes">
            <p>
              If this notice changes in a way that affects you, we will say so on this page and date it.
              Continuing to use the site after that means the updated notice applies.
            </p>
          </LegalSection>

          <LegalContact>
            <p>
              Questions about any of this, or a request to see or delete your data, go to{' '}
              <a
                href="mailto:sujata.acharya@kiit.ac.in"
                className="font-medium text-[var(--color-signal)] underline underline-offset-2"
              >
                sujata.acharya@kiit.ac.in
              </a>
              . See also our{' '}
              <Link href="/terms" className="underline underline-offset-2">
                terms of use
              </Link>
              .
            </p>
          </LegalContact>
        </div>
      </Section>
    </>
  )
}
