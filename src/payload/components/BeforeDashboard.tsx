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
    backgroundColor: '#ffffff',
    border: '1px solid #e0dfd9',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '160px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }

  const titleStyle = {
    color: '#4a4a4a',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 600,
    margin: '0 0 8px 0',
  }

  const metricStyle = {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#1a1a1a',
    margin: '0 0 16px 0',
  }

  const linkWrapperStyle = {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid #e0dfd9',
  }

  const linkStyle = {
    color: '#76232f',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <div className="knest-dashboard" style={{ marginBottom: '32px' }}>
      <div style={{
        backgroundColor: '#76232f',
        color: '#f6f4ee',
        padding: '32px 32px 64px 32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#f6f4ee' }}>Welcome to the KNEST Operating System</h1>
          <p style={{ fontSize: '18px', opacity: 0.9, maxWidth: '600px', margin: 0 }}>
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
          <img src="/images/knest_logo_white.png" alt="" style={{ width: '380px', height: 'auto', objectFit: 'contain' }} />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        padding: '0 24px',
        marginTop: '-32px',
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

