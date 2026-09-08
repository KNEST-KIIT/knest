/**
 * KNEST's mark, for Payload's login screen and nav.
 *
 * Deliberately typographic rather than the raster logo in /public: these render
 * at two very different sizes (a nav corner and a login header), and the JPEG
 * has a white ground that would sit as a pale block on the parchment. Drawn as
 * text in the display face, it takes the admin theme with it.
 */

export function AdminIcon() {
  return (
    <span
      aria-hidden
      style={{
        fontFamily: 'var(--font-serif)',
        fontWeight: 600,
        fontSize: '1.05rem',
        letterSpacing: '0.04em',
        color: 'var(--theme-elevation-1000)',
      }}
    >
      K
    </span>
  )
}

export function AdminLogo() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.5rem',
        fontFamily: 'var(--font-serif)',
        color: 'var(--theme-elevation-1000)',
      }}
    >
      <span style={{ fontSize: '1.6rem', fontWeight: 600, letterSpacing: '0.06em' }}>KNEST</span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          color: 'var(--theme-elevation-500)',
        }}
      >
        Content
      </span>
    </span>
  )
}
