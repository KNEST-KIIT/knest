/**
 * The current time, behind a function. Server pages need "now" to compute what is upcoming or recent;
 * calling Date.now() directly inside a component trips the render-purity lint rule, and a named
 * helper also makes the intent clear (and is easy to replace in a test).
 */
export const nowMs = () => Date.now()
export const daysAgo = (days: number, from = nowMs()) => new Date(from - days * 86_400_000)
