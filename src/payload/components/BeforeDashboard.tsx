import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export const BeforeDashboard = async () => {
  const payload = await getPayload({ config: configPromise })

  // Fetch quick metrics
  const [startups, events, users] = await Promise.all([
    payload.count({ collection: 'startups' }),
    payload.count({ collection: 'events' }),
    payload.count({ collection: 'staff' }),
  ])

  const cardStyle = {
    backgroundColor: 'var(--color-paper-raised)',
    border: '1px solid var(--color-line)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '10rem',
    boxShadow: '0 1px 0.1875rem rgba(0,0,0,0.05)',
  }

  const titleStyle = {
    color: 'var(--color-ink-muted)',
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 600,
    margin: '0 0 0.5rem 0',
  }

  const metricStyle = {
    fontSize: '2.25rem',
    fontWeight: 'bold',
    color: 'var(--color-ink)',
    margin: '0 0 1rem 0',
  }

  const linkWrapperStyle = {
    marginTop: 'auto',
    paddingTop: '1rem',
    borderTop: '1px solid var(--color-line)',
  }

  const linkStyle = {
    color: 'var(--color-signal)',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <div className="knest-dashboard" style={{ marginBottom: '2rem' }}>
      <div style={{
        backgroundColor: 'var(--color-signal)',
        color: 'var(--color-paper)',
        padding: '2rem 2rem 4rem 2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--color-paper)' }}>Welcome to the KNEST Operating System</h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.9, maxWidth: '37.5rem', margin: 0 }}>
            You are managing the core infrastructure for ambition. Here you can oversee startups, events, content, and the entire incubator ecosystem.
          </p>
        </div>
        
        {/* Subtle decorative crest in the background */}
        <div style={{
          position: 'absolute',
          right: '-5%',
          bottom: '-15%',
          opacity: 0.12,
          pointerEvents: 'none'
        }}>
          <img src="/images/knest_logo_white.png" alt="" style={{ width: '23.75rem', height: 'auto', objectFit: 'contain' }} />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(15.625rem, 1fr))',
        gap: '1.5rem',
        padding: '0 1.5rem',
        marginTop: '-2rem',
        position: 'relative',
        zIndex: 20
      }}>
        
        <div style={cardStyle}>
          <h3 style={titleStyle}>Active Startups</h3>
          <div style={metricStyle}>{startups.totalDocs}</div>
          <div style={linkWrapperStyle}>
            <Link href="/admin/collections/startups/create" style={linkStyle}>
              + Add New Startup
            </Link>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={titleStyle}>Upcoming Events</h3>
          <div style={metricStyle}>{events.totalDocs}</div>
          <div style={linkWrapperStyle}>
            <Link href="/admin/collections/events/create" style={linkStyle}>
              + Publish Event
            </Link>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={titleStyle}>Staff Members</h3>
          <div style={metricStyle}>{users.totalDocs}</div>
          <div style={linkWrapperStyle}>
            <Link href="/admin/collections/staff" style={linkStyle}>
              Manage Access →
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}

