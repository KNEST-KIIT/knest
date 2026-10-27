import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface HomeLinkProps extends ComponentPropsWithoutRef<'a'> {
  children?: ReactNode
}

/**
 * A plain native anchor for brand home navigation.
 * Full-document navigation intentionally lets the browser run the dirty-form
 * `beforeunload` guard naturally and exactly once.
 */
export function HomeLink({ href = '/', children, ...props }: HomeLinkProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}

