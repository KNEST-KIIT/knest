import { getPayload } from 'payload'
import Link from 'next/link'
import configPromise from '@payload-config'
import { requireStaff } from '@/server/auth/guards'
import { canAccessArea } from '@/server/auth/roles'

export const BeforeDashboard = async () => {
  const user = await requireStaff()
  const payload = await getPayload({ config: configPromise })
  const role = user.staffRole ?? null
  const now = new Date().toISOString()
  const [startups, events] = await Promise.all([
    canAccessArea(role, 'startups') ? payload.count({ collection: 'startups', where: { _status: { equals: 'published' } } }) : null,
    canAccessArea(role, 'content') ? payload.count({ collection: 'events', where: { and: [{ _status: { equals: 'published' } }, { startsAt: { greater_than: now } }] } }) : null,
  ])
  const tasks = [
    ...(startups ? [{ title: 'Published startups', count: startups.totalDocs, href: '/admin/collections/startups/create', action: 'Add a startup' }] : []),
    ...(events ? [{ title: 'Upcoming published events', count: events.totalDocs, href: '/admin/collections/events/create', action: 'Create an event' }] : []),
    ...(canAccessArea(role, 'mentors') ? [{ title: 'Mentor profiles', href: '/admin/collections/mentors', action: 'Review mentor profiles' }] : []),
    ...(canAccessArea(role, 'programs') ? [{ title: 'Programs', href: '/admin/collections/programs', action: 'Manage programs' }] : []),
  ]
  return <section className="knest-dashboard" style={{ marginBottom: '2rem' }}>
    <h1>Content management</h1>
    <p>Create drafts, check the details and publish when ready. The collections below show the content available to your role.</p>
    <p style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      <Link href="/admin/overview">← Staff overview</Link>
      {canAccessArea(role, 'enquiries') && <Link href="/admin/enquiries">Read enquiries</Link>}
      {canAccessArea(role, 'users') && <Link href="/admin/members">Manage member access</Link>}
      <Link href="/">View website</Link>
    </p>
    {tasks.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
      {tasks.map((task) => <div key={task.href} style={{ border: '1px solid var(--theme-elevation-150)', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem' }}>{task.title}</h2>
        {'count' in task && <p style={{ fontSize: '2rem', margin: '0.75rem 0' }}>{task.count}</p>}
        <Link href={task.href}>{task.action} →</Link>
      </div>)}
    </div>}
  </section>
}
