import { describe, expect, it } from 'vitest'
import { achievementPct, achievementTotals, defaultAchievementMonth, sortWeakFirst, topScore, whatsappLink, type AchievementRow } from './halaqatAchievement'

const row = (name: string, done: number, short: number, unrecorded: number, unmeasured = 0, near = 0): AchievementRow => ({
  halaqa_id: name, halaqa_name: name, teacher_name: null, teacher_phone: null, teacher_whatsapp: null,
  report_status: null, students: done + near + short + unrecorded + unmeasured, done, near, short, absentee: 0, unrecorded, unmeasured
})

describe('topScore — أعلى 12: أنجز 1 · قريب ½', () => {
  it('المنجزون أوّلاً ثم القريبون حتى 12', () => {
    expect(topScore({ done: 6, near: 4 })).toBe(8)
    expect(topScore({ done: 10, near: 5 })).toBe(11)
    expect(topScore({ done: 15, near: 3 })).toBe(12)
  })
})

describe('achievementPct', () => {
  it('أعلى 12 ÷ 12 دائماً، و«لا يُقاس» خارجها', () => {
    expect(achievementPct(row('أ', 6, 2, 2, 5))).toBe(50)
    expect(achievementPct(row('ب', 6, 0, 0, 0, 4))).toBe(67)
    expect(achievementPct(row('ج', 14, 3, 0))).toBe(100)
  })
  it('null حين لا أحدَ يُقاس', () => {
    expect(achievementPct(row('أ', 0, 0, 0, 4))).toBeNull()
  })
})

describe('sortWeakFirst', () => {
  it('الأضعفُ أولاً، وما لا يُقاس في الآخر', () => {
    const out = sortWeakFirst([row('ج', 0, 0, 0, 3), row('أ', 9, 1, 0), row('ب', 2, 8, 0)])
    expect(out.map(r => r.halaqa_name)).toEqual(['ب', 'أ', 'ج'])
  })
  it('عند تساوي النسبة: الأكثرُ مقصّرين ومن لم يُرصد أولاً', () => {
    const out = sortWeakFirst([row('أ', 0, 1, 0), row('ب', 0, 5, 0)])
    expect(out.map(r => r.halaqa_name)).toEqual(['ب', 'أ'])
  })
})

describe('achievementTotals', () => {
  it('يجمع المنجزين (والقريبين بنصف) والمقام ويعدّ الحلقات دون 50٪', () => {
    expect(achievementTotals([row('أ', 8, 2, 0), row('ب', 1, 4, 5), row('ج', 0, 0, 0, 2), row('د', 0, 0, 0, 0, 2)]))
      .toEqual({ done: 9, near: 2, measured: 22, pct: 45, low: 2, halqat: 4 })
  })
})

describe('whatsappLink', () => {
  it('المحلّيُّ بمفتاح 970', () => {
    expect(whatsappLink('059-123 4567')).toBe('https://wa.me/970591234567')
  })
  it('الدوليُّ كما هو بـ+ أو 00', () => {
    expect(whatsappLink('+972591234567')).toBe('https://wa.me/972591234567')
    expect(whatsappLink('00970591234567')).toBe('https://wa.me/970591234567')
  })
  it('لا رابطَ لرقمٍ ناقصٍ أو فارغ', () => {
    expect(whatsappLink('12')).toBeNull()
    expect(whatsappLink(null)).toBeNull()
  })
})

describe('defaultAchievementMonth', () => {
  it('الشهرُ السابق، وعبرَ السنة', () => {
    expect(defaultAchievementMonth('2026-11-22')).toEqual({ year: 2026, month: 10 })
    expect(defaultAchievementMonth('2026-10-22')).toEqual({ year: 2026, month: 10 }) // لا قبل بداية المشروع
    expect(defaultAchievementMonth('2027-01-05')).toEqual({ year: 2026, month: 12 })
  })
})
