import { describe, expect, it } from 'vitest'
import {
  absencesFor, classifySyncError, effectiveDay, entryKey, entryKind, newEntry, newOffEntry, newWithdrawEntry,
  nextRetryDelay, rejectionText, syncStatusLine
} from './attendanceOutbox'

describe('newEntry / entryKey', () => {
  it('يومٌ واحدٌ لكلّ معلّمٍ وحلقة، بوقت الحفظ على الجهاز', () => {
    const e = newEntry('u', 'h', '2026-10-25', { s1: 'excused' }, new Date('2026-10-25T08:00:00Z'))
    expect(e.key).toBe(entryKey('u', 'h', '2026-10-25'))
    expect(e.recordedAt).toBe('2026-10-25T08:00:00.000Z')
    expect(e.status).toBe('pending')
  })
})

describe('newEntry / entryKind (أنواع السطور)', () => {
  it('newEntry ينتج حضوراً صريحاً', () => {
    expect(newEntry('u', 'h', 'd', {}).kind).toBe('attendance')
  })

  it('سطرٌ حُفظ قبل التحديث بلا kind يُقرأ حضوراً — ولا يُفقد', () => {
    const { kind: _drop, ...legacy } = newEntry('u', 'h', '2026-10-25', { s1: 'excused' })
    expect(entryKind(legacy)).toBe('attendance')
    expect(effectiveDay(undefined, legacy)).toEqual({ held: true, absences: { s1: 'excused' }, pending: true, off: null })
  })

  it('البلاغُ والسحبُ بمفتاح اليوم نفسه فيحلّ الأحدثُ محلّ الأقدم', () => {
    const att = newEntry('u', 'h', '2026-10-25', { s1: 'excused' })
    const off = newOffEntry('u', 'h', '2026-10-25', 'security', 'إغلاق', new Date('2026-10-25T08:00:00Z'))
    const wd = newWithdrawEntry('u', 'h', '2026-10-25', new Date('2026-10-25T09:00:00Z'))
    expect(off.key).toBe(att.key)
    expect(wd.key).toBe(att.key)
    expect(entryKind(off)).toBe('off')
    expect(entryKind(wd)).toBe('withdraw')
    expect(off.off).toEqual({ reason: 'security', note: 'إغلاق' })
    expect(off.recordedAt).toBe('2026-10-25T08:00:00.000Z')
    expect(off.absences).toEqual({})
    expect(off.status).toBe('pending')
    expect(wd.off).toBeUndefined()
  })
})

describe('effectiveDay', () => {
  it('الصندوقُ يغلب نسخةَ الجهاز ويُعدّ اليومُ مسجَّلاً', () => {
    const entry = newEntry('u', 'h', 'd', { s2: 'unexcused' })
    expect(effectiveDay({ held: false, absences: { s1: 'excused' } }, entry)).toEqual({ held: true, absences: { s2: 'unexcused' }, pending: true, off: null })
  })

  it('بلا صندوقٍ تُعرض نسخةُ الجهاز، ويومٌ غائبٌ عنها غيرُ مسجَّل', () => {
    expect(effectiveDay({ held: true, absences: { s1: 'excused' } }, undefined)).toEqual({ held: true, absences: { s1: 'excused' }, pending: false, off: null })
    expect(effectiveDay(undefined, undefined)).toEqual({ held: false, absences: {}, pending: false, off: null })
  })

  it('نسخةُ جهازٍ قديمة بلا بلاغات: off = null', () => {
    expect(effectiveDay(undefined, undefined, undefined).off).toBeNull()
  })

  it('سطرُ بلاغ: غيرُ مسجَّل وبلاغٌ على الجهاز بانتظار الرفع', () => {
    const entry = newOffEntry('u', 'h', 'd', 'other', 'تعطّل المبنى')
    expect(effectiveDay({ held: true, absences: { s1: 'excused' } }, entry, { reason: 'security', note: null, status: 'approved', reviewNote: null })).toEqual({
      held: false,
      absences: {},
      pending: true,
      off: { reason: 'other', note: 'تعطّل المبنى', status: 'pending', reviewNote: null, queued: true }
    })
  })

  it('سطرُ سحب: غيرُ مسجَّل ولا بلاغ', () => {
    const entry = newWithdrawEntry('u', 'h', 'd')
    expect(effectiveDay({ held: false, absences: {} }, entry, { reason: 'security', note: null, status: 'rejected', reviewNote: 'x' })).toEqual({
      held: false, absences: {}, pending: true, off: null
    })
  })

  it('بلا سطر: النسخةُ كما هي مع بلاغها المرفوع (غيرَ منتظرٍ للرفع)', () => {
    const off = { reason: 'teacher_sick' as const, note: null, status: 'rejected' as const, reviewNote: 'لا يكفي' }
    expect(effectiveDay({ held: false, absences: {} }, undefined, off)).toEqual({
      held: false, absences: {}, pending: false, off: { ...off, queued: false }
    })
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
    // نداءٌ بلا جلسة (anon) — لا رفضٌ للمعلّم
    expect(classifySyncError({ code: '42501', message: 'permission denied for function save_attendance_day' })).toBe('reauth')
  })

  it('سببُ الرفض بالعربية', () => {
    expect(rejectionText('أُرسل رصدُ هذا الشهر للاعتماد')).toBe('أُرسل رصدُ هذا الشهر للاعتماد')
    expect(rejectionText('new row violates row-level security policy')).toMatch(/^لم تقبل القاعدةُ/)
    expect(rejectionText(undefined)).toMatch(/^لم تقبل القاعدةُ/)
  })

  it('رفضُ الإجازة العامة يُعرض بنصّه العربيّ كما هو', () => {
    const msg = 'هذا اليوم إجازةٌ عامة: عيد — لا يُسجَّل فيه حضور'
    expect(rejectionText(msg)).toBe(msg)
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
