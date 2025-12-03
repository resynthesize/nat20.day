import { Hero } from '../components/landing/Hero'
import { Features } from '../components/landing/Features'
import { Pricing } from '../components/landing/Pricing'
import { Footer } from '../components/landing/Footer'
import { LandingNav } from '../components/landing/LandingNav'

export function HomePage() {
  return (
    <div className="landing-page">
      <LandingNav />

      <main>
        <Hero />
        <Features />
        <Pricing />
      </main>

      <Footer />
    </div>
  )
}
