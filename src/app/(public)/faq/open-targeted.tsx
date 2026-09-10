'use client'

import { useEffect } from 'react'

/**
 * Opens the question a link points at.
 *
 * Search results link to `/faq#faq-<id>`, and the answer lives inside a
 * `<details>`. Browsers were assumed to expand a `<details>` when the URL
 * fragment targets it — measured, and they do not: arriving from a search
 * result landed on a closed question with the answer still hidden, which is
 * the one thing the link was for.
 *
 * Fifteen lines of progressive enhancement rather than abandoning the
 * accordion: with JavaScript off, the page still works and the link still
 * scrolls to the right question, one tap from its answer.
 */
export function OpenTargetedFaq() {
  useEffect(() => {
    function openFromHash() {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return

      const target = document.getElementById(id)
      if (!(target instanceof HTMLDetailsElement)) return

      target.open = true
      // The browser already scrolled to a then-collapsed element, so the
      // position is wrong by the height of the answer that just appeared.
      target.scrollIntoView({ block: 'start' })
    }

    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
  }, [])

  return null
}
