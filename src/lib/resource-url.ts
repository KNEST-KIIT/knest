export type ResourceLike = {
  id?: string | number
  title: string
  slug: string
  format?: string | null
  body?: unknown
  file?: unknown
  externalUrl?: string | null
}

export type ResourceDestination = {
  href: string
  label: string
  ctaText: string
  isExternal: boolean
  isHosted: boolean
}

/**
 * Shared destination rule for resources across public pages, student dashboard,
 * and founder dashboard. Ensures body/file/external resources navigate correctly,
 * avoids dead '#' anchors, and uses truthful neutral CTA copy unless metadata
 * explicitly proves the content type.
 */
export function resourceDestination(resource: ResourceLike): ResourceDestination {
  const hasBody = Boolean(
    resource.body && (typeof resource.body === 'object' ? Object.keys(resource.body).length > 0 : true),
  )
  const hasFile = Boolean(resource.file)
  const hosted = hasBody || hasFile
  const format = resource.format?.trim().toLowerCase()

  if (hosted) {
    let ctaText = 'View resource →'
    let labelVerb = 'View'

    if (format === 'template') {
      ctaText = hasFile ? 'Download template →' : 'View template →'
      labelVerb = hasFile ? 'Download' : 'View'
    } else if (format === 'guide') {
      ctaText = 'Read guide →'
      labelVerb = 'Read'
    } else if (format === 'article' || format === 'playbook') {
      ctaText = format === 'article' ? 'Read article →' : 'Read playbook →'
      labelVerb = 'Read'
    } else if (format === 'video') {
      ctaText = 'Watch video →'
      labelVerb = 'Watch'
    } else if (format === 'worksheet') {
      ctaText = hasFile ? 'Download worksheet →' : 'View worksheet →'
      labelVerb = hasFile ? 'Download' : 'View'
    }

    return {
      href: `/resources/${resource.slug}`,
      label: `${labelVerb} ${resource.title}`,
      ctaText,
      isExternal: false,
      isHosted: true,
    }
  }

  if (resource.externalUrl) {
    const trimmed = resource.externalUrl.trim()
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const ctaText = format === 'video' ? 'Watch video →' : 'Open resource →'
        return {
          href: parsed.toString(),
          label: `Visit ${resource.title}`,
          ctaText,
          isExternal: true,
          isHosted: false,
        }
      }
    } catch {
      // Malformed or unsafe URL fallback to internal safe resource
    }
  }

  // Safe fallback: navigate to public resource detail or collection
  return {
    href: resource.slug ? `/resources/${resource.slug}` : '/resources',
    label: `View ${resource.title}`,
    ctaText: 'View resource →',
    isExternal: false,
    isHosted: true,
  }
}
