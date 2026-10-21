import { describe, expect, it } from 'vitest'
import { fmtScore, parseNumbers, qualityState, qualityWith } from './qualityRecord'

// ما أرجعته القاعدة في اختبار الهجرة الملغى (زيارتان 32 و40، اجتماعات 6)
const raw = {
  final: '39.00', visits: [{ id: 'a', date: '2026-09-10', score: 32, criteria: [4, 7, 0, 7, 7, 7] }],
  quality: 39.00, meetings: 6, incomplete: false, visits_avg: '36.00', achievement: 0, visits_part: 72,
  visits_count: 2, reports_quran: 0, achievement_done: 0, reports_deadline: '2026-10-03', achievement_short: 0,
  reports_statement: 0, achievement_unmeasured: 0, achievement_unrecorded: 6
}

describe('parseNumbers', () => {
  it('يقرأ الأعدادَ النصّيّة من numeric', () => {
    const n = parseNumbers(raw)!
    expect(n.final).toBe(39)
    expect(n.visits_avg).toBe(36)
    expect(n.visits[0]!.criteria).toEqual([4, 7, 0, 7, 7, 7])
    expect(n.achievement_unrecorded).toBe(6)
  })
  it('غيرُ الكائن ← null، والغائبُ ← null', () => {
    expect(parseNumbers(null)).toBeNull()
    expect(parseNumbers({ visits_count: 0 })!.quality).toBeNull()
  })
})

describe('qualityWith', () => {
  it('(الزيارات + التقارير + الاجتماعات) ÷ 2، وبلا زيارةٍ لا جودة', () => {
    const n = parseNumbers({ ...raw, reports_quran: 5, reports_statement: 3 })!
    expect(qualityWith(n, 8)).toBe(44)
    expect(qualityWith(parseNumbers({ ...raw, visits_part: null })!, 8)).toBeNull()
  })
})

describe('fmtScore و qualityState', () => {
  it('بلا أصفارٍ زائدة', () => {
    expect(fmtScore(39)).toBe('39')
    expect(fmtScore(36.5)).toBe('36.5')
    expect(fmtScore(null)).toBe('—')
  })
  it('الحالاتُ الأربع', () => {
    expect(qualityState(null)).toBe('none')
    expect(qualityState({ locked_at: null, teacher_ack_at: null })).toBe('open')
    expect(qualityState({ locked_at: 'x', teacher_ack_at: null })).toBe('locked')
    expect(qualityState({ locked_at: 'x', teacher_ack_at: 'y' })).toBe('acknowledged')
  })
})
