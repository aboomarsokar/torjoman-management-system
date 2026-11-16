import { describe, expect, it } from 'vitest'
import { asTrack, isCounted, nextTermStart, openAchievement, openRatio, rewardBase, teacherAchievementOf, trackAt, tracksApply } from './tracks'

describe('tracksApply', () => {
  it('يسري من 11/2026', () => {
    expect(tracksApply(2026, 10)).toBe(false)
    expect(tracksApply(2026, 11)).toBe(true)
    expect(tracksApply(2027, 1)).toBe(true)
  })
})

describe('nextTermStart', () => {
  it('الفصول 10–1 · 2–5 · 6–9', () => {
    expect(nextTermStart(2026, 11)).toEqual({ year: 2027, month: 2 })
    expect(nextTermStart(2027, 1)).toEqual({ year: 2027, month: 2 })
    expect(nextTermStart(2027, 2)).toEqual({ year: 2027, month: 6 })
    expect(nextTermStart(2027, 9)).toEqual({ year: 2027, month: 10 })
  })
})

describe('isCounted', () => {
  it('أكثرُ من النصف بعد طرح العذر — النصفُ تماماً لا يُحتسب', () => {
    expect(isCounted(10, 20, 0)).toBe(false)
    expect(isCounted(11, 20, 0)).toBe(true)
    expect(isCounted(9, 20, 4)).toBe(true)
    expect(isCounted(0, 0, 0)).toBeNull()
  })
})

describe('rewardBase', () => {
  it('يبلغ النصاب بلا خصم', () => {
    expect(rewardBase(1, 14, 0)).toMatchObject({ missing: 0, deduction: 0, base: 600 })
  })
  it('30 لكلّ ناقص في أول شهر، و50 إن نقص السابقُ أيضاً', () => {
    expect(rewardBase(1, 8, 0)).toMatchObject({ missing: 4, rate: 30, base: 480 })
    expect(rewardBase(1, 8, 2)).toMatchObject({ rate: 50, base: 400 })
    expect(rewardBase(2, 5, 0)).toMatchObject({ quota: 8, missing: 3, base: 310 })
  })
  it('لا ينزل عن صفر', () => {
    expect(rewardBase(2, 0, 3).base).toBe(0)
  })
})

describe('openRatio / openAchievement', () => {
  it('لم يُرصد صفر، ومطلوبٌ صفر واحد، وسقفُه واحد', () => {
    expect(openRatio('unrecorded', null, 10)).toBe(0)
    expect(openRatio('done', 3, 0)).toBe(1)
    expect(openRatio('done', 30, 10)).toBe(1)
    expect(openRatio('short', 5, 10)).toBe(0.5)
    expect(openRatio('absentee', 5, 10)).toBeNull()
  })
  it('أفضلُ ن مقسوماً على ن', () => {
    const rows = [
      { outcome: 'done' as const, pages: 10, required: 10 },
      { outcome: 'short' as const, pages: 5, required: 10 },
      { outcome: 'unrecorded' as const, pages: null, required: null },
      { outcome: 'absentee' as const, pages: 9, required: null }
    ]
    expect(openAchievement(rows, 2)).toEqual({ pct: 75, n: 2, pool: 3 })
    expect(openAchievement(rows, 12)).toEqual({ pct: 50, n: 3, pool: 3 })
    expect(openAchievement([], 12).pct).toBeNull()
  })
})

describe('asTrack', () => {
  it('الافتراضُ الأول', () => {
    expect(asTrack(2)).toBe(2)
    expect(asTrack(null)).toBe(1)
  })
})

describe('teacherAchievementOf', () => {
  const row = (outcome: 'done' | 'near' | 'short' | 'unrecorded', pages: number | null, required: number | null) =>
    ({ outcome, record: pages === null ? null : { pagesMemorized: pages }, plan: { required } })
  it('قبل 11/2026 بالحساب القديم', () => {
    expect(teacherAchievementOf([row('done', 10, 10), row('near', 8, 10)], 2026, 10, null)).toEqual({ pct: 13, sub: 'أعلى 12 طالباً' })
  })
  it('من 11/2026 بالنسبة المفتوحة على النصاب', () => {
    expect(teacherAchievementOf([row('done', 10, 10), row('short', 5, 10)], 2026, 11, 8)).toEqual({ pct: 75, sub: 'أفضل 2 من نصاب 8' })
  })
})

describe('trackAt', () => {
  const rows = [
    { halaqa_id: 'h', track: 2, effective_year: 2027, effective_month: 2 },
    { halaqa_id: 'h', track: 1, effective_year: 2027, effective_month: 6 },
    { halaqa_id: 'x', track: 2, effective_year: 2026, effective_month: 11 }
  ]
  it('آخرُ تعيينٍ سرى حتى الشهر، وإلا الأول', () => {
    expect(trackAt(rows, 'h', 2026, 12)).toBe(1)
    expect(trackAt(rows, 'h', 2027, 3)).toBe(2)
    expect(trackAt(rows, 'h', 2027, 7)).toBe(1)
    expect(trackAt(rows, 'x', 2027, 1)).toBe(2)
  })
})
