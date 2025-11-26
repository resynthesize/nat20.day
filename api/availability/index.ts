import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe } from 'effect'
import { addWeeks, format, nextThursday, nextFriday, isThursday, isFriday } from 'date-fns'
import {
  SupabaseService,
  SupabaseServiceLive,
  DatabaseError,
  type AvailabilityWithProfile,
} from '../lib/supabase'
import { success, handleError } from '../lib/response'

// Generate Thursday/Friday dates for the next N weeks
const generateDates = (weeks: number): string[] => {
  const dates: string[] = []
  const today = new Date()
  const endDate = addWeeks(today, weeks)

  let current = today

  // Start from today if it's Thu/Fri, otherwise next Thu
  if (!isThursday(current) && !isFriday(current)) {
    current = nextThursday(current)
  }

  while (current <= endDate) {
    if (isThursday(current) || isFriday(current)) {
      dates.push(format(current, 'yyyy-MM-dd'))
    }

    // Move to next day
    if (isThursday(current)) {
      current = nextFriday(current)
    } else {
      current = nextThursday(current)
    }
  }

  return dates
}

// Fetch availability from database
const fetchAvailability = (fromDate: string, toDate: string) =>
  Effect.gen(function* () {
    const { client } = yield* SupabaseService

    const { data, error } = yield* Effect.promise(() =>
      client
        .from('availability')
        .select(
          `
          id,
          user_id,
          date,
          available,
          updated_at,
          profiles!inner (
            display_name,
            avatar_url
          )
        `
        )
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: true })
    )

    if (error) {
      return yield* Effect.fail(new DatabaseError(error.message, error.code))
    }

    return data as AvailabilityWithProfile[]
  })

// Fetch all profiles (for showing all party members)
const fetchProfiles = () =>
  Effect.gen(function* () {
    const { client } = yield* SupabaseService

    const { data, error } = yield* Effect.promise(() =>
      client.from('profiles').select('id, display_name, avatar_url').order('display_name')
    )

    if (error) {
      return yield* Effect.fail(new DatabaseError(error.message, error.code))
    }

    return data
  })

// Main handler
const handler = (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const weeks = 8
  const dates = generateDates(weeks)
  const fromDate = dates[0]
  const toDate = dates[dates.length - 1]

  const program = pipe(
    Effect.all({
      availability: fetchAvailability(fromDate, toDate),
      profiles: fetchProfiles(),
    }),
    Effect.map(({ availability, profiles }) => ({
      dates,
      availability,
      profiles,
    })),
    Effect.provide(SupabaseServiceLive)
  )

  return Effect.runPromise(program)
    .then((data) => success(res, data))
    .catch((err) => handleError(res, err))
}

export default handler
