import { describe, expect, it } from 'vitest'
import { newEntry, newOffEntry, newWithdrawEntry } from './attendanceOutbox'
import { recordingStatus, teacherActions } from './teacherDashboard'
import { localDay, queuedToday, withLocalWork, type DashLike } from './teacherDashboardOffline'

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
    expect(out.today).toEqual({ isFriday: false, held: true, absent: 2, off: null })
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

describe('بلاغُ «لم تنعقد» لليوم في اللوحة', () => {
  const T = '2026-10-27'
  const base = { today: T, savedOn: T, quranPending: [] }

  it('queuedToday: البلاغُ المنتظِر يترك اليومَ غيرَ مسجَّلٍ ومعلّقاً، والسحبُ بلا بلاغ، والحضورُ يُلغيه', () => {
    const held = { held: true, absences: { a: 'excused' as const } }
    expect(queuedToday(newOffEntry('u', 'h', T, 'security', null), held)).toEqual({ day: { held: false, absent: 0 }, queuedOff: 'pending' })
    expect(queuedToday(newWithdrawEntry('u', 'h', T), held)).toEqual({ day: { held: false, absent: 0 }, queuedOff: null })
    expect(queuedToday(newEntry('u', 'h', T, {}), undefined)).toEqual({ day: { held: true, absent: 0 }, queuedOff: null })
    // بلا سطر: نسخةُ الحضور وحدها ولا قولَ في البلاغ
    expect(queuedToday(undefined, held)).toEqual({ day: { held: true, absent: 1 } })
  })

  // اللقطةُ قرأت حالاً من القاعدة، ثمّ تغيّر الجهازُ بعدها
  const snap = (off: 'pending' | 'approved' | 'rejected') => ({ ...dash(), today: { isFriday: false, held: false, absent: 0, off } })
  const att = (today: DashLike['today']) => teacherActions({
    today: T, todayAttendance: today, recording: recordingStatus([], T), recordedCount: 0, studentCount: 0,
    incentive: { allocated: 0, status: null, returned: false }, newAlerts: 0, money: String, day: String
  }).find(a => a.key === 'att')

  it('تراجعٌ ثمّ حضورٌ بعد اللقطة (النسخةُ مسجَّلة بلا offDays): بندُ الحضور المسجَّل لا «بانتظار الاعتماد»', () => {
    const local = queuedToday(undefined, { held: true, absences: {} })
    const out = withLocalWork(snap('pending'), { ...base, day: local.day, mirrorOff: null })
    expect(out.today.off).toBeNull()
    expect(att(out.today)).toMatchObject({ tone: 'done', title: 'سُجّل حضور اليوم' })
  })

  it('سحبٌ بعد اللقطة (النسخةُ بلا يومٍ ولا offDays): «سجّل الحضور»', () => {
    const local = queuedToday(undefined, undefined)
    const out = withLocalWork(snap('pending'), { ...base, day: local.day, mirrorOff: null })
    expect(out.today.off).toBeNull()
    expect(att(out.today)).toMatchObject({ tone: 'todo', cta: 'سجّل الحضور' })
  })

  it('بلاغٌ في النسخة معلّقٌ والقاعدةُ اعتمدته: «معتمَد»', () => {
    const out = withLocalWork(snap('approved'), { ...base, day: null, mirrorOff: 'pending' })
    expect(out.today.off).toBe('approved')
    expect(att(out.today)).toMatchObject({ tone: 'done', detail: 'معتمَد' })
  })

  it('سطرُ الصندوق يغلب: البلاغُ المنتظِر معلّقٌ ولو قالت القاعدةُ غيره، والسحبُ بلا بلاغ', () => {
    expect(withLocalWork(snap('rejected'), { ...base, day: { held: false, absent: 0 }, queuedOff: 'pending', mirrorOff: 'rejected' }).today.off).toBe('pending')
    expect(withLocalWork(snap('pending'), { ...base, day: { held: false, absent: 0 }, queuedOff: null, mirrorOff: 'pending' }).today.off).toBeNull()
  })

  it('نسخةُ يومٍ مضى: حالُ النسخة بلا قراءة القاعدة؛ ولا بلاغَ على الجهاز = لا بلاغ', () => {
    expect(withLocalWork(snap('approved'), { ...base, savedOn: '2026-10-26', day: null, mirrorOff: 'pending' }).today.off).toBe('pending')
    expect(withLocalWork(snap('approved'), { ...base, day: null }).today.off).toBeNull()
  })
})
