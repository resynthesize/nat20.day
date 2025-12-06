import { Hero, Features, Pricing, Footer, LandingNav } from '../components/organisms/landing'

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
