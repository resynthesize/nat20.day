import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe, Array as Arr } from 'effect'
import { addWeeks, format, nextThursday, nextFriday, isThursday, isFriday } from 'date-fns'
import {
  SupabaseService,
  SupabaseServiceLive,
  runQuery,
  type AvailabilityWithProfile,
} from '../lib/supabase'
import { success, handleError } from '../lib/response'

// Pure date generation using unfold pattern
const generateDates = (weeks: number): ReadonlyArray<string> => {
  const today = new Date()
  const endDate = addWeeks(today, weeks)

  // Find starting date (today if Thu/Fri, else next Thursday)
  const start = isThursday(today) || isFriday(today) ? today : nextThursday(today)

  // Unfold to generate all Thu/Fri dates
  return Arr.unfold(start, (current) =>
    current <= endDate
      ? {
          value: format(current, 'yyyy-MM-dd'),
          next: isThursday(current) ? nextFriday(current) : nextThursday(current),
        }
      : undefined
  )
}

// Fetch availability from database
const fetchAvailability = (fromDate: string, toDate: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<AvailabilityWithProfile[]>(
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
    ),
    // Transform profiles from array to single object (Supabase returns array for joins)
    Effect.map(
      Arr.map((item) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
      }))
    )
  )

// Fetch all profiles (for showing all party members)
const fetchProfiles = () =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery(
        client
          .from('profiles')
          .select('id, display_name, avatar_url')
          .order('display_name')
      )
    )
  )

// Compose the full program
const getAvailability = (weeks: number) => {
  const dates = generateDates(weeks)
  const [fromDate, toDate] = [dates[0], dates[dates.length - 1]]

  return pipe(
    Effect.all({
      availability: fetchAvailability(fromDate, toDate),
      profiles: fetchProfiles(),
    }),
    Effect.map(({ availability, profiles }) => ({
      dates,
      availability,
      profiles,
    }))
  )
}

// Handler
const handler = (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const program = pipe(getAvailability(8), Effect.provide(SupabaseServiceLive))

  return Effect.runPromise(program)
    .then((data) => success(res, data))
    .catch((err) => handleError(res, err))
}

export default handler
