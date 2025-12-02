#!/usr/bin/env npx tsx
/**
 * OpenAPI Spec Generator
 *
 * Generates OpenAPI 3.1.0 specification from Effect HttpApi definition.
 * Run during build: `tsx scripts/generate-openapi.ts`
 * Output: public/openapi.json
 */

import { OpenApi } from "@effect/platform"
import * as fs from "fs"
import * as path from "path"
import { Nat20Api } from "../api/lib/api.js"

// Generate OpenAPI spec from Effect API definition
const spec = OpenApi.fromApi(Nat20Api)

// Add additional metadata
const enrichedSpec = {
  ...spec,
  info: {
    ...spec.info,
    title: "nat20.day API",
    version: "1.0.0",
    description: `# nat20.day API

Programmatic access to D&D session scheduling.

## Authentication

All endpoints require a Bearer token in the Authorization header:

\`\`\`
Authorization: Bearer nat20_your_token_here
\`\`\`

API tokens can be generated in your [profile settings](https://nat20.day/profile).

## Base URL

\`\`\`
https://nat20.day/api/v1
\`\`\`

## Rate Limits

Currently there are no rate limits, but please be respectful.

## Response Format

All responses follow this structure:

**Success:**
\`\`\`json
{
  "id": "...",
  "display_name": "...",
  ...
}
\`\`\`

**Error:**
\`\`\`json
{
  "_tag": "ErrorType",
  "message": "Human readable message"
}
\`\`\`

## Example: Get Your Profile

\`\`\`bash
curl -X GET https://nat20.day/api/v1/me \\
  -H "Authorization: Bearer nat20_your_token_here"
\`\`\`

## Example: List Your Parties

\`\`\`bash
curl -X GET https://nat20.day/api/v1/parties \\
  -H "Authorization: Bearer nat20_your_token_here"
\`\`\`

## Example: Set Availability

\`\`\`bash
curl -X PUT https://nat20.day/api/v1/availability/{memberId}/{date} \\
  -H "Authorization: Bearer nat20_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"available": true}'
\`\`\`
`,
    contact: {
      name: "nat20.day",
      url: "https://github.com/resynthesize/nat20.day",
    },
  },
  servers: [
    {
      url: "https://nat20.day/api/v1",
      description: "Production",
    },
  ],
}

// Ensure public directory exists
const publicDir = path.join(process.cwd(), "public")
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

// Write OpenAPI spec
const outputPath = path.join(publicDir, "openapi.json")
fs.writeFileSync(outputPath, JSON.stringify(enrichedSpec, null, 2))

console.log(`✓ Generated OpenAPI spec: ${outputPath}`)
console.log(`  Title: ${enrichedSpec.info.title}`)
console.log(`  Version: ${enrichedSpec.info.version}`)
console.log(`  Endpoints: ${Object.keys(enrichedSpec.paths || {}).length}`)
