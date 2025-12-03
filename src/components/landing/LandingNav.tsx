import { Link } from 'react-router-dom'

export function LandingNav() {
  return (
    <nav className="landing-nav">
      <Link to="/" className="landing-logo">
        <span className="logo-text">nat20.day</span>
      </Link>
      <div className="landing-nav-links">
        <Link to="/demo" className="nav-link">Demo</Link>
        <Link to="/guide" className="nav-link">Guide</Link>
        <Link to="/docs" className="nav-link">API</Link>
        <Link to="/app" className="nav-link nav-link-primary">Sign In</Link>
      </div>
    </nav>
  )
}
