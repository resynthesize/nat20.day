/**
 * nat20.day Programmatic API v1
 *
 * This serverless function handles all /api/v1/* routes using Effect HttpApi.
 * Documentation is auto-generated at /docs from the API schema definitions.
 *
 * Endpoints:
 *   GET  /api/v1/me                              - Get user profile
 *   GET  /api/v1/parties                         - List user's parties
 *   GET  /api/v1/parties/:id/availability        - Get availability for a party
 *   PUT  /api/v1/availability/:memberId/:date    - Set availability
 *   DELETE /api/v1/availability/:memberId/:date  - Clear availability
 *
 * All endpoints require Bearer token authentication:
 *   Authorization: Bearer nat20_...
 */

import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { Layer } from "effect"
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { Nat20ApiLive } from "./lib/handlers.js"
import { Nat20Api } from "./lib/api.js"

// Create web handler from Effect API
// The API layer is provided with handler implementations
const ApiLive = HttpApiBuilder.api(Nat20Api).pipe(
  Layer.provide(Nat20ApiLive)
)

// Merge with HttpServer.layerContext to provide DefaultServices alongside Api
const { handler } = HttpApiBuilder.toWebHandler(
  Layer.merge(ApiLive, HttpServer.layerContext),
  { middleware: HttpMiddleware.logger }
)

/**
 * Vercel serverless function handler
 *
 * Bridges the Vercel request/response model to Effect's web handler.
 */
export default async function vercelHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    res.status(200).end()
    return
  }

  try {
    // Convert Vercel request to standard Request
    const url = new URL(req.url || "/", `https://${req.headers.host}`)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(", ") : value)
      }
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    })

    // Handle with Effect
    const response = await handler(request)

    // Set status and headers
    res.status(response.status)
    response.headers.forEach((value, key) => {
      // Don't override CORS headers we already set
      if (!key.toLowerCase().startsWith("access-control-")) {
        res.setHeader(key, value)
      }
    })

    // Send response body
    const body = await response.text()
    res.send(body)
  } catch (error) {
    console.error("API error:", error)
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    })
  }
}
