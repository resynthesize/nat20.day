import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateDates } from '../lib/dates'
import { AvailabilityGrid, type GridMember, type GridAvailability } from '../components/organisms/schedule'
import { LandingNav } from '../components/organisms/landing'
import '../styles/demo.css'

const DEMO_PARTY_ID = 'party_DEMO0000'

// High-fantasy character portraits for demo members
// Art by Ravenmore (CC-BY 3.0) - https://opengameart.org/content/fantasy-portrait-pack-by-ravenmore
const DEMO_AVATARS: Record<string, string> = {
  'aldric lightbringer': '/avatars/demo/aldric.png',
  'elara moonwhisper': '/avatars/demo/elara.png',
  'grimlock the bold': '/avatars/demo/grimlock.png',
  'thorin ironforge': '/avatars/demo/thorin.png',
  'zara shadowstep': '/avatars/demo/zara.png',
}

function getAvatarUrl(name: string): string {
  const key = name.toLowerCase()
  return DEMO_AVATARS[key] || `/avatars/demo/aldric.png`
}

export function DemoPage() {
  const [members, setMembers] = useState<GridMember[]>([])
  const [availability, setAvailability] = useState<GridAvailability[]>([])
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

          // Transform to GridAvailability format
          setAvailability(
            (availData || []).map(a => ({
              memberId: a.party_member_id,
              date: a.date,
              available: a.available,
            }))
          )
        }

        // Transform to GridMember format with fantasy portraits
        setMembers(
          (membersData || []).map(m => ({
            id: m.id,
            name: m.name,
            avatarUrl: getAvatarUrl(m.name),
            isLinked: true, // Demo members are all "linked"
          }))
        )
      } catch (err) {
        console.error('Error loading demo data:', err)
        setError('Failed to load demo data')
      } finally {
        setLoading(false)
      }
    }

    loadDemoData()
  }, [])

  // Toggle availability locally (not persisted)
  const handleToggle = useCallback((memberId: string, date: string) => {
    setAvailability(prev => {
      const existing = prev.find(a => a.memberId === memberId && a.date === date)

      if (!existing) {
        // unset → available
        return [...prev, { memberId, date, available: true }]
      } else if (existing.available) {
        // available → unavailable
        return prev.map(a =>
          a.memberId === memberId && a.date === date
            ? { ...a, available: false }
            : a
        )
      } else {
        // unavailable → unset
        return prev.filter(a => !(a.memberId === memberId && a.date === date))
      }
    })
  }, [])

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
      <LandingNav />

      <div className="demo-container">
        <div className="demo-header">
          <h1>The Tavern Regulars</h1>
          <span className="demo-badge">Demo Party</span>
        </div>
        <p className="demo-description">
          This is a demo party showing how nat20.day helps coordinate schedules.
          Try clicking on cells to toggle availability!
        </p>

        <AvailabilityGrid
          members={members}
          dates={dates}
          availability={availability}
          onToggle={handleToggle}
        />

        <div className="demo-cta">
          <h2>Ready to coordinate your own party?</h2>
          <p>Create your party and start scheduling game nights in minutes.</p>
          <div className="demo-cta-buttons">
            <Link to="/app" className="demo-button primary">
              Start Your Party — $10/year
            </Link>
            <Link to="/#pricing" className="demo-button secondary">
              View Pricing
            </Link>
          </div>
        </div>

        <div className="demo-features">
          <h3>In your own party, you can:</h3>
          <ul>
            <li>Toggle your availability with a single click</li>
            <li>See real-time updates when party members respond</li>
            <li>Invite members via email</li>
            <li>Use the API or MCP to automate scheduling</li>
          </ul>
        </div>
      </div>

      <footer className="demo-footer">
        <Link to="/" className="demo-back-link">← Back to home</Link>
      </footer>
    </div>
  )
}
