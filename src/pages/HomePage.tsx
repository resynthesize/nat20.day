import { Link } from 'react-router-dom'
import { Hero } from '../components/landing/Hero'
import { Features } from '../components/landing/Features'
import { Pricing } from '../components/landing/Pricing'
import { Footer } from '../components/landing/Footer'

export function HomePage() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          <span className="logo-text">nat20.day</span>
        </Link>
        <div className="landing-nav-links">
          <Link to="/demo" className="nav-link">Demo</Link>
          <Link to="/guide" className="nav-link">Guide</Link>
          <Link to="/docs" className="nav-link">API</Link>
          <a href="#pricing" className="nav-link">Pricing</a>
          <Link to="/app" className="nav-link nav-link-primary">Sign In</Link>
        </div>
      </nav>

      <main>
        <Hero />
        <Features />
        <Pricing />
      </main>

      <Footer />
    </div>
  )
}
