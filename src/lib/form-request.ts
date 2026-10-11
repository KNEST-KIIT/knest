/** Forms handle HTTP errors consistently; convert transport failures to the same
 * path so a disconnected request never leaves their controls permanently busy.
 * Never retry a write automatically: the server may already have committed it.
 */
export async function formRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(30_000)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  try {
    return await fetch(input, { ...init, signal })
  } catch {
    return Response.json(
      { error: 'We couldn’t confirm that request. Check your connection and try again.' },
      { status: 503 },
    )
  }
}
