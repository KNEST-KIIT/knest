# E5.10 Motion and reduced motion

Sources: `src/components/motion-provider.tsx`, `src/styles/globals.css`, `src/styles/tokens.css:81-88`, `src/lib/motion.ts`, `src/components/ui/{reveal,reveal-heading,option-list}.tsx`, `src/app/(public)/{journey-selector,the-journey}.tsx`, `src/app/(member)/onboarding/{step-shell,onboarding-flow}.tsx`, `src/components/content/triple-helix.tsx`. Library: `framer-motion ^13.1.1` (`package.json:40`).

## 1. Three mechanisms

1. **framer-motion**, in eight client files. Every animated element sits under `MotionProvider`, which is `<MotionConfig reducedMotion="user">` in the root layout (`motion-provider.tsx:6-8`, `layout.tsx:28`). With `"user"`, framer-motion skips transform and layout animations when the OS asks for reduced motion and keeps opacity and colour changes (the file comment says "transforms and layout stop; fades remain"). This is framer-motion behaviour as described by the repository comment; it was not verified against the library here.
2. **CSS keyframes and transitions** from Tailwind utilities (`animate-pulse`, `animate-spin`, `transition-*`, `hover:-translate-y-0.5`). One global override covers them (section 2).
3. **Decorative duration tokens** `--motion-fast 0.2s`, `--motion-rise 0.7s`, `--motion-sheen 1.5s`, `--motion-settle 2s`, and `--motion-instant 0.01ms` (`tokens.css:84-88`).

## 2. The global CSS floor

`globals.css:41-50`, inside `@layer base`:

```
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: var(--motion-instant) !important;
    animation-iteration-count: 1 !important;
    transition-duration: var(--motion-instant) !important;
    scroll-behavior: auto !important;
  }
}
```

Why 0.01 ms rather than `none`: elements keep their final state and still fire `animationend`/`transitionend`, so code waiting on those events does not hang. Why `!important`: Tailwind utilities and arbitrary values would otherwise win on specificity. Limits: it does not stop JavaScript-driven animation (framer-motion's own JS animations; that is what the provider is for), nor `animation-delay`, so a delayed CSS animation still waits before snapping to its end state.

Evidence: the browser suite runs every scan with `reducedMotion: 'reduce'` (`35-accessibility.test.ts:31`) and the test "respects reduced motion" asserts no infinitely running CSS animation on `/` (`:302-312`). It does not test the "no preference" case, so a regression in entrance behaviour for normal users would not be seen.

## 3. What animates, where

| Element | Mechanism | Duration | Under reduced motion |
|---|---|---|---|
| Hero headline, subhead, CTAs (`hero.tsx`, `reveal*.tsx`) | framer `useInView` once, `y` and `opacity` | 0.8 s plus 0.1 s per line and fixed delays 0.4/0.6 s | transforms skipped, opacity kept |
| "What KNEST actually gives you" section (`page.tsx:79-93`) | `Reveal` | 0.8 s, 0.05 s stagger | same |
| Journey selector list and answer panel (`journey-selector.tsx:83,119-125`) | framer `AnimatePresence`, shared `layoutId` highlight | 0.5 s, 0.1 s stagger | layout and transform skipped |
| Trajectory stage panel (`the-journey.tsx:145-152`) | `AnimatePresence`, 8px rise | 0.25 s | fade only |
| Onboarding step change and progress bar (`step-shell.tsx:58-93,101-108`) | `AnimatePresence mode="wait"`, 20px slide, spring bar | 0.4 s | slide skipped; fade kept |
| Option cards (`option-list.tsx:24-37`) | hover/tap scale, background colour tween | 0.2 s | scale skipped |
| Triple helix popover (`triple-helix.tsx:244-250`) | scale and opacity | 0.16 s | fade only |
| Buttons, cards, header | CSS transitions 200-700 ms, sheen 1.5 s on hover | various | forced to 0.01 ms |
| Skeletons, spinner | `animate-pulse`, `animate-spin` | infinite | iteration count forced to 1 |

Dead code: `src/lib/motion.ts` (85 lines of framer `Variants`, "Artistic Motion Library") is imported by nothing, and `.animate-rise-fade` in `globals.css:62-74` is used by no component (searched `src`). `fill-down` is referenced but never defined (E5.06).

## 4. Failure modes

1. **Content hidden until JavaScript runs.** `Reveal` renders `initial={{opacity:0, y:30}}` (`reveal.tsx:21`) and `RevealHeading` renders each line at `y:'100%'` inside an `overflow-hidden` wrapper (`reveal-heading.tsx:29-34`). The server HTML therefore carries those inline styles. The hero `h1`, subhead and both CTAs, and the five "what KNEST offers" rows, are invisible until hydration completes and the `IntersectionObserver` fires. With JavaScript blocked or failing, or a very slow bundle, the first screen of the home page is blank except for the image. The text is in the DOM, so crawlers and screen readers read it, but sighted no-JS users do not. Reduced motion does not cure this: it changes how the animation plays, not the initial hidden state.
2. **`useInView` with `margin: '-10% 0px'`** (`reveal.tsx:16`) shrinks the observation root by 10% at top and bottom, so an element positioned entirely inside the last 10% of the viewport when scrolled to the page end can never intersect and stays hidden with `once: true`. No current `Reveal` sits at the page bottom (the closing section is not wrapped), but the offer rows are near the end of a short viewport on large screens; this was not browser-tested here.
3. **Heading split on newline.** `RevealHeading` requires a `string` child and splits on `\n` (`reveal-heading.tsx:13-23`); CMS text with literal newlines becomes separate blocks, which is intended for `heroHeadline`, and each line sits in an `overflow-hidden` box. Whether tight line heights clip descenders was not checked visually.
4. **Duration guidance.** The project rules cap UI transitions at 500 ms and prefer 100-300 ms (`.claude/rules/brand-and-operations.md`). 0.8 s entrances, 0.5-0.7 s card/button transitions (`card.tsx:16`, `button.tsx:9`) and 1.5-2 s sheen/settle durations exceed it. They are decorative and neutralised for reduced motion, but the numbers are not tokenised consistently: many are literal `duration-500`/`duration-700` classes and numeric framer values, bypassing the `--motion-*` tokens (the lint cannot see Tailwind `duration-*` or numeric JS values).
5. **Fixed noise overlay.** `body::before` is a fixed full-viewport SVG filter image with `mix-blend-mode: multiply` at `z-index: 9999` (`globals.css:19-28`). It is `pointer-events: none`, so it never blocks input, but a full-screen blended layer forces compositing on every frame and sits above focus rings; performance on low-end devices was not measured. It is not disabled for reduced motion because it is static.
6. **Header `transition-all duration-500`** animates every property when `scrolled` flips (`site-header.tsx:83`), including layout-affecting ones if classes change.

## 5. How to add motion safely

- Prefer opacity/colour; if a transform is essential, use framer-motion so the provider handles it, or a Tailwind transition (covered by the CSS floor).
- Never start content at `opacity-0` or off-screen without a no-JS fallback; follow `animate-rise-fade`'s model, which is CSS-only and finishes at the visible state.
- Use `--motion-*` tokens for new decorative durations.
- Add the page to the `reducedMotion: 'reduce'` list in `35-accessibility.test.ts` and consider a second pass with no preference to catch content that stays hidden.
