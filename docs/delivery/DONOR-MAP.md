# Donor-branch map (D-05)

Rule: harvest specific commits per task, re-verify and re-test against current HEAD, never merge wholesale. Every branch below diverged from the current line at least 4 commits ago, and the two UI branches are 15+ commits apart.

## `claude/website-content-uiux-audit-qem7nv` (8 commits ahead)

| Commit | Content | Target task | Notes |
|---|---|---|---|
| `921af57` | sitemap, robots, share cards, mobile menu fix | X-12, X-09 | Re-check the menu fix against the new nav. |
| `8467098`, `2353ffc` | one page shell, public-site content pages; `not-found`; legal page scaffolds (`/privacy`, `/terms`) | R-10, KN-16, NF-08 | Scaffold only; legal text is HD-06. |
| `d42e68d` | absolute links in email, spec footer, sign-off, with `templates.test.ts` | R-12 | Takes the tests too. |
| `6f99be0` | FAQs, metrics, testimonials wired to pages | X-08 | Check against the new consent and `source` access rules from C-03. |
| `4aa4a5a` | `/stories` page; questions in search | X-09 | Supersedes `/blog`. Search must also cover mentors (contract module 19). |
| `4049ae2` | landing offer cards link to real pages | X-06 | Homepage layout will change in X-02. |

## `claude/pro-ui-ux-skills-guzkyk` (11 commits ahead, older brand)

| Commit | Content | Target task | Notes |
|---|---|---|---|
| `1fbf1f0` | analytics allow-list and rate limit; `/admin/audit`; paginated applications; `/admin/mentors` | R-14, A-01 | The allow-list idea is already re-implemented (C-08). Audit viewer and pagination still to harvest. |
| `f2b34a8` | staff console: overview, members (grant/revoke staff, deactivate), levels queue | R-03, R-14 | **Exclude the levels queue** (HD-17, not in contract). |
| `a7d78bb` | labs schema, migrations 0006/0007, booking UI, manage console | LB-01 (reference only) | Do not copy the exclusion constraint over pending requests (blueprint R1 section 5). |
| `f03e139` | analytics screen | A-03 | Reference for the table-derived funnel. |
| `e2291ec` | founder levels | none | HD-17: excluded. |
| `0a82f88` | demo seed, `/privacy`, `/terms`, two data fixes | R-10 | Demo seed must keep the C-05 guards. |
| `bd7b365` | CMS identity / admin styling | X-11 | Conflicts with the current brand tokens; look only. |

## `claude/pro-ui-ux-skills-guzkyk-green-backup` (9 commits ahead)

Superseded by the above. Reference only; the green brand was reverted on that branch itself (`c6ddc90`).

## `claude/knest-invoicing-maintenance-8rh7gd` (5 commits ahead)

Documentation only (`docs/commercial/`). Source of the 53-module contract (see `CONTRACT-TRACEABILITY.md`). **Not merged**: it holds client-facing commercial documents, and the repository copy still has 15 unfilled placeholders, so it is not the version KIIT received.
