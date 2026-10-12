import { ImageResponse } from 'next/og'

/**
 * The social card shown when any page is shared and the page has no card of
 * its own. Generated at build time (nothing here reads a request), and states
 * only what the site description already states.
 */
export const alt = 'KNEST, the innovation and entrepreneurship ecosystem of KIIT'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ds-allow-hardcode:start
// The image renderer (satori) cannot read CSS custom properties, so the values of
// --color-ink, --color-paper, --color-signal and --color-line from
// src/styles/tokens.css are repeated here. Keep them in step with that file.
const INK = '#0d1321'
const PAPER = '#f8f4e9'
const SIGNAL = '#7a1f2b'
const LINE = '#ddd0a8'
// ds-allow-hardcode:end

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          color: INK,
          padding: 72,
          borderLeft: `24px solid ${SIGNAL}`,
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 6, color: SIGNAL, fontWeight: 700 }}>
          KIIT UNIVERSITY
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 168, fontWeight: 800, lineHeight: 1 }}>KNEST</div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 40, lineHeight: 1.3, maxWidth: 900 }}>
            Innovation and entrepreneurship ecosystem
          </div>
        </div>
        <div style={{ display: 'flex', borderTop: `2px solid ${LINE}`, paddingTop: 24, fontSize: 26 }}>
          Programs, mentors, workspace and community
        </div>
      </div>
    ),
    size,
  )
}
