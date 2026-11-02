/**
 * Runs a server action from a client component and turns a thrown error into the same `{ ok: false, error }`
 * the action returns for a refusal. A server action throws for things the form cannot prevent (a dropped
 * connection, a session that expired while the page was open, a rate limit); without this the button stays
 * stuck on its busy state and the person is never told their change was not saved.
 */
export const ACTION_FAILED = 'That did not go through. Check your connection and that you are still signed in, then try again.'

export async function safely<T extends { ok: boolean }>(run: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await run()
  } catch {
    return { ok: false, error: ACTION_FAILED }
  }
}
