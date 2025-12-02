/**
 * API Documentation Page
 *
 * Renders the OpenAPI spec using Scalar for beautiful, interactive docs.
 * Accessible publicly at /docs without authentication.
 */

import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

export function DocsPage() {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      <ApiReferenceReact
        configuration={{
          url: '/openapi.json',
          theme: 'saturn',
          darkMode: true,
          metaData: {
            title: 'nat20.day API Documentation',
          },
          hideDownloadButton: false,
          hideModels: false,
          defaultHttpClient: {
            targetKey: 'shell',
            clientKey: 'curl',
          },
        }}
      />
    </div>
  )
}
