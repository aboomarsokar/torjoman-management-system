import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch } from 'vue'
import type { AttendanceMirror } from './useOfflineMirror'
import type { OutboxEntry } from '~/utils/attendanceOutbox'
import { keptAbsences } from '~/utils/attendanceOutbox'

// بيئةُ الاختبار بلا Nuxt: الاستيراداتُ التلقائيّة محاكاةٌ، والصندوقُ العامّ ذاكرةٌ بمفتاح السطر (put يستبدل، discard يحذف)
// وصندوقُ الحضور فوقه حقيقيّ — والمختبَرُ قرارُ الشاشة: أيُّ سطرٍ يُكتب لليوم، ومتى يُمنع الحفظُ والبلاغ.
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
const rows = ref<OutboxEntry[]>([])
const online = ref(false)
vi.stubGlobal('useOfflineQueue', () => ({
  entries: computed(() => rows.value),
  pending: computed(() => rows.value.filter(e => e.status === 'pending')),
  rejected: computed(() => rows.value.filter(e => e.status === 'rejected')),
  syncing: ref(false), lastUploaded: ref(null), online,
  load: vi.fn(), flush: vi.fn(), retry: vi.fn(),
  put: vi.fn(async (e: OutboxEntry) => {
    rows.value = [...rows.value.filter(r => r.key !== e.key), e]
  }),
  discard: vi.fn(async (key: string) => {
    rows.value = rows.value.filter(r => r.key !== key)
  })
}))
const mirror = ref<AttendanceMirror | null>(null)
vi.stubGlobal('useOfflineMirror', () => ({ mirror, refreshing: ref(false), loadLocal: vi.fn(), refresh: vi.fn(), loadDay: vi.fn() }))
vi.stubGlobal('useSupabaseClient', () => ({}))
vi.stubGlobal('useSupabaseUser', () => ref({ sub: 'u' }))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('useImpersonation', () => ({ isReadOnlyNow: () => false }))
vi.mock('~/utils/offlineQueues', () => ({ ATTENDANCE_QUEUE: 'attendance' }))
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online.value }))
vi.mock('~/utils/reportWindow', async orig => ({ ...(await orig<typeof import('~/utils/reportWindow')>()), gazaToday: () => '2026-10-29' }))
vi.stubGlobal('useAttendanceOutbox', (await import('./useAttendanceOutbox')).useAttendanceOutbox)
const { useOfflineAttendance, draftChanged } = await import('./useOfflineAttendance')

const DAY = '2026-10-29'
const baseMirror = (extra: Partial<AttendanceMirror> = {}): AttendanceMirror => ({
  uid: 'u', fullName: 'م', halaqa: { id: 'h', name: 'الحلقة', gender: 'male' },
  students: [{ id: 's1', full_name: 'ط', enrollment_date: null }],
  days: {}, from: '2026-09-20', approvedMonths: [], syncedAt: '2026-10-29T08:00:00Z', ...extra
})

/** الشاشةُ لمعلّمٍ بنسخته — كما بعد `start()`. */
function screen() {
  const s = useOfflineAttendance()
  s.access.value = 'teacher'
  return s
}

beforeEach(() => {
  rows.value = []
  online.value = false
  mirror.value = baseMirror()
})

describe('keptAbsences', () => {
  it('يحذف من تخطّاهم الرفع', () => {
    expect(keptAbsences({ a: 'excused', b: 'unexcused' }, ['b'])).toEqual({ a: 'excused' })
  })
})

describe('draftChanged', () => {
  it('يرى تغيّرَ الحالة لطلاب القائمة وحدهم', () => {
    expect(draftChanged({ a: 'excused' }, { a: 'excused' }, ['a'])).toBe(false)
    expect(draftChanged({ a: 'excused' }, {}, ['a'])).toBe(true)
    expect(draftChanged({}, { gone: 'excused' }, ['a'])).toBe(false)
  })
})

describe('بلاغ «لم تنعقد الحلقة» في /t', () => {
  it('يومٌ عاديّ: الحفظُ والبلاغُ متاحان كما قبل', () => {
    const s = screen()
    expect(s.day.value).toBe(DAY)
    expect(s.canWrite.value).toBe(true)
    expect(s.canReport.value).toBe(true)
    expect(s.reportShown.value).toBe(true)
    expect(s.off.value).toBeNull()
    expect(s.holiday.value).toBeNull()
  })

  it('reportOff بلا اتصال يضع سطراً off ويُخفي القائمة', async () => {
    const s = screen()
    expect(await s.reportOff('security', '  قصف  ')).toBe(true)
    expect(rows.value).toHaveLength(1)
    expect(rows.value[0]).toMatchObject({ kind: 'off', day: DAY, off: { reason: 'security', note: 'قصف' } })
    expect(s.off.value).toMatchObject({ queued: true, reason: 'security' })
    expect(s.canWrite.value).toBe(false)
    expect(s.reportShown.value).toBe(false)
  })

  it('reportOff بسببٍ آخر بلا ملاحظة يُرفض فلا سطر', async () => {
    const s = screen()
    expect(await s.reportOff('other', '  ')).toBe(false)
    expect(rows.value).toHaveLength(0)
  })

  it('withdrawOff بلا اتصال يحذف سطرَ البلاغ فلا شيءَ في الصندوق', async () => {
    const s = screen()
    await s.reportOff('teacher_sick', null)
    expect(await s.withdrawOff()).toBe(true)
    expect(rows.value).toHaveLength(0)
    expect(s.off.value).toBeNull()
    expect(s.canWrite.value).toBe(true)
  })

  it('withdrawOff متّصلاً لبلاغٍ على الجهاز: سطرُ سحبٍ يحلّ محلّه (قد يكون في الطريق)', async () => {
    const s = screen()
    await s.reportOff('security', null)
    online.value = true
    expect(await s.withdrawOff()).toBe(true)
    expect(rows.value).toHaveLength(1)
    expect(rows.value[0]!.kind).toBe('withdraw')
  })

  it('بلاغٌ في النسخة pending ← withdrawOff يضع سطرَ withdraw', async () => {
    mirror.value = baseMirror({ offDays: { [DAY]: { reason: 'security', note: null, status: 'pending', reviewNote: null } } })
    const s = screen()
    expect(s.off.value).toMatchObject({ status: 'pending', queued: false })
    expect(s.canWrite.value).toBe(false)
    expect(await s.withdrawOff()).toBe(true)
    expect(rows.value).toHaveLength(1)
    expect(rows.value[0]).toMatchObject({ kind: 'withdraw', day: DAY })
    // بعد السحب يعود اليومُ غيرَ مسجَّلٍ فيُسجَّل حضورُه
    expect(s.off.value).toBeNull()
    expect(s.shown.value.held).toBe(false)
    expect(s.canWrite.value).toBe(true)
  })

  it('بلاغٌ معتمَد: لا سحبَ ولا بلاغَ ولا حفظ', async () => {
    mirror.value = baseMirror({ offDays: { [DAY]: { reason: 'security', note: null, status: 'approved', reviewNote: null } } })
    const s = screen()
    expect(s.canWithdraw.value).toBe(false)
    expect(s.canReport.value).toBe(false)
    expect(s.canWrite.value).toBe(false)
    expect(await s.withdrawOff()).toBe(false)
    expect(rows.value).toHaveLength(0)
  })

  it('بلاغٌ مرفوض: «عدّل البلاغ» و«تراجع» متاحان', () => {
    mirror.value = baseMirror({ offDays: { [DAY]: { reason: 'other', note: 'ن', status: 'rejected', reviewNote: 'انعقدت' } } })
    const s = screen()
    expect(s.off.value).toMatchObject({ status: 'rejected', reviewNote: 'انعقدت' })
    expect(s.canReport.value).toBe(true)
    expect(s.canWithdraw.value).toBe(true)
    expect(s.canWrite.value).toBe(false)
  })

  it('يومُ إجازة ← canWrite وcanReport كلاهما false', () => {
    mirror.value = baseMirror({ holidays: { [DAY]: 'عيد' } })
    const s = screen()
    expect(s.holiday.value).toBe('عيد')
    expect(s.canWrite.value).toBe(false)
    expect(s.canReport.value).toBe(false)
    expect(s.reportShown.value).toBe(false)
  })

  it('محور المراجعة 3: reportOff ثمّ save() لليوم نفسه ← سطرٌ واحدٌ نوعُه attendance', async () => {
    const s = screen()
    await s.reportOff('security', null)
    // «تراجع» على الجهاز ثمّ الحفظ — الطريقُ الوحيد إلى القائمة بعد البلاغ
    await s.withdrawOff()
    await s.reportOff('security', null)
    expect(rows.value).toHaveLength(1)
    // الحفظُ مباشرةً فوق البلاغ: الصندوقُ يقبله (القاعدةُ تمحو بلاغاً معلّقاً)، والسطرُ واحد
    await s.outbox.enqueue('h', DAY, {})
    expect(rows.value).toHaveLength(1)
    expect(rows.value[0]!.kind).toBe('attendance')
    expect(s.off.value).toBeNull()
  })

  it('محور المراجعة 3 عبر save(): بعد سحب البلاغ على الجهاز يُحفظ الحضور سطراً واحداً', async () => {
    const s = screen()
    await s.reportOff('security', null)
    await s.withdrawOff()
    expect(await s.save()).toBe(true)
    expect(rows.value).toHaveLength(1)
    expect(rows.value[0]!.kind).toBe('attendance')
  })

  it('يومٌ من شهرٍ معتمَد: الزرُّ ظاهرٌ معطَّلٌ بسببه، والحفظُ ممنوع', () => {
    mirror.value = baseMirror({ approvedMonths: ['2026-10'] })
    const s = screen()
    expect(s.canWrite.value).toBe(false)
    expect(s.reportShown.value).toBe(true)
    expect(s.canReport.value).toBe(false)
    expect(s.reportBlock.value).toBe('الشهر معتمَد — لا بلاغ بعد اعتماده')
  })

  it('نسخةُ جهازٍ قديمة بلا offDays وholidays: لا بلاغ ولا إجازة', () => {
    const s = screen()
    expect(s.holiday.value).toBeNull()
    expect(s.off.value).toBeNull()
    expect(s.strip.value.days.every(d => d.state !== 'holiday' && d.state !== 'off')).toBe(true)
  })

  it('الشريط: البلاغُ على الجهاز off_pending، والحضورُ queued', async () => {
    const s = screen()
    await s.reportOff('security', null)
    const today = s.strip.value.days.find(d => d.date === DAY)
    expect(today?.state).toBe('off_pending')
    s.day.value = '2026-10-28'
    await s.save()
    expect(s.strip.value.days.find(d => d.date === '2026-10-28')?.state).toBe('queued')
  })

  it('المرفوضُ من القاعدة: البلاغُ «بلاغ dd-mm-yyyy» والحضورُ بتاريخه', () => {
    rows.value = [
      { key: 'u|h|2026-10-28', uid: 'u', halaqaId: 'h', day: '2026-10-28', absences: {}, recordedAt: 'x', attempts: 0, status: 'rejected', kind: 'off', off: { reason: 'security', note: null } },
      { key: 'u|h|2026-10-27', uid: 'u', halaqaId: 'h', day: '2026-10-27', absences: {}, recordedAt: 'x', attempts: 0, status: 'rejected' }
    ]
    const s = screen()
    expect(s.rejectedRows.value.map(r => r.label)).toEqual(['بلاغ 28-10-2026', '27-10-2026'])
  })
})
