/**
 * The "genuinely nothing here yet" EmptyState copy from CONTENT_SPEC.md §8 —
 * hand-typed independently at every call site (three of them byte-for-byte
 * identical) before being centralized here (PHASE-7-9-RETROSPECTIVE.md §2).
 * A future copy edit touches this file, not every page that renders it.
 */

export const STARTUPS_EMPTY = {
  heading: 'THE FIRST GENERATION IS BEING BUILT.',
  body: "KNEST's first ventures are taking shape now. Their stories will be here. If you'd like one of them to be yours, this is the moment to start.",
}

export const MENTORS_EMPTY = {
  heading: 'OUR MENTOR NETWORK IS FORMING.',
  body: "We're bringing together founders, operators and investors who want to help. If that's you, we'd like to hear from you.",
}

export const EVENTS_EMPTY = {
  heading: 'Nothing scheduled right now.',
  body: "New sessions, workshops and talks are added regularly. Create an account and we'll let you know.",
}

export const PROGRAMS_EMPTY = {
  heading: 'Programs are being finalised.',
  body: "Applications open soon. Create an account and we'll tell you first.",
}

export const RESOURCES_EMPTY = {
  heading: 'Resources are on the way.',
  body: 'Guides, templates and playbooks for each stage are being written.',
}

/** A function, not a constant — the heading interpolates the search query. */
export function searchEmpty(query: string) {
  return {
    heading: `Nothing matched "${query}".`,
    body: 'Try a shorter phrase, or browse programs, events and resources.',
  }
}
