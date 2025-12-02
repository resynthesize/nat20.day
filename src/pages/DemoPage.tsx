import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateDates, formatDateDisplay, getDayOfWeek } from '../lib/dates'

interface DemoMember {
  id: string
  name: string
}

interface DemoAvailability {
  party_member_id: string
  date: string
  available: boolean
}

const DEMO_PARTY_ID = 'party_DEMO0000'

export function DemoPage() {
  const [members, setMembers] = useState<DemoMember[]>([])
  const [availability, setAvailability] = useState<DemoAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dates = generateDates()

  useEffect(() => {
    async function loadDemoData() {
      try {
        // Fetch demo party members
        const { data: membersData, error: membersError } = await supabase
          .from('party_members')
          .select('id, name')
          .eq('party_id', DEMO_PARTY_ID)
          .order('name')

        if (membersError) throw membersError

        // Fetch availability for these members
        const memberIds = membersData?.map(m => m.id) || []
        if (memberIds.length > 0) {
          const { data: availData, error: availError } = await supabase
            .from('availability')
            .select('party_member_id, date, available')
            .in('party_member_id', memberIds)

          if (availError) throw availError
          setAvailability(availData || [])
        }

        setMembers(membersData || [])
      } catch (err) {
        console.error('Error loading demo data:', err)
        setError('Failed to load demo data')
      } finally {
        setLoading(false)
      }
    }

    loadDemoData()
  }, [])

  // Create availability lookup
  const availabilityMap = new Map<string, boolean>()
  for (const a of availability) {
    availabilityMap.set(`${a.party_member_id}-${a.date}`, a.available)
  }

  if (loading) {
    return (
      <div className="demo-page">
        <div className="demo-loading">
          <div className="loading-spinner" />
          <p>Loading demo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="demo-page">
        <div className="demo-error">
          <h2>Oops!</h2>
          <p>{error}</p>
          <Link to="/" className="demo-back-link">← Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="demo-page">
      <nav className="demo-nav">
        <Link to="/" className="demo-logo">
          nat20.day
        </Link>
        <Link to="/app" className="demo-signup-button">
          Sign Up
        </Link>
      </nav>

      <div className="demo-content">
        <div className="demo-header">
          <h1 className="demo-title">The Tavern Regulars</h1>
          <span className="demo-badge">Demo Party</span>
        </div>
        <p className="demo-subtitle">
          This is a demo party showing how nat20.day helps coordinate schedules.
          Toggle cells to see how availability tracking works!
        </p>

        <div className="demo-grid-container">
          <div className="demo-schedule-grid">
            {/* Header row with dates */}
            <div className="demo-grid-header">
              <div className="demo-grid-cell demo-grid-corner">Adventurer</div>
              {dates.map((date) => (
                <div key={date} className="demo-grid-cell demo-date-cell">
                  <span className="demo-date-day">{getDayOfWeek(date)}</span>
                  <span className="demo-date-label">{formatDateDisplay(date)}</span>
                </div>
              ))}
            </div>

            {/* Member rows */}
            {members.map(member => (
              <div key={member.id} className="demo-grid-row">
                <div className="demo-grid-cell demo-member-cell">
                  <span className="demo-member-name">{member.name}</span>
                </div>
                {dates.map((date) => {
                  const key = `${member.id}-${date}`
                  const isAvailable = availabilityMap.get(key)
                  const status = isAvailable === true
                    ? 'available'
                    : isAvailable === false
                      ? 'unavailable'
                      : 'unset'

                  return (
                    <div
                      key={key}
                      className={`demo-grid-cell demo-availability-cell demo-${status}`}
                      title={`${member.name} - ${date}: ${status}`}
                    >
                      {status === 'available' && '✓'}
                      {status === 'unavailable' && '✗'}
                      {status === 'unset' && '?'}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="demo-cta-section">
          <h2>Ready to coordinate your own party?</h2>
          <p>Create your party and start scheduling game nights in minutes.</p>
          <div className="demo-cta-buttons">
            <Link to="/app" className="cta-button cta-button-primary">
              Start Your Party — $10/year
            </Link>
            <Link to="/#pricing" className="cta-button cta-button-secondary">
              View Pricing
            </Link>
          </div>
        </div>

        <div className="demo-features">
          <h3>In your own party, you can:</h3>
          <ul className="demo-feature-list">
            <li>Toggle your availability with a single click</li>
            <li>See real-time updates when party members respond</li>
            <li>Invite members via email</li>
            <li>Use the API or MCP to automate scheduling</li>
          </ul>
        </div>
      </div>

      <footer className="demo-footer">
        <Link to="/">← Back to home</Link>
      </footer>
    </div>
  )
}
