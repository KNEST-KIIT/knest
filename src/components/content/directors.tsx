import Image from 'next/image'
import { Heading } from '@/components/ui'

/**
 * The four Directors of KiiTNEST. Cards carry a photo, a name and a LinkedIn
 * link and nothing else: the stakeholders asked for no designations here. Their
 * KiiTNEST designations belong on the Team page once confirmed.
 */
const DIRECTORS = [
  {
    name: 'Mr. S. Samir Panda',
    photo: '/images/directors/samir-panda.jpg',
    linkedin: 'https://www.linkedin.com/in/samir-panda/',
  },
  {
    name: 'Prof. (Dr.) Saranjit Singh',
    photo: '/images/directors/saranjit-singh.jpg',
    linkedin: 'https://www.linkedin.com/in/prof-dr-saranjit-singh-24404825/',
  },
  {
    name: 'Mr. Miten Narendra Mehta',
    photo: '/images/directors/miten-mehta.png',
    linkedin: 'https://www.linkedin.com/in/mitenmehta/',
  },
  {
    name: 'Dr. Suman Bhattacharya',
    photo: '/images/directors/suman-bhattacharya.png',
    linkedin: 'https://www.linkedin.com/in/sumanity/',
  },
] as const

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-2 shrink-0" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  )
}

export function Directors() {
  return (
    <>
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">Leadership</p>
        <Heading as="h2" size="display" className="mt-2 text-3xl lg:text-4xl text-[var(--color-ink)]">
          Directors KiiTNEST
        </Heading>
      </div>

      <ul className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {DIRECTORS.map((d) => (
          <li key={d.name} className="flex min-w-0 flex-col border border-[var(--color-line)] bg-white">
            <div className="relative aspect-square w-full overflow-hidden bg-[var(--color-paper-soft)]">
              <Image
                src={d.photo}
                alt={`Portrait of ${d.name}`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover object-center"
              />
            </div>
            <div className="flex flex-1 flex-col items-start justify-between gap-2 border-t border-[var(--color-line)] p-3">
              <p className="font-[family-name:var(--font-display)] text-base md:text-lg font-bold leading-snug text-[var(--color-ink)]">
                {d.name}
              </p>
              <a
                href={d.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${d.name} on LinkedIn (opens in a new tab)`}
                className="inline-flex min-h-[2.75rem] items-center gap-1 border border-[var(--color-ink-muted)] px-3 text-xs font-bold uppercase tracking-widest text-[var(--color-ink)] transition-colors hover:border-[var(--color-signal)] hover:bg-[var(--color-signal)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)]"
              >
                <LinkedInMark />
                LinkedIn
              </a>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
