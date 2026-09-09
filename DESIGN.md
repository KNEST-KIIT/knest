# KNEST Design Vocabulary (Institutional Modern)

## Aesthetic Pillars
- **Warm & Sophisticated**: Evokes high-end academia, print editorial, and prestige.
- **Architectural**: Content is structured in clean grids with deliberate asymmetry.
- **Micro-Interactions**: Hover states are elegant (e.g. underline reveals, image color blooming) rather than "bouncy" or generic.
- **Anti-Slop**: NO standard Tailwind rounded cards (`rounded-xl` with `shadow-sm` and generic gray borders). Use sharp borders, generous padding, and solid typography instead.

## Color Palette
- **Paper (Background)**: `#f6f4ee` - A warm, tactile off-white that replaces harsh `#ffffff`.
- **Ink (Text/Lines)**: `#1a1a1a` - Near black for ultimate contrast and crispness.
- **Signal (Accent)**: `#76232f` - A deep, authoritative oxblood red.
- **Archive (Muted)**: `#a6a397` - Warm gray for secondary elements.

## Typography
- **Display / Headings**: `Fraunces` - A robust, high-contrast serif. Use for all massive headlines and critical numbers.
- **Body / Interface**: `Inter` or `Outfit` - Clean, neutral sans-serifs that get out of the way.

## UI Patterns
- **Buttons**: Sharp corners (`rounded-none` or `rounded-sm`), solid oxblood fill, high contrast text. Hover states should subtly darken or slide in a background fill.
- **Cards/Containers**: If bordered, use 1px solid `#e0dfd9`. Avoid drop shadows unless they are incredibly soft and intentional (e.g., floating navs).
- **Layout**: Embrace whitespace. Use horizontal rules (`border-b`) to separate content elegantly, similar to a broadsheet newspaper.
