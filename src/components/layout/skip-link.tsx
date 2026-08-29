/** First focusable element on every page: lets keyboard users bypass the nav. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-ink)] focus:px-4 focus:py-3 focus:text-[var(--color-paper)]"
    >
      Skip to content
    </a>
  )
}
