import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { BrowserContext } from 'playwright'

/**
 * Stand-ins for the two Cloudflare pieces, so the suite never depends on the internet:
 *
 *  - startTurnstileVerifyStub(): the server-side siteverify endpoint. It reports success
 *    only when the application sends the configured secret AND the token "valid-token",
 *    so a test that omits or garbles the token really is refused.
 *  - stubTurnstileScript(context): serves a tiny replacement for Cloudflare's browser
 *    script that "solves" the challenge at once with "valid-token", for tests that
 *    drive the real forms in a browser.
 */

export const TURNSTILE_TEST_SECRET = 'integration-turnstile-secret'
export const TURNSTILE_TEST_SITE_KEY = 'integration-site-key'
export const VALID_TOKEN = 'valid-token'

export type TurnstileVerifyStub = { endpoint: string; close: () => Promise<void> }

export function startTurnstileVerifyStub(): Promise<TurnstileVerifyStub> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
      const success = form.get('secret') === TURNSTILE_TEST_SECRET && form.get('response') === VALID_TOKEN
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ success, 'error-codes': success ? [] : ['invalid-input-response'] }))
    })
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}/siteverify`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      }),
    ),
  )
}

const FAKE_SCRIPT = `
window.turnstile = {
  render: function (el, options) {
    el.setAttribute('data-test-turnstile', 'rendered');
    setTimeout(function () { options.callback('${VALID_TOKEN}'); }, 0);
    return 'stub-widget';
  },
  reset: function () {},
  remove: function () {},
};
`

export async function stubTurnstileScript(context: BrowserContext): Promise<void> {
  await context.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_SCRIPT }),
  )
}
