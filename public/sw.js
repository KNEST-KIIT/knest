/* KNEST lab attendance service worker.
 *
 * Scope: /lab-device only. It caches the app shell (the one public, personal-data-free page and its
 * static assets) so the pass and scan screens open with no network.
 *
 * What it never does:
 *   - cache any authenticated HTML, /dashboard/* page or /api/* response;
 *   - keep personal data in Cache Storage (the 24 h roster lives in IndexedDB, wiped on log out);
 *   - require Background Sync. iOS Safari has none; the page syncs on open and on `online`. The
 *     `sync` handler below is an enhancement where the browser offers it (Chrome, Samsung Internet).
 *
 * Plain JavaScript, no imports, no eval: it must pass a strict CSP (worker-src 'self').
 */

const SHELL_CACHE = 'knest-lab-shell-v1'
const CACHE_PREFIX = 'knest-lab-'
const SHELL_PATH = '/lab-device'
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png']
const SYNC_TAG = 'knest-lab-outbox'
const DB_NAME = 'knest-lab-attendance'
const BATCH = 50

// Every static file the shell page references (scripts, styles, and the fonts its styles name), so a
// reload with no network finds the whole page, not only the files a previous visit happened to load.
const STATIC_REF = /\/_next\/static\/[A-Za-z0-9_\-./~%]+/g
async function precacheReferenced(cache, text) {
  const found = new Set(text.match(STATIC_REF) || [])
  const added = []
  for (const path of found) {
    try {
      const url = new URL(path, self.location.origin).href
      if (await cache.match(url, { ignoreSearch: true })) continue
      const res = await fetch(url, { credentials: 'omit' })
      if (res.ok) {
        await cache.put(url, res.clone())
        if (path.endsWith('.css')) added.push(await res.text())
      }
    } catch (_) {
      /* a missing optional chunk must not break the install */
    }
  }
  // fonts and images named inside the stylesheets
  for (const css of added) {
    const refs = new Set((css.match(STATIC_REF) || []))
    for (const path of refs) {
      try {
        const url = new URL(path, self.location.origin).href
        if (await cache.match(url, { ignoreSearch: true })) continue
        const res = await fetch(url, { credentials: 'omit' })
        if (res.ok) await cache.put(url, res)
      } catch (_) {
        /* ignore */
      }
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      // The shell page itself is public. Failure (flag off, offline) is fine: it is cached on first visit.
      try {
        const res = await fetch(SHELL_PATH, { credentials: 'omit', cache: 'no-store' })
        if (res.ok) {
          const html = await res.clone().text()
          await cache.put(SHELL_PATH, res)
          await precacheReferenced(cache, html)
        }
      } catch (_) {
        /* not available yet */
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

const isStatic = (url) => url.origin === self.location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // never cached, never intercepted

  if (request.mode === 'navigate' && (url.pathname === SHELL_PATH || url.pathname === SHELL_PATH + '/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE)
        try {
          const fresh = await fetch(request)
          // Only a plain 200 that is not a redirect to a sign-in page is kept.
          if (fresh.ok && !fresh.redirected && fresh.type === 'basic') await cache.put(SHELL_PATH, fresh.clone())
          return fresh
        } catch (_) {
          const cached = await cache.match(SHELL_PATH)
          if (cached) return cached
          const offline = await cache.match('/offline.html')
          return offline || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
        }
      })(),
    )
    return
  }

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE)
        // Build ids and deployment queries change the URL but not the content of a hashed file.
        const hit = (await cache.match(request)) || (await cache.match(request.url, { ignoreSearch: true }))
        if (hit) return hit
        try {
          const res = await fetch(request)
          if (res.ok && res.type === 'basic') await cache.put(request, res.clone())
          return res
        } catch (_) {
          return new Response('', { status: 504, statusText: 'Offline and not cached' })
        }
      })(),
    )
  }
  // anything else: the browser handles it as if there were no service worker
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'wipe') {
    event.waitUntil(
      (async () => {
        for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name)
      })(),
    )
  } else if (data.type === 'precache' && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SHELL_CACHE)
        for (const raw of data.urls.slice(0, 80)) {
          try {
            const url = new URL(raw, self.location.origin)
            if (isStatic(url) && !(await cache.match(url.href))) await cache.add(url.href)
          } catch (_) {
            /* ignore */
          }
        }
      })(),
    )
  }
})

// ---- Background Sync (best effort; the page also syncs on open and on `online`) ----------------

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => req.transaction.abort() // the page creates the stores; never create them here
  })
}
const wrap = (req) => new Promise((resolve, reject) => ((req.onsuccess = () => resolve(req.result)), (req.onerror = () => reject(req.error))))

async function flushOutbox() {
  const db = await openDb()
  const all = await wrap(db.transaction('outbox', 'readonly').objectStore('outbox').getAll())
  const pending = all.filter((item) => item && item.result === null).sort((a, b) => a.createdAt - b.createdAt)
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH)
    const res = await fetch('/api/lab-attendance/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ clientNowMs: Date.now(), events: slice.map((s) => s.token) }),
    })
    if (res.status === 401) return // signed out: leave everything queued
    if (!res.ok) throw new Error('server ' + res.status) // makes the browser retry the sync later
    const data = await res.json()
    const store = db.transaction('outbox', 'readwrite').objectStore('outbox')
    slice.forEach((item, n) => {
      const r = data.results && data.results[n]
      // Another person's event (a different account is signed in) stays queued for its owner.
      if (!r || r.code === 'not-your-key') return
      store.put(
        { ...item, lastError: null, result: { status: r.status, code: r.code, verified: !!(r.check && r.check.state === 'verified'), at: Date.now() } },
        item.id,
      )
    })
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushOutbox())
})
