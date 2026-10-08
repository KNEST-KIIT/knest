import { NextResponse } from 'next/server'

/**
 * TEMPORARY CONTAINMENT: answers every request with a maintenance page.
 *
 * Added because the deployed build (00181d4) publishes invented content and an
 * unauthenticated lab-booking read (docs/delivery/EVIDENCE/live-deployment-2026-10-08.md)
 * and the Vercel project could not be protected from the available login.
 *
 * Remove by reverting the commit that added this file, or by releasing the fixed
 * build (branch delivery/p1-containment). It reads no environment variable, no
 * database and no cookie, so it cannot fail for configuration reasons.
 */
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>KNEST: back soon</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f4e9;color:#0d1321;
       font-family:Georgia,'Times New Roman',serif;text-align:center;padding:24px}
  main{max-width:34rem}
  h1{font-size:2rem;line-height:1.15;margin:0 0 .75rem}
  p{font-size:1.05rem;line-height:1.55;margin:0;color:#2b3350}
</style>
</head>
<body>
<main>
  <h1>KNEST is being updated.</h1>
  <p>The site is temporarily unavailable while we make improvements. Please check back soon.</p>
</main>
</body>
</html>`

export function proxy() {
  return new NextResponse(HTML, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': '86400',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}

export const config = { matcher: '/:path*' }
