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

## CMS and result-summary variants

- QA-012: On the Event editor, date inputs and seven select/relationship comboboxes lack accessible names; rich text is also unnamed. Visible date/select labels target wrapper elements instead of inputs. Title is correctly labelled. Source tracing is limited to the installed Payload 3.90.2 DateTime/Select renderers; no framework-wide or assistive-technology acceptance is inferred.
- QA-014/QA-015: CMS publication accepts an inverted event date range and an invalid registration target; the public details then show misleading availability or an unusable Register action.
- QA-016: The extracted shared resultSummary helper uses a plural verb for one filtered result. Its zero/plural assertions pass, and functional event filtering is unaffected. Actual one-result browser text and the pure-helper probe agree.

The rich-text Tab behavior observed during discovery remains an unconfirmed hypothesis; no keyboard-trap allegation is made without an escape/keyboard-mode replay.

## Homepage controls and content safeguards

- QA-017: Three independently exposed narrative controls actually share the Problem rendering branch. Person/KNEST flags cannot independently hide their content.
- QA-018: The fixed section model is enforced by row count and allowed values only; a duplicate Hero key visibly duplicates the hero. This requires an authorized content request and is not a privilege bypass.
- QA-019: A required checkbox does not require affirmative consent. Unchecked/missing consent saves, including in the real form, and the attributed quote is anonymously readable.
- QA-020: The CMS permission refusal incorrectly asks a valid signed-in staff member to log in. Enforcement works and the navigation shell remains.
- QA-021: Selected testimonial/metric relationships are persisted but have no homepage renderer. Internal metric source redaction works.

The section keyboard-sort attempt remains unaccepted: Space activated sorting, repeated ArrowDown left the same target in expanded and collapsed layouts, and Escape cancelled. Its cause and pointer behavior remain to verify; no framework-wide keyboard defect is registered from that attempt. A valid stored order change did render in the correct order. Original homepage content/settings and public headings were restored and reconciled.

## Relationship and mentor variants

- QA-022: The accepted-founder dashboard does not consume the profile/startup relation promised by Journey 3. Public graph storage and propagation work; the missing account-facing card/link is independently reproduced.
- QA-002 now includes the Mentor need selector: Product remains checked/focused on ArrowDown, with all nine radio buttons as tab stops. Pointer filter behavior passed for every option.
- QA-006 now also has startup/mentor detail not-found snapshots with nested main landmarks; no new bug count is added for the shared boundary.
- The new Mentor draft/publish/unavailable/unpublish states, public profile, directory and linked dashboard were executed. Current samples include all three availability categories and preserve honest ordering; an unavailable profile remains visible.
- Story editing and rendering order were checked. A supported API reorder preserves row identity and public order, but does not accept unexecuted drag controls or rich-text toolbar variants.

The public mentor radiogroup is unnamed in the saved snapshot despite the visible I need help with question; question association remains a separately queued semantic review. No screen-reader pass or comprehensive Mentor accessibility claim follows from the functional lifecycle.
