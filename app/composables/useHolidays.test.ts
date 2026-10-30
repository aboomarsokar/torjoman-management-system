/**
 * اختبارُ `useHolidays` بلا Nuxt (الاستيراداتُ التلقائيّة محاكاة): القراءةُ مرتَّبة، والإضافةُ بطلبٍ واحدٍ بمصفوفة،
 * والفشلُ يُعرض ويعيد القراءة، ونيابةُ القراءة تُمنع قبل الإرسال، وعدُّ الحلقات المتميّزة عبر الصفحات.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

type Result = { data?: unknown, error: unknown }
let holidayRows: { day: string, reason: string }[] = []
let dayPages: { halaqa_id: string }[][] = []
let writeError: unknown = null
const calls: { op: string, arg?: unknown }[] = []
const handle = vi.fn()
const blockIfReadOnly = vi.fn()

function holidaysBuilder() {
  const b: Record<string, unknown> = {
    select: () => Promise.resolve({ data: holidayRows, error: null } as Result),
    insert: (rows: unknown) => {
      calls.push({ op: 'insert', arg: rows })
      return Promise.resolve({ error: writeError })
    },
    delete: () => ({
      eq: (_col: string, day: string) => {
        calls.push({ op: 'delete', arg: day })
        return Promise.resolve({ error: writeError })
      }
    })
  }
  return b
}

function daysBuilder() {
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.in = (_c: string, days: string[]) => {
    calls.push({ op: 'in', arg: days })
    return b
  }
  b.order = () => b
  b.range = (from: number, to: number) => {
    calls.push({ op: 'range', arg: [from, to] })
    return Promise.resolve({ data: dayPages.shift() ?? [], error: null } as Result)
  }
  return b
}

vi.stubGlobal('ref', ref)
vi.stubGlobal('useSupabaseClient', () => ({ from: (t: string) => (t === 'attendance_holidays' ? holidaysBuilder() : daysBuilder()) }))
vi.stubGlobal('useErrorHandler', () => ({ handle }))
vi.stubGlobal('useImpersonation', () => ({ blockIfReadOnly }))
const { useHolidays } = await import('./useHolidays')

beforeEach(() => {
  holidayRows = []
  dayPages = []
  writeError = null
  calls.length = 0
  handle.mockClear()
  blockIfReadOnly.mockReset()
})

describe('useHolidays', () => {
  it('load يرتّب القادمةَ أولاً ثم الماضية', async () => {
    holidayRows = [{ day: '2026-10-05', reason: 'قديم' }, { day: '2999-01-02', reason: 'بعيد' }, { day: '2999-01-01', reason: 'قريب' }]
    const h = useHolidays()
    await h.load()
    expect(h.list.value.map(r => r.day)).toEqual(['2999-01-01', '2999-01-02', '2026-10-05'])
  })

  it('add يدرج الأيامَ بمصفوفةٍ في طلبٍ واحد والسببُ مشذَّب، ثم يعيد القراءة', async () => {
    const h = useHolidays()
    const ok = await h.add(['2026-11-05', '2026-11-07'], '  عيد  ')
    expect(ok).toBe(true)
    expect(calls.filter(c => c.op === 'insert')).toEqual([
      { op: 'insert', arg: [{ day: '2026-11-05', reason: 'عيد' }, { day: '2026-11-07', reason: 'عيد' }] }
    ])
  })

  it('add بسببٍ فارغٍ أو بلا أيامٍ لا يرسل شيئاً', async () => {
    const h = useHolidays()
    expect(await h.add(['2026-11-05'], '   ')).toBe(false)
    expect(await h.add([], 'عيد')).toBe(false)
    expect(calls).toEqual([])
  })

  it('رفضُ القاعدة يُعرض ويُرجع false', async () => {
    writeError = new Error('الجمعة عطلةٌ أصلاً — لا تُعيَّن إجازة')
    const h = useHolidays()
    expect(await h.add(['2026-11-05'], 'عيد')).toBe(false)
    expect(handle).toHaveBeenCalledWith(writeError)
  })

  it('نيابةُ القراءة تُمنع قبل الإرسال', async () => {
    const blocked = new Error('وضع القراءة')
    blockIfReadOnly.mockImplementation(() => {
      throw blocked
    })
    const h = useHolidays()
    expect(await h.remove('2026-11-05')).toBe(false)
    expect(handle).toHaveBeenCalledWith(blocked)
    expect(calls.some(c => c.op === 'delete')).toBe(false)
  })

  it('remove يحذف اليومَ المعيَّن', async () => {
    const h = useHolidays()
    expect(await h.remove('2026-11-05')).toBe(true)
    expect(calls).toContainEqual({ op: 'delete', arg: '2026-11-05' })
  })

  it('recordedHalaqat يعدّ الحلقاتِ المتميّزة ويقرأ صفحةً تالية حين تمتلئ الأولى', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ halaqa_id: `h${i % 3}` }))
    dayPages = [full, [{ halaqa_id: 'h9' }]]
    const h = useHolidays()
    expect(await h.recordedHalaqat(['2026-11-05', '2026-11-07'])).toBe(4)
    expect(calls.filter(c => c.op === 'range').map(c => c.arg)).toEqual([[0, 999], [1000, 1999]])
  })

  it('recordedHalaqat بلا أيامٍ صفرٌ بلا طلب', async () => {
    const h = useHolidays()
    expect(await h.recordedHalaqat([])).toBe(0)
    expect(calls).toEqual([])
  })
})
