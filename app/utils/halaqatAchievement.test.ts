import { describe, expect, it } from 'vitest'
import { achievementPct, achievementTotals, defaultAchievementMonth, sortWeakFirst, whatsappLink, type AchievementRow } from './halaqatAchievement'

const row = (name: string, done: number, short: number, unrecorded: number, unmeasured = 0): AchievementRow => ({
  halaqa_id: name, halaqa_name: name, teacher_name: null, teacher_phone: null, teacher_whatsapp: null,
  report_status: null, students: done + short + unrecorded + unmeasured, done, short, unrecorded, unmeasured
})

describe('achievementPct', () => {
  it('المنجزون من المقاسين، و«لا يُقاس» خارج المقام', () => {
    expect(achievementPct(row('أ', 6, 2, 2, 5))).toBe(60)
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
  it('عند تساوي النسبة: الأكثرُ مقصّرين أولاً', () => {
    const out = sortWeakFirst([row('أ', 0, 1, 0), row('ب', 0, 5, 0)])
    expect(out.map(r => r.halaqa_name)).toEqual(['ب', 'أ'])
  })
})

describe('achievementTotals', () => {
  it('يجمع المنجزين والمقام ويعدّ الحلقات دون 50٪', () => {
    expect(achievementTotals([row('أ', 8, 2, 0), row('ب', 1, 4, 5), row('ج', 0, 0, 0, 2)]))
      .toEqual({ done: 9, measured: 20, pct: 45, low: 1, halqat: 3 })
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
