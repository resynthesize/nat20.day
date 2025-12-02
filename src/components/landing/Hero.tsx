import { Link } from 'react-router-dom'

const taglines = [
  "Herding cats, but the cats have schedules.",
  "Because 'whenever works' never works.",
  "The real BBEG is everyone's calendar.",
  "Rolling a d20 to find a free Thursday.",
  "Your Google Calendar can't save you here.",
  "TPK: Total Party Kalendar conflict.",
  "Scheduling: the only encounter you can't fireball.",
  "Like Doodle, but with more existential dread.",
  "The dungeon master's true nemesis: adulting.",
  "Critical success requires a gathered party.",
]

export function Hero() {
  const tagline = taglines[Math.floor(Math.random() * taglines.length)]

  return (
    <section className="hero">
      <div className="hero-content">
        <h1 className="hero-title">
          Schedule your game nights
          <br />
          <span className="hero-title-accent">without the chaos</span>
        </h1>
        <p className="hero-subtitle">
          Built for D&D. Works for MTG, Warhammer, board games, and more.
        </p>
        <p className="hero-tagline">"{tagline}"</p>

        <div className="hero-cta">
          <Link to="/app" className="cta-button cta-button-primary">
            Start Your Party
          </Link>
          <Link to="/demo" className="cta-button cta-button-secondary">
            Try the Demo
          </Link>
        </div>

        <div className="hero-game-types">
          <span className="game-type-label">Works for:</span>
          <div className="game-type-icons">
            <span className="game-type" title="Dungeons & Dragons">
              <svg viewBox="0 0 24 24" className="game-icon">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/>
              </svg>
              D&D
            </span>
            <span className="game-type" title="Magic: The Gathering">
              <svg viewBox="0 0 24 24" className="game-icon">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
              MTG
            </span>
            <span className="game-type" title="Warhammer">
              <svg viewBox="0 0 24 24" className="game-icon">
                <path d="M12 2l3 6h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z"/>
              </svg>
              Warhammer
            </span>
            <span className="game-type" title="Board Games">
              <svg viewBox="0 0 24 24" className="game-icon">
                <path d="M12 4a2 2 0 100 4 2 2 0 000-4zM8 10v10h8V10H8z"/>
              </svg>
              Board Games
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
