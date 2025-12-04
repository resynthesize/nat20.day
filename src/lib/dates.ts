import { format, parseISO, addWeeks, addDays, getDay, isThursday, isFriday } from 'date-fns'
import { SCHEDULE } from './constants'

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
