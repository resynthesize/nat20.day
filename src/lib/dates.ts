import {
  format,
  parseISO,
  isThursday,
  isFriday,
  addWeeks,
  nextThursday,
  nextFriday,
} from 'date-fns'

// Generate Thursday/Friday dates for the next N weeks
export const generateDates = (weeks = 8): string[] => {
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

// Format date for display
export const formatDateDisplay = (dateStr: string): string => {
  const date = parseISO(dateStr)
  return format(date, 'EEE, MMM d') // e.g., "Thu, Dec 5"
}

// Get day of week
export const getDayOfWeek = (dateStr: string): string => {
  const date = parseISO(dateStr)
  return format(date, 'EEE') // e.g., "Thu" or "Fri"
}

// Check if date is Thursday
export const isThursdayDate = (dateStr: string): boolean => {
  return isThursday(parseISO(dateStr))
}

// Check if date is Friday
export const isFridayDate = (dateStr: string): boolean => {
  return isFriday(parseISO(dateStr))
}
