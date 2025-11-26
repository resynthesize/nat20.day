import {
  format,
  parseISO,
  isThursday,
  isFriday,
  addWeeks,
  nextThursday,
  nextFriday,
} from 'date-fns'

export const generateDates = (weeks = 8): string[] => {
  const dates: string[] = []
  const today = new Date()
  const endDate = addWeeks(today, weeks)

  let current = isThursday(today) || isFriday(today) ? today : nextThursday(today)

  while (current <= endDate) {
    if (isThursday(current) || isFriday(current)) {
      dates.push(format(current, 'yyyy-MM-dd'))
    }

    current = isThursday(current) ? nextFriday(current) : nextThursday(current)
  }

  return dates
}

export const formatDateDisplay = (dateStr: string): string => {
  const date = parseISO(dateStr)
  return format(date, 'EEE, MMM d') // "Thu, Dec 5"
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
