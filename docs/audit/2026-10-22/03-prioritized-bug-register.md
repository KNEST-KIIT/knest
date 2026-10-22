# Prioritized bug register — in progress

Only current reproduced findings belong here. Source hypotheses are kept separately and are not bugs. Application code is unchanged.

## QA-001 — P3 — Field error variant has a dangling hint description

Affected: `src/components/ui/field.tsx`.

Reproduction: render the actual shared Field with a non-empty hint and error plus its Input child, using `test-results/qa-2026-10-22/component-probe.tsx`. Inspect the rendered HTML.

Expected: all component-supplied aria-describedby IDs resolve. Actual: the input refers to both error and hint, but only the error paragraph exists. The probe recorded the missing hint ID and aria-invalid=true.

Evidence: `test-results/qa-2026-10-22/component-probe.json` and `field-error-render.html`. Root cause is verified in the component: hintId is constructed and referenced even though the hint is rendered only without an error. Recommended fix: reference only rendered descriptions, or render both hint and error.

Scope/priority: **P3**. No current Field caller passes its error prop, so this is an isolated supported-component variant defect. No live-page task failure or complete WCAG violation is claimed.
