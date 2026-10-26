import { describe, expect, it } from 'vitest'
import { absencesFor, classifySyncError, effectiveDay, entryKey, newEntry, nextRetryDelay, syncStatusLine } from './attendanceOutbox'

describe('newEntry / entryKey', () => {
  it('يومٌ واحدٌ لكلّ معلّمٍ وحلقة، بوقت الحفظ على الجهاز', () => {
    const e = newEntry('u', 'h', '2026-10-25', { s1: 'excused' }, new Date('2026-10-25T08:00:00Z'))
    expect(e.key).toBe(entryKey('u', 'h', '2026-10-25'))
    expect(e.recordedAt).toBe('2026-10-25T08:00:00.000Z')
    expect(e.status).toBe('pending')
  })
})

describe('effectiveDay', () => {
  it('الصندوقُ يغلب نسخةَ الجهاز ويُعدّ اليومُ مسجَّلاً', () => {
    const entry = newEntry('u', 'h', 'd', { s2: 'unexcused' })
    expect(effectiveDay({ held: false, absences: { s1: 'excused' } }, entry)).toEqual({ held: true, absences: { s2: 'unexcused' }, pending: true })
  })

  it('بلا صندوقٍ تُعرض نسخةُ الجهاز، ويومٌ غائبٌ عنها غيرُ مسجَّل', () => {
    expect(effectiveDay({ held: true, absences: { s1: 'excused' } }, undefined)).toEqual({ held: true, absences: { s1: 'excused' }, pending: false })
    expect(effectiveDay(undefined, undefined)).toEqual({ held: false, absences: {}, pending: false })
  })
})

describe('absencesFor', () => {
  it('يُسقط غيابَ من لم يعد في القائمة', () => {
    expect(absencesFor({ a: 'excused', gone: 'unexcused' }, ['a', 'b'])).toEqual({ a: 'excused' })
  })
})

describe('classifySyncError', () => {
  it('انقطاعُ الشبكة والخادمُ يُعادان', () => {
    expect(classifySyncError({ code: '', message: 'TypeError: Failed to fetch' })).toBe('retry')
    expect(classifySyncError({ code: '503' })).toBe('retry')
  })

  it('انتهاءُ الرمز يُجدَّد ثمّ يُعاد', () => {
    expect(classifySyncError({ code: 'PGRST301' })).toBe('reauth')
    expect(classifySyncError({ message: 'JWT expired' })).toBe('reauth')
  })

  it('رفضُ الحارس والصلاحيةُ نهائيّان', () => {
    expect(classifySyncError({ code: 'P0001', message: 'الشهر معتمَد' })).toBe('reject')
    expect(classifySyncError({ code: '42501' })).toBe('reject')
  })
})

describe('nextRetryDelay', () => {
  it('تتصاعد ثمّ تثبت على آخرها', () => {
    expect(nextRetryDelay(0)).toBe(15_000)
    expect(nextRetryDelay(3)).toBe(120_000)
    expect(nextRetryDelay(50)).toBe(120_000)
  })
})

describe('syncStatusLine', () => {
  const base = { online: true, pending: 0, rejected: 0, syncing: false, syncedAt: '13:18' }
  it('ما ينتظر الرفعَ بعدده', () => {
    expect(syncStatusLine({ ...base, online: false, pending: 2 })).toBe('يومان محفوظ على جهازك — يُرفع حين يعود الاتصال')
    expect(syncStatusLine({ ...base, pending: 3, syncing: true })).toBe('يجري رفع 3 أيام…')
    expect(syncStatusLine({ ...base, pending: 12 })).toBe('12 يوماً بانتظار الرفع — يُرفع تلقائياً')
  })

  it('وإلا نضارةُ البيانات', () => {
    expect(syncStatusLine(base)).toBe('كلُّ شيءٍ مرفوع · البيانات محدَّثة 13:18')
    expect(syncStatusLine({ ...base, online: false })).toBe('بلا اتصال · البيانات محدَّثة 13:18 — ما تسجّله يُحفظ على جهازك')
  })

  it('المرفوضُ أوّلاً', () => {
    expect(syncStatusLine({ ...base, pending: 1, rejected: 1 })).toBe('يومٌ واحد لم تقبله الإدارة — راجِعه أدناه')
  })
})
