import { describe, expect, it } from 'vitest'
import { localDay, withLocalWork, type DashLike } from './teacherDashboardOffline'

const dash = (): DashLike => ({
  halaqa: { id: 'h' },
  today: { isFriday: false, held: false, absent: 0 },
  recording: { period: { year: 2026, month: 10 } },
  recordedCount: 1,
  unrecorded: [{ id: 'a', name: 'أحمد' }, { id: 'b', name: 'بلال' }]
})
const q = (studentId: string, month = 10, status = 'pending') => ({ halaqaId: 'h', studentId, year: 2026, month, status })

describe('localDay', () => {
  it('ما ينتظر الرفعَ يغلب نسخةَ الحضور', () => {
    expect(localDay({ a: 'excused' }, { held: true, absences: {} })).toEqual({ held: true, absent: 1 })
  })
  it('ثمّ النسخة، وإلا لا علم', () => {
    expect(localDay(null, { held: true, absences: { a: 'unexcused', b: 'excused' } })).toEqual({ held: true, absent: 2 })
    expect(localDay(null, undefined)).toBeNull()
  })
})

describe('withLocalWork', () => {
  it('حضورُ اليوم المسجَّل على الجهاز يظهر', () => {
    const out = withLocalWork(dash(), { today: '2026-10-27', savedOn: '2026-10-27', day: { held: true, absent: 2 }, quranPending: [] })
    expect(out.today).toEqual({ isFriday: false, held: true, absent: 2 })
  })
  it('نسخةُ يومٍ مضى بلا علمٍ باليوم: لم يُسجَّل', () => {
    const d = { ...dash(), today: { isFriday: false, held: true, absent: 3 } }
    expect(withLocalWork(d, { today: '2026-10-28', savedOn: '2026-10-27', day: null, quranPending: [] }).today.held).toBe(false)
    expect(withLocalWork(d, { today: '2026-10-27', savedOn: '2026-10-27', day: null, quranPending: [] }).today.held).toBe(true)
  })
  it('الإنجازُ المنتظِرُ لشهر الرصد يُعدّ مرصوداً', () => {
    const out = withLocalWork(dash(), { today: '2026-10-27', savedOn: '2026-10-27', day: null, quranPending: [q('a'), q('b', 9), q('b', 10, 'rejected')] })
    expect(out.unrecorded.map(s => s.id)).toEqual(['b'])
    expect(out.recordedCount).toBe(2)
  })
})
