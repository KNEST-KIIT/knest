import { cn } from '@/lib/cn'

/**
 * The KNEST logo.
 *
 * Reconstructed from the wordmark installed in the KNEST office: lowercase
 * `knest`, with the "e" replaced by a filled brand-green disc carrying a
 * rocket knocked out of it. Before this existed the header and footer just
 * rendered the string "KNEST" in caps — which is not the logo, and is not
 * even the right casing.
 *
 * Two pieces, because they have genuinely different jobs:
 *   - `KnestMark`     — the disc alone. The app icon, the favicon, and the
 *                       header at very narrow widths, where a wordmark would
 *                       either wrap or shrink below legibility.
 *   - `KnestWordmark` — the full lockup. Everywhere there is room for it.
 *
 * The letters are set in the text face (Instrument Sans 600, already loaded
 * for body copy — the lockup costs no extra font weight) rather than traced
 * as paths. The disc is the part that carries the identity; the letters
 * around it are a plain geometric lowercase, and setting them in a real font
 * keeps them correctly hinted at every size instead of approximated by hand.
 *
 * NOTE: this is drawn from a photograph, not from the original vector. If the
 * source file turns up, replace the paths in `RocketGlyph` — everything else
 * (sizing, alignment, colour) is already driven by tokens and will still hold.
 */

/**
 * The rocket inside the disc.
 *
 * Drawn upright in a 24-unit box, then tilted, the way it sits in the sign.
 * Its bounding box is x 4..20, y 1.5..21.6 — centre (12, 11.55), and the
 * furthest corner is ~12.85 away from that centre in every direction, so the
 * shape occupies the same circle whatever the rotation. The transform below
 * puts that centre on the disc's centre and scales it to a radius of ~27.6
 * inside the disc's 50, which leaves the ring of green the mark needs to
 * still read as a filled "e" at wordmark sizes.
 *
 * Tuned by rendering it at 16/24/32/64/128px and looking at it: earlier
 * passes were too small (it read as a bullet point) and then too large (the
 * fins merged into the body and it read as a paper plane).
 */
function RocketGlyph({ fill }: { fill: string }) {
  return (
    <g transform="rotate(-40 50 50) translate(24.20 25.17) scale(2.15)">
      {/* Body: pointed nose, straight flanks, flat tail. */}
      <path d="M12 1.5c2.9 3 4.5 6.6 4.5 9.9v7.1h-9v-7.1c0-3.3 1.6-6.9 4.5-9.9Z" fill={fill} />
      {/* Fins, swept back off the lower flanks. */}
      <path d="M7.5 13.2 4 19v2.6l3.5-2.1Z" fill={fill} />
      <path d="M16.5 13.2 20 19v2.6l-3.5-2.1Z" fill={fill} />
      {/* Porthole — punched back out in the disc colour, so it reads as a hole. */}
      <circle cx="12" cy="8.6" r="1.8" fill="var(--knest-mark-disc)" />
    </g>
  )
}

/**
 * The disc on its own.
 *
 * `--knest-mark-disc` and `--knest-mark-glyph` are set here rather than
 * hardcoded so the mark can invert on a dark ground (see `inverted`) without
 * a second copy of the artwork.
 */
export function KnestMark({
  className,
  inverted = false,
  title,
}: {
  className?: string
  inverted?: boolean
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('block', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={
        {
          '--knest-mark-disc': inverted ? 'var(--color-ink)' : 'var(--color-signal)',
          '--knest-mark-glyph': inverted ? 'var(--color-signal)' : 'var(--color-paper)',
        } as React.CSSProperties
      }
    >
      <circle cx="50" cy="50" r="50" fill="var(--knest-mark-disc)" />
      <RocketGlyph fill="var(--knest-mark-glyph)" />
    </svg>
  )
}

/**
 * The full lockup.
 *
 * Sized in `em` throughout, so the caller sets one font-size and the disc,
 * the tracking and the optical baseline shift all follow. The disc is
 * deliberately larger than the font's x-height (0.72em against roughly
 * 0.53em) and dropped slightly below the baseline — an "o"-shaped counter
 * needs overshoot at both ends to look the same height as a flat-sided "n",
 * and here the shape is a full disc, so it needs more of it.
 */
export function KnestWordmark({
  className,
  inverted = false,
  label = 'KNEST',
}: {
  className?: string
  inverted?: boolean
  label?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-[family-name:var(--font-text)] font-semibold',
        'lowercase leading-none tracking-[-0.035em] select-none',
        className,
      )}
    >
      {/* One accessible name for the whole lockup — a screen reader should
          hear the brand once, not "kn", an image, then "st". */}
      <span className="sr-only">{label}</span>
      <span aria-hidden className="inline-flex items-baseline">
        kn
        <KnestMark
          inverted={inverted}
          className="mx-[0.03em] h-[0.72em] w-[0.72em] translate-y-[0.085em]"
        />
        st
      </span>
    </span>
  )
}
