/**
 * Generates the KNEST commercial documents (development invoice + AMC
 * proposal) as print-ready A4 HTML.
 *
 *   node docs/commercial/generate.mjs
 *
 * Edit the data blocks below and re-run — the totals, subtotals and section
 * numbering are computed, never typed by hand.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Enhancement hours bundled into the AMC fee. */
const AMC_HOURS = 16
/** Rate for enhancement work beyond the bundled hours. */
const AMC_HOURLY = 700

/* ------------------------------------------------------------------ parties */

const VENDOR = {
  name: '«Your Name / Studio Name»',
  tagline: 'Product engineering & design',
  address: ['«Street address»', '«City, State — PIN»', 'India'],
  email: '«you@example.com»',
  phone: '«+91 XXXXX XXXXX»',
  pan: '«PAN»',
  gstin: '«GSTIN — delete this line if unregistered»',
}

const CLIENT = {
  name: 'KNEST',
  sub: 'KIIT Nest — Innovation & Entrepreneurship Ecosystem',
  address: [
    'Kalinga Institute of Industrial Technology',
    'Patia, Bhubaneswar, Odisha — 751024',
    'India',
  ],
  attn: 'Attn: «Name, Designation»',
}

const BANK = {
  holder: '«Account holder name»',
  bank: '«Bank name, Branch»',
  account: '«Account number»',
  ifsc: '«IFSC»',
  upi: '«upi-id@bank»',
}

/* -------------------------------------------------------- development scope */

const DEV_SECTIONS = [
  {
    title: 'Foundation & Design System',
    note: 'The base both platforms are built on.',
    items: [
      ['Project foundation', 'Next.js 16 App Router on TypeScript strict mode, with the code standards, type generation and build pipeline the rest of the work depends on.', 2000],
      ['Data architecture', 'One PostgreSQL database split into two schemas — editorial content kept apart from operational records — so the CMS never becomes the backend.', 2400],
      ['Schema, migrations & seed tooling', '8 schema modules, versioned migrations and seeding scripts for first-run and demo data.', 2200],
      ['Design system & token pipeline', 'Colour, typography, spacing, border and motion rules built as design tokens, so both platforms look like one product.', 2800],
      ['Component library & application shell', '20 shared components — buttons, forms, tables, badges, timelines, empty and loading states — plus the responsive header, mobile drawer and footer.', 3200],
    ],
  },
  {
    title: 'Identity, Accounts & Access',
    note: 'One account per person, opening both the ecosystem platform and lab booking.',
    items: [
      ['Authentication & session management', 'Auth.js v5 with revocable server-side sessions, password hashing and Google sign-in — removing someone locks them out on their next request, not whenever a token expires.', 3200],
      ['Account lifecycle flows', 'Email verification and password reset end to end: token issue, expiry, single use and confirmation.', 2400],
      ['Roles & authorisation', 'Student, founder, mentor, lab staff and admin roles, with permissions re-read from the database on every request and admin routes hidden rather than merely refused.', 2600],
      ['Account screens', 'Six screens over one shared form, validation and error layer.', 2000],
    ],
  },
  {
    title: 'Content Management',
    note: 'Everything public is editable by KNEST staff without a developer.',
    items: [
      ['Payload CMS 3 staff console', 'Admin console mounted inside the application, with staff signing in on the same single account as the rest of the platform.', 3000],
      ['Programme & venture content types', 'Programs, Cohorts, Startups, Founders and Mentors — fields, relationships, validation and editor layout.', 2800],
      ['Editorial & site content types', 'Events, Resources, Articles, FAQs, Partners, Infrastructure, Metrics, Testimonials, Staff, the media library and site-wide homepage settings.', 3000],
      ['Content delivery layer', '11 typed services that read published content for the public site, with fallbacks so a database hiccup degrades gracefully instead of erroring.', 2600],
    ],
  },
  {
    title: 'Public Website',
    note: 'The public front door — discover, self-locate, apply.',
    items: [
      ['Homepage', 'Hero, the triple-helix ecosystem model, counters that read real data rather than invented numbers, and calls to action.', 2800],
      ['Programme pages', 'Listing with filters, plus an individual page for every programme.', 2000],
      ['Ecosystem directories', 'Startup and mentor listings, each with individual profile pages.', 2200],
      ['Events & resources', 'Event and resource listings, event detail pages and long-form article rendering.', 2200],
      ['About, Ecosystem & Invest pages', 'Three editorial pages covering the organisation, the ecosystem and the investor-facing pitch.', 1800],
      ['Site-wide search', 'One search across programmes, startups, mentors, events and resources.', 1600],
    ],
  },
  {
    title: 'Member Experience & Applications',
    note: 'What a student, founder or mentor uses after signing up.',
    items: [
      ['Guided onboarding & recommendation', 'A short intake that places a person at their real stage and recommends the programmes that actually fit.', 2600],
      ['Application engine', 'Question sets configured per programme, so staff add or change a question without a code change or a new release.', 3000],
      ['Application lifecycle & review states', 'Draft, submit and review states with server-side validation and only permitted transitions, so an incomplete or tampered application cannot be submitted.', 2600],
      ['Member dashboard & event registration', 'Journey status, application progress, registered events, and event registration with capacity respected.', 2400],
      ['Notification centre', 'In-app and email notifications with read state, raised as applications, events and bookings progress.', 1800],
    ],
  },
  {
    title: 'KIIT Lab Booking Platform',
    note: 'Founders book real lab time across KIIT; lab staff approve, attend and verify it.',
    items: [
      ['Lab & facility registry', 'Every bookable lab across KIIT — department, equipment, capacity, operating hours and the staff who run it — maintained by lab heads themselves.', 2400],
      ['Availability calendar & slot engine', 'Bookable slots generated from each lab’s operating hours, with double-booking made impossible at the database level, and blackout dates for holidays, exams and maintenance.', 3000],
      ['Booking request flow', 'A founder picks a lab, sees live availability, chooses a slot and states purpose, headcount and equipment needed.', 2600],
      ['Lab-head approval console', 'A request queue per lab, with approve, reject with a reason, or propose an alternative slot — and a record of who decided what, and when.', 2800],
      ['Lab assistant assignment & roster', 'An approved slot gets a named assistant, who sees their own upcoming duty schedule rather than being told on the day.', 2200],
      ['Booking ticket & signed QR pass', 'Approval issues a ticket carrying a cryptographically signed QR code, tied to that booking, that slot and that person — a screenshot of somebody else’s pass does not work.', 2600],
      ['Two-sided QR check-in and check-out', 'The student pass is scanned by the assigned lab staff, and the staff pass is scanned by the student. Both sides are recorded, so attendance is proved from both directions and neither party can claim it alone.', 2800],
      ['Lab utilisation reporting', 'Bookings, attendance, no-shows and hours used, per lab and per department — the numbers KIIT needs to justify the facilities.', 2000],
    ],
  },
  {
    title: 'Staff Operations & Analytics',
    note: 'The tools KNEST staff run programmes and reviews with.',
    items: [
      ['Application review console', 'Reviewer queue with filters, full applicant detail, decisions with permitted transitions, and an audit trail against every reviewer.', 3000],
      ['Document handling', 'Uploads to Amazon S3 with real file-type verification, and retrieval that is access-controlled rather than merely an unguessable link.', 2200],
      ['Analytics dashboard', 'Activity tracking and the application funnel — how many people start, complete and are accepted.', 2200],
    ],
  },
  {
    title: 'Progressive Web App',
    note: 'Installable on a phone, and usable in a lab basement with no signal.',
    items: [
      ['PWA packaging', 'Web app manifest, icon and splash sets, and home-screen install on both Android and iOS — no app store, no review queue, no separate build to maintain.', 2000],
      ['Offline shell & background sync', 'A service worker caching the app shell, an offline fallback, and queued actions that sync once signal returns instead of being lost.', 2400],
      ['Mobile camera QR scanning', 'In-browser camera scanning for lab check-in and check-out, built to work on the patchy Wi-Fi found in most lab buildings.', 2200],
    ],
  },
  {
    title: 'Security & Anti-Abuse',
    note: 'The platform holds applicant documents and gates physical lab access.',
    items: [
      ['Cloudflare Turnstile', 'Invisible bot protection on sign-up, sign-in, password reset, application submit and booking request, verified server-side so the check cannot be skipped by calling the API directly.', 2400],
      ['Rate limiting & abuse controls', 'Per-route token buckets on every sensitive endpoint, sized per route and enforced in the database rather than per server instance.', 1800],
      ['Browser hardening', 'Content Security Policy, HSTS, and clickjacking, MIME-sniffing and referrer-leak protection, verified in report-only mode before being enforced.', 1800],
      ['Upload safety', 'Magic-byte file verification rather than trusted extensions, type and size allow-lists, private storage, and nothing user-uploaded ever served as executable content.', 1800],
      ['Secrets, encryption & audit logging', 'AWS Secrets Manager, least-privilege IAM roles, encryption at rest on RDS and S3, TLS in transit, and an audit log of every privileged action.', 2400],
    ],
  },
  {
    title: 'Cloud Infrastructure & Deployment',
    note: 'Named services, provisioned, configured and live.',
    items: [
      ['AWS Amplify Hosting', 'Git-connected CI/CD with server-side rendering, per-branch preview environments, atomic deploys and one-click rollback.', 2400],
      ['Amazon RDS for PostgreSQL 16', 'Instance provisioning, parameter and storage configuration, encryption, automated backups and point-in-time recovery.', 2400],
      ['Amazon S3 & CloudFront', 'Private buckets for applicant documents, CDN delivery for public media, lifecycle rules and signed access.', 2000],
      ['Amazon SES', 'Transactional mail with domain verification and the SPF, DKIM and DMARC records that keep KNEST mail out of spam folders.', 1800],
      ['Cloudflare edge', 'DNS on the KNEST-supplied domain, TLS, WAF rules and DDoS protection sitting in front of everything.', 1800],
      ['Amazon CloudWatch', 'Log aggregation, error and uptime alarms, and alert routing, so a failure is noticed before a user reports it.', 1600],
    ],
  },
  {
    title: 'Quality Assurance & Handover',
    note: 'What makes it safe to put in front of students, staff and the public.',
    items: [
      ['Accessibility', 'WCAG 2.1 AA pass across both platforms — contrast, keyboard operation, focus handling, screen-reader labelling and reduced-motion support.', 2200],
      ['Automated tests & flow verification', 'Unit tests over the rules that must not break, plus scripted end-to-end verification of the auth, application and booking flows.', 1800],
      ['Performance & search visibility', 'Image pipeline, load-time tuning, page metadata and social preview cards.', 1600],
      ['Documentation, training & handover', 'Architecture, content editing and lab operations documentation, plus a walkthrough for KNEST staff and lab heads.', 1800],
    ],
  },
]

/* ---------------------------------------------------------------- AMC scope */

const AMC_SECTIONS = [
  {
    title: 'Cloud Infrastructure Operations',
    note: 'Running the named AWS and Cloudflare services the platform sits on.',
    items: [
      ['AWS Amplify Hosting operations', 'Build pipeline health, deployments and rollbacks, preview environments, and framework runtime upgrades as Amplify deprecates older ones.', 3200],
      ['Amazon RDS administration', 'Automated backups and point-in-time recovery verified by real restore drills, plus parameter tuning, storage growth review, index and vacuum health, and minor-version upgrades.', 3200],
      ['S3, CloudFront & SES operations', 'Storage lifecycle rules, CDN cache and invalidation, and mail deliverability — bounce and complaint rates, DKIM and DMARC monitoring.', 2400],
      ['Cloudflare edge management', 'DNS records, TLS renewal, WAF rule tuning against real traffic, and review of anything the DDoS protection stops.', 2400],
      ['CloudWatch monitoring & incident response', 'Alarm tuning, log retention, alert triage, and a written note on anything that caused downtime.', 3000],
    ],
  },
  {
    title: 'Security & Compliance',
    note: 'The platform holds student data and gates physical access to labs.',
    items: [
      ['Security patch management', 'Advisory monitoring across Next.js, Payload, PostgreSQL, the AWS services and every dependency, with impact triage and out-of-cycle patching for anything critical.', 3400],
      ['Anti-abuse tuning', 'Cloudflare Turnstile and rate-limit thresholds adjusted against real traffic, so genuine students are not blocked and bots still are.', 1800],
      ['Credential & access management', 'IAM and Secrets Manager rotation, staff access reviews, and prompt offboarding when lab staff or admins change.', 2000],
      ['Annual security review', 'Dependency audit, AWS and Cloudflare configuration review, and a written findings report with a prioritised remediation list.', 2800],
    ],
  },
  {
    title: 'Application Support',
    note: 'Ongoing support per module, across both platforms.',
    items: [
      ['Accounts, roles & CMS support', 'Account recovery, role and permission changes, content-type and field adjustments, and support for the staff who publish.', 2600],
      ['Public website content operations', 'New sections, page updates and layout adjustments within the existing design system.', 2400],
      ['Applications & review workflow', 'Question-set updates ahead of each intake cycle, reviewer workflow changes, and cycle-open support when volume spikes.', 2800],
      ['Lab booking operations', 'Lab and slot configuration, term calendars and blackout dates for holidays, exams and maintenance, assistant rosters, and onboarding new labs as they come online.', 3000],
      ['QR ticketing & PWA upkeep', 'Scanner compatibility as Android, iOS and browser releases change camera and service-worker behaviour, plus install and offline behaviour.', 2400],
      ['Notifications, email & analytics', 'Template changes, notification rules, and funnel and report definition updates as programmes change.', 1800],
    ],
  },
  {
    title: 'Service Level & Included Changes',
    note: 'Response commitments and a bundled budget for small changes.',
    items: [
      ['Defect resolution', 'Unlimited Priority 1 and Priority 2 defect fixes within the response times set out below, at no additional charge.', 3200],
      ['Included change budget', `${AMC_HOURS} engineering hours a year for small enhancements — copy, fields, filters, layout tweaks, report changes. Unused hours do not carry over.`, 3200],
      ['Annual audit, documentation & training', 'One accessibility and performance audit a year with a written report, documentation kept current, and a refresher session for staff editors, reviewers and lab heads.', 2400],
    ],
  },
]

/* ------------------------------------------------------------------- shared */

const inr = (n) => '₹' + n.toLocaleString('en-IN')

const total = (sections) =>
  sections.reduce((s, sec) => s + sec.items.reduce((t, [, , amt]) => t + amt, 0), 0)

const DEV_GROSS = total(DEV_SECTIONS)
/** Institutional concession, agreed with KNEST. Set to 0 to invoice full scope. */
const DEV_DISCOUNT = 25000
const DEV_TOTAL = DEV_GROSS - DEV_DISCOUNT
const AMC_TOTAL = total(AMC_SECTIONS)
const DEV_COUNT = DEV_SECTIONS.reduce((n, s) => n + s.items.length, 0)
const AMC_COUNT = AMC_SECTIONS.reduce((n, s) => n + s.items.length, 0)

const scopeTable = (sections) => {
  let n = 0
  return sections
    .map((sec) => {
      const sub = sec.items.reduce((t, [, , amt]) => t + amt, 0)
      const rows = sec.items
        .map(
          ([label, detail, amt]) => `
          <tr>
            <td class="num">${String(++n).padStart(2, '0')}</td>
            <td><span class="item">${label}</span><span class="detail">${detail}</span></td>
            <td class="amt">${inr(amt)}</td>
          </tr>`,
        )
        .join('')
      return `
        <tr class="section">
          <td colspan="3">
            <span class="sec-title">${sec.title}</span>
            <span class="sec-note">${sec.note}</span>
          </td>
        </tr>${rows}
        <tr class="subtotal">
          <td></td>
          <td>Subtotal — ${sec.title}</td>
          <td class="amt">${inr(sub)}</td>
        </tr>`
    })
    .join('')
}

const CSS = `
@page { size: A4; margin: 14mm 13mm 16mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  background: #fff;
  color: #1a1a1a;
  font: 400 10.2px/1.55 "Inter", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-variant-numeric: tabular-nums;
}
.sheet { max-width: 190mm; margin: 0 auto; padding: 10mm 6mm 14mm; }
@media print { .sheet { padding: 0; max-width: none; } }

h1, h2, h3 { font-family: "Fraunces", Georgia, "Times New Roman", serif; font-weight: 600; margin: 0; }
h1 { font-size: 26px; letter-spacing: -0.01em; line-height: 1.1; }
h2 { font-size: 13.5px; letter-spacing: 0.01em; margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1.5px solid #1a1a1a; }
h3 { font-size: 11.5px; margin: 14px 0 5px; }
p { margin: 0 0 8px; }
a { color: #76232f; text-decoration: none; }
.muted { color: #6b6558; }
.small { font-size: 9.2px; line-height: 1.5; }
.sig { color: #76232f; }

/* masthead */
.masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
  border-bottom: 2.5px solid #1a1a1a; padding-bottom: 12px; }
.masthead .vendor { max-width: 62%; }
.vendor .name { font-family: "Fraunces", Georgia, serif; font-size: 15px; font-weight: 600; }
.vendor .tag { font-size: 9.2px; letter-spacing: 0.08em; text-transform: uppercase; color: #76232f; margin-top: 2px; }
.vendor .lines { margin-top: 7px; font-size: 9.2px; line-height: 1.55; color: #6b6558; }
.doctype { text-align: right; }
.doctype .kind { font-size: 9.2px; letter-spacing: 0.22em; text-transform: uppercase; color: #6b6558; }
.doctype h1 { margin-top: 2px; }
.doctype .for { font-size: 9.5px; color: #6b6558; margin-top: 3px; }

/* meta strip */
.meta { display: flex; gap: 0; margin-top: 14px; border: 1px solid #ded9cd; }
.meta > div { flex: 1; padding: 8px 10px; border-right: 1px solid #ded9cd; }
.meta > div:last-child { border-right: 0; }
.meta .k { font-size: 8.2px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6558; }
.meta .v { font-size: 10.5px; font-weight: 600; margin-top: 2px; }
.meta .v.hi { color: #76232f; }

/* parties */
.parties { display: flex; gap: 14px; margin-top: 14px; }
.parties > div { flex: 1; border-top: 1px solid #ded9cd; padding-top: 8px; }
.parties .k { font-size: 8.2px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6558; margin-bottom: 4px; }
.parties .who { font-weight: 600; font-size: 11px; }
.parties .sub { font-size: 9.2px; color: #6b6558; }
.parties .lines { font-size: 9.2px; color: #6b6558; margin-top: 4px; line-height: 1.55; }

/* scope table */
table.scope { width: 100%; border-collapse: collapse; margin-top: 6px; }
table.scope td { padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #efece4; }
table.scope thead th {
  font-size: 8.2px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6558;
  text-align: left; padding: 0 6px 5px; border-bottom: 1.5px solid #1a1a1a; font-weight: 500;
}
table.scope thead th.amt { text-align: right; }
td.num { width: 7%; color: #a6a397; font-size: 9.2px; padding-top: 6px; }
td.amt { width: 17%; text-align: right; white-space: nowrap; font-weight: 600; }
.item { display: block; font-weight: 600; font-size: 10.2px; }
.detail { display: block; font-size: 8.9px; line-height: 1.45; color: #6b6558; margin-top: 1px; }
tr.section td { background: #f6f4ee; border-bottom: 1px solid #ded9cd; padding: 7px 6px 6px; }
tr.section { break-after: avoid; page-break-after: avoid; }
.sec-title { font-family: "Fraunces", Georgia, serif; font-weight: 600; font-size: 11.5px; letter-spacing: 0.01em; }
.sec-note { font-size: 8.9px; color: #6b6558; margin-left: 8px; }
tr.subtotal td { font-size: 9.2px; color: #6b6558; border-bottom: 1.5px solid #ded9cd; padding-top: 5px; padding-bottom: 7px; }
tr.subtotal td.amt { color: #1a1a1a; }
tr { break-inside: avoid; page-break-inside: avoid; }

/* total */
.total { margin-top: 14px; display: flex; justify-content: flex-end; }
.total .box { min-width: 62%; }
.total .row { display: flex; justify-content: space-between; padding: 5px 10px; font-size: 10.2px; }
.total .row.grand {
  background: #1a1a1a; color: #f6f4ee; padding: 11px 10px; margin-top: 4px; align-items: baseline;
}
.total .row.grand .lbl { font-family: "Fraunces", Georgia, serif; font-size: 12.5px; }
.total .row.grand .val { font-family: "Fraunces", Georgia, serif; font-size: 19px; font-weight: 600; }
.words { margin-top: 6px; text-align: right; font-size: 9.2px; color: #6b6558; font-style: italic; }

/* generic blocks */
.cols { display: flex; gap: 18px; margin-top: 6px; }
.cols > div { flex: 1; }
.kv { display: flex; font-size: 9.4px; padding: 2.5px 0; border-bottom: 1px dotted #e4e0d6; }
.kv .k { width: 42%; color: #6b6558; }
.kv .v { flex: 1; font-weight: 500; }
ul.tight { margin: 4px 0 8px; padding-left: 15px; }
ul.tight li { font-size: 9.4px; line-height: 1.5; margin-bottom: 3px; }
table.grid { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.4px; }
table.grid th {
  text-align: left; font-size: 8.2px; letter-spacing: 0.1em; text-transform: uppercase;
  color: #6b6558; font-weight: 500; padding: 0 8px 5px 0; border-bottom: 1.5px solid #1a1a1a;
}
table.grid td { padding: 5px 8px 5px 0; border-bottom: 1px solid #efece4; vertical-align: top; }
table.grid td.r, table.grid th.r { text-align: right; padding-right: 0; }
.callout { border-left: 2.5px solid #76232f; background: #faf8f3; padding: 8px 11px; margin: 8px 0; font-size: 9.4px; line-height: 1.55; }
.note { font-size: 8.9px; color: #6b6558; line-height: 1.5; }
.sign { display: flex; gap: 40px; margin-top: 26px; break-inside: avoid; }
.sign > div { flex: 1; }
.sign .line { border-bottom: 1px solid #1a1a1a; height: 34px; }
.sign .cap { font-size: 8.6px; color: #6b6558; margin-top: 4px; }
footer.doc { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ded9cd;
  display: flex; justify-content: space-between; font-size: 8.4px; color: #a6a397; }
.pagebreak { break-before: page; page-break-before: always; }
`

const shell = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body><div class="sheet">${body}</div></body>
</html>`

const masthead = (kind, heading, forLine) => `
<div class="masthead">
  <div class="vendor">
    <div class="name">${VENDOR.name}</div>
    <div class="tag">${VENDOR.tagline}</div>
    <div class="lines">
      ${VENDOR.address.join('<br>')}<br>
      ${VENDOR.email} · ${VENDOR.phone}<br>
      PAN ${VENDOR.pan} · ${VENDOR.gstin}
    </div>
  </div>
  <div class="doctype">
    <div class="kind">${kind}</div>
    <h1>${heading}</h1>
    <div class="for">${forLine}</div>
  </div>
</div>`

const partiesBlock = (rightK, rightV) => `
<div class="parties">
  <div>
    <div class="k">Billed to</div>
    <div class="who">${CLIENT.name}</div>
    <div class="sub">${CLIENT.sub}</div>
    <div class="lines">${CLIENT.address.join('<br>')}<br>${CLIENT.attn}</div>
  </div>
  <div>
    <div class="k">${rightK}</div>
    <div class="lines" style="margin-top:0">${rightV}</div>
  </div>
</div>`

const bankBlock = () => `
<div class="kv"><span class="k">Account holder</span><span class="v">${BANK.holder}</span></div>
<div class="kv"><span class="k">Bank &amp; branch</span><span class="v">${BANK.bank}</span></div>
<div class="kv"><span class="k">Account number</span><span class="v">${BANK.account}</span></div>
<div class="kv"><span class="k">IFSC</span><span class="v">${BANK.ifsc}</span></div>
<div class="kv"><span class="k">UPI</span><span class="v">${BANK.upi}</span></div>`

/* =============================================================== DOCUMENT 1 */

const invoice = shell(
  'KNEST — Development Invoice',
  `
${masthead('Tax Invoice', 'Invoice', 'Design &amp; development — KNEST platform &amp; KIIT Lab Booking')}

<div class="meta">
  <div><div class="k">Invoice no.</div><div class="v">KNEST/2026-27/001</div></div>
  <div><div class="k">Invoice date</div><div class="v">10 September 2026</div></div>
  <div><div class="k">Payment due</div><div class="v">25 September 2026</div></div>
  <div><div class="k">Amount due</div><div class="v hi">${inr(DEV_TOTAL)}</div></div>
</div>

${partiesBlock(
  'Engagement',
  `<strong style="color:#1a1a1a">KNEST digital platform + KIIT Lab Booking — build &amp; launch</strong><br>
   Public website, member portal, staff operations console and the KIIT lab
   booking platform, over one shared account and content model, delivered as an
   installable progressive web app.<br><br>
   <span style="color:#1a1a1a;font-weight:600">Status:</span> delivered, deployed and in production.<br>
   <span style="color:#1a1a1a;font-weight:600">Basis:</span> fixed price, charged module by module.`,
)}

<h2>Scope of work &amp; charges</h2>
<p class="note" style="margin-bottom:8px">
  Each line below is a discrete, working module — no line repeats work charged
  under another. Charges are fixed per module, not hourly, and no single module
  exceeds ${inr(5000)}. Amounts are in Indian Rupees.
</p>

<table class="scope">
  <thead>
    <tr><th>#</th><th>Module &amp; deliverable</th><th class="amt">Amount (₹)</th></tr>
  </thead>
  <tbody>${scopeTable(DEV_SECTIONS)}</tbody>
</table>

<div class="total">
  <div class="box">
    <div class="row"><span>Scope subtotal (${DEV_COUNT} modules)</span><span>${inr(DEV_GROSS)}</span></div>
    <div class="row sig"><span>Less: KNEST institutional concession</span><span>− ${inr(DEV_DISCOUNT)}</span></div>
    <div class="row muted"><span>GST</span><span>Not applicable</span></div>
    <div class="row grand"><span class="lbl">Total payable</span><span class="val">${inr(DEV_TOTAL)}</span></div>
  </div>
</div>
<div class="words">Rupees Ninety-Eight Thousand Two Hundred Only</div>

<div class="pagebreak"></div>

<h2>Technology &amp; infrastructure delivered</h2>
<p class="note" style="margin-bottom:6px">
  Named so KNEST knows exactly what it now owns and operates. All AWS resources
  are provisioned in the Asia Pacific (Mumbai) region, <code>ap-south-1</code>, and
  sit in KNEST-owned accounts — nothing is held under a supplier account.
</p>
<table class="grid">
  <thead><tr><th style="width:26%">Layer</th><th style="width:34%">Service</th><th>What it does here</th></tr></thead>
  <tbody>
    <tr><td>Application</td><td>Next.js 16 · React 19 · TypeScript</td><td>Public site, member portal, lab booking and staff console in one codebase</td></tr>
    <tr><td>Content</td><td>Payload CMS 3</td><td>Staff-editable content for every public content type</td></tr>
    <tr><td>Hosting</td><td>AWS Amplify Hosting</td><td>CI/CD from Git, server-side rendering, preview environments, rollback</td></tr>
    <tr><td>Database</td><td>Amazon RDS for PostgreSQL 16</td><td>Content, accounts, applications, bookings and audit records</td></tr>
    <tr><td>Files &amp; media</td><td>Amazon S3 + Amazon CloudFront</td><td>Private applicant documents; CDN delivery for public media</td></tr>
    <tr><td>Email</td><td>Amazon SES</td><td>Verification, reset, notification and booking mail, with SPF/DKIM/DMARC</td></tr>
    <tr><td>DNS, TLS &amp; edge</td><td>Cloudflare</td><td>DNS on the KNEST domain, TLS, WAF rules, DDoS protection</td></tr>
    <tr><td>Bot protection</td><td>Cloudflare Turnstile</td><td>Invisible challenge on sign-up, sign-in, reset, apply and booking</td></tr>
    <tr><td>Secrets &amp; access</td><td>AWS Secrets Manager + IAM</td><td>Credential storage and least-privilege service roles</td></tr>
    <tr><td>Monitoring</td><td>Amazon CloudWatch</td><td>Logs, error and uptime alarms, alert routing</td></tr>
    <tr><td>Mobile</td><td>Progressive Web App</td><td>Installable on Android and iOS, offline shell, camera QR scanning</td></tr>
  </tbody>
</table>

<h2>What this invoice includes</h2>
<div class="cols">
  <div>
    <h3>Delivered with the build</h3>
    <ul class="tight">
      <li>Full source code and ownership, handed over in the KNEST repository.</li>
      <li>All AWS and Cloudflare resources provisioned in KNEST-owned accounts, with credentials handed over.</li>
      <li>Production deployment on AWS Amplify, configured and live.</li>
      <li>RDS provisioning, schema migrations, backups enabled and first-run seed data.</li>
      <li>Staff admin console with content editing for every public content type.</li>
      <li>Lab-head and lab-assistant consoles, with the QR pass and scanning flow working end to end.</li>
      <li>Architecture, content-editing and lab-operations documentation.</li>
      <li>One handover walkthrough for KNEST staff and one for lab heads.</li>
      <li>30 days of post-launch defect support from the invoice date, at no charge.</li>
    </ul>
  </div>
  <div>
    <h3>Not included in this invoice</h3>
    <ul class="tight">
      <li>Domain name — being provided and paid for by KNEST.</li>
      <li>AWS charges — Amplify, RDS, S3, CloudFront, SES, Secrets Manager and CloudWatch — billed by AWS directly to KNEST.</li>
      <li>Cloudflare charges, if KNEST moves beyond the free plan.</li>
      <li>Content writing, photography, lab equipment data and bulk data entry.</li>
      <li>Physical QR signage, scanner hardware or tablets for lab desks.</li>
      <li>Third-party licences or paid plugins, should any be added later.</li>
      <li>New modules or features beyond the ${DEV_COUNT} listed, which are quoted separately.</li>
      <li>Ongoing maintenance after the 30-day defect window — covered by the separate annual maintenance proposal.</li>
    </ul>
  </div>
</div>

<div class="callout">
  <strong>Deployment &amp; domain.</strong> The platform runs on AWS Amplify Hosting
  against Amazon RDS, behind Cloudflare. The domain is supplied and paid for by
  KNEST — once its nameservers are pointed at Cloudflare as documented in the
  handover notes, the site serves on the KNEST domain over HTTPS with the WAF and
  Turnstile active. Configuring DNS, TLS and the edge rules is included in the
  charges above; buying and renewing the domain is not.
</div>

<h2>Payment</h2>
<div class="cols">
  <div>
    <h3>Bank transfer / UPI</h3>
    ${bankBlock()}
  </div>
  <div>
    <h3>Terms</h3>
    <ul class="tight">
      <li>Payable within 15 days of the invoice date.</li>
      <li>Please quote invoice number <strong>KNEST/2026-27/001</strong> in the transfer reference.</li>
      <li>GST is not applicable — supplier is not registered under GST. <span class="note">(Delete this line and add a GST row above if registered.)</span></li>
      <li>Tax deducted at source, if any, may be deducted at the applicable rate against the PAN above.</li>
      <li>Source code and deployment credentials transfer to KNEST on receipt of full payment.</li>
    </ul>
  </div>
</div>

<div class="sign">
  <div><div class="line"></div><div class="cap">For ${VENDOR.name} — authorised signatory</div></div>
  <div><div class="line"></div><div class="cap">For and on behalf of KNEST — accepted</div></div>
</div>

<footer class="doc">
  <span>Invoice KNEST/2026-27/001 · ${inr(DEV_TOTAL)}</span>
  <span>This is a computer-generated invoice.</span>
</footer>
`,
)

/* =============================================================== DOCUMENT 2 */

const AMC_QUARTER = AMC_TOTAL / 4
const AMC_MONTH = AMC_TOTAL / 12

const amc = shell(
  'KNEST — Annual Maintenance Proposal',
  `
${masthead('Proposal', 'Annual Maintenance', 'KNEST platform + KIIT Lab Booking — 12-month support &amp; maintenance')}

<div class="meta">
  <div><div class="k">Proposal no.</div><div class="v">KNEST/AMC/2026-27/001</div></div>
  <div><div class="k">Issued</div><div class="v">10 September 2026</div></div>
  <div><div class="k">Valid until</div><div class="v">10 October 2026</div></div>
  <div><div class="k">Annual fee</div><div class="v hi">${inr(AMC_TOTAL)}</div></div>
</div>

${partiesBlock(
  'Proposed term',
  `<strong style="color:#1a1a1a">01 October 2026 — 30 September 2027</strong><br>
   Twelve months, beginning the day the 30-day post-launch defect window on
   invoice KNEST/2026-27/001 ends, so there is no gap in cover.<br><br>
   <span style="color:#1a1a1a;font-weight:600">Renewable</span> annually by mutual
   consent, with any revision capped at 10% of the then-current fee.`,
)}

<h2>Why this contract exists</h2>
<p>
  What is live is not one website. It is a public platform holding real applicant
  documents, and a booking system that decides who gets physical access to KIIT
  labs — running across nine AWS services and Cloudflare. Software of that shape
  does not stand still. Security advisories are published against its dependencies,
  AWS deprecates runtimes, Android and iOS releases break camera and offline
  behaviour in progressive web apps, intake cycles bring new programmes and new
  questions, new labs come online each term, and databases need looking after.
</p>
<p>
  This contract covers all of it at a fixed annual fee, so KNEST is not negotiating
  a price every time something needs attention — and so there is a named person
  accountable when a student cannot get into a lab at nine in the morning.
</p>
<p class="note">
  The fee is ${Math.round((AMC_TOTAL / DEV_GROSS) * 100)}% of the ${inr(DEV_GROSS)}
  delivered scope — within the customary 15–40% band for annual maintenance on a
  platform of this size, and it covers both platforms, not just the website.
</p>

<h2>Scope of maintenance &amp; charges</h2>
<p class="note" style="margin-bottom:8px">
  Priced by coverage area on the same basis as the development invoice, with no
  area repeating another. No single line exceeds ${inr(5000)}. Amounts are in
  Indian Rupees, for the full 12-month term.
</p>

<table class="scope">
  <thead>
    <tr><th>#</th><th>Coverage area</th><th class="amt">Annual (₹)</th></tr>
  </thead>
  <tbody>${scopeTable(AMC_SECTIONS)}</tbody>
</table>

<div class="total">
  <div class="box">
    <div class="row"><span>Subtotal (${AMC_COUNT} coverage areas)</span><span>${inr(AMC_TOTAL)}</span></div>
    <div class="row muted"><span>GST</span><span>Not applicable</span></div>
    <div class="row grand"><span class="lbl">Annual maintenance fee</span><span class="val">${inr(AMC_TOTAL)}</span></div>
  </div>
</div>
<div class="words">
  Rupees Forty-Eight Thousand Only &nbsp;·&nbsp; ${inr(AMC_MONTH)} per month equivalent
</div>

<div class="pagebreak"></div>

<h2>Service levels</h2>
<table class="grid">
  <thead>
    <tr><th style="width:14%">Priority</th><th style="width:34%">What it means</th><th class="r" style="width:22%">Response</th><th class="r" style="width:22%">Target resolution</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>P1 — Critical</strong></td>
      <td>Site down, sign-in broken, applications cannot be submitted, lab check-in or QR scanning failing at the lab door, or a data/security incident.</td>
      <td class="r">4 business hours</td>
      <td class="r">1 business day</td>
    </tr>
    <tr>
      <td><strong>P2 — High</strong></td>
      <td>A module is unusable or wrong, but a workaround exists — a broken review action, a failing upload.</td>
      <td class="r">1 business day</td>
      <td class="r">3 business days</td>
    </tr>
    <tr>
      <td><strong>P3 — Normal</strong></td>
      <td>Cosmetic issues, minor content or copy corrections, small requests.</td>
      <td class="r">3 business days</td>
      <td class="r">Next release cycle</td>
    </tr>
    <tr>
      <td><strong>P4 — Change</strong></td>
      <td>Enhancements drawn from the included ${AMC_HOURS}-hour annual change budget.</td>
      <td class="r">3 business days</td>
      <td class="r">Scheduled, by agreement</td>
    </tr>
  </tbody>
</table>
<p class="note" style="margin-top:6px">
  Support window: Monday to Saturday, 10:00–19:00 IST, excluding public holidays.
  Requests are raised by email; P1 incidents may additionally be raised by phone or
  WhatsApp at any hour. Response times run from within the support window.
  Release cycle: one scheduled maintenance release each month, plus out-of-cycle
  releases for P1 and security fixes.
</p>

<h2>Billing options</h2>
<table class="grid">
  <thead><tr><th>Option</th><th>Schedule</th><th class="r">Per instalment</th><th class="r">Annual total</th></tr></thead>
  <tbody>
    <tr>
      <td><strong>Annual, in advance</strong> <span class="sig">— recommended</span></td>
      <td>One payment at the start of the term</td>
      <td class="r">${inr(AMC_TOTAL)}</td>
      <td class="r"><strong>${inr(AMC_TOTAL)}</strong></td>
    </tr>
    <tr>
      <td>Quarterly</td>
      <td>Four payments, each in advance of the quarter</td>
      <td class="r">${inr(AMC_QUARTER)}</td>
      <td class="r">${inr(AMC_TOTAL)}</td>
    </tr>
  </tbody>
</table>
<p class="note" style="margin-top:6px">
  Both options carry the same total and the same cover; quarterly exists purely to
  suit institutional budget cycles. Payment terms are 15 days from each invoice.
</p>

<h2>Outside this contract</h2>
<div class="cols">
  <div>
    <h3>Charged separately</h3>
    <ul class="tight">
      <li>Enhancement work beyond the included ${AMC_HOURS} hours a year, at <strong>${inr(AMC_HOURLY)} per hour</strong>, estimated and approved in writing before work starts.</li>
      <li>New modules or significant features — quoted per module, on the same basis as the development invoice.</li>
      <li>Visual redesign or rebranding beyond the existing design system.</li>
      <li>Migration off AWS Amplify or RDS to a different provider or architecture.</li>
      <li>Scanner hardware, tablets or printed QR signage for lab desks.</li>
      <li>Content writing, photography, data entry and bulk data imports.</li>
    </ul>
  </div>
  <div>
    <h3>Not covered</h3>
    <ul class="tight">
      <li>AWS and Cloudflare service charges, billed by those providers directly to KNEST.</li>
      <li>Domain registration and renewal, which KNEST holds and pays for directly.</li>
      <li>Faults caused by changes made to the code or infrastructure by anyone other than the supplier.</li>
      <li>Loss or corruption caused by KNEST staff actions in the admin console — recovery is chargeable at the hourly rate above.</li>
      <li>Outages attributable to AWS, Cloudflare or another provider, beyond triage, escalation and reporting.</li>
    </ul>
  </div>
</div>

<h2>Infrastructure — indicative annual cost to KNEST</h2>
<p class="note" style="margin-bottom:6px">
  These are billed by AWS and Cloudflare directly to KNEST and form no part of the
  fee above. Ranges are indicative for expected first-year load in
  <code>ap-south-1</code> (Mumbai): the low end assumes the 12-month AWS free tier
  and Cloudflare's free plan, the high end assumes paid tiers once traffic, stored
  documents and mail volume grow. Confirm against the AWS Pricing Calculator before
  budgeting — AWS prices in USD, so the rupee figure moves with the exchange rate.
</p>
<table class="grid">
  <thead><tr><th style="width:30%">Service</th><th>Purpose</th><th class="r" style="width:24%">Indicative per year</th></tr></thead>
  <tbody>
    <tr><td>Domain name</td><td>Public address for the platform</td><td class="r">Held &amp; paid by KNEST</td></tr>
    <tr><td>AWS Amplify Hosting</td><td>Build minutes, hosting and server-side rendering</td><td class="r">₹0 – ₹18,000</td></tr>
    <tr><td>Amazon RDS for PostgreSQL</td><td>Content, accounts, applications, bookings</td><td class="r">₹0 – ₹30,000</td></tr>
    <tr><td>Amazon S3 &amp; CloudFront</td><td>Applicant documents, media storage and delivery</td><td class="r">₹1,500 – ₹12,000</td></tr>
    <tr><td>Amazon SES</td><td>Verification, notification and booking mail</td><td class="r">₹0 – ₹4,000</td></tr>
    <tr><td>AWS Secrets Manager</td><td>Credential storage for the application</td><td class="r">₹1,000 – ₹2,000</td></tr>
    <tr><td>Amazon CloudWatch</td><td>Logs, metrics and alarms</td><td class="r">₹0 – ₹6,000</td></tr>
    <tr><td>Cloudflare</td><td>DNS, TLS, WAF, DDoS protection, Turnstile</td><td class="r">₹0 – ₹22,000</td></tr>
  </tbody>
</table>
<p class="note" style="margin-top:6px">
  <strong>Realistic first year: near zero.</strong> The AWS free tier and Cloudflare's
  free plan cover launch volumes for this platform, and Turnstile is free to one
  million challenges a month. Costs begin once the free tier expires at twelve
  months. Watching that boundary, warning KNEST before it is crossed, recommending
  when to move up a tier, and doing the move, are all included in the maintenance fee.
</p>

<div class="pagebreak"></div>

<h2>Terms</h2>
<ul class="tight">
  <li><strong>Term.</strong> Twelve months from 01 October 2026, renewable by mutual consent. Any renewal increase is capped at 10% of the then-current fee.</li>
  <li><strong>Termination.</strong> Either party may terminate with 30 days' written notice. On termination, fees for the unexpired period are refunded pro rata, less any enhancement work already delivered.</li>
  <li><strong>Handover on exit.</strong> All source code, credentials, documentation and data export are handed over within 14 days of termination, at no charge.</li>
  <li><strong>Ownership.</strong> KNEST owns the source code and all data. The supplier retains no rights over either, and may reference the project as portfolio work unless KNEST asks otherwise in writing.</li>
  <li><strong>Confidentiality.</strong> Applicant and member data is confidential, accessed only where necessary to deliver support, and never copied out of the production environment except for a documented, secured backup restore.</li>
  <li><strong>Continuity.</strong> If the supplier is unable to continue, an orderly handover of at least 30 days is provided, including documentation and a working session with any incoming team.</li>
  <li><strong>Liability.</strong> The supplier's aggregate liability under this contract is limited to the annual fee paid.</li>
  <li><strong>Escalation.</strong> Anything unresolved past its target resolution time is escalated to the named KNEST point of contact with a written explanation and a revised commitment.</li>
</ul>

<h2>Acceptance</h2>
<p class="note">
  To accept, sign below and return one copy. An invoice for the selected billing
  option is raised on acceptance, and cover begins on 01 October 2026.
</p>
<div class="cols" style="margin-top:8px">
  <div>
    <div class="kv"><span class="k">Billing option selected</span><span class="v">☐ Annual &nbsp;&nbsp; ☐ Quarterly</span></div>
    <div class="kv"><span class="k">Term begins</span><span class="v">01 October 2026</span></div>
    <div class="kv"><span class="k">Annual fee</span><span class="v">${inr(AMC_TOTAL)}</span></div>
  </div>
  <div>
    <div class="kv"><span class="k">KNEST point of contact</span><span class="v">«Name»</span></div>
    <div class="kv"><span class="k">Email</span><span class="v">«email»</span></div>
    <div class="kv"><span class="k">Phone</span><span class="v">«phone»</span></div>
  </div>
</div>

<div class="sign">
  <div><div class="line"></div><div class="cap">For ${VENDOR.name} — authorised signatory, date</div></div>
  <div><div class="line"></div><div class="cap">For and on behalf of KNEST — name, designation, date</div></div>
</div>

<h2>Payment details</h2>
<div class="cols">
  <div>${bankBlock()}</div>
  <div class="note" style="padding-top:4px">
    Please quote the invoice number raised on acceptance in the transfer reference.
    GST is not applicable — supplier is not registered under GST. Tax deducted at
    source, if any, may be deducted at the applicable rate against PAN ${VENDOR.pan}.
  </div>
</div>

<footer class="doc">
  <span>Proposal KNEST/AMC/2026-27/001 · ${inr(AMC_TOTAL)} per year</span>
  <span>Valid for 30 days from the date of issue.</span>
</footer>
`,
)

/* ------------------------------------------------------------------- write */

writeFileSync(path.join(OUT_DIR, 'knest-development-invoice.html'), invoice)
writeFileSync(path.join(OUT_DIR, 'knest-amc-proposal.html'), amc)

const count = (s) => s.reduce((n, sec) => n + sec.items.length, 0)
console.log(`development invoice : ${count(DEV_SECTIONS)} line items · ${inr(DEV_TOTAL)}`)
console.log(`amc proposal        : ${count(AMC_SECTIONS)} line items · ${inr(AMC_TOTAL)} / year`)
const maxLine = (s) => Math.max(...s.flatMap((sec) => sec.items.map(([, , a]) => a)))
console.log(`max single line     : dev ${inr(maxLine(DEV_SECTIONS))} · amc ${inr(maxLine(AMC_SECTIONS))}`)
