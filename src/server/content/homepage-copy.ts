/**
 * The approved homepage copy: docs/CONTENT_SPEC.md section 1, verbatim.
 *
 * One source for both the code fallback (used when the CMS global is empty or
 * unreadable) and the CMS seed, so the two can never drift apart. This is
 * marketing copy, not data: it makes no claim about funding, facilities,
 * rankings or outcomes. Any change needs the copy approver (HD-04), not a
 * developer.
 */
export const HOMEPAGE_COPY = {
  heroHeadline: 'WHAT IF YOU\nACTUALLY BUILT IT?',
  heroSubhead: 'Most ideas stay ideas. Not because they were bad — because nobody ever took the next step.',
  heroPrimaryCta: 'Start your journey',
  heroSecondaryCta: 'Explore programs',
  problemHeading: "THE HARDEST PART ISN'T THE IDEA.",
  problemBody:
    "You've probably had one. In a lecture, on a commute, watching something work badly and thinking someone should fix this.\n\nThen the semester moved on.\n\nThe gap between noticing something and building something is where almost everything is lost. Not to a lack of talent. To a lack of a next step.",
  personHeading: 'YOU DON’T HAVE TO BE "AN ENTREPRENEUR" YET.',
  personLines: [
    "Maybe you've had an idea.",
    "Maybe you've noticed something that doesn't work.",
    "Maybe you've wondered why nobody has fixed it.",
    "Maybe you've never thought of yourself as an entrepreneur.",
    "You don't need to.",
    'Start with the question.',
  ],
  knestHeading: 'KNEST IS WHERE YOU FIND OUT WHAT HAPPENS NEXT.',
  knestBody:
    "We're KIIT's innovation and entrepreneurship ecosystem: programs, mentors, workspace, industry access and a community of people building things — open to every student, at every stage, including the stage where you have nothing but a question.",
  closingHeading: 'THERE IS SOMETHING YOU COULD BUILD.',
  closingBody: "Let's find out what it is.",
  closingCta: 'Start your journey',
} as const
