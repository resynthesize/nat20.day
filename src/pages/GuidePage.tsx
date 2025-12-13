import { useState, useEffect, type ReactElement } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { LandingNav } from '../components/organisms/landing'
import '../styles/guide.css'

interface GuideSection {
  id: string
  title: string
  content: string
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: `
## Welcome to nat20.day

nat20.day is a scheduling tool designed for tabletop gaming groups. Whether you play D&D, Magic: The Gathering, Warhammer, or any other tabletop game, nat20.day helps you coordinate when everyone is available.

### Creating an Account

1. Visit [nat20.day/app](/app) and click **Sign Up**
2. Choose your sign-in method:
   - **Google** - Sign in with your Google account
   - **Discord** - Sign in with your Discord account
   - **Email** - Enter your email to receive a magic link (no password needed)
3. You'll be automatically logged in and ready to go

### Joining a Party

If someone has invited you to a party:
1. Make sure you sign up with the **same email** they used to invite you
2. When you log in, you'll automatically see the party in your party list
3. Click on the party to view the schedule

### Your First Steps

Once logged in, you can:
- View your party's availability schedule
- Toggle your availability for specific dates
- Create your own party (with a $10/year subscription)
`,
  },
  {
    id: 'profile',
    title: 'Profile Management',
    content: `
## Your Profile

Customize how you appear to your party members.

### Accessing Your Profile

Click your avatar or name in the header, then select **Profile**. Or go directly to [/app/profile](/app/profile).

### Display Name

Your display name is how you appear to other party members. By default, it's taken from your Google or Discord account, but you can change it to anything you like.

### Avatar

Click your avatar to upload a new photo. Images must be under 2MB. Your avatar appears in the schedule grid and when you're hosting a session.

### Address

Add your address if you plan to host sessions. When you're selected as a host for a session, your address will be pre-filled (only visible to party members).

### Per-Party Display Names

Want to use different names in different parties? You can set a custom display name for each party you're in:

1. Go to your [Profile](/app/profile)
2. Scroll to **Party Display Names**
3. Set a different name for each party

This is useful if you go by different names in different gaming groups.
`,
  },
  {
    id: 'managing-availability',
    title: 'Managing Availability',
    content: `
## Managing Your Availability

### The Schedule Grid

The main view shows a grid with:
- **Rows**: Each party member
- **Columns**: Your party's scheduled days (configurable by admins)

By default, the grid shows 8 weeks of dates. Admins can configure which days of the week appear in the schedule (see [Admin Features](/guide/admin-features)).

### Setting Your Availability

Click any cell in **your row** to toggle your availability:
- **Green checkmark**: You're available
- **Red X**: You're unavailable
- **Gray ?**: No response yet

Changes are saved instantly and visible to all party members in real-time.

### Viewing More Dates

Scroll the grid horizontally to see more dates:
- **Scroll right** to see future dates (loads automatically)
- **Scroll left** to see past dates (back to when the party was created)

The grid loads more dates as you scroll, so you can view as far into the past or future as you need.

### Session Tracker

Above the grid, you'll see a session tracker that shows:
- **Days since last session** - How long it's been since your group played
- **"Did you play?" prompt** - If everyone was available on a past date but no session was logged, you can confirm it with one click

This helps your group keep track of how often you're meeting.

### Finding Good Dates

Look for columns where most members show green checkmarks. Those are your best options for game night!

### Tips

- Update your availability as soon as you know your schedule
- If plans change, just click the cell again to update
- Other members can see your updates immediately
`,
  },
  {
    id: 'session-scheduling',
    title: 'Session Scheduling',
    content: `
## Scheduling Sessions

Plan your game nights with full session details.

### Scheduling a Session

1. Click on a date in the schedule grid
2. Click **Schedule Session** (or click the scheduled session indicator to edit)
3. Fill in the session details:
   - **Start Time** - Select a preset time or enter a custom time
   - **Host** - Choose a party member or enter a custom location
   - **Address/URL** - Physical address or virtual meeting link
   - **Virtual Meeting** - Toggle if it's online (Zoom, Discord, etc.)
4. Click **Schedule Session** to save

### Session Details

When scheduling, you can specify:

#### Host Options
- **Party Member** - Select who's hosting; their address auto-fills if set in their profile
- **Custom Location** - Enter a location name (e.g., "Game Store", "Library")

#### Meeting Type
- **In-Person** - Enter a physical address (with autocomplete)
- **Virtual** - Enter a meeting URL (Zoom, Discord, etc.)

#### Time
Choose from preset times (configured by admins) or enter a custom time.

### Viewing Scheduled Sessions

Scheduled sessions appear in two places:
- **In the grid** - A calendar icon on the date cell
- **Upcoming Dates section** - Shows the next scheduled session with details

### Editing Sessions

Click on a scheduled session in the grid to:
- Change the host, location, or time
- Toggle between virtual and in-person
- Update the address or meeting URL

### Canceling Sessions

To cancel a scheduled session:
1. Click on the session in the grid
2. Click **Cancel Session** at the bottom of the modal
3. Confirm the cancellation

Canceling removes the session but keeps everyone's availability intact.
`,
  },
  {
    id: 'creating-party',
    title: 'Creating a Party',
    content: `
## Creating Your Own Party

### Subscription

Creating a party requires a $10/year subscription. This covers:
- Unlimited party members
- Real-time availability syncing
- API access for automation
- MCP integration for AI assistants

### Creating a New Party

1. Click **"Create Party"** in the header
2. Enter your party name (e.g., "Thursday Night Crew")
3. Select your game type (D&D, MTG, Warhammer, Board Games, or Other)
4. Click **"Continue to Payment"**
5. Complete checkout with Stripe
6. You'll be redirected back and see your new party

### After Creation

You'll be automatically added as:
- A **party member** (so you can set your availability)
- A **party admin** (so you can manage the party)

### Payment

- Payment is handled securely by Stripe
- Subscriptions renew annually
- You can cancel anytime from Party Settings > Billing
`,
  },
  {
    id: 'admin-features',
    title: 'Admin Features',
    content: `
## Party Administration

If you're a party admin, you have access to additional features.

### Accessing Settings

Click **"Settings"** in the header when viewing your party to access the admin panel.

### Managing Members

In the **Members** tab you can:

#### Add Members
1. Enter the member's name
2. Optionally add their email (required if they'll log in)
3. Click **Add**

#### Remove Members
Click the **Remove** button next to any member (except yourself).

#### Promote to Admin
Click **Make Admin** to give another member admin privileges.

### Party Settings

In the **Settings** tab you can:
- Change the party name
- View and manage admin list
- Remove admin privileges from others

### Schedule Days

Configure which days of the week appear in the schedule:

1. Go to **Settings** tab
2. Under **Schedule Days**, select the days you play
3. Click **Save Settings**

Common configurations:
- **Friday + Saturday** (default) - Weekend gaming
- **Thursday + Friday** - Weeknight games
- **Any day** - Maximum flexibility

### Default Host Settings

Set defaults for new sessions:
- **Default Host** - Pre-select a party member who usually hosts
- **Default Location** - Pre-fill a custom location name

These defaults appear when scheduling new sessions, saving time.

### Time Presets

Customize the quick-select time options shown when scheduling sessions:

1. Go to **Settings** tab
2. Under **Time Presets**, configure your common start times
3. Click **Save Settings**

This lets your group quickly select from times like "6:00 PM", "7:30 PM" without typing.

### Billing

In the **Billing** tab you can:
- View subscription status
- See when your subscription renews
- Open Stripe's billing portal to:
  - Update payment method
  - View invoices
  - Cancel subscription

### Multiple Admins

Any admin can manage billing. This is useful for:
- Splitting the cost among group members
- Ensuring someone can always manage the party
`,
  },
  {
    id: 'api-access',
    title: 'API Access',
    content: `
## API & Integrations

nat20.day provides a full REST API for automation and custom integrations.

### API Documentation

Visit [/docs](/docs) for the complete API reference with:
- OpenAPI 3.0 specification
- Interactive API explorer
- Request/response examples

### API Tokens

To use the API, you need a personal access token:

1. Go to your [Profile](/app/profile)
2. Scroll to **API Tokens**
3. Click **Generate Token**
4. Copy the token (shown only once)

### Using the API

Include your token in the Authorization header:

\`\`\`bash
curl -H "Authorization: Bearer nat20_xxx" \\
  https://nat20.day/api/v1/parties
\`\`\`

### Available Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/v1/me | Get your profile |
| GET /api/v1/parties | List your parties |
| GET /api/v1/parties/:id/availability | Get party availability |
| PUT /api/v1/availability/:memberId/:date | Set availability for a date |
| DELETE /api/v1/availability/:memberId/:date | Clear availability for a date |

See the [API docs](/docs) for full request/response details.

### MCP Integration

nat20.day supports the Model Context Protocol (MCP) for AI assistant integration.

Connect to the MCP server at:
\`\`\`
https://nat20.day/api/mcp
\`\`\`

This allows AI assistants (like Claude) to:
- Check party availability
- Set or clear your availability
- View party information
- Schedule and manage sessions

### Rate Limits

There are currently no rate limits, but please be respectful of server resources
`,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    content: `
## Troubleshooting

### I can't see my party

**If you were invited:**
- Make sure you're signed in with the email that was invited
- Ask the admin to verify your email address in the member list

**If you created the party:**
- Check if you have multiple accounts (Google vs Discord)
- Use the party selector in the header to switch parties

### My availability changes aren't saving

- Check your internet connection
- Try refreshing the page
- If the problem persists, try logging out and back in

### I can't create a party

- Make sure you're logged in
- Check that payment completed successfully
- If redirected back without a party, check your email for Stripe confirmation

### Payment issues

- If checkout failed, you weren't charged - try again
- For billing questions, visit Settings > Billing > Manage Subscription
- Contact your bank if the payment is being declined

### Someone left our group

Admins can remove members from Settings > Members > Remove.

### I need to change my email

Your email is tied to your Google/Discord account. To use a different email:
1. Log out
2. Sign up with the new account
3. Ask a party admin to update your email in the member list

### The schedule shows wrong dates

The schedule shows dates based on your party's configured days (set by admins in Settings). If dates seem wrong:
- Check which days are configured in Settings > Schedule Days
- Check your system clock or browser timezone
- Ask a party admin if the days need to be updated

### Session scheduling issues

**Can't schedule a session:**
- Only admins can schedule sessions
- Make sure you've selected a date in the grid first

**Session details not showing:**
- Click on a scheduled date (marked with a calendar icon) to view details
- Check the Upcoming Dates section for the next session

**Address autocomplete not working:**
- This feature requires an internet connection
- You can always type the address manually

### Getting More Help

If you're still having trouble:
- Check our [GitHub Issues](https://github.com/resynthesize/nat20.day/issues)
- Open a new issue with details about your problem
`,
  },
]

export function GuidePage() {
  const { section } = useParams<{ section?: string }>()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Default to first section
  const currentSection = section || GUIDE_SECTIONS[0].id
  const sectionData = GUIDE_SECTIONS.find((s) => s.id === currentSection)

  // Navigate to first section if invalid
  useEffect(() => {
    if (section && !sectionData) {
      navigate('/guide/' + GUIDE_SECTIONS[0].id, { replace: true })
    }
  }, [section, sectionData, navigate])

  if (!sectionData) {
    return null
  }

  return (
    <div className="guide-page">
      <LandingNav />
      <button
        type="button"
        className="guide-mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle sidebar"
      >
        {mobileMenuOpen ? '×' : '☰'}
      </button>

      <div className="guide-container">
        <aside className={`guide-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <h2 className="guide-sidebar-title">User Guide</h2>
          <nav className="guide-sidebar-nav">
            {GUIDE_SECTIONS.map((s) => (
              <Link
                key={s.id}
                to={`/guide/${s.id}`}
                className={`guide-sidebar-link ${s.id === currentSection ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {s.title}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="guide-content">
          <div className="guide-content-inner">
            <GuideMarkdown content={sectionData.content} />
          </div>
        </main>
      </div>

      <footer className="guide-footer">
        <Link to="/">← Back to home</Link>
      </footer>
    </div>
  )
}

// Simple markdown-like renderer
function GuideMarkdown({ content }: { content: string }) {
  const lines = content.trim().split('\n')
  const elements: ReactElement[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let listItems: string[] = []
  let inList = false

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="guide-list">
          {listItems.map((item, i) => (
            <li key={i}><InlineMarkdown text={item} /></li>
          ))}
        </ul>
      )
      listItems = []
    }
    inList = false
  }

  const flushTable = () => {
    if (tableRows.length > 0) {
      const [header, ...body] = tableRows
      elements.push(
        <table key={`table-${elements.length}`} className="guide-table">
          <thead>
            <tr>
              {header.map((cell, i) => (
                <th key={i}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
      tableRows = []
    }
    inTable = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="guide-code-block">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        )
        codeBlockContent = []
        inCodeBlock = false
      } else {
        flushList()
        flushTable()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // Empty lines
    if (!line.trim()) {
      flushList()
      flushTable()
      continue
    }

    // Headers
    if (line.startsWith('## ')) {
      flushList()
      flushTable()
      elements.push(
        <h2 key={`h2-${elements.length}`} className="guide-h2">
          {line.slice(3)}
        </h2>
      )
      continue
    }

    if (line.startsWith('### ')) {
      flushList()
      flushTable()
      elements.push(
        <h3 key={`h3-${elements.length}`} className="guide-h3">
          {line.slice(4)}
        </h3>
      )
      continue
    }

    if (line.startsWith('#### ')) {
      flushList()
      flushTable()
      elements.push(
        <h4 key={`h4-${elements.length}`} className="guide-h4">
          {line.slice(5)}
        </h4>
      )
      continue
    }

    // Table rows
    if (line.includes('|')) {
      flushList()
      // Skip separator line
      if (line.match(/^\|[-:\s|]+\|$/)) {
        continue
      }
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
      tableRows.push(cells)
      inTable = true
      continue
    }

    if (inTable && !line.includes('|')) {
      flushTable()
    }

    // List items
    if (line.match(/^[-*] /)) {
      flushTable()
      listItems.push(line.slice(2))
      inList = true
      continue
    }

    if (line.match(/^\d+\. /)) {
      flushTable()
      listItems.push(line.replace(/^\d+\. /, ''))
      inList = true
      continue
    }

    if (inList && !line.match(/^[-*\d]/)) {
      flushList()
    }

    // Regular paragraph with inline formatting
    flushList()
    flushTable()
    elements.push(
      <p key={`p-${elements.length}`} className="guide-paragraph">
        <InlineMarkdown text={line} />
      </p>
    )
  }

  flushList()
  flushTable()

  return <>{elements}</>
}

function InlineMarkdown({ text }: { text: string }) {
  // Process inline code, bold, links
  const parts: (string | ReactElement)[] = []
  let remaining = text
  let keyIndex = 0

  while (remaining) {
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/)
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
    // Links
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

    type MatchInfo = { type: string; match: RegExpMatchArray; index: number }
    const isMatch = (v: MatchInfo | false | null | undefined): v is MatchInfo => Boolean(v)
    const matches = [
      codeMatch && { type: 'code', match: codeMatch, index: remaining.indexOf(codeMatch[0]) },
      boldMatch && { type: 'bold', match: boldMatch, index: remaining.indexOf(boldMatch[0]) },
      linkMatch && { type: 'link', match: linkMatch, index: remaining.indexOf(linkMatch[0]) },
    ].filter(isMatch)

    if (matches.length === 0) {
      parts.push(remaining)
      break
    }

    // Find first match
    const first = matches.reduce((a, b) => (a.index < b.index ? a : b))

    // Add text before match
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index))
    }

    // Add formatted element
    if (first.type === 'code') {
      parts.push(
        <code key={keyIndex++} className="guide-inline-code">
          {first.match[1]}
        </code>
      )
      remaining = remaining.slice(first.index + first.match[0].length)
    } else if (first.type === 'bold') {
      parts.push(<strong key={keyIndex++}>{first.match[1]}</strong>)
      remaining = remaining.slice(first.index + first.match[0].length)
    } else if (first.type === 'link') {
      const href = first.match[2]
      const isExternal = href.startsWith('http')
      parts.push(
        isExternal ? (
          <a
            key={keyIndex++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="guide-link"
          >
            {first.match[1]}
          </a>
        ) : (
          <Link
            key={keyIndex++}
            to={href}
            className="guide-link"
          >
            {first.match[1]}
          </Link>
        )
      )
      remaining = remaining.slice(first.index + first.match[0].length)
    }
  }

  return <>{parts}</>
}
