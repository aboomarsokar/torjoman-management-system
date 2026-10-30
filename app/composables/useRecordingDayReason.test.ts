/**
 * اختبارُ `useRecordingDayReason` بلا Nuxt (الاستيراداتُ التلقائيّة محاكاة): الإجازةُ تُقرأ باليوم وحده، والبلاغُ بالحلقة
 * واليوم، والنصُّ جاهزٌ للعرض، والفشلُ يرتفع.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let table = ''
const eqs: [string, string][] = []
let result: { data: Record<string, string | null> | null, error: unknown } = { data: null, error: null }

vi.stubGlobal('useSupabaseClient', () => ({
  from: (t: string) => {
    table = t
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: string) => {
      eqs.push([c, v])
      return b
    }
    b.maybeSingle = () => Promise.resolve(result)
    return b
  }
}))
const { useRecordingDayReason } = await import('./useRecordingDayReason')

beforeEach(() => {
  table = ''
  eqs.length = 0
  result = { data: null, error: null }
})

describe('useRecordingDayReason', () => {
  it('إجازة: من attendance_holidays باليوم وحده', async () => {
    result = { data: { reason: 'عيد' }, error: null }
    const text = await useRecordingDayReason().read('holiday', 'h1', '2026-10-27', false)
    expect(table).toBe('attendance_holidays')
    expect(eqs).toEqual([['day', '2026-10-27']])
    expect(text).toBe('إجازةٌ عامة — عيد. لا يُعدّ يوماً ناقصاً.')
  })

  it('بلاغ: من attendance_off_days بالحلقة واليوم، بتسمية السبب والملاحظة', async () => {
    result = { data: { reason: 'security', note: 'قصف' }, error: null }
    const text = await useRecordingDayReason().read('off_pending', 'h1', '2026-10-29', true)
    expect(table).toBe('attendance_off_days')
    expect(eqs).toEqual([['halaqa_id', 'h1'], ['day', '2026-10-29']])
    expect(text).toContain('بلّغت المعلّمةُ')
    expect(text).toContain('ظرف أمني · قصف')
  })

  it('صفٌّ غائب (محجوب أو محذوف): نصٌّ بلا سبب لا خطأ', async () => {
    const text = await useRecordingDayReason().read('off', 'h1', '2026-10-29', false)
    expect(text).toBe('لم تنعقد الحلقة. اعتمده المشرف فلا يُعدّ يوماً ناقصاً.')
  })

  it('الفشلُ يرتفع', async () => {
    result = { data: null, error: new Error('x') }
    await expect(useRecordingDayReason().read('off', 'h1', '2026-10-29', false)).rejects.toThrow('x')
  })
})
