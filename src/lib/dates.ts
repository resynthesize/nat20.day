import { format, parseISO, addWeeks, subWeeks, addDays, subDays, getDay, isThursday, isFriday } from 'date-fns'
import { SCHEDULE } from './constants'

/**
 * Generate dates within a specific range (inclusive)
 */
export function generateDatesInRange(
  startDate: Date,
  endDate: Date,
  allowedDays: number[]
): string[] {
  const dates: string[] = []
  const allowedDaysSet = new Set(allowedDays)

  let current = startDate
  while (current <= endDate) {
    if (allowedDaysSet.has(getDay(current))) {
      dates.push(format(current, 'yyyy-MM-dd'))
    }
    current = addDays(current, 1)
  }

  return dates
}

/**
 * Generate dates for N weeks before a given date (exclusive of cursor date)
 * Used for backward infinite scroll
 */
export function generateDatesBefore(
  beforeDate: string,
  weeks: number,
  allowedDays: number[]
): string[] {
  const cursor = parseISO(beforeDate)
  const startDate = subWeeks(cursor, weeks)
  const endDate = subDays(cursor, 1) // Exclusive of cursor date

  return generateDatesInRange(startDate, endDate, allowedDays)
}

/**
 * Generate dates for N weeks after a given date (exclusive of cursor date)
 * Used for forward infinite scroll
 */
export function generateDatesAfter(
  afterDate: string,
  weeks: number,
  allowedDays: number[]
): string[] {
  const cursor = parseISO(afterDate)
  const startDate = addDays(cursor, 1) // Exclusive of cursor date
  const endDate = addWeeks(cursor, weeks)

  return generateDatesInRange(startDate, endDate, allowedDays)
}

export const generateDates = (
  weeks: number = SCHEDULE.WEEKS_TO_DISPLAY,
  allowedDays: number[] = [...SCHEDULE.DEFAULT_DAYS]
): string[] => {
  const dates: string[] = []
  const today = new Date()
  const endDate = addWeeks(today, weeks)

  // Create a Set for O(1) lookup
  const allowedDaysSet = new Set(allowedDays)

  let current = today

  // Iterate through each day in the range
  while (current <= endDate) {
    if (allowedDaysSet.has(getDay(current))) {
      dates.push(format(current, 'yyyy-MM-dd'))
    }
    current = addDays(current, 1)
  }

  return dates
}

export const formatDateDisplay = (dateStr: string): string => {
  const date = parseISO(dateStr)
  return format(date, 'MMM d') // "Dec 5"
}

export const getDayOfWeek = (dateStr: string): string => {
  const date = parseISO(dateStr)
  return format(date, 'EEE') // "Thu" or "Fri"
}

export const isThursdayDate = (dateStr: string): boolean => {
  return isThursday(parseISO(dateStr))
}

export const isFridayDate = (dateStr: string): boolean => {
  return isFriday(parseISO(dateStr))
}
