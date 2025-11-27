import { describe, it, expect } from 'vitest'
import {
  generateDates,
  formatDateDisplay,
  getDayOfWeek,
  isThursdayDate,
  isFridayDate,
} from './dates'

describe('dates', () => {
  describe('generateDates', () => {
    it('returns an array of date strings', () => {
      const dates = generateDates(2)
      expect(Array.isArray(dates)).toBe(true)
      expect(dates.length).toBeGreaterThan(0)
    })

    it('only includes Thursdays and Fridays', () => {
      const dates = generateDates(4)
      for (const date of dates) {
        const isThurOrFri = isThursdayDate(date) || isFridayDate(date)
        expect(isThurOrFri).toBe(true)
      }
    })

    it('returns dates in yyyy-MM-dd format', () => {
      const dates = generateDates(1)
      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      for (const date of dates) {
        expect(date).toMatch(datePattern)
      }
    })

    it('returns dates in chronological order', () => {
      const dates = generateDates(4)
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] > dates[i - 1]).toBe(true)
      }
    })
  })

  describe('formatDateDisplay', () => {
    it('formats date as "MMM d"', () => {
      expect(formatDateDisplay('2024-12-05')).toBe('Dec 5')
      expect(formatDateDisplay('2024-12-06')).toBe('Dec 6')
      expect(formatDateDisplay('2024-01-15')).toBe('Jan 15')
    })
  })

  describe('getDayOfWeek', () => {
    it('returns abbreviated day of week', () => {
      expect(getDayOfWeek('2024-12-05')).toBe('Thu')
      expect(getDayOfWeek('2024-12-06')).toBe('Fri')
      expect(getDayOfWeek('2024-12-07')).toBe('Sat')
    })
  })

  describe('isThursdayDate', () => {
    it('returns true for Thursdays', () => {
      expect(isThursdayDate('2024-12-05')).toBe(true)
      expect(isThursdayDate('2024-12-12')).toBe(true)
    })

    it('returns false for non-Thursdays', () => {
      expect(isThursdayDate('2024-12-06')).toBe(false)
      expect(isThursdayDate('2024-12-07')).toBe(false)
    })
  })

  describe('isFridayDate', () => {
    it('returns true for Fridays', () => {
      expect(isFridayDate('2024-12-06')).toBe(true)
      expect(isFridayDate('2024-12-13')).toBe(true)
    })

    it('returns false for non-Fridays', () => {
      expect(isFridayDate('2024-12-05')).toBe(false)
      expect(isFridayDate('2024-12-07')).toBe(false)
    })
  })
})
