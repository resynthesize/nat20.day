import { Link } from 'react-router-dom'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="landing-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            nat20.day
          </Link>
          <p className="footer-tagline">
            D&D Session Scheduler
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-section">
            <h4 className="footer-section-title">Product</h4>
            <Link to="/demo" className="footer-link">Demo</Link>
            <Link to="/guide" className="footer-link">Guide</Link>
            <a href="#pricing" className="footer-link">Pricing</a>
          </div>

          <div className="footer-section">
            <h4 className="footer-section-title">Developers</h4>
            <Link to="/docs" className="footer-link">API Docs</Link>
            <Link to="/guide/api-access" className="footer-link">API Tokens</Link>
            <a
              href="https://github.com/resynthesize/nat20.day"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              GitHub
            </a>
          </div>

          <div className="footer-section">
            <h4 className="footer-section-title">Legal</h4>
            <Link to="/privacy" className="footer-link">Privacy</Link>
            <Link to="/terms" className="footer-link">Terms</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          &copy; {currentYear} nat20.day. All rights reserved.
        </p>
        <p className="footer-credits">
          Built with{' '}
          <span className="heart" title="love">&#10084;</span>
          {' '}for tabletop gamers everywhere.
        </p>
      </div>
    </footer>
  )
}
