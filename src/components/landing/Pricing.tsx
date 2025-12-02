import { Link } from 'react-router-dom'

export function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="pricing-content">
        <h2 className="section-title">Simple pricing</h2>
        <p className="section-subtitle">
          One price. All features. Less than a set of dice.
        </p>

        <div className="pricing-card">
          <div className="pricing-card-header">
            <span className="pricing-badge">Per Party</span>
            <div className="pricing-amount">
              <span className="pricing-currency">$</span>
              <span className="pricing-value">10</span>
              <span className="pricing-period">/year</span>
            </div>
          </div>

          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg viewBox="0 0 24 24" className="check-icon">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              Unlimited party members
            </li>
            <li className="pricing-feature">
              <svg viewBox="0 0 24 24" className="check-icon">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              Real-time availability sync
            </li>
            <li className="pricing-feature">
              <svg viewBox="0 0 24 24" className="check-icon">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              Full REST API access
            </li>
            <li className="pricing-feature">
              <svg viewBox="0 0 24 24" className="check-icon">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              MCP server for AI assistants
            </li>
            <li className="pricing-feature">
              <svg viewBox="0 0 24 24" className="check-icon">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              Admin controls & member management
            </li>
            <li className="pricing-feature">
              <svg viewBox="0 0 24 24" className="check-icon">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              Works for any tabletop game
            </li>
          </ul>

          <Link to="/app" className="pricing-cta">
            Start Your Party
          </Link>

          <p className="pricing-note">
            Create multiple parties? Each one is $10/year.
          </p>
        </div>

        <div className="pricing-demo-note">
          <p>
            Not sure yet?{' '}
            <Link to="/demo" className="demo-link">Try the demo</Link>
            {' '}to explore all features before you commit.
          </p>
        </div>
      </div>
    </section>
  )
}
