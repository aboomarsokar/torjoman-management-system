/** نافذةُ رصد الشهر (قفلُ الإرسال) وتنسيقُ الشهور والأيام بالأرقام، بتاريخ غزة. */
import { describe, expect, it } from 'vitest'
import { formatDay, gazaToday, isSubmittable, openingDay, periodLabel, shiftMonth } from './reportWindow'

describe('openingDay', () => {
  it('آخرُ يومٍ في الشهر', () => {
    expect(openingDay(2026, 10)).toBe('2026-10-31') // سبت
    expect(openingDay(2026, 2)).toBe('2026-02-28')
    expect(openingDay(2028, 2)).toBe('2028-02-29')
  })

  it('الخميسُ إن كان آخرُه جمعة', () => {
    expect(openingDay(2026, 7)).toBe('2026-07-30') // 31-07-2026 جمعة
  })
})

describe('isSubmittable', () => {
  it('مقفلٌ قبل يوم الفتح ومفتوحٌ فيه وبعده', () => {
    expect(isSubmittable(2026, 10, '2026-10-30')).toBe(false)
    expect(isSubmittable(2026, 10, '2026-10-31')).toBe(true)
    expect(isSubmittable(2026, 10, '2026-11-02')).toBe(true)
    expect(isSubmittable(2026, 7, '2026-07-29')).toBe(false)
    expect(isSubmittable(2026, 7, '2026-07-30')).toBe(true)
  })
})

describe('التنسيق', () => {
  it('periodLabel بالأرقام', () => {
    expect(periodLabel(2026, 1)).toBe('01-2026')
    expect(periodLabel(2026, 10)).toBe('10-2026')
  })

  it('formatDay يقلب إلى DD-MM-YYYY ويقصّ الوقت', () => {
    expect(formatDay('2026-10-19')).toBe('19-10-2026')
    expect(formatDay('2026-10-19T08:00:00Z')).toBe('19-10-2026')
  })
})

describe('shiftMonth', () => {
  it('يعبر حدّ السنة في الاتجاهين', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 10, 0)).toEqual({ year: 2026, month: 10 })
    expect(shiftMonth(2026, 3, -14)).toEqual({ year: 2025, month: 1 })
  })
})

describe('gazaToday', () => {
  it('بتوقيت غزة لا UTC', () => {
    expect(gazaToday(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20')
    expect(gazaToday(new Date('2026-10-19T08:00:00Z'))).toBe('2026-10-19')
  })

  it('بلا وسيط يُرجع تاريخاً بصيغة YYYY-MM-DD', () => {
    expect(gazaToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
