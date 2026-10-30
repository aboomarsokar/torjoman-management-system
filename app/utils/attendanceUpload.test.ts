import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { classifySyncError, newEntry, newOffEntry, newWithdrawEntry, type OutboxEntry } from './attendanceOutbox'
import { settleAttendanceEntry, uploadAttendanceEntry, type SettleTarget } from './attendanceUpload'

const NOW = new Date('2026-10-30T08:00:00Z')

function fakeClient() {
  const rpc = vi.fn((_fn: string, _args: unknown) => Promise.resolve({ data: { ok: true }, error: null }))
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> }
}

describe('uploadAttendanceEntry', () => {
  it('سطرٌ قديمٌ بلا kind يُرفع حضوراً كما كان', async () => {
    const { rpc, client } = fakeClient()
    const { kind: _kind, ...legacy } = newEntry('u', 'h', '2026-10-29', { s1: 'excused' }, NOW)
    await uploadAttendanceEntry(client, legacy as OutboxEntry)
    expect(rpc).toHaveBeenCalledWith('save_attendance_day', { p_halaqa: 'h', p_day: '2026-10-29', p_absences: { s1: 'excused' }, p_recorded_at: NOW.toISOString() })
  })

  it('بلاغٌ يُرفع بـreport_off_day مع وقت الحفظ', async () => {
    const { rpc, client } = fakeClient()
    await uploadAttendanceEntry(client, newOffEntry('u', 'h', '2026-10-29', 'security', 'إغلاق الطريق', NOW))
    expect(rpc).toHaveBeenCalledWith('report_off_day', { p_halaqa: 'h', p_day: '2026-10-29', p_reason: 'security', p_note: 'إغلاق الطريق', p_reported_at: NOW.toISOString() })
  })

  it('الملاحظةُ الفارغة أو البيضاء تُرسل null', async () => {
    const { rpc, client } = fakeClient()
    await uploadAttendanceEntry(client, newOffEntry('u', 'h', '2026-10-29', 'security', null, NOW))
    await uploadAttendanceEntry(client, newOffEntry('u', 'h', '2026-10-29', 'security', '   ', NOW))
    expect(rpc.mock.calls.map(c => (c[1] as { p_note: unknown }).p_note)).toEqual([null, null])
  })

  it('السحبُ يُرفع بـwithdraw_off_day', async () => {
    const { rpc, client } = fakeClient()
    await uploadAttendanceEntry(client, newWithdrawEntry('u', 'h', '2026-10-29', NOW))
    expect(rpc).toHaveBeenCalledWith('withdraw_off_day', { p_halaqa: 'h', p_day: '2026-10-29' })
  })

  it('بلاغٌ تالفٌ بلا off يُرفض نهائياً ولا يُرفع حضوراً', async () => {
    const { rpc, client } = fakeClient()
    const corrupt = { ...newOffEntry('u', 'h', '2026-10-29', 'security', null, NOW), off: undefined }
    const { error } = await uploadAttendanceEntry(client, corrupt)
    expect(rpc).not.toHaveBeenCalled()
    expect(error?.code).toBe('22023')
    expect(error?.message).toBe('بلاغٌ ناقص على الجهاز')
    expect(classifySyncError(error)).toBe('reject')
  })
})

describe('settleAttendanceEntry', () => {
  const base = (): SettleTarget => ({
    days: { '2026-10-29': { held: true, absences: {} } },
    offDays: { '2026-10-28': { reason: 'other', note: 'x', status: 'approved', reviewNote: null } }
  })

  it('حضورٌ يدخل مسجَّلاً بلا المتخطَّين، ويمحو بلاغَ اليوم', () => {
    const m: SettleTarget = { days: {}, offDays: { '2026-10-29': { reason: 'other', note: 'x', status: 'pending', reviewNote: null } } }
    settleAttendanceEntry(m, newEntry('u', 'h', '2026-10-29', { a: 'excused', b: 'unexcused' }, NOW), { skipped: ['b'] })
    expect(m.days['2026-10-29']).toEqual({ held: true, absences: { a: 'excused' } })
    expect(m.offDays).toEqual({})
  })

  it('بلاغٌ يضع بلاغاً معلّقاً ويمحو الحضور', () => {
    const m = base()
    settleAttendanceEntry(m, newOffEntry('u', 'h', '2026-10-29', 'teacher_sick', 'مرض', NOW), { id: '1', status: 'pending' })
    expect(m.offDays?.['2026-10-29']).toEqual({ reason: 'teacher_sick', note: 'مرض', status: 'pending', reviewNote: null })
    expect(m.days['2026-10-29']).toBeUndefined()
    expect(m.offDays?.['2026-10-28']).toBeDefined()
  })

  it('حالةُ البلاغ من ردّ الدالّة: معتمَدٌ يبقى معتمَداً، وقيمةٌ غريبة تعود معلّقة', () => {
    const entry = newOffEntry('u', 'h', '2026-10-29', 'security', null, NOW)
    const a = base()
    settleAttendanceEntry(a, entry, { id: '1', status: 'approved' })
    expect(a.offDays?.['2026-10-29']?.status).toBe('approved')
    const b = base()
    settleAttendanceEntry(b, entry, { id: '1', status: 'weird' })
    expect(b.offDays?.['2026-10-29']?.status).toBe('pending')
  })

  it('الملاحظةُ في النسخة تُشذَّب وتصير null إن فرغت', () => {
    const m = base()
    settleAttendanceEntry(m, newOffEntry('u', 'h', '2026-10-29', 'security', '   ', NOW), null)
    expect(m.offDays?.['2026-10-29']?.note).toBeNull()
    settleAttendanceEntry(m, newOffEntry('u', 'h', '2026-10-29', 'other', '  مرض  ', NOW), null)
    expect(m.offDays?.['2026-10-29']?.note).toBe('مرض')
  })

  it('سحبٌ يمحو البلاغ وحده', () => {
    const m = base()
    settleAttendanceEntry(m, newWithdrawEntry('u', 'h', '2026-10-28', NOW), { withdrawn: true })
    expect(m.offDays).toEqual({})
    expect(m.days['2026-10-29']).toBeDefined()
  })

  it('نسخةٌ قديمةٌ بلا offDays تعمل', () => {
    const m: SettleTarget = { days: {} }
    settleAttendanceEntry(m, newEntry('u', 'h', '2026-10-29', {}, NOW), null)
    expect(m.days['2026-10-29']).toEqual({ held: true, absences: {} })
    settleAttendanceEntry(m, newWithdrawEntry('u', 'h', '2026-10-29', NOW), null)
    expect(m.offDays).toBeUndefined()
  })
})
