/** ثوابتُ القرآن وتسميةُ إنجاز الشهر بالأجزاء والصفحات. */
import { describe, expect, it } from 'vitest'
import { KHATM_POSITION, MUSHAF_PAGES, PAGES_PER_JUZ, PROGRAM_JUZ_COUNT, monthlyJuzLabel, prorationApplies } from './quran'

describe('prorationApplies — التقسيطُ بالحضور من الشهر 11/2026', () => {
  it('الشهر 10/2026 وما قبله كاملٌ بلا تقسيط', () => {
    expect(prorationApplies(2026, 10)).toBe(false)
    expect(prorationApplies(2026, 9)).toBe(false)
    expect(prorationApplies(2025, 12)).toBe(false)
  })
  it('الشهر 11/2026 وما بعده يُقسَّط', () => {
    expect(prorationApplies(2026, 11)).toBe(true)
    expect(prorationApplies(2026, 12)).toBe(true)
    expect(prorationApplies(2027, 1)).toBe(true)
  })
})

describe('ثوابتُ المصحف', () => {
  it('604 صفحات و30 جزءاً و20 صفحةً للجزء وختمٌ عند الفاتحة 1:7', () => {
    expect(MUSHAF_PAGES).toBe(604)
    expect(PROGRAM_JUZ_COUNT).toBe(30)
    expect(PAGES_PER_JUZ).toBe(20)
    expect(KHATM_POSITION).toEqual({ surah: 1, ayah: 7 })
  })
})

describe('monthlyJuzLabel', () => {
  it('دون الجزء الواحد لا تسمية', () => {
    expect(monthlyJuzLabel(19)).toBeNull()
    expect(monthlyJuzLabel(0)).toBeNull()
  })

  it('المفرد والمثنّى والجمع', () => {
    expect(monthlyJuzLabel(20)).toBe('جزء')
    expect(monthlyJuzLabel(40)).toBe('جزءان')
    expect(monthlyJuzLabel(60)).toBe('3 أجزاء')
    expect(monthlyJuzLabel(220)).toBe('11 جزءاً')
  })

  it('الكسرُ بالصفحات لا بالعشور', () => {
    expect(monthlyJuzLabel(21)).toBe('جزء وصفحة')
    expect(monthlyJuzLabel(22)).toBe('جزء وصفحتان')
    expect(monthlyJuzLabel(25)).toBe('جزء و5 صفحات')
    expect(monthlyJuzLabel(431)).toBe('21 جزءاً و11 صفحة')
  })
})
