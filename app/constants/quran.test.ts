/** ثوابتُ القرآن وتسميةُ إنجاز الشهر بالأجزاء والصفحات. */
import { describe, expect, it } from 'vitest'
import { KHATM_POSITION, MUSHAF_PAGES, PAGES_PER_JUZ, PROGRAM_JUZ_COUNT, monthlyJuzLabel } from './quran'

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
