import { Link } from 'react-router-dom'

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon">
        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
    title: 'Real-time Sync',
    description: 'See when your party updates availability instantly. No refreshing needed.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
    title: 'Multi-party Support',
    description: 'Manage multiple gaming groups from one account. Switch between parties easily.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18z"/>
      </svg>
    ),
    title: 'Works for Any Game',
    description: 'D&D, MTG, Warhammer, board games, and more. Customize for your group.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon">
        <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
      </svg>
    ),
    title: 'Full REST API',
    description: 'Build your own integrations, bots, or dashboards. Complete OpenAPI documentation.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon">
        <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12z"/>
        <path d="M12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"/>
      </svg>
    ),
    title: 'MCP Server',
    description: 'Let AI assistants check and set your availability. Works with Claude and other MCP clients.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon">
        <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
      </svg>
    ),
    title: 'Mobile-friendly',
    description: 'Toggle availability from any device. No app install required.',
  },
]

export function Features() {
  return (
    <section className="features" id="features">
      <div className="features-content">
        <h2 className="section-title">Everything your party needs</h2>
        <p className="section-subtitle">
          Simple scheduling with powerful features for gamers who also code.
        </p>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon-wrapper">
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="developer-callout">
          <div className="developer-callout-content">
            <h3 className="developer-callout-title">
              Built by gamers, for gamers (who also code)
            </h3>
            <p className="developer-callout-text">
              Full API access with every subscription. Generate API tokens, explore our OpenAPI spec,
              or connect your AI assistant via MCP.
            </p>
            <div className="developer-callout-links">
              <Link to="/docs" className="developer-link">
                <svg viewBox="0 0 24 24" className="developer-link-icon">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                </svg>
                API Docs
              </Link>
              <Link to="/guide/api-access" className="developer-link">
                <svg viewBox="0 0 24 24" className="developer-link-icon">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
                API Tokens
              </Link>
            </div>
          </div>
          <div className="developer-callout-code">
            <pre className="code-block">
              <code>{`curl -X GET "https://nat20.day/api/v1/parties" \\
  -H "Authorization: Bearer nat20_xxx"`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
