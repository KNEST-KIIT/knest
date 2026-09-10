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
    note: 'The base the rest of the platform is built on.',
    items: [
      ['Project foundation', 'Application framework, code standards, type safety, build and release pipeline.', 2000],
      ['Database architecture', 'Two separate stores in one database — editorial content kept apart from operational records — so the CMS never becomes the backend.', 2400],
      ['Database schema, migrations & seed tooling', '8 schema modules, 6 versioned migrations, and seeding scripts for first-run and demo data.', 2200],
      ['Design system', 'Colour palette, typography scale, spacing, borders and motion rules, expressed as reusable design tokens.', 2800],
      ['Interface component library', '20 reusable components — buttons, cards, form fields, tables, badges, timelines, empty and loading states.', 3200],
      ['Site-wide layout', 'Responsive header, mobile navigation drawer, footer and keyboard skip-navigation, consistent across all pages.', 2400],
    ],
  },
  {
    title: 'Accounts & Access Control',
    note: 'One account per person; one login for the whole platform.',
    items: [
      ['Authentication core', 'Sign-in system backed by server-side sessions that can be revoked instantly — removing someone locks them out on their next request.', 2800],
      ['Sign-up & sign-in', 'Account creation and password sign-in with industry-standard password hashing.', 2200],
      ['Email verification', 'Verification link issue, expiry and confirmation.', 1600],
      ['Password reset', 'Reset request and secure confirmation flow.', 1600],
      ['Roles & permissions', 'Staff / member separation, protected routes, and permissions re-checked from the database on every request.', 2400],
      ['Account screens', 'Six screens — sign in, sign up, verify, verification confirmation, reset request, reset confirmation.', 2400],
    ],
  },
  {
    title: 'Content Management System',
    note: 'Everything on the public site is editable by KNEST staff without a developer.',
    items: [
      ['CMS setup & staff console', 'Admin console mounted inside the application, with staff signing in using the same single account as the rest of the platform.', 3000],
      ['Content types — Programs, Cohorts, Startups, Founders', 'Fields, relationships, validation and editor layout for four content types.', 2400],
      ['Content types — Mentors, Events, Partners, Infrastructure', 'Fields, relationships, validation and editor layout for four content types.', 2200],
      ['Content types — Resources, Articles, FAQs, Media library', 'Four content types including rich-text authoring and the image/media library.', 2000],
      ['Content types — Metrics, Testimonials, Staff, Homepage settings', 'Three content types plus site-wide homepage settings.', 1600],
      ['Content delivery layer', '11 typed data services that read published content for the public site, with safe fallbacks so a database hiccup degrades gracefully instead of erroring.', 2800],
    ],
  },
  {
    title: 'Public Website',
    note: 'The public front door — discover, self-locate, apply.',
    items: [
      ['Homepage', 'Hero, the triple-helix ecosystem model, live counters that read real data, and calls to action.', 3000],
      ['Programs', 'Programme listing with filters, plus an individual page for every programme.', 2000],
      ['Startups', 'Startup directory, plus an individual profile page for every startup.', 1800],
      ['Mentors', 'Mentor directory, plus an individual profile page for every mentor.', 1800],
      ['Events', 'Event listing, plus an individual page for every event.', 1800],
      ['Resources & Articles', 'Resource listing and formatted long-form article pages.', 2000],
      ['About, Ecosystem & Invest pages', 'Three editorial pages covering the organisation, the ecosystem and the investor-facing pitch.', 2200],
      ['Site-wide search', 'One search across programmes, startups, mentors, events and resources.', 1600],
    ],
  },
  {
    title: 'Member Experience',
    note: 'What a student, founder or mentor actually uses after signing up.',
    items: [
      ['Guided onboarding', 'A short intake that places a person at their real stage and recommends the programmes that fit.', 2800],
      ['Application system', 'Applications with question sets configured per programme — staff can change the questions without a code change.', 3200],
      ['Application lifecycle', 'Draft, submit and review states with server-side validation, so an incomplete or tampered application cannot be submitted.', 2400],
      ['Document uploads', 'Cloud file storage with real file-type verification, not just a trusted file extension.', 2200],
      ['Member dashboard', 'Journey status, application progress and registered events in one place.', 2200],
      ['Event registration', 'Register and cancel, with capacity respected.', 1200],
      ['Notification centre', 'In-app notifications with read state, delivered as applications and events progress.', 1800],
    ],
  },
  {
    title: 'Administration & Operations',
    note: 'The tools KNEST staff run the programmes with.',
    items: [
      ['Application review console', 'Reviewer queue with filters and a full applicant detail view.', 2800],
      ['Review decisions & audit trail', 'Status changes with permitted transitions enforced and every decision recorded against a reviewer.', 2000],
      ['Controlled document access', 'Reviewers can open applicant documents; nobody else can, and access is not guessable by URL.', 1200],
      ['Analytics dashboard', 'Activity tracking plus an application funnel — how many people start, complete and are accepted.', 2400],
    ],
  },
  {
    title: 'Quality, Security & Launch',
    note: 'The work that makes it safe to put in front of the public.',
    items: [
      ['Transactional email', 'Delivery setup and message templates for verification, reset and notification mail.', 1800],
      ['Security hardening', 'Content security policy, browser security headers, and rate limiting on every sensitive route.', 2200],
      ['Accessibility', 'WCAG 2.1 AA conformance pass — contrast, keyboard operation, focus handling, screen-reader labelling and reduced-motion support.', 2600],
      ['Automated tests & flow verification', 'Unit tests over the rules that must not break, plus scripted end-to-end verification of the auth and application flows.', 1800],
      ['Performance & search visibility', 'Image pipeline, load-time tuning, page metadata and social preview cards.', 1400],
      ['Brand & interface polish', 'Official KNEST logo integration and the final visual pass across every screen.', 2000],
      ['Production deployment & go-live', 'Build configuration, environment and secret setup, database provisioning, migration run and launch.', 2800],
      ['Handover documentation', 'Architecture, content-editing and operations documentation written into the repository.', 1200],
    ],
  },
]

/* ---------------------------------------------------------------- AMC scope */

const AMC_SECTIONS = [
  {
    title: 'Platform Upkeep & Security',
    note: 'Keeping what is live healthy, current and safe.',
    items: [
      ['Dependency & framework updates', 'Scheduled quarterly update cycle across the application framework, CMS, database layer and libraries, each verified before release.', 3200],
      ['Security patch management', 'Monitoring of security advisories affecting the stack, impact triage, and out-of-cycle patching for anything critical.', 3600],
      ['Database maintenance', 'Migration runs, index and vacuum health, storage growth review and data integrity checks.', 2400],
      ['Backup verification & restore drills', 'Two documented restore drills a year, proving the backups actually restore rather than assuming it.', 2400],
      ['Uptime & error monitoring', 'Availability and error-rate monitoring with alert triage, and a written note on anything that caused downtime.', 2400],
    ],
  },
  {
    title: 'Module Support',
    note: 'Ongoing support, per module, for the platform as delivered.',
    items: [
      ['Accounts & access', 'Account recovery, role and permission changes, sign-in issues, staff onboarding and offboarding.', 1800],
      ['Content management', 'Adjustments to content types and fields, editor assistance, and support for the staff who publish.', 2400],
      ['Public website content operations', 'New sections, page updates and layout adjustments within the existing design system.', 2400],
      ['Applications & review workflow', 'Question-set updates ahead of each intake cycle, reviewer workflow adjustments and cycle-open support.', 2800],
      ['Events & notifications', 'Event flow and notification/email template adjustments.', 1600],
      ['Analytics', 'Funnel and report definition updates as the programmes change.', 1200],
      ['Media & storage', 'Object-storage lifecycle management and image pipeline upkeep.', 1200],
    ],
  },
  {
    title: 'Service Level & Included Changes',
    note: 'Response commitments and a bundled budget for small changes.',
    items: [
      ['Bug resolution', 'Unlimited Priority 1 and Priority 2 defect fixes within the response times set out below, at no additional charge.', 3200],
      ['Included change budget', '12 engineering hours a year for small enhancements — copy, fields, filters, layout tweaks, report changes. Unused hours do not carry over.', 3200],
      ['Release & deployment support', 'Deployments, rollbacks, environment configuration and credential rotation.', 1600],
      ['Annual performance & accessibility audit', 'One full audit a year against performance and WCAG 2.1 AA targets, with a written report and a remediation list.', 1800],
      ['Training refresher & documentation upkeep', 'One refresher session a year for staff editors and reviewers, plus documentation kept current.', 1200],
    ],
  },
]

/* ------------------------------------------------------------------- shared */

const inr = (n) => '₹' + n.toLocaleString('en-IN')

const total = (sections) =>
  sections.reduce((s, sec) => s + sec.items.reduce((t, [, , amt]) => t + amt, 0), 0)

const DEV_TOTAL = total(DEV_SECTIONS)
const AMC_TOTAL = total(AMC_SECTIONS)

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
${masthead('Tax Invoice', 'Invoice', 'Design &amp; development of the KNEST platform')}

<div class="meta">
  <div><div class="k">Invoice no.</div><div class="v">KNEST/2026-27/001</div></div>
  <div><div class="k">Invoice date</div><div class="v">10 September 2026</div></div>
  <div><div class="k">Payment due</div><div class="v">25 September 2026</div></div>
  <div><div class="k">Amount due</div><div class="v hi">${inr(DEV_TOTAL)}</div></div>
</div>

${partiesBlock(
  'Engagement',
  `<strong style="color:#1a1a1a">KNEST digital platform — build &amp; launch</strong><br>
   Public website, member portal and staff operations console over one shared
   account and content model.<br><br>
   <span style="color:#1a1a1a;font-weight:600">Status:</span> delivered, deployed and in production.<br>
   <span style="color:#1a1a1a;font-weight:600">Basis:</span> fixed price, charged module by module.`,
)}

<h2>Scope of work &amp; charges</h2>
<p class="note" style="margin-bottom:8px">
  Each line below is a delivered, working module. Charges are fixed per module,
  not hourly, and no single module exceeds ${inr(5000)}. Amounts are in Indian Rupees.
</p>

<table class="scope">
  <thead>
    <tr><th>#</th><th>Module &amp; deliverable</th><th class="amt">Amount (₹)</th></tr>
  </thead>
  <tbody>${scopeTable(DEV_SECTIONS)}</tbody>
</table>

<div class="total">
  <div class="box">
    <div class="row"><span>Subtotal (45 modules)</span><span>${inr(DEV_TOTAL)}</span></div>
    <div class="row muted"><span>Discount</span><span>— </span></div>
    <div class="row muted"><span>GST</span><span>Not applicable</span></div>
    <div class="row grand"><span class="lbl">Total payable</span><span class="val">${inr(DEV_TOTAL)}</span></div>
  </div>
</div>
<div class="words">Rupees Ninety-Eight Thousand Two Hundred Only</div>

<div class="pagebreak"></div>

<h2>What this invoice includes</h2>
<div class="cols">
  <div>
    <h3>Delivered with the build</h3>
    <ul class="tight">
      <li>Full source code and ownership, handed over in the KNEST repository.</li>
      <li>Production deployment, configured and live.</li>
      <li>Database provisioning, schema migrations and first-run seed data.</li>
      <li>Staff admin console with content editing for every public content type.</li>
      <li>Architecture, content-editing and operations documentation.</li>
      <li>One handover walkthrough for KNEST staff.</li>
      <li>30 days of post-launch defect support from the invoice date, at no charge.</li>
    </ul>
  </div>
  <div>
    <h3>Not included in this invoice</h3>
    <ul class="tight">
      <li>Domain name — being provided and paid for by KNEST.</li>
      <li>Hosting, database, storage and email costs, billed by those providers directly to KNEST.</li>
      <li>Content writing, photography and data entry.</li>
      <li>Third-party licences or paid plugins, should any be added later.</li>
      <li>New modules or features beyond the 45 listed, which are quoted separately.</li>
      <li>Ongoing maintenance after the 30-day defect window — covered by the separate annual maintenance proposal.</li>
    </ul>
  </div>
</div>

<div class="callout">
  <strong>Deployment note.</strong> The platform is deployed and running. The domain
  is supplied by KNEST — once the DNS records are pointed as documented in the
  handover notes, the site serves on the KNEST domain with HTTPS. Connecting the
  domain is included; purchasing and renewing it is not.
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
${masthead('Proposal', 'Annual Maintenance', 'KNEST digital platform — 12-month support &amp; maintenance')}

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
  The platform is live, holds real applicant data and is the public face of KNEST.
  Software of this kind does not stand still: browsers change, security advisories
  are published against the libraries it depends on, intake cycles bring new
  programmes and new questions, and databases need looking after. This contract
  covers that ongoing work at a fixed annual fee, so KNEST is not negotiating a
  price every time something needs attention.
</p>
<p class="note">
  The fee is ${Math.round((AMC_TOTAL / DEV_TOTAL) * 100)}% of the development cost —
  within the customary 15–40% band for annual maintenance on a platform of this size.
</p>

<h2>Scope of maintenance &amp; charges</h2>
<p class="note" style="margin-bottom:8px">
  Priced module by module, on the same basis as the development invoice. No single
  line exceeds ${inr(5000)}. Amounts are in Indian Rupees, for the full 12-month term.
</p>

<table class="scope">
  <thead>
    <tr><th>#</th><th>Coverage area</th><th class="amt">Annual (₹)</th></tr>
  </thead>
  <tbody>${scopeTable(AMC_SECTIONS)}</tbody>
</table>

<div class="total">
  <div class="box">
    <div class="row"><span>Subtotal (17 coverage areas)</span><span>${inr(AMC_TOTAL)}</span></div>
    <div class="row muted"><span>GST</span><span>Not applicable</span></div>
    <div class="row grand"><span class="lbl">Annual maintenance fee</span><span class="val">${inr(AMC_TOTAL)}</span></div>
  </div>
</div>
<div class="words">
  Rupees Thirty-Eight Thousand Four Hundred Only &nbsp;·&nbsp; ${inr(AMC_MONTH)} per month equivalent
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
      <td>Site down, sign-in broken, applications cannot be submitted, or a data/security incident.</td>
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
      <td>Enhancements drawn from the included 12-hour annual change budget.</td>
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
      <li>Enhancement work beyond the included 12 hours a year, at <strong>₹700 per hour</strong>, estimated and approved in writing before work starts.</li>
      <li>New modules or significant features — quoted per module, on the same basis as the development invoice.</li>
      <li>Visual redesign or rebranding beyond the existing design system.</li>
      <li>Migration to a different hosting provider or platform.</li>
      <li>Content writing, photography, data entry and bulk data imports.</li>
    </ul>
  </div>
  <div>
    <h3>Not covered</h3>
    <ul class="tight">
      <li>Third-party service fees and licences — hosting, database, storage, email.</li>
      <li>Domain registration and renewal, which KNEST holds and pays for directly.</li>
      <li>Faults caused by changes made to the code or infrastructure by anyone other than the supplier.</li>
      <li>Loss or corruption caused by KNEST staff actions in the admin console — recovery is chargeable at the hourly rate above.</li>
      <li>Outages attributable to a third-party provider, beyond triage, escalation and reporting.</li>
    </ul>
  </div>
</div>

<h2>Infrastructure — indicative annual cost to KNEST</h2>
<p class="note" style="margin-bottom:6px">
  These are paid by KNEST directly to the providers and form no part of the fee above.
  Figures are indicative for the expected first-year load and will vary with traffic
  and storage. Actual provider pricing should be confirmed before budgeting.
</p>
<table class="grid">
  <thead><tr><th>Service</th><th>Purpose</th><th class="r">Indicative per year</th></tr></thead>
  <tbody>
    <tr><td>Domain name</td><td>Public address for the platform</td><td class="r">Held by KNEST</td></tr>
    <tr><td>Application hosting</td><td>Runs the website, portal and admin console</td><td class="r">₹0 – ₹24,000</td></tr>
    <tr><td>Managed PostgreSQL</td><td>Content, accounts and application records</td><td class="r">₹0 – ₹30,000</td></tr>
    <tr><td>Object storage &amp; CDN</td><td>Uploaded documents, images, media delivery</td><td class="r">₹1,500 – ₹12,000</td></tr>
    <tr><td>Transactional email</td><td>Verification, reset and notification mail</td><td class="r">₹0 – ₹6,000</td></tr>
  </tbody>
</table>
<p class="note" style="margin-top:6px">
  The lower ends reflect free tiers, which are adequate at launch volumes; the upper
  ends reflect paid tiers once traffic, stored documents or mail volume grow.
  Recommending when to move up a tier, and doing the move, is included in the
  maintenance fee.
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
