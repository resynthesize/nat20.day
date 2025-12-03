import { format, parseISO, addWeeks, addDays, getDay, isThursday, isFriday } from 'date-fns'

// Default days: Friday (5) and Saturday (6)
const DEFAULT_DAYS = [5, 6]

export const generateDates = (weeks = 8, allowedDays: number[] = DEFAULT_DAYS): string[] => {
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
