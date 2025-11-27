import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe, Array as Arr, Option } from 'effect'
import { addWeeks, format, nextThursday, nextFriday, isThursday, isFriday } from 'date-fns'
import {
  SupabaseService,
  SupabaseServiceLive,
  runQuery,
  type Availability,
  type Profile,
} from '../lib/supabase'
import { success, handleError } from '../lib/response'

// Supabase returns joined relations as arrays
interface AvailabilityRow extends Availability {
  profiles: Pick<Profile, 'display_name' | 'avatar_url'>[]
}

const generateDates = (weeks: number): ReadonlyArray<string> => {
  const today = new Date()
  const endDate = addWeeks(today, weeks)
  const start = isThursday(today) || isFriday(today) ? today : nextThursday(today)

  return Arr.unfold(start, (current) =>
    current <= endDate
      ? Option.some([
          format(current, 'yyyy-MM-dd'),
          isThursday(current) ? nextFriday(current) : nextThursday(current),
        ] as const)
      : Option.none()
  )
}

const fetchAvailability = (fromDate: string, toDate: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<AvailabilityRow[]>(
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
    Effect.map(
      Arr.map((item) => ({
        ...item,
        profiles: item.profiles[0],
      }))
    )
  )

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
