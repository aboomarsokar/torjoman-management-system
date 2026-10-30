import { describe, expect, it } from 'vitest'
import { buildHolidays, buildMirrorDays, buildOffDays, mirrorFrom } from './useOfflineMirror'

describe('buildOffDays', () => {
  it('يحوّل الصفوفَ إلى بلاغاتٍ بمفتاح اليوم', () => {
    expect(buildOffDays([
      { day: '2026-10-25', reason: 'security', note: null, status: 'pending', review_note: null },
      { day: '2026-10-26', reason: 'other', note: 'سبب', status: 'rejected', review_note: 'غير مقنع' }
    ])).toEqual({
      '2026-10-25': { reason: 'security', note: null, status: 'pending', reviewNote: null },
      '2026-10-26': { reason: 'other', note: 'سبب', status: 'rejected', reviewNote: 'غير مقنع' }
    })
  })

  it('يُسقط سبباً أو حالةً غير معروفين', () => {
    expect(buildOffDays([
      { day: '2026-10-25', reason: 'aliens', note: null, status: 'pending', review_note: null },
      { day: '2026-10-26', reason: 'other', note: 'x', status: 'weird', review_note: null }
    ])).toEqual({})
  })
})

describe('buildHolidays', () => {
  it('يوم ← سبب', () => {
    expect(buildHolidays([{ day: '2026-11-02', reason: 'عطلة' }])).toEqual({ '2026-11-02': 'عطلة' })
  })
})

describe('mirrorFrom', () => {
  it('أربعون يوماً إلى الوراء، ولا قبل بداية المشروع', () => {
    expect(mirrorFrom('2026-12-20', '2026-10-01')).toBe('2026-11-10')
    expect(mirrorFrom('2026-10-26', '2026-10-01')).toBe('2026-10-01')
  })
})

describe('buildMirrorDays', () => {
  it('كلُّ يومٍ مسجَّلٍ بغياباته، ويومٌ بلا غياباتٍ مسجَّلٌ كلُّه حضور', () => {
    const days = buildMirrorDays(
      [{ day: '2026-10-25' }, { day: '2026-10-26' }],
      [{ day: '2026-10-25', student_id: 's1', kind: 'excused' }]
    )
    expect(days).toEqual({
      '2026-10-25': { held: true, absences: { s1: 'excused' } },
      '2026-10-26': { held: true, absences: {} }
    })
  })
})
