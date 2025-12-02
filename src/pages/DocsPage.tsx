/**
 * API Documentation Page
 *
 * This component is a fallback for local dev. In production, Vercel serves
 * public/docs/index.html directly via rewrites, bypassing React entirely.
 *
 * The static HTML uses Scalar CDN which avoids React Router conflicts
 * since Scalar uses hash-based navigation internally.
 */

export function DocsPage() {
  // In local dev, render an iframe pointing to the static file
  // In production, Vercel serves the static file directly (this never renders)
  return (
    <iframe
      src="/docs/index.html"
      title="API Documentation"
      style={{
        width: '100vw',
        height: '100vh',
        border: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    />
  )
}
