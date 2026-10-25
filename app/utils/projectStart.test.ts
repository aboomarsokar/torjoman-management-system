import { describe, expect, it } from 'vitest'
import { clampDayToProjectStart, clampToProjectStart, isAtProjectStart, isBeforeProjectStart } from './projectStart'

describe('projectStart', () => {
  it('الشهرُ 9/2026 وما قبله قبل البداية، و10/2026 ليس قبلها', () => {
    expect(isBeforeProjectStart({ year: 2026, month: 9 })).toBe(true)
    expect(isBeforeProjectStart({ year: 2025, month: 12 })).toBe(true)
    expect(isBeforeProjectStart({ year: 2026, month: 10 })).toBe(false)
    expect(isBeforeProjectStart({ year: 2027, month: 1 })).toBe(false)
  })

  it('«عند البداية» يشمل الشهر 10/2026 وما قبله', () => {
    expect(isAtProjectStart({ year: 2026, month: 10 })).toBe(true)
    expect(isAtProjectStart({ year: 2026, month: 11 })).toBe(false)
  })

  it('يُقصَر الشهرُ السابقُ على البداية ويُترك ما بعدها', () => {
    expect(clampToProjectStart({ year: 2026, month: 9 })).toEqual({ year: 2026, month: 10 })
    expect(clampToProjectStart({ year: 2026, month: 11 })).toEqual({ year: 2026, month: 11 })
  })

  it('يُقصَر اليومُ على 2026-10-01', () => {
    expect(clampDayToProjectStart('2026-09-30')).toBe('2026-10-01')
    expect(clampDayToProjectStart('2026-10-01')).toBe('2026-10-01')
    expect(clampDayToProjectStart('2026-10-24')).toBe('2026-10-24')
  })
})
