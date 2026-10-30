/**
 * قراءةُ يومٍ في `useAttendanceDay` بلا Nuxt (الاستيراداتُ التلقائيّة محاكاة): بلاغُ اليوم السابق وإجازتُه لا يبقيان أثناء
 * قراءة يومٍ آخر، فلا يُعتمد بلاغٌ بمعرّفه القديم بعد تبديل اليوم أو الحلقة.
 */
import { describe, expect, it, vi } from 'vitest'
import { ref, watch } from 'vue'

type Result = { data: unknown, error: null }
const results: Record<string, () => Promise<Result>> = {}
const rpc = vi.fn(async () => ({ error: null }))

/** باني استعلامٍ يُجاب بنتيجة جدوله، وينتظر (`await`) كما يفعل supabase-js. */
function builder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'limit']) b[m] = () => b
  b.maybeSingle = () => results[table]!()
  b.then = (ok: (r: Result) => unknown, bad: (e: unknown) => unknown) => results[table]!().then(ok, bad)
  return b
}
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('useSupabaseClient', () => ({ from: builder, rpc }))
vi.stubGlobal('useErrorHandler', () => ({ handle: vi.fn() }))
vi.stubGlobal('useImpersonation', () => ({ blockIfReadOnly: () => undefined }))
const { useAttendanceDay } = await import('./useAttendanceDay')

const ok = (data: unknown) => async (): Promise<Result> => ({ data, error: null })
const offRow = {
  id: 'o1', reason: 'security', note: null, status: 'pending', review_note: null,
  reported_at: '2026-10-29T06:00:00Z', reporter: { full_name: 'أحمد' }
}

function setDay(offData: unknown, holidayData: unknown) {
  results.attendance_days = ok(null)
  results.attendance_absences = ok([])
  results.monthly_reports = ok([])
  results.attendance_off_days = typeof offData === 'function' ? offData as () => Promise<Result> : ok(offData)
  results.attendance_holidays = ok(holidayData)
}

describe('useAttendanceDay.load — بلاغُ اليوم السابق لا يبقى', () => {
  it('يصفّر البلاغَ والإجازة فور بدء قراءة يومٍ آخر، فلا يُعتمد بلاغٌ قديم', async () => {
    const halaqa = ref<string | null>('h1')
    const day = ref('2026-10-28')
    const att = useAttendanceDay(halaqa, day)

    setDay(offRow, { reason: 'عيد' })
    await att.load()
    expect(att.offDay.value?.id).toBe('o1')
    expect(att.holiday.value).toBe('عيد')

    let release: (r: Result) => void = () => undefined
    setDay(() => new Promise<Result>((resolve) => {
      release = resolve
    }), null)
    day.value = '2026-10-29'
    const loading = att.load()
    expect(att.offDay.value).toBeNull()
    expect(att.holiday.value).toBeNull()
    // وفي أثناء القراءة لا اعتمادَ ببلاغٍ غير محمَّل
    expect(await att.reviewOffDay(true, null)).toBe(false)
    expect(rpc).not.toHaveBeenCalled()

    release({ data: null, error: null })
    await loading
    expect(att.offDay.value).toBeNull()
  })

  it('بلا حلقة: يُصفَّر البلاغ والإجازة', async () => {
    const halaqa = ref<string | null>('h1')
    const att = useAttendanceDay(halaqa, ref('2026-10-28'))
    setDay(offRow, { reason: 'عيد' })
    await att.load()
    halaqa.value = null
    await att.load()
    expect(att.offDay.value).toBeNull()
    expect(att.holiday.value).toBeNull()
  })
})
