# UI and component consistency audit — in progress

Token and font source of truth: `src/styles/tokens.css` and `src/styles/fonts.ts` as inventoried, reconciled with TOKEN-PIPELINE. Older green/Anton content copy is not automatically the current design oracle. This checkpoint does not accept all spacing, typography, contrast, breakpoints or motion behavior.

## Current reproduced issues

- QA-001: Field error/hint descriptions reference an absent node, confirmed by rendering the real component. No current caller passes Field.error.
- QA-002: Homepage selector and shared SingleSelect independently implement incomplete custom radio behavior. This duplication carries the same defect in both reproduced contexts.
- QA-005: Onboarding omits field-level validation association and useful error focus.
- QA-006: Shared NotFound owns a main landmark inside a layout that also owns main.
- QA-007: Signup fails to associate/focus its short-password error.
- QA-008/QA-009: Resource target resolution and effective program availability disagree across public/detail/private entry surfaces.
- QA-010/QA-011: The student dashboard omits a saved-draft entry and the application URL error lacks field association/focus.

## Executed navigation behavior

At 375×812 in the desktop browser, signed-out mobile menu focus traversed every link forward and backward, wrapped correctly, restored toggle focus on Escape, closed on route change and closed on expansion to 1280px. Navigation links scrolled into the clipped navigation region when focused. The signed-in variant also passed forward traversal, wrap, Escape and route/desktop dismissal; complete reverse traversal remains to execute. These are resized desktop results, not real-device or screen-reader acceptance.

## Component inventory / remaining acceptance

FAIL indicates at least one reproduced variant issue; NOT RUN means the entire supported component matrix has not been accepted, even where rendering/source inspection occurred.

| Source | Exports | Status |
| --- | --- | --- |
| `src/components/auth/google-button.tsx` | GoogleButton | NOT RUN |
| `src/components/content/policy-document.tsx` | PolicyDocument | NOT RUN |
| `src/components/content/rich-text.tsx` | RichText | NOT RUN |
| `src/components/content/triple-helix.tsx` | TripleHelix | NOT RUN |
| `src/components/errors/route-error.tsx` | RouteError | NOT RUN |
| `src/components/labs/report-table.tsx` | ReportTable | NOT RUN |
| `src/components/layout/logout-button.tsx` | LogoutButton | NOT RUN |
| `src/components/layout/not-found-page.tsx` | metadata, NotFound | FAIL |
| `src/components/layout/page-header.tsx` | PageHeader | NOT RUN |
| `src/components/layout/site-document.tsx` | metadata, RootLayout | NOT RUN |
| `src/components/layout/site-footer.tsx` | SiteFooter | NOT RUN |
| `src/components/layout/site-header.tsx` | SiteHeader | NOT RUN |
| `src/components/layout/skip-link.tsx` | SkipLink | NOT RUN |
| `src/components/motion-provider.tsx` | MotionProvider | NOT RUN |
| `src/components/security/turnstile-widget.tsx` | TurnstileWidget | NOT RUN |
| `src/components/ui/avatar.tsx` | Avatar | NOT RUN |
| `src/components/ui/button.tsx` | Button, ButtonLink | NOT RUN |
| `src/components/ui/card.tsx` | Card, LinkCard, CardTitle | NOT RUN |
| `src/components/ui/empty-state.tsx` | EmptyState | NOT RUN |
| `src/components/ui/field.tsx` | Field, Input, Textarea, Select | FAIL |
| `src/components/ui/filter-bar.tsx` | FilterBar | NOT RUN |
| `src/components/ui/heading.tsx` | Heading | NOT RUN |
| `src/components/ui/live-region.tsx` | LiveRegion | NOT RUN |
| `src/components/ui/logo.tsx` | Logo | NOT RUN |
| `src/components/ui/option-list.tsx` | SingleSelect, MultiSelect | FAIL |
| `src/components/ui/pagination.tsx` | Pagination | NOT RUN |
| `src/components/ui/password-input.tsx` | PasswordInput | NOT RUN |
| `src/components/ui/reveal-heading.tsx` | RevealHeading | NOT RUN |
| `src/components/ui/reveal.tsx` | Reveal | NOT RUN |
| `src/components/ui/section.tsx` | Section, SectionHeading, Prose | NOT RUN |
| `src/components/ui/skeleton.tsx` | Skeleton, SkeletonCard, SkeletonGrid | NOT RUN |
| `src/components/ui/status-badge.tsx` | StatusBadge | NOT RUN |
| `src/components/ui/table.tsx` | Table | NOT RUN |
| `src/components/ui/tag.tsx` | Tag, StatusDot | NOT RUN |
| `src/components/ui/timeline.tsx` | Timeline | NOT RUN |

Source-only hypotheses still need browser reproduction: the undefined `--color-line-strong` reference and possible independently styled password/input variants. They are not registered bugs without verified visible or behavioral consequences.
