import { describe, expect, it } from 'vitest'
import { buildMirrorDays, mirrorFrom } from './useOfflineMirror'

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
